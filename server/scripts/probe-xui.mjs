#!/usr/bin/env node
/**
 * Standalone 3x-ui compatibility probe for 3dp-manager.
 *
 * Reproduces exactly what RotationService does — login, fetch Reality keys,
 * then POST /panel/api/inbounds/add for each connection type — and prints the
 * panel's verbatim rejection message per type. No DB, no Nest context, no deps.
 *
 * Usage:
 *   node probe-xui.mjs --url https://panel.example.com:2053/abc --user admin --pass secret
 *   node probe-xui.mjs --url https://panel.example.com:2053/abc --token <api-token>
 *
 * Optional:
 *   --sni www.cloudflare.com   Reality/TLS SNI to test with (default: www.cloudflare.com)
 *   --keep                     Do not delete inbounds the probe creates
 */

import crypto from 'node:crypto';

const args = process.argv.slice(2);
const argOf = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const hasFlag = (name) => args.includes(`--${name}`);

const BASE = (argOf('url') || process.env.XUI_URL || '').replace(/\/+$/, '');
const USER = argOf('user') || process.env.XUI_USER;
const PASS = argOf('pass') || process.env.XUI_PASS;
const TOKEN = argOf('token') || process.env.XUI_TOKEN;
const SNI = argOf('sni') || 'www.cloudflare.com';
const KEEP = hasFlag('keep');

if (!BASE || (!TOKEN && (!USER || !PASS))) {
  console.error('Usage: node probe-xui.mjs --url <panel-url> (--user <u> --pass <p> | --token <t>)');
  process.exit(2);
}

// Self-signed panel certs are the norm; this probe is a diagnostic, not a
// security boundary.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const uuid = () => crypto.randomUUID();
const hex = (n) => crypto.randomBytes(n).toString('hex');
const b64 = (n) => crypto.randomBytes(n).toString('base64');
const randomPort = () => Math.floor(Math.random() * (60000 - 20000 + 1)) + 20000;

const state = { cookie: '', csrf: '' };

function mergeCookies(setCookie) {
  if (!setCookie) return;
  const jar = new Map();
  for (const part of state.cookie.split('; ').filter(Boolean)) {
    const eq = part.indexOf('=');
    if (eq > 0) jar.set(part.slice(0, eq), part.slice(eq + 1));
  }
  for (const raw of setCookie) {
    const first = raw.split(';')[0];
    const eq = first.indexOf('=');
    if (eq > 0) jar.set(first.slice(0, eq).trim(), first.slice(eq + 1));
  }
  state.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
}

async function call(method, path, body) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  if (state.cookie) headers.Cookie = state.cookie;
  if (state.csrf) headers['X-CSRF-Token'] = state.csrf;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
  mergeCookies(res.headers.getSetCookie?.() ?? []);

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: res.status, json, text, headers: res.headers };
}

// ---------------------------------------------------------------------------
// Payload builders — copied verbatim from inbound-builder.service.ts so the
// probe exercises the same bytes the manager sends.
// ---------------------------------------------------------------------------
const sniffing = () =>
  JSON.stringify({
    enabled: false,
    destOverride: ['http', 'tls', 'quic', 'fakedns'],
    metadataOnly: false,
    routeOnly: false,
  });

const client = (id, extra = {}) => ({
  id,
  email: id,
  enable: true,
  flow: '',
  limitIp: 0,
  totalGB: 0,
  expiryTime: 0,
  tgId: 0,
  subId: '',
  reset: 0,
  ...extra,
});

const realitySettings = (sni, keys, shortIds) => ({
  show: false,
  xver: 0,
  target: `${sni}:443`,
  dest: `${sni}:443`,
  serverNames: [sni],
  privateKey: keys.privateKey,
  shortIds,
  settings: {
    publicKey: keys.publicKey,
    fingerprint: 'random',
    serverName: '',
    spiderX: '/',
  },
});

