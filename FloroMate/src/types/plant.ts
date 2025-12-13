export interface PlantCare {
  watering: string;
  light: string;
  temperature: string;
  humidity: string;
}

export interface Plant {
  id: number;
  name: string;
  scientificName: string;
  image: string;
  color: string;
  habitat: string;
  size: string;
  category: string;
  categoryName: string;
  description: string;
  care: PlantCare;
  features: string[];
  dangers: string[];
  maintenance: string;
}

export interface Filters {
  colors: string[];
  habitats: string[];
  sizes: string[];
}

export type FilterType = 'colors' | 'habitats' | 'sizes';
