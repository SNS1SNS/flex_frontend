/**
 * Модель транспортного средства
 */
class Vehicle {
  /**
   * Создает новый экземпляр транспортного средства
   * @param {Object} data - Данные транспортного средства
   * @param {string} data.id - Уникальный идентификатор ТС
   * @param {string} data.name - Название ТС
   * @param {string} [data.imei=''] - IMEI устройства
   * @param {string|null} [data.group_id=null] - ID группы, к которой принадлежит ТС
   * @param {Object} [data.metadata={}] - Дополнительные данные ТС
   */
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.imei = data.imei || '';
    this.group_id = data.group_id || null;
    this.metadata = data.metadata || {};
  }

  /**
   * Проверяет, имеет ли ТС установленный IMEI
   * @returns {boolean} Установлен ли IMEI
   */
  hasImei() {
    return !!this.imei && this.imei.trim() !== '';
  }

  /**
   * Проверяет, принадлежит ли ТС к группе
   * @returns {boolean} Принадлежит ли ТС к группе
   */
  hasGroup() {
    return !!this.group_id;
  }

  /**
   * Устанавливает группу для ТС
   * @param {string} groupId - ID группы
   */
  setGroup(groupId) {
    this.group_id = groupId;
  }

  /**
   * Удаляет ТС из группы
   */
  removeFromGroup() {
    this.group_id = null;
  }

  /**
   * Преобразует объект ТС в строку JSON
   * @returns {string} JSON-представление ТС
   */
  toJSON() {
    return JSON.stringify({
      id: this.id,
      name: this.name,
      imei: this.imei,
      group_id: this.group_id,
      metadata: this.metadata
    });
  }

  /**
   * Создает экземпляр ТС из JSON-строки
   * @param {string} json - JSON-строка с данными ТС
   * @returns {Vehicle} Экземпляр ТС
   */
  static fromJSON(json) {
    return new Vehicle(JSON.parse(json));
  }

  /**
   * Преобразует данные ТС для отображения в списке
   * @returns {Object} Данные для отображения
   */
  toDisplayData() {
    return {
      id: this.id,
      name: this.name,
      imei: this.imei || 'Не установлен',
      group: this.group_id ? 'Есть группа' : 'Без группы',
      type: 'transport'
    };
  }
}

export default Vehicle; 