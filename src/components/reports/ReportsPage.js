import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCalendarAlt, faTruck, faUser, faMapMarkerAlt, faPlus, 
  faTh, faBell, faQuestionCircle, faChartBar, faChartLine, 
  faChartArea, faRoad, faTachometerAlt, faGasPump, faClipboardList, 
  faCalendarDay, faClipboardCheck, faExclamationTriangle,
  faShieldAlt, faFileAlt, faCarAlt, faRoute, faMapMarked,
  faSearch, faAngleLeft, faAngleRight, faRightFromBracket,
  faQuestion, faInfo
} from '@fortawesome/free-solid-svg-icons';
import TrackMap from './TrackMap';
import FolderList from '../folders/FolderList';
import './ReportStyles.css';
import logo from '../../images/logo.svg';
import fuel from '../../images/fuel.png';
import track from '../../images/road.png';
import track2 from '../../images/tracks.png';
import ChartDebugPanel from './ChartDebugPanel'; 


const LiveTrack = ({ vehicle, startDate, endDate }) => (
  <div className="component-placeholder">
    <h3>Компонент LiveTrack находится в разработке</h3>
    <p>Выбрано ТС: {vehicle?.name || 'Не выбрано'}</p>
    <p>Период: {startDate?.toLocaleDateString()} - {endDate?.toLocaleDateString()}</p>
  </div>
);


import SpeedChart from './SpeedChart';
import FuelChart from './FuelChart';
import VoltageChart from './VoltageChart';
import EngineChart from './EngineChart';


import '../../utils/SplitScreen.css';
import ReportSelector from './ReportSelector';

