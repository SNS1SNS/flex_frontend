import React, { useRef, useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faAngleLeft, faAngleRight } from '@fortawesome/free-solid-svg-icons';
import './ReportTabs.css';

/**
 * Компонент управления вкладками отчетов
 * @param {Object} props - Свойства компонента
 * @param {Array} props.tabs - Массив вкладок
 * @param {string} props.activeTabId - ID активной вкладки
 * @param {Function} props.onTabChange - Обработчик смены активной вкладки
 * @param {Function} props.onCloseTab - Обработчик закрытия вкладки
 */
const ReportTabs = ({ tabs, activeTabId, onTabChange, onCloseTab }) => {
  const tabsContainerRef = useRef(null);
  const [showScrollButtons, setShowScrollButtons] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  
  // Обновляем состояние кнопок прокрутки
  const updateScrollButtonsState = () => {
    if (!tabsContainerRef.current) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = tabsContainerRef.current;
    
    // Если контент выходит за границы, показываем кнопки прокрутки
    setShowScrollButtons(scrollWidth > clientWidth);
    
    // Если можно прокрутить влево (не находимся в начале)
    setCanScrollLeft(scrollLeft > 0);
    
    // Если можно прокрутить вправо (не находимся в конце)
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth);
  };
  
  // Обработчик прокрутки влево
  const scrollLeft = () => {
    if (!tabsContainerRef.current) return;
    
    tabsContainerRef.current.scrollBy({
      left: -100,
      behavior: 'smooth'
    });
  };
  
  // Обработчик прокрутки вправо
  const scrollRight = () => {
    if (!tabsContainerRef.current) return;
    
    tabsContainerRef.current.scrollBy({
      left: 100,
      behavior: 'smooth'
    });
  };
  
  // Инициализация и обновление состояния кнопок прокрутки
  useEffect(() => {
    updateScrollButtonsState();
    
    // Обработчик изменения размера окна
    const handleResize = () => {
      updateScrollButtonsState();
    };
    
    // Обработчик прокрутки вкладок
    const handleScroll = () => {
      updateScrollButtonsState();
    };
    
    window.addEventListener('resize', handleResize);
    tabsContainerRef.current?.addEventListener('scroll', handleScroll);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      tabsContainerRef.current?.removeEventListener('scroll', handleScroll);
    };
  }, [tabs]);
  
  // Прокрутка до активной вкладки при изменении активной вкладки
  useEffect(() => {
    if (!tabsContainerRef.current || !activeTabId) return;
    
    const activeTabElement = tabsContainerRef.current.querySelector(`[data-tab-id="${activeTabId}"]`);
    
    if (activeTabElement) {
      // Прокручиваем, чтобы активная вкладка была видима
      const containerRect = tabsContainerRef.current.getBoundingClientRect();
      const tabRect = activeTabElement.getBoundingClientRect();
      
      // Если вкладка не полностью видна слева
      if (tabRect.left < containerRect.left) {
        tabsContainerRef.current.scrollLeft += tabRect.left - containerRect.left - 10;
      }
      // Если вкладка не полностью видна справа
      else if (tabRect.right > containerRect.right) {
        tabsContainerRef.current.scrollLeft += tabRect.right - containerRect.right + 10;
      }
    }
  }, [activeTabId]);
  
  // Если нет вкладок, не рендерим компонент
  if (!tabs || tabs.length === 0) return null;
  
  return (
    <div className="report-tabs-wrapper">
      {showScrollButtons && (
        <button 
          className={`tab-scroll-button left ${!canScrollLeft ? 'disabled' : ''}`}
          onClick={scrollLeft}
          disabled={!canScrollLeft}
          title="Прокрутить влево"
        >
          <FontAwesomeIcon icon={faAngleLeft} />
        </button>
      )}
      
      <div className="report-tabs" ref={tabsContainerRef}>
        {tabs.map((tab) => (
          <div 
            key={tab.id}
            data-tab-id={tab.id}
            className={`report-tab ${activeTabId === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <div className="tab-content">
              {tab.icon && (
                <div className="tab-icon">
                  <FontAwesomeIcon icon={tab.icon} />
                </div>
              )}
              <div className="tab-title" title={tab.title}>
                {tab.title}
                {tab.vehicle && (
                  <span className="tab-subtitle">{tab.vehicle.name}</span>
                )}
              </div>
            </div>
            <button 
              className="tab-close-btn"
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
              title="Закрыть вкладку"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
        ))}
      </div>
      
      {showScrollButtons && (
        <button 
          className={`tab-scroll-button right ${!canScrollRight ? 'disabled' : ''}`}
          onClick={scrollRight}
          disabled={!canScrollRight}
          title="Прокрутить вправо"
        >
          <FontAwesomeIcon icon={faAngleRight} />
        </button>
      )}
    </div>
  );
};

export default ReportTabs; 