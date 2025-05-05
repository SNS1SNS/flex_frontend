import React, { createContext, useContext, useState } from 'react';
import CenteredLoading from '../components/CenteredLoading';

// Создаем контекст загрузки
const LoadingContext = createContext({
  loading: false,
  message: '',
  showLoader: () => {},
  hideLoader: () => {},
});

/**
 * Провайдер контекста загрузки
 * Предоставляет доступ к состоянию загрузки для всего приложения
 */
export const LoadingProvider = ({ children }) => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('Загрузка данных...');

  /**
   * Показать индикатор загрузки
   * @param {string} msg - Сообщение, отображаемое под индикатором загрузки
   */
  const showLoader = (msg = 'Загрузка данных...') => {
    setMessage(msg);
    setLoading(true);
  };

  /**
   * Скрыть индикатор загрузки
   */
  const hideLoader = () => {
    setLoading(false);
  };

  return (
    <LoadingContext.Provider value={{ loading, message, showLoader, hideLoader }}>
      {loading && <CenteredLoading message={message} />}
      {children}
    </LoadingContext.Provider>
  );
};

/**
 * Хук для использования контекста загрузки
 * @returns {Object} объект с состоянием загрузки и функциями для управления
 */
export const useLoading = () => useContext(LoadingContext);

export default LoadingContext; 