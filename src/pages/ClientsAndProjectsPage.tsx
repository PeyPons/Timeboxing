import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Client, Project, OKR } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Building2, Plus, Search, ChevronLeft, ChevronRight, ChevronDown,
  AlertTriangle, TrendingUp, TrendingDown, Pencil, Trash2, Users, 
  FolderOpen, Clock, CalendarDays, ArrowUpRight, ArrowDownRight,
  Minus, Eye, X, ChevronsUpDown, User, Target, Filter, LayoutGrid,
  AlertOctagon, CircleDashed, Ban, CheckCircle2, XCircle, Zap
} from 'lucide-react';
import { cn, isKitDigitalProject, formatProjectName } from '@/lib/utils';
import { toast } from 'sonner';
import { format, subMonths, addMonths, isSameMonth, parseISO, getDaysInMonth, getDate } from 'date-fns';
import { es } from 'date-fns/locale';

const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

const colorOptions = [
  '#0d9488', '#dc2626', '#7c3aed', '#ea580c', '#0284c7', '#16a34a',
  '#db2777', '#9333ea', '#f59e0b', '#06b6d4', '#84cc16', '#6366f1'
];

type FilterType = 'all' | 'needs-planning' | 'behind-schedule' | 'over-budget' | 'no-activity';
type StatusFilter = 'all' | 'active' | 'completed' | 'archived';

