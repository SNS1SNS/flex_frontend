import React, { useState, useEffect, useRef } from 'react';
import BaseChart from './BaseChart';
import { toast } from 'react-toastify';
import tokenService from '../../services/tokenService';
import chartSyncActivator from '../../utils/ChartSyncActivator';
import { ensureValidDate, getDateRangeFromLocalStorage, formatChartTimeLabel, formatChartTooltipTime, validateDateRange } from '../../utils/DateUtils';

// Активируем синхронизацию графиков при импорте компонента
if (!chartSyncActivator.initialized) {
  chartSyncActivator.initialize();
}

const EngineChart = ({ vehicle, startDate: propsStartDate, endDate: propsEndDate }) => {
  const [chartData, setChartData] = useState([]);
  const [chartLabels, setChartLabels] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);
  
  // Состояние для хранения дат, которые будут синхронизироваться с localStorage
  const [startDate, setStartDate] = useState(propsStartDate);
  const [endDate, setEndDate] = useState(propsEndDate);

  // Обновляем локальное состояние при изменении свойств
  useEffect(() => {
    if (propsStartDate) {
      setStartDate(propsStartDate);
    }
    if (propsEndDate) {
      setEndDate(propsEndDate);
    }
  }, [propsStartDate, propsEndDate]);

  // Функция для форматирования метки времени с использованием общей утилиты
  const formatTimeLabel = (date) => {
    return formatChartTimeLabel(date, startDate, endDate);
  };

  // Обновляем обработчик события изменения диапазона дат
  const handleDateRangeChanged = (event) => {
    try {
      const { startDate: newStartDate, endDate: newEndDate, period, timestamp, forceUpdate } = event.detail;
      
      console.log('EngineChart: Обработка события изменения диапазона дат:', event.detail);
      
      // Сохраняем метку времени последнего обновления
      window.lastDateUpdateTime = timestamp || new Date().getTime();
      
      // Если передан предустановленный период (неделя, месяц и т.д.)
      if (period) {
        console.log('EngineChart: Обработка предустановленного периода:', period);
        
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
        
        setStartDate(validStartDate);
        setEndDate(validEndDate);
        return;
      }
      
      // Проверяем наличие дат
      if (newStartDate && newEndDate) {
        // Преобразуем строковые даты в объекты Date используя общую утилиту
        const validStartDate = ensureValidDate(newStartDate);
        const validEndDate = ensureValidDate(newEndDate);
        
        console.log('EngineChart: Преобразованные даты:', {
          startDate: validStartDate.toISOString(),
          endDate: validEndDate.toISOString()
        });
        
        setStartDate(validStartDate);
        setEndDate(validEndDate);
      } else if (forceUpdate) {
        // Получаем даты из localStorage при forceUpdate используя общую утилиту
        const { startDate: storedStartDate, endDate: storedEndDate } = getDateRangeFromLocalStorage();
        
        if (storedStartDate && storedEndDate) {
          console.log('EngineChart: Даты из localStorage:', {
            startDate: storedStartDate.toISOString(),
            endDate: storedEndDate.toISOString()
          });
          
          setStartDate(storedStartDate);
          setEndDate(storedEndDate);
        }
      } else {
        console.warn('EngineChart: Получены неполные данные в событии dateRangeChanged:', event.detail);
      }
    } catch (error) {
      console.error('EngineChart: Ошибка при обработке события изменения дат:', error);
    }
  };

  // Функция принудительного обновления данных при смене транспортного средства
  const handleForceUpdate = (event) => {
    if (!event.detail) return;
    
    const { vehicleId } = event.detail;
    
    if (vehicle && vehicle.id === vehicleId) {
      console.log(`EngineChart: Принудительное обновление данных для ТС ${vehicleId}`);
      fetchEngineData();
    }
  };

  // Обрабатываем события изменения дат и смены транспортного средства
  useEffect(() => {
    document.addEventListener('dateRangeChanged', handleDateRangeChanged);
    document.addEventListener('forceVehicleUpdate', handleForceUpdate);
    
    return () => {
      document.removeEventListener('dateRangeChanged', handleDateRangeChanged);
      document.removeEventListener('forceVehicleUpdate', handleForceUpdate);
    };
  }, [vehicle, startDate, endDate]);

  // Основная функция для загрузки данных о состоянии двигателя
  const fetchEngineData = async () => {
    // Проверяем наличие ТС
    if (!vehicle || !vehicle.imei) {
      console.error('Не удалось получить IMEI транспортного средства');
      setError('Для получения данных о состоянии двигателя необходимо указать IMEI транспортного средства');
      setIsLoading(false);
      return;
    }
    
    // Проверяем даты
    if (!startDate || !endDate) {
      console.error('Не указаны даты для запроса данных о состоянии двигателя');
      setError('Необходимо указать период для получения данных о состоянии двигателя');
      setIsLoading(false);
      return;
    }
    
    // Отменяем предыдущий запрос, если он выполняется
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Создаем новый контроллер прерывания
    abortControllerRef.current = new AbortController();
    
    setIsLoading(true);
    setError(null);
    
    // Проверяем и исправляем диапазон дат
    const { startDate: validStartDate, endDate: validEndDate } = validateDateRange(startDate, endDate);
    
    // Форматируем даты для API
    const formattedStartDate = validStartDate.toISOString();
    const formattedEndDate = validEndDate.toISOString();
    
    try {
      console.log(`Запрос данных о состоянии двигателя для ${vehicle.name || vehicle.imei}:`, {
        imei: vehicle.imei,
        startDate: formattedStartDate,
        endDate: formattedEndDate
      });
      
      // Формируем URL для запроса
      const apiUrl = `/api/engine/${vehicle.imei}/state?startTime=${formattedStartDate}&endTime=${formattedEndDate}`;
      
      // Получаем заголовок авторизации с токеном
      const authHeader = tokenService.getAuthHeader();
      
      // Выполняем запрос к API с добавлением токена авторизации
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...authHeader  // Добавляем заголовок авторизации
        },
        signal: abortControllerRef.current.signal
      });
      
      // Проверяем ответ
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ошибка API: ${response.status} - ${errorText || response.statusText}`);
      }
      
      const responseData = await response.json();
      
      console.log('Получен ответ от API для состояния двигателя:', responseData);
      
      // Проверяем наличие данных в ответе
      if (responseData) {
        // Проверяем новый формат данных, где есть массив data с состоянием двигателя
        if (responseData.data && Array.isArray(responseData.data)) {
          console.log(`Получено ${responseData.data.length} точек данных о состоянии двигателя для ТС ${vehicle.name || vehicle.imei}`);
          
          // Обрабатываем данные
          const processedData = preprocessEngineData(responseData.data);
          
          if (processedData.values.length === 0) {
            console.warn('После обработки данных не осталось точек для графика состояния двигателя');
            setError('Не удалось обработать полученные данные о состоянии двигателя');
            setChartData([]);
            setChartLabels([]);
          } else {
            // Обновляем состояние компонента
            setChartData(processedData.values);
            setChartLabels(processedData.labels);
          }
        } 
        // Проверяем есть ли поле points, указывающее на старую структуру API
        else if (Array.isArray(responseData.points)) {
          console.log(`Получено ${responseData.points.length} точек для графика состояния двигателя ${vehicle.name || vehicle.imei}`);
          
          const processedData = preprocessEngineData(responseData.points);
          
          if (processedData.values.length === 0) {
            console.warn('После обработки данных не осталось точек для графика состояния двигателя');
            setError('Не удалось обработать полученные данные о состоянии двигателя');
            setChartData([]);
            setChartLabels([]);
          } else {
            // Обновляем состояние компонента
            setChartData(processedData.values);
            setChartLabels(processedData.labels);
          }
        } 
        // Если ответ сам является массивом
        else if (Array.isArray(responseData)) {
          console.log(`Получено ${responseData.length} точек для графика состояния двигателя ${vehicle.name || vehicle.imei}`);
          
          const processedData = preprocessEngineData(responseData);
          
          if (processedData.values.length === 0) {
            console.warn('После обработки данных не осталось точек для графика состояния двигателя');
            setError('Не удалось обработать полученные данные о состоянии двигателя');
            setChartData([]);
            setChartLabels([]);
          } else {
            // Обновляем состояние компонента
            setChartData(processedData.values);
            setChartLabels(processedData.labels);
          }
        } else {
          // Неизвестный формат
          console.error('API вернул неизвестный формат данных о состоянии двигателя:', responseData);
          setError('Неизвестный формат данных о состоянии двигателя');
          setChartData([]);
          setChartLabels([]);
        }
      } else {
        console.error('API вернул пустой ответ');
        setError('Не удалось получить данные о состоянии двигателя');
        setChartData([]);
        setChartLabels([]);
      }
    } catch (error) {
      // Проверяем, не отменен ли запрос
      if (error.name === 'AbortError') {
        console.log('Запрос данных о состоянии двигателя отменен');
        return;
      }
      
      console.error('Ошибка при загрузке данных о состоянии двигателя:', error);
      setError(`Ошибка загрузки данных: ${error.message}`);
      setChartData([]);
      setChartLabels([]);
      
      // Показываем уведомление об ошибке
      toast.error(`Ошибка загрузки данных о состоянии двигателя: ${error.message}`, {
        position: 'bottom-right',
        autoClose: 5000
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Функция для предварительной обработки данных состояния двигателя
  const preprocessEngineData = (rawData) => {
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
      console.log('Пример структуры данных точки состояния двигателя:', firstItem);
    }
    
    // Преобразуем данные в формат для графика
    const values = [];
    const labels = [];
    
    for (const item of sortedData) {
      // Получаем значение времени (поддерживаем все возможные поля: time, _time)
      const timeField = item._time || item.time;
      if (!timeField) {
        console.warn('Пропуск элемента без времени:', item);
        continue;
      }
      
      const timeValue = new Date(timeField);
      
      // Получаем значение состояния двигателя - проверяем разные варианты имени поля
      let engineValue = null;
      
      // Проверяем все возможные варианты имени поля
      if (typeof item.engineState === 'number') {
        engineValue = item.engineState;
      } 
      else if (typeof item.value === 'number') {
        engineValue = item.value;
      }
      else if (typeof item.state === 'number') {
        engineValue = item.state;
      }
      
      // Если не нашли подходящего поля, пропускаем точку
      if (engineValue === null) {
        console.warn('Пропуск элемента с неизвестным форматом данных состояния двигателя:', item);
        continue;
      }
      
      // Добавляем точку в результаты
      values.push(engineValue);
      labels.push(timeValue);
    }
    
    return { values, labels };
  };
  
  // Форматирование подписей осей для состояния двигателя
  const formatEngineLabel = (value) => {
    // Определяем текстовое описание состояния двигателя
    let stateText = "";
    
    if (value === 0) {
      stateText = "Выключен";
    } else if (value === 1) {
      stateText = "Включен";
    } else if (value > 0 && value < 1) {
      stateText = "Переходное";
    } else {
      stateText = value.toFixed(1);
    }
    
    return stateText;
  };
  
  // Получение опций для графика
  const getChartOptions = () => {
    return {
      scales: {
        y: {
          min: -0.1, // Начинаем немного ниже нуля для лучшей визуализации
          max: 1.1,  // Заканчиваем немного выше единицы
          ticks: {
            stepSize: 1,
            callback: function(value) {
              if (value === 0) return "Выключен";
              if (value === 1) return "Включен";
              return "";
            }
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
          tension: 0, // Убираем сглаживание для дискретных значений
          borderWidth: 2, // Устанавливаем толщину линии
          steppedLine: true // Ступенчатая линия для состояния двигателя
        }
      },
      tooltips: {
        callbacks: {
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
      }
    };
  };

  return (
    <>
      {/* {(debugInfo || engineInfo) && (
        <div className="chart-debug-info" style={{
          padding: '8px 12px',
          margin: '0 0 10px 0',
          backgroundColor: '#fff3cd',
          color: '#856404',
          borderRadius: '4px',
          fontSize: '14px'
        }}>
          {debugInfo && (
            <div><strong>Отладка:</strong> {debugInfo}</div>
          )}
          {engineInfo && (
            <div style={{ marginTop: debugInfo ? '8px' : '0' }}>
              <strong>Тип двигателя:</strong> {engineInfo.type || 'Не указан'}
              {engineInfo.voltageThreshold && (
                <span style={{ marginLeft: '15px' }}>
                  <strong>Порог напряжения:</strong> {engineInfo.voltageThreshold} В
                </span>
              )}
            </div>
          )}
        </div>
      )} */}
      
      <BaseChart
        title="Состояние двигателя"
        vehicle={vehicle}
        startDate={startDate}
        endDate={endDate}
        data={chartData}
        labels={chartLabels}
        color="rgb(43, 192, 65)" // Зеленый цвет для графика состояния двигателя
        fetchData={fetchEngineData}
        formatTooltipLabel={formatEngineLabel}
        formatYAxisLabel={formatEngineLabel}
        formatXAxisLabel={formatTimeLabel}
        emptyDataMessage="Нет данных о состоянии двигателя за выбранный период"
        isLoading={isLoading}
        error={error}
        options={getChartOptions()}
        reportType="engine" // Добавляем тип отчета для идентификации
      />
    </>
  );
};

export default EngineChart; 