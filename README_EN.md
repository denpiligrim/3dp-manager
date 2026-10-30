[Русский](README.md) · [中文](README_CN.md) · [فارسی](README_IR.md) · [Türkmençe](README_TK.md)

<p><img src="https://denpiligrim.ru/storage/images/3dp-manager.png" alt="3dp-manager preview"></p>

![Version](https://img.shields.io/badge/version-3.0.0-blue.svg) ![Downloads](https://img.shields.io/badge/downloads-7k-blue) [![License](https://img.shields.io/badge/license-GPL%20V3-blue.svg?longCache=true)](https://www.gnu.org/licenses/gpl-3.0) [![Telegram](https://img.shields.io/badge/Telegram-26A5E4?style=flat&logo=telegram&logoColor=white)](https://t.me/denpiligrim_web) [![YouTube](https://img.shields.io/badge/DenPiligrim-11k-red?style=flat&logo=youtube)](https://www.youtube.com/@denpiligrim)

# 3DP-MANAGER

A web application for managing connections and subscriptions through the [3x-ui](https://github.com/MHSanaei/3x-ui) API. It combines inbounds from multiple nodes into one subscription with a permanent URL and updates them manually or on a schedule.

## Features

- Multiple 3x-ui nodes with token or username/password authentication.
- Separate node, relay, port, flag, and name settings for each inbound.
- An existing client from the 3x-ui Clients section, or automatic client creation.
- External connection links and Happ and INCY routing profiles.
- Subscription notes, support and website links, traffic statistics, and expiration information.
- An SNI domain list with import, export, and automatic discovery. When a node or relay is created, its domain is added automatically; IP addresses are skipped.
- Background generation and deletion with load limits, retries, and an operation journal.

## Requirements

- An Ubuntu or Debian server and root access for the installation script.
- Docker and Docker Compose; the installer installs them if necessary.
- One or more 3x-ui panels with working inbound and Clients APIs. Protocol and token support depends on the panel version.
- SSH access to the intermediate server for relay setup.
- A certificate and private key on the corresponding node for TLS inbounds.

## Installation

Run as root on the server:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/install.sh)
```

The installer deploys PostgreSQL, the backend, and the frontend in `/opt/3dp-manager`. Choose HTTP or HTTPS with Let's Encrypt, your own certificate, or a self-signed certificate. The interface URL, port, username, and password are printed when installation finishes. After signing in, change the password under **Settings (Настройки)**.

## Setup

1. Under **Nodes (Ноды)**, add the 3x-ui panel URL, credentials, IP address, and flag. The IP address and country are detected automatically and can be corrected manually. The main node is used by default.
2. If needed, add an intermediate server under **Relay servers (Relay серверы)**, select its node, and install forwarding through the interface. The relay host can be a domain or an IP address.
3. Under **Domains (Домены)**, configure the SNI list for Reality connections.
4. Under **Subscriptions (Подписки)**, enter the basic details, add inbounds, and optionally add routing profiles. A subscription can contain up to 20 items in total.
5. Save the subscription and start generation. Copy its URL into your client application. The URL has the form `/bus/<UUID>` and remains unchanged during rotation.

The **Client ID** field accepts the ID, email, or name of an existing 3x-ui client. That client must be available on every selected node. Leave the field empty to create a client automatically. Its identifier appears below the subscription name.

For scheduled generation, enable auto-rotation for the required subscriptions and set a shared interval of at least 10 minutes. Manual updates are available for a single subscription or all active subscriptions with auto-rotation enabled.

## Connection types

| Type | Transport and security |
| --- | --- |
| `vless-tcp-reality` | VLESS TCP + Reality |
| `vless-xhttp-reality` | VLESS XHTTP + Reality |
| `vless-xhttp-get` | VLESS XHTTP, `packet-up`, GET uplink, no TLS |
| `vless-grpc-reality` | VLESS gRPC + Reality |
| `vless-ws` | VLESS WebSocket + TLS, path `/ws` |
| `vmess-tcp` | VMess TCP |
| `shadowsocks-tcp` | Shadowsocks TCP |
| `trojan-tcp-reality` | Trojan TCP + Reality |
| `hysteria2-udp` | Hysteria2 UDP + TLS, Salamander |
| `custom` | An existing external connection link |

Set the port to a number from `1` to `65535`, or use `random` to select a port in the `10000–59999` range. The port must be accessible on the node and, when forwarding is used, on the relay.

For Reality, select a specific SNI domain or `random` from the domain list. WebSocket and Hysteria2 use the node's domain or IP address as SNI. WebSocket also uses that address as Host. A relay changes the connection destination, while WebSocket Host and SNI remain the node's address.

Reality and VLESS WebSocket support fingerprint selection. The default is `firefox`.

### WebSocket and Hysteria2 certificates

The default certificate and key paths depend on the node address:

| Node address | Certificate | Private key |
| --- | --- | --- |
| A domain, such as `second.denpiligrim.ru` | `/root/cert/second.denpiligrim.ru/fullchain.pem` | `/root/cert/second.denpiligrim.ru/privkey.pem` |
| IPv4 or IPv6 | `/root/cert/ip/fullchain.pem` | `/root/cert/ip/privkey.pem` |

You can override the paths in the inbound settings. The files must exist on the node; the application passes their paths to 3x-ui.

## Background tasks and journal

Inbound generation, subscription and node deletion, relay deletion, and forwarding installation or removal run in the background. The interface displays task status and protects against duplicate launches.

Batch rotation processes subscriptions one at a time and gives other queued tasks a turn between subscriptions. Temporary inbound creation and deletion errors are retried up to three times, with delays and outcome checks. A failure in one subscription does not stop the entire batch.

The **Journal (Журнал)** shows progress, results, and retries, with process and status filters and 20 entries per page. It refreshes automatically. Completed entries are retained for up to 30 days, with a limit of 50,000 events.

The queue survives application restarts. A task that was already running is marked as interrupted and is not retried automatically: check its outcome on the node before starting it again.

See the [background operations documentation](docs/background-operations.md) (in Russian) for delay settings, queue behavior, and API changes.

## Updating

For installations created by the installer:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/update.sh)
```

The script backs up the database to `/opt/3dp-manager/backups`, enables migrations, and updates the containers. Keep `.env` and `docker-compose.yml`: they contain the configuration of the existing installation.

For a custom deployment, update the database schema together with the backend. The background queue requires migration `1793300000000-add-operations`; see [database updates](docs/background-operations.md#обновление-бд) (in Russian).

## Uninstalling

This command removes the project containers, database volume, and `/opt/3dp-manager` directory, including backups stored inside it:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/delete.sh)
```

## Feedback

[Issues](https://github.com/denpiligrim/3dp-manager/issues) · [Telegram](https://t.me/denpiligrim_web) · [GPL-3.0 license](LICENSE)
