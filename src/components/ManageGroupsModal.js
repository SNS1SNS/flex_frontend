import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faTimes, faPlus, faExclamationCircle, faCheck, faSearch 
} from '@fortawesome/free-solid-svg-icons';
import './AddVehicleModal.css'; // Используем те же стили, что и для других модальных окон
import CreateGroupModal from './CreateGroupModal'; // Импортируем компонент создания группы

/**
 * Компонент модального окна для управления группами транспортных средств
 * @param {Object} props - Свойства компонента
 * @param {boolean} props.isOpen - Флаг открытия модального окна
 * @param {Function} props.onClose - Функция закрытия модального окна
 * @param {Array} props.selectedVehicleIds - Массив ID выбранных транспортных средств
 * @param {Function} props.onGroupsUpdated - Функция обратного вызова при успешном обновлении групп
 */
const ManageGroupsModal = ({ isOpen, onClose, selectedVehicleIds = [], onGroupsUpdated }) => {
    // Состояние для групп
    const [groups, setGroups] = useState([]);
    const [filteredGroups, setFilteredGroups] = useState([]);
    const [loadingGroups, setLoadingGroups] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGroupId, setSelectedGroupId] = useState('');
    
    // Состояние для модального окна создания группы
    const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
    
    // Состояние для уведомлений
    const [notification, setNotification] = useState({
        show: false,
        message: '',
        type: '' // success, error, info
    });
    
    // Загрузка групп при открытии модального окна
    useEffect(() => {
        if (isOpen) {
            loadGroups();
        }
    }, [isOpen]);
    
    // Фильтрация групп при изменении поискового запроса
    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredGroups(groups);
        } else {
            const query = searchQuery.toLowerCase().trim();
            const filtered = groups.filter(group => 
                group.name.toLowerCase().includes(query)
            );
            setFilteredGroups(filtered);
        }
    }, [searchQuery, groups]);
    
    // Функция загрузки групп
    const loadGroups = async () => {
        setLoadingGroups(true);
        try {
            // Получаем JWT токен из localStorage
            const token = localStorage.getItem('access_token');
            
            console.log('Загружаем список групп...');
            
            // Правильный URL для получения групп
            const response = await fetch('http://localhost:8081/api/folders/type/group', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                }
            });
            
            // Проверяем статус ответа
            if (!response.ok) {
                throw new Error(`Ошибка HTTP: ${response.status} - ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Проверяем, что получен массив
            if (Array.isArray(data)) {
                console.log('Загруженные группы:', data);
                // Если нужно дополнительно загрузить информацию о тарифах для групп
                const groupsWithTariffs = data.map(group => {
                    return {
                        ...group,
                        tariff: group.tariff || (group.tariffId ? { id: group.tariffId, name: 'Тариф ' + group.tariffId } : null)
                    };
                });
                setGroups(groupsWithTariffs);
                setFilteredGroups(groupsWithTariffs);
            } else {
                console.error('Неверный формат данных при загрузке групп:', data);
                setGroups([]);
                setFilteredGroups([]);
            }
        } catch (error) {
            console.error('Ошибка при загрузке групп:', error);
            showNotification('Не удалось загрузить группы. Пожалуйста, попробуйте позже.', 'error');
            setGroups([]);
            setFilteredGroups([]);
        } finally {
            setLoadingGroups(false);
        }
    };
    
    // Обработчик поиска групп
    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
    };
    
    // Функция для показа уведомлений
    const showNotification = (message, type) => {
        setNotification({
            show: true,
            message,
            type
        });
        
        // Автоматически скрываем через 5 секунд
        setTimeout(() => {
            setNotification(prev => ({ ...prev, show: false }));
        }, 5000);
    };
    
    // Обработчик успешного создания группы
    const handleGroupCreated = (newGroup) => {
        // Обновляем список групп
        loadGroups();
        
        // Выбираем созданную группу
        setSelectedGroupId(newGroup.id);
        
        // Закрываем модальное окно создания группы
        setShowCreateGroupModal(false);
        
        // Показываем уведомление
        showNotification('Группа успешно создана!', 'success');
    };
    
    // Обработчик выбора группы
    const handleGroupSelect = (groupId) => {
        setSelectedGroupId(groupId);
    };
    
    // Обработчик применения группы к выбранным ТС
    const handleApplyGroup = async () => {
        if (selectedVehicleIds.length === 0) {
            showNotification('Не выбрано ни одно транспортное средство', 'error');
            return;
        }
        
        try {
            // Получаем JWT токен из localStorage
            const token = localStorage.getItem('access_token');
            
            // Определяем значение группы (выбранная группа или "Без группы")
            let groupName = "Без группы";
            
            if (selectedGroupId) {
                // Находим выбранную группу
                const selectedGroup = groups.find(g => g.id === selectedGroupId || g.id.toString() === selectedGroupId);
                
                if (!selectedGroup) {
                    showNotification('Выбранная группа не найдена', 'error');
                    return;
                }
                
                groupName = selectedGroup.name;
                console.log('Выбранная группа для обновления:', selectedGroup);
            } else {
                console.log('Установка значения "Без группы"');
            }
            
            // Показываем уведомление о начале обновления
            showNotification(`Обновление групп для ${selectedVehicleIds.length} ТС...`, 'info');
            
            // Создаем массив промисов для обновления каждого ТС
            const updatePromises = selectedVehicleIds.map(async (vehicleId) => {
                console.log(`Обновление ТС с ID: ${vehicleId}`);
                
                // Получаем текущие данные ТС
                const vehicleResponse = await fetch(`http://localhost:8081/api/vehicles/${vehicleId}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token ? `Bearer ${token}` : ''
                    }
                });
                
                if (!vehicleResponse.ok) {
                    throw new Error(`Ошибка получения данных ТС ${vehicleId}: ${vehicleResponse.status}`);
                }
                
                const vehicleData = await vehicleResponse.json();
                console.log(`Текущие данные ТС ${vehicleId}:`, vehicleData);
                
                // Обновляем поле user_group и сохраняем остальные поля
                // Убеждаемся, что мы не теряем никакие данные при обновлении
                const { id, name, imei, type, vehicle_type, status } = vehicleData;
                
                // Создаем минимальный набор данных для обновления
                const updatedData = {
                    id,
                    name,
                    imei,
                    type: type || 'truck',
                    vehicle_type: vehicle_type || 'Легковой',
                    status: status || 'ACTIVE',
                    user_group: groupName
                };
                
                console.log(`Обновленные данные для ТС ${vehicleId}:`, updatedData);
                
                // Отправляем обновленные данные
                const updateResponse = await fetch(`http://localhost:8081/api/vehicles/${vehicleId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token ? `Bearer ${token}` : ''
                    },
                    body: JSON.stringify(updatedData)
                });
                
                if (!updateResponse.ok) {
                    throw new Error(`Ошибка обновления ТС ${vehicleId}: ${updateResponse.status}`);
                }
                
                const result = await updateResponse.json();
                console.log(`Результат обновления ТС ${vehicleId}:`, result);
                return result;
            });
            
            // Ждем завершения всех запросов
            const results = await Promise.all(updatePromises);
            
            console.log('Результаты обновления групп:', results);
            showNotification(`Группа успешно обновлена для ${results.length} транспортных средств`, 'success');
            
            // Вызываем функцию обратного вызова, если она предоставлена
            if (typeof onGroupsUpdated === 'function') {
                onGroupsUpdated(results);
            }
            
            // Задержка перед закрытием для отображения уведомления
            setTimeout(() => {
                onClose();
            }, 1500);
        } catch (error) {
            console.error('Ошибка при обновлении групп:', error);
            showNotification(`Ошибка: ${error.message || 'Не удалось обновить группы транспортных средств'}`, 'error');
        }
    };
    
    // Не рендерим, если модальное окно закрыто
    if (!isOpen) return null;
    
    return (
        <>
            <div className="modal-overlay">
                <div className="add-vehicle-modal manage-groups-modal">
                    <div className="modal-header">
                        <h2>Управление группами</h2>
                        <button className="close-btn" onClick={onClose}>
                            <FontAwesomeIcon icon={faTimes} />
                        </button>
                    </div>
                    
                    <div className="modal-body">
                        {notification.show && (
                            <div className={`notification ${notification.type}`}>
                                <FontAwesomeIcon 
                                    icon={notification.type === 'success' ? faCheck : 
                                        notification.type === 'error' ? faExclamationCircle : 
                                        faExclamationCircle} 
                                    className="notification-icon"
                                />
                                <span>{notification.message}</span>
                                <button className="notification-close" onClick={() => setNotification({...notification, show: false})}>
                                    <FontAwesomeIcon icon={faTimes} />
                                </button>
                            </div>
                        )}
                        
                        <div className="selected-vehicles-info">
                            Выбрано транспортных средств: <strong>{selectedVehicleIds.length}</strong>
                        </div>
                        
                        <div className="groups-controls">
                            <div className="search-container">
                                <FontAwesomeIcon icon={faSearch} className="search-icon" />
                                <input 
                                    type="text" 
                                    className="search-input" 
                                    placeholder="Найти группу..." 
                                    value={searchQuery}
                                    onChange={handleSearchChange}
                                />
                            </div>
                            <button 
                                className="btn btn-primary"
                                onClick={() => setShowCreateGroupModal(true)}
                            >
                                <FontAwesomeIcon icon={faPlus} /> Создать группу
                            </button>
                        </div>
                        
                        <div className="groups-list-container">
                            {loadingGroups ? (
                                <div className="loading-message">Загрузка групп...</div>
                            ) : filteredGroups.length === 0 ? (
                                <div className="empty-message">
                                    {searchQuery.trim() !== '' 
                                        ? 'Не найдено групп, соответствующих запросу' 
                                        : 'Нет доступных групп'}
                                </div>
                            ) : (
                                <ul className="groups-list">
                                    <li className="group-item special-group" 
                                        onClick={() => handleGroupSelect('')}
                                    >
                                        <div className={`group-item-inner ${selectedGroupId === '' ? 'selected' : ''}`}>
                                            <span className="group-name">Без группы</span>
                                        </div>
                                    </li>
                                    {filteredGroups.map(group => (
                                        <li 
                                            key={group.id} 
                                            className="group-item" 
                                            onClick={() => handleGroupSelect(group.id)}
                                        >
                                            <div className={`group-item-inner ${selectedGroupId === group.id ? 'selected' : ''}`}>
                                                <span className="group-name">{group.name}</span>
                                                {group.tariff && (
                                                    <span className="group-tariff">
                                                        Тариф: {group.tariff.name || `Тариф ${group.tariffId}`}
                                                    </span>
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        
                        <div className="form-actions">
                            <button 
                                className="btn btn-primary" 
                                onClick={handleApplyGroup}
                                disabled={loadingGroups}
                            >
                                Применить группу
                            </button>
                            <button className="btn btn-secondary" onClick={onClose}>
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Модальное окно создания группы */}
            <CreateGroupModal 
                isOpen={showCreateGroupModal}
                onClose={() => setShowCreateGroupModal(false)}
                onGroupCreated={handleGroupCreated}
            />
        </>
    );
};

export default ManageGroupsModal; 