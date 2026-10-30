import { useSyncExternalStore } from 'react';
import { getApiErrorMessage } from './errorHandlers';

type TaskState = { pending: string | null; error: string | null };
let state: TaskState = { pending: null, error: null };
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const snapshot = () => state;
function update(next: TaskState) {
  state = next;
  listeners.forEach((listener) => listener());
}

// The lock is synchronous and lives outside pages, including during navigation.
export async function runTask(message: string, action: () => Promise<unknown>) {
  if (state.pending) return;
  update({ pending: message, error: null });
  let taskError: string | null = null;
  try {
    await action();
  } catch (error) {
    taskError = getApiErrorMessage(error, 'Не удалось выполнить операцию');
  } finally {
    update({ pending: null, error: taskError });
  }
}

export function dismissTaskError() {
  update({ ...state, error: null });
}

export function usePendingTask() {
  return useSyncExternalStore(subscribe, snapshot);
}
