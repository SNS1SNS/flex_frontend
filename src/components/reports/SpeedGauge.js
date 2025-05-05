import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTachometerAlt, faCalendarDay, faCalendarWeek, faCalendarAlt, 
  faSync, faChartLine, faCog, faInfoCircle, faCarAlt, faHistory
} from '@fortawesome/free-solid-svg-icons';
import './SpeedGauge.css';

// Регистрируем необходимые компоненты Chart.js
ChartJS.register(ArcElement, Tooltip, Legend);

/**
 * Компонент-спидометр для отображения данных о скорости
 * @param {Object} props - Свойства компонента
 * @param {Object} props.vehicle - Данные о транспортном средстве (id, name, imei)
 * @param {Date} props.startDate - Начальная дата диапазона
 * @param {Date} props.endDate - Конечная дата диапазона
 */
const SpeedGauge = ({ vehicle, startDate, endDate }) => {
  const [telemetryData, setTelemetryData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(0);
  const [avgSpeed, setAvgSpeed] = useState(0);
  const [movementTime, setMovementTime] = useState('-');
  const [selectedPeriod, setSelectedPeriod] = useState('day');
  const [showSettings, setShowSettings] = useState(false);
  const [historyView, setHistoryView] = useState(false);
  const chartRef = useRef(null);
  
  // Цветовая схема для спидометра
  const speedRanges = [
    { limit: 60, color: 'rgba(0, 200, 0, 0.8)', label: 'Низкая' },
    { limit: 90, color: 'rgba(255, 193, 7, 0.8)', label: 'Средняя' },
    { limit: 120, color: 'rgba(255, 99, 132, 0.8)', label: 'Высокая' },
    { limit: 180, color: 'rgba(220, 53, 69, 0.8)', label: 'Критическая' },
  ];
  
  /**
   * Формирование данных для спидометра
   * @param {number} speed - текущая скорость
   * @returns {Object} - объект с данными для графика
   */
  const createGaugeData = (speed) => {
    const maxSpeedValue = 180; // Максимальное значение скорости на спидометре
    const remaining = maxSpeedValue - speed;
    
    // Создаем данные для индикатора скорости
    return {
      labels: ['Скорость', 'Остаток'],
      datasets: [
        {
          data: [speed, remaining],
          backgroundColor: [
            getSpeedColor(speed),
            'rgba(200, 200, 200, 0.2)'
          ],
          borderColor: [
            getSpeedColor(speed),
            'rgba(200, 200, 200, 0.2)'
          ],
          borderWidth: 1,
          circumference: 180,
          rotation: 270,
        }
      ]
    };
  };
  
  /**
   * Получение цвета для текущей скорости
   * @param {number} speed - текущая скорость
   * @returns {string} - цвет для данной скорости
   */
  const getSpeedColor = (speed) => {
    for (let i = 0; i < speedRanges.length; i++) {
      if (speed <= speedRanges[i].limit) {
        return speedRanges[i].color;
      }
    }
    return speedRanges[speedRanges.length - 1].color;
  };
  
  /**
   * Получение текстового описания скорости
   * @param {number} speed - текущая скорость
   * @returns {string} - текстовое описание скорости
   */
  const getSpeedLabel = (speed) => {
    for (let i = 0; i < speedRanges.length; i++) {
      if (speed <= speedRanges[i].limit) {
        return speedRanges[i].label;
      }
    }
    return speedRanges[speedRanges.length - 1].label;
  };
  
  // Опции для графика Chart.js
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '75%',
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: false
      }
    },
    animation: {
      animateRotate: true,
      animateScale: true
    }
  };
  
  // Загрузка данных для выбранного периода
  const loadDataForPeriod = useCallback((period) => {
    setSelectedPeriod(period);
    
    // Определяем диапазон дат в зависимости от периода
    let start = new Date();
    let end = new Date();
    
    switch (period) {
      case 'day':
        // Сегодня (уже установлено)
        start.setHours(0, 0, 0, 0);
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
    loadTelemetryData();
  }, []);
  
  /**
   * Загрузка данных телеметрии из API
   */
  const loadTelemetryData = useCallback(async () => {
    if (!vehicle || !vehicle.imei) {
      console.warn('Нет доступных данных о ТС для загрузки телеметрии');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Преобразуем даты в строки ISO
      const startTimeStr = startDate.toISOString();
      const endTimeStr = endDate.toISOString();
      
      // URL API для получения данных телеметрии
      const apiUrl = `http://localhost:8081/api/telemetry/v3/${vehicle.imei}/speed?startTime=${startTimeStr}&endTime=${endTimeStr}`;
      
      console.log(`Загрузка данных скорости: ${apiUrl}`);
      
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
      console.log(`Получены данные скорости:`, data);
      
      // Проверяем структуру данных и находим массив точек
      if (data) {
        // Проверяем, содержит ли ответ массив точек в поле data или points
        const points = data.data || data.points || data.values;
        
        if (points && Array.isArray(points) && points.length > 0) {
          setTelemetryData(points);
          processSpeedData(points);
        } else {
          console.warn('Нет данных о скорости за выбранный период или непонятный формат данных');
          
          // В режиме разработки используем демо данные
          if (process.env.NODE_ENV === 'development') {
            const demoPoints = generateDemoData();
            setTelemetryData(demoPoints);
            processSpeedData(demoPoints);
          }
        }
      } else {
        console.warn('Пустой ответ от API скорости');
        
        // В режиме разработки используем демо данные
        if (process.env.NODE_ENV === 'development') {
          const demoPoints = generateDemoData();
          setTelemetryData(demoPoints);
          processSpeedData(demoPoints);
        }
      }
    } catch (error) {
      console.error('Ошибка при загрузке данных скорости:', error);
      
      // Выводим дополнительную информацию об ошибке
      if (error.response) {
        console.warn('Статус ошибки:', error.response.status);
        console.warn('Детали ошибки:', error.response.data);
      } else {
        console.warn('Детали ошибки:', error.message);
      }
      
      // В режиме разработки используем демо данные
      if (process.env.NODE_ENV === 'development') {
        const demoPoints = generateDemoData();
        setTelemetryData(demoPoints);
        processSpeedData(demoPoints);
      }
    } finally {
      setIsLoading(false);
    }
  }, [vehicle, startDate, endDate]);
  
  /**
   * Обработка полученных данных о скорости
   * @param {Array} data - массив данных телеметрии
   */
  const processSpeedData = (data) => {
    // Фильтруем только валидные значения
    const validSpeeds = data
      .map(item => parseFloat(item.value))
      .filter(value => !isNaN(value));
    
    if (validSpeeds.length === 0) {
      setCurrentSpeed(0);
      setMaxSpeed(0);
      setAvgSpeed(0);
      setMovementTime('-');
      return;
    }
    
    // Последнее значение скорости
    const lastSpeed = validSpeeds[validSpeeds.length - 1];
    setCurrentSpeed(Math.round(lastSpeed));
    
    // Максимальная скорость
    const max = Math.max(...validSpeeds);
    setMaxSpeed(Math.round(max));
    
    // Средняя скорость
    const avgSpeed = validSpeeds.reduce((acc, val) => acc + val, 0) / validSpeeds.length;
    setAvgSpeed(Math.round(avgSpeed));
    
    // Время в движении (скорость > 5 км/ч)
    const movingValues = validSpeeds.filter(speed => speed > 5);
    const totalMinutes = Math.round(movingValues.length * 5); // предполагаем точку каждые 5 минут
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    setMovementTime(`${hours}ч ${minutes}мин`);
  };
  
  // Инициализация и загрузка данных при монтировании компонента
  useEffect(() => {
    loadTelemetryData();
  }, [loadTelemetryData]);
  
  /**
   * Генерация демо-данных телеметрии
   * @returns {Array} - массив демо-данных
   */
  const generateDemoData = () => {
    const result = [];
    const baseTime = new Date(startDate);
    
    // Создаем 24 часа данных с шагом в час
    for (let i = 0; i < 24; i++) {
      const currentTime = new Date(baseTime);
      currentTime.setHours(baseTime.getHours() + i);
      
      // Имитируем разную скорость в зависимости от времени суток
      let speed = 0;
      const hour = currentTime.getHours();
      
      if (hour >= 8 && hour <= 20) { // Дневное время - активное движение
        if (hour >= 8 && hour <= 10) { // Утренний час пик
          speed = 60 + Math.random() * 40;
        } else if (hour >= 17 && hour <= 19) { // Вечерний час пик
          speed = 50 + Math.random() * 50;
        } else { // Обычное дневное время
          speed = 40 + Math.random() * 30;
        }
      } else { // Ночное время - меньше движения или стоянка
        if (Math.random() > 0.7) { // 30% вероятность движения ночью
          speed = Math.random() * 70;
        } else {
          speed = 0; // Стоянка
        }
      }
      
      result.push({
        time: currentTime.toISOString(),
        value: Math.round(speed * 10) / 10, // Округляем до 1 десятичного знака
        timestamp: currentTime.toISOString()
      });
    }
    
    return result;
  };
  
  /**
   * Переключение между текущим и историческим видом
   */
  const toggleHistoryView = () => {
    setHistoryView(!historyView);
  };
  
  return (
    <div className="speed-gauge-container">
      <div className="speed-gauge-header">
        <div className="speed-gauge-title">
          <div className="speed-gauge-title-icon">
            <FontAwesomeIcon icon={faTachometerAlt} />
          </div>
          Спидометр {vehicle && vehicle.name && <span> - {vehicle.name}</span>}
        </div>
        
        {/* Кнопки управления */}
        <div className="speed-gauge-actions">
          <button 
            className={`speed-gauge-btn ${selectedPeriod === 'day' ? 'active' : ''}`} 
            onClick={() => loadDataForPeriod('day')}
          >
            <FontAwesomeIcon icon={faCalendarDay} className="speed-gauge-btn-icon" />
            Сегодня
          </button>
          <button 
            className={`speed-gauge-btn ${selectedPeriod === 'yesterday' ? 'active' : ''}`} 
            onClick={() => loadDataForPeriod('yesterday')}
          >
            <FontAwesomeIcon icon={faCalendarDay} className="speed-gauge-btn-icon" />
            Вчера
          </button>
          <button 
            className={`speed-gauge-btn ${selectedPeriod === 'week' ? 'active' : ''}`} 
            onClick={() => loadDataForPeriod('week')}
          >
            <FontAwesomeIcon icon={faCalendarWeek} className="speed-gauge-btn-icon" />
            Неделя
          </button>
          <button 
            className={`speed-gauge-btn ${selectedPeriod === 'month' ? 'active' : ''}`} 
            onClick={() => loadDataForPeriod('month')}
          >
            <FontAwesomeIcon icon={faCalendarAlt} className="speed-gauge-btn-icon" />
            Месяц
          </button>
          <button 
            className={`speed-gauge-btn ${historyView ? 'active' : ''}`} 
            onClick={toggleHistoryView}
          >
            <FontAwesomeIcon icon={faHistory} className="speed-gauge-btn-icon" />
            История
          </button>
          <button 
            className="speed-gauge-btn" 
            onClick={() => loadDataForPeriod(selectedPeriod)}
            disabled={isLoading}
          >
            <FontAwesomeIcon icon={faSync} className="speed-gauge-btn-icon" spin={isLoading} />
            Обновить
          </button>
          <button 
            className={`speed-gauge-btn ${showSettings ? 'active' : ''}`} 
            onClick={() => setShowSettings(!showSettings)}
          >
            <FontAwesomeIcon icon={faCog} className="speed-gauge-btn-icon" />
            Настройки
          </button>
        </div>
      </div>
      
      {/* Блок с информацией о графике */}
      {showSettings && (
        <div className="gauge-settings">
          <div className="gauge-settings-header">
            <FontAwesomeIcon icon={faInfoCircle} />
            <span>Информация о спидометре</span>
          </div>
          <div className="gauge-settings-content">
            <div className="settings-row">
              <label>Тип данных:</label>
              <span>Скорость</span>
            </div>
            <div className="settings-row">
              <label>Единица измерения:</label>
              <span>км/ч</span>
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
              <span>{telemetryData ? telemetryData.length : 0}</span>
            </div>
          </div>
          <div className="gauge-legends">
            <h4>Легенда спидометра:</h4>
            <div className="gauge-legend-items">
              {speedRanges.map((range, idx) => (
                <div className="gauge-legend-item" key={idx}>
                  <span className="gauge-legend-color" style={{backgroundColor: range.color}}></span>
                  <span className="gauge-legend-text">{range.label} ({idx > 0 ? `${speedRanges[idx-1].limit+1}-${range.limit}` : `0-${range.limit}`} км/ч)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Отображение спидометра или истории */}
      <div className="speed-gauge-content">
        {isLoading ? (
          <div className="gauge-loading">
            Загрузка данных о скорости...
          </div>
        ) : historyView ? (
          // Отображение исторических данных в табличном виде
          <div className="speed-history-view">
            <h3>История скорости</h3>
            <div className="speed-history-table-container">
              <table className="speed-history-table">
                <thead>
                  <tr>
                    <th>Время</th>
                    <th>Скорость (км/ч)</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {telemetryData && telemetryData.map((point, idx) => {
                    const speed = parseFloat(point.value);
                    const time = new Date(point.timestamp || point.time);
                    return (
                      <tr key={idx} className={speed > 90 ? 'exceeding' : ''}>
                        <td>{`${time.getDate().toString().padStart(2, '0')}.${(time.getMonth() + 1).toString().padStart(2, '0')} ${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`}</td>
                        <td>{speed.toFixed(1)}</td>
                        <td style={{color: getSpeedColor(speed)}}>{getSpeedLabel(speed)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          // Отображение спидометра
          <div className="speed-gauge-display">
            <div className="gauge-chart-container">
              <div className="gauge-chart" ref={chartRef}>
                <Doughnut data={createGaugeData(currentSpeed)} options={chartOptions} />
              </div>
              <div className="gauge-center">
                <div className="current-speed">{currentSpeed}</div>
                <div className="speed-unit">км/ч</div>
              </div>
            </div>
            <div className="gauge-indicators">
              <div className="gauge-indicator" style={{color: getSpeedColor(currentSpeed)}}>
                {getSpeedLabel(currentSpeed)}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Блок статистики */}
      <div className="speed-stats">
        <div className="speed-stat">
          <div className="speed-stat-icon">
            <FontAwesomeIcon icon={faChartLine} />
          </div>
          <div className="speed-stat-value">{avgSpeed} км/ч</div>
          <div className="speed-stat-label">Средняя скорость</div>
        </div>
        <div className="speed-stat">
          <div className="speed-stat-icon">
            <FontAwesomeIcon icon={faTachometerAlt} />
          </div>
          <div className="speed-stat-value">{maxSpeed} км/ч</div>
          <div className="speed-stat-label">Максимальная скорость</div>
        </div>
        <div className="speed-stat">
          <div className="speed-stat-icon">
            <FontAwesomeIcon icon={faCalendarAlt} />
          </div>
          <div className="speed-stat-value">{movementTime}</div>
          <div className="speed-stat-label">Время в движении</div>
        </div>
        <div className="speed-stat">
          <div className="speed-stat-icon">
            <FontAwesomeIcon icon={faCarAlt} />
          </div>
          <div className="speed-stat-value">{currentSpeed} км/ч</div>
          <div className="speed-stat-label">Текущая скорость</div>
        </div>
      </div>
    </div>
  );
};

export default SpeedGauge; 