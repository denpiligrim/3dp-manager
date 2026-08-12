import api from '../../api';
import type { NodePayload, NodeRecord } from '../../types/node';

export const nodesApi = {
  async list() {
    const { data } = await api.get<NodeRecord[]>('/nodes');
    return data;
  },

  async create(payload: NodePayload) {
    const { data } = await api.post<NodeRecord>('/nodes', payload);
    return data;
  },

  async update(id: string, payload: Partial<NodePayload>) {
    const { data } = await api.put<NodeRecord>(`/nodes/${id}`, payload);
    return data;
  },

  async remove(id: string, force?: boolean) {
    const { data } = await api.delete<{ success: boolean }>(`/nodes/${id}`, {
      params: force ? { force: 'true' } : undefined,
    });
    return data;
  },

  async setMain(id: string) {
    const { data } = await api.post<NodeRecord>(`/nodes/${id}/main`);
    return data;
  },

  async check(id: string) {
    const { data } = await api.post<{ success: boolean; version?: string }>(
      `/nodes/${id}/check`,
    );
    return data;
  },

  async checkPayload(payload: NodePayload) {
    const { data } = await api.post<{ success: boolean; version?: string }>(
      '/nodes/check',
      payload,
    );
    return data;
  },

  async detectLocation(url: string) {
    const { data } = await api.post<{
      ip?: string;
      host?: string;
      flag?: string;
      country?: string;
      countryCode?: string;
    }>('/nodes/detect-location', { url });
    return data;
  },

  async syncFromMain() {
    const { data } = await api.post<{ success: boolean; count: number }>(
      '/nodes/sync/main',
    );
    return data;
  },
};
