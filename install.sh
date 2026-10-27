#!/usr/bin/env bash
set -euo pipefail

#################################
# КОНФИГУРАЦИЯ И ПЕРЕМЕННЫЕ
#################################
PROJECT_DIR="/opt/3dp-manager"
DOCKER_USER="denpiligrim"
DOCKER_TAG="main"
IMAGE_SERVER="ghcr.io/${DOCKER_USER}/3dp-manager-server:${DOCKER_TAG}"
IMAGE_CLIENT="ghcr.io/${DOCKER_USER}/3dp-manager-client:${DOCKER_TAG}"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
die() { error "$1"; }

resolve_compose_cmd() {
    if docker compose version >/dev/null 2>&1; then
        COMPOSE_CMD=("docker" "compose")
        return 0
    fi

    if command -v docker-compose >/dev/null 2>&1; then
        COMPOSE_CMD=("docker-compose")
        return 0
    fi

    warn "Не найден Docker Compose (ни v2 plugin, ни v1 binary). Пытаемся установить..."
    apt-get update
    apt-get install -y docker-compose-plugin || true

    if docker compose version >/dev/null 2>&1; then
        COMPOSE_CMD=("docker" "compose")
        return 0
    fi

    apt-get install -y docker-compose || true
    if command -v docker-compose >/dev/null 2>&1; then
        COMPOSE_CMD=("docker-compose")
        return 0
    fi

    die "Не удалось установить Docker Compose. Установите docker compose plugin (v2) или docker-compose (v1)."
}

check_containers_running() {
    log "Проверка статуса контейнеров..."
    local timeout=${1:-60}
    local elapsed=0
    local failed=0

    while [ $elapsed -lt $timeout ]; do
        failed=0
        # Получаем статус всех контейнеров текущего compose проекта
        # Формат: NAME\tSTATUS (например: "3dp-postgres\tUp 2 days" или "3dp-postgres\tError")
        while IFS=$'\t' read -r container_name status; do
            if [ -n "$container_name" ] && [ -n "$status" ]; then
                # Проверяем, что статус содержит Up/running/healthy/restarting
                # Up, Up 2 days, Up Less than a second, (healthy), running, restarting
                if ! echo "$status" | grep -qiE "^up|running|healthy|restarting"; then
                    failed=1
                    warn "Контейнер $container_name в статусе: $status"
                fi
            fi
        done < <("${COMPOSE_CMD[@]}" ps --format "table {{.Name}}\t{{.Status}}" --all 2>/dev/null | tail -n +2)

        if [ $failed -eq 0 ]; then
            log "Все контейнеры запущены успешно"
            return 0
        fi

        sleep 2
        elapsed=$((elapsed + 2))
    done

    return 1
}

get_random_port() {
  local MIN=${1:-3000}
  local MAX=${2:-6999}
  
  while :; do
    PORT=$(shuf -i "$MIN-$MAX" -n 1)
    if ! ss -ltun | awk '{print $4}' | grep -q ":$PORT\$"; then
      echo "$PORT"
      return
    fi
  done
}

cleanup_previous_install_data() {
  log "Checking for previous 3dp-manager installation data..."

  if [[ -f docker-compose.yml ]]; then
    warn "Existing docker-compose.yml found. Stopping previous installation and removing its volumes so newly generated credentials are used."
    "${COMPOSE_CMD[@]}" down --volumes --remove-orphans || true
  else
    warn "docker-compose.yml not found. Removing known 3dp-manager containers if they still exist."
  fi

  docker rm -f 3dp-postgres 3dp-backend 3dp-frontend >/dev/null 2>&1 || true

  for volume in 3dp-manager_pg_data 3dpmanager_pg_data; do
    if docker volume inspect "$volume" >/dev/null 2>&1; then
      warn "Removing stale Postgres volume: $volume"
      docker volume rm "$volume" >/dev/null 2>&1 || true
    fi
  done
}

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
# ПРОВЕРКИ И УСТАНОВКА ЗАВИСИМОСТЕЙ
#################################
if [[ $EUID -ne 0 ]]; then
   error "Этот скрипт должен быть запущен от имени root"
