import React, { useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMapMarkerAlt, faRoute, faTachometerAlt, faGasPump, 
  faChartLine, faChartArea, faTimes
} from '@fortawesome/free-solid-svg-icons';
import './ReportChooser.css';

/**
 * Компонент для выбора отчета при разделении экрана
 * @param {Object} props - Свойства компонента
 * @param {Function} props.onSelectReport - Функция вызываемая при выборе отчета
 * @param {Function} props.onClose - Функция закрытия выбора без выбора отчета
 * @param {Object} props.selectedVehicle - Выбранное транспортное средство
 * @param {Object} props.originalReport - Исходный отчет (если уже выбран)
 */
const ReportChooser = ({ onSelectReport, onClose, selectedVehicle, originalReport }) => {
  // Список доступных отчетов
  const reportTypes = [
    {
      id: 'speed',
      icon: faTachometerAlt,
      title: 'Скорость',
      description: 'График скорости движения',
      category: 'chart'
    },
    {
      id: 'fuel',
      icon: faGasPump,
      title: 'Топливо',
      description: 'График уровня топлива',
      category: 'chart'
    },
    {
      id: 'voltage',
      icon: faChartLine,
      title: 'Напряжение',
      description: 'График напряжения бортсети',
      category: 'chart'
    },
    {
      id: 'rpm',
      icon: faChartArea,
      title: 'Обороты',
      description: 'График оборотов двигателя',
      category: 'chart'
    },
    {
      id: 'track',
      icon: faRoute,
      title: 'Трек',
      description: 'Маршрут движения на карте',
      category: 'map'
    },
    {
      id: 'live-track',
      icon: faMapMarkerAlt,
      title: 'Местоположение',
      description: 'Текущее положение ТС',
      category: 'map'
    }
  ];

  // Функция принудительного закрытия модального окна
  const forceCloseModal = () => {
    try {
      // Находим все модальные окна и удаляем их
      const overlays = document.querySelectorAll('.report-chooser-overlay');
      console.log('ReportChooser: Найдено модальных окон для принудительного удаления:', overlays.length);
      
      overlays.forEach(overlay => {
        console.log('ReportChooser: Принудительное удаление модального окна из DOM');
        overlay.parentNode.removeChild(overlay);
      });
    } catch (err) {
      console.error('ReportChooser: Ошибка при принудительном удалении:', err);
    }
  };

  // Обработчик нажатия клавиши Escape для закрытия
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        console.log('ReportChooser: Нажата клавиша Escape, закрываем модальное окно');
        onClose();
        setTimeout(forceCloseModal, 100);
      }
    };
    
    // Добавляем обработчик при монтировании
    document.addEventListener('keydown', handleKeyDown);
    
    // Также закроем модальное окно автоматически через 2 минуты (на всякий случай)
    const autoCloseTimeout = setTimeout(() => {
      console.log('ReportChooser: Автоматическое закрытие модального окна через 2 минуты');
      onClose();
      forceCloseModal();
    }, 120000);
    
    // Удаляем обработчик при размонтировании
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearTimeout(autoCloseTimeout);
    };
  }, [onClose]);

  // Обработчик выбора отчета
  const handleSelectReport = (reportType) => {
    if (!selectedVehicle) {
      window.showNotification('warning', 'Сначала выберите транспортное средство!');
      return;
    }
    
    console.log('ReportChooser: Выбран отчет', reportType);
    
    try {
      // Вызываем переданный обработчик
      onSelectReport(reportType);
      
      // Закрываем окно выбора отчётов после выбора
      console.log('ReportChooser: Вызываем onClose для закрытия окна выбора отчетов');
      onClose();
      
      console.log('ReportChooser: onClose вызван');
      
      // РАДИКАЛЬНОЕ РЕШЕНИЕ: принудительное удаление модального окна из DOM
      setTimeout(() => {
        try {
          // Находим все модальные окна и удаляем их
          const overlays = document.querySelectorAll('.report-chooser-overlay');
          console.log('ReportChooser: Найдено модальных окон для принудительного удаления:', overlays.length);
          
          overlays.forEach(overlay => {
            console.log('ReportChooser: Принудительное удаление модального окна из DOM');
            overlay.parentNode.removeChild(overlay);
          });
        } catch (err) {
          console.error('ReportChooser: Ошибка при принудительном удалении:', err);
        }
      }, 100);
    } catch (err) {
      console.error('ReportChooser: Ошибка при обработке выбора отчета:', err);
    }
  };

  // Обработчик предотвращения всплытия события клика
  const handleOverlayClick = (event) => {
    // Останавливаем всплытие события только если это клик по фону
    if (event.target === event.currentTarget) {
      console.log('ReportChooser: Клик по overlay, закрываем');
      
      try {
        // Вызываем стандартный onClose
        onClose();
        
        // РАДИКАЛЬНОЕ РЕШЕНИЕ: принудительное удаление модального окна из DOM
        setTimeout(() => {
          try {
            // Находим все модальные окна и удаляем их
            const overlays = document.querySelectorAll('.report-chooser-overlay');
            console.log('ReportChooser: Найдено модальных окон для принудительного удаления:', overlays.length);
            
            overlays.forEach(overlay => {
              console.log('ReportChooser: Принудительное удаление модального окна из DOM');
              overlay.parentNode.removeChild(overlay);
            });
          } catch (err) {
            console.error('ReportChooser: Ошибка при принудительном удалении:', err);
          }
        }, 100);
      } catch (err) {
        console.error('ReportChooser: Ошибка при закрытии модального окна по фону:', err);
      }
    }
  };
  
  // Предотвращаем всплытие событий из модального окна
  const handleModalClick = (event) => {
    // Останавливаем всплытие события клика
    event.stopPropagation();
  };

  // Обработчик кнопки закрытия
  const handleCloseButtonClick = (event) => {
    event.stopPropagation();
    console.log('ReportChooser: Нажата кнопка закрытия');
    
    try {
      // Вызываем стандартный onClose
      onClose();
      
      // РАДИКАЛЬНОЕ РЕШЕНИЕ: принудительное удаление модального окна из DOM
      setTimeout(() => {
        try {
          // Находим все модальные окна и удаляем их
          const overlays = document.querySelectorAll('.report-chooser-overlay');
          console.log('ReportChooser: Найдено модальных окон для принудительного удаления:', overlays.length);
          
          overlays.forEach(overlay => {
            console.log('ReportChooser: Принудительное удаление модального окна из DOM');
            overlay.parentNode.removeChild(overlay);
          });
        } catch (err) {
          console.error('ReportChooser: Ошибка при принудительном удалении:', err);
        }
      }, 100);
    } catch (err) {
      console.error('ReportChooser: Ошибка при закрытии модального окна:', err);
    }
  };

  // Обработчик кнопки отмена в футере
  const handleCancelButtonClick = (event) => {
    event.stopPropagation();
    console.log('ReportChooser: Нажата кнопка Отмена в футере');
    
    try {
      // Вызываем стандартный onClose
      onClose();
      
      // РАДИКАЛЬНОЕ РЕШЕНИЕ: принудительное удаление модального окна из DOM
      setTimeout(() => {
        try {
          // Находим все модальные окна и удаляем их
          const overlays = document.querySelectorAll('.report-chooser-overlay');
          console.log('ReportChooser: Найдено модальных окон для принудительного удаления:', overlays.length);
          
          overlays.forEach(overlay => {
            console.log('ReportChooser: Принудительное удаление модального окна из DOM');
            overlay.parentNode.removeChild(overlay);
          });
        } catch (err) {
          console.error('ReportChooser: Ошибка при принудительном удалении:', err);
        }
      }, 100);
    } catch (err) {
      console.error('ReportChooser: Ошибка при закрытии модального окна кнопкой Отмена:', err);
    }
  };

  return (
    <div className="report-chooser-overlay" onClick={handleOverlayClick}>
      <div className="report-chooser" onClick={handleModalClick}>
        <div className="report-chooser-header">
          <h3>Выберите отчет для разделенного экрана</h3>
          <button className="close-btn" onClick={handleCloseButtonClick}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        
        <div className="report-chooser-content">
          {!selectedVehicle && (
            <div className="report-warning">
              <p>Сначала выберите транспортное средство!</p>
            </div>
          )}
          
          <div className="report-category">
            <h4>Графики</h4>
            <div className="report-items">
              {reportTypes
                .filter(report => report.category === 'chart')
                .map(report => (
                  <div 
                    key={report.id}
                    className={`report-item ${originalReport === report.id ? 'active' : ''}`}
                    onClick={() => handleSelectReport(report.id)}
                  >
                    <div className="report-icon">
                      <FontAwesomeIcon icon={report.icon} />
                    </div>
                    <div className="report-info">
                      <div className="report-title">{report.title}</div>
                      <div className="report-description">{report.description}</div>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
          
          <div className="report-category">
            <h4>Карты</h4>
            <div className="report-items">
              {reportTypes
                .filter(report => report.category === 'map')
                .map(report => (
                  <div 
                    key={report.id}
                    className={`report-item ${originalReport === report.id ? 'active' : ''}`}
                    onClick={() => handleSelectReport(report.id)}
                  >
                    <div className="report-icon">
                      <FontAwesomeIcon icon={report.icon} />
                    </div>
                    <div className="report-info">
                      <div className="report-title">{report.title}</div>
                      <div className="report-description">{report.description}</div>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
        
        <div className="report-chooser-footer">
          <button className="cancel-btn" onClick={handleCancelButtonClick}>Отмена</button>
        </div>
      </div>
    </div>
  );
};

export default ReportChooser; 