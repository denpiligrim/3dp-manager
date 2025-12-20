import crypto from "crypto";

export function buildShadowsocksTcp({ port, uuid }) {
  return {
    enable: true,
    port,
    protocol: "shadowsocks",
    remark: "shadowsocks-tcp",
    settings: JSON.stringify({
      clients: [{
        id: "",
        flow: "",
        email: uuid,
        password: crypto.randomBytes(32).toString("base64"),
        enable: true,
        limitIp: 0,
        totalGB: 0,
        expiryTime: 0,
        tgId: "",
        subId: "",
        reset: 0
      }],
      ivCheck: false,
      method: "2022-blake3-aes-256-gcm",
      network: "tcp",
      password: crypto.randomBytes(32).toString("base64")
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