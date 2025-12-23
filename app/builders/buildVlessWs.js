export function buildVlessWs({ port, uuid, domain }) {
  return {
    enable: true,
    port,
    protocol: "vless",
    remark: "vless-reality-ws",
    settings: JSON.stringify({
      clients: [{
        id: uuid,
        email: uuid,        
        enable: true,
        flow: "",
        limitIp: 0,
        totalGB: 0,
        expiryTime: 0,
        tgId: "",
        subId: "",
        reset: 0
      }],
      decryption: "none",
      encryption: "none",
      fallbacks: []
    }),
    streamSettings: JSON.stringify({
      network: "ws",
      security: "none",
      externalProxy: [],
      wsSettings: {
        host: domain,
        path: "/",
        acceptProxyProtocol: false,
        heartbeatPeriod: 0,
      }
    }),
    sniffing: JSON.stringify({
      enabled: false,
      destOverride: ["http", "tls", "quic", "fakedns"],
      metadataOnly: false,
      routeOnly: false
    })
  };
}