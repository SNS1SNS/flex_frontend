/**
 * Утилитарные функции для работы с папками и деревом папок
 */

/**
 * Функция для преобразования типа папки в читаемый текст
 * @param {string} type - Тип папки ('tariff', 'group', 'transport', etc.)
 * @returns {string} Читаемый текст
 */
export const folderTypeToText = (type) => {
  switch(type) {
    case 'tariff':
      return 'Тариф';
    case 'group':
      return 'Группа';
    case 'transport':
      return 'Транспорт';
    default:
      return 'Папка';
  }
};

/**
 * Функция для поиска всех папок типа "group" в дереве
 * @param {Array} folders - Массив папок
 * @returns {Array} Массив найденных групп
 */
export const findAllGroupFolders = (folders) => {
  let groupFolders = [];
  
  for (const folder of folders) {
    if (folder.type === 'group') {
      groupFolders.push(folder);
    }
    
    // Рекурсивно ищем группы в дочерних папках
    if (folder.children && folder.children.length > 0) {
      groupFolders = groupFolders.concat(findAllGroupFolders(folder.children));
    }
  }
  
  return groupFolders;
};

/**
 * Функция для отображения уведомлений
 * @param {string} type - Тип уведомления ('success', 'error', 'warning', 'info')
 * @param {string} message - Текст уведомления
 */
export const showNotification = (type, message) => {
  // Создаем элемент уведомления
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  
  // Устанавливаем иконку в зависимости от типа
  let icon = '';
  switch(type) {
    case 'success':
      icon = '<i class="fas fa-check-circle"></i>';
      break;
    case 'error':
      icon = '<i class="fas fa-exclamation-circle"></i>';
      break;
    case 'warning':
      icon = '<i class="fas fa-exclamation-triangle"></i>';
      break;
    case 'info':
    default:
      icon = '<i class="fas fa-info-circle"></i>';
      break;
  }
  
  // Добавляем содержимое
  notification.innerHTML = `
    <div class="notification-icon">${icon}</div>
    <div class="notification-message">${message}</div>
    <div class="notification-close"><i class="fas fa-times"></i></div>
  `;
  
  // Добавляем на страницу
  document.body.appendChild(notification);
  
  // Показываем с анимацией
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  // Закрытие по клику на крестик
  const closeBtn = notification.querySelector('.notification-close');
  closeBtn.addEventListener('click', () => {
    notification.classList.remove('show');
    setTimeout(() => {
      notification.remove();
    }, 300);
  });
  
  // Автоматическое закрытие через 5 секунд
  setTimeout(() => {
    if (document.body.contains(notification)) {
      notification.classList.remove('show');
      setTimeout(() => {
        if (document.body.contains(notification)) {
          notification.remove();
        }
      }, 300);
    }
  }, 5000);
};

/**
 * Сохраняет выбранное транспортное средство в localStorage
 * @param {Object} vehicle - Транспортное средство
 */
export const saveSelectedVehicle = (vehicle) => {
  try {
    localStorage.setItem('lastSelectedVehicle', JSON.stringify({
      id: vehicle.id,
      name: vehicle.name,
      imei: vehicle.imei || '',
      timestamp: new Date().getTime()
    }));
  } catch (e) {
    console.warn('Не удалось сохранить данные в localStorage:', e);
  }
};

/**
 * Получает сохраненное транспортное средство из localStorage
 * @returns {Object|null} Сохраненное транспортное средство или null
 */
export const getSelectedVehicle = () => {
  try {
    const savedVehicleData = localStorage.getItem('lastSelectedVehicle');
    if (savedVehicleData) {
      const vehicleData = JSON.parse(savedVehicleData);
      
      // Проверяем актуальность данных (не старше 24 часов)
      const currentTime = new Date().getTime();
      const savedTime = vehicleData.timestamp || 0;
      
      if (currentTime - savedTime < 24 * 60 * 60 * 1000) {
        return vehicleData;
      }
    }
    return null;
  } catch (e) {
    console.warn('Не удалось получить данные из localStorage:', e);
    return null;
  }
};

/**
 * Отправляет данные о выбранном ТС в dashboard
 * @param {string} vehicleId - ID транспортного средства
 * @param {string} vehicleName - Название транспортного средства
 * @param {string} vehicleImei - IMEI транспортного средства
 */
export const sendVehicleDataToDashboard = (vehicleId, vehicleName, vehicleImei) => {
  console.log(`Выбрано ТС: ID=${vehicleId}, Имя=${vehicleName}, IMEI=${vehicleImei}`);
  
  // Проверяем наличие IMEI
  if (!vehicleImei || vehicleImei === '') {
    showNotification('warning', `Невозможно отобразить данные: IMEI не задан для ${vehicleName}`);
    return;
  }
  
  // Сохраняем выбранный транспорт в localStorage для последующего использования
  saveSelectedVehicle({ id: vehicleId, name: vehicleName, imei: vehicleImei });
  
  // Создаем пользовательское событие для уведомления всех компонентов о выборе ТС
  const vehicleChangedEvent = new CustomEvent('vehicleChanged', {
    detail: {
      id: vehicleId,
      name: vehicleName,
      imei: vehicleImei
    }
  });
  document.dispatchEvent(vehicleChangedEvent);
}; 