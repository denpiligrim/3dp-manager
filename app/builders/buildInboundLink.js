export function buildInboundLink(inbound, domain, idOrPass) {
  let link = "";

  switch (inbound.protocol) {
    case "vless": {
      link = buildVlessLink(inbound, domain, idOrPass);
      break;
    }

    case "vmess": {
      link = buildVmessLink(inbound, domain, idOrPass);
      break;
    }

    case "shadowsocks":
      link = buildSsLink(inbound, domain, idOrPass);
      break;

    case "trojan":
      link = buildTrojanLink(inbound, domain, idOrPass);
      break;
  }

  return link;
}

function buildVlessLink(inbound, domain, uuid) {
  const stream = JSON.parse(inbound.streamSettings);
  const settings = JSON.parse(inbound.settings);

  const network = stream.network;
  const security = stream.security || "none";

  const params = new URLSearchParams();

  // Базовые параметры
  params.set("type", network);
  params.set("encryption", "none");
  params.set("security", security);

  /**
   * ===== REALITY =====
   */
  if (security === "reality") {
    const r = stream.realitySettings;

    params.set("pbk", r.settings.publicKey);
    params.set("fp", r.settings.fingerprint || "random");
    params.set("sni", r.serverNames?.[0] || "");
    params.set("sid", r.shortIds?.[0] || "");
    params.set("spx", '%2F');

    // TCP Reality flow
    if (network === "tcp") {
      const client = settings.clients?.[0];
      if (client?.flow) {
        params.set("flow", client.flow);
      }
    }

    // XHTTP Reality
    if (network === "xhttp") {
      const x = stream.xhttpSettings || {};
      params.set("path", x.path || "/");
      params.set("host", x.host || r.serverNames?.[0]);
      params.set("mode", x.mode || "auto");
    }

    // gRPC Reality
    if (network === "grpc") {
      const g = stream.grpcSettings || {};
      params.set("serviceName", g.serviceName || "grpc");
      params.set("authority", g.authority || r.serverNames?.[0]);
    }
  }

  /**
   * ===== WS NONE =====
   */
  if (network === "ws") {
    const ws = stream.wsSettings || {};
    params.set("path", ws.path || "/");
    if (ws.headers?.Host) {
      params.set("host", ws.headers.Host);
    }
  }

  return (
    `vless://${uuid}@${domain}:${inbound.port}` +
    `?${params.toString()}` +
    `#${encodeURIComponent(inbound.remark)}`
  );
}

function buildVmessLink(inbound, domain, uuid) {
  const stream = JSON.parse(inbound.streamSettings);

  const vmessObj = {
    add: domain,
    aid: '',
    alpn: "",
    fp: "",
    host: "",
    id: uuid,
    net: stream.network || "tcp",
    path: "/",
    port: inbound.port,
    ps: inbound.remark,
    scy: "",
    sni: "",
    tls: stream.security || "none",
    type: "none",
    v: "2"
  };

  const base64 = Buffer
    .from(JSON.stringify(vmessObj), "utf8")
    .toString("base64");

  return `vmess://${base64}`;
}

function buildSsLink(inbound, domain) {
  const settings = JSON.parse(inbound.settings);

  const method = settings.method;
  const serverPassword = settings.password;
  const clientPassword = settings.clients[0].password;

  // method:serverPassword:clientPassword
  const userInfo = `${method}:${serverPassword}:${clientPassword}`;

  const base64 = Buffer
    .from(userInfo, "utf8")
    .toString("base64");

  return `ss://${base64}@${domain}:${inbound.port}?type=tcp#${inbound.remark}`;
}

function buildTrojanLink(inbound, domain, password) {
  const stream = JSON.parse(inbound.streamSettings);
  const reality = stream.realitySettings;

  const pbk = reality.settings.publicKey;
  const sni = reality.serverNames?.[0] || domain;
  const sid = reality.shortIds?.[0] || "";
  const spx = '%2F';

  return (
    `trojan://${password}@${domain}:${inbound.port}` +
    `?type=tcp` +
    `&security=reality` +
    `&pbk=${pbk}` +
    `&fp=random` +
    `&sni=${sni}` +
    `&sid=${sid}` +
    `&spx=${spx}` +
    `#${inbound.remark}-${password}`
  );
}