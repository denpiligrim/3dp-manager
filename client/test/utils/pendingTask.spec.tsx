import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TaskNotification from '../../src/components/TaskNotification';
import { dismissTaskError, runTask } from '../../src/utils/pendingTask';

describe('pending tasks', () => {
  it('blocks concurrent actions synchronously and keeps progress across remounts', async () => {
    let finish!: () => void;
    const request = new Promise<void>((resolve) => { finish = resolve; });
    const duplicate = vi.fn();
    const firstView = render(<TaskNotification />);
    let task!: Promise<void>;
    act(() => { task = runTask('Выполняется удаление подписки', () => request); });
    expect(screen.getByRole('status')).toHaveTextContent('Выполняется удаление подписки');
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    await runTask('Duplicate', duplicate);
    expect(duplicate).not.toHaveBeenCalled();
    firstView.unmount();
    render(<TaskNotification />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    await act(async () => { finish(); await task; });
    const next = vi.fn().mockResolvedValue(undefined);
    await act(async () => { await runTask('Next', next); });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('shows request errors and unlocks subsequent actions', async () => {
    render(<TaskNotification />);
    await act(async () => {
      await runTask('Generating', () => Promise.reject({ response: { data: { message: 'Нода недоступна' } } }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Нода недоступна');
    const retry = vi.fn().mockResolvedValue(undefined);
    await act(async () => { await runTask('Retry', retry); });
    expect(retry).toHaveBeenCalledTimes(1);
    act(() => dismissTaskError());
  });
});
