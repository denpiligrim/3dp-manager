import { runTask, usePendingTask } from '../utils/pendingTask';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, TextField, Button, Typography, List, ListItem, ListItemText, IconButton, Paper, TablePagination, useTheme, useMediaQuery, Alert, Stack, CircularProgress, Divider, Link as MuiLink, Accordion, AccordionSummary, AccordionDetails, Snackbar, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Delete, Add, UploadFile, Remove, ExpandMore, Download } from '@mui/icons-material';
import api from '../api';
import { getApiErrorMessage, getApiErrorStatus } from '../utils/errorHandlers';
import { Logger } from '../utils/logger';

interface Domain { id: number; name: string; }
interface ScanCapabilities {
  scannerAvailable: boolean;
  scannerPath: string | null;
  timeoutAvailable: boolean;
  timeoutPath: string | null;
}
interface ScanResponse {
  runId: string;
  addr: string;
  scanSeconds: number;
  thread: number;
  timeout: number;
  startedAt: string;
  endsAt: string;
  finishedAt: string;
  timedOut: boolean;
  exitCode: number;
  foundCount: number;
  domains: string[];
  stderrTail: string;
  stdoutTail: string;
}
interface ScanStatusResponse {
  running: boolean;
  runId: string | null;
  addr: string | null;
  scanSeconds: number | null;
  thread: number | null;
  timeout: number | null;
  startedAt: string | null;
  endsAt: string | null;
  now: string;
  remainingSeconds: number;
  foundCount: number;
  lastRunId: string | null;
  lastFinishedAt: string | null;
}

const SCAN_STORAGE_KEY = 'domains_scan_state_v1';

