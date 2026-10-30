[Русский](/README.md) | [English](/README_EN.md) | [中文](/README_CN.md) | [Türkmençe](/README_TK.md)

<p><img src="https://denpiligrim.ru/storage/images/3dp-manager.png" alt="3dp-manager preview"></p>

![Version](https://img.shields.io/badge/version-3.0.0-blue.svg) ![Downloads](https://img.shields.io/badge/downloads-5.1k-blue) [![License](https://img.shields.io/badge/license-GPL%20V3-blue.svg?longCache=true)](https://www.gnu.org/licenses/gpl-3.0) [![Telegram](https://img.shields.io/badge/Telegram-26A5E4?style=flat&logo=telegram&logoColor=white)](https://t.me/denpiligrim_web) [![YouTube Channel Subscribers](https://img.shields.io/youtube/channel/subscribers/UCOv2tFFYDY4mXOM60PVz8zw)](https://www.youtube.com/@denpiligrim)

# 3DP-MANAGER

ابزاری برای تولید خودکار inbound برای پنل [3x-ui](https://github.com/MHSanaei/3x-ui)، ساخت اشتراک‌های یکپارچه، مدیریت چندین نود 3x-ui و پیکربندی relay forwarding از سرورهای واسط به سرورهای اصلی. از نسخه 2.0.0 به بعد، پروژه دارای رابط گرافیکی و تنظیمات ساده کاربری است.

**حمایت از پروژه**

- انتقال بانکی:
  - :credit_card: کارت MIR: `2204320436318077`
  - :credit_card: کارت MasterCard: `5395452209474530`
- کیف پول الکترونیکی:
  - :moneybag: YooMoney: `4100116897060652`
  - :moneybag: PayPal: `vasiljevdenisx@gmail.com`
- رمزارز:
  - :coin: USDT | ETH (ERC20 | BEP20): `0x6fe140040f6Cdc1E1Ff2136cd1d60C0165809463`
  - :coin: USDT | TRX (TRC20): `TEWxXmJxvkAmhshp7E61XJGHB3VyM9hNAb`
  - :coin: Bitcoin: `bc1qctntwncsv2yn02x2vgnkrqm00c4h04c0afkgpl`
  - :coin: TON: `UQCZ3MiwyYHXftPItMMzJRYRiKHugr16jFMq2nfOQOOoemLy`
  - :coin: Bybit ID: `165292278`

## توضیحات

هدف اصلی ابزار این است که ترافیک شما یکسان به نظر نرسد. 3DP-MANAGER در بازه زمانی تعیین‌شده، مجموعه‌ای از اتصال‌ها با پارامترهای متفاوت تولید می‌کند:

- پروتکل‌ها: `vless`, `vmess`, `shadowsocks`, `hysteria2`, `trojan`;
- پورت‌ها: `443` و `8443` به‌صورت ثابت، و پورت‌های تصادفی از بازه `10000-60000`;
- transport: `tcp`, `websocket`, `grpc`, `xhttp`;
- SNI از whitelist دامنه‌ها انتخاب می‌شود یا به‌صورت دستی تنظیم می‌گردد؛
- نود، relay server، پورت و پرچم را می‌توان برای هر inbound جداگانه تنظیم کرد.

همه اتصال‌ها در یک اشتراک با URL ثابت ترکیب می‌شوند. 3DP-MANAGER با پنل `3x-ui` از طریق API عمومی آن کار می‌کند و مستقیماً در بخش داخلی پنل دخالت نمی‌کند.

هدف دوم پایداری اتصال است: کلاینت چند گزینه اتصال دریافت می‌کند و می‌تواند هرکدام را انتخاب کند. در یک اشتراک می‌توان inboundهای مربوط به نودهای مختلف، relay serverها و لینک‌های خارجی آماده را به‌عنوان اتصال custom قرار داد.

همچنین 3DP-MANAGER را می‌توان در سناریوی زنجیره‌ای استفاده کرد. سرویس forwarding، هدایت اشتراک و ترافیک را به نود انتخاب‌شده پیکربندی می‌کند.

توصیه‌ها:

- برای اشتراک از HTTPS استفاده کنید (دامنه + گواهی SSL).
- فاصله تولید را حداقل 10 دقیقه تنظیم کنید؛ برای پایداری، یک‌بار در روز (1440 دقیقه) توصیه می‌شود.
- در کلاینت، به‌روزرسانی خودکار را دفعات بیشتری تنظیم کنید، مثلاً هر ساعت، تا با سرور همگام بماند.

## قابلیت‌ها

- تولید اتصال‌های متنوع برای یک یا چند اشتراک
- ساخت اشتراک یکپارچه با URL ثابت
- مدیریت چندین نود `3x-ui`
- پشتیبانی از احراز هویت نود با login/password یا token
- تشخیص خودکار IP، کشور و پرچم نود از URL پنل
- انتخاب نود، relay server، پرچم، SNI و پورت برای هر inbound
- پشتیبانی از پورت ثابت یا مقدار `random`
- پشتیبانی از اتصال‌های custom: افزودن لینک خارجی آماده به اشتراک
- امکان تعیین مسیرهای جداگانه `fullchain.pem` و `privkey.pem` برای Hysteria2 UDP
- پشتیبانی از `whitelist` دامنه سفارشی
- تنظیم خودکار relay forwarding به‌صورت اختیاری
- نصب Web UI از طریق HTTP یا HTTPS: Let's Encrypt، self-signed یا گواهی‌های خودتان

## نیازمندی‌ها

- Ubuntu 20.04 یا جدیدتر، Debian 12.11 یا جدیدتر
- پنل `3x-ui` نسخه v2.8.4 یا جدیدتر
- دسترسی root روی سرور
- Docker و Docker Compose؛ اگر نصب نباشند، اسکریپت نصب تلاش می‌کند آن‌ها را خودکار نصب کند
- دامنه + گواهی SSL (اختیاری)

---

## نصب

پنل مدیریتی `3x-ui` باید از قبل نصب شده باشد. می‌توانید آن را با این دستور نصب کنید: `bash <(curl -Ls https://raw.githubusercontent.com/mhsanaei/3x-ui/master/install.sh)`

پروژه را روی سرور نصب کنید:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/install.sh)
```

در زمان نصب، اسکریپت:

- سیستم‌عامل، دسترسی root، Docker و Docker Compose را بررسی می‌کند؛
- اگر RAM کم باشد و swap وجود نداشته باشد، یک فایل swap با حجم 2 GB می‌سازد؛
- حالت دسترسی Web UI را می‌پرسد:
  - HTTPS با Let's Encrypt؛
  - HTTPS با گواهی self-signed؛
  - HTTPS با گواهی‌های خودتان؛
  - HTTP بدون رمزنگاری؛
- یک پورت تصادفی برای Web UI ایجاد می‌کند؛
- login و password مدیر را ایجاد می‌کند؛
- کانتینرهای `postgres`, `backend` و `frontend` را اجرا می‌کند.

پس از پایان نصب، URL، login و password در ترمینال نمایش داده می‌شود. بلافاصله password را در تنظیمات 3DP-MANAGER تغییر دهید.

<sup>توضیح کوتاه: اسکریپت نصب تعاملی را اجرا می‌کند، محیط را آماده می‌سازد و کانتینرهای پروژه را راه‌اندازی می‌کند.</sup>

## به‌روزرسانی

به‌روزرسانی به آخرین نسخه:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/update.sh)
```

<sup>توضیح کوتاه: آخرین تغییرات را دریافت می‌کند، اصلاحات سازگار پیکربندی را اعمال می‌کند، کانتینرها را به‌روزرسانی کرده و سرویس را راه‌اندازی مجدد می‌کند.</sup>

## حذف

حذف کامل سرویس:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/delete.sh)
```

<sup>توضیح کوتاه: کانتینرها و فایل‌های پیکربندی را حذف می‌کند و سیستم را به وضعیت پیش از نصب بازمی‌گرداند.</sup>

---

## اولین ورود

login و password مدیر در پایان نصب نمایش داده می‌شود. برای مشاهده دوباره:

```bash
grep -E "ADMIN_LOGIN|ADMIN_PASSWORD" /opt/3dp-manager/docker-compose.yml | sed 's/^[ \t]*//; s/^- //'
```

Web UI در آدرسی که نصب‌کننده نمایش داده قابل دسترسی است، برای مثال:

- `https://example.com:PORT` برای HTTPS؛
- `http://SERVER_IP:PORT` برای HTTP.

