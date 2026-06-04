import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Inbound } from '../inbounds/entities/inbound.entity';
import { Domain } from '../domains/entities/domain.entity';
import { Setting } from '../settings/entities/setting.entity';
import { Node } from '../nodes/entities/node.entity';
import { Tunnel } from '../tunnels/entities/tunnel.entity';

import { XuiService } from '../xui/xui.service';
import { InboundBuilderService } from '../inbounds/inbound-builder.service';
import { XuiInboundRaw } from '../inbounds/xui-inbound.types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RotationService implements OnModuleInit {
  private readonly logger = new Logger(RotationService.name);

  constructor(
    @InjectRepository(Subscription) private subRepo: Repository<Subscription>,
    @InjectRepository(Inbound) private inboundRepo: Repository<Inbound>,
    @InjectRepository(Domain) private domainRepo: Repository<Domain>,
    @InjectRepository(Setting) private settingRepo: Repository<Setting>,
    @InjectRepository(Node) private nodeRepo: Repository<Node>,
    @InjectRepository(Tunnel) private tunnelRepo: Repository<Tunnel>,
    private xuiService: XuiService,
    private inboundBuilder: InboundBuilderService,
  ) {}

  async onModuleInit() {
    await this.initDefaultSettings();
  }

  private async initDefaultSettings() {
    const statusKey = 'rotation_status';
    const intervalKey = 'rotation_interval';
    const lastRunKey = 'last_rotation_timestamp';

    // Инициализация статуса ротации
    const existingStatus = await this.settingRepo.findOne({
      where: { key: statusKey },
    });
    if (!existingStatus) {
      this.logger.debug(`Инициализация настройки: ${statusKey} = active`);
      const newSetting = this.settingRepo.create({
        key: statusKey,
        value: 'active',
      });
      await this.settingRepo.save(newSetting);
    } else {
      this.logger.debug(`Текущий статус ротации: ${existingStatus.value}`);
    }

    // Инициализация интервала ротации (по умолчанию 30 минут)
    const existingInterval = await this.settingRepo.findOne({
      where: { key: intervalKey },
    });
    if (!existingInterval) {
      this.logger.debug(`Инициализация настройки: ${intervalKey} = 30`);
      const newSetting = this.settingRepo.create({
        key: intervalKey,
        value: '30',
      });
      await this.settingRepo.save(newSetting);
    }

    // Инициализация last_rotation_timestamp (текущее время, чтобы не было ложной ротации при старте)
    const existingLastRun = await this.settingRepo.findOne({
      where: { key: lastRunKey },
    });
    if (!existingLastRun) {
      const now = Date.now();
      this.logger.debug(`Инициализация настройки: ${lastRunKey} = ${now}`);
      const newSetting = this.settingRepo.create({
        key: lastRunKey,
        value: now.toString(),
      });
      await this.settingRepo.save(newSetting);
    } else {
      this.logger.debug(`Последняя ротация: ${existingLastRun.value}`);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleTicker() {
    const intervalSetting = await this.settingRepo.findOne({
      where: { key: 'rotation_interval' },
    });
    const intervalMinutes = intervalSetting
      ? parseInt(intervalSetting.value, 10)
      : 30;

    const lastRunSetting = await this.settingRepo.findOne({
      where: { key: 'last_rotation_timestamp' },
    });
    const lastRun = lastRunSetting ? parseInt(lastRunSetting.value, 10) : 0;

    const now = Date.now();
    const diffMinutes = (now - lastRun) / 1000 / 60;
    const statusSetting = await this.settingRepo.findOne({
      where: { key: 'rotation_status' },
    });
    const isStopped = statusSetting?.value === 'stopped';

    this.logger.debug(
      `Планировщик: интервал=${intervalMinutes}мин, прошло=${diffMinutes.toFixed(1)}мин, статус=${isStopped ? 'stopped' : 'active'}`,
    );

    if (diffMinutes < intervalMinutes || isStopped) {
      return;
    }

    this.logger.debug(
      `Запуск ротации (прошло ${diffMinutes.toFixed(1)}мин при интервале ${intervalMinutes}мин)`,
    );
    await this.performRotation();

    await this.saveSetting('last_rotation_timestamp', now.toString());
  }

  private async saveSetting(key: string, value: string) {
    let s = await this.settingRepo.findOne({ where: { key } });
    if (!s) s = this.settingRepo.create({ key });
    s.value = value;
    await this.settingRepo.save(s);
  }

  async performRotation() {
    this.logger.debug('Запуск плановой ротации...');

    const defaultNode = await this.getDefaultNode();
    const isLoginSuccess = defaultNode ? true : await this.xuiService.login();
    if (!isLoginSuccess) {
      this.logger.error('Отмена ротации: Не удалось войти в панель 3x-ui');
      return { success: false, message: 'Не удалось войти в панель 3x-ui' };
    }

    const subscriptions = await this.subRepo.find({
      where: {
        isEnabled: true,
        isAutoRotationEnabled: true,
      },
      relations: ['inbounds', 'inbounds.node', 'node', 'relayServer'],
    });
    if (subscriptions.length === 0) {
      return { success: false, message: 'Нет активных подписок для ротации' };
    }

    const domains = await this.domainRepo.find({ where: { isEnabled: true } });
    if (domains.length === 0) {
      this.logger.warn('Список доменов пуст! Ротация невозможна.');
      return { success: false, message: 'Список доменов пуст!' };
    }

    for (const sub of subscriptions) {
      const rotated = await this.rotateSubscription(sub, domains, defaultNode);
      if (!rotated) {
        return {
          success: false,
          message: 'Failed to delete old inbounds',
        };
      }
    }

    this.logger.debug('Ротация завершена.');
    return { success: true, message: 'Ротация успешно выполнена' };
  }

  private async rotateSubscription(
    sub: Subscription,
    domains: Domain[],
    defaultNode: Node | null,
  ) {
    this.logger.debug(`Ротация для подписки: ${sub.name} (${sub.uuid})`);

    // Удаляем старые инбаунды
    if (sub.inbounds && sub.inbounds.length > 0) {
      for (const inbound of sub.inbounds) {
        if (inbound.xuiId && inbound.xuiId > 0) {
          const isDeleted = await this.xuiService.deleteInbound(
            inbound.xuiId,
            await this.resolveInboundNode(inbound),
          );
          if (!isDeleted) {
            this.logger.error(
              `Failed to delete old inbound ${inbound.xuiId}; rotation for subscription ${sub.id} is aborted`,
            );
            return false;
          }
        }
        await this.inboundRepo.delete(inbound.id);
      }
    }

    const baseNode = sub.node ?? defaultNode ?? undefined;
    const keys = await this.xuiService.getNewX25519Cert(baseNode);
    if (!keys) {
      this.logger.error(
        'Не удалось получить Reality ключи, пропускаем подписку',
      );
      return false;
    }

    const usedPorts = new Set<number>();
    const host = await this.settingRepo.findOne({ where: { key: 'xui_host' } });
    const serverAddress =
      this.getNodeAddress(baseNode) || host?.value || 'localhost';
    const flag = await this.settingRepo.findOne({
      where: { key: 'xui_geo_flag' },
    });
    const defaultFlagEmoji = flag?.value ?? '%F0%9F%92%AF';

    // Получаем конфиг или пустой массив
    const inboundsConfig = sub.inboundsConfig || [];

    for (const config of inboundsConfig) {
      const type = config.type;
      const uuid = uuidv4();
      const targetNode = await this.resolveNode(
        config.nodeId,
        sub.node,
        defaultNode,
      );
      const resolvedRelay = await this.resolveRelay(
        config.relayServerId,
        sub.relayServer,
      );
      const relayServer =
        resolvedRelay && this.isRelayAvailableForNode(resolvedRelay, targetNode)
          ? resolvedRelay
          : undefined;
      const targetAddress =
        relayServer?.domain ||
        relayServer?.ip ||
        this.getNodeAddress(targetNode) ||
        serverAddress;
      const flagEmoji = config.flag || targetNode?.flag || defaultFlagEmoji;

      let sni = '';

      // === 1. Обработка Custom ===
      if (type === 'custom') {
        const newInbound = this.inboundRepo.create({
          xuiId: 0, // Не привязано к 3x-ui
          port: 0,
          protocol: 'custom',
          remark: 'custom-link',
          link: config.link || '',
          subscription: sub,
        });
        await this.inboundRepo.save(newInbound);
        continue;
      } else {
        sni = config.sni === 'random' ? this.pickDomain(domains) : config.sni;
      }

      
      // === 2. Обработка Hysteria2 ===
      if (type === 'hysteria2-udp') {
        let port = 0;
        if (config.port === 'random' || !config.port) {
          port = await this.getFreePort(0, usedPorts);
        } else {
          port =
            typeof config.port === 'string'
              ? parseInt(config.port, 10)
              : config.port;
        }
        usedPorts.add(port);

        const hysteriaSni = this.getNodeAddress(targetNode) || serverAddress;
        const hysteriaConfig = this.inboundBuilder.buildHysteria2Inbound({
          port,
          uuid,
          sni: hysteriaSni,
          certificateFile: config.certificateFile,
          keyFile: config.keyFile,
        });
        if (config.name?.trim()) {
          hysteriaConfig.remark = config.name.trim();
        }
        const xuiId = await this.xuiService.addInbound(
          hysteriaConfig,
          targetNode,
        );
        if (!xuiId) {
          this.logger.warn(
            'Hysteria2 inbound was not created by 3x-ui; skipping subscription link for this inbound',
          );
          continue;
        }

        const link = this.inboundBuilder.buildInboundLink(
          hysteriaConfig,
          targetAddress,
          uuid,
          flagEmoji,
        );
        const newInbound = this.inboundRepo.create({
          xuiId,
          port,
          protocol: 'hysteria2',
          remark: hysteriaConfig.remark,
          link: link,
          subscription: sub,
          node: targetNode,
          relayServer,
        });
        await this.inboundRepo.save(newInbound);
        continue;
      }

      // === 3. Обработка стандартных инбаундов Xray (3x-ui) ===

      // Определяем порт
      let port = 0;
      if (config.port === 'random' || !config.port) {
        port = await this.getFreePort(0, usedPorts);
      } else {
        // Если передан конкретный порт строкой или числом
        port =
          typeof config.port === 'string'
            ? parseInt(config.port, 10)
            : config.port;
      }
      usedPorts.add(port);

      let xuiConfig: XuiInboundRaw | null = null;

      switch (type) {
        case 'vless-tcp-reality':
          xuiConfig = this.inboundBuilder.buildVlessRealityTcp({
            port,
            uuid,
            sni,
            ...keys,
          });
          break;
        case 'vless-xhttp-reality':
          xuiConfig = this.inboundBuilder.buildVlessRealityXhttp({
            port,
            uuid,
            sni,
            ...keys,
          });
          break;
        case 'vless-grpc-reality':
          xuiConfig = this.inboundBuilder.buildVlessRealityGrpc({
            port,
            uuid,
            sni,
            ...keys,
          });
          break;
        case 'vless-ws':
          xuiConfig = this.inboundBuilder.buildVlessWs({ port, uuid, sni });
          break;
        case 'vmess-tcp':
          xuiConfig = this.inboundBuilder.buildVmessTcp({ port, uuid });
          break;
        case 'shadowsocks-tcp':
          xuiConfig = this.inboundBuilder.buildShadowsocksTcp({ port, uuid });
          break;
        case 'trojan-tcp-reality':
          xuiConfig = this.inboundBuilder.buildTrojanRealityTcp({
            port,
            uuid,
            sni,
            ...keys,
          });
          break;
        default:
          this.logger.warn(`Неизвестный тип инбаунда: ${type}`);
          continue;
      }

      if (config.name?.trim()) {
        xuiConfig.remark = config.name.trim();
      }

      const xuiId = await this.xuiService.addInbound(xuiConfig, targetNode);

      if (xuiId && xuiConfig) {
        const settings = JSON.parse(xuiConfig.settings) as {
          clients?: Array<{ id?: string; password?: string }>;
        };
        const idOrPass =
          settings.clients?.[0]?.id || settings.clients?.[0]?.password || '';

        const fullLink = this.inboundBuilder.buildInboundLink(
          xuiConfig,
          targetAddress,
          idOrPass,
          flagEmoji,
        );

        const newInbound = this.inboundRepo.create({
          xuiId: xuiId,
          port: port,
          protocol: xuiConfig.protocol,
          remark: xuiConfig.remark,
          link: fullLink,
          subscription: sub,
          node: targetNode,
          relayServer,
        });
        await this.inboundRepo.save(newInbound);
      }
    }

    return true;
  }

  private pickDomain(list: Domain[]): string {
    return list[Math.floor(Math.random() * list.length)].name;
  }

  private async getFreePort(
    preferred: number,
    currentBatch: Set<number>,
  ): Promise<number> {
    if (preferred > 0 && !currentBatch.has(preferred)) {
      const exists = await this.inboundRepo.findOne({
        where: { port: preferred },
      });
      if (!exists) return preferred;
    }

    while (true) {
      const p = Math.floor(Math.random() * (60000 - 10000)) + 10000;
      if (currentBatch.has(p)) continue;

      const exists = await this.inboundRepo.findOne({ where: { port: p } });
      if (!exists) return p;
    }
  }

  /**
   * Ручная ротация одной подписки (независимо от флага isAutoRotationEnabled)
   */
  async rotateSingleSubscription(subscriptionId: string) {
    this.logger.debug(`Запуск ручной ротации подписки: ${subscriptionId}`);

    const sub = await this.subRepo.findOne({
      where: { id: subscriptionId },
      relations: ['inbounds', 'inbounds.node', 'node', 'relayServer'],
    });

    if (!sub) {
      this.logger.warn(`Подписка не найдена: ${subscriptionId}`);
      return {
        success: false,
        message: 'Подписка не найдена',
      };
    }

    const defaultNode = await this.getDefaultNode();
    const isLoginSuccess = defaultNode ? true : await this.xuiService.login();
    if (!isLoginSuccess) {
      this.logger.error('Отмена ротации: Не удалось войти в панель 3x-ui');
      return { success: false, message: 'Не удалось войти в панель 3x-ui' };
    }

    const domains = await this.domainRepo.find({ where: { isEnabled: true } });
    if (domains.length === 0) {
      this.logger.warn('Список доменов пуст! Ротация невозможна.');
      return { success: false, message: 'Список доменов пуст!' };
    }

    const rotated = await this.rotateSubscription(sub, domains, defaultNode);
    if (!rotated) {
      return {
        success: false,
        message: 'Failed to delete old inbounds',
      };
    }

    this.logger.debug(`Ручная ротация подписки ${subscriptionId} завершена.`);
    return { success: true, message: 'Ротация успешно выполнена' };
  }

  private async getDefaultNode() {
    return this.nodeRepo
      .createQueryBuilder('node')
      .addSelect('node.password')
      .addSelect('node.token')
      .where('node.isMain = :isMain', { isMain: true })
      .getOne();
  }

  private async resolveNode(
    nodeId?: string,
    subscriptionNode?: Node,
    defaultNode?: Node | null,
  ) {
    if (!nodeId) return subscriptionNode ?? defaultNode ?? undefined;

    return (
      (await this.nodeRepo
        .createQueryBuilder('node')
        .addSelect('node.password')
        .addSelect('node.token')
        .where('node.id = :nodeId', { nodeId })
        .getOne()) ??
      subscriptionNode ??
      defaultNode ??
      undefined
    );
  }

  private async resolveInboundNode(inbound: Inbound) {
    if (!inbound.nodeId) return inbound.node;

    return (
      (await this.nodeRepo
        .createQueryBuilder('node')
        .addSelect('node.password')
        .addSelect('node.token')
        .where('node.id = :nodeId', { nodeId: inbound.nodeId })
        .getOne()) ?? inbound.node
    );
  }

  private async resolveRelay(relayServerId?: number, subscriptionRelay?: Tunnel) {
    if (!relayServerId) return subscriptionRelay ?? undefined;
    return (await this.tunnelRepo.findOne({ where: { id: relayServerId } })) ?? undefined;
  }

  private isRelayAvailableForNode(relay: Tunnel, node?: Node) {
    if (!relay.nodeId) return true;
    return Boolean(node?.id && relay.nodeId === node.id);
  }

  private getNodeAddress(node?: Node) {
    if (!node) return undefined;
    if (node.domain) return node.domain;
    if (node.ip) return node.ip;
    if (node.host) return node.host;

    try {
      return node.url ? new URL(node.url).hostname : undefined;
    } catch {
      return node.url;
    }
  }
}