fi

. /etc/os-release
if [[ "$ID" != "ubuntu" && "$ID" != "debian" ]]; then
    die "Этот скрипт поддерживает только Ubuntu или Debian: $ID"
fi

if [ $(free -m | grep Mem: | awk '{print $2}') -lt 2000 ]; then
    if [ $(free -m | grep Swap: | awk '{print $2}') -eq 0 ]; then
        log "Мало RAM и нет Swap. Создаем swap-файл 2GB..."
        fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
        chmod 600 /swapfile
        mkswap /swapfile
        swapon /swapfile
        echo '/swapfile none swap sw 0 0' >> /etc/fstab
        log "Swap создан."
    fi
fi

log "Проверка зависимостей..."
if ! command -v curl &> /dev/null; then apt-get update && apt-get install -y curl; fi
if ! command -v jq &> /dev/null; then apt-get install -y jq; fi
if ! command -v openssl &> /dev/null; then apt-get install -y openssl; fi
if ! command -v tar &> /dev/null; then apt-get install -y tar; fi
if ! command -v hostname &> /dev/null; then apt-get install -y net-tools || apt-get install -y hostname; fi

# Установка Docker
log "Проверка Docker"

if command -v docker >/dev/null 2>&1; then
    log "Docker уже установлен"
else
    log "Docker не найден, будет установлен из официального репозитория"
    # Add Docker's official GPG key:
    apt update
    apt install ca-certificates curl
    install -m 0755 -d /etc/apt/keyrings
    if [[ "$ID" == "ubuntu" ]]; then
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc || die "Ошибка добавления ключа Docker"
    else
        curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc || die "Ошибка добавления ключа Docker"
    fi
    chmod a+r /etc/apt/keyrings/docker.asc

    # Add the repository to Apt sources:
    CODENAME=${UBUNTU_CODENAME:-$VERSION_CODENAME}
    tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/$ID
Suites: $CODENAME
Components: stable
Signed-By: /etc/apt/keyrings/docker.asc
EOF

    apt update

    apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable docker
    systemctl start docker
fi

resolve_compose_cmd
log "Compose команда: ${COMPOSE_CMD[*]}"

#################################
# ЗАГРУЗКА ПРОЕКТА
#################################
log "Подготовка директории $PROJECT_DIR..."
mkdir -p "$PROJECT_DIR"
mkdir -p "$PROJECT_DIR/server"
mkdir -p "$PROJECT_DIR/client"

cd "$PROJECT_DIR"
cleanup_previous_install_data

#################################
# СБОР ДАННЫХ: SSL / HTTPS
#################################
UI_HOST=""
USE_SSL=false
CERT_PATH=""
KEY_PATH=""

echo ""
echo -e "${GREEN}Выберите тип SSL/HTTPS сертификации:${NC}"
echo "  1) HTTPS — Let's Encrypt (нужен реальный домен, привязанный к IP, + открыты порты 80/443 в UFW)"
echo "  2) HTTPS — Self-signed (самоподписанный на IP сервера, для тестов/VM)"
echo "  3) HTTPS — Свои сертификаты (указать пути)"
echo "  4) HTTP — без шифрования"
echo ""
printf "Ваш выбор (1/2/3/4) [\033[0;31m4\033[0m]: "
read -r ssl_choice

