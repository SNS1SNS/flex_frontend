import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faFolderOpen } from '@fortawesome/free-solid-svg-icons';
import VehicleModal from './vehicles/VehicleModal';
import GroupsModal from './vehicles/GroupsModal';
import './VehicleFeaturesDemo.css';

/**
 * Компонент для демонстрации новой функциональности добавления ТС и управления группами
 */
const VehicleFeaturesDemo = () => {
  // Состояния для модальных окон
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [vehicleToEdit, setVehicleToEdit] = useState(null);
  const [isGroupsModalOpen, setIsGroupsModalOpen] = useState(false);

  // Открытие модального окна для добавления ТС
  const handleOpenAddVehicleModal = () => {
    setVehicleToEdit(null);
    setIsVehicleModalOpen(true);
  };

  // Закрытие модального окна добавления/редактирования ТС
  const handleCloseVehicleModal = () => {
    setIsVehicleModalOpen(false);
    setVehicleToEdit(null);
  };

  // Обработчик сохранения ТС
  const handleSaveVehicle = (vehicle) => {
    console.log('Транспортное средство сохранено:', vehicle);
    // Здесь можно добавить обновление списка ТС или другие действия
  };

  // Открытие модального окна управления группами
  const handleOpenGroupsModal = () => {
    setIsGroupsModalOpen(true);
  };

  // Закрытие модального окна управления группами
  const handleCloseGroupsModal = () => {
    setIsGroupsModalOpen(false);
    // Здесь можно добавить обновление данных, если группы изменились
  };

  return (
    <div className="vehicle-features-demo">
      <div className="demo-container">
        <h2>Демонстрация функциональности транспортных средств</h2>
        
        <div className="demo-buttons">
          <button 
            className="demo-button" 
            onClick={handleOpenAddVehicleModal}
          >
            <FontAwesomeIcon icon={faPlus} /> Добавить ТС
          </button>
          
          <button 
            className="demo-button"
            onClick={handleOpenGroupsModal}
          >
            <FontAwesomeIcon icon={faFolderOpen} /> Управление группами
          </button>
        </div>
        
        <div className="demo-info">
          <h3>Функциональность</h3>
          <ul>
            <li>Добавление транспортных средств с полной валидацией полей</li>
            <li>Выбор группы для ТС из доступных групп</li>
            <li>Управление группами (создание и удаление)</li>
            <li>Фильтрация групп по названию</li>
          </ul>
        </div>
      </div>

      {/* Модальное окно добавления/редактирования ТС */}
      <VehicleModal
        isOpen={isVehicleModalOpen}
        onClose={handleCloseVehicleModal}
        vehicle={vehicleToEdit}
        onSave={handleSaveVehicle}
      />
      
      {/* Модальное окно управления группами */}
      <GroupsModal
        isOpen={isGroupsModalOpen}
        onClose={handleCloseGroupsModal}
      />
    </div>
  );
};

export default VehicleFeaturesDemo;

 