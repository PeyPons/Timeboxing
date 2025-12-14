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
  const weekLabel = weekDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const weeks = getWeeksForMonth(new Date(weekStart));

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
  };

  const getProjectAvailableHours = (projectId: string) => {
    return getProjectHoursForMonth(projectId, weekDate);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-xl">{employee.name}</SheetTitle>
            <SheetDescription>Semana del {weekLabel}</SheetDescription>
          </SheetHeader>

          <Button className="w-full gap-2 mb-4" onClick={startAdd}>
            <Plus className="h-4 w-4" /> Añadir horas
          </Button>

          <div className={cn("rounded-lg border-2 p-4 mb-4", 
            load.status === 'overload' && "border-destructive bg-destructive/5",
            load.status === 'warning' && "border-warning bg-warning/5",
            load.status === 'healthy' && "border-success bg-success/5",
            load.status === 'empty' && "border-muted bg-muted/5"
          )}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Carga semanal</span>
              <span className={cn("text-lg font-bold",
                load.status === 'overload' && "text-destructive",
                load.status === 'warning' && "text-warning",
                load.status === 'healthy' && "text-success"
              )}>{load.hours}h / {load.capacity}h</span>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Horas asignadas ({allocations.length})</h4>
            {allocations.map((allocation) => {
              const project = getProjectById(allocation.projectId);
              const client = project ? getClientById(project.clientId) : null;
              return (
                <div key={allocation.id} className="rounded-lg border bg-card p-3 shadow-sm hover:shadow-md group">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: client?.color || '#888' }} />
                        <span className="font-medium text-sm truncate">{project?.name}</span>
                        <Badge variant="outline" className="text-sm font-bold ml-auto flex-shrink-0">{allocation.hoursAssigned}h</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 ml-5">{client?.name}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-foreground" onClick={() => startEdit(allocation)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => deleteAllocation(allocation.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingAllocation ? 'Editar horas' : 'Añadir horas'}</DialogTitle>
            <DialogDescription>{employee.name} - Semana del {weekLabel}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Proyecto</Label>
              <Select value={newProjectId} onValueChange={setNewProjectId}>
                <SelectTrigger><SelectValue placeholder="Selecciona un proyecto" /></SelectTrigger>
                <SelectContent>
                  {projects.filter(p => p.status === 'active').map((project) => (
                    <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Horas</Label>
                <Input type="number" placeholder="Ej: 8" value={newHours} onChange={(e) => setNewHours(e.target.value)} min="0.5" step="0.5" />
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
              <Textarea placeholder="Describe la tarea..." value={newDescription} onChange={(e) => setNewDescription(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>Cancelar</Button>
            <Button onClick={editingAllocation ? handleUpdateAllocation : handleAddAllocation} disabled={!newProjectId || !newHours}>
              {editingAllocation ? 'Guardar cambios' : 'Añadir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