// Componente para estadísticas del header
function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  subValue, 
  trend,
  color = 'slate'
}: { 
  icon: any; 
  label: string; 
  value: string | number; 
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'slate' | 'emerald' | 'amber' | 'red';
}) {
  const colorClasses = {
    slate: 'bg-slate-50 border-slate-200 text-slate-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    red: 'bg-red-50 border-red-200 text-red-700',
  };

  return (
    <div className={cn("rounded-xl border p-4 transition-all hover:shadow-md", colorClasses[color])}>
      <div className="flex items-center justify-between">
        <div className={cn(
          "p-2 rounded-lg",
          color === 'slate' && "bg-slate-200/50",
          color === 'emerald' && "bg-emerald-200/50",
          color === 'amber' && "bg-amber-200/50",
          color === 'red' && "bg-red-200/50",
        )}>
          <Icon className="h-4 w-4" />
        </div>
        {trend && (
          <div className={cn(
            "flex items-center gap-0.5 text-xs font-medium",
            trend === 'up' && "text-emerald-600",
            trend === 'down' && "text-red-600",
            trend === 'neutral' && "text-slate-400"
          )}>
            {trend === 'up' && <ArrowUpRight className="h-3 w-3" />}
            {trend === 'down' && <ArrowDownRight className="h-3 w-3" />}
            {trend === 'neutral' && <Minus className="h-3 w-3" />}
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        {subValue && <p className="text-[10px] text-muted-foreground/70 mt-1">{subValue}</p>}
      </div>
    </div>
  );
}

export default function ClientsAndProjectsPage() {
  const { 
    clients, projects, allocations, employees, 
    addClient, updateClient, deleteClient, 
    addProject, updateProject, deleteProject,
    getClientTotalHoursForMonth, getProjectHoursForMonth 
  } = useApp();
  
  // Estados
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [newClient, setNewClient] = useState({ name: '', color: colorOptions[0] });
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('all');
  const [openEmployeeCombo, setOpenEmployeeCombo] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  
  const [formData, setFormData] = useState({
    name: '', clientId: '', budgetHours: '', minimumHours: '', monthlyFee: '',
    status: 'active' as 'active' | 'archived' | 'completed',
    okrs: [] as OKR[]
  });
  const [newOkrTitle, setNewOkrTitle] = useState('');

  // Mes anterior para comparación
  const prevMonth = subMonths(currentMonth, 1);

  // Calcular el progreso del mes
  const monthProgress = useMemo(() => {
    const today = new Date();
    if (!isSameMonth(today, currentMonth)) {
      return today > currentMonth ? 100 : 0;
    }
    const daysInMonth = getDaysInMonth(currentMonth);
    const currentDay = getDate(today);
    return Math.round((currentDay / daysInMonth) * 100);
  }, [currentMonth]);

  // Análisis de proyectos con métricas detalladas (similar a ProjectsPage)
  const projectsAnalysis = useMemo(() => {
    return projects.map(project => {
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
      const needsPlanning = budget > 0 && totalAssigned < budget * 0.5;
      const behindSchedule = monthProgress > 30 && executionPct < (monthProgress - 20);
      const overBudget = budget > 0 && totalAssigned > budget;
      const noActivity = budget > 0 && totalAssigned === 0;
      const hasIssue = needsPlanning || behindSchedule || overBudget || noActivity;

      // Empleados involucrados
      const involvedEmployees = [...new Set(monthTasks.map(t => t.employeeId))];

      return {
        project,
        client,
        monthTasks,
        totalAssigned,
        completedTasks,
        pendingTasks,
        hoursReal,
        hoursComputed,
        gain,
        budget,
        minimum,
        planningPct,
        executionPct,
        needsPlanning,
        behindSchedule,
        overBudget,
        noActivity,
        hasIssue,
        involvedEmployees
      };
    });
  }, [projects, clients, allocations, currentMonth, monthProgress]);

  // Agrupar proyectos por cliente
  const clientsWithProjects = useMemo(() => {
    // Identificar proyectos Kit Digital
    const kitDigitalProjects = projects.filter(p => isKitDigitalProject(p.name));
    const kitDigitalProjectIds = new Set(kitDigitalProjects.map(p => p.id));

    // Clientes regulares
    const regularClients = clients.map(client => {
      const { used, budget, percentage } = getClientTotalHoursForMonth(client.id, currentMonth);
      const prevStats = getClientTotalHoursForMonth(client.id, prevMonth);

      // Proyectos del cliente (excluyendo Kit Digital) - INCLUIR TODOS LOS ESTADOS
      const clientProjects = projects
        .filter(p => p.clientId === client.id && !kitDigitalProjectIds.has(p.id))
        .map(p => {
          const analysis = projectsAnalysis.find(a => a.project.id === p.id);
          return {
            project: p,
            analysis,
            hours: getProjectHoursForMonth(p.id, currentMonth)
          };
        });

      // Empleados asignados este mes
      const monthAllocations = allocations.filter(a =>
        isSameMonth(parseISO(a.weekStartDate), currentMonth) &&
        clientProjects.some(p => p.project.id === a.projectId)
      );
      const assignedEmployeeIds = [...new Set(monthAllocations.map(a => a.employeeId))];
      const assignedEmployees = assignedEmployeeIds
        .map(id => employees.find(e => e.id === id)?.name || '')
        .filter(Boolean);

      return {
        client,
        stats: { used, budget, percentage, projects: clientProjects },
        prevStats: { used: prevStats.used, budget: prevStats.budget },
        employees: assignedEmployees
      };
    });

    // Agregar cliente virtual "Kit Digital" si hay proyectos
    if (kitDigitalProjects.length > 0) {
      const kitDigitalProjectsWithAnalysis = kitDigitalProjects.map(p => {
        const analysis = projectsAnalysis.find(a => a.project.id === p.id);
        return {
          project: p,
          analysis,
          hours: getProjectHoursForMonth(p.id, currentMonth)
        };
      });

      const totalUsed = kitDigitalProjectsWithAnalysis.reduce((sum, p) => sum + p.hours.used, 0);
      const totalBudget = kitDigitalProjectsWithAnalysis.reduce((sum, p) => sum + p.hours.budget, 0);
      const percentage = totalBudget > 0 ? (totalUsed / totalBudget) * 100 : 0;

      const monthAllocations = allocations.filter(a =>
        isSameMonth(parseISO(a.weekStartDate), currentMonth) &&
        kitDigitalProjectIds.has(a.projectId)
      );
      const assignedEmployeeIds = [...new Set(monthAllocations.map(a => a.employeeId))];
      const assignedEmployees = assignedEmployeeIds
        .map(id => employees.find(e => e.id === id)?.name || '')
        .filter(Boolean);

      regularClients.push({
        client: { id: 'kit-digital', name: 'Kit Digital', color: '#10b981' } as Client,
        stats: { 
          used: totalUsed, 
          budget: totalBudget, 
          percentage, 
          projects: kitDigitalProjectsWithAnalysis 
        },
        prevStats: { used: 0, budget: 0 },
        employees: assignedEmployees
      });
    }

    return regularClients;
  }, [clients, projects, projectsAnalysis, allocations, employees, currentMonth, prevMonth, getClientTotalHoursForMonth, getProjectHoursForMonth]);

  // Filtrar clientes y proyectos
  const filteredClients = useMemo(() => {
    return clientsWithProjects
      .filter(({ client, stats }) => {
        // Filtro de búsqueda (cliente o proyecto)
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const clientMatch = client.name.toLowerCase().includes(query);
          const projectMatch = stats.projects.some(p => 
            p.project.name.toLowerCase().includes(query)
          );
          if (!clientMatch && !projectMatch) return false;
        }

        // Filtro de estado
        if (statusFilter !== 'all') {
          const hasMatchingStatus = stats.projects.some(p => {
            if (statusFilter === 'active') return p.project.status === 'active';
            if (statusFilter === 'completed') return p.project.status === 'completed';
            if (statusFilter === 'archived') return p.project.status === 'archived';
            return false;
          });
          if (!hasMatchingStatus) return false;
        }

        // Filtro de empleado
        if (selectedEmployeeId !== 'all') {
          const hasEmployee = stats.projects.some(p => 
            p.analysis?.involvedEmployees.includes(selectedEmployeeId)
          );
          if (!hasEmployee) return false;
        }

        return true;
      })
      .map(({ client, stats, prevStats, employees }) => {
        // Filtrar proyectos dentro de cada cliente
        const filteredProjects = stats.projects.filter(({ project, analysis }) => {
          if (!analysis) return false;

          // Filtro de estado
          if (statusFilter !== 'all') {
            if (statusFilter === 'active' && project.status !== 'active') return false;
            if (statusFilter === 'completed' && project.status !== 'completed') return false;
            if (statusFilter === 'archived' && project.status !== 'archived') return false;
          }

          // Filtro de análisis
          switch (activeFilter) {
            case 'needs-planning':
              return analysis.needsPlanning && !analysis.noActivity;
            case 'behind-schedule':
              return analysis.behindSchedule;
            case 'over-budget':
              return analysis.overBudget;
            case 'no-activity':
              return analysis.noActivity;
            default:
              return true;
          }
        });

        return {
          client,
          stats: { ...stats, projects: filteredProjects },
          prevStats,
          employees
        };
      })
      .filter(({ stats }) => stats.projects.length > 0 || statusFilter === 'all') // Mostrar clientes sin proyectos solo si no hay filtro de estado
      .sort((a, b) => a.client.name.localeCompare(b.client.name));
  }, [clientsWithProjects, searchQuery, statusFilter, selectedEmployeeId, activeFilter]);

  // Estadísticas globales
  const globalStats = useMemo(() => {
    const totalClients = filteredClients.length;
    const totalHours = filteredClients.reduce((sum, c) => sum + c.stats.used, 0);
    const totalBudget = filteredClients.reduce((sum, c) => sum + c.stats.budget, 0);
    const prevTotalHours = filteredClients.reduce((sum, c) => sum + c.prevStats.used, 0);
    const atRisk = filteredClients.filter(c => c.stats.percentage > 85 && c.stats.percentage <= 100).length;
    const overBudget = filteredClients.filter(c => c.stats.percentage > 100).length;

    return {
      totalClients,
      totalHours,
      totalBudget,
      prevTotalHours,
      atRisk,
      overBudget,
      trend: totalHours > prevTotalHours ? 'up' : totalHours < prevTotalHours ? 'down' : 'neutral'
    };
  }, [filteredClients]);

  // Handlers
  const handleAddClient = () => {
    if (!newClient.name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    addClient(newClient);
    setNewClient({ name: '', color: colorOptions[0] });
    setIsAddingClient(false);
    toast.success(`${newClient.name} creado`);
  };

  const handleUpdateClient = () => {
    if (!editingClient || !editingClient.name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    updateClient(editingClient);
    setEditingClient(null);
    toast.success(`${editingClient.name} actualizado`);
  };

  const handleDeleteClient = () => {
    if (!deletingClient) return;
    deleteClient(deletingClient.id);
    setDeletingClient(null);
    toast.success(`${deletingClient.name} eliminado`);
  };

  const openNewProject = () => {
    setIsAddingProject(true);
    setEditingProject(null);
    setFormData({ name: '', clientId: '', budgetHours: '0', minimumHours: '0', monthlyFee: '0', status: 'active', okrs: [] });
  };

  const openEditProject = (project: Project) => {
    setIsAddingProject(false);
    setEditingProject(project);
    setFormData({
      name: project.name,
      clientId: project.clientId,
      budgetHours: project.budgetHours?.toString() || '0',
      minimumHours: project.minimumHours?.toString() || '0',
      monthlyFee: project.monthlyFee?.toString() || '0',
      status: project.status,
      okrs: project.okrs || []
    });
  };

  const handleSaveProject = async () => {
    try {
      if (isAddingProject) {
        await addProject({
          name: formData.name,
          clientId: formData.clientId,
          budgetHours: parseFloat(formData.budgetHours) || 0,
          minimumHours: parseFloat(formData.minimumHours) || 0,
          monthlyFee: parseFloat(formData.monthlyFee) || 0,
          status: formData.status,
          okrs: formData.okrs
        });
        toast.success('Proyecto creado');
      } else if (editingProject) {
        await updateProject({
          ...editingProject,
          name: formData.name,
          clientId: formData.clientId,
          budgetHours: parseFloat(formData.budgetHours) || 0,
          minimumHours: parseFloat(formData.minimumHours) || 0,
          monthlyFee: parseFloat(formData.monthlyFee) || 0,
          status: formData.status,
          okrs: formData.okrs
        });
        toast.success('Proyecto actualizado');
      }
      setEditingProject(null);
    } catch (error) {
      console.error(error);
      toast.error("Error al guardar");
    }
  };

  const handleDeleteProject = async () => {
    if (!editingProject) return;
    if (confirm("¿Estás seguro de eliminar este proyecto? Se borrarán sus asignaciones.")) {
      try {
        await deleteProject(editingProject.id);
        setEditingProject(null);
        toast.success('Proyecto eliminado');
      } catch (e) {
        console.error(e);
        toast.error("No se pudo eliminar");
      }
    }
  };

  const toggleClient = (clientId: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  const toggleProject = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const expandAll = () => {
    const allClientIds = new Set(filteredClients.map(c => c.client.id));
    setExpandedClients(allClientIds);
    const allProjectIds = new Set(
      filteredClients.flatMap(c => c.stats.projects.map(p => p.project.id))
    );
    setExpandedProjects(allProjectIds);
  };

  const collapseAll = () => {
    setExpandedClients(new Set());
    setExpandedProjects(new Set());
  };

  const addOkrToForm = () => {
    if (!newOkrTitle.trim()) return;
    setFormData({ ...formData, okrs: [...formData.okrs, { id: crypto.randomUUID(), title: newOkrTitle, progress: 0 }] });
    setNewOkrTitle('');
  };

  const updateOkrProgress = (id: string, val: number) => {
    setFormData({ ...formData, okrs: formData.okrs.map(o => o.id === id ? { ...o, progress: val } : o) });
  };

  const removeOkr = (id: string) => {
    setFormData({ ...formData, okrs: formData.okrs.filter(o => o.id !== id) });
  };

  const getSelectedEmployeeName = () => 
    selectedEmployeeId === 'all' 
      ? "Todos los empleados" 
      : employees.find(e => e.id === selectedEmployeeId)?.name || "Seleccionar...";

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-200">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Clientes y Proyectos</h1>
            <p className="text-sm text-muted-foreground">
              Gestiona tus clientes y proyectos con análisis detallado
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Selector de mes */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium px-2 min-w-[120px] text-center capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: es })}
            </span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 text-xs"
              onClick={() => setCurrentMonth(new Date())}
            >
              Hoy
            </Button>
          </div>

          {/* Botón añadir proyecto */}
          <Dialog open={isAddingProject || editingProject !== null} onOpenChange={(open) => {
            if (!open) {
              setIsAddingProject(false);
              setEditingProject(null);
            }
          }}>
            <DialogTrigger asChild>
              <Button 
                className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-md"
                onClick={openNewProject}
              >
                <Plus className="h-4 w-4" />
                Nuevo proyecto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{isAddingProject ? 'Nuevo proyecto' : 'Editar proyecto'}</DialogTitle>
                <DialogDescription>
                  {isAddingProject 
                    ? 'Crea un nuevo proyecto y asócialo a un cliente'
                    : 'Modifica los datos del proyecto'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nombre del proyecto</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Rediseño web"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <Select value={formData.clientId} onValueChange={(value) => setFormData({ ...formData, clientId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(client => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Horas asignadas</Label>
                    <Input
                      type="number"
                      value={formData.budgetHours}
                      onChange={(e) => setFormData({ ...formData, budgetHours: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Horas mínimas</Label>
                    <Input
                      type="number"
                      value={formData.minimumHours}
                      onChange={(e) => setFormData({ ...formData, minimumHours: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tarifa mensual (€)</Label>
                    <Input
                      type="number"
                      value={formData.monthlyFee}
                      onChange={(e) => setFormData({ ...formData, monthlyFee: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select 
                    value={formData.status} 
                    onValueChange={(value: 'active' | 'archived' | 'completed') => 
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Activo</SelectItem>
                      <SelectItem value="completed">Completado</SelectItem>
                      <SelectItem value="archived">Archivado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* OKRs */}
                <div className="space-y-2">
                  <Label>Objetivos (OKRs)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newOkrTitle}
                      onChange={(e) => setNewOkrTitle(e.target.value)}
                      placeholder="Añadir objetivo..."
                      onKeyDown={(e) => e.key === 'Enter' && addOkrToForm()}
                    />
                    <Button type="button" onClick={addOkrToForm} variant="outline">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {formData.okrs.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {formData.okrs.map(okr => (
                        <div key={okr.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                          <span className="flex-1 text-sm">{okr.title}</span>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={okr.progress}
                            onChange={(e) => updateOkrProgress(okr.id, parseInt(e.target.value) || 0)}
                            className="w-20"
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => removeOkr(okr.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                {editingProject && (
                  <Button
                    variant="destructive"
                    onClick={handleDeleteProject}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar
                  </Button>
                )}
                <Button variant="outline" onClick={() => {
                  setIsAddingProject(false);
                  setEditingProject(null);
                }}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveProject} className="bg-gradient-to-r from-indigo-500 to-purple-600">
                  {isAddingProject ? 'Crear' : 'Guardar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Botón añadir cliente */}
          <Dialog open={isAddingClient} onOpenChange={setIsAddingClient}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-md">
                <Plus className="h-4 w-4" />
                Nuevo cliente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo cliente</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input
                    value={newClient.name}
                    onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                    placeholder="Nombre del cliente"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddClient()}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <div className="flex flex-wrap gap-2">
                    {colorOptions.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewClient({ ...newClient, color })}
                        className={cn(
                          "h-9 w-9 rounded-lg transition-all hover:scale-110",
                          newClient.color === color && "ring-2 ring-offset-2 ring-indigo-500"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddingClient(false)}>Cancelar</Button>
                <Button onClick={handleAddClient} className="bg-gradient-to-r from-indigo-500 to-purple-600">
                  Crear cliente
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Estadísticas globales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard 
          icon={Building2}
          label="Total clientes"
          value={globalStats.totalClients}
          color="slate"
        />
        <StatCard 
          icon={Clock}
          label="Horas este mes"
          value={`${globalStats.totalHours.toFixed(0)}h`}
          subValue={`de ${globalStats.totalBudget.toFixed(0)}h presupuestadas`}
          trend={globalStats.trend as any}
          color="emerald"
        />
        <StatCard 
          icon={AlertTriangle}
          label="En riesgo"
          value={globalStats.atRisk}
          subValue=">85% del presupuesto"
          color={globalStats.atRisk > 0 ? 'amber' : 'slate'}
        />
        <StatCard 
          icon={TrendingUp}
          label="Excedidos"
          value={globalStats.overBudget}
          subValue=">100% del presupuesto"
          color={globalStats.overBudget > 0 ? 'red' : 'slate'}
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Buscador */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente o proyecto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setSearchQuery('')}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Filtro de estado */}
        <Select value={statusFilter} onValueChange={(value: StatusFilter) => setStatusFilter(value)}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="active">Solo activos</SelectItem>
            <SelectItem value="completed">Solo completados</SelectItem>
            <SelectItem value="archived">Solo archivados</SelectItem>
          </SelectContent>
        </Select>

        {/* Filtros de análisis */}
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
                    activeFilter === 'no-activity' ? "bg-slate-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <Ban className="h-3.5 w-3.5" />
                  Sin actividad
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Proyectos sin tareas planificadas este mes</p>
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
                    activeFilter === 'needs-planning' ? "bg-amber-600 hover:bg-amber-700" : "bg-white border-amber-200 text-amber-700 hover:bg-amber-50"
                  )}
                >
                  <CircleDashed className="h-3.5 w-3.5" />
                  Falta planificar
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Proyectos con menos del 50% planificado</p>
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
                    activeFilter === 'behind-schedule' ? "bg-orange-600 hover:bg-orange-700" : "bg-white border-orange-200 text-orange-700 hover:bg-orange-50"
                  )}
                >
                  <Clock className="h-3.5 w-3.5" />
                  Retrasados
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Ejecución por debajo del progreso del mes</p>
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
                    activeFilter === 'over-budget' ? "bg-red-600 hover:bg-red-700" : "bg-white border-red-200 text-red-700 hover:bg-red-50"
                  )}
                >
                  <AlertOctagon className="h-3.5 w-3.5" />
                  Exceso horas
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Proyectos con más horas planificadas que asignadas</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Filtro de empleado */}
        <Popover open={openEmployeeCombo} onOpenChange={setOpenEmployeeCombo}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" className="w-full md:w-[220px] justify-between bg-white shrink-0">
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

      {/* Acciones de lista */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {filteredClients.length} cliente{filteredClients.length !== 1 ? 's' : ''}
          {' • '}
          {filteredClients.reduce((sum, c) => sum + c.stats.projects.length, 0)} proyecto{filteredClients.reduce((sum, c) => sum + c.stats.projects.length, 0) !== 1 ? 's' : ''}
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

      {/* Lista de clientes con proyectos */}
      <div className="space-y-3">
        {filteredClients.length === 0 ? (
          <Card className="p-12">
            <div className="text-center">
              <Building2 className="h-12 w-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No hay clientes con estos filtros</p>
              <p className="text-sm text-slate-400 mt-1">Prueba con otros criterios de búsqueda</p>
            </div>
          </Card>
        ) : (
          filteredClients.map(({ client, stats, prevStats, employees: assignedEmployees }) => {
            const isExpanded = expandedClients.has(client.id);
            const isOverBudget = stats.percentage > 100;
            const isNearLimit = stats.percentage > 85 && stats.percentage <= 100;
            const trend = stats.used - prevStats.used;
            
            return (
              <div key={client.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                {/* Cabecera del cliente */}
                <button
                  onClick={() => toggleClient(client.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left group"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  )}
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: client.color }}
                  />
                  <span className="font-bold text-slate-800 flex-1 text-left">{client.name}</span>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    {/* Resumen de horas */}
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "font-bold text-sm",
                          isOverBudget && "text-red-600",
                          isNearLimit && "text-amber-600",
                          !isOverBudget && !isNearLimit && "text-slate-700"
                        )}>
                          {stats.used.toFixed(1)}h / {stats.budget.toFixed(0)}h
                        </span>
                        {trend !== 0 && (
                          <span className={cn(
                            "flex items-center gap-0.5 text-xs font-medium",
                            trend > 0 ? "text-emerald-600" : "text-red-600"
                          )}>
                            {trend > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {Math.abs(trend).toFixed(1)}h
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Progress 
                          value={Math.min(stats.percentage, 100)} 
                          className={cn(
                            "h-2 w-24",
                            isOverBudget && "[&>div]:bg-red-500",
                            isNearLimit && "[&>div]:bg-amber-500",
                            !isOverBudget && !isNearLimit && "[&>div]:bg-emerald-500"
                          )}
                        />
                        <span className={cn(
                          "text-xs font-medium w-10 text-right",
                          isOverBudget && "text-red-600",
                          isNearLimit && "text-amber-600"
                        )}>
                          {stats.percentage.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    
                    {/* Badges de estado */}
                    <div className="flex items-center gap-1.5">
                      {isOverBudget && (
                        <Badge variant="destructive" className="text-[10px] h-5 gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Excedido
                        </Badge>
                      )}
                      {isNearLimit && !isOverBudget && (
                        <Badge className="text-[10px] h-5 gap-1 bg-amber-100 text-amber-700 border-amber-200">
                          <TrendingUp className="h-3 w-3" />
                          Casi lleno
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        {stats.projects.length} proyecto{stats.projects.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    
                    {/* Botones de acción */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditingClient({ ...client }); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Editar</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-600" onClick={(e) => { e.stopPropagation(); setDeletingClient(client); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Eliminar</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </button>
                
                {/* Proyectos del cliente */}
                {isExpanded && (
                  <div className="border-t divide-y divide-slate-100">
                    {stats.projects.length > 0 ? (
                      stats.projects.map(({ project, analysis }) => {
                        if (!analysis) return null;
                        
                        const isProjectExpanded = expandedProjects.has(project.id);
                        const isProjectOverBudget = analysis.overBudget;
                        const isProjectNearLimit = analysis.planningPct > 85 && !analysis.overBudget;
                        
                        return (
                          <div key={project.id}>
                            {/* Header del proyecto */}
                            <Collapsible 
                              open={isProjectExpanded} 
                              onOpenChange={() => toggleProject(project.id)}
                            >
                              <CollapsibleTrigger asChild>
                                <div className={cn(
                                  "px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer",
                                  isProjectOverBudget && "bg-red-50/40",
                                  isProjectNearLimit && "bg-amber-50/40",
                                  project.status === 'completed' && "bg-slate-50/60",
                                  project.status === 'archived' && "bg-slate-100/60"
                                )}>
                                  <div className="flex items-center gap-3">
                                    <ChevronDown className={cn(
                                      "h-4 w-4 text-slate-400 transition-transform shrink-0",
                                      isProjectExpanded && "rotate-180"
                                    )} />
                                    <div 
                                      className="h-2 w-2 rounded-full flex-shrink-0" 
                                      style={{ backgroundColor: client.color }}
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-sm font-medium text-slate-800 truncate">
                                          {formatProjectName(project.name)}
                                        </p>
                                        
                                        {/* Badges de estado del proyecto */}
                                        <TooltipProvider>
                                          {project.status === 'completed' && (
                                            <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                                              <CheckCircle2 className="h-3 w-3 mr-1" />
                                              Completado
                                            </Badge>
                                          )}
                                          {project.status === 'archived' && (
                                            <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-600 border-slate-300">
                                              <XCircle className="h-3 w-3 mr-1" />
                                              Archivado
                                            </Badge>
                                          )}
                                          {analysis.noActivity && (
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
                                          {analysis.needsPlanning && !analysis.noActivity && (
                                            <Tooltip>
                                              <TooltipTrigger>
                                                <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 cursor-help">
                                                  {round2(analysis.planningPct)}% planificado
                                                </Badge>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p className="text-xs">Solo {round2(analysis.totalAssigned)}h de {analysis.budget}h están planificadas</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          )}
                                          {analysis.behindSchedule && (
                                            <Tooltip>
                                              <TooltipTrigger>
                                                <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200 cursor-help">
                                                  {round2(analysis.executionPct)}% ejecutado
                                                </Badge>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p className="text-xs">Va el {monthProgress}% del mes pero solo {round2(analysis.executionPct)}% ejecutado</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          )}
                                          {analysis.overBudget && (
                                            <Tooltip>
                                              <TooltipTrigger>
                                                <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200 cursor-help">
                                                  +{round2(analysis.totalAssigned - analysis.budget)}h exceso
                                                </Badge>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p className="text-xs">Se han planificado {round2(analysis.totalAssigned)}h de {analysis.budget}h asignadas</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          )}
                                        </TooltipProvider>
                                      </div>
                                      
                                      <div className="flex items-center gap-3 mt-1.5">
                                        {/* Mini barra de progreso */}
                                        {analysis.budget > 0 && (
                                          <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                                            <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                              <div 
                                                className="h-full bg-emerald-500 rounded-full"
                                                style={{ width: `${Math.min(100, (analysis.hoursComputed / analysis.budget) * 100)}%` }}
                                              />
                                            </div>
                                            <span className="text-[10px] text-slate-500 tabular-nums shrink-0">
                                              {round2((analysis.hoursComputed / analysis.budget) * 100)}%
                                            </span>
                                          </div>
                                        )}
                                        
                                        {/* Métricas rápidas */}
                                        <div className="hidden md:flex items-center gap-4 text-sm shrink-0">
                                          <div className="text-center min-w-[80px]">
                                            <p className={cn(
                                              "font-mono font-bold text-xs",
                                              analysis.overBudget ? "text-red-600" : 
                                              analysis.needsPlanning ? "text-amber-600" : "text-slate-700"
                                            )}>
                                              {round2(analysis.totalAssigned)}h
                                            </p>
                                            <p className="text-[10px] text-slate-400">
                                              {analysis.budget > 0 ? `de ${analysis.budget}h` : 'planificado'}
                                            </p>
                                          </div>
                                          <div className="text-center min-w-[70px]">
                                            <p className="font-mono font-bold text-xs text-emerald-600">
                                              {round2(analysis.hoursComputed)}h
                                            </p>
                                            <p className="text-[10px] text-slate-400">ejecutado</p>
                                          </div>
                                          {Math.abs(analysis.gain) > 0.01 && (
                                            <div className={cn(
                                              "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium",
                                              analysis.gain > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                                            )}>
                                              {analysis.gain > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                                              {analysis.gain > 0 ? '+' : ''}{round2(analysis.gain)}h
                                            </div>
                                          )}
                                          <div className="text-center min-w-[50px]">
                                            <p className="font-mono text-xs text-slate-600">
                                              <span className="text-emerald-600">{analysis.completedTasks.length}</span>
                                              <span className="text-slate-300">/</span>
                                              <span>{analysis.monthTasks.length}</span>
                                            </p>
                                            <p className="text-[10px] text-slate-400">tareas</p>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Botón editar */}
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-8 w-8 text-slate-400 hover:text-slate-600 shrink-0"
                                      onClick={(e) => { e.stopPropagation(); openEditProject(project); }}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </CollapsibleTrigger>

                              {/* Contenido expandido del proyecto */}
                              <CollapsibleContent>
                                <div className="border-t bg-slate-50/50">
                                  {/* Barra de progreso detallada */}
                                  {analysis.budget > 0 && (
                                    <div className="px-4 py-3 border-b bg-white">
                                      <div className="flex justify-between text-xs mb-2">
                                        <span className="text-slate-600">
                                          <span className="font-semibold text-slate-800">{round2(analysis.totalAssigned)}h</span> planificadas
                                          {analysis.totalAssigned < analysis.budget && (
                                            <span className="text-amber-600 ml-2">(Faltan {round2(analysis.budget - analysis.totalAssigned)}h)</span>
                                          )}
                                          {analysis.overBudget && (
                                            <span className="text-red-600 ml-2">(+{round2(analysis.totalAssigned - analysis.budget)}h de exceso)</span>
                                          )}
                                        </span>
                                        <span className="text-slate-500">
                                          Asignadas: <span className="font-semibold text-slate-700">{analysis.budget}h</span>
                                        </span>
                                      </div>
                                      
                                      {/* Barras dobles: planificado vs ejecutado */}
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] text-slate-400 w-16">Planificado</span>
                                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div 
                                              className={cn(
                                                "h-full rounded-full transition-all",
                                                analysis.overBudget ? "bg-red-500" : 
                                                analysis.planningPct < 50 ? "bg-amber-500" : "bg-blue-500"
                                              )}
                                              style={{ width: `${Math.min(100, analysis.planningPct)}%` }}
                                            />
                                          </div>
                                          <span className="text-[10px] font-medium text-slate-600 w-12 text-right">
                                            {round2(analysis.planningPct)}%
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] text-slate-400 w-16">Ejecutado</span>
                                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div 
                                              className="h-full bg-emerald-500 rounded-full transition-all"
                                              style={{ width: `${Math.min(100, (analysis.hoursComputed / analysis.budget) * 100)}%` }}
                                            />
                                          </div>
                                          <span className="text-[10px] font-medium text-emerald-600 w-12 text-right">
                                            {round2((analysis.hoursComputed / analysis.budget) * 100)}%
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Tareas pendientes */}
                                  <div className="p-4">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                                      Tareas pendientes ({analysis.pendingTasks.length})
                                    </h4>
                                    
                                    {analysis.pendingTasks.length > 0 ? (
                                      <div className="space-y-2">
                                        {analysis.pendingTasks.map(task => {
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
                                  {analysis.completedTasks.length > 0 && (
                                    <Collapsible>
                                      <CollapsibleTrigger asChild>
                                        <div className="px-4 py-2 border-t bg-white cursor-pointer hover:bg-slate-50">
                                          <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                              Tareas completadas ({analysis.completedTasks.length})
                                            </h4>
                                            <ChevronDown className="h-4 w-4 text-slate-400" />
                                          </div>
                                        </div>
                                      </CollapsibleTrigger>
                                      <CollapsibleContent>
                                        <div className="p-4 space-y-2">
                                          {analysis.completedTasks.map(task => {
                                            const emp = employees.find(e => e.id === task.employeeId);
                                            return (
                                              <div key={task.id} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                                                <div className="flex items-center gap-3 min-w-0">
                                                  <Avatar className="h-7 w-7 border shrink-0">
                                                    <AvatarImage src={emp?.avatarUrl} />
                                                    <AvatarFallback className="bg-emerald-100 text-emerald-700 text-[9px] font-bold">
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
                                                  <p className="font-mono font-bold text-sm text-emerald-600">
                                                    {task.hoursComputed || task.hoursActual || task.hoursAssigned}h
                                                  </p>
                                                  <p className="text-[10px] text-slate-400">computado</p>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </CollapsibleContent>
                                    </Collapsible>
                                  )}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          </div>
                        );
                      })
                    ) : (
                      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                        {statusFilter === 'all' 
                          ? 'Sin proyectos (incluye todos los estados)' 
                          : `Sin proyectos ${statusFilter === 'active' ? 'activos' : statusFilter === 'completed' ? 'completados' : 'archivados'}`}
                      </div>
                    )}
                    
                    {/* Resumen de equipo asignado */}
                    {assignedEmployees.length > 0 && (
                      <div className="px-4 py-3 bg-slate-50 border-t">
                        <div className="flex items-center gap-2">
                          <Users className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-xs font-medium text-slate-600">Equipo asignado:</span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {assignedEmployees.map((name, i) => (
                              <span 
                                key={i}
                                className="text-[10px] bg-white text-slate-600 px-2 py-0.5 rounded-full border border-slate-200"
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Diálogos de edición/eliminación de cliente */}
      {editingClient && (
        <Dialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar cliente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={editingClient.name}
                  onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setEditingClient({ ...editingClient, color })}
                      className={cn(
                        "h-9 w-9 rounded-lg transition-all hover:scale-110",
                        editingClient.color === color && "ring-2 ring-offset-2 ring-indigo-500"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingClient(null)}>Cancelar</Button>
              <Button onClick={handleUpdateClient} className="bg-gradient-to-r from-indigo-500 to-purple-600">
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {deletingClient && (
        <Dialog open={!!deletingClient} onOpenChange={(open) => !open && setDeletingClient(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Eliminar cliente</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              ¿Estás seguro de eliminar "{deletingClient.name}"? Esta acción no se puede deshacer.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeletingClient(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleDeleteClient}>
                Eliminar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
