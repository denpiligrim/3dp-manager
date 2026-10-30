/* eslint-disable @typescript-eslint/unbound-method */

import { Test, TestingModule } from '@nestjs/testing';
import { RotationController } from 'src/rotation/rotation.controller';
import { RotationService } from 'src/rotation/rotation.service';

describe('RotationController', () => {
  let controller: RotationController;
  let rotationService: RotationService;

  const mockRotationService = {
    performRotation: jest.fn(),
    rotateSingleSubscription: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RotationController],
      providers: [
        {
          provide: RotationService,
          useValue: mockRotationService,
        },
      ],
    }).compile();

    controller = module.get<RotationController>(RotationController);
    rotationService = module.get<RotationService>(RotationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('rotateAll', () => {
    it('должен запустить плановую ротацию', async () => {
      const mockResult = { success: true, message: 'Ротация выполнена' };

      mockRotationService.performRotation.mockResolvedValue(mockResult);

      const result = await controller.rotateAll();

      expect(result).toEqual(mockResult);
      expect(rotationService.performRotation).toHaveBeenCalledTimes(1);
    });

    it('должен вернуть ошибку ротации', async () => {
      const mockError = { success: false, message: 'Нет подписок' };

      mockRotationService.performRotation.mockResolvedValue(mockError);

      const result = await controller.rotateAll();

      expect(result).toEqual(mockError);
    });
  });

  describe('rotateSingle', () => {
    it.each(['true', 'false', undefined])(
      'passes force=%s explicitly',
      async (force) => {
        await controller.rotateSingle('sub-123', force);
        expect(rotationService.rotateSingleSubscription).toHaveBeenCalledWith(
          'sub-123',
          force === 'true',
        );
        await controller.rotateAll(force);
        expect(rotationService.performRotation).toHaveBeenCalledWith(
          force === 'true',
        );
      },
    );
    it('должен запустить ротацию одной подписки', async () => {
      const mockResult = {
        success: true,
        message: 'Ротация подписки выполнена',
      };

      mockRotationService.rotateSingleSubscription.mockResolvedValue(
        mockResult,
      );

      const result = await controller.rotateSingle('sub-123');

      expect(result).toEqual(mockResult);
      expect(rotationService.rotateSingleSubscription).toHaveBeenCalledWith(
        'sub-123',
        false,
      );
    });

    it('должен вернуть ошибку ротации одной подписки', async () => {
      const mockError = { success: false, message: 'Подписка не найдена' };

      mockRotationService.rotateSingleSubscription.mockResolvedValue(mockError);

      const result = await controller.rotateSingle('non-existent');

      expect(result).toEqual(mockError);
    });
  });
});
