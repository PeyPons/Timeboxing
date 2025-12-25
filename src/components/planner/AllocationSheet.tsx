import { useState, useMemo, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useApp } from '@/contexts/AppContext';
import { Allocation, Project } from '@/types';
import { Plus, Pencil, Clock, CalendarDays, ChevronsUpDown, X, ChevronLeft, ChevronRight, MoreHorizontal, ArrowRightCircle, Search, Check, TrendingUp, TrendingDown, Trash2, Link as LinkIcon, AlertOctagon, CheckCircle2, AlertTriangle, Users } from 'lucide-react';
import { cn, formatProjectName } from '@/lib/utils';
import { getWeeksForMonth, getStorageKey } from '@/utils/dateUtils';
import { format, addMonths, subMonths, isSameMonth, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface AllocationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  weekStart: string;
  viewDateContext?: Date;
}

interface NewTaskRow {
  id: string;
  projectId: string;
  taskName: string; 
  hours: string;
  weekDate: string;
  description: string;
  dependencyId?: string;
}

// Tipo para el estado del proyecto
interface ProjectBudgetStatus {
  totalComputed: number;
  budgetMax: number;
  budgetMin: number;
  percentage: number;
  status: 'healthy' | 'warning' | 'overload' | 'under';
  breakdown: { employeeId: string; employeeName: string; hours: number }[];
}

