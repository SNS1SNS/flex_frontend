// Экспорт всех сервисов для удобного импорта
import authService from './authService';
import httpService from './httpService';
import tokenService from './tokenService';
import apiService from './ApiService';

export {
  authService,
  httpService,
  tokenService,
  apiService
};

// Экспорт сервисов по умолчанию
export default {
  auth: authService,
  http: httpService,
  token: tokenService,
  api: apiService
}; 