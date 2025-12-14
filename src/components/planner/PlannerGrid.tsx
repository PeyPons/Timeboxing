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
  
  // ✅ CAMBIO: LÓGICA DE "MES ACTUAL"
  const handleToday = () => setCurrentMonth(new Date());
  
  const handleCellClick = (employeeId: string, weekStart: string) => setSelectedCell({ employeeId, weekStart });

  // 📐 ESTRUCTURA MAESTRA DEL GRID:
  // 250px (Fijo para empleado) | X columnas (1fr cada una) | 100px (Fijo para total)
  const gridTemplate = `250px repeat(${weeks.length}, minmax(0, 1fr)) 100px`;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 rounded-lg border shadow-sm overflow-hidden">
      {/* --- CABECERA DE CONTROLES --- */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b bg-card px-4 py-4 z-20 relative">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold capitalize text-foreground">{getMonthName(currentMonth)}</h2>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={handlePrevMonth}><ChevronLeft className="h-4 w-4" /></Button>
            {/* ✅ BOTÓN RENOMBRADO A MES ACTUAL */}
            <Button variant="outline" size="sm" onClick={handleToday} className="gap-2 h-9">
                <CalendarDays className="h-4 w-4" />
                <span className="hidden sm:inline">Mes Actual</span>
            </Button>
            <Button variant="outline" size="icon" onClick={handleNextMonth}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
        
        <div className="flex items-center gap-3 text-xs">
          <Tooltip>
             <TooltipTrigger className="flex items-center gap-1 text-muted-foreground"><Info className="h-4 w-4" /> Semanas parciales</TooltipTrigger>
             <TooltipContent>Las semanas incompletas tienen la capacidad ajustada.</TooltipContent>
          </Tooltip>
          <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-green-500" /> <span className="text-muted-foreground">OK</span></div>
          <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-yellow-500" /> <span className="text-muted-foreground">Ajustado</span></div>
          <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-red-500" /> <span className="text-muted-foreground">Exceso</span></div>
        </div>
      </div>

      {/* --- CUERPO DEL PLANIFICADOR --- */}
      <div className="flex-1 overflow-auto custom-scrollbar bg-slate-50/50 dark:bg-slate-900/50">
        <div style={{ minWidth: '1000px' }}> {/* Contenedor ancho mínimo para evitar colapsos */}
            
            {/* 1. CABECERA DE COLUMNAS (STICKY) */}
            <div className="grid sticky top-0 z-10 bg-white dark:bg-slate-950 border-b shadow-sm" style={{ gridTemplateColumns: gridTemplate }}>
                {/* Columna Equipo */}
                <div className="px-4 py-3 font-bold text-sm text-slate-700 dark:text-slate-200 border-r flex items-center bg-slate-50 dark:bg-slate-900">
                    Equipo ({activeEmployees.length})
                </div>
                
                {/* Columnas Semanas */}
                {weeks.map((week, index) => {
                    const isPartial = week.effectiveStart && week.effectiveEnd && (week.effectiveStart.getTime() !== week.weekStart.getTime() || week.effectiveEnd.getTime() !== week.weekEnd.getTime());
                    return (
                        <div key={week.weekStart.toISOString()} className={cn("text-center px-1 py-2 border-r last:border-r-0 flex flex-col justify-center", isCurrentWeek(week.weekStart) ? "bg-indigo-50/50 dark:bg-indigo-950/30" : "")}>
                            <span className={cn("text-xs font-bold uppercase tracking-wider", isCurrentWeek(week.weekStart) ? "text-indigo-600" : "text-slate-500")}>
                                Semana {index + 1}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                                {week.weekLabel} {isPartial && '*'}
                            </span>
                        </div>
                    );
                })}
                
                {/* Columna Total */}
                <div className="px-2 py-3 font-bold text-xs text-center text-slate-700 border-l bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
                    TOTAL MES
                </div>
            </div>

            {/* 2. FILAS DE EMPLEADOS */}
            <div>
                {activeEmployees.map((employee) => {
                    const monthlyLoad = getEmployeeMonthlyLoad(employee.id, year, month);
                    return (
                        <div key={employee.id} className="grid border-b hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors group bg-white dark:bg-slate-950" style={{ gridTemplateColumns: gridTemplate }}>
                            
                            {/* Componente Row */}
                            <EmployeeRow 
                                employee={employee} 
                                weeks={weeks} 
                                onCellClick={handleCellClick} 
                            />
                            
                            {/* Celda Total Mensual */}
                            <div className="flex items-center justify-center border-l p-2 bg-slate-50/30 dark:bg-slate-900/30">
                                <div className={cn(
                                    "flex flex-col items-center justify-center w-16 h-12 rounded-lg border-2",
                                    monthlyLoad.status === 'overload' ? "bg-red-50 border-red-200 text-red-700" :
                                    monthlyLoad.status === 'warning' ? "bg-yellow-50 border-yellow-200 text-yellow-700" :
                                    monthlyLoad.status === 'healthy' ? "bg-green-50 border-green-200 text-green-700" :
                                    "bg-slate-50 border-slate-200 text-slate-400"
                                )}>
                                    <span className="text-sm font-bold leading-none">{monthlyLoad.hours}h</span>
                                    <span className="text-[10px] opacity-70">/ {monthlyLoad.capacity}h</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
                
                {activeEmployees.length === 0 && (
                    <div className="p-12 text-center text-muted-foreground">
                        No hay empleados activos.
                    </div>
                )}
            </div>
        </div>
      </div>

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
