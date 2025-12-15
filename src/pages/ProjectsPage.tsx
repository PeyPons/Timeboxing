import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { format, addMonths, subMonths, isSameMonth, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  FolderKanban, ChevronLeft, ChevronRight, CalendarDays, Briefcase, Pencil, Search, 
  HeartPulse, ChevronsUpDown, Check, User, Target, FileCheck, Clock, Plus, Trash2, 
  ChevronDown, AlertCircle, PlayCircle, CheckCircle2 
} from 'lucide-react';
import { Project, OKR } from '@/types';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

export default function ProjectsPage() {
  const { projects, clients, allocations, employees, updateProject } = useApp();
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('all');
  const [openEmployeeCombo, setOpenEmployeeCombo] = useState(false);
  const [showOnlyUnderPlanned, setShowOnlyUnderPlanned] = useState(false);

  // Estados Edición/Creación
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
      name: '', clientId: '', budgetHours: '', minimumHours: '', monthlyFee: '',
      status: 'active' as 'active' | 'archived' | 'completed',
      healthStatus: 'healthy' as 'healthy' | 'needs_attention' | 'at_risk',
      okrs: [] as OKR[]
  });
  const [newOkrTitle, setNewOkrTitle] = useState('');

  const handlePrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const handleToday = () => setCurrentMonth(new Date());

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
        if (p.status !== 'active') return false;
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
        
        let matchesEmployee = true;
        let monthTasks = allocations.filter(a => a.projectId === p.id && isSameMonth(parseISO(a.weekStartDate), currentMonth));
        if (selectedEmployeeId !== 'all') {
            matchesEmployee = monthTasks.some(a => a.employeeId === selectedEmployeeId);
        }

        let matchesPlanning = true;
        if (showOnlyUnderPlanned) {
            const planned = monthTasks.reduce((sum, t) => sum + t.hoursAssigned, 0);
            const target = p.budgetHours || 0;
            matchesPlanning = planned < target - 0.1; 
        }

        return matchesSearch && matchesEmployee && matchesPlanning;
    });
  }, [projects, searchTerm, selectedEmployeeId, allocations, currentMonth, showOnlyUnderPlanned]);

  // CRUD y Lógica de Edición... (Se mantienen igual que antes, enfocado en mostrar las tareas)
  
  const openNewProject = () => {
      setIsCreating(true);
      setEditingId(null);
      setFormData({ name: '', clientId: '', budgetHours: '0', minimumHours: '0', monthlyFee: '0', status: 'active', healthStatus: 'healthy', okrs: [] });
      setIsDialogOpen(true);
  };

  const openEditProject = (project: Project) => {
      setIsCreating(false);
      setEditingId(project.id);
      setFormData({
          name: project.name, clientId: project.clientId,
          budgetHours: project.budgetHours?.toString() || '0', minimumHours: project.minimumHours?.toString() || '0',
          monthlyFee: project.monthlyFee?.toString() || '0', status: project.status,
          healthStatus: project.healthStatus || 'healthy', okrs: project.okrs || []
      });
      setIsDialogOpen(true);
  };

  const handleSave = async () => {
      const payload = {
          name: formData.name, client_id: formData.clientId,
          budget_hours: parseFloat(formData.budgetHours) || 0, minimum_hours: parseFloat(formData.minimumHours) || 0,
          monthly_fee: parseFloat(formData.monthlyFee) || 0, status: formData.status,
          health_status: formData.healthStatus, okrs: formData.okrs
      };
      try {
          if (isCreating) { await supabase.from('projects').insert([payload]); } 
          else if (editingId) { await supabase.from('projects').update(payload).eq('id', editingId); }
          window.location.reload();
      } catch (error) { console.error(error); alert("Error al guardar."); }
      setIsDialogOpen(false);
  };

  const addOkrToForm = () => {
      if (!newOkrTitle.trim()) return;
      const newOkr: OKR = { id: crypto.randomUUID(), title: newOkrTitle, progress: 0 };
      setFormData({ ...formData, okrs: [...formData.okrs, newOkr] });
      setNewOkrTitle('');
  };
  const updateOkrProgress = (id: string, val: number) => {
      setFormData({ ...formData, okrs: formData.okrs.map(o => o.id === id ? { ...o, progress: val } : o) });
  };
  const removeOkr = (id: string) => { setFormData({ ...formData, okrs: formData.okrs.filter(o => o.id !== id) }); };

  const getHealthColor = (status?: string) => {
      switch(status) {
          case 'at_risk': return 'text-red-600 bg-red-50 border-red-100';
          case 'needs_attention': return 'text-amber-600 bg-amber-50 border-amber-100';
          default: return 'text-emerald-600 bg-emerald-50 border-emerald-100';
      }
  };

  const getSelectedEmployeeName = () => {
      if (selectedEmployeeId === 'all') return "Todos";
      return employees.find(e => e.id === selectedEmployeeId)?.name || "Seleccionar...";
  };

  return (
    <div className="flex flex-col h-full space-y-6 p-6 md:p-8 max-w-7xl mx-auto w-full">
      {/* Cabecera y Filtros */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                    <FolderKanban className="h-8 w-8 text-indigo-600" /> Proyectos
                </h1>
                <p className="text-muted-foreground">Gestión estratégica y operativa.</p>
            </div>
            <div className="flex items-center gap-3">
                <Button onClick={openNewProject} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"><Plus className="h-4 w-4" /> Nuevo</Button>
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-lg border shadow-sm">
                    <Button variant="ghost" size="icon" onClick={handlePrevMonth}><ChevronLeft className="h-4 w-4" /></Button>
                    <div className="px-2 min-w-[120px] text-center font-medium capitalize">{format(currentMonth, 'MMMM yyyy', { locale: es })}</div>
                    <Button variant="ghost" size="icon" onClick={handleNextMonth}><ChevronRight className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={handleToday} className="text-xs">Hoy</Button>
                </div>
            </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 bg-slate-50/50 p-4 rounded-xl border">
            <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar proyecto..." className="pl-9 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Button variant={showOnlyUnderPlanned ? "default" : "outline"} onClick={() => setShowOnlyUnderPlanned(!showOnlyUnderPlanned)} className={cn("gap-2", showOnlyUnderPlanned ? "bg-amber-100 text-amber-900 border-amber-200" : "bg-white")}>
                <AlertCircle className="h-4 w-4" /> {showOnlyUnderPlanned ? "Falta Planificar" : "Todos"}
            </Button>
            <Popover open={openEmployeeCombo} onOpenChange={setOpenEmployeeCombo}>
                <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-[200px] justify-between bg-white">
                        <span className="flex items-center gap-2 truncate"><User className="h-3.5 w-3.5 text-muted-foreground" /> {getSelectedEmployeeName()}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
                    <Command>
                        <CommandInput placeholder="Empleado..." />
                        <CommandList>
                            <CommandGroup>
                                <CommandItem onSelect={() => setSelectedEmployeeId('all')}>Todos</CommandItem>
                                {employees.filter(e => e.isActive).map(e => (<CommandItem key={e.id} onSelect={() => setSelectedEmployeeId(e.id)}>{e.name}</CommandItem>))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        {filteredProjects.map((project) => {
          const client = clients.find(c => c.id === project.clientId);
          
          let monthTasks = allocations.filter(a => a.projectId === project.id && isSameMonth(parseISO(a.weekStartDate), currentMonth));
          if (selectedEmployeeId !== 'all') monthTasks = monthTasks.filter(t => t.employeeId === selectedEmployeeId);

          const totalAssigned = monthTasks.reduce((sum, t) => sum + t.hoursAssigned, 0);
          const completedTasks = monthTasks.filter(t => t.status === 'completed');
          const pendingTasks = monthTasks.filter(t => t.status !== 'completed');

          const budget = project.budgetHours || 0;
          const minimum = project.minimumHours || 0;
          const assignedPct = budget > 0 ? (totalAssigned / budget) * 100 : 0;
          const belowMinimum = totalAssigned < minimum;

          return (
            <Card key={project.id} className={cn("overflow-hidden border-l-4 shadow-sm hover:shadow-md transition-all", 
                project.healthStatus === 'at_risk' ? 'border-l-red-500' : project.healthStatus === 'needs_attention' ? 'border-l-amber-500' : 'border-l-emerald-500'
            )}>
              <CardHeader className="bg-slate-50/50 pb-3 border-b">
                <div className="flex justify-between items-start gap-4">
                    <div className="flex gap-3 min-w-0 flex-1">
                        <div className="h-10 w-10 rounded-lg bg-white border flex items-center justify-center shadow-sm shrink-0"><Briefcase className="h-5 w-5 text-slate-500" /></div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-base truncate">{project.name}</CardTitle>
                                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", getHealthColor(project.healthStatus))}>
                                    {project.healthStatus === 'at_risk' ? 'En Peligro' : project.healthStatus === 'needs_attention' ? 'Atención' : 'Sano'}
                                </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground flex gap-2 items-center mt-1">
                                <span className="font-medium text-slate-700">{client?.name || "Sin Cliente"}</span>
                                {project.monthlyFee && project.monthlyFee > 0 && <span className="font-mono text-slate-500">• {project.monthlyFee}€</span>}
                            </div>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" onClick={() => openEditProject(project)}><Pencil className="h-4 w-4" /></Button>
                </div>
                <div className="mt-3 space-y-2">
                    <div className="flex justify-between text-xs">
                        <span className="text-slate-500 font-medium">Planificado: <span className={cn("font-bold", belowMinimum ? "text-red-600" : "text-slate-900")}>{round2(totalAssigned)}h</span> {totalAssigned < budget && <span className="text-amber-600 ml-2 font-normal">(Faltan {round2(budget - totalAssigned)}h)</span>}</span>
                        <div className="text-right"><span className="text-slate-400 mr-2">Mín: {minimum}h</span><span className="font-mono font-bold text-slate-700">{budget}h</span></div>
                    </div>
                    <Progress value={assignedPct} className={cn("h-2", belowMinimum ? "bg-red-100 [&>div]:bg-red-500" : "bg-slate-100")} />
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <Tabs defaultValue="operativa" className="w-full">
                    <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-4 h-9">
                        <TabsTrigger value="operativa" className="text-xs h-9 px-3 data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none">Operativa</TabsTrigger>
                        <TabsTrigger value="estrategia" className="text-xs h-9 px-3 data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none">Estrategia OKR</TabsTrigger>
                    </TabsList>

                    <TabsContent value="operativa" className="p-0">
                        <div className="px-4 py-2 bg-slate-50/30">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 mt-2">Pendientes ({pendingTasks.length})</div>
                            {pendingTasks.length > 0 ? (
                                <div className="space-y-1 pb-2">
                                    {pendingTasks.map(task => {
                                        const emp = employees.find(e => e.id === task.employeeId);
                                        return (
                                            <div key={task.id} className="flex items-center justify-between bg-white border rounded px-3 py-2 shadow-sm">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <PlayCircle className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                                    <span className="text-xs font-medium truncate">{task.taskName}</span>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <Badge variant="secondary" className="text-[10px] h-5 font-normal bg-slate-100 text-slate-600">{emp?.name.split(' ')[0]}</Badge>
                                                    <span className="font-mono text-xs font-bold w-10 text-right">{task.hoursAssigned}h</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (<p className="text-xs text-slate-400 italic py-2 text-center">¡Todo al día! No hay tareas pendientes.</p>)}
                        </div>

                        {completedTasks.length > 0 && (
                            <details className="group border-t bg-slate-50">
                                <summary className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-slate-100 transition-colors list-none">
                                    <span className="text-xs font-medium text-emerald-700 flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5" /> Ver {completedTasks.length} tareas completadas</span>
                                    <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-open:rotate-180 transition-transform" />
                                </summary>
                                <div className="px-4 pb-3 space-y-1">
                                    {completedTasks.map(task => {
                                        // Cálculo de ganancia
                                        const real = task.hoursActual || 0;
                                        const computed = task.hoursComputed || 0; // Usamos la nueva propiedad
                                        const gain = computed - real;
                                        
                                        return (
                                        <div key={task.id} className="flex justify-between items-center text-xs text-slate-500 pl-6 py-1 border-l-2 border-emerald-100">
                                            <span className="line-through truncate max-w-[50%]">{task.taskName}</span>
                                            <div className="flex gap-2 font-mono">
                                                <span title="Real" className="text-blue-600">R: {real}h</span>
                                                <span title="Computado" className="text-emerald-600 font-bold">C: {computed}h</span>
                                                {gain !== 0 && (
                                                    <span className={cn("font-bold", gain > 0 ? "text-emerald-500" : "text-red-500")}>
                                                        ({gain > 0 ? '+' : ''}{parseFloat(gain.toFixed(2))})
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            </details>
                        )}
                    </TabsContent>

                    <TabsContent value="estrategia" className="p-4 space-y-4">
                        {(project.okrs || []).length > 0 ? (
                            <div className="space-y-4">
                                {(project.okrs || []).map((okr, idx) => (
                                    <div key={idx} className="space-y-1">
                                        <div className="flex justify-between text-xs">
                                            <span className="font-medium text-slate-700 flex items-center gap-2"><Target className="h-3 w-3 text-indigo-500" /> {okr.title}</span>
                                            <span className="font-bold text-indigo-600">{okr.progress}%</span>
                                        </div>
                                        <Progress value={okr.progress} className="h-1.5" />
                                    </div>
                                ))}
                            </div>
                        ) : (<div className="text-center py-6 border-2 border-dashed rounded-lg"><Target className="h-8 w-8 text-slate-200 mx-auto mb-2" /><p className="text-xs text-slate-400">Sin objetivos definidos. Edita el proyecto para añadir OKRs.</p></div>)}
                    </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{isCreating ? 'Nuevo Proyecto' : 'Editar Proyecto'}</DialogTitle><DialogDescription>Configura los parámetros operativos y estratégicos.</DialogDescription></DialogHeader>
            <div className="grid gap-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Nombre del Proyecto</Label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                    <div className="space-y-2"><Label>Cliente Asociado</Label><Select value={formData.clientId} onValueChange={(val) => setFormData({...formData, clientId: val})}><SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger><SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2"><Label>Horas (Presupuesto)</Label><Input type="number" value={formData.budgetHours} onChange={e => setFormData({...formData, budgetHours: e.target.value})} /></div>
                    <div className="space-y-2"><Label>Horas Mínimas</Label><Input type="number" value={formData.minimumHours} onChange={e => setFormData({...formData, minimumHours: e.target.value})} /></div>
                    <div className="space-y-2"><Label>Fee Mensual (€)</Label><Input type="number" value={formData.monthlyFee} onChange={e => setFormData({...formData, monthlyFee: e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Estado</Label><Select value={formData.status} onValueChange={(val: any) => setFormData({...formData, status: val})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Activo</SelectItem><SelectItem value="archived">Archivado</SelectItem><SelectItem value="completed">Completado</SelectItem></SelectContent></Select></div>
                    <div className="space-y-2"><Label>Salud del Proyecto</Label><Select value={formData.healthStatus} onValueChange={(val: any) => setFormData({...formData, healthStatus: val})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="healthy">🟢 Sano</SelectItem><SelectItem value="needs_attention">🟠 Atención</SelectItem><SelectItem value="at_risk">🔴 En Peligro</SelectItem></SelectContent></Select></div>
                </div>
                <div className="border-t pt-4 space-y-4">
                    <Label className="text-base font-semibold">Estrategia y OKRs</Label>
                    <div className="flex gap-2"><Input placeholder="Nuevo objetivo (ej: +20% Tráfico Orgánico)" value={newOkrTitle} onChange={e => setNewOkrTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addOkrToForm()} /><Button type="button" onClick={addOkrToForm} size="sm"><Plus className="h-4 w-4" /></Button></div>
                    <div className="space-y-3 bg-slate-50 p-3 rounded-lg max-h-40 overflow-y-auto">
                        {formData.okrs.length === 0 && <p className="text-xs text-slate-400 text-center">Sin objetivos.</p>}
                        {formData.okrs.map((okr) => (
                            <div key={okr.id} className="bg-white p-2 rounded border shadow-sm space-y-2">
                                <div className="flex justify-between items-center text-sm"><span className="font-medium">{okr.title}</span><button onClick={() => removeOkr(okr.id)} className="text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button></div>
                                <div className="flex items-center gap-3"><Slider value={[okr.progress]} max={100} step={5} onValueChange={(val) => updateOkrProgress(okr.id, val[0])} className="flex-1" /><span className="text-xs font-bold w-8 text-right">{okr.progress}%</span></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button><Button onClick={handleSave}>Guardar Cambios</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
