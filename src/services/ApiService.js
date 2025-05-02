import config from '../config';
import httpService from './httpService';

/**
 * Сервис для работы с API транспортных средств
 */
const apiService = {
  /**
   * Получение списка транспортных средств
   * @returns {Promise<Array>} Массив транспортных средств
   */
  getVehicles: async () => {
    try {
      const endpoint = '/api/vehicles';
      const response = await httpService.get(endpoint);
      return response;
    } catch (error) {
      console.error('Ошибка при получении транспортных средств:', error);
      throw error;
    }
  },
  
  /**
   * Получение информации о конкретном транспортном средстве
   * @param {number} id - ID транспортного средства
   * @returns {Promise<Object>} Данные транспортного средства
   */
  getVehicleById: async (id) => {
    try {
      const endpoint = `/api/vehicles/${id}`;
      const response = await httpService.get(endpoint);
      return response;
    } catch (error) {
      console.error(`Ошибка при получении ТС с ID ${id}:`, error);
      throw error;
    }
  },
  
  /**
   * Создание нового транспортного средства
   * @param {Object} vehicleData - Данные нового транспортного средства
   * @returns {Promise<Object>} Созданное транспортное средство
   */
  createVehicle: async (vehicleData) => {
    try {
      const endpoint = '/api/vehicles';
      const response = await httpService.post(endpoint, vehicleData);
      return response;
    } catch (error) {
      console.error('Ошибка при создании транспортного средства:', error);
      throw error;
    }
  },
  
  /**
   * Обновление данных транспортного средства
   * @param {number} id - ID транспортного средства
   * @param {Object} vehicleData - Обновленные данные
   * @returns {Promise<Object>} Обновленное транспортное средство
   */
  updateVehicle: async (id, vehicleData) => {
    try {
      const endpoint = `/api/vehicles/${id}`;
      const response = await httpService.put(endpoint, vehicleData);
      return response;
    } catch (error) {
      console.error(`Ошибка при обновлении ТС с ID ${id}:`, error);
      throw error;
    }
  },
  
  /**
   * Удаление транспортного средства
   * @param {number} id - ID транспортного средства
   * @returns {Promise<Object>} Результат операции
   */
  deleteVehicle: async (id) => {
    try {
      const endpoint = `/api/vehicles/${id}`;
      const response = await httpService.delete(endpoint);
      return response;
    } catch (error) {
      console.error(`Ошибка при удалении ТС с ID ${id}:`, error);
      throw error;
    }
  }
};

export default apiService;