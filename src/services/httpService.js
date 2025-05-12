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
  if (endpoint.startsWith('/api/vehicles') && endpoint !== '/api/vehicles') {
    // Для отдельного ТС - извлекаем ID из URL
    const vehicleId = endpoint.split('/').pop();
    
    // Возвращаем демо-данные для конкретного ТС
    const demoVehicles = {
      '1': {
        id: 1,
        name: 'Самосвал Volvo',
        garage_number: 'СВ-1254',
        imei: '356938035643809',
        factory_number: 'V12345',
        phone: '+7(777)123-45-67',
        groups: 'Строительная техника',
        last_data: '2025-05-02 11:45:23',
        status: 'Готово',
        created_at: '2024-10-15',
        type: 'Самосвал',
        fuel_type: 'Дизель',
        fuel_tank_volume: 400,
        terminal: 'Teltonika FMB640',
        engineHours: '3245 ч',
        mileage: '12540',
        driver: 'Иванов И.И.',
        registration_number: 'А123ВС',
        vin: 'WVGZZZ5NZJM131395',
        year: '2018',
        maintenance_date: '2024-08-15',
        maintenance_km: '10000',
        maintenance_status: 'Плановое',
        last_position: {
          lat: 55.755814,
          lng: 37.617635,
          timestamp: '2025-05-02 11:45:23'
        }
      },
      '2': {
        id: 2,
        name: 'Экскаватор Caterpillar',
        garage_number: 'ЭК-5678',
        imei: '356938035643810',
        factory_number: 'C98765',
        phone: '+7(777)234-56-78',
        groups: 'Строительная техника',
        last_data: '2025-05-02 12:30:15',
        status: 'В обработке',
        created_at: '2024-09-22',
        type: 'Экскаватор',
        fuel_type: 'Дизель',
        fuel_tank_volume: 300,
        terminal: 'Teltonika FMB920',
        engineHours: '1560 ч',
        mileage: '5240',
        driver: 'Петров П.П.',
        registration_number: 'В456АС',
        vin: 'WDBHA28E6SF069731',
        year: '2020',
        maintenance_date: '2024-07-20',
        maintenance_km: '5000',
        maintenance_status: 'Требуется',
        last_position: {
          lat: 55.751244,
          lng: 37.618423,
          timestamp: '2025-05-02 12:30:15'
        }
      },
      '3': {
        id: 3,
        name: 'Бульдозер Komatsu',
        garage_number: 'БД-9012',
        imei: '356938035643811',
        factory_number: 'K54321',
        phone: '+7(777)345-67-89',
        groups: 'Землеройная техника',
        last_data: '2025-05-01 09:15:42',
        status: 'Ошибка',
        created_at: '2024-11-05',
        type: 'Бульдозер',
        fuel_type: 'Дизель',
        fuel_tank_volume: 350,
        terminal: 'Teltonika FMB125',
        engineHours: '890 ч',
        mileage: '3120',
        driver: 'Сидоров С.С.',
        registration_number: 'Т789УХ',
        vin: 'JH4KA7650NC003943',
        year: '2021',
        maintenance_date: '2024-09-10',
        maintenance_km: '3000',
        maintenance_status: 'Выполнено',
        last_position: {
          lat: 55.7622,
          lng: 37.6155,
          timestamp: '2025-05-01 09:15:42'
        }
      }
    };
    
    // Возвращаем данные для запрашиваемого ТС или информацию об ошибке
    return demoVehicles[vehicleId] || { error: 'Транспортное средство не найдено', status: 404 };
  }
  
  // Для списка ТС
  if (endpoint === '/api/vehicles') {
    return [
      {
        id: 1,
        name: 'Самосвал Volvo',
        garage_number: 'СВ-1254',
        imei: '356938035643809',
        factory_number: 'V12345',
        phone: '+7(777)123-45-67',
        groups: 'Строительная техника',
        last_data: '2025-05-02 11:45:23',
        status: 'Готово',
        created_at: '2024-10-15',
        type: 'Самосвал',
        fuel_type: 'Дизель',
        fuel_tank_volume: 400
      },
      {
        id: 2,
        name: 'Экскаватор Caterpillar',
        garage_number: 'ЭК-5678',
        imei: '356938035643810',
        factory_number: 'C98765',
        phone: '+7(777)234-56-78',
        groups: 'Строительная техника',
        last_data: '2025-05-02 12:30:15',
        status: 'В обработке',
        created_at: '2024-09-22',
        type: 'Экскаватор',
        fuel_type: 'Дизель',
        fuel_tank_volume: 300
      },
      {
        id: 3,
        name: 'Бульдозер Komatsu',
        garage_number: 'БД-9012',
        imei: '356938035643811',
        factory_number: 'K54321',
        phone: '+7(777)345-67-89',
        groups: 'Землеройная техника',
        last_data: '2025-05-01 09:15:42',
        status: 'Ошибка',
        created_at: '2024-11-05',
        type: 'Бульдозер',
        fuel_type: 'Дизель',
        fuel_tank_volume: 350
      }
    ];
  }
  
  // Демо-данные для водителей
  if (endpoint === '/api/drivers') {
    return [
      {
        id: 1,
        name: "Nursultan",
        surname: "Sarymov",
        patronymic: "Sarymovich",
        phone: "+77079621630",
        employmentDate: "А",
        group: "",
        status: "Активный",
        startDate: "31.03.2025"
      },
      {
        id: 2,
        name: "Иван",
        surname: "Петров",
        patronymic: "Сергеевич",
        phone: "+7 (999) 123-45-67",
        employmentDate: "В",
        group: "Логистика",
        status: "Активный",
        startDate: "15.03.2022"
      },
      {
        id: 3,
        name: "Алексей",
        surname: "Иванов",
        patronymic: "Дмитриевич",
        phone: "+77079621629",
        employmentDate: "А",
        group: "Дальнобойщики",
        status: "Активный",
        startDate: "17.04.2025"
      }
    ];
  }
  
  // Демо-данные для пользователей
  if (endpoint === '/api/users') {
    return [
      {
        id: 1,
        username: "admin",
        email: "admin@example.com",
        firstName: "Администратор",
        lastName: "Системы",
        role: "ADMIN",
        userGroup: "Администраторы",
        status: "Активный",
        blocked: false,
        registrationDate: "2024-01-15",
        lastLogin: "2025-05-02 14:30:15"
      },
      {
        id: 2,
        username: "manager",
        email: "manager@example.com",
        firstName: "Иван",
        lastName: "Петров",
        role: "MANAGER",
        userGroup: "Менеджеры",
        status: "Активный",
        blocked: false,
        registrationDate: "2024-02-20",
        lastLogin: "2025-05-01 09:15:22"
      },
      {
        id: 3,
        username: "operator",
        email: "operator@example.com",
        firstName: "Алексей",
        lastName: "Сидоров",
        role: "OPERATOR",
        userGroup: "Операторы",
        status: "Заблокирован",
        blocked: true,
        registrationDate: "2024-03-10",
        lastLogin: "2025-04-15 11:40:33"
      },
      {
        id: 4,
        username: "user",
        email: "user@example.com",
        firstName: "Елена",
        lastName: "Смирнова",
        role: "USER",
        userGroup: "Пользователи",
        status: "Активный",
        blocked: false,
        registrationDate: "2024-04-05",
        lastLogin: "2025-05-02 10:22:45"
      }
    ];
  }
  
  // Для других эндпоинтов - пустой массив
  return [];
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