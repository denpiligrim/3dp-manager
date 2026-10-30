[Русский](README.md) · [English](README_EN.md) · [فارسی](README_IR.md) · [Türkmençe](README_TK.md)

<p><img src="https://denpiligrim.ru/storage/images/3dp-manager.png" alt="3dp-manager preview"></p>

![Version](https://img.shields.io/badge/version-3.0.0-blue.svg) ![Downloads](https://img.shields.io/badge/downloads-7k-blue) [![License](https://img.shields.io/badge/license-GPL%20V3-blue.svg?longCache=true)](https://www.gnu.org/licenses/gpl-3.0) [![Telegram](https://img.shields.io/badge/Telegram-26A5E4?style=flat&logo=telegram&logoColor=white)](https://t.me/denpiligrim_web) [![YouTube](https://img.shields.io/badge/DenPiligrim-11k-red?style=flat&logo=youtube)](https://www.youtube.com/@denpiligrim)

# 3DP-MANAGER

通过 [3x-ui](https://github.com/MHSanaei/3x-ui) API 管理连接和订阅的 Web 应用。它将多个节点的入站连接合并为一个固定 URL 的订阅，支持手动或定时更新。

## 功能

- 管理多个 3x-ui 节点，支持令牌或用户名和密码认证。
- 为每个入站连接单独设置节点、relay 中继服务器、端口、旗帜和名称。
- 使用 3x-ui Clients 中的现有客户端，或自动创建客户端。
- 添加外部连接链接以及 Happ 和 INCY 路由配置。
- 设置订阅备注、支持链接和网站链接，查看流量统计和到期信息。
- SNI 域名列表支持导入、导出和自动发现。创建节点或 relay 时自动添加其域名，跳过 IP 地址。
- 在后台生成和删除连接，限制负载，支持重试和操作日志。

## 环境要求

- Ubuntu 或 Debian 服务器；运行安装脚本需要 root 权限。
- Docker 和 Docker Compose；若未安装，安装程序会自动安装。
- 一个或多个具有可用入站连接 API 和 Clients API 的 3x-ui 面板。协议和令牌的支持情况取决于面板版本。
- 配置 relay 需要中继服务器的 SSH 访问权限。
- TLS 入站连接需要在相应节点上准备证书和私钥。

## 安装

在服务器上以 root 身份运行：

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/install.sh)
```

安装程序会在 `/opt/3dp-manager` 中部署 PostgreSQL、后端和前端。可选择 HTTP，或使用 Let's Encrypt、自有证书或自签名证书的 HTTPS。安装完成后会显示界面地址、端口、用户名和密码。登录后，请在**设置（Настройки）**中修改密码。

## 配置

1. 在**节点（Ноды）**中添加 3x-ui 面板 URL、认证信息、IP 地址和旗帜。系统会自动识别 IP 和国家，也可手动修改。主节点作为默认节点。
2. 如需中继，在 **Relay 服务器（Relay серверы）**中添加中间服务器，选择目标节点，并通过界面安装转发。Relay 主机可以使用域名或 IP 地址。
3. 在**域名（Домены）**中配置 Reality 连接使用的 SNI 列表。
4. 在**订阅（Подписки）**中填写基本信息、添加入站连接，并按需添加路由配置。每个订阅最多包含 20 个项目。
5. 保存订阅并开始生成。将订阅 URL 复制到客户端应用中。地址格式为 `/bus/<UUID>`，轮换时保持不变。

**客户端 ID** 字段可填写现有 3x-ui 客户端的 ID、email 或名称。该客户端必须在所有选定节点上可用。留空时，应用会自动创建客户端。客户端标识显示在订阅名称下方。

要定时生成连接，请为所需订阅启用自动轮换，并设置不少于 10 分钟的统一间隔。可以手动更新单个订阅，也可以更新所有已启用自动轮换的有效订阅。

## 连接类型

| 类型 | 传输与安全 |
| --- | --- |
| `vless-tcp-reality` | VLESS TCP + Reality |
| `vless-xhttp-reality` | VLESS XHTTP + Reality |
| `vless-xhttp-get` | VLESS XHTTP，`packet-up`，GET 上行，无 TLS |
| `vless-grpc-reality` | VLESS gRPC + Reality |
| `vless-ws` | VLESS WebSocket + TLS，路径 `/ws` |
| `vmess-tcp` | VMess TCP |
| `shadowsocks-tcp` | Shadowsocks TCP |
| `trojan-tcp-reality` | Trojan TCP + Reality |
| `hysteria2-udp` | Hysteria2 UDP + TLS，Salamander |
| `custom` | 现有外部连接链接 |

端口可设为 `1` 至 `65535` 之间的整数，或设为 `random`，从 `10000–59999` 范围中选择。该端口必须在节点上可访问；使用转发时，relay 上也必须开放相应端口。

Reality 的 SNI 可从域名列表中选择具体域名或 `random`。WebSocket 和 Hysteria2 使用节点的域名或 IP 地址作为 SNI，WebSocket 同时将该地址用作 Host。Relay 改变连接目标地址，但 WebSocket 的 Host 和 SNI 仍使用节点地址。

Reality 和 VLESS WebSocket 支持选择 fingerprint，默认值为 `firefox`。

### WebSocket 和 Hysteria2 证书

证书和私钥的默认路径由节点地址决定：

| 节点地址 | 证书 | 私钥 |
| --- | --- | --- |
| 域名，例如 `second.denpiligrim.ru` | `/root/cert/second.denpiligrim.ru/fullchain.pem` | `/root/cert/second.denpiligrim.ru/privkey.pem` |
| IPv4 或 IPv6 | `/root/cert/ip/fullchain.pem` | `/root/cert/ip/privkey.pem` |

可在入站连接设置中修改路径。文件必须存在于节点上；应用将这些路径传递给 3x-ui。

## 后台任务与日志

入站连接生成、订阅和节点删除、relay 删除，以及转发安装或移除均在后台执行。界面显示任务状态，并防止重复启动任务。

批量轮换逐个处理订阅，并在订阅之间让其他排队任务执行。创建或删除入站连接时遇到临时错误，最多尝试三次，并在重试前延迟和检查操作结果。单个订阅失败不会中止整个批次。

**日志（Журнал）**显示进度、结果和重试记录，支持按流程和状态筛选，每页 20 条记录，并自动刷新。已完成的记录最多保留 30 天，上限为 50,000 条事件。

队列在应用重启后仍会保留。重启前正在执行的任务会标记为已中断，不会自动重试；再次启动前应先检查节点上的实际结果。

延迟设置、队列行为和 API 变更见[后台操作文档](docs/background-operations.md)（俄语）。

## 更新

使用安装脚本部署的实例可运行：

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/update.sh)
```

脚本会将数据库备份到 `/opt/3dp-manager/backups`，启用数据库迁移并更新容器。请保留 `.env` 和 `docker-compose.yml`，其中包含现有实例的配置。

自行部署时，应在更新后端的同时更新数据库结构。后台队列需要迁移 `1793300000000-add-operations`；详情见[数据库更新](docs/background-operations.md#обновление-бд)（俄语）。

## 卸载

以下命令会删除项目容器、数据库卷和 `/opt/3dp-manager` 目录，包括该目录内的备份：

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/delete.sh)
```

## 反馈

[Issues](https://github.com/denpiligrim/3dp-manager/issues) · [Telegram](https://t.me/denpiligrim_web) · [GPL-3.0 许可证](LICENSE)
