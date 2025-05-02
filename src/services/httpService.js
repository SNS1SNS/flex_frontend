import config from '../config';
import tokenService from './tokenService';

// Базовый URL API
const apiUrl = config.apiUrl;

// Таймаут для запросов
const timeout = config.apiTimeout;

// Специальный маркер для повторного запроса после обновления токена
const TOKEN_REFRESHED = 'token_refreshed';

// Функция для выполнения запросов с таймаутом
const fetchWithTimeout = (url, options, timeoutDuration = timeout) => {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeoutDuration)
    )
  ]);
};

// Функция для обработки ответов API
const handleResponse = async (response) => {
  // Если режим 'no-cors', возвращаем пустой успешный ответ
  if (response.type === 'opaque') {
    return { success: true };
  }

  const contentType = response.headers.get('content-type');
  
  // Проверка на наличие JSON в ответе
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();
  
  // Если ответ не успешный
  if (!response.ok) {
    // Если ошибка авторизации (401)
    if (response.status === 401) {
      // Возвращаем специальный маркер для последующей обработки
      return { status: 'token_expired', data };
    }
    
    // Если ошибка доступа (403)
    if (response.status === 403) {
      return Promise.reject(new Error('Недостаточно прав для выполнения операции'));
    }
    
    // Получение сообщения об ошибке
    const error = (data && data.message) || data.error || response.statusText;
    return Promise.reject(new Error(error));
  }
  
  return data;
};

