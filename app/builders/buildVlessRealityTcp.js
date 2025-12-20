import crypto from "crypto";

export function buildVlessRealityTcp({ port, uuid, domain, keys }) {
  return {
    enable: true,
    port,
    protocol: "vless",
    remark: "vless-reality-tcp",
    settings: JSON.stringify({
      clients: [{
        id: uuid,
        flow: "xtls-rprx-vision",
        email: uuid,
        enable: true,
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