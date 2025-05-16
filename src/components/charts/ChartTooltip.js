import React from 'react';
import Tooltip from '../common/Tooltip';
import './ChartTooltip.css';

/**
 * Компонент для отображения всплывающей подсказки с информацией о точке на графике
 * @param {Object} props - Свойства компонента
 * @param {React.ReactNode} props.children - Элемент, к которому прикрепляется подсказка
 * @param {Object} props.data - Данные точки графика (значение, дата, дополнительная информация)
 * @param {string} props.title - Заголовок подсказки
 * @param {string} props.position - Позиция подсказки (top, bottom, left, right)
 * @param {boolean} props.showDate - Отображать ли дату в подсказке
 * @returns {React.ReactElement} Компонент ChartTooltip
 */
const ChartTooltip = ({ 
  children, 
  data, 
  title, 
  position = 'top', 
  showDate = true,
  type = 'info'
}) => {
  if (!data) {
    return children;
  }

  // Форматирование даты, если она есть и нужно показывать
  const formattedDate = showDate && data.date ? 
    (typeof data.date === 'string' ? data.date : new Date(data.date).toLocaleString()) 
    : null;

  // Форматирование значения
  const formattedValue = data.value !== undefined ? 
    (typeof data.value === 'number' ? data.value.toFixed(2) : data.value)
    : null;

  // Генерация содержимого тултипа
  const tooltipContent = (
    <div className="chart-tooltip-content">
      {title && <div className="chart-tooltip-title">{title}</div>}
      
      {formattedValue !== null && (
        <div className="chart-tooltip-value">
          <span className="chart-tooltip-label">Значение:</span> 
          <span className="chart-tooltip-data">{formattedValue}{data.unit ? ` ${data.unit}` : ''}</span>
        </div>
      )}
      
      {formattedDate && (
        <div className="chart-tooltip-date">
          <span className="chart-tooltip-label">Дата:</span> 
          <span className="chart-tooltip-data">{formattedDate}</span>
        </div>
      )}
      
      {/* Дополнительные сведения, если есть */}
      {data.additionalInfo && Object.entries(data.additionalInfo).map(([key, value]) => (
        <div className="chart-tooltip-additional" key={key}>
          <span className="chart-tooltip-label">{key}:</span> 
          <span className="chart-tooltip-data">{value}</span>
        </div>
      ))}
    </div>
  );

  return (
    <Tooltip 
      content={tooltipContent} 
      position={position}
      type={type}
      className="chart-tooltip"
    >
      {children}
    </Tooltip>
  );
};

export default ChartTooltip; 