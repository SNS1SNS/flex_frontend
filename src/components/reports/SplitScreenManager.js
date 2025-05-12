import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faColumns, faThLarge, faTh,
  faExpandArrowsAlt, faCompressArrowsAlt 
} from '@fortawesome/free-solid-svg-icons';
import './SplitScreenManagerStyles.css';

const SplitScreenManager = ({ 
  children, 
  initialMode = 'single',
  onModeChange
}) => {
  const [splitMode, setSplitMode] = useState(() => {
    // Пытаемся восстановить режим из localStorage
    const savedMode = localStorage.getItem('splitScreenMode');
    return savedMode || initialMode; // 'single', 'horizontal', 'vertical', 'quad'
  });
  
  // Состояние для полноэкранного режима
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Эффект для сохранения режима разделения в localStorage
  useEffect(() => {
    localStorage.setItem('splitScreenMode', splitMode);
    
    // Вызываем колбэк onModeChange, если он был передан
    if (onModeChange) {
      onModeChange(splitMode);
    }
    
    // Создаем и отправляем глобальное событие о смене режима разделения
    const event = new CustomEvent('splitModeChanged', {
      detail: { mode: splitMode }
    });
    document.dispatchEvent(event);
    
  }, [splitMode, onModeChange]);
  
  // Обработчик изменения режима разделения
  const handleModeChange = (mode) => {
    setSplitMode(mode);
  };
  
  // Переключение полноэкранного режима
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      const element = document.documentElement;
      if (element.requestFullscreen) {
        element.requestFullscreen();
      } else if (element.mozRequestFullScreen) { // Firefox
        element.mozRequestFullScreen();
      } else if (element.webkitRequestFullscreen) { // Chrome, Safari и Opera
        element.webkitRequestFullscreen();
      } else if (element.msRequestFullscreen) { // IE/Edge
        element.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.mozCancelFullScreen) { // Firefox
        document.mozCancelFullScreen();
      } else if (document.webkitExitFullscreen) { // Chrome, Safari и Opera
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) { // IE/Edge
        document.msExitFullscreen();
      }
    }
    
    setIsFullscreen(!isFullscreen);
  };
  
  // Обработчик изменения состояния полноэкранного режима
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(
        document.fullscreenElement || 
        document.mozFullScreenElement || 
        document.webkitFullscreenElement || 
        document.msFullscreenElement
      );
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);
  
  // Функция для создания синхронизированных отчетов
  const renderSplitPanels = () => {
    // Если нет дочерних элементов, возвращаем заглушку
    if (!children) {
      return (
        <div className="split-placeholder">
          <p>Добавьте отчеты для отображения в разделенном режиме</p>
        </div>
      );
    }
    
    // Если children не является массивом, оборачиваем его в массив
    const childrenArray = Array.isArray(children) ? children : [children];
    
    // Если режим 'single', возвращаем только первый элемент
    if (splitMode === 'single') {
      return (
        <div className="split-panel single">
          {childrenArray[0] || (
            <div className="split-placeholder">
              <p>Выберите отчет для просмотра</p>
            </div>
          )}
        </div>
      );
    }
    
    // Определяем количество панелей для текущего режима
    const panelCount = splitMode === 'quad' ? 4 : 2;
    const panels = [];
    
    for (let i = 0; i < panelCount; i++) {
      panels.push(
        <div 
          key={`panel-${i}`} 
          className={`split-panel ${splitMode} panel-${i}`}
        >
          {childrenArray[i] || (
            <div className="split-placeholder">
              <p>Панель {i + 1}</p>
            </div>
          )}
        </div>
      );
    }
    
    return panels;
  };
  
  // Отрисовка контролов управления разделением
  return (
    <div className={`split-screen-manager ${splitMode} ${isFullscreen ? 'fullscreen' : ''}`}>
      <div className="split-screen-controls">
        <button 
          className={`split-mode-button ${splitMode === 'single' ? 'active' : ''}`}
          onClick={() => handleModeChange('single')}
          title="Один отчет"
        >
          <FontAwesomeIcon icon={faTh} />
        </button>
        <button 
          className={`split-mode-button ${splitMode === 'horizontal' ? 'active' : ''}`}
          onClick={() => handleModeChange('horizontal')}
          title="Горизонтальное разделение"
        >
          <FontAwesomeIcon icon={faColumns} style={{ transform: 'rotate(90deg)' }} />
        </button>
        <button 
          className={`split-mode-button ${splitMode === 'vertical' ? 'active' : ''}`}
          onClick={() => handleModeChange('vertical')}
          title="Вертикальное разделение"
        >
          <FontAwesomeIcon icon={faColumns} />
        </button>
        <button 
          className={`split-mode-button ${splitMode === 'quad' ? 'active' : ''}`}
          onClick={() => handleModeChange('quad')}
          title="Разделение на 4 части"
        >
          <FontAwesomeIcon icon={faThLarge} />
        </button>
        <button 
          className="split-mode-button fullscreen-button"
          onClick={toggleFullscreen}
          title={isFullscreen ? "Выйти из полноэкранного режима" : "Полноэкранный режим"}
        >
          <FontAwesomeIcon icon={isFullscreen ? faCompressArrowsAlt : faExpandArrowsAlt} />
        </button>
      </div>
      <div className="split-screen-container">
        {renderSplitPanels()}
      </div>
    </div>
  );
};

export default SplitScreenManager; 