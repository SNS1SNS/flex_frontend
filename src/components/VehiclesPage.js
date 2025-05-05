import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBars, faFilter, faPlus, faDownload, faTruck, faSearch,
  faSync, faCog, faEdit, faTrash, faEye, faDatabase, faCompress, faExpand,
  faSort, faSortUp, faSortDown, faChevronLeft, faChevronRight, faExclamationTriangle,
  faInfoCircle, faRoute, faGasPump, faCalendarAlt, faMapMarkerAlt, faClipboardList,
  faTrackingDot, faHistory, faMapPin, faTools, faPowerOff, faFolderOpen, faFileExport, faFileDownload, faExchangeAlt
} from '@fortawesome/free-solid-svg-icons';
import './VehiclesPage.css';
import { useUser } from '../context/UserContext';
import { useSidebar } from '../context/SidebarContext';
import { apiService } from '../services';
import { useLoading } from '../context/LoadingContext';

/**
 * Компонент страницы с транспортными средствами
 */
const VehiclesPage = () => {
  // Получаем доступ к глобальному индикатору загрузки
  const { showLoader, hideLoader } = useLoading();
  
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [isDataFetched, setIsDataFetched] = useState(false);
  const [selectedVehicles, setSelectedVehicles] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [showVehicleDetails, setShowVehicleDetails] = useState(false);
  const [selectedVehicleDetails, setSelectedVehicleDetails] = useState(null);

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
  
  // Получаем данные пользователя из контекста
  const { user } = useUser();
  // Получаем функции для работы с боковым меню
  const { toggleSidebar, toggleCompactMode, compactMode } = useSidebar();
  
  // Обработчик переключения бокового меню
  const handleToggleSidebar = (e) => {
    e.preventDefault();
    toggleSidebar();
  };

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
    setLoading(true);
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
        setLoading(false);
        // Скрываем индикатор загрузки
        hideLoader();
      })
      .catch(error => {
        console.error('Ошибка при загрузке данных:', error);
        setLoading(false);
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
          setLoading(false);
          
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

  // Функция для очистки данных
  const handleClearData = () => {
    setVehicles([]);
    setIsDataFetched(false);
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
    
    // Кнопка удаления - активна только когда выбрано хотя бы одно ТС
    if (buttonType === 'Удалить') {
      return selectedVehicles.length === 0;
    }
    
    // Остальные кнопки активны, если выбрано хотя бы одно ТС
    return selectedVehicles.length === 0;
  };

  // Рендер компонента
  return (
    <div className="vehicles-layout">
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
            >
              <FontAwesomeIcon icon={faDatabase} /> <span>Профиль ТС</span>
            </button>
            <button 
              className="control-button" 
              onClick={() => setShowAddVehicleModal(true)}
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
            >
              <FontAwesomeIcon icon={faFolderOpen} /> <span>Управление группами</span>
            </button>
            <button 
              className="control-button"
              disabled={isButtonDisabled('Экспорт ТС')}
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

            
            <button className="control-button">
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
              Данные не загружены. Нажмите "Обновить", чтобы загрузить список ТС
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
                    onClick={() => {
                      // Здесь будет логика удаления
                      console.log('Удаление ТС:', selectedVehicles);
                      setShowDeleteConfirm(false);
                      setSelectedVehicles([]);
                    }}
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