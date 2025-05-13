import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMapMarkerAlt, faRoute, faTachometerAlt, faGasPump, 
  faChartLine, faChartArea
} from '@fortawesome/free-solid-svg-icons';
import './ReportStyles.css';

/**
 * Компонент для выбора отчетов при разделении экрана
 * @param {Object} props - Свойства компонента
 * @param {Function} props.onSelectReport - Функция, вызываемая при выборе отчета
 * @param {Function} props.onCancel - Функция, вызываемая при отмене выбора
 * @param {Object} props.selectedVehicle - Выбранное транспортное средство
 */
const ReportSelector = ({ onSelectReport, onCancel, selectedVehicle }) => {
  // Список доступных отчетов с их описаниями
  const reportTypes = [
    {
      id: 'track',
      icon: faRoute,
      title: 'Трек',
      description: 'Визуализация маршрута движения транспортного средства на карте с отметками остановок и событий',
      category: 'map'
    },
    {
      id: 'live-track',
      icon: faMapMarkerAlt,
      title: 'Местоположение',
      description: 'Отслеживание транспортного средства в реальном времени с обновлением положения и телеметрических данных',
      category: 'map'
    },
    {
      id: 'speed',
      icon: faTachometerAlt,
      title: 'Скорость',
      description: 'График скорости движения транспорта с выделением нарушений скоростного режима',
      category: 'chart'
    },
    {
      id: 'fuel',
      icon: faGasPump,
      title: 'Объем топлива',
      description: 'График изменения уровня топлива с отметками заправок, сливов и расхода',
      category: 'chart'
    },
    {
      id: 'voltage',
      icon: faChartLine,
      title: 'Напряжение',
      description: 'График изменения напряжения бортовой сети транспортного средства',
      category: 'chart'
    },
    {
      id: 'rpm',
      icon: faChartArea,
      title: 'Обороты двигателя',
      description: 'График оборотов двигателя транспортного средства с анализом нагрузки',
      category: 'chart'
    }
  ];

  // Группируем отчеты по категориям
  const mapReports = reportTypes.filter(report => report.category === 'map');
  const chartReports = reportTypes.filter(report => report.category === 'chart');

  // Обработчик выбора отчета
  const handleReportSelect = (reportId) => {
    if (!selectedVehicle) {
      alert('Пожалуйста, выберите транспортное средство для создания отчета');
      return;
    }
    
    onSelectReport(reportId);
    
    // Закрываем окно выбора отчётов после выбора
    onCancel();
  };

  return (
    <div className="report-selector">
      {!selectedVehicle && (
        <div className="report-selector-warning">
          <p>Сначала выберите транспортное средство в боковой панели!</p>
          <button className="btn btn-secondary" onClick={onCancel}>
            Закрыть
          </button>
        </div>
      )}
      
      {selectedVehicle && (
        <>
          <div className="report-selector-header">
            <h3>Выберите отчет для {selectedVehicle.name}</h3>
            <button className="report-selector-close" onClick={onCancel}>×</button>
          </div>
          
          <div className="report-selector-categories">
            <div className="report-category">
              <h4>Карта</h4>
              <div className="report-cards">
                {mapReports.map(report => (
                  <div 
                    key={report.id}
                    className="report-card"
                    onClick={() => handleReportSelect(report.id)}
                  >
                    <div className="report-card-icon">
                      <FontAwesomeIcon icon={report.icon} />
                    </div>
                    <div className="report-card-title">{report.title}</div>
                    <div className="report-card-description">{report.description}</div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="report-category">
              <h4>Графики</h4>
              <div className="report-cards">
                {chartReports.map(report => (
                  <div 
                    key={report.id}
                    className="report-card"
                    onClick={() => handleReportSelect(report.id)}
                  >
                    <div className="report-card-icon">
                      <FontAwesomeIcon icon={report.icon} />
                    </div>
                    <div className="report-card-title">{report.title}</div>
                    <div className="report-card-description">{report.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ReportSelector; 