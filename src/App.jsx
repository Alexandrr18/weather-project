import { useEffect, useState } from "react";

function App() {
  // хук списка городов с начальным состоянием
  const [cities, setCities] = useState([]);
  // хук состояние поля ввода города
  const [newCityName, setNewCityName] = useState("");
  // хук состояния поля ввода страны
  const [newCityCountry, setNewCityCountry] = useState("");
  // хук состояния для погоды (теперь просто храним то, что прислал бэкенд)
  const [weatherByCity, setWeatherByCity] = useState({});
  // хуки для состояния загрузки и ошибок
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // хуки 
  const [newCityLat, setNewCityLat] = useState(0);
  const [newCityLon, setNewCityLon] = useState(0);


  // добавляем город на запрос к API
  const handleAddCity = async (e) => {
    // сбрасываю событие event, чтоб страница не перезагружалась
    e.preventDefault();
    const name = newCityName.trim();
    // если имя пустое — ничего не делаю
    if (!name) return;

    const data = {
      name,
      country: newCityCountry.trim() || "Не указано",
      lat: newCityLat,
      lon: newCityLon,
    };

    try {
      const response = await fetch("http://localhost:3000/cities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Не удалось добавить город");
      }

      // делаю отдельный запрос и корректно читаю JSON, чтобы обновить список городов
      const listResponse = await fetch("http://localhost:3000/cities");
      if (!listResponse.ok) {
        throw new Error("Не удалось получить список городов");
      }
      const updatedCities = await listResponse.json();
      setCities(updatedCities);

      // очищаю поля ввода
      setNewCityName("");
      setNewCityCountry("");
    } catch (error) {
      console.error(error);
      setError("Ошибка при добавлении города");
    }
  };

  // хук для запроса города с бэкенда — запускается один раз при старте
  useEffect(() => {
    fetch("http://localhost:3000/cities")
      .then((res) => {
        if (!res.ok) throw new Error("Ошибка сети или сервера");
        return res.json();
      })
      .then((data) => setCities(data))
      .catch((err) => {
        console.error(err);
        setError("Не удалось загрузить список городов");
      });
  }, []);

  // хук запускает запрос погоды при загрузке и при изменении списка городов
  // теперь мы не генерируем погоду сами, а просто забираем её с бэкенда
  useEffect(() => {
    setLoading(true);
    fetch("http://localhost:3000/weather")
      .then((res) => {
        if (!res.ok) throw new Error("Не удалось получить погоду");
        return res.json();
      })
      .then((data) => setWeatherByCity(data))
      .catch((err) => {
        console.error(err);
        setError("Не удалось загрузить погоду с сервера");
      })
      .finally(() => setLoading(false));
  }, [cities]); // если список городов изменился — запрашиваем погоду заново

  if (loading) return <p>Загрузка данных...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
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
        <input
          value={newCityLat}
          placeholder="Широта (lat)"
          type="number"
          step="0.0001"
          onChange={(e) => setNewCityLat(Number(e.target.value))}
        />
        <input
          value={newCityLon}
          placeholder="Долгота (lon)"
          type="number"
          step="0.0001"
          onChange={(e) => setNewCityLon(Number(e.target.value))}
        />
        <button type="submit">Добавить город</button>
      </form>

      <section>
        <h2>Избранные города</h2>
        {cities.length === 0 ? (
          <p>Пока нет избранных городов.</p>
        ) : (
          <ul>
            {cities.map((city) => (
              <li key={city.id}>
                {city.name}, {city.country}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Погода</h2>
        {cities.length === 0 ? (
          <p>Добавьте города, чтобы увидеть погоду.</p>
        ) : (
          cities.map((city) => {
            const weather = weatherByCity[city.id];

            // если погоды для города ещё нет — показываем заглушку
            if (!weather) {
              return (
                <div key={city.id} style={{ marginBottom: "10px" }}>
                  <h3>{city.name}</h3>
                  <p>Погода загружается...</p>
                </div>
              );
            }

            return (
              <div
                key={city.id}
                style={{ border: "1px solid #cc", padding: "10px", marginBottom: "8px" }}
              >
                <h3>{city.name}, {city.country}</h3>

                {weather.temperature === null ? (
                  <p>Нет данных о погоде</p>
                ) : (
                  <>
                    <p>Температура: {weather.temperature}°C</p>
                    <p><b>Ветер:</b> {weather.description} м/с, направление {weather.winddirection}</p>
                  </>
                )}

                {weather.isStale && (
                  <p style={{ color: "orange" }}>
                    Данные устарели: сервис погоды временно недоступен
                  </p>
                )}

                {weather.lastUpdated && (
                  <p style={{ color: '#666', fontSize: '0.9em' }}>
                    Обновлено: {new Date(weather.lastUpdated).toLocaleString()}
                  </p>
                )}

              </div>
            );
          })
        )}
      </section>
    </div>
  );
}

export default App;
