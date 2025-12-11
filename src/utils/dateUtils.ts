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

export function formatWeekLabel(weekStart: Date): string {
  const weekEnd = getWeekEnd(weekStart);
  const startDay = weekStart.getDate();
  const endDay = weekEnd.getDate();
  const startMonth = weekStart.toLocaleDateString('es-ES', { month: 'short' });
  const endMonth = weekEnd.toLocaleDateString('es-ES', { month: 'short' });
  
  if (weekStart.getMonth() === weekEnd.getMonth()) {
    return `${startDay}-${endDay} ${startMonth}`;
  }
  return `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
}

export function getWeeksForMonth(date: Date, extraWeeks: number = 2): WeekData[] {
  const weeks: WeekData[] = [];
  const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  let weekStart = getWeekStart(firstDayOfMonth);
  
  // Go back one week to show context
  weekStart.setDate(weekStart.getDate() - 7);
  
  // Calculate how many weeks to show
  const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const lastWeekStart = getWeekStart(lastDayOfMonth);
  
  while (weekStart <= lastWeekStart || weeks.length < 6) {
    weeks.push({
      weekStart: new Date(weekStart),
      weekEnd: getWeekEnd(weekStart),
      weekLabel: formatWeekLabel(weekStart),
    });
    weekStart.setDate(weekStart.getDate() + 7);
    
    if (weeks.length >= 8) break; // Safety limit
  }
  
  // Add extra future weeks
  for (let i = 0; i < extraWeeks; i++) {
    weeks.push({
      weekStart: new Date(weekStart),
      weekEnd: getWeekEnd(weekStart),
      weekLabel: formatWeekLabel(weekStart),
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
  return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}
