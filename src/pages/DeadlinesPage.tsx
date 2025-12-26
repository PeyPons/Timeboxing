import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, Pencil, Trash2, Save, Search, Eye, EyeOff, ChevronDown, ChevronRight,
  Calendar, Users, AlertTriangle, CheckCircle2, XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Deadline, GlobalAssignment } from '@/types';
import { cn } from '@/lib/utils';
import { format, addMonths, subMonths, getDaysInMonth } from 'date-fns';
import { es } from 'date-fns/locale';

export default function DeadlinesPage() {
  const { projects, clients, employees, isAdmin } = useApp();
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [globalAssignments, setGlobalAssignments] = useState<GlobalAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGlobalDialogOpen, setIsGlobalDialogOpen] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState<Deadline | null>(null);
  const [editingGlobal, setEditingGlobal] = useState<GlobalAssignment | null>(null);
  
  // Estados de filtros y vista
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [searchTerm, setSearchTerm] = useState('');
  const [onlySEO, setOnlySEO] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [hiddenProjects, setHiddenProjects] = useState<Set<string>>(new Set());
  
  const [formData, setFormData] = useState({
    projectId: '',
    notes: '',
    employeeHours: {} as Record<string, number>,
    isHidden: false
  });

  const [globalFormData, setGlobalFormData] = useState({
    name: '',
    hours: 0,
    affectsAll: true,
    affectedEmployeeIds: [] as string[]
  });

  // Cargar deadlines desde Supabase
  const loadDeadlines = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('deadlines')
        .select('*')
        .eq('month', selectedMonth)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setDeadlines(data.map((d: any) => ({
          id: d.id,
          projectId: d.project_id,
          month: d.month,
          notes: d.notes,
          employeeHours: d.employee_hours || {},
          isHidden: d.is_hidden || false
        })));
        
        // Cargar proyectos ocultos
        const hidden = new Set<string>();
        data.forEach((d: any) => {
          if (d.is_hidden) hidden.add(d.project_id);
        });
        setHiddenProjects(hidden);
      }
    } catch (error: any) {
      console.error('Error cargando deadlines:', error);
      toast.error('Error al cargar deadlines');
    } finally {
      setIsLoading(false);
    }
  };

  // Cargar asignaciones globales
  const loadGlobalAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('global_assignments')
        .select('*')
        .eq('month', selectedMonth)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setGlobalAssignments(data.map((g: any) => ({
          id: g.id,
          month: g.month,
          name: g.name,
          hours: Number(g.hours),
          affectsAll: g.affects_all,
          affectedEmployeeIds: (g.affected_employee_ids || []) as string[]
        })));
      }
    } catch (error: any) {
      console.error('Error cargando asignaciones globales:', error);
    }
  };

  // Cargar al montar y cuando cambia el mes
  useEffect(() => {
    loadDeadlines();
    loadGlobalAssignments();
  }, [selectedMonth]);

  const activeEmployees = useMemo(() => {
    return employees.filter(e => e.isActive).sort((a, b) => 
      (a.first_name || a.name).localeCompare(b.first_name || b.name)
    );
  }, [employees]);

  // Calcular capacidad mensual de un empleado
  const getMonthlyCapacity = (employeeId: string) => {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return 0;
    
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = getDaysInMonth(new Date(year, month - 1));
    const workSchedule = employee.workSchedule;
    
    let totalHours = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay(); // 0 = domingo, 1 = lunes, etc.
      const dayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayOfWeek];
      totalHours += workSchedule[dayKey as keyof typeof workSchedule] || 0;
    }
    
    return totalHours;
  };

  // Calcular horas asignadas a un empleado (deadlines + globales)
  const getEmployeeAssignedHours = (employeeId: string) => {
    let total = 0;
    
    // Sumar horas de deadlines
    deadlines.forEach(deadline => {
      if (!hiddenProjects.has(deadline.projectId) && !deadline.isHidden) {
        total += deadline.employeeHours[employeeId] || 0;
      }
    });
    
    // Sumar asignaciones globales
    globalAssignments.forEach(assignment => {
      if (assignment.affectsAll || (assignment.affectedEmployeeIds as string[])?.includes(employeeId)) {
        total += assignment.hours;
      }
    });
    
    return total;
  };

  // Filtrar proyectos
  const filteredProjects = useMemo(() => {
    let filtered = projects.filter(p => p.status === 'active');
    
    // Filtrar por búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p => {
        const client = clients.find(c => c.id === p.clientId);
        return (
          p.name.toLowerCase().includes(term) ||
          client?.name.toLowerCase().includes(term)
        );
      });
    }
    
    // Filtrar solo SEO (excluir SEM, RRSS, Social, DV360)
    if (onlySEO) {
      filtered = filtered.filter(p => {
        const projectName = p.name.toUpperCase();
        return !projectName.includes('SEM') && 
               !projectName.includes('RRSS') && 
               !projectName.includes('SOCIAL') && 
               !projectName.includes('DV360');
      });
    }
    
    // Filtrar ocultos
    if (!showHidden) {
      filtered = filtered.filter(p => !hiddenProjects.has(p.id));
    }
    
    return filtered;
  }, [projects, clients, searchTerm, onlySEO, showHidden, hiddenProjects]);

  // Agrupar proyectos por cliente
  const projectsByClient = useMemo(() => {
    const grouped: Record<string, typeof filteredProjects> = {};
    
    filteredProjects.forEach(project => {
      const clientId = project.clientId || 'sin-cliente';
      if (!grouped[clientId]) {
        grouped[clientId] = [];
      }
      grouped[clientId].push(project);
    });
    
    return grouped;
  }, [filteredProjects]);

  // Expandir todos los clientes por defecto
  useEffect(() => {
    const allClientIds = Object.keys(projectsByClient);
    setExpandedClients(new Set(allClientIds));
  }, [projectsByClient]);

  const openDialog = (deadline?: Deadline) => {
    if (deadline) {
      setEditingDeadline(deadline);
      setFormData({
        projectId: deadline.projectId,
        notes: deadline.notes || '',
        employeeHours: { ...deadline.employeeHours },
        isHidden: deadline.isHidden || false
      });
    } else {
      setEditingDeadline(null);
      setFormData({
        projectId: '',
        notes: '',
        employeeHours: {},
        isHidden: false
      });
    }
    setIsDialogOpen(true);
  };

  const openGlobalDialog = (assignment?: GlobalAssignment) => {
    if (assignment) {
      setEditingGlobal(assignment);
      setGlobalFormData({
        name: assignment.name,
        hours: assignment.hours,
        affectsAll: assignment.affectsAll,
        affectedEmployeeIds: assignment.affectedEmployeeIds || []
      });
    } else {
      setEditingGlobal(null);
      setGlobalFormData({
        name: '',
        hours: 0,
        affectsAll: true,
        affectedEmployeeIds: []
      });
    }
    setIsGlobalDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.projectId) {
      toast.error('Selecciona un proyecto');
      return;
    }

    try {
      const deadlineData = {
        project_id: formData.projectId,
        month: selectedMonth,
        notes: formData.notes || null,
        employee_hours: formData.employeeHours,
        is_hidden: formData.isHidden
      };

      if (editingDeadline) {
        const { error } = await supabase
          .from('deadlines')
          .update(deadlineData)
          .eq('id', editingDeadline.id);

        if (error) throw error;

        setDeadlines(prev => prev.map(d => 
          d.id === editingDeadline.id 
            ? { ...d, ...deadlineData, projectId: formData.projectId, notes: formData.notes, employeeHours: formData.employeeHours, isHidden: formData.isHidden }
            : d
        ));
        
        if (formData.isHidden) {
          setHiddenProjects(prev => new Set([...prev, formData.projectId]));
        } else {
          setHiddenProjects(prev => {
            const newSet = new Set(prev);
            newSet.delete(formData.projectId);
            return newSet;
          });
        }
        
        toast.success('Deadline actualizado');
      } else {
        const { data, error } = await supabase
          .from('deadlines')
          .insert(deadlineData)
          .select()
          .single();

        if (error) throw error;

        setDeadlines(prev => [...prev, {
          id: data.id,
          projectId: data.project_id,
          month: data.month,
          notes: data.notes,
          employeeHours: data.employee_hours || {},
          isHidden: data.is_hidden || false
        }]);
        
        if (formData.isHidden) {
          setHiddenProjects(prev => new Set([...prev, formData.projectId]));
        }
        
        toast.success('Deadline creado');
      }

      setIsDialogOpen(false);
    } catch (error: any) {
      console.error('Error guardando deadline:', error);
      toast.error(error.message || 'Error al guardar deadline');
    }
  };

  const handleSaveGlobal = async () => {
    if (!globalFormData.name || globalFormData.hours <= 0) {
      toast.error('Completa todos los campos');
      return;
    }

    try {
      const assignmentData = {
        month: selectedMonth,
        name: globalFormData.name,
        hours: globalFormData.hours,
        affects_all: globalFormData.affectsAll,
        affected_employee_ids: globalFormData.affectsAll ? null : globalFormData.affectedEmployeeIds
      };

      if (editingGlobal) {
        const { error } = await supabase
          .from('global_assignments')
          .update(assignmentData)
          .eq('id', editingGlobal.id);

        if (error) throw error;

        setGlobalAssignments(prev => prev.map(a => 
          a.id === editingGlobal.id 
            ? { ...a, ...assignmentData, month: selectedMonth, name: globalFormData.name, hours: globalFormData.hours, affectsAll: globalFormData.affectsAll, affectedEmployeeIds: globalFormData.affectedEmployeeIds }
            : a
        ));
        toast.success('Asignación global actualizada');
      } else {
        const { data, error } = await supabase
          .from('global_assignments')
          .insert(assignmentData)
          .select()
          .single();

        if (error) throw error;

        setGlobalAssignments(prev => [...prev, {
          id: data.id,
          month: data.month,
          name: data.name,
          hours: data.hours,
          affectsAll: data.affects_all,
          affectedEmployeeIds: data.affected_employee_ids || []
        }]);
        toast.success('Asignación global creada');
      }

      setIsGlobalDialogOpen(false);
    } catch (error: any) {
      console.error('Error guardando asignación global:', error);
      toast.error(error.message || 'Error al guardar asignación global');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este deadline?')) return;

    try {
      const { error } = await supabase
        .from('deadlines')
        .delete()
        .eq('id', id);

      if (error) throw error;

      const deleted = deadlines.find(d => d.id === id);
      if (deleted) {
        setHiddenProjects(prev => {
          const newSet = new Set(prev);
          newSet.delete(deleted.projectId);
          return newSet;
        });
      }

      setDeadlines(prev => prev.filter(d => d.id !== id));
      toast.success('Deadline eliminado');
    } catch (error: any) {
      console.error('Error eliminando deadline:', error);
      toast.error('Error al eliminar deadline');
    }
  };

  const handleDeleteGlobal = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta asignación global?')) return;

    try {
      const { error } = await supabase
        .from('global_assignments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setGlobalAssignments(prev => prev.filter(a => a.id !== id));
      toast.success('Asignación global eliminada');
    } catch (error: any) {
      console.error('Error eliminando asignación global:', error);
      toast.error('Error al eliminar asignación global');
    }
  };

  const updateEmployeeHours = (employeeId: string, hours: number) => {
    setFormData(prev => ({
      ...prev,
      employeeHours: {
        ...prev.employeeHours,
        [employeeId]: hours > 0 ? hours : 0
      }
    }));
  };

  const getProjectDeadline = (projectId: string) => {
    return deadlines.find(d => d.projectId === projectId && d.month === selectedMonth);
  };

  const getTotalHours = (deadline: Deadline) => {
    return Object.values(deadline.employeeHours).reduce((sum, hours) => sum + hours, 0);
  };

  const toggleClient = (clientId: string) => {
    setExpandedClients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clientId)) {
        newSet.delete(clientId);
      } else {
        newSet.add(clientId);
      }
      return newSet;
    });
  };

  const getMonthOptions = () => {
    const options = [];
    const current = new Date();
    for (let i = -6; i <= 6; i++) {
      const date = addMonths(current, i);
      const value = format(date, 'yyyy-MM');
      const label = format(date, 'MMMM yyyy', { locale: es });
      options.push({ value, label });
    }
    return options;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-400">Cargando deadlines...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Deadlines</h1>
          <p className="text-slate-500 mt-1">Asignación de horas por proyecto y empleado</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[200px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getMonthOptions().map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Resumen de Empleados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Resumen por Empleado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeEmployees.map(emp => {
              const capacity = getMonthlyCapacity(emp.id);
              const assigned = getEmployeeAssignedHours(emp.id);
              const percentage = capacity > 0 ? (assigned / capacity) * 100 : 0;
              const status = percentage > 100 ? 'overload' : percentage > 85 ? 'warning' : 'healthy';
              
              return (
                <div key={emp.id} className="p-4 border rounded-lg bg-white">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={emp.avatarUrl} alt={emp.name} />
                      <AvatarFallback className="bg-indigo-600 text-white text-sm">
                        {(emp.first_name || emp.name)[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{emp.first_name || emp.name}</div>
                      <div className="text-xs text-slate-500 truncate">{emp.role}</div>
                    </div>
                    {status === 'overload' && <AlertTriangle className="h-4 w-4 text-red-500" />}
                    {status === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                    {status === 'healthy' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Capacidad:</span>
                      <span className="font-mono font-semibold">{capacity.toFixed(1)}h</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Asignado:</span>
                      <span className={cn(
                        "font-mono font-semibold",
                        status === 'overload' ? "text-red-600" : 
                        status === 'warning' ? "text-amber-600" : 
                        "text-slate-900"
                      )}>
                        {assigned.toFixed(1)}h
                      </span>
                    </div>
                    <Progress 
                      value={Math.min(percentage, 100)} 
                      className={cn(
                        "h-2",
                        status === 'overload' && "bg-red-200",
                        status === 'warning' && "bg-amber-200",
                        status === 'healthy' && "bg-emerald-200"
                      )}
                    />
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Uso:</span>
                      <span className={cn(
                        "font-semibold",
                        status === 'overload' ? "text-red-600" : 
                        status === 'warning' ? "text-amber-600" : 
                        "text-emerald-600"
                      )}>
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Asignaciones Globales */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Asignaciones Globales
          </CardTitle>
          {isAdmin && (
            <Button onClick={() => openGlobalDialog()} size="sm" variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Añadir
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {globalAssignments.length === 0 ? (
            <div className="text-center text-slate-500 py-4 text-sm">
              No hay asignaciones globales para este mes
            </div>
          ) : (
            <div className="space-y-2">
              {globalAssignments.map(assignment => (
                <div key={assignment.id} className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{assignment.name}</div>
                    <div className="text-xs text-slate-500">
                      {assignment.affectsAll 
                        ? 'Afecta a todos los empleados' 
                        : `Afecta a ${(assignment.affectedEmployeeIds as string[])?.length || 0} empleado(s)`}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono">
                      +{assignment.hours}h
                    </Badge>
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openGlobalDialog(assignment)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:text-red-700"
                          onClick={() => handleDeleteGlobal(assignment.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar proyecto o cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="only-seo"
                checked={onlySEO}
                onCheckedChange={setOnlySEO}
              />
              <Label htmlFor="only-seo" className="cursor-pointer">
                Solo SEO
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="show-hidden"
                checked={showHidden}
                onCheckedChange={setShowHidden}
              />
              <Label htmlFor="show-hidden" className="cursor-pointer">
                Mostrar ocultos
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Proyectos agrupados por cliente */}
      <Card>
        <CardHeader>
          <CardTitle>Asignaciones por Proyecto</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(projectsByClient).length === 0 ? (
            <div className="text-center text-slate-500 py-8">
              No hay proyectos para mostrar
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(projectsByClient).map(([clientId, clientProjects]) => {
                const client = clients.find(c => c.id === clientId);
                const isExpanded = expandedClients.has(clientId);
                
                return (
                  <div key={clientId} className="border rounded-lg overflow-hidden">
                    <Collapsible open={isExpanded} onOpenChange={() => toggleClient(clientId)}>
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors">
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5 text-slate-500" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-slate-500" />
                            )}
                            <div 
                              className="w-4 h-4 rounded-full" 
                              style={{ backgroundColor: client?.color || '#6b7280' }}
                            />
                            <span className="font-semibold">{client?.name || 'Sin cliente'}</span>
                            <Badge variant="outline" className="text-xs">
                              {clientProjects.length} proyecto{clientProjects.length !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="divide-y">
                          {clientProjects.map(project => {
                            const deadline = getProjectDeadline(project.id);
                            const totalAssigned = deadline ? getTotalHours(deadline) : 0;
                            const isOverBudget = totalAssigned > (project.budgetHours || 0);
                            const isUnderMin = project.minimumHours && totalAssigned < project.minimumHours;
                            const isHidden = hiddenProjects.has(project.id);
                            
                            return (
                              <div 
                                key={project.id} 
                                className={cn(
                                  "p-4 hover:bg-slate-50 transition-colors",
                                  isHidden && "opacity-50",
                                  isOverBudget && "bg-red-50"
                                )}
                              >
                                <div className="flex items-start gap-4">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="font-medium">{project.name}</span>
                                      {isHidden && (
                                        <Badge variant="outline" className="text-xs">
                                          <EyeOff className="h-3 w-3 mr-1" />
                                          Oculto
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-slate-600 mb-2">
                                      {project.minimumHours && (
                                        <span className="font-mono">
                                          Min: {project.minimumHours}h
                                        </span>
                                      )}
                                      <span className="font-mono">
                                        Contratadas: {project.budgetHours}h
                                      </span>
                                      {deadline?.notes && (
                                        <span className="text-slate-500 italic" title={deadline.notes}>
                                          {deadline.notes}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 mt-2">
                                      {activeEmployees.map(emp => {
                                        const hours = deadline?.employeeHours[emp.id] || 0;
                                        if (hours === 0 && !deadline) return null;
                                        return (
                                          <div key={emp.id} className="flex items-center gap-2">
                                            <span className="text-xs text-slate-600">{emp.first_name || emp.name}:</span>
                                            <Badge variant="outline" className="font-mono text-xs">
                                              {hours}h
                                            </Badge>
                                          </div>
                                        );
                                      })}
                                      {deadline && (
                                        <Badge 
                                          variant={isOverBudget ? "destructive" : isUnderMin ? "secondary" : "default"}
                                          className="font-mono ml-auto"
                                        >
                                          Total: {totalAssigned}h
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  {isAdmin && (
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => openDialog(deadline || { 
                                          id: '', 
                                          projectId: project.id, 
                                          month: selectedMonth,
                                          employeeHours: {},
                                          isHidden: isHidden
                                        })}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      {deadline && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-red-600 hover:text-red-700"
                                          onClick={() => handleDelete(deadline.id)}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para crear/editar deadline */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingDeadline ? 'Editar Deadline' : 'Nuevo Deadline'}
            </DialogTitle>
            <DialogDescription>
              Asigna horas por empleado para este proyecto
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Proyecto</Label>
              <Select
                value={formData.projectId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, projectId: value }))}
                disabled={!!editingDeadline}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un proyecto" />
                </SelectTrigger>
                <SelectContent>
                  {filteredProjects.map(project => {
                    const client = clients.find(c => c.id === project.clientId);
                    return (
                      <SelectItem key={project.id} value={project.id}>
                        {client?.name || 'Sin cliente'} - {project.name} 
                        ({project.minimumHours ? `${project.minimumHours}-` : ''}{project.budgetHours}h)
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="is-hidden"
                checked={formData.isHidden}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isHidden: checked }))}
              />
              <Label htmlFor="is-hidden" className="cursor-pointer">
                Ocultar este proyecto (no se trabaja este mes)
              </Label>
            </div>

            <div className="space-y-2">
              <Label>Anotaciones</Label>
              <Textarea
                placeholder="Ej: LB 3,5 horas (link building)"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="space-y-3">
              <Label>Asignación de Horas por Empleado</Label>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {activeEmployees.map(emp => {
                  const hours = formData.employeeHours[emp.id] || 0;
                  const project = projects.find(p => p.id === formData.projectId);
                  return (
                    <div key={emp.id} className="flex items-center gap-3 p-2 rounded-lg border bg-slate-50">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{emp.first_name || emp.name}</div>
                        <div className="text-xs text-slate-500">{emp.role}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          value={hours}
                          onChange={(e) => updateEmployeeHours(emp.id, parseFloat(e.target.value) || 0)}
                          className="w-24 text-center"
                          placeholder="0"
                        />
                        <span className="text-sm text-slate-500">h</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {formData.projectId && (
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Total asignado:</span>
                  <span className={cn(
                    "font-mono font-semibold",
                    Object.values(formData.employeeHours).reduce((sum, h) => sum + h, 0) > (projects.find(p => p.id === formData.projectId)?.budgetHours || 0)
                      ? "text-red-600"
                      : "text-slate-900"
                  )}>
                    {Object.values(formData.employeeHours).reduce((sum: number, h: number) => sum + h, 0)}h
                  </span>
                </div>
                {projects.find(p => p.id === formData.projectId)?.minimumHours && (
                  <div className="flex justify-between items-center text-sm mt-1">
                    <span className="text-slate-600">Horas mínimas:</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {projects.find(p => p.id === formData.projectId)?.minimumHours}h
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm mt-1">
                  <span className="text-slate-600">Horas contratadas:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {projects.find(p => p.id === formData.projectId)?.budgetHours || 0}h
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700">
              <Save className="h-4 w-4 mr-2" />
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para asignaciones globales */}
      <Dialog open={isGlobalDialogOpen} onOpenChange={setIsGlobalDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingGlobal ? 'Editar Asignación Global' : 'Nueva Asignación Global'}
            </DialogTitle>
            <DialogDescription>
              Tareas que afectan a uno o más empleados
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre de la tarea</Label>
              <Input
                placeholder="Ej: Deadline afecta a todos, Creación timeboxing"
                value={globalFormData.name}
                onChange={(e) => setGlobalFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Horas</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={globalFormData.hours}
                onChange={(e) => setGlobalFormData(prev => ({ ...prev, hours: parseFloat(e.target.value) || 0 }))}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="affects-all"
                checked={globalFormData.affectsAll}
                onCheckedChange={(checked) => setGlobalFormData(prev => ({ ...prev, affectsAll: checked }))}
              />
              <Label htmlFor="affects-all" className="cursor-pointer">
                Afecta a todos los empleados
              </Label>
            </div>

            {!globalFormData.affectsAll && (
              <div className="space-y-2">
                <Label>Seleccionar empleados</Label>
                <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-lg p-3">
                  {activeEmployees.map(emp => (
                    <div key={emp.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`emp-${emp.id}`}
                        checked={globalFormData.affectedEmployeeIds?.includes(emp.id)}
                        onChange={(e) => {
                          const ids = (globalFormData.affectedEmployeeIds || []) as string[];
                          if (e.target.checked) {
                            setGlobalFormData(prev => ({ ...prev, affectedEmployeeIds: [...ids, emp.id] }));
                          } else {
                            setGlobalFormData(prev => ({ ...prev, affectedEmployeeIds: ids.filter(id => id !== emp.id) }));
                          }
                        }}
                        className="rounded"
                      />
                      <Label htmlFor={`emp-${emp.id}`} className="cursor-pointer text-sm">
                        {emp.first_name || emp.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGlobalDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveGlobal} className="bg-indigo-600 hover:bg-indigo-700">
              <Save className="h-4 w-4 mr-2" />
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
