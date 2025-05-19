/**
 * Сервис для работы с API треков транспортных средств
 */

/**
 * Получение JWT токена авторизации из localStorage
 * @returns {string|null} JWT токен или null если токен не найден
 */
const getAuthToken = () => {
  // Проверяем различные варианты хранения токена
  const possibleTokenKeys = ['authToken', 'token', 'jwt', 'access_token'];
  
  for (const key of possibleTokenKeys) {
    const token = localStorage.getItem(key);
    if (token) {
      // Проверяем, является ли токен корректным JWT (содержит 2 точки)
      if (token.split('.').length === 3) {
        return token;
      }
    }
  }
  
  // Если не нашли JWT токен в localStorage, возвращаем null
  return null;
};

/**
 * Загрузка данных трека транспортного средства
 * @param {string} imei - IMEI транспортного средства
 * @param {Date} startDate - Начальная дата диапазона
 * @param {Date} endDate - Конечная дата диапазона
 * @param {Function} onProgress - Колбэк для отображения прогресса загрузки
 * @returns {Promise<Array>} Массив точек трека
 * @throws {Error} Ошибка при загрузке данных
 */
export const fetchTrackData = async (imei, startDate, endDate, onProgress) => {
  try {
    if (!imei) {
      throw new Error('IMEI не указан');
    }
    
    if (!startDate || !endDate) {
      throw new Error('Не указан диапазон дат');
    }
    
    // Обновляем прогресс
    onProgress && onProgress(5, 'Подготовка запроса...');
    
    // Форматирование дат в нужный формат для API (ISO строки)
    const startISOString = startDate.toISOString();
    const endISOString = endDate.toISOString();
    
    // Дата в формате YYYY-MM-DD для запасного API
    const startDateString = startDate.toISOString().split('T')[0];
    const endDateString = endDate.toISOString().split('T')[0];
    
    onProgress && onProgress(15, 'Подготовка API запроса...');
    
    // Основной URL для API получения данных трека
    const primaryApiUrl = `/api/telemetry/v3/${imei}/track?startTime=${encodeURIComponent(startISOString)}&endTime=${encodeURIComponent(endISOString)}`;
    
    // Запасной URL для API (используется, если основной URL не работает)
    const fallbackApiUrl = `/api/v1/tracks/${imei}?from=${startDateString}&to=${endDateString}`;
    
    // Получаем токен авторизации
    const authToken = getAuthToken();
    
    // Подготавливаем заголовки запроса
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    // Если токен найден, добавляем его в заголовки
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    onProgress && onProgress(25, 'Соединение с сервером...');
    
    let response;
    let data;
    let useBackupApi = false;
    
    // Пробуем основной URL
    try {
      response = await fetch(primaryApiUrl, {
        method: 'GET',
        headers: headers
      });
      
      onProgress && onProgress(40, 'Получение данных...');
      
      // Если ответ не успешный, пробуем запасной URL
      if (!response.ok) {
        console.warn(`Основной API вернул ошибку: ${response.status}. Пробуем запасной URL.`);
        onProgress && onProgress(45, 'Подключение к запасному API...');
        useBackupApi = true;
      } else {
        // Парсим JSON ответ основного API
        data = await response.json();
        onProgress && onProgress(60, 'Обработка данных...');
      }
    } catch (primaryError) {
      console.warn(`Ошибка при запросе к основному API: ${primaryError.message}. Пробуем запасной URL.`);
      onProgress && onProgress(45, 'Подключение к запасному API...');
      useBackupApi = true;
    }
    
    // Если основной URL не сработал, пробуем запасной
    if (useBackupApi) {
      try {
        response = await fetch(fallbackApiUrl, {
          method: 'GET',
          headers: headers
        });
        
        onProgress && onProgress(55, 'Получение данных из запасного API...');
        
        if (!response.ok) {
          throw new Error(`Запасной API вернул ошибку: ${response.status} ${response.statusText}`);
        }
        
        data = await response.json();
        onProgress && onProgress(65, 'Обработка данных...');
      } catch (fallbackError) {
        throw new Error(`Ошибка при запросе к запасному API: ${fallbackError.message}`);
      }
    }
    
    // Проверяем полученные данные и преобразуем их в нужный формат
    let trackPoints = [];
    
    onProgress && onProgress(70, 'Преобразование данных...');
    
    // Обработка различных форматов данных API
    if (data) {
      if (Array.isArray(data.points)) {
        // Формат основного API
        console.log(`Успешно получены данные трека: ${data.points.length} точек`);
        
        trackPoints = data.points.map((point, index) => ({
          id: index,
          latitude: point.lat || point.latitude,
          longitude: point.lng || point.lon || point.longitude,
          timestamp: new Date(point.timestamp || point.time || point.datetime),
          speed: point.speed || 0,
          altitude: point.altitude || point.alt || 0,
          course: point.course || point.heading || point.direction || 0,
          satellites: point.satellites || point.sats || 0,
          fuel: point.fuel || point.fuelLevel || 0
        }));
      } else if (Array.isArray(data)) {
        // Формат запасного API - массив точек
        console.log(`Успешно получены данные трека: ${data.length} точек`);
        
        trackPoints = data.map((point, index) => ({
          id: index,
          latitude: point.lat || point.latitude,
          longitude: point.lng || point.lon || point.longitude,
          timestamp: new Date(point.timestamp || point.time || point.datetime),
          speed: point.speed || 0,
          altitude: point.altitude || point.alt || 0,
          course: point.course || point.heading || point.direction || 0,
          satellites: point.satellites || point.sats || 0,
          fuel: point.fuel || point.fuelLevel || 0
        }));
      } else if (data.tracks && Array.isArray(data.tracks)) {
        // Еще один возможный формат - массив в свойстве tracks
        console.log(`Успешно получены данные трека: ${data.tracks.length} точек`);
        
        trackPoints = data.tracks.map((point, index) => ({
          id: index,
          latitude: point.lat || point.latitude,
          longitude: point.lng || point.lon || point.longitude,
          timestamp: new Date(point.timestamp || point.time || point.datetime),
          speed: point.speed || 0,
          altitude: point.altitude || point.alt || 0,
          course: point.course || point.heading || point.direction || 0,
          satellites: point.satellites || point.sats || 0,
          fuel: point.fuel || point.fuelLevel || 0
        }));
      } else if (data.data && Array.isArray(data.data)) {
        // Формат с данными в свойстве data
        console.log(`Успешно получены данные трека: ${data.data.length} точек`);
        
        trackPoints = data.data.map((point, index) => ({
          id: index,
          latitude: point.lat || point.latitude,
          longitude: point.lng || point.lon || point.longitude,
          timestamp: new Date(point.timestamp || point.time || point.datetime),
          speed: point.speed || 0,
          altitude: point.altitude || point.alt || 0,
          course: point.course || point.heading || point.direction || 0,
          satellites: point.satellites || point.sats || 0,
          fuel: point.fuel || point.fuelLevel || 0
        }));
      } else if (data.error) {
        // Обработка ошибки от API
        throw new Error(`Ошибка API: ${data.error}`);
      } else {
        // Неизвестный формат данных
        throw new Error('Неизвестный формат данных от API');
      }
    } else {
      throw new Error('API не вернул данные');
    }
    
    onProgress && onProgress(80, 'Финальная обработка данных...');
    
    // Проверяем, получили ли мы точки трека
    if (trackPoints.length === 0) {
      console.warn('API вернул пустой список точек трека');
      return [];
    }
    
    onProgress && onProgress(90, 'Фильтрация и сортировка точек...');
    
    // Фильтруем точки с невалидными координатами
    const validPoints = trackPoints.filter(
      point => typeof point.latitude === 'number' && 
               typeof point.longitude === 'number' &&
               !isNaN(point.latitude) && 
               !isNaN(point.longitude)
    );
    
    if (validPoints.length === 0) {
      console.warn('После фильтрации невалидных координат не осталось точек трека');
      return [];
    }
    
    // Сортируем точки по времени
    validPoints.sort((a, b) => a.timestamp - b.timestamp);
    
    onProgress && onProgress(95, 'Кеширование данных...');
    
    // Сохраняем данные трека в сессионное хранилище для быстрого доступа
    try {
      sessionStorage.setItem(
        `track_${imei}_${startDateString}_${endDateString}`,
        JSON.stringify(validPoints)
      );
    } catch (storageError) {
      console.warn('Не удалось сохранить данные трека в sessionStorage:', storageError);
    }
    
    onProgress && onProgress(100, 'Загрузка завершена');
    
    return validPoints;
  } catch (error) {
    console.error('Ошибка при загрузке данных трека:', error);
    
    // Пробуем получить данные из sessionStorage
    try {
      const startDateString = startDate.toISOString().split('T')[0];
      const endDateString = endDate.toISOString().split('T')[0];
      const storageKey = `track_${imei}_${startDateString}_${endDateString}`;
      
      const cachedData = sessionStorage.getItem(storageKey);
      if (cachedData) {
        console.log('Используем кешированные данные из sessionStorage');
        onProgress && onProgress(90, 'Загрузка из кеша...');
        
        const trackPoints = JSON.parse(cachedData);
        onProgress && onProgress(100, 'Загрузка из кеша завершена');
        
        return trackPoints;
      }
    } catch (storageError) {
      console.warn('Ошибка при чтении из sessionStorage:', storageError);
    }
    
    // Если кеш недоступен, пробрасываем ошибку дальше
    throw error;
  }
};

