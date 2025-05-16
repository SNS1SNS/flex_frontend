/**
 * Утилита для управления всплывающими подсказками на графиках
 * Позволяет интегрировать наши тултипы с различными библиотеками графиков
 */

// Состояние тултипа
let tooltipState = {
  isVisible: false,
  element: null,
  container: null,
  data: null
};

/**
 * Инициализирует DOM элемент для тултипа
 * @returns {HTMLElement} Элемент тултипа
 */
const initTooltipElement = () => {
  // Проверяем, существует ли уже элемент тултипа
  let tooltipElement = document.getElementById('chart-tooltip-container');
  
  if (!tooltipElement) {
    tooltipElement = document.createElement('div');
    tooltipElement.id = 'chart-tooltip-container';
    tooltipElement.className = 'chart-tooltip-container';
    tooltipElement.style.position = 'absolute';
    tooltipElement.style.zIndex = '1000';
    tooltipElement.style.pointerEvents = 'none';
    tooltipElement.style.transition = 'opacity 0.2s ease-in-out';
    tooltipElement.style.opacity = '0';
    document.body.appendChild(tooltipElement);
  }
  
  return tooltipElement;
};

/**
 * Показывает тултип в указанной позиции с указанным содержимым
 * @param {number} x - Позиция X
 * @param {number} y - Позиция Y
 * @param {Object} data - Данные для отображения
 * @param {HTMLElement} container - Контейнер графика
 */
const showTooltip = (x, y, data, container) => {
  const tooltipElement = tooltipState.element || initTooltipElement();
  tooltipState.element = tooltipElement;
  tooltipState.container = container;
  tooltipState.data = data;
  tooltipState.isVisible = true;
  
  // Рендерим содержимое тултипа
  tooltipElement.innerHTML = formatTooltipContent(data);
  
  // Вычисляем позицию
  const tooltipRect = tooltipElement.getBoundingClientRect();
  
  // Корректируем позицию, чтобы тултип не выходил за пределы экрана
  let posX = x;
  let posY = y - tooltipRect.height - 10; // По умолчанию показываем сверху
  
  if (posY < 10) {
    // Если не хватает места сверху, показываем снизу
    posY = y + 20;
    tooltipElement.classList.add('tooltip-bottom');
    tooltipElement.classList.remove('tooltip-top');
  } else {
    tooltipElement.classList.add('tooltip-top');
    tooltipElement.classList.remove('tooltip-bottom');
  }
  
  // Проверяем левый и правый край
  if (posX + tooltipRect.width > window.innerWidth - 10) {
    posX = window.innerWidth - tooltipRect.width - 10;
  }
  
  if (posX < 10) {
    posX = 10;
  }
  
  // Устанавливаем позицию
  tooltipElement.style.left = `${posX}px`;
  tooltipElement.style.top = `${posY}px`;
  tooltipElement.style.opacity = '1';
};

/**
 * Скрывает тултип
 */
const hideTooltip = () => {
  if (tooltipState.element) {
    tooltipState.element.style.opacity = '0';
    tooltipState.isVisible = false;
  }
};

/**
 * Формирует HTML-содержимое тултипа на основе данных
 * @param {Object} data - Данные для отображения
 * @returns {string} HTML-содержимое тултипа
 */
const formatTooltipContent = (data) => {
  if (!data) return '';
  
  const { title, value, date, additionalInfo, type = 'info' } = data;
  
  // Базовый CSS класс для тултипа в зависимости от типа
  const tooltipClass = `tooltip-content tooltip-${type}`;
  
  let content = `<div class="${tooltipClass}">`;
  
  // Добавляем заголовок, если он есть
  if (title) {
    content += `<div class="tooltip-title">${title}</div>`;
  }
  
  // Добавляем основное значение
  if (value !== undefined) {
    const formattedValue = typeof value === 'number' ? value.toFixed(2) : value;
    content += `<div class="tooltip-row">
      <span class="tooltip-label">Значение:</span>
      <span class="tooltip-value">${formattedValue}</span>
    </div>`;
  }
  
  // Добавляем дату
  if (date) {
    const formattedDate = typeof date === 'string' ? date : new Date(date).toLocaleString();
    content += `<div class="tooltip-row">
      <span class="tooltip-label">Дата:</span>
      <span class="tooltip-value">${formattedDate}</span>
    </div>`;
  }
  
  // Добавляем дополнительную информацию
  if (additionalInfo && typeof additionalInfo === 'object') {
    Object.entries(additionalInfo).forEach(([key, value]) => {
      content += `<div class="tooltip-row">
        <span class="tooltip-label">${key}:</span>
        <span class="tooltip-value">${value}</span>
      </div>`;
    });
  }
  
  content += '</div>';
  return content;
};

/**
 * Обработчик движения мыши для обновления положения тултипа
 * @param {MouseEvent} event - Событие движения мыши
 */
