import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCalendarAlt, faTruck, faUser, faMapMarkerAlt,
  faFolder, faChevronDown, faChevronRight, faSearch,
  faChevronLeft, faCar, faFilter, faChartBar, faEye, faCog
} from '@fortawesome/free-solid-svg-icons';
import './ReportSidebar.css';

/**
 * Компонент боковой панели для страницы отчетов
 * @param {Object} props - Свойства компонента
 * @param {ReactNode} props.children - Содержимое боковой панели
 */
const ReportSidebar = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState('vehicles');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedFolders, setExpandedFolders] = useState({
    trucks: true,
    cars: true,
    special: true
  });
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [activeFilters, setActiveFilters] = useState([]);
  
  // Обработчик переключения состояния сворачивания боковой панели
  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };
  
  // Обработчик изменения активной секции
  const handleSectionChange = (section) => {
    setActiveSection(section);
  };
  
  // Обработчик переключения состояния свернутости папки
  const toggleFolder = (folderName) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderName]: !prev[folderName]
    }));
  };
  
  // Функция для обработки выбора транспортного средства
  const handleVehicleSelect = (vehicle) => {
    setSelectedVehicleId(vehicle.id);
  };
  
  // Функция для переключения фильтра статуса
  const toggleStatusFilter = (status) => {
    setActiveFilters(prev => {
      if (prev.includes(status)) {
        return prev.filter(s => s !== status);
      } else {
        return [...prev, status];
      }
    });
  };
  
  // Фильтрация транспортных средств по поисковому запросу и статусам
  const filteredVehicles = (window.vehicles || []).filter(vehicle => {
    const matchesSearch = vehicle.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = activeFilters.length === 0 || activeFilters.includes(vehicle.status || 'green');
    return matchesSearch && matchesStatus;
  });
  
  // Распределение транспортных средств по группам
  const vehicleGroups = {
    trucks: filteredVehicles.filter(v => 
      v.name.includes('Камаз') || 
      v.name.includes('МАЗ') || 
      v.name.includes('Volvo') || 
      v.name.includes('Actros')
    ),
    cars: filteredVehicles.filter(v => 
      v.name.includes('Газель') || 
      v.name.includes('УАЗ') || 
      v.name.includes('Лада')
    ),
    special: filteredVehicles.filter(v => 
      !vehicleGroups.trucks.includes(v) && 
      !vehicleGroups.cars.includes(v)
    )
  };
  
  return (
    <div className={`report-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-title">
          {!isCollapsed && <span>Управление отчетами</span>}
        </div>
        <button className="sidebar-toggle" onClick={toggleSidebar}>
          <FontAwesomeIcon icon={isCollapsed ? faChevronRight : faChevronLeft} />
        </button>
      </div>
      
      <div className="sidebar-content">
        <div className="sidebar-tabs">
          <button 
            className={`sidebar-tab ${activeSection === 'vehicles' ? 'active' : ''}`}
            onClick={() => handleSectionChange('vehicles')}
            title="Транспортные средства"
          >
            <FontAwesomeIcon icon={faCar} />
            {!isCollapsed && <span>Транспорт</span>}
          </button>
          <button 
            className={`sidebar-tab ${activeSection === 'filters' ? 'active' : ''}`}
            onClick={() => handleSectionChange('filters')}
            title="Фильтры"
          >
            <FontAwesomeIcon icon={faFilter} />
            {!isCollapsed && <span>Фильтры</span>}
          </button>
          <button 
            className={`sidebar-tab ${activeSection === 'dates' ? 'active' : ''}`}
            onClick={() => handleSectionChange('dates')}
            title="Период"
          >
            <FontAwesomeIcon icon={faCalendarAlt} />
            {!isCollapsed && <span>Период</span>}
          </button>
          <button 
            className={`sidebar-tab ${activeSection === 'statistics' ? 'active' : ''}`}
            onClick={() => handleSectionChange('statistics')}
            title="Статистика"
          >
            <FontAwesomeIcon icon={faChartBar} />
            {!isCollapsed && <span>Статистика</span>}
          </button>
          <button 
            className={`sidebar-tab ${activeSection === 'display' ? 'active' : ''}`}
            onClick={() => handleSectionChange('display')}
            title="Настройки отображения"
          >
            <FontAwesomeIcon icon={faEye} />
            {!isCollapsed && <span>Отображение</span>}
          </button>
          <button 
            className={`sidebar-tab ${activeSection === 'settings' ? 'active' : ''}`}
            onClick={() => handleSectionChange('settings')}
            title="Настройки"
          >
            <FontAwesomeIcon icon={faCog} />
            {!isCollapsed && <span>Настройки</span>}
          </button>
        </div>
        
        <div className="sidebar-section-content">
          {activeSection === 'vehicles' && (
            <div className="vehicles-section">
              {children}
            </div>
          )}
          
          {activeSection === 'filters' && (
            <div className="filters-section">
              {!isCollapsed ? (
                <>
                  <h3 className="section-header">Фильтры</h3>
                  <div className="filter-group">
                    <h4>Тип транспорта</h4>
                    <div className="checkbox-group">
                      <label className="checkbox-label">
                        <input type="checkbox" defaultChecked />
                        <span>Легковые</span>
                      </label>
                      <label className="checkbox-label">
                        <input type="checkbox" defaultChecked />
                        <span>Грузовые</span>
                      </label>
                      <label className="checkbox-label">
                        <input type="checkbox" defaultChecked />
                        <span>Спецтехника</span>
                      </label>
                    </div>
                  </div>
                  
                  <div className="filter-group">
                    <h4>Статус</h4>
                    <div className="checkbox-group">
                      <label className="checkbox-label">
                        <input type="checkbox" defaultChecked />
                        <span>Активные</span>
                      </label>
                      <label className="checkbox-label">
                        <input type="checkbox" />
                        <span>Неактивные</span>
                      </label>
                    </div>
                  </div>
                  
                  <div className="filter-group">
                    <h4>События</h4>
                    <div className="checkbox-group">
                      <label className="checkbox-label">
                        <input type="checkbox" defaultChecked />
                        <span>Превышение скорости</span>
                      </label>
                      <label className="checkbox-label">
                        <input type="checkbox" defaultChecked />
                        <span>Стоянки</span>
                      </label>
                      <label className="checkbox-label">
                        <input type="checkbox" defaultChecked />
                        <span>Заправки</span>
                      </label>
                      <label className="checkbox-label">
                        <input type="checkbox" defaultChecked />
                        <span>Сливы топлива</span>
                      </label>
                    </div>
                  </div>
                  
                  <div className="filter-actions">
                    <button className="filter-action-btn">Применить</button>
                    <button className="filter-action-btn secondary">Сбросить</button>
                  </div>
                </>
              ) : (
                <div className="collapsed-section-hint">
                  <FontAwesomeIcon icon={faFilter} />
                </div>
              )}
            </div>
          )}
          
          {activeSection === 'dates' && (
            <div className="dates-section">
              {!isCollapsed ? (
                <>
                  <h3 className="section-header">Период отчета</h3>
                  <div className="date-filter">
                    <div className="date-period-tabs">
                      <button className="period-tab active">Сегодня</button>
                      <button className="period-tab">Вчера</button>
                      <button className="period-tab">Неделя</button>
                      <button className="period-tab">Месяц</button>
                    </div>
                    
                    <div className="date-inputs">
                      <div className="date-input-group">
                        <label>Начало:</label>
                        <input type="date" className="date-input" defaultValue={new Date().toISOString().slice(0, 10)} />
                      </div>
                      <div className="date-input-group">
                        <label>Конец:</label>
                        <input type="date" className="date-input" defaultValue={new Date().toISOString().slice(0, 10)} />
                      </div>
                    </div>
                    
                    <div className="date-filter-actions">
                      <button className="date-action-btn">Применить</button>
                      <button className="date-action-btn secondary">Сбросить</button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="collapsed-section-hint">
                  <FontAwesomeIcon icon={faCalendarAlt} />
                </div>
              )}
            </div>
          )}
          
          {activeSection === 'statistics' && (
            <div className="statistics-section">
              {!isCollapsed ? (
                <>
                  <h3 className="section-header">Статистика</h3>
                  <div className="statistic-block">
                    <div className="statistic-item">
                      <div className="statistic-label">Всего ТС:</div>
                      <div className="statistic-value">5</div>
                    </div>
                    <div className="statistic-item">
                      <div className="statistic-label">Активных:</div>
                      <div className="statistic-value">4</div>
                    </div>
                    <div className="statistic-item">
                      <div className="statistic-label">В движении:</div>
                      <div className="statistic-value">2</div>
                    </div>
                    <div className="statistic-item">
                      <div className="statistic-label">На стоянке:</div>
                      <div className="statistic-value">2</div>
                    </div>
                  </div>
                  
                  <div className="period-statistics">
                    <h4>За текущий период:</h4>
                    <div className="statistic-item">
                      <div className="statistic-label">Общий пробег:</div>
                      <div className="statistic-value">1,245 км</div>
                    </div>
                    <div className="statistic-item">
                      <div className="statistic-label">Расход топлива:</div>
                      <div className="statistic-value">178.5 л</div>
                    </div>
                    <div className="statistic-item">
                      <div className="statistic-label">Время в пути:</div>
                      <div className="statistic-value">35ч 12м</div>
                    </div>
                    <div className="statistic-item">
                      <div className="statistic-label">Ср. скорость:</div>
                      <div className="statistic-value">35.4 км/ч</div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="collapsed-section-hint">
                  <FontAwesomeIcon icon={faChartBar} />
                </div>
              )}
            </div>
          )}
          
          {activeSection === 'display' && (
            <div className="display-section">
              {!isCollapsed ? (
                <>
                  <h3 className="section-header">Настройки отображения</h3>
                  <div className="display-options">
                    <div className="display-option-group">
                      <h4>Карта</h4>
                      <div className="radio-group">
                        <label className="radio-label">
                          <input type="radio" name="map-provider" defaultChecked />
                          <span>OpenStreetMap</span>
                        </label>
                        <label className="radio-label">
                          <input type="radio" name="map-provider" />
                          <span>Google Maps</span>
                        </label>
                        <label className="radio-label">
                          <input type="radio" name="map-provider" />
                          <span>Yandex Maps</span>
                        </label>
                      </div>
                    </div>
                    
                    <div className="display-option-group">
                      <h4>Отображение трека</h4>
                      <div className="checkbox-group">
                        <label className="checkbox-label">
                          <input type="checkbox" defaultChecked />
                          <span>Цвет по скорости</span>
                        </label>
                        <label className="checkbox-label">
                          <input type="checkbox" defaultChecked />
                          <span>Показывать маркеры событий</span>
                        </label>
                        <label className="checkbox-label">
                          <input type="checkbox" defaultChecked />
                          <span>Показывать стоянки</span>
                        </label>
                      </div>
                    </div>
                    
                    <div className="display-option-group">
                      <h4>Графики</h4>
                      <div className="slider-option">
                        <label>Детализация данных:</label>
                        <input type="range" min="1" max="10" defaultValue="5" />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="collapsed-section-hint">
                  <FontAwesomeIcon icon={faEye} />
                </div>
              )}
            </div>
          )}
          
          {activeSection === 'settings' && (
            <div className="settings-section">
              {!isCollapsed ? (
                <>
                  <h3 className="section-header">Настройки</h3>
                  <div className="settings-options">
                    <div className="settings-option-group">
                      <h4>Обновление данных</h4>
                      <div className="radio-group">
                        <label className="radio-label">
                          <input type="radio" name="update-interval" defaultChecked />
                          <span>Автоматически (30 сек)</span>
                        </label>
                        <label className="radio-label">
                          <input type="radio" name="update-interval" />
                          <span>Автоматически (5 мин)</span>
                        </label>
                        <label className="radio-label">
                          <input type="radio" name="update-interval" />
                          <span>Вручную</span>
                        </label>
                      </div>
                    </div>
                    
                    <div className="settings-option-group">
                      <h4>Уведомления</h4>
                      <div className="checkbox-group">
                        <label className="checkbox-label">
                          <input type="checkbox" defaultChecked />
                          <span>Уведомления о событиях</span>
                        </label>
                        <label className="checkbox-label">
                          <input type="checkbox" defaultChecked />
                          <span>Звуковые уведомления</span>
                        </label>
                        <label className="checkbox-label">
                          <input type="checkbox" />
                          <span>Email-уведомления</span>
                        </label>
                      </div>
                    </div>
                    
                    <div className="settings-option-group">
                      <h4>Экспорт данных</h4>
                      <div className="export-options">
                        <button className="export-btn">
                          <span>Excel</span>
                        </button>
                        <button className="export-btn">
                          <span>PDF</span>
                        </button>
                        <button className="export-btn">
                          <span>CSV</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="collapsed-section-hint">
                  <FontAwesomeIcon icon={faCog} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportSidebar; 