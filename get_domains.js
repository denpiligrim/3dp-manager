const fs = require('fs');

// Вставьте сюда вашу ссылку на подписку
const SUBSCRIPTION_URL = '';

// Регулярное выражение для проверки домена (минимум одна точка, без спецсимволов)
const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;

async function processSubscription() {
    try {
        console.log('Загрузка данных подписки...');
        const response = await fetch(SUBSCRIPTION_URL);
        
        if (!response.ok) {
            throw new Error(`Ошибка загрузки: ${response.statusText}`);
        }

        let rawData = await response.text();

        // Если подписка в Base64 (часто для vless), раскомментируйте строку ниже:
        // if (!rawData.startsWith('vless://')) rawData = Buffer.from(rawData, 'base64').toString('utf8');
        
        const links = rawData.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
        const domains = new Set();

        links.forEach(link => {
            try {
                const url = new URL(link);
                const params = url.searchParams;

                // Извлекаем значения из sni и host
                const candidates = [params.get('sni'), params.get('host')];

                candidates.forEach(val => {
                    if (val) {
                        const cleanVal = val.trim().toLowerCase();
                        // Валидация: проверяем через Regex и исключаем пустые строки
                        if (cleanVal && domainRegex.test(cleanVal)) {
                            domains.add(cleanVal);
                        }
                    }
                });
            } catch (e) {
                // Пропускаем строки, которые не являются ссылками
            }
        });

        const result = Array.from(domains).sort(); // Сортируем для удобства

        if (result.length > 0) {
            fs.writeFileSync('my_whitelist.txt', result.join('\n'), 'utf8');
            console.log(`Успешно! Сохранено уникальных доменов: ${result.length}`);
        } else {
            console.log('Валидные домены не найдены.');
        }

    } catch (error) {
        console.error('Произошла ошибка:', error.message);
    }
}

processSubscription();