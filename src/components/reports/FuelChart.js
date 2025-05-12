import React, { useState, useEffect, useRef, useCallback } from 'react';
import BaseChart from './BaseChart';
import { getAuthToken } from '../../utils/authUtils';
import { toast } from 'react-toastify';
import KalmanFilter from '../../utils/KalmanFilter';
import './FuelChart.css';

// Статические параметры фильтра Калмана
const KALMAN_PROCESS_NOISE = 0.0275;  // Q - шум процесса
const KALMAN_MEASUREMENT_NOISE = 2.10; // R - шум измерения

const FuelChart = ({ vehicle, startDate: propsStartDate, endDate: propsEndDate }) => {
  const [chartData, setChartData] = useState([]);
  const [chartLabels, setChartLabels] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showFiltered, setShowFiltered] = useState(true);
  const [kalmanParams, setKalmanParams] = useState({
    processNoise: KALMAN_PROCESS_NOISE,
    measurementNoise: KALMAN_MEASUREMENT_NOISE
  });
  const abortControllerRef = useRef(null);
  const kalmanFilterRef = useRef(new KalmanFilter(
    KALMAN_PROCESS_NOISE, 
    KALMAN_MEASUREMENT_NOISE
  ));
  
  // Состояние для хранения дат, которые будут синхронизироваться с localStorage
  const [startDate, setStartDate] = useState(propsStartDate || null);
  const [endDate, setEndDate] = useState(propsEndDate || null);
  
  // Функция для обеспечения валидных дат
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
  }, []);
  
  // Обновляем startDate и endDate, когда меняются props
  useEffect(() => {
    if (propsStartDate) {
      const validStartDate = ensureValidDate(propsStartDate);
      setStartDate(validStartDate);
    }
    
    if (propsEndDate) {
      const validEndDate = ensureValidDate(propsEndDate);
      setEndDate(validEndDate);
    }
  }, [propsStartDate, propsEndDate, ensureValidDate]);
  
  // Функция получения дат из localStorage
  const getDateRangeFromLocalStorage = useCallback(() => {
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
  }, [ensureValidDate]);
  
  // Загрузка данных при изменении дат или ТС - оптимизирована с useCallback
  const fetchFuelData = useCallback(async () => {
    if (!vehicle || !startDate || !endDate) {
      console.warn('FuelChart: Невозможно загрузить данные - отсутствует транспорт или даты');
      return;
    }

    // Если уже идет загрузка, отменяем предыдущий запрос
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Создаем новый AbortController для возможности отмены запроса
    abortControllerRef.current = new AbortController();
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Форматируем даты для запроса в формате ISO без миллисекунд
      const formatDateForAPI = (date) => {
        if (!date) return '';
        // Преобразуем в формат YYYY-MM-DDThh:mm:ssZ (без миллисекунд)
        return date.toISOString().split('.')[0] + 'Z';
      };
      
      const startISO = formatDateForAPI(startDate);
      const endISO = formatDateForAPI(endDate);
      
      // Проверяем наличие IMEI
      if (!vehicle.imei) {
        throw new Error('IMEI транспортного средства не определен');
      }
      
      // URL для запроса данных о топливе
      const url = `http://localhost:8081/api/fuel/${vehicle.imei}/liters?startTime=${startISO}&endTime=${endISO}`;
      
      console.log('FuelChart: Запрос данных топлива:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
        signal: abortControllerRef.current.signal
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Неизвестная ошибка');
        throw new Error(`Ошибка получения данных: ${response.status} ${response.statusText}. ${errorText}`);
      }
      
      const data = await response.json();
      console.log('FuelChart: Получены данные о топливе:', data);
      
      // Проверка на пустой ответ
      if (!data || !data.data || !Array.isArray(data.data)) {
        console.warn('FuelChart: Получен неверный формат данных:', data);
        setChartData([]);
        setChartLabels([]);
        setFilteredData([]);
        return;
      }
      
      // Обрабатываем полученные данные
      processFuelData(data);
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('FuelChart: Запрос был отменен');
        return;
      }
      
      console.error('FuelChart: Ошибка при загрузке данных о топливе:', error);
      setError(`Ошибка: ${error.message}`);
      toast.error(`Не удалось загрузить данные о топливе: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [vehicle, startDate, endDate]);
  
  // Обработка данных о топливе и применение фильтра Калмана
  const processFuelData = useCallback((data) => {
    if (!data || !data.data || !Array.isArray(data.data) || data.data.length === 0) {
      setChartData([]);
      setChartLabels([]);
      setFilteredData([]);
      return;
    }
    
    // Сортируем данные по времени
    const sortedData = [...data.data].sort((a, b) => 
      new Date(a.time).getTime() - new Date(b.time).getTime()
    );
    
    // Извлекаем метки времени и значения уровня топлива
    const labels = sortedData.map(item => new Date(item.time));
    const fuelValues = sortedData.map(item => item.liters);
    
    // Применяем фильтр Калмана к данным
    // Сначала убедимся, что фильтр настроен с актуальными параметрами
    kalmanFilterRef.current.setParams(kalmanParams);
    kalmanFilterRef.current.reset(fuelValues[0] || 0); // Инициализируем первым значением
    
    // Применяем фильтрацию
    const filtered = kalmanFilterRef.current.filterArray(fuelValues);
    
    // Сохраняем данные для графика
    setChartLabels(labels);
    setChartData(fuelValues);
    setFilteredData(filtered);
    
    console.log('FuelChart: Данные обработаны:', {
      labels: labels.length,
      rawValues: fuelValues.length,
      filteredValues: filtered.length
    });
  }, [kalmanParams]);
  
  // Функция для обновления параметров фильтра Калмана
  const updateKalmanParams = useCallback((newParams) => {
    setKalmanParams(prevParams => {
      const updatedParams = { ...prevParams, ...newParams };
      console.log('FuelChart: Обновление параметров фильтра Калмана:', updatedParams);
      
      // Если у нас уже есть данные, применяем новые параметры фильтрации
      if (chartData.length > 0) {
        kalmanFilterRef.current.setParams(updatedParams);
        kalmanFilterRef.current.reset(chartData[0] || 0);
        const newFiltered = kalmanFilterRef.current.filterArray(chartData);
        setFilteredData(newFiltered);
      }
      
      return updatedParams;
    });
  }, [chartData]);
  
  // Переключение отображения исходных/отфильтрованных данных
  const toggleFiltered = useCallback(() => {
    setShowFiltered(prev => !prev);
  }, []);
  
  // Эффект для инициализации дат из localStorage и подписки на их изменение
  useEffect(() => {
    // Обработчик события изменения дат
    const handleDateRangeChanged = (event) => {
      try {
        const { startDate: newStartDate, endDate: newEndDate, period, timestamp, forceUpdate } = event.detail;
        
        // Проверяем, не слишком ли недавно мы сами обновили даты
        const now = new Date().getTime();
        const lastUpdate = window.lastDateUpdateTime || 0;
        
        // Если обновление было менее 1 секунды назад и это мы сами его сделали, игнорируем
        if ((now - lastUpdate) < 1000 && window.lastDateUpdateTime === timestamp) {
          console.log('FuelChart: Игнорируем событие dateRangeChanged - недавнее собственное обновление');
          return;
        }
        
        console.log('FuelChart: Получено событие изменения диапазона дат:', event.detail);
        
        // Если передан предустановленный период (неделя, месяц и т.д.)
        if (period) {
          console.log('FuelChart: Обработка предустановленного периода:', period);
          
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
          
          console.log('FuelChart: Установка дат на основе периода:', {
            start: validStartDate.toISOString(),
            end: validEndDate.toISOString()
          });
          
          setStartDate(validStartDate);
          setEndDate(validEndDate);
          return;
        }
        
        // Проверяем наличие дат или запрос на принудительное обновление
        if ((!newStartDate || !newEndDate) && forceUpdate) {
          // Получаем актуальные данные из localStorage
          const { startDate: storedStartDate, endDate: storedEndDate } = getDateRangeFromLocalStorage();
          
          if (storedStartDate && storedEndDate) {
            // Проверяем, изменились ли даты
            const startChanged = !startDate || 
              Math.abs(storedStartDate.getTime() - startDate.getTime()) > 1000;
            const endChanged = !endDate || 
              Math.abs(storedEndDate.getTime() - endDate.getTime()) > 1000;
                
            if (startChanged || endChanged) {
              console.log('FuelChart: Установка дат из localStorage через forceUpdate:', {
                startDate: storedStartDate.toISOString(),
                endDate: storedEndDate.toISOString()
              });
              
              setStartDate(storedStartDate);
              setEndDate(storedEndDate);
            }
          }
          return;
        }
        
        // Обрабатываем полученные даты, если они есть
        if (newStartDate && newEndDate) {
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
            console.log('FuelChart: Установка дат из события:', {
              startDate: validStartDate.toISOString(),
              endDate: validEndDate.toISOString()
            });
            
            setStartDate(validStartDate);
            setEndDate(validEndDate);
          } else {
            console.log('FuelChart: Даты не изменились, обновление не требуется');
          }
        }
      } catch (error) {
        console.error('FuelChart: Ошибка при обработке события изменения дат:', error);
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
          console.log('FuelChart: Игнорируем событие dateRangeChangedInTab - недавнее собственное обновление');
          return;
        }
        
        console.log('FuelChart: Получено событие изменения дат в текущей вкладке:', {
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
          console.log('FuelChart: Обновление дат из события в текущей вкладке:', {
            startDate: validStartDate.toISOString(),
            endDate: validEndDate.toISOString()
          });
          
          setStartDate(validStartDate);
          setEndDate(validEndDate);
        }
      } catch (error) {
        console.error('FuelChart: Ошибка при обработке события изменения дат в текущей вкладке:', error);
      }
    };
    
    // Обработчик события изменения в localStorage 
    const handleStorageChange = (event) => {
      if (event.key === 'lastDateRange') {
        try {
          const newValue = JSON.parse(event.newValue);
          
          // Если данных нет, выходим
          if (!newValue || !newValue.startDate || !newValue.endDate) {
            return;
          }
          
          const validStartDate = ensureValidDate(newValue.startDate);
          const validEndDate = ensureValidDate(newValue.endDate);
          
          // Проверяем, изменились ли даты
          const startChanged = !startDate || 
            Math.abs(validStartDate.getTime() - startDate.getTime()) > 1000;
          const endChanged = !endDate || 
            Math.abs(validEndDate.getTime() - endDate.getTime()) > 1000;
            
          if (startChanged || endChanged) {
            console.log('FuelChart: Установка дат из localStorage:', {
              startDate: validStartDate.toISOString(),
              endDate: validEndDate.toISOString()
            });
            
            setStartDate(validStartDate);
            setEndDate(validEndDate);
          }
        } catch (error) {
          console.error('FuelChart: Ошибка при обработке изменения localStorage:', error);
        }
      }
    };
    
    // Обработчик события изменения выбранного ТС
    const handleVehicleChanged = (event) => {
      console.log('FuelChart: Получено событие смены транспорта:', event.detail);
      // Если это событие обновления данных после выбора ТС, то просто загружаем данные заново
      if (vehicle && startDate && endDate) {
        console.log('FuelChart: Перезагрузка данных после смены транспорта');
        fetchFuelData();
      }
    };
    
    // Обработчик события принудительного обновления графиков
    const handleForceUpdate = () => {
      console.log('FuelChart: Получено событие принудительного обновления');
      if (vehicle && startDate && endDate) {
        fetchFuelData();
      }
    };
    
    // Добавляем слушатели событий
    window.addEventListener('dateRangeChanged', handleDateRangeChanged);
    window.addEventListener('dateRangeChangedInTab', handleDateRangeChangedInTab);
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('vehicleChanged', handleVehicleChanged);
    window.addEventListener('forceUpdateCharts', handleForceUpdate);
    
    // Инициализация - проверяем, есть ли даты в состоянии, если нет - берем из localStorage
    if (!startDate || !endDate) {
      const { startDate: storedStartDate, endDate: storedEndDate } = getDateRangeFromLocalStorage();
      
      if (storedStartDate && storedEndDate) {
        console.log('FuelChart: Инициализация дат из localStorage:', {
          startDate: storedStartDate.toISOString(),
          endDate: storedEndDate.toISOString()
        });
        
        setStartDate(storedStartDate);
        setEndDate(storedEndDate);
      } else {
        // Если в localStorage нет дат, устанавливаем последнюю неделю
        const now = new Date();
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        
        console.log('FuelChart: Установка дат по умолчанию (неделя):', {
          startDate: weekAgo.toISOString(),
          endDate: now.toISOString()
        });
        
        setStartDate(weekAgo);
        setEndDate(now);
      }
    }
    
    return () => {
      // Удаляем слушатели событий при размонтировании
      window.removeEventListener('dateRangeChanged', handleDateRangeChanged);
      window.removeEventListener('dateRangeChangedInTab', handleDateRangeChangedInTab);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('vehicleChanged', handleVehicleChanged);
      window.removeEventListener('forceUpdateCharts', handleForceUpdate);
      
      // Отменяем все запросы при размонтировании
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [ensureValidDate, getDateRangeFromLocalStorage, startDate, endDate, vehicle, fetchFuelData]);
  
  // Загрузка данных при изменении дат или ТС
  useEffect(() => {
    if (vehicle && startDate && endDate) {
      console.log('FuelChart: Загрузка данных при изменении зависимостей:', { 
        vehicle: vehicle.imei,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
      fetchFuelData();
    }
  }, [vehicle, startDate, endDate, fetchFuelData]);
  
  // Форматирование метки для оси Y (значение топлива)
  const formatFuelLabel = (value) => `${value} л`;
  
  // Форматирование метки времени для оси X
  const formatTimeLabel = (dateTime) => {
    if (!dateTime) return '';
    
    const date = new Date(dateTime);
    
    // Проверяем валидность даты
    if (isNaN(date.getTime())) {
      return 'Неверная дата';
    }
    
    // Определяем диапазон дат
    const diffDays = startDate && endDate 
      ? Math.floor((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) 
      : 0;
    
    if (diffDays > 30) {
      // Для больших периодов показываем только день и месяц
      return date.toLocaleString('ru-RU', {
        timeZone: 'Asia/Almaty',
        day: 'numeric', 
        month: 'numeric'
      });
    } else if (diffDays > 3) {
      // Для периода более 3 дней - день, месяц и время
      return date.toLocaleString('ru-RU', {
        timeZone: 'Asia/Almaty',
        day: 'numeric',
        month: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } else {
      // Для коротких периодов показываем только время
      return date.toLocaleString('ru-RU', {
        timeZone: 'Asia/Almaty',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };
  
  // Создаем данные для графика с двумя линиями
  const getChartConfig = () => {
    return {
      labels: chartLabels,
      datasets: [
        {
          label: 'Исходные данные',
          data: chartData,
          fill: false,
          backgroundColor: 'rgba(64, 80, 255, 0.2)',
          borderColor: 'rgb(64, 80, 255)',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 5,
          tension: 0,
        },
        {
          label: 'Фильтр Калмана',
          data: showFiltered ? filteredData : [],
          fill: false,
          backgroundColor: 'rgba(255, 64, 64, 0.2)',
          borderColor: 'rgb(255, 64, 64)',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 5,
          tension: 0,
        }
      ]
    };
  };
  
  // Компонент для панели управления параметрами фильтра Калмана
  // const KalmanFilterControls = () => (
  //   <div className="kalman-filter-controls">
  //     <div className="filter-header">
  //       <h4>Параметры фильтра Калмана</h4>
  //       <label className="toggle-switch">
  //         <input 
  //           type="checkbox" 
  //           checked={showFiltered} 
  //           onChange={toggleFiltered} 
  //         />
  //         <span className="slider"></span>
  //         <span className="toggle-label">Показать фильтрацию</span>
  //       </label>
  //     </div>
  //     <div className="filter-params">
  //       <div className="param-control">
  //         <label>Шум процесса (Q): {kalmanParams.processNoise.toFixed(4)}</label>
  //         <input 
  //           type="range" 
  //           min="0.0001" 
  //           max="0.1" 
  //           step="0.0001" 
  //           value={kalmanParams.processNoise} 
  //           onChange={(e) => updateKalmanParams({ processNoise: parseFloat(e.target.value) })} 
  //           disabled
  //         />
  //       </div>
  //       <div className="param-control">
  //         <label>Шум измерения (R): {kalmanParams.measurementNoise.toFixed(2)}</label>
  //         <input 
  //           type="range" 
  //           min="0.1" 
  //           max="10" 
  //           step="0.1" 
  //           value={kalmanParams.measurementNoise} 
  //           onChange={(e) => updateKalmanParams({ measurementNoise: parseFloat(e.target.value) })} 
  //           disabled
  //         />
  //       </div>
  //     </div>
  //   </div>
  // );
  
  return (
    <div className="fuel-chart-container">
      {/* <KalmanFilterControls /> */}
      
      <div className="fuel-chart-content">
        {isLoading ? (
          <div className="chart-loading">
            <div>Загрузка данных...</div>
          </div>
        ) : error ? (
          <div className="chart-error">
            <div>{error}</div>
            <button onClick={fetchFuelData}>Повторить загрузку</button>
          </div>
        ) : chartData.length === 0 ? (
          <div className="chart-empty">
            <div>Нет данных о топливе за выбранный период</div>
            <button onClick={fetchFuelData}>Обновить</button>
          </div>
        ) : (
          <BaseChart
            title="Уровень топлива"
            vehicle={vehicle}
            startDate={startDate}
            endDate={endDate}
            data={getChartConfig()}
            fetchData={fetchFuelData}
            formatTooltipLabel={formatFuelLabel}
            formatYAxisLabel={formatFuelLabel}
            formatXAxisLabel={formatTimeLabel}
            emptyDataMessage="Нет данных о топливе за выбранный период"
            reportType="fuel"
            options={{
              tooltips: {
                mode: 'index',
                callbacks: {
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
              }
            }}
          />
        )}
      </div>
    </div>
  );
};

export default FuelChart; 