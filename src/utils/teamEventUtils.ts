import { TeamEvent, WorkSchedule } from '@/types';

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
        // Only count if employee works on that day
        const dayOfWeek = eventDate.getDay();
        const dayNames: (keyof WorkSchedule)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = dayNames[dayOfWeek];
        
        if (workSchedule[dayName] > 0) {
          totalHours += event.hoursReduction;
        }
      }
    }
  });

  return totalHours;
}
