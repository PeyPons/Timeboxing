import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/contexts/AppContext';
import { Allocation } from '@/types';
import { Plus, Trash2, AlertCircle, Pencil, Clock } from 'lucide-react';
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

  // Estado para el diálogo modal (Formulario)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<Allocation | null>(null);
  
  // Estados de los campos del formulario
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

  // --- MANEJADORES DEL FORMULARIO ---

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
    // Limpieza con retardo para suavizar la animación de cierre
    setTimeout(() => {
        setNewProjectId('');
        setNewHours('');
        setNewDescription('');
    }, 300);
  };

  const getProjectAvailableHours = (projectId: string) => {
    const projectHours = getProjectHoursForMonth(projectId, weekDate);
    return projectHours;
  };

  return (
    <>
      {/* --- PANEL LATERAL (LISTA Y RESUMEN) --- */}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-xl">
              {employee.name}
            </SheetTitle>
            <SheetDescription>
              Semana del {weekLabel}
            </SheetDescription>
          </SheetHeader>

          {/* Botón Añadir Principal */}
          <Button 
            className="w-full gap-2 mb-4"
            onClick={startAdd}
          >
            <Plus className="h-4 w-4" />
            Añadir horas
          </Button>

          {/* Tarjeta de Resumen de Carga */}
          <div className={cn(
            "rounded-lg border-2 p-4 mb-4",
            load.status === 'overload' && "border-destructive bg-destructive/5",
            load.status === 'warning' && "border-warning bg-warning/5",
            load.status === 'healthy' && "border-success bg-success/5",
            load.status === 'empty' && "border-muted bg-muted/5"
          )}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Carga semanal</span>
              <span className={cn(
                "text-lg font-bold",
                load.status === 'overload' && "text-destructive",
                load.status === 'warning' && "text-warning",
                load.status === 'healthy' && "text-success"
              )}>
                {load.hours}h / {load.capacity}h
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div 
                className={cn(
                  "h-full transition-all duration-300",
                  load.status === 'overload' && "bg-destructive",
                  load.status === 'warning' && "bg-warning",
                  load.status === 'healthy' && "bg-success",
                  load.status === 'empty' && "bg-muted-foreground/20"
                )}
                style={{ width: `${Math.min(load.percentage, 100)}%` }}
              />
            </div>
            {load.status === 'overload' && (
              <p className="mt-2 flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" />
                {load.capacity === 0 
                  ? `Sin capacidad disponible (${load.hours}h asignadas)`
                  : `Sobrecarga de ${Number((load.hours - load.capacity).toFixed(2))}h`
                }
              </p>
            )}
          </div>

          {/* LISTA AGRUPADA POR CLIENTE */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">
              Desglose por Cliente
            </h4>
            
            {allocations.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-muted p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No hay horas asignadas esta semana
                </p>
              </div>
            ) : (
              Object.entries(
                // Agrupamos las asignaciones por ID de cliente
                allocations.reduce((acc, allocation) => {
                  const project = getProjectById(allocation.projectId);
                  const clientId = project?.clientId || 'unknown';
                  if (!acc[clientId]) acc[clientId] = [];
                  acc[clientId].push(allocation);
                  return acc;
                }, {} as Record<string, typeof allocations>)
              ).map(([clientId, clientAllocations]) => {
                const client = getClientById(clientId);
                // Total horas por cliente en esta vista (redondeado)
                const clientTotalHours = Math.round((clientAllocations.reduce((sum, a) => sum + a.hoursAssigned, 0) + Number.EPSILON) * 100) / 100;

                return (
                  <div key={clientId} className="space-y-2">
                    {/* Cabecera del Cliente */}
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-3 w-3 rounded-full shadow-sm" 
                          style={{ backgroundColor: client?.color || '#888' }}
                        />
                        <span className="font-bold text-sm text-foreground">
                          {client?.name || 'Sin Cliente'}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {clientTotalHours}h total
                      </span>
                    </div>

                    {/* Lista de Tareas de este Cliente */}
                    <div className="grid gap-2">
                      {clientAllocations.map((allocation) => {
                        const project = getProjectById(allocation.projectId);
                        const projectHours = project ? getProjectHoursForMonth(project.id, weekDate) : null;

                        return (
                          <div 
                            key={allocation.id} 
                            className="rounded-lg border bg-card p-3 shadow-sm transition-all hover:shadow-md group relative overflow-hidden"
                          >
                            {/* Borde izquierdo de color */}
                            <div 
                              className="absolute left-0 top-0 bottom-0 w-1" 
                              style={{ backgroundColor: client?.color || '#888' }}
                            />
                            
                            <div className="flex items-start justify-between gap-2 pl-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm truncate">{project?.name}</span>
                                  <Badge variant="secondary" className="text-xs font-bold ml-auto flex-shrink-0 h-6">
                                    {allocation.hoursAssigned}h
                                  </Badge>
                                </div>
                                
                                {allocation.description && (
                                  <p className="text-sm text-muted-foreground mt-1.5 leading-snug">
                                    {allocation.description}
                                  </p>
                                )}

                                {/* Alerta de presupuesto si aplica */}
                                {projectHours && projectHours.percentage > 100 && (
                                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-destructive font-medium bg-destructive/5 p-1 rounded w-fit">
                                    <AlertCircle className="h-3 w-3" />
                                    Presupuesto excedido ({projectHours.used}h / {projectHours.budget}h)
                                  </div>
                                )}
                              </div>

                              {/* Botones de acción */}
                              <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                  onClick={() => startEdit(allocation)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => deleteAllocation(allocation.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* --- DIÁLOGO FLOTANTE (AÑADIR/EDITAR) --- */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingAllocation ? 'Editar horas' : 'Añadir horas'}
            </DialogTitle>
            <DialogDescription>
              {employee.name} - Semana del {weekLabel}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Selector de Proyecto */}
            <div className="space-y-2">
              <Label>Proyecto</Label>
              <Select value={newProjectId} onValueChange={setNewProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un proyecto" />
                </SelectTrigger>
                <SelectContent>
                  {projects.filter(p => p.status === 'active').map((project) => {
                    const client = getClientById(project.clientId);
                    return (
                      <SelectItem key={project.id} value={project.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="h-2 w-2 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: client?.color || '#888' }}
                          />
                          <span>{project.name}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              
              {/* Info de horas disponibles del proyecto */}
              {newProjectId && (
                <div className="flex items-center gap-2 text-xs p-2 rounded-md bg-muted/50">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  {(() => {
                    const hours = getProjectAvailableHours(newProjectId);
                    const project = getProjectById(newProjectId);
                    const client = project ? getClientById(project.clientId) : null;
                    return (
                      <span className={cn(
                        hours.available <= 0 ? "text-destructive" : "text-muted-foreground"
                      )}>
                        <span className="font-medium">{client?.name}:</span> {hours.available}h disp. ({hours.used}h / {hours.budget}h)
                      </span>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Horas</Label>
                <Input 
                  type="number" 
                  placeholder="Ej: 8"
                  value={newHours}
                  onChange={(e) => setNewHours(e.target.value)}
                  min="0.5"
                  step="0.5"
                />
              </div>

              <div className="space-y-2">
                <Label>Semana</Label>
                <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
              <Label>Descripción (opcional)</Label>
              <Textarea 
                placeholder="Describe la tarea..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>Cancelar</Button>
            <Button 
              onClick={editingAllocation ? handleUpdateAllocation : handleAddAllocation}
              disabled={!newProjectId || !newHours}
            >
              {editingAllocation ? 'Guardar cambios' : 'Añadir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