const ReportsPage = () => {
  const [dateRange, setDateRange] = useState(() => {
    
    try {
      const savedRange = localStorage.getItem('lastDateRange');
      if (savedRange) {
        const parsed = JSON.parse(savedRange);
        
        return {
          startDate: parsed.startDate ? new Date(parsed.startDate) : new Date(),
          endDate: parsed.endDate ? new Date(parsed.endDate) : new Date()
        };
      }
    } catch (e) {
      console.warn('Ошибка при чтении диапазона дат из localStorage:', e);
    }
    
    
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 1);
    return { startDate: start, endDate: end };
  });
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [stats, setStats] = useState({ vehicles: 0, drivers: 0, trips: 0 });
  const [openTabs, setOpenTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showReportMenu, setShowReportMenu] = useState(false);

  
  const [previewReport, setPreviewReport] = useState({
    title: 'Выберите отчет',
    description: 'Наведите курсор на интересующий вас отчет, чтобы увидеть его описание.',
    image: ''
  });

  
  
  const datePickerRef = useRef(null);
  const reportMenuRef = useRef(null);

  
  const [isCompactMode, setIsCompactMode] = useState(false);
  
  
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  
  
  const profileMenuRef = useRef(null);

  
  const [splitMode, setSplitMode] = useState(() => {
    const savedMode = localStorage.getItem('splitScreenMode');
    return savedMode || 'single';  
  });

  
  const [showDateModal, setShowDateModal] = useState(false);
  const [tempStartDate, setTempStartDate] = useState('');
  const [tempEndDate, setTempEndDate] = useState('');

  
  const [splitScreenActive, setSplitScreenActive] = useState(false);
  
  
  const reportsContainerRef = useRef(null);

  
  useEffect(() => {
    // Обработчик события создания отчета
    const handleCreateReport = (event) => {
      const { reportType, container, vehicle, startDate, endDate } = event.detail;
      
      // Создаем отчет для указанного контейнера
      createReportForContainer(reportType, container, vehicle, startDate, endDate);
    };
    
    // Подписываемся на событие
    document.addEventListener('createReport', handleCreateReport);
    
    // Отписываемся при размонтировании
    return () => {
      document.removeEventListener('createReport', handleCreateReport);
    };
  }, []);

  
  useEffect(() => {
    const handleBeforeUnload = () => {
      console.log('ReportsPage: Обработка события beforeunload');
      
      
      const reportChoosers = document.querySelectorAll('.report-chooser-overlay');
      reportChoosers.forEach(element => {
        try {
          if (element.parentNode) {
            element.parentNode.removeChild(element);
          }
        } catch (e) {
          console.error('Ошибка при удалении модального окна перед выгрузкой:', e);
        }
      });
      
      
      const modalRoot = document.getElementById('modal-root');
      if (modalRoot) {
        while (modalRoot.firstChild) {
          modalRoot.removeChild(modalRoot.firstChild);
        }
      }
    };
    
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleBeforeUnload(); 
    };
  }, []);

  
  const formatDate = (date) => {
    if (!date) return '';
    
    
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    
    if (!(dateObj instanceof Date) || isNaN(dateObj)) {
      console.warn('Невалидная дата для форматирования:', date);
      return '';
    }
    
    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${day}.${month}.${year}`;
  };

  
  const calculateDateRange = (baseDate, periodType) => {
    const currentDate = baseDate || new Date();
    const startDate = new Date(currentDate);
    const endDate = new Date(currentDate);

    if (periodType === 'day') {
      startDate.setDate(startDate.getDate() -1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (periodType === 'week') {
      endDate.setDate(startDate.getDate());
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
    } else if (periodType === 'month') {
      endDate.setDate(startDate.getDate());
      startDate.setDate(startDate.getDate() - 31);
      startDate.setHours(0, 0, 0, 0);
    }

    return { startDate, endDate };
  };

  
  useEffect(() => {
    const savedPeriod = localStorage.getItem('currentPeriodType') || 'day';
    setSelectedPeriod(savedPeriod);
    const { startDate, endDate } = calculateDateRange(new Date(), savedPeriod);
    setDateRange({ startDate, endDate });
    
    
    fetchStatistics();
  }, []);

  
  const handleCalendarClick = () => {
    
    const startDate = dateRange.startDate instanceof Date 
      ? dateRange.startDate.toISOString().split('T')[0] 
      : (typeof dateRange.startDate === 'string' ? dateRange.startDate : '');
      
    const endDate = dateRange.endDate instanceof Date 
      ? dateRange.endDate.toISOString().split('T')[0] 
      : (typeof dateRange.endDate === 'string' ? dateRange.endDate : '');
    
    setTempStartDate(startDate);
    setTempEndDate(endDate);
    
    setShowDateModal(true);
  };

  
  const closeDateModal = () => {
    setShowDateModal(false);
  };

  
  const handleStartDateChange = (e) => {
    setTempStartDate(e.target.value);
  };

  
  const handleEndDateChange = (e) => {
    setTempEndDate(e.target.value);
  };

  
  const applyDateRange = () => {
    
    const startDate = new Date(tempStartDate);
    const endDate = new Date(tempEndDate);
    
    
    startDate.setHours(0, 0, 0, 0);
    
    
    setDateRange({
      startDate,
      endDate
    });
    
    
    window.lastDateUpdateTime = new Date().getTime();
    
    
    try {
      localStorage.setItem('lastDateRange', JSON.stringify({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        updateTimestamp: window.lastDateUpdateTime
      }));
      
      console.log('Сохранены даты в localStorage (ручной выбор):', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
    } catch (error) {
      console.warn('Ошибка при сохранении дат в localStorage:', error);
    }
    
    
    setShowDateModal(false);
    
    
    const dateEvent = new CustomEvent('dateRangeChanged', {
      detail: {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        forceUpdate: true,
        timestamp: window.lastDateUpdateTime
      }
    });
    document.dispatchEvent(dateEvent);
    
    
    const forceUpdateEvent = new CustomEvent('forceVehicleUpdate', {
      detail: { 
        vehicle: selectedVehicle,
        startDate: startDate,
        endDate: endDate,
        timestamp: window.lastDateUpdateTime
      }
    });
    document.dispatchEvent(forceUpdateEvent);
    
    
    if (openTabs.length > 0) {
      setOpenTabs(prevTabs => prevTabs.map(tab => ({
        ...tab,
        startDate: startDate,
        endDate: endDate
      })));
    }
    
    
    fetchStatistics();
  };

  
  const handlePeriodChange = (period) => {
    setSelectedPeriod(period);
    localStorage.setItem('currentPeriodType', period);
    
    const { startDate, endDate } = calculateDateRange(new Date(), period);
    
    
    startDate.setHours(0, 0, 0, 0);
    
    setDateRange({ startDate, endDate });
    
    
    window.lastDateUpdateTime = new Date().getTime();
    
    
    try {
      localStorage.setItem('lastDateRange', JSON.stringify({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        periodType: period,
        updateTimestamp: window.lastDateUpdateTime
      }));
      
      console.log('Сохранены даты в localStorage:', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        periodType: period
      });
    } catch (error) {
      console.warn('Ошибка при сохранении дат в localStorage:', error);
    }
    
    
    const event = new CustomEvent('dateRangeChanged', {
      detail: {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        periodType: period,
        forceUpdate: true,
        timestamp: window.lastDateUpdateTime
      }
    });
    document.dispatchEvent(event);
    
    
    const forceUpdateEvent = new CustomEvent('forceVehicleUpdate', {
      detail: { 
        vehicle: selectedVehicle,
        startDate: startDate,
        endDate: endDate,
        timestamp: window.lastDateUpdateTime
      }
    });
    document.dispatchEvent(forceUpdateEvent);
    
    
    if (openTabs.length > 0) {
      setOpenTabs(prevTabs => prevTabs.map(tab => ({
        ...tab,
        startDate: startDate,
        endDate: endDate
      })));
    }
  };

  
  const fetchStatistics = async () => {
    try {
      
      const getJwtToken = () => {
        
        const possibleTokenKeys = ['authToken', 'token', 'jwt', 'access_token'];
        
        for (const key of possibleTokenKeys) {
          const token = localStorage.getItem(key);
          if (token) {
            
            if (token.split('.').length === 3) {
              return token;
            }
          }
        }
        
        
        const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
        const payload = btoa(JSON.stringify({ 
          sub: 'test-user', 
          name: 'Test User', 
          role: 'ADMIN',
          exp: Math.floor(Date.now() / 1000) + 3600 
        }));
        const signature = btoa('test-signature');
        
        return `${header}.${payload}.${signature}`;
      };
      
      const token = getJwtToken();
      
      
      console.log('Попытка загрузки статистики:');
      console.log('URL:', '/admin/statistics');
      
      
      const tokenParts = token.split('.');
      const tokenForLog = tokenParts.length === 3 
                        ? `${tokenParts[0].substring(0, 10)}...` 
                        : token;
      console.log('Заголовки:', {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${tokenForLog}`
      });
      
    } catch (error) {
      console.error('Ошибка при загрузке статистики:', error);
      
      setStats({ vehicles: 0, drivers: 0, trips: 0 });
    }
  };

  
  const handleAddReportClick = () => {
    setShowReportMenu(!showReportMenu);
  };

  
  const handleReportSelect = (reportType) => {
    if (!selectedVehicle) {
      alert('Пожалуйста, выберите транспортное средство для создания отчета');
      return;
    }
    
    
    const tabId = `tab-${Date.now()}`;
    
    
    const newTab = {
      id: tabId,
      type: reportType,
      vehicle: selectedVehicle,
      title: getReportTitle(reportType),
      
      startDate: dateRange.startDate,
      endDate: dateRange.endDate
    };
    
    console.log('Создание отчета:', {
      type: reportType,
      vehicle: selectedVehicle,
      startDate: dateRange.startDate ? dateRange.startDate.toISOString() : 'не указана',
      endDate: dateRange.endDate ? dateRange.endDate.toISOString() : 'не указана'
    });
    
    
    setOpenTabs(prevTabs => [...prevTabs, newTab]);
    setActiveTabId(tabId);
    setShowReportMenu(false);
  };

  
  const getReportTitle = (reportType) => {
    switch (reportType) {
      case 'track': return 'Трек';
      case 'live-track': return 'Местоположение';
      case 'speed': return 'Скорость';
      case 'fuel': return 'Объем топлива';
      case 'voltage': return 'Напряжение';
      case 'rpm': return 'Обороты двигателя';
      default: return 'Отчет';
    }
  };

  
  const getReportIcon = (reportType) => {
    switch (reportType) {
      case 'safedrive-details': return faExclamationTriangle;
      case 'safedrive-rating': return faShieldAlt;
      case 'fuel-sheet': return faClipboardList;
      case 'fuel-delivery': return faGasPump;
      case 'fuel-operations': return faGasPump;
      case 'routes': return faRoad;
      case 'movement': return faCarAlt;
      case 'journal': return faFileAlt;
      case 'fuel-events': return faGasPump;
      case 'location': return faMapMarkerAlt;
      case 'track': return faMapMarkerAlt;
      case 'live-track': return faMapMarkerAlt;
      case 'tire-pressure': return faTachometerAlt;
      case 'movement-period': return faChartBar;
      case 'load-period': return faChartLine;
      case 'work-period': return faCalendarDay;
      case 'fuel': return faGasPump;
      case 'speed': return faTachometerAlt;
      case 'voltage': return faChartLine;
      case 'engine': return faChartArea;
      case 'manager-dashboard': return faClipboardCheck;
      case 'track-movement': return faRoad;
      case 'track-violations': return faExclamationTriangle;
      case 'track-fuel': return faGasPump;
      case 'rpm': return faChartArea;
      default: return faFileAlt;
    }
  };

  
  const handleCloseTab = (tabId, e) => {
    e.stopPropagation();
    
    setOpenTabs(prevTabs => {
      const filteredTabs = prevTabs.filter(tab => tab.id !== tabId);
      
      
      if (activeTabId === tabId && filteredTabs.length > 0) {
        setActiveTabId(filteredTabs[filteredTabs.length - 1].id);
      } else if (filteredTabs.length === 0) {
        setActiveTabId(null);
      }
      
      return filteredTabs;
    });
  };

  
  const handleTabChange = (tabId) => {
    setActiveTabId(tabId);
  };

  
  const handleVehicleSelect = (vehicle) => {
    
    if (selectedVehicle && vehicle && selectedVehicle.id === vehicle.id) {
      console.log('Выбрано то же самое ТС, игнорируем:', vehicle?.name);
      return;
    }

    setSelectedVehicle(vehicle);
    console.log('Выбрано транспортное средство:', vehicle);

    
    window.lastSelectedVehicleId = vehicle?.id;
    window.lastVehicleUpdateTime = new Date().getTime();

    
    
    const forceUpdateEvent = new CustomEvent('forceVehicleUpdate', {
      detail: { 
        vehicle: vehicle,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        timestamp: window.lastVehicleUpdateTime
      }
    });

    
    document.dispatchEvent(forceUpdateEvent);

    
    if (vehicle && openTabs.length > 0) {
      setOpenTabs(prevTabs => prevTabs.map(tab => ({
        ...tab,
        vehicle: vehicle
      })));
    }
  };

  
  const renderActiveTabContent = () => {
    const activeTab = openTabs.find(tab => tab.id === activeTabId);
    
    if (!activeTab) {
      return (
        <div className="default-dashboard active">
          <div className="dashboard-sections">
            <div className="dashboard-section">
              <h2>Популярные:</h2>
              <div className="dashboard-cards">
                <div className="dashboard-card" onClick={() => handleReportSelect('track')}>
                  <div className="card-title">Трек</div>
                  <div className="card-content">
                    <img src={track2} alt="Трек" />
                  </div>
                </div>
                <div className="dashboard-card" onClick={() => handleReportSelect('live-track')}>
                  <div className="card-title">Местоположение</div>
                  <div className="card-content">
                    <img src={track} alt="Местоположение" />
                  </div>
                </div>
                <div className="dashboard-card" onClick={() => handleReportSelect('speed')}>
                  <div className="card-title">Статистика</div>
                  <div className="card-content">
                    <img src={track} alt="Статистика" />
                  </div>
                </div>
                <div className="dashboard-card" onClick={() => handleReportSelect('fuel')}>
                  <div className="card-title">Заправки и сливы</div>
                  <div className="card-content">
                    <img src={fuel} alt="Заправки и сливы" />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="dashboard-section">
              <h2>Рабочие столы:</h2>
              <div className="dashboard-cards">
                <div className="dashboard-card">
                  <div className="card-title">Рабочий стол Руководителя</div>
                  <div className="card-content">
                    <img src={track} alt="Рабочий стол Руководителя" />
                  </div>
                </div>
                <div className="dashboard-card">
                  <div className="card-title">Трек + Объём топлива</div>
                  <div className="card-content">
                    <img src={track} alt="Трек + Объём топлива" />
                  </div>
                </div>
                <div className="dashboard-card">
                  <div className="card-title">Трек + Скорость</div>
                  <div className="card-content">
                    <img src={track} alt="Трек + Скорость" />
                  </div>
                </div>
                <div className="dashboard-card">
                  <div className="card-title">Трек + Статистика</div>
                  <div className="card-content">
                      <img src={track} alt="Трек + Статистика" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    
    const tabStartDate = activeTab.startDate || dateRange.startDate;
    const tabEndDate = activeTab.endDate || dateRange.endDate;
    
    
    console.log('Отображение отчета (одно сообщение):', {
      type: activeTab.type,
      vehicle: activeTab.vehicle,
      startDate: tabStartDate ? tabStartDate.toISOString() : 'не указана',
      endDate: tabEndDate ? tabEndDate.toISOString() : 'не указана'
    });
    
    
    const forceUpdateEvent = new CustomEvent('forceVehicleUpdate', {
      detail: { 
        vehicle: activeTab.vehicle,
        startDate: tabStartDate,
        endDate: tabEndDate,
        timestamp: new Date().getTime() 
      }
    });
    
    
    setTimeout(() => document.dispatchEvent(forceUpdateEvent), 50);
    
    
    switch (activeTab.type) {
      case 'track':
        return (
          <TrackMap 
            key={`track-${activeTab.id}-${activeTab.vehicle?.id || 'no-vehicle'}-${Date.now()}`}
            tabId={activeTab.id} 
            vehicle={activeTab.vehicle} 
            startDate={tabStartDate} 
            endDate={tabEndDate}
            hidePeriodSelector={true}
          />
        );
      case 'live-track':
        return (
          <LiveTrack
            vehicle={activeTab.vehicle}
            startDate={tabStartDate}
            endDate={tabEndDate}
          />
        );
      case 'speed':
        return (
          <SpeedChart 
            vehicle={activeTab.vehicle} 
            startDate={tabStartDate} 
            endDate={tabEndDate}
          />
        );
      case 'fuel':
        return (
          <FuelChart 
            vehicle={activeTab.vehicle} 
            startDate={tabStartDate} 
            endDate={tabEndDate}
          />
        );
      case 'voltage':
        return (
          <VoltageChart 
            vehicle={activeTab.vehicle} 
            startDate={tabStartDate} 
            endDate={tabEndDate}
          />
        );
      case 'rpm':
        return (
          <EngineChart
            vehicle={activeTab.vehicle}
            startDate={tabStartDate}
            endDate={tabEndDate}
          />
        );
      default:
        return (
          <div className="report-placeholder">
            <h3>Отчет в разработке</h3>
            <p>Выбранный тип отчета скоро будет доступен</p>
          </div>
        );
    }
  };

  
  const closeReportMenu = () => {
    setShowReportMenu(false);
  };

  
  useEffect(() => {
    
    const reportMenuPopup = reportMenuRef.current;
    const addReportBtn = document.querySelector('.add-report-btn');
    
    if (showReportMenu && reportMenuPopup && addReportBtn) {
      
      let timeoutId = null;
      
      const handleMouseEnter = () => {
        clearTimeout(timeoutId);
      };
      
      const handleMouseLeave = () => {
        timeoutId = setTimeout(() => {
          closeReportMenu();
        }, 300); 
      };
      
      
      reportMenuPopup.addEventListener('mouseenter', handleMouseEnter);
      reportMenuPopup.addEventListener('mouseleave', handleMouseLeave);
      addReportBtn.addEventListener('mouseenter', handleMouseEnter);
      addReportBtn.addEventListener('mouseleave', handleMouseLeave);
      
      
      return () => {
        reportMenuPopup.removeEventListener('mouseenter', handleMouseEnter);
        reportMenuPopup.removeEventListener('mouseleave', handleMouseLeave);
        addReportBtn.removeEventListener('mouseenter', handleMouseEnter);
        addReportBtn.removeEventListener('mouseleave', handleMouseLeave);
      };
    }
  }, [showReportMenu]);

  
  const getReportDescription = (reportType) => {
    switch (reportType) {
      case 'safedrive-details': 
        return 'Детальный отчет о нарушениях SafeDrive с указанием даты, времени, местоположения и типа нарушения.';
      case 'track': 
        return 'Визуализация маршрута движения транспортного средства на карте с отметками остановок и событий.';
      case 'live-track': 
        return 'Отслеживание транспортного средства в реальном времени с обновлением положения и телеметрических данных.';
      case 'fuel': 
        return 'График изменения уровня топлива с отметками заправок, сливов и расхода.';
      case 'speed': 
        return 'График скорости движения транспорта с выделением нарушений скоростного режима.';
      case 'voltage': 
        return 'График изменения напряжения бортовой сети транспортного средства.';
      case 'rpm': 
        return 'График оборотов двигателя транспортного средства с анализом нагрузки.';
      default: 
        return 'Выберите отчет для просмотра подробной информации и начала работы.';
    }
  };

  
  const getReportImagePath = (reportType) => {
    
    switch (reportType) {
      case 'track': return 'linear-gradient(135deg, #4e73df 0%, #224abe 100%)';
      case 'live-track': return 'linear-gradient(135deg, #36b9cc 0%, #1a8997 100%)';
      case 'fuel': return 'linear-gradient(135deg, #1cc88a 0%, #13855c 100%)';
      case 'speed': return 'linear-gradient(135deg, #f6c23e 0%, #dda20a 100%)';
      case 'safedrive-details': return 'linear-gradient(135deg, #e74a3b 0%, #be2617 100%)';
      case 'voltage': return 'linear-gradient(135deg, #54b4d3 0%, #2696b8 100%)';
      case 'rpm': return 'linear-gradient(135deg, #9d4edd 0%, #7b2cbf 100%)';
      default: return 'linear-gradient(135deg, #858796 0%, #60616f 100%)';
    }
  };

  
  const handleReportHover = (reportType) => {
    setPreviewReport({
      title: getReportTitle(reportType),
      description: getReportDescription(reportType),
      image: getReportImagePath(reportType)
    });
  };

  
  const renderReportItem = (reportType, Icon, label) => (
    <li 
      onClick={() => handleReportSelect(reportType)}
      onMouseEnter={() => handleReportHover(reportType)}
    >
      <FontAwesomeIcon icon={Icon} />
      <span>{label}</span>
    </li>
  );

  
  const toggleCompactMode = () => {
    setIsCompactMode(!isCompactMode);
  };

  
  const toggleProfileMenu = (e) => {
    e.stopPropagation();
    setProfileMenuOpen(!profileMenuOpen);
  };

  
  const handleClickOutside = (event) => {
    if (
      profileMenuRef.current && 
      !profileMenuRef.current.contains(event.target) &&
      !event.target.closest('.sidebar-header')
    ) {
      setProfileMenuOpen(false);
    }
  };

  
  const handleLogout = () => {
    
    window.location.href = '/login';
  };

  
  useEffect(() => {
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  
  useEffect(() => {
    const createPulseEffect = (element) => {
      
      const existingEffects = element.querySelectorAll('.pulse-effect');
      existingEffects.forEach(effect => effect.remove());

      
      const pulseEffect = document.createElement('div');
      pulseEffect.className = 'pulse-effect';
      element.appendChild(pulseEffect);

      
      setTimeout(() => {
        pulseEffect.remove();
      }, 500);
    };

    
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', function() {
        createPulseEffect(this);
      });
    });

    return () => {
      
      navItems.forEach(item => {
        item.removeEventListener('click', () => {});
      });
    };
  }, []);

  
  useEffect(() => {
    try {
      localStorage.setItem('lastDateRange', JSON.stringify({
        startDate: dateRange.startDate ? dateRange.startDate.toISOString() : null,
        endDate: dateRange.endDate ? dateRange.endDate.toISOString() : null
      }));
    } catch (e) {
      console.warn('Не удалось сохранить диапазон дат в localStorage:', e);
    }
  }, [dateRange]);
  
  
  useEffect(() => {
    localStorage.setItem('splitScreenMode', splitMode);
  }, [splitMode]);

  
  const renderReactComponent = (componentType, container, props) => {
    if (!container) return;
    
    try {
      const root = ReactDOM.createRoot(container);
      
      
      switch (componentType) {
        case 'ReportSelector':
          root.render(<ReportSelector 
            selectedVehicle={selectedVehicle} 
            onSelectReport={props.onSelectReport}
            onCancel={props.onCancel}
          />);
          break;
        
        default:
          console.warn('Неизвестный тип компонента:', componentType);
      }
    } catch (error) {
      console.error('Ошибка при рендеринге React компонента:', error);
      container.innerHTML = `<div class="error-message">Ошибка при рендеринге: ${error.message}</div>`;
    }
  };
  
  
  
  const createReportForContainer = (reportType, containerId, vehicleObj, startDateObj, endDateObj) => {
    console.log('Создание отчета:', {
      reportType,
      containerId,
      vehicle: vehicleObj ? vehicleObj.name : 'не указано',
      startDate: startDateObj,
      endDate: endDateObj
    });
    
    // Находим контейнер
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Контейнер с ID ${containerId} не найден`);
      return;
    }
    
    // Очищаем контейнер перед добавлением нового отчета
    if (container.firstChild) {
      try {
        container.innerHTML = '';
      } catch (e) {
        console.error('Ошибка при очистке контейнера:', e);
      }
    }
    
    // Создаем элемент для отчета
    try {
      // Создаем новый корень React
      const root = ReactDOM.createRoot(container);
      
      // Получаем компонент для отчета
      const reportElement = getReportElement(reportType, vehicleObj, startDateObj, endDateObj);
      
      // Рендерим компонент в контейнер
      if (reportElement) {
        root.render(reportElement);
        console.log(`Отчет типа ${reportType} создан в контейнере ${containerId}`);
      } else {
        console.error(`Неизвестный тип отчета: ${reportType}`);
        container.innerHTML = `<div class="error-message">Неизвестный тип отчета: ${reportType}</div>`;
      }
    } catch (error) {
      console.error(`Неожиданная ошибка при обработке контейнера ${containerId}:`, error);
    }
  };
  
  
  const reactRoots = useRef(new Map()).current;
  
  
  useEffect(() => {
    return () => {
      
      console.log('ReportsPage: Очистка всех React-корней при размонтировании');
      
      reactRoots.forEach((root, id) => {
        try {
          console.log(`ReportsPage: Размонтирование React-корня для контейнера ${id}`);
          
          root.render(null);
        } catch (e) {
          console.error(`Ошибка при очистке React-корня для контейнера ${id}:`, e);
        }
      });
      
      
      reactRoots.clear();
    };
  }, [reactRoots]);
  
  
  const safelyRemoveReactRoot = (containerId) => {
    const root = reactRoots.get(containerId);
    if (root) {
      try {
        console.log(`ReportsPage: Безопасное удаление React-корня для контейнера ${containerId}`);
        
        root.render(null);
        
        reactRoots.delete(containerId);
        return true;
      } catch (e) {
        console.error(`Ошибка при удалении React-корня для контейнера ${containerId}:`, e);
        return false;
      }
    }
    return false;
  };
  
  
  const renderReportToContainer = (container, reportType, vehicle, startDate, endDate) => {
    if (!container) {
      console.error('ReportsPage: Невозможно отрендерить отчет - контейнер не найден');
      return;
    }
    
    console.log(`ReportsPage: Начинаем рендеринг отчета типа ${reportType} в контейнер ${container.id || 'без ID'}`);
    
    
    if (!container.id) {
      container.id = `chart-container-${Math.random().toString(36).substring(2, 11)}`;
      console.log(`ReportsPage: Присвоен новый ID контейнеру: ${container.id}`);
    }
    
    
    if (reactRoots.has(container.id)) {
      const existingRoot = reactRoots.get(container.id);
      try {
        console.log(`ReportsPage: Удаление существующего React-корня для ${container.id}`);
        existingRoot.render(null); 
        
        
        setTimeout(() => {
          reactRoots.delete(container.id); 
          console.log(`ReportsPage: React-корень для ${container.id} удален из Map`);
        }, 50);
      } catch (e) {
        console.error(`Ошибка при удалении существующего React-корня:`, e);
      }
    }
    
    
    setTimeout(() => {
      try {
        
        if (!document.body.contains(container)) {
          console.error(`ReportsPage: Контейнер ${container.id} больше не присутствует в DOM`);
          return;
        }
        
        
        container.setAttribute('data-react-managed', 'true');
        
        
        const reportElement = getReportElement(reportType, vehicle, startDate, endDate);
        
        if (!reportElement) {
          console.error(`ReportsPage: Не удалось создать элемент отчета типа ${reportType}`);
          container.innerHTML = `
            <div style="padding: 20px; color: #721c24; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px;">
              <h3>Ошибка при создании отчета</h3>
              <p>Не удалось создать элемент отчета типа ${reportType}</p>
            </div>
          `;
          return;
        }
        
        
        console.log(`ReportsPage: Создание нового React-корня для контейнера ${container.id}`);
        try {
          const root = ReactDOM.createRoot(container);
          
          
          reactRoots.set(container.id, root);
          
          
          root.render(reportElement);
          
          console.log(`Отчет типа ${reportType} успешно создан в контейнере ${container.id}`);
        } catch (error) {
          console.error(`Ошибка при рендеринге отчета в контейнер ${container.id}:`, error);
          
          
          try {
            
            while (container.firstChild) {
              container.removeChild(container.firstChild);
            }
            
            
            const errorDiv = document.createElement('div');
            errorDiv.innerHTML = `
              <div style="padding: 20px; color: #721c24; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px;">
                <h3>Ошибка при создании отчета</h3>
                <p>${error.message}</p>
                <p>Пожалуйста, попробуйте создать отчет заново или обновите страницу.</p>
              </div>
            `;
            container.appendChild(errorDiv);
          } catch (renderError) {
            console.error(`Не удалось отрендерить сообщение об ошибке:`, renderError);
          }
        }
      } catch (error) {
        console.error(`Неожиданная ошибка при обработке контейнера ${container.id}:`, error);
      }
    }, 100); 
  };
  
  
  const handleSplitModeChange = (mode) => {
    console.log('Изменение режима разделения экрана на:', mode);
    setSplitMode(mode);
  };

  useEffect(() => {
    if (splitMode !== 'single' && !splitScreenActive) {
      handleSplitModeChange(splitMode);
    }
  }, [splitMode, splitScreenActive]);

  const handleDateChange = (start, end) => {
    if (start instanceof Date) {
      start.setHours(0, 0, 0, 0);
    }
    
    setDateRange({
      startDate: start,
      endDate: end
    });
    
    try {
      if (start instanceof Date && end instanceof Date) {
        localStorage.setItem('lastDateRange', JSON.stringify({
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          updateTimestamp: new Date().getTime()
        }));
        
        console.log('Сохранены даты в localStorage (handleDateChange):', {
          startDate: start.toISOString(),
          endDate: end.toISOString()
        });
      }
    } catch (error) {
      console.warn('Ошибка при сохранении дат в localStorage:', error);
    }
    
    if (openTabs.length > 0) {
      setOpenTabs(prevTabs => prevTabs.map(tab => ({
        ...tab,
        startDate: start,
        endDate: end
      })));
      
      console.log('Обновлен диапазон дат для всех отчетов:', {
        startDate: start ? start.toISOString() : 'не указана',
        endDate: end ? end.toISOString() : 'не указана'
      });
    }
  };

  const getReportElement = (reportType, vehicle, startDate, endDate) => {
    const reportProps = {
      key: `split-${reportType}-${vehicle?.id || 'no-vehicle'}-${Date.now()}`,
      vehicle: vehicle,
      startDate: startDate,
      endDate: endDate,
      hidePeriodSelector: true
    };
    
    switch (reportType) {
      case 'track':
        return <TrackMap {...reportProps} />;
      case 'live-track':
        return <LiveTrack {...reportProps} />;
      case 'speed':
        return <SpeedChart {...reportProps} />;
      case 'fuel':
        return <FuelChart {...reportProps} />;
      case 'voltage':
        return <VoltageChart {...reportProps} />;
      case 'rpm':
        return <EngineChart {...reportProps} />;
      default:
        return null;
    }
  };

  useEffect(() => {
    if (selectedVehicle || dateRange.startDate || dateRange.endDate) {
      console.log('ReportsPage: Ключевые параметры изменились, обновляем React-корни');
      
      openTabs.forEach(tab => {
        const containerId = tab.id;
        if (containerId) {
          if (safelyRemoveReactRoot(containerId)) {
            console.log(`ReportsPage: Удален React-корень для вкладки ${tab.title} (${containerId})`);
          }
        }
      });
    }
  }, [selectedVehicle, dateRange, openTabs, safelyRemoveReactRoot]);

  return (
    <div className={`reports-page ${isCompactMode ? 'compact-mode' : ''}`}>
      <div className={`sidebar ${isCompactMode ? 'compact-mode' : ''}`}>
        <div 
                className="sidebar-header" 
                id="sidebarHeader" 
                onClick={toggleProfileMenu}
            >
                <img 
                  src = {logo} 
                  alt="Контроль Техники" 
                  className="logo-image" 
                />
                <h1 className="logo-text">Контроль Техники</h1>
            </div>

        {profileMenuOpen && (
          <div 
          className={`profile-menu ${profileMenuOpen ? 'active' : 'hidden'}`} 
          id="profileMenu" 
          ref={profileMenuRef}
      >
          
          <ul>
              <li className="profile-item">
                  <FontAwesomeIcon icon={faUser} className="profile-icon" />
                  <a href="#" className='profile-text'>ТОО Контроль Техники</a>
              </li>

              <li className="menu-item">
                  <FontAwesomeIcon icon={faFileAlt} className="menu-icon" />
                  <a href="/vehicles">Администрирование</a>
              </li>
              
              <li className="menu-item">
                  <FontAwesomeIcon icon={faQuestion} className="menu-icon" />
                  <a href="#">Руководство пользователя</a>
              </li>
              
              <li className="menu-item">
                  <FontAwesomeIcon icon={faInfo} className="menu-icon" />
                  <a href="#">О программе</a>
              </li>
              
              <li className="menu-item" onClick={handleLogout}>
                  <FontAwesomeIcon icon={faRightFromBracket} className="menu-icon" />
                  <a href="#" id="logout-link">Выход</a>
              </li>
          </ul>
      </div>
        )}

        <div className="sidebar-date-section">
          <div className="date-display">
            <div className="date-label">Период:</div>
            <div className="date-value" onClick={handleCalendarClick}>
              {dateRange.startDate && dateRange.endDate && 
                `${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)}`}
              <FontAwesomeIcon icon={faCalendarAlt} style={{ marginLeft: '8px' }} />
            </div>
          </div>
          
          <div className="period-tabs">
            <div 
              className={`period-tab ${selectedPeriod === 'day' ? 'active' : ''}`}
              onClick={() => handlePeriodChange('day')}
            >
              День
            </div>
            <div 
              className={`period-tab ${selectedPeriod === 'week' ? 'active' : ''}`}
              onClick={() => handlePeriodChange('week')}
            >
              Неделя
            </div>
            <div 
              className={`period-tab ${selectedPeriod === 'month' ? 'active' : ''}`}
              onClick={() => handlePeriodChange('month')}
            >
              Месяц
            </div>
          </div>

          <div className="sidebar-search-box">
            <FontAwesomeIcon icon={faSearch} className="sidebar-search-icon" />
            <input 
              type="text" 
              className="sidebar-search-input" 
              placeholder="Поиск транспортных средств..." 
              id="vehicle-search"
            />
          </div>
        </div>

        {showDateModal && (
          <div className="date-picker-modal">
            <div className="date-picker-content">
              <h3>Выбор периода</h3>
              <div className="date-inputs">
                <div className="form-group">
                  <label htmlFor="start-date">Начальная дата</label>
                  <input
                    id="start-date"
                    type="date"
                    className="form-control"
                    value={tempStartDate}
                    onChange={handleStartDateChange}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="end-date">Конечная дата</label>
                  <input
                    id="end-date"
                    type="date"
                    className="form-control"
                    value={tempEndDate}
                    onChange={handleEndDateChange}
                  />
                </div>
              </div>
              <div className="date-picker-actions">
                <button className="btn btn-secondary" onClick={closeDateModal}>
                  Отмена
                </button>
                <button className="btn btn-primary" onClick={applyDateRange}>
                  Применить
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="stats-container">
          <div className="stats-header">Статистика</div>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">
                <FontAwesomeIcon icon={faTruck} />
              </div>
              <div className="stat-value">{stats.vehicles}</div>
              <div className="stat-label">Транспорт</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">
                <FontAwesomeIcon icon={faUser} />
              </div>
              <div className="stat-value">{stats.drivers}</div>
              <div className="stat-label">Водители</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">
                <FontAwesomeIcon icon={faMapMarkerAlt} />
              </div>
              <div className="stat-value">{stats.trips}</div>
              <div className="stat-label">Рейсы</div>
            </div>
          </div>
        </div>

        <div className="filters-container">
          <div className="filters-header">Статусы</div>
          <div className="filters-grid">
            <div className="filter-bubble" style={{ background: 'linear-gradient(135deg, #1ABC9C 0%, #16A085 100%)' }}>
              <span>0</span>
            </div>
            <div className="filter-bubble" style={{ background: 'linear-gradient(135deg, #E67E22 0%, #D35400 100%)' }}>
              <span>0</span>
            </div>
            <div className="filter-bubble" style={{ background: 'linear-gradient(135deg, #E74C3C 0%, #C0392B 100%)' }}>
              <span>0</span>
            </div>
            <div className="filter-bubble" style={{ background: 'linear-gradient(135deg, #95A5A6 0%, #7F8C8D 100%)' }}>
              <span>0</span>
            </div>
            <div className="filter-bubble" style={{ background: 'linear-gradient(135deg, #3498DB 0%, #2980B9 100%)' }}>
              <span>0</span>
            </div>
          </div>
        </div>

        <div className="sidebar-nav">
          <div className="nav-group">
            <div className="nav-group-title">Транспортные средства</div>
            <FolderList 
              onVehicleSelect={handleVehicleSelect}
            />
          </div>
        </div>

        <div className="sidebar-toggle" onClick={toggleCompactMode}>
          <FontAwesomeIcon icon={isCompactMode ? faAngleRight : faAngleLeft} />
        </div>
      </div>
      
      <div className="main-content">
        <div className="top-bar">
          <div className="report-menu-container">
            <div className="add-report-btn" onClick={handleAddReportClick}>
              <FontAwesomeIcon icon={faPlus} />
              <span>Добавить отчет</span>
            </div>
            
            {showReportMenu && (
              <div className="report-menu-popup" ref={reportMenuRef}>
                <div className="report-menu-columns">
                  <div className="report-column">
                    <h4>Отчеты</h4>
                    <ul className="report-list">
                      {renderReportItem('safedrive-details', faExclamationTriangle, 'SafeDrive: Детализация нарушений')}
                      {renderReportItem('safedrive-rating', faShieldAlt, 'SafeDrive: Рейтинг водителей')}
                      {renderReportItem('fuel-sheet', faClipboardList, 'Ведомость топливозаправщика')}
                      {renderReportItem('fuel-delivery', faGasPump, 'Выдача топлива')}
                      {renderReportItem('fuel-operations', faGasPump, 'Выдачи, заливы и сливы топлива')}
                      {renderReportItem('routes', faRoad, 'Выполнение рейсов')}
                      {renderReportItem('movement', faCarAlt, 'Движение')}
                      {renderReportItem('journal', faFileAlt, 'Журнал')}
                      {renderReportItem('fuel-events', faGasPump, 'Заправки и сливы')}
                    </ul>
                  </div>

                  <div className="report-column">
                    <h4>Карта</h4>
                    <ul className="report-list">
                      {renderReportItem('location', faMapMarked, 'Местоположение')}
                      {renderReportItem('track', faRoute, 'Трек')}
                    </ul>
                  </div>

                  <div className="report-column">
                    <h4>Графики</h4>
                    <ul className="report-list">
                      {renderReportItem('tire-pressure', faTachometerAlt, 'Давление в шинах')}
                      {renderReportItem('movement-period', faChartBar, 'Диаграмма: Движение за период')}
                      {renderReportItem('load-period', faChartLine, 'Диаграмма: Нагрузка за период')}
                      {renderReportItem('work-period', faCalendarDay, 'Диаграмма: Работа за период')}
                      {renderReportItem('fuel', faGasPump, 'Объем топлива')}
                      {renderReportItem('speed', faTachometerAlt, 'Скорость')}
                      {renderReportItem('voltage', faChartLine, 'Напряжение бортовой сети')}
                      {renderReportItem('rpm', faChartArea, 'Обороты двигателя')}
                    </ul>
                  </div>

                  <div className="report-column">
                    <h4>Рабочие столы</h4>
                    <ul className="report-list">
                      {renderReportItem('manager-dashboard', faClipboardCheck, 'Рабочий стол Руководителя')}
                      {renderReportItem('track-movement', faRoad, 'Трек + Движение')}
                      {renderReportItem('track-violations', faExclamationTriangle, 'Трек + Нарушения')}
                      {renderReportItem('track-fuel', faGasPump, 'Трек + Объём топлива')}
                    </ul>
                  </div>

                  <div className="report-preview">
                    <div 
                      className="preview-image" 
                      style={{ background: previewReport.image }}
                    ></div>
                    <h3>{previewReport.title}</h3>
                    <div className="preview-description">
                      {previewReport.description}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="report-tabs">
            {openTabs.map(tab => (
              <div 
                key={tab.id}
                className={`report-tab ${activeTabId === tab.id ? 'active' : ''}`}
                onClick={() => handleTabChange(tab.id)}
                data-tab-id={tab.id}
                data-vehicle-id={tab.vehicle?.id}
                data-vehicle-imei={tab.vehicle?.imei}
                data-report-type={tab.type}
              >
                <FontAwesomeIcon icon={getReportIcon(tab.type)} />
                <span>{tab.title}</span>
                <button 
                  className="close-tab"
                  onClick={(e) => handleCloseTab(tab.id, e)}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
          
          <div className="top-bar-actions">
            <div className="action-button" title="Приложения">
              <FontAwesomeIcon icon={faTh} />
            </div>
            <div className="action-button" title="Уведомления">
              <FontAwesomeIcon icon={faBell} />
              <span className="notification-count">0</span>
            </div>
            <div className="action-button" title="Помощь">
              <FontAwesomeIcon icon={faQuestionCircle} />
            </div>
          </div>
          
        </div>
        
        <div 
          className={`reports-container ${splitScreenActive ? 'split-screen-mode' : ''}`} 
          ref={reportsContainerRef}
        >
          {!splitScreenActive && renderActiveTabContent()}
        </div>
        
        <div 
          id="emergency-exit-fullscreen" 
          style={{ 
            position: 'fixed', 
            bottom: 10, 
            right: 10, 
            zIndex: 10000, 
            background: 'rgba(255,0,0,0.8)', 
            color: 'white', 
            padding: '5px 10px', 
            borderRadius: 5, 
            cursor: 'pointer', 
            display: 'none'
          }}
          onClick={() => window.exitFullscreen && window.exitFullscreen()}
        >
          Выйти из полного экрана
        </div>
      </div>
      
      <ChartDebugPanel />
    </div>
  );
};

export default ReportsPage;