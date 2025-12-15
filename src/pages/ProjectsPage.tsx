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
  Euro,
  ExternalLink,
  ChevronsUpDown,
  Check,
  User,
  Target,
  FileCheck,
  Clock,
  MessageSquare
} from 'lucide-react';
import { Project } from '@/types';
import { cn } from '@/lib/utils';

// Helper para redondeo
const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

export default function ProjectsPage() {
  const { projects, clients, allocations, employees, updateProject } = useApp();
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filtros
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('all');
  const [openEmployeeCombo, setOpenEmployeeCombo] = useState(false);

  // Edición
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  
  // Formulario Edición
  const [editName, setEditName] = useState('');
  const [editBudget, setEditBudget] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'archived' | 'completed'>('active');
  const [editHealth, setEditHealth] = useState<'healthy' | 'needs_attention' | 'at_risk'>('healthy');
  const [editFee, setEditFee] = useState('');
  const [editNps, setEditNps] = useState('');

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

          const fee = project.monthlyFee || 0;
          const internalCostRate = 25; 
          const currentCost = totalCompleted * internalCostRate;
          const profitMargin = fee - currentCost;

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
                            <Target className="h-3.5 w-3.5 mr-2" /> OKRs y Estrategia
                        </TabsTrigger>
                        <TabsTrigger value="gestion" className="text-xs data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none h-10 px-4">
                            <FileCheck className="h-3.5 w-3.5 mr-2" /> Gestión Mensual
                        </TabsTrigger>
                    </TabsList>

                    {/* VISTA OPERATIVA (Horas y Tareas) */}
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

                        <div className="border rounded-md bg-slate-50/50 overflow-hidden">
                            <div className="bg-slate-100 px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase flex justify-between">
                                <span>Últimas Tareas</span>
                                <span>Horas</span>
                            </div>
                            {monthTasks.length > 0 ? (
                                <div className="divide-y divide-slate-100">
                                    {monthTasks.slice(0, 3).map(task => (
                                        <div key={task.id} className="px-3 py-2 flex justify-between text-xs items-center bg-white">
                                            <span className="truncate max-w-[80%]">{task.taskName}</span>
                                            <span className="font-mono text-slate-500">{task.hoursAssigned}h</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-3 text-center text-xs text-muted-foreground italic">Sin tareas este mes</div>
                            )}
                        </div>
                    </TabsContent>

                    {/* VISTA ESTRATEGIA (OKRs) - Simulado basado en Excel */}
                    <TabsContent value="estrategia" className="p-4 space-y-3">
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Objetivos Trimestrales (Q1)</div>
                        {/* Mock Data para visualizar concepto */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-2"><Target className="h-3 w-3 text-indigo-500"/> KWR Top 3</span>
                                <span className="font-mono font-bold">12 / 15</span>
                            </div>
                            <Progress value={80} className="h-1.5 bg-slate-100 [&>div]:bg-indigo-500" />
                            
                            <div className="flex items-center justify-between text-sm mt-2">
                                <span className="flex items-center gap-2"><Target className="h-3 w-3 text-indigo-500"/> Tráfico Orgánico</span>
                                <span className="font-mono font-bold">+15%</span>
                            </div>
                            <Progress value={45} className="h-1.5 bg-slate-100 [&>div]:bg-indigo-500" />
                        </div>
                        
                        <div className="mt-4 pt-3 border-t">
                            <div className="flex items-start gap-2">
                                <MessageSquare className="h-3 w-3 text-slate-400 mt-0.5" />
                                <p className="text-xs text-slate-600 italic">"Cliente quiere foco en KWR de marca este mes. Ojo con la canibalización."</p>
                            </div>
                        </div>
                    </TabsContent>

                    {/* VISTA GESTIÓN (Entregables) - Simulado */}
                    <TabsContent value="gestion" className="p-4">
                        <div className="space-y-3">
                            <div className="flex items-center space-x-2">
                                <Checkbox id={`meet-${project.id}`} />
                                <label htmlFor={`meet-${project.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    Reunión Mensual Realizada
                                </label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id={`report-${project.id}`} />
                                <label htmlFor={`report-${project.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    Informe Enviado
                                </label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id={`nps-${project.id}`} />
                                <label htmlFor={`nps-${project.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    Encuesta NPS Enviada
                                </label>
                            </div>
                        </div>
                        
                        {project.npsLink && (
                            <div className="mt-4 pt-3 border-t">
                                <a href={project.npsLink} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1 text-indigo-600 hover:underline">
                                    <ExternalLink className="h-3 w-3" /> Ver Informe de Satisfacción
                                </a>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Dialogo Edición (Mismo que tenías, necesario para que funcione el lápiz) */}
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
