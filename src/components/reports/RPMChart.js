import React, { useState, useEffect } from 'react';
import BaseChart from './BaseChart';
import { getAuthToken } from '../../utils/authUtils';
import { formatChartTimeLabel, validateDateRange } from '../../utils/DateUtils';

const RPMChart = ({ vehicle, startDate, endDate }) => {
  const [chartData, setChartData] = useState([]);
  const [chartLabels, setChartLabels] = useState([]);

  const fetchRPMData = async () => {
    if (!vehicle || !vehicle.imei || !startDate || !endDate) {
      console.warn('Не выбран транспорт или период для загрузки данных об оборотах двигателя');
      return;
    }

    // Проверяем и исправляем диапазон дат
    const { startDate: validStartDate, endDate: validEndDate } = validateDateRange(startDate, endDate);

    // Преобразование дат в ISO формат для API
    const startISOString = validStartDate instanceof Date ? validStartDate.toISOString() : new Date(validStartDate).toISOString();
    const endISOString = validEndDate instanceof Date ? validEndDate.toISOString() : new Date(validEndDate).toISOString();

    try {
      const response = await fetch(`/api/rpm/${vehicle.imei}?startTime=${startISOString}&endTime=${endISOString}`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Ошибка получения данных: ${response.status}`);
      }

      const data = await response.json();
      
      if (data && Array.isArray(data.points)) {
        const processedData = preprocessRPMData(data.points);
        setChartData(processedData.values);
        setChartLabels(processedData.labels);
      } else {
        console.warn('Получен неверный формат данных об оборотах двигателя');
        setChartData([]);
        setChartLabels([]);
      }
    } catch (error) {
      console.error('Ошибка при загрузке данных об оборотах двигателя:', error);
    }
  };
  
  // Эффект для первоначальной загрузки данных
  useEffect(() => {
    if (vehicle && startDate && endDate) {
      fetchRPMData();
    }
  }, [vehicle, startDate, endDate]);
  
  // Функция для предварительной обработки данных оборотов двигателя
  const preprocessRPMData = (rawData) => {
    // Проверяем наличие и корректность данных
    if (!Array.isArray(rawData) || rawData.length === 0) {
      return { values: [], labels: [] };
    }
    
    // Сортируем по времени
    const sortedData = [...rawData].sort((a, b) => {
      const timeA = new Date(a.time || a.timestamp).getTime();
      const timeB = new Date(b.time || b.timestamp).getTime();
      return timeA - timeB;
    });
    
    // Прореживаем данные, если их слишком много (более 1000 точек)
    let processedData = sortedData;
    if (sortedData.length > 1000) {
      const step = Math.floor(sortedData.length / 1000);
      processedData = sortedData.filter((_, index) => index % step === 0);
      console.log(`Прореживание данных оборотов: ${sortedData.length} -> ${processedData.length} точек`);
    }
    
    // Преобразуем данные в формат для графика
    const values = processedData.map(item => 
      typeof item.value === 'number' ? item.value : 
      typeof item.rpm === 'number' ? item.rpm : 
      typeof item.engineRpm === 'number' ? item.engineRpm : 0
    );
    
    // Форматируем метки времени
    const labels = processedData.map(item => {
      const date = new Date(item.time || item.timestamp);
      return date;
    });
    
    return { values, labels };
  };
  
  // Форматирование подписей осей
  const formatRPMLabel = (value) => `${value} об/мин`;
  
  // Форматирование меток времени на оси X с использованием общей утилиты
  const formatTimeLabel = (dateTime) => {
    return formatChartTimeLabel(dateTime, startDate, endDate);
  };
  
  return (
    <BaseChart
      title="График оборотов двигателя"
      vehicle={vehicle}
      startDate={startDate}
      endDate={endDate}
      data={chartData}
      labels={chartLabels}
      yAxisLabel="Обороты двигателя (об/мин)"
      color="rgb(153, 102, 255)"
      fetchData={fetchRPMData}
      formatTooltipLabel={formatRPMLabel}
      formatYAxisLabel={formatRPMLabel}
      formatXAxisLabel={formatTimeLabel}
      emptyDataMessage="Нет данных об оборотах двигателя за выбранный период"
    />
  );
};

export default RPMChart; 