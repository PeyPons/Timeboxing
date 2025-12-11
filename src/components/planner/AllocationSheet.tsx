import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/contexts/AppContext';
import { Allocation, Employee } from '@/types';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    clients,
    getEmployeeAllocationsForWeek, 
    getEmployeeLoadForWeek,
    getProjectById,
    getClientById,
    getClientHoursForMonth,
    addAllocation,
    deleteAllocation 
  } = useApp();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newProjectId, setNewProjectId] = useState('');
  const [newHours, setNewHours] = useState('');
  const [newDescription, setNewDescription] = useState('');

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

  const handleAddAllocation = () => {
    if (!newProjectId || !newHours) return;

    addAllocation({
      employeeId,
      projectId: newProjectId,
      weekStartDate: weekStart,
      hoursAssigned: parseFloat(newHours),
      status: 'planned',
      description: newDescription,
    });

    setNewProjectId('');
    setNewHours('');
    setNewDescription('');
    setShowAddForm(false);
  };

  const getClientBudgetWarning = (projectId: string) => {
    const project = getProjectById(projectId);
    if (!project) return null;
    
    const clientHours = getClientHoursForMonth(project.clientId, weekDate);
    if (clientHours.percentage > 100) {
      return {
        message: `Presupuesto excedido: ${clientHours.used}h / ${clientHours.budget}h`,
        isWarning: true,
      };
    } else if (clientHours.percentage > 85) {
      return {
        message: `${clientHours.used}h / ${clientHours.budget}h usadas`,
        isWarning: false,
      };
    }
    return null;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[450px] sm:max-w-[450px] overflow-y-auto">
        <SheetHeader className="pb-6">
          <SheetTitle className="text-xl">
            Asignaciones de {employee.name}
          </SheetTitle>
          <SheetDescription>
            Semana del {weekLabel}
          </SheetDescription>
          
          {/* Load Summary */}
          <div className={cn(
            "mt-4 rounded-lg border-2 p-4",
            load.status === 'overload' && "border-destructive bg-destructive/5",
            load.status === 'warning' && "border-warning bg-warning/5",
            load.status === 'healthy' && "border-success bg-success/5",
            load.status === 'empty' && "border-muted bg-muted/5"
          )}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Carga de trabajo</span>
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
                Sobrecarga de {load.hours - load.capacity}h
              </p>
            )}
          </div>
        </SheetHeader>

        {/* Allocations List */}
        <div className="space-y-3">
          {allocations.length === 0 && !showAddForm ? (
            <div className="rounded-lg border-2 border-dashed border-muted p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No hay asignaciones para esta semana
              </p>
            </div>
          ) : (
            allocations.map((allocation) => {
              const project = getProjectById(allocation.projectId);
              const client = project ? getClientById(project.clientId) : null;
              const budgetWarning = getClientBudgetWarning(allocation.projectId);

              return (
                <div 
                  key={allocation.id} 
                  className="rounded-lg border bg-card p-4 shadow-sm transition-all hover:shadow-md animate-scale-in"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-3 w-3 rounded-full" 
                          style={{ backgroundColor: client?.color || '#888' }}
                        />
                        <span className="font-medium text-sm">{project?.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{client?.name}</p>
                      {allocation.description && (
                        <p className="text-sm text-foreground/80 mt-2">{allocation.description}</p>
                      )}
                      {budgetWarning && (
                        <Badge 
                          variant={budgetWarning.isWarning ? "destructive" : "secondary"}
                          className="mt-2 text-xs"
                        >
                          {budgetWarning.message}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-lg font-bold">
                        {allocation.hoursAssigned}h
                      </Badge>
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

        {/* Add Form */}
        {showAddForm ? (
          <div className="mt-4 space-y-4 rounded-lg border bg-accent/30 p-4 animate-slide-up">
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
                            className="h-2 w-2 rounded-full" 
                            style={{ backgroundColor: client?.color || '#888' }}
                          />
                          {project.name}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

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
              <Label>Descripción (opcional)</Label>
              <Textarea 
                placeholder="Describe la tarea..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleAddAllocation}
                disabled={!newProjectId || !newHours}
                className="flex-1"
              >
                Guardar
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowAddForm(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button 
            variant="outline" 
            className="mt-4 w-full gap-2"
            onClick={() => setShowAddForm(true)}
          >
            <Plus className="h-4 w-4" />
            Añadir asignación
          </Button>
        )}
      </SheetContent>
    </Sheet>
  );
}
