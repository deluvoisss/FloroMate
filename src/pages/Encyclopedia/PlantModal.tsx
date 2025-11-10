import React, { useEffect } from 'react';
import { Plant, Filters, FilterType } from '../../types/plant';
import './css/PlantModal.css';

interface PlantModalProps {
  plant: Plant;
  onClose: () => void;
}

const PlantModal: React.FC<PlantModalProps> = ({ plant, onClose }) => {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Закрыть">
          ✕
        </button>

        <div className="modal-body">
          <div className="modal-image">
            <img src={plant.image} alt={plant.name} />
          </div>

          <div className="modal-info">
            <h1 className="modal-title">{plant.name}</h1>
            <p className="modal-scientific">{plant.scientificName}</p>

            <div className="info-section">
              <h3 className="info-title">ℹ️ Основная информация</h3>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Цвет:</span>
                  <span className="info-value">{plant.color}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Среда обитания:</span>
                  <span className="info-value">{plant.habitat}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Размер:</span>
                  <span className="info-value">{plant.size}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Категория:</span>
                  <span className="info-value">{plant.categoryName}</span>
                </div>
              </div>
            </div>

            <div className="info-section">
              <h3 className="info-title">📝 Описание</h3>
              <p className="description-text">{plant.description}</p>
            </div>

            <div className="info-section">
              <h3 className="info-title">🌱 Уход</h3>
              <div className="care-grid">
                <div className="care-item">
                  <span className="care-label">💧 Полив:</span>
                  <span className="care-value">{plant.care.watering}</span>
                </div>
                <div className="care-item">
                  <span className="care-label">☀️ Свет:</span>
                  <span className="care-value">{plant.care.light}</span>
                </div>
                <div className="care-item">
                  <span className="care-label">🌡️ Температура:</span>
                  <span className="care-value">{plant.care.temperature}</span>
                </div>
                <div className="care-item">
                  <span className="care-label">💨 Влажность:</span>
                  <span className="care-value">{plant.care.humidity}</span>
                </div>
              </div>
            </div>

            {plant.features && plant.features.length > 0 && (
              <div className="info-section">
                <h3 className="info-title">✨ Особенности</h3>
                <ul className="features-list">
                  {plant.features.map((feature: string, index: number) => (
                    <li key={index} className="feature-item">
                      <span className="checkmark">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {plant.dangers && plant.dangers.length > 0 && (
              <div className="info-section">
                <h3 className="info-title danger-title">⚠️ Опасность</h3>
                <ul className="danger-list">
                  {plant.dangers.map((danger: string, index: number) => (
                    <li key={index} className="danger-item">
                      {danger}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {plant.maintenance && (
              <div className="info-section">
                <h3 className="info-title">🔧 Обслуживание</h3>
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
