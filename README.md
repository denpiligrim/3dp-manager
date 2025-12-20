[English](https://github.com/denpiligrim/3dp-manager/blob/main/README_EN.md)

# 3DP-MANAGER

> [!WARNING]
> **Это бета-версия!**
>
> Программа находится в активной разработке. Возможны баги, нестабильность и изменения API.
> Используйте с осторожностью.

3DP-MANAGER — утилита, которая позволяет регулярно генерировать входящие подключения для панели 3X-UI на основе списка разрешённых доменов (whitelist). Белый список общий, но вы также можете добавить свой собственный список, назвав его `my_whitelist.txt` и поместив его в папку `/opt/3dp-manager/app` на вашем сервере.
Обсуждения доступны в Телеграм канале: [@denpiligrim_web](https://t.me/denpiligrim_web/719)

### Установка
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/install.sh)
```

### Обновление
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/update.sh)
```

### Удаление
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/delete.sh)
```

---

Сервис подписок и перенаправления входящего трафика работает совместно с **3DP-MANAGER** и позволяет перенаправлять весь входящий трафик с промежуточного сервера на основной сервер. Перенаправляются те же порты: `443`, `8443` и диапазон `10000-60000`. Сервис также создаёт ссылку на подписку, автоматически заменяя IP-адрес или домен в конфигурациях. Перенаправления настраиваются добавлением правил iptables в конфигурационный файл ufw, что обеспечивает стабильную работу в сочетании с файрволом. Рекомендуется устанавливать сервис на чистый сервер без ранее настроенных правил.

### Установка перенаправления
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/forwarding_install.sh)
```

### Удаление перенаправления
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/forwarding_delete.sh)
```

---

### Показать URL подписки
```bash
cd /opt/3dp-manager && docker compose exec node env | grep SUB_URL | cut -d'=' -f2
```

---

### Утилита для сбора доменов из мульти-подписок
Позволяет собирать домены из подписок с несколькими конфигурациями. В интернете встречается много подобных списков конфигураций, использующих белый SNI. Инструмент позволяет извлечь домены и подготовить готовый список для дальнейшего использования в генераторе входящих подключений.
Вставьте ссылку на подписку в скрипт и запустите команду в окружении `Node.js`.
```bash
node get_domains.js
```

### Использовать свой белый список
Файл должен иметь структуру аналогичную `whitelist.txt`. Переименуйте имя файла на `my_whitelist.txt`. Загрузите файл в папку `/opt/3dp-manager/app` на сервере и выполните команду:
```bash
cd /opt/3dp-manager && docker cp ./app/my_whitelist.txt node:/app/my_whitelist.txt
```