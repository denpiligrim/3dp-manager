# История изменений

## Следующий релиз

- Поддержка профилей маршрутизации Happ в подписках: JSON, base64 и ссылки
  `happ://routing/add/...`, `happ://routing/onadd/...`, `happ://routing/off`.
  Профили передаются в обычных подписках и подписках через relay без создания
  инбаундов в 3x-ui. Некорректные профили отклоняются при сохранении.
- Автор исходной реализации: [@zangetsuka](https://github.com/zangetsuka),
  [PR #53](https://github.com/denpiligrim/3dp-manager/pull/53).
  Исходные коммиты сохранены в истории проекта.
- Установщик использует официальные образы `ghcr.io/denpiligrim/3dp-manager-*` с тегом `main`.

Формат Happ: [официальная документация](https://www.happ.su/main/dev-docs/routing).
