import api from './api';

/**
 * Сервис для работы с транспортными средствами и группами
 */
const vehicleService = {
  /**
   * Получение списка всех транспортных средств
   * @returns {Promise<Array>} Массив транспортных средств
   */
  getAllVehicles: async () => {
    try {
      return await api.get('/vehicles');
    } catch (error) {
      console.error('Ошибка при получении списка транспортных средств:', error);
      throw error;
    }
  },

  /**
   * Получение транспортного средства по ID
   * @param {string|number} id - ID транспортного средства
   * @returns {Promise<Object>} Данные транспортного средства
   */
  getVehicleById: async (id) => {
    try {
      return await api.get(`/vehicles/${id}`);
    } catch (error) {
      console.error(`Ошибка при получении транспортного средства с ID ${id}:`, error);
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
      return await api.post('/vehicles', vehicleData);
    } catch (error) {
      console.error('Ошибка при создании транспортного средства:', error);
      throw error;
    }
  },

  /**
   * Обновление существующего транспортного средства
   * @param {string|number} id - ID транспортного средства
   * @param {Object} vehicleData - Обновленные данные транспортного средства
   * @returns {Promise<Object>} Обновленное транспортное средство
   */
  updateVehicle: async (id, vehicleData) => {
    try {
      return await api.put(`/vehicles/${id}`, vehicleData);
    } catch (error) {
      console.error(`Ошибка при обновлении транспортного средства с ID ${id}:`, error);
      throw error;
    }
  },

  /**
   * Удаление транспортного средства
   * @param {string|number} id - ID транспортного средства
   * @returns {Promise<Object>} Результат операции
   */
  deleteVehicle: async (id) => {
    try {
      return await api.delete(`/vehicles/${id}`);
    } catch (error) {
      console.error(`Ошибка при удалении транспортного средства с ID ${id}:`, error);
      throw error;
    }
  },

  /**
   * Получение групп определенного типа
   * @param {string} type - Тип группы (например, "group")
   * @returns {Promise<Array>} Массив групп
   */
  getGroupsByType: async (type) => {
    try {
      return await api.get(`/folders/type/${type}`);
    } catch (error) {
      console.error(`Ошибка при получении групп типа "${type}":`, error);
      throw error;
    }
  },

  /**
   * Создание новой группы
   * @param {Object} groupData - Данные новой группы
   * @returns {Promise<Object>} Созданная группа
   */
  createGroup: async (groupData) => {
    try {
      return await api.post('/folders', groupData);
    } catch (error) {
      console.error('Ошибка при создании группы:', error);
      throw error;
    }
  },

  /**
   * Обновление существующей группы
   * @param {string|number} id - ID группы
   * @param {Object} groupData - Обновленные данные группы
   * @returns {Promise<Object>} Обновленная группа
   */
  updateGroup: async (id, groupData) => {
    try {
      return await api.put(`/folders/${id}`, groupData);
    } catch (error) {
      console.error(`Ошибка при обновлении группы с ID ${id}:`, error);
      throw error;
    }
  },

  /**
   * Удаление группы
   * @param {string|number} id - ID группы
   * @returns {Promise<Object>} Результат операции
   */
  deleteGroup: async (id) => {
    try {
      return await api.delete(`/folders/${id}`);
    } catch (error) {
      console.error(`Ошибка при удалении группы с ID ${id}:`, error);
      throw error;
    }
  }
};

export default vehicleService; 