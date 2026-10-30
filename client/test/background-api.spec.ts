import { afterEach, describe, expect, it, vi } from 'vitest';
import api from '../src/api';

describe('background API responses', () => {
  const original = api.defaults.adapter;
  afterEach(() => {
    api.defaults.adapter = original;
    vi.useRealTimers();
  });
  it('does not resolve deletion on 202 and retains structured force-delete errors', async () => {
    vi.useFakeTimers();
    let polls = 0;
    api.defaults.adapter = async (config) => ({
      config,
      headers: {},
      statusText: 'OK',
      status: config.url === '/subscriptions/one' ? 202 : 200,
      data:
        config.url === '/subscriptions/one'
          ? { jobId: 'job-1' }
          : ++polls === 1
            ? { status: 'running', message: 'Удаление инбаунда' }
            : {
                status: 'failed',
                message: 'Panel unavailable',
                errorStatus: 400,
                errorResponse: {
                  code: 'INBOUND_DELETE_FAILED',
                  message: 'Panel unavailable',
                },
              },
    });
    let finished = false;
    const result = api.delete('/subscriptions/one').then(
      () => {
        finished = true;
        return undefined;
      },
      (error: unknown) => {
        finished = true;
        return error;
      },
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(finished).toBe(false);
    await vi.advanceTimersByTimeAsync(2500);
    expect(await result).toMatchObject({
      response: { status: 400, data: { code: 'INBOUND_DELETE_FAILED' } },
    });
  });
  it('returns the completed result in the existing response format', async () => {
    api.defaults.adapter = async (config) => ({
      config,
      headers: {},
      statusText: 'OK',
      status: config.url === '/rotation/rotate-all' ? 202 : 200,
      data:
        config.url === '/rotation/rotate-all'
          ? { jobId: 'job-2' }
          : { status: 'success', result: { success: true, message: 'Готово' } },
    });
    const response = await api.post('/rotation/rotate-all');
    expect(response.status).toBe(200);
    expect(response.data).toEqual({ success: true, message: 'Готово' });
  });
});
