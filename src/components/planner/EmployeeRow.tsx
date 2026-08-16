import { Employee, Project, Allocation, TeamEvent, Absence } from '@/types';
import { WeekCell } from './WeekCell';
import { useApp } from '@/contexts/AppContext';
import { useAgency } from '@/contexts/AgencyContext';
import { getValidRole, translateRoleLabel } from '@/utils/roleUtils';
import { format, startOfWeek } from 'date-fns';
import { isCurrentWeek, isAllocationInEffectiveMonth } from '@/utils/dateUtils';
import { SensitiveText } from '@/components/privacy/SensitiveText';
import { useAppTranslation } from '@/hooks/useAppTranslation';

interface EmployeeRowProps {
  employee: Employee;
  weeks: { weekStart: Date; weekEnd: Date; effectiveStart?: Date; effectiveEnd?: Date }[];
  projects: Project[];
  allocations: Allocation[];
  teamEvents: TeamEvent[];
  absences: Absence[];
  viewDate: Date;
  onOpenSheet: (employeeId: string, weekStart: Date, autoAdd?: boolean) => void;
  cellVariant?: 'compact' | 'detailed';
}

export function EmployeeRow({
  employee, weeks, allocations, viewDate, onOpenSheet, cellVariant = 'detailed',
}: EmployeeRowProps) {

  const { getEmployeeLoadForWeek } = useApp();
  const { currentAgency } = useAgency();
  const { t } = useAppTranslation();

  const availableRoles = currentAgency?.settings?.roles || [];
  const displayRole = translateRoleLabel(
    getValidRole(employee, availableRoles),
    (key, fallback) => t(key, { defaultValue: fallback ?? key }),
  );

  return (
    <div className="contents group">
      <div className="sticky left-0 z-10 bg-background/95 backdrop-blur border-r p-2 flex items-center group-hover:bg-slate-50/80 transition-colors">
        <div
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity w-full min-w-0"
          onClick={() => {
            const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
            const currentWeek = weeks.find(w =>
              w.weekStart.getTime() === currentWeekStart.getTime()
            );
            onOpenSheet(employee.id, currentWeek?.weekStart || weeks[0].weekStart);
          }}
          title={t('planner.grid.viewTaskDetail', 'View task details')}
        >
          <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs border border-indigo-200 shrink-0">
            {employee.avatarUrl ? (
              <img src={employee.avatarUrl} alt={employee.name} className="h-full w-full rounded-full object-cover" />
            ) : (
              employee.name.substring(0, 2).toUpperCase()
            )}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <SensitiveText kind="employee" id={employee.id} className="font-semibold text-xs text-foreground truncate leading-tight" asBlock>
              {employee.name}
            </SensitiveText>
            <span className="text-[9px] text-muted-foreground uppercase tracking-wide truncate">{displayRole}</span>
          </div>
        </div>
      </div>

      {weeks.map((week) => {
        const weekStartDate = format(week.weekStart, 'yyyy-MM-dd');

        const weekAllocations = allocations.filter(a =>
          a.employeeId === employee.id &&
          a.weekStartDate === weekStartDate &&
          isAllocationInEffectiveMonth(a.weekStartDate, viewDate)
        );

        const load = getEmployeeLoadForWeek(
          employee.id,
          weekStartDate,
          week.effectiveStart,
          week.effectiveEnd,
          viewDate
        );

        return (
          <div key={week.weekStart.toISOString()} className="border-r last:border-r-0 p-1.5 min-w-0">
            <WeekCell
              allocations={weekAllocations}
              hours={load.hours}
              capacity={load.capacity}
              status={load.status}
              percentage={load.percentage}
              isCurrentWeek={isCurrentWeek(week.weekStart)}
              baseCapacity={load.baseCapacity}
              breakdown={load.breakdown}
              onClick={() => onOpenSheet(employee.id, week.weekStart)}
              variant={cellVariant}
            />
          </div>
        );
      })}
    </div>
  );
}
