import dayjs from 'dayjs';
import { saveAs } from 'file-saver';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { notification, Modal } from 'antd';

/**
 * Экспорт данных трека в формате CSV
 * @param {Array} trackData - Массив точек трека
 * @param {Object} vehicle - Информация о транспортном средстве
 * @param {Array} dateRange - Диапазон дат [начальная дата, конечная дата]
 * @returns {Promise} Промис, который разрешается после успешного экспорта
 */
export const exportTrackToCsv = async (trackData, vehicle, dateRange) => {
  try {
    if (!trackData || !Array.isArray(trackData) || trackData.length === 0) {
      notification.error({
        message: 'Ошибка экспорта',
        description: 'Нет данных для экспорта',
        icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
      });
      return Promise.reject(new Error('Нет данных для экспорта'));
    }

    // Форматируем имя файла на основе данных о транспортном средстве и периоде
    const vehicleName = vehicle?.name || vehicle?.model || vehicle?.regNumber || vehicle?.imei || 'unknown';
    const startDate = dateRange && dateRange[0] 
      ? dayjs(dateRange[0]).format('YYYY-MM-DD')
      : 'unknown-start';
    const endDate = dateRange && dateRange[1]
      ? dayjs(dateRange[1]).format('YYYY-MM-DD')
      : 'unknown-end';
    
    const filename = `track_${vehicleName.replace(/\s+/g, '_')}_${startDate}_${endDate}.csv`;

    // Заголовки CSV
    const headers = [
      'Timestamp',
      'Date',
      'Time',
      'Latitude',
      'Longitude',
      'Speed (km/h)',
      'Direction (deg)',
      'Altitude (m)',
      'Satellites',
      'HDOP',
      'Engine Status',
      'Power Supply',
      'Address'
    ].join(',');

    // Преобразуем данные трека в строки CSV
    const rows = trackData.map(point => {
      const timestamp = point.timestamp || point.time || '';
      const dateObj = timestamp ? dayjs(timestamp) : null;
      const date = dateObj ? dateObj.format('YYYY-MM-DD') : '';
      const time = dateObj ? dateObj.format('HH:mm:ss') : '';
      
      // Экранируем поля, содержащие запятые или кавычки
      const address = point.address 
        ? `"${point.address.replace(/"/g, '""')}"`
        : '';
      
      return [
        timestamp,
        date,
        time,
        point.lat || point.latitude || '',
        point.lng || point.longitude || '',
        point.speed || '',
        point.direction || point.course || '',
        point.altitude || '',
        point.satellites || '',
        point.hdop || '',
        point.engineStatus ? 'On' : 'Off',
        point.powerSupply || '',
        address
      ].join(',');
    });

    // Составляем CSV-контент
    const csvContent = [headers, ...rows].join('\n');
    
    // Создаем Blob и загружаем файл
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, filename);
    
    notification.success({
      message: 'Экспорт успешно завершен',
      description: `Данные экспортированы в файл ${filename}`
    });
    
    return Promise.resolve(filename);
  } catch (error) {
    console.error('Ошибка экспорта трека в CSV:', error);
    
    notification.error({
      message: 'Ошибка экспорта',
      description: `Не удалось экспортировать данные: ${error.message}`,
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
    });
    
    return Promise.reject(error);
  }
};

/**
 * Экспорт данных трека в формате GPX
 * @param {Array} trackData - Массив точек трека
 * @param {Object} vehicle - Информация о транспортном средстве
 * @param {Array} dateRange - Диапазон дат [начальная дата, конечная дата]
 * @returns {Promise} Промис, который разрешается после успешного экспорта
 */
