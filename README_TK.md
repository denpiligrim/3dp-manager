[Русский](/README.md) | [English](/README_EN.md) | [中文](/README_CN.md) | [فارسی](/README_IR.md)

<p><img src="https://denpiligrim.ru/storage/images/3dp-manager.png" alt="3dp-manager preview"></p>

![Version](https://img.shields.io/badge/version-3.0.0-blue.svg) ![Downloads](https://img.shields.io/badge/downloads-5.1k-blue) [![License](https://img.shields.io/badge/license-GPL%20V3-blue.svg?longCache=true)](https://www.gnu.org/licenses/gpl-3.0) [![Telegram](https://img.shields.io/badge/Telegram-26A5E4?style=flat&logo=telegram&logoColor=white)](https://t.me/denpiligrim_web) [![YouTube Channel Subscribers](https://img.shields.io/youtube/channel/subscribers/UCOv2tFFYDY4mXOM60PVz8zw)](https://www.youtube.com/@denpiligrim)

# 3DP-MANAGER

[3x-ui](https://github.com/MHSanaei/3x-ui) paneli üçin inbound-lary awtomatiki döretmäge, birleşdirilen abunalary düzmäge, birnäçe 3x-ui node-ny dolandyrmaga we aralyk serwerlerden esasy serwerlere relay forwarding sazlamaga niýetlenen gural. 2.0.0 wersiýadan bäri taslamada grafiki interfeýs we ýönekeý ulanyjy sazlamalary bar.

**Taslamany goldaň**

- Bank geçirimi:
  - :credit_card: MIR kart: `2204320436318077`
  - :credit_card: MasterCard: `5395452209474530`
- Elektron gapjyk:
  - :moneybag: YooMoney: `4100116897060652`
  - :moneybag: PayPal: `vasiljevdenisx@gmail.com`
- Kriptowalýuta:
  - :coin: USDT | ETH (ERC20 | BEP20): `0x6fe140040f6Cdc1E1Ff2136cd1d60C0165809463`
  - :coin: USDT | TRX (TRC20): `TEWxXmJxvkAmhshp7E61XJGHB3VyM9hNAb`
  - :coin: Bitcoin: `bc1qctntwncsv2yn02x2vgnkrqm00c4h04c0afkgpl`
  - :coin: TON: `UQCZ3MiwyYHXftPItMMzJRYRiKHugr16jFMq2nfOQOOoemLy`
  - :coin: Bybit ID: `165292278`

## Düşündiriş

Guralyň esasy maksady trafigiňiziň birmeňzeş görünmezligini gazanmakdyr. 3DP-MANAGER bellenen aralykda dürli parametrli baglanyşyklar toplumyny döredýär:

- protokollar: `vless`, `vmess`, `shadowsocks`, `hysteria2`, `trojan`;
- portlar: hemişelik `443`, `8443` we `10000-60000` aralygyndaky tötänleýin portlar;
- transport: `tcp`, `websocket`, `grpc`, `xhttp`;
- SNI domen whitelist-den alynýar ýa-da el bilen berilýär;
- her inbound üçin node, relay serwer, port we baýdak aýratyn sazlanýar.

Ähli baglanyşyklar statik URL-li bir abuna birleşdirilýär. 3DP-MANAGER `3x-ui` paneli bilen onuň açyk API-si arkaly işleýär we paneliň içki işine göni gatyşmaýar.

Ikinji maksat baglanyşygyň durnuklylygydyr: müşderi birnäçe baglanyşyk wariantyny alýar we islänini saýlap bilýär. Bir abuna dürli node-lardan inbound-lary, relay serwerleri we custom baglanyşyk hökmünde taýýar daşarky linkleri goşup bolýar.

Mundan başga-da, 3DP-MANAGER kaskadly shemada ulanylyp bilner. Forwarding hyzmaty abunany we trafigi saýlanan node-a ugrukdyrmagy sazlaýar.

Maslahatlar:

- Abuna üçin HTTPS ulanyň (domen + SSL şahadatnamasy).
- Döretmek aralygyny azyndan 10 minut goýuň; durnuklylyk üçin günde bir gezek (1440 minut) maslahat berilýär.
- Müşderide awtomatiki täzelenmäni ýygy goýuň, meselem her sagat, serwer bilen sazlaşyk saklansyn.

## Mümkinçilikler

- Bir ýa-da birnäçe abuna üçin dürli baglanyşyklar döredýär
- Statik URL bilen birleşdirilen abuna döredýär
- Birnäçe `3x-ui` node-ny dolandyrýar
- Node autentifikasiýasyny login/password ýa-da token arkaly goldaýar
- Panel URL-den node IP-sini, ýurduny we baýdagyny awtomatiki kesgitleýär
- Her inbound üçin node, relay serwer, baýdak, SNI we port saýlamaga mümkinçilik berýär
- Hemişelik porty ýa-da `random` bahasyny goldaýar
- Custom baglanyşyklary goldaýar: taýýar daşarky linki abuna goşup bolýar
- Hysteria2 UDP üçin `fullchain.pem` we `privkey.pem` ýollaryny aýratyn görkezmäge mümkinçilik berýär
- Öz domen `whitelist` sanawyňyzy goldaýar
- Relay forwarding-i awtomatiki sazlamak mümkinçiligi bar
- Web UI HTTP ýa-da HTTPS arkaly gurnalýar: Let's Encrypt, self-signed ýa-da öz şahadatnamalaryňyz

## Talaplar

- Ubuntu 20.04 ýa-da täze, Debian 12.11 ýa-da täze
- `3x-ui` paneli v2.8.4 ýa-da täze
- Serwerde root elýeterliligi
- Docker we Docker Compose; ýok bolsa, gurnama skripti olary awtomatiki gurnamaga synanyşar
- Domen + SSL şahadatnamasy (islege bagly)

---

## Gurnama

`3x-ui` dolandyryş paneli öňünden gurnalan bolmaly. Ony şu komanda bilen gurnap bilersiňiz: `bash <(curl -Ls https://raw.githubusercontent.com/mhsanaei/3x-ui/master/install.sh)`

Taslamany serwere gurnaň:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/install.sh)
```

Gurnama wagtynda skript:

- OS, root elýeterliligi, Docker we Docker Compose-y barlaýar;
- RAM az we swap ýok bolsa, 2 GB swap faýl döredýär;
- Web UI elýeterlilik görnüşini saýladýar:
  - Let's Encrypt arkaly HTTPS;
  - self-signed şahadatnama bilen HTTPS;
  - öz şahadatnamalaryňyz bilen HTTPS;
  - şifrlemesiz HTTP;
- Web UI üçin tötänleýin port döredýär;
- administrator login we password döredýär;
- `postgres`, `backend` we `frontend` konteýnerlerini işe goýberýär.

Gurnama tamamlanandan soň terminalda URL, login we password görkeziler. Password-y derrew 3DP-MANAGER sazlamalarynda üýtgediň.

<sup>Gysgaça: interaktiw gurnama skriptini işledýär, gurşawy taýýarlaýar we taslamanyň konteýnerlerini ýerleşdirýär.</sup>

## Täzelemek

Soňky wersiýa çenli täzelemek:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/update.sh)
```

<sup>Gysgaça: soňky üýtgeşmeleri alýar, laýyk konfigurasiýa düzedişlerini ulanýar, konteýnerleri täzeleýär we hyzmaty gaýtadan işledýär.</sup>

## Pozmak

Hyzmaty doly pozmak:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/delete.sh)
```

<sup>Gysgaça: konteýnerleri we konfigurasiýa faýllaryny pozýar, ulgamy gurnamadan öňki ýagdaýa getirýär.</sup>

---

## Ilkinji Giriş

Administrator login we password gurnamanyň ahyrynda görkezilýär. Olary gaýtadan görmek üçin:

```bash
grep -E "ADMIN_LOGIN|ADMIN_PASSWORD" /opt/3dp-manager/docker-compose.yml | sed 's/^[ \t]*//; s/^- //'
```

Web UI gurnawçynyň görkezen salgysy boýunça elýeterlidir, mysal üçin:

- HTTPS üçin `https://example.com:PORT`;
- HTTP üçin `http://SERVER_IP:PORT`.

