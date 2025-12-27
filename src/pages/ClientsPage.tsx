import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Client } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Briefcase, Plus, Search, ChevronLeft, ChevronRight,
  AlertTriangle, TrendingUp, TrendingDown, Pencil, Trash2, Users, 
  FolderOpen, Clock, CalendarDays, Building2, ArrowUpRight, ArrowDownRight,
  Minus, Eye, X, ChevronDown
} from 'lucide-react';
import { cn, isKitDigitalProject } from '@/lib/utils';
import { toast } from 'sonner';
import { format, subMonths, addMonths, isSameMonth, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const colorOptions = [
  '#0d9488', '#dc2626', '#7c3aed', '#ea580c', '#0284c7', '#16a34a',
  '#db2777', '#9333ea', '#f59e0b', '#06b6d4', '#84cc16', '#6366f1'
];

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


// Componente principal
export default function ClientsPage() {
  const { clients, projects, allocations, employees, addClient, updateClient, deleteClient, getClientTotalHoursForMonth, getProjectHoursForMonth } = useApp();
  
  // Estados
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isAdding, setIsAdding] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [detailClient, setDetailClient] = useState<Client | null>(null);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [newClient, setNewClient] = useState({ name: '', color: colorOptions[0] });

  // Mes anterior para comparación
  const prevMonth = subMonths(currentMonth, 1);

  // Calcular estadísticas para cada cliente
  const clientsWithStats = useMemo(() => {
    // Primero identificamos proyectos Kit Digital usando la función helper
    // Detecta todas las variantes: (KD), KD , KD:, kit digital, etc.
    const kitDigitalProjects = projects.filter(p => 
      p.status === 'active' && isKitDigitalProject(p.name)
    );
    const kitDigitalProjectIds = new Set(kitDigitalProjects.map(p => p.id));

    const regularClients = clients.map(client => {
      const { used, budget, percentage } = getClientTotalHoursForMonth(client.id, currentMonth);
      const prevStats = getClientTotalHoursForMonth(client.id, prevMonth);

      // Proyectos del cliente (excluyendo Kit Digital)
      const clientProjects = projects
        .filter(p => p.clientId === client.id && p.status === 'active' && !kitDigitalProjectIds.has(p.id))
        .map(p => {
          const hours = getProjectHoursForMonth(p.id, currentMonth);
          return {
            id: p.id,
            name: p.name,
            used: hours.used,
            budget: hours.budget,
            percentage: hours.percentage
          };
        });

      // Empleados asignados este mes
      const monthAllocations = allocations.filter(a =>
        isSameMonth(parseISO(a.weekStartDate), currentMonth) &&
        clientProjects.some(p => p.id === a.projectId)
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
      const kitDigitalProjectsWithStats = kitDigitalProjects.map(p => {
        const hours = getProjectHoursForMonth(p.id, currentMonth);
        return {
          id: p.id,
          name: p.name,
          used: hours.used,
          budget: hours.budget,
          percentage: hours.percentage
        };
      });

      const totalUsed = kitDigitalProjectsWithStats.reduce((sum, p) => sum + p.used, 0);
      const totalBudget = kitDigitalProjectsWithStats.reduce((sum, p) => sum + p.budget, 0);
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
        stats: { used: totalUsed, budget: totalBudget, percentage, projects: kitDigitalProjectsWithStats },
        prevStats: { used: 0, budget: 0 },
        employees: assignedEmployees
      });
    }

    return regularClients;
  }, [clients, projects, allocations, employees, currentMonth, prevMonth, getClientTotalHoursForMonth, getProjectHoursForMonth]);

  // Filtrar
  const filteredClients = useMemo(() => {
    return clientsWithStats.filter(c => 
      c.client.name.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => a.client.name.localeCompare(b.client.name));
  }, [clientsWithStats, searchQuery]);

  // Estadísticas globales
  const globalStats = useMemo(() => {
    const totalClients = clients.length;
    const totalHours = clientsWithStats.reduce((sum, c) => sum + c.stats.used, 0);
    const totalBudget = clientsWithStats.reduce((sum, c) => sum + c.stats.budget, 0);
    const prevTotalHours = clientsWithStats.reduce((sum, c) => sum + c.prevStats.used, 0);
    const atRisk = clientsWithStats.filter(c => c.stats.percentage > 85).length;
    const overBudget = clientsWithStats.filter(c => c.stats.percentage > 100).length;

    return {
      totalClients,
      totalHours,
      totalBudget,
      prevTotalHours,
      atRisk,
      overBudget,
      trend: totalHours > prevTotalHours ? 'up' : totalHours < prevTotalHours ? 'down' : 'neutral'
    };
  }, [clients, clientsWithStats]);

  // Handlers
  const handleAddClient = () => {
    if (!newClient.name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    addClient(newClient);
    setNewClient({ name: '', color: colorOptions[0] });
    setIsAdding(false);
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

  const toggleClient = (clientId: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-200">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Clientes</h1>
            <p className="text-sm text-muted-foreground">
              Gestiona tus clientes y su consumo de horas
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
          </div>

          {/* Botón añadir */}
          <Dialog open={isAdding} onOpenChange={setIsAdding}>
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
                <Button variant="outline" onClick={() => setIsAdding(false)}>Cancelar</Button>
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
          subValue={`de ${globalStats.totalBudget}h presupuestadas`}
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

      {/* Buscador */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
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
        <p className="text-sm text-muted-foreground">
          {filteredClients.length} de {clients.length} clientes
        </p>
      </div>

      {/* Vista de lista similar a DeadlinesPage */}
      <div className="space-y-3">
        {filteredClients.map(({ client, stats, prevStats, employees: assignedEmployees }) => {
          const isExpanded = expandedClients.has(client.id);
          const isOverBudget = stats.percentage > 100;
          const isNearLimit = stats.percentage > 85 && stats.percentage <= 100;
          const trend = stats.used - prevStats.used;
          const unplannedProjects = stats.projects.filter(p => p.percentage === 0);
          
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
                        {stats.used.toFixed(1)}h / {stats.budget}h
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
                    {unplannedProjects.length > 0 && (
                      <Badge variant="outline" className="text-[10px] h-5 gap-1 bg-blue-50 text-blue-700 border-blue-200">
                        <Clock className="h-3 w-3" />
                        {unplannedProjects.length} sin planificar
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
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setDetailClient(client); }}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Ver detalles</TooltipContent>
                    </Tooltip>
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
                    stats.projects.map(project => {
                      const isProjectOverBudget = project.percentage > 100;
                      const isProjectNearLimit = project.percentage > 85 && project.percentage <= 100;
                      
                      return (
                        <div 
                          key={project.id}
                          className={cn(
                            "px-4 py-3 hover:bg-slate-50 transition-colors",
                            isProjectOverBudget && "bg-red-50/40",
                            isProjectNearLimit && "bg-amber-50/40"
                          )}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div 
                                className="h-2 w-2 rounded-full flex-shrink-0" 
                                style={{ backgroundColor: client.color }}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-slate-800 truncate">{project.name}</p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  {project.used.toFixed(1)}h de {project.budget}h
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <div className="flex items-center gap-2">
                                <Progress 
                                  value={Math.min(project.percentage, 100)} 
                                  className={cn(
                                    "h-2 w-20",
                                    isProjectOverBudget && "[&>div]:bg-red-500",
                                    isProjectNearLimit && "[&>div]:bg-amber-500",
                                    !isProjectOverBudget && !isProjectNearLimit && "[&>div]:bg-emerald-500"
                                  )}
                                />
                                <span className={cn(
                                  "text-xs font-medium w-10 text-right",
                                  isProjectOverBudget && "text-red-600",
                                  isProjectNearLimit && "text-amber-600",
                                  !isProjectOverBudget && !isProjectNearLimit && "text-slate-600"
                                )}>
                                  {project.percentage.toFixed(0)}%
                                </span>
                              </div>
                              {project.percentage === 0 && (
                                <Badge variant="outline" className="text-[10px] h-5 bg-blue-50 text-blue-700 border-blue-200">
                                  Sin planificar
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                      Sin proyectos activos
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
        })}
      </div>

      {/* Empty state */}
      {filteredClients.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">
            {searchQuery ? 'No se encontraron clientes' : 'Sin clientes'}
          </h3>
          <p className="text-sm text-muted-foreground/70 mt-1">
            {searchQuery ? 'Prueba con otro término de búsqueda' : 'Crea tu primer cliente para empezar'}
          </p>
        </div>
      )}

      {/* Dialog editar cliente */}
      <Dialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
          </DialogHeader>
          {editingClient && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={editingClient.name}
                  onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                  placeholder="Nombre del cliente"
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
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingClient(null)}>Cancelar</Button>
            <Button onClick={handleUpdateClient}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog eliminar cliente */}
      <Dialog open={!!deletingClient} onOpenChange={(open) => !open && setDeletingClient(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar cliente?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Esta acción eliminará a <strong>{deletingClient?.name}</strong> y todos sus proyectos asociados. Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingClient(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteClient}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog detalle cliente */}
      <Dialog open={!!detailClient} onOpenChange={(open) => !open && setDetailClient(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {detailClient && (
                <>
                  <div 
                    className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: detailClient.color }}
                  >
                    {detailClient.name.charAt(0)}
                  </div>
                  {detailClient.name}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          {detailClient && (() => {
            const data = clientsWithStats.find(c => c.client.id === detailClient.id);
            if (!data) return null;
            
            return (
              <div className="space-y-6 py-4">
                {/* Resumen */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-slate-50 rounded-xl">
                    <p className="text-2xl font-bold">{data.stats.projects.length}</p>
                    <p className="text-xs text-muted-foreground">Proyectos activos</p>
                  </div>
                  <div className="text-center p-4 bg-slate-50 rounded-xl">
                    <p className="text-2xl font-bold">{data.stats.used.toFixed(1)}h</p>
                    <p className="text-xs text-muted-foreground">Horas este mes</p>
                  </div>
                  <div className="text-center p-4 bg-slate-50 rounded-xl">
                    <p className={cn(
                      "text-2xl font-bold",
                      data.stats.percentage > 100 && "text-red-600",
                      data.stats.percentage > 85 && data.stats.percentage <= 100 && "text-amber-600"
                    )}>
                      {data.stats.percentage.toFixed(0)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Presupuesto usado</p>
                  </div>
                </div>

                {/* Proyectos */}
                <div>
                  <h4 className="text-sm font-medium mb-3">Proyectos</h4>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {data.stats.projects.map(project => (
                      <div key={project.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{project.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {project.used.toFixed(1)}h de {project.budget}h
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={Math.min(project.percentage, 100)} 
                            className={cn(
                              "h-2 w-16",
                              project.percentage > 100 && "[&>div]:bg-red-500",
                              project.percentage > 85 && project.percentage <= 100 && "[&>div]:bg-amber-500"
                            )}
                          />
                          <span className="text-xs font-medium w-10 text-right">
                            {project.percentage.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    ))}
                    {data.stats.projects.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Sin proyectos activos
                      </p>
                    )}
                  </div>
                </div>

                {/* Equipo asignado */}
                {data.employees.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-3">Equipo asignado este mes</h4>
                    <div className="flex flex-wrap gap-2">
                      {data.employees.map((name, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailClient(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