اگر `ufw` فعال باشد، نصب‌کننده بازه‌های پورت کاری inbound را برای TCP/UDP باز می‌کند: `443`, `8443` و `10000-60000`.

---

## نودها

بخش **نودها** امکان اتصال یک یا چند پنل `3x-ui` را فراهم می‌کند.

برای هر نود مشخص می‌شود:

- نام؛
- URL پنل `3x-ui`؛
- IP نود؛
- پرچم/کشور؛
- نوع احراز هویت: `password` یا `token`؛
- اینکه نود اصلی است یا خیر.

پس از وارد کردن URL، برنامه تلاش می‌کند IP و کشور نود را خودکار تشخیص دهد. پرچم در نام اتصال‌ها داخل اشتراک استفاده می‌شود تا تشخیص سرورها در کلاینت ساده‌تر باشد.

> [!NOTE]
> نود اصلی به‌عنوان مقدار پیش‌فرض برای اشتراک‌ها، inboundها و relay serverها استفاده می‌شود.

---

## اشتراک‌ها

بخش **اشتراک‌ها** URLهای ثابت اشتراک و ترکیب inboundها را مدیریت می‌کند.

برای هر inbound می‌توانید تنظیم کنید:

- نوع اتصال؛
- نود؛
- relay server؛
- پرچم؛
- پورت: عدد مشخص از `1-65535` یا `random`؛
- SNI: دامنه مشخص یا `random`؛
- لینک خارجی آماده برای نوع `custom`.

