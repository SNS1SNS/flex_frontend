import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolder, faTruck, faChevronDown, faChevronRight, faTrash } from '@fortawesome/free-solid-svg-icons';

// Компонент элемента папки
const FolderTreeItem = ({ folder, onVehicleSelect, onDeleteFolder, loadVehiclesForFolder }) => {
  const [expanded, setExpanded] = useState(false);
  const [folderVehicles, setFolderVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const toggleFolder = async () => {
    if (!expanded && folderVehicles.length === 0) {
      setLoading(true);
      const vehicles = await loadVehiclesForFolder(folder.id);
      setFolderVehicles(vehicles);
      setLoading(false);
    }
    setExpanded(!expanded);
  };
  
  return (
    <div className={`folder-item ${folder.type}-folder`} data-folder-id={folder.id}>
      <div className="folder-header" onClick={toggleFolder}>
        <div className="folder-checkbox">
          <input type="checkbox" id={`folder-${folder.id}-check`} onClick={e => e.stopPropagation()} />
        </div>
        <div className="folder-icon">
          <FontAwesomeIcon icon={faFolder} />
        </div>
        <div className="folder-name">{folder.name}</div>
        <div className="folder-count">{folder.vehicles_count || 0}</div>
        <div className="folder-toggle">
          <FontAwesomeIcon icon={expanded ? faChevronDown : faChevronRight} />
        </div>
        <div className="folder-actions">
          <button className="folder-delete-btn" onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Вы уверены, что хотите удалить эту папку?')) {
              onDeleteFolder(folder.id);
            }
          }}>
            <FontAwesomeIcon icon={faTrash} />
          </button>
        </div>
      </div>
      
      {expanded && (
        <div className="subfolder-container" style={{ display: expanded ? 'block' : 'none' }}>
          {loading ? (
            <div className="loading-message">Загрузка...</div>
          ) : folderVehicles.length > 0 ? (
            folderVehicles.map(vehicle => (
              <div 
                className="folder-item vehicle-item" 
                key={vehicle.id} 
                data-vehicle-id={vehicle.id}
                onClick={() => onVehicleSelect(vehicle)}
              >
                <div className="folder-header">
                  <div className="folder-checkbox">
                    <input type="checkbox" id={`vehicle-${vehicle.id}-check`} onClick={e => e.stopPropagation()} />
                  </div>
                  <div className="folder-icon">
                    <FontAwesomeIcon icon={faTruck} />
                  </div>
                  <div className="folder-name">
                    {vehicle.name} ({vehicle.license_plate || vehicle.number || 'б/н'})
                  </div>
                  <div className={`folder-status ${vehicle.status || 'unknown'}`}></div>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-folder-message">В этой папке нет транспортных средств</div>
          )}
        </div>
      )}
    </div>
  );
};

// Основной компонент дерева папок
const FolderTree = ({ folders, onVehicleSelect, onDeleteFolder, loadVehiclesForFolder }) => {
  return (
    <div className="folder-list">
      {folders.map(folder => (
        <FolderTreeItem 
          key={folder.id}
          folder={folder}
          onVehicleSelect={onVehicleSelect}
          onDeleteFolder={onDeleteFolder}
          loadVehiclesForFolder={loadVehiclesForFolder}
        />
      ))}
    </div>
  );
};

export default FolderTree; 