export default function DomainsPage() {
  const { pending } = usePendingTask();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emptyDomainsNotified = useRef(false);
  const [totalCount, setTotalCount] = useState(0);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [scanCapabilities, setScanCapabilities] = useState<ScanCapabilities | null>(null);
  const [scanAddr, setScanAddr] = useState('');
  const [scanSeconds, setScanSeconds] = useState(30);
  const [scanThread, setScanThread] = useState(2);
  const [scanTimeout, setScanTimeout] = useState(5);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);
  const [scanCandidates, setScanCandidates] = useState<string[]>([]);
  const [scanPanelExpanded, setScanPanelExpanded] = useState(false);
  const [scanStateHydrated, setScanStateHydrated] = useState(false);
  const [scanStatus, setScanStatus] = useState<ScanStatusResponse | null>(null);
  const [activeScanRunId, setActiveScanRunId] = useState<string | null>(null);

  // Snackbar state for notifications
  const [snackbar, setSnackbar] = useState({ open: false, type: 'success' as 'success' | 'error', message: '' });

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', onConfirm: () => {} });

  const clampInteger = (value: number, fallback: number, min: number, max: number) => {
    const num = Number.isFinite(value) ? Math.floor(value) : fallback;
    if (num < min) return min;
    if (num > max) return max;
    return num;
  };

  const isLoopbackHost = useCallback((value: string) => {
    const host = value.trim().toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  }, []);

  interface Settings {
    xui_ip?: string;
    xui_host?: string;
    xui_url?: string;
  }

  const collectAddrCandidatesFromSettings = useCallback((settings: Settings) => {
    const candidates: string[] = [];
    const xuiIp = String(settings?.xui_ip || '').trim();
    const xuiHost = String(settings?.xui_host || '').trim();
    const xuiUrl = String(settings?.xui_url || '').trim();

    if (xuiIp) candidates.push(xuiIp);
    if (xuiHost) candidates.push(xuiHost);

    if (xuiUrl) {
      try {
        const parsed = new URL(xuiUrl);
        if (parsed.hostname) {
          candidates.push(parsed.hostname.trim());
        }
      } catch {
        // Ignore malformed URL from settings and fall back to runtime hostname.
      }
    }

    return candidates.filter(Boolean);
  }, []);

  const resolveSuggestedScanAddr = useCallback(async (opts?: { allowLoopbackFallback?: boolean }) => {
    const allowLoopbackFallback = Boolean(opts?.allowLoopbackFallback);
    let settingsCandidates: string[] = [];

    try {
      const settingsRes = await api.get('/settings');
      Logger.debug('Domains page: Settings response', 'Domains', settingsRes.data);

      settingsCandidates = collectAddrCandidatesFromSettings(settingsRes.data);
      Logger.debug('Domains page: Collected address candidates from settings', 'Domains', {
        candidates: settingsCandidates,
        xui_ip: settingsRes.data?.xui_ip,
        xui_host: settingsRes.data?.xui_host,
        xui_url: settingsRes.data?.xui_url
      });

      const publicFromSettings = settingsCandidates.find((c) => !isLoopbackHost(c));
      Logger.debug('Domains page: Looking for public address', 'Domains', {
        publicFromSettings,
        allCandidates: settingsCandidates
      });

      if (publicFromSettings) {
        return publicFromSettings;
      }
    } catch (error) {
      Logger.error('Failed to collect address candidates from settings', 'Domains', error);
    }

    // Fallback: panel host where user opened 3dp (often the target VPS in real usage).
    const runtimeHost = window.location.hostname;
    Logger.debug('Domains page: Checking runtime host as fallback', 'Domains', {
      runtimeHost,
      isLoopback: isLoopbackHost(runtimeHost)
    });

    // Если настройки пустые и мы на localhost — предлагаем localhost с предупреждением
    // Это позволяет пользователю начать работу и затем изменить на правильный IP
    if (runtimeHost) {
      if (!isLoopbackHost(runtimeHost)) {
        Logger.debug('Domains page: Using runtime host as address', 'Domains', runtimeHost);
        return runtimeHost;
      } else if (allowLoopbackFallback) {
        // Явно разрешили localhost fallback
        Logger.debug('Domains page: Using localhost fallback (explicit)', 'Domains', runtimeHost);
        return runtimeHost;
      } else if (settingsCandidates.length === 0) {
        // Настройки пустые — используем localhost как единственный вариант
        Logger.warn('Domains page: No settings configured, using localhost as temporary placeholder', 'Domains');
        return runtimeHost;
      }
    }

    // Last resort: first from settings even if loopback
    if (allowLoopbackFallback) {
      const anyFromSettings = settingsCandidates[0];
      if (anyFromSettings) return anyFromSettings;
    }

    Logger.warn('Domains page: No address found anywhere', 'Domains');
    return '';
  }, [collectAddrCandidatesFromSettings, isLoopbackHost]);

  const fetchScanStatus = useCallback(async () => {
    const { data } = await api.get('/domains/scan/status');
    setScanStatus(data);
    return data as ScanStatusResponse;
  }, []);

  const fetchLastScanResult = useCallback(async (expectedRunId?: string | null) => {
    const { data } = await api.get('/domains/scan/last-result');
    if (!data) return null;
    if (expectedRunId && data.runId !== expectedRunId) return null;

    setScanResult(data);
    setScanCandidates(data.domains || []);
    return data as ScanResponse;
  }, []);

  const loadDomains = useCallback(async () => {
    try {
      Logger.debug(`Loading page ${page + 1} (limit: ${rowsPerPage})`, 'Domains');
      const { data } = await api.get(`/domains?page=${page + 1}&limit=${rowsPerPage}`);

      setDomains(data.data);
      setTotalCount(data.total);
      if (data.total === 0 && !emptyDomainsNotified.current) {
        emptyDomainsNotified.current = true;
        setSnackbar({ open: true, type: 'error', message: 'Создайте хотя бы один домен!' });
      }
      if (data.total > 0) {
        emptyDomainsNotified.current = false;
      }
      Logger.debug(`Loaded ${data.data.length} domains (total: ${data.total})`, 'Domains');
    } catch (error) {
      Logger.error('Failed to load', 'Domains', error);
    }
  }, [page, rowsPerPage]);

  useEffect(() => {
    loadDomains();
  }, [loadDomains]);

  useEffect(() => {
    const loadScannerContext = async () => {
      try {
        const capRes = await api.get('/domains/scan/capabilities');
        setScanCapabilities(capRes.data);
        if (capRes.data?.scannerAvailable) {
          const status = await fetchScanStatus();
          if (status.running) {
            setIsScanning(true);
            setActiveScanRunId(status.runId);
            setScanResult(null);
            setScanCandidates([]);
            setScanError('');
          }
        }
      } catch (error) {
        Logger.error('Failed to load scanner context', 'Domains', error);
      }
    };

    loadScannerContext();
  }, [fetchScanStatus]);

  useEffect(() => {
    // Hydrate scanner UI state once so users do not lose pre-import review list after reload.
    try {
      const raw = localStorage.getItem(SCAN_STORAGE_KEY);
      let restoredAddr: string | null = null;

      Logger.debug('Domains page: Starting hydrate', 'Domains', {
        hasLocalStorage: !!raw,
        localStorageValue: raw ? JSON.parse(raw).scanAddr : 'N/A'
      });

      if (raw) {
        const parsed = JSON.parse(raw) as {
          scanAddr?: string;
          scanSeconds?: number;
          scanThread?: number;
          scanTimeout?: number;
          scanResult?: ScanResponse | null;
          scanCandidates?: string[];
          scanPanelExpanded?: boolean;
        };

        // Восстанавливаем только непустое значение
        if (typeof parsed.scanAddr === 'string' && parsed.scanAddr.trim()) {
          restoredAddr = parsed.scanAddr.trim();
          setScanAddr(restoredAddr);
          Logger.debug(`Domains page: Restored scanAddr from localStorage: "${restoredAddr}"`, 'Domains');
        } else {
          Logger.debug(`Domains page: scanAddr in localStorage is empty/whitespace, will fetch from settings`, 'Domains');
        }
        if (typeof parsed.scanSeconds === 'number') setScanSeconds(parsed.scanSeconds);
        if (typeof parsed.scanThread === 'number') setScanThread(parsed.scanThread);
        if (typeof parsed.scanTimeout === 'number') setScanTimeout(parsed.scanTimeout);
        if (parsed.scanResult) setScanResult(parsed.scanResult);
        if (Array.isArray(parsed.scanCandidates)) setScanCandidates(parsed.scanCandidates);
        if (typeof parsed.scanPanelExpanded === 'boolean') setScanPanelExpanded(parsed.scanPanelExpanded);
      } else {
        Logger.debug('Domains page: No localStorage data found', 'Domains');
      }

      // Если scanAddr не был восстановлен (пустой localStorage ИЛИ пустое значение),
      // пытаемся получить домен из настроек
      if (!restoredAddr) {
        Logger.debug('Domains page: Fetching suggested address from settings...', 'Domains');
        // Пробуем сначала без localhost, если не найдём — разрешаем localhost fallback
        resolveSuggestedScanAddr({ allowLoopbackFallback: false }).then((defaultAddr) => {
          if (defaultAddr) {
            setScanAddr(defaultAddr);
            Logger.debug(`Domains page: Set scanAddr from settings: "${defaultAddr}"`, 'Domains');
          } else {
            // Пытаемся с localhost fallback если совсем ничего не найдено
            Logger.debug('Domains page: Trying with localhost fallback...', 'Domains');
            resolveSuggestedScanAddr({ allowLoopbackFallback: true }).then((fallbackAddr) => {
              if (fallbackAddr) {
                setScanAddr(fallbackAddr);
                Logger.debug(`Domains page: Set scanAddr with localhost fallback: "${fallbackAddr}"`, 'Domains');
              }
            }).catch((error) => {
              Logger.error('Failed to resolve suggested scan address (fallback)', 'Domains', error);
            });
          }
        }).catch((error) => {
          Logger.error('Failed to resolve suggested scan address', 'Domains', error);
        });
      } else {
        Logger.debug(`Domains page: Using restored scanAddr: "${restoredAddr}"`, 'Domains');
      }
    } catch (error) {
      Logger.error('Failed to hydrate scanner state from localStorage', 'Domains', error);
    } finally {
      setScanStateHydrated(true);
    }
  }, [resolveSuggestedScanAddr]);

  useEffect(() => {
    if (!scanStateHydrated) return;

    try {
      // Persist scanner input + results + accordion state for continuation after F5.
      localStorage.setItem(
        SCAN_STORAGE_KEY,
        JSON.stringify({
          scanAddr,
          scanSeconds,
          scanThread,
          scanTimeout,
          scanResult,
          scanCandidates,
          scanPanelExpanded,
        }),
      );
    } catch (error) {
      Logger.error('Failed to persist scanner state to localStorage', 'Domains', error);
    }
  }, [scanAddr, scanSeconds, scanThread, scanTimeout, scanResult, scanCandidates, scanPanelExpanded, scanStateHydrated]);

  useEffect(() => {
    if (!isScanning) return;

    let cancelled = false;

    const tick = async () => {
      try {
        const status = await fetchScanStatus();
        if (cancelled) return;

        if (status.running) {
          if (status.runId) {
            setActiveScanRunId((prev) => prev ?? status.runId);
          }
          return;
        }

        // Скан завершён — очищаем ошибку и загружаем результаты
        setIsScanning(false);
        setScanError('');
        const runIdToLoad = activeScanRunId || status.lastRunId;
        await fetchLastScanResult(runIdToLoad);
        setActiveScanRunId(null);
      } catch (error) {
        if (!cancelled) {
          Logger.error('Failed to fetch scan status', 'Domains', error);
        }
      }
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isScanning, activeScanRunId, fetchScanStatus, fetchLastScanResult]);

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleAdd = async () => {
    return runTask("Выполняется добавление домена", async () => {
      setSnackbar((prev) => ({ ...prev, open: false }));
      if (!newDomain) return;
      Logger.debug(`Adding domain: ${newDomain}`, 'Domains');
      await api.post('/domains', { name: newDomain });
      Logger.debug(`Added domain: ${newDomain}`, 'Domains');
      setNewDomain('');
      await loadDomains();
    });
  };

  const handleDelete = async (id: number) => {
    return runTask("Выполняется удаление домена", async () => {
      setSnackbar((prev) => ({ ...prev, open: false }));
      Logger.debug(`Deleting domain ID: ${id}`, 'Domains');
      await api.delete(`/domains/${id}`);
      Logger.debug(`Deleted domain ID: ${id}`, 'Domains');
      await loadDomains();
    });
  };

  const handleDeleteAll = async () => {
    setConfirmDialog({
      open: true,
      title: 'ВНИМАНИЕ! Вы действительно хотите удалить ВСЕ домены из белого списка?',
      onConfirm: async () => {
        return runTask("Выполняется удаление всех доменов", async () => {
          setSnackbar((prev) => ({ ...prev, open: false }));
          setConfirmDialog((prev) => ({ ...prev, open: false }));

          try {
            Logger.debug('Deleting all domains', 'Domains');
            await api.delete('/domains/all');
            Logger.debug('All domains deleted', 'Domains');
            await loadDomains();
            setSnackbar({ open: true, type: 'success', message: 'Все домены удалены' });
          } catch {
            Logger.error('Delete all failed', 'Domains');
            setSnackbar({ open: true, type: 'error', message: 'Ошибка удаления' });
          }
        });
      }
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      return runTask('Выполняется импорт доменов из файла', async () => {
        setSnackbar((prev) => ({ ...prev, open: false }));
        const text = e.target?.result as string;
        if (!text) return;

        const lines = text.split(/\r?\n/);

        try {
          const { data } = await api.post('/domains/upload', { domains: lines });
          setSnackbar({ open: true, type: 'success', message: `Успешно добавлено доменов: ${data.count}` });
          await loadDomains();
        } catch {
          setSnackbar({ open: true, type: 'error', message: 'Ошибка при загрузке списка' });
        } finally {
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      });
    };
    reader.readAsText(file);
  };

  const handleStartScan = async () => {
    return runTask("Выполняется запуск сканирования", async () => {
      setSnackbar((prev) => ({ ...prev, open: false }));
      if (!scanAddr.trim()) {
        setSnackbar({ open: true, type: 'error', message: 'Укажите IP/домен для сканирования' });
        return;
      }

      const effectiveScanSeconds = clampInteger(scanSeconds, 120, 10, 600);
      const effectiveThread = clampInteger(scanThread, 2, 1, 20);
      const effectiveTimeout = clampInteger(scanTimeout, 5, 1, 20);
      let keepScanning = false;

      try {
        Logger.debug(`Starting scan: addr=${scanAddr.trim()}, seconds=${effectiveScanSeconds}, threads=${effectiveThread}, timeout=${effectiveTimeout}`, 'Scanner');
        setIsScanning(true);
        setScanError('');
        setScanResult(null);
        setScanStatus(null);
        setActiveScanRunId(null);

        const { data } = await api.post('/domains/scan/start', {
          addr: scanAddr.trim(),
          scanSeconds: effectiveScanSeconds,
          thread: effectiveThread,
          timeout: effectiveTimeout,
        });

        Logger.debug(`Scan started: runId=${data.runId}, found=${data.foundCount}`, 'Scanner');
        setScanResult(data);
        setScanCandidates(data.domains || []);
        setActiveScanRunId(data.runId || null);
        await fetchScanStatus();
      } catch (e) {
        const message = getApiErrorMessage(e, 'Ошибка запуска сканера');
        Logger.error(`Start error: ${message}`, 'Scanner');
        setScanError(message);

        const status = getApiErrorStatus(e);
        if (status === 429) {
          try {
            const status = await fetchScanStatus();
            if (status.running) {
              keepScanning = true;
              setIsScanning(true);
              setActiveScanRunId(status.runId);
              setScanError('Скан уже выполняется. Подключились к текущему запуску.');
              Logger.debug('Connected to existing scan session', 'Scanner');
            }
          } catch (statusErr) {
            Logger.error('Failed to fetch scan status on 429', 'Scanner', statusErr);
          }
        }
      } finally {
        if (!keepScanning) {
          setIsScanning(false);
          setActiveScanRunId(null);
        }
      }
    });
  };

  const handleImportScannedDomains = async () => {
    return runTask("Выполняется импорт доменов", async () => {
      setSnackbar((prev) => ({ ...prev, open: false }));
      const found = scanCandidates;
      if (found.length === 0) return;

      try {
        Logger.debug(`Importing ${found.length} scanned domains`, 'Domains');
        const { data } = await api.post('/domains/upload', { domains: found });
        Logger.debug(`Imported ${data.count} new domains`, 'Domains');
        setSnackbar({ open: true, type: 'success', message: `Скан завершен. Добавлено новых доменов: ${data.count}` });
        await loadDomains();
      } catch {
        Logger.error('Import failed', 'Domains');
        setSnackbar({ open: true, type: 'error', message: 'Ошибка импорта найденных доменов' });
      }
    });
  };

  const handleRemoveScannedDomain = (domain: string) => {
    setScanCandidates((prev) => prev.filter((d) => d !== domain));
  };

  const handleClearScannedDomains = async () => {
    return runTask("Выполняется очистка результатов сканирования", async () => {
      setSnackbar((prev) => ({ ...prev, open: false }));
      setScanCandidates([]);
      setScanResult(null);
      setScanStatus(null);
      setActiveScanRunId(null);
      setScanAddr('');

      const suggestedAddr = await resolveSuggestedScanAddr({ allowLoopbackFallback: true });
      setScanAddr(suggestedAddr);
    });
  };

  const downloadDomainsAsTxt = (filename: string, domainNames: string[]) => {
    const content = `${domainNames.join('\n')}\n`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const getExportTimestamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

  const handleExportScannedDomains = () => {
    if (scanCandidates.length === 0) return;
    downloadDomainsAsTxt(`sni-scanned-${getExportTimestamp()}.txt`, scanCandidates);
  };

  const handleExportMainDomains = async () => {
    if (domains.length === 0) return;

    try {
      const { data } = await api.get('/domains/all');
      const names = (Array.isArray(data) ? data : [])
        .map((d: Domain) => d.name)
        .filter(Boolean);

      if (names.length === 0) return;
      downloadDomainsAsTxt(`sni-whitelist-${getExportTimestamp()}.txt`, names);
    } catch {
      setSnackbar({ open: true, type: 'error', message: 'Ошибка экспорта списка' });
    }
  };

  return (
    <Box>
      <Typography variant={isMobile ? 'h5' : 'h4'} gutterBottom>Белый список доменов (SNI)</Typography>

      {scanCapabilities?.scannerAvailable && (
        <Paper sx={{ mb: 2 }}>
          <Accordion
            expanded={scanPanelExpanded}
            onChange={(_event, expanded) => setScanPanelExpanded(expanded)}
            disableGutters
            sx={{
              boxShadow: 'none',
              '&:before': { display: 'none' },
            }}
          >
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant='h6'>Автопоиск SNI (backend scanner)</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 2, pb: 2 }}>

          {scanCapabilities && (!scanCapabilities.scannerAvailable || !scanCapabilities.timeoutAvailable) && (
            <Alert severity='warning' sx={{ mb: 2 }}>
              Сканер в контейнере недоступен. scanner: {String(scanCapabilities.scannerAvailable)}, timeout: {String(scanCapabilities.timeoutAvailable)}
            </Alert>
          )}

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            label='IP/домен VPS'
            value={scanAddr}
            onChange={(e) => setScanAddr(e.target.value)}
            fullWidth
            size='small'
          />
          <TextField
            label='Секунд скана'
            type='number'
            value={scanSeconds}
            onChange={(e) => setScanSeconds(Number(e.target.value))}
            size='small'
            sx={{ minWidth: 140 }}
          />
          <TextField
            label='Потоков'
            type='number'
            value={scanThread}
            onChange={(e) => setScanThread(Number(e.target.value))}
            size='small'
            sx={{ minWidth: 120 }}
          />
          <TextField
            label='Таймаут, сек'
            type='number'
            value={scanTimeout}
            onChange={(e) => setScanTimeout(Number(e.target.value))}
            size='small'
            sx={{ minWidth: 120 }}
          />
        </Stack>

        <Stack direction='row' spacing={1} sx={{ mt: 2, flexWrap: 'wrap' }}>
          <Button variant='contained' onClick={handleStartScan} disabled={Boolean(pending) || (isScanning)}>
            {isScanning ? 'Сканирование...' : 'Сканировать'}
          </Button>
          <Button
            variant='outlined'
            onClick={handleImportScannedDomains}
            disabled={Boolean(pending) || (!scanResult || scanCandidates.length === 0 || isScanning)}
          >
            Добавить найденные в список
          </Button>
          {scanCandidates.length > 0 && (
            <Button
              variant='outlined'
              startIcon={<Download />}
              onClick={handleExportScannedDomains}
              disabled={Boolean(pending) || (isScanning)}
            >
              Экспорт найденных
            </Button>
          )}
          <Button
            variant='text'
            color='error'
            onClick={handleClearScannedDomains}
            disabled={Boolean(pending) || (scanCandidates.length === 0 && !scanResult)}
          >
            Очистить предварительный
          </Button>
          {isScanning && <CircularProgress size={24} />}
        </Stack>
        {isScanning && (
          <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
            {scanStatus?.running
              ? scanStatus.remainingSeconds > 0
                ? `Сканирование выполняется. Осталось ${scanStatus.remainingSeconds} сек (по данным сервера). Найдено сейчас: ${scanStatus.foundCount}.`
                : 'Сканирование завершается, ожидайте...'
              : 'Сканирование запущено, получаем статус от сервера...'}
          </Typography>
        )}

        {scanError && <Alert severity='error' sx={{ mt: 2 }}>{scanError}</Alert>}

          {scanResult && (
            <Box sx={{ mt: 2 }}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant='body2' sx={{ mb: 1 }}>
              Найдено доменов: <b>{scanResult.foundCount}</b>. В предварительном списке: <b>{scanCandidates.length}</b>.
            </Typography>
            <Typography
              variant='body2'
              color={scanResult.timedOut ? 'info.main' : 'success.main'}
              sx={{ mb: 1 }}
            >
              {scanResult.timedOut
                ? `Скан остановлен по лимиту времени (${scanResult.scanSeconds} сек) - это нормальный режим поиска.`
                : 'Скан завершен успешно.'}
              {' '}<Box component='span' sx={{ color: 'text.secondary' }}>(код: {scanResult.exitCode})</Box>
            </Typography>
            <Typography variant='body2' color='text.secondary' sx={{ mb: 1 }}>
              Проверяйте домены кликом и удаляйте лишние перед импортом.
            </Typography>
            <Paper variant='outlined' sx={{ maxHeight: 220, overflow: 'auto' }}>
              <List dense>
                {scanCandidates.map((d) => (
                  <ListItem
                    key={d}
                    sx={{
                      borderRadius: 1,
                      transition: 'background-color 120ms ease',
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      },
                    }}
                    secondaryAction={
                      <IconButton disabled={Boolean(pending)} edge='end' onClick={() => handleRemoveScannedDomain(d)}>
                        <Delete />
                      </IconButton>
                    }
                  >
                    <ListItemText
                      primary={
                        <MuiLink href={`https://${d}`} target='_blank' rel='noopener noreferrer' underline='hover'>
                          {d}
                        </MuiLink>
                      }
                    />
                  </ListItem>
                ))}
                {scanCandidates.length === 0 && (
                  <ListItem>
                    <ListItemText primary='Домены не найдены' />
                  </ListItem>
                )}
              </List>
            </Paper>
            </Box>
          )}
            </AccordionDetails>
          </Accordion>
        </Paper>
      )}

      <Paper sx={{ p: 2 }}>
        <Typography variant='h6' gutterBottom>
          Управление белым списком (SNI)
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            label="Доменное имя"
            size="small"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            sx={{ flex: '1 1 280px' }}
          />
          {isMobile ? (
            <>
              <IconButton disabled={Boolean(pending)} edge="end" onClick={() => fileInputRef.current?.click()}><UploadFile /></IconButton>
              <IconButton disabled={Boolean(pending)} edge="end" onClick={handleAdd}><Add /></IconButton>
            </>
          ) : (
            <>
              <Button disabled={Boolean(pending)}
                variant="outlined"
                startIcon={<UploadFile />}
                sx={{ width: '170px' }}
                onClick={() => fileInputRef.current?.click()}
              >
                Из файла
              </Button>
              <Button disabled={Boolean(pending)} variant="contained" sx={{ width: '160px' }} startIcon={<Add />} onClick={handleAdd}>Добавить</Button>
            </>
          )}
          <input
            type="file"
            accept=".txt"
            data-testid="file-input"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
        </Box>

        {domains.length > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'end', width: '100%', mt: 1, gap: 1, flexWrap: 'wrap' }}>
            <Button disabled={Boolean(pending)}
              variant="outlined"
              size='small'
              startIcon={<Download />}
              onClick={handleExportMainDomains}
            >
              Экспорт списка
            </Button>
            <Button disabled={Boolean(pending)}
              variant="text"
              color="error"
              size='small'
              startIcon={<Remove />}
              onClick={handleDeleteAll}
            >
              Удалить все
            </Button>
          </Box>
        )}

        <Paper variant='outlined' sx={{ mt: 1 }}>
          <List>
            {domains.map((d) => (
              <ListItem
                key={d.id}
                sx={{
                  borderRadius: 1,
                  transition: 'background-color 120ms ease',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
                secondaryAction={
                  <IconButton disabled={Boolean(pending)} edge="end" onClick={() => handleDelete(d.id)}><Delete /></IconButton>
                }
              >
                <ListItemText
                  primary={
                    <MuiLink href={`https://${d.name}`} target='_blank' rel='noopener noreferrer' underline='hover'>
                      {d.name}
                    </MuiLink>
                  }
                />
              </ListItem>
            ))}
            {domains.length === 0 && <Typography sx={{ p: 2 }} color='textSecondary' textAlign='center'>Нет доменов</Typography>}
          </List>
          <TablePagination
            component="div"
            count={totalCount}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 25, 50, 100]}
            labelRowsPerPage="Доменов на странице:"
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} из ${count !== -1 ? count : `более ${to}`}`}
          />
        </Paper>
      </Paper>

      <Snackbar
        open={snackbar.open && !pending}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.type}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}>
        <DialogTitle>Подтверждение действия</DialogTitle>
        <DialogContent>
          <Typography>{confirmDialog.title}</Typography>
        </DialogContent>
        <DialogActions>
          <Button disabled={Boolean(pending)} onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}>
            Отмена
          </Button>
          <Button disabled={Boolean(pending)}
            onClick={() => {
              setConfirmDialog({ ...confirmDialog, open: false });
              confirmDialog.onConfirm();
            }}
            variant="contained"
            color="error"
          >
            Удалить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
