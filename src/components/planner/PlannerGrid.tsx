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

  const activeEmployees = employees.filter(e => e.isActive);

  const handlePrevMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  const handleToday = () => setCurrentMonth(new Date());
  const handleCellClick = (employeeId: string, weekStart: string) => setSelectedCell({ employeeId, weekStart });

  // ✅ ESTILO CORREGIDO PARA 5 SEMANAS:
  // Usamos un Grid CSS real en lugar de Flexbox para alinear perfectamente cabeceras y filas.
  // 250px (empleado) + X columnas iguales (semanas) + 80px (total)
  const gridTemplate = `250px repeat(${weeks.length}, minmax(0, 1fr)) 80px`;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 rounded-lg border shadow-sm">
      {/* Header Controls (Mantenido igual) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b bg-card px-4 py-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold capitalize text-foreground">{getMonthName(currentMonth)}</h2>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={handlePrevMonth}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={handleToday}><CalendarDays className="h-4 w-4 mr-2" />Hoy</Button>
            <Button variant="outline" size="icon" onClick={handleNextMonth}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
        
        {/* Leyenda (Mantenida) */}
        <div className="flex items-center gap-3 text-xs">
          <Tooltip>
             <TooltipTrigger className="flex items-center gap-1 text-muted-foreground"><Info className="h-4 w-4" /> Semanas parciales</TooltipTrigger>
             <TooltipContent>Las semanas incompletas tienen la capacidad ajustada.</TooltipContent>
          </Tooltip>
          <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-success" /> <span className="text-muted-foreground">OK</span></div>
          <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-warning" /> <span className="text-muted-foreground">Ajustado</span></div>
          <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-destructive" /> <span className="text-muted-foreground">Exceso</span></div>
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">
        {/* ✅ CABECERA DEL GRID CON ESTILO DINÁMICO */}
        <div className="grid sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 border-b items-center" style={{ gridTemplateColumns: gridTemplate, minWidth: '1000px' }}>
             {/* Columna Empleado */}
             <div className="px-6 py-3 font-semibold text-sm text-muted-foreground">Equipo</div>
             
             {/* Columnas Semanas */}
             {weeks.map((week, index) => {
                 const isPartial = week.effectiveStart && week.effectiveEnd && (week.effectiveStart.getTime() !== week.weekStart.getTime() || week.effectiveEnd.getTime() !== week.weekEnd.getTime());
                 return (
                    <div key={week.weekStart.toISOString()} className={cn("text-center px-1 py-2 border-l border-transparent", isCurrentWeek(week.weekStart) && "bg-primary/5")}>
                        <span className={cn("block text-xs font-semibold mb-0.5", isCurrentWeek(week.weekStart) ? "text-primary" : "text-muted-foreground")}>
                            Semana {index + 1}
                        </span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide block">
                            {week.weekLabel} {isPartial && '*'}
                        </span>
                    </div>
                 );
             })}
             
             {/* Columna Total */}
             <div className="text-center px-2 py-3 font-semibold text-xs text-muted-foreground border-l">TOTAL</div>
        </div>

        {/* ✅ FILAS DEL GRID */}
        <div className="min-w-[1000px]"> 
            {activeEmployees.map((employee) => {
                const monthlyLoad = getEmployeeMonthlyLoad(employee.id, year, month);
                return (
                    <div key={employee.id} className="grid items-stretch border-b hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors" style={{ gridTemplateColumns: gridTemplate }}>
                        {/* Componente Row (Pasamos props para que se encargue de renderizar celdas, pero controlamos el layout aquí) */}
                        <EmployeeRow employee={employee} weeks={weeks} onCellClick={handleCellClick} />
                        
                        {/* Celda Total Mensual */}
                        <div className="flex items-center justify-center border-l p-2 bg-slate-50/30">
                            <div className={cn("px-2 py-1 rounded text-center min-w-[3rem]", 
                                monthlyLoad.status === 'overload' ? "bg-destructive/10 text-destructive font-bold" : 
                                monthlyLoad.status === 'warning' ? "bg-warning/10 text-warning font-medium" : 
                                "bg-success/10 text-success/80 font-medium")}>
                                <span className="text-xs">{monthlyLoad.hours}h</span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
      </div>

      {selectedCell && (
        <AllocationSheet open={!!selectedCell} onOpenChange={(open) => !open && setSelectedCell(null)} employeeId={selectedCell.employeeId} weekStart={selectedCell.weekStart} />
      )}
    </div>
  );
}
