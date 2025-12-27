import { useEffect, useState, useMemo, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { MyWeekView } from '@/components/employee/MyWeekView';
import { PriorityInsights, ProjectTeamPulse } from '@/components/employee/DashboardWidgets'; 
import { ReliabilityIndexCard } from '@/components/employee/ReliabilityIndexCard';
import { CollaborationCards } from '@/components/employee/CollaborationCards';
import { MonthlyBalanceCard } from '@/components/employee/MonthlyBalanceCard';
import { WelcomeTour, useWelcomeTour } from '@/components/employee/WelcomeTour';
import { EmployeeSettings } from '@/components/employee/EmployeeSettings';
import { Card } from '@/components/ui/card';
import { EmployeeRow } from '@/components/planner/EmployeeRow'; 
import { AllocationSheet } from '@/components/planner/AllocationSheet';
import { AbsencesSheet } from '@/components/team/AbsencesSheet';
import { ProfessionalGoalsSheet } from '@/components/team/ProfessionalGoalsSheet';
import { getWeeksForMonth, getMonthName, getStorageKey } from '@/utils/dateUtils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { 
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter 
} from "@/components/ui/dialog";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { ChevronLeft, ChevronRight, CalendarDays, TrendingUp, Calendar, Clock, Plus, X, Check, ListPlus, AlertTriangle, CheckCircle2, HelpCircle, RotateCcw, FileDown } from 'lucide-react';
import { startOfMonth, endOfMonth, max, min, format, startOfWeek, isSameMonth, parseISO, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Employee } from '@/types';
import { toast } from 'sonner';
import { cn, formatProjectName } from '@/lib/utils';

const INTERNAL_CLIENT_NAME = 'Interno';
const INTERNAL_PROJECT_NAME = 'Gestiones internas';

const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

interface NewTaskRow {
  id: string;
  projectId: string;
  taskName: string; 
  hours: string;
  weekDate: string;
}

interface ProjectBudgetStatus {
  totalComputed: number;
  totalPlanned: number;
  budgetMax: number;
  percentage: number;
}

