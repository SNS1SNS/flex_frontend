import React, { useState, useEffect } from 'react';
import BaseChart from './BaseChart';
import { getAuthToken } from '../../utils/authUtils';

const RPMChart = ({ vehicle, startDate, endDate }) => {
  const [chartData, setChartData] = useState([]);
  const [chartLabels, setChartLabels] = useState([]);

  const fetchRPMData = async () => {
    if (!vehicle || !vehicle.imei || !startDate || !endDate) {
      console.warn('Не выбран транспорт или период для загрузки данных об оборотах двигателя');
      return;
    }

    // Преобразование дат в ISO формат для API
    const startISOString = startDate instanceof Date ? startDate.toISOString() : new Date(startDate).toISOString();
    const endISOString = endDate instanceof Date ? endDate.toISOString() : new Date(endDate).toISOString();

    try {
      // Получаем токен авторизации
      const authToken = getAuthToken();
      
      // Формируем URL для API
      const apiUrl = `/api/telemetry/v3/${vehicle.imei}/data?parameter=rpm&startTime=${encodeURIComponent(startISOString)}&endTime=${encodeURIComponent(endISOString)}&limit=5000`;
      
      // Подготавливаем заголовки
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      
      // Добавляем токен авторизации, если он есть
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      // Выполняем запрос
      const response = await fetch(apiUrl, { 
        method: 'GET',
        headers: headers
      });
      
      if (!response.ok) {
        throw new Error(`Ошибка API: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data) || data.length === 0) {
        console.warn('API вернул пустой массив данных об оборотах двигателя');
        setChartData([]);
        setChartLabels([]);
        return;
      }
      
      console.log(`Получено ${data.length} точек для графика оборотов двигателя`);
      
      // Фильтруем и подготавливаем данные
      const processedData = preprocessRPMData(data);
      
      // Обновляем состояние компонента
      setChartData(processedData.values);
      setChartLabels(processedData.labels);
    } catch (error) {
      console.error('Ошибка при загрузке данных об оборотах двигателя:', error);
      throw error;
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
  
  // Форматирование меток времени на оси X
  const formatTimeLabel = (dateTime) => {
    if (!dateTime || !(dateTime instanceof Date)) return '';
    
    const hours = dateTime.getHours().toString().padStart(2, '0');
    const minutes = dateTime.getMinutes().toString().padStart(2, '0');
    
    // Если данные за несколько дней, добавляем дату
    if (startDate && endDate && 
        endDate.getTime() - startDate.getTime() > 24 * 60 * 60 * 1000) {
      const day = dateTime.getDate().toString().padStart(2, '0');
      const month = (dateTime.getMonth() + 1).toString().padStart(2, '0');
      return `${day}.${month} ${hours}:${minutes}`;
    }
    
    return `${hours}:${minutes}`;
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