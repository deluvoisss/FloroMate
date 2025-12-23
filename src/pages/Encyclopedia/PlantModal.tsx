// src/pages/Encyclopedia/PlantModal.tsx
import React, { useEffect } from 'react';
import { Plant } from '../../types/plant';
import './css/PlantModal.css';

interface PlantModalProps {
  plant: Plant;
  onClose: () => void;
}

const PlantModal: React.FC<PlantModalProps> = ({ plant, onClose }) => {
  useEffect(() => {
    document.body.style.overflow = 'hidden';

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = 'auto';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const features = Array.isArray(plant.features)
    ? plant.features.filter(Boolean)
    : [];

  const dangers = Array.isArray(plant.dangers)
    ? plant.dangers.filter(Boolean)
    : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close modal">
          ×
        </button>

        <div className="modal-body">
          <div className="modal-image">
            <img
              src={plant.image || 'https://via.placeholder.com/400x300?text=No+Image'}
              alt={plant.name || 'Plant'}
            />
          </div>

          <div className="modal-info">
            <h1 className="modal-title">{plant.name || 'Unknown Plant'}</h1>
            <p className="modal-scientific">{plant.scientificName}</p>

            <div className="info-section">
              <h3 className="info-title">краткая информация о растении</h3>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Цвет:</span>
                  <span className="info-value">{plant.color || 'Не указан'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Среда обитания:</span>
                  <span className="info-value">{plant.habitat || 'Не указана'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Размер:</span>
                  <span className="info-value">{plant.size || 'Не указан'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Категория:</span>
                  <span className="info-value">
                    {plant.categoryName || plant.category || 'Не указана'}
                  </span>
                </div>
              </div>
            </div>

            <div className="info-section">
              <h3 className="info-title">Описание</h3>
              <p className="description-text">
                {plant.description || 'Информация будет дополнена'}
              </p>
            </div>

            <div className="info-section">
              <h3 className="info-title">Уход</h3>
              <div className="care-grid">
                <div className="care-item">
                  <span className="care-label">Частота полива:</span>
                  <span className="care-value">
                    {plant.care?.watering || plant.watering || 'Не указан'}
                  </span>
                </div>
                <div className="care-item">
                  <span className="care-label">Освещение:</span>
                  <span className="care-value">
                    {plant.care?.light || plant.light || 'Не указан'}
                  </span>
                </div>
                <div className="care-item">
                  <span className="care-label">Температура:</span>
                  <span className="care-value">
                    {plant.care?.temperature || plant.temperature || 'Не указана'}
                  </span>
                </div>
                <div className="care-item">
                  <span className="care-label">Влажность:</span>
                  <span className="care-value">
                    {plant.care?.humidity || plant.humidity || 'Не указана'}
                  </span>
                </div>
              </div>
            </div>

            {features.length > 0 && (
              <div className="info-section">
                <h3 className="info-title">Особенности</h3>
                <ul className="features-list">
                  {features.map((feature, index) => (
                    <li key={index} className="feature-item">
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {dangers.length > 0 && (
              <div className="info-section danger-section">
                <h3 className="info-title danger-title">Ядовитость</h3>
                <ul className="danger-list">
                  {dangers.map((danger, index) => (
                    <li key={index} className="danger-item">
                      {danger}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {plant.maintenance && (
              <div className="info-section">
                <h3 className="info-title">Обслуживание растения</h3>
                <p className="maintenance-text">{plant.maintenance}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlantModal;
