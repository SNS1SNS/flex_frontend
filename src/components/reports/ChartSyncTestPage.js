import React, { useState, useEffect } from 'react';
import SpeedChart from './SpeedChart';
import FuelChart from './FuelChart';
import VoltageChart from './VoltageChart';
import EngineChart from './EngineChart';
import ChartDebugPanel from './ChartDebugPanel';
import splitScreenManager, { SPLIT_MODES } from '../../utils/SplitScreenManager';
import chartSyncManager from '../../utils/ChartSyncManager';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLink, faUnlink, faSearchMinus } from '@fortawesome/free-solid-svg-icons';
import './ChartStyles.css';

/**
 * Тестовая страница для синхронизации масштабирования графиков
 */
const ChartSyncTestPage = () => {
  // Используем константы для фиксированных значений
  const splitMode = SPLIT_MODES.QUAD; // Фиксированный режим разделения экрана
  const vehicle = null; // Тестовые данные без выбора транспорта
  const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 часа назад
  const endDate = new Date(); // Текущая дата
  
  const [syncEnabled, setSyncEnabled] = useState(true);
  
  // Эффект для инициализации разделения экрана
  useEffect(() => {
    const container = document.getElementById('test-container');
    
    if (container) {
      // Инициализируем менеджер разделения экрана
      splitScreenManager.init(
        container,
        ['speed', 'fuel', 'voltage', 'engine'],
        () => {}, // Заглушка для callback
        renderComponent // Функция для рендеринга компонентов
      );
      
      // Устанавливаем режим разделения
      splitScreenManager.setMode(splitMode);
      
      // Размещаем графики в соответствующих контейнерах
      setTimeout(() => {
        const containers = document.querySelectorAll('.report-container');
        if (containers.length >= 4) {
          renderComponent('speed', containers[0], { vehicle, startDate, endDate });
          renderComponent('fuel', containers[1], { vehicle, startDate, endDate });
          renderComponent('voltage', containers[2], { vehicle, startDate, endDate });
          renderComponent('engine', containers[3], { vehicle, startDate, endDate });
        }
      }, 200);
    }
    
    // Получаем состояние синхронизации из менеджера
    setSyncEnabled(chartSyncManager.syncEnabled);
    
    // Обработчик изменения состояния синхронизации
    const handleSyncStateChanged = (event) => {
      setSyncEnabled(event.detail.syncEnabled);
    };
    
    // Регистрируем обработчик
    document.addEventListener('syncStateChanged', handleSyncStateChanged);
    
    return () => {
      document.removeEventListener('syncStateChanged', handleSyncStateChanged);
    };
  }, [splitMode, vehicle, startDate, endDate]);
  
  // Функция для рендеринга компонентов в контейнеры
  const renderComponent = (componentType, container, props) => {
    try {
      if (!container) {
        console.error('Контейнер не найден для рендеринга компонента', componentType);
        return;
      }
      
      // Создаем root для рендеринга React-компонента
      const root = document.createElement('div');
      root.className = 'component-root';
      root.style.width = '100%';
      root.style.height = '100%';
      
      // Очищаем контейнер
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      
      // Добавляем корневой элемент
      container.appendChild(root);
      
      // Получаем компонент в зависимости от типа
      let Component;
      switch (componentType) {
        case 'speed':
          Component = SpeedChart;
          break;
        case 'fuel':
          Component = FuelChart;
          break;
        case 'voltage':
          Component = VoltageChart;
          break;
        case 'engine':
          Component = EngineChart;
          break;
        default:
          console.error('Неизвестный тип компонента:', componentType);
          return;
      }
      
      // Рендерим компонент в корневой элемент
      const reactRoot = window.ReactDOM.createRoot(root);
      reactRoot.render(<Component {...props} />);
      
      console.log(`Компонент ${componentType} отрендерен в контейнер`);
    } catch (error) {
      console.error('Ошибка при рендеринге компонента:', error);
    }
  };
  
  // Обработчик переключения синхронизации
  const handleToggleSync = () => {
    const isEnabled = chartSyncManager.toggleSync();
    setSyncEnabled(isEnabled);
    
    toast.info(
      isEnabled 
        ? 'Синхронизация масштабирования включена' 
        : 'Синхронизация масштабирования отключена',
      { autoClose: 1500 }
    );
  };
  
  // Обработчик сброса масштабирования
  const handleResetZoom = () => {
    if (document.querySelectorAll('canvas').length > 0) {
      chartSyncManager.syncReset('reset-all');
      toast.info('Масштабирование сброшено для всех графиков', { autoClose: 1500 });
    } else {
      toast.warning('Нет графиков для сброса масштабирования', { autoClose: 1500 });
    }
  };
  
  return (
    <div className="chart-sync-test-page">
      <div className="test-header">
        <h1>Тестирование синхронизации графиков</h1>
        <div className="controls">
          <button 
            className={`sync-button ${syncEnabled ? 'active' : ''}`}
            onClick={handleToggleSync}
          >
            <FontAwesomeIcon icon={syncEnabled ? faLink : faUnlink} />
            <span>{syncEnabled ? 'Синхронизация включена' : 'Синхронизация отключена'}</span>
          </button>
          
          <button 
            className="reset-button"
            onClick={handleResetZoom}
          >
            <FontAwesomeIcon icon={faSearchMinus} />
            <span>Сбросить масштаб</span>
          </button>
        </div>
      </div>
      
      <div className="test-description">
        <p>
          На этой странице вы можете протестировать синхронизацию масштабирования между графиками.
          Масштабируйте один график с помощью колесика мыши или выделения области, и все остальные 
          графики будут синхронно изменять масштаб.
        </p>
      </div>
      
      <div 
        id="test-container" 
        className="test-container"
      ></div>
      
      <ChartDebugPanel />
    </div>
  );
};

export default ChartSyncTestPage; 