Eger `ufw` işjeň bolsa, gurnawçy inbound üçin iş portlaryny açýar: TCP/UDP üçin `443`, `8443` we `10000-60000`.

---

## Node-lar

**Node-lar** bölümi bir ýa-da birnäçe `3x-ui` panelini birikdirmäge mümkinçilik berýär.

Her node üçin görkezilýär:

- ady;
- `3x-ui` panel URL-i;
- node IP-si;
- baýdak/ýurt;
- autentifikasiýa görnüşi: `password` ýa-da `token`;
- esasy node bolup durýandygy.

URL girizilenden soň programma node IP-sini we ýurduny awtomatiki kesgitlemäge synanyşýar. Baýdak abunanyň içindäki baglanyşyk atlarynda ulanylýar, müşderide serwerleri tapawutlandyrmak aňsat bolýar.

> [!NOTE]
> Esasy node abunalar, inbound-lar we relay serwerler üçin deslapky baha hökmünde ulanylýar.

---

## Abunalar

**Abunalar** bölümi statik abuna URL-lerini we inbound düzümini dolandyrýar.

Her inbound üçin sazlap bolýar:

- baglanyşyk görnüşi;
- node;
- relay serwer;
- baýdak;
- port: `1-65535` aralygyndaky anyk san ýa-da `random`;
- SNI: anyk domen ýa-da `random`;
- `custom` görnüşi üçin taýýar daşarky link.

