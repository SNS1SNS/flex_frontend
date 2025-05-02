/**
 * Утилиты для управления анимацией и поведением бокового меню
 */

/**
 * Переключение состояния бокового меню (раскрыто/свернуто)
 */
export const toggleSidebar = () => {
  const sidebar = document.querySelector('.admin-sidebar');
  if (!sidebar) return;
  
  // Для мобильных устройств используем класс expanded
  if (window.innerWidth <= 768) {
    if (sidebar.classList.contains('expanded')) {
      sidebar.classList.remove('expanded');
    } else {
      sidebar.classList.add('expanded');
    }
  } 
  // Для десктопов используем класс collapsed
  else {
    if (sidebar.classList.contains('collapsed')) {
      sidebar.classList.remove('collapsed');
    } else {
      sidebar.classList.add('collapsed');
    }
  }
};

/**
 * Инициализация обработчиков событий для бокового меню
 */
export const initSidebarHandlers = () => {
  // Находим кнопку переключения сайдбара
  const toggleButton = document.querySelector('.sidebar-toggle');
  if (toggleButton) {
    toggleButton.addEventListener('click', toggleSidebar);
  }
  
  // Закрытие сайдбара при клике вне него на мобильных устройствах
  document.addEventListener('click', (event) => {
    const sidebar = document.querySelector('.admin-sidebar');
    const toggleBtn = document.querySelector('.sidebar-toggle');
    
    if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('expanded')) {
      // Если клик был не по сайдбару и не по кнопке переключения
      if (!sidebar.contains(event.target) && 
          (!toggleBtn || !toggleBtn.contains(event.target))) {
        sidebar.classList.remove('expanded');
      }
    }
  });
  
  // Адаптация при изменении размера окна
  window.addEventListener('resize', () => {
    const sidebar = document.querySelector('.admin-sidebar');
    if (!sidebar) return;
    
    if (window.innerWidth <= 768) {
      sidebar.classList.remove('collapsed');
      // При первом показе на мобильном сайдбар скрыт
      if (!sidebar.classList.contains('expanded')) {
        sidebar.classList.remove('expanded');
      }
    } else {
      sidebar.classList.remove('expanded');
      // По умолчанию на десктопе сайдбар развернут
      if (!sidebar.classList.contains('collapsed') && 
          !sidebar.classList.contains('desktop-expanded')) {
        sidebar.classList.add('desktop-expanded');
      }
    }
  });
}; 