function buildCases(keys) {
  return [
    {
      type: 'vless-tcp-reality',
      build: (port, id) => ({
        enable: true,
        port,
        protocol: 'vless',
        remark: 'probe-vless-tcp-reality',
        settings: JSON.stringify({
          clients: [client(id, { flow: 'xtls-rprx-vision' })],
          decryption: 'none',
          encryption: 'none',
          fallbacks: [],
        }),
        streamSettings: JSON.stringify({
          network: 'tcp',
          security: 'reality',
          externalProxy: [],
          realitySettings: realitySettings(SNI, keys, [hex(4), hex(4)]),
          tcpSettings: { acceptProxyProtocol: false, header: { type: 'none' } },
        }),
        sniffing: sniffing(),
      }),
    },
    {
      type: 'vless-xhttp-reality',
      build: (port, id) => ({
        enable: true,
        port,
        protocol: 'vless',
        remark: 'probe-vless-xhttp-reality',
        settings: JSON.stringify({
          clients: [client(id)],
          decryption: 'none',
          encryption: 'none',
          fallbacks: [],
        }),
        streamSettings: JSON.stringify({
          network: 'xhttp',
          security: 'reality',
          externalProxy: [],
          realitySettings: realitySettings(SNI, keys, [hex(4), hex(4)]),
          xhttpSettings: {
            host: SNI,
            path: '/',
            mode: 'auto',
            noSSEHeader: false,
            scMaxBufferedPosts: 30,
            scMaxEachPostBytes: '1000000',
            scStreamUpServerSecs: '20-80',
            xPaddingBytes: '100-1000',
          },
        }),
        sniffing: sniffing(),
      }),
    },
    {
      type: 'vless-grpc-reality',
      build: (port, id) => ({
        enable: true,
        port,
        protocol: 'vless',
        remark: 'probe-vless-grpc-reality',
        settings: JSON.stringify({
          clients: [client(id)],
          decryption: 'none',
          encryption: 'none',
          fallbacks: [],
        }),
        streamSettings: JSON.stringify({
          network: 'grpc',
          security: 'reality',
          externalProxy: [],
          realitySettings: realitySettings(SNI, keys, [hex(4)]),
          grpcSettings: { serviceName: 'myservice', authority: SNI, multiMode: false },
        }),
        sniffing: sniffing(),
      }),
    },
    {
      type: 'vless-ws',
      build: (port, id) => ({
        enable: true,
        port,
        protocol: 'vless',
        remark: 'probe-vless-ws',
        settings: JSON.stringify({
          clients: [client(id)],
          decryption: 'none',
          encryption: 'none',
          fallbacks: [],
        }),
        streamSettings: JSON.stringify({
          network: 'ws',
          security: 'none',
          externalProxy: [],
          wsSettings: { host: SNI, path: '/', acceptProxyProtocol: false, heartbeatPeriod: 0 },
        }),
        sniffing: sniffing(),
      }),
    },
    {
      type: 'vmess-tcp',
      build: (port, id) => ({
        enable: true,
        port,
        protocol: 'vmess',
        remark: 'probe-vmess-tcp',
        settings: JSON.stringify({
          clients: [client(id, { subId: '0', alterId: '0' })],
        }),
        streamSettings: JSON.stringify({
          network: 'tcp',
          security: 'none',
          tcpSettings: { acceptProxyProtocol: false, header: { type: 'none' } },
        }),
        sniffing: sniffing(),
      }),
    },
    {
      type: 'shadowsocks-tcp',
      build: (port, id) => ({
        enable: true,
        port,
        protocol: 'shadowsocks',
        remark: 'probe-shadowsocks-tcp',
        settings: JSON.stringify({
          clients: [client('', { email: id, password: b64(32) })],
          ivCheck: false,
          method: '2022-blake3-aes-256-gcm',
          network: 'tcp',
          password: b64(32),
        }),
        streamSettings: JSON.stringify({
          network: 'tcp',
          security: 'none',
          tcpSettings: { acceptProxyProtocol: false, header: { type: 'none' } },
        }),
        sniffing: sniffing(),
      }),
    },
    {
      type: 'trojan-tcp-reality',
      build: (port, id) => ({
        enable: true,
        port,
        protocol: 'trojan',
        remark: 'probe-trojan-tcp-reality',
        settings: JSON.stringify({
          clients: [client(id, { password: hex(8) })],
          fallbacks: [],
        }),
        streamSettings: JSON.stringify({
          network: 'tcp',
          security: 'reality',
          externalProxy: [],
          realitySettings: realitySettings(SNI, keys, [
            hex(4), hex(3), hex(8), hex(2), hex(2), hex(2), hex(2), hex(4),
          ]),
          tcpSettings: { acceptProxyProtocol: false, header: { type: 'none' } },
        }),
        sniffing: sniffing(),
      }),
    },
    {
      type: 'hysteria2-udp',
      build: (port, id) => ({
        enable: true,
        port,
        protocol: 'hysteria',
        remark: 'probe-hysteria2-udp',
        settings: JSON.stringify({
          clients: [{ auth: id, email: id, enable: true }],
          version: 2,
        }),
        streamSettings: JSON.stringify({
          network: 'hysteria',
          security: 'tls',
          finalmask: { udp: [{ settings: { password: hex(8) }, type: 'salamander' }] },
          hysteriaSettings: {
            auth: id,
            masquerade: {
              content: '', dir: '', headers: {}, rewriteHost: false,
              statusCode: 0, type: 'proxy', url: 'https://google.com',
            },
            udpIdleTimeout: 60,
            version: 2,
          },
          tlsSettings: {
            serverName: SNI,
            alpn: ['h3'],
            certificates: [{
              buildChain: false,
              certificateFile: `/root/cert/${SNI}/fullchain.pem`,
              keyFile: `/root/cert/${SNI}/privkey.pem`,
              oneTimeLoading: false,
              usage: 'encipherment',
            }],
            cipherSuites: '',
            disableSystemRoot: false,
            echForceQuery: 'none',
            echServerKeys: '',
            enableSessionResumption: false,
            maxVersion: '1.3',
            minVersion: '1.2',
            rejectUnknownSni: false,
          },
        }),
        sniffing: sniffing(),
      }),
    },
  ];
}

