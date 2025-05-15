import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';
import annotationPlugin from 'chartjs-plugin-annotation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSyncAlt, faDownload, faExpand, faCompress, faTruck, faColumns, faWindowRestore, faRedo, faSearchMinus, faKeyboard, faLink, faUnlink } from '@fortawesome/free-solid-svg-icons';
import SplitScreenContainer from '../common/SplitScreenContainer';
import splitScreenManager, { SPLIT_MODES } from '../../utils/SplitScreenManager';
import chartSyncManager from '../../utils/ChartSyncManager';
import chartSyncActivator from '../../utils/ChartSyncActivator';
import ReportChooser from './ReportChooser';
import { toast } from 'react-toastify';
import './ChartStyles.css';

// Регистрируем необходимые компоненты ChartJS
ChartJS.register(
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend, 
  Filler,
  zoomPlugin,
  annotationPlugin  // Регистрируем плагин аннотаций
);

// Активируем синхронизацию графиков при импорте компонента
if (!chartSyncActivator.initialized) {
  chartSyncActivator.initialize();
}

// Добавляем глобальный флаг для отслеживания открытых модальных окон выбора отчета
// Используем глобальный объект window для доступа из любого экземпляра компонента
if (typeof window.reportChooserModalOpen === 'undefined') {
  window.reportChooserModalOpen = false;
}

// Добавляем глобальные переменные для хранения выделенных точек
if (typeof window.selectedChartPoint === 'undefined') {
  window.selectedChartPoint = {
    timestamp: null,
    pointIndex: null,
    value: null,
    containerId: null
  };
}

