export interface XuiResponse<T = unknown> {
  success: boolean;
  msg?: string;
  obj?: T;
}

export interface XuiInbound {
  id: number;
  enable: boolean;
  up: number;
  down: number;
  total: number;
  remark: string;
  expiryTime: number;
  clientStats: unknown[];
  port: number;
  protocol: string;
  settings: string;
  streamSettings: string;
  sniffing: string;
  listen: string;
}

export interface XuiInboundRaw {
  id?: number;
  enable?: boolean;
  port: number;
  protocol: string;
  settings: string;
  streamSettings: string;
  remark?: string;
}

export interface XuiInboundClient {
  id?: string;
  flow?: string;
  email?: string;
  limitIp?: number;
  totalGB?: number;
  expiryTime?: number;
  enable?: boolean;
  tgId?: number;
  subId?: string;
  reset?: number;
  password?: string;
}

export interface XuiRealitySettings {
  show: boolean;
  xver: number;
  target: string;
  dest: string;
  serverNames: string[];
  privateKey: string;
  shortIds: string[];
  settings?: {
    publicKey: string;
    fingerprint: string;
  };
}

export interface XuiCertResult {
  privateKey: string;
  publicKey: string;
}

export interface XuiDiscoveredNode {
  name?: string;
  host: string;
  port: number;
  protocol: 'http' | 'https';
  version?: string;
}
