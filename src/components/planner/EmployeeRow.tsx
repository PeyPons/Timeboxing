import { Employee, WeekData } from '@/types';
import { useApp } from '@/contexts/AppContext';
import { WeekCell } from './WeekCell';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDateToISO, isCurrentWeek, getWorkingDaysInRange } from '@/utils/dateUtils';
import { getAbsenceHoursInRange } from '@/utils/absenceUtils';

interface EmployeeRowProps {
  employee: Employee;
  weeks: WeekData[];
  onCellClick: (employeeId: string, weekStart: string) => void;
}

export function EmployeeRow({ employee, weeks, onCellClick }: EmployeeRowProps) {
  const { getEmployeeLoadForWeek, absences, getEmployeeAllocationsForWeek } = useApp();
  
  const employeeAbsences = absences.filter(a => a.employeeId === employee.id);

  const initials = employee.name.substring(0, 2).toUpperCase();

  return (
    <>
      {/* 1. CELDA DE INFORMACIÓN DEL EMPLEADO (Columna 1 del Grid) */}
      <div className="p-3 border-r flex items-center gap-3 overflow-hidden">
        <Avatar className="h-9 w-9 border-2 border-white shadow-sm flex-shrink-0">
          <AvatarImage src={employee.avatarUrl} />
          <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200 leading-tight">
            {employee.name}
          </p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {employee.role || "Sin rol"}
          </p>
        </div>
      </div>

      {/* 2. CELDAS DE LAS SEMANAS (Columnas 2...N del Grid) */}
      {weeks.map((week) => {
        const weekStartStr = formatDateToISO(week.weekStart);
        
        // Obtener datos reales
        const cellAllocations = getEmployeeAllocationsForWeek(employee.id, weekStartStr);
        
        const load = getEmployeeLoadForWeek(
          employee.id, 
          weekStartStr, 
          week.effectiveStart, 
          week.effectiveEnd
        );
        
        // Calcular ausencias
        const rangeStart = week.effectiveStart || week.weekStart;
        const weekEndDate = new Date(week.weekStart);
        weekEndDate.setDate(weekEndDate.getDate() + 6);
        const rangeEnd = week.effectiveEnd || weekEndDate;
        
        const absenceHours = getAbsenceHoursInRange(rangeStart, rangeEnd, employeeAbsences, employee.workSchedule);
        const hasAbsence = absenceHours > 0;
        
        // Capacidad base
        const { totalHours: baseCapacity } = getWorkingDaysInRange(rangeStart, rangeEnd, employee.workSchedule);
        
        return (
          <div key={weekStartStr} className="border-r last:border-r-0 p-1">
            <WeekCell
              allocations={cellAllocations} // ✅ Pasamos las tareas para evitar errores
              hours={load.hours}
              capacity={load.capacity}
              status={load.status}
              percentage={load.percentage}
              isCurrentWeek={isCurrentWeek(week.weekStart)}
              hasAbsence={hasAbsence}
              absenceHours={absenceHours}
              baseCapacity={baseCapacity}
              onClick={() => onCellClick(employee.id, weekStartStr)}
            />
          </div>
        );
      })}
    </>
  );
}
