import React, { useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faMap, faTachometerAlt, faGasPump, faHistory, 
  faBell, faChartBar, faCar, faClipboardList,
  faRoute, faCalendarAlt, faTimes, faSearch,
  faChartLine, faChartPie, faFileAlt, faFileCode,
  faTable, faMapMarkedAlt, faRoad, faThermometerHalf
} from '@fortawesome/free-solid-svg-icons';
import './ReportMenu.css';

/**
 * Компонент меню выбора типа отчета
 * @param {Object} props - Свойства компонента
 * @param {Function} props.onClose - Функция закрытия меню
 * @param {Function} props.onSelectReport - Функция выбора типа отчета
 * @param {Object} props.vehicle - Выбранное транспортное средство
 */
const ReportMenu = ({ onClose, onSelectReport, vehicle }) => {
  const menuRef = useRef(null);
  
  // Стандартные типы отчетов
  const standardReports = [
    {
      id: 'live-track',
      title: 'Трек в реальном времени',
      description: 'Просмотр движения ТС на карте с обновлением в реальном времени',
      icon: faMapMarkedAlt
    },
    {
      id: 'track',
      title: 'Трек движения',
      description: 'Анализ маршрута движения транспортного средства на карте',
      icon: faMap
    },
    {
      id: 'speed',
      title: 'График скорости',
      description: 'Анализ изменения скорости транспортного средства во времени',
      icon: faTachometerAlt
    },
    {
      id: 'fuel',
      title: 'Расход топлива',
      description: 'Анализ расхода и запаса топлива транспортного средства',
      icon: faGasPump
    },
    { id: 'stops', title: 'Стоянки и остановки', description: 'Анализ времени на стоянках и остановках', icon: faHistory },
    { id: 'events', title: 'События', description: 'Просмотр всех событий за период', icon: faBell },
    { id: 'summary', title: 'Сводный отчет', description: 'Общая статистика по транспорту', icon: faChartBar }
  ];
  
  // Дополнительные типы отчетов
  const additionalReports = [
    { id: 'eco', title: 'Эко-вождение', description: 'Анализ стиля вождения', icon: faChartLine },
    { id: 'temperature', title: 'Температурный режим', description: 'Мониторинг температуры', icon: faThermometerHalf },
    { id: 'maintenance', title: 'Техобслуживание', description: 'План и история ТО', icon: faClipboardList },
    { id: 'geozones', title: 'Геозоны', description: 'Анализ посещения геозон', icon: faMapMarkedAlt },
    { id: 'drivers', title: 'Водители', description: 'Отчет по работе водителей', icon: faCar },
    { id: 'trips', title: 'Рейсы', description: 'Статистика по рейсам', icon: faRoute },
    { id: 'mileage', title: 'Пробег', description: 'Детальный отчет по пробегу', icon: faRoad },
    { id: 'utilization', title: 'Использование ТС', description: 'Эффективность использования ТС', icon: faChartPie },
    { id: 'custom', title: 'Конструктор отчетов', description: 'Создание пользовательских отчетов', icon: faFileCode },
    { id: 'export', title: 'Экспорт данных', description: 'Экспорт данных в Excel, PDF, CSV', icon: faFileAlt },
    { id: 'table', title: 'Табличные данные', description: 'Просмотр данных в табличном виде', icon: faTable },
    { id: 'schedule', title: 'Планировщик отчетов', description: 'Настройка автоматической отправки отчетов', icon: faCalendarAlt }
  ];
  
  // Обработчик клика вне меню для закрытия
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);
  
  // Обработчик нажатия клавиши Escape для закрытия
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [onClose]);
  
  return (
    <div className="report-menu">
      <div className="report-menu-inner" ref={menuRef}>
        <div className="report-menu-header">
          <h2>Выберите тип отчета</h2>
          <div className="selected-vehicle">
            <div className="vehicle-icon">
              <FontAwesomeIcon icon={faCar} />
            </div>
            <div className="vehicle-info">
              <div className="vehicle-name">{vehicle?.name || 'Транспортное средство'}</div>
              {vehicle?.imei && <div className="vehicle-imei">IMEI: {vehicle.imei}</div>}
            </div>
          </div>
          <button className="menu-close-btn" onClick={onClose}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        
        <div className="menu-search">
          <FontAwesomeIcon icon={faSearch} className="search-icon" />
          <input 
            type="text" 
            placeholder="Поиск отчетов..." 
            className="search-input" 
          />
        </div>
        
        <div className="report-menu-content">
          <div className="report-menu-section">
            <h3 className="section-title">Основные отчеты</h3>
            <div className="report-menu-columns">
              {standardReports.map((report) => (
                <div 
                  key={report.id} 
                  className="report-item"
                  onClick={() => onSelectReport(report.id)}
                >
                  <div className="report-item-icon">
                    <FontAwesomeIcon icon={report.icon} />
                  </div>
                  <div className="report-item-info">
                    <div className="report-item-title">{report.title}</div>
                    <div className="report-item-description">{report.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="report-menu-section">
            <h3 className="section-title">Дополнительные отчеты</h3>
            <div className="report-menu-columns">
              {additionalReports.map((report) => (
                <div 
                  key={report.id} 
                  className="report-item"
                  onClick={() => onSelectReport(report.id)}
                >
                  <div className="report-item-icon">
                    <FontAwesomeIcon icon={report.icon} />
                  </div>
                  <div className="report-item-info">
                    <div className="report-item-title">{report.title}</div>
                    <div className="report-item-description">{report.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="report-menu-preview">
          <div className="preview-header">
            <FontAwesomeIcon icon={faMap} />
            <h3>Трек движения</h3>
          </div>
          <div className="preview-content">
            <p>
              Отчет "Трек движения" позволяет отобразить маршрут движения транспортного средства на карте с указанием всех событий: стоянок, превышений скорости, заправок и других.
            </p>
            <p>
              Доступны различные карты (OpenStreetMap, Google, Yandex) и дополнительные слои. Вы можете анализировать скоростной режим, расход топлива и другие параметры непосредственно на карте.
            </p>
            <div className="preview-features">
              <div className="feature-item">
                <FontAwesomeIcon icon={faTachometerAlt} />
                <span>Скоростной режим</span>
              </div>
              <div className="feature-item">
                <FontAwesomeIcon icon={faGasPump} />
                <span>Расход топлива</span>
              </div>
              <div className="feature-item">
                <FontAwesomeIcon icon={faHistory} />
                <span>Стоянки</span>
              </div>
              <div className="feature-item">
                <FontAwesomeIcon icon={faBell} />
                <span>События</span>
              </div>
            </div>
            <button 
              className="preview-button"
              onClick={() => onSelectReport('track')}
            >
              Выбрать этот отчет
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportMenu; 