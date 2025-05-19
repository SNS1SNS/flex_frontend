import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlus, faTruck, faSearch,
  faSync, faEdit, faTrash, faEye, faDatabase,
  faSort, faSortUp, faSortDown, faChevronLeft, faChevronRight, faExclamationTriangle,
  faRoute, faMapMarkerAlt, faClipboardList,
  faTools, faPowerOff, faFolderOpen, faFileExport, faFileDownload, faExchangeAlt
} from '@fortawesome/free-solid-svg-icons';
import './VehiclesPage.css';
import { useSidebar } from '../context/SidebarContext';
import { apiService } from '../services';
import { useLoading } from '../context/LoadingContext';
import AddVehicleModal from './AddVehicleModal';
import ManageGroupsModal from './ManageGroupsModal';
import { convertVehiclesToCSV, exportCSV, exportJSON, prepareVehiclesForExport } from '../utils/exportUtils';

/**
 * Компонент страницы с транспортными средствами
 */
const VehiclesPage = () => {
  // Получаем доступ к глобальному индикатору загрузки
  const { showLoader, hideLoader } = useLoading();
  
  const [vehicles, setVehicles] = useState([]);
  const [isDataFetched, setIsDataFetched] = useState(false);
  const [selectedVehicles, setSelectedVehicles] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showVehicleDetails, setShowVehicleDetails] = useState(false);
  const [selectedVehicleDetails, setSelectedVehicleDetails] = useState(null);
  const [isAddVehicleModalOpen, setIsAddVehicleModalOpen] = useState(false);
  const [isManageGroupsModalOpen, setIsManageGroupsModalOpen] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState('json');
  // Состояния для фильтров и поиска
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  
  // Состояние для контекстного меню
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    vehicleId: null
  });
  
  // Получаем функции для работы с боковым меню
  const { compactMode } = useSidebar();
  
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      // Если нет токена, перенаправляем на страницу входа
      // window.location.href = '/login';
      console.warn('Нет токена авторизации');
    }
    
    handleFetchData();
    
    // Добавляем слушатель события для скрытия контекстного меню при клике вне его
    document.addEventListener('click', handleHideContextMenu);
    
    return () => {
      // Удаляем слушатель при размонтировании компонента
      document.removeEventListener('click', handleHideContextMenu);
    };
  }, []);

  // Функция для загрузки данных с сервера через apiService
  const handleFetchData = () => {
    // Показываем индикатор загрузки с глобальным контекстом
    showLoader('Загрузка списка транспортных средств...');
    
    // Используем apiService вместо прямого fetch
    apiService.getVehicles()
      .then(data => {
        // Обработка полученных данных
        let formattedData = data;
        // Проверяем, нужно ли сначала извлечь данные из ответа
        if (data && data.data) {
          formattedData = data.data;
        }
        
        // Преобразуем поля, если необходимо
        const processedVehicles = Array.isArray(formattedData) ? formattedData.map(vehicle => {
          // Проверяем и преобразуем поля к ожидаемому формату
          return {
            id: vehicle.id,
            name: vehicle.name || 'Без названия',
            garage_number: vehicle.garageNumber || vehicle.garage_number || '-',
            imei: vehicle.imei || '-',
            factory_number: vehicle.factoryNumber || vehicle.factory_number || '-',
            phone: vehicle.phone || '-',
            groups: vehicle.groups || '-',
            last_data: vehicle.lastData || vehicle.last_data || '-',
            status: mapStatusToUI(vehicle.status) || 'Нет данных',
            created_at: vehicle.createdAt || vehicle.created_at || '-',
            type: vehicle.vehicleType || vehicle.type || '-',
            fuel_type: vehicle.fuelType || vehicle.fuel_type || '-',
            fuel_tank_volume: vehicle.fuelTankVolume || vehicle.fuel_tank_volume || '-',
            // Добавляем остальные поля
            ...vehicle
          };
        }) : [];
        
        console.log('Полученные данные ТС:', processedVehicles);
        setVehicles(processedVehicles);
        setIsDataFetched(true);
        // Скрываем индикатор загрузки
        hideLoader();
      })
      .catch(error => {
        console.error('Ошибка при загрузке данных:', error);
        // Скрываем индикатор загрузки
        hideLoader();
        
        // Если API недоступен, загружаем демо-данные
        setTimeout(() => {
          // Показываем индикатор загрузки для демо-данных
          showLoader('Загрузка демонстрационных данных...');
          
          const demoData = [
            {
              id: 1,
              name: 'Самосвал Volvo',
              garage_number: 'СВ-1254',
              imei: '356938035643809',
              factory_number: 'V12345',
              phone: '+7(777)123-45-67',
              groups: 'Строительная техника',
              last_data: '2025-05-02 11:45:23',
              status: 'Готово',
              created_at: '2024-10-15',
              type: 'Самосвал',
              fuel_type: 'Дизель',
              fuel_tank_volume: 400
            },
            {
              id: 2,
              name: 'Экскаватор Caterpillar',
              garage_number: 'ЭК-5678',
              imei: '356938035643810',
              factory_number: 'C98765',
              phone: '+7(777)234-56-78',
              groups: 'Строительная техника',
              last_data: '2025-05-02 12:30:15',
              status: 'В обработке',
              created_at: '2024-09-22',
              type: 'Экскаватор',
              fuel_type: 'Дизель',
              fuel_tank_volume: 300
            },
            {
              id: 3,
              name: 'Бульдозер Komatsu',
              garage_number: 'БД-9012',
              imei: '356938035643811',
              factory_number: 'K54321',
              phone: '+7(777)345-67-89',
              groups: 'Землеройная техника',
              last_data: '2025-05-01 09:15:42',
              status: 'Ошибка',
              created_at: '2024-11-05',
              type: 'Бульдозер',
              fuel_type: 'Дизель',
              fuel_tank_volume: 350
            }
          ];
          setVehicles(demoData);
          setIsDataFetched(true);
          
          // Скрываем индикатор загрузки после небольшой задержки
          setTimeout(() => {
            hideLoader();
          }, 800);
        }, 1000);
      });
  };

  // Функция для преобразования статуса из API в понятный пользователю формат
  const mapStatusToUI = (status) => {
    const statusMap = {
      'ACTIVE': 'Готово',
      'INACTIVE': 'В обработке',
      'ERROR': 'Ошибка',
      'MAINTENANCE': 'На обслуживании',
      'UNKNOWN': 'Неизвестно'
    };
    
    return statusMap[status] || status || 'Нет данных';
  };

  // Функция для получения класса статуса
  const getStatusClass = (status) => {
    switch(status) {
      case 'Готово':
      case 'ACTIVE':
        return 'status-ready';
      case 'В обработке':
      case 'INACTIVE':
        return 'status-processing';
      case 'Ошибка':
      case 'ERROR':
        return 'status-error';
      case 'На обслуживании':
      case 'MAINTENANCE':
        return 'status-maintenance';
      default:
        return 'status-unknown';
    }
  };

  // Обработчик выбора всех строк
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedVehicles(filteredVehicles.map(vehicle => vehicle.id));
    } else {
      setSelectedVehicles([]);
    }
  };

  // Обработчик выбора одной строки
  const handleSelectRow = (id) => {
    if (selectedVehicles.includes(id)) {
      setSelectedVehicles(selectedVehicles.filter(vehicleId => vehicleId !== id));
    } else {
      setSelectedVehicles([...selectedVehicles, id]);
    }
  };

  // Открытие детальной информации о ТС
  const handleViewVehicleDetails = (vehicle) => {
    setSelectedVehicleDetails(vehicle);
    setShowVehicleDetails(true);
  };

  // Обработчик сортировки
  const handleSort = (field) => {
    const direction = field === sortField && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortDirection(direction);
  };

  // Показать диалог подтверждения удаления
  const showDeleteDialog = () => {
    if (selectedVehicles.length > 0) {
      setShowDeleteConfirm(true);
    } else {
      alert('Пожалуйста, выберите транспортные средства для удаления');
    }
  };

  // Функция для получения иконки сортировки
  const getSortIcon = (field) => {
    if (field !== sortField) {
      return <FontAwesomeIcon icon={faSort} />;
    }
    return sortDirection === 'asc' 
      ? <FontAwesomeIcon icon={faSortUp} /> 
      : <FontAwesomeIcon icon={faSortDown} />;
  };

  // Фильтрация транспортных средств по поисковому запросу и фильтрам
  const filteredVehicles = vehicles.filter(vehicle => {
    const matchesSearch = !searchTerm || 
      vehicle.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.garage_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.imei.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || vehicle.status === statusFilter;
    const matchesGroup = groupFilter === 'all' || 
      (vehicle.groups && vehicle.groups.toLowerCase().includes(groupFilter.toLowerCase()));
    
    return matchesSearch && matchesStatus && matchesGroup;
  });

  // Сортировка отфильтрованных транспортных средств
  const sortedVehicles = [...filteredVehicles].sort((a, b) => {
    let aValue = a[sortField] || '';
    let bValue = b[sortField] || '';
    
    // Преобразуем в нижний регистр, если значения строковые
    if (typeof aValue === 'string') aValue = aValue.toLowerCase();
    if (typeof bValue === 'string') bValue = bValue.toLowerCase();
    
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Пагинация отсортированных транспортных средств
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedVehicles = sortedVehicles.slice(startIndex, startIndex + pageSize);
  
  // Обработка контекстного меню
  const handleContextMenu = (e, vehicleId) => {
    e.preventDefault();
    const vehicle = vehicles.find(v => v.id === vehicleId);
    
    if (!vehicle) return;
    
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      vehicleId: vehicleId
    });
  };
  
  // Скрытие контекстного меню
  const handleHideContextMenu = (e) => {
    if (contextMenu.visible && !e.target.closest('.vehicle-context-menu')) {
      setContextMenu({ ...contextMenu, visible: false });
    }
  };
  
  // Обработка клика по пункту контекстного меню
  const handleContextMenuAction = (action) => {
    const vehicle = vehicles.find(v => v.id === contextMenu.vehicleId);
    
    if (!vehicle) return;
    
    switch(action) {
      case 'view':
        handleViewVehicleDetails(vehicle);
        break;
      case 'track':
        console.log('Построить трек для:', vehicle.name);
        // Здесь будет логика построения трека
        break;
      case 'locate':
        console.log('Показать текущее местоположение:', vehicle.name);
        // Здесь будет логика показа местоположения
        break;
      case 'reports':
        console.log('Открыть отчеты для:', vehicle.name);
        // Здесь будет логика открытия отчетов
        break;
      case 'maintenance':
        console.log('Открыть обслуживание для:', vehicle.name);
        // Здесь будет логика обслуживания
        break;
      default:
        break;
    }
    
    setContextMenu({ ...contextMenu, visible: false });
  };

  // Обработчик для кнопки "Профиль ТС"
  const handleVehicleProfile = () => {
    // Проверяем, что выбрано ровно одно ТС
    if (selectedVehicles.length !== 1) {
      console.error('Должно быть выбрано ровно одно ТС для просмотра профиля');
      return;
    }
    
    const vehicleId = selectedVehicles[0];
    const selectedVehicle = vehicles.find(v => v.id === vehicleId);
    
    if (!selectedVehicle) {
      console.error('Выбранное ТС не найдено в списке');
      return;
    }
    
    console.log('Переход на страницу профиля ТС:', selectedVehicle.name);
    
    // Редирект на страницу профиля ТС (используем правильный формат URL)
    window.location.href = `/admin/vehicles/profile?id=${vehicleId}`;
  };

  // Функция для определения доступности кнопок
  const isButtonDisabled = (buttonType) => {
    // Кнопки, которые всегда активны
    const alwaysActiveButtons = [
      'Экспорт списка ТС',
      'Добавить ТС',
      'Обновить'
    ];
    
    // Кнопки, которые деактивируются при выборе более 1 строки
    const maxOneSelectionButtons = [
      'Профиль ТС',
      'Замена терминала'
    ];
    
    if (alwaysActiveButtons.includes(buttonType)) {
      return false;
    }
    
    if (maxOneSelectionButtons.includes(buttonType)) {
      return selectedVehicles.length !== 1;
    }
    
    // Кнопки, активные только когда выбрано хотя бы одно ТС
    const atLeastOneSelectionButtons = [
      'Удалить',
      'Управление группами',
      'Экспорт ТС'
    ];
    
    if (atLeastOneSelectionButtons.includes(buttonType)) {
      return selectedVehicles.length === 0;
    }
    
    // Остальные кнопки активны, если выбрано хотя бы одно ТС
    return selectedVehicles.length === 0;
  };

  // Обработчик добавления нового ТС
  const handleVehicleAdded = (newVehicle) => {
    console.log('Новое ТС добавлено:', newVehicle);
    // Обновляем список ТС
    handleFetchData();
  };

  // Обработчик открытия модального окна управления группами
  const handleManageGroups = () => {
    if (selectedVehicles.length === 0) {
      alert('Пожалуйста, выберите хотя бы одно транспортное средство');
      return;
    }
    setIsManageGroupsModalOpen(true);
  };
  
  // Обработчик обновления групп
  const handleGroupsUpdated = () => {
    // Обновляем список транспортных средств после изменения групп
    handleFetchData();
  };

  // Функция для показа уведомлений через встроенный alert
  const showNotification = (message, type) => {
    if (type === 'error') {
      alert(`Ошибка: ${message}`);
    } else {
      alert(message);
    }
  };

  // Функция для удаления транспортных средств
  const handleDeleteVehicles = async () => {
    if (selectedVehicles.length === 0) {
      showNotification('Не выбрано ни одно транспортное средство для удаления', 'error');
      return;
    }

    try {
      // Получаем JWT токен из localStorage
      const token = localStorage.getItem('access_token');
      
      // Показываем уведомление о начале процесса удаления
      showLoader(`Удаление ${selectedVehicles.length} транспортных средств...`);
      
      // Создаем массив промисов для удаления каждого ТС
      const deletePromises = selectedVehicles.map(async (vehicleId) => {
        console.log(`Удаление ТС с ID: ${vehicleId}`);
        
        // Отправляем DELETE запрос на удаление ТС
        const deleteResponse = await fetch(`https://185.234.114.212:8443/api/vehicles/${vehicleId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
          }
        });
        
        if (!deleteResponse.ok) {
          throw new Error(`Ошибка удаления ТС ${vehicleId}: ${deleteResponse.status}`);
        }
        
        // Для DELETE запросов часто возвращается пустое тело ответа
        // Но если сервер возвращает данные, можно их обработать
        let result;
        try {
          const text = await deleteResponse.text();
          result = text ? JSON.parse(text) : { success: true, id: vehicleId };
        } catch (e) {
          result = { success: true, id: vehicleId };
        }
        
        console.log(`Результат удаления ТС ${vehicleId}:`, result);
        return result;
      });
      
      // Ждем завершения всех запросов
      await Promise.all(deletePromises);
      
      console.log('Все выбранные ТС успешно удалены');
      
      // Скрываем индикатор загрузки
      hideLoader();
      
      // Обновляем список ТС после удаления
      handleFetchData();
      
      // Закрываем модальное окно подтверждения
      setShowDeleteConfirm(false);
      
      // Очищаем список выбранных ТС
      setSelectedVehicles([]);
      
      // Показываем уведомление об успешном удалении
      showNotification(`Успешно удалено ${selectedVehicles.length} транспортных средств`, 'success');
    } catch (error) {
      console.error('Ошибка при удалении ТС:', error);
      
      // Скрываем индикатор загрузки
      hideLoader();
      
      // Показываем уведомление об ошибке
      showNotification(error.message || 'Не удалось удалить транспортные средства', 'error');
    }
  };

  // Функция для экспорта выбранных ТС
  const handleExportVehicles = () => {
    if (selectedVehicles.length === 0) {
      showNotification('Не выбрано ни одно транспортное средство для экспорта', 'error');
      return;
    }
    
    // Показываем модальное окно выбора формата экспорта
    setShowExportModal(true);
  };
  
  // Функция для выполнения экспорта в выбранном формате
  const executeExport = () => {
    try {
      // Показываем уведомление о начале процесса
      showLoader('Подготовка данных для экспорта...');
      
      // Фильтруем только выбранные ТС
      const selectedVehiclesData = vehicles.filter(vehicle => selectedVehicles.includes(vehicle.id));
      
      // Подготавливаем данные для экспорта
      const exportData = prepareVehiclesForExport(selectedVehiclesData, true);
      
      // Формируем часть имени файла с датой
      const dateString = new Date().toISOString().slice(0, 10);
      
      if (exportFormat === 'json') {
        // Экспортируем данные в JSON
        exportJSON(exportData, `vehicles_export_${dateString}`);
        showNotification(`Успешно экспортировано ${selectedVehicles.length} ТС в формате JSON`, 'success');
      } else if (exportFormat === 'csv') {
        // Определяем поля для экспорта
        const exportFields = [
          'id',
          'name',
          'garage_number',
          'imei',
          'factory_number',
          'phone',
          'groups',
          'type',
          'status',
          'last_data',
          'created_at'
        ];
        
        // Преобразуем данные в CSV
        const csvData = convertVehiclesToCSV(exportData, exportFields);
        
        // Экспортируем данные в CSV
        exportCSV(csvData, `vehicles_export_${dateString}`);
        showNotification(`Успешно экспортировано ${selectedVehicles.length} ТС в формате CSV`, 'success');
      }
      
      // Закрываем модальное окно
      setShowExportModal(false);
      
      // Скрываем индикатор загрузки
      hideLoader();
    } catch (error) {
      console.error('Ошибка при экспорте ТС:', error);
      
      // Скрываем индикатор загрузки
      hideLoader();
      
      // Показываем уведомление об ошибке
      showNotification(error.message || 'Не удалось экспортировать транспортные средства', 'error');
      
      // Закрываем модальное окно
      setShowExportModal(false);
    }
  };

  // Функция для экспорта списка всех ТС в CSV
  const handleExportVehiclesList = () => {
    try {
      // Показываем уведомление о начале процесса
      showLoader('Подготовка списка для экспорта...');
      
      // Определяем поля для экспорта списка
      const exportFields = [
        'id',
        'name',
        'garage_number',
        'imei',
        'factory_number',
        'phone',
        'groups',
        'type',
        'status',
        'last_data',
        'created_at'
      ];
      
      // Подготавливаем данные для экспорта
      const exportData = prepareVehiclesForExport(vehicles, true);
      
      // Преобразуем данные в CSV
      const csvData = convertVehiclesToCSV(exportData, exportFields);
      
      // Экспортируем данные в CSV
      exportCSV(csvData, `vehicles_list_${new Date().toISOString().slice(0, 10)}`);
      
      // Скрываем индикатор загрузки
      hideLoader();
      
      // Показываем уведомление об успешном экспорте
      showNotification(`Успешно экспортирован список из ${vehicles.length} транспортных средств`, 'success');
    } catch (error) {
      console.error('Ошибка при экспорте списка ТС:', error);
      
      // Скрываем индикатор загрузки
      hideLoader();
      
      // Показываем уведомление об ошибке
      showNotification(error.message || 'Не удалось экспортировать список транспортных средств', 'error');
    }
  };

  // Рендер компонента
  return (
    <div className={`vehicles-page ${compactMode ? 'compact-mode' : ''}`}>
      {/* Боковое меню */}
      <Sidebar />
      
      {/* Основной контент */}
      <div className="main-content">
      
        <div className="top-controls">
          <div className="left-controls">
            {/* <button className="control-button menu-toggle" onClick={handleToggleSidebar}>
              <FontAwesomeIcon icon={faBars} />
            </button> */}
            <button className="control-button refresh" onClick={handleFetchData}>
              <FontAwesomeIcon icon={faSync} />
            </button>
            <button 
              className="control-button" 
              disabled={isButtonDisabled('Профиль ТС')}
              onClick={handleVehicleProfile}
            >
              <FontAwesomeIcon icon={faDatabase} /> <span>Профиль ТС</span>
            </button>
            <button 
              className="control-button" 
              onClick={() => setIsAddVehicleModalOpen(true)}
            >
              <FontAwesomeIcon icon={faPlus} /> <span>Добавить ТС</span>
            </button>
            <button 
              className="control-button"
              disabled={isButtonDisabled('Пересчет данных')}
            >
              <FontAwesomeIcon icon={faSync} /> <span>Пересчет данных</span>
            </button>
            <button 
              className="control-button"
              disabled={isButtonDisabled('Выключить прием данных')}
            >
              <FontAwesomeIcon icon={faPowerOff} /> <span>Выключить прием данных</span>
            </button>
            <button 
              className="control-button"
              disabled={isButtonDisabled('Управление группами')}
              onClick={handleManageGroups}
            >
              <FontAwesomeIcon icon={faFolderOpen} /> <span>Управление группами</span>
            </button>
            <button 
              className="control-button"
              disabled={isButtonDisabled('Экспорт ТС')}
              onClick={handleExportVehicles}
            >
              <FontAwesomeIcon icon={faFileExport} /> <span>Экспорт ТС</span>
            </button>
            <button 
              className="control-button"
              disabled={isButtonDisabled('Замена терминала')}
            >
              <FontAwesomeIcon icon={faExchangeAlt} /> <span>Замена терминала</span>
            </button>
            <button 
              className="control-button" 
              onClick={showDeleteDialog}
              disabled={isButtonDisabled('Удалить')}
            >
              <FontAwesomeIcon icon={faTrash} /> <span>Удалить</span>
            </button>

            
            <button 
              className="control-button" 
              onClick={handleExportVehiclesList}
            >
              <FontAwesomeIcon icon={faFileDownload} /> <span>Экспорт списка ТС</span>
            </button>
            
          </div>
          
          <div className="right-controls">
            <div className="search-container">
              <input 
                type="text" 
                className="search-input" 
                placeholder="Поиск по названию, гаражному номеру или IMEI..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button className="search-button">
                <FontAwesomeIcon icon={faSearch} />
              </button>
            </div>
          </div>
        </div>
        
        <div className="filters">
          <div className="filter-group">
            <label>Группы:</label>
            <select 
              value={groupFilter} 
              onChange={(e) => setGroupFilter(e.target.value)}
            >
              <option value="all">Все</option>
              <option value="Грузовые">Грузовые</option>
              <option value="Землеройная техника">Землеройная техника</option>
              <option value="Строительная техника">Строительная техника</option>
              <option value="Дальнобойщики">Дальнобойщики</option>
              <option value="Самосвалы">Самосвалы</option>
              <option value="Международные">Международные</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Состояние:</label>
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Все</option>
              <option value="Готово">Готово</option>
              <option value="В обработке">В обработке</option>
              <option value="Ошибка">Ошибка</option>
              <option value="На обслуживании">На обслуживании</option>
            </select>
          </div>
        </div>
        
        <div className="vehicles-table-container">
          {!isDataFetched && vehicles.length === 0 && (
            <div className="no-data">
              Данные не загружены. Нажмите Обновить, чтобы загрузить список ТС
            </div>
          )}
          
          {isDataFetched && vehicles.length === 0 && (
            <div className="no-data">
              Транспортные средства не найдены. Попробуйте изменить параметры фильтра
            </div>
          )}
          
          {vehicles.length > 0 && (
            <>
              <div className="vehicles-table">
                <table>
                  <thead>
                    <tr>
                      <th width="30">
                        <input 
                          type="checkbox" 
                          onChange={handleSelectAll}
                          checked={selectedVehicles.length === filteredVehicles.length && filteredVehicles.length > 0}
                        />
                      </th>
                      <th width="30">#</th>
                      <th className={`sortable ${sortField === 'name' ? `sort-${sortDirection}` : ''}`} onClick={() => handleSort('name')}>
                        Название {getSortIcon('name')}
                      </th>
                      <th className={`sortable ${sortField === 'garage_number' ? `sort-${sortDirection}` : ''}`} onClick={() => handleSort('garage_number')}>
                        Гаражный номер {getSortIcon('garage_number')}
                      </th>
                      <th className={`sortable ${sortField === 'imei' ? `sort-${sortDirection}` : ''}`} onClick={() => handleSort('imei')}>
                        IMEI {getSortIcon('imei')}
                      </th>
                      <th className={`sortable ${sortField === 'id' ? `sort-${sortDirection}` : ''}`} onClick={() => handleSort('id')}>
                        ID {getSortIcon('id')}
                      </th>
                      <th className={`sortable ${sortField === 'factory_number' ? `sort-${sortDirection}` : ''}`} onClick={() => handleSort('factory_number')}>
                        Заводской номер {getSortIcon('factory_number')}
                      </th>
                      <th className={`sortable ${sortField === 'phone' ? `sort-${sortDirection}` : ''}`} onClick={() => handleSort('phone')}>
                        Телефон {getSortIcon('phone')}
                      </th>
                      <th className={`sortable ${sortField === 'groups' ? `sort-${sortDirection}` : ''}`} onClick={() => handleSort('groups')}>
                        Группы {getSortIcon('groups')}
                      </th>
                      <th className={`sortable ${sortField === 'last_data' ? `sort-${sortDirection}` : ''}`} onClick={() => handleSort('last_data')}>
                        Последние данные {getSortIcon('last_data')}
                      </th>
                      <th className={`sortable ${sortField === 'created_at' ? `sort-${sortDirection}` : ''}`} onClick={() => handleSort('created_at')}>
                        Дата создания {getSortIcon('created_at')}
                      </th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedVehicles.length > 0 ? (
                      paginatedVehicles.map((vehicle, index) => (
                        <tr 
                          key={vehicle.id} 
                          className={selectedVehicles.includes(vehicle.id) ? 'selected' : ''}
                          onClick={() => handleSelectRow(vehicle.id)}
                          data-vehicle-id={vehicle.id}
                          onContextMenu={(e) => handleContextMenu(e, vehicle.id)}
                        >
                          <td onClick={(e) => e.stopPropagation()}>
                            <input 
                              type="checkbox" 
                              checked={selectedVehicles.includes(vehicle.id)}
                              onChange={() => handleSelectRow(vehicle.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td>{(currentPage - 1) * pageSize + index + 1}</td>
                          <td>{vehicle.name}</td>
                          <td>{vehicle.garage_number}</td>
                          <td>{vehicle.imei}</td>
                          <td>{vehicle.id}</td>
                          <td>{vehicle.factory_number}</td>
                          <td>{vehicle.phone}</td>
                          <td>{vehicle.groups}</td>
                          <td className={getStatusClass(vehicle.status)}>
                            {vehicle.last_data} {vehicle.status || 'Нет данных'}
                          </td>
                          <td>{vehicle.created_at}</td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <button 
                              className="action-button info" 
                              title="Просмотр"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewVehicleDetails(vehicle);
                              }}
                            >
                              <FontAwesomeIcon icon={faEye} />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="12" className="no-data">
                          {isDataFetched ? 'Нет данных, соответствующих фильтрам' : 'Данные не загружены'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {paginatedVehicles.length > 0 && (
                <div className="pagination">
                  <div className="page-info">
                    <span>
                      Показано {(currentPage - 1) * pageSize + 1}-
                      {Math.min(currentPage * pageSize, sortedVehicles.length)} из {sortedVehicles.length}
                    </span>
                    <select 
                      className="page-size" 
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                    >
                      <option value={100}>100</option>
                      <option value={50}>50</option>
                      <option value={25}>25</option>
                    </select>
                  </div>
                  
                  <div className="page-controls">
                    <button 
                      onClick={() => setCurrentPage(1)} 
                      disabled={currentPage === 1}
                    >
                      <FontAwesomeIcon icon={faChevronLeft} />
                      <FontAwesomeIcon icon={faChevronLeft} />
                    </button>
                    <button 
                      onClick={() => setCurrentPage(currentPage - 1)} 
                      disabled={currentPage === 1}
                    >
                      <FontAwesomeIcon icon={faChevronLeft} />
                    </button>
                    
                    {/* Отображение номеров страниц */}
                    {Array.from({ length: Math.min(5, Math.ceil(sortedVehicles.length / pageSize)) }, (_, i) => {
                      const pageNum = i + 1;
                      return (
                        <button 
                          key={pageNum}
                          className={currentPage === pageNum ? 'active' : ''}
                          onClick={() => setCurrentPage(pageNum)}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    
                    <button 
                      onClick={() => setCurrentPage(currentPage + 1)} 
                      disabled={currentPage === Math.ceil(sortedVehicles.length / pageSize)}
                    >
                      <FontAwesomeIcon icon={faChevronRight} />
                    </button>
                    <button 
                      onClick={() => setCurrentPage(Math.ceil(sortedVehicles.length / pageSize))} 
                      disabled={currentPage === Math.ceil(sortedVehicles.length / pageSize)}
                    >
                      <FontAwesomeIcon icon={faChevronRight} />
                      <FontAwesomeIcon icon={faChevronRight} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Модальное окно подтверждения удаления */}
        {showDeleteConfirm && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h2>Подтверждение удаления</h2>
                <span className="close" onClick={() => setShowDeleteConfirm(false)}>&times;</span>
              </div>
              <div className="modal-body">
                <div className="delete-info">
                  <FontAwesomeIcon icon={faExclamationTriangle} className="warning-icon" />
                  <p>Вы действительно хотите удалить выбранные транспортные средства ({selectedVehicles.length})?</p>
                  <div className="delete-vehicles-list">
                    {selectedVehicles.map(id => {
                      const vehicle = vehicles.find(v => v.id === id);
                      return vehicle ? (
                        <div key={id} className="delete-vehicle-item">
                          <strong>{vehicle.name}</strong> (Гаражный номер: {vehicle.garage_number})
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
                <div className="form-actions">
                  <button 
                    className="btn btn-danger" 
                    onClick={handleDeleteVehicles}
                  >
                    <FontAwesomeIcon icon={faTrash} /> <span>Удалить</span>
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    <span>Отмена</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Модальное окно просмотра детальной информации о ТС */}
        {showVehicleDetails && selectedVehicleDetails && (
          <div className="modal-overlay">
            <div className="modal-content vehicle-details-modal">
              <div className="modal-header">
                <h2>Детальная информация о ТС</h2>
                <span className="close" onClick={() => setShowVehicleDetails(false)}>&times;</span>
              </div>
              <div className="modal-body">
                <div className="vehicle-details-header">
                  <div className="vehicle-title">
                    <FontAwesomeIcon icon={faTruck} className="vehicle-icon" />
                    <h3>{selectedVehicleDetails.name}</h3>
                  </div>
                  <div className={`vehicle-status ${getStatusClass(selectedVehicleDetails.status)}`}>
                    {selectedVehicleDetails.status}
                  </div>
                </div>
                
                <div className="vehicle-details-content">
                  <div className="details-section">
                    <h4>Основная информация</h4>
                    <div className="details-grid">
                      <div className="detail-item">
                        <div className="detail-label">ID:</div>
                        <div className="detail-value">{selectedVehicleDetails.id}</div>
                      </div>
                      <div className="detail-item">
                        <div className="detail-label">Гаражный номер:</div>
                        <div className="detail-value">{selectedVehicleDetails.garage_number}</div>
                      </div>
                      <div className="detail-item">
                        <div className="detail-label">Заводской номер:</div>
                        <div className="detail-value">{selectedVehicleDetails.factory_number}</div>
                      </div>
                      <div className="detail-item">
                        <div className="detail-label">Тип ТС:</div>
                        <div className="detail-value">{selectedVehicleDetails.type}</div>
                      </div>
                      <div className="detail-item">
                        <div className="detail-label">Группы:</div>
                        <div className="detail-value">{selectedVehicleDetails.groups}</div>
                      </div>
                      <div className="detail-item">
                        <div className="detail-label">Дата создания:</div>
                        <div className="detail-value">{selectedVehicleDetails.created_at}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="details-section">
                    <h4>Телематика</h4>
                    <div className="details-grid">
                      <div className="detail-item">
                        <div className="detail-label">IMEI:</div>
                        <div className="detail-value">{selectedVehicleDetails.imei}</div>
                      </div>
                      <div className="detail-item">
                        <div className="detail-label">Телефон:</div>
                        <div className="detail-value">{selectedVehicleDetails.phone}</div>
                      </div>
                      <div className="detail-item">
                        <div className="detail-label">Терминал:</div>
                        <div className="detail-value">{selectedVehicleDetails.terminal || '-'}</div>
                      </div>
                      <div className="detail-item">
                        <div className="detail-label">Последние данные:</div>
                        <div className="detail-value">{selectedVehicleDetails.last_data}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="details-section">
                    <h4>Топливная система</h4>
                    <div className="details-grid">
                      <div className="detail-item">
                        <div className="detail-label">Тип топлива:</div>
                        <div className="detail-value">{selectedVehicleDetails.fuel_type}</div>
                      </div>
                      <div className="detail-item">
                        <div className="detail-label">Объем бака:</div>
                        <div className="detail-value">{selectedVehicleDetails.fuel_tank_volume} л</div>
                      </div>
                      <div className="detail-item">
                        <div className="detail-label">Моточасы:</div>
                        <div className="detail-value">{selectedVehicleDetails.engineHours || '-'}</div>
                      </div>
                      <div className="detail-item">
                        <div className="detail-label">Пробег:</div>
                        <div className="detail-value">{selectedVehicleDetails.mileage ? `${selectedVehicleDetails.mileage} км` : '-'}</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="details-actions">
                  <button className="btn btn-primary">
                    <FontAwesomeIcon icon={faRoute} /> <span>Построить трек</span>
                  </button>
                  <button className="btn btn-secondary">
                    <FontAwesomeIcon icon={faEdit} /> <span>Редактировать</span>
                  </button>
                  <button className="btn btn-info">
                    <FontAwesomeIcon icon={faMapMarkerAlt} /> <span>Текущее положение</span>
                  </button>
                  <button className="btn btn-secondary" onClick={() => setShowVehicleDetails(false)}>
                    <span>Закрыть</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Модальное окно для выбора формата экспорта */}
        {showExportModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h2>Формат экспорта</h2>
                <span className="close" onClick={() => setShowExportModal(false)}>&times;</span>
              </div>
              <div className="modal-body">
                <div className="export-options">
                  <p>Выберите формат для экспорта {selectedVehicles.length} транспортных средств:</p>
                  
                  <div className="export-format-options">
                    <div className="export-format-option">
                      <input 
                        type="radio" 
                        id="json-format" 
                        name="export-format" 
                        value="json" 
                        checked={exportFormat === 'json'} 
                        onChange={() => setExportFormat('json')}
                      />
                      <label htmlFor="json-format">
                        <strong>JSON</strong> - Полные данные в формате JSON
                      </label>
                    </div>
                    
                    <div className="export-format-option">
                      <input 
                        type="radio" 
                        id="csv-format" 
                        name="export-format" 
                        value="csv" 
                        checked={exportFormat === 'csv'} 
                        onChange={() => setExportFormat('csv')}
                      />
                      <label htmlFor="csv-format">
                        <strong>CSV</strong> - Таблица для Excel или других программ
                      </label>
                    </div>
                  </div>
                </div>
                
                <div className="form-actions">
                  <button 
                    className="btn btn-primary" 
                    onClick={executeExport}
                  >
                    <FontAwesomeIcon icon={faFileExport} /> <span>Экспортировать</span>
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setShowExportModal(false)}
                  >
                    <span>Отмена</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Модальное окно для добавления транспортного средства */}
        <AddVehicleModal
          isOpen={isAddVehicleModalOpen}
          onClose={() => setIsAddVehicleModalOpen(false)}
          onVehicleAdded={handleVehicleAdded}
        />
        
        {/* Модальное окно управления группами */}
        <ManageGroupsModal
          isOpen={isManageGroupsModalOpen}
          onClose={() => setIsManageGroupsModalOpen(false)}
          selectedVehicleIds={selectedVehicles}
          onGroupsUpdated={handleGroupsUpdated}
        />
        
        {/* Контекстное меню для ТС */}
        {contextMenu.visible && (
          <div className="vehicle-context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
            <div className="context-menu-header">
              {vehicles.find(v => v.id === contextMenu.vehicleId)?.name || 'Транспортное средство'}
            </div>
            <ul className="context-menu-options">
              <li onClick={() => handleContextMenuAction('view')}>
                <FontAwesomeIcon icon={faEye} /> Просмотр деталей
              </li>
              <li onClick={() => handleContextMenuAction('track')}>
                <FontAwesomeIcon icon={faRoute} /> Построить трек
              </li>
              <li onClick={() => handleContextMenuAction('locate')}>
                <FontAwesomeIcon icon={faMapMarkerAlt} /> Текущее положение
              </li>
              <li onClick={() => handleContextMenuAction('reports')}>
                <FontAwesomeIcon icon={faClipboardList} /> Отчеты
              </li>
              <li onClick={() => handleContextMenuAction('maintenance')}>
                <FontAwesomeIcon icon={faTools} /> Обслуживание
              </li>
            </ul>
          </div>
        )}
        
        {/* Сообщения для пользователя */}
        <div className="flash-messages">
          {/* Здесь будут отображаться уведомления */}
        </div>
      </div>
    </div>
  );
};

export default VehiclesPage; 