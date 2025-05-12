import React, { useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMapMarkerAlt, faRoute, faTachometerAlt, faGasPump, 
  faChartArea, faTimes, faBatteryHalf, faCar
} from '@fortawesome/free-solid-svg-icons';
import './SplitReportSelector.css';

/**
 * Компонент выбора отчета для добавления в разделенный экран
 * 
 * @param {Object} props - Свойства компонента
 * @param {Function} props.onSelectReport - Функция вызываемая при выборе отчета
 * @param {Function} props.onCancel - Функция отмены выбора
 * @param {Object} props.selectedVehicle - Выбранное транспортное средство
 * @param {string} props.containerType - Тип контейнера (horizontal или vertical)
 * @param {string} props.placement - Расположение селектора относительно разделяемого контейнера
 */
const SplitReportSelector = ({ 
  onSelectReport, 
  onCancel, 
  selectedVehicle, 
  containerType = 'vertical',
  placement = 'right'
}) => {
  const selectorRef = useRef(null);
  
  // Список доступных отчетов
  const reportTypes = [
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
    },
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
      icon: faBatteryHalf,
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
      id: 'engine',
      icon: faCar,
      title: 'Двигатель',
      description: 'Состояние двигателя',
      category: 'chart'
    }
  ];

  // Обработчик клика вне компонента для закрытия
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target)) {
        onCancel();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onCancel]);

  // Обработчик выбора отчета
  const handleReportSelect = (reportId) => {
    if (!selectedVehicle) {
      alert('Пожалуйста, выберите транспортное средство для создания отчета');
      return;
    }
    
    onSelectReport(reportId);
  };

  // Определяем дополнительный класс для позиционирования в зависимости от типа контейнера
  const getPositionClass = () => {
    // Если тип контейнера horizontal, то селектор располагаем снизу или сверху
    if (containerType === 'horizontal') {
      return placement === 'right' ? 'bottom' : 'top';
    }
    // Для vertical используем указанное размещение (по умолчанию справа)
    return placement;
  };

  return (
    <div className={`split-report-selector ${getPositionClass()}`} ref={selectorRef}>
      <div className="selector-header">
        <h3>Выберите отчет для добавления</h3>
        <div className="selector-vehicle">
          {selectedVehicle && selectedVehicle.name ? selectedVehicle.name : 'Не выбрано ТС'}
        </div>
        <button className="selector-close-btn" onClick={onCancel}>
          <FontAwesomeIcon icon={faTimes} />
        </button>
      </div>
      
      <div className="selector-content">
        <div className="selector-section">
          <h4>Карты</h4>
          <div className="report-items">
            {reportTypes
              .filter(report => report.category === 'map')
              .map(report => (
                <div 
                  key={report.id}
                  className="report-item"
                  onClick={() => handleReportSelect(report.id)}
                >
                  <div className="report-item-icon">
                    <FontAwesomeIcon icon={report.icon} />
                  </div>
                  <div className="report-item-content">
                    <div className="report-item-title">{report.title}</div>
                    <div className="report-item-description">{report.description}</div>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
        
        <div className="selector-section">
          <h4>Графики</h4>
          <div className="report-items">
            {reportTypes
              .filter(report => report.category === 'chart')
              .map(report => (
                <div 
                  key={report.id}
                  className="report-item"
                  onClick={() => handleReportSelect(report.id)}
                >
                  <div className="report-item-icon">
                    <FontAwesomeIcon icon={report.icon} />
                  </div>
                  <div className="report-item-content">
                    <div className="report-item-title">{report.title}</div>
                    <div className="report-item-description">{report.description}</div>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      </div>
      
      <div className="selector-footer">
        <button className="cancel-btn" onClick={onCancel}>Отмена</button>
      </div>
    </div>
  );
};

export default SplitReportSelector; 