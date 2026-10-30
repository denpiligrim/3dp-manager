import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import JournalPage from '../../src/pages/JournalPage';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../../src/api', () => ({ default: { get } }));
describe('Journal', () => {
  beforeEach(() => {
    get.mockReset();
  });
  it('shows 20 rows per page, navigates both ways and resets the page on filtering', async () => {
    const entries = Array.from({ length: 45 }, (_, i) => ({
      id: String(i),
      title: `Event ${i + 1}`,
      status: 'success',
      createdAt: '2026-10-30T12:00:00Z',
      message: 'Done',
    }));
    get.mockImplementation((_, { params }) =>
      Promise.resolve({
        data: {
          total: entries.length,
          items: entries.slice(params.page * 20, (params.page + 1) * 20),
        },
      }),
    );
    render(<JournalPage />);
    const rows = () =>
      within(screen.getByRole('table')).getAllByRole('row').slice(1);
    await screen.findByText('Event 20');
    expect(rows()).toHaveLength(20);
    expect(screen.queryByText('Event 21')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Предыдущая страница' }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Следующая страница' }));
    await screen.findByText('Event 40');
    expect(rows()).toHaveLength(20);
    expect(screen.queryByText('Event 20')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Следующая страница' }));
    await screen.findByText('Event 45');
    expect(rows()).toHaveLength(5);
    expect(
      screen.getByRole('button', { name: 'Следующая страница' }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Предыдущая страница' }),
    );
    await screen.findByText('Event 40');
    fireEvent.mouseDown(screen.getByLabelText('Статус'));
    fireEvent.click(await screen.findByRole('option', { name: 'Ошибка' }));
    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith('/operations', {
        params: { page: 0, status: 'failed', kind: undefined },
      }),
    );
    await screen.findByText('Event 1');
    expect(rows()).toHaveLength(20);
  });

  it('returns to the last available page when old entries have been removed', async () => {
    let total = 25;
    get.mockImplementation((_, { params }) =>
      Promise.resolve({
        data: {
          total,
          items: Array.from(
            { length: Math.max(0, Math.min(20, total - params.page * 20)) },
            (_, i) => ({
              id: String(params.page * 20 + i),
              title: `Record ${params.page * 20 + i + 1}`,
              status: 'success',
              createdAt: '2026-10-30T12:00:00Z',
            }),
          ),
        },
      }),
    );
    render(<JournalPage />);
    await screen.findByText('Record 20');
    fireEvent.click(screen.getByRole('button', { name: 'Следующая страница' }));
    await screen.findByText('Record 25');
    total = 5;
    fireEvent.click(screen.getByRole('button', { name: 'Обновить' }));
    await screen.findByText('Record 5');
    expect(screen.queryByText('Record 25')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Следующая страница' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Предыдущая страница' }),
    ).toBeDisabled();
  });
  it('shows pending work, retries and results and filters by status', async () => {
    get.mockResolvedValue({
      data: {
        total: 2,
        items: [
          {
            id: 'one',
            title: 'Генерация подписки',
            kind: 'rotation.one',
            subject: 'Test subscription',
            status: 'running',
            message: 'Инбаунд 2/10',
            createdAt: '2026-10-30T12:00:00Z',
            completed: 2,
            total: 10,
          },
          {
            id: 'two',
            title: 'Повтор запроса',
            kind: 'inbound.retry',
            status: 'warning',
            message: 'Попытка 2/3',
            createdAt: '2026-10-30T12:00:01Z',
          },
        ],
      },
    });
    render(<JournalPage />);
    expect(await screen.findByText('Test subscription')).toBeInTheDocument();
    expect(screen.getByText('Инбаунд 2/10')).toBeInTheDocument();
    expect(screen.getByText('Попытка 2/3')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByLabelText('Статус'));
    fireEvent.click(await screen.findByRole('option', { name: 'Ошибка' }));
    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith('/operations', {
        params: { page: 0, status: 'failed', kind: undefined },
      }),
    );
  });
  it('shows load failures and allows a retry', async () => {
    get
      .mockRejectedValueOnce(new Error('Connection failed'))
      .mockResolvedValue({ data: { items: [], total: 0 } });
    render(<JournalPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Connection failed',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Обновить' }));
    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    );
  });
});
