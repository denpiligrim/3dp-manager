[English](/README_EN.md) | [中文](/README_CN.md) | [فارسی](/README_IR.md) | [Türkmençe](/README_TK.md)

<p><img src="https://denpiligrim.ru/storage/images/3dp-manager.png" alt="3dp-manager preview"></p>

![Version](https://img.shields.io/badge/version-1.0.1-blue.svg) [![License](https://img.shields.io/badge/license-GPL%20V3-blue.svg?longCache=true)](https://www.gnu.org/licenses/gpl-3.0) [![Telegram](https://img.shields.io/badge/Telegram-26A5E4?style=flat&logo=telegram&logoColor=white)](https://t.me/denpiligrim_web) [![YouTube Channel Subscribers](https://img.shields.io/youtube/channel/subscribers/UCOv2tFFYDY4mXOM60PVz8zw)](https://www.youtube.com/@denpiligrim)

# 3DP-MANAGER

Утилита для автогенерации инбаундов к панели [3x-ui](https://github.com/MHSanaei/3x-ui), формирования единой подписки и настройки перенаправления трафика с промежуточного сервера на основной.

**Поддержать проект**

- Банковским переводом:
	- Карта МИР: `2204320436318077`
	- Карта MasterCard: `5395452209474530`
- На электронный кошелек:
	- ЮМоney: `4100116897060652`
	- PayPal: `vasiljevdenisx@gmail.com`
- Криптовалютой:
	- USDT | ETH (ERC20 | BEP20): `0x6fe140040f6Cdc1E1Ff2136cd1d60C0165809463`
	- USDT | TRX (TRC20): `TEWxXmJxvkAmhshp7E61XJGHB3VyM9hNAb`
	- Bitcoin: `bc1qctntwncsv2yn02x2vgnkrqm00c4h04c0afkgpl`
	- TON: `UQCZ3MiwyYHXftPItMMzJRYRiKHugr16jFMq2nfOQOOoemLy`
	- Bybit ID: `165292278`

## Описание

Главная цель утилиты — сделать так, чтобы ваш трафик не выглядел одинаковым. Бот генерирует по заданному интервалу 10 подключений с разными параметрами:

- протоколы: `vless`, `vmess`, `shadowsocks`, `trojan`;
- порты: `443`, `8443` (фиксированные) и случайные из диапазона `10000-60000`;
- транспорт: `tcp`, `websocket`, `grpc`, `xhttp`;
- SNI берутся из белого списка доменов (whitelist); можно использовать свой список.

Все подключения объединяются в одну подписку со статичным URL. Бот работает с панелью `3x-ui` и не вмешивается в её работу напрямую, используя открытое API панели.

Вторичная цель — стабильность подключения: клиент получает 10 вариантов подключений и может выбрать любое из них.

Дополнительно: бот можно использовать в каскадной схеме. Сервис перенаправления автоматически настроит переадресацию подписки и трафика к основному серверу.

Рекомендации:

- Используйте HTTPS для подписки (домен + SSL сертификат).
- Интервал генерации задавайте ≥ 10 минут; для стабильности рекомендуется — раз в сутки (1440 минут).
- В клиенте установите автообновление чаще (например, каждый час), чтобы была синхронизация с сервером.

## Возможности

- Генерация 10 разнообразных подключений
- Формирование единой подписки со статичным URL
- Поддержка кастомного `whitelist` доменов
- Автоматическая настройка перенаправления трафика (опционально)

## Требования

- Ubuntu 20.04 (и выше), Debian 12.11 (и выше)
- Панель `3x-ui` v2.8.4 (и выше)
- Домен + SSL сертификат (опционально)

---

## Установка

У вас должны быть установлены пакеты на сервере `curl`, `jq` командой: `apt install curl jq` и панель управления `3x-ui`, которую можно установить командой: `bash <(curl -Ls https://raw.githubusercontent.com/mhsanaei/3x-ui/master/install.sh)`
Установите проект на сервер командой:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/install.sh)
```

<sup>Краткое описание: запускает скрипт установки и разворачивает контейнеры и сервисы.</sup>

Если панель 3x-ui находится в Docker контейнере или на другом сервере, установите командой:

```bash
REMOTE_PANEL=true bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/install.sh)
```

## Обновление

Обновление до последней версии:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/update.sh)
```

<sup>Краткое описание: подтягивает последние изменения и перезапускает контейнеры.</sup>

## Удаление

Полное удаление сервиса:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/delete.sh)
```

<sup>Краткое описание: удаляет контейнеры и файлы конфигурации, возвращая систему к состоянию до установки.</sup>

---

## Установка сервиса перенаправления (forwarding)

> [!WARNING]  
> Сервис перенаправления работает на промежуточном сервере.

Сервис перенаправления позволяет проксировать входящие порты с промежуточного сервера на основной.

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/forwarding_install.sh)
```

<sup>Краткое описание: добавляет правила перенаправления и создает сервис для обновления подписки.</sup>

## Удаление перенаправления

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/forwarding_delete.sh)
```

<sup>Краткое описание: удаляет правила и отключает сервис перенаправления.</sup>

---

## Показать URL подписки

Команда для вывода текущего URL подписки из среды контейнера:

```bash
cd /opt/3dp-manager && docker compose exec node env | grep SUB_URL | cut -d'=' -f2
```

<sup>Краткое описание: выводит статичный URL подписки, который можно использовать в клиентах. Работает как на основном, так и на промежуточном сервере.</sup>

## Сбор доменов из мульти-подписок

Утилита извлекает домены из подписок и формирует `whitelist` для генератора.

```bash
node get_domains.js
```

<sup>Краткое описание: добавьте ссылку на мульти-подписку в скрипт и запустите команду — на выходе получите список доменов. Необходим `Node.js` для работы скрипта.</sup>

## Использование собственного белого списка

1. Подготовьте файл в формате `whitelist.txt`.
2. Переименуйте на `my_whitelist.txt` и скопируйте в папку `/opt/3dp-manager/app`.

```bash
cd /opt/3dp-manager && docker cp ./app/my_whitelist.txt node:/app/my_whitelist.txt
```

<sup>Краткое описание: добавляет ваш файл доменов в контейнер приложения. Чтобы сразу же сгенерировать инбаунды с новым списком, выполните `docker exec -it node sh` и затем `node index.js`.</sup>

---

## Замечания и текущие ограничения

- Общий список доменов работает не у всех провайдеров, поэтому рекомендуется составить и использовать свой whitelist.

---

## Внести вклад

Буду рад любому вкладу в разработку проекта! Простой процесс для контрибьюторов:

1. Форкните репозиторий на GitHub.
2. Создайте ветку с осмысленным именем, например `feature/add-README` или `fix/whitelist-load`.
3. Внесите изменения и добавьте короткое описание в коммите.
4. Запустите локально базовые проверки (если есть).
5. Отправьте ветку в ваш форк и создайте Pull Request в основной репозиторий.

<sup>Советы: описывайте изменения в PR, указывайте цель и тестовые шаги. Если изменения большие — разделяйте на маленькие коммиты.</sup>

---

## Обсуждение

- Телеграм: [@denpiligrim_web](https://t.me/denpiligrim_web)
- Раздел Issues в данном репозитории