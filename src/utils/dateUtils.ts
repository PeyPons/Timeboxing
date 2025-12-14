import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameMonth, addDays, format, eachDayOfInterval, isWeekend } from 'date-fns';
import { es } from 'date-fns/locale';
import { WorkSchedule } from '@/types';

export const getMonthName = (date: Date) => format(date, 'MMMM', { locale: es });
export const formatDateToISO = (date: Date) => format(date, 'yyyy-MM-dd');

export const isCurrentWeek = (date: Date) => {
    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn: 1 });
    return date.getTime() === start.getTime();
};

// ✅ FUNCIÓN CRÍTICA: Decide "dónde" se guardan los datos.
// Si estamos viendo Enero, las tareas de la semana compartida se guardan en Enero.
// Si estamos viendo Diciembre, se guardan en Diciembre.
export const getStorageKey = (weekStart: Date, viewMonth: Date): string => {
    // 1. Si la semana empieza en el mismo mes que vemos, llave normal.
    if (isSameMonth(weekStart, viewMonth)) {
        return format(weekStart, 'yyyy-MM-dd');
    }

    // 2. Si la semana empieza ANTES del mes que vemos (ej: 29 Dic viendo Enero),
    // forzamos que la llave sea el 1er día del mes actual.
    const monthStart = startOfMonth(viewMonth);
    if (weekStart < monthStart) {
        return format(monthStart, 'yyyy-MM-dd');
    }

    // 3. Defecto
    return format(weekStart, 'yyyy-MM-dd');
};

export const getWeeksForMonth = (date: Date) => {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const weeks = [];
  let currentWeekStart = startDate;

  while (currentWeekStart <= endDate) {
    const currentWeekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });

    // Límites visuales (recorte)
    const effectiveStart = currentWeekStart < monthStart ? monthStart : currentWeekStart;
    const effectiveEnd = currentWeekEnd > monthEnd ? monthEnd : currentWeekEnd;

    // Filtro: Solo añadir la semana si tiene días laborables en este mes
    // (Arregla que aparezca una semana extra en Marzo si el día 1 es Domingo)
    const daysInInterval = eachDayOfInterval({ start: effectiveStart, end: effectiveEnd });
    const hasWorkingDays = daysInInterval.some(day => !isWeekend(day));

    if (hasWorkingDays) {
        weeks.push({
            weekStart: currentWeekStart,
            weekEnd: currentWeekEnd,
            weekLabel: `Semana ${weeks.length + 1}`,
            effectiveStart,
            effectiveEnd,
        });
    }

    currentWeekStart = addDays(currentWeekStart, 7);
  }

  return weeks;
};

export const getWorkingDaysInRange = (start: Date, end: Date, schedule: WorkSchedule) => {
    let totalHours = 0;
    let days = 0;
    let current = new Date(start); 
    
    if (current > end) return { totalHours: 0, days: 0 };

    while (current <= end) {
        const dayOfWeek = current.getDay();
        const dayKey = dayOfWeek === 0 ? 'sunday' : 
                       dayOfWeek === 1 ? 'monday' : 
                       dayOfWeek === 2 ? 'tuesday' : 
                       dayOfWeek === 3 ? 'wednesday' : 
                       dayOfWeek === 4 ? 'thursday' : 
                       dayOfWeek === 5 ? 'friday' : 'saturday';
        
        // @ts-ignore
        const hours = schedule[dayKey] || 0;
        if (hours > 0) days++;
        totalHours += hours;
        current = addDays(current, 1);
    }
    return { totalHours, days };
};

export const getMonthlyCapacity = (year: number, month: number, schedule: WorkSchedule) => {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0); 
    return getWorkingDaysInRange(start, end, schedule).totalHours;
};
