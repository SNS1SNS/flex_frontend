import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBars, faPlus, faSearch,
  faSync, faEdit, faTrash, faEye, faUserAlt,
  faSort, faSortUp, faSortDown, faChevronLeft, faChevronRight, faExclamationTriangle,
  faLock, faUnlock
} from '@fortawesome/free-solid-svg-icons';
import './VehiclesPage.css'; // Используем те же стили
import { useUser } from '../context/UserContext';
import { useSidebar } from '../context/SidebarContext';
import { apiService } from '../services';
import { useLoading } from '../context/LoadingContext';

/**
 * Компонент страницы с водителями
 */
const DriversPage = () => {
  // Получаем доступ к глобальному индикатору загрузки
  const { showLoader, hideLoader } = useLoading();
  
  const [loading, setLoading] = useState(false);
  const [drivers, setDrivers] = useState([]);
  const [isDataFetched, setIsDataFetched] = useState(false);
  const [selectedDrivers, setSelectedDrivers] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddDriverModal, setShowAddDriverModal] = useState(false);
  const [showDriverDetails, setShowDriverDetails] = useState(false);
  const [selectedDriverDetails, setSelectedDriverDetails] = useState(null);

  // Состояния для фильтров и поиска
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Все');
  const [groupFilter, setGroupFilter] = useState('Все');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');

  // Получаем данные пользователя из контекста
  const { user } = useUser();
  // Получаем функции для работы с боковым меню
  const { toggleSidebar, compactMode } = useSidebar();
  
  // Состояние для контекстного меню
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    driverId: null
  });

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
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

  // Функция для загрузки данных с сервера
  const handleFetchData = () => {
    setLoading(true);
    // Показываем индикатор загрузки с глобальным контекстом
    showLoader('Загрузка списка водителей...');
    
    // Используем apiService вместо прямого fetch
    apiService.getDrivers()
      .then(data => {
        // Обработка полученных данных
        let formattedData = data;
        // Проверяем, нужно ли сначала извлечь данные из ответа
        if (data && data.data) {
          formattedData = data.data;
        }
        
        // Преобразуем поля, если необходимо
        const processedDrivers = Array.isArray(formattedData) ? formattedData.map(driver => {
          // Проверяем и преобразуем поля к ожидаемому формату
          return {
            id: driver.id,
            firstName: driver.firstName || 'Без имени',
            lastName: driver.lastName || 'Без фамилии',
            middleName: driver.middleName || '-',
            phone: driver.phone || '-',
            employmentDate: driver.employmentDate || '-',
            userGroup: driver.userGroup || '-',
            status: driver.status || 'Активный',
            birthDate: driver.birthDate || '-',
            ...driver
          };
        }) : [];
        
        console.log('Полученные данные водителей:', processedDrivers);
        setDrivers(processedDrivers);
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
              name: "Nursultan",
              surname: "Sarymov",
              patronymic: "Sarymovich",
              phone: "+77079621630",
              employmentDate: "А",
              group: "",
              status: "Активный",
              startDate: "31.03.2025"
            },
            {
              id: 2,
              name: "Иван",
              surname: "Петров",
              patronymic: "Сергеевич",
              phone: "+7 (999) 123-45-67",
              employmentDate: "В",
              group: "Логистика",
              status: "Активный",
              startDate: "15.03.2022"
            },
            {
              id: 3,
              name: "Алексей",
              surname: "Иванов",
              patronymic: "Дмитриевич",
              phone: "+77079621629",
              employmentDate: "А",
              group: "Дальнобойщики",
              status: "Активный",
              startDate: "17.04.2025"
            }
          ];
          setDrivers(demoData);
          setIsDataFetched(true);
          setLoading(false);
          
          // Скрываем индикатор загрузки после небольшой задержки
          setTimeout(() => {
            hideLoader();
          }, 800);
        }, 1000);
      });
  };

  // Функция для получения класса статуса
  const getStatusClass = (status) => {
    switch (status.toLowerCase()) {
      case 'активный':
        return 'status-ready';
      case 'заблокирован':
        return 'status-error';
      case 'в отпуске':
        return 'status-processing';
      case 'уволен':
        return 'status-maintenance';
      default:
        return 'status-unknown';
    }
  };

  // Обработчик выбора всех строк
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allDriverIds = filteredDrivers.map(driver => driver.id);
      setSelectedDrivers(allDriverIds);
    } else {
      setSelectedDrivers([]);
    }
  };

  // Обработчик выбора одной строки
  const handleSelectRow = (id) => {
    if (selectedDrivers.includes(id)) {
      setSelectedDrivers(selectedDrivers.filter(driverId => driverId !== id));
    } else {
      setSelectedDrivers([...selectedDrivers, id]);
    }
  };

  // Обработчик просмотра деталей водителя
  const handleViewDriverDetails = (driver) => {
    setSelectedDriverDetails(driver);
    setShowDriverDetails(true);
  };

  // Обработчик сортировки
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Показать диалог удаления
  const showDeleteDialog = () => {
    setShowDeleteConfirm(true);
  };

  // Получить иконку сортировки
  const getSortIcon = (field) => {
    if (sortField !== field) {
      return <FontAwesomeIcon icon={faSort} />;
    }
    return sortDirection === 'asc' 
      ? <FontAwesomeIcon icon={faSortUp} className="sort-asc" /> 
      : <FontAwesomeIcon icon={faSortDown} className="sort-desc" />;
  };

  // Обработчик контекстного меню
  const handleContextMenu = (e, driverId) => {
    e.preventDefault();
    
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      driverId
    });
  };

  // Обработчик скрытия контекстного меню
  const handleHideContextMenu = () => {
    setContextMenu({
      ...contextMenu,
      visible: false
    });
  };

  // Обработчик действий контекстного меню
  const handleContextMenuAction = (action) => {
    const driverId = contextMenu.driverId;
    const driver = drivers.find(d => d.id === driverId);
    
    if (!driver) return;
    
    switch(action) {
      case 'profile':
        handleViewDriverDetails(driver);
        break;
      case 'edit':
        console.log('Редактировать водителя:', driver.firstName);
        break;
      case 'block':
        console.log('Заблокировать водителя:', driver.firstName);
        break;
      case 'delete':
        console.log('Удалить водителя:', driver.firstName);
        setSelectedDrivers([driver.id]);
        showDeleteDialog();
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
      'Добавить водителя',
      'Обновить'
    ];
    
    // Кнопки, которые требуют выбора ровно одной строки
    const oneSelectionButtons = [
      'Профиль водителя',
      'Редактировать'
    ];
    
    if (alwaysActiveButtons.includes(buttonType)) {
      return false;
    }
    
    if (oneSelectionButtons.includes(buttonType)) {
      return selectedDrivers.length !== 1;
    }
    
    // Остальные кнопки активны, если выбрано хотя бы одно ТС
    return selectedDrivers.length === 0;
  };

  // Фильтрация водителей
  const filteredDrivers = drivers.filter(driver => {
    // Поиск по имени, фамилии, отчеству или телефону
    const matchesSearch = searchTerm === '' || 
      (driver.firstName && driver.firstName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (driver.lastName && driver.lastName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (driver.middleName && driver.middleName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (driver.phone && driver.phone.includes(searchTerm));
      
    // Фильтр по статусу
    const matchesStatus = statusFilter === 'Все' || 
      (driver.status && driver.status === statusFilter);
      
    // Фильтр по группе
    const matchesGroup = groupFilter === 'Все' || 
      (driver.userGroup && driver.userGroup === groupFilter);
      
    return matchesSearch && matchesStatus && matchesGroup;
  });

  // Сортировка водителей
  const sortedDrivers = [...filteredDrivers].sort((a, b) => {
    const fieldA = a[sortField] || '';
    const fieldB = b[sortField] || '';
    
    const compareResult = 
      typeof fieldA === 'string' && typeof fieldB === 'string'
        ? fieldA.localeCompare(fieldB)
        : fieldA - fieldB;
        
    return sortDirection === 'asc' ? compareResult : -compareResult;
  });

  // Пагинация
  const totalPages = Math.ceil(sortedDrivers.length / pageSize);
  const paginatedDrivers = sortedDrivers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Рендер компонента
  return (
    <div className="vehicles-layout">
      {/* Боковое меню */}
      <Sidebar />
      
      {/* Основной контент */}
      <div className="main-content">
      
        <div className="top-controls">
          <div className="left-controls">
            <button className="control-button refresh" onClick={handleFetchData}>
              <FontAwesomeIcon icon={faSync} />
            </button>
            <button 
              className="control-button" 
              disabled={isButtonDisabled('Профиль водителя')}
            >
              <FontAwesomeIcon icon={faUserAlt} /> <span>Профиль водителя</span>
            </button>
            <button 
              className="control-button" 
              onClick={() => setShowAddDriverModal(true)}
            >
              <FontAwesomeIcon icon={faPlus} /> <span>Добавить водителя</span>
            </button>
            <button 
              className="control-button"
              disabled={isButtonDisabled('Редактировать')}
              onClick={() => {
                if (selectedDrivers.length === 1) {
                  const driver = drivers.find(d => d.id === selectedDrivers[0]);
                  if (driver) {
                    console.log('Редактирование водителя:', driver);
                    // Здесь будет логика открытия модального окна редактирования
                  }
                }
              }}
            >
              <FontAwesomeIcon icon={faEdit} /> <span>Редактировать</span>
            </button>
            <button 
              className="control-button"
              disabled={isButtonDisabled('Заблокировать')}
              onClick={() => {
                if (selectedDrivers.length > 0) {
                  // Получаем водителя для проверки статуса
                  const driver = drivers.find(d => d.id === selectedDrivers[0]);
                  const newStatus = driver && driver.status === 'Активный' ? 'Заблокирован' : 'Активный';
                  const actionText = newStatus === 'Заблокирован' ? 'блокировки' : 'разблокировки';
                  
                  if (window.confirm(`Вы уверены, что хотите выполнить операцию ${actionText} для выбранных водителей?`)) {
                    const updatePromises = selectedDrivers.map(id => {
                      // Находим водителя, чтобы сохранить все его данные
                      const driverToUpdate = drivers.find(d => d.id === id);
                      if (!driverToUpdate) return Promise.resolve();
                      
                      // Создаем обновленные данные
                      const updatedDriver = { ...driverToUpdate, status: newStatus };
                      
                      // Отправляем запрос на обновление
                      return apiService.updateDriver(id, updatedDriver)
                        .then(() => console.log(`Статус водителя с ID ${id} изменен на ${newStatus}`))
                        .catch(error => console.error(`Ошибка при обновлении статуса водителя с ID ${id}:`, error));
                    });
                    
                    Promise.all(updatePromises)
                      .then(() => {
                        // Обновляем список после обновления
                        handleFetchData();
                        setSelectedDrivers([]);
                      })
                      .catch(error => {
                        console.error('Ошибка при обновлении статусов водителей:', error);
                      });
                  }
                }
              }}
            >
              <FontAwesomeIcon icon={faLock} /> <span>Заблокировать</span>
            </button>
            <button 
              className="control-button" 
              onClick={showDeleteDialog}
              disabled={isButtonDisabled('Удалить')}
            >
              <FontAwesomeIcon icon={faTrash} /> <span>Удалить</span>
            </button>
          </div>
          
          <div className="right-controls">
            <div className="search-container">
              <input 
                type="text" 
                className="search-input" 
                placeholder="Поиск по имени, фамилии, отчеству или телефону..." 
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
              <option value="Все">Все</option>
              <option value="Логистика">Логистика</option>
              <option value="Экспедиторы">Экспедиторы</option>
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
              <option value="Все">Все</option>
              <option value="Активный">Активный</option>
              <option value="Заблокирован">Заблокирован</option>
              <option value="В отпуске">В отпуске</option>
              <option value="Уволен">Уволен</option>
            </select>
          </div>
        </div>
        
        <div className="vehicles-table-container">
          {!isDataFetched && drivers.length === 0 && (
            <div className="no-data">
              Данные не загружены. Нажмите "Обновить", чтобы загрузить список водителей
            </div>
          )}
          
          {isDataFetched && drivers.length === 0 && (
            <div className="no-data">
              Водители не найдены. Попробуйте изменить параметры фильтра
            </div>
          )}
          
          {drivers.length > 0 && (
            <>
              <div className="vehicles-table">
                <table>
                  <thead>
                    <tr>
                      <th width="30">
                        <input 
                          type="checkbox" 
                          onChange={handleSelectAll}
                          checked={selectedDrivers.length === filteredDrivers.length && filteredDrivers.length > 0}
                        />
                      </th>
                      <th width="40">#</th>
                      <th 
                        className="sortable" 
                        onClick={() => handleSort('firstName')}
                      >
                        Имя {getSortIcon('firstName')}
                      </th>
                      <th 
                        className="sortable" 
                        onClick={() => handleSort('lastName')}
                      >
                        Фамилия {getSortIcon('lastName')}
                      </th>
                      <th 
                        className="sortable" 
                        onClick={() => handleSort('middleName')}
                      >
                        Отчество {getSortIcon('middleName')}
                      </th>
                      <th
                        className="sortable"
                        onClick={() => handleSort('phone')}
                      >
                        Телефон {getSortIcon('phone')}
                      </th>
                      <th
                        className="sortable"
                        onClick={() => handleSort('medicalCertificateExpiry')}
                      >
                        Дата медицинской справки {getSortIcon('medicalCertificateExpiry')}
                      </th>
                      <th
                        className="sortable"
                        onClick={() => handleSort('userGroup')}
                      >
                        Группа {getSortIcon('userGroup')}
                      </th>
                      <th
                        className="sortable"
                        onClick={() => handleSort('status')}
                      >
                        Статус {getSortIcon('status')}
                      </th>
                      <th
                        className="sortable"
                        onClick={() => handleSort('birthDate')}
                      >
                        Дата рождения {getSortIcon('birthDate')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDrivers.map((driver, index) => (
                      <tr 
                        key={driver.id} 
                        className={selectedDrivers.includes(driver.id) ? 'selected' : ''}
                        onContextMenu={(e) => handleContextMenu(e, driver.id)}
                        onClick={() => handleSelectRow(driver.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            checked={selectedDrivers.includes(driver.id)} 
                            onChange={() => handleSelectRow(driver.id)}
                          />
                        </td>
                        <td>{(currentPage - 1) * pageSize + index + 1}</td>
                        <td>{driver.firstName}</td>
                        <td>{driver.lastName}</td>
                        <td>{driver.middleName}</td>
                        <td>{driver.phone}</td>
                        <td>{driver.medicalCertificateExpiry}</td>
                        <td>{driver.userGroup}</td>
                        <td>
                          <span className={getStatusClass(driver.status)}>
                            {driver.status}
                          </span>
                        </td>
                        <td>{driver.birthDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="pagination">
                <div className="page-info">
                  <span>Показано 1-{Math.min(paginatedDrivers.length, pageSize)} из {filteredDrivers.length}</span>
                  <select 
                    className="page-size" 
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                  >
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </div>
                <div className="page-controls">
                  <button 
                    disabled={currentPage === 1} 
                    onClick={() => setCurrentPage(1)}
                  >
                    <FontAwesomeIcon icon={faChevronLeft} />
                    <FontAwesomeIcon icon={faChevronLeft} />
                  </button>
                  <button 
                    disabled={currentPage === 1} 
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  >
                    <FontAwesomeIcon icon={faChevronLeft} />
                  </button>
                  
                  <button className="active">{currentPage}</button>
                  
                  <button 
                    disabled={currentPage === totalPages} 
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  >
                    <FontAwesomeIcon icon={faChevronRight} />
                  </button>
                  <button 
                    disabled={currentPage === totalPages} 
                    onClick={() => setCurrentPage(totalPages)}
                  >
                    <FontAwesomeIcon icon={faChevronRight} />
                    <FontAwesomeIcon icon={faChevronRight} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
        
        {/* Модальное окно удаления */}
        {showDeleteConfirm && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h2>Подтверждение удаления</h2>
                <button className="close" onClick={() => setShowDeleteConfirm(false)}>
                  &times;
                </button>
              </div>
              <div className="modal-body">
                <div className="delete-info">
                  <FontAwesomeIcon icon={faExclamationTriangle} className="warning-icon" />
                  
                  <p>Вы действительно хотите удалить выбранных водителей? Это действие нельзя отменить.</p>
                  
                  <div className="delete-vehicles-list">
                    {selectedDrivers.map(id => {
                      const driver = drivers.find(d => d.id === id);
                      return (
                        <div key={id} className="delete-vehicle-item">
                          {driver ? `${driver.lastName} ${driver.firstName} ${driver.middleName}` : `ID: ${id}`}
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <div className="form-actions">
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Отмена
                  </button>
                  <button 
                    className="btn btn-danger"
                    onClick={() => {
                      // Используем apiService для удаления
                      const deletePromises = selectedDrivers.map(id => 
                        apiService.deleteDriver(id)
                          .then(() => console.log(`Водитель с ID ${id} успешно удален`))
                          .catch(error => console.error(`Ошибка при удалении водителя с ID ${id}:`, error))
                      );
                      
                      Promise.all(deletePromises)
                        .then(() => {
                          // Обновляем список после удаления
                          handleFetchData();
                          setSelectedDrivers([]);
                          setShowDeleteConfirm(false);
                        })
                        .catch(error => {
                          console.error('Ошибка при удалении водителей:', error);
                          setShowDeleteConfirm(false);
                        });
                    }}
                  >
                    <FontAwesomeIcon icon={faTrash} /> <span>Удалить</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Контекстное меню */}
        {contextMenu.visible && (
          <div 
            className="vehicle-context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <div className="context-menu-header">
              Действия с водителем
            </div>
            <ul className="context-menu-options">
              <li onClick={() => handleContextMenuAction('profile')}>
                <FontAwesomeIcon icon={faUserAlt} /> Профиль водителя
              </li>
              <li onClick={() => handleContextMenuAction('edit')}>
                <FontAwesomeIcon icon={faEdit} /> Редактировать
              </li>
              <li onClick={() => handleContextMenuAction('block')}>
                <FontAwesomeIcon icon={faLock} /> Заблокировать
              </li>
              <li onClick={() => handleContextMenuAction('delete')}>
                <FontAwesomeIcon icon={faTrash} /> Удалить
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default DriversPage; 