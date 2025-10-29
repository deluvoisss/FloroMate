import React, { useState } from 'react';
import { Plant, Filters, FilterType } from '../../types/plant';
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
}

const FilterSidebar: React.FC<FilterSidebarProps> = ({
  filters,
  onFilterChange,
  onReset,
  isOpen,
  onToggle,
  onSearch
}) => {
  const [searchInput, setSearchInput] = useState<string>('');

  const colorOptions: ColorOption[] = [
    { value: 'green', label: 'Зеленые', icon: '🟢' },
    { value: 'purple', label: 'Фиолетовые', icon: '🟣' },
    { value: 'red', label: 'Красные', icon: '🔴' },
    { value: 'yellow', label: 'Желтые', icon: '🟡' },
    { value: 'white', label: 'Белые', icon: '⚪' }
  ];

  const habitatOptions: HabitatOption[] = [
    { value: 'indoor', label: 'Комнатные', icon: '🏠' },
    { value: 'garden', label: 'Садовые', icon: '🌳' },
    { value: 'tropical', label: 'Тропические', icon: '🌴' },
    { value: 'desert', label: 'Пустынные', icon: '🏜️' }
  ];

  const sizeOptions: SizeOption[] = [
    { value: 'small', label: 'Маленькие', prefix: 'S' },
    { value: 'medium', label: 'Средние', prefix: 'M' },
    { value: 'large', label: 'Большие', prefix: 'L' }
  ];

  const hasActiveFilters: boolean =
    filters.colors.length > 0 ||
    filters.habitats.length > 0 ||
    filters.sizes.length > 0;

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchInput);
    }
  };

  return (
    <aside className={`filter-sidebar ${isOpen ? 'open' : 'closed'}`}>
      <div className="sidebar-content">
        {isOpen ? (
          <>
            <div className="sidebar-header">
              <h2>🔍 Фильтры</h2>
              <button
                className="sidebar-close-btn"
                onClick={onToggle}
                aria-label="Закрыть"
              >
                ✕
              </button>
            </div>

            {onSearch && (
              <form onSubmit={handleSearch} className="search-form">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Поиск растений..."
                  className="search-input"
                />
                <button type="submit" className="search-btn">🔍</button>
              </form>
            )}

            {hasActiveFilters && (
              <button className="clear-all-btn" onClick={onReset}>
                <span className="btn-icon">🔄</span>
                <span className="btn-text">Сбросить все</span>
              </button>
            )}

            <div className="filter-group">
              <h3 className="filter-title">
                <span className="filter-icon">🌸</span>
                ЦВЕТ
              </h3>
              <div className="filter-options">
                {colorOptions.map((option: ColorOption) => (
                  <button
                    key={option.value}
                    className={`filter-option ${
                      filters.colors.includes(option.value) ? 'active' : ''
                    }`}
                    onClick={() => onFilterChange('colors', option.value)}
                    title={option.label}
                  >
                    <span className="option-icon">{option.icon}</span>
                    <span className="option-label">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <h3 className="filter-title">
                <span className="filter-icon">🌍</span>
                СРЕДА ОБИТАНИЯ
              </h3>
              <div className="filter-options">
                {habitatOptions.map((option: HabitatOption) => (
                  <button
                    key={option.value}
                    className={`filter-option ${
                      filters.habitats.includes(option.value) ? 'active' : ''
                    }`}
                    onClick={() => onFilterChange('habitats', option.value)}
                    title={option.label}
                  >
                    <span className="option-icon">{option.icon}</span>
                    <span className="option-label">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <h3 className="filter-title">
                <span className="filter-icon">📏</span>
                РАЗМЕР
              </h3>
              <div className="filter-options">
                {sizeOptions.map((option: SizeOption) => (
                  <button
                    key={option.value}
                    className={`filter-option ${
                      filters.sizes.includes(option.value) ? 'active' : ''
                    }`}
                    onClick={() => onFilterChange('sizes', option.value)}
                    title={option.label}
                  >
                    <span className="option-prefix">{option.prefix}</span>
                    <span className="option-label">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="sidebar-compact">
            <button
              className="compact-open-btn"
              onClick={onToggle}
              aria-label="Открыть фильтры"
              title="Открыть фильтры"
            >
              ☰
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

export default FilterSidebar;
