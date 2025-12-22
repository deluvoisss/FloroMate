import React from 'react';
import { Plant } from '../../types/plant';
import './css/PlantCard.css';

interface PlantCardProps {
  plant: Plant;
  onClick: () => void;
}

const getSizeLabel = (size: string): string => {
  const labels: Record<string, string> = {
    small: 'Маленькое',
    medium: 'Среднее',
    large: 'Большое',
  };
  return labels[size] || size;
};

const getHabitatLabel = (habitat: string): string => {
  const labels: Record<string, string> = {
    indoor: 'Комнатное',
    garden: 'Садовое',
    tropical: 'Тропическое',
    desert: 'Пустынное',
  };
  return labels[habitat] || habitat;
};

const PlantCard: React.FC<PlantCardProps> = ({ plant, onClick }) => {
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const img = e.target as HTMLImageElement;
    img.src = 'https://images.unsplash.com/photo-1466781783364-36c955e42a7f?w=500'; // fallback
  };

  return (
    <div className="plant-card" onClick={onClick}>
      <div className="card-image-wrapper">
        <img 
          src={plant.image || 'https://via.placeholder.com/400x300?text=No+Image'} 
          alt={plant.name || 'Plant'} 
          className="card-image" 
          loading="lazy"
          onError={handleImageError}
        />
        {plant.isRecognized && (
          <span className="recognized-badge">!</span>
        )}
        <div className="card-overlay">
          <button className="details-btn">Подробнее</button>
        </div>
      </div>
      <div className="card-content">
        <div className="plant-name-wrapper">
          <h3 className="plant-name">{plant.name || 'Неизвестное растение'}</h3>
          <p className="scientific-name">{plant.scientificName || ''}</p>
        </div>
        <div className="card-tags">
          <span className="tag tag-size">{getSizeLabel(plant.size || '')}</span>
          <span className="tag tag-habitat">{getHabitatLabel(plant.habitat || '')}</span>
        </div>
        <p className="plant-description">
          {plant.description || 'Описание недоступно'}
        </p>
      </div>
    </div>
  );
};

export default PlantCard;
