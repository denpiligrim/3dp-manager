import crypto from "crypto";

export function buildTrojanRealityTcp({ port, uuid, domain, keys }) {
  return {
    enable: true,
    port,
    protocol: "trojan",
    remark: "trojan-reality-tcp",
    settings: JSON.stringify({
      clients: [{
        id: uuid,
        email: uuid,
        password: crypto.randomBytes(8).toString("hex"),
        enable: true,
        flow: "",
        limitIp: 0,
        totalGB: 0,
        expiryTime: 0,
        tgId: "",
        subId: "",
        reset: 0
      }],
      fallbacks: []
    }),
    streamSettings: JSON.stringify({
      network: "tcp",
      security: "reality",
      externalProxy: [],
      realitySettings: {
        show: false,
        xver: 0,
        target: `${domain}:443`,
        dest: `${domain}:443`,
        serverNames: [domain],
        privateKey: keys.privateKey,
        shortIds: [
          crypto.randomBytes(4).toString("hex"),
          crypto.randomBytes(3).toString("hex"),
          crypto.randomBytes(8).toString("hex"),
          crypto.randomBytes(2).toString("hex"),
          crypto.randomBytes(2).toString("hex"),
          crypto.randomBytes(2).toString("hex"),
          crypto.randomBytes(2).toString("hex"),
          crypto.randomBytes(4).toString("hex")
        ],
        settings: {
          publicKey: keys.publicKey,
          fingerprint: "random",
          serverName: "",
          spiderX: "/"
        }
      },
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