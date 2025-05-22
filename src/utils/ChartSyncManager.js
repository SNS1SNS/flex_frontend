/**
 * ChartSyncManager - модуль для синхронизации масштабирования между графиками
 * Позволяет синхронизировать зум, панорамирование и выделение во всех графиках
 */

class ChartSyncManager {
  constructor() {
    // Map для хранения графиков
    this.charts = new Map();
    
    // Настройки синхронизации
    this.syncEnabled = true;
    this.syncSelectionEnabled = true;
    this.suppressEvents = false;
    
    // Флаги для предотвращения рекурсивных вызовов
    this.syncInProgress = false;
    this.panInProgress = false;
    this.selectionInProgress = false;
    
    // Последние использованные диапазоны для новых графиков
    this.lastZoomRange = null;
    this.lastPanRange = null;
    this.lastSelectionRange = null;
    
    // Состояние разделенного экрана
    this.splitContainers = new Set();
    
    // Карта групп синхронизации для разделенных контейнеров
    this.syncGroups = new Map();
    
    // Карта для хранения выделений по группам
    this.groupSelections = new Map();
    
    console.log('ChartSyncManager: Менеджер синхронизации графиков инициализирован');
    
    // Регистрируем глобальные обработчики событий
    document.addEventListener('splitContainerComplete', this.handleSplitComplete.bind(this));
    document.addEventListener('chartInitialized', this.handleChartInitialized.bind(this));
    // Слушаем события от SplitScreenContainer
    document.addEventListener('graphSelectionChanged', this.handleSplitContainerSelection.bind(this));
    document.addEventListener('splitContainerInitialized', this.handleSplitContainerInitialized.bind(this));
    
    // Добавляем интервал для периодической проверки новых графиков
    this.scanInterval = setInterval(this.scanForNewCharts.bind(this), 2000);
  }

  /**
   * Обработчик события инициализации графика
   * @param {Event} event - Событие с данными графика
   */
  handleChartInitialized(event) {
    const { chartId, chartInstance } = event.detail;
    if (chartId && chartInstance) {
      this.registerChart(chartId, chartInstance);
    }
  }

  /**
   * Обработчик события разделения экрана
   * @param {Event} event - Событие с данными о разделении
   */
  handleSplitComplete(event) {
    console.log(`ChartSyncManager: Получено событие разделения экрана`, event?.detail || {});
    
    // Извлекаем информацию о контейнерах из события
    const { newContainers } = event.detail || {};
    
    // Сохраняем ID новых контейнеров для последующего отслеживания
    if (newContainers && Array.isArray(newContainers)) {
      this.newSplitContainers = newContainers;
      console.log(`ChartSyncManager: Добавлены новые контейнеры для отслеживания: ${newContainers.join(', ')}`);
      
      // Добавляем контейнеры в список разделенных
      newContainers.forEach(id => {
        this.splitContainers.add(id);
      });
    }
    
    // Выполняем агрессивное сканирование DOM для поиска новых графиков через интервалы времени
    const timeouts = [100, 300, 600, 1000, 2000];
    
    timeouts.forEach((timeout, index) => {
      setTimeout(() => {
        console.log(`ChartSyncManager: Повторное сканирование через ${timeout}мс после разделения экрана`);
        const newChartsFound = this.scanForNewCharts(index >= 2); // Агрессивный поиск для последних попыток
        
        if (newChartsFound > 0) {
          console.log(`ChartSyncManager: Найдено ${newChartsFound} новых графиков при сканировании #${index+1}`);
        
          // Применяем последний масштаб и выделение ко всем новым графикам
          this.forceSyncAllCharts();
        }
      }, timeout);
    });
  }

  /**
   * Вспомогательный метод для применения последних сохраненных диапазонов
   * к всем графикам
   */
  applyLastRanges() {
    // Применяем последний масштаб ко всем графикам, если он существует
    if (this.lastZoomRange) {
      console.log(`ChartSyncManager: Применяем сохраненный масштаб ко всем графикам`);
          
      this.charts.forEach((chart, id) => {
        this.applyCurrentZoomToChart(id);
      });
    }
    
    // Если включена синхронизация выделений и есть сохраненное выделение, применяем его
    if (this.syncSelectionEnabled && this.lastSelectionRange) {
      console.log(`ChartSyncManager: Применяем сохраненное выделение ко всем графикам`);
      
      this.charts.forEach((chart, id) => {
        this.applyCurrentSelectionToChart(id);
      });
    }
  }

  /**
   * Сканирует DOM для поиска новых графиков
   * @param {boolean} useAggressiveSearch - Использовать более агрессивный алгоритм поиска для сложных случаев
   */
  scanForNewCharts(useAggressiveSearch = false) {
    // Получаем все canvas-элементы графиков на странице
    const canvasElements = document.querySelectorAll('canvas');
    console.log(`ChartSyncManager: Сканирование DOM, найдено ${canvasElements.length} canvas-элементов`);
    
    let newChartsFound = 0;
    
    // Проверяем все canvas элементы
    canvasElements.forEach(canvas => {
      // Проверяем, есть ли у canvas data-graph атрибут - это наши графики
      const isChartCanvas = canvas.hasAttribute('data-graph') || 
                           canvas.closest('[data-chart="true"]') ||
                           canvas.closest('.chart-container');
                           
      if (isChartCanvas) {
        // Получаем контейнер графика
        const container = this.findContainerForCanvas(canvas);
        
        if (container) {
          const containerId = container.id || container.getAttribute('data-container-id');
          if (containerId) {
            // Проверяем, не зарегистрирован ли уже этот график
            if (!this.charts.has(containerId)) {
              // Ищем экземпляр графика
              const chartInstance = this.extractChartInstanceFromCanvas(canvas);
              
              if (chartInstance) {
                // Регистрируем график
                this.registerChart(containerId, chartInstance);
                newChartsFound++;
                
                // Устанавливаем все возможные ссылки на экземпляр графика
                canvas.__chartjs__ = chartInstance;
                canvas.__chartInstance = chartInstance;
                canvas.setAttribute('data-registered', 'true');
                
                // Добавляем атрибут с ID контейнера для последующего поиска
                if (!canvas.hasAttribute('data-container-id')) {
                  canvas.setAttribute('data-container-id', containerId);
                }
              }
            }
          }
        }
      }
    });
    
    // Если обычный поиск не дал результатов и использован агрессивный поиск
    if (newChartsFound === 0 && useAggressiveSearch) {
      console.log(`ChartSyncManager: Агрессивное сканирование для поиска всех возможных графиков`);
      
      // Проверяем все контейнеры с разделенными экранами
      const splitContainers = document.querySelectorAll('.split-screen-container, .split-pane, [data-split="true"]');
      
      splitContainers.forEach(container => {
        // Ищем все canvas в контейнере
        const containerCanvases = container.querySelectorAll('canvas');
        
        containerCanvases.forEach(canvas => {
          // Пытаемся получить containerId из различных атрибутов
          let containerId = canvas.closest('[id]')?.id || 
                          canvas.closest('[data-container-id]')?.getAttribute('data-container-id');
                          
          if (!containerId) {
            // Генерируем уникальный ID, если не найден
            containerId = `chart-container-${Math.random().toString(36).substr(2, 9)}`;
            canvas.closest('[id]') || canvas.closest('[data-container-id]')?.setAttribute('data-container-id', containerId);
          }
          
          // Пытаемся получить экземпляр графика из canvas
          const chartInstance = this.extractChartInstanceFromCanvas(canvas);
          
          if (chartInstance && !this.charts.has(containerId)) {
            this.registerChart(containerId, chartInstance);
            newChartsFound++;
            
            // Устанавливаем ссылки на экземпляр графика для последующего использования
            canvas.__chartjs__ = chartInstance;
            canvas.__chartInstance = chartInstance;
            canvas.setAttribute('data-registered', 'true');
            canvas.setAttribute('data-container-id', containerId);
          }
        });
      });
    }
    
    // Проверяем новые контейнеры, которые могли появиться после разделения экрана
    if (this.newSplitContainers && this.newSplitContainers.length > 0) {
      console.log(`ChartSyncManager: Проверка ${this.newSplitContainers.length} новых контейнеров после разделения: ${this.newSplitContainers.join(', ')}`);
      
      this.newSplitContainers.forEach(containerId => {
        const container = document.getElementById(containerId) || 
                        document.querySelector(`[data-container-id="${containerId}"]`);
        
        if (container) {
          const containerCanvases = container.querySelectorAll('canvas');
          console.log(`ChartSyncManager: В контейнере ${containerId} найдено ${containerCanvases.length} canvas-элементов`);
          
          containerCanvases.forEach(canvas => {
            // Проверяем, не зарегистрирован ли уже этот график
        if (!this.charts.has(containerId)) {
              const chartInstance = this.extractChartInstanceFromCanvas(canvas);
              
              if (chartInstance) {
                this.registerChart(containerId, chartInstance);
                newChartsFound++;
                
                canvas.__chartjs__ = chartInstance;
                canvas.__chartInstance = chartInstance;
                canvas.setAttribute('data-registered', 'true');
              }
            }
          });
        }
      });
    }
    
    if (newChartsFound > 0) {
      console.log(`ChartSyncManager: Найдено и зарегистрировано ${newChartsFound} новых графиков`);
      
      // Вызываем принудительную синхронизацию
      this.forceSyncAllCharts();
      
      // Применяем сохраненные диапазоны зума ко всем новым графикам
      this.applyLastRanges();
    }
    
    return newChartsFound;
  }

  /**
   * Извлекает экземпляр графика из canvas элемента
   * @param {HTMLElement} canvas - Canvas элемент
   * @returns {Object|null} - Экземпляр графика или null
   */
  extractChartInstanceFromCanvas(canvas) {
    // Проверяем различные свойства, где может быть экземпляр графика
    return canvas.__chartjs__ || 
           canvas.__chartInstance || 
           canvas._chart || 
           canvas.chart || 
           (canvas.getContext && canvas.getContext('2d').__chartjs__) ||
           (canvas.getContext && canvas.getContext('2d')._chart);
  }

  /**
   * Находит контейнер для canvas элемента
   * @param {HTMLElement} canvas - Canvas элемент
   * @returns {HTMLElement|null} - Контейнер графика или null
   */
  findContainerForCanvas(canvas) {
    // Ищем контейнер графика по различным селекторам
    return canvas.closest('.chart-container') || 
           canvas.closest('.split-screen-container') || 
           canvas.closest('.split-pane') || 
           canvas.closest('.report-container') || 
           canvas.closest('[data-chart="true"]') ||
           canvas.closest('[data-container-id]') ||
           canvas.closest('[id]');
  }

