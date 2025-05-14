import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartLine, faLink, faUnlink, faSearchMinus, faTimes, faCaretDown, faCaretUp, faSync, faSailboat, faHighlighter, faSave, faFileImport } from '@fortawesome/free-solid-svg-icons';
import chartSyncManager from '../../utils/ChartSyncManager';
import './ChartStyles.css';

/**
 * Компонент панели отладки для синхронизации графиков
 * Отображает информацию о состоянии синхронизации и зарегистрированных графиках
 */
const ChartDebugPanel = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [syncEnabled, setSyncEnabled] = useState(chartSyncManager.syncEnabled);
  const [syncSelectionEnabled, setSyncSelectionEnabled] = useState(chartSyncManager.syncSelectionEnabled);
  const [registeredCharts, setRegisteredCharts] = useState([]);
  const [lastSelectionRange, setLastSelectionRange] = useState(null);
  const [scanCounter, setScanCounter] = useState(0); // Счетчик сканирований

  // Эффект для обновления списка зарегистрированных графиков
  useEffect(() => {
    const updateChartsList = () => {
      // Получаем ID всех зарегистрированных графиков из chartSyncManager
      const chartIds = Array.from(chartSyncManager.charts.keys());
      setRegisteredCharts(chartIds);
      setSyncEnabled(chartSyncManager.syncEnabled);
      setSyncSelectionEnabled(chartSyncManager.syncSelectionEnabled);
      
      // Обновляем информацию о выделении
      const currentSelection = chartSyncManager.lastSelectionRange;
      if (currentSelection && (!lastSelectionRange || 
          currentSelection.min !== lastSelectionRange.min || 
          currentSelection.max !== lastSelectionRange.max)) {
        setLastSelectionRange(currentSelection);
      }
    };

    // Обновляем список при инициализации
    updateChartsList();

    // Функция для обработки события изменения состояния синхронизации
    const handleSyncStateChanged = (event) => {
      setSyncEnabled(event.detail.syncEnabled);
    };
    
    // Функция для обработки события изменения состояния синхронизации выделений
    const handleSelectionSyncStateChanged = (event) => {
      setSyncSelectionEnabled(event.detail.syncSelectionEnabled);
    };

    // Функция для обработки события инициализации графика
    const handleChartInitialized = () => {
      updateChartsList();
    };
    
    // Функция для обработки события синхронизации выделения
    const handleSelectionSynchronized = (event) => {
      setLastSelectionRange(event.detail.range);
    };
    
    // Функция для обработки события применения сохраненного выделения
    const handleSavedSelectionApplied = (event) => {
      setLastSelectionRange(event.detail.range);
    };

    // Регистрируем обработчики событий
    document.addEventListener('syncStateChanged', handleSyncStateChanged);
    document.addEventListener('selectionSyncStateChanged', handleSelectionSyncStateChanged);
    document.addEventListener('chartInitialized', handleChartInitialized);
    document.addEventListener('chartSelectionSynchronized', handleSelectionSynchronized);
    document.addEventListener('savedSelectionApplied', handleSavedSelectionApplied);

    // Устанавливаем интервал для периодического обновления списка графиков
    const interval = setInterval(updateChartsList, 3000);

    // Очистка при размонтировании
    return () => {
      document.removeEventListener('syncStateChanged', handleSyncStateChanged);
      document.removeEventListener('selectionSyncStateChanged', handleSelectionSyncStateChanged);
      document.removeEventListener('chartInitialized', handleChartInitialized);
      document.removeEventListener('chartSelectionSynchronized', handleSelectionSynchronized);
      document.removeEventListener('savedSelectionApplied', handleSavedSelectionApplied);
      clearInterval(interval);
    };
  }, [lastSelectionRange]);

  // Функция для переключения состояния синхронизации
  const toggleSync = () => {
    const newState = chartSyncManager.toggleSync();
    setSyncEnabled(newState);
  };
  
  // Функция для переключения состояния синхронизации выделений
  const toggleSelectionSync = () => {
    const newState = chartSyncManager.toggleSelectionSync();
    setSyncSelectionEnabled(newState);
  };

  // Функция для сброса масштабирования всех графиков
  const resetAllZoom = () => {
    // Выбираем первый график как источник для сброса масштабирования
    if (registeredCharts.length > 0) {
      chartSyncManager.syncReset(registeredCharts[0]);
    }
  };
  
  // Функция для принудительной синхронизации всех графиков
  const forceSync = () => {
    // Сначала принудительно сканируем DOM для обнаружения графиков
    console.log('ChartDebugPanel: Выполняем предварительное сканирование DOM для поиска графиков');
    chartSyncManager.scanForNewCharts();
    
    // Небольшая задержка для обработки найденных графиков
    setTimeout(() => {
      // Получаем актуальное количество графиков напрямую из chartSyncManager
      const actualChartCount = chartSyncManager.charts.size;
      
      if (actualChartCount > 0) {
        console.log(`ChartDebugPanel: Найдено ${actualChartCount} графиков после сканирования`);
        const result = chartSyncManager.forceSyncAllCharts();
        console.log('ChartDebugPanel: Выполнена принудительная синхронизация с результатом:', result);
        
        // Обновляем список зарегистрированных графиков в UI
        setRegisteredCharts(Array.from(chartSyncManager.charts.keys()));
      } else {
        console.warn('ChartDebugPanel: После сканирования не найдено графиков для синхронизации');
        
        // Выполним еще одну попытку сканирования с другим подходом
        const canvasElements = document.querySelectorAll('canvas');
        console.log(`ChartDebugPanel: Найдено ${canvasElements.length} canvas-элементов в DOM`);
        
        if (canvasElements.length > 0) {
          console.log('ChartDebugPanel: Выполняем повторное сканирование с альтернативным подходом');
          // Ждем еще немного и пытаемся снова
          setTimeout(() => {
            chartSyncManager.scanForNewCharts();
            const updatedChartCount = chartSyncManager.charts.size;
            
            if (updatedChartCount > 0) {
              console.log(`ChartDebugPanel: Найдено ${updatedChartCount} графиков после повторного сканирования`);
              const result = chartSyncManager.forceSyncAllCharts();
              console.log('ChartDebugPanel: Выполнена принудительная синхронизация с результатом:', result);
              setRegisteredCharts(Array.from(chartSyncManager.charts.keys()));
            } else {
              console.error('ChartDebugPanel: Не удалось обнаружить графики даже после повторного сканирования');
            }
          }, 300);
        }
      }
    }, 100);
  };
  
  // Функция для специальной синхронизации разделенных отчетов
  const syncSplitReports = () => {
    console.log('ChartDebugPanel: Запуск специальной синхронизации для разделенных отчетов');
    
    // Увеличиваем счетчик сканирований
    setScanCounter(prev => prev + 1);
    
    // Выполняем повторное сканирование DOM с агрессивным поиском
    console.log('ChartDebugPanel: Запуск расширенного сканирования DOM для разделенных отчетов');
    chartSyncManager.scanForNewCharts(true); // Включаем агрессивный поиск
    
    // Небольшая задержка для обработки найденных графиков
    setTimeout(() => {
      const chartCount = chartSyncManager.charts.size;
      if (chartCount >= 2) {
        console.log(`ChartDebugPanel: Найдено ${chartCount} графиков в разделенных отчетах`);
        const result = chartSyncManager.forceSyncAllCharts();
        console.log('ChartDebugPanel: Выполнена специальная синхронизация разделенных отчетов:', result);
        
        // Обновляем список зарегистрированных графиков
        setRegisteredCharts(Array.from(chartSyncManager.charts.keys()));
        
        // Если есть сохраненное выделение, применяем его
        if (chartSyncManager.lastSelectionRange) {
          console.log('ChartDebugPanel: Применяем сохраненное выделение к разделенным отчетам');
          chartSyncManager.applySavedSelectionToAll();
        } else {
          // Если нет сохраненного выделения, пробуем загрузить из хранилища
          console.log('ChartDebugPanel: Пробуем загрузить выделение из хранилища');
          if (chartSyncManager.loadSelectionFromStorage()) {
            console.log('ChartDebugPanel: Выделение загружено из хранилища, применяем');
            setLastSelectionRange(chartSyncManager.lastSelectionRange);
            chartSyncManager.applySavedSelectionToAll();
          } else {
            console.log('ChartDebugPanel: Выделение не найдено в хранилище');
          }
        }
      } else {
        console.warn(`ChartDebugPanel: Найдено только ${chartCount} графиков в разделенных отчетах`);
        
        // Получаем все canvas-элементы для диагностики
        const canvasElements = document.querySelectorAll('canvas');
        console.log(`ChartDebugPanel: В DOM найдено ${canvasElements.length} canvas-элементов`);
        
        if (canvasElements.length > 0 && chartCount < 2) {
          console.log('ChartDebugPanel: Canvas-элементы присутствуют, но графики не обнаружены. Попытка глубокого сканирования...');
          
          // Попробуем более агрессивный подход - принудительная регистрация ВСЕХ canvas
          forceRegisterAllCanvases(canvasElements);
          
          // Проверяем результат принудительной регистрации
          const updatedChartCount = chartSyncManager.charts.size;
          if (updatedChartCount >= 2) {
            console.log(`ChartDebugPanel: После принудительной регистрации найдено ${updatedChartCount} графиков`);
            const result = chartSyncManager.forceSyncAllCharts();
            console.log('ChartDebugPanel: Выполнена синхронизация после принудительной регистрации:', result);
            setRegisteredCharts(Array.from(chartSyncManager.charts.keys()));
            
            // Применяем выделение
            if (chartSyncManager.lastSelectionRange) {
              chartSyncManager.applySavedSelectionToAll();
            } else if (chartSyncManager.loadSelectionFromStorage()) {
              setLastSelectionRange(chartSyncManager.lastSelectionRange);
              chartSyncManager.applySavedSelectionToAll();
            }
          }
        }
      }
    }, 200);
    
    // Если это не первое сканирование, не выполняем повторные попытки
    // Это помогает избежать лишних сканирований и дублирования графиков
    if (scanCounter > 0) {
      console.log('ChartDebugPanel: Пропускаем повторные сканирования (уже была выполнена попытка)');
      return;
    }
    
    // Для полной уверенности повторяем через 1 секунду с другим подходом
    setTimeout(() => {
      console.log('ChartDebugPanel: Повторное сканирование через 1 секунду');
      chartSyncManager.scanForNewCharts(true);
      
      // Если все еще мало графиков, применяем прямую регистрацию
      if (chartSyncManager.charts.size < 2) {
        const canvasElements = document.querySelectorAll('canvas');
        console.log(`ChartDebugPanel: Финальная попытка, найдено ${canvasElements.length} canvas-элементов`);
        
        if (canvasElements.length > 0) {
          forceRegisterAllCanvases(canvasElements);
        }
      }
      
      if (chartSyncManager.charts.size >= 2) {
        console.log(`ChartDebugPanel: После повторного сканирования найдено ${chartSyncManager.charts.size} графиков`);
        chartSyncManager.forceSyncAllCharts();
        
        // Если после повторного сканирования нашли больше графиков, обновляем UI
        if (chartSyncManager.charts.size > registeredCharts.length) {
          setRegisteredCharts(Array.from(chartSyncManager.charts.keys()));
        }
        
        // Применяем выделение, если оно есть
        if (chartSyncManager.lastSelectionRange) {
          chartSyncManager.applySavedSelectionToAll();
        }
      }
    }, 1000);
  };
  
  // Вспомогательная функция для принудительной регистрации ВСЕХ canvas-элементов
  const forceRegisterAllCanvases = (canvasElements) => {
    console.log(`ChartDebugPanel: Принудительная регистрация ${canvasElements.length} canvas-элементов`);
    
    // Создаем общее хранилище для ID созданных графиков,
    // чтобы избежать дублирования при множественных вызовах
    const registeredIds = new Set();
    
    canvasElements.forEach((canvas, index) => {
      // Если canvas уже имеет ID, используем его как основу
      const baseId = canvas.id || `chart-force-reg-${index}`;
      
      // Проверяем, не зарегистрирован ли уже этот canvas
      if (canvas.__chartSynced) {
        console.log(`ChartDebugPanel: Canvas #${index} уже синхронизирован`);
        return;
      }
      
      // Создаем стабильный ID на основе атрибутов canvas
      const hashParts = [
        canvas.width || 0,
        canvas.height || 0,
        canvas.id || '',
        canvas.className || '',
        canvas.getAttribute('data-id') || '',
        canvas.parentElement?.id || '',
        canvas.parentElement?.className || ''
      ];
      const canvasHash = hashParts.join('-');
      
      // Создаем уникальный ID для каждого canvas, используя существующий ID canvas или хеш
      let containerId = canvas.id ? 
        `chart-force-reg-${baseId}` : 
        `chart-force-reg-${canvasHash}`;
      
      // Если такой ID уже есть, добавляем индекс
      if (registeredIds.has(containerId)) {
        containerId = `${containerId}-${index}`;
      }
      
      registeredIds.add(containerId);
      
      // Создаем имитацию графика с более полной поддержкой Chart.js API
      const syntheticChart = {
        canvas: canvas,
        ctx: canvas.getContext('2d'),
        scales: {
          x: {
            min: 0,
            max: 100,
            options: { min: 0, max: 100 }
          }
        },
        update: function(mode) {
          console.log(`ChartDebugPanel: Обновление синтетического графика #${index} (${mode || 'none'})`);
          try {
            canvas.dispatchEvent(new Event('update'));
          } catch (e) {
            console.log('ChartDebugPanel: Ошибка при обновлении синтетического графика', e);
          }
        },
        resetZoom: function() {
          console.log(`ChartDebugPanel: Сброс масштаба синтетического графика #${index}`);
          // Сбрасываем значения масштаба
          if (this.scales.x) {
            this.scales.x.min = 0;
            this.scales.x.max = 100;
            if (this.scales.x.options) {
              this.scales.x.options.min = 0;
              this.scales.x.options.max = 100;
            }
          }
          // Вызываем обновление графика
          try {
            this.update('none');
          } catch (e) {
            console.warn('ChartDebugPanel: Ошибка при обновлении после сброса масштаба', e);
          }
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
      
      console.log(`ChartDebugPanel: Регистрация синтетического графика ${containerId}`);
      chartSyncManager.registerChart(containerId, syntheticChart);
      
      // Добавляем метаданные к canvas
      canvas.__chartSynced = true;
      canvas.__chartId = containerId;
    });
  };
  
  // Функция для сохранения текущего выделения
  const saveCurrentSelection = () => {
    if (registeredCharts.length > 0) {
      const result = chartSyncManager.saveSelectionFromChart(registeredCharts[0]);
      if (result) {
        setLastSelectionRange(chartSyncManager.lastSelectionRange);
        console.log('ChartDebugPanel: Сохранено текущее выделение');
        return true;
      } else {
        console.warn('ChartDebugPanel: Не удалось сохранить выделение');
        
        // Если нет графиков, но есть canvas-элементы, попробуем прямую регистрацию
        const canvasElements = document.querySelectorAll('canvas');
        if (canvasElements.length > 0) {
          console.log(`ChartDebugPanel: Найдено ${canvasElements.length} canvas-элементов, пробуем регистрацию для сохранения выделения`);
          forceRegisterAllCanvases(canvasElements);
          
          if (chartSyncManager.charts.size > 0) {
            const firstChartId = Array.from(chartSyncManager.charts.keys())[0];
            if (chartSyncManager.saveSelectionFromChart(firstChartId)) {
              setLastSelectionRange(chartSyncManager.lastSelectionRange);
              console.log('ChartDebugPanel: Сохранено выделение после принудительной регистрации');
              return true;
            }
          }
        }
      }
    } else {
      console.warn('ChartDebugPanel: Нет графиков для сохранения выделения');
      
      // Проверяем, есть ли canvas-элементы
      const canvasElements = document.querySelectorAll('canvas');
      if (canvasElements.length > 0) {
        console.log(`ChartDebugPanel: Найдено ${canvasElements.length} canvas-элементов, пробуем регистрацию`);
        forceRegisterAllCanvases(canvasElements);
        
        if (chartSyncManager.charts.size > 0) {
          const firstChartId = Array.from(chartSyncManager.charts.keys())[0];
          if (chartSyncManager.saveSelectionFromChart(firstChartId)) {
            setLastSelectionRange(chartSyncManager.lastSelectionRange);
            console.log('ChartDebugPanel: Сохранено выделение после регистрации canvas-элементов');
            return true;
          }
        }
      }
      
      // Попробуем загрузить из хранилища, если возможно
      if (chartSyncManager.loadSelectionFromStorage()) {
        setLastSelectionRange(chartSyncManager.lastSelectionRange);
        console.log('ChartDebugPanel: Восстановлено выделение из локального хранилища');
        return true;
      }
    }
    return false;
  };
  
  // Функция для применения сохраненного выделения
  const applySelection = () => {
    if (lastSelectionRange) {
      const result = chartSyncManager.applySavedSelectionToAll();
      console.log('ChartDebugPanel: Применено сохраненное выделение:', result);
      return true;
    } else {
      console.warn('ChartDebugPanel: Нет сохраненного выделения для применения');
      
      // Пробуем загрузить из хранилища
      if (chartSyncManager.loadSelectionFromStorage()) {
        setLastSelectionRange(chartSyncManager.lastSelectionRange);
        const result = chartSyncManager.applySavedSelectionToAll();
        console.log('ChartDebugPanel: Загружено и применено выделение из хранилища:', result);
        return true;
      }
      
      return false;
    }
  };
  
  // Функция для синхронизации выделений в разделенных отчетах
  const forceSyncSelection = () => {
    // Сначала сканируем DOM для обнаружения графиков
    console.log('ChartDebugPanel: Сканирование DOM для поиска графиков перед синхронизацией выделений');
    chartSyncManager.scanForNewCharts(true); // Используем агрессивный режим для надежности
    
    // Задержка для обработки найденных графиков
    setTimeout(() => {
      const actualChartCount = chartSyncManager.charts.size;
      
      if (actualChartCount > 0) {
        console.log(`ChartDebugPanel: Найдено ${actualChartCount} графиков для синхронизации выделений`);
        
        // Проверяем, есть ли сохраненное выделение
        if (!chartSyncManager.lastSelectionRange) {
          // Если нет выделения, попробуем загрузить из хранилища
          if (chartSyncManager.loadSelectionFromStorage()) {
            setLastSelectionRange(chartSyncManager.lastSelectionRange);
            console.log('ChartDebugPanel: Выделение загружено из хранилища');
          } else if (chartSyncManager.lastZoomRange) {
            // Если нет выделения, но есть масштаб, используем его в качестве выделения
            console.log('ChartDebugPanel: Используем последний диапазон масштабирования как выделение');
            chartSyncManager.lastSelectionRange = chartSyncManager.lastZoomRange;
            setLastSelectionRange(chartSyncManager.lastSelectionRange);
          }
        }
        
        const result = chartSyncManager.forceSyncSelection();
        console.log('ChartDebugPanel: Выполнена синхронизация выделений:', result);
        
        // Если не удалось синхронизировать выделения (нет сохраненных), пробуем сохранить из первого графика
        if (!result && chartSyncManager.charts.size > 0) {
          const firstChartId = Array.from(chartSyncManager.charts.keys())[0];
          console.log(`ChartDebugPanel: Пробуем сохранить выделение из первого графика ${firstChartId}`);
          
          if (chartSyncManager.saveSelectionFromChart(firstChartId)) {
            console.log('ChartDebugPanel: Выделение сохранено, повторяем синхронизацию');
            const retryResult = chartSyncManager.forceSyncSelection();
            console.log('ChartDebugPanel: Повторная синхронизация выделений:', retryResult);
            
            if (retryResult) {
              setLastSelectionRange(chartSyncManager.lastSelectionRange);
            }
          }
        }
        
        // Обновляем список графиков в UI
        setRegisteredCharts(Array.from(chartSyncManager.charts.keys()));
      } else {
        console.warn('ChartDebugPanel: Не найдено графиков для синхронизации выделений');
        
        // Пробуем принудительную регистрацию всех canvas, если их нет
        const canvasElements = document.querySelectorAll('canvas');
        if (canvasElements.length > 0) {
          console.log(`ChartDebugPanel: Найдено ${canvasElements.length} canvas-элементов, пробуем принудительную регистрацию`);
          forceRegisterAllCanvases(canvasElements);
          
          // Проверяем результат
          if (chartSyncManager.charts.size > 0) {
            console.log(`ChartDebugPanel: После регистрации найдено ${chartSyncManager.charts.size} графиков`);
            
            // Пробуем синхронизировать выделения повторно
            const result = chartSyncManager.forceSyncSelection();
            console.log('ChartDebugPanel: Синхронизация выделений после регистрации:', result);
            
            if (result) {
              setRegisteredCharts(Array.from(chartSyncManager.charts.keys()));
            }
          }
        }
      }
    }, 100);
  };

  // Если панель полностью свернута, отображаем только кнопку раскрытия
  if (isCollapsed) {
    return (
      <div className="chart-debug-panel chart-debug-panel-collapsed">
        <button className="expand-button" onClick={() => setIsCollapsed(false)} title="Открыть панель отладки графиков">
          <FontAwesomeIcon icon={faChartLine} />
        </button>
      </div>
    );
  }

  return (
    <div className={`chart-debug-panel ${isExpanded ? 'expanded' : ''}`}>
      <div className="panel-header">
        <h3>Отладка синхронизации графиков</h3>
        <div>
          <button 
            className="toggle-button" 
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? "Свернуть" : "Развернуть"}
          >
            <FontAwesomeIcon icon={isExpanded ? faCaretDown : faCaretUp} />
          </button>
          <button 
            className="toggle-button" 
            onClick={() => setIsCollapsed(true)}
            title="Закрыть"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      </div>
      
      <div className="panel-content">
        <div className="controls">
          <button 
            className={`sync-button ${syncEnabled ? 'active' : ''}`}
            onClick={toggleSync}
          >
            <FontAwesomeIcon icon={syncEnabled ? faLink : faUnlink} />
            {syncEnabled ? 'Синхронизация включена' : 'Синхронизация выключена'}
          </button>
          
          <button 
            className="reset-button"
            onClick={resetAllZoom}
          >
            <FontAwesomeIcon icon={faSearchMinus} />
            Сбросить масштаб
          </button>
          
          <button 
            className="sync-button"
            onClick={forceSync}
            title="Принудительно синхронизировать все графики"
          >
            <FontAwesomeIcon icon={faSync} />
            Принудит. синхр.
          </button>
          
          <button 
            className="sync-button special-sync"
            onClick={syncSplitReports}
            title="Специальная синхронизация для разделенных отчетов"
          >
            <FontAwesomeIcon icon={faSailboat} />
            Синхр. разделенных
          </button>
        </div>
        
        {/* Новый блок элементов управления для синхронизации выделений */}
        <div className="selection-controls">
          <h4>Управление выделением:</h4>
          <div className="selection-buttons">
            <button 
              className={`sync-button ${syncSelectionEnabled ? 'active' : ''}`}
              onClick={toggleSelectionSync}
              title="Включить/выключить синхронизацию выделений"
            >
              <FontAwesomeIcon icon={faHighlighter} />
              {syncSelectionEnabled ? 'Синхр. выделений вкл.' : 'Синхр. выделений выкл.'}
            </button>
            
            <button 
              className="sync-button"
              onClick={saveCurrentSelection}
              title="Сохранить текущее выделение из первого графика"
            >
              <FontAwesomeIcon icon={faSave} />
              Сохранить выдел.
            </button>
            
            <button 
              className="sync-button"
              onClick={applySelection}
              title="Применить сохраненное выделение ко всем графикам"
              disabled={!lastSelectionRange}
            >
              <FontAwesomeIcon icon={faFileImport} />
              Применить выдел.
            </button>
            
            <button 
              className="sync-button"
              onClick={forceSyncSelection}
              title="Принудительно синхронизировать выделения между графиками"
            >
              <FontAwesomeIcon icon={faSync} />
              Синхр. выделения
            </button>
          </div>
        </div>
        
        <div className="status">
          <div className="status-item">
            <div className="label">Состояние синхронизации:</div>
            <div className={`value ${syncEnabled ? 'enabled' : 'disabled'}`}>
              {syncEnabled ? 'Включено' : 'Выключено'}
            </div>
          </div>
          
          <div className="status-item">
            <div className="label">Синхр. выделений:</div>
            <div className={`value ${syncSelectionEnabled ? 'enabled' : 'disabled'}`}>
              {syncSelectionEnabled ? 'Включено' : 'Выключено'}
            </div>
          </div>
          
          <div className="status-item">
            <div className="label">Количество графиков:</div>
            <div className="value">{registeredCharts.length}</div>
          </div>
          
          {lastSelectionRange && (
            <div className="status-item">
              <div className="label">Сохраненное выделение:</div>
              <div className="value selection-range">
                {new Date(lastSelectionRange.min).toLocaleString()} &mdash; {new Date(lastSelectionRange.max).toLocaleString()}
              </div>
            </div>
          )}
        </div>
        
        {isExpanded && (
          <div className="charts-list">
            <h4>Зарегистрированные графики:</h4>
            {registeredCharts.length > 0 ? (
              <ul>
                {registeredCharts.map((chartId, index) => (
                  <li key={chartId}>
                    <FontAwesomeIcon icon={faChartLine} className="chart-icon" />
                    График #{index + 1}: {chartId.substring(0, 8)}...
                  </li>
                ))}
              </ul>
            ) : (
              <div>Нет зарегистрированных графиков</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChartDebugPanel; 