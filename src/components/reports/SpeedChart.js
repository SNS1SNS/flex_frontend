import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTachometerAlt, faCalendarAlt, 
  faSync, faChartLine, 
  faCog, faInfoCircle, faGasPump, faCar, faBolt,
  faSearchPlus, faSearchMinus, faRedo, faExpand, faCompress
} from '@fortawesome/free-solid-svg-icons';
import './SpeedChart.css';

// Регистрируем необходимые компоненты Chart.js
ChartJS.register(
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend, 
  Filler, 
  zoomPlugin
);

// Конфигурация типов телеметрии
const TELEMETRY_TYPES = {
  speed: {
    title: 'График скорости',
    icon: faTachometerAlt,
    unit: 'км/ч',
    endpoint: 'speed',
    color: '#2c7be5',
    bgColor: 'rgba(44, 123, 229, 0.2)',
    limitValue: 90,
    limitLabel: 'Ограничение скорости',
    limitColor: 'rgba(255, 99, 132, 0.8)',
    enabled: false, // По умолчанию выключена
    statistics: {
      average: 'Средняя скорость',
      max: 'Максимальная скорость',
      movingTime: 'Время в движении',
      exceedCount: 'Превышения скорости'
    }
  },
  fuel: {
    title: 'График расхода топлива',
    icon: faGasPump,
    unit: 'л',
    endpoint: 'fuel',
    color: '#00d97e',
    bgColor: 'rgba(0, 217, 126, 0.2)',
    limitValue: null,
    limitLabel: 'Средний расход',
    limitColor: 'rgba(255, 193, 7, 0.8)',
    statistics: {
      average: 'Средний расход',
      max: 'Максимальный расход',
      movingTime: 'Время в движении',
      exceedCount: 'Заправки'
    }
  },
  rpm: {
    title: 'График оборотов двигателя',
    icon: faCar,
    unit: 'об/мин',
    endpoint: 'rpm',
    color: '#fd7e14',
    bgColor: 'rgba(253, 126, 20, 0.2)',
    limitValue: 3000,
    limitLabel: 'Рекомендуемые обороты',
    limitColor: 'rgba(220, 53, 69, 0.8)',
    statistics: {
      average: 'Средние обороты',
      max: 'Максимальные обороты',
      movingTime: 'Время работы',
      exceedCount: 'Превышения оборотов'
    }
  },
  voltage: {
    title: 'График напряжения',
    icon: faBolt,
    unit: 'В',
    endpoint: 'voltage',
    color: '#39afd1',
    bgColor: 'rgba(57, 175, 209, 0.2)',
    limitValue: 12,
    limitLabel: 'Нормальное напряжение',
    limitColor: 'rgba(108, 117, 125, 0.8)',
    statistics: {
      average: 'Среднее напряжение',
      max: 'Максимальное напряжение',
      movingTime: 'Время работы',
      exceedCount: 'Отклонения'
    }
  }
};

/**
 * Универсальный компонент для отображения графиков телеметрии
 * @param {Object} props - Свойства компонента
 * @param {Object} props.vehicle - Данные о транспортном средстве (id, name, imei)
 * @param {Date} props.startDate - Начальная дата диапазона (не используется, используем локальное состояние)
 * @param {Date} props.endDate - Конечная дата диапазона (не используется, используем локальное состояние)
 * @param {string} props.telemetryType - Тип телеметрии: 'speed', 'fuel', 'rpm', 'voltage'
 */
