import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { format, addMonths, subMonths, isSameMonth, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  FolderKanban, 
  ChevronLeft, 
  ChevronRight, 
  CalendarDays, 
  Briefcase, 
  Pencil,
  Search,
  HeartPulse,
  ExternalLink,
  ChevronsUpDown,
  Check,
  User,
  Target,
  FileCheck,
  Clock,
  Plus,
  Trash2,
  Euro
} from 'lucide-react';
import { Project } from '@/types';
import { cn } from '@/lib/utils';

const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

export default function ProjectsPage() {
  const { projects, clients, allocations, employees, updateProject } = useApp();
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('all');
  const [openEmployeeCombo, setOpenEmployeeCombo] = useState(false);

  // Estados Edición General
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');
  const [editBudget, setEditBudget] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'archived' | 'completed'>('active');
  const [editHealth, setEditHealth] = useState<'healthy' | 'needs_attention' | 'at_risk'>('healthy');
  const [editFee, setEditFee] = useState('');
  const [editNps, setEditNps] = useState('');

  // Estados Edición OKRs
  const [newOkr, setNewOkr] = useState('');

  const handlePrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const handleToday = () => setCurrentMonth(new Date());

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
        if (p.status !== 'active') return false;
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
        
        let matchesEmployee = true;
        if (selectedEmployeeId !== 'all') {
            matchesEmployee = allocations.some(a => 
                a.projectId === p.id && 
                a.employeeId === selectedEmployeeId && 
                isSameMonth(parseISO(a.weekStartDate), currentMonth)
            );
        }
        return matchesSearch && matchesEmployee;
    });
  }, [projects, searchTerm, selectedEmployeeId, allocations, currentMonth]);

  // --- LÓGICA DE CHECKLIST MENSUAL ---
  const handleToggleDeliverable = async (project: Project, itemKey: string) => {
      const monthKey = format(currentMonth, 'yyyy-MM');
      const currentLog = project.deliverables_log || {};
      const monthItems = currentLog[monthKey] || [];

      let newMonthItems;
      if (monthItems.includes(itemKey)) {
          newMonthItems = monthItems.filter(i => i !== itemKey);
      } else {
          newMonthItems = [...monthItems, itemKey];
      }

      const newLog = {
          ...currentLog,
          [monthKey]: newMonthItems
      };

      await updateProject({ ...project, deliverables_log: newLog });
  };

  // --- LÓGICA DE OKRS ---
  const handleAddOkr = async (project: Project) => {
      if (!newOkr.trim()) return;
      const currentOkrs = project.okrs || [];
      await updateProject({ ...project, okrs: [...currentOkrs, newOkr.trim()] });
      setNewOkr('');
  };

  const handleDeleteOkr = async (project: Project, index: number) => {
      const currentOkrs = project.okrs || [];
      const newOkrs = currentOkrs.filter((_, i) => i !== index);
      await updateProject({ ...project, okrs: newOkrs });
  };

  // --- LÓGICA EDICIÓN ---
  const handleEditClick = (project: Project) => {
    setEditingProject(project);
    setEditName(project.name);
    setEditBudget(project.budgetHours.toString());
    setEditStatus(project.status);
    setEditHealth(project.healthStatus || 'healthy');
    setEditFee(project.monthlyFee?.toString() || '');
    setEditNps(project.npsLink || '');
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingProject) return;
    await updateProject({
        ...editingProject,
        name: editName,
        budgetHours: parseFloat(editBudget) || 0,
        status: editStatus,
        healthStatus: editHealth,
        monthlyFee: parseFloat(editFee) || 0,
        npsLink: editNps
    });
    setIsEditOpen(false);
    setEditingProject(null);
  };

  const getHealthColor = (status?: string) => {
      switch(status) {
          case 'at_risk': return 'text-red-600 bg-red-50 border-red-100';
          case 'needs_attention': return 'text-amber-600 bg-amber-50 border-amber-100';
          default: return 'text-emerald-600 bg-emerald-50 border-emerald-100';
      }
  };

  const getHealthLabel = (status?: string) => {
      switch(status) {
          case 'at_risk': return 'En Peligro';
          case 'needs_attention': return 'Atención';
          default: return 'Sano';
      }
  };

  const getSelectedEmployeeName = () => {
      if (selectedEmployeeId === 'all') return "Todos los empleados";
      return employees.find(e => e.id === selectedEmployeeId)?.name || "Seleccionar...";
  };

  return (
    <div className="flex flex-col h-full space-y-6 p-6 md:p-8 max-w-7xl mx-auto w-full">
      
      {/* Cabecera */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                    <FolderKanban className="h-8 w-8 text-indigo-600" />
                    Proyectos 360º
                </h1>
                <p className="text-muted-foreground">
                    Visión estratégica, financiera y operativa.
                </p>
            </div>

            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-lg border shadow-sm">
                <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-2 px-2 min-w-[140px] justify-center font-medium">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <span className="capitalize">{format(currentMonth, 'MMMM yyyy', { locale: es })}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={handleNextMonth}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleToday} className="text-xs">Hoy</Button>
            </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 bg-slate-50/50 p-4 rounded-xl border">
            <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Buscar proyecto..." 
                    className="pl-9 bg-white" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            
            <Popover open={openEmployeeCombo} onOpenChange={setOpenEmployeeCombo}>
                <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={openEmployeeCombo} className="w-full sm:w-[250px] justify-between bg-white">
                        <span className="flex items-center gap-2 truncate">
                            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            {getSelectedEmployeeName()}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-0">
                    <Command>
                        <CommandInput placeholder="Buscar empleado..." />
                        <CommandList>
                            <CommandEmpty>No encontrado.</CommandEmpty>
                            <CommandGroup>
                                <CommandItem value="all" onSelect={() => { setSelectedEmployeeId('all'); setOpenEmployeeCombo(false); }}>
                                    <Check className={cn("mr-2 h-4 w-4", selectedEmployeeId === 'all' ? "opacity-100" : "opacity-0")} />
                                    Todos los empleados
                                </CommandItem>
                                {employees.filter(e => e.isActive).map((employee) => (
                                    <CommandItem key={employee.id} value={employee.name} onSelect={() => { setSelectedEmployeeId(employee.id); setOpenEmployeeCombo(false); }}>
                                        <Check className={cn("mr-2 h-4 w-4", selectedEmployeeId === employee.id ? "opacity-100" : "opacity-0")} />
                                        {employee.name}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
      </div>

      {/* Grid de Proyectos */}
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        {filteredProjects.map((project) => {
          const client = clients.find(c => c.id === project.clientId);
          
          // Cálculos Operativos
          let monthTasks = allocations.filter(a => {
             const taskDate = parseISO(a.weekStartDate);
             return a.projectId === project.id && isSameMonth(taskDate, currentMonth);
          });

          if (selectedEmployeeId !== 'all') {
              monthTasks = monthTasks.filter(t => t.employeeId === selectedEmployeeId);
          }

          const totalAssigned = monthTasks.reduce((sum, t) => sum + t.hoursAssigned, 0);
          const totalCompleted = monthTasks
            .filter(t => t.status === 'completed')
            .reduce((sum, t) => sum + (t.hoursActual || t.hoursAssigned), 0);

          const budget = project.budgetHours || 0;
          const assignedPct = budget > 0 ? (totalAssigned / budget) * 100 : 0;
          const completedPct = budget > 0 ? (totalCompleted / budget) * 100 : 0;

          // Cálculo Financiero
          const fee = project.monthlyFee || 0;
          const internalCostRate = 25; 
          const currentCost = totalCompleted * internalCostRate;
          const profitMargin = fee - currentCost;

          // Datos de Checklist Mensual
          const monthKey = format(currentMonth, 'yyyy-MM');
          const completedDeliverables = project.deliverables_log?.[monthKey] || [];

          return (
            <Card key={project.id} className={cn("overflow-hidden border-l-4 shadow-sm hover:shadow-md transition-shadow", 
                project.healthStatus === 'at_risk' ? 'border-l-red-500' : 
                project.healthStatus === 'needs_attention' ? 'border-l-amber-500' : 'border-l-emerald-500'
            )}>
              <CardHeader className="bg-slate-50/50 pb-3 border-b">
                <div className="flex justify-between items-start gap-4">
                    <div className="flex gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-lg bg-white border flex items-center justify-center shadow-sm shrink-0">
                            <Briefcase className="h-5 w-5 text-slate-500" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-base truncate">{project.name}</CardTitle>
                                <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5", getHealthColor(project.healthStatus))}>
                                    <HeartPulse className="h-3 w-3 mr-1" />
                                    {getHealthLabel(project.healthStatus)}
                                </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground flex gap-2 items-center mt-1">
                                <span className="font-medium text-slate-700">{client?.name}</span>
                                <span>•</span>
                                {fee > 0 ? (
                                    <span className={cn("font-mono", profitMargin < 0 ? "text-red-600" : "text-emerald-600")}>
                                        Mg: {profitMargin.toFixed(0)}€
                                    </span>
                                ) : <span>Sin Fee</span>}
                            </div>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" onClick={() => handleEditClick(project)}>
                        <Pencil className="h-4 w-4" />
                    </Button>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <Tabs defaultValue="operativa" className="w-full">
                    <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-4 h-10">
                        <TabsTrigger value="operativa" className="text-xs data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none h-10 px-4">
                            <Clock className="h-3.5 w-3.5 mr-2" /> Operativa
                        </TabsTrigger>
                        <TabsTrigger value="estrategia" className="text-xs data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none h-10 px-4">
                            <Target className="h-3.5 w-3.5 mr-2" /> Estrategia (OKRs)
                        </TabsTrigger>
                        <TabsTrigger value="gestion" className="text-xs data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none h-10 px-4">
                            <FileCheck className="h-3.5 w-3.5 mr-2" /> Entregables
                        </TabsTrigger>
                    </TabsList>

                    {/* VISTA OPERATIVA */}
                    <TabsContent value="operativa" className="p-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                                    <span>Planificado</span>
                                    <span>{round2(totalAssigned)} / {budget}h</span>
                                </div>
                                <Progress value={assignedPct} className="h-2 bg-slate-100" />
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-[10px] uppercase tracking-wider font-semibold text-emerald-600">
                                    <span>Computado</span>
                                    <span>{round2(totalCompleted)}h</span>
                                </div>
                                <Progress value={completedPct} className="h-2 bg-emerald-100 [&>div]:bg-emerald-500" />
                            </div>
                        </div>
                        {monthTasks.length > 0 ? (
                            <div className="border rounded-md bg-slate-50/50 overflow-hidden text-xs">
                                <div className="divide-y divide-slate-100">
                                    {monthTasks.slice(0, 3).map(task => (
                                        <div key={task.id} className="px-3 py-2 flex justify-between items-center bg-white">
                                            <span className="truncate max-w-[80%]">{task.taskName}</span>
                                            <span className="font-mono text-slate-500">{task.hoursAssigned}h</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="p-3 text-center text-xs text-muted-foreground italic bg-slate-50 rounded border border-dashed">Sin tareas este mes</div>
                        )}
                    </TabsContent>

                    {/* VISTA ESTRATEGIA (OKRs Dinámicos) */}
                    <TabsContent value="estrategia" className="p-4 space-y-4">
                        <div className="space-y-2">
                            {(project.okrs || []).map((okr, idx) => (
                                <div key={idx} className="flex items-start gap-2 bg-slate-50 p-2 rounded border border-slate-100 group">
                                    <Target className="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" />
                                    <span className="text-xs text-slate-700 flex-1">{okr}</span>
                                    <button onClick={() => handleDeleteOkr(project, idx)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}
                            {(project.okrs?.length || 0) === 0 && (
                                <p className="text-xs text-slate-400 italic text-center py-2">No hay objetivos definidos.</p>
                            )}
                        </div>
                        
                        <div className="flex gap-2 pt-2 border-t">
                            <Input 
                                placeholder="Añadir objetivo (ej: +20% KWR TOP 3)" 
                                className="h-8 text-xs" 
                                value={newOkr}
                                onChange={e => setNewOkr(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddOkr(project)}
                            />
                            <Button size="sm" className="h-8 bg-slate-900" onClick={() => handleAddOkr(project)}>
                                <Plus className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </TabsContent>

                    {/* VISTA ENTREGABLES (Checklist Mensual) */}
                    <TabsContent value="gestion" className="p-4">
                        <div className="space-y-4">
                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex justify-between">
                                <span>Entregables {format(currentMonth, 'MMMM', { locale: es })}</span>
                                <span className="text-slate-400 font-normal normal-case">Se reinician mensualmente</span>
                            </div>
                            <div className="space-y-3">
                                {[
                                    { key: 'meeting', label: 'Reunión Mensual Realizada' },
                                    { key: 'report', label: 'Informe Enviado' },
                                    { key: 'nps', label: 'Encuesta NPS Enviada' }
                                ].map((item) => (
                                    <div key={item.key} className="flex items-center space-x-2 p-2 rounded hover:bg-slate-50 transition-colors">
                                        <Checkbox 
                                            id={`${item.key}-${project.id}`} 
                                            checked={completedDeliverables.includes(item.key)}
                                            onCheckedChange={() => handleToggleDeliverable(project, item.key)}
                                        />
                                        <label 
                                            htmlFor={`${item.key}-${project.id}`} 
                                            className={cn("text-sm font-medium leading-none cursor-pointer", 
                                                completedDeliverables.includes(item.key) ? "text-slate-900" : "text-slate-500"
                                            )}
                                        >
                                            {item.label}
                                        </label>
                                    </div>
                                ))}
                            </div>
                            
                            {project.npsLink && (
                                <div className="mt-4 pt-3 border-t">
                                    <a href={project.npsLink} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1 text-indigo-600 hover:underline">
                                        <ExternalLink className="h-3 w-3" /> Ver Informe de Satisfacción
                                    </a>
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Dialogo Edición */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>Gestión de Proyecto</DialogTitle>
                <DialogDescription>Configura parámetros de negocio y salud.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-6 py-4">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Nombre</Label>
                        <Input value={editName} onChange={e => setEditName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Fee Mensual (€)</Label>
                        <Input type="number" value={editFee} onChange={e => setEditFee(e.target.value)} placeholder="Ej: 2000" />
                    </div>
                    <div className="space-y-2">
                        <Label>Enlace NPS / Informe</Label>
                        <Input value={editNps} onChange={e => setEditNps(e.target.value)} placeholder="https://..." />
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Presupuesto Horas</Label>
                        <Input type="number" value={editBudget} onChange={e => setEditBudget(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Salud del Cliente</Label>
                        <Select value={editHealth} onValueChange={(val: any) => setEditHealth(val)}>
                            <SelectTrigger className={cn(getHealthColor(editHealth), "border")}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="healthy">🟢 Sano</SelectItem>
                                <SelectItem value="needs_attention">🟠 Con Necesidades</SelectItem>
                                <SelectItem value="at_risk">🔴 En Peligro</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Estado Proyecto</Label>
                        <Select value={editStatus} onValueChange={(val: any) => setEditStatus(val)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="active">Activo</SelectItem>
                                <SelectItem value="archived">Archivado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
                <Button onClick={handleSaveEdit}>Guardar Cambios</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
