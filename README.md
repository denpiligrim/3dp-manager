[English](/README_EN.md) | [中文](/README_CN.md) | [فارسی](/README_IR.md) | [Türkmençe](/README_TK.md)

<p><img src="https://denpiligrim.ru/storage/images/3dp-manager.png" alt="3dp-manager preview"></p>

![Version](https://img.shields.io/badge/version-1.0-blue.svg) [![License](https://img.shields.io/badge/license-GPL%20V3-blue.svg?longCache=true)](https://www.gnu.org/licenses/gpl-3.0) [![Telegram](https://img.shields.io/badge/Telegram-26A5E4?style=flat&logo=telegram&logoColor=white)](https://t.me/denpiligrim_web) [![YouTube Channel Subscribers](https://img.shields.io/youtube/channel/subscribers/UCOv2tFFYDY4mXOM60PVz8zw)](https://www.youtube.com/@denpiligrim)

# 3DP-MANAGER

Утилита для автогенерации инбаундов к панели [3x-ui](https://github.com/MHSanaei/3x-ui), формирования единой подписки и настройки перенаправления трафика с промежуточного сервера на основной.

**Поддержать проект**

- Реквизиты / донаты:
	- Карта МИР: `2204320436318077`
	- Карта MasterCard: `5395452209474530`
	- ЮМоney: `4100116897060652`
	- PayPal: `vasiljevdenisx@gmail.com`
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

Вторичная цель — стабильность подключения: клиент получает 10 вариантов поключений и может выбрать любое из них.

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

- Ubuntu 20.04 (и выше)
- Панель `3x-ui`
- Домен + SSL сертификат (опционально)

---

## Установка

Установите проект на сервер командой:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/dp-fix/install.sh)
```

<small>Краткое описание: запускает скрипт установки и разворачивает контейнеры и сервисы.</small>

## Обновление

Обновление до последней версии:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/dp-fix/update.sh)
```

<small>Краткое описание: подтягивает последние изменения и перезапускает контейнеры.</small>

## Удаление

Полное удаление сервиса:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/dp-fix/delete.sh)
```

<small>Краткое описание: удаляет контейнеры и файлы конфигурации, возвращая систему к состоянию до установки.</small>

---

## Установка сервиса перенаправления (forwarding)

Сервис перенаправления позволяет проксировать входящие порты с промежуточного сервера на основной.

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/dp-fix/forwarding_install.sh)
```

<small>Краткое описание: добавляет правила перенаправления и создает сервис для обновления подписки.</small>

## Удаление перенаправления

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/dp-fix/forwarding_delete.sh)
```

<small>Краткое описание: удаляет правила и отключает сервис перенаправления.</small>

---

## Показать URL подписки

Команда для вывода текущего URL подписки из среды контейнера:

```bash
cd /opt/3dp-manager && docker compose exec node env | grep SUB_URL | cut -d'=' -f2
```

<small>Краткое описание: выводит статичный URL подписки, который можно использовать в клиентах. Работает как на оснвном, так и на промежуточном сервере.</small>

## Сбор доменов из мульти-подписок

Утилита извлекает домены из подписок и формирует `whitelist` для генератора.

```bash
node get_domains.js
```

<small>Краткое описание: добавьте ссылку на мульти-подписку в скрипт и запустите команду — на выходе получите список доменов. Неободим `Node.js` для работы скрипта.</small>

## Использование собственного белого списка

1. Подготовьте файл в формате `whitelist.txt`.
2. Переименуйте на `my_whitelist.txt` и скопируйте в папку `/opt/3dp-manager/app`.

```bash
cd /opt/3dp-manager && docker cp ./app/my_whitelist.txt node:/app/my_whitelist.txt
```

<small>Краткое описание: добавляет ваш файл доменов в контейнер приложения.</small>

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

<small>Советы: описывайте изменения в PR, указывайте цель и тестовые шаги. Если изменения большие — разделяйте на маленькие коммиты.</small>

---

## Обсуждение

- Телеграм: [@denpiligrim_web](https://t.me/denpiligrim_web)
- Раздел Issues в данном репозитории