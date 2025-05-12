/**
 * Демонстрационный скрипт для тестирования фильтра Калмана
 * Позволяет увидеть работу фильтра на синтетических данных
 * с различными условиями, включая резкие изменения
 */

import KalmanFilter from './KalmanFilter';

/**
 * Создает массив синтетических данных имитирующих показания датчика топлива
 * @param {number} length - Количество точек данных
 * @param {number} startValue - Начальное значение
 * @param {number} noiseLevel - Уровень шума (0-1)
 * @param {Array} events - Массив событий (заправки, расход) в формате [индекс, значение]
 * @returns {Array} - Массив синтетических данных
 */
function generateSyntheticData(length = 100, startValue = 50, noiseLevel = 0.2, events = []) {
  const data = new Array(length).fill(0);
  
  // Начальное значение
  data[0] = startValue;
  
  // Генерация данных с постепенным снижением (расход топлива)
  for (let i = 1; i < length; i++) {
    // Базовое снижение (расход топлива)
    const consumption = 0.05;
    
    // Добавляем случайный шум
    const noise = (Math.random() - 0.5) * noiseLevel * 2;
    
    // Применяем формулу для следующего значения
    data[i] = Math.max(0, data[i-1] - consumption + noise);
  }
  
  // Применяем события (заправки, резкие изменения)
  events.forEach(([index, value]) => {
    if (index >= 0 && index < length) {
      data[index] += value;
    }
  });
  
  return data;
}

/**
 * Демонстрирует работу фильтра Калмана на синтетических данных
 */
function demonstrateKalmanFilter() {
  console.log('Демонстрация работы фильтра Калмана для данных о топливе');
  
  // Генерируем синтетические данные с имитацией заправок
  const rawData = generateSyntheticData(100, 40, 0.8, [
    [20, 15],  // Заправка на 15 литров в индексе 20
    [50, 20],  // Заправка на 20 литров в индексе 50
    [70, -10]  // Резкое снижение на 10 литров в индексе 70 (возможно слив)
  ]);
  
  // Создаем фильтр Калмана с разными настройками
  const defaultFilter = new KalmanFilter({
    initialValue: rawData[0],
    initialCovariance: 1,
    baseProcessCovariance: 0.01,
    measurementCovariance: 1,
    refillThreshold: 3,
    adaptationFactor: 10,
    adaptiveSteps: 5
  });
  
  // Фильтр с высоким сглаживанием
  const highSmoothingFilter = new KalmanFilter({
    initialValue: rawData[0],
    initialCovariance: 1,
    baseProcessCovariance: 0.001, // Меньшее значение = больше сглаживание
    measurementCovariance: 2,     // Большее значение = меньше доверия измерениям
    refillThreshold: 3,
    adaptationFactor: 5,          // Меньшее значение = меньше адаптация к резким изменениям
    adaptiveSteps: 10             // Больше шагов для возврата к нормальному режиму
  });
  
  // Фильтр с низким сглаживанием
  const lowSmoothingFilter = new KalmanFilter({
    initialValue: rawData[0],
    initialCovariance: 1,
    baseProcessCovariance: 0.1,   // Большее значение = меньше сглаживание
    measurementCovariance: 0.5,   // Меньшее значение = больше доверия измерениям
    refillThreshold: 2,           // Более низкий порог для обнаружения изменений
    adaptationFactor: 20,         // Большее значение = сильнее адаптация к резким изменениям
    adaptiveSteps: 3              // Меньше шагов для возврата к нормальному режиму
  });
  
  // Применяем фильтры к данным
  const defaultFiltered = defaultFilter.filterArray(rawData);
  const highSmoothingFiltered = highSmoothingFilter.filterArray(rawData);
  const lowSmoothingFiltered = lowSmoothingFilter.filterArray(rawData);
  
  // Выводим результаты для сравнения
  console.log('Сравнение работы фильтров:');
  console.log('Индекс | Сырые | Стандартный | Высокое сглаживание | Низкое сглаживание');
  
  // Выводим только некоторые ключевые точки для наглядности
  const keyIndices = [0, 10, 19, 20, 21, 49, 50, 51, 69, 70, 71, 99];
  
  keyIndices.forEach(i => {
    if (i < rawData.length) {
      console.log(
        `${i.toString().padStart(3)} | ${rawData[i].toFixed(2)} | ${defaultFiltered[i].toFixed(2)} | ${highSmoothingFiltered[i].toFixed(2)} | ${lowSmoothingFiltered[i].toFixed(2)}`
      );
    }
  });
  
  return {
    rawData,
    defaultFiltered,
    highSmoothingFiltered,
    lowSmoothingFiltered
  };
}

export {
  generateSyntheticData,
  demonstrateKalmanFilter
}; 