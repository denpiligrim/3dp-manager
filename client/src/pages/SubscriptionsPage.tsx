import { runTask, usePendingTask } from '../utils/pendingTask';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Stepper,
  Step,
  StepLabel,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Add,
  ContentCopy,
  Delete,
  Edit,
  HelpOutline,
  Link as LinkIcon,
  MoreVert,
  OpenInNew,
  PauseCircleFilled,
  PlayCircleFilled,
  Refresh,
  Remove,
} from '@mui/icons-material';
import api from '../api';
import { copyToClipboard } from '../utils/copyToClipboard';
import { Logger } from '../utils/logger';
import type { NodeRecord } from '../types/node';
import { FlagOptionLabel } from '../utils/flags';

interface Subscription {
  id: string;
  name: string;
  uuid: string;
  clientId?: string;
  note?: string;
  supportUrl?: string;
  websiteUrl?: string;
  inbounds: unknown[];
  inboundsConfig?: InboundConfigUI[];
  isAutoRotationEnabled?: boolean;
}

interface Tunnel {
  id: number;
  name: string;
  ip: string;
  domain: string;
  isInstalled: boolean;
  nodeId?: string;
}

interface InboundConfigUI {
  id: string;
  type: string;
  port: string;
  sni: string;
  fingerprint?: string;
  link?: string;
  nodeId?: string;
  relayServerId?: string;
  flag?: string;
  name?: string;
  certificateFile?: string;
  keyFile?: string;
  routingProfile?: string;
}

interface Domain {
  id: number;
  name: string;
}

interface CountryOption {
  name: string;
  code: string;
  emoji: string;
}

const FINGERPRINT_OPTIONS = ['chrome', 'firefox', 'safari', 'ios', 'android', 'edge', '360', 'qq', 'random', 'randomized', 'randomizednoalpn', 'unsafe'];

const CONNECTION_OPTIONS = [
  'vless-tcp-reality',
  'vless-xhttp-reality',
  'vless-xhttp-get',
  'vless-grpc-reality',
  'vless-ws',
  'hysteria2-udp',
  'vmess-tcp',
  'shadowsocks-tcp',
  'trojan-tcp-reality',
  'custom',
  'happ-routing',
  'incy-routing',
];

const isRoutingProfile = (type: string) => type === 'happ-routing' || type === 'incy-routing';

const generateId = () => Math.random().toString(36).substring(7);

const getSubscriptionUrl = (uuid: string) => {
  const path = `/bus/${uuid}`;
  return typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;
};

