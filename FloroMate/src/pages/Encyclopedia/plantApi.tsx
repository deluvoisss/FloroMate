import { Plant, Filters } from '../../types/plant';

const API_BASE_URL = 'http://localhost:3001/api';

interface FetchPlantsResult {
  plants: Plant[];
  totalPages: number;
}

// Получить фото через серверный прокси Perenual
export const fetchPlantImage = async (scientificName: string): Promise<string> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/plants/photo?scientificName=${encodeURIComponent(scientificName)}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return data.image;
  } catch (error) {
    console.error('Plant photo fetch error:', error);
    return 'https://via.placeholder.com/400x300?text=Фото+отсутствует';
  }
};

// GigaChat заполняет ВСЕ данные
export const enrichPlantData = async (scientificName: string): Promise<any> => {
  try {
    const response = await fetch(`${API_BASE_URL}/plants/enrich`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scientificName })
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Enrich error:', error);
    return null;
  }
};

export const fetchPlants = async (filters: Filters, page: number = 1): Promise<FetchPlantsResult> => {
  try {
    const params = new URLSearchParams();
    
    if (filters.colors && filters.colors.length > 0) {
      params.append('colors', filters.colors.join(','));
    }
    if (filters.habitats && filters.habitats.length > 0) {
      params.append('habitats', filters.habitats.join(','));
    }
    if (filters.sizes && filters.sizes.length > 0) {
      params.append('sizes', filters.sizes.join(','));
    }
    
    params.append('page', page.toString());
    params.append('limit', '12');
    
    const response = await fetch(`${API_BASE_URL}/plants?${params}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return { plants: data.plants, totalPages: data.totalPages };
  } catch (error) {
    console.error('Error fetching plants:', error);
    throw error;
  }
};

export const fetchPlantDetails = async (plantId: number | string): Promise<Plant> => {
  try {
    const response = await fetch(`${API_BASE_URL}/plants/${plantId}`);
    
    if (!response.ok) {
      throw new Error('Plant not found');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching plant details:', error);
    throw error;
  }
};

export const searchPlants = async (query: string): Promise<Plant[]> => {
  try {
    if (!query.trim()) {
      const result = await fetchPlants({colors: [], habitats: [], sizes: []}, 1);
      return result.plants;
    }
    
    const response = await fetch(`${API_BASE_URL}/plants/search?query=${encodeURIComponent(query)}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error searching plants:', error);
    throw error;
  }
};

// ✅ ПОЛНАЯ ФУНКЦИЯ: Perenual (фото) + GigaChat (все данные) + База
export const addRecognizedPlant = async (plantData: {
  scientificName: string;
  genus?: string;
  family?: string;
  confidence?: number;
}): Promise<any> => {
  try {
    console.log('🚀 Auto-filling FULL plant data for:', plantData.scientificName);
    
    // 1. Фото из Perenual
    const imageUrl = await fetchPlantImage(plantData.scientificName);
    
    // 2. GigaChat заполняет ВСЕ остальные поля
    const enrichedData = await enrichPlantData(plantData.scientificName);
    
    // 3. Формируем ПОЛНОЕ растение
    const fullPlantData = {
      ...plantData,
      image: imageUrl,
      // ✅ Все данные из GigaChat (если есть)
      ...(enrichedData?.data || {}),
      // Fallback значения
      color: enrichedData?.data?.color || 'green',
      habitat: enrichedData?.data?.habitat || 'indoor',
      size: enrichedData?.data?.size || 'medium',
      category: enrichedData?.data?.category || 'foliage',
      categoryName: enrichedData?.data?.categoryName || 'Декоративное',
      description: enrichedData?.data?.description || 'Информация будет дополнена',
      care: enrichedData?.data?.care || {
        watering: 'умеренный',
        light: 'рассеянный',
        temperature: '18-25°C',
        humidity: '50-70%'
      },
      features: enrichedData?.data?.features || [],
      dangers: enrichedData?.data?.dangers || 'не ядовитое',
      maintenance: enrichedData?.data?.maintenance || 'средний',
    };

    console.log('📋 Full plant data prepared:', {
      name: fullPlantData.name || fullPlantData.scientificName,
      image: fullPlantData.image,
      color: fullPlantData.color,
      habitat: fullPlantData.habitat
    });

    // 4. Отправляем ПОЛНОЕ растение на сервер
    const response = await fetch(`${API_BASE_URL}/plants/recognize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullPlantData),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('✅ FULL Plant added to DB:', result.plant?.name || plantData.scientificName);
    return result;
  } catch (error) {
    console.error('❌ Error adding full plant:', error);
    throw error;
  }
};

export default {
  fetchPlants,
  fetchPlantDetails,
  searchPlants,
  addRecognizedPlant,
  fetchPlantImage,
  enrichPlantData
};
