/**
 * ChartSyncManager - модуль для синхронизации масштабирования между графиками
 * Позволяет синхронизировать зум и панорамирование во всех графиках
 */

class ChartSyncManager {
  constructor() {
    this.charts = new Map(); // Хранит ссылки на все зарегистрированные графики
    this.syncEnabled = true; // Флаг включения/выключения синхронизации
    this.suppressEvents = false; // Флаг для предотвращения циклических вызовов
    this.lastZoomRange = null; // Последний диапазон масштабирования
    this.lastPanRange = null; // Последний диапазон панорамирования
    this.lastSelectionRange = null; // Последний диапазон выделения
    this.syncSelectionEnabled = true; // Флаг включения/выключения синхронизации выделений
    this._aggressiveMode = false; // Флаг агрессивного режима поиска графиков
    
    // Для отслеживания уже зарегистрированных canvas-элементов
    this.registeredCanvasElements = new WeakMap();
    this.lastScanTime = Date.now();
    this.scanCooldown = 1000; // Минимальный интервал между сканированиями в мс
    
    // Регистрируем глобальный обработчик для отслеживания новых графиков после разделения экрана
    document.addEventListener('splitContainerComplete', this.handleSplitComplete.bind(this));
    document.addEventListener('chartInitialized', this.handleChartInitialized.bind(this));
    
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
    
    // После разделения экрана выполняем несколько попыток сканирования
    // с разными интервалами для гарантированного обнаружения новых графиков
    
    // Первое сканирование - сразу после события с агрессивным поиском
    console.log('ChartSyncManager: Выполняем агрессивное сканирование сразу после разделения экрана');
    this.scanForNewCharts(true);
    
    // Последующие сканирования с возрастающими интервалами
    // Увеличиваем число попыток и добавляем больше интервалов для разделенных отчетов
    const timeouts = [200, 500, 1000, 2000, 3000, 5000];
    
    timeouts.forEach((timeout, index) => {
      setTimeout(() => {
        console.log(`ChartSyncManager: Повторное сканирование через ${timeout}мс после разделения экрана`);
        this.scanForNewCharts(index >= 2); // Агрессивный поиск для последних попыток
        
        // Применяем последний масштаб и выделение ко всем графикам, если они существуют
        this.applyLastRanges();
          
          // На некоторых итерациях принудительно синхронизируем все графики
          if (index === 2 || index === timeouts.length - 1) {
            console.log(`ChartSyncManager: Выполняем принудительную синхронизацию после разделения экрана (попытка ${index+1})`);
            this.forceSyncAllCharts();
          
          // Также применяем выделение, если оно есть
          if (this.syncSelectionEnabled && this.lastSelectionRange) {
            console.log(`ChartSyncManager: Применяем сохраненное выделение к разделенным графикам`);
            this.applySavedSelectionToAll();
          }
        }
      }, timeout);
    });
    
    // Добавляем еще одну отложенную проверку специально для разделенных отчетов
    setTimeout(() => {
      console.log(`ChartSyncManager: Финальная проверка для разделенных отчетов после 6 секунд`);
      this.scanForNewCharts(true); // Агрессивный поиск для финальной проверки
      
      // Проверяем количество найденных графиков
      if (this.charts.size >= 2) {
        console.log(`ChartSyncManager: Обнаружено ${this.charts.size} графиков в разделенном отчете, выполняем финальную синхронизацию`);
        // Сначала синхронизируем масштаб
        this.forceSyncAllCharts();
        
        // Затем применяем выделение, если оно существует
        if (this.syncSelectionEnabled && this.lastSelectionRange) {
          console.log(`ChartSyncManager: Применяем сохраненное выделение к финальной синхронизации`);
          this.applySavedSelectionToAll();
        }
        
        // Отправляем событие о завершении синхронизации разделенных отчетов
        document.dispatchEvent(new CustomEvent('splitReportsSynchronized', {
          detail: {
            chartsCount: this.charts.size,
            timestamp: Date.now()
          }
        }));
      }
    }, 6000);
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
    // Проверяем, не слишком ли часто вызывается сканирование
    const now = Date.now();
    if (!useAggressiveSearch && now - this.lastScanTime < this.scanCooldown) {
        console.log(`ChartSyncManager: Пропуск сканирования (слишком частые вызовы)`);
        return;
    }
    this.lastScanTime = now;

    // Устанавливаем флаг агрессивного режима, чтобы он был доступен в processCanvasElement
    this._aggressiveMode = useAggressiveSearch;
    
    // Получаем все canvas-элементы графиков на странице
    const canvasElements = document.querySelectorAll('canvas');
    console.log(`ChartSyncManager: Сканирование DOM, найдено ${canvasElements.length} canvas-элементов`);
    
    // Если включен агрессивный поиск и нет canvas элементов, смотрим глубже
    if (useAggressiveSearch && canvasElements.length === 0) {
        console.log(`ChartSyncManager: Применяем агрессивный поиск canvas-элементов`);
        
        // Ищем в shadow DOM если он используется
        const shadowRoots = [];
        const findShadowRoots = (element) => {
            if (element.shadowRoot) {
                shadowRoots.push(element.shadowRoot);
            }
            Array.from(element.children).forEach(findShadowRoots);
        };
        
        findShadowRoots(document.body);
        
        for (const root of shadowRoots) {
            const shadowCanvases = root.querySelectorAll('canvas');
            if (shadowCanvases.length > 0) {
                console.log(`ChartSyncManager: Найдено ${shadowCanvases.length} canvas-элементов в shadow DOM`);
                shadowCanvases.forEach(canvas => {
                    this.processCanvasElement(canvas);
                });
            }
        }
        
        // Ищем элементы в iframes
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {
            try {
                const iframeCanvases = iframe.contentDocument?.querySelectorAll('canvas');
                if (iframeCanvases && iframeCanvases.length > 0) {
                    console.log(`ChartSyncManager: Найдено ${iframeCanvases.length} canvas-элементов в iframe`);
                    iframeCanvases.forEach(canvas => {
                        this.processCanvasElement(canvas);
                    });
                }
            } catch (e) {
                console.warn('ChartSyncManager: Не удалось получить доступ к содержимому iframe', e);
            }
        }
        
        // Сбрасываем флаг агрессивного режима
        this._aggressiveMode = false;
        return;
    }
    
    canvasElements.forEach(canvas => {
        this.processCanvasElement(canvas);
    });
    
    // Сбрасываем флаг агрессивного режима
    this._aggressiveMode = false;
  }
  