case "$ssl_choice" in
1)
    echo ""
    read -rp "Введите домен (должен быть привязан к IP этого сервера): " INPUT_HOST

    if [ -z "$INPUT_HOST" ]; then
      warn "Домен не указан. Переключение на HTTP."
    else
      UI_HOST="$INPUT_HOST"
      LE_CERT="/etc/letsencrypt/live/$UI_HOST/fullchain.pem"
      LE_KEY="/etc/letsencrypt/live/$UI_HOST/privkey.pem"

      NEED_NEW_CERT=true

      if [[ -f "$LE_CERT" && -f "$LE_KEY" ]]; then
        # Проверяем что сертификат не истёк и ключ соответствует
        if openssl x509 -checkend 0 -noout -in "$LE_CERT" 2>/dev/null && \
           openssl x509 -noout -pubkey -in "$LE_CERT" 2>/dev/null > /tmp/cert_pub && \
           openssl pkey -pubout -in "$LE_KEY" 2>/dev/null > /tmp/key_pub && \
           diff -q /tmp/cert_pub /tmp/key_pub >/dev/null 2>&1; then
           
          log "Найдены валидные сертификаты для $UI_HOST."
          USE_SSL=true
          CERT_PATH="$LE_CERT"
          KEY_PATH="$LE_KEY"
          NEED_NEW_CERT=false
        else
          warn "Найдены сертификаты для $UI_HOST, но они истекли или невалидны. Очистка..."
          # Удаляем невалидные файлы
          rm -rf "/etc/letsencrypt/live/$UI_HOST"
          rm -rf "/etc/letsencrypt/archive/$UI_HOST"
          rm -rf "/etc/letsencrypt/renewal/$UI_HOST.conf"
        fi
      fi

      if [ "$NEED_NEW_CERT" = true ]; then
        log "Получение Let's Encrypt сертификата для $UI_HOST..."
        read -e -p "Email для уведомлений Let's Encrypt: " LE_EMAIL
        LE_EMAIL=$(echo "$LE_EMAIL" | tr -cd 'a-zA-Z0-9.@_-')

        if command -v certbot &>/dev/null; then
          log "Certbot уже установлен."
        else
          log "Установка certbot..."
          apt update
          apt install -y certbot
        fi

        # КРИТИЧЕСКИЙ ШАГ: Принудительно удаляем старые сертификаты из базы Certbot
        certbot delete --cert-name "$UI_HOST" --non-interactive >/dev/null 2>&1 || true

        # Запрашиваем новый сертификат принудительно (--force-renewal и --cert-name)
        certbot certonly --standalone \
          --agree-tos \
          --non-interactive \
          --force-renewal \
          --cert-name "$UI_HOST" \
          --email "$LE_EMAIL" \
          -d "$UI_HOST" || warn "Не удалось получить сертификат Let's Encrypt"

        if [[ -f "$LE_CERT" && -f "$LE_KEY" ]]; then
          USE_SSL=true
          CERT_PATH="$LE_CERT"
          KEY_PATH="$LE_KEY"
          log "Let's Encrypt сертификат получен для $UI_HOST"
        else
          warn "Сертификат не получен. Переключение на HTTP."
        fi
      fi
    fi
    ;;

  2)
    UI_HOST=$(hostname -I | awk '{print $1}')
    log "Генерация самоподписанного сертификата для $UI_HOST..."
    mkdir -p "/etc/letsencrypt/live/$UI_HOST"
    openssl req -x509 -nodes -days 365 \
      -newkey rsa:2048 \
      -keyout "/etc/letsencrypt/live/$UI_HOST/privkey.pem" \
      -out "/etc/letsencrypt/live/$UI_HOST/fullchain.pem" \
      -subj "/CN=$UI_HOST" \
      -addext "subjectAltName=IP:$UI_HOST" 2>/dev/null

    if [[ -f "/etc/letsencrypt/live/$UI_HOST/fullchain.pem" && -f "/etc/letsencrypt/live/$UI_HOST/privkey.pem" ]]; then
      USE_SSL=true
      CERT_PATH="/etc/letsencrypt/live/$UI_HOST/fullchain.pem"
      KEY_PATH="/etc/letsencrypt/live/$UI_HOST/privkey.pem"
      log "Self-signed сертификат сгенерирован для $UI_HOST"
      warn "Браузер будет предупреждать — это нормально для тестов."
    else
      warn "Не удалось сгенерировать сертификат. Переключение на HTTP."
    fi
    ;;

  3)
    read -rp "Введите домен для панели (например panel.example.com; Enter — использовать IP): " INPUT_HOST
    read -rp "Путь к fullchain.pem: " user_cert
    read -rp "Путь к privkey.pem: " user_key
    if [[ -f "$user_cert" && -f "$user_key" ]]; then
      USE_SSL=true
      CERT_PATH="$user_cert"
      KEY_PATH="$user_key"
      if [ -n "$INPUT_HOST" ]; then
        UI_HOST="$INPUT_HOST"
      else
        UI_HOST=$(hostname -I | awk '{print $1}')
        warn "Домен не указан. В итоговом URL будет использован IP: $UI_HOST"
      fi
    else
      warn "Файлы не найдены. Переключение на HTTP."
    fi
    ;;

  *)
    UI_HOST=$(hostname -I | awk '{print $1}')
    log "Будет использоваться HTTP."
    ;;
