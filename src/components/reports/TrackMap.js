import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faExpand, faCompress, faSyncAlt, 
  faRoute, faColumns, faRedo, faWindowRestore
} from '@fortawesome/free-solid-svg-icons';
import splitScreenManager, { SPLIT_MODES } from '../../utils/SplitScreenManager';
import SplitScreenContainer from '../common/SplitScreenContainer';
import ReportChooser from './ReportChooser';
import chartSyncManager from '../../utils/ChartSyncManager';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './TrackMapStyles.css';

// Импортируем иконки Leaflet для маркеров (корректируем пути к иконкам)
// Это решение проблемы с отсутствующими иконками в Leaflet при использовании webpack
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

// Устанавливаем пути к иконкам маркеров для Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl
});

// Создаем пользовательские иконки для начала и конца трека
const startIcon = new L.Icon({
  iconUrl: iconUrl,
  iconRetinaUrl: iconRetinaUrl,
  shadowUrl: shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: 'track-start-marker' // Добавляем класс для кастомизации через CSS
});

const endIcon = new L.Icon({
  iconUrl: iconUrl,
  iconRetinaUrl: iconRetinaUrl,
  shadowUrl: shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: 'track-end-marker' // Добавляем класс для кастомизации через CSS
});

// Функция для получения JWT токена авторизации
const getAuthToken = () => {
  // Проверяем различные варианты хранения токена
  const possibleTokenKeys = ['authToken', 'token', 'jwt', 'access_token'];
  
  for (const key of possibleTokenKeys) {
    const token = localStorage.getItem(key);
    if (token) {
      // Проверяем, является ли токен корректным JWT (содержит 2 точки)
      if (token.split('.').length === 3) {
        return token;
      }
    }
  }
  
  // Если не нашли JWT токен в localStorage, возвращаем null
  return null;
};

