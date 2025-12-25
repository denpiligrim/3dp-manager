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

read -r -p "Вы уверены, что хотите удалить? (y/N): " answer

case "$answer" in
  y|Y)
    echo "Начинаю удаление..."
    ;;
  *)
    echo "Удаление отменено"
    exit 1
    ;;
esac

#################################
# START
#################################
need_root

PROJECT_DIR="/opt/3dp-manager"

log "Начинаем удаление 3dp-manager"

if [[ ! -d "$PROJECT_DIR" ]]; then
  warn "Директория $PROJECT_DIR не найдена — удалять нечего"
  exit 0
fi

cd "$PROJECT_DIR"

#################################
# DOCKER COMPOSE DOWN
#################################
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  if [[ -f docker-compose.yml ]]; then
    log "Останавливаем контейнеры 3dp-manager"
    docker compose down --volumes --remove-orphans || warn "Ошибка при docker compose down"
  else
    warn "docker-compose.yml не найден"
  fi
else
  warn "Docker или docker compose не установлен — пропуск"
fi

#################################
# CLEAN IMAGES
#################################
log "Удаляем образы 3dp-manager (если есть)"

docker images --format '{{.Repository}} {{.ID}}' \
  | grep 3dp-manager \
  | awk '{print $2}' \
  | xargs -r docker rmi -f || true

#################################
# REMOVE DIRECTORY
#################################
log "Удаляем $PROJECT_DIR"
rm -rf "$PROJECT_DIR"

#################################
# DONE
#################################
log "✔ 3dp-manager полностью удалён"