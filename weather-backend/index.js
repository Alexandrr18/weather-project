// подключаю библиотеки и сохраняю их в переменные
// express - для создания маршрутов, обработка запросов и ответы на них
// cors - для разрешения работы на 3000 порту
const express = require('express');
const cors = require('cors');
const { Client } = require('pg');
require('dotenv').config();

// создаю сервер для приёма запросов
const server = express();
// создаю номер порта 
const PORT = 3000;

// разрешаем фронтенду обращаться к этому серверу
server.use(cors());

// чтобы сервер понимал JSON в теле запроса
server.use(express.json());

// --- ПОДКЛЮЧЕНИЕ К POSTGRESQL ---
// Создаём клиент для работы с базой данных
const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    client_encoding: 'UTF8'
});

// Пытаемся подключиться к БД при старте
client.connect().then(() => {
    console.log('✅ Подключён к PostgreSQL');
}).catch(err => {
    console.error('❌ Ошибка подключения к БД:', err.message);
});

// Вместо «БД в памяти» мы будем хранить данные в переменных,
// которые заполняются из PostgreSQL при старте сервера.
let cities = [];
let weatherSnapshots = {};

// Загружаем города и погоду из базы данных при старте сервера
(async () => {
    try {
        // Получаем все города из таблицы cities
        const citiesRes = await client.query('SELECT * FROM cities');
        cities = citiesRes.rows;

        // Получаем текущие снимки погоды из weather_snapshots
        const weatherRes = await client.query('SELECT * FROM weather_snapshots');
        weatherSnapshots = {};
        weatherRes.rows.forEach(row => {
            weatherSnapshots[row.city_id] = {
                cityId: Number(row.city_id),
                temperature: row.temperature,
                windspeed: row.windspeed,
                winddirection: row.winddirection,
                description: row.description,
                isStale: row.is_stale,
                lastUpdated: row.last_updated ? row.last_updated.toISOString() : null,
            };
        });
        console.log(`✅ Загружено: ${cities.length} городов, ${Object.keys(weatherSnapshots).length} записей погоды`);
    } catch (err) {
        console.error('❌ Не удалось загрузить данные из БД:', err.message);
    }
})();

console.log('>>> ТЕСТ КОДИРОВКИ: Москва — Лондон не работает СУКА <<<');

// Функция, которая запрашивает погоду для одного города у Open-Meteo
async function fetchWeatherForCity(city) {
    try {
        // Используем реальные координаты из города (они теперь хранятся в city.lat / city.lon)
        const { lat, lon } = city;
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`Open-Meteo вернул статус ${res.status}`);

        const data = await res.json();
        const current = data.current_weather;

        // Обновляем локальный объект weatherSnapshots (для быстрого ответа фронтенду)
        weatherSnapshots[city.id] = {
            cityId: city.id,
            temperature: current.temperature,
            windspeed: current.windspeed,
            winddirection: current.winddirection,
            description: 'Ясно', // Можно позже сделать маппинг по температуре/осадкам
            isStale: false,      // Теперь данные свежие
            lastUpdated: new Date().toISOString(),
        };

        // ЗАПИСЫВАЕМ ПОГОДУ В БАЗУ ДАННЫХ (PostgreSQL)
        await client.query(`
            UPDATE weather_snapshots
            SET temperature = $1, windspeed = $2, winddirection = $3, description = $4, is_stale = $5, last_updated = NOW()
            WHERE city_id = $6
        `, [
            current.temperature,
            current.windspeed,
            current.winddirection,
            'Ясно',
            false,
            city.id
        ]);

        console.log(`✅ Погода обновлена для города ${city.name}: ${current.temperature}°C`);
        return true;
    } catch (err) {
        console.error(`❌ Не удалось получить погоду для города ${city.name}:`, err.message);

        // По ТЗ: если API недоступен — помечаем данные как устаревшие
        if (weatherSnapshots[city.id]) {
            weatherSnapshots[city.id].isStale = true;
            weatherSnapshots[city.id].lastUpdated = new Date().toISOString();
        }

        // ЗАПИСЫВАЕМ СТАТУС «УСТАРЕВШИЕ ДАННЫЕ» В БД
        await client.query(`
            UPDATE weather_snapshots
            SET is_stale = true, last_updated = NOW()
            WHERE city_id = $1
        `, [city.id]);

        console.log(`⚠️ Данные для ${city.name} помечены как устаревшие.`);
        return false;
    }
}

// функция, которая обновляет погоду для ВСЕХ городов
async function updateAllWeather() {
    console.log('🔄 Начинаем обновление погоды для всех городов...');
    const results = await Promise.allSettled(
        cities.map(city => fetchWeatherForCity(city))
    );
    const success = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    console.log(`🏁 Готово: ${success} успешно, ${failed} с ошибкой.`);
}

// маршрут для ручного обновления погоды (для тестов)
server.get('/refresh-weather', async (req, res) => {
    await updateAllWeather();
    res.json({ message: 'Обновление погоды запущено', timestamp: new Date().toISOString() });
});

// эндпоинт чтобы получить список городов
server.get('/cities', (req, res) => {
    res.json(cities);
});

// эндпоинт чтобы добавить город 
server.post('/cities', async (req, res) => {
    const { name, country, lat, lon } = req.body;

    // проверяю, если нет имени или это просто пробелы — кидаю ошибку
    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Название города обязательно' });
    }

    // если имя есть — создаю объект города
    const newCity = {
        id: Date.now(),
        name: name.trim(),
        country: country ? country.trim() : 'Не указано',
        lat: lat || 0,
        lon: lon || 0,
    };

    try {
        // ДОБАВЛЯЕМ ГОРОД В ТАБЛИЦУ cities
        await client.query(
            `INSERT INTO cities (id, name, country, lat, lon) VALUES ($1, $2, $3, $4, $5)`,
            [newCity.id, newCity.name, newCity.country, newCity.lat, newCity.lon]
        );

        // СОЗДАЁМ ЗАПИСЬ ПОГОДЫ ДЛЯ НОВОГО ГОРОДА (сразу помечаем как устаревшую)
        await client.query(
            `INSERT INTO weather_snapshots (city_id, is_stale, last_updated) VALUES ($1, true, NOW())`,
            [newCity.id]
        );

        // Добавляем новый город в локальный массив (чтобы фронтенд сразу видел)
        cities = [...cities, newCity];

        // Создаём запись погоды нового города в локальном объекте
        weatherSnapshots[newCity.id] = {
            cityId: newCity.id,
            temperature: null,
            description: 'Нет данных',
            isStale: true,
            lastUpdated: new Date().toISOString(),
        };

        console.log(`✅ Город добавлен: ${newCity.name}. Погода инициализирована.`);

        // возвращаю новый объект 
        res.status(201).json(newCity);
    } catch (err) {
        console.error('❌ Ошибка при добавлении города в БД:', err.message);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

server.get('/weather', (req, res) => {
    console.log('>>> GET /weather: отдаём текущие снимки погоды', weatherSnapshots);
    res.json(weatherSnapshots);
});

// заглушка для демонстрации работы сервера
server.get('/', (req, res) => {
    res.json({ message: 'Бэкенд работает!' });
});

// запуск автоматического обновления погоды раз в 5 минут (300000 мс)
setInterval(updateAllWeather, 300000);

// запуск сервера
server.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});
