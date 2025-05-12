/**
 * Модуль для управления разделением экрана в компонентах отчетов
 */

// Режимы разделения экрана
export const SPLIT_MODES = {
  SINGLE: 'single',
  HORIZONTAL: 'horizontal',
  VERTICAL: 'vertical',
  QUAD: 'quad',
  CUSTOM: 'custom' // Режим для пользовательских разделений
};

// Максимальное количество разделений по направлениям
const MAX_SPLITS = {
  VERTICAL: 2,    // Максимум 2 колонки
  HORIZONTAL: 4   // Максимум 4 строки
};

/**
 * Менеджер разделения экрана для отчетов
 * Этот класс обеспечивает функциональность разделения экрана динамически,
 * позволяя пользователям создавать сложные макеты для просмотра нескольких отчетов одновременно.
 */
class SplitScreenManager {
  constructor() {
    this.containers = new Map(); // Хранит все контейнеры отчетов
    this.activeContainer = null; // Текущий активный контейнер
    this.rootContainer = null; // Корневой контейнер
    this.reportTypes = []; // Доступные типы отчетов
    this.reportSelectionCallback = null; // Коллбэк выбора отчета
    this.isSelectionMode = false; // Находимся ли в режиме выбора
    this.containerToFill = null; // Контейнер, который нужно заполнить отчетом
    this.events = {}; // Хранит события
    this.currentState = { // Текущее состояние менеджера
      active: false,
      mode: SPLIT_MODES.SINGLE,
      layout: null
    };
    this.history = []; // История режимов разделения для функции "назад"
    this.renderComponentCallback = null; // Функция для рендеринга React компонентов
    this.verticalSplitCount = 0; // Счетчик вертикальных разделений
    this.horizontalSplitCount = 0; // Счетчик горизонтальных разделений
    this.observers = null; // Хранит наблюдателей для контейнеров
    this._pendingSplitWrappers = null; // Хранит ожидающие разделения
  }

  /**
   * Рендерит React-компонент в указанном контейнере
   * @param {string} componentType - Тип компонента для рендеринга
   * @param {HTMLElement} container - DOM-элемент контейнера
   * @param {Object} props - Свойства для компонента
   */
  renderComponent(componentType, container, props = {}) {
    // Используем функцию рендеринга, сохраненную при инициализации
    if (this.renderComponentCallback && typeof this.renderComponentCallback === 'function') {
      this.renderComponentCallback(componentType, container, props);
    } else {
      console.warn('Функция рендеринга React компонентов не определена');
      container.innerHTML = '<div class="error-message">Не удалось отрендерить компонент: отсутствует функция рендеринга</div>';
    }
  }

  /**
   * Получает текущее состояние разделения экрана
   * @returns {Object} Объект с информацией о текущем состоянии
   */
  getCurrentState() {
    // Сериализуем информацию о контейнерах для сохранения состояния
    const containersData = {};
    
    this.containers.forEach((info, id) => {
      containersData[id] = {
        type: info.type,
        parent: info.parent,
        children: info.children,
        content: info.content ? { 
          type: info.content.type || 'unknown',
          data: info.content.data || {}
        } : null
      };
    });
    
    return {
      active: this.rootContainer !== null,
      activeContainer: this.activeContainer,
      containers: containersData,
      mode: this.currentState.mode,
      isSelectionMode: this.isSelectionMode,
      layout: this.currentState.layout
    };
  }

  /**
   * Возвращает к предыдущему режиму разделения экрана
   * Используется для кнопки "Назад" в панели управления
   */
  goBack() {
    // Проверяем, есть ли предыдущие состояния
    if (this.history.length > 0) {
      // Получаем предыдущее состояние
      const previousState = this.history.pop();
      
      // Применяем предыдущее состояние
      if (previousState.mode) {
        // Устанавливаем режим без добавления нового элемента в историю
        this.setMode(previousState.mode, false);
      }
      
      // Вызываем событие возврата к предыдущему состоянию
      this.triggerEvent('historyBack', { previousState });
      
      return true;
    }
    
    // Если истории нет, просто возвращаемся к одиночному режиму
    this.setMode(SPLIT_MODES.SINGLE);
    return false;
  }

