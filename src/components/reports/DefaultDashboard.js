import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faMapMarkedAlt, faGasPump, faTachometerAlt, faClipboardList,
  faClock, faWrench, faBatteryHalf, faChartLine, faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';
import './DefaultDashboard.css';

/**
 * Стартовый экран с дашбордом для страницы отчетов
 * @param {Object} props - Свойства компонента
 * @param {function} props.onOpenReport - Функция открытия отчета
 */
const DefaultDashboard = ({ onOpenReport }) => {
  // Популярные отчеты
  const popularReports = [
    { type: 'Трек', icon: faMapMarkedAlt, description: 'Просмотр маршрута транспортного средства на карте' },
    { type: 'Топливо', icon: faGasPump, description: 'График изменения уровня топлива в баке' },
    { type: 'Скорость', icon: faTachometerAlt, description: 'График изменения скорости транспортного средства' },
    { type: 'Журнал', icon: faClipboardList, description: 'Таблица событий транспортного средства' }
  ];
  
  // Другие доступные отчеты
  const otherReports = [
    { type: 'Стоянки', icon: faClock, description: 'Отчет о стоянках и остановках' },
    { type: 'Двигатель', icon: faWrench, description: 'Данные о работе двигателя' },
    { type: 'Напряжение', icon: faBatteryHalf, description: 'График изменения напряжения бортовой сети' },
    { type: 'Нарушения', icon: faExclamationTriangle, description: 'Отчет о нарушениях скоростного режима и геозон' }
  ];
  
  return (
    <div className="default-dashboard active">
      <div className="dashboard-header">
        <h1>Панель отчетов</h1>
        <p>Выберите отчет из списка ниже или нажмите кнопку "Добавить отчет" для доступа к полному каталогу отчетов</p>
      </div>
      
      <div className="dashboard-sections">
        <div className="dashboard-section">
          <h2>Популярные отчеты</h2>
          <div className="dashboard-cards">
            {popularReports.map((report, index) => (
              <div 
                key={index} 
                className="dashboard-card" 
                onClick={() => onOpenReport(report.type)}
              >
                <div className="card-icon">
                  <FontAwesomeIcon icon={report.icon} />
                </div>
                <div className="card-title">{report.type}</div>
                <div className="card-description">{report.description}</div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="dashboard-section">
          <h2>Другие отчеты</h2>
          <div className="dashboard-cards">
            {otherReports.map((report, index) => (
              <div 
                key={index} 
                className="dashboard-card" 
                onClick={() => onOpenReport(report.type)}
              >
                <div className="card-icon">
                  <FontAwesomeIcon icon={report.icon} />
                </div>
                <div className="card-title">{report.type}</div>
                <div className="card-description">{report.description}</div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="dashboard-section">
          <h2>Советы по использованию</h2>
          <div className="dashboard-tips">
            <div className="dashboard-tip">
              <div className="tip-icon">
                <FontAwesomeIcon icon={faChartLine} />
              </div>
              <div className="tip-content">
                <div className="tip-title">Анализ данных</div>
                <div className="tip-description">
                  Используйте комбинацию отчетов для полного анализа работы транспортных средств. 
                  Например, сопоставьте данные о скорости с данными о расходе топлива для оценки эффективности.
                </div>
              </div>
            </div>
            
            <div className="dashboard-tip">
              <div className="tip-icon">
                <FontAwesomeIcon icon={faMapMarkedAlt} />
              </div>
              <div className="tip-content">
                <div className="tip-title">Работа с картой</div>
                <div className="tip-description">
                  На карте трека вы можете выбирать разные слои карты (спутник, схема, гибрид),
                  а также использовать масштабирование для детального анализа маршрута.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DefaultDashboard; 