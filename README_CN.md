[Русский](/README.md) | [English](/README_EN.md) | [فارسی](/README_IR.md) | [Türkmençe](/README_TK.md)

<p><img src="https://denpiligrim.ru/storage/images/3dp-manager.png" alt="3dp-manager preview"></p>

![Version](https://img.shields.io/badge/version-1.0.1.1-blue.svg) [![License](https://img.shields.io/badge/license-GPL%20V3-blue.svg?longCache=true)](https://www.gnu.org/licenses/gpl-3.0) [![Telegram](https://img.shields.io/badge/Telegram-26A5E4?style=flat&logo=telegram&logoColor=white)](https://t.me/denpiligrim_web) [![YouTube Channel Subscribers](https://img.shields.io/youtube/channel/subscribers/UCOv2tFFYDY4mXOM60PVz8zw)](https://www.youtube.com/@denpiligrim)

# 3DP-MANAGER

这是一个用于为 `3x-ui` 面板自动生成入站连接、生成统一订阅并将流量从中继服务器转发到主服务器的实用工具。

**支持项目**

- 捐助/支付信息：
  - MIR 卡: `2204320436318077`
  - MasterCard: `5395452209474530`
  - PayPal: `vasiljevdenisx@gmail.com`
  - USDT | ETH (ERC20 | BEP20): `0x6fe140040f6Cdc1E1Ff2136cd1d60C0165809463`
  - USDT | TRX (TRC20): `TEWxXmJxvkAmhshp7E61XJGHB3VyM9hNAb`
  - 比特币: `bc1qctntwncsv2yn02x2vgnkrqm00c4h04c0afkgpl`
  - TON: `UQCZ3MiwyYHXftPItMMzJRYRiKHugr16jFMq2nfOQOOoemLy`
  - Bybit ID: `165292278`

## 描述

该工具的主要目标是使您的流量看起来不那么统一。机器人会在设定间隔生成 10 个具有不同参数的连接：

- 协议：`vless`、`vmess`、`shadowsocks`、`trojan`
- 端口：`443`、`8443`（固定）以及 `10000-60000` 范围内的随机端口
- 传输：`tcp`、`websocket`、`grpc`、`xhttp`
- SNI 从域名白名单（`whitelist`）中获取；也可以使用自定义列表

所有连接会合并为具有静态 URL 的单一订阅。该机器人通过 `3x-ui` 面板的公共 API 工作，不会直接修改面板内部。

次要目标是提高连接稳定性：客户端会收到 10 个可选连接，用户可以选择任意一个。

此外，机器人可用于级联部署。转发服务会自动配置将订阅和流量重定向到主服务器。

建议：

- 订阅请使用 HTTPS（域名 + SSL 证书）。
- 生成间隔设置为 ≥ 10 分钟；为稳定性建议每天一次（1440 分钟）。
- 在客户端设置更频繁的自动更新（例如每小时），以便与服务器同步。

## 功能

- 生成 10 个多样化连接
- 形成具有静态 URL 的统一订阅
- 支持自定义 `whitelist` 域名
- 可选的自动流量转发配置

## 要求

- Ubuntu 20.04 或更高
- `3x-ui` 面板
- 域名 + SSL 证书（可选）

---

## 安装

在服务器上运行以下命令安装项目：

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/install.sh)
```

<sup>简要说明：运行安装脚本并部署容器和服务。</sup>

## 更新

更新到最新版本：

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/update.sh)
```

<sup>简要说明：拉取最新更改并重启容器。</sup>

## 删除

彻底删除服务：

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/delete.sh)
```

<sup>简要说明：删除容器和配置文件，恢复到安装前状态。</sup>

---

## 安装转发服务（forwarding）

转发服务允许将中继服务器的入站端口代理到主服务器。

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/forwarding_install.sh)
```

<sup>简要说明：添加转发规则并创建用于更新订阅的服务。</sup>

## 删除转发

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/forwarding_delete.sh)
```

<sup>简要说明：删除规则并禁用转发服务。</sup>

---

## 显示订阅 URL

在容器环境中打印当前订阅 URL 的命令：

```bash
cd /opt/3dp-manager && docker compose exec node env | grep SUB_URL | cut -d'=' -f2
```

<sup>简要说明：打印可在客户端使用的静态订阅 URL，适用于主服务器和中继服务器。</sup>

## 从多订阅收集域名

该工具可从订阅中提取域名并为生成器构建 `whitelist`。

```bash
node get_domains.js
```

<sup>简要说明：在脚本中添加多订阅链接并运行命令 — 输出为域名列表。运行脚本需要 `Node.js`。</sup>

## 使用自定义白名单

1. 准备一个与 `whitelist.txt` 相同格式的文件。
2. 将其重命名为 `my_whitelist.txt` 并复制到 `/opt/3dp-manager/app`。

```bash
cd /opt/3dp-manager && docker cp ./app/my_whitelist.txt node:/app/my_whitelist.txt
```

<sup>简要说明：将您的域名文件添加到应用容器中。</sup>

---

## 注意与当前限制

- 共享的域名列表可能并非对所有提供商都有效；建议准备并使用自定义 `whitelist`。

---

## 贡献

欢迎贡献！简单的贡献流程：

1. 在 GitHub 上 fork 仓库。
2. 创建有意义的分支名，例如 `feature/add-README` 或 `fix/whitelist-load`。
3. 提交更改并添加简短的提交信息。
4. 在本地运行检查（如有）。
5. 推送分支到您的 fork 并创建 Pull Request。

<sup>建议：在 PR 中说明更改和测试步骤；较大更改请拆成小提交。</sup>

---

## 讨论

- Telegram: [@denpiligrim_web](https://t.me/denpiligrim_web)
- Issues