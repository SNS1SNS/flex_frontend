import React, { useState, useEffect, useRef } from 'react';
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
import LiveTrack from './LiveTrack';
import TrackMap from './TrackMap';
import SpeedChart from './SpeedChart';
import FuelChart from './FuelChart';
import FolderList from '../folders/FolderList';
import './ReportStyles.css';
import logo from '../../images/logo.svg';
import fuel from '../../images/fuel.png';
import track from '../../images/road.png';
import track2 from '../../images/tracks.png';
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
  const [showCalendar, setShowCalendar] = useState(false);
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

  // Форматирование даты в строку ДД.ММ.ГГГГ
  const formatDate = (date) => {
    if (!date) return '';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  // Расчет диапазона дат на основе типа периода
  const calculateDateRange = (baseDate, periodType) => {
    const currentDate = baseDate || new Date();
    const startDate = new Date(currentDate);
    const endDate = new Date(currentDate);

    if (periodType === 'day') {
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (periodType === 'week') {
      endDate.setDate(startDate.getDate());
      startDate.setDate(startDate.getDate() - 7);
    } else if (periodType === 'month') {
      endDate.setDate(startDate.getDate());
      startDate.setDate(startDate.getDate() - 31);
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

  // Обработчик клика по иконке календаря
  const handleCalendarClick = () => {
    setShowCalendar(true);
  };

  // Применение выбранного диапазона дат
  const handleApplyDateRange = (start, end) => {
    setDateRange({ startDate: start, endDate: end });
    setShowCalendar(false);
    
    // Определение типа периода на основе выбранных дат
    let periodType = 'custom';
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    if (start.getTime() === today.getTime() && 
        end.getTime() === new Date(today.getTime() + 86399999).getTime()) {
      periodType = 'today';
    } else if (start.getTime() === startOfWeek.getTime() && 
              end.getTime() === new Date(startOfWeek.getTime() + 6 * 86400000 + 86399999).getTime()) {
      periodType = 'week';
    } else if (start.getTime() === startOfMonth.getTime() && 
              end.getTime() === new Date(new Date(today.getFullYear(), today.getMonth() + 1, 0).getTime() + 86399999).getTime()) {
      periodType = 'month';
    }
    
    setSelectedPeriod(periodType);
    localStorage.setItem('currentPeriodType', periodType);
    
    // Обновляем статистику
    fetchStatistics();
  };

  // Обработчик смены периода (день/неделя/месяц)
  const handlePeriodChange = (period) => {
    setSelectedPeriod(period);
    localStorage.setItem('currentPeriodType', period);
    
    const { startDate, endDate } = calculateDateRange(new Date(), period);
    setDateRange({ startDate, endDate });
    
    // Отправка события об изменении дат
    const event = new CustomEvent('dateRangeChanged', {
      detail: {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        periodType: period,
        forceUpdate: true
      }
    });
    document.dispatchEvent(event);
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
    
    console.log('Отображение отчета:', {
      type: activeTab.type,
      vehicle: activeTab.vehicle,
      startDate: tabStartDate ? tabStartDate.toISOString() : 'не указана',
      endDate: tabEndDate ? tabEndDate.toISOString() : 'не указана'
    });
    
    // Рендер компонента в зависимости от типа отчета

    switch (activeTab.type) {
      case 'track':
        return (
          <TrackMap 
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
            tabId={activeTab.id}
            vehicle={activeTab.vehicle}
            startDate={tabStartDate}
            endDate={tabEndDate}
          />
        );
      case 'speed':
        return (
          <SpeedChart 
            tabId={activeTab.id} 
            vehicle={activeTab.vehicle} 
            startDate={tabStartDate} 
            endDate={tabEndDate}
          />
        );
      case 'fuel':
        return (
          <FuelChart 
            tabId={activeTab.id} 
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

  // Обработчик изменения диапазона дат
  const handleDateChange = (start, end) => {
    setDateRange({
      startDate: start,
      endDate: end
    });
    
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

  // Обработчик выбора транспортного средства
  const handleVehicleSelect = (vehicle) => {
    setSelectedVehicle(vehicle);
    console.log('Выбрано транспортное средство:', vehicle);
  };

  // Изменение режима разделения экрана
  const handleSplitModeChange = (mode) => {
    setSplitMode(mode);
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
        {showCalendar && (
          <div className="date-picker-modal" ref={datePickerRef}>
            <div className="date-picker-content">
              <h3>Выберите диапазон дат</h3>
              <div className="date-inputs">
                <div className="form-group">
                  <label htmlFor="start-date">Начальная дата:</label>
                  <input 
                    type="date" 
                    id="start-date" 
                    className="form-control" 
                    defaultValue={dateRange.startDate ? dateRange.startDate.toISOString().split('T')[0] : ''}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="end-date">Конечная дата:</label>
                  <input 
                    type="date" 
                    id="end-date" 
                    className="form-control" 
                    defaultValue={dateRange.endDate ? dateRange.endDate.toISOString().split('T')[0] : ''}
                  />
                </div>
              </div>
              <div className="date-picker-actions">
                <button 
                  className="btn btn-primary" 
                  onClick={() => {
                    const startInput = document.getElementById('start-date');
                    const endInput = document.getElementById('end-date');
                    if (startInput.value && endInput.value) {
                      handleApplyDateRange(new Date(startInput.value), new Date(endInput.value));
                    }
                  }}
                >
                  Применить
                </button>
                <button onClick={() => setShowCalendar(false)}>Отмена</button>
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
              onVehicleSelect={setSelectedVehicle}
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
                      {renderReportItem('engine', faChartArea, 'Обороты двигателя')}
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
                data-vehicle={tab.vehicle?.name}
                data-vehicle-imei={tab.vehicle?.imei}
                data-report-type={tab.type}
              >
                <FontAwesomeIcon icon={getReportIcon(tab.type)} />
                <span>{tab.vehicle?.name} - {tab.title}</span>
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
        <div className="reports-container">
          {renderActiveTabContent()}
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
        
        {/* Кнопка выхода из режима разделения экрана */}
        <div 
          id="exit-split-screen" 
          style={{ 
            position: 'fixed', 
            bottom: 10, 
            left: 10, 
            zIndex: 10000, 
            background: 'rgba(0,123,255,0.8)', 
            color: 'white', 
            padding: '8px 15px', 
            borderRadius: 5, 
            cursor: 'pointer', 
            display: 'none', 
            fontSize: 14, 
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
          }}
          onClick={() => window.splitScreenManager && window.splitScreenManager.hideSplitScreen()}
        >
          <FontAwesomeIcon icon={faPlus} style={{ transform: 'rotate(45deg)' }} /> Выйти из режима разделения экрана
        </div>
      </div>
    </div>
  );
};

export default ReportsPage; 