import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { EmployeeRow } from './EmployeeRow';
import { AllocationSheet } from './AllocationSheet';
import { WeekData } from '@/types';
import { getWeeksForMonth, getMonthName, isCurrentWeek } from '@/utils/dateUtils';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PlannerGrid() {
  const { employees } = useApp();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedCell, setSelectedCell] = useState<{ employeeId: string; weekStart: string } | null>(null);

  const weeks = getWeeksForMonth(currentMonth);

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
            {weeks.map((week) => (
              <div 
                key={week.weekStart.toISOString()} 
                className={cn(
                  "flex-1 min-w-[80px] text-center",
                  isCurrentWeek(week.weekStart) && "font-semibold text-primary"
                )}
              >
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                  {week.weekLabel}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Employee Rows */}
        <div className="divide-y divide-border/50">
          {employees.map((employee) => (
            <EmployeeRow
              key={employee.id}
              employee={employee}
              weeks={weeks}
              onCellClick={handleCellClick}
            />
          ))}
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
