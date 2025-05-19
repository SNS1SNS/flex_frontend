import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faPlus, faSearch, faCar, faList, faTh, 
    faCheckCircle, faExclamationCircle 
} from '@fortawesome/free-solid-svg-icons';
import AddVehicleModal from './AddVehicleModal';
import './VehiclesList.css';

/**
 * Компонент для отображения списка транспортных средств
 */
const VehiclesList = () => {
    // Состояние для списка ТС
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Состояние для модального окна
    const [showAddModal, setShowAddModal] = useState(false);
    
    // Состояние для отображения
    const [viewMode, setViewMode] = useState('grid'); // 'grid' или 'list'
    const [searchTerm, setSearchTerm] = useState('');
    
    // Загрузка списка ТС при монтировании компонента
    useEffect(() => {
        fetchVehicles();
    }, []);
    
    // Функция загрузки списка ТС
    const fetchVehicles = async () => {
        setLoading(true);
        try {
            const response = await fetch('https://185.234.114.212:8443/api/vehicles');
            const data = await response.json();
            
            if (Array.isArray(data)) {
                setVehicles(data);
            } else {
                setVehicles([]);
            }
            setError(null);
        } catch (error) {
            console.error('Ошибка при загрузке транспортных средств:', error);
            setError('Не удалось загрузить список транспортных средств');
        } finally {
            setLoading(false);
        }
    };
    
    // Функция для открытия модального окна добавления ТС
    const handleAddVehicle = () => {
        setShowAddModal(true);
    };
    
    // Функция для закрытия модального окна
    const handleCloseModal = () => {
        setShowAddModal(false);
    };
    
    // Функция обратного вызова после добавления ТС
    const handleVehicleAdded = (newVehicle) => {
        // Добавляем новое ТС в список
        setVehicles([newVehicle, ...vehicles]);
    };
    
    // Фильтрация ТС по поисковому запросу
    const filteredVehicles = vehicles.filter(vehicle => 
        vehicle.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vehicle.imei?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    return (
        <div className="vehicles-list-container">
            {/* Верхняя панель с поиском и кнопками */}
            <div className="vehicles-toolbar">
                <div className="search-bar">
                    <FontAwesomeIcon icon={faSearch} className="search-icon" />
                    <input 
                        type="text" 
                        placeholder="Поиск по названию или IMEI..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <div className="toolbar-actions">
                    <div className="view-mode-toggle">
                        <button 
                            className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
                            onClick={() => setViewMode('grid')}
                        >
                            <FontAwesomeIcon icon={faTh} />
                        </button>
                        <button 
                            className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`}
                            onClick={() => setViewMode('list')}
                        >
                            <FontAwesomeIcon icon={faList} />
                        </button>
                    </div>
                    
                    <button className="add-vehicle-btn" onClick={handleAddVehicle}>
                        <FontAwesomeIcon icon={faPlus} /> Добавить ТС
                    </button>
                </div>
            </div>
            
            {/* Отображение списка ТС */}
            {loading ? (
                <div className="loading-container">
                    <p>Загрузка транспортных средств...</p>
                </div>
            ) : error ? (
                <div className="error-container">
                    <FontAwesomeIcon icon={faExclamationCircle} className="error-icon" />
                    <p>{error}</p>
                    <button className="retry-btn" onClick={fetchVehicles}>Повторить</button>
                </div>
            ) : filteredVehicles.length === 0 ? (
                <div className="empty-list">
                    {searchTerm ? (
                        <p>По запросу &quot;{searchTerm}&quot; ничего не найдено</p>
                    ) : (
                        <>
                            <p>Список транспортных средств пуст</p>
                            <button className="add-btn" onClick={handleAddVehicle}>
                                <FontAwesomeIcon icon={faPlus} /> Добавить транспортное средство
                            </button>
                        </>
                    )}
                </div>
            ) : (
                <div className={`vehicles-grid ${viewMode}`}>
                    {filteredVehicles.map(vehicle => (
                        <div className="vehicle-card" key={vehicle.id}>
                            <div className="vehicle-icon">
                                <FontAwesomeIcon icon={faCar} />
                            </div>
                            <div className="vehicle-info">
                                <h3 className="vehicle-name">{vehicle.name}</h3>
                                <p className="vehicle-imei">IMEI: {vehicle.imei || 'Не указан'}</p>
                                <div className={`vehicle-status ${vehicle.status === 'active' ? 'active' : 'inactive'}`}>
                                    <FontAwesomeIcon 
                                        icon={vehicle.status === 'active' ? faCheckCircle : faExclamationCircle} 
                                    />
                                    <span>
                                        {vehicle.status === 'active' ? 'Активно' : 
                                         vehicle.status === 'inactive' ? 'Неактивно' : 'Статус неизвестен'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            {/* Модальное окно добавления ТС */}
            <AddVehicleModal 
                isOpen={showAddModal}
                onClose={handleCloseModal}
                onVehicleAdded={handleVehicleAdded}
            />
        </div>
    );
};

export default VehiclesList; 