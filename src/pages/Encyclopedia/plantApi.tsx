import { Plant, Filters, FilterType } from '../../types/plant';
import plantsData from './plantsData';

interface FetchPlantsResult {
  plants: Plant[];
  totalPages: number;
}

function filterPlants(filters: Filters, data: Plant[] = plantsData): Plant[] {
  let filtered = data;
  
  if (filters.colors && filters.colors.length > 0) {
    filtered = filtered.filter((plant: Plant) => filters.colors.includes(plant.color));
  }
  
  if (filters.habitats && filters.habitats.length > 0) {
    filtered = filtered.filter((plant: Plant) => filters.habitats.includes(plant.habitat));
  }
  
  if (filters.sizes && filters.sizes.length > 0) {
    filtered = filtered.filter((plant: Plant) => filters.sizes.includes(plant.size));
  }
  
  return filtered;
}

export const fetchPlants = async (filters: Filters, page: number = 1): Promise<FetchPlantsResult> => {
  await new Promise(resolve => setTimeout(resolve, 200));
  
  const filtered = filterPlants(filters);
  const pageSize = 12;
  const totalPages = Math.ceil(filtered.length / pageSize);
  const start = (page - 1) * pageSize;
  const paginatedPlants = filtered.slice(start, start + pageSize);
  
  return { plants: paginatedPlants, totalPages };
};

export const fetchPlantDetails = async (plantId: number | string): Promise<Plant> => {
  await new Promise(resolve => setTimeout(resolve, 200));
  
  const plant = plantsData.find(p => String(p.id) === String(plantId));
  if (!plant) throw new Error('Растение не найдено');
  
  return plant;
};

export const searchPlants = async (query: string): Promise<Plant[]> => {
  await new Promise(resolve => setTimeout(resolve, 200));
  
  if (!query) return plantsData;
  
  const searchLower = query.trim().toLowerCase();
  return plantsData.filter(plant =>
    plant.name.toLowerCase().includes(searchLower) ||
    plant.scientificName.toLowerCase().includes(searchLower)
  );
};

export default {
  fetchPlants,
  fetchPlantDetails,
  searchPlants
};
