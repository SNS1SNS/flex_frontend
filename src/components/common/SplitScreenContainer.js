import React, { useState, useEffect, useRef } from 'react';
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
  // Используем это состояние для обработки событий мыши
  const [showSplitControls, setShowSplitControls] = useState(false);
  // Используем отдельное состояние для отслеживания активности
  const [isActive, setIsActive] = useState(false);
  
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
  
  // Добавляем глобальный обработчик кликов для сброса активности всех контейнеров
  useEffect(() => {
    const handleGlobalClick = (e) => {
      // Если клик произошел вне нашего контейнера, деактивируем его
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsActive(false);
        if (containerRef.current) {
          containerRef.current.setAttribute('data-active', 'false');
        }
      }
    };
    
    document.addEventListener('click', handleGlobalClick);
    
    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, []);
  
  // Добавляем обработчик события запроса на разделение контейнера
  useEffect(() => {
    // Флаг, который указывает, что событие requestReportSelector уже было отправлено
    let reportSelectorRequested = false;
    
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
        
        // Сбрасываем флаг перед новым разделением
        reportSelectorRequested = false;
        
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
          
          // Проверяем, что событие requestReportSelector ещё не было отправлено
          if (!reportSelectorRequested) {
            console.log(`SplitScreenContainer: Отправляем запрос на открытие селектора отчётов для контейнера ${container2Id}`);
            
            // Устанавливаем флаг, что событие будет отправлено
            reportSelectorRequested = true;
            
            // Сразу после завершения разделения создаем событие для запроса выбора отчета
            const selectReportEvent = new CustomEvent('requestReportSelector', {
              detail: {
                containerId: container2Id,
                parentContainerId: id,
                originalContainerId: containerId,
                direction: direction,
                timestamp: Date.now(),
                // Добавляем признак активации
                activateContainer: true
              }
            });
            
            // Даем немного времени на обновление DOM, увеличиваем задержку
            setTimeout(() => {
              // Проверяем состояние DOM и компонентов перед отправкой события
              try {
                // Проверяем, что DOM-элемент контейнера существует перед отправкой события
                const targetContainer = document.getElementById(container2Id);
                if (targetContainer) {
                  console.log(`SplitScreenContainer: Найден DOM-элемент контейнера ${container2Id}, отправляем событие запроса отчёта`);
                  
                  // Проверяем, что документ и все его корневые элементы в стабильном состоянии
                  if (document.readyState === 'complete' || document.readyState === 'interactive') {
                    document.dispatchEvent(selectReportEvent);
                  } else {
                    console.log('SplitScreenContainer: Документ ещё загружается, добавляем слушатель DOMContentLoaded');
                    // Если документ ещё не загружен полностью, ждем его загрузки
                    window.addEventListener('DOMContentLoaded', () => {
                      document.dispatchEvent(selectReportEvent);
                    }, { once: true });
                  }
                } else {
                  console.warn(`SplitScreenContainer: DOM-элемент контейнера ${container2Id} не найден, используем поиск по атрибутам`);
                  
                  // Попытка найти элемент по другим атрибутам
                  const containers = document.querySelectorAll(`[data-container-id="${container2Id}"]`);
                  if (containers.length > 0) {
                    console.log(`SplitScreenContainer: Найден контейнер по атрибуту data-container-id`);
                    document.dispatchEvent(selectReportEvent);
                  } else {
                    // Добавляем более надежный механизм повторных попыток
                    let retryCount = 0;
                    const maxRetries = 3;
                    
                    const retryFindContainer = () => {
                      const container = document.getElementById(container2Id) || 
                                       document.querySelector(`[data-container-id="${container2Id}"]`);
                      
                      if (container) {
                        console.log(`SplitScreenContainer: Найден контейнер ${container2Id} на попытке ${retryCount + 1}`);
                        document.dispatchEvent(selectReportEvent);
                      } else if (retryCount < maxRetries) {
                        retryCount++;
                        console.log(`SplitScreenContainer: Попытка ${retryCount} найти контейнер ${container2Id}`);
                        setTimeout(retryFindContainer, 100 * retryCount); // Увеличиваем задержку с каждой попыткой
                      } else {
                        console.warn(`SplitScreenContainer: Элемент не найден после ${maxRetries} попыток, отправляем событие в любом случае`);
                        document.dispatchEvent(selectReportEvent);
                      }
                    };
                    
                    retryFindContainer();
                  }
                }
              } catch (error) {
                console.error('SplitScreenContainer: Ошибка при отправке события requestReportSelector:', error);
                // В случае ошибки всё равно пытаемся отправить событие
                document.dispatchEvent(selectReportEvent);
              }
            }, 300);
          } else {
            console.log(`SplitScreenContainer: Событие requestReportSelector уже было отправлено, пропускаем повторную отправку`);
          }
        }, 100);
      }
    };
    
    // Добавляем обработчик события
    document.addEventListener('splitContainerRequested', handleSplitRequest);
    
    // Очистка при размонтировании
    return () => {
      document.removeEventListener('splitContainerRequested', handleSplitRequest);
    };
  }, [id, onSplitChange, children]);
  
  // Обновляем эффект для обработки события requestSplit, чтобы учитывать только активный контейнер
  useEffect(() => {
    // Функция-обработчик события запроса на разделение
    const handleGlobalSplitRequest = (event) => {
      const { direction, targetContainerId } = event.detail;
      
      // Проверка 1: событие имеет targetContainerId и это наш контейнер
      const hasTargetId = targetContainerId && targetContainerId === id;
      
      // Проверка 2: событие не имеет targetContainerId, но наш контейнер активен
      const isActiveContainer = !targetContainerId && (isActive || showSplitControls) && containerRef.current;
      
      // Применяем разделение, только если одно из условий истинно
      if (hasTargetId || isActiveContainer) {
        console.log(`SplitScreenContainer ${id}: Применяем разделение ${direction} к контейнеру`);
        
        // Вместо использования splitScreenManager.addDynamicSplit, создаем специфичное событие
        const specificSplitEvent = new CustomEvent('splitContainerRequested', {
          detail: {
            containerId: id,
            container1Id: `${id}-1`,
            container2Id: `${id}-2`,
            direction: direction
          }
        });
        
        // Отправляем событие на обработку
        document.dispatchEvent(specificSplitEvent);
        
        // Останавливаем дальнейшую обработку
        event.stopPropagation();
        
        // Устанавливаем флаг, что событие было обработано
        event.detail.processed = true;
      }
    };
    
    // Добавляем обработчик события с capture=true, чтобы перехватить событие до bubbling
    document.addEventListener('requestSplit', handleGlobalSplitRequest, true);
    
    // Очистка при размонтировании
    return () => {
      document.removeEventListener('requestSplit', handleGlobalSplitRequest, true);
    };
  }, [id, isActive, showSplitControls]);
  
  // Обработчик клика для активации контейнера - улучшаем для лучшей визуальной индикации и обновления состояния
  const handleContainerClick = () => {
    // Сначала снимаем активность со всех контейнеров
    document.querySelectorAll('.split-screen-container[data-active="true"]')
      .forEach(el => {
        try {
          // Проверяем, что элемент существует и находится в DOM
          if (el && document.body.contains(el)) {
            el.setAttribute('data-active', 'false');
            // Добавляем класс, чтобы улучшить визуальное отображение неактивных контейнеров
            el.classList.remove('active-container');
          }
        } catch (e) {
          console.warn('SplitScreenContainer: Ошибка при деактивации контейнера:', e);
        }
      });
    
    // Активируем наш контейнер с более наглядной визуальной индикацией
    if (containerRef.current) {
      try {
        // Проверяем, что контейнер всё ещё в DOM
        if (document.body.contains(containerRef.current)) {
          containerRef.current.setAttribute('data-active', 'true');
          // Добавляем класс для лучшей визуальной индикации
          containerRef.current.classList.add('active-container');
          setIsActive(true);
          
          // Также добавляем лог для отладки
          console.log(`Контейнер ${id} активирован, будет разделен при следующем запросе`);
        } else {
          console.warn(`SplitScreenContainer: Контейнер ${id} не содержится в DOM, невозможно активировать`);
        }
      } catch (e) {
        console.error('SplitScreenContainer: Ошибка при активации контейнера:', e);
      }
    }
  };
  
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
            
            // Безопасное удаление wrapper только если он действительно является дочерним элементом своего родителя
            try {
              // Проверяем, существует ли wrapper в DOM
              if (wrapper.parentNode && wrapper.parentNode.contains(wrapper)) {
                wrapper.parentNode.removeChild(wrapper);
              } else {
                console.log(`SplitScreenContainer: Wrapper уже был удален из DOM или не является дочерним элементом своего родителя`);
              }
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
    
    // Важно: добавляем data-split-direction на контейнер для CSS-селекторов
    return (
      <div 
        className={`split-container ${splitClassName}`}
        data-split-direction={containerState.splitDirection}
      >
        <div 
          className="split-pane" 
          id={container1Id} 
          data-container-id={container1Id}
          data-split-parent={id}
          data-split-index="0"
        >
          {/* Первый разделенный контейнер - сохраняем предыдущее содержимое */}
          <SplitScreenContainer 
            id={container1Id}
            allowSplit={allowSplit}
            showControls={showControls}
            className="split-content"
          >
            {containerState.children[0].content || 
              <span className="split-placeholder">Контейнер 1</span>}
          </SplitScreenContainer>
        </div>
        <div 
          className={`resizer ${containerState.splitDirection === 'horizontal' ? 'horizontal' : 'vertical'}`}
          onMouseDown={handleResizerMouseDown}
          data-split-parent={id}
          data-split-direction={containerState.splitDirection}
        ></div>
        <div 
          className="split-pane" 
          id={container2Id} 
          data-container-id={container2Id}
          data-split-parent={id}
          data-split-index="1"
        >
          {/* Второй разделенный контейнер - для нового содержимого */}
          <SplitScreenContainer 
            id={container2Id}
            allowSplit={allowSplit}
            showControls={showControls}
            className="split-content"
          >
            {containerState.children[1].content || 
              <span className="split-placeholder">Контейнер 2</span>}
          </SplitScreenContainer>
        </div>
      </div>
    );
  };
  
  // Добавим функциональность для изменения размера разделенных частей
  const handleResizerMouseDown = (mouseDownEvent) => {
    mouseDownEvent.preventDefault();
    
    // Определяем направление и получаем элементы
    const isHorizontal = containerState.splitDirection === 'horizontal';
    const container = containerRef.current;
    if (!container) return;
    
    const panes = container.querySelectorAll('.split-pane');
    if (panes.length !== 2) return;
    
    const pane1 = panes[0];
    const pane2 = panes[1];
    
    // Начальные размеры
    const startPos = isHorizontal ? mouseDownEvent.clientY : mouseDownEvent.clientX;
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
      data-active={isActive ? "true" : "false"}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleContainerClick}
      {...props}
    >
      {containerState.isSplit ? renderSplitContainers() : children}
    </div>
  );
};

export default SplitScreenContainer; 