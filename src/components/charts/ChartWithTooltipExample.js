import React, { useEffect, useRef, useState } from 'react';
import './ChartWithTooltipExample.css';
import Tooltip from '../common/Tooltip';
import ChartTooltip from './ChartTooltip';

/**
 * Компонент для демонстрации работы тултипов с графиками
 */
const ChartWithTooltipExample = () => {
  const chartRef = useRef(null);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [points, setPoints] = useState([]);
  
  // Генерация случайных данных для графика
  useEffect(() => {
    generateData();
  }, []);
  
  const generateData = () => {
    const newData = [];
    const now = new Date();
    
    // Генерируем 12 точек для графика
    for (let i = 0; i < 12; i++) {
      const date = new Date(now);
      date.setHours(date.getHours() - (11 - i));
      
      newData.push({
        id: i + 1,
        date: date,
        value: Math.round(Math.random() * 100),
        additionalInfo: {
          'Скорость': `${Math.round(Math.random() * 100)} км/ч`,
          'Пробег': `${Math.round(Math.random() * 100000)} км`
        }
      });
    }
    
    renderChart(newData);
  };
  
  // Рендеринг простого canvas-графика
  const renderChart = (chartData) => {
    if (!chartRef.current) return;
    
    const canvas = chartRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Очищаем холст
    ctx.clearRect(0, 0, width, height);
    
    // Рисуем оси
    ctx.beginPath();
    ctx.strokeStyle = '#ccc';
    ctx.moveTo(50, 20);
    ctx.lineTo(50, height - 30);
    ctx.lineTo(width - 20, height - 30);
    ctx.stroke();
    
    // Находим максимальное значение для масштабирования
    const maxValue = Math.max(...chartData.map(item => item.value));
    
    // Рисуем линию графика
    ctx.beginPath();
    ctx.strokeStyle = '#4a90e2';
    ctx.lineWidth = 2;
    
    // Рисуем точки и соединяем их линией
    const pointsArray = [];
    const stepX = (width - 70) / (chartData.length - 1);
    
    chartData.forEach((point, index) => {
      const x = 50 + index * stepX;
      const y = height - 30 - (point.value / maxValue) * (height - 50);
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      
      // Сохраняем информацию о точке для тултипа
      pointsArray.push({
        id: point.id,
        x,
        y,
        data: point
      });
    });
    
    ctx.stroke();
    
    // Рисуем точки
    pointsArray.forEach(point => {
      ctx.beginPath();
      ctx.fillStyle = '#4a90e2';
      ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Сохраняем точки для использования в тултипах
    setPoints(pointsArray);
  };
  
  // Обработчик наведения на холст
  const handleCanvasMouseMove = (e) => {
    if (!chartRef.current || points.length === 0) return;
    
    const rect = chartRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Ищем ближайшую точку на графике
    let closestPoint = null;
    let minDistance = Infinity;
    
    points.forEach(point => {
      const distance = Math.sqrt((point.x - x) ** 2 + (point.y - y) ** 2);
      if (distance < minDistance && distance < 20) {
        minDistance = distance;
        closestPoint = point;
      }
    });
    
    // Если нашли ближайшую точку в радиусе 20px, показываем тултип
    setHoveredPoint(closestPoint);
  };
  
  // Обработчик ухода мыши с холста
  const handleCanvasMouseLeave = () => {
    setHoveredPoint(null);
  };
  
  return (
    <div className="chart-tooltip-example">
      <h2>Пример использования тултипов с графиками</h2>
      
      <div className="chart-section">
        <h3>Реализация с использованием React компонента</h3>
        
        <div 
          className="chart-container"
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={handleCanvasMouseLeave}
        >
          <canvas 
            ref={chartRef} 
            width={800} 
            height={400}
          />
          
          {hoveredPoint && (
            <div 
              className="react-tooltip-anchor"
              style={{ 
                left: `${hoveredPoint.x}px`, 
                top: `${hoveredPoint.y}px`
              }}
            >
              <ChartTooltip
                data={hoveredPoint.data}
                title={`Точка №${hoveredPoint.id}`}
                position="top"
                type="info"
              >
                <div className="invisible-anchor" />
              </ChartTooltip>
            </div>
          )}
        </div>
        
        <button className="refresh-chart-btn" onClick={generateData}>
          Обновить данные
        </button>
      </div>
      
      <div className="chart-section">
        <h3>Реализация с использованием DOM API</h3>
        <p>
          Для графиков, построенных с помощью библиотек типа Chart.js, ECharts или Highcharts, 
          рекомендуется использовать менеджер тултипов, который 
          интегрируется с этими библиотеками через DOM API.
        </p>
        
        <div className="code-example">
          <Tooltip
            content={
              <pre>{`// Пример использования tooltipManager с Chart.js
const chart = new Chart(ctx, {
  // ... конфигурация графика
  options: {
    plugins: {
      tooltip: tooltipManager.configureTooltip(
        'chartjs', 
        chart, 
        chartContainer, 
        (dataPoint) => ({
          title: 'Данные точки',
          value: dataPoint.raw,
          date: new Date(),
          additionalInfo: { ... }
        })
      ).tooltipOptions
    }
  }
});`}</pre>
            }
            position="top"
            className="tooltip-lg tooltip-interactive"
            type="dark"
          >
            <button className="view-code-btn">Показать пример кода</button>
          </Tooltip>
        </div>
      </div>
      
      <div className="chart-section">
        <h3>Типы тултипов для графиков</h3>
        
        <div className="tooltip-types">
          <div className="tooltip-type-card">
            <h4>Информационный</h4>
            <div className="tooltip-preview tooltip-info-preview">
              <div className="tooltip-title">Значение</div>
              <div className="tooltip-content">
                <div className="tooltip-row">
                  <span>Дата:</span>
                  <span>2023-05-10</span>
                </div>
                <div className="tooltip-row">
                  <span>Значение:</span>
                  <span>75.4 км/ч</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="tooltip-type-card">
            <h4>Предупреждение</h4>
            <div className="tooltip-preview tooltip-warning-preview">
              <div className="tooltip-title">Превышение</div>
              <div className="tooltip-content">
                <div className="tooltip-row">
                  <span>Дата:</span>
                  <span>2023-05-10</span>
                </div>
                <div className="tooltip-row">
                  <span>Значение:</span>
                  <span>95.7 км/ч</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="tooltip-type-card">
            <h4>Ошибка</h4>
            <div className="tooltip-preview tooltip-error-preview">
              <div className="tooltip-title">Критическое</div>
              <div className="tooltip-content">
                <div className="tooltip-row">
                  <span>Дата:</span>
                  <span>2023-05-10</span>
                </div>
                <div className="tooltip-row">
                  <span>Значение:</span>
                  <span>120.3 км/ч</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChartWithTooltipExample; 