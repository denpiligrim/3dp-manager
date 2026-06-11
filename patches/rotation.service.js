"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var RotationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RotationService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const subscription_entity_1 = require("../subscriptions/entities/subscription.entity");
const inbound_entity_1 = require("../inbounds/entities/inbound.entity");
const domain_entity_1 = require("../domains/entities/domain.entity");
const setting_entity_1 = require("../settings/entities/setting.entity");
const node_entity_1 = require("../nodes/entities/node.entity");
const tunnel_entity_1 = require("../tunnels/entities/tunnel.entity");
const xui_service_1 = require("../xui/xui.service");
const inbound_builder_service_1 = require("../inbounds/inbound-builder.service");
const uuid_1 = require("uuid");
let RotationService = RotationService_1 = class RotationService {
    subRepo;
    inboundRepo;
    domainRepo;
    settingRepo;
    nodeRepo;
    tunnelRepo;
    xuiService;
    inboundBuilder;
    logger = new common_1.Logger(RotationService_1.name);
    constructor(subRepo, inboundRepo, domainRepo, settingRepo, nodeRepo, tunnelRepo, xuiService, inboundBuilder) {
        this.subRepo = subRepo;
        this.inboundRepo = inboundRepo;
        this.domainRepo = domainRepo;
        this.settingRepo = settingRepo;
        this.nodeRepo = nodeRepo;
        this.tunnelRepo = tunnelRepo;
        this.xuiService = xuiService;
        this.inboundBuilder = inboundBuilder;
    }
    async onModuleInit() {
        await this.initDefaultSettings();
    }
    async initDefaultSettings() {
        const statusKey = 'rotation_status';
        const intervalKey = 'rotation_interval';
        const lastRunKey = 'last_rotation_timestamp';
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
        }
        else {
            this.logger.debug(`Текущий статус ротации: ${existingStatus.value}`);
        }
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
        }
        else {
            this.logger.debug(`Последняя ротация: ${existingLastRun.value}`);
        }
    }
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
        this.logger.debug(`Планировщик: интервал=${intervalMinutes}мин, прошло=${diffMinutes.toFixed(1)}мин, статус=${isStopped ? 'stopped' : 'active'}`);
        if (diffMinutes < intervalMinutes || isStopped) {
            return;
        }
        this.logger.debug(`Запуск ротации (прошло ${diffMinutes.toFixed(1)}мин при интервале ${intervalMinutes}мин)`);
        await this.performRotation();
        await this.saveSetting('last_rotation_timestamp', now.toString());
    }
    async saveSetting(key, value) {
        let s = await this.settingRepo.findOne({ where: { key } });
        if (!s)
            s = this.settingRepo.create({ key });
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
    async rotateSubscription(sub, domains, defaultNode) {
        this.logger.debug(`Ротация для подписки: ${sub.name} (${sub.uuid})`);

        const baseNode = sub.node ?? defaultNode ?? undefined;
        const keys = await this.xuiService.getNewX25519Cert(baseNode);
        if (!keys) {
            this.logger.error('Не удалось получить Reality ключи, пропускаем подписку');
            return false;
        }
        const usedPorts = new Set();
        const host = await this.settingRepo.findOne({ where: { key: 'xui_host' } });
        const serverAddress = this.getNodeAddress(baseNode) || host?.value || 'localhost';
        const flag = await this.settingRepo.findOne({
            where: { key: 'xui_geo_flag' },
        });
        const defaultFlagEmoji = flag?.value ?? '%F0%9F%92%AF';
        const inboundsConfig = sub.inboundsConfig || [];
        for (const config of inboundsConfig) {
            const type = config.type;
            const uuid = (0, uuid_1.v4)();
            const targetNode = await this.resolveNode(config.nodeId, sub.node, defaultNode);
            const resolvedRelay = await this.resolveRelay(config.relayServerId, sub.relayServer);
            const relayServer = resolvedRelay && this.isRelayAvailableForNode(resolvedRelay, targetNode)
                ? resolvedRelay
                : undefined;
            const targetAddress = relayServer?.domain ||
                relayServer?.ip ||
                this.getNodeAddress(targetNode) ||
                serverAddress;
            const flagEmoji = config.flag || targetNode?.flag || defaultFlagEmoji;
            let sni = '';
            if (type === 'custom') {
                const newInbound = this.inboundRepo.create({
                    xuiId: 0,
                    port: 0,
                    protocol: 'custom',
                    remark: 'custom-link',
                    link: config.link || '',
                    subscription: sub,
                });
                await this.inboundRepo.save(newInbound);
                continue;
            }
            else {
                sni = config.sni === 'random' ? this.pickDomain(domains) : config.sni;
            }
            if (type === 'hysteria2-udp') {
                let port = 0;
                if (config.port === 'random' || !config.port) {
                    port = await this.getFreePort(0, usedPorts);
                }
                else {
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
                const xuiId = await this.xuiService.addInbound(hysteriaConfig, targetNode);
                if (!xuiId) {
                    this.logger.warn('Hysteria2 inbound was not created by 3x-ui; skipping subscription link for this inbound');
                    continue;
                }
                const link = this.inboundBuilder.buildInboundLink(hysteriaConfig, targetAddress, uuid, flagEmoji);
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
            let port = 0;
            if (config.port === 'random' || !config.port) {
                port = await this.getFreePort(0, usedPorts);
            }
            else {
                port =
                    typeof config.port === 'string'
                        ? parseInt(config.port, 10)
                        : config.port;
            }
            usedPorts.add(port);
            let xuiConfig = null;
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
                const settings = JSON.parse(xuiConfig.settings);
                const idOrPass = settings.clients?.[0]?.id || settings.clients?.[0]?.password || '';
                const fullLink = this.inboundBuilder.buildInboundLink(xuiConfig, targetAddress, idOrPass, flagEmoji);
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
        }        // ============ УДАЛЕНИЕ СТАРЫХ ИНБАУНДОВ ПОСЛЕ СОЗДАНИЯ НОВЫХ ============
        if (sub.inbounds && sub.inbounds.length > 0) {
            for (const inbound of sub.inbounds) {
                try {
                    if (inbound.xuiId && inbound.xuiId > 0) {
                        const nodeToDelete = await this.resolveInboundNode(inbound);
                        const isDeleted = await this.xuiService.deleteInbound(inbound.xuiId, nodeToDelete);
                        if (!isDeleted) {
                            this.logger.warn("Не удалось удалить старый инбаунд " + inbound.xuiId + " с панели (продолжаем)");
                        }
                    }
                    await this.inboundRepo.delete(inbound.id);
                    this.logger.debug("Старый инбаунд " + (inbound.xuiId || inbound.id) + " удалён из БД");
                } catch (e) {
                    this.logger.warn("Ошибка при удалении старого инбаунда " + (inbound.xuiId || inbound.id) + ": " + e.message);
                }
            }
        } else {
            this.logger.debug("Нет старых инбаундов в БД для подписки " + sub.name + " (пропускаем удаление)");
        }

        // ===== CLEANUP ORPHANED INBOUNDS & CLIENTS VIA API =====
        try {
            const nodeForCleanup = sub.node ?? defaultNode ?? undefined;
            const api = await this.xuiService.createAuthenticatedApi(nodeForCleanup);
            if (api) {
                const listResp = await api.get("/panel/api/inbounds/list");
                const allInbounds = listResp.data?.obj || [];
                this.logger.debug("API cleanup: " + allInbounds.length + " inbounds on 3x-ui");
                const allKnownIds = await this.inboundRepo
                    .createQueryBuilder("inbound")
                    .select("inbound.xuiId")
                    .where("inbound.xuiId > 0")
                    .getRawMany();
                const knownSet = new Set(allKnownIds.map(r => Number(r.inbound_xuiId)));
                let deletedCount = 0;
                for (const remote of allInbounds) {
                    if (!knownSet.has(remote.id)) {
                        const wasDeleted = await this.xuiService.deleteInbound(remote.id, nodeForCleanup);
                        if (wasDeleted) deletedCount++;
                    }
                }
                if (deletedCount > 0) {
                    this.logger.log("Cleaned up " + deletedCount + " orphaned inbound(s) via API (clients auto-removed)");
                }
            }
        } catch (e) {
            this.logger.warn("API cleanup failed: " + e.message);
        }
        return true;
    }
    pickDomain(list) {
        return list[Math.floor(Math.random() * list.length)].name;
    }
    async getFreePort(preferred, currentBatch) {
        if (preferred > 0 && !currentBatch.has(preferred)) {
            const exists = await this.inboundRepo.findOne({
                where: { port: preferred },
            });
            if (!exists)
                return preferred;
        }
        while (true) {
            const p = Math.floor(Math.random() * (60000 - 10000)) + 10000;
            if (currentBatch.has(p))
                continue;
            const exists = await this.inboundRepo.findOne({ where: { port: p } });
            if (!exists)
                return p;
        }
    }
    async rotateSingleSubscription(subscriptionId) {
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
    async getDefaultNode() {
        return this.nodeRepo
            .createQueryBuilder('node')
            .addSelect('node.password')
            .addSelect('node.token')
            .where('node.isMain = :isMain', { isMain: true })
            .getOne();
    }
    async resolveNode(nodeId, subscriptionNode, defaultNode) {
        if (!nodeId)
            return subscriptionNode ?? defaultNode ?? undefined;
        return ((await this.nodeRepo
            .createQueryBuilder('node')
            .addSelect('node.password')
            .addSelect('node.token')
            .where('node.id = :nodeId', { nodeId })
            .getOne()) ??
            subscriptionNode ??
            defaultNode ??
            undefined);
    }
    async resolveInboundNode(inbound) {
        if (!inbound.nodeId)
            return inbound.node;
        return ((await this.nodeRepo
            .createQueryBuilder('node')
            .addSelect('node.password')
            .addSelect('node.token')
            .where('node.id = :nodeId', { nodeId: inbound.nodeId })
            .getOne()) ?? inbound.node);
    }
    async resolveRelay(relayServerId, subscriptionRelay) {
        if (!relayServerId)
            return subscriptionRelay ?? undefined;
        return (await this.tunnelRepo.findOne({ where: { id: relayServerId } })) ?? undefined;
    }
    isRelayAvailableForNode(relay, node) {
        if (!relay.nodeId)
            return true;
        return Boolean(node?.id && relay.nodeId === node.id);
    }
    getNodeAddress(node) {
        if (!node)
            return undefined;
        if (node.domain)
            return node.domain;
        if (node.ip)
            return node.ip;
        if (node.host)
            return node.host;
        try {
            return node.url ? new URL(node.url).hostname : undefined;
        }
        catch {
            return node.url;
        }
    }
};
exports.RotationService = RotationService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_MINUTE),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], RotationService.prototype, "handleTicker", null);
exports.RotationService = RotationService = RotationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(subscription_entity_1.Subscription)),
    __param(1, (0, typeorm_1.InjectRepository)(inbound_entity_1.Inbound)),
    __param(2, (0, typeorm_1.InjectRepository)(domain_entity_1.Domain)),
    __param(3, (0, typeorm_1.InjectRepository)(setting_entity_1.Setting)),
    __param(4, (0, typeorm_1.InjectRepository)(node_entity_1.Node)),
    __param(5, (0, typeorm_1.InjectRepository)(tunnel_entity_1.Tunnel)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        xui_service_1.XuiService,
        inbound_builder_service_1.InboundBuilderService])
], RotationService);
//# sourceMappingURL=rotation.service.js.map