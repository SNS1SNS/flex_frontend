/**
 * ChartSyncActivator - вспомогательный модуль для активации синхронизации графиков
 * Используется для включения синхронизации зума между графиками отчетов FuelChart, 
 * SpeedChart, VoltageChart, EngineChart, и другими.
 */

import chartSyncManager from './ChartSyncManager';

/**
 * Класс для активации и управления синхронизацией графиков
 */
class ChartSyncActivator {
  constructor() {
    this.initialized = false;
    this.syncManager = null;
    this.splitCharts = new Map(); // Хранит информацию о разделенных графиках
    
    // Инициализируем слушатели событий для разделенных графиков
    document.addEventListener('splitChartInitialized', this.handleSplitChartInitialized.bind(this));
    document.addEventListener('childGraphSelection', this.handleChildGraphSelection.bind(this));
    
    console.log('ChartSyncActivator: Инициализирован обработчик разделенных графиков');
  }
  
  /**
   * Инициализирует синхронизацию графиков
   */
  initialize() {
    if (this.initialized) return;
    
    try {
      // Импортируем менеджер синхронизации только при необходимости
      import('./ChartSyncManager').then(module => {
        this.syncManager = module.default;
        this.initialized = true;
        console.log('ChartSyncActivator: Менеджер синхронизации успешно инициализирован');
        
        // Активируем обработку разделенных графиков
        this.setupSplitChartsSync();
        
        // Отправляем событие о готовности синхронизации
        document.dispatchEvent(new CustomEvent('chartSyncInitialized', {
          detail: { timestamp: Date.now() }
        }));
      }).catch(error => {
        console.error('ChartSyncActivator: Ошибка при инициализации менеджера синхронизации:', error);
      });
    } catch (error) {
      console.error('ChartSyncActivator: Ошибка при инициализации:', error);
    }
  }
  
  /**
   * Регистрирует график для синхронизации
   * @param {string} containerId - ID контейнера графика
   * @param {object} chartInstance - Экземпляр графика Chart.js
   */
  registerChart(containerId, chartInstance) {
    if (!this.initialized) {
      console.log(`ChartSyncActivator: Инициализируем синхронизацию перед регистрацией графика ${containerId}`);
      this.initialize();
      
      // Отложенная регистрация после инициализации
      setTimeout(() => {
        if (this.syncManager && this.initialized) {
          console.log(`ChartSyncActivator: Отложенная регистрация графика ${containerId}`);
          this.syncManager.registerChart(containerId, chartInstance);
          
          // Если это разделенный график, сохраняем его в специальном списке
          if (containerId && containerId.includes('-')) {
            this.saveSplitChart(containerId, chartInstance);
          }
        }
      }, 500);
      
      return;
    }
    
    if (this.syncManager) {
      console.log(`ChartSyncActivator: Регистрируем график ${containerId}`);
      this.syncManager.registerChart(containerId, chartInstance);
      
      // Если это разделенный график, сохраняем его в специальном списке
      if (containerId && containerId.includes('-')) {
        this.saveSplitChart(containerId, chartInstance);
      }
    }
  }
  
  /**
   * Сохраняет информацию о разделенном графике
   * @param {string} containerId - ID контейнера графика
   * @param {object} chartInstance - Экземпляр графика
   */
  saveSplitChart(containerId, chartInstance) {
    if (!containerId || !containerId.includes('-')) return;
    
    const baseContainerId = containerId.split('-')[0];
    
    this.splitCharts.set(containerId, {
      baseContainerId,
      chartInstance,
      timestamp: Date.now()
    });
    
    console.log(`ChartSyncActivator: Сохранен разделенный график ${containerId}, базовый: ${baseContainerId}`);
  }
  
