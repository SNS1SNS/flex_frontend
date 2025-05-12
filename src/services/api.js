import tokenService from './tokenService';

/**
 * API-сервис для работы с транспортными средствами, с поддержкой авторизации
 */
const api = {
  /**
   * Базовый URL API
   */
  baseUrl: process.env.REACT_APP_API_URL || '/api',
  
  /**
   * Выполняет запрос к API с использованием авторизационного токена
   * @param {string} url - URL запроса
   * @param {Object} options - Опции запроса
   * @returns {Promise<Object>} Данные ответа
   */
  async fetch(url, options = {}) {
    // Получаем токен авторизации
    const token = tokenService.getAccessToken();
    
    // Базовые заголовки запроса
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    // Если токен существует, добавляем его в заголовки
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Формируем полный URL
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
    
    console.log(`API запрос: ${options.method || 'GET'} ${fullUrl}`);
    
    try {
      // Выполняем запрос к API
      const response = await fetch(fullUrl, {
        ...options,
        headers
      });
      
      // Если запрос выполнен неуспешно
      if (!response.ok) {
        // Пытаемся получить детали ошибки
        const errorData = await response.json().catch(() => ({}));
        
        // Если ошибка связана с авторизацией
        if (response.status === 401 || response.status === 403) {
          console.error('Ошибка авторизации:', errorData.message || response.statusText);
        }
        
        // Выбрасываем ошибку с деталями
        throw {
          status: response.status,
          message: errorData.message || response.statusText,
          details: errorData
        };
      }
      
      // Если ответ пуст, возвращаем успех
      if (response.status === 204) {
        return { success: true };
      }
      
      // Получаем данные в формате JSON
      return await response.json();
    } catch (error) {
      console.error('Ошибка API запроса:', error);
      throw error;
    }
  },
  
  /**
   * Выполняет GET-запрос
   * @param {string} url - URL запроса
   * @param {Object} options - Дополнительные опции запроса
   * @returns {Promise<Object>} Данные ответа
   */
  async get(url, options = {}) {
    return this.fetch(url, {
      method: 'GET',
      ...options
    });
  },
  
  /**
   * Выполняет POST-запрос
   * @param {string} url - URL запроса
   * @param {Object} data - Данные для отправки
   * @param {Object} options - Дополнительные опции запроса
   * @returns {Promise<Object>} Данные ответа
   */
  async post(url, data, options = {}) {
    return this.fetch(url, {
      method: 'POST',
      body: JSON.stringify(data),
      ...options
    });
  },
  
  /**
   * Выполняет PUT-запрос
   * @param {string} url - URL запроса
   * @param {Object} data - Данные для отправки
   * @param {Object} options - Дополнительные опции запроса
   * @returns {Promise<Object>} Данные ответа
   */
  async put(url, data, options = {}) {
    return this.fetch(url, {
      method: 'PUT',
      body: JSON.stringify(data),
      ...options
    });
  },
  
  /**
   * Выполняет PATCH-запрос
   * @param {string} url - URL запроса
   * @param {Object} data - Данные для отправки
   * @param {Object} options - Дополнительные опции запроса
   * @returns {Promise<Object>} Данные ответа
   */
  async patch(url, data, options = {}) {
    return this.fetch(url, {
      method: 'PATCH',
      body: JSON.stringify(data),
      ...options
    });
  },
  
  /**
   * Выполняет DELETE-запрос
   * @param {string} url - URL запроса
   * @param {Object} options - Дополнительные опции запроса
   * @returns {Promise<Object>} Данные ответа
   */
  async delete(url, options = {}) {
    return this.fetch(url, {
      method: 'DELETE',
      ...options
    });
  },
  
  /**
   * Получает список всех транспортных средств
   * @returns {Promise<Array>} Список транспортных средств
   */
  async getVehicles() {
    return this.get('/vehicles');
  },
  
  /**
   * Получает информацию о конкретном транспортном средстве
   * @param {number|string} id - ID транспортного средства
   * @returns {Promise<Object>} Данные транспортного средства
   */
  async getVehicle(id) {
    return this.get(`/vehicles/${id}`);
  },
  
  /**
   * Создает новое транспортное средство
   * @param {Object} vehicleData - Данные транспортного средства
   * @returns {Promise<Object>} Созданное транспортное средство
   */
  async createVehicle(vehicleData) {
    return this.post('/vehicles', vehicleData);
  },
  
  /**
   * Обновляет данные транспортного средства
   * @param {number|string} id - ID транспортного средства
   * @param {Object} vehicleData - Обновленные данные
   * @returns {Promise<Object>} Обновленное транспортное средство
   */
  async updateVehicle(id, vehicleData) {
    return this.put(`/vehicles/${id}`, vehicleData);
  },
  
  /**
   * Удаляет транспортное средство
   * @param {number|string} id - ID транспортного средства
   * @returns {Promise<Object>} Результат операции
   */
  async deleteVehicle(id) {
    return this.delete(`/vehicles/${id}`);
  },
  
  /**
   * Обновляет настройки двигателя транспортного средства
   * @param {number|string} id - ID транспортного средства
   * @param {Object} engineData - Данные о двигателе
   * @returns {Promise<Object>} Обновленное транспортное средство
   */
  async updateEngineSettings(id, engineData) {
    return this.put(`/vehicles/${id}`, engineData);
  },
  
  /**
   * Обновляет настройки терминала транспортного средства
   * @param {number|string} id - ID транспортного средства
   * @param {Object} terminalData - Данные о терминале
   * @returns {Promise<Object>} Обновленное транспортное средство
   */
  async updateTerminalSettings(id, terminalData) {
    return this.put(`/vehicles/${id}/terminal`, terminalData);
  }
};

export default api; 