import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faExpand, faCompress, faSyncAlt, 
  faRoute, faColumns, faRedo, faWindowRestore, faTachometerAlt, faGasPump, faList
} from '@fortawesome/free-solid-svg-icons';
import splitScreenManager, { SPLIT_MODES } from '../../utils/SplitScreenManager';

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
  const [isSplitView, setIsSplitView] = useState(false);
  const [splitType, setSplitType] = useState('single'); // 'single', 'horizontal', 'vertical', 'quad'
  const [currentVehicle, setCurrentVehicle] = useState(vehicle);
  const [currentDateRange, setCurrentDateRange] = useState({ startDate, endDate });
  
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
  
  // Инициализация при монтировании компонента
  useEffect(() => {
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
        setSplitType(savedSplitMode);
        setIsSplitView(savedSplitMode !== 'single');
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
        setSplitType(newSplitMode);
        setIsSplitView(newSplitMode !== 'single');
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
        console.error(`Элемент с ID ${mapElementId} не найден`);
        return;
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
            console.error(`Элемент с ID ${mapElementId} не найден после задержки`);
            return;
          }
          
          // Инициализируем карту Leaflet с обработкой ошибок
          const map = L.map(mapElementId, {
            center: [43.238949, 76.889709], // Центр Алматы по умолчанию
            zoom: 13,
            layers: [
                L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
                    attribution: '© Google',
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
    if (!mapInstanceRef.current || data.length === 0) return;
    
    console.log('Обновление карты с данными трека...');
    
    try {
      const map = mapInstanceRef.current;
      
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
      
      // Создаем массив точек для линии маршрута
      const routePoints = data.map(point => [point.latitude, point.longitude]);
      
      // Создаем линию маршрута
      const routePath = L.polyline(routePoints, {
        color: '#4e73df',
        weight: 4,
        opacity: 0.8,
        lineJoin: 'round'
      });
      
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
      
      // Отображаем весь трек на карте
      updateMapView();
      
      console.log('Карта обновлена с данными трека');
    } catch (error) {
      console.error('Ошибка при обновлении карты:', error);
    }
  };
  
  // Обновление представления карты с защитой от ошибок
  const updateMapView = () => {
    if (!mapInstanceRef.current || trackData.length === 0) return;
    
    try {
      // Проверяем, что карта и её контейнер все еще существуют
      if (!mapInstanceRef.current._container || !document.body.contains(mapInstanceRef.current._container)) {
        console.warn('Контейнер карты не найден при обновлении представления');
        return;
      }
      
      // Центрирование карты по всем точкам маршрута
      console.log('Центрирование карты по маршруту');
      
      const routePoints = trackData.map(point => [point.latitude, point.longitude]);
      const bounds = L.latLngBounds(routePoints);
      
      // Устанавливаем границы с небольшим отступом и отключаем анимацию для надежности
      mapInstanceRef.current.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 15,
        animate: false // Отключаем анимацию для предотвращения ошибок
      });
    } catch (error) {
      console.error('Ошибка при обновлении представления карты:', error);
    }
  };
  
  // Общая функция для обновления карты после изменения размера или режима с защитой от ошибок
  const refreshMapView = () => {
    // Даем время на отрисовку DOM перед обновлением карты
    setTimeout(() => {
      if (mapInstanceRef.current) {
        try {
          console.log('Обновление размера карты после изменения режима или размера');
          // Проверяем, что контейнер карты существует и видим
          if (mapInstanceRef.current._container && 
              document.body.contains(mapInstanceRef.current._container) &&
              mapInstanceRef.current._container.offsetWidth > 0 &&
              mapInstanceRef.current._container.offsetHeight > 0) {
              
            mapInstanceRef.current.invalidateSize({animate: false});
            
            if (trackData.length > 0) {
              updateMapView();
            }
          } else {
            console.warn('Контейнер карты невидим или имеет нулевой размер');
          }
        } catch (error) {
          console.error('Ошибка при обновлении размера карты:', error);
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
        Топливо: ${point.fuel}%
      `);
    } catch (error) {
      console.error('Ошибка при обновлении анимированного маркера:', error);
    }
  };
  
  
  // Форматирование даты для отображения
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
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
  
  // Получение классов для контейнера карты в зависимости от режима разделения
  const getMapContainerClasses = () => {
    let classes = 'tm-container split-screen-container';
    
    if (expandedMode) {
      classes += ' tm-expanded';
    }
    
    if (isSplitView) {
      classes += ' tm-split-view';
      classes += ` tm-split-${splitType}`;
    }
    
    return classes;
  };
  
  // Добавляем обработчик изменения размера окна
  useEffect(() => {
    const handleResize = () => {
      refreshMapView();
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
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
          setSplitType('single');
          setIsSplitView(false);
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
  
  // Функция для добавления специфического отчета, как в графиках
  const addSpecificReport = (reportType) => {
    try {
      console.log(`TrackMap: Добавление отчета типа ${reportType}`);
      
      // Создаем новое разделение для отчета
      const splitDirection = reportType === 'tripsList' ? 'vertical' : 'horizontal';
      
      // Создаем уникальный ID для новой панели
      const panelId = `report-panel-${Date.now()}`;
      
      // Добавляем новое разделение напрямую через splitScreenManager
      console.log(`TrackMap: Вызов splitScreenManager.addDynamicSplit для ${containerId} в направлении ${splitDirection}`);
      const success = splitScreenManager.addDynamicSplit(containerId, splitDirection, panelId);
      
      if (!success) {
        console.warn(`TrackMap: Не удалось создать ${splitDirection} разделение для отчета ${reportType}`);
        return;
      }
      
      // Обновляем состояние компонента после успешного разделения
      setSplitType(splitDirection);
      setIsSplitView(true);
      
      // Сохраняем в localStorage
      localStorage.setItem('splitScreenMode', splitDirection);
      
      // Находим созданную панель и добавляем в нее нужный отчет
      setTimeout(() => {
        const panelElement = document.getElementById(panelId);
        if (panelElement) {
          // Определяем компонент для загрузки
          let componentFunction;
          let title;
          
          switch (reportType) {
            case 'speedChart':
              componentFunction = createSpeedChartComponent;
              title = 'График скорости';
              break;
            case 'fuelChart':
              componentFunction = createFuelChartComponent;
              title = 'График топлива';
              break;
            case 'tripsList':
              componentFunction = createTripsListComponent;
              title = 'Список поездок';
              break;
            case 'trackMap':
            default:
              componentFunction = createTrackMapComponent;
              title = 'Карта трека';
          }
          
          // Добавляем необходимые атрибуты к панели для правильной работы разделения
          panelElement.setAttribute('data-component-type', reportType);
          panelElement.setAttribute('data-splitscreen', 'true');
          
          // Создаем заголовок панели с кнопками управления
          const header = document.createElement('div');
          header.className = 'panel-header';
          header.innerHTML = `
            <h3>${title}</h3>
            <div class="panel-header-controls">
              <button class="panel-control refresh-button" title="Обновить данные">
                <i class="fa fa-sync-alt"></i>
              </button>
              <button class="panel-control close-button" title="Закрыть панель">
                <i class="fa fa-times"></i>
              </button>
            </div>
          `;
          
          // Добавляем обработчики для кнопок в заголовке
          const refreshButton = header.querySelector('.refresh-button');
          if (refreshButton) {
            refreshButton.addEventListener('click', () => {
              // Обновляем данные в панели
              contentContainer.innerHTML = '';
              componentFunction(contentContainer, {
                vehicle: currentVehicle,
                startDate: currentDateRange.startDate,
                endDate: currentDateRange.endDate
              });
            });
          }
          
          const closeButton = header.querySelector('.close-button');
          if (closeButton) {
            closeButton.addEventListener('click', () => {
              // Закрываем панель напрямую через splitScreenManager
              splitScreenManager.removeSplit(panelId);
            });
          }
          
          panelElement.innerHTML = '';
          panelElement.appendChild(header);
          
          // Создаем контейнер для содержимого
          const contentContainer = document.createElement('div');
          contentContainer.className = 'panel-content';
          panelElement.appendChild(contentContainer);
          
          // Загружаем выбранный компонент
          componentFunction(contentContainer, {
            vehicle: currentVehicle,
            startDate: currentDateRange.startDate,
            endDate: currentDateRange.endDate
          });
        } else {
          console.error(`TrackMap: Не найдена созданная панель с ID ${panelId}`);
        }
      }, 300);
      
      // Перерисовываем карту при изменении режима
      setTimeout(() => refreshMapView(), 400);
    } catch (error) {
      console.error('TrackMap: Ошибка при добавлении отчета:', error);
    }
  };
  
  // Функция для загрузки компонента в созданную панель (улучшенная версия)
  const loadComponentIntoPanel = (panelId) => {
    try {
      const panelElement = document.getElementById(panelId);
      if (!panelElement) {
        console.warn(`TrackMap: Панель с ID ${panelId} не найдена`);
        return;
      }
      
      // Очищаем содержимое панели
      panelElement.innerHTML = '';
      
      // Определяем, какой отчет загрузить в панель
      const reportOptions = [
        { 
          type: 'trackMap', 
          title: 'Карта трека',
          icon: 'fa-route',
          description: 'Показывает маршрут транспорта на карте',
          component: createTrackMapComponent
        },
        { 
          type: 'speedChart', 
          title: 'График скорости',
          icon: 'fa-tachometer-alt',
          description: 'Показывает изменение скорости транспорта',
          component: createSpeedChartComponent
        },
        { 
          type: 'fuelChart', 
          title: 'График топлива',
          icon: 'fa-gas-pump',
          description: 'Показывает изменение уровня топлива',
          component: createFuelChartComponent 
        },
        { 
          type: 'tripsList', 
          title: 'Список поездок',
          icon: 'fa-list',
          description: 'Отображает список поездок и их параметры',
          component: createTripsListComponent 
        }
      ];
      
      // Создаем панель выбора отчета
      const selectorPanel = document.createElement('div');
      selectorPanel.className = 'report-selector-panel';
      selectorPanel.innerHTML = `
        <div class="report-selector-header">
          <h3>Выберите тип отчета для панели</h3>
        </div>
        <div class="report-selector-options"></div>
      `;
      
      const optionsContainer = selectorPanel.querySelector('.report-selector-options');
      
      // Добавляем опции выбора отчета
      reportOptions.forEach(report => {
        const option = document.createElement('div');
        option.className = 'report-option';
        option.innerHTML = `
          <div class="report-option-icon">
            <i class="fa ${report.icon}"></i>
          </div>
          <div class="report-option-content">
            <div class="report-option-title">${report.title}</div>
            <div class="report-option-description">${report.description}</div>
          </div>
        `;
        
        // Добавляем обработчик клика для выбора отчета
        option.addEventListener('click', () => {
          // Удаляем панель выбора
          selectorPanel.remove();
          
          // Добавляем атрибуты для правильной работы разделения
          panelElement.setAttribute('data-component-type', report.type);
          panelElement.setAttribute('data-splitscreen', 'true');
          
          // Создаем заголовок панели с кнопками управления
          const header = document.createElement('div');
          header.className = 'panel-header';
          header.innerHTML = `
            <h3><i class="fa ${report.icon}"></i> ${report.title}</h3>
            <div class="panel-header-controls">
              <button class="panel-control refresh-button" title="Обновить данные">
                <i class="fa fa-sync-alt"></i>
              </button>
              <button class="panel-control close-button" title="Закрыть панель">
                <i class="fa fa-times"></i>
              </button>
            </div>
          `;
          
          // Добавляем обработчики для кнопок в заголовке
          const refreshButton = header.querySelector('.refresh-button');
          if (refreshButton) {
            refreshButton.addEventListener('click', () => {
              // Обновляем данные в панели
              contentContainer.innerHTML = '';
              report.component(contentContainer, {
                vehicle: currentVehicle,
                startDate: currentDateRange.startDate,
                endDate: currentDateRange.endDate
              });
            });
          }
          
          const closeButton = header.querySelector('.close-button');
          if (closeButton) {
            closeButton.addEventListener('click', () => {
              // Закрываем панель через splitScreenManager
              splitScreenManager.removeSplit(panelId);
            });
          }
          
          panelElement.appendChild(header);
          
          // Создаем контейнер для содержимого
          const contentContainer = document.createElement('div');
          contentContainer.className = 'panel-content';
          panelElement.appendChild(contentContainer);
          
          // Загружаем выбранный компонент
          report.component(contentContainer, {
            vehicle: currentVehicle,
            startDate: currentDateRange.startDate,
            endDate: currentDateRange.endDate
          });
        });
        
        optionsContainer.appendChild(option);
      });
      
      // Добавляем панель выбора в контейнер
      panelElement.appendChild(selectorPanel);
      
    } catch (error) {
      console.error('TrackMap: Ошибка при загрузке компонента в панель:', error);
      
      const panelElement = document.getElementById(panelId);
      if (panelElement) {
        panelElement.innerHTML = `<div class="error-message">Ошибка при загрузке компонента: ${error.message}</div>`;
      }
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
  
  // Обработчик события изменения режима разделения экрана
  const handleSplitModeChanged = (event) => {
    const newSplitMode = event.detail.mode;
    setSplitType(newSplitMode);
    setIsSplitView(newSplitMode !== 'single');
    
    // Сохраняем в localStorage
    localStorage.setItem('splitScreenMode', newSplitMode);
    
    // Перерисовываем карту при изменении режима
    refreshMapView();
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
        
        const { panelId, splitType } = event.detail;
        console.log('Создана новая панель:', panelId, 'тип разделения:', splitType);
        
        // Добавляем контент в созданную панель с небольшой задержкой
        setTimeout(() => {
          loadComponentIntoPanel(panelId, splitType);
        }, 200);
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
  
  // Функция для создания компонента карты трека
  const createTrackMapComponent = (container, props) => {
    try {
      console.log('Создание компонента карты трека в панели');
      
      if (!container) {
        console.error('Контейнер для карты трека не найден');
        return;
      }
      
      const { vehicle, startDate, endDate } = props || {};
      
      // Создаем мини-версию карты трека
      const mapContainer = document.createElement('div');
      mapContainer.className = 'mini-map-container';
      mapContainer.style.width = '100%';
      mapContainer.style.height = '100%';
      container.appendChild(mapContainer);
      
      // Инициализируем Leaflet карту
      const miniMap = L.map(mapContainer, {
        center: [55.7558, 37.6173], // Москва по умолчанию
        zoom: 10,
        zoomControl: true,
        attributionControl: true
      });
      
      // Добавляем базовый слой карты
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(miniMap);
      
      // Добавляем загрузку данных трека
      const fetchMiniTrackData = async () => {
        const loadingMessage = document.createElement('div');
        loadingMessage.className = 'mini-loading-message';
        loadingMessage.innerText = 'Загрузка данных трека...';
        container.appendChild(loadingMessage);
        
        try {
          if (!vehicle || !vehicle.id) {
            throw new Error('Транспорт не выбран');
          }
          
          if (!startDate || !endDate) {
            throw new Error('Даты не указаны');
          }
          
          // Здесь будет API запрос для получения данных трека
          // Для примера, используем имитацию данных
          setTimeout(() => {
            const fakeTrackData = generateFakeTrackData(vehicle.id);
            
            if (fakeTrackData.length === 0) {
              container.innerHTML = `
                <div class="no-data-message">
                  <i class="fa fa-route fa-3x" style="margin-bottom: 15px; color: #dde2e8;"></i>
                  <p>Нет данных трека за указанный период</p>
                </div>
              `;
              return;
            }
            
            renderMiniTrack(fakeTrackData, miniMap);
            container.removeChild(loadingMessage);
          }, 1000);
          
        } catch (error) {
          console.error('Ошибка при загрузке данных трека:', error);
          container.innerHTML = `
            <div class="error-message">
              Ошибка при загрузке данных трека: ${error.message}
            </div>
          `;
        }
      };
      
      // Вызываем функцию загрузки данных
      fetchMiniTrackData();
      
      // Добавляем обработчик для изменения размера карты
      window.addEventListener('resize', () => {
        if (miniMap) {
          miniMap.invalidateSize();
        }
      });
      
    } catch (error) {
      console.error('Ошибка при создании компонента карты трека:', error);
      container.innerHTML = `
        <div class="error-message">
          Ошибка при создании компонента карты трека: ${error.message}
        </div>
      `;
    }
  };
  
  // Функция для создания компонента графика скорости
  const createSpeedChartComponent = (container, props) => {
    try {
      console.log('Создание компонента графика скорости в панели');
      
      if (!container) {
        console.error('Контейнер для графика скорости не найден');
        return;
      }
      
      const { vehicle, startDate, endDate } = props || {};
      
      // Создаем сообщение о загрузке
      const loadingMessage = document.createElement('div');
      loadingMessage.className = 'chart-loading-message';
      loadingMessage.innerText = 'Загрузка данных графика скорости...';
      container.appendChild(loadingMessage);
      
      // Загрузка данных графика
      setTimeout(() => {
        container.removeChild(loadingMessage);
        
        // Проверяем наличие необходимых данных
        if (!vehicle || !vehicle.id) {
          container.innerHTML = `
            <div class="error-message">
              Транспорт не выбран
            </div>
          `;
          return;
        }
        
        if (!startDate || !endDate) {
          container.innerHTML = `
            <div class="error-message">
              Даты не указаны
            </div>
          `;
          return;
        }
        
        // Генерируем тестовые данные для графика
        const fakeSpeedData = generateFakeSpeedData();
        
        if (fakeSpeedData.length === 0) {
          container.innerHTML = `
            <div class="no-data-message">
              <i class="fa fa-tachometer-alt fa-3x" style="margin-bottom: 15px; color: #dde2e8;"></i>
              <p>Нет данных о скорости за указанный период</p>
            </div>
          `;
          return;
        }
        
        // Создаем контейнер для графика
        const chartContainer = document.createElement('div');
        chartContainer.className = 'speed-chart-container';
        chartContainer.style.width = '100%';
        chartContainer.style.height = '100%';
        container.appendChild(chartContainer);
        
        // Здесь будет создание графика на основе данных
        // Для демонстрации, создаем простой HTML-график
        renderSimpleSpeedChart(chartContainer, fakeSpeedData);
        
      }, 800);
      
    } catch (error) {
      console.error('Ошибка при создании компонента графика скорости:', error);
      container.innerHTML = `
        <div class="error-message">
          Ошибка при создании компонента графика скорости: ${error.message}
        </div>
      `;
    }
  };
  
  // Вспомогательная функция для расчета расстояния для поездки
  const calculateTripDistance = (points) => {
    let distance = 0;
    for (let i = 1; i < points.length; i++) {
      const p1 = points[i-1];
      const p2 = points[i];
      distance += getDistanceFromLatLonInKm(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
    }
    return distance;
  };
  
  // Функция для расчета расстояния между двумя точками по координатам
  const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Радиус Земли в км
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c; // Расстояние в км
    return d;
  };
  
  // Вспомогательная функция перевода градусов в радианы
  const deg2rad = (deg) => {
    return deg * (Math.PI/180);
  };
  
  // Функция для горизонтального разделения экрана
  const handleHorizontalSplit = () => {
    // Используем прямой вызов splitScreenManager вместо генерации события
    console.log(`TrackMap: Разделяем контейнер ${containerId} горизонтально`);
    
    try {
      // Напрямую вызываем метод addDynamicSplit
      const success = splitScreenManager.addDynamicSplit(containerId, 'horizontal');
      
      if (!success) {
        console.warn('TrackMap: Не удалось создать горизонтальное разделение');
      } else {
        // Обновляем состояние компонента после успешного разделения
        setSplitType('horizontal');
        setIsSplitView(true);
        
        // Сохраняем в localStorage
        localStorage.setItem('splitScreenMode', 'horizontal');
      }
      
      // Перерисовываем карту при изменении режима
      setTimeout(() => refreshMapView(), 300);
    } catch (error) {
      console.error('TrackMap: Ошибка при создании горизонтального разделения:', error);
    }
  };
  
  // Функция для вертикального разделения экрана
  const handleVerticalSplit = () => {
    // Используем прямой вызов splitScreenManager вместо генерации события
    console.log(`TrackMap: Разделяем контейнер ${containerId} вертикально`);
    
    try {
      // Напрямую вызываем метод addDynamicSplit
      const success = splitScreenManager.addDynamicSplit(containerId, 'vertical');
      
      if (!success) {
        console.warn('TrackMap: Не удалось создать вертикальное разделение');
      } else {
        // Обновляем состояние компонента после успешного разделения
        setSplitType('vertical');
        setIsSplitView(true);
        
        // Сохраняем в localStorage
        localStorage.setItem('splitScreenMode', 'vertical');
      }
      
      // Перерисовываем карту при изменении режима
      setTimeout(() => refreshMapView(), 300);
    } catch (error) {
      console.error('TrackMap: Ошибка при создании вертикального разделения:', error);
    }
  };
  
  // Главный метод рендеринга компонента
  return (
    <div 
      className={getMapContainerClasses()} 
      id={containerId}
      data-container-id={containerId}
      data-component-type="trackMap"
      data-splitscreen="true"
    >
      {isLoading && renderLoading()}
      
      <div className="tm-header">
        <div className="tm-title">
          <FontAwesomeIcon icon={faRoute} />
          <span>Трек: {currentVehicle?.name || 'Транспорт не выбран'}</span>
        </div>
        {renderMapControls()}
      </div>
      
      <div className="tm-content">
        <div className="tm-map-wrapper" ref={mapContainerRef}>
          {/* Контейнер для карты */}
          <div 
            id={`map-${tabId || 'default'}`} 
            className="tm-map-instance"
            style={{ width: '100%', height: '100%' }}
          ></div>
          
        </div>
        
      </div>
    </div>
  );
};

export default TrackMap; 