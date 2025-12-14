import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox'; // Asegúrate de tener este componente
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'; // Y este
import { useApp } from '@/contexts/AppContext';
import { Allocation } from '@/types';
import { Plus, Trash2, AlertCircle, Pencil, Clock, CheckCircle2 } from 'lucide-react';
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
  const allocations = getEmployeeAllocationsForWeek(employeeId, weekStart);
  const load = getEmployeeLoadForWeek(employeeId, weekStart);

  if (!employee) return null;

  const weekDate = new Date(weekStart);
  const weekLabel = weekDate.toLocaleDateString('es-ES', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });

  const currentMonth = new Date(weekStart);
  const weeks = getWeeksForMonth(currentMonth);

  // --- LOGICA DEL FORMULARIO ---

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

  const startAdd = () => {
    setEditingAllocation(null);
    setNewProjectId('');
    setNewHours('');
    setNewDescription('');
    setSelectedWeek(weekStart);
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
    return getProjectHoursForMonth(projectId, weekDate);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto px-4">
          <SheetHeader className="pb-4 border-b mb-4">
            <div className="flex justify-between items-center">
                <div>
                    <SheetTitle className="text-xl">{employee.name}</SheetTitle>
                    <SheetDescription>Semana del {weekLabel}</SheetDescription>
                </div>
                {/* Resumen de carga mini en la cabecera */}
                <div className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold border",
                    load.status === 'overload' ? "bg-destructive/10 text-destructive border-destructive/20" : 
                    load.status === 'warning' ? "bg-warning/10 text-warning border-warning/20" :
                    "bg-success/10 text-success border-success/20"
                )}>
                    {load.hours}h / {load.capacity}h
                </div>
            </div>
          </SheetHeader>

          {/* Botón Añadir Rápido */}
          <Button className="w-full gap-2 mb-6 shadow-sm" onClick={startAdd}>
            <Plus className="h-4 w-4" /> Añadir Tarea
          </Button>

          {/* LISTA AGRUPADA (ACORDEÓN) */}
          <div className="space-y-4">
            {allocations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground border-2 border-dashed rounded-xl bg-muted/20">
                <CheckCircle2 className="h-10 w-10 mb-2 opacity-20" />
                <p className="text-sm">Todo limpio por aquí</p>
              </div>
            ) : (
              <Accordion type="multiple" className="w-full space-y-3" defaultValue={
                  // Por defecto abrimos todos los clientes con tareas activas
                  Array.from(new Set(allocations.map(a => {
                      const p = getProjectById(a.projectId);
                      return p?.clientId || '';
                  })))
              }>
                {Object.entries(
                  allocations.reduce((acc, allocation) => {
                    const project = getProjectById(allocation.projectId);
                    const clientId = project?.clientId || 'unknown';
                    if (!acc[clientId]) acc[clientId] = [];
                    acc[clientId].push(allocation);
                    return acc;
                  }, {} as Record<string, typeof allocations>)
                ).map(([clientId, clientAllocations]) => {
                  const client = getClientById(clientId);
                  const clientTotalHours = Math.round((clientAllocations.reduce((sum, a) => sum + a.hoursAssigned, 0) + Number.EPSILON) * 100) / 100;

                  return (
                    <AccordionItem key={clientId} value={clientId} className="border rounded-lg bg-card shadow-sm px-1">
                      <AccordionTrigger className="px-3 py-3 hover:no-underline">
                        <div className="flex items-center gap-3 w-full">
                          <div className="h-3 w-3 rounded-full shadow-sm flex-shrink-0" style={{ backgroundColor: client?.color || '#888' }} />
                          <span className="font-bold text-sm text-foreground truncate flex-1 text-left">
                            {client?.name || 'Sin Cliente'}
                          </span>
                          <Badge variant="secondary" className="text-xs font-normal ml-2 mr-2">
                            {clientTotalHours}h
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-3 pb-3 pt-0">
                        <div className="space-y-1">
                          {clientAllocations.map((allocation) => {
                            const project = getProjectById(allocation.projectId);
                            const isCompleted = allocation.status === 'completed';

                            return (
                              <div 
                                key={allocation.id} 
                                className={cn(
                                    "group flex items-start gap-3 p-2 rounded-md transition-all border border-transparent hover:border-border hover:bg-muted/40",
                                    isCompleted && "opacity-60"
                                )}
                              >
                                {/* Checkbox de Estado */}
                                <Checkbox 
                                    checked={isCompleted}
                                    onCheckedChange={() => toggleStatus(allocation)}
                                    className="mt-1 data-[state=checked]:bg-primary/50 data-[state=checked]:border-primary/50"
                                />

                                <div className="flex-1 min-w-0 grid gap-0.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className={cn("text-sm font-medium leading-none", isCompleted && "line-through text-muted-foreground")}>
                                        {project?.name}
                                    </span>
                                    <span className="text-xs font-bold font-mono text-muted-foreground flex-shrink-0">
                                        {allocation.hoursAssigned}h
                                    </span>
                                  </div>
                                  
                                  {allocation.description && (
                                    <p className={cn("text-xs text-muted-foreground line-clamp-2", isCompleted && "line-through")}>
                                      {allocation.description}
                                    </p>
                                  )}
                                </div>

                                {/* Botones Edit/Delete (Solo visibles al hover) */}
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(allocation)}>
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => deleteAllocation(allocation.id)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* --- DIÁLOGO FLOTANTE (FORMULARIO) --- */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingAllocation ? 'Editar Tarea' : 'Nueva Tarea'}</DialogTitle>
            <DialogDescription>{employee.name} - Semana del {weekLabel}</DialogDescription>
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
              {/* Info horas disponibles */}
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
                <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {weeks.map((week, index) => (
                      <SelectItem key={week.weekStart.toISOString()} value={week.weekStart.toISOString().split('T')[0]}>
                        Sem {index + 1} ({week.weekLabel})
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
