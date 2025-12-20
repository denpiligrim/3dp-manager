import crypto from "crypto";

export function buildVlessRealityXhttp({ port, uuid, domain, keys }) {
  return {
    enable: true,
    port,
    protocol: "vless",
    remark: "vless-reality-xhttp",
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
      network: "xhttp",
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
      xhttpSettings: {
        host: domain,
        path: "/",
        mode: "auto",
        noSSEHeader: false,
        scMaxBufferedPosts: 30,
        scMaxEachPostBytes: "1000000",
        scStreamUpServerSecs: "20-80",
        xPaddingBytes: "100-1000"
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