`hysteria2-udp` üçin şahadatnama we açar ýollaryny aýratyn görkezmek bolýar:

- `certificateFile`, mysal üçin `/root/cert/example.com/fullchain.pem`;
- `keyFile`, mysal üçin `/root/cert/example.com/privkey.pem`.

Port ýa-da SNI `random` bolsa, baha rotasiýa wagtynda elýeterli aralykdan ýa-da domen whitelist-den saýlanar.

---

## Forwarding Hyzmatyny Gurnamak

> [!WARNING]
> Forwarding hyzmaty aralyk serwerde işleýär

Forwarding hyzmaty aralyk serweriň gelýän portlaryny saýlanan node-a proxy edýär. Web UI-de şeýle serwerler **Relay serwerler** bölüminde sazlanýar we belli bir node bilen baglanyşdyrylyp bilýär.

Relay serwer IP ýa-da domen boýunça goşulyp bilner. Domen görkezilse, backend onuň IP-sini awtomatiki çözmäge synanyşar.

Aralyk serwerde forwarding-i el bilen gurnamak üçin `IP_ADDRESS` ýerine esasy node IP-sini goýuň:

```bash
sudo ORIGIN_IP="IP_ADDRESS" bash -c "$(curl -sSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/forwarding_install.sh)"
```

<sup>Gysgaça: forwarding düzgünlerini goşýar.</sup>

## Forwarding-i Pozmak

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/forwarding_delete.sh)
```

<sup>Gysgaça: forwarding düzgünlerini pozýar. Pozlandan soň üýtgeşmeler güýje girmegi üçin firewall-y `ufw reload` bilen täzeden ýükläň we ulgamy `reboot` bilen täzeden işlediň.</sup>

---

## Multi-Abunalardan Domenleri Toplamak

Gural abunalardan domenleri çykaryp, generator üçin `whitelist` düzýär.

```bash
node get_domains.js
```

<sup>Gysgaça: skripte multi-abuna linkini goşuň we komandany işlediň. Netijede domenleriň sanawy çykýar. Skript üçin `Node.js` gerek.</sup>

---

## Bellikler We Häzirki Çäklendirmeler

- Umumy domen sanawy ähli prowaýderlerde işlemeýär, şonuň üçin öz whitelist sanawyňyzy taýýarlamak we ulanmak maslahat berilýär.

---

## Goşant

Taslama goşantlaryňyza hoşal bolarys! Goşantçylar üçin ýönekeý proses:

1. GitHub-da repozitoriýany fork ediň.
2. Manyly at bilen branch dörediň, mysal üçin `feature/add-README` ýa-da `fix/whitelist-load`.
3. Üýtgeşmeleri giriziň we commit-de gysga düşündiriş ýazyň.
4. Bar bolsa, lokal barlaglary işlediň.
5. Branch-i öz fork-uňyza push ediň we esasy repozitoriýa Pull Request dörediň.

<sup>Maslahat: PR-de üýtgeşmeleri, maksady we test ädimlerini ýazyň. Üýtgeşmeler uly bolsa, olary kiçi commit-lere bölüň.</sup>

---

## Ara Alyp Maslahatlaşmak

- Telegram: [@denpiligrim_web](https://t.me/denpiligrim_web)
- Şu repozitoriýanyň Issues bölümi
