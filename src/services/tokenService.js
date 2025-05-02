import config from '../config';

// Получаем настройки токенов из конфигурации
const { accessTokenKey, refreshTokenKey, tokenPrefix } = config.tokenConfig;

// Для отслеживания вывода токенов в консоль
let loggedTokens = {
  accessToken: null,
  refreshToken: null,
  authHeader: false
};

// Проверка нужно ли логировать токен
const shouldLogToken = (tokenType, token) => {
  if (!token) return false;
  
  // Если токен отличается от предыдущего или еще не логировался
  if (loggedTokens[tokenType] !== token) {
    loggedTokens[tokenType] = token;
    return true;
  }
  
  return false;
};

// Функция для сохранения access token в localStorage
const setAccessToken = (token) => {
  if (token) {
    console.log('Сохраняем access token:', token.substring(0, 15) + '...');
    localStorage.setItem(accessTokenKey, token);
    
    // Сбрасываем для нового токена
    loggedTokens.accessToken = token;
    loggedTokens.authHeader = false;
    
    console.log('Access token сохранен');
    return true;
  }
  console.warn('Попытка сохранить пустой access token');
  return false;
};

// Функция для сохранения refresh token в localStorage
const setRefreshToken = (token) => {
  if (token) {
    console.log('Сохраняем refresh token:', token.substring(0, 15) + '...');
    localStorage.setItem(refreshTokenKey, token);
    
    // Сбрасываем для нового токена
    loggedTokens.refreshToken = token;
    
    return true;
  }
  console.warn('Попытка сохранить пустой refresh token');
  return false;
};

// Функция для получения access token из localStorage
const getAccessToken = (silent = false) => {
  const token = localStorage.getItem(accessTokenKey);
  
  if (token && !silent && shouldLogToken('accessToken', token)) {
    console.log('Получен access token из localStorage:', token.substring(0, 15) + '...');
  }
  
  return token;
};

// Функция для получения refresh token из localStorage
const getRefreshToken = (silent = false) => {
  const token = localStorage.getItem(refreshTokenKey);
  
  if (token && !silent && shouldLogToken('refreshToken', token)) {
    console.log('Получен refresh token из localStorage:', token.substring(0, 15) + '...');
  }
  
  return token;
};

// Функция для удаления всех токенов из localStorage
const clearTokens = () => {
  console.log('Удаляем все токены из localStorage');
  localStorage.removeItem(accessTokenKey);
  localStorage.removeItem(refreshTokenKey);
  
  // Сбрасываем логгированные токены
  loggedTokens = {
    accessToken: null,
    refreshToken: null,
    authHeader: false
  };
  
  console.log('Токены удалены');
};

// Функция для сохранения обоих токенов
const setTokens = (accessToken, refreshToken) => {
  console.log('Сохраняем оба токена в localStorage');
  let result = false;
  
  if (accessToken) {
    setAccessToken(accessToken);
    result = true;
  }
  
  if (refreshToken) {
    setRefreshToken(refreshToken);
    result = true;
  }
  
  return result;
};

// Функция для получения заголовка авторизации
const getAuthHeader = () => {
  const token = getAccessToken(true); // Получаем токен без логирования
  
  if (token) {
    if (!loggedTokens.authHeader) {
      console.log('Формируем заголовок авторизации с токеном');
      loggedTokens.authHeader = true;
    }
    
    return { 'Authorization': `${tokenPrefix} ${token}` };
  }
  
  if (!loggedTokens.authHeader) {
    console.warn('Не удалось сформировать заголовок авторизации - токен отсутствует');
    loggedTokens.authHeader = true;
  }
  
  return {};
};

// Проверка наличия токена
const hasToken = () => {
  const token = getAccessToken(true); // Получаем токен без логирования
  const hasAccessToken = !!token;
  
  // Логируем только важные изменения состояния
  if (!loggedTokens.hasToken || loggedTokens.hasToken !== hasAccessToken) {
    console.log('Проверка наличия токена:', hasAccessToken ? 'ТОКЕН НАЙДЕН' : 'ТОКЕН ОТСУТСТВУЕТ');
    loggedTokens.hasToken = hasAccessToken;
  }
  
  return hasAccessToken;
};

// Экспортируем функции
const tokenService = {
  setAccessToken,
  setRefreshToken,
  getAccessToken,
  getRefreshToken,
  clearTokens,
  setTokens,
  getAuthHeader,
  hasToken
};

export default tokenService; 