  /**
   * Устанавливает текущий режим разделения экрана
   * @param {string} mode - Режим разделения из SPLIT_MODES
   * @param {boolean} addToHistory - Добавлять ли текущее состояние в историю
   */
  setMode(mode, addToHistory = true) {
    // Если режим меняется и нужно добавить в историю, сохраняем текущее состояние
    if (this.currentState.mode !== mode && addToHistory) {
      this.history.push({
        mode: this.currentState.mode,
        layout: this.currentState.layout
      });
    }
    
    if (Object.values(SPLIT_MODES).includes(mode)) {
      this.currentState.mode = mode;
      
      // Если это предустановленный макет, применяем его
      if (mode !== SPLIT_MODES.SINGLE) {
        this.applyPredefinedLayout(mode);
      }
      
      // Вызываем событие изменения режима
      this.triggerEvent('modeChanged', { mode });
    }
  }

  /**
   * Применяет предустановленный макет разделения экрана
   * @param {string} layoutType - Тип макета из SPLIT_MODES
   */
  applyPredefinedLayout(layoutType) {
    // Очищаем текущее состояние
    this.resetSplitScreen();
    
    // Устанавливаем режим
    this.currentState.mode = layoutType;
    
    // Применяем соответствующий макет
    switch (layoutType) {
      case SPLIT_MODES.HORIZONTAL:
        // Горизонтальное разделение на две части
        this.splitContainer('initial-container', 'horizontal');
        break;
        
      case SPLIT_MODES.VERTICAL:
        // Вертикальное разделение на две части
        this.splitContainer('initial-container', 'vertical');
        break;
        
      case SPLIT_MODES.QUAD:
        // Разделение на четыре части (2x2)
        this.splitContainer('initial-container', 'vertical');
        this.splitContainer('initial-container-1', 'horizontal');
        this.splitContainer('initial-container-2', 'horizontal');
        break;
        
      default:
        // По умолчанию ничего не делаем
        break;
    }
    
    // Обновляем информацию о текущем макете
    this.currentState.layout = layoutType;
  }

  /**
   * Инициализирует менеджер разделения экрана
   * @param {HTMLElement} rootElement - Корневой элемент для всех разделенных экранов
   * @param {Array} reportTypes - Массив доступных типов отчетов
   * @param {Function} reportSelectionCallback - Функция для создания отчета после выбора
   * @param {Function} renderComponentCallback - Функция для рендеринга React компонентов
   */
  init(rootElement, reportTypes, reportSelectionCallback, renderComponentCallback) {
    this.rootContainer = rootElement;
    this.reportTypes = reportTypes;
    this.reportSelectionCallback = reportSelectionCallback;
    
    // Сохраняем функцию рендеринга React компонентов
    if (renderComponentCallback && typeof renderComponentCallback === 'function') {
      this.renderComponentCallback = renderComponentCallback;
    }
    
    // Создаем первоначальный контейнер
    this.rootContainer.innerHTML = '';
    this.rootContainer.classList.add('split-screen-container');
    
    const initialContainer = this.createContainer('initial-container');
    this.rootContainer.appendChild(initialContainer);
    
    this.containers.set('initial-container', {
      element: initialContainer,
      type: 'main',
      content: null,
      parent: null,
      children: []
    });
    
    this.activeContainer = 'initial-container';
    
    // Устанавливаем состояние активности
    this.currentState.active = true;
    
    // Добавляем глобальный обработчик
    window.splitScreenManager = this;
    
    // Инициализируем панель управления разделением
    this.initSplitControls();
    
    // Очищаем историю при инициализации
    this.history = [];
    
    console.log('SplitScreenManager инициализирован с режимом:', this.currentState.mode);
    
    return this;
  }

  /**
   * Создает контейнер для отчета
   * @param {string} id - Уникальный идентификатор контейнера
   * @returns {HTMLElement} - Созданный DOM-элемент контейнера
   */
  createContainer(id) {
    const container = document.createElement('div');
    container.className = 'report-container';
    container.id = id;
    container.dataset.containerId = id;
    
    // Добавляем обработчик клика для активации контейнера
    container.addEventListener('click', (e) => {
      if (e.target === container) {
        this.setActiveContainer(id);
      }
    });
    
    // Добавляем панель управления
    container.innerHTML = `
      <div class="container-controls">
        <button class="split-horizontal-btn" title="Разделить горизонтально">⬍</button>
        <button class="split-vertical-btn" title="Разделить вертикально">⬌</button>
        <button class="close-container-btn" title="Закрыть панель">×</button>
      </div>
      <div class="container-content"></div>
    `;
    
    // Добавляем обработчики для кнопок
    container.querySelector('.split-horizontal-btn').addEventListener('click', () => this.splitContainer(id, 'horizontal'));
    container.querySelector('.split-vertical-btn').addEventListener('click', () => this.splitContainer(id, 'vertical'));
    container.querySelector('.close-container-btn').addEventListener('click', () => this.closeContainer(id));
    
    return container;
  }