esac

if [ -z "$UI_HOST" ]; then
  UI_HOST=$(hostname -I | awk '{print $1}')
  log "Используется IP сервера: $UI_HOST"
fi

#################################
# СБОР ДАННЫХ
################################

FINAL_PORT=$(get_random_port)

# --- 4. Генерация паролей ---
DB_PASS=$(openssl rand -base64 12)
JWT_SECRET=$(openssl rand -base64 32)
ADMIN_USER=$(openssl rand -base64 8)
ADMIN_PASS=$(openssl rand -base64 12)
# Определяем ALLOWED_ORIGINS из домена или IP
if [[ -n "${UI_HOST:-}" ]]; then
    URL_SCHEME="http"
    if [[ "$USE_SSL" == "true" ]]; then
        URL_SCHEME="https"
    fi
    ALLOWED_ORIGINS="${URL_SCHEME}://${UI_HOST}"
else
    ALLOWED_ORIGINS=""
fi
log "Сгенерированы секретные ключи для БД и JWT."


#################################
# ГЕНЕРАЦИЯ ФАЙЛОВ DOCKER
#################################
cat > server/.env <<EOF
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=admin
DB_PASSWORD=${DB_PASS}
DB_NAME=3dp_manager
ADMIN_LOGIN=${ADMIN_USER}
ADMIN_PASSWORD=${ADMIN_PASS}
PORT=3100
LOG_LEVEL=error
ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-}
EOF

if [[ "$USE_SSL" == "true" ]]; then
    # === ВАРИАНТ С SSL ===
    
    # 1. Nginx Config
cat > client/nginx-client.conf <<EOF
server {
    listen 443 ssl;
    server_name $UI_HOST;
    root /usr/share/nginx/html;
    index index.html;
    client_max_body_size 50M;

    ssl_certificate /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;

    location / {
        try_files \$uri \$uri/ /index.html;
    }
    location /api/ {
        proxy_pass http://backend:3100/api/;
        proxy_set_header Host \$http_host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_connect_timeout 10s;
        proxy_send_timeout 650s;
        proxy_read_timeout 650s;
    }
    location /bus/ {
        proxy_pass http://backend:3100/bus/;
        proxy_set_header Host \$http_host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 10s;
        proxy_send_timeout 650s;
        proxy_read_timeout 650s;
    }
}
EOF

    # 2. Docker Compose
cat > docker-compose.yml <<EOF
name: 3dp-manager

services:
  postgres:
    image: postgres:18-alpine
    container_name: 3dp-postgres
    restart: always
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: ${DB_PASS}
      POSTGRES_DB: 3dp_manager
    volumes:
      - pg_data:/var/lib/postgresql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U admin -d 3dp_manager"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - app-network

  backend:
    image: ${IMAGE_SERVER}
    container_name: 3dp-backend
    restart: always
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USERNAME: admin
      DB_PASSWORD: ${DB_PASS}
      DB_NAME: 3dp_manager
      DB_SYNCHRONIZE: "true"
      DB_MIGRATIONS_RUN: "false"
      JWT_SECRET: ${JWT_SECRET}
      ADMIN_LOGIN: ${ADMIN_USER}
      ADMIN_PASSWORD: ${ADMIN_PASS}
      PORT: 3100
    networks:
      - app-network

  frontend:
    image: ${IMAGE_CLIENT}
    container_name: 3dp-frontend
    restart: always
    depends_on:
      - backend
    ports:
      - "${FINAL_PORT}:443"
    volumes:
      - ./client/nginx-client.conf:/etc/nginx/conf.d/default.conf:ro
      - ${CERT_PATH}:/etc/nginx/certs/fullchain.pem:ro
      - ${KEY_PATH}:/etc/nginx/certs/privkey.pem:ro
    networks:
      - app-network

