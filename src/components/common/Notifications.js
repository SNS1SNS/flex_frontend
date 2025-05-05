import React, { useEffect } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faInfoCircle, faCheckCircle, 
  faExclamationTriangle, faTimesCircle 
} from '@fortawesome/free-solid-svg-icons';
import './Notifications.css';

/**
 * Компонент для отображения уведомлений
 * Использует react-toastify для показа всплывающих уведомлений
 */
const Notifications = () => {
  // Настройка стилей для разных типов уведомлений
  const getToastIcon = (type) => {
    switch (type) {
      case 'success':
        return <FontAwesomeIcon icon={faCheckCircle} />;
      case 'warning':
        return <FontAwesomeIcon icon={faExclamationTriangle} />;
      case 'error':
        return <FontAwesomeIcon icon={faTimesCircle} />;
      case 'info':
      default:
        return <FontAwesomeIcon icon={faInfoCircle} />;
    }
  };
  
  // Добавляем глобальную функцию для показа уведомлений
  useEffect(() => {
    window.showNotification = (type, message) => {
      switch (type) {
        case 'success':
          toast.success(message, {
            icon: getToastIcon('success')
          });
          break;
        case 'warning':
          toast.warning(message, {
            icon: getToastIcon('warning')
          });
          break;
        case 'error':
          toast.error(message, {
            icon: getToastIcon('error')
          });
          break;
        case 'info':
        default:
          toast.info(message, {
            icon: getToastIcon('info')
          });
          break;
      }
    };
    
    return () => {
      // Очищаем глобальную функцию при размонтировании
      delete window.showNotification;
    };
  }, []);
  
  return (
    <ToastContainer
      position="top-right"
      autoClose={5000}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
    />
  );
};

export default Notifications; 