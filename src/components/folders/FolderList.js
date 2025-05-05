import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faFolder, 
  faFolderOpen, 
  faTags, 
  faUsers, 
  faCar, 
  faChevronDown, 
  faChevronRight, 
  faPlus, 
  faEdit, 
  faTrashAlt, 
  faEye,
  faSyncAlt,
  faSpinner, 
  faExclamationTriangle, 
  faTimes,
} from '@fortawesome/free-solid-svg-icons';
import FolderService from './FolderService';
import classNames from 'classnames';
import './FolderList.css';

const FolderList = ({ onVehicleSelect }) => {
  // Состояния для данных
  const [folderTree, setFolderTree] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Состояния для выбранных элементов
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(() => {
    // Пытаемся восстановить выбранное ТС из localStorage
    try {
      const savedVehicle = localStorage.getItem('lastSelectedVehicle');
      if (savedVehicle) {
        const parsed = JSON.parse(savedVehicle);
        // Проверяем, что сохраненные данные не устарели (не старше 1 дня)
        const isStillValid = Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000;
        if (isStillValid) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Ошибка при чтении из localStorage:', e);
    }
    return null;
  });
  
  // Состояния для модальных окон
  const [showModal, setShowModal] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  
  // Состояние для новой папки
  const [newFolder, setNewFolder] = useState({
    name: '',
    type: 'tariff',
    parent_id: '0'
  });
  
  // Рефы для DOM-элементов
  const contextMenuRef = useRef(null);
  
  // Добавляем новые состояния для глобального контекстного меню
  const [globalContextMenuPosition, setGlobalContextMenuPosition] = useState({ x: 0, y: 0 });
  const [showGlobalContextMenu, setShowGlobalContextMenu] = useState(false);
  
  // Реф для контейнера списка папок
  const folderListRef = useRef(null);
  
  // Инициализация данных при загрузке компонента
  useEffect(() => {
    initData();
  }, []);
  
  // Обработчик для закрытия контекстного меню при клике вне него
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target)) {
        hideContextMenu();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('scroll', hideContextMenu);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('scroll', hideContextMenu);
    };
  }, []);
  
  // Передаем выбранное ТС родительскому компоненту
  useEffect(() => {
    if (selectedVehicle && onVehicleSelect) {
      onVehicleSelect(selectedVehicle);
    }
  }, [selectedVehicle, onVehicleSelect]);
  
  // Инициализация обработчика глобального контекстного меню
  useEffect(() => {
    const handleGlobalContextMenu = (e) => {
      // Проверяем, находится ли клик внутри контейнера списка папок
      if (folderListRef.current && folderListRef.current.contains(e.target)) {
        // Если клик был на элементе, у которого уже есть свое контекстное меню, то не показываем глобальное
        if (e.target.closest('.folder-header') || e.target.closest('.vehicle-item')) {
          return;
        }
        
        e.preventDefault();
        
        // Вычисляем позицию меню с учетом размеров экрана
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Предполагаемые размеры меню
        const menuWidth = 280;
        const menuHeight = 250;
        
        // Получаем положение курсора с учетом скролла страницы
        let left = e.pageX;
        let top = e.pageY;
        
        // Проверяем, не выйдет ли меню за правую и нижнюю границы экрана
        if (left + menuWidth > viewportWidth) {
          left = left - menuWidth;
          if (left < 0) left = 10;
        }
        
        if (top + menuHeight > viewportHeight) {
          top = top - menuHeight;
          if (top < 0) top = 10;
        }
        
        // Позиционируем глобальное контекстное меню
        setGlobalContextMenuPosition({
          top: `${top}px`,
          left: `${left}px`,
        });
        
        // Скрываем обычное контекстное меню, если оно было открыто
        setShowContextMenu(false);
        
        // Показываем глобальное контекстное меню
        setTimeout(() => {
          setShowGlobalContextMenu(true);
        }, 10);
        
        // Добавляем обработчики для закрытия меню
        document.addEventListener('click', hideGlobalContextMenu, { once: true });
        document.addEventListener('contextmenu', hideGlobalContextMenu, { once: true });
        document.addEventListener('scroll', hideGlobalContextMenu, { once: true });
      }
    };
    
    // Добавляем обработчик глобального контекстного меню
    document.addEventListener('contextmenu', handleGlobalContextMenu);
    
    return () => {
      document.removeEventListener('contextmenu', handleGlobalContextMenu);
    };
  }, []);
  
  // Функция инициализации данных
  const initData = async () => {
    try {
      setLoading(true);
      
      showNotification('info', 'Загрузка данных...');
      console.log('Инициализация данных FolderList...');
      
      // Получаем дерево папок с транспортными средствами по user_group
      const folderTreeData = await FolderService.getFolderTreeWithVehiclesByUserGroup();
      console.log('Получены данные дерева папок с транспортными средствами:', folderTreeData);
      
      // Адаптируем данные для совместимости
      const adaptedFolderTree = adaptFolderTree(folderTreeData);
      setFolderTree(adaptedFolderTree);
      
      // Автоматически разворачиваем корневую папку "Данные по тарифам"
      const tariffDataFolder = folderTreeData.find(f => f.name === 'Данные по тарифам');
      if (tariffDataFolder) {
        console.log('Найдена папка "Данные по тарифам", разворачиваем её');
        setExpandedFolders(prev => ({
          ...prev,
          [tariffDataFolder.id]: true
        }));
      }
      
      // Разворачиваем группы с транспортными средствами для демонстрации
      const groupsWithVehicles = findGroupsWithVehicles(folderTreeData);
      if (groupsWithVehicles.length > 0) {
        console.log(`Найдено ${groupsWithVehicles.length} групп с транспортными средствами:`, 
          groupsWithVehicles.map(g => `${g.name} (${g.vehicles.length} ТС)`));
        
        const expandedFoldersUpdate = {};
        
        // Сначала добавляем группы с ТС
        groupsWithVehicles.forEach(group => {
          expandedFoldersUpdate[group.id] = true;
          console.log(`Разворачиваем группу "${group.name}" с ${group.vehicles.length} ТС`);
        });
        
        // Затем находим и разворачиваем родительские группы для этих групп
        const parentsToExpand = new Set();
        
        // Функция для рекурсивного поиска родительских групп
        const findAndAddParents = (folders, targetId) => {
          for (const folder of folders) {
            if (folder.id === targetId) {
              return true; // Нашли целевую папку
            }
            
            if (folder.children && folder.children.length > 0) {
              // Ищем среди детей
              const found = folder.children.some(child => {
                if (child.id === targetId) {
                  // Если нашли целевую папку среди детей, добавляем текущую папку как родителя
                  parentsToExpand.add(folder.id);
                  return true;
                }
                // Рекурсивно ищем в подпапках
                return findAndAddParents([child], targetId);
              });
              
              if (found) {
                // Если нашли в дереве, добавляем текущую папку как родителя
                parentsToExpand.add(folder.id);
                return true;
              }
            }
          }
          return false;
        };
        
        // Для каждой группы с ТС ищем и добавляем её родителей
        groupsWithVehicles.forEach(group => {
          findAndAddParents(folderTreeData, group.id);
        });
        
        // Добавляем все найденные родительские группы в список для разворачивания
        parentsToExpand.forEach(parentId => {
          expandedFoldersUpdate[parentId] = true;
          console.log(`Разворачиваем родительскую группу с ID ${parentId}`);
        });
        
        setExpandedFolders(prev => ({
          ...prev,
          ...expandedFoldersUpdate
        }));
        
        // showNotification('info', `Найдено ${groupsWithVehicles.length} групп с транспортными средствами`);
      } else {
        console.log('Не найдено групп с транспортными средствами');
      }
      
      // Попробуем синхронизировать группы, но не будем останавливать загрузку при ошибке
      try {
        await syncAllGroups();
      } catch (syncError) {
        console.warn('Не удалось синхронизировать группы:', syncError);
        showNotification('warning', 'Не удалось синхронизировать группы. Возможно, недостаточно прав.');
      }
      
      setLoading(false);
      showNotification('success', 'Данные успешно загружены');
    } catch (error) {
      console.error('Ошибка при инициализации данных:', error);
      setLoading(false);
      setError(error.message);
      showNotification('error', `Ошибка при загрузке данных: ${error.message}`);
    }
  };
  
  // Функция для поиска групп с транспортными средствами
  const findGroupsWithVehicles = (folders) => {
    let groupsWithVehicles = [];
    
    for (const folder of folders) {
      if (folder.type === 'group' && folder.vehicles && folder.vehicles.length > 0) {
        groupsWithVehicles.push(folder);
      }
      
      // Рекурсивно ищем в дочерних папках
      if (folder.children && folder.children.length > 0) {
        groupsWithVehicles = groupsWithVehicles.concat(findGroupsWithVehicles(folder.children));
      }
    }
    
    return groupsWithVehicles;
  };

  // Функция поиска всех папок типа "group" в дереве
  const findAllGroupFolders = useCallback((folders) => {
    let groupFolders = [];
    
    for (const folder of folders) {
      if (folder.type === 'group') {
        groupFolders.push(folder);
      }
      
      // Рекурсивно ищем группы в дочерних папках
      if (folder.children && folder.children.length > 0) {
        groupFolders = groupFolders.concat(findAllGroupFolders(folder.children));
      }
    }
    
    return groupFolders;
  }, []);

  // Функция для последовательной синхронизации групп
  const syncGroupsSequentially = useCallback(async (groups, index = 0) => {
    if (index >= groups.length) {
      console.log('Синхронизация всех групп завершена');
      return;
    }
    
    const group = groups[index];
    console.log(`Синхронизация группы ${index + 1}/${groups.length}: ${group.name}`);
    
    try {
      // Синхронизируем текущую группу
      await FolderService.syncFolderVehicles(group.id);
      
      // Задержка перед следующей синхронизацией
      setTimeout(() => {
        syncGroupsSequentially(groups, index + 1);
      }, 300);
    } catch (error) {
      console.error(`Ошибка при синхронизации группы ${group.name}:`, error);
      // Продолжаем с следующей группой
      setTimeout(() => {
        syncGroupsSequentially(groups, index + 1);
      }, 300);
    }
  }, []);

  // Функция для автоматической синхронизации всех групп
  const syncAllGroups = useCallback(async () => {
    // Находим все папки типа "group"
    const groupFolders = findAllGroupFolders(folderTree);
    
    if (groupFolders.length === 0) {
      console.log('Группы для синхронизации не найдены');
      return;
    }
    
    console.log(`Найдено ${groupFolders.length} групп для синхронизации`);
    
    // Последовательно синхронизируем все группы
    await syncGroupsSequentially(groupFolders);
    
    // Обновляем дерево папок после синхронизации
    const updatedFolderTree = await FolderService.getFolderTree();
    setFolderTree(updatedFolderTree);
  }, [folderTree, findAllGroupFolders, syncGroupsSequentially]);

  // Функция для отображения уведомлений
  const showNotification = (type, message) => {
    // Создаем элемент уведомления
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    // Устанавливаем иконку в зависимости от типа
    let icon = '';
    switch(type) {
      case 'success':
        icon = '<i class="fas fa-check-circle"></i>';
        break;
      case 'error':
        icon = '<i class="fas fa-exclamation-circle"></i>';
        break;
      case 'warning':
        icon = '<i class="fas fa-exclamation-triangle"></i>';
        break;
      case 'info':
      default:
        icon = '<i class="fas fa-info-circle"></i>';
        break;
    }
    
    // Добавляем содержимое
    notification.innerHTML = `
      <div class="notification-icon">${icon}</div>
      <div class="notification-message">${message}</div>
      <div class="notification-close"><i class="fas fa-times"></i></div>
    `;
    
    // Добавляем на страницу
    document.body.appendChild(notification);
    
    // Показываем с анимацией
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    // Закрытие по клику на крестик
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
      notification.classList.remove('show');
      setTimeout(() => {
        notification.remove();
      }, 300);
    });
    
    // Автоматическое закрытие через 5 секунд
    setTimeout(() => {
      if (document.body.contains(notification)) {
        notification.classList.remove('show');
        setTimeout(() => {
          if (document.body.contains(notification)) {
            notification.remove();
          }
        }, 300);
      }
    }, 5000);
  };

  // Функция скрытия глобального контекстного меню
  const hideGlobalContextMenu = () => {
    setShowGlobalContextMenu(false);
  };
  
  // Функция обработки действий глобального контекстного меню
  const handleGlobalContextMenuAction = async (action) => {
    hideGlobalContextMenu();
    
    switch(action) {
      case 'add-folder':
        setShowModal(true);
        break;
      case 'refresh':
        showNotification('info', 'Обновление списка...');
        await initData();
        showNotification('success', 'Список обновлен');
        break;
      case 'expand-all':
        expandAllFolders();
        break;
      case 'collapse-all':
        // Сбрасываем все развернутые папки
        setExpandedFolders({});
        showNotification('info', 'Все папки свернуты');
        break;
      case 'sync-all':
        showNotification('info', 'Синхронизация всех групп...');
        await syncAllGroups();
        break;
      default:
        break;
    }
  };

  // Обработчик для открытия контекстного меню
  const handleShowContextMenu = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Проверяем, является ли элемент транспортным средством или папкой
    const isVehicle = item.imei !== undefined;
    
    if (isVehicle) {
      // Используем специфические опции для ТС
      setSelectedVehicle(item);
      setSelectedFolder(null);
    } else {
      // Используем специфические опции для папок
      setSelectedFolder(item);
      setSelectedVehicle(null);
    }
    
    // Скрываем глобальное контекстное меню, если оно было открыто
    setShowGlobalContextMenu(false);
    
    // Вычисляем позицию меню с учетом размеров экрана
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Предполагаемые размеры меню
    const menuWidth = 280; // Увеличиваем размер для более подробного контекстного меню
    const menuHeight = 350; // Увеличиваем высоту меню
    
    // Получаем положение курсора с учетом скролла страницы
    let left = e.pageX;
    let top = e.pageY;
    
    // Проверяем, не выйдет ли меню за правую и нижнюю границы экрана
    if (left + menuWidth > viewportWidth) {
      left = left - menuWidth;
      if (left < 0) left = 10; // Минимальное расстояние от левого края
    }
    
    if (top + menuHeight > viewportHeight) {
      top = top - menuHeight;
      if (top < 0) top = 10; // Минимальное расстояние от верхнего края
    }
    
    // Позиционируем контекстное меню
    setContextMenuPosition({
      top: `${top}px`,
      left: `${left}px`,
    });
    
    // Устанавливаем таймаут, чтобы избежать конфликта с событиями клика
    setTimeout(() => {
      setShowContextMenu(true);
    }, 10);
    
    // Предотвращаем всплытие события
    document.addEventListener('click', hideContextMenu, { once: true });
    document.addEventListener('contextmenu', hideContextMenu, { once: true });
    document.addEventListener('scroll', hideContextMenu, { once: true });
  };

  // Скрыть контекстное меню
  const hideContextMenu = () => {
    setShowContextMenu(false);
  };

  // Обработчик действий контекстного меню
  const handleContextMenuAction = async (action) => {
    // Скрываем меню
    hideContextMenu();
    
    // Действия для транспорта
    if (selectedVehicle) {
      switch(action) {
        case 'view':
          showNotification('info', `Просмотр данных ТС: ${selectedVehicle.name}`);
          if (onVehicleSelect) {
            onVehicleSelect(selectedVehicle);
          }
          break;
        case 'edit':
          showNotification('info', `Редактирование ТС: ${selectedVehicle.name}`);
          // Здесь будет реализация редактирования ТС
          break;
        case 'addToGroup':
          showNotification('info', `Выбор группы для добавления ТС: ${selectedVehicle.name}`);
          // Здесь будет реализация добавления ТС в группу
          break;
        case 'delete':
          await removeVehicleFromFolder(selectedVehicle, selectedFolder.id);
          break;
        default:
          break;
      }
    }
    // Действия для папок
    else if (selectedFolder) {
      switch(action) {
        case 'add-tariff':
          addTariffToFolder(selectedFolder);
          break;
        case 'add-group': {
          if (selectedFolder.type === 'tariff') {
            addGroupToTariff(selectedFolder);
          } else if (selectedFolder.type === 'group') {
            addSubGroup(selectedFolder);
          }
          break;
        }
        case 'add-subgroup':
          addSubGroup(selectedFolder);
          break;
        case 'rename':
          await renameFolder(selectedFolder);
          break;
        case 'delete':
          await deleteFolder(selectedFolder);
          break;
        case 'sync-vehicles': {
          if (selectedFolder.type === 'group') {
            await syncVehiclesWithGroup(selectedFolder.id);
          } else if (selectedFolder.type === 'tariff') {
            showNotification('info', `Синхронизация всех групп в тарифе: ${selectedFolder.name}`);
            const groupFolders = findAllGroupFolders([selectedFolder]);
            if (groupFolders.length > 0) {
              await syncGroupsSequentially(groupFolders);
            } else {
              showNotification('warning', 'В данном тарифе нет групп для синхронизации');
            }
          } else if (selectedFolder.name === 'Данные по тарифам') {
            showNotification('info', 'Синхронизация всех групп...');
            await syncAllGroups();
          }
          break;
        }
        case 'refresh': {
          showNotification('info', 'Обновление списка...');
          const updatedFolderTree = await FolderService.getFolderTree();
          setFolderTree(updatedFolderTree);
          showNotification('success', 'Список обновлен');
          break;
        }
        case 'expand-all':
          expandAllFolders();
          break;
        case 'expand-tariff':
          expandTariffFolder(selectedFolder);
          break;
        case 'syncGroup':
          await syncVehiclesWithGroup(selectedFolder.id);
          break;
        case 'deleteGroup':
          await deleteFolder(selectedFolder);
          break;
        case 'createGroupsFromUserGroups':
          await createGroupsFromUserGroups(selectedFolder);
          break;
        default:
          break;
      }
    }
  };

  // Функция для переименования папки
  const renameFolder = async (folder) => {
    // Формируем заголовок диалога в зависимости от типа папки
    let promptTitle = `Введите новое имя для "${folder.name}":`;
    if (folder.type === 'tariff') {
      promptTitle = `Введите новое имя для тарифа "${folder.name}":`;
    } else if (folder.type === 'group') {
      promptTitle = `Введите новое имя для группы "${folder.name}":`;
    }
    
    const newName = prompt(promptTitle, folder.name);
    if (newName && newName !== folder.name) {
      try {
        showNotification('info', `Переименование "${folder.name}" в "${newName}"...`);
        setLoading(true);
        
        const result = await FolderService.renameFolder(folder.id, newName);
        
        if (result && result.success) {
          showNotification('success', `Успешно переименовано в "${newName}"`);
          // Обновляем дерево папок с транспортными средствами
          const updatedFolderTree = await FolderService.getFolderTreeWithVehiclesByUserGroup();
          const adaptedFolderTree = adaptFolderTree(updatedFolderTree);
          setFolderTree(adaptedFolderTree);
        } else {
          showNotification('error', result.error || 'Ошибка при переименовании');
        }
      } catch (error) {
        console.error('Ошибка:', error);
        showNotification('error', `Ошибка при переименовании: ${error.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  // Функция удаления папки
  const deleteFolder = async (folder) => {
    // Различные сообщения для разных типов папок
    let confirmMessage = `Вы действительно хотите удалить "${folder.name}"?`;
    
    // Специальное предупреждение для тарифов
    if (folder.type === 'tariff') {
      confirmMessage = `Вы действительно хотите удалить тариф "${folder.name}" и все группы и транспорт в нём?`;
    } else if (folder.type === 'group') {
      confirmMessage = `Вы действительно хотите удалить группу "${folder.name}" и всё её содержимое?`;
    }
    
    if (window.confirm(confirmMessage)) {
      try {
        setLoading(true);
        
        // Параметр для рекурсивного удаления (все содержимое)
        const recursive = folder.type === 'tariff' || folder.type === 'group';
        
        const result = await FolderService.deleteFolder(folder.id, recursive);
        
        if (result && result.success) {
          if (folder.type === 'tariff') {
            showNotification('success', result.message || `Тариф "${folder.name}" и все его содержимое успешно удалены`);
          } else if (folder.type === 'group') {
            showNotification('success', result.message || `Группа "${folder.name}" и все её содержимое успешно удалены`);
          } else {
            showNotification('success', result.message || `Папка "${folder.name}" успешно удалена`);
          }
          
          // Сохраняем текущее состояние развернутых папок, удаляя ту, что удалили
          const currentExpandedState = {...expandedFolders};
          delete currentExpandedState[folder.id];
          
          // Обновляем дерево папок с транспортными средствами
          const updatedFolderTree = await FolderService.getFolderTreeWithVehiclesByUserGroup();
          const adaptedFolderTree = adaptFolderTree(updatedFolderTree);
          setFolderTree(adaptedFolderTree);
          
          // Восстанавливаем состояние развернутых папок
          setExpandedFolders(currentExpandedState);
        } else {
          showNotification('error', result.error || 'Ошибка при удалении папки');
        }
      } catch (error) {
        console.error('Ошибка:', error);
        showNotification('error', `Ошибка при удалении: ${error.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  // Функция для удаления транспорта из папки
  const removeVehicleFromFolder = async (vehicle, folderId) => {
    if (window.confirm(`Вы действительно хотите удалить транспорт "${vehicle.name}" из группы?`)) {
      try {
        setLoading(true);
        
        const result = await FolderService.removeVehicleFromFolder(folderId, vehicle.id);
        
        if (result && result.success) {
          showNotification('success', result.message || `Транспорт "${vehicle.name}" успешно удален из группы`);
          
          // Обновляем дерево папок с транспортными средствами
          const updatedFolderTree = await FolderService.getFolderTreeWithVehiclesByUserGroup();
          const adaptedFolderTree = adaptFolderTree(updatedFolderTree);
          setFolderTree(adaptedFolderTree);
        } else {
          showNotification('error', result.error || 'Ошибка при удалении транспорта');
        }
      } catch (error) {
        console.error('Ошибка:', error);
        showNotification('error', `Ошибка при удалении транспорта: ${error.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  // Функция для синхронизации ТС в группе
  const syncVehiclesWithGroup = async (folderId, showNotifications = true) => {
    try {
      if (showNotifications) {
        showNotification('info', 'Синхронизация транспортных средств...');
      }
      
      const result = await FolderService.syncFolderVehicles(folderId);
      
      if (result.success) {
        if (showNotifications) {
          showNotification('success', result.message || 'Синхронизация выполнена успешно');
        }
        
        // Обновляем дерево папок
        await initData();
      } else {
        if (showNotifications) {
          showNotification('error', result.error || 'Ошибка при синхронизации');
        }
      }
    } catch (error) {
      console.error('Ошибка при синхронизации:', error);
      if (showNotifications) {
        showNotification('error', `Ошибка при синхронизации: ${error.message}`);
      }
    }
  };

  // Функция для создания групп на основе user_group
  const createGroupsFromUserGroups = async (folder) => {
    try {
      setLoading(true);
      
      // Определяем, в какой родительской папке создавать группы
      let parentId = null;
      if (folder && (folder.type === 'tariff' || folder.type === 'group')) {
        parentId = folder.id;
      }
      
      showNotification('info', 'Создание групп на основе user_group...');
      
      const result = await FolderService.createGroupsFromUserGroups(parentId);
      
      if (result.success) {
        showNotification('success', result.message);
        
        // Обновляем дерево папок
        await initData();
        
        // Разворачиваем родительскую папку, если она была выбрана
        if (parentId) {
          setExpandedFolders(prev => ({
            ...prev,
            [parentId]: true
          }));
        }
      } else {
        showNotification('error', result.error || 'Не удалось создать группы');
      }
    } catch (error) {
      console.error('Ошибка при создании групп:', error);
      showNotification('error', `Ошибка при создании групп: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Функция разворачивания всех папок
  const expandAllFolders = () => {
    const allFolders = {};
    
    // Рекурсивно находим все папки
    const findAllFolderIds = (folders) => {
      folders.forEach(folder => {
        allFolders[folder.id] = true;
        if (folder.children && folder.children.length > 0) {
          findAllFolderIds(folder.children);
        }
      });
    };
    
    findAllFolderIds(folderTree);
    setExpandedFolders(allFolders);
    showNotification('info', 'Все папки развернуты');
  };

  // Функция разворачивания тарифа
  const expandTariffFolder = (folder) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folder.id]: true
    }));
    showNotification('info', `Тариф "${folder.name}" развернут`);
  };

  // Функция для переключения видимости папки
  const toggleFolder = (folderId) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };

  // Функция добавления тарифа в папку "Данные по тарифам"
  const addTariffToFolder = (folder) => {
    // Открываем модальное окно создания нового тарифа
    setNewFolder({
      name: 'Новый тариф',
      type: 'tariff',
      parent_id: folder.id
    });
    
    setShowModal(true);
  };

  // Функция добавления группы в тариф
  const addGroupToTariff = (folder) => {
    // Открываем модальное окно создания новой группы
    setNewFolder({
      name: `Группа в тарифе ${folder.name}`,
      type: 'group',
      parent_id: folder.id
    });
    
    setShowModal(true);
  };

  // Функция добавления подгруппы в группу
  const addSubGroup = (folder) => {
    // Открываем модальное окно создания новой подгруппы
    setNewFolder({
      name: `Подгруппа в ${folder.name}`,
      type: 'group',
      parent_id: folder.id
    });
    
    setShowModal(true);
  };

  // Обработка закрытия модального окна
  const handleCloseModal = () => {
    setShowModal(false);
  };

  // Обработка изменения формы новой папки
  const handleNewFolderChange = (e) => {
    const { name, value } = e.target;
    
    // Обновляем значение в форме
    setNewFolder(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Если изменился тип папки, сбрасываем родительскую папку на корневую
    if (name === 'type') {
      setNewFolder(prev => ({
        ...prev,
        parent_id: '0'
      }));
    }
  };

  // Обновленная функция создания папки
  const handleCreateFolder = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      // Создаем данные для отправки
      const folderData = {
        name: newFolder.name,
        type: newFolder.type,
        parent_id: newFolder.parent_id === '0' ? null : newFolder.parent_id
      };
      
      // Отправляем запрос на создание папки
      const result = await FolderService.createFolder(folderData);
      
      if (result && result.id) { // Проверяем наличие id в результате
        // Показываем уведомление об успехе
        showNotification('success', `${folderTypeToText(newFolder.type)} "${newFolder.name}" успешно создан(а)`);
        
        // Сохраняем текущее состояние развернутых папок
        const currentExpandedState = {...expandedFolders};
        
        // Добавляем созданную папку в список развернутых
        currentExpandedState[result.id] = true;
        
        // Если у новой папки есть родитель, разворачиваем и его
        if (folderData.parent_id) {
          currentExpandedState[folderData.parent_id] = true;
        }
        
        // Обновляем дерево папок используя метод, который возвращает и транспортные средства
        const updatedFolderTree = await FolderService.getFolderTreeWithVehiclesByUserGroup();
        const adaptedFolderTree = adaptFolderTree(updatedFolderTree);
        
        // Обновляем дерево папок
        setFolderTree(adaptedFolderTree);
        
        // Восстанавливаем состояние развернутых папок и добавляем новую
        setExpandedFolders(currentExpandedState);
        
        // Закрываем модальное окно
        setShowModal(false);
      } else {
        showNotification('error', 'Ошибка при создании элемента: неверный ответ от сервера');
      }
    } catch (error) {
      console.error('Ошибка:', error);
      showNotification('error', `Произошла ошибка при отправке запроса: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Функция для преобразования типа папки в читаемый текст
  const folderTypeToText = (type) => {
    switch(type) {
      case 'tariff':
        return 'Тариф';
      case 'group':
        return 'Группа';
      case 'transport':
        return 'Транспорт';
      default:
        return 'Папка';
    }
  };

  // Функция для получения иконки папки в зависимости от типа
  const getFolderIcon = (type, isOpen = false) => {
    if (isOpen && type === 'folder') {
      return faFolderOpen;
    }
    
    switch(type) {
      case 'tariff':
      case 'tariff-root':
        return faTags;
      case 'group':
        return faUsers;
      case 'transport':
        return faCar;
      default:
        return faFolder;
    }
  };

  // Адаптер для обработки данных из API
  const adaptFolderData = (folder) => {
    // Преобразуем camelCase в snake_case для обратной совместимости
    return {
      ...folder,
      parent_id: folder.parentId,
      // Другие необходимые преобразования
      vehicles: folder.vehicles || []
    };
  };

  // Функция для рекурсивного применения адаптера к дереву папок
  const adaptFolderTree = (folders) => {
    if (!folders || !Array.isArray(folders)) return [];
    return folders.map(folder => {
      const adaptedFolder = adaptFolderData(folder);
      if (folder.children && Array.isArray(folder.children)) {
        adaptedFolder.children = adaptFolderTree(folder.children);
      }
      return adaptedFolder;
    });
  };

  // Обработка выбора папки (чекбокс)
  const handleFolderSelect = (folderId) => {
    // Функция оставлена для будущего использования
    console.log("Выбрана папка с ID:", folderId);
  };

  // Обработка выбора транспортного средства
  const handleVehicleSelect = (vehicle) => {
    if (selectedVehicle && selectedVehicle.id === vehicle.id) {
      // Если кликнули на уже выбранное ТС, оставляем выбор
      return;
    }
    
    setSelectedVehicle(vehicle);
    
    // Удаляем старые выделения из всех ТС
    const allVehicles = document.querySelectorAll('.vehicle-item');
    allVehicles.forEach(el => el.classList.remove('selected'));
    
    // Выделяем выбранное ТС
    const selectedElement = document.querySelector(`.vehicle-item[data-id="${vehicle.id}"]`);
    if (selectedElement) {
      selectedElement.classList.add('selected');
    }
    
    // Вызываем callback, если он предоставлен
    if (onVehicleSelect) {
      onVehicleSelect(vehicle);
    }
    
    // Сохраняем в localStorage для последующего использования
    try {
      localStorage.setItem('lastSelectedVehicle', JSON.stringify({
        id: vehicle.id,
        name: vehicle.name,
        imei: vehicle.imei || '',
        user_group: vehicle.user_group || (vehicle.metadata && vehicle.metadata.user_group) || '',
        timestamp: new Date().getTime()
      }));
    } catch (e) {
      console.warn('Не удалось сохранить данные в localStorage:', e);
    }
  };

  // Функция для рендеринга транспортного средства
  const renderVehicle = (vehicle) => {
    // Проверяем наличие поля metadata.user_group
    const hasUserGroup = vehicle.metadata && vehicle.metadata.user_group;
    
    // Проверяем, является ли ТС выбранным
    const isSelected = selectedVehicle && selectedVehicle.id === vehicle.id;
    
    const vehicleClasses = classNames({
      'vehicle-item': true,
      'has-user-group': hasUserGroup || vehicle.user_group,
      'selected': isSelected
    });
    
    return (
      <div 
        className={vehicleClasses} 
        key={vehicle.id}
        data-id={vehicle.id}
        onClick={() => handleVehicleSelect(vehicle)} 
        onContextMenu={(e) => handleShowContextMenu(e, vehicle)}
      >
        <div className="vehicle-icon">
          <FontAwesomeIcon icon={faCar} />
        </div>
        <div className="vehicle-name">
          {vehicle.name}
        </div>
      </div>
    );
  };

 

  // Функция для рендеринга отдельной папки
  const renderFolder = (folder) => {
    const isExpanded = expandedFolders[folder.id];
    const isSelected = selectedFolder && selectedFolder.id === folder.id;
    const hasChildren = folder.children && folder.children.length > 0;
    const hasVehicles = folder.vehicles && folder.vehicles.length > 0;
    
    // Определяем класс для типа папки
    const folderTypeClass = `folder-type-${folder.type}`;
    
    // Проверяем, есть ли у папки транспортные средства с user_group
    const hasMatchedVehicles = folder.vehicles && folder.vehicles.some(vehicle => vehicle.metadata && vehicle.metadata.user_group);
    
    const folderClasses = classNames({
      'folder-item': true,
      'folder-expanded': isExpanded,
      'has-matched-vehicles': hasMatchedVehicles && folder.type === 'group',
      [folderTypeClass]: true
    });
    
    return (
      <div className={folderClasses} key={folder.id}>
        <div 
          className={`folder-header ${isSelected ? 'active' : ''}`}
          onClick={() => toggleFolder(folder.id)}
          onContextMenu={(e) => handleShowContextMenu(e, folder)}
        >
          <div className="folder-toggle">
            {(hasChildren || hasVehicles) ? (
              <FontAwesomeIcon
                icon={isExpanded ? faChevronDown : faChevronRight}
                className="folder-toggle-icon"
              />
            ) : (
              <span className="folder-toggle-placeholder"></span>
            )}
          </div>
          <div className="folder-icon">
            <FontAwesomeIcon icon={getFolderIcon(folder.type, isExpanded)} />
          </div>
          <div 
            className={`folder-name ${folder.type === 'group' ? 'folder-group-title' : ''} ${hasMatchedVehicles ? 'with-vehicles' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              handleFolderSelect(folder.id);
            }}
          >
            {folder.name}
            
          </div>
          {(hasChildren || hasVehicles) && (
            <div className="folder-count" title={`${hasVehicles ? folder.vehicles.length : 0} транспортных средств`}>
              {hasChildren ? parseInt(folder.children.length) : 0}
              {hasChildren && hasVehicles ? '+' : ''}
              {hasVehicles ? parseInt(folder.vehicles.length) : ''}
            </div>
          )}
        </div>
        
        {isExpanded && (
          <div className="folder-contents">
            {hasChildren && folder.children.map(childFolder => renderFolder(childFolder))}
            {hasVehicles && (
              <div className="vehicle-compact-group">
                {folder.vehicles.map(vehicle => (
                  <React.Fragment key={vehicle.id}>
                    {renderVehicle(vehicle)}
                    {folder.type === 'group'}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Функция для получения доступных родительских папок в зависимости от типа создаваемой папки
  const getAvailableParentFolders = () => {
    // Если создаем тариф, то показываем только корневую и папки с типом tariff-root
    if (newFolder.type === 'tariff') {
      return folderTree.filter(folder => folder.type === 'tariff-root');
    } 
    // Если создаем группу, то показываем тарифы и группы
    else if (newFolder.type === 'group') {
      // Рекурсивная функция для поиска всех тарифов и групп
      const findTariffsAndGroups = (folders) => {
        let result = [];
        
        for (const folder of folders) {
          if (folder.type === 'tariff' || folder.type === 'group') {
            result.push(folder);
          }
          
          if (folder.children && folder.children.length > 0) {
            result = result.concat(findTariffsAndGroups(folder.children));
          }
        }
        
        return result;
      };
      
      return findTariffsAndGroups(folderTree);
    }
    
    // Для всех остальных случаев возвращаем все папки
    return folderTree;
  };

  // Функция для рендеринга контекстного меню
  const renderContextMenu = () => {
    if (!showContextMenu) return null;
    
    const isVehicle = selectedVehicle !== null;
    const isFolder = selectedFolder !== null;
    const folderType = isFolder ? selectedFolder.type : null;
    
    // Получаем иконку и имя выбранного элемента
    let icon = isVehicle ? faCar : (isFolder ? getFolderIcon(folderType) : faFolder);
    let name = isVehicle ? selectedVehicle.name : (isFolder ? selectedFolder.name : '');
    
    // Определяем цвет иконки в зависимости от типа элемента
    let iconColorClass = 'text-primary';
    if (isVehicle) {
      iconColorClass = 'text-info';
    } else if (isFolder) {
      if (folderType === 'tariff' || folderType === 'tariff-root') {
        iconColorClass = 'text-primary';
      } else if (folderType === 'group') {
        iconColorClass = 'text-success';
      }
    }
    
    return (
      <div 
        className="context-menu" 
        style={contextMenuPosition} 
        ref={contextMenuRef}
        onContextMenu={(e) => {
          e.preventDefault(); // Предотвращаем стандартное контекстное меню
        }}
      >
        <div className="context-menu-header">
          <div className="context-menu-title">
            <FontAwesomeIcon icon={icon} className={iconColorClass} />
            <span>{name}</span>
          </div>
          <button className="close-context-menu" onClick={() => setShowContextMenu(false)}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        
        <div className="context-menu-content">
          {isVehicle && (
            <>
              <div className="context-menu-group">
                <div className="context-menu-item" onClick={() => handleContextMenuAction('view')}>
                  <FontAwesomeIcon icon={faEye} className="text-info" />
                  <span>Просмотр данных ТС</span>
                </div>
                
                <div className="context-menu-item" onClick={() => handleContextMenuAction('edit')}>
                  <FontAwesomeIcon icon={faEdit} className="text-warning" />
                  <span>Редактировать ТС</span>
                </div>
                
                <div className="context-menu-item" onClick={() => handleContextMenuAction('addToGroup')}>
                  <FontAwesomeIcon icon={faPlus} className="text-success" />
                  <span>Добавить в другую группу</span>
                </div>
              </div>
              
              <div className="context-menu-separator"></div>
              
              <div className="context-menu-group">
                <div className="context-menu-item context-menu-item-danger" onClick={() => handleContextMenuAction('delete')}>
                  <FontAwesomeIcon icon={faTrashAlt} />
                  <span>Удалить из группы</span>
                </div>
              </div>
            </>
          )}
          
          {isFolder && folderType === 'group' && (
            <>
              <div className="context-menu-group">
                <div className="context-menu-item" onClick={() => handleContextMenuAction('rename')}>
                  <FontAwesomeIcon icon={faEdit} className="text-warning" />
                  <span>Переименовать</span>
                </div>
                
                <div className="context-menu-item" onClick={() => handleContextMenuAction('add-subgroup')}>
                  <FontAwesomeIcon icon={faPlus} className="text-success" />
                  <span>Создать подгруппу</span>
                </div>
              </div>
              
              <div className="context-menu-separator"></div>
              
              <div className="context-menu-group">
                <div className="context-menu-item" onClick={() => handleContextMenuAction('syncGroup')}>
                  <FontAwesomeIcon icon={faSyncAlt} className="text-primary" />
                  <span>Синхронизировать транспорт</span>
                </div>
                <div className="context-menu-item" onClick={() => handleContextMenuAction('expand-all')}>
                  <FontAwesomeIcon icon={faChevronDown} className="text-info" />
                  <span>Развернуть все</span>
                </div>
              </div>
              
              <div className="context-menu-separator"></div>
              
              <div className="context-menu-group">
                <div className="context-menu-item context-menu-item-danger" onClick={() => handleContextMenuAction('deleteGroup')}>
                  <FontAwesomeIcon icon={faTrashAlt} />
                  <span>Удалить группу</span>
                </div>
              </div>
            </>
          )}
          
          {isFolder && folderType === 'tariff' && (
            <>
              <div className="context-menu-group">
                <div className="context-menu-item" onClick={() => handleContextMenuAction('rename')}>
                  <FontAwesomeIcon icon={faEdit} className="text-warning" />
                  <span>Переименовать</span>
                </div>
                
                <div className="context-menu-item" onClick={() => handleContextMenuAction('addGroup')}>
                  <FontAwesomeIcon icon={faPlus} className="text-success" />
                  <span>Создать группу</span>
                </div>
                
                <div className="context-menu-item" onClick={() => handleContextMenuAction('createGroupsFromUserGroups')}>
                  <FontAwesomeIcon icon={faUsers} className="text-success" />
                  <span>Создать группы по user_group</span>
                </div>
              </div>
              
              <div className="context-menu-separator"></div>
              
              <div className="context-menu-group">
                <div className="context-menu-item" onClick={() => handleContextMenuAction('expand-all')}>
                  <FontAwesomeIcon icon={faChevronDown} className="text-info" />
                  <span>Развернуть все</span>
                </div>
                <div className="context-menu-item" onClick={() => handleContextMenuAction('sync-vehicles')}>
                  <FontAwesomeIcon icon={faSyncAlt} className="text-primary" />
                  <span>Синхронизировать группы</span>
                </div>
                <div className="context-menu-item" onClick={() => handleContextMenuAction('refresh')}>
                  <FontAwesomeIcon icon={faSyncAlt} className="text-info" />
                  <span>Обновить список</span>
                </div>
              </div>
              
              <div className="context-menu-separator"></div>
              
              <div className="context-menu-group">
                <div className="context-menu-item context-menu-item-danger" onClick={() => handleContextMenuAction('delete')}>
                  <FontAwesomeIcon icon={faTrashAlt} />
                  <span>Удалить</span>
                </div>
              </div>
            </>
          )}
          
          {isFolder && folderType === 'tariff-root' && (
            <>
              <div className="context-menu-group">
                <div className="context-menu-item" onClick={() => handleContextMenuAction('add-tariff')}>
                  <FontAwesomeIcon icon={faTags} className="text-primary" />
                  <span>Создать тариф</span>
                </div>
              </div>
              
              <div className="context-menu-separator"></div>
              
              <div className="context-menu-group">
                <div className="context-menu-item" onClick={() => handleContextMenuAction('expand-all')}>
                  <FontAwesomeIcon icon={faChevronDown} className="text-info" />
                  <span>Развернуть все</span>
                </div>
                <div className="context-menu-item" onClick={() => handleContextMenuAction('sync-vehicles')}>
                  <FontAwesomeIcon icon={faSyncAlt} className="text-primary" />
                  <span>Синхронизировать все группы</span>
                </div>
                <div className="context-menu-item" onClick={() => handleContextMenuAction('refresh')}>
                  <FontAwesomeIcon icon={faSyncAlt} className="text-info" />
                  <span>Обновить список</span>
                </div>
              </div>
              
              <div className="context-menu-separator"></div>
              
              <div className="context-menu-group">
                <div className="context-menu-item" onClick={() => handleContextMenuAction('createGroupsFromUserGroups')}>
                  <FontAwesomeIcon icon={faUsers} className="text-success" />
                  <span>Создать группы по user_group</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // Функция для рендеринга глобального контекстного меню
  const renderGlobalContextMenu = () => {
    if (!showGlobalContextMenu) return null;
    
    return (
      <div 
        className="context-menu" 
        style={globalContextMenuPosition} 
        onContextMenu={(e) => {
          e.preventDefault();
        }}
      >
        <div className="context-menu-header">
          <div className="context-menu-title">
            <FontAwesomeIcon icon={faFolder} className="text-primary" />
            <span>Действия со списком</span>
          </div>
          <button className="close-context-menu" onClick={hideGlobalContextMenu}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        
        <div className="context-menu-content">
          <div className="context-menu-group">
            <div className="context-menu-item" onClick={() => handleGlobalContextMenuAction('add-folder')}>
              <FontAwesomeIcon icon={faPlus} className="text-success" />
              <span>Добавить новую папку</span>
            </div>
            
            <div className="context-menu-item" onClick={() => handleGlobalContextMenuAction('refresh')}>
              <FontAwesomeIcon icon={faSyncAlt} className="text-info" />
              <span>Обновить список</span>
            </div>
          </div>
          
          <div className="context-menu-separator"></div>
          
          <div className="context-menu-group">
            <div className="context-menu-item" onClick={() => handleGlobalContextMenuAction('expand-all')}>
              <FontAwesomeIcon icon={faChevronDown} className="text-primary" />
              <span>Развернуть все папки</span>
            </div>
            
            <div className="context-menu-item" onClick={() => handleGlobalContextMenuAction('collapse-all')}>
              <FontAwesomeIcon icon={faChevronRight} className="text-primary" />
              <span>Свернуть все папки</span>
            </div>
          </div>
          
          <div className="context-menu-separator"></div>
          
          <div className="context-menu-group">
            <div className="context-menu-item" onClick={() => handleGlobalContextMenuAction('sync-all')}>
              <FontAwesomeIcon icon={faSyncAlt} className="text-warning" />
              <span>Синхронизировать все группы</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="folder-list-container" ref={folderListRef}>
      <div className="folder-list">
        <div className="folders-wrapper">
          {loading ? (
            <div className="folder-loading">
              <FontAwesomeIcon icon={faSpinner} spin />
              <span>Загрузка папок...</span>
            </div>
          ) : error ? (
            <div className="folder-error">
              <FontAwesomeIcon icon={faExclamationTriangle} />
              <span>{error}</span>
            </div>
          ) : (
            <div className="folders-container">
              {folderTree.map(folder => renderFolder(folder))}
            </div>
          )}
          
          {/* Кнопка добавления новой папки */}
          <div className="add-folder-button" onClick={() => setShowModal(true)}>
            <FontAwesomeIcon icon={faPlus} />
            <span>Добавить папку</span>
          </div>
        </div>
        
        {/* Модальное окно создания папки */}
        {showModal && (
          <div className="create-folder-modal" onClick={(e) => {
            // Закрываем модальное окно при клике на затемнение
            if (e.target.className === 'create-folder-modal') {
              handleCloseModal();
            }
          }}>
            <div className="create-folder-content">
              <div className="create-folder-title">Создать новую папку</div>
              <form onSubmit={handleCreateFolder}>
                <div className="folder-form-group">
                  <label htmlFor="folderName">Название папки</label>
                  <input 
                    type="text" 
                    id="folderName" 
                    name="name"
                    value={newFolder.name}
                    onChange={handleNewFolderChange}
                    required 
                  />
                </div>
                <div className="folder-form-group">
                  <label htmlFor="folderType">Тип папки</label>
                  <select 
                    id="folderType"
                    name="type"
                    value={newFolder.type}
                    onChange={handleNewFolderChange}
                  >
                    <option value="tariff">Тариф</option>
                    <option value="group">Группа ТС</option>
                  </select>
                </div>
                <div className="folder-form-group">
                  <label htmlFor="parentFolder">Родительская папка</label>
                  <select 
                    id="parentFolder"
                    name="parent_id"
                    value={newFolder.parent_id}
                    onChange={handleNewFolderChange}
                  >
                    <option value="0">Корневая директория</option>
                    {getAvailableParentFolders().map(folder => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name} {folder.type === 'tariff' ? '(Тариф)' : folder.type === 'group' ? '(Группа)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="folder-form-actions">
                  <button 
                    type="button" 
                    className="folder-cancel-btn" 
                    onClick={handleCloseModal}
                  >
                    Отмена
                  </button>
                  <button type="submit" className="folder-create-btn">
                    Создать
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        
        {/* Контейнер меню */}
        <div className="menu-container">
          {/* Рендер контекстного меню */}
          {renderContextMenu()}
          
          {/* Рендер глобального контекстного меню */}
          {renderGlobalContextMenu()}
        </div>
      </div>
    </div>
  );
};

export default FolderList; 