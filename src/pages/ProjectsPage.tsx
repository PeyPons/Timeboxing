import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format, addMonths, subMonths, isSameMonth, parseISO, getDaysInMonth, getDate } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  FolderKanban, ChevronLeft, ChevronRight, Briefcase, Pencil, Search, 
  ChevronsUpDown, User, Target, Plus, Trash2, ChevronDown,
  AlertTriangle, AlertCircle, Clock, TrendingUp, TrendingDown,
  CheckCircle2, XCircle, Calendar, Zap, Filter, LayoutGrid, List,
  AlertOctagon, CircleDashed, Ban
} from 'lucide-react';
import { Project, OKR } from '@/types';
import { cn, formatProjectName } from '@/lib/utils';

const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

type FilterType = 'all' | 'needs-planning' | 'behind-schedule' | 'over-budget' | 'no-activity';

export default function ProjectsPage() {
  const { projects, clients, allocations, employees, deleteProject, updateProject, addProject } = useApp();
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('all');
  const [openEmployeeCombo, setOpenEmployeeCombo] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
      name: '', clientId: '', budgetHours: '', minimumHours: '', monthlyFee: '',
      status: 'active' as 'active' | 'archived' | 'completed',
      okrs: [] as OKR[]
  });
  const [newOkrTitle, setNewOkrTitle] = useState('');

  const handlePrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const handleToday = () => setCurrentMonth(new Date());

  // Calcular el progreso del mes (qué % del mes ha pasado)
  const monthProgress = useMemo(() => {
    const today = new Date();
    if (!isSameMonth(today, currentMonth)) {
      return today > currentMonth ? 100 : 0;
    }
    const daysInMonth = getDaysInMonth(currentMonth);
    const currentDay = getDate(today);
    return Math.round((currentDay / daysInMonth) * 100);
  }, [currentMonth]);

  // Análisis de todos los proyectos con métricas
  const projectsAnalysis = useMemo(() => {
    return projects
      .filter(p => p.status === 'active')
      .map(project => {
        const client = clients.find(c => c.id === project.clientId);
        let monthTasks = allocations.filter(a => 
          a.projectId === project.id && 
          isSameMonth(parseISO(a.weekStartDate), currentMonth)
        );

        const totalAssigned = monthTasks.reduce((sum, t) => sum + t.hoursAssigned, 0);
        const completedTasks = monthTasks.filter(t => t.status === 'completed');
        const pendingTasks = monthTasks.filter(t => t.status !== 'completed');

        const hoursReal = completedTasks.reduce((sum, t) => sum + (t.hoursActual || 0), 0);
        const hoursComputed = completedTasks.reduce((sum, t) => sum + (t.hoursComputed || 0), 0);
        const gain = hoursComputed - hoursReal;

        const budget = project.budgetHours || 0;
        const minimum = project.minimumHours || 0;
        
        // Cálculos de estado
        const planningPct = budget > 0 ? (totalAssigned / budget) * 100 : 0;
        const executionPct = totalAssigned > 0 ? (hoursComputed / totalAssigned) * 100 : 0;
        
        // Detección de problemas
        const needsPlanning = budget > 0 && totalAssigned < budget * 0.5; // Menos del 50% planificado
        const behindSchedule = monthProgress > 30 && executionPct < (monthProgress - 20); // 20% por debajo del ritmo
        const overBudget = budget > 0 && totalAssigned > budget;
        const noActivity = budget > 0 && totalAssigned === 0;

        // Empleados involucrados
        const involvedEmployees = [...new Set(monthTasks.map(t => t.employeeId))];

        return {
          project,
          client,
          monthTasks,
          completedTasks,
          pendingTasks,
          totalAssigned,
          hoursReal,
          hoursComputed,
          gain,
          budget,
          minimum,
          planningPct,
          executionPct,
          involvedEmployees,
          // Flags de problemas
          needsPlanning,
          behindSchedule,
          overBudget,
          noActivity,
          hasIssue: needsPlanning || behindSchedule || overBudget || noActivity
        };
      });
  }, [projects, clients, allocations, currentMonth, monthProgress]);

  // Contadores para filtros
  const filterCounts = useMemo(() => ({
    all: projectsAnalysis.length,
    'needs-planning': projectsAnalysis.filter(p => p.needsPlanning && !p.noActivity).length,
    'behind-schedule': projectsAnalysis.filter(p => p.behindSchedule).length,
    'over-budget': projectsAnalysis.filter(p => p.overBudget).length,
    'no-activity': projectsAnalysis.filter(p => p.noActivity).length,
  }), [projectsAnalysis]);

  // Resumen del mes
  const monthSummary = useMemo(() => {
    const totalPlanned = projectsAnalysis.reduce((sum, p) => sum + p.totalAssigned, 0);
    const totalExecuted = projectsAnalysis.reduce((sum, p) => sum + p.hoursComputed, 0);
    const totalGain = projectsAnalysis.reduce((sum, p) => sum + p.gain, 0);
    const healthy = projectsAnalysis.filter(p => !p.hasIssue).length;
    const withIssues = projectsAnalysis.filter(p => p.hasIssue).length;

    return { totalPlanned, totalExecuted, totalGain, healthy, withIssues };
  }, [projectsAnalysis]);

  // Filtrar proyectos
  const filteredProjects = useMemo(() => {
    return projectsAnalysis.filter(p => {
      // Búsqueda
      if (searchTerm && !p.project.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      // Filtro de empleado
      if (selectedEmployeeId !== 'all' && !p.involvedEmployees.includes(selectedEmployeeId)) {
        return false;
      }

      // Filtro activo
      switch (activeFilter) {
        case 'needs-planning':
          return p.needsPlanning && !p.noActivity;
        case 'behind-schedule':
          return p.behindSchedule;
        case 'over-budget':
          return p.overBudget;
        case 'no-activity':
          return p.noActivity;
        default:
          return true;
      }
    }).sort((a, b) => {
      // Ordenar: problemas primero, luego por nombre
      if (a.hasIssue && !b.hasIssue) return -1;
      if (!a.hasIssue && b.hasIssue) return 1;
      return a.project.name.localeCompare(b.project.name);
    });
  }, [projectsAnalysis, searchTerm, selectedEmployeeId, activeFilter]);

  const toggleProject = (id: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpandedProjects(new Set(filteredProjects.map(p => p.project.id)));
  const collapseAll = () => setExpandedProjects(new Set());

  // Dialog handlers
  const openNewProject = () => {
      setIsCreating(true);
      setEditingId(null);
      setFormData({ name: '', clientId: '', budgetHours: '0', minimumHours: '0', monthlyFee: '0', status: 'active', okrs: [] });
      setIsDialogOpen(true);
  };

  const openEditProject = (project: Project) => {
      setIsCreating(false);
      setEditingId(project.id);
      setFormData({
          name: project.name, clientId: project.clientId,
          budgetHours: project.budgetHours?.toString() || '0', minimumHours: project.minimumHours?.toString() || '0',
          monthlyFee: project.monthlyFee?.toString() || '0', status: project.status,
          okrs: project.okrs || []
      });
      setIsDialogOpen(true);
  };

  const handleSave = async () => {
      try {
          if (isCreating) {
              await addProject({
                  name: formData.name,
                  clientId: formData.clientId,
                  budgetHours: parseFloat(formData.budgetHours) || 0,
                  minimumHours: parseFloat(formData.minimumHours) || 0,
                  monthlyFee: parseFloat(formData.monthlyFee) || 0,
                  status: formData.status,
                  okrs: formData.okrs
              });
          } else if (editingId) {
              const existingProject = projects.find(p => p.id === editingId);
              if (existingProject) {
                  await updateProject({
                      ...existingProject,
                      name: formData.name,
                      clientId: formData.clientId,
                      budgetHours: parseFloat(formData.budgetHours) || 0,
                      minimumHours: parseFloat(formData.minimumHours) || 0,
                      monthlyFee: parseFloat(formData.monthlyFee) || 0,
                      status: formData.status,
                      okrs: formData.okrs
                  });
              }
          }
          setIsDialogOpen(false);
      } catch (error) {
          console.error(error);
          alert("Error al guardar.");
      }
  };

  const handleDelete = async () => {
      if (!editingId) return;
      if (confirm("¿Estás seguro de eliminar este proyecto? Se borrarán sus asignaciones.")) {
          try {
              await deleteProject(editingId);
              setIsDialogOpen(false);
          } catch (e) { console.error(e); alert("No se pudo eliminar."); }
      }
  };

  const addOkrToForm = () => { if (!newOkrTitle.trim()) return; setFormData({ ...formData, okrs: [...formData.okrs, { id: crypto.randomUUID(), title: newOkrTitle, progress: 0 }] }); setNewOkrTitle(''); };
  const updateOkrProgress = (id: string, val: number) => { setFormData({ ...formData, okrs: formData.okrs.map(o => o.id === id ? { ...o, progress: val } : o) }); };
  const removeOkr = (id: string) => { setFormData({ ...formData, okrs: formData.okrs.filter(o => o.id !== id) }); };

  const getSelectedEmployeeName = () => selectedEmployeeId === 'all' ? "Todos los empleados" : employees.find(e => e.id === selectedEmployeeId)?.name || "Seleccionar...";

  return (
    <div className="flex flex-col h-full space-y-6 p-6 md:p-8 max-w-7xl mx-auto w-full">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <FolderKanban className="h-8 w-8 text-indigo-600" /> Proyectos
          </h1>
          <p className="text-muted-foreground">Panel de control y seguimiento operativo</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={openNewProject} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
            <Plus className="h-4 w-4" /> Nuevo proyecto
          </Button>
          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border shadow-sm">
            <Button variant="ghost" size="icon" onClick={handlePrevMonth} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="px-3 min-w-[130px] text-center font-medium capitalize text-sm">
              {format(currentMonth, 'MMMM yyyy', { locale: es })}
            </div>
            <Button variant="ghost" size="icon" onClick={handleNextMonth} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleToday} className="text-xs h-8">
              Hoy
            </Button>
          </div>
        </div>
      </div>

      {/* RESUMEN DEL MES */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-slate-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <FolderKanban className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{projectsAnalysis.length}</p>
                <p className="text-xs text-slate-500">Proyectos activos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{round2(monthSummary.totalPlanned)}h</p>
                <p className="text-xs text-slate-500">Planificadas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{round2(monthSummary.totalExecuted)}h</p>
                <p className="text-xs text-slate-500">Ejecutadas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn("bg-gradient-to-br", monthSummary.totalGain >= 0 ? "from-emerald-50 to-white" : "from-red-50 to-white")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", monthSummary.totalGain >= 0 ? "bg-emerald-100" : "bg-red-100")}>
                {monthSummary.totalGain >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-600" />
                )}
              </div>
              <div>
                <p className={cn("text-2xl font-bold", monthSummary.totalGain >= 0 ? "text-emerald-600" : "text-red-600")}>
                  {monthSummary.totalGain >= 0 ? '+' : ''}{round2(monthSummary.totalGain)}h
                </p>
                <p className="text-xs text-slate-500">Balance</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{monthSummary.withIssues}</p>
                <p className="text-xs text-slate-500">Requieren atención</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PROGRESO DEL MES */}
      {isSameMonth(new Date(), currentMonth) && (
        <div className="bg-slate-100 rounded-lg p-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-600 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Progreso del mes
            </span>
            <span className="font-bold text-slate-700">{monthProgress}% transcurrido</span>
          </div>
          <Progress value={monthProgress} className="h-2" />
        </div>
      )}

      {/* FILTROS */}
      <div className="flex flex-col xl:flex-row gap-4 bg-white p-4 rounded-xl border shadow-sm">
        {/* Búsqueda */}
        <div className="relative w-full xl:w-64 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input 
            placeholder="Buscar proyecto..." 
            className="pl-10 bg-slate-50 border-slate-200" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
        </div>

        {/* Filtros de estado - Chips */}
        <div className="flex flex-wrap gap-2 flex-1">
          <Button
            variant={activeFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveFilter('all')}
            className={cn(
              "h-8 text-xs gap-1.5",
              activeFilter === 'all' ? "bg-slate-900" : "bg-white"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Todos
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
              {filterCounts.all}
            </Badge>
          </Button>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={activeFilter === 'no-activity' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveFilter('no-activity')}
                  className={cn(
                    "h-8 text-xs gap-1.5",
                    activeFilter === 'no-activity' 
                      ? "bg-slate-700" 
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <Ban className="h-3.5 w-3.5" />
                  Sin actividad
                  {filterCounts['no-activity'] > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] bg-slate-200">
                      {filterCounts['no-activity']}
                    </Badge>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px] text-center">
                <p className="text-xs">Proyectos con horas asignadas pero sin ninguna tarea planificada este mes</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={activeFilter === 'needs-planning' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveFilter('needs-planning')}
                  className={cn(
                    "h-8 text-xs gap-1.5",
                    activeFilter === 'needs-planning' 
                      ? "bg-amber-600 hover:bg-amber-700" 
                      : "bg-white border-amber-200 text-amber-700 hover:bg-amber-50"
                  )}
                >
                  <CircleDashed className="h-3.5 w-3.5" />
                  Falta planificar
                  {filterCounts['needs-planning'] > 0 && (
                    <Badge className={cn(
                      "ml-1 h-5 px-1.5 text-[10px]",
                      activeFilter === 'needs-planning' ? "bg-amber-700" : "bg-amber-100 text-amber-700"
                    )}>
                      {filterCounts['needs-planning']}
                    </Badge>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px] text-center">
                <p className="text-xs">Proyectos con menos del 50% de sus horas planificadas para este mes</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={activeFilter === 'behind-schedule' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveFilter('behind-schedule')}
                  className={cn(
                    "h-8 text-xs gap-1.5",
                    activeFilter === 'behind-schedule' 
                      ? "bg-orange-600 hover:bg-orange-700" 
                      : "bg-white border-orange-200 text-orange-700 hover:bg-orange-50"
                  )}
                >
                  <Clock className="h-3.5 w-3.5" />
                  Retrasados
                  {filterCounts['behind-schedule'] > 0 && (
                    <Badge className={cn(
                      "ml-1 h-5 px-1.5 text-[10px]",
                      activeFilter === 'behind-schedule' ? "bg-orange-700" : "bg-orange-100 text-orange-700"
                    )}>
                      {filterCounts['behind-schedule']}
                    </Badge>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px] text-center">
                <p className="text-xs">Proyectos cuya ejecución va más de 20 puntos por debajo del progreso del mes</p>
                <p className="text-[10px] text-slate-400 mt-1">Ej: Si va el 80% del mes, deberían tener al menos 60% ejecutado</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={activeFilter === 'over-budget' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveFilter('over-budget')}
                  className={cn(
                    "h-8 text-xs gap-1.5",
                    activeFilter === 'over-budget' 
                      ? "bg-red-600 hover:bg-red-700" 
                      : "bg-white border-red-200 text-red-700 hover:bg-red-50"
                  )}
                >
                  <AlertOctagon className="h-3.5 w-3.5" />
                  Exceso horas
                  {filterCounts['over-budget'] > 0 && (
                    <Badge className={cn(
                      "ml-1 h-5 px-1.5 text-[10px]",
                      activeFilter === 'over-budget' ? "bg-red-700" : "bg-red-100 text-red-700"
                    )}>
                      {filterCounts['over-budget']}
                    </Badge>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px] text-center">
                <p className="text-xs">Proyectos donde se han planificado más horas de las asignadas</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

        </div>

        {/* Filtro de empleado */}
        <Popover open={openEmployeeCombo} onOpenChange={setOpenEmployeeCombo}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" className="w-full xl:w-[220px] justify-between bg-white shrink-0">
              <span className="flex items-center gap-2 truncate">
                <User className="h-3.5 w-3.5 text-slate-400 shrink-0" /> 
                <span className="truncate">{getSelectedEmployeeName()}</span>
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[220px] p-0">
            <Command>
              <CommandInput placeholder="Buscar..." />
              <CommandList>
                <CommandGroup>
                  <CommandItem onSelect={() => { setSelectedEmployeeId('all'); setOpenEmployeeCombo(false); }}>
                    Todos los empleados
                  </CommandItem>
                  {employees.filter(e => e.isActive).map(e => (
                    <CommandItem key={e.id} onSelect={() => { setSelectedEmployeeId(e.id); setOpenEmployeeCombo(false); }}>
                      {e.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* ACCIONES DE LISTA */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {filteredProjects.length} proyecto{filteredProjects.length !== 1 ? 's' : ''}
          {activeFilter !== 'all' && ' con este filtro'}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={expandAll} className="text-xs h-7">
            Expandir todos
          </Button>
          <Button variant="ghost" size="sm" onClick={collapseAll} className="text-xs h-7">
            Colapsar todos
          </Button>
        </div>
      </div>

      {/* LISTA DE PROYECTOS */}
      <div className="space-y-3">
        {filteredProjects.length === 0 ? (
          <Card className="p-12">
            <div className="text-center">
              <FolderKanban className="h-12 w-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No hay proyectos con este filtro</p>
              <p className="text-sm text-slate-400 mt-1">Prueba con otros criterios de búsqueda</p>
            </div>
          </Card>
        ) : (
          filteredProjects.map((data) => {
            const isExpanded = expandedProjects.has(data.project.id);
            
            return (
              <Collapsible 
                key={data.project.id} 
                open={isExpanded} 
                onOpenChange={() => toggleProject(data.project.id)}
              >
                <Card className={cn(
                  "overflow-hidden transition-all border-l-4",
                  data.hasIssue ? "border-l-amber-500" : "border-l-emerald-500"
                )}>
                  {/* HEADER COLAPSABLE */}
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50/80 transition-colors">
                      {/* Icono expandir */}
                      <ChevronDown className={cn(
                        "h-5 w-5 text-slate-400 transition-transform shrink-0",
                        isExpanded && "rotate-180"
                      )} />

                      {/* Info proyecto + Barra de progreso */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-slate-900 truncate">
                            {formatProjectName(data.project.name)}
                          </h3>
                          
                          {/* Badges de estado con tooltips */}
                          <TooltipProvider>
                            {data.noActivity && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-500 border-slate-200 cursor-help">
                                    Sin actividad
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">No hay tareas planificadas este mes</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {data.needsPlanning && !data.noActivity && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 cursor-help">
                                    {round2(data.planningPct)}% planificado
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">Solo {round2(data.totalAssigned)}h de {data.budget}h están planificadas</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {data.behindSchedule && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200 cursor-help">
                                    {round2(data.executionPct)}% ejecutado
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">Va el {monthProgress}% del mes pero solo {round2(data.executionPct)}% ejecutado</p>
                                  <p className="text-[10px] text-slate-400">Debería estar al menos al {monthProgress - 20}%</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {data.overBudget && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200 cursor-help">
                                    +{round2(data.totalAssigned - data.budget)}h exceso
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">Se han planificado {round2(data.totalAssigned)}h de {data.budget}h asignadas</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </TooltipProvider>
                        </div>
                        
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-xs text-slate-500 shrink-0">
                            {data.client?.name || 'Sin cliente'}
                          </span>
                          
                          {/* Mini barra de progreso inline */}
                          {data.budget > 0 && (
                            <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                              <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                {/* Barra de ejecución (verde) */}
                                <div 
                                  className="h-full bg-emerald-500 rounded-full"
                                  style={{ width: `${Math.min(100, (data.hoursComputed / data.budget) * 100)}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-slate-500 tabular-nums shrink-0">
                                {round2((data.hoursComputed / data.budget) * 100)}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Métricas rápidas */}
                      <div className="hidden md:flex items-center gap-4 text-sm shrink-0">
                        {/* Planificado vs Asignado */}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <div className="text-center min-w-[80px] cursor-help">
                                <p className={cn(
                                  "font-mono font-bold",
                                  data.overBudget ? "text-red-600" : 
                                  data.needsPlanning ? "text-amber-600" : "text-slate-700"
                                )}>
                                  {round2(data.totalAssigned)}h
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {data.budget > 0 ? `de ${data.budget}h` : 'planificado'}
                                </p>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Horas planificadas / Horas asignadas al proyecto</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        {/* Ejecutado */}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <div className="text-center min-w-[70px] cursor-help">
                                <p className="font-mono font-bold text-emerald-600">
                                  {round2(data.hoursComputed)}h
                                </p>
                                <p className="text-[10px] text-slate-400">ejecutado</p>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Horas computadas (trabajo completado)</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        {/* Balance */}
                        {Math.abs(data.gain) > 0.01 && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <div className={cn(
                                  "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium cursor-help",
                                  data.gain > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                                )}>
                                  {data.gain > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                                  {data.gain > 0 ? '+' : ''}{round2(data.gain)}h
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">
                                  {data.gain > 0 
                                    ? 'Ganancia: Se computó más de lo trabajado realmente' 
                                    : 'Pérdida: Se trabajó más de lo que se pudo computar'}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}

                        {/* Tareas */}
                        <div className="text-center min-w-[50px]">
                          <p className="font-mono text-slate-600">
                            <span className="text-emerald-600">{data.completedTasks.length}</span>
                            <span className="text-slate-300">/</span>
                            <span>{data.monthTasks.length}</span>
                          </p>
                          <p className="text-[10px] text-slate-400">tareas</p>
                        </div>
                      </div>

                      {/* Botón editar */}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-slate-400 hover:text-slate-600 shrink-0"
                        onClick={(e) => { e.stopPropagation(); openEditProject(data.project); }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </CollapsibleTrigger>

                  {/* CONTENIDO EXPANDIDO */}
                  <CollapsibleContent>
                    <div className="border-t bg-slate-50/50">
                      {/* Barra de progreso */}
                      {data.budget > 0 && (
                        <div className="px-4 py-3 border-b bg-white">
                          <div className="flex justify-between text-xs mb-2">
                            <span className="text-slate-600">
                              <span className="font-semibold text-slate-800">{round2(data.totalAssigned)}h</span> planificadas
                              {data.totalAssigned < data.budget && (
                                <span className="text-amber-600 ml-2">(Faltan {round2(data.budget - data.totalAssigned)}h)</span>
                              )}
                              {data.overBudget && (
                                <span className="text-red-600 ml-2">(+{round2(data.totalAssigned - data.budget)}h de exceso)</span>
                              )}
                            </span>
                            <span className="text-slate-500">
                              Asignadas: <span className="font-semibold text-slate-700">{data.budget}h</span>
                            </span>
                          </div>
                          
                          {/* Barra doble: planificado vs ejecutado */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-400 w-16">Planificado</span>
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className={cn(
                                    "h-full rounded-full transition-all",
                                    data.overBudget ? "bg-red-500" : 
                                    data.planningPct < 50 ? "bg-amber-500" : "bg-blue-500"
                                  )}
                                  style={{ width: `${Math.min(100, data.planningPct)}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-medium text-slate-600 w-12 text-right">
                                {round2(data.planningPct)}%
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-400 w-16">Ejecutado</span>
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-emerald-500 rounded-full transition-all"
                                  style={{ width: `${Math.min(100, (data.hoursComputed / data.budget) * 100)}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-medium text-emerald-600 w-12 text-right">
                                {round2((data.hoursComputed / data.budget) * 100)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Tareas pendientes */}
                      <div className="p-4">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                          Tareas pendientes ({data.pendingTasks.length})
                        </h4>
                        
                        {data.pendingTasks.length > 0 ? (
                          <div className="space-y-2">
                            {data.pendingTasks.map(task => {
                              const emp = employees.find(e => e.id === task.employeeId);
                              return (
                                <div key={task.id} className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <Avatar className="h-7 w-7 border shrink-0">
                                      <AvatarImage src={emp?.avatarUrl} />
                                      <AvatarFallback className="bg-indigo-100 text-indigo-700 text-[9px] font-bold">
                                        {emp?.name.substring(0, 2).toUpperCase() || "??"}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium truncate">{task.taskName}</p>
                                      <p className="text-[10px] text-slate-400">
                                        {emp?.name} • Sem {format(parseISO(task.weekStartDate), 'w')}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="font-mono font-bold text-sm">{task.hoursAssigned}h</p>
                                    <p className="text-[10px] text-slate-400">estimado</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 text-center py-4 bg-white rounded-lg border border-dashed">
                            Sin tareas pendientes este mes
                          </p>
                        )}
                      </div>

                      {/* Tareas completadas (colapsable) */}
                      {data.completedTasks.length > 0 && (
                        <details className="border-t">
                          <summary className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-slate-100 transition-colors list-none select-none bg-white">
                            <span className="text-xs font-medium text-emerald-700 flex items-center gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5" /> 
                              {data.completedTasks.length} tareas completadas
                            </span>
                            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                          </summary>
                          <div className="px-4 pb-4 pt-2 space-y-2 bg-slate-50">
                            {data.completedTasks.map(task => {
                              const emp = employees.find(e => e.id === task.employeeId);
                              const real = task.hoursActual || 0;
                              const computed = task.hoursComputed || 0;
                              const taskGain = computed - real;
                              return (
                                <div key={task.id} className="flex items-center justify-between p-3 bg-white border rounded-lg border-l-4 border-l-emerald-500 opacity-75">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <Avatar className="h-7 w-7 border shrink-0">
                                      <AvatarImage src={emp?.avatarUrl} />
                                      <AvatarFallback className="bg-emerald-100 text-emerald-700 text-[9px] font-bold">
                                        {emp?.name.substring(0, 2).toUpperCase() || "??"}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium truncate line-through text-slate-500">{task.taskName}</p>
                                      <p className="text-[10px] text-slate-400">{emp?.name}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 text-xs shrink-0">
                                    <div className="text-right">
                                      <span className="text-slate-400">{task.hoursAssigned}h</span>
                                      <span className="mx-1 text-slate-300">→</span>
                                      <span className="text-blue-600">{real}h</span>
                                      <span className="mx-1 text-slate-300">→</span>
                                      <span className="text-emerald-600 font-bold">{computed}h</span>
                                    </div>
                                    {Math.abs(taskGain) > 0.01 && (
                                      <Badge variant="outline" className={cn(
                                        "text-[9px] h-5 px-1 border-0",
                                        taskGain > 0 ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50"
                                      )}>
                                        {taskGain > 0 ? '+' : ''}{round2(taskGain)}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      )}

                      {/* OKRs si existen */}
                      {(data.project.okrs || []).length > 0 && (
                        <div className="border-t p-4 bg-white">
                          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Target className="h-3.5 w-3.5 text-indigo-500" />
                            Objetivos (OKRs)
                          </h4>
                          <div className="space-y-2">
                            {(data.project.okrs || []).map((okr, idx) => (
                              <div key={idx} className="space-y-1">
                                <div className="flex justify-between text-xs">
                                  <span className="text-slate-600">{okr.title}</span>
                                  <span className="font-bold text-indigo-600">{okr.progress}%</span>
                                </div>
                                <Progress value={okr.progress} className="h-1.5" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })
        )}
      </div>

      {/* DIALOG EDITAR/CREAR */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isCreating ? 'Nuevo proyecto' : 'Editar proyecto'}</DialogTitle>
            <DialogDescription>Configura los parámetros operativos y estratégicos.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre del Proyecto</Label>
                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Cliente asociado</Label>
                <Select value={formData.clientId} onValueChange={(val) => setFormData({...formData, clientId: val})}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Horas asignadas</Label>
                <Input type="number" value={formData.budgetHours} onChange={e => setFormData({...formData, budgetHours: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Horas mínimas</Label>
                <Input type="number" value={formData.minimumHours} onChange={e => setFormData({...formData, minimumHours: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Fee mensual (€)</Label>
                <Input type="number" value={formData.monthlyFee} onChange={e => setFormData({...formData, monthlyFee: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={formData.status} onValueChange={(val: any) => setFormData({...formData, status: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="archived">Archivado</SelectItem>
                    <SelectItem value="completed">Completado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="border-t pt-4 space-y-4">
              <Label className="text-base font-semibold">Estrategia y OKRs</Label>
              <div className="flex gap-2">
                <Input 
                  placeholder="Nuevo objetivo (ej: +20% Tráfico Orgánico)" 
                  value={newOkrTitle} 
                  onChange={e => setNewOkrTitle(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && addOkrToForm()} 
                />
                <Button type="button" onClick={addOkrToForm} size="sm"><Plus className="h-4 w-4" /></Button>
              </div>
              <div className="space-y-3 bg-slate-50 p-3 rounded-lg max-h-40 overflow-y-auto">
                {formData.okrs.length === 0 && <p className="text-xs text-slate-400 text-center">Sin objetivos.</p>}
                {formData.okrs.map((okr) => (
                  <div key={okr.id} className="bg-white p-2 rounded border shadow-sm space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-medium">{okr.title}</span>
                      <button onClick={() => removeOkr(okr.id)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <Slider value={[okr.progress]} max={100} step={5} onValueChange={(val) => updateOkrProgress(okr.id, val[0])} className="flex-1" />
                      <span className="text-xs font-bold w-8 text-right">{okr.progress}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            {!isCreating && (
              <Button variant="destructive" onClick={handleDelete} className="mr-auto">
                <Trash2 className="h-4 w-4 mr-2" /> Eliminar
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Guardar cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
