import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import splitScreenManager, { SPLIT_MODES } from '../utils/SplitScreenManager';

// Создаем контекст для работы с разделенным экраном
const SplitScreenContext = createContext({
  // Состояния
  splitMode: 'single',
  activeContainerId: null,
  containers: [],
  history: [],
  
  // Методы
  changeSplitMode: () => {},
  splitContainer: () => {},
  activateContainer: () => {},
  goBack: () => {},
  removeContainer: () => {}
});

/**
 * Хук для доступа к контексту разделенного экрана
 * @returns {Object} Объект контекста разделенного экрана
 */
export const useSplitScreen = () => useContext(SplitScreenContext);

/**
 * Провайдер для работы с разделенным экраном
 * @param {Object} props - Свойства компонента
 * @param {React.ReactNode} props.children - Дочерние элементы
 * @returns {JSX.Element} Провайдер для управления разделенным экраном
 */
export const SplitScreenProvider = ({ children }) => {
  // Состояния
  const [splitMode, setSplitMode] = useState('single');
  const [activeContainerId, setActiveContainerId] = useState(null);
  const [containers, setContainers] = useState([]);
  const [history, setHistory] = useState([]);

  // Синхронизация состояния с localStorage при инициализации
  useEffect(() => {
    // Загружаем сохраненный режим разделения
    const savedSplitMode = localStorage.getItem('splitScreenMode');
    if (savedSplitMode) {
      setSplitMode(savedSplitMode);
    }
    
    // Подписываемся на события от splitScreenManager
    const handleContainerAdded = (event) => {
      const { containerId } = event.detail;
      setContainers(prev => [...prev, containerId]);
    };
    
    const handleContainerRemoved = (event) => {
      const { containerId } = event.detail;
      setContainers(prev => prev.filter(id => id !== containerId));
    };
    
    const handleContainerActivated = (event) => {
      const { containerId } = event.detail;
      setActiveContainerId(containerId);
    };
    
    const handleSplitModeChanged = (event) => {
      const { mode } = event.detail;
      setSplitMode(mode);
      localStorage.setItem('splitScreenMode', mode);
    };
    
    document.addEventListener('containerAdded', handleContainerAdded);
    document.addEventListener('containerRemoved', handleContainerRemoved);
    document.addEventListener('containerActivated', handleContainerActivated);
    document.addEventListener('splitModeChanged', handleSplitModeChanged);
    
    return () => {
      document.removeEventListener('containerAdded', handleContainerAdded);
      document.removeEventListener('containerRemoved', handleContainerRemoved);
      document.removeEventListener('containerActivated', handleContainerActivated);
      document.removeEventListener('splitModeChanged', handleSplitModeChanged);
    };
  }, []);

  /**
   * Изменение режима разделения экрана
   * @param {string} mode - Режим разделения ('single', 'horizontal', 'vertical', 'quad')
   * @returns {boolean} Статус выполнения операции
   */
  const changeSplitMode = useCallback((mode) => {
    // Сохраняем текущий режим в историю
    setHistory(prev => [...prev, splitMode]);
    
    // Вызываем метод splitScreenManager для смены режима
    let success = false;
    
    switch(mode) {
      case 'single':
        success = splitScreenManager.changeSplitMode(SPLIT_MODES.SINGLE);
        break;
      case 'horizontal':
        success = splitScreenManager.changeSplitMode(SPLIT_MODES.HORIZONTAL);
        break;
      case 'vertical':
        success = splitScreenManager.changeSplitMode(SPLIT_MODES.VERTICAL);
        break;
      case 'quad':
        success = splitScreenManager.changeSplitMode(SPLIT_MODES.QUAD);
        break;
      default:
        console.warn(`Неизвестный режим разделения: ${mode}`);
        return false;
    }
    
    if (success) {
      // Обновляем состояние только если операция выполнена успешно
      setSplitMode(mode);
      localStorage.setItem('splitScreenMode', mode);
      
      // Уведомляем другие компоненты о смене режима
      const event = new CustomEvent('splitModeChanged', {
        detail: { mode }
      });
      document.dispatchEvent(event);
    }
    
    return success;
  }, [splitMode]);

  /**
   * Разделение контейнера
   * @param {string} containerId - ID контейнера для разделения
   * @param {string} direction - Направление разделения ('horizontal', 'vertical')
   * @param {string} newContainerId - ID нового контейнера (опционально)
   * @returns {boolean} Статус выполнения операции
   */
  const splitContainer = useCallback((containerId, direction, newContainerId) => {
    try {
      console.log(`SplitScreenContext: Разделение контейнера ${containerId} в направлении ${direction}`);
      
      // Проверяем параметры
      if (!containerId) {
        console.warn('SplitScreenContext: Не указан ID контейнера для разделения');
        return false;
      }
      
      if (direction !== 'horizontal' && direction !== 'vertical') {
        console.warn(`SplitScreenContext: Некорректное направление разделения: ${direction}`);
        return false;
      }
      
      // Сохраняем текущее состояние в историю
      setHistory(prev => [...prev, {
        mode: splitMode,
        containers: [...containers]
      }]);
      
      // Вызываем метод splitScreenManager для разделения контейнера
      const success = splitScreenManager.addDynamicSplit(containerId, direction, newContainerId);
      
      if (!success) {
        console.warn(`SplitScreenContext: Не удалось разделить контейнер ${containerId}`);
        return false;
      }
      
      // Обновляем режим разделения в соответствии с текущим состоянием
      const newMode = direction === 'horizontal' ? 'horizontal' : 'vertical';
      setSplitMode(newMode);
      localStorage.setItem('splitScreenMode', newMode);
      
      return true;
    } catch (error) {
      console.error('SplitScreenContext: Ошибка при разделении контейнера:', error);
      return false;
    }
  }, [splitMode, containers]);

  /**
   * Активация контейнера
   * @param {string} containerId - ID контейнера для активации
   * @returns {boolean} Статус выполнения операции
   */
  const activateContainer = useCallback((containerId) => {
    if (!containerId) {
      console.warn('SplitScreenContext: Не указан ID контейнера для активации');
      return false;
    }
    
    try {
      // Снимаем активность со всех контейнеров
      document.querySelectorAll('.split-screen-container[data-active="true"]')
        .forEach(el => {
          if (el && document.body.contains(el)) {
            el.setAttribute('data-active', 'false');
            el.classList.remove('active-container');
          }
        });
      
      // Находим целевой контейнер
      const targetContainer = document.getElementById(containerId) || 
                            document.querySelector(`[data-container-id="${containerId}"]`);
      
      if (!targetContainer) {
        console.warn(`SplitScreenContext: Контейнер с ID ${containerId} не найден`);
        return false;
      }
      
      // Активируем целевой контейнер
      targetContainer.setAttribute('data-active', 'true');
      targetContainer.classList.add('active-container');
      
      // Обновляем состояние
      setActiveContainerId(containerId);
      
      // Отправляем событие активации контейнера
      const event = new CustomEvent('containerActivated', {
        detail: { containerId }
      });
      document.dispatchEvent(event);
      
      return true;
    } catch (error) {
      console.error('SplitScreenContext: Ошибка при активации контейнера:', error);
      return false;
    }
  }, []);

  /**
   * Возврат к предыдущему состоянию разделения
   * @returns {boolean} Статус выполнения операции
   */
  const goBack = useCallback(() => {
    if (history.length === 0) {
      console.warn('SplitScreenContext: История разделения пуста');
      return false;
    }
    
    // Получаем последнее состояние из истории
    const prevState = history[history.length - 1];
    
    // Обновляем историю
    setHistory(prev => prev.slice(0, -1));
    
    // Вызываем метод splitScreenManager для перехода к предыдущему состоянию
    const success = splitScreenManager.goBack();
    
    if (success) {
      // Если предыдущее состояние - объект с режимом и контейнерами
      if (typeof prevState === 'object' && prevState.mode) {
        setSplitMode(prevState.mode);
        localStorage.setItem('splitScreenMode', prevState.mode);
      } 
      // Если предыдущее состояние - просто строка с режимом
      else if (typeof prevState === 'string') {
        setSplitMode(prevState);
        localStorage.setItem('splitScreenMode', prevState);
      }
    }
    
    return success;
  }, [history]);

  /**
   * Удаление контейнера
   * @param {string} containerId - ID контейнера для удаления
   * @returns {boolean} Статус выполнения операции
   */
  const removeContainer = useCallback((containerId) => {
    if (!containerId) {
      console.warn('SplitScreenContext: Не указан ID контейнера для удаления');
      return false;
    }
    
    try {
      // Вызываем метод splitScreenManager для удаления контейнера
      const success = splitScreenManager.removeSplit(containerId);
      
      if (success) {
        // Обновляем список контейнеров
        setContainers(prev => prev.filter(id => id !== containerId));
        
        // Если удаляемый контейнер был активным, сбрасываем активный контейнер
        if (activeContainerId === containerId) {
          setActiveContainerId(null);
        }
        
        // Отправляем событие удаления контейнера
        const event = new CustomEvent('containerRemoved', {
          detail: { containerId }
        });
        document.dispatchEvent(event);
      }
      
      return success;
    } catch (error) {
      console.error('SplitScreenContext: Ошибка при удалении контейнера:', error);
      return false;
    }
  }, [activeContainerId]);

  // Значение контекста
  const contextValue = {
    // Состояния
    splitMode,
    activeContainerId,
    containers,
    history,
    
    // Методы
    changeSplitMode,
    splitContainer,
    activateContainer,
    goBack,
    removeContainer
  };

  return (
    <SplitScreenContext.Provider value={contextValue}>
      {children}
    </SplitScreenContext.Provider>
  );
};

export default SplitScreenContext; 