export default function EmployeeDashboard() {
  const { 
    employees, allocations, absences, teamEvents, projects, clients,
    addAllocation, isLoading: isGlobalLoading, getEmployeeMonthlyLoad, getEmployeeLoadForWeek
  } = useApp();
  
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [myEmployeeProfile, setMyEmployeeProfile] = useState<Employee | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedCell, setSelectedCell] = useState<{ employeeId: string; weekStart: Date } | null>(null);
  
  const [showGoals, setShowGoals] = useState(false);
  const [showAbsences, setShowAbsences] = useState(false);
  const [isAddingExtra, setIsAddingExtra] = useState(false);
  const [isAddingTasks, setIsAddingTasks] = useState(false);

  const [extraTaskName, setExtraTaskName] = useState('');
  const [extraHours, setExtraHours] = useState('1');
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  const [newTasks, setNewTasks] = useState<NewTaskRow[]>([]);
  const [openComboboxId, setOpenComboboxId] = useState<string | null>(null);

  const { showTour, resetTour } = useWelcomeTour();

  useEffect(() => {
    const checkUserLink = async () => {
      setIsLoadingProfile(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUser(user);
          // Buscar por user_id o por email (como hace AppContext)
          const linked = employees.find(e => 
            e.user_id === user.id || 
            (e.email && user.email && e.email.toLowerCase() === user.email.toLowerCase())
          );
          if (linked) {
            setMyEmployeeProfile(linked);
          }
        }
      } finally {
        setIsLoadingProfile(false);
      }
    };
    if (!isGlobalLoading && employees.length > 0) {
      checkUserLink();
    } else if (isGlobalLoading) {
      setIsLoadingProfile(true);
    }
  }, [employees, isGlobalLoading]);

  const weeks = useMemo(() => getWeeksForMonth(currentMonth), [currentMonth]);
  const internalClient = useMemo(() => clients.find(c => c.name === INTERNAL_CLIENT_NAME), [clients]);
  const internalProject = useMemo(() => projects.find(p => p.name === INTERNAL_PROJECT_NAME && p.clientId === internalClient?.id), [projects, internalClient]);

  const activeProjects = useMemo(() => {
    return projects
      .filter(p => p.status === 'active')
      .sort((a, b) => {
        const clientA = clients.find(c => c.id === a.clientId)?.name || '';
        const clientB = clients.find(c => c.id === b.clientId)?.name || '';
        return clientA.localeCompare(clientB) || a.name.localeCompare(b.name);
      });
  }, [projects, clients]);

  // Memoizado: mapa de proyectos para acceso O(1)
  const projectsMap = useMemo(() => {
    const map = new Map<string, typeof projects[0]>();
    projects.forEach(p => map.set(p.id, p));
    return map;
  }, [projects]);

  // Memoizado: mapa de clientes para acceso O(1)
  const clientsMap = useMemo(() => {
    const map = new Map<string, typeof clients[0]>();
    clients.forEach(c => map.set(c.id, c));
    return map;
  }, [clients]);

  const getProjectDisplayName = useCallback((projectId: string) => {
    const project = projectsMap.get(projectId);
    if (!project) return 'Seleccionar...';
    const client = clientsMap.get(project.clientId);
    return `${client?.name || 'Sin cliente'} - ${project.name}`;
  }, [projectsMap, clientsMap]);

  // Memoizado: allocations del mes actual indexadas por projectId
  const monthlyAllocationsByProject = useMemo(() => {
    const map = new Map<string, typeof allocations>();
    allocations.forEach(a => {
      try {
        if (isSameMonth(parseISO(a.weekStartDate), currentMonth)) {
          if (!map.has(a.projectId)) {
            map.set(a.projectId, []);
          }
          map.get(a.projectId)!.push(a);
        }
      } catch { /* ignore invalid dates */ }
    });
    return map;
  }, [allocations, currentMonth]);

  const getProjectBudgetStatus = useCallback((projectId: string): ProjectBudgetStatus => {
    const project = projectsMap.get(projectId);
    if (!project) return { totalComputed: 0, totalPlanned: 0, budgetMax: 0, percentage: 0 };

    const monthAllocations = monthlyAllocationsByProject.get(projectId) || [];

    const totalComputed = round2(monthAllocations.filter(a => a.status === 'completed').reduce((sum, a) => sum + (a.hoursComputed || 0), 0));
    const totalPlanned = round2(monthAllocations.filter(a => a.status !== 'completed').reduce((sum, a) => sum + a.hoursAssigned, 0));
    const budgetMax = project.budgetHours || 0;
    const percentage = budgetMax > 0 ? (totalComputed / budgetMax) * 100 : 0;

    return { totalComputed, totalPlanned, budgetMax, percentage };
  }, [projectsMap, monthlyAllocationsByProject]);

  const getOrCreateInternalProject = async (): Promise<string | null> => {
    if (internalProject) return internalProject.id;

    setIsCreatingProject(true);
    try {
      let clientId = internalClient?.id;

      if (!clientId) {
        const { data: clientData, error: clientError } = await supabase
          .from('clients').insert({ name: INTERNAL_CLIENT_NAME, color: '#6b7280' }).select().single();
        if (clientError) throw clientError;
        clientId = clientData.id;
        toast.success(`Cliente "${INTERNAL_CLIENT_NAME}" creado`);
      }

      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .insert({ name: INTERNAL_PROJECT_NAME, client_id: clientId, status: 'active', budget_hours: 9999, minimum_hours: 0 })
        .select().single();

      if (projectError) throw projectError;
      toast.success(`Proyecto "${INTERNAL_PROJECT_NAME}" creado`);
      return projectData.id;

    } catch (error) {
      console.error('Error creando proyecto interno:', error);
      toast.error('Error al crear proyecto interno');
      return null;
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleAddExtraTask = async () => {
    if (!myEmployeeProfile) return;
    if (!extraTaskName.trim()) { toast.error("Escribe un nombre para la tarea"); return; }
    
    const hours = Number(extraHours);
    if (isNaN(hours) || hours <= 0) { toast.error("Las horas deben ser mayores a 0"); return; }

    try {
      const projectId = await getOrCreateInternalProject();
      if (!projectId) { toast.error("No se pudo obtener el proyecto interno"); return; }

      const today = new Date();
      const mondayOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 });
      const formattedDate = format(mondayOfCurrentWeek, 'yyyy-MM-dd');

      await addAllocation({
        projectId, employeeId: myEmployeeProfile.id, weekStartDate: formattedDate,
        hoursAssigned: hours, hoursActual: hours, hoursComputed: hours,
        taskName: extraTaskName, status: 'completed'
      });

      toast.success(`"${extraTaskName}" registrada (${hours}h)`);
      setExtraTaskName('');
      setExtraHours('1');
      setIsAddingExtra(false);
    } catch (error) {
      console.error('Error añadiendo tarea interna:', error);
      toast.error('Error al registrar la tarea');
    }
  };

  const openAddTasksDialog = () => {
    const defaultWeek = getStorageKey(weeks[0]?.weekStart || new Date(), currentMonth);
    setNewTasks([{ id: crypto.randomUUID(), projectId: '', taskName: '', hours: '', weekDate: defaultWeek }]);
    setIsAddingTasks(true);
  };

  const addTaskRow = () => {
    const lastTask = newTasks[newTasks.length - 1];
    const defaultWeek = lastTask?.weekDate || getStorageKey(weeks[0]?.weekStart || new Date(), currentMonth);
    setNewTasks(prev => [...prev, { id: crypto.randomUUID(), projectId: lastTask?.projectId || '', taskName: '', hours: '', weekDate: defaultWeek }]);
  };

  const removeTaskRow = (id: string) => {
    if (newTasks.length === 1) return;
    setNewTasks(prev => prev.filter(t => t.id !== id));
  };

  const updateTaskRow = (id: string, field: keyof NewTaskRow, value: string) => {
    setNewTasks(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const handleSaveTasks = async () => {
    if (!myEmployeeProfile) return;

    const validTasks = newTasks.filter(t => t.projectId && t.taskName.trim() && parseFloat(t.hours) > 0);
    if (validTasks.length === 0) { toast.error("Añade al menos una tarea válida"); return; }

    try {
      for (const task of validTasks) {
        await addAllocation({
          projectId: task.projectId, employeeId: myEmployeeProfile.id,
          weekStartDate: task.weekDate, hoursAssigned: parseFloat(task.hours),
          taskName: task.taskName, status: 'planned'
        });
      }
      toast.success(`${validTasks.length} tarea(s) añadida(s)`);
      setIsAddingTasks(false);
      setNewTasks([]);
    } catch (error) {
      console.error('Error guardando tareas:', error);
      toast.error('Error al guardar las tareas');
    }
  };

  const handleExportCRM = () => {
    if (!myEmployeeProfile?.crmUserId) { toast.error("Configura tu ID de CRM en el perfil"); return; }

    const monthAllocations = allocations.filter(a =>
      a.employeeId === myEmployeeProfile.id &&
      isSameMonth(parseISO(a.weekStartDate), currentMonth) &&
      a.status !== 'completed'
    );

    if (monthAllocations.length === 0) { toast.warning("No hay tareas pendientes para exportar"); return; }

    // Formato CSV según especificación:
    // 1. Nombre de tarea entre comillas dobles (escapar comillas internas)
    // 2. ID de usuario CRM
    // 3. Tipo: 'project', 'customer', o 'lead'
    // 4. ID del elemento (project externalId)
    // 5. Horas computables (con punto decimal, o vacío si no hay)
    const csvRows: string[] = [];

    monthAllocations.forEach(alloc => {
      const project = projects.find(p => p.id === alloc.projectId);
      
      // Escapar comillas dobles en el nombre de la tarea (reemplazar " por "")
      const taskName = (alloc.taskName || 'Tarea').replace(/"/g, '""');
      
      // Formatear horas: usar punto decimal y convertir a string
      const hoursStr = alloc.hoursAssigned ? alloc.hoursAssigned.toString() : '';
      
      // Construir la línea CSV: nombre entre comillas, luego campos separados por comas
      const csvLine = [
        `"${taskName}"`,                    // Nombre tarea entre comillas dobles
        myEmployeeProfile.crmUserId,        // user_id
        'project',                          // Tipo: 'project' (por ahora solo proyectos)
        project?.externalId || '',          // project_id
        hoursStr                            // horas computables (con punto decimal o vacío)
      ].join(',');
      
      csvRows.push(csvLine);
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tareas_crm_${format(currentMonth, 'yyyy-MM')}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success(`${monthAllocations.length} tareas exportadas para el CRM`);
  };

  const tasksImpact = useMemo(() => {
    if (!myEmployeeProfile) return { projects: [], weeks: [] };

    const projectImpact: Record<string, { name: string; adding: number; status: ProjectBudgetStatus }> = {};
    
    newTasks.forEach(task => {
      if (task.projectId && task.hours) {
        const hours = parseFloat(task.hours) || 0;
        if (hours > 0) {
          if (!projectImpact[task.projectId]) {
            const project = projects.find(p => p.id === task.projectId);
            projectImpact[task.projectId] = { name: project?.name || 'Desconocido', adding: 0, status: getProjectBudgetStatus(task.projectId) };
          }
          projectImpact[task.projectId].adding += hours;
        }
      }
    });

    const projectsResult = Object.entries(projectImpact).map(([id, data]) => {
      const newTotal = data.status.totalComputed + data.status.totalPlanned + data.adding;
      const exceeds = data.status.budgetMax > 0 && newTotal > data.status.budgetMax;
      return { id, ...data, newTotal, exceeds };
    });

    const weekImpact: Record<string, { weekIndex: number; adding: number }> = {};
    
    newTasks.forEach(task => {
      if (task.weekDate && task.hours) {
        const hours = parseFloat(task.hours) || 0;
        if (hours > 0) {
          if (!weekImpact[task.weekDate]) {
            const weekIndex = weeks.findIndex((w) => getStorageKey(w.weekStart, currentMonth) === task.weekDate);
            weekImpact[task.weekDate] = { weekIndex: weekIndex >= 0 ? weekIndex : 0, adding: 0 };
          }
          weekImpact[task.weekDate].adding += hours;
        }
      }
    });

    const weeksResult = Object.entries(weekImpact).map(([weekDate, data]) => {
      const weekData = weeks[data.weekIndex];
      const currentLoad = weekData ? getEmployeeLoadForWeek(
        myEmployeeProfile.id, weekDate, weekData.effectiveStart, weekData.effectiveEnd
      ) : { hours: 0, capacity: 40 };
      
      const newTotal = round2(currentLoad.hours + data.adding);
      const exceeds = newTotal > currentLoad.capacity;
      
      return { weekDate, weekIndex: data.weekIndex, adding: data.adding, currentHours: currentLoad.hours, capacity: currentLoad.capacity, newTotal, exceeds };
    }).sort((a, b) => a.weekIndex - b.weekIndex);

    return { projects: projectsResult, weeks: weeksResult };
  }, [newTasks, projects, weeks, currentMonth, myEmployeeProfile, getEmployeeLoadForWeek]);

  const getProjectExceedStatus = (projectId: string): boolean => tasksImpact.projects.find(p => p.id === projectId)?.exceeds || false;
  const getWeekExceedStatus = (weekDate: string): boolean => tasksImpact.weeks.find(w => w.weekDate === weekDate)?.exceeds || false;

  const handlePrevMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  const handleToday = () => setCurrentMonth(new Date());

  // Mostrar loader mientras carga global o el perfil
  if (isGlobalLoading || isLoadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin opacity-60" />
        </div>
      </div>
    );
  }
  
  // Solo mostrar error después de que termine de cargar
  if (!myEmployeeProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
          <h2 className="text-xl font-semibold text-slate-700">No se encontró tu perfil de empleado</h2>
          <p className="text-slate-500">Contacta con un administrador para vincular tu cuenta de usuario con un perfil de empleado.</p>
        </div>
      </div>
    );
  }

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridTemplate = `250px repeat(${weeks.length}, minmax(0, 1fr)) 100px`;
  const monthlyLoad = getEmployeeMonthlyLoad(myEmployeeProfile.id, currentMonth.getFullYear(), currentMonth.getMonth());

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6 pb-20 animate-in fade-in duration-500">
      
      {/* 1. CABECERA + ACCIONES */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Hola, {myEmployeeProfile.first_name || myEmployeeProfile.name.split(' ')[0]} 👋
          </h1>
          <p className="text-slate-500">Panel de control operativo</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={openAddTasksDialog} className="gap-2 bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm" data-tour="add-tasks">
            <ListPlus className="h-4 w-4" /> Añadir tareas
          </Button>

          <Button onClick={handleExportCRM} variant="outline" className="gap-2 border-purple-300 text-purple-700 hover:bg-purple-50"
            disabled={!myEmployeeProfile?.crmUserId} title={!myEmployeeProfile?.crmUserId ? "Configura tu ID de CRM en el perfil" : "Exportar tareas al CRM"} data-tour="crm-export">
            <FileDown className="h-4 w-4" /> Tareas CRM
          </Button>

          <Dialog open={isAddingExtra} onOpenChange={setIsAddingExtra}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-slate-300 hover:bg-slate-50" data-tour="internal-tasks">
                <Clock className="h-4 w-4" /> Gestión interna
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-slate-600" />Registrar gestión interna</DialogTitle>
                <DialogDescription>Reuniones, formaciones, deadlines u otras tareas no asociadas a clientes.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nombre de la tarea</Label>
                  <Input placeholder="Ej: Reunión de equipo" value={extraTaskName} onChange={e => setExtraTaskName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Horas</Label>
                  <Input type="number" min="0.5" step="0.5" value={extraHours} onChange={e => setExtraHours(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddingExtra(false)}>Cancelar</Button>
                <Button onClick={handleAddExtraTask} disabled={isCreatingProject}>{isCreatingProject ? 'Creando...' : 'Registrar'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="h-9 w-px bg-slate-200 mx-1 hidden sm:block"></div>

          <Button variant="outline" onClick={() => setShowGoals(true)} className="gap-2 text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100" data-tour="goals">
            <TrendingUp className="h-4 w-4" /> Objetivos
          </Button>
          
          <Button variant="outline" onClick={() => setShowAbsences(true)} className="gap-2 text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100" data-tour="absences">
            <Calendar className="h-4 w-4" /> Ausencias
          </Button>

          <EmployeeSettings employeeId={myEmployeeProfile.id} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-slate-600">
                <HelpCircle className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={resetTour} className="gap-2">
                <RotateCcw className="h-4 w-4" />Ver tour de bienvenida
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 2. CONTROL MES */}
      <div className="flex items-center gap-4 bg-white p-2 rounded-lg border shadow-sm w-fit">
        <h2 className="text-lg font-bold capitalize text-slate-900 flex items-center gap-2 ml-2">
          {getMonthName(currentMonth)} <Badge variant="outline" className="text-xs font-normal">{currentMonth.getFullYear()}</Badge>
        </h2>
        <div className="h-6 w-px bg-slate-200 mx-2" />
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrevMonth}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={handleToday} className="h-7 text-xs px-2"><CalendarDays className="h-3.5 w-3.5 mr-1.5" />Mes actual</Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNextMonth}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* 3. CALENDARIO */}
      <Card className="overflow-hidden border-slate-200 shadow-sm bg-white" data-tour="calendar">
        <div className="overflow-x-auto custom-scrollbar">
          <div style={{ minWidth: '1000px' }}>
            <div className="grid bg-slate-50 border-b" style={{ gridTemplateColumns: gridTemplate }}>
              <div className="px-4 py-3 font-bold text-sm text-slate-700 flex items-center border-r">Mi calendario</div>
              {weeks.map((week, index) => (
                <div key={week.weekStart.toISOString()} className="text-center px-1 py-2 border-r flex flex-col justify-center">
                  <span className="text-xs font-bold uppercase text-slate-500">S{index + 1}</span>
                  <span className="text-[10px] text-slate-400 font-medium">{format(max([week.weekStart, monthStart]), 'd', { locale: es })}-{format(min([addDays(week.weekStart, 4), monthEnd]), 'd MMM', { locale: es })}</span>
                </div>
              ))}
              <div className="px-2 py-3 font-bold text-xs text-center flex items-center justify-center">TOTAL MES</div>
            </div>

            <div className="grid bg-white" style={{ gridTemplateColumns: gridTemplate }}>
              <EmployeeRow employee={myEmployeeProfile} weeks={weeks} projects={projects} allocations={allocations} absences={absences} teamEvents={teamEvents} viewDate={currentMonth} onOpenSheet={(empId, date) => setSelectedCell({ employeeId: empId, weekStart: date })} />
              <div className="flex items-center justify-center border-l p-2 bg-slate-50/30">
                <div className={cn("flex flex-col items-center justify-center w-20 h-14 rounded-lg border", monthlyLoad.percentage > 100 ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700")}>
                  <span className="text-base font-bold leading-none">{monthlyLoad.hours}h</span>
                  <span className="text-[10px] opacity-70">/ {monthlyLoad.capacity}h</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 4. COLABORADORES Y AYUDA */}
      <CollaborationCards employeeId={myEmployeeProfile.id} viewDate={currentMonth} />

      {/* 5. ALERTAS (izq) + DEPENDENCIAS (der) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div data-tour="priority-widget" className="flex">
          <div className="w-full">
            <PriorityInsights employeeId={myEmployeeProfile.id} />
          </div>
        </div>
        
        <div data-tour="dependencies-widget" className="flex">
          <div className="w-full">
            <ProjectTeamPulse employeeId={myEmployeeProfile.id} />
          </div>
        </div>
      </div>

      {/* 6. PRECISIÓN DE PLANIFICACIÓN */}
      <div data-tour="reliability-index">
        <ReliabilityIndexCard employeeId={myEmployeeProfile.id} />
      </div>

      {/* 7. PROYECTOS DEL MES */}
      <div data-tour="projects-summary">
        <MyWeekView employeeId={myEmployeeProfile.id} viewDate={currentMonth} />
      </div>

      {/* 8. BALANCE MOTIVACIONAL DEL MES */}
      <MonthlyBalanceCard employeeId={myEmployeeProfile.id} viewDate={currentMonth} />

      {/* MODALES */}
      {selectedCell && (
        <AllocationSheet open={!!selectedCell} onOpenChange={(open) => !open && setSelectedCell(null)} employeeId={selectedCell.employeeId} weekStart={selectedCell.weekStart.toISOString()} viewDateContext={currentMonth} />
      )}

      <Dialog open={isAddingTasks} onOpenChange={setIsAddingTasks}>
        <DialogContent className="sm:max-w-[900px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ListPlus className="h-5 w-5 text-indigo-600" />Añadir tareas</DialogTitle>
            <DialogDescription>Añade múltiples tareas a tu planificación de {getMonthName(currentMonth)}.</DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="flex text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-2">
              <div className="flex-1 pl-1">Proyecto</div>
              <div className="flex-1 pl-1">Tarea</div>
              <div className="w-24 text-center">Horas</div>
              <div className="w-32">Semana</div>
              <div className="w-8"></div>
            </div>
            
            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2 -mr-2">
              {newTasks.map((task) => {
                const projectExceeds = task.projectId && getProjectExceedStatus(task.projectId);
                const weekExceeds = task.weekDate && getWeekExceedStatus(task.weekDate);
                
                return (
                  <div key={task.id} className="flex gap-2 items-start">
                    <div className="flex-1 min-w-0">
                      <Popover open={openComboboxId === task.id} onOpenChange={(isOpen) => setOpenComboboxId(isOpen ? task.id : null)}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" role="combobox" className={cn("w-full justify-between h-9 text-xs truncate", projectExceeds && "border-amber-400 bg-amber-50")}>
                            <span className="truncate">{task.projectId ? formatProjectName(getProjectDisplayName(task.projectId)) : "Seleccionar..."}</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0">
                          <Command>
                            <CommandInput placeholder="Buscar proyecto..." />
                            <CommandList>
                              <CommandEmpty>No hay proyectos</CommandEmpty>
                              <CommandGroup>
                                {activeProjects.map(p => {
                                  const client = clients.find(c => c.id === p.clientId);
                                  return (
                                    <CommandItem key={p.id} value={`${client?.name} ${p.name}`} onSelect={() => { updateTaskRow(task.id, 'projectId', p.id); setOpenComboboxId(null); }}>
                                      <Check className={cn("mr-2 h-4 w-4", task.projectId === p.id ? "opacity-100" : "opacity-0")} />
                                      <span className="truncate">{client?.name} - {p.name}</span>
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    
                    <div className="flex-1">
                      <Input placeholder="Nombre de la tarea" className="h-9 text-xs" value={task.taskName} onChange={e => updateTaskRow(task.id, 'taskName', e.target.value)} />
                    </div>
                    
                    <div className="w-24">
                      <Input type="number" min="0.5" step="0.5" placeholder="Horas" className="h-9 text-xs text-center" value={task.hours} onChange={e => updateTaskRow(task.id, 'hours', e.target.value)} />
                    </div>
                    
                    <div className="w-32">
                      <Select value={task.weekDate} onValueChange={(v) => updateTaskRow(task.id, 'weekDate', v)}>
                        <SelectTrigger className={cn("h-9 text-xs", weekExceeds && "border-amber-400 bg-amber-50")}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {weeks.map((w, i) => <SelectItem key={w.weekStart.toISOString()} value={getStorageKey(w.weekStart, currentMonth)}>Sem {i + 1}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <Button variant="ghost" size="icon" className="h-9 w-8 text-slate-400 hover:text-red-500" onClick={() => removeTaskRow(task.id)} disabled={newTasks.length === 1}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
            
            <Button variant="outline" size="sm" onClick={addTaskRow} className="w-full mt-4 border-dashed">
              <Plus className="h-4 w-4 mr-2" /> Añadir otra fila
            </Button>
          </div>
          
          <DialogFooter className="flex flex-col gap-2">
            {(tasksImpact.projects.length > 0 || tasksImpact.weeks.length > 0) && (
              <div className="w-full flex items-center gap-2 text-xs p-2 bg-slate-50 rounded-lg flex-wrap">
                {tasksImpact.projects.map((p) => (
                  <div key={p.id} className="flex items-center gap-1.5">
                    {p.exceeds ? <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                    <span className={cn("font-medium truncate max-w-[100px]", p.exceeds ? "text-amber-700" : "text-emerald-700")}>{formatProjectName(p.name)}</span>
                    <span className={cn("tabular-nums", p.exceeds ? "text-amber-600" : "text-emerald-600")}>+{p.adding}h</span>
                  </div>
                ))}
                {tasksImpact.projects.length > 0 && tasksImpact.weeks.length > 0 && <span className="text-slate-300">│</span>}
                {tasksImpact.weeks.map((w) => (
                  <div key={w.weekDate} className="flex items-center gap-1.5">
                    {w.exceeds ? <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                    <span className={cn("font-medium", w.exceeds ? "text-amber-700" : "text-emerald-700")}>S{w.weekIndex + 1}</span>
                    <span className={cn("tabular-nums text-[10px]", w.exceeds ? "text-amber-600" : "text-emerald-600")}>{w.newTotal}h/{w.capacity}h</span>
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex justify-end gap-2 w-full">
              <Button variant="outline" onClick={() => setIsAddingTasks(false)}>Cancelar</Button>
              <Button onClick={handleSaveTasks} className="bg-indigo-600 hover:bg-indigo-700">Guardar tareas</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showGoals && <ProfessionalGoalsSheet open={showGoals} onOpenChange={setShowGoals} employeeId={myEmployeeProfile.id} />}
      {showAbsences && <AbsencesSheet open={showAbsences} onOpenChange={setShowAbsences} employeeId={myEmployeeProfile.id} />}
      
      <WelcomeTour forceShow={showTour} />
    </div>
  );
}
