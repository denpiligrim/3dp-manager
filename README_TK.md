[Русский](/README.md) | [English](/README_EN.md) | [中文](/README_CN.md) | [فارسی](/README_IR.md)

<p><img src="https://denpiligrim.ru/storage/images/3dp-manager.png" alt="3dp-manager preview"></p>

![Version](https://img.shields.io/badge/version-1.0.1-blue.svg) [![License](https://img.shields.io/badge/license-GPL%20V3-blue.svg?longCache=true)](https://www.gnu.org/licenses/gpl-3.0) [![Telegram](https://img.shields.io/badge/Telegram-26A5E4?style=flat&logo=telegram&logoColor=white)](https://t.me/denpiligrim_web) [![YouTube Channel Subscribers](https://img.shields.io/youtube/channel/subscribers/UCOv2tFFYDY4mXOM60PVz8zw)](https://www.youtube.com/@denpiligrim)

# 3DP-MANAGER

Bu gural `3x-ui` paneli üçin awtomatiki ýagdaýda inbound baglanyşlaryny döredýär, birleşdirilen abunany (subscription) döretmäge we aragatnaşyk serwerinden esasy servere trafigiň ugradylyşyny sazlamaga kömek edýär.

**Taslamany goldaň**

- Töleg / goşant maglumatlary:
  - MIR kart: `2204320436318077`
  - MasterCard: `5395452209474530`
  - PayPal: `vasiljevdenisx@gmail.com`
  - USDT | ETH (ERC20 | BEP20): `0x6fe140040f6Cdc1E1Ff2136cd1d60C0165809463`
  - USDT | TRX (TRC20): `TEWxXmJxvkAmhshp7E61XJGHB3VyM9hNAb`
  - Bitcoin: `bc1qctntwncsv2yn02x2vgnkrqm00c4h04c0afkgpl`
  - TON: `UQCZ3MiwyYHXftPItMMzJRYRiKHugr16jFMq2nfOQOOoemLy`
  - Bybit ID: `165292278`

## Düşündiriş

Esasy maksady trafigiňizi birmeňzeş bolmaz ýaly etmekdir. Bot bellenen aralykda dürli parametrler bilen 10 sany baglanyşygy döredýär:

- Protokollar: `vless`, `vmess`, `shadowsocks`, `trojan`;
- Portlar: `443`, `8443` (hemişelik) we `10000-60000` aralygyndan tötänleýin portlar;
- Transport: `tcp`, `websocket`, `grpc`, `xhttp`;
- SNI `whitelist` domen sanawyndan alynýar; öz sanawyňyzy hem ulanyp bilersiňiz.

Ähli döredilen baglanyşyklary biri-birine birleşdirip, statik URL bilen bir abuna döredilýär. Bot `3x-ui` paneliniň açyk API-sini ulanýar we paneliň içki konfigurasiýasyna gönüden-göni aralaşmaýar.

Ikinji maksady baglanyşygyň durnuklylygyny ýokarlandyrmakdyr: müşderi 10 dürli baglanyşyk opsiýasyny alýar we islese haýsyny islese saýlap bilýär.

Göçürme (forwarding) hyzmaty bilen birleşdirilende, bot abonnament we trafik diňe esasy servere ugradylyşyny awtomatiki sazlar.

Maslahatchylyklar:

- Abuna üçin HTTPS ulanyň (domain + SSL şahadatnamasy).
- Dörediş aralygyny ≥ 10 minut goýuň; durnuklylyk üçin her gün bir gezek (1440 minut) maslahat berilýär.
- Müşderide awtomatiki täzelenmäni ýygylaşdyryň (meselem, her sagat) — serwera sazlaşyklylyk üçin.

## Imkançylyklar

- 10 dürli baglanyşygy öndürýär
- Statik URL bilen bir abuna döredýär
- Öz `whitelist` domenleriňizi goldaýar
- Trafigiň awtomatik forwarding sazlamalary (islege bagly)

## Talaplar

- Ubuntu 20.04 ýa-da täze
- `3x-ui` paneli
- Domain + SSL şahadatnamasy (islege bagly)

---

## Gurnama

Taslamany serwera gurnamak üçin şu komandany ýerine ýetiriň:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/dp-fix/install.sh)
```

<small>Gysgaça: gurnama skripti işledilýär we konteýnerler we hyzmatlar döredilýär.</small>

## Täzelik

Soňky wersiýa çenli täzeläň:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/dp-fix/update.sh)
```

<small>Gysgaça: iň soňky üýtgeşmeleri çekýär we konteýnerleri gaýtadan işledýär.</small>

## Pozmak

Hyzmaty doly pozmak üçin:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/dp-fix/delete.sh)
```

<small>Gysgaça: konteýnerleri we konfigurasiýa faýllaryny pozup, systemany gurnamadan öňki ýagdaýyna getirer.</small>

---

## Forwarding hyzmatyny gurnamak

Forwarding hyzmaty aragatnaşyk serwerinden esasy servere gelýän portlary proxy arkaly geçirýär.

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/dp-fix/forwarding_install.sh)
```

## Forwarding-i pozmak

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/dp-fix/forwarding_delete.sh)
```

---

## Abuna URL-ni görkezmek

Konteýner gurşawynda häzirki abuna URL-ni görkezýän komanda:

```bash
cd /opt/3dp-manager && docker compose exec node env | grep SUB_URL | cut -d'=' -f2
```

## Multi-abunalardan domenleri toplamak

Gural birden köp konfigurasiýa içeren abunalardan domenleri çykaryp `whitelist` düzýär.

```bash
node get_domains.js
```

## Öz `whitelist`-iňizi ulanmak

1. `whitelist.txt` bilen meňzeş struktura eýe faýl taýýarlaň.
2. Ony `my_whitelist.txt` diýip atlandyryp `/opt/3dp-manager/app` içine göçüriň.

```bash
cd /opt/3dp-manager && docker cp ./app/my_whitelist.txt node:/app/my_whitelist.txt
```

---

## Bellikler we çäklendirmeler

- Umumy domen sanawy ähli üpjün edijilerde işlemeýär; öz `whitelist`-iňizi düzmegiňizi maslahat berýäris.

---

## Goşanty

Proýekte goşant bermäge hoş geldiňiz! Goşant prosesi ýönekeý:

1. GitHub-da repo-ny fork ediň.
2. Meni manly at bilen şahamça (branch) dörediň, meselem `feature/add-README` ýa-da `fix/whitelist-load`.
3. Üýtgeşmeleri giriziň we gysga commit ýazmagy unutmaň.
4. Lokal barlaglary işlediň (bardy bolsa).
5. Şahamçany fork-a iteriň we Pull Request dörediň.

---

## Çeperdeşlik

- Telegram: [@denpiligrim_web](https://t.me/denpiligrim_web)
- Issues