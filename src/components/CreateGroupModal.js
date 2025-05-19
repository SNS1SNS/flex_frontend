import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faExclamationCircle, faCheck } from '@fortawesome/free-solid-svg-icons';
import './AddVehicleModal.css'; // Используем те же стили, что и для основного модального окна

/**
 * Компонент модального окна для создания группы
 * @param {Object} props - Свойства компонента
 * @param {boolean} props.isOpen - Флаг открытия модального окна
 * @param {Function} props.onClose - Функция закрытия модального окна
 * @param {Function} props.onGroupCreated - Функция обратного вызова при успешном создании группы
 */
const CreateGroupModal = ({ isOpen, onClose, onGroupCreated }) => {
    // Состояние для формы
    const [groupName, setGroupName] = useState('');
    const [tariffId, setTariffId] = useState('');
    
    // Состояние для тарифов
    const [tariffs, setTariffs] = useState([]);
    const [loadingTariffs, setLoadingTariffs] = useState(false);
    
    // Состояние для уведомлений
    const [notification, setNotification] = useState({
        show: false,
        message: '',
        type: '' // success, error, info
    });
    
    // Загрузка тарифов при открытии модального окна
    useEffect(() => {
        if (isOpen) {
            loadTariffs();
            resetForm();
        }
    }, [isOpen]);
    
    // Функция загрузки тарифов
    const loadTariffs = async () => {
        setLoadingTariffs(true);
        try {
            // Получаем JWT токен из localStorage
            const token = localStorage.getItem('access_token');
            
            console.log('Загружаем список тарифов...');
            
            // Запрос на получение тарифов
            const response = await fetch('https://185.234.114.212:8443/api/folders/type/tariff', {
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
                console.log('Загруженные тарифы:', data);
                setTariffs(data);
                // Если есть тарифы, устанавливаем первый по умолчанию
                if (data.length > 0) {
                    setTariffId(data[0].id);
                }
            } else {
                console.error('Неверный формат данных при загрузке тарифов:', data);
                setTariffs([]);
            }
        } catch (error) {
            console.error('Ошибка при загрузке тарифов:', error);
            showNotification('Не удалось загрузить тарифы. Пожалуйста, попробуйте позже.', 'error');
            setTariffs([]);
        } finally {
            setLoadingTariffs(false);
        }
    };
    
    // Сброс формы
    const resetForm = () => {
        setGroupName('');
        setTariffId('');
    };
    
    // Обработчик изменения имени группы
    const handleNameChange = (e) => {
        setGroupName(e.target.value);
    };
    
    // Обработчик изменения тарифа
    const handleTariffChange = (e) => {
        setTariffId(e.target.value);
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
    
    // Обработчик отправки формы
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Валидация
        if (!groupName.trim()) {
            showNotification('Введите название для новой группы', 'error');
            return;
        }
        
        try {
            // Получаем JWT токен из localStorage
            const token = localStorage.getItem('access_token');
            
            // Данные для создания группы
            const groupData = {
                name: groupName,
                type: 'group',
                parentId: tariffId,
                tariffId: null
            };
            
            console.log('Создание новой группы:', groupData);
            showNotification('Создание группы...', 'info');
            
            // Отправка запроса на создание группы
            const response = await fetch('https://185.234.114.212:8443/api/folders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify(groupData),
            });
            
            if (!response.ok) {
                throw new Error(`Ошибка HTTP: ${response.status} - ${response.statusText}`);
            }
            
            const data = await response.json();
            
            console.log('Группа успешно создана:', data);
            
            // Вызываем функцию обратного вызова
            if (typeof onGroupCreated === 'function') {
                onGroupCreated(data);
            } else {
                // Если нет функции обратного вызова, просто закрываем модальное окно
                showNotification('Группа успешно создана!', 'success');
                
                // Задержка перед закрытием для отображения уведомления
                setTimeout(() => {
                    onClose();
                    resetForm();
                }, 1500);
            }
        } catch (error) {
            console.error('Ошибка при создании группы:', error);
            showNotification(`Ошибка: ${error.message || 'Не удалось создать группу'}`, 'error');
        }
    };
    
    // Не рендерим, если модальное окно закрыто
    if (!isOpen) return null;
    
    return (
        <div className="modal-overlay">
            <div className="add-vehicle-modal">
                <div className="modal-header">
                    <h2>Создать новую группу</h2>
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
                    
                    <div className="info-text">
                        Вы создаете группу без привязки к транспортным средствам
                    </div>
                    
                    <form onSubmit={handleSubmit}>
                        <div className="form-groups">
                            <label htmlFor="groupName">Название группы</label>
                            <input 
                                type="text" 
                                id="groupName" 
                                name="name" 
                                value={groupName}
                                onChange={handleNameChange}
                                placeholder="Введите название группы"
                                required
                            />
                        </div>
                        
                        <div className="form-groups">
                            <label htmlFor="tariffId">Тариф</label>
                            <select 
                                id="tariffId" 
                                name="tariffId" 
                                value={tariffId}
                                onChange={handleTariffChange}
                                disabled={loadingTariffs || tariffs.length === 0}
                            >
                                {loadingTariffs ? (
                                    <option value="">Загрузка тарифов...</option>
                                ) : tariffs.length === 0 ? (
                                    <option value="">Нет доступных тарифов</option>
                                ) : (
                                    tariffs.map(tariff => (
                                        <option key={tariff.id} value={tariff.id}>
                                            {tariff.name}
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>
                        
                        <input type="hidden" name="type" value="group" />
                        
                        <div className="form-actions">
                            <button type="submit" className="btn btn-primary">Создать</button>
                            <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CreateGroupModal;