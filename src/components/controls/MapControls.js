import React, { memo, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Button, Tooltip, Select, DatePicker, Space, Card, Divider } from 'antd';
import { 
  CarOutlined, 
  CalendarOutlined, 
  PlayCircleOutlined, 
  PauseCircleOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  LineChartOutlined,
  SplitCellsOutlined,
  FullscreenOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

/**
 * Компонент контролов карты для трекера
 * @param {Object} props - Свойства компонента
 * @returns {JSX.Element} Компонент контролов карты
 */
const MapControls = ({
  vehicles = [],
  selectedVehicle,
  dateRange,
  isPlaying,
  isLoading,
  onVehicleChange,
  onDateRangeChange,
  onPlayToggle,
  onSplitScreenToggle,
  onExportTrack,
  onShowStatistics
}) => {
  const [speedFactor, setSpeedFactor] = useState(1);
  
  /**
   * Обработчик изменения скорости воспроизведения
   * @param {number} value - Коэффициент скорости
   */
  const handleSpeedChange = useCallback((value) => {
    setSpeedFactor(value);
    // Если есть обработчик изменения скорости в родительском компоненте
    if (typeof onSpeedChange === 'function') {
      onSpeedChange(value);
    }
  }, []);

  /**
   * Форматирование названия транспортного средства для отображения
   * @param {Object} vehicle - Объект транспортного средства
   * @returns {string} Отформатированное название
   */
  const formatVehicleName = useCallback((vehicle) => {
    if (!vehicle) return '';
    
    const name = vehicle.name || '';
    const model = vehicle.model || '';
    const regNumber = vehicle.regNumber || '';
    
    let displayName = name;
    
    if (model && model !== name) {
      displayName += ` (${model})`;
    }
    
    if (regNumber) {
      displayName += ` - ${regNumber}`;
    }
    
    return displayName;
  }, []);

  return (
    <Card className="map-controls-card">
      <div className="controls-section">
        <h4>Транспорт и даты</h4>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div className="control-item">
            <label htmlFor="vehicle-select">
              <CarOutlined /> Транспортное средство:
            </label>
            <Select
              id="vehicle-select"
              style={{ width: '100%' }}
              placeholder="Выберите ТС"
              value={selectedVehicle?.imei}
              onChange={onVehicleChange}
              loading={isLoading}
              disabled={isLoading}
            >
              {vehicles.map((vehicle) => (
                <Option key={vehicle.imei} value={vehicle.imei}>
                  {formatVehicleName(vehicle)}
                </Option>
              ))}
            </Select>
          </div>

          <div className="control-item">
            <label htmlFor="date-picker">
              <CalendarOutlined /> Период:
            </label>
            <RangePicker
              id="date-picker"
              style={{ width: '100%' }}
              value={dateRange ? [dayjs(dateRange[0]), dayjs(dateRange[1])] : null}
              onChange={onDateRangeChange}
              format="DD.MM.YYYY"
              disabled={isLoading}
              allowClear={false}
            />
          </div>
        </Space>
      </div>

      <Divider />
      
      <div className="controls-section">
        <h4>Воспроизведение</h4>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <div className="control-buttons">
            <Tooltip title={isPlaying ? 'Пауза' : 'Воспроизвести'}>
              <Button
                type="primary"
                icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                onClick={onPlayToggle}
                disabled={isLoading || !selectedVehicle}
              />
            </Tooltip>
          </div>
          
          <div className="control-item" style={{ width: '60%' }}>
            <label htmlFor="speed-select">
              <ClockCircleOutlined /> Скорость:
            </label>
            <Select
              id="speed-select"
              style={{ width: '100%' }}
              value={speedFactor}
              onChange={handleSpeedChange}
              disabled={isLoading}
            >
              <Option value={0.5}>x0.5</Option>
              <Option value={1}>x1</Option>
              <Option value={2}>x2</Option>
              <Option value={4}>x4</Option>
              <Option value={8}>x8</Option>
            </Select>
          </div>
        </Space>
      </div>

      <Divider />
      
      <div className="controls-section">
        <h4>Инструменты</h4>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Tooltip title="Экспорт трека">
            <Button
              icon={<DownloadOutlined />}
              onClick={onExportTrack}
              disabled={isLoading || !selectedVehicle}
            >
              Экспорт
            </Button>
          </Tooltip>
          
          <Tooltip title="Статистика">
            <Button
              icon={<LineChartOutlined />}
              onClick={onShowStatistics}
              disabled={isLoading || !selectedVehicle}
            >
              Статистика
            </Button>
          </Tooltip>
          
          <Tooltip title="Разделить экран">
            <Button
              icon={<SplitCellsOutlined />}
              onClick={onSplitScreenToggle}
            >
              Разделение
            </Button>
          </Tooltip>
          
          <Tooltip title="Полный экран">
            <Button
              icon={<FullscreenOutlined />}
              onClick={() => {
                // Найти контейнер карты и переключить полноэкранный режим
                const mapContainer = document.querySelector('.map-container');
                if (mapContainer) {
                  if (!document.fullscreenElement) {
                    mapContainer.requestFullscreen().catch(err => {
                      console.error(`Ошибка переключения полноэкранного режима: ${err.message}`);
                    });
                  } else {
                    document.exitFullscreen();
                  }
                }
              }}
            />
          </Tooltip>
        </Space>
      </div>

      <style jsx>{`
        .map-controls-card {
          max-width: 400px;
          z-index: 1000;
          position: absolute;
          top: 10px;
          right: 10px;
          background-color: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(5px);
        }
        
        .controls-section {
          margin-bottom: 10px;
        }
        
        .controls-section h4 {
          margin-bottom: 8px;
          font-size: 14px;
          color: #1890ff;
        }
        
        .control-item {
          margin-bottom: 8px;
        }
        
        .control-item label {
          display: block;
          margin-bottom: 4px;
          font-size: 12px;
        }
        
        .control-buttons {
          display: flex;
          gap: 8px;
        }
      `}</style>
    </Card>
  );
};

MapControls.propTypes = {
  vehicles: PropTypes.arrayOf(
    PropTypes.shape({
      imei: PropTypes.string.isRequired,
      name: PropTypes.string,
      model: PropTypes.string,
      regNumber: PropTypes.string
    })
  ),
  selectedVehicle: PropTypes.shape({
    imei: PropTypes.string.isRequired,
    name: PropTypes.string,
    model: PropTypes.string,
    regNumber: PropTypes.string
  }),
  dateRange: PropTypes.arrayOf(PropTypes.string),
  isPlaying: PropTypes.bool,
  isLoading: PropTypes.bool,
  onVehicleChange: PropTypes.func.isRequired,
  onDateRangeChange: PropTypes.func.isRequired,
  onPlayToggle: PropTypes.func.isRequired,
  onSpeedChange: PropTypes.func,
  onSplitScreenToggle: PropTypes.func.isRequired,
  onExportTrack: PropTypes.func.isRequired,
  onShowStatistics: PropTypes.func.isRequired
};

// Используем React.memo для предотвращения лишних перерисовок
export default memo(MapControls); 