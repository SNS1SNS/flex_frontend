import React, { useState, useRef, useEffect } from 'react';
import './Tooltip.css';

/**
 * Компонент всплывающей подсказки
 * @param {Object} props - Свойства компонента
 * @param {React.ReactNode} props.children - Элемент, к которому прикрепляется подсказка
 * @param {string} props.content - Содержимое подсказки
 * @param {string} props.position - Позиция подсказки (top, bottom, left, right)
 * @param {string} props.type - Тип подсказки (info, warning, error, success)
 * @param {number} props.delay - Задержка перед появлением подсказки в мс
 * @param {boolean} props.arrow - Отображать ли стрелку на подсказке
 * @returns {React.ReactElement} Компонент Tooltip
 */
const Tooltip = ({ 
  children, 
  content, 
  position = 'top', 
  type = 'info', 
  delay = 200,
  arrow = true,
  className = '',
  style = {}
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef(null);
  const targetRef = useRef(null);
  const timeoutRef = useRef(null);

  // Обработка появления подсказки
  const handleMouseEnter = () => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      updateTooltipPosition();
    }, delay);
  };

  // Обработка скрытия подсказки
  const handleMouseLeave = () => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 100);
  };

  // Обновление позиции подсказки при изменении состояния или размеров
  useEffect(() => {
    if (isVisible) {
      updateTooltipPosition();
    }
    
    return () => {
      clearTimeout(timeoutRef.current);
    };
  }, [isVisible, content, position]);

  // Добавляем обработчик изменения размера окна
  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Обработка изменения размера окна
  const handleResize = () => {
    if (isVisible) {
      updateTooltipPosition();
    }
  };

  // Расчет позиции подсказки относительно целевого элемента
  const updateTooltipPosition = () => {
    if (!tooltipRef.current || !targetRef.current) return;

    const targetRect = targetRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const scrollX = window.scrollX || document.documentElement.scrollLeft;
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    
    let top, left;

    switch (position) {
      case 'bottom':
        top = targetRect.bottom + scrollY + 10;
        left = targetRect.left + scrollX + (targetRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'left':
        top = targetRect.top + scrollY + (targetRect.height / 2) - (tooltipRect.height / 2);
        left = targetRect.left + scrollX - tooltipRect.width - 10;
        break;
      case 'right':
        top = targetRect.top + scrollY + (targetRect.height / 2) - (tooltipRect.height / 2);
        left = targetRect.right + scrollX + 10;
        break;
      case 'top':
      default:
        top = targetRect.top + scrollY - tooltipRect.height - 10;
        left = targetRect.left + scrollX + (targetRect.width / 2) - (tooltipRect.width / 2);
        break;
    }

    // Проверка на выход за пределы экрана
    const rightEdge = window.innerWidth + scrollX;
    const bottomEdge = window.innerHeight + scrollY;

    // Корректировка левой позиции
    if (left < scrollX) {
      left = scrollX + 5;
    } else if (left + tooltipRect.width > rightEdge) {
      left = rightEdge - tooltipRect.width - 5;
    }

    // Корректировка верхней позиции
    if (top < scrollY) {
      top = scrollY + 5;
    } else if (top + tooltipRect.height > bottomEdge) {
      top = bottomEdge - tooltipRect.height - 5;
    }

    setTooltipPosition({ top, left });
  };

  return (
    <div 
      className="tooltip-container"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      ref={targetRef}
    >
      {children}

      {isVisible && (
        <div
          ref={tooltipRef}
          className={`tooltip tooltip-${type} tooltip-${position} ${className} ${arrow ? 'tooltip-arrow' : ''}`}
          style={{
            ...style,
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
};

export default Tooltip; 