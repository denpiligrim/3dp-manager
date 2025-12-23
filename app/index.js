import axios from "axios";
import cron from "node-cron";
import fs from "fs";
import net from "net";
import { buildVlessRealityTcp } from "./builders/buildVlessRealityTcp.js";
import { buildVlessRealityXhttp } from "./builders/buildVlessRealityXhttp.js";
import { buildTrojanRealityTcp } from "./builders/buildTrojanRealityTcp.js";
import { buildShadowsocksTcp } from "./builders/buildShadowsocksTcp.js";
import { buildVmessTcp } from "./builders/buildVmessTcp.js";
import { buildVlessRealityGrpc } from "./builders/buildVlessRealityGrpc.js";
import { buildVlessWs } from "./builders/buildVlessWs.js";
import { buildInboundLink } from "./builders/buildInboundLink.js";

const { UI_URL, UI_LOGIN, UI_PASSWORD, UI_HOST } = process.env;
const SUB_FILE = "/subscriptions/list.txt";

const cookieJar = {};
const api = axios.create({ baseURL: UI_URL, timeout: 15000, withCredentials: true });

api.interceptors.request.use(config => {
  if (cookieJar.value) config.headers['Cookie'] = cookieJar.value;
  return config;
});

const WHITELIST_FILE = "/app/whitelist.txt";
const WHITELIST_REPO_URL = "https://raw.githubusercontent.com/denpiligrim/3dp-manager/dp-fix/whitelist.txt";

// Вспомогательные функции
async function updateWhitelist() {
  try {
    const res = await axios.get(WHITELIST_REPO_URL, { timeout: 10000 });
    fs.writeFileSync(WHITELIST_FILE, res.data, "utf8");
    console.log("✔ whitelist.txt обновлен из репозитория");
  } catch (err) {
    console.warn("⚠ Не удалось обновить whitelist.txt, будет использоваться локальный файл:", err.message);
  }
}

function loadWhitelist() {
  let fileToUse = WHITELIST_FILE;

  if (fs.existsSync("/app/my_whitelist.txt")) {
    console.log('Найден кастомный whitelist: /app/my_whitelist.txt. Используется он.');
    fileToUse = "/app/my_whitelist.txt";
  } else {
    console.log(`Кастомный whitelist не найден. Используется дефолтный: ${WHITELIST_FILE}`);
    if (!fs.existsSync(WHITELIST_FILE)) {
      throw new Error("Дефолтный whitelist.txt не найден");
    }
  }

  return fs.readFileSync(fileToUse, "utf8")
    .split("\n")
    .map(v => v.trim())
    .filter(Boolean);
}

function pickDomain(list) {
  return list[Math.floor(Math.random() * list.length)];
}

async function isPortFree(port) {
  return new Promise(resolve => {
    const s = net.createServer()
      .once("error", () => resolve(false))
      .once("listening", () => {
        s.close();
        resolve(true);
      })
      .listen(port, "0.0.0.0");
  });
}

async function getFreePort(used) {
  while (true) {
    const p = Math.floor(Math.random() * (60000 - 10000)) + 10000;
    if (used.has(p)) continue;
    if (await isPortFree(p)) return p;
  }
}

async function generateRealityKeys() {
  try {
    const res = await api.get("/panel/api/server/getNewX25519Cert");
    if (res.data?.success && res.data?.obj) {
      return {
        privateKey: res.data.obj.privateKey,
        publicKey: res.data.obj.publicKey
      };
    }
    throw new Error("Invalid key response");
  } catch (e) {
    console.error("Failed to get Reality keys:", e.message);
    throw e;
  }
}

async function uuid() {
  try {
    const res = await api.get("/panel/api/server/getNewUUID");
    if (res.data?.success && res.data?.obj?.uuid) {
      return res.data.obj.uuid;
    }
    throw new Error("Invalid UUID response");
  } catch (e) {
    console.error("Failed to get UUID:", e.message);
    throw e;
  }
}

// API 3x-ui
async function login() {
  try {
    const res = await api.post("/login", { username: UI_LOGIN, password: UI_PASSWORD });
    if (res.headers['set-cookie']) cookieJar.value = res.headers['set-cookie'].join('; ');
    console.log("Login success");
  } catch (e) { console.error("Login failed:", e.message); throw e; }
}

async function getInbounds() {
  try {
    const res = await api.get("/panel/api/inbounds/list");
    return res.status === 200 ? res.data.obj || [] : [];
  } catch (e) { console.error("Get inbounds failed:", e.message); return []; }
}

async function deleteInbound(id) {
  try { await api.post(`/panel/api/inbounds/del/${id}`); } catch { }
}

async function addInbound(config) {
  try {
    const res = await api.post("/panel/api/inbounds/add", config);
    return res.data?.id || null;
  } catch (e) {
    console.error("Add inbound failed:", e.message);
    return null;
  }
}

// Основная ротация inbound'ов
async function rotate() {
  await login();

  await updateWhitelist();
  const whitelist = loadWhitelist();
  const usedPorts = new Set();
  const subs = [];

  const existing = await getInbounds();
  for (const i of existing) await deleteInbound(i.id);

  const builders = [
    async (d) => buildVlessRealityTcp({ port: await isPortFree(8443) ? 8443 : await getFreePort(usedPorts), uuid: await uuid(), domain: d, keys: await generateRealityKeys() }),
    async (d) => buildVlessRealityXhttp({ port: await isPortFree(443) ? 443 : await getFreePort(usedPorts), uuid: await uuid(), domain: d, keys: await generateRealityKeys() }),
    async (d) => buildVlessRealityGrpc({ port: await getFreePort(usedPorts), uuid: await uuid(), domain: d, keys: await generateRealityKeys() }),
    async (d) => buildVlessWs({ port: await getFreePort(usedPorts), uuid: await uuid(), domain: d }),
    async (d) => buildVlessRealityTcp({ port: await getFreePort(usedPorts), uuid: await uuid(), domain: d, keys: await generateRealityKeys() }),
    async (d) => buildVlessRealityTcp({ port: await getFreePort(usedPorts), uuid: await uuid(), domain: d, keys: await generateRealityKeys() }),
    async (d) => buildVlessRealityTcp({ port: await getFreePort(usedPorts), uuid: await uuid(), domain: d, keys: await generateRealityKeys() }),
    async (d) => buildVmessTcp({ port: await getFreePort(usedPorts), uuid: await uuid() }),
    async (d) => buildShadowsocksTcp({ port: await getFreePort(usedPorts), uuid: await uuid() }),
    async (d) => buildTrojanRealityTcp({ port: await getFreePort(usedPorts), uuid: await uuid(), domain: d, keys: await generateRealityKeys() }),
  ];

  for (const b of builders) {
    const domain = pickDomain(whitelist);
    const inbound = await b(domain);
    usedPorts.add(inbound.port);
    const idOrPass = inbound.settings ? JSON.parse(inbound.settings).clients?.[0]?.id || JSON.parse(inbound.settings).clients?.[0]?.password : "";

    // Формируем ссылку в зависимости от протокола
    const link = buildInboundLink(inbound, UI_HOST, idOrPass);
    if (link) subs.push(link);
    await addInbound(inbound);
  }

  fs.writeFileSync(SUB_FILE, subs.join("\n") + "\n", "utf8");
  console.log("✔ 10 inbound created, подписка обновлена");
}

// Первый запуск
rotate();

let interval = parseInt(process.env.ROTATE_INTERVAL) || 30;
if (interval < 10) interval = 10;

const cronExpression = `*/${interval} * * * *`;
cron.schedule(cronExpression, rotate);