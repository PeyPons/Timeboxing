import { WeekData } from '@/types';

export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  return d;
}

export function formatWeekLabelForMonth(weekStart: Date, month: number, year: number): string {
  const weekEnd = getWeekEnd(weekStart);
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  
  // Clamp dates to the current month
  const displayStart = weekStart < monthStart ? monthStart : weekStart;
  const displayEnd = weekEnd > monthEnd ? monthEnd : weekEnd;
  
  const startDay = displayStart.getDate();
  const endDay = displayEnd.getDate();
  
  return `${startDay}-${endDay}`;
}

export function getWeeksForMonth(date: Date): WeekData[] {
  const weeks: WeekData[] = [];
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  
  // Start from the week that contains the first day of the month
  let weekStart = getWeekStart(firstDayOfMonth);
  
  while (weekStart <= lastDayOfMonth) {
    const weekEnd = getWeekEnd(weekStart);
    
    // Calculate which days of this week fall within the month
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    
    const effectiveStart = weekStart < monthStart ? monthStart : weekStart;
    const effectiveEnd = weekEnd > monthEnd ? monthEnd : weekEnd;
    
    weeks.push({
      weekStart: new Date(weekStart),
      weekEnd: new Date(weekEnd),
      weekLabel: formatWeekLabelForMonth(weekStart, month, year),
      // Store the effective range within the month for capacity calculations
      effectiveStart: new Date(effectiveStart),
      effectiveEnd: new Date(effectiveEnd),
    });
    
    weekStart.setDate(weekStart.getDate() + 7);
  }
  
  return weeks;
}

export function formatDateToISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function isCurrentWeek(weekStart: Date): boolean {
  const today = new Date();
  const currentWeekStart = getWeekStart(today);
  return formatDateToISO(weekStart) === formatDateToISO(currentWeekStart);
}

export function getMonthName(date: Date): string {
  const month = date.toLocaleDateString('es-ES', { month: 'long' });
  const year = date.getFullYear();
  
  // Capitalizamos la primera letra del mes
  const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1);
  
  return `${capitalizedMonth} - ${year}`;
}

// Get the working days within a specific date range for an employee's schedule
export function getWorkingDaysInRange(
  startDate: Date, 
  endDate: Date, 
  workSchedule: { monday: number; tuesday: number; wednesday: number; thursday: number; friday: number; saturday: number; sunday: number }
): { totalHours: number; days: number } {
  const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
  let totalHours = 0;
  let days = 0;
  
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  
  while (current <= end) {
    const dayOfWeek = current.getDay();
    const dayKey = dayKeys[dayOfWeek];
    const hoursForDay = workSchedule[dayKey];
    
    if (hoursForDay > 0) {
      totalHours += hoursForDay;
      days++;
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return { totalHours, days };
}

// Calculate total working hours in a month for an employee
export function getMonthlyCapacity(
  year: number,
  month: number,
  workSchedule: { monday: number; tuesday: number; wednesday: number; thursday: number; friday: number; saturday: number; sunday: number }
): number {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  const { totalHours } = getWorkingDaysInRange(firstDay, lastDay, workSchedule);
  return totalHours;
}
