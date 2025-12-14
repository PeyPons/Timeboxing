import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { EmployeeRow } from './EmployeeRow';
import { AllocationSheet } from './AllocationSheet';
import { getWeeksForMonth, getMonthName, isCurrentWeek } from '@/utils/dateUtils';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CalendarDays, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function PlannerGrid() {
  const { employees, getEmployeeMonthlyLoad } = useApp();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedCell, setSelectedCell] = useState<{ employeeId: string; weekStart: string } | null>(null);

  const weeks = getWeeksForMonth(currentMonth);
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  // Filter only active employees
  const activeEmployees = employees.filter(e => e.isActive);

  const handlePrevMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setCurrentMonth(new Date());
  };

  const handleCellClick = (employeeId: string, weekStart: string) => {
    setSelectedCell({ employeeId, weekStart });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b bg-card px-4 sm:px-6 py-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl sm:text-2xl font-bold capitalize text-foreground">
            {getMonthName(currentMonth)}
          </h2>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={handlePrevMonth} className="h-8 w-8 sm:h-9 sm:w-9">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleToday} className="gap-2 h-8 sm:h-9 text-xs sm:text-sm">
              <CalendarDays className="h-4 w-4" />
              <span className="hidden sm:inline">Hoy</span>
            </Button>
            <Button variant="outline" size="icon" onClick={handleNextMonth} className="h-8 w-8 sm:h-9 sm:w-9">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-muted-foreground cursor-help">
                <Info className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">Semanas parciales</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs text-xs">
                Las semanas que no empiezan o terminan completas en el mes tienen la capacidad ajustada automáticamente.
              </p>
            </TooltipContent>
          </Tooltip>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-success" />
            <span className="text-muted-foreground">OK</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-warning" />
            <span className="text-muted-foreground">Ajustado</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-destructive" />
            <span className="text-muted-foreground">Exceso</span>
          </div>
        </div>
      </div>

      {/* Grid Container */}
      <div className="flex-1 overflow-auto p-3 sm:p-6">
        {/* Week Headers */}
        <div className="flex items-center gap-1 sm:gap-2 pb-3 min-w-fit">
          <div className="w-28 sm:w-48 flex-shrink-0" />
          
          {/* CORRECCIÓN: El contenedor flex solo envuelve las semanas */}
          <div className="flex flex-1 gap-1 sm:gap-2">
            {weeks.map((week, index) => {
              const isPartialWeek = week.effectiveStart && week.effectiveEnd && (
                week.effectiveStart.getTime() !== week.weekStart.getTime() ||
                week.effectiveEnd.getTime() !== week.weekEnd.getTime()
              );
              
              return (
                <div 
                  key={week.weekStart.toISOString()} 
                  className={cn(
                    "flex-1 min-w-0 text-center",
                    isCurrentWeek(week.weekStart) && "font-semibold text-primary"
                  )}
                >
                  <span className="block text-[10px] sm:text-xs font-semibold text-primary mb-0.5">
                    Semana {index + 1}
                  </span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">
                    {week.weekLabel}
                    {isPartialWeek && (
                      <span className="ml-1 text-primary" title="Semana parcial">*</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {/* CORRECCIÓN: La columna Total ahora está fuera del flex container de semanas */}
          <div className="w-16 sm:w-24 flex-shrink-0 text-center">
            <span className="text-[10px] sm:text-xs font-medium text-primary uppercase tracking-wide">
              Total
            </span>
          </div>
        </div>

        {/* Employee Rows */}
        <div className="divide-y divide-border/50 min-w-fit">
          {activeEmployees.map((employee) => {
            const monthlyLoad = getEmployeeMonthlyLoad(employee.id, year, month);
            
            return (
              <div key={employee.id} className="flex items-center gap-1 sm:gap-2">
                <EmployeeRow
                  employee={employee}
                  weeks={weeks}
                  onCellClick={handleCellClick}
                />
                {/* Monthly Total */}
                <div className={cn(
                  "w-16 sm:w-24 flex-shrink-0 py-1 sm:py-2 px-1 sm:px-2 rounded-lg text-center border-2",
                  monthlyLoad.status === 'overload' && "bg-destructive/10 border-destructive/30",
                  monthlyLoad.status === 'warning' && "bg-warning/10 border-warning/30",
                  monthlyLoad.status === 'healthy' && "bg-success/10 border-success/30",
                  monthlyLoad.status === 'empty' && "bg-muted/30 border-muted"
                )}>
                  <span className={cn(
                    "text-xs sm:text-sm font-bold",
                    monthlyLoad.status === 'overload' && "text-destructive",
                    monthlyLoad.status === 'warning' && "text-warning",
                    monthlyLoad.status === 'healthy' && "text-success",
                    monthlyLoad.status === 'empty' && "text-muted-foreground"
                  )}>
                    {monthlyLoad.hours}h
                  </span>
                  <span className="block text-[10px] sm:text-xs text-muted-foreground">
                    / {monthlyLoad.capacity}h
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {activeEmployees.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No hay empleados activos para mostrar
          </div>
        )}
      </div>

      {/* Allocation Sheet */}
      {selectedCell && (
        <AllocationSheet
          open={!!selectedCell}
          onOpenChange={(open) => !open && setSelectedCell(null)}
          employeeId={selectedCell.employeeId}
          weekStart={selectedCell.weekStart}
        />
      )}
    </div>
  );
}
