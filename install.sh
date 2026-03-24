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

#################################
# ЗАГРУЗКА ПРОЕКТА
#################################
log "Подготовка директории $PROJECT_DIR..."
mkdir -p "$PROJECT_DIR"
mkdir -p "$PROJECT_DIR/server"
mkdir -p "$PROJECT_DIR/client"

cd "$PROJECT_DIR"

#################################
# СБОР ДАННЫХ
#################################
read -rp "Введите домен сервера (если пропустить, будет использоваться IP без HTTPS): " INPUT_HOST

USE_SSL=false
CERT_PATH=""
KEY_PATH=""
SKIP_SSL_SETUP=false

if [ -z "$INPUT_HOST" ]; then
    UI_HOST=$(hostname -I | awk '{print $1}')
    log "Домен не указан. Используется локальный IP: $UI_HOST"
    log "Режим HTTPS принудительно отключен для IP-адреса."
    
    USE_SSL=false
    SKIP_SSL_SETUP=true
else
    UI_HOST=$INPUT_HOST
    SKIP_SSL_SETUP=false
fi

# --- 2. Настройка SSL (Только если введен домен) ---
if [[ "$SKIP_SSL_SETUP" == "false" ]]; then
    # Пытаемся автоматически найти сертификаты Let's Encrypt
    LE_CERT="/etc/letsencrypt/live/$UI_HOST/fullchain.pem"
    LE_KEY="/etc/letsencrypt/live/$UI_HOST/privkey.pem"

    if [[ -f "$LE_CERT" && -f "$LE_KEY" ]]; then
        log "Найдены сертификаты Let's Encrypt."
        USE_SSL=true
        CERT_PATH="$LE_CERT"
        KEY_PATH="$LE_KEY"
    else
        # Спрашиваем пользователя, если авто-поиск не дал результата
        read -rp "Использовать SSL (свои сертификаты)? (y/n): " ssl_ans
        if [[ "$ssl_ans" =~ ^[Yy]$ ]]; then
            read -rp "Путь к fullchain.pem: " user_cert
            read -rp "Путь к privkey.pem: " user_key
            if [[ -f "$user_cert" && -f "$user_key" ]]; then
                USE_SSL=true
                CERT_PATH="$user_cert"
                KEY_PATH="$user_key"
            else
                warn "Файлы сертификатов не найдены. Будет использоваться HTTP."
            fi
        fi
    fi
fi

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
FINAL_PORT=$(get_random_port)

# --- 4. Генерация паролей ---
DB_PASS=$(openssl rand -base64 12)
JWT_SECRET=$(openssl rand -base64 32)
ADMIN_USER=$(openssl rand -base64 8)
ADMIN_PASS=$(openssl rand -base64 12)
log "Сгенерированы секретные ключи для БД и JWT."

#################################
# Hysteria 2
#################################

# Проверка установки Hysteria 2 через наличие systemd сервиса
if ! systemctl cat hysteria-server.service &> /dev/null; then
    echo "Сервис Hysteria 2 не найден. Начинаем установку..."
    
    # Установка Hysteria 2 согласно документации
    bash <(curl -fsSL https://get.hy2.sh/) < /dev/null || true
    
    RANDOM_FREE_PORT=$(get_random_port 10000 20000)
    
    # Генерация надежных паролей
    GENERATED_PASSWORD=$(openssl rand -base64 16 | tr -dc 'A-Za-z0-9' | cut -c1-16)
    GENERATED_OBFS_PASSWORD=$(openssl rand -base64 16 | tr -dc 'A-Za-z0-9' | cut -c1-16)
    
    # Запрос данных у пользователя
    echo "=== Настройка Hysteria 2 ==="
    read -e -p "Введите email для уведомлений Let's Encrypt: " HYSTERIA_EMAIL
    
    HYSTERIA_EMAIL=$(echo "$HYSTERIA_EMAIL" | tr -cd 'a-zA-Z0-9.@_-')
    
    # Создание конфигурационного файла
    cat > /etc/hysteria/config.yaml <<EOF
listen: :$RANDOM_FREE_PORT

acme:
  domains:
    - $UI_HOST
  email: $HYSTERIA_EMAIL

auth:
  type: password
  password: $GENERATED_PASSWORD

obfs:
  type: salamander
  salamander:
    password: $GENERATED_OBFS_PASSWORD

masquerade:
  type: proxy
  proxy:
    url: https://ya.ru/
    rewriteHost: true
EOF

    # Перезапуск демона и включение сервиса для автозапуска
    systemctl daemon-reload
    systemctl enable --now hysteria-server.service
    systemctl restart hysteria-server.service
    
    echo "Hysteria 2 успешно установлена и запущена на порту $RANDOM_FREE_PORT"
    systemctl status hysteria-server.service --no-pager
else
    echo "Hysteria 2 уже установлена, пропускаем установку."
fi

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
        proxy_pass http://backend:3000/api/;
        proxy_set_header Host \$http_host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
server {
    listen 3000 ssl;
    server_name $UI_HOST;
    client_max_body_size 50M;

    ssl_certificate /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;

    location / {
        proxy_pass http://backend:3000/;
        proxy_set_header Host \$http_host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
EOF

    # 2. Docker Compose
cat > docker-compose.yml <<EOF
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
      - pg_data:/var/lib/postgresql/data
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
      JWT_SECRET: ${JWT_SECRET}
      ADMIN_LOGIN: ${ADMIN_USER}
      ADMIN_PASSWORD: ${ADMIN_PASS}
      PORT: 3000
    volumes:
      - /etc/hysteria/config.yaml:/etc/hysteria/config.yaml:ro
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
      - "3000:3000"
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
        proxy_pass http://backend:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$http_host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
server {
    listen 3000;
    server_name localhost;
    location / {
        proxy_pass http://backend:3000/;
        proxy_set_header Host \$http_host;
    }
}
EOF

    # 2. Docker Compose
cat > docker-compose.yml <<EOF
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
      - pg_data:/var/lib/postgresql/data
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
      JWT_SECRET: ${JWT_SECRET}
      ADMIN_LOGIN: ${ADMIN_USER}
      ADMIN_PASSWORD: ${ADMIN_PASS}
      PORT: 3000
    volumes:
      - /etc/hysteria/config.yaml:/etc/hysteria/config.yaml:ro
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
      - "3000:3000"
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
docker-compose down || true

# Запускаем сборку и старт
docker-compose up --build -d --remove-orphans

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
