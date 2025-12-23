#!/usr/bin/env bash
set -euo pipefail

#################################
# TRAP
#################################
trap 'echo -e "\033[1;31m[ERROR]\033[0m Ошибка в строке $LINENO"; exit 1' ERR

#################################
# HELPERS
#################################
log() { echo -e "\033[1;32m[INFO]\033[0m $1"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $1"; }
die() { echo -e "\033[1;31m[ERROR]\033[0m $1"; exit 1; }

[[ $EUID -eq 0 ]] || die "Запускать нужно от root"

#################################
# ASCII-баннер
#################################
echo "==================================================="
echo "    ____             ____  _ ___            _         "
echo "   / __ \___  ____  / __ \(_) (_)___ ______(_)___ ___ "
echo "  / / / / _ \/ __ \/ /_/ / / / / __ \/ ___/ / __ \`__ \ "
echo " / /_/ /  __/ / / / ____/ / / / /_/ / /  / / / / / / /"
echo "/_____/\___/_/ /_/_/   /_/_/_/\__, /_/  /_/_/ /_/ /_/ "
echo "                             /____/                   "
echo ""
echo "        3DP-MANAGER SUBSCRIPTION FORWARDER         "
echo "==================================================="
echo ""

#################################
# INPUT
#################################
read -rp "URL исходной подписки: " ORIGIN_SUB_URL
[[ "$ORIGIN_SUB_URL" =~ ^https?:// ]] || die "Некорректный URL подписки"

read -rp "Домен или IP этого сервера (Enter = авто IP): " LOCAL_HOST
if [[ -z "$LOCAL_HOST" ]]; then
  LOCAL_HOST=$(hostname -I | awk '{print $1}' | tr -d '[:space:]')
fi

#################################
# PARSE URL
#################################
ORIGIN_PROTO=$(echo "$ORIGIN_SUB_URL" | awk -F: '{print $1}')
ORIGIN_HOST=$(echo "$ORIGIN_SUB_URL" | awk -F[/:] '{print $4}')
ORIGIN_PORT=$(echo "$ORIGIN_SUB_URL" | awk -F[:] '{print $3}' | awk -F/ '{print $1}')
SUB_PATH="/$(echo "$ORIGIN_SUB_URL" | cut -d/ -f4-)"

#################################
# Определяем ORIGIN_IP
#################################
if [[ "$ORIGIN_HOST" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
    ORIGIN_IP="$ORIGIN_HOST"
    log "Используем прямой IP из URL: $ORIGIN_IP"
else
    log "Разрешаем домен $ORIGIN_HOST в IP..."

    ORIGIN_IP=$(getent ahosts "$ORIGIN_HOST" | awk '/^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/ {print $1; exit}')

    [[ -z "$ORIGIN_IP" ]] && ORIGIN_IP=$(getent hosts "$ORIGIN_HOST" | awk '{print $1; exit}')

    if [[ -z "$ORIGIN_IP" ]] && command -v dig >/dev/null; then
        ORIGIN_IP=$(dig +short "$ORIGIN_HOST" | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -n1)
    fi

    [[ -n "$ORIGIN_IP" ]] || die "Не удалось разрешить домен в IP: $ORIGIN_HOST. Проверьте DNS или укажите IP вручную."
    
    log "Домен $ORIGIN_HOST разрешён в IP: $ORIGIN_IP"
fi

[[ -n "$ORIGIN_IP" && -n "$ORIGIN_PORT" && -n "$SUB_PATH" ]] || die "Ошибка парсинга URL подписки"

#################################
# HTTPS CHECK
#################################
USE_HTTPS=false
CERT_PATH=""
KEY_PATH=""

if [[ "$LOCAL_HOST" != "$(hostname -I | awk '{print $1}' | tr -d '[:space:]')" ]]; then
  if [[ -d "/etc/letsencrypt/live/$LOCAL_HOST" ]]; then
    CERT_PATH="/etc/letsencrypt/live/$LOCAL_HOST/fullchain.pem"
    KEY_PATH="/etc/letsencrypt/live/$LOCAL_HOST/privkey.pem"
    USE_HTTPS=true
    log "Найдены сертификаты Let's Encrypt"
  else
    warn "Сертификаты Let's Encrypt не найдены"
    read -rp "Путь к fullchain.pem (Enter = HTTP): " CERT_PATH
    if [[ -n "$CERT_PATH" ]]; then
      read -rp "Путь к privkey.pem: " KEY_PATH
      [[ -f "$CERT_PATH" && -f "$KEY_PATH" ]] || die "Файлы сертификатов не найдены"
      USE_HTTPS=true
    fi
  fi
fi

#################################
# PROJECT DIR
#################################
BASE_DIR="/opt/3dp-manager"
NODE_DIR="$BASE_DIR/node"

mkdir -p "$NODE_DIR"
cd "$BASE_DIR"

#################################
# DOWNLOAD FILES
#################################
REPO="https://raw.githubusercontent.com/denpiligrim/3dp-manager/dp-fix"
NGINX_PORT=$ORIGIN_PORT
SUB_URL="$ORIGIN_PROTO://$LOCAL_HOST:$NGINX_PORT$SUB_PATH"

#################################
# ENV
#################################
cat > .env <<EOF
ORIGIN_SUB_URL=$ORIGIN_SUB_URL
ORIGIN_HOST=$ORIGIN_HOST
ORIGIN_PORT=$ORIGIN_PORT
LOCAL_HOST=$LOCAL_HOST
SUB_URL=$SUB_URL
EOF

#################################
# node files
#################################
cat > node/package.json <<EOF
{
  "type": "module",
  "dependencies": {
    "axios": "^1.13.2",
    "express": "^5.2.1"
  }
}
EOF

cat > node/Dockerfile <<EOF
FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install --production
COPY index.js .
CMD ["node", "index.js"]
EOF

cat > node/index.js <<'EOF'
import express from "express";
import axios from "axios";

const app = express();

const {
  ORIGIN_SUB_URL,
  LOCAL_HOST
} = process.env;

app.get("/bus/:token", async (req, res) => {
  try {
    const url = ORIGIN_SUB_URL;
    const r = await axios.get(url, { timeout: 15000 });
    let data = r.data;

    // vmess base64
    const lines = data.split("\n").map(l => {
      if (l.startsWith("vmess://")) {
        const obj = JSON.parse(Buffer.from(l.slice(8), "base64").toString());
        obj.add = LOCAL_HOST;
        return "vmess://" + Buffer.from(JSON.stringify(obj)).toString("base64");
      }
      // остальные протоколы — замена хоста
      return l.replace(/@([^:/?#]+)/, `@${LOCAL_HOST}`);
    });

    res.type("text/plain").send(lines.join("\n"));
  } catch (e) {
    res.status(500).send("subscription error");
  }
});

app.listen(3000, () => {
  console.log("sub-forwarder started");
});
EOF

#################################
# NGINX  & DOCKER COMPOSE
#################################
if $USE_HTTPS; then
cat > nginx.conf <<EOF
events {}
http {
  server {
    listen $NGINX_PORT ssl;
    server_name $LOCAL_HOST;

    ssl_certificate $CERT_PATH;
    ssl_certificate_key $KEY_PATH;

    location $SUB_PATH {
      proxy_pass http://127.0.0.1:3000;
      proxy_http_version 1.1;

      proxy_set_header Host \$host;
      proxy_set_header X-Real-IP \$remote_addr;
      proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;

      add_header Subscription-Userinfo "upload=0; download=0; total=109951162777600; expire=0" always;
      add_header Access-Control-Allow-Origin *;
    }
  }
}
EOF

cat > docker-compose.yml <<EOF
services:
  node:
    build: ./node
    env_file: .env
    restart: unless-stopped
    network_mode: host
    container_name: node

  nginx:
    image: nginx:alpine
    container_name: nginx
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - $CERT_PATH:$CERT_PATH:ro
      - $KEY_PATH:$KEY_PATH:ro
    network_mode: host
    depends_on:
      - node
EOF
else
cat > nginx.conf <<EOF
events {}
http {
  server {
    listen $NGINX_PORT;
    server_name $LOCAL_HOST;

    location $SUB_PATH {
      proxy_pass http://127.0.0.1:3000;
      proxy_http_version 1.1;

      proxy_set_header Host \$host;
      proxy_set_header X-Real-IP \$remote_addr;
      proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;

      add_header Subscription-Userinfo "upload=0; download=0; total=109951162777600; expire=0" always;
      add_header Access-Control-Allow-Origin *;
    }
  }
}
EOF

cat > docker-compose.yml <<EOF
services:
  node:
    build: ./node
    env_file: .env
    restart: unless-stopped
    network_mode: host
    container_name: node

  nginx:
    image: nginx:alpine
    container_name: nginx
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    network_mode: host
    depends_on:
      - node
EOF
fi

#################################
# DOCKER
#################################
log "Проверка Docker"

if command -v docker >/dev/null 2>&1; then
    log "Docker уже установлен"
else
    log "Docker не найден, будет установлен"
    apt update
    apt install -y docker.io || die "Ошибка установки docker.io"
    systemctl enable docker
    systemctl restart docker
fi

if docker compose version >/dev/null 2>&1; then
    log "docker compose v2 доступен"
else
    log "Устанавливаем docker-compose-v2"
    apt install -y --allow-downgrades --allow-remove-essential --allow-change-held-packages \
        docker-compose-v2 || warn "docker-compose-v2 не установлен, возможно уже есть плагин"
fi

#################################
# START
#################################
docker compose up -d --build

#################################
# UFW NAT
#################################
LOCAL_IP=$(hostname -I | awk '{print $1}')

if ! command -v ufw >/dev/null 2>&1; then
    echo "UFW не установлен. Устанавливаю..."
    apt update -qq && apt install -y ufw
fi

if LC_ALL=C ufw status 2>/dev/null | grep -q "Status: active"; then
    echo "UFW уже активен."
else
    echo "ВНИМАНИЕ: UFW выключен или не настроен. Включаю..."
    
    ufw allow OpenSSH >/dev/null 2>&1 || true
    
    ufw --force enable >/dev/null 2>&1
    
    if LC_ALL=C ufw status 2>/dev/null | grep -q "Status: active"; then
        echo "UFW успешно включён."
    else
        echo "ОШИБКА: Не удалось включить UFW. Проверьте вручную!"
        exit 1
    fi
fi

echo "--- Оптимизация сетевого стека ядра ---"
cat <<EOF > /etc/sysctl.d/99-relay-optimization.conf
net.ipv4.ip_forward = 1
net.core.default_qdisc = fq
net.ipv4.tcp_congestion_control = bbr
net.netfilter.nf_conntrack_max = 2000000
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
net.ipv4.tcp_mtu_probing = 1
net.ipv4.conf.all.accept_local = 1
net.ipv4.conf.all.route_localnet = 1
net.core.netdev_max_backlog=250000
net.ipv4.tcp_slow_start_after_idle=0
net.ipv4.tcp_tw_reuse=1
EOF
sysctl --system

echo "--- Настройка правил перенаправления (before.rules) ---"
cp /etc/ufw/before.rules /etc/ufw/before.rules.bak

cat <<EOF > /tmp/ufw_nat_rules
*nat
:PREROUTING ACCEPT [0:0]
:POSTROUTING ACCEPT [0:0]
# Исключаем порт Nginx менеджера
-A PREROUTING -p tcp --dport $NGINX_PORT -j RETURN
# Проброс портов
-A PREROUTING -p tcp -m multiport --dports 443,8443,10000:60000 -j DNAT --to-destination $ORIGIN_IP
-A PREROUTING -p udp -m multiport --dports 443,8443,10000:60000 -j DNAT --to-destination $ORIGIN_IP
# Маскировка под локальный IP сервера
-A POSTROUTING -p tcp -d $ORIGIN_IP -j SNAT --to-source $LOCAL_IP
-A POSTROUTING -p udp -d $ORIGIN_IP -j SNAT --to-source $LOCAL_IP
COMMIT

*filter
:FORWARD ACCEPT [0:0]
:INPUT ACCEPT [0:0]
:OUTPUT ACCEPT [0:0]

# Разрешаем пересылку для уже установленных соединений
-A FORWARD -m state --state RELATED,ESTABLISHED -j ACCEPT

# Явно разрешаем прохождение трафика на твой VPN сервер
-A FORWARD -d $ORIGIN_IP -j ACCEPT
-A FORWARD -s $ORIGIN_IP -j ACCEPT

COMMIT

*mangle
:FORWARD ACCEPT [0:0]
-A FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu
COMMIT

EOF

sed -i '/\*nat/,/COMMIT/d' /etc/ufw/before.rules
sed -i '/\*mangle/,/COMMIT/d' /etc/ufw/before.rules

cat /tmp/ufw_nat_rules /etc/ufw/before.rules > /etc/ufw/before.rules.new
mv /etc/ufw/before.rules.new /etc/ufw/before.rules

echo "--- Открытие портов в самом фаерволе ---"
ufw allow 443/tcp
ufw allow 443/udp
ufw allow 8443/tcp
ufw allow 8443/udp
ufw allow "$NGINX_PORT"/tcp
ufw allow 10000:60000/tcp
ufw allow 10000:60000/udp

sed -i 's/DEFAULT_FORWARD_POLICY="DROP"/DEFAULT_FORWARD_POLICY="ACCEPT"/' /etc/default/ufw

echo "--- Перезапуск ---"
ufw reload

echo "Готово! Система оптимизирована, порты открыты, трафик перенаправлен."

#################################
# RESULT
#################################
echo
log "Готово"
echo "Подписка:"
echo "$SUB_URL"