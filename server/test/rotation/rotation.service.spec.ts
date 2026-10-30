import { OperationsService } from 'src/operations/operations.service';
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RotationService } from 'src/rotation/rotation.service';
import { Subscription } from 'src/subscriptions/entities/subscription.entity';
import { Inbound } from 'src/inbounds/entities/inbound.entity';
import { Domain } from 'src/domains/entities/domain.entity';
import { Setting } from 'src/settings/entities/setting.entity';
import { XuiService } from 'src/xui/xui.service';
import { InboundBuilderService } from 'src/inbounds/inbound-builder.service';
import { Node } from 'src/nodes/entities/node.entity';
import { Tunnel } from 'src/tunnels/entities/tunnel.entity';

// Mock @nestjs/schedule для тестирования Cron
jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => {},
  CronExpression: { EVERY_MINUTE: '* * * * *' },
}));

describe('RotationService', () => {
  let service: RotationService;
  let _subRepo: Repository<Subscription>;
  let inboundRepo: Repository<Inbound>;
  let _domainRepo: Repository<Domain>;
  let settingRepo: Repository<Setting>;
  let xuiService: XuiService;
  let inboundBuilder: InboundBuilderService;

  const mockOperations = {
    enqueue: jest.fn(),
    progress: jest.fn(),
    note: jest.fn(),
    record: jest.fn(),
    resumeCheckpoint: jest.fn(),
    checkpoint: jest.fn(),
  };

  const mockSubRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    })),
  };

  const mockInboundRepo = {
    update: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockDomainRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockSettingRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockNodeRepo = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    })),
  };

  const mockTunnelRepo = {
    findOne: jest.fn(),
  };

  const mockXuiService = {
    prepareSubscriptionClient: jest.fn(),
    addInboundForClient: jest.fn(),
    login: jest.fn(),
    deleteInbound: jest.fn(),
    addInbound: jest.fn(),
    getNewX25519Cert: jest.fn(),
  };

  const mockInboundBuilder = {
    buildVlessRealityTcp: jest.fn(),
    buildVlessRealityXhttp: jest.fn(),
    buildVlessRealityGrpc: jest.fn(),
    buildVlessWs: jest.fn(),
    buildVmessTcp: jest.fn(),
    buildShadowsocksTcp: jest.fn(),
    buildTrojanRealityTcp: jest.fn(),
    buildHysteria2Inbound: jest.fn(),
    buildHysteria2Link: jest.fn(),
    buildInboundLink: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RotationService,
        { provide: OperationsService, useValue: mockOperations },
        {
          provide: getRepositoryToken(Subscription),
          useValue: mockSubRepo,
        },
        {
          provide: getRepositoryToken(Inbound),
          useValue: mockInboundRepo,
        },
        {
          provide: getRepositoryToken(Domain),
          useValue: mockDomainRepo,
        },
        {
          provide: getRepositoryToken(Setting),
          useValue: mockSettingRepo,
        },
        {
          provide: getRepositoryToken(Node),
          useValue: mockNodeRepo,
        },
        {
          provide: getRepositoryToken(Tunnel),
          useValue: mockTunnelRepo,
        },
        {
          provide: XuiService,
          useValue: mockXuiService,
        },
        {
          provide: InboundBuilderService,
          useValue: mockInboundBuilder,
        },
      ],
    }).compile();

    service = module.get<RotationService>(RotationService);
    jest.spyOn(service as any, 'pause').mockResolvedValue(undefined);
    mockInboundRepo.create.mockImplementation((value) => ({ ...value }));
    mockSubRepo.findOne.mockImplementation(async (options) => {
      const list = await mockSubRepo.find({});
      return (
        list?.find((item: { id: string }) => item.id === options.where.id) ||
        null
      );
    });
    _subRepo = module.get<Repository<Subscription>>(
      getRepositoryToken(Subscription),
    );
    inboundRepo = module.get<Repository<Inbound>>(getRepositoryToken(Inbound));
    _domainRepo = module.get<Repository<Domain>>(getRepositoryToken(Domain));
    settingRepo = module.get<Repository<Setting>>(getRepositoryToken(Setting));
    xuiService = module.get<XuiService>(XuiService);
    inboundBuilder = module.get<InboundBuilderService>(InboundBuilderService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockXuiService.deleteInbound.mockResolvedValue(true);
  });

  describe('onModuleInit', () => {
    it('должен инициализировать настройки по умолчанию', async () => {
      mockSettingRepo.findOne.mockResolvedValue(null);
      mockSettingRepo.create.mockReturnValue({ key: 'test', value: 'test' });
      mockSettingRepo.save.mockResolvedValue({});

      await service.onModuleInit();

      expect(settingRepo.findOne).toHaveBeenCalled();
      expect(settingRepo.save).toHaveBeenCalled();
    });

    it('НЕ должен создавать настройки, если они уже есть', async () => {
      mockSettingRepo.findOne.mockResolvedValue({
        key: 'rotation_status',
        value: 'active',
      });

      await service.onModuleInit();

      expect(settingRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('handleTicker', () => {
    it('НЕ должен запускать ротацию, если прошло мало времени', async () => {
      mockSettingRepo.findOne
        .mockResolvedValueOnce({ key: 'rotation_interval', value: '30' })
        .mockResolvedValueOnce({
          key: 'last_rotation_timestamp',
          value: Date.now().toString(),
        })
        .mockResolvedValueOnce({ key: 'rotation_status', value: 'active' });

      await (service as any).handleTicker();

      expect(xuiService.login).not.toHaveBeenCalled();
    });

    it('НЕ должен запускать ротацию, если статус stopped', async () => {
      mockSettingRepo.findOne
        .mockResolvedValueOnce({ key: 'rotation_interval', value: '30' })
        .mockResolvedValueOnce({ key: 'last_rotation_timestamp', value: '0' })
        .mockResolvedValueOnce({ key: 'rotation_status', value: 'stopped' });

      await (service as any).handleTicker();

      expect(xuiService.login).not.toHaveBeenCalled();
    });

    it('должен запустить ротацию, если пришло время', async () => {
      mockSettingRepo.findOne
        .mockResolvedValueOnce({ key: 'rotation_interval', value: '1' })
        .mockResolvedValueOnce({ key: 'last_rotation_timestamp', value: '0' })
        .mockResolvedValueOnce({ key: 'rotation_status', value: 'active' });

      mockSubRepo.find.mockResolvedValue([
        {
          id: '1',
          uuid: 'uuid-1',
          isEnabled: true,
          isAutoRotationEnabled: true,
          inbounds: [],
          inboundsConfig: [],
        },
      ]);
      mockDomainRepo.find.mockResolvedValue([]); // Пустой список доменов

      await (service as any).handleTicker();

      // Ротация запустится, но завершится с ошибкой (пустые домены)
      expect(xuiService.login).not.toHaveBeenCalled();
      expect(mockOperations.enqueue).toHaveBeenCalledWith(
        'rotation.all',
        expect.any(String),
        [null],
      );
    });
  });

  describe('performRotation', () => {
    it('pages through a large batch and continues after a failed subscription without loading all relations', async () => {
      const subscriptions = Array.from({ length: 25 }, (_, index) => ({
        id: String(index).padStart(2, '0'),
        name: `Subscription ${index}`,
      }));
      mockXuiService.login.mockResolvedValue(true);
      mockDomainRepo.find.mockResolvedValue([]);
      mockSubRepo.find.mockImplementation(async (options) =>
        subscriptions
          .filter((sub) => !options.where.id || sub.id > options.where.id.value)
          .slice(0, options.take)
          .map((sub) => ({ id: sub.id })),
      );
      mockSubRepo.findOne.mockImplementation(async (options) =>
        subscriptions.find((sub) => sub.id === options.where.id),
      );
      const rotate = jest
        .spyOn(service as any, 'rotateSubscription')
        .mockImplementation(async (sub: any) => sub.id !== '05');
      try {
        const result = await service.performRotation();
        expect(result.success).toBe(false);
        expect(rotate).toHaveBeenCalledTimes(25);
        expect(mockSubRepo.find).toHaveBeenCalledTimes(3);
        for (const [options] of mockSubRepo.find.mock.calls) {
          expect(options).toMatchObject({ select: { id: true }, take: 10 });
          expect(options.relations).toBeUndefined();
        }
        expect(mockOperations.progress).toHaveBeenLastCalledWith(
          25,
          25,
          expect.any(String),
        );
      } finally {
        rotate.mockRestore();
      }
    });

    it.each(['scheduled', 'manual'])(
      'allows XHTTP GET rotation without SNI domains (%s)',
      async (mode) => {
        const sub = {
          id: 'get-sub',
          uuid: 'get-uuid',
          isEnabled: true,
          isAutoRotationEnabled: true,
          inbounds: [],
          inboundsConfig: [{ type: 'vless-xhttp-get', port: 2053 }],
        };
        mockXuiService.login.mockResolvedValue(true);
        mockSubRepo.find.mockResolvedValue([sub]);
        mockSubRepo.findOne.mockResolvedValue(sub);
        mockDomainRepo.find.mockResolvedValue([]);
        const rotate = jest
          .spyOn(service as any, 'rotateSubscription')
          .mockResolvedValue(true);
        try {
          const result =
            mode === 'manual'
              ? await service.rotateSingleSubscription(sub.id)
              : await service.performRotation();
          expect(result.success).toBe(true);
          expect(rotate).toHaveBeenCalledWith(sub, [], undefined, false);
        } finally {
          rotate.mockRestore();
        }
      },
    );

    it('должен вернуть ошибку, если не удалось войти в 3x-ui', async () => {
      mockXuiService.login.mockResolvedValue(false);

      const result = await service.performRotation();

      expect(result).toEqual({
        success: false,
        message: 'Не удалось войти в панель 3x-ui',
      });
    });

    it('должен вернуть ошибку, если нет активных подписок', async () => {
      mockXuiService.login.mockResolvedValue(true);
      mockSubRepo.find.mockResolvedValue([]);

      const result = await service.performRotation();

      expect(result).toEqual({
        success: false,
        message: 'Нет активных подписок для ротации',
      });
    });

    it('должен вернуть ошибку, если список доменов пуст', async () => {
      mockXuiService.login.mockResolvedValue(true);
      mockSubRepo.find.mockResolvedValue([
        {
          id: '1',
          uuid: 'uuid-1',
          isEnabled: true,
          isAutoRotationEnabled: true,
          inbounds: [],
        },
      ]);
      mockDomainRepo.find.mockResolvedValue([]);

      const result = await service.performRotation();

      expect(result).toEqual({
        success: false,
        message: 'Обработано подписок: 1. Ошибок: 1.',
      });
    });

    it('должен выполнить ротацию подписок', async () => {
      mockXuiService.login.mockResolvedValue(true);
      mockSubRepo.find.mockResolvedValue([
        {
          id: '1',
          uuid: 'uuid-1',
          isEnabled: true,
          isAutoRotationEnabled: true,
          inbounds: [],
          inboundsConfig: [
            { type: 'vless-tcp-reality', port: 443, sni: 'ya.ru' },
          ],
        },
      ]);
      mockDomainRepo.find.mockResolvedValue([
        { id: 1, name: 'ya.ru', isEnabled: true },
      ]);
      mockXuiService.getNewX25519Cert.mockResolvedValue({
        privateKey: 'key',
        publicKey: 'pub',
      });
      mockInboundBuilder.buildVlessRealityTcp.mockReturnValue({
        protocol: 'vless',
        remark: 'test',
        settings: '{}',
        streamSettings: '{}',
        sniffing: '{}',
      });
      mockXuiService.addInbound.mockResolvedValue(101);
      mockInboundBuilder.buildInboundLink.mockReturnValue('vless://link');

      const result = await service.performRotation();

      expect(result).toEqual({
        success: true,
        message: 'Обработано подписок: 1. Ошибок: 0.',
      });
    });
  });

  describe('rotateSingleSubscription', () => {
    it('должен вернуть ошибку, если подписка не найдена', async () => {
      mockSubRepo.findOne.mockResolvedValue(null);

      const result = await service.rotateSingleSubscription('non-existent');

      expect(result).toEqual({
        success: false,
        message: 'Подписка не найдена',
      });
    });

    it('должен вернуть ошибку, если не удалось войти в 3x-ui', async () => {
      mockSubRepo.findOne.mockResolvedValue({
        id: '1',
        uuid: 'uuid-1',
        isEnabled: true,
        inbounds: [],
        inboundsConfig: [],
      });
      mockXuiService.login.mockResolvedValue(false);

      const result = await service.rotateSingleSubscription('1');

      expect(result).toEqual({
        success: false,
        message: 'Не удалось войти в панель 3x-ui',
      });
    });

    it('должен вернуть ошибку, если список доменов пуст', async () => {
      mockSubRepo.findOne.mockResolvedValue({
        id: '1',
        uuid: 'uuid-1',
        isEnabled: true,
        inbounds: [],
        inboundsConfig: [],
      });
      mockXuiService.login.mockResolvedValue(true);
      mockDomainRepo.find.mockResolvedValue([]);

      const result = await service.rotateSingleSubscription('1');

      expect(result).toEqual({
        success: false,
        message: 'Список доменов пуст!',
      });
    });

    it('должен выполнить ротацию одной подписки', async () => {
      const mockSub = {
        id: '1',
        uuid: 'uuid-1',
        isEnabled: true,
        inbounds: [],
        inboundsConfig: [
          { type: 'vless-tcp-reality', port: 443, sni: 'ya.ru' },
        ],
      };

      mockSubRepo.findOne.mockResolvedValue(mockSub);
      mockXuiService.login.mockResolvedValue(true);
      mockDomainRepo.find.mockResolvedValue([
        { id: 1, name: 'ya.ru', isEnabled: true },
      ]);
      mockXuiService.getNewX25519Cert.mockResolvedValue({
        privateKey: 'key',
        publicKey: 'pub',
      });
      mockInboundBuilder.buildVlessRealityTcp.mockReturnValue({
        protocol: 'vless',
        remark: 'test',
        settings: '{}',
        streamSettings: '{}',
        sniffing: '{}',
      });
      mockXuiService.addInbound.mockResolvedValue(101);
      mockInboundBuilder.buildInboundLink.mockReturnValue('vless://link');

      const result = await service.rotateSingleSubscription('1');

      expect(result).toEqual({
        success: true,
        message: 'Ротация успешно выполнена',
      });
    });

    it('должен пропустить подписку, если не удалось получить Reality ключи', async () => {
      const mockSub = {
        id: '1',
        uuid: 'uuid-1',
        isEnabled: true,
        inbounds: [],
        inboundsConfig: [
          { type: 'vless-tcp-reality', port: 443, sni: 'ya.ru' },
        ],
      };

      mockSubRepo.findOne.mockResolvedValue(mockSub);
      mockXuiService.login.mockResolvedValue(true);
      mockDomainRepo.find.mockResolvedValue([
        { id: 1, name: 'ya.ru', isEnabled: true },
      ]);
      mockXuiService.getNewX25519Cert.mockResolvedValue(null);

      // Метод не возвращает результат явно, просто логирует ошибку
      await service.rotateSingleSubscription('1');

      expect(xuiService.getNewX25519Cert).toHaveBeenCalled();
    });
  });

  describe('rotateSubscription (private)', () => {
    it.each([false, true])(
      'prepares a single client per node and reuses it for all inbounds (auto=%s)',
      async (auto) => {
        const a = { id: 'a', name: 'A' };
        const b = { id: 'b', name: 'B' };
        const clientA = { email: 'shared', id: 'uuid-a' };
        const clientB = { email: 'shared', id: 'uuid-b' };
        jest
          .spyOn(service as any, 'resolveNode')
          .mockImplementation(async (id) => (id === 'b' ? b : a));
        mockXuiService.prepareSubscriptionClient.mockImplementation(
          async (_id, _auto, node) => (node.id === 'b' ? clientB : clientA),
        );
        mockXuiService.addInboundForClient.mockResolvedValue(42);
        mockInboundBuilder.buildVlessWs.mockReturnValue({
          port: 12000,
          protocol: 'vless',
          settings: '{}',
          streamSettings: '{}',
        });
        const sub = {
          name: 'Test',
          clientId: 'shared',
          clientAutoCreate: auto,
          inbounds: [],
          inboundsConfig: [
            { type: 'vless-ws', nodeId: 'a', port: 12000 },
            { type: 'vless-ws', nodeId: 'a', port: 12001 },
            { type: 'vless-ws', nodeId: 'b', port: 12002 },
            { type: 'custom', link: 'custom' },
          ],
        };
        expect(await (service as any).rotateSubscription(sub, [], null)).toBe(
          true,
        );
        expect(mockXuiService.prepareSubscriptionClient).toHaveBeenCalledTimes(
          2,
        );
        expect(mockXuiService.prepareSubscriptionClient).toHaveBeenCalledWith(
          'shared',
          auto,
          a,
        );
        expect(mockXuiService.prepareSubscriptionClient).toHaveBeenCalledWith(
          'shared',
          auto,
          b,
        );
        expect(mockXuiService.addInboundForClient).toHaveBeenNthCalledWith(
          1,
          expect.anything(),
          clientA,
          a,
        );
        expect(mockXuiService.addInboundForClient).toHaveBeenNthCalledWith(
          2,
          expect.anything(),
          clientA,
          a,
        );
        expect(mockXuiService.addInboundForClient).toHaveBeenNthCalledWith(
          3,
          expect.anything(),
          clientB,
          b,
        );
        expect(mockXuiService.addInbound).not.toHaveBeenCalled();
      },
    );

    it('preserves existing inbounds if client preparation fails on a node', async () => {
      mockXuiService.prepareSubscriptionClient.mockRejectedValueOnce(
        new Error('Client missing'),
      );
      const sub = {
        clientId: 'missing',
        inbounds: [{ id: 'old', xuiId: 1 }],
        inboundsConfig: [{ type: 'vless-ws', port: 12000 }],
      };
      expect(await (service as any).rotateSubscription(sub, [], null)).toBe(
        false,
      );
      expect(mockXuiService.addInboundForClient).not.toHaveBeenCalled();
      expect(mockInboundRepo.delete).not.toHaveBeenCalled();
    });

    it.each([false, true])(
      'creates replacements before cleanup (force=%s)',
      async (force) => {
        const old = { id: 'old', xuiId: 101, nodeId: 'node-1' };
        const sub = {
          id: 'sub',
          name: 'Test',
          inbounds: [old],
          inboundsConfig: [
            { type: 'vless-tcp-reality', port: 443, sni: 'example.com' },
          ],
        };
        mockXuiService.getNewX25519Cert.mockResolvedValue({
          privateKey: 'key',
          publicKey: 'pub',
        });
        mockInboundBuilder.buildVlessRealityTcp.mockReturnValue({
          port: 443,
          protocol: 'vless',
          settings: '{}',
        });
        mockXuiService.addInbound.mockImplementation((config) => {
          config.port = 12345;
          return Promise.resolve(202);
        });
        const result = await (service as any).rotateSubscription(
          sub,
          [],
          null,
          force,
        );
        expect(result).toBe(true);
        expect(mockInboundRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({ port: 12345 }),
        );
        expect(mockInboundRepo.save.mock.invocationCallOrder[0]).toBeLessThan(
          mockInboundRepo.delete.mock.invocationCallOrder[0],
        );
        if (force) {
          expect(mockXuiService.deleteInbound).not.toHaveBeenCalled();
        } else {
          expect(mockXuiService.deleteInbound).toHaveBeenCalledTimes(1);
          expect(mockXuiService.deleteInbound).toHaveBeenCalledWith(
            101,
            undefined,
          );
        }
      },
    );

    it('keeps old links and reports failure when a replacement is rejected', async () => {
      mockXuiService.getNewX25519Cert.mockResolvedValue({
        privateKey: 'key',
        publicKey: 'pub',
      });
      mockInboundBuilder.buildVlessRealityTcp.mockReturnValue({
        port: 443,
        protocol: 'vless',
        settings: '{}',
      });
      mockXuiService.addInbound.mockResolvedValue(null);
      const result = await (service as any).rotateSubscription(
        {
          id: 'sub',
          inbounds: [{ id: 'old', xuiId: 101 }],
          inboundsConfig: [{ type: 'vless-tcp-reality', port: 443 }],
        },
        [],
        null,
      );
      expect(result).toBe(false);
      expect(mockXuiService.deleteInbound).not.toHaveBeenCalled();
      expect(mockInboundRepo.delete).not.toHaveBeenCalled();
    });

    it('retains a managed record for retry when remote cleanup fails', async () => {
      mockXuiService.deleteInbound.mockResolvedValue(false);
      const result = await (service as any).rotateSubscription(
        {
          id: 'sub',
          inbounds: [{ id: 'old', xuiId: 101 }],
          inboundsConfig: [],
        },
        [],
        null,
      );
      expect(result).toBe(false);
      expect(mockInboundRepo.delete).not.toHaveBeenCalled();
    });

    it('должен удалить старые инбаунды после ротации', async () => {
      const mockInbound = {
        id: 'inb-1',
        xuiId: 101,
        port: 443,
        protocol: 'vless',
        remark: 'test',
        link: 'link',
        subscription: null as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSub = {
        id: '1',
        uuid: 'uuid-1',
        isEnabled: true,
        inbounds: [mockInbound],
        inboundsConfig: [{ type: 'custom', link: 'vless://replacement' }],
      };

      mockInbound.subscription = mockSub;

      mockDomainRepo.find.mockResolvedValue([
        { id: 1, name: 'ya.ru', isEnabled: true },
      ]);
      mockXuiService.getNewX25519Cert.mockResolvedValue({
        privateKey: 'key',
        publicKey: 'pub',
      });

      await (service as any).rotateSubscription(mockSub, [
        { id: 1, name: 'ya.ru', isEnabled: true },
      ]);

      expect(xuiService.deleteInbound).toHaveBeenCalledWith(101, undefined);
      expect(inboundRepo.delete).toHaveBeenCalled();
    });

    it.each(['happ-routing', 'incy-routing'])(
      'does not create an inbound for %s metadata',
      async (type) => {
        await (service as any).rotateSubscription(
          {
            id: '1',
            uuid: 'uuid-1',
            isEnabled: true,
            inbounds: [],
            inboundsConfig: [{ type, routingProfile: '{"Name":"Test"}' }],
          },
          [],
        );
        expect(xuiService.addInbound).not.toHaveBeenCalled();
        expect(inboundRepo.save).not.toHaveBeenCalled();
      },
    );

    it('должен обработать custom инбаунд без 3x-ui', async () => {
      const mockSub = {
        id: '1',
        uuid: 'uuid-1',
        isEnabled: true,
        inbounds: [],
        inboundsConfig: [{ type: 'custom', link: 'custom://link' }],
      };

      mockDomainRepo.find.mockResolvedValue([
        { id: 1, name: 'ya.ru', isEnabled: true },
      ]);
      mockInboundRepo.save.mockResolvedValue({});

      await (service as any).rotateSubscription(mockSub, [
        { id: 1, name: 'ya.ru', isEnabled: true },
      ]);

      expect(xuiService.addInbound).not.toHaveBeenCalled();
      expect(inboundRepo.save).toHaveBeenCalled();
    });

    it('должен обработать hysteria2-udp инбаунд', async () => {
      const mockSub = {
        id: '1',
        uuid: 'uuid-1',
        isEnabled: true,
        node: { id: 'node-1', domain: 'node.example.com' },
        inbounds: [],
        inboundsConfig: [{ type: 'hysteria2-udp', sni: 'ya.ru' }],
      };

      mockDomainRepo.find.mockResolvedValue([
        { id: 1, name: 'ya.ru', isEnabled: true },
      ]);
      mockXuiService.getNewX25519Cert.mockResolvedValue({
        privateKey: 'key',
        publicKey: 'pub',
      });
      mockInboundBuilder.buildHysteria2Inbound.mockReturnValue({
        protocol: 'hysteria2',
        remark: 'hysteria2-udp',
        settings: '{"clients":[{"password":"uuid"}]}',
        streamSettings: '{"tlsSettings":{"serverName":"ya.ru"}}',
        sniffing: '{}',
      });
      mockXuiService.addInbound.mockResolvedValue(101);
      mockInboundBuilder.buildInboundLink.mockReturnValue('hy2://link');
      mockInboundRepo.save.mockResolvedValue({});

      await (service as any).rotateSubscription(mockSub, [
        { id: 1, name: 'ya.ru', isEnabled: true },
      ]);

      expect(xuiService.addInbound).toHaveBeenCalled();
      expect(inboundBuilder.buildHysteria2Inbound).toHaveBeenCalledWith(
        expect.objectContaining({ sni: 'node.example.com' }),
      );
      expect(inboundBuilder.buildInboundLink).toHaveBeenCalled();
    });

    it('does not save hysteria2 when 3x-ui does not create an inbound', async () => {
      const mockSub = {
        id: '1',
        uuid: 'uuid-1',
        isEnabled: true,
        inbounds: [],
        inboundsConfig: [{ type: 'hysteria2-udp', sni: 'ya.ru' }],
      };

      mockXuiService.getNewX25519Cert.mockResolvedValue({
        privateKey: 'key',
        publicKey: 'pub',
      });
      mockInboundBuilder.buildHysteria2Inbound.mockReturnValue({
        protocol: 'hysteria2',
        remark: 'hysteria2-udp',
        settings: '{"clients":[{"password":"uuid"}]}',
        streamSettings: '{"tlsSettings":{"serverName":"ya.ru"}}',
        sniffing: '{}',
      });
      mockXuiService.addInbound.mockResolvedValue(null);

      await (service as any).rotateSubscription(mockSub, [
        { id: 1, name: 'ya.ru', isEnabled: true },
      ]);

      expect(inboundRepo.save).not.toHaveBeenCalled();
    });

    it('должен использовать случайный порт, если указано random', async () => {
      const mockSub = {
        id: '1',
        uuid: 'uuid-1',
        isEnabled: true,
        inbounds: [],
        inboundsConfig: [
          { type: 'vless-tcp-reality', port: 'random', sni: 'ya.ru' },
        ],
      };

      mockDomainRepo.find.mockResolvedValue([
        { id: 1, name: 'ya.ru', isEnabled: true },
      ]);
      mockInboundRepo.findOne.mockResolvedValue(null); // Порт свободен
      mockXuiService.getNewX25519Cert.mockResolvedValue({
        privateKey: 'key',
        publicKey: 'pub',
      });
      mockInboundBuilder.buildVlessRealityTcp.mockReturnValue({
        protocol: 'vless',
        remark: 'test',
        settings: '{"clients":[{"id":"uuid"}]}',
        streamSettings: '{}',
        sniffing: '{}',
      });
      mockXuiService.addInbound.mockResolvedValue(101);
      mockInboundBuilder.buildInboundLink.mockReturnValue('vless://link');
      mockInboundRepo.save.mockResolvedValue({});

      await (service as any).rotateSubscription(mockSub, [
        { id: 1, name: 'ya.ru', isEnabled: true },
      ]);

      expect(inboundRepo.findOne).toHaveBeenCalled();
    });

    it('должен обработать неизвестный тип инбаунда', async () => {
      const mockSub = {
        id: '1',
        uuid: 'uuid-1',
        isEnabled: true,
        inbounds: [],
        inboundsConfig: [{ type: 'unknown-protocol', port: 443, sni: 'ya.ru' }],
      };

      mockDomainRepo.find.mockResolvedValue([
        { id: 1, name: 'ya.ru', isEnabled: true },
      ]);
      mockXuiService.getNewX25519Cert.mockResolvedValue({
        privateKey: 'key',
        publicKey: 'pub',
      });

      await (service as any).rotateSubscription(mockSub, [
        { id: 1, name: 'ya.ru', isEnabled: true },
      ]);

      expect(xuiService.addInbound).not.toHaveBeenCalled();
    });
  });
});