  /**
   * Регистрирует график для синхронизации
   * @param {string} id - Уникальный идентификатор графика
   * @param {object} chartInstance - Экземпляр графика Chart.js
   */
  registerChart(id, chartInstance) {
    if (!id || !chartInstance) {
      console.warn('ChartSyncManager: Невозможно зарегистрировать график. Отсутствует ID или экземпляр графика.');
      return;
    }

    // Проверяем, не был ли график уничтожен
    if (chartInstance.isDestroyed) {
      console.warn(`ChartSyncManager: График ${id} не может быть зарегистрирован, так как он уничтожен.`);
      return;
    }

    // Если график уже зарегистрирован, обновляем регистрацию с новым экземпляром
    if (this.charts.has(id)) {
      const existingChart = this.charts.get(id);
      if (existingChart !== chartInstance) {
        console.log(`ChartSyncManager: Обновляем регистрацию графика ${id} с новым экземпляром`);
      this.unregisterChart(id);
      } else {
        // Это тот же экземпляр, ничего не делаем
        return;
      }
    }

    // Сохраняем ссылку на график
    this.charts.set(id, chartInstance);
    console.log(`ChartSyncManager: График ${id} зарегистрирован для синхронизации`);

    // Добавляем слушатели событий для этого графика
    this.addEventListeners(id, chartInstance);

    // Если есть сохраненный масштаб, применяем его к этому графику с задержкой,
    // чтобы убедиться, что график полностью инициализирован
    if (this.lastZoomRange) {
      setTimeout(() => {
        if (this.charts.has(id) && !chartInstance.isDestroyed) {
          console.log(`ChartSyncManager: Применяем сохраненный масштаб к графику ${id}`);
      this.applyCurrentZoomToChart(id);
      
      // Добавляем событие, что график был обновлен после регистрации
      document.dispatchEvent(new CustomEvent('chartSynchronized', {
        detail: {
          chartId: id,
          range: this.lastZoomRange,
          timestamp: Date.now()
        }
      }));
        }
      }, 100);
    } else if (this.charts.size > 1) {
      // Проверяем, есть ли уже другие графики с установленным масштабом
      // Если есть другие графики, сканируем их для взятия масштаба первого
      const otherCharts = Array.from(this.charts.entries())
        .filter(([chartId]) => chartId !== id);
        
      if (otherCharts.length > 0) {
        const [firstChartId, firstChart] = otherCharts[0];
        
        if (firstChart && firstChart.scales && firstChart.scales.x) {
          const scaleOptions = firstChart.scales.x.options || {};
          if (scaleOptions.min !== undefined && scaleOptions.max !== undefined) {
            const range = { min: scaleOptions.min, max: scaleOptions.max };
            console.log(`ChartSyncManager: Копируем масштаб с графика ${firstChartId} на новый график ${id}:`, range);
            
            // Сохраняем диапазон как последний использованный
            this.lastZoomRange = range;
            
            // Применяем масштаб с небольшой задержкой
            setTimeout(() => {
              if (this.charts.has(id) && !chartInstance.isDestroyed) {
                this.applyCurrentZoomToChart(id);
              }
            }, 100);
          }
        }
      }
    }

    // Если график является частью разделенного экрана, добавляем его в соответствующую группу
    const container = document.getElementById(id) || 
                     document.querySelector(`[data-container-id="${id}"]`);
                     
    if (container) {
      const syncGroupId = container.getAttribute('data-sync-group');
      if (syncGroupId) {
        // Добавляем график в группу синхронизации
        if (!this.syncGroups.has(syncGroupId)) {
          this.syncGroups.set(syncGroupId, new Set());
        }
        this.syncGroups.get(syncGroupId).add(id);
        console.log(`ChartSyncManager: График ${id} добавлен в группу синхронизации ${syncGroupId}`);
        
        // Проверяем, есть ли сохраненное выделение для этой группы
        if (this.groupSelections.has(syncGroupId)) {
          const selection = this.groupSelections.get(syncGroupId);
          console.log(`ChartSyncManager: Применяем сохраненное выделение из группы ${syncGroupId} к графику ${id}`);
          
          setTimeout(() => {
            if (this.charts.has(id) && !chartInstance.isDestroyed) {
              this.applySelectionToChart(chartInstance, id, selection);
            }
          }, 100);
        }
      }
    }
    
    // Добавляем обработчик клавиши пробел для сброса зума всех графиков
    if (this.charts.size === 1) {
      // Добавляем только один раз, когда регистрируется первый график
      this.setupKeyboardShortcuts();
    }
  }

  /**
   * Удаляет график из синхронизации
   * @param {string} id - Идентификатор графика для удаления
   */
  unregisterChart(id) {
    if (this.charts.has(id)) {
      const chartInstance = this.charts.get(id);
      
      // Восстанавливаем оригинальные обработчики событий, если они были сохранены
      if (chartInstance._originalZoomCallback) {
        chartInstance.options.plugins.zoom.zoom.onZoom = chartInstance._originalZoomCallback;
      }
      
      if (chartInstance._originalPanCallback) {
        chartInstance.options.plugins.zoom.pan.onPan = chartInstance._originalPanCallback;
      }
      
      this.charts.delete(id);
      console.log(`ChartSyncManager: График ${id} удален из синхронизации`);
    }
  }

  /**
   * Добавляет слушатели событий к графику
   * @param {string} id - Идентификатор графика
   * @param {object} chartInstance - Экземпляр графика
   */
  addEventListeners(id, chartInstance) {
    if (!chartInstance.options || !chartInstance.options.plugins || !chartInstance.options.plugins.zoom) {
      console.warn(`ChartSyncManager: График ${id} не имеет настроенного плагина зума.`);
      return;
    }

    try {
      console.log(`ChartSyncManager: Настройка слушателей событий для графика ${id}...`);
      
      // Сохраняем оригинальные обработчики
      const originalZoomCallback = chartInstance.options.plugins.zoom.zoom.onZoom;
      const originalPanCallback = chartInstance.options.plugins.zoom.pan.onPan;
      
      // Важно: сохраняем оригинальные обработчики в обычных переменных,
      // НЕ в свойствах chartInstance, чтобы избежать рекурсии
      console.log(`ChartSyncManager: Оригинальные обработчики сохранены для графика ${id}`);

      // Переопределяем обработчик зума с детальным логированием
      chartInstance.options.plugins.zoom.zoom.onZoom = (context) => {
        console.log(`ChartSyncManager: Событие onZoom вызвано для графика ${id}`);
        
        // Вызываем оригинальный обработчик, если он был
        if (originalZoomCallback && typeof originalZoomCallback === 'function') {
          console.log(`ChartSyncManager: Вызываем оригинальный обработчик onZoom для графика ${id}`);
          // Важно: передаем контекст напрямую, избегая this.
          originalZoomCallback(context);
        }

        // Если синхронизация отключена или события подавлены, ничего не делаем
        if (!this.syncEnabled) {
          console.log(`ChartSyncManager: Синхронизация отключена, пропускаем событие для графика ${id}`);
          return;
        }
        
        if (this.suppressEvents) {
          console.log(`ChartSyncManager: События подавлены, пропускаем событие для графика ${id}`);
          return;
        }

        // Получаем текущие границы масштабирования
        const scale = context.chart.scales.x;
        if (!scale) {
          console.warn(`ChartSyncManager: График ${id} не имеет шкалы X в событии onZoom`);
          return;
        }
        
        const range = {
          min: scale.min,
          max: scale.max
        };
        
        console.log(`ChartSyncManager: Получен диапазон масштабирования для графика ${id}:`, range);

        // Сохраняем диапазон и синхронизируем с другими графиками
        this.lastZoomRange = range;
        this.syncZoom(id, range);
        
        // Для отладки выводим информацию о всех графиках
        console.log(`ChartSyncManager: Состояние после syncZoom, всего графиков: ${this.charts.size}`);
        this.charts.forEach((c, chartId) => {
          if (c.scales && c.scales.x) {
            console.log(`ChartSyncManager: График ${chartId} текущий диапазон:`, {
              min: c.scales.x.min,
              max: c.scales.x.max
            });
          }
        });
      };

      // Переопределяем обработчик панорамирования с детальным логированием
      chartInstance.options.plugins.zoom.pan.onPan = (context) => {
        console.log(`ChartSyncManager: Событие onPan вызвано для графика ${id}`);
        
        // Вызываем оригинальный обработчик, если он был
        if (originalPanCallback && typeof originalPanCallback === 'function') {
          console.log(`ChartSyncManager: Вызываем оригинальный обработчик onPan для графика ${id}`);
          // Важно: передаем контекст напрямую, избегая this.
          originalPanCallback(context);
        }

        // Если синхронизация отключена или события подавлены, ничего не делаем
        if (!this.syncEnabled) {
          console.log(`ChartSyncManager: Синхронизация отключена, пропускаем событие для графика ${id}`);
          return;
        }
        
        if (this.suppressEvents) {
          console.log(`ChartSyncManager: События подавлены, пропускаем событие для графика ${id}`);
          return;
        }

        // Получаем текущие границы после панорамирования
        const scale = context.chart.scales.x;
        if (!scale) {
          console.warn(`ChartSyncManager: График ${id} не имеет шкалы X в событии onPan`);
          return;
        }
        
        const range = {
          min: scale.min,
          max: scale.max
        };
        
        console.log(`ChartSyncManager: Получен диапазон панорамирования для графика ${id}:`, range);

        // Сохраняем диапазон и синхронизируем с другими графиками
        this.lastPanRange = range;
        this.syncPan(id, range);
      };
      
      // Улучшенная обработка события выделения для разделенных отчетов
      if (chartInstance.options.plugins.zoom.zoom.drag) {
        console.log(`ChartSyncManager: Настройка улучшенного обработчика выделения для графика ${id}`);
        
        // Оригинальный обработчик drag.onDragEnd
        const originalDragEnd = chartInstance.options.plugins.zoom.zoom.drag.onDragEnd;
        
        // Сохраняем оригинальный обработчик
        chartInstance._originalDragEndCallback = originalDragEnd;
        
        // Переопределяем обработчик завершения выделения с улучшенной логикой
        chartInstance.options.plugins.zoom.zoom.drag.onDragEnd = (event, chartArea, zoomOptions) => {
          console.log(`ChartSyncManager: [УЛУЧШЕНО] Событие onDragEnd вызвано для графика ${id}`);
          
          // Отмечаем, что это событие выделения
          this._lastDragEvent = {
            chartId: id,
            timestamp: Date.now()
          };
          
          // Вызываем оригинальный обработчик, если он был
          if (chartInstance._originalDragEndCallback) {
            chartInstance._originalDragEndCallback(event, chartArea, zoomOptions);
          }
          
          // Улучшенная обработка выделения - несколько попыток с интервалами
          const captureSelectionRange = () => {
            if (!this.syncEnabled || !this.syncSelectionEnabled || this.suppressEvents) return false;
            
            const scale = chartInstance.scales?.x;
            if (!scale) {
              console.warn(`ChartSyncManager: Не найдена шкала X в графике ${id} при выделении`);
              return false;
            }
            
            // Проверяем, изменился ли масштаб после выделения
            const range = {
              min: scale.min,
              max: scale.max
            };
            
            // Проверяем, что диапазон имеет смысл (min < max)
            if (range.min >= range.max) {
              console.warn(`ChartSyncManager: Некорректный диапазон выделения для графика ${id}:`, range);
              return false;
            }
            
            console.log(`ChartSyncManager: [УЛУЧШЕНО] Захвачен диапазон выделения для графика ${id}:`, range);
            
            // Сохраняем диапазон и принудительно синхронизируем выделение с другими графиками
            this.lastSelectionRange = range;
            this.lastZoomRange = range; // Для совместимости со старым кодом
            this.suppressEvents = true;  // Предотвращаем циклическую синхронизацию
            
            // Принудительно применяем выделение ко всем другим графикам
            this.charts.forEach((chart, chartId) => {
              if (chartId !== id) {
                console.log(`ChartSyncManager: [УЛУЧШЕНО] Применяем выделение к графику ${chartId}`);
                this.applyZoomToChart(chart, chartId, range);
              }
            });
            
            this.suppressEvents = false;
            
            // Отправляем событие о синхронизации выделения
            document.dispatchEvent(new CustomEvent('chartSelectionSynchronized', {
              detail: {
                sourceId: id,
                range: range,
                timestamp: Date.now()
              }
            }));
            
            return true;
          };
          
          // Пытаемся несколько раз захватить и применить выделение с разными интервалами
          // Это помогает для разделенных отчетов, где обновление графика может быть асинхронным
          setTimeout(() => {
            if (!captureSelectionRange()) {
              // Если первая попытка не удалась, пробуем еще раз через 100мс
              setTimeout(() => {
                if (!captureSelectionRange()) {
                  // Если вторая попытка не удалась, последняя попытка через 250мс
                  setTimeout(captureSelectionRange, 250);
                }
              }, 100);
            }
          }, 50);
        };
        
        // Добавляем прямой обработчик события mouseup на canvas
        const canvasElement = chartInstance.canvas;
        if (canvasElement) {
          console.log(`ChartSyncManager: [УЛУЧШЕНО] Добавление прямого обработчика mouseup для графика ${id}`);
          
          // Сохраняем ссылку на обработчик для возможности удаления
          const handleMouseUp = () => {
            // Проверяем, было ли это после выделения области
            if (this._lastDragEvent && (Date.now() - this._lastDragEvent.timestamp < 500)) {
              console.log(`ChartSyncManager: [УЛУЧШЕНО] Обработка mouseup после выделения для графика ${id}`);
              
              // Через небольшую задержку проверяем и синхронизируем диапазон
              setTimeout(() => {
                if (!this.syncEnabled || this.suppressEvents) return;
                
                // Принудительно запускаем синхронизацию от этого графика
                this.forceSyncAllCharts(id);
              }, 100);
            }
          };
          
          // Сохраняем обработчик для возможности удаления при отмене регистрации
          chartInstance._mouseUpHandler = handleMouseUp;
          canvasElement.addEventListener('mouseup', handleMouseUp);
        }
      }

      console.log(`ChartSyncManager: Слушатели событий успешно добавлены к графику ${id}`);
    } catch (err) {
      console.error(`ChartSyncManager: Ошибка при добавлении слушателей к графику ${id}:`, err);
    }
  }

