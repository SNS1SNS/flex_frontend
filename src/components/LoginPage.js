import React, { useState, useEffect, useRef } from 'react';
import './LoginPage.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faSignInAlt, faGlobe, faUser, faLock, faSpinner } from '@fortawesome/free-solid-svg-icons';
import authService from '../services/authService';

function LoginPage() {
  // Получаем сохраненный язык из localStorage или используем 'ru' по умолчанию
  const savedLanguage = localStorage.getItem('app_language') || 'ru';
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginType, setLoginType] = useState('client');
  const [lang, setLang] = useState(savedLanguage);
  const [showDropdown, setShowDropdown] = useState(false);
  const [message, setMessage] = useState({ text: '', category: '' });
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef(null);
  
  // Объект с переводами
  const translations = {
    ru: {
      name_website: 'Контроль Техники',
      client_login: 'ВХОД ДЛЯ КЛИЕНТА',
      admin_login: 'ВХОД ДЛЯ АДМИНИСТРАТОРА',
      username: 'Имя пользователя',
      password: 'Пароль',
      login: 'ВХОД',
      demo_login: 'Демо-вход',
      copyright: '© 2025 ТОО "Контроль Техники". Все права защищены.',
      client: 'Клиент',
      admin: 'Администратор',
      login_success: 'Вход выполнен успешно',
      login_error: 'Ошибка входа: ',
      connection_error: 'Ошибка соединения с сервером',
      processing: 'Обработка...'
    },
    en: {
      name_website: 'Equipment Control',
      client_login: 'CLIENT LOGIN',
      admin_login: 'ADMIN LOGIN',
      username: 'Username',
      password: 'Password',
      login: 'LOGIN',
      demo_login: 'Demo Login',
      copyright: '© 2025 "Equipment Control" LLP. All rights reserved.',
      client: 'Client',
      admin: 'Administrator',
      login_success: 'Login successful',
      login_error: 'Login error: ',
      connection_error: 'Server connection error',
      processing: 'Processing...'
    },
    kz: {
      name_website: 'Техника Бақылауы',
      client_login: 'КЛИЕНТ КІРУ',
      admin_login: 'ӘКІМШІ КІРУ',
      username: 'Пайдаланушы аты',
      password: 'Құпия сөз',
      login: 'КІРУ',
      demo_login: 'Демо кіру',
      copyright: '© 2025 "Техника Бақылауы" ЖШС. Барлық құқықтар қорғалған.',
      client: 'Клиент',
      admin: 'Әкімші',
      login_success: 'Кіру сәтті болды',
      login_error: 'Кіру қатесі: ',
      connection_error: 'Сервермен байланыс қатесі',
      processing: 'Өңдеу...'
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    // Сбрасываем предыдущие сообщения и устанавливаем состояние загрузки
    setMessage({ text: '', category: '' });
    setIsLoading(true);
    
    try {
      console.log('=== ПРОЦЕСС ВХОДА В СИСТЕМУ ===');
      console.log('Начинаем авторизацию для пользователя:', username);
      
      // Используем authService для входа
      const data = await authService.login(username, password, loginType);
      
      // Проверяем, что данные получены (не логируем их повторно, это делает authService)
      if (data) {
        console.log('Авторизация успешна');
      }
      
      // Устанавливаем сообщение об успешном входе
      setMessage({ 
        text: currentTranslations.login_success, 
        category: 'success' 
      });
      
      // Перенаправление на соответствующую страницу после входа
      setTimeout(() => {
        // Проверяем роль пользователя для перенаправления
        const userRole = localStorage.getItem('user_role');
        console.log('=== ПЕРЕНАПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯ ===');
        console.log('Роль пользователя:', userRole);
        
        if (userRole === 'ADMIN') {
          // Если пользователь - админ, перенаправляем на панель администратора
          console.log('Перенаправление администратора на /admin');
          window.location.href = '/admin';
        } else {
          // Иначе перенаправляем на страницу транспортных средств
          console.log('Перенаправление пользователя на /vehicles');
          window.location.href = '/vehicles';
        }
      }, 1500);
    } catch (error) {
      console.error('=== ОШИБКА ВХОДА ===');
      console.error('Детали ошибки:', error.message || error);
      
      // Устанавливаем сообщение об ошибке
      setMessage({ 
        text: `${currentTranslations.login_error} ${error}`, 
        category: 'danger' 
      });
    } finally {
      // В любом случае выключаем индикатор загрузки
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async (e) => {
    e.preventDefault();
    
    setMessage({ text: '', category: '' });
    setIsLoading(true);
    
    try {
      // Используем authService для демо-входа
      const data = await authService.demoLogin();
      
      // Устанавливаем сообщение об успешном входе
      setMessage({ 
        text: currentTranslations.login_success, 
        category: 'success' 
      });
      
      // Перенаправление на демо-страницу
      setTimeout(() => {
        window.location.href = '/vehicles';
      }, 1500);
    } catch (error) {
      // Устанавливаем сообщение об ошибке
      setMessage({ 
        text: `${currentTranslations.login_error} ${error}`, 
        category: 'danger' 
      });
      console.error('Demo login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDropdown = (e) => {
    e.preventDefault();
    setShowDropdown(!showDropdown);
  };

  const changeLanguage = async (newLang, e) => {
    e.preventDefault();
    
    try {
      // Устанавливаем локальный язык сразу
      setLang(newLang);
      setShowDropdown(false);
      
      // Отправляем запрос на сервер для синхронизации языка
      const result = await authService.changeLanguage(newLang);
      
      if (!result.success) {
        console.warn(`Язык был изменен только локально: ${result.error || 'Неизвестная ошибка'}`);
      }
    } catch (error) {
      console.error('Language change error:', error);
      // Даже при ошибке язык остается измененным локально
    }
  };

  // Закрытие выпадающего меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Определение текущих переводов
  const currentTranslations = translations[lang];
  
  const loginTitle = loginType === 'admin' 
    ? currentTranslations.admin_login 
    : currentTranslations.client_login;

  const languageNames = {
    'ru': 'Русский',
    'en': 'English',
    'kz': 'Қазақша'
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="logo-container">
          <h2 className="logo">{currentTranslations.name_website}</h2>
        </div>
        
        <h1 className="login-title">{loginTitle}</h1>

        {message.text && (
          <div id="login-message">
            <div className={`alert alert-${message.category}`}>{message.text}</div>
          </div>
        )}
        
        <form id="login-form" onSubmit={handleLogin}>
          <div className="form-group">
            <div className="input-icon-wrapper">
              <input
                type="text"
                id="username"
                name="username"
                placeholder={currentTranslations.username}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isLoading}
              />
              <i><FontAwesomeIcon icon={faUser} /></i>
              <div className="error-message" id="username-error"></div>
            </div>
          </div>
          
          <div className="form-group">
            <div className="input-icon-wrapper">
              <input
                type="password"
                id="password"
                name="password"
                placeholder={currentTranslations.password}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
              <i><FontAwesomeIcon icon={faLock} /></i>
              <div className="error-message" id="password-error"></div>
            </div>
          </div>
          
          <input 
            type="hidden" 
            name="login_type" 
            id="login_type" 
            value={loginType} 
          />
          
          <div className="form-group">
            <button type="submit" className="login-button" disabled={isLoading}>
              {isLoading ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin className="spinner-icon" /> 
                  {currentTranslations.processing}
                </>
              ) : (
                currentTranslations.login
              )}
            </button>
          </div>
        </form>
        
        <div className="options-row">
          <div className="language-selector">
            <div className="dropdown" ref={dropdownRef}>
              <button 
                className="dropdown-button" 
                onClick={toggleDropdown}
                disabled={isLoading}
              >
                <i><FontAwesomeIcon icon={faGlobe} /></i>
                <span id="current-lang">{languageNames[lang]}</span>
                <i><FontAwesomeIcon icon={faChevronDown} /></i>
              </button>
              <div 
                className={`dropdown-content ${showDropdown ? 'show' : ''}`} 
                id="languageDropdown"
              >
                {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                <a href="#" onClick={(e) => changeLanguage('ru', e)}>
                  Русский
                </a>
                {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                <a href="#" onClick={(e) => changeLanguage('en', e)}>
                  English
                </a>
                {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                <a href="#" onClick={(e) => changeLanguage('kz', e)}>
                  Қазақша
                </a>
              </div>
            </div>
          </div>
          
          {/* Кнопка обычного демо-входа */}
          <a 
            href="#" 
            className="demo-button" 
            onClick={handleDemoLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <i><FontAwesomeIcon icon={faSpinner} spin /></i> 
                {currentTranslations.processing}
              </>
            ) : (
              <>
                <i><FontAwesomeIcon icon={faSignInAlt} /></i> 
                {currentTranslations.demo_login}
              </>
            )}
          </a>
        </div>
      </div>
      
      <div className="footer">
        <p>{currentTranslations.copyright}</p>
      </div>
    </div>
  );
}

export default LoginPage; 