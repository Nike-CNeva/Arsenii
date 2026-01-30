import { BabyProfile } from './types';
import { 
  Moon, 
  Utensils, 
  Droplets, 
  Footprints, 
  Stethoscope, 
  Ruler,
  Bath,
  Milk,
  Smile,
  Star
} from 'lucide-react';

export const ARSENIY_PROFILE: BabyProfile = {
  name: "Арсений",
  birthDate: "2025-09-02T00:00:00.000Z",
  birthWeight: 3.3,
  birthHeight: 51
};

export const EVENT_CONFIG = {
  SLEEP: {
    label: 'Сон',
    color: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    icon: Moon
  },
  FEEDING: {
    label: 'Кормление',
    color: 'bg-orange-100 text-orange-700 border-orange-200',
    icon: Utensils
  },
  PUMPING: {
    label: 'Сцеживание',
    color: 'bg-pink-100 text-pink-700 border-pink-200',
    icon: Milk
  },
  DIAPER: {
    label: 'Подгузник',
    color: 'bg-teal-100 text-teal-700 border-teal-200',
    icon: Droplets
  },
  WALK: {
    label: 'Прогулка',
    color: 'bg-green-100 text-green-700 border-green-200',
    icon: Footprints
  },
  BATH: {
    label: 'Купание',
    color: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    icon: Bath
  },
  HEALTH: {
    label: 'Здоровье',
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: Stethoscope
  },
  GROWTH: {
    label: 'Замеры',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: Ruler
  },
  MOOD: {
    label: 'Настроение',
    color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    icon: Smile
  },
  MILESTONE: {
    label: 'Событие',
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    icon: Star
  }
};