  /**
   * Настраивает обработку синхронизации разделенных графиков
   */
  setupSplitChartsSync() {
    if (!this.syncManager) return;
    
    console.log('ChartSyncActivator: Настройка синхронизации разделенных графиков');
    
    // Добавляем отложенную проверку для синхронизации разделенных графиков
    setTimeout(() => {
      // Проверяем все разделенные графики
      if (this.splitCharts.size > 0) {
        console.log(`ChartSyncActivator: Найдено ${this.splitCharts.size} разделенных графиков для синхронизации`);
        
        // Группируем графики по базовому контейнеру
        const groupedCharts = new Map();
        
        this.splitCharts.forEach((info, containerId) => {
          const { baseContainerId } = info;
          
          if (!groupedCharts.has(baseContainerId)) {
            groupedCharts.set(baseContainerId, []);
          }
          
          groupedCharts.get(baseContainerId).push(containerId);
        });
        
        // Для каждой группы выполняем синхронизацию
        groupedCharts.forEach((containerIds, baseContainerId) => {
          console.log(`ChartSyncActivator: Синхронизируем группу графиков для базового контейнера ${baseContainerId}`);
          
          // Применяем сохраненное выделение и зум
          if (this.syncManager.lastSelectionRange) {
            console.log(`ChartSyncActivator: Применяем сохраненное выделение к группе ${baseContainerId}`);
            
            containerIds.forEach(containerId => {
              if (this.syncManager.charts.has(containerId)) {
                this.syncManager.applyCurrentSelectionToChart(containerId);
              }
            });
          }
        });
      }
    }, 1000);
  }
  
  /**
   * Обработчик события инициализации разделенного графика
   * @param {Event} event - Событие инициализации
   */
  handleSplitChartInitialized(event) {
    const { containerId, baseContainerId, syncGroupId } = event.detail;
    
    console.log(`ChartSyncActivator: Получено событие инициализации разделенного графика ${containerId}, базовый: ${baseContainerId}`);
    
    // Инициализируем синхронизацию, если еще не сделано
    if (!this.initialized) {
      this.initialize();
    }
    
    // Отложенная проверка и синхронизация этого графика
    setTimeout(() => {
      if (this.syncManager) {
        // Проверяем, зарегистрирован ли график
        const chart = this.syncManager.findChartByContainerId(containerId);
        
        if (chart) {
          console.log(`ChartSyncActivator: Найден график ${containerId} для синхронизации`);
          
          // Применяем сохраненные настройки
          if (this.syncManager.lastSelectionRange) {
            console.log(`ChartSyncActivator: Применяем сохраненное выделение к графику ${containerId}`);
            this.syncManager.applyCurrentSelectionToChart(containerId);
          }
        } else {
          console.log(`ChartSyncActivator: График ${containerId} не найден, запускаем сканирование`);
          
          // Запускаем специальное сканирование для поиска этого графика
          this.syncManager.scanForNewCharts(true);
        }
      }
    }, 500);
  }
  
  /**
   * Обработчик события выделения от дочернего графика
   * @param {Event} event - Событие выделения
   */
  handleChildGraphSelection(event) {
    const { childId, parentId, syncGroupId, selectionData } = event.detail;
    
    console.log(`ChartSyncActivator: Получено событие выделения от дочернего графика ${childId}, родитель: ${parentId}`);
    
    if (!this.initialized || !this.syncManager) {
      console.log(`ChartSyncActivator: Синхронизация не инициализирована, игнорируем событие`);
      return;
    }
    
    // Если есть группа синхронизации, обрабатываем выделение
    if (syncGroupId) {
      console.log(`ChartSyncActivator: Получено событие выделения для группы ${syncGroupId}`, selectionData);
      
      // Сохраняем выделение для группы
      if (this.syncManager.saveSelectionForGroup) {
        this.syncManager.saveSelectionForGroup(syncGroupId, selectionData);
      }
    }
    
    // Проверяем все разделенные графики с тем же родителем
    this.splitCharts.forEach((info, containerId) => {
      if (info.baseContainerId === parentId && containerId !== childId) {
        console.log(`ChartSyncActivator: Применяем выделение к родственному графику ${containerId}`);
        
        // Находим график и применяем выделение
        if (this.syncManager.charts.has(containerId)) {
          const chart = this.syncManager.charts.get(containerId);
          if (chart && selectionData.startDate && selectionData.endDate) {
            // Преобразуем данные выделения в формат для синхронизации
            const range = {
              min: new Date(selectionData.startDate).getTime(),
              max: new Date(selectionData.endDate).getTime()
            };
            
            // Применяем выделение
            this.syncManager.applyZoomToChart(chart, containerId, range);
          }
        }
      }
    });
  }
  
  /**
   * Очищает ресурсы активатора
   */
  destroy() {
    document.removeEventListener('splitChartInitialized', this.handleSplitChartInitialized);
    document.removeEventListener('childGraphSelection', this.handleChildGraphSelection);
    
    this.splitCharts.clear();
    this.initialized = false;
    console.log('ChartSyncActivator: Ресурсы очищены');
  }
}

// Создаем экземпляр активатора и экспортируем его
const chartSyncActivator = new ChartSyncActivator();

export default chartSyncActivator; 