const handleMouseMove = (event) => {
  if (tooltipState.isVisible) {
    // Обновляем позицию тултипа
    showTooltip(event.clientX, event.clientY, tooltipState.data, tooltipState.container);
  }
};

/**
 * Конфигурирует обработчики событий для графиков
 * @param {string} chartType - Тип графика (например, 'chartjs', 'echarts', 'highcharts')
 * @param {Object} chart - Экземпляр графика
 * @param {HTMLElement} container - Контейнер графика
 * @param {Function} dataFormatter - Функция для форматирования данных точки графика
 * @returns {Object} Набор методов для интеграции с графиком
 */
const configureTooltip = (chartType, chart, container, dataFormatter) => {
  // Добавляем глобальный обработчик движения мыши
  document.removeEventListener('mousemove', handleMouseMove);
  document.addEventListener('mousemove', handleMouseMove);
  
  // Инициализируем элемент тултипа, если его нет
  if (!tooltipState.element) {
    tooltipState.element = initTooltipElement();
  }
  
  // Настраиваем обработчики в зависимости от типа графика
  switch (chartType) {
    case 'chartjs':
      // Для Chart.js
      return configureChartJs(chart, container, dataFormatter);
    
    case 'echarts':
      // Для ECharts
      return configureECharts(chart, container, dataFormatter);
    
    case 'highcharts':
      // Для Highcharts
      return configureHighcharts(chart, container, dataFormatter);
    
    default:
      // Общая конфигурация по умолчанию
      return configureGeneric(container, dataFormatter);
  }
};

/**
 * Конфигурирует тултип для Chart.js
 * @param {Object} chart - Экземпляр Chart.js
 * @param {HTMLElement} container - Контейнер графика
 * @param {Function} dataFormatter - Функция форматирования данных
 * @returns {Object} Объект конфигурации для Chart.js
 */
const configureChartJs = (chart, container, dataFormatter) => {
  // Опции для передачи в конфигурацию Chart.js
  const tooltipOptions = {
    enabled: false, // Отключаем встроенный тултип
    external: (context) => {
      const { chart, tooltip } = context;
      
      if (tooltip.opacity === 0) {
        hideTooltip();
        return;
      }
      
      // Получаем данные из точки графика
      const dataPoints = tooltip.dataPoints || [];
      if (dataPoints.length === 0) return;
      
      const dataPoint = dataPoints[0];
      const formattedData = dataFormatter ? 
        dataFormatter(dataPoint, chart) : 
        {
          title: 'Значение',
          value: dataPoint.raw || dataPoint.y,
          date: null
        };
      
      // Показываем наш тултип
      const position = chart.canvas.getBoundingClientRect();
      showTooltip(
        position.left + dataPoint.element.x,
        position.top + dataPoint.element.y,
        formattedData,
        container
      );
    }
  };
  
  return {
    tooltipOptions,
    // Метод для ручного вызова скрытия тултипа
    hideTooltip: () => hideTooltip()
  };
};

/**
 * Конфигурирует тултип для ECharts
 * @param {Object} chart - Экземпляр ECharts
 * @param {HTMLElement} container - Контейнер графика
 * @param {Function} dataFormatter - Функция форматирования данных
 * @returns {Object} Объект с методами для работы с ECharts
 */
const configureECharts = (chart, container, dataFormatter) => {
  // Опции для передачи в конфигурацию ECharts
  const tooltipOptions = {
    show: false, // Отключаем встроенный тултип
    trigger: 'item'
  };
  
  // Добавляем обработчики событий
  chart.on('mouseover', (params) => {
    const formattedData = dataFormatter ? 
      dataFormatter(params, chart) : 
      {
        title: params.seriesName,
        value: params.value,
        date: params.name
      };
    
    // Получаем координаты в окне
    const position = container.getBoundingClientRect();
    showTooltip(
      position.left + params.event.offsetX,
      position.top + params.event.offsetY,
      formattedData,
      container
    );
  });
  
  chart.on('mouseout', () => {
    hideTooltip();
  });
  
  return {
    tooltipOptions,
    dispose: () => {
      chart.off('mouseover');
      chart.off('mouseout');
      hideTooltip();
    }
  };
};

/**
 * Конфигурирует тултип для Highcharts
 * @param {Object} chart - Экземпляр Highcharts
 * @param {HTMLElement} container - Контейнер графика
 * @param {Function} dataFormatter - Функция форматирования данных
 * @returns {Object} Объект с методами для работы с Highcharts
 */
