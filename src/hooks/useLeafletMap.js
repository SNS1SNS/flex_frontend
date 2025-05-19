import { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Импортируем иконки Leaflet для маркеров (корректируем пути к иконкам)
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

// Устанавливаем пути к иконкам маркеров для Leaflet (только один раз)
if (typeof window !== 'undefined' && !window.__leafletIconsFixed) {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl,
    iconUrl,
    shadowUrl
  });
  window.__leafletIconsFixed = true;
}

/**
 * Создание пользовательских иконок для начала и конца трека
 */
const startIcon = new L.Icon({
  iconUrl: iconUrl,
  iconRetinaUrl: iconRetinaUrl,
  shadowUrl: shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: 'track-start-marker' // Добавляем класс для кастомизации через CSS
});

const endIcon = new L.Icon({
  iconUrl: iconUrl,
  iconRetinaUrl: iconRetinaUrl,
  shadowUrl: shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: 'track-end-marker' // Добавляем класс для кастомизации через CSS
});

/**
 * Хук для работы с картой Leaflet
 * 
 * @param {Object} options - Опции инициализации карты
 * @param {string} options.containerId - ID контейнера для карты
 * @param {Array} options.initialCenter - Начальный центр карты [lat, lng]
 * @param {number} options.initialZoom - Начальный зум карты
 * @param {string} options.tileLayerUrl - URL для тайлов карты
 * @param {Object} options.tileLayerOptions - Опции для тайлового слоя
 * @returns {Object} Объект с методами и состояниями карты
 */
