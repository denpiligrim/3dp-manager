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

# Check OS and set release variable
. /etc/os-release
if [[ "$ID" != "ubuntu" && "$ID" != "debian" ]]; then
    die "Этот скрипт поддерживает только Ubuntu или Debian: $ID"
fi

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
# Определяем ORIGIN_IP
#################################
[[ -n ${ORIGIN_IP:-} ]] || die "Укажите ORIGIN_IP"

if [[ -z ${FORWARDING_TCP_PORTS+x} && -z ${FORWARDING_UDP_PORTS+x} ]]; then
    FORWARDING_TCP_PORTS=443,8443,10000:60000
    FORWARDING_UDP_PORTS=$FORWARDING_TCP_PORTS
fi

forwarded_ports=()
parse_ports() {
    local proto=$1 list=$2 item first last port
    local -a items
    local pattern='^[[:space:]]*([0-9]{1,5})([[:space:]]*:[[:space:]]*([0-9]{1,5}))?[[:space:]]*$'
    [[ -n $list ]] || return 0
    [[ $list != *$'\n'* && $list != *, ]] || die "Некорректный список портов $proto"
    IFS=, read -r -a items <<< "$list"
    for item in "${items[@]}"; do
        [[ $item =~ $pattern ]] || die "Некорректный порт $proto: '$item'"
        first=$((10#${BASH_REMATCH[1]}))
        last=$((10#${BASH_REMATCH[3]:-${BASH_REMATCH[1]}}))
        (( first >= 1 && first <= last && last <= 65535 )) || die "Недопустимый порт или диапазон $proto: '$item'"
        port=$first
        if (( first != last )); then
            port="$first:$last"
        fi
        forwarded_ports+=("$port/$proto")
    done
}

parse_ports tcp "${FORWARDING_TCP_PORTS:-}"
parse_ports udp "${FORWARDING_UDP_PORTS:-}"
(( ${#forwarded_ports[@]} )) || die "Укажите хотя бы один порт TCP или UDP"

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

write_forwarding_rules() {
cat <<EOF
*nat
:PREROUTING ACCEPT [0:0]
:POSTROUTING ACCEPT [0:0]
EOF
for entry in "${forwarded_ports[@]}"; do
    proto=${entry##*/}
    port=${entry%/*}
    echo "-A PREROUTING -p $proto --dport $port -j DNAT --to-destination $ORIGIN_IP"
    echo "-A POSTROUTING -p $proto -d $ORIGIN_IP --dport $port -j SNAT --to-source $LOCAL_IP"
done
cat <<EOF
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
}

sed -i '/\*nat/,/COMMIT/d' /etc/ufw/before.rules
sed -i '/\*mangle/,/COMMIT/d' /etc/ufw/before.rules

{ write_forwarding_rules; cat /etc/ufw/before.rules; } > /etc/ufw/before.rules.new
mv /etc/ufw/before.rules.new /etc/ufw/before.rules

echo "--- Открытие портов в самом фаерволе ---"
for entry in "${forwarded_ports[@]}"; do
    ufw allow "$entry"
done

sed -i 's/DEFAULT_FORWARD_POLICY="DROP"/DEFAULT_FORWARD_POLICY="ACCEPT"/' /etc/default/ufw

echo "--- Перезапуск ---"
ufw reload

echo "Готово! Система оптимизирована, порты открыты, трафик перенаправлен."

#################################
# RESULT
#################################
echo
log "Готово"