const configureHighcharts = (chart, container, dataFormatter) => {
  // Опции для передачи в конфигурацию Highcharts
  const tooltipOptions = {
    enabled: false, // Отключаем встроенный тултип
    outside: true
  };
  
  // Обработчик события наведения на точку
  const pointMouseOver = function() {
    const formattedData = dataFormatter ? 
      dataFormatter(this.point, chart) : 
      {
        title: this.series.name,
        value: this.y,
        date: this.x instanceof Date ? this.x.toLocaleString() : this.x
      };
    
    // Получаем позицию точки
    const position = container.getBoundingClientRect();
    const pointPosition = this.point.graphic.getBBox();
    
    showTooltip(
      position.left + pointPosition.x + pointPosition.width / 2,
      position.top + pointPosition.y,
      formattedData,
      container
    );
  };
  
  // Обработчик ухода мыши с точки
  const pointMouseOut = function() {
    hideTooltip();
  };
  
  // Добавляем эти обработчики к каждой серии
  chart.series.forEach(series => {
    series.update({
      point: {
        events: {
          mouseOver: pointMouseOver,
          mouseOut: pointMouseOut
        }
      }
    });
  });
  
  return {
    tooltipOptions,
    dispose: () => {
      // Удаляем обработчики при необходимости
      chart.series.forEach(series => {
        series.update({
          point: {
            events: {
              mouseOver: null,
              mouseOut: null
            }
          }
        });
      });
      hideTooltip();
    }
  };
};

/**
 * Общая конфигурация для произвольных графиков
 * @param {HTMLElement} container - Контейнер графика
 * @param {Function} dataFormatter - Функция форматирования данных
 * @returns {Object} Объект с методами для работы с тултипом
 */
const configureGeneric = (container, dataFormatter) => {
  // Добавляем обработчики событий на контейнер
  const handleOver = (event) => {
    // Генерируем данные на основе положения мыши
    // (в реальном сценарии здесь должна быть логика определения точки графика)
    const x = event.clientX;
    const y = event.clientY;
    
    // Пример данных
    const sampleData = {
      title: 'Точка графика',
      value: Math.round(Math.random() * 100), // Заглушка для примера
      date: new Date().toLocaleString()
    };
    
    const formattedData = dataFormatter ? 
      dataFormatter(sampleData, event) : sampleData;
    
    showTooltip(x, y, formattedData, container);
  };
  
  const handleOut = () => {
    hideTooltip();
  };
  
  container.addEventListener('mousemove', handleOver);
  container.addEventListener('mouseleave', handleOut);
  
  return {
    showTooltip: (x, y, data) => showTooltip(x, y, data, container),
    hideTooltip: () => hideTooltip(),
    dispose: () => {
      container.removeEventListener('mousemove', handleOver);
      container.removeEventListener('mouseleave', handleOut);
      hideTooltip();
    }
  };
};

/**
 * Добавляет глобальные стили для тултипов
 */
const addTooltipStyles = () => {
  if (document.getElementById('chart-tooltip-styles')) return;
  
  const styleElement = document.createElement('style');
  styleElement.id = 'chart-tooltip-styles';
  styleElement.textContent = `
    .chart-tooltip-container {
      position: absolute;
      z-index: 1000;
      pointer-events: none;
      font-family: 'Roboto', Arial, sans-serif;
      font-size: 14px;
      background-color: rgba(255, 255, 255, 0.95);
      border-radius: 4px;
      box-shadow: 0 3px 14px rgba(0, 0, 0, 0.15);
      transition: opacity 0.2s ease;
      max-width: 300px;
      min-width: 150px;
    }
    
    .tooltip-content {
      padding: 10px 12px;
    }
    
    .tooltip-info {
      border-left: 4px solid #17a2b8;
    }
    
    .tooltip-warning {
      border-left: 4px solid #ffc107;
    }
    
    .tooltip-error {
      border-left: 4px solid #dc3545;
    }
    
    .tooltip-success {
      border-left: 4px solid #28a745;
    }
    
    .tooltip-title {
      font-weight: 600;
      margin-bottom: 8px;
      padding-bottom: 5px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      text-align: center;
    }
    
    .tooltip-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    
    .tooltip-label {
      font-weight: 500;
      color: #666;
      margin-right: 10px;
    }
    
    .tooltip-value {
      text-align: right;
      color: #333;
      font-weight: 600;
    }
    
    /* Стрелки тултипа */
    .tooltip-top:after {
      content: '';
      position: absolute;
      bottom: -8px;
      left: 50%;
      margin-left: -8px;
      border-width: 8px 8px 0;
      border-style: solid;
      border-color: rgba(255, 255, 255, 0.95) transparent transparent transparent;
    }
    
    .tooltip-bottom:after {
      content: '';
      position: absolute;
      top: -8px;
      left: 50%;
      margin-left: -8px;
      border-width: 0 8px 8px;
      border-style: solid;
      border-color: transparent transparent rgba(255, 255, 255, 0.95) transparent;
    }
  `;
  
  document.head.appendChild(styleElement);
};

// Добавляем стили при загрузке модуля
addTooltipStyles();

export default {
  configureTooltip,
  showTooltip,
  hideTooltip,
  initTooltipElement
}; 