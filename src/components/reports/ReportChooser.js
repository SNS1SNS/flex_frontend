import React, { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom';
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
 * @param {String} props.containerId - ID контейнера, к которому привязано модальное окно
 */
const ReportChooser = ({ onSelectReport, onClose, selectedVehicle, originalReport, containerId }) => {
  // Состояние и ref для управления порталом
  const [portalElement, setPortalElement] = useState(null);
  const modalRef = useRef(null);
  
  // Создаем DOM-элемент для портала при первом рендере
  useEffect(() => {
    // Ищем существующий контейнер для модальных окон или создаем новый
    let modalRoot = document.getElementById('modal-root');
    if (!modalRoot) {
      modalRoot = document.createElement('div');
      modalRoot.id = 'modal-root';
      document.body.appendChild(modalRoot);
    }
    
    // Создаем уникальный элемент для этого конкретного модального окна
    const modalElement = document.createElement('div');
    modalElement.className = 'report-chooser-portal';
    modalElement.dataset.sourceContainer = containerId || 'unknown';
    modalRoot.appendChild(modalElement);
    
    // Устанавливаем в state для использования в портале
    setPortalElement(modalElement);
    
    // Очистка при размонтировании
    return () => {
      try {
        // Безопасное удаление DOM-элемента портала
        if (modalElement && modalElement.parentNode) {
          modalElement.parentNode.removeChild(modalElement);
        }
      } catch (err) {
        console.error('ReportChooser: Ошибка при удалении портала:', err);
      }
    };
  }, [containerId]);

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

  // Обработчик нажатия клавиши Escape для закрытия
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        console.log('ReportChooser: Нажата клавиша Escape, закрываем модальное окно');
        onClose();
      }
    };
    
    // Добавляем обработчик при монтировании
    document.addEventListener('keydown', handleKeyDown);
    
    // Также закроем модальное окно автоматически через 1 минуту (на всякий случай)
    const autoCloseTimeout = setTimeout(() => {
      console.log('ReportChooser: Автоматическое закрытие модального окна через 1 минуту');
      onClose();
    }, 60000);
    
    // Удаляем обработчик при размонтировании
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearTimeout(autoCloseTimeout);
    };
  }, [onClose]);

  // Обрабатываем события загрузки/выгрузки страницы
  useEffect(() => {
    const handleBeforeUnload = () => {
      console.log('ReportChooser: Страница закрывается, закрываем модальное окно');
      onClose();
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
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
    } catch (err) {
      console.error('ReportChooser: Ошибка при обработке выбора отчета:', err);
    }
  };

  // Обработчик предотвращения всплытия события клика
  const handleOverlayClick = (event) => {
    // Останавливаем всплытие события только если это клик по фону
    if (event.target === event.currentTarget) {
      console.log('ReportChooser: Клик по overlay, закрываем');
      onClose();
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
    onClose();
  };

  // Обработчик кнопки отмена в футере
  const handleCancelButtonClick = (event) => {
    event.stopPropagation();
    console.log('ReportChooser: Нажата кнопка Отмена в футере');
    onClose();
  };

  // Создаем модальное содержимое
  const modalContent = (
    <div className="report-chooser-overlay" onClick={handleOverlayClick} ref={modalRef}>
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
          <button className="btn btn-cancel" onClick={handleCancelButtonClick}>Отмена</button>
          <div className="footer-info">
            Выберите тип отчета для отображения
          </div>
        </div>
      </div>
    </div>
  );

  // Используем React Portal для рендеринга модального окна в отдельной части DOM
  // Это помогает избежать проблем с порядком монтирования/размонтирования
  return portalElement ? ReactDOM.createPortal(modalContent, portalElement) : null;
};

export default ReportChooser; 