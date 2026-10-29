/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionsService } from 'src/subscriptions/subscriptions.service';
import { Subscription } from 'src/subscriptions/entities/subscription.entity';
import { XuiService } from 'src/xui/xui.service';
import { CreateSubscriptionDto } from 'src/subscriptions/dto/create-subscription.dto';
import { Node } from 'src/nodes/entities/node.entity';
import { Tunnel } from 'src/tunnels/entities/tunnel.entity';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let subRepo: Repository<Subscription>;
  let xuiService: XuiService;

  const mockSubRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
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
    deleteInbound: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        {
          provide: getRepositoryToken(Subscription),
          useValue: mockSubRepo,
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
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
    subRepo = module.get<Repository<Subscription>>(
      getRepositoryToken(Subscription),
    );
    xuiService = module.get<XuiService>(XuiService);
    mockXuiService.deleteInbound.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it.each(['happ', 'incy'])(
    'rejects an invalid %s profile before saving a subscription',
    async (scheme) => {
      await expect(
        service.create({
          name: 'Test',
          inboundsConfig: [
            { type: `${scheme}-routing`, routingProfile: 'invalid' },
          ],
        }),
      ).rejects.toThrow('routing profile');
      expect(subRepo.save).not.toHaveBeenCalled();
    },
  );

  describe('findAll', () => {
    it('должен вернуть все подписки с relations и сортировкой', async () => {
      const mockSubs: Subscription[] = [
        {
          id: '1',
          name: 'Sub 1',
          uuid: 'uuid-1',
          isEnabled: true,
          isAutoRotationEnabled: true,
          inboundsConfig: [],
          inbounds: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          name: 'Sub 2',
          uuid: 'uuid-2',
          isEnabled: true,
          isAutoRotationEnabled: false,
          inboundsConfig: [],
          inbounds: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockSubRepo.find.mockResolvedValue(mockSubs);

      const result = await service.findAll();

      expect(result).toEqual(mockSubs);
      expect(subRepo.find).toHaveBeenCalledWith({
        relations: ['inbounds', 'node', 'relayServer'],
        order: { createdAt: 'DESC' },
      });
    });

    it('должен вернуть пустой массив, если подписок нет', async () => {
      mockSubRepo.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    const createDto: CreateSubscriptionDto = {
      name: 'Test Subscription',
      inboundsConfig: [
        { type: 'vless-tcp-reality', port: 443, sni: 'example.com' },
      ],
      isAutoRotationEnabled: true,
    };

    it('должен создать подписку с UUID и настройками по умолчанию', async () => {
      const mockSubscription = {
        ...createDto,
        id: 'test-id',
        uuid: 'generated-uuid',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSubRepo.create.mockReturnValue(mockSubscription);
      mockSubRepo.save.mockResolvedValue(mockSubscription);

      const result = await service.create(createDto);

      expect(subRepo.create).toHaveBeenCalledWith({
        name: 'Test Subscription',
        uuid: expect.any(String),
        clientId: expect.stringMatching(/^3dp-/),
        clientAutoCreate: true,
        inboundsConfig: createDto.inboundsConfig,
        isAutoRotationEnabled: true,
        node: null,
        relayServer: null,
      });
      expect(subRepo.save).toHaveBeenCalledWith(mockSubscription);
      expect(result).toEqual(mockSubscription);
    });

    it('должен использовать inboundsConfig по умолчанию [], если не передан', async () => {
      const dtoWithoutConfig: CreateSubscriptionDto = {
        name: 'Test',
        isAutoRotationEnabled: false,
      };

      mockSubRepo.create.mockReturnValue({ ...dtoWithoutConfig, uuid: 'uuid' });
      mockSubRepo.save.mockResolvedValue({ ...dtoWithoutConfig, uuid: 'uuid' });

      await service.create(dtoWithoutConfig);

      expect(subRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          inboundsConfig: [],
        }),
      );
    });

    it('должен использовать isAutoRotationEnabled=true по умолчанию', async () => {
      const dtoWithoutRotation: CreateSubscriptionDto = {
        name: 'Test',
        inboundsConfig: [],
      };

      mockSubRepo.create.mockReturnValue({
        ...dtoWithoutRotation,
        uuid: 'uuid',
      });
      mockSubRepo.save.mockResolvedValue({
        ...dtoWithoutRotation,
        uuid: 'uuid',
      });

      await service.create(dtoWithoutRotation);

      expect(subRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isAutoRotationEnabled: true,
        }),
      );
    });
  });

  describe('update', () => {
    const existingSub: Subscription = {
      id: 'test-id',
      name: 'Old Name',
      uuid: 'uuid',
      isEnabled: true,
      isAutoRotationEnabled: true,
      inboundsConfig: [],
      inbounds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('должен обновить имя подписки', async () => {
      mockSubRepo.findOne.mockResolvedValue(existingSub);
      mockSubRepo.save.mockResolvedValue({ ...existingSub, name: 'New Name' });

      const result = await service.update('test-id', { name: 'New Name' });

      expect(subRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        relations: ['inbounds', 'node', 'relayServer'],
      });
      expect(subRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Name' }),
      );
      expect(result).toEqual({ ...existingSub, name: 'New Name' });
    });

    it('должен обновить isAutoRotationEnabled', async () => {
      mockSubRepo.findOne.mockResolvedValue(existingSub);
      mockSubRepo.save.mockResolvedValue({
        ...existingSub,
        isAutoRotationEnabled: false,
      });

      const result = await service.update('test-id', {
        isAutoRotationEnabled: false,
      });

      expect(subRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isAutoRotationEnabled: false }),
      );
      expect(result).toEqual({ ...existingSub, isAutoRotationEnabled: false });
    });

    it('должен обновить inboundsConfig', async () => {
      const newConfig = [{ type: 'vmess-tcp', port: 8080 }];
      mockSubRepo.findOne.mockResolvedValue(existingSub);
      mockSubRepo.save.mockResolvedValue({
        ...existingSub,
        inboundsConfig: newConfig,
      });

      await service.update('test-id', { inboundsConfig: newConfig });

      expect(subRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ inboundsConfig: newConfig }),
      );
    });

    it('НЕ должен обновлять имя на пустую строку (защита от очистки)', async () => {
      mockSubRepo.findOne.mockResolvedValue(existingSub);
      mockSubRepo.save.mockResolvedValue(existingSub);

      await service.update('test-id', { name: '' });

      expect(subRepo.save).not.toHaveBeenCalledWith(
        expect.objectContaining({ name: '' }),
      );
      expect(subRepo.save).toHaveBeenCalledWith(existingSub);
    });

    it('НЕ должен обновлять имя с пробелами (защита от очистки)', async () => {
      mockSubRepo.findOne.mockResolvedValue(existingSub);
      mockSubRepo.save.mockResolvedValue(existingSub);

      await service.update('test-id', { name: '   ' });

      expect(subRepo.save).toHaveBeenCalledWith(existingSub);
    });

    it('должен вернуть null, если подписка не найдена', async () => {
      mockSubRepo.findOne.mockResolvedValue(null);

      const result = await service.update('non-existent-id', { name: 'New' });

      expect(result).toBeNull();
      expect(subRepo.save).not.toHaveBeenCalled();
    });

    it('должен обновить только isAutoRotationEnabled, не трогая имя', async () => {
      const freshSub: Subscription = {
        ...existingSub,
        name: 'Old Name',
        inboundsConfig: [],
      };
      mockSubRepo.findOne.mockResolvedValue(freshSub);
      mockSubRepo.save.mockImplementation((sub) => Promise.resolve(sub));

      await service.update('test-id', { isAutoRotationEnabled: false });

      expect(subRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Old Name',
          isAutoRotationEnabled: false,
        }),
      );
    });
  });

  it('stores a supplied client identifier without enabling automatic creation', async () => {
    await service.create({ name: 'Shared', clientId: ' existing-client ' });
    expect(mockSubRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'existing-client',
        clientAutoCreate: false,
      }),
    );
  });

  it('preserves automatic client ownership when editing an unchanged identifier', async () => {
    const sub = {
      id: 'test',
      clientId: '3dp-generated',
      clientAutoCreate: true,
    };
    mockSubRepo.findOne.mockResolvedValue(sub);
    await service.update('test', { clientId: '3dp-generated' });
    expect(mockSubRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ clientAutoCreate: true }),
    );
  });

  describe('remove', () => {
    const subWithInbounds: Subscription = {
      id: 'test-id',
      name: 'Test',
      uuid: 'uuid',
      isEnabled: true,
      isAutoRotationEnabled: true,
      inboundsConfig: [],
      inbounds: [
        {
          id: '1',
          xuiId: 101,
          port: 443,
          protocol: 'vless',
          remark: 'test',
          link: 'link',
          subscription: null as any,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          xuiId: 102,
          port: 8443,
          protocol: 'vmess',
          remark: 'test2',
          link: 'link2',
          subscription: null as any,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('должен удалить инбаунды из 3x-ui перед удалением подписки', async () => {
      mockSubRepo.findOne.mockResolvedValue(subWithInbounds);
      mockSubRepo.remove.mockResolvedValue(undefined);

      await service.remove('test-id');

      expect(xuiService.deleteInbound).toHaveBeenCalledWith(101, undefined);
      expect(xuiService.deleteInbound).toHaveBeenCalledWith(102, undefined);
      expect(subRepo.remove).toHaveBeenCalledWith(subWithInbounds);
    });

    it.each([false, new Error('Panel unavailable')])(
      'сохраняет подписку при ошибке удаления: %s',
      async (failure) => {
        mockSubRepo.findOne.mockResolvedValue(subWithInbounds);
        if (failure instanceof Error)
          mockXuiService.deleteInbound.mockRejectedValue(failure);
        else mockXuiService.deleteInbound.mockResolvedValue(false);

        await expect(service.remove('test-id')).rejects.toMatchObject({
          response: { code: 'INBOUND_DELETE_FAILED' },
        });
        expect(subRepo.remove).not.toHaveBeenCalled();
      },
    );

    it('принудительно удаляет подписку и продолжает очистку после ошибок', async () => {
      mockSubRepo.findOne.mockResolvedValue(subWithInbounds);
      mockXuiService.deleteInbound
        .mockRejectedValueOnce(new Error('Panel unavailable'))
        .mockResolvedValueOnce(false);

      await service.remove('test-id', true);

      expect(xuiService.deleteInbound).toHaveBeenCalledTimes(2);
      expect(subRepo.remove).toHaveBeenCalledWith(subWithInbounds);
    });

    it('должен удалить подписку без инбаундов', async () => {
      const subWithoutInbounds: Subscription = {
        ...subWithInbounds,
        inbounds: [],
      };

      mockSubRepo.findOne.mockResolvedValue(subWithoutInbounds);
      mockSubRepo.remove.mockResolvedValue(undefined);

      await service.remove('test-id');

      expect(xuiService.deleteInbound).not.toHaveBeenCalled();
      expect(subRepo.remove).toHaveBeenCalledWith(subWithoutInbounds);
    });

    it('должен вернуть undefined, если подписка не найдена', async () => {
      mockSubRepo.findOne.mockResolvedValue(null);

      const result = await service.remove('non-existent-id');

      expect(result).toBeUndefined();
      expect(subRepo.remove).not.toHaveBeenCalled();
      expect(xuiService.deleteInbound).not.toHaveBeenCalled();
    });
  });
});
