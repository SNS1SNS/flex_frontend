/**
 * Модель папки для работы с деревом папок
 */
class Folder {
  /**
   * Создает новый экземпляр папки
   * @param {Object} data - Данные папки
   * @param {string} data.id - Уникальный идентификатор папки
   * @param {string} data.name - Название папки
   * @param {string} data.type - Тип папки ('tariff', 'group', 'transport', etc.)
   * @param {string|null} data.parent_id - ID родительской папки (null для корневой)
   * @param {Array} [data.children=[]] - Дочерние папки
   * @param {Array} [data.vehicles=[]] - Транспортные средства в папке (для групп)
   */
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.type = data.type;
    this.parent_id = data.parent_id || null;
    this.children = data.children || [];
    this.vehicles = data.vehicles || [];
  }

  /**
   * Добавляет дочернюю папку
   * @param {Folder} folder - Папка для добавления
   */
  addChild(folder) {
    this.children.push(folder);
  }

  /**
   * Удаляет дочернюю папку по ID
   * @param {string} folderId - ID папки для удаления
   * @returns {boolean} Успешно ли удалена папка
   */
  removeChild(folderId) {
    const initialLength = this.children.length;
    this.children = this.children.filter(child => child.id !== folderId);
    return initialLength !== this.children.length;
  }

  /**
   * Добавляет транспортное средство в папку
   * @param {Object} vehicle - Транспортное средство
   */
  addVehicle(vehicle) {
    this.vehicles.push(vehicle);
  }

  /**
   * Удаляет транспортное средство из папки по ID
   * @param {string} vehicleId - ID транспортного средства
   * @returns {boolean} Успешно ли удалено транспортное средство
   */
  removeVehicle(vehicleId) {
    const initialLength = this.vehicles.length;
    this.vehicles = this.vehicles.filter(vehicle => vehicle.id !== vehicleId);
    return initialLength !== this.vehicles.length;
  }

  /**
   * Получает общее количество элементов в папке (дочерние папки + транспорт)
   * @returns {number} Количество элементов
   */
  getTotalItemsCount() {
    return this.children.length + this.vehicles.length;
  }

  /**
   * Проверяет, есть ли у папки дочерние элементы
   * @returns {boolean} Имеет ли папка дочерние элементы
   */
  hasChildren() {
    return this.children.length > 0 || this.vehicles.length > 0;
  }

  /**
   * Преобразует объект папки в строку JSON
   * @returns {string} JSON-представление папки
   */
  toJSON() {
    return JSON.stringify({
      id: this.id,
      name: this.name,
      type: this.type,
      parent_id: this.parent_id,
      children: this.children,
      vehicles: this.vehicles
    });
  }

  /**
   * Создает экземпляр папки из JSON-строки
   * @param {string} json - JSON-строка с данными папки
   * @returns {Folder} Экземпляр папки
   */
  static fromJSON(json) {
    return new Folder(JSON.parse(json));
  }
}

export default Folder; 