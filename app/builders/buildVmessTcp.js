export function buildVmessTcp({ port, uuid }) {
  return {
    enable: true,
    port,
    protocol: "vmess",
    remark: "vmess-tcp",
    settings: JSON.stringify({
      clients: [{
        id: uuid,
        flow: "",
        email: uuid,
        enable: true,
        limitIp: 0,
        totalGB: 0,
        expiryTime: 0,
        tgId: "",
        subId: "0",
        alterId: "0",
        reset: 0
      }],
    }),
    streamSettings: JSON.stringify({
      network: "tcp",
      security: "none",
      tcpSettings: {
        acceptProxyProtocol: false,
        header: { type: "none" }
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