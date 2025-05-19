import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faTimes, faPlus, faExclamationCircle, faCheck 
} from '@fortawesome/free-solid-svg-icons';
import './AddVehicleModal.css';
import CreateGroupModal from './CreateGroupModal'; // Импортируем новый компонент

/**
 * Компонент модального окна для добавления транспортного средства
 * @param {Object} props - Свойства компонента
 * @param {boolean} props.isOpen - Флаг открытия модального окна
 * @param {Function} props.onClose - Функция закрытия модального окна
 * @param {Function} props.onVehicleAdded - Функция обратного вызова при успешном добавлении ТС
 */
const AddVehicleModal = ({ isOpen, onClose, onVehicleAdded }) => {
    // Состояние формы
    const [formData, setFormData] = useState({
        name: '',
        imei: '',
        userGroup: '',
    });
    
    // Состояние для групп
    const [groups, setGroups] = useState([]);
    const [loadingGroups, setLoadingGroups] = useState(false);
    
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
            resetForm();
        }
    }, [isOpen]);
    
    // Функция загрузки групп
    const loadGroups = async () => {
        setLoadingGroups(true);
        try {
            // Получаем JWT токен из localStorage
            const token = localStorage.getItem('access_token');
            
            console.log('Загружаем список групп...');
            
            // Исправляем URL для получения групп
            const response = await fetch('https://185.234.114.212:8443/api/folders/type/group', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : '' // Добавляем JWT авторизацию
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
            } else {
                console.error('Неверный формат данных при загрузке групп:', data);
                setGroups([]);
            }
        } catch (error) {
            console.error('Ошибка при загрузке групп:', error);
            showNotification('Не удалось загрузить группы. Пожалуйста, попробуйте позже.', 'error');
            setGroups([]);
        } finally {
            setLoadingGroups(false);
        }
    };
    
    // Сброс формы
    const resetForm = () => {
        setFormData({
            name: '',
            imei: '',
            userGroup: '',
        });
    };
    
    // Обработчик изменения полей формы
    const handleChange = (e) => {
        const { name, value } = e.target;
        
        // Для поля IMEI удаляем все символы кроме цифр и ограничиваем длину до 15 символов
        if (name === 'imei') {
            const cleanedValue = value.replace(/[^\d]/g, '').substring(0, 15);
            setFormData({ ...formData, [name]: cleanedValue });
        } else {
            console.log(`Изменение поля ${name}:`, value);
            setFormData({ ...formData, [name]: value });
        }
    };
    
    // Обработчик отправки формы
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Валидация
        if (!formData.name) {
            showNotification('Необходимо указать название транспортного средства', 'error');
            return;
        }
        
        if (!formData.imei) {
            showNotification('Необходимо указать IMEI терминала', 'error');
            return;
        }
        
        // Проверка длины IMEI
        if (formData.imei.length !== 15) {
            showNotification('IMEI должен содержать ровно 15 цифр', 'error');
            return;
        }
        
        try {
            // Получаем JWT токен из localStorage
            const token = localStorage.getItem('access_token');
            
            // Получаем список всех транспортных средств для проверки уникальности
            const vehiclesResponse = await fetch('https://185.234.114.212:8443/api/vehicles', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                }
            });
            
            if (!vehiclesResponse.ok) {
                throw new Error(`Ошибка получения списка ТС: ${vehiclesResponse.status} - ${vehiclesResponse.statusText}`);
            }
            
            const allVehicles = await vehiclesResponse.json();
            console.log('Все транспортные средства для проверки:', allVehicles);
            
            // Проверка на уникальность имени ТС
            const nameExists = Array.isArray(allVehicles) && allVehicles.some(
                vehicle => vehicle.name && vehicle.name.toLowerCase() === formData.name.toLowerCase()
            );
            
            if (nameExists) {
                showNotification(`Транспортное средство с названием "${formData.name}" уже существует`, 'error');
                return;
            }
            
            // Проверка на уникальность IMEI
            const imeiExists = Array.isArray(allVehicles) && allVehicles.some(
                vehicle => vehicle.imei === formData.imei
            );
            
            if (imeiExists) {
                showNotification(`Транспортное средство с IMEI "${formData.imei}" уже существует`, 'error');
                return;
            }
            
            console.log('Данные формы при отправке:', formData);
            console.log('Доступные группы:', groups);
            
            // Находим выбранную группу для получения её имени
            const selectedGroup = formData.userGroup 
                ? groups.find(g => g.id === formData.userGroup || g.id.toString() === formData.userGroup) 
                : null;
                
            console.log('Найденная группа:', selectedGroup);
            
            const groupName = selectedGroup ? selectedGroup.name : "Без группы"; // Устанавливаем значение по умолчанию
            
            // Подготовка данных для отправки
            const vehicleData = {
                name: formData.name,
                imei: formData.imei,
                type: 'truck', // Устанавливаем значение по умолчанию
                user_group: groupName, // Имя группы для отображения
                vehicle_type: 'Легковой', // Устанавливаем значение по умолчанию
                status: 'ACTIVE'
            };
            
            console.log('Отправка данных для создания ТС:', vehicleData);
            showNotification('Создание транспортного средства...', 'info');
            
            // Отправка запроса на создание ТС
            const response = await fetch('https://185.234.114.212:8443/api/vehicles', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : '' // Добавляем JWT авторизацию
                },
                body: JSON.stringify(vehicleData),
            });
            
            if (!response.ok) {
                throw new Error(`Ошибка HTTP: ${response.status} - ${response.statusText}`);
            }
            
            const data = await response.json();
            
            console.log('ТС успешно создано:', data);
            showNotification('Транспортное средство успешно создано!', 'success');
            
            // Вызов функции обратного вызова
            if (typeof onVehicleAdded === 'function') {
                onVehicleAdded(data);
            }
            
            // Задержка перед закрытием для отображения уведомления
            setTimeout(() => {
                onClose();
                resetForm();
            }, 1500);
        } catch (error) {
            console.error('Ошибка при создании ТС:', error);
            showNotification(`Ошибка: ${error.message || 'Не удалось создать транспортное средство'}`, 'error');
        }
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
        setFormData({
            ...formData,
            userGroup: newGroup.id
        });
        
        // Закрываем модальное окно создания группы
        setShowCreateGroupModal(false);
        
        // Показываем уведомление
        showNotification('Группа успешно создана!', 'success');
    };
    
    // Не рендерим, если модальное окно закрыто
    if (!isOpen) return null;
    
    return (
        <>
            <div className="modal-overlay">
                <div className="add-vehicle-modal">
                    <div className="modal-header">
                        <h2>Добавление транспортного средства</h2>
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
                        
                        <form onSubmit={handleSubmit}>
                            <div className="form-groups">
                                <label htmlFor="name">Название транспортного средства</label>
                                <input 
                                    type="text" 
                                    id="name" 
                                    name="name" 
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="Введите название ТС"
                                    required
                                />
                            </div>
                            
                            <div className="form-groups">
                                <label htmlFor="imei">IMEI терминала</label>
                                <input 
                                    type="text" 
                                    id="imei" 
                                    name="imei" 
                                    value={formData.imei}
                                    onChange={handleChange}
                                    placeholder="Введите IMEI (ровно 15 цифр)"
                                    pattern="[0-9]{15}"
                                    required
                                />
                                <small className="form-hint">Должен содержать ровно 15 цифр (текущая длина: {formData.imei.length})</small>
                            </div>
                            
                            <div className="form-groups">
                                <label htmlFor="userGroup">Группа</label>
                                <div className="group-selection">
                                    <select 
                                        id="userGroup" 
                                        name="userGroup" 
                                        value={formData.userGroup}
                                        onChange={(e) => {
                                            const selectedValue = e.target.value;
                                            console.log("Выбрана группа с ID:", selectedValue);
                                            
                                            // Находим выбранную группу
                                            const selected = groups.find(g => g.id === selectedValue || g.id.toString() === selectedValue);
                                            console.log("Данные выбранной группы:", selected);
                                            
                                            // Обновляем состояние
                                            setFormData({
                                                ...formData,
                                                userGroup: selectedValue
                                            });
                                        }}
                                        disabled={loadingGroups}
                                    >
                                        <option value="">Выберите группу</option>
                                        {groups.map(group => (
                                            <option key={group.id} value={group.id}>
                                                {group.name} (ID: {group.id})
                                            </option>
                                        ))}
                                    </select>
                                    <button 
                                        type="button" 
                                        className="btn btn-small"
                                        onClick={() => setShowCreateGroupModal(true)}
                                    >
                                        <FontAwesomeIcon icon={faPlus} /> Создать группу
                                    </button>
                                </div>
                                {formData.userGroup && (
                                    <div className="debug-info" style={{fontSize: '0.8em', color: '#888', marginTop: '5px'}}>
                                        Выбрана группа с ID: {formData.userGroup}
                                    </div>
                                )}
                            </div>
                            
                            <div className="form-actions">
                                <button type="submit" className="btn btn-primary">Сохранить</button>
                                <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
                            </div>
                        </form>
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

export default AddVehicleModal; 