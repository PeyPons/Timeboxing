import { Employee, WeekData } from '@/types';
import { useApp } from '@/contexts/AppContext';
import { WeekCell } from './WeekCell';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDateToISO, isCurrentWeek, getWorkingDaysInRange, getStorageKey } from '@/utils/dateUtils';
import { getAbsenceHoursInRange } from '@/utils/absenceUtils';

interface EmployeeRowProps {
  employee: Employee;
  weeks: WeekData[];
  onCellClick: (employeeId: string, weekStart: string) => void;
  currentMonth: Date;
}

export function EmployeeRow({ employee, weeks, onCellClick, currentMonth }: EmployeeRowProps) {
  const { getEmployeeLoadForWeek, absences, getEmployeeAllocationsForWeek } = useApp();
  
  const employeeAbsences = absences.filter(a => a.employeeId === employee.id);
  const initials = employee.name.substring(0, 2).toUpperCase();

  return (
    <>
      <div className="p-3 border-r flex items-center gap-3 overflow-hidden bg-white dark:bg-slate-950 z-10 sticky left-0">
        <Avatar className="h-9 w-9 border-2 border-white shadow-sm flex-shrink-0">
          <AvatarImage src={employee.avatarUrl} />
          <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-bold">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200 leading-tight">{employee.name}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400 mt-0.5">{employee.role || "Sin rol"}</p>
        </div>
      </div>

      {weeks.map((week) => {
        const weekStartStr = formatDateToISO(week.weekStart);
        const storageKey = getStorageKey(week.weekStart, currentMonth);
        
        const cellAllocations = getEmployeeAllocationsForWeek(employee.id, storageKey);
        
        // Obtenemos la carga y el DESGLOSE (breakdown)
        const load = getEmployeeLoadForWeek(
          employee.id, 
          storageKey, 
          week.effectiveStart, 
          week.effectiveEnd
        );
        
        const rangeStart = week.effectiveStart || week.weekStart;
        const rangeEnd = week.effectiveEnd || new Date(week.weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
        
        const { totalHours: baseCapacity } = getWorkingDaysInRange(rangeStart, rangeEnd, employee.workSchedule);
        
        return (
          <div key={weekStartStr} className="border-r last:border-r-0 p-1">
            <WeekCell
              allocations={cellAllocations}
              hours={load.hours}
              capacity={load.capacity}
              status={load.status}
              percentage={load.percentage}
              isCurrentWeek={isCurrentWeek(week.weekStart)}
              baseCapacity={baseCapacity}
              breakdown={load.breakdown} // ✅ PASAMOS EL DESGLOSE DE EVENTOS/AUSENCIAS
              onClick={() => onCellClick(employee.id, weekStartStr)}
            />
          </div>
        );
      })}
    </>
  );
}
