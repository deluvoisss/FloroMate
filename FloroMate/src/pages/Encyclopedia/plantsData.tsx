import { Plant, Filters, FilterType } from '../../types/plant';

const plantsData: Plant[] = [
  {
    id: 1,
    name: 'Монстера',
    scientificName: 'Monstera deliciosa',
    image: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=500',
    color: 'green',
    habitat: 'indoor',
    size: 'large',
    category: 'foliage',
    categoryName: 'Декоративно-лиственные',
    description: 'Эффектное тропическое растение с крупными резными листьями. Идеально для создания джунглей в доме.',
    care: {
      watering: 'Умеренный, 1-2 раза в неделю',
      light: 'Яркий рассеянный свет',
      temperature: '18-27°C',
      humidity: 'Высокая 60-80%'
    },
    features: [
      'Быстрый рост',
      'Очищает воздух',
      'Неприхотливое',
      'Красивые листья'
    ],
    dangers: [
      'Токсично для животных',
      'Сок может вызвать раздражение'
    ],
    maintenance: 'Регулярное опрыскивание листьев и протирание от пыли'
  },
  {
    id: 2,
    name: 'Фикус',
    scientificName: 'Ficus elastica',
    image: 'https://images.unsplash.com/photo-1593482892290-f54927ae1bb6?w=500',
    color: 'green',
    habitat: 'indoor',
    size: 'medium',
    category: 'foliage',
    categoryName: 'Декоративно-лиственные',
    description: 'Классическое комнатное растение с глянцевыми листьями. Символ домашнего уюта.',
    care: {
      watering: 'Умеренный, когда верхний слой почвы подсохнет',
      light: 'Яркий рассеянный свет',
      temperature: '16-24°C',
      humidity: 'Средняя 40-60%'
    },
    features: [
      'Очищает воздух',
      'Долговечное',
      'Легко размножается',
      'Адаптивное'
    ],
    dangers: [
      'Млечный сок может вызвать аллергию'
    ],
    maintenance: 'Протирание листьев влажной тканью раз в неделю'
  },
  {
    id: 3,
    name: 'Роза садовая',
    scientificName: 'Rosa',
    image: 'https://images.unsplash.com/photo-1518709594023-6eab9bab7b23?w=500',
    color: 'red',
    habitat: 'garden',
    size: 'medium',
    category: 'flowering',
    categoryName: 'Цветущие',
    description: 'Королева сада с роскошными ароматными цветами. Требует внимания, но вознаграждает красотой.',
    care: {
      watering: 'Обильный, особенно в период цветения',
      light: 'Прямые солнечные лучи минимум 6 часов',
      temperature: '15-25°C',
      humidity: 'Средняя'
    },
    features: [
      'Ароматные цветы',
      'Разнообразие сортов',
      'Длительное цветение',
      'Срезка для букетов'
    ],
    dangers: [
      'Шипы могут поранить',
      'Подвержена вредителям'
    ],
    maintenance: 'Регулярная обрезка, подкормка, защита от вредителей'
  }
];

export default plantsData;
