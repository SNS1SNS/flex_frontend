import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMapMarkerAlt, faRoute, faTachometerAlt, faGasPump, 
  faChartLine, faChartArea, faTimes, faCar
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
    },
    {
      id: 'engine',
      icon: faCar,
      title: 'Двигатель',
      description: 'Состояние двигателя',
      category: 'chart'
    }
  ];

  // Обработчик выбора отчета
  const handleSelectReport = (reportType) => {
    if (!selectedVehicle) {
      window.showNotification('warning', 'Сначала выберите транспортное средство!');
      return;
    }
    
    // Вызываем переданный обработчик
    onSelectReport(reportType);
  };

  return (
    <div className="report-chooser-overlay">
      <div className="report-chooser">
        <div className="report-chooser-header">
          <h3>Выберите отчет для разделенного экрана</h3>
          <button className="close-btn" onClick={onClose}>
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
          <button className="cancel-btn" onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>
  );
};

export default ReportChooser; 