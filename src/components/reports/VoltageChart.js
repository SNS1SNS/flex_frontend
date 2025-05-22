import React, { useState, useEffect, useRef } from 'react';
import BaseChart from './BaseChart';
import { getAuthToken } from '../../utils/authUtils';
import { toast } from 'react-toastify';
import chartSyncActivator from '../../utils/ChartSyncActivator';
import { ensureValidDate, formatChartTimeLabel, formatChartTooltipTime, validateDateRange } from '../../utils/DateUtils';

// Активируем синхронизацию графиков при импорте компонента
if (!chartSyncActivator.initialized) {
  chartSyncActivator.initialize();
}

const VoltageChart = ({ vehicle, startDate: propsStartDate, endDate: propsEndDate }) => {
  const [chartData, setChartData] = useState([]);
  const [chartLabels, setChartLabels] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);
  
  // Состояние для хранения дат, которые будут синхронизироваться с localStorage
  const [startDate, setStartDate] = useState(propsStartDate);
  const [endDate, setEndDate] = useState(propsEndDate);

  // Преобразование из милливольт в вольты для отображения
  const toVolts = (millivolts) => millivolts / 1000;

  // Функция для получения данных из localStorage
  const getDateRangeFromLocalStorage = () => {
    try {
      const storedRange = localStorage.getItem('lastDateRange');
      if (!storedRange) {
        return { startDate: null, endDate: null };
      }
      
      const parsedRange = JSON.parse(storedRange);
      return {
        startDate: ensureValidDate(parsedRange.startDate),
        endDate: ensureValidDate(parsedRange.endDate)
      };
    } catch (error) {
      console.error('VoltageChart: Ошибка при чтении дат из localStorage:', error);
      return { startDate: null, endDate: null };
    }
  };

  // Эффект для инициализации и подписки на события изменения дат
  useEffect(() => {    
    // Обработчик события изменения диапазона дат (переработан для соответствия SpeedChart)
    const handleDateRangeChanged = (event) => {
      try {
        const { startDate: newStartDate, endDate: newEndDate, period, timestamp } = event.detail;
        
        // Проверяем, не слишком ли недавно мы сами обновили даты
        const now = new Date().getTime();
        const lastUpdate = window.lastDateUpdateTime || 0;
        
        // Если обновление было менее 1 секунды назад и это мы сами его сделали, игнорируем
        if ((now - lastUpdate) < 1000 && window.lastDateUpdateTime === timestamp) {
          console.log('VoltageChart: Игнорируем событие dateRangeChanged - недавнее собственное обновление');
          return;
        }
        
        console.log('VoltageChart: Получено событие изменения диапазона дат:', event.detail);
        
        // Если передан предустановленный период (неделя, месяц и т.д.)
        if (period) {
          console.log('VoltageChart: Обработка предустановленного периода:', period);
          
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
          
          console.log('VoltageChart: Обновление дат на основе периода:', {
            start: validStartDate.toISOString(),
            end: validEndDate.toISOString()
          });
          
          setStartDate(validStartDate);
          setEndDate(validEndDate);
          
          // После изменения дат график обновится автоматически из-за зависимости useEffect
          return;
        }
        
        // Проверяем наличие дат
        if (!newStartDate || !newEndDate) {
          if (event.detail.forceUpdate) {
            // Старый механизм с forceUpdate - сохраняем для обратной совместимости
            // Получаем актуальные данные из localStorage
            const { startDate: storedStartDate, endDate: storedEndDate } = getDateRangeFromLocalStorage();
            
            if (storedStartDate && storedEndDate) {
              // Проверяем, изменились ли даты
              const startChanged = !startDate || 
                Math.abs(storedStartDate.getTime() - startDate.getTime()) > 1000;
              const endChanged = !endDate || 
                Math.abs(storedEndDate.getTime() - endDate.getTime()) > 1000;
                
              if (startChanged || endChanged) {
                console.log('VoltageChart: Обновление дат из localStorage через forceUpdate:', {
                  startDate: storedStartDate.toISOString(),
                  endDate: storedEndDate.toISOString()
                });
                
                setStartDate(storedStartDate);
                setEndDate(storedEndDate);
              }
            }
          } else {
            console.warn('VoltageChart: Получены неполные данные в событии dateRangeChanged:', event.detail);
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
          console.log('VoltageChart: Обновление дат из события:', {
            startDate: validStartDate.toISOString(),
            endDate: validEndDate.toISOString()
          });
          
          setStartDate(validStartDate);
          setEndDate(validEndDate);
        } else {
          console.log('VoltageChart: Даты не изменились, обновление не требуется');
        }
      } catch (error) {
        console.error('VoltageChart: Ошибка при обработке события изменения дат:', error);
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
          console.log('VoltageChart: Игнорируем событие dateRangeChangedInTab - недавнее собственное обновление');
          return;
        }
        
        console.log('VoltageChart: Получено событие изменения дат в текущей вкладке:', {
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
          console.log('VoltageChart: Обновление дат из события в текущей вкладке:', {
            startDate: validStartDate.toISOString(),
            endDate: validEndDate.toISOString()
          });
          
          setStartDate(validStartDate);
          setEndDate(validEndDate);
        }
      } catch (error) {
        console.error('VoltageChart: Ошибка при обработке события изменения дат в текущей вкладке:', error);
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
            console.log('VoltageChart: Игнорируем событие storage - недавнее собственное обновление');
            return;
          }
          
          console.log('VoltageChart: Обнаружено изменение диапазона дат в localStorage');
          
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
              console.log('VoltageChart: Обновление дат из localStorage:', {
                startDate: validStartDate.toISOString(),
                endDate: validEndDate.toISOString()
              });
              
              setStartDate(validStartDate);
              setEndDate(validEndDate);
            }
          }
        } catch (error) {
          console.warn('VoltageChart: Ошибка при разборе диапазона дат из localStorage:', error);
        }
      }
    };
    
    // При первой загрузке компонента читаем даты из localStorage
    const { startDate: initialStartDate, endDate: initialEndDate } = getDateRangeFromLocalStorage();
    
    // Если даты есть в localStorage и не установлены через пропсы, используем их
    if (initialStartDate && initialEndDate) {
      if (!propsStartDate) setStartDate(initialStartDate);
      if (!propsEndDate) setEndDate(initialEndDate);
      console.log('VoltageChart: Инициализированы даты из localStorage:', {
        startDate: initialStartDate.toISOString(),
        endDate: initialEndDate.toISOString()
      });
      
      // При инициализации сразу загружаем данные напряжения
      if (vehicle && vehicle.imei) {
        console.log('VoltageChart: Загрузка данных при инициализации из localStorage');
        setTimeout(() => {
          fetchVoltageData(initialStartDate, initialEndDate);
        }, 100);
      }
    }
    
    // Инициализируем время последнего обновления
    window.lastDateUpdateTime = window.lastDateUpdateTime || new Date().getTime();
    
    // Подписываемся на все события изменения дат
    document.addEventListener('dateRangeChanged', handleDateRangeChanged);
    document.addEventListener('dateRangeChangedInTab', handleDateRangeChangedInTab);
    window.addEventListener('storage', handleStorageChange);
    
    // Отписываемся при размонтировании
    return () => {
      document.removeEventListener('dateRangeChanged', handleDateRangeChanged);
      document.removeEventListener('dateRangeChangedInTab', handleDateRangeChangedInTab);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [startDate, endDate, propsStartDate, propsEndDate, vehicle]);

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
          console.log('VoltageChart: Получено событие изменения ТС:', {
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

  const fetchVoltageData = async (useStartDate = startDate, useEndDate = endDate) => {
    // Проверяем наличие ТС
    if (!vehicle || !vehicle.imei) {
      console.error('Не удалось получить IMEI транспортного средства');
      setError('Для получения данных о напряжении необходимо указать IMEI транспортного средства');
      setIsLoading(false);
      return;
    }
    
    // Проверяем даты
    if (!useStartDate || !useEndDate) {
      console.error('Не указаны даты для запроса данных о напряжении');
      setError('Необходимо указать период для получения данных о напряжении');
      setIsLoading(false);
      return;
    }
    
    // Логируем значения для отладки
    console.log('VoltageChart: Проверка типов перед validateDateRange:', {
      useStartDate: useStartDate,
      useStartDateType: typeof useStartDate,
      isDateObject: useStartDate instanceof Date,
      useEndDate: useEndDate,
      useEndDateType: typeof useEndDate,
      isEndDateObject: useEndDate instanceof Date
    });
    
    // Отменяем предыдущий запрос, если он выполняется
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Создаем новый контроллер прерывания
    abortControllerRef.current = new AbortController();
    
    setIsLoading(true);
    setError(null);
    
    // Убедимся, что даты являются объектами Date
    const startObj = useStartDate instanceof Date ? useStartDate : new Date(useStartDate);
    const endObj = useEndDate instanceof Date ? useEndDate : new Date(useEndDate);
    
    // Проверяем и исправляем диапазон дат перед запросом
    const { startDate: validStartDate, endDate: validEndDate } = validateDateRange(startObj, endObj);
    
    try {
      console.log(`VoltageChart: Запрос данных о напряжении для ТС ${vehicle.name || vehicle.imei} за период с ${validStartDate.toISOString()} по ${validEndDate.toISOString()}`);
      
      // Формируем URL для запроса
      const apiUrl = `/api/telemetry/v3/${vehicle.imei}/voltage?startTime=${validStartDate.toISOString()}&endTime=${validEndDate.toISOString()}`;
      
      // Получаем токен авторизации
      const authToken = getAuthToken();
      if (!authToken) {
        throw new Error('Ошибка авторизации: токен не найден');
      }
      
      // Подготавливаем заголовки
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${authToken}`
      };
      
      // Выполняем запрос
      const response = await fetch(apiUrl, { 
        method: 'GET',
        headers: headers,
        signal: abortControllerRef.current.signal
      });
      
      // Проверяем ответ
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ошибка API: ${response.status} - ${errorText || response.statusText}`);
      }
      
      const responseData = await response.json();
      
      console.log('VoltageChart: Получен ответ от API:', responseData);
      
      // Проверяем формат данных
      if (responseData && typeof responseData === 'object') {
        // Проверяем есть ли поле points
        if (Array.isArray(responseData.points)) {
          // Если в points нет данных
          if (responseData.points.length === 0) {
            console.warn(`VoltageChart: API вернул пустой массив данных о напряжении для ${vehicle.name || vehicle.imei}`);
            setChartData([]);
            setChartLabels([]);
            setIsLoading(false);
            setError(`Нет данных о напряжении за выбранный период для ТС ${vehicle.name || vehicle.imei}`);
            return;
          }
          
          console.log(`VoltageChart: Получено ${responseData.points.length} точек для графика напряжения ${vehicle.name || vehicle.imei}`);
          
          // Изучаем структуру первого элемента для отладки
          if (responseData.points.length > 0) {
            console.log('VoltageChart: Пример структуры данных:', responseData.points[0]);
          }
          
          // Обрабатываем данные
          const processedData = preprocessVoltageData(responseData.points);
          
          // Проверяем обработанные данные
          if (processedData.values.length === 0) {
            console.warn('VoltageChart: После обработки данных не осталось точек для графика');
            setError('Не удалось обработать полученные данные');
            setChartData([]);
            setChartLabels([]);
          } else {
            // Обновляем состояние компонента
            setChartData(processedData.values);
            setChartLabels(processedData.labels);
          }
        } else {
          // Неизвестный формат
          console.error('VoltageChart: API вернул неизвестный формат данных:', responseData);
          setError('Неизвестный формат данных');
          setChartData([]);
          setChartLabels([]);
        }
      } else {
        console.error('VoltageChart: API вернул неверный формат данных:', responseData);
        setError('Неверный формат данных');
        setChartData([]);
        setChartLabels([]);
      }
    } catch (err) {
      // Игнорируем ошибку отмены запроса
      if (err.name === 'AbortError') {
        console.log('VoltageChart: Запрос данных напряжения был отменен');
        return;
      }
      
      console.error('VoltageChart: Ошибка при загрузке данных:', err);
      setError(`Ошибка при загрузке данных: ${err.message}`);
      
      // Показываем всплывающее уведомление о критической ошибке
      if (err.message.includes('авторизации') || err.message.includes('401')) {
        toast.error('Ошибка авторизации. Пожалуйста, перезайдите в систему.', {
          position: "top-right",
          autoClose: 5000
        });
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Функция для предварительной обработки данных напряжения
  const preprocessVoltageData = (rawData) => {
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
      console.log(`VoltageChart: Структура данных точки:`, 
                `время: ${firstItem._time || firstItem.time}`, 
                `напряжение: ${firstItem.value !== undefined ? firstItem.value : 'не найдено'}`);
    }
    
    // Отключено прореживание данных, чтобы отображать все точки
    let processedData = sortedData;
    
    // Преобразуем данные в формат для графика
    const values = [];
    const labels = [];
    
    for (const item of processedData) {
      // Получаем значение времени (поддерживаем оба поля: time и _time)
      const timeField = item._time || item.time;
      if (!timeField) {
        console.warn('VoltageChart: Пропуск элемента без времени:', item);
        continue;
      }
      
      const timeValue = new Date(timeField);
      
      // Получаем значение напряжения
      let voltageValue = null;
      
      // В формате напряжение хранится в поле value
      if (typeof item.value === 'number') {
        voltageValue = item.value;
      }
      
      // Если не нашли подходящего поля, пропускаем точку
      if (voltageValue === null) {
        console.warn('VoltageChart: Пропуск элемента с неизвестным форматом данных напряжения:', item);
        continue;
      }
      
      // Добавляем точку в результаты
      values.push(voltageValue);
      labels.push(timeValue);
    }
    
    return { values, labels };
  };
  
  // Форматирование подписей осей
  const formatVoltageLabel = (value) => `${toVolts(value).toFixed(1)} В`;
  
  // Заменяем функцию formatTimeLabel на использование общей утилиты
  const formatTimeLabel = (date) => {
    return formatChartTimeLabel(date, startDate, endDate);
  };

  // Получение опций для графика
  const getChartOptions = () => {
    const options = {
      tooltips: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (tooltipItem) => formatVoltageLabel(tooltipItem.value),
          title: (tooltipItems) => {
            if (tooltipItems.length > 0) {
              const dateTime = tooltipItems[0].xLabel;
              if (dateTime && dateTime instanceof Date) {
                return formatChartTooltipTime(dateTime);
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
    
    // Можно добавить аннотации для критических уровней напряжения, если нужно
    // Например, минимально допустимый уровень
    options.annotation.annotations.push({
      type: 'line',
      mode: 'horizontal',
      scaleID: 'y-axis-0',
      value: 10500, // 10.5В - примерный уровень разряда аккумулятора
      borderColor: 'rgba(255, 0, 0, 0.5)',
      borderWidth: 1,
      label: {
        content: 'Мин. 10.5 В',
        enabled: true,
        position: 'right'
      }
    });
    
    return options;
  };
  
  // Подписка на событие обновления данных
  useEffect(() => {
    const handleForceUpdate = (event) => {
      if (event.detail) {
        // Проверяем, есть ли в событии информация о транспортном средстве
        if (event.detail.vehicle && vehicle?.imei !== event.detail.vehicle.imei) {
          console.log('VoltageChart: Получено новое ТС из события forceVehicleUpdate:', {
            oldImei: vehicle?.imei,
            newImei: event.detail.vehicle.imei,
            vehicleName: event.detail.vehicle.name || 'Неизвестно'
          });
          
          // Не вызываем fetchVoltageData здесь, т.к. он будет вызван автоматически 
          // при изменении vehicle через эффект, который следит за vehicle?.imei
          return;
        }
        
        // Если есть конкретные даты в событии, используем их
        if (event.detail.startDate && event.detail.endDate) {
          const validStartDate = ensureValidDate(event.detail.startDate);
          const validEndDate = ensureValidDate(event.detail.endDate);
          
          console.log('VoltageChart: Получены даты из события forceVehicleUpdate:', {
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
            
            // fetchVoltageData вызовется автоматически из-за изменения зависимостей
            return;
          }
        }
        
        // Предотвращаем множественные запросы в течение короткого времени
        if (abortControllerRef.current) {
          console.log('VoltageChart: Отмена предыдущего запроса для ТС', vehicle?.name || vehicle?.imei);
          abortControllerRef.current.abort();
        }
        
        // Используем setTimeout для снижения нагрузки при множественных событиях
        setTimeout(() => {
          if (vehicle?.imei) {
            console.log(`VoltageChart: Выполнение forceVehicleUpdate для ТС ${vehicle.name || vehicle.imei}`);
            fetchVoltageData();
          }
        }, 300);
      }
    };
    
    document.addEventListener('forceVehicleUpdate', handleForceUpdate);
    
    return () => {
      document.removeEventListener('forceVehicleUpdate', handleForceUpdate);
    };
  }, [vehicle, startDate, endDate]);
  
  // Эффект для загрузки данных при изменении параметров
  useEffect(() => {
    // Сохраняем текущее транспортное средство и даты в Ref, чтобы избежать race condition
    const currentVehicleImei = vehicle?.imei;
    
    if (currentVehicleImei && startDate && endDate) {
      console.log(`VoltageChart: Изменение параметров для ТС ${vehicle.name || currentVehicleImei}`);
      
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
          console.log(`VoltageChart: Запуск запроса данных для ТС ${vehicle.name || currentVehicleImei} после задержки`);
          fetchVoltageData();
        } else {
          console.log(`VoltageChart: ТС изменилось с ${currentVehicleImei} на ${vehicle?.imei}, запрос отменен`);
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
        <div className="voltage-metrics" style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '10px 15px',
          marginBottom: '15px',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div className="metric-item">
            <div style={{ fontSize: '12px', color: '#6c757d' }}>Макс. напряжение</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#495057' }}>
              {toVolts(metrics.maxVoltage).toFixed(1)} В
            </div>
          </div>
          <div className="metric-item">
            <div style={{ fontSize: '12px', color: '#6c757d' }}>Мин. напряжение</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#495057' }}>
              {toVolts(metrics.minVoltage).toFixed(1)} В
            </div>
          </div>
          <div className="metric-item">
            <div style={{ fontSize: '12px', color: '#6c757d' }}>Среднее напряжение</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#495057' }}>
              {toVolts(metrics.avgVoltage).toFixed(1)} В
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
      title="График напряжения"
      vehicle={vehicle}
      startDate={startDate}
      endDate={endDate}
      data={chartData}
      labels={chartLabels}
      color="rgb(32, 98, 191)"
      fetchData={fetchVoltageData}
      formatTooltipLabel={formatVoltageLabel}
      formatYAxisLabel={formatVoltageLabel}
      formatXAxisLabel={formatTimeLabel}
      emptyDataMessage="Нет данных о напряжении за выбранный период"
      isLoading={isLoading}
      error={error}
      options={getChartOptions()}
      reportType="voltage"
    />
    </>
  );
};

export default VoltageChart; 