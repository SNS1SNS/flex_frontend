// Конфигурация API
const config = {
  // Базовый URL API
  apiUrl: 'http://localhost:8081',
  
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
  }
};

console.log('Загружена конфигурация приложения:', config);

export default config;