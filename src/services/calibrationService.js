import config from '../config';
import httpService from './httpService';

/**
 * Сервис для работы с тарировочными таблицами
 */
const calibrationService = {
  /**
   * Получение всех тарировочных таблиц для транспортного средства
   * @param {number|string} vehicleId - ID транспортного средства
   * @returns {Promise<Array>} Массив тарировочных таблиц
   */
  getCalibrationData: async (vehicleId) => {
    try {
      const endpoint = config.endpoints.calibration.getAll(vehicleId);
      const response = await httpService.get(endpoint);
      return response;
    } catch (error) {
      console.error(`Ошибка при получении данных калибровки для ТС ${vehicleId}:`, error);
      throw error;
    }
  },

  /**
   * Сохранение тарировочных таблиц для транспортного средства
   * @param {number|string} vehicleId - ID транспортного средства
   * @param {Array} calibrationData - Массив тарировочных таблиц для датчиков
   * @returns {Promise<Object>} Результат операции
   */
  saveCalibrationData: async (vehicleId, calibrationData) => {
    try {
      const endpoint = config.endpoints.calibration.save(vehicleId);
      
      // Для всех таблиц отправляем массив объектов по одному для каждого датчика
      const responses = [];
      
      // Обрабатываем каждую таблицу отдельно
      for (const table of calibrationData) {
        const sensorNumber = table.sensorNumber;
        const apiData = {
          vehicle_id: parseInt(vehicleId, 10),
          sensorNumber: parseInt(sensorNumber, 10),
          data: table.data // Предполагается, что данные уже в правильном формате [[0,0], [100,20], ...]
        };
        
        console.log(`Отправка данных таблицы для датчика ${sensorNumber}:`, apiData);
        const response = await httpService.put(endpoint, apiData);
        responses.push(response);
      }
      
      return responses;
    } catch (error) {
      console.error(`Ошибка при сохранении данных калибровки для ТС ${vehicleId}:`, error);
      throw error;
    }
  },

  /**
   * Сохранение тарировочной таблицы для одного датчика
   * @param {number|string} vehicleId - ID транспортного средства
   * @param {number} sensorNumber - Номер датчика
   * @param {Array} sensorData - Данные тарировочной таблицы для датчика
   * @returns {Promise<Object>} Результат операции
   */
  saveSensorCalibration: async (vehicleId, sensorNumber, sensorData) => {
    try {
      const endpoint = config.endpoints.calibration.save(vehicleId);
      
      // Преобразуем данные в формат массива массивов для API
      // В новом формате первым идет значение датчика (value), вторым - литры (liters)
      const apiFormattedData = sensorData.map(row => {
        if (row.value !== undefined && row.liters !== undefined) {
          return [row.value, row.liters]; // Изменен порядок: теперь [value, liters]
        } else if (Array.isArray(row) && row.length === 2) {
          // Если это массив, предполагаем что данные в порядке [value, liters] - оставляем как есть
          return row;
        } else {
          console.warn('Неизвестный формат строки данных для отправки:', row);
          return [0, 0];
        }
      });
      
      // Формируем объект в соответствии с требуемым форматом API
      const dataToSave = {
        vehicle_id: parseInt(vehicleId, 10),
        sensorNumber: parseInt(sensorNumber, 10),
        data: apiFormattedData
      };
      
      console.log('Отправка данных для датчика на сервер:', dataToSave);
      const response = await httpService.put(endpoint, dataToSave);
      return response;
    } catch (error) {
      console.error(`Ошибка при сохранении данных калибровки для датчика ${sensorNumber} ТС ${vehicleId}:`, error);
      throw error;
    }
  },

  /**
   * Форматирование данных калибровки в объект с ключами по номерам датчиков
   * @param {Array} calibrationData - Данные калибровки с сервера
   * @returns {Object} Объект с данными калибровки по номерам датчиков
   */
  formatCalibrationData: (calibrationData) => {
    const formattedData = {};
    if (!Array.isArray(calibrationData)) {
      console.error('Неверный формат данных калибровки:', calibrationData);
      return formattedData;
    }
    
    calibrationData.forEach(table => {
      // Проверяем, что данные существуют и это массив
      if (table.data && Array.isArray(table.data)) {
        // Преобразуем массив массивов в массив объектов для компонента
        const formattedTableData = table.data.map(row => {
          // Проверяем, в каком формате пришли данные
          if (Array.isArray(row)) {
            // Если это массив [value, liters] - новый формат с сервера
            return { 
              value: row[0], 
              liters: row[1] 
            };
          } else if (row.liters !== undefined && row.value !== undefined) {
            // Если это уже объект {liters, value}
            return row;
          } else {
            // Если формат неизвестен, используем пустой объект с нулями
            console.warn('Неизвестный формат строки данных:', row);
            return { liters: 0, value: 0 };
          }
        });
        
        formattedData[table.sensorNumber] = formattedTableData;
      } else {
        console.warn('Отсутствуют данные калибровки для датчика:', table.sensorNumber);
        formattedData[table.sensorNumber] = [];
      }
    });
    
    return formattedData;
  },

  /**
   * Подготовка данных калибровки для отправки на сервер
   * @param {Object} calibrationData - Объект с данными калибровки по номерам датчиков
   * @returns {Array} Массив объектов с данными калибровки для отправки на сервер
   */
  prepareCalibrationDataForSave: (calibrationData) => {
    return Object.keys(calibrationData).map(sensorNumber => {
      // Преобразуем массив объектов в массив массивов для API
      // Новый формат для отправки на сервер: [value, liters]
      const apiFormattedData = calibrationData[sensorNumber].map(row => {
        if (row.value !== undefined && row.liters !== undefined) {
          // Если это объект {value, liters}, преобразуем в массив [value, liters]
          return [row.value, row.liters]; // Изменен порядок: теперь [value, liters]
        } else if (Array.isArray(row) && row.length === 2) {
          // Если это уже массив, предполагаем что данные уже в нужном порядке [value, liters]
          return row;
        } else {
          // Если формат неизвестен, используем нули
          console.warn('Неизвестный формат строки данных для отправки:', row);
          return [0, 0];
        }
      });
      
      return {
        sensorNumber: parseInt(sensorNumber, 10),
        data: apiFormattedData
      };
    });
  }
};

export default calibrationService; 