import { Plant, Filters } from '../../types/plant';

const API_BASE_URL = 'http://localhost:3001/api';

interface FetchPlantsResult {
  plants: Plant[];
  totalPages: number;
}

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

export const addRecognizedPlant = async (plantData: {
  scientificName: string;
  genus?: string;
  family?: string;
  confidence?: number;
}): Promise<any> => {
  try {
    const response = await fetch(`${API_BASE_URL}/plants/recognize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(plantData),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error adding recognized plant:', error);
    throw error;
  }
};

export default {
  fetchPlants,
  fetchPlantDetails,
  searchPlants,
  addRecognizedPlant
};
