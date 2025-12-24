import { Absence, WorkSchedule } from '@/types';
import { eachDayOfInterval, getDay, parseISO, startOfDay, endOfDay, isWithinInterval } from 'date-fns';

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export const getAbsenceHoursInRange = (
  start: Date,
  end: Date,
  absences: Absence[],
  schedule: WorkSchedule
): number => {
  let totalHours = 0;
  
  // Normalizamos el rango de consulta al inicio y fin del día local para comparaciones precisas
  const rangeStart = startOfDay(start);
  const rangeEnd = endOfDay(end);

  absences.forEach(absence => {
    try {
        // Usamos parseISO para manejar correctamente strings 'YYYY-MM-DD' y normalizamos al inicio del día
        const absStart = startOfDay(parseISO(absence.startDate));
        const absEnd = startOfDay(parseISO(absence.endDate));

        // Validación básica para evitar errores con fechas inválidas
        if (isNaN(absStart.getTime()) || isNaN(absEnd.getTime()) || absStart > absEnd) {
            return;
        }

        const days = eachDayOfInterval({ start: absStart, end: absEnd });

        days.forEach(day => {
            // Verificamos si el día cae dentro del rango consultado (inclusive)
            if (isWithinInterval(day, { start: rangeStart, end: rangeEnd })) {
                const dayIndex = getDay(day);
                const dayName = DAY_KEYS[dayIndex];
                // Obtenemos las horas programadas para ese día de la semana
                const scheduledHours = schedule ? (schedule[dayName] || 0) : 0;

                // Solo calculamos reducción si es un día laborable para el empleado
                if (scheduledHours > 0) {
                    let reduction = 0;
                    
                    // Convertimos explícitamente a número para evitar problemas de tipos
                    const absenceHours = Number(absence.hours);
                    
                    // LÓGICA CORREGIDA:
                    // Si existe un valor de horas válido y mayor a 0, aplicamos esa cantidad (topeada por el horario diario).
                    // Si absence.hours es undefined, null, o 0, asumimos que es ausencia de DÍA COMPLETO.
                    if (!isNaN(absenceHours) && absenceHours > 0) {
                        reduction = Math.min(absenceHours, scheduledHours);
                    } else {
                        reduction = scheduledHours;
                    }
                    
                    totalHours += reduction;
                }
            }
        });
    } catch (e) {
        // Prevenir rotura de la UI si hay datos corruptos
        console.warn("Error procesando ausencia:", absence, e);
    }
  });

  return totalHours;
};
