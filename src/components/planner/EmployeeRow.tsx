import { Employee, WeekData } from '@/types';
import { useApp } from '@/contexts/AppContext';
import { WeekCell } from './WeekCell';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDateToISO, isCurrentWeek } from '@/utils/dateUtils';

interface EmployeeRowProps {
  employee: Employee;
  weeks: WeekData[];
  onCellClick: (employeeId: string, weekStart: string) => void;
}

export function EmployeeRow({ employee, weeks, onCellClick }: EmployeeRowProps) {
  const { getEmployeeLoadForWeek } = useApp();

  const initials = employee.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center gap-2 py-2 animate-fade-in">
      {/* Employee Info - Fixed Width */}
      <div className="flex w-48 flex-shrink-0 items-center gap-3 pr-4">
        <Avatar className="h-10 w-10 border-2 border-primary/20">
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{employee.name}</p>
          <p className="truncate text-xs text-muted-foreground">{employee.role}</p>
        </div>
      </div>

      {/* Week Cells */}
      <div className="flex flex-1 gap-2">
        {weeks.map((week) => {
          const weekStartStr = formatDateToISO(week.weekStart);
          const load = getEmployeeLoadForWeek(employee.id, weekStartStr);
          
          return (
            <div key={weekStartStr} className="flex-1 min-w-[80px]">
              <WeekCell
                hours={load.hours}
                capacity={load.capacity}
                status={load.status}
                percentage={load.percentage}
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
