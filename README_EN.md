[Русский](/README.md) | [中文](/README_CN.md) | [فارسی](/README_IR.md) | [Türkmençe](/README_TK.md)

<p><img src="https://denpiligrim.ru/storage/images/3dp-manager.png" alt="3dp-manager preview"></p>

![Version](https://img.shields.io/badge/version-3.0.0-blue.svg) ![Downloads](https://img.shields.io/badge/downloads-5.1k-blue) [![License](https://img.shields.io/badge/license-GPL%20V3-blue.svg?longCache=true)](https://www.gnu.org/licenses/gpl-3.0) [![Telegram](https://img.shields.io/badge/Telegram-26A5E4?style=flat&logo=telegram&logoColor=white)](https://t.me/denpiligrim_web) [![YouTube Channel Subscribers](https://img.shields.io/youtube/channel/subscribers/UCOv2tFFYDY4mXOM60PVz8zw)](https://www.youtube.com/@denpiligrim)

# 3DP-MANAGER

A utility for automatically generating inbounds for the [3x-ui](https://github.com/MHSanaei/3x-ui) panel, creating unified subscriptions, managing multiple 3x-ui nodes, and configuring relay forwarding from intermediate servers to origin servers. Since version 2.0.0, the project has a graphical interface and simple user-facing settings.

**Support the project**

- Bank transfer:
  - :credit_card: MIR card: `2204320436318077`
  - :credit_card: MasterCard: `5395452209474530`
- E-wallet:
  - :moneybag: YooMoney: `4100116897060652`
  - :moneybag: PayPal: `vasiljevdenisx@gmail.com`
- Crypto:
  - :coin: USDT | ETH (ERC20 | BEP20): `0x6fe140040f6Cdc1E1Ff2136cd1d60C0165809463`
  - :coin: USDT | TRX (TRC20): `TEWxXmJxvkAmhshp7E61XJGHB3VyM9hNAb`
  - :coin: Bitcoin: `bc1qctntwncsv2yn02x2vgnkrqm00c4h04c0afkgpl`
  - :coin: TON: `UQCZ3MiwyYHXftPItMMzJRYRiKHugr16jFMq2nfOQOOoemLy`
  - :coin: Bybit ID: `165292278`

## Description

The main goal of the utility is to make your traffic look less uniform. 3DP-MANAGER generates a set of connections at a configured interval with different parameters:

- protocols: `vless`, `vmess`, `shadowsocks`, `hysteria2`, `trojan`;
- ports: fixed `443`, `8443`, plus random ports from `10000-60000`;
- transport: `tcp`, `websocket`, `grpc`, `xhttp`;
- SNI values are taken from the domain whitelist or set manually;
- node, relay server, port, and flag can be configured separately for each inbound.

All connections are combined into one subscription with a static URL. 3DP-MANAGER works with the `3x-ui` panel through its public API and does not directly interfere with the panel internals.

The secondary goal is connection stability: the client receives several connection options and can choose any of them. One subscription can contain inbounds from different nodes, relay servers, and your own external links as custom connections.

Additionally, 3DP-MANAGER can be used in a cascading setup. The forwarding service configures subscription and traffic forwarding to the selected node.

Recommendations:

- Use HTTPS for subscriptions (domain + SSL certificate).
- Set the generation interval to at least 10 minutes; for stability, once per day (1440 minutes) is recommended.
- Configure the client to refresh more frequently, for example every hour, so it stays synchronized with the server.

## Features

- Generates diverse connections for one or more subscriptions
- Creates a unified subscription with a static URL
- Manages multiple `3x-ui` nodes
- Supports node authentication by login/password or token
- Automatically detects node IP, country, and flag from the panel URL
- Lets you choose node, relay server, flag, SNI, and port per inbound
- Supports a fixed port or `random`
- Supports custom connections: add a ready-made external link to a subscription
- Allows separate `fullchain.pem` and `privkey.pem` paths for Hysteria2 UDP
- Supports a custom domain `whitelist`
- Optional automatic relay forwarding setup
- Installs the Web UI over HTTP or HTTPS: Let's Encrypt, self-signed, or custom certificates

## Requirements

- Ubuntu 20.04 or newer, Debian 12.11 or newer
- `3x-ui` panel v2.8.4 or newer
- Root access on the server
- Docker and Docker Compose; if missing, the installer will try to install them automatically
- Domain + SSL certificate (optional)

---

## Installation

The `3x-ui` control panel must already be installed. You can install it with: `bash <(curl -Ls https://raw.githubusercontent.com/mhsanaei/3x-ui/master/install.sh)`

Install the project on the server:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/install.sh)
```

During installation, the script will:

- check the OS, root access, Docker, and Docker Compose;
- create a 2 GB swap file if RAM is low and swap is missing;
- ask which Web UI access mode to use:
  - HTTPS via Let's Encrypt;
  - HTTPS with a self-signed certificate;
  - HTTPS with your own certificates;
  - HTTP without encryption;
- generate a random Web UI port;
- generate the administrator login and password;
- deploy the `postgres`, `backend`, and `frontend` containers.

After installation, the terminal will show the URL, login, and password. Change the password immediately in the 3DP-MANAGER settings.

<sup>Short description: runs the interactive installer, prepares the environment, and deploys the project containers.</sup>

## Update

Update to the latest version:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/update.sh)
```

<sup>Short description: pulls the latest changes, applies compatible configuration fixes, updates containers, and restarts the service.</sup>

## Removal

Remove the service completely:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/delete.sh)
```

<sup>Short description: removes containers and configuration files, restoring the system to the pre-install state.</sup>

---

## First Login

The administrator login and password are printed at the end of installation. To view them again:

```bash
grep -E "ADMIN_LOGIN|ADMIN_PASSWORD" /opt/3dp-manager/docker-compose.yml | sed 's/^[ \t]*//; s/^- //'
```

The Web UI is available at the address shown by the installer, for example:

- `https://example.com:PORT` for HTTPS;
- `http://SERVER_IP:PORT` for HTTP.

