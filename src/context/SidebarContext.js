import React, { createContext, useContext, useEffect, useState } from 'react';
import sidebarUtils from '../utils/sidebarUtils';

// Создаем контекст
const SidebarContext = createContext(null);

// Флаг для отслеживания инициализации обработчиков
let handlersInitialized = false;

/**
 * Провайдер контекста бокового меню
 */
export const SidebarProvider = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [compactMode, setCompactMode] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  
  // Инициализация обработчиков бокового меню
  useEffect(() => {
    // Проверяем, были ли уже инициализированы обработчики
    if (!handlersInitialized) {
      console.log('=== ИНИЦИАЛИЗАЦИЯ ОБРАБОТЧИКОВ БОКОВОГО МЕНЮ ===');
      sidebarUtils.initSidebarHandlers();
      handlersInitialized = true;
      
      // Очистка при размонтировании провайдера
      return () => {
        console.log('=== ОЧИСТКА ОБРАБОТЧИКОВ БОКОВОГО МЕНЮ ===');
        window.removeEventListener('resize', sidebarUtils.handleResize);
        document.removeEventListener('click', sidebarUtils.handleClickOutside);
        handlersInitialized = false;
      };
    }
  }, []);
  
  // Функция для переключения состояния меню
  const toggleSidebar = () => {
    sidebarUtils.toggleSidebar();
    setSidebarOpen(!sidebarOpen);
    
    // Закрываем профильное меню при переключении сайдбара
    if (profileMenuOpen) {
      sidebarUtils.closeProfileMenu();
      setProfileMenuOpen(false);
    }
  };
  
  // Функция для переключения компактного режима
  const toggleCompactMode = () => {
    const isCompactNow = sidebarUtils.toggleCompactMode();
    setCompactMode(isCompactNow);
    
    // Закрываем профильное меню при изменении режима
    if (profileMenuOpen) {
      sidebarUtils.closeProfileMenu();
      setProfileMenuOpen(false);
    }
  };
  
  // Функция для переключения профильного меню
  const toggleProfileMenu = () => {
    sidebarUtils.toggleProfileMenu();
    setProfileMenuOpen(!profileMenuOpen);
  };
  
  // Закрытие профильного меню
  const closeProfileMenu = () => {
    sidebarUtils.closeProfileMenu();
    setProfileMenuOpen(false);
  };
  
  return (
    <SidebarContext.Provider
      value={{
        sidebarOpen,
        compactMode,
        profileMenuOpen,
        toggleSidebar,
        toggleCompactMode,
        toggleProfileMenu,
        closeProfileMenu
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};

// Хук для использования контекста бокового меню
export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar должен использоваться внутри SidebarProvider');
  }
  return context;
};

export default SidebarContext; 