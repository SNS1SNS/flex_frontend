import React, { useEffect, useState, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faTruck, faUser, faUsers, 
    faFileAlt,
    faRightFromBracket, faInfo, faQuestion, 
    faUserTie
} from '@fortawesome/free-solid-svg-icons';
import './Sidebar.css';
import './ProfileMenu.css';
import { authService } from '../services';
import { useUser } from '../context/UserContext';
import { 
    createPulseEffect,
    animateOnHover,
    resetNavItemStyles,
    initActiveNavItem,
    setupResponsiveMode
} from '../utils/navigationAnimation';
import logo from '../images/logo.svg';  // Импортируйте изображение

/**
 * Компонент боковой панели навигации с продвинутыми анимациями
 */
const Sidebar = () => {
    const location = useLocation();
    const { clearUserData } = useUser();
    const [isCompactMode, setIsCompactMode] = useState(false);
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);
    const profileMenuRef = useRef(null);
    const headerRef = useRef(null);
    
    // Функция для выхода из аккаунта
    const handleLogout = () => {
        // Очищаем данные пользователя в контексте
        clearUserData();
        // Выполняем стандартный выход
        authService.logout();
        window.location.href = '/login';
    };

    // Проверка, является ли текущий путь активным
    const isActive = (path) => {
        return location.pathname.startsWith(path) ? 'active' : '';
    };

    // Функция для переключения видимости профильного меню
    const toggleProfileMenu = (e) => {
        e.stopPropagation();
        setProfileMenuOpen(!profileMenuOpen);
        
        // Добавляем/удаляем класс для body при открытии/закрытии меню
        if (!profileMenuOpen) {
            document.body.classList.add('profile-menu-open');
        } else {
            document.body.classList.remove('profile-menu-open');
        }
    };
    
    // Обработчик для закрытия профильного меню при клике вне его
    const handleClickOutside = (event) => {
        if (
            profileMenuRef.current && 
            !profileMenuRef.current.contains(event.target) &&
            headerRef.current && 
            !headerRef.current.contains(event.target)
        ) {
            setProfileMenuOpen(false);
        }
    };

    // Инициализация эффектов анимации при загрузке компонента
    useEffect(() => {
        // Инициализируем активный элемент меню
        initActiveNavItem();
        
        // Настраиваем адаптивный режим для мобильных устройств
        setupResponsiveMode();

        // Обработчики событий для элементов навигации
        const setupNavItemEventHandlers = () => {
            const navItems = document.querySelectorAll('.nav-item');
            
            navItems.forEach(item => {
                // Эффект при клике
                item.addEventListener('click', function(e) {
                    // Если это не ссылка, предотвращаем действие по умолчанию
                    if (!this.tagName === 'A') {
                        e.preventDefault();
                    }
                    
                    // Создаем эффект пульсации
                    createPulseEffect(this);
                });
                
                // Улучшенный эффект при наведении
                item.addEventListener('mouseenter', function() {
                    if (!this.classList.contains('active')) {
                        animateOnHover(this);
                    }
                });
                
                // Плавное снятие эффекта при уходе мыши
                item.addEventListener('mouseleave', function() {
                    if (!this.classList.contains('active')) {
                        resetNavItemStyles(this);
                    }
                });
            });
        };
        
        setupNavItemEventHandlers();
        
        // Добавляем обработчик клика для закрытия профильного меню
        document.addEventListener('click', handleClickOutside);
        
        // Очистка обработчиков при размонтировании
        return () => {
            // Удаляем обработчики событий
            const navItems = document.querySelectorAll('.nav-item');
            navItems.forEach(item => {
                item.removeEventListener('mouseenter', () => {});
                item.removeEventListener('mouseleave', () => {});
                item.removeEventListener('click', () => {});
            });
            
            document.removeEventListener('click', handleClickOutside);
        };
    }, [location.pathname]);

    // Отслеживаем изменение состояния компактного режима
    useEffect(() => {
        // Проверяем наличие класса compact-mode у сайдбара
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            setIsCompactMode(sidebar.classList.contains('compact-mode'));
        }
        
        // Добавляем обработчик для отслеживания изменений классов
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    setIsCompactMode(sidebar.classList.contains('compact-mode'));
                }
            });
        });
        
        if (sidebar) {
            observer.observe(sidebar, { attributes: true });
        }
        
        return () => {
            if (sidebar) {
                observer.disconnect();
            }
        };
    }, []);

    return (
        <div className={`sidebar ${isCompactMode ? 'compact-mode' : ''}`}>
            {/* Шапка бокового меню с выпадающим профильным меню */}
            <div 
                className="sidebar-header" 
                id="sidebarHeader" 
                ref={headerRef} 
                onClick={toggleProfileMenu}
            >
                {/* Проверяем путь к изображению и используем импорт для SVG или абсолютный путь */}
                <img 
                  src = {logo} 
                  alt="Контроль Техники" 
                  className="logo-image" 
                />
                <h1 className="logo-text">Контроль Техники</h1>
            </div>
            
            {/* Выпадающее меню профиля */}
            <div 
                className={`profile-menu ${profileMenuOpen ? 'active' : 'hidden'}`} 
                id="profileMenu" 
                ref={profileMenuRef}
            >
                
                <ul>
                    <li className="profile-item">
                        <FontAwesomeIcon icon={faUser} className="profile-icon" />
                        <a href="#" className='profile-text'>ТОО Контроль Техники</a>
                    </li>

                    <li className="menu-item">
                        <FontAwesomeIcon icon={faFileAlt} className="menu-icon" />
                        <Link to="/reports">К отчетам</Link>
                    </li>
                    
                    <li className="menu-item">
                        <FontAwesomeIcon icon={faQuestion} className="menu-icon" />
                        <a href="#">Руководство пользователя</a>
                    </li>
                    
                    <li className="menu-item">
                        <FontAwesomeIcon icon={faInfo} className="menu-icon" />
                        <a href="#">О программе</a>
                    </li>
                    
                    <li className="menu-item" onClick={handleLogout}>
                        <FontAwesomeIcon icon={faRightFromBracket} className="menu-icon" />
                        <a href="#" id="logout-link">Выход</a>
                    </li>
                </ul>
            </div>
            
            <div className="sidebar-nav">
                <div className="nav-group">
                    <div className="nav-group-title">Основное меню</div>
                    <Link to="/vehicles" className={`nav-item ${isActive('/vehicles')}`}>
                        <FontAwesomeIcon icon={faTruck} />
                        <span>Транспортные средства</span>
                    </Link>

                    <Link to="/drivers" className={`nav-item ${isActive('/drivers')}`}>
                        <FontAwesomeIcon icon={faUserTie} />
                        <span>Водители</span>
                    </Link>
                    
                    
                </div>
                
                <div className="nav-group">
                    <div className="nav-group-title">Администрирование</div>
                    <Link to="/users" className={`nav-item ${isActive('/users')}`}>
                        <FontAwesomeIcon icon={faUsers} />
                        <span>Пользователи</span>
                    </Link>
                </div>
            </div>
            
        </div>
    );
};

export default Sidebar;