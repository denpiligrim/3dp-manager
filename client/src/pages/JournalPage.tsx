import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from '@mui/material';
import api from '../api';
import { getApiErrorMessage } from '../utils/errorHandlers';

interface Entry {
  id: string;
  kind: string;
  title: string;
  subject: string;
  message: string;
  status: string;
  completed: number;
  total: number;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  parentId?: string;
}
const statuses: Record<
  string,
  { label: string; color: 'default' | 'info' | 'success' | 'error' | 'warning' }
> = {
  queued: { label: 'В очереди', color: 'default' },
  running: { label: 'Выполняется', color: 'info' },
  success: { label: 'Выполнено', color: 'success' },
  failed: { label: 'Ошибка', color: 'error' },
  interrupted: { label: 'Прервано', color: 'warning' },
  warning: { label: 'Повторная попытка', color: 'warning' },
};
const processes: Record<string, string> = {
  'rotation.all': 'Генерация всех подписок',
  'rotation.one': 'Генерация подписки',
  'rotation.subscription': 'Результаты генерации в пакете',
  'inbound.retry': 'Повторные запросы 3x-ui',
  'inbound.uncertain': 'Неизвестный результат создания',
  'subscription.create': 'Создание подписки',
  'subscription.update': 'Изменение подписки',
  'subscription.delete': 'Удаление подписки',
  'node.create': 'Создание ноды',
  'node.update': 'Изменение ноды',
  'node.delete': 'Удаление ноды',
  'node.main': 'Смена основной ноды',
  'node.sync': 'Импорт нод',
  'relay.create': 'Создание relay',
  'relay.delete': 'Удаление relay',
  'relay.install': 'Установка перенаправления',
  'relay.uninstall': 'Удаление перенаправления',
};

export default function JournalPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);
  const inFlight = useRef(false);
  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const id = ++requestId.current;
    setLoading(true);
    try {
      const { data } = await api.get<{ items: Entry[]; total: number }>(
        '/operations',
        {
          params: {
            page,
            status: status || undefined,
            kind: kind || undefined,
          },
        },
      );
      if (id !== requestId.current) return;
      const lastPage = Math.max(0, Math.ceil(data.total / 20) - 1);
      if (page > lastPage) {
        setTotal(data.total);
        setEntries([]);
        setPage(lastPage);
        return;
      }
      setEntries(data.items);
      setTotal(data.total);
      setError('');
    } catch (err) {
      if (id === requestId.current)
        setError(getApiErrorMessage(err, 'Не удалось загрузить журнал'));
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        inFlight.current = false;
      }
    }
  }, [page, status, kind]);
  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 5000);
    return () => {
      clearInterval(timer);
      requestId.current++;
      inFlight.current = false;
    };
  }, [load]);
  return (
    <Box>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 2 }}
      >
        <Typography variant="h4">Журнал</Typography>
        <Button onClick={() => void load()} disabled={loading}>
          Обновить
        </Button>
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Очередь задач и результаты операций. Обновляется каждые 5 секунд. Записи
        хранятся до 30 дней, не более 50 000 завершённых событий.
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="journal-status-label">Статус</InputLabel>
          <Select
            labelId="journal-status-label"
            label="Статус"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            <MenuItem value="">Все статусы</MenuItem>
            {Object.entries(statuses).map(([value, item]) => (
              <MenuItem key={value} value={value}>
                {item.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 260 }}>
          <InputLabel id="journal-process-label">Процесс</InputLabel>
          <Select
            labelId="journal-process-label"
            label="Процесс"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setPage(0);
            }}
          >
            <MenuItem value="">Все процессы</MenuItem>
            {Object.entries(processes).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Paper sx={{ overflow: 'hidden' }}>
        {loading && <LinearProgress />}
        <TableContainer>
          <Table size="small" sx={{ minWidth: 750 }}>
            <TableHead>
              <TableRow>
                <TableCell>Время</TableCell>
                <TableCell>Процесс</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell>Результат / ход выполнения</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((entry) => {
                const info = statuses[entry.status] || {
                  label: entry.status,
                  color: 'default' as const,
                };
                return (
                  <TableRow key={entry.id}>
                    <TableCell
                      sx={{ whiteSpace: 'nowrap', verticalAlign: 'top', py: 2 }}
                    >
                      {new Date(entry.createdAt).toLocaleString('ru-RU')}
                      {entry.finishedAt && (
                        <Typography
                          variant="caption"
                          display="block"
                          color="text.secondary"
                        >
                          Завершено:{' '}
                          {new Date(entry.finishedAt).toLocaleString('ru-RU')}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ verticalAlign: 'top', py: 2 }}>
                      <Typography variant="body2" fontWeight={600}>
                        {entry.title}
                      </Typography>
                      {entry.subject && (
                        <Typography
                          variant="caption"
                          sx={{ overflowWrap: 'anywhere' }}
                        >
                          {entry.subject}
                        </Typography>
                      )}
                      <Typography
                        variant="caption"
                        display="block"
                        color="text.secondary"
                      >
                        {entry.id}
                        {entry.parentId ? ` · Задача: ${entry.parentId}` : ''}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ verticalAlign: 'top', py: 2 }}>
                      <Chip
                        size="small"
                        label={info.label}
                        color={info.color}
                        icon={
                          entry.status === 'running' ? (
                            <CircularProgress size={14} color="inherit" />
                          ) : undefined
                        }
                      />
                    </TableCell>
                    <TableCell
                      sx={{
                        minWidth: 260,
                        verticalAlign: 'top',
                        py: 2,
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {entry.message ||
                        (entry.status === 'queued'
                          ? 'Ожидается завершение предыдущих задач'
                          : '—')}
                      {entry.total > 0 && (
                        <Typography variant="caption" display="block">
                          {entry.completed} / {entry.total}
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!entries.length && !loading && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                    Нет записей
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={total}
          page={page}
          rowsPerPage={20}
          rowsPerPageOptions={[20]}
          getItemAriaLabel={(type) =>
            type === 'next'
              ? 'Следующая страница'
              : type === 'previous'
                ? 'Предыдущая страница'
                : type === 'first'
                  ? 'Первая страница'
                  : 'Последняя страница'
          }
          onPageChange={(_, next) => setPage(next)}
          labelDisplayedRows={({ from, to, count }) =>
            `${from}–${to} из ${count}`
          }
        />
      </Paper>
    </Box>
  );
}
