import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { EmployeeRow } from './EmployeeRow';
import { AllocationSheet } from './AllocationSheet';
import { getWeeksForMonth, getMonthName, isCurrentWeek } from '@/utils/dateUtils';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CalendarDays, Sparkles, User, Loader2, Briefcase, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { startOfMonth, endOfMonth, parseISO, isSameMonth, max, min, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { GoogleGenerativeAI } from "@google/generative-ai";

export function PlannerGrid() {
  const { employees, getEmployeeMonthlyLoad, projects, allocations, absences, teamEvents } = useApp();
  
  const [currentMonth, setCurrentMonth] = useState(() => {
    const saved = localStorage.getItem('planner_date');
    return saved ? new Date(saved) : new Date();
  });

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [showOnlyMe, setShowOnlyMe] = useState(() => localStorage.getItem('planner_only_me') === 'true');
  const [openEmployeeCombo, setOpenEmployeeCombo] = useState(false);
  const [openProjectCombo, setOpenProjectCombo] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ employeeId: string; weekStart: Date } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [insights, setInsights] = useState<{ type: 'warning' | 'success' | 'info', text: string }[] | null>(null);

  useEffect(() => { localStorage.setItem('planner_date', currentMonth.toISOString()); }, [currentMonth]);
  useEffect(() => { localStorage.setItem('planner_only_me', String(showOnlyMe)); }, [showOnlyMe]);

  const weeks = getWeeksForMonth(currentMonth);
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
        if (!e.isActive) return false;
        if (showOnlyMe && !e.name.toLowerCase().includes("alex")) return false;
        if (selectedEmployeeId !== 'all' && e.id !== selectedEmployeeId) return false;
        if (selectedProjectId !== 'all') {
            const hasAllocationInProject = allocations.some(a => {
                const allocDate = parseISO(a.weekStartDate);
                return a.projectId === selectedProjectId && a.employeeId === e.id && isSameMonth(allocDate, currentMonth);
            });
            if (!hasAllocationInProject) return false;
        }
        return true;
    });
  }, [employees, showOnlyMe, selectedEmployeeId, selectedProjectId, allocations, currentMonth]);

  const handlePrevMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  const handleToday = () => setCurrentMonth(new Date());
  
  const handleCellClick = (employeeId: string, weekStart: Date) => setSelectedCell({ employeeId, weekStart });

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setInsights(null);
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) { setInsights([{ type: 'warning', text: '⚠️ Falta API Key' }]); setIsAnalyzing(false); return; }
    try {
        const staffData = filteredEmployees.map(e => ({ name: e.name, role: e.role, load: getEmployeeMonthlyLoad(e.id, year, month).percentage }));
        const prompt = `Analiza carga ${getMonthName(currentMonth)}: ${JSON.stringify(staffData)}. JSON array: [{"type":"warning"|"success"|"info","text":"..."}]`;
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        const json = JSON.parse(result.response.text().replace(/```json/g, '').replace(/```/g, '').trim());
        setInsights(json);
    } catch (e) { setInsights([{ type: 'warning', text: 'Error IA' }]); } finally { setIsAnalyzing(false); }
  };

  const gridTemplate = `250px repeat(${weeks.length}, minmax(0, 1fr)) 100px`;
  const sortedProjects = useMemo(() => [...projects].sort((a,b) => a.name.localeCompare(b.name)), [projects]);
  const sortedEmployees = useMemo(() => [...employees].filter(e=>e.isActive).sort((a,b) => a.name.localeCompare(b.name)), [employees]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 rounded-lg border shadow-sm overflow-hidden">
      <div className="flex flex-col gap-4 border-b bg-card px-4 py-3 z-20 relative">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold capitalize text-foreground flex items-center gap-2">{getMonthName(currentMonth)} <Badge variant="outline" className="text-xs font-normal hidden sm:flex">{year}</Badge></h2>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-md p-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrevMonth}><ChevronLeft className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={handleToday} className="h-7 text-xs px-2"><CalendarDays className="h-3.5 w-3.5 mr-1.5" />Mes</Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNextMonth}><ChevronRight className="h-4 w-4" /></Button>
                </div>
            </div>
            <Popover>
                <PopoverTrigger asChild><Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 h-9 shadow-sm"><Sparkles className="h-4 w-4" /><span className="hidden sm:inline">Insights IA</span></Button></PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                    <div className="bg-indigo-50 p-3 border-b flex items-center gap-2"><Sparkles className="h-4 w-4 text-indigo-600" /><span className="font-semibold text-sm">Sugerencias:</span></div>
                    <div className="p-4">
                        {!isAnalyzing && !insights && <div className="text-center"><Button size="sm" onClick={handleAnalyze}>Analizar</Button></div>}
                        {isAnalyzing && <div className="text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-600" /></div>}
                        {insights && <div className="space-y-2">{insights.map((i, k) => <div key={k} className={cn("text-xs p-2 rounded border", i.type==='warning'?"bg-amber-50 border-amber-200":i.type==='success'?"bg-green-50 border-green-200":"bg-blue-50 border-blue-200")}>{i.text}</div>)}</div>}
                    </div>
                </PopoverContent>
            </Popover>
        </div>
        
        <div className="flex gap-2">
             <Popover open={openEmployeeCombo} onOpenChange={setOpenEmployeeCombo}>
                <PopoverTrigger asChild><Button variant="outline" role="combobox" className="h-8 w-[200px] justify-between text-xs bg-white"><span className="truncate">{selectedEmployeeId==='all'?"Todos":employees.find(e=>e.id===selectedEmployeeId)?.name}</span><ChevronsUpDown className="ml-2 h-3 w-3 opacity-50" /></Button></PopoverTrigger>
                <PopoverContent className="w-[200px] p-0"><Command><CommandInput placeholder="Empleado..." /><CommandList><CommandGroup><CommandItem onSelect={()=>{setSelectedEmployeeId('all');setOpenEmployeeCombo(false)}}>Todos</CommandItem>{sortedEmployees.map(e=><CommandItem key={e.id} onSelect={()=>{setSelectedEmployeeId(e.id);setOpenEmployeeCombo(false)}}>{e.name}</CommandItem>)}</CommandGroup></CommandList></Command></PopoverContent>
            </Popover>
            <Popover open={openProjectCombo} onOpenChange={setOpenProjectCombo}>
                <PopoverTrigger asChild><Button variant="outline" role="combobox" className="h-8 w-[200px] justify-between text-xs bg-white"><span className="truncate">{selectedProjectId==='all'?"Todos":projects.find(p=>p.id===selectedProjectId)?.name}</span><ChevronsUpDown className="ml-2 h-3 w-3 opacity-50" /></Button></PopoverTrigger>
                <PopoverContent className="w-[250px] p-0"><Command><CommandInput placeholder="Proyecto..." /><CommandList><CommandGroup><CommandItem onSelect={()=>{setSelectedProjectId('all');setOpenProjectCombo(false)}}>Todos</CommandItem>{sortedProjects.filter(p=>p.status==='active').map(p=><CommandItem key={p.id} onSelect={()=>{setSelectedProjectId(p.id);setOpenProjectCombo(false)}}>{p.name}</CommandItem>)}</CommandGroup></CommandList></Command></PopoverContent>
            </Popover>
            <Button variant={showOnlyMe?"secondary":"outline"} size="sm" onClick={()=>setShowOnlyMe(!showOnlyMe)} className={cn("h-8 text-xs gap-2", showOnlyMe && "bg-indigo-100 text-indigo-700")}><User className="h-3.5 w-3.5" /> Solo Yo</Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar bg-slate-50/50 dark:bg-slate-900/50">
        <div style={{ minWidth: '1000px' }}>
            <div className="grid sticky top-0 z-10 bg-white dark:bg-slate-950 border-b shadow-sm" style={{ gridTemplateColumns: gridTemplate }}>
                <div className="px-4 py-3 font-bold text-sm text-slate-700 dark:text-slate-200 border-r flex items-center bg-slate-50 dark:bg-slate-900">Equipo ({filteredEmployees.length})</div>
                {weeks.map((week, index) => (
                    <div key={week.weekStart.toISOString()} className={cn("text-center px-1 py-2 border-r flex flex-col justify-center", isCurrentWeek(week.weekStart) && "bg-indigo-50/50")}>
                        <span className={cn("text-xs font-bold uppercase", isCurrentWeek(week.weekStart) ? "text-indigo-600" : "text-slate-500")}>Semana {index + 1}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{format(max([week.weekStart, monthStart]), 'd MMM', { locale: es })} - {format(min([week.weekEnd, monthEnd]), 'd MMM', { locale: es })}</span>
                    </div>
                ))}
                <div className="px-2 py-3 font-bold text-xs text-center border-l bg-slate-50 flex items-center justify-center">TOTAL</div>
            </div>

            <div>
                {filteredEmployees.map((employee) => {
                    const monthlyLoad = getEmployeeMonthlyLoad(employee.id, year, month);
                    return (
                        <div key={employee.id} className="grid border-b hover:bg-slate-50 transition-colors bg-white" style={{ gridTemplateColumns: gridTemplate }}>
                            <EmployeeRow 
                                employee={employee} 
                                weeks={weeks} 
                                projects={projects}
                                allocations={allocations}
                                absences={absences}
                                teamEvents={teamEvents}
                                viewDate={currentMonth}
                                onOpenSheet={(empId, date) => handleCellClick(empId, date)}
                            />
                            <div className="flex items-center justify-center border-l p-2 bg-slate-50/30">
                                <div className={cn("flex flex-col items-center justify-center w-16 h-12 rounded-lg border-2", monthlyLoad.status === 'overload' ? "bg-red-50 border-red-200 text-red-700" : monthlyLoad.status === 'warning' ? "bg-yellow-50 border-yellow-200 text-yellow-700" : "bg-slate-50 border-slate-200 text-slate-400")}>
                                    <span className="text-sm font-bold leading-none">{monthlyLoad.hours}h</span>
                                    <span className="text-[10px] opacity-70">/ {monthlyLoad.capacity}h</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      </div>

      {selectedCell && (
        <AllocationSheet 
            open={!!selectedCell} 
            onOpenChange={(open) => !open && setSelectedCell(null)} 
            employeeId={selectedCell.employeeId} 
            weekStart={selectedCell.weekStart.toISOString()} 
            viewDateContext={currentMonth} 
        />
      )}
    </div>
  );
}
