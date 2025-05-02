import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { tokenService } from '../services';
import { useUser } from '../context/UserContext';

/**
 * Компонент защищенного маршрута
 * Проверяет авторизацию пользователя и перенаправляет на страницу входа,
 * если пользователь не авторизован
 * 
 * @param {Object} props - Свойства компонента
 * @param {React.ReactNode} props.children - Дочерние элементы (защищенный контент)
 * @param {string[]} [props.roles] - Список ролей, которым разрешен доступ
 * @returns {React.ReactNode} Защищенный контент или редирект на страницу входа
 */
const PrivateRoute = ({ children, roles = [] }) => {
  const { user, loading } = useUser();
  const location = useLocation();

  // Проверяем наличие токена
  const hasToken = tokenService.hasToken();

  // Определяем, авторизован ли пользователь
  const authenticated = hasToken && user !== null;
  
  // Определяем, есть ли у пользователя нужная роль
  const authorized = authenticated && (roles.length === 0 || (
    user && (
      (Array.isArray(user.roles) && roles.some(role => user.roles.includes(role))) ||
      (user.role && roles.includes(user.role))
    )
  ));

  // Показываем индикатор загрузки
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Загрузка...</p>
      </div>
    );
  }

  // Перенаправляем на страницу входа, если пользователь не авторизован
  if (!authenticated) {
    return (
      <Navigate 
        to="/login" 
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  // Перенаправляем на страницу с ошибкой доступа, если у пользователя нет нужной роли
  if (!authorized) {
    return (
      <Navigate 
        to="/access-denied" 
        state={{ from: location.pathname, user }}
        replace
      />
    );
  }

  // Возвращаем защищенный контент
  return children;
};

export default PrivateRoute; 