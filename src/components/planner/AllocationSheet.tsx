import { useState, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useApp } from '@/contexts/AppContext';
import { Allocation } from '@/types';
import { Plus, Pencil, Clock, CalendarDays, Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getWeeksForMonth } from '@/utils/dateUtils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AllocationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  weekStart: string;
}

// Tipo para el formulario de múltiples tareas
interface NewTaskRow {
  id: string;
  projectId: string;
  taskName: string; // ✅ NUEVO CAMPO
  hours: string;
  weekDate: string;
  description: string;
}

export function AllocationSheet({ open, onOpenChange, employeeId, weekStart }: AllocationSheetProps) {
  const { 
    employees, 
    projects, 
    getEmployeeAllocationsForWeek, 
    getEmployeeLoadForWeek,
    getProjectById,
    getClientById,
    getProjectHoursForMonth,
    addAllocation,
    updateAllocation
  } = useApp();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<Allocation | null>(null);
  
  // Estado para MÚLTIPLES tareas (Añadir)
  const [newTasks, setNewTasks] = useState<NewTaskRow[]>([]);

  // Estados para UNA tarea (Editar)
  const [editProjectId, setEditProjectId] = useState('');
  const [editTaskName, setEditTaskName] = useState(''); // ✅ NUEVO CAMPO
  const [editHours, setEditHours] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editWeek, setEditWeek] = useState('');

  // Control de Combobox abierto
  const [openComboboxId, setOpenComboboxId] = useState<string | null>(null);
  const [editComboboxOpen, setEditComboboxOpen] = useState(false);

  const employee = employees.find(e => e.id === employeeId);
  if (!employee) return null;

  const currentMonthDate = new Date(weekStart);
  const monthLabel = currentMonthDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const weeks = getWeeksForMonth(currentMonthDate);

  const activeProjects = useMemo(() => 
    projects
      .filter(p => p.status === 'active')
      .sort((a, b) => a.name.localeCompare(b.name)),
  [projects]);

  // --- LOGICA ---

  const startAdd = (initialWeekStr: string) => {
    setEditingAllocation(null);
    setNewTasks([{
      id: crypto.randomUUID(),
      projectId: '',
      taskName: '',
      hours: '',
      weekDate: initialWeekStr,
      description: ''
    }]);
    setIsFormOpen(true);
  };

  const addTaskRow = () => {
    const lastTask = newTasks.length > 0 ? newTasks[newTasks.length - 1] : null;
    setNewTasks(prev => [...prev, {
      id: crypto.randomUUID(),
      projectId: lastTask ? lastTask.projectId : '', 
      taskName: '',
      hours: '',
      weekDate: lastTask ? lastTask.weekDate : weekStart,
      description: ''
    }]);
  };

  const removeTaskRow = (id: string) => {
    if (newTasks.length === 1) return; 
    setNewTasks(prev => prev.filter(t => t.id !== id));
  };

  const updateTaskRow = (id: string, field: keyof NewTaskRow, value: string) => {
    setNewTasks(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const startEdit = (allocation: Allocation) => {
    setEditingAllocation(allocation);
    setEditProjectId(allocation.projectId);
    setEditTaskName(allocation.taskName || ''); // Cargar nombre
    setEditHours(allocation.hoursAssigned.toString());
    setEditDescription(allocation.description || '');
    setEditWeek(allocation.weekStartDate);
    setIsFormOpen(true);
  };

  const handleSave = () => {
    if (editingAllocation) {
      if (!editProjectId || !editHours) return;
      updateAllocation({
        ...editingAllocation,
        projectId: editProjectId,
        taskName: editTaskName, // Guardar nombre
        weekStartDate: editWeek,
        hoursAssigned: parseFloat(editHours),
        description: editDescription,
      });
    } else {
      newTasks.forEach(task => {
        if (task.projectId && task.hours) {
          addAllocation({
            employeeId,
            projectId: task.projectId,
            taskName: task.taskName, // Guardar nombre
            weekStartDate: task.weekDate,
            hoursAssigned: parseFloat(task.hours),
            status: 'planned',
            description: task.description,
          });
        }
      });
    }
    setIsFormOpen(false);
  };

  const toggleStatus = (allocation: Allocation) => {
    const newStatus = allocation.status === 'completed' ? 'planned' : 'completed';
    updateAllocation({ ...allocation, status: newStatus });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-[95vw] overflow-y-auto px-6 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-xl border-l shadow-2xl pt-10">
          <SheetHeader className="pb-6 border-b mb-6 space-y-4">
            <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl shadow-sm border border-primary/20">
                    {employee.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                    <SheetTitle className="text-3xl font-bold tracking-tight text-foreground">{employee.name}</SheetTitle>
                    <SheetDescription className="text-base flex items-center gap-2 mt-1">
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                        Planificación Mensual - <span className="capitalize text-foreground font-medium">{monthLabel}</span>
                    </SheetDescription>
                </div>
            </div>
          </SheetHeader>

          {/* PARRILLA MENSUAL (Mantenida intacta) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pb-20">
            {weeks.map((week, index) => {
                const weekStr = week.weekStart.toISOString().split('T')[0];
                const weekAllocations = getEmployeeAllocationsForWeek(employeeId, weekStr);
                const load = getEmployeeLoadForWeek(employeeId, weekStr, week.effectiveStart, week.effectiveEnd);
                const isCurrent = weekStr === weekStart;

                return (
                    <div key={weekStr} className={cn("flex flex-col gap-4 p-4 rounded-xl border bg-card transition-all h-full", isCurrent ? "ring-2 ring-primary ring-offset-2 shadow-lg scale-[1.01]" : "hover:border-primary/30 hover:shadow-md")}>
                        <div className="flex flex-col gap-3 pb-3 border-b">
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-sm text-foreground/80 uppercase tracking-wider">
                                    Semana {index + 1}
                                </span>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-primary hover:text-primary-foreground rounded-full transition-colors" onClick={() => startAdd(weekStr)}>
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded">
                                    {/* ✅ FECHAS LEGIBLES EN LA VISTA DE COLUMNAS TAMBIÉN */}
                                    {format(week.effectiveStart!, 'd MMM', { locale: es })} - {format(week.effectiveEnd!, 'd MMM', { locale: es })}
                                </span>
                                <Badge variant="outline" className={cn("font-mono text-xs px-2 py-0.5 h-auto", load.status === 'overload' ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success")}>
                                    {load.hours} / {load.capacity}h
                                </Badge>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                <div className={cn("h-full transition-all duration-500 ease-out", load.status === 'overload' ? "bg-destructive" : "bg-success")} style={{ width: `${Math.min(load.percentage, 100)}%` }} />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto max-h-[65vh] space-y-2 pr-1 custom-scrollbar">
                            {weekAllocations.length === 0 ? (
                                <div className="h-32 flex flex-col items-center justify-center text-muted-foreground/30 text-xs italic border-2 border-dashed rounded-lg bg-muted/5">
                                    <Clock className="h-8 w-8 mb-2 opacity-20" />
                                    <span>Sin tareas asignadas</span>
                                </div>
                            ) : (
                                <Accordion type="multiple" className="w-full space-y-2" defaultValue={Array.from(new Set(weekAllocations.map(a => getProjectById(a.projectId)?.clientId || '')))}>
                                    {Object.entries(weekAllocations.reduce((acc, a) => {
                                            const cid = getProjectById(a.projectId)?.clientId || 'unknown';
                                            if (!acc[cid]) acc[cid] = [];
                                            acc[cid].push(a); return acc;
                                        }, {} as Record<string, typeof weekAllocations>)).map(([clientId, clientAllocations]) => {
                                        const client = getClientById(clientId);
                                        return (
                                            <AccordionItem key={clientId} value={clientId} className="border rounded-lg bg-background/50 shadow-sm px-0 overflow-hidden">
                                                <AccordionTrigger className="py-2 px-3 hover:bg-muted/30 hover:no-underline justify-start gap-2 border-b border-border/50">
                                                    <div className="h-2.5 w-2.5 rounded-full shadow-sm" style={{ backgroundColor: client?.color || '#888' }} />
                                                    <span className="text-xs font-bold truncate flex-1 text-left text-foreground/90">{client?.name}</span>
                                                </AccordionTrigger>
                                                <AccordionContent className="pb-1 pt-1 px-1 bg-muted/10 space-y-1">
                                                    {clientAllocations.map(alloc => {
                                                        const proj = getProjectById(alloc.projectId);
                                                        const isDone = alloc.status === 'completed';
                                                        return (
                                                            <div key={alloc.id} className="flex gap-2 items-start group p-2 rounded-md transition-all hover:bg-background hover:shadow-sm border border-transparent hover:border-border/50">
                                                                <Checkbox checked={isDone} onCheckedChange={() => toggleStatus(alloc)} className="mt-0.5 h-3.5 w-3.5" />
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex justify-between items-start gap-1">
                                                                        <div className="flex flex-col min-w-0">
                                                                            <span className="text-[10px] text-muted-foreground truncate uppercase tracking-wider">{proj?.name}</span>
                                                                            <span className={cn("text-xs font-medium truncate", isDone && "line-through opacity-70")}>
                                                                                 {/* ✅ AQUI MOSTRAMOS EL NOMBRE DE LA TAREA */}
                                                                                {alloc.taskName || 'Tarea General'}
                                                                            </span>
                                                                        </div>
                                                                        <span className="text-[10px] font-bold font-mono opacity-80 bg-muted/50 px-1 rounded ml-1 whitespace-nowrap">{alloc.hoursAssigned}h</span>
                                                                    </div>
                                                                </div>
                                                                <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100" onClick={() => startEdit(alloc)}>
                                                                    <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
                                                                </Button>
                                                            </div>
                                                        );
                                                    })}
                                                </AccordionContent>
                                            </AccordionItem>
                                        );
                                    })}
                                </Accordion>
                            )}
                        </div>
                    </div>
                );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {/* DIÁLOGO AÑADIR/EDITAR (Bulk Mode MANTENIDO) */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className={cn("max-w-[650px] overflow-visible gap-0 p-0", !editingAllocation ? "max-w-[900px]" : "")}>
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>{editingAllocation ? 'Editar Tarea' : 'Añadir Tareas (Bulk Mode)'}</DialogTitle>
            <DialogDescription>{editingAllocation ? `Editando tarea de ${employee.name}` : 'Añade múltiples tareas rápidamente.'}</DialogDescription>
          </DialogHeader>

          <div className="p-6 pt-2">
            {editingAllocation ? (
              /* --- MODO EDICIÓN SIMPLE --- */
              <div className="grid gap-4 mt-4">
                <div className="space-y-2 flex flex-col">
                  <Label>Proyecto</Label>
                  <Popover open={editComboboxOpen} onOpenChange={setEditComboboxOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="justify-between w-full">
                        {editProjectId ? activeProjects.find((p) => p.id === editProjectId)?.name : "Seleccionar proyecto..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar proyecto..." />
                        <CommandList>
                            <CommandEmpty>No encontrado.</CommandEmpty>
                            <CommandGroup className="max-h-[300px] overflow-y-auto">
                            {activeProjects.map((project) => (
                                <CommandItem key={project.id} value={project.name} onSelect={() => { setEditProjectId(project.id); setEditComboboxOpen(false); }}>
                                <Check className={cn("mr-2 h-4 w-4", editProjectId === project.id ? "opacity-100" : "opacity-0")} />
                                {project.name}
                                </CommandItem>
                            ))}
                            </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                {/* ✅ INPUT PARA NOMBRE DE TAREA */}
                <div className="space-y-2">
                    <Label>Nombre de la Tarea</Label>
                    <Input placeholder="Ej: Maquetación, Diseño..." value={editTaskName} onChange={(e) => setEditTaskName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Horas</Label>
                        <Input type="number" value={editHours} onChange={(e) => setEditHours(e.target.value)} step="0.5" />
                    </div>
                    <div className="space-y-2">
                        <Label>Semana</Label>
                        <Select value={editWeek} onValueChange={setEditWeek}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {weeks.map((w, i) => (
                                    <SelectItem key={w.weekStart.toISOString()} value={w.weekStart.toISOString().split('T')[0]}>
                                        {/* ✅ FECHA EN DESPLEGABLE */}
                                        Sem {i + 1} ({format(w.effectiveStart!, 'd MMM', { locale: es })} - {format(w.effectiveEnd!, 'd MMM', { locale: es })})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>Descripción (Opcional)</Label>
                    <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} />
                </div>
              </div>
            ) : (
              /* --- MODO BULK --- */
              <div className="space-y-3 mt-4">
                <div className="flex text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-2">
                    <div className="flex-1 pl-1">Proyecto</div>
                    <div className="flex-1 pl-1">Tarea</div> {/* ✅ CABECERA NUEVA */}
                    <div className="w-20 mx-2 text-center">Horas</div>
                    <div className="w-36">Semana</div>
                    <div className="w-8"></div>
                </div>
                
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2 -mr-2">
                    {newTasks.map((task, index) => (
                        <div key={task.id} className="flex gap-2 items-start animate-in fade-in slide-in-from-top-1 duration-200">
                            {/* Buscador Proyecto */}
                            <div className="flex-1 min-w-0">
                                <Popover open={openComboboxId === task.id} onOpenChange={(isOpen) => setOpenComboboxId(isOpen ? task.id : null)}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" className={cn("w-full justify-between h-10 px-3 text-left font-normal bg-muted/30 hover:bg-muted/50 border-input/50", !task.projectId && "text-muted-foreground")}>
                                            <span className="truncate">{task.projectId ? activeProjects.find((p) => p.id === task.projectId)?.name : "Buscar..."}</span>
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
                                                            {project.name}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {/* ✅ INPUT NOMBRE TAREA */}
                            <Input 
                                className="flex-1 h-10 px-2 bg-muted/30 border-input/50" 
                                placeholder="Nombre tarea..." 
                                value={task.taskName} 
                                onChange={(e) => updateTaskRow(task.id, 'taskName', e.target.value)} 
                            />

                            <Input 
                                type="number" 
                                className="w-20 h-10 text-center px-1 font-mono bg-muted/30 border-input/50" 
                                placeholder="0" 
                                value={task.hours} 
                                onChange={(e) => updateTaskRow(task.id, 'hours', e.target.value)} 
                                step="0.5"
                            />

                            <div className="w-36">
                                <Select value={task.weekDate} onValueChange={(v) => updateTaskRow(task.id, 'weekDate', v)}>
                                    <SelectTrigger className="h-10 px-2 bg-muted/30 border-input/50"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {weeks.map((w, i) => (
                                            <SelectItem key={w.weekStart.toISOString()} value={w.weekStart.toISOString().split('T')[0]}>
                                                {/* ✅ FECHA EN DESPLEGABLE BULK */}
                                                Sem {i+1} ({format(w.effectiveStart!, 'd MMM', { locale: es })})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => removeTaskRow(task.id)} disabled={newTasks.length === 1}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>

                <Button variant="outline" size="sm" onClick={addTaskRow} className="w-full mt-4 border-dashed h-10 hover:bg-primary/5 hover:text-primary hover:border-primary/30">
                    <Plus className="h-4 w-4 mr-2" /> Añadir otra fila
                </Button>
              </div>
            )}
          </div>
          <DialogFooter className="p-6 pt-2 bg-muted/10 border-t">
            <Button variant="ghost" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>
                {editingAllocation ? 'Guardar Cambios' : `Guardar ${newTasks.filter(t => t.projectId && t.hours).length} Tareas`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
