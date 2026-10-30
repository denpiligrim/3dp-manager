/* eslint-disable @typescript-eslint/unbound-method */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { DomainsService } from 'src/domains/domains.service';
import { Domain } from 'src/domains/entities/domain.entity';

describe('DomainsService', () => {
  let service: DomainsService;
  let repo: Repository<Domain>;

  const mockRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
    findAndCount: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DomainsService,
        {
          provide: getRepositoryToken(Domain),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<DomainsService>(DomainsService);
    repo = module.get<Repository<Domain>>(getRepositoryToken(Domain));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('automatic host domains', () => {
    it.each([
      undefined,
      '',
      '192.0.2.1',
      '2001:db8::1',
      '[2001:db8::1]',
      'localhost',
    ])('skips IP and empty/non-domain hostnames (%s)', async (host) => {
      const manager = { getRepository: jest.fn() };
      await service.addHostDomain(host, manager as unknown as EntityManager);
      expect(manager.getRepository).not.toHaveBeenCalled();
    });
    it.each([false, true])(
      'normalizes hostnames and preserves existing domains (exists=%s)',
      async (exists) => {
        const builder = {
          where: jest.fn().mockReturnThis(),
          getOne: jest
            .fn()
            .mockResolvedValue(
              exists ? { name: 'SECOND.example.com', isEnabled: false } : null,
            ),
          insert: jest.fn().mockReturnThis(),
          into: jest.fn().mockReturnThis(),
          values: jest.fn().mockReturnThis(),
          orIgnore: jest.fn().mockReturnThis(),
          execute: jest.fn(),
        };
        const hostRepo = { createQueryBuilder: jest.fn(() => builder) };
        const manager = { getRepository: jest.fn(() => hostRepo) };
        await service.addHostDomain(
          'https://Second.Example.COM:8443/panel',
          manager as unknown as EntityManager,
        );
        expect(builder.where).toHaveBeenCalledWith(
          'LOWER(domain.name) = LOWER(:name)',
          { name: 'second.example.com' },
        );
        if (exists) expect(builder.insert).not.toHaveBeenCalled();
        else {
          expect(builder.values).toHaveBeenCalledWith({
            name: 'second.example.com',
            isEnabled: true,
          });
          expect(builder.orIgnore).toHaveBeenCalledTimes(1);
        }
      },
    );
  });

  describe('onModuleInit', () => {
    it('должен создать домены по умолчанию, если база пустая', async () => {
      mockRepo.count.mockResolvedValue(0);
      mockRepo.create.mockReturnValue({ name: 'ya.ru' });
      mockRepo.save.mockResolvedValue({});

      await service.onModuleInit();

      expect(repo.count).toHaveBeenCalledTimes(1);
      expect(repo.create).toHaveBeenCalledTimes(10);
      expect(repo.save).toHaveBeenCalled();
    });

    it('НЕ должен создавать домены, если они уже есть', async () => {
      mockRepo.count.mockResolvedValue(5);

      await service.onModuleInit();

      expect(repo.count).toHaveBeenCalledTimes(1);
      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('должен создать домен', async () => {
      const dto = { name: 'example.com' };
      const normalized = 'example.com';
      const created = { id: 1, name: normalized };

      mockRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(result).toEqual(created);
      expect(repo.create).toHaveBeenCalledWith({ name: normalized });
    });

    it('должен вернуть существующий домен, если он уже есть', async () => {
      const dto = { name: 'example.com' };
      const existing = { id: 1, name: 'example.com' };

      mockRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(existing),
      });

      const result = await service.create(dto);

      expect(result).toEqual(existing);
      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('должен бросить BadRequestException для некорректного домена', async () => {
      const dto = { name: 'not-a-domain' };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow(
        'Некорректное доменное имя',
      );
    });

    it('должен нормализовать домен с протоколом и путём', async () => {
      const dto = { name: 'https://example.com/path/to/page' };
      const normalized = 'example.com';

      mockRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });
      mockRepo.create.mockReturnValue({ name: normalized });
      mockRepo.save.mockResolvedValue({ name: normalized });

      await service.create(dto);

      expect(repo.create).toHaveBeenCalledWith({ name: normalized });
    });

    it('должен нормализовать wildcard домен *.example.com → example.com', async () => {
      const dto = { name: '*.example.com' };
      const normalized = 'example.com';

      mockRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });
      mockRepo.create.mockReturnValue({ name: normalized });
      mockRepo.save.mockResolvedValue({ name: normalized });

      await service.create(dto);

      expect(repo.create).toHaveBeenCalledWith({ name: normalized });
    });

    it('должен игнорировать комментарии в домене', async () => {
      const dto = { name: 'example.com # это комментарий' };
      const normalized = 'example.com';

      mockRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });
      mockRepo.create.mockReturnValue({ name: normalized });
      mockRepo.save.mockResolvedValue({ name: normalized });

      await service.create(dto);

      expect(repo.create).toHaveBeenCalledWith({ name: normalized });
    });
  });

  describe('findAll', () => {
    it('должен вернуть домены с пагинацией', async () => {
      const mockDomains = [
        { id: 1, name: 'ya.ru' },
        { id: 2, name: 'vk.com' },
      ];

      mockRepo.findAndCount.mockResolvedValue([mockDomains, 100]);

      const result = await service.findAll(1, 10);

      expect(result).toEqual({
        data: mockDomains,
        total: 100,
      });
      expect(repo.findAndCount).toHaveBeenCalledWith({
        take: 10,
        skip: 0,
        order: { id: 'DESC' },
      });
    });

    it('должен использовать значения по умолчанию для пагинации', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll();

      expect(repo.findAndCount).toHaveBeenCalledWith({
        take: 10,
        skip: 0,
        order: { id: 'DESC' },
      });
    });
  });

  describe('findAllUnpaginated', () => {
    it('должен вернуть все домены без пагинации', async () => {
      const mockDomains = [
        { id: 1, name: 'ya.ru' },
        { id: 2, name: 'vk.com' },
      ];

      mockRepo.find.mockResolvedValue(mockDomains);

      const result = await service.findAllUnpaginated();

      expect(result).toEqual(mockDomains);
      expect(repo.find).toHaveBeenCalledWith({ order: { name: 'ASC' } });
    });
  });

  describe('findOne', () => {
    it('должен вернуть домен по ID', async () => {
      const mockDomain = { id: 1, name: 'ya.ru' };

      mockRepo.findOneBy.mockResolvedValue(mockDomain);

      const result = await service.findOne(1);

      expect(result).toEqual(mockDomain);
      expect(repo.findOneBy).toHaveBeenCalledWith({ id: 1 });
    });
  });

  describe('remove', () => {
    it('должен удалить домен по ID', async () => {
      mockRepo.delete.mockResolvedValue({ affected: 1 });

      await service.remove(1);

      expect(repo.delete).toHaveBeenCalledWith(1);
    });
  });

  describe('removeAll', () => {
    it('должен удалить все домены', async () => {
      mockRepo.clear.mockResolvedValue(undefined);

      const result = await service.removeAll();

      expect(result).toEqual({ success: true });
      expect(repo.clear).toHaveBeenCalledTimes(1);
    });
  });

  describe('createMany', () => {
    it('должен создать несколько доменов', async () => {
      const domains = ['ya.ru', 'vk.com', 'ok.ru'];

      mockRepo.find.mockResolvedValue([]);
      mockRepo.create.mockReturnValue({ name: 'ya.ru' });
      mockRepo.save.mockResolvedValue({});

      const result = await service.createMany(domains);

      expect(result.count).toBeGreaterThan(0);
      expect(repo.save).toHaveBeenCalled();
    });

    it('должен пропустить существующие домены', async () => {
      const domains = ['ya.ru', 'vk.com'];
      const existing = [{ id: 1, name: 'ya.ru' }];

      mockRepo.find.mockResolvedValue(existing);

      const result = await service.createMany(domains);

      expect(result.count).toBe(1); // Только vk.com будет создан
    });

    it('должен вернуть 0, если все домены уже существуют', async () => {
      const domains = ['ya.ru', 'vk.com'];
      const existing = [
        { id: 1, name: 'ya.ru' },
        { id: 2, name: 'vk.com' },
      ];

      mockRepo.find.mockResolvedValue(existing);

      const result = await service.createMany(domains);

      expect(result.count).toBe(0);
    });

    it('должен вернуть 0 для пустого массива', async () => {
      const result = await service.createMany([]);

      expect(result.count).toBe(0);
      expect(repo.find).not.toHaveBeenCalled();
    });

    it('должен нормализовать домены при массовом создании', async () => {
      const domains = ['*.EXAMPLE.com', 'https://vk.com/path', '  ok.ru  '];

      mockRepo.find.mockResolvedValue([]);
      mockRepo.create.mockReturnValue({ name: 'example.com' });
      mockRepo.save.mockResolvedValue({});

      await service.createMany(domains);

      expect(repo.create).toHaveBeenCalled();
    });
  });
});