If `ufw` is active, the installer opens the working inbound port ranges: `443`, `8443`, and `10000-60000` for TCP/UDP.

---

## Nodes

The **Nodes** section lets you connect one or more `3x-ui` panels.

For each node, you specify:

- name;
- `3x-ui` panel URL;
- node IP;
- flag/country;
- authentication type: `password` or `token`;
- whether this node is the main node.

After you enter the URL, the application tries to detect the node IP and country automatically. The flag is used in connection names inside the subscription so clients can distinguish servers more easily.

> [!NOTE]
> The main node is used as the default value for subscriptions, inbounds, and relay servers.

---

## Subscriptions

The **Subscriptions** section manages static subscription URLs and inbound composition.

For each inbound, you can configure:

- connection type;
- node;
- relay server;
- flag;
- port: a concrete number from `1-65535` or `random`;
- SNI: a concrete domain or `random`;
- a ready-made external link for the `custom` type.

For `hysteria2-udp`, you can specify separate certificate and key paths:

- `certificateFile`, for example `/root/cert/example.com/fullchain.pem`;
- `keyFile`, for example `/root/cert/example.com/privkey.pem`.

If port or SNI is set to `random`, the value will be selected during rotation from the available range or domain whitelist.

---

## Install Forwarding Service

> [!WARNING]
> The forwarding service runs on an intermediate server

The forwarding service proxies incoming ports from an intermediate server to the selected node. In the Web UI, these servers are configured in **Relay servers** and can be linked to a specific node.

A relay server can be added by IP or domain. If a domain is provided, the backend will try to resolve its IP automatically.

For manual forwarding installation on the intermediate server, replace `IP_ADDRESS` with the origin node IP:

```bash
sudo ORIGIN_IP="IP_ADDRESS" bash -c "$(curl -sSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/forwarding_install.sh)"
```

<sup>Short description: adds forwarding rules.</sup>

## Remove Forwarding

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/forwarding_delete.sh)
```

<sup>Short description: removes forwarding rules. After removal, reload the firewall with `ufw reload` and reboot the system with `reboot` for changes to take effect.</sup>

---

## Collect Domains From Multi-Subscriptions

The utility extracts domains from subscriptions and builds a `whitelist` for the generator.

```bash
node get_domains.js
```

<sup>Short description: add a multi-subscription link to the script and run the command. The output will be a domain list. `Node.js` is required.</sup>

---

## Notes And Current Limitations

- The shared domain list may not work with all providers, so it is recommended to prepare and use your own whitelist.

---

## Contributing

Contributions are welcome! Simple contributor workflow:

1. Fork the repository on GitHub.
2. Create a branch with a meaningful name, for example `feature/add-README` or `fix/whitelist-load`.
3. Make changes and add a short description in the commit.
4. Run local checks if available.
5. Push the branch to your fork and create a Pull Request to the main repository.

<sup>Tips: describe your changes in the PR, include the goal and test steps. If the changes are large, split them into small commits.</sup>

---

## Discussion

- Telegram: [@denpiligrim_web](https://t.me/denpiligrim_web)
- Issues section in this repository
