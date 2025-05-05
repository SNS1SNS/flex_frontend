import React, { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faRefresh, faRoad, faTachometerAlt, faClock,
  faLocationArrow, faEraser 
} from '@fortawesome/free-solid-svg-icons';
import './LiveTrack.css';

const LiveTrack = ({ vehicle, startDate, endDate }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [trackData, setTrackData] = useState(null);
  const [stats, setStats] = useState({
    distance: 0,
    avgSpeed: 0,
    maxSpeed: 0,
    movingTime: 0,
    stoppedTime: 0,
    startTime: null,
    endTime: null
  });

  // Инициализация карты
  useEffect(() => {
    if (!mapInstanceRef.current && mapRef.current) {
      // Проверка, что L (Leaflet) доступен глобально
      if (window.L) {
        const map = window.L.map(mapRef.current).setView([55.7558, 37.6173], 10);
        
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        
        mapInstanceRef.current = map;
      } else {
        console.error('Leaflet (L) не найден в глобальном пространстве. Убедитесь, что библиотека подключена.');
        setError('Не удалось инициализировать карту. Библиотека Leaflet не найдена.');
      }
    }
    
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Загрузка данных телеметрии при изменении параметров
  useEffect(() => {
    if (vehicle && startDate && endDate) {
      loadTelemetryData();
    }
  }, [vehicle, startDate, endDate]);

  // Функция загрузки данных телеметрии
  const loadTelemetryData = async () => {
    if (!vehicle || !vehicle.imei) {
      setError('Не указан IMEI транспортного средства');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Форматируем даты для API запроса
      const formattedStartDate = formatDateForApi(startDate);
      const formattedEndDate = formatDateForApi(endDate);
      
      console.log(`Загрузка телеметрии для ТС ${vehicle.imei} за период ${formattedStartDate} - ${formattedEndDate}`);
      
      const response = await fetch(`/api/telemetry/${vehicle.imei}?start=${formattedStartDate}&end=${formattedEndDate}`);
      
      if (!response.ok) {
        throw new Error(`Ошибка загрузки данных: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.points && Array.isArray(data.points)) {
        setTrackData(data);
        updateMap(data.points);
        calculateStats(data.points);
      } else {
        setTrackData({ points: [] });
        setError('Нет данных за выбранный период');
      }
    } catch (err) {
      console.error('Ошибка при загрузке телеметрии:', err);
      setError(`Не удалось загрузить данные: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Форматирование даты для API
  const formatDateForApi = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  };

  // Обновление карты с новыми точками
  const updateMap = (points) => {
    if (!mapInstanceRef.current || !points || points.length === 0) return;
    
    const map = mapInstanceRef.current;
    
    // Очищаем предыдущие слои с маршрутом
    map.eachLayer(layer => {
      if (layer instanceof window.L.Polyline || layer instanceof window.L.Marker) {
        map.removeLayer(layer);
      }
    });
    
    // Создаем полилинию маршрута
    const routePoints = points.map(point => [point.lat, point.lng]);
    const routeLine = window.L.polyline(routePoints, { 
      color: '#3388ff', 
      weight: 4, 
      opacity: 0.7 
    }).addTo(map);
    
    // Добавляем маркеры начала и конца маршрута
    if (points.length > 0) {
      const startPoint = points[0];
      const endPoint = points[points.length - 1];
      
      // Маркер начала
      const startIcon = window.L.divIcon({
        className: 'start-marker',
        html: '<div class="marker-container start"><div class="marker-circle"></div><i class="fas fa-play"></i></div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
      
      window.L.marker([startPoint.lat, startPoint.lng], { icon: startIcon })
        .addTo(map)
        .bindPopup(`
          <div class="marker-popup">
            <div class="popup-header start">
              <i class="fas fa-play"></i>
              <h3>Начало маршрута</h3>
            </div>
            <div class="popup-content">
              <p><i class="fas fa-clock"></i> Время: ${new Date(startPoint.timestamp).toLocaleString()}</p>
              <p><i class="fas fa-map-marker-alt"></i> Координаты: ${startPoint.lat.toFixed(6)}, ${startPoint.lng.toFixed(6)}</p>
            </div>
          </div>
        `);
      
      // Маркер конца
      const endIcon = window.L.divIcon({
        className: 'end-marker',
        html: '<div class="marker-container end"><div class="marker-circle"></div><i class="fas fa-flag"></i></div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
      
      window.L.marker([endPoint.lat, endPoint.lng], { icon: endIcon })
        .addTo(map)
        .bindPopup(`
          <div class="marker-popup">
            <div class="popup-header end">
              <i class="fas fa-flag"></i>
              <h3>Конец маршрута</h3>
            </div>
            <div class="popup-content">
              <p><i class="fas fa-clock"></i> Время: ${new Date(endPoint.timestamp).toLocaleString()}</p>
              <p><i class="fas fa-map-marker-alt"></i> Координаты: ${endPoint.lat.toFixed(6)}, ${endPoint.lng.toFixed(6)}</p>
            </div>
          </div>
        `);
      
      // Маркер текущего положения ТС (последняя точка)
      const vehicleIcon = window.L.divIcon({
        className: 'vehicle-marker',
        html: `<div class="marker-container vehicle" style="transform: rotate(${endPoint.course || 0}deg)"><div class="marker-vehicle"><i class="fas fa-truck"></i></div></div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });
      
      window.L.marker([endPoint.lat, endPoint.lng], { icon: vehicleIcon })
        .addTo(map)
        .bindPopup(`
          <div class="marker-popup">
            <div class="popup-header vehicle">
              <i class="fas fa-truck"></i>
              <h3>Текущее положение</h3>
            </div>
            <div class="popup-content">
              <p><i class="fas fa-clock"></i> Время: ${new Date(endPoint.timestamp).toLocaleString()}</p>
              <p><i class="fas fa-tachometer-alt"></i> Скорость: ${endPoint.speed || 0} км/ч</p>
              <p><i class="fas fa-compass"></i> Курс: ${endPoint.course || 0}°</p>
              <p><i class="fas fa-map-marker-alt"></i> Координаты: ${endPoint.lat.toFixed(6)}, ${endPoint.lng.toFixed(6)}</p>
            </div>
          </div>
        `);
    }
    
    // Подгоняем карту под маршрут
    map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
  };

  // Расчет статистики по маршруту
  const calculateStats = (points) => {
    if (!points || points.length < 2) {
      setStats({
        distance: 0,
        avgSpeed: 0,
        maxSpeed: 0,
        movingTime: 0,
        stoppedTime: 0,
        startTime: points && points.length > 0 ? new Date(points[0].timestamp) : null,
        endTime: points && points.length > 0 ? new Date(points[points.length - 1].timestamp) : null
      });
      return;
    }
    
    let totalDistance = 0;
    let totalSpeed = 0;
    let maxSpeed = 0;
    let movingTime = 0;
    let stoppedTime = 0;
    let speedPointsCount = 0;
    
    const startTime = new Date(points[0].timestamp);
    const endTime = new Date(points[points.length - 1].timestamp);
    
    for (let i = 1; i < points.length; i++) {
      const prevPoint = points[i - 1];
      const currPoint = points[i];
      
      // Расчет расстояния
      const distance = calculateDistance(
        prevPoint.lat, prevPoint.lng, 
        currPoint.lat, currPoint.lng
      );
      totalDistance += distance;
      
      // Расчет скорости
      if (currPoint.speed !== undefined && currPoint.speed !== null) {
        totalSpeed += currPoint.speed;
        speedPointsCount++;
        maxSpeed = Math.max(maxSpeed, currPoint.speed);
      }
      
      // Расчет времени
      const timeDiff = new Date(currPoint.timestamp) - new Date(prevPoint.timestamp);
      if (currPoint.speed !== undefined && currPoint.speed > 3) { // Условие движения
        movingTime += timeDiff;
      } else {
        stoppedTime += timeDiff;
      }
    }
    
    // Рассчитываем средние значения
    const avgSpeed = speedPointsCount > 0 ? totalSpeed / speedPointsCount : 0;
    
    // Конвертируем время из миллисекунд в часы, минуты и секунды
    const movingTimeHours = Math.floor(movingTime / 3600000);
    const movingTimeMinutes = Math.floor((movingTime % 3600000) / 60000);
    const stoppedTimeHours = Math.floor(stoppedTime / 3600000);
    const stoppedTimeMinutes = Math.floor((stoppedTime % 3600000) / 60000);
    
    setStats({
      distance: totalDistance.toFixed(2), // В километрах
      avgSpeed: avgSpeed.toFixed(1), // В км/ч
      maxSpeed: maxSpeed.toFixed(1), // В км/ч
      movingTime: `${movingTimeHours}ч ${movingTimeMinutes}м`,
      stoppedTime: `${stoppedTimeHours}ч ${stoppedTimeMinutes}м`,
      startTime,
      endTime
    });
  };

  // Расчет расстояния между двумя географическими точками (формула гаверсинуса)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Радиус Земли в км
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Расстояние в км
    return distance;
  };

  // Обработчик обновления данных
  const handleRefresh = () => {
    loadTelemetryData();
  };

  // Обработчик сброса трека
  const handleReset = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.eachLayer(layer => {
        if (layer instanceof window.L.Polyline || layer instanceof window.L.Marker) {
          mapInstanceRef.current.removeLayer(layer);
        }
      });
    }
    
    setTrackData(null);
    setStats({
      distance: 0,
      avgSpeed: 0,
      maxSpeed: 0,
      movingTime: 0,
      stoppedTime: 0,
      startTime: null,
      endTime: null
    });
  };

  return (
    <div className="live-track-container">
      <div className="live-track-header">
        <div className="track-title">
          <h3>{vehicle ? vehicle.name : 'Транспортное средство'} - Трек в реальном времени</h3>
        </div>
        <div className="track-controls">
          <div className="date-range-controls">
            <span>{startDate && endDate ? `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}` : ''}</span>
          </div>
          <button className="refresh-btn" onClick={handleRefresh} disabled={loading}>
            <FontAwesomeIcon icon={faRefresh} spin={loading} />
            {loading ? 'Загрузка...' : 'Обновить'}
          </button>
          <button className="reset-btn" onClick={handleReset} disabled={loading || !trackData}>
            <FontAwesomeIcon icon={faEraser} />
            Сбросить
          </button>
        </div>
      </div>

      <div className="live-track-content">
        <div className="map-container">
          {loading && (
            <div className="loading-overlay">
              <div className="loading-spinner"></div>
              <span>Загрузка данных...</span>
            </div>
          )}

          {error && (
            <div className="error-message">
              <p>{error}</p>
              <button onClick={handleRefresh}>Повторить</button>
            </div>
          )}

          <div className="track-map" ref={mapRef}></div>
        </div>

        
      </div>
    </div>
  );
};

export default LiveTrack; 