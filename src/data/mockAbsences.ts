import { Absence } from '@/types';

export const mockAbsences: Absence[] = [
  {
    id: 'absence-1',
    employeeId: '1',
    startDate: '2025-12-22',
    endDate: '2025-12-26',
    type: 'vacation',
    description: 'Vacaciones de Navidad',
  },
  {
    id: 'absence-2',
    employeeId: '2',
    startDate: '2025-12-29',
    endDate: '2025-12-31',
    type: 'personal',
    description: 'Días personales',
  },
  {
    id: 'absence-3',
    employeeId: '3',
    startDate: '2025-12-15',
    endDate: '2025-12-17',
    type: 'sick',
    description: 'Baja médica',
  },
  {
    id: 'absence-4',
    employeeId: '4',
    startDate: '2025-12-08',
    endDate: '2025-12-10',
    type: 'vacation',
    description: 'Días libres',
  },
];
