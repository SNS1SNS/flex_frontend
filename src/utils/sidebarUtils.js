/**
 * Функции для управления боковым меню
 */

/**
 * Переключает состояние бокового меню (открыто/закрыто)
 */
export const toggleSidebar = () => {
  const sidebar = document.querySelector('.sidebar');
  const content = document.querySelector('.with-sidebar-content');
  
  if (!sidebar) return;
  
  // На мобильных устройствах используем класс expanded
  if (window.innerWidth <= 768) {
    sidebar.classList.toggle('expanded');
    if (content) {
      content.classList.toggle('sidebar-expanded');
    }
  } 
  // На десктопах используем класс collapsed
  else {
    sidebar.classList.toggle('collapsed');
    if (content) {
      content.classList.toggle('sidebar-collapsed');
    }
  }
};

/**
 * Переключает компактный режим бокового меню - отображение только иконок
 */
export const toggleCompactMode = () => {
  const sidebar = document.querySelector('.sidebar');
  const content = document.querySelector('.with-sidebar-content');
  
  if (!sidebar) return;
  
  // Переключаем класс compact-mode
  sidebar.classList.toggle('compact-mode');
  
  // Обновляем класс контента
  if (content) {
    content.classList.toggle('with-compact-sidebar');
  }
  
  // Закрываем профильное меню при изменении режима
  const profileMenu = document.getElementById('profileMenu');
  if (profileMenu && !profileMenu.classList.contains('hidden')) {
    profileMenu.classList.add('hidden');
  }
  
  return sidebar.classList.contains('compact-mode');
};

/**
 * Обработчик для отображения/скрытия профильного меню
 */
export const toggleProfileMenu = () => {
  const profileMenu = document.getElementById('profileMenu');
  if (profileMenu) {
    profileMenu.classList.toggle('hidden');
  }
};

/**
 * Обработчик события изменения размера окна
 */
export const handleResize = () => {
  const sidebar = document.querySelector('.sidebar');
  const content = document.querySelector('.with-sidebar-content');
  
  if (!sidebar) return;
  
  // Сбрасываем классы при изменении размера окна
  if (window.innerWidth <= 768) {
    sidebar.classList.remove('collapsed');
    if (content) content.classList.remove('sidebar-collapsed');
    
    // Если включен компактный режим на десктопе, сохраняем его
    if (sidebar.classList.contains('compact-mode')) {
      sidebar.classList.add('compact-mode');
      if (content) content.classList.add('with-compact-sidebar');
    }
  } else {
    sidebar.classList.remove('expanded');
    if (content) content.classList.remove('sidebar-expanded');
  }
  
  // Закрываем профильное меню при изменении размера экрана
  const profileMenu = document.getElementById('profileMenu');
  if (profileMenu && !profileMenu.classList.contains('hidden')) {
    profileMenu.classList.add('hidden');
  }
};

/**
 * Обработчик клика вне бокового меню
 */
export const handleClickOutside = (e) => {
  const sidebar = document.querySelector('.sidebar');
  const toggleButton = document.querySelector('.sidebar-toggle');
  const profileMenu = document.getElementById('profileMenu');
  const sidebarHeader = document.getElementById('sidebarHeader');
  
  // Проверяем, что клик был не по меню и не по кнопке переключения
  if (sidebar && 
      window.innerWidth <= 768 && 
      sidebar.classList.contains('expanded') && 
      !sidebar.contains(e.target) && 
      (!toggleButton || !toggleButton.contains(e.target))) {
    toggleSidebar();
  }
  
  // Закрываем профильное меню при клике вне его и вне заголовка
  if (profileMenu && 
      !profileMenu.classList.contains('hidden') && 
      !profileMenu.contains(e.target) && 
      (!sidebarHeader || !sidebarHeader.contains(e.target))) {
    profileMenu.classList.add('hidden');
  }
};

/**
 * Инициализирует обработчики событий для бокового меню
 */
export const initSidebarHandlers = () => {
  // Находим кнопку переключения видимости меню
  const toggleButton = document.querySelector('.sidebar-toggle');
  
  // Добавляем обработчик нажатия на кнопку
  if (toggleButton) {
    toggleButton.addEventListener('click', (e) => {
      e.preventDefault();
      toggleSidebar();
    });
  }
  
  // Находим кнопку переключения компактного режима
  const compactToggleButton = document.querySelector('.compact-toggle');
  
  // Добавляем обработчик нажатия на кнопку компактного режима
  if (compactToggleButton) {
    compactToggleButton.addEventListener('click', (e) => {
      e.preventDefault();
      toggleCompactMode();
    });
  }
  
  // Находим заголовок сайдбара для отображения профильного меню
  const sidebarHeader = document.getElementById('sidebarHeader');
  
  // Добавляем обработчик для профильного меню
  if (sidebarHeader) {
    sidebarHeader.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleProfileMenu();
    });
  }
  
  // Добавляем обработчик для закрытия меню при клике вне его на мобильных
  document.addEventListener('click', handleClickOutside);
  
  // Добавляем обработчик изменения размера окна
  window.addEventListener('resize', handleResize);
  
  // Добавляем обработчик для кнопки выхода
  const logoutButton = document.getElementById('logout-link');
  if (logoutButton) {
    logoutButton.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
    });
  }
};

/**
 * Закрывает боковое меню
 */
export const closeSidebar = () => {
  const sidebar = document.querySelector('.sidebar');
  const content = document.querySelector('.with-sidebar-content');
  
  if (!sidebar) return;
  
  if (window.innerWidth <= 768) {
    sidebar.classList.remove('expanded');
    if (content) content.classList.remove('sidebar-expanded');
  } else {
    sidebar.classList.add('collapsed');
    if (content) content.classList.add('sidebar-collapsed');
  }
};

/**
 * Открывает боковое меню
 */
export const openSidebar = () => {
  const sidebar = document.querySelector('.sidebar');
  const content = document.querySelector('.with-sidebar-content');
  
  if (!sidebar) return;
  
  if (window.innerWidth <= 768) {
    sidebar.classList.add('expanded');
    if (content) content.classList.add('sidebar-expanded');
  } else {
    sidebar.classList.remove('collapsed');
    if (content) content.classList.remove('sidebar-collapsed');
  }
};

/**
 * Включает компактный режим бокового меню
 */
export const enableCompactMode = () => {
  const sidebar = document.querySelector('.sidebar');
  const content = document.querySelector('.with-sidebar-content');
  
  if (!sidebar) return;
  
  sidebar.classList.add('compact-mode');
  if (content) content.classList.add('with-compact-sidebar');
};

/**
 * Отключает компактный режим бокового меню
 */
export const disableCompactMode = () => {
  const sidebar = document.querySelector('.sidebar');
  const content = document.querySelector('.with-sidebar-content');
  
  if (!sidebar) return;
  
  sidebar.classList.remove('compact-mode');
  if (content) content.classList.remove('with-compact-sidebar');
};

/**
 * Закрывает профильное меню
 */
export const closeProfileMenu = () => {
  const profileMenu = document.getElementById('profileMenu');
  if (profileMenu) {
    profileMenu.classList.add('hidden');
  }
};

// Экспортируем объект с функциями
const sidebarUtils = {
  toggleSidebar,
  toggleCompactMode,
  toggleProfileMenu,
  initSidebarHandlers,
  closeSidebar,
  openSidebar,
  enableCompactMode,
  disableCompactMode,
  handleResize,
  handleClickOutside,
  closeProfileMenu
};

export default sidebarUtils; 