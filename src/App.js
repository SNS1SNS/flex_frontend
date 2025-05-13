import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import VehiclesPage from './components/VehiclesPage';
import VehicleProfile from './components/VehicleProfile';
import DriversPage from './components/DriversPage';
import UsersPage from './components/UsersPage';
import ReportsPage from './components/reports/ReportsPage';
import ChartSyncTestPage from './components/reports/ChartSyncTestPage';
import PrivateRoute from './components/PrivateRoute';
import AdminLayout from './components/AdminLayout';
import Notifications from './components/common/Notifications';
import { isAdmin } from './utils/roleUtils';
import { UserProvider } from './context/UserContext';
import { SidebarProvider } from './context/SidebarContext';
import { LoadingProvider } from './context/LoadingContext';
import './App.css';

/**
 * Компонент-заглушка для административных страниц
 */
const AdminPlaceholder = ({ title }) => (
  <div className="admin-placeholder">
    <h1>{title}</h1>
    <p>Данный раздел находится в разработке</p>
  </div>
);

/**
 * Главный компонент приложения
 * Определяет структуру маршрутизации всего приложения
 */
function App() {
  return (
    <UserProvider>
      <SidebarProvider>
        <LoadingProvider>
          <BrowserRouter>
            <Notifications />
            <Routes>
              {/* Публичные маршруты */}
              <Route path="/login" element={<LoginPage />} />
              
              {/* Добавляем тестовую страницу */}
              <Route path="/chart-sync-test" element={<ChartSyncTestPage />} />
              
              {/* Защищенные маршруты для обычных пользователей */}
              
              <Route 
                path="/vehicles" 
                element={
                  <PrivateRoute>
                    <VehiclesPage />
                  </PrivateRoute>
                } 
              />
              
              {/* Маршрут для страницы профиля ТС */}
              <Route 
                path="/admin/vehicles/profile" 
                element={
                  <PrivateRoute>
                    <VehicleProfile />
                  </PrivateRoute>
                } 
              />
              
              {/* Перенаправление со старого URL dashboard на vehicles */}
              <Route 
                path="/dashboard" 
                element={<Navigate to="/vehicles" replace />} 
              />
              
              <Route 
                path="/drivers" 
                element={
                  <PrivateRoute>
                    <DriversPage />
                  </PrivateRoute>
                } 
              />
              
              <Route 
                path="/users" 
                element={
                  <PrivateRoute>
                    <UsersPage />
                  </PrivateRoute>
                } 
              />
              
              <Route 
                path="/reports" 
                element={
                  <PrivateRoute>
                    <ReportsPage />
                  </PrivateRoute>
                } 
              />
              
              {/* Административная панель */}
              <Route 
                path="/admin" 
                element={<AdminLayout />}
              >
                <Route path="vehicles" element={<AdminPlaceholder title="Транспортные средства" />} />
                <Route path="drivers" element={<AdminPlaceholder title="Водители" />} />
                <Route path="users" element={<AdminPlaceholder title="Пользователи" />} />
              </Route>
              
              {/* Маршрут по умолчанию */}
              <Route 
                path="/" 
                element={
                  isAdmin() ? <Navigate to="/admin" replace /> : <Navigate to="/vehicles" replace />
                } 
              />
              
              {/* Страница "Доступ запрещен" */}
              <Route 
                path="/access-denied" 
                element={
                  <div className="error-page">
                    <h1>Доступ запрещен</h1>
                    <p>У вас нет прав для просмотра этой страницы.</p>
                    <a href="/login">Вернуться на страницу входа</a>
                  </div>
                } 
              />
              
              {/* Обработка несуществующих маршрутов */}
              <Route 
                path="*" 
                element={
                  <div className="error-page">
                    <h1>Страница не найдена</h1>
                    <p>Страница, которую вы ищете, не существует.</p>
                    <a href="/login">Вернуться на страницу входа</a>
                  </div>
                } 
              />
            </Routes>
          </BrowserRouter>
        </LoadingProvider>
      </SidebarProvider>
    </UserProvider>
  );
}

export default App;
