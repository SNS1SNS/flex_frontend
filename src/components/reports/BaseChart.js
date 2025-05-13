import React, { useState, useEffect, useRef } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSyncAlt, faDownload, faExpand, faCompress, faTruck, faColumns, faWindowRestore, faRedo, faSearchMinus, faKeyboard } from '@fortawesome/free-solid-svg-icons';
import SplitScreenContainer from '../common/SplitScreenContainer';
import splitScreenManager, { SPLIT_MODES } from '../../utils/SplitScreenManager';
import ReportChooser from './ReportChooser';
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
  zoomPlugin
);

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
      
      // Проверяем, что модальное окно еще не открыто и флаг не установлен
      if (showReportChooser || modalRequested) {
        console.log(`BaseChart: Пропускаем повторный запрос выбора отчета, так как модальное окно уже ${showReportChooser ? 'открыто' : 'запрошено'}`);
        return;
      }
      
      // Устанавливаем флаг, что запрос обработан
      modalRequested = true;
      
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

  // Сброс увеличения (зума) графика
  const resetZoom = () => {
    if (chartRef.current) {
      // Отключаем анимацию на время сброса зума
      const currentAnimation = chartRef.current.options.animation;
      chartRef.current.options.animation = false;
      
      // Сбрасываем зум и немедленно обновляем
      chartRef.current.resetZoom();
      chartRef.current.update('none'); // 'none' для мгновенного обновления
      
      // Восстанавливаем анимацию
      setTimeout(() => {
        if (chartRef.current) {
          chartRef.current.options.animation = currentAnimation;
        }
      }, 50);
    }
  };

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

  // Обработчик клика по графику для активации контейнера
  const handleChartClick = () => {
    // Получаем родительский контейнер графика
    const container = chartContainerRef.current?.closest('.split-screen-container');
    
    if (container) {
      // Сначала снимаем активность со всех контейнеров
      document.querySelectorAll('.split-screen-container[data-active="true"]')
        .forEach(el => {
          el.setAttribute('data-active', 'false');
          el.classList.remove('active-container');
        });
      
      // Активируем наш контейнер
      container.setAttribute('data-active', 'true');
      container.classList.add('active-container');
      
      console.log(`BaseChart: Активирован контейнер ${container.id}`);
    }
    
    // Не останавливаем распространение события
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
      // Закрываем выбор отчета
      console.log('BaseChart: handleReportSelect - закрываем окно выбора отчета');
      setShowReportChooser(false);
      
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
        
        // Небольшая задержка перед отправкой события для гарантии готовности DOM
        setTimeout(() => {
          // Повторно проверяем, что контейнер всё ещё существует
          if (document.getElementById(containerToFill) || 
              document.querySelector(`[data-container-id="${containerToFill}"]`)) {
            
            document.dispatchEvent(createEvent);
            
            // Добавляем визуальную обратную связь для подтверждения выбора отчета
            if (window.showNotification) {
              window.showNotification('success', `Отчет "${selectedReportType}" добавлен в контейнер`);
            }
          } else {
            console.warn(`BaseChart: Контейнер ${containerToFill} был удален за время создания отчета`);
            if (window.showNotification) {
              window.showNotification('warning', 'Не удалось добавить отчет: контейнер был удален');
            }
          }
          // Сбрасываем контейнер
          setContainerToFill(null);
        }, 100);
        
        return;
      }
      
      // Проверяем, что направление разделения было установлено
      if (!splitDirection) {
        console.warn('BaseChart: Попытка разделения экрана без указания направления');
        return;
      }
      
      // В этой версии мы не ищем контейнер напрямую, т.к. использование React root
      // для создания компонентов в произвольных DOM-элементах может вызвать ошибки
      // Вместо этого используем событие для сообщения родительскому компоненту
      
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
    console.log('BaseChart: Окно выбора отчета должно быть закрыто, showReportChooser =', false);
  };

  // Определение опций для графика
  const getChartOptions = () => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      resizeDelay: 100, // Задержка перед изменением размера для плавности
      devicePixelRatio: window.devicePixelRatio || 1, // Для более четкого рендеринга на ретина-дисплеях
      elements: {
        point: {
          radius: 0, // Отключаем точки полностью
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
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleFont: {
            size: 13,
            family: 'Roboto, sans-serif'
          },
          bodyFont: {
            size: 12,
            family: 'Roboto, sans-serif'
          },
          padding: 12,
          cornerRadius: 6,
          callbacks: {
            label: function(context) {
              return formatTooltipLabel(context.parsed.y);
            },
            title: function(tooltipItems) {
              // Форматируем время для подсказки в казахстанском формате
              if (tooltipItems.length > 0) {
                const date = tooltipItems[0].label;
                if (date) {
                  try {
                    const dateObj = new Date(date);
                    if (!isNaN(dateObj.getTime())) {
                      return dateObj.toLocaleString('ru-RU', {
                        timeZone: 'Asia/Almaty',
                        day: 'numeric',
                        month: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      });
                    }
                  } catch (e) {
                    console.warn('Ошибка при форматировании времени:', e);
                  }
                }
                return tooltipItems[0].label;
              }
              return '';
            }
          }
        },
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
          },
          // Мгновенное обновление при сбросе зума
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
  };

  // Формируем классы в зависимости от режима
  const getContainerClasses = () => {
    let classes = 'chart-container';
    
    if (expandedMode) {
      classes += ' tm-expanded';
    }
    
    return classes;
  };

  // Содержимое графика
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