import config from '../config';
import httpService from './httpService';
import tokenService from './tokenService';

// Извлекаем конфигурацию для эндпоинтов аутентификации
const { authEndpoints } = config;

// Переменные для кэширования данных пользователя
let cachedUser = null;
let cacheTime = null;
const CACHE_TTL = 10 * 60 * 1000; // Время жизни кэша в миллисекундах (10 минут)
let isLoadingUser = false; // Флаг для отслеживания статуса загрузки

/**
 * Аутентификация пользователя
 * @param {string} username - Имя пользователя
 * @param {string} password - Пароль
 * @returns {Promise<Object>} Данные пользователя и токены
 */
const login = async (username, password) => {
  try {
    console.log('=== НАЧАЛО АВТОРИЗАЦИИ ===');
    console.log('Попытка входа для пользователя:', username);
    
    const response = await httpService.post(
      authEndpoints.login,
      { username, password }
    );
    
    console.log('Данные авторизации получены:', {
      userId: response.userId,
      username: response.username,
      role: response.role,
      token: response.token ? `${response.token.substring(0, 15)}...` : undefined,
      permissions: response.permissions
    });

    // Проверяем формат ответа от сервера
    if (response.token) {
      // Новый формат ответа от сервера с JWT в поле "token"
      tokenService.setAccessToken(response.token);
      
      // Сохраняем роль пользователя
      if (response.role) {
        localStorage.setItem('user_role', response.role);
        
        // Проверяем, что роль сохранилась
        const savedRole = localStorage.getItem('user_role');
        console.log('Роль пользователя сохранена:', savedRole);
      } else {
        console.warn('Роль пользователя не найдена в ответе!');
      }
    } 
    else if (response.access_token && response.refresh_token) {
      // Старый формат ответа с access_token и refresh_token
      console.log('Обнаружен старый формат ответа с access_token и refresh_token');
      tokenService.setTokens(response.access_token, response.refresh_token);
      
      // Сохраняем роль пользователя, если она есть
      if (response.user && response.user.role) {
        localStorage.setItem('user_role', response.user.role);
        console.log('Роль пользователя сохранена:', response.user.role);
      }
    } else {
      console.warn('Внимание! Токены не найдены в ответе от сервера');
    }

    console.log('=== АВТОРИЗАЦИЯ ЗАВЕРШЕНА УСПЕШНО ===');
    return response;
  } catch (error) {
    console.error('=== ОШИБКА АВТОРИЗАЦИИ ===', error);
    
    // Для демонстрации - если ошибка связана с CORS, имитируем успешный вход
    if (error.message && (
        error.message.includes('сети') || 
        error.message.includes('CORS') ||
        error.message.includes('Failed to fetch')
      )) {
      console.warn('Используется демо-режим из-за проблем с CORS');
      
      // Создаем фиктивные токены для демонстрации
      const mockResponse = {
        token: 'mock_access_token_' + Date.now(),
        userId: 1,
        username: username || 'demo_user',
        name: 'Демо Пользователь',
        role: 'USER'
      };
      
      // Сохраняем токен и роль
      tokenService.setAccessToken(mockResponse.token);
      localStorage.setItem('user_role', mockResponse.role);
      
      console.log('=== ДЕМО-РЕЖИМ АКТИВИРОВАН ===');
      return mockResponse;
    }
    
    throw error;
  }
};

/**
 * Демо-вход (без учетных данных)
 * @returns {Promise<Object>} Данные пользователя и токены
 */
const demoLogin = async () => {
  try {
    const response = await httpService.get(authEndpoints.demoLogin);

    // Если в ответе есть токены - сохраняем их
    if (response.access_token && response.refresh_token) {
      tokenService.setTokens(response.access_token, response.refresh_token);
      
      // Сохраняем роль пользователя, если она есть
      if (response.user && response.user.role) {
        localStorage.setItem('user_role', response.user.role);
      }
    }

    return response;
  } catch (error) {
    console.error('Ошибка демо-входа:', error);
    
    // Для демонстрации - если ошибка связана с CORS, имитируем успешный вход
    if (error.message && (
        error.message.includes('сети') || 
        error.message.includes('CORS') ||
        error.message.includes('Failed to fetch')
      )) {
      console.warn('Используется демо-режим из-за проблем с CORS');
      
      // Создаем фиктивные токены для демонстрации
      const mockResponse = {
        access_token: 'mock_demo_token_' + Date.now(),
        refresh_token: 'mock_demo_refresh_' + Date.now(),
        user: {
          id: 999,
          username: 'demo',
          name: 'Демонстрационный аккаунт',
          role: 'DEMO'
        }
      };
      
      // Сохраняем токены и роль
      tokenService.setTokens(mockResponse.access_token, mockResponse.refresh_token);
      localStorage.setItem('user_role', mockResponse.user.role);
      
      return mockResponse;
    }
    
    throw error;
  }
};

