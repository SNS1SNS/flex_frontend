import React, { useState } from 'react';
import Tooltip from '../common/Tooltip';
import ChartTooltip from './ChartTooltip';
import './TooltipExample.css';

/**
 * Компонент с примерами использования тултипов
 * @returns {React.ReactElement} Компонент с примерами
 */
const TooltipExample = () => {
  // Пример данных для графика
  const [chartData, setChartData] = useState({
    points: [
      { id: 1, value: 45.5, date: '2023-05-10 10:00:00', additionalInfo: { 'Скорость': '60 км/ч', 'Топливо': '35 л' } },
      { id: 2, value: 62.3, date: '2023-05-10 11:30:00', additionalInfo: { 'Скорость': '75 км/ч', 'Топливо': '32 л' } },
      { id: 3, value: 53.7, date: '2023-05-10 13:00:00', additionalInfo: { 'Скорость': '65 км/ч', 'Топливо': '28 л' } },
    ]
  });

  // Генерация случайных данных для интерактивного примера
  const generateRandomData = () => {
    const newValue = Math.round(Math.random() * 100 * 100) / 100;
    const now = new Date();
    
    setChartData({
      points: [
        ...chartData.points.slice(1),
        {
          id: chartData.points[chartData.points.length - 1].id + 1,
          value: newValue,
          date: now.toLocaleString(),
          additionalInfo: {
            'Скорость': `${Math.round(Math.random() * 120)} км/ч`,
            'Топливо': `${Math.round(Math.random() * 50)} л`
          }
        }
      ]
    });
  };

  return (
    <div className="tooltip-examples">
      <h2>Примеры использования всплывающих подсказок</h2>

      <section className="example-section">
        <h3>Базовые подсказки</h3>
        <div className="examples-row">
          <Tooltip content="Это простая подсказка сверху" position="top">
            <button className="example-button">Подсказка сверху</button>
          </Tooltip>

          <Tooltip content="Это подсказка справа" position="right" type="warning">
            <button className="example-button">Подсказка справа</button>
          </Tooltip>

          <Tooltip content="Это подсказка снизу" position="bottom" type="error">
            <button className="example-button">Подсказка снизу</button>
          </Tooltip>

          <Tooltip content="Это подсказка слева" position="left" type="success">
            <button className="example-button">Подсказка слева</button>
          </Tooltip>
        </div>

        <div className="examples-row">
          <Tooltip 
            content={
              <>
                <h4>Форматированная подсказка</h4>
                <p>Подсказка может содержать <strong>HTML</strong> и иметь <em>любой формат</em>.</p>
                <ul>
                  <li>Включая списки</li>
                  <li>И другие элементы</li>
                </ul>
              </>
            } 
            position="top" 
            className="tooltip-lg"
          >
            <button className="example-button">Подсказка с HTML</button>
          </Tooltip>

          <Tooltip 
            content="Темная подсказка без стрелки" 
            position="top" 
            type="dark"
            arrow={false}
          >
            <button className="example-button">Темная без стрелки</button>
          </Tooltip>
        </div>
      </section>

      <section className="example-section">
        <h3>Подсказки для данных графиков</h3>
        <div className="chart-examples">
          <div className="chart-simulation">
            {chartData.points.map((point, index) => (
              <ChartTooltip
                key={point.id}
                data={point}
                title={`Точка ${index + 1}`}
                position={index % 2 === 0 ? 'top' : 'bottom'}
                type={index % 3 === 0 ? 'info' : (index % 3 === 1 ? 'warning' : 'success')}
              >
                <div className="chart-point" style={{ height: `${point.value}px` }}>
                  <div className="point-value">{point.value}</div>
                </div>
              </ChartTooltip>
            ))}
          </div>

          <button className="refresh-chart-btn" onClick={generateRandomData}>
            Обновить данные
          </button>
        </div>
      </section>

      <section className="example-section">
        <h3>Интерактивные подсказки</h3>
        <div className="examples-row">
          <Tooltip 
            content={
              <div className="interactive-tooltip">
                <h4>Подсказка с формой</h4>
                <input type="text" placeholder="Введите текст" />
                <button>Отправить</button>
              </div>
            } 
            position="bottom"
            className="tooltip-interactive"
          >
            <button className="example-button">Интерактивная подсказка</button>
          </Tooltip>
        </div>
      </section>
    </div>
  );
};

export default TooltipExample; 