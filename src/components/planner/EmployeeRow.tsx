import { Employee, WeekData } from '@/types';
import { useApp } from '@/contexts/AppContext';
import { WeekCell } from './WeekCell';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDateToISO, isCurrentWeek, getWorkingDaysInRange } from '@/utils/dateUtils';
import { getAbsenceHoursInRange } from '@/utils/absenceUtils';

interface EmployeeRowProps {
  employee: Employee;
  weeks: WeekData[];
  onCellClick: (employeeId: string, weekStart: string) => void;
}

export function EmployeeRow({ employee, weeks, onCellClick }: EmployeeRowProps) {
  // ✅ 1. Importamos 'getEmployeeAllocationsForWeek' del contexto
  const { getEmployeeLoadForWeek, absences, getEmployeeAllocationsForWeek } = useApp();
  
  const employeeAbsences = absences.filter(a => a.employeeId === employee.id);

  const initials = employee.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex flex-1 min-w-0 items-center gap-1 sm:gap-2 py-2 animate-fade-in border-b border-transparent hover:border-slate-100 hover:bg-slate-50/50 transition-colors">
      {/* Employee Info - Fixed Width */}
      <div className="flex w-28 sm:w-48 flex-shrink-0 items-center gap-2 sm:gap-3 pr-2 sm:pr-4 pl-2">
        <Avatar className="h-8 w-8 sm:h-10 sm:w-10 border-2 border-white shadow-sm">
          <AvatarFallback className="bg-indigo-50 text-indigo-700 text-xs sm:text-sm font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 hidden sm:block">
          <p className="truncate text-sm font-semibold text-slate-700">{employee.name}</p>
          <p className="truncate text-xs text-slate-400">{employee.role}</p>
        </div>
        <div className="min-w-0 sm:hidden">
          <p className="truncate text-xs font-medium text-foreground">{employee.name.split(' ')[0]}</p>
        </div>
      </div>

      {/* Week Cells */}
      <div className="flex flex-1 gap-1 sm:gap-2">
        {weeks.map((week) => {
          const weekStartStr = formatDateToISO(week.weekStart);
          
          // ✅ 2. Obtenemos las tareas específicas para esta celda
          const cellAllocations = getEmployeeAllocationsForWeek(employee.id, weekStartStr);

          // Cálculos de carga
          const load = getEmployeeLoadForWeek(
            employee.id, 
            weekStartStr, 
            week.effectiveStart, 
            week.effectiveEnd
          );
          
          return (
            <div key={weekStartStr} className="flex-1 min-w-[60px] sm:min-w-[80px]">
              <WeekCell
                allocations={cellAllocations} // ✅ ¡AQUÍ ESTABA EL ERROR! Ahora pasamos los datos.
                hours={load.hours}
                capacity={load.capacity}
                status={load.status}
                isCurrentWeek={isCurrentWeek(week.weekStart)}
                onClick={() => onCellClick(employee.id, weekStartStr)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
