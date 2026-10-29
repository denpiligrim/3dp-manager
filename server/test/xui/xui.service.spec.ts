import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { XuiService } from 'src/xui/xui.service';
import { Setting } from 'src/settings/entities/setting.entity';
import { SessionService } from 'src/session/session.service';
import axios from 'axios';
import { Node, NodeAuthType } from 'src/nodes/entities/node.entity';

jest.mock('axios');

describe('XuiService', () => {
  let service: XuiService;

  const mockSettingsRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockSessionService = {
    getCookie: jest.fn(),
    setFromHeaders: jest.fn(),
    clear: jest.fn(),
  };

  const mockAxiosInstance = {
    get: jest.fn(),
    post: jest.fn(),
    defaults: { baseURL: '', headers: { common: {} } },
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };

  beforeEach(async () => {
    mockAxiosInstance.defaults.headers.common = {};
    (axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        XuiService,
        {
          provide: getRepositoryToken(Setting),
          useValue: mockSettingsRepo,
        },
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
      ],
    }).compile();

    service = module.get<XuiService>(XuiService);
    settingsRepo = module.get<Repository<Setting>>(getRepositoryToken(Setting));
    sessionService = module.get<SessionService>(SessionService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('CSRF compatibility', () => {
    const node = {
      url: 'https://panel.example/base',
      authType: NodeAuthType.Password,
      login: 'user',
      password: 'pass',
    } as Node;

    it('sends the pre-login token and refreshes the session token for mutations', async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({
          status: 200,
          data: { obj: 'pre-token' },
          headers: {
            'set-cookie': ['sid=before; Path=/', 'other=keep; HttpOnly'],
          },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { obj: 'post-token' },
          headers: {},
        });
      mockAxiosInstance.post
        .mockResolvedValueOnce({
          data: { success: true },
          headers: { 'set-cookie': ['sid=after; Path=/'] },
        })
        .mockResolvedValueOnce({ data: { success: true, obj: { id: 42 } } });
      expect(await service.addInbound({ port: 443 }, node)).toBe(42);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/login',
        { username: 'user', password: 'pass' },
        {
          headers: {
            Cookie: 'sid=before; other=keep',
            'X-CSRF-Token': 'pre-token',
          },
        },
      );
      expect(mockAxiosInstance.defaults.headers.common).toEqual({
        Cookie: 'sid=after; other=keep',
        'X-CSRF-Token': 'post-token',
      });
    });

    it('accepts old panels without a CSRF endpoint', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        status: 404,
        data: {},
        headers: {},
      });
      mockAxiosInstance.post
        .mockResolvedValueOnce({
          data: { success: true },
          headers: { 'set-cookie': ['sid=old; Path=/'] },
        })
        .mockResolvedValueOnce({ data: { success: true, obj: { id: 42 } } });
      expect(await service.addInbound({ port: 443 }, node)).toBe(42);
      expect(mockAxiosInstance.defaults.headers.common).toEqual({
        Cookie: 'sid=old',
      });
    });

    it('does not reuse a token from the pre-login session if refresh fails', async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({
          status: 200,
          data: { obj: 'pre-token' },
          headers: {},
        })
        .mockRejectedValueOnce(new Error('Unavailable'));
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { success: true },
        headers: { 'set-cookie': ['sid=new'] },
      });
      expect(await service.addInbound({ port: 443 }, node)).toBeNull();
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });

    it('uses API tokens without password login or CSRF negotiation', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { success: true, obj: { id: 42 } },
      });
      expect(
        await service.addInbound({ port: 443 }, {
          ...node,
          authType: NodeAuthType.Token,
          token: 'api-token',
        } as Node),
      ).toBe(42);
      expect(mockAxiosInstance.get).not.toHaveBeenCalled();
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
      expect(mockAxiosInstance.defaults.headers.common).toEqual({
        Authorization: 'Bearer api-token',
      });
    });
  });

  describe('login', () => {
    it('shares concurrent login attempts and refreshes the default-session CSRF token', async () => {
      mockSettingsRepo.find.mockResolvedValue([
        { key: 'xui_url', value: 'https://default.example' },
        { key: 'xui_login', value: 'user' },
        { key: 'xui_password', value: 'pass' },
      ]);
      mockAxiosInstance.get
        .mockResolvedValueOnce({
          status: 200,
          data: { obj: 'before' },
          headers: { 'set-cookie': ['sid=pre'] },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { obj: 'after' },
          headers: {},
        });
      mockAxiosInstance.post.mockResolvedValue({
        data: { success: true },
        headers: { 'set-cookie': ['sid=post'] },
      });
      expect(await Promise.all([service.login(), service.login()])).toEqual([
        true,
        true,
      ]);
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
      mockSessionService.getCookie.mockReturnValue('sid=post');
      const [interceptor] = mockAxiosInstance.interceptors.request.use.mock
        .calls[0] as [
        (config: { headers: Record<string, string> }) => {
          headers: Record<string, string>;
        },
      ];
      expect(interceptor({ headers: {} }).headers).toEqual({
        Cookie: 'sid=post',
        'X-CSRF-Token': 'after',
      });
    });

    it('должен вернуть false, если настройки не заполнены', async () => {
      mockSettingsRepo.find.mockResolvedValue([]);

      const result = await service.login();

      expect(result).toBe(false);
    });

    it('должен вернуть true при успешном логине', async () => {
      mockSettingsRepo.find.mockResolvedValue([
        { key: 'xui_url', value: 'http://localhost:3100' },
        { key: 'xui_login', value: 'admin' },
        { key: 'xui_password', value: 'password' },
      ]);

      mockAxiosInstance.post.mockResolvedValue({
        data: { success: true },
        headers: {
          'set-cookie': ['session=abc123'],
        },
      });

      const result = await service.login();

      expect(result).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/login', {
        username: 'admin',
        password: 'password',
      });
    });

    it('должен вернуть false при ошибке логина', async () => {
      mockSettingsRepo.find.mockResolvedValue([
        { key: 'xui_url', value: 'http://localhost:3100' },
        { key: 'xui_login', value: 'admin' },
        { key: 'xui_password', value: 'password' },
      ]);

      mockAxiosInstance.post.mockRejectedValue(new Error('Network error'));

      const result = await service.login();

      expect(result).toBe(false);
    });

    it('должен вернуть false, если нет cookie в ответе', async () => {
      mockSettingsRepo.find.mockResolvedValue([
        { key: 'xui_url', value: 'http://localhost:3100' },
        { key: 'xui_login', value: 'admin' },
        { key: 'xui_password', value: 'password' },
      ]);

      mockAxiosInstance.post.mockResolvedValue({
        headers: {},
      });

      const result = await service.login();

      expect(result).toBe(false);
    });
  });

  describe('checkConnection', () => {
    it('должен вернуть false при ошибке подключения', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('Connection failed'));

      const result = await service.checkConnection(
        'http://localhost:3100',
        'admin',
        'password',
      );

      expect(result).toBe(false);
    });
  });

  describe('addInbound', () => {
    it('должен вернуть null при ошибке', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('API error'));

      const result = await service.addInbound(
        {} as unknown as { port: number },
      );

      expect(result).toBeNull();
    });
  });

  describe('deleteInbound', () => {
    it('должен удалить инбаунд', async () => {
      mockSettingsRepo.find.mockResolvedValue([
        { key: 'xui_url', value: 'http://localhost:3100' },
        { key: 'xui_login', value: 'admin' },
        { key: 'xui_password', value: 'password' },
      ]);
      mockAxiosInstance.post
        .mockResolvedValueOnce({
          data: { success: true },
          headers: { 'set-cookie': ['session=abc123'] },
        })
        .mockResolvedValueOnce({ data: { success: true } });

      await service.deleteInbound(101);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/panel/api/inbounds/del/101',
      );
    });

    it('должен обработать ошибку удаления', async () => {
      mockSettingsRepo.find.mockResolvedValue([
        { key: 'xui_url', value: 'http://localhost:3100' },
        { key: 'xui_login', value: 'admin' },
        { key: 'xui_password', value: 'password' },
      ]);
      mockAxiosInstance.post
        .mockResolvedValueOnce({
          data: { success: true },
          headers: { 'set-cookie': ['session=abc123'] },
        })
        .mockRejectedValueOnce(new Error('Not found'));

      await service.deleteInbound(999);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/panel/api/inbounds/del/999',
      );
    });
  });

  describe('getNewX25519Cert', () => {
    it('должен получить Reality ключи', async () => {
      mockSettingsRepo.find.mockResolvedValue([
        { key: 'xui_url', value: 'http://localhost:3100' },
        { key: 'xui_login', value: 'admin' },
        { key: 'xui_password', value: 'password' },
      ]);
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { success: true },
        headers: { 'set-cookie': ['session=abc123'] },
      });
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          success: true,
          obj: {
            publicKey: 'pub-key',
            privateKey: 'priv-key',
          },
        },
      });

      const result = await service.getNewX25519Cert();

      expect(result).toEqual({
        publicKey: 'pub-key',
        privateKey: 'priv-key',
      });
    });

    it('должен вернуть null при ошибке', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('API error'));

      const result = await service.getNewX25519Cert();

      expect(result).toBeNull();
    });
  });
});
