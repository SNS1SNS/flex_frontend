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
  
  // Эффект для сброса состояния при размонтировании
  useEffect(() => {
    return () => {
      // Очистка при размонтировании компонента
      console.log(`BaseChart: Компонент с ID ${containerId} размонтирован`);
      // Сбрасываем состояние модального окна выбора отчета
      setShowReportChooser(false);
    };
  }, [containerId]);

  // Эффект для гарантированного закрытия модального окна
  useEffect(() => {
    // Если модальное окно открыто, регистрируем обработчики для гарантированного закрытия
    if (showReportChooser) {
      console.log('BaseChart: Модальное окно открыто, регистрируем обработчики закрытия');
      
      // Функция для проверки и закрытия модального окна
      const forceCloseModal = () => {
        if (showReportChooser) {
          console.log('BaseChart: Принудительное закрытие модального окна');
          setShowReportChooser(false);
          setSplitDirection(null);
        }
      };
      
      // Таймаут для закрытия окна через 10 секунд (защита от зависания)
      const closeTimeout = setTimeout(forceCloseModal, 10000);
      
      return () => {
        // Очистка таймаута при размонтировании эффекта
        clearTimeout(closeTimeout);
      };
    }
  }, [showReportChooser]);

  // Вывод в консоль при изменении состояния showReportChooser
  useEffect(() => {
    console.log(`BaseChart: Изменилось состояние showReportChooser = ${showReportChooser}`);
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

  // Обработчик изменения режима разделения экрана
  const handleSplitModeChange = () => {
    // Перерисовываем график после изменения режима
    setTimeout(() => {
      if (chartRef.current) {
        chartRef.current.update();
        chartRef.current.resize();
      }
    }, 250);
  };

  // Переключение отображения подсказок по клавиатурным сокращениям
  const toggleKeyboardShortcuts = () => {
    setShowKeyboardShortcuts(!showKeyboardShortcuts);
  };

  // Функция для разделения экрана по горизонтали
  const handleHorizontalSplit = () => {
    setSplitDirection('horizontal');
    setShowReportChooser(true);
  };

  // Функция для разделения экрана по вертикали
  const handleVerticalSplit = () => {
    setSplitDirection('vertical');
    setShowReportChooser(true);
  };

  // Обработчик выбора отчета для разделенного экрана
  const handleReportSelect = (selectedReportType) => {
    try {
      // Закрываем выбор отчета
      console.log('BaseChart: handleReportSelect - закрываем окно выбора отчета');
      setShowReportChooser(false);
      
      // Проверяем, что направление разделения было установлено
      if (!splitDirection) {
        console.warn('BaseChart: Попытка разделения экрана без указания направления');
        return;
      }
      
      // Ищем контейнер с более надежной стратегией
      let containerElement = null;
      
      // Стратегия 1: Поиск по ID напрямую
      containerElement = document.getElementById(containerId);
      
      // Стратегия 2: Поиск через ref и его родителя
      if (!containerElement && chartContainerRef.current) {
        const parentContainer = chartContainerRef.current.closest('.chart-split-container');
        if (parentContainer) {
          console.log(`BaseChart: Найден родительский контейнер через ref: ${parentContainer.id || 'без ID'}`);
          
          // Устанавливаем ID, чтобы гарантировать, что он доступен
          if (!parentContainer.id) {
            parentContainer.id = containerId;
            console.log(`BaseChart: Установлен ID ${containerId} на родительский контейнер`);
          }
          
          containerElement = parentContainer;
        }
      }
      
      // Стратегия 3: Поиск по атрибуту data-container-id
      if (!containerElement) {
        const containers = document.querySelectorAll(`[data-container-id="${containerId}"]`);
        if (containers.length > 0) {
          console.log(`BaseChart: Найден контейнер по data-container-id: ${containerId}`);
          containerElement = containers[0];
        }
      }
      
      // Если все стратегии не помогли найти контейнер
      if (!containerElement) {
        console.error(`BaseChart: Критическая ошибка - не удалось найти подходящий контейнер для разделения`);
        setError('Не удалось разделить экран. Пожалуйста, попробуйте ещё раз или обновите страницу.');
        return;
      }
      
      // Используем ID найденного контейнера, который может отличаться от исходного containerId
      const actualContainerId = containerElement.id;
      console.log(`BaseChart: Разделение контейнера ${actualContainerId} по направлению ${splitDirection}`);
      
      try {
        // Добавляем обработчик события завершения разделения контейнера
        const handleSplitComplete = (event) => {
          const { containerId, container2Id } = event.detail;
          
          // Проверяем, что событие относится к нашему контейнеру
          if (containerId === actualContainerId) {
            console.log(`BaseChart: Получено событие завершения разделения для контейнера ${containerId}, второй контейнер: ${container2Id}`);
            
            // Ждем, чтобы DOM обновился и React отрендерил компоненты
            // Используем функцию для ожидания второго контейнера
            waitForSecondContainer(container2Id, selectedReportType);
          }
          
          // Удаляем обработчик после использования
          document.removeEventListener('splitContainerComplete', handleSplitComplete);
        };
        
        // Добавляем обработчик события завершения разделения
        document.addEventListener('splitContainerComplete', handleSplitComplete);
        
        // Разделяем экран через менеджер разделения
        const success = splitScreenManager.addDynamicSplit(actualContainerId, splitDirection);
        
        if (!success) {
          console.error(`BaseChart: Не удалось разделить контейнер ${actualContainerId}`);
          setError('Не удалось разделить экран. Пожалуйста, попробуйте ещё раз.');
          
          // Удаляем обработчик, если разделение не удалось
          document.removeEventListener('splitContainerComplete', handleSplitComplete);
        }
        
        // Сброс направления разделения
        setSplitDirection(null);
      } catch (error) {
        console.error(`BaseChart: Ошибка при разделении экрана:`, error);
        setError(`Ошибка при разделении экрана: ${error.message}`);
      }
    } catch (outerError) {
      console.error('BaseChart: Критическая ошибка в handleReportSelect:', outerError);
      // Обязательно закрываем окно выбора отчета даже при ошибке
      setShowReportChooser(false);
      setSplitDirection(null);
    }
  };

  // Функция для ожидания создания второго контейнера
  const waitForSecondContainer = (container2Id, selectedReportType, attempt = 0) => {
    const maxAttempts = 10;
    const secondContainer = document.getElementById(container2Id);
    
    if (secondContainer) {
      console.log(`BaseChart: Контейнер ${container2Id} найден, создаём отчет типа ${selectedReportType}`);
      
      // Создаем отчет через систему событий
      const createEvent = new CustomEvent('createReport', {
        detail: {
          reportType: selectedReportType,
          container: container2Id,
          vehicle: vehicle,
          startDate: startDate,
          endDate: endDate,
          timestamp: Date.now() // Добавляем временную метку для уникальности событий
        }
      });
      
      document.dispatchEvent(createEvent);
      
      // Вызываем обновление графиков через некоторое время
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 500);
      
      return true;
    } else if (attempt < maxAttempts) {
      // Повторяем попытку с задержкой
      console.log(`BaseChart: Попытка ${attempt + 1}/${maxAttempts} найти контейнер ${container2Id}`);
      setTimeout(() => {
        waitForSecondContainer(container2Id, selectedReportType, attempt + 1);
      }, 100);
    } else {
      console.error(`BaseChart: Не удалось найти контейнер ${container2Id} после ${maxAttempts} попыток`);
      setError(`Не удалось создать второй контейнер для отчета. Пожалуйста, попробуйте ещё раз.`);
    }
  };

  // Эффект для обновления графика после его создания или изменения размера
  useEffect(() => {
    const handleResize = () => {
      if (chartRef.current && chartRef.current.chart) {
        console.log(`BaseChart: Изменение размера графика ${containerId}`);
        chartRef.current.resize();
        chartRef.current.update();
      }
    };
    
    // Обрабатываем изменение размера окна
    window.addEventListener('resize', handleResize);
    
    // Также вызываем обновление через некоторое время после рендеринга
    const resizeTimeout = setTimeout(handleResize, 200);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [containerId, chartData]);

  // Закрытие окна выбора отчета
  const handleReportChooserClose = () => {
    console.log('BaseChart: Закрытие окна выбора отчета');
    setShowReportChooser(false);
    setSplitDirection(null);
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
        
        {/* Модальное окно выбора отчета */}
        {showReportChooser && (
          <>
            {console.log('BaseChart: Рендерим окно выбора отчета, showReportChooser =', showReportChooser)}
            <ReportChooser 
              onSelectReport={handleReportSelect}
              onClose={handleReportChooserClose}
              selectedVehicle={vehicle}
              originalReport={reportType}
            />
          </>
        )}
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
      onClick={() => {
        console.log('BaseChart: Клик по основному контейнеру, showReportChooser =', showReportChooser);
      }}
    >
      <SplitScreenContainer 
        id={containerId}
        data-container-id={containerId}
        className="chart-split-container"
        showControls={false}
        onSplitModeChange={handleSplitModeChange}
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
    </div>
  );
};

export default BaseChart; 