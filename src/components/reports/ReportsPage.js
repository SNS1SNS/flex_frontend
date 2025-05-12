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
  faQuestion, faInfo, faColumns, faThLarge
} from '@fortawesome/free-solid-svg-icons';
import TrackMap from './TrackMap';
import FolderList from '../folders/FolderList';
import './ReportStyles.css';
import logo from '../../images/logo.svg';
import fuel from '../../images/fuel.png';
import track from '../../images/road.png';
import track2 from '../../images/tracks.png';

// Временные заглушки для компонентов, которые еще не созданы
const LiveTrack = ({ vehicle, startDate, endDate }) => (
  <div className="component-placeholder">
    <h3>Компонент LiveTrack находится в разработке</h3>
    <p>Выбрано ТС: {vehicle?.name || 'Не выбрано'}</p>
    <p>Период: {startDate?.toLocaleDateString()} - {endDate?.toLocaleDateString()}</p>
  </div>
);

// Импортируем компоненты графиков
import SpeedChart from './SpeedChart';
import FuelChart from './FuelChart';
import VoltageChart from './VoltageChart';
import EngineChart from './EngineChart';

// Импортируем менеджер разделения экрана и компонент выбора отчетов
import SplitScreenManager, { SPLIT_MODES } from '../../utils/SplitScreenManager';
import '../../utils/SplitScreen.css';
import ReportSelector from './ReportSelector';

