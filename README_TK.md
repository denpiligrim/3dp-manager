[Русский](README.md) · [English](README_EN.md) · [中文](README_CN.md) · [فارسی](README_IR.md)

<p><img src="https://denpiligrim.ru/storage/images/3dp-manager.png" alt="3dp-manager preview"></p>

![Version](https://img.shields.io/badge/version-3.0.0-blue.svg) ![Downloads](https://img.shields.io/badge/downloads-7k-blue) [![License](https://img.shields.io/badge/license-GPL%20V3-blue.svg?longCache=true)](https://www.gnu.org/licenses/gpl-3.0) [![Telegram](https://img.shields.io/badge/Telegram-26A5E4?style=flat&logo=telegram&logoColor=white)](https://t.me/denpiligrim_web) [![YouTube](https://img.shields.io/badge/DenPiligrim-11k-red?style=flat&logo=youtube)](https://www.youtube.com/@denpiligrim)

# 3DP-MANAGER

[3x-ui](https://github.com/MHSanaei/3x-ui) API-si arkaly birikmeleri we abunalary dolandyrmak üçin web programma. Birnäçe noduň giriş birikmelerini üýtgemeýän URL-li bir abunada birleşdirýär we olary el bilen ýa-da tertipnama boýunça täzeleýär.

## Mümkinçilikler

- Token ýa-da ulanyjy ady we parol arkaly tassyklanylýan birnäçe 3x-ui noduny dolandyrmak.
- Her giriş birikmesi üçin nod, relay, port, baýdak we at aýratyn saýlanýar.
- 3x-ui paneliniň Clients bölümindäki bar bolan müşderini ulanmak ýa-da müşderini awtomatiki döretmek.
- Daşarky birikme salgylaryny we Happ hem-de INCY ugurlaşdyrma profillerini goşmak.
- Abuna belligi, goldaw we web sahypa salgylary, trafik statistikasy we möhletiň gutarmagy baradaky maglumatlar.
- SNI domenleriniň sanawyny import, eksport etmek we awtomatiki gözlemek. Nod ýa-da relay döredilende onuň domeni sanawa awtomatiki goşulýar; IP salgylary goşulmaýar.
- Ýüküň çäklendirilmegi, gaýtadan synanyşyklar we amallaryň žurnaly bilen fonda döretmek we pozmak.

## Talaplar

- Ubuntu ýa-da Debian serweri we gurnama skripti üçin root ygtyýary.
- Docker we Docker Compose; ýok bolsa, gurnaýjy olary gurnar.
- Giriş birikmeleri we Clients API-leri elýeterli bolan bir ýa-da birnäçe 3x-ui paneli. Protokollaryň we tokenleriň goldawy paneliň wersiýasyna bagly.
- Relay üçin aralyk serwere SSH arkaly giriş.
- TLS giriş birikmeleri üçin degişli noduň üstünde sertifikat we şahsy açar.

## Gurnama

Serwerde root hökmünde ýerine ýetiriň:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/install.sh)
```

Gurnaýjy PostgreSQL-i, backend-i we frontend-i `/opt/3dp-manager` katalogynda ýerleşdirýär. HTTP ýa-da Let's Encrypt, öz sertifikatyňyz ýa-da öz-özüne gol çekilen sertifikat bilen HTTPS saýlap bilersiňiz. Interfeýsiň salgysy, porty, ulanyjy ady we paroly gurnamanyň ahyrynda görkezilýär. Gireniňizden soň paroly **Sazlamalar (Настройки)** bölüminde üýtgediň.

## Sazlama

1. **Nodlar (Ноды)** bölüminde 3x-ui paneliniň URL-sini, giriş maglumatlaryny, IP salgysyny we baýdagyny goşuň. IP we ýurt awtomatiki kesgitlenýär, olary el bilen düzedip bolýar. Esasy nod deslapky nod hökmünde ulanylýar.
2. Zerur bolsa, **Relay serwerleri (Relay серверы)** bölüminde aralyk serweri goşuň, onuň noduny saýlaň we ugrukdyrmany interfeýs arkaly guruň. Relay hostuny domen ýa-da IP salgysy hökmünde görkezip bolýar.
3. **Domenler (Домены)** bölüminde Reality birikmeleri üçin SNI sanawyny sazlaň.
4. **Abunalar (Подписки)** bölüminde esasy maglumatlary dolduryň, giriş birikmelerini we zerur bolsa ugurlaşdyrma profillerini goşuň. Bir abunada jemi 20-e çenli element bolup biler.
5. Abunany ýatda saklaň we döretmegi başladyň. Onuň URL-sini müşderi programmasyna göçüriň. Abunanyň salgysy `/bus/<UUID>` görnüşinde bolup, rotasiýa wagtynda üýtgemeýär.

**Müşderiniň ID-si** meýdany 3x-ui panelindäki bar bolan müşderiniň ID-sini, email-ini ýa-da adyny kabul edýär. Şol müşderi saýlanan nodlaryň ählisinde elýeterli bolmaly. Meýdan boş bolsa, programma müşderini awtomatiki döredýär. Onuň identifikatory abunanyň adynyň aşagynda görkezilýär.

Tertipnama boýunça döretmek üçin degişli abunalarda awtomatiki rotasiýany açyň we azyndan 10 minutlyk umumy aralyk belläň. El bilen täzelemek bir abuna ýa-da awtomatiki rotasiýasy açyk ähli işjeň abunalar üçin elýeterlidir.

## Birikme görnüşleri

| Görnüş | Transport we howpsuzlyk |
| --- | --- |
| `vless-tcp-reality` | VLESS TCP + Reality |
| `vless-xhttp-reality` | VLESS XHTTP + Reality |
| `vless-xhttp-get` | VLESS XHTTP, `packet-up`, GET bilen maglumat ibermek, TLS ýok |
| `vless-grpc-reality` | VLESS gRPC + Reality |
| `vless-ws` | VLESS WebSocket + TLS, ýol `/ws` |
| `vmess-tcp` | VMess TCP |
| `shadowsocks-tcp` | Shadowsocks TCP |
| `trojan-tcp-reality` | Trojan TCP + Reality |
| `hysteria2-udp` | Hysteria2 UDP + TLS, Salamander |
| `custom` | Taýýar daşarky birikme salgysy |

Porty `1` bilen `65535` aralygyndaky san ýa-da `10000–59999` aralygyndan saýlamak üçin `random` hökmünde belläp bolýar. Port noduň üstünde, ugrukdyrma ulanylýan bolsa relay serwerinde hem elýeterli bolmaly.

Reality üçin SNI domenleriň sanawyndan belli bir domen ýa-da `random` hökmünde saýlanýar. WebSocket we Hysteria2 noduň domenini ýa-da IP salgysyny SNI hökmünde ulanýarlar. WebSocket şol salgyny Host hökmünde hem ulanýar. Relay birikmäniň barýan salgysyny üýtgedýär, emma WebSocket-iň Host we SNI bahalary noduň salgysy bolup galýar.

Reality we VLESS WebSocket üçin fingerprint saýlap bolýar. Deslapky baha `firefox`.

### WebSocket we Hysteria2 sertifikatlary

Sertifikatyň we açaryň deslapky ýollary noduň salgysyna görä kesgitlenýär:

| Noduň salgysy | Sertifikat | Şahsy açar |
| --- | --- | --- |
| Domen, mysal üçin `second.denpiligrim.ru` | `/root/cert/second.denpiligrim.ru/fullchain.pem` | `/root/cert/second.denpiligrim.ru/privkey.pem` |
| IPv4 ýa-da IPv6 | `/root/cert/ip/fullchain.pem` | `/root/cert/ip/privkey.pem` |

Ýollary giriş birikmesiniň sazlamalarynda üýtgedip bolýar. Faýllar noduň üstünde bar bolmaly; programma olaryň ýollaryny 3x-ui paneline geçirýär.

## Fon işleri we Žurnal

Giriş birikmelerini döretmek, abunalary we nodlary pozmak, relay-i pozmak, şeýle hem ugrukdyrmany gurmak ýa-da aýyrmak fonda ýerine ýetirilýär. Interfeýs işiň ýagdaýyny görkezýär we onuň gaýtalanyp başladylmagynyň öňüni alýar.

Toparlaýyn rotasiýa abunalary birin-birin işleýär we abunalaryň arasynda nobatdaky beýleki işlere mümkinçilik berýär. Giriş birikmesi döredilende ýa-da pozulanda ýüze çykan wagtlaýyn ýalňyşlyklarda, garaşmak we netijäni barlamak bilen jemi üç gezek synanyşylýar. Bir abunadaky ýalňyşlyk tutuş topary duruzmaýar.

**Žurnal (Журнал)** bölüminde işiň gidişi, netijeler we gaýtadan synanyşyklar görkezilýär. Amal we ýagdaý boýunça süzgüçler bar; her sahypada 20 ýazgy görkezilýär. Žurnal awtomatiki täzelenýär. Tamamlanan ýazgylar 30 güne çenli, iň köp 50 000 waka hökmünde saklanýar.

Programma täzeden işledilende nobat saklanýar. Eýýäm ýerine ýetirilýän iş kesilen hökmünde bellenýär we awtomatiki gaýtalanmaýar: täzeden başlamazdan öň onuň netijesini noduň üstünde barlaň.

Garaşma sazlamalary, nobatyň işleýşi we API üýtgeşmeleri [fon amallarynyň resminamasynda](docs/background-operations.md) rus dilinde düşündirilýär.

## Täzeleme

Skript arkaly gurnalan nusga üçin:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/update.sh)
```

Skript maglumat bazasynyň ätiýaçlyk nusgasyny `/opt/3dp-manager/backups` katalogynda döredýär, migrasiýalaryň ýerine ýetirilmegini açýar we konteýnerleri täzeleýär. `.env` we `docker-compose.yml` faýllaryny saklaň: olar bar bolan gurnamanyň sazlamalaryny öz içine alýar.

Özbaşdak ýerleşdirilende maglumat bazasynyň gurluşyny backend bilen bilelikde täzeläň. Fon nobaty üçin `1793300000000-add-operations` migrasiýasy gerek; jikme-jiklikler rus dilindäki [maglumat bazasyny täzelemek bölüminde](docs/background-operations.md#обновление-бд) bar.

## Aýyrmak

Bu buýruk taslamanyň konteýnerlerini, maglumat bazasynyň volume-yny we `/opt/3dp-manager` katalogyny, şol sanda onuň içindäki ätiýaçlyk nusgalaryny pozýar:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/delete.sh)
```

## Habarlaşmak

[Issues](https://github.com/denpiligrim/3dp-manager/issues) · [Telegram](https://t.me/denpiligrim_web) · [GPL-3.0 ygtyýarnamasy](LICENSE)
