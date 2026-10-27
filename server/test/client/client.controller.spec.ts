/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpException } from '@nestjs/common';
import { ClientController } from 'src/client/client.controller';
import { Subscription } from 'src/subscriptions/entities/subscription.entity';
import { Tunnel } from 'src/tunnels/entities/tunnel.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as QRCode from 'qrcode';

jest.mock('qrcode', () => ({
  toDataURL: jest.fn(),
}));

jest.mock('src/client/templates/subscription.template', () => ({
  generateSubscriptionHtmlWithQr: jest.fn(
    () => '<html>Subscription Page</html>',
  ),
}));

describe('ClientController', () => {
  let controller: ClientController;
  let _subRepo: Repository<Subscription>;
  let _tunnelRepo: Repository<Tunnel>;
  let cacheManager: any;

  const mockSubRepo = {
    findOne: jest.fn(),
  };

  const mockTunnelRepo = {
    findOne: jest.fn(),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClientController],
      providers: [
        {
          provide: getRepositoryToken(Subscription),
          useValue: mockSubRepo,
        },
        {
          provide: getRepositoryToken(Tunnel),
          useValue: mockTunnelRepo,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    controller = module.get<ClientController>(ClientController);
    _subRepo = module.get<Repository<Subscription>>(
      getRepositoryToken(Subscription),
    );
    _tunnelRepo = module.get<Repository<Tunnel>>(getRepositoryToken(Tunnel));
    cacheManager = module.get(CACHE_MANAGER);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it.each([false, true])(
    'includes routing metadata in subscription (relay=%s)',
    async (relay) => {
      const profile = JSON.stringify({ Name: 'Test' });
      const routing = `happ://routing/add/${Buffer.from(profile).toString('base64')}`;
      mockSubRepo.findOne.mockResolvedValue({
        isEnabled: true,
        inboundsConfig: [{ type: 'happ-routing', routingProfile: profile }],
        inbounds: [{ link: 'vless://id@original:443', protocol: 'vless' }],
      });
      mockTunnelRepo.findOne.mockResolvedValue({ domain: 'relay.example' });
      const req = { headers: {} } as any;
      const res = { setHeader: jest.fn(), send: jest.fn() } as any;
      if (relay) {
        await controller.getRelaySubscription('uuid', '1', '', req, res);
      } else {
        await controller.getSubscription('uuid', req, res);
      }
      const expected = `${routing}\nvless://id@${relay ? 'relay.example' : 'original'}:443`;
      expect(res.send).toHaveBeenCalledWith(
        Buffer.from(expected).toString('base64'),
      );
    },
  );

  describe('getSubscription', () => {
    const mockSubscription = {
      uuid: 'test-uuid',
      name: 'Test Subscription',
      isEnabled: true,
      inbounds: [
        { id: 1, link: 'vless://abc123@192.168.1.1:443', protocol: 'vless' },
        { id: 2, link: 'vmess://xyz789', protocol: 'vmess' },
      ],
    };

    const mockRequest = {
      headers: {},
      protocol: 'https',
      get: jest.fn().mockReturnValue('example.com'),
    } as any;

    const mockResponse = {
      setHeader: jest.fn(),
      send: jest.fn(),
    } as any;

    it('должен вернуть base64 подписку для не-браузера', async () => {
      mockRequest.headers['user-agent'] = 'curl/7.68.0';
      mockSubRepo.findOne.mockResolvedValue(mockSubscription);
      (QRCode.toDataURL as jest.Mock).mockResolvedValue(
        'data:image/png;base64,qr',
      );

      await controller.getSubscription('test-uuid', mockRequest, mockResponse);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/plain; charset=utf-8',
      );
      expect(mockResponse.send).toHaveBeenCalledWith(expect.any(String));
    });

    it('должен вернуть HTML с QR для браузера', async () => {
      mockRequest.headers['user-agent'] = 'Mozilla/5.0 Chrome/120.0';
      mockSubRepo.findOne.mockResolvedValue(mockSubscription);
      (QRCode.toDataURL as jest.Mock).mockResolvedValue(
        'data:image/png;base64,qr',
      );
      mockCacheManager.get.mockResolvedValue(null);

      await controller.getSubscription('test-uuid', mockRequest, mockResponse);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/html',
      );
      expect(mockResponse.send).toHaveBeenCalledWith(
        '<html>Subscription Page</html>',
      );
    });

    it('должен загрузить QR из кэша', async () => {
      mockRequest.headers['user-agent'] = 'Mozilla/5.0 Chrome/120.0';
      mockSubRepo.findOne.mockResolvedValue(mockSubscription);
      mockCacheManager.get.mockResolvedValue('data:image/png;base64,cached-qr');

      await controller.getSubscription('test-uuid', mockRequest, mockResponse);

      expect(cacheManager.get).toHaveBeenCalledWith('qr_test-uuid');
      expect(QRCode.toDataURL).not.toHaveBeenCalled();
    });

    it('должен бросить 404, если подписка не найдена', async () => {
      mockSubRepo.findOne.mockResolvedValue(null);

      await expect(
        controller.getSubscription('non-existent', mockRequest, mockResponse),
      ).rejects.toThrow(HttpException);

      await expect(
        controller.getSubscription('non-existent', mockRequest, mockResponse),
      ).rejects.toThrow('Subscription not found');
    });

    it('должен бросить 404, если подписка отключена', async () => {
      const disabledSub = { ...mockSubscription, isEnabled: false };
      mockSubRepo.findOne.mockResolvedValue(disabledSub);

      await expect(
        controller.getSubscription('test-uuid', mockRequest, mockResponse),
      ).rejects.toThrow(HttpException);
    });

    it('должен обработать подписку без инбаундов', async () => {
      const subWithoutInbounds = { ...mockSubscription, inbounds: [] };
      mockRequest.headers['user-agent'] = 'curl/7.68.0';
      mockSubRepo.findOne.mockResolvedValue(subWithoutInbounds);

      await controller.getSubscription('test-uuid', mockRequest, mockResponse);

      expect(mockResponse.send).toHaveBeenCalledWith('');
    });
  });

  describe('getRelaySubscription', () => {
    const mockTunnel = {
      id: 1,
      ip: '192.168.1.100',
      domain: 'relay.example.com',
    };

    const mockSubscription = {
      uuid: 'test-uuid',
      name: 'Test Subscription',
      isEnabled: true,
      inbounds: [
        { id: 1, link: 'vless://abc123@192.168.1.1:443', protocol: 'vless' },
        { id: 2, link: 'vmess://xyz789', protocol: 'vmess' },
        { id: 3, link: 'custom-link', protocol: 'custom' },
      ],
    };

    const mockRequest = {
      headers: {},
      protocol: 'https',
      get: jest.fn().mockReturnValue('example.com'),
    } as any;

    const mockResponse = {
      setHeader: jest.fn(),
      send: jest.fn(),
      status: jest.fn().mockReturnThis(),
    } as any;

    it('должен вернуть 404, если туннель не найден', async () => {
      mockTunnelRepo.findOne.mockResolvedValue(null);

      await controller.getRelaySubscription(
        'test-uuid',
        '999',
        'base64',
        mockRequest,
        mockResponse,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.send).toHaveBeenCalledWith('Relay server not found');
    });

    it('должен вернуть base64 подписку для не-браузера с relay', async () => {
      mockRequest.headers['user-agent'] = 'curl/7.68.0';
      mockTunnelRepo.findOne.mockResolvedValue(mockTunnel);
      mockSubRepo.findOne.mockResolvedValue(mockSubscription);

      await controller.getRelaySubscription(
        'test-uuid',
        '1',
        'base64',
        mockRequest,
        mockResponse,
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/plain; charset=utf-8',
      );
      expect(mockResponse.send).toHaveBeenCalled();
    });

    it('должен вернуть HTML с QR для браузера с relay', async () => {
      mockRequest.headers['user-agent'] = 'Mozilla/5.0 Chrome/120.0';
      mockTunnelRepo.findOne.mockResolvedValue(mockTunnel);
      mockSubRepo.findOne.mockResolvedValue(mockSubscription);
      mockCacheManager.get.mockResolvedValue(null);
      (QRCode.toDataURL as jest.Mock).mockResolvedValue(
        'data:image/png;base64,qr',
      );

      await controller.getRelaySubscription(
        'test-uuid',
        '1',
        'base64',
        mockRequest,
        mockResponse,
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/html',
      );
      expect(mockResponse.send).toHaveBeenCalledWith(
        '<html>Subscription Page</html>',
      );
    });

    it('должен бросить 404, если подписка не найдена', async () => {
      mockTunnelRepo.findOne.mockResolvedValue(mockTunnel);
      mockSubRepo.findOne.mockResolvedValue(null);

      await expect(
        controller.getRelaySubscription(
          'non-existent',
          '1',
          'base64',
          mockRequest,
          mockResponse,
        ),
      ).rejects.toThrow(HttpException);
    });

    it('должен использовать IP туннеля, если домен не указан', async () => {
      const tunnelWithoutDomain = { ...mockTunnel, domain: null };
      mockRequest.headers['user-agent'] = 'curl/7.68.0';
      mockTunnelRepo.findOne.mockResolvedValue(tunnelWithoutDomain);
      mockSubRepo.findOne.mockResolvedValue(mockSubscription);

      await controller.getRelaySubscription(
        'test-uuid',
        '1',
        'base64',
        mockRequest,
        mockResponse,
      );

      expect(mockResponse.send).toHaveBeenCalled();
    });
  });

  describe('patchLink', () => {
    it('должен обновить хост в vmess ссылке', () => {
      const vmessLink =
        'vmess://' +
        Buffer.from(
          JSON.stringify({ add: 'old-host.com', port: '443' }),
        ).toString('base64');

      // Приватный метод, тестируем через controller
      const result = (controller as any).patchLink(vmessLink, 'new-host.com');

      expect(result).toContain('vmess://');
    });

    it('должен обновить хост в vless ссылке', () => {
      const vlessLink = 'vless://abc@old-host.com:443';

      const result = (controller as any).patchLink(vlessLink, 'new-host.com');

      expect(result).toBe('vless://abc@new-host.com:443');
    });

    it('должен обновить хост в trojan ссылке', () => {
      const trojanLink = 'trojan://pass@old-host.com:443';

      const result = (controller as any).patchLink(trojanLink, 'new-host.com');

      expect(result).toBe('trojan://pass@new-host.com:443');
    });

    it('должен обновить хост в hy2 ссылке', () => {
      const hy2Link = 'hy2://pass@old-host.com:443';

      const result = (controller as any).patchLink(hy2Link, 'new-host.com');

      expect(result).toBe('hy2://pass@new-host.com:443');
    });

    it('должен вернуть ссылку без изменений для неизвестного протокола', () => {
      const unknownLink = 'unknown://abc@host.com:443';

      const result = (controller as any).patchLink(unknownLink, 'new-host.com');

      expect(result).toBe(unknownLink);
    });

    it('должен вернуть vmess ссылку без изменений при ошибке парсинга', () => {
      const invalidVmssLink = 'vmess://invalid-base64!@#';

      const result = (controller as any).patchLink(
        invalidVmssLink,
        'new-host.com',
      );

      expect(result).toBe(invalidVmssLink);
    });
  });
});
