export interface XuiInboundRaw {
  id?: number;
  enable?: boolean;
  port: number;
  protocol: string;
  settings: string; // JSON string
  streamSettings: string; // JSON string
  remark?: string;
}

export interface XuiInboundSettings {
  clients?: Array<{
    id?: string;
    password?: string;
    email?: string;
    flow?: string;
    enable?: boolean;
    limitIp?: number;
    totalGB?: number;
    expiryTime?: number;
    tgId?: number;
    subId?: string;
    reset?: number;
  }>;
  decryption?: string;
  encryption?: string;
  fallbacks?: unknown[];
  method?: string;
  password?: string;
}

export interface XuiStreamSettings {
  network: string;
  security?: string;
  externalProxy?: unknown[];
  realitySettings?: {
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
  };
  wsSettings?: {
    path: string;
    headers?: {
      Host?: string;
    };
  };
  grpcSettings?: {
    serviceName: string;
    authority?: string;
  };
  xhttpSettings?: {
    path: string;
    host?: string;
    mode?: string;
  };
}
