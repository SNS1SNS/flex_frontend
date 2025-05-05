/* global L */
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * Инициализирует карту на указанном элементе DOM
 * @param {HTMLElement} element - DOM элемент, в котором будет инициализирована карта
 * @param {Object} options - Опции инициализации карты
 * @returns {L.Map} - Экземпляр карты Leaflet
 */
export const initMap = (element, options = {}) => {
  if (!element) return null;
  
  const defaultOptions = {
    center: [51.143964, 71.435819], // Координаты по умолчанию
    zoom: 12,
    zoomControl: true,
    scrollWheelZoom: true
  };
  
  const mergedOptions = { ...defaultOptions, ...options };
  
  // Создаем экземпляр карты
  const map = L.map(element, mergedOptions);
  
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
  
  // Инвалидируем размер карты для правильного отображения
  setTimeout(() => {
    map.invalidateSize();
  }, 100);
  
  return map;
};

/**
 * Функция для вычисления расстояния между точками
 * @param {number} lat1 - Широта первой точки
 * @param {number} lon1 - Долгота первой точки
 * @param {number} lat2 - Широта второй точки
 * @param {number} lon2 - Долгота второй точки
 * @returns {number} - Расстояние в километрах
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  
  const R = 6371; // Радиус Земли в км
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
           Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
           Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * Создает маркер на карте
 * @param {Object} map - Экземпляр карты Leaflet
 * @param {Array} position - Массив [lat, lng] с координатами
 * @param {Object} options - Опции маркера
 * @returns {L.Marker} - Созданный маркер
 */
export const createMarker = (map, position, options = {}) => {
  if (!map || !position) return null;
  return L.marker(position, options).addTo(map);
};

/**
 * Добавляет трек на карту
 * @param {Object} map - Экземпляр карты Leaflet
 * @param {Array} points - Массив точек с координатами [lat, lng]
 * @param {Object} options - Опции полилинии
 * @returns {L.Polyline} - Созданная полилиния
 */
export const addTrackLine = (map, points, options = {}) => {
  if (!map || !points || points.length < 2) return null;
  
  const defaultOptions = {
    color: '#2c7be5',
    weight: 5,
    opacity: 0.7,
    smoothFactor: 1
  };
  
  const mergedOptions = { ...defaultOptions, ...options };
  return L.polyline(points, mergedOptions).addTo(map);
};

export default {
  initMap,
  calculateDistance,
  createMarker,
  addTrackLine
}; 