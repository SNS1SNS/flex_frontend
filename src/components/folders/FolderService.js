// Базовый URL для API
const API_BASE_URL = 'http://localhost:8081/api';

/**
 * Создание тестового JWT токена
 * Функция создает токен в формате JWT для тестирования
 * @returns {string} Тестовый JWT-токен
 */
const createTestJwtToken = () => {
  // Создаем простой тестовый JWT с правильной структурой (header.payload.signature)
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ 
    sub: 'test-user', 
    name: 'Test User', 
    role: 'ADMIN',
    exp: Math.floor(Date.now() / 1000) + 3600 // срок действия 1 час
  }));
  const signature = btoa('test-signature');
  
  return `${header}.${payload}.${signature}`;
};

/**
 * Получить токен авторизации из localStorage или других источников
 * @returns {string} Токен авторизации в формате JWT
 */
const getAuthToken = () => {
  // Проверяем различные варианты хранения токена
  const possibleTokenKeys = ['authToken', 'token', 'jwt', 'access_token'];
  
  for (const key of possibleTokenKeys) {
    const token = localStorage.getItem(key);
    if (token) {
      console.log(`Найден токен в localStorage с ключом "${key}"`);
      
      // Проверяем, является ли токен корректным JWT (содержит 2 точки)
      if (token.split('.').length === 3) {
        return token;
      } else {
        console.warn(`Токен с ключом "${key}" найден, но имеет неправильный формат JWT`);
      }
    }
  }
  
  // Если не нашли токен в localStorage или он в неправильном формате,
  // создаем тестовый JWT токен
  console.warn('Не найден JWT токен в localStorage, создаем тестовый токен для авторизации');
  return createTestJwtToken();
};

/**
 * Получить заголовки для запросов
 * @returns {Object} Заголовки для запросов
 */
