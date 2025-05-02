/**
 * Улучшенный скрипт для анимации боковой навигации
 * с плавными эффектами и поддержкой подменю
 */

/**
 * Инициализирует все анимации и эффекты для боковой навигации
 */
export const initNavigationEffects = () => {
  document.addEventListener('DOMContentLoaded', function() {
    // Инициализация активного элемента
    initActiveNavItem();
    
    // Обработчики событий для эффектов наведения и клика
    setupNavItemEventHandlers();
    
    // Инициализация подменю, если они есть
    initSubmenus();
    
    // Добавление адаптивного режима для мобильных устройств
    setupResponsiveMode();
  });
};

/**
 * Определяет и активирует текущий пункт меню на основе URL
 */
export const initActiveNavItem = () => {
  // Получаем текущий путь страницы
  const currentPath = window.location.pathname;
  
  // Находим все элементы навигации в боковой панели
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  
  // Удаляем класс active со всех элементов
  navItems.forEach(item => {
    item.classList.remove('active');
  });
  
  // Находим соответствующий текущему пути элемент и добавляем к нему класс active
  let activeItemFound = false;
  
  navItems.forEach(item => {
    const href = item.getAttribute('href');
    if (href && currentPath.includes(href.split('?')[0])) {
      item.classList.add('active');
      activeItemFound = true;
      
      // Если это элемент подменю, раскрываем родительское меню
      const parentSubmenu = item.closest('.nav-submenu');
      if (parentSubmenu) {
        const parentItem = parentSubmenu.previousElementSibling;
        if (parentItem && parentItem.classList.contains('has-submenu')) {
          parentItem.classList.add('active');
        }
      }
      
      // Плавно прокручиваем к активному элементу
      setTimeout(() => {
        item.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  });
  
  // Если активный элемент не найден, активируем первый пункт меню по умолчанию
  if (!activeItemFound && navItems.length > 0) {
    navItems[0].classList.add('active');
  }
};

/**
 * Устанавливает обработчики событий для элементов навигации
 */
export const setupNavItemEventHandlers = () => {
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  
  navItems.forEach(item => {
    // Эффект волны при клике
    item.addEventListener('click', function(e) {
      // Не применяем эффекты к элементам с подменю
      if (this.classList.contains('has-submenu')) {
        e.preventDefault();
        this.classList.toggle('active');
        return;
      }
      
      // Удаляем класс active со всех элементов
      navItems.forEach(navItem => {
        navItem.classList.remove('active');
      });
      
      // Добавляем класс active на кликнутый элемент
      this.classList.add('active');
      
      // Эффект пульсации
      createPulseEffect(this);
    });
    
    // Улучшенный эффект при наведении
    item.addEventListener('mouseenter', function() {
      // Если элемент не активен, добавляем красивую анимацию
      if (!this.classList.contains('active')) {
        animateOnHover(this);
      }
    });
    
    // Плавное снятие эффекта при уходе мыши
    item.addEventListener('mouseleave', function() {
      if (!this.classList.contains('active')) {
        resetNavItemStyles(this);
      }
    });
  });
};

/**
 * Создает эффект пульсации при клике на элемент
 */
export const createPulseEffect = (item) => {
  // Убедимся, что у элемента установлено position: relative
  item.style.position = 'relative';
  
  // Создаем элемент для эффекта пульсации
  const pulseElement = document.createElement('span');
  pulseElement.className = 'pulse-effect';
  
  // Добавляем эффект к элементу
  item.appendChild(pulseElement);
  
  // Анимируем пульсацию
  requestAnimationFrame(() => {
    pulseElement.style.opacity = '0.5';
    pulseElement.style.transform = 'scale(0.95)';
    
    // Плавное затухание
    setTimeout(() => {
      pulseElement.style.opacity = '0';
      pulseElement.style.transform = 'scale(1.05)';
      
      // Удаление после завершения анимации
      setTimeout(() => {
        if (item.contains(pulseElement)) {
          item.removeChild(pulseElement);
        }
      }, 1000);
    }, 50);
  });
};

/**
 * Анимирует элемент при наведении
 */
export const animateOnHover = (item) => {
  // Плавное перемещение
  item.style.transform = 'translateX(5px)';
  
  // Анимация иконки
  const icon = item.querySelector('svg');
  if (icon) {
    icon.style.transform = 'scale(1.15) rotate(3deg)';
    icon.style.color = '#3498db';
    icon.style.opacity = '1';
  }
  
  // Анимация текста
  const span = item.querySelector('span');
  if (span) {
    span.style.transform = 'translateX(2px)';
  }
};

/**
 * Сбрасывает стили элемента навигации
 */
export const resetNavItemStyles = (item) => {
  // Возвращаем исходное положение
  item.style.transform = 'translateX(0)';
  
  // Сбрасываем стили иконки
  const icon = item.querySelector('svg');
  if (icon) {
    icon.style.transform = 'scale(1) rotate(0deg)';
    icon.style.color = '';
    icon.style.opacity = '0.9';
  }
  
  // Сбрасываем стили текста
  const span = item.querySelector('span');
  if (span) {
    span.style.transform = 'translateX(0)';
  }
};

/**
 * Инициализирует подменю, если они есть
 */
export const initSubmenus = () => {
  const itemsWithSubmenu = document.querySelectorAll('.nav-item.has-submenu');
  
  itemsWithSubmenu.forEach(item => {
    // Находим соответствующее подменю
    const submenu = item.nextElementSibling;
    if (submenu && submenu.classList.contains('nav-submenu')) {
      // Если родительский пункт активен, показываем подменю
      if (item.classList.contains('active')) {
        submenu.style.maxHeight = submenu.scrollHeight + 'px';
      }
      
      // Обработчик клика для открытия/закрытия подменю
      item.addEventListener('click', function(e) {
        e.preventDefault();
        
        // Переключаем состояние активности
        this.classList.toggle('active');
        
        // Анимируем открытие/закрытие подменю
        if (this.classList.contains('active')) {
          submenu.style.maxHeight = submenu.scrollHeight + 'px';
        } else {
          submenu.style.maxHeight = '0';
        }
      });
    }
  });
};

/**
 * Настраивает адаптивный режим для мобильных устройств
 */
export const setupResponsiveMode = () => {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;
  
  // Определяем, нужен ли адаптивный режим
  function checkResponsiveMode() {
    if (window.innerWidth <= 768) {
      sidebar.classList.add('responsive-mode');
      
      // Скрываем текст в пунктах меню
      document.querySelectorAll('.nav-item span').forEach(span => {
        span.style.opacity = '0';
      });
    } else {
      sidebar.classList.remove('responsive-mode');
      
      // Показываем текст в пунктах меню
      document.querySelectorAll('.nav-item span').forEach(span => {
        span.style.opacity = '1';
      });
    }
  }
  
  // Проверяем при загрузке
  checkResponsiveMode();
  
  // Проверяем при изменении размера окна
  window.addEventListener('resize', checkResponsiveMode);
  
  // Обработчик наведения для адаптивного режима
  sidebar.addEventListener('mouseenter', function() {
    if (this.classList.contains('responsive-mode')) {
      this.style.width = '320px';
      
      // Показываем текст с задержкой
      setTimeout(() => {
        document.querySelectorAll('.nav-item span').forEach(span => {
          span.style.opacity = '1';
        });
      }, 200);
    }
  });
  
  // Обработчик ухода мыши
  sidebar.addEventListener('mouseleave', function() {
    if (this.classList.contains('responsive-mode')) {
      // Сначала скрываем текст
      document.querySelectorAll('.nav-item span').forEach(span => {
        span.style.opacity = '0';
      });
      
      // Затем сужаем сайдбар с задержкой
      setTimeout(() => {
        this.style.width = '70px';
      }, 200);
    }
  });
}; 