const TrackMap = ({ 
  tabId, 
  vehicle, 
  startDate, 
  endDate
}) => {

  // Состояния компонента
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState('Инициализация...');
  const [trackData, setTrackData] = useState([]);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [expandedMode, setExpandedMode] = useState(false);
  const [currentVehicle, setCurrentVehicle] = useState(vehicle);
  const [currentDateRange, setCurrentDateRange] = useState({ startDate, endDate });
  
  // Добавляем состояния для ReportChooser
  const [showReportChooser, setShowReportChooser] = useState(false);
  const [containerToFill, setContainerToFill] = useState(null);
  const [splitDirection, setSplitDirection] = useState(null);
  
  // Добавляем состояние для выделенного диапазона
  const [selectedRange, setSelectedRange] = useState(null);
  // Используем useRef вместо useState для хранения ссылки на выделенный путь
  const highlightedPathRef = useRef(null);
  
  // Идентификатор контейнера для разделения экрана
  const containerId = `track-map-container-${tabId || 'default'}`;
  
  // Ссылка для хранения интервала воспроизведения
  const playbackInterval = useRef(null);
  
  // Ссылки на DOM-элементы
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const routePathRef = useRef(null);
  const animatedMarkerRef = useRef(null);
  
  // В компоненте TrackMap после объявления состояний добавляем новое состояние

const [syncGroup, setSyncGroup] = useState('*');

  const [latestSyncTimeRange, setLatestSyncTimeRange] = useState(null);
  
  useEffect(() => {
    // Проверяем доступность ChartSyncManager
    console.log('TrackMap: Проверка загрузки ChartSyncManager:',
      'глобально:', typeof window.ChartSyncManager,
      'через импорт:', typeof chartSyncManager);
    
    if (typeof chartSyncManager === 'object') {
      console.log('TrackMap: Доступные методы ChartSyncManager:', Object.keys(chartSyncManager));
    }
  }, []);


useEffect(() => {
  if (tabId) {
    const newGroup = `sync-chart-container-${tabId}`;
    setSyncGroup(newGroup);
    console.log(`TrackMap: Обновлена группа синхронизации на ${newGroup}`);
  } else {
    setSyncGroup('*'); // Слушаем все группы
  }
}, [tabId]);
  // Инициализация при монтировании компонента
  useEffect(() => {
    // Проверка загрузки Leaflet
    if (!L || typeof L.map !== 'function') {
      console.error('Библиотека Leaflet не загружена корректно!');
      // Попробуем повторно загрузить через импорт
      import('leaflet').then(leaflet => {
        window.L = leaflet.default;
        console.log('Leaflet успешно загружен динамически');
        
        // Продолжаем инициализацию
        checkLocalStorage();
        
        if (mapContainerRef.current && !mapInitialized) {
          setTimeout(() => {
            if (mapContainerRef.current) {
              initializeMap();
            }
          }, 100);
        }
      }).catch(error => {
        console.error('Не удалось динамически загрузить Leaflet:', error);
      });
      return;
    }
    
    // Проверяем localStorage при загрузке компонента
    checkLocalStorage();
    
    // Инициализация карты с задержкой для предотвращения ошибок DOM
    if (mapContainerRef.current && !mapInitialized) {
      // Добавляем задержку перед инициализацией карты
      setTimeout(() => {
        if (mapContainerRef.current) {
          initializeMap();
        }
      }, 100);
    }
    
    // Слушатель события изменения данных в localStorage
    window.addEventListener('storage', handleStorageChange);
    
    // Слушатель события изменения диапазона дат
    document.addEventListener('dateRangeChanged', handleDateRangeChanged);
    
    // Слушатель события изменения выбранного транспорта
    document.addEventListener('vehicleSelected', handleVehicleSelected);
    
    // Слушатель события изменения режима разделения экрана
    document.addEventListener('splitModeChanged', handleSplitModeChanged);
    
    // Очистка обработчиков при размонтировании
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('dateRangeChanged', handleDateRangeChanged);
      document.removeEventListener('vehicleSelected', handleVehicleSelected);
      document.removeEventListener('splitModeChanged', handleSplitModeChanged);
      
      // Остановка воспроизведения при размонтировании
      if (playbackInterval.current) {
        clearInterval(playbackInterval.current);
        playbackInterval.current = null;
      }
      
      // Более надежная очистка карты при размонтировании
      try {
        if (mapInstanceRef.current) {
          // Удаляем все обработчики событий
          mapInstanceRef.current.off();
          // Удаляем все слои
          mapInstanceRef.current.eachLayer(layer => {
            mapInstanceRef.current.removeLayer(layer);
          });
          // Уничтожаем карту
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }
      } catch (error) {
        console.error('Ошибка при уничтожении карты:', error);
      }
    };
  }, []);
  
  // Эффект при изменении props
  useEffect(() => {
    // Обновляем состояние и вызываем обновление данных при изменении vehicle
    if (vehicle && (!currentVehicle || vehicle.id !== currentVehicle?.id)) {
      console.log('Получен новый props vehicle:', vehicle);
      
      // Добавляем метку времени для принудительного обновления
      const vehicleWithTimestamp = {
        ...vehicle,
        _updateTimestamp: new Date().getTime(),
        _source: 'props' // Добавляем источник данных
      };
      
      // Обновляем текущий транспорт
      setCurrentVehicle(vehicleWithTimestamp);
      
      // Сохраняем в localStorage (важно для синхронизации с другими компонентами)
      saveVehicleToLocalStorage(vehicle);
      
      // Принудительно обновляем трек, если инициализирована карта
      if (mapInitialized && currentDateRange.startDate && currentDateRange.endDate) {
        console.log('Принудительное обновление трека из-за изменения props vehicle:', {
          vehicle: vehicle.name,
          startDate: formatDate(currentDateRange.startDate),
          endDate: formatDate(currentDateRange.endDate)
        });
        
        // Обновляем трек с небольшой задержкой для обновления состояний
        setTimeout(() => fetchTrackData(), 200);
      } else if (!mapInitialized && mapContainerRef.current) {
        // Если карта еще не инициализирована, инициализируем её сразу
        console.log('Инициализация карты при первой загрузке с новым транспортом');
        setTimeout(() => initializeMap(), 100);
      }
    }
    
    // Обновляем даты, если они изменились в props
    if (startDate && endDate && 
        (startDate !== currentDateRange.startDate || 
         endDate !== currentDateRange.endDate)) {
      // Создаем новый объект с диапазоном дат
      const newDateRange = { 
        startDate: ensureValidDate(startDate),
        endDate: ensureValidDate(endDate)
      };
      
      console.log('Обновление диапазона дат из props:', {
        startDate: newDateRange.startDate.toISOString(),
        endDate: newDateRange.endDate.toISOString()
      });
      
      setCurrentDateRange(newDateRange);
      saveDateRangeToLocalStorage(newDateRange);
      
      // Если уже есть выбранное транспортное средство, обновляем данные
      if (currentVehicle && currentVehicle.id && mapInitialized) {
        setTimeout(() => fetchTrackData(), 150);
      }
    }
  }, [vehicle, startDate, endDate]);
  
  // Добавим более мощный обработчик для события принудительного обновления
  useEffect(() => {
    // Обработчик события принудительного обновления данных
    const handleForceUpdate = (event) => {
      try {
        console.log('Получено событие принудительного обновления:', event.detail);
        
        const forceVehicle = event.detail.vehicle;
        const forceStartDate = event.detail.startDate;
        const forceEndDate = event.detail.endDate;
        const eventTimestamp = event.detail.timestamp;
        
        // Сравниваем с последним известным ID для предотвращения ложных обновлений
        if (window.lastSelectedVehicleId && forceVehicle && forceVehicle.id === window.lastSelectedVehicleId) {
          // Проверяем, обновляется ли уже текущий транспорт
          if (currentVehicle && currentVehicle.id === forceVehicle.id) {
            console.log('Событие для текущего транспорта, проверяем только даты');
            
            // Проверяем, изменились ли даты
            if (forceStartDate && forceEndDate) {
              const newStart = ensureValidDate(forceStartDate);
              const newEnd = ensureValidDate(forceEndDate);
              
              // Сохраняем метку времени последнего обновления дат
              window.lastDateUpdateTime = eventTimestamp || new Date().getTime();
              
              // Сравниваем даты с текущими
              let datesChanged = false;
              
              if (!currentDateRange.startDate || !currentDateRange.endDate) {
                datesChanged = true;
                console.log('Текущие даты отсутствуют, принимаем новые');
              } else {
                const startDiff = Math.abs(currentDateRange.startDate.getTime() - newStart.getTime()) > 1000;
                const endDiff = Math.abs(currentDateRange.endDate.getTime() - newEnd.getTime()) > 1000;
                datesChanged = startDiff || endDiff;
                
                if (datesChanged) {
                  console.log('Даты изменились:', {
                    старая_начало: currentDateRange.startDate.toISOString(),
                    новая_начало: newStart.toISOString(),
                    старая_конец: currentDateRange.endDate.toISOString(),
                    новая_конец: newEnd.toISOString()
                  });
                }
              }
              
              if (datesChanged) {
                console.log('Обновляем даты из forceVehicleUpdate');
                setCurrentDateRange({ startDate: newStart, endDate: newEnd });
                saveDateRangeToLocalStorage({ startDate: newStart, endDate: newEnd }, eventTimestamp);
                
                // Обновляем данные, мы знаем что находимся в блоке, где транспорт не изменился
                if (currentVehicle && currentVehicle.id && mapInitialized) {
                  console.log('Запускаем обновление данных из-за изменения дат');
                  setTimeout(() => {
                    // Дополнительная проверка, что выбранное ТС не изменилось за это время
                    if (window.lastSelectedVehicleId === currentVehicle.id) {
                      fetchTrackData();
                    } else {
                      console.log('ТС изменилось во время задержки, пропускаем обновление данных по датам');
                    }
                  }, 350);
                }
              } else {
                console.log('Даты не изменились, обновление не требуется');
              }
            }
            return;
          }
        }
        
        // Проверяем, предоставлены ли данные о транспортном средстве
        if (forceVehicle) {
          console.log('Принудительное обновление транспорта:', forceVehicle.name);
          
          // Сохраняем глобально последний выбранный ID
          window.lastSelectedVehicleId = forceVehicle.id;
          
          // Проверяем, отличается ли новое ТС от текущего
          const vehicleChanged = !currentVehicle || 
                                currentVehicle.id !== forceVehicle.id;
          
          if (vehicleChanged) {
            console.log('Транспорт действительно изменился, обновляем состояние и данные');
            
            // Добавляем метку об источнике данных
            const updatedVehicle = {
              ...forceVehicle,
              _updateTimestamp: eventTimestamp || new Date().getTime(),
              _source: 'event'
            };
            
            // Обновляем текущий транспорт в состоянии компонента
            setCurrentVehicle(updatedVehicle);
            
            // Также сохраняем в localStorage для синхронизации между компонентами
            // Блокируем обработку события storage на определенное время, чтобы избежать циклов
            window.lastVehicleUpdateTime = new Date().getTime();
            saveVehicleToLocalStorage(forceVehicle);
            
            // Теперь проверяем наличие дат и их валидность
            let hasValidDates = false;
            
            // Приоритет 1: Даты из события
            if (forceStartDate && forceEndDate) {
              const newStart = ensureValidDate(forceStartDate);
              const newEnd = ensureValidDate(forceEndDate);
              
              setCurrentDateRange({ startDate: newStart, endDate: newEnd });
              saveDateRangeToLocalStorage({ startDate: newStart, endDate: newEnd });
              hasValidDates = true;
            } 
            // Приоритет 2: Даты из текущего состояния
            else if (currentDateRange.startDate && currentDateRange.endDate) {
              const startIsValid = currentDateRange.startDate instanceof Date && 
                                  !isNaN(currentDateRange.startDate.getTime());
              const endIsValid = currentDateRange.endDate instanceof Date && 
                                !isNaN(currentDateRange.endDate.getTime());
              
              hasValidDates = startIsValid && endIsValid;
            }
            
            // Если даты не определены, создаем их по умолчанию
            if (!hasValidDates) {
              console.log('Даты не определены, создаем по умолчанию');
              const newEnd = new Date();
              const newStart = new Date(newEnd);
              newStart.setDate(newStart.getDate() - 7); // неделя назад
              
              setCurrentDateRange({ startDate: newStart, endDate: newEnd });
              saveDateRangeToLocalStorage({ startDate: newStart, endDate: newEnd });
            }
            
            // Если карта инициализирована, обновляем данные после изменения транспорта
            if (mapInitialized) {
              console.log('Запуск загрузки данных трека после изменения транспортного средства');
              setTimeout(() => {
                // Дополнительная проверка, что выбранное ТС не изменилось за это время
                if (window.lastSelectedVehicleId === forceVehicle.id) {
                  fetchTrackData();
                } else {
                  console.log('ТС изменилось, пропускаем обновление данных');
                }
              }, 350);
            }
          } else {
            console.log('Транспорт не изменился, проверяем даты');
            
            // Проверяем, изменились ли даты
            if (forceStartDate && forceEndDate) {
              const newStart = ensureValidDate(forceStartDate);
              const newEnd = ensureValidDate(forceEndDate);
              
              // Сохраняем метку времени последнего обновления дат
              window.lastDateUpdateTime = eventTimestamp || new Date().getTime();
              
              // Сравниваем даты с текущими
              let datesChanged = false;
              
              if (!currentDateRange.startDate || !currentDateRange.endDate) {
                datesChanged = true;
                console.log('Текущие даты отсутствуют, принимаем новые');
              } else {
                const startDiff = Math.abs(currentDateRange.startDate.getTime() - newStart.getTime()) > 1000;
                const endDiff = Math.abs(currentDateRange.endDate.getTime() - newEnd.getTime()) > 1000;
                datesChanged = startDiff || endDiff;
                
                if (datesChanged) {
                  console.log('Даты изменились:', {
                    старая_начало: currentDateRange.startDate.toISOString(),
                    новая_начало: newStart.toISOString(),
                    старая_конец: currentDateRange.endDate.toISOString(),
                    новая_конец: newEnd.toISOString()
                  });
                }
              }
              
              if (datesChanged) {
                console.log('Обновляем даты из forceVehicleUpdate (ветка где транспорт не изменился)');
                setCurrentDateRange({ startDate: newStart, endDate: newEnd });
                saveDateRangeToLocalStorage({ startDate: newStart, endDate: newEnd }, eventTimestamp);
                
                if (mapInitialized) {
                  console.log('Запускаем обновление данных из-за изменения дат');
                  setTimeout(() => {
                    // Дополнительная проверка, что выбранное ТС не изменилось за это время
                    if (window.lastSelectedVehicleId === currentVehicle.id) {
                      fetchTrackData();
                    } else {
                      console.log('ТС изменилось во время задержки, пропускаем обновление данных');
                    }
                  }, 350);
                }
              } else {
                console.log('Даты не изменились, обновление не требуется');
              }
            }
          }
        } else if (forceStartDate && forceEndDate) {
          // Если транспорт не изменился, но изменились даты
          const newStart = ensureValidDate(forceStartDate);
          const newEnd = ensureValidDate(forceEndDate);
          
          // Сохраняем метку времени последнего обновления дат
          window.lastDateUpdateTime = eventTimestamp || new Date().getTime();
          
          // Сравниваем даты с текущими
          let datesChanged = false;
          
          if (!currentDateRange.startDate || !currentDateRange.endDate) {
            datesChanged = true;
            console.log('Текущие даты отсутствуют, принимаем новые (блок без указания транспорта)');
          } else {
            const startDiff = Math.abs(currentDateRange.startDate.getTime() - newStart.getTime()) > 1000;
            const endDiff = Math.abs(currentDateRange.endDate.getTime() - newEnd.getTime()) > 1000;
            datesChanged = startDiff || endDiff;
            
            if (datesChanged) {
              console.log('Даты изменились (блок без указания транспорта):', {
                старая_начало: currentDateRange.startDate.toISOString(),
                новая_начало: newStart.toISOString(),
                старая_конец: currentDateRange.endDate.toISOString(),
                новая_конец: newEnd.toISOString()
              });
            }
          }
          
          if (datesChanged) {
            console.log('Обновляем только даты:', {
              startDate: newStart.toISOString(),
              endDate: newEnd.toISOString()
            });
            
            setCurrentDateRange({ startDate: newStart, endDate: newEnd });
            saveDateRangeToLocalStorage({ startDate: newStart, endDate: newEnd }, eventTimestamp);
            
            // Если уже есть выбранный транспорт и карта инициализирована, обновляем данные
            if (currentVehicle && currentVehicle.id && mapInitialized) {
              console.log('Запускаем обновление данных из-за изменения дат (блок без указания транспорта)');
              setTimeout(() => {
                // Дополнительная проверка, что выбранное ТС не изменилось за это время
                if (window.lastSelectedVehicleId === currentVehicle.id) {
                  fetchTrackData();
                } else {
                  console.log('ТС изменилось во время задержки, пропускаем обновление данных');
                }
              }, 350);
            }
          } else {
            console.log('Даты не изменились, обновление не требуется (блок без указания транспорта)');
          }
        }
      } catch (error) {
        console.error('Ошибка при обработке события принудительного обновления:', error);
      }
    };
    
    // Регистрируем обработчик
    document.addEventListener('forceVehicleUpdate', handleForceUpdate);
    
    // Очищаем обработчик при размонтировании
    return () => {
      document.removeEventListener('forceVehicleUpdate', handleForceUpdate);
    };
  }, [mapInitialized, currentVehicle, currentDateRange]);
  
  // Отдельный эффект для обновления данных при изменении текущего состояния
  useEffect(() => {
    try {
      if (!mapInitialized || !currentVehicle || !currentVehicle.id) {
        return;
      }
      
      // Проверяем валидность дат перед обновлением
      const startIsValid = currentDateRange.startDate instanceof Date && 
                          !isNaN(currentDateRange.startDate.getTime());
      const endIsValid = currentDateRange.endDate instanceof Date && 
                        !isNaN(currentDateRange.endDate.getTime());
      
      if (!startIsValid || !endIsValid) {
        console.warn('Попытка обновить данные с невалидными датами:', {
          startDate: currentDateRange.startDate,
          startIsValid,
          endDate: currentDateRange.endDate,
          endIsValid
        });
        return;
      }
      
      console.log('Обновление данных из-за изменения основных параметров:', {
        vehicle: currentVehicle.name,
        startDate: startIsValid ? currentDateRange.startDate.toISOString() : 'невалидная дата',
        endDate: endIsValid ? currentDateRange.endDate.toISOString() : 'невалидная дата'
      });
      
      fetchTrackData();
    } catch (error) {
      console.error('Ошибка при обновлении данных:', error);
    }
  }, [mapInitialized, currentVehicle, currentDateRange]);
  
  // Обновление карты при изменении trackData
  useEffect(() => {
    if (mapInitialized && trackData.length > 0 && mapInstanceRef.current) {
      updateMapWithTrackData(trackData);
    }
  }, [trackData, mapInitialized]);
  
  // Функция для безопасного преобразования любого входного значения в валидный объект Date
  const ensureValidDate = (dateInput) => {
    try {
      // Если дата уже является объектом Date и она валидна
      if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
        return dateInput;
      }
      
      // Если дата - строка
      if (typeof dateInput === 'string') {
        // Проверяем, не является ли строка пустой или невалидной
        if (!dateInput || dateInput === 'Invalid Date') {
          console.warn('Получена невалидная строка даты:', dateInput);
          return new Date();
        }
        
        // Сначала пробуем обработать как день-месяц-год
        const parsedDate = parseDateString(dateInput);
        if (parsedDate) {
          return parsedDate;
        }
        
        // Если не удалось распарсить как день-месяц-год, пробуем стандартный метод
        const newDate = new Date(dateInput);
        if (!isNaN(newDate.getTime())) {
          return newDate;
        }
      }
      
      // Если дата - timestamp (число)
      if (typeof dateInput === 'number') {
        // Проверяем, не является ли число слишком малым или большим для валидного timestamp
        if (dateInput < 0 || dateInput > 8640000000000000) {
          console.warn('Невалидный timestamp:', dateInput);
          return new Date();
        }
        
        const newDate = new Date(dateInput);
        if (!isNaN(newDate.getTime())) {
          return newDate;
        }
      }
      
      // Если не удалось создать валидную дату, возвращаем текущую
      console.warn('Невозможно создать валидную дату из:', dateInput);
      return new Date(); // Текущая дата как безопасное значение по умолчанию
    } catch (error) {
      console.error('Ошибка при обработке даты:', error, dateInput);
      return new Date(); // Текущая дата как безопасное значение при ошибке
    }
  };
  
  // Функция для парсинга строки даты в формате день-месяц-год в объект Date
  const parseDateString = (dateString) => {
    try {
      if (!dateString) return null;
      
      // Проверяем формат dd.mm.yyyy
      if (dateString.includes('.')) {
        const parts = dateString.split('.');
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1; // Месяцы в JS начинаются с 0
          const year = parseInt(parts[2], 10);
          
          const date = new Date(year, month, day);
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
      }
      
      // Проверяем формат dd/mm/yyyy
      if (dateString.includes('/')) {
        const parts = dateString.split('/');
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1; // Месяцы в JS начинаются с 0
          const year = parseInt(parts[2], 10);
          
          const date = new Date(year, month, day);
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
      }
      
      // Пробуем стандартный парсинг
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date;
      }
      
      return null;
    } catch (error) {
      console.warn('Ошибка при парсинге строки даты:', error, dateString);
      return null;
    }
  };
  
  // Проверка localStorage при загрузке
  const checkLocalStorage = () => {
    try {
      // Проверяем сохраненный транспорт (выполняем первым для приоритета)
      const savedVehicle = localStorage.getItem('lastSelectedVehicle');
      if (savedVehicle) {
        const parsedVehicle = JSON.parse(savedVehicle);
        if (parsedVehicle && parsedVehicle.id) {
          console.log('Прочитаны данные транспорта из localStorage:', parsedVehicle);
          
          // Если текущее транспортное средство из props имеет приоритет
          if (vehicle && vehicle.id) {
            console.log('Используется транспорт из props вместо localStorage:', vehicle);
          } else {
            // Нормализуем данные, если timestamp передан как число
            if (parsedVehicle.timestamp && typeof parsedVehicle.timestamp === 'number') {
              parsedVehicle.timestampDate = new Date(parsedVehicle.timestamp);
            }
            
            // Добавляем источник данных
            parsedVehicle._source = 'localStorage_initial';
            parsedVehicle._updateTimestamp = new Date().getTime();
            
            setCurrentVehicle(parsedVehicle);
          }
        }
      }
      
      // Проверяем сохраненный диапазон дат
      const savedRange = localStorage.getItem('lastDateRange');
      if (savedRange) {
        const parsedRange = JSON.parse(savedRange);
        if (parsedRange.startDate && parsedRange.endDate) {
          console.log('Прочитан диапазон дат из localStorage:', parsedRange);
          
          // Используем нашу новую функцию для обеспечения валидных дат
          const newRange = {
            startDate: ensureValidDate(parsedRange.startDate),
            endDate: ensureValidDate(parsedRange.endDate)
          };
          
          setCurrentDateRange(newRange);
        }
      }
      
      // Проверяем сохраненный режим разделения
      const savedSplitMode = localStorage.getItem('splitScreenMode');
      if (savedSplitMode) {
        console.log('Прочитан режим разделения из localStorage:', savedSplitMode);
        // Сохраняем режим в localStorage для использования SplitScreenContainer
        localStorage.setItem('splitScreenMode', savedSplitMode);
      }
    } catch (error) {
      console.warn('Ошибка при чтении данных из localStorage:', error);
    }
  };
  
  // Обработчик изменений в localStorage
  const handleStorageChange = (event) => {
    try {
      // Проверяем, не слишком ли недавно мы сами обновили данные
      const now = new Date().getTime();
      const lastUpdate = window.lastVehicleUpdateTime || 0;
      
      // Если обновление было менее 1 секунды назад и это мы сами его сделали, игнорируем
      if ((now - lastUpdate) < 1000) {
        console.log('Игнорируем событие storage - недавнее собственное обновление');
        return;
      }
      
      if (event.key === 'lastDateRange') {
        console.log('Обнаружено изменение диапазона дат в localStorage');
        try {
          const newRange = JSON.parse(event.newValue);
          if (newRange && newRange.startDate && newRange.endDate) {
            const updatedRange = {
              startDate: ensureValidDate(newRange.startDate),
              endDate: ensureValidDate(newRange.endDate)
            };
            setCurrentDateRange(updatedRange);
            
            // Если транспортное средство уже выбрано, обновляем данные
            if (currentVehicle && currentVehicle.id) {
              console.log('Обновление трека из-за изменения диапазона дат в localStorage:', {
                vehicle: currentVehicle.name,
                startDate: updatedRange.startDate.toISOString(),
                endDate: updatedRange.endDate.toISOString()
              });
              // Небольшая задержка, чтобы состояние успело обновиться
              setTimeout(() => fetchTrackData(), 250);
            }
          }
        } catch (error) {
          console.warn('Ошибка при разборе диапазона дат из localStorage:', error);
        }
      } else if (event.key === 'lastSelectedVehicle') {
        console.log('Обнаружено изменение выбранного транспорта в localStorage');
        try {
          const newVehicle = JSON.parse(event.newValue);
          if (newVehicle && newVehicle.id) {
            console.log('Новые данные транспорта:', newVehicle);
            
            // Проверяем, отличается ли новый транспорт от текущего
            const vehicleChanged = !currentVehicle || currentVehicle.id !== newVehicle.id;
            
            if (vehicleChanged) {
              console.log('Транспорт изменился, обновляем состояние компонента');
              
              // Добавляем информацию об источнике данных
              const updatedVehicle = {
                ...newVehicle,
                _updateTimestamp: new Date().getTime(),
                _source: 'localStorage'
              };
              
              setCurrentVehicle(updatedVehicle);
              
              // Если диапазон дат уже выбран, обновляем данные
              if (currentDateRange.startDate && currentDateRange.endDate) {
                console.log('Обновление трека из-за изменения транспортного средства в localStorage:', {
                  vehicle: newVehicle.name,
                  startDate: currentDateRange.startDate.toISOString(),
                  endDate: currentDateRange.endDate.toISOString()
                });
                // Небольшая задержка, чтобы состояние успело обновиться
                setTimeout(() => fetchTrackData(), 300);
              }
            } else {
              console.log('Транспорт не изменился, обновление не требуется');
            }
          }
        } catch (error) {
          console.warn('Ошибка при разборе данных транспорта из localStorage:', error);
        }
      } else if (event.key === 'splitScreenMode') {
        const newSplitMode = event.newValue;
        console.log('Прочитан новый режим разделения из localStorage:', newSplitMode);
        // Сохраняем режим в localStorage для использования SplitScreenContainer
        localStorage.setItem('splitScreenMode', newSplitMode);
      }
    } catch (error) {
      console.error('Ошибка при обработке изменений в localStorage:', error);
    }
  };
  
  // Обработчик события изменения диапазона дат
  const handleDateRangeChanged = (event) => {
    try {
      const { startDate, endDate, period, timestamp } = event.detail;
      
      // Проверяем, не слишком ли недавно мы сами обновили даты
      const now = new Date().getTime();
      const lastUpdate = window.lastDateUpdateTime || 0;
      
      // Если обновление было менее 1 секунды назад и это мы сами его сделали, игнорируем
      if ((now - lastUpdate) < 1000 && window.lastDateUpdateTime === timestamp) {
        console.log('Игнорируем событие dateRangeChanged - недавнее собственное обновление');
        return;
      }
      
      console.log('Получены данные в событии dateRangeChanged:', {
        startDate, 
        endDate,
        period,
        timestamp
      });
      
      // Сохраняем метку времени последнего обновления дат
      window.lastDateUpdateTime = timestamp || new Date().getTime();
      
      // Если передан предустановленный период (неделя, месяц и т.д.)
      if (period) {
        console.log('Обработка предустановленного периода:', period);
        
        // Создаем даты на основе предустановленного периода
        let newStartDate = new Date();
        let newEndDate = new Date();
        
        switch(period) {
          case 'day':
            // Текущий день
            console.log('Обработка предустановленного периода: день');
            newStartDate.setHours(0, 0, 0, 0);
            break;
          case 'week':
            // Последние 7 дней
            newStartDate = new Date(newEndDate);
            newStartDate.setDate(newEndDate.getDate() - 7);
            break;
          case 'month':
            // Последние 30 дней
            newStartDate = new Date(newEndDate);
            newStartDate.setDate(newEndDate.getDate() - 30);
            break;
          case 'year':
            // Последние 365 дней
            newStartDate = new Date(newEndDate);
            newStartDate.setDate(newEndDate.getDate() - 365);
            break;
          default:
            // По умолчанию - неделя
            newStartDate = new Date(newEndDate);
            newStartDate.setDate(newEndDate.getDate() - 7);
        }
        
        console.log('Сформирован период на основе предустановки:', {
          период: period,
          начало: newStartDate.toISOString(),
          конец: newEndDate.toISOString()
        });
        
        const updatedRange = {
          startDate: newStartDate,
          endDate: newEndDate
        };
        
        setCurrentDateRange(updatedRange);
        saveDateRangeToLocalStorage(updatedRange, timestamp);
        
        // Если транспортное средство выбрано, обновляем данные
        if (currentVehicle && currentVehicle.id) {
          console.log('Обновление трека из-за выбора предустановленного периода:', {
            vehicle: currentVehicle.name,
            period: period,
            startDate: newStartDate.toISOString(),
            endDate: newEndDate.toISOString()
          });
          setTimeout(() => fetchTrackData(), 300);
        }
        
        return;
      }
      
      // Стандартная обработка для обычного выбора дат
      if (!startDate || !endDate) {
        console.warn('Получены неполные данные в событии dateRangeChanged:', event.detail);
        return;
      }
      
      // Обеспечиваем валидные даты с помощью нашей функции
      const validStartDate = ensureValidDate(startDate);
      const validEndDate = ensureValidDate(endDate);
      
      console.log('Обработка события изменения диапазона дат:', {
        startDate: validStartDate.toISOString(),
        endDate: validEndDate.toISOString()
      });
      
      const updatedRange = {
        startDate: validStartDate, 
        endDate: validEndDate 
      };
      
      setCurrentDateRange(updatedRange);
      saveDateRangeToLocalStorage(updatedRange, timestamp);
      
      // Если транспортное средство уже выбрано, обновляем данные
      if (currentVehicle && currentVehicle.id) {
        console.log('Обновление трека из-за события изменения диапазона дат:', {
          vehicle: currentVehicle.name,
          startDate: validStartDate.toISOString(),
          endDate: validEndDate.toISOString()
        });
        // Небольшая задержка, чтобы состояние успело обновиться
        setTimeout(() => fetchTrackData(), 300);
      }
    } catch (error) {
      console.error('Ошибка при обработке события изменения диапазона дат:', error);
    }
  };
  
  // Сохранение диапазона дат в localStorage
  const saveDateRangeToLocalStorage = (range, timestamp) => {
    try {
      // Проверяем валидность дат перед сохранением
      if (!range || !range.startDate || !range.endDate) {
        console.warn('Попытка сохранить неполный диапазон дат:', range);
        return;
      }
      
      // Проверяем, что даты являются валидными объектами Date
      const startIsValid = range.startDate instanceof Date && !isNaN(range.startDate.getTime());
      const endIsValid = range.endDate instanceof Date && !isNaN(range.endDate.getTime());
      
      if (!startIsValid || !endIsValid) {
        console.warn('Попытка сохранить невалидные даты:', {
          startDate: range.startDate,
          startIsValid,
          endDate: range.endDate,
          endIsValid
        });
        return;
      }
      
      // Устанавливаем время начальной даты на 00:00:00.000
      const startDate = new Date(range.startDate);
      startDate.setHours(0, 0, 0, 0);
      
      // Сохраняем время последнего обновления для синхронизации
      window.lastDateUpdateTime = timestamp || new Date().getTime();
      
      localStorage.setItem('lastDateRange', JSON.stringify({
        startDate: startDate.toISOString(),
        endDate: range.endDate.toISOString(),
        updateTimestamp: window.lastDateUpdateTime
      }));
      
      console.log('Диапазон дат сохранен в localStorage:', {
        startDate: startDate.toISOString(),
        endDate: range.endDate.toISOString(),
        timestamp: window.lastDateUpdateTime
      });
      
      // Создаем пользовательское событие для обновления других компонентов в этой вкладке
      const dateChangeEvent = new CustomEvent('dateRangeChangedInTab', {
        detail: {
          startDate: startDate, // Используем модифицированную дату с 00:00
          endDate: range.endDate,
          timestamp: window.lastDateUpdateTime
        }
      });
      document.dispatchEvent(dateChangeEvent);
      
    } catch (error) {
      console.warn('Ошибка при сохранении диапазона дат в localStorage:', error);
    }
  };
  
  // Сохранение данных транспорта в localStorage
  const saveVehicleToLocalStorage = (vehicle) => {
    try {
      console.log('Сохранение данных транспортного средства в localStorage:', vehicle);
      
      if (!vehicle || !vehicle.id) {
        console.warn('Попытка сохранить некорректное транспортное средство:', vehicle);
        return;
      }
      
      // Запоминаем время сохранения для обнаружения собственных изменений
      window.lastVehicleUpdateTime = new Date().getTime();
      
      // Сохраняем в localStorage
      localStorage.setItem('lastSelectedVehicle', JSON.stringify({
        ...vehicle,
        timestamp: window.lastVehicleUpdateTime // Используем то же время
      }));
      
      // Дополнительно создаем событие для синхронизации в рамках текущей вкладки
      // так как storage событие работает только между разными вкладками
      const syncEvent = new CustomEvent('vehicleSelectedInTab', {
        detail: {
          vehicle: vehicle,
          timestamp: window.lastVehicleUpdateTime
        }
      });
      document.dispatchEvent(syncEvent);
      
      console.log('Транспортное средство успешно сохранено в localStorage');
    } catch (error) {
      console.warn('Ошибка при сохранении данных транспорта в localStorage:', error);
    }
  };
  
  // Инициализация карты
  const initializeMap = () => {
    console.log('Инициализация карты...');
    
    // Проверяем наличие контейнера карты
    if (!mapContainerRef.current) {
      console.error('Контейнер карты не найден при инициализации');
      return;
    }
    
    try {
      // Определяем ID для контейнера карты
      const mapElementId = `map-${tabId || 'default'}`;
      const mapElement = document.getElementById(mapElementId);
      
      if (!mapElement) {
        console.error(`Элемент с ID ${mapElementId} не найден, создаем новый`);
        // Создаем элемент, если он не существует
        const newMapElement = document.createElement('div');
        newMapElement.id = mapElementId;
        newMapElement.className = 'tm-map-instance';
        newMapElement.style.width = '100%';
        newMapElement.style.height = '100%';
        
        // Добавляем в контейнер
        if (mapContainerRef.current) {
          // Убедимся, что контейнер пустой
          mapContainerRef.current.innerHTML = '';
          mapContainerRef.current.appendChild(newMapElement);
        } else {
          console.error('mapContainerRef.current все ещё undefined после проверки');
          return;
        }
      }
      
      // Если карта уже инициализирована, уничтожаем её для повторной инициализации
      if (mapInstanceRef.current) {
        console.log('Уничтожаем существующую карту перед повторной инициализацией');
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      
      // Устанавливаем небольшую задержку перед инициализацией для предотвращения ошибок DOM
      setTimeout(() => {
        try {
          // Проверяем еще раз, что контейнер существует после таймаута
          const mapElementAfterTimeout = document.getElementById(mapElementId);
          if (!mapElementAfterTimeout) {
            console.error(`Элемент с ID ${mapElementId} не найден после задержки, пробуем создать еще раз`);
            // Повторно пытаемся создать элемент
            const newMapElement = document.createElement('div');
            newMapElement.id = mapElementId;
            newMapElement.className = 'tm-map-instance';
            newMapElement.style.width = '100%';
            newMapElement.style.height = '100%';
            
            // Добавляем в контейнер
            if (mapContainerRef.current) {
              mapContainerRef.current.innerHTML = '';
              mapContainerRef.current.appendChild(newMapElement);
            } else {
              console.error('mapContainerRef.current остается недоступным');
              return;
            }
          }
          
          // Инициализируем карту Leaflet с обработкой ошибок
          const map = L.map(mapElementId, {
            center: [43.238949, 76.889709], // Центр Алматы по умолчанию
            zoom: 13,
            layers: [
                L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
                    attribution: '',
                    maxZoom: 20
                })
            ],
            // Предотвращаем зависание анимации при скрытых вкладках
            fadeAnimation: false,
            zoomAnimation: false
          });
          
          // Сохраняем экземпляр карты в ref
          mapInstanceRef.current = map;
          
          // Добавляем обработчик события изменения размера с защитой от ошибок
          map.on('resize', () => {
            try {
              console.log('Изменение размера карты');
              if (map && map._container && document.body.contains(map._container)) {
                map.invalidateSize();
              }
            } catch (error) {
              console.error('Ошибка при изменении размера карты:', error);
            }
          });
          
          // Защита от ошибок при масштабировании
          map.on('zoom', () => {
            if (map && !map._animatingZoom && map._mapPane && map._mapPane.offsetWidth === 0) {
              // Если карта невидима или размер равен 0, сбрасываем анимацию
              map._resetView(map.getCenter(), map.getZoom(), true);
            }
          });
          
          // Устанавливаем флаги инициализации
          setMapInitialized(true);
          setIsLoading(false);
          
          console.log('Карта успешно инициализирована');
          
          // После инициализации карты, загружаем данные трека если есть ТС и даты
          if (currentVehicle && currentVehicle.id && currentDateRange.startDate && currentDateRange.endDate) {
            console.log('Запуск загрузки данных трека после инициализации карты:', {
              vehicle: currentVehicle.name,
              startDate: formatDate(currentDateRange.startDate),
              endDate: formatDate(currentDateRange.endDate)
            });
            setTimeout(() => fetchTrackData(), 300);
          } else {
            console.log('Не загружаем данные трека: не выбран транспорт или даты');
            
            // Пытаемся получить данные из localStorage, если не был предоставлен currentVehicle
            if (!currentVehicle || !currentVehicle.id) {
              try {
                const savedVehicle = localStorage.getItem('lastSelectedVehicle');
                if (savedVehicle) {
                  const parsedVehicle = JSON.parse(savedVehicle);
                  if (parsedVehicle && parsedVehicle.id) {
                    console.log('Загружаем транспорт из localStorage:', parsedVehicle);
                    
                    // Добавляем источник данных
                    parsedVehicle._source = 'localStorage_init';
                    parsedVehicle._updateTimestamp = new Date().getTime();
                    
                    setCurrentVehicle(parsedVehicle);
                    
                    // Если есть даты, загрузим данные трека
                    if (currentDateRange.startDate && currentDateRange.endDate) {
                      setTimeout(() => fetchTrackData(), 350);
                    }
                  }
                }
              } catch (error) {
                console.warn('Ошибка при получении транспорта из localStorage:', error);
              }
            }
          }
        } catch (mapInitError) {
          console.error('Ошибка при инициализации карты после задержки:', mapInitError);
          setIsLoading(false);
        }
      }, 150); // Задержка для гарантии что DOM полностью отрисован
    } catch (error) {
      console.error('Ошибка при инициализации карты:', error);
      setIsLoading(false);
    }
  };
  
  // Получение данных трека
  const fetchTrackData = async () => {
    try {
      if (!currentVehicle || !currentVehicle.imei) {
        console.warn('Невозможно загрузить данные трека: не выбрано транспортное средство');
        return;
      }
      
      // Проверяем валидность дат перед запросом
      const startIsValid = currentDateRange.startDate instanceof Date && 
                          !isNaN(currentDateRange.startDate.getTime());
      const endIsValid = currentDateRange.endDate instanceof Date && 
                        !isNaN(currentDateRange.endDate.getTime());
      
      if (!startIsValid || !endIsValid) {
        console.warn('Невозможно загрузить данные трека: невалидные даты:', {
          startDate: currentDateRange.startDate,
          endDate: currentDateRange.endDate
        });
        return;
      }
      
      // Устанавливаем начальное состояние загрузки
      setIsLoading(true);
      setLoadingProgress(5);
      setLoadingStatus('Подготовка запроса...');
      
      try {
        console.log('Загрузка данных трека для:', {
          imei: currentVehicle.imei,
          name: currentVehicle.name,
          startDate: currentDateRange.startDate.toISOString(),
          endDate: currentDateRange.endDate.toISOString()
        });
        
        // Форматирование дат в нужный формат для API (ISO строки)
        const startISOString = currentDateRange.startDate.toISOString();
        const endISOString = currentDateRange.endDate.toISOString();
        
        // Дата в формате YYYY-MM-DD для запасного API
        const startDateString = currentDateRange.startDate.toISOString().split('T')[0];
        const endDateString = currentDateRange.endDate.toISOString().split('T')[0];
        
        setLoadingProgress(15);
        setLoadingStatus('Подготовка API запроса...');
        
        // Основной URL для API получения данных трека
        const primaryApiUrl = `/api/telemetry/v3/${currentVehicle.imei}/track?startTime=${encodeURIComponent(startISOString)}&endTime=${encodeURIComponent(endISOString)}`;
        
        // Запасной URL для API (используется, если основной URL не работает)
        const fallbackApiUrl = `/api/v1/tracks/${currentVehicle.imei}?from=${startDateString}&to=${endDateString}`;
        
        // Получаем токен авторизации
        const authToken = getAuthToken();
        
        // Подготавливаем заголовки запроса
        const headers = {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        };
        
        // Если токен найден, добавляем его в заголовки
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
        }
        
        setLoadingProgress(25);
        setLoadingStatus('Соединение с сервером...');
        
        let response;
        let data;
        let useBackupApi = false;
        
        // Пробуем основной URL
        try {
          response = await fetch(primaryApiUrl, {
            method: 'GET',
            headers: headers
          });
          
          setLoadingProgress(40);
          setLoadingStatus('Получение данных...');
          
          // Если ответ не успешный, пробуем запасной URL
          if (!response.ok) {
            console.warn(`Основной API вернул ошибку: ${response.status}. Пробуем запасной URL.`);
            setLoadingStatus('Подключение к запасному API...');
            useBackupApi = true;
          } else {
            // Парсим JSON ответ основного API
            data = await response.json();
            setLoadingProgress(60);
            setLoadingStatus('Обработка данных...');
          }
        } catch (primaryError) {
          console.warn(`Ошибка при запросе к основному API: ${primaryError.message}. Пробуем запасной URL.`);
          setLoadingStatus('Подключение к запасному API...');
          useBackupApi = true;
        }
        
        // Если основной URL не сработал, пробуем запасной
        if (useBackupApi) {
          try {
            setLoadingProgress(45);
            response = await fetch(fallbackApiUrl, {
              method: 'GET',
              headers: headers
            });
            
            setLoadingProgress(55);
            
            if (!response.ok) {
              throw new Error(`Запасной API вернул ошибку: ${response.status} ${response.statusText}`);
            }
            
            data = await response.json();
            setLoadingProgress(65);
            setLoadingStatus('Обработка данных...');
          } catch (fallbackError) {
            throw new Error(`Ошибка при запросе к запасному API: ${fallbackError.message}`);
          }
        }
        
        // Проверяем полученные данные и преобразуем их в нужный формат
        let trackPoints = [];
        
        setLoadingProgress(70);
        setLoadingStatus('Преобразование данных...');
        
        // Обработка различных форматов данных API
        if (data) {
          if (Array.isArray(data.points)) {
            // Формат основного API
            console.log(`Успешно получены данные трека: ${data.points.length} точек`);
            
            trackPoints = data.points.map((point, index) => ({
              id: index,
              latitude: point.lat || point.latitude,
              longitude: point.lng || point.lon || point.longitude,
              timestamp: new Date(point.timestamp || point.time || point.datetime),
              speed: point.speed || 0,
              altitude: point.altitude || point.alt || 0,
              course: point.course || point.heading || point.direction || 0,
              satellites: point.satellites || point.sats || 0,
              fuel: point.fuel || point.fuelLevel || 0
            }));
          } else if (Array.isArray(data)) {
            // Формат запасного API - массив точек
            console.log(`Успешно получены данные трека: ${data.length} точек`);
            
            trackPoints = data.map((point, index) => ({
              id: index,
              latitude: point.lat || point.latitude,
              longitude: point.lng || point.lon || point.longitude,
              timestamp: new Date(point.timestamp || point.time || point.datetime),
              speed: point.speed || 0,
              altitude: point.altitude || point.alt || 0,
              course: point.course || point.heading || point.direction || 0,
              satellites: point.satellites || point.sats || 0,
              fuel: point.fuel || point.fuelLevel || 0
            }));
          } else if (data.tracks && Array.isArray(data.tracks)) {
            // Еще один возможный формат - массив в свойстве tracks
            console.log(`Успешно получены данные трека: ${data.tracks.length} точек`);
            
            trackPoints = data.tracks.map((point, index) => ({
              id: index,
              latitude: point.lat || point.latitude,
              longitude: point.lng || point.lon || point.longitude,
              timestamp: new Date(point.timestamp || point.time || point.datetime),
              speed: point.speed || 0,
              altitude: point.altitude || point.alt || 0,
              course: point.course || point.heading || point.direction || 0,
              satellites: point.satellites || point.sats || 0,
              fuel: point.fuel || point.fuelLevel || 0
            }));
          } else if (data.data && Array.isArray(data.data)) {
            // Формат с данными в свойстве data
            console.log(`Успешно получены данные трека: ${data.data.length} точек`);
            
            trackPoints = data.data.map((point, index) => ({
              id: index,
              latitude: point.lat || point.latitude,
              longitude: point.lng || point.lon || point.longitude,
              timestamp: new Date(point.timestamp || point.time || point.datetime),
              speed: point.speed || 0,
              altitude: point.altitude || point.alt || 0,
              course: point.course || point.heading || point.direction || 0,
              satellites: point.satellites || point.sats || 0,
              fuel: point.fuel || point.fuelLevel || 0
            }));
          } else if (data.error) {
            // Обработка ошибки от API
            throw new Error(`Ошибка API: ${data.error}`);
          } else {
            // Неизвестный формат данных
            throw new Error('Неизвестный формат данных от API');
          }
        } else {
          throw new Error('API не вернул данные');
        }
        
        setLoadingProgress(80);
        
        // Проверяем, получили ли мы точки трека
        if (trackPoints.length === 0) {
          console.warn('API вернул пустой список точек трека');
          setLoadingStatus('Нет данных для отображения');
          setTrackData([]);
        } else {
          setLoadingProgress(85);
          setLoadingStatus('Подготовка точек маршрута...');
          
          // Фильтруем точки с невалидными координатами
          const validPoints = trackPoints.filter(
            point => typeof point.latitude === 'number' && typeof point.longitude === 'number'
          );
          
          if (validPoints.length === 0) {
            console.warn('После фильтрации невалидных координат не осталось точек трека');
            setLoadingStatus('Генерация тестовых данных...');
            // Используем тестовые данные если нет валидных точек
          } else {
            setLoadingProgress(90);
            setLoadingStatus('Отрисовка маршрута...');
            
            // Сортируем точки по времени
            validPoints.sort((a, b) => a.timestamp - b.timestamp);
            
            setTrackData(validPoints);
            updateMapWithTrackData(validPoints);
            
            setLoadingProgress(95);
            setLoadingStatus('Кеширование данных...');
            
            // Сохраняем данные трека в сессионное хранилище для быстрого доступа
            try {
              sessionStorage.setItem(
                `track_${currentVehicle.imei}_${startDateString}_${endDateString}`,
                JSON.stringify(validPoints)
              );
            } catch (storageError) {
              console.warn('Не удалось сохранить данные трека в sessionStorage:', storageError);
            }
          }
        }
      } catch (error) {
        console.error('Ошибка при загрузке данных трека:', error);
        
        setLoadingStatus('Проверка кешированных данных...');
        setLoadingProgress(60);
        
        // Пробуем получить данные из sessionStorage перед использованием тестовых данных
        const startDateString = currentDateRange.startDate.toISOString().split('T')[0];
        const endDateString = currentDateRange.endDate.toISOString().split('T')[0];
        const storageKey = `track_${currentVehicle.imei}_${startDateString}_${endDateString}`;
        
        try {
          const cachedData = sessionStorage.getItem(storageKey);
          if (cachedData) {
            console.log('Используем кешированные данные из sessionStorage');
            setLoadingStatus('Загрузка из кеша...');
            setLoadingProgress(75);
            const trackPoints = JSON.parse(cachedData);
            setTrackData(trackPoints);
            setLoadingProgress(90);
            updateMapWithTrackData(trackPoints);
            return;
          }
        } catch (storageError) {
          console.warn('Ошибка при чтении из sessionStorage:', storageError);
        }
        
        // Если нет кешированных данных, используем тестовые
        console.log('Используем тестовые данные из-за ошибки API');
        setLoadingStatus('Генерация тестовых данных...');
        setLoadingProgress(80);
      } finally {
        setLoadingProgress(100);
        setLoadingStatus('Загрузка завершена');
        
        // Задержка перед скрытием индикатора загрузки
        setTimeout(() => {
          setIsLoading(false);
        }, 500);
      }
    } catch (error) {
      console.error('Непредвиденная ошибка при загрузке данных трека:', error);
      setLoadingStatus('Произошла ошибка');
      setLoadingProgress(100);
      setIsLoading(false);
    }
  };
  
  
  // Обновление карты с данными трека
  const updateMapWithTrackData = (data) => {
    if (!data.length) return;

    console.log('Обновление карты с данными трека...');
    
    // Увеличиваем задержку перед обновлением карты для гарантии готовности DOM
    setTimeout(() => {
      if (!mapInstanceRef.current) {
        console.warn('Экземпляр карты не найден при попытке обновления данных, инициализируем карту заново');
        if (mapContainerRef.current) {
          // Если контейнер есть, но карты нет - инициализируем карту заново
          initializeMap();
          // После инициализации попробуем обновить данные
          setTimeout(() => {
            if (mapInstanceRef.current) {
              updateMapWithTrackDataInternal(data);
            }
          }, 500);
        } else {
          console.error('Контейнер карты не найден, дожидаемся появления в DOM');
          // Ждем более долгое время для полной перерисовки DOM
          setTimeout(() => {
            if (mapContainerRef.current) {
              initializeMap();
              setTimeout(() => {
                if (mapInstanceRef.current) {
                  updateMapWithTrackDataInternal(data);
                }
              }, 500);
            } else {
              console.error('Контейнер карты все еще не найден после ожидания, невозможно обновить данные');
            }
          }, 1000);
        }
        return;
      }
      
      updateMapWithTrackDataInternal(data);
    }, 300);
  };

  // Внутренняя функция для обновления карты, когда всё готово
  const updateMapWithTrackDataInternal = (data) => {
    if (!mapInstanceRef.current) {
      console.error('Экземпляр карты не существует для внутреннего обновления');
      return;
    }
    
    try {
      const map = mapInstanceRef.current;
      
      // Проверяем, что карта все еще существует в DOM
      if (!map._container || !document.body.contains(map._container)) {
        console.warn('Контейнер карты был удален из DOM');
        return;
      }
      
      // Очистка предыдущих маркеров
      if (markersRef.current.length > 0) {
        markersRef.current.forEach(marker => {
          if (map) {
            map.removeLayer(marker);
          }
        });
        markersRef.current = [];
      }
      
      // Очистка предыдущего пути
      if (routePathRef.current) {
        map.removeLayer(routePathRef.current);
        routePathRef.current = null;
      }
      
      // Очистка анимированного маркера
      if (animatedMarkerRef.current) {
        map.removeLayer(animatedMarkerRef.current);
        animatedMarkerRef.current = null;
      }
      
      // Очистка выделенного сегмента
      if (highlightedPathRef.current) {
        map.removeLayer(highlightedPathRef.current);
        highlightedPathRef.current = null;
      }
      
      // Создаем массив точек для линии маршрута
      const routePoints = data.map(point => [point.latitude, point.longitude]);
      
      // Создаем линию маршрута
      const routePath = L.polyline(routePoints, {
        color: '#4e73df',
        weight: 4,
        opacity: 0.8,
        lineJoin: 'round'
      });
      
      // Добавляем обработчик события клика на линию трека
      routePath.on('click', handleMapClick);
      
      // Добавляем линию на карту
      routePath.addTo(map);
      routePathRef.current = routePath;
      
      // Добавляем маркеры начала и конца трека
      if (data.length > 0) {
        // Маркер начала трека
        const startPoint = data[0];
        const startMarker = L.marker([startPoint.latitude, startPoint.longitude], { icon: startIcon })
          .addTo(map)
          .bindPopup(`<strong>Начало трека</strong><br>
                     Дата: ${formatDate(startPoint.timestamp)}<br>
                     Скорость: ${startPoint.speed} км/ч`)
          .on('click', () => {
            // Обновляем индекс через ref
            if (animatedMarkerRef.current) {
              animatedMarkerRef.current._currentPointIndex = 0;
            }
            updateTimeSlider(0);
            
            // Отправляем событие выбора первой точки
            const pointSelectedEvent = new CustomEvent('pointSelected', {
              detail: {
                timestamp: new Date(startPoint.timestamp).getTime(),
                data: startPoint,
                source: 'trackMap'
              }
            });
            document.dispatchEvent(pointSelectedEvent);
          });
        
        // Маркер конца трека
        const endPoint = data[data.length - 1];
        const endMarker = L.marker([endPoint.latitude, endPoint.longitude], { icon: endIcon })
          .addTo(map)
          .bindPopup(`<strong>Конец трека</strong><br>
                     Дата: ${formatDate(endPoint.timestamp)}<br>
                     Скорость: ${endPoint.speed} км/ч`)
          .on('click', () => {
            // Обновляем индекс через ref
            if (animatedMarkerRef.current) {
              animatedMarkerRef.current._currentPointIndex = data.length - 1;
            }
            updateTimeSlider(data.length - 1);
            
            // Отправляем событие выбора последней точки
            const pointSelectedEvent = new CustomEvent('pointSelected', {
              detail: {
                timestamp: new Date(endPoint.timestamp).getTime(),
                data: endPoint,
                source: 'trackMap'
              }
            });
            document.dispatchEvent(pointSelectedEvent);
          });
        
        // Добавляем маркеры в массив для возможности дальнейшего управления
        markersRef.current.push(startMarker, endMarker);
        
        // Создаем анимированный маркер для воспроизведения трека
        const animatedMarker = L.marker([startPoint.latitude, startPoint.longitude])
          .addTo(map)
          .bindPopup(`<strong>${currentVehicle?.name || 'Транспорт'}</strong><br>
                     Дата: ${formatDate(startPoint.timestamp)}<br>
                     Скорость: ${startPoint.speed} км/ч`);
        
        animatedMarkerRef.current = animatedMarker;
      }
      
      // Добавляем общий обработчик клика для карты
      map.off('click', handleMapClick); // Удаляем предыдущий обработчик, если есть
      map.on('click', handleMapClick);
      
      // Отображаем весь трек на карте с увеличенной безопасностью
      setTimeout(() => updateMapView(), 200);
      
      // Если есть сохраненный выделенный диапазон, восстанавливаем его
      if (selectedRange) {
        setTimeout(() => {
          zoomToTimeRange(selectedRange.startTime, selectedRange.endTime);
        }, 500);
      }
      
      console.log('Карта обновлена с данными трека');
    } catch (error) {
      console.error('Ошибка при обновлении карты:', error);
    }
  };
  
  // Обновление представления карты с защитой от ошибок
  const updateMapView = () => {
    if (!mapInstanceRef.current || !trackData.length) {
      if (!mapInstanceRef.current) {
        console.warn('Экземпляр карты не существует при обновлении представления');
      }
      if (!trackData.length) {
        console.warn('Нет данных трека для обновления представления');
      }
      return;
    }
    
    try {
      // Проверяем, что карта и её контейнер все еще существуют и видимы
      if (!mapInstanceRef.current._container || 
          !document.body.contains(mapInstanceRef.current._container)) {
        console.warn('Контейнер карты не найден при обновлении представления');
        
        // Смотрим, есть ли контейнер для инициализации карты заново
        if (mapContainerRef.current) {
          console.log('Контейнер для карты существует, инициализируем карту заново');
          initializeMap();
          
          // После инициализации запускаем повторное обновление представления
          setTimeout(() => {
            if (mapInstanceRef.current && trackData.length > 0) {
              try {
                // Центрирование карты по всем точкам маршрута с защитой от ошибок
                const routePoints = trackData.map(point => [point.latitude, point.longitude]);
                const bounds = L.latLngBounds(routePoints);
                
                // Убеждаемся, что у bounds есть границы
                if (bounds.isValid()) {
                  mapInstanceRef.current.fitBounds(bounds, {
                    padding: [50, 50],
                    maxZoom: 15,
                    animate: false // Отключаем анимацию для предотвращения ошибок
                  });
                } else {
                  console.warn('Невалидные границы маршрута');
                  // Устанавливаем вид на первую точку маршрута
                  if (trackData[0]) {
                    mapInstanceRef.current.setView(
                      [trackData[0].latitude, trackData[0].longitude], 
                      13, 
                      { animate: false }
                    );
                  }
                }
              } catch (innerError) {
                console.error('Ошибка при повторном центрировании карты:', innerError);
              }
            }
          }, 500);
        }
        return;
      }
      
      // Проверяем видимость и размер контейнера
      const isContainerVisible = mapInstanceRef.current._container.offsetWidth > 0 &&
                               mapInstanceRef.current._container.offsetHeight > 0;
      
      if (!isContainerVisible) {
        console.warn('Контейнер карты невидим или имеет нулевой размер');
        
        // Обновляем размер карты после задержки
        setTimeout(() => {
          if (mapInstanceRef.current) {
            try {
              // Сначала пробуем обновить размер
              mapInstanceRef.current.invalidateSize({animate: false});
              
              if (trackData.length > 0) {
                // И затем пробуем центрировать
                const routePoints = trackData.map(point => [point.latitude, point.longitude]);
                const bounds = L.latLngBounds(routePoints);
                if (bounds.isValid()) {
                  mapInstanceRef.current.fitBounds(bounds, {
                    padding: [50, 50],
                    maxZoom: 15,
                    animate: false
                  });
                }
              }
            } catch (delayedError) {
              console.error('Ошибка при отложенном обновлении карты:', delayedError);
            }
          }
        }, 500);
        return;
      }
      
      // Центрирование карты по всем точкам маршрута
      console.log('Центрирование карты по маршруту');
      
      try {
        // Обновляем размер карты перед центрированием
        mapInstanceRef.current.invalidateSize({animate: false});
        
        const routePoints = trackData.map(point => [point.latitude, point.longitude]);
        const bounds = L.latLngBounds(routePoints);
        
        // Устанавливаем границы с небольшим отступом и отключаем анимацию для надежности
        mapInstanceRef.current.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 15,
          animate: false // Отключаем анимацию для предотвращения ошибок
        });
      } catch (error) {
        console.error('Ошибка при центрировании карты:', error);
        
        // При ошибке центрирования пробуем хотя бы обновить размер
        try {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize({animate: false});
          }
        } catch (sizeError) {
          console.error('Ошибка при обновлении размера карты:', sizeError);
        }
      }
    } catch (outerError) {
      console.error('Ошибка при обновлении представления карты:', outerError);
    }
  };
  
  // Общая функция для обновления карты после изменения размера или режима с защитой от ошибок
  const refreshMapView = () => {
    console.log('Вызов refreshMapView для обновления размера карты');
    
    // Добавляем проверку существования контейнера сразу
    if (!mapContainerRef.current) {
      console.warn('mapContainerRef.current не существует при refreshMapView');
      return;
    }
    
    // Проверка видимости контейнера
    const containerRect = mapContainerRef.current.getBoundingClientRect();
    const isVisible = containerRect.width > 0 && containerRect.height > 0;
    
    if (!isVisible) {
      console.warn('Контейнер карты невидим при refreshMapView, размеры:', containerRect);
    }
    
    // Даем время на отрисовку DOM перед обновлением карты
    setTimeout(() => {
      try {
        console.log('Обновление размера карты после таймаута');
        
        // Повторная проверка, что контейнер существует после таймаута
        if (!mapContainerRef.current) {
          console.warn('mapContainerRef.current не существует после таймаута в refreshMapView');
          return;
        }
        
        if (!mapInstanceRef.current) {
          console.warn('Экземпляр карты не существует, пробуем инициализировать заново');
          // Проверяем снова наличие контейнера
          if (mapContainerRef.current) {
            initializeMap();
            return;
          } else {
            console.error('Контейнер карты не найден для инициализации');
            return;
          }
        }
        
        // Проверяем, что контейнер карты существует и видим
        if (mapInstanceRef.current._container && 
            document.body.contains(mapInstanceRef.current._container)) {
            
          // Дополнительная проверка размеров контейнера
          const containerWidth = mapInstanceRef.current._container.offsetWidth;
          const containerHeight = mapInstanceRef.current._container.offsetHeight;
            
          if (containerWidth > 0 && containerHeight > 0) {
            console.log(`Контейнер карты видим, размеры: ${containerWidth}x${containerHeight}`);
            
            // Принудительно сбрасываем размер и перерисовываем карту
            mapInstanceRef.current.invalidateSize({animate: false});
            
            // Если есть данные трека, правильно центрируем карту
            if (trackData.length > 0) {
              try {
                const routePoints = trackData.map(point => [point.latitude, point.longitude]);
                const bounds = L.latLngBounds(routePoints);
                
                // Проверяем валидность границ
                if (bounds.isValid()) {
                  mapInstanceRef.current.fitBounds(bounds, {
                    padding: [50, 50],
                    maxZoom: 15,
                    animate: false
                  });
                  console.log('Карта отцентрирована по маршруту');
                } else {
                  console.warn('Невалидные границы маршрута');
                  // Если границы невалидны, центрируем по первой точке
                  if (trackData[0]) {
                    mapInstanceRef.current.setView(
                      [trackData[0].latitude, trackData[0].longitude], 
                      13, 
                      { animate: false }
                    );
                  }
                }
              } catch (e) {
                console.error('Ошибка при центрировании карты:', e);
                // Если не удалось правильно отцентрировать, хотя бы убедимся что карта не скрыта
                mapInstanceRef.current.invalidateSize({animate: false});
              }
            } else {
              console.log('Нет данных трека для центрирования карты');
            }
          } else {
            console.warn('Контейнер карты имеет нулевой размер:', containerWidth, 'x', containerHeight);
            
            // Проверяем через 500мс и повторно инвалидируем размер
            setTimeout(() => {
              try {
                if (mapInstanceRef.current) {
                  // Повторная проверка размеров
                  const newWidth = mapInstanceRef.current._container?.offsetWidth;
                  const newHeight = mapInstanceRef.current._container?.offsetHeight;
                  
                  console.log(`Повторная проверка размеров: ${newWidth}x${newHeight}`);
                  
                  if (newWidth > 0 && newHeight > 0) {
                    mapInstanceRef.current.invalidateSize({animate: false});
                    console.log('Повторное обновление размера карты выполнено');
                    
                    // Центрирование, если есть данные трека
                    if (trackData.length > 0) {
                      try {
                        const routePoints = trackData.map(point => [point.latitude, point.longitude]);
                        const bounds = L.latLngBounds(routePoints);
                        if (bounds.isValid()) {
                          mapInstanceRef.current.fitBounds(bounds, {
                            padding: [50, 50],
                            maxZoom: 15,
                            animate: false
                          });
                        }
                      } catch (centerError) {
                        console.error('Ошибка при центрировании после повторной проверки:', centerError);
                      }
                    }
                  } else {
                    console.log('Размер карты все еще нулевой, пробуем инициализировать заново');
                    // Если размер все еще нулевой, пробуем полную реинициализацию
                    setTimeout(() => {
                      if (mapContainerRef.current) {
                        initializeMap();
                      }
                    }, 200);
                  }
                } else {
                  console.log('Инициализация карты заново из-за отсутствия экземпляра карты');
                  if (mapContainerRef.current) {
                    initializeMap();
                  }
                }
              } catch (retryError) {
                console.error('Ошибка при повторной попытке обновления карты:', retryError);
                // Если все еще проблемы, пробуем полностью реинициализировать карту
                if (mapContainerRef.current) {
                  setTimeout(() => initializeMap(), 200);
                }
              }
            }, 500);
          }
        } else {
          console.warn('Контейнер карты не найден в DOM или экземпляр карты отсутствует');
          
          // Если элемент не существует, возможно он был удален при изменении DOM
          // Пробуем реинициализировать карту полностью
          console.log('Элемент карты не найден, пробуем полную реинициализацию');
          if (mapContainerRef.current) {
            setTimeout(() => initializeMap(), 300);
          } else {
            console.error('Контейнер для инициализации не найден');
          }
        }
      } catch (error) {
        console.error('Ошибка при обновлении размера карты:', error);
        // При серьезной ошибке пробуем полностью реинициализировать карту
        if (mapContainerRef.current) {
          setTimeout(() => initializeMap(), 500);
        }
      }
    }, 300); // Увеличиваем задержку для обеспечения корректной перерисовки
  };
  
  // Функция для обновления положения временного слайдера
  const updateTimeSlider = (index) => {
    const slider = document.querySelector('.tm-time-slider');
    if (slider && trackData.length > 0) {
      slider.value = (index / (trackData.length - 1)) * 100;
      
      // Обновляем позицию анимированного маркера
      updateAnimatedMarker(index);
      
      // Сохраняем текущий индекс точки в ref вместо state
      // для предотвращения ошибок линтера
      animatedMarkerRef.current._currentPointIndex = index;
    }
  };
  
  // Обновление позиции анимированного маркера
  const updateAnimatedMarker = (index) => {
    if (!animatedMarkerRef.current || !trackData[index]) return;
    
    try {
      const point = trackData[index];
      const position = [point.latitude, point.longitude];
      
      // Обновляем позицию маркера
      animatedMarkerRef.current.setLatLng(position);
      
      // Обновляем содержимое всплывающего окна
      animatedMarkerRef.current.setPopupContent(`
        <strong>${currentVehicle?.name || 'Транспорт'}</strong><br>
        Дата: ${formatDate(point.timestamp)}<br>
        Скорость: ${point.speed} км/ч<br>
        Высота: ${point.altitude} м<br>
        Курс: ${point.course}°<br>
        Спутники: ${point.satellites}<br>
      `);
    } catch (error) {
      console.error('Ошибка при обновлении анимированного маркера:', error);
    }
  };
  
  
  
  
  // Получение процента загрузки трека (для примера)
  // eslint-disable-next-line no-unused-vars
  const getLoadingProgress = () => {
    return loadingProgress;
  };
  
  // Отрисовка компонента загрузки
  const renderLoading = () => (
    <div className="tm-loading">
      <div className="tm-loading-spinner"></div>
      <div className="tm-loading-text">
        {loadingStatus} ({loadingProgress}%)
      </div>
      <div className="tm-loading-progress-bar">
        <div 
          className="tm-loading-progress" 
          style={{ width: `${loadingProgress}%` }}
        ></div>
      </div>
    </div>
  );
  
  // Отрисовка контролов управления картой
  const renderMapControls = () => (
    <div className="tm-controls">
      <div className="tm-control-group">
        <button 
          className="tm-control-button tm-refresh-button"
          onClick={fetchTrackData}
          title="Обновить данные"
        >
          <FontAwesomeIcon icon={faSyncAlt} />
        </button>
      </div>
      
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
                onClick={() => changeSplitMode('single')}
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
          onClick={toggleExpandedMode}
          title={expandedMode ? "Свернуть" : "На весь экран"}
        >
          <FontAwesomeIcon icon={expandedMode ? faCompress : faExpand} />
        </button>
      </div>
    </div>
  );
  
  // Получение классов для контейнера карты в зависимости от режима
  const getMapContainerClasses = () => {
    let classes = 'tm-container';
    
    if (expandedMode) {
      classes += ' tm-expanded';
    }
    
    return classes;
  };
  
  // Добавляем обработчик изменения размера окна
  useEffect(() => {
    const handleResize = () => {
      // Добавляем детальный логгинг
      
      console.log('Обработка события изменения размера окна');
      
      // Проверяем, активна ли вкладка
      if (document.hidden) {
        console.log('Вкладка скрыта, откладываем обработку resize до активации');
        return;
      }
      
      // Проверяем существование контейнера
      if (!mapContainerRef.current) {
        console.warn('Контейнер карты не найден при изменении размера окна');
        return;
      }
      
      // Проверяем видимость контейнера
      const rect = mapContainerRef.current.getBoundingClientRect();
      const isContainerVisible = rect.width > 0 && rect.height > 0;
      
      console.log(`Размеры контейнера карты: ${rect.width}x${rect.height}, виден: ${isContainerVisible}`);
      
      // Проверяем, существует ли экземпляр карты
      if (!mapInstanceRef.current) {
        console.warn('Экземпляр карты не найден при изменении размера окна');
        
        // Если карта не была инициализирована, делаем это
        if (mapContainerRef.current && !mapInitialized) {
          console.log('Инициализация карты при resize...');
          initializeMap();
        } else if (mapContainerRef.current && mapInitialized) {
          console.log('Карта отмечена как инициализированная, но экземпляр отсутствует. Повторная инициализация...');
          setTimeout(() => initializeMap(), 300);
        }
        return;
      }
      
      // Если контейнер невидим, проверяем его снова через определенный интервал
      if (!isContainerVisible) {
        console.warn('Контейнер карты невидим при событии resize');
        
        // Ждем немного и проверяем снова
        setTimeout(() => {
          if (!mapContainerRef.current) return;
          
          const newRect = mapContainerRef.current.getBoundingClientRect();
          const isNowVisible = newRect.width > 0 && newRect.height > 0;
          
          console.log(`Повторная проверка размеров: ${newRect.width}x${newRect.height}, виден: ${isNowVisible}`);
          
          if (isNowVisible) {
            console.log('Контейнер стал видимым, обновляем карту');
            refreshMapView();
          } else {
            console.warn('Контейнер все еще невидим после повторной проверки');
            
            // Еще одна проверка через более длительное время
            setTimeout(() => {
              if (!mapContainerRef.current) return;
              
              const finalRect = mapContainerRef.current.getBoundingClientRect();
              console.log(`Финальная проверка размеров: ${finalRect.width}x${finalRect.height}`);
              
              if (finalRect.width > 0 && finalRect.height > 0) {
                console.log('Контейнер стал видимым после длительного ожидания');
                
                // Проверяем существование карты
                if (!mapInstanceRef.current) {
                  console.warn('Экземпляр карты не найден, инициализируем заново');
                  initializeMap();
                } else {
                  refreshMapView();
                }
              }
            }, 1000);
          }
        }, 500);
        return;
      }
      
      // Если все проверки прошли успешно, обновляем карту
      refreshMapView();
    };
    
    // Регистрируем обработчик
    window.addEventListener('resize', handleResize);
    
    // Также добавляем обработчик видимости вкладки
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Вкладка стала видимой, обновляем карту');
        
        // Задержка, чтобы дать время браузеру полностью отрисовать DOM
        setTimeout(() => {
          // Проверяем существование контейнера
          if (!mapContainerRef.current) {
            console.warn('Контейнер карты не найден при восстановлении видимости вкладки');
            return;
          }
          
          // Проверяем размеры контейнера
          const rect = mapContainerRef.current.getBoundingClientRect();
          const isContainerVisible = rect.width > 0 && rect.height > 0;
          
          console.log(`При активации вкладки размеры: ${rect.width}x${rect.height}, виден: ${isContainerVisible}`);
          
          if (isContainerVisible) {
            if (!mapInstanceRef.current) {
              console.log('Экземпляр карты отсутствует, инициализируем заново');
              initializeMap();
            } else {
              refreshMapView();
            }
          } else {
            console.warn('Контейнер карты невидим при восстановлении видимости вкладки');
          }
        }, 300);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Обработчик события изменения разделения экрана
    const handleSplitChanged = () => {
      console.log('Получено событие изменения разделения экрана');
      
      // Даем немного времени для перерисовки DOM
      setTimeout(() => {
        if (!mapContainerRef.current) {
          console.warn('Контейнер карты не найден при изменении разделения экрана');
          return;
        }
        
        // Проверяем размеры контейнера после разделения экрана
        const rect = mapContainerRef.current.getBoundingClientRect();
        const isContainerVisible = rect.width > 0 && rect.height > 0;
        
        console.log(`После разделения экрана: ${rect.width}x${rect.height}, виден: ${isContainerVisible}`);
        
        if (isContainerVisible) {
          if (!mapInstanceRef.current) {
            console.log('Экземпляр карты не найден после разделения, инициализируем заново');
            initializeMap();
          } else {
            refreshMapView();
          }
        } else {
          console.warn('Контейнер карты невидим после разделения экрана');
          
          // Проверим еще раз через большую задержку
          setTimeout(() => {
            if (!mapContainerRef.current) return;
            
            const newRect = mapContainerRef.current.getBoundingClientRect();
            if (newRect.width > 0 && newRect.height > 0) {
              console.log('Контейнер стал видимым после задержки');
              
              if (!mapInstanceRef.current) {
                initializeMap();
              } else {
                refreshMapView();
              }
            }
          }, 800);
        }
      }, 300);
    };
    
    document.addEventListener('splitChanged', handleSplitChanged);
    
    // При монтировании компонента тоже вызываем обработчик
    setTimeout(handleResize, 500);
    
    // Очищаем обработчики при размонтировании компонента
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('splitChanged', handleSplitChanged);
    };
  }, [mapInitialized]);
  
  // Переключение полноэкранного режима
  const toggleExpandedMode = () => {
    setExpandedMode(!expandedMode);
    
    // Перерисовываем карту при изменении размера
    refreshMapView();
  };
  
  // Изменение режима разделения экрана
  const changeSplitMode = (mode) => {
    try {
      console.log(`TrackMap: Изменение режима разделения на ${mode}`);
      
      if (mode === 'single') {
        // Сбрасываем все разделения
        const success = splitScreenManager.changeSplitMode(SPLIT_MODES.SINGLE);
        
        if (success) {
          console.log('TrackMap: Режим разделения успешно изменен на single');
          
          // Создаем и отправляем событие о смене режима разделения
          const event = new CustomEvent('splitModeChanged', {
            detail: { mode }
          });
          document.dispatchEvent(event);
        } else {
          console.warn('TrackMap: Не удалось изменить режим разделения на single');
        }
      } else if (mode === 'horizontal' || mode === 'vertical') {
        // Вызываем соответствующие обработчики для разделения
        if (mode === 'horizontal') {
          handleHorizontalSplit();
        } else {
          handleVerticalSplit();
        }
      }
      
      // Сохраняем в localStorage
      localStorage.setItem('splitScreenMode', mode);
      
      // Перерисовываем карту при изменении режима через небольшую задержку
      setTimeout(() => refreshMapView(), 300);
    } catch (error) {
      console.error('TrackMap: Ошибка при изменении режима разделения:', error);
    }
  };
  
  
  // Обработчик события выбора транспорта
  const handleVehicleSelected = (event) => {
    try {
      const newVehicle = event.detail;
      
      if (!newVehicle) {
        console.warn('Получены пустые данные в событии vehicleSelected');
        return;
      }
      
      if (!newVehicle.id) {
        console.warn('Получено транспортное средство без ID:', newVehicle);
        return;
      }
      
      console.log('Обработка события выбора транспортного средства:', newVehicle);
      
      // Проверяем, не выбран ли тот же самый транспорт
      if (currentVehicle && currentVehicle.id === newVehicle.id) {
        console.log('Выбран тот же транспорт, обновление не требуется');
        return;
      }
      
      // Добавляем метку времени для принудительного обновления
      const vehicleWithTimestamp = {
        ...newVehicle,
        _updateTimestamp: new Date().getTime(),
        _source: 'props'
      };
      
      // Обновляем текущий транспорт
      setCurrentVehicle(vehicleWithTimestamp);
      
      // Сохраняем в localStorage и обновляем данные
      saveVehicleToLocalStorage(newVehicle);
      
      // Если диапазон дат уже выбран, проверяем их валидность перед обновлением данных
      if (currentDateRange.startDate && currentDateRange.endDate) {
        const startIsValid = currentDateRange.startDate instanceof Date && 
                            !isNaN(currentDateRange.startDate.getTime());
        const endIsValid = currentDateRange.endDate instanceof Date && 
                          !isNaN(currentDateRange.endDate.getTime());
        
        if (!startIsValid || !endIsValid) {
          console.warn('Обнаружены невалидные даты при выборе транспорта, корректирую:', {
            startDate: currentDateRange.startDate,
            endDate: currentDateRange.endDate
          });
          
          // Создаем валидный диапазон - неделя до текущей даты
          const validEndDate = new Date();
          const validStartDate = new Date(validEndDate);
          validStartDate.setDate(validEndDate.getDate() - 7);
          
          const updatedRange = {
            startDate: validStartDate,
            endDate: validEndDate
          };
          
          setCurrentDateRange(updatedRange);
          saveDateRangeToLocalStorage(updatedRange);
          
          console.log('Обновление трека с автоматически скорректированным диапазоном дат:', {
            vehicle: newVehicle.name,
            startDate: formatDate(validStartDate),
            endDate: formatDate(validEndDate)
          });
        } else {
          console.log('Обновление трека из-за события выбора транспортного средства:', {
            vehicle: newVehicle.name,
            startDate: formatDate(currentDateRange.startDate),
            endDate: formatDate(currentDateRange.endDate)
          });
        }
        
        // Небольшая задержка, чтобы состояние успело обновиться
        setTimeout(() => fetchTrackData(), 100);
      } else {
        console.log('Транспортное средство выбрано, но диапазон дат не определен');
        
        // Создаем валидный диапазон по умолчанию - неделя до текущей даты
        const validEndDate = new Date();
        const validStartDate = new Date(validEndDate);
        validStartDate.setDate(validEndDate.getDate() - 7);
        
        const updatedRange = {
          startDate: validStartDate,
          endDate: validEndDate
        };
        
        setCurrentDateRange(updatedRange);
        saveDateRangeToLocalStorage(updatedRange);
        
        console.log('Обновление трека с диапазоном дат по умолчанию:', {
          vehicle: newVehicle.name,
          startDate: formatDate(validStartDate),
          endDate: formatDate(validEndDate)
        });
        
        // Небольшая задержка, чтобы состояние успело обновиться
        setTimeout(() => fetchTrackData(), 100);
      }
    } catch (error) {
      console.error('Ошибка при обработке события выбора транспортного средства:', error);
    }
  };
  
  
  // Функция для принудительного обновления данных карты извне
  window.updateTrackMap = () => {
    try {
      console.log('Вызвана функция принудительного обновления карты');
      
      // Проверяем, что карта инициализирована
      if (!mapInitialized || !mapInstanceRef.current) {
        console.log('Карта не инициализирована, выполняем инициализацию');
        initializeMap();
        return;
      }
      
      // Проверяем наличие данных для обновления
      if (!currentVehicle || !currentVehicle.id) {
        console.warn('Невозможно обновить данные: не выбрано транспортное средство');
        
        // Проверяем localStorage для получения транспорта
        try {
          const savedVehicle = localStorage.getItem('lastSelectedVehicle');
          if (savedVehicle) {
            const parsedVehicle = JSON.parse(savedVehicle);
            if (parsedVehicle && parsedVehicle.id) {
              console.log('Найден транспорт в localStorage, используем его:', parsedVehicle);
              
              // Добавляем источник данных
              parsedVehicle._source = 'localStorage_update';
              parsedVehicle._updateTimestamp = new Date().getTime();
              
              setCurrentVehicle(parsedVehicle);
              
              // Проверяем даты перед загрузкой
              if (currentDateRange && currentDateRange.startDate && currentDateRange.endDate) {
                setTimeout(() => fetchTrackData(), 250);
                return true;
              }
            }
          }
        } catch (error) {
          console.warn('Ошибка при получении транспорта из localStorage:', error);
        }
        
        return false;
      }
      
      if (!currentDateRange || !currentDateRange.startDate || !currentDateRange.endDate) {
        console.warn('Невозможно обновить данные: не выбран диапазон дат');
        return false;
      }
      
      // Выполняем обновление данных
      console.log('Принудительное обновление данных трека:', {
        vehicle: currentVehicle.name,
        startDate: formatDate(currentDateRange.startDate),
        endDate: formatDate(currentDateRange.endDate)
      });
      
      fetchTrackData();
      return true;
    } catch (error) {
      console.error('Ошибка при принудительном обновлении карты:', error);
      return false;
    }
  };
  
  // Добавляем еще один эффект для события синхронизации в рамках текущей вкладки
  useEffect(() => {
    const handleVehicleSelectedInTab = (event) => {
      try {
        const { vehicle, timestamp } = event.detail;
        
        // Проверяем, был ли этот выбор сделан нами
        if (window.lastVehicleUpdateTime === timestamp) {
          console.log('Игнорируем собственное событие vehicleSelectedInTab');
          return;
        }
        
        if (vehicle && vehicle.id && (!currentVehicle || currentVehicle.id !== vehicle.id)) {
          console.log('Получено событие vehicleSelectedInTab:', vehicle);
          
          const updatedVehicle = {
            ...vehicle,
            _updateTimestamp: timestamp,
            _source: 'inTabEvent'
          };
          
          setCurrentVehicle(updatedVehicle);
          
          // Если диапазон дат уже выбран, обновляем данные
          if (currentDateRange.startDate && currentDateRange.endDate) {
            setTimeout(() => fetchTrackData(), 250);
          }
        }
      } catch (error) {
        console.error('Ошибка при обработке события vehicleSelectedInTab:', error);
      }
    };
    
    document.addEventListener('vehicleSelectedInTab', handleVehicleSelectedInTab);
    
    return () => {
      document.removeEventListener('vehicleSelectedInTab', handleVehicleSelectedInTab);
    };
  }, [currentVehicle, currentDateRange]);
  
  // Добавляем еще один эффект для события синхронизации дат в рамках текущей вкладки
  useEffect(() => {
    const handleDateRangeChangedInTab = (event) => {
      try {
        const { startDate, endDate, timestamp } = event.detail;
        
        // Проверяем, был ли этот выбор сделан нами
        if (window.lastDateUpdateTime === timestamp) {
          console.log('Игнорируем собственное событие dateRangeChangedInTab');
          return;
        }
        
        console.log('Получено событие dateRangeChangedInTab:', {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        });
        
        // Проверяем, изменились ли даты
        let datesChanged = false;
        
        if (!currentDateRange.startDate || !currentDateRange.endDate) {
          datesChanged = true;
        } else {
          const startDiff = Math.abs(currentDateRange.startDate.getTime() - startDate.getTime()) > 1000;
          const endDiff = Math.abs(currentDateRange.endDate.getTime() - endDate.getTime()) > 1000;
          datesChanged = startDiff || endDiff;
        }
        
        if (datesChanged) {
          console.log('Даты изменились, обновляем состояние');
          
          const updatedRange = {
            startDate: ensureValidDate(startDate),
            endDate: ensureValidDate(endDate)
          };
          
          setCurrentDateRange(updatedRange);
          
          // Если есть текущее транспортное средство, обновляем данные
          if (currentVehicle && currentVehicle.id && mapInitialized) {
            setTimeout(() => fetchTrackData(), 300);
          }
        }
      } catch (error) {
        console.error('Ошибка при обработке события dateRangeChangedInTab:', error);
      }
    };
    
    document.addEventListener('dateRangeChangedInTab', handleDateRangeChangedInTab);
    
    return () => {
      document.removeEventListener('dateRangeChangedInTab', handleDateRangeChangedInTab);
    };
  }, [currentVehicle, currentDateRange, mapInitialized]);
  
  // Эффект для обработки создания новых разделенных панелей и добавления в них контента
  useEffect(() => {
    // Функция для обработки события создания новой панели
    const handlePanelCreated = (event) => {
      try {
        if (!event.detail || !event.detail.panelId) return;
        
        const { panelId, splitDirection } = event.detail;
        console.log('Создана новая панель:', panelId, 'тип разделения:', splitDirection);
        
      } catch (error) {
        console.error('Ошибка при обработке события создания панели:', error);
      }
    };
    
    // Регистрируем обработчик события
    document.addEventListener('splitPanelCreated', handlePanelCreated);
    
    // Очищаем обработчик при размонтировании
    return () => {
      document.removeEventListener('splitPanelCreated', handlePanelCreated);
    };
  }, [currentVehicle, currentDateRange]);
  
  
  
  
  // Функция для разделения экрана по горизонтали
  const handleHorizontalSplit = () => {
    // Находим контейнер перед разделением
    const container = mapContainerRef.current?.closest('.split-screen-container');
    if (!container) {
      console.error('TrackMap: Не удалось найти контейнер для разделения');
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
      console.error('TrackMap: У контейнера нет ID для разделения');
      return;
    }
    
    console.log(`TrackMap: Разделяем контейнер ${targetContainerId} горизонтально`);
    
    // Сохраняем направление разделения
    setSplitDirection('horizontal');
    
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
  };

  // Функция для разделения экрана по вертикали
  const handleVerticalSplit = () => {
    // Находим контейнер перед разделением
    const container = mapContainerRef.current?.closest('.split-screen-container');
    if (!container) {
      console.error('TrackMap: Не удалось найти контейнер для разделения');
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
      console.error('TrackMap: У контейнера нет ID для разделения');
      return;
    }
    
    console.log(`TrackMap: Разделяем контейнер ${targetContainerId} вертикально`);
    
    // Сохраняем направление разделения
    setSplitDirection('vertical');
    
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
  };
  
  // Обработчик события изменения режима разделения экрана
  const handleSplitModeChanged = (event) => {
    const newSplitMode = event.detail.mode;
    
    // Сохраняем в localStorage
    localStorage.setItem('splitScreenMode', newSplitMode);
    
    // Перерисовываем карту при изменении режима
    refreshMapView();
  };
  
  // Эффект для регистрации обработчика события завершения разделения контейнера
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
        console.log(`TrackMap: Получено событие завершения разделения для нашего контейнера ${containerId}`);
        console.log(`TrackMap: Новые контейнеры: ${container1Id}, ${container2Id}, направление: ${direction}`);
        
        // Устанавливаем флаг, что модальное окно вызвано
        modalTriggered = true;
        
        // Открываем окно выбора отчета для второго контейнера
        setContainerToFill(container2Id);
        setShowReportChooser(true);
        
        // Сохраняем направление разделения
        setSplitDirection(direction);
        
        // Устанавливаем флаг глобально, что модальное окно открыто
        window.reportChooserModalOpen = true;
        
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
      const { containerId: targetContainerId, direction, activateContainer } = event.detail;
      
      // Проверяем глобальный флаг, что модальное окно еще не открыто где-то
      if (window.reportChooserModalOpen) {
        console.log(`TrackMap: Пропускаем запрос выбора отчета, модальное окно уже открыто в другом экземпляре`);
        return;
      }
      
      // Проверяем локальное состояние
      if (showReportChooser || modalRequested) {
        console.log(`TrackMap: Пропускаем повторный запрос выбора отчета, так как модальное окно уже ${showReportChooser ? 'открыто' : 'запрошено'}`);
        return;
      }
      
      // Устанавливаем флаг, что запрос обработан
      modalRequested = true;
      
      // Устанавливаем глобальный флаг
      window.reportChooserModalOpen = true;
      
      console.log(`TrackMap: Получен запрос на открытие селектора отчетов для контейнера ${targetContainerId}`);
      
      // Устанавливаем целевой контейнер и открываем выбор отчета
      setContainerToFill(targetContainerId);
      
      // Активируем контейнер для выбора отчета, если требуется
      if (activateContainer) {
        const container = document.getElementById(targetContainerId) || 
                         document.querySelector(`[data-container-id="${targetContainerId}"]`);
        
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
            
            console.log(`TrackMap: Активирован контейнер ${targetContainerId} для выбора отчета`);
          }
        }
      }
      
      // Открываем выбор отчета
      console.log('TrackMap: Открываем диалог выбора отчета (setShowReportChooser(true))');
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

  // Обработчик выбора отчета для разделенного экрана
  const handleReportSelect = (selectedReportType) => {
    try {
      // Закрываем выбор отчета сразу, чтобы избежать повторных вызовов
      console.log('TrackMap: handleReportSelect - закрываем окно выбора отчета');
      setShowReportChooser(false);
      // Сбрасываем глобальный флаг
      window.reportChooserModalOpen = false;
      
      if (containerToFill) {
        // Если у нас есть контейнер для заполнения из события разделения,
        // создаем отчет для этого контейнера
        console.log(`TrackMap: Создаем отчет типа ${selectedReportType} для контейнера ${containerToFill}`);
        
        // Дополнительный вывод для отладки информации о состоянии и контейнере
        console.log('TrackMap: Детали создания отчета:', { 
          containerToFill,
          vehicle: currentVehicle,
          startDate: currentDateRange.startDate, 
          endDate: currentDateRange.endDate 
        });
        
        // Проверяем существование контейнера в DOM перед созданием отчета
        const targetContainer = document.getElementById(containerToFill) || 
                        document.querySelector(`[data-container-id="${containerToFill}"]`);
                        
        if (!targetContainer) {
          console.warn(`TrackMap: Целевой контейнер ${containerToFill} не найден в DOM, отмена создания отчета`);
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
            vehicle: currentVehicle,
            startDate: currentDateRange.startDate,
            endDate: currentDateRange.endDate,
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
        
        // Сбрасываем контейнер и направление
        setContainerToFill(null);
        setSplitDirection(null);
        return;
      }
      
      // Проверяем, что направление разделения было установлено
      if (!splitDirection) {
        console.warn('TrackMap: Попытка разделения экрана без указания направления');
        return;
      }
      
      // Создаем событие для создания отчета в контейнере
      const createEvent = new CustomEvent('createReportInContainer', {
        detail: {
          reportType: selectedReportType,
          direction: splitDirection,
          containerId: containerId,
          vehicle: currentVehicle,
          startDate: currentDateRange.startDate,
          endDate: currentDateRange.endDate,
          timestamp: Date.now()
        }
      });
      
      document.dispatchEvent(createEvent);
      
      // Сбрасываем направление разделения
      setSplitDirection(null);
    } catch (error) {
      console.error('TrackMap: Ошибка при обработке выбора отчета:', error);
      
      // Сбрасываем глобальный флаг в случае ошибки
      window.reportChooserModalOpen = false;
      
      // Показываем ошибку в уведомлении, если доступно
      if (window.showNotification) {
        window.showNotification('error', 'Ошибка при создании отчета: ' + (error.message || 'Неизвестная ошибка'));
      }
    }
  };
  
  // Закрытие окна выбора отчета
  const handleReportChooserClose = () => {
    console.log('TrackMap: Закрытие окна выбора отчета');
    setShowReportChooser(false);
    setSplitDirection(null);
    setContainerToFill(null); // Сбрасываем контейнер для заполнения
    
    // Сбрасываем глобальный флаг
    window.reportChooserModalOpen = false;
    
    console.log('TrackMap: Окно выбора отчета должно быть закрыто, showReportChooser =', false);
  };
  
  // Добавляем эффект для периодической проверки состояния карты
  useEffect(() => {
    // Функция для проверки и автоматического восстановления карты
    const checkMapState = () => {
      // Проверяем наличие контейнера
      if (!mapContainerRef.current) {
        console.log('Периодическая проверка: контейнер карты не найден');
        return;
      }
      
      // Проверяем видимость контейнера
      const rect = mapContainerRef.current.getBoundingClientRect();
      const isContainerVisible = rect.width > 0 && rect.height > 0;
      
      // Если контейнер видим, но экземпляр карты отсутствует
      if (isContainerVisible && !mapInstanceRef.current && mapInitialized) {
        console.log('Периодическая проверка: контейнер видим, но карта не инициализирована. Восстанавливаем...');
        initializeMap();
        return;
      }
      
      // Если экземпляр карты существует, проверяем его контейнер
      if (mapInstanceRef.current) {
        try {
          const mapContainer = mapInstanceRef.current._container;
          
          // Проверяем, что контейнер экземпляра карты все еще в DOM
          const mapContainerInDOM = mapContainer && document.body.contains(mapContainer);
          
          if (!mapContainerInDOM) {
            console.log('Периодическая проверка: контейнер карты был удален из DOM. Восстанавливаем...');
            // Сбрасываем экземпляр и переинициализируем
            mapInstanceRef.current = null;
            initializeMap();
            return;
          }
          
          // Проверяем размеры контейнера карты
          const mapContainerVisible = mapContainer && 
                                     mapContainer.offsetWidth > 0 && 
                                     mapContainer.offsetHeight > 0;
          
          if (!mapContainerVisible && isContainerVisible) {
            console.log('Периодическая проверка: контейнер карты невидим, но родительский контейнер видим. Восстанавливаем...');
            // Обновляем размер карты
            setTimeout(() => {
              try {
                if (mapInstanceRef.current) {
                  mapInstanceRef.current.invalidateSize({animate: false});
                  
                  // Центрируем карту на трек, если он есть
                  if (trackData.length > 0) {
                    try {
                      const routePoints = trackData.map(point => [point.latitude, point.longitude]);
                      const bounds = L.latLngBounds(routePoints);
                      if (bounds.isValid()) {
                        mapInstanceRef.current.fitBounds(bounds, {
                          padding: [50, 50],
                          maxZoom: 15,
                          animate: false
                        });
                      }
                    } catch (error) {
                      console.error('Ошибка при центрировании карты:', error);
                    }
                  }
                }
              } catch (error) {
                console.error('Ошибка при обновлении размера карты:', error);
              }
            }, 200);
          }
        } catch (error) {
          console.error('Ошибка при периодической проверке карты:', error);
        }
      }
    };
    
    // Запускаем периодическую проверку каждые 5 секунд
    const checkInterval = setInterval(checkMapState, 5000);
    
    // Очищаем интервал при размонтировании
    return () => {
      clearInterval(checkInterval);
    };
  }, [mapInitialized, trackData]);
  
  // Добавляем обработчик события выделения диапазона из графиков
  useEffect(() => {
    // Функция-обработчик для события выделения диапазона
    const handleRangeSelected = (event) => {
      try {
        const { startTime, endTime, source } = event.detail;
        
        console.log('TrackMap: Получено событие выделения диапазона:', {
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          source
        });
        
        if (!trackData || trackData.length === 0) {
          console.warn('TrackMap: Не удалось выделить диапазон - данные трека отсутствуют');
          return;
        }
        
        // Сохраняем выделенный диапазон
        setSelectedRange({
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          source
        });
        
        // Запускаем зумирование карты на выбранный диапазон
        zoomToTimeRange(new Date(startTime), new Date(endTime));
      } catch (error) {
        console.error('TrackMap: Ошибка при обработке выделения диапазона:', error);
      }
    };
    
    // Регистрируем обработчик события
    document.addEventListener('rangeSelected', handleRangeSelected);
    
    // Очищаем обработчик при размонтировании
    return () => {
      document.removeEventListener('rangeSelected', handleRangeSelected);
    };
  }, [trackData]);


  // Функция для выделения сегмента трека другим цветом
  const highlightTrackSegment = (startIdx, endIdx) => {
    try {
      // Очищаем предыдущее выделение
      clearHighlightedSegment();
      
      // Проверяем наличие данных и границ
      if (!trackData || !trackData.length || startIdx < 0 || endIdx >= trackData.length || startIdx > endIdx) {
        console.warn('TrackMap: Некорректные индексы для выделения сегмента трека', { startIdx, endIdx });
        return;
      }
      
      console.log(`TrackMap: Выделение сегмента трека с ${startIdx} по ${endIdx}`);
      
      // Создаем массив координат для выделенного сегмента
      const segmentCoords = trackData.slice(startIdx, endIdx + 1).map(point => [point.lat, point.lng]);
      
      // Создаем полилинию для выделенного сегмента
      if (segmentCoords.length > 1) {
        if (mapInstanceRef.current) {
          const highlightLine = L.polyline(segmentCoords, {
            color: '#FF6B00',
            weight: 5,
            opacity: 0.8,
            lineJoin: 'round'
          }).addTo(mapInstanceRef.current);
          
          // Сохраняем ссылку на выделенный сегмент
          highlightedPathRef.current = highlightLine;
        }
      }
    } catch (error) {
      console.error('TrackMap: Ошибка при выделении сегмента трека:', error);
    }
  };

  /**
   * Подсвечивает указанную точку трека и обновляет положение маркера
   * @param {number} pointIndex - индекс точки в массиве trackData
   */
  const highlightTrackPoint = (pointIndex) => {
    try {
      // Проверяем наличие данных и валидность индекса
      if (!trackData || !trackData.length || pointIndex < 0 || pointIndex >= trackData.length) {
        console.warn('TrackMap: Некорректный индекс точки для подсветки', pointIndex);
        return;
      }
      
      const point = trackData[pointIndex];
      console.log(`TrackMap: Подсветка точки трека с индексом ${pointIndex}`, point);
      
      // Проверяем наличие координат (используем правильные имена свойств)
      if (!point.latitude || !point.longitude) {
        console.warn('TrackMap: Точка не содержит координат', point);
        return;
      }
      
      // Перемещаем карту к выбранной точке
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([point.latitude, point.longitude], mapInstanceRef.current.getZoom());
      }
      
      // Перемещаем анимированный маркер к выбранной точке
      if (animatedMarkerRef.current) {
        // Устанавливаем новые координаты
        animatedMarkerRef.current.setLatLng([point.latitude, point.longitude]);
        
        // Сохраняем текущий индекс точки в маркере
        animatedMarkerRef.current._currentPointIndex = pointIndex;
        
        // Обновляем всплывающее окно с информацией о точке
        const popupContent = `
          <div class="map-popup">
            <h4>${currentVehicle?.name || 'Транспорт'}</h4>
            <div class="map-popup-details">
              <p><strong>Дата:</strong> ${formatDate(point.timestamp)}</p>
              <p><strong>Время:</strong> ${formatTime(point.timestamp)}</p>
              <p><strong>Скорость:</strong> ${point.speed} км/ч</p>
              ${point.altitude ? `<p><strong>Высота:</strong> ${point.altitude} м</p>` : ''}
              ${point.course ? `<p><strong>Курс:</strong> ${point.course}°</p>` : ''}
              ${point.satellites ? `<p><strong>Спутники:</strong> ${point.satellites}</p>` : ''}
            </div>
          </div>
        `;
        
        animatedMarkerRef.current.setPopupContent(popupContent);
        
        // Открываем всплывающее окно
        animatedMarkerRef.current.openPopup();
      }
      
      // Визуально выделяем точку на треке (например, можно добавить круг вокруг точки)
      if (mapInstanceRef.current) {
        // Удаляем предыдущий круг, если он существует
        if (window.selectedPointCircle) {
          mapInstanceRef.current.removeLayer(window.selectedPointCircle);
        }
        
        // Создаем новый круг в месте выбранной точки
        window.selectedPointCircle = L.circleMarker([point.latitude, point.longitude], {
          radius: 8,
          color: '#FF4500',
          fillColor: '#FFA500',
          fillOpacity: 0.7,
          weight: 2
        }).addTo(mapInstanceRef.current);
      }
      
      // Синхронизируем с графиками через handleManualSync
      if (typeof handleManualSync === 'function') {
        setTimeout(() => {
          try {
            handleManualSync(pointIndex);
          } catch (err) {
            console.error('TrackMap: Ошибка при вызове handleManualSync из highlightTrackPoint:', err);
          }
        }, 0);
      }
    } catch (error) {
      console.error('TrackMap: Ошибка при подсветке точки трека:', error);
    }
  };
  
  /**
   * Вспомогательная функция для форматирования даты
   */
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Н/Д';
    const date = new Date(timestamp);
    return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };
  
  /**
   * Вспомогательная функция для форматирования времени
   */
  const formatTime = (timestamp) => {
    if (!timestamp) return 'Н/Д';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ru-RU');
  };

  // Функция для очистки выделения сегмента трека
  const clearHighlightedSegment = () => {
    try {
      if (mapInstanceRef.current && highlightedPathRef.current) {
        mapInstanceRef.current.removeLayer(highlightedPathRef.current);
        highlightedPathRef.current = null;
        console.log('TrackMap: Выделение сегмента трека очищено');
      }
    } catch (error) {
      console.error('TrackMap: Ошибка при очистке выделения сегмента трека:', error);
    }
  };

  // Обработчик события сброса выделения диапазона
  useEffect(() => {
    const handleRangeReset = () => {
      try {
        console.log('TrackMap: Получено событие сброса выделения диапазона');
        
        // Сбрасываем выделенный диапазон
        setSelectedRange(null);
        
        // Очищаем выделение сегмента трека
        clearHighlightedSegment();
        
        // Возвращаем зум на весь трек
        if (mapInstanceRef.current && trackData && trackData.length > 0) {
          const allCoords = trackData.map(point => [point.latitude, point.longitude]);
          const bounds = L.latLngBounds(allCoords);
          
          if (bounds.isValid()) {
            mapInstanceRef.current.fitBounds(bounds, {
              padding: [50, 50],
              maxZoom: 15,
              animate: true
            });
          }
        }
      } catch (error) {
        console.error('TrackMap: Ошибка при сбросе выделения диапазона:', error);
      }
    };
    
    // Регистрируем обработчик события
    document.addEventListener('rangeReset', handleRangeReset);
    
    // Очищаем обработчик при размонтировании
    return () => {
      document.removeEventListener('rangeReset', handleRangeReset);
    };
  }, [trackData]);

 

  // Добавляем обработчик события выбора точки из графиков
  useEffect(() => {
    // Для отслеживания последних выбранных точек и предотвращения зацикливания
    let lastSelectedPoint = {
      index: -1,
      timestamp: null,
      lastUpdateTime: 0
    };
    
    const handlePointSelected = (event) => {
      try {
        const { timestamp, source, index } = event.detail;
        
        // Текущее время для дебаунсинга
        const currentTime = Date.now();
        
        // Игнорируем события от самой карты
        if (source === 'trackMap' || source === containerId) {
          console.log('TrackMap: Игнорируем событие от самой карты', source);
          return;
        }
        
        // Защита от зацикливания - если получаем много событий за короткий промежуток
        if (currentTime - lastSelectedPoint.lastUpdateTime < 500) {
          console.log('TrackMap: Игнорируем частые события (дебаунсинг)', {
            lastUpdateTime: lastSelectedPoint.lastUpdateTime,
            currentTime: currentTime,
            diff: currentTime - lastSelectedPoint.lastUpdateTime
          });
          return;
        }
        
        // Проверка на странную дату из будущего, которая приводит к зацикливанию
        const eventDate = new Date(timestamp);
        const now = new Date();
        if (eventDate > now) {
          console.warn('TrackMap: Игнорируем событие с датой из будущего', {
            timestamp,
            currentDate: now.toISOString()
          });
          return;
        }
        
        console.log('TrackMap: Получено событие выбора точки:', {
          timestamp: timestamp ? new Date(timestamp).toISOString() : null,
          source,
          index
        });
        
        if (!trackData || trackData.length === 0) {
          console.warn('TrackMap: Невозможно выбрать точку - данные трека отсутствуют');
          return;
        }
        
        // Если есть прямой индекс, используем его
        if (typeof index === 'number' && index >= 0 && index < trackData.length) {
          console.log(`TrackMap: Используем прямой индекс точки: ${index}`);
          
          // Проверяем, не является ли это повторным выбором той же точки
          if (index === lastSelectedPoint.index && 
              currentTime - lastSelectedPoint.lastUpdateTime < 2000) {
            console.log('TrackMap: Игнорируем повторный выбор той же точки', index);
            return;
          }
          
          // Обновляем информацию о последней выбранной точке
          lastSelectedPoint = {
            index,
            timestamp: trackData[index].timestamp,
            lastUpdateTime: currentTime
          };
          
          highlightTrackPoint(index);
          return;
        }
        
        // Если нет индекса, но есть timestamp, находим ближайшую точку трека ко времени
        if (timestamp) {
          const timestampDate = new Date(timestamp);
          let closestPoint = null;
          let minTimeDiff = Infinity;
          let closestIndex = -1;

          trackData.forEach((point, index) => {
            const pointTime = new Date(point.timestamp);
            const timeDiff = Math.abs(pointTime.getTime() - timestampDate.getTime());
            
            if (timeDiff < minTimeDiff) {
              minTimeDiff = timeDiff;
              closestPoint = point;
              closestIndex = index;
            }
          });
          
          if (closestPoint) {
            console.log('TrackMap: Найдена ближайшая точка трека:', {
              time: new Date(closestPoint.timestamp).toISOString(),
              diff: minTimeDiff / 1000,
              index: closestIndex
            });
            
            // Проверяем, не является ли это повторным выбором той же точки
            if (closestIndex === lastSelectedPoint.index && 
                currentTime - lastSelectedPoint.lastUpdateTime < 2000) {
              console.log('TrackMap: Игнорируем повторный выбор той же точки по времени', closestIndex);
              return;
            }
            
            // Обновляем информацию о последней выбранной точке
            lastSelectedPoint = {
              index: closestIndex,
              timestamp: closestPoint.timestamp,
              lastUpdateTime: currentTime
            };
            
            highlightTrackPoint(closestIndex);
          }
        }
      } catch (error) {
        console.error('TrackMap: Ошибка при обработке события выбора точки:', error);
      }
    };
    
    // Регистрируем обработчик события
    document.addEventListener('pointSelected', handlePointSelected);
    document.addEventListener('chartPointSelected', handlePointSelected);
    
    // Очищаем обработчик при размонтировании
    return () => {
      document.removeEventListener('pointSelected', handlePointSelected);
      document.removeEventListener('chartPointSelected', handlePointSelected);
    };
  }, [trackData, containerId]);
  
  // Добавляем эффект для инициализации ChartSyncManager и регистрации контейнера карты
 // В функции useEffect для регистрации в ChartSyncManager
 useEffect(() => {
  // Идентификатор контейнера для синхронизации с графиками
  const syncContainerId = containerId;
  
  // Добавляем задержку для уверенности, что ChartSyncManager загрузился
  setTimeout(() => {
    try {
      console.log('TrackMap: Доступные глобальные переменные:', 
        typeof window.ChartSyncManager, 
        typeof chartSyncManager);
      
      // Проверяем наличие ChartSyncManager глобально или через импорт
      const syncManager = chartSyncManager || window.ChartSyncManager;
      
      // Выводим подробную информацию о syncManager
      if (syncManager) {
        console.log('TrackMap: SyncManager найден, методы:', 
          Object.keys(syncManager), 
          'тип registerContainer:', 
          typeof syncManager.registerContainer);
      }
      
      if (syncManager && typeof syncManager.registerContainer === 'function') {
        console.log(`TrackMap: Регистрация в ChartSyncManager, контейнер ${syncContainerId}, группа ${syncGroup}`);
        
        try {
          // Регистрируем для конкретной группы синхронизации и логируем результат
          const result = syncManager.registerContainer(syncContainerId, 'trackmap', syncGroup || '*');
          console.log('TrackMap: Результат регистрации контейнера:', result);
          
          // Если у нас есть данные трека, сообщим ChartSyncManager о количестве точек
          if (trackData && trackData.length > 0) {
            syncManager.setContainerDataLength(syncContainerId, trackData.length);
            console.log(`TrackMap: Установлена длина данных ${trackData.length} для контейнера ${syncContainerId}`);
          }
        } catch (registerError) {
          console.error('TrackMap: Ошибка при вызове registerContainer:', registerError);
        }
      } else {
        console.error('TrackMap: ChartSyncManager недоступен или не имеет метода registerContainer', 
          syncManager, 
          'registerContainer существует:', 
          syncManager && 'registerContainer' in syncManager);
        
        // Если метод есть, но это не функция, выводим его значение
        if (syncManager && 'registerContainer' in syncManager && typeof syncManager.registerContainer !== 'function') {
          console.log('TrackMap: registerContainer существует, но не является функцией:', syncManager.registerContainer);
        }
        
        // Попытка использовать альтернативный способ регистрации
        if (syncManager && typeof syncManager.register === 'function') {
          try {
            console.log('TrackMap: Попытка использовать метод register');
            syncManager.register(syncContainerId, 'trackmap', syncGroup || '*');
            console.log(`TrackMap: Контейнер ${syncContainerId} зарегистрирован через метод register`);
          } catch (altRegisterError) {
            console.error('TrackMap: Ошибка при использовании метода register:', altRegisterError);
          }
        }
        
        // Попытка инициализировать ChartSyncManager, если он недоступен
        if (typeof window.initChartSyncManager === 'function') {
          console.log('TrackMap: Попытка инициализировать ChartSyncManager');
          window.initChartSyncManager();
          
          // Повторная попытка регистрации после инициализации
          setTimeout(() => {
            const reloadedManager = chartSyncManager || window.ChartSyncManager;
            if (reloadedManager && typeof reloadedManager.registerContainer === 'function') {
              try {
                reloadedManager.registerContainer(syncContainerId, 'trackmap', syncGroup || '*');
                console.log('TrackMap: Повторная регистрация в ChartSyncManager выполнена');
              } catch (reloadError) {
                console.error('TrackMap: Ошибка при повторной регистрации:', reloadError);
              }
            } else {
              console.error('TrackMap: ChartSyncManager все еще не доступен после инициализации');
            }
          }, 500);
        }
      }
    } catch (error) {
      console.error('TrackMap: Ошибка при регистрации в ChartSyncManager:', error);
    }
  }, 2000); // Увеличиваем задержку до 2 секунд
  
  // Отменяем регистрацию при размонтировании
  return () => {
    try {
      const syncManager = chartSyncManager || window.ChartSyncManager;
      if (syncManager && typeof syncManager.unregisterContainer === 'function') {
        syncManager.unregisterContainer(syncContainerId);
        console.log(`TrackMap: Отмена регистрации в ChartSyncManager, контейнер ${syncContainerId}`);
      }
    } catch (error) {
      console.error('TrackMap: Ошибка при отмене регистрации в ChartSyncManager:', error);
    }
  };
}, [containerId, syncGroup, trackData?.length]);
  // Обновляем длину данных в ChartSyncManager при изменении trackData
  useEffect(() => {
    if (typeof chartSyncManager?.setContainerDataLength === 'function' && trackData?.length > 0) {
      try {
        chartSyncManager.setContainerDataLength(containerId, trackData.length);
        console.log(`TrackMap: Обновлена длина данных в ChartSyncManager: ${trackData.length} точек`);
      } catch (error) {
        console.error('TrackMap: Ошибка при обновлении длины данных в ChartSyncManager:', error);
      }
    }
  }, [trackData, containerId]);

  // Добавляем обработчик события выделения диапазона от ChartSyncManager
  useEffect(() => {
    // Функция для обработки события выделения от ChartSyncManager
    // Функция для обработки события выделения от ChartSyncManager
    const handleChartSyncSelection = (event) => {
      try {
        // Получаем данные о выделении
        const { 
          startDate, endDate, 
          startIndex, endIndex, 
          sourceId, groupId
        } = event.detail;
        
        // Принимаем события от всех групп
        console.log('TrackMap: Получено событие ChartSyncManager выделения диапазона:', {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          startIndex,
          endIndex,
          sourceId,
          groupId,
          myContainerId: containerId
        });
        
        // Проверяем, не мы ли источник события
        if (sourceId !== containerId) {
          // Сохраняем информацию о последнем диапазоне
          setLatestSyncTimeRange({
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            startIndex,
            endIndex
          });
          
          // Зумируем карту на временной диапазон
          try {
            zoomToTimeRange(new Date(startDate), new Date(endDate));
            console.log('TrackMap: Применено зумирование по событию от ChartSyncManager');
          } catch (e) {
            console.error('TrackMap: Ошибка при зумировании по событию:', e);
          }
        }
      } catch (error) {
        console.error('TrackMap: Ошибка при обработке выделения от ChartSyncManager:', error);
      }
    };
    
    // Регистрируем обработчик для события выделения от ChartSyncManager
    document.addEventListener('chartSyncSelectionChanged', handleChartSyncSelection);
    
    // Очистка при размонтировании
    return () => {
      document.removeEventListener('chartSyncSelectionChanged', handleChartSyncSelection);
    };
  }, [containerId, syncGroup]);


  // Добавляем эффект для ручной регистрации всех контейнеров графиков
