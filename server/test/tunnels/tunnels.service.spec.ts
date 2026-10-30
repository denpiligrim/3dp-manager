/* eslint-disable @typescript-eslint/unbound-method */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpException } from '@nestjs/common';
import { TunnelsService } from 'src/tunnels/tunnels.service';
import { Tunnel } from 'src/tunnels/entities/tunnel.entity';
import { SshService } from 'src/tunnels/ssh.service';
import { Setting } from 'src/settings/entities/setting.entity';
import { Node } from 'src/nodes/entities/node.entity';
import { Subscription } from 'src/subscriptions/entities/subscription.entity';
import { DomainsService } from 'src/domains/domains.service';

describe('TunnelsService', () => {
  let service: TunnelsService;
  let tunnelRepo: Repository<Tunnel>;
  let sshService: SshService;

  const mockTunnelRepo = {
    manager: { transaction: jest.fn() },
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    })),
  };

  const mockSettingRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockNodeRepo = {
    findOne: jest.fn(),
  };

  const mockSubscriptionRepo = {
    find: jest.fn(),
    save: jest.fn(),
  };

  const mockSshService = {
    executeCommand: jest.fn(),
  };
  const mockDomainsService = { addHostDomain: jest.fn() };

  beforeEach(async () => {
    mockTunnelRepo.manager.transaction.mockImplementation((action) =>
      action({ getRepository: () => mockTunnelRepo }),
    );
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TunnelsService,
        { provide: DomainsService, useValue: mockDomainsService },
        {
          provide: getRepositoryToken(Tunnel),
          useValue: mockTunnelRepo,
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
          provide: getRepositoryToken(Subscription),
          useValue: mockSubscriptionRepo,
        },
        {
          provide: SshService,
          useValue: mockSshService,
        },
      ],
    }).compile();

    service = module.get<TunnelsService>(TunnelsService);
    tunnelRepo = module.get<Repository<Tunnel>>(getRepositoryToken(Tunnel));
    settingRepo = module.get<Repository<Setting>>(getRepositoryToken(Setting));
    sshService = module.get<SshService>(SshService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('create', () => {
    it('registers a relay hostname as SNI when its IP was resolved', async () => {
      jest
        .spyOn(service as any, 'resolveRelayAddress')
        .mockResolvedValue({ ip: '192.0.2.1', domain: 'relay.example.com' });
      mockNodeRepo.findOne.mockResolvedValue({ id: 'node-1' });
      mockTunnelRepo.create.mockImplementation((value) => ({ ...value }));
      mockTunnelRepo.save.mockImplementation(async (value) => ({
        ...value,
        id: 1,
      }));
      await service.create({
        name: 'Relay',
        ip: 'relay.example.com',
        username: 'root',
      });
      expect(mockDomainsService.addHostDomain).toHaveBeenCalledWith(
        'relay.example.com',
        expect.objectContaining({ getRepository: expect.any(Function) }),
      );
      expect(mockTunnelRepo.manager.transaction).toHaveBeenCalledTimes(1);
    });
    it('должен создать туннель', async () => {
      const dto = { ip: '192.168.1.1', sshPort: 22, username: 'root' };
      const node = { id: 'node-1', isMain: true };
      const mockTunnel = { id: 1, ...dto, node, nodeId: node.id };

      mockNodeRepo.findOne.mockResolvedValue(node);
      mockTunnelRepo.create.mockReturnValue(mockTunnel);
      mockTunnelRepo.save.mockResolvedValue(mockTunnel);

      const result = await service.create(dto);

      expect(result).toEqual(mockTunnel);
      expect(tunnelRepo.create).toHaveBeenCalledWith({
        ...dto,
        node,
        nodeId: node.id,
      });
    });
  });

  describe('findAll', () => {
    it('должен вернуть все туннели', async () => {
      const mockTunnels = [
        { id: 1, ip: '192.168.1.1' },
        { id: 2, ip: '192.168.1.2' },
      ];

      mockTunnelRepo.find.mockResolvedValue(mockTunnels);

      const result = await service.findAll();

      expect(result).toEqual(mockTunnels);
      expect(tunnelRepo.find).toHaveBeenCalledWith({ relations: ['node'] });
    });
  });

  describe('remove', () => {
    it('должен удалить туннель по ID', async () => {
      mockSubscriptionRepo.find.mockResolvedValue([]);
      mockTunnelRepo.delete.mockResolvedValue({ affected: 1 });

      await service.remove(1);

      expect(tunnelRepo.delete).toHaveBeenCalledWith(1);
    });
  });

  describe('installScript', () => {
    const mockTunnel = {
      id: 1,
      ip: '192.168.1.100',
      sshPort: 22,
      username: 'root',
      password: 'password123',
      privateKey: null,
      isInstalled: false,
    };

    it('должен установить скрипт перенаправления', async () => {
      mockTunnelRepo.createQueryBuilder.mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockTunnel),
      });

      mockSettingRepo.findOne.mockResolvedValue({
        key: 'xui_ip',
        value: '10.0.0.1',
      });
      mockSshService.executeCommand.mockResolvedValue(
        'Script executed successfully',
      );
      mockTunnelRepo.save.mockResolvedValue({
        ...mockTunnel,
        isInstalled: true,
      });

      const result = await service.installScript(1);

      expect(result).toEqual({
        success: true,
        output: 'Script executed successfully',
      });
      expect(sshService.executeCommand).toHaveBeenCalled();
      expect(tunnelRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isInstalled: true }),
      );
    });

    it('должен бросить HttpException, если туннель не найден', async () => {
      mockTunnelRepo.createQueryBuilder.mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });

      await expect(service.installScript(999)).rejects.toThrow(HttpException);

      await expect(service.installScript(999)).rejects.toThrow(
        'Tunnel not found',
      );
    });

    it('должен бросить HttpException, если xui_host не настроен', async () => {
      mockTunnelRepo.createQueryBuilder.mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockTunnel),
      });

      mockSettingRepo.findOne.mockResolvedValue(null);

      await expect(service.installScript(1)).rejects.toThrow(HttpException);

      await expect(service.installScript(1)).rejects.toThrow(
        'В настройках (Settings) не сохранен Host/IP основного сервера',
      );
    });

    it('должен бросить HttpException при ошибке SSH', async () => {
      mockTunnelRepo.createQueryBuilder.mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockTunnel),
      });

      mockSettingRepo.findOne.mockResolvedValue({
        key: 'xui_ip',
        value: '10.0.0.1',
      });
      mockSshService.executeCommand.mockRejectedValue(
        new Error('SSH connection failed'),
      );

      await expect(service.installScript(1)).rejects.toThrow(HttpException);

      await expect(service.installScript(1)).rejects.toThrow(
        'Ошибка установки: SSH connection failed',
      );
    });
  });
});
