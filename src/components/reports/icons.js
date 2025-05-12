/**
 * Файл с импортами иконок Font Awesome для использования в компонентах
 */

// Импортируем основные компоненты Font Awesome
import { library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

// Импортируем используемые иконки
import { 
  faGasPump,
  faSyncAlt, 
  faSearch, 
  faSearchMinus, 
  faSearchPlus,
  faDownload, 
  faExpand, 
  faCompress, 
  faTimes, 
  faArrowUp,
  faArrowDown,
  faArrowsAltV,
  faChartLine,
  faCalendarAlt,
  faClock,
  faRedo,
  faUndo,
  faTruck,
  faColumns,
  faWindowRestore,
  faChartBar,
  faKeyboard,
  faEye,
  faEyeSlash,
  faExclamationTriangle,
  faInfoCircle
} from '@fortawesome/free-solid-svg-icons';

// Добавляем все иконки в библиотеку для глобального доступа
library.add(
  faGasPump,
  faSyncAlt,
  faSearch,
  faSearchMinus,
  faSearchPlus,
  faDownload,
  faExpand,
  faCompress,
  faTimes,
  faArrowUp,
  faArrowDown,
  faArrowsAltV,
  faChartLine,
  faCalendarAlt,
  faClock,
  faRedo,
  faUndo,
  faTruck,
  faColumns,
  faWindowRestore,
  faChartBar,
  faKeyboard,
  faEye,
  faEyeSlash,
  faExclamationTriangle,
  faInfoCircle
);

// Экспортируем компонент иконки для использования
export { FontAwesomeIcon };

// Экспортируем названия иконок как константы для удобства
export const ICONS = {
  GAS_PUMP: 'gas-pump',
  SYNC: 'sync-alt',
  SEARCH: 'search',
  SEARCH_MINUS: 'search-minus',
  SEARCH_PLUS: 'search-plus',
  DOWNLOAD: 'download',
  EXPAND: 'expand',
  COMPRESS: 'compress',
  CLOSE: 'times',
  ARROW_UP: 'arrow-up',
  ARROW_DOWN: 'arrow-down',
  ARROWS_V: 'arrows-alt-v',
  CHART_LINE: 'chart-line',
  CALENDAR: 'calendar-alt',
  CLOCK: 'clock',
  REDO: 'redo',
  UNDO: 'undo',
  TRUCK: 'truck',
  COLUMNS: 'columns',
  WINDOW_RESTORE: 'window-restore',
  CHART_BAR: 'chart-bar',
  KEYBOARD: 'keyboard',
  EYE: 'eye',
  EYE_SLASH: 'eye-slash',
  WARNING: 'exclamation-triangle',
  INFO: 'info-circle'
}; 