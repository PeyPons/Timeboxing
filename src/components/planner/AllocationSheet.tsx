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
import { Plus, Trash2, AlertCircle, Pencil, Clock, CalendarDays, Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getWeeksForMonth } from '@/utils/dateUtils';

interface AllocationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  weekStart: string;
}

// Tipo para el formulario de múltiples tareas
interface NewTaskRow {
  id: string; // ID temporal para la UI
  projectId: string;
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
    updateAllocation,
    deleteAllocation 
  } = useApp();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<Allocation | null>(null);
  
  // Estado para MÚLTIPLES tareas (Añadir)
  const [newTasks, setNewTasks] = useState<NewTaskRow[]>([]);

  // Estados para UNA tarea (Editar)
  const [editProjectId, setEditProjectId] = useState('');
  const [editHours, setEditHours] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editWeek, setEditWeek] = useState('');

  // Control de Combobox abierto (para cada fila en añadir)
  const [openComboboxId, setOpenComboboxId] = useState<string | null>(null);
  // Control de Combobox abierto (para editar)
  const [editComboboxOpen, setEditComboboxOpen] = useState(false);

  const employee = employees.find(e => e.id === employeeId);
  if (!employee) return null;

  const currentMonthDate = new Date(weekStart);
  const monthLabel = currentMonthDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const weeks = getWeeksForMonth(currentMonthDate);

  // Proyectos activos ordenados por nombre para el buscador
  const activeProjects = useMemo(() => 
    projects
      .filter(p => p.status === 'active')
      .sort((a, b) => a.name.localeCompare(b.name)),
  [projects]);

  // --- LOGICA ---

  const startAdd = (initialWeekStr: string) => {
    setEditingAllocation(null);
    // Inicializamos con UNA fila vacía
    setNewTasks([{
      id: crypto.randomUUID(),
      projectId: '',
      hours: '',
      weekDate: initialWeekStr,
      description: ''
    }]);
    setIsFormOpen(true);
  };

  const addTaskRow = () => {
    // Copiamos la semana de la última fila para agilidad
    const lastWeek = newTasks.length > 0 ? newTasks[newTasks.length - 1].weekDate : weekStart;
    setNewTasks(prev => [...prev, {
      id: crypto.randomUUID(),
      projectId: '',
      hours: '',
      weekDate: lastWeek,
      description: ''
    }]);
  };

  const removeTaskRow = (id: string) => {
    if (newTasks.length === 1) return; // Dejar al menos uno
    setNewTasks(prev => prev.filter(t => t.id !== id));
  };

  const updateTaskRow = (id: string, field: keyof NewTaskRow, value: string) => {
    setNewTasks(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const startEdit = (allocation: Allocation) => {
    setEditingAllocation(allocation);
    setEditProjectId(allocation.projectId);
    setEditHours(allocation.hoursAssigned.toString());
    setEditDescription(allocation.description || '');
    setEditWeek(allocation.weekStartDate);
    setIsFormOpen(true);
  };

  const handleSave = () => {
    if (editingAllocation) {
      // Guardar EDICIÓN
      if (!editProjectId || !editHours) return;
      updateAllocation({
        ...editingAllocation,
        projectId: editProjectId,
        weekStartDate: editWeek,
        hoursAssigned: parseFloat(editHours),
        description: editDescription,
      });
    } else {
      // Guardar NUEVAS (Bulk)
      newTasks.forEach(task => {
        if (task.projectId && task.hours) {
          addAllocation({
            employeeId,
            projectId: task.projectId,
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

  const getProjectInfo = (projectId: string) => {
    const hours = getProjectHoursForMonth(projectId, currentMonthDate);
    const project = getProjectById(projectId);
    const client = project ? getClientById(project.clientId) : null;
    return { hours, client };
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-[90vw] overflow-y-auto px-6 bg-slate-50/50 dark:bg-slate-950/50 backdrop-blur-xl">
          <SheetHeader className="pb-6 border-b mb-6">
            <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                    {employee.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                    <SheetTitle className="text-2xl">{employee.name}</SheetTitle>
                    <SheetDescription className="text-base flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        Planificación Mensual - <span className="capitalize text-foreground font-medium">{monthLabel}</span>
                    </SheetDescription>
                </div>
            </div>
          </SheetHeader>

          {/* PARRILLA MENSUAL */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pb-10">
            {weeks.map((week, index) => {
                const weekStr = week.weekStart.toISOString().split('T')[0];
                const weekAllocations = getEmployeeAllocationsForWeek(employeeId, weekStr);
                const load = getEmployeeLoadForWeek(employeeId, weekStr);
                const isCurrent = weekStr === weekStart;

                return (
                    <div 
                        key={weekStr} 
                        className={cn(
                            "flex flex-col gap-4 p-4 rounded-xl border bg-card transition-all",
                            isCurrent ? "ring-2 ring-primary ring-offset-2 shadow-md" : "hover:border-primary/50"
                        )}
                    >
                        {/* Cabecera Semana */}
                        <div className="flex flex-col gap-2 pb-3 border-b">
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-sm text-muted-foreground uppercase tracking-wider">
                                    Semana {index + 1}
                                </span>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-6 w-6 p-0 hover:bg-primary/10 hover:text-primary"
                                    onClick={() => startAdd(weekStr)}
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="flex items-end justify-between">
                                <span className="text-xs text-muted-foreground">{week.weekLabel}</span>
                                <Badge variant="outline" className={cn("font-mono text-xs",
                                    load.status === 'overload' ? "bg-destructive/10 text-destructive" : 
                                    load.status === 'warning' ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
                                )}>
                                    {load.hours}/{load.capacity}h
                                </Badge>
                            </div>
                            <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                                <div 
                                    className={cn("h-full", load.status === 'overload' ? "bg-destructive" : load.status === 'warning' ? "bg-warning" : "bg-success")} 
                                    style={{ width: `${Math.min(load.percentage, 100)}%` }} 
                                />
                            </div>
                        </div>

                        {/* Tareas (Acordeón) */}
                        <div className="flex-1 overflow-y-auto max-h-[60vh] space-y-3 pr-1">
                            {weekAllocations.length === 0 ? (
                                <div className="h-20 flex items-center justify-center text-muted-foreground/30 text-xs italic border-2 border-dashed rounded-lg">Sin tareas</div>
                            ) : (
                                <Accordion type="multiple" className="w-full" defaultValue={Array.from(new Set(weekAllocations.map(a => getProjectById(a.projectId)?.clientId || '')))}>
                                    {Object.entries(
                                        weekAllocations.reduce((acc, allocation) => {
                                            const p = getProjectById(allocation.projectId);
                                            const cid = p?.clientId || 'unknown';
                                            if (!acc[cid]) acc[cid] = [];
                                            acc[cid].push(allocation);
                                            return acc;
                                        }, {} as Record<string, typeof weekAllocations>)
                                    ).map(([clientId, clientAllocations]) => {
                                        const client = getClientById(clientId);
                                        const total = Math.round(clientAllocations.reduce((s, a) => s + a.hoursAssigned, 0) * 100) / 100;

                                        return (
                                            <AccordionItem key={clientId} value={clientId} className="border-b-0 mb-2">
                                                <AccordionTrigger className="py-2 px-0 hover:no-underline justify-start gap-2">
                                                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: client?.color || '#888' }} />
                                                    <span className="text-xs font-bold truncate flex-1 text-left">{client?.name}</span>
                                                    <span className="text-[10px] bg-muted px-1.5 rounded text-muted-foreground">{total}h</span>
                                                </AccordionTrigger>
                                                <AccordionContent className="pb-2 pt-0 space-y-1.5">
                                                    {clientAllocations.map(alloc => {
                                                        const proj = getProjectById(alloc.projectId);
                                                        const isDone = alloc.status === 'completed';
                                                        return (
                                                            <div key={alloc.id} className="flex gap-2 items-start group bg-muted/20 p-1.5 rounded hover:bg-muted/50 transition-colors">
                                                                <Checkbox checked={isDone} onCheckedChange={() => toggleStatus(alloc)} className="mt-0.5 h-3.5 w-3.5" />
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex justify-between items-center gap-1">
                                                                        <span className={cn("text-xs font-medium truncate", isDone && "line-through opacity-50")}>{proj?.name}</span>
                                                                        <span className="text-[10px] font-mono opacity-70">{alloc.hoursAssigned}h</span>
                                                                    </div>
                                                                    {alloc.description && <p className={cn("text-[10px] text-muted-foreground line-clamp-2 leading-tight mt-0.5", isDone && "line-through opacity-50")}>{alloc.description}</p>}
                                                                </div>
                                                                <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 -mr-1" onClick={() => startEdit(alloc)}>
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

      {/* DIÁLOGO AÑADIR/EDITAR (Mejorado) */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className={cn("max-w-[600px] overflow-visible", !editingAllocation ? "max-w-[800px]" : "")}>
          <DialogHeader>
            <DialogTitle>{editingAllocation ? 'Editar Tarea' : 'Añadir Tareas (Bulk Mode)'}</DialogTitle>
            <DialogDescription>
              {editingAllocation 
                ? `Editando tarea de ${employee.name}` 
                : 'Añade múltiples tareas rápidamente. Escribe para buscar proyecto.'}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {editingAllocation ? (
              /* --- MODO EDICIÓN (SIMPLE) --- */
              <div className="grid gap-4">
                <div className="space-y-2 flex flex-col">
                  <Label>Proyecto</Label>
                  <Popover open={editComboboxOpen} onOpenChange={setEditComboboxOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" aria-expanded={editComboboxOpen} className="justify-between">
                        {editProjectId ? activeProjects.find((p) => p.id === editProjectId)?.name : "Seleccionar proyecto..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0">
                      <Command>
                        <CommandInput placeholder="Buscar proyecto..." />
                        <CommandList>
                            <CommandEmpty>No encontrado.</CommandEmpty>
                            <CommandGroup>
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
                                        Semana {i + 1} ({w.weekLabel})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>Descripción</Label>
                    <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} />
                </div>
              </div>
            ) : (
              /* --- MODO AÑADIR MÚLTIPLE (BULK) --- */
              <div className="space-y-3">
                <div className="flex text-xs font-medium text-muted-foreground px-1">
                    <div className="flex-1">Proyecto</div>
                    <div className="w-20 mx-2 text-center">Horas</div>
                    <div className="w-32">Semana</div>
                    <div className="w-8"></div>
                </div>
                
                {newTasks.map((task, index) => (
                    <div key={task.id} className="flex gap-2 items-start animate-in fade-in slide-in-from-top-2 duration-200">
                        {/* Buscador Proyecto */}
                        <div className="flex-1 min-w-0">
                            <Popover open={openComboboxId === task.id} onOpenChange={(isOpen) => setOpenComboboxId(isOpen ? task.id : null)}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" role="combobox" className={cn("w-full justify-between h-9 px-3 text-left font-normal", !task.projectId && "text-muted-foreground")}>
                                        <span className="truncate">{task.projectId ? activeProjects.find((p) => p.id === task.projectId)?.name : "Buscar..."}</span>
                                        <ChevronsUpDown className="ml-2 h-3 w-3 opacity-50 flex-shrink-0" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Escribe para buscar..." />
                                        <CommandList>
                                            <CommandEmpty>No hay proyectos.</CommandEmpty>
                                            <CommandGroup>
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

                        {/* Input Horas */}
                        <Input 
                            type="number" 
                            className="w-20 h-9 text-center px-1" 
                            placeholder="0" 
                            value={task.hours} 
                            onChange={(e) => updateTaskRow(task.id, 'hours', e.target.value)} 
                            step="0.5"
                        />

                        {/* Selector Semana */}
                        <div className="w-32">
                            <Select value={task.weekDate} onValueChange={(v) => updateTaskRow(task.id, 'weekDate', v)}>
                                <SelectTrigger className="h-9 px-2"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {weeks.map((w, i) => (
                                        <SelectItem key={w.weekStart.toISOString()} value={w.weekStart.toISOString().split('T')[0]}>
                                            Sem {i+1}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Botón Borrar Fila */}
                        <Button variant="ghost" size="icon" className="h-9 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeTaskRow(task.id)} disabled={newTasks.length === 1}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                ))}

                <Button variant="outline" size="sm" onClick={addTaskRow} className="w-full mt-2 border-dashed">
                    <Plus className="h-4 w-4 mr-2" /> Añadir otra fila
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>
                {editingAllocation ? 'Guardar Cambios' : `Guardar ${newTasks.filter(t => t.projectId && t.hours).length} Tareas`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
