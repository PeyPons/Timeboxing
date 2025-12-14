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

  // Estado para controlar si el diálogo de formulario está abierto
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<Allocation | null>(null);
  
  // Estados del formulario
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
    setIsFormOpen(true); // Abrimos el diálogo
  };

  const startEdit = (allocation: Allocation) => {
    setEditingAllocation(allocation);
    setNewProjectId(allocation.projectId);
    setNewHours(allocation.hoursAssigned.toString());
    setNewDescription(allocation.description || '');
    setSelectedWeek(allocation.weekStartDate);
    setIsFormOpen(true); // Abrimos el diálogo
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingAllocation(null);
    // Limpiamos un poco después de cerrar para que la transición sea suave
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
      {/* SHEET PRINCIPAL: Solo muestra la lista y el resumen */}
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

          {/* Botón Añadir (Ahora abre el Dialog) */}
          <Button 
            className="w-full gap-2 mb-4"
            onClick={startAdd}
          >
            <Plus className="h-4 w-4" />
            Añadir horas
          </Button>

          {/* Resumen de Carga */}
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
                  : `Sobrecarga de ${load.hours - load.capacity}h`
                }
              </p>
            )}
          </div>

          {/* Lista de Asignaciones */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">
              Horas asignadas ({allocations.length})
            </h4>
            
            {allocations.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-muted p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No hay horas asignadas esta semana
                </p>
              </div>
            ) : (
              allocations.map((allocation) => {
                const project = getProjectById(allocation.projectId);
                const client = project ? getClientById(project.clientId) : null;
                const projectHours = project ? getProjectHoursForMonth(project.id, weekDate) : null;

                return (
                  <div 
                    key={allocation.id} 
                    className="rounded-lg border bg-card p-3 shadow-sm transition-all hover:shadow-md group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div 
                            className="h-3 w-3 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: client?.color || '#888' }}
                          />
                          <span className="font-medium text-sm truncate">{project?.name}</span>
                          <Badge variant="outline" className="text-sm font-bold ml-auto flex-shrink-0">
                            {allocation.hoursAssigned}h
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 ml-5">{client?.name}</p>
                        {allocation.description && (
                          <p className="text-sm text-foreground/80 mt-2 ml-5">{allocation.description}</p>
                        )}
                        {projectHours && projectHours.percentage > 85 && (
                          <Badge 
                            variant={projectHours.percentage > 100 ? "destructive" : "secondary"}
                            className="mt-2 ml-5 text-xs"
                          >
                            {projectHours.used}h / {projectHours.budget}h cliente
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => startEdit(allocation)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteAllocation(allocation.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* DIALOG FLOTANTE PARA EDITAR/AÑADIR (Arregla el scroll) */}
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
