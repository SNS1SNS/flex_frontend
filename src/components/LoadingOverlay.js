import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSync } from '@fortawesome/free-solid-svg-icons';
import './LoadingOverlay.css';

/**
 * Универсальный компонент индикатора загрузки
 * @param {Object} props - Свойства компонента
 * @param {string} props.message - Сообщение, отображаемое под индикатором (по умолчанию "Загрузка данных...")
 * @param {boolean} props.fullScreen - Если true, индикатор будет занимать весь экран
 * @param {string} props.backgroundColor - Цвет фона (по умолчанию полупрозрачный белый)
 * @param {React.CSSProperties} props.style - Дополнительные стили для компонента
 */
const LoadingOverlay = ({ 
  message = 'Загрузка данных...', 
  fullScreen = false,
  backgroundColor = 'rgba(255, 255, 255, 0.8)',
  style = {}
}) => {
  return (
    <div 
      className={`loading-overlay ${fullScreen ? 'full-screen' : ''}`} 
      style={{ backgroundColor, ...style }}
    >
      <div className="loading-content">
        <FontAwesomeIcon icon={faSync} spin className="loading-icon" />
        <span className="loading-message">{message}</span>
      </div>
    </div>
  );
};

export default LoadingOverlay; 