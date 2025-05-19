import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Modal, Spin, Alert, notification } from 'antd';
import { LoadingOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

// Кастомные хуки
import { useLocalStorageSync } from '../hooks/useLocalStorageSync';
import { useLeafletMap } from '../hooks/useLeafletMap';
import { useSplitScreen } from '../contexts/SplitScreenContext';

// API и утилиты
import { fetchTrackData, getTrackStatistics } from '../api/trackService';
import exportTrack from '../utils/exportTrackData';

// Компоненты 
import MapControls from './controls/MapControls';
import TrackStatistics from './statistics/TrackStatistics';

// Стили
import './TrackMap.css';

/**
 * Компонент для отображения карты с треком транспортного средства
 * @returns {JSX.Element} Компонент карты с треком
 */
const TrackMap = ({ containerId = 'mapContainer' }) => {
  // Локальное состояние
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [trackData, setTrackData] = useState([]);
  const [statisticsVisible, setStatisticsVisible] = useState(false);
  const [statistics, setStatistics] = useState(null);

  // Получаем данные из localStorage через кастомный хук
  const { 
    currentVehicle, 
    currentDateRange, 
    splitMode,
    updateVehicle,
    updateDateRange,
    updateSplitMode
  } = useLocalStorageSync();

  // Контекст разделенного экрана
  const { changeSplitMode, splitContainer } = useSplitScreen();

  // Инициализируем карту через кастомный хук
  const { 
    mapRef, 
    isMapInitialized,
    isPlaying,
    initializeMap,
    renderTrack,
    clearMap,
    startPlayback,
    stopPlayback,
    togglePlayback,
    setPlaybackSpeed,
    updateMapSize
  } = useLeafletMap(containerId);

  /**
   * Загрузка списка транспортных средств
   */
  const loadVehicles = useCallback(async () => {
    try {
      // В реальном приложении здесь будет запрос к API для получения списка ТС
      // Для примера используем тестовые данные
      const mockVehicles = [
        { imei: '123456789012345', name: 'Грузовик №1', model: 'MAN TGX', regNumber: 'А123БВ45' },
        { imei: '987654321098765', name: 'Легковой автомобиль', model: 'Toyota Camry', regNumber: 'В789ГД67' },
        { imei: '555666777888999', name: 'Автобус', model: 'Mercedes Sprinter', regNumber: 'Е234ЖЗ89' }
      ];
      
      setVehicles(mockVehicles);
      
      // Если у нас нет текущего ТС, выбираем первое из списка
      if (!currentVehicle && mockVehicles.length > 0) {
        updateVehicle(mockVehicles[0]);
      }
    } catch (error) {
      console.error('Ошибка при загрузке списка транспортных средств:', error);
      notification.error({
        message: 'Ошибка загрузки данных',
        description: 'Не удалось загрузить список транспортных средств'
      });
    }
  }, [currentVehicle, updateVehicle]);

  /**
   * Инициализация компонента
   */
  useEffect(() => {
    // Инициализируем карту
    initializeMap();
    
    // Загружаем список транспортных средств
    loadVehicles();
    
    // Настраиваем обработчик изменения размера окна
    const handleResize = () => {
      updateMapSize();
    };
    
    window.addEventListener('resize', handleResize);
    
    // Очистка при размонтировании
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [initializeMap, loadVehicles, updateMapSize]);

  /**
   * Загрузка данных трека при изменении ТС или периода
   */
  useEffect(() => {
    const loadTrackData = async () => {
      if (!currentVehicle || !currentDateRange || !currentDateRange[0] || !currentDateRange[1]) {
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        // Очищаем карту перед загрузкой новых данных
        clearMap();
        
        // Получаем данные трека через API
        const data = await fetchTrackData(
          currentVehicle.imei,
          currentDateRange[0],
          currentDateRange[1],
          (progress) => {
            // Обработка прогресса загрузки
            console.log(`Загрузка данных: ${progress}%`);
          }
        );
        
        setTrackData(data);
        
        // Рассчитываем статистику
        const trackStats = getTrackStatistics(data);
        setStatistics(trackStats);
        
        // Отображаем трек на карте
        renderTrack(data);
        
        setLoading(false);
      } catch (error) {
        console.error('Ошибка при загрузке данных трека:', error);
        setLoading(false);
        setError(error.message || 'Не удалось загрузить данные трека');
        notification.error({
          message: 'Ошибка загрузки данных',
          description: error.message || 'Не удалось загрузить данные трека'
        });
      }
    };
    
    loadTrackData();
  }, [currentVehicle, currentDateRange, clearMap, renderTrack]);

  /**
   * Обработчик изменения транспортного средства
   */
  const handleVehicleChange = useCallback((imei) => {
    const vehicle = vehicles.find(v => v.imei === imei);
    if (vehicle) {
      updateVehicle(vehicle);
    }
  }, [vehicles, updateVehicle]);

  /**
   * Обработчик изменения периода дат
   */
  const handleDateRangeChange = useCallback((dates) => {
    if (dates && dates.length === 2) {
      const startDate = dates[0].format('YYYY-MM-DD');
      const endDate = dates[1].format('YYYY-MM-DD');
      updateDateRange([startDate, endDate]);
    }
  }, [updateDateRange]);

  /**
   * Обработчик экспорта трека
   */
  const handleExportTrack = useCallback(() => {
    if (!trackData || trackData.length === 0) {
      notification.warning({
        message: 'Нет данных для экспорта',
        description: 'Необходимо сначала загрузить данные трека'
      });
      return;
    }
    
    exportTrack(trackData, currentVehicle, currentDateRange)
      .then((filename) => {
        console.log(`Трек успешно экспортирован в файл ${filename}`);
      })
      .catch((error) => {
        console.error('Ошибка при экспорте трека:', error);
      });
  }, [trackData, currentVehicle, currentDateRange]);

  /**
   * Обработчик отображения статистики
   */
  const handleShowStatistics = useCallback(() => {
    if (!statistics) {
      notification.warning({
        message: 'Нет данных для отображения',
        description: 'Необходимо сначала загрузить данные трека'
      });
      return;
    }
    
    setStatisticsVisible(true);
  }, [statistics]);

  /**
   * Обработчик переключения режима разделенного экрана
   */
  const handleSplitScreenToggle = useCallback(() => {
    Modal.confirm({
      title: 'Разделение экрана',
      icon: <ExclamationCircleOutlined />,
      content: 'Выберите режим разделения экрана:',
      okText: 'Горизонтальное',
      cancelText: 'Отмена',
      onOk: () => {
        if (splitMode === 'horizontal') {
          changeSplitMode('single');
          updateSplitMode('single');
        } else {
          changeSplitMode('horizontal');
          updateSplitMode('horizontal');
        }
      },
      okButtonProps: {
        style: { float: 'right' }
      },
      footer: (_, { OkBtn, CancelBtn }) => (
        <>
          <button 
            className="ant-btn ant-btn-primary"
            onClick={() => {
              Modal.destroyAll();
              if (splitMode === 'vertical') {
                changeSplitMode('single');
                updateSplitMode('single');
              } else {
                changeSplitMode('vertical');
                updateSplitMode('vertical');
              }
            }}
            style={{ marginRight: 8 }}
          >
            Вертикальное
          </button>
          <button 
            className="ant-btn ant-btn-primary"
            onClick={() => {
              Modal.destroyAll();
              if (splitMode === 'quad') {
                changeSplitMode('single');
                updateSplitMode('single');
              } else {
                changeSplitMode('quad');
                updateSplitMode('quad');
              }
            }}
            style={{ marginRight: 8 }}
          >
            Четыре части
          </button>
          <OkBtn />
          <CancelBtn />
        </>
      )
    });
  }, [splitMode, changeSplitMode, updateSplitMode]);

  // Форматированный период для отображения
  const formattedDateRange = useMemo(() => {
    if (!currentDateRange || currentDateRange.length !== 2) {
      return '';
    }
    
    const startDate = dayjs(currentDateRange[0]).format('DD.MM.YYYY');
    const endDate = dayjs(currentDateRange[1]).format('DD.MM.YYYY');
    
    return `${startDate} - ${endDate}`;
  }, [currentDateRange]);

  return (
    <div className="track-map-container">
      {/* Контейнер для карты */}
      <div 
        id={containerId} 
        className="map-container"
        ref={mapRef}
      >
        {/* Индикатор загрузки */}
        {loading && (
          <div className="map-loading-overlay">
            <Spin 
              indicator={<LoadingOutlined style={{ fontSize: 36 }} spin />}
              tip="Загрузка данных трека..."
              size="large"
            />
          </div>
        )}
        
        {/* Сообщение об ошибке */}
        {error && (
          <div className="map-error-overlay">
            <Alert
              message="Ошибка загрузки данных"
              description={error}
              type="error"
              showIcon
              closable
              onClose={() => setError(null)}
            />
          </div>
        )}
      </div>
      
      {/* Элементы управления */}
      <MapControls
        vehicles={vehicles}
        selectedVehicle={currentVehicle}
        dateRange={currentDateRange}
        isPlaying={isPlaying}
        isLoading={loading}
        onVehicleChange={handleVehicleChange}
        onDateRangeChange={handleDateRangeChange}
        onPlayToggle={togglePlayback}
        onSpeedChange={setPlaybackSpeed}
        onSplitScreenToggle={handleSplitScreenToggle}
        onExportTrack={handleExportTrack}
        onShowStatistics={handleShowStatistics}
      />
      
      {/* Модальное окно со статистикой */}
      <Modal
        title="Статистика трека"
        open={statisticsVisible}
        onCancel={() => setStatisticsVisible(false)}
        footer={null}
        width={700}
      >
        <TrackStatistics
          statistics={statistics}
          vehicle={currentVehicle}
          dateRange={currentDateRange}
          onClose={() => setStatisticsVisible(false)}
        />
      </Modal>
    </div>
  );
};

export default TrackMap; 