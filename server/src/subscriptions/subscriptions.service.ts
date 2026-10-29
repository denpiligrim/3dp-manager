import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from './entities/subscription.entity';
import { XuiService } from '../xui/xui.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { v4 as uuidv4 } from 'uuid';
import { Node } from '../nodes/entities/node.entity';
import { Tunnel } from '../tunnels/entities/tunnel.entity';
import { Inbound } from '../inbounds/entities/inbound.entity';
import { buildHappRoutingLink } from './happ-routing';
import { buildIncyRoutingLink } from './incy-routing';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private subRepo: Repository<Subscription>,
    @InjectRepository(Node)
    private nodeRepo: Repository<Node>,
    @InjectRepository(Tunnel)
    private tunnelRepo: Repository<Tunnel>,
    private xuiService: XuiService,
  ) {}

  findAll() {
    return this.subRepo.find({
      relations: ['inbounds', 'node', 'relayServer'],
      order: { createdAt: 'DESC' },
    });
  }

  async create(dto: CreateSubscriptionDto) {
    await this.validateInboundsConfig(dto.inboundsConfig);
    const sub = this.subRepo.create({
      name: dto.name,
      uuid: uuidv4(),
      clientId: dto.clientId?.trim() || `3dp-${uuidv4()}`,
      clientAutoCreate: !dto.clientId?.trim(),
      inboundsConfig: dto.inboundsConfig || [],
      isAutoRotationEnabled: dto.isAutoRotationEnabled ?? true,
      node: await this.resolveNode(dto.nodeId),
      relayServer: await this.resolveRelay(dto.relayServerId),
    });

    return this.subRepo.save(sub);
  }

  async update(id: string, dto: UpdateSubscriptionDto) {
    const sub = await this.subRepo.findOne({
      where: { id },
      relations: ['inbounds', 'node', 'relayServer'],
    });

    if (!sub) {
      return null;
    }

    // Пустое имя не обновляется — защита от случайной очистки
    if (dto.name && dto.name.trim().length > 0) {
      sub.name = dto.name;
    }

    if (dto.inboundsConfig) {
      await this.validateInboundsConfig(dto.inboundsConfig);
      sub.inboundsConfig = dto.inboundsConfig;
    }

    if (
      dto.clientId != null &&
      dto.clientId.trim() !== (sub.clientId || '')
    ) {
      sub.clientId = dto.clientId.trim() || `3dp-${uuidv4()}`;
      sub.clientAutoCreate = !dto.clientId.trim();
    }

    if (dto.isAutoRotationEnabled !== undefined) {
      sub.isAutoRotationEnabled = dto.isAutoRotationEnabled;
    }

    if ('nodeId' in dto) {
      sub.node = await this.resolveNode(dto.nodeId);
      sub.nodeId = dto.nodeId;
    }

    if ('relayServerId' in dto) {
      sub.relayServer = await this.resolveRelay(dto.relayServerId);
      sub.relayServerId = dto.relayServerId;
    }

    return this.subRepo.save(sub);
  }

  async remove(id: string, force = false) {
    const sub = await this.subRepo.findOne({
      where: { id },
      relations: ['inbounds', 'inbounds.node'],
    });
    if (!sub) return;

    if (sub.inbounds && sub.inbounds.length > 0) {
      for (const inbound of sub.inbounds) {
        if (!inbound.xuiId || inbound.xuiId <= 0) continue;

        try {
          const isDeleted = await this.xuiService.deleteInbound(
            inbound.xuiId,
            await this.resolveInboundNode(inbound),
          );
          if (!isDeleted) throw new Error('Inbound deletion failed');
        } catch {
          if (!force) {
            throw new BadRequestException({
              code: 'INBOUND_DELETE_FAILED',
              message: `Не удалось удалить инбаунд ${inbound.xuiId} из 3x-ui. Можно удалить подписку принудительно.`,
            });
          }
        }
      }
    }

    return this.subRepo.remove(sub);
  }

  private async resolveNode(nodeId?: string | null) {
    if (!nodeId) return null;
    const node = await this.nodeRepo
      .createQueryBuilder('node')
      .addSelect('node.password')
      .addSelect('node.token')
      .where('node.id = :nodeId', { nodeId })
      .getOne();

    if (!node) {
      throw new BadRequestException('Node not found');
    }

    return node;
  }

  private async resolveInboundNode(inbound: Inbound) {
    if (!inbound.nodeId) return undefined;

    return (
      (await this.nodeRepo
        .createQueryBuilder('node')
        .addSelect('node.password')
        .addSelect('node.token')
        .where('node.id = :nodeId', { nodeId: inbound.nodeId })
        .getOne()) ?? inbound.node
    );
  }

  private async resolveRelay(relayServerId?: number | null) {
    if (!relayServerId) return null;
    const relay = await this.tunnelRepo.findOne({
      where: { id: relayServerId },
    });

    if (!relay) {
      throw new BadRequestException('Relay server not found');
    }

    return relay;
  }

  private async validateInboundsConfig(
    inboundsConfig?: CreateSubscriptionDto['inboundsConfig'],
  ) {
    for (const config of inboundsConfig || []) {
      if (config.type === 'incy-routing') {
        buildIncyRoutingLink(config.routingProfile);
        continue;
      }
      if (config.type === 'happ-routing') {
        buildHappRoutingLink(config.routingProfile);
        continue;
      }
      if (config.type === 'custom') continue;

      if (config.nodeId) {
        const node = await this.nodeRepo.findOne({
          where: { id: config.nodeId },
        });
        if (!node) {
          throw new BadRequestException('Node not found');
        }
      }

      if (config.relayServerId) {
        const relay = await this.tunnelRepo.findOne({
          where: { id: config.relayServerId },
        });
        if (!relay) {
          throw new BadRequestException('Relay server not found');
        }

        if (config.nodeId && relay.nodeId && relay.nodeId !== config.nodeId) {
          throw new BadRequestException('Relay server belongs to another node');
        }
      }

      if (
        config.port === undefined ||
        config.port === null ||
        config.port === '' ||
        config.port === 'random'
      ) {
        continue;
      }

      const port =
        typeof config.port === 'number'
          ? config.port
          : /^\d+$/.test(config.port)
            ? Number(config.port)
            : NaN;

      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new BadRequestException(
          'Port must be "random" or an integer from 1 to 65535',
        );
      }
    }
  }
}