volumes:
  pg_data:

networks:
  app-network:
    driver: bridge
EOF

else
    # === ВАРИАНТ БЕЗ SSL (HTTP) ===
    
    # 1. Nginx Config
cat > client/nginx-client.conf <<EOF
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;
    client_max_body_size 50M;

    location / {
        try_files \$uri \$uri/ /index.html;
    }
    location /api/ {
        proxy_pass http://backend:3100/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$http_host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_connect_timeout 10s;
        proxy_send_timeout 650s;
        proxy_read_timeout 650s;
    }
    location /bus/ {
        proxy_pass http://backend:3100/bus/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$http_host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 10s;
        proxy_send_timeout 650s;
        proxy_read_timeout 650s;
    }
}
EOF

    # 2. Docker Compose
cat > docker-compose.yml <<EOF
name: 3dp-manager

services:
  postgres:
    image: postgres:18-alpine
    container_name: 3dp-postgres
    restart: always
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: ${DB_PASS}
      POSTGRES_DB: 3dp_manager
    volumes:
      - pg_data:/var/lib/postgresql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U admin -d 3dp_manager"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - app-network

  backend:
    image: ${IMAGE_SERVER}
    container_name: 3dp-backend
    restart: always
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USERNAME: admin
      DB_PASSWORD: ${DB_PASS}
      DB_NAME: 3dp_manager
      DB_SYNCHRONIZE: "true"
      DB_MIGRATIONS_RUN: "false"
      JWT_SECRET: ${JWT_SECRET}
      ADMIN_LOGIN: ${ADMIN_USER}
      ADMIN_PASSWORD: ${ADMIN_PASS}
      PORT: 3100
    networks:
      - app-network

  frontend:
    image: ${IMAGE_CLIENT}
    container_name: 3dp-frontend
    restart: always
    depends_on:
      - backend
    ports:
      - "${FINAL_PORT}:80"
    volumes:
      - ./client/nginx-client.conf:/etc/nginx/conf.d/default.conf:ro
    networks:
      - app-network

volumes:
  pg_data:

networks:
  app-network:
    driver: bridge
EOF
fi

#################################
# ЗАПУСК
#################################
log "Сборка и запуск контейнеров..."
# Останавливаем старые, если были
"${COMPOSE_CMD[@]}" down || true

# Подтягиваем свежие образы, потому что тег релиза переиспользуется.
"${COMPOSE_CMD[@]}" pull || warn "Не удалось обновить образы перед запуском. Будет использован локальный кэш, если он есть."

# Запускаем сборку и старт
"${COMPOSE_CMD[@]}" up --build -d --remove-orphans

# Проверка: все ли контейнеры запустились
if ! check_containers_running 60; then
    error "Не удалось запустить контейнеры. Логи:"
    "${COMPOSE_CMD[@]}" logs --tail=50
    die "Установка прервана из-за ошибки запуска контейнеров"
fi

log "Очистка кэша сборки..."
docker image prune -f

if LC_ALL=C ufw status 2>/dev/null | grep -q "Status: active"; then
    echo "Найден активный UFW. Настраиваю правила..."

    ufw allow 443/tcp
    ufw allow 443/udp
    ufw allow 8443/tcp
    ufw allow 8443/udp
    ufw allow 10000:60000/tcp
    ufw allow 10000:60000/udp
fi

echo ""
echo "==================================================="
if [[ "$USE_SSL" == "true" ]]; then
    echo -e "${GREEN}✔ Установка завершена! Доступно по адресу: https://${UI_HOST}:${FINAL_PORT}${NC}"
else
    echo -e "${GREEN}✔ Установка завершена! Доступно по адресу: http://${UI_HOST}:${FINAL_PORT}${NC}"
fi
echo -e "${GREEN}Логин: ${ADMIN_USER}${NC}"
echo -e "${GREEN}Пароль: ${ADMIN_PASS}${NC}"
echo ""
echo "Немедленно измените пароль в Настройках утилиты!"
echo "==================================================="
