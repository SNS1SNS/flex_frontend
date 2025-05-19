import { useState, useEffect, useCallback } from 'react';

/**
 * Хук для синхронизации данных через localStorage.
 * Позволяет хранить и синхронизировать данные между различными компонентами и вкладками.
 * 
 * @param {Object} options - Опции для настройки хука
 * @param {Object} options.initialValues - Начальные значения для состояний
 * @param {Function} options.onVehicleChange - Колбэк, вызываемый при изменении транспортного средства
 * @param {Function} options.onDateRangeChange - Колбэк, вызываемый при изменении диапазона дат
 * @returns {Object} Объект с методами и состояниями для работы с синхронизируемыми данными
 */
const useLocalStorageSync = (options = {}) => {
  const {
    initialValues = {},
    onVehicleChange,
    onDateRangeChange
  } = options;

  // Состояния для хранения синхронизируемых данных
  const [currentVehicle, setCurrentVehicle] = useState(initialValues.vehicle || null);
  const [currentDateRange, setCurrentDateRange] = useState(initialValues.dateRange || {
    startDate: null,
    endDate: null
  });
  const [splitMode, setSplitMode] = useState(initialValues.splitMode || 'single');
  
  // Временные метки для предотвращения циклических обновлений
  const [lastVehicleUpdateTime, setLastVehicleUpdateTime] = useState(0);
  const [lastDateUpdateTime, setLastDateUpdateTime] = useState(0);

  /**
   * Функция для безопасного преобразования любого входного значения в валидный объект Date
   * 
   * @param {Date|string|number} dateInput - Входное значение даты
   * @returns {Date} Валидный объект Date
   */
  const ensureValidDate = useCallback((dateInput) => {
    try {
      // Если дата уже является объектом Date и она валидна
      if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
        return dateInput;
      }
      
      // Если дата - строка
      if (typeof dateInput === 'string') {
        // Проверяем, не является ли строка пустой или невалидной
        if (!dateInput || dateInput === 'Invalid Date') {
          console.warn('Получена невалидная строка даты:', dateInput);
          return new Date();
        }
        
        // Сначала пробуем обработать как день-месяц-год
        const parsedDate = parseDateString(dateInput);
        if (parsedDate) {
          return parsedDate;
        }
        
        // Если не удалось распарсить как день-месяц-год, пробуем стандартный метод
        const newDate = new Date(dateInput);
        if (!isNaN(newDate.getTime())) {
          return newDate;
        }
      }
      
      // Если дата - timestamp (число)
      if (typeof dateInput === 'number') {
        // Проверяем, не является ли число слишком малым или большим для валидного timestamp
        if (dateInput < 0 || dateInput > 8640000000000000) {
          console.warn('Невалидный timestamp:', dateInput);
          return new Date();
        }
        
        const newDate = new Date(dateInput);
        if (!isNaN(newDate.getTime())) {
          return newDate;
        }
      }
      
      // Если не удалось создать валидную дату, возвращаем текущую
      console.warn('Невозможно создать валидную дату из:', dateInput);
      return new Date(); // Текущая дата как безопасное значение по умолчанию
    } catch (error) {
      console.error('Ошибка при обработке даты:', error, dateInput);
      return new Date(); // Текущая дата как безопасное значение при ошибке
    }
  }, []);

  /**
   * Функция для парсинга строки даты в формате день-месяц-год в объект Date
   * 
   * @param {string} dateString - Строка с датой
   * @returns {Date|null} Объект Date или null при ошибке
   */
  const parseDateString = useCallback((dateString) => {
    try {
      if (!dateString) return null;
      
      // Проверяем формат dd.mm.yyyy
      if (dateString.includes('.')) {
        const parts = dateString.split('.');
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1; // Месяцы в JS начинаются с 0
          const year = parseInt(parts[2], 10);
          
          const date = new Date(year, month, day);
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
      }
      
      // Проверяем формат dd/mm/yyyy
      if (dateString.includes('/')) {
        const parts = dateString.split('/');
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1; // Месяцы в JS начинаются с 0
          const year = parseInt(parts[2], 10);
          
          const date = new Date(year, month, day);
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
      }
      
      // Пробуем стандартный парсинг
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date;
      }
      
      return null;
    } catch (error) {
      console.warn('Ошибка при парсинге строки даты:', error, dateString);
      return null;
    }
  }, []);

  /**
   * Проверка localStorage при инициализации
   */
  const checkLocalStorage = useCallback(() => {
    try {
      // Проверяем сохраненный транспорт
      const savedVehicle = localStorage.getItem('lastSelectedVehicle');
      if (savedVehicle) {
        const parsedVehicle = JSON.parse(savedVehicle);
        if (parsedVehicle && parsedVehicle.id) {
          console.log('Прочитаны данные транспорта из localStorage:', parsedVehicle);
          
          // Если текущее транспортное средство из props имеет приоритет, не используем его
          if (!initialValues.vehicle || !initialValues.vehicle.id) {
            // Нормализуем данные, если timestamp передан как число
            if (parsedVehicle.timestamp && typeof parsedVehicle.timestamp === 'number') {
              parsedVehicle.timestampDate = new Date(parsedVehicle.timestamp);
            }
            
            // Добавляем источник данных
            parsedVehicle._source = 'localStorage_initial';
            parsedVehicle._updateTimestamp = Date.now();
            
            setCurrentVehicle(parsedVehicle);
          }
        }
      }
      
      // Проверяем сохраненный диапазон дат
      const savedRange = localStorage.getItem('lastDateRange');
      if (savedRange) {
        const parsedRange = JSON.parse(savedRange);
        if (parsedRange.startDate && parsedRange.endDate) {
          console.log('Прочитан диапазон дат из localStorage:', parsedRange);
          
          // Используем нашу функцию для обеспечения валидных дат
          const newRange = {
            startDate: ensureValidDate(parsedRange.startDate),
            endDate: ensureValidDate(parsedRange.endDate)
          };
          
          setCurrentDateRange(newRange);
        }
      }
      
      // Проверяем сохраненный режим разделения
      const savedSplitMode = localStorage.getItem('splitScreenMode');
      if (savedSplitMode) {
        setSplitMode(savedSplitMode);
      }
    } catch (error) {
      console.warn('Ошибка при чтении данных из localStorage:', error);
    }
  }, [initialValues.vehicle, ensureValidDate]);

  /**
   * Сохранение диапазона дат в localStorage
   * 
   * @param {Object} range - Объект с диапазоном дат {startDate, endDate}
   * @param {number} timestamp - Временная метка операции
   */
  const saveDateRangeToLocalStorage = useCallback((range, timestamp) => {
    try {
      // Проверяем валидность дат перед сохранением
      if (!range || !range.startDate || !range.endDate) {
        console.warn('Попытка сохранить неполный диапазон дат:', range);
        return;
      }
      
      // Проверяем, что даты являются валидными объектами Date
      const startIsValid = range.startDate instanceof Date && !isNaN(range.startDate.getTime());
      const endIsValid = range.endDate instanceof Date && !isNaN(range.endDate.getTime());
      
      if (!startIsValid || !endIsValid) {
        console.warn('Попытка сохранить невалидные даты:', {
          startDate: range.startDate,
          startIsValid,
          endDate: range.endDate,
          endIsValid
        });
        return;
      }
      
      // Устанавливаем время начальной даты на 00:00:00.000
      const startDate = new Date(range.startDate);
      startDate.setHours(0, 0, 0, 0);
      
      // Сохраняем время последнего обновления для синхронизации
      const updateTimestamp = timestamp || Date.now();
      setLastDateUpdateTime(updateTimestamp);
      
      localStorage.setItem('lastDateRange', JSON.stringify({
        startDate: startDate.toISOString(),
        endDate: range.endDate.toISOString(),
        updateTimestamp
      }));
      
      console.log('Диапазон дат сохранен в localStorage:', {
        startDate: startDate.toISOString(),
        endDate: range.endDate.toISOString(),
        timestamp: updateTimestamp
      });
      
      // Создаем пользовательское событие для обновления других компонентов в этой вкладке
      const dateChangeEvent = new CustomEvent('dateRangeChangedInTab', {
        detail: {
          startDate: startDate, // Используем модифицированную дату с 00:00
          endDate: range.endDate,
          timestamp: updateTimestamp
        }
      });
      document.dispatchEvent(dateChangeEvent);
    } catch (error) {
      console.warn('Ошибка при сохранении диапазона дат в localStorage:', error);
    }
  }, []);

  /**
   * Сохранение данных транспорта в localStorage
   * 
   * @param {Object} vehicle - Объект с данными транспортного средства
   */
  const saveVehicleToLocalStorage = useCallback((vehicle) => {
    try {
      console.log('Сохранение данных транспортного средства в localStorage:', vehicle);
      
      if (!vehicle || !vehicle.id) {
        console.warn('Попытка сохранить некорректное транспортное средство:', vehicle);
        return;
      }
      
      // Запоминаем время сохранения для обнаружения собственных изменений
      const updateTimestamp = Date.now();
      setLastVehicleUpdateTime(updateTimestamp);
      
      // Сохраняем в localStorage
      localStorage.setItem('lastSelectedVehicle', JSON.stringify({
        ...vehicle,
        timestamp: updateTimestamp
      }));
      
      // Дополнительно создаем событие для синхронизации в рамках текущей вкладки
      // так как storage событие работает только между разными вкладками
      const syncEvent = new CustomEvent('vehicleSelectedInTab', {
        detail: {
          vehicle,
          timestamp: updateTimestamp
        }
      });
      document.dispatchEvent(syncEvent);
      
      console.log('Транспортное средство успешно сохранено в localStorage');
    } catch (error) {
      console.warn('Ошибка при сохранении данных транспорта в localStorage:', error);
    }
  }, []);

  /**
   * Обновление данных транспортного средства
   * 
   * @param {Object} vehicle - Объект с данными транспортного средства
   */
  const updateVehicle = useCallback((vehicle) => {
    if (!vehicle || !vehicle.id) {
      console.warn('Попытка обновить некорректное транспортное средство:', vehicle);
      return;
    }
    
    // Проверяем, изменилось ли транспортное средство
    if (currentVehicle && currentVehicle.id === vehicle.id) {
      console.log('Выбран тот же транспорт, обновление не требуется');
      return;
    }
    
    // Добавляем метку времени для принудительного обновления
    const vehicleWithTimestamp = {
      ...vehicle,
      _updateTimestamp: Date.now(),
      _source: 'update_method'
    };
    
    // Обновляем текущий транспорт
    setCurrentVehicle(vehicleWithTimestamp);
    
    // Сохраняем в localStorage
    saveVehicleToLocalStorage(vehicle);
    
    // Вызываем колбэк, если он предоставлен
    if (onVehicleChange) {
      onVehicleChange(vehicleWithTimestamp);
    }
  }, [currentVehicle, saveVehicleToLocalStorage, onVehicleChange]);

  /**
   * Обновление диапазона дат
   * 
   * @param {Object} dateRange - Объект с диапазоном дат {startDate, endDate}
   */
  const updateDateRange = useCallback((dateRange) => {
    if (!dateRange || !dateRange.startDate || !dateRange.endDate) {
      console.warn('Попытка обновить неполный диапазон дат:', dateRange);
      return;
    }
    
    // Обеспечиваем валидность дат
    const updatedRange = {
      startDate: ensureValidDate(dateRange.startDate),
      endDate: ensureValidDate(dateRange.endDate)
    };
    
    // Проверяем, изменился ли диапазон дат
    const startDiff = !currentDateRange.startDate || 
      Math.abs(currentDateRange.startDate.getTime() - updatedRange.startDate.getTime()) > 1000;
    const endDiff = !currentDateRange.endDate || 
      Math.abs(currentDateRange.endDate.getTime() - updatedRange.endDate.getTime()) > 1000;
    
    if (!startDiff && !endDiff) {
      console.log('Диапазон дат не изменился, обновление не требуется');
      return;
    }
    
    console.log('Обновление диапазона дат:', {
      startDate: updatedRange.startDate.toISOString(),
      endDate: updatedRange.endDate.toISOString()
    });
    
    // Обновляем состояние
    setCurrentDateRange(updatedRange);
    
    // Сохраняем в localStorage
    saveDateRangeToLocalStorage(updatedRange);
    
    // Вызываем колбэк, если он предоставлен
    if (onDateRangeChange) {
      onDateRangeChange(updatedRange);
    }
  }, [currentDateRange, ensureValidDate, saveDateRangeToLocalStorage, onDateRangeChange]);

  /**
   * Обновление режима разделения экрана
   * 
   * @param {string} mode - Режим разделения ('single', 'horizontal', 'vertical', 'quad')
   */
  const updateSplitMode = useCallback((mode) => {
    setSplitMode(mode);
    localStorage.setItem('splitScreenMode', mode);
    
    // Отправляем событие для синхронизации с другими компонентами
    const event = new CustomEvent('splitModeChanged', {
      detail: { mode }
    });
    document.dispatchEvent(event);
  }, []);

  /**
   * Обработчик события изменения данных в localStorage между вкладками
   */
  useEffect(() => {
    const handleStorageChange = (event) => {
      try {
        // Проверяем, не слишком ли недавно мы сами обновили данные
        const now = Date.now();
        
        if (event.key === 'lastDateRange') {
          // Если обновление было менее 1 секунды назад и это мы сами его сделали, игнорируем
          if ((now - lastDateUpdateTime) < 1000) {
            console.log('Игнорируем событие storage - недавнее собственное обновление дат');
            return;
          }
          
          console.log('Обнаружено изменение диапазона дат в localStorage');
          try {
            const newRange = JSON.parse(event.newValue);
            if (newRange && newRange.startDate && newRange.endDate) {
              const updatedRange = {
                startDate: ensureValidDate(newRange.startDate),
                endDate: ensureValidDate(newRange.endDate)
              };
              setCurrentDateRange(updatedRange);
              
              // Вызываем колбэк, если он предоставлен
              if (onDateRangeChange) {
                onDateRangeChange(updatedRange);
              }
            }
          } catch (error) {
            console.warn('Ошибка при разборе диапазона дат из localStorage:', error);
          }
        } else if (event.key === 'lastSelectedVehicle') {
          // Если обновление было менее 1 секунды назад и это мы сами его сделали, игнорируем
          if ((now - lastVehicleUpdateTime) < 1000) {
            console.log('Игнорируем событие storage - недавнее собственное обновление транспорта');
            return;
          }
          
          console.log('Обнаружено изменение выбранного транспорта в localStorage');
          try {
            const newVehicle = JSON.parse(event.newValue);
            if (newVehicle && newVehicle.id) {
              console.log('Новые данные транспорта:', newVehicle);
              
              // Проверяем, отличается ли новый транспорт от текущего
              const vehicleChanged = !currentVehicle || currentVehicle.id !== newVehicle.id;
              
              if (vehicleChanged) {
                console.log('Транспорт изменился, обновляем состояние компонента');
                
                // Добавляем информацию об источнике данных
                const updatedVehicle = {
                  ...newVehicle,
                  _updateTimestamp: Date.now(),
                  _source: 'localStorage'
                };
                
                setCurrentVehicle(updatedVehicle);
                
                // Вызываем колбэк, если он предоставлен
                if (onVehicleChange) {
                  onVehicleChange(updatedVehicle);
                }
              } else {
                console.log('Транспорт не изменился, обновление не требуется');
              }
            }
          } catch (error) {
            console.warn('Ошибка при разборе данных транспорта из localStorage:', error);
          }
        } else if (event.key === 'splitScreenMode') {
          const newSplitMode = event.newValue;
          setSplitMode(newSplitMode);
        }
      } catch (error) {
        console.error('Ошибка при обработке изменений в localStorage:', error);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [currentVehicle, currentDateRange, lastVehicleUpdateTime, lastDateUpdateTime, 
      ensureValidDate, onVehicleChange, onDateRangeChange]);

  /**
   * Обработка пользовательских событий для синхронизации в рамках текущей вкладки
   */
  useEffect(() => {
    // Обработчик события изменения диапазона дат в рамках текущей вкладки
    const handleDateRangeChangedInTab = (event) => {
      try {
        const { startDate, endDate, timestamp } = event.detail;
        
        // Проверяем, был ли этот выбор сделан нами
        if (lastDateUpdateTime === timestamp) {
          console.log('Игнорируем собственное событие dateRangeChangedInTab');
          return;
        }
        
        console.log('Получено событие dateRangeChangedInTab:', {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        });
        
        // Проверяем, изменились ли даты
        let datesChanged = false;
        
        if (!currentDateRange.startDate || !currentDateRange.endDate) {
          datesChanged = true;
        } else {
          const startDiff = Math.abs(currentDateRange.startDate.getTime() - startDate.getTime()) > 1000;
          const endDiff = Math.abs(currentDateRange.endDate.getTime() - endDate.getTime()) > 1000;
          datesChanged = startDiff || endDiff;
        }
        
        if (datesChanged) {
          console.log('Даты изменились, обновляем состояние');
          
          const updatedRange = {
            startDate: ensureValidDate(startDate),
            endDate: ensureValidDate(endDate)
          };
          
          setCurrentDateRange(updatedRange);
          
          // Вызываем колбэк, если он предоставлен
          if (onDateRangeChange) {
            onDateRangeChange(updatedRange);
          }
        }
      } catch (error) {
        console.error('Ошибка при обработке события dateRangeChangedInTab:', error);
      }
    };
    
    // Обработчик события выбора транспорта в рамках текущей вкладки
    const handleVehicleSelectedInTab = (event) => {
      try {
        const { vehicle, timestamp } = event.detail;
        
        // Проверяем, был ли этот выбор сделан нами
        if (lastVehicleUpdateTime === timestamp) {
          console.log('Игнорируем собственное событие vehicleSelectedInTab');
          return;
        }
        
        if (vehicle && vehicle.id && (!currentVehicle || currentVehicle.id !== vehicle.id)) {
          console.log('Получено событие vehicleSelectedInTab:', vehicle);
          
          const updatedVehicle = {
            ...vehicle,
            _updateTimestamp: timestamp,
            _source: 'inTabEvent'
          };
          
          setCurrentVehicle(updatedVehicle);
          
          // Вызываем колбэк, если он предоставлен
          if (onVehicleChange) {
            onVehicleChange(updatedVehicle);
          }
        }
      } catch (error) {
        console.error('Ошибка при обработке события vehicleSelectedInTab:', error);
      }
    };
    
    // Регистрируем обработчики событий
    document.addEventListener('dateRangeChangedInTab', handleDateRangeChangedInTab);
    document.addEventListener('vehicleSelectedInTab', handleVehicleSelectedInTab);
    
    // Проверяем данные в localStorage при монтировании
    checkLocalStorage();
    
    return () => {
      document.removeEventListener('dateRangeChangedInTab', handleDateRangeChangedInTab);
      document.removeEventListener('vehicleSelectedInTab', handleVehicleSelectedInTab);
    };
  }, [currentVehicle, currentDateRange, lastVehicleUpdateTime, lastDateUpdateTime, 
      ensureValidDate, checkLocalStorage, onVehicleChange, onDateRangeChange]);

  // Возвращаем состояния и методы для использования в компоненте
  return {
    currentVehicle,
    currentDateRange,
    splitMode,
    updateVehicle,
    updateDateRange,
    updateSplitMode,
    saveVehicleToLocalStorage,
    saveDateRangeToLocalStorage,
    ensureValidDate
  };
};

export default useLocalStorageSync; 