برای `hysteria2-udp` می‌توانید مسیرهای جداگانه گواهی و کلید را مشخص کنید:

- `certificateFile`، برای مثال `/root/cert/example.com/fullchain.pem`;
- `keyFile`، برای مثال `/root/cert/example.com/privkey.pem`.

اگر پورت یا SNI برابر `random` باشد، مقدار هنگام روتیشن از بازه موجود یا whitelist دامنه‌ها انتخاب می‌شود.

---

## نصب سرویس forwarding

> [!WARNING]
> سرویس forwarding روی سرور واسط اجرا می‌شود

سرویس forwarding پورت‌های ورودی سرور واسط را به نود انتخاب‌شده proxy می‌کند. در Web UI این سرورها در بخش **Relay serverها** تنظیم می‌شوند و می‌توانند به یک نود مشخص متصل شوند.

Relay server را می‌توان با IP یا دامنه اضافه کرد. اگر دامنه وارد شود، backend تلاش می‌کند IP آن را خودکار resolve کند.

برای نصب دستی forwarding روی سرور واسط، `IP_ADDRESS` را با IP نود اصلی جایگزین کنید:

```bash
sudo ORIGIN_IP="IP_ADDRESS" bash -c "$(curl -sSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/forwarding_install.sh)"
```

<sup>توضیح کوتاه: قوانین forwarding را اضافه می‌کند.</sup>

## حذف forwarding

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/forwarding_delete.sh)
```

<sup>توضیح کوتاه: قوانین forwarding را حذف می‌کند. پس از حذف، برای اعمال تغییرات firewall را با `ufw reload` بارگذاری مجدد کنید و سیستم را با `reboot` ری‌استارت کنید.</sup>

---

## جمع‌آوری دامنه‌ها از چند اشتراک

این ابزار دامنه‌ها را از اشتراک‌ها استخراج می‌کند و برای generator یک `whitelist` می‌سازد.

```bash
node get_domains.js
```

<sup>توضیح کوتاه: لینک چند اشتراک را در اسکریپت اضافه کنید و دستور را اجرا کنید. خروجی، فهرست دامنه‌ها خواهد بود. برای اجرای اسکریپت به `Node.js` نیاز است.</sup>

---

## نکات و محدودیت‌های فعلی

- فهرست عمومی دامنه‌ها با همه ارائه‌دهندگان کار نمی‌کند، بنابراین توصیه می‌شود whitelist خودتان را بسازید و استفاده کنید.

---

## مشارکت

از هرگونه مشارکت در توسعه پروژه استقبال می‌شود! روند ساده برای مشارکت‌کنندگان:

1. مخزن را در GitHub fork کنید.
2. شاخه‌ای با نام معنادار بسازید، مثل `feature/add-README` یا `fix/whitelist-load`.
3. تغییرات را اعمال کنید و توضیح کوتاهی در commit بنویسید.
4. در صورت وجود، بررسی‌های محلی را اجرا کنید.
5. شاخه را به fork خود push کنید و در مخزن اصلی Pull Request بسازید.

<sup>نکته: تغییرات، هدف و مراحل تست را در PR توضیح دهید. اگر تغییرات بزرگ هستند، آن‌ها را به commitهای کوچک تقسیم کنید.</sup>

---

## گفتگو

- تلگرام: [@denpiligrim_web](https://t.me/denpiligrim_web)
- بخش Issues در همین مخزن
