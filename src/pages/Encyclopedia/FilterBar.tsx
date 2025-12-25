import React, { useState } from 'react';
import { Filters, FilterType } from '../../types/plant';
import './css/FilterBar.css';

interface FilterOption {
  value: string;
  label: string;
}

interface ColorOption extends FilterOption {
  icon: string;
}

interface HabitatOption extends FilterOption {
  icon: string;
}

interface SizeOption extends FilterOption {
  prefix: string;
}

interface FilterSidebarProps {
  filters: Filters;
  onFilterChange: (filterType: FilterType, value: string) => void;
  onReset: () => void;
  isOpen: boolean;
  onToggle: () => void;
  onSearch?: (query: string) => void;
  availableColors: string[];
  availableHabitats: string[];  // ← НОВОЕ
  availableSizes: string[];     // ← НОВОЕ
}

const FilterSidebar: React.FC<FilterSidebarProps> = ({
  filters,
  onFilterChange,
  onReset,
  isOpen,
  onToggle,
  onSearch,
  availableColors,
  availableHabitats, // ← НОВОЕ
  availableSizes      // ← НОВОЕ
}) => {
  const [searchInput, setSearchInput] = useState('');

  const getColorLabel = (color: string): string => {
    const labels: Record<string, string> = {
      'зеленый': 'Зеленый', 'красный': 'Красный', 'фиолетовый': 'Фиолетовый',
      'желтый': 'Желтый', 'белый': 'Белый', 'розовый': 'Розовый',
      'оранжевый': 'Оранжевый', 'синий': 'Синий'
    };
    return labels[color] || color.charAt(0).toUpperCase() + color.slice(1);
  };

  const getHabitatLabel = (habitat: string): string => {
    const labels: Record<string, string> = {
      'комнатное': 'Комнатные',
      'уличное': 'Садовые',
      'водное': 'Водные'
    };
    return labels[habitat] || habitat.charAt(0).toUpperCase() + habitat.slice(1);
  };

  const getHabitatIcon = (habitat: string): string => {
    const icons: Record<string, string> = {
      'комнатное': '🏠',
      'уличное': '🌳',
      'водное': '💧'
    };
    return icons[habitat] || '🌿';
  };

  const getSizeLabel = (size: string): string => {
    const labels: Record<string, string> = {
      'маленькое': 'Маленькие',
      'среднее': 'Средние',
      'большое': 'Большие'
    };
    return labels[size] || size.charAt(0).toUpperCase() + size.slice(1);
  };

  const getSizeIcon = (size: string): string => {
    const icons: Record<string, string> = {
      'маленькое': '🌱',
      'среднее': '🌿',
      'большое': '🌳'
    };
    return icons[size] || '📏';
  };

  const colorOptions: ColorOption[] = availableColors
  .map(color => ({
    value: color,
    label: getColorLabel(color),
    icon: '🌿' // ← ДОБАВЛЕН icon[file:4]
  }))
  .filter(option => option.value);

  const habitatOptions: HabitatOption[] = availableHabitats
    .map(habitat => ({
      value: habitat,
      label: getHabitatLabel(habitat),
      icon: getHabitatIcon(habitat)
    }))
    .filter(option => option.value);

  // ✅ НОВОЕ: динамические size опции
  const sizeOptions: SizeOption[] = availableSizes
    .map(size => ({
      value: size,
      label: getSizeLabel(size),
      prefix: getSizeIcon(size)
    }))
    .filter(option => option.value);

  const hasActiveFilters: boolean =
    filters.colors.length > 0 ||
    filters.habitats.length > 0 ||
    filters.sizes.length > 0;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchInput);
    }
  };

  return (
    <aside className={`filter-sidebar ${!isOpen ? 'closed' : ''}`}>
      {isOpen ? (
        <div className="sidebar-content">
          <div className="sidebar-header">
            <h2>🌿 Фильтры</h2>
            <button 
              className="toggle-filters-btn" 
              onClick={onToggle}
              aria-label="Скрыть фильтры"
              title="Скрыть фильтры"
            >
              ◀
            </button>
          </div>

          <form className="search-form" onSubmit={handleSearch}>
            <input
              type="text"
              className="search-input"
              placeholder="Поиск растений..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <button type="submit" className="search-btn" aria-label="Искать">
              🔍
            </button>
          </form>

          {hasActiveFilters && (
            <button className="clear-all-btn" onClick={onReset}>
              <span>🗑️</span>
              <span>Сбросить все</span>
            </button>
          )}

          {/* Цвета */}
          {colorOptions.length > 0 && (
            <div className="filter-group">
              <h3 className="filter-title">
                <span className="filter-icon">🎨</span>
                Цвет
              </h3>
              <div className="filter-options">
                {colorOptions.map((option) => (
                  <div
                    key={option.value}
                    className={`filter-option ${
                      filters.colors.includes(option.value) ? 'active' : ''
                    }`}
                    onClick={() => onFilterChange('colors', option.value)}
                  >
                    <span className="option-icon">{option.icon}</span>
                    <span>{option.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Место обитания */}
          {habitatOptions.length > 0 && (
            <div className="filter-group">
              <h3 className="filter-title">
                <span className="filter-icon">🌍</span>
                Место
              </h3>
              <div className="filter-options">
                {habitatOptions.map((option) => (
                  <div
                    key={option.value}
                    className={`filter-option ${
                      filters.habitats.includes(option.value) ? 'active' : ''
                    }`}
                    onClick={() => onFilterChange('habitats', option.value)}
                  >
                    <span className="option-icon">{option.icon}</span>
                    <span>{option.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Размер */}
          {sizeOptions.length > 0 && (
            <div className="filter-group">
              <h3 className="filter-title">
                <span className="filter-icon">📏</span>
                Размер
              </h3>
              <div className="filter-options">
                {sizeOptions.map((option) => (
                  <div
                    key={option.value}
                    className={`filter-option ${
                      filters.sizes.includes(option.value) ? 'active' : ''
                    }`}
                    onClick={() => onFilterChange('sizes', option.value)}
                  >
                    <span className="option-icon">{option.prefix}</span>
                    <span>{option.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="sidebar-compact">
          <button 
            className="compact-open-btn" 
            onClick={onToggle}
            aria-label="Показать фильтры"
            title="Показать фильтры"
          >
            ▶
          </button>
        </div>
      )}
    </aside>
  );
};

export default FilterSidebar;
