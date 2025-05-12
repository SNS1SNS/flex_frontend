// Экспорт всех сервисов для удобного импорта
import authService from './authService';
import httpService from './httpService';
import tokenService from './tokenService';
import apiService from './ApiService';
import calibrationService from './calibrationService';

export {
  authService,
  httpService,
  tokenService,
  apiService,
  calibrationService
};

// Экспорт сервисов по умолчанию
export default {
  auth: authService,
  http: httpService,
  token: tokenService,
  api: apiService,
  calibration: calibrationService
}; 