  /**
   * Синхронизирует масштабирование с другими графиками
   * @param {string} sourceId - ID графика, инициировавшего масштабирование
   * @param {object} range - Диапазон {min, max} осей
   */
  syncZoom(sourceId, range) {
    if (!this.syncEnabled) {
      console.log('ChartSyncManager: Синхронизация отключена, пропускаем syncZoom');
      return;
    }
    
    // Проверяем валидность диапазона
    if (!range || range.min === undefined || range.max === undefined) {
      console.warn('ChartSyncManager: Невалидный диапазон для синхронизации зума', range);
      return;
    }
    
    // Защита от повторного входа в функцию
    if (this.syncInProgress) {
      console.log('ChartSyncManager: Синхронизация уже выполняется, пропускаем новый вызов syncZoom');
      return;
    }
    
    try {
      // Устанавливаем флаг, что синхронизация выполняется
      this.syncInProgress = true;
      
      // Подавляем новые события во время синхронизации
      this.suppressEvents = true;
      
      console.log(`ChartSyncManager: Синхронизация зума от графика ${sourceId}, диапазон:`, range);
      
      // Сохраняем последний диапазон масштабирования
      this.lastZoomRange = range;
      
      // Счетчик для отслеживания количества обновленных графиков
      let updatedCount = 0;
      
      // Получаем копию всех графиков для безопасной итерации
      const chartEntries = Array.from(this.charts.entries());
      
      // Применяем новый масштаб ко всем графикам, кроме источника
      for (const [chartId, chartInstance] of chartEntries) {
        // Пропускаем график-источник
        if (chartId === sourceId) {
          console.log(`ChartSyncManager: Пропускаем график-источник ${chartId}`);
          continue;
        }
        
        // Пропускаем некорректные графики
        if (!chartInstance || chartInstance.isDestroyed) {
          console.warn(`ChartSyncManager: График ${chartId} невалиден или уничтожен, пропускаем`);
          continue;
        }
        
        console.log(`ChartSyncManager: Применяем зум к графику ${chartId}`);
        
        try {
          // Применяем масштаб безопасно через общий метод
          this.applyZoomToChart(chartInstance, chartId, range);
          updatedCount++;
      } catch (error) {
          console.error(`ChartSyncManager: Ошибка при синхронизации зума графика ${chartId}:`, error);
        }
      }
      
      console.log(`ChartSyncManager: Синхронизация зума завершена, обновлено графиков: ${updatedCount}`);
    } catch (error) {
      console.error('ChartSyncManager: Ошибка при синхронизации зума:', error);
    } finally {
      // Важно: снимаем флаги после завершения синхронизации
      setTimeout(() => {
        // Используем timeout для гарантии, что все асинхронные операции завершатся
    this.suppressEvents = false;
        this.syncInProgress = false;
        console.log('ChartSyncManager: Снят флаг блокировки событий syncZoom');
      }, 200);
    }
  }

  /**
   * Синхронизирует панорамирование между графиками
   * @param {string} sourceId - ID графика-источника
   * @param {object} range - Диапазон панорамирования {min, max}
   */
  syncPan(sourceId, range) {
    if (!this.syncEnabled) {
      console.log('ChartSyncManager: Синхронизация отключена, пропускаем syncPan');
      return;
    }
    
    // Проверяем валидность диапазона
    if (!range || range.min === undefined || range.max === undefined) {
      console.warn('ChartSyncManager: Невалидный диапазон для синхронизации панорамирования', range);
      return;
    }
    
    // Защита от повторного входа в функцию
    if (this.panInProgress) {
      console.log('ChartSyncManager: Синхронизация панорамирования уже выполняется, пропускаем новый вызов syncPan');
      return;
    }
    
    try {
      // Устанавливаем флаг, что синхронизация выполняется
      this.panInProgress = true;
      
      // Подавляем новые события во время синхронизации
      this.suppressEvents = true;
      
      console.log(`ChartSyncManager: Синхронизация панорамирования от графика ${sourceId}, диапазон:`, range);
      
      // Сохраняем последний диапазон панорамирования
      this.lastPanRange = range;
      
      // Счетчик для отслеживания количества обновленных графиков
      let updatedCount = 0;
      
      // Получаем копию всех графиков для безопасной итерации
      const chartEntries = Array.from(this.charts.entries());
      
      // Применяем новый диапазон ко всем графикам, кроме источника
      for (const [chartId, chartInstance] of chartEntries) {
        // Пропускаем график-источник
        if (chartId === sourceId) {
          console.log(`ChartSyncManager: Пропускаем график-источник ${chartId}`);
          continue;
        }
        
        // Пропускаем некорректные графики
        if (!chartInstance || chartInstance.isDestroyed) {
          console.warn(`ChartSyncManager: График ${chartId} невалиден или уничтожен, пропускаем`);
          continue;
        }
        
        console.log(`ChartSyncManager: Применяем панорамирование к графику ${chartId}`);
        
        try {
          // Применяем масштаб безопасно через общий метод
          this.applyZoomToChart(chartInstance, chartId, range);
          updatedCount++;
      } catch (error) {
          console.error(`ChartSyncManager: Ошибка при синхронизации панорамирования графика ${chartId}:`, error);
        }
      }
      
      console.log(`ChartSyncManager: Синхронизация панорамирования завершена, обновлено графиков: ${updatedCount}`);
    } catch (error) {
      console.error('ChartSyncManager: Ошибка при синхронизации панорамирования:', error);
    } finally {
      // Важно: снимаем флаги после завершения синхронизации
      setTimeout(() => {
        // Используем timeout для гарантии, что все асинхронные операции завершатся
    this.suppressEvents = false;
        this.panInProgress = false;
        console.log('ChartSyncManager: Снят флаг блокировки событий syncPan');
      }, 200);
    }
  }

