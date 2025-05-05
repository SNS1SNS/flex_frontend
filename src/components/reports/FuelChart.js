import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faGasPump, faCalendarDay, faCalendarWeek, faCalendarAlt, 
  faSync, faDownload, faChartLine, faExpand, faCompress, 
  faCog, faInfoCircle, faFire, faTint, faRoute
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import './FuelChart.css';

// Регистрируем необходимые компоненты Chart.js
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

/**
 * Компонент для отображения графика расхода топлива транспортного средства
 * @param {Object} props - Свойства компонента
 * @param {Object} props.vehicle - Данные о транспортном средстве (id, name, imei)
 * @param {Date} props.startDate - Начальная дата диапазона
 * @param {Date} props.endDate - Конечная дата диапазона
 */
const FuelChart = ({ vehicle, startDate, endDate }) => {
  const [chartData, setChartData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statistics, setStatistics] = useState({
    averageConsumption: '-',
    totalConsumption: '-',
    refills: '-',
    fuelDrains: '-'
  });
  const [selectedPeriod, setSelectedPeriod] = useState('day');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showConsumption, setShowConsumption] = useState(true);
  const [showFillings, setShowFillings] = useState(true);
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  
  // Форматирование даты в формат ISO с микросекундами для API
  const formatToMicroISOString = (date) => {
    if (!date) return '';
    const isoString = date.toISOString();
    return isoString.replace('Z', '000Z');
  };
  
  // Форматирование даты для отображения на графике
  const formatDateForChart = (dateString) => {
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };
  
  // Расчет статистики по расходу топлива
  const calculateFuelStatistics = (fuelData, fillings, drains) => {
    if (!fuelData || fuelData.length === 0) {
      return {
        averageConsumption: '-',
        totalConsumption: '-',
        refills: '-',
        fuelDrains: '-'
      };
    }
    
    // Считаем общий расход топлива - разница между начальным и конечным значением
    // плюс учитываем все заправки и сливы
    const initialFuel = fuelData[0].value;
    const finalFuel = fuelData[fuelData.length - 1].value;
    
    // Сумма всех заправок
    const totalRefills = fillings.reduce((sum, filling) => sum + filling.volume, 0);
    
    // Сумма всех сливов
    const totalDrains = drains.reduce((sum, drain) => sum + drain.volume, 0);
    
    // Общий расход = (начальный уровень + заправки - сливы - конечный уровень)
    const totalConsumption = initialFuel + totalRefills - totalDrains - finalFuel;
    
    // Рассчитываем средний расход топлива на 100 км
    // Для этого нам нужно знать пройденное расстояние. Предположим, что у нас есть данные о пробеге
    const estimatedDistance = 100; // Примерное расстояние в км, в реальном приложении это будет переменная
    
    // Средний расход на 100 км
    const averageConsumption = totalConsumption / estimatedDistance * 100;
    
    return {
      averageConsumption: `${averageConsumption.toFixed(1)} л/100км`,
      totalConsumption: `${totalConsumption.toFixed(1)} л`,
      refills: fillings.length.toString(),
      fuelDrains: drains.length.toString()
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
        start = new Date();
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setHours(23, 59, 59, 999);
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
        break;
      case 'month':
        // Последние 30 дней
        start = new Date();
        start.setDate(start.getDate() - 30);
        break;
      default:
        // По умолчанию - сегодня
        start.setHours(0, 0, 0, 0);
        break;
    }
    
    // Загружаем данные для нового диапазона
    loadFuelData(start, end);
  }, []);
  
  // Загрузка данных о топливе
  const loadFuelData = async (customStartDate, customEndDate) => {
    if (!vehicle || !vehicle.imei) {
      toast.warning('Не выбрано транспортное средство или отсутствует IMEI');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Используем заданные даты или те, что были переданы через пропсы
      const startTimeStr = formatToMicroISOString(customStartDate || startDate);
      const endTimeStr = formatToMicroISOString(customEndDate || endDate);
      
      const fuelUrl = `/api/telemetry/fuel/${vehicle.imei}?start_time=${encodeURIComponent(startTimeStr)}&end_time=${encodeURIComponent(endTimeStr)}`;
      const fillingsUrl = `/api/events/refill/${vehicle.imei}?start_time=${encodeURIComponent(startTimeStr)}&end_time=${encodeURIComponent(endTimeStr)}`;
      const drainsUrl = `/api/events/drain/${vehicle.imei}?start_time=${encodeURIComponent(startTimeStr)}&end_time=${encodeURIComponent(endTimeStr)}`;
      
      // Параллельно запрашиваем данные о топливе, заправках и сливах
      const [fuelResponse, fillingsResponse, drainsResponse] = await Promise.all([
        fetch(fuelUrl),
        fetch(fillingsUrl),
        fetch(drainsUrl)
      ]);
      
      if (!fuelResponse.ok || !fillingsResponse.ok || !drainsResponse.ok) {
        throw new Error(`Ошибка HTTP при загрузке данных о топливе`);
      }
      
      const fuelData = await fuelResponse.json();
      const fillingsData = await fillingsResponse.json();
      const drainsData = await drainsResponse.json();
      
      // Обработка данных о топливе
      if (fuelData && fuelData.data && Array.isArray(fuelData.data) && fuelData.data.length > 0) {
        // Готовим данные для графика
        const labels = fuelData.data.map(item => formatDateForChart(item.time));
        const fuelValues = fuelData.data.map(item => item.value);
        
        // Подготовка данных о заправках для графика
        const fillings = [];
        if (fillingsData && fillingsData.data && Array.isArray(fillingsData.data)) {
          fillingsData.data.forEach(filling => {
            // Ищем соответствующую метку времени
            const timeLabel = formatDateForChart(filling.time);
            const index = labels.indexOf(timeLabel);
            
            if (index !== -1) {
              fillings.push({
                x: timeLabel,
                y: fuelValues[index],
                volume: filling.volume
              });
            }
          });
        }
        
        // Подготовка данных о сливах для графика
        const drains = [];
        if (drainsData && drainsData.data && Array.isArray(drainsData.data)) {
          drainsData.data.forEach(drain => {
            // Ищем соответствующую метку времени
            const timeLabel = formatDateForChart(drain.time);
            const index = labels.indexOf(timeLabel);
            
            if (index !== -1) {
              drains.push({
                x: timeLabel,
                y: fuelValues[index],
                volume: drain.volume
              });
            }
          });
        }
        
        setChartData({
          labels,
          datasets: [
            {
              label: 'Уровень топлива (л)',
              data: fuelValues,
              fill: true,
              backgroundColor: 'rgba(255, 159, 64, 0.2)',
              borderColor: '#ff9f40',
              tension: 0.4,
              pointRadius: 2,
              pointHoverRadius: 5,
              borderWidth: 2
            },
            {
              label: 'Заправки',
              data: fillings,
              backgroundColor: 'rgba(75, 192, 192, 0.8)',
              borderColor: 'rgba(75, 192, 192, 1)',
              pointRadius: 6,
              pointHoverRadius: 8,
              pointStyle: 'triangle',
              showLine: false,
              hidden: !showFillings
            },
            {
              label: 'Сливы',
              data: drains,
              backgroundColor: 'rgba(255, 99, 132, 0.8)',
              borderColor: 'rgba(255, 99, 132, 1)',
              pointRadius: 6,
              pointHoverRadius: 8,
              pointStyle: 'rect',
              showLine: false,
              hidden: !showFillings
            }
          ]
        });
        
        // Обновляем статистику
        const stats = calculateFuelStatistics(fuelData.data, fillingsData.data || [], drainsData.data || []);
        setStatistics(stats);
      } else {
        toast.warning(`Нет данных о топливе для ${vehicle.name} за выбранный период`);
        setChartData(null);
        setStatistics({
          averageConsumption: '-',
          totalConsumption: '-',
          refills: '-',
          fuelDrains: '-'
        });
      }
    } catch (error) {
      console.error('Ошибка загрузки данных о топливе:', error);
      toast.error(`Ошибка загрузки данных о топливе: ${error.message}`);
      setChartData(null);
      setStatistics({
        averageConsumption: '-',
        totalConsumption: '-',
        refills: '-',
        fuelDrains: '-'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
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
            if (context.dataset.label === 'Уровень топлива (л)') {
              return `Уровень топлива: ${context.parsed.y.toFixed(1)} л`;
            } else if (context.dataset.label === 'Заправки') {
              const dataPoint = context.dataset.data[context.dataIndex];
              return `Заправка: +${dataPoint.volume.toFixed(1)} л`;
            } else if (context.dataset.label === 'Сливы') {
              const dataPoint = context.dataset.data[context.dataIndex];
              return `Слив: -${dataPoint.volume.toFixed(1)} л`;
            }
            return context.dataset.label;
          }
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
          text: 'Уровень топлива (л)',
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
  
  // Инициализация и загрузка данных при монтировании компонента
  useEffect(() => {
    // По умолчанию загружаем данные за сегодня
    loadFuelData(startDate, endDate);
    
    // Добавляем слушатель события изменения диапазона дат
    const handleDateRangeChange = (event) => {
      console.log('FuelChart: Получено событие dateRangeChanged:', event.detail);
      
      if (event.detail && event.detail.forceUpdate) {
        const newStartDate = event.detail.startDate ? new Date(event.detail.startDate.split('.').reverse().join('-')) : startDate;
        const newEndDate = event.detail.endDate ? new Date(event.detail.endDate.split('.').reverse().join('-')) : endDate;
        
        // Обновляем период
        if (event.detail.periodType) {
          setSelectedPeriod(event.detail.periodType);
        }
        
        // Загружаем данные для нового диапазона
        loadFuelData(newStartDate, newEndDate);
      }
    };
    
    // Устанавливаем слушатель
    document.addEventListener('dateRangeChanged', handleDateRangeChange);
    
    // Очистка при размонтировании
    return () => {
      document.removeEventListener('dateRangeChanged', handleDateRangeChange);
    };
  }, [startDate, endDate, loadFuelData]);
  
  // Обработчик экспорта данных
  const handleExportData = () => {
    if (!chartData || !chartData.labels || !chartData.datasets || !chartData.datasets[0]) {
      toast.warning('Нет данных для экспорта');
      return;
    }
    
    // Создаем CSV данные
    const labels = chartData.labels;
    const fuelLevels = chartData.datasets[0].data;
    
    let csvContent = 'data:text/csv;charset=utf-8,Время,Уровень топлива (л)\n';
    
    for (let i = 0; i < labels.length; i++) {
      csvContent += `${labels[i]},${fuelLevels[i]}\n`;
    }
    
    // Создаем ссылку для скачивания
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `fuel_data_${vehicle.name}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    
    // Скачиваем файл
    link.click();
    
    // Удаляем ссылку
    document.body.removeChild(link);
    
    toast.success('Данные успешно экспортированы');
  };
  
  // Обработчик кнопки обновления данных
  const handleRefreshData = () => {
    loadDataForPeriod(selectedPeriod);
  };
  
  // Генерация демо-данных, если в реальном приложении нет данных
  const generateDemoData = () => {
    const labels = [];
    const fuelData = [];
    const fillings = [];
    const drains = [];
    
    // Создаем данные за 24 часа с интервалом в час
    const baseTime = new Date(startDate);
    
    // Начальный уровень топлива
    let currentFuel = 70 + Math.random() * 20; // от 70 до 90 литров
    
    // Генерируем данные об уровне топлива
    for (let i = 0; i < 24; i++) {
      const currentTime = new Date(baseTime);
      currentTime.setHours(baseTime.getHours() + i);
      
      const timeLabel = formatDateForChart(currentTime.toISOString());
      labels.push(timeLabel);
      
      // Имитируем расход топлива (снижение 0.5-2 литра за час)
      const consumption = 0.5 + Math.random() * 1.5;
      currentFuel -= consumption;
      
      // Периодически добавляем заправки
      if (i === 8 || i === 16) {
        const refillAmount = 15 + Math.random() * 15; // 15-30 литров
        currentFuel += refillAmount;
        
        fillings.push({
          x: timeLabel,
          y: currentFuel,
          volume: refillAmount
        });
      }
      
      // С небольшой вероятностью добавляем слив топлива
      if (i === 12 && Math.random() > 0.7) {
        const drainAmount = 5 + Math.random() * 10; // 5-15 литров
        currentFuel -= drainAmount;
        
        drains.push({
          x: timeLabel,
          y: currentFuel,
          volume: drainAmount
        });
      }
      
      // Убеждаемся, что уровень топлива не уходит в отрицательные значения
      currentFuel = Math.max(currentFuel, 0);
      
      fuelData.push(currentFuel);
    }
    
    return {
      labels,
      datasets: [
        {
          label: 'Уровень топлива (л) - ДЕМО',
          data: fuelData,
          fill: true,
          backgroundColor: 'rgba(255, 159, 64, 0.2)',
          borderColor: '#ff9f40',
          tension: 0.4,
          pointRadius: 2,
          pointHoverRadius: 5,
          borderWidth: 2
        },
        {
          label: 'Заправки',
          data: fillings,
          backgroundColor: 'rgba(75, 192, 192, 0.8)',
          borderColor: 'rgba(75, 192, 192, 1)',
          pointRadius: 6,
          pointHoverRadius: 8,
          pointStyle: 'triangle',
          showLine: false
        },
        {
          label: 'Сливы',
          data: drains,
          backgroundColor: 'rgba(255, 99, 132, 0.8)',
          borderColor: 'rgba(255, 99, 132, 1)',
          pointRadius: 6,
          pointHoverRadius: 8,
          pointStyle: 'rect',
          showLine: false
        }
      ]
    };
  };
  
  // Рендер кнопок управления
  const renderControls = () => {
    return (
      <div className="fuel-chart-actions">
        <button 
          className={`fuel-chart-btn ${selectedPeriod === 'day' ? 'active' : ''}`} 
          onClick={() => loadDataForPeriod('day')}
        >
          <FontAwesomeIcon icon={faCalendarDay} className="fuel-chart-btn-icon" />
          Сегодня
        </button>
        <button 
          className={`fuel-chart-btn ${selectedPeriod === 'yesterday' ? 'active' : ''}`} 
          onClick={() => loadDataForPeriod('yesterday')}
        >
          <FontAwesomeIcon icon={faCalendarDay} className="fuel-chart-btn-icon" />
          Вчера
        </button>
        <button 
          className={`fuel-chart-btn ${selectedPeriod === 'week' ? 'active' : ''}`} 
          onClick={() => loadDataForPeriod('week')}
        >
          <FontAwesomeIcon icon={faCalendarWeek} className="fuel-chart-btn-icon" />
          Неделя
        </button>
        <button 
          className={`fuel-chart-btn ${selectedPeriod === 'month' ? 'active' : ''}`} 
          onClick={() => loadDataForPeriod('month')}
        >
          <FontAwesomeIcon icon={faCalendarAlt} className="fuel-chart-btn-icon" />
          Месяц
        </button>
        <button 
          className="fuel-chart-btn" 
          onClick={handleRefreshData}
          disabled={isLoading}
        >
          <FontAwesomeIcon icon={faSync} className="fuel-chart-btn-icon" spin={isLoading} />
          Обновить
        </button>
        <button 
          className="fuel-chart-btn" 
          onClick={toggleFullscreen}
        >
          <FontAwesomeIcon 
            icon={isFullscreen ? faCompress : faExpand} 
            className="fuel-chart-btn-icon" 
          />
          {isFullscreen ? 'Свернуть' : 'Развернуть'}
        </button>
        <button 
          className="fuel-chart-btn" 
          onClick={handleExportData}
          disabled={!chartData}
        >
          <FontAwesomeIcon icon={faDownload} className="fuel-chart-btn-icon" />
          Экспорт
        </button>
        <button 
          className={`fuel-chart-btn ${showSettings ? 'active' : ''}`} 
          onClick={() => setShowSettings(!showSettings)}
        >
          <FontAwesomeIcon icon={faCog} className="fuel-chart-btn-icon" />
          Настройки
        </button>
      </div>
    );
  };
  
  // Рендер блока с информацией о графике
  const renderInfo = () => {
    if (!showSettings) return null;
    
    return (
      <div className="chart-settings">
        <div className="chart-settings-header">
          <FontAwesomeIcon icon={faInfoCircle} />
          <span>Настройки графика</span>
        </div>
        <div className="chart-settings-content">
          <div className="settings-toggles">
            <label className="settings-toggle">
              <input 
                type="checkbox" 
                checked={showConsumption} 
                onChange={() => setShowConsumption(!showConsumption)} 
              />
              <span className="toggle-label">Показывать уровень топлива</span>
            </label>
            
            <label className="settings-toggle">
              <input 
                type="checkbox" 
                checked={showFillings} 
                onChange={() => setShowFillings(!showFillings)} 
              />
              <span className="toggle-label">Показывать заправки и сливы</span>
            </label>
          </div>
          
          <div className="settings-row">
            <label>Период:</label>
            <span>
              {selectedPeriod === 'day' && 'Сегодня'}
              {selectedPeriod === 'yesterday' && 'Вчера'}
              {selectedPeriod === 'week' && 'Последние 7 дней'}
              {selectedPeriod === 'month' && 'Последние 30 дней'}
            </span>
          </div>
          
          <div className="settings-row">
            <label>Всего записей:</label>
            <span>{chartData ? chartData.labels.length : 0}</span>
          </div>
          
          <div className="chart-legend">
            <div className="legend-item">
              <div className="legend-color fuel"></div>
              <span>Уровень топлива</span>
            </div>
            <div className="legend-item">
              <div className="legend-color refill"></div>
              <span>Заправки</span>
            </div>
            <div className="legend-item">
              <div className="legend-color drain"></div>
              <span>Сливы</span>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="fuel-chart-container" ref={chartContainerRef}>
      <div className="fuel-chart-header">
        <div className="fuel-chart-title">
          <div className="fuel-chart-title-icon">
            <FontAwesomeIcon icon={faGasPump} />
          </div>
          График топлива
          {vehicle && vehicle.name && <span> - {vehicle.name}</span>}
        </div>
        
        {renderControls()}
      </div>
      
      {renderInfo()}
      
      <div className="fuel-stats">
        <div className="fuel-stat">
          <div className="fuel-stat-icon">
            <FontAwesomeIcon icon={faFire} />
          </div>
          <div className="fuel-stat-value">{statistics.averageConsumption}</div>
          <div className="fuel-stat-label">Средний расход</div>
        </div>
        <div className="fuel-stat">
          <div className="fuel-stat-icon">
            <FontAwesomeIcon icon={faTint} />
          </div>
          <div className="fuel-stat-value">{statistics.totalConsumption}</div>
          <div className="fuel-stat-label">Общий расход</div>
        </div>
        <div className="fuel-stat">
          <div className="fuel-stat-icon">
            <FontAwesomeIcon icon={faGasPump} />
          </div>
          <div className="fuel-stat-value">{statistics.refills}</div>
          <div className="fuel-stat-label">Заправки</div>
        </div>
        <div className="fuel-stat">
          <div className="fuel-stat-icon">
            <FontAwesomeIcon icon={faInfoCircle} />
          </div>
          <div className="fuel-stat-value">{statistics.fuelDrains}</div>
          <div className="fuel-stat-label">Сливы</div>
        </div>
      </div>
      
      <div className="fuel-chart-content">
        {isLoading ? (
          <div className="chart-loading">
            Загрузка данных о топливе...
          </div>
        ) : (
          chartData ? (
            <div className="fuel-chart" ref={chartRef}>
              <Line data={chartData} options={chartOptions} />
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
                      text: 'Демонстрационные данные расхода топлива',
                      font: { size: 14, weight: 'bold' }
                    }
                  }
                }} 
              />
              <div className="demo-data-message">
                <p>Показаны демонстрационные данные. В реальном приложении здесь будут отображаться фактические данные о расходе топлива.</p>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default FuelChart; 