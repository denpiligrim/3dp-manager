/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsController } from 'src/subscriptions/subscriptions.controller';
import { SubscriptionsService } from 'src/subscriptions/subscriptions.service';
import { NotFoundException } from '@nestjs/common';
import { CreateSubscriptionDto } from 'src/subscriptions/dto/create-subscription.dto';
import { UpdateSubscriptionDto } from 'src/subscriptions/dto/update-subscription.dto';

describe('SubscriptionsController', () => {
  let controller: SubscriptionsController;
  let service: SubscriptionsService;

  const mockSubscriptionsService = {
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionsController],
      providers: [
        {
          provide: SubscriptionsService,
          useValue: mockSubscriptionsService,
        },
      ],
    }).compile();

    controller = module.get<SubscriptionsController>(SubscriptionsController);
    service = module.get<SubscriptionsService>(SubscriptionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('должен вернуть все подписки', async () => {
      const mockSubs = [
        { id: '1', name: 'Sub 1', uuid: 'uuid-1' },
        { id: '2', name: 'Sub 2', uuid: 'uuid-2' },
      ];
      mockSubscriptionsService.findAll.mockResolvedValue(mockSubs);

      const result = await controller.findAll();

      expect(result).toEqual(mockSubs);
      expect(service.findAll).toHaveBeenCalledTimes(1);
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

    it('должен создать подписку', async () => {
      const mockSubscription = { id: 'new-id', ...createDto };
      mockSubscriptionsService.create.mockResolvedValue(mockSubscription);

      const result = await controller.create(createDto);

      expect(result).toEqual(mockSubscription);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('bulkUpdateAutoRotation', () => {
    it('должен вернуть ошибку, если subscriptionIds не массив', async () => {
      const result = await controller.bulkUpdateAutoRotation({
        subscriptionIds: 'not-array' as any,
        enabled: true,
      });

      expect(result).toEqual({
        success: false,
        message: 'subscriptionIds должен быть массивом',
      });
    });

    it('должен вернуть ошибку, если больше 100 ID', async () => {
      const result = await controller.bulkUpdateAutoRotation({
        subscriptionIds: Array(101).fill('id'),
        enabled: true,
      });

      expect(result).toEqual({
        success: false,
        message: 'Максимум 100 ID за раз',
      });
    });

    it('должен обновить подписки и вернуть отчёт', async () => {
      const ids = ['id1', 'id2', 'id3'];
      mockSubscriptionsService.update
        .mockResolvedValueOnce({ id: 'id1' })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'id3' });

      const result = await controller.bulkUpdateAutoRotation({
        subscriptionIds: ids,
        enabled: true,
      });

      expect(result).toEqual({
        success: true,
        message: 'Обновлено 2 подписок',
        updatedCount: 2,
        notFound: ['id2'],
      });
    });

    it('должен вернуть пустой notFound, если все обновлены успешно', async () => {
      const ids = ['id1', 'id2'];
      mockSubscriptionsService.update.mockResolvedValue({ id: 'updated' });

      const result = await controller.bulkUpdateAutoRotation({
        subscriptionIds: ids,
        enabled: false,
      });

      expect(result).toEqual({
        success: true,
        message: 'Обновлено 2 подписок',
        updatedCount: 2,
        notFound: undefined,
      });
    });

    it('должен обработать пустой массив', async () => {
      const result = await controller.bulkUpdateAutoRotation({
        subscriptionIds: [],
        enabled: true,
      });

      expect(result).toEqual({
        success: true,
        message: 'Обновлено 0 подписок',
        updatedCount: 0,
        notFound: undefined,
      });
    });
  });

  describe('update', () => {
    const updateDto: UpdateSubscriptionDto = {
      name: 'Updated Name',
      isAutoRotationEnabled: false,
    };

    it('должен обновить подписку', async () => {
      const mockSub = { id: 'id1', ...updateDto };
      mockSubscriptionsService.update.mockResolvedValue(mockSub);

      const result = await controller.update('id1', updateDto);

      expect(result).toEqual(mockSub);
      expect(service.update).toHaveBeenCalledWith('id1', updateDto);
    });

    it('должен бросить NotFoundException, если подписка не найдена', async () => {
      mockSubscriptionsService.update.mockResolvedValue(null);

      await expect(
        controller.update('non-existent', updateDto),
      ).rejects.toThrow(NotFoundException);

      await expect(
        controller.update('non-existent', updateDto),
      ).rejects.toThrow('Подписка non-existent не найдена');
    });
  });

  describe('remove', () => {
    it('должен удалить подписку', async () => {
      mockSubscriptionsService.remove.mockResolvedValue(undefined);

      await controller.remove('id1');

      expect(service.remove).toHaveBeenCalledWith('id1', false);
    });
  });
});
