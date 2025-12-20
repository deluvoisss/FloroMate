import React, { useEffect } from 'react';
import Plant from '../types/plant'; // Подкорректируйте путь под ваш проект
import './css/PlantModal.css';

interface PlantModalProps {
  plant: Plant;
  onClose: () => void;
}

const PlantModal: React.FC<PlantModalProps> = ({ plant, onClose }) => {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = 'auto';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const features = Array.isArray(plant.features)
    ? plant.features
    : typeof plant.features === 'string'
    ? [plant.features]
    : [];

  const dangers = Array.isArray(plant.dangers)
    ? plant.dangers
    : typeof plant.dangers === 'string'
    ? [plant.dangers]
    : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close modal">
          &times;
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
            <p className="modal-scientific">{plant.scientificName || ''}</p>

            <div className="info-section">
              <h3 className="info-title">Plant Details</h3>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Color: </span>
                  <span className="info-value">{plant.color || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Habitat: </span>
                  <span className="info-value">{plant.habitat || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Size: </span>
                  <span className="info-value">{plant.size || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Category: </span>
                  <span className="info-value">{plant.categoryName || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="info-section">
              <h3 className="info-title">Description</h3>
              <p className="description-text">{plant.description || 'No description available.'}</p>
            </div>

            {plant.care && (
              <div className="info-section">
                <h3 className="info-title">Care</h3>
                <div className="care-grid">
                  <div className="care-item">
                    <span className="care-label">Watering: </span>
                    <span className="care-value">{plant.care.watering || 'N/A'}</span>
                  </div>
                  <div className="care-item">
                    <span className="care-label">Light: </span>
                    <span className="care-value">{plant.care.light || 'N/A'}</span>
                  </div>
                  <div className="care-item">
                    <span className="care-label">Temperature: </span>
                    <span className="care-value">{plant.care.temperature || 'N/A'}</span>
                  </div>
                  <div className="care-item">
                    <span className="care-label">Humidity: </span>
                    <span className="care-value">{plant.care.humidity || 'N/A'}</span>
                  </div>
                </div>
              </div>
            )}

            {features.length > 0 && (
              <div className="info-section">
                <h3 className="info-title">Features</h3>
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
                <h3 className="info-title danger-title">Dangers</h3>
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
                <h3 className="info-title">Maintenance</h3>
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
