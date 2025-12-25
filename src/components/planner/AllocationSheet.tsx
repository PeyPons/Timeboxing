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
import { Allocation } from '@/types';
import { Plus, Pencil, Clock, CalendarDays, ChevronsUpDown, X, ChevronLeft, ChevronRight, MoreHorizontal, ArrowRightCircle, Search, Check, TrendingUp, TrendingDown, Trash2, Link as LinkIcon, AlertOctagon } from 'lucide-react';
import { cn, formatProjectName } from '@/lib/utils';
import { getWeeksForMonth, getStorageKey } from '@/utils/dateUtils';
import { format, addMonths, subMonths, isSameMonth } from 'date-fns';
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
  dependencyId?: string; // Campo para dependencia en creación
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
  const [editComboboxOpen, setEditComboboxOpen] = useState(false);

  const employee = employees.find(e => e.id === employeeId);
  const weeks = useMemo(() => getWeeksForMonth(viewDate), [viewDate]);
  
  const monthName = format(viewDate, 'MMMM', { locale: es });
  const monthLabel = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} - ${format(viewDate, 'yyyy')}`;

  const activeProjects = useMemo(() => 
    projects.filter(p => p.status === 'active').sort((a, b) => a.name.localeCompare(b.name)),
  [projects]);

  // Lógica para obtener dependencias disponibles (Mismo proyecto, no completadas)
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
      if (confirm('¿Seguro que quieres eliminar esta tarea? Se perderán las horas imputadas.')) {
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

  const updateInlineHours = (allocation: Allocation, field: 'hoursActual' | 'hoursComputed', value: string) => {
      const numValue = parseFloat(value) || 0;
      if (allocation[field] !== numValue) { updateAllocation({ ...allocation, [field]: numValue }); }
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

  const groupAndSortAllocations = (allocations: Allocation[]) => {
    const grouped = allocations.reduce((acc, alloc) => {
      const projId = alloc.projectId;
      if (!acc[projId]) acc[projId] = [];
      acc[projId].push(alloc);
      return acc;
    }, {} as Record<string, Allocation[]>);

    return Object.entries(grouped).sort(([projIdA, allocsA], [projIdB, allocsB]) => {
      const isAllCompletedA = allocsA.every(a => a.status === 'completed' && !recentlyToggled.has(a.id));
      const isAllCompletedB = allocsB.every(a => a.status === 'completed' && !recentlyToggled.has(a.id));
      if (isAllCompletedA && !isAllCompletedB) return 1;
      if (!isAllCompletedA && isAllCompletedB) return -1;
      const totalHoursA = allocsA.reduce((sum, a) => sum + a.hoursAssigned, 0);
      const totalHoursB = allocsB.reduce((sum, a) => sum + a.hoursAssigned, 0);
      if (totalHoursB !== totalHoursA) return totalHoursB - totalHoursA;
      const projA = getProjectById(projIdA);
      const projB = getProjectById(projIdB);
      return (projA?.name || '').localeCompare(projB?.name || '');
    });
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

          <TooltipProvider>
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
                const isCurrent = isSameMonth(viewDate, new Date()) && new Date() >= week.weekStart && new Date() <= week.weekEnd;
                const sortedProjectGroups = groupAndSortAllocations(weekAllocations);

                const weekCompleted = weekAllocations.filter(a => a.status === 'completed');
                const weekReal = weekCompleted.reduce((sum, a) => sum + (a.hoursActual || 0), 0);
                const weekComp = weekCompleted.reduce((sum, a) => sum + (a.hoursComputed || 0), 0);
                const weekGain = weekComp - weekReal;

                return (
                    <div key={weekStr} className={cn("flex flex-col gap-3 p-3 rounded-xl border bg-card transition-all h-full min-h-[300px]", isCurrent ? "ring-2 ring-indigo-500 ring-offset-2 shadow-lg scale-[1.01]" : "hover:border-indigo-200 hover:shadow-md")}>
                        {/* HEADER SEMANA */}
                        <div className="flex flex-col gap-2 pb-2 border-b">
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-sm text-foreground/80 uppercase tracking-wider">Semana {index + 1}</span>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-indigo-100 hover:text-indigo-700 rounded-full transition-colors" onClick={() => startAdd(week.weekStart)}>
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                            
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded">
                                    {format(week.effectiveStart!, 'd MMM', { locale: es })} - {format(week.effectiveEnd!, 'd MMM', { locale: es })}
                                </span>
                                
                                <div className="flex items-center gap-1">
                                    {weekCompleted.length > 0 && Math.abs(weekGain) > 0.01 && (
                                        <Badge variant="outline" className={cn("text-[9px] px-1 h-5 mr-1 font-mono border-0", weekGain > 0 ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50")}>
                                            {weekGain > 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
                                            {weekGain > 0 ? '+' : ''}{parseFloat(weekGain.toFixed(1))}h
                                        </Badge>
                                    )}

                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Badge variant="outline" className={cn("font-mono text-xs px-2 py-0.5 h-auto cursor-help", load.status === 'overload' ? "bg-red-50 text-red-600 border-red-200" : "bg-green-50 text-green-600 border-green-200")}>
                                                {load.hours}/{load.capacity}h
                                            </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent align="end" className="text-xs p-3 space-y-1">
                                            <div className="font-bold border-b pb-1 mb-1">Desglose de Capacidad</div>
                                            <div className="flex justify-between gap-4"><span>Capacidad Base:</span><span className="font-mono">{load.baseCapacity}h</span></div>
                                            {load.breakdown.map((item, i) => (
                                                <div key={i} className="flex justify-between gap-4 text-red-400"><span>{item.reason}:</span><span className="font-mono">-{item.hours}h</span></div>
                                            ))}
                                            <div className="flex justify-between gap-4 border-t pt-1 mt-1 font-bold"><span>Disponible:</span><span className="font-mono">{load.capacity}h</span></div>
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div className={cn("h-full transition-all duration-500 ease-out", load.status === 'overload' ? "bg-red-500" : "bg-green-500")} style={{ width: `${Math.min(load.percentage, 100)}%` }} />
                            </div>
                        </div>

                        {/* LISTA TAREAS */}
                        <div className="flex-1 overflow-y-auto max-h-[60vh] space-y-3 pr-1 custom-scrollbar">
                            {weekAllocations.length === 0 ? (
                                <div className="h-24 flex flex-col items-center justify-center text-muted-foreground/30 text-sm italic border-2 border-dashed rounded-lg bg-slate-50/50">
                                    <Clock className="h-6 w-6 mb-2 opacity-20" />
                                    <span>{searchTerm ? 'Sin coincidencias' : 'Libre'}</span>
                                </div>
                            ) : (
                                sortedProjectGroups.map(([projId, projAllocations]) => {
                                  const project = getProjectById(projId);
                                  const totalProjHours = projAllocations.reduce((sum, a) => sum + (a.status === 'completed' ? (a.hoursComputed || a.hoursAssigned) : a.hoursAssigned), 0);
                                  const isProjCompleted = projAllocations.every(a => a.status === 'completed');

                                  return (
                                    <div key={projId} className={cn("bg-white dark:bg-slate-900 border rounded-lg shadow-sm overflow-hidden transition-opacity", isProjCompleted ? "opacity-70 grayscale-[0.3]" : "opacity-100")}>
                                        <div className="bg-slate-50 dark:bg-slate-800 px-3 py-2 border-b flex justify-between items-center">
                                            <span className="font-bold text-xs text-slate-700 dark:text-slate-200 truncate uppercase tracking-tight" title={project?.name}>
                                                {formatProjectName(project?.name || 'Desc.')}
                                            </span>
                                            <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400">{totalProjHours}h</span>
                                        </div>

                                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {projAllocations.map(alloc => {
                                                const isCompleted = alloc.status === 'completed';
                                                const real = alloc.hoursActual || 0;
                                                const computed = alloc.hoursComputed || 0;
                                                const gain = computed - real;
                                                
                                                // 1. DEPENDENCIA DE SALIDA (Yo dependo de X)
                                                const depTask = alloc.dependencyId ? allocations.find(a => a.id === alloc.dependencyId) : null;
                                                const depOwner = depTask ? employees.find(e => e.id === depTask.employeeId) : null;
                                                
                                                // 2. DEPENDENCIA DE ENTRADA (Alguien depende de mi)
                                                const blockingTasks = allocations.filter(a => a.dependencyId === alloc.id && a.status !== 'completed');

                                                return (
                                                <div key={alloc.id} className={cn("group flex items-start gap-2 p-2 hover:bg-slate-50/80 transition-colors", isCompleted && "bg-slate-50/50")}>
                                                    <Checkbox 
                                                        checked={isCompleted} 
                                                        onCheckedChange={() => toggleTaskCompletion(alloc)} 
                                                        className="h-4 w-4 mt-1 rounded-sm shrink-0" 
                                                    />
                                                    
                                                    <div className="flex-1 min-w-0">
                                                        <div onDoubleClick={() => startInlineEdit(alloc)}>
                                                            {inlineEditingId === alloc.id ? (
                                                                <Input 
                                                                    ref={inlineInputRef}
                                                                    value={inlineNameValue}
                                                                    onChange={(e) => setInlineNameValue(e.target.value)}
                                                                    onBlur={() => saveInlineEdit(alloc)}
                                                                    onKeyDown={(e) => e.key === 'Enter' && saveInlineEdit(alloc)}
                                                                    className="h-6 text-xs px-1 py-0 w-full"
                                                                />
                                                            ) : (
                                                                <div className="flex justify-between items-start gap-1">
                                                                    <div className="flex flex-col w-full">
                                                                        <span className={cn("text-xs font-medium leading-tight text-slate-700 break-words cursor-text", isCompleted && "line-through opacity-50")}>
                                                                            {alloc.taskName || 'Tarea'}
                                                                        </span>
                                                                        
                                                                        {/* Badge: YO DEPENDO DE... */}
                                                                        {depTask && (
                                                                            <div className="flex items-center gap-1 mt-1 text-[9px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded w-fit border border-amber-200" title={`Esta tarea está bloqueada hasta que ${depOwner?.name} termine`}>
                                                                                <LinkIcon className="w-2.5 h-2.5" />
                                                                                <span className="truncate max-w-[120px]">Dep: {depTask.taskName} <strong>({depOwner?.name})</strong></span>
                                                                            </div>
                                                                        )}

                                                                        {/* Badge: YO BLOQUEO A... */}
                                                                        {blockingTasks.length > 0 && (
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
                                                                        <DropdownMenuTrigger asChild>
                                                                            <Button variant="ghost" size="icon" className="h-5 w-5 -mt-1 -mr-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-slate-400 hover:text-indigo-600">
                                                                                <MoreHorizontal className="h-3 w-3" />
                                                                            </Button>
                                                                        </DropdownMenuTrigger>
                                                                        <DropdownMenuContent align="end">
                                                                            <DropdownMenuItem onClick={() => startEditFull(alloc)}><Pencil className="mr-2 h-3.5 w-3.5" /> Editar todo</DropdownMenuItem>
                                                                            <DropdownMenuSeparator />
                                                                            <DropdownMenuLabel className="text-xs font-normal">Mover a semana...</DropdownMenuLabel>
                                                                            {weeks.map((w, i) => w.weekStart.toISOString().split('T')[0] !== weekStr && (
                                                                                <DropdownMenuItem key={w.weekStart.toISOString()} onClick={() => moveTaskToWeek(alloc, w.weekStart)}>
                                                                                    <ArrowRightCircle className="mr-2 h-3.5 w-3.5" /> Semana {i + 1}
                                                                                </DropdownMenuItem>
                                                                            ))}
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>
                                                                </div>
                                                            )}
                                                        </div>
                                                        
                                                        {alloc.description && !inlineEditingId && (
                                                            <p className="text-[10px] text-slate-400 truncate mt-0.5">{alloc.description}</p>
                                                        )}

                                                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                                            <div className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                                                                <span className="text-[9px] text-slate-500 font-bold">EST</span>
                                                                <span className="text-[10px] font-mono font-medium">{alloc.hoursAssigned}h</span>
                                                            </div>

                                                            {isCompleted && (
                                                                <>
                                                                    <div className="flex items-center gap-1 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 transition-colors focus-within:ring-1 focus-within:ring-blue-300 shrink-0" title="Horas Reales Invertidas">
                                                                        <span className="text-[9px] text-blue-600 font-bold cursor-default">REAL</span>
                                                                        <input
                                                                            type="number"
                                                                            className="w-8 bg-transparent text-[10px] font-mono font-medium text-blue-700 text-center outline-none p-0 border-0 h-auto"
                                                                            defaultValue={real}
                                                                            onBlur={(e) => updateInlineHours(alloc, 'hoursActual', e.target.value)}
                                                                            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                                                                            step="0.1"
                                                                        />
                                                                    </div>
                                                                    
                                                                    <div className="flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 transition-colors focus-within:ring-1 focus-within:ring-emerald-300 shrink-0" title="Horas Computadas al Cliente">
                                                                        <span className="text-[9px] text-emerald-600 font-bold cursor-default">COMP</span>
                                                                         <input
                                                                            type="number"
                                                                            className="w-8 bg-transparent text-[10px] font-mono font-medium text-emerald-700 text-center outline-none p-0 border-0 h-auto"
                                                                            defaultValue={computed}
                                                                            onBlur={(e) => updateInlineHours(alloc, 'hoursComputed', e.target.value)}
                                                                            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                                                                            step="0.1"
                                                                        />
                                                                    </div>
                                                                    
                                                                    {gain !== 0 && (
                                                                        <Badge variant="outline" className={cn("text-[9px] h-4 px-1 ml-auto shrink-0", gain > 0 ? "text-emerald-600 border-emerald-200 bg-emerald-50" : "text-red-600 border-red-200 bg-red-50")}>
                                                                            {gain > 0 ? '+' : ''}{parseFloat(gain.toFixed(2))}h
                                                                        </Badge>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );})}
                                        </div>
                                    </div>
                                  );
                                })
                            )}
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
                    <div className="w-40 px-2">Dependencia?</div> {/* AÑADIDO */}
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
