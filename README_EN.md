[Русский](https://github.com/denpiligrim/3dp-manager/blob/dp-fix/README.md)

# 3DP-MANAGER

> [!WARNING]
> **This is a beta version!**
>
> The program is currently under active development. Bugs, instability, and API changes are possible.
> Use with caution.

3DP-MANAGER is a utility that allows you to regularly generate inbound connections for the 3X-UI panel based on a whitelist of domains. The whitelist is shared, but you can also add your own list by naming it `my_whitelist.txt` and adding it to the `/opt/3dp-manager/app` folder on your server.
Discussions are available on the Telegram channel: [@denpiligrim_web](https://t.me/denpiligrim_web/719)

### Install
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/dp-fix/install.sh)
```

### Update
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/dp-fix/update.sh)
```

### Delete
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/dp-fix/delete.sh)
```

---

The subscription and inbound redirection service works in conjunction with **3DP-MANAGER** and allows you to redirect all inbound traffic from the intermediate server to the main server. The same ports are redirected, namely `443`, `8443`, and the range `10000-60000`. The service also creates a link to the subscription, automatically replacing the IP address or domain in the configurations. Redirects are configured by adding iptables rules to the ufw configuration file, which ensures stable operation in conjunction with the firewall. It is recommended to install the service on a clean server without any previously installed rules.
### Install forwarding
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/dp-fix/forwarding_install.sh)
```

### Delete forwarding
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/dp-fix/forwarding_delete.sh)
```

---

### Show sub URL
```bash
cd /opt/3dp-manager && docker compose exec node env | grep SUB_URL | cut -d'=' -f2
```

---

### Utility for collecting domains from multi-subscriptions
Allows you to collect domains from subscriptions with multiple configurations. There are many similar configuration lists circulating on the internet that use white SNI. The tool allows you to extract domains and prepare a ready-made list for further use in the inbound generator.
Insert a subscription link into the script and run the command in the `Node.js` environment.
```bash
node get_domains.js
```

### Use your whitelist
The file should have a structure similar to `whitelist.txt`. Rename the file to `my_whitelist.txt`. Upload the file to the `/opt/3dp-manager/app` folder on the server and run the command:
```bash
cd /opt/3dp-manager && docker cp ./app/my_whitelist.txt node:/app/my_whitelist.txt
```