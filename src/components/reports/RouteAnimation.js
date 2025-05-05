import React, { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faRoad, faClock, faTachometerAlt, faTruck, faPlay,
  faPause, faStop, faCompass, faMapMarkerAlt
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import './RouteAnimation.css';

/**
 * Компонент для анимации движения транспортного средства по маршруту
 * @param {Object} props - Свойства компонента
 * @param {L.Map} props.map - Экземпляр карты Leaflet
 * @param {Object} props.vehicle - Данные о транспортном средстве (id, name, imei)
 * @param {Array} props.trackPoints - Массив точек трека
 * @param {Function} props.onAnimationEnd - Функция, вызываемая по окончании анимации
 * @param {Function} props.onCancel - Функция для отмены анимации
 */
const RouteAnimation = ({ map, vehicle, trackPoints, onAnimationEnd, onCancel }) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [animationSpeed, setAnimationSpeed] = useState(1);
  const [progress, setProgress] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [distanceTraveled, setDistanceTraveled] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState('00:00:00');
  const [currentTime, setCurrentTime] = useState('00:00:00');
  const [totalTime, setTotalTime] = useState('00:00:00');
  
  // Различные рефы для хранения состояния анимации
  const animationRef = useRef(null);
  const markerRef = useRef(null);
  const progressLineRef = useRef(null);
  const trailLineRef = useRef(null);
  const tailMarkersRef = useRef([]);
  const prevTimeRef = useRef(Date.now());
  const animationTimeRef = useRef(0);
  const lastAddedPointIndexRef = useRef(0);
  const totalDistanceTraveledRef = useRef(0);
  const sortedCoordsRef = useRef([]);
  const processedPointsRef = useRef([]);
  const currentIndexRef = useRef(0);
  
  // Форматирование времени в читаемый формат
  const formatTime = useCallback((date) => {
    return date.toLocaleTimeString();
  }, []);
  
  // Форматирование времени в формате ЧЧ:ММ:СС
  const formatElapsedTime = useCallback((milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, []);
  
  // Расчет расстояния между двумя точками
  const calculateDistance = useCallback((lat1, lon1, lat2, lon2) => {
    const R = 6371; // Радиус Земли в км
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }, []);
  
  // Интерполяция позиции
  const interpolatePosition = useCallback((p1, p2, ratio) => {
    return [
      p1[0] + (p2[0] - p1[0]) * ratio,
      p1[1] + (p2[1] - p1[1]) * ratio
    ];
  }, []);
  
  // Вычисление угла между двумя точками
  const calculateAngle = useCallback((p1, p2) => {
    const dx = p2[1] - p1[1]; // lng
    const dy = p2[0] - p1[0]; // lat
    return Math.atan2(dy, dx) * (180 / Math.PI);
  }, []);
  
  // Получение текстового направления из градусов
  const getDirectionFromDegrees = useCallback((degrees) => {
    const directions = ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'];
    const index = Math.round(degrees / 45) % 8;
    return directions[index];
  }, []);
  
  // Инициализация анимации
  const initAnimation = useCallback(() => {
    if (!map || !trackPoints || trackPoints.length < 2) {
      toast.error('Недостаточно данных для анимации маршрута');
      return false;
    }
    
    // Сортируем точки по времени
    const sortedPoints = [...trackPoints].sort((a, b) => new Date(a.time) - new Date(b.time));
    
    // Создаем массив координат для Leaflet
    const leafletCoords = sortedPoints.map(point => [point.lat, point.lng]);
    sortedCoordsRef.current = leafletCoords;
    processedPointsRef.current = sortedPoints;
    
    // Определяем цвет трека в зависимости от типа ТС
    let lineColor = '#FF4500';
    
    if (vehicle) {
      if (vehicle.name.includes('Damas')) {
        lineColor = '#4CAF50'; // зеленый
      } else if (vehicle.name.includes('Kamaz')) {
        lineColor = '#e57b1e'; // оранжевый
      } else if (vehicle.name.includes('Gazel')) {
        lineColor = '#e51e24'; // красный
      }
    }
    
    // Очищаем предыдущие слои анимации на карте
    map.eachLayer(layer => {
      if (layer instanceof L.Polyline || 
          (layer instanceof L.Marker && layer._icon && layer._icon.className.includes('animated-vehicle')) || 
          layer instanceof L.CircleMarker) {
        map.removeLayer(layer);
      }
    });
    
    // Создаем прогресс линию (пустую)
    const progressLine = L.polyline([leafletCoords[0]], {
      color: lineColor,
      weight: 5,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
      className: 'vehicle-track-progress'
    }).addTo(map);
    progressLineRef.current = progressLine;
    
    // Создаем эффект "следа"
    const trailLine = L.polyline([leafletCoords[0]], {
      color: 'rgba(255, 255, 255, 0.6)',
      weight: 8,
      opacity: 0.5,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);
    trailLine.bringToBack();
    trailLineRef.current = trailLine;
    
    // Создаем маркер для анимации
    const vehicleIcon = L.divIcon({
      className: 'animated-vehicle-marker',
      html: `<div class="vehicle-animation-container">
              <div class="vehicle-icon-animated">
                <i class="fas fa-truck"></i>
              </div>
              <div class="direction-indicator-animated"></div>
              <div class="pulse-circle"></div>
             </div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });
    
    const animatedMarker = L.marker(leafletCoords[0], { icon: vehicleIcon }).addTo(map);
    markerRef.current = animatedMarker;
    
    // Привязываем всплывающую подсказку
    const vehicleName = vehicle?.name || 'Транспорт';
    animatedMarker.bindTooltip(`${vehicleName}`, { 
      permanent: false, 
      direction: 'top',
      className: 'custom-tooltip'
    });
    
    // Вычисляем временные интервалы
    const startTime = new Date(sortedPoints[0].time);
    const endTime = new Date(sortedPoints[sortedPoints.length - 1].time);
    const totalDuration = endTime - startTime;
    
    // Устанавливаем итоговое время
    setTotalTime(formatTime(endTime));
    setCurrentTime(formatTime(startTime));
    
    // Центрируем карту на начальной точке
    map.setView(leafletCoords[0], map.getZoom());
    
    return {
      totalDuration,
      startTime,
      endTime,
      lineColor
    };
  }, [map, trackPoints, vehicle, formatTime]);
  
  // Обновление анимации
  const updateAnimation = useCallback(() => {
    if (!isPlaying || !map) return;
    
    const now = Date.now();
    const deltaTime = (now - prevTimeRef.current) * animationSpeed;
    prevTimeRef.current = now;
    
    animationTimeRef.current += deltaTime;
    const totalDuration = processedPointsRef.current[processedPointsRef.current.length - 1].time - 
                          processedPointsRef.current[0].time;
    const animationDuration = totalDuration / 10; // ускоряем в 10 раз для наглядности
    const progress = Math.min(1, animationTimeRef.current / animationDuration);
    
    // Обновляем состояние прогресса
    setProgress(progress * 100);
    
    // Вычисляем текущее время в анимации
    const startTime = new Date(processedPointsRef.current[0].time);
    const currentAnimTime = new Date(startTime.getTime() + animationTimeRef.current * 10);
    setCurrentTime(formatTime(currentAnimTime));
    
    // Обновляем время в пути
    setTimeElapsed(formatElapsedTime(animationTimeRef.current * 10));
    
    // Находим текущую позицию
    const newIndex = Math.min(
      sortedCoordsRef.current.length - 1,
      Math.floor(progress * sortedCoordsRef.current.length)
    );
    
    if (newIndex > currentIndexRef.current) {
      // Рассчитываем пройденное расстояние
      for (let i = currentIndexRef.current; i < newIndex; i++) {
        if (i + 1 < sortedCoordsRef.current.length) {
          const dist = calculateDistance(
            sortedCoordsRef.current[i][0], sortedCoordsRef.current[i][1],
            sortedCoordsRef.current[i+1][0], sortedCoordsRef.current[i+1][1]
          );
          totalDistanceTraveledRef.current += dist;
        }
      }
      
      // Обновляем показания пройденного расстояния
      setDistanceTraveled(totalDistanceTraveledRef.current.toFixed(2));
      
      // Обновляем прогресс линию, добавляя новые точки
      const progressCoords = sortedCoordsRef.current.slice(0, newIndex + 1);
      progressLineRef.current.setLatLngs(progressCoords);
      trailLineRef.current.setLatLngs(progressCoords);
      
      // Добавляем маркер пройденной точки каждые N точек
      for (let i = lastAddedPointIndexRef.current + 1; i <= newIndex; i++) {
        if (i % 10 === 0 && i < sortedCoordsRef.current.length - 1) {
          const pointMarker = L.circleMarker(sortedCoordsRef.current[i], {
            radius: 3,
            fillColor: '#FF4500',
            color: '#fff',
            weight: 1,
            opacity: 0.7,
            fillOpacity: 0.8
          }).addTo(map);
        }
      }
      
      // Обновляем индексы
      lastAddedPointIndexRef.current = newIndex;
      currentIndexRef.current = newIndex;
    }
    
    // Плавное перемещение между точками
    let currentPosition;
    
    if (currentIndexRef.current < sortedCoordsRef.current.length - 1) {
      const exactProgress = progress * (sortedCoordsRef.current.length - 1);
      const baseIndex = Math.floor(exactProgress);
      const positionRatio = exactProgress - baseIndex;
      
      currentPosition = interpolatePosition(
        sortedCoordsRef.current[baseIndex],
        sortedCoordsRef.current[Math.min(baseIndex + 1, sortedCoordsRef.current.length - 1)],
        positionRatio
      );
      
      // Рассчитываем текущую скорость
      if (processedPointsRef.current[baseIndex].speed !== undefined) {
        let speed = processedPointsRef.current[baseIndex].speed;
        if (baseIndex + 1 < processedPointsRef.current.length && 
            processedPointsRef.current[baseIndex + 1].speed !== undefined) {
          // Интерполируем скорость
          speed = processedPointsRef.current[baseIndex].speed + 
                  (processedPointsRef.current[baseIndex + 1].speed - 
                   processedPointsRef.current[baseIndex].speed) * positionRatio;
        }
        setCurrentSpeed(Math.round(speed));
      } else {
        // Если скорость не указана в данных, рассчитываем на основе расстояния и времени
        const startIdx = Math.max(0, baseIndex - 5);
        const endIdx = baseIndex;
        if (startIdx < endIdx) {
          let segmentDist = 0;
          for (let i = startIdx; i < endIdx; i++) {
            segmentDist += calculateDistance(
              sortedCoordsRef.current[i][0], sortedCoordsRef.current[i][1],
              sortedCoordsRef.current[i+1][0], sortedCoordsRef.current[i+1][1]
            );
          }
          
          // Рассчитываем время в часах
          const segmentTimeMs = (new Date(processedPointsRef.current[endIdx].time) - 
                                new Date(processedPointsRef.current[startIdx].time));
          const segmentTimeHours = segmentTimeMs / (1000 * 60 * 60);
          if (segmentTimeHours > 0) {
            const speed = segmentDist / segmentTimeHours;
            setCurrentSpeed(Math.round(speed));
          }
        }
      }
    } else {
      currentPosition = sortedCoordsRef.current[sortedCoordsRef.current.length - 1];
    }
    
    // Обновляем положение маркера
    markerRef.current.setLatLng(currentPosition);
    
    // Создаем эффект "шлейфа" за маркером
    const tailMarker = L.circleMarker(currentPosition, {
      radius: 5,
      fillColor: '#FF4500',
      color: 'white',
      weight: 2,
      opacity: 0.7,
      fillOpacity: 0.5
    }).addTo(map);
    
    // Добавляем эффект исчезновения маркера
    setTimeout(() => {
      tailMarker.setStyle({ opacity: 0.5, fillOpacity: 0.3 });
      setTimeout(() => {
        tailMarker.setStyle({ opacity: 0.3, fillOpacity: 0.1 });
        setTimeout(() => {
          map.removeLayer(tailMarker);
        }, 500);
      }, 500);
    }, 500);
    
    tailMarkersRef.current.push(tailMarker);
    
    // Если слишком много маркеров шлейфа, удаляем старые
    if (tailMarkersRef.current.length > 10) {
      const oldestMarker = tailMarkersRef.current.shift();
      map.removeLayer(oldestMarker);
    }
    
    // Обновляем направление указателя
    if (currentIndexRef.current < sortedCoordsRef.current.length - 1) {
      const angle = calculateAngle(
        sortedCoordsRef.current[currentIndexRef.current],
        sortedCoordsRef.current[Math.min(currentIndexRef.current + 1, sortedCoordsRef.current.length - 1)]
      );
      
      const directionIndicator = markerRef.current.getElement()?.querySelector('.direction-indicator-animated');
      if (directionIndicator) {
        directionIndicator.style.transform = `rotate(${angle}deg)`;
      }
    }
    
    // Следим за маркером, центрируя карту
    if (progress < 0.95) { // Не центрируем в самом конце для лучшего восприятия
      map.panTo(currentPosition, { 
        duration: 0.5,
        animate: true,
        easeLinearity: 0.5
      });
    }
    
    // Если анимация завершена, останавливаем её
    if (progress >= 1) {
      clearInterval(animationRef.current);
      
      // Вызываем функцию завершения анимации через небольшую задержку
      setTimeout(() => {
        handleAnimationEnd();
      }, 1000);
    }
  }, [isPlaying, map, animationSpeed, formatTime, formatElapsedTime, calculateDistance, interpolatePosition, calculateAngle]);
  
  // Инициализация анимации при монтировании компонента
  useEffect(() => {
    const animationData = initAnimation();
    if (!animationData) return;
    
    const { startTime } = animationData;
    prevTimeRef.current = Date.now();
    animationTimeRef.current = 0;
    
    // Запускаем интервал для обновления анимации
    animationRef.current = setInterval(updateAnimation, 50);
    
    // Показываем уведомление о начале анимации
    toast.info(`Воспроизведение маршрута для ${vehicle?.name || 'транспорта'} начато`);
    
    return () => {
      // Очищаем интервал при размонтировании
      clearInterval(animationRef.current);
    };
  }, [initAnimation, updateAnimation, vehicle]);
  
  // Обработчик переключения паузы/воспроизведения
  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };
  
  // Обработчик изменения скорости анимации
  const handleSpeedChange = (e) => {
    setAnimationSpeed(parseFloat(e.target.value));
  };
  
  // Обработчик завершения анимации
  const handleAnimationEnd = () => {
    clearInterval(animationRef.current);
    
    // Очищаем все созданные маркеры и линии
    if (map) {
      if (markerRef.current) map.removeLayer(markerRef.current);
      if (progressLineRef.current) map.removeLayer(progressLineRef.current);
      if (trailLineRef.current) map.removeLayer(trailLineRef.current);
      
      // Удаляем маркеры шлейфа
      tailMarkersRef.current.forEach(marker => map.removeLayer(marker));
    }
    
    // Вызываем колбэк завершения
    if (onAnimationEnd) onAnimationEnd();
  };
  
  // Обработчик отмены анимации
  const handleCancel = () => {
    clearInterval(animationRef.current);
    
    // Очищаем все созданные маркеры и линии
    if (map) {
      if (markerRef.current) map.removeLayer(markerRef.current);
      if (progressLineRef.current) map.removeLayer(progressLineRef.current);
      if (trailLineRef.current) map.removeLayer(trailLineRef.current);
      
      // Удаляем маркеры шлейфа
      tailMarkersRef.current.forEach(marker => map.removeLayer(marker));
    }
    
    // Вызываем колбэк отмены
    if (onCancel) onCancel();
  };
  
  return (
    <div className="route-animation-progress">
      <div className="progress-container">
        <div className="progress-bar" style={{ width: `${progress}%` }}></div>
        <div className="progress-info">
          <span className="current-time">{currentTime}</span>
          <span className="separator">/</span>
          <span className="total-time">{totalTime}</span>
        </div>
      </div>
      
      <div className="route-stats">
        <div className="stat-item">
          <FontAwesomeIcon icon={faRoad} />
          <span>{distanceTraveled} км</span>
        </div>
        <div className="stat-item">
          <FontAwesomeIcon icon={faClock} />
          <span>{timeElapsed}</span>
        </div>
        <div className="stat-item">
          <FontAwesomeIcon icon={faTachometerAlt} />
          <span>{currentSpeed} км/ч</span>
        </div>
      </div>
      
      <div className="animation-controls">
        <button 
          className="btn btn-sm btn-secondary animation-pause" 
          onClick={handlePlayPause}
        >
          <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
        </button>
        <button 
          className="btn btn-sm btn-secondary animation-stop"
          onClick={handleCancel}
        >
          <FontAwesomeIcon icon={faStop} />
        </button>
        <div className="speed-control">
          <label>Скорость:</label>
          <select 
            id="animation-speed" 
            value={animationSpeed}
            onChange={handleSpeedChange}
          >
            <option value="0.5">x0.5</option>
            <option value="1">x1</option>
            <option value="2">x2</option>
            <option value="5">x5</option>
            <option value="10">x10</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default RouteAnimation; 