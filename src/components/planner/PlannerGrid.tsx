import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { EmployeeRow } from './EmployeeRow';
import { AllocationSheet } from './AllocationSheet';
import { getWeeksForMonth, getMonthName, isCurrentWeek, getMonthlyCapacity } from '@/utils/dateUtils';
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
      <div className="flex items-center justify-between border-b bg-card px-6 py-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold capitalize text-foreground">
            {getMonthName(currentMonth)}
          </h2>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={handlePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleToday} className="gap-2">
              <CalendarDays className="h-4 w-4" />
              Hoy
            </Button>
            <Button variant="outline" size="icon" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-sm">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-muted-foreground cursor-help">
                <Info className="h-4 w-4" />
                <span className="text-xs">Semanas parciales</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs text-xs">
                Las semanas que no empiezan o terminan completas en el mes tienen la capacidad ajustada automáticamente.
              </p>
            </TooltipContent>
          </Tooltip>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-success" />
            <span className="text-muted-foreground">Saludable</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-warning" />
            <span className="text-muted-foreground">Ajustado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-destructive" />
            <span className="text-muted-foreground">Sobrecarga</span>
          </div>
        </div>
      </div>

      {/* Grid Container */}
      <div className="flex-1 overflow-auto p-6">
        {/* Week Headers */}
        <div className="flex items-center gap-2 pb-3">
          <div className="w-48 flex-shrink-0" />
          <div className="flex flex-1 gap-2">
            {weeks.map((week, index) => {
              const isPartialWeek = week.effectiveStart && week.effectiveEnd && (
                week.effectiveStart.getTime() !== week.weekStart.getTime() ||
                week.effectiveEnd.getTime() !== week.weekEnd.getTime()
              );
              
              return (
                <div 
                  key={week.weekStart.toISOString()} 
                  className={cn(
                    "flex-1 min-w-[80px] text-center",
                    isCurrentWeek(week.weekStart) && "font-semibold text-primary"
                  )}
                >
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    {week.weekLabel}
                    {isPartialWeek && (
                      <span className="ml-1 text-primary" title="Semana parcial">*</span>
                    )}
                  </span>
                </div>
              );
            })}
            {/* Monthly Total Column */}
            <div className="w-24 flex-shrink-0 text-center">
              <span className="text-xs font-medium text-primary uppercase tracking-wide">
                Total
              </span>
            </div>
          </div>
        </div>

        {/* Employee Rows */}
        <div className="divide-y divide-border/50">
          {employees.map((employee) => {
            const monthlyLoad = getEmployeeMonthlyLoad(employee.id, year, month);
            
            return (
              <div key={employee.id} className="flex items-center gap-2">
                <EmployeeRow
                  employee={employee}
                  weeks={weeks}
                  onCellClick={handleCellClick}
                />
                {/* Monthly Total */}
                <div className={cn(
                  "w-24 flex-shrink-0 py-2 px-2 rounded-lg text-center border-2",
                  monthlyLoad.status === 'overload' && "bg-destructive/10 border-destructive/30",
                  monthlyLoad.status === 'warning' && "bg-warning/10 border-warning/30",
                  monthlyLoad.status === 'healthy' && "bg-success/10 border-success/30",
                  monthlyLoad.status === 'empty' && "bg-muted/30 border-muted"
                )}>
                  <span className={cn(
                    "text-sm font-bold",
                    monthlyLoad.status === 'overload' && "text-destructive",
                    monthlyLoad.status === 'warning' && "text-warning",
                    monthlyLoad.status === 'healthy' && "text-success",
                    monthlyLoad.status === 'empty' && "text-muted-foreground"
                  )}>
                    {monthlyLoad.hours}h
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    / {monthlyLoad.capacity}h
                  </span>
                </div>
              </div>
            );
          })}
        </div>
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