  /**
   * Вспомогательная функция для применения зума к графику
   * @param {object} chart - Экземпляр графика
   * @param {string} chartId - ID графика для логирования
   * @param {object} range - Диапазон {min, max} для применения
   */
  applyZoomToChart(chart, chartId, range) {
    if (!chart) {
      console.warn(`ChartSyncManager: График ${chartId} не существует`);
      return;
    }
    
    // Проверка валидности графика
    if (!chart.options || !chart.config || !chart.update || typeof chart.update !== 'function') {
      console.warn(`ChartSyncManager: График ${chartId} не имеет необходимых методов для обновления`);
      return;
    }
    
    try {
      // Проверка состояния графика перед обновлением
      if (chart._active === undefined || chart.isDestroyed) {
        console.warn(`ChartSyncManager: График ${chartId} уничтожен или в некорректном состоянии`);
        return;
      }
      
      // Проверка на наличие шкалы X
      if (!chart.scales || !chart.scales.x) {
        console.warn(`ChartSyncManager: У графика ${chartId} отсутствует шкала X`);
        return;
      }
      
      const scale = chart.scales.x;
      
      // Установка через options
      if (scale.options) {
        scale.options.min = range.min;
        scale.options.max = range.max;
      } else {
        // Прямая установка свойств
        scale.min = range.min;
        scale.max = range.max;
      }
      
      // Сохраняем и отключаем анимацию для безопасного обновления
      const originalAnimation = chart.options.animation;
      chart.options.animation = false;
      
      // Безопасное обновление графика
      try {
        // Дополнительная проверка перед обновлением
        if (!chart.isDestroyed && chart.ctx && chart.ctx.canvas && 
            chart.update && typeof chart.update === 'function') {
          // Проверяем, что внутренние объекты, необходимые для fullSize, существуют
          if (!chart.chartArea) {
            chart.chartArea = {}; // Создаем объект если он не существует
          }
          
          // Обновляем график без анимации для быстродействия и безопасности
          chart.update('none'); 
          console.log(`ChartSyncManager: Масштаб применен к графику ${chartId}`);
        } else {
          console.warn(`ChartSyncManager: График ${chartId} не может быть обновлен, т.к. находится в некорректном состоянии`);
          // Если график в некорректном состоянии, удаляем его из коллекции
          if (this.charts.has(chartId)) {
            this.charts.delete(chartId);
            console.log(`ChartSyncManager: График ${chartId} удален из коллекции из-за некорректного состояния`);
          }
        }
      } catch (updateError) {
        console.error(`ChartSyncManager: Ошибка при обновлении графика ${chartId}:`, updateError);
        
        // Если обычное обновление не сработало, пробуем отложенное обновление
        setTimeout(() => {
          try {
            if (chart && chart.update && !chart.isDestroyed && chart.ctx && chart.ctx.canvas) {
              // Проверяем, что chartArea существует
              if (!chart.chartArea) {
                chart.chartArea = {};
              }
              
              chart.update('none');
              console.log(`ChartSyncManager: Масштаб применен к графику ${chartId} с отложенным обновлением`);
            } else {
              console.warn(`ChartSyncManager: Невозможно применить отложенное обновление к графику ${chartId}`);
              // Удаляем из коллекции, если график нерабочий
              if (this.charts.has(chartId)) {
                this.charts.delete(chartId);
                console.log(`ChartSyncManager: График ${chartId} удален из коллекции из-за невозможности обновления`);
              }
            }
          } catch (delayedError) {
            console.error(`ChartSyncManager: Не удалось обновить график ${chartId} даже с задержкой:`, delayedError);
            // Удаляем проблемный график из коллекции
            if (this.charts.has(chartId)) {
              this.charts.delete(chartId);
              console.log(`ChartSyncManager: График ${chartId} удален из коллекции после ошибки обновления`);
            }
          }
        }, 0);
      }
      
      // Восстанавливаем настройки анимации
      setTimeout(() => {
        if (chart && chart.options && !chart.isDestroyed) {
          chart.options.animation = originalAnimation;
        }
      }, 100);
    } catch (error) {
      console.error(`ChartSyncManager: Ошибка при применении масштаба к графику ${chartId}:`, error);
      // Удаляем проблемный график из коллекции при общей ошибке
      if (this.charts.has(chartId)) {
        this.charts.delete(chartId);
        console.log(`ChartSyncManager: График ${chartId} удален из коллекции после общей ошибки`);
      }
    }
  }

  /**
   * Синхронизирует сброс масштабирования на всех графиках
   * @param {string} sourceId - ID графика, инициировавшего сброс
   */
  syncReset(sourceId) {
    this.suppressEvents = true;
    console.log(`ChartSyncManager: Сбрасываем зум для всех графиков от источника ${sourceId}`);

    this.charts.forEach((chart, id) => {
      // Пропускаем исходный график
      if (id === sourceId) return;

      // Сбрасываем масштаб
      try {
        chart.resetZoom();
        console.log(`ChartSyncManager: Зум сброшен для графика ${id}`);
      } catch (error) {
        console.error(`ChartSyncManager: Ошибка при сбросе зума для графика ${id}`, error);
      }
    });

    this.suppressEvents = false;
    this.lastZoomRange = null;
    this.lastPanRange = null;
  }

  /**
   * Включает/выключает синхронизацию масштабирования
   * @param {boolean} enabled - Флаг включения/выключения
   */
  toggleSync(enabled) {
    this.syncEnabled = enabled === undefined ? !this.syncEnabled : enabled;
    console.log(`ChartSyncManager: Синхронизация ${this.syncEnabled ? 'включена' : 'выключена'}`);
    
    // Оповещаем все графики об изменении состояния синхронизации
    document.dispatchEvent(new CustomEvent('syncStateChanged', {
      detail: {
        syncEnabled: this.syncEnabled,
        timestamp: Date.now()
      }
    }));
    
    return this.syncEnabled;
  }

  /**
   * Применяет текущий масштаб к новому графику
   * @param {string} chartId - ID графика, к которому нужно применить масштаб
   */
  applyCurrentZoomToChart(chartId) {
    if (!this.charts.has(chartId) || !this.lastZoomRange) {
      if (!this.lastZoomRange) {
        console.log(`ChartSyncManager: Нет сохраненного диапазона масштабирования для применения к графику ${chartId}`);
      }
      return;
    }

    const chart = this.charts.get(chartId);
    if (!chart) {
      console.warn(`ChartSyncManager: График ${chartId} не найден для применения масштаба`);
      return;
    }
    
    console.log(`ChartSyncManager: Применяем сохраненный масштаб к графику ${chartId}:`, this.lastZoomRange);
    
    // Используем универсальный метод для безопасного применения масштаба
    this.applyZoomToChart(chart, chartId, this.lastZoomRange);
  }
  
  /**
   * Освобождает ресурсы менеджера синхронизации
   */
  destroy() {
    // Удаляем все обработчики событий
    document.removeEventListener('splitContainerComplete', this.handleSplitComplete);
    document.removeEventListener('chartInitialized', this.handleChartInitialized);
    
    // Удаляем обработчики клавиатурных сокращений
    this.removeKeyboardShortcuts();
    
    // Останавливаем интервал сканирования
    clearInterval(this.scanInterval);
    
    // Очищаем коллекцию графиков
    this.charts.clear();
    
    console.log('ChartSyncManager: Ресурсы освобождены');
  }

  /**
   * Принудительно синхронизирует все графики на основе указанного или первого графика
   * @param {string} sourceId - ID графика для использования как источник (если не указан, берется первый)
   */
  forceSyncAllCharts(sourceId) {
    console.log(`ChartSyncManager: Принудительная синхронизация всех графиков...`);
    
    // Если графиков нет, ничего не делаем
    if (this.charts.size === 0) {
      console.warn('ChartSyncManager: Нет зарегистрированных графиков для синхронизации');
      return;
    }
    
    // Если sourceId не указан, берем первый график
    let sourceChart;
    let actualSourceId = sourceId;
    
    if (!actualSourceId || !this.charts.has(actualSourceId)) {
      actualSourceId = Array.from(this.charts.keys())[0];
      console.log(`ChartSyncManager: Источник не указан или не найден, используем первый график: ${actualSourceId}`);
    }
    
    sourceChart = this.charts.get(actualSourceId);
    
    if (!sourceChart || !sourceChart.scales || !sourceChart.scales.x) {
      console.warn(`ChartSyncManager: График-источник ${actualSourceId} не имеет шкалы X`);
      
      // Ищем любой график с действительной шкалой X
      for (const [id, chart] of this.charts.entries()) {
        if (chart.scales && chart.scales.x) {
          actualSourceId = id;
          sourceChart = chart;
          console.log(`ChartSyncManager: Найден альтернативный источник с шкалой X: ${actualSourceId}`);
          break;
        }
      }
      
      // Если не нашли ни одного подходящего графика, выходим
      if (!sourceChart || !sourceChart.scales || !sourceChart.scales.x) {
        console.error('ChartSyncManager: Не найдено ни одного графика с действительной шкалой X');
        return;
      }
    }
    
    // Получаем диапазон исходного графика
    const range = {
      min: sourceChart.scales.x.min,
      max: sourceChart.scales.x.max
    };
    
    // Убедимся, что диапазон имеет смысл
    if (range.min >= range.max) {
      console.warn(`ChartSyncManager: Некорректный диапазон в графике-источнике ${actualSourceId}:`, range);
      return;
    }
    
    console.log(`ChartSyncManager: Принудительная синхронизация с диапазоном:`, range);
    
    // Сохраняем диапазон и применяем ко всем графикам
    this.lastZoomRange = range;
    this.lastSelectionRange = range; // Также сохраняем как выделение
    this.syncZoom(actualSourceId, range);
    
    // Отправляем уведомление о синхронизации
    document.dispatchEvent(new CustomEvent('chartsSynchronized', {
      detail: {
        sourceId: actualSourceId,
        range: range,
        timestamp: Date.now()
      }
    }));
    
    return range;
  }

