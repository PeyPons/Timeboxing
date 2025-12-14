import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { EmployeeRow } from './EmployeeRow';
import { AllocationSheet } from './AllocationSheet';
import { getWeeksForMonth, getMonthName, isCurrentWeek, getStorageKey } from '@/utils/dateUtils'; // Asegúrate de tener getStorageKey importado
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CalendarDays, Filter, Sparkles, User, Loader2, RefreshCw, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { format, max, min, startOfMonth, endOfMonth, parseISO, isSameMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { GoogleGenerativeAI } from "@google/generative-ai";

export function PlannerGrid() {
  // ✅ Importamos projects y allocations para los filtros
  const { employees, getEmployeeMonthlyLoad, projects, allocations } = useApp();
  
  const [currentMonth, setCurrentMonth] = useState(() => {
    const saved = localStorage.getItem('planner_date');
    return saved ? new Date(saved) : new Date();
  });

  // ✅ NUEVOS ESTADOS DE FILTRO
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  
  const [showOnlyMe, setShowOnlyMe] = useState(() => localStorage.getItem('planner_only_me') === 'true');
  const [selectedCell, setSelectedCell] = useState<{ employeeId: string; weekStart: string } | null>(null);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [insights, setInsights] = useState<{ type: 'warning' | 'success' | 'info', text: string }[] | null>(null);

  useEffect(() => { localStorage.setItem('planner_date', currentMonth.toISOString()); }, [currentMonth]);
  useEffect(() => { localStorage.setItem('planner_only_me', String(showOnlyMe)); }, [showOnlyMe]);

  const weeks = getWeeksForMonth(currentMonth);
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  // ✅ LÓGICA DE FILTRADO AVANZADA
  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
        if (!e.isActive) return false;
        
        // 1. Filtro "Solo Yo" (Prioridad alta o combinable)
        if (showOnlyMe && !e.name.toLowerCase().includes("alex")) return false;

        // 2. Filtro por Empleado Específico
        if (selectedEmployeeId !== 'all' && e.id !== selectedEmployeeId) return false;

        // 3. Filtro por Proyecto (El más interesante)
        if (selectedProjectId !== 'all') {
            // Buscamos si este empleado tiene asignaciones en este proyecto DENTRO del mes actual
            const hasAllocationInProject = allocations.some(a => {
                const allocDate = parseISO(a.weekStartDate);
                return a.projectId === selectedProjectId && 
                       a.employeeId === e.id && 
                       isSameMonth(allocDate, currentMonth);
            });
            if (!hasAllocationInProject) return false;
        }

        return true;
    });
  }, [employees, showOnlyMe, selectedEmployeeId, selectedProjectId, allocations, currentMonth]);

  const handlePrevMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  const handleToday = () => setCurrentMonth(new Date());
  
  const handleCellClick = (employeeId: string, weekStart: string) => setSelectedCell({ employeeId, weekStart });

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setInsights(null);
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
        setInsights([{ type: 'warning', text: '⚠️ Falta API Key en .env' }]);
        setIsAnalyzing(false);
        return;
    }
    try {
        const staffData = filteredEmployees.map(e => {
            const load = getEmployeeMonthlyLoad(e.id, year, month);
            return { role: e.role, load: load.percentage };
        });
        const prompt = `Analiza carga ${getMonthName(currentMonth)}: ${JSON.stringify(staffData)}. Responde JSON array: [{"type":"warning"|"success"|"info","text":"..."}]`;
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        const json = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        setInsights(JSON.parse(json));
    } catch (e) {
        setInsights([{ type: 'warning', text: 'Error de IA' }]);
    } finally {
        setIsAnalyzing(false);
    }
  };

  const gridTemplate = `250px repeat(${weeks.length}, minmax(0, 1fr)) 100px`;

  // Ordenar proyectos alfabéticamente para el select
  const sortedProjects = useMemo(() => [...projects].sort((a,b) => a.name.localeCompare(b.name)), [projects]);
  const sortedEmployees = useMemo(() => [...employees].filter(e=>e.isActive).sort((a,b) => a.name.localeCompare(b.name)), [employees]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 rounded-lg border shadow-sm overflow-hidden">
      <div className="flex flex-col gap-4 border-b bg-card px-4 py-3 z-20 relative">
        
        {/* Cabecera Superior: Título y Navegación Mes */}
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold capitalize text-foreground flex items-center gap-2">{getMonthName(currentMonth)} <Badge variant="outline" className="text-xs font-normal hidden sm:flex">{year}</Badge></h2>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-md p-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrevMonth}><ChevronLeft className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={handleToday} className="h-7 text-xs px-2"><CalendarDays className="h-3.5 w-3.5 mr-1.5" />Mes Actual</Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNextMonth}><ChevronRight className="h-4 w-4" /></Button>
                </div>
            </div>
            
            {/* Botón IA */}
            <Popover>
                <PopoverTrigger asChild>
                    <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 h-9 shadow-sm"><Sparkles className="h-4 w-4" /><span className="hidden sm:inline">Insights IA</span></Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                    <div className="bg-indigo-50 dark:bg-indigo-900/30 p-3 border-b flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-indigo-600" /><span className="font-semibold text-sm">Minguito sugiere:</span>
                    </div>
                    <div className="p-4">
                        {!isAnalyzing && !insights && (
                            <div className="text-center py-2"><p className="text-sm text-muted-foreground mb-2">Analiza la carga actual.</p><Button size="sm" onClick={handleAnalyze} className="w-full bg-indigo-600 text-white">Analizar</Button></div>
                        )}
                        {isAnalyzing && <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-600" /><span className="text-xs text-muted-foreground">Pensando...</span></div>}
                        {insights && <div className="space-y-2">{insights.map((i, k) => <div key={k} className={cn("text-xs p-2 rounded border", i.type==='warning'?"bg-amber-50 border-amber-200":i.type==='success'?"bg-green-50 border-green-200":"bg-blue-50 border-blue-200")}>{i.text}</div>)}<Button size="sm" variant="outline" className="w-full text-xs h-7 mt-2" onClick={handleAnalyze}><RefreshCw className="h-3 w-3 mr-2" />Re-analizar</Button></div>}
                    </div>
                </PopoverContent>
            </Popover>
        </div>

        {/* Cabecera Inferior: Filtros */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                {/* 1. Filtro Empleado */}
                <div className="flex items-center gap-2 w-[180px]">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                        <SelectTrigger className="h-8 text-xs w-full bg-white"><SelectValue placeholder="Todos los empleados" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los empleados</SelectItem>
                            {sortedEmployees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                {/* 2. Filtro Proyecto */}
                <div className="flex items-center gap-2 w-[180px]">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                        <SelectTrigger className="h-8 text-xs w-full bg-white"><SelectValue placeholder="Todos los proyectos" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los proyectos</SelectItem>
                            {sortedProjects.filter(p => p.status === 'active').map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* 3. Botón Solo Yo */}
                <Button variant={showOnlyMe?"secondary":"outline"} size="sm" onClick={()=>setShowOnlyMe(!showOnlyMe)} className={cn("h-8 text-xs gap-2 ml-auto sm:ml-0", showOnlyMe && "bg-indigo-100 text-indigo-700")}>
                    <User className="h-3.5 w-3.5" /> Solo Yo
                </Button>
            </div>

            {/* Leyenda Semáforo */}
            <div className="flex items-center gap-3 text-xs hidden lg:flex">
                <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-green-500" /> <span className="text-muted-foreground">90-110%</span></div>
                <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-amber-400" /> <span className="text-muted-foreground">&lt;90%</span></div>
                <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-red-500" /> <span className="text-muted-foreground">&gt;110%</span></div>
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar bg-slate-50/50 dark:bg-slate-900/50">
        <div style={{ minWidth: '1000px' }}>
            <div className="grid sticky top-0 z-10 bg-white dark:bg-slate-950 border-b shadow-sm" style={{ gridTemplateColumns: gridTemplate }}>
                <div className="px-4 py-3 font-bold text-sm text-slate-700 dark:text-slate-200 border-r flex items-center bg-slate-50 dark:bg-slate-900">Equipo ({filteredEmployees.length})</div>
                {weeks.map((week, index) => {
                    const visualStart = max([week.weekStart, monthStart]);
                    const visualEnd = min([week.weekEnd, monthEnd]);
                    return (
                        <div key={week.weekStart.toISOString()} className={cn("text-center px-1 py-2 border-r last:border-r-0 flex flex-col justify-center", isCurrentWeek(week.weekStart) ? "bg-indigo-50/50 dark:bg-indigo-950/30" : "")}>
                            <span className={cn("text-xs font-bold uppercase tracking-wider", isCurrentWeek(week.weekStart) ? "text-indigo-600" : "text-slate-500")}>
                                Semana {index + 1}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                                {format(visualStart, 'd MMM', { locale: es })} - {format(visualEnd, 'd MMM', { locale: es })}
                            </span>
                        </div>
                    );
                })}
                <div className="px-2 py-3 font-bold text-xs text-center text-slate-700 border-l bg-slate-50 dark:bg-slate-900 flex items-center justify-center">TOTAL</div>
            </div>

            <div>
                {filteredEmployees.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground italic">
                        No se encontraron empleados con los filtros seleccionados.
                    </div>
                ) : (
                    filteredEmployees.map((employee) => {
                        const monthlyLoad = getEmployeeMonthlyLoad(employee.id, year, month);
                        return (
                            <div key={employee.id} className="grid border-b hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors group bg-white dark:bg-slate-950" style={{ gridTemplateColumns: gridTemplate }}>
                                <EmployeeRow 
                                    employee={employee} 
                                    weeks={weeks} 
                                    onCellClick={handleCellClick} 
                                    currentMonth={currentMonth} 
                                />
                                
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
                    })
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
            viewDateContext={currentMonth} 
        />
      )}
    </div>
  );
}