const TelemetryChart = ({ vehicle, telemetryType = 'speed' }) => {
  const [chartData, setChartData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statistics, setStatistics] = useState({
    average: '-',
    max: '-',
    movingTime: '-',
    exceedCount: '-'
  });
  const [selectedPeriod, setSelectedPeriod] = useState('day');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // Локальные состояния для дат с корректными начальными значениями
  const [localStartDate, setLocalStartDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  
  const [localEndDate, setLocalEndDate] = useState(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return today;
  });
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  
  // Получаем конфигурацию для текущего типа телеметрии
  const telemetryConfig = TELEMETRY_TYPES[telemetryType] || TELEMETRY_TYPES.speed;
  
  // Форматирование даты для отображения на графике
  const formatDateForChart = (dateString) => {
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };
  
  // Сброс зума для графика
  const resetZoom = () => {
    console.log('Вызвана функция resetZoom');
    try {
      if (chartRef.current) {
        console.log('chartRef.current найден:', chartRef.current);
        
        // Проверяем доступ к внутренним свойствам chartRef.current
        if (chartRef.current._reactInternals) {
          console.log('Найдены _reactInternals:', !!chartRef.current._reactInternals);
        }
        
        // Chart.js v4: использование метода getChart() для получения экземпляра
        const canvasElement = document.querySelector('.speed-chart canvas');
        if (canvasElement) {
          console.log('Canvas элемент найден');
          try {
            // Метод ChartJS.getChart появился в Chart.js v3+
            const chartInstance = ChartJS.getChart(canvasElement);
            if (chartInstance) {
              console.log('Экземпляр графика получен через ChartJS.getChart');
              
              // Chart.js v4 zoom plugin API
              if (chartInstance.zoom && typeof chartInstance.zoom === 'function') {
                console.log('Метод zoom найден, вызываем resetZoom');
                chartInstance.resetZoom();
                return;
              }
              
              // На случай если нужен прямой доступ к плагину зума в Chart.js v4
              if (chartInstance.options && chartInstance.options.plugins && chartInstance.options.plugins.zoom) {
                console.log('Плагин zoom найден в опциях');
                chartInstance.update();
                return;
              }
              
              console.warn('Метод resetZoom не найден на экземпляре графика');
            } else {
              console.warn('Экземпляр графика не получен через ChartJS.getChart');
            }
          } catch (e) {
            console.error('Ошибка при получении экземпляра графика:', e);
          }
        } else {
          console.warn('Canvas элемент не найден');
        }
        
        // Проверяем DOM-элементы для отладки
        console.log('Все canvas на странице:', document.querySelectorAll('canvas').length);
        console.log('Все элементы с классом .speed-chart:', document.querySelectorAll('.speed-chart').length);
      } else {
        console.warn('chartRef.current не определен');
      }
    } catch (error) {
      console.error('Ошибка при сбросе зума:', error);
    }
  };
  
  // Увеличение зума по оси Y
  const zoomIn = () => {
    try {
      if (chartRef.current) {
        const canvasElement = document.querySelector('.speed-chart canvas');
        if (canvasElement) {
          const chartInstance = ChartJS.getChart(canvasElement);
          if (chartInstance) {
            // Chart.js v4 zoom plugin API
            if (chartInstance.zoom && typeof chartInstance.zoom === 'function') {
              chartInstance.zoom(1.1);
              return;
            }
          }
        }
        console.warn('Объект графика не найден для увеличения зума');
      }
    } catch (error) {
      console.error('Ошибка при увеличении зума:', error);
    }
  };
  
  // Уменьшение зума по оси Y
  const zoomOut = () => {
    try {
      if (chartRef.current) {
        const canvasElement = document.querySelector('.speed-chart canvas');
        if (canvasElement) {
          const chartInstance = ChartJS.getChart(canvasElement);
          if (chartInstance) {
            // Chart.js v4 zoom plugin API
            if (chartInstance.zoom && typeof chartInstance.zoom === 'function') {
              chartInstance.zoom(0.9);
              return;
            }
          }
        }
        console.warn('Объект графика не найден для уменьшения зума');
      }
    } catch (error) {
      console.error('Ошибка при уменьшении зума:', error);
    }
  };
  
  // Обработка полноэкранного режима
  const toggleFullscreen = () => {
    if (!chartContainerRef.current) return;
    
    if (!isFullscreen) {
      if (chartContainerRef.current.requestFullscreen) {
        chartContainerRef.current.requestFullscreen();
      } else if (chartContainerRef.current.mozRequestFullScreen) {
        chartContainerRef.current.mozRequestFullScreen();
      } else if (chartContainerRef.current.webkitRequestFullscreen) {
        chartContainerRef.current.webkitRequestFullscreen();
      } else if (chartContainerRef.current.msRequestFullscreen) {
        chartContainerRef.current.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
    
    setIsFullscreen(!isFullscreen);
  };
  
  // Обработчик изменения полноэкранного режима
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);
  
  // Добавляем обработчик клавиатуры для сброса зума по клавише пробел
  useEffect(() => {
    // Создаем переменную для дебаунса
    let debounceTimer = null;
    // Флаг для предотвращения повторных вызовов
    let isProcessing = false;
    
    const handleKeyDown = (event) => {
      // Проверяем, что нажат пробел и не в поле ввода
      if ((event.code === 'Space' || event.key === ' ' || event.keyCode === 32) && 
         event.target.tagName !== 'INPUT' && 
         event.target.tagName !== 'TEXTAREA' && 
         !event.target.isContentEditable) {
        
        // Предотвращаем стандартное поведение
        event.preventDefault();
        
        // Если уже обрабатываем, пропускаем
        if (isProcessing) {
          console.log('Пропускаем обработку нажатия, предыдущий запрос еще в процессе');
          return;
        }
        
        // Устанавливаем флаг обработки
        isProcessing = true;
        
        // Очищаем предыдущий таймер дебаунса
        clearTimeout(debounceTimer);
        
        // Устанавливаем новый таймер
        debounceTimer = setTimeout(() => {
          console.log('Обработка нажатия клавиши пробел для сброса зума');
          
          // Проверяем загрузку графика
          if (!chartData) {
            console.warn('График еще не загружен, сброс зума невозможен');
            isProcessing = false;
            return;
          }
          
          // Выводим дополнительную информацию о состоянии графика
          console.log('Состояние chartRef.current:', chartRef.current);
          if (chartRef.current) {
            console.log('Объект chart в chartRef:', chartRef.current.chart);
            console.log('Наличие chartInstance:', !!chartRef.current.chartInstance);
          }
          
          // Проверяем наличие canvas-элемента
          const canvasElement = document.querySelector('.speed-chart canvas');
          console.log('Найден canvas-элемент:', !!canvasElement);
          if (canvasElement) {
            console.log('Доступные методы canvas:', Object.getOwnPropertyNames(canvasElement));
            
            try {
              const charts = ChartJS.instances;
              console.log('Все экземпляры графиков:', charts);
              
              // Попытка получить график по canvas
              const chart = ChartJS.getChart(canvasElement);
              console.log('График получен через ChartJS.getChart:', chart);
            } catch (e) {
              console.error('Ошибка при получении графика:', e);
            }
          }
          
          resetZoom();
          
          // Добавляем визуальную индикацию нажатия
          const resetBtn = document.querySelector('.speed-chart-btn[title="Сбросить масштаб (Пробел)"]');
          if (resetBtn) {
            resetBtn.classList.add('btn-flash');
            setTimeout(() => {
              resetBtn.classList.remove('btn-flash');
            }, 300);
          }
          
          // Сбрасываем флаг обработки
          isProcessing = false;
        }, 200); // Дебаунс 200 мс
      }
    };
    
    // Добавляем обработчик на document для гарантированного перехвата события
    document.addEventListener('keydown', handleKeyDown, true);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      clearTimeout(debounceTimer);
    };
  }, [chartData, resetZoom]); // Добавляем chartData и resetZoom как зависимости
  
  /**
   * Обработка полученных данных телеметрии
   * @param {Array} data - массив данных телеметрии
   */
  const processData = (data) => {
    // Подготовка данных для графика
    const labels = data.map(item => formatDateForChart(item.timestamp || item.time));
    const values = data.map(item => parseFloat(item.value));
    
    // Создаем массив данных для ограничения, если оно задано и включено
    const showLimit = telemetryConfig.limitValue && 
                    (telemetryConfig.enabled !== undefined ? telemetryConfig.enabled : true);
    
    const limitValues = showLimit ? Array(labels.length).fill(telemetryConfig.limitValue) : null;
    
    console.log(`Ограничение скорости ${showLimit ? 'включено' : 'отключено'}, значение: ${telemetryConfig.limitValue}`);
    
    // Анализируем изменения скорости для цветовой дифференциации
    const increaseSpeeds = [];
    const decreaseSpeeds = [];
    const exceedSpeeds = [];
    const normalSpeeds = [];
    
    for (let i = 0; i < values.length; i++) {
      const currentValue = values[i];
      
      // Проверка превышения только если ограничение включено
      const isExceeding = showLimit && currentValue > telemetryConfig.limitValue;
      
      // Определяем, является ли это повышением или понижением скорости
      if (i > 0) {
        const prevValue = values[i-1];
        const diff = currentValue - prevValue;
        
        // Если превышение скорости
        if (isExceeding) {
          exceedSpeeds.push({ x: labels[i], y: currentValue });
          increaseSpeeds.push(null);
          decreaseSpeeds.push(null);
          normalSpeeds.push(null);
        }
        // Если значительное повышение скорости (более 5 км/ч)
        else if (diff > 5) {
          increaseSpeeds.push({ x: labels[i], y: currentValue });
          decreaseSpeeds.push(null);
          exceedSpeeds.push(null);
          normalSpeeds.push(null);
        }
        // Если значительное снижение скорости (более 5 км/ч)
        else if (diff < -5) {
          decreaseSpeeds.push({ x: labels[i], y: currentValue });
          increaseSpeeds.push(null);
          exceedSpeeds.push(null);
          normalSpeeds.push(null);
        }
        // Обычная скорость
        else {
          normalSpeeds.push({ x: labels[i], y: currentValue });
          increaseSpeeds.push(null);
          decreaseSpeeds.push(null);
          exceedSpeeds.push(null);
        }
      } else {
        // Для первой точки
        if (isExceeding) {
          exceedSpeeds.push({ x: labels[i], y: currentValue });
          increaseSpeeds.push(null);
          decreaseSpeeds.push(null);
          normalSpeeds.push(null);
        } else {
          normalSpeeds.push({ x: labels[i], y: currentValue });
          increaseSpeeds.push(null);
          decreaseSpeeds.push(null);
          exceedSpeeds.push(null);
        }
      }
    }
    
    const datasets = [
      {
        label: `${telemetryConfig.title} (${telemetryConfig.unit})`,
        data: values,
        fill: false,
        backgroundColor: 'rgba(153, 216, 217, 0.5)',
        borderColor: 'rgba(153, 216, 217, 0.8)',
        tension: 0.2,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 1.5
      },
      {
        label: 'Повышение скорости',
        data: increaseSpeeds,
        fill: false,
        backgroundColor: 'rgba(0, 200, 150, 0.8)',
        borderColor: 'rgba(0, 200, 150, 0.8)',
        tension: 0,
        pointRadius: 3,
        pointHoverRadius: 5,
        segment: {
          borderColor: 'rgba(0, 200, 150, 0.8)',
        },
        spanGaps: false
      },
      {
        label: 'Снижение скорости',
        data: decreaseSpeeds,
        fill: false,
        backgroundColor: 'rgba(255, 140, 0, 0.8)',
        borderColor: 'rgba(255, 140, 0, 0.8)',
        tension: 0,
        pointRadius: 3,
        pointHoverRadius: 5,
        segment: {
          borderColor: 'rgba(255, 140, 0, 0.8)',
        },
        spanGaps: false
      },
      {
        label: 'Превышение скорости',
        data: exceedSpeeds,
        fill: false,
        backgroundColor: 'rgba(255, 99, 132, 0.8)',
        borderColor: 'rgba(255, 99, 132, 0.8)',
        tension: 0,
        pointRadius: 3,
        pointHoverRadius: 5,
        segment: {
          borderColor: 'rgba(255, 99, 132, 0.8)',
        },
        spanGaps: false
      }
    ];
    
    // Добавляем линию ограничения, если оно задано и включено
    if (limitValues !== null) {
      datasets.push({
        label: telemetryConfig.limitLabel,
        data: limitValues,
        fill: false,
        borderColor: telemetryConfig.limitColor,
        borderDash: [5, 5],
        pointRadius: 0,
        pointHoverRadius: 0,
        borderWidth: 2
      });
    }
    
    setChartData({
      labels,
      datasets
    });
    
    // Обновляем статистику с реальными данными
    const stats = calculateStatistics(data);
    setStatistics(stats);
  };
  
  /**
   * Установка демонстрационной статистики
   */
  const setDemoStatistics = () => {
    setStatistics({
      average: `52 ${telemetryConfig.unit}`,
      max: `95 ${telemetryConfig.unit}`,
      movingTime: '5ч 30мин',
      exceedCount: '3'
    });
  };
  
  /**
   * Расчет статистики на основе данных телеметрии
   * @param {Array} data - массив данных телеметрии
   * @returns {Object} - объект со статистикой
   */
  const calculateStatistics = (data) => {
    // Фильтруем только валидные значения
    const validValues = data
      .map(item => parseFloat(item.value))
      .filter(value => !isNaN(value));
    
    if (validValues.length === 0) {
      return {
        average: '-',
        max: '-',
        movingTime: '-',
        exceedCount: '-'
      };
    }
    
    // Расчет средней величины
    const avg = Math.round(validValues.reduce((sum, val) => sum + val, 0) / validValues.length);
    
    // Расчет максимальной величины
    const max = Math.max(...validValues);
    
    // Определяем, показывать ли ограничение
    const showLimit = telemetryConfig.limitValue && 
                    (telemetryConfig.enabled !== undefined ? telemetryConfig.enabled : true);
    
    // Количество превышений ограничения (если оно задано и включено)
    const exceedCount = showLimit 
      ? validValues.filter(value => value > telemetryConfig.limitValue).length
      : '-';
    
    // Примерное время активности (упрощенно: считаем точки с значением > 5% от максимального)
    const threshold = max * 0.05;
    const activePoints = validValues.filter(value => value > threshold).length;
    const totalMinutes = Math.round(activePoints * 5); // предполагаем, что точки снимаются раз в 5 минут
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return {
      average: `${avg} ${telemetryConfig.unit}`,
      max: `${max} ${telemetryConfig.unit}`,
      movingTime: `${hours}ч ${minutes}мин`,
      exceedCount: exceedCount === '-' ? '-' : `${exceedCount}`
    };
  };
  
  // Загрузка данных для выбранного периода
  const loadDataForPeriod = useCallback((period) => {
    setSelectedPeriod(period);
    
    // Определяем диапазон дат в зависимости от периода
    let start = new Date();
    let end = new Date();
    
    switch (period) {
      case 'day':
        // Сегодня - устанавливаем начало и конец дня (00:00:00 - 23:59:59)
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        console.log('Выбран период "день", установлен диапазон:', start, 'до', end);
        break;
      case 'yesterday':
        start = new Date();
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setHours(23, 59, 59, 999);
        break;
      case 'week':
        // Последние 7 дней
        start = new Date();
        start.setDate(start.getDate() - 7);
        // Устанавливаем конец текущего дня
        end.setHours(23, 59, 59, 999);
        break;
      case 'month':
        // Последние 30 дней
        start = new Date();
        start.setDate(start.getDate() - 30);
        // Устанавливаем конец текущего дня
        end.setHours(23, 59, 59, 999);
        break;
      default:
        // По умолчанию - сегодня с 00:00 до 23:59
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
    }
    
    // Обновляем локальные состояния дат
    setLocalStartDate(start);
    setLocalEndDate(end);
    
    // Загружаем данные для нового диапазона
    // Запускаем loadData в следующем тике, чтобы состояния успели обновиться
    setTimeout(() => loadData(), 0);
  }, [loadData]);
  
  /**
   * Загрузка данных телеметрии из API
   */
  const loadData = useCallback(async () => {
    if (!vehicle || !vehicle.imei) {
      console.warn('Нет доступных данных о ТС для загрузки телеметрии');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Преобразуем даты в строки ISO
      const startTimeStr = localStartDate.toISOString();
      const endTimeStr = localEndDate.toISOString();
      
      // URL API для получения данных телеметрии
      const apiUrl = `http://localhost:8081/api/telemetry/v3/${vehicle.imei}/${telemetryConfig.endpoint}?startTime=${startTimeStr}&endTime=${endTimeStr}`;
      
      console.log(`Загрузка данных ${telemetryConfig.title}: ${apiUrl}`);
      console.log(`Временной диапазон: с ${localStartDate.toLocaleString()} до ${localEndDate.toLocaleString()}`);
      
      // Получаем JWT токен для авторизации
      const getAuthToken = () => {
        // Проверяем различные варианты хранения токена
        const possibleTokenKeys = ['authToken', 'token', 'jwt', 'access_token'];
        
        for (const key of possibleTokenKeys) {
          const token = localStorage.getItem(key);
          if (token) {
            // Проверяем, является ли токен корректным JWT (содержит 2 точки)
            if (token.split('.').length === 3) {
              return token;
            }
          }
        }
        
        // Если не нашли JWT токен, возвращаем тестовый
        const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
        const payload = btoa(JSON.stringify({ 
          sub: 'test-user', 
          name: 'Test User', 
          role: 'ADMIN',
          exp: Math.floor(Date.now() / 1000) + 3600 // срок действия 1 час
        }));
        const signature = btoa('test-signature');
        
        return `${header}.${payload}.${signature}`;
      };
      
      // Выполняем запрос с использованием fetch
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Ошибка HTTP: ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Ответ сервера не является JSON');
      }
      
      // Получаем данные телеметрии
      const data = await response.json();
      console.log(`Получены данные ${telemetryConfig.title}:`, data);
      
      // Проверяем структуру данных и находим массив точек
      if (data) {
        // Проверяем, содержит ли ответ массив точек в поле data или points
        const points = data.data || data.points || data.values;
        
        if (points && Array.isArray(points) && points.length > 0) {
          // У нас есть массив точек в одном из стандартных полей
          processData(points);
        } else if (data.totalPoints && data.totalPoints > 0) {
          // Данные есть, но они в другом формате
          console.log('Данные получены в нестандартном формате, пытаемся обработать');
          
          // Попробуем использовать всё тело ответа как точки данных, если оно содержит нужные поля
          if (data.items && Array.isArray(data.items)) {
            processData(data.items);
          } else {
            // Создаем демо-данные, но с количеством точек, как в реальных данных
            const demoData = generateDemoDataWithCount(data.totalPoints || 24);
            setChartData(demoData);
            setDemoStatistics();
            console.warn('Используем демо-данные, имитирующие реальное количество точек:', data.totalPoints);
          }
        } else {
          console.warn(`Нет данных ${telemetryConfig.title} за выбранный период или непонятный формат данных`);
          
          // В режиме разработки используем демо данные
          if (process.env.NODE_ENV === 'development') {
            setDemoStatistics();
            setChartData(generateDemoData());
          }
        }
      } else {
        console.warn(`Пустой ответ от API ${telemetryConfig.title}`);
        
        // В режиме разработки используем демо данные
        if (process.env.NODE_ENV === 'development') {
          setDemoStatistics();
          setChartData(generateDemoData());
        }
      }
    } catch (error) {
      console.error(`Ошибка при загрузке данных ${telemetryConfig.title}:`, error);
      
      // Выводим дополнительную информацию об ошибке
      if (error.response) {
        console.warn('Статус ошибки:', error.response.status);
        console.warn('Детали ошибки:', error.response.data);
      } else {
        console.warn('Детали ошибки:', error.message);
      }
      
      // В режиме разработки используем демо данные
      if (process.env.NODE_ENV === 'development') {
        setDemoStatistics();
        setChartData(generateDemoData());
      }
    } finally {
      setIsLoading(false);
    }
  }, [vehicle, localStartDate, localEndDate, telemetryType, telemetryConfig]);
  
  // Опции для графика Chart.js
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          boxWidth: 10,
          font: {
            size: 12
          }
        }
      },
      title: {
        display: false
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        titleFont: {
          size: 13
        },
        bodyFont: {
          size: 12
        },
        padding: 10,
        cornerRadius: 6,
        callbacks: {
          label: function(context) {
            if (context.datasetIndex === 0) {
              return `${telemetryConfig.title}: ${context.parsed.y.toFixed(1)} ${telemetryConfig.unit}`;
            } else if (context.datasetIndex === 1 && telemetryConfig.limitValue) {
              return `${telemetryConfig.limitLabel}: ${context.parsed.y.toFixed(1)} ${telemetryConfig.unit}`;
            }
            return context.dataset.label;
          }
        }
      },
      // Настройки плагина зума
      zoom: {
        pan: {
          enabled: true,
          mode: 'x',
          modifierKey: 'ctrl',
        },
        zoom: {
          wheel: {
            enabled: true,
          },
          pinch: {
            enabled: true,
          },
          mode: 'x',
          drag: {
            enabled: true,
            borderColor: 'rgba(44, 123, 229, 0.3)',
            borderWidth: 1,
            backgroundColor: 'rgba(44, 123, 229, 0.1)',
          },
        },
        limits: {
          y: {min: 0},
        }
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Время',
          font: {
            size: 12,
            weight: 'normal'
          }
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          font: {
            size: 10
          },
          color: '#666'
        },
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.05)'
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: `${telemetryConfig.title} (${telemetryConfig.unit})`,
          font: {
            size: 12,
            weight: 'normal'
          }
        },
        min: 0,
        ticks: {
          font: {
            size: 11
          },
          color: '#666'
        },
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.05)'
        }
      }
    },
    interaction: {
      mode: 'nearest',
      intersect: false
    },
    animation: {
      duration: 1000
    },
    elements: {
      line: {
        borderWidth: 2
      },
      point: {
        radius: 2,
        hoverRadius: 5,
        borderWidth: 1
      }
    }
  };
  
  // Обработка изменения транспортного средства или типа телеметрии
  useEffect(() => {
    // Добавляем логирование при изменении транспортного средства
    if (vehicle) {
      console.log('Выбрано транспортное средство:', vehicle.name, 'IMEI:', vehicle.imei);
    }
    
    // Загружаем данные для выбранного транспортного средства
    loadData();
    
  }, [vehicle, telemetryType, loadData]); // Перезагружаем данные при смене vehicle или telemetryType
  
  // Добавляем слушатель события изменения диапазона дат
  useEffect(() => {
    const handleDateRangeChange = (event) => {
      if (event && event.detail) {
        const { startDate: newStartDate, endDate: newEndDate } = event.detail;
        
        // Обновляем период и даты
        if (newStartDate && newEndDate) {
          // Обновляем локальное состояние дат
          const newStart = new Date(newStartDate);
          const newEnd = new Date(newEndDate);
          
          // Определяем выбранный период
          const diffDays = Math.round((newEnd - newStart) / (1000 * 60 * 60 * 24));
          let period = 'custom';
          
          if (diffDays === 1) period = 'day';
          else if (diffDays === 7) period = 'week';
          else if (diffDays >= 28 && diffDays <= 31) period = 'month';
          
          setSelectedPeriod(period);
          
          // Загружаем данные для нового диапазона
          loadData();
        }
      }
    };
    
    window.addEventListener('dateRangeChanged', handleDateRangeChange);
    
    return () => {
      window.removeEventListener('dateRangeChanged', handleDateRangeChange);
    };
  }, [loadData]); // Зависимость только от loadData
  
  // Генерация демо-данных
  const generateDemoData = () => {
    const labels = [];
    const values = [];
    
    // Проверяем, включено ли отображение ограничения
    const showLimit = telemetryConfig.limitValue && 
                    (telemetryConfig.enabled !== undefined ? telemetryConfig.enabled : true);
    
    const limitValues = showLimit ? [] : null;
    
    // Создаем данные за 24 часа с интервалом в час
    const baseTime = new Date(localStartDate);
    
    // Генерируем данные с учетом времени суток
    for (let i = 0; i < 24; i++) {
      const currentTime = new Date(baseTime);
      currentTime.setHours(baseTime.getHours() + i);
      
      labels.push(formatDateForChart(currentTime.toISOString()));
      
      // Имитируем разную активность в зависимости от времени суток
      let value = 0;
      const hour = currentTime.getHours();
      const maxValue = telemetryType === 'speed' ? 100 :
                     telemetryType === 'fuel' ? 15 :
                     telemetryType === 'rpm' ? 5000 : 14;
      
      if (hour >= 8 && hour <= 20) { // Дневное время - активное движение
        if (hour >= 8 && hour <= 10) { // Утренний час пик
          value = maxValue * 0.5 + Math.random() * (maxValue * 0.5);
        } else if (hour >= 17 && hour <= 19) { // Вечерний час пик
          value = maxValue * 0.4 + Math.random() * (maxValue * 0.6);
        } else { // Обычное дневное время
          value = maxValue * 0.3 + Math.random() * (maxValue * 0.4);
        }
      } else { // Ночное время - меньше движения или стоянка
        if (Math.random() > 0.7) { // 30% вероятность движения ночью
          value = Math.random() * (maxValue * 0.7);
        } else {
          value = telemetryType === 'voltage' ? maxValue * 0.8 : 0; // Стоянка (для напряжения показываем значение)
        }
      }
      
      values.push(Math.round(value * 10) / 10); // Округляем до 1 десятичного знака
      
      if (limitValues !== null) {
        limitValues.push(telemetryConfig.limitValue);
      }
    }
    
    // Анализируем изменения скорости для цветовой дифференциации
    const increaseSpeeds = [];
    const decreaseSpeeds = [];
    const exceedSpeeds = [];
    const normalSpeeds = [];
    
    for (let i = 0; i < values.length; i++) {
      const currentValue = values[i];
      const isExceeding = showLimit && currentValue > telemetryConfig.limitValue;
      
      // Определяем, является ли это повышением или понижением скорости
      if (i > 0) {
        const prevValue = values[i-1];
        const diff = currentValue - prevValue;
        
        // Если превышение скорости
        if (isExceeding) {
          exceedSpeeds.push({ x: labels[i], y: currentValue });
          increaseSpeeds.push(null);
          decreaseSpeeds.push(null);
          normalSpeeds.push(null);
        }
        // Если значительное повышение скорости (более 5 км/ч)
        else if (diff > 5) {
          increaseSpeeds.push({ x: labels[i], y: currentValue });
          decreaseSpeeds.push(null);
          exceedSpeeds.push(null);
          normalSpeeds.push(null);
        }
        // Если значительное снижение скорости (более 5 км/ч)
        else if (diff < -5) {
          decreaseSpeeds.push({ x: labels[i], y: currentValue });
          increaseSpeeds.push(null);
          exceedSpeeds.push(null);
          normalSpeeds.push(null);
        }
        // Обычная скорость
        else {
          normalSpeeds.push({ x: labels[i], y: currentValue });
          increaseSpeeds.push(null);
          decreaseSpeeds.push(null);
          exceedSpeeds.push(null);
        }
      } else {
        // Для первой точки
        if (isExceeding) {
          exceedSpeeds.push({ x: labels[i], y: currentValue });
          increaseSpeeds.push(null);
          decreaseSpeeds.push(null);
          normalSpeeds.push(null);
        } else {
          normalSpeeds.push({ x: labels[i], y: currentValue });
          increaseSpeeds.push(null);
          decreaseSpeeds.push(null);
          exceedSpeeds.push(null);
        }
      }
    }
    
    const datasets = [
      {
        label: `${telemetryConfig.title} (${telemetryConfig.unit}) - ДЕМО`,
        data: values,
        fill: false,
        backgroundColor: 'rgba(153, 216, 217, 0.5)',
        borderColor: 'rgba(153, 216, 217, 0.8)',
        tension: 0.2,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 1.5
      },
      {
        label: 'Повышение скорости',
        data: increaseSpeeds,
        fill: false,
        backgroundColor: 'rgba(0, 200, 150, 0.8)',
        borderColor: 'rgba(0, 200, 150, 0.8)',
        tension: 0,
        pointRadius: 3,
        pointHoverRadius: 5,
        segment: {
          borderColor: 'rgba(0, 200, 150, 0.8)',
        },
        spanGaps: false
      },
      {
        label: 'Снижение скорости',
        data: decreaseSpeeds,
        fill: false,
        backgroundColor: 'rgba(255, 140, 0, 0.8)',
        borderColor: 'rgba(255, 140, 0, 0.8)',
        tension: 0,
        pointRadius: 3,
        pointHoverRadius: 5,
        segment: {
          borderColor: 'rgba(255, 140, 0, 0.8)',
        },
        spanGaps: false
      },
      {
        label: 'Превышение скорости',
        data: exceedSpeeds,
        fill: false,
        backgroundColor: 'rgba(255, 99, 132, 0.8)',
        borderColor: 'rgba(255, 99, 132, 0.8)',
        tension: 0,
        pointRadius: 3,
        pointHoverRadius: 5,
        segment: {
          borderColor: 'rgba(255, 99, 132, 0.8)',
        },
        spanGaps: false
      }
    ];
    
    if (limitValues !== null) {
      datasets.push({
        label: telemetryConfig.limitLabel,
        data: limitValues,
        fill: false,
        borderColor: telemetryConfig.limitColor,
        borderDash: [5, 5],
        pointRadius: 0,
        pointHoverRadius: 0,
        borderWidth: 2
      });
    }
    
    return {
      labels,
      datasets
    };
  };
  
  // Генерация демо-данных с заданным количеством точек
  const generateDemoDataWithCount = (count) => {
    const labels = [];
    const values = [];
    
    // Проверяем, включено ли отображение ограничения
    const showLimit = telemetryConfig.limitValue && 
                    (telemetryConfig.enabled !== undefined ? telemetryConfig.enabled : true);
    
    const limitValues = showLimit ? [] : null;
    
    // Создаем данные за указанное количество точек
    for (let i = 0; i < count; i++) {
      const currentTime = new Date(localStartDate);
      currentTime.setHours(0, 0, 0, 0);
      currentTime.setMinutes(i * 5); // Предполагаем, что точки снимаются раз в 5 минут
      
      labels.push(formatDateForChart(currentTime.toISOString()));
      
      // Имитируем разную активность в зависимости от времени суток
      let value = 0;
      const hour = currentTime.getHours();
      const maxValue = telemetryType === 'speed' ? 100 :
                     telemetryType === 'fuel' ? 15 :
                     telemetryType === 'rpm' ? 5000 : 14;
      
      if (hour >= 8 && hour <= 20) { // Дневное время - активное движение
        if (hour >= 8 && hour <= 10) { // Утренний час пик
          value = maxValue * 0.5 + Math.random() * (maxValue * 0.5);
        } else if (hour >= 17 && hour <= 19) { // Вечерний час пик
          value = maxValue * 0.4 + Math.random() * (maxValue * 0.6);
        } else { // Обычное дневное время
          value = maxValue * 0.3 + Math.random() * (maxValue * 0.4);
        }
      } else { // Ночное время - меньше движения или стоянка
        if (Math.random() > 0.7) { // 30% вероятность движения ночью
          value = Math.random() * (maxValue * 0.7);
        } else {
          value = telemetryType === 'voltage' ? maxValue * 0.8 : 0; // Стоянка (для напряжения показываем значение)
        }
      }
      
      values.push(Math.round(value * 10) / 10); // Округляем до 1 десятичного знака
      
      if (limitValues !== null) {
        limitValues.push(telemetryConfig.limitValue);
      }
    }
    
    // Анализируем изменения скорости для цветовой дифференциации
    const increaseSpeeds = [];
    const decreaseSpeeds = [];
    const exceedSpeeds = [];
    const normalSpeeds = [];
    
    for (let i = 0; i < values.length; i++) {
      const currentValue = values[i];
      const isExceeding = showLimit && currentValue > telemetryConfig.limitValue;
      
      // Определяем, является ли это повышением или понижением скорости
      if (i > 0) {
        const prevValue = values[i-1];
        const diff = currentValue - prevValue;
        
        // Если превышение скорости
        if (isExceeding) {
          exceedSpeeds.push({ x: labels[i], y: currentValue });
          increaseSpeeds.push(null);
          decreaseSpeeds.push(null);
          normalSpeeds.push(null);
        }
        // Если значительное повышение скорости (более 5 км/ч)
        else if (diff > 5) {
          increaseSpeeds.push({ x: labels[i], y: currentValue });
          decreaseSpeeds.push(null);
          exceedSpeeds.push(null);
          normalSpeeds.push(null);
        }
        // Если значительное снижение скорости (более 5 км/ч)
        else if (diff < -5) {
          decreaseSpeeds.push({ x: labels[i], y: currentValue });
          increaseSpeeds.push(null);
          exceedSpeeds.push(null);
          normalSpeeds.push(null);
        }
        // Обычная скорость
        else {
          normalSpeeds.push({ x: labels[i], y: currentValue });
          increaseSpeeds.push(null);
          decreaseSpeeds.push(null);
          exceedSpeeds.push(null);
        }
      } else {
        // Для первой точки
        if (isExceeding) {
          exceedSpeeds.push({ x: labels[i], y: currentValue });
          increaseSpeeds.push(null);
          decreaseSpeeds.push(null);
          normalSpeeds.push(null);
        } else {
          normalSpeeds.push({ x: labels[i], y: currentValue });
          increaseSpeeds.push(null);
          decreaseSpeeds.push(null);
          exceedSpeeds.push(null);
        }
      }
    }
    
    const datasets = [
      {
        label: `${telemetryConfig.title} (${telemetryConfig.unit}) - ДЕМО`,
        data: values,
        fill: false,
        backgroundColor: 'rgba(153, 216, 217, 0.5)',
        borderColor: 'rgba(153, 216, 217, 0.8)',
        tension: 0.2,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 1.5
      },
      {
        label: 'Повышение скорости',
        data: increaseSpeeds,
        fill: false,
        backgroundColor: 'rgba(0, 200, 150, 0.8)',
        borderColor: 'rgba(0, 200, 150, 0.8)',
        tension: 0,
        pointRadius: 3,
        pointHoverRadius: 5,
        segment: {
          borderColor: 'rgba(0, 200, 150, 0.8)',
        },
        spanGaps: false
      },
      {
        label: 'Снижение скорости',
        data: decreaseSpeeds,
        fill: false,
        backgroundColor: 'rgba(255, 140, 0, 0.8)',
        borderColor: 'rgba(255, 140, 0, 0.8)',
        tension: 0,
        pointRadius: 3,
        pointHoverRadius: 5,
        segment: {
          borderColor: 'rgba(255, 140, 0, 0.8)',
        },
        spanGaps: false
      },
      {
        label: 'Превышение скорости',
        data: exceedSpeeds,
        fill: false,
        backgroundColor: 'rgba(255, 99, 132, 0.8)',
        borderColor: 'rgba(255, 99, 132, 0.8)',
        tension: 0,
        pointRadius: 3,
        pointHoverRadius: 5,
        segment: {
          borderColor: 'rgba(255, 99, 132, 0.8)',
        },
        spanGaps: false
      }
    ];
    
    if (limitValues !== null) {
      datasets.push({
        label: telemetryConfig.limitLabel,
        data: limitValues,
        fill: false,
        borderColor: telemetryConfig.limitColor,
        borderDash: [5, 5],
        pointRadius: 0,
        pointHoverRadius: 0,
        borderWidth: 2
      });
    }
    
    return {
      labels,
      datasets
    };
  };
  
  // Инициализация данных при первой загрузке
  useEffect(() => {
    console.log('Компонент инициализирован с периодом "день", загружаем данные');
    console.log(`Начальный диапазон: ${localStartDate.toLocaleString()} - ${localEndDate.toLocaleString()}`);
    loadData();
  }, [loadData]);
  
  // Рендер компонента (без изменений, просто заменены ссылки на конфигурацию)
    return (
    <div className="speed-chart-container" ref={chartContainerRef}>
      <div className="speed-chart-header">
        <div className="speed-chart-title">
          <div className="speed-chart-title-icon">
            <FontAwesomeIcon icon={telemetryConfig.icon} />
          </div>
          {telemetryConfig.title}
          {vehicle && vehicle.name && <span> - {vehicle.name}</span>}
        </div>
        
        {/* Рендер кнопок управления */}
      <div className="speed-chart-actions">
        <button 
          className="speed-chart-btn" 
          onClick={zoomIn}
          title="Увеличить масштаб"
        >
          <FontAwesomeIcon icon={faSearchPlus} className="speed-chart-btn-icon" />
          Увеличить
        </button>
        <button 
          className="speed-chart-btn" 
          onClick={zoomOut}
          title="Уменьшить масштаб"
        >
          <FontAwesomeIcon icon={faSearchMinus} className="speed-chart-btn-icon" />
          Уменьшить
        </button>
        <button 
          className="speed-chart-btn" 
          onClick={resetZoom}
          title="Сбросить масштаб (Пробел)"
        >
          <FontAwesomeIcon icon={faRedo} className="speed-chart-btn-icon" />
          Сбросить
        </button>
        <button 
          className="speed-chart-btn" 
          onClick={toggleFullscreen}
          title="Полноэкранный режим"
        >
          <FontAwesomeIcon icon={isFullscreen ? faCompress : faExpand} className="speed-chart-btn-icon" />
          {isFullscreen ? 'Свернуть' : 'Развернуть'}
        </button>
        <button 
          className="speed-chart-btn" 
          onClick={() => loadDataForPeriod(selectedPeriod)}
          disabled={isLoading}
        >
          <FontAwesomeIcon icon={faSync} className="speed-chart-btn-icon" spin={isLoading} />
          Обновить
        </button>
        <button 
          className={`speed-chart-btn ${showSettings ? 'active' : ''}`} 
          onClick={() => setShowSettings(!showSettings)}
        >
          <FontAwesomeIcon icon={faCog} className="speed-chart-btn-icon" />
          Настройки
        </button>
      </div>
      </div>
      
      {/* Рендер блока с информацией о графике */}
      {showSettings && (
      <div className="chart-settings">
        <div className="chart-settings-header">
          <FontAwesomeIcon icon={faInfoCircle} />
          <span>Информация о графике</span>
        </div>
        <div className="chart-settings-content">
          <div className="settings-row">
              <label>Тип данных:</label>
              <span>{telemetryConfig.title}</span>
            </div>
            <div className="settings-row">
              <label>Единица измерения:</label>
              <span>{telemetryConfig.unit}</span>
          </div>
          <div className="settings-row">
            <label>Период:</label>
            <div className="period-selector">
              <button 
                className={`period-btn ${selectedPeriod === 'day' ? 'active' : ''}`}
                onClick={() => loadDataForPeriod('day')}
              >
                Сегодня
              </button>
              <button 
                className={`period-btn ${selectedPeriod === 'yesterday' ? 'active' : ''}`}
                onClick={() => loadDataForPeriod('yesterday')}
              >
                Вчера
              </button>
              <button 
                className={`period-btn ${selectedPeriod === 'week' ? 'active' : ''}`}
                onClick={() => loadDataForPeriod('week')}
              >
                Неделя
              </button>
              <button 
                className={`period-btn ${selectedPeriod === 'month' ? 'active' : ''}`}
                onClick={() => loadDataForPeriod('month')}
              >
                Месяц
              </button>
            </div>
          </div>
          <div className="settings-row">
            <label>Временной интервал:</label>
            <span>{localStartDate.toLocaleString()} - {localEndDate.toLocaleString()}</span>
          </div>
          <div className="settings-row">
            <label>Всего записей:</label>
            <span>{chartData ? chartData.labels.length : 0}</span>
          </div>
          <div className="settings-row">
            <label>Горячие клавиши:</label>
            <span>Пробел - сбросить масштаб, CTRL+мышь - панорамирование</span>
          </div>
          </div>
        </div>
      )}
      
      
      
      {/* Рендер графика */}
      <div className="speed-chart-content">
        {isLoading ? (
          <div className="chart-loading">
            Загрузка данных {telemetryConfig.title.toLowerCase()}...
          </div>
        ) : (
          chartData ? (
            <div className="speed-chart">
              <Line 
                data={chartData} 
                options={chartOptions} 
                ref={chartRef}
              />
            </div>
          ) : (
            <div className="demo-chart-container">
              <div className="demo-chart-header">
                <FontAwesomeIcon icon={faInfoCircle} />
                <span>Демонстрационные данные</span>
              </div>
              <Line 
                data={generateDemoData()} 
                options={{
                  ...chartOptions, 
                  plugins: {
                    ...chartOptions.plugins, 
                    title: {
                      display: true, 
                      text: `Демонстрационные данные ${telemetryConfig.title.toLowerCase()}`,
                      font: { size: 14, weight: 'bold' }
                    }
                  }
                }} 
                ref={chartRef}
              />
              <div className="demo-data-message">
                <p>Показаны демонстрационные данные. В реальном приложении здесь будут отображаться фактические данные.</p>
              </div>
            </div>
          )
        )}
      </div>


      {/* Рендер статистики */}
      <div className="speed-stats">
        <div className="speed-stat">
          <div className="speed-stat-icon">
            <FontAwesomeIcon icon={faChartLine} />
          </div>
          <div className="speed-stat-value">{statistics.average}</div>
          <div className="speed-stat-label">{telemetryConfig.statistics.average}</div>
        </div>
        <div className="speed-stat">
          <div className="speed-stat-icon">
            <FontAwesomeIcon icon={telemetryConfig.icon} />
          </div>
          <div className="speed-stat-value">{statistics.max}</div>
          <div className="speed-stat-label">{telemetryConfig.statistics.max}</div>
        </div>
        <div className="speed-stat">
          <div className="speed-stat-icon">
            <FontAwesomeIcon icon={faCalendarAlt} />
          </div>
          <div className="speed-stat-value">{statistics.movingTime}</div>
          <div className="speed-stat-label">{telemetryConfig.statistics.movingTime}</div>
        </div>
        <div className="speed-stat">
          <div className="speed-stat-icon">
            <FontAwesomeIcon icon={faInfoCircle} />
          </div>
          <div className="speed-stat-value">{statistics.exceedCount}</div>
          <div className="speed-stat-label">{telemetryConfig.statistics.exceedCount}</div>
        </div>
      </div>
    </div>
  );
};

export default TelemetryChart; 