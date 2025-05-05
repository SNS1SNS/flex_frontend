import { toast } from 'react-toastify';

/**
 * Набор функций для работы с транспортными средствами в отчетах
 */

/**
 * Загружает список транспортных средств
 * @returns {Promise<Array>} - Promise с массивом транспортных средств
 */
export const loadVehicles = async () => {
  try {
    const response = await fetch('/api/vehicles');
    
    if (!response.ok) {
      throw new Error(`Ошибка HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Проверяем, что ответ содержит массив ТС
    if (data && Array.isArray(data)) {
      return data;
    } else {
      // Если API недоступен, возвращаем демо данные
      return getMockVehicles();
    }
  } catch (error) {
    console.error('Ошибка загрузки списка ТС:', error);
    toast.error(`Ошибка загрузки списка транспортных средств: ${error.message}`);
    return getMockVehicles();
  }
};

/**
 * Загружает телеметрию для транспортного средства
 * @param {string} imei - IMEI устройства
 * @param {Date} startDate - Начальная дата
 * @param {Date} endDate - Конечная дата
 * @returns {Promise<Array>} - Promise с массивом точек телеметрии
 */
export const loadVehicleTelemetry = async (imei, startDate, endDate) => {
  if (!imei) {
    toast.warning('IMEI устройства не указан');
    return [];
  }
  
  // Форматируем даты для API
  const startTimeStr = formatToMicroISOString(startDate);
  const endTimeStr = formatToMicroISOString(endDate);
  
  try {
    const trackUrl = `/api/telemetry/track/${imei}?start_time=${encodeURIComponent(startTimeStr)}&end_time=${encodeURIComponent(endTimeStr)}`;
    const response = await fetch(trackUrl);
    
    if (!response.ok) {
      throw new Error(`Ошибка HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Проверяем, что ответ содержит данные телеметрии
    if (data && data.data && Array.isArray(data.data) && data.data.length > 0) {
      // Преобразуем данные в удобный формат
      return processRawTelemetry(data.data);
    } else {
      toast.warning(`Нет данных телеметрии для устройства ${imei} за выбранный период`);
      return [];
    }
  } catch (error) {
    console.error('Ошибка загрузки телеметрии:', error);
    toast.error(`Ошибка загрузки данных телеметрии: ${error.message}`);
    return [];
  }
};

/**
 * Форматирует дату в формат ISO с микросекундами
 * @param {Date} date - Объект даты
 * @returns {string} - Строка даты в формате ISO с микросекундами
 */
export const formatToMicroISOString = (date) => {
  if (!date) return '';
  const isoString = date.toISOString();
  return isoString.replace('Z', '000Z');
};

/**
 * Обрабатывает сырые данные телеметрии в удобный формат
 * @param {Array} rawData - Сырые данные телеметрии от API
 * @returns {Array} - Обработанные данные телеметрии
 */
export const processRawTelemetry = (rawData) => {
  if (!rawData || !Array.isArray(rawData)) return [];
  
  return rawData
    .map(point => ({
      lat: point.latitude || point.lat,
      lng: point.longitude || point.lng,
      speed: point.speed || 0,
      time: point.time,
      course: point.course || 0,
      altitude: point.altitude || 0,
      batteryLevel: point.battery_level || point.batteryLevel || 0
    }))
    .filter(point => 
      point && 
      typeof point.lat !== 'undefined' && !isNaN(point.lat) && 
      typeof point.lng !== 'undefined' && !isNaN(point.lng)
    );
};

/**
 * Загружает статистику для транспортного средства
 * @param {string} imei - IMEI устройства
 * @param {Date} startDate - Начальная дата
 * @param {Date} endDate - Конечная дата
 * @returns {Promise<Object>} - Promise с объектом статистики
 */
export const loadVehicleStatistics = async (imei, startDate, endDate) => {
  if (!imei) {
    toast.warning('IMEI устройства не указан');
    return null;
  }
  
  // Форматируем даты для API
  const startTimeStr = formatToMicroISOString(startDate);
  const endTimeStr = formatToMicroISOString(endDate);
  
  try {
    const statsUrl = `/api/statistics/${imei}?start_time=${encodeURIComponent(startTimeStr)}&end_time=${encodeURIComponent(endTimeStr)}`;
    const response = await fetch(statsUrl);
    
    if (!response.ok) {
      throw new Error(`Ошибка HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data && data.success) {
      return data.data || {};
    } else {
      toast.warning(`Нет статистики для устройства ${imei} за выбранный период`);
      return null;
    }
  } catch (error) {
    console.error('Ошибка загрузки статистики:', error);
    toast.error(`Ошибка загрузки статистики: ${error.message}`);
    return null;
  }
};

/**
 * Получает мок-данные транспортных средств для разработки
 * @returns {Array} Массив мок-данных транспортных средств
 */
export const getMockVehicles = () => {
  return [
    { id: 1, name: 'Toyota Camry', imei: '123456789012345', type: 'car', status: 'active' },
    { id: 2, name: 'Ford Transit', imei: '234567890123456', type: 'van', status: 'active' },
    { id: 3, name: 'Volvo FH16', imei: '345678901234567', type: 'truck', status: 'inactive' },
    { id: 4, name: 'Hyundai Solaris', imei: '456789012345678', type: 'car', status: 'active' },
    { id: 5, name: 'Mercedes Actros', imei: '567890123456789', type: 'truck', status: 'active' }
  ];
};

/**
 * Добавляет плейсхолдер для отчета, когда данные не загружены
 * @param {HTMLElement} container - Контейнер для плейсхолдера
 * @param {string} message - Сообщение для отображения
 */
export const addReportPlaceholder = (container, message = 'Нет данных для отображения') => {
  if (!container) return;
  
  // Создаем элемент-плейсхолдер
  const placeholder = document.createElement('div');
  placeholder.className = 'report-placeholder';
  
  // Добавляем иконку и сообщение
  placeholder.innerHTML = `
    <div class="placeholder-icon">
      <i class="fas fa-file-alt"></i>
    </div>
    <p class="placeholder-message">${message}</p>
  `;
  
  // Очищаем контейнер и добавляем плейсхолдер
  container.innerHTML = '';
  container.appendChild(placeholder);
};

export default {
  loadVehicles,
  loadVehicleTelemetry,
  formatToMicroISOString,
  processRawTelemetry,
  loadVehicleStatistics,
  getMockVehicles,
  addReportPlaceholder
}; 