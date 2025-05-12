import React, { useState, useEffect, useRef } from 'react';
import BaseChart from './BaseChart';
import { getAuthToken } from '../../utils/authUtils';
import { toast } from 'react-toastify';

const SpeedChart = ({ vehicle, startDate: propsStartDate, endDate: propsEndDate }) => {
  const [chartData, setChartData] = useState([]);
  const [chartLabels, setChartLabels] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);
  
  // Состояние для хранения дат, которые будут синхронизироваться с localStorage
  const [startDate, setStartDate] = useState(propsStartDate);
  const [endDate, setEndDate] = useState(propsEndDate);
  
  // Функция для обеспечения валидных дат (аналогично TrackMap)
  const ensureValidDate = (dateInput) => {
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
      console.warn('Невозможно создать валидную дату из:', dateInput);
      return new Date();
    } catch (error) {
      console.error('Ошибка при обработке даты:', error, dateInput);
      return new Date();
    }
  };
  
  // Эффект для инициализации дат из localStorage и подписки на их изменение
  useEffect(() => {
    // Функция для чтения дат из localStorage
    const getDateRangeFromLocalStorage = () => {
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
        console.warn('Ошибка при чтении диапазона дат из localStorage:', e);
      }
      return { startDate: null, endDate: null };
    };
    
    // Обработчик события изменения дат (переработан для соответствия TrackMap)
    const handleDateRangeChanged = (event) => {
      try {
        const { startDate: newStartDate, endDate: newEndDate, period, timestamp } = event.detail;
        
        // Проверяем, не слишком ли недавно мы сами обновили даты
        const now = new Date().getTime();
        const lastUpdate = window.lastDateUpdateTime || 0;
        
        // Если обновление было менее 1 секунды назад и это мы сами его сделали, игнорируем
        if ((now - lastUpdate) < 1000 && window.lastDateUpdateTime === timestamp) {
          console.log('SpeedChart: Игнорируем событие dateRangeChanged - недавнее собственное обновление');
          return;
        }
        
        console.log('SpeedChart: Получено событие изменения диапазона дат:', event.detail);
        
        // Если передан предустановленный период (неделя, месяц и т.д.)
        if (period) {
          console.log('SpeedChart: Обработка предустановленного периода:', period);
          
          // Создаем даты на основе предустановленного периода
          let validStartDate = new Date();
          let validEndDate = new Date();
          
          switch(period) {
            case 'day':
              // Текущий день
              validStartDate.setHours(0, 0, 0, 0);
              break;
            case 'week':
              // Последние 7 дней
              validStartDate = new Date(validEndDate);
              validStartDate.setDate(validEndDate.getDate() - 7);
              validStartDate.setHours(0, 0, 0, 0);
              break;
            case 'month':
              // Последние 30 дней
              validStartDate = new Date(validEndDate);
              validStartDate.setDate(validEndDate.getDate() - 30);
              break;
            case 'year':
              // Последние 365 дней
              validStartDate = new Date(validEndDate);
              validStartDate.setDate(validEndDate.getDate() - 365);
              break;
            default:
              // По умолчанию - неделя
              validStartDate = new Date(validEndDate);
              validStartDate.setDate(validEndDate.getDate() - 7);
          }
          
          // Сохраняем метку времени последнего обновления
          window.lastDateUpdateTime = timestamp || new Date().getTime();
          
          console.log('SpeedChart: Обновление дат на основе периода:', {
            start: validStartDate.toISOString(),
            end: validEndDate.toISOString()
          });
          
          setStartDate(validStartDate);
          setEndDate(validEndDate);
          
          return;
        }
        
        if (!newStartDate || !newEndDate) {
          if (event.detail.forceUpdate) {
            const { startDate: storedStartDate, endDate: storedEndDate } = getDateRangeFromLocalStorage();
            
            if (storedStartDate && storedEndDate) {
              const startChanged = !startDate || 
                Math.abs(storedStartDate.getTime() - startDate.getTime()) > 1000;
              const endChanged = !endDate || 
                Math.abs(storedEndDate.getTime() - endDate.getTime()) > 1000;
                
              if (startChanged || endChanged) {
                console.log('SpeedChart: Обновление дат из localStorage через forceUpdate:', {
                  startDate: storedStartDate.toISOString(),
                  endDate: storedEndDate.toISOString()
                });
                
                setStartDate(storedStartDate);
                setEndDate(storedEndDate);
              }
            }
          } else {
            console.warn('SpeedChart: Получены неполные данные в событии dateRangeChanged:', event.detail);
          }
          return;
        }
        
        // Обрабатываем полученные даты
        const validStartDate = ensureValidDate(newStartDate);
        const validEndDate = ensureValidDate(newEndDate);
        
        // Сохраняем метку времени последнего обновления
        window.lastDateUpdateTime = timestamp || new Date().getTime();
        
        // Проверяем, изменились ли даты
        const startChanged = !startDate || 
          Math.abs(validStartDate.getTime() - startDate.getTime()) > 1000;
        const endChanged = !endDate || 
          Math.abs(validEndDate.getTime() - endDate.getTime()) > 1000;
          
        if (startChanged || endChanged) {
          console.log('SpeedChart: Обновление дат из события:', {
            startDate: validStartDate.toISOString(),
            endDate: validEndDate.toISOString()
          });
          
          setStartDate(validStartDate);
          setEndDate(validEndDate);
        } else {
          console.log('SpeedChart: Даты не изменились, обновление не требуется');
        }
      } catch (error) {
        console.error('SpeedChart: Ошибка при обработке события изменения дат:', error);
      }
    };
    
    // Обработчик события изменения дат внутри текущей вкладки
    const handleDateRangeChangedInTab = (event) => {
      try {
        const { startDate: newStartDate, endDate: newEndDate, timestamp } = event.detail;
        
        // Проверяем, не слишком ли недавно мы сами обновили даты
        const now = new Date().getTime();
        const lastUpdate = window.lastDateUpdateTime || 0;
        
        // Если обновление было менее 1 секунды назад и это мы сами его сделали, игнорируем
        if ((now - lastUpdate) < 1000 && window.lastDateUpdateTime === timestamp) {
          console.log('SpeedChart: Игнорируем событие dateRangeChangedInTab - недавнее собственное обновление');
          return;
        }
        
        console.log('SpeedChart: Получено событие изменения дат в текущей вкладке:', {
          startDate: newStartDate instanceof Date ? newStartDate.toISOString() : newStartDate,
          endDate: newEndDate instanceof Date ? newEndDate.toISOString() : newEndDate
        });
        
        const validStartDate = ensureValidDate(newStartDate);
        const validEndDate = ensureValidDate(newEndDate);
        
        // Проверяем, изменились ли даты
        const startChanged = !startDate || 
          Math.abs(validStartDate.getTime() - startDate.getTime()) > 1000;
        const endChanged = !endDate || 
          Math.abs(validEndDate.getTime() - endDate.getTime()) > 1000;
          
        if (startChanged || endChanged) {
          console.log('SpeedChart: Обновление дат из события в текущей вкладке:', {
            startDate: validStartDate.toISOString(),
            endDate: validEndDate.toISOString()
          });
          
          setStartDate(validStartDate);
          setEndDate(validEndDate);
        }
      } catch (error) {
        console.error('SpeedChart: Ошибка при обработке события изменения дат в текущей вкладке:', error);
      }
    };
    
    // Обработчик события изменения в localStorage 
    const handleStorageChange = (event) => {
      if (event.key === 'lastDateRange') {
        try {
          // Проверяем, не слишком ли недавно мы сами обновили даты
          const now = new Date().getTime();
          const lastUpdate = window.lastDateUpdateTime || 0;
          
          // Если обновление было менее 1 секунды назад, игнорируем
          if ((now - lastUpdate) < 1000) {
            console.log('SpeedChart: Игнорируем событие storage - недавнее собственное обновление');
            return;
          }
          
          console.log('SpeedChart: Обнаружено изменение диапазона дат в localStorage');
          
          const newRange = JSON.parse(event.newValue);
          if (newRange && newRange.startDate && newRange.endDate) {
            const validStartDate = ensureValidDate(newRange.startDate);
            const validEndDate = ensureValidDate(newRange.endDate);
            
            // Проверяем, изменились ли даты
            const startChanged = !startDate || 
              Math.abs(validStartDate.getTime() - startDate.getTime()) > 1000;
            const endChanged = !endDate || 
              Math.abs(validEndDate.getTime() - endDate.getTime()) > 1000;
              
            if (startChanged || endChanged) {
              console.log('SpeedChart: Обновление дат из localStorage:', {
                startDate: validStartDate.toISOString(),
                endDate: validEndDate.toISOString()
              });
              
              setStartDate(validStartDate);
              setEndDate(validEndDate);
            }
          }
        } catch (error) {
          console.warn('SpeedChart: Ошибка при разборе диапазона дат из localStorage:', error);
        }
      }
    };
    
    // При первой загрузке компонента читаем даты из localStorage
    const { startDate: initialStartDate, endDate: initialEndDate } = getDateRangeFromLocalStorage();
    
    // Если даты есть в localStorage и не установлены через пропсы, используем их
    if (initialStartDate && initialEndDate) {
      if (!propsStartDate) setStartDate(initialStartDate);
      if (!propsEndDate) setEndDate(initialEndDate);
      console.log('SpeedChart: Инициализированы даты из localStorage:', {
        startDate: initialStartDate.toISOString(),
        endDate: initialEndDate.toISOString()
      });
    }
    
    // Подписываемся на все события изменения дат
    document.addEventListener('dateRangeChanged', handleDateRangeChanged);
    document.addEventListener('dateRangeChangedInTab', handleDateRangeChangedInTab);
    window.addEventListener('storage', handleStorageChange);
    
    // Отписка при размонтировании
    return () => {
      document.removeEventListener('dateRangeChanged', handleDateRangeChanged);
      document.removeEventListener('dateRangeChangedInTab', handleDateRangeChangedInTab);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [startDate, endDate, propsStartDate, propsEndDate]);
  
  // Обновляем даты из пропсов при их изменении
  useEffect(() => {
    if (propsStartDate) setStartDate(propsStartDate);
    if (propsEndDate) setEndDate(propsEndDate);
  }, [propsStartDate, propsEndDate]);
  
  // Добавляем обработчик события изменения текущего транспортного средства 
  useEffect(() => {
    const handleVehicleChanged = (event) => {
      // Проверяем наличие данных о ТС
      if (event.detail && event.detail.vehicle) {
        const newVehicle = event.detail.vehicle;
        
        // Проверяем, отличается ли новое ТС от текущего
        if (vehicle?.imei !== newVehicle.imei) {
          console.log('SpeedChart: Получено событие изменения ТС:', {
            oldImei: vehicle?.imei,
            newImei: newVehicle.imei,
            name: newVehicle.name || 'Неизвестно'
          });
          
          // Отменяем текущий запрос, если он есть
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
          }
          
          // Обнуляем данные для предотвращения отображения старых данных
          setChartData([]);
          setChartLabels([]);
          setError(null);
        }
      }
    };
    
    // Подписываемся на событие изменения ТС
    document.addEventListener('changeCurrentVehicle', handleVehicleChanged);
    
    return () => {
      document.removeEventListener('changeCurrentVehicle', handleVehicleChanged);
    };
  }, [vehicle]);
  
  // Эффект сбрасывает сообщение об ошибке через 10 секунд
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const fetchSpeedData = async () => {
    if (!vehicle || !vehicle.imei || !startDate || !endDate) {
      console.warn('Не выбран транспорт или период для загрузки данных о скорости');
      setError('Не выбран транспорт или не указан период');
      return;
    }

    // Проверяем даты на "будущность"
    const now = new Date();
    const startDateObj = startDate instanceof Date ? startDate : new Date(startDate);
    const endDateObj = endDate instanceof Date ? endDate : new Date(endDate);
    
    const debugData = {
      vehicle: vehicle.imei,
      vehicleName: vehicle.name || 'Неизвестно',
      startDate: startDateObj.toISOString(),
      endDate: endDateObj.toISOString(),
      now: now.toISOString(),
      isFutureStart: startDateObj > now,
      isFutureEnd: endDateObj > now
    };
    
    // Если дата в будущем, показываем предупреждение, но не блокируем запрос
    if (startDateObj > now || endDateObj > now) {
      console.warn('Запрос данных о скорости для будущих дат!', debugData);
      setError(`Внимание: запрос содержит будущие даты, данные могут отсутствовать. 
        Начало: ${startDateObj.toLocaleDateString()}, 
        Конец: ${endDateObj.toLocaleDateString()}`);
    } else {
      setError(null);
    }
    
    // Если есть предыдущий запрос, отменяем его
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Создаем новый AbortController для текущего запроса
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    // Сбрасываем ошибки и устанавливаем состояние загрузки
    setError(null);
    setIsLoading(true);

    try {
      // Преобразование дат в ISO формат для API
      const startISOString = startDateObj.toISOString();
      const endISOString = endDateObj.toISOString();

      // Получаем токен авторизации
      const authToken = getAuthToken();
      
      // Базовый URL API - заменяем с учетом текущего окружения
      // Определяем базовый URL в зависимости от среды запуска
      const baseUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:8081' 
        : `${window.location.protocol}//${window.location.host}`;
      
      // Формируем параметры запроса
      const params = new URLSearchParams({
        startTime: startISOString,
        endTime: endISOString
      });
      
      // Полный URL для API скорости
      const apiUrl = `${baseUrl}/api/telemetry/v3/${vehicle.imei}/speed?${params.toString()}`;
      
      // Подготавливаем заголовки
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      
      // Добавляем токен авторизации, если он есть
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      console.log(`Запрос данных о скорости для ТС ${vehicle.name || vehicle.imei}: ${apiUrl}`);
      
      // Выполняем запрос
      const response = await fetch(apiUrl, { 
        method: 'GET',
        headers: headers,
        signal: signal
      });
      
      // Проверяем ответ
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ошибка API: ${response.status} - ${errorText || response.statusText}`);
      }
      
      const responseData = await response.json();
      
      console.log('Получен ответ от API:', responseData);
      
      // Проверяем формат данных (новый формат с метаданными)
      if (responseData && typeof responseData === 'object') {
        // Проверяем есть ли поле points, указывающее на новую структуру API
        if (Array.isArray(responseData.points)) {
          // Это новый формат с полем points и метриками
          
          // Если в points нет данных
          if (responseData.points.length === 0) {
            console.warn(`API вернул пустой массив данных о скорости для ${vehicle.name || vehicle.imei}`);
            setChartData([]);
            setChartLabels([]);
            setIsLoading(false);
            setError(`Нет данных о скорости за выбранный период для ТС ${vehicle.name || vehicle.imei}`);
            return;
          }
          
          console.log(`Получено ${responseData.points.length} точек для графика скорости ${vehicle.name || vehicle.imei}`);
          
          // Изучаем структуру первого элемента для отладки
          if (responseData.points.length > 0) {
            console.log('Пример структуры данных:', responseData.points[0]);
          }
          
          // Обрабатываем точки из нового формата
          const processedData = preprocessSpeedData(responseData.points);
          
          if (processedData.values.length === 0) {
            console.warn('После обработки данных не осталось точек для графика');
            setError('Не удалось обработать полученные данные');
            setChartData([]);
            setChartLabels([]);
          } else {
            // Обновляем состояние компонента
            setChartData(processedData.values);
            setChartLabels(processedData.labels);
          }
        } else if (Array.isArray(responseData)) {
          // Это старый формат, где ответ - просто массив точек
          
          if (responseData.length === 0) {
            console.warn(`API вернул пустой массив данных о скорости для ${vehicle.name || vehicle.imei}`);
            setChartData([]);
            setChartLabels([]);
            setIsLoading(false);
            setError(`Нет данных о скорости за выбранный период для ТС ${vehicle.name || vehicle.imei}`);
            return;
          }
          
          console.log(`Получено ${responseData.length} точек для графика скорости ${vehicle.name || vehicle.imei}`);
          
          // Изучаем структуру первого элемента для отладки
          if (responseData.length > 0) {
            console.log('Пример структуры данных:', responseData[0]);
          }
          
          // Фильтруем и подготавливаем данные
          const processedData = preprocessSpeedData(responseData);
          
          if (processedData.values.length === 0) {
            console.warn('После обработки данных не осталось точек для графика');
            setError('Не удалось обработать полученные данные');
            setChartData([]);
            setChartLabels([]);
          } else {
            // Вычисляем метрики вручную для старого формата
            const maxSpeed = Math.max(...processedData.values);
            const avgSpeed = processedData.values.reduce((sum, val) => sum + val, 0) / processedData.values.length;
            
            setError(`Макс. скорость: ${maxSpeed} км/ч, Средняя скорость: ${avgSpeed.toFixed(2)} км/ч`);
            
            // Обновляем состояние компонента
            setChartData(processedData.values);
            setChartLabels(processedData.labels);
          }
        } else {
          // Неизвестный формат
          console.error('API вернул неизвестный формат данных:', responseData);
          setError('Неизвестный формат данных');
          setChartData([]);
          setChartLabels([]);
        }
      } else {
        console.error('API вернул неверный формат данных:', responseData);
        setError('Неверный формат данных');
        setChartData([]);
        setChartLabels([]);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Запрос данных о скорости был отменен');
      } else {
        console.error('Ошибка при загрузке данных скорости:', error);
        setError(error.message);
        // Показываем уведомление об ошибке
        toast.error(`Ошибка загрузки данных о скорости: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Эффект для первоначальной загрузки данных и обновления при изменении параметров
  useEffect(() => {
    // Сохраняем текущее транспортное средство и даты в Ref, чтобы избежать race condition
    const currentVehicleImei = vehicle?.imei;
    
    if (currentVehicleImei && startDate && endDate) {
      console.log(`SpeedChart: Изменение параметров для ТС ${vehicle.name || currentVehicleImei}`);
      
      // Отменяем предыдущий запрос, если он все еще выполняется
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Сбрасываем данные при изменении ТС для избежания отображения неправильных данных
      if (chartData.length > 0) {
        setChartData([]);
        setChartLabels([]);
      }
      
      // Добавляем небольшую задержку, чтобы избежать множественных запросов
      // Используем более длинную задержку для смены ТС, чтобы предотвратить "мерцание"
      const delay = 500;
      
      const timeoutId = setTimeout(() => {
        // Дополнительная проверка: убеждаемся, что ТС не изменилось с момента начала таймаута
        if (vehicle?.imei === currentVehicleImei) {
          console.log(`SpeedChart: Запуск запроса данных для ТС ${vehicle.name || currentVehicleImei} после задержки`);
          fetchSpeedData();
        } else {
          console.log(`SpeedChart: ТС изменилось с ${currentVehicleImei} на ${vehicle?.imei}, запрос отменен`);
        }
      }, delay);
      
      return () => {
        clearTimeout(timeoutId);
        // Очистка при изменении зависимостей (при размонтировании компонента или изменении ТС/дат)
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      };
    }
    
    // Очистка при размонтировании компонента
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [vehicle?.imei, startDate, endDate]);
  
  // Подписка на событие обновления данных
  useEffect(() => {
    const handleForceUpdate = (event) => {
      if (event.detail) {
        // Проверяем, есть ли в событии информация о транспортном средстве
        if (event.detail.vehicle && vehicle?.imei !== event.detail.vehicle.imei) {
          console.log('SpeedChart: Получено новое ТС из события forceVehicleUpdate:', {
            oldImei: vehicle?.imei,
            newImei: event.detail.vehicle.imei,
            vehicleName: event.detail.vehicle.name || 'Неизвестно'
          });
          
          // Не вызываем fetchSpeedData здесь, т.к. он будет вызван автоматически 
          // при изменении vehicle через эффект, который следит за vehicle?.imei
          return;
        }
        
        // Если есть конкретные даты в событии, используем их
        if (event.detail.startDate && event.detail.endDate) {
          const validStartDate = ensureValidDate(event.detail.startDate);
          const validEndDate = ensureValidDate(event.detail.endDate);
          
          console.log('SpeedChart: Получены даты из события forceVehicleUpdate:', {
            startDate: validStartDate.toISOString(),
            endDate: validEndDate.toISOString()
          });
          
          // Проверяем, изменились ли даты
          const startChanged = !startDate || 
            Math.abs(validStartDate.getTime() - startDate.getTime()) > 1000;
          const endChanged = !endDate || 
            Math.abs(validEndDate.getTime() - endDate.getTime()) > 1000;
            
          if (startChanged || endChanged) {
            setStartDate(validStartDate);
            setEndDate(validEndDate);
            
            // fetchSpeedData вызовется автоматически из-за изменения зависимостей
            return;
          }
        }
        
        // Предотвращаем множественные запросы в течение короткого времени
        if (abortControllerRef.current) {
          console.log('SpeedChart: Отмена предыдущего запроса для ТС', vehicle?.name || vehicle?.imei);
          abortControllerRef.current.abort();
        }
        
        // Используем setTimeout для снижения нагрузки при множественных событиях
        setTimeout(() => {
          if (vehicle?.imei) {
            console.log(`SpeedChart: Выполнение forceVehicleUpdate для ТС ${vehicle.name || vehicle.imei}`);
            fetchSpeedData();
          }
        }, 300);
      }
    };
    
    document.addEventListener('forceVehicleUpdate', handleForceUpdate);
    
    return () => {
      document.removeEventListener('forceVehicleUpdate', handleForceUpdate);
    };
  }, [vehicle, startDate, endDate]);
  
  // Функция для предварительной обработки данных скорости
  const preprocessSpeedData = (rawData) => {
    // Проверяем наличие и корректность данных
    if (!Array.isArray(rawData) || rawData.length === 0) {
      return { values: [], labels: [] };
    }
    
    // Сортируем по времени
    const sortedData = [...rawData].sort((a, b) => {
      // Поддерживаем оба формата времени: time и _time
      const timeFieldA = a._time || a.time;
      const timeFieldB = b._time || b.time;
      
      const timeA = new Date(timeFieldA).getTime();
      const timeB = new Date(timeFieldB).getTime();
      return timeA - timeB;
    });
    
    // Выводим информацию о структуре данных
    if (sortedData.length > 0) {
      const firstItem = sortedData[0];
      console.log(`Структура данных точки:`, 
                  `время: ${firstItem._time || firstItem.time}`, 
                  `скорость: ${firstItem.value !== undefined ? firstItem.value : 'не найдено'}`);
    }
    
    // Отключено прореживание данных, чтобы отображать все точки
    // (раскомментируйте код ниже, если нужно включить прореживание)
    let processedData = sortedData;
    /*
    // Прореживаем данные, если их слишком много (более 1000 точек)
    if (sortedData.length > 1000) {
      const step = Math.ceil(sortedData.length / 1000);
      processedData = sortedData.filter((_, index) => index % step === 0);
      console.log(`Прореживание данных: ${sortedData.length} -> ${processedData.length} точек`);
    }
    */
    
    // Преобразуем данные в формат для графика
    const values = [];
    const labels = [];
    
    for (const item of processedData) {
      // Получаем значение времени (поддерживаем оба поля: time и _time)
      const timeField = item._time || item.time;
      if (!timeField) {
        console.warn('Пропуск элемента без времени:', item);
        continue;
      }
      
      const timeValue = new Date(timeField);
      
      // Получаем значение скорости
      let speedValue = null;
      
      // В новом формате скорость хранится в поле value
      if (typeof item.value === 'number') {
        speedValue = item.value;
      }
      // Для обратной совместимости
      else if (typeof item.speed === 'number') {
        speedValue = item.speed;
      }
      
      // Если не нашли подходящего поля, пропускаем точку
      if (speedValue === null) {
        console.warn('Пропуск элемента с неизвестным форматом данных скорости:', item);
        continue;
      }
      
      // Добавляем точку в результаты
      values.push(speedValue);
      labels.push(timeValue);
    }
    
    return { values, labels };
  };
  
  // Форматирование подписей осей
  const formatSpeedLabel = (value) => `${value} км/ч`;
  
  // Форматирование временных меток на оси X
  const formatTimeLabel = (dateTime) => {
    if (!dateTime || !(dateTime instanceof Date)) return '';
    
    // Опции форматирования для казахстанского времени
    const options = {
      timeZone: 'Asia/Almaty',
      day: 'numeric',
      month: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    
    // Если данные за несколько дней, добавляем дату
    if (startDate && endDate) {
      const startDateObj = startDate instanceof Date ? startDate : new Date(startDate);
      const endDateObj = endDate instanceof Date ? endDate : new Date(endDate);
      
      const diffInDays = Math.floor((endDateObj.getTime() - startDateObj.getTime()) / (24 * 60 * 60 * 1000));
      
      if (diffInDays > 30) {
        // Для большого диапазона показываем только день и месяц
        return dateTime.toLocaleString('ru-RU', {
          timeZone: 'Asia/Almaty',
          day: 'numeric',
          month: 'numeric'
        });
      } else if (diffInDays > 2) {
        // Для нескольких дней показываем день, месяц и время
        return dateTime.toLocaleString('ru-RU', options);
      }
    }
    
    // Для небольшого интервала показываем только часы и минуты
    return dateTime.toLocaleString('ru-RU', {
      timeZone: 'Asia/Almaty',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Получение максимальной и минимальной скорости для подсветки нарушений
  const getChartOptions = () => {
    const options = {
      tooltips: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (tooltipItem) => formatSpeedLabel(tooltipItem.value),
          title: (tooltipItems) => {
            if (tooltipItems.length > 0) {
              const dateTime = tooltipItems[0].xLabel;
              if (dateTime && dateTime instanceof Date) {
                return dateTime.toLocaleString('ru-RU', {
                  timeZone: 'Asia/Almaty',
                  day: 'numeric',
                  month: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                });
              }
            }
            return '';
          }
        }
      },
      elements: {
        point: {
          radius: 0, // Полностью отключаем точки для соответствия скриншоту
          hitRadius: 10, // Область для взаимодействия
          hoverRadius: 5, // Размер точки при наведении
        },
        line: {
          tension: 0, // Убираем сглаживание для получения прямых линий
          borderWidth: 2 // Устанавливаем толщину линии
        }
      },
      annotation: {
        annotations: []
      }
    };
    
    // Добавляем линию максимальной разрешенной скорости, если известна для этого транспорта
    if (vehicle && vehicle.maxSpeed && vehicle.maxSpeed > 0) {
      options.annotation.annotations.push({
        type: 'line',
        mode: 'horizontal',
        scaleID: 'y-axis-0',
        value: vehicle.maxSpeed,
        borderColor: 'rgba(255, 0, 0, 0.5)',
        borderWidth: 1,
        label: {
          content: `Макс. ${vehicle.maxSpeed} км/ч`,
          enabled: true,
          position: 'right'
        }
      });
    }
    
    return options;
  };
  
  return (
    <>
      {/* {debugInfo && (
        <div className="chart-debug-info" style={{
          padding: '8px 12px',
          margin: '0 0 10px 0',
          backgroundColor: '#fff3cd',
          color: '#856404',
          borderRadius: '4px',
          fontSize: '14px'
        }}>
          <strong>Отладка:</strong> {debugInfo}
        </div>
      )} */}
      
      {/* Блок метрик */}
      {/* {chartData.length > 0 && (
        <div className="speed-metrics" style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '10px 15px',
          marginBottom: '15px',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div className="metric-item">
            <div style={{ fontSize: '12px', color: '#6c757d' }}>Макс. скорость</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#495057' }}>
              {formatNumber(metrics.maxSpeed)} км/ч
            </div>
          </div>
          <div className="metric-item">
            <div style={{ fontSize: '12px', color: '#6c757d' }}>Средняя скорость</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#495057' }}>
              {formatNumber(metrics.avgSpeed)} км/ч
            </div>
          </div>
          <div className="metric-item">
            <div style={{ fontSize: '12px', color: '#6c757d' }}>Точек данных</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#495057' }}>
              {metrics.totalPoints || chartData.length}
            </div>
          </div>
        </div>
      )} */}
      
      <BaseChart
        title="График скорости"
        vehicle={vehicle}
        startDate={startDate}
        endDate={endDate}
        data={chartData}
        labels={chartLabels}
        color="rgb(75, 192, 192)"
        fetchData={fetchSpeedData}
        formatTooltipLabel={formatSpeedLabel}
        formatYAxisLabel={formatSpeedLabel}
        formatXAxisLabel={formatTimeLabel}
        emptyDataMessage="Нет данных о скорости за выбранный период"
        isLoading={isLoading}
        error={error}
        options={getChartOptions()}
      />
    </>
  );
};

export default SpeedChart; 