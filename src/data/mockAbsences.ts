import { Absence } from '@/types';

export const mockAbsences: Absence[] = [
  {
    id: 'absence-1',
    employeeId: 'emp-1',
    startDate: '2024-12-23',
    endDate: '2024-12-27',
    type: 'vacation',
    description: 'Vacaciones de Navidad',
  },
  {
    id: 'absence-2',
    employeeId: 'emp-2',
    startDate: '2024-12-30',
    endDate: '2024-12-31',
    type: 'personal',
    description: 'Días personales',
  },
];