const getHeaders = () => {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${getAuthToken()}`
  };
};

/**
 * Логирование запросов и ответов
 * @param {string} url - URL запроса
 * @param {Object} options - Опции запроса
 * @param {Object|null} response - Ответ от сервера или null, если ошибка
 * @param {Object|null} error - Объект ошибки или null, если запрос успешный
 */
const logRequest = (url, options, response = null, error = null) => {
  console.group(`API запрос: ${options.method || 'GET'} ${url}`);
  
  // Логируем заголовки запроса, скрывая полный токен
  const headersForLog = {...options.headers};
  if (headersForLog.Authorization) {
    const authParts = headersForLog.Authorization.split(' ');
    if (authParts.length > 1) {
      const tokenParts = authParts[1].split('.');
      // Показываем только первую часть токена для безопасности
      if (tokenParts.length === 3) {
        headersForLog.Authorization = `${authParts[0]} ${tokenParts[0].substring(0, 10)}...`;
      }
    }
  }
  console.log('Заголовки:', headersForLog);
  
  if (options.body) {
    try {
      console.log('Тело запроса:', JSON.parse(options.body));
    } catch (e) {
      console.log('Тело запроса (строка):', options.body);
    }
  }
  
  if (response) {
    console.log('Статус ответа:', response.status, response.statusText);
    console.log('Заголовки ответа:', response.headers);
  }
  
  if (error) {
    console.error('Ошибка:', error);
  }
  
  console.groupEnd();
};

/**
 * Выполнить запрос к API с логированием
 * @param {string} url - URL запроса
 * @param {Object} options - Опции запроса
 * @returns {Promise<any>} - Результат запроса
 */
const fetchWithLogging = async (url, options = {}) => {
  // Добавляем заголовки по умолчанию, если они не указаны
  if (!options.headers) {
    options.headers = getHeaders();
  }
  
  // Логируем запрос перед отправкой
  console.log(`Отправка ${options.method || 'GET'} запроса на ${url}`);
  
  try {
    const response = await fetch(url, options);
    
    // Клонируем ответ для логирования
    const responseClone = response.clone();
    
    // Попытка получить тело ответа для логирования
    let responseBody = null;
    try {
      responseBody = await responseClone.text();
      if (responseBody) {
        try {
          responseBody = JSON.parse(responseBody);
        } catch (e) {
          // Оставляем как текст, если не JSON
        }
      }
    } catch (e) {
      console.warn('Не удалось получить тело ответа для логирования:', e);
    }
    
    // Логируем полный запрос с ответом
    logRequest(url, options, response, null);
    if (responseBody) {
      console.log('Тело ответа:', responseBody);
    }
    
    if (!response.ok) {
      const error = responseBody && responseBody.error 
        ? responseBody.error 
        : `Ошибка HTTP: ${response.status} ${response.statusText}`;
      throw new Error(error);
    }
    
    // Если ответ пустой или не содержит данных для разбора JSON
    if (!responseBody || responseBody === '') {
      return {};
    }
    
    // Если мы уже распарсили JSON выше, возвращаем его
    if (typeof responseBody === 'object') {
      return responseBody;
    }
    
    // Иначе пробуем разобрать JSON еще раз
    try {
      return JSON.parse(responseBody);
    } catch (e) {
      // Если не получилось распарсить как JSON, возвращаем как есть
      return responseBody;
    }
  } catch (error) {
    // Логируем запрос с ошибкой
    logRequest(url, options, null, error);
    throw error;
  }
};

/**
 * Класс для работы с API папок
 */
class FolderService {
  /**
   * Получить все папки
   * @returns {Promise<Array>} Массив папок
   */
  async getAllFolders() {
    try {
      return await fetchWithLogging(`${API_BASE_URL}/folders`);
    } catch (error) {
      console.error('Ошибка при загрузке папок:', error);
      throw new Error('Не удалось загрузить папки');
    }
  }

  /**
   * Получить корневые папки
   * @returns {Promise<Array>} Массив корневых папок
   */
  async getRootFolders() {
    try {
      return await fetchWithLogging(`${API_BASE_URL}/folders/root`);
    } catch (error) {
      console.error('Ошибка при загрузке корневых папок:', error);
      throw new Error('Не удалось загрузить корневые папки');
    }
  }

  /**
   * Получить папку по ID
   * @param {string} id ID папки
   * @returns {Promise<Object>} Данные папки
   */
  async getFolderById(id) {
    try {
      return await fetchWithLogging(`${API_BASE_URL}/folders/${id}`);
    } catch (error) {
      console.error(`Ошибка при загрузке папки с ID ${id}:`, error);
      throw new Error(`Не удалось загрузить папку с ID ${id}`);
    }
  }

  /**
   * Получить дочерние папки папки по ID
   * @param {string} id ID родительской папки
   * @returns {Promise<Array>} Массив дочерних папок
   */
  async getChildFolders(id) {
    try {
      return await fetchWithLogging(`${API_BASE_URL}/folders/${id}/children`);
    } catch (error) {
      console.error(`Ошибка при загрузке дочерних папок для папки с ID ${id}:`, error);
      throw new Error(`Не удалось загрузить дочерние папки для папки с ID ${id}`);
    }
  }

  /**
   * Получить папки по типу
   * @param {string} type Тип папки (tariff, group, transport)
   * @returns {Promise<Array>} Массив папок указанного типа
   */
  async getFoldersByType(type) {
    try {
      return await fetchWithLogging(`${API_BASE_URL}/folders/type/${type}`);
    } catch (error) {
      console.error(`Ошибка при загрузке папок типа ${type}:`, error);
      throw new Error(`Не удалось загрузить папки типа ${type}`);
    }
  }

  /**
   * Получить полное дерево папок
   * @returns {Promise<Array>} Дерево папок
   */
  async getFolderTree() {
    // Получаем все папки и строим дерево на стороне клиента
    try {
      console.log('Запрашиваем все папки для построения дерева...');
      const folders = await this.getAllFolders();
      
      if (!folders || !Array.isArray(folders)) {
        console.warn('Получен пустой или некорректный ответ при запросе папок:', folders);
        return [];
      }
      
      console.log(`Получено ${folders.length} папок, строим дерево...`);
      
      // Создаем мапу папок для быстрого доступа
      const folderMap = new Map();
      folders.forEach(folder => {
        // Инициализируем children для каждой папки
        folder.children = [];
        folderMap.set(folder.id, folder);
      });
      
      // Строим дерево
      const rootFolders = [];
      
      // Проходим по всем папкам и добавляем их в дерево
      folders.forEach(folder => {
        // Если у папки есть родитель, добавляем её в children родителя
        if (folder.parentId !== null) {
          const parent = folderMap.get(folder.parentId);
          if (parent) {
            parent.children.push(folder);
          } else {
            // Если родителя нет, добавляем в корень (таких быть не должно)
            console.warn(`Папка "${folder.name}" (ID: ${folder.id}) имеет parentId=${folder.parentId}, но родитель не найден`);
            rootFolders.push(folder);
          }
        } else {
          // Если родителя нет, это корневая папка
          rootFolders.push(folder);
        }
      });
      
      // Сортируем папки по имени
      const sortFolders = (folders) => {
        folders.sort((a, b) => a.name.localeCompare(b.name));
        folders.forEach(folder => {
          if (folder.children && folder.children.length > 0) {
            sortFolders(folder.children);
          }
        });
      };
      
      sortFolders(rootFolders);
      
      console.log('Дерево папок успешно построено:', rootFolders);
      return rootFolders;
    } catch (error) {
      console.error('Ошибка при получении дерева папок:', error);
      throw new Error('Не удалось загрузить дерево папок');
    }
  }

  /**
   * Получить все тарифы
   * @returns {Promise<Array>} Массив тарифов
   */
  async getAllTariffs() {
    // Используем API получения папок по типу
    return await this.getFoldersByType('tariff');
  }

  /**
   * Получить все группы
   * @returns {Promise<Array>} Массив групп
   */
  async getAllGroups() {
    // Используем API получения папок по типу
    return await this.getFoldersByType('group');
  }

  /**
   * Поиск папок по имени
   * @param {string} name Строка поиска
   * @returns {Promise<Array>} Массив найденных папок
   */
  async searchFolders(name) {
    try {
      return await fetchWithLogging(`${API_BASE_URL}/folders/search?name=${encodeURIComponent(name)}`);
    } catch (error) {
      console.error(`Ошибка при поиске папок по запросу ${name}:`, error);
      throw new Error(`Не удалось выполнить поиск папок по запросу ${name}`);
    }
  }

  /**
   * Создать новую папку
   * @param {Object} folderData Данные новой папки
   * @param {string} folderData.name Название папки
   * @param {string} folderData.type Тип папки
   * @param {string|null} folderData.parent_id ID родительской папки (null для корневой)
   * @returns {Promise<Object>} Данные созданной папки
   */
  async createFolder(folderData) {
    // Преобразуем из snake_case в camelCase
    const requestData = {
      name: folderData.name,
      type: folderData.type,
      parentId: folderData.parent_id
    };
    
    try {
      return await fetchWithLogging(`${API_BASE_URL}/folders`, {
        method: 'POST',
        body: JSON.stringify(requestData)
      });
    } catch (error) {
      console.error('Ошибка при создании папки:', error);
      throw new Error(error.message || 'Не удалось создать папку');
    }
  }

  /**
   * Переименовать папку
   * @param {string} id ID папки
   * @param {string} newName Новое имя папки
   * @returns {Promise<Object>} Обновленные данные папки
   */
  async renameFolder(id, newName) {
    try {
      const response = await fetchWithLogging(`${API_BASE_URL}/folders/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ 
          name: newName 
        })
      });
      
      return {
        success: true,
        message: `Папка успешно переименована на "${newName}"`,
        folder: response
      };
    } catch (error) {
      console.error(`Ошибка при переименовании папки с ID ${id}:`, error);
      throw new Error(error.message || `Не удалось переименовать папку с ID ${id}`);
    }
  }

  /**
   * Удалить папку
   * @param {string} id ID папки
   * @param {boolean} recursive Этот параметр не используется в текущем API
   * @returns {Promise<Object>} Результат операции
   */
  async deleteFolder(id) {
    try {
      await fetchWithLogging(`${API_BASE_URL}/folders/${id}`, {
        method: 'DELETE'
      });
      
      return {
        success: true,
        message: `Папка успешно удалена`
      };
    } catch (error) {
      console.error(`Ошибка при удалении папки с ID ${id}:`, error);
      throw new Error(error.message || `Не удалось удалить папку с ID ${id}`);
    }
  }

  /**
   * Добавить транспортное средство в папку
   * @param {string} folderId ID папки
   * @param {string} vehicleId ID транспортного средства
   * @returns {Promise<Object>} Результат операции
   */
  async addVehicleToFolder(folderId, vehicleId) {
    try {
      await fetchWithLogging(`${API_BASE_URL}/folders/${folderId}/vehicles/${vehicleId}`, {
        method: 'POST'
      });
      
      return {
        success: true,
        message: `Транспортное средство успешно добавлено в папку`
      };
    } catch (error) {
      console.error(`Ошибка при добавлении ТС ${vehicleId} в папку ${folderId}:`, error);
      throw new Error(error.message || `Не удалось добавить ТС ${vehicleId} в папку ${folderId}`);
    }
  }

  /**
   * Добавить транспортные средства в папку
   * @param {string} folderId ID папки
   * @param {Array<string>} vehicleIds Массив ID транспортных средств
   * @returns {Promise<Object>} Результат операции
   */
  async addVehiclesToFolder(folderId, vehicleIds) {
    // Последовательно добавляем каждое ТС в папку
    const results = await Promise.all(
      vehicleIds.map(vehicleId => this.addVehicleToFolder(folderId, vehicleId))
    );
    
    return {
      success: true,
      message: `Добавлено ${results.length} транспортных средств в папку`,
      vehicles_count: results.length
    };
  }

  /**
   * Удалить транспортное средство из папки
   * @param {string} folderId ID папки
   * @param {string} vehicleId ID транспортного средства
   * @returns {Promise<Object>} Результат операции
   */
  async removeVehicleFromFolder(folderId, vehicleId) {
    try {
      await fetchWithLogging(`${API_BASE_URL}/folders/${folderId}/vehicles/${vehicleId}`, {
        method: 'DELETE'
      });
      
      return {
        success: true,
        message: `Транспортное средство успешно удалено из папки`
      };
    } catch (error) {
      console.error(`Ошибка при удалении ТС ${vehicleId} из папки ${folderId}:`, error);
      throw new Error(error.message || `Не удалось удалить ТС ${vehicleId} из папки ${folderId}`);
    }
  }

  /**
   * Синхронизировать ТС в папке
   * @param {string} folderId ID папки
   * @returns {Promise<Object>} Результат операции
   */
  async syncFolderVehicles(folderId) {
    try {
      await fetchWithLogging(`${API_BASE_URL}/folders/${folderId}/sync`, {
        method: 'POST'
      });
      
      return {
        success: true,
        message: `Транспортные средства успешно синхронизированы`
      };
    } catch (error) {
      console.error(`Ошибка при синхронизации ТС в папке ${folderId}:`, error);
      throw new Error(error.message || `Не удалось синхронизировать ТС в папке ${folderId}`);
    }
  }

  /**
   * Проверить существование и создать папку "Данные по тарифам" если её нет
   * @returns {Promise<boolean>} Существовала ли папка до проверки
   */
  async ensureTariffDataFolder() {
    try {
      console.log('Проверка наличия папки "Данные по тарифам"...');
      // Получаем все папки
      const folders = await this.getAllFolders();
      
      // Проверяем наличие папки "Данные по тарифам" в корне
      const found = folders.some(folder => 
        folder.name === 'Данные по тарифам' && folder.parentId === null
      );
      
      if (!found) {
        console.log('Папка "Данные по тарифам" не найдена, создаем...');
        // Если не нашли, создаем новую папку
        await this.createFolder({
          name: 'Данные по тарифам',
          type: 'folder',
          parent_id: null
        });
        return false;
      }
      
      console.log('Папка "Данные по тарифам" найдена');
      return true;
    } catch (error) {
      console.error('Ошибка при проверке папки "Данные по тарифам":', error);
      // Это не критичная ошибка, просто логируем и продолжаем
      return false;
    }
  }

  /**
   * Получить транспорт по группе
   * @param {string} groupId ID группы
   * @returns {Promise<Array>} Массив транспорта
   */
  async getVehiclesByGroup(groupId) {
    try {
      // Получаем папку группы вместе с её содержимым
      const groupFolder = await this.getFolderById(groupId);
      
      // Возвращаем ТС группы, если они есть
      return groupFolder.vehicles || [];
    } catch (error) {
      console.error(`Ошибка при получении ТС для группы ${groupId}:`, error);
      throw new Error(`Не удалось получить транспорт для группы ${groupId}`);
    }
  }

  /**
   * Получить все транспортные средства
   * @returns {Promise<Array>} Массив транспортных средств
   */
  async getAllVehicles() {
    try {
      return await fetchWithLogging(`${API_BASE_URL}/vehicles`);
    } catch (error) {
      console.error('Ошибка при загрузке транспортных средств:', error);
      throw new Error('Не удалось загрузить транспортные средства');
    }
  }

  /**
   * Проверяет, совпадают ли имена (с учетом возможных различий в написании)
   * @param {string} folderName Имя папки
   * @param {string} userGroup Значение user_group транспортного средства
   * @returns {boolean} True, если имена считаются похожими
   */
  isNameSimilar(folderName, userGroup) {
    if (!folderName || !userGroup) return false;
    
    // Нормализуем строки: приводим к нижнему регистру и удаляем лишние пробелы
    const normalizedFolderName = folderName.trim().toLowerCase();
    const normalizedUserGroup = userGroup.trim().toLowerCase();
    
    // Проверяем точное совпадение
    if (normalizedFolderName === normalizedUserGroup) return true;
    
    // Проверяем, является ли одна строка подстрокой другой
    if (normalizedFolderName.includes(normalizedUserGroup) || 
        normalizedUserGroup.includes(normalizedFolderName)) {
      return true;
    }
    
    // Дополнительные проверки можно добавить здесь
    // Например, сравнение без пунктуации, проверка на схожесть и т.д.
    
    // Удаляем пунктуацию и снова сравниваем
    const cleanFolderName = normalizedFolderName.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g,"").replace(/\s+/g, " ");
    const cleanUserGroup = normalizedUserGroup.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g,"").replace(/\s+/g, " ");
    
    if (cleanFolderName === cleanUserGroup) return true;
    
    return false;
  }

  /**
   * Загрузить дерево папок и сопоставить транспортные средства по user_group
   * @returns {Promise<Array>} Дерево папок с транспортными средствами
   */
  async getFolderTreeWithVehiclesByUserGroup() {
    try {
      console.log('Загрузка папок и транспортных средств с сопоставлением по user_group...');
      
      // Получаем все папки
      const folders = await this.getAllFolders();
      
      if (!folders || !Array.isArray(folders)) {
        console.warn('Получен пустой или некорректный ответ при запросе папок:', folders);
        return [];
      }
      
      console.log(`Получено ${folders.length} папок, загружаем транспортные средства...`);
      
      // Получаем все транспортные средства
      const allVehicles = await this.getAllVehicles();
      
      if (!allVehicles || !Array.isArray(allVehicles)) {
        console.warn('Получен пустой или некорректный ответ при запросе транспортных средств:', allVehicles);
        return this.getFolderTree(); // Возвращаем обычное дерево папок
      }
      
      console.log(`Получено ${allVehicles.length} транспортных средств, выполняем сопоставление...`);
      
      // Создаем мапу папок для быстрого доступа
      const folderMap = new Map();
      folders.forEach(folder => {
        // Инициализируем children и vehicles для каждой папки
        folder.children = [];
        folder.vehicles = folder.vehicles || [];
        folderMap.set(folder.id, folder);
      });
      
      // Строим дерево
      const rootFolders = [];
      
      // Проходим по всем папкам и добавляем их в дерево
      folders.forEach(folder => {
        // Если у папки есть родитель, добавляем её в children родителя
        if (folder.parentId !== null) {
          const parent = folderMap.get(folder.parentId);
          if (parent) {
            parent.children.push(folder);
          } else {
            // Если родителя нет, добавляем в корень (таких быть не должно)
            console.warn(`Папка "${folder.name}" (ID: ${folder.id}) имеет parentId=${folder.parentId}, но родитель не найден`);
            rootFolders.push(folder);
          }
        } else {
          // Если родителя нет, это корневая папка
          rootFolders.push(folder);
        }
      });
      
      // Сопоставляем транспортные средства с группами по полю user_group
      allVehicles.forEach(vehicle => {
        // Проверяем наличие поля metadata.user_group или user_group в корне объекта
        let userGroup = null;
        
        // Проверяем metadata.user_group
        if (vehicle.metadata && vehicle.metadata.user_group) {
          userGroup = vehicle.metadata.user_group;
        } 
        // Проверяем user_group в корне объекта
        else if (vehicle.user_group) {
          userGroup = vehicle.user_group;
          
          // Если у объекта нет поля metadata, создаем его
          if (!vehicle.metadata) {
            vehicle.metadata = {};
          }
          
          // Копируем user_group в metadata для совместимости
          vehicle.metadata.user_group = userGroup;
        }
        
        if (userGroup) {
          console.log(`Обработка ТС "${vehicle.name}" (ID: ${vehicle.id}) с user_group: "${userGroup}"`);
          
          // Ищем группу с похожим именем
          folders.forEach(folder => {
            if (folder.type === 'group' && this.isNameSimilar(folder.name, userGroup)) {
              // Проверяем, не добавлено ли уже это транспортное средство
              const vehicleExists = folder.vehicles.some(v => v.id === vehicle.id);
              if (!vehicleExists) {
                // Добавляем ТС в группу
                folder.vehicles.push({
                  ...vehicle,
                  // Убедимся, что поле metadata существует
                  metadata: vehicle.metadata || {}
                });
                console.log(`Добавлено ТС "${vehicle.name}" (ID: ${vehicle.id}) в группу "${folder.name}" по соответствию user_group: "${userGroup}"`);
              }
            }
          });
        } else {
          // Для отладки выводим информацию о ТС без metadata.user_group и user_group
          console.log(`ТС "${vehicle.name}" (ID: ${vehicle.id}) не имеет ни поля metadata.user_group, ни поля user_group`);
        }
      });
      
      // Сортируем папки по имени
      const sortFolders = (folders) => {
        folders.sort((a, b) => a.name.localeCompare(b.name));
        folders.forEach(folder => {
          if (folder.children && folder.children.length > 0) {
            sortFolders(folder.children);
          }
          // Сортируем транспортные средства по имени
          if (folder.vehicles && folder.vehicles.length > 0) {
            folder.vehicles.sort((a, b) => {
              const nameA = a.name || a.imei || '';
              const nameB = b.name || b.imei || '';
              return nameA.localeCompare(nameB);
            });
          }
        });
      };
      
      sortFolders(rootFolders);
      
      console.log('Дерево папок с ТС по user_group успешно построено:', rootFolders);
      return rootFolders;
    } catch (error) {
      console.error('Ошибка при получении дерева папок с ТС по user_group:', error);
      // В случае ошибки пытаемся получить обычное дерево папок
      return this.getFolderTree();
    }
  }

  /**
   * Создать группы на основе user_group транспортных средств и добавить ТС в эти группы
   * @param {string} parentId ID родительской папки для новых групп (тариф или корневая папка)
   * @returns {Promise<Object>} Результат операции
   */
  async createGroupsFromUserGroups(parentId = null) {
    try {
      console.log('Создание групп на основе user_group транспортных средств...');
      
      // Получаем все транспортные средства
      const vehicles = await this.getAllVehicles();
      
      if (!vehicles || !Array.isArray(vehicles)) {
        console.warn('Получен пустой или некорректный ответ при запросе транспортных средств');
        return { success: false, error: 'Не удалось получить транспортные средства' };
      }
      
      // Группируем транспортные средства по полю user_group из metadata или из корня объекта
      const userGroups = {};
      let vehiclesWithUserGroup = 0;
      
      vehicles.forEach(vehicle => {
        // Получаем user_group либо из metadata, либо из корня объекта
        let userGroup = null;
        
        if (vehicle.metadata && vehicle.metadata.user_group) {
          userGroup = vehicle.metadata.user_group.trim();
        } else if (vehicle.user_group) {
          userGroup = vehicle.user_group.trim();
        }
        
        if (userGroup) {
          if (!userGroups[userGroup]) {
            userGroups[userGroup] = [];
          }
          userGroups[userGroup].push(vehicle);
          vehiclesWithUserGroup++;
        }
      });
      
      console.log(`Найдено ${Object.keys(userGroups).length} уникальных групп по полю user_group, всего ${vehiclesWithUserGroup} ТС с указанной группой`);
      
      // Если не найдено ни одной группы, возвращаем сообщение об ошибке
      if (Object.keys(userGroups).length === 0) {
        return { 
          success: false, 
          error: 'Не найдено транспортных средств с заполненным полем user_group' 
        };
      }
      
      // Получаем существующие папки для проверки наличия групп
      const folders = await this.getAllFolders();
      const existingGroups = folders.filter(folder => folder.type === 'group');
      
      // Для каждой группы по user_group создаем папку, если она не существует
      const createdGroups = [];
      let errorsCount = 0;
      
      for (const userGroup of Object.keys(userGroups)) {
        // Проверяем, существует ли уже папка с похожим именем
        const existingGroup = existingGroups.find(group => this.isNameSimilar(group.name, userGroup));
        
        if (existingGroup) {
          console.log(`Группа "${userGroup}" уже существует (ID: ${existingGroup.id})`);
          
          // Добавляем транспортные средства в существующую группу
          const vehiclesToAdd = userGroups[userGroup];
          const vehicleIds = vehiclesToAdd.map(v => v.id);
          
          try {
            await this.addVehiclesToFolder(existingGroup.id, vehicleIds);
            createdGroups.push({
              id: existingGroup.id,
              name: existingGroup.name,
              vehiclesCount: vehiclesToAdd.length,
              isNew: false
            });
          } catch (error) {
            console.error(`Ошибка при добавлении ТС в группу "${userGroup}":`, error);
            errorsCount++;
          }
        } else {
          // Создаем новую группу
          try {
            const newGroup = await this.createFolder({
              name: userGroup,
              type: 'group',
              parent_id: parentId
            });
            
            console.log(`Создана новая группа "${userGroup}" (ID: ${newGroup.id})`);
            
            // Добавляем транспортные средства в новую группу
            const vehiclesToAdd = userGroups[userGroup];
            const vehicleIds = vehiclesToAdd.map(v => v.id);
            
            await this.addVehiclesToFolder(newGroup.id, vehicleIds);
            
            createdGroups.push({
              id: newGroup.id,
              name: newGroup.name,
              vehiclesCount: vehiclesToAdd.length,
              isNew: true
            });
          } catch (error) {
            console.error(`Ошибка при создании группы "${userGroup}":`, error);
            errorsCount++;
          }
        }
      }
      
      return {
        success: true,
        message: `Создано/обновлено ${createdGroups.length} групп на основе user_group`,
        groups: createdGroups,
        errorsCount
      };
    } catch (error) {
      console.error('Ошибка при создании групп на основе user_group:', error);
      throw new Error('Не удалось создать группы на основе user_group');
    }
  }
}

export default new FolderService(); 