export function AllocationSheet({ open, onOpenChange, employeeId, weekStart, viewDateContext }: AllocationSheetProps) {
  const { 
    employees, projects, allocations, getEmployeeAllocationsForWeek, getEmployeeLoadForWeek, getProjectById,
    addAllocation, updateAllocation, deleteAllocation 
  } = useApp();

  const [viewDate, setViewDate] = useState(() => viewDateContext || new Date(weekStart));

  useEffect(() => {
    if (open) setViewDate(viewDateContext || new Date(weekStart));
  }, [open, weekStart, viewDateContext]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<Allocation | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [recentlyToggled, setRecentlyToggled] = useState<Set<string>>(new Set());

  const [newTasks, setNewTasks] = useState<NewTaskRow[]>([]);
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineNameValue, setInlineNameValue] = useState('');
  const inlineInputRef = useRef<HTMLInputElement>(null);

  // Estados de Edición
  const [editProjectId, setEditProjectId] = useState('');
  const [editTaskName, setEditTaskName] = useState('');
  const [editHours, setEditHours] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editWeek, setEditWeek] = useState('');
  const [editDependencyId, setEditDependencyId] = useState<string>('none');
  
  const [openComboboxId, setOpenComboboxId] = useState<string | null>(null);

  const employee = employees.find(e => e.id === employeeId);
  const weeks = useMemo(() => getWeeksForMonth(viewDate), [viewDate]);
  
  const monthName = format(viewDate, 'MMMM', { locale: es });
  const monthLabel = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} - ${format(viewDate, 'yyyy')}`;

  const activeProjects = useMemo(() => 
    projects.filter(p => p.status === 'active').sort((a, b) => a.name.localeCompare(b.name)),
  [projects]);

  // FUNCIÓN: Calcular estado del presupuesto de un proyecto para el mes actual
  const getProjectBudgetStatus = useMemo(() => {
    return (projectId: string): ProjectBudgetStatus => {
      const project = projects.find(p => p.id === projectId);
      if (!project) {
        return { totalComputed: 0, budgetMax: 0, budgetMin: 0, percentage: 0, status: 'healthy', breakdown: [] };
      }

      // Obtener todas las allocations del proyecto en el mes actual
      const monthAllocations = allocations.filter(a => 
        a.projectId === projectId && 
        isSameMonth(parseISO(a.weekStartDate), viewDate)
      );

      // Calcular total computado y desglose por empleado
      const breakdownMap: Record<string, number> = {};
      let totalComputed = 0;

      monthAllocations.forEach(a => {
        const computed = a.status === 'completed' ? (a.hoursComputed || 0) : 0;
        totalComputed += computed;
        
        if (computed > 0) {
          if (!breakdownMap[a.employeeId]) {
            breakdownMap[a.employeeId] = 0;
          }
          breakdownMap[a.employeeId] += computed;
        }
      });

      const breakdown = Object.entries(breakdownMap).map(([empId, hours]) => {
        const emp = employees.find(e => e.id === empId);
        return { employeeId: empId, employeeName: emp?.name || 'Desconocido', hours };
      }).sort((a, b) => b.hours - a.hours);

      const budgetMax = project.budgetHours || 0;
      const budgetMin = project.minimumHours || 0;
      const percentage = budgetMax > 0 ? (totalComputed / budgetMax) * 100 : 0;

      let status: 'healthy' | 'warning' | 'overload' | 'under' = 'healthy';
      if (totalComputed > budgetMax) {
        status = 'overload';
      } else if (percentage >= 80) {
        status = 'warning';
      } else if (budgetMin > 0 && totalComputed < budgetMin) {
        status = 'under';
      }

      return { totalComputed, budgetMax, budgetMin, percentage, status, breakdown };
    };
  }, [projects, allocations, employees, viewDate]);

  const getAvailableDependencies = (projectId: string, currentTaskId?: string) => {
      if (!projectId) return [];
      return allocations.filter(a => 
          a.projectId === projectId && 
          a.id !== currentTaskId && 
          a.status !== 'completed'
      );
  };

  useEffect(() => {
    if (inlineEditingId && inlineInputRef.current) inlineInputRef.current.focus();
  }, [inlineEditingId]);

  if (!employee) return null;

  const handlePrevMonth = () => setViewDate(prev => subMonths(prev, 1));
  const handleNextMonth = () => setViewDate(prev => addMonths(prev, 1));

  const startAdd = (weekStartReal: Date) => {
    const storageKey = getStorageKey(weekStartReal, viewDate);
    setEditingAllocation(null);
    setNewTasks([{
      id: crypto.randomUUID(), projectId: '', taskName: '', hours: '', weekDate: storageKey, description: '', dependencyId: 'none'
    }]);
    setIsFormOpen(true);
  };

  const addTaskRow = () => {
    const lastTask = newTasks.length > 0 ? newTasks[newTasks.length - 1] : null;
    const defaultKey = getStorageKey(weeks[0].weekStart, viewDate);
    setNewTasks(prev => [...prev, {
      id: crypto.randomUUID(),
      projectId: lastTask ? lastTask.projectId : '', 
      taskName: '', hours: '', weekDate: lastTask ? lastTask.weekDate : defaultKey, description: '', dependencyId: 'none'
    }]);
  };

  const removeTaskRow = (id: string) => {
    if (newTasks.length === 1) return; 
    setNewTasks(prev => prev.filter(t => t.id !== id));
  };

  const updateTaskRow = (id: string, field: keyof NewTaskRow, value: string) => {
    setNewTasks(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const handleSave = () => {
    if (editingAllocation) {
      if (!editProjectId || !editHours) return;
      updateAllocation({
        ...editingAllocation,
        projectId: editProjectId,
        taskName: editTaskName,
        weekStartDate: editWeek,
        hoursAssigned: parseFloat(editHours),
        description: editDescription,
        dependencyId: editDependencyId === 'none' ? undefined : editDependencyId
      });
    } else {
      newTasks.forEach(task => {
        if (task.projectId && task.hours) {
          addAllocation({
            employeeId,
            projectId: task.projectId,
            taskName: task.taskName,
            weekStartDate: task.weekDate,
            hoursAssigned: parseFloat(task.hours),
            status: 'planned', 
            description: task.description,
            dependencyId: task.dependencyId === 'none' ? undefined : task.dependencyId
          });
        }
      });
    }
    setIsFormOpen(false);
  };

  const handleDeleteAllocation = () => {
      if (!editingAllocation) return;
      if (confirm('¿Seguro que quieres eliminar esta tarea?')) {
          deleteAllocation(editingAllocation.id);
          setIsFormOpen(false);
      }
  };

  const toggleTaskCompletion = (allocation: Allocation) => {
      const isCompleting = allocation.status !== 'completed';
      setRecentlyToggled(prev => { const newSet = new Set(prev); newSet.add(allocation.id); return newSet; });
      updateAllocation({
          ...allocation,
          status: isCompleting ? 'completed' : 'planned',
          hoursActual: isCompleting ? allocation.hoursAssigned : 0,
          hoursComputed: isCompleting ? allocation.hoursAssigned : 0
      });
      setTimeout(() => { setRecentlyToggled(prev => { const newSet = new Set(prev); newSet.delete(allocation.id); return newSet; }); }, 30000);
  };

  // FUNCIÓN PARA ACTUALIZAR HORAS INLINE (Real y Computado)
  const updateInlineHours = (allocation: Allocation, field: 'hoursActual' | 'hoursComputed', value: string) => {
      const numValue = parseFloat(value) || 0;
      if (allocation[field] !== numValue) { 
          updateAllocation({ ...allocation, [field]: numValue }); 
      }
  };

  const startEditFull = (allocation: Allocation) => {
    setEditingAllocation(allocation);
    setEditProjectId(allocation.projectId);
    setEditTaskName(allocation.taskName || '');
    setEditHours(allocation.hoursAssigned.toString());
    setEditDescription(allocation.description || '');
    setEditWeek(allocation.weekStartDate);
    setEditDependencyId(allocation.dependencyId || 'none');
    setIsFormOpen(true);
  };

  const startInlineEdit = (allocation: Allocation) => { setInlineEditingId(allocation.id); setInlineNameValue(allocation.taskName || ''); };
  const saveInlineEdit = (allocation: Allocation) => { if (inlineNameValue.trim() !== allocation.taskName) { updateAllocation({ ...allocation, taskName: inlineNameValue }); } setInlineEditingId(null); };
  const moveTaskToWeek = (allocation: Allocation, targetWeekStartReal: Date) => { const targetKey = getStorageKey(targetWeekStartReal, viewDate); updateAllocation({ ...allocation, weekStartDate: targetKey }); };

  // Helper para renderizar el status del proyecto
  const renderProjectHeader = (project: Project | undefined, budgetStatus: ProjectBudgetStatus) => {
    if (!project) return <span className="font-bold text-xs truncate">Desc.</span>;

    const { totalComputed, budgetMax, budgetMin, percentage, status, breakdown } = budgetStatus;
    
    const statusConfig = {
      healthy: { color: 'bg-emerald-500', bgLight: 'bg-emerald-50', textColor: 'text-emerald-700', icon: null },
      warning: { color: 'bg-amber-500', bgLight: 'bg-amber-50', textColor: 'text-amber-700', icon: <AlertTriangle className="w-3 h-3" /> },
      overload: { color: 'bg-red-500', bgLight: 'bg-red-50', textColor: 'text-red-700', icon: <AlertOctagon className="w-3 h-3" /> },
      under: { color: 'bg-blue-500', bgLight: 'bg-blue-50', textColor: 'text-blue-700', icon: null }
    };

    const config = statusConfig[status];
    const exceededBy = totalComputed > budgetMax ? totalComputed - budgetMax : 0;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("px-3 py-2 border-b cursor-help transition-colors", config.bgLight)}>
            {/* Fila 1: Nombre + Indicador */}
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-xs truncate flex-1">{formatProjectName(project.name)}</span>
              {budgetMax > 0 && (
                <div className={cn("flex items-center gap-1 text-[10px] font-semibold", config.textColor)}>
                  {config.icon}
                  <span>{Math.round(percentage)}%</span>
                </div>
              )}
            </div>
            
            {/* Fila 2: Barra de progreso (solo si hay presupuesto) */}
            {budgetMax > 0 && (
              <div className="mt-1.5">
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className={cn("h-full transition-all duration-300", config.color)} 
                    style={{ width: `${Math.min(percentage, 100)}%` }} 
                  />
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[9px] text-slate-500">
                    {totalComputed.toFixed(1)}h / {budgetMax}h
                  </span>
                  {exceededBy > 0 && (
                    <span className="text-[9px] font-bold text-red-600">
                      +{exceededBy.toFixed(1)}h
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs p-0">
          <div className="p-3 space-y-2">
            <div className="font-bold text-sm border-b pb-2">{project.name}</div>
            
            {/* Info presupuesto */}
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Presupuesto:</span>
                <span className="font-medium">{budgetMin > 0 ? `${budgetMin}-` : ''}{budgetMax}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Computado:</span>
                <span className={cn("font-bold", status === 'overload' ? 'text-red-600' : 'text-emerald-600')}>
                  {totalComputed.toFixed(1)}h
                </span>
              </div>
              {exceededBy > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Exceso:</span>
                  <span className="font-bold">+{exceededBy.toFixed(1)}h</span>
                </div>
              )}
            </div>

            {/* Desglose por empleado */}
            {breakdown.length > 0 && (
              <div className="border-t pt-2 mt-2">
                <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 uppercase mb-1">
                  <Users className="w-3 h-3" /> Desglose
                </div>
                <div className="space-y-1">
                  {breakdown.map(({ employeeId: empId, employeeName, hours }) => {
                    const isCurrentEmployee = empId === employeeId;
                    return (
                      <div 
                        key={empId} 
                        className={cn(
                          "flex justify-between text-xs px-1.5 py-0.5 rounded",
                          isCurrentEmployee ? "bg-indigo-50 font-medium" : ""
                        )}
                      >
                        <span className={isCurrentEmployee ? "text-indigo-700" : "text-slate-600"}>
                          {employeeName} {isCurrentEmployee && "(tú)"}
                        </span>
                        <span className="font-mono">{hours.toFixed(1)}h</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mensaje de estado */}
            {status === 'overload' && (
              <div className="bg-red-50 text-red-700 text-[10px] p-2 rounded border border-red-200 mt-2">
                ⚠️ Se ha excedido el presupuesto máximo. Revisar horas computadas.
              </div>
            )}
            {status === 'warning' && (
              <div className="bg-amber-50 text-amber-700 text-[10px] p-2 rounded border border-amber-200 mt-2">
                ⚡ Cerca del límite. Quedan {(budgetMax - totalComputed).toFixed(1)}h disponibles.
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-[95vw] overflow-y-auto px-6 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-xl border-l shadow-2xl pt-10">
          <SheetHeader className="pb-6 border-b mb-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-2xl shadow-sm border border-indigo-200">
                        {employee.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <SheetTitle className="text-3xl font-bold tracking-tight text-foreground">{employee.name}</SheetTitle>
                        <SheetDescription className="text-base flex items-center gap-2 mt-1">
                            <CalendarDays className="h-4 w-4 text-muted-foreground" />
                            Planificación Mensual
                        </SheetDescription>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative w-48 hidden sm:block">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <Input 
                            placeholder="Buscar tarea..." 
                            className="pl-8 h-9 text-xs bg-background/50" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-4 bg-background/50 p-1.5 rounded-lg border shadow-sm">
                        <Button variant="ghost" size="icon" onClick={handlePrevMonth}><ChevronLeft className="h-5 w-5" /></Button>
                        <span className="text-lg font-bold capitalize w-48 text-center select-none">{monthLabel}</span>
                        <Button variant="ghost" size="icon" onClick={handleNextMonth}><ChevronRight className="h-5 w-5" /></Button>
                    </div>
                </div>
            </div>
          </SheetHeader>

          <TooltipProvider delayDuration={300}>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 pb-20">
            {weeks.map((week, index) => {
                const weekStr = week.weekStart.toISOString().split('T')[0];
                const storageKey = getStorageKey(week.weekStart, viewDate);
                let weekAllocations = getEmployeeAllocationsForWeek(employeeId, storageKey);
                
                if (searchTerm) {
                    weekAllocations = weekAllocations.filter(a => {
                        const proj = getProjectById(a.projectId);
                        const matchText = (a.taskName + (proj?.name || '')).toLowerCase();
                        return matchText.includes(searchTerm.toLowerCase());
                    });
                }
                
                const load = getEmployeeLoadForWeek(employeeId, storageKey, week.effectiveStart, week.effectiveEnd);

                return (
                    <div key={weekStr} className="flex flex-col gap-3 p-3 rounded-xl border bg-card h-full min-h-[300px]">
                        {/* HEADER SEMANA */}
                        <div className="flex flex-col gap-2 pb-2 border-b">
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-sm text-foreground/80 uppercase tracking-wider">Semana {index + 1}</span>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-indigo-100 hover:text-indigo-700 rounded-full transition-colors" onClick={() => startAdd(week.weekStart)}>
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div className={cn("h-full transition-all duration-500 ease-out", load.status === 'overload' ? "bg-red-500" : "bg-green-500")} style={{ width: `${Math.min(load.percentage, 100)}%` }} />
                            </div>
                        </div>

                        {/* LISTA TAREAS */}
                        <div className="flex-1 overflow-y-auto max-h-[60vh] space-y-3 pr-1 custom-scrollbar">
                            {Object.entries(weekAllocations.reduce((acc, a) => ({...acc, [a.projectId]: [...(acc[a.projectId]||[]), a]}), {} as Record<string, Allocation[]>)).map(([projId, projAllocations]) => {
                                const project = getProjectById(projId);
                                const budgetStatus = getProjectBudgetStatus(projId);
                                
                                return (
                                    <div key={projId} className="bg-white border rounded-lg shadow-sm overflow-hidden">
                                        {/* HEADER PROYECTO CON STATUS */}
                                        {renderProjectHeader(project, budgetStatus)}
                                        
                                        <div className="divide-y divide-slate-100">
                                            {projAllocations.map(alloc => {
                                                const isCompleted = alloc.status === 'completed';
                                                
                                                // 1. DEPENDENCIA DE SALIDA (Yo dependo de X)
                                                const depTask = alloc.dependencyId ? allocations.find(a => a.id === alloc.dependencyId) : null;
                                                const depOwner = depTask ? employees.find(e => e.id === depTask.employeeId) : null;
                                                const isDepReady = depTask?.status === 'completed';
                                                
                                                // 2. DEPENDENCIA DE ENTRADA (Alguien depende de mi)
                                                const blockingTasks = allocations.filter(a => a.dependencyId === alloc.id && a.status !== 'completed');
                                                
                                                return (
                                                    <div key={alloc.id} className="group flex items-start gap-2 p-2 hover:bg-slate-50/80 transition-colors">
                                                        <Checkbox checked={isCompleted} onCheckedChange={() => toggleTaskCompletion(alloc)} className="mt-1" />
                                                        <div className="flex-1 min-w-0">
                                                            <div onDoubleClick={() => startInlineEdit(alloc)}>
                                                                {inlineEditingId === alloc.id ? (
                                                                    <Input autoFocus value={inlineNameValue} onChange={e=>setInlineNameValue(e.target.value)} onBlur={()=>saveInlineEdit(alloc)} className="h-6 text-xs" />
                                                                ) : (
                                                                    <div className="flex justify-between items-start">
                                                                        <div className="flex flex-col w-full">
                                                                            <span className={cn("text-xs font-medium leading-tight", isCompleted && "line-through opacity-50")}>{alloc.taskName || 'Tarea'}</span>
                                                                            
                                                                            {/* Badge: YO DEPENDO DE... */}
                                                                            {depTask && !isCompleted && (
                                                                                <div className={`flex items-center gap-1 mt-1 text-[9px] px-1.5 py-0.5 rounded w-fit border ${isDepReady ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200'}`} title={`Depende de ${depOwner?.name}`}>
                                                                                    {isDepReady ? <CheckCircle2 className="w-2.5 h-2.5" /> : <LinkIcon className="w-2.5 h-2.5" />}
                                                                                    <span className="truncate max-w-[120px]">
                                                                                        {isDepReady ? 'Listo:' : 'Dep:'} {depTask.taskName} <strong>({depOwner?.name})</strong>
                                                                                    </span>
                                                                                </div>
                                                                            )}

                                                                            {/* Badge: YO BLOQUEO A... */}
                                                                            {blockingTasks.length > 0 && !isCompleted && (
                                                                                <div className="flex flex-col gap-0.5 mt-1">
                                                                                    {blockingTasks.map(bt => {
                                                                                        const blockedUser = employees.find(e => e.id === bt.employeeId);
                                                                                        return (
                                                                                            <div key={bt.id} className="flex items-center gap-1 text-[9px] text-red-700 bg-red-50 px-1.5 py-0.5 rounded w-fit border border-red-200">
                                                                                                <AlertOctagon className="w-2.5 h-2.5" />
                                                                                                <span>Bloquea a: <strong>{blockedUser?.name}</strong></span>
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        
                                                                        <DropdownMenu>
                                                                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"><MoreHorizontal className="h-3 w-3" /></Button></DropdownMenuTrigger>
                                                                            <DropdownMenuContent align="end">
                                                                                <DropdownMenuItem onClick={() => startEditFull(alloc)}><Pencil className="mr-2 h-3.5 w-3.5" /> Editar</DropdownMenuItem>
                                                                                <DropdownMenuItem onClick={() => moveTaskToWeek(alloc, weeks[(index+1)%weeks.length].weekStart)}><ArrowRightCircle className="mr-2 h-3.5 w-3.5" /> Mover sem.</DropdownMenuItem>
                                                                            </DropdownMenuContent>
                                                                        </DropdownMenu>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            
                                                            {/* BADGES DE HORAS: EST + REAL + COMP (en una línea) */}
                                                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                                                {/* Badge Estimado (siempre visible) */}
                                                                <span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-1.5 py-0.5 rounded">
                                                                    EST {alloc.hoursAssigned}h
                                                                </span>
                                                                
                                                                {/* Inputs Real y Computado (solo si está completada) */}
                                                                {isCompleted && (
                                                                    <>
                                                                        {/* Input REAL (azul) */}
                                                                        <div className="flex items-center bg-blue-100 text-blue-700 rounded px-1.5 py-0.5">
                                                                            <span className="text-[10px] font-medium mr-1">Real:</span>
                                                                            <input
                                                                                type="number"
                                                                                step="0.5"
                                                                                min="0"
                                                                                defaultValue={alloc.hoursActual || 0}
                                                                                onBlur={(e) => updateInlineHours(alloc, 'hoursActual', e.target.value)}
                                                                                className="w-8 text-[10px] text-center bg-transparent border-0 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-300 rounded font-medium"
                                                                            />
                                                                        </div>
                                                                        
                                                                        {/* Input COMPUTADO (verde) */}
                                                                        <div className="flex items-center bg-emerald-100 text-emerald-700 rounded px-1.5 py-0.5">
                                                                            <span className="text-[10px] font-medium mr-1">Comp:</span>
                                                                            <input
                                                                                type="number"
                                                                                step="0.5"
                                                                                min="0"
                                                                                defaultValue={alloc.hoursComputed || 0}
                                                                                onBlur={(e) => updateInlineHours(alloc, 'hoursComputed', e.target.value)}
                                                                                className="w-8 text-[10px] text-center bg-transparent border-0 focus:outline-none focus:bg-white focus:ring-1 focus:ring-emerald-300 rounded font-medium"
                                                                            />
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
          </div>
          </TooltipProvider>
        </SheetContent>
      </Sheet>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className={cn("max-w-[650px] overflow-visible gap-0 p-0", !editingAllocation ? "max-w-[950px]" : "")}>
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>{editingAllocation ? 'Editar Tarea' : 'Añadir Tareas'}</DialogTitle>
            <DialogDescription>{editingAllocation ? 'Modifica detalles y dependencias.' : 'Añade múltiples tareas rápidamente.'}</DialogDescription>
          </DialogHeader>

          <div className="p-6 pt-2">
            {editingAllocation ? (
              // --- MODO EDICIÓN INDIVIDUAL ---
              <div className="grid gap-4 mt-4">
                 <div className="space-y-2">
                    <Label>Proyecto</Label>
                    <Select value={editProjectId} onValueChange={setEditProjectId}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{activeProjects.map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="space-y-2"><Label>Tarea</Label><Input value={editTaskName} onChange={e=>setEditTaskName(e.target.value)} /></div>
                
                {/* SELECTOR DEPENDENCIA EDICIÓN */}
                <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-xs text-slate-500"><LinkIcon className="w-3 h-3"/> Dependencia (Bloqueante)</Label>
                    <Select value={editDependencyId} onValueChange={setEditDependencyId} disabled={!editProjectId}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Sin dependencia" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">-- Ninguna --</SelectItem>
                            {getAvailableDependencies(editProjectId, editingAllocation.id).map(dep => {
                                const owner = employees.find(e => e.id === dep.employeeId);
                                return <SelectItem key={dep.id} value={dep.id} className="text-xs">{dep.taskName} ({owner?.name})</SelectItem>;
                            })}
                        </SelectContent>
                    </Select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Horas</Label><Input type="number" value={editHours} onChange={e=>setEditHours(e.target.value)} step="0.5" /></div>
                    <div className="space-y-2"><Label>Semana</Label><Select value={editWeek} onValueChange={setEditWeek}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{weeks.map((w,i)=><SelectItem key={w.weekStart.toISOString()} value={getStorageKey(w.weekStart, viewDate)}>Sem {i+1}</SelectItem>)}</SelectContent></Select></div>
                </div>
              </div>
            ) : (
              // --- MODO CREACIÓN MÚLTIPLE (Con Dependencias) ---
              <div className="space-y-3 mt-4">
                <div className="flex text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-2">
                    <div className="flex-1 pl-1">Proyecto</div>
                    <div className="flex-1 pl-1">Tarea</div>
                    <div className="w-40 px-2">Dependencia?</div>
                    <div className="w-20 mx-2 text-center">Horas</div>
                    <div className="w-36">Semana</div>
                    <div className="w-8"></div>
                </div>
                
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2 -mr-2">
                    {newTasks.map((task) => (
                        <div key={task.id} className="flex gap-2 items-start">
                            {/* Proyecto */}
                            <div className="flex-1 min-w-0">
                                <Popover open={openComboboxId === task.id} onOpenChange={(isOpen) => setOpenComboboxId(isOpen ? task.id : null)}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" className={cn("w-full justify-between h-10 px-3 text-left font-normal", !task.projectId && "text-muted-foreground")}>
                                            <span className="truncate">{task.projectId ? formatProjectName(activeProjects.find((p) => p.id === task.projectId)?.name || '') : "Buscar..."}</span>
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder="Buscar..." />
                                            <CommandList>
                                                <CommandEmpty>No hay.</CommandEmpty>
                                                <CommandGroup className="max-h-[200px] overflow-y-auto">
                                                    {activeProjects.map((project) => (
                                                        <CommandItem key={project.id} value={project.name} onSelect={() => { updateTaskRow(task.id, 'projectId', project.id); setOpenComboboxId(null); }}>
                                                            <Check className={cn("mr-2 h-4 w-4", task.projectId === project.id ? "opacity-100" : "opacity-0")} />
                                                            {formatProjectName(project.name)}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <Input className="flex-1 h-10" placeholder="Nombre..." value={task.taskName} onChange={(e) => updateTaskRow(task.id, 'taskName', e.target.value)} />

                            {/* SELECTOR DEPENDENCIA EN CREACIÓN */}
                            <div className="w-40">
                                <Select value={task.dependencyId} onValueChange={(v) => updateTaskRow(task.id, 'dependencyId', v)} disabled={!task.projectId}>
                                    <SelectTrigger className="h-10 text-xs px-2"><SelectValue placeholder="-" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Ninguna</SelectItem>
                                        {getAvailableDependencies(task.projectId).map(dep => {
                                            const owner = employees.find(e => e.id === dep.employeeId);
                                            return <SelectItem key={dep.id} value={dep.id} className="text-xs">{dep.taskName} ({owner?.name?.substring(0,6)}..)</SelectItem>;
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>

                            <Input type="number" className="w-20 h-10 text-center" placeholder="0" value={task.hours} onChange={(e) => updateTaskRow(task.id, 'hours', e.target.value)} step="0.5" />

                            <div className="w-36">
                                <Select value={task.weekDate} onValueChange={(v) => updateTaskRow(task.id, 'weekDate', v)}>
                                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                    <SelectContent>{weeks.map((w, i) => (<SelectItem key={w.weekStart.toISOString()} value={getStorageKey(w.weekStart, viewDate)}>Sem {i+1}</SelectItem>))}</SelectContent>
                                </Select>
                            </div>

                            <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-destructive" onClick={() => removeTaskRow(task.id)} disabled={newTasks.length === 1}><X className="h-4 w-4" /></Button>
                        </div>
                    ))}
                </div>
                <Button variant="outline" size="sm" onClick={addTaskRow} className="w-full mt-4 border-dashed"><Plus className="h-4 w-4 mr-2" /> Añadir otra fila</Button>
              </div>
            )}
          </div>
          <DialogFooter className="p-6 pt-2 bg-muted/10 border-t flex justify-between items-center w-full">
            {editingAllocation && <Button variant="ghost" size="sm" onClick={handleDeleteAllocation} className="text-red-500"><Trash2 className="w-4 h-4 mr-2" /> Eliminar</Button>}
            <div className="flex gap-2 ml-auto">
                <Button variant="ghost" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave}>Guardar</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
