/**
 * Утилиты для работы с авторизацией
 */

/**
 * Получение JWT токена авторизации из localStorage
 * @returns {string|null} Токен авторизации или null, если токен не найден
 */
export const getAuthToken = () => {
  // Проверяем различные варианты хранения токена
  const possibleTokenKeys = ['authToken', 'token', 'jwt', 'access_token'];
  
  for (const key of possibleTokenKeys) {
    const token = localStorage.getItem(key);
    if (token) {
      // Проверяем, является ли токен корректным JWT (содержит 2 точки)
      if (token.split('.').length === 3) {
        return token;
      }
    }
  }
  
  // Если не нашли JWT токен в localStorage, возвращаем null
  return null;
};

/**
 * Проверка авторизации пользователя
 * @returns {boolean} true если пользователь авторизован, иначе false
 */
export const isAuthenticated = () => {
  return getAuthToken() !== null;
};

/**
 * Получение данных пользователя из токена
 * @returns {Object|null} Данные пользователя или null, если токен не найден или не валиден
 */
export const getUserData = () => {
  const token = getAuthToken();
  
  if (!token) {
    return null;
  }
  
  try {
    // JWT токен состоит из трех частей, разделенных точками
    // Вторая часть содержит данные пользователя, закодированные в base64
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    
    // Декодируем base64 и преобразуем в объект
    const userData = JSON.parse(window.atob(base64));
    return userData;
  } catch (error) {
    console.error('Ошибка при декодировании токена:', error);
    return null;
  }
};

/**
 * Очистка данных авторизации
 */
export const clearAuth = () => {
  const possibleTokenKeys = ['authToken', 'token', 'jwt', 'access_token'];
  
  for (const key of possibleTokenKeys) {
    localStorage.removeItem(key);
  }
  
  // Также удаляем другие связанные с авторизацией данные
  localStorage.removeItem('user');
  localStorage.removeItem('userData');
  localStorage.removeItem('userRole');
}; 