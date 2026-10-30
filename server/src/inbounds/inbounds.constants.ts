export const CONNECTION_TYPES = [
  'vless-tcp-reality',
  'vless-xhttp-reality',
  'vless-xhttp-get',
  'vless-grpc-reality',
  'vless-ws',
  'vmess-tcp',
  'shadowsocks-tcp',
  'trojan-tcp-reality',
  'hysteria2-udp',
  'custom',
] as const;

export type ConnectionType = (typeof CONNECTION_TYPES)[number];
