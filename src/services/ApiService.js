import config from '../config';
import httpService from './httpService';

/**
 * Сервис для работы с API транспортных средств и водителей
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
  },
  
  /**
   * Получение списка водителей
   * @returns {Promise<Array>} Массив водителей
   */
  getDrivers: async () => {
    try {
      const endpoint = '/api/drivers';
      const response = await httpService.get(endpoint);
      return response;
    } catch (error) {
      console.error('Ошибка при получении водителей:', error);
      throw error;
    }
  },
  
  /**
   * Получение информации о конкретном водителе
   * @param {number} id - ID водителя
   * @returns {Promise<Object>} Данные водителя
   */
  getDriverById: async (id) => {
    try {
      const endpoint = `/api/drivers/${id}`;
      const response = await httpService.get(endpoint);
      return response;
    } catch (error) {
      console.error(`Ошибка при получении водителя с ID ${id}:`, error);
      throw error;
    }
  },
  
  /**
   * Создание нового водителя
   * @param {Object} driverData - Данные нового водителя
   * @returns {Promise<Object>} Созданный водитель
   */
  createDriver: async (driverData) => {
    try {
      const endpoint = '/api/drivers';
      const response = await httpService.post(endpoint, driverData);
      return response;
    } catch (error) {
      console.error('Ошибка при создании водителя:', error);
      throw error;
    }
  },
  
  /**
   * Обновление данных водителя
   * @param {number} id - ID водителя
   * @param {Object} driverData - Обновленные данные
   * @returns {Promise<Object>} Обновленный водитель
   */
  updateDriver: async (id, driverData) => {
    try {
      const endpoint = `/api/drivers/${id}`;
      const response = await httpService.put(endpoint, driverData);
      return response;
    } catch (error) {
      console.error(`Ошибка при обновлении водителя с ID ${id}:`, error);
      throw error;
    }
  },
  
  /**
   * Удаление водителя
   * @param {number} id - ID водителя
   * @returns {Promise<Object>} Результат операции
   */
  deleteDriver: async (id) => {
    try {
      const endpoint = `/api/drivers/${id}`;
      const response = await httpService.delete(endpoint);
      return response;
    } catch (error) {
      console.error(`Ошибка при удалении водителя с ID ${id}:`, error);
      throw error;
    }
  },
  
  /**
   * Получение списка пользователей
   * @returns {Promise<Array>} Массив пользователей
   */
  getUsers: async () => {
    try {
      const endpoint = '/api/users';
      const response = await httpService.get(endpoint);
      return response;
    } catch (error) {
      console.error('Ошибка при получении пользователей:', error);
      throw error;
    }
  },
  
  /**
   * Получение информации о конкретном пользователе по ID
   * @param {number} id - ID пользователя
   * @returns {Promise<Object>} Данные пользователя
   */
  getUserById: async (id) => {
    try {
      const endpoint = `/api/users/${id}`;
      const response = await httpService.get(endpoint);
      return response;
    } catch (error) {
      console.error(`Ошибка при получении пользователя с ID ${id}:`, error);
      throw error;
    }
  },
  
  /**
   * Получение пользователя по имени пользователя
   * @param {string} username - Имя пользователя
   * @returns {Promise<Object>} Данные пользователя
   */
  getUserByUsername: async (username) => {
    try {
      const endpoint = `/api/users/username/${username}`;
      const response = await httpService.get(endpoint);
      return response;
    } catch (error) {
      console.error(`Ошибка при получении пользователя с именем ${username}:`, error);
      throw error;
    }
  },
  
  /**
   * Получение пользователей по роли
   * @param {string} role - Роль пользователя
   * @returns {Promise<Array>} Массив пользователей
   */
  getUsersByRole: async (role) => {
    try {
      const endpoint = `/api/users/role/${role}`;
      const response = await httpService.get(endpoint);
      return response;
    } catch (error) {
      console.error(`Ошибка при получении пользователей с ролью ${role}:`, error);
      throw error;
    }
  },
  
  /**
   * Получение пользователей по группе
   * @param {string} group - Группа пользователя
   * @returns {Promise<Array>} Массив пользователей
   */
  getUsersByGroup: async (group) => {
    try {
      const endpoint = `/api/users/group/${group}`;
      const response = await httpService.get(endpoint);
      return response;
    } catch (error) {
      console.error(`Ошибка при получении пользователей из группы ${group}:`, error);
      throw error;
    }
  },
  
  /**
   * Поиск пользователей по имени/фамилии
   * @param {string} name - Имя/фамилия для поиска
   * @returns {Promise<Array>} Массив пользователей
   */
  searchUsers: async (name) => {
    try {
      const endpoint = `/api/users/search?name=${encodeURIComponent(name)}`;
      const response = await httpService.get(endpoint);
      return response;
    } catch (error) {
      console.error(`Ошибка при поиске пользователей с именем ${name}:`, error);
      throw error;
    }
  },
  
  /**
   * Создание нового пользователя
   * @param {Object} userData - Данные нового пользователя
   * @returns {Promise<Object>} Созданный пользователь
   */
  createUser: async (userData) => {
    try {
      const endpoint = '/api/users';
      const response = await httpService.post(endpoint, userData);
      return response;
    } catch (error) {
      console.error('Ошибка при создании пользователя:', error);
      throw error;
    }
  },
  
  /**
   * Обновление данных пользователя
   * @param {number} id - ID пользователя
   * @param {Object} userData - Обновленные данные
   * @returns {Promise<Object>} Обновленный пользователь
   */
  updateUser: async (id, userData) => {
    try {
      const endpoint = `/api/users/${id}`;
      const response = await httpService.put(endpoint, userData);
      return response;
    } catch (error) {
      console.error(`Ошибка при обновлении пользователя с ID ${id}:`, error);
      throw error;
    }
  },
  
  /**
   * Удаление пользователя
   * @param {number} id - ID пользователя
   * @returns {Promise<Object>} Результат операции
   */
  deleteUser: async (id) => {
    try {
      const endpoint = `/api/users/${id}`;
      const response = await httpService.delete(endpoint);
      return response;
    } catch (error) {
      console.error(`Ошибка при удалении пользователя с ID ${id}:`, error);
      throw error;
    }
  },
  
  /**
   * Блокировка/разблокировка пользователя
   * @param {number} id - ID пользователя
   * @param {boolean} blocked - Статус блокировки
   * @returns {Promise<Object>} Результат операции
   */
  blockUser: async (id, blocked) => {
    try {
      const endpoint = `/api/users/${id}/blocked?blocked=${blocked}`;
      const response = await httpService.patch(endpoint);
      return response;
    } catch (error) {
      console.error(`Ошибка при ${blocked ? 'блокировке' : 'разблокировке'} пользователя с ID ${id}:`, error);
      throw error;
    }
  },
  
  /**
   * Активация/деактивация пользователя
   * @param {number} id - ID пользователя
   * @param {boolean} active - Статус активации
   * @returns {Promise<Object>} Результат операции
   */
  setUserActive: async (id, active) => {
    try {
      const endpoint = `/api/users/${id}/active?active=${active}`;
      const response = await httpService.patch(endpoint);
      return response;
    } catch (error) {
      console.error(`Ошибка при ${active ? 'активации' : 'деактивации'} пользователя с ID ${id}:`, error);
      throw error;
    }
  }
};

export default apiService;