  /**
   * Улучшенная синхронизация выделения между разделенными отчетами
   * @param {string} sourceId - ID графика-источника выделения
   * @param {object} range - Диапазон выделения {min, max}
   */
  syncSelection(sourceId, range) {
    if (!this.syncEnabled || this.suppressEvents) {
      console.log('ChartSyncManager: Синхронизация отключена или подавлена, пропускаем распространение выделения');
      return;
    }

    console.log(`ChartSyncManager: Синхронизируем выделение от контейнера ${sourceId}`, range);
    
    // Улучшенная логика синхронизации: сначала собираем все контейнеры для синхронизации
    const containerIdsToSync = [];
    const sourceContainer = document.getElementById(sourceId);
    let syncGroupId = null;
    
    // Если есть исходный контейнер, определяем его группу синхронизации
    if (sourceContainer) {
      syncGroupId = sourceContainer.getAttribute('data-sync-group');
      console.log(`ChartSyncManager: Исходный контейнер ${sourceId} в группе синхронизации: ${syncGroupId || 'нет'}`);
    }
    
    // Перебираем все зарегистрированные графики
    Object.keys(this.charts).forEach(containerId => {
      // Пропускаем исходный контейнер
      if (containerId === sourceId) return;
      
      // Если задана группа синхронизации, то синхронизируем только в рамках одной группы
      if (syncGroupId) {
        const container = document.getElementById(containerId);
        if (container) {
          const containerSyncGroup = container.getAttribute('data-sync-group');
          if (containerSyncGroup && containerSyncGroup === syncGroupId) {
            containerIdsToSync.push(containerId);
          }
        } else {
          // Если контейнер не найден, проверяем по атрибуту
          const containersByAttr = document.querySelectorAll(`[data-container-id="${containerId}"][data-sync-group="${syncGroupId}"]`);
          if (containersByAttr.length > 0) {
            containerIdsToSync.push(containerId);
          }
        }
      } else {
        // Если группа не задана, синхронизируем все графики
        containerIdsToSync.push(containerId);
      }
    });
    
    console.log(`ChartSyncManager: Найдено ${containerIdsToSync.length} графиков для синхронизации выделения`);
    
    // Теперь применяем выделение ко всем собранным контейнерам
    containerIdsToSync.forEach(containerId => {
      try {
        this.applySyncSelection(containerId, range);
        
        // Дополнительно отправляем глобальное событие для большей надежности
        this.dispatchSelectionEvent(containerId, range);
      } catch (error) {
        console.error(`ChartSyncManager: Ошибка при синхронизации выделения для контейнера ${containerId}:`, error);
      }
    });
    
    // Сохраняем последний диапазон выделения
    this.lastSelectionRange = range;
    
    // Отправляем глобальное событие синхронизации выделения
    this.dispatchGlobalSelectionEvent(sourceId, range, syncGroupId);
  }

  // Новый метод для отправки события выделения для конкретного контейнера
  dispatchSelectionEvent(containerId, range) {
    try {
      const container = document.getElementById(containerId) || 
                        document.querySelector(`[data-container-id="${containerId}"]`);
      
      if (!container) {
        console.warn(`ChartSyncManager: Контейнер ${containerId} не найден для отправки события выделения`);
          return;
        }
        
      // Создаем событие выделения
      const selectionData = {
        startDate: range.min instanceof Date ? range.min : new Date(range.min),
        endDate: range.max instanceof Date ? range.max : new Date(range.max),
        startIndex: typeof range.min === 'number' ? range.min : undefined,
        endIndex: typeof range.max === 'number' ? range.max : undefined
      };
      
      // Отправляем событие в контейнер
      const event = new CustomEvent('applySelectionToContainer', {
          detail: {
          containerId,
          selectionData,
            timestamp: Date.now()
          }
      });
      
      document.dispatchEvent(event);
      console.log(`ChartSyncManager: Отправлено событие выделения для контейнера ${containerId}`);
      } catch (error) {
      console.error(`ChartSyncManager: Ошибка при отправке события выделения для контейнера ${containerId}:`, error);
    }
  }

  // Новый метод для отправки глобального события синхронизации выделения
  dispatchGlobalSelectionEvent(sourceContainerId, range, syncGroupId) {
    try {
      // Создаем данные выделения
      const selectionData = {
        startDate: range.min instanceof Date ? range.min : new Date(range.min),
        endDate: range.max instanceof Date ? range.max : new Date(range.max),
        startIndex: typeof range.min === 'number' ? range.min : undefined,
        endIndex: typeof range.max === 'number' ? range.max : undefined
      };
      
      // Отправляем глобальное событие синхронизации
      const event = new CustomEvent('globalSelectionSync', {
        detail: {
          sourceContainerId,
          syncGroupId,
          selectionData,
          timestamp: Date.now()
        }
      });
      
      document.dispatchEvent(event);
      console.log(`ChartSyncManager: Отправлено глобальное событие синхронизации выделения от контейнера ${sourceContainerId}`);
    } catch (error) {
      console.error(`ChartSyncManager: Ошибка при отправке глобального события синхронизации выделения:`, error);
    }
  }

  /**
   * Переключает режим синхронизации выделений между графиками
   * @param {boolean} enabled - Флаг включения/выключения
   */
  toggleSelectionSync(enabled) {
    this.syncSelectionEnabled = enabled === undefined ? !this.syncSelectionEnabled : enabled;
    console.log(`ChartSyncManager: Синхронизация выделений ${this.syncSelectionEnabled ? 'включена' : 'выключена'}`);
    
    // Оповещаем все графики об изменении состояния синхронизации выделений
    document.dispatchEvent(new CustomEvent('selectionSyncStateChanged', {
      detail: {
        syncSelectionEnabled: this.syncSelectionEnabled,
        timestamp: Date.now()
      }
    }));
    
    return this.syncSelectionEnabled;
  }

  /**
   * Применяет сохраненное выделение к указанному графику
   * @param {string} chartId - ID графика для применения выделения
   */
  applyCurrentSelectionToChart(chartId) {
    if (!this.charts.has(chartId) || !this.lastSelectionRange || !this.syncSelectionEnabled) return;
    
    const chart = this.charts.get(chartId);
    if (!chart || !chart.scales || !chart.scales.x) {
      console.warn(`ChartSyncManager: График ${chartId} не имеет шкал для применения выделения`);
      return;
    }
    
    try {
      console.log(`ChartSyncManager: Применяем сохраненное выделение к графику ${chartId}`);
      this.applyZoomToChart(chart, chartId, this.lastSelectionRange);
    } catch (error) {
      console.error(`ChartSyncManager: Ошибка при применении выделения к графику ${chartId}:`, error);
    }
  }

  /**
   * Принудительно синхронизирует выделение для всех графиков
   */
  forceSyncSelection() {
    if (!this.syncSelectionEnabled || !this.lastSelectionRange) {
      console.warn('ChartSyncManager: Нет сохраненного выделения или синхронизация выделений отключена');
      return false;
    }
    
    console.log('ChartSyncManager: Принудительная синхронизация выделения для всех графиков');
    
    this.charts.forEach((chart, id) => {
      this.applyCurrentSelectionToChart(id);
    });
    
    return true;
  }

  /**
   * Сохраняет текущее выделение из указанного графика
   * @param {string} chartId - ID графика-источника
   */
  saveSelectionFromChart(chartId) {
    if (!this.charts.has(chartId)) {
      console.warn(`ChartSyncManager: График ${chartId} не найден для сохранения выделения`);
      return false;
    }
    
    const chart = this.charts.get(chartId);
    if (!chart || !chart.scales || !chart.scales.x) {
      console.warn(`ChartSyncManager: График ${chartId} не имеет шкалы X для сохранения выделения`);
      return false;
    }
    
    const range = {
      min: chart.scales.x.min,
      max: chart.scales.x.max
    };
    
    if (range.min >= range.max) {
      console.warn(`ChartSyncManager: Некорректный диапазон для сохранения из графика ${chartId}:`, range);
      return false;
    }
    
    this.lastSelectionRange = range;
    console.log(`ChartSyncManager: Сохранено выделение из графика ${chartId}:`, range);
    
    return true;
  }

  /**
   * Применяет сохраненное выделение ко всем графикам в разделенных отчетах
   */
  applySavedSelectionToAll() {
    if (!this.lastSelectionRange) {
      console.warn('ChartSyncManager: Нет сохраненного выделения для применения');
      return false;
    }
    
    console.log('ChartSyncManager: Применяем сохраненное выделение ко всем графикам:', this.lastSelectionRange);
    
    this.suppressEvents = true;
    
    this.charts.forEach((chart, id) => {
      this.applyZoomToChart(chart, id, this.lastSelectionRange);
    });
    
    this.suppressEvents = false;
    
    // Отправляем событие о массовом применении выделения
    document.dispatchEvent(new CustomEvent('savedSelectionApplied', {
      detail: {
        range: this.lastSelectionRange,
        timestamp: Date.now()
      }
    }));
    
    return true;
  }

  /**
   * Обработчик события инициализации разделенного контейнера
   * @param {Event} event - Событие с данными контейнера
   */
  handleSplitContainerInitialized(event) {
    const { id, syncGroupId, element } = event.detail;
    if (id && element) {
      console.log(`ChartSyncManager: Инициализирован разделенный контейнер ${id}, группа синхронизации: ${syncGroupId || 'не указана'}`);
      
      // Если указана группа синхронизации, добавляем контейнер в группу
      if (syncGroupId) {
        // Получаем или создаем группу
        let group = this.syncGroups.get(syncGroupId);
        if (!group) {
          group = new Set();
          this.syncGroups.set(syncGroupId, group);
        }
        
        // Добавляем ID контейнера в группу
        group.add(id);
        console.log(`ChartSyncManager: Контейнер ${id} добавлен в группу синхронизации ${syncGroupId}`);
        
        // Если есть сохраненное выделение для этой группы, применяем его
        const lastSelection = this.getLastSelectionForGroup(syncGroupId);
        if (lastSelection && this.syncSelectionEnabled) {
          console.log(`ChartSyncManager: Применяем сохраненное выделение к новому контейнеру ${id}`);
          
          // Находим график в контейнере и применяем выделение
          const chart = this.findChartByContainerId(id);
          if (chart) {
            this.applySelectionToChart(chart, id, lastSelection);
          } else {
            console.log(`ChartSyncManager: График в контейнере ${id} пока не найден, выделение будет применено позже`);
            // Сохраняем выделение для отложенного применения
            this.lastSelectionRange = lastSelection;
          }
        }
      }
    }
  }