  /**
   * Обрабатывает найденный canvas-элемент для регистрации графика
   * @param {HTMLCanvasElement} canvas - Canvas элемент для обработки
   */
  processCanvasElement(canvas) {
    // Проверяем, был ли этот canvas уже зарегистрирован
    if (this.registeredCanvasElements.has(canvas)) {
        // Получаем ID, с которым был зарегистрирован этот canvas
        const existingId = this.registeredCanvasElements.get(canvas);
        
        // Если график с этим ID все еще зарегистрирован, пропускаем обработку
        if (this.charts.has(existingId)) {
            return;
        }
    }

      // Проверяем, что canvas имеет Chart.js инстанс
    let chartInstance = null;
    
    // Проверка 1: Стандартное свойство __chartjs__
    if (canvas.__chartjs__) {
        chartInstance = canvas.__chartjs__;
        console.log(`ChartSyncManager: Найден стандартный экземпляр Chart.js в canvas`);
    } 
    // Проверка 2: Альтернативные свойства
    else {
        // Проверяем различные альтернативные свойства, которые могут содержать инстанс графика
        const possibleProperties = ['_chart', 'chart', 'chartInstance', '__chart__'];
        
        for (const prop of possibleProperties) {
            if (canvas[prop]) {
                chartInstance = canvas[prop];
                console.log(`ChartSyncManager: Найден экземпляр графика в свойстве ${prop} canvas-элемента`);
                break;
            }
        }
        
        // Проверка 3: Проверка родительских элементов на наличие ссылки на график
        if (!chartInstance) {
            const parent = canvas.parentElement;
            if (parent) {
                for (const prop of [...possibleProperties, 'chart', 'chartObj']) {
                    if (parent[prop]) {
                        chartInstance = parent[prop];
                        console.log(`ChartSyncManager: Найден экземпляр графика в свойстве ${prop} родительского элемента`);
                        break;
                    }
                }
            }
        }
        
        // Проверка 4: Проверка глобального реестра графиков (если есть)
        if (!chartInstance && window.Chart && window.Chart.instances) {
            for (const instance of Object.values(window.Chart.instances)) {
                if (instance.canvas === canvas) {
                    chartInstance = instance;
                    console.log(`ChartSyncManager: Найден экземпляр графика в глобальном реестре Chart.instances`);
                    break;
                }
            }
        }
        
        // Проверка 5: Если всё еще нет инстанса, но есть контекст - создаем минимальный объект
        if (!chartInstance && canvas.getContext) {
            const context = canvas.getContext('2d');
            if (context) {
                // Создаем минимальную структуру для работы с графиком
                console.log(`ChartSyncManager: Создание базового экземпляра графика для canvas без обнаруженного Chart.js`);
                chartInstance = {
                    canvas: canvas,
                    ctx: context,
                    scales: { 
                        x: { 
                            min: 0, 
                            max: 100,
                            options: { min: 0, max: 100 }
                        }
                    },
                    update: function(mode) {
                        console.log(`ChartSyncManager: Вызван метод update для базового экземпляра графика (${mode || 'default'})`);
                        // Если нет реального метода, хотя бы регистрируем вызов
                        try {
                            canvas.dispatchEvent(new Event('update'));
                        } catch (e) {
                            console.warn('ChartSyncManager: Ошибка при вызове события update на canvas', e);
                        }
                    },
                    resetZoom: function() {
                        console.log(`ChartSyncManager: Сброс масштаба базового экземпляра графика`);
                        // Сбрасываем значения масштаба к начальным
                        if (this.scales && this.scales.x) {
                            this.scales.x.min = 0;
                            this.scales.x.max = 100;
                            if (this.scales.x.options) {
                                this.scales.x.options.min = 0;
                                this.scales.x.options.max = 100;
                            }
                        }
                        // Обновляем после сброса
                        this.update('none');
                    },
                    setResponsive: function() {
                        // Заглушка для метода setResponsive
                        console.log(`ChartSyncManager: Вызов setResponsive для базового экземпляра графика`);
                    },
                    options: {
                        plugins: {
                            zoom: {
                                zoom: {
                                    enabled: true
                                },
                                pan: {
                                    enabled: true
                                }
                            }
                        }
                    }
                };
            }
        }
    }

    // Если не удалось найти или создать инстанс, выходим
    if (!chartInstance) {
        console.warn(`ChartSyncManager: Не удалось определить экземпляр графика для canvas-элемента`);
        
        // В случае агрессивного режима попробуем создать синтетический объект
        if (this._aggressiveMode) {
            console.log(`ChartSyncManager: Агрессивный режим - создаем синтетический график для canvas`);
            chartInstance = {
                canvas: canvas,
                scales: {
                    x: {
                        min: 0,
                        max: 100,
                        options: { min: 0, max: 100 }
                    }
                },
                update: function(mode) {
                    console.log(`ChartSyncManager: Обновление синтетического графика (${mode || 'default'})`);
                    try {
                        canvas.dispatchEvent(new Event('update'));
                    } catch (e) {
                        console.warn(`ChartSyncManager: Ошибка при обновлении синтетического графика:`, e);
                    }
                },
                resetZoom: function() {
                    console.log(`ChartSyncManager: Сброс масштаба синтетического графика`);
                    // Сбрасываем значения масштаба к начальным
                    if (this.scales && this.scales.x) {
                        this.scales.x.min = 0;
                        this.scales.x.max = 100;
                        if (this.scales.x.options) {
                            this.scales.x.options.min = 0;
                            this.scales.x.options.max = 100;
                        }
                    }
                    // Обновляем после сброса
                    this.update('none');
                },
                setResponsive: function() {
                    // Заглушка для метода setResponsive
                    console.log(`ChartSyncManager: Вызов setResponsive для синтетического графика`);
                },
                options: {
                    plugins: {
                        zoom: {
                            zoom: {
                                enabled: true
                            },
                            pan: {
                                enabled: true
                            }
                        }
                    }
                }
            };
        } else {
            return;
        }
    }

    // Создаем стабильный, уникальный идентификатор для canvas
    let containerId = '';
    let chartHash = '';
    
    // Создаем уникальный хеш для canvas на основе его атрибутов
    try {
        const hashParts = [
            canvas.width || 0,
            canvas.height || 0,
            canvas.id || '',
            canvas.className || '',
            canvas.getAttribute('data-id') || '',
            canvas.parentElement?.id || '',
            canvas.parentElement?.className || ''
        ];
        chartHash = hashParts.join('-');
    } catch (e) {
        chartHash = Math.random().toString(36).substring(2, 9);
    }
    
    // Проверяем стратегии для определения ID
      
      // Стратегия 1: Поиск через data-container-id
      const containerByAttr = canvas.closest('[data-container-id]');
      if (containerByAttr) {
        containerId = containerByAttr.getAttribute('data-container-id');
        console.log(`ChartSyncManager: Обнаружен график в контейнере ${containerId} (стратегия 1)`);
      }
      
      // Стратегия 2: Поиск по ID контейнера
    if (!containerId) {
      const containerById = canvas.closest('[id]');
      if (containerById) {
            containerId = containerById.id;
            console.log(`ChartSyncManager: Обнаружен график в контейнере ${containerId} (стратегия 2)`);
        }
      }
      
      // Стратегия 3: Поиск через классы, которые обычно используются для контейнеров графиков
    if (!containerId) {
      const containerSelectors = [
        '.chart-container', 
        '.chart-split-container', 
        '.split-screen-container', 
            '.report-container',
            '.split-pane',
            '.split-view',
            '.split-container',
            '[data-chart="true"]',
            '[data-report-type]',
            // Добавляем более общие селекторы
            '.chart',
            '.graph',
            '.visualisation',
            '.visualization',
            'div[style*="position"]', // Любой div с позиционированием
      ];
      
      for (const selector of containerSelectors) {
        const containerByClass = canvas.closest(selector);
        if (containerByClass) {
          // Если контейнер найден по классу, используем его ID или генерируем новый
                containerId = containerByClass.id;
          
          // Если у контейнера нет ID, генерируем уникальный
          if (!containerId) {
                    containerId = `chart-container-${chartHash}`;
            containerByClass.id = containerId;
            console.log(`ChartSyncManager: Создан новый ID ${containerId} для контейнера`);
          }
          
                console.log(`ChartSyncManager: Обнаружен график в контейнере ${containerId} (стратегия 3: ${selector})`);
                break;
          }
        }
      }
      
      // Стратегия 4: Если все не сработало, создаем ID на основе canvas
    if (!containerId) {
      if (canvas.id) {
            containerId = `canvas-${canvas.id}`;
            console.log(`ChartSyncManager: Обнаружен график с ID canvas ${containerId} (стратегия 4)`);
      } else {
            // Если у canvas нет ID, создаем стабильный на основе хеша
            containerId = `canvas-${chartHash}`;
            canvas.id = chartHash;
            console.log(`ChartSyncManager: Обнаружен график, создан ID ${containerId} (стратегия 5)`);
        }
    }
    
    // Сохраняем canvas в WeakMap для отслеживания уже зарегистрированных элементов
    this.registeredCanvasElements.set(canvas, containerId);
    
    // Проверяем, не зарегистрирован ли уже график с таким ID
    if (this.charts.has(containerId)) {
        // Проверяем, не тот же ли это экземпляр графика
        const existingChart = this.charts.get(containerId);
        if (existingChart.canvas === canvas) {
            console.log(`ChartSyncManager: График ${containerId} уже зарегистрирован с тем же canvas`);
            return;
        }
        
        // Если это другой canvas с тем же ID, обновляем ID
        containerId = `${containerId}-${chartHash}`;
        console.log(`ChartSyncManager: Изменен ID на уникальный ${containerId}`);
    }
    
    // Регистрируем график с новым ID
    this.registerChart(containerId, chartInstance);
    
    // Сохраняем canvas в WeakMap для будущих проверок
    this.registeredCanvasElements.set(canvas, containerId);
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

    // Если график уже зарегистрирован, проверяем не тот же ли это экземпляр
    if (this.charts.has(id)) {
        const existingChart = this.charts.get(id);
        if (existingChart.canvas === chartInstance.canvas) {
            console.log(`ChartSyncManager: График ${id} уже зарегистрирован с тем же canvas`);
            return;
        }
        // Если это другой canvas, удаляем старую регистрацию
      this.unregisterChart(id);
    }

    // Сохраняем ссылку на график
    this.charts.set(id, chartInstance);
    console.log(`ChartSyncManager: График ${id} зарегистрирован для синхронизации`);

    // Добавляем слушатели событий для этого графика
    this.addEventListeners(id, chartInstance);

    // Если есть сохраненный масштаб, применяем его к этому графику
    if (this.lastZoomRange) {
      console.log(`ChartSyncManager: Применяем сохраненный масштаб к новому графику ${id}`);
      this.applyCurrentZoomToChart(id);
      
      // Добавляем событие, что график был обновлен после регистрации
      document.dispatchEvent(new CustomEvent('chartSynchronized', {
        detail: {
          chartId: id,
          range: this.lastZoomRange,
          timestamp: Date.now()
        }
      }));
    } else {
      // Проверяем, есть ли уже другие графики с установленным масштабом
      if (this.charts.size > 1) {
        console.log(`ChartSyncManager: Проверяем наличие масштаба на других графиках для синхронизации с ${id}`);
        let foundRange = null;
        
        // Ищем первый график с установленным масштабом
        this.charts.forEach((chart, chartId) => {
          if (chartId !== id && chart.scales && chart.scales.x && 
              chart.scales.x.min !== undefined && chart.scales.x.max !== undefined) {
            
            foundRange = {
              min: chart.scales.x.min,
              max: chart.scales.x.max
            };
            
            // Если нашли непустой диапазон (min != max), используем его
            if (foundRange.min !== foundRange.max) {
              console.log(`ChartSyncManager: Найден диапазон на графике ${chartId}, применяем к ${id}:`, foundRange);
              // Обновляем последний диапазон
              this.lastZoomRange = foundRange;
              return; // Выходим из цикла forEach
            }
          }
        });
        
        // Если нашли диапазон, применяем его к новому графику
        if (foundRange && foundRange.min !== foundRange.max) {
          this.applyCurrentZoomToChart(id);
        }
      }
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
      
      // Добавляем обработчики событий зума и панорамирования
      // Сохраняем оригинальные обработчики
      chartInstance._originalZoomCallback = chartInstance.options.plugins.zoom.zoom.onZoom;
      chartInstance._originalPanCallback = chartInstance.options.plugins.zoom.pan.onPan;
      
      console.log(`ChartSyncManager: Оригинальные обработчики сохранены для графика ${id}`);

      // Переопределяем обработчик зума с детальным логированием
      chartInstance.options.plugins.zoom.zoom.onZoom = (context) => {
        console.log(`ChartSyncManager: Событие onZoom вызвано для графика ${id}`);
        
        // Вызываем оригинальный обработчик, если он был
        if (chartInstance._originalZoomCallback) {
          console.log(`ChartSyncManager: Вызываем оригинальный обработчик onZoom для графика ${id}`);
          chartInstance._originalZoomCallback(context);
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
        if (chartInstance._originalPanCallback) {
          console.log(`ChartSyncManager: Вызываем оригинальный обработчик onPan для графика ${id}`);
          chartInstance._originalPanCallback(context);
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
    this.suppressEvents = true;
    console.log(`ChartSyncManager: Синхронизируем зум от графика ${sourceId}, диапазон:`, range);

    this.charts.forEach((chart, id) => {
      // Пропускаем исходный график
      if (id === sourceId) return;

      // Применяем тот же диапазон масштабирования к другим графикам
      try {
        if (!chart || !chart.scales) {
          console.warn(`ChartSyncManager: График ${id} не имеет шкал для применения зума`);
          return;
        }
        
        // Применяем масштаб с использованием улучшенной стратегии
        this.applyZoomToChart(chart, id, range);
      } catch (error) {
        console.error(`ChartSyncManager: Ошибка при синхронизации зума для графика ${id}`, error);
      }
    });

    this.suppressEvents = false;
  }

  /**
   * Синхронизирует панорамирование с другими графиками
   * @param {string} sourceId - ID графика, инициировавшего панорамирование
   * @param {object} range - Диапазон {min, max} осей
   */
  syncPan(sourceId, range) {
    this.suppressEvents = true;
    console.log(`ChartSyncManager: Синхронизируем панорамирование от графика ${sourceId}, диапазон:`, range);

    this.charts.forEach((chart, id) => {
      // Пропускаем исходный график
      if (id === sourceId) return;

      // Применяем тот же диапазон к другим графикам
      try {
        if (!chart || !chart.scales) {
          console.warn(`ChartSyncManager: График ${id} не имеет шкал для применения панорамирования`);
          return;
        }
        
        // Используем ту же функцию, что и для зума
        this.applyZoomToChart(chart, id, range);
      } catch (error) {
        console.error(`ChartSyncManager: Ошибка при синхронизации панорамирования для графика ${id}`, error);
      }
    });

    this.suppressEvents = false;
  }

  /**
   * Вспомогательная функция для применения зума к графику
   * @param {object} chart - Экземпляр графика
   * @param {string} chartId - ID графика для логирования
   * @param {object} range - Диапазон {min, max} для применения
   */
  applyZoomToChart(chart, chartId, range) {
    // Проверка на наличие шкалы X
    if (chart.scales.x) {
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
      
      // Обновляем график без анимации для быстродействия
      chart.update('none'); 
      console.log(`ChartSyncManager: Масштаб применен к графику ${chartId}`);
    } else {
      // Если стандартной шкалы X нет, ищем другие возможные шкалы
      const scaleKeys = Object.keys(chart.scales);
      const horizontalScale = scaleKeys.find(key => 
        chart.scales[key].isHorizontal && chart.scales[key].isHorizontal()
      );
      
      if (horizontalScale) {
        const scale = chart.scales[horizontalScale];
        
        if (scale.options) {
          scale.options.min = range.min;
          scale.options.max = range.max;
        } else {
          scale.min = range.min;
          scale.max = range.max;
        }
        
        chart.update('none');
        console.log(`ChartSyncManager: Масштаб применен к графику ${chartId} (альтернативная шкала)`);
      } else {
        console.warn(`ChartSyncManager: Не найдена подходящая шкала для графика ${chartId}`);
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
        if (chart.resetZoom && typeof chart.resetZoom === 'function') {
          // Если у графика есть встроенный метод resetZoom, используем его
        chart.resetZoom();
          console.log(`ChartSyncManager: Зум сброшен для графика ${id} (встроенный метод)`);
        } else {
          // Для графиков без метода resetZoom, используем альтернативный подход
          this.resetChartZoomManually(chart, id);
        }
      } catch (error) {
        console.error(`ChartSyncManager: Ошибка при сбросе зума для графика ${id}`, error);
      }
    });

    this.suppressEvents = false;
    this.lastZoomRange = null;
    this.lastPanRange = null;
  }

  /**
   * Ручной сброс масштаба для графиков без метода resetZoom
   * @param {object} chart - Экземпляр графика
   * @param {string} chartId - ID графика для логирования
   */
  resetChartZoomManually(chart, chartId) {
    try {
      if (!chart || !chart.scales) {
        console.warn(`ChartSyncManager: График ${chartId} не имеет шкал для сброса масштаба`);
        return;
      }
      
      let updated = false;
      
      // Сброс масштаба на всех шкалах
      Object.keys(chart.scales).forEach(scaleId => {
        const scale = chart.scales[scaleId];
        
        // Сначала пробуем через options
        if (scale.options) {
          if (scale.options.min !== undefined || scale.options.max !== undefined) {
            scale.options.min = undefined;
            scale.options.max = undefined;
            updated = true;
          }
        }
        
        // Проверяем наличие исходных пределов (ticks.min, ticks.max)
        if (scale.options && scale.options.ticks) {
          if (scale.options.ticks.min !== undefined || scale.options.ticks.max !== undefined) {
            scale.options.ticks.min = undefined;
            scale.options.ticks.max = undefined;
            updated = true;
          }
        }
        
        // Прямая установка для свойств min/max, если они существуют
        if (scale.min !== undefined && scale.max !== undefined) {
          if (scale._originalMin !== undefined && scale._originalMax !== undefined) {
            // Если есть сохраненные исходные пределы, используем их
            scale.min = scale._originalMin;
            scale.max = scale._originalMax;
          } else {
            // Иначе сбрасываем к разумным значениям по умолчанию (графики будут использовать автоматические пределы)
            scale.min = undefined;
            scale.max = undefined;
          }
          updated = true;
        }
      });
      
      // Если какие-то изменения были сделаны, обновляем график
      if (updated) {
        chart.update('none');
        console.log(`ChartSyncManager: Масштаб сброшен вручную для графика ${chartId}`);
      } else {
        console.warn(`ChartSyncManager: Не удалось найти параметры масштабирования для сброса в графике ${chartId}`);
      }
    } catch (error) {
      console.warn(`ChartSyncManager: Ошибка при ручном сбросе масштаба графика ${chartId}:`, error);
    }
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
    if (!this.charts.has(chartId) || !this.lastZoomRange) return;

    const chart = this.charts.get(chartId);
    if (!chart || !chart.scales) {
      console.warn(`ChartSyncManager: График ${chartId} не имеет шкал для применения зума`);
      return;
    }
    
    try {
      // Проверка на наличие шкалы X
      if (chart.scales.x) {
        const scale = chart.scales.x;
        
        // Первая стратегия - установка min/max через options
        if (scale.options) {
          scale.options.min = this.lastZoomRange.min;
          scale.options.max = this.lastZoomRange.max;
        } else {
          // Альтернативная стратегия - прямая установка свойств
          scale.min = this.lastZoomRange.min;
          scale.max = this.lastZoomRange.max;
        }
        
        // Обновляем график без анимации для быстродействия
        chart.update('none');
        console.log(`ChartSyncManager: Текущий зум применен к графику ${chartId}`);
      } else {
        // Если стандартной шкалы X нет, ищем другие возможные шкалы
        const scaleKeys = Object.keys(chart.scales);
        const horizontalScale = scaleKeys.find(key => 
          chart.scales[key].isHorizontal && chart.scales[key].isHorizontal()
        );
        
        if (horizontalScale) {
          const scale = chart.scales[horizontalScale];
          
          if (scale.options) {
            scale.options.min = this.lastZoomRange.min;
            scale.options.max = this.lastZoomRange.max;
          } else {
            scale.min = this.lastZoomRange.min;
            scale.max = this.lastZoomRange.max;
          }
          
          chart.update('none');
          console.log(`ChartSyncManager: Текущий зум применен к графику ${chartId} (альтернативная шкала)`);
        } else {
          console.warn(`ChartSyncManager: Не найдена подходящая шкала для графика ${chartId}`);
        }
      }
    } catch (error) {
      console.error(`ChartSyncManager: Ошибка при применении зума к графику ${chartId}:`, error);
    }
  }
  
  /**
   * Освобождает ресурсы менеджера синхронизации
   */
  destroy() {
    // Удаляем все обработчики событий
    document.removeEventListener('splitContainerComplete', this.handleSplitComplete);
    document.removeEventListener('chartInitialized', this.handleChartInitialized);
    
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
    if (!this.syncSelectionEnabled || !range || !range.min || !range.max) return;
    
    this.suppressEvents = true;
    console.log(`ChartSyncManager: Синхронизируем выделение от графика ${sourceId}, диапазон:`, range);
    
    // Сохраняем последний диапазон выделения
    this.lastSelectionRange = range;
    
    this.charts.forEach((chart, id) => {
      // Пропускаем исходный график
      if (id === sourceId) return;
      
      try {
        if (!chart || !chart.scales || !chart.scales.x) {
          console.warn(`ChartSyncManager: График ${id} не имеет шкал для применения выделения`);
          return;
        }
        
        console.log(`ChartSyncManager: Применяем выделение к графику ${id}`);
        
        // Применяем тот же диапазон выделения
        this.applyZoomToChart(chart, id, range);
        
        // Отправляем событие о применении выделения
        document.dispatchEvent(new CustomEvent('chartSelectionApplied', {
          detail: {
            targetId: id,
            sourceId: sourceId,
            range: range,
            timestamp: Date.now()
          }
        }));
      } catch (error) {
        console.error(`ChartSyncManager: Ошибка при синхронизации выделения для графика ${id}`, error);
      }
    });
    
    this.suppressEvents = false;
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
      // Если не удалось найти по ID, попробуем взять первый доступный график
      if (this.charts.size > 0) {
        const firstChartId = Array.from(this.charts.keys())[0];
        console.log(`ChartSyncManager: График ${chartId} не найден, используем первый доступный ${firstChartId}`);
        chartId = firstChartId;
      } else {
        console.warn(`ChartSyncManager: Нет зарегистрированных графиков для сохранения выделения`);
        return false;
      }
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
    
    // Сохраняем выделение в localStorage для восстановления при перезагрузке
    this.saveSelectionToStorage(range);
    
    return true;
  }

  /**
   * Сохраняет выделение в локальное хранилище
   * @param {Object} range - Диапазон выделения для сохранения
   */
  saveSelectionToStorage(range) {
    try {
      const selectionData = {
        range: range,
        timestamp: Date.now()
      };
      localStorage.setItem('chartSelectionRange', JSON.stringify(selectionData));
      console.log('ChartSyncManager: Выделение сохранено в локальное хранилище');
    } catch (e) {
      console.warn('ChartSyncManager: Не удалось сохранить выделение в хранилище:', e);
    }
  }

  /**
   * Загружает ранее сохраненное выделение из локального хранилища
   */
  loadSelectionFromStorage() {
    try {
      const selectionJson = localStorage.getItem('chartSelectionRange');
      if (selectionJson) {
        const selectionData = JSON.parse(selectionJson);
        
        // Проверяем, не устарело ли сохраненное выделение (24 часа)
        const maxAgeMs = 24 * 60 * 60 * 1000;
        if (Date.now() - selectionData.timestamp < maxAgeMs) {
          this.lastSelectionRange = selectionData.range;
          console.log('ChartSyncManager: Выделение восстановлено из хранилища:', this.lastSelectionRange);
          return true;
        } else {
          console.log('ChartSyncManager: Сохраненное выделение устарело, удаляем');
          localStorage.removeItem('chartSelectionRange');
        }
      }
    } catch (e) {
      console.warn('ChartSyncManager: Ошибка при загрузке выделения из хранилища:', e);
    }
    return false;
  }

  /**
   * Применяет сохраненное выделение ко всем графикам в разделенных отчетах
   */
  applySavedSelectionToAll() {
    // Сначала проверяем, есть ли сохраненное выделение в памяти
    if (!this.lastSelectionRange) {
      // Попробуем восстановить из локального хранилища
      this.loadSelectionFromStorage();
      
      // Если всё еще нет выделения, пробуем использовать последний масштаб
      if (!this.lastSelectionRange && this.lastZoomRange) {
        console.log('ChartSyncManager: Используем последний диапазон масштабирования как выделение');
        this.lastSelectionRange = this.lastZoomRange;
      }
      
      // Если все еще нет выделения, выходим
      if (!this.lastSelectionRange) {
        console.warn('ChartSyncManager: Нет сохраненного выделения для применения');
        return false;
      }
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