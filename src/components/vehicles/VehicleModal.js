import React, { useState, useEffect } from 'react';
import vehicleService from '../../services/vehicleService';
import './VehicleModal.css';

/**
 * Компонент модального окна для добавления/редактирования транспортного средства
 * @param {Object} props - Свойства компонента
 * @param {boolean} props.isOpen - Флаг открытия модального окна
 * @param {Function} props.onClose - Функция закрытия модального окна
 * @param {Object} props.vehicle - Данные транспортного средства для редактирования (null для создания нового)
 * @param {Function} props.onSave - Функция, вызываемая после успешного сохранения
 * @returns {JSX.Element} Компонент модального окна
 */
const VehicleModal = ({ isOpen, onClose, vehicle = null, onSave }) => {
  // Начальное состояние формы
  const initialFormState = {
    name: '',
    imei: '',
    groupId: '',
    type: 'vehicle'
  };

  // Состояния компонента
  const [form, setForm] = useState(initialFormState);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // Загрузка доступных групп при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      loadGroups();
      
      // Если редактируем существующее ТС, заполняем форму его данными
      if (vehicle) {
        setForm({
          name: vehicle.name || '',
          imei: vehicle.imei || '',
          groupId: vehicle.groupId || '',
          type: vehicle.type || 'vehicle'
        });
      } else {
        // Сбрасываем форму для создания нового ТС
        setForm(initialFormState);
      }
      
      // Сбрасываем ошибки и сообщения
      setErrors({});
      setErrorMessage('');
    }
  }, [isOpen, vehicle]);

  /**
   * Загрузка доступных групп
   */
  const loadGroups = async () => {
    setLoadingGroups(true);
    try {
      const groupsData = await vehicleService.getGroupsByType('group');
      setGroups(groupsData);
    } catch (error) {
      console.error('Ошибка при загрузке групп:', error);
      setErrorMessage('Не удалось загрузить список групп');
    } finally {
      setLoadingGroups(false);
    }
  };

  /**
   * Обработчик изменения значений полей формы
   * @param {Event} e - Событие изменения
   */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prevForm => ({
      ...prevForm,
      [name]: value
    }));
    
    // Очищаем ошибку поля при изменении значения
    if (errors[name]) {
      setErrors(prevErrors => ({
        ...prevErrors,
        [name]: null
      }));
    }
  };

  /**
   * Валидация отдельного поля
   * @param {string} name - Имя поля
   * @param {string} value - Значение поля
   * @returns {string|null} Сообщение об ошибке или null, если ошибок нет
   */
  const validateField = (name, value) => {
    switch (name) {
      case 'name':
        return !value.trim() ? 'Название обязательно' : null;
      case 'imei':
        return !value.trim() 
          ? 'IMEI обязателен' 
          : !/^\d{15}$/.test(value) 
          ? 'IMEI должен содержать 15 цифр' 
          : null;
      case 'fuelTankVolume':
        return value && isNaN(Number(value)) 
          ? 'Объем бака должен быть числом' 
          : null;
      default:
        return null;
    }
  };

  /**
   * Валидация всей формы
   * @returns {boolean} Результат валидации (true - форма валидна, false - есть ошибки)
   */
  const validateForm = () => {
    const newErrors = {};
    let isValid = true;

    // Проверяем каждое поле формы
    Object.entries(form).forEach(([key, value]) => {
      const error = validateField(key, value);
      if (error) {
        newErrors[key] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  /**
   * Обработчик отправки формы
   * @param {Event} e - Событие отправки формы
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Проверяем валидность формы
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      // Формируем данные для отправки
      const vehicleData = {
        ...form,
        fuelTankVolume: form.fuelTankVolume ? Number(form.fuelTankVolume) : null
      };

      let result;
      
      // Отправляем запрос на создание или обновление ТС
      if (vehicle) {
        result = await vehicleService.updateVehicle(vehicle.id, vehicleData);
      } else {
        result = await vehicleService.createVehicle(vehicleData);
      }

      // Вызываем функцию обратного вызова с результатом
      onSave(result);
      
      // Закрываем модальное окно
      onClose();
    } catch (error) {
      console.error('Ошибка при сохранении транспортного средства:', error);
      setErrorMessage(
        error.message || 
        'Произошла ошибка при сохранении транспортного средства. Пожалуйста, попробуйте еще раз.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Если модальное окно закрыто, не рендерим содержимое
  if (!isOpen) return null;

  return (
    <div className="vehicle-modal show">
      <div className="vehicle-modal-content">
        {/* Заголовок модального окна */}
        <div className="vehicle-modal-header">
          <h2>{vehicle ? 'Редактирование транспортного средства' : 'Добавление транспортного средства'}</h2>
          <span className="vehicle-modal-close" onClick={onClose}>&times;</span>
        </div>

        {/* Сообщение об ошибке */}
        {errorMessage && (
          <div className="vehicle-form-error">
            {errorMessage}
          </div>
        )}

        {/* Форма */}
        {loading ? (
          <div className="vehicle-form-loading">
            <div className="vehicle-form-loading-spinner"></div>
            <span>Обработка запроса...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="vehicle-form">
            {/* Название ТС */}
            <div className={`vehicle-form-group ${errors.name ? 'error' : ''}`}>
              <label htmlFor="name">Название*</label>
              <input
                type="text"
                id="name"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Введите название"
              />
              {errors.name && <span className="error-text">{errors.name}</span>}
            </div>

            {/* IMEI */}
            <div className={`vehicle-form-group ${errors.imei ? 'error' : ''}`}>
              <label htmlFor="imei">IMEI*</label>
              <input
                type="text"
                id="imei"
                name="imei"
                value={form.imei}
                onChange={handleChange}
                placeholder="Введите IMEI (15 цифр)"
              />
              {errors.imei && <span className="error-text">{errors.imei}</span>}
              <span className="field-hint">IMEI должен содержать 15 цифр</span>
            </div>

           

            {/* Группа */}
            <div className="vehicle-form-group">
              <label htmlFor="groupId">Группа</label>
              <select
                id="groupId"
                name="groupId"
                value={form.groupId}
                onChange={handleChange}
                disabled={loadingGroups}
              >
                <option value="">Не выбрано</option>
                {groups.map(group => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
              {loadingGroups && <span className="field-hint">Загрузка групп...</span>}
            </div>

            {/* Кнопки действий */}
            <div className="vehicle-form-actions">
              <button 
                type="button" 
                className="vehicle-modal-btn vehicle-modal-btn-secondary" 
                onClick={onClose}
                disabled={loading}
              >
                Отмена
              </button>
              <button 
                type="submit" 
                className="vehicle-modal-btn vehicle-modal-btn-primary"
                disabled={loading}
              >
                {vehicle ? 'Сохранить' : 'Добавить'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default VehicleModal; 