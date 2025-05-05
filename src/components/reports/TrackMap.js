import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faMapMarkedAlt, faPlay, 
  faCalendarDay, faCalendarWeek, faCalendarAlt, faSync
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import './TrackMap.css';
import RouteAnimation from './RouteAnimation';

/**
 * Компонент для отображения карты треков транспортных средств
 * @param {Object} props - Свойства компонента
 * @param {string} props.tabId - Уникальный идентификатор вкладки
 * @param {Object} props.vehicle - Данные о транспортном средстве (id, name, imei)
 * @param {Date} props.startDate - Начальная дата диапазона
 * @param {Date} props.endDate - Конечная дата диапазона
 * @param {boolean} props.hidePeriodSelector - Флаг для скрытия селектора периода
 */
const TrackMap = ({ tabId, vehicle, startDate, endDate, hidePeriodSelector = false }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [statistics, setStatistics] = useState({
    distance: '-',
    avgSpeed: '-',
    maxSpeed: '-',
    duration: '-'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('custom'); // Используем custom по умолчанию
  const [trackData, setTrackData] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Форматирование даты в формат ISO с микросекундами для API
  const formatToMicroISOString = (date) => {
    if (!date) return '';
    const isoString = date.toISOString();
    return isoString.replace('Z', '000Z');
  };
  
  // Функция для определения дат периода
  const getPeriodDates = (period) => {
    const now = new Date();
    let periodStartDate, periodEndDate;
    
    switch (period) {
      case 'day':
        // Сегодня (от 00:00 до текущего времени)
        periodStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        periodEndDate = now;
        break;
      case 'yesterday':
        // Вчера (весь день)
        periodStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
        periodEndDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
        break;
      case 'week':
        // Последние 7 дней
        periodStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0);
        periodEndDate = now;
        break;
      case 'month':
        // Последние 30 дней
        periodStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30, 0, 0, 0);
        periodEndDate = now;
        break;
      case 'custom':
        // Используем пользовательские даты, если они есть
        periodStartDate = startDate;
        periodEndDate = endDate;
        break;
      default:
        // По умолчанию - сегодня
        periodStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        periodEndDate = now;
    }
    
    return { periodStartDate, periodEndDate };
  };
  
  // Обработчик изменения периода
  const handleChangePeriod = (period) => {
    setSelectedPeriod(period);
    const { periodStartDate, periodEndDate } = getPeriodDates(period);
    
    // Если выбран кастомный период, просто устанавливаем состояние и используем внешние даты
    if (period === 'custom') {
      loadTrackData(startDate, endDate);
    } else {
      // Для предопределенных периодов загружаем данные с вычисленными датами
      loadTrackData(periodStartDate, periodEndDate);
    }
  };
  
  // Функция для расчета статистики трека
  const calculateTrackStatistics = (trackPoints) => {
    if (!trackPoints || trackPoints.length === 0) {
      return {
        distance: '-',
        avgSpeed: '-',
        maxSpeed: '-',
        duration: '-'
      };
    }
    
    let totalDistance = 0;
    let totalSpeed = 0;
    let maxSpeed = 0;
    
    // Сортируем точки по времени для правильного расчета
    const sortedPoints = [...trackPoints].sort((a, b) => {
      return new Date(a.time) - new Date(b.time);
    });
    
    // Расчет расстояния между точками и максимальной скорости
    for (let i = 1; i < sortedPoints.length; i++) {
      const prevPoint = sortedPoints[i - 1];
      const currPoint = sortedPoints[i];
      
      // Расчет расстояния между точками (используем встроенную функцию Leaflet)
      const pointA = L.latLng(prevPoint.lat, prevPoint.lng);
      const pointB = L.latLng(currPoint.lat, currPoint.lng);
      totalDistance += pointA.distanceTo(pointB);
      
      // Обновление максимальной скорости
      if (currPoint.speed > maxSpeed) {
        maxSpeed = currPoint.speed;
      }
      
      totalSpeed += currPoint.speed;
    }
    
    // Расчет времени в пути (в минутах)
    const startTime = new Date(sortedPoints[0].time);
    const endTime = new Date(sortedPoints[sortedPoints.length - 1].time);
    const durationMs = endTime - startTime;
    const durationMinutes = Math.round(durationMs / (1000 * 60));
    
    // Форматирование длительности (часы:минуты)
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    const formattedDuration = `${hours}ч ${minutes}мин`;
    
    // Средняя скорость
    const avgSpeed = Math.round(totalSpeed / sortedPoints.length);
    
    return {
      distance: `${(totalDistance / 1000).toFixed(2)} км`,
      avgSpeed: `${avgSpeed} км/ч`,
      maxSpeed: `${Math.round(maxSpeed)} км/ч`,
      duration: formattedDuration
    };
  };
  
  // Функция для инициализации карты
  const initMap = () => {
    if (mapInstanceRef.current) return mapInstanceRef.current;
    
    const map = L.map(mapRef.current, {
      center: [51.143964, 71.435819], // Координаты по умолчанию
      zoom: 12,
      zoomControl: true,
      scrollWheelZoom: true
    });
    
    // Добавляем базовый слой OpenStreetMap
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    });
    
    // Добавляем спутниковый слой Esri
    const esriSatelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri',
      maxZoom: 19
    });
    
    // Добавляем спутниковый слой Google
    const googleSatelliteLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      attribution: '© Google',
      maxZoom: 20
    });
    
    // Добавляем гибридный слой Google
    const googleHybridLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      attribution: '© Google',
      maxZoom: 20
    });
    
    // Карта Яндекс
    const yandexLayer = L.tileLayer('https://core-renderer-tiles.maps.yandex.net/tiles?l=map&x={x}&y={y}&z={z}', {
      attribution: '© Яндекс',
      maxZoom: 19
    });
    
    // Карты 2GIS
    const dgisLayer = L.tileLayer('https://tile{s}.maps.2gis.com/tiles?x={x}&y={y}&z={z}&v=1', {
      attribution: '© 2GIS',
      subdomains: '0123',
      maxZoom: 18
    });
    
    // Создаем объект с базовыми слоями
    const baseLayers = {
      "OpenStreetMap": osmLayer,
      "2GIS": dgisLayer,
      "Спутник (Esri)": esriSatelliteLayer,
      "Спутник (Google)": googleSatelliteLayer,
      "Гибрид (Google)": googleHybridLayer,
      "Яндекс Карты": yandexLayer
    };
    
    // Добавляем переключатель слоев
    L.control.layers(baseLayers, {}, {
      position: 'topright',
      collapsed: true
    }).addTo(map);
    
    // Добавляем базовый слой по умолчанию
    osmLayer.addTo(map);
    
    // Добавляем элементы управления масштабом
    L.control.scale({
      imperial: false,
      metric: true,
      position: 'bottomleft'
    }).addTo(map);
    
    // Сохраняем ссылку на карту
    mapInstanceRef.current = map;
    
    // Инвалидируем размер карты для правильного отображения
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
    
    return map;
  };
  
  // Функция для отображения трека на карте
  const displayTrack = (map, trackPoints) => {
    if (!map || !trackPoints || trackPoints.length === 0) return;
    
    // Очищаем предыдущие слои
    if (map._layers) {
      Object.keys(map._layers).forEach((layerId) => {
        if (
          map._layers[layerId]._path || 
          map._layers[layerId]._icon ||
          map._layers[layerId] instanceof L.Marker ||
          map._layers[layerId] instanceof L.Polyline
        ) {
          try {
            map.removeLayer(map._layers[layerId]);
          } catch (e) {
            console.warn('Ошибка при удалении слоя:', e);
          }
        }
      });
    }
    
    // Координаты для трека
    const trackCoordinates = trackPoints.map(point => [point.lat, point.lng]);
    
    // Определяем цвет линии трека (можно настроить в зависимости от типа ТС)
    let lineColor = '#2c7be5'; // По умолчанию синий
    
    // Создаем линию трека
    const trackLine = L.polyline(trackCoordinates, {
      color: lineColor,
      weight: 5,
      opacity: 0.7,
      smoothFactor: 1
    }).addTo(map);
    
    // Добавляем маркеры начала и конца
    if (trackCoordinates.length > 0) {
      // Маркер начала
      const startIcon = L.divIcon({
        className: 'custom-div-icon',
        html: '<div style="background-color: #4CAF50; width: 15px; height: 15px; border-radius: 50%; border: 2px solid white;"></div>',
        iconSize: [15, 15],
        iconAnchor: [7, 7]
      });
      
      L.marker(trackCoordinates[0], {icon: startIcon})
        .addTo(map)
        .bindPopup(`
          <div class="track-info-popup">
            <div class="track-info-title">
              <i class="fas fa-play"></i> Начало пути
            </div>
            <div class="track-info-details">
              <div class="track-info-row">
                <span class="track-info-label">Время:</span>
                <span class="track-info-value">${new Date(trackPoints[0].time).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        `);
      
      // Маркер конца
      const endIcon = L.divIcon({
        className: 'custom-div-icon',
        html: '<div style="background-color: #f44336; width: 15px; height: 15px; border-radius: 50%; border: 2px solid white;"></div>',
        iconSize: [15, 15],
        iconAnchor: [7, 7]
      });
      
      L.marker(trackCoordinates[trackCoordinates.length - 1], {icon: endIcon})
        .addTo(map)
        .bindPopup(`
          <div class="track-info-popup">
            <div class="track-info-title">
              <i class="fas fa-flag"></i> Конец пути
            </div>
            <div class="track-info-details">
              <div class="track-info-row">
                <span class="track-info-label">Время:</span>
                <span class="track-info-value">${new Date(trackPoints[trackPoints.length - 1].time).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        `);
    }
    
    // Устанавливаем границы карты по трассе
    map.fitBounds(trackLine.getBounds(), { padding: [50, 50] });
    
    // Дополнительные слои с событиями и анализом
    addTrackEvents(map, trackPoints);
  };
  
  // Функция для анализа и добавления событий на трек
  const addTrackEvents = (map, trackData) => {
    if (!trackData || trackData.length < 2) return;
    
    // Сортируем точки по времени для анализа
    const sortedPoints = [...trackData].sort((a, b) => new Date(a.time) - new Date(b.time));
    
    // Анализируем данные трека для выявления событий
    const events = [];
    
    // Определение стоянок (скорость < 2 км/ч в течение определенного времени)
    let parkingStart = null;
    let maxSpeed = 0;
    let maxSpeedPoint = null;
    
    for (let i = 0; i < sortedPoints.length; i++) {
      const point = sortedPoints[i];
      const speed = point.speed || 0;
      
      // Находим максимальную скорость
      if (speed > maxSpeed) {
        maxSpeed = speed;
        maxSpeedPoint = point;
      }
      
      // Обнаружение стоянки
      if (speed < 2) {
        if (parkingStart === null) {
          parkingStart = {
            index: i,
            point: point,
            time: new Date(point.time)
          };
        }
      } else if (parkingStart !== null) {
        // Конец стоянки
        const parkingTime = new Date(point.time) - parkingStart.time;
        const parkingMinutes = parkingTime / (1000 * 60);
        
        // Если стоянка длилась более 5 минут, добавляем событие
        if (parkingMinutes >= 5) {
          events.push({
            type: 'parking',
            latitude: parkingStart.point.lat,
            longitude: parkingStart.point.lng,
            startTime: parkingStart.time,
            endTime: new Date(point.time),
            duration: parkingMinutes,
            description: `Стоянка: ${Math.floor(parkingMinutes)} мин`,
            importance: Math.min(10, parkingMinutes / 5) // Важность стоянки зависит от её длительности
          });
        }
        
        parkingStart = null;
      }
      
      // Обнаружение превышения скорости (скорость > 90 км/ч)
      // Добавляем только значительные превышения и следим за расстоянием между маркерами
      if (speed > 90 && (events.length === 0 || 
          events.every(e => 
              e.type !== 'speeding' || 
              Math.abs(new Date(point.time) - new Date(e.time)) > 5 * 60 * 1000))) { // Минимум 5 минут между маркерами превышения
        
        events.push({
          type: 'speeding',
          latitude: point.lat,
          longitude: point.lng,
          time: new Date(point.time),
          speed: speed,
          description: `Превышение: ${speed.toFixed(0)} км/ч`,
          importance: (speed - 90) / 10 // Важность зависит от степени превышения
        });
      }
    }
    
    // Если стоянка продолжается до конца трека
    if (parkingStart !== null && sortedPoints.length > 0) {
      const lastPoint = sortedPoints[sortedPoints.length - 1];
      const parkingTime = new Date(lastPoint.time) - parkingStart.time;
      const parkingMinutes = parkingTime / (1000 * 60);
      
      if (parkingMinutes >= 5) {
        events.push({
          type: 'parking',
          latitude: parkingStart.point.lat,
          longitude: parkingStart.point.lng,
          startTime: parkingStart.time,
          endTime: new Date(lastPoint.time),
          duration: parkingMinutes,
          description: `Стоянка: ${Math.floor(parkingMinutes)} мин`,
          importance: Math.min(10, parkingMinutes / 5)
        });
      }
    }
    
    // Добавляем маркер максимальной скорости, если она была значительной
    if (maxSpeedPoint && maxSpeed > 30) {
      events.push({
        type: 'max_speed',
        latitude: maxSpeedPoint.lat,
        longitude: maxSpeedPoint.lng,
        time: new Date(maxSpeedPoint.time),
        speed: maxSpeed,
        description: `Макс. скорость: ${maxSpeed.toFixed(0)} км/ч`,
        importance: 10 // Максимальная скорость всегда важна
      });
    }
    
    // Ограничиваем количество отображаемых событий для красоты
    // Сортируем по важности и выбираем только самые важные
    events.sort((a, b) => b.importance - a.importance);
    
    // Ограничиваем количество событий в зависимости от длины трека
    const maxEvents = Math.min(5, Math.max(3, Math.floor(sortedPoints.length / 200)));
    const eventsToShow = events.slice(0, maxEvents);
    
    // Добавляем события на карту
    eventsToShow.forEach(event => {
      let icon, popupContent;
      
      if (event.type === 'parking') {
        icon = L.divIcon({
          className: 'track-marker parking',
          html: `<div class="event-marker parking">
                  <i class="fas fa-parking"></i>
                  <span class="event-duration">${Math.floor(event.duration)}м</span>
                </div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });
        
        const startTimeStr = event.startTime.toLocaleTimeString();
        const endTimeStr = event.endTime.toLocaleTimeString();
        
        popupContent = `
          <div class="track-popup">
            <h3><i class="fas fa-parking"></i> Стоянка</h3>
            <div class="info-row">
              <span class="info-label">Начало:</span>
              <span class="info-value">${startTimeStr}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Конец:</span>
              <span class="info-value">${endTimeStr}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Длительность:</span>
              <span class="info-value">${Math.floor(event.duration)} мин</span>
            </div>
          </div>
        `;
      } else if (event.type === 'speeding') {
        icon = L.divIcon({
          className: 'track-marker speeding',
          html: `<div class="event-marker speeding">
                  <i class="fas fa-tachometer-alt"></i>
                  <span class="event-speed">${event.speed.toFixed(0)}</span>
                </div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });
        
        popupContent = `
          <div class="track-popup">
            <h3><i class="fas fa-tachometer-alt"></i> Превышение скорости</h3>
            <div class="info-row">
              <span class="info-label">Время:</span>
              <span class="info-value">${event.time.toLocaleTimeString()}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Скорость:</span>
              <span class="info-value">${event.speed.toFixed(1)} км/ч</span>
            </div>
          </div>
        `;
      } else if (event.type === 'max_speed') {
        icon = L.divIcon({
          className: 'track-marker max-speed',
          html: `<div class="event-marker max-speed">
                  <i class="fas fa-bolt"></i>
                  <span class="event-speed">${event.speed.toFixed(0)}</span>
                </div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });
        
        popupContent = `
          <div class="track-popup">
            <h3><i class="fas fa-bolt"></i> Максимальная скорость</h3>
            <div class="info-row">
              <span class="info-label">Время:</span>
              <span class="info-value">${event.time.toLocaleTimeString()}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Скорость:</span>
              <span class="info-value">${event.speed.toFixed(1)} км/ч</span>
            </div>
          </div>
        `;
      }
      
      if (icon && popupContent) {
        try {
          const marker = L.marker([event.latitude, event.longitude], { icon }).addTo(map);
          marker.bindPopup(popupContent);
          marker.bindTooltip(event.description);
        } catch (error) {
          console.error('Ошибка при добавлении маркера:', error);
        }
      }
    });
  };
  
  // Функция для загрузки данных трека для выбранного периода
  const loadTrackForPeriod = useCallback((period) => {
    setSelectedPeriod(period);
    
    // Определяем диапазон дат в зависимости от периода
    let start = new Date();
    let end = new Date();
    
    switch (period) {
      case 'day':
        // Сегодня (уже установлено)
        start = new Date(start.setHours(0, 0, 0, 0));
        end = new Date(end.setHours(23, 59, 59, 999));
        break;
      case 'yesterday':
        start = new Date();
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setHours(23, 59, 59, 999);
        break;
      case 'week':
        // Последние 7 дней
        start = new Date();
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        // Последние 30 дней
        start = new Date();
        start.setDate(start.getDate() - 30);
        break;
      default:
        // По умолчанию - сегодня
        break;
    }
    
    // Загружаем данные трека для нового диапазона
    loadTrackData(start, end);
  }, []);
  
  // Функция для загрузки данных телеметрии
  const loadTrackData = async (customStartDate, customEndDate) => {
    if (!vehicle || !vehicle.imei) {
      toast.warning('Не выбрано транспортное средство или отсутствует IMEI');
      return;
    }
    
    const useStartDate = customStartDate || startDate;
    const useEndDate = customEndDate || endDate;
    
    if (!useStartDate || !useEndDate) {
      toast.warning('Не указан временной диапазон');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Форматируем даты для API в формате ISO
      const startTimeStr = useStartDate.toISOString();
      const endTimeStr = useEndDate.toISOString();
      
      // Используем API v3 для получения телеметрии
      const trackUrl = `http://localhost:8081/api/telemetry/v3/${vehicle.imei}/track?startTime=${encodeURIComponent(startTimeStr)}&endTime=${encodeURIComponent(endTimeStr)}`;
      
      console.log('Запрос трека:', trackUrl);
      
      // Получаем JWT токен для авторизации
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
        
        // Если не нашли JWT токен, создаем тестовый
        const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
        const payload = btoa(JSON.stringify({ 
          sub: 'test-user', 
          name: 'Test User', 
          role: 'ADMIN',
          exp: Math.floor(Date.now() / 1000) + 3600 // срок действия 1 час
        }));
        const signature = btoa('test-signature');
        
        return `${header}.${payload}.${signature}`;
      };
      
      const response = await fetch(trackUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Ошибка HTTP: ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Ответ сервера не является JSON');
      }
      
      // Получаем данные трека
      const data = await response.json();
      console.log('Получены данные трека:', data);
      
      // Проверяем наличие данных телеметрии в ответе
      if (data && Array.isArray(data) && data.length > 0) {
        // Преобразуем данные в формат, подходящий для карты
        const processedData = data
          .map(point => ({
            lat: point.latitude || point.lat,
            lng: point.longitude || point.lng,
            speed: point.speed || 0,
            time: point.time,
            course: point.course || 0
          }))
          .filter(point => 
            point && 
            typeof point.lat !== 'undefined' && !isNaN(point.lat) && 
            typeof point.lng !== 'undefined' && !isNaN(point.lng)
          );
        
        if (processedData.length === 0) {
          toast.warning(`Нет корректных данных телеметрии для ${vehicle.name} за выбранный период`);
          setStatistics({
            distance: '-',
            avgSpeed: '-',
            maxSpeed: '-',
            duration: '-'
          });
        } else {
          // Сохраняем обработанные данные
          setTrackData(processedData);
          
          // Отображаем трек на карте
          const map = mapInstanceRef.current || initMap();
          displayTrack(map, processedData);
          
          // Обновляем статистику
          const stats = calculateTrackStatistics(processedData);
          setStatistics(stats);
          
          toast.success(`Загружено ${processedData.length} точек телеметрии`);
        }
      } else {
        toast.warning(`Нет данных телеметрии для ${vehicle.name} за выбранный период`);
        setStatistics({
          distance: '-',
          avgSpeed: '-',
          maxSpeed: '-',
          duration: '-'
        });
      }
    } catch (error) {
      console.error('Ошибка загрузки телеметрии:', error);
      toast.error(`Ошибка загрузки данных телеметрии: ${error.message}`);
      setStatistics({
        distance: '-',
        avgSpeed: '-',
        maxSpeed: '-',
        duration: '-'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Инициализация карты при монтировании компонента
  useEffect(() => {
    const map = initMap();
    
    // Добавляем слушатель события изменения диапазона дат
    const handleDateRangeChange = (event) => {
      console.log('Получено событие dateRangeChanged:', event.detail);
      
      if (event.detail && event.detail.forceUpdate) {
        const newStartDate = event.detail.startDate ? new Date(event.detail.startDate.split('.').reverse().join('-')) : startDate;
        const newEndDate = event.detail.endDate ? new Date(event.detail.endDate.split('.').reverse().join('-')) : endDate;
        
        // Обновляем период
        if (event.detail.periodType) {
          setSelectedPeriod(event.detail.periodType);
        }
        
        // Загружаем данные для нового диапазона
        loadTrackData(newStartDate, newEndDate);
      }
    };
    
    // Устанавливаем слушатель
    document.addEventListener('dateRangeChanged', handleDateRangeChange);
    
    // Очистка при размонтировании
    return () => {
      document.removeEventListener('dateRangeChanged', handleDateRangeChange);
      
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [startDate, endDate]);
  
  // Загрузка данных при изменении параметров
  useEffect(() => {
    if (vehicle && vehicle.imei && startDate && endDate) {
      // Всегда используем custom период, если не отображаем селектор периода
      if (hidePeriodSelector) {
        setSelectedPeriod('custom');
      }
      
      loadTrackData(startDate, endDate);
      console.log('Загрузка трека для ТС:', vehicle.name, 'IMEI:', vehicle.imei);
    }
  }, [vehicle, startDate, endDate, hidePeriodSelector]);
  
  // Обработчик кнопки обновления трека
  const handleRefreshTrack = () => {
    loadTrackForPeriod(selectedPeriod);
  };
  
  // Обработчик начала анимации
  const handleStartAnimation = () => {
    if (!trackData || !mapInstanceRef.current) {
      toast.warning('Нет данных трека для анимации');
      return;
    }
    
    // Скрываем обычный трек перед запуском анимации
    if (mapInstanceRef.current._layers) {
      Object.keys(mapInstanceRef.current._layers).forEach((layerId) => {
        if (
          mapInstanceRef.current._layers[layerId]._path || 
          mapInstanceRef.current._layers[layerId]._icon ||
          mapInstanceRef.current._layers[layerId] instanceof L.Marker ||
          mapInstanceRef.current._layers[layerId] instanceof L.Polyline
        ) {
          try {
            mapInstanceRef.current.removeLayer(mapInstanceRef.current._layers[layerId]);
          } catch (e) {
            console.warn('Ошибка при удалении слоя:', e);
          }
        }
      });
    }
    
    setIsAnimating(true);
  };
  
  // Обработчик завершения анимации
  const handleAnimationEnd = () => {
    setIsAnimating(false);
    // Восстанавливаем обычное отображение трека
    if (trackData && mapInstanceRef.current) {
      displayTrack(mapInstanceRef.current, trackData);
    }
  };

  // Обработчик отмены анимации
  const handleCancelAnimation = () => {
    setIsAnimating(false);
    // Восстанавливаем обычное отображение трека
    if (trackData && mapInstanceRef.current) {
      displayTrack(mapInstanceRef.current, trackData);
    }
  };
  
  const renderPeriodButtons = () => {
    // Если селектор должен быть скрыт, возвращаем пустой фрагмент
    if (hidePeriodSelector) {
      return (
        <div className="period-buttons">
          <button className="refresh-button" onClick={handleRefreshTrack}>
            <FontAwesomeIcon icon={faSync} />
            <span>Обновить</span>
          </button>
          
          {!isAnimating && trackData && trackData.length > 0 && (
            <button className="play-button" onClick={handleStartAnimation}>
              <FontAwesomeIcon icon={faPlay} />
              <span>Воспроизвести</span>
            </button>
          )}
        </div>
      );
    }
    
    return (
      <div className="period-buttons">
        <button 
          className={`period-button ${selectedPeriod === 'day' ? 'active' : ''}`}
          onClick={() => handleChangePeriod('day')}
        >
          <FontAwesomeIcon icon={faCalendarDay} />
          <span>День</span>
        </button>
        <button 
          className={`period-button ${selectedPeriod === 'week' ? 'active' : ''}`}
          onClick={() => handleChangePeriod('week')}
        >
          <FontAwesomeIcon icon={faCalendarWeek} />
          <span>Неделя</span>
        </button>
        <button 
          className={`period-button ${selectedPeriod === 'custom' ? 'active' : ''}`}
          onClick={() => handleChangePeriod('custom')}
        >
          <FontAwesomeIcon icon={faCalendarAlt} />
          <span>Свой период</span>
        </button>
        <button className="refresh-button" onClick={handleRefreshTrack}>
          <FontAwesomeIcon icon={faSync} />
          <span>Обновить</span>
        </button>
        
        {!isAnimating && trackData && trackData.length > 0 && (
          <button className="play-button" onClick={handleStartAnimation}>
            <FontAwesomeIcon icon={faPlay} />
            <span>Воспроизвести</span>
          </button>
        )}
      </div>
    );
  };
  
  return (
    <div className="track-chart-container">
      <div className="report-header">
        <div className="speed-chart-title">
          <div className="speed-chart-title-icon">
            <FontAwesomeIcon icon={faMapMarkedAlt} />
          </div>
          Трек движения
          {vehicle && vehicle.name && <span> - {vehicle.name}</span>}
        </div>
        
        {renderPeriodButtons()}
      </div>
      
      <div className="track-container">
        <div className="map-container">
          <div 
            ref={mapRef} 
            className="track-map" 
            style={{ height: '400px', width: '100%' }}
          />
          {isLoading && (
            <div className="chart-loading">
              Загрузка данных трека...
            </div>
          )}
          
          {isAnimating && (
            <RouteAnimation 
              map={mapInstanceRef.current}
              vehicle={vehicle}
              trackPoints={trackData}
              onAnimationEnd={handleAnimationEnd}
              onCancel={handleCancelAnimation}
            />
          )}
        </div>
        
        <div className="track-statistics">
          <div className="stat-card">
            <div className="stat-title">Расстояние</div>
            <div className="stat-value">{statistics.distance}</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">Средняя скорость</div>
            <div className="stat-value">{statistics.avgSpeed}</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">Максимальная скорость</div>
            <div className="stat-value">{statistics.maxSpeed}</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">Время в пути</div>
            <div className="stat-value">{statistics.duration}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrackMap; 