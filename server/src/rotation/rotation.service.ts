import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Repository } from 'typeorm';
import { OperationsService } from '../operations/operations.service';

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
import { XuiInboundClient } from '../xui/xui.types';

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
    private readonly operations: OperationsService,
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
    await this.operations.enqueue(
      'rotation.all',
      'Плановая генерация подписок',
      [null],
    );

    await this.saveSetting('last_rotation_timestamp', now.toString());
  }

  private async saveSetting(key: string, value: string) {
    let s = await this.settingRepo.findOne({ where: { key } });
    if (!s) s = this.settingRepo.create({ key });
    s.value = value;
    await this.settingRepo.save(s);
  }

  async performRotation(force = false) {
    const defaultNode = await this.getDefaultNode();
    if (!defaultNode && !(await this.xuiService.login()))
      return { success: false, message: 'Не удалось войти в панель 3x-ui' };
    const domains = await this.domainRepo.find({ where: { isEnabled: true } });
    const checkpoint = this.operations.resumeCheckpoint();
    let cursor = checkpoint?.cursor || '';
    let completed = checkpoint?.completed || 0;
    let failed = checkpoint?.failed || 0;
    for (;;) {
      // Only ten identifiers are retained; relations are loaded for one subscription at a time.
      const page = await this.subRepo.find({
        where: {
          isEnabled: true,
          isAutoRotationEnabled: true,
          ...(cursor ? { id: MoreThan(cursor) } : {}),
        },
        select: { id: true },
        order: { id: 'ASC' },
        take: 10,
      });
      if (!page.length) break;
      for (const item of page) {
        const sub = await this.subRepo.findOne({
          where: { id: item.id, isEnabled: true, isAutoRotationEnabled: true },
          relations: ['inbounds', 'inbounds.node', 'node', 'relayServer'],
        });
        if (!sub) continue;
        await this.operations.progress(
          completed,
          0,
          `Генерация подписки: ${sub.name}`,
        );
        try {
          const ok = await this.rotateSubscription(
            sub,
            domains,
            defaultNode,
            force,
          );
          if (!ok) failed++;
          await this.operations.record(
            'rotation.subscription',
            'Генерация подписки',
            ok ? 'success' : 'failed',
            ok
              ? 'Инбаунды обновлены'
              : 'Не удалось полностью обновить инбаунды. Старые рабочие подключения сохранены.',
            sub.name,
          );
        } catch {
          failed++;
          await this.operations.record(
            'rotation.subscription',
            'Генерация подписки',
            'failed',
            'Ошибка обработки подписки. Остальные подписки продолжают обрабатываться.',
            sub.name,
          );
        }
        completed++;
        await this.operations.progress(
          completed,
          0,
          `Обработано подписок: ${completed}. Ошибок: ${failed}.`,
        );
        await this.pause();
        if (this.operations.inBackground && page.length > 1) {
          await this.operations.checkpoint(item.id, completed, failed);
          // Release the database lock between subscriptions. Other queued actions
          // and configuration changes can proceed before this batch resumes.
          this.operations.yieldToQueue();
        }
      }
      const last = page[page.length - 1].id;
      if (page.length < 10 || last <= cursor) break;
      cursor = last;
    }
    await this.operations.progress(
      completed,
      completed,
      `Обработано: ${completed}. Ошибок: ${failed}.`,
    );
    return {
      success: completed > 0 && failed === 0,
      message:
        completed === 0
          ? 'Нет активных подписок для ротации'
          : `Обработано подписок: ${completed}. Ошибок: ${failed}.`,
    };
  }

  private pause() {
    const ms = Math.max(
      100,
      Math.min(
        10000,
        Number(process.env.ROTATION_SUBSCRIPTION_PAUSE_MS) || 500,
      ),
    );
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  private async rotateSubscription(
    sub: Subscription,
    domains: Domain[],
    defaultNode: Node | null,
    force = false,
  ) {
    this.logger.debug(
      `Ротация для подписки: ${sub.name} (${sub.uuid})${force ? ' [force]' : ''}`,
    );

    const inboundsConfig = sub.inboundsConfig || [];
    if (!inboundsConfig.length) return false;
    // Finish failed cleanup before allocating more remote resources.
    for (const inbound of sub.inbounds || []) {
      if (!inbound.isPending) continue;
      if (
        !force &&
        inbound.xuiId > 0 &&
        !(await this.xuiService.deleteInbound(
          inbound.xuiId,
          await this.resolveInboundNode(inbound),
        ))
      )
        return false;
      await this.inboundRepo.delete(inbound.id);
    }
    sub.inbounds = (sub.inbounds || []).filter((inbound) => !inbound.isPending);
    if (
      !domains.length &&
      inboundsConfig.some(
        (config) =>
          config.sni === 'random' &&
          ![
            'custom',
            'happ-routing',
            'incy-routing',
            'hysteria2-udp',
            'vless-xhttp-get',
          ].includes(config.type || ''),
      )
    )
      return false;
    const nodeCache = new Map<string, Promise<Node | undefined>>();
    const resolveTarget = (
      nodeId?: string,
      subscriptionNode?: Node,
      fallback?: Node | null,
    ) => {
      const key = nodeId || subscriptionNode?.id || fallback?.id || 'default';
      if (!nodeCache.has(key))
        nodeCache.set(
          key,
          this.resolveNode(nodeId, subscriptionNode, fallback),
        );
      return nodeCache.get(key)!;
    };
    const created: Inbound[] = [];
    const saveCreated = async (inbound: Inbound) => {
      inbound.isPending = true;
      created.push(inbound);
      const stored = await this.inboundRepo.save(inbound);
      if (stored) Object.assign(inbound, stored);
    };
    const rollback = async () => {
      for (const inbound of created) {
        try {
          if (
            inbound.xuiId > 0 &&
            !(await this.xuiService.deleteInbound(
              inbound.xuiId,
              await this.resolveInboundNode(inbound),
            ))
          )
            continue;
          if (inbound.id) await this.inboundRepo.delete(inbound.id);
        } catch {
          /* Pending records remain available for cleanup during the next rotation. */
        }
      }
    };
    const baseNode = sub.node ?? defaultNode ?? undefined;
    const clients = new Map<string, XuiInboundClient>();
    if (sub.clientId) {
      try {
        for (const config of inboundsConfig) {
          if (['custom', 'happ-routing', 'incy-routing'].includes(config.type))
            continue;
          const node = await resolveTarget(
            config.nodeId,
            sub.node,
            defaultNode,
          );
          const key = node?.id || 'default';
          if (!clients.has(key)) {
            clients.set(
              key,
              await this.xuiService.prepareSubscriptionClient(
                sub.clientId,
                sub.clientAutoCreate === true,
                node,
              ),
            );
          }
        }
      } catch (error) {
        this.logger.error(
          error instanceof Error
            ? error.message
            : 'Ошибка подготовки клиента 3x-ui',
        );
        return false;
      }
    }
    const needsReality = inboundsConfig.some((config) =>
      config.type?.endsWith('-reality'),
    );
    const keys = needsReality
      ? await this.xuiService.getNewX25519Cert(baseNode)
      : { privateKey: '', publicKey: '' };
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

    // Панель может отклонить часть типов (несовместимая схема, занятый порт),
    // а ротация при этом отчитается об успехе — копим отказы и логируем итог.
    const rejectedTypes: string[] = [];

    try {
      let inboundIndex = 0;
      for (const config of inboundsConfig) {
        await this.operations.note(
          `Подписка: ${sub.name}. Инбаунд ${++inboundIndex}/${inboundsConfig.length}.`,
        );
        const type = config.type;
        // Routing metadata is emitted directly from the subscription configuration.
        if (type === 'happ-routing' || type === 'incy-routing') continue;
        const uuid = uuidv4();
        const targetNode = await resolveTarget(
          config.nodeId,
          sub.node,
          defaultNode,
        );
        const client = clients.get(targetNode?.id || 'default');
        const resolvedRelay = await this.resolveRelay(
          config.relayServerId,
          sub.relayServer,
        );
        const relayServer =
          resolvedRelay &&
          this.isRelayAvailableForNode(resolvedRelay, targetNode)
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
          await saveCreated(newInbound);
          continue;
        } else if (type !== 'vless-xhttp-get') {
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
          const xuiId = client
            ? await this.xuiService.addInboundForClient(
                hysteriaConfig,
                client,
                targetNode,
              )
            : await this.xuiService.addInbound(hysteriaConfig, targetNode);
          if (!xuiId) {
            rejectedTypes.push(type);
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
            port: hysteriaConfig.port,
            protocol: 'hysteria2',
            remark: hysteriaConfig.remark,
            link: link,
            subscription: sub,
            node: targetNode,
            relayServer,
          });
          await saveCreated(newInbound);
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
              fingerprint: config.fingerprint ?? 'edge',
            });
            break;
          case 'vless-xhttp-reality':
            xuiConfig = this.inboundBuilder.buildVlessRealityXhttp({
              port,
              uuid,
              sni,
              ...keys,
              fingerprint: config.fingerprint ?? 'edge',
            });
            break;
          case 'vless-xhttp-get':
            xuiConfig = this.inboundBuilder.buildVlessXhttpGet({ port, uuid });
            break;
          case 'vless-grpc-reality':
            xuiConfig = this.inboundBuilder.buildVlessRealityGrpc({
              port,
              uuid,
              sni,
              ...keys,
              fingerprint: config.fingerprint ?? 'edge',
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
              fingerprint: config.fingerprint ?? 'edge',
            });
            break;
          default:
            this.logger.warn(`Неизвестный тип инбаунда: ${type}`);
            rejectedTypes.push(type || 'unknown');
            continue;
        }

        if (config.name?.trim()) {
          xuiConfig.remark = config.name.trim();
        }

        const xuiId = client
          ? await this.xuiService.addInboundForClient(
              xuiConfig,
              client,
              targetNode,
            )
          : await this.xuiService.addInbound(xuiConfig, targetNode);

        if (xuiId && xuiConfig) {
          const settings = JSON.parse(xuiConfig.settings) as {
            clients?: Array<{ id?: string; password?: string }>;
          };
          const idOrPass =
            xuiConfig.protocol === 'trojan'
              ? settings.clients?.[0]?.password || ''
              : settings.clients?.[0]?.id ||
                settings.clients?.[0]?.password ||
                '';

          const fullLink = this.inboundBuilder.buildInboundLink(
            xuiConfig,
            targetAddress,
            idOrPass,
            flagEmoji,
          );

          const newInbound = this.inboundRepo.create({
            xuiId: xuiId,
            port: xuiConfig.port,
            protocol: xuiConfig.protocol,
            remark: xuiConfig.remark,
            link: fullLink,
            subscription: sub,
            node: targetNode,
            relayServer,
          });
          await saveCreated(newInbound);
        } else {
          rejectedTypes.push(type);
        }
      }
    } catch {
      await rollback();
      return false;
    }

    if (rejectedTypes.length > 0) {
      this.logger.error(
        `Подписка "${sub.name}": 3x-ui отклонил ${rejectedTypes.length} из ${inboundsConfig.length} инбаундов (${rejectedTypes.join(', ')}). ` +
          'Точная причина — в строках "3x-ui отклонил создание" выше.',
      );
      // Keep old working links if any replacement was rejected.
      await rollback();
      return false;
    }

    try {
      const ids = created.map((inbound) => inbound.id).filter(Boolean);
      if (ids.length)
        await this.inboundRepo.update({ id: In(ids) }, { isPending: false });
      const oldIds = (sub.inbounds || [])
        .map((inbound) => inbound.id)
        .filter(Boolean);
      if (oldIds.length && !force)
        await this.inboundRepo.update({ id: In(oldIds) }, { isPending: true });
    } catch {
      await rollback();
      return false;
    }

    // Create replacements first. Only clean up records managed by this subscription;
    // panel inbounds missing from our database may belong to another application.
    let cleanupSucceeded = true;
    for (const inbound of sub.inbounds || []) {
      try {
        if (!force && inbound.xuiId > 0) {
          const deleted = await this.xuiService.deleteInbound(
            inbound.xuiId,
            await this.resolveInboundNode(inbound),
          );
          if (!deleted) {
            cleanupSucceeded = false;
            this.logger.warn(
              `Не удалось удалить старый инбаунд ${inbound.xuiId}; запись сохранена для повторной очистки`,
            );
            continue;
          }
        }
        await this.inboundRepo.delete(inbound.id);
      } catch (error) {
        cleanupSucceeded = false;
        this.logger.warn(
          `Ошибка очистки инбаунда ${inbound.id}: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
      }
    }
    return cleanupSucceeded;
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

    for (let attempt = 0; attempt < 100; attempt++) {
      const p = Math.floor(Math.random() * (60000 - 10000)) + 10000;
      if (currentBatch.has(p)) continue;

      const exists = await this.inboundRepo.findOne({ where: { port: p } });
      if (!exists) return p;
    }
    throw new Error('No free port found after 100 attempts');
  }

  /**
   * Ручная ротация одной подписки (независимо от флага isAutoRotationEnabled)
   * @param force - если true, не пытается удалять старые инбаунды с 3x-ui
   */
  async rotateSingleSubscription(subscriptionId: string, force = false) {
    this.logger.debug(
      `Запуск ручной ротации подписки: ${subscriptionId}${force ? ' [force]' : ''}`,
    );

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
    if (
      domains.length === 0 &&
      (!sub.inboundsConfig?.length ||
        sub.inboundsConfig.some(
          (config) =>
            config.sni === 'random' &&
            ![
              'hysteria2-udp',
              'vless-xhttp-get',
              'custom',
              'happ-routing',
              'incy-routing',
            ].includes(config.type || ''),
        ))
    ) {
      this.logger.warn('Список доменов пуст! Ротация невозможна.');
      return { success: false, message: 'Список доменов пуст!' };
    }

    if (!(await this.rotateSubscription(sub, domains, defaultNode, force))) {
      return {
        success: false,
        message:
          'Ротация не завершена: проверьте создание и удаление инбаундов в журнале',
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

  private async resolveRelay(
    relayServerId?: number,
    subscriptionRelay?: Tunnel,
  ) {
    if (!relayServerId) return subscriptionRelay ?? undefined;
    return (
      (await this.tunnelRepo.findOne({ where: { id: relayServerId } })) ??
      undefined
    );
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
