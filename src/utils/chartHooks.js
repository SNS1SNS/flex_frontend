import { useEffect, useRef } from 'react';
import chartSyncManager from './ChartSyncManager';
import chartSyncActivator from './ChartSyncActivator';

/**
 * Хук для синхронизации зума графиков Chart.js
 * @param {Object} chartRef - Ссылка на экземпляр графика Chart.js
 * @param {String} containerId - ID контейнера графика
 * @return {Object} - Объект с опциями для настройки плагина zoom
 */
export const useSyncZoom = (chartRef, containerId) => {
  const registeredRef = useRef(false);
  
  // Эффект инициализации и очистки
  useEffect(() => {
    // Активируем синхронизацию графиков
    if (!chartSyncActivator.initialized) {
      chartSyncActivator.initialize();
    }
    
    // Очистка при размонтировании
    return () => {
      // Отменяем регистрацию графика при размонтировании компонента
      if (registeredRef.current && containerId) {
        chartSyncManager.unregisterChart(containerId);
        registeredRef.current = false;
      }
    };
  }, [containerId]);
  
  // Эффект для автоматической регистрации графика
  useEffect(() => {
    // Если у нас есть экземпляр графика и ID контейнера
    if (chartRef.current && chartRef.current.chart && containerId) {
      // Регистрируем график в менеджере синхронизации
      chartSyncManager.registerChart(containerId, chartRef.current.chart);
      registeredRef.current = true;
      
      // Применяем текущий масштаб, если он есть
      if (chartSyncManager.lastZoomRange) {
        chartSyncManager.applyCurrentZoomToChart(containerId);
      }
      
      // Применяем текущее выделение, если оно есть
      if (chartSyncManager.lastSelectionRange) {
        chartSyncManager.applyCurrentSelectionToChart(containerId);
      }
    }
  }, [chartRef, containerId]);
  
  // Опции плагина zoom для Chart.js с коллбэками для синхронизации
  return {
    zoom: {
      limits: {
        x: {min: 'original', max: 'original', minRange: 10}, // Минимальный размер видимой области по X
        y: {min: 'original', max: 'original'} // Фиксируем ось Y
      },
      pan: {
        enabled: true,
        mode: 'x', // Только по оси X
        modifierKey: 'shift', // Панорамирование при зажатом Shift
        threshold: 10, // Минимальное перемещение для активации прокрутки
        onPan: function(context) {
          // Синхронизируем панорамирование с другими графиками
          if (chartSyncManager.syncEnabled && !chartSyncManager.suppressEvents) {
            const chart = context.chart;
            
            // Получаем диапазон осей графика
            const xAxis = chart.scales.x;
            const range = {
              min: xAxis.min,
              max: xAxis.max
            };
            
            // Отправляем событие синхронизации
            chartSyncManager.syncPan(containerId, range);
          }
        }
      },
      zoom: {
        wheel: {
          enabled: true,
          modifierKey: null, // Не требуется модификатор для колесика мыши
          speed: 0.5, // Снижена скорость зума для более плавного увеличения
        },
        pinch: {
          enabled: true // Поддержка щипков на мобильных устройствах
        },
        drag: {
          enabled: true, // Включаем выделение области для увеличения
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgb(75, 192, 192)',
          borderWidth: 1
        },
        mode: 'x', // Только по оси X
        onZoom: function(context) {
          // Синхронизируем зум с другими графиками
          if (chartSyncManager.syncEnabled && !chartSyncManager.suppressEvents) {
            const chart = context.chart;
            
            // Получаем диапазон осей графика
            const xAxis = chart.scales.x;
            const range = {
              min: xAxis.min,
              max: xAxis.max
            };
            
            // Отправляем событие синхронизации
            chartSyncManager.syncZoom(containerId, range);
          }
        }
      },
      resetSpeed: 0 // Мгновенное возвращение к исходному масштабу
    }
  };
};

/**
 * Хук для использования графиков с автоматической поддержкой синхронизации
 * @param {String} containerId - ID контейнера графика
 * @return {Object} - Объект с настройками и хендлерами для графика 
 */
export const useSyncChartOptions = (containerId) => {
  const chartRef = useRef(null);
  const zoomOptions = useSyncZoom(chartRef, containerId);
  
  // Эффект для обновления отметки data-graph на canvas элементе
  useEffect(() => {
    // Если у нас есть экземпляр графика
    if (chartRef.current && chartRef.current.canvas) {
      // Добавляем атрибут data-graph для идентификации графика
      chartRef.current.canvas.setAttribute('data-graph', 'true');
      
      // Сохраняем экземпляр графика в DOM-элементе для доступа из ChartSyncActivator
      chartRef.current.canvas.__chartInstance = chartRef.current;
    }
  }, []);
  
  return {
    chartRef,
    zoomOptions
  };
};

export default {
  useSyncZoom,
  useSyncChartOptions
}; 