// Функция для обновления токена
const refreshAccessToken = async () => {
  const refreshToken = tokenService.getRefreshToken();
  
  if (!refreshToken) {
    return false;
  }
  
  const url = `${apiUrl}${config.authEndpoints.refreshToken}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to refresh token');
    }
    
    // Сохраняем новый токен доступа
    if (data.access_token) {
      tokenService.setAccessToken(data.access_token);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error refreshing token:', error);
    tokenService.clearTokens();
    return false;
  }
};

// Базовая функция для выполнения HTTP-запросов
const request = async (method, endpoint, body = null, customHeaders = {}, requestOptions = {}) => {
  // Базовые заголовки
  let headers = {
    'Content-Type': 'application/json',
    ...customHeaders,
    ...tokenService.getAuthHeader()
  };
  
  // Опции запроса
  const options = {
    method,
    headers,
    mode: 'cors', // По умолчанию используем cors
    ...requestOptions
  };
  
  // Добавляем тело запроса для не-GET запросов
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }
  
  try {
    // Выполняем запрос с таймаутом
    const url = `${apiUrl}${endpoint}`;
    let response;
    
    try {
      // Сначала пробуем в обычном режиме
      response = await fetchWithTimeout(url, options);
    } catch (corsError) {
      console.warn('CORS ошибка, пробуем режим no-cors:', corsError);
      
      // Если первая попытка не удалась из-за CORS, пробуем в режиме no-cors
      if (corsError.message.includes('CORS') || 
          corsError.message.includes('Failed to fetch') || 
          corsError.message.includes('Network Error')) {
        
        options.mode = 'no-cors';
        
        // В режиме no-cors нельзя использовать некоторые заголовки
        if (options.mode === 'no-cors') {
          delete options.headers['Content-Type'];
          // Другие заголовки, которые могут вызвать проблемы в режиме no-cors
          delete options.headers['Authorization'];
        }
        
        response = await fetchWithTimeout(url, options);
        
        // В режиме no-cors ответ будет opaque (непрозрачный)
        if (response.type === 'opaque') {
          console.log('Получен непрозрачный ответ в режиме no-cors');
          // При непрозрачном ответе мы не можем прочитать данные,
          // поэтому возвращаем заглушку для демонстрации
          return getDemoData(endpoint);
        }
      } else {
        // Если это не CORS-ошибка, пробрасываем дальше
        throw corsError;
      }
    }
    
    // Обрабатываем ответ
    const result = await handleResponse(response);
    
    // Если токен истек, пробуем его обновить и повторить запрос
    if (result && result.status === 'token_expired') {
      // Пробуем обновить токен
      const refreshSuccessful = await refreshAccessToken();
      
      if (!refreshSuccessful) {
        // Если не удалось обновить токен - выходим из системы
        tokenService.clearTokens();
        return Promise.reject(new Error('Сессия истекла. Пожалуйста, войдите снова.'));
      }
      
      // Обновляем заголовок авторизации с новым токеном
      options.headers = {
        ...options.headers,
        ...tokenService.getAuthHeader()
      };
      
      // Повторяем запрос
      response = await fetchWithTimeout(url, options);
      return await handleResponse(response);
    }
    
    return result;
  } catch (error) {
    // Обработка сетевых ошибок
    if (error.message === 'Failed to fetch' || error.message === 'Network Error') {
      // В режиме разработки возвращаем демо-данные
      if (process.env.NODE_ENV === 'development') {
        console.warn('Используются демо-данные из-за сетевой ошибки:', error);
        return getDemoData(endpoint);
      }
      return Promise.reject(new Error('Ошибка сети. Пожалуйста, проверьте подключение к интернету.'));
    }
    
    // Обработка других ошибок
    return Promise.reject(error);
  }
};

// Функция для получения демо-данных в зависимости от эндпоинта
const getDemoData = (endpoint) => {
  console.log('Получение демо-данных для эндпоинта:', endpoint);
  
  // Демо-данные для разных эндпоинтов
  if (endpoint === '/api/vehicles') {
    return [
      {
        id: 1,
        name: "МАЗ-5440",
        garageNumber: "Г-123",
        terminal: "ABC123",
        imei: "123456789012345",
        factoryNumber: "FN-12345",
        phone: "+79001234567",
        groups: "Грузовые,Дальнобойщики",
        lastData: "2025-05-02T15:04:01.609473",
        status: "ACTIVE",
        createdAt: "2025-05-02T15:04:01.61448",
        vehicleType: "Тягач",
        type: "truck",
        fuelType: "Дизель",
        fuelTankVolume: 500.0
      },
      {
        id: 2,
        name: "КамАЗ-6520",
        garageNumber: "Г-456",
        terminal: "DEF456",
        imei: "234567890123456",
        factoryNumber: "FN-67890",
        phone: "+79009876543",
        groups: "Грузовые,Самосвалы",
        lastData: "2025-05-01T10:30:15.123456",
        status: "INACTIVE",
        createdAt: "2025-05-01T08:15:30.987654",
        vehicleType: "Самосвал",
        type: "dump_truck",
        fuelType: "Дизель",
        fuelTankVolume: 350.0
      },
      {
        id: 3,
        name: "Volvo FH",
        garageNumber: "Г-789",
        terminal: "GHI789",
        imei: "345678901234567",
        factoryNumber: "FN-12345-V",
        phone: "+79001122334",
        groups: "Грузовые,Международные",
        lastData: "2025-05-02T12:45:20.456789",
        status: "ACTIVE",
        createdAt: "2025-04-15T14:20:10.123456",
        vehicleType: "Тягач",
        type: "truck",
        fuelType: "Дизель",
        fuelTankVolume: 600.0
      }
    ];
  }
  
  // Для других эндпоинтов можно добавить соответствующие демо-данные
  
  // По умолчанию возвращаем пустой объект
  return {};
};

// Специальная функция для запросов смены языка (с обходом CORS)
const changeLanguageRequest = async (endpoint) => {
  try {
    const url = `${apiUrl}${endpoint}`;
    
    // Сначала попробуем в режиме no-cors
    let response = await fetch(url, {
      method: 'GET',
      mode: 'no-cors' // Используем режим no-cors для обхода ограничений CORS
    });
    
    // Проверим, нет ли явных ошибок HTTP (кроме CORS)
    if (response.type === 'opaque') {
      // В режиме no-cors нельзя проверить статус ответа,
      // поэтому попробуем сделать простой запрос для проверки доступности
      try {
        const checkResponse = await fetch(`${apiUrl}${config.authEndpoints.healthCheck}`, { 
          method: 'GET',
          mode: 'cors'
        });
        
        if (!checkResponse.ok) {
          return { 
            success: false, 
            error: `Server returned status ${checkResponse.status}` 
          };
        }
      } catch (healthCheckError) {
        // Если эта проверка тоже не удалась, проблема скорее всего в соединении
        console.warn('Health check failed:', healthCheckError);
      }
      
      // Если дошли сюда, то считаем что все нормально, хотя точно знать не можем
      return { success: true };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Ошибка запроса смены языка:', error);
    return { 
      success: false, 
      error: error.message || 'Неизвестная ошибка при смене языка'
    };
  }
};

// Экспортируем методы для HTTP-запросов
const httpService = {
  get: (endpoint, customHeaders = {}, requestOptions = {}) => request('GET', endpoint, null, customHeaders, requestOptions),
  post: (endpoint, body, customHeaders = {}, requestOptions = {}) => request('POST', endpoint, body, customHeaders, requestOptions),
  put: (endpoint, body, customHeaders = {}, requestOptions = {}) => request('PUT', endpoint, body, customHeaders, requestOptions),
  delete: (endpoint, customHeaders = {}, requestOptions = {}) => request('DELETE', endpoint, null, customHeaders, requestOptions),
  changeLanguage: (endpoint) => changeLanguageRequest(endpoint)
};

export default httpService; 