const ReportsPage = () => {
  const [dateRange, setDateRange] = useState(() => {
    // Пытаемся восстановить дату из localStorage
    try {
      const savedRange = localStorage.getItem('lastDateRange');
      if (savedRange) {
        const parsed = JSON.parse(savedRange);
        // Конвертируем строки дат в объекты Date
        return {
          startDate: parsed.startDate ? new Date(parsed.startDate) : new Date(),
          endDate: parsed.endDate ? new Date(parsed.endDate) : new Date()
        };
      }
    } catch (e) {
      console.warn('Ошибка при чтении диапазона дат из localStorage:', e);
    }
    
    // По умолчанию - последние 24 часа
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

  // Состояние для предварительного просмотра отчета
  const [previewReport, setPreviewReport] = useState({
    title: 'Выберите отчет',
    description: 'Наведите курсор на интересующий вас отчет, чтобы увидеть его описание.',
    image: ''
  });

  // Refs
  // eslint-disable-next-line no-unused-vars
  const datePickerRef = useRef(null);
  const reportMenuRef = useRef(null);

  // Добавляем состояние для компактного режима сайдбара
  const [isCompactMode, setIsCompactMode] = useState(false);
  
  // Добавляем состояние для профильного меню
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  
  // Добавляем ref для профильного меню
  const profileMenuRef = useRef(null);

  // Режим разделения экрана
  const [splitMode, setSplitMode] = useState(() => {
    const savedMode = localStorage.getItem('splitScreenMode');
    return savedMode || 'single';  // 'single', 'split-2', 'split-4'
  });

  // Добавляем состояния для модального окна
  const [showDateModal, setShowDateModal] = useState(false);
  const [tempStartDate, setTempStartDate] = useState('');
  const [tempEndDate, setTempEndDate] = useState('');

  // Добавляем состояние для активации режима разделения экрана
  const [splitScreenActive, setSplitScreenActive] = useState(false);
  
  // Добавляем ref для контейнера отчетов
  const reportsContainerRef = useRef(null);

  // Форматирование даты в строку ДД.ММ.ГГГГ
  const formatDate = (date) => {
    if (!date) return '';
    
    // Проверяем, является ли date строкой, и если да - преобразуем в объект Date
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Проверяем, является ли dateObj валидным объектом Date
    if (!(dateObj instanceof Date) || isNaN(dateObj)) {
      console.warn('Невалидная дата для форматирования:', date);
      return '';
    }
    
    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${day}.${month}.${year}`;
  };

  // Расчет диапазона дат на основе типа периода
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

  // Инициализация диапазона дат при загрузке
  useEffect(() => {
    const savedPeriod = localStorage.getItem('currentPeriodType') || 'day';
    setSelectedPeriod(savedPeriod);
    const { startDate, endDate } = calculateDateRange(new Date(), savedPeriod);
    setDateRange({ startDate, endDate });
    
    // Загрузка статистики
    fetchStatistics();
  }, []);

  // Обновляем обработчик клика по календарю
  const handleCalendarClick = () => {
    // Инициализируем временные даты текущими значениями
    const startDate = dateRange.startDate instanceof Date 
      ? dateRange.startDate.toISOString().split('T')[0] 
      : (typeof dateRange.startDate === 'string' ? dateRange.startDate : '');
      
    const endDate = dateRange.endDate instanceof Date 
      ? dateRange.endDate.toISOString().split('T')[0] 
      : (typeof dateRange.endDate === 'string' ? dateRange.endDate : '');
    
    setTempStartDate(startDate);
    setTempEndDate(endDate);
    // Открываем модальное окно
    setShowDateModal(true);
  };

  // Функция закрытия модального окна
  const closeDateModal = () => {
    setShowDateModal(false);
  };

  // Обработчик изменения начальной даты
  const handleStartDateChange = (e) => {
    setTempStartDate(e.target.value);
  };

  // Обработчик изменения конечной даты
  const handleEndDateChange = (e) => {
    setTempEndDate(e.target.value);
  };

  // Функция для применения выбранного диапазона дат
  const applyDateRange = () => {
    // Преобразуем строки в объекты Date
    const startDate = new Date(tempStartDate);
    const endDate = new Date(tempEndDate);
    
    // Устанавливаем время начальной даты на 00:00:00.000
    startDate.setHours(0, 0, 0, 0);
    
    // Обновляем основное состояние dateRange
    setDateRange({
      startDate,
      endDate
    });
    
    // Сохраняем дату последнего обновления для отслеживания
    window.lastDateUpdateTime = new Date().getTime();
    
    // Сохраняем в localStorage
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
    
    // Закрываем модальное окно
    setShowDateModal(false);
    
    // Отправляем событие обновления дат
    const dateEvent = new CustomEvent('dateRangeChanged', {
      detail: {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        forceUpdate: true,
        timestamp: window.lastDateUpdateTime
      }
    });
    document.dispatchEvent(dateEvent);
    
    // Отправляем событие принудительного обновления для всех компонентов
    const forceUpdateEvent = new CustomEvent('forceVehicleUpdate', {
      detail: { 
        vehicle: selectedVehicle,
        startDate: startDate,
        endDate: endDate,
        timestamp: window.lastDateUpdateTime
      }
    });
    document.dispatchEvent(forceUpdateEvent);
    
    // Обновляем даты в открытых вкладках
    if (openTabs.length > 0) {
      setOpenTabs(prevTabs => prevTabs.map(tab => ({
        ...tab,
        startDate: startDate,
        endDate: endDate
      })));
    }
    
    // Обновляем статистику с новым диапазоном дат
    fetchStatistics();
  };

  // Обработчик смены периода (день/неделя/месяц)
  const handlePeriodChange = (period) => {
    setSelectedPeriod(period);
    localStorage.setItem('currentPeriodType', period);
    
    const { startDate, endDate } = calculateDateRange(new Date(), period);
    
    // Дополнительная гарантия, что startDate установлен на 00:00:00.000
    startDate.setHours(0, 0, 0, 0);
    
    setDateRange({ startDate, endDate });
    
    // Сохраняем дату последнего обновления для отслеживания
    window.lastDateUpdateTime = new Date().getTime();
    
    // Сохраняем в localStorage с форматированием для правильного чтения в других компонентах
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
    
    // Отправка события об изменении дат
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
    
    // Дополнительно отправляем событие forceUpdate для обеспечения синхронизации
    const forceUpdateEvent = new CustomEvent('forceVehicleUpdate', {
      detail: { 
        vehicle: selectedVehicle,
        startDate: startDate,
        endDate: endDate,
        timestamp: window.lastDateUpdateTime
      }
    });
    document.dispatchEvent(forceUpdateEvent);
    
    // Обновляем даты в открытых вкладках
    if (openTabs.length > 0) {
      setOpenTabs(prevTabs => prevTabs.map(tab => ({
        ...tab,
        startDate: startDate,
        endDate: endDate
      })));
    }
  };

  // Загрузка статистики
  const fetchStatistics = async () => {
    try {
      // Получаем токен авторизации с правильной структурой JWT
      const getJwtToken = () => {
        // Проверяем различные варианты хранения токена
        const possibleTokenKeys = ['authToken', 'token', 'jwt', 'access_token'];
        
        for (const key of possibleTokenKeys) {
          const token = localStorage.getItem(key);
          if (token) {
            // Проверяем, является ли токен корректным JWT (содержит 2 точки)
            if (token.split('.').length === 3) {
              return token;
            }
          }
        }
        
        // Если не нашли JWT токен, создаем тестовый
        const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
        const payload = btoa(JSON.stringify({ 
          sub: 'test-user', 
          name: 'Test User', 
          role: 'ADMIN',
          exp: Math.floor(Date.now() / 1000) + 3600 // срок действия 1 час
        }));
        const signature = btoa('test-signature');
        
        return `${header}.${payload}.${signature}`;
      };
      
      const token = getJwtToken();
      
      // Логируем детали запроса
      console.log('Попытка загрузки статистики:');
      console.log('URL:', '/admin/statistics');
      
      // Скрываем полный токен в логах (показываем только первую часть)
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
      // При ошибке устанавливаем нулевые значения
      setStats({ vehicles: 0, drivers: 0, trips: 0 });
    }
  };

  // Обработчик добавления отчета
  const handleAddReportClick = () => {
    setShowReportMenu(!showReportMenu);
  };

  // Обработчик выбора отчета
  const handleReportSelect = (reportType) => {
    if (!selectedVehicle) {
      alert('Пожалуйста, выберите транспортное средство для создания отчета');
      return;
    }
    
    // Генерация ID для новой вкладки
    const tabId = `tab-${Date.now()}`;
    
    // Создание новой вкладки с учетом типа отчета
    const newTab = {
      id: tabId,
      type: reportType,
      vehicle: selectedVehicle,
      title: getReportTitle(reportType),
      // Добавляем даты для отчета
      startDate: dateRange.startDate,
      endDate: dateRange.endDate
    };
    
    console.log('Создание отчета:', {
      type: reportType,
      vehicle: selectedVehicle,
      startDate: dateRange.startDate ? dateRange.startDate.toISOString() : 'не указана',
      endDate: dateRange.endDate ? dateRange.endDate.toISOString() : 'не указана'
    });
    
    // Добавление новой вкладки и переключение на неё
    setOpenTabs(prevTabs => [...prevTabs, newTab]);
    setActiveTabId(tabId);
    setShowReportMenu(false);
  };

  // Получение заголовка отчета по его типу
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

  // Получение иконки отчета по его типу
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

  // Закрытие вкладки
  const handleCloseTab = (tabId, e) => {
    e.stopPropagation();
    
    setOpenTabs(prevTabs => {
      const filteredTabs = prevTabs.filter(tab => tab.id !== tabId);
      
      // Если закрываем активную вкладку, нужно активировать другую
      if (activeTabId === tabId && filteredTabs.length > 0) {
        setActiveTabId(filteredTabs[filteredTabs.length - 1].id);
      } else if (filteredTabs.length === 0) {
        setActiveTabId(null);
      }
      
      return filteredTabs;
    });
  };

  // Переключение между вкладками
  const handleTabChange = (tabId) => {
    setActiveTabId(tabId);
  };

  // Обработчик выбора транспортного средства
  const handleVehicleSelect = (vehicle) => {
    // Если выбрано то же самое ТС, не делаем ничего
    if (selectedVehicle && vehicle && selectedVehicle.id === vehicle.id) {
      console.log('Выбрано то же самое ТС, игнорируем:', vehicle?.name);
      return;
    }

    setSelectedVehicle(vehicle);
    console.log('Выбрано транспортное средство:', vehicle);

    // Сохраняем выбор в глобальной переменной для отслеживания последнего выбора
    window.lastSelectedVehicleId = vehicle?.id;
    window.lastVehicleUpdateTime = new Date().getTime();

    // Создаем пользовательское событие для обновления всех компонентов
    // Добавляем текущие даты к событию для полной синхронизации
    const forceUpdateEvent = new CustomEvent('forceVehicleUpdate', {
      detail: { 
        vehicle: vehicle,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        timestamp: window.lastVehicleUpdateTime
      }
    });

    // Отправляем событие для синхронизации выбора машины между компонентами
    document.dispatchEvent(forceUpdateEvent);

    // Обновляем все открытые вкладки с данными нового ТС
    if (vehicle && openTabs.length > 0) {
      setOpenTabs(prevTabs => prevTabs.map(tab => ({
        ...tab,
        vehicle: vehicle
      })));
    }
  };

  // Отображение контента активной вкладки
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
    
    // Получаем даты из вкладки или используем общие даты из состояния
    const tabStartDate = activeTab.startDate || dateRange.startDate;
    const tabEndDate = activeTab.endDate || dateRange.endDate;
    
    // Устраняем дубликаты рендера и гарантируем актуальные данные
    console.log('Отображение отчета (одно сообщение):', {
      type: activeTab.type,
      vehicle: activeTab.vehicle,
      startDate: tabStartDate ? tabStartDate.toISOString() : 'не указана',
      endDate: tabEndDate ? tabEndDate.toISOString() : 'не указана'
    });
    
    // Создаем событие для принудительного обновления данных
    const forceUpdateEvent = new CustomEvent('forceVehicleUpdate', {
      detail: { 
        vehicle: activeTab.vehicle,
        startDate: tabStartDate,
        endDate: tabEndDate,
        timestamp: new Date().getTime() // Добавим временную метку для гарантированного обновления
      }
    });
    
    // Отправляем событие через setTimeout, чтобы компонент успел обновиться
    setTimeout(() => document.dispatchEvent(forceUpdateEvent), 50);
    
    // Рендер компонента в зависимости от типа отчета
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

  // Функция для закрытия меню отчетов
  const closeReportMenu = () => {
    setShowReportMenu(false);
  };

  // Установка обработчиков при монтировании/размонтировании
  useEffect(() => {
    // Добавляем ссылку на DOM-элемент меню после его создания
    const reportMenuPopup = reportMenuRef.current;
    const addReportBtn = document.querySelector('.add-report-btn');
    
    if (showReportMenu && reportMenuPopup && addReportBtn) {
      // Таймер для предотвращения мгновенного закрытия при клике
      let timeoutId = null;
      
      const handleMouseEnter = () => {
        clearTimeout(timeoutId);
      };
      
      const handleMouseLeave = () => {
        timeoutId = setTimeout(() => {
          closeReportMenu();
        }, 300); // Задержка перед закрытием, чтобы избежать случайного закрытия
      };
      
      // Добавляем обработчики событий
      reportMenuPopup.addEventListener('mouseenter', handleMouseEnter);
      reportMenuPopup.addEventListener('mouseleave', handleMouseLeave);
      addReportBtn.addEventListener('mouseenter', handleMouseEnter);
      addReportBtn.addEventListener('mouseleave', handleMouseLeave);
      
      // Удаляем обработчики при размонтировании
      return () => {
        reportMenuPopup.removeEventListener('mouseenter', handleMouseEnter);
        reportMenuPopup.removeEventListener('mouseleave', handleMouseLeave);
        addReportBtn.removeEventListener('mouseenter', handleMouseEnter);
        addReportBtn.removeEventListener('mouseleave', handleMouseLeave);
      };
    }
  }, [showReportMenu]);

  // Функция для получения описания отчета по его типу
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

  // Функция для получения пути к изображению по типу отчета
  const getReportImagePath = (reportType) => {
    // Поскольку у нас нет реальных изображений, используем цветной фон как заглушку
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

  // Обработчик наведения на пункт меню
  const handleReportHover = (reportType) => {
    setPreviewReport({
      title: getReportTitle(reportType),
      description: getReportDescription(reportType),
      image: getReportImagePath(reportType)
    });
  };

  // Обновление JSX для элементов меню, добавление onMouseEnter
  const renderReportItem = (reportType, Icon, label) => (
    <li 
      onClick={() => handleReportSelect(reportType)}
      onMouseEnter={() => handleReportHover(reportType)}
    >
      <FontAwesomeIcon icon={Icon} />
      <span>{label}</span>
    </li>
  );

  // Функция для переключения компактного режима
  const toggleCompactMode = () => {
    setIsCompactMode(!isCompactMode);
  };

  // Функция для переключения профильного меню
  const toggleProfileMenu = (e) => {
    e.stopPropagation();
    setProfileMenuOpen(!profileMenuOpen);
  };

  // Функция для закрытия профильного меню при клике вне его
  const handleClickOutside = (event) => {
    if (
      profileMenuRef.current && 
      !profileMenuRef.current.contains(event.target) &&
      !event.target.closest('.sidebar-header')
    ) {
      setProfileMenuOpen(false);
    }
  };

  // Функция для выхода из системы
  const handleLogout = () => {
    // Здесь добавьте логику выхода
    window.location.href = '/login';
  };

  // Установка обработчика для закрытия профильного меню
  useEffect(() => {
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // Эффект для создания пульсации при клике на элементы меню
  useEffect(() => {
    const createPulseEffect = (element) => {
      // Удаляем предыдущие эффекты
      const existingEffects = element.querySelectorAll('.pulse-effect');
      existingEffects.forEach(effect => effect.remove());

      // Создаем новый эффект
      const pulseEffect = document.createElement('div');
      pulseEffect.className = 'pulse-effect';
      element.appendChild(pulseEffect);

      // Удаляем эффект после анимации
      setTimeout(() => {
        pulseEffect.remove();
      }, 500);
    };

    // Применяем обработчики клика ко всем элементам навигации
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', function() {
        createPulseEffect(this);
      });
    });

    return () => {
      // Очищаем обработчики при размонтировании
      navItems.forEach(item => {
        item.removeEventListener('click', () => {});
      });
    };
  }, []);

  // Сохраняем диапазон дат при его изменении
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
  
  // Сохраняем режим разделения экрана
  useEffect(() => {
    localStorage.setItem('splitScreenMode', splitMode);
  }, [splitMode]);

  // Функция для рендеринга React компонентов в контейнере
  const renderReactComponent = (componentType, container, props) => {
    if (!container) return;
    
    try {
      const root = ReactDOM.createRoot(container);
      
      // Выбираем компонент в зависимости от типа
      switch (componentType) {
        case 'ReportSelector':
          root.render(<ReportSelector 
            selectedVehicle={selectedVehicle} 
            onSelectReport={props.onSelectReport}
            onCancel={props.onCancel}
          />);
          break;
        // Добавьте другие компоненты по мере необходимости
        default:
          console.warn('Неизвестный тип компонента:', componentType);
      }
    } catch (error) {
      console.error('Ошибка при рендеринге React компонента:', error);
      container.innerHTML = `<div class="error-message">Ошибка при рендеринге: ${error.message}</div>`;
    }
  };
  
  // Инициализация менеджера разделения экрана
  useEffect(() => {
    // Проверяем, активен ли режим разделения экрана
    if (splitScreenActive && reportsContainerRef.current) {
      console.log('Активация режима разделения экрана с режимом:', splitMode);
      
      // Определяем доступные типы отчетов
      const availableReportTypes = [
        'track', 'live-track', 'speed', 'fuel', 'voltage', 'rpm'
      ];
      
      try {
        // Инициализируем менеджер разделения экрана с четырьмя параметрами
        SplitScreenManager.init(
          reportsContainerRef.current,
          availableReportTypes,
          (reportType, containerId) => createReportForContainer(reportType, containerId),
          renderReactComponent
        );
        
        // Устанавливаем текущий режим разделения
        if (splitMode === 'split-2') {
          // Если режим разделения на 2 части, устанавливаем вертикальное разделение
          SplitScreenManager.changeSplitMode(SPLIT_MODES.VERTICAL);
        } else if (splitMode === 'split-4') {
          // Если режим разделения на 4 части, устанавливаем квадратное разделение
          SplitScreenManager.changeSplitMode(SPLIT_MODES.QUAD);
        }
        
        // Добавляем обработчики событий
        SplitScreenManager.on('splitScreenHidden', () => {
          console.log('Событие скрытия режима разделения экрана');
          setSplitScreenActive(false);
          setSplitMode('single');
          
          // Перерисовываем отчеты в нормальном режиме
          const activeTab = openTabs.find(tab => tab.id === activeTabId);
          if (activeTab) {
            const event = new CustomEvent('forceVehicleUpdate', {
              detail: { 
                vehicle: activeTab.vehicle,
                startDate: activeTab.startDate || dateRange.startDate,
                endDate: activeTab.endDate || dateRange.endDate,
                timestamp: new Date().getTime()
              }
            });
            document.dispatchEvent(event);
          }
        });
        
        // Показываем кнопку выхода из режима разделения экрана
        const exitSplitBtn = document.getElementById('exit-split-screen');
        if (exitSplitBtn) {
          exitSplitBtn.style.display = 'block';
        }
      } catch (error) {
        console.error('Ошибка при инициализации менеджера разделения экрана:', error);
        setSplitScreenActive(false);
      }
    } else {
      // Скрываем кнопку выхода из режима разделения экрана
      const exitSplitBtn = document.getElementById('exit-split-screen');
      if (exitSplitBtn) {
        exitSplitBtn.style.display = 'none';
      }
    }
    
    return () => {
      // Очистка при размонтировании
      if (splitScreenActive) {
        console.log('Очистка менеджера разделения экрана при размонтировании');
        try {
          SplitScreenManager.hideSplitScreen();
        } catch (error) {
          console.error('Ошибка при скрытии режима разделения экрана:', error);
        }
      }
    };
  }, [splitScreenActive, dateRange, openTabs, activeTabId, selectedVehicle, splitMode]);
  
  // Функция для создания отчета для контейнера
  const createReportForContainer = (reportType, containerId) => { // eslint-disable-line no-unused-vars
    if (!selectedVehicle) {
      alert('Пожалуйста, выберите транспортное средство для создания отчета');
      return null;
    }
    
    // Создаем элемент контейнера для отчета
    const reportContainer = document.createElement('div');
    reportContainer.className = 'split-report-content';
    reportContainer.style.width = '100%';
    reportContainer.style.height = '100%';
    
    // Создаем React компонент в зависимости от типа отчета
    const reportElement = getReportElement(reportType, selectedVehicle, dateRange.startDate, dateRange.endDate);
    
    // Отрисовываем React компонент в контейнере
    if (reportElement) {
      setTimeout(() => {
        try {
          const root = ReactDOM.createRoot(reportContainer);
          root.render(reportElement);
        } catch (error) {
          console.error('Ошибка при отрисовке отчета в контейнере:', error);
          reportContainer.innerHTML = `<div class="error-message">Ошибка при создании отчета: ${error.message}</div>`;
        }
      }, 0);
    } else {
      reportContainer.innerHTML = '<div class="error-message">Неизвестный тип отчета</div>';
    }
    
    return reportContainer;
  };
  
  // Функция для получения React-элемента отчета по его типу
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
  
  // Обновленная функция для изменения режима разделения экрана
  const handleSplitModeChange = (mode) => {
    console.log('Изменение режима разделения экрана на:', mode);
    
    // Устанавливаем режим разделения в состоянии компонента
    setSplitMode(mode);
    
    // Если выбран любой режим разделения, активируем менеджер разделения экрана
    if (mode !== 'single') {
      setSplitScreenActive(true);
      
      // Если SplitScreenManager уже инициализирован, меняем режим
      if (SplitScreenManager.rootContainer) {
        try {
          // Определяем режим в терминах SPLIT_MODES
          let splitScreenMode;
          switch (mode) {
            case 'split-2':
              splitScreenMode = SPLIT_MODES.VERTICAL;
              break;
            case 'split-4':
              splitScreenMode = SPLIT_MODES.QUAD;
              break;
            default:
              splitScreenMode = SPLIT_MODES.SINGLE;
          }
          
          // Применяем выбранный режим
          SplitScreenManager.changeSplitMode(splitScreenMode);
        } catch (error) {
          console.error('Ошибка при изменении режима разделения экрана:', error);
        }
      }
    } else {
      // Деактивируем режим разделения экрана
      if (SplitScreenManager.rootContainer) {
        try {
          SplitScreenManager.changeSplitMode(SPLIT_MODES.SINGLE);
          SplitScreenManager.hideSplitScreen();
        } catch (error) {
          console.error('Ошибка при отключении режима разделения экрана:', error);
        }
      }
      setSplitScreenActive(false);
    }
  };
  
  // Отображение кнопок переключения режима разделения экрана
  const renderSplitModeControls = () => {
    return (
      <div className="split-mode-controls">
        <button 
          className={`split-mode-button ${splitMode === 'single' ? 'active' : ''}`}
          onClick={() => handleSplitModeChange('single')}
          title="Один отчет"
        >
          <FontAwesomeIcon icon={faTh} />
        </button>
        <button 
          className={`split-mode-button ${splitMode === 'split-2' ? 'active' : ''}`}
          onClick={() => handleSplitModeChange('split-2')}
          title="Разделить экран на 2"
        >
          <FontAwesomeIcon icon={faColumns} />
        </button>
        <button 
          className={`split-mode-button ${splitMode === 'split-4' ? 'active' : ''}`}
          onClick={() => handleSplitModeChange('split-4')}
          title="Разделить экран на 4"
        >
          <FontAwesomeIcon icon={faThLarge} />
        </button>
      </div>
    );
  };
  
  // Эти функции могут использоваться в будущем, поэтому добавляем eslint-disable-next-line
  // eslint-disable-next-line
  const handleDateChange = (start, end) => {
    // Устанавливаем время начальной даты на 00:00:00.000
    if (start instanceof Date) {
      start.setHours(0, 0, 0, 0);
    }
    
    setDateRange({
      startDate: start,
      endDate: end
    });
    
    // Сохраняем в localStorage
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
    
    // Обновляем даты в открытых вкладках
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
  
  return (
    <div className="dashboard">
      {/* Боковая панель */}
      <div className={`sidebar ${isCompactMode ? 'compact-mode' : ''}`}>
        {/* Шапка боковой панели */}
        <div 
                className="sidebar-header" 
                id="sidebarHeader" 
                onClick={toggleProfileMenu}
            >
                {/* Проверяем путь к изображению и используем импорт для SVG или абсолютный путь */}
                <img 
                  src = {logo} 
                  alt="Контроль Техники" 
                  className="logo-image" 
                />
                <h1 className="logo-text">Контроль Техники</h1>
            </div>

        {/* Профильное меню */}
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

        {/* Секция с датой */}
        <div className="sidebar-date-section">
          <div className="date-display">
            <div className="date-label">Период:</div>
            <div className="date-value" onClick={handleCalendarClick}>
              {dateRange.startDate && dateRange.endDate && 
                `${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)}`}
              <FontAwesomeIcon icon={faCalendarAlt} style={{ marginLeft: '8px' }} />
            </div>
          </div>
          
          {/* Вкладки периодов */}
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

          {/* Поиск транспортных средств */}
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

        {/* Модальное окно выбора даты */}
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

        {/* Секция статистики */}
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

        {/* Секция фильтров */}
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

        {/* Навигация по папкам и ТС */}
        <div className="sidebar-nav">
          <div className="nav-group">
            <div className="nav-group-title">Транспортные средства</div>
            <FolderList 
              onVehicleSelect={handleVehicleSelect}
            />
          </div>
        </div>

        {/* Кнопка переключения компактного режима */}
        <div className="sidebar-toggle" onClick={toggleCompactMode}>
          <FontAwesomeIcon icon={isCompactMode ? faAngleRight : faAngleLeft} />
        </div>
      </div>
      
      {/* Основной контент */}
      <div className="main-content">
        <div className="top-bar">
          <div className="report-menu-container">
            <div className="add-report-btn" onClick={handleAddReportClick}>
              <FontAwesomeIcon icon={faPlus} />
              <span>Добавить отчет</span>
            </div>
            
            {/* Меню выбора отчета */}
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
          
          {/* Вкладки отчетов */}
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
            <div className="user-menu">
              <button id="logout-button">Выход</button>
            </div>
          </div>
          
        </div>
        
        {/* Контейнер для отчетов */}
        <div 
          className={`reports-container ${splitScreenActive ? 'split-screen-mode' : ''}`} 
          ref={reportsContainerRef}
        >
          {!splitScreenActive && renderActiveTabContent()}
        </div>
        
        {/* Аварийная кнопка выхода из полноэкранного режима */}
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
    </div>
  );
};

export default ReportsPage; 