import { useState } from 'react';
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
import { useApp } from '@/contexts/AppContext';
import { Allocation } from '@/types';
import { Plus, Trash2, AlertCircle, Pencil, Clock, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getWeeksForMonth } from '@/utils/dateUtils';

interface AllocationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  weekStart: string;
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
  
  const [newProjectId, setNewProjectId] = useState('');
  const [newHours, setNewHours] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [selectedWeek, setSelectedWeek] = useState(weekStart);

  const employee = employees.find(e => e.id === employeeId);
  if (!employee) return null;

  // Calculamos el mes y las semanas para mostrar la parrilla completa
  const currentMonthDate = new Date(weekStart);
  const monthLabel = currentMonthDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const weeks = getWeeksForMonth(currentMonthDate);

  // --- LOGICA FORMULARIO ---

  const handleAddAllocation = () => {
    if (!newProjectId || !newHours) return;
    addAllocation({
      employeeId,
      projectId: newProjectId,
      weekStartDate: selectedWeek,
      hoursAssigned: parseFloat(newHours),
      status: 'planned',
      description: newDescription,
    });
    closeForm();
  };

  const handleUpdateAllocation = () => {
    if (!editingAllocation || !newProjectId || !newHours) return;
    updateAllocation({
      ...editingAllocation,
      projectId: newProjectId,
      weekStartDate: selectedWeek,
      hoursAssigned: parseFloat(newHours),
      description: newDescription,
    });
    closeForm();
  };

  const toggleStatus = (allocation: Allocation) => {
    const newStatus = allocation.status === 'completed' ? 'planned' : 'completed';
    updateAllocation({ ...allocation, status: newStatus });
  };

  const startAdd = (weekDateStr: string) => {
    setEditingAllocation(null);
    setNewProjectId('');
    setNewHours('');
    setNewDescription('');
    setSelectedWeek(weekDateStr);
    setIsFormOpen(true);
  };

  const startEdit = (allocation: Allocation) => {
    setEditingAllocation(allocation);
    setNewProjectId(allocation.projectId);
    setNewHours(allocation.hoursAssigned.toString());
    setNewDescription(allocation.description || '');
    setSelectedWeek(allocation.weekStartDate);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingAllocation(null);
    setTimeout(() => {
        setNewProjectId('');
        setNewHours('');
        setNewDescription('');
    }, 300);
  };

  const getProjectAvailableHours = (projectId: string) => {
    return getProjectHoursForMonth(projectId, currentMonthDate);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        {/* CAMBIO CLAVE: Ancho mucho mayor (90vw) para ver todo el mes */}
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

          {/* PARRILLA DE SEMANAS (GRID LAYOUT) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pb-10">
            {weeks.map((week, index) => {
                const weekStr = week.weekStart.toISOString().split('T')[0];
                const allocations = getEmployeeAllocationsForWeek(employeeId, weekStr);
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
                        {/* Cabecera de Semana */}
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
                                <span className="text-xs text-muted-foreground">
                                    {week.weekLabel}
                                </span>
                                <Badge 
                                    variant="outline" 
                                    className={cn(
                                        "font-mono text-xs",
                                        load.status === 'overload' ? "bg-destructive/10 text-destructive border-destructive/20" : 
                                        load.status === 'warning' ? "bg-warning/10 text-warning border-warning/20" :
                                        "bg-success/10 text-success border-success/20"
                                    )}
                                >
                                    {load.hours}/{load.capacity}h
                                </Badge>
                            </div>
                            {/* Barra de progreso mini */}
                            <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                                <div 
                                    className={cn("h-full transition-all", 
                                        load.status === 'overload' ? "bg-destructive" : 
                                        load.status === 'warning' ? "bg-warning" : "bg-success"
                                    )} 
                                    style={{ width: `${Math.min(load.percentage, 100)}%` }} 
                                />
                            </div>
                        </div>

                        {/* Lista de Tareas (Acordeón simplificado) */}
                        <div className="flex-1 overflow-y-auto max-h-[60vh] space-y-3 pr-1">
                            {allocations.length === 0 ? (
                                <div className="h-20 flex items-center justify-center text-muted-foreground/30 text-xs italic border-2 border-dashed rounded-lg">
                                    Sin tareas
                                </div>
                            ) : (
                                <Accordion type="multiple" className="w-full" defaultValue={Array.from(new Set(allocations.map(a => getProjectById(a.projectId)?.clientId || '')))}>
                                    {Object.entries(
                                        allocations.reduce((acc, allocation) => {
                                            const p = getProjectById(allocation.projectId);
                                            const cid = p?.clientId || 'unknown';
                                            if (!acc[cid]) acc[cid] = [];
                                            acc[cid].push(allocation);
                                            return acc;
                                        }, {} as Record<string, typeof allocations>)
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
                                                                <Checkbox 
                                                                    checked={isDone} 
                                                                    onCheckedChange={() => toggleStatus(alloc)}
                                                                    className="mt-0.5 h-3.5 w-3.5"
                                                                />
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex justify-between items-center gap-1">
                                                                        <span className={cn("text-xs font-medium truncate", isDone && "line-through opacity-50")}>
                                                                            {proj?.name}
                                                                        </span>
                                                                        <span className="text-[10px] font-mono opacity-70">{alloc.hoursAssigned}h</span>
                                                                    </div>
                                                                    {alloc.description && (
                                                                        <p className={cn("text-[10px] text-muted-foreground line-clamp-2 leading-tight mt-0.5", isDone && "line-through opacity-50")}>
                                                                            {alloc.description}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <Button 
                                                                    variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 -mr-1"
                                                                    onClick={() => startEdit(alloc)}
                                                                >
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

      {/* DIÁLOGO FLOTANTE (FORMULARIO) - Sin cambios, funciona perfecto */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingAllocation ? 'Editar Tarea' : 'Nueva Tarea'}</DialogTitle>
            <DialogDescription>{employee.name} - {
                weeks.find(w => w.weekStart.toISOString().split('T')[0] === selectedWeek)?.weekLabel
            }</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Proyecto</Label>
              <Select value={newProjectId} onValueChange={setNewProjectId}>
                <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                <SelectContent>
                  {projects.filter(p => p.status === 'active').map((project) => (
                    <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {newProjectId && (() => {
                  const hours = getProjectAvailableHours(newProjectId);
                  const project = getProjectById(newProjectId);
                  const client = project ? getClientById(project.clientId) : null;
                  return (
                    <div className="text-xs text-muted-foreground bg-muted p-2 rounded flex items-center gap-2">
                       <Clock className="h-3 w-3"/>
                       {client?.name}: {hours.available}h disp. ({hours.used}h usados)
                    </div>
                  );
              })()}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Horas</Label>
                <Input type="number" placeholder="0" value={newHours} onChange={(e) => setNewHours(e.target.value)} min="0.1" step="0.1" />
              </div>
              <div className="space-y-2">
                <Label>Semana</Label>
                {/* Selector de semana simplificado para el diálogo */}
                <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {weeks.map((week, index) => (
                      <SelectItem key={week.weekStart.toISOString()} value={week.weekStart.toISOString().split('T')[0]}>
                        Semana {index + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea placeholder="Ej: Redacción contenidos blog..." value={newDescription} onChange={(e) => setNewDescription(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>Cancelar</Button>
            <Button onClick={editingAllocation ? handleUpdateAllocation : handleAddAllocation} disabled={!newProjectId || !newHours}>
              {editingAllocation ? 'Guardar' : 'Añadir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
