import { Absence, WorkSchedule } from '@/types';

export function getAbsenceHoursInRange(
  startDate: Date,
  endDate: Date,
  absences: Absence[],
  workSchedule: WorkSchedule
): number {
  const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
  let totalAbsenceHours = 0;

  absences.forEach(absence => {
    const absenceStart = new Date(absence.startDate);
    const absenceEnd = new Date(absence.endDate);
    
    // Find overlap between absence and the date range
    const overlapStart = absenceStart > startDate ? absenceStart : startDate;
    const overlapEnd = absenceEnd < endDate ? absenceEnd : endDate;
    
    if (overlapStart > overlapEnd) return; // No overlap
    
    const current = new Date(overlapStart);
    current.setHours(0, 0, 0, 0);
    const end = new Date(overlapEnd);
    end.setHours(23, 59, 59, 999);
    
    while (current <= end) {
      const dayOfWeek = current.getDay();
      const dayKey = dayKeys[dayOfWeek];
      const hoursForDay = workSchedule[dayKey];
      
      if (hoursForDay > 0) {
        totalAbsenceHours += hoursForDay;
      }
      
      current.setDate(current.getDate() + 1);
    }
  });

  return totalAbsenceHours;
}

export function getAbsenceTypeLabel(type: Absence['type']): string {
  const labels: Record<Absence['type'], string> = {
    vacation: 'Vacaciones',
    sick: 'Enfermedad',
    personal: 'Personal',
    other: 'Otro',
  };
  return labels[type];
}

export function getAbsenceTypeColor(type: Absence['type']): string {
  const colors: Record<Absence['type'], string> = {
    vacation: 'bg-blue-500',
    sick: 'bg-red-500',
    personal: 'bg-amber-500',
    other: 'bg-gray-500',
  };
  return colors[type];
}
