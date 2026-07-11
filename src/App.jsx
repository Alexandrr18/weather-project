// ОСНОВНОЙ КОМПОНЕНТ ОТРИСОВКИ СПИСКА ГОРОДОВ И ПОГОДЫ
import { useEffect, useState } from "react";

function App () {

  // хук списка городов с начальным состоянием
  const [cities, setCities] = useState([]);
  // хук состояние поля ввода города
  const [newCityName, setNewCityName] = useState('');
  // хук состояния поля ввода страны
  const [newCityCountry, setNewCityCountry] = useState('');
  // хук состояния для погоды
  const [weatherCity, setWeatherCity] = useState({});
  // хук состояния имитации, недоступен внешний API
  const [simulateApi, setSimulateApi] = useState(false);

  // функция которая будет срабатывать при отправке формы 
  const handleAddCity = (e) => {
    e.preventDefault();
    if (!newCityName.trim()) return;

  // если строка не пустая создаю объект нового города
  const newCity = {
    id: Date.now(),
    name: newCityName.trim(),
    country: newCityCountry.trim() || 'Не указанно!'
    };
    
    // обновляю состояние добавляя новый город в общий список
    setCities((prev) => [...prev, newCity])

    //очищаю поля ввода
    setNewCityName('');
    setNewCityCountry('');
  };

  // функция которая подтягивает данные о погоде при загрузке и изменении списка городов, пока генерируя случайные данные
  const loadWeatherCity = () => {
    // если API не работает оставляем старую погоду
    if(simulateApi) {
      const newResult = {};
      cities.forEach((city) => {
        const old = weatherCity[city.id];
        newResult[city.id] = old ? {...old, isStale: true} : {
          cityId: city.id,
          temperature: 0,
          description: 'Нет данных',
          time: new Date(),
          isStale: true
        };
      });
      setWeatherCity(newResult);
      return;
    }

    // если API работает генерируем новую случайную погоду
    const result = {}
    cities.forEach((city) => {
      result[city.id] = {
        cityId: city.id,
        temperature: Math.floor(Math.random() * 30 -5),
        description: ['ясно','дождь','снег','пасмурно'][Math.floor(Math.random() * 4)],
        time: new Date(),
        isStale: false
      };
    })
    // обновляю состояние погоды 
    setWeatherCity(result);
  }

  // хук запускает функцию изменений погоды при изменении списка городов
  useEffect(() => {
    loadWeatherCity();
  }, [cities])

  return (
    <div style={{padding: '20px', fontFamily: 'Arial, sans-serif'}}>
      <h1>Погода в избранных городах</h1>
      <form onSubmit={handleAddCity}>
        <input
          value={newCityName}
          placeholder="Название города"
          onChange={(e) => setNewCityName(e.target.value)}
          required
        />
        <input
          value={newCityCountry}
          placeholder="Название страны"
          onChange={(e) => setNewCityCountry(e.target.value)}
        />
        <button type="submit">Добавить город</button>
      </form>
      <button onClick={() => setSimulateApi((prev) => !prev)}>
        {simulateApi ? "Имитировать API недоступен" : "Имитировать API работает"}
      </button>

      <section>
        <h2>Избранные города</h2>
        <ul>
          {cities.map((city) => (
            <li key = {city.id}>
              {city.name}, {city.country}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Погода</h2>
        {cities.map((city) => {
          const weather = weatherCity[city.id];
          if (!weather) return null;

          return (
            <div key={city.id} style={{border: '1px solid #cc', padding: '10px', marginBottom: '8px'}}>
              <h3>{city.name}, {city.country}</h3>
              <p>Температура: {weather.temperature}</p>
              <p>Описание: {weather.description}</p>
              {weather.isStale && (
                <p style={{color: 'orange'}}>
                  Данные устарели сервис погоды временно не доступен
                </p>
              )}
            </div>
          )
        })}
      </section>
    </div>
  )
}

export default App;