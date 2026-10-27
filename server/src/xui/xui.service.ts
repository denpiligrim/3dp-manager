import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios, { AxiosInstance, AxiosError } from 'axios';
import * as https from 'https';
import * as http from 'http';
import { Setting } from '../settings/entities/setting.entity';
import {
  XuiResponse,
  XuiCertResult,
  XuiInboundRaw,
  XuiDiscoveredNode,
} from './xui.types';
import { SessionService } from '../session/session.service';
import { Node, NodeAuthType } from '../nodes/entities/node.entity';

interface LoginResponse {
  success: boolean;
}

@Injectable()
export class XuiService {
  private readonly logger = new Logger(XuiService.name);
  private api: AxiosInstance;
  private csrfToken = '';

  constructor(
    @InjectRepository(Setting)
    private settingsRepo: Repository<Setting>,
    private sessionService: SessionService,
  ) {
    this.api = axios.create({
      timeout: 15000,
      proxy: false,
      withCredentials: true,
    });

    this.api.interceptors.request.use((config) => {
      const cookie = this.sessionService.getCookie();
      if (cookie) {
        config.headers['Cookie'] = cookie;
      }
      if (this.csrfToken) {
        config.headers['X-CSRF-Token'] = this.csrfToken;
      }
      return config;
    });
  }

  private getNodeBaseUrl(node: Node): string {
    if (node.url) {
      return node.url.replace(/\/+$/, '');
    }

    return `${node.protocol}://${node.host}:${node.port}`.replace(/\/+$/, '');
  }

  private async getSettings() {
    const settings = await this.settingsRepo.find();
    const config: Record<string, string> = {};
    settings.forEach((s) => (config[s.key] = s.value));
    return config;
  }

  private createApi(baseURL?: string): AxiosInstance {
    return axios.create({
      baseURL,
      timeout: 15000,
      proxy: false,
      ...this.getAgentConfig(baseURL),
      withCredentials: true,
    });
  }

  private getAgentConfig(baseURL?: string) {
    if (!baseURL || baseURL.startsWith('https://')) {
      return { httpsAgent: new https.Agent({ rejectUnauthorized: false }) };
    }

    return { httpAgent: new http.Agent() };
  }

