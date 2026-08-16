/**
 * Cabecera de la página Deadlines: título, selector de mes, copiar/resetear mes, botón Equipo (móvil).
 */

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronLeft, ChevronRight, Copy, Trash2, PanelRight } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useDateLocale } from '@/hooks/useDateLocale';
import {
  DeadlinesAvailabilityCard,
  type CapacityData,
} from '@/components/deadlines/DeadlinesAvailabilityCard';

export interface EmployeeOption {
  id: string;
  name: string;
  first_name?: string;
  avatarUrl?: string;
}

export interface DeadlinesPageHeaderProps {
  currentMonthDate: Date;
  onPrevMonth: () => void;
  prevMonthDisabled?: boolean;
  onNextMonth: () => void;
  canEditDeadlines: boolean;
  onCopyFromPreviousMonth: () => void;
  onDeleteMonth: () => void;
  isMobile: boolean;
  /** Solo para el Sheet "Equipo" en móvil */
  employees?: EmployeeOption[];
  getMonthlyCapacity?: (employeeId: string) => CapacityData;
  getEmployeeAssignedHours?: (employeeId: string) => number;
}

export function DeadlinesPageHeader({
  currentMonthDate,
  onPrevMonth,
  prevMonthDisabled = false,
  onNextMonth,
  canEditDeadlines,
  onCopyFromPreviousMonth,
  onDeleteMonth,
  isMobile,
  employees = [],
  getMonthlyCapacity = () => ({
    total: 0,
    absenceHours: 0,
    eventHours: 0,
    available: 0,
    absenceDetails: [],
    eventDetails: [],
  }),
  getEmployeeAssignedHours = () => 0,
}: DeadlinesPageHeaderProps) {
  const { t } = useTranslation('app');
  const dateLocale = useDateLocale();

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center justify-between gap-3 z-20',
        isMobile && 'sticky top-0 bg-slate-50 pt-2 pb-2 -mx-4 px-4 md:mx-0 md:px-0 border-b border-slate-200'
      )}
    >
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900">{t('deadlines.page.title', 'Deadline')}</h1>
        <p className="text-xs md:text-sm text-slate-500">{t('deadlines.page.subtitle', 'Asignación mensual de horas')}</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1" data-tour="month-selector">
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-7 w-7 md:h-8 md:w-8', isMobile && 'h-11 w-11')}
            onClick={onPrevMonth}
            disabled={prevMonthDisabled}
            aria-label={t('deadlines.page.prevMonth', 'Mes anterior')}
          >
            <ChevronLeft className={cn('h-4 w-4', isMobile && 'h-5 w-5')} />
          </Button>
          <span className="text-xs md:text-sm font-medium px-1 md:px-2 min-w-[90px] md:min-w-[140px] text-center capitalize">
            {format(currentMonthDate, isMobile ? 'MMM yy' : 'MMMM yyyy', { locale: dateLocale })}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-7 w-7 md:h-8 md:w-8', isMobile && 'h-11 w-11')}
            onClick={onNextMonth}
            aria-label={t('deadlines.page.nextMonth', 'Mes siguiente')}
          >
            <ChevronRight className={cn('h-4 w-4', isMobile && 'h-5 w-5')} />
          </Button>
        </div>
        {canEditDeadlines && (
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={onCopyFromPreviousMonth} className="h-8 w-8 p-0">
                    <Copy className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('deadlines.page.copyFromPrevious', 'Copiar del mes anterior')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onDeleteMonth}
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('deadlines.page.resetMonth', 'Resetear mes completo (Eliminar todo)')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
        {isMobile && employees.length > 0 && (
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 shrink-0 px-2.5"
                aria-label={t('deadlines.page.team', 'Equipo')}
              >
                <PanelRight className="h-4 w-4 shrink-0" />
                <span className="text-xs whitespace-nowrap">{t('deadlines.page.team', 'Equipo')}</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] max-w-xs p-4 overflow-y-auto">
              <SheetHeader className="mb-4">
                <SheetTitle className="text-base">{t('deadlines.page.teamAvailability', 'Disponibilidad del equipo')}</SheetTitle>
              </SheetHeader>
              <div className="space-y-4">
                <DeadlinesAvailabilityCard
                  employees={employees}
                  getMonthlyCapacity={getMonthlyCapacity}
                  getEmployeeAssignedHours={getEmployeeAssignedHours}
                  compact
                  className="bg-slate-50 border-0 shadow-none p-0"
                />
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </div>
  );
}
