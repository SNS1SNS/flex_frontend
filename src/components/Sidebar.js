import React, { useEffect, useState, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faTruck, faUser, faUsers, 
    faFileAlt,
    faRightFromBracket, faInfo, faQuestion, 
    faUserTie,
    faCalendarAlt,
    faTimes,
    faCheck
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
    
    // Состояния для календаря
    const [showDateModal, setShowDateModal] = useState(false);
    const [selectedDate, setSelectedDate] = useState(() => {
        // Проверяем, сохранена ли дата в localStorage
        const savedDate = localStorage.getItem('selectedDate');
        return savedDate || new Date().toISOString().split('T')[0]; // формат YYYY-MM-DD
    });
    const [tempDate, setTempDate] = useState(''); // Временное хранение выбранной даты
    const [showNotification, setShowNotification] = useState(false);
    const [notificationMessage, setNotificationMessage] = useState('');
    
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
    
    // Функция открытия модального окна выбора даты
    const openDateModal = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setTempDate(selectedDate); // Инициализируем временную дату текущим выбором
        setShowDateModal(true);
    };
    
    // Функция закрытия модального окна
    const closeDateModal = () => {
        setShowDateModal(false);
    };
    
    // Обработчик временного изменения даты
    const handleTempDateChange = (e) => {
        setTempDate(e.target.value);
    };
    
    // Обработчик применения выбранной даты
    const applyDateChange = () => {
        setSelectedDate(tempDate);
        
        // Сохраняем выбранную дату в localStorage
        localStorage.setItem('selectedDate', tempDate);
        
        // Показываем уведомление об успешном изменении
        showDateChangeNotification(tempDate);
        
        // Закрываем модальное окно
        setShowDateModal(false);
    };
    
    // Функция для показа уведомления об изменении даты
    const showDateChangeNotification = (date) => {
        setNotificationMessage(`Дата изменена на: ${formatDate(date)}`);
        setShowNotification(true);
        
        // Автоматическое скрытие уведомления через 3 секунды
        setTimeout(() => {
            setShowNotification(false);
        }, 3000);
    };
    
    // Отображение даты в удобном формате
    const formatDate = (dateString) => {
        if (!dateString) return '';
        
        const date = new Date(dateString);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        
        return `${day}.${month}.${year}`;
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
        
        // Закрываем модальное окно при клике вне его
        if (showDateModal) {
            const dateModal = document.querySelector('.date-modal-content');
            if (dateModal && !dateModal.contains(event.target)) {
                setShowDateModal(false);
            }
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
            
            {/* Модальное окно выбора даты */}
            {showDateModal && (
                <div className="date-modal-overlay">
                    <div className="date-modal-content">
                        <div className="date-modal-header">
                            <h3>Выберите дату</h3>
                            <button className="close-button" onClick={closeDateModal}>
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        </div>
                        <div className="date-modal-body">
                            <input 
                                type="date" 
                                value={tempDate} 
                                onChange={handleTempDateChange} 
                                className="date-picker"
                            />
                        </div>
                        <div className="date-modal-footer">
                            <button className="cancel-date" onClick={closeDateModal}>
                                Отмена
                            </button>
                            <button className="apply-date" onClick={applyDateChange}>
                                Применить
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Всплывающее уведомление */}
            {showNotification && (
                <div className="date-notification">
                    <div className="date-notification-icon">
                        <FontAwesomeIcon icon={faCheck} />
                    </div>
                    <div className="date-notification-message">
                        {notificationMessage}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sidebar;