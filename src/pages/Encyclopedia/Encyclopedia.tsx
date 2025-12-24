import React, { useState, useEffect } from 'react';
import PlantCard from './PlantCard';
import PlantModal from './PlantModal';
import FilterSidebar from './FilterBar';
import ChatAssistant from '../../components/ChatAssistant/ChatAssistant';
import plantApiService from './plantApi';
import { Plant, Filters, FilterType } from '../../types/plant';
import './css/Encyclopedia.css';

const Encyclopedia: React.FC = () => {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null);
  const [filters, setFilters] = useState<Filters>({
    colors: [],
    habitats: [],
    sizes: []
  });
  const [availableColors, setAvailableColors] = useState<string[]>([]); // НОВОЕ
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadPlants = async () => {
    try {
      setLoading(true);
      setError(null);
  
      if (searchQuery.trim()) {
        const searchResult = await plantApiService.searchPlants(searchQuery);
        console.log('🌿 SEARCH plants:', searchResult);
        setPlants(searchResult || []);
        setTotalPages(1);
        setAvailableColors([...new Set((searchResult || []).map((p: Plant) => p.color).filter(Boolean))]);
      } else {
        const result = await plantApiService.fetchPlants(filters, currentPage);
        console.log('🌿 API plants:', result.plants);
        console.log('🌿 Total pages:', result.totalPages);
        setPlants(result.plants || []);
        setTotalPages(result.totalPages || 1);
        setAvailableColors([...new Set((result.plants || []).map((p: Plant) => p.color).filter(Boolean))]);
      }
    } catch (err) {
      console.error('❌ Error loading plants:', err);
      const errorMessage = err instanceof Error ? err.message : 'Ошибка загрузки данных';
      setError(`Ошибка загрузки данных: ${errorMessage}`);
      setPlants([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlants();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, currentPage, searchQuery]);
  

  const filteredPlants = plants.filter(plant => {
    const colorMatch = filters.colors.length === 0 || filters.colors.includes(plant.color);
    const habitatMatch = filters.habitats.length === 0 || filters.habitats.includes(plant.habitat);
    const sizeMatch = filters.sizes.length === 0 || filters.sizes.includes(plant.size);
    
    return colorMatch && habitatMatch && sizeMatch;
  });

  const handleFilterChange = (filterType: FilterType, value: string) => {
    setFilters((prev) => {
      const currentFilters = prev[filterType];
      const newFilters = currentFilters.includes(value)
        ? currentFilters.filter((f: string) => f !== value)
        : [...currentFilters, value];
      return {
        ...prev,
        [filterType]: newFilters
      };
    });
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setFilters({
      colors: [],
      habitats: [],
      sizes: []
    });
    setSearchQuery('');
    setCurrentPage(1);
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  return (
    <div className="encyclopedia-page">
      <button className="sidebar-toggle-mobile" onClick={toggleSidebar}>
        {sidebarOpen ? '✕ Скрыть' : '☰ Фильтры'}
      </button>

      <FilterSidebar
        filters={filters}
        availableColors={availableColors} // ПЕРЕДАЕМ динамические цвета
        onFilterChange={handleFilterChange}
        onReset={resetFilters}
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
        onSearch={handleSearch}
      />

      <div className={`encyclopedia-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        {loading && (
          <div className="encyclopedia-loading">
            <p>⏳ Загрузка растений...</p>
          </div>
        )}

        {error && !loading && (
          <div className="encyclopedia-error">
            <h2>❌ {error}</h2>
            <button onClick={loadPlants}>Попробовать снова</button>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="results-header">
              <h2>Энциклопедия растений</h2>
              <p>Показано на странице: <strong>{filteredPlants.length}</strong> растений</p>
            </div>

            {filteredPlants.length === 0 && (
              <p className="no-results">
                🔍 Попробуйте изменить параметры фильтров
              </p>
            )}

            {filteredPlants.length > 0 && (
              <div className="plants-grid">
                {filteredPlants.map((plant: Plant) => (
                  <PlantCard
                    key={plant.id}
                    plant={plant}
                    onClick={() => setSelectedPlant(plant)}
                  />
                ))}
              </div>
            )}

            {totalPages > 1 && filteredPlants.length > 0 && (
              <div className="pagination">
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  ← Назад
                </button>
                <span className="pagination-info">
                  Страница <strong>{currentPage}</strong> из <strong>{totalPages}</strong>
                </span>
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  Вперед →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {selectedPlant && (
        <PlantModal
          plant={selectedPlant}
          onClose={() => setSelectedPlant(null)}
        />
      )}

      <ChatAssistant />
    </div>
  );
};

export default Encyclopedia;