  /**
   * Обработчик события выделения от компонента SplitScreenContainer
   * @param {Event} event - Событие с данными о выделении
   */
  handleSplitContainerSelection(event) {
    const { sourceContainerId, selectionData, syncGroupId } = event.detail;
    
    if (!this.syncSelectionEnabled) {
      console.log(`ChartSyncManager: Синхронизация выделений отключена, пропускаем событие от ${sourceContainerId}`);
      return;
    }
    
    console.log(`ChartSyncManager: Получено событие выделения от контейнера ${sourceContainerId}, группа: ${syncGroupId}`, selectionData);
    
    // Сохраняем выделение для группы синхронизации
    this.saveSelectionForGroup(syncGroupId, selectionData);
    
    // Если нет syncGroupId, обрабатываем как обычное выделение
    if (!syncGroupId) {
      console.log(`ChartSyncManager: Не указана группа синхронизации, используем стандартную синхронизацию`);
      this.lastSelectionRange = selectionData;
      // Также нужно установить lastZoomRange для совместимости
      if (selectionData.startDate && selectionData.endDate) {
        this.lastZoomRange = {
          min: new Date(selectionData.startDate).getTime(),
          max: new Date(selectionData.endDate).getTime()
        };
      }
      this.syncSelection(sourceContainerId, selectionData);
      return;
    }
    
    // Получаем группу синхронизации
    const group = this.syncGroups.get(syncGroupId);
    if (!group) {
      console.log(`ChartSyncManager: Группа синхронизации ${syncGroupId} не найдена, создаем новую`);
      
      // Создаем новую группу и добавляем исходный контейнер
      const newGroup = new Set([sourceContainerId]);
      this.syncGroups.set(syncGroupId, newGroup);
      
      // Ищем все контейнеры с этой группой синхронизации
      document.querySelectorAll(`[data-sync-group="${syncGroupId}"]`).forEach(el => {
        const id = el.id || el.getAttribute('data-container-id');
        if (id && id !== sourceContainerId) {
          console.log(`ChartSyncManager: Добавляем контейнер ${id} в группу ${syncGroupId}`);
          newGroup.add(id);
        }
      });
      
      // Если группа осталась пустой (только исходный контейнер), используем стандартную синхронизацию
      if (newGroup.size <= 1) {
        console.log(`ChartSyncManager: В группе ${syncGroupId} только один контейнер, используем стандартную синхронизацию`);
        this.syncSelection(sourceContainerId, selectionData);
        return;
      }
    }
    
    // Получаем обновленную группу
    const updatedGroup = this.syncGroups.get(syncGroupId);
    
    // Устанавливаем флаг подавления циклических вызовов
    this.suppressEvents = true;
    
    try {
      console.log(`ChartSyncManager: Применяем выделение ко всем контейнерам в группе ${syncGroupId} (${updatedGroup.size} контейнеров)`);
      
      // Применяем выделение ко всем графикам в группе
      updatedGroup.forEach(containerId => {
        if (containerId !== sourceContainerId) {
          console.log(`ChartSyncManager: Синхронизируем выделение с контейнером ${containerId}`);
          
          // Находим график в контейнере и применяем выделение
          const chart = this.findChartByContainerId(containerId);
          if (chart) {
            console.log(`ChartSyncManager: Найден график для контейнера ${containerId}, применяем выделение`);
            this.applySelectionToChart(chart, containerId, selectionData);
          } else {
            console.log(`ChartSyncManager: График для контейнера ${containerId} не найден, отправляем событие напрямую контейнеру`);
          }
          
          // Также отправляем событие для обновления контейнера напрямую
          this.notifySplitContainer(containerId, selectionData);
        }
      });
      
      // Также проверяем стандартную синхронизацию для всех других графиков
      if (this.charts.size > updatedGroup.size) {
        console.log(`ChartSyncManager: Проверяем необходимость синхронизации с другими графиками (всего ${this.charts.size}, в группе ${updatedGroup.size})`);
        
        // Синхронизируем с графиками, не входящими в текущую группу
        this.charts.forEach((chart, chartId) => {
          if (!updatedGroup.has(chartId)) {
            // Проверяем, есть ли у графика уже указанная группа синхронизации
            const container = document.getElementById(chartId) || 
                             document.querySelector(`[data-container-id="${chartId}"]`);
            
            const containerSyncGroup = container ? container.getAttribute('data-sync-group') : null;
            if (!containerSyncGroup || containerSyncGroup === syncGroupId) {
              console.log(`ChartSyncManager: Синхронизируем с графиком ${chartId} (вне группы ${syncGroupId})`);
              this.applySelectionToChart(chart, chartId, selectionData);
            }
          }
        });
      }
    } finally {
      // Сбрасываем флаг подавления циклических вызовов
      this.suppressEvents = false;
    }
    
    // Отправляем событие о завершении синхронизации выделения
    document.dispatchEvent(new CustomEvent('selectionSynchronized', {
      detail: {
        sourceId: sourceContainerId,
        syncGroupId,
        selectionData,
        timestamp: Date.now()
      }
    }));
  }

  /**
   * Находит график по ID контейнера с помощью DOM
   * @param {string} containerId - ID контейнера с графиком
   * @returns {object|null} - Экземпляр графика Chart.js или null
   */
  findChartByContainerId(containerId) {
    if (!containerId) return null;
    
    // Если график уже зарегистрирован, просто возвращаем его
    if (this.charts.has(containerId)) {
      return this.charts.get(containerId);
    }
    
    console.log(`ChartSyncManager: Поиск графика для контейнера ${containerId}`);
    
    // Ищем контейнер в DOM
    const container = document.getElementById(containerId) || 
                     document.querySelector(`[data-container-id="${containerId}"]`);
                     
    if (!container) {
      console.log(`ChartSyncManager: Контейнер ${containerId} не найден в DOM`);
      return null;
    }
    
    // Ищем все canvas-элементы внутри контейнера
    const canvases = container.querySelectorAll('canvas');
    console.log(`ChartSyncManager: В контейнере ${containerId} найдено ${canvases.length} canvas-элементов`);
    
    if (canvases.length === 0) {
      // Проверяем, не является ли сам контейнер canvas-элементом
      if (container.tagName === 'CANVAS') {
        const chartInstance = this.extractChartInstanceFromCanvas(container);
        if (chartInstance) {
          this.registerChart(containerId, chartInstance);
          return chartInstance;
        }
      }
      return null;
    }
    
    // Перебираем все найденные canvas-элементы
    for (const canvas of canvases) {
      // Получаем экземпляр графика
      const chartInstance = this.extractChartInstanceFromCanvas(canvas);
      
      if (chartInstance) {
        console.log(`ChartSyncManager: Найден экземпляр графика для контейнера ${containerId}`);
        
        // Устанавливаем все возможные ссылки на экземпляр графика для большей совместимости
        canvas.__chartjs__ = chartInstance;
        canvas.__chartInstance = chartInstance;
        canvas.setAttribute('data-registered', 'true');
        
        // Регистрируем график в менеджере для дальнейшего использования
        this.registerChart(containerId, chartInstance);
        
        return chartInstance;
      }
    }
    
    console.log(`ChartSyncManager: Не найден экземпляр графика в canvas-элементах контейнера ${containerId}`);
    return null;
  }

  /**
   * Отправляет уведомление о выделении контейнеру напрямую
   * @param {string} containerId - ID контейнера
   * @param {object} selectionData - Данные о выделении
   */
  notifySplitContainer(containerId, selectionData) {
    // Избегаем циклических вызовов
    if (this.suppressEvents) return;
    
    console.log(`ChartSyncManager: Отправка уведомления в контейнер ${containerId}`, selectionData);
    
    const container = document.getElementById(containerId) || 
                     document.querySelector(`[data-container-id="${containerId}"]`);
    
    if (!container) {
      console.log(`ChartSyncManager: Контейнер ${containerId} не найден в DOM, пробуем найти в группе синхронизации`);
      
      // Если контейнер не найден напрямую, пробуем найти его в группе синхронизации
      // через родительский атрибут data-split-parent
      const relatedContainers = document.querySelectorAll(`[data-split-parent="${containerId.split('-')[0]}"]`);
      if (relatedContainers.length > 0) {
        console.log(`ChartSyncManager: Найдены связанные контейнеры (${relatedContainers.length}) через data-split-parent`);
        relatedContainers.forEach(relatedContainer => {
          if (relatedContainer.id !== containerId) {
            console.log(`ChartSyncManager: Отправка уведомления в связанный контейнер ${relatedContainer.id}`);
            this.applySplitContainerSelection(relatedContainer, selectionData);
          }
        });
      }
      return;
    }
    
    this.applySplitContainerSelection(container, selectionData);
  }
  
  /**
   * Отправляет уведомление о выбранной точке всем компонентам
   * @param {object} pointData - Данные о выбранной точке
   * @param {string} sourceId - ID источника события (компонента, который выбрал точку)
   * @param {string} syncGroupId - ID группы синхронизации (опционально)
   */
  notifyPointSelected(pointData, sourceId = null, syncGroupId = '*') {
    // Избегаем циклических вызовов
    if (this.suppressEvents) return;
    
    console.log(`ChartSyncManager: Уведомление о выбранной точке от ${sourceId || 'неизвестного источника'}`, pointData);
    
    // Если не указана группа синхронизации, используем '*' (все группы)
    const targetGroupId = syncGroupId || '*';
    
    // Создаем событие для отправки
    const event = new CustomEvent('pointSelected', {
      detail: { 
        ...pointData,
        sourceId,
        syncGroupId: targetGroupId,
        timestamp: Date.now()
      }
    });
    
    // Отправляем глобальное событие
    document.dispatchEvent(event);
    
    // Также отправляем специфическое событие для каждого контейнера группы
    if (this.syncGroups && this.syncGroups.has(targetGroupId)) {
      const containers = this.syncGroups.get(targetGroupId);
      containers.forEach(containerId => {
        if (containerId !== sourceId) {
          const container = document.getElementById(containerId) || 
                           document.querySelector(`[data-container-id="${containerId}"]`);
          
          if (container) {
            console.log(`ChartSyncManager: Отправка уведомления о точке в контейнер ${containerId}`);
            
            // Сначала проверяем наличие API для контейнера через __reactInstance
            if (container.__reactInstance && container.__reactInstance.applyPointSelection) {
              container.__reactInstance.applyPointSelection(pointData);
            } else {
              // Отправляем событие напрямую контейнеру
              container.dispatchEvent(new CustomEvent('applyPointSelection', {
                detail: { 
                  pointData,
                  sourceId,
                  targetContainerId: containerId
                }
              }));
            }
          }
        }
      });
    } else {
      console.log(`ChartSyncManager: Нет зарегистрированных контейнеров для группы ${targetGroupId}`);
    }
  }
  
  /**
   * Применяет выделение к контейнеру
   * @param {HTMLElement} container - DOM-элемент контейнера
   * @param {object} selectionData - Данные о выделении
   */
  applySplitContainerSelection(container, selectionData) {
    // Проверяем наличие API для контейнера через __reactInstance
    if (container.__reactInstance && container.__reactInstance.applySelection) {
      console.log(`ChartSyncManager: Напрямую вызываем applySelection для контейнера ${container.id || container.getAttribute('data-container-id')}`);
      container.__reactInstance.applySelection(selectionData);
      return;
    }
    
    // Альтернативный метод - отправляем событие для контейнера
    const containerId = container.id || container.getAttribute('data-container-id');
    console.log(`ChartSyncManager: Отправляем событие applyGraphSelection для контейнера ${containerId}`);
    
    // Отправляем оба события - и локальное для контейнера, и глобальное
    const event = new CustomEvent('applyGraphSelection', {
      detail: { 
        selectionData,
        targetContainerId: containerId
      }
    });
    
    // Сначала пробуем отправить событие напрямую контейнеру
    container.dispatchEvent(event);
    
    // Ищем canvas с графиком внутри контейнера и применяем выделение напрямую
    const canvas = container.querySelector('canvas');
    if (canvas && (canvas.__chartjs__ || canvas.__chartInstance)) {
      const chart = canvas.__chartjs__ || canvas.__chartInstance;
      if (chart) {
        console.log(`ChartSyncManager: Применяем выделение напрямую к графику в контейнере ${containerId}`);
        this.applySelectionToChart(chart, containerId, selectionData);
      }
    }
    
    // Дополнительно отправляем глобальное событие, специфичное для контейнера
    document.dispatchEvent(new CustomEvent('applySelectionToContainer', {
      detail: {
        containerId,
        selectionData
      }
    }));
  }

