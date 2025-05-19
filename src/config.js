// Конфигурация API
const config = {
  // Базовый URL API
  apiUrl: 'https://185.234.114.212:8443',
  
  // Таймаут для запросов (в миллисекундах)
  apiTimeout: 15000,
  
  // Настройки для токенов
  tokenConfig: {
    // Префикс для заголовка Authorization
    tokenPrefix: 'Bearer',
    
    // Ключи для хранения в localStorage
    accessTokenKey: 'access_token',
    refreshTokenKey: 'refresh_token',
  },
  
  // Пути API для аутентификации
  authEndpoints: {
    login: '/api/auth/login',
    demoLogin: '/api/auth/demo',
    refreshToken: '/api/auth/refresh-token',
    userInfo: '/api/auth/me', // Эндпоинт для получения информации о пользователе
    user: '/api/auth/user',
    changeLanguage: '/api/auth/change-language',
    healthCheck: '/api/health-check'
  },
  
  // Пути API для работы с транспортными средствами и их данными
  endpoints: {
    vehicles: '/api/vehicles',
    // Тарировочные таблицы
    calibration: {
      base: (vehicleId) => `/api/vehicles/${vehicleId}/calibration`,
      getAll: (vehicleId) => `/api/vehicles/${vehicleId}/calibration`,
      save: (vehicleId) => `/api/vehicles/${vehicleId}/calibration`
    }
  }
};

console.log('Загружена конфигурация приложения:', config);

export default config;