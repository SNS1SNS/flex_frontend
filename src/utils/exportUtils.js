/**
 * Утилиты для экспорта данных
 */

/**
 * Преобразует данные транспортных средств в CSV формат
 * @param {Array} vehicles - Массив объектов транспортных средств
 * @param {Array} fields - Массив полей для включения в CSV
 * @returns {string} - строка CSV
 */
export const convertVehiclesToCSV = (vehicles, fields) => {
  if (!vehicles || !vehicles.length) {
    return '';
  }

  // Если поля не определены, используем все поля из первого объекта
  const headers = fields || Object.keys(vehicles[0]);
  
  // Создаем заголовок с названиями полей
  const headerRow = headers
    .map(field => {
      // Преобразуем названия полей в более читаемый формат
      // например, 'garage_number' -> 'Гаражный номер'
      const readableNames = {
        name: 'Название',
        imei: 'IMEI',
        id: 'ID',
        garage_number: 'Гаражный номер',
        factory_number: 'Заводской номер',
        phone: 'Телефон',
        groups: 'Группы',
        last_data: 'Последние данные',
        status: 'Статус',
        created_at: 'Дата создания',
        type: 'Тип',
        vehicle_type: 'Тип ТС',
        fuel_type: 'Тип топлива',
        fuel_tank_volume: 'Объем бака (л)'
      };
      
      return readableNames[field] || field;
    })
    .join(',');
  
  // Создаем строки с данными
  const rows = vehicles.map(vehicle => {
    return headers
      .map(field => {
        // Получаем значение поля
        const value = vehicle[field];
        
        // Если значение содержит запятые или кавычки, заключаем его в кавычки
        // иначе возникнет проблема с парсингом CSV
        const valueStr = value === null || value === undefined ? '' : String(value);
        if (valueStr.includes(',') || valueStr.includes('"')) {
          return `"${valueStr.replace(/"/g, '""')}"`;
        }
        return valueStr;
      })
      .join(',');
  });
  
  // Объединяем заголовок и строки
  return [headerRow, ...rows].join('\n');
};

/**
 * Экспортирует данные в CSV файл
 * @param {string} csv - строка в формате CSV
 * @param {string} filename - имя файла без расширения
 */
export const exportCSV = (csv, filename) => {
  if (!csv) {
    console.error('Ошибка: нет данных для экспорта');
    return;
  }
  
  // Добавляем BOM (Byte Order Mark) для правильной кодировки UTF-8 в Excel
  const BOM = '\ufeff';
  const csvWithBOM = BOM + csv;
  
  // Создаем Blob с данными CSV
  const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
  
  // Создаем ссылку для скачивания файла
  const link = document.createElement('a');
  
  // Создаем URL для Blob
  const url = URL.createObjectURL(blob);
  
  // Устанавливаем URL и имя файла для ссылки
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  
  // Добавляем ссылку в DOM, симулируем клик и удаляем ссылку
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Освобождаем URL
  URL.revokeObjectURL(url);
};

/**
 * Экспортирует данные в JSON файл
 * @param {Object|Array} data - Данные для экспорта
 * @param {string} filename - Имя файла без расширения
 */
export const exportJSON = (data, filename) => {
  if (!data) {
    console.error('Ошибка: нет данных для экспорта');
    return;
  }
  
  // Преобразуем данные в строку JSON
  const json = JSON.stringify(data, null, 2);
  
  // Создаем Blob с данными JSON
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  
  // Создаем ссылку для скачивания файла
  const link = document.createElement('a');
  
  // Создаем URL для Blob
  const url = URL.createObjectURL(blob);
  
  // Устанавливаем URL и имя файла для ссылки
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.json`);
  
  // Добавляем ссылку в DOM, симулируем клик и удаляем ссылку
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Освобождаем URL
  URL.revokeObjectURL(url);
};

/**
 * Преобразует транспортные средства в формат для экспорта
 * @param {Array} vehicles - Исходные данные транспортных средств
 * @param {boolean} includeSystemFields - Включать ли системные поля
 * @returns {Array} - Данные для экспорта
 */
export const prepareVehiclesForExport = (vehicles, includeSystemFields = false) => {
  if (!vehicles || !vehicles.length) {
    return [];
  }
  
  // Определяем поля для экспорта
  const standardFields = [
    'name',
    'garage_number',
    'imei',
    'factory_number',
    'phone',
    'groups',
    'type',
    'fuel_type',
    'fuel_tank_volume',
    'status',
    'last_data',
    'created_at'
  ];
  
  // Добавляем системные поля, если нужно
  const exportFields = includeSystemFields 
    ? ['id', ...standardFields]
    : standardFields;
  
  return vehicles.map(vehicle => {
    // Создаем новый объект только с нужными полями
    const exportVehicle = {};
    
    exportFields.forEach(field => {
      exportVehicle[field] = vehicle[field] !== undefined ? vehicle[field] : '';
    });
    
    return exportVehicle;
  });
}; 