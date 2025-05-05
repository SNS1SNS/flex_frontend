import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarAlt, faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import './DateRangePicker.css';

/**
 * Компонент для выбора диапазона дат
 * @param {Object} props
 * @param {Function} props.onDateChange - Функция обратного вызова при изменении дат
 * @param {Object} props.initialDates - Начальные значения диапазона дат
 */
const DateRangePicker = ({ onDateChange, initialDates }) => {
  // Состояние для хранения выбранных дат
  const [dateRange, setDateRange] = useState({
    startDate: initialDates?.startDate || new Date(),
    endDate: initialDates?.endDate || new Date()
  });
  
  // Состояние для отображения календаря
  const [showCalendar, setShowCalendar] = useState(false);
  
  // Состояние для выбранного предустановленного периода
  const [selectedPeriod, setSelectedPeriod] = useState('custom');
  
  // Обновление состояния при изменении props
  useEffect(() => {
    if (initialDates) {
      setDateRange({
        startDate: initialDates.startDate || new Date(),
        endDate: initialDates.endDate || new Date()
      });
    }
  }, [initialDates]);
  
  // Форматирование даты в строку ДД.ММ.ГГГГ
  const formatDate = (date) => {
    if (!date) return '';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };
  
  // Расчет диапазона дат на основе типа периода
  const calculateDateRange = (periodType) => {
    const startDate = new Date();
    const endDate = new Date();
    
    switch (periodType) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'yesterday':
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(endDate.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'month':
        startDate.setDate(startDate.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      default:
        // Оставляем текущие даты
        break;
    }
    
    return { startDate, endDate };
  };
  
  // Обработчик выбора предустановленного периода
  const handlePeriodSelect = (periodType) => {
    setSelectedPeriod(periodType);
    const { startDate, endDate } = calculateDateRange(periodType);
    
    setDateRange({ startDate, endDate });
    if (onDateChange) {
      onDateChange(startDate, endDate);
    }
    
    // Закрываем календарь при выборе предустановленного периода
    setShowCalendar(false);
  };
  
  // Обработчик нажатия на кнопку календаря
  const handleCalendarClick = () => {
    setShowCalendar(!showCalendar);
  };
  
  // Обработчик применения выбранного диапазона дат
  const handleApplyDateRange = () => {
    const startInput = document.getElementById('start-date');
    const endInput = document.getElementById('end-date');
    
    if (startInput && endInput && startInput.value && endInput.value) {
      const startDate = new Date(startInput.value);
      const endDate = new Date(endInput.value);
      
      // Устанавливаем правильное время
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      
      setDateRange({ startDate, endDate });
      setSelectedPeriod('custom');
      
      if (onDateChange) {
        onDateChange(startDate, endDate);
      }
    }
    
    setShowCalendar(false);
  };
  
  // Переключение на предыдущий день/неделю/месяц
  const handlePrevPeriod = () => {
    const { startDate, endDate } = dateRange;
    const newStartDate = new Date(startDate);
    const newEndDate = new Date(endDate);
    
    let diff;
    
    switch (selectedPeriod) {
      case 'today':
        newStartDate.setDate(newStartDate.getDate() - 1);
        newEndDate.setDate(newEndDate.getDate() - 1);
        break;
      case 'week':
        newStartDate.setDate(newStartDate.getDate() - 7);
        newEndDate.setDate(newEndDate.getDate() - 7);
        break;
      case 'month':
        newStartDate.setMonth(newStartDate.getMonth() - 1);
        newEndDate.setMonth(newEndDate.getMonth() - 1);
        break;
      default:
        // Для произвольного периода отнимаем разницу между датами
        diff = endDate.getTime() - startDate.getTime();
        newStartDate.setTime(startDate.getTime() - diff);
        newEndDate.setTime(endDate.getTime() - diff);
        break;
    }
    
    setDateRange({ startDate: newStartDate, endDate: newEndDate });
    
    if (onDateChange) {
      onDateChange(newStartDate, newEndDate);
    }
  };
  
  // Переключение на следующий день/неделю/месяц
  const handleNextPeriod = () => {
    const { startDate, endDate } = dateRange;
    const newStartDate = new Date(startDate);
    const newEndDate = new Date(endDate);
    
    let diff;
    
    switch (selectedPeriod) {
      case 'today':
        newStartDate.setDate(newStartDate.getDate() + 1);
        newEndDate.setDate(newEndDate.getDate() + 1);
        break;
      case 'week':
        newStartDate.setDate(newStartDate.getDate() + 7);
        newEndDate.setDate(newEndDate.getDate() + 7);
        break;
      case 'month':
        newStartDate.setMonth(newStartDate.getMonth() + 1);
        newEndDate.setMonth(newEndDate.getMonth() + 1);
        break;
      default:
        // Для произвольного периода прибавляем разницу между датами
        diff = endDate.getTime() - startDate.getTime();
        newStartDate.setTime(startDate.getTime() + diff);
        newEndDate.setTime(endDate.getTime() + diff);
        break;
    }
    
    setDateRange({ startDate: newStartDate, endDate: newEndDate });
    
    if (onDateChange) {
      onDateChange(newStartDate, newEndDate);
    }
  };
  
  return (
    <div className="date-range-picker">
      <div className="date-range-picker-header">
        <button 
          className="date-nav-button" 
          onClick={handlePrevPeriod}
          aria-label="Предыдущий период"
        >
          <FontAwesomeIcon icon={faChevronLeft} />
        </button>
        
        <div className="date-display" onClick={handleCalendarClick}>
          <FontAwesomeIcon icon={faCalendarAlt} className="calendar-icon" />
          <span className="date-text">
            {formatDate(dateRange.startDate)} - {formatDate(dateRange.endDate)}
          </span>
        </div>
        
        <button 
          className="date-nav-button" 
          onClick={handleNextPeriod}
          aria-label="Следующий период"
        >
          <FontAwesomeIcon icon={faChevronRight} />
        </button>
      </div>
      
      <div className="date-range-picker-periods">
        <button 
          className={`period-button ${selectedPeriod === 'today' ? 'active' : ''}`}
          onClick={() => handlePeriodSelect('today')}
        >
          Сегодня
        </button>
        <button 
          className={`period-button ${selectedPeriod === 'yesterday' ? 'active' : ''}`}
          onClick={() => handlePeriodSelect('yesterday')}
        >
          Вчера
        </button>
        <button 
          className={`period-button ${selectedPeriod === 'week' ? 'active' : ''}`}
          onClick={() => handlePeriodSelect('week')}
        >
          Неделя
        </button>
        <button 
          className={`period-button ${selectedPeriod === 'month' ? 'active' : ''}`}
          onClick={() => handlePeriodSelect('month')}
        >
          Месяц
        </button>
      </div>
      
      {showCalendar && (
        <div className="date-range-picker-calendar">
          <div className="calendar-container">
            <div className="calendar-inputs">
              <div className="calendar-input-group">
                <label htmlFor="start-date">Начало:</label>
                <input 
                  type="date" 
                  id="start-date" 
                  defaultValue={dateRange.startDate.toISOString().split('T')[0]}
                />
              </div>
              <div className="calendar-input-group">
                <label htmlFor="end-date">Конец:</label>
                <input 
                  type="date" 
                  id="end-date" 
                  defaultValue={dateRange.endDate.toISOString().split('T')[0]}
                />
              </div>
            </div>
            <div className="calendar-actions">
              <button className="calendar-cancel" onClick={() => setShowCalendar(false)}>
                Отмена
              </button>
              <button className="calendar-apply" onClick={handleApplyDateRange}>
                Применить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker; 