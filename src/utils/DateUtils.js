/**
 * Утилиты для работы с датами в компонентах графиков
 */

/**
 * Преобразует различные форматы даты в объект Date
 * Поддерживает:
 * - ISO строки: "2025-05-14T19:00:00.000Z"
 * - Локальный формат: "15.05.2025"
 * - Объекты Date
 * - Unix timestamp (число)
 * 
 * @param {*} dateInput - Дата в различном формате
 * @returns {Date} - Объект Date или текущая дата, если преобразование невозможно
 */
export const ensureValidDate = (dateInput) => {
  try {
    // Если дата уже является объектом Date и она валидна
    if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
      return dateInput;
    }
    
    // Если дата - строка
    if (typeof dateInput === 'string') {
      // Проверяем, не является ли строка пустой или невалидной
      if (!dateInput || dateInput === 'Invalid Date') {
        console.warn('DateUtils: Получена невалидная строка даты:', dateInput);
        return new Date();
      }
      
      // Проверяем формат DD.MM.YYYY
      if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateInput)) {
        const [day, month, year] = dateInput.split('.');
        const newDate = new Date(`${year}-${month}-${day}T00:00:00`);
        if (!isNaN(newDate.getTime())) {
          return newDate;
        }
      }
      
      // Пробуем стандартный метод
      const newDate = new Date(dateInput);
      if (!isNaN(newDate.getTime())) {
        return newDate;
      }
    }
    
    // Если дата - timestamp (число)
    if (typeof dateInput === 'number') {
      const newDate = new Date(dateInput);
      if (!isNaN(newDate.getTime())) {
        return newDate;
      }
    }
    
    // Если не удалось создать валидную дату, возвращаем текущую
    console.warn('DateUtils: Невозможно создать валидную дату из:', dateInput);
    return new Date();
  } catch (error) {
    console.error('DateUtils: Ошибка при обработке даты:', error, dateInput);
    return new Date();
  }
};

/**
 * Форматирует дату в локальный формат DD.MM.YYYY
 * 
 * @param {Date|string|number} date - Дата для форматирования
 * @returns {string} - Дата в формате DD.MM.YYYY
 */