  /**
   * Устанавливает активный контейнер
   * @param {string} containerId - ID контейнера для активации
   */
  setActiveContainer(containerId) {
    // Удаляем активный класс со всех контейнеров
    document.querySelectorAll('.report-container.active').forEach(el => {
      el.classList.remove('active');
    });
    
    // Добавляем активный класс на новый контейнер
    const containerElement = document.getElementById(containerId);
    if (containerElement) {
      containerElement.classList.add('active');
      this.activeContainer = containerId;
      
      // Вызываем событие изменения активного контейнера
      this.triggerEvent('activeContainerChanged', { containerId });
    }
  }

  /**
   * Разделяет контейнер на два
   * @param {string} containerId - ID контейнера для разделения
   * @param {string} direction - Направление разделения ('horizontal' или 'vertical')
   */
  splitContainer(containerId, direction) {
    console.log(`Разделение контейнера ${containerId} по направлению ${direction}`);
    
    const containerInfo = this.containers.get(containerId);
    if (!containerInfo) {
      console.error(`Контейнер с ID ${containerId} не найден`);
      return;
    }
    
    const containerElement = containerInfo.element;
    if (!containerElement) {
      console.error(`Элемент контейнера с ID ${containerId} не найден`);
      return;
    }
    
    // Если в контейнере уже есть отчет, сохраняем его
    const existingContent = containerInfo.content;
    
    // Создаем оболочку для разделения
    const splitWrapper = document.createElement('div');
    splitWrapper.className = `split-wrapper ${direction === 'horizontal' ? 'horizontal' : 'vertical'}`;
    splitWrapper.id = `wrapper-${containerId}`;
    
    // Создаем два новых контейнера
    const container1Id = `${containerId}-1`;
    const container2Id = `${containerId}-2`;
    
    const container1 = this.createContainer(container1Id);
    const container2 = this.createContainer(container2Id);
    
    splitWrapper.appendChild(container1);
    splitWrapper.appendChild(container2);
    
    // Очищаем и добавляем оболочку в исходный контейнер
    const contentArea = containerElement.querySelector('.container-content');
    if (!contentArea) {
      console.error(`Контейнер контента для ${containerId} не найден`);
      return;
    }
    
    contentArea.innerHTML = '';
    contentArea.appendChild(splitWrapper);
    
    // Обновляем информацию о контейнерах
    this.containers.set(container1Id, {
      element: container1,
      type: 'child',
      content: null,
      parent: containerId,
      children: []
    });
    
    this.containers.set(container2Id, {
      element: container2,
      type: 'child',
      content: null,
      parent: containerId,
      children: []
    });
    
    // Обновляем информацию о родительском контейнере
    containerInfo.children = [container1Id, container2Id];
    containerInfo.type = 'parent';
    
    // Если был контент, перемещаем его в первый дочерний контейнер
    if (existingContent) {
      this.setContainerContent(container1Id, existingContent);
    }
    
    // Активируем второй контейнер и предлагаем выбрать для него отчет
    this.setActiveContainer(container2Id);
    
    // Запускаем режим выбора отчета для второго контейнера
    this.startReportSelection(container2Id);
    
    // Добавляем разделитель, который можно перетаскивать
    this.addResizer(splitWrapper, direction);
    
    // Увеличиваем счетчик соответствующего типа разделений
    if (direction === 'vertical') {
      this.verticalSplitCount++;
    } else {
      this.horizontalSplitCount++;
    }
    
    // Показываем селектор отчетов для второго контейнера
    // Используем событие вместо метода, которого нет
    this.triggerEvent('reportSelectionNeeded', { containerId: container2Id });
    
    // Вызываем событие разделения
    this.triggerEvent('containerSplit', {
      containerId,
      direction,
      childContainers: [container1Id, container2Id]
    });
    
    console.log(`Контейнер ${containerId} успешно разделен на ${container1Id} и ${container2Id}`);
  }

