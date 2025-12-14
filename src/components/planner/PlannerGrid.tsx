import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { EmployeeRow } from './EmployeeRow';
import { AllocationSheet } from './AllocationSheet';
import { getWeeksForMonth, getMonthName, isCurrentWeek } from '@/utils/dateUtils';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CalendarDays, Info, Filter, Sparkles, User, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { format, max, min, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

export function PlannerGrid() {
  const { employees, getEmployeeMonthlyLoad } = useApp();
  
  const [currentMonth, setCurrentMonth] = useState(() => {
    const saved = localStorage.getItem('planner_date');
    return saved ? new Date(saved) : new Date();
  });

  const [selectedTeam, setSelectedTeam] = useState<string>(() => {
    return localStorage.getItem('planner_team') || 'all';
  });

  const [showOnlyMe, setShowOnlyMe] = useState(() => {
    return localStorage.getItem('planner_only_me') === 'true';
  });

  const [selectedCell, setSelectedCell] = useState<{ employeeId: string; weekStart: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [insights, setInsights] = useState<{ type: 'warning' | 'success' | 'info', text: string }[] | null>(null);

  useEffect(() => {
    localStorage.setItem('planner_date', currentMonth.toISOString());
  }, [currentMonth]);

  useEffect(() => {
    localStorage.setItem('planner_team', selectedTeam);
  }, [selectedTeam]);

  useEffect(() => {
    localStorage.setItem('planner_only_me', String(showOnlyMe));
  }, [showOnlyMe]);

  const weeks = getWeeksForMonth(currentMonth);
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  // Límites del mes actual para "recortar" visualmente
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const teams = useMemo(() => {
    const roles = new Set(employees.map(e => e.role || 'Sin Equipo'));
    return Array.from(roles);
  }, [employees]);

  const filteredEmployees = employees.filter(e => {
    if (!e.isActive) return false;
    if (showOnlyMe) {
        return e.name.toLowerCase().includes("alex");
    }
    if (selectedTeam !== 'all' && e.role !== selectedTeam) return false;
    return true;
  });

  const handlePrevMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  const handleToday = () => setCurrentMonth(new Date());
  const handleCellClick = (employeeId: string, weekStart: string) => setSelectedCell({ employeeId, weekStart });

  const handleAnalyze = () => {
    setIsAnalyzing(true);
    setInsights(null);
    setTimeout(() => {
        const newInsights: { type: 'warning' | 'success' | 'info', text: string }[] = [];
        const overloadedEmployees = filteredEmployees.filter(e => {
            const load = getEmployeeMonthlyLoad(e.id, year, month);
            return load.status === 'overload';
        });
        if (overloadedEmployees.length > 0) {
            newInsights.push({
                type: 'warning',
                text: `⚠️ Detectada sobrecarga en: ${overloadedEmployees.map(e => e.name).join(', ')}.`
            });
        }
        const freeEmployees = filteredEmployees.filter(e => {
            const load = getEmployeeMonthlyLoad(e.id, year, month);
            return load.percentage < 50;
        });
        if (freeEmployees.length > 0) {
            newInsights.push({
                type: 'success',
                text: `✅ Capacidad disponible: ${freeEmployees.length} personas tienen baja carga.`
            });
        }
        if (newInsights.length === 0) {
            newInsights.push({ type: 'info', text: "👍 Todo parece equilibrado." });
        }
        setInsights(newInsights);
        setIsAnalyzing(false);
    }, 1500);
  };

  const gridTemplate = `250px repeat(${weeks.length}, minmax(0, 1fr)) 100px`;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 rounded-lg border shadow-sm overflow-hidden">
      <div className="flex flex-col gap-4 border-b bg-card px-4 py-3 z-20 relative">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold capitalize text-foreground flex items-center gap-2">
                {getMonthName(currentMonth)}
                <Badge variant="outline" className="text-xs font-normal text-muted-foreground hidden sm:flex">
                    {year}
                </Badge>
            </h2>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-md p-0.5">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrevMonth}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={handleToday} className="h-7 text-xs px-2"><CalendarDays className="h-3.5 w-3.5 mr-1.5" />Mes Actual</Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNextMonth}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            </div>

            <Popover>
                <PopoverTrigger asChild>
                    <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 h-9 shadow-sm">
                        <Sparkles className="h-4 w-4" />
                        <span className="hidden sm:inline">Insights IA</span>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                    <div className="bg-indigo-50 dark:bg-indigo-900/30 p-3 border-b flex items-center gap-2">
                        <div className="bg-white dark:bg-indigo-950 p-1 rounded-full"><Sparkles className="h-4 w-4 text-indigo-600" /></div>
                        <span className="font-semibold text-sm">Minguito sugiere:</span>
                    </div>
                    <div className="p-4">
                        {!isAnalyzing && !insights && (
                            <div className="flex flex-col items-center gap-3 py-2 text-center">
                                <p className="text-sm text-muted-foreground">Analiza la carga de trabajo actual.</p>
                                <Button onClick={handleAnalyze} size="sm" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"><Sparkles className="h-3.5 w-3.5 mr-2" /> Analizar Carga</Button>
                            </div>
                        )}
                        {isAnalyzing && (
                            <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
                                <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
                                <span className="text-sm text-muted-foreground animate-pulse">Analizando...</span>
                            </div>
                        )}
                        {insights && (
                            <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                                {insights.map((insight, i) => (
                                    <div key={i} className={cn("border rounded p-2 text-xs", insight.type === 'warning' ? "bg-amber-50 border-amber-200 text-amber-800" : insight.type === 'success' ? "bg-green-50 border-green-200 text-green-800" : "bg-blue-50 border-blue-200 text-blue-800")}>{insight.text}</div>
                                ))}
                                <Button onClick={handleAnalyze} size="sm" variant="outline" className="w-full text-xs mt-2 h-7"><RefreshCw className="h-3 w-3 mr-2" /> Re-analizar</Button>
                            </div>
                        )}
                    </div>
                </PopoverContent>
            </Popover>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                        <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="Todos los equipos" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">Todos los equipos</SelectItem>{teams.map(team => (<SelectItem key={team} value={team}>{team}</SelectItem>))}</SelectContent>
                    </Select>
                </div>
                <Button variant={showOnlyMe ? "secondary" : "outline"} size="sm" onClick={() => setShowOnlyMe(!showOnlyMe)} className={cn("h-8 text-xs gap-2 transition-colors", showOnlyMe ? "bg-indigo-100 text-indigo-700 border-indigo-200" : "")}><User className="h-3.5 w-3.5" /> Solo Yo</Button>
            </div>
            <div className="flex items-center gap-3 text-xs flex-shrink-0">
                <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-green-500" /> <span className="text-muted-foreground">85-95% (Ideal)</span></div>
                <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-yellow-500" /> <span className="text-muted-foreground">Ajustado</span></div>
                <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-red-500" /> <span className="text-muted-foreground">Exceso</span></div>
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar bg-slate-50/50 dark:bg-slate-900/50">
        <div style={{ minWidth: '1000px' }}>
            <div className="grid sticky top-0 z-10 bg-white dark:bg-slate-950 border-b shadow-sm" style={{ gridTemplateColumns: gridTemplate }}>
                <div className="px-4 py-3 font-bold text-sm text-slate-700 dark:text-slate-200 border-r flex items-center bg-slate-50 dark:bg-slate-900">Equipo ({filteredEmployees.length})</div>
                {weeks.map((week, index) => {
                    // ✅ LÓGICA DE RECORTE VISUAL: Mostramos la fecha real recortada por el mes
                    const visualStart = max([week.weekStart, monthStart]);
                    const visualEnd = min([week.weekEnd, monthEnd]);
                    
                    return (
                        <div key={week.weekStart.toISOString()} className={cn("text-center px-1 py-2 border-r last:border-r-0 flex flex-col justify-center", isCurrentWeek(week.weekStart) ? "bg-indigo-50/50 dark:bg-indigo-950/30" : "")}>
                            <span className={cn("text-xs font-bold uppercase tracking-wider", isCurrentWeek(week.weekStart) ? "text-indigo-600" : "text-slate-500")}>
                                Semana {index + 1}
                            </span>
                            {/* ✅ FECHAS EXACTAS DEL MES: "1 Ene - 4 Ene" en lugar de "29 Dic - 4 Ene" */}
                            <span className="text-[10px] text-slate-400 font-medium">
                                {format(visualStart, 'd MMM', { locale: es })} - {format(visualEnd, 'd MMM', { locale: es })}
                            </span>
                        </div>
                    );
                })}
                <div className="px-2 py-3 font-bold text-xs text-center text-slate-700 border-l bg-slate-50 dark:bg-slate-900 flex items-center justify-center">TOTAL MES</div>
            </div>

            <div>
                {filteredEmployees.map((employee) => {
                    const monthlyLoad = getEmployeeMonthlyLoad(employee.id, year, month);
                    return (
                        <div key={employee.id} className="grid border-b hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors group bg-white dark:bg-slate-950" style={{ gridTemplateColumns: gridTemplate }}>
                            <EmployeeRow employee={employee} weeks={weeks} onCellClick={handleCellClick} />
                            <div className="flex items-center justify-center border-l p-2 bg-slate-50/30 dark:bg-slate-900/30">
                                <div className={cn("flex flex-col items-center justify-center w-16 h-12 rounded-lg border-2", monthlyLoad.status === 'overload' ? "bg-red-50 border-red-200 text-red-700" : monthlyLoad.status === 'warning' ? "bg-yellow-50 border-yellow-200 text-yellow-700" : monthlyLoad.status === 'healthy' ? "bg-green-50 border-green-200 text-green-700" : "bg-slate-50 border-slate-200 text-slate-400")}>
                                    <span className="text-sm font-bold leading-none">{monthlyLoad.hours}h</span>
                                    <span className="text-[10px] opacity-70">/ {monthlyLoad.capacity}h</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
                {filteredEmployees.length === 0 && <div className="p-12 text-center text-muted-foreground">No se encontraron empleados.</div>}
            </div>
        </div>
      </div>

      {selectedCell && <AllocationSheet open={!!selectedCell} onOpenChange={(open) => !open && setSelectedCell(null)} employeeId={selectedCell.employeeId} weekStart={selectedCell.weekStart} />}
    </div>
  );
}
