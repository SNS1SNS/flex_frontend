/**
 * Утилиты для работы с разделением экрана
 * Предоставляет функции для вертикального и горизонтального разделения контейнеров
 */

/**
 * Обработчик разделения экрана по горизонтали
 * @param {Object} params - Параметры разделения
 * @param {HTMLElement|null} params.containerRef - Ссылка на DOM-элемент контейнера или null
 * @param {string|null} params.containerId - ID контейнера (используется, если не найден containerRef)
 * @param {Function|null} params.setShowReportChooser - Функция для закрытия диалога выбора отчета (опционально)
 * @returns {boolean} - Результат операции (true - успешно, false - ошибка)
 */
export const handleHorizontalSplit = ({ containerRef, containerId, setShowReportChooser }) => {
  // Находим контейнер для разделения
  let container = null;
  let targetContainerId = containerId;
  
  // Если передана ссылка на DOM-элемент, используем ее
  if (containerRef) {
    try {
      // Используем containerRef.current для совместимости с React.useRef
      const ref = containerRef.current || containerRef;
      
      // Проверяем, что ref действительно DOM-элемент с методом closest
      if (ref && typeof ref.closest === 'function') {
        container = ref.closest('.split-screen-container');
      } else {
        console.warn('SplitScreenHandler: containerRef не является DOM-элементом или null');
      }
    } catch (error) {
      console.error('SplitScreenHandler: Ошибка при работе с containerRef:', error);
    }
  }
  
  // Если контейнер не найден по ref, пробуем найти по ID
  if (!container && containerId) {
    container = document.getElementById(containerId) || 
               document.querySelector(`[data-container-id="${containerId}"]`);
  }
  
  // Если контейнер все еще не найден, пытаемся найти любой активный контейнер
  if (!container) {
    container = document.querySelector('.split-screen-container[data-active="true"]');
  }
  
  // Если контейнер все еще не найден, выходим с ошибкой
  if (!container) {
    console.error('SplitScreenHandler: Не удалось найти контейнер для разделения');
    return false;
  }
  
  // Активируем выбранный контейнер
  document.querySelectorAll('.split-screen-container[data-active="true"]')
    .forEach(el => {
      el.setAttribute('data-active', 'false');
      el.classList.remove('active-container');
    });
  
  container.setAttribute('data-active', 'true');
  container.classList.add('active-container');
  
  // Получаем ID контейнера
  targetContainerId = container.id || container.getAttribute('data-container-id');
  if (!targetContainerId) {
    console.error('SplitScreenHandler: У контейнера нет ID для разделения');
    return false;
  }
  
  console.log(`SplitScreenHandler: Разделяем контейнер ${targetContainerId} горизонтально`);
  
  // Создаем пользовательское событие для запроса на разделение
  const splitEvent = new CustomEvent('requestSplit', {
    detail: {
      direction: 'horizontal',
      targetContainerId: targetContainerId,
      timestamp: Date.now(),
      processed: false // флаг обработки события
    }
  });
  
  document.dispatchEvent(splitEvent);
  
  // Закрываем выбор отчетов, если доступна функция setShowReportChooser
  if (typeof setShowReportChooser === 'function') {
    setShowReportChooser(false);
  }
  
  return true;
};

/**
 * Обработчик разделения экрана по вертикали
 * @param {Object} params - Параметры разделения
 * @param {HTMLElement|null} params.containerRef - Ссылка на DOM-элемент контейнера или null
 * @param {string|null} params.containerId - ID контейнера (используется, если не найден containerRef)
 * @param {Function|null} params.setShowReportChooser - Функция для закрытия диалога выбора отчета (опционально)
 * @returns {boolean} - Результат операции (true - успешно, false - ошибка)
 */
export const handleVerticalSplit = ({ containerRef, containerId, setShowReportChooser }) => {
  // Находим контейнер для разделения
  let container = null;
  let targetContainerId = containerId;
  
  // Если передана ссылка на DOM-элемент, используем ее
  if (containerRef) {
    try {
      // Используем containerRef.current для совместимости с React.useRef
      const ref = containerRef.current || containerRef;
      
      // Проверяем, что ref действительно DOM-элемент с методом closest
      if (ref && typeof ref.closest === 'function') {
        container = ref.closest('.split-screen-container');
      } else {
        console.warn('SplitScreenHandler: containerRef не является DOM-элементом или null');
      }
    } catch (error) {
      console.error('SplitScreenHandler: Ошибка при работе с containerRef:', error);
    }
  }
  
  // Если контейнер не найден по ref, пробуем найти по ID
  if (!container && containerId) {
    container = document.getElementById(containerId) || 
               document.querySelector(`[data-container-id="${containerId}"]`);
  }
  
  // Если контейнер все еще не найден, пытаемся найти любой активный контейнер
  if (!container) {
    container = document.querySelector('.split-screen-container[data-active="true"]');
  }
  
  // Если контейнер все еще не найден, выходим с ошибкой
  if (!container) {
    console.error('SplitScreenHandler: Не удалось найти контейнер для разделения');
    return false;
  }
  
  // Активируем выбранный контейнер
  document.querySelectorAll('.split-screen-container[data-active="true"]')
    .forEach(el => {
      el.setAttribute('data-active', 'false');
      el.classList.remove('active-container');
    });
  
  container.setAttribute('data-active', 'true');
  container.classList.add('active-container');
  
  // Получаем ID контейнера
  targetContainerId = container.id || container.getAttribute('data-container-id');
  if (!targetContainerId) {
    console.error('SplitScreenHandler: У контейнера нет ID для разделения');
    return false;
  }
  
  console.log(`SplitScreenHandler: Разделяем контейнер ${targetContainerId} вертикально`);
  
  // Создаем событие для запроса разделения по вертикали
  const splitEvent = new CustomEvent('requestSplit', {
    detail: {
      direction: 'vertical',
      targetContainerId: targetContainerId,
      timestamp: Date.now(),
      processed: false // флаг обработки события
    }
  });
  
  document.dispatchEvent(splitEvent);
  
  // Закрываем выбор отчетов, если доступна функция setShowReportChooser
  if (typeof setShowReportChooser === 'function') {
    setShowReportChooser(false);
  }
  
  return true;
};

/**
 * Обработчик сплошной генерации события разделения
 * @param {Object} params - Параметры разделения
 * @param {string} params.direction - Направление разделения ('horizontal' или 'vertical')
 * @param {string} params.containerId - ID контейнера для разделения
 */
export const requestContainerSplit = ({ direction, containerId }) => {
  if (!containerId) {
    console.error('SplitScreenHandler: Не указан ID контейнера для разделения');
    return false;
  }
  
  if (direction !== 'horizontal' && direction !== 'vertical') {
    console.error('SplitScreenHandler: Неверное направление разделения. Используйте "horizontal" или "vertical"');
    return false;
  }
  
  console.log(`SplitScreenHandler: Запрос на разделение контейнера ${containerId} (${direction})`);
  
  // Создаем событие для запроса разделения
  const splitEvent = new CustomEvent('requestSplit', {
    detail: {
      direction,
      targetContainerId: containerId,
      timestamp: Date.now(),
      processed: false
    }
  });
  
  document.dispatchEvent(splitEvent);
  return true;
};

export default {
  handleHorizontalSplit,
  handleVerticalSplit,
  requestContainerSplit
}; 