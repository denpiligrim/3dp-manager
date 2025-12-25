[Русский](/README.md) | [中文](/README_CN.md) | [فارسی](/README_IR.md) | [Türkmençe](/README_TK.md)

<p><img src="https://denpiligrim.ru/storage/images/3dp-manager.png" alt="3dp-manager preview"></p>

![Version](https://img.shields.io/badge/version-1.0-blue.svg) [![License](https://img.shields.io/badge/license-GPL%20V3-blue.svg?longCache=true)](https://www.gnu.org/licenses/gpl-3.0) [![Telegram](https://img.shields.io/badge/Telegram-26A5E4?style=flat&logo=telegram&logoColor=white)](https://t.me/denpiligrim_web) [![YouTube Channel Subscribers](https://img.shields.io/youtube/channel/subscribers/UCOv2tFFYDY4mXOM60PVz8zw)](https://www.youtube.com/@denpiligrim)

# 3DP-MANAGER

A utility for auto-generating inbound connections for the [3x-ui](https://github.com/MHSanaei/3x-ui) panel, creating a single subscription URL, and configuring traffic forwarding from an intermediate server to the main server.

**Support the project**

- Donation / payment details:
  - MIR card: `2204320436318077`
  - MasterCard: `5395452209474530`
  - PayPal: `vasiljevdenisx@gmail.com`
  - USDT | ETH (ERC20 | BEP20): `0x6fe140040f6Cdc1E1Ff2136cd1d60C0165809463`
  - USDT | TRX (TRC20): `TEWxXmJxvkAmhshp7E61XJGHB3VyM9hNAb`
  - Bitcoin: `bc1qctntwncsv2yn02x2vgnkrqm00c4h04c0afkgpl`
  - TON: `UQCZ3MiwyYHXftPItMMzJRYRiKHugr16jFMq2nfOQOOoemLy`
  - Bybit ID: `165292278`

## Description

The main goal of the utility is to make your traffic appear non-uniform. The bot generates 10 connection entries at a configured interval with varying parameters:

- Protocols: `vless`, `vmess`, `shadowsocks`, `trojan`;
- Ports: `443`, `8443` (fixed) and random ports from the range `10000-60000`;
- Transport: `tcp`, `websocket`, `grpc`, `xhttp`;
- SNI values are taken from a whitelist of domains (`whitelist`); you can use your own list.

All generated connections are combined into a single subscription with a static URL. The bot works with the `3x-ui` panel using its public API and does not directly modify the panel internals.

The secondary goal is connection stability: the client receives 10 alternate connection options and can choose any of them.

Additionally, the bot can be used in a cascading setup. The forwarding service will automatically configure the subscription and traffic redirection to the main server.

Recommendations:

- Use HTTPS for the subscription (domain + SSL certificate).
- Set the generation interval to ≥ 10 minutes; for stability, once per day (1440 minutes) is recommended.
- Configure the client to check for updates more frequently (for example, hourly) to stay synchronized with the server.

## Features

- Generates 10 diverse connection entries
- Creates a single subscription with a static URL
- Supports custom `whitelist` domains
- Optional automatic configuration of traffic forwarding

## Requirements

- Ubuntu 20.04 or newer
- `3x-ui` panel
- Domain + SSL certificate (optional)

---

## Installation

Install the project on your server with:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/install.sh)
```

<small>Short description: runs the installer script and deploys containers and services.</small>

## Update

Update to the latest version:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/update.sh)
```

<small>Short description: pulls the latest changes and restarts containers.</small>

## Removal

Remove the service completely:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/delete.sh)
```

<small>Short description: removes containers and configuration files, restoring the system to the pre-install state.</small>

---

## Install forwarding service

The forwarding service allows proxying incoming ports from the intermediate server to the main server.

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/forwarding_install.sh)
```

<small>Short description: adds forwarding rules and creates a service to update the subscription.</small>

## Remove forwarding

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/forwarding_delete.sh)
```

<small>Short description: removes rules and disables the forwarding service.</small>

---

## Show subscription URL

Command to print the current subscription URL from the container environment:

```bash
cd /opt/3dp-manager && docker compose exec node env | grep SUB_URL | cut -d'=' -f2
```

<small>Short description: prints the static subscription URL that can be used in clients. Works on both main and intermediate servers.</small>

## Collect domains from multi-subscriptions

The utility extracts domains from subscriptions and builds a `whitelist` for the generator.

```bash
node get_domains.js
```

<small>Short description: add a multi-subscription link to the script and run the command — the output will be a list of domains. `Node.js` is required to run the script.</small>

## Use your own whitelist

1. Prepare a file in the format of `whitelist.txt`.
2. Rename it to `my_whitelist.txt` and copy it into `/opt/3dp-manager/app`.

```bash
cd /opt/3dp-manager && docker cp ./app/my_whitelist.txt node:/app/my_whitelist.txt
```

<small>Short description: adds your domain file into the application container.</small>

---

## Notes and current limitations

- The shared domain list may not work with all providers; it is recommended to prepare and use your own `whitelist`.

---

## Contributing

Contributions are welcome! Simple contributor workflow:

1. Fork the repository on GitHub.
2. Create a branch with a meaningful name, e.g. `feature/add-README` or `fix/whitelist-load`.
3. Make changes and add a short commit message.
4. Run local checks if available.
5. Push the branch to your fork and create a Pull Request to the main repository.

<small>Tips: describe changes and testing steps in the PR. For large changes, split into smaller commits.</small>

---

## Discussion

- Telegram: [@denpiligrim_web](https://t.me/denpiligrim_web)
- Issues