import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameMonth, addDays, format, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { WorkSchedule } from '@/types';

// ✅ CLAVE: Decide con qué fecha se guarda una tarea dependiendo del mes que miras
export const getStorageKey = (weekStart: Date, viewMonth: Date): string => {
    // Si la semana empieza en el mismo mes que estamos viendo, usamos su fecha real
    if (isSameMonth(weekStart, viewMonth)) {
        return format(weekStart, 'yyyy-MM-dd');
    }

    // Si la semana empieza ANTES del mes que vemos (ej: 29 Dic viendo Enero)
    // La "caja" para guardar las tareas de Enero será el 1 de Enero
    const monthStart = startOfMonth(viewMonth);
    if (weekStart < monthStart) {
        return format(monthStart, 'yyyy-MM-dd');
    }

    // Si la semana empieza DESPUÉS (raro en vista mensual estándar), fecha real
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

    // Calculamos límites visuales para que la etiqueta diga "1 Ene" y no "29 Dic"
    const effectiveStart = currentWeekStart < monthStart ? monthStart : currentWeekStart;
    const effectiveEnd = currentWeekEnd > monthEnd ? monthEnd : currentWeekEnd;

    weeks.push({
      weekStart: currentWeekStart,
      weekEnd: currentWeekEnd,
      weekLabel: `Semana ${weeks.length + 1}`,
      effectiveStart,
      effectiveEnd,
    });

    currentWeekStart = addDays(currentWeekStart, 7);
  }

  return weeks;
};

export const getMonthName = (date: Date) => format(date, 'MMMM', { locale: es });
export const formatDateToISO = (date: Date) => format(date, 'yyyy-MM-dd');

export const isCurrentWeek = (date: Date) => {
    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn: 1 });
    return date.getTime() === start.getTime();
};

export const getWorkingDaysInRange = (start: Date, end: Date, schedule: WorkSchedule) => {
    let totalHours = 0;
    let days = 0;
    let current = start;
    
    // Evitar bucles infinitos por seguridad
    if (current > end) return { totalHours: 0, days: 0 };

    while (current <= end) {
        const dayOfWeek = current.getDay(); // 0 = Dom, 1 = Lun...
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
