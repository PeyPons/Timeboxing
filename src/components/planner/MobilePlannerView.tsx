import * as React from 'react';
import { Employee, Allocation, LoadStatus, type RolePermissions } from '@/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useDateLocale } from '@/hooks/useDateLocale';
import { isCurrentWeek, isAllocationInEffectiveMonth } from '@/utils/dateUtils';
import { getValidRole } from '@/utils/roleUtils';
import { useAppOrDemo } from '@/hooks/useAppOrDemo';
import { useAgency } from '@/contexts/AgencyContext';
import { WeekCell } from './WeekCell';
import { SensitiveText } from '@/components/privacy/SensitiveText';

export interface WeekData {
  weekStart: Date;
  weekEnd: Date;
  effectiveStart?: Date;
  effectiveEnd?: Date;
}

interface MobilePlannerViewProps {
  filteredEmployees: Employee[];
  weeks: WeekData[];
  allocations: Allocation[];
  viewDate: Date;
  getEmployeeMonthlyLoad: (employeeId: string, year: number, month: number) => { hours: number; capacity: number; status: LoadStatus; percentage: number };
  onOpenSheet: (employeeId: string, weekStart: Date, autoAdd?: boolean) => void;
  cellVariant?: 'compact' | 'detailed';
}

export function MobilePlannerView({
  filteredEmployees,
  weeks,
  allocations,
  viewDate,
  getEmployeeMonthlyLoad,
  onOpenSheet,
  cellVariant = 'detailed',
}: MobilePlannerViewProps) {
  const { getEmployeeLoadForWeek } = useAppOrDemo();
  const { currentAgency } = useAgency();
  const availableRoles = currentAgency?.settings?.roles || [];

  return (
    <div className="flex flex-col gap-3 p-3 pb-6 overflow-auto">
      {filteredEmployees.map((employee) => (
        <MobileEmployeeCard
          key={employee.id}
          employee={employee}
          weeks={weeks}
          allocations={allocations}
          viewDate={viewDate}
          getEmployeeLoadForWeek={getEmployeeLoadForWeek}
          getEmployeeMonthlyLoad={getEmployeeMonthlyLoad}
          onOpenSheet={onOpenSheet}
          availableRoles={availableRoles}
          cellVariant={cellVariant}
        />
      ))}
    </div>
  );
}

interface MobileEmployeeCardProps {
  employee: Employee;
  weeks: WeekData[];
  allocations: Allocation[];
  viewDate: Date;
  getEmployeeLoadForWeek: (employeeId: string, weekStartDate: string, effectiveStart?: Date, effectiveEnd?: Date, viewDate?: Date) => { hours: number; capacity: number; status: LoadStatus; percentage: number; baseCapacity: number; breakdown: { reason: string; hours: number; type: 'absence' | 'event' }[] };
  getEmployeeMonthlyLoad: (employeeId: string, year: number, month: number) => { hours: number; capacity: number; status: LoadStatus; percentage: number };
  onOpenSheet: (employeeId: string, weekStart: Date, autoAdd?: boolean) => void;
  availableRoles: RolePermissions[];
  cellVariant?: 'compact' | 'detailed';
}

function MobileEmployeeCard({
  employee,
  weeks,
  allocations,
  viewDate,
  getEmployeeLoadForWeek,
  getEmployeeMonthlyLoad,
  onOpenSheet,
  availableRoles,
  cellVariant = 'detailed',
}: MobileEmployeeCardProps) {
  const { t } = useTranslation('app');
  const dateLocale = useDateLocale();
  const displayRole = getValidRole(employee, availableRoles);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthlyLoad = getEmployeeMonthlyLoad(employee.id, year, month);

  const [weekIndex, setWeekIndex] = React.useState(() => {
    const idx = weeks.findIndex(w => isCurrentWeek(w.weekStart));
    return idx >= 0 ? idx : 0;
  });

  const safeWeekIndex = Math.min(Math.max(0, weekIndex), Math.max(0, weeks.length - 1));
  const week = weeks[safeWeekIndex];
  if (!week) return null;

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

  const isOverload = monthlyLoad.status === 'overload';
  const isWarning = monthlyLoad.status === 'warning';

  return (
    <Card className={cn(
      "overflow-hidden",
      isOverload && "border-red-200 bg-red-50/30",
      isWarning && "border-amber-200 bg-amber-50/20"
    )}>
      <CardHeader className="p-3 pb-2 flex flex-row items-center gap-3">
        <div
          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer active:opacity-80"
          onClick={() => onOpenSheet(employee.id, week.weekStart)}
          role="button"
          aria-label={t('planner.mobile.viewTasksOf', 'Ver tareas de {{name}}', { name: employee.name })}
        >
          <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm border border-indigo-200 shrink-0">
            {employee.avatarUrl ? (
              <img src={employee.avatarUrl} alt={employee.name} className="h-full w-full rounded-full object-cover" />
            ) : (
              employee.name.substring(0, 2).toUpperCase()
            )}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <SensitiveText kind="employee" id={employee.id} className="font-semibold text-sm text-foreground truncate">{employee.name}</SensitiveText>
            <span className="text-xs text-muted-foreground uppercase tracking-wider truncate">{displayRole}</span>
          </div>
        </div>
        <div className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-lg border text-center shrink-0",
          isOverload ? "bg-red-100 border-red-200 text-red-700" :
            isWarning ? "bg-amber-100 border-amber-200 text-amber-700" :
              "bg-slate-100 border-slate-200 text-slate-600"
        )}>
          {isOverload && <AlertTriangle className="h-4 w-4" />}
          {isWarning && <AlertTriangle className="h-4 w-4" />}
          <span className="text-base font-mono font-bold">{monthlyLoad.hours}h</span>
          <span className="text-xs opacity-80">/ {monthlyLoad.capacity}h</span>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-3">
        {/* Selector de semana: actual destacada + anterior/siguiente */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0 rounded-full"
            onClick={() => setWeekIndex(i => Math.max(0, i - 1))}
            disabled={safeWeekIndex === 0}
            aria-label={t('planner.mobile.prevWeek', 'Semana anterior')}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0 text-center">
            <span className={cn(
              "text-sm font-bold block",
              isCurrentWeek(week.weekStart) ? "text-primary" : "text-slate-600"
            )}>
              {t('planner.mobile.weekLabel', 'Semana {{number}}', { number: safeWeekIndex + 1 })}
            </span>
            <span className="text-xs text-slate-500">
              {format(week.weekStart, 'd MMM', { locale: dateLocale })} - {format(addDays(week.weekStart, 4), 'd MMM', { locale: dateLocale })}
            </span>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0 rounded-full"
            onClick={() => setWeekIndex(i => Math.min(weeks.length - 1, i + 1))}
            disabled={safeWeekIndex >= weeks.length - 1}
            aria-label={t('planner.mobile.nextWeek', 'Semana siguiente')}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        {/* Celda táctil 44x44 mínimo */}
        <div
          className="min-h-[44px] min-w-[44px] touch-manipulation"
          onClick={() => onOpenSheet(employee.id, week.weekStart)}
          role="button"
          aria-label={t('planner.mobile.editWeekHours', 'Editar horas semana {{number}}', { number: safeWeekIndex + 1 })}
        >
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
            touchTarget
            variant={cellVariant}
          />
        </div>
      </CardContent>
    </Card>
  );
}
