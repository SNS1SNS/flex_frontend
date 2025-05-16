import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTruck, faEdit, faTrash, 
  faGasPump, faDatabase,
  faChevronDown, faMicrochip, faTerminal, 
  faCar, faSave,
  faPlus, faFileImport, faFileExport,
  faCheck, faExclamationCircle, faInfoCircle, faExclamationTriangle,
  faTimes
} from '@fortawesome/free-solid-svg-icons';
import Sidebar from './Sidebar';
import { calibrationService } from '../services';
import api from '../services/api';
import { useLoading } from '../context/LoadingContext';
import * as XLSX from 'xlsx';
import './VehicleProfile.css';

/**
 * Компонент страницы профиля транспортного средства
 */
const VehicleProfile = () => {
  const [vehicle, setVehicle] = useState({
    // Базовые поля ТС
    id: null,
    name: '',
    reg_number: '',
    imei: '',
    status: 'active',
    
    // Поля для топливной системы
    fuel_tank_volume: '',
    fuel_consumption_rate: '',
    
    // Поля для двигателя
    engineNumber: '',
    engine_type: '',
    
    // Другие поля будут добавлены при загрузке данных
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [collapsedSections, setCollapsedSections] = useState({});
  const [activeTab, setActiveTab] = useState('profile');
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [sensorCount, setSensorCount] = useState(1); // Количество датчиков (по умолчанию 1)
  const [calibrationData, setCalibrationData] = useState({}); // Данные тарировочных таблиц по номерам датчиков
  const [calibrationLoading, setCalibrationLoading] = useState(false); // Статус загрузки тарировочных таблиц
  const [apiStatus, setApiStatus] = useState({ loading: false, lastSync: null }); // Статус API-запросов
  const [syncHistory, setSyncHistory] = useState([]); // История синхронизации тарировочных таблиц
  const [showExcelFormatModal, setShowExcelFormatModal] = useState(false);
  
  // Refs для доступа к DOM элементам
  const profileContentRef = useRef(null);
  const fixedSaveBtnContainerRef = useRef(null);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { showLoader, hideLoader } = useLoading();
  
  // Получаем ID транспортного средства из параметров URL
  const getVehicleId = () => {
    const params = new URLSearchParams(location.search);
    return params.get('id');
  };
  
  // Загрузка данных о транспортном средстве
  useEffect(() => {
    const vehicleId = getVehicleId();
    
    if (!vehicleId) {
      setError('Не указан ID транспортного средства');
      setLoading(false);
      return;
    }
    
    const fetchVehicleData = async () => {
      try {
        showLoader('Загрузка данных транспортного средства...');
        
        // Используем новый API для получения данных
        const vehicleData = await api.getVehicle(vehicleId);
        console.log('Получены данные ТС:', vehicleData);
        
        // Если данные в формате { data: ... }, извлекаем их
        const data = vehicleData.data ? vehicleData.data : vehicleData;
        
        // Объединяем полученные данные с начальным состоянием vehicle
        // чтобы гарантировать, что поля для двигателя будут доступны
        setVehicle(prevVehicle => ({
          ...prevVehicle,
          ...data,
          // Если поля двигателя отсутствуют в ответе API, сохраняем текущие значения
          engineNumber: data.engineNumber ?? prevVehicle.engineNumber,
          engine_type: data.engine_type ?? prevVehicle.engine_type,
        }));
        
        setLoading(false);
        hideLoader();
        
        // Загружаем данные калибровочных таблиц после получения данных ТС
        fetchCalibrationData(vehicleId);
      } catch (error) {
        console.error('Ошибка при загрузке данных ТС:', error);
        
        // Проверяем, является ли ошибка ошибкой авторизации
        if (error.status === 401 || error.status === 403) {
          setError('Ошибка авторизации при загрузке данных. Пожалуйста, войдите в систему заново.');
        } else {
          setError(`Не удалось загрузить данные транспортного средства: ${error.message || 'Неизвестная ошибка'}`);
        }
        
        setLoading(false);
        hideLoader();
      }
    };
    
    fetchVehicleData();
  }, []);
  
  // Функция загрузки данных калибровочных таблиц
  const fetchCalibrationData = async (vehicleId) => {
    try {
      setCalibrationLoading(true);
      setApiStatus({ loading: true, lastSync: apiStatus.lastSync });
      showNotification('Загрузка тарировочных таблиц...', 'info');
      
      // Используем сервис для получения данных тарировочных таблиц
      const startTime = new Date();
      const data = await calibrationService.getCalibrationData(vehicleId);
      const endTime = new Date();
      const requestTime = (endTime - startTime) / 1000; // время в секундах

      console.log(`Получены калибровочные данные за ${requestTime.toFixed(2)} сек:`, data);
      
      // Добавляем запись в историю синхронизации (если она есть)
      if (typeof addToSyncHistory === 'function') {
        addToSyncHistory('GET', 'Загрузка данных', data.length, true, requestTime);
      }

      // Преобразуем полученные данные в объект с ключами по номерам датчиков
      const formattedData = calibrationService.formatCalibrationData(data);
      setCalibrationData(formattedData);
      
      // Установка количества датчиков на основе полученных данных
      const sensorsFromData = Object.keys(formattedData).length;
      if (sensorsFromData > 0) {
        setSensorCount(sensorsFromData);
        localStorage.setItem('vehicleSensorCount_' + vehicleId, sensorsFromData);
        showNotification(`Загружены данные для ${sensorsFromData} датчиков`, 'success');
      } else {
        showNotification('Тарировочные таблицы не найдены', 'info');
      }
      
      setCalibrationLoading(false);
      setApiStatus({ loading: false, lastSync: new Date() });
    } catch (err) {
      console.error('Ошибка при загрузке калибровочных данных:', err);
      setCalibrationLoading(false);
      setApiStatus({ loading: false, lastSync: apiStatus.lastSync });
      showNotification(`Ошибка загрузки данных: ${err.message}`, 'error');
      
      // Добавляем запись об ошибке в историю синхронизации (если она есть)
      if (typeof addToSyncHistory === 'function') {
        addToSyncHistory('GET', 'Загрузка данных', 0, false, 0, err.message);
      }
    }
  };
  
  // Добавление записи в историю синхронизации
  const addToSyncHistory = (method, action, count, success, time, errorMsg = null) => {
    setSyncHistory(prev => {
      const newHistory = [
        {
          id: Date.now(),
          timestamp: new Date(),
          method,
          action,
          count,
          success,
          time,
          errorMsg
        },
        ...prev.slice(0, 9) // Сохраняем только последние 10 записей
      ];
      return newHistory;
    });
  };
  
  // Добавить скрипт для обработки событий после монтирования компонента
  useEffect(() => {
    if (!loading && vehicle) {
      initializeEventHandlers();
      addFixedSaveButton();
      
      // Инициализируем состояние сворачивания секций из localStorage
      document.querySelectorAll('.section').forEach(section => {
        const sectionId = section.classList[0]; // Используем первый класс как идентификатор
        const isCollapsed = localStorage.getItem(sectionId) === 'true';
        
        if (isCollapsed) {
          setCollapsedSections(prev => ({
            ...prev,
            [sectionId]: true
          }));
        }
      });
      
      // Загрузка количества датчиков из localStorage или профиля ТС
      const savedSensorCount = localStorage.getItem('vehicleSensorCount_' + getVehicleId());
      if (savedSensorCount !== null) {
        setSensorCount(parseInt(savedSensorCount, 10));
      } else if (vehicle.sensor_count !== undefined) {
        setSensorCount(vehicle.sensor_count);
      }
      
      // Очистка при размонтировании
      return () => {
        if (fixedSaveBtnContainerRef.current && fixedSaveBtnContainerRef.current.parentNode) {
          fixedSaveBtnContainerRef.current.parentNode.removeChild(fixedSaveBtnContainerRef.current);
        }
      };
    }
  }, [loading, vehicle]);
  
  // Функция для инициализации обработчиков событий
  const initializeEventHandlers = () => {
    console.log('Инициализация обработчиков событий...');
  };
  
  // Функция для добавления фиксированной кнопки сохранения
  const addFixedSaveButton = () => {
    if (!fixedSaveBtnContainerRef.current) {
      // Создаем контейнер для кнопки
      const btnContainer = document.createElement('div');
      btnContainer.className = 'fixed-save-btn-container';
      btnContainer.style.position = 'fixed';
      btnContainer.style.bottom = '0';
      
      // Получаем размеры и позицию основного контента
      const contentRect = profileContentRef.current?.getBoundingClientRect() || { left: 0, width: 0 };
      const leftOffset = contentRect.left;
      
      // Устанавливаем левое и правое положение так, чтобы кнопка находилась только в области контента
      btnContainer.style.left = leftOffset + 'px';
      btnContainer.style.width = contentRect.width + 'px';
      btnContainer.style.zIndex = '1000';
      btnContainer.style.textAlign = 'center';
      btnContainer.style.padding = '0';
      
      // Создаем кнопку
      const saveButton = document.createElement('button');
      saveButton.className = 'fixed-save-btn';
      saveButton.innerHTML = '<i class="fas fa-save"></i> Сохранить все настройки';
      btnContainer.appendChild(saveButton);
      
      // Сохраняем ссылку на контейнер
      fixedSaveBtnContainerRef.current = btnContainer;
      
      // Добавляем кнопку на страницу
      document.body.appendChild(btnContainer);
      
      // Обновляем положение при изменении размера окна
      window.addEventListener('resize', function() {
        const updatedRect = profileContentRef.current?.getBoundingClientRect() || { left: 0, width: 0 };
        btnContainer.style.left = updatedRect.left + 'px';
        btnContainer.style.width = updatedRect.width + 'px';
      });
      
      // Обработчик для кнопки сохранения с анимацией
      saveButton.addEventListener('click', async () => {
        console.log('Нажата кнопка сохранения всех настроек');
        
        // Добавляем класс анимации
        saveButton.classList.add('fixed-save-btn-animated');
        
        // Изменяем текст на "Сохранение..."
        const originalText = saveButton.innerHTML;
        saveButton.innerHTML = '<i class="fas fa-sync fa-spin"></i> Сохранение...';
        
        try {
          // Вызываем функцию сохранения
          await handleSaveAllSettings();
          
          // При успешном сохранении меняем текст на "Сохранено!"
          saveButton.innerHTML = '<i class="fas fa-check"></i> Сохранено!';
          saveButton.style.backgroundColor = '#4CAF50';
          
          // Через 3 секунды возвращаем исходный вид
          setTimeout(() => {
            saveButton.innerHTML = originalText;
            saveButton.classList.remove('fixed-save-btn-animated');
            saveButton.style.backgroundColor = '';
          }, 3000);
        } catch (error) {
          // При ошибке меняем текст и цвет
          saveButton.innerHTML = '<i class="fas fa-times"></i> Ошибка!';
          saveButton.style.backgroundColor = '#f44336';
          
          // Через 3 секунды возвращаем исходный вид
          setTimeout(() => {
            saveButton.innerHTML = originalText;
            saveButton.classList.remove('fixed-save-btn-animated');
            saveButton.style.backgroundColor = '';
          }, 3000);
        }
      });
    }
  };
  
  // Сохранение настроек ТС
  const handleSaveVehicleSettings = async () => {
    const vehicleId = getVehicleId();
    
    if (!vehicleId) {
      showNotification('Ошибка: ID транспортного средства не найден', 'error');
      return;
    }
    
    try {
      // Получаем настройки ТС для сохранения
      const vehicleSettings = {
        name: vehicle.name,
        garageNumber: vehicle.garageNumber,
        vehicleType: vehicle.vehicleType,
        type: vehicle.type,
        fuelType: vehicle.fuelType,
        fuelTankVolume: vehicle.fuelTankVolume,
        mileage: vehicle.mileage,
        licensePlate: vehicle.licensePlate
      };
      
      console.log('Сохранение настроек ТС:', vehicleSettings);
      showNotification('Отправка данных на сервер...', 'info');
      
      // Отправляем запрос через обновленный API сервис
      const result = await api.updateVehicle(vehicleId, vehicleSettings);
      
      console.log('Результат сохранения настроек ТС:', result);
      showNotification('Настройки транспортного средства сохранены', 'success');
    } catch (error) {
      console.error('Ошибка при сохранении настроек ТС:', error);
      
      // Проверяем, является ли ошибка ошибкой авторизации
      if (error.status === 401 || error.status === 403) {
        showNotification('Ошибка авторизации. Пожалуйста, войдите в систему заново.', 'error');
      } else {
        showNotification(`Ошибка сохранения: ${error.message || 'Неизвестная ошибка'}`, 'error');
      }
    }
  };
  
  // Сохранение настроек двигателя
  const handleSaveEngineSettings = async () => {
    const vehicleId = getVehicleId();
    
    if (!vehicleId) {
      showNotification('Ошибка: ID транспортного средства не найден', 'error');
      return;
    }
    
    try {
      // Получаем текущие настройки двигателя
      const engineSettings = {
        engineNumber: vehicle.engineNumber,
        engine_type: vehicle.engine_type
      };
      
      console.log('Сохранение настроек двигателя:', engineSettings);
      showNotification('Отправка данных на сервер...', 'info');
      
      // Используем обновленный API метод для сохранения настроек двигателя
      const result = await api.updateEngineSettings(vehicleId, engineSettings);
      
      console.log('Результат сохранения настроек двигателя:', result);
      showNotification('Настройки двигателя успешно сохранены', 'success');
    } catch (error) {
      console.error('Ошибка при сохранении настроек двигателя:', error);
      
      // Проверяем, является ли ошибка ошибкой авторизации
      if (error.status === 401 || error.status === 403) {
        showNotification('Ошибка авторизации. Пожалуйста, войдите в систему заново.', 'error');
      } else {
        showNotification(`Ошибка сохранения: ${error.message || 'Неизвестная ошибка'}`, 'error');
      }
    }
  };
  
  // Сохранение настроек терминала
  const handleSaveTerminalSettings = async () => {
    const vehicleId = getVehicleId();
    
    if (!vehicleId) {
      showNotification('Ошибка: ID транспортного средства не найден', 'error');
      return;
    }
    
    try {
      // Получаем текущие настройки терминала
      const terminalSettings = {
        imei: vehicle.imei,
        factoryNumber: vehicle.factoryNumber,
        terminal: vehicle.terminal,
        type: vehicle.type,
        phone: vehicle.phone,
        videoTerminalId: vehicle.videoTerminalId
      };
      
      console.log('Сохранение настроек терминала:', terminalSettings);
      showNotification('Отправка данных на сервер...', 'info');
      
      // Используем обновленный API метод для сохранения настроек терминала
      const result = await api.updateTerminalSettings(vehicleId, terminalSettings);
      
      console.log('Результат сохранения настроек терминала:', result);
      showNotification('Настройки терминала успешно сохранены', 'success');
    } catch (error) {
      console.error('Ошибка при сохранении настроек терминала:', error);
      
      // Проверяем, является ли ошибка ошибкой авторизации
      if (error.status === 401 || error.status === 403) {
        showNotification('Ошибка авторизации. Пожалуйста, войдите в систему заново.', 'error');
      } else {
        showNotification(`Ошибка сохранения: ${error.message || 'Неизвестная ошибка'}`, 'error');
      }
    }
  };
  
  // Функция для сохранения всех настроек
  const handleSaveAllSettings = async () => {
    const vehicleId = getVehicleId();
    
    if (!vehicleId) {
      showNotification('Ошибка: ID транспортного средства не найден', 'error');
      return;
    }
    
    try {
      // Собираем все данные для сохранения
      const allSettings = {
        // Данные о ТС
        name: vehicle.name,
        garageNumber: vehicle.garageNumber,
        vehicleType: vehicle.vehicleType,
        
        // Данные терминала
        imei: vehicle.imei,
        factoryNumber: vehicle.factoryNumber,
        terminal: vehicle.terminal,
        type: vehicle.type,
        phone: vehicle.phone,
        videoTerminalId: vehicle.videoTerminalId,
        
        // Данные о двигателе
        engineNumber: vehicle.engineNumber,
        engine_type: vehicle.engine_type,
        
        // Данные о топливе
        fuelType: vehicle.fuelType,
        fuelTankVolume: vehicle.fuelTankVolume,
        
        // Другие данные
        mileage: vehicle.mileage,
        licensePlate: vehicle.licensePlate,
        sensor_count: sensorCount
      };
      
      console.log('Сохранение всех настроек ТС:', allSettings);
      showNotification('Отправка данных на сервер...', 'info');
      
      // Используем новый API метод для сохранения всех настроек
      const result = await api.saveAllSettings(vehicleId, allSettings);
      
      console.log('Результат сохранения всех настроек:', result);
      showNotification('Все настройки успешно сохранены', 'success');
    } catch (error) {
      console.error('Ошибка при сохранении настроек:', error);
      
      // Проверяем, является ли ошибка ошибкой авторизации
      if (error.status === 401 || error.status === 403) {
        showNotification('Ошибка авторизации. Пожалуйста, войдите в систему заново.', 'error');
      } else {
        showNotification(`Ошибка сохранения: ${error.message || 'Неизвестная ошибка'}`, 'error');
      }
    }
  };
  
  // Функция для показа уведомлений
  const showNotification = (message, type) => {
    setNotification({
      show: true,
      message,
      type
    });
    
    // Скрываем уведомление через 5 секунд
    setTimeout(() => {
      setNotification(prev => ({
        ...prev,
        show: false
      }));
    }, 5000);
  };
  
  // Функция для получения иконки уведомления в зависимости от типа
  const getNotificationIcon = (type) => {
    switch(type) {
      case 'success':
        return <FontAwesomeIcon icon={faCheck} />;
      case 'error':
        return <FontAwesomeIcon icon={faExclamationCircle} />;
      case 'warning':
        return <FontAwesomeIcon icon={faExclamationTriangle} />;
      case 'info':
        return <FontAwesomeIcon icon={faInfoCircle} />;
      default:
        return <FontAwesomeIcon icon={faInfoCircle} />;
    }
  };
  
  // Функция для закрытия уведомления
  const handleCloseNotification = () => {
    setNotification(prev => ({
      ...prev,
      show: false
    }));
  };
  
  // Возврат к списку ТС
  const handleGoBack = () => {
    navigate('/vehicles');
  };
  
  // Отображение статуса ТС
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
  
  // Переключение состояния свернутости секции
  const toggleSection = (sectionId) => {
    // Обновляем состояние в React
    setCollapsedSections(prev => {
      const newState = {
        ...prev,
        [sectionId]: !prev[sectionId]
      };
      
      // Сохраняем в localStorage
      localStorage.setItem(sectionId, !prev[sectionId]);
      
      return newState;
    });
  };
  
  // Переключение вкладок
  const handleTabClick = (tab) => {
    setActiveTab(tab);
  };
  
  // Функция для изменения количества датчиков
  const handleSensorCountChange = (e) => {
    const count = parseInt(e.target.value, 10);
    setSensorCount(count);
    
    // Сохраняем в localStorage для данного ТС
    localStorage.setItem('vehicleSensorCount_' + getVehicleId(), count);
    
    // Инициализируем пустые таблицы для новых датчиков
    const newCalibrationData = { ...calibrationData };
    for (let i = 1; i <= count; i++) {
      if (!newCalibrationData[i]) {
        // Инициализируем с минимальной тарировочной таблицей
        newCalibrationData[i] = [
          { value: 0, liters: 0 }
        ];
      }
    }
    setCalibrationData(newCalibrationData);
  };
  
  // Сохранение настроек датчиков - всех таблиц сразу
  const handleSaveSensorsSettings = async () => {
    const vehicleId = getVehicleId();
    if (!vehicleId) {
      console.error('Отсутствует ID транспортного средства');
      showNotification('Ошибка: ID транспортного средства не найден', 'error');
      return;
    }
    
    // Проверяем, есть ли данные для сохранения
    const sensorCount = Object.keys(calibrationData).length;
    if (sensorCount === 0) {
      console.warn('Нет данных для сохранения (нет датчиков)');
      showNotification('Нет данных для сохранения', 'warning');
      return;
    }
    
    console.log(`Сохранение данных для всех датчиков (${sensorCount} шт):`, JSON.stringify(calibrationData));
    
    try {
      showLoader('Сохранение калибровочных данных...');
      setApiStatus({ loading: true, lastSync: apiStatus.lastSync });
      showNotification('Отправка тарировочных таблиц на сервер...', 'info');
      
      // Проверка данных перед отправкой
      console.log('Проверка данных перед подготовкой для отправки:');
      Object.entries(calibrationData).forEach(([sensorNumber, data]) => {
        console.log(`Датчик №${sensorNumber} (${data.length} строк):`);
        data.forEach((row, idx) => {
          console.log(`  Строка ${idx+1}: value=${row.value}, liters=${row.liters}`);
        });
      });
      
      // Подготавливаем данные для отправки
      const dataToSave = calibrationService.prepareCalibrationDataForSave(calibrationData);
      console.log('Подготовленные данные для отправки:', JSON.stringify(dataToSave));
      
      // Используем сервис для сохранения данных
      const startTime = new Date();
      console.log(`API вызов: saveCalibrationData(${vehicleId}, dataToSave)`);
      
      const result = await calibrationService.saveCalibrationData(vehicleId, dataToSave);
      const endTime = new Date();
      const requestTime = (endTime - startTime) / 1000; // время в секундах
      
      console.log(`Калибровочные данные сохранены за ${requestTime.toFixed(2)} сек. Ответ:`, result);
      
      // Добавляем запись в историю синхронизации
      addToSyncHistory('PUT', 'Сохранение всех таблиц', dataToSave.length, true, requestTime);
      
      // Сохраняем все данные в localStorage для восстановления при перезагрузке
      localStorage.setItem('calibrationData', JSON.stringify(calibrationData));
      
      // Принудительно обновляем все таблицы
      Object.keys(calibrationData).forEach(sensorNumber => {
        const sensorIndex = parseInt(sensorNumber) - 1;
        forceTableUpdate(sensorIndex);
      });
      
      // Обновляем локальный кэш калибровочных данных
      fetchCalibrationData(vehicleId);
      
      hideLoader();
      setApiStatus({ loading: false, lastSync: new Date() });
      showNotification(`Настройки для ${dataToSave.length} датчиков успешно сохранены`, 'success');
    } catch (err) {
      console.error('Ошибка при сохранении калибровочных данных:', err);
      console.error(`Детали запроса: vehicleId=${vehicleId}, количество датчиков=${sensorCount}`);
      console.error('Данные, которые пытались подготовить:', calibrationData);
      
      hideLoader();
      setApiStatus({ loading: false, lastSync: apiStatus.lastSync });
      showNotification(`Ошибка сохранения: ${err.message}`, 'error');
      
      // Добавляем запись об ошибке в историю синхронизации
      addToSyncHistory('PUT', 'Сохранение всех таблиц', 0, false, 0, err.message);
    }
  };
  
  // Функция для сохранения таблицы калибровки конкретного датчика
  const handleSaveSensorTable = async (sensorIndex) => {
    const sensorNumber = sensorIndex + 1;
    const vehicleId = getVehicleId();
    const sensorData = calibrationData[sensorNumber];
    
    if (!vehicleId) {
      console.error('Отсутствует ID транспортного средства');
      showNotification('Ошибка: ID транспортного средства не найден', 'error');
      return;
    }
    
    if (!sensorData || sensorData.length === 0) {
      console.warn(`Нет данных для сохранения для датчика ${sensorNumber}`);
      showNotification('Нет данных для сохранения', 'warning');
      return;
    }
    
    console.log(`Сохранение таблицы для датчика №${sensorNumber}:`, JSON.stringify(sensorData));
    
    try {
      setApiStatus({ loading: true, lastSync: apiStatus.lastSync });
      showNotification(`Сохранение таблицы для датчика №${sensorNumber}...`, 'info');
      
      // Данные для сохранения - проверяем формат
      console.log(`Проверка данных перед отправкой для датчика ${sensorNumber}:`);
      sensorData.forEach((row, idx) => {
        console.log(`  Строка ${idx+1}: value=${row.value}, liters=${row.liters}`);
      });
      
      // Используем сервис для сохранения данных конкретного датчика
      const startTime = new Date();
      console.log(`API вызов: saveSensorCalibration(${vehicleId}, ${sensorNumber}, data)`);
      
      const result = await calibrationService.saveSensorCalibration(vehicleId, sensorNumber, sensorData);
      const endTime = new Date();
      const requestTime = (endTime - startTime) / 1000; // время в секундах
      
      console.log(`Калибровочная таблица для датчика ${sensorNumber} сохранена за ${requestTime.toFixed(2)} сек. Ответ:`, result);
      
      // Добавляем запись в историю синхронизации
      addToSyncHistory('PUT', `Сохранение таблицы №${sensorNumber}`, 1, true, requestTime);
      
      // Также сохраняем в localStorage для быстрого восстановления при перезагрузке
      localStorage.setItem(`calibrationData_sensor_${sensorNumber}`, JSON.stringify(sensorData));
      
      // Принудительно обновляем таблицу
      forceTableUpdate(sensorIndex);
      
      setApiStatus({ loading: false, lastSync: new Date() });
      showNotification(`Таблица для датчика №${sensorNumber} успешно сохранена`, 'success');
    } catch (err) {
      console.error('Ошибка при сохранении калибровочной таблицы:', err);
      console.error(`Детали запроса: vehicleId=${vehicleId}, sensorNumber=${sensorNumber}`);
      console.error('Данные, которые пытались сохранить:', sensorData);
      
      setApiStatus({ loading: false, lastSync: apiStatus.lastSync });
      showNotification(`Ошибка при сохранении таблицы для датчика №${sensorNumber}: ${err.message}`, 'error');
      
      // Добавляем запись об ошибке в историю синхронизации
      addToSyncHistory('PUT', `Сохранение таблицы №${sensorNumber}`, 0, false, 0, err.message);
    }
  };
  
  // Функция для принудительного обновления таблицы
  const forceTableUpdate = (sensorIndex) => {
    const sensorNumber = sensorIndex + 1;
    console.log(`Принудительное обновление таблицы для датчика №${sensorNumber}`);
    
    // Используем setTimeout для гарантии что обновление произойдет после рендеринга
    setTimeout(() => {
      // Находим DOM-элемент таблицы и обновляем его содержимое
      const tableElement = document.getElementById(`sensor-table-${sensorNumber}`);
      if (tableElement) {
        // Обновляем классы таблицы, чтобы сработала анимация обновления
        tableElement.classList.add('table-updated');
        setTimeout(() => {
          tableElement.classList.remove('table-updated');
        }, 1000);
      }
    }, 100);
  };
  
  // Обновим функцию handleImportExcel, чтобы вызывать forceTableUpdate
  const handleImportExcel = (sensorIndex) => {
    const sensorNumber = sensorIndex + 1;
    
    console.log(`Запуск импорта Excel для датчика №${sensorNumber}`);
    
    // Создаем скрытый input для выбора файла
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.xlsx,.xls';
    fileInput.style.display = 'none';
    
    // Обработчик выбора файла
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) {
        console.log('Файл не выбран');
        return;
      }
      
      console.log(`Выбран файл: ${file.name}`);
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target.result);
          // Добавляем явные параметры кодировки и типа для поддержки кириллицы
          const workbook = XLSX.read(data, { 
            type: 'array',
            codepage: 65001, // UTF-8
            raw: true
          });
          
          // Получаем первый лист
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Преобразуем данные в массив объектов с поддержкой кириллицы
          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            raw: false, // Обрабатывать все значения как строки
            defval: '', // Значение по умолчанию для пустых ячеек
            blankrows: false // Пропускать пустые строки
          });
          
          console.log('Данные из Excel:', jsonData);
          
          if (jsonData.length === 0) {
            console.error('Файл не содержит данных');
            showNotification('Файл не содержит данных', 'error');
            return;
          }
          
          // Выводим имена всех столбцов для отладки
          console.log('Доступные заголовки в Excel:', Object.keys(jsonData[0]));
          
          // Более гибкая проверка заголовков (игнорируем регистр и лишние пробелы)
          let valueColumnName = null;
          let litersColumnName = null;
          
          // Ищем подходящие названия столбцов
          Object.keys(jsonData[0]).forEach(header => {
            const headerLower = header.toLowerCase().trim();
            if (headerLower === 'показания датчика' || headerLower === 'показания' || headerLower === 'датчик') {
              valueColumnName = header;
            }
            if (headerLower === 'литры' || headerLower === 'объем' || headerLower === 'литр') {
              litersColumnName = header;
            }
          });
          
          console.log('Найденные столбцы:', { valueColumnName, litersColumnName });
          
          if (!valueColumnName || !litersColumnName) {
            console.error('Не найдены нужные столбцы');
            showNotification('Неверный формат файла. Файл должен содержать столбцы "Показания датчика" и "Литры"', 'error');
            return;
          }
          
          // Преобразуем данные в формат для тарировочной таблицы
          const calibrationTableData = jsonData.map((row, idx) => {
            const litersValue = parseFloat(row[litersColumnName]);
            const sensorValue = parseFloat(row[valueColumnName]);
            
            // Проверка на корректность данных
            if (isNaN(litersValue) || isNaN(sensorValue)) {
              console.warn(`Строка ${idx+1} содержит некорректные данные:`, row);
            }
            
            return {
              liters: isNaN(litersValue) ? 0 : litersValue,
              value: isNaN(sensorValue) ? 0 : sensorValue
            };
          });
          
          console.log('Преобразованные данные для таблицы:', calibrationTableData);
          
          // Обновляем данные калибровки
          setCalibrationData(prevData => {
            const newData = {
              ...prevData,
              [sensorNumber]: calibrationTableData
            };
            console.log('Новые данные калибровки:', newData);
            return newData;
          });
          
          // Принудительно обновляем таблицу
          forceTableUpdate(sensorIndex);
          
          showNotification(`Данные для датчика №${sensorNumber} успешно импортированы (${calibrationTableData.length} строк)`, 'success');
        } catch (err) {
          console.error('Ошибка при импорте из Excel:', err);
          showNotification(`Ошибка импорта: ${err.message}`, 'error');
        }
      };
      
      reader.readAsArrayBuffer(file);
    };
    
    // Добавляем элемент на страницу и вызываем клик для открытия диалога выбора файла
    document.body.appendChild(fileInput);
    fileInput.click();
    
    // Удаляем элемент после использования
    setTimeout(() => {
      if (fileInput && fileInput.parentNode) {
        document.body.removeChild(fileInput);
      }
    }, 5000);
  };
  
  // Экспорт таблицы в Excel
  const handleExportExcel = (sensorIndex) => {
    const sensorNumber = sensorIndex + 1;
    const sensorData = calibrationData[sensorNumber] || [];
    
    if (sensorData.length === 0) {
      showNotification('Нет данных для экспорта', 'warning');
      return;
    }
    
    try {
      // Подготовка данных для экспорта
      const exportData = sensorData.map(row => ({
        'Показания датчика': row.value,
        'Литры': row.liters
      }));
      
      // Создание рабочей книги с параметрами для кириллицы
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      
      // Настройка кодировки для корректного отображения кириллицы
      XLSX.utils.book_append_sheet(workbook, worksheet, `Датчик ${sensorNumber}`);
      
      // Настройка параметров записи для поддержки кириллицы
      const writeOptions = { 
        bookType: 'xlsx',
        type: 'array',
        bookSST: true, // Использовать общую таблицу строк для уменьшения размера файла
        codepage: 65001 // UTF-8
      };
      
      // Сохранение файла с кодировкой UTF-8
      const fileName = `Calibration_Sensor_${sensorNumber}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(workbook, fileName, writeOptions);
      
      showNotification(`Таблица для датчика №${sensorNumber} успешно экспортирована в Excel`, 'success');
    } catch (err) {
      console.error('Ошибка при экспорте в Excel:', err);
      showNotification(`Ошибка экспорта: ${err.message}`, 'error');
    }
  };
  
  // Отображение модального окна с информацией о формате Excel
  const renderExcelFormatModal = () => {
    if (!showExcelFormatModal) return null;
    
    return (
      <div className="excel-modal show">
        <div className="excel-modal-content">
          <div className="excel-modal-header">
            <h3>Формат файла для импорта/экспорта</h3>
            <button 
              className="excel-modal-close" 
              onClick={() => setShowExcelFormatModal(false)}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
          
          <div className="excel-modal-body">
            <div className="excel-format-info">
              <FontAwesomeIcon icon={faInfoCircle} />
              <div>
                <p><strong>Требования к формату файла Excel:</strong></p>
                <ul>
                  <li>Файл должен содержать два столбца с заголовками: &quot;Показания датчика&quot; и &quot;Литры&quot;</li>
                  <li>Значения должны быть числовыми (целые или дробные)</li>
                  <li>Литры должны возрастать от строки к строке</li>
                  <li>Рекомендуется не более 50 строк для лучшей производительности</li>
                </ul>
                <p>При экспорте файл сохраняется автоматически в этом формате.</p>
              </div>
            </div>
            
            <p>Пример правильного формата файла:</p>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Показания датчика</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Литры</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>0</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>0</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>100</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>20</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>200</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>40</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };
  
  // Отображение калибровочной таблицы для датчика
  const renderSensorTable = (sensorIndex) => {
    const sensorNumber = sensorIndex + 1;
    const sensorData = calibrationData[sensorNumber] || [
      { value: 0, liters: 0 },
    ];
    console.log(`Отображение таблицы для датчика №${sensorNumber}:`, sensorData);

    // Проверка корректности данных для отображения
    if (!Array.isArray(sensorData)) {
      console.error(`Данные для датчика №${sensorNumber} не являются массивом:`, sensorData);
    return (
      <div className="calibration-table" key={`sensor-${sensorIndex}`}>
        <h3>
          <FontAwesomeIcon icon={faMicrochip} /> Датчик №{sensorNumber}
        </h3>
          <div className="calibration-error">
            <p>Ошибка формата данных. Пожалуйста, импортируйте данные заново.</p>
          </div>
          <div className="calibration-actions">
            <button className="import-excel-btn" onClick={() => handleImportExcel(sensorIndex)}>
              <FontAwesomeIcon icon={faFileImport} /> Импорт Excel
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="calibration-table" key={`sensor-${sensorIndex}`} id={`sensor-table-${sensorNumber}`}>
        <h3>
          <FontAwesomeIcon icon={faMicrochip} /> Датчик №{sensorNumber}
        </h3>
        <div className="calibration-info">
          <p className="calibration-format-info">
            <FontAwesomeIcon icon={faInfoCircle} /> Данные хранятся в формате массива [показания датчика, литры] и конвертируются при отображении
          </p>
        </div>
        
        {/* Информация о формате Excel */}
        <div className="excel-format-info">
          <FontAwesomeIcon icon={faInfoCircle} />
          <div>
            <p>
              Импорт и экспорт таблицы доступны в формате Excel.
              <button 
                onClick={() => setShowExcelFormatModal(true)} 
                style={{ 
                  background: 'none',
                  border: 'none',
                  color: '#007bff',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: '0 5px',
                  fontSize: 'inherit'
                }}
              >
                Подробнее о формате
              </button>
            </p>
          </div>
        </div>
        
        <div className="calibration-grid">
          <div className="header">Показания датчика</div>
          <div className="header">Литры</div>
          <div className="header delete-header"></div>
          
          {sensorData.map((row, rowIndex) => {
            // Проверка корректности каждой строки
            const valueDisplay = row.value !== undefined ? row.value : 'Ошибка';
            const litersDisplay = row.liters !== undefined ? row.liters : 'Ошибка';
            
            return (
            <React.Fragment key={`row-${rowIndex}`}>
              <div 
                className="editable" 
                contentEditable 
                suppressContentEditableWarning={true}
                  onBlur={(e) => handleCalibrationValueChange(sensorIndex, rowIndex, 'value', e.target.innerText)}
              >
                  {valueDisplay}
              </div>
              <div 
                className="editable" 
                contentEditable 
                suppressContentEditableWarning={true}
                  onBlur={(e) => handleCalibrationValueChange(sensorIndex, rowIndex, 'liters', e.target.innerText)}
              >
                  {litersDisplay}
              </div>
              <button 
                className="delete-row-btn" 
                onClick={() => handleDeleteRow(sensorIndex, rowIndex)}
              >
                <FontAwesomeIcon icon={faTrash} />
              </button>
            </React.Fragment>
            );
          })}
        </div>
        <div className="calibration-actions">
          <button className="add-row-btn" onClick={() => handleAddRow(sensorIndex)}>
            <FontAwesomeIcon icon={faPlus} /> Добавить строку
          </button>
          <button className="save-table-btn" onClick={() => handleSaveSensorTable(sensorIndex)}>
            <FontAwesomeIcon icon={faSave} /> Сохранить
          </button>
          <button className="import-excel-btn" onClick={() => handleImportExcel(sensorIndex)}>
            <FontAwesomeIcon icon={faFileImport} /> Импорт Excel
          </button>
          <button className="export-excel-btn" onClick={() => handleExportExcel(sensorIndex)}>
            <FontAwesomeIcon icon={faFileExport} /> Экспорт Excel
          </button>
        </div>
      </div>
    );
  };
  
  // Функция для добавления строки в калибровочную таблицу
  const handleAddRow = (sensorIndex) => {
    const sensorNumber = sensorIndex + 1;
    
    // Создаем копию данных таблицы для этого датчика
    const sensorData = [...(calibrationData[sensorNumber] || [])];
    
    // Добавляем новую строку
    const lastRow = sensorData.length > 0 ? sensorData[sensorData.length - 1] : { value: 0, liters: 0 };
    const newRow = { 
      value: parseFloat(lastRow.value), 
      liters: parseFloat(lastRow.liters) 
    };
    
    sensorData.push(newRow);
    
    // Обновляем данные калибровки
    setCalibrationData({
      ...calibrationData,
      [sensorNumber]: sensorData
    });
    
    console.log(`Добавлена строка для датчика ${sensorNumber}:`, newRow);
  };
  
  // Функция для удаления строки из калибровочной таблицы
  const handleDeleteRow = (sensorIndex, rowIndex) => {
    const sensorNumber = sensorIndex + 1;
    
    // Создаем копию данных таблицы для этого датчика
    const sensorData = [...(calibrationData[sensorNumber] || [])];
    
    // Если осталась только одна строка, не удаляем ее
    if (sensorData.length <= 1) {
      showNotification('Нельзя удалить последнюю строку таблицы', 'warning');
      return;
    }
    
    // Удаляем строку
    sensorData.splice(rowIndex, 1);
    
    // Обновляем данные калибровки
    setCalibrationData({
      ...calibrationData,
      [sensorNumber]: sensorData
    });
    
    console.log(`Удалена строка ${rowIndex} для датчика ${sensorNumber}`);
  };
  
  // Функция для изменения значения в таблице калибровки
  const handleCalibrationValueChange = (sensorIndex, rowIndex, field, value) => {
    const sensorNumber = sensorIndex + 1;
    
    // Создаем копию данных таблицы для этого датчика
    const sensorData = [...(calibrationData[sensorNumber] || [])];
    
    // Обновляем значение в указанной ячейке
    sensorData[rowIndex] = {
      ...sensorData[rowIndex],
      [field]: parseFloat(value)
    };
    
    // Обновляем данные калибровки
    setCalibrationData({
      ...calibrationData,
      [sensorNumber]: sensorData
    });
  };
  
  // Отображение истории синхронизации
  const renderSyncHistory = () => {
    if (syncHistory.length === 0) {
      return (
        <div className="no-history-message">
          <p>Нет истории синхронизации</p>
        </div>
      );
    }
    
    return (
      <div className="sync-history">
        <h3>История синхронизации</h3>
        <div className="sync-history-table">
          <div className="sync-history-header">
            <div className="sync-time">Время</div>
            <div className="sync-action">Операция</div>
            <div className="sync-duration">Длительность</div>
          </div>
          {syncHistory.map(item => (
            <div key={item.id} className={`sync-history-row ${item.success ? 'success' : 'error'}`}>
              <div className="sync-time">{item.timestamp.toLocaleTimeString()}</div>
              <div className="sync-action">{item.action}</div>
              
              <div className="sync-duration">
                {item.success ? `${item.time.toFixed(2)} сек` : '-'}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  // Добавим эффект для отслеживания изменений в данных калибровки
  useEffect(() => {
    console.log('Данные калибровки обновлены:', calibrationData);
    
    // Сохраняем данные в localStorage для восстановления при перезагрузке
    localStorage.setItem('calibrationData', JSON.stringify(calibrationData));
  }, [calibrationData]);
  
  // Загрузка данных калибровки из localStorage при инициализации
  useEffect(() => {
    const savedData = localStorage.getItem('calibrationData');
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        console.log('Загружены сохраненные данные калибровки:', parsedData);
        setCalibrationData(parsedData);
      } catch (error) {
        console.error('Ошибка при загрузке данных из localStorage:', error);
      }
    }
  }, []);
  
  // Рендер компонента
  return (
    <div className="vehicle-profile-layout">
      {/* Боковое меню */}
      <Sidebar />
      
      {/* Основной контент */}
      <div className="main-content">
        {/* Верхняя панель с кнопками */}
        
        
        {/* Табы для переключения между разделами */}
        <div className="tabs">
          <div 
            className={`tab ${activeTab === 'profile' ? 'active' : ''}`} 
            onClick={() => handleTabClick('profile')}
          >
            Профиль
          </div>
          <div 
            className={`tab ${activeTab === 'settings' ? 'active' : ''}`} 
            onClick={() => handleTabClick('settings')}
          >
            Настройки
          </div>
          <div 
            className={`tab ${activeTab === 'monitoring' ? 'active' : ''}`} 
            onClick={() => handleTabClick('monitoring')}
          >
            Мониторинг
          </div>
        </div>
        
        {/* Отображение данных */}
        {loading ? (
          <div className="loading-container">
            <p>Загрузка данных транспортного средства...</p>
          </div>
        ) : error ? (
          <div className="error-container">
            <p className="error-message">{error}</p>
            <button className="control-button" onClick={handleGoBack}>
              Вернуться к списку ТС
            </button>
          </div>
        ) : vehicle ? (
          <div className="profile-content" ref={profileContentRef}>
            {/* Заголовок профиля ТС */}
            <div className="vehicle-profile">
              <div className="vehicle-header">
                <div className="vehicle-title">
                  <FontAwesomeIcon icon={faTruck} className="vehicle-icon" />
                  <h1>{vehicle.name}</h1>
                </div>
                <div className={`vehicle-status ${getStatusClass(vehicle.status)}`}>
                  {vehicle.status || 'Нет данных'}
                </div>
              </div>
            
              {/* Секция терминала */}
              <div className="section terminal-section">
                <div className="section-header" onClick={() => toggleSection('terminal-section')}>
                  <h2>
                    <FontAwesomeIcon icon={faTerminal} /> Терминал
                  </h2>
                  <FontAwesomeIcon 
                    icon={faChevronDown} 
                    className={`toggle-section ${collapsedSections['terminal-section'] ? 'rotated' : ''}`} 
                  />
                </div>
                
                <div className={`section-content ${collapsedSections['terminal-section'] ? 'collapsed' : ''}`}>
                  <div className="info-row">
                    <span className="label">IMEI терминала:</span>
                    <input 
                      type="text" 
                      name="imei" 
                      value={vehicle.imei || ''} 
                      onChange={(e) => setVehicle({...vehicle, imei: e.target.value})}
                    />
                  </div>
                  <div className="info-row">
                    <span className="label">Заводской номер:</span>
                    <input 
                      type="text" 
                      name="factoryNumber" 
                      value={vehicle.factoryNumber || vehicle.factory_number || ''} 
                      onChange={(e) => setVehicle({...vehicle, factoryNumber: e.target.value})}
                    />
                  </div>
                  <div className="info-row">
                    <span className="label">Тип терминала:</span>
                    <input 
                      type="text" 
                      name="terminal" 
                      value={vehicle.terminal || ''} 
                      onChange={(e) => setVehicle({...vehicle, terminal: e.target.value})}
                    />
                  </div>
                  <div className="info-row">
                    <span className="label">Тип:</span>
                    <select 
                      name="type" 
                      value={vehicle.type || ''} 
                      onChange={(e) => setVehicle({...vehicle, type: e.target.value})}
                    >
                      <option value="car">Легковушка</option>
                      <option value="heavyvehicle">Тяжеловес</option>
                      <option value="truck">Грузовик</option>
                      <option value="bus">Автобус</option>
                      <option value="specialvehicle">Спецтехника</option>
                      <option value="other">Другое</option>
                    </select>
                  </div>
                  <div className="info-row">
                    <span className="label">Номер SIM терминала:</span>
                    <input 
                      type="text" 
                      name="phone" 
                      value={vehicle.phone || ''} 
                      onChange={(e) => setVehicle({...vehicle, phone: e.target.value})}
                    />
                  </div>
                  <div className="info-row">
                    <span className="label">ID видеотерминала:</span>
                    <input 
                      type="text" 
                      name="videoTerminalId" 
                      value={vehicle.videoTerminalId || ''} 
                      onChange={(e) => setVehicle({...vehicle, videoTerminalId: e.target.value})}
                      placeholder="Введите ID видеотерминала"
                    />
                  </div>
                  <div className="info-row mt-4 text-center">
                    <button type="button" className="btn-profile" onClick={handleSaveTerminalSettings}>
                      <FontAwesomeIcon icon={faSave} /> Сохранить настройки терминала
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Секция транспортного средства */}
              <div className="section vehicle-section">
                <div className="section-header" onClick={() => toggleSection('vehicle-section')}>
                  <h2>
                    <FontAwesomeIcon icon={faCar} /> Транспортное средство
                  </h2>
                  <FontAwesomeIcon 
                    icon={faChevronDown} 
                    className={`toggle-section ${collapsedSections['vehicle-section'] ? 'rotated' : ''}`} 
                  />
                </div>
                
                <div className={`section-content ${collapsedSections['vehicle-section'] ? 'collapsed' : ''}`}>
                  <div className="profile-grid">
                    <div className="profile-item">
                      <div className="profile-label">ID:</div>
                      <div className="profile-value">{vehicle.id}</div>
                    </div>
                    <div className="profile-item">
                      <div className="profile-label">Гаражный номер:</div>
                      <div className="profile-value">{vehicle.garage_number || vehicle.garageNumber || '-'}</div>
                    </div>
                    <div className="profile-item">
                      <div className="profile-label">Заводской номер:</div>
                      <div className="profile-value">{vehicle.factory_number || vehicle.factoryNumber || '-'}</div>
                    </div>
                    <div className="profile-item">
                      <div className="profile-label">Тип ТС:</div>
                      <div className="profile-value">{vehicle.type || vehicle.vehicleType || '-'}</div>
                    </div>
                    <div className="profile-item">
                      <div className="profile-label">Группы:</div>
                      <div className="profile-value">{vehicle.groups || '-'}</div>
                    </div>
                    <div className="profile-item">
                      <div className="profile-label">Дата создания:</div>
                      <div className="profile-value">{vehicle.created_at || vehicle.createdAt || '-'}</div>
                    </div>
                  </div>
                  <div className="info-row mt-4 text-center">
                    <button type="button" className="btn-profile" onClick={handleSaveVehicleSettings}>
                      <FontAwesomeIcon icon={faSave} /> Сохранить настройки ТС
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Секция телематики */}
              <div className="section telematics-section">
                <div className="section-header" onClick={() => toggleSection('telematics-section')}>
                  <h2>
                    <FontAwesomeIcon icon={faDatabase} /> Телематика
                  </h2>
                  <FontAwesomeIcon 
                    icon={faChevronDown} 
                    className={`toggle-section ${collapsedSections['telematics-section'] ? 'rotated' : ''}`} 
                  />
                </div>
                
                <div className={`section-content ${collapsedSections['telematics-section'] ? 'collapsed' : ''}`}>
                  <div className="profile-grid">
                    <div className="profile-item">
                      <div className="profile-label">IMEI:</div>
                      <div className="profile-value">{vehicle.imei || '-'}</div>
                    </div>
                    <div className="profile-item">
                      <div className="profile-label">Телефон:</div>
                      <div className="profile-value">{vehicle.phone || '-'}</div>
                    </div>
                    <div className="profile-item">
                      <div className="profile-label">Терминал:</div>
                      <div className="profile-value">{vehicle.terminal || '-'}</div>
                    </div>
                    <div className="profile-item">
                      <div className="profile-label">Последние данные:</div>
                      <div className="profile-value">{vehicle.last_data || vehicle.lastData || '-'}</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Секция топливной системы */}
              <div className="section fuel-section">
                <div className="section-header" onClick={() => toggleSection('fuel-section')}>
                  <h2>
                    <FontAwesomeIcon icon={faGasPump} /> Топливная система
                  </h2>
                  <FontAwesomeIcon 
                    icon={faChevronDown} 
                    className={`toggle-section ${collapsedSections['fuel-section'] ? 'rotated' : ''}`} 
                  />
                </div>
                
                <div className={`section-content ${collapsedSections['fuel-section'] ? 'collapsed' : ''}`}>
                  <div className="profile-grid">
                    <div className="profile-item">
                      <div className="profile-label">Тип топлива:</div>
                      <div className="profile-value">{vehicle.fuel_type || vehicle.fuelType || '-'}</div>
                    </div>
                    <div className="profile-item">
                      <div className="profile-label">Объем бака:</div>
                      <div className="profile-value">
                        {vehicle.fuel_tank_volume || vehicle.fuelTankVolume ? 
                          `${vehicle.fuel_tank_volume || vehicle.fuelTankVolume} л` : '-'}
                      </div>
                    </div>
                    <div className="profile-item">
                      <div className="profile-label">Моточасы:</div>
                      <div className="profile-value">{vehicle.engineHours || '-'}</div>
                    </div>
                    <div className="profile-item">
                      <div className="profile-label">Пробег:</div>
                      <div className="profile-value">
                        {vehicle.mileage ? `${vehicle.mileage} км` : '-'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Секция оборотов двигателя */}
              <div className="section engine-rpm-section">
                <div className="section-header" onClick={() => toggleSection('engine-rpm-section')}>
                  <h2>
                    <FontAwesomeIcon icon={faCar} /> Обороты двигателя
                  </h2>
                  <FontAwesomeIcon 
                    icon={faChevronDown} 
                    className={`toggle-section ${collapsedSections['engine-rpm-section'] ? 'rotated' : ''}`} 
                  />
                </div>
                
                <div className={`section-content ${collapsedSections['engine-rpm-section'] ? 'collapsed' : ''}`}>
                  <div className="info-row">
                    <span className="label">Порог двигателя:</span>
                    <input 
                      type="number" 
                      name="engineNumber" 
                      value={vehicle.engineNumber || ''} 
                      onChange={(e) => setVehicle({...vehicle, engineNumber: e.target.value})}
                      placeholder="Введите пороговое значение"
                      min="0"
                      step="1"
                    />
                  </div>
                  
                  <div className="info-row">
                    <span className="label">Тип двигателя:</span>
                    <input 
                      type="text" 
                      name="engine_type" 
                      value={vehicle.engine_type || ''} 
                      onChange={(e) => setVehicle({...vehicle, engine_type: e.target.value})}
                      placeholder="Введите тип двигателя"
                    />
                  </div>
                  
                  <div className="info-row mt-4 text-center">
                    <button type="button" className="btn-profile" onClick={handleSaveEngineSettings}>
                      <FontAwesomeIcon icon={faSave} /> Сохранить настройки двигателя
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Секция калибровочных таблиц */}
              <div className="section calibration-section">
                <div className="section-header" onClick={() => toggleSection('calibration-section')}>
                  <h2>
                    <FontAwesomeIcon icon={faEdit} /> Редактирование тарировочных таблиц
                  </h2>
                  <FontAwesomeIcon 
                    icon={faChevronDown} 
                    className={`toggle-section ${collapsedSections['calibration-section'] ? 'rotated' : ''}`} 
                  />
                </div>
                
                <div className={`section-content ${collapsedSections['calibration-section'] ? 'collapsed' : ''}`}>
                  {/* Статус API и последняя синхронизация */}
                  <div className="api-status">
                    <div className={`api-status-indicator ${apiStatus.loading ? 'loading' : ''}`}>
                      {apiStatus.loading ? (
                        <span className="status-loading">Выполняется синхронизация...</span>
                      ) : apiStatus.lastSync ? (
                        <span className="status-synced">
                          <FontAwesomeIcon icon={faCheck} /> Последняя синхронизация: {apiStatus.lastSync.toLocaleString()}
                        </span>
                      ) : (
                        <span className="status-not-synced">
                          <FontAwesomeIcon icon={faInfoCircle} /> Данные не синхронизированы
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Выбор количества датчиков */}
                  <div className="info-row">
                    <span className="label">Количество датчиков:</span>
                    <select 
                      name="sensor_count" 
                      value={sensorCount} 
                      onChange={handleSensorCountChange}
                      className="sensor-count-select"
                    >
                      <option value="0">Нет датчиков</option>
                      <option value="1">1 датчик</option>
                      <option value="2">2 датчика</option>
                      <option value="3">3 датчика</option>
                      <option value="4">4 датчика</option>
                      <option value="5">5 датчиков</option>
                      <option value="6">6 датчиков</option>
                    </select>
                    
                    {/* Кнопка обновления данных */}
                    <button 
                      className="refresh-data-btn" 
                      onClick={() => fetchCalibrationData(getVehicleId())}
                      disabled={calibrationLoading}
                    >
                      <FontAwesomeIcon icon={faDatabase} /> Обновить данные
                    </button>
                  </div>
                  
                  {/* Информация, если нет датчиков */}
                  {sensorCount === 0 && (
                    <div className="no-sensors-message">
                      <p>Для этого транспортного средства не настроены датчики уровня топлива.</p>
                      <p>Выберите количество датчиков в выпадающем списке для настройки.</p>
                    </div>
                  )}
                  
                  {/* Информация во время загрузки калибровочных данных */}
                  {calibrationLoading ? (
                    <div className="calibration-loading">
                      <p>Загрузка данных калибровочных таблиц...</p>
                    </div>
                  ) : (
                    <>
                      {/* Отображение таблиц датчиков в зависимости от выбранного количества */}
                      {sensorCount > 0 && (
                        <div className="calibration-tables-container">
                          <div className="calibration-tables-grid">
                            {Array.from({ length: Math.min(sensorCount, 6) }, (_, index) => (
                              <div className="calibration-table-cell" key={`sensor-cell-${index}`}>
                                {renderSensorTable(index)}
                              </div>
                            ))}
                          </div>
                          
                          {/* Предупреждение, если датчиков больше 6 */}
                          {sensorCount > 6 && (
                            <div className="sensors-warning">
                              <FontAwesomeIcon icon={faInfoCircle} />
                              <span>Отображаются только первые 6 датчиков. Для редактирования остальных датчиков уменьшите общее количество датчиков.</span>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Кнопка сохранения настроек датчиков если они есть */}
                      {sensorCount > 0 && (
                        <div className="info-row mt-4 text-center">
                          <button 
                            type="button" 
                            className="btn-profile" 
                            onClick={handleSaveSensorsSettings}
                            disabled={apiStatus.loading}
                          >
                            <FontAwesomeIcon icon={faSave} /> 
                            {apiStatus.loading ? 'Сохранение...' : 'Сохранить настройки датчиков'}
                          </button>
                        </div>
                      )}
                      
                      {/* История синхронизации */}
                      {renderSyncHistory()}
                    </>
                  )}
                </div>
              </div>
              
              
            </div>
          </div>
        ) : (
          <div className="error-container">
            <p className="error-message">Транспортное средство не найдено</p>
            <button className="control-button" onClick={handleGoBack}>
              Вернуться к списку ТС
            </button>
          </div>
        )}
        
        {/* Компонент уведомления */}
        {notification.show && (
          <div className={`notification ${notification.type}`}>
            {getNotificationIcon(notification.type)}
            <span>{notification.message}</span>
            <span className="notification-close" onClick={handleCloseNotification}>
              <FontAwesomeIcon icon={faTimes} />
            </span>
          </div>
        )}
        
        {/* Модальное окно с информацией о формате Excel */}
        {renderExcelFormatModal()}
      </div>
    </div>
  );
};

export default VehicleProfile; 