const useLeafletMap = (options = {}) => {
  const {
    containerId = 'map',
    initialCenter = [43.238949, 76.889709], // Центр Алматы по умолчанию
    initialZoom = 13,
    tileLayerUrl = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    tileLayerOptions = {
      attribution: '© Google',
      maxZoom: 20
    }
  } = options;

  const [isMapInitialized, setIsMapInitialized] = useState(false);
  const [currentTrackData, setCurrentTrackData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Ссылки на объекты Leaflet
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const routePathRef = useRef(null);
  const animatedMarkerRef = useRef(null);
  const playbackIntervalRef = useRef(null);
  const currentPointIndexRef = useRef(0);
  
  /**
   * Инициализация карты
   * 
   * @returns {boolean} Успешность инициализации
   */
  const initializeMap = useCallback(() => {
    if (isMapInitialized || !containerId) {
      return false;
    }
    
    try {
      console.log(`Инициализация карты в контейнере #${containerId}...`);
      
      // Проверяем наличие контейнера
      const mapElement = document.getElementById(containerId);
      if (!mapElement) {
        console.error(`Элемент с ID ${containerId} не найден`);
        setError(`Контейнер карты #${containerId} не найден`);
        return false;
      }
      
      // Если карта уже инициализирована, уничтожаем её для повторной инициализации
      if (mapRef.current) {
        console.log('Уничтожаем существующую карту перед повторной инициализацией');
        mapRef.current.remove();
        mapRef.current = null;
      }
      
      // Инициализируем карту с защитой от ошибок
      try {
        // Инициализируем карту Leaflet с обработкой ошибок
        const map = L.map(containerId, {
          center: initialCenter,
          zoom: initialZoom,
          layers: [
            L.tileLayer(tileLayerUrl, tileLayerOptions)
          ],
          // Предотвращаем зависание анимации при скрытых вкладках
          fadeAnimation: false,
          zoomAnimation: false
        });
        
        // Сохраняем экземпляр карты в ref
        mapRef.current = map;
        
        // Добавляем обработчик события изменения размера с защитой от ошибок
        map.on('resize', () => {
          try {
            console.log('Изменение размера карты');
            if (map && map._container && document.body.contains(map._container)) {
              map.invalidateSize();
            }
          } catch (error) {
            console.error('Ошибка при изменении размера карты:', error);
          }
        });
        
        // Защита от ошибок при масштабировании
        map.on('zoom', () => {
          if (map && !map._animatingZoom && map._mapPane && map._mapPane.offsetWidth === 0) {
            // Если карта невидима или размер равен 0, сбрасываем анимацию
            map._resetView(map.getCenter(), map.getZoom(), true);
          }
        });
        
        // Устанавливаем флаг инициализации
        setIsMapInitialized(true);
        
        console.log('Карта успешно инициализирована');
        
        return true;
      } catch (error) {
        console.error('Ошибка при инициализации карты:', error);
        setError(`Ошибка при инициализации карты: ${error.message}`);
        return false;
      }
    } catch (error) {
      console.error('Непредвиденная ошибка при инициализации карты:', error);
      setError(`Непредвиденная ошибка: ${error.message}`);
      return false;
    }
  }, [containerId, initialCenter, initialZoom, tileLayerUrl, tileLayerOptions, isMapInitialized]);

  /**
   * Очистка карты от всех маркеров и линий
   */
  const clearMap = useCallback(() => {
    if (!mapRef.current) return;
    
    try {
      // Очистка маркеров
      if (markersRef.current.length > 0) {
        markersRef.current.forEach(marker => {
          if (mapRef.current) {
            mapRef.current.removeLayer(marker);
          }
        });
        markersRef.current = [];
      }
      
      // Очистка линии маршрута
      if (routePathRef.current) {
        mapRef.current.removeLayer(routePathRef.current);
        routePathRef.current = null;
      }
      
      // Очистка анимированного маркера
      if (animatedMarkerRef.current) {
        mapRef.current.removeLayer(animatedMarkerRef.current);
        animatedMarkerRef.current = null;
      }
      
      // Остановка воспроизведения, если оно активно
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }
      
      // Сброс индекса текущей точки
      currentPointIndexRef.current = 0;
    } catch (error) {
      console.error('Ошибка при очистке карты:', error);
    }
  }, []);

  /**
   * Обновление размера карты
   */
  const updateMapSize = useCallback(() => {
    if (!mapRef.current) return;
    
    try {
      // Проверяем, что контейнер карты существует и видим
      if (mapRef.current._container && 
          document.body.contains(mapRef.current._container) &&
          mapRef.current._container.offsetWidth > 0 &&
          mapRef.current._container.offsetHeight > 0) {
          
        // Принудительно обновляем размер карты
        mapRef.current.invalidateSize({animate: false});
        
        // Если есть данные трека, обновляем область просмотра
        if (currentTrackData.length > 0) {
          updateMapView();
        }
      } else {
        console.warn('Контейнер карты невидим или имеет нулевой размер');
      }
    } catch (error) {
      console.error('Ошибка при обновлении размера карты:', error);
    }
  }, [currentTrackData]);

  /**
   * Обновление области просмотра карты по точкам трека
   */
  const updateMapView = useCallback(() => {
    if (!mapRef.current || currentTrackData.length === 0) return;
    
    try {
      // Проверяем, что карта и её контейнер все еще существуют
      if (!mapRef.current._container || !document.body.contains(mapRef.current._container)) {
        console.warn('Контейнер карты не найден при обновлении представления');
        return;
      }
      
      // Центрирование карты по всем точкам маршрута
      console.log('Центрирование карты по маршруту');
      
      const routePoints = currentTrackData.map(point => [point.latitude, point.longitude]);
      const bounds = L.latLngBounds(routePoints);
      
      // Устанавливаем границы с небольшим отступом и отключаем анимацию для надежности
      mapRef.current.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 15,
        animate: false // Отключаем анимацию для предотвращения ошибок
      });
    } catch (error) {
      console.error('Ошибка при обновлении представления карты:', error);
    }
  }, [currentTrackData]);

  /**
   * Отрисовка трека на карте
   * 
   * @param {Array} trackData - Массив точек трека
   */
  const renderTrack = useCallback((trackData) => {
    if (!mapRef.current || !trackData || trackData.length === 0) {
      setCurrentTrackData([]);
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Сначала очищаем карту
      clearMap();
      
      // Сохраняем данные трека
      setCurrentTrackData(trackData);
      
      // Создаем массив точек для линии маршрута
      const routePoints = trackData.map(point => [point.latitude, point.longitude]);
      
      // Создаем линию маршрута
      const routePath = L.polyline(routePoints, {
        color: '#4e73df',
        weight: 4,
        opacity: 0.8,
        lineJoin: 'round'
      });
      
      // Добавляем линию на карту
      routePath.addTo(mapRef.current);
      routePathRef.current = routePath;
      
      // Добавляем маркеры начала и конца трека
      if (trackData.length > 0) {
        // Маркер начала трека
        const startPoint = trackData[0];
        const startMarker = L.marker([startPoint.latitude, startPoint.longitude], { icon: startIcon })
          .addTo(mapRef.current)
          .bindPopup(`<strong>Начало трека</strong><br>
                     Дата: ${formatDate(startPoint.timestamp)}<br>
                     Скорость: ${startPoint.speed} км/ч`)
          .on('click', () => {
            // Обновляем индекс через ref
            currentPointIndexRef.current = 0;
            updateAnimatedMarker(0);
          });
        
        // Маркер конца трека
        const endPoint = trackData[trackData.length - 1];
        const endMarker = L.marker([endPoint.latitude, endPoint.longitude], { icon: endIcon })
          .addTo(mapRef.current)
          .bindPopup(`<strong>Конец трека</strong><br>
                     Дата: ${formatDate(endPoint.timestamp)}<br>
                     Скорость: ${endPoint.speed} км/ч`)
          .on('click', () => {
            // Обновляем индекс через ref
            currentPointIndexRef.current = trackData.length - 1;
            updateAnimatedMarker(trackData.length - 1);
          });
        
        // Добавляем маркеры в массив для возможности дальнейшего управления
        markersRef.current.push(startMarker, endMarker);
        
        // Создаем анимированный маркер для воспроизведения трека
        const animatedMarker = L.marker([startPoint.latitude, startPoint.longitude])
          .addTo(mapRef.current)
          .bindPopup(`<strong>Транспорт</strong><br>
                     Дата: ${formatDate(startPoint.timestamp)}<br>
                     Скорость: ${startPoint.speed} км/ч`);
        
        animatedMarkerRef.current = animatedMarker;
      }
      
      // Отображаем весь трек на карте
      updateMapView();
      
      console.log('Маршрут успешно отрисован на карте');
    } catch (error) {
      console.error('Ошибка при отрисовке трека на карте:', error);
      setError(`Ошибка при отрисовке трека: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [clearMap, updateMapView]);

  /**
   * Обновление положения анимированного маркера
   * 
   * @param {number} index - Индекс точки в массиве данных трека
   */
  const updateAnimatedMarker = useCallback((index) => {
    if (!animatedMarkerRef.current || !currentTrackData[index]) return;
    
    try {
      const point = currentTrackData[index];
      const position = [point.latitude, point.longitude];
      
      // Обновляем позицию маркера
      animatedMarkerRef.current.setLatLng(position);
      
      // Формируем информацию для всплывающего окна
      let popupContent = `
        <strong>Транспорт</strong><br>
        Дата: ${formatDate(point.timestamp)}<br>
        Скорость: ${point.speed} км/ч
      `;
      
      // Добавляем дополнительную информацию, если она доступна
      if (point.altitude) {
        popupContent += `<br>Высота: ${point.altitude} м`;
      }
      
      if (point.course) {
        popupContent += `<br>Курс: ${point.course}°`;
      }
      
      if (point.satellites) {
        popupContent += `<br>Спутники: ${point.satellites}`;
      }
      
      if (point.fuel !== undefined) {
        popupContent += `<br>Топливо: ${point.fuel}%`;
      }
      
      // Обновляем содержимое всплывающего окна
      animatedMarkerRef.current.setPopupContent(popupContent);
      
      // Если открыт popup, обновляем его
      if (animatedMarkerRef.current.isPopupOpen()) {
        animatedMarkerRef.current.getPopup().update();
      }
    } catch (error) {
      console.error('Ошибка при обновлении анимированного маркера:', error);
    }
  }, [currentTrackData]);

  /**
   * Запуск воспроизведения перемещения маркера по треку
   * 
   * @param {number} speedFactor - Коэффициент скорости воспроизведения
   */
  const startPlayback = useCallback((speedFactor = 1) => {
    if (!mapRef.current || currentTrackData.length === 0) return;
    
    // Останавливаем текущее воспроизведение, если оно запущено
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
    
    // Если текущий индекс находится в конце трека, сбрасываем его
    if (currentPointIndexRef.current >= currentTrackData.length - 1) {
      currentPointIndexRef.current = 0;
    }
    
    // Обновляем позицию маркера
    updateAnimatedMarker(currentPointIndexRef.current);
    
    // Запускаем интервал для перемещения маркера
    playbackIntervalRef.current = setInterval(() => {
      // Увеличиваем индекс
      currentPointIndexRef.current++;
      
      // Если достигли конца трека, останавливаем воспроизведение
      if (currentPointIndexRef.current >= currentTrackData.length) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
        return;
      }
      
      // Обновляем позицию маркера
      updateAnimatedMarker(currentPointIndexRef.current);
    }, 1000 / speedFactor); // Интервал обновления в миллисекундах
    
    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }
    };
  }, [currentTrackData, updateAnimatedMarker]);

  /**
   * Остановка воспроизведения
   */
  const stopPlayback = useCallback(() => {
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
  }, []);

  /**
   * Форматирование даты для отображения
   * 
   * @param {Date} timestamp - Дата для форматирования
   * @returns {string} Отформатированная строка даты
   */
  const formatDate = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } catch (e) {
      return 'Invalid Date';
    }
  };

  /**
   * Перемещение маркера на определенную точку трека
   * 
   * @param {number} index - Индекс точки в массиве данных трека
   */
  const moveMarkerToPoint = useCallback((index) => {
    if (index < 0 || index >= currentTrackData.length) return;
    
    // Останавливаем воспроизведение, если оно запущено
    stopPlayback();
    
    // Обновляем индекс текущей точки
    currentPointIndexRef.current = index;
    
    // Обновляем позицию маркера
    updateAnimatedMarker(index);
  }, [currentTrackData, stopPlayback, updateAnimatedMarker]);

  /**
   * Получение текущего состояния воспроизведения
   * 
   * @returns {boolean} Активно ли воспроизведение
   */
  const isPlaying = useCallback(() => {
    return !!playbackIntervalRef.current;
  }, []);

  /**
   * Получение информации о текущей точке
   * 
   * @returns {Object|null} Информация о текущей точке или null, если нет данных
   */
  const getCurrentPointInfo = useCallback(() => {
    if (currentTrackData.length === 0 || 
        currentPointIndexRef.current < 0 || 
        currentPointIndexRef.current >= currentTrackData.length) {
      return null;
    }
    
    return currentTrackData[currentPointIndexRef.current];
  }, [currentTrackData]);

  /**
   * Переключение воспроизведения (старт/стоп)
   * 
   * @param {number} speedFactor - Коэффициент скорости воспроизведения
   * @returns {boolean} Новое состояние воспроизведения (true - воспроизводится)
   */
  const togglePlayback = useCallback((speedFactor = 1) => {
    if (isPlaying()) {
      stopPlayback();
      return false;
    } else {
      startPlayback(speedFactor);
      return true;
    }
  }, [isPlaying, stopPlayback, startPlayback]);

  /**
   * Перемещение к началу трека
   */
  const moveToStart = useCallback(() => {
    moveMarkerToPoint(0);
  }, [moveMarkerToPoint]);

  /**
   * Перемещение к концу трека
   */
  const moveToEnd = useCallback(() => {
    moveMarkerToPoint(currentTrackData.length - 1);
  }, [moveMarkerToPoint, currentTrackData]);

  /**
   * Добавление маркера на карту
   * 
   * @param {number} lat - Широта
   * @param {number} lng - Долгота
   * @param {Object} options - Опции маркера
   * @param {string} popupContent - Содержимое всплывающего окна
   * @returns {Object} Объект маркера
   */
  const addMarker = useCallback((lat, lng, options = {}, popupContent = '') => {
    if (!mapRef.current) return null;
    
    try {
      const marker = L.marker([lat, lng], options).addTo(mapRef.current);
      
      if (popupContent) {
        marker.bindPopup(popupContent);
      }
      
      // Добавляем маркер в массив для возможности дальнейшего управления
      markersRef.current.push(marker);
      
      return marker;
    } catch (error) {
      console.error('Ошибка при добавлении маркера:', error);
      return null;
    }
  }, []);

  /**
   * Добавление полилинии на карту
   * 
   * @param {Array} points - Массив точек для линии [[lat1, lng1], [lat2, lng2], ...]
   * @param {Object} options - Опции полилинии
   * @returns {Object} Объект полилинии
   */
  const addPolyline = useCallback((points, options = {}) => {
    if (!mapRef.current) return null;
    
    const defaultOptions = {
      color: '#3388ff',
      weight: 3,
      opacity: 0.7
    };
    
    try {
      const polyline = L.polyline(points, { ...defaultOptions, ...options }).addTo(mapRef.current);
      return polyline;
    } catch (error) {
      console.error('Ошибка при добавлении полилинии:', error);
      return null;
    }
  }, []);

  /**
   * Очистка ресурсов при размонтировании
   */
  useEffect(() => {
    return () => {
      // Остановка воспроизведения при размонтировании
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }
      
      // Более надежная очистка карты при размонтировании
      try {
        if (mapRef.current) {
          // Удаляем все обработчики событий
          mapRef.current.off();
          // Удаляем все слои
          mapRef.current.eachLayer(layer => {
            mapRef.current.removeLayer(layer);
          });
          // Уничтожаем карту
          mapRef.current.remove();
          mapRef.current = null;
        }
      } catch (error) {
        console.error('Ошибка при уничтожении карты:', error);
      }
    };
  }, []);

  // Возвращаем API для работы с картой
  return {
    // Состояния
    isMapInitialized,
    mapInstance: mapRef.current,
    currentTrackData,
    isLoading,
    error,
    currentPointIndex: currentPointIndexRef.current,
    
    // Методы инициализации и обновления карты
    initializeMap,
    clearMap,
    updateMapSize,
    updateMapView,
    
    // Методы работы с треком
    renderTrack,
    getCurrentPointInfo,
    
    // Методы воспроизведения трека
    startPlayback,
    stopPlayback,
    isPlaying,
    togglePlayback,
    moveMarkerToPoint,
    moveToStart,
    moveToEnd,
    
    // Методы добавления объектов на карту
    addMarker,
    addPolyline
  };
};

export default useLeafletMap; 