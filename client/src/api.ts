import axios, { AxiosError } from 'axios';
import { Logger } from './utils/logger';
import { pollOperation, type BackgroundOperation } from './utils/operationPolling';
import { updateTaskProgress } from './utils/pendingTask';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // Отправлять cookies
});

// Interceptor для добавления токена к каждому запросу
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  Logger.debug(`${config.method?.toUpperCase()} ${config.url} | Token: ${token ? 'EXISTS' : 'NULL'}`, 'API');
  return config;
});

// Interceptor для ответа
api.interceptors.response.use(
  async (response) => {
    if (response.status === 202 && typeof response.data?.jobId === 'string') {
      const operation = await pollOperation(
        async () => (await api.get<BackgroundOperation>(`/operations/${encodeURIComponent(response.data.jobId)}`)).data,
        updateTaskProgress,
      );
      if (operation.status === 'interrupted' || operation.errorResponse) {
        const data = typeof operation.errorResponse === 'string' ? { message: operation.errorResponse }
          : operation.errorResponse || { message: operation.message || 'Задача прервана. Проверьте её состояние в Журнале.' };
        throw new AxiosError(operation.message, 'ERR_BACKGROUND_OPERATION', response.config, undefined,
          { ...response, status: operation.errorStatus || 500, data });
      }
      return { ...response, status: 200, data: operation.result ?? { success: operation.status === 'success', message: operation.message } };
    }
    Logger.debug(`${response.status} OK (${response.config.method?.toUpperCase()} ${response.config.url})`, 'API');
    return response;
  },
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message || 'Unknown error';
    Logger.error(`ERROR ${status || 'NETWORK'}: ${message} (${error.config?.method?.toUpperCase()} ${error.config?.url})`, 'API');
    return Promise.reject(error);
  }
);

export default api;
