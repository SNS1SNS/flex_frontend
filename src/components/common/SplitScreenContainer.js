import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faColumns, 
  faRedo, 
  faWindowRestore
} from '@fortawesome/free-solid-svg-icons';
import splitScreenManager, { SPLIT_MODES } from '../../utils/SplitScreenManager';
import './SplitScreenContainer.css';

/**
 * Компонент контейнера с возможностью разделения экрана
 * @param {Object} props - свойства компонента
 * @param {String} props.id - уникальный идентификатор контейнера
 * @param {React.ReactNode} props.children - содержимое контейнера
 * @param {Boolean} props.allowSplit - разрешать разделение (по умолчанию true)
 * @param {Boolean} props.showControls - показывать элементы управления разделением
 * @param {Function} props.onSplitChange - обработчик изменения режима разделения
 */
const SplitScreenContainer = ({ 
  id,
  children,
  allowSplit = true,
  className,
  showControls = true,
  onSplitChange
}) => {
  // Состояния компонента
  const [containerState, setContainerState] = useState({
    mode: SPLIT_MODES.SINGLE,
    isSplit: false,
    splitDirection: null,
    children: []
  });
  const [showSplitControls, setShowSplitControls] = useState(false);
  
  // Ref для контейнера
  const containerRef = useRef(null);
  
  // Инициализация при монтировании
  useEffect(() => {
    // Получаем текущее состояние разделения
    const initialState = splitScreenManager.getCurrentState();
    
    // Инициализируем состояние контейнера
    setContainerState({
      mode: initialState.mode || SPLIT_MODES.SINGLE,
      isSplit: false,
      splitDirection: null,
      children: []
    });
    
    // Добавляем обработчик события изменения режима разделения
    document.addEventListener('splitModeChanged', handleSplitModeChanged);
    
    // Очистка обработчиков при размонтировании
    return () => {
      document.removeEventListener('splitModeChanged', handleSplitModeChanged);
    };
  }, []);
  
  // Обработчик события изменения режима разделения
  const handleSplitModeChanged = (event) => {
    const { mode, targetContainerId, splitDirection, isDynamicSplit } = event.detail;
    
    // Если это не динамическое разделение или оно не для нашего контейнера, просто обновляем режим
    if (!isDynamicSplit || targetContainerId !== id) {
      setContainerState(prevState => ({
        ...prevState,
        mode
      }));
      return;
    }
    
    // Обновляем состояние для динамического разделения
    setContainerState(prevState => ({
      ...prevState,
      mode: SPLIT_MODES.CUSTOM,
      isSplit: true,
      splitDirection,
      children: [
        { id: `${id}-1`, content: null },
        { id: `${id}-2`, content: null }
      ]
    }));
    
    // Вызываем callback, если определен
    if (onSplitChange) {
      onSplitChange({ mode, isSplit: true, splitDirection });
    }
  };
  
  // Обработчик наведения мыши для отображения контролов разделения
  const handleMouseEnter = () => {
    if (allowSplit && showControls) {
      setShowSplitControls(true);
    }
  };
  
  // Обработчик ухода мыши для скрытия контролов разделения
  const handleMouseLeave = () => {
    setShowSplitControls(false);
  };
  
  // Обработчик клика по кнопке разделения по горизонтали
  const handleHorizontalSplit = () => {
    splitScreenManager.addDynamicSplit(id, 'horizontal');
  };
  
  // Обработчик клика по кнопке разделения по вертикали
  const handleVerticalSplit = () => {
    splitScreenManager.addDynamicSplit(id, 'vertical');
  };
  
  // Функция преобразования в обычный режим (без разделения)
  const handleSingleMode = () => {
    splitScreenManager.changeSplitMode(SPLIT_MODES.SINGLE);
  };
  
  // Функция возврата к предыдущему режиму
  const handleGoBack = () => {
    splitScreenManager.goBack();
  };
  
  // Рендер контролов разделения
  const renderSplitControls = () => {
    if (!allowSplit || !showControls || !showSplitControls) return null;
    
    return (
      <div className="split-screen-controls">
        <button 
          className="split-control-button" 
          onClick={handleHorizontalSplit}
          title="Разделить по горизонтали"
        >
          <FontAwesomeIcon icon={faColumns} style={{ transform: 'rotate(90deg)' }} />
        </button>
        <button 
          className="split-control-button" 
          onClick={handleVerticalSplit}
          title="Разделить по вертикали"
        >
          <FontAwesomeIcon icon={faColumns} />
        </button>
        <button 
          className="split-control-button" 
          onClick={handleSingleMode}
          title="Один экран"
        >
          <FontAwesomeIcon icon={faWindowRestore} />
        </button>
        <button 
          className="split-control-button" 
          onClick={handleGoBack}
          title="Назад"
        >
          <FontAwesomeIcon icon={faRedo} style={{ transform: 'rotate(180deg)' }} />
        </button>
      </div>
    );
  };
  
  // Рендер разделенных контейнеров
  const renderSplitContainers = () => {
    if (!containerState.isSplit) {
      return children;
    }
    
    // Класс контейнера в зависимости от направления разделения
    const splitClassName = containerState.splitDirection === 'horizontal' 
      ? 'split-horizontal' 
      : 'split-vertical';
    
    return (
      <div className={`split-container ${splitClassName}`}>
        <div className="split-pane" id={`${id}-1`}>
          {/* Здесь будет содержимое первого разделенного контейнера */}
          <div className="split-content">
            <span className="split-placeholder">Контейнер 1</span>
          </div>
        </div>
        <div className="split-pane" id={`${id}-2`}>
          {/* Здесь будет содержимое второго разделенного контейнера */}
          <div className="split-content">
            <span className="split-placeholder">Контейнер 2</span>
          </div>
        </div>
      </div>
    );
  };
  
  // Основной метод рендеринга
  return (
    <div 
      ref={containerRef}
      id={id}
      className={`split-screen-container ${className || ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {renderSplitControls()}
      {containerState.isSplit ? renderSplitContainers() : children}
    </div>
  );
};

export default SplitScreenContainer; 