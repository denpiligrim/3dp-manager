#!/usr/bin/env bash
set -euo pipefail

#################################
# DEBUG TRAP
#################################
trap 'echo -e "\033[1;31m[ERROR]\033[0m Ошибка в строке $LINENO"; exit 1' ERR

#################################
# HELPER FUNCTIONS
#################################
log()  { echo -e "\033[1;32m[INFO]\033[0m $1"; }
die()  { echo -e "\033[1;31m[ERROR]\033[0m $1"; exit 1; }

need_root() {
  [[ $EUID -eq 0 ]] || die "Запускать только от root"
}

validate_url() {
  [[ "$1" =~ ^https?://[^/]+:[0-9]+/.+ ]]
}

#################################
# CHECKS
#################################
need_root

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
echo "              3DP-MANAGER FOR 3X-UI                "
echo "==================================================="
echo ""

#################################
# INPUT / USER DATA
#################################
# Function to get panel URL from 3x-ui
get_xui_url() {
    local output=$(x-ui settings 2>/dev/null)

    echo "$output" | sed 's/\x1b\[[0-9;]*m//g' | grep "Access URL:" | grep -oE 'https?://[^[:space:]]+' | head -n1
}

echo "Определяем URL панели 3x-ui..."

UI_URL=$(get_xui_url)

if [[ -z "$UI_URL" ]]; then
    echo "Не удалось автоматически получить URL"
    read -rp "Введите URL панели 3x-ui вручную: " UI_URL
fi

UI_URL=$(echo "$UI_URL" | sed -E 's/[[:space:]]*$//; s|/*$||')

echo "URL панели 3x-ui: $UI_URL"

# Validate URL correctness
validate_url "$UI_URL" || die "Некорректный URL панели 3x-ui: $UI_URL"

read -rp "Логин 3x-ui: " UI_LOGIN
read -rsp "Пароль 3x-ui: " UI_PASSWORD
echo
[[ -z "$UI_LOGIN" || -z "$UI_PASSWORD" ]] && die "Логин/пароль обязательны"

# Check login
LOGIN_RESPONSE=$(curl -s -X POST "$UI_URL/login" -H "Content-Type: application/json" -d "{\"username\":\"$UI_LOGIN\",\"password\":\"$UI_PASSWORD\"}")

# Проверка успешного логина по ключевому полю "success" или наличию куки
if ! echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
  echo "Не удалось залогиниться в 3x-ui. Проверьте URL, логин и пароль."
  exit 1
fi

echo "✔ Успешный логин в 3x-ui"

# Parse UI_URL
UI_HOST=$(echo "$UI_URL" | awk -F[/:] '{print $4}')   # domain or IP
UI_PROTO=$(echo "$UI_URL" | awk -F: '{print $1}')     # http or https

if [[ "$UI_PROTO" == "https" ]]; then
  log "HTTPS панель обнаружена, проверяем SSL сертификаты"

  DEFAULT_CERT="/etc/letsencrypt/live/$UI_HOST/fullchain.pem"
  DEFAULT_KEY="/etc/letsencrypt/live/$UI_HOST/privkey.pem"

  if [[ -f "$DEFAULT_CERT" && -f "$DEFAULT_KEY" ]]; then
    CERT_PATH="$DEFAULT_CERT"
    KEY_PATH="$DEFAULT_KEY"
    log "Найдены сертификаты Let's Encrypt для $UI_HOST"
  else
    log "⚠ Сертификаты Let's Encrypt для $UI_HOST не найдены"
    read -rp "Введите полный путь к SSL сертификату (fullchain.pem): " CERT_PATH
    read -rp "Введите полный путь к SSL ключу (privkey.pem): " KEY_PATH

    [[ -f "$CERT_PATH" ]] || die "Файл сертификата не найден: $CERT_PATH"
    [[ -f "$KEY_PATH" ]]  || die "Файл ключа не найден: $KEY_PATH"
  fi
fi


# Input rotation interval
read -rp "Интервал генерации инбаундов в минутах (от 10, по умолчанию 30): " ROTATE_INTERVAL
ROTATE_INTERVAL="${ROTATE_INTERVAL:-30}"  # по умолчанию 30

# Check that it's a number and ≥10
if ! [[ "$ROTATE_INTERVAL" =~ ^[0-9]+$ ]] || [ "$ROTATE_INTERVAL" -lt 10 ]; then
  echo "Неверное значение. Используется значение по умолчанию 30 минут."
  ROTATE_INTERVAL=30
fi

echo "Интервал ротации установлен: $ROTATE_INTERVAL минут"

PROJECT_DIR="/opt/3dp-manager"
log "Используется директория проекта: $PROJECT_DIR"

mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR"

#################################
# Get country flag
#################################
REPO_BASE="https://raw.githubusercontent.com/denpiligrim/3dp-manager/main"
COUNTRY_FLAG=""

# Get countryCode
IP_JSON=$(curl -s --fail http://ip-api.com/json/ || true)
[ -z "$IP_JSON" ] && exit 0

COUNTRY_CODE=$(echo "$IP_JSON" | jq -r '.countryCode // empty' 2>/dev/null)
[ -z "$COUNTRY_CODE" ] && exit 0

# Flags JSON URL
FLAGS_JSON_URL="$REPO_BASE/app/assets/flags.json"

FLAGS_JSON=$(curl -s "$FLAGS_JSON_URL" || true)
[ -z "$FLAGS_JSON" ] && exit 0

# Ищем emoji
COUNTRY_FLAG=$(echo "$FLAGS_JSON" | jq -r --arg code "$COUNTRY_CODE" '.[] | select(.code == $code) | .emoji // empty' 2>/dev/null | head -n1)

#################################
# Whitelist
#################################
curl -fsSL "$REPO_BASE/whitelist.txt" -o whitelist.txt
log "whitelist.txt скопирован"

#################################
# TOKEN GENERATION
#################################
SUB_TOKEN="$(openssl rand -hex 24)"
log "Сгенерирован токен подписки"

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

# Check docker compose v2
if docker compose version >/dev/null 2>&1; then
    log "docker compose v2 доступен"
else
    log "Устанавливаем docker-compose-v2"
    # решаем конфликт с docker-compose-plugin
    apt install -y --allow-downgrades --allow-remove-essential --allow-change-held-packages \
        docker-compose-v2 || warn "docker-compose-v2 не установлен, возможно уже есть плагин"
fi

#################################
# STRUCTURE
#################################
mkdir -p app app/builders subscriptions

# Generate a random free port for subscription/Nginx
get_random_port() {
  while :; do
    PORT=$((RANDOM % 50000 + 10000))  # range 10000-60000
    if ! ss -ltn | awk '{print $4}' | grep -q ":$PORT\$"; then
      echo "$PORT"
      return
    fi
  done
}
NGINX_PORT=$(get_random_port)

# Generate subscription URL
SUB_URL="$UI_PROTO://$UI_HOST:$NGINX_PORT/bus/$SUB_TOKEN"

#################################
# ENV
#################################
cat > .env <<EOF
SUB_TOKEN=$SUB_TOKEN
UI_URL=$UI_URL
UI_LOGIN=$UI_LOGIN
UI_PASSWORD=$UI_PASSWORD
COUNTRY_FLAG=$COUNTRY_FLAG
NGINX_PORT=$NGINX_PORT
UI_HOST=$UI_HOST
UI_PROTO=$UI_PROTO
ROTATE_INTERVAL=$ROTATE_INTERVAL
SUB_URL=$SUB_URL
EOF

#################################
# Dockerfile
#################################
curl -fsSL "$REPO_BASE/app/Dockerfile" -o app/Dockerfile

#################################
# package.json
#################################
curl -fsSL "$REPO_BASE/app/package.json" -o app/package.json

#################################
# JS Files
#################################
curl -fsSL "$REPO_BASE/app/index.js" -o app/index.js
curl -fsSL "$REPO_BASE/app/builders/buildVlessRealityTcp.js" -o app/builders/buildVlessRealityTcp.js
curl -fsSL "$REPO_BASE/app/builders/buildVlessRealityXhttp.js" -o app/builders/buildVlessRealityXhttp.js
curl -fsSL "$REPO_BASE/app/builders/buildTrojanRealityTcp.js" -o app/builders/buildTrojanRealityTcp.js
curl -fsSL "$REPO_BASE/app/builders/buildShadowsocksTcp.js" -o app/builders/buildShadowsocksTcp.js
curl -fsSL "$REPO_BASE/app/builders/buildVmessTcp.js" -o app/builders/buildVmessTcp.js
curl -fsSL "$REPO_BASE/app/builders/buildVlessRealityGrpc.js" -o app/builders/buildVlessRealityGrpc.js
curl -fsSL "$REPO_BASE/app/builders/buildVlessWs.js" -o app/builders/buildVlessWs.js
curl -fsSL "$REPO_BASE/app/builders/buildInboundLink.js" -o app/builders/buildInboundLink.js

#################################
# NGINX & DOCKER COMPOSE
#################################
# Generate nginx.conf
if [[ "$UI_PROTO" == "https" ]]; then
  cat > docker-compose.yml <<EOF
services:
  node:
    build: ./app
    env_file: .env
    container_name: node
    volumes:
      - ./subscriptions:/subscriptions
      - ./whitelist.txt:/app/whitelist.txt
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    depends_on: [node]
    ports:
      - "$NGINX_PORT:$NGINX_PORT"
    container_name: nginx
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./subscriptions:/subscriptions
      - $CERT_PATH:$CERT_PATH:ro
      - $KEY_PATH:$KEY_PATH:ro
EOF

  cat > nginx.conf <<EOF
events {}
http {
  server {
    listen $NGINX_PORT ssl;
    server_name $UI_HOST;

    ssl_certificate $CERT_PATH;
    ssl_certificate_key $KEY_PATH;

    location = /bus/$SUB_TOKEN {
      alias /subscriptions/list.txt;
      default_type text/plain;
      add_header Subscription-Userinfo "upload=0; download=0; total=109951162777600; expire=0" always;
      add_header Access-Control-Allow-Origin *;
    }

    location / {
      return 404;
    }
  }
}
EOF
else
  cat > docker-compose.yml <<EOF
services:
  node:
    build: ./app
    env_file: .env
    container_name: node
    volumes:
      - ./subscriptions:/subscriptions
      - ./whitelist.txt:/app/whitelist.txt
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    depends_on: [node]
    ports:
      - "$NGINX_PORT:$NGINX_PORT"
    container_name: nginx
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./subscriptions:/subscriptions
EOF

  cat > nginx.conf <<EOF
events {}
http {
  server {
    listen $NGINX_PORT;
    server_name $UI_HOST;

    location = /bus/$SUB_TOKEN {
      alias /subscriptions/list.txt;
      default_type text/plain;
      add_header Subscription-Userinfo "upload=0; download=0; total=109951162777600; expire=0" always;
      add_header Access-Control-Allow-Origin *;
    }

    location / {
      return 404;
    }
  }
}
EOF
fi

#################################
# RUN
#################################
log "Сборка контейнеров"
docker compose build

log "Запуск контейнеров"
docker compose up -d

docker compose ps | grep node >/dev/null || die "Backend не запущен"
docker compose ps | grep nginx >/dev/null || die "Nginx не запущен"

#################################
# RESULT
#################################
log "✔ Установка завершена"
echo
echo "URL подписки:"
echo "$SUB_URL"