export default function SubscriptionsPage() {
  const { pending } = usePendingTask();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [tunnels, setTunnels] = useState<Tunnel[]>([]);
  const [nodes, setNodes] = useState<NodeRecord[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [activeSub, setActiveSub] = useState<Subscription | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [wizardStep, setWizardStep] = useState(0);
  const [note, setNote] = useState('');
  const [supportUrl, setSupportUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [metadataErrors, setMetadataErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [inbounds, setInbounds] = useState<InboundConfigUI[]>([]);
  const [portErrors, setPortErrors] = useState<Record<string, string>>({});
  const [linksOpen, setLinksOpen] = useState(false);
  const [currentLinks, setCurrentLinks] = useState<string[]>([]);
  const [createdSubscriptionId, setCreatedSubscriptionId] = useState<string | null>(null);
  const [rotationLoading, setRotationLoading] = useState(false);
  const [forceRotation, setForceRotation] = useState(false);
  const [rotationSettings, setRotationSettings] = useState({
    rotation_interval: '30',
    rotation_status: 'active',
    last_rotation_timestamp: '',
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    type: 'success' as 'success' | 'error',
    message: '',
  });
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    confirmText: 'Удалить',
    confirmColor: 'error' as 'error' | 'primary',
    onConfirm: (() => {}) as (force?: boolean) => void,
  });

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const openActionMenu = Boolean(menuAnchorEl);

  const loadSubs = useCallback(async () => {
    try {
      const [subsRes, tunnelsRes, nodesRes, domainsRes, countriesRes, settingsRes] =
        await Promise.all([
          api.get('/subscriptions'),
          api.get('/tunnels'),
          api.get<NodeRecord[]>('/nodes'),
          api.get('/domains/all'),
          api.get<CountryOption[]>('/settings/countries'),
          api.get('/settings'),
        ]);

      setSubs(Array.isArray(subsRes.data) ? subsRes.data : []);
      setTunnels(
        Array.isArray(tunnelsRes.data)
          ? tunnelsRes.data.filter((tunnel: Tunnel) => tunnel.isInstalled)
          : [],
      );
      setNodes(Array.isArray(nodesRes.data) ? nodesRes.data : []);
      setDomains(Array.isArray(domainsRes.data) ? domainsRes.data : []);
      setCountries(Array.isArray(countriesRes.data) ? countriesRes.data : []);
      setRotationSettings((prev) => ({ ...prev, ...settingsRes.data }));
    } catch (error) {
      Logger.error('Failed to load subscriptions data', 'Subs', error);
      throw error;
    }
  }, []);

  useEffect(() => {
    loadSubs();
  }, [loadSubs]);

  const getDefaultNodeId = () =>
    nodes.find((node) => node.isMain)?.id || nodes[0]?.id || '';

  const getNodeAddress = (nodeId?: string) => {
    const node = nodes.find((item) => item.id === (nodeId || getDefaultNodeId()));
    if (!node) return '';
    if (node.domain) return node.domain;
    if (node.ip) return node.ip;
    if (node.host) return node.host;
    try {
      return new URL(node.url).hostname;
    } catch {
      return node.url;
    }
  };

  const getHysteriaCertDefaults = (nodeId?: string) => {
    const address = getNodeAddress(nodeId);
    return {
      certificateFile: address ? `/root/cert/${address}/fullchain.pem` : '',
      keyFile: address ? `/root/cert/${address}/privkey.pem` : '',
    };
  };

  const getNodeFlag = (nodeId?: string) =>
    nodes.find((node) => node.id === (nodeId || getDefaultNodeId()))?.flag || '';

  const getRelayOptions = (nodeId?: string) =>
    tunnels.filter((tunnel) => tunnel.nodeId === (nodeId || getDefaultNodeId()));

  const isValidPort = (value: string) =>
    value === 'random' || (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 65535);

  const createInbound = (type = 'vless-tcp-reality'): InboundConfigUI => {
    const nodeId = getDefaultNodeId();

    // Профиль маршрутизации не требует ноды и порта.
    if (isRoutingProfile(type)) {
      return {
        id: generateId(),
        type,
        port: '0',
        sni: '',
        link: '',
        routingProfile: '',
      };
    }

    const certDefaults = type === 'hysteria2-udp' ? getHysteriaCertDefaults(nodeId) : {};
    return {
      id: generateId(),
      type,
      fingerprint: 'edge',
      port: 'random',
      sni: ['hysteria2-udp', 'vless-xhttp-get'].includes(type) ? '' : 'random',
      link: '',
      nodeId,
      flag: getNodeFlag(nodeId),
      name: '',
      ...certDefaults,
    };
  };

  const handleOpenCreate = () => {
    if (nodes.length === 0) {
      setSnackbar({ open: true, type: 'error', message: 'Создайте хотя бы одну ноду!' });
      return;
    }
    if (domains.length === 0) {
      setSnackbar({ open: true, type: 'error', message: 'Создайте хотя бы один домен!' });
      return;
    }

    setEditingId(null);
    setName('');
    setClientId('');
    setWizardStep(0);
    setNote('');
    setSupportUrl('');
    setWebsiteUrl('');
    setMetadataErrors({});
    setInbounds([
      createInbound('hysteria2-udp'),
      createInbound('vless-xhttp-reality'),
      createInbound('vless-tcp-reality'),
      createInbound('vless-tcp-reality'),
      createInbound('vless-tcp-reality'),
      createInbound('vless-tcp-reality'),
      createInbound('vless-grpc-reality'),
      createInbound('vless-ws'),
      createInbound('vmess-tcp'),
      createInbound('shadowsocks-tcp'),
    ]);
    setPortErrors({});
    setOpen(true);
  };

  const handleOpenEdit = (sub: Subscription) => {
    setEditingId(sub.id);
    setName(sub.name);
    setClientId(sub.clientId || '');
    setWizardStep(0);
    setNote(sub.note || '');
    setSupportUrl(sub.supportUrl || '');
    setWebsiteUrl(sub.websiteUrl || '');
    setMetadataErrors({});
    setInbounds(
      (sub.inboundsConfig?.length ? sub.inboundsConfig : [createInbound()]).map((item) => {
        const nodeId = item.nodeId || getDefaultNodeId();
        const certDefaults = getHysteriaCertDefaults(nodeId);
        return {
          id: generateId(),
          type: item.type || 'vless-tcp-reality',
          fingerprint: item.fingerprint || 'edge',
          port: item.port ? item.port.toString() : 'random',
          sni: ['hysteria2-udp', 'vless-xhttp-get'].includes(item.type) ? '' : item.sni || 'random',
          link: item.link || '',
          nodeId,
          relayServerId: item.relayServerId ? item.relayServerId.toString() : '',
          flag: item.flag || getNodeFlag(nodeId),
          name: item.name || '',
          routingProfile: item.routingProfile || '',
          certificateFile:
            item.type === 'hysteria2-udp'
              ? item.certificateFile || certDefaults.certificateFile
              : undefined,
          keyFile:
            item.type === 'hysteria2-udp' ? item.keyFile || certDefaults.keyFile : undefined,
        };
      }),
    );
    setPortErrors({});
    setOpen(true);
  };

  const handleInboundChange = (id: string, field: keyof InboundConfigUI, value: string) => {
    setInbounds((prev) =>
      prev.map((inbound) => {
        if (inbound.id !== id) return inbound;
        const next = { ...inbound, [field]: value };

        if (field === 'nodeId') {
          next.relayServerId = '';
          next.flag = getNodeFlag(value);
          if (next.type === 'hysteria2-udp') {
            Object.assign(next, getHysteriaCertDefaults(value));
          }
        }

        if (field === 'type' && value === 'custom') {
          next.nodeId = '';
          next.relayServerId = '';
          next.flag = '';
          next.name = '';
          next.certificateFile = '';
          next.keyFile = '';
        }

        if (field === 'type' && value === 'hysteria2-udp') {
          next.sni = '';
          const defaults = getHysteriaCertDefaults(next.nodeId);
          next.certificateFile = next.certificateFile || defaults.certificateFile;
          next.keyFile = next.keyFile || defaults.keyFile;
        }

        if (field === 'type' && value !== 'custom' && !isRoutingProfile(value) && !next.nodeId) {
          next.nodeId = getDefaultNodeId();
          next.flag = getNodeFlag(next.nodeId);
        }

        return next;
      }),
    );

    if (field === 'port') {
      setPortErrors((prev) => {
        const next = { ...prev };
        if (isValidPort(value)) delete next[id];
        else next[id] = 'Порт: число 1-65535 или random';
        return next;
      });
    }
  };

  const addInbound = (type = 'vless-tcp-reality') => {
    setInbounds((prev) => prev.length < 20 ? [...prev, createInbound(type)] : prev);
  };

  const removeInbound = (id?: string) => {
    if (!id) {
      setInbounds([{ ...createInbound(), id: crypto.randomUUID() }]);
      setPortErrors({});
      return;
    }
    if (inbounds.length <= 1) return;
    setInbounds((prev) => prev.filter((inbound) => inbound.id !== id));
    setPortErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const validateMetadata = () => {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'Введите имя подписки';
    if (note.trim().length > 200) errors.note = 'Максимум 200 символов';
    const validUrl = (value: string, protocols: string[]) => {
      if (!value.trim()) return true;
      try { const url = new URL(value.trim()); return protocols.includes(url.protocol) && !!url.hostname && !/[\r\n]/.test(value); } catch { return false; }
    };
    if (!validUrl(supportUrl, ['https:', 'http:', 'tg:'])) errors.supportUrl = 'Введите полную ссылку на поддержку';
    if (!validUrl(websiteUrl, ['https:', 'http:'])) errors.websiteUrl = 'Введите полный адрес сайта (https://...)';
    setMetadataErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (wizardStep === 0 && !validateMetadata()) return;
    if (wizardStep === 1) {
      if (!inbounds.some((item) => !isRoutingProfile(item.type)) && !editingId) {
        setSnackbar({ open: true, type: 'error', message: 'Добавьте хотя бы один инбаунд' });
        return;
      }
      const errors: Record<string, string> = {};
      for (const inbound of inbounds) {
        if (inbound.type !== 'custom' && !isRoutingProfile(inbound.type) && !isValidPort(inbound.port)) errors[inbound.id] = 'Порт: число 1-65535 или random';
      }
      setPortErrors(errors);
      if (Object.keys(errors).length) return;
    }
    setWizardStep((step) => Math.min(2, step + 1));
  };

  const handleSave = async () => {
    return runTask("Выполняется сохранение подписки", async () => {
      setSnackbar((prev) => ({ ...prev, open: false }));
      if (!validateMetadata()) { setWizardStep(0); return; }
      const nextPortErrors = inbounds.reduce<Record<string, string>>((acc, inbound) => {
        if (inbound.type !== 'custom' && !isRoutingProfile(inbound.type) && !isValidPort(inbound.port)) {
          acc[inbound.id] = 'Порт: число 1-65535 или random';
        }
        return acc;
      }, {});
      setPortErrors(nextPortErrors);

      if (Object.keys(nextPortErrors).length > 0) {
        setWizardStep(1);
        setSnackbar({
          open: true,
          type: 'error',
          message: 'Пожалуйста, исправьте ошибки с портами',
        });
        return;
      }
      if (!name.trim()) {
        setSnackbar({ open: true, type: 'error', message: 'Введите имя подписки' });
        return;
      }

      const payload = {
        name,
        clientId: clientId.trim(),
        ...(note.trim() ? { note: note.trim() } : editingId ? { note: '' } : {}),
        ...(supportUrl.trim() ? { supportUrl: supportUrl.trim() } : editingId ? { supportUrl: '' } : {}),
        ...(websiteUrl.trim() ? { websiteUrl: websiteUrl.trim() } : editingId ? { websiteUrl: '' } : {}),
        inboundsConfig: inbounds.map((inbound) => {
          if (inbound.type === 'custom') {
            return { type: inbound.type, link: inbound.link };
          }
          if (isRoutingProfile(inbound.type)) {
            return {
              type: inbound.type,
              routingProfile: inbound.routingProfile,
            };
          }
          return {
            type: inbound.type,
            fingerprint: inbound.type.endsWith('-reality') ? inbound.fingerprint || 'edge' : undefined,
            port: inbound.port === 'random' ? 'random' : parseInt(inbound.port, 10),
            sni: ['hysteria2-udp', 'vless-xhttp-get'].includes(inbound.type) ? undefined : inbound.sni,
            nodeId: inbound.nodeId || undefined,
            relayServerId: inbound.relayServerId
              ? parseInt(inbound.relayServerId, 10)
              : undefined,
            flag: inbound.flag || getNodeFlag(inbound.nodeId) || undefined,
            name: inbound.name?.trim() || undefined,
            certificateFile:
              inbound.type === 'hysteria2-udp'
                ? inbound.certificateFile?.trim() || undefined
                : undefined,
            keyFile:
              inbound.type === 'hysteria2-udp'
                ? inbound.keyFile?.trim() || undefined
                : undefined,
          };
        }),
      };

      setOpen(false);
      setSaving(true);
      try {
        if (editingId) {
          await api.put(`/subscriptions/${editingId}`, payload);
        } else {
          const res = await api.post<{ id?: string }>('/subscriptions', payload);
          setCreatedSubscriptionId(res.data?.id || null);
        }
        setOpen(false);
        await loadSubs();
        setSnackbar({
          open: true,
          type: 'success',
          message: editingId ? 'Подписка обновлена' : 'Подписка создана',
        });
      } catch (error: unknown) {
        const message =
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Произошла ошибка при сохранении';
        setSnackbar({ open: true, type: 'error', message });
      } finally {
        setSaving(false);
      }
    });
  };

  const [deleteFailure, setDeleteFailure] = useState<{ id: string; message: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const deleteSubscription = async (id: string, force = false) => {
    return runTask("Выполняется удаление подписки", async () => {
      setSnackbar((prev) => ({ ...prev, open: false }));
      setDeleteFailure(null);
      setDeleting(true);
      try {
        await api.delete(`/subscriptions/${id}${force ? '?force=true' : ''}`);
        setDeleteFailure(null);
        await loadSubs();
        setSnackbar({ open: true, type: 'success', message: 'Подписка удалена' });
      } catch (error: unknown) {
        const data = (error as { response?: { data?: { code?: string; message?: string } } })?.response?.data;
        const message = data?.message || 'Не удалось удалить подписку';
        setSnackbar({ open: true, type: 'error', message });
        if (!force && data?.code === 'INBOUND_DELETE_FAILED') {
          setDeleteFailure({ id, message });
        }
      } finally {
        setDeleting(false);
      }
    });
  };

  const handleDelete = (id: string) => {
    setConfirmDialog({
      open: true,
      title: 'Удалить подписку и все соединения?',
      confirmText: 'Удалить',
      confirmColor: 'error',
      onConfirm: () => { void deleteSubscription(id); },
    });
  };

  const handleToggleAutoRotation = async (subscriptionId: string, enabled: boolean) => {
    return runTask("Выполняется изменение авторотации", async () => {
      setSnackbar((prev) => ({ ...prev, open: false }));
      try {
        await api.put('/subscriptions/bulk-auto-rotation', {
          subscriptionIds: [subscriptionId],
          enabled,
        });
        setSubs((prev) =>
          prev.map((sub) =>
            sub.id === subscriptionId ? { ...sub, isAutoRotationEnabled: enabled } : sub,
          ),
        );
        setSnackbar({
          open: true,
          type: 'success',
          message: enabled ? 'Авторотация включена' : 'Авторотация выключена',
        });
      } catch (error: unknown) {
        const message =
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Ошибка обновления';
        setSnackbar({ open: true, type: 'error', message });
        await loadSubs();
      }
    });
  };

  const handleManualRotate = (sub: Subscription) => {
    setConfirmDialog({
      open: true,
      title: `Обновить подписку "${sub.name}" сейчас?`,
      confirmText: 'Обновить',
      confirmColor: 'primary',
      onConfirm: async (force = false) => {
        return runTask("Выполняется генерация инбаундов", async () => {
          setSnackbar((prev) => ({ ...prev, open: false }));
          setConfirmDialog((prev) => ({ ...prev, open: false }));

          const url = force
            ? `/rotation/rotate-one/${sub.id}?force=true`
            : `/rotation/rotate-one/${sub.id}`;
          const res = await api.post(url);
          setSnackbar({
            open: true,
            type: res.data?.success ? 'success' : 'error',
            message: res.data?.message || 'Ротация выполнена',
          });
          setForceRotation(false);
          await loadSubs();
        });
      },
    });
  };

  const saveRotationSettings = async (nextSettings = rotationSettings) => {
    await api.post('/settings', nextSettings);
    setRotationSettings(nextSettings);
  };

  const toggleRotationService = async () => {
    return runTask("Выполняется изменение настроек ротации", async () => {
      setSnackbar((prev) => ({ ...prev, open: false }));
      const nextStatus = rotationSettings.rotation_status === 'stopped' ? 'active' : 'stopped';
      const nextSettings = { ...rotationSettings, rotation_status: nextStatus };
      await saveRotationSettings(nextSettings);
      setSnackbar({
        open: true,
        type: 'success',
        message: nextStatus === 'active' ? 'Ротация включена' : 'Ротация остановлена',
      });
    });
  };

  const saveRotationInterval = async () => {
    return runTask("Выполняется сохранение интервала ротации", async () => {
      setSnackbar((prev) => ({ ...prev, open: false }));
      const interval = parseInt(rotationSettings.rotation_interval, 10);
      if (Number.isNaN(interval) || interval < 10) {
        setSnackbar({
          open: true,
          type: 'error',
          message: 'Минимальный интервал ротации - 10 минут',
        });
        return;
      }
      await saveRotationSettings(rotationSettings);
      setSnackbar({ open: true, type: 'success', message: 'Интервал ротации сохранен' });
    });
  };

  const rotateAllNow = () => {
    setConfirmDialog({
      open: true,
      title: 'Сгенерировать инбаунды сейчас для всех активных подписок?',
      confirmText: 'Сгенерировать',
      confirmColor: 'primary',
      onConfirm: async (force = false) => {
        return runTask("Выполняется генерация всех подписок", async () => {
          setSnackbar((prev) => ({ ...prev, open: false }));
          setConfirmDialog((prev) => ({ ...prev, open: false }));

          try {
            setRotationLoading(true);
            const url = force
              ? '/rotation/rotate-all?force=true'
              : '/rotation/rotate-all';
            const { data } = await api.post(url);
            setSnackbar({
              open: true,
              type: data?.success ? 'success' : 'error',
              message: data?.message || 'Ротация завершена',
            });
            setForceRotation(false);
            await loadSubs();
          } finally {
            setRotationLoading(false);
          }
        });
      },
    });
  };

  const formatRotationDate = (value: string) => {
    if (!value) return 'Нет данных';
    return new Date(Number(value)).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getNextRotationDate = () => {
    if (rotationSettings.rotation_status === 'stopped') return 'Пауза';
    if (!rotationSettings.last_rotation_timestamp) return 'Ожидание';
    const interval = parseInt(rotationSettings.rotation_interval, 10) || 30;
    return new Date(Number(rotationSettings.last_rotation_timestamp) + interval * 60000).toLocaleString(
      'ru-RU',
      { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' },
    );
  };

  const showLinks = (sub: Subscription) => {
    const links = sub.inbounds?.map((item) => (item as { link?: string }).link).filter(Boolean) || [];
    setCurrentLinks(links.length ? links : ['Нет активных ссылок (ждите ротации)']);
    setLinksOpen(true);
  };

  const handleCopyLink = async (uuid: string) => {
    await copyToClipboard(getSubscriptionUrl(uuid));
    setSnackbar({ open: true, type: 'success', message: 'Ссылка на подписку скопирована' });
  };

  const handleGenerateCreatedSubscription = async () => {
    return runTask("Выполняется генерация инбаундов", async () => {
      setSnackbar((prev) => ({ ...prev, open: false }));
      if (!createdSubscriptionId) return;
      setCreatedSubscriptionId(null);
      setForceRotation(false);
      const url = forceRotation
        ? `/rotation/rotate-one/${createdSubscriptionId}?force=true`
        : `/rotation/rotate-one/${createdSubscriptionId}`;
      const res = await api.post(url);
      setSnackbar({
        open: true,
        type: res.data?.success ? 'success' : 'error',
        message: res.data?.message || 'Ротация выполнена',
      });
      await loadSubs();
    });
  };

  const openActionMenuFor = (event: React.MouseEvent<HTMLButtonElement>, sub: Subscription) => {
    setMenuAnchorEl(event.currentTarget);
    setActiveSub(sub);
  };

  const closeActionMenu = () => {
    setMenuAnchorEl(null);
    setActiveSub(null);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant={isMobile ? 'h5' : 'h4'}>Подписки</Typography>
        <Button disabled={Boolean(pending)} variant="contained" startIcon={<Add />} onClick={handleOpenCreate}>
          Создать
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">Статус ротации</Typography>
            <Chip
              icon={rotationSettings.rotation_status === 'stopped' ? <PauseCircleFilled /> : <PlayCircleFilled />}
              label={rotationSettings.rotation_status === 'stopped' ? 'Остановлена' : 'Активна'}
              color={rotationSettings.rotation_status === 'stopped' ? 'warning' : 'success'}
              size="small"
              variant="outlined"
              sx={{ mt: 1 }}
            />
          </Box>
          <Tooltip title={rotationSettings.rotation_status === 'stopped' ? 'Возобновить ротацию' : 'Поставить на паузу'}>
            <IconButton disabled={Boolean(pending)} onClick={toggleRotationService} size="small">
              {rotationSettings.rotation_status === 'stopped' ? <PlayCircleFilled fontSize="large" /> : <PauseCircleFilled fontSize="large" />}
            </IconButton>
          </Tooltip>
          <Divider flexItem orientation={isMobile ? 'horizontal' : 'vertical'} />
          <Box>
            <Typography variant="subtitle2" color="text.secondary">Последняя генерация</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>{formatRotationDate(rotationSettings.last_rotation_timestamp)}</Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">Следующая генерация</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>{getNextRotationDate()}</Typography>
          </Box>
          <TextField
            label="Интервал, мин"
            type="number"
            size="small"
            value={rotationSettings.rotation_interval}
            onChange={(e) => setRotationSettings((prev) => ({ ...prev, rotation_interval: e.target.value }))}
            sx={{ width: { xs: '100%', md: 150 } }}
          />
          <Box sx={{ flexGrow: 1 }} />
          <Button disabled={Boolean(pending)} variant="outlined" onClick={saveRotationInterval}>Сохранить интервал</Button>
          <Button variant="contained" disabled={Boolean(pending) || (rotationLoading)} onClick={rotateAllNow}>Обновить все</Button>
        </Stack>
      </Paper>

      <Paper sx={{ overflowX: 'auto' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Имя</TableCell>
              <TableCell>UUID</TableCell>
              <TableCell>Инбаунды</TableCell>
              <TableCell>Авторотация</TableCell>
              <TableCell align="right">Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {subs.map((sub) => (
              <TableRow key={sub.id}>
                <TableCell sx={{ fontWeight: 700 }}>{sub.name}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace' }}>{sub.uuid}</TableCell>
                <TableCell>{sub.inbounds?.length || 0}</TableCell>
                <TableCell>
                  <Checkbox
                    checked={sub.isAutoRotationEnabled ?? true}
                    onChange={(e) => handleToggleAutoRotation(sub.id, e.target.checked)}
                    color="primary"
                  />
                </TableCell>
                <TableCell align="right">
                  {!isMobile && (
                    <>
                      <IconButton disabled={Boolean(pending)} color="primary" onClick={() => handleCopyLink(sub.uuid)} title="Копировать ссылку">
                        <ContentCopy />
                      </IconButton>
                      <IconButton disabled={Boolean(pending)} color="primary" onClick={() => window.open(getSubscriptionUrl(sub.uuid), '_blank')} title="Открыть подписку">
                        <OpenInNew />
                      </IconButton>
                    </>
                  )}
                  <IconButton disabled={Boolean(pending)} onClick={(e) => openActionMenuFor(e, sub)}><MoreVert /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {subs.length === 0 && (
          <Typography sx={{ p: 2 }} color="textSecondary" textAlign="center">
            Нет подписок
          </Typography>
        )}
      </Paper>

      <Menu anchorEl={menuAnchorEl} open={openActionMenu} onClose={closeActionMenu} onClick={closeActionMenu}>
        {isMobile && activeSub && <MenuItem disabled={Boolean(pending)} onClick={() => handleCopyLink(activeSub.uuid)}><ListItemIcon><ContentCopy fontSize="small" color="primary" /></ListItemIcon><ListItemText>Копировать ссылку</ListItemText></MenuItem>}
        {isMobile && activeSub && <MenuItem disabled={Boolean(pending)} onClick={() => window.open(getSubscriptionUrl(activeSub.uuid), '_blank')}><ListItemIcon><OpenInNew fontSize="small" color="primary" /></ListItemIcon><ListItemText>Открыть подписку</ListItemText></MenuItem>}
        {activeSub && <MenuItem disabled={Boolean(pending)} onClick={() => showLinks(activeSub)}><ListItemIcon><LinkIcon fontSize="small" /></ListItemIcon><ListItemText>Показать конфиги</ListItemText></MenuItem>}
        {activeSub && <MenuItem disabled={Boolean(pending)} onClick={() => handleManualRotate(activeSub)}><ListItemIcon><Refresh fontSize="small" color="primary" /></ListItemIcon><ListItemText>Обновить сейчас</ListItemText></MenuItem>}
        {activeSub && <MenuItem disabled={Boolean(pending)} onClick={() => handleOpenEdit(activeSub)}><ListItemIcon><Edit fontSize="small" /></ListItemIcon><ListItemText>Редактировать</ListItemText></MenuItem>}
        {activeSub && <MenuItem disabled={Boolean(pending)} onClick={() => handleDelete(activeSub.id)}><ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon><ListItemText sx={{ color: 'error.main' }}>Удалить</ListItemText></MenuItem>}
      </Menu>

      <Dialog open={open} onClose={() => { if (!saving) setOpen(false); }} maxWidth="md" fullWidth disableRestoreFocus>
        <DialogTitle variant="h5">{editingId ? 'Редактировать подписку' : 'Новая подписка'}</DialogTitle>
        <DialogContent dividers sx={{ maxHeight: '72vh' }}>
          <Stepper activeStep={wizardStep} alternativeLabel sx={{ mb: 3 }}>{['Основные данные', 'Инбаунды', 'Роутинг'].map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}</Stepper>
          {wizardStep === 0 && <>
          <TextField autoFocus margin="dense" label="Имя подписки" fullWidth value={name} onChange={(e) => setName(e.target.value)} error={!!metadataErrors.name} helperText={metadataErrors.name} sx={{ mb: 2 }} />
          <TextField margin="dense" label="ID клиента (необязательно)" fullWidth value={clientId} onChange={(e) => setClientId(e.target.value)} helperText="ID или email / имя клиента из раздела Clients 3x-ui. Клиент должен существовать на каждой выбранной ноде. Пустое поле — создать клиента автоматически перед генерацией подключений." sx={{ mb: 2 }} />
          <TextField margin="dense" label="Примечание (необязательно)" multiline minRows={2} fullWidth value={note} onChange={(e) => setNote(e.target.value)} error={!!metadataErrors.note} helperText={metadataErrors.note || 'Отображается в приложении. До 200 символов.'} />
          <TextField margin="dense" label="Ссылка на поддержку (необязательно)" fullWidth value={supportUrl} onChange={(e) => setSupportUrl(e.target.value)} error={!!metadataErrors.supportUrl} helperText={metadataErrors.supportUrl} placeholder="https://t.me/support" />
          <TextField margin="dense" label="Сайт (необязательно)" fullWidth value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} error={!!metadataErrors.websiteUrl} helperText={metadataErrors.websiteUrl} placeholder="https://example.com" />
          </>}
          {wizardStep > 0 && <>
          <Typography variant="h6" sx={{ mb: 2 }}>{wizardStep === 1 ? 'Инбаунды' : 'Роутинг'} ({inbounds.filter((item) => isRoutingProfile(item.type) === (wizardStep === 2)).length}; всего {inbounds.length}/20)</Typography>
          <Box sx={{ maxHeight: '52vh', overflow: 'auto', pr: 1 }}>
            {inbounds.filter((item) => isRoutingProfile(item.type) === (wizardStep === 2)).map((inbound, index) => (
              <Box
                key={inbound.id}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 2,
                  mb: 2,
                  p: 2,
                  flexWrap: 'nowrap',
                  width: 'fit-content',
                  minWidth: inbound.type === 'custom' || isRoutingProfile(inbound.type) ? 780 : inbound.type === 'hysteria2-udp' ? 1540 : 1260,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
              >
                <Typography sx={{ mt: 1, width: 34, flexShrink: 0, fontWeight: 'bold' }}>#{index + 1}</Typography>
                <FormControl size="small" sx={{ width: 185, flexShrink: 0 }}>
                  <InputLabel>Тип</InputLabel>
                  <Select value={inbound.type} label="Тип" onChange={(e) => handleInboundChange(inbound.id, 'type', e.target.value)}>
                    {CONNECTION_OPTIONS.filter((option) => isRoutingProfile(option) === (wizardStep === 2)).map((option) => <MenuItem disabled={Boolean(pending)} key={option} value={option}>{option === 'happ-routing' ? 'Роутинг Happ' : option === 'incy-routing' ? 'Роутинг INCY' : option}</MenuItem>)}
                  </Select>
                </FormControl>
                {inbound.type === 'custom' ? (
                  <TextField size="small" label="Ссылка на подключение" placeholder="vless://..." value={inbound.link || ''} onChange={(e) => handleInboundChange(inbound.id, 'link', e.target.value)} sx={{ width: 460, flexShrink: 0 }} />
                ) : isRoutingProfile(inbound.type) ? (
                  <TextField
                    size="small"
                    label={inbound.type === 'incy-routing' ? 'Профиль INCY (JSON, base64, URL или ссылка)' : 'Профиль Happ (JSON, base64 или ссылка)'}
                    placeholder='{"Name":"MyProfile","GlobalProxy":"true","DirectSites":["geosite:cn"]}'
                    value={inbound.routingProfile || ''}
                    onChange={(e) => handleInboundChange(inbound.id, 'routingProfile', e.target.value)}
                    multiline
                    rows={4}
                    sx={{ width: 460, flexShrink: 0 }}
                    helperText={inbound.type === 'incy-routing' ? 'JSON, base64, incy://routing/... или incy://autorouting/.... URL профиля включает автообновление.' : 'Вставьте JSON профиль или готовую ссылку happ://routing/...'}
                  />
                ) : (
                  <>
                    <FormControl size="small" sx={{ width: 170, flexShrink: 0 }}>
                      <InputLabel>Нода</InputLabel>
                      <Select value={inbound.nodeId || ''} label="Нода" onChange={(e) => handleInboundChange(inbound.id, 'nodeId', e.target.value)}>
                        <MenuItem disabled={Boolean(pending)} value="">Основная нода</MenuItem>
                        {nodes.map((node) => <MenuItem disabled={Boolean(pending)} key={node.id} value={node.id}>{node.name}{node.isMain ? ' (основная)' : ''}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ width: 170, flexShrink: 0 }}>
                      <InputLabel>Relay</InputLabel>
                      <Select value={inbound.relayServerId || ''} label="Relay" onChange={(e) => handleInboundChange(inbound.id, 'relayServerId', e.target.value)}>
                        <MenuItem disabled={Boolean(pending)} value="">Без relay</MenuItem>
                        {getRelayOptions(inbound.nodeId).map((tunnel) => <MenuItem disabled={Boolean(pending)} key={tunnel.id} value={tunnel.id.toString()}>{tunnel.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ width: 170, flexShrink: 0 }}>
                      <InputLabel>Флаг</InputLabel>
                      <Select value={inbound.flag || getNodeFlag(inbound.nodeId)} label="Флаг" onChange={(e) => handleInboundChange(inbound.id, 'flag', e.target.value)} renderValue={(value) => <FlagOptionLabel flag={value} label={countries.find((country) => country.emoji === value)?.name || 'Флаг'} />}>
                        <MenuItem disabled={Boolean(pending)} value="">Без флага</MenuItem>
                        {countries.map((country) => <MenuItem disabled={Boolean(pending)} key={country.code} value={country.emoji}><FlagOptionLabel flag={country.emoji} code={country.code} label={country.name} /></MenuItem>)}
                      </Select>
                    </FormControl>
                    <TextField size="small" label="Название" value={inbound.name || ''} onChange={(e) => handleInboundChange(inbound.id, 'name', e.target.value)} sx={{ width: 180, flexShrink: 0 }} />
                    <TextField size="small" label="Порт" placeholder="random или порт" value={inbound.port} onChange={(e) => handleInboundChange(inbound.id, 'port', e.target.value)} error={!!portErrors[inbound.id]} helperText={portErrors[inbound.id] || ''} sx={{ width: 150, flexShrink: 0 }} />
                    {inbound.type === 'hysteria2-udp' && (
                      <>
                        <TextField
                          size="small"
                          label="Сертификат"
                          value={inbound.certificateFile || ''}
                          onChange={(e) => handleInboundChange(inbound.id, 'certificateFile', e.target.value)}
                          sx={{ width: 360, flexShrink: 0 }}
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">
                                <Tooltip title="Путь к сертификату должен существовать на выбранной ноде. По умолчанию используется путь Let's Encrypt.">
                                  <HelpOutline fontSize="small" color="action" />
                                </Tooltip>
                              </InputAdornment>
                            ),
                          }}
                        />
                        <TextField
                          size="small"
                          label="Приватный ключ"
                          value={inbound.keyFile || ''}
                          onChange={(e) => handleInboundChange(inbound.id, 'keyFile', e.target.value)}
                          sx={{ width: 360, flexShrink: 0 }}
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">
                                <Tooltip title="Путь к приватному ключу должен существовать на выбранной ноде. По умолчанию используется путь Let's Encrypt.">
                                  <HelpOutline fontSize="small" color="action" />
                                </Tooltip>
                              </InputAdornment>
                            ),
                          }}
                        />
                      </>
                    )}
                    {inbound.type.endsWith('-reality') && (
                      <FormControl size="small" sx={{ width: 180, flexShrink: 0 }}>
                        <InputLabel>Fingerprint</InputLabel>
                        <Select value={inbound.fingerprint || 'edge'} label="Fingerprint" onChange={(e) => handleInboundChange(inbound.id, 'fingerprint', e.target.value)}>
                          {FINGERPRINT_OPTIONS.map((value) => <MenuItem disabled={Boolean(pending)} key={value} value={value}>{value}</MenuItem>)}
                        </Select>
                      </FormControl>
                    )}
                    {!['hysteria2-udp', 'vless-xhttp-get'].includes(inbound.type) && (
                      <FormControl size="small" sx={{ width: 150, flexShrink: 0 }}>
                        <InputLabel>SNI</InputLabel>
                        <Select value={inbound.sni} label="SNI" onChange={(e) => handleInboundChange(inbound.id, 'sni', e.target.value)}>
                          <MenuItem disabled={Boolean(pending)} value="random">random</MenuItem>
                          {domains.map((domain) => <MenuItem disabled={Boolean(pending)} key={domain.id} value={domain.name}>{domain.name}</MenuItem>)}
                        </Select>
                      </FormControl>
                    )}
                  </>
                )}
                <IconButton color="primary" onClick={() => removeInbound(inbound.id)} disabled={Boolean(pending) || (inbounds.length <= 1)} sx={{ mt: 0.5, flexShrink: 0 }}>
                  <Delete />
                </IconButton>
              </Box>
            ))}
          </Box>
          {wizardStep === 1 && <Button variant="outlined" size="small" startIcon={<Add />} onClick={() => addInbound()} disabled={Boolean(pending) || (inbounds.length >= 20)}>Добавить инбаунд</Button>}
          {wizardStep === 2 && <><Typography variant="body2" sx={{ mb: 2 }}>Добавьте профили маршрутизации или пропустите этот шаг.</Typography><Button variant="outlined" size="small" startIcon={<Add />} sx={{ ml: 0.5 }} onClick={() => addInbound('happ-routing')} disabled={Boolean(pending) || (inbounds.length >= 20)}>Добавить роутинг Happ</Button>
          <Button variant="outlined" size="small" startIcon={<Add />} sx={{ ml: 0.5 }} onClick={() => addInbound('incy-routing')} disabled={Boolean(pending) || (inbounds.length >= 20)}>Добавить роутинг INCY</Button></>}
          <Button disabled={Boolean(pending)} variant="outlined" color="error" size="small" startIcon={<Remove />} sx={{ ml: 0.5 }} onClick={() => { setInbounds((prev) => prev.filter((item) => isRoutingProfile(item.type) !== (wizardStep === 2))); setPortErrors({}); }}>Удалить все</Button>
          </>}
        </DialogContent>
        <DialogActions>
          <Button disabled={Boolean(pending) || (saving)} onClick={() => setOpen(false)}>Отмена</Button>
          {wizardStep > 0 && <Button disabled={Boolean(pending) || (saving)} onClick={() => setWizardStep((step) => step - 1)}>Назад</Button>}
          {wizardStep < 2 ? <Button disabled={Boolean(pending)} onClick={handleNext} variant="contained">Далее</Button> : <Button disabled={Boolean(pending) || (saving)} onClick={handleSave} variant="contained" color="primary">{saving ? 'Сохранение…' : 'Сохранить'}</Button>}
        </DialogActions>
      </Dialog>

      <Dialog open={linksOpen} onClose={() => setLinksOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Активные ссылки</DialogTitle>
        <DialogContent>
          <TextField multiline fullWidth rows={10} value={currentLinks.join('\n\n')} slotProps={{ input: { readOnly: true, sx: { fontFamily: 'monospace', fontSize: 12 } } }} />
        </DialogContent>
        <DialogActions>
          <Button disabled={Boolean(pending)} onClick={() => copyToClipboard(currentLinks.join('\n'))}>Копировать все</Button>
          <Button disabled={Boolean(pending)} onClick={() => setLinksOpen(false)}>Закрыть</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmDialog.open} onClose={() => { setConfirmDialog({ ...confirmDialog, open: false }); setForceRotation(false); }}>
        <DialogTitle>Подтверждение</DialogTitle>
        <DialogContent>
          <Typography>{confirmDialog.title}</Typography>
          {confirmDialog.confirmColor === 'primary' && (
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 2 }}>
              <Switch disabled={Boolean(pending)} checked={forceRotation} onChange={(e) => setForceRotation(e.target.checked)} slotProps={{ input: { 'aria-label': 'Принудительная ротация' } }} />
              <Typography variant="body2">
                Принудительно (не удалять старые конфиги с 3x-ui)
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={Boolean(pending)} onClick={() => { setConfirmDialog({ ...confirmDialog, open: false }); setForceRotation(false); }}>Отмена</Button>
          <Button disabled={Boolean(pending)} onClick={() => { setConfirmDialog({ ...confirmDialog, open: false }); confirmDialog.onConfirm(forceRotation); }} variant="contained" color={confirmDialog.confirmColor}>
            {confirmDialog.confirmText}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteFailure !== null} onClose={() => { if (!deleting) setDeleteFailure(null); }}>
        <DialogTitle>Не удалось удалить все инбаунды</DialogTitle>
        <DialogContent>
          <Typography>{deleteFailure?.message}</Typography>
          <Typography sx={{ mt: 2 }}>При принудительном удалении подписка будет удалена, даже если часть инбаундов осталась в 3x-ui. Уже удалённые инбаунды при отмене не восстанавливаются.</Typography>
        </DialogContent>
        <DialogActions>
          <Button disabled={Boolean(pending) || (deleting)} onClick={() => setDeleteFailure(null)}>Отменить</Button>
          <Button disabled={Boolean(pending) || (deleting)} color="error" variant="contained" onClick={() => { if (deleteFailure) void deleteSubscription(deleteFailure.id, true); }}>Удалить принудительно</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={createdSubscriptionId !== null} onClose={() => setCreatedSubscriptionId(null)}>
        <DialogTitle>Подписка создана</DialogTitle>
        <DialogContent><Typography>Сгенерировать подключения сейчас?</Typography></DialogContent>
        <DialogActions>
          <Button disabled={Boolean(pending)} onClick={() => setCreatedSubscriptionId(null)}>Нет</Button>
          <Button disabled={Boolean(pending)} onClick={handleGenerateCreatedSubscription} variant="contained">Да</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open && !pending} autoHideDuration={6000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.type} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
