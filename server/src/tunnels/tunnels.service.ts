import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tunnel } from './entities/tunnel.entity';
import { SshService } from './ssh.service';
import { Setting } from '../settings/entities/setting.entity';
import { Node } from '../nodes/entities/node.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { CreateTunnelDto } from './dto/create-tunnel.dto';
import * as net from 'net';
import * as dns from 'dns/promises';
import { DomainsService } from '../domains/domains.service';

@Injectable()
export class TunnelsService {
  private readonly logger = new Logger(TunnelsService.name);

  constructor(
    @InjectRepository(Tunnel) private tunnelRepo: Repository<Tunnel>,
    @InjectRepository(Setting) private settingRepo: Repository<Setting>,
    @InjectRepository(Node) private nodeRepo: Repository<Node>,
    @InjectRepository(Subscription)
    private subscriptionRepo: Repository<Subscription>,
    private sshService: SshService,
    private readonly domainsService: DomainsService,
  ) {}

  async create(createTunnelDto: CreateTunnelDto) {
    const address = await this.resolveRelayAddress(createTunnelDto.ip);

    const node = createTunnelDto.nodeId
      ? await this.nodeRepo.findOne({ where: { id: createTunnelDto.nodeId } })
      : await this.nodeRepo.findOne({ where: { isMain: true } });

    if (!node) {
      throw new HttpException('Node not found', HttpStatus.BAD_REQUEST);
    }

    const tunnelPayload = {
      ...createTunnelDto,
      ip: address.ip,
      node,
      nodeId: node.id,
    };

    const domain = createTunnelDto.domain || address.domain;
    if (domain) {
      Object.assign(tunnelPayload, { domain });
    }

    const tunnel = this.tunnelRepo.create(tunnelPayload);
    return this.tunnelRepo.manager.transaction(async (manager) => {
      const saved = await manager.getRepository(Tunnel).save(tunnel);
      await this.domainsService.addHostDomain(domain, manager);
      return saved;
    });
  }

  async findAll() {
    return this.tunnelRepo.find({ relations: ['node'] });
  }

  async remove(id: number, deleteForwarding = false) {
    if (deleteForwarding) {
      await this.uninstallScript(id);
    }

    await this.cleanupRelayDependencies(id);
    return this.tunnelRepo.delete(id);
  }

  private async cleanupRelayDependencies(id: number) {
    const subscriptions = await this.subscriptionRepo.find({
      where: [{ relayServerId: id }],
    });

    for (const sub of subscriptions) {
      sub.relayServerId = undefined;
      sub.relayServer = undefined;
      await this.subscriptionRepo.save(sub);
    }

    const configuredSubscriptions = await this.subscriptionRepo.find();
    for (const sub of configuredSubscriptions) {
      const config = sub.inboundsConfig || [];
      const nextConfig = config.map((item) => {
        if (item.relayServerId !== id) return item;
        const { relayServerId: _relayServerId, ...rest } = item;
        return rest;
      });

      if (JSON.stringify(nextConfig) !== JSON.stringify(config)) {
        sub.inboundsConfig = nextConfig;
        await this.subscriptionRepo.save(sub);
      }
    }
  }

  async installScript(id: number) {
    const tunnel = await this.tunnelRepo
      .createQueryBuilder('tunnel')
      .addSelect('tunnel.password')
      .addSelect('tunnel.privateKey')
      .where('tunnel.id = :id', { id })
      .getOne();

    if (!tunnel)
      throw new HttpException('Tunnel not found', HttpStatus.NOT_FOUND);

    const targetNode = tunnel.nodeId
      ? await this.nodeRepo.findOne({ where: { id: tunnel.nodeId } })
      : await this.nodeRepo.findOne({ where: { isMain: true } });
    const hostSetting = await this.settingRepo.findOne({
      where: { key: 'xui_ip' },
    });

    if (!targetNode && (!hostSetting || !hostSetting.value)) {
      throw new HttpException(
        'В настройках (Settings) не сохранен Host/IP основного сервера (xui_host). Сохраните настройки подключения к 3x-ui заново.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const mainServerIp =
      targetNode?.ip ||
      targetNode?.host ||
      this.getNodeAddress(targetNode) ||
      hostSetting?.value;

    this.logger.debug(
      `Начинаем установку редиректа на ${tunnel.ip} -> ${mainServerIp}`,
    );

    const command = `sudo ORIGIN_IP="${mainServerIp}" bash -c "$(curl -sSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/forwarding_install.sh)"`;

    try {
      const output = await this.sshService.executeCommand(
        {
          host: tunnel.ip,
          port: tunnel.sshPort,
          username: tunnel.username,
          password: tunnel.password,
          privateKey: tunnel.privateKey,
        },
        command,
        180000,
      );

      this.logger.debug(`Скрипт выполнен успешно:\n${output}`);

      tunnel.isInstalled = true;
      await this.tunnelRepo.save(tunnel);

      return { success: true, output };
    } catch (e) {
      const error = e as Error;
      this.logger.error(`Ошибка SSH: ${error.message}`);
      throw new HttpException(
        `Ошибка установки: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async uninstallScript(id: number) {
    const tunnel = await this.tunnelRepo
      .createQueryBuilder('tunnel')
      .addSelect('tunnel.password')
      .addSelect('tunnel.privateKey')
      .where('tunnel.id = :id', { id })
      .getOne();

    if (!tunnel) {
      throw new HttpException('Tunnel not found', HttpStatus.NOT_FOUND);
    }

    const command =
      'sudo bash -c "$(curl -sSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/forwarding_delete.sh)"';

    try {
      const output = await this.sshService.executeCommand(
        {
          host: tunnel.ip,
          port: tunnel.sshPort,
          username: tunnel.username,
          password: tunnel.password,
          privateKey: tunnel.privateKey,
        },
        command,
        180000,
      );

      tunnel.isInstalled = false;
      await this.tunnelRepo.save(tunnel);
      return { success: true, output };
    } catch (e) {
      const error = e as Error;
      this.logger.error(`Forwarding delete error: ${error.message}`);
      throw new HttpException(
        `Forwarding delete failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private getNodeAddress(node?: Node | null) {
    if (!node?.url) return undefined;

    try {
      return new URL(node.url).hostname;
    } catch {
      return node.url;
    }
  }

  private async resolveRelayAddress(value: string) {
    const address = value.trim();
    if (!address) {
      throw new HttpException(
        'Relay server address is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (net.isIP(address) !== 0) {
      return { ip: address, domain: undefined };
    }

    if (!this.isValidHostname(address)) {
      throw new HttpException(
        'Relay server address is invalid',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const result = await dns.lookup(address);
      return { ip: result.address, domain: address };
    } catch {
      throw new HttpException(
        'Relay server domain cannot be resolved',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private isValidHostname(value: string) {
    if (value.length > 253) return false;
    return /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(
      value,
    );
  }
}