const BaseChart = ({ 
  title,
  vehicle,
  startDate,
  endDate,
  data,
  labels,
  yAxisLabel,
  color = 'rgb(75, 192, 192)',
  backgroundGradient = true,
  fetchData,
  formatTooltipLabel = (value) => `${value}`,
  formatYAxisLabel = (value) => `${value}`,
  formatXAxisLabel = (value) => value,
  emptyDataMessage = 'Нет данных для отображения',
  reportType // Добавляем тип отчета для идентификации
}) => {
  const [expandedMode, setExpandedMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [chartData, setChartData] = useState(null);
  const [error, setError] = useState(null);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [showReportChooser, setShowReportChooser] = useState(false);
  const [splitDirection, setSplitDirection] = useState(null);
  const chartRef = useRef(null);
  const chartContainerRef = useRef(null);
  const containerId = useRef(`chart-container-${Math.random().toString(36).substring(2, 11)}`).current;
  const [containerToFill, setContainerToFill] = useState(null);
  const [syncGroupId, setSyncGroupId] = useState(null);

  // Эффект для проверки существования контейнера в DOM и установки ID на DOM-элемент
  useEffect(() => {
    console.log(`BaseChart: Инициализация контейнера с ID ${containerId}`);
    
    // Ищем элемент контейнера через ref
    if (chartContainerRef.current) {
      // Гарантируем, что ID будет установлен и в DOM-элементе
      const container = chartContainerRef.current.closest('.chart-split-container');
      if (container) {
        // Если ID не установлен или отличается, устанавливаем его
        if (!container.id || container.id !== containerId) {
          console.log(`BaseChart: Устанавливаем ID ${containerId} на DOM-элемент`);
          container.id = containerId;
        }
      }
    }
    
    // Дополнительная проверка, что DOM-элемент существует
    setTimeout(() => {
      const containerExists = document.getElementById(containerId);
      if (!containerExists) {
        console.warn(`BaseChart: DOM-элемент с ID ${containerId} не найден после таймаута`);
      } else {
        console.log(`BaseChart: DOM-элемент с ID ${containerId} успешно найден после таймаута`);
      }
    }, 100);
  }, [containerId]);

  // Создание и настройка данных для графика
  useEffect(() => {
    if (data === null || data === undefined) {
      setChartData(null);
      return;
    }

    // Проверяем, передан ли уже готовый config для графика
    if (data.datasets) {
      // Если передан готовый конфиг с наборами данных, используем его напрямую
      setChartData(data);
      return;
    }

    // Старая логика для обратной совместимости
    if (!labels || !data) {
      setChartData(null);
      return;
    }

    // Создаем градиент для фона (если включено)
    let backgroundColorConfig = backgroundGradient 
      ? function(context) {
          if (!context.chart.chartArea) {
            return null;
          }
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, context.chart.height);
          const colorRgb = color.replace('rgb', 'rgba').replace(')', ', 0.5)');
          gradient.addColorStop(0, colorRgb);
          gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
          return gradient;
        }
      : 'rgba(0, 0, 0, 0)'; // прозрачный фон, если градиент отключен

    // Формируем конфигурацию для графика
    setChartData({
      labels,
      datasets: [
        {
          label: title,
          data: data,
          fill: backgroundGradient,
          backgroundColor: backgroundColorConfig,
          borderColor: color,
          borderWidth: 2,
          pointBackgroundColor: color,
          pointBorderColor: '#fff',
          pointRadius: 0, // Отключаем отображение точек на графике
          pointHoverRadius: 5,
          tension: 0, // Убираем сглаживание для получения прямых линий между точками
        },
      ],
    });
  }, [title, data, labels, color, backgroundGradient]);

  // Загрузка данных при изменении параметров
  useEffect(() => {
    if (vehicle && startDate && endDate && fetchData) {
      loadData();
    }
  }, [vehicle, startDate, endDate]);

  // Эффект для обновления размеров графика при изменении размера окна
  useEffect(() => {
    const handleResize = () => {
      if (chartRef.current) {
        chartRef.current.resize();
      }
    };

    window.addEventListener('resize', handleResize);

    // Также обновляем при изменении режима отображения
    if (expandedMode !== undefined) {
      setTimeout(handleResize, 200);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [expandedMode]);

  // Обработчик клавиатурных событий для сброса масштаба
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Быстрая проверка на активный контейнер
      const container = document.getElementById(containerId);
      if (!container) return;
      
      // Сбрасываем масштаб по Escape
      if (event.key === 'Escape') {
        resetZoom();
        event.preventDefault();
        return;
      }
      
      // Сбрасываем масштаб по пробелу
      if (event.key === ' ') {
        resetZoom();
        event.preventDefault();
        return;
      }
      
      // Сбрасываем масштаб по Ctrl+0 (или Cmd+0 на Mac)
      if ((event.ctrlKey || event.metaKey) && event.key === '0') {
        resetZoom();
        event.preventDefault();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Эффект для проверки, что DOM был обновлен после разделения экрана
  useEffect(() => {
    // Если есть выбранное направление для разделения, 
    // это значит что произошло недавнее действие по разделению
    if (splitDirection) {
      // Проверяем наличие контейнера в DOM
      const checkContainerExistence = () => {
        const containerElement = document.getElementById(containerId);
        
        if (containerElement) {
          console.log(`BaseChart: Контейнер ${containerId} существует после действия разделения`);
          // Также проверяем наличие нового контейнера для второго отчета
          const secondContainerSelector = `#${containerId}-2, [data-container-id="${containerId}-2"]`;
          const secondContainer = document.querySelector(secondContainerSelector);
          
          if (secondContainer) {
            console.log(`BaseChart: Новый контейнер ${containerId}-2 существует после разделения`);
          } else {
            console.warn(`BaseChart: Новый контейнер ${containerId}-2 НЕ найден после разделения`);
          }
        } else {
          console.warn(`BaseChart: Контейнер ${containerId} НЕ найден после действия разделения`);
        }
      };
      
      // Проверяем с небольшой задержкой, чтобы DOM успел обновиться
      setTimeout(checkContainerExistence, 100);
    }
  }, [splitDirection, containerId]);
  
  // Эффект для гарантированного закрытия модального окна
  useEffect(() => {
    // Если модальное окно открыто, регистрируем обработчики для гарантированного закрытия
    if (showReportChooser) {
      console.log('BaseChart: Модальное окно открыто, регистрируем обработчики закрытия');
      
      // Функция для проверки и закрытия модального окна
      const forceCloseModal = () => {
        if (showReportChooser) {
          console.log('BaseChart: Принудительное закрытие модального окна');
          // Обрабатываем закрытие модального окна асинхронно, чтобы избежать проблем с React-циклом обновления
          setTimeout(() => {
            setShowReportChooser(false);
            setSplitDirection(null);
          }, 0);
        }
      };
      
      // Таймаут для закрытия окна через 5 секунд (защита от зависания)
      // Уменьшаем время до 5 секунд для более быстрой реакции
      const closeTimeout = setTimeout(forceCloseModal, 5000);
      
      // Обработчик для закрытия модального окна при навигации или обновлении страницы
      const handleBeforeUnload = () => {
        forceCloseModal();
      };
      
      // Добавляем обработчик события перед выгрузкой страницы
      window.addEventListener('beforeunload', handleBeforeUnload);
      
      return () => {
        // Очистка при размонтировании эффекта
        clearTimeout(closeTimeout);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        
        // Если компонент размонтируется, но модальное окно всё ещё открыто, закрываем его явно
        if (showReportChooser) {
          console.log('BaseChart: Закрытие модального окна при размонтировании компонента');
          setShowReportChooser(false);
          setSplitDirection(null);
        }
      };
    }
  }, [showReportChooser]);

  // Эффект для сброса состояния при размонтировании
  useEffect(() => {
    return () => {
      // Очистка при размонтировании компонента
      console.log(`BaseChart: Компонент с ID ${containerId} размонтирован`);
      
      // Безопасно закрываем модальное окно перед размонтированием
      if (showReportChooser) {
        console.log(`BaseChart: Сброс состояния showReportChooser при размонтировании`);
        // Устанавливаем значение напрямую, минуя setState, чтобы избежать ошибок рендеринга
        // при размонтировании компонента
        try {
          // Это опасный паттерн, но в данном случае он поможет избежать проблем с React-циклом
          // при размонтировании компонента
          setShowReportChooser(false);
        } catch (e) {
          // Игнорируем ошибки при размонтировании
          console.log(`BaseChart: Ошибка при сбросе состояния: ${e.message}`);
        }
      }
    };
  }, [containerId, showReportChooser]);

  // Вывод в консоль при изменении состояния showReportChooser
  useEffect(() => {
    console.log(`BaseChart: Изменилось состояние showReportChooser = ${showReportChooser}`);
  }, [showReportChooser]);

  // Эффект для регистрации обработчика события разделения контейнера
  useEffect(() => {
    // Создаем переменную для отслеживания, было ли уже вызвано модальное окно
    let modalTriggered = false;
    
    // Функция для сброса флага при закрытии модального окна
    const resetModalFlag = () => {
      modalTriggered = false;
    };
    
    // Функция-обработчик события завершения разделения
    const handleSplitComplete = (event) => {
      const { containerId: eventContainerId, container1Id, container2Id, direction } = event.detail;
      
      // Проверяем, что это событие для нашего контейнера и что модальное окно еще не было вызвано
      if (eventContainerId === containerId && !modalTriggered) {
        console.log(`BaseChart: Получено событие завершения разделения для нашего контейнера ${containerId}`);
        console.log(`BaseChart: Новые контейнеры: ${container1Id}, ${container2Id}, направление: ${direction}`);
        
        // Устанавливаем флаг, что модальное окно вызвано
        modalTriggered = true;
        
        // Открываем окно выбора отчета для второго контейнера
        // но нам нужны данные контейнера для создания отчета
        setContainerToFill(container2Id);
        setShowReportChooser(true);
        
        // Сбрасываем флаг при закрытии модального окна через некоторое время
        setTimeout(resetModalFlag, 1000);
      }
    };
    
    // Добавляем обработчик события
    document.addEventListener('splitContainerComplete', handleSplitComplete);
    
    // Очистка при размонтировании
    return () => {
      document.removeEventListener('splitContainerComplete', handleSplitComplete);
    };
  }, [containerId]);

  // Эффект для регистрации обработчика события запроса выбора отчета
  useEffect(() => {
    // Создаем переменную для отслеживания, было ли уже вызвано модальное окно
    let modalRequested = false;
    
    // Функция для сброса флага блокировки
    const resetRequestFlag = () => {
      modalRequested = false;
    };
    
    // Функция-обработчик запроса выбора отчета
    const handleRequestReportSelector = (event) => {
      const { containerId, direction, activateContainer } = event.detail;
      
      // Проверяем глобальный флаг, что модальное окно еще не открыто где-то
      if (window.reportChooserModalOpen) {
        console.log(`BaseChart: Пропускаем запрос выбора отчета, модальное окно уже открыто в другом экземпляре`);
        return;
      }
      
      // Проверяем локальное состояние
      if (showReportChooser || modalRequested) {
        console.log(`BaseChart: Пропускаем повторный запрос выбора отчета, так как модальное окно уже ${showReportChooser ? 'открыто' : 'запрошено'}`);
        return;
      }
      
      // Устанавливаем флаг, что запрос обработан
      modalRequested = true;
      // Устанавливаем глобальный флаг
      window.reportChooserModalOpen = true;
      
      console.log(`BaseChart: Получен запрос на открытие селектора отчетов для контейнера ${containerId}`);
      
      // Устанавливаем целевой контейнер и открываем выбор отчета
      setContainerToFill(containerId);
      
      // Активируем контейнер для выбора отчета, если требуется
      if (activateContainer) {
        const container = document.getElementById(containerId) || 
                         document.querySelector(`[data-container-id="${containerId}"]`);
        
        if (container) {
          // Сначала снимаем активность со всех контейнеров
          document.querySelectorAll('.split-screen-container[data-active="true"]')
            .forEach(el => {
              if (el && document.body.contains(el)) { // Проверяем, что элемент всё ещё в DOM
                el.setAttribute('data-active', 'false');
                el.classList.remove('active-container');
              }
            });
          
          // Активируем наш контейнер, если он всё ещё в DOM
          if (document.body.contains(container)) {
            container.setAttribute('data-active', 'true');
            container.classList.add('active-container');
            
            console.log(`BaseChart: Активирован контейнер ${containerId} для выбора отчета`);
          }
        }
      }
      
      // Открываем выбор отчета
      console.log('BaseChart: Открываем диалог выбора отчета (setShowReportChooser(true))');
      setShowReportChooser(true);
      
      // Если указано направление разделения, сохраняем его
      if (direction) {
        setSplitDirection(direction);
      }
      
      // Сбрасываем флаг блокировки через некоторое время
      setTimeout(resetRequestFlag, 1000);
    };
    
    // Добавляем обработчик события
    document.addEventListener('requestReportSelector', handleRequestReportSelector);
    
    // Очистка при размонтировании
    return () => {
      document.removeEventListener('requestReportSelector', handleRequestReportSelector);
    };
  }, [showReportChooser]);

  // Обновляем эффект для регистрации графика в менеджере синхронизации
  useEffect(() => {
    if (chartRef.current && chartRef.current.canvas) {
      // Устанавливаем data-graph атрибут для идентификации канваса
      chartRef.current.canvas.setAttribute('data-graph', 'true');
      
      // Важно: При инициализации графика в разделенном контейнере, 
      // устанавливаем дополнительные атрибуты для синхронизации
      if (containerId && containerId.includes('-')) {
        const baseContainerId = containerId.split('-')[0];
        chartRef.current.canvas.setAttribute('data-parent-container', baseContainerId);
        
        // Получаем группу синхронизации из контейнера или создаем новую
        const container = chartContainerRef.current?.closest('.split-screen-container');
        const containerSyncGroupId = container?.getAttribute('data-sync-group') || `sync-${containerId}`;
        
        // Устанавливаем syncGroupId
        setSyncGroupId(containerSyncGroupId);
        
        // Добавляем информацию о группе синхронизации
        chartRef.current.canvas.setAttribute('data-sync-group', containerSyncGroupId);
        
        console.log(`BaseChart: График в разделенном контейнере ${containerId} инициализирован, родитель: ${baseContainerId}, группа: ${containerSyncGroupId}`);
        
        // Отправляем событие о готовности графика в разделенном контейнере
        document.dispatchEvent(new CustomEvent('splitChartInitialized', {
          detail: {
            containerId,
            baseContainerId,
            syncGroupId: containerSyncGroupId,
            timestamp: Date.now()
          }
        }));
      }
      
      // Регистрируем график в ChartSyncManager после короткой задержки,
      // чтобы убедиться, что все свойства графика полностью инициализированы
      setTimeout(() => {
        registerChart();
      }, 300);
    }
  }, [chartRef.current]);

  // Ефект для добавления data-graph атрибута и интеграции с системой синхронизации выделения
  useEffect(() => {
    // Добавляем маркер для графиков, чтобы их можно было найти при синхронизации выделения
    if (chartRef.current) {
      const chartCanvas = chartRef.current.canvas;
      if (chartCanvas) {
        // Добавляем атрибут data-graph для идентификации графика
        chartCanvas.setAttribute('data-graph', 'true');
        // Сохраняем экземпляр графика в DOM-элементе для доступа из SplitScreenContainer
        chartCanvas.__chartInstance = chartRef.current;
        
        console.log(`BaseChart: Добавлен атрибут data-graph к canvas графика ${containerId}`);
      }
    }
    
    // Добавляем обработчик события выделения от SplitScreenContainer
    const handleApplyGraphSelection = (event) => {
      const { selectionData, targetContainerId } = event.detail;
      
      // Проверяем, предназначено ли событие для нашего контейнера
      const isForThisContainer = !targetContainerId || targetContainerId === containerId;
      
      if (isForThisContainer && chartRef.current && selectionData) {
        console.log(`BaseChart: Применяем выделение к графику ${containerId}`);
        applySelectionToChart(selectionData);
      }
    };
    
    // Также слушаем глобальное событие для контейнера
    const handleApplySelectionToContainer = (event) => {
      const { containerId: targetId, selectionData } = event.detail;
      
      if (targetId === containerId && chartRef.current && selectionData) {
        console.log(`BaseChart: Получено глобальное событие выделения для контейнера ${containerId}`);
        applySelectionToChart(selectionData);
      }
    };
    
    // Регистрируем обработчики
    document.addEventListener('applyGraphSelection', handleApplyGraphSelection);
    document.addEventListener('applySelectionToContainer', handleApplySelectionToContainer);
    
      return () => {
      document.removeEventListener('applyGraphSelection', handleApplyGraphSelection);
      document.removeEventListener('applySelectionToContainer', handleApplySelectionToContainer);
    };
  }, [containerId]);
  
  // Функция для применения выделения к графику
  const applySelectionToChart = (selectionData) => {
    if (!chartRef.current || !selectionData) {
      console.log(`BaseChart: Не удалось применить выделение к графику ${containerId} - отсутствует chartRef или данные выделения`);
      return;
    }
    
    try {
      console.log(`BaseChart: Применяем выделение к графику ${containerId}:`, selectionData);
      const chart = chartRef.current;
      
      // Для выделения по диапазону времени
      if (selectionData.startDate && selectionData.endDate) {
        const startTime = new Date(selectionData.startDate).getTime();
        const endTime = new Date(selectionData.endDate).getTime();
        
        console.log(`BaseChart: Диапазон времени для выделения ${new Date(startTime).toISOString()} - ${new Date(endTime).toISOString()}`);
        
        // Если у нас есть plugin zoom, используем его для выделения
        if (chart.scales && chart.scales.x) {
          // Теперь применим выделение напрямую, используя API графика Chart.js
          
          // Вариант 1: Используем Chart.js zoom plugin (предпочтительно)
          if (chart.zoom && typeof chart.zoom.zoomScale === 'function') {
            console.log(`BaseChart: Применяем zoom.zoomScale для графика ${containerId}`);
            
            // Настраиваем опции зума по временному диапазону
            const zoomOptions = {
              min: startTime,
              max: endTime
            };
            
            // Убедимся, что анимация отключена для мгновенного применения
            const originalAnimation = chart.options.animation;
            chart.options.animation = false;
            
            // Применяем зум
            chart.zoom.zoomScale('x', zoomOptions);
            
            // Восстанавливаем настройки анимации
            setTimeout(() => {
              chart.options.animation = originalAnimation;
            }, 100);
            
            console.log(`BaseChart: Выделение успешно применено через zoom.zoomScale`);
          }
          // Вариант 2: Устанавливаем min/max напрямую
          else if (chart.scales.x.options) {
            console.log(`BaseChart: Применяем выделение через scales.x.options для графика ${containerId}`);
            
            // Сохраняем текущие границы для отладки
            const currentMin = chart.scales.x.min;
            const currentMax = chart.scales.x.max;
            console.log(`BaseChart: Текущие границы графика: ${currentMin} - ${currentMax}`);
            
            // Устанавливаем новые границы
            chart.scales.x.options.min = startTime;
            chart.scales.x.options.max = endTime;
            
            // Принудительное обновление без анимации для мгновенного эффекта
            chart.update('none');
            
            console.log(`BaseChart: Новые границы графика: ${chart.scales.x.min} - ${chart.scales.x.max}`);
          }
          // Вариант 3: Временные метки - если предыдущие методы не сработали
          else {
            console.log(`BaseChart: Ищем индексы для временного диапазона (особый случай)`);
            
            // Получаем текущие данные меток времени
            const timeLabels = chart.data.labels;
            
            // Если метки времени это даты, ищем ближайшие индексы к выделению
            if (timeLabels && timeLabels.length > 0) {
              let startIndex = -1;
              let endIndex = -1;
              
              // Преобразуем все метки в даты, если они еще не являются датами
              const labelTimes = timeLabels.map(label => {
                if (label instanceof Date) {
                  return label.getTime();
                }
                // Пробуем преобразовать строки в даты
                try {
                  return new Date(label).getTime();
                } catch (e) {
                  return null;
                }
              });
              
              // Ищем индексы меток, соответствующие начальному и конечному времени
              for (let i = 0; i < labelTimes.length; i++) {
                const labelTime = labelTimes[i];
                if (labelTime === null) continue;
                
                if (startIndex === -1 && labelTime >= startTime) {
                  startIndex = i;
                }
                
                if (labelTime <= endTime) {
                  endIndex = i;
                }
              }
              
              // Если нашли оба индекса, применяем выделение
              if (startIndex !== -1 && endIndex !== -1 && startIndex <= endIndex) {
                console.log(`BaseChart: Найдены индексы для выделения: ${startIndex} - ${endIndex}`);
                
                // Настраиваем границы масштабирования
                if (chart.scales.x.time && chart.scales.x.time.parser) {
                  // Для временной шкалы с парсером
                  chart.options.scales.x.min = startTime;
                  chart.options.scales.x.max = endTime;
                } else {
                  // Для категориальной шкалы
                  chart.options.scales.x.min = startIndex;
                  chart.options.scales.x.max = endIndex;
                }
                
                // Обновляем график без анимации
                chart.update('none');
                console.log(`BaseChart: Выделение по индексам успешно применено`);
              } else {
                console.log(`BaseChart: Не удалось найти подходящие индексы для временного диапазона: ${startIndex} - ${endIndex}`);
              }
            }
          }
          
          // Сохраняем диапазон выделения в атрибуты для отладки
          chart.canvas.setAttribute('data-selection-start', selectionData.startDate);
          chart.canvas.setAttribute('data-selection-end', selectionData.endDate);
          chart.canvas.setAttribute('data-selection-applied', 'true');
          
          // Добавляем визуальное выделение (опционально)
          if (chart.options.plugins && chart.options.plugins.highlight) {
            chart.options.plugins.highlight.ranges = [{
              start: selectionData.startDate,
              end: selectionData.endDate,
              color: 'rgba(255, 255, 0, 0.2)'
            }];
            chart.update();
          }
          
          console.log(`BaseChart: Выделение успешно применено к графику ${containerId}`);
        } else {
          console.log(`BaseChart: У графика нет шкалы X для применения выделения`);
        }
      }
      // Для выделения по индексам
      else if (selectionData.startIndex !== undefined && selectionData.endIndex !== undefined) {
        console.log(`BaseChart: Применяем выделение по индексам ${selectionData.startIndex} - ${selectionData.endIndex}`);
        
        if (chart.scales && chart.scales.x) {
          // Применяем выделение по индексам
          chart.options.scales.x.min = selectionData.startIndex;
          chart.options.scales.x.max = selectionData.endIndex;
          
          // Обновляем график без анимации
          chart.update('none');
          
          // Сохраняем индексы выделения в атрибуты
          chart.canvas.setAttribute('data-selection-start-index', selectionData.startIndex);
          chart.canvas.setAttribute('data-selection-end-index', selectionData.endIndex);
          chart.canvas.setAttribute('data-selection-applied', 'true');
          
          console.log(`BaseChart: Выделение по индексам успешно применено к графику ${containerId}`);
        }
      }
      
      // Отправляем событие о том, что выделение было применено
      const event = new CustomEvent('chartSelectionApplied', {
        detail: {
          containerId,
          selectionData,
          success: true,
          timestamp: Date.now()
        }
      });
      document.dispatchEvent(event);
      
    } catch (error) {
      console.error('BaseChart: Ошибка при применении выделения к графику:', error);
      
      // Отправляем событие о неудачном применении выделения
      const event = new CustomEvent('chartSelectionApplied', {
        detail: {
          containerId,
          selectionData,
          success: false,
          error: error.message,
          timestamp: Date.now()
        }
      });
      document.dispatchEvent(event);
    }
  };

  // Обработчик клика на графике с поддержкой выделения и активации контейнера
  const handleChartClick = (event) => {
    // Проверяем, что у нас есть ссылка на график и его данные
    if (!chartRef.current || !chartRef.current.data || !chartRef.current.data.labels) {
      console.log('BaseChart: График не инициализирован или отсутствуют данные');
      return;
    }

    // Получаем элементы под курсором одним вызовом и используем повторно
    const clickedElements = chartRef.current.getElementsAtEventForMode(
      event.nativeEvent, 
      'nearest', 
      { intersect: true }, 
      false
    );
    
    // Если элементы не найдены, прерываем обработку
    if (!clickedElements || clickedElements.length === 0) {
      console.log(`BaseChart: Клик не попал в данные графика`);
      return;
    }
    
    // Получаем родительский контейнер графика и активируем его
    const container = chartContainerRef.current?.closest('.split-screen-container');
    
    if (container) {
      // Активируем контейнер - делаем это только для кликнутой точки
      container.setAttribute('data-active', 'true');
      container.classList.add('active-container');
    }

    // Если пользователь кликнул на точку графика
    try {
      const clickedElement = clickedElements[0];
      const datasetIndex = clickedElement.datasetIndex;
      const pointIndex = clickedElement.index;
      
      // Обработка Shift-клика для создания выделения диапазона
      if (event.nativeEvent.shiftKey && chartRef.current.lastClickIndex !== undefined) {
        console.log(`BaseChart: Обнаружен Shift-клик, создаем выделение от ${chartRef.current.lastClickIndex} до ${pointIndex}`);
        
        // Определяем начальный и конечный индексы
        const startIndex = Math.min(chartRef.current.lastClickIndex, pointIndex);
        const endIndex = Math.max(chartRef.current.lastClickIndex, pointIndex);
        
        // Используем наш обработчик выделения
        handleSelection(startIndex, endIndex);
        return;
      }
      
      // Сначала сбрасываем предыдущее выделение на всех графиках
      resetAllPointHighlights();
      
      console.log(`BaseChart: Клик на точке индекс=${pointIndex}, набор данных=${datasetIndex}`);
      
      // Получаем данные о точке
      const dataset = chartRef.current.data.datasets[datasetIndex];
      const label = chartRef.current.data.labels[pointIndex];
      const value = dataset.data[pointIndex];
      
      // Определяем временную метку
      let timestamp = null;
      
      if (label instanceof Date) {
        timestamp = label.getTime();
      } else if (typeof label === 'string') {
        // Пробуем разобрать строку как дату
        try {
          timestamp = new Date(label).getTime();
        } catch (e) {
          // Игнорируем ошибки преобразования
        }
      } else if (typeof label === 'number') {
        timestamp = label;
      }
      
      // Сохраняем выделенную точку глобально для синхронизации
      window.selectedChartPoint = {
        timestamp,
        pointIndex,
        value,
        containerId,
        label,
        reportType
      };
      
      // Добавляем выделение с фиксированной подсказкой
      addHighlightPoint(pointIndex, datasetIndex);
      
      // Синхронизируем выделение точки с другими графиками немедленно
      syncPointSelection(timestamp, pointIndex);
      
      // Запоминаем последний выбранный индекс для выделения диапазона
      chartRef.current.lastClickIndex = pointIndex;
      
      // Сбрасываем текущее выделение масштаба если оно есть
      if (chartRef.current.canvas.hasAttribute('data-selection-applied')) {
        console.log(`BaseChart: Сброс текущего выделения масштаба`);
        resetZoom();
      }
    } catch (error) {
      console.error('BaseChart: Ошибка при выделении точки:', error);
    }
  };

  // Функция для сброса выделения точек на всех графиках
  const resetAllPointHighlights = () => {
    // Отправляем глобальное событие для сброса выделения на всех графиках
    document.dispatchEvent(new CustomEvent('resetAllPointHighlights', {}));
    
    // Локально сбрасываем выделение на текущем графике
    resetPointHighlight();
  };

  // Функция для отображения подсказки для выбранной точки - используется в других частях кода
  const showPointTooltip = useCallback((pointIndex, datasetIndex = 0) => {
    if (!chartRef.current) return;
    
    try {
      const chart = chartRef.current;
      
      // Скрываем все активные подсказки
      if (chart.tooltip) {
        chart.tooltip.setActiveElements([], { datasetIndex, index: pointIndex });
      }
      
      // Вычисляем позицию точки на графике
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta || !meta.data || !meta.data[pointIndex]) return;
      
      const element = meta.data[pointIndex];
      
      // Создаем и отображаем подсказку
      chart.tooltip.setActiveElements([{ datasetIndex, index: pointIndex }], {
        x: element.x,
        y: element.y
      });
      
      // Обновляем график без анимации
      chart.update('none');
    } catch (error) {
      console.error('BaseChart: Ошибка при отображении подсказки:', error);
    }
  }, [chartRef]);

  // Обновленный метод syncPointSelection для использования showPointTooltip
  const syncPointSelection = (timestamp, pointIndex) => {
    // Проверка, что timestamp существует
    if (!timestamp) return;
    
    // Отправляем событие для синхронизации выделения точки
    // Используем одно событие вместо нескольких
    const syncEvent = new CustomEvent('chartPointSelected', {
      detail: {
        sourceContainerId: containerId,
        timestamp,
        pointIndex,
        label: window.selectedChartPoint.label,
        value: window.selectedChartPoint.value,
        reportType,
        priority: 'high' // Для ускорения обработки
      },
      bubbles: false // Предотвращаем всплытие события для лучшей производительности
    });
    
    document.dispatchEvent(syncEvent);
    
    // Добавляем вызов функции showPointTooltip для отображения подсказки
    if (chartRef.current && pointIndex >= 0) {
      showPointTooltip(pointIndex);
    }
  };

  // Обработчик события выделения точки на другом графике
  useEffect(() => {
    let isProcessing = false; // Флаг для предотвращения обработки нескольких событий одновременно
    
    const handlePointSelected = (event) => {
      const { sourceContainerId, timestamp } = event.detail; // Убираем неиспользуемый priority
      
      // Не обрабатываем событие от самого себя
      if (sourceContainerId === containerId) return;
      
      // Если уже обрабатываем событие, пропускаем
      if (isProcessing) return;
      isProcessing = true;
      
      // Используем requestAnimationFrame вместо setTimeout для лучшей производительности
      requestAnimationFrame(() => {
        try {
          if (!chartRef.current || !chartRef.current.data || !chartRef.current.data.labels) {
            isProcessing = false;
            return;
          }
          
          // Ищем соответствующую точку по времени в этом графике
          const labels = chartRef.current.data.labels;
          let matchedIndex = -1;
          let minTimeDiff = Infinity;
          
          // Оптимизируем поиск соответствующей точки
          for (let i = 0; i < labels.length; i++) {
            const label = labels[i];
            let labelTime = null;
            
            // Извлекаем временную метку из метки
            if (label instanceof Date) {
              labelTime = label.getTime();
            } else if (typeof label === 'string' && /^\d/.test(label)) {
              try {
                labelTime = new Date(label).getTime();
              } catch (e) { /* Ignore parsing errors */ }
            } else if (typeof label === 'number') {
              labelTime = label;
            }
            
            // Если нашли точное совпадение
            if (labelTime === timestamp) {
              matchedIndex = i;
              break;
            }
            
            // Если нет точного совпадения, находим ближайшую точку
            if (labelTime && typeof labelTime === 'number' && typeof timestamp === 'number') {
              const timeDiff = Math.abs(labelTime - timestamp);
              if (timeDiff < minTimeDiff) {
                minTimeDiff = timeDiff;
                matchedIndex = i;
              }
            }
          }
          
          // Если нашли подходящую точку
          if (matchedIndex !== -1) {
            // Добавляем выделение на график
            addHighlightPoint(matchedIndex);
          }
    } finally {
          isProcessing = false;
        }
      });
    };
    
    // Обработчик сброса всех выделений
    const handleResetAllHighlights = () => {
      resetPointHighlight();
    };
    
    // Добавляем обработчики событий
    document.addEventListener('chartPointSelected', handlePointSelected);
    document.addEventListener('resetAllPointHighlights', handleResetAllHighlights);
    
    // Удаляем обработчики при размонтировании
    return () => {
      document.removeEventListener('chartPointSelected', handlePointSelected);
      document.removeEventListener('resetAllPointHighlights', handleResetAllHighlights);
    };
  }, [containerId]);

  // Функция для добавления выделения точки на график
  const addHighlightPoint = (pointIndex, datasetIndex = 0) => {
    if (!chartRef.current) return;
    
    try {
      const chart = chartRef.current;
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta || !meta.data || !meta.data[pointIndex]) return;
      
      // Сбрасываем текущие таймеры если они есть
      if (chart._highlightResetTimer) {
        clearTimeout(chart._highlightResetTimer);
        chart._highlightResetTimer = null;
      }
      
      if (chart._pulseAnimationTimer) {
        clearTimeout(chart._pulseAnimationTimer);
        chart._pulseAnimationTimer = null;
      }
      
      // Сохраняем оригинальные настройки для восстановления
      const originalRadius = chart.data.datasets[datasetIndex].pointRadius;
      const originalBackgroundColor = chart.data.datasets[datasetIndex].pointBackgroundColor;
      const originalBorderColor = chart.data.datasets[datasetIndex].pointBorderColor;
      
      // Удаляем старую фиксированную подсказку если есть
      if (chart._fixedTooltipElement) {
        chart._fixedTooltipElement.remove();
        chart._fixedTooltipElement = null;
      }
      
      // Создаем массивы для радиусов и цветов точек - оптимизируем, создавая только для одной точки
      const pointRadiusArray = Array(meta.data.length).fill(0); // Все точки невидимы
      pointRadiusArray[pointIndex] = 10; // Только выделенная точка видима и увеличенного размера
      
      const pointBackgroundColorArray = Array(meta.data.length).fill('transparent');
      pointBackgroundColorArray[pointIndex] = 'rgba(255, 0, 0, 0.9)'; // Более яркая красная точка для выделения
      
      const pointBorderColorArray = Array(meta.data.length).fill('transparent');
      pointBorderColorArray[pointIndex] = '#fff';
      
      // Применяем новые стили точек
      chart.data.datasets[datasetIndex].pointRadius = pointRadiusArray;
      chart.data.datasets[datasetIndex].pointBackgroundColor = pointBackgroundColorArray;
      chart.data.datasets[datasetIndex].pointBorderColor = pointBorderColorArray;
      
      // Оптимизированная версия пульсирующей анимации без таймеров
      // Вместо таймеров используем CSS-анимацию
      const pointElement = meta.data[pointIndex];
      
      // Только если элемент найден
      if (pointElement && pointElement.element) {
        // Используем CSS-класс для анимации
        pointElement.element.classList.add('chart-highlighted-point');
      }
      
      // Сохраняем оригинальные значения для восстановления при следующем клике
      chart._originalPointStyles = {
        radius: originalRadius,
        backgroundColor: originalBackgroundColor,
        borderColor: originalBorderColor
      };
      
      // Настраиваем активную подсказку (tooltip) для постоянного отображения
      chart.tooltip.setActiveElements([{ datasetIndex, index: pointIndex }], {
        x: pointElement.x,
        y: pointElement.y - 10 // Смещаем немного вверх
      });
      
      // Делаем подсказку постоянно видимой
      chart.options.plugins.tooltip.enabled = true;
      chart.options.plugins.tooltip.position = 'nearest';
      
      // Сохраняем позицию для обновления во время панорамирования/зума
      chart._fixedTooltipPosition = {
        datasetIndex,
        pointIndex
      };
      
      // Добавляем обработчик для события afterDraw, чтобы подсказка оставалась видимой
      chart.options.plugins.tooltip.callbacks._persistentTooltip = function(chart) {
        if (chart._fixedTooltipPosition) {
          const { datasetIndex, pointIndex } = chart._fixedTooltipPosition;
          const meta = chart.getDatasetMeta(datasetIndex);
          if (meta && meta.data && meta.data[pointIndex]) {
            const element = meta.data[pointIndex];
            chart.tooltip.setActiveElements([{ datasetIndex, index: pointIndex }], {
              x: element.x,
              y: element.y - 10
            });
            chart.tooltip.update();
          }
        }
      };
      
      // Подключаем обработчик к событию afterRender
      const originalRender = chart.draw;
      chart.draw = function() {
        originalRender.apply(this, arguments);
        if (this.options.plugins.tooltip.callbacks._persistentTooltip) {
          this.options.plugins.tooltip.callbacks._persistentTooltip(this);
        }
      };
      
      // Сохраняем информацию о текущей выделенной точке
      chart._currentHighlightedPoint = {
        datasetIndex,
        pointIndex
      };
      
      // Обновляем график без анимации для мгновенного отображения и лучшей производительности
      chart.update('none');
      
      console.log(`BaseChart: Добавлено выделение точки индекс=${pointIndex}`);
    } catch (error) {
      console.error('BaseChart: Ошибка при добавлении выделения точки:', error);
    }
  };

  // Функция для сброса выделения точек
  const resetPointHighlight = () => {
    if (!chartRef.current) return;
    
    try {
      const chart = chartRef.current;
      const originalStyles = chart._originalPointStyles;
      
      // Останавливаем анимацию пульсации
      if (chart._pulseAnimationTimer) {
        clearTimeout(chart._pulseAnimationTimer);
        chart._pulseAnimationTimer = null;
      }
      
      // Останавливаем таймер автоматического сброса
      if (chart._highlightResetTimer) {
        clearTimeout(chart._highlightResetTimer);
        chart._highlightResetTimer = null;
      }
      
      // Удаляем фиксированную подсказку если есть
      if (chart._fixedTooltipElement) {
        chart._fixedTooltipElement.remove();
        chart._fixedTooltipElement = null;
      }
      
      // Очищаем информацию о текущей выделенной точке
      if (chart._currentHighlightedPoint) {
        // Удаляем CSS-класс анимации, если есть элемент
        const { datasetIndex, pointIndex } = chart._currentHighlightedPoint;
        try {
          const meta = chart.getDatasetMeta(datasetIndex);
          if (meta && meta.data && meta.data[pointIndex] && meta.data[pointIndex].element) {
            meta.data[pointIndex].element.classList.remove('chart-highlighted-point');
          }
        } catch (e) {
          // Игнорируем ошибки при поиске элемента
        }
        
        chart._currentHighlightedPoint = null;
      }
      
      // Восстанавливаем оригинальный метод отрисовки, если был изменен
      if (chart._originalDraw) {
        chart.draw = chart._originalDraw;
        chart._originalDraw = null;
      }
      
      // Удаляем обработчик _persistentTooltip
      if (chart.options.plugins.tooltip.callbacks._persistentTooltip) {
        delete chart.options.plugins.tooltip.callbacks._persistentTooltip;
      }
      
      // Очищаем фиксированную позицию подсказки
      chart._fixedTooltipPosition = null;
      
      if (originalStyles) {
        // Восстанавливаем оригинальные стили точек
        chart.data.datasets.forEach(dataset => {
          dataset.pointRadius = originalStyles.radius;
          dataset.pointBackgroundColor = originalStyles.backgroundColor;
          dataset.pointBorderColor = originalStyles.borderColor;
        });
      }
      
      // Удаляем аннотацию вертикальной линии если есть
      if (chart.options.plugins.annotation && 
          chart.options.plugins.annotation.annotations && 
          chart.options.plugins.annotation.annotations.verticalLine) {
        delete chart.options.plugins.annotation.annotations.verticalLine;
      }
      
      // Обновляем график без анимации для лучшей производительности
      chart.update('none');
      
      // Скрываем подсказку
      if (chart.tooltip) {
        chart.tooltip.setActiveElements([], {});
        chart.update('none');
      }
      
      console.log(`BaseChart: Сброшено выделение точек`);
    } catch (error) {
      console.error('BaseChart: Ошибка при сбросе выделения точки:', error);
    }
  };

  // Добавляем настраиваемый внешний вид подсказки
  const customTooltip = {
    enabled: true,
    position: 'nearest',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    titleFont: {
      size: 14,
      family: 'Roboto, sans-serif',
      weight: 'bold'
    },
    bodyFont: {
      size: 13,
      family: 'Roboto, sans-serif'
    },
    padding: 12,
    cornerRadius: 6,
    displayColors: false,
    callbacks: {
      title: function(tooltipItems) {
        if (tooltipItems.length > 0) {
          const dateLabel = tooltipItems[0].label;
          if (dateLabel) {
            try {
              const dateObj = new Date(dateLabel);
              if (!isNaN(dateObj.getTime())) {
                return dateObj.toLocaleString('ru-RU', {
                  timeZone: 'Asia/Almaty',
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                });
              }
            } catch (e) {
              console.warn('Ошибка при форматировании времени:', e);
            }
          }
          return tooltipItems[0].label;
        }
        return '';
      },
      label: function(context) {
        const formattedValue = formatTooltipLabel(context.parsed.y);
        const label = context.dataset.label || '';
        return `${label}: ${formattedValue}`;
      },
      afterLabel: function() {
        // Добавляем дополнительную информацию в подсказку
        const reportTypeLabel = reportType || 'Н/Д';
        
        // Возвращаем только метку типа отчета, индекс убираем
        return [
          `Тип отчета: ${reportTypeLabel}`
        ];
      }
    }
  };

  // Обработчик клика по кнопке обновления
  const handleRefresh = () => {
    loadData();
  };

  // Переключение полноэкранного режима
  const toggleExpandedMode = () => {
    setExpandedMode(!expandedMode);
    // Перерисовываем график после смены режима
    setTimeout(() => {
      if (chartRef.current) {
        chartRef.current.update();
        chartRef.current.resize();
      }
    }, 200);
  };

  // Функция для сброса масштабирования
  const resetZoom = useCallback(() => {
    console.log(`BaseChart: Сброс масштабирования в контейнере ${containerId}`);
    
    if (!chartRef.current) {
      console.warn(`BaseChart: Не удалось найти ссылку на график для сброса масштаба`);
      return;
    }
    
    try {
      // Запоминаем, что сброс выполняется для предотвращения рекурсии
      const isResetting = chartRef.current._isResettingZoom;
      
      // Если уже идет сброс, не выполняем повторно
      if (isResetting) {
        console.log(`BaseChart: Сброс масштаба уже выполняется, пропускаем`);
        return;
      }
      
      // Устанавливаем флаг сброса
      chartRef.current._isResettingZoom = true;
      
      // Сбрасываем масштаб через плагин zoom
      if (chartRef.current.resetZoom) {
        console.log(`BaseChart: Вызываем resetZoom графика`);
      chartRef.current.resetZoom();
      }
      
      // Сбрасываем селекцию если она была
      if (chartRef.current.canvas) {
        chartRef.current.canvas.removeAttribute('data-selection-applied');
      }
      
      // Синхронизируем сброс масштаба через менеджер
      if (chartSyncManager && chartSyncManager.syncEnabled) {
        console.log(`BaseChart: Синхронизируем сброс масштаба через менеджер`);
        // Используем синхронизацию только если не было уже инициировано другим графиком
        chartSyncManager.resetAllZoom(containerId);
      }
      
      // Через небольшой таймаут снимаем флаг сброса
      setTimeout(() => {
        if (chartRef.current) {
          chartRef.current._isResettingZoom = false;
        }
      }, 200);
      
    } catch (error) {
      console.error(`BaseChart: Ошибка при сбросе масштаба:`, error);
      
      // В случае ошибки все равно снимаем флаг сброса
      if (chartRef.current) {
        chartRef.current._isResettingZoom = false;
      }
    }
  }, [chartRef, containerId]);

  // Экспорт графика как изображение
  const exportChart = () => {
    if (chartRef.current) {
      const link = document.createElement('a');
      link.download = `${title}-${vehicle?.name || 'unknown'}-${new Date().toISOString().split('T')[0]}.png`;
      link.href = chartRef.current.toBase64Image();
      link.click();
    }
  };

  // Переключение отображения подсказок по клавиатурным сокращениям
  const toggleKeyboardShortcuts = () => {
    setShowKeyboardShortcuts(!showKeyboardShortcuts);
  };

  // Функция для разделения экрана по горизонтали
  const handleHorizontalSplit = () => {
    // Находим контейнер перед разделением
    const container = chartContainerRef.current?.closest('.split-screen-container');
    if (!container) {
      console.error('BaseChart: Не удалось найти контейнер для разделения');
      return;
    }
    
    // Активируем контейнер
    document.querySelectorAll('.split-screen-container[data-active="true"]')
      .forEach(el => {
        el.setAttribute('data-active', 'false');
        el.classList.remove('active-container');
      });
    
    container.setAttribute('data-active', 'true');
    container.classList.add('active-container');
    
    // Получаем ID контейнера
    const targetContainerId = container.id || container.getAttribute('data-container-id');
    if (!targetContainerId) {
      console.error('BaseChart: У контейнера нет ID для разделения');
        return;
      }
      
    console.log(`BaseChart: Разделяем контейнер ${targetContainerId} горизонтально`);
    
    // Создаем пользовательское событие для запроса на разделение
    // с явным указанием целевого контейнера
    const splitEvent = new CustomEvent('requestSplit', {
      detail: {
        direction: 'horizontal',
        targetContainerId: targetContainerId,
        timestamp: Date.now(),
        processed: false // флаг обработки события
      }
    });
    
    document.dispatchEvent(splitEvent);
    
    // После отправки события закрываем выбор отчетов, если он открыт
    if (showReportChooser) {
      setShowReportChooser(false);
    }
  };

  // Функция для разделения экрана по вертикали
  const handleVerticalSplit = () => {
    // Находим контейнер перед разделением
    const container = chartContainerRef.current?.closest('.split-screen-container');
    if (!container) {
      console.error('BaseChart: Не удалось найти контейнер для разделения');
      return;
    }
    
    // Активируем контейнер
    document.querySelectorAll('.split-screen-container[data-active="true"]')
      .forEach(el => {
        el.setAttribute('data-active', 'false');
        el.classList.remove('active-container');
      });
    
    container.setAttribute('data-active', 'true');
    container.classList.add('active-container');
    
    // Получаем ID контейнера
    const targetContainerId = container.id || container.getAttribute('data-container-id');
    if (!targetContainerId) {
      console.error('BaseChart: У контейнера нет ID для разделения');
      return;
    }
    
    console.log(`BaseChart: Разделяем контейнер ${targetContainerId} вертикально`);
    
    // Создаем событие для запроса разделения по вертикали
    // с явным указанием целевого контейнера
    const splitEvent = new CustomEvent('requestSplit', {
      detail: {
        direction: 'vertical',
        targetContainerId: targetContainerId,
        timestamp: Date.now(),
        processed: false // флаг обработки события
      }
    });
    
    document.dispatchEvent(splitEvent);
    
    // После отправки события закрываем выбор отчетов, если он открыт
    if (showReportChooser) {
      setShowReportChooser(false);
    }
  };

  // Обновляем обработчик выбора отчета для поддержки выбора отчета для разделенного контейнера
  const handleReportSelect = (selectedReportType) => {
    try {
      // Закрываем выбор отчета сразу, чтобы избежать повторных вызовов
      console.log('BaseChart: handleReportSelect - закрываем окно выбора отчета');
      setShowReportChooser(false);
      // Сбрасываем глобальный флаг
      window.reportChooserModalOpen = false;
      
      if (containerToFill) {
        // Если у нас есть контейнер для заполнения из события разделения,
        // создаем отчет для этого контейнера
        console.log(`BaseChart: Создаем отчет типа ${selectedReportType} для контейнера ${containerToFill}`);
        
        // Дополнительный вывод для отладки информации о состоянии и контейнере
        console.log('BaseChart: Детали создания отчета:', { 
          containerToFill,
          vehicle,
          startDate, 
          endDate 
        });
        
        // Проверяем существование контейнера в DOM перед созданием отчета
        const targetContainer = document.getElementById(containerToFill) || 
                        document.querySelector(`[data-container-id="${containerToFill}"]`);
                        
        if (!targetContainer) {
          console.warn(`BaseChart: Целевой контейнер ${containerToFill} не найден в DOM, отмена создания отчета`);
          if (window.showNotification) {
            window.showNotification('warning', 'Контейнер для отчета не найден');
          }
          setContainerToFill(null);
          return;
        }
      
        // Создаем отчет через систему событий
        const createEvent = new CustomEvent('createReport', {
          detail: {
            reportType: selectedReportType,
            container: containerToFill,
            vehicle: vehicle,
            startDate: startDate,
            endDate: endDate,
            timestamp: Date.now(),
            // Добавляем пометку, что это важное событие
            priority: 'high'
          }
        });
        
        // Отправляем событие без задержки
            document.dispatchEvent(createEvent);
            
            // Добавляем визуальную обратную связь для подтверждения выбора отчета
            if (window.showNotification) {
              window.showNotification('success', `Отчет "${selectedReportType}" добавлен в контейнер`);
            }
        
          // Сбрасываем контейнер
          setContainerToFill(null);
        return;
      }
      
      // Проверяем, что направление разделения было установлено
      if (!splitDirection) {
        console.warn('BaseChart: Попытка разделения экрана без указания направления');
        return;
      }
      
      // Создаем событие для создания отчета в контейнере
      const createEvent = new CustomEvent('createReportInContainer', {
        detail: {
          reportType: selectedReportType,
          direction: splitDirection,
          containerId: containerId,
          vehicle: vehicle,
          startDate: startDate,
          endDate: endDate,
          timestamp: Date.now()
        }
      });
      
      document.dispatchEvent(createEvent);
      
      // Сбрасываем направление разделения
      setSplitDirection(null);
    } catch (error) {
      console.error('BaseChart: Ошибка при обработке выбора отчета:', error);
      
      // Сбрасываем глобальный флаг в случае ошибки
      window.reportChooserModalOpen = false;
      
      // Показываем ошибку в уведомлении, если доступно
      if (window.showNotification) {
        window.showNotification('error', 'Ошибка при создании отчета: ' + (error.message || 'Неизвестная ошибка'));
      }
    }
  };

  // Эффект для обновления графика после его создания или изменения размера
  useEffect(() => {
    // Флаг для отслеживания, смонтирован ли еще компонент
    let isMounted = true;
    
    const handleResize = () => {
      // Проверяем, что компонент всё ещё смонтирован
      if (!isMounted) return;
      
      if (chartRef.current && chartRef.current.chart) {
        console.log(`BaseChart: Изменение размера графика ${containerId}`);
        
        try {
          // Проверяем, что DOM-элемент графика всё ещё существует
          if (chartRef.current.canvas && document.body.contains(chartRef.current.canvas)) {
            chartRef.current.resize();
            chartRef.current.update();
          }
        } catch (error) {
          console.warn(`BaseChart: Ошибка при обновлении размера графика: ${error.message}`);
        }
      }
    };
    
    // Обрабатываем изменение размера окна
    window.addEventListener('resize', handleResize);
    
    // Также вызываем обновление через некоторое время после рендеринга, 
    // но проверяем, что компонент всё ещё смонтирован
    const resizeTimeout = setTimeout(() => {
      if (isMounted) {
        handleResize();
      }
    }, 200);
    
    // Очистка при размонтировании
    return () => {
      isMounted = false; // Устанавливаем флаг, что компонент размонтирован
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
      
      // Дополнительно проверяем, нет ли активных потоков обновления графика
      if (chartRef.current && chartRef.current.chart) {
        try {
          // В случае если был активен таймер анимации, останавливаем его
          if (chartRef.current.chart.animating) {
            chartRef.current.chart.stop();
          }
          
          // Уничтожаем экземпляр графика для освобождения ресурсов
          chartRef.current.destroy();
        } catch (e) {
          console.warn(`BaseChart: Ошибка при уничтожении графика: ${e.message}`);
        }
      }
    };
  }, [containerId, chartData]);

  // Закрытие окна выбора отчета
  const handleReportChooserClose = () => {
    console.log('BaseChart: Закрытие окна выбора отчета');
    setShowReportChooser(false);
    setSplitDirection(null);
    setContainerToFill(null); // Сбрасываем контейнер для заполнения
    
    // Сбрасываем глобальный флаг
    window.reportChooserModalOpen = false;
    
    console.log('BaseChart: Окно выбора отчета должно быть закрыто, showReportChooser =', false);
  };

  // Определение опций для графика
  const getChartOptions = () => {
    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      resizeDelay: 100, // Задержка перед изменением размера для плавности
      devicePixelRatio: window.devicePixelRatio || 1, // Для более четкого рендеринга на ретина-дисплеях
      elements: {
        point: {
          radius: 2, // Маленькие точки вместо 0, чтобы их можно было выбрать
          hitRadius: 10, // Область для взаимодействия
          hoverRadius: 5, // Размер точки при наведении
        },
        line: {
          tension: 0, // Линии без сглаживания для получения прямых отрезков
          borderWidth: 2, // Толщина линии
        }
      },
      layout: {
        padding: {
          top: 10,
          right: 10,
          bottom: 10,
          left: 10
        },
        autoPadding: true
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: {
              size: 12,
              family: 'Roboto, sans-serif'
            },
            usePointStyle: true,
            padding: 15
          }
        },
        title: {
          display: false, // Отключаем внутренний заголовок, т.к. у нас есть заголовок вне графика
          font: {
            size: 16,
            family: 'Roboto, sans-serif',
            weight: 'bold'
          },
          padding: {
            top: 5,
            bottom: 5
          }
        },
        tooltip: customTooltip,
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
                
                // Если есть метки времени, сохраняем также диапазон выделения по времени
                if (chart.data && chart.data.labels && chart.data.labels.length > 0) {
                  // Определяем временные границы выделения
                  const minIndex = Math.floor(xAxis.min);
                  const maxIndex = Math.ceil(xAxis.max);
                  
                  // Безопасно получаем метки времени
                  if (minIndex >= 0 && maxIndex < chart.data.labels.length) {
                    const minLabel = chart.data.labels[minIndex];
                    const maxLabel = chart.data.labels[maxIndex];
                    
                    // Если метки это даты, сохраняем их как диапазон выделения
                    if (minLabel instanceof Date && maxLabel instanceof Date) {
                      const selectionData = {
                        startDate: minLabel,
                        endDate: maxLabel,
                        startIndex: minIndex,
                        endIndex: maxIndex
                      };
                      
                      // Отправляем событие выделения
                      notifySelectionChanged(selectionData);
                    }
                  }
                }
                
                // Отправляем событие синхронизации зума
                chartSyncManager.syncZoom(containerId, range);
              }
            }
          },
          resetSpeed: 0 // Мгновенное возвращение к исходному масштабу
        }
      },
      scales: {
        x: {
          ticks: {
            maxRotation: 45,
            minRotation: 0,
            autoSkip: true,
            maxTicksLimit: 20,
            // eslint-disable-next-line no-unused-vars
            callback: function(value, index, values) {
              return formatXAxisLabel(this.getLabelForValue(value));
            }
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          },
          // Настройки для отображения подписей времени в казахстанском формате
          adapters: {
            date: {
              locale: 'ru',
              zone: 'Asia/Almaty'
            }
          }
        },
        y: {
          title: {
            display: true,
            text: yAxisLabel,
            font: {
              size: 14,
              family: 'Roboto, sans-serif'
            }
          },
          ticks: {
            callback: function(value) {
              return formatYAxisLabel(value);
            }
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          },
          // Отключаем зум по оси Y
          beginAtZero: true,
          grace: '10%'
        }
      },
      interaction: {
        mode: 'index',
        intersect: false
      },
      animation: {
        duration: 300 // Ускоряем анимацию для более отзывчивого UI
      }
    };
    
    return baseOptions;
  };

  // Получение классов контейнера
  const getContainerClasses = () => {
    return `chart-container ${expandedMode ? 'expanded' : ''} ${isLoading ? 'loading' : ''}`;
  };

  // Эффект для сброса глобального флага при размонтировании компонента 
  // если окно было открыто в этом экземпляре
  useEffect(() => {
    return () => {
      if (showReportChooser && window.reportChooserModalOpen) {
        console.log('BaseChart: Сброс глобального флага reportChooserModalOpen при размонтировании');
        window.reportChooserModalOpen = false;
      }
    };
  }, [showReportChooser]);

  // Отрисовка содержимого графика
  const renderChartContent = () => {
    return (
      <>
        <div className="tm-header">
          <div className="tm-title">
            <FontAwesomeIcon icon={faTruck} style={{ marginRight: '8px' }} /> 
            <span>{title} {vehicle && vehicle.name ? `- ${vehicle.name}` : ''}</span>
          </div>
          <div className="tm-controls">
            <div className="tm-control-group">
              <button
                className="tm-control-button"
                onClick={resetZoom}
                title="Сбросить увеличение (Esc, Пробел или Ctrl+0)"
              >
                <FontAwesomeIcon icon={faSearchMinus} />
              </button>
              <button
                className="tm-control-button"
                onClick={toggleKeyboardShortcuts}
                title="Показать горячие клавиши"
              >
                <FontAwesomeIcon icon={faKeyboard} />
              </button>
              <button
                className="tm-control-button"
                onClick={handleRefresh}
                title="Обновить данные"
              >
                <FontAwesomeIcon icon={faSyncAlt} />
              </button>
            </div>
            
            {/* Группа кнопок разделения экрана */}
            <div className="tm-control-group">
              <button
                className="tm-control-button"
                onClick={handleHorizontalSplit}
                title="Разделить по горизонтали"
              >
                <FontAwesomeIcon icon={faColumns} style={{ transform: 'rotate(90deg)' }} />
              </button>
              <button
                className="tm-control-button"
                onClick={handleVerticalSplit}
                title="Разделить по вертикали"
              >
                <FontAwesomeIcon icon={faColumns} />
              </button>
              <button
                className="tm-control-button"
                onClick={() => splitScreenManager.changeSplitMode(SPLIT_MODES.SINGLE)}
                title="Один экран"
              >
                <FontAwesomeIcon icon={faWindowRestore} />
              </button>
              <button
                className="tm-control-button"
                onClick={() => splitScreenManager.goBack()}
                title="Вернуться к предыдущему режиму"
              >
                <FontAwesomeIcon icon={faRedo} style={{ transform: 'rotate(180deg)' }} />
              </button>
            </div>
            
            <div className="tm-control-group">
              <button
                className="tm-control-button"
                onClick={exportChart}
                title="Скачать изображение"
              >
                <FontAwesomeIcon icon={faDownload} />
              </button>
            </div>
            <div className="tm-control-group">
              <button
                className="tm-control-button"
                onClick={toggleExpandedMode}
                title={expandedMode ? "Свернуть" : "На весь экран"}
              >
                <FontAwesomeIcon icon={expandedMode ? faCompress : faExpand} />
              </button>
            </div>
            <div className="tm-control-group">
              <button
                className={`tm-control-button ${chartSyncManager.syncEnabled ? 'sync-active' : 'sync-inactive'}`}
                onClick={toggleSyncMode}
                title="Включить/выключить синхронизацию масштабирования между графиками"
              >
                <FontAwesomeIcon icon={chartSyncManager.syncEnabled ? faLink : faUnlink} />
              </button>
            </div>
          </div>
        </div>
        
        {showKeyboardShortcuts && (
          <div className="keyboard-shortcuts-tooltip" 
               style={{
                 position: 'absolute',
                 top: '50px',
                 right: '10px',
                 background: 'rgba(0, 0, 0, 0.8)',
                 color: 'white',
                 padding: '10px',
                 borderRadius: '5px',
                 zIndex: 1000,
                 fontSize: '12px',
                 boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)'
               }}>
            <div style={{fontWeight: 'bold', marginBottom: '5px'}}>Горячие клавиши:</div>
            <div>Esc - сбросить масштаб</div>
            <div>Пробел - сбросить масштаб</div>
            <div>Ctrl+0 - сбросить масштаб</div>
            <div>Shift+прокрутка - перемещение по графику</div>
            <div>Колесо мыши - изменение масштаба</div>
            <div style={{marginTop: '5px', fontWeight: 'bold', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '5px'}}>Синхронизация:</div>
            <div>Масштабирование синхронизировано между всеми графиками</div>
            <div>Используйте кнопку <FontAwesomeIcon icon={chartSyncManager.syncEnabled ? faLink : faUnlink} /> для включения/выключения</div>
            <div style={{marginTop: '5px', textAlign: 'center'}}>
              <button onClick={toggleKeyboardShortcuts} 
                      style={{background: 'transparent', border: '1px solid white', color: 'white', padding: '2px 5px', cursor: 'pointer'}}>
                Закрыть
              </button>
            </div>
          </div>
        )}
        
        <div 
          className="chart-content" 
          ref={chartContainerRef}
          style={{
            width: '100%',
            height: 'calc(100% - 50px)', // Вычитаем высоту заголовка
            position: 'relative', 
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {isLoading ? (
            <div className="chart-loading">
              <div className="chart-spinner"></div>
              <div>Загрузка данных...</div>
            </div>
          ) : error ? (
            <div className="chart-error">
              <div>{error}</div>
              <button onClick={handleRefresh}>Попробовать снова</button>
            </div>
          ) : chartData && chartData.labels && chartData.labels.length > 0 ? (
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
              <Line
                data={chartData}
                options={getChartOptions()}
                ref={chartRef}
                style={{ width: '100%', height: '100%' }}
              />

              
            </div>
          ) : (
            <div className="chart-empty">
              <div>{emptyDataMessage}</div>
              <button onClick={handleRefresh}>Обновить</button>
            </div>
          )}
        </div>
      </>
    );
  };

  // Добавляем определение функции toggleSyncMode
  const toggleSyncMode = () => {
    const isEnabled = chartSyncManager.toggleSync();
    // Оповещаем пользователя о состоянии синхронизации
    toast.info(
      isEnabled 
        ? 'Синхронизация масштабирования включена' 
        : 'Синхронизация масштабирования отключена',
      { autoClose: 1500 }
    );
  };

  // Функция для регистрации графика в менеджере синхронизации
  const registerChart = useCallback(() => {
    if (!chartRef.current) {
      console.log(`BaseChart: Невозможно зарегистрировать график - chartRef не инициализирован`);
      return;
    }

    const canvas = chartRef.current.canvas;
    if (!canvas) {
      console.log(`BaseChart: Невозможно зарегистрировать график - canvas не найден`);
      return;
    }

    console.log(`BaseChart: Регистрация графика ${containerId} в менеджере синхронизации`);
    
    // Устанавливаем атрибуты для идентификации графика
    canvas.setAttribute('data-graph', 'true');
    canvas.setAttribute('data-container-id', containerId);
    
    // Проверяем, находится ли график в разделенном контейнере
    const isInSplitContainer = containerId.includes('-');
    
    if (isInSplitContainer) {
      const baseContainerId = containerId.split('-')[0];
      canvas.setAttribute('data-parent-container', baseContainerId);
      
      // Получаем группу синхронизации из контейнера или создаем новую
      const container = chartContainerRef.current?.closest('.split-screen-container');
      const containerSyncGroupId = container?.getAttribute('data-sync-group') || `sync-${containerId}`;
      
      // Устанавливаем syncGroupId
      setSyncGroupId(containerSyncGroupId);
      
      // Добавляем информацию о группе синхронизации
      canvas.setAttribute('data-sync-group', containerSyncGroupId);
      
      console.log(`BaseChart: График в разделенном контейнере ${containerId} инициализирован, родитель: ${baseContainerId}, группа: ${containerSyncGroupId}`);
      
      // Отправляем событие о готовности графика в разделенном контейнере
      document.dispatchEvent(new CustomEvent('splitChartInitialized', {
        detail: {
          containerId,
          baseContainerId,
          syncGroupId: containerSyncGroupId,
          timestamp: Date.now()
        }
      }));
    }
    
    // Регистрируем график в chartSyncManager
    if (chartSyncManager) {
      // Добавляем прямой доступ к экземпляру графика через canvas
      // для совместимости с разными версиями библиотеки
      canvas.__chartjs__ = chartRef.current;
      canvas.__chartInstance = chartRef.current;
      
      // Регистрируем график в менеджере синхронизации
      chartSyncManager.registerChart(containerId, chartRef.current);
      
      // Применяем сохраненное выделение, если есть
      const savedSelection = chartSyncManager.lastSelectionRange;
      if (savedSelection) {
        console.log(`BaseChart: Применяем сохраненное выделение к графику ${containerId}`, savedSelection);
        setTimeout(() => {
          if (chartRef.current && !chartRef.current.isDestroyed) {
            // Используем существующую функцию applySelectionToChart вместо несуществующей applySelection
            applySelectionToChart(savedSelection);
          }
        }, 100);
      }
    } else {
      console.warn(`BaseChart: chartSyncManager не найден, синхронизация не будет работать`);
    }
  }, [containerId, chartRef, chartContainerRef, setSyncGroupId]);

  // Эффект для регистрации графика в менеджере синхронизации
  useEffect(() => {
    let registrationTimeout = null;
    let chartRegistered = false;
    
    const registerChartWithRetry = () => {
      // Проверяем, что график инициализирован
      if (chartRef.current && chartRef.current.canvas) {
        if (!chartRegistered) {
          console.log(`BaseChart: Регистрируем график ${containerId} в менеджере синхронизации`);
          registerChart();
          chartRegistered = true;
          
          // Отправляем событие, что график инициализирован
          document.dispatchEvent(new CustomEvent('chartInitialized', {
            detail: {
              containerId,
              timestamp: Date.now()
            }
          }));
        }
      } else {
        // Если график еще не инициализирован, пробуем еще раз через некоторое время
        console.log(`BaseChart: График ${containerId} еще не готов, пробуем еще раз через 100мс`);
        registrationTimeout = setTimeout(registerChartWithRetry, 100);
      }
    };
    
    // Запускаем процесс регистрации с ретраями
    registerChartWithRetry();
    
    // Серия ретраев для гарантированной регистрации
    const retryTimeouts = [300, 600, 1000];
    
    const retryRegistrations = retryTimeouts.map((timeout, index) => {
      return setTimeout(() => {
        if (chartRef.current && !chartRef.current.isDestroyed) {
          console.log(`BaseChart: Повторная проверка регистрации графика ${containerId} (попытка ${index + 1})`);
          registerChart();
        }
      }, timeout);
    });
    
    // Очистка при размонтировании
    return () => {
      clearTimeout(registrationTimeout);
      retryRegistrations.forEach(clearTimeout);
      
      // Освобождаем ресурсы графика
      if (chartRef.current) {
        if (chartSyncManager) {
          console.log(`BaseChart: Удаляем график ${containerId} из менеджера синхронизации`);
          chartSyncManager.unregisterChart(containerId);
        }
        
        try {
          if (chartRef.current.destroy && !chartRef.current.isDestroyed) {
            chartRef.current.destroy();
          }
        } catch (e) {
          console.warn(`BaseChart: Ошибка при уничтожении графика ${containerId}:`, e);
        }
      }
    };
  }, [containerId, registerChart, chartRef]);

  // Функция для получения точек данных графика
  const getDataPoints = useCallback(() => {
    if (!chartRef.current || !chartRef.current.data || !chartRef.current.data.datasets || !chartRef.current.data.labels) {
      return [];
    }
    
    const dataset = chartRef.current.data.datasets[0];
    const labels = chartRef.current.data.labels;
    
    if (!dataset || !dataset.data || !labels) {
      return [];
    }
    
    return dataset.data.map((y, index) => {
      // Если labels - массив дат, используем их
      let x = labels[index];
      // Если x не является датой, пробуем преобразовать
      if (!(x instanceof Date) && typeof x === 'string') {
        try {
          x = new Date(x);
        } catch (e) {
          // Если не удалось преобразовать, оставляем как есть
          console.log(`BaseChart: Не удалось преобразовать метку ${x} в дату`);
        }
      }
      
      return { x, y, index };
    });
  }, [chartRef]);

  // Обработчик события выделения
  const handleSelection = useCallback((startIndex, endIndex) => {
    if (startIndex === undefined || endIndex === undefined) return;
    
    // Получаем данные точек
    const dataPoints = getDataPoints();
    if (!dataPoints || dataPoints.length === 0) return;
    
    // Получаем начальную и конечную точки выделения
    const startPoint = dataPoints[Math.max(0, startIndex)];
    const endPoint = dataPoints[Math.min(dataPoints.length - 1, endIndex)];
    
    if (!startPoint || !endPoint) return;
    
    // Конвертируем индексы в даты (для временных графиков)
    const startDate = startPoint.x instanceof Date ? startPoint.x : 
                      typeof startPoint.x === 'number' ? new Date(startPoint.x) : null;
    const endDate = endPoint.x instanceof Date ? endPoint.x : 
                    typeof endPoint.x === 'number' ? new Date(endPoint.x) : null;
    
    // Создаем объект с данными выделения
    const selectionData = {
      startDate,
      endDate,
      startIndex,
      endIndex
    };
    
    console.log(`BaseChart: Отправка уведомления о выделении, syncGroupId: ${syncGroupId}`);
    
    // Обрабатываем выделение различными способами для максимальной совместимости
    
    // 1. Устанавливаем выделение через ChartSyncManager
    if (chartSyncManager) {
      // Сохраняем выделение в менеджере синхронизации
      chartSyncManager.saveSelectionFromChart(containerId);
      
      // Применяем выделение ко всем связанным графикам через менеджер
      chartSyncManager.syncSelection(containerId, {
        min: startDate ? startDate.getTime() : startIndex,
        max: endDate ? endDate.getTime() : endIndex
      });
    }
    
    // 2. Отправляем событие о выделении напрямую родителю, если это разделенный контейнер
    if (containerId && containerId.includes('-')) {
      const baseContainerId = containerId.split('-')[0];
      
      // Отправляем событие выделения к родительскому контейнеру
      console.log(`BaseChart: Отправляем событие выделения к родительскому контейнеру ${baseContainerId}`);
      document.dispatchEvent(new CustomEvent('childGraphSelection', {
        detail: {
          childId: containerId,
          parentId: baseContainerId,
          syncGroupId,
          selectionData
        }
      }));
    }
    
    // 3. Отправляем дополнительное событие для обработки другими компонентами
    document.dispatchEvent(new CustomEvent('chartSelectionChanged', {
      detail: {
        sourceContainerId: containerId,
        selectionData,
        syncGroupId: syncGroupId || 'default'
      }
    }));
    
  }, [getDataPoints, containerId, syncGroupId]);

  // Функция загрузки данных
  const loadData = async () => {
    if (!vehicle || !startDate || !endDate) {
      setError('Не выбран транспорт или период');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await fetchData();
    } catch (err) {
      console.error(`Ошибка при загрузке данных для графика ${title}:`, err);
      setError(`Ошибка при загрузке данных: ${err.message || 'Неизвестная ошибка'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Функция для отправки события выделения в SplitScreenContainer
  const notifySelectionChanged = (selectionData) => {
    // Получаем контейнер с графиком
    const container = chartContainerRef.current?.closest('.split-screen-container');
    if (!container) {
      console.warn(`BaseChart: Не удалось найти контейнер для уведомления о выделении`);
      return;
    }
    
    const syncGroupId = container.getAttribute('data-sync-group');
    console.log(`BaseChart: Отправка уведомления о выделении, syncGroupId: ${syncGroupId || 'нет'}`);
    
    // Проверяем, есть ли у контейнера атрибут data-sync-selection
    const shouldSync = container.getAttribute('data-sync-selection') !== 'false';
    if (!shouldSync) {
      console.log(`BaseChart: Синхронизация выделений отключена для контейнера ${containerId}`);
      return;
    }
    
    // Если есть API через __reactInstance, используем его
    if (container.__reactInstance && container.__reactInstance.notifySelectionChanged) {
      console.log(`BaseChart: Уведомляем SplitScreenContainer о выделении через API`);
      container.__reactInstance.notifySelectionChanged(selectionData);
      
      // Также отправляем DOM-событие для обработки другими компонентами
      const containerEvent = new CustomEvent('selectionChanged', {
        detail: {
          selectionData,
          containerId: container.id || container.getAttribute('data-container-id')
        }
      });
      container.dispatchEvent(containerEvent);
      return;
    }
    
    // Если нет прямого API, отправляем событие
    console.log(`BaseChart: Уведомляем о выделении через событие graphSelectionChanged`);
    const event = new CustomEvent('graphSelectionChanged', {
      detail: {
        sourceContainerId: containerId,
        selectionData,
        syncGroupId,
        timestamp: Date.now()
      }
    });
    document.dispatchEvent(event);
    
    // Дополнительно, отправляем специальное событие для локальной обработки в контейнере
    const containerEvent = new CustomEvent('selectionChanged', {
      detail: {
        selectionData,
        containerId: container.id || container.getAttribute('data-container-id')
      }
    });
    container.dispatchEvent(containerEvent);
    
    // Отображаем подсказку пользователю о выделении (если функция доступна)
    if (window.showNotification) {
      let message = 'Выделение применено';
      if (selectionData.startDate && selectionData.endDate) {
        // Форматируем даты для отображения
        const startDate = new Date(selectionData.startDate);
        const endDate = new Date(selectionData.endDate);
        const options = { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' };
        message = `Выделено: ${startDate.toLocaleString('ru-RU', options)} - ${endDate.toLocaleString('ru-RU', options)}`;
      }
      window.showNotification('info', message, { autoClose: 1500 });
    }
  };

  // Эффект для обработки глобальной синхронизации выделения между всеми графиками
  useEffect(() => {
    const handleGlobalSelectionSync = (event) => {
      const { sourceContainerId, syncGroupId, selectionData } = event.detail;
      
      // Пропускаем обработку события от самого себя
      if (sourceContainerId === containerId) return;
      
      // Проверяем, соответствует ли график текущей группе синхронизации
      const containerSyncGroupId = chartContainerRef.current?.closest('.split-screen-container')?.getAttribute('data-sync-group');
      
      // Если указана группа синхронизации, проверяем соответствие
      if (syncGroupId && containerSyncGroupId && syncGroupId !== containerSyncGroupId) {
        console.log(`BaseChart: Пропускаем применение выделения - не совпадают группы синхронизации (${syncGroupId} != ${containerSyncGroupId})`);
        return;
      }
      
      console.log(`BaseChart: Получено глобальное событие синхронизации выделения от ${sourceContainerId}`);
      
      // Применяем выделение к графику
      if (selectionData) {
        console.log(`BaseChart: Применяем выделение к графику ${containerId}:`, selectionData);
        applySelectionToChart(selectionData);
      }
    };
    
    // Регистрируем обработчик события глобальной синхронизации
    document.addEventListener('globalSelectionSync', handleGlobalSelectionSync);
    
    return () => {
      document.removeEventListener('globalSelectionSync', handleGlobalSelectionSync);
    };
  }, [containerId, applySelectionToChart]);

  // Рендер компонента
  return (
    <div 
      className={getContainerClasses()} 
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
      onClick={handleChartClick}
    >
      <SplitScreenContainer 
        id={containerId}
        data-container-id={containerId}
        className="chart-split-container"
        showControls={true}
        allowSplit={true}
        onSplitChange={(splitInfo) => {
          console.log('BaseChart: Получено событие разделения экрана', splitInfo);
          // После разделения обновим график
          setTimeout(() => {
            if (chartRef.current && chartRef.current.chart) {
              chartRef.current.resize();
              chartRef.current.update();
            }
          }, 200);
        }}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {renderChartContent()}
      </SplitScreenContainer>
      
      {/* Модальное окно выбора отчета - выносим за пределы SplitScreenContainer */}
      {/* Используем порталы React для рендеринга модального окна в корне DOM, 
          чтобы избежать проблем с вложенными контейнерами */}
      {showReportChooser ? (
        <ReportChooser 
          onSelectReport={handleReportSelect}
          onClose={handleReportChooserClose}
          selectedVehicle={vehicle}
          originalReport={reportType}
          containerId={containerId}
        />
      ) : null}
    </div>
  );
};

export default BaseChart; 