  private mergeCookies(current: string, setCookie?: string[] | null): string {
    if (!setCookie?.length) return current;

    const jar = new Map<string, string>();
    for (const part of current.split('; ').filter(Boolean)) {
      const eq = part.indexOf('=');
      if (eq > 0) jar.set(part.slice(0, eq), part.slice(eq + 1));
    }
    for (const raw of setCookie) {
      const first = raw.split(';')[0];
      const eq = first.indexOf('=');
      if (eq > 0) jar.set(first.slice(0, eq).trim(), first.slice(eq + 1));
    }

    return [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  /**
   * 3x-ui >= v3.6.0 защищает POST /login и все мутации /panel/api/* через
   * CSRFMiddleware. Токен привязан к сессионной cookie, поэтому cookie и токен
   * всегда должны идти вместе. Старые панели отвечают 404 — это не ошибка,
   * просто CSRF там не нужен.
   */
  private async fetchCsrfToken(
    api: AxiosInstance,
    cookie: string,
  ): Promise<{ token: string; cookie: string }> {
    try {
      const res = await api.get<XuiResponse<string>>('/csrf-token', {
        headers: cookie ? { Cookie: cookie } : undefined,
        validateStatus: () => true,
      });

      const merged = this.mergeCookies(cookie, res.headers['set-cookie']);
      const token =
        res.status === 200 && typeof res.data?.obj === 'string'
          ? res.data.obj
          : '';

      return { token, cookie: merged };
    } catch {
      return { token: '', cookie };
    }
  }

  private async createAuthenticatedApi(node?: Node): Promise<AxiosInstance | null> {
    if (!node) {
      const success = await this.login();
      return success ? this.api : null;
    }

    const api = this.createApi(this.getNodeBaseUrl(node));

    if (node.authType === NodeAuthType.Token) {
      if (!node.token) return null;
      api.defaults.headers.common.Authorization = `Bearer ${node.token}`;
      return api;
    }

    if (!node.login || !node.password) return null;

    // Токен CSRF нужно получить до логина: сам POST /login тоже под защитой.
    const pre = await this.fetchCsrfToken(api, '');

    const res = await api.post<LoginResponse>(
      '/login',
      {
        username: node.login,
        password: node.password,
      },
      {
        headers: {
          ...(pre.cookie ? { Cookie: pre.cookie } : {}),
          ...(pre.token ? { 'X-CSRF-Token': pre.token } : {}),
        },
      },
    );

    if (!res.data?.success || !res.headers['set-cookie']) {
      return null;
    }

    // Идентификатор сессии меняется при логине — перевыпускаем токен под новую сессию.
    const post = await this.fetchCsrfToken(
      api,
      this.mergeCookies(pre.cookie, res.headers['set-cookie']),
    );

    api.defaults.headers.common.Cookie = post.cookie;
    const token = post.token || pre.token;
    if (token) {
      api.defaults.headers.common['X-CSRF-Token'] = token;
    }

    return api;
  }

  private parseVersion(headers: Record<string, unknown>, data: unknown): string | undefined {
    const headerVersion = headers['x-ui-version'] || headers['x-3x-ui-version'];
    if (typeof headerVersion === 'string') return headerVersion;

    if (data && typeof data === 'object' && 'version' in data) {
      const version = (data as { version?: unknown }).version;
      return typeof version === 'string' ? version : undefined;
    }

    return undefined;
  }

  async login() {
    try {
      const config = await this.getSettings();
      if (
        !config['xui_url'] ||
        !config['xui_login'] ||
        !config['xui_password']
      ) {
        this.logger.warn('Настройки 3x-ui не заполнены в БД');
        return false;
      }

      this.logger.log(`Attempting login to 3x-ui: ${config['xui_url']}`);
      this.api.defaults.baseURL = config['xui_url'];
      const agentConfig = this.getAgentConfig(config['xui_url']);
      this.api.defaults.httpAgent = agentConfig.httpAgent;
      this.api.defaults.httpsAgent = agentConfig.httpsAgent;

      // Токен CSRF нужно получить до логина: сам POST /login тоже под защитой.
      this.csrfToken = '';
      const pre = await this.fetchCsrfToken(this.api, '');
      if (pre.cookie) {
        this.sessionService.setFromHeaders(pre.cookie.split('; '));
      }
      this.csrfToken = pre.token;

      const res = await this.api.post<LoginResponse>('/login', {
        username: config['xui_login'],
        password: config['xui_password'],
      });

      if (res.headers['set-cookie']) {
        const merged = this.mergeCookies(pre.cookie, res.headers['set-cookie']);
        this.sessionService.setFromHeaders(merged.split('; '));

        // Идентификатор сессии меняется при логине — перевыпускаем токен.
        const post = await this.fetchCsrfToken(this.api, merged);
        if (post.cookie) {
          this.sessionService.setFromHeaders(post.cookie.split('; '));
        }
        this.csrfToken = post.token || pre.token;

        this.logger.log('3x-ui login successful');
        return true;
      } else {
        this.logger.warn('3x-ui login failed: No cookie received');
      }
    } catch (e) {
      const error = e as AxiosError;
      this.logger.error(`3x-ui login error: ${error.message}`);
    }
    return false;
  }

  async addInbound(
    inboundConfig: { port: number; [key: string]: unknown } | XuiInboundRaw,
    node?: Node,
  ): Promise<number | null> {
    let attempts = 0;
    const maxAttempts = 3;

    this.logger.log(`Adding inbound on port ${inboundConfig.port}`);

    while (attempts < maxAttempts) {
      attempts++;

      try {
        const api = await this.createAuthenticatedApi(node);
        if (!api) {
          this.logger.error('3x-ui authentication failed before addInbound');
          return null;
        }

        const res = await api.post<XuiResponse<{ id: number }>>(
          '/panel/api/inbounds/add',
          inboundConfig,
        );

        if (res.data?.success) {
          this.logger.log(
            `Inbound created successfully with ID: ${res.data.obj.id}`,
          );
          return res.data.obj.id;
        } else {
          const msg = res.data?.msg || '';

          if (
            msg.toLowerCase().includes('port') &&
            msg.toLowerCase().includes('exists')
          ) {
            this.logger.warn(
              `Попытка ${attempts}/${maxAttempts}: Порт ${inboundConfig.port} занят. Генерируем новый...`,
            );

            inboundConfig.port = Math.floor(
              Math.random() * (60000 - 10000 + 1) + 10000,
            );
          } else {
            this.logger.error(`3x-ui отклонил создание: ${msg}`);
            return null;
          }
        }
      } catch (e) {
        const error = e as AxiosError;
        if (error.response?.status === 401) {
          this.logger.log('Сессия истекла, пробуем релогин...');
          if (!node && (await this.login())) {
            return this.addInbound(inboundConfig);
          }
        }

        if (error.response?.status === 403) {
          this.logger.error(
            'Панель вернула 403 на /panel/api/inbounds/add — отклонён CSRF-токен. ' +
              'Проверьте, что нода авторизуется API-токеном, либо обновите 3dp-manager.',
          );
          return null;
        }

        this.logger.error(
          `Ошибка сети/валидации при добавлении инбаунда: ${error.message}`,
        );
        return null;
      }
    }

    this.logger.error(
      `Не удалось создать инбаунд после ${maxAttempts} попыток смены порта.`,
    );
    return null;
  }

  async deleteInbound(id: number, node?: Node): Promise<boolean> {
    if (!id || id <= 0) {
      this.logger.debug(`Skipping 3x-ui inbound deletion for non-remote id: ${id}`);
      return true;
    }

    try {
      const api = await this.createAuthenticatedApi(node);
      if (!api) {
        this.logger.error(`3x-ui authentication failed before deleting inbound ${id}`);
        return false;
      }
      const res = await api.post<XuiResponse<unknown>>(
        `/panel/api/inbounds/del/${id}`,
      );
      if (!res.data?.success) {
        this.logger.error(
          `3x-ui rejected inbound deletion ${id}: ${res.data?.msg || 'unknown error'}`,
        );
        return false;
      }
      this.logger.debug(`Inbound ${id} deleted`);
      return true;
    } catch (e) {
      const error = e as AxiosError;
      this.logger.error(`Ошибка удаления инбаунда ${id}: ${error.message}`);
    }

    return false;
  }

  async checkConnection(
    url: string,
    username: string,
    pass: string,
  ): Promise<boolean> {
    try {
      this.logger.log(`Checking connection to 3x-ui: ${url}`);

      const tempApi = axios.create({
        baseURL: url,
        timeout: 5000,
        proxy: false,
        ...this.getAgentConfig(url),
        withCredentials: true,
      });

      const pre = await this.fetchCsrfToken(tempApi, '');

      const res = await tempApi.post<LoginResponse>(
        '/login',
        {
          username: username,
          password: pass,
        },
        {
          headers: {
            ...(pre.cookie ? { Cookie: pre.cookie } : {}),
            ...(pre.token ? { 'X-CSRF-Token': pre.token } : {}),
          },
        },
      );

      if (res.headers['set-cookie'] && res.data?.success) {
        this.logger.log(`Connection to 3x-ui successful: ${url}`);
        return true;
      } else {
        this.logger.warn(
          `Connection failed: Invalid credentials or no cookie received`,
        );
      }
    } catch (error) {
      const axiosError = error as AxiosError;
      this.logger.error(
        `Connection error: ${axiosError.message} (URL: ${url})`,
      );
    }
    return false;
  }

  async checkNodeConnection(
    node: Node,
  ): Promise<{ success: boolean; version?: string }> {
    try {
      const api = await this.createAuthenticatedApi(node);
      if (!api) return { success: false };

      const res = await api.get('/panel/api/inbounds/list');
      return {
        success: true,
        version: this.parseVersion(res.headers as Record<string, unknown>, res.data),
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      this.logger.error(
        `Node connection error: ${axiosError.message} (${node.name})`,
      );
      return { success: false };
    }
  }

  async getNewX25519Cert(node?: Node): Promise<XuiCertResult | null> {
    try {
      const api = await this.createAuthenticatedApi(node);
      if (!api) return null;
      const res = await api.get<XuiResponse<XuiCertResult>>(
        '/panel/api/server/getNewX25519Cert',
      );
      if (res.data?.success && res.data.obj) return res.data.obj;
    } catch {
      this.logger.error('Ошибка получения ключей Reality');
    }
    return null;
  }

  async getNodes(node: Node): Promise<XuiDiscoveredNode[]> {
    try {
      const api = await this.createAuthenticatedApi(node);
      if (!api) return [];

      const res = await api.get<XuiResponse<XuiDiscoveredNode[]>>(
        '/panel/api/nodes/list',
      );

      if (res.data?.success && Array.isArray(res.data.obj)) {
        return res.data.obj;
      }
    } catch (error) {
      const axiosError = error as AxiosError;
      this.logger.warn(`Node sync is not available: ${axiosError.message}`);
    }

    return [];
  }
}