/**
 * Выход из системы (удаление токенов)
 */
const logout = () => {
  // Очищаем кэш данных пользователя
  cachedUser = null;
  cacheTime = null;
  
  tokenService.clearTokens();
  localStorage.removeItem('user_role');
};

/**
 * Получение информации о текущем пользователе
 * @param {boolean} forceRefresh - Принудительное обновление данных (игнорирует кэш)
 * @returns {Promise<Object>} Данные пользователя
 */
const getCurrentUser = async (forceRefresh = false) => {
  // Проверяем наличие токена
  if (!tokenService.hasToken()) {
    return null;
  }

  // Проверяем кэш
  if (!forceRefresh && cachedUser && cacheTime && (Date.now() - cacheTime < CACHE_TTL)) {
    console.log('=== ИСПОЛЬЗУЕМ КЭШИРОВАННЫЕ ДАННЫЕ ПОЛЬЗОВАТЕЛЯ ===');
    return cachedUser;
  }

  // Проверяем, выполняется ли уже запрос данных
  if (isLoadingUser) {
    console.log('=== ЗАПРОС НА ПОЛУЧЕНИЕ ДАННЫХ ПОЛЬЗОВАТЕЛЯ УЖЕ ВЫПОЛНЯЕТСЯ ===');
    // Ждем, пока текущий запрос завершится
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!isLoadingUser) {
          clearInterval(checkInterval);
          resolve(cachedUser);
        }
      }, 100);
    });
  }

  try {
    isLoadingUser = true;
    console.log('=== ЗАПРАШИВАЕМ ДАННЫЕ ПОЛЬЗОВАТЕЛЯ С СЕРВЕРА ===');
    
    const user = await httpService.get(authEndpoints.userInfo);
    
    // Если с сервера пришла роль, сохраняем её
    if (user && user.role) {
      localStorage.setItem('user_role', user.role);
    }
    
    // Кэшируем данные пользователя
    cachedUser = user;
    cacheTime = Date.now();
    
    console.log('=== ДАННЫЕ ПОЛЬЗОВАТЕЛЯ ПОЛУЧЕНЫ ===', user?.username);
    
    return user;
  } catch (error) {
    console.error('Ошибка получения данных пользователя:', error);
    
    // Если ошибка связана с CORS и токен начинается с 'mock_', 
    // значит мы находимся в демо-режиме
    const accessToken = tokenService.getAccessToken();
    if (accessToken && accessToken.startsWith('mock_')) {
      // В демо-режиме просто возвращаем фиктивные данные
      const mockUser = getMockUserForToken(accessToken);
      
      // Кэшируем демо-данные
      cachedUser = mockUser;
      cacheTime = Date.now();
      
      return mockUser;
    }
    
    return null;
  } finally {
    isLoadingUser = false;
  }
};

/**
 * Получает мок-данные пользователя по токену
 */
const getMockUserForToken = (token) => {
  if (token.includes('admin')) {
    return {
      id: 888,
      username: 'admin',
      name: 'Администратор',
      role: 'ADMIN'
    };
  } else if (token.includes('demo')) {
    return {
      id: 999,
      username: 'demo',
      name: 'Демонстрационный аккаунт',
      role: 'DEMO'
    };
  } else {
    return {
      id: 1,
      username: 'user',
      name: 'Демо Пользователь',
      role: 'USER'
    };
  }
};

/**
 * Смена языка пользователя
 * @param {string} language - Код языка (ru, en, kz)
 * @returns {Promise<Object>} Результат операции
 */
const changeLanguage = async (language) => {
  try {
    // Сохраняем выбранный язык в localStorage
    localStorage.setItem('app_language', language);
    
    // Если пользователь авторизован, пытаемся отправить запрос на сервер
    if (tokenService.hasToken()) {
      try {
        const endpoint = `${authEndpoints.changeLanguage}?language=${language}`;
        await httpService.changeLanguage(endpoint);
      } catch (serverError) {
        console.warn('Не удалось синхронизировать язык с сервером:', serverError);
        // Ошибку сервера игнорируем, так как основная задача уже выполнена (язык сохранен локально)
      }
    }
    
    return { success: true, language };
  } catch (error) {
    console.error('Ошибка смены языка:', error);
    return { success: false, error: error.message };
  }
};

// Экспортируем все функции в объекте authService
const authService = {
  login,
  demoLogin,
  logout,
  getCurrentUser,
  changeLanguage
};

export default authService; 