  /**
   * Добавляет разделитель, который можно перетаскивать
   * @param {HTMLElement} wrapper - Элемент-оболочка разделенных контейнеров
   * @param {string} direction - Направление разделения
   */
  addResizer(wrapper, direction) {
    const resizer = document.createElement('div');
    resizer.className = `resizer ${direction === 'horizontal' ? 'horizontal' : 'vertical'}`;
    wrapper.appendChild(resizer);
    
    let startPos = null;
    let startSize = null;
    
    const startResize = (e) => {
      e.preventDefault();
      startPos = direction === 'horizontal' ? e.clientY : e.clientX;
      
      // Получаем размеры контейнеров
      const containers = wrapper.querySelectorAll('.report-container');
      startSize = direction === 'horizontal' 
        ? containers[0].offsetHeight 
        : containers[0].offsetWidth;
      
      document.addEventListener('mousemove', resize);
      document.addEventListener('mouseup', stopResize);
    };
    
    const resize = (e) => {
      if (!startPos) return;
      
      // Вычисляем новое положение разделителя
      const newPos = direction === 'horizontal' ? e.clientY : e.clientX;
      const diff = newPos - startPos;
      
      // Получаем контейнеры
      const containers = wrapper.querySelectorAll('.report-container');
      
      // Рассчитываем новые размеры
      if (direction === 'horizontal') {
        const newHeight = startSize + diff;
        const totalHeight = wrapper.offsetHeight;
        
        if (newHeight > 100 && (totalHeight - newHeight) > 100) {
          containers[0].style.height = `${newHeight}px`;
          containers[1].style.height = `${totalHeight - newHeight - 10}px`;
        }
      } else {
        const newWidth = startSize + diff;
        const totalWidth = wrapper.offsetWidth;
        
        if (newWidth > 100 && (totalWidth - newWidth) > 100) {
          containers[0].style.width = `${newWidth}px`;
          containers[1].style.width = `${totalWidth - newWidth - 10}px`;
        }
      }
    };
    
    const stopResize = () => {
      document.removeEventListener('mousemove', resize);
      document.removeEventListener('mouseup', stopResize);
      startPos = null;
    };
    
    resizer.addEventListener('mousedown', startResize);
  }

  /**
   * Закрывает указанный контейнер
   * @param {string} containerId - ID контейнера для закрытия
   */
  closeContainer(containerId) {
    const containerInfo = this.containers.get(containerId);
    if (!containerInfo) return;
    
    // Если это корневой контейнер, просто очищаем его
    if (containerInfo.type === 'main') {
      containerInfo.element.querySelector('.container-content').innerHTML = '';
      containerInfo.content = null;
      return;
    }
    
    // Если это дочерний контейнер, ищем родителя и братский контейнер
    const parentId = containerInfo.parent;
    const parentInfo = this.containers.get(parentId);
    
    if (!parentInfo) return;
    
    // Находим братский контейнер
    const siblingId = parentInfo.children.find(id => id !== containerId);
    
    if (!siblingId) return;
    
    const siblingInfo = this.containers.get(siblingId);
    const siblingContent = siblingInfo.content;
    
    // Удаляем оболочку-разделитель
    const wrapper = document.getElementById(`wrapper-${parentId}`);
    if (wrapper) {
      wrapper.remove();
    }
    
    // Перемещаем содержимое брата в родительский контейнер
    if (siblingContent) {
      this.setContainerContent(parentId, siblingContent);
    }
    
    // Обновляем информацию о родительском контейнере
    parentInfo.type = siblingContent ? 'leaf' : 'empty';
    parentInfo.children = [];
    
    // Удаляем информацию о закрываемом и братском контейнерах
    this.containers.delete(containerId);
    this.containers.delete(siblingId);
    
    // Активируем родительский контейнер
    this.setActiveContainer(parentId);
    
    // Вызываем событие закрытия контейнера
    this.triggerEvent('containerClosed', { containerId, parentId });
  }

  /**
   * Начинает процесс выбора отчета для контейнера
   * @param {string} containerId - ID контейнера для заполнения отчетом
   */
  startReportSelection(containerId) {
    this.isSelectionMode = true;
    this.containerToFill = containerId;
    
    // Показываем модальное окно выбора отчета
    this.showReportSelectionModal();
    
    // Вызываем событие начала выбора отчета
    this.triggerEvent('reportSelectionStarted', { containerId });
  }