  /**
   * Применяет выделение к графику
   * @param {object} chart - Экземпляр графика
   * @param {string} chartId - ID графика
   * @param {object} selectionData - Данные о выделении
   */
  applySelectionToChart(chart, chartId, selectionData) {
    if (!chart || !selectionData) {
      console.log(`ChartSyncManager: Не удалось применить выделение к графику ${chartId} - недостаточно данных`);
      return;
    }
    
    console.log(`ChartSyncManager: Применение выделения к графику ${chartId}`, selectionData);
    
    try {
      // Пытаемся применить выделение через API графика
      if (chart.scales && chart.scales.x) {
        if (selectionData.startDate && selectionData.endDate) {
          const startTime = new Date(selectionData.startDate).getTime();
          const endTime = new Date(selectionData.endDate).getTime();
          
          console.log(`ChartSyncManager: Устанавливаем временные границы ${startTime} - ${endTime} для графика ${chartId}`);
          
          // Настраиваем zoom и применяем
          const zoomOptions = {
            x: {
              min: startTime,
              max: endTime
            }
          };
          
          // Применяем zoom с помощью API Chart.js
          if (chart.zoom && typeof chart.zoom.zoomScale === 'function') {
            console.log(`ChartSyncManager: Применяем zoom.zoomScale для графика ${chartId}`);
            chart.zoom.zoomScale('x', zoomOptions.x);
          } else if (chart.scales.x.options) {
            console.log(`ChartSyncManager: Устанавливаем min/max напрямую для графика ${chartId}`);
            chart.scales.x.options.min = zoomOptions.x.min;
            chart.scales.x.options.max = zoomOptions.x.max;
            
            // Важно: Не используем анимацию для согласованного обновления
            chart.update('none');
          } else {
            console.log(`ChartSyncManager: Не найден подходящий метод для применения выделения к графику ${chartId}`);
          }
          
          // Нужно также сохранить выделение как последнее для синхронизации
          this.lastZoomRange = zoomOptions.x;
          this.lastSelectionRange = selectionData;
          
          console.log(`ChartSyncManager: Выделение успешно применено к графику ${chartId}`);
        } else {
          console.log(`ChartSyncManager: Данные выделения не содержат startDate/endDate для графика ${chartId}`);
        }
      } else {
        console.log(`ChartSyncManager: У графика ${chartId} отсутствует шкала X для применения выделения`);
      }
    } catch (error) {
      console.error(`ChartSyncManager: Ошибка при применении выделения к графику ${chartId}:`, error);
    }
  }

  /**
   * Сохраняет выделение для определенной группы синхронизации
   * @param {string} groupId - ID группы синхронизации
   * @param {object} selectionData - Данные о выделении
   */
  saveSelectionForGroup(groupId, selectionData) {
    if (!groupId) return;
    
    // Создаем объект для хранения выделений по группам, если его еще нет
    if (!this.groupSelections) {
      this.groupSelections = new Map();
    }
    
    // Сохраняем выделение для группы
    this.groupSelections.set(groupId, { ...selectionData, timestamp: Date.now() });
    console.log(`ChartSyncManager: Сохранено выделение для группы ${groupId}`, selectionData);
  }

  /**
   * Получает последнее выделение для определенной группы синхронизации
   * @param {string} groupId - ID группы синхронизации
   * @returns {object|null} - Данные о выделении или null
   */
  getLastSelectionForGroup(groupId) {
    if (!groupId || !this.groupSelections) return null;
    
    return this.groupSelections.get(groupId) || null;
  }

  /**
   * Сбрасывает масштабирование всех графиков
   * @param {string} sourceId - ID графика-источника
   */
  resetAllZoom(sourceId) {
    if (this.syncInProgress) {
      console.log('ChartSyncManager: Синхронизация уже выполняется, пропускаем resetAllZoom');
      return;
    }
    
    try {
      // Устанавливаем флаг, что синхронизация выполняется
      this.syncInProgress = true;
      
      // Подавляем новые события во время сброса
      this.suppressEvents = true;
      
      console.log(`ChartSyncManager: Сброс масштабирования всех графиков, инициатор: ${sourceId}`);
      
      // Сбрасываем сохраненные диапазоны
      this.lastZoomRange = null;
      this.lastPanRange = null;
      this.lastSelectionRange = null;
      
      // Счетчик для отслеживания количества обновленных графиков
      let updatedCount = 0;
      let skippedCount = 0;
      
      // Перед обработкой проверим, какие графики имеют проблемы
      let validCharts = new Map();
      
      // Фильтруем графики, исключая невалидные и уничтоженные
      for (const [chartId, chartInstance] of this.charts.entries()) {
        // Проверяем базовую валидность графика
        if (!chartInstance || 
            chartInstance.isDestroyed || 
            !chartInstance.options || 
            !chartInstance.scales || 
            !chartInstance.scales.x) {
          console.warn(`ChartSyncManager: График ${chartId} невалиден или в некорректном состоянии, пропускаем сброс`);
          skippedCount++;
          continue;
        }
        
        // Проверяем, не был ли график уничтожен
        if (typeof chartInstance._active === 'undefined') {
          console.warn(`ChartSyncManager: График ${chartId} может быть уничтожен, пропускаем сброс`);
          skippedCount++;
          continue;
        }
        
        // График прошел проверку, добавляем в валидные
        validCharts.set(chartId, chartInstance);
      }
      
      console.log(`ChartSyncManager: Найдено ${validCharts.size} валидных графиков для сброса масштабирования`);
      
      // Применяем новый масштаб только к валидным графикам
      for (const [chartId, chartInstance] of validCharts.entries()) {
        // Пропускаем график-источник
        if (chartId === sourceId) {
          console.log(`ChartSyncManager: Пропускаем график-источник ${chartId}`);
          continue;
        }
        
        console.log(`ChartSyncManager: Сбрасываем масштабирование графика ${chartId}`);
        
        try {
          // Безопасно сбрасываем масштабирование
          this.resetZoomSafely(chartInstance, chartId);
          updatedCount++;
        } catch (error) {
          console.error(`ChartSyncManager: Ошибка при сбросе масштабирования графика ${chartId}:`, error);
          skippedCount++;
        }
      }
      
      console.log(`ChartSyncManager: Сброс масштабирования завершен, обновлено графиков: ${updatedCount}, пропущено: ${skippedCount}`);
    } catch (error) {
      console.error('ChartSyncManager: Ошибка при сбросе масштабирования:', error);
    } finally {
      // Важно: снимаем флаги после завершения синхронизации
      setTimeout(() => {
        // Используем timeout для гарантии, что все асинхронные операции завершатся
        this.suppressEvents = false;
        this.syncInProgress = false;
        console.log('ChartSyncManager: Снят флаг блокировки событий resetAllZoom');
      }, 200);
    }
  }
  
  /**
   * Безопасно сбрасывает масштабирование для графика
   * @param {object} chart - Экземпляр графика
   * @param {string} chartId - ID графика для логирования
   */
  resetZoomSafely(chart, chartId) {
    if (!chart) {
      console.warn(`ChartSyncManager: График ${chartId} не существует для сброса масштабирования`);
      return;
    }
    
    // Проверка на возможную ошибку fullSize
    try {
      // Дополнительная проверка на уничтоженный график
      if (!chart.id || chart.isDestroyed || typeof chart._active === 'undefined') {
        console.warn(`ChartSyncManager: График ${chartId} уничтожен или в некорректном состоянии`);
        return;
      }
      
      // Проверка доступности необходимых объектов
      if (!chart.options || !chart.scales || !chart.scales.x) {
        console.warn(`ChartSyncManager: У графика ${chartId} отсутствуют необходимые объекты для сброса масштаба`);
        return;
      }
      
      // Устанавливаем флаг сброса для предотвращения рекурсии
      chart._isResettingZoom = true;
      
      // Сохраняем настройки анимации
      let originalAnimation = null;
      if (chart.options && typeof chart.options.animation !== 'undefined') {
        originalAnimation = chart.options.animation;
      }
      
      // Удаляем напрямую лимиты масштабирования со шкалы X
      if (chart.scales && chart.scales.x && chart.scales.x.options) {
        console.log(`ChartSyncManager: Сбрасываем масштаб напрямую через шкалу X для графика ${chartId}`);
        delete chart.scales.x.options.min;
        delete chart.scales.x.options.max;
      }
      
      // Отключаем анимацию для мгновенного применения изменений
      if (chart.options) {
        chart.options.animation = false;
      }
      
      // Только если у графика есть метод resetZoom и он в рабочем состоянии, вызываем его
      let resetAttempted = false;
      // Исправление: Корректная проверка chart._active
      if (chart.resetZoom && typeof chart.resetZoom === 'function' && chart._active !== undefined) {
        try {
          console.log(`ChartSyncManager: Пробуем сбросить масштаб через resetZoom для графика ${chartId}`);
          // Оборачиваем в try-catch, так как resetZoom может вызвать ошибку
          chart.resetZoom();
          resetAttempted = true;
          console.log(`ChartSyncManager: Масштаб успешно сброшен для графика ${chartId} через resetZoom`);
          
          // Если resetZoom успешно выполнен, пропускаем обновление
          chart._isResettingZoom = false;
          
          // Восстанавливаем настройки анимации
          if (originalAnimation !== null && chart.options) {
            setTimeout(() => {
              try {
                if (chart && chart.options && !chart.isDestroyed) {
                  chart.options.animation = originalAnimation;
                }
              } catch (e) {
                // Игнорируем ошибки при восстановлении анимации
              }
            }, 100);
          }
          
          return;
        } catch (resetError) {
          console.warn(`ChartSyncManager: Не удалось сбросить масштаб через resetZoom для графика ${chartId}:`, resetError);
          // Продолжаем с обновлением вручную
        }
      }
      
      // Если resetZoom не сработал или его нет, обновляем график вручную
      if (!resetAttempted) {
        try {
          if (chart.update && typeof chart.update === 'function') {
            // Используем безопасное обновление без анимации
            // Проверяем, что график еще активен перед вызовом update
            if (!chart.isDestroyed && chart.ctx && chart.ctx.canvas) {
              chart.update('none');
              console.log(`ChartSyncManager: Масштаб успешно сброшен для графика ${chartId} через обновление`);
            } else {
              console.warn(`ChartSyncManager: Контекст графика ${chartId} недоступен, пропускаем обновление`);
              // Удаляем из коллекции поврежденный график
              if (this.charts.has(chartId)) {
                console.warn(`ChartSyncManager: Удаляем поврежденный график ${chartId} из коллекции`);
                this.charts.delete(chartId);
              }
            }
          }
        } catch (updateError) {
          console.error(`ChartSyncManager: Ошибка при обновлении графика ${chartId} после сброса масштаба:`, updateError);
          
          // Убираем из коллекции поврежденный график
          if (this.charts.has(chartId)) {
            console.warn(`ChartSyncManager: Удаляем поврежденный график ${chartId} из коллекции`);
            this.charts.delete(chartId);
          }
        }
      }
      
      // Восстанавливаем настройки анимации
      if (originalAnimation !== null) {
        setTimeout(() => {
          try {
            if (chart && chart.options && !chart.isDestroyed) {
              chart.options.animation = originalAnimation;
              chart._isResettingZoom = false;
            }
          } catch (e) {
            // Игнорируем ошибки при восстановлении анимации
          }
        }, 100);
      }
    } catch (error) {
      console.error(`ChartSyncManager: Общая ошибка при сбросе масштабирования графика ${chartId}:`, error);
      
      // Снимаем флаг сброса в любом случае
      try {
        if (chart) {
          chart._isResettingZoom = false;
        }
      } catch (e) {
        // Игнорируем любые ошибки при сбросе флага
      }
      
      // Удаляем проблемный график из коллекции
      if (this.charts.has(chartId)) {
        console.warn(`ChartSyncManager: Удаляем проблемный график ${chartId} из коллекции после ошибки`);
        this.charts.delete(chartId);
      }
    }
  }

