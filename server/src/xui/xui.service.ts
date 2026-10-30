import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios, { AxiosInstance, AxiosError } from 'axios';
import * as https from 'https';
import * as http from 'http';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { OperationsService } from '../operations/operations.service';
import { Setting } from '../settings/entities/setting.entity';
import {
  XuiResponse,
  XuiCertResult,
  XuiInboundRaw,
  XuiDiscoveredNode,
  XuiInboundClient,
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
  private loginPromise?: Promise<boolean>;
  private readonly httpAgent = new http.Agent({
    keepAlive: true,
    maxSockets: 2,
    maxFreeSockets: 1,
  });
  private readonly httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 2,
    maxFreeSockets: 1,
    rejectUnauthorized: false,
  });
  private readonly sessions = new Map<
    string,
    { fingerprint: string; expires: number; api: Promise<AxiosInstance | null> }
  >();
  private readonly mutations = new Map<string, Promise<unknown>>();
  private readonly lastMutation = new Map<string, number>();

  constructor(
    @InjectRepository(Setting)
    private settingsRepo: Repository<Setting>,
    private sessionService: SessionService,
    @Optional() private readonly operations?: OperationsService,
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
      return { httpsAgent: this.httpsAgent };
    }

    return { httpAgent: this.httpAgent };
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

  private async createAuthenticatedApi(
    node?: Node,
  ): Promise<AxiosInstance | null> {
    const key = node?.id || 'default';
    const defaults = node ? undefined : await this.getSettings();
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify(
          node
            ? [
                node.url,
                node.host,
                node.port,
                node.protocol,
                node.authType,
                node.login,
                node.password,
                node.token,
              ]
            : [defaults?.xui_url, defaults?.xui_login, defaults?.xui_password],
        ),
      )
      .digest('hex');
    const cached = this.sessions.get(key);
    if (
      cached &&
      cached.expires > Date.now() &&
      cached.fingerprint === fingerprint
    )
      return cached.api;
    if (this.sessions.size >= 100)
      this.sessions.delete(this.sessions.keys().next().value!);
    const api = this.authenticate(node).catch((error: unknown) => {
      this.sessions.delete(key);
      throw error;
    });
    this.sessions.set(key, { fingerprint, expires: Date.now() + 300000, api });
    const result = await api;
    if (!result) this.sessions.delete(key);
    return result;
  }

  private async authenticate(node?: Node): Promise<AxiosInstance | null> {
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
    if (pre.token && !post.token) return null;
    const token = post.token;
    if (token) {
      api.defaults.headers.common['X-CSRF-Token'] = token;
    }

    return api;
  }

  private parseVersion(
    headers: Record<string, unknown>,
    data: unknown,
  ): string | undefined {
    const headerVersion = headers['x-ui-version'] || headers['x-3x-ui-version'];
    if (typeof headerVersion === 'string') return headerVersion;

    if (data && typeof data === 'object' && 'version' in data) {
      const version = (data as { version?: unknown }).version;
      return typeof version === 'string' ? version : undefined;
    }

    return undefined;
  }

  async login(): Promise<boolean> {
    // Share an in-flight login so cookie and CSRF token rotate together.
    if (this.loginPromise === undefined) {
      this.loginPromise = this.loginWithPassword().finally(() => {
        this.loginPromise = undefined;
      });
    }
    return this.loginPromise;
  }

  private async loginWithPassword(): Promise<boolean> {
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
      this.sessionService.clear();
      const pre = await this.fetchCsrfToken(this.api, '');
      if (pre.cookie) {
        this.sessionService.setFromHeaders(pre.cookie.split('; '));
      }
      this.csrfToken = pre.token;

      const res = await this.api.post<LoginResponse>('/login', {
        username: config['xui_login'],
        password: config['xui_password'],
      });

      if (res.data?.success && res.headers['set-cookie']) {
        const merged = this.mergeCookies(pre.cookie, res.headers['set-cookie']);
        this.sessionService.setFromHeaders(merged.split('; '));

        // Идентификатор сессии меняется при логине — перевыпускаем токен.
        const post = await this.fetchCsrfToken(this.api, merged);
        if (post.cookie) {
          this.sessionService.setFromHeaders(post.cookie.split('; '));
        }
        if (pre.token && !post.token) return false;
        this.csrfToken = post.token;

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

  private wait(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  private async withMutation<T>(
    node: Node | undefined,
    action: () => Promise<T>,
  ): Promise<T> {
    const key = node?.id || 'default';
    const previous = this.mutations.get(key) || Promise.resolve();
    const task = previous.catch(() => undefined).then(action);
    this.mutations.set(key, task);
    try {
      return await task;
    } finally {
      if (this.mutations.get(key) === task) this.mutations.delete(key);
    }
  }

  private async pace(node?: Node) {
    const key = node?.id || 'default';
    const interval = Math.max(
      100,
      Math.min(5000, Number(process.env.PANEL_MUTATION_INTERVAL_MS) || 300),
    );
    await this.wait(
      Math.max(0, interval - (Date.now() - (this.lastMutation.get(key) || 0))),
    );
    if (this.lastMutation.size >= 1000)
      this.lastMutation.delete(this.lastMutation.keys().next().value!);
    this.lastMutation.set(key, Date.now());
    await this.operations?.assertOwnership();
  }

  private transient(error: unknown) {
    const status = (error as AxiosError)?.response?.status;
    return !status || status === 408 || status === 429 || status >= 500;
  }

  private transientMessage(message: string) {
    return /busy|locked|temporar|timeout|timed out|try again|unavailable|database.*lock|internal|server error|unknown error/i.test(
      message,
    );
  }

  private async retryNotice(kind: string, attempt: number, node?: Node) {
    this.logger.warn(
      `3x-ui ${kind}: retry ${attempt + 1}/3 (${node?.name || 'default'})`,
    );
    await this.operations?.record(
      'inbound.retry',
      'Повтор запроса к 3x-ui',
      'warning',
      `Операция: ${kind}. Следующая попытка ${attempt + 1}/3.`,
      node?.name || 'Основная панель',
    );
    await this.wait(500 * 2 ** (attempt - 1) + Math.floor(Math.random() * 150));
  }

  private async remoteInbounds(
    api: AxiosInstance,
  ): Promise<Array<{ id: number; tag?: string; port?: number }> | null> {
    try {
      const res = await api.get<
        XuiResponse<Array<{ id: number; tag?: string; port?: number }>>
      >('/panel/api/inbounds/list');
      return res.data?.success && Array.isArray(res.data.obj)
        ? res.data.obj
        : null;
    } catch {
      return null;
    }
  }

  async addInbound(
    inboundConfig: { port: number; [key: string]: unknown } | XuiInboundRaw,
    node?: Node,
  ): Promise<number | null> {
    return this.withMutation(node, async () => {
      // A unique tag identifies this logical creation even if its response is lost.
      const tag = `3dp-${randomUUID()}`;
      Object.assign(inboundConfig, { tag });
      for (let attempt = 1; attempt <= 3; attempt++) {
        let api: AxiosInstance | null = null;
        let sent = false;
        try {
          api = await this.createAuthenticatedApi(node);
          if (!api) return null;
          await this.pace(node);
          sent = true;
          const res = await api.post<XuiResponse<{ id: number }>>(
            '/panel/api/inbounds/add',
            inboundConfig,
          );
          if (res.data?.success && res.data.obj?.id) return res.data.obj.id;
          const message = res.data?.msg || '';
          if (/port/i.test(message) && /exists|used|occupied/i.test(message)) {
            inboundConfig.port = Math.floor(Math.random() * 50000) + 10000;
          } else if (!this.transientMessage(message)) {
            this.logger.error(
              '3x-ui rejected inbound creation (check configuration)',
            );
            return null;
          }
        } catch (error) {
          const status = (error as AxiosError)?.response?.status;
          if (status === 401 || status === 403) {
            this.sessions.delete(node?.id || 'default');
          } else if (!this.transient(error)) {
            return null;
          } else {
            if (!sent) {
              if (attempt < 3) await this.retryNotice('create', attempt, node);
              continue;
            }
            // Reconcile even after the last permitted POST.
            const list = api ? await this.remoteInbounds(api) : null;
            if (!list) {
              await this.operations?.record(
                'inbound.uncertain',
                'Неизвестный результат создания инбаунда',
                'warning',
                `Ответ потерян, повтор не отправлен. Проверьте на панели tag ${tag}, порт ${inboundConfig.port}.`,
                node?.name || 'Основная панель',
              );
              return null;
            }
            const existing = list.find((item) => item.tag === tag);
            if (existing) return existing.id;
          }
        }
        if (attempt < 3) await this.retryNotice('create', attempt, node);
      }
      this.logger.error('Inbound creation failed after 3 attempts');
      return null;
    });
  }

  async prepareSubscriptionClient(
    email: string,
    autoCreate: boolean,
    node?: Node,
  ): Promise<XuiInboundClient> {
    const api = await this.createAuthenticatedApi(node);
    if (!api) throw new Error('Не удалось авторизоваться в 3x-ui');
    if (!autoCreate && /^\d+$/.test(email)) {
      const list = await api.get<
        XuiResponse<Array<{ client: { id: number; email: string } }>>
      >('/panel/api/clients/list');
      const match =
        list.data?.success &&
        list.data.obj?.find((item) => String(item.client.id) === email);
      if (!match)
        throw new Error(
          `Клиент ${email} не найден на ноде ${node?.name || 'по умолчанию'}`,
        );
      email = match.client.email;
    }
    if (autoCreate) {
      await this.operations?.assertOwnership();
      // Import supports unattached clients, unlike /clients/add, which requires
      // an existing inbound. Existing emails are skipped without changing secrets.
      const imported = await api.post<XuiResponse>(
        '/panel/api/clients/import',
        {
          data: JSON.stringify([
            {
              client: {
                email,
                id: randomUUID(),
                password: randomBytes(32).toString('base64'),
                auth: randomUUID(),
                subId: email,
                enable: true,
                flow: '',
                totalGB: 0,
                expiryTime: 0,
                limitIp: 0,
              },
              inboundIds: [],
            },
          ]),
        },
      );
      if (!imported.data?.success)
        throw new Error(
          `Не удалось создать клиента на ноде ${node?.name || 'по умолчанию'}`,
        );
    }
    return this.getSubscriptionClient(api, email, node);
  }

  private async getSubscriptionClient(
    api: AxiosInstance,
    email: string,
    node?: Node,
  ): Promise<XuiInboundClient> {
    const res = await api.get<
      XuiResponse<{
        client: Omit<XuiInboundClient, 'id'> & { id?: number; uuid?: string };
      }>
    >(`/panel/api/clients/get/${encodeURIComponent(email)}`);
    const client = res.data?.obj?.client;
    if (!res.data?.success || !client || client.email !== email) {
      throw new Error(
        `Клиент ${email} не найден на ноде ${node?.name || 'по умолчанию'}`,
      );
    }
    return { ...client, id: client.uuid };
  }

  async getSubscriptionUsage(email: string, node?: Node) {
    const api = await this.createAuthenticatedApi(node);
    if (!api) throw new Error('Не удалось авторизоваться в 3x-ui');
    const details = await api.get<
      XuiResponse<{
        client: { totalGB?: number; expiryTime?: number };
        usedTraffic?: number;
      }>
    >(`/panel/api/clients/get/${encodeURIComponent(email)}`);
    if (!details.data?.success || !details.data.obj?.client)
      throw new Error('Не удалось получить данные клиента');
    const traffic = await api.get<XuiResponse<{ up?: number; down?: number }>>(
      `/panel/api/clients/traffic/${encodeURIComponent(email)}`,
    );
    const client = details.data.obj.client;
    const count = (value?: number) =>
      Number.isFinite(value) ? Math.max(0, Math.floor(value!)) : 0;
    return {
      upload: traffic.data?.success ? count(traffic.data.obj?.up) : 0,
      download: traffic.data?.success
        ? count(traffic.data.obj?.down)
        : count(details.data.obj.usedTraffic),
      total: count(client.totalGB),
      expire:
        client.expiryTime! > 0 ? Math.floor(client.expiryTime! / 1000) : 0,
    };
  }

  async addInboundForClient(
    config: XuiInboundRaw,
    client: XuiInboundClient,
    node?: Node,
  ): Promise<number | null> {
    const settings = JSON.parse(config.settings) as {
      clients?: XuiInboundClient[];
    };
    const originalClient = settings.clients?.[0] || {};
    const emptyConfig = {
      ...config,
      settings: JSON.stringify({ ...settings, clients: [] }),
    };
    const id = await this.addInbound(emptyConfig, node);
    config.port = emptyConfig.port;
    if (!id) return null;
    try {
      const api = await this.createAuthenticatedApi(node);
      if (!api) throw new Error('3x-ui authentication failed');
      await this.pace(node);
      const attached = await api.post<XuiResponse>(
        `/panel/api/clients/${encodeURIComponent(client.email!)}/attach`,
        { inboundIds: [id] },
      );
      if (!attached.data?.success)
        throw new Error('3x-ui client attachment failed');
      // Read back protocol defaults generated by the panel (especially SS keys).
      const stored = await this.getSubscriptionClient(api, client.email!, node);
      config.settings = JSON.stringify({
        ...settings,
        clients: [{ ...originalClient, ...stored }],
      });
      return id;
    } catch {
      await this.deleteInbound(id, node);
      this.logger.error(
        `Не удалось привязать клиента к инбаунду ${id} на ноде ${node?.name || 'по умолчанию'}`,
      );
      return null;
    }
  }

  async deleteInbound(id: number, node?: Node): Promise<boolean> {
    if (!id || id <= 0) return true;
    return this.withMutation(node, async () => {
      for (let attempt = 1; attempt <= 3; attempt++) {
        let api: AxiosInstance | null = null;
        try {
          api = await this.createAuthenticatedApi(node);
          if (!api) return false;
          await this.pace(node);
          const res = await api.post<XuiResponse>(
            `/panel/api/inbounds/del/${id}`,
          );
          if (res.data?.success) return true;
          const list = await this.remoteInbounds(api);
          if (list && !list.some((item) => item.id === id)) return true;
          const message = res.data?.msg || '';
          if (
            !this.transientMessage(message) &&
            !/not found|not exist/i.test(message)
          )
            return false;
        } catch (error) {
          const status = (error as AxiosError)?.response?.status;
          if (status === 401 || status === 403) {
            this.sessions.delete(node?.id || 'default');
          } else {
            const list = api ? await this.remoteInbounds(api) : null;
            if (list && !list.some((item) => item.id === id)) return true;
            if (!this.transient(error)) return false;
          }
        }
        if (attempt < 3) await this.retryNotice('delete', attempt, node);
      }
      this.logger.error(`Inbound ${id} deletion failed after 3 attempts`);
      return false;
    });
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
        version: this.parseVersion(
          res.headers as Record<string, unknown>,
          res.data,
        ),
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
