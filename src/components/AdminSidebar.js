import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faTruck, faUser, faUsers, faSignOutAlt,
    faCog, faDesktop, faExchangeAlt, faFileAlt,
    faEnvelope, faVideo, faBell, faFolder,
    faExclamationTriangle, faCreditCard, faLanguage,
    faPlusCircle, faWrench, faTachometerAlt, faCar, faUserTie, faClipboardList
} from '@fortawesome/free-solid-svg-icons';
import './AdminSidebar.css';
import { authService } from '../services';

/**
 * Компонент боковой панели для административной части приложения
 */
const AdminSidebar = () => {
    const location = useLocation();
    
    // Функция для выхода из аккаунта
    const handleLogout = () => {
        authService.logout();
        window.location.href = '/login';
    };

    // Проверка, является ли текущий путь активным
    const isActive = (path) => {
        return location.pathname.startsWith(path) ? 'active' : '';
    };

    return (
        <div className="admin-sidebar">
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    <FontAwesomeIcon icon={faTachometerAlt} />
                    <span className="logo-text">FlexAdmin</span>
                </div>
            </div>
            
            <div className="sidebar-menu">
                <ul>
                    <li className={isActive('/admin/vehicles')}>
                        <Link to="/admin/vehicles">
                            <FontAwesomeIcon icon={faCar} />
                            <span>Транспортные средства</span>
                        </Link>
                    </li>
                    <li className={isActive('/admin/drivers')}>
                        <Link to="/admin/drivers">
                            <FontAwesomeIcon icon={faUserTie} />
                            <span>Водители</span>
                        </Link>
                    </li>
                    <li className={isActive('/admin/users')}>
                        <Link to="/admin/users">
                            <FontAwesomeIcon icon={faUsers} />
                            <span>Пользователи</span>
                        </Link>
                    </li>
                    {/* 
                    <li className={isActive('/admin/reports')}>
                        <Link to="/admin/reports">
                            <FontAwesomeIcon icon={faClipboardList} />
                            <span>Отчеты</span>
                        </Link>
                    </li>
                    <li className={isActive('/admin/settings')}>
                        <Link to="/admin/settings">
                            <FontAwesomeIcon icon={faCog} />
                            <span>Настройки</span>
                        </Link>
                    </li>
                    */}
                </ul>
            </div>
            
            <div className="sidebar-footer">
                <button onClick={handleLogout} className="nav-item logout-button">
                    <FontAwesomeIcon icon={faSignOutAlt} />
                    <span>Выход</span>
                </button>
            </div>
        </div>
    );
};

export default AdminSidebar; 