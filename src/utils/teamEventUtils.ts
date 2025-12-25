import { TeamEvent, WorkSchedule, Absence } from '@/types';

/**
 * Verifica si una fecha específica está cubierta por alguna ausencia del empleado
 */
function isDateCoveredByAbsence(date: Date, absences: Absence[]): boolean {
  return absences.some(absence => {
    const startDate = new Date(absence.startDate);
    const endDate = new Date(absence.endDate);
    
    // Normalizar a medianoche para comparación correcta
    const checkDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    checkDate.setHours(12, 0, 0, 0);
    
    return checkDate >= startDate && checkDate <= endDate;
  });
}

/**
 * Calcula las horas reducidas por eventos de equipo para un empleado en un rango de fechas.
 * 
 * MEJORAS:
 * 1. Si el evento tiene hoursReduction >= 8 (día completo), usa el horario real del empleado
 * 2. NO cuenta eventos en días donde el empleado ya tiene una ausencia (vacaciones, etc.)
 */
export function getTeamEventHoursInRange(
  startDate: Date,
  endDate: Date,
  employeeId: string,
  teamEvents: TeamEvent[],
  workSchedule: WorkSchedule,
  employeeAbsences: Absence[] = []  // NUEVO: recibe las ausencias del empleado
): number {
  let totalHours = 0;

  teamEvents.forEach(event => {
    const eventDate = new Date(event.date);
    
    // Check if event falls within range
    if (eventDate >= startDate && eventDate <= endDate) {
      // Check if employee is affected
      const isAffected = event.affectedEmployeeIds === 'all' || 
                         event.affectedEmployeeIds.includes(employeeId);
      
      if (isAffected) {
        // NUEVO: No contar si el empleado ya está de ausencia ese día
        if (isDateCoveredByAbsence(eventDate, employeeAbsences)) {
          return; // Skip este evento, ya está de ausencia
        }
        
        // Get employee's scheduled hours for that day
        const dayOfWeek = eventDate.getDay();
        const dayNames: (keyof WorkSchedule)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = dayNames[dayOfWeek];
        const employeeHoursForDay = workSchedule[dayName] || 0;
        
        // Only count if employee works on that day
        if (employeeHoursForDay > 0) {
          if (event.hoursReduction >= 8) {
            // Día completo: usar horario del empleado
            totalHours += employeeHoursForDay;
          } else {
            // Reducción parcial: usar el valor configurado,
            // pero nunca más que las horas que trabaja ese día
            totalHours += Math.min(event.hoursReduction, employeeHoursForDay);
          }
        }
      }
    }
  });

  return totalHours;
}

/**
 * Obtiene el detalle de eventos que afectan a un empleado en un rango.
 * Útil para mostrar el breakdown en la UI.
 * 
 * NO incluye eventos en días donde el empleado ya tiene ausencia.
 */
export function getTeamEventDetailsInRange(
  startDate: Date,
  endDate: Date,
  employeeId: string,
  teamEvents: TeamEvent[],
  workSchedule: WorkSchedule,
  employeeAbsences: Absence[] = []  // NUEVO: recibe las ausencias del empleado
): { name: string; date: Date; hours: number }[] {
  const details: { name: string; date: Date; hours: number }[] = [];

  teamEvents.forEach(event => {
    const eventDate = new Date(event.date);
    
    if (eventDate >= startDate && eventDate <= endDate) {
      const isAffected = event.affectedEmployeeIds === 'all' || 
                         event.affectedEmployeeIds.includes(employeeId);
      
      if (isAffected) {
        // NUEVO: No incluir si el empleado ya está de ausencia ese día
        if (isDateCoveredByAbsence(eventDate, employeeAbsences)) {
          return; // Skip este evento
        }
        
        const dayOfWeek = eventDate.getDay();
        const dayNames: (keyof WorkSchedule)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = dayNames[dayOfWeek];
        const employeeHoursForDay = workSchedule[dayName] || 0;
        
        if (employeeHoursForDay > 0) {
          const hoursReduced = event.hoursReduction >= 8 
            ? employeeHoursForDay 
            : Math.min(event.hoursReduction, employeeHoursForDay);
          
          details.push({
            name: event.name,
            date: eventDate,
            hours: hoursReduced
          });
        }
      }
    }
  });

  return details;
}