export const exportTrackToGpx = async (trackData, vehicle, dateRange) => {
  try {
    if (!trackData || !Array.isArray(trackData) || trackData.length === 0) {
      notification.error({
        message: 'Ошибка экспорта',
        description: 'Нет данных для экспорта',
        icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
      });
      return Promise.reject(new Error('Нет данных для экспорта'));
    }

    // Форматируем имя файла на основе данных о транспортном средстве и периоде
    const vehicleName = vehicle?.name || vehicle?.model || vehicle?.regNumber || vehicle?.imei || 'unknown';
    const startDate = dateRange && dateRange[0] 
      ? dayjs(dateRange[0]).format('YYYY-MM-DD')
      : 'unknown-start';
    const endDate = dateRange && dateRange[1]
      ? dayjs(dateRange[1]).format('YYYY-MM-DD')
      : 'unknown-end';
    
    const filename = `track_${vehicleName.replace(/\s+/g, '_')}_${startDate}_${endDate}.gpx`;

    // Создаем GPX документ
    const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="Fleet Tracker Export"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>Track for ${vehicleName}</name>
    <time>${dayjs().toISOString()}</time>
    <desc>Track data for ${vehicleName} from ${startDate} to ${endDate}</desc>
  </metadata>
  <trk>
    <name>${vehicleName} track</name>
    <trkseg>
${trackData.map(point => {
  const timestamp = point.timestamp || point.time || '';
  return `      <trkpt lat="${point.lat || point.latitude}" lon="${point.lng || point.longitude}">
        <ele>${point.altitude || 0}</ele>
        <time>${timestamp || dayjs().toISOString()}</time>
        <speed>${(point.speed || 0) / 3.6}</speed>
        <course>${point.direction || point.course || 0}</course>
        ${point.satellites ? `<sat>${point.satellites}</sat>` : ''}
        ${point.hdop ? `<hdop>${point.hdop}</hdop>` : ''}
      </trkpt>`;
}).join('\n')}
    </trkseg>
  </trk>
</gpx>`;

    // Создаем Blob и загружаем файл
    const blob = new Blob([gpxContent], { type: 'application/gpx+xml;charset=utf-8' });
    saveAs(blob, filename);
    
    notification.success({
      message: 'Экспорт успешно завершен',
      description: `Данные экспортированы в файл ${filename}`
    });
    
    return Promise.resolve(filename);
  } catch (error) {
    console.error('Ошибка экспорта трека в GPX:', error);
    
    notification.error({
      message: 'Ошибка экспорта',
      description: `Не удалось экспортировать данные: ${error.message}`,
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
    });
    
    return Promise.reject(error);
  }
};

/**
 * Экспорт данных трека в формате JSON
 * @param {Array} trackData - Массив точек трека
 * @param {Object} vehicle - Информация о транспортном средстве
 * @param {Array} dateRange - Диапазон дат [начальная дата, конечная дата]
 * @returns {Promise} Промис, который разрешается после успешного экспорта
 */
export const exportTrackToJson = async (trackData, vehicle, dateRange) => {
  try {
    if (!trackData || !Array.isArray(trackData) || trackData.length === 0) {
      notification.error({
        message: 'Ошибка экспорта',
        description: 'Нет данных для экспорта',
        icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
      });
      return Promise.reject(new Error('Нет данных для экспорта'));
    }

    // Форматируем имя файла на основе данных о транспортном средстве и периоде
    const vehicleName = vehicle?.name || vehicle?.model || vehicle?.regNumber || vehicle?.imei || 'unknown';
    const startDate = dateRange && dateRange[0] 
      ? dayjs(dateRange[0]).format('YYYY-MM-DD')
      : 'unknown-start';
    const endDate = dateRange && dateRange[1]
      ? dayjs(dateRange[1]).format('YYYY-MM-DD')
      : 'unknown-end';
    
    const filename = `track_${vehicleName.replace(/\s+/g, '_')}_${startDate}_${endDate}.json`;

    // Создаем объект с метаданными и треком
    const jsonData = {
      metadata: {
        vehicle: {
          ...vehicle
        },
        dateRange: {
          start: dateRange && dateRange[0] ? dateRange[0] : null,
          end: dateRange && dateRange[1] ? dateRange[1] : null
        },
        exportTime: dayjs().toISOString(),
        pointCount: trackData.length
      },
      trackPoints: trackData
    };

    // Создаем Blob и загружаем файл
    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json;charset=utf-8' });
    saveAs(blob, filename);
    
    notification.success({
      message: 'Экспорт успешно завершен',
      description: `Данные экспортированы в файл ${filename}`
    });
    
    return Promise.resolve(filename);
  } catch (error) {
    console.error('Ошибка экспорта трека в JSON:', error);
    
    notification.error({
      message: 'Ошибка экспорта',
      description: `Не удалось экспортировать данные: ${error.message}`,
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
    });
    
    return Promise.reject(error);
  }
};

/**
 * Экспорт данных трека в выбранном формате
 * @param {Array} trackData - Массив точек трека
 * @param {Object} vehicle - Информация о транспортном средстве
 * @param {Array} dateRange - Диапазон дат [начальная дата, конечная дата]
 * @returns {Promise} Промис, который разрешается после успешного экспорта
 */
export const exportTrack = (trackData, vehicle, dateRange) => {
  return new Promise((resolve, reject) => {
    if (!trackData || !Array.isArray(trackData) || trackData.length === 0) {
      notification.error({
        message: 'Ошибка экспорта',
        description: 'Нет данных для экспорта',
        icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
      });
      reject(new Error('Нет данных для экспорта'));
      return;
    }
    
    // Показываем модальное окно для выбора формата
    Modal.confirm({
      title: 'Выберите формат экспорта',
      icon: <ExclamationCircleOutlined />,
      content: 'В каком формате вы хотите экспортировать данные трека?',
      okText: 'GPX',
      cancelText: 'Отмена',
      onOk: () => {
        exportTrackToGpx(trackData, vehicle, dateRange)
          .then(resolve)
          .catch(reject);
      },
      onCancel: () => {
        // Ничего не делаем при отмене
        reject(new Error('Экспорт отменен'));
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
              exportTrackToCsv(trackData, vehicle, dateRange)
                .then(resolve)
                .catch(reject);
            }}
            style={{ marginRight: 8 }}
          >
            CSV
          </button>
          <button 
            className="ant-btn ant-btn-primary"
            onClick={() => {
              Modal.destroyAll();
              exportTrackToJson(trackData, vehicle, dateRange)
                .then(resolve)
                .catch(reject);
            }}
            style={{ marginRight: 8 }}
          >
            JSON
          </button>
          <OkBtn />
          <CancelBtn />
        </>
      )
    });
  });
};

export default exportTrack; 