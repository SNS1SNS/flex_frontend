/**
 * Утилиты для работы с ролями пользователей
 */

/**
 * Получение роли текущего пользователя из localStorage
 * @returns {string|null} - Роль пользователя или null
 */
export const getUserRole = () => {
  return localStorage.getItem('role');
};

/**
 * Проверка, имеет ли пользователь роль администратора
 * @returns {boolean} - true, если пользователь имеет роль ADMIN
 */
export const isAdmin = () => {
  const role = getUserRole();
  return role === 'ADMIN';
};

/**
 * Проверка, имеет ли пользователь указанную роль
 * @param {string|string[]} requiredRoles - Требуемая роль или массив ролей
 * @returns {boolean} - true, если пользователь имеет требуемую роль
 */
export const hasRole = (requiredRoles) => {
  const userRole = getUserRole();
  
  if (!userRole) return false;
  
  if (Array.isArray(requiredRoles)) {
    return requiredRoles.includes(userRole);
  }
  
  return userRole === requiredRoles;
}; 