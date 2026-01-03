[Русский](/README.md) | [English](/README_EN.md) | [中文](/README_CN.md) | [Türkmençe](/README_TK.md)

<p><img src="https://denpiligrim.ru/storage/images/3dp-manager.png" alt="3dp-manager preview"></p>

![Version](https://img.shields.io/badge/version-1.0.1-blue.svg) [![License](https://img.shields.io/badge/license-GPL%20V3-blue.svg?longCache=true)](https://www.gnu.org/licenses/gpl-3.0) [![Telegram](https://img.shields.io/badge/Telegram-26A5E4?style=flat&logo=telegram&logoColor=white)](https://t.me/denpiligrim_web) [![YouTube Channel Subscribers](https://img.shields.io/youtube/channel/subscribers/UCOv2tFFYDY4mXOM60PVz8zw)](https://www.youtube.com/@denpiligrim)

# 3DP-MANAGER

ابزاری برای تولید خودکار اتصال‌های inbound برای پنل `3x-ui`، ساخت یک اشتراک یکپارچه و هدایت ترافیک از سرور واسط به سرور اصلی.

**حمایت از پروژه**

- اطلاعات پرداخت/اهدا:
  - کارت MIR: `2204320436318077`
  - کارت MasterCard: `5395452209474530`
  - PayPal: `vasiljevdenisx@gmail.com`
  - USDT | ETH (ERC20 | BEP20): `0x6fe140040f6Cdc1E1Ff2136cd1d60C0165809463`
  - USDT | TRX (TRC20): `TEWxXmJxvkAmhshp7E61XJGHB3VyM9hNAb`
  - بیت‌کوین: `bc1qctntwncsv2yn02x2vgnkrqm00c4h04c0afkgpl`
  - TON: `UQCZ3MiwyYHXftPItMMzJRYRiKHugr16jFMq2nfOQOOoemLy`
  - Bybit ID: `165292278`

## توضیحات

هدف اصلی این ابزار این است که ترافیک شما یکسان به نظر نرسد. ربات در فواصل زمانی مشخص 10 اتصال با پارامترهای مختلف تولید می‌کند:

- پروتکل‌ها: `vless`, `vmess`, `shadowsocks`, `trojan`
- پورت‌ها: `443`, `8443` (ثابت) و پورت‌های تصادفی در بازه `10000-60000`
- لایه انتقال: `tcp`, `websocket`, `grpc`, `xhttp`
- SNI از لیست سفید دامنه‌ها گرفته می‌شود (`whitelist`); می‌توانید از لیست خود استفاده کنید.

تمام اتصالات در یک اشتراک با URL ثابت تجمیع می‌شوند. ربات با پنل `3x-ui` از طریق API باز کار می‌کند و به‌طور مستقیم در عملکرد داخلی پنل دخالت نمی‌کند.

هدف ثانویه افزایش پایداری اتصال است: مشتری 10 گزینه اتصال دریافت می‌کند و می‌تواند هر کدام را انتخاب کند.

علاوه بر این، ربات می‌تواند در طرح‌های آبشاری استفاده شود. سرویس فورواردینگ به‌طور خودکار بازنشانی اشتراک و ترافیک به سرور اصلی را تنظیم می‌کند.

توصیه‌ها:

- برای اشتراک از HTTPS استفاده کنید (دامنه + گواهی SSL).
- فاصله تولید را ≥ 10 دقیقه در نظر بگیرید؛ برای پایداری توصیه می‌شود یک‌بار در روز (1440 دقیقه) تنظیم شود.
- در کلاینت به‌روزرسانی خودکار را بیشتر تنظیم کنید (مثلاً هر ساعت) تا همگام‌سازی با سرور انجام شود.

## قابلیت‌ها

- تولید 10 اتصال متنوع
- تشکیل یک اشتراک یکپارچه با URL ثابت
- پشتیبانی از دامنه‌های `whitelist` سفارشی
- پیکربندی خودکار فورواردینگ ترافیک (اختیاری)

## نیازمندی‌ها

- Ubuntu 20.04 یا بالاتر
- پنل `3x-ui`
- دامنه + گواهی SSL (اختیاری)

---

## نصب

برای نصب پروژه در سرور، دستور زیر را اجرا کنید:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/install.sh)
```

<sup>توضیح کوتاه: اسکریپت نصب را اجرا کرده و کانتینرها و سرویس‌ها را راه‌اندازی می‌کند.</sup>

## به‌روزرسانی

برای به‌روزرسانی به آخرین نسخه:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/update.sh)
```

