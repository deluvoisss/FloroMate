export type SubscriptionType = 'free' | 'pro' | 'pro_ultra';

// Интерфейс для features (без dailyRequests)
interface SubscriptionFeatures {
  encyclopedia: boolean;
  aiAssistant: boolean;
  diseaseDetection: boolean;
  plantRecognition: boolean;
  landscapeConstructor: boolean;
  landscapeDesigner: boolean;
  personalGarden: boolean;
}

// Полный интерфейс с dailyRequests
interface SubscriptionConfig extends SubscriptionFeatures {
  dailyRequests: number;
}

export const SUBSCRIPTION_FEATURES: Record<SubscriptionType, SubscriptionConfig> = {
  free: {
    encyclopedia: true,
    aiAssistant: true,
    diseaseDetection: false,
    plantRecognition: false,
    landscapeConstructor: false,
    landscapeDesigner: false,
    personalGarden: false,
    dailyRequests: 3,
  },
  pro: {
    encyclopedia: true,
    aiAssistant: true,
    diseaseDetection: true,
    plantRecognition: true,
    landscapeConstructor: false,
    landscapeDesigner: false,
    personalGarden: false,
    dailyRequests: 10,
  },
  pro_ultra: {
    encyclopedia: true,
    aiAssistant: true,
    diseaseDetection: true,
    plantRecognition: true,
    landscapeConstructor: true,
    landscapeDesigner: true,
    personalGarden: true,
    dailyRequests: 30,
  },
};

// Проверка доступа к функции (только boolean поля)
export const hasAccess = (
  userSubscription: SubscriptionType,
  feature: keyof SubscriptionFeatures // ← Теперь только boolean поля
): boolean => {
  return SUBSCRIPTION_FEATURES[userSubscription][feature] as boolean;
};

export const getRequiredSubscription = (feature: string): SubscriptionType | null => {
  if (feature === 'diseaseDetection' || feature === 'plantRecognition') return 'pro';
  if (feature === 'landscapeConstructor' || feature === 'landscapeDesigner' || feature === 'personalGarden') {
    return 'pro_ultra';
  }
  return null;
};
