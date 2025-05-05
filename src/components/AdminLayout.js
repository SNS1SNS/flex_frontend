import React, { useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import { isAdmin } from '../utils/roleUtils';
import { initSidebarHandlers } from '../utils/sidebarAnimation';
import './AdminLayout.css';

/**
 * Компонент-обертка для административной части приложения
 * Проверяет права доступа и отображает боковое меню + контент
 */
const AdminLayout = () => {
  // Проверка прав администратора
  const checkAdminRole = () => {
    // Возвращает true, если пользователь - администратор
    return isAdmin();
  };
  
  // Инициализация обработчиков для бокового меню
  useEffect(() => {
    initSidebarHandlers();
  }, []);
  
  // Если пользователь не администратор, перенаправляем на дашборд
  if (!checkAdminRole()) {
    return <Navigate to="/vehicles" replace />;
  }
  
  return (
    <div className="admin-layout">
      {/* Боковое меню */}
      <AdminSidebar />
      
      {/* Кнопка для переключения бокового меню на мобильных устройствах */}
      <button className="sidebar-toggle">
        <span></span>
        <span></span>
        <span></span>
      </button>
      
      {/* Основной контент */}
      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout; 