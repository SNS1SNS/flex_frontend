import { toast } from 'react-toastify';

/**
 * Набор основных функций для работы с отчетами
 */

/**
 * Инициализирует поиск транспортных средств
 * @param {string} searchInput - DOM элемент для ввода поискового запроса
 * @param {Array} vehicles - Массив транспортных средств для поиска
 * @param {Function} onSelect - Функция, вызываемая при выборе ТС
 */
export const initVehicleSearch = (searchInput, vehicles = [], onSelect) => {
  if (!searchInput) return;
  
  // Обработчик ввода поискового запроса
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    if (!query) return;
    
    // Фильтрация транспортных средств по запросу
    const results = vehicles.filter(vehicle => 
      vehicle.name.toLowerCase().includes(query) || 
      vehicle.imei.includes(query)
    );
    
    // Отображение результатов поиска
    displaySearchResults(results, onSelect);
  });
};

/**
 * Отображает результаты поиска транспортных средств
 * @param {Array} results - Результаты поиска
 * @param {Function} onSelect - Функция, вызываемая при выборе ТС
 */
const displaySearchResults = (results, onSelect) => {
  // Реализация отображения результатов
  console.log('Search results:', results);
  // В реальном приложении здесь будет код для отображения выпадающего списка
};

/**
 * Загружает данные отчета с сервера
 * @param {string} reportType - Тип отчета
 * @param {Object} vehicle - Объект транспортного средства
 * @param {Object} dateRange - Диапазон дат
 * @returns {Promise} - Promise с данными отчета
 */
export const loadReportData = async (reportType, vehicle, dateRange) => {
  if (!reportType || !vehicle || !dateRange) {
    toast.error('Недостаточно данных для загрузки отчета');
    return null;
  }
  
  try {
    // Формируем параметры запроса
    const params = new URLSearchParams({
      type: reportType,
      imei: vehicle.imei,
      start_date: formatDate(dateRange.startDate),
      end_date: formatDate(dateRange.endDate)
    });
    
    const url = `/api/reports?${params.toString()}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Ошибка HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Ошибка загрузки данных отчета:', error);
    toast.error(`Не удалось загрузить данные: ${error.message}`);
    return null;
  }
};

/**
 * Форматирует дату для API запросов
 * @param {Date} date - Объект даты
 * @returns {string} - Строка даты в формате ISO
 */
export const formatDate = (date) => {
  if (!date) return '';
  return date.toISOString();
};

/**
 * Форматирует дату для отображения пользователю
 * @param {Date|string} date - Объект даты или строка с датой
 * @returns {string} - Строка даты в локальном формате
 */
export const formatDateForDisplay = (date) => {
  if (!date) return '';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString();
};

/**
 * Экспортирует данные отчета в формате CSV
 * @param {Array} data - Данные для экспорта
 * @param {string} filename - Имя файла
 */
export const exportToCsv = (data, filename = 'report.csv') => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    toast.warning('Нет данных для экспорта');
    return;
  }
  
  try {
    // Заголовки CSV
    const headers = Object.keys(data[0]);
    
    // Преобразуем данные в строки CSV
    const csvRows = data.map(row => 
      headers.map(header => {
        let value = row[header];
        // Обрабатываем значения, которые содержат запятые или кавычки
        if (value && (value.includes(',') || value.includes('"'))) {
          value = `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    );
    
    // Добавляем строку заголовков
    csvRows.unshift(headers.join(','));
    
    // Добавляем BOM (Byte Order Mark) для правильной кодировки UTF-8 в Excel
    const BOM = '\ufeff';
    const csvContent = BOM + csvRows.join('\n');
    
    // Создаем Blob и URL для скачивания
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    // Создаем ссылку для скачивания и симулируем клик
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(`Отчет успешно экспортирован в ${filename}`);
  } catch (error) {
    console.error('Ошибка экспорта данных:', error);
    toast.error(`Не удалось экспортировать данные: ${error.message}`);
  }
};

export default {
  initVehicleSearch,
  loadReportData,
  formatDate,
  formatDateForDisplay,
  exportToCsv
}; 