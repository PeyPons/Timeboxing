import { TeamEvent, WorkSchedule } from '@/types';

/**
 * Calcula las horas reducidas por eventos de equipo para un empleado en un rango de fechas.
 * 
 * MEJORA: Si el evento tiene hoursReduction >= 8 (día completo), 
 * se usa el horario real del empleado para ese día en vez del valor fijo.
 * Esto asegura que si alguien trabaja 6h los viernes y otro 8h,
 * un festivo de viernes les reste 6h y 8h respectivamente.
 */
export function getTeamEventHoursInRange(
  startDate: Date,
  endDate: Date,
  employeeId: string,
  teamEvents: TeamEvent[],
  workSchedule: WorkSchedule
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
        // Get employee's scheduled hours for that day
        const dayOfWeek = eventDate.getDay();
        const dayNames: (keyof WorkSchedule)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = dayNames[dayOfWeek];
        const employeeHoursForDay = workSchedule[dayName] || 0;
        
        // Only count if employee works on that day
        if (employeeHoursForDay > 0) {
          // MEJORA: Si la reducción es >= 8h (día completo típico),
          // usar las horas reales del empleado para ese día
          // Si es menor (reducción parcial), usar el valor configurado
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
 */
export function getTeamEventDetailsInRange(
  startDate: Date,
  endDate: Date,
  employeeId: string,
  teamEvents: TeamEvent[],
  workSchedule: WorkSchedule
): { name: string; date: Date; hours: number }[] {
  const details: { name: string; date: Date; hours: number }[] = [];

  teamEvents.forEach(event => {
    const eventDate = new Date(event.date);
    
    if (eventDate >= startDate && eventDate <= endDate) {
      const isAffected = event.affectedEmployeeIds === 'all' || 
                         event.affectedEmployeeIds.includes(employeeId);
      
      if (isAffected) {
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
