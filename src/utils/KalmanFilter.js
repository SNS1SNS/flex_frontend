/**
 * Реализация одномерного фильтра Калмана для сглаживания данных о топливе
 */
class KalmanFilter {
  /**
   * Инициализация фильтра Калмана
   * @param {number} processNoise - Шум процесса (Q) - насколько быстро меняется измеряемая величина
   * @param {number} measurementNoise - Шум измерения (R) - насколько шумные измерения
   * @param {number} estimationError - Начальная ошибка оценки (P)
   * @param {number} initialValue - Начальное значение оценки (X)
   */
  constructor(processNoise = 0.01, measurementNoise = 1.0, estimationError = 1.0, initialValue = 0.0) {
    this.processNoise = processNoise;         // Q
    this.measurementNoise = measurementNoise; // R
    this.estimationError = estimationError;   // P
    this.lastEstimate = initialValue;         // X
  }
  
  /**
   * Обновить оценку с новым измерением
   * @param {number} measurement - Новое измерение
   * @returns {number} - Отфильтрованное значение
   */
  update(measurement) {
    // Предсказание
    const prediction = this.lastEstimate;
    const predictionError = this.estimationError + this.processNoise;
    
    // Обновление
    const kalmanGain = predictionError / (predictionError + this.measurementNoise);
    const currentEstimate = prediction + kalmanGain * (measurement - prediction);
    this.estimationError = (1 - kalmanGain) * predictionError;
    this.lastEstimate = currentEstimate;
    
    return currentEstimate;
  }
  
  /**
   * Фильтрация массива данных
   * @param {number[]} data - Массив значений для фильтрации
   * @returns {number[]} - Массив отфильтрованных значений
   */
  filterArray(data) {
    return data.map(value => this.update(value));
  }
  
  /**
   * Сброс фильтра в начальное состояние
   * @param {number} initialValue - Новое начальное значение
   */
  reset(initialValue = 0.0) {
    this.estimationError = 1.0;
    this.lastEstimate = initialValue;
  }
  
  /**
   * Настройка параметров фильтра
   * @param {Object} params - Параметры для настройки
   * @param {number} [params.processNoise] - Шум процесса (Q)
   * @param {number} [params.measurementNoise] - Шум измерения (R)
   */
  setParams({ processNoise, measurementNoise }) {
    if (processNoise !== undefined) this.processNoise = processNoise;
    if (measurementNoise !== undefined) this.measurementNoise = measurementNoise;
  }
}

export default KalmanFilter; 