#!/usr/bin/env bash
set -euo pipefail

#################################
# TRAP
#################################
trap 'echo -e "\033[1;31m[ERROR]\033[0m Ошибка в строке $LINENO"; exit 1' ERR

#################################
# HELPERS
#################################
log()  { echo -e "\033[1;32m[INFO]\033[0m $1"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $1"; }
die()  { echo -e "\033[1;31m[ERROR]\033[0m $1"; exit 1; }

need_root() {
  [[ $EUID -eq 0 ]] || die "Запускать только от root"
}

if ! command -v curl >/dev/null 2>&1; then
  echo "❌ curl не установлен. Установите curl и повторите попытку"
  echo "   apt install -y curl"
  exit 1
fi

#################################
# CONFIG
#################################
PROJECT_DIR="/opt/3dp-manager"
REPO_RAW="https://raw.githubusercontent.com/denpiligrim/3dp-manager/main"

#################################
# START
#################################
need_root

log "Обновление 3dp-manager"

[[ -d "$PROJECT_DIR" ]] || die "3dp-manager не установлен ($PROJECT_DIR не найден)"

cd "$PROJECT_DIR"

#################################
# CHECK DOCKER
#################################
command -v docker >/dev/null 2>&1 || die "Docker не установлен"
docker compose version >/dev/null 2>&1 || die "docker compose v2 недоступен"

#################################
# DOWNLOAD FILES
#################################
log "Загружаем обновлённые файлы из репозитория"

mkdir -p app

curl -fsSL "$REPO_RAW/app/Dockerfile"    -o app/Dockerfile
curl -fsSL "$REPO_RAW/app/package.json"  -o app/package.json
curl -fsSL "$REPO_RAW/app/index.js"      -o app/index.js
curl -fsSL "$REPO_RAW/app/rotate.js"      -o app/rotate.js
curl -fsSL "$REPO_RAW/app/builders/buildVlessRealityTcp.js" -o app/builders/buildVlessRealityTcp.js
curl -fsSL "$REPO_RAW/app/builders/buildVlessRealityXhttp.js" -o app/builders/buildVlessRealityXhttp.js
curl -fsSL "$REPO_RAW/app/builders/buildTrojanRealityTcp.js" -o app/builders/buildTrojanRealityTcp.js
curl -fsSL "$REPO_RAW/app/builders/buildShadowsocksTcp.js" -o app/builders/buildShadowsocksTcp.js
curl -fsSL "$REPO_RAW/app/builders/buildVmessTcp.js" -o app/builders/buildVmessTcp.js
curl -fsSL "$REPO_RAW/app/builders/buildVlessRealityGrpc.js" -o app/builders/buildVlessRealityGrpc.js
curl -fsSL "$REPO_RAW/app/builders/buildVlessWs.js" -o app/builders/buildVlessWs.js
curl -fsSL "$REPO_RAW/app/builders/buildInboundLink.js" -o app/builders/buildInboundLink.js
curl -fsSL "$REPO_RAW/whitelist.txt"     -o whitelist.txt

log "Файлы обновлены"

#################################
# REBUILD BACKEND
#################################
log "Пересобираем backend"
docker compose build node

#################################
# RESTART CONTAINERS
#################################
log "Перезапускаем контейнеры"
docker compose up -d

if [ -f "app/my_whitelist.txt" ]; then
    log "✔ Копируем my_whitelist.txt в контейнер..."
    docker cp app/my_whitelist.txt node:/app/my_whitelist.txt
fi

#################################
# HEALTH CHECK
#################################
sleep 2

docker compose ps | grep node >/dev/null || die "Backend не запущен"
docker compose ps | grep nginx   >/dev/null || die "Nginx не запущен"

#################################
# DONE
#################################
log "3dp-manager успешно обновлён ✅"