// ---------------------------------------------------------------------------

async function authenticate() {
  if (TOKEN) {
    console.log('Auth mode: Bearer API token (CSRF is bypassed for api_authed callers)');
    return true;
  }

  console.log('Auth mode: login + password (session cookie)');

  // 3x-ui >= v3.6.0 guards POST /login with CSRFMiddleware. GET /csrf-token is
  // public and seeds both the session cookie and the token.
  const pre = await call('GET', '/csrf-token');
  if (pre.status === 200 && pre.json?.obj) {
    state.csrf = pre.json.obj;
    console.log(`CSRF token endpoint: present (token acquired)`);
  } else {
    console.log(`CSRF token endpoint: absent (status ${pre.status}) — older panel, no CSRF needed`);
  }

  const res = await call('POST', '/login', { username: USER, password: PASS });
  if (res.status === 403) {
    console.error('LOGIN FAILED 403 — CSRF rejected. This alone breaks all inbound creation.');
    return false;
  }
  if (!res.json?.success) {
    console.error(`LOGIN FAILED status=${res.status} msg=${res.json?.msg ?? res.text.slice(0, 200)}`);
    return false;
  }
  console.log('Login OK');

  // Session id rotates on login; refresh the token bound to the new session.
  const post = await call('GET', '/csrf-token');
  if (post.status === 200 && post.json?.obj) state.csrf = post.json.obj;
  return true;
}

async function main() {
  console.log(`Panel: ${BASE}`);
  console.log(`SNI:   ${SNI}\n`);

  if (!(await authenticate())) process.exit(1);

  const list = await call('GET', '/panel/api/inbounds/list');
  console.log(`\n/panel/api/inbounds/list -> status ${list.status}, success=${list.json?.success}`);
  if (list.status === 404 || list.status === 401 || list.status === 403) {
    console.error('Cannot reach the inbounds API — check the panel base path / credentials.');
    process.exit(1);
  }

  const certRes = await call('GET', '/panel/api/server/getNewX25519Cert');
  const keys = certRes.json?.obj;
  console.log(`getNewX25519Cert -> status ${certRes.status}, keys=${JSON.stringify(keys)}`);
  if (!keys?.privateKey || !keys?.publicKey) {
    console.error('\nReality keys missing or renamed. RotationService aborts the whole');
    console.error('subscription when this call fails, so NO inbounds would be created.');
    if (!keys) process.exit(1);
  }

  const results = [];
  for (const testCase of buildCases(keys ?? {})) {
    const port = randomPort();
    const payload = testCase.build(port, uuid());
    const res = await call('POST', '/panel/api/inbounds/add', payload);
    const ok = Boolean(res.json?.success);
    const id = res.json?.obj?.id ?? null;

    results.push({
      type: testCase.type,
      port,
      status: res.status,
      ok,
      id,
      msg: ok ? '' : (res.json?.msg ?? res.text.slice(0, 300)).replace(/\s+/g, ' ').trim(),
    });

    if (ok && id && !KEEP) await call('POST', `/panel/api/inbounds/del/${id}`);
  }

  console.log('\n================ RESULTS ================');
  console.table(results.map(({ type, status, ok, msg }) => ({ type, status, ok, msg })));

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} inbound types accepted.`);
  if (failed.length) {
    console.log('\nFailures in detail:');
    for (const f of failed) console.log(`\n--- ${f.type} (HTTP ${f.status}) ---\n${f.msg}`);
  }
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
