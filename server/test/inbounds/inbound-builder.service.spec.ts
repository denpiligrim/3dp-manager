/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Test, TestingModule } from '@nestjs/testing';
import { InboundBuilderService } from 'src/inbounds/inbound-builder.service';

// Mock crypto.randomBytes для детерминированных тестов
jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockReturnValue(Buffer.from('abcd1234', 'hex')),
  randomFillSync: jest.fn((buffer: Buffer) => {
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = i;
    }
    return buffer;
  }),
}));

describe('InboundBuilderService', () => {
  let service: InboundBuilderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InboundBuilderService],
    }).compile();

    service = module.get<InboundBuilderService>(InboundBuilderService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    [
      'VLESS Reality TCP',
      () =>
        service.buildVlessRealityTcp({
          port: 443,
          uuid: 'test-uuid',
          sni: 'example.com',
          privateKey: 'private-key',
          publicKey: 'public-key',
        }),
    ],
    [
      'VLESS Reality XHTTP',
      () =>
        service.buildVlessRealityXhttp({
          port: 8443,
          uuid: 'test-uuid',
          sni: 'example.com',
          privateKey: 'private-key',
          publicKey: 'public-key',
        }),
    ],
    [
      'VLESS Reality gRPC',
      () =>
        service.buildVlessRealityGrpc({
          port: 2053,
          uuid: 'test-uuid',
          sni: 'example.com',
          privateKey: 'private-key',
          publicKey: 'public-key',
        }),
    ],
    [
      'VLESS WebSocket',
      () =>
        service.buildVlessWs({
          port: 10000,
          uuid: 'test-uuid',
          sni: 'example.com',
        }),
    ],
    [
      'VMess TCP',
      () =>
        service.buildVmessTcp({
          port: 20000,
          uuid: 'test-uuid',
        }),
    ],
    [
      'Shadowsocks TCP',
      () =>
        service.buildShadowsocksTcp({
          port: 30000,
          uuid: 'test-uuid',
        }),
    ],
    [
      'Trojan Reality TCP',
      () =>
        service.buildTrojanRealityTcp({
          port: 443,
          uuid: 'test-uuid',
          sni: 'example.com',
          privateKey: 'private-key',
          publicKey: 'public-key',
        }),
    ],
  ])(
    'не должен передавать необязательный tgId для %s',
    (_name, buildInbound) => {
      const settings = JSON.parse(buildInbound().settings);

      expect(settings.clients[0]).not.toHaveProperty('tgId');
    },
  );

  describe('buildVlessRealityTcp', () => {
    const params = {
      port: 443,
      uuid: 'test-uuid-123',
      sni: 'ya.ru',
      privateKey: 'private-key',
      publicKey: 'public-key',
    };

    it('должен создать конфиг vless-tcp-reality', () => {
      const result = service.buildVlessRealityTcp(params);

      expect(result).toMatchObject({
        enable: true,
        port: 443,
        protocol: 'vless',
        remark: 'vless-tcp-reality',
      });

      const settings = JSON.parse(result.settings);
      expect(settings.clients[0].id).toBe('test-uuid-123');
      expect(settings.clients[0].flow).toBe('xtls-rprx-vision');
    });

    it('должен установить Reality настройки', () => {
      const result = service.buildVlessRealityTcp(params);

      const streamSettings = JSON.parse(result.streamSettings);
      expect(streamSettings.security).toBe('reality');
      expect(streamSettings.realitySettings.target).toBe('ya.ru:443');
      expect(streamSettings.realitySettings.serverNames).toContain('ya.ru');
      expect(streamSettings.realitySettings.privateKey).toBe('private-key');
    });

    it('должен сгенерировать shortIds', () => {
      const result = service.buildVlessRealityTcp(params);

      const streamSettings = JSON.parse(result.streamSettings);
      expect(streamSettings.realitySettings.shortIds).toHaveLength(2);
    });
  });

  describe('buildVlessRealityXhttp', () => {
    const params = {
      port: 8443,
      uuid: 'test-uuid-456',
      sni: 'vk.com',
      privateKey: 'private-key',
      publicKey: 'public-key',
    };

    it('должен создать конфиг vless-xhttp-reality', () => {
      const result = service.buildVlessRealityXhttp(params);

      expect(result).toMatchObject({
        enable: true,
        port: 8443,
        protocol: 'vless',
        remark: 'vless-xhttp-reality',
      });

      const settings = JSON.parse(result.settings);
      expect(settings.clients[0].id).toBe('test-uuid-456');
      expect(settings.clients[0].flow).toBe('');
    });

    it('должен установить xhttp настройки', () => {
      const result = service.buildVlessRealityXhttp(params);

      const streamSettings = JSON.parse(result.streamSettings);
      expect(streamSettings.security).toBe('reality');
      expect(streamSettings.network).toBe('xhttp');
    });
  });

  describe('buildVlessRealityGrpc', () => {
    const params = {
      port: 2053,
      uuid: 'test-uuid-789',
      sni: 'ok.ru',
      privateKey: 'private-key',
      publicKey: 'public-key',
    };

    it('должен создать конфиг vless-grpc-reality', () => {
      const result = service.buildVlessRealityGrpc(params);

      expect(result).toMatchObject({
        enable: true,
        port: 2053,
        protocol: 'vless',
        remark: 'vless-grpc-reality',
      });

      const streamSettings = JSON.parse(result.streamSettings);
      expect(streamSettings.network).toBe('grpc');
      expect(streamSettings.grpcSettings?.serviceName).toBeTruthy();
    });
  });

  describe('buildVlessWs', () => {
    const params = {
      port: 10000,
      uuid: 'test-uuid-ws',
      sni: 'ozon.ru',
    };

    it('должен создать конфиг vless-ws', () => {
      const result = service.buildVlessWs(params);

      expect(result).toMatchObject({
        enable: true,
        port: 10000,
        protocol: 'vless',
        remark: 'vless-ws',
      });

      const streamSettings = JSON.parse(result.streamSettings);
      expect(streamSettings.network).toBe('ws');
    });

    it('должен установить ws настройки', () => {
      const result = service.buildVlessWs(params);

      const streamSettings = JSON.parse(result.streamSettings);
      expect(streamSettings.wsSettings?.path).toBe('/');
    });
  });

  describe('buildVmessTcp', () => {
    const params = {
      port: 20000,
      uuid: 'test-uuid-vmess',
    };

    it('должен создать конфиг vmess-tcp', () => {
      const result = service.buildVmessTcp(params);

      expect(result).toMatchObject({
        enable: true,
        port: 20000,
        protocol: 'vmess',
        remark: 'vmess-tcp',
      });

      const settings = JSON.parse(result.settings);
      expect(settings.clients[0].id).toBe('test-uuid-vmess');
    });
  });

  describe('buildShadowsocksTcp', () => {
    const params = {
      port: 30000,
      uuid: 'test-uuid-ss',
    };

    it('должен создать конфиг shadowsocks-tcp', () => {
      const result = service.buildShadowsocksTcp(params);

      expect(result).toMatchObject({
        enable: true,
        port: 30000,
        protocol: 'shadowsocks',
        remark: 'shadowsocks-tcp',
      });

      const settings = JSON.parse(result.settings);
      expect(settings.method).toBe('2022-blake3-aes-256-gcm');
      expect(settings.password).toBeTruthy(); // Генерируется из uuid
    });
  });

  describe('buildTrojanRealityTcp', () => {
    const params = {
      port: 443,
      uuid: 'test-uuid-trojan',
      sni: 'ya.ru',
      privateKey: 'private-key',
      publicKey: 'public-key',
    };

    it('должен создать конфиг trojan-tcp-reality', () => {
      const result = service.buildTrojanRealityTcp(params);

      expect(result).toMatchObject({
        enable: true,
        port: 443,
        protocol: 'trojan',
        remark: 'trojan-tcp-reality',
      });

      const settings = JSON.parse(result.settings);
      expect(settings.clients[0].password).toBeTruthy(); // Генерируется из uuid
    });

    it('должен установить Reality настройки для trojan', () => {
      const result = service.buildTrojanRealityTcp(params);

      const streamSettings = JSON.parse(result.streamSettings);
      expect(streamSettings.security).toBe('reality');
      expect(streamSettings.realitySettings.target).toBe('ya.ru:443');
    });
  });

  describe('buildHysteria2Link', () => {
    beforeEach(() => {
      jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('должен создать ссылку hysteria2', () => {
      const result = service.buildHysteria2Link(
        '192.168.1.1',
        'ya.ru',
        '%F0%9F%92%AF%20hysteria2',
      );

      expect(result).toContain('hy2://');
      expect(result).toContain('192.168.1.1');
      // SNI может быть IP, если конфиг не найден
    });

    it('должен создать ссылку hysteria2 с портом', () => {
      const result = service.buildHysteria2Link(
        '192.168.1.1',
        'ya.ru',
        '%F0%9F%92%AF%20hysteria2',
        443,
      );

      expect(result).toContain(':443');
    });
  });

  describe('buildHysteria2Inbound', () => {
    it('creates 3x-ui hysteria v2 inbound with certificate paths', () => {
      const result = service.buildHysteria2Inbound({
        port: 34443,
        uuid: 'test-auth',
        sni: 'oil.3dp-manager.com',
      });

      expect(result).toMatchObject({
        enable: true,
        listen: '0.0.0.0',
        port: 34443,
        protocol: 'hysteria',
        tag: 'inbound-34443',
      });

      const settings = JSON.parse(result.settings);
      const streamSettings = JSON.parse(result.streamSettings);

      expect(settings.clients[0].auth).toBe('test-auth');
      expect(settings.version).toBe(2);
      expect(streamSettings.network).toBe('hysteria');
      expect(streamSettings.hysteriaSettings.version).toBe(2);
      expect(streamSettings.finalmask.udp[0].type).toBe('salamander');
      expect(streamSettings.tlsSettings.certificates[0].certificateFile).toBe(
        '/etc/letsencrypt/live/oil.3dp-manager.com/fullchain.pem',
      );
      expect(streamSettings.tlsSettings.certificates[0].keyFile).toBe(
        '/etc/letsencrypt/live/oil.3dp-manager.com/privkey.pem',
      );

      const link = service.buildInboundLink(
        result as any,
        'relay.example.com',
        'fallback-auth',
        '%F0%9F%92%AF',
      );
      expect(link).toContain('hy2://test-auth@relay.example.com:34443/');
      expect(link).toContain('sni=oil.3dp-manager.com');
      expect(link).toContain('obfs=salamander');
      expect(link).toContain('obfs-password=abcd1234');
    });
  });

  describe('buildInboundLink', () => {
    const baseInbound = {
      protocol: 'vless',
      port: 443,
      remark: 'vless-tcp-reality',
      settings: JSON.stringify({
        clients: [{ id: 'test-uuid', flow: 'xtls-rprx-vision' }],
      }),
      streamSettings: JSON.stringify({
        network: 'tcp',
        security: 'reality',
        realitySettings: {
          serverNames: ['ya.ru'],
          publicKey: 'public-key',
        },
      }),
    };

    it('должен создать ссылку vless reality', () => {
      const result = service.buildInboundLink(
        baseInbound as any,
        '192.168.1.1',
        'test-uuid',
        '%F0%9F%92%AF',
      );

      expect(result).toContain('vless://');
      expect(result).toContain('192.168.1.1');
      expect(result).toContain('443');
    });

    it('должен создать ссылку vless reality с xhttp', () => {
      const inbound = {
        protocol: 'vless',
        port: 8443,
        remark: 'vless-xhttp-reality',
        settings: JSON.stringify({
          clients: [{ id: 'test-uuid', flow: '' }],
        }),
        streamSettings: JSON.stringify({
          network: 'xhttp',
          security: 'reality',
          realitySettings: {
            serverNames: ['ya.ru'],
            publicKey: 'public-key',
            settings: { publicKey: 'pk', fingerprint: 'random' },
            shortIds: ['abc123'],
          },
          xhttpSettings: {
            path: '/path',
            host: 'ya.ru',
            mode: 'auto',
          },
        }),
      };

      const result = service.buildInboundLink(
        inbound as any,
        '192.168.1.1',
        'test-uuid',
        '%F0%9F%92%AF',
      );

      expect(result).toContain('vless://');
      expect(result).toContain('type=xhttp');
      expect(result).toContain('path=%2Fpath');
    });

    it('должен создать ссылку vless reality с grpc', () => {
      const inbound = {
        protocol: 'vless',
        port: 8443,
        remark: 'vless-grpc-reality',
        settings: JSON.stringify({
          clients: [{ id: 'test-uuid', flow: '' }],
        }),
        streamSettings: JSON.stringify({
          network: 'grpc',
          security: 'reality',
          realitySettings: {
            serverNames: ['ya.ru'],
            publicKey: 'public-key',
            settings: { publicKey: 'pk', fingerprint: 'random' },
            shortIds: ['abc123'],
          },
          grpcSettings: {
            serviceName: 'grpc-service',
            authority: 'ya.ru',
          },
        }),
      };

      const result = service.buildInboundLink(
        inbound as any,
        '192.168.1.1',
        'test-uuid',
        '%F0%9F%92%AF',
      );

      expect(result).toContain('vless://');
      expect(result).toContain('type=grpc');
      expect(result).toContain('serviceName=grpc-service');
    });

    it('должен создать ссылку vless с ws', () => {
      const inbound = {
        protocol: 'vless',
        port: 443,
        remark: 'vless-ws',
        settings: JSON.stringify({
          clients: [{ id: 'test-uuid' }],
        }),
        streamSettings: JSON.stringify({
          network: 'ws',
          security: 'tls',
          wsSettings: {
            path: '/ws',
            headers: { Host: 'example.com' },
          },
        }),
      };

      const result = service.buildInboundLink(
        inbound as any,
        '192.168.1.1',
        'test-uuid',
        '%F0%9F%92%AF',
      );

      expect(result).toContain('vless://');
      expect(result).toContain('type=ws');
      expect(result).toContain('path=%2Fws');
    });

    it('должен создать ссылку vmess', () => {
      const vmessInbound = {
        protocol: 'vmess',
        port: 20000,
        remark: 'vmess-tcp',
        settings: JSON.stringify({
          clients: [{ id: 'test-uuid' }],
        }),
        streamSettings: JSON.stringify({
          network: 'tcp',
        }),
      };

      const result = service.buildInboundLink(
        vmessInbound as any,
        '192.168.1.1',
        'test-uuid',
        '%F0%9F%92%AF',
      );

      expect(result).toContain('vmess://');
    });

    it('должен создать ссылку shadowsocks', () => {
      const ssInbound = {
        protocol: 'shadowsocks',
        port: 30000,
        remark: 'shadowsocks-tcp',
        settings: JSON.stringify({
          method: '2022-blake3-aes-256-gcm',
          password: 'test-password',
          clients: [{ password: 'client-pass' }],
        }),
        streamSettings: JSON.stringify({
          network: 'tcp',
        }),
      };

      const result = service.buildInboundLink(
        ssInbound as any,
        '192.168.1.1',
        '',
        '%F0%9F%92%AF',
      );

      expect(result).toContain('ss://');
    });

    it('должен создать ссылку trojan', () => {
      const trojanInbound = {
        protocol: 'trojan',
        port: 443,
        remark: 'trojan-reality',
        settings: JSON.stringify({
          clients: [{ password: 'trojan-pass' }],
        }),
        streamSettings: JSON.stringify({
          network: 'tcp',
          security: 'reality',
          realitySettings: {
            serverNames: ['ya.ru'],
            publicKey: 'public-key',
            settings: { publicKey: 'pk', fingerprint: 'random' },
            shortIds: ['abc123'],
          },
        }),
      };

      const result = service.buildInboundLink(
        trojanInbound as any,
        '192.168.1.1',
        'trojan-pass',
        '%F0%9F%92%AF',
      );

      expect(result).toContain('trojan://');
      expect(result).toContain('security=reality');
    });

    it('должен вернуть пустую строку для trojan без reality', () => {
      const trojanInbound = {
        protocol: 'trojan',
        port: 443,
        remark: 'trojan',
        settings: JSON.stringify({
          clients: [{ password: 'pass' }],
        }),
        streamSettings: JSON.stringify({
          network: 'tcp',
          security: 'none',
        }),
      };

      const result = service.buildInboundLink(
        trojanInbound as any,
        '192.168.1.1',
        'pass',
        '%F0%9F%92%AF',
      );

      expect(result).toBe('');
    });

    it('должен вернуть пустую строку для vless без reality settings', () => {
      const vlessInbound = {
        protocol: 'vless',
        port: 443,
        remark: 'vless',
        settings: JSON.stringify({
          clients: [{ id: 'uuid' }],
        }),
        streamSettings: JSON.stringify({
          network: 'tcp',
          security: 'reality',
          realitySettings: null,
        }),
      };

      const result = service.buildInboundLink(
        vlessInbound as any,
        '192.168.1.1',
        'uuid',
        '%F0%9F%92%AF',
      );

      expect(result).toBe('');
    });
  });

  describe('generateUuid', () => {
    it('должен сгенерировать UUID', () => {
      const uuid = service.generateUuid();

      expect(uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });
  });
});