export const formatToLocalDate = (date) => {
  try {
    const dateObj = ensureValidDate(date);
    return dateObj.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (e) {
    console.error('DateUtils: Ошибка при форматировании даты:', e);
    return '';
  }
};

/**
 * Получает даты из localStorage
 * 
 * @returns {Object} - Объект с началом и концом периода
 */
export const getDateRangeFromLocalStorage = () => {
  try {
    const storedRange = localStorage.getItem('lastDateRange');
    if (storedRange) {
      const parsed = JSON.parse(storedRange);
      return {
        startDate: parsed.startDate ? ensureValidDate(parsed.startDate) : null,
        endDate: parsed.endDate ? ensureValidDate(parsed.endDate) : null,
        updateTimestamp: parsed.updateTimestamp
      };
    }
  } catch (e) {
    console.warn('DateUtils: Ошибка при чтении диапазона дат из localStorage:', e);
  }
  return { startDate: null, endDate: null };
};

/**
 * Сохраняет даты в localStorage
 * 
 * @param {Date|string} startDate - Начало периода
 * @param {Date|string} endDate - Конец периода
 * @param {string} periodType - Тип периода (day, week, month, year)
 */
export const saveDateRangeToLocalStorage = (startDate, endDate, periodType = 'custom') => {
  try {
    const start = ensureValidDate(startDate);
    const end = ensureValidDate(endDate);
    
    const updateTimestamp = new Date().getTime();
    
    localStorage.setItem('lastDateRange', JSON.stringify({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      periodType,
      updateTimestamp
    }));
    
    // Сохраняем метку времени последнего обновления для предотвращения циклических обновлений
    window.lastDateUpdateTime = updateTimestamp;
    
    return updateTimestamp;
  } catch (e) {
    console.error('DateUtils: Ошибка при сохранении дат в localStorage:', e);
    return null;
  }
};

/**
 * Форматирует метку времени для оси X графика в зависимости от длительности периода
 * 
 * @param {Date|string|number} date - Дата для форматирования
 * @param {Date|string|number} startDate - Начало периода
 * @param {Date|string|number} endDate - Конец периода
 * @returns {string} - Отформатированная метка времени
 */
export const formatChartTimeLabel = (date, startDate, endDate) => {
  if (!date) return '';
  
  // Преобразуем входные данные в объекты Date
  const dateObj = ensureValidDate(date);
  const startObj = startDate ? ensureValidDate(startDate) : null;
  const endObj = endDate ? ensureValidDate(endDate) : null;
  
  // Проверяем корректность даты
  if (isNaN(dateObj.getTime())) {
    console.warn('DateUtils: Некорректная дата:', date);
    return 'Некорректная дата';
  }
  
  // Вычисляем разницу в днях
  const diffDays = startObj && endObj ? 
    Math.floor((endObj.getTime() - startObj.getTime()) / (24 * 60 * 60 * 1000)) : 0;
  
  // Форматируем в зависимости от длительности периода
  if (diffDays <= 1) {
    // Для одного дня показываем только время
    return dateObj.toLocaleString('ru-RU', {
      timeZone: 'Asia/Almaty',
      hour: '2-digit',
      minute: '2-digit'
    });
  } else if (diffDays <= 7) {
    // Для периода до недели - день и время
    return dateObj.toLocaleString('ru-RU', {
      timeZone: 'Asia/Almaty',
      day: 'numeric',
      month: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } else {
    // Для более длительных периодов - только день и месяц
    return dateObj.toLocaleString('ru-RU', {
      timeZone: 'Asia/Almaty',
      day: 'numeric',
      month: 'numeric'
    });
  }
};

/**
 * Форматирует метку времени для подсказки (tooltip) графика
 * 
 * @param {Date|string|number} date - Дата для форматирования
 * @returns {string} - Отформатированная метка времени для подсказки
 */
export const formatChartTooltipTime = (date) => {
  if (!date) return '';
  
  const dateObj = ensureValidDate(date);
  
  // Проверяем корректность даты
  if (isNaN(dateObj.getTime())) {
    return 'Некорректная дата';
  }
  
  // Для подсказок всегда показываем полную информацию
  return dateObj.toLocaleString('ru-RU', {
    timeZone: 'Asia/Almaty',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

/**
 * Вычисляет разницу в днях между двумя датами
 * 
 * @param {Date|string|number} startDate - Начальная дата
 * @param {Date|string|number} endDate - Конечная дата
 * @returns {number} - Количество дней между датами
 */
export const getDaysDifference = (startDate, endDate) => {
  if (!startDate || !endDate) return 0;
  
  const start = ensureValidDate(startDate);
  const end = ensureValidDate(endDate);
  
  return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
};

/**
 * Проверяет и исправляет диапазон дат для API запросов
 * Гарантирует, что начальная дата не позже конечной даты
 * 
 * @param {Date|string|number} startDate - Начальная дата
 * @param {Date|string|number} endDate - Конечная дата
 * @returns {Object} - Объект с валидными датами в формате Date { startDate, endDate }
 */
export const validateDateRange = (startDate, endDate) => {
  try {
    // Преобразуем даты в объекты Date
    const startObj = ensureValidDate(startDate);
    const endObj = ensureValidDate(endDate);
    
    // Проверяем, что начальная дата не позже конечной
    if (startObj.getTime() > endObj.getTime()) {
      console.warn('DateUtils: Начальная дата позже конечной, меняем местами:', {
        originalStart: startObj.toISOString(),
        originalEnd: endObj.toISOString()
      });
      
      // Меняем даты местами, чтобы диапазон был корректным
      return {
        startDate: endObj,
        endDate: startObj
      };
    }
    
    // Если все в порядке, возвращаем даты как есть
    return {
      startDate: startObj,
      endDate: endObj
    };
  } catch (error) {
    console.error('DateUtils: Ошибка при валидации диапазона дат:', error);
    // В случае ошибки возвращаем текущую дату и дату на неделю вперед
    const now = new Date();
    const weekLater = new Date();
    weekLater.setDate(now.getDate() + 7);
    
    return {
      startDate: now,
      endDate: weekLater
    };
  }
};

export default {
  ensureValidDate,
  formatToLocalDate,
  getDateRangeFromLocalStorage,
  saveDateRangeToLocalStorage,
  formatChartTimeLabel,
  formatChartTooltipTime,
  getDaysDifference,
  validateDateRange
}; 