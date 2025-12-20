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

[[ $EUID -eq 0 ]] || { echo "Запускать нужно от root"; exit 1; }

#################################
# PATHS
#################################
BASE_DIR="/opt/3dp-manager"
UFW_BEFORE="/etc/ufw/before.rules"
UFW_NAT_MARKER="3dp-manager NAT"
NGINX_PORT=$(cd "$BASE_DIR" && docker compose exec -T node printenv ORIGIN_PORT | tr -d '\r')

#################################
# DOCKER CLEAN
#################################
if [[ -d "$BASE_DIR" ]]; then
  log "Остановка Docker"
  cd "$BASE_DIR"
  docker compose down --remove-orphans || true
else
  warn "Каталог проекта не найден"
fi

#################################
# REMOVE FILES
#################################
log "Удаление файлов проекта"
rm -rf "$BASE_DIR"

#################################
# UFW NAT CLEAN
#################################
echo "--- 1. Удаление оптимизаций ядра ---"
rm -f /etc/sysctl.d/99-relay-optimization.conf
# Применяем стандартные настройки (отключаем BBR и forward, если они не были включены до этого)
sysctl net.ipv4.ip_forward=0
sysctl net.core.default_qdisc=pfifo_fast
sysctl net.ipv4.tcp_congestion_control=cubic

echo "--- 2. Восстановление правил UFW из бэкапа ---"
if [ -f /etc/ufw/before.rules.bak ]; then
    mv /etc/ufw/before.rules.bak /etc/ufw/before.rules
    echo "Файл before.rules восстановлен из бэкапа."
else
    echo "ВНИМАНИЕ: Бэкап before.rules.bak не найден. Правила NAT придется удалять вручную."
fi

echo "--- 3. Удаление разрешающих правил портов ---"
ufw delete allow 443/tcp
ufw delete allow 8443/tcp
ufw delete allow "$NGINX_PORT"/tcp
ufw delete allow 10000:60000/tcp
ufw delete allow 10000:60000/udp

echo "--- 4. Возврат политики FORWARD по умолчанию (DROP) ---"
sed -i 's/DEFAULT_FORWARD_POLICY="ACCEPT"/DEFAULT_FORWARD_POLICY="DROP"/' /etc/default/ufw

echo "--- 5. Перезапуск фаервола ---"
ufw reload

#################################
# RESULT
#################################

echo "Docker контейнеры удалены"
echo "UFW NAT очищен"
echo "ip_forward отключён"
log "Откат завершён. Для применения изменений перезагрузите систему!"