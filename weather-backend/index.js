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
    // возвращаю новый объект 
    res.status(201).json(newCity);
});

// заглушка для демонстрации работы сервера
server.get('/', (req, res) => {
    res.json({ message: 'Бэкенд работает!' });
});

// запуск сервера
server.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});
