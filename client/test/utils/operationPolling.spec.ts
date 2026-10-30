import { describe, expect, it, vi } from 'vitest';
import { pollOperation } from '../../src/utils/operationPolling';

describe('background operation polling', () => {
  it('waits through queueing and progress before returning the real result', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce({ status: 'queued' })
      .mockResolvedValueOnce({ status: 'running', message: 'Инбаунд 2/10' })
      .mockResolvedValueOnce({ status: 'success', result: { success: true } });
    const progress = vi.fn();
    const wait = vi.fn().mockResolvedValue(undefined);
    expect(await pollOperation(get, progress, wait)).toEqual({
      status: 'success',
      result: { success: true },
    });
    expect(wait).toHaveBeenCalledTimes(2);
    expect(progress).toHaveBeenLastCalledWith('Инбаунд 2/10');
  });
  it('returns interrupted and failed jobs without polling indefinitely', async () => {
    for (const status of ['interrupted', 'failed']) {
      const job = { status, errorResponse: { code: 'INBOUND_DELETE_FAILED' } };
      const get = vi.fn().mockResolvedValue(job);
      expect(await pollOperation(get, vi.fn(), vi.fn())).toEqual(job);
      expect(get).toHaveBeenCalledTimes(1);
    }
  });
});
