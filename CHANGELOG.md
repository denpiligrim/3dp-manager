# История изменений

## Следующий релиз

- Маршрутизация INCY: JSON, base64 и ссылки `incy://routing/add/...`,
  `incy://routing/onadd/...`, `incy://routing/off` в обычных и relay-подписках.
  Также поддержаны HTTP(S)-источники профиля и ссылки `incy://autorouting/...`;
  профиль по URL загружает клиент INCY. В форме подписки добавлены отдельные
  кнопки «Добавить роутинг Happ» и «Добавить роутинг INCY».
- Поддержка профилей маршрутизации Happ в подписках: JSON, base64 и ссылки
  `happ://routing/add/...`, `happ://routing/onadd/...`, `happ://routing/off`.
  Профили передаются в обычных подписках и подписках через relay без создания
  инбаундов в 3x-ui. Некорректные профили отклоняются при сохранении.
- Автор исходной реализации: [@zangetsuka](https://github.com/zangetsuka),
  [PR #53](https://github.com/denpiligrim/3dp-manager/pull/53).
  Исходные коммиты сохранены в истории проекта.
- Установщик использует официальные образы `ghcr.io/denpiligrim/3dp-manager-*` с тегом `main`.
- Ротация создаёт новые подключения до удаления старых и сохраняет рабочие
  ссылки при отказе панели. Очистка ограничена инбаундами этой подписки;
  неудачное удаление можно повторить благодаря сохранённой локальной записи.
  Основано на вкладе [@xFalconMH](https://github.com/xFalconMH),
  [PR #59](https://github.com/denpiligrim/3dp-manager/pull/59), ветка `test-fix`.
- Совместимость `tgId` со старыми и новыми версиями 3x-ui: необязательное поле
  не отправляется в создаваемых клиентах. Вклад [@PavelArs](https://github.com/PavelArs),
  [PR #62](https://github.com/denpiligrim/3dp-manager/pull/62), ветка `fix-tagid`.
- Принудительное удаление недоступной ноды, принудительная ротация и фон формы
  входа с учётом темы. Вклад [@K0TD](https://github.com/K0TD),
  [PR #64](https://github.com/denpiligrim/3dp-manager/pull/64), ветка `fix-deletion`.
- Авторизация с CSRF в 3x-ui, диагностика отказов создания инбаундов,
  корректный адрес ноды в Trojan-ссылках и отдельный скрипт проверки панели.
  Вклад [@n1xsi](https://github.com/n1xsi),
  [PR #63](https://github.com/denpiligrim/3dp-manager/pull/63), ветка `fix-compatibility`.

Формат Happ: [официальная документация](https://www.happ.su/main/dev-docs/routing).