  /**
   * Показывает модальное окно выбора отчета
   */
  showReportSelectionModal() {
    // Проверяем, доступна ли функция для рендеринга React-компонентов
    const canRenderReact = this.renderComponentCallback && typeof this.renderComponentCallback === 'function';
    
    if (canRenderReact) {
      // Создаем React-компонент модального окна
      let modal = document.getElementById('report-selection-modal');
      
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'report-selection-modal';
        modal.className = 'report-selection-modal';
        document.body.appendChild(modal);
      }
      
      // Показываем модальное окно
      modal.style.display = 'flex';
      
      // Рендерим React-компонент для выбора отчета
      this.renderComponent('ReportSelector', modal, {
        onSelectReport: (reportType) => this.selectReport(reportType),
        onCancel: () => this.hideReportSelectionModal()
      });
    } else {
      // Создаем модальное окно с использованием обычного DOM, если React недоступен
      // Создаем модальное окно, если его еще нет
      let modal = document.getElementById('report-selection-modal');
      
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'report-selection-modal';
        modal.className = 'report-selection-modal';
        
        // Контент модального окна
        modal.innerHTML = `
          <div class="modal-content">
            <div class="modal-header">
              <h3>Выберите отчет</h3>
              <button class="close-modal-btn">×</button>
            </div>
            <div class="report-categories">
              <div class="report-category">
                <h4>Карта</h4>
                <ul class="report-list">
                  <li data-report-type="track">
                    <i class="map-icon"></i> Трек
                  </li>
                  <li data-report-type="live-track">
                    <i class="map-marker-icon"></i> Местоположение
                  </li>
                </ul>
              </div>
              <div class="report-category">
                <h4>Графики</h4>
                <ul class="report-list">
                  <li data-report-type="speed">
                    <i class="speed-icon"></i> Скорость
                  </li>
                  <li data-report-type="fuel">
                    <i class="fuel-icon"></i> Объем топлива
                  </li>
                  <li data-report-type="voltage">
                    <i class="voltage-icon"></i> Напряжение
                  </li>
                  <li data-report-type="rpm">
                    <i class="rpm-icon"></i> Обороты двигателя
                  </li>
                </ul>
              </div>
            </div>
          </div>
        `;
        
        document.body.appendChild(modal);
        
        // Добавляем обработчики событий
        modal.querySelector('.close-modal-btn').addEventListener('click', () => {
          this.hideReportSelectionModal();
        });
        
        // Обработчик выбора отчета
        const reportItems = modal.querySelectorAll('.report-list li');
        reportItems.forEach(item => {
          item.addEventListener('click', () => {
            const reportType = item.dataset.reportType;
            this.selectReport(reportType);
            this.hideReportSelectionModal();
          });
        });
      } else {
        modal.style.display = 'flex';
      }
    }
  }

  /**
   * Скрывает модальное окно выбора отчета
   */
  hideReportSelectionModal() {
    const modal = document.getElementById('report-selection-modal');
    if (modal) {
      modal.style.display = 'none';
    }
    
    this.isSelectionMode = false;
    
    // Если нет выбора, закрываем контейнер
    if (this.containerToFill) {
      const containerInfo = this.containers.get(this.containerToFill);
      if (containerInfo && !containerInfo.content) {
        this.closeContainer(this.containerToFill);
      }
    }
    
    this.containerToFill = null;
  }

  /**
   * Обрабатывает выбор типа отчета
   * @param {string} reportType - Тип выбранного отчета
   */
  selectReport(reportType) {
    if (!this.containerToFill) return;
    
    // Создаем отчет с помощью коллбэка
    if (this.reportSelectionCallback) {
      const reportContent = this.reportSelectionCallback(reportType, this.containerToFill);
      if (reportContent) {
        this.setContainerContent(this.containerToFill, reportContent);
      }
    }
    
    // Вызываем событие выбора отчета
    this.triggerEvent('reportSelected', { 
      containerId: this.containerToFill, 
      reportType 
    });
    
    this.containerToFill = null;
    this.isSelectionMode = false;
  }

  /**
   * Инициализирует панель управления разделением экрана
   */
  initSplitControls() {
    // Создаем панель управления, если ее еще нет
    let controls = document.getElementById('split-screen-controls');
    
    if (!controls) {
      controls = document.createElement('div');
      controls.id = 'split-screen-controls';
      controls.className = 'split-screen-controls';
      
      // Добавляем кнопки для различных макетов
      controls.innerHTML = `
        <button class="reset-split-btn" title="Сбросить разделение">Сбросить</button>
        <button class="exit-split-mode-btn" title="Выйти из режима разделения">Выйти из режима разделения</button>
      `;
      
      // Вставляем панель в документ
      document.body.appendChild(controls);
      
      // Добавляем обработчики событий
      controls.querySelector('.reset-split-btn').addEventListener('click', () => {
        this.resetSplitScreen();
      });
      
      controls.querySelector('.exit-split-mode-btn').addEventListener('click', () => {
        this.hideSplitScreen();
      });
    }
    
    // Показываем панель
    controls.style.display = 'flex';
  }

  /**
   * Сбрасывает разделение экрана до одного контейнера
   */
  resetSplitScreen() {
    // Сбрасываем счетчики разделений
    this.verticalSplitCount = 0;
    this.horizontalSplitCount = 0;
    
    // Существующий код сброса...
    if (this.rootContainer) {
      this.rootContainer.innerHTML = '';
      
      const initialContainer = this.createContainer('initial-container');
      this.rootContainer.appendChild(initialContainer);
      
      this.containers = new Map();
      this.containers.set('initial-container', {
        element: initialContainer,
        type: 'main',
        content: null,
        parent: null,
        children: []
      });
      
      this.activeContainer = 'initial-container';
      this.currentState.mode = SPLIT_MODES.SINGLE;
      
      // Вызываем событие сброса разделения
      this.triggerEvent('splitScreenReset');
    }
  }

  /**
   * Скрывает режим разделения экрана
   */
  hideSplitScreen() {
    const controls = document.getElementById('split-screen-controls');
    if (controls) {
      controls.style.display = 'none';
    }
    
    // Обновляем состояние активности
    this.currentState.active = false;
    this.currentState.mode = SPLIT_MODES.SINGLE;
    
    // Вызываем обратный вызов для выхода из режима разделения
    this.triggerEvent('splitScreenHidden');
    
    // Очищаем контейнеры перед выходом
    this.resetSplitScreen();
  }

  /**
   * Добавляет обработчик события
   * @param {string} event - Имя события
   * @param {Function} callback - Функция-обработчик
   */
  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  /**
   * Вызывает событие с указанными данными
   * @param {string} event - Имя события
   * @param {Object} data - Данные события
   */
  triggerEvent(event, data = {}) {
    if (this.events[event]) {
      this.events[event].forEach(callback => callback(data));
    }
  }

  /**
   * Изменяет режим разделения экрана
   * @param {string} mode - Режим разделения из SPLIT_MODES
   */
  changeSplitMode(mode) {
    if (!Object.values(SPLIT_MODES).includes(mode)) {
      console.warn(`Неизвестный режим разделения: ${mode}. Доступные режимы: ${Object.values(SPLIT_MODES).join(', ')}`);
      return false;
    }
    
    // Используем метод setMode для изменения режима с добавлением в историю
    this.setMode(mode);
    
    // Если режим одиночный, сбрасываем разделение экрана
    if (mode === SPLIT_MODES.SINGLE) {
      this.resetSplitScreen();
    }
    
    return true;
  }

  /**
   * Добавляет обработчики событий при создании разделенных контейнеров
   * чтобы избежать проблем с узлами DOM
   * @param {HTMLElement} container1 - Первый контейнер
   * @param {HTMLElement} container2 - Второй контейнер
   */
  addContainerEventHandlers(container1, container2) {
    // Эти обработчики помогут отследить изменения в DOM
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          console.log('Изменение дочерних элементов контейнера:', 
            mutation.target.id, 
            'Добавлено:', mutation.addedNodes.length, 
            'Удалено:', mutation.removedNodes.length);
        }
      });
    });
    
    // Наблюдаем за обоими контейнерами
    if (container1) {
      observer.observe(container1, { childList: true, subtree: true });
      console.log(`SplitScreenManager: Наблюдение за контейнером ${container1.id} установлено`);
    }
    
    if (container2) {
      observer.observe(container2, { childList: true, subtree: true });
      console.log(`SplitScreenManager: Наблюдение за контейнером ${container2.id} установлено`);
    }
    
    // Сохраняем ссылку на observer для возможной очистки
    if (container1?.id) {
      this.observers = this.observers || new Map();
      this.observers.set(container1.id, observer);
    }
  }
  
  /**
   * Безопасно очищает контейнер, учитывая возможное наличие React-компонентов
   * @param {HTMLElement} container - Контейнер для очистки
   * @returns {HTMLElement|null} - Очищенный контейнер или null в случае ошибки
   */
  safelyEmptyContainer(container) {
    if (!container) {
      console.warn('SplitScreenManager: Попытка очистить несуществующий контейнер');
      return null;
    }
    
    // Проверяем, управляется ли контейнер React
    const isReactManaged = container.hasAttribute('data-react-managed') || 
                          container.hasAttribute('data-reactroot') || 
                          container.querySelector('[data-reactroot]');
    
    console.log(`SplitScreenManager: Очистка контейнера ${container.id || 'без ID'}, React-управляемый: ${isReactManaged}`);
    
    if (isReactManaged) {
      // Если контейнер управляется React, мы не удаляем его содержимое напрямую
      // Вместо этого, добавляем специальный атрибут, который React-код может обработать
      container.setAttribute('data-split-requested', 'true');
      container.setAttribute('data-split-timestamp', Date.now().toString());
      
      // Не изменяем содержимое React-контейнера напрямую
      return container;
    } else {
      try {
        // Для обычных контейнеров можем безопасно очистить содержимое
        // Но делаем это осторожно, избегая innerHTML
        while (container.firstChild) {
          try {
            container.removeChild(container.firstChild);
          } catch (e) {
            console.error(`Ошибка при очистке контейнера: ${e.message}`);
            break;
          }
        }
        return container;
      } catch (e) {
        console.error(`Глобальная ошибка при очистке контейнера: ${e.message}`);
        return null;
      }
    }
  }
  
  /**
   * Добавляет динамическое разделение контейнера
   * @param {string} containerId - ID контейнера для разделения
   * @param {string} direction - Направление разделения ('horizontal' или 'vertical')
   * @returns {boolean} - Успешно ли выполнено разделение
   */
  addDynamicSplit(containerId, direction) {
    console.log(`SplitScreenManager: Начало разделения контейнера ${containerId} по направлению ${direction}`);
    
    // Проверяем, не превышено ли максимальное количество разделений
    if (direction === 'vertical' && this.verticalSplitCount >= MAX_SPLITS.VERTICAL) {
      // Показываем уведомление о максимальном количестве колонок
      if (window.showNotification) {
        window.showNotification('warning', `Достигнуто максимальное количество вертикальных разделений (${MAX_SPLITS.VERTICAL})`);
      } else {
        console.warn(`Достигнуто максимальное количество вертикальных разделений (${MAX_SPLITS.VERTICAL})`);
      }
      return false;
    }
    
    if (direction === 'horizontal' && this.horizontalSplitCount >= MAX_SPLITS.HORIZONTAL) {
      // Показываем уведомление о максимальном количестве строк
      if (window.showNotification) {
        window.showNotification('warning', `Достигнуто максимальное количество горизонтальных разделений (${MAX_SPLITS.HORIZONTAL})`);
      } else {
        console.warn(`Достигнуто максимальное количество горизонтальных разделений (${MAX_SPLITS.HORIZONTAL})`);
      }
      return false;
    }
    
    // Сохраняем текущее состояние в историю перед разделением
    this.history.push({
      mode: this.currentState.mode,
      layout: this.currentState.layout
    });
    
    // Улучшенный поиск контейнера с несколькими стратегиями
    let containerElement = null;
    
    // Стратегия 1: Поиск контейнера по ID напрямую
    containerElement = document.getElementById(containerId);
    
    // Стратегия 2: Поиск по атрибуту data-container-id
    if (!containerElement) {
      const containers = document.querySelectorAll(`[data-container-id="${containerId}"]`);
      if (containers.length > 0) {
        console.log(`SplitScreenManager: Найден контейнер по data-container-id: ${containerId}`);
        containerElement = containers[0];
      }
    }
    
    // Стратегия 3: Пытаемся найти контейнер из this.containers
    if (!containerElement) {
      const containerInfo = this.containers.get(containerId);
      if (containerInfo && containerInfo.element) {
        console.log(`SplitScreenManager: Найден контейнер из кэша: ${containerId}`);
        containerElement = containerInfo.element;
      }
    }
    
    // Если контейнер не найден, сообщаем об ошибке
    if (!containerElement) {
      console.error(`Контейнер с ID ${containerId} не найден`);
      
      // Выводим список всех доступных контейнеров для отладки
      const allContainers = document.querySelectorAll('.report-container, .chart-split-container, [id*="container"]');
      console.log('Доступные контейнеры:', Array.from(allContainers).map(c => c.id || 'без ID'));
      
      return false;
    }
    
    // Получаем информацию о контейнере из кэша или создаем новую
    let container = this.containers.get(containerId);
    if (!container) {
      console.log(`SplitScreenManager: Создаем новую информацию о контейнере ${containerId}`);
      container = {
        element: containerElement,
        type: 'main',
        content: null,
        parent: null,
        children: []
      };
      this.containers.set(containerId, container);
    }
    
    // Создаем ID для новых контейнеров
    const container1Id = `${containerId}-1`;
    const container2Id = `${containerId}-2`;
    
    // Проверяем, управляется ли контейнер React
    const isReactManaged = containerElement.hasAttribute('data-react-managed') || 
                         containerElement.hasAttribute('data-reactroot') || 
                         containerElement.querySelector('[data-reactroot]');
    
    console.log(`SplitScreenManager: Создание нового разделения: ${containerId} -> ${container1Id}, ${container2Id}, React-управляемый: ${isReactManaged}`);
    
    // Сохраняем тип контента первого контейнера для передачи его в первый дочерний контейнер
    const originalContent = container.content;
    
    // Регистрируем новые контейнеры в кэше
    this.containers.set(container1Id, {
      element: null, // Заполним позже
      type: 'child',
      content: originalContent, // Сохраняем исходный контент для первого контейнера
      parent: containerId,
      children: []
    });
    
    this.containers.set(container2Id, {
      element: null, // Заполним позже
      type: 'child',
      content: null, // Второй контейнер пока пустой
      parent: containerId,
      children: []
    });
    
    // Обновляем информацию о родительском контейнере
    container.children = [container1Id, container2Id];
    container.type = 'parent';
    
    // Увеличиваем счетчик соответствующего типа разделений
    if (direction === 'vertical') {
      this.verticalSplitCount++;
    } else {
      this.horizontalSplitCount++;
    }
    
    // Для React-контейнеров используем событийный подход
    // Создаем событие для координации с React-компонентами
    const event = new CustomEvent('splitContainerRequested', {
      detail: {
        containerId: containerId,
        container1Id: container1Id,
        container2Id: container2Id,
        direction: direction,
        originalContent: originalContent ? true : false
      }
    });
    document.dispatchEvent(event);
    
    // Вызываем событие разделения контейнера
    this.triggerEvent('containerSplit', {
      containerId,
      direction,
      childContainers: [container1Id, container2Id],
      isReactManaged
    });
    
    // Запускаем таймер для перерисовки графиков после разделения
    setTimeout(() => {
      // Отправляем событие изменения размера, чтобы графики обновились
      window.dispatchEvent(new Event('resize'));
      
      // Отправляем событие завершения разделения контейнера
      const completeEvent = new CustomEvent('splitContainerComplete', {
        detail: {
          containerId: containerId,
          container1Id: container1Id,
          container2Id: container2Id,
          direction: direction
        }
      });
      document.dispatchEvent(completeEvent);
      
      console.log(`SplitScreenManager: Контейнер ${containerId} успешно разделен на ${container1Id} и ${container2Id}`);
    }, 100);
    
    return true;
  }
  
  /**
   * Метод для обновления графиков после изменения размера контейнеров
   * @param {string} containerId - ID контейнера, в котором находится график
   */
  updateChartInContainer(containerId) {
    // Создаем событие для обновления графика
    const updateEvent = new CustomEvent('updateChart', {
      detail: {
        containerId: containerId,
        timestamp: Date.now()
      }
    });
    document.dispatchEvent(updateEvent);
    
    // Также вызываем общее событие изменения размера
    window.dispatchEvent(new Event('resize'));
  }
}

// Создаем экземпляр класса SplitScreenManager и экспортируем его как экспорт по умолчанию
const splitScreenManager = new SplitScreenManager();
export default splitScreenManager;