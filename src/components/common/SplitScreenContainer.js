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
  onSplitChange,
  style = {},
  ...props
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
  
  // Эффект для установки атрибутов на DOM-элемент
  useEffect(() => {
    if (containerRef.current) {
      // Помечаем контейнер как управляемый React
      containerRef.current.setAttribute('data-react-managed', 'true');
      
      // Устанавливаем ID, если он предоставлен
      if (id && containerRef.current.id !== id) {
        containerRef.current.id = id;
      }
      
      // Создаем пользовательское событие для сообщения об инициализации
      const event = new CustomEvent('splitContainerInitialized', {
        detail: { id, element: containerRef.current }
      });
      document.dispatchEvent(event);
      
      console.log(`SplitScreenContainer: Инициализирован контейнер с ID ${id || 'без ID'}`);
    }
  }, [id]);
  
  // Добавляем обработчик события запроса на разделение контейнера
  useEffect(() => {
    // Функция-обработчик события запроса на разделение
    const handleSplitRequest = (event) => {
      const { containerId, container1Id, container2Id, direction } = event.detail;
      
      // Проверяем, относится ли запрос к нашему контейнеру
      if (containerId === id && containerRef.current) {
        console.log(`SplitScreenContainer: Получен запрос на разделение контейнера ${id}, направление: ${direction}`);
        
        // Сохраняем текущее содержимое, чтобы передать его первому дочернему контейнеру
        const existingContent = children;
        
        // Вместо вызова SplitScreenManager.applyPendingSplit, просто обновляем состояние React
        // Это позволит React перерисовать компонент с новой структурой
        setContainerState(prevState => ({
          ...prevState,
          mode: SPLIT_MODES.CUSTOM,
          isSplit: true,
          splitDirection: direction,
          children: [
            { id: container1Id, content: existingContent },
            { id: container2Id, content: null }
          ]
        }));
        
        // Вызываем callback, если определен
        if (onSplitChange) {
          onSplitChange({ mode: SPLIT_MODES.CUSTOM, isSplit: true, splitDirection: direction });
        }
        
        // Сообщаем о завершении разделения через событие
        setTimeout(() => {
          const event = new CustomEvent('splitContainerComplete', {
            detail: {
              containerId,
              container1Id,
              container2Id,
              direction
            }
          });
          document.dispatchEvent(event);
        }, 50);
      }
    };
    
    // Добавляем обработчик события
    document.addEventListener('splitContainerRequested', handleSplitRequest);
    
    // Очистка при размонтировании
    return () => {
      document.removeEventListener('splitContainerRequested', handleSplitRequest);
    };
  }, [id, onSplitChange, children]);
  
  // Эффект для очистки перед размонтированием
  useEffect(() => {
    return () => {
      // Этот эффект срабатывает перед удалением компонента из DOM
      if (containerRef.current) {
        console.log(`SplitScreenContainer: Размонтирование контейнера ${id || 'без ID'}`);
        
        // Проверка, был ли контейнер разделен безопасным способом
        if (containerRef.current.hasAttribute('data-split-safely')) {
          console.log(`SplitScreenContainer: Контейнер ${id || 'без ID'} был разделен безопасным способом`);
          
          // Находим wrapper, который был добавлен при безопасном разделении
          const wrapper = containerRef.current.nextSibling;
          if (wrapper && wrapper.classList.contains('non-react-wrapper')) {
            console.log(`SplitScreenContainer: Удаление non-react-wrapper для контейнера ${id || 'без ID'}`);
            
            // Пытаемся безопасно удалить wrapper
            try {
              wrapper.parentNode.removeChild(wrapper);
            } catch (e) {
              console.warn(`Ошибка при удалении wrapper для контейнера ${id || 'без ID'}:`, e);
            }
          }
        }
      }
    };
  }, [id]);
  
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
  
  // Рендер разделенных контейнеров с улучшенной поддержкой содержимого
  const renderSplitContainers = () => {
    if (!containerState.isSplit) {
      return children;
    }
    
    // Класс контейнера в зависимости от направления разделения
    const splitClassName = containerState.splitDirection === 'horizontal' 
      ? 'split-horizontal' 
      : 'split-vertical';
    
    const [container1Id, container2Id] = containerState.children.map(child => child.id);
    
    return (
      <div className={`split-container ${splitClassName}`}>
        <div className="split-pane" id={container1Id} data-container-id={container1Id}>
          {/* Первый разделенный контейнер - сохраняем предыдущее содержимое */}
          <div className="split-content">
            {containerState.children[0].content || 
              <span className="split-placeholder">Контейнер 1</span>}
          </div>
        </div>
        <div 
          className={`resizer ${containerState.splitDirection === 'horizontal' ? 'horizontal' : 'vertical'}`}
          onMouseDown={handleResizerMouseDown}
        ></div>
        <div className="split-pane" id={container2Id} data-container-id={container2Id}>
          {/* Второй разделенный контейнер - для нового содержимого */}
          <div className="split-content">
            {containerState.children[1].content || 
              <span className="split-placeholder">Контейнер 2</span>}
          </div>
        </div>
      </div>
    );
  };
  
  // Добавим функциональность для изменения размера разделенных частей
  const handleResizerMouseDown = (e) => {
    e.preventDefault();
    
    // Определяем направление и получаем элементы
    const isHorizontal = containerState.splitDirection === 'horizontal';
    const container = containerRef.current;
    if (!container) return;
    
    const panes = container.querySelectorAll('.split-pane');
    if (panes.length !== 2) return;
    
    const pane1 = panes[0];
    const pane2 = panes[1];
    
    // Начальные размеры
    const startPos = isHorizontal ? e.clientY : e.clientX;
    const startSize1 = isHorizontal ? pane1.offsetHeight : pane1.offsetWidth;
    const totalSize = isHorizontal ? container.offsetHeight : container.offsetWidth;
    
    // Функция для изменения размера при перемещении
    const handleMouseMove = (moveEvent) => {
      const currentPos = isHorizontal ? moveEvent.clientY : moveEvent.clientX;
      const delta = currentPos - startPos;
      
      // Рассчитываем новые размеры
      let newSize1 = startSize1 + delta;
      
      // Ограничения минимального размера
      const minSize = 100; // минимум 100px
      newSize1 = Math.max(minSize, Math.min(totalSize - minSize, newSize1));
      
      // Применяем новые размеры
      if (isHorizontal) {
        pane1.style.height = `${newSize1}px`;
        pane2.style.height = `calc(100% - ${newSize1}px - 8px)`; // 8px - размер разделителя
      } else {
        pane1.style.width = `${newSize1}px`;
        pane2.style.width = `calc(100% - ${newSize1}px - 8px)`; // 8px - размер разделителя
      }
      
      // Вызываем событие изменения размера, чтобы обновить графики
      window.dispatchEvent(new Event('resize'));
    };
    
    // Функция для прекращения изменения размера
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    // Добавляем обработчики
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  // Основной метод рендеринга
  return (
    <div 
      ref={containerRef}
      id={id}
      className={`split-screen-container ${className || ''}`}
      style={{
        ...style,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column'
      }}
      data-container-id={id}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {renderSplitControls()}
      {containerState.isSplit ? renderSplitContainers() : children}
    </div>
  );
};

export default SplitScreenContainer; 