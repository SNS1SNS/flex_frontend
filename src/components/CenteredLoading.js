import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSync } from '@fortawesome/free-solid-svg-icons';
import './CenteredLoading.css';

/**
 * Компонент для отображения центрированного индикатора загрузки
 * @param {Object} props
 * @param {string} props.message - Сообщение под индикатором загрузки
 */
const CenteredLoading = ({ message = 'Загрузка данных...' }) => {
  return (
    <div className="centered-loading-container">
      <div className="centered-loading-overlay">
        <div className="centered-loading-content">
          <FontAwesomeIcon icon={faSync} spin className="centered-loading-icon" />
          <div className="centered-loading-message">{message}</div>
        </div>
      </div>
    </div>
  );
};

export default CenteredLoading; 