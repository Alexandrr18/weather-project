// подключаю библиотики и сохраняю их в переменные
// express - для создания маршрутов, обработка запросов и ответы на них
// cors - для разрешения работы на 3000 порту
const express = require('express');
const cors = require('cors');

// создаю сервер для приёма запросов
const server = express();
// создаю номер порта 
const PORT = 3000;

// разрешаем фронтенду обращаться к этому серверу
server.use(cors());

// чтобы сервер понимал JSON в теле запроса
server.use(express.json());

// «база данных» в памяти
let cities = [
    { id: 1, name: 'Москва', country: 'Россия' },
    { id: 2, name: 'Лондон', country: 'Великобритания' },
];

// создаю пустой объект куда буду складывать погоду по городам
let weatherSnapshots = {}; 

// инициализирую погоду для уже существующих городов
cities.forEach(city => {
    weatherSnapshots[city.id] = {
        cityId: city.id,
        temperature: null,
        description: 'Нет данных',
        isStale: true,
        lastUpdated: null
    };
});

// Функция, которая запрашивает погоду для одного города у Open-Meteo
async function fetchWeatherForCity(city) {
    try {
    // Open-Meteo API: передаём широту и долготу. Пока сделаем заглушку координат.
    // Для Москвы: 55.7558, 37.6176; для Лондона: 51.5074, -0.1278
    // В будущем координаты будем хранить в city.coords
    const lat = 55.7558; // ВРЕМЕННО: для теста возьмём Москву для всех
    const lon = 37.6176;

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
    
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open-Meteo вернул статус ${res.status}`);
    
    const data = await res.json();
    const current = data.current_weather;

    // Обновляем weatherSnapshots для этого города
    weatherSnapshots[city.id] = {
        cityId: city.id,
        temperature: current.temperature,
        windspeed: current.windspeed,
        winddirection: current.winddirection,
      description: 'Ясно', // Open-Meteo не даёт текстовое описание, можно сделать маппинг по температуре/осадкам
      isStale: false,      // Теперь данные свежие
        lastUpdated: new Date().toISOString(),
    };

    console.log(`✅ Погода обновлена для города ${city.name}: ${current.temperature}°C`);
    return true;
    } catch (err) {
    console.error(`❌ Не удалось получить погоду для города ${city.name}:`, err.message);
    // По ТЗ: если API недоступен — оставляем старые данные и ставим isStale: true
    if (weatherSnapshots[city.id]) {
        weatherSnapshots[city.id].isStale = true;
        weatherSnapshots[city.id].lastUpdated = new Date().toISOString();
        console.log(`⚠️ Данные для ${city.name} помечены как устаревшие.`);
    }
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

// иаршрут для ручного обновления погоды (для тестов)
server.get('/refresh-weather', async (req, res) => {
    await updateAllWeather();
    res.json({ message: 'Обновление погоды запущено', timestamp: new Date().toISOString() });
});



// эндпоинт что бы получить список городов
server.get('/cities', (req, res) => {
    res.json(cities);
});

// эндпоинт что бы добавить город 
server.post('/cities', (req, res) => {
    const { name, country } = req.body;

    // проверяю если нет имени или это просто пробелы кидаю ошибку
    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Название города обязательно' });
    }
    
    // если имя есть создаю объект города
    const newCity = {
        id: Date.now(),
        name: name.trim(),
        country: country ? country.trim() : 'Не указано',
    };

    // добавляю новый город в нашу БД 
    cities = [...cities, newCity];

    // создаю запись погоды нового города
    weatherSnapshots[newCity.id] = {
        cityId: newCity.id,
        temperature: null,
        description: 'Нет данных',
        isStale: true,
        lastUpdated: null
    };
    
    console.log(`✅ Город добавлен: ${newCity.name}. Погода инициализирована.`);

    // возвращаю новый объект 
    res.status(201).json(newCity);
});

server.get('/weather', (req, res) => {
    console.log('>>> GET /weather: отдаём текущие снимки погоды', weatherSnapshots);
    res.json(weatherSnapshots);
});

// заглушка для демонстрации работы сервера
server.get('/', (req, res) => {
    res.json({ message: 'Бэкенд работает!' });
});

// запускаю автоматическое обновление погоды раз в 5 минут (300000 мс)
setInterval(updateAllWeather, 300000);


// запуск сервера
server.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});
