import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBars, faPlus, faSearch,
  faSync, faEdit, faTrash, faEye, faUserAlt,
  faSort, faSortUp, faSortDown, faChevronLeft, faChevronRight, faExclamationTriangle,
  faLock, faUnlock, faCheckCircle, faTimesCircle
} from '@fortawesome/free-solid-svg-icons';
import './VehiclesPage.css'; // Используем те же стили
import { useUser } from '../context/UserContext';
import { useSidebar } from '../context/SidebarContext';
import { apiService } from '../services';
import { useLoading } from '../context/LoadingContext';

/**
 * Компонент страницы с пользователями
 */
const UsersPage = () => {
  // Получаем доступ к глобальному индикатору загрузки
  const { showLoader, hideLoader } = useLoading();
  
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [isDataFetched, setIsDataFetched] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [selectedUserDetails, setSelectedUserDetails] = useState(null);

  // Состояния для фильтров и поиска
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Все');
  const [roleFilter, setRoleFilter] = useState('Все');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortField, setSortField] = useState('username');
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
    userId: null
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
    showLoader('Загрузка списка пользователей...');
    
    // Используем apiService
    apiService.getUsers()
      .then(data => {
        // Обработка полученных данных
        let formattedData = data;
        // Проверяем, нужно ли сначала извлечь данные из ответа
        if (data && data.data) {
          formattedData = data.data;
        }
        
        // Преобразуем поля, если необходимо
        const processedUsers = Array.isArray(formattedData) ? formattedData.map(user => {
          // Проверяем и преобразуем поля к ожидаемому формату
          return {
            id: user.id,
            username: user.username || 'Нет данных',
            email: user.email || 'Нет данных',
            firstName: user.firstName || 'Нет данных',
            lastName: user.lastName || 'Нет данных',
            role: user.role || 'USER',
            userGroup: user.userGroup || 'Общая',
            status: user.blocked ? 'Заблокирован' : (user.status || 'Активный'),
            blocked: user.blocked || false,
            registrationDate: user.registrationDate || 'Нет данных',
            lastLogin: user.lastLogin || 'Нет данных',
            ...user
          };
        }) : [];
        
        console.log('Полученные данные пользователей:', processedUsers);
        setUsers(processedUsers);
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
        
        // Если API недоступен, загружаем демо-данные (хотя они уже должны быть в httpService)
        setTimeout(() => {
          apiService.getUsers()
            .then(demoData => {
              if (Array.isArray(demoData)) {
                setUsers(demoData);
                setIsDataFetched(true);
              }
              setLoading(false);
              hideLoader();
            })
            .catch(() => {
              console.error('Не удалось загрузить даже демо-данные');
              setLoading(false);
              hideLoader();
            });
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
      case 'неактивный':
        return 'status-maintenance';
      default:
        return 'status-unknown';
    }
  };

  // Обработчик выбора всех строк
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allUserIds = filteredUsers.map(user => user.id);
      setSelectedUsers(allUserIds);
    } else {
      setSelectedUsers([]);
    }
  };

  // Обработчик выбора одной строки
  const handleSelectRow = (id) => {
    if (selectedUsers.includes(id)) {
      setSelectedUsers(selectedUsers.filter(userId => userId !== id));
    } else {
      setSelectedUsers([...selectedUsers, id]);
    }
  };

  // Обработчик просмотра деталей пользователя
  const handleViewUserDetails = (user) => {
    setSelectedUserDetails(user);
    setShowUserDetails(true);
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

  // Обработчик блокировки/разблокировки пользователя
  const handleToggleBlocked = (userId, currentStatus) => {
    const newStatus = !currentStatus;
    const actionText = newStatus ? 'блокировки' : 'разблокировки';
    
    if (window.confirm(`Вы уверены, что хотите выполнить операцию ${actionText} выбранного пользователя?`)) {
      apiService.blockUser(userId, newStatus)
        .then(() => {
          console.log(`Статус блокировки пользователя с ID ${userId} изменен на ${newStatus}`);
          // Обновляем данные
          handleFetchData();
        })
        .catch(error => {
          console.error(`Ошибка при изменении статуса блокировки пользователя с ID ${userId}:`, error);
        });
    }
  };

  // Обработчик активации/деактивации пользователя
  const handleToggleActive = (userId, currentStatus) => {
    // Инвертируем статус (если он был "Активный", то делаем "Неактивный" и наоборот)
    const isCurrentlyActive = currentStatus.toLowerCase() === 'активный';
    const newActiveStatus = !isCurrentlyActive;
    const actionText = newActiveStatus ? 'активации' : 'деактивации';
    
    if (window.confirm(`Вы уверены, что хотите выполнить операцию ${actionText} выбранного пользователя?`)) {
      apiService.setUserActive(userId, newActiveStatus)
        .then(() => {
          console.log(`Статус активности пользователя с ID ${userId} изменен на ${newActiveStatus}`);
          // Обновляем данные
          handleFetchData();
        })
        .catch(error => {
          console.error(`Ошибка при изменении статуса активности пользователя с ID ${userId}:`, error);
        });
    }
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
  const handleContextMenu = (e, userId) => {
    e.preventDefault();
    
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      userId
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
    const userId = contextMenu.userId;
    const targetUser = users.find(u => u.id === userId);
    
    if (!targetUser) return;
    
    switch(action) {
      case 'details':
        handleViewUserDetails(targetUser);
        break;
      case 'edit':
        console.log('Редактирование пользователя:', targetUser.username);
        // Здесь будет логика редактирования
        break;
      case 'toggle-block':
        handleToggleBlocked(targetUser.id, targetUser.blocked);
        break;
      case 'toggle-active':
        handleToggleActive(targetUser.id, targetUser.status);
        break;
      case 'delete':
        console.log('Удаление пользователя:', targetUser.username);
        setSelectedUsers([targetUser.id]);
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
      'Добавить пользователя',
      'Обновить'
    ];
    
    // Кнопки, которые требуют выбора ровно одной строки
    const oneSelectionButtons = [
      'Профиль пользователя',
      'Редактировать',
      'Заблокировать',
      'Активировать'
    ];
    
    if (alwaysActiveButtons.includes(buttonType)) {
      return false;
    }
    
    if (oneSelectionButtons.includes(buttonType)) {
      return selectedUsers.length !== 1;
    }
    
    // Остальные кнопки активны, если выбрано хотя бы одно ТС
    return selectedUsers.length === 0;
  };

  // Фильтрация пользователей
  const filteredUsers = users.filter(user => {
    // Поиск по имени, фамилии, email или username
    const matchesSearch = searchTerm === '' || 
      (user.firstName && user.firstName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.lastName && user.lastName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.username && user.username.toLowerCase().includes(searchTerm.toLowerCase()));
      
    // Фильтр по статусу
    const matchesStatus = statusFilter === 'Все' || 
      (user.status && user.status === statusFilter);
      
    // Фильтр по роли
    const matchesRole = roleFilter === 'Все' || 
      (user.role && user.role === roleFilter);
      
    return matchesSearch && matchesStatus && matchesRole;
  });

  // Сортировка пользователей
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const fieldA = a[sortField] || '';
    const fieldB = b[sortField] || '';
    
    const compareResult = 
      typeof fieldA === 'string' && typeof fieldB === 'string'
        ? fieldA.localeCompare(fieldB)
        : fieldA - fieldB;
        
    return sortDirection === 'asc' ? compareResult : -compareResult;
  });

  // Пагинация
  const totalPages = Math.ceil(sortedUsers.length / pageSize);
  const paginatedUsers = sortedUsers.slice(
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
              disabled={isButtonDisabled('Профиль пользователя')}
              onClick={() => {
                if (selectedUsers.length === 1) {
                  const selectedUser = users.find(u => u.id === selectedUsers[0]);
                  if (selectedUser) {
                    handleViewUserDetails(selectedUser);
                  }
                }
              }}
            >
              <FontAwesomeIcon icon={faUserAlt} /> <span>Профиль пользователя</span>
            </button>
            <button 
              className="control-button" 
              onClick={() => setShowAddUserModal(true)}
            >
              <FontAwesomeIcon icon={faPlus} /> <span>Добавить пользователя</span>
            </button>
            <button 
              className="control-button"
              disabled={isButtonDisabled('Редактировать')}
              onClick={() => {
                if (selectedUsers.length === 1) {
                  const selectedUser = users.find(u => u.id === selectedUsers[0]);
                  if (selectedUser) {
                    console.log('Редактирование пользователя:', selectedUser);
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
                if (selectedUsers.length === 1) {
                  const selectedUser = users.find(u => u.id === selectedUsers[0]);
                  if (selectedUser) {
                    handleToggleBlocked(selectedUser.id, selectedUser.blocked);
                  }
                }
              }}
            >
              <FontAwesomeIcon icon={selectedUsers.length === 1 && users.find(u => u.id === selectedUsers[0])?.blocked ? faUnlock : faLock} /> 
              <span>{selectedUsers.length === 1 && users.find(u => u.id === selectedUsers[0])?.blocked ? 'Разблокировать' : 'Заблокировать'}</span>
            </button>
            <button 
              className="control-button"
              disabled={isButtonDisabled('Активировать')}
              onClick={() => {
                if (selectedUsers.length === 1) {
                  const selectedUser = users.find(u => u.id === selectedUsers[0]);
                  if (selectedUser) {
                    handleToggleActive(selectedUser.id, selectedUser.status);
                  }
                }
              }}
            >
              <FontAwesomeIcon icon={selectedUsers.length === 1 && users.find(u => u.id === selectedUsers[0])?.status === 'Активный' ? faTimesCircle : faCheckCircle} /> 
              <span>{selectedUsers.length === 1 && users.find(u => u.id === selectedUsers[0])?.status === 'Активный' ? 'Деактивировать' : 'Активировать'}</span>
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
                placeholder="Поиск по имени, фамилии, email, логину..." 
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
            <label>Роль:</label>
            <select 
              value={roleFilter} 
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="Все">Все</option>
              <option value="ADMIN">Администратор</option>
              <option value="MANAGER">Менеджер</option>
              <option value="OPERATOR">Оператор</option>
              <option value="USER">Пользователь</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Статус:</label>
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="Все">Все</option>
              <option value="Активный">Активный</option>
              <option value="Заблокирован">Заблокирован</option>
              <option value="Неактивный">Неактивный</option>
            </select>
          </div>
        </div>
        
        <div className="vehicles-table-container">
          {!isDataFetched && users.length === 0 && (
            <div className="no-data">
              Данные не загружены. Нажмите "Обновить", чтобы загрузить список пользователей
            </div>
          )}
          
          {isDataFetched && users.length === 0 && (
            <div className="no-data">
              Пользователи не найдены. Попробуйте изменить параметры фильтра
            </div>
          )}
          
          {users.length > 0 && (
            <>
              <div className="vehicles-table">
                <table>
                  <thead>
                    <tr>
                      <th width="30">
                        <input 
                          type="checkbox" 
                          onChange={handleSelectAll}
                          checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                        />
                      </th>
                      <th width="40">#</th>
                      <th 
                        className="sortable" 
                        onClick={() => handleSort('username')}
                      >
                        Логин {getSortIcon('username')}
                      </th>
                      <th 
                        className="sortable" 
                        onClick={() => handleSort('email')}
                      >
                        Email {getSortIcon('email')}
                      </th>
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
                        onClick={() => handleSort('role')}
                      >
                        Роль {getSortIcon('role')}
                      </th>
                      <th
                        className="sortable"
                        onClick={() => handleSort('status')}
                      >
                        Статус {getSortIcon('status')}
                      </th>
                      <th
                        className="sortable"
                        onClick={() => handleSort('userGroup')}
                      >
                        Группа {getSortIcon('userGroup')}
                      </th>
                      <th
                        className="sortable"
                        onClick={() => handleSort('registrationDate')}
                      >
                        Дата регистрации {getSortIcon('registrationDate')}
                      </th>
                      <th
                        className="sortable"
                        onClick={() => handleSort('lastLogin')}
                      >
                        Последний вход {getSortIcon('lastLogin')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUsers.map((user, index) => (
                      <tr 
                        key={user.id} 
                        className={selectedUsers.includes(user.id) ? 'selected' : ''}
                        onContextMenu={(e) => handleContextMenu(e, user.id)}
                        onClick={() => handleSelectRow(user.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            checked={selectedUsers.includes(user.id)} 
                            onChange={() => handleSelectRow(user.id)}
                          />
                        </td>
                        <td>{(currentPage - 1) * pageSize + index + 1}</td>
                        <td>{user.username}</td>
                        <td>{user.email}</td>
                        <td>{user.firstName}</td>
                        <td>{user.lastName}</td>
                        <td>{user.role}</td>
                        <td>
                          <span className={getStatusClass(user.status)}>
                            {user.status}
                          </span>
                        </td>
                        <td>{user.userGroup}</td>
                        <td>{user.registrationDate}</td>
                        <td>{user.lastLogin}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="pagination">
                <div className="page-info">
                  <span>Показано 1-{Math.min(paginatedUsers.length, pageSize)} из {filteredUsers.length}</span>
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
                  
                  <p>Вы действительно хотите удалить выбранных пользователей? Это действие нельзя отменить.</p>
                  
                  <div className="delete-vehicles-list">
                    {selectedUsers.map(id => {
                      const user = users.find(u => u.id === id);
                      return (
                        <div key={id} className="delete-vehicle-item">
                          {user ? `${user.lastName} ${user.firstName} (${user.username})` : `ID: ${id}`}
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
                      const deletePromises = selectedUsers.map(id => 
                        apiService.deleteUser(id)
                          .then(() => console.log(`Пользователь с ID ${id} успешно удален`))
                          .catch(error => console.error(`Ошибка при удалении пользователя с ID ${id}:`, error))
                      );
                      
                      Promise.all(deletePromises)
                        .then(() => {
                          // Обновляем список после удаления
                          handleFetchData();
                          setSelectedUsers([]);
                          setShowDeleteConfirm(false);
                        })
                        .catch(error => {
                          console.error('Ошибка при удалении пользователей:', error);
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
              Действия с пользователем
            </div>
            <ul className="context-menu-options">
              <li onClick={() => handleContextMenuAction('details')}>
                <FontAwesomeIcon icon={faUserAlt} /> Профиль пользователя
              </li>
              <li onClick={() => handleContextMenuAction('edit')}>
                <FontAwesomeIcon icon={faEdit} /> Редактировать
              </li>
              <li onClick={() => handleContextMenuAction('toggle-block')}>
                {users.find(u => u.id === contextMenu.userId)?.blocked ? (
                  <><FontAwesomeIcon icon={faUnlock} /> Разблокировать</>
                ) : (
                  <><FontAwesomeIcon icon={faLock} /> Заблокировать</>
                )}
              </li>
              <li onClick={() => handleContextMenuAction('toggle-active')}>
                {users.find(u => u.id === contextMenu.userId)?.status === 'Активный' ? (
                  <><FontAwesomeIcon icon={faTimesCircle} /> Деактивировать</>
                ) : (
                  <><FontAwesomeIcon icon={faCheckCircle} /> Активировать</>
                )}
              </li>
              <li onClick={() => handleContextMenuAction('delete')}>
                <FontAwesomeIcon icon={faTrash} /> Удалить
              </li>
            </ul>
          </div>
        )}

        {/* Модальное окно просмотра деталей пользователя */}
        {showUserDetails && selectedUserDetails && (
          <div className="modal-overlay">
            <div className="modal-content vehicle-details-modal">
              <div className="modal-header">
                <h2>Профиль пользователя</h2>
                <button className="close" onClick={() => setShowUserDetails(false)}>
                  &times;
                </button>
              </div>
              <div className="modal-body">
                <div className="vehicle-details-header">
                  <div className="vehicle-title">
                    <FontAwesomeIcon icon={faUserAlt} className="vehicle-icon" />
                    <h3>{selectedUserDetails.username}</h3>
                  </div>
                  <span className={`vehicle-status ${getStatusClass(selectedUserDetails.status)}`}>
                    {selectedUserDetails.status}
                  </span>
                </div>
                
                <div className="vehicle-details-content">
                  <div className="details-section">
                    <h4>Основная информация</h4>
                    <div className="details-grid">
                      <div className="detail-item">
                        <div className="detail-label">Имя</div>
                        <div className="detail-value">{selectedUserDetails.firstName}</div>
                      </div>
                      <div className="detail-item">
                        <div className="detail-label">Фамилия</div>
                        <div className="detail-value">{selectedUserDetails.lastName}</div>
                      </div>
                      <div className="detail-item">
                        <div className="detail-label">Email</div>
                        <div className="detail-value">{selectedUserDetails.email}</div>
                      </div>
                      <div className="detail-item">
                        <div className="detail-label">Логин</div>
                        <div className="detail-value">{selectedUserDetails.username}</div>
                      </div>
                      <div className="detail-item">
                        <div className="detail-label">Роль</div>
                        <div className="detail-value">{selectedUserDetails.role}</div>
                      </div>
                      <div className="detail-item">
                        <div className="detail-label">Группа</div>
                        <div className="detail-value">{selectedUserDetails.userGroup}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="details-section">
                    <h4>Статус и активность</h4>
                    <div className="details-grid">
                      <div className="detail-item">
                        <div className="detail-label">Статус</div>
                        <div className="detail-value">{selectedUserDetails.status}</div>
                      </div>
                      <div className="detail-item">
                        <div className="detail-label">Заблокирован</div>
                        <div className="detail-value">{selectedUserDetails.blocked ? 'Да' : 'Нет'}</div>
                      </div>
                      <div className="detail-item">
                        <div className="detail-label">Дата регистрации</div>
                        <div className="detail-value">{selectedUserDetails.registrationDate}</div>
                      </div>
                      <div className="detail-item">
                        <div className="detail-label">Последний вход</div>
                        <div className="detail-value">{selectedUserDetails.lastLogin}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="details-actions">
                    <button 
                      className="btn btn-primary"
                      onClick={() => {
                        console.log('Редактирование пользователя:', selectedUserDetails);
                        // Здесь будет логика редактирования
                      }}
                    >
                      <FontAwesomeIcon icon={faEdit} /> <span>Редактировать</span>
                    </button>
                    <button 
                      className="btn btn-secondary"
                      onClick={() => {
                        handleToggleBlocked(selectedUserDetails.id, selectedUserDetails.blocked);
                        setShowUserDetails(false);
                      }}
                    >
                      {selectedUserDetails.blocked ? (
                        <><FontAwesomeIcon icon={faUnlock} /> <span>Разблокировать</span></>
                      ) : (
                        <><FontAwesomeIcon icon={faLock} /> <span>Заблокировать</span></>
                      )}
                    </button>
                    <button 
                      className="btn btn-danger"
                      onClick={() => {
                        setSelectedUsers([selectedUserDetails.id]);
                        setShowUserDetails(false);
                        showDeleteDialog();
                      }}
                    >
                      <FontAwesomeIcon icon={faTrash} /> <span>Удалить</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UsersPage; 