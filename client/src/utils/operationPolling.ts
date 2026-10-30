export interface BackgroundOperation {
  status: 'queued' | 'running' | 'success' | 'failed' | 'interrupted';
  message: string;
  title?: string;
  result?: unknown;
  errorResponse?: unknown;
  errorStatus?: number;
}

export async function pollOperation(
  get: () => Promise<BackgroundOperation>,
  progress: (message: string) => void,
  wait = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
) {
  for (;;) {
    const operation = await get();
    if (operation.status !== 'queued' && operation.status !== 'running')
      return operation;
    progress(
      operation.status === 'queued'
        ? 'Задача в очереди. Ожидается завершение предыдущих операций.'
        : operation.message || operation.title || 'Выполняется операция',
    );
    await wait(2500);
  }
}