  /**
   * Настраивает обработчики клавиатурных сокращений для графиков
   */
  setupKeyboardShortcuts() {
    // Удаляем предыдущий обработчик, если он был
    this.removeKeyboardShortcuts();
    
    // Функция для сброса масштаба на всех графиках по нажатию пробела
    this.keyboardHandler = (event) => {
      if (event.key === ' ') {
        console.log('ChartSyncManager: Обнаружено нажатие пробела, сбрасываем масштаб на всех графиках');
        this.resetAllZoom();
        event.preventDefault();
      }
    };
    
    // Добавляем обработчик клавиатуры
    document.addEventListener('keydown', this.keyboardHandler);
    console.log('ChartSyncManager: Настроены клавиатурные сокращения');
  }

  // Метод для удаления клавиатурных сокращений
  removeKeyboardShortcuts() {
    if (this.keyboardHandler) {
      document.removeEventListener('keydown', this.keyboardHandler);
      this.keyboardHandler = null;
      console.log('ChartSyncManager: Удалены клавиатурные сокращения');
    }
  }

  // Улучшенный метод синхронизации для обнаружения всех графиков
  syncAllCharts() {
    console.log('ChartSyncManager: Запуск принудительной синхронизации всех графиков');
    
    // Находим все canvas элементы с атрибутом data-graph
    const graphCanvases = document.querySelectorAll('canvas[data-graph]');
    console.log(`ChartSyncManager: Найдено ${graphCanvases.length} canvas с атрибутом data-graph`);
    
    // Организуем графики по группам синхронизации
    const syncGroups = {};
    
    graphCanvases.forEach(canvas => {
      try {
        // Получаем данные о контейнере
        const container = canvas.closest('.split-screen-container, [data-container-id]');
        if (!container) return;
        
        const containerId = container.id || container.getAttribute('data-container-id');
        const syncGroupId = container.getAttribute('data-sync-group') || 'default';
        
        if (!syncGroups[syncGroupId]) {
          syncGroups[syncGroupId] = [];
        }
        
        // Проверяем, есть ли уже такой контейнер в группе
        if (!syncGroups[syncGroupId].includes(containerId) && containerId) {
          syncGroups[syncGroupId].push(containerId);
        }
        
        // Дополнительно проверяем атрибуты canvas для улучшения совместимости
        canvas.setAttribute('data-sync-group', syncGroupId);
        canvas.setAttribute('data-container-id', containerId);
        
        // Проверяем, зарегистрирован ли этот график в менеджере
        if (containerId && !this.charts[containerId]) {
          // Ищем инстанс графика в canvas
          const chartInstance = this.findChartInstanceInCanvas(canvas);
          
          if (chartInstance) {
            console.log(`ChartSyncManager: Автоматически регистрируем график ${containerId} в группе ${syncGroupId}`);
            this.registerChart(containerId, chartInstance);
          }
        }
      } catch (error) {
        console.error('ChartSyncManager: Ошибка при обработке canvas в syncAllCharts:', error);
      }
    });
    
    console.log('ChartSyncManager: Группы синхронизации:', syncGroups);
    
    // Если есть сохраненный диапазон выделения, применяем его ко всем графикам
    if (this.lastSelectionRange) {
      console.log('ChartSyncManager: Применяем последний диапазон выделения ко всем группам');
      
      // Применяем последнее выделение ко всем группам
      Object.keys(syncGroups).forEach(groupId => {
        const containers = syncGroups[groupId];
        if (containers.length > 0) {
          // Выбираем первый контейнер в группе как источник
          const sourceContainerId = containers[0];
          
          // Синхронизируем выделение в рамках группы
          this.syncSelection(sourceContainerId, this.lastSelectionRange);
        }
      });
    }
    
    return syncGroups;
  }

  // Метод для поиска инстанса графика в canvas
  findChartInstanceInCanvas(canvas) {
    if (!canvas) return null;
    
    // Проверяем различные свойства, где может быть инстанс графика
    let chartInstance = null;
    
    // Проверяем __chartjs__ - стандартное свойство Chart.js
    if (canvas.__chartjs__) {
      chartInstance = canvas.__chartjs__;
    } 
    // Проверяем __chartInstance__ - наше кастомное свойство
    else if (canvas.__chartInstance) {
      chartInstance = canvas.__chartInstance;
    }
    // Проверяем Chart или chart свойство
    else if (canvas.Chart) {
      chartInstance = canvas.Chart;
    }
    else if (canvas.chart) {
      chartInstance = canvas.chart;
    }
    
    // Если до сих пор не нашли, пробуем найти через дата-атрибуты
    if (!chartInstance) {
      // Проверяем, может быть график был зарегистрирован через React ref
      const container = canvas.closest('.split-screen-container, [data-container-id]');
      if (container) {
        // Проверяем различные элементы внутри контейнера, которые могут содержать график
        const chartElements = container.querySelectorAll('.chartjs-render-monitor, [data-chart]');
        chartElements.forEach(element => {
          if (element.__chartjs__ || element.__chartInstance) {
            chartInstance = element.__chartjs__ || element.__chartInstance;
          }
        });
      }
    }
    
    return chartInstance;
  }
}

// Создаем экземпляр менеджера синхронизации и экспортируем его
const chartSyncManager = new ChartSyncManager();

// Делаем доступным через глобальный объект для отладки через консоль
if (typeof window !== 'undefined') {
  window.chartSyncManager = chartSyncManager;
  
  // Добавляем вспомогательные функции для синхронизации, доступные в консоли
  window.forceChartSync = () => {
    console.log('Вызов принудительной синхронизации графиков из консоли...');
    return chartSyncManager.forceSyncAllCharts();
  };
  
  window.showSyncStatus = () => {
    console.log('Текущее состояние синхронизации графиков:');
    console.log(`- Синхронизация ${chartSyncManager.syncEnabled ? 'включена' : 'выключена'}`);
    console.log(`- Всего графиков в менеджере: ${chartSyncManager.charts.size}`);
    
    if (chartSyncManager.lastZoomRange) {
      console.log(`- Последний диапазон масштабирования:`, chartSyncManager.lastZoomRange);
    } else {
      console.log(`- Нет сохраненного диапазона масштабирования`);
    }
    
    return {
      syncEnabled: chartSyncManager.syncEnabled,
      chartsCount: chartSyncManager.charts.size,
      registeredCharts: Array.from(chartSyncManager.charts.keys()),
      lastZoomRange: chartSyncManager.lastZoomRange
    };
  };
  
  // Новая функция специально для разделенных отчетов
  window.syncSplitReports = () => {
    console.log('Запуск специальной синхронизации для разделенных отчетов...');
    
    // Повторное сканирование DOM для поиска всех графиков
    chartSyncManager.scanForNewCharts();
    
    // Выводим информацию о найденных графиках
    console.log(`Найдено ${chartSyncManager.charts.size} графиков в разделенном отчете:`);
    chartSyncManager.charts.forEach((chart, id) => {
      console.log(`- График ${id}: ${chart.scales?.x ? 'Имеет шкалу X' : 'Без шкалы X'}`);
    });
    
    // Принудительная синхронизация
    const result = chartSyncManager.forceSyncAllCharts();
    
    console.log('Синхронизация разделенных отчетов завершена:', result);
    return result;
  };

  // Новая функция для включения/выключения синхронизации выделений
  window.toggleSelectionSync = () => {
    const newState = chartSyncManager.toggleSelectionSync();
    console.log(`Синхронизация выделений ${newState ? 'включена' : 'выключена'}`);
    return newState;
  };
  
  // Новая функция для применения сохраненного выделения
  window.applySavedSelection = () => {
    console.log('Применяем сохраненное выделение ко всем графикам...');
    return chartSyncManager.applySavedSelectionToAll();
  };
  
  // Новая функция для сохранения выделения из первого графика
  window.saveCurrentSelection = () => {
    if (chartSyncManager.charts.size === 0) {
      console.warn('Нет графиков для сохранения выделения');
      return false;
    }
    
    const firstChartId = Array.from(chartSyncManager.charts.keys())[0];
    console.log(`Сохраняем выделение из графика ${firstChartId}...`);
    return chartSyncManager.saveSelectionFromChart(firstChartId);
  };
}

export default chartSyncManager; 