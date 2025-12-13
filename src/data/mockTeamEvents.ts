import { TeamEvent } from '@/types';

export const mockTeamEvents: TeamEvent[] = [
  {
    id: 'te1',
    name: 'Cierre anticipado Navidad',
    date: '2025-12-24',
    hoursReduction: 4,
    affectedEmployeeIds: 'all',
    description: 'Todos salimos a las 13:00'
  },
  {
    id: 'te2',
    name: 'Cierre anticipado Nochevieja',
    date: '2025-12-31',
    hoursReduction: 4,
    affectedEmployeeIds: 'all',
    description: 'Todos salimos a las 13:00'
  },
  {
    id: 'te3',
    name: 'Formación equipo SEO',
    date: '2025-12-15',
    hoursReduction: 2,
    affectedEmployeeIds: ['1', '3', '4', '6'],
    description: 'Formación sobre nuevas herramientas'
  }
];
