import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCalendarAlt, faTimes, faSave, faTrash, 
  faInfo, faCheck, faExclamationTriangle 
} from '@fortawesome/free-solid-svg-icons';
import './DateRangePicker.css';

/**
 * Компонент выбора диапазона дат для отчетов
 * @param {Object} props - Свойства компонента
 * @param {Object} props.initialRange - Начальный диапазон дат {startDate, endDate}
 * @param {Function} props.onApply - Функция применения выбранного диапазона
 * @param {Function} props.onCancel - Функция отмены выбора
 */
const DateRangePicker = ({ initialRange, onApply, onCancel }) => {
  // Состояние для выбранных дат
  const [dateRange, setDateRange] = useState({
    startDate: initialRange?.startDate || new Date(),
    endDate: initialRange?.endDate || new Date()
  });
  
  // Состояние для сохраненных диапазонов
  const [savedRanges, setSavedRanges] = useState(() => {
    const saved = localStorage.getItem('savedDateRanges');
    return saved ? JSON.parse(saved) : [
      { id: 'today', name: 'Сегодня', type: 'preset' },
      { id: 'yesterday', name: 'Вчера', type: 'preset' },
      { id: 'thisWeek', name: 'Текущая неделя', type: 'preset' },
      { id: 'lastWeek', name: 'Прошлая неделя', type: 'preset' },
      { id: 'thisMonth', name: 'Текущий месяц', type: 'preset' },
      { id: 'lastMonth', name: 'Прошлый месяц', type: 'preset' }
    ];
  });
  
  // Состояние для имени сохраняемого диапазона
  const [saveRangeName, setSaveRangeName] = useState('');
  
  // Состояние для отображения формы сохранения
  const [showSaveForm, setShowSaveForm] = useState(false);
  
  // Состояние для отображения ошибки
  const [error, setError] = useState('');
  
  // Рефы для элементов выбора даты
  const startDateRef = useRef(null);
  const endDateRef = useRef(null);
  const modalRef = useRef(null);
  
  // Форматирование даты для отображения
  const formatDate = (date) => {
    if (!date) return '';
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}.${month}.${year}`;
  };
  
  // Преобразование строки в объект Date
  const parseDate = (dateString) => {
    if (!dateString) return null;
    
    const [day, month, year] = dateString.split('.');
    return new Date(year, month - 1, day);
  };
  
  // Обработчик изменения начальной даты
  const handleStartDateChange = (e) => {
    const dateValue = e.target.value;
    const date = new Date(dateValue);
    
    // Проверка, что начальная дата не позже конечной
    if (date > dateRange.endDate) {
      setError('Начальная дата не может быть позже конечной');
      return;
    }
    
    setDateRange(prev => ({ ...prev, startDate: date }));
    setError('');
  };
  
  // Обработчик изменения конечной даты
  const handleEndDateChange = (e) => {
    const dateValue = e.target.value;
    const date = new Date(dateValue);
    
    // Проверка, что конечная дата не раньше начальной
    if (date < dateRange.startDate) {
      setError('Конечная дата не может быть раньше начальной');
      return;
    }
    
    setDateRange(prev => ({ ...prev, endDate: date }));
    setError('');
  };
  
  // Применение выбранного диапазона
  const handleApply = () => {
    if (dateRange.startDate > dateRange.endDate) {
      setError('Некорректный диапазон дат');
      return;
    }
    
    onApply(dateRange);
  };
  
  // Обработчик выбора предустановленного диапазона
  const handleSelectPreset = (presetId) => {
    const now = new Date();
    let startDate, endDate;
    
    switch (presetId) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'yesterday':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        break;
      case 'thisWeek':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - startDate.getDay() + (startDate.getDay() === 0 ? -6 : 1));
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
        break;
      case 'lastWeek':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - startDate.getDay() - 6);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        break;
      case 'thisMonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
        break;
      case 'lastMonth':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      default:
        // Если выбран пользовательский диапазон, найдем его в сохраненных
        const savedRange = savedRanges.find(range => range.id === presetId);
        if (savedRange && savedRange.startDate && savedRange.endDate) {
          startDate = new Date(savedRange.startDate);
          endDate = new Date(savedRange.endDate);
        } else {
          return; // Если диапазон не найден, выходим из функции
        }
    }
    
    setDateRange({ startDate, endDate });
    setError('');
  };
  
  // Получение значения начальной даты для поля ввода
  const getStartDateInputValue = () => {
    if (!dateRange.startDate) return '';
    
    const year = dateRange.startDate.getFullYear();
    const month = (dateRange.startDate.getMonth() + 1).toString().padStart(2, '0');
    const day = dateRange.startDate.getDate().toString().padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  };
  
  // Получение значения конечной даты для поля ввода
  const getEndDateInputValue = () => {
    if (!dateRange.endDate) return '';
    
    const year = dateRange.endDate.getFullYear();
    const month = (dateRange.endDate.getMonth() + 1).toString().padStart(2, '0');
    const day = dateRange.endDate.getDate().toString().padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  };
  
  // Сохранение пользовательского диапазона
  const handleSaveRange = () => {
    if (!saveRangeName.trim()) {
      setError('Введите название для сохраняемого диапазона');
      return;
    }
    
    // Проверка на дубликаты имен
    if (savedRanges.some(range => range.name === saveRangeName.trim())) {
      setError('Диапазон с таким названием уже существует');
      return;
    }
    
    const newSavedRange = {
      id: `custom_${Date.now()}`,
      name: saveRangeName.trim(),
      startDate: dateRange.startDate.toISOString(),
      endDate: dateRange.endDate.toISOString(),
      type: 'custom'
    };
    
    const updatedRanges = [...savedRanges, newSavedRange];
    setSavedRanges(updatedRanges);
    
    // Сохраняем в localStorage
    localStorage.setItem('savedDateRanges', JSON.stringify(updatedRanges));
    
    // Сбрасываем состояние формы
    setShowSaveForm(false);
    setSaveRangeName('');
    setError('');
  };
  
  // Удаление сохраненного пользовательского диапазона
  const handleDeleteRange = (rangeId) => {
    const updatedRanges = savedRanges.filter(range => range.id !== rangeId);
    setSavedRanges(updatedRanges);
    
    // Обновляем localStorage
    localStorage.setItem('savedDateRanges', JSON.stringify(updatedRanges));
  };
  
  // Обработчик нажатия клавиши Escape для закрытия
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };
    
    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [onCancel]);
  
  // Обработчик клика вне модального окна для закрытия
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onCancel();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onCancel]);
  
  // Функция для форматирования даты с учетом разницы с текущей датой
  const formatRelativeDate = (date) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dateObj = new Date(date);
    const inputDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    
    const diffTime = inputDate.getTime() - today.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    
    if (diffDays === 0) {
      return 'Сегодня';
    } else if (diffDays === -1) {
      return 'Вчера';
    } else if (diffDays === 1) {
      return 'Завтра';
    } else {
      return formatDate(dateObj);
    }
  };
  
  return (
    <div className="date-range-picker-overlay">
      <div className="date-range-picker" ref={modalRef}>
        <div className="date-picker-header">
          <div className="date-picker-title">
            <FontAwesomeIcon icon={faCalendarAlt} />
            <h3>Выбор периода</h3>
          </div>
          <button className="date-picker-close-btn" onClick={onCancel}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        
        <div className="date-picker-content">
          <div className="date-picker-column presets">
            <h4>Быстрый выбор</h4>
            <div className="preset-list">
              {savedRanges.map(range => (
                <button 
                  key={range.id} 
                  className={`preset-btn ${range.type === 'preset' ? 'preset' : 'custom'}`}
                  onClick={() => handleSelectPreset(range.id)}
                >
                  {range.name}
                  {range.type === 'custom' && (
                    <button 
                      className="delete-range-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRange(range.id);
                      }}
                      title="Удалить диапазон"
                    >
                      <FontAwesomeIcon icon={faTimes} />
                    </button>
                  )}
                </button>
              ))}
            </div>
            
            {!showSaveForm ? (
              <button 
                className="save-range-toggle"
                onClick={() => setShowSaveForm(true)}
              >
                <FontAwesomeIcon icon={faSave} />
                Сохранить текущий период
              </button>
            ) : (
              <div className="save-range-form">
                <input 
                  type="text" 
                  value={saveRangeName} 
                  onChange={(e) => setSaveRangeName(e.target.value)}
                  placeholder="Название периода"
                  className="save-range-input"
                />
                <div className="save-range-actions">
                  <button 
                    className="save-range-btn"
                    onClick={handleSaveRange}
                    disabled={!saveRangeName.trim()}
                  >
                    <FontAwesomeIcon icon={faCheck} />
                    Сохранить
                  </button>
                  <button 
                    className="cancel-save-btn"
                    onClick={() => {
                      setShowSaveForm(false);
                      setSaveRangeName('');
                      setError('');
                    }}
                  >
                    <FontAwesomeIcon icon={faTimes} />
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <div className="date-picker-column inputs">
            <h4>Выбор дат</h4>
            <div className="date-inputs">
              <div className="date-input-group">
                <label htmlFor="start-date">Начальная дата</label>
                <div className="date-input-wrapper">
                  <input 
                    type="date" 
                    id="start-date"
                    ref={startDateRef}
                    value={getStartDateInputValue()}
                    onChange={handleStartDateChange}
                    className="date-input"
                  />
                  <div className="relative-date">
                    {formatRelativeDate(dateRange.startDate)}
                  </div>
                </div>
              </div>
              
              <div className="date-input-group">
                <label htmlFor="end-date">Конечная дата</label>
                <div className="date-input-wrapper">
                  <input 
                    type="date" 
                    id="end-date"
                    ref={endDateRef}
                    value={getEndDateInputValue()}
                    onChange={handleEndDateChange}
                    className="date-input"
                  />
                  <div className="relative-date">
                    {formatRelativeDate(dateRange.endDate)}
                  </div>
                </div>
              </div>
            </div>
            
            {error && (
              <div className="date-error">
                <FontAwesomeIcon icon={faExclamationTriangle} />
                <span>{error}</span>
              </div>
            )}
            
            <div className="date-info">
              <FontAwesomeIcon icon={faInfo} />
              <p>
                Выбранный период: {formatDate(dateRange.startDate)} - {formatDate(dateRange.endDate)}
                <br />
                Количество дней: {Math.ceil((dateRange.endDate - dateRange.startDate) / (1000 * 60 * 60 * 24)) + 1}
              </p>
            </div>
          </div>
        </div>
        
        <div className="date-picker-footer">
          <button className="cancel-btn" onClick={onCancel}>
            Отмена
          </button>
          <button className="apply-btn" onClick={handleApply}>
            Применить
          </button>
        </div>
      </div>
    </div>
  );
};

export default DateRangePicker; 