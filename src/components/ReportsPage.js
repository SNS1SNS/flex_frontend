import React, { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCalendarAlt, faSync, faChevronLeft, faChevronRight, 
  faTruck, faUser, faMapMarkerAlt, faPlusCircle, faTimes,
  faTimesCircle, faQuestionCircle, faBell, faTh, faSignOutAlt
} from '@fortawesome/free-solid-svg-icons';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ReportSidebar from './reports/ReportSidebar';
import ReportMenu from './reports/ReportMenu';
import ReportTabs from './reports/ReportTabs';
import DateRangePicker from './reports/DateRangePicker';
import DefaultDashboard from './reports/DefaultDashboard';
import TrackMap from './reports/TrackMap';
import FuelChart from './reports/FuelChart';
import SpeedChart from './reports/SpeedChart';

import './reports/ReportStyles.css';
import { useLoading } from '../context/LoadingContext';

/**
 * Компонент страницы отчетов
 */
const ReportsPage = () => {
  const { showLoader, hideLoader } = useLoading();
  
  // Состояния для отчетов
  const [activePeriod, setActivePeriod] = useState('day');
  const [dateRange, setDateRange] = useState({
    start: new Date(),
    end: new Date()
  });
  const [showCalendar, setShowCalendar] = useState(false);
  const [statistics, setStatistics] = useState({
    vehicles: 0,
    drivers: 0,
    trips: 0,
    statuses: {
      movement: 0,
      parking: 0,
      offline: 0
    }
  });
  const [reports, setReports] = useState([]);
  const [activeReportId, setActiveReportId] = useState(null);
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  
  // Загрузка данных
  const [loading, setLoading] = useState(true);
  
  // Форматирование даты в формат дд.мм.гггг
  const formatDate = (date) => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };
  
  // Функция получения статистики
  const fetchStatistics = useCallback(async () => {
    try {
      setLoading(true);
      showLoader('Загрузка статистики...');
      
      // В реальном приложении будет запрос через apiService
      // const data = await apiService.getStatistics();
      
      // Демо-данные для примера
      const demoStats = {
        vehicles: 45,
        drivers: 38,
        trips: 124,
        statuses: {
          movement: 18,
          parking: 22,
          offline: 5
        }
      };
      
      setStatistics(demoStats);
      hideLoader();
      setLoading(false);
    } catch (error) {
      console.error('Ошибка при загрузке статистики:', error);
      toast.error('Не удалось загрузить статистику');
      hideLoader();
      setLoading(false);
    }
  }, [showLoader, hideLoader]);
  
  // Загрузка статистики при монтировании компонента
  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);
  
  // Обновление диапазона дат в зависимости от выбранного периода
  const handlePeriodChange = useCallback((period) => {
    setActivePeriod(period);
    
    const today = new Date();
    let start = new Date();
    let end = new Date();
    
    switch (period) {
      case 'day':
        // Сегодня
        start = new Date(today.setHours(0, 0, 0, 0));
        end = new Date(today.setHours(23, 59, 59, 999));
        break;
      case 'week':
        // Начало недели (понедельник)
        start = new Date(today);
        start.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
        end = new Date(today.setHours(23, 59, 59, 999));
        break;
      case 'month':
        // Начало месяца
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.setHours(23, 59, 59, 999));
        break;
      default:
        break;
    }
    
    setDateRange({ start, end });
    fetchStatistics();
  }, [fetchStatistics]);
  
  // Обновление диапазона дат при изменении периода
  useEffect(() => {
    handlePeriodChange(activePeriod);
  }, [activePeriod, handlePeriodChange]);
  
  // Генерация демо-данных о транспортных средствах
  const generateDemoVehicles = () => {
    return [
      { id: '1', name: 'Камаз 65115', imei: '356938035643809' },
      { id: '2', name: 'Газель Next', imei: '356938035643810' },
      { id: '3', name: 'Mercedes Actros', imei: '356938035643811' },
      { id: '4', name: 'МАЗ 5550', imei: '356938035643812' },
      { id: '5', name: 'Volvo FH16', imei: '356938035643813' }
    ];
  };
  
  // Обработчик для открытия отчета
  const handleOpenReport = (reportType, vehicleId = null, vehicleName = '') => {
    // Если выбрано транспортное средство из сайдбара или другим способом
    const vehicle = selectedVehicle || (vehicleId ? { 
      id: vehicleId, 
      name: vehicleName, 
      imei: `356938035643${vehicleId.toString().padStart(3, '0')}` // Генерируем демо IMEI
    } : null);
    
    const reportTypeMap = {
      'Трек': 'track',
      'Топливо': 'fuel',
      'Скорость': 'speed',
      'Журнал': 'journal',
      'Стоянки': 'parking',
      'Двигатель': 'engine',
      'Напряжение': 'voltage'
    };
    
    // Преобразуем русское название в английский код
    const reportCode = reportTypeMap[reportType] || reportType.toLowerCase();
    
    const newReport = {
      id: Date.now().toString(),
      type: reportCode,
      vehicle: vehicle,
      title: vehicle 
        ? `${reportType} - ${vehicle.name}`
        : reportType
    };
    
    // Проверяем, нет ли уже открытого такого же отчета
    const existingReportIndex = reports.findIndex(r => 
      r.type === reportCode && 
      (r.vehicle?.id === vehicle?.id || (!r.vehicle && !vehicle))
    );
    
    if (existingReportIndex !== -1) {
      // Если такой отчет уже открыт, активируем его
      setActiveReportId(reports[existingReportIndex].id);
    } else {
      // Иначе создаем новый отчет
      setReports(prev => [...prev, newReport]);
      setActiveReportId(newReport.id);
    }
    
    setShowReportMenu(false);
  };
  
  // Обработчик для закрытия отчета
  const handleCloseReport = (reportId) => {
    setReports(prev => prev.filter(report => report.id !== reportId));
    
    // Если закрыли активный отчет, устанавливаем активным последний из оставшихся
    if (reportId === activeReportId) {
      const remainingReports = reports.filter(report => report.id !== reportId);
      if (remainingReports.length > 0) {
        setActiveReportId(remainingReports[remainingReports.length - 1].id);
      } else {
        setActiveReportId(null);
      }
    }
  };
  
  // Обработчик для клика на вкладку
  const handleTabClick = (reportId) => {
    setActiveReportId(reportId);
  };
  
  // Обработчик для открытия/закрытия меню отчетов
  const toggleReportMenu = () => {
    setShowReportMenu(prev => !prev);
  };
  
  // Применение выбранного диапазона дат
  const handleApplyDateRange = (range) => {
    setDateRange(range);
    setShowCalendar(false);
    fetchStatistics();
  };
  
  // Обработчик выбора транспортного средства
  const handleSelectVehicle = (vehicle) => {
    setSelectedVehicle(vehicle);
    // Можно открыть отчет автоматически при выборе ТС
    // handleOpenReport('Трек', vehicle.id, vehicle.name);
  };
  
  // Отображение содержимого отчета
  const renderReportContent = (report) => {
    switch (report.type) {
      case 'track':
        return (
          <TrackMap 
            tabId={report.id}
            vehicle={report.vehicle}
            startDate={dateRange.start}
            endDate={dateRange.end}
          />
        );
      case 'fuel':
        return (
          <FuelChart 
            vehicle={report.vehicle}
            startDate={dateRange.start}
            endDate={dateRange.end}
          />
        );
      case 'speed':
        return (
          <SpeedChart 
            vehicle={report.vehicle}
            startDate={dateRange.start}
            endDate={dateRange.end}
          />
        );
      default:
        return (
          <div className="report-content-placeholder">
            <div className="placeholder-icon">
              <FontAwesomeIcon icon={faQuestionCircle} />
            </div>
            <div className="placeholder-text">
              Отчет типа "{report.type}" находится в разработке
            </div>
          </div>
        );
    }
  };
  
  return (
    <div className="reports-page">
      {/* Боковая панель с меню и фильтрами */}
      <div className="reports-content">
        <ReportSidebar 
          statistics={statistics}
          activePeriod={activePeriod}
          onPeriodChange={handlePeriodChange}
          dateRange={dateRange}
          formatDate={formatDate}
          onCalendarClick={() => setShowCalendar(true)}
          onSelectVehicle={handleSelectVehicle}
          vehicles={generateDemoVehicles()}
        />
        
        {/* Основной контент */}
        <div className="reports-main">
          <div className="reports-toolbar">
            {/* Кнопка добавления отчетов */}
            <button className="btn-add-report" onClick={toggleReportMenu}>
              + Добавить отчет
            </button>
          </div>
          
          {/* Вкладки отчетов */}
          <ReportTabs 
            reports={reports}
            activeTabId={activeReportId}
            onTabClick={handleTabClick}
            onTabClose={handleCloseReport}
          />
          
          {/* Контейнер отчетов */}
          <div className="report-content-container">
            {activeReportId === null ? (
              <DefaultDashboard onOpenReport={(reportId) => handleOpenReport(reportId)} />
            ) : (
              reports
                .filter(report => report.id === activeReportId)
                .map(report => (
                  <div key={report.id} className="report-content active">
                    {renderReportContent(report)}
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
      
      {/* Меню выбора отчетов */}
      {showReportMenu && (
        <ReportMenu onReportSelect={(reportType) => handleOpenReport(reportType)} />
      )}
      
      {/* Модальное окно выбора диапазона дат */}
      {showCalendar && (
        <DateRangePicker 
          dateRange={dateRange}
          onApply={handleApplyDateRange}
          onCancel={() => setShowCalendar(false)}
        />
      )}
      
      {/* Контейнер для уведомлений */}
      <ToastContainer position="bottom-right" />
    </div>
  );
};

export default ReportsPage; 