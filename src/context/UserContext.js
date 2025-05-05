import React, { createContext, useState, useEffect, useContext } from 'react';
import { authService } from '../services';

// Создаем контекст
const UserContext = createContext(null);

let isLoadingUserData = false;
let cachedUserData = null;
let cacheTime = null;
const CACHE_TTL = 10 * 60 * 1000;

/**
 * Провайдер контекста пользователя
 */
export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Загрузка данных пользователя при монтировании компонента
  useEffect(() => {
    const fetchUserData = async () => {
      // Проверяем, что запрос еще не отправлен другим компонентом
      if (isLoadingUserData) {
        console.log('=== ДАННЫЕ ПОЛЬЗОВАТЕЛЯ УЖЕ ЗАГРУЖАЮТСЯ ===');
        // Ждем завершения загрузки данных
        const checkCachedData = setInterval(() => {
          if (cachedUserData !== null) {
            clearInterval(checkCachedData);
            setUser(cachedUserData);
            setLoading(false);
          }
        }, 100);
        return;
      }

      // Проверяем актуальность кэша
      if (cachedUserData && cacheTime && (Date.now() - cacheTime < CACHE_TTL)) {
        console.log('=== ИСПОЛЬЗУЕМ КЭШИРОВАННЫЕ ДАННЫЕ ПОЛЬЗОВАТЕЛЯ ===');
        setUser(cachedUserData);
        setLoading(false);
        return;
      }

      try {
        isLoadingUserData = true;
        console.log('=== ЗАГРУЗКА ДАННЫХ ПОЛЬЗОВАТЕЛЯ ===');
        
        const userData = await authService.getCurrentUser();
        
        console.log('=== ДАННЫЕ ПОЛЬЗОВАТЕЛЯ ПОЛУЧЕНЫ ===', userData?.username);
        
        // Сохраняем данные в кэш
        cachedUserData = userData;
        cacheTime = Date.now();
        
        setUser(userData);
      } catch (err) {
        console.error('Ошибка при получении данных пользователя:', err);
        setError(err);
      } finally {
        isLoadingUserData = false;
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  // Функция для обновления данных пользователя (сбрасывает кэш)
  const refreshUserData = async () => {
    setLoading(true);
    try {
      // Сбрасываем кэш
      cachedUserData = null;
      cacheTime = null;
      
      console.log('=== ПРИНУДИТЕЛЬНОЕ ОБНОВЛЕНИЕ ДАННЫХ ПОЛЬЗОВАТЕЛЯ ===');
      const userData = await authService.getCurrentUser();
      
      // Сохраняем в кэш новые данные
      cachedUserData = userData;
      cacheTime = Date.now();
      
      setUser(userData);
    } catch (err) {
      console.error('Ошибка при обновлении данных пользователя:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  // Очистка данных при выходе
  const clearUserData = () => {
    cachedUserData = null;
    cacheTime = null;
    setUser(null);
  };

  return (
    <UserContext.Provider 
      value={{ 
        user, 
        loading, 
        error, 
        refreshUserData, 
        clearUserData 
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

// Хук для использования контекста пользователя
export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser должен использоваться внутри UserProvider');
  }
  return context;
};

export default UserContext; 