useEffect(() => {
  // Функция для регистрации всех контейнеров в одной группе синхронизации
  const registerAllContainers = () => {
    try {
      console.log('TrackMap: Ручная регистрация контейнеров, группа:', syncGroup || (tabId ? `sync-chart-container-tab-${tabId}` : '*'));
      
      // Подробная проверка доступности ChartSyncManager
      let syncManager = null;
      
      // Пытаемся получить ChartSyncManager из разных источников
      if (typeof chartSyncManager === 'object' && chartSyncManager !== null) {
        syncManager = chartSyncManager;
        console.log('TrackMap: Используется chartSyncManager из импорта');
      } else if (typeof window.ChartSyncManager === 'object' && window.ChartSyncManager !== null) {
        syncManager = window.ChartSyncManager;
        console.log('TrackMap: Используется window.ChartSyncManager');
      } else if (typeof window.ChartSyncManager === 'function') {
        // Если ChartSyncManager - это конструктор
        try {
          syncManager = new window.ChartSyncManager();
          console.log('TrackMap: Создан новый экземпляр ChartSyncManager');
        } catch (error) {
          console.error('TrackMap: Ошибка при создании экземпляра ChartSyncManager:', error);
        }
      }
      
      // Проверяем полученный объект
      if (!syncManager) {
        console.warn('TrackMap: ChartSyncManager недоступен для ручной регистрации');
        // Выводим дополнительную информацию о состоянии
        console.log('TrackMap: chartSyncManager =', typeof chartSyncManager);
        console.log('TrackMap: window.ChartSyncManager =', typeof window.ChartSyncManager);
        
        // Проверяем, доступен ли скрипт
        const chartSyncManagerScript = document.querySelector('script[src*="ChartSyncManager"]');
        console.log('TrackMap: ChartSyncManager скрипт загружен:', !!chartSyncManagerScript);
        
        // Если скрипт не загружен, пытаемся загрузить
        if (!chartSyncManagerScript && typeof window.require === 'function') {
          try {
            console.log('TrackMap: Попытка динамически загрузить ChartSyncManager');
            window.require(['ChartSyncManager'], function() {
              console.log('TrackMap: ChartSyncManager загружен динамически');
              // После загрузки повторяем попытку регистрации
              setTimeout(registerAllContainers, 1000);
            });
          } catch (error) {
            console.error('TrackMap: Ошибка при динамической загрузке ChartSyncManager:', error);
          }
        }
        
        return;
      }
      
      // Проверяем метод регистрации
      if (typeof syncManager.registerContainer !== 'function') {
        console.warn('TrackMap: Метод registerContainer не является функцией', syncManager);
        console.log('TrackMap: Доступные методы:', Object.keys(syncManager));
        return;
      }
      
      console.log('TrackMap: ChartSyncManager доступен для регистрации');
      
      // Определяем группу синхронизации
      const currentSyncGroup = syncGroup || (tabId ? `sync-chart-container-tab-${tabId}` : '*');
      
      // Регистрируем текущий контейнер карты
      if (containerId) {
        try {
          console.log(`TrackMap: Регистрация карты с ID ${containerId} в группе ${currentSyncGroup}`);
          syncManager.registerContainer(containerId, 'trackmap', currentSyncGroup);
          
          // Если есть данные трека, устанавливаем длину данных
          if (trackData && trackData.length) {
            if (typeof syncManager.setContainerDataLength === 'function') {
              syncManager.setContainerDataLength(containerId, trackData.length);
              console.log(`TrackMap: Установлена длина данных: ${trackData.length}`);
            }
          }
        } catch (error) {
          console.error('TrackMap: Ошибка при регистрации контейнера карты:', error);
        }
      }
      
      // Регистрируем другие контейнеры с графиками
      try {
        // Ищем контейнеры по атрибуту data-chart-id
        const chartContainers = Array.from(document.querySelectorAll('[data-chart-id]'));
        console.log(`TrackMap: Найдено ${chartContainers.length} контейнеров с data-chart-id`);
        
        let registeredCount = 0;
        
        chartContainers.forEach(container => {
          const chartId = container.getAttribute('data-chart-id');
          if (chartId && chartId !== containerId) {
            try {
              syncManager.registerContainer(chartId, 'chart', currentSyncGroup);
              console.log(`TrackMap: Зарегистрирован график с ID ${chartId} в группе ${currentSyncGroup}`);
              registeredCount++;
            } catch (registerError) {
              console.error(`TrackMap: Ошибка при регистрации графика ${chartId}:`, registerError);
            }
          }
        });
        
        // Также ищем контейнеры по ID
        const idContainers = Array.from(document.querySelectorAll('[id^="chart-container-"]'));
        console.log(`TrackMap: Найдено ${idContainers.length} контейнеров с id="chart-container-*"`);
        
        idContainers.forEach(container => {
          const chartId = container.id;
          if (chartId && chartId !== containerId) {
            try {
              syncManager.registerContainer(chartId, 'chart', currentSyncGroup);
              console.log(`TrackMap: Зарегистрирован график с ID ${chartId} в группе ${currentSyncGroup}`);
              registeredCount++;
            } catch (registerError) {
              console.error(`TrackMap: Ошибка при регистрации графика ${chartId}:`, registerError);
            }
          }
        });
        
        console.log(`TrackMap: Всего зарегистрировано ${registeredCount} графиков`);
        
        // Оповещаем другие компоненты о регистрации
        if (registeredCount > 0) {
          document.dispatchEvent(new CustomEvent('chartContainersRegistered', { 
            detail: { 
              count: registeredCount, 
              group: currentSyncGroup,
              source: 'TrackMap.registerAllContainers'
            } 
          }));
        }
      } catch (error) {
        console.error('TrackMap: Ошибка при регистрации графиков:', error);
      }
    } catch (error) {
      console.error('TrackMap: Необработанная ошибка в registerAllContainers:', error);
    }
  };
  
  // Регистрируем обработчик для события активации вкладки
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      console.log('TrackMap: Вкладка активирована, регистрируем контейнеры');
      setTimeout(registerAllContainers, 1000);
    }
  };
  
  // Регистрируем обработчик для события обновления DOM
  const handleDomUpdated = () => {
    console.log('TrackMap: DOM обновлен, проверяем контейнеры');
    setTimeout(registerAllContainers, 500);
  };
  
  // Регистрируем обработчики
  document.addEventListener('visibilitychange', handleVisibilityChange);
  document.addEventListener('DOMContentLoaded', handleDomUpdated);
  document.addEventListener('chartRendered', handleDomUpdated);
  
  // Выполняем первую регистрацию через задержку
  const initialRegisterTimeout = setTimeout(registerAllContainers, 2000);
  // И повторно через 5 секунд для уверенности
  const secondRegisterTimeout = setTimeout(registerAllContainers, 5000);
  
  // Очищаем обработчики при размонтировании
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    document.removeEventListener('DOMContentLoaded', handleDomUpdated);
    document.removeEventListener('chartRendered', handleDomUpdated);
    clearTimeout(initialRegisterTimeout);
    clearTimeout(secondRegisterTimeout);
  };
}, [containerId, syncGroup, tabId, trackData]);
  // Добавляем обработчик события выбора точки от ChartSyncManager
  useEffect(() => {
    // Функция для обработки события выбора точки от ChartSyncManager
    const handleChartSyncPointSelected = (event) => {
      try {
        const { dataIndex, sourceId, groupId, timestamp } = event.detail;
        
        console.log('TrackMap: Получено событие выбора точки от ChartSyncManager:', {
          dataIndex,
          timestamp: timestamp ? new Date(timestamp).toISOString() : 'не указано',
          sourceId,
          groupId,
          myContainerId: containerId,
          myGroup: syncGroup
        });
        
        // Расширяем проверку группы
        if (groupId) {
          // Проверяем, не мы ли источник события
          if (sourceId !== containerId && trackData && trackData.length > 0) {
            // Если у нас есть точное время, найдем точку по времени
            if (timestamp) {
              // Находим ближайшую точку трека ко времени
              const timestampDate = new Date(timestamp);
              let closestPoint = null;
              let minTimeDiff = Infinity;
              let closestIndex = -1;
              
              trackData.forEach((point, index) => {
                const pointTime = new Date(point.timestamp);
                const timeDiff = Math.abs(pointTime.getTime() - timestampDate.getTime());
                
                if (timeDiff < minTimeDiff) {
                  minTimeDiff = timeDiff;
                  closestPoint = point;
                  closestIndex = index;
                }
              });
              
              if (closestPoint) {
                console.log('TrackMap: Найдена точка для выделения по времени:', {
                  pointTime: new Date(closestPoint.timestamp).toISOString(),
                  requestedTime: timestampDate.toISOString(),
                  diff: minTimeDiff / 1000,
                  index: closestIndex
                });
                highlightTrackPoint(closestIndex);
              }
            } 
            // Если у нас нет времени, но есть индекс данных, используем индекс
            else if (dataIndex !== undefined && dataIndex >= 0 && dataIndex < trackData.length) {
              const point = trackData[dataIndex];
              console.log('TrackMap: Выделение точки по индексу:', dataIndex);
              highlightTrackPoint(point, dataIndex);
            }
          }
        }
      } catch (error) {
        console.error('TrackMap: Ошибка при обработке выбора точки от ChartSyncManager:', error);
      }
    };
    
    // Регистрируем обработчик для события выбора точки от ChartSyncManager
    document.addEventListener('chartSyncPointSelected', handleChartSyncPointSelected);
    
    // Очистка при размонтировании
    return () => {
      document.removeEventListener('chartSyncPointSelected', handleChartSyncPointSelected);
    };
  }, [containerId, syncGroup, trackData]);

  // Обновляем функцию zoomToTimeRange для отправки события в ChartSyncManager
  const zoomToTimeRange = (startTime, endTime) => {
    try {
      console.log('TrackMap: Зумирование на временной диапазон:', { 
        startTime: startTime ? startTime.toISOString() : 'undefined', 
        endTime: endTime ? endTime.toISOString() : 'undefined',
        mapInstance: !!mapInstanceRef.current,
        trackDataLength: trackData ? trackData.length : 0
      });
      
      
      if (!mapInstanceRef.current) {
        console.warn('TrackMap: Невозможно зумировать - карта не инициализирована');
        return;
      }
      
      if (!trackData || trackData.length === 0) {
        console.warn('TrackMap: Невозможно зумировать - данные трека отсутствуют');
        return;
      }
      
      // Находим точки трека, которые попадают в выбранный временной диапазон
      const filteredPoints = trackData.filter(point => {
        const pointTime = new Date(point.timestamp);
        return pointTime >= startTime && pointTime <= endTime;
      });
      
      console.log(`TrackMap: Найдено ${filteredPoints.length} точек в выбранном диапазоне`);
      
      // Если нет точек в выбранном диапазоне, выходим
      if (filteredPoints.length === 0) {
        console.warn('TrackMap: В выбранном временном диапазоне нет точек трека');
        return;
      }
      
      // Получаем индексы первой и последней точки в диапазоне
      const startIndex = trackData.findIndex(point => 
        new Date(point.timestamp) >= startTime
      );
      
      const endIndex = trackData.findIndex(point => 
        new Date(point.timestamp) > endTime
      );
      
      const lastIndex = endIndex === -1 ? trackData.length - 1 : endIndex - 1;
      
      console.log(`TrackMap: Индексы выбранного диапазона: ${startIndex} - ${lastIndex}`);
      
      // Получаем координаты выбранных точек для зумирования
      const selectedCoords = filteredPoints.map(point => [point.latitude, point.longitude]);
      
      // Создаем границы для выбранных точек
      const bounds = L.latLngBounds(selectedCoords);
      
      // Проверяем, что bounds валидны
      if (!bounds.isValid()) {
        console.warn('TrackMap: Невозможно создать валидные границы для выбранных точек');
        return;
      }
      
      // Добавляем небольшой отступ к границам
      mapInstanceRef.current.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 17,
        animate: true
      });
      
      // Выделяем сегмент трека для визуализации выбранного диапазона
      highlightTrackSegment(filteredPoints);
      
      // Сохраняем выделенный диапазон
      setSelectedRange({
        startTime,
        endTime,
        startIndex,
        endIndex: lastIndex
      });
      
      // Отправляем событие в ChartSyncManager, если мы инициатор выделения
      // и это не ответ на событие от ChartSyncManager
      if (startIndex >= 0 && lastIndex >= 0 && 
          (!latestSyncTimeRange || 
           latestSyncTimeRange.startDate.getTime() !== startTime.getTime() || 
           latestSyncTimeRange.endDate.getTime() !== endTime.getTime())) {
        
        try {
          if (typeof chartSyncManager?.notifySelectionChanged === 'function') {
            chartSyncManager.notifySelectionChanged(
              containerId, 
              syncGroup,
              startIndex,
              lastIndex,
              startTime,
              endTime
            );
            
            console.log('TrackMap: Отправлено событие выделения в ChartSyncManager:', {
              startIndex,
              endIndex: lastIndex,
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString()
            });
          }
        } catch (error) {
          console.error('TrackMap: Ошибка при отправке события выделения в ChartSyncManager:', error);
        }
      }
      
      console.log('TrackMap: Зумирование на выбранный диапазон выполнено');
    } catch (error) {
      console.error('TrackMap: Ошибка при зумировании на временной диапазон:', error);
    }
  };

  useEffect(() => {
    // Функция для получения доступа к ChartSyncManager
    const getSyncManager = () => {
      // Проверяем разные варианты доступа к ChartSyncManager
      let manager = null;
      
      // Вариант 1: Через импорт
      if (typeof chartSyncManager === 'object' && chartSyncManager !== null) {
        manager = chartSyncManager;
        console.log('TrackMap: ChartSyncManager доступен через импорт');
      } 
      // Вариант 2: Через глобальный объект
      else if (typeof window.ChartSyncManager === 'object' && window.ChartSyncManager !== null) {
        manager = window.ChartSyncManager;
        console.log('TrackMap: ChartSyncManager доступен через window');
      }
      // Вариант 3: Инициализируем через глобальную функцию
      else if (typeof window.initChartSyncManager === 'function') {
        try {
          window.initChartSyncManager();
          console.log('TrackMap: Вызвана инициализация ChartSyncManager');
          
          // Проверяем результат инициализации
          if (typeof window.ChartSyncManager === 'object' && window.ChartSyncManager !== null) {
            manager = window.ChartSyncManager;
            console.log('TrackMap: ChartSyncManager инициализирован успешно');
          }
        } catch (error) {
          console.error('TrackMap: Ошибка при инициализации ChartSyncManager:', error);
        }
      }
      
      // Проверяем наличие необходимых методов
      if (manager) {
        console.log('TrackMap: Методы ChartSyncManager:', Object.keys(manager));
        
        if (typeof manager.registerContainer !== 'function') {
          console.error('TrackMap: Метод registerContainer отсутствует в ChartSyncManager');
          return null;
        }
      } else {
        console.error('TrackMap: ChartSyncManager недоступен ни через импорт, ни через window');
      }
      
      return manager;
    };
    
    // Функция для поиска и регистрации графиков
    const findAndRegisterCharts = () => {
      try {
        console.log('TrackMap: Запуск поиска и регистрации графиков');
        
        // Получаем текущую группу синхронизации
        const currentSyncGroup = syncGroup || (tabId ? `sync-chart-container-${tabId}` : '*');
        
        // Получаем доступ к ChartSyncManager через нашу функцию
        const syncManager = getSyncManager();
        
        if (!syncManager) {
          console.error('TrackMap: ChartSyncManager недоступен для регистрации графиков');
          return;
        }
        
        console.log('TrackMap: ChartSyncManager доступен, начинаем регистрацию');
        
        // Ищем все контейнеры графиков на странице
        const chartContainers = Array.from(document.querySelectorAll('[id^="chart-container-"]'));
        console.log(`TrackMap: Найдено ${chartContainers.length} контейнеров графиков`);
        
        // Проверяем существующие регистрации
        if (typeof syncManager.getRegisteredContainers === 'function') {
          const registered = syncManager.getRegisteredContainers();
          console.log('TrackMap: Уже зарегистрированные контейнеры:', registered);
        }
        
        // Регистрируем каждый контейнер графика в той же группе
        let registeredCount = 0;
        chartContainers.forEach(container => {
          const chartId = container.id;
          if (chartId && chartId !== containerId) {
            try {
              console.log(`TrackMap: Регистрация графика ${chartId} в группе ${currentSyncGroup}`);
              syncManager.registerContainer(chartId, 'chart', currentSyncGroup);
              registeredCount++;
            } catch (error) {
              console.error(`TrackMap: Ошибка при регистрации графика ${chartId}:`, error);
            }
          }
        });
        
        // Регистрируем наш контейнер карты
        if (containerId) {
          try {
            console.log(`TrackMap: Регистрация карты ${containerId} в группе ${currentSyncGroup}`);
            syncManager.registerContainer(containerId, 'trackmap', currentSyncGroup);
            registeredCount++;
            
            if (trackData && trackData.length > 0) {
              syncManager.setContainerDataLength(containerId, trackData.length);
              console.log(`TrackMap: Установлена длина данных ${trackData.length} для карты`);
            }
          } catch (error) {
            console.error(`TrackMap: Ошибка при регистрации карты ${containerId}:`, error);
          }
        }
        
        console.log(`TrackMap: Успешно зарегистрировано ${registeredCount} контейнеров`);
        
        // Создаем глобальное событие, чтобы другие компоненты могли отреагировать
        if (registeredCount > 0) {
          document.dispatchEvent(new CustomEvent('chartContainersRegistered', {
            detail: {
              count: registeredCount,
              source: 'TrackMap',
              syncGroup: currentSyncGroup
            }
          }));
        }
      } catch (error) {
        console.error('TrackMap: Ошибка при поиске и регистрации графиков:', error);
      }
    };
    
    // Выполняем поиск и регистрацию через интервалы времени
    // Небольшая задержка перед первой попыткой, чтобы ChartSyncManager успел загрузиться
    const firstTimeout = setTimeout(findAndRegisterCharts, 3000);
    // Вторая попытка через 6 секунд
    const secondTimeout = setTimeout(findAndRegisterCharts, 6000);
    // Третья попытка через 10 секунд
    const thirdTimeout = setTimeout(findAndRegisterCharts, 10000);
    
    // Создаем обработчик событий обновления DOM
    const handleDomUpdated = () => {
      console.log('TrackMap: DOM обновлен, запуск поиска графиков');
      setTimeout(findAndRegisterCharts, 1000);
    };
    
    // Регистрируем обработчики событий
    document.addEventListener('chartRendered', handleDomUpdated);
    document.addEventListener('splitChanged', handleDomUpdated);
    document.addEventListener('chartInitialized', handleDomUpdated);
    
    // Очистка при размонтировании
    return () => {
      clearTimeout(firstTimeout);
      clearTimeout(secondTimeout);
      clearTimeout(thirdTimeout);
      document.removeEventListener('chartRendered', handleDomUpdated);
      document.removeEventListener('splitChanged', handleDomUpdated);
      document.removeEventListener('chartInitialized', handleDomUpdated);
    };
  }, [containerId, syncGroup, tabId, trackData?.length]);

  // Добавляем эффект для автоматического исправления ChartSyncManager
  useEffect(() => {
    // Функция для исправления ChartSyncManager, если у него отсутствуют методы
    const fixChartSyncManager = () => {
      try {
        console.log('TrackMap: Проверка и исправление ChartSyncManager');
        
        // Проверяем доступность ChartSyncManager
        let syncManager = null;
        if (typeof chartSyncManager === 'object' && chartSyncManager !== null) {
          syncManager = chartSyncManager;
          console.log('TrackMap: ChartSyncManager доступен через импорт для исправления');
        } else if (typeof window.ChartSyncManager === 'object' && window.ChartSyncManager !== null) {
          syncManager = window.ChartSyncManager;
          console.log('TrackMap: ChartSyncManager доступен через window для исправления');
        }
        
        if (!syncManager) {
          console.error('TrackMap: ChartSyncManager недоступен для исправления');
          return;
        }
        
        // Проверяем наличие метода registerContainer
        if (typeof syncManager.registerContainer !== 'function') {
          console.log('TrackMap: Добавляем отсутствующие методы в ChartSyncManager');
          
          // Массив хранения контейнеров
          if (!syncManager.containers) {
            syncManager.containers = new Map();
          }
          
          // Массив хранения групп
          if (!syncManager.syncGroups) {
            syncManager.syncGroups = new Map();
          }
          
          // Добавляем метод регистрации контейнера
          syncManager.registerContainer = function(containerId, type, groupId) {
            console.log(`ChartSyncManager: Регистрация контейнера ${containerId} типа ${type} в группе ${groupId}`);
            
            // Добавляем контейнер в список
            syncManager.containers.set(containerId, { 
              id: containerId, 
              type: type, 
              groupId: groupId 
            });
            
            // Если группа еще не существует, создаем ее
            if (!syncManager.syncGroups.has(groupId)) {
              syncManager.syncGroups.set(groupId, new Set());
            }
            
            // Добавляем контейнер в группу
            syncManager.syncGroups.get(groupId).add(containerId);
            
            console.log(`ChartSyncManager: Контейнер ${containerId} зарегистрирован в группе ${groupId}`);
            
            // Создаем событие о регистрации
            document.dispatchEvent(new CustomEvent('chartContainerRegistered', {
              detail: { containerId, type, groupId }
            }));
            
            return true;
          };
          
          // Добавляем метод получения всех контейнеров
          syncManager.getRegisteredContainers = function() {
            return Array.from(syncManager.containers.keys());
          };
          
          // Добавляем метод для получения контейнеров группы
          syncManager.getGroupContainers = function(groupId) {
            if (syncManager.syncGroups.has(groupId)) {
              return Array.from(syncManager.syncGroups.get(groupId));
            }
            return [];
          };
          
          // Добавляем метод установки длины данных
          syncManager.setContainerDataLength = function(containerId, length) {
            const container = syncManager.containers.get(containerId);
            if (container) {
              container.dataLength = length;
              console.log(`ChartSyncManager: Установлена длина данных ${length} для ${containerId}`);
              return true;
            }
            return false;
          };
          
          // Улучшаем метод notifyPointSelected, чтобы он распространял события на все контейнеры группы
          const originalNotifyPointSelected = syncManager.notifyPointSelected;
          syncManager.notifyPointSelected = function(pointData, sourceId, groupId) {
            console.log(`ChartSyncManager: Улучшенный метод notifyPointSelected от ${sourceId} для группы ${groupId}`);
            
            // Вызываем оригинальный метод, если он существует
            if (typeof originalNotifyPointSelected === 'function') {
              originalNotifyPointSelected.call(syncManager, pointData, sourceId, groupId);
            }
            
            // Получаем все контейнеры группы
            const groupContainers = syncManager.getGroupContainers(groupId);
            console.log(`ChartSyncManager: Найдено ${groupContainers.length} контейнеров в группе ${groupId}`);
            
            // Если нет контейнеров, регистрируем текущий
            if (groupContainers.length === 0 && sourceId) {
              const type = sourceId.includes('chart') ? 'chart' : 'trackmap';
              syncManager.registerContainer(sourceId, type, groupId);
              console.log(`ChartSyncManager: Автоматически зарегистрирован контейнер ${sourceId} в группе ${groupId}`);
            }
            
            // Создаем пользовательское событие для распространения
            const event = new CustomEvent('pointSelected', {
              detail: {
                ...pointData,
                sourceId: sourceId,
                syncGroupId: groupId
              }
            });
            
            // Отправляем событие
            document.dispatchEvent(event);
            console.log(`ChartSyncManager: Отправлено событие pointSelected через DOM с группой ${groupId}`);
            
            return true;
          };
          
          console.log('TrackMap: ChartSyncManager успешно исправлен и дополнен методами');
        } else {
          console.log('TrackMap: ChartSyncManager имеет все необходимые методы');
        }
      } catch (error) {
        console.error('TrackMap: Ошибка при исправлении ChartSyncManager:', error);
      }
    };
    
    // Выполняем исправление один раз при загрузке
    fixChartSyncManager();
    
    // Также запускаем исправление после загрузки всех скриптов
    const onLoadHandler = () => {
      setTimeout(fixChartSyncManager, 1000);
    };
    
    // Добавляем обработчик загрузки страницы
    window.addEventListener('load', onLoadHandler);
    
    // Очищаем при размонтировании
    return () => {
      window.removeEventListener('load', onLoadHandler);
    };
  }, []);
  
  // Модифицируем обработчик клика для ручной синхронизации
  const handleManualSync = (pointIndex) => {
    console.log(`TrackMap: Ручная синхронизация точки #${pointIndex}`);
    
    if (!trackData || pointIndex < 0 || pointIndex >= trackData.length) {
      console.warn('TrackMap: Некорректный индекс точки для синхронизации:', pointIndex);
      return;
    }
    
    try {
      const pointData = trackData[pointIndex];
      const currentSyncGroup = syncGroup || (tabId ? `sync-chart-container-tab-${tabId}` : '*');
      
      console.log(`TrackMap: Ручная синхронизация точки с группой ${currentSyncGroup}`, pointData);
      
      // 1. Создаем событие с данными точки
      const pointEvent = new CustomEvent('pointSelected', {
        detail: {
          timestamp: pointData.timestamp,
          latitude: pointData.latitude,
          longitude: pointData.longitude,
          speed: pointData.speed,
          source: containerId || 'track-map',
          syncGroup: currentSyncGroup,
          index: pointIndex,
          totalPoints: trackData.length
        }
      });
      
      // 2. Отправляем событие через DOM
      document.dispatchEvent(pointEvent);
      console.log('TrackMap: Отправлено событие pointSelected через DOM');
      
      // 3. Также отправляем событие в формате, ожидаемом BaseChart
      if (typeof sendPointClickToCharts === 'function') {
        sendPointClickToCharts(pointIndex);
      }
      
      // 4. Если доступен ChartSyncManager, используем его метод notifyPointSelected
      try {
        if (window.ChartSyncManager && typeof window.ChartSyncManager.notifyPointSelected === 'function') {
          const chartPointData = {
            index: pointIndex,
            point: pointData,
            totalPoints: trackData.length,
            timestamp: pointData.timestamp,
            sourceId: containerId || 'track-map',
            syncGroupId: currentSyncGroup,
            label: pointData.timestamp,
            value: pointData.speed,
            reportType: 'trackmap',
            priority: 'high', // Для ускорения обработки
            syncGroupId: currentSyncGroup // Добавляем syncGroupId для использования переменной
          };
          
          console.log('TrackMap: Используем ChartSyncManager.notifyPointSelected для синхронизации');
          window.ChartSyncManager.notifyPointSelected(chartPointData);
          
          // Проверяем, сколько контейнеров в группе
          if (typeof window.ChartSyncManager.getGroupContainers === 'function') {
            const containers = window.ChartSyncManager.getGroupContainers(currentSyncGroup);
            console.log(`ChartSyncManager: Найдено ${containers ? containers.length : 0} контейнеров в группе ${currentSyncGroup}`);
          }
        }
      } catch (syncError) {
        console.error('TrackMap: Ошибка при использовании ChartSyncManager:', syncError);
      }
      
      // 5. Отправляем событие напрямую в canvas элементы графиков
      setTimeout(() => {
        try {
          // Найти все canvas элементы графиков
          const canvasElements = document.querySelectorAll('canvas[data-graph="true"], canvas.chartjs-render-monitor');
          
          if (canvasElements.length > 0) {
            console.log(`TrackMap: Найдено ${canvasElements.length} canvas-элементов графиков для прямой синхронизации`);
            
            // Создаем данные точки в формате BaseChart
            const chartPointData = {
              index: pointIndex,
              point: pointData,
              totalPoints: trackData.length,
              timestamp: pointData.timestamp,
              sourceId: containerId || 'track-map',
              syncGroupId: currentSyncGroup,
              label: pointData.timestamp,
              value: pointData.speed,
              reportType: 'trackmap',
              priority: 'high', // Для ускорения обработки
              syncGroupId: currentSyncGroup // Добавляем syncGroupId для использования переменной
            };
            
            // Для каждого canvas элемента
            canvasElements.forEach(canvas => {
              const event = new CustomEvent('directPointSelected', {
                detail: chartPointData
              });
              canvas.dispatchEvent(event);
            });
          }
        } catch (canvasError) {
          console.error('TrackMap: Ошибка при прямой синхронизации с canvas элементами:', canvasError);
        }
      }, 100);
    } catch (error) {
      console.error('TrackMap: Ошибка при ручной синхронизации:', error);
    }
  };
  
  // Добавляем эффект для прямой обработки событий от графиков
  useEffect(() => {
    // Функция для прямой обработки событий от графиков
    const handleDirectGraphEvents = () => {
      try {
        // Добавляем обработку событий directPointSelected от BaseChart графиков
        const handleDirectPointSelected = (event) => {
          try {
            const detail = event.detail;
            console.log('TrackMap: Получено прямое событие от графика:', detail);
            
            // Если источник - текущий контейнер, игнорируем
            if (detail.sourceId === containerId) {
              console.log('TrackMap: Игнорируем событие от самой карты');
              return;
            }
            
            // Если есть метка времени, ищем соответствующую точку по времени
            if (detail.timestamp && trackData && trackData.length > 0) {
              // Преобразуем timestamp в Date если нужно
              const targetTime = typeof detail.timestamp === 'string' ? 
                new Date(detail.timestamp) : 
                detail.timestamp instanceof Date ? 
                  detail.timestamp : 
                  new Date(detail.timestamp);
              
              let closestIndex = -1;
              let minDiff = Infinity;
              
              // Поиск ближайшей точки по времени
              trackData.forEach((point, index) => {
                const pointTime = typeof point.timestamp === 'string' ? 
                  new Date(point.timestamp) : 
                  point.timestamp instanceof Date ? 
                    point.timestamp : 
                    new Date(point.timestamp);
                
                const diff = Math.abs(pointTime - targetTime);
                if (diff < minDiff) {
                  minDiff = diff;
                  closestIndex = index;
                }
              });
              
              // Если нашли точку, выделяем ее
              if (closestIndex >= 0) {
                console.log(`TrackMap: Найдена точка по времени, индекс: ${closestIndex}, разница: ${minDiff}ms`);
                highlightTrackPoint(closestIndex);
                
                // Центрируем карту на выбранной точке
                if (mapInstanceRef.current) {
                  const point = trackData[closestIndex];
                  const latLng = L.latLng(point.latitude, point.longitude);
                  mapInstanceRef.current.setView(latLng, mapInstanceRef.current.getZoom());
                }
                
                return;
              }
            }
            
            // Если есть индекс, используем его напрямую
            if (typeof detail.index === 'number' && trackData && detail.index >= 0 && detail.index < trackData.length) {
              console.log(`TrackMap: Используем прямой индекс: ${detail.index}`);
              highlightTrackPoint(detail.index);
              
              // Центрируем карту на выбранной точке
              if (mapInstanceRef.current) {
                const point = trackData[detail.index];
                const latLng = L.latLng(point.latitude, point.longitude);
                mapInstanceRef.current.setView(latLng, mapInstanceRef.current.getZoom());
              }
            }
          } catch (error) {
            console.error('TrackMap: Ошибка при обработке прямого события от графика:', error);
          }
        };
        
        // Создаем обработчик для прослушивания событий от canvas элементов
        document.querySelectorAll('canvas[data-graph="true"], canvas.chartjs-render-monitor').forEach(canvas => {
          canvas.addEventListener('directPointSelected', handleDirectPointSelected);
        });
        
        // Также добавляем глобальный обработчик для новых элементов
        document.addEventListener('directPointSelected', handleDirectPointSelected);
        
        // Добавляем обработчик события "chartRendered" для обнаружения новых графиков
        const handleNewChart = () => {
          // Ищем новые canvas элементы графиков
          setTimeout(() => {
            document.querySelectorAll('canvas[data-graph="true"], canvas.chartjs-render-monitor').forEach(canvas => {
              // Проверяем, есть ли уже обработчик
              const hasHandler = canvas.__hasDirectPointSelectedHandler;
              if (!hasHandler) {
                canvas.addEventListener('directPointSelected', handleDirectPointSelected);
                canvas.__hasDirectPointSelectedHandler = true;
              }
            });
          }, 500);
        };
        
        // Регистрируем обработчик для событий рендеринга графиков
        document.addEventListener('chartRendered', handleNewChart);
        document.addEventListener('chartInitialized', handleNewChart);
        
        // Очистка при размонтировании
        return () => {
          document.querySelectorAll('canvas[data-graph="true"], canvas.chartjs-render-monitor').forEach(canvas => {
            canvas.removeEventListener('directPointSelected', handleDirectPointSelected);
          });
          
          document.removeEventListener('directPointSelected', handleDirectPointSelected);
          document.removeEventListener('chartRendered', handleNewChart);
          document.removeEventListener('chartInitialized', handleNewChart);
        };
      } catch (error) {
        console.error('TrackMap: Ошибка при настройке прямой обработки событий графика:', error);
      }
    };
    
    // Запускаем настройку прямых обработчиков
    const cleanupDirectHandlers = handleDirectGraphEvents();
    
    // Очистка при размонтировании
    return () => {
      if (typeof cleanupDirectHandlers === 'function') {
        cleanupDirectHandlers();
      }
    };
  }, [containerId, syncGroup, trackData, highlightTrackPoint, mapInstanceRef]);
  
  // Добавляем обработчик для ручной отправки событий в графики при клике на точках
  useEffect(() => {
    if (!trackData || trackData.length === 0) return;
    
    // Функция для отправки события клика в графики
    window.sendPointClickToCharts = (pointIndex) => {
      if (pointIndex < 0 || pointIndex >= trackData.length) return;
      
      try {
        const pointData = trackData[pointIndex];
        const currentSyncGroup = syncGroup || (tabId ? `sync-chart-container-tab-${tabId}` : '*');
        
        // Создаем данные точки в формате BaseChart
        const chartPointData = {
          sourceContainerId: containerId || 'track-map', // Исправлено: используем sourceContainerId как в BaseChart
          timestamp: new Date(pointData.timestamp).getTime(), // Исправлено: конвертируем timestamp в число
          pointIndex: pointIndex, // Исправлено: используем pointIndex как в BaseChart
          datasetIndex: 0, // Добавляем datasetIndex для совместимости с BaseChart
          label: pointData.timestamp,
          value: pointData.speed,
          reportType: 'trackmap',
          priority: 'high', // Для ускорения обработки
          syncGroupId: currentSyncGroup // Добавляем syncGroupId для использования переменной
        };
        
        // Создаем и отправляем событие точно такое же, какое ожидает BaseChart
        const chartEvent = new CustomEvent('chartPointSelected', {
          detail: chartPointData,
          bubbles: false // Предотвращаем всплытие события для лучшей производительности
        });
        
        document.dispatchEvent(chartEvent);
        console.log('TrackMap: Отправлено событие chartPointSelected при выделении точки', chartPointData);
      } catch (error) {
        console.error('TrackMap: Ошибка при отправке события клика в графики:', error);
      }
    };
    
    return () => {
      // Очистка при размонтировании
      delete window.sendPointClickToCharts;
    };
  }, [trackData, syncGroup, tabId, containerId]);

  // Обновляем функцию handleMapClick для использования highlightTrackPoint
  const handleMapClick = (e) => {
    try {
      console.log('TrackMap: Click на карте', e);
      
      // Если нет данных трека, выходим
      if (!trackData || trackData.length === 0) {
        console.warn('TrackMap: Нет данных трека для обработки клика');
        return;
      }
      
      // Выводим пример данных точки для проверки
      console.log('TrackMap: Пример данных точки:', trackData[0]);
      
      // Координаты клика
      const { lat, lng } = e.latlng;
      
      // Ищем ближайшую точку трека
      let closestIndex = -1;
      let minDistance = Infinity;
      
      // Перебираем все точки трека
      trackData.forEach((point, index) => {
        // Координаты точки трека (используем latitude/longitude)
        const pointLat = point.latitude;
        const pointLng = point.longitude;
        
        // Проверяем наличие координат
        if (pointLat && pointLng) {
          // Рассчитываем расстояние (простая Евклидова метрика)
          const distance = Math.sqrt(
            Math.pow(pointLat - lat, 2) + 
            Math.pow(pointLng - lng, 2)
          );
          
          // Если расстояние меньше текущего минимального, обновляем
          if (distance < minDistance) {
            minDistance = distance;
            closestIndex = index;
          }
        }
      });
      
      // Если нашли ближайшую точку
      if (closestIndex >= 0) {
        console.log('TrackMap: Найдена ближайшая точка:', trackData[closestIndex], 'индекс:', closestIndex);
        
        // Подсвечиваем точку
        highlightTrackPoint(closestIndex);
        
        // Отправляем событие chartPointSelected напрямую в графики
        if (typeof window.sendPointClickToCharts === 'function') {
          window.sendPointClickToCharts(closestIndex);
        }
        
        // Выполняем ручную синхронизацию с графиками
        handleManualSync(closestIndex);
      } else {
        console.warn('TrackMap: Не удалось найти ближайшую точку к клику');
      }
    } catch (error) {
      console.error('TrackMap: Ошибка при обработке клика на карте:', error);
    }
  };
  
  // Главный метод рендеринга компонента - добавляем ReportChooser
  return (
    <>
      <SplitScreenContainer
        id={containerId}
        data-container-id={containerId}
        className="split-screen-container"
        showControls={true}
        allowSplit={true}
        onSplitChange={(splitInfo) => {
          console.log('TrackMap: Получено событие разделения экрана', splitInfo);
          // После разделения обновим карту
          setTimeout(() => {
            // Проверяем, существует ли экземпляр карты после разделения
            if (!mapInstanceRef.current && mapContainerRef.current) {
              console.log('После разделения карта не инициализирована, инициализируем');
              initializeMap();
            } else {
              console.log('После разделения обновляем размер карты');
              refreshMapView();
            }
          }, 300);
        }}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <div 
          className={getMapContainerClasses()} 
          id={`inner-${containerId}`}
          data-component-type="trackMap"
          data-splitscreen="true"
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {isLoading && renderLoading()}
          
          <div className="tm-header">
            <div className="tm-title">
              <FontAwesomeIcon icon={faRoute} />
              <span>Трек: {currentVehicle?.name || 'Транспорт не выбран'}</span>
            </div>
            {renderMapControls()}
          </div>
          
          <div className="tm-content" style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <div 
              className="tm-map-wrapper" 
              ref={mapContainerRef}
              style={{ 
                width: '100%', 
                height: '100%', 
                position: 'relative' 
              }}
            >
              {/* Контейнер для карты */}
              <div 
                id={`map-${tabId || 'default'}`} 
                className="tm-map-instance"
                style={{ 
                  width: '100%', 
                  height: '100%',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  zIndex: 1
                }}
              ></div>
              
            </div>
            
          </div>
        </div>
      </SplitScreenContainer>
      
      {/* Модальное окно выбора отчета */}
      {showReportChooser && (
        <ReportChooser 
          onSelectReport={handleReportSelect}
          onClose={handleReportChooserClose}
          selectedVehicle={currentVehicle}
          originalReport="trackmap"
          containerId={containerId}
        />
      )}
    </>
  );
};

export default TrackMap; 