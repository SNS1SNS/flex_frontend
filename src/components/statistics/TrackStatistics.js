import React, { memo, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Descriptions, Card, Statistic, Divider, Row, Col } from 'antd';
import { 
  DashboardOutlined, 
  FieldTimeOutlined, 
  RocketOutlined, 
  CompassOutlined,
  EnvironmentOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

// Подключаем плагин для работы с продолжительностью
dayjs.extend(duration);

/**
 * Форматирует продолжительность в удобочитаемую строку
 * @param {number} minutes - Продолжительность в минутах
 * @returns {string} Отформатированная продолжительность
 */
const formatDuration = (minutes) => {
  const dur = dayjs.duration(minutes, 'minutes');
  const hours = Math.floor(dur.asHours());
  const mins = Math.floor(dur.minutes());
  
  if (hours > 0) {
    return `${hours} ч ${mins} мин`;
  }
  return `${mins} мин`;
};

/**
 * Компонент для отображения статистики по треку
 * @param {Object} props - Свойства компонента
 * @returns {JSX.Element} Компонент статистики трека
 */
const TrackStatistics = ({ 
  statistics, 
  vehicle, 
  dateRange,
  onClose
}) => {
  const formattedDateRange = useMemo(() => {
    if (!dateRange || dateRange.length !== 2) return '';
    
    const startDate = dayjs(dateRange[0]).format('DD.MM.YYYY');
    const endDate = dayjs(dateRange[1]).format('DD.MM.YYYY');
    
    if (startDate === endDate) {
      return startDate;
    }
    
    return `${startDate} - ${endDate}`;
  }, [dateRange]);
  
  if (!statistics) {
    return (
      <Card title="Статистика по треку" extra={onClose && <a onClick={onClose}>Закрыть</a>}>
        <p>Нет данных для отображения</p>
      </Card>
    );
  }
  
  const { 
    totalDistance, 
    averageSpeed, 
    maxSpeed, 
    duration: durationMinutes,
    startPoint,
    endPoint,
    startTime,
    endTime,
    idleTime,
    movingTime,
    fuelConsumption,
    engineHours 
  } = statistics;
  
  return (
    <Card 
      title="Статистика по треку" 
      extra={onClose && <a onClick={onClose}>Закрыть</a>}
      className="track-statistics-card"
    >
      <Descriptions title="Общая информация" bordered column={1}>
        {vehicle && (
          <Descriptions.Item label="Транспортное средство">
            {vehicle.name || vehicle.model || vehicle.imei}
            {vehicle.regNumber && ` (${vehicle.regNumber})`}
          </Descriptions.Item>
        )}
        
        {formattedDateRange && (
          <Descriptions.Item label="Период">
            {formattedDateRange}
          </Descriptions.Item>
        )}
      </Descriptions>
      
      <Divider />
      
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <Statistic 
            title="Общее расстояние" 
            value={totalDistance} 
            suffix="км" 
            precision={2}
            prefix={<DashboardOutlined />} 
          />
        </Col>
        
        <Col xs={24} sm={12}>
          <Statistic 
            title="Продолжительность" 
            value={formatDuration(durationMinutes)}
            prefix={<FieldTimeOutlined />} 
          />
        </Col>
        
        <Col xs={24} sm={12}>
          <Statistic 
            title="Средняя скорость" 
            value={averageSpeed} 
            suffix="км/ч" 
            precision={1}
            prefix={<CompassOutlined />} 
          />
        </Col>
        
        <Col xs={24} sm={12}>
          <Statistic 
            title="Максимальная скорость" 
            value={maxSpeed} 
            suffix="км/ч" 
            precision={1}
            prefix={<RocketOutlined />} 
          />
        </Col>
      </Row>
      
      {(movingTime || idleTime) && (
        <>
          <Divider />
          
          <Row gutter={[16, 16]}>
            {movingTime > 0 && (
              <Col xs={24} sm={12}>
                <Statistic 
                  title="Время в движении" 
                  value={formatDuration(movingTime)}
                  prefix={<DashboardOutlined />} 
                />
              </Col>
            )}
            
            {idleTime > 0 && (
              <Col xs={24} sm={12}>
                <Statistic 
                  title="Время на стоянках" 
                  value={formatDuration(idleTime)}
                  prefix={<ClockCircleOutlined />} 
                />
              </Col>
            )}
            
            {fuelConsumption > 0 && (
              <Col xs={24} sm={12}>
                <Statistic 
                  title="Расход топлива" 
                  value={fuelConsumption} 
                  suffix="л" 
                  precision={1}
                />
              </Col>
            )}
            
            {engineHours > 0 && (
              <Col xs={24} sm={12}>
                <Statistic 
                  title="Моточасы" 
                  value={formatDuration(engineHours)}
                />
              </Col>
            )}
          </Row>
        </>
      )}
      
      {(startPoint && endPoint) && (
        <>
          <Divider />
          
          <Descriptions title="Детали маршрута" bordered column={1}>
            <Descriptions.Item label={<><EnvironmentOutlined /> Начальная точка</>}>
              {startPoint.address || `${startPoint.lat.toFixed(6)}, ${startPoint.lng.toFixed(6)}`}
              {startTime && <div><small>{dayjs(startTime).format('DD.MM.YYYY HH:mm:ss')}</small></div>}
            </Descriptions.Item>
            
            <Descriptions.Item label={<><EnvironmentOutlined /> Конечная точка</>}>
              {endPoint.address || `${endPoint.lat.toFixed(6)}, ${endPoint.lng.toFixed(6)}`}
              {endTime && <div><small>{dayjs(endTime).format('DD.MM.YYYY HH:mm:ss')}</small></div>}
            </Descriptions.Item>
          </Descriptions>
        </>
      )}
      
      <style jsx>{`
        .track-statistics-card {
          max-width: 600px;
          margin: 0 auto;
        }
        
        @media (max-width: 576px) {
          .track-statistics-card {
            max-width: 100%;
          }
        }
      `}</style>
    </Card>
  );
};

TrackStatistics.propTypes = {
  statistics: PropTypes.shape({
    totalDistance: PropTypes.number,
    averageSpeed: PropTypes.number,
    maxSpeed: PropTypes.number,
    duration: PropTypes.number,
    startPoint: PropTypes.shape({
      lat: PropTypes.number,
      lng: PropTypes.number,
      address: PropTypes.string
    }),
    endPoint: PropTypes.shape({
      lat: PropTypes.number,
      lng: PropTypes.number,
      address: PropTypes.string
    }),
    startTime: PropTypes.string,
    endTime: PropTypes.string,
    idleTime: PropTypes.number,
    movingTime: PropTypes.number,
    fuelConsumption: PropTypes.number,
    engineHours: PropTypes.number
  }),
  vehicle: PropTypes.shape({
    imei: PropTypes.string.isRequired,
    name: PropTypes.string,
    model: PropTypes.string,
    regNumber: PropTypes.string
  }),
  dateRange: PropTypes.arrayOf(PropTypes.string),
  onClose: PropTypes.func
};

export default memo(TrackStatistics); 