<sup>توضیح کوتاه: تغییرات جدید را می‌کشد و کانتینرها را ری‌استارت می‌کند.</sup>

## حذف

برای حذف کامل سرویس:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/delete.sh)
```

<sup>توضیح کوتاه: کانتینرها و فایل‌های پیکربندی را حذف می‌کند و سیستم را به وضعیت پیش از نصب برمی‌گرداند.</sup>

---

## نصب سرویس فورواردینگ (forwarding)

سرویس فورواردینگ امکان پراکسی کردن پورت‌های ورودی از سرور واسط به سرور اصلی را فراهم می‌کند.

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/forwarding_install.sh)
```

<sup>توضیح کوتاه: قوانین فورواردینگ را اضافه کرده و سرویسی برای به‌روزرسانی اشتراک ایجاد می‌کند.</sup>

## حذف فورواردینگ

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/forwarding_delete.sh)
```

<sup>توضیح کوتاه: قوانین را حذف کرده و سرویس فورواردینگ را غیرفعال می‌کند.</sup>

---

## نمایش URL اشتراک

دستور برای نمایش URL اشتراک فعلی در محیط کانتینر:

```bash
cd /opt/3dp-manager && docker compose exec node env | grep SUB_URL | cut -d'=' -f2
```

<sup>توضیح کوتاه: URL ثابت اشتراک را نمایش می‌دهد که می‌توان در کلاینت‌ها استفاده کرد. هم در سرور اصلی و هم در سرور واسط کار می‌کند.</sup>

## جمع‌آوری دامنه‌ها از چندین اشتراک

ابزار دامنه‌ها را از اشتراک‌های دارای چندین پیکربندی استخراج کرده و `whitelist` تولید می‌کند.

```bash
node get_domains.js
```

<sup>توضیح کوتاه: لینک چندین اشتراک را در اسکریپت قرار داده و فرمان را اجرا کنید — خروجی فهرست دامنه‌ها خواهد بود. نیازمند `Node.js` است.</sup>

## استفاده از whitelist شخصی

1. فایلی با ساختار مشابه `whitelist.txt` آماده کنید.
2. آن را به `my_whitelist.txt` تغییر نام دهید و در پوشه `/opt/3dp-manager/app` کپی کنید.

```bash
cd /opt/3dp-manager && docker cp ./app/my_whitelist.txt node:/app/my_whitelist.txt
```

<sup>توضیح کوتاه: فایل دامنه شما را به کانتینر برنامه اضافه می‌کند.</sup>

---

## نکات و محدودیت‌های فعلی

- لیست عمومی دامنه‌ها برای همه ارائه‌دهندگان کار نمی‌کند؛ پیشنهاد می‌شود `whitelist` خود را تهیه و استفاده کنید.

---

## مشارکت

از هرگونه مشارکت در توسعه پروژه خوشحال می‌شوم! روند ساده برای مشارکت‌کنندگان:

1. مخزن را در GitHub fork کنید.
2. شاخه‌ای با نام معنادار ایجاد کنید مانند `feature/add-README` یا `fix/whitelist-load`.
3. تغییرات را اعمال کرده و یک پیام کوتاه در کامیت اضافه کنید.
4. در صورت وجود، بررسی‌های محلی را اجرا کنید.
5. شاخه را به fork خود پوش کرده و Pull Request ایجاد کنید.

<sup>نکات: تغییرات را در PR شرح دهید و مراحل تست را بنویسید. در صورت تغییرات بزرگ، آنها را به کامیت‌های کوچک تقسیم کنید.</sup>

---

## بحث

- تلگرام: [@denpiligrim_web](https://t.me/denpiligrim_web)
- Issues