/**
 * Расчет расстояния между точками трека
 * @param {Array} trackPoints - Массив точек трека
 * @returns {number} Расстояние в километрах
 */
export const calculateTripDistance = (trackPoints) => {
  if (!trackPoints || !Array.isArray(trackPoints) || trackPoints.length <= 1) {
    return 0;
  }
  
  let distance = 0;
  for (let i = 1; i < trackPoints.length; i++) {
    const p1 = trackPoints[i-1];
    const p2 = trackPoints[i];
    
    if (!p1.latitude || !p1.longitude || !p2.latitude || !p2.longitude) {
      continue;
    }
    
    distance += getDistanceFromLatLonInKm(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
  }
  
  return distance;
};

/**
 * Расчет расстояния между двумя точками по координатам
 * @param {number} lat1 - Широта первой точки
 * @param {number} lon1 - Долгота первой точки
 * @param {number} lat2 - Широта второй точки
 * @param {number} lon2 - Долгота второй точки
 * @returns {number} Расстояние в километрах
 */
export const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Радиус Земли в км
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const d = R * c; // Расстояние в км
  return d;
};

/**
 * Перевод градусов в радианы
 * @param {number} deg - Значение в градусах
 * @returns {number} Значение в радианах
 */
export const deg2rad = (deg) => {
  return deg * (Math.PI/180);
};

/**
 * Получение статистики по треку
 * @param {Array} trackPoints - Массив точек трека
 * @returns {Object} Объект со статистикой (расстояние, средняя скорость, максимальная скорость, время в пути)
 */
export const getTrackStatistics = (trackPoints) => {
  if (!trackPoints || !Array.isArray(trackPoints) || trackPoints.length === 0) {
    return {
      distance: 0,
      avgSpeed: 0,
      maxSpeed: 0,
      duration: 0,
      startTime: null,
      endTime: null
    };
  }
  
  const distance = calculateTripDistance(trackPoints);
  
  // Рассчитываем среднюю и максимальную скорость
  let totalSpeed = 0;
  let maxSpeed = 0;
  let speedPointsCount = 0;
  
  trackPoints.forEach(point => {
    if (point.speed !== undefined && point.speed !== null && point.speed > 0) {
      totalSpeed += point.speed;
      speedPointsCount++;
      
      if (point.speed > maxSpeed) {
        maxSpeed = point.speed;
      }
    }
  });
  
  const avgSpeed = speedPointsCount > 0 ? totalSpeed / speedPointsCount : 0;
  
  // Рассчитываем время в пути
  const startTime = trackPoints[0].timestamp;
  const endTime = trackPoints[trackPoints.length - 1].timestamp;
  
  // Продолжительность в миллисекундах, затем переводим в минуты
  const duration = (endTime - startTime) / (60 * 1000);
  
  return {
    distance,
    avgSpeed,
    maxSpeed,
    duration,
    startTime,
    endTime
  };
};

export default {
  fetchTrackData,
  calculateTripDistance,
  getDistanceFromLatLonInKm,
  getTrackStatistics
}; 