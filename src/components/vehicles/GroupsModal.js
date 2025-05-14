import React, { useState, useEffect } from 'react';
import vehicleService from '../../services/vehicleService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faSearch, faTrash, faEdit, faPlusCircle, 
  faExclamationTriangle 
} from '@fortawesome/free-solid-svg-icons';
import './GroupsModal.css';

// Компонент модального окна для управления группами
const GroupsModal = ({ isOpen, onClose, onGroupCreated = () => {} }) => {
  // Состояния компонента
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedTariff, setSelectedTariff] = useState('');
  const [tariffs, setTariffs] = useState([]);
  const [loadingTariffs, setLoadingTariffs] = useState(false);
  const [tariffError, setTariffError] = useState('');
  
  // Загрузка списка групп и тарифов при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      loadGroups();
      loadTariffs();
    }
  }, [isOpen]);
  
  // Загрузка списка групп с сервера
  const loadGroups = async () => {
    setLoading(true);
    setError('');
    
    try {
      const groupsData = await vehicleService.getGroupsByType('group');
      setGroups(Array.isArray(groupsData) ? groupsData : []);
    } catch (error) {
      console.error('Ошибка при загрузке групп:', error);
      setError('Не удалось загрузить список групп. Пожалуйста, попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };
  
  // Загрузка списка тарифов с сервера
  const loadTariffs = async () => {
    setLoadingTariffs(true);
    setTariffError('');
    
    try {
      const response = await vehicleService.getGroupsByType('tariff');
      if (response && response.data) {
        setTariffs(response.data);
        if (response.data.length > 0) {
          setSelectedTariff(response.data[0].id);
        }
      } else {
        setTariffs([]);
        setTariffError('Не удалось загрузить список тарифов');
      }
    } catch (err) {
      console.error('Ошибка при загрузке тарифов:', err);
      setTariffError('Не удалось загрузить список тарифов');
      // Устанавливаем стандартные тарифы в случае ошибки
      setTariffs([
        { id: '1', name: 'Базовый' },
        { id: '2', name: 'Расширенный' },
        { id: '3', name: 'Премиум' }
      ]);
      if (selectedTariff === '') {
        setSelectedTariff('1');
      }
    } finally {
      setLoadingTariffs(false);
    }
  };
  
  // Открытие модального окна создания группы
  const handleOpenCreateModal = () => {
    setNewGroupName('');
    setSelectedTariff(tariffs.length > 0 ? tariffs[0].id : '');
    setShowCreateModal(true);
  };
  
  // Закрытие модального окна создания группы
  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
  };
  
  // Обработка изменения поля поиска
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };
  
  // Открытие модального окна удаления группы
  const handleOpenDeleteModal = (group) => {
    setSelectedGroup(group);
    setShowDeleteModal(true);
  };
  
  // Закрытие модального окна удаления группы
  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setSelectedGroup(null);
  };
  
  // Создание новой группы
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    
    if (!newGroupName.trim()) {
      alert('Пожалуйста, введите название группы');
      return;
    }
    
    setLoading(true);
    
    try {
      // Создаем новую группу через API
      const groupData = {
        name: newGroupName,
        type: 'group',
        tariff_id: selectedTariff
      };
      
      const newGroup = await vehicleService.createGroup(groupData);
      
      // Обновляем список групп
      await loadGroups();
      
      // Вызываем колбэк, сообщающий о создании группы
      onGroupCreated(newGroup);
      
      // Закрываем модальное окно создания
      setShowCreateModal(false);
      
      // Очищаем данные формы
      setNewGroupName('');
      setSelectedTariff('');
    } catch (error) {
      console.error('Ошибка при создании группы:', error);
      setError('Не удалось создать группу. Пожалуйста, попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };
  
  // Удаление группы
  const handleDeleteGroup = async () => {
    if (!selectedGroup) return;
    
    setLoading(true);
    
    try {
      // Удаляем группу через API
      await vehicleService.deleteGroup(selectedGroup.id);
      
      // Обновляем список групп
      await loadGroups();
      
      // Закрываем модальное окно удаления
      setShowDeleteModal(false);
      setSelectedGroup(null);
    } catch (error) {
      console.error('Ошибка при удалении группы:', error);
      setError('Не удалось удалить группу. Пожалуйста, попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };
  
  // Фильтрация групп по поисковому запросу
  const filteredGroups = groups.filter(group => 
    group.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Если модальное окно закрыто, не рендерим содержимое
  if (!isOpen) return null;
  
  return (
    <div className="modal groups-modal show">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Управление группами</h2>
          <span className="close" onClick={onClose}>&times;</span>
        </div>
        
        <div className="groups-controls">
          <div className="search-container">
            <input 
              type="text" 
              className="search-input" 
              placeholder="Найти группу..." 
              value={searchTerm}
              onChange={handleSearchChange}
            />
            <FontAwesomeIcon icon={faSearch} className="search-icon" />
          </div>
          <button 
            className="btn btn-primary"
            onClick={handleOpenCreateModal}
          >
            <FontAwesomeIcon icon={faPlusCircle} /> Создать группу
          </button>
        </div>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        <div className="groups-list-container">
          <ul className="groups-list">
            {loading ? (
              <li className="loading-message">Загрузка групп...</li>
            ) : filteredGroups.length === 0 ? (
              <li className="empty-message">
                {searchTerm ? 'Группы не найдены' : 'Нет доступных групп'}
              </li>
            ) : (
              filteredGroups.map(group => (
                <li key={group.id} className="group-item">
                  <div className="group-info">
                    <span className="group-name">{group.name}</span>
                    <span className="group-type">{group.type === 'group' ? 'Группа' : 'Папка'}</span>
                  </div>
                  <div className="group-actions">
                    <button className="btn-icon btn-edit" title="Редактировать">
                      <FontAwesomeIcon icon={faEdit} />
                    </button>
                    <button 
                      className="btn-icon btn-delete" 
                      title="Удалить"
                      onClick={() => handleOpenDeleteModal(group)}
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
        
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onClose}>Закрыть</button>
        </div>
      </div>
      
      {/* Модальное окно создания группы */}
      {showCreateModal && (
        <div className="modal create-group-modal show">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Создать новую группу</h2>
              <span className="close" onClick={handleCloseCreateModal}>&times;</span>
            </div>
            
            <div className="modal-body">
              <div className="info-text">
                Вы создаете группу без привязки к транспортным средствам
              </div>
              
              {tariffError && (
                <div className="error-message">
                  {tariffError}
                </div>
              )}
              
              <form onSubmit={handleCreateGroup}>
                <div className="form-group">
                  <label>Название группы</label>
                  <input 
                    type="text" 
                    name="name"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Тариф</label>
                  {loadingTariffs ? (
                    <div className="loading-message">Загрузка тарифов...</div>
                  ) : (
                    <select 
                      name="tariff_id"
                      value={selectedTariff}
                      onChange={(e) => setSelectedTariff(e.target.value)}
                    >
                      {tariffs.map(tariff => (
                        <option key={tariff.id} value={tariff.id}>
                          {tariff.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                
                <input type="hidden" name="type" value="group" />
                
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={loading || loadingTariffs}>
                    {loading ? 'Создание...' : 'Создать'}
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={handleCloseCreateModal}
                    disabled={loading}
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      
      {/* Модальное окно подтверждения удаления */}
      {showDeleteModal && selectedGroup && (
        <div className="modal delete-confirm-modal show">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Подтверждение удаления</h2>
              <span className="close" onClick={handleCloseDeleteModal}>&times;</span>
            </div>
            
            <div className="modal-body">
              <div className="delete-info">
                <FontAwesomeIcon 
                  icon={faExclamationTriangle} 
                  style={{ color: '#ff4444', fontSize: '48px', marginBottom: '20px' }} 
                />
                <p>
                  Вы действительно хотите удалить группу &quot;{selectedGroup.name}&quot;?
                  Это действие нельзя отменить.
                </p>
              </div>
              
              <div className="form-actions">
                <button 
                  type="button" 
                  className="btn btn-danger" 
                  onClick={handleDeleteGroup}
                  disabled={loading}
                >
                  {loading ? 'Удаление...' : 'Удалить'}
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={handleCloseDeleteModal}
                  disabled={loading}
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupsModal; 