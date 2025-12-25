import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { format, startOfWeek, addDays, isSameWeek, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Briefcase, AlertCircle, CheckCircle2, Circle, PlusCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface MyWeekViewProps {
  employeeId: string;
}

export function MyWeekView({ employeeId }: MyWeekViewProps) {
  const { allocations, projects, clients, updateAllocation, addAllocation } = useApp();
  
  const today = new Date();
  const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 });
  const [dependencyId, setDependencyId] = useState<string>('none');
  const mondayDate = startOfCurrentWeek;
  const fridayDate = addDays(startOfCurrentWeek, 4);
  const weekLabel = `Semana del ${format(mondayDate, 'd', { locale: es })} al ${format(fridayDate, 'd ' + (mondayDate.getMonth() !== fridayDate.getMonth() ? 'MMM' : ''), { locale: es })} de ${format(fridayDate, 'MMMM', { locale: es })}`;

  const myAllocations = allocations.filter(a => {
    const allocDate = parseISO(a.weekStartDate);
    return a.employeeId === employeeId && isSameWeek(allocDate, today, { weekStartsOn: 1 });
  });

  const pendingAllocations = myAllocations.filter(a => a.status !== 'completed');
  const completedAllocations = myAllocations.filter(a => a.status === 'completed');

  const [editingValues, setEditingValues] = useState<Record<string, string>>({});

  // --- ESTADOS PARA TAREA EXTRA (NUEVO) ---
  const [isAddingExtra, setIsAddingExtra] = useState(false);
  const [extraProjectId, setExtraProjectId] = useState('');
  const [extraTaskName, setExtraTaskName] = useState('');
  const [extraHours, setExtraHours] = useState('1');

  const handleUpdateHours = async (allocation: any, newValue: string) => {
      const numValue = parseFloat(newValue);
      if (isNaN(numValue) || numValue < 0) return;

      if (numValue !== allocation.hoursActual) {
          try {
              await updateAllocation({
                  ...allocation,
                  hoursActual: numValue,
                  // Si pone horas y estaba solo "planeada", pasa a "activa"
                  status: allocation.status === 'planned' && numValue > 0 ? 'active' : allocation.status
              });
              toast.success("Horas registradas");
          } catch (error) {
              toast.error("Error al guardar");
          }
      }
  };

  const toggleComplete = async (allocation: any) => {
      const newStatus = allocation.status === 'completed' ? 'active' : 'completed';
      try {
          await updateAllocation({
              ...allocation,
              status: newStatus
          });
          toast.success(newStatus === 'completed' ? "Tarea completada" : "Tarea reactivada");
      } catch (error) {
          toast.error("Error al cambiar estado");
      }
  };

  // --- FUNCIÓN PARA CREAR TAREA IMPREVISTA (NUEVO) ---
  const handleAddExtraTask = async () => {
      if (!extraProjectId || !extraTaskName) {
          toast.error("Rellena proyecto y nombre");
          return;
      }

      try {
          await addAllocation({
              projectId: extraProjectId,
              employeeId: employeeId,
              weekStartDate: startOfCurrentWeek.toISOString(),
              hoursAssigned: 0, // 0 porque no estaba planificada (es Extra)
              hoursActual: Number(extraHours),
              hoursComputed: 0,
              taskName: extraTaskName,
              status: 'active',
              description: 'Tarea añadida manualmente por el empleado (Imprevisto)'
          });
          toast.success("Tarea imprevista registrada");
          setIsAddingExtra(false);
          
          // Resetear formulario
          setExtraProjectId('');
          setExtraTaskName('');
          setExtraHours('1');
      } catch (error) {
          console.error(error);
          toast.error("Error al crear tarea");
      }
  };

  const TaskRow = ({ task, isCompleted = false }: { task: any, isCompleted?: boolean }) => {
      const project = projects.find(p => p.id === task.projectId);
      const client = clients.find(c => c.id === project?.clientId);
      const assigned = Number(task.hoursAssigned);
      const actual = editingValues[task.id] !== undefined ? Number(editingValues[task.id]) : Number(task.hoursActual || 0);
      
      // Cálculo inteligente del progreso:
      // Si assigned es 0 (imprevisto), si hay horas reales es 100%, si no 0%
      const percent = assigned > 0 ? Math.min(100, (actual / assigned) * 100) : (actual > 0 ? 100 : 0);
      const isOverBudget = assigned > 0 && actual > assigned;
      const isUnplanned = assigned === 0;

      return (
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border rounded-lg shadow-sm transition-all ${isCompleted ? 'opacity-60 bg-slate-50' : 'hover:border-indigo-300'} ${isUnplanned ? 'border-amber-200 bg-amber-50/30' : ''}`}>
              
              <div className="flex items-start gap-3 flex-1 mb-3 sm:mb-0">
                  <button onClick={() => toggleComplete(task)} className="mt-1 text-slate-400 hover:text-emerald-500 transition-colors" title={isCompleted ? "Marcar como pendiente" : "Marcar como completada"}>
                      {isCompleted ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Circle className="w-5 h-5" />}
                  </button>
                  <div>
                      <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-[10px] h-5 bg-white text-slate-500 border-slate-200">
                              {client?.name || 'Interno'}
                          </Badge>
                          <span className="font-semibold text-slate-700 text-sm">{project?.name}</span>
                          
                          {/* ETIQUETA VISUAL PARA TAREAS EXTRA */}
                          {isUnplanned && <Badge variant="secondary" className="text-[9px] h-4 bg-amber-100 text-amber-700 hover:bg-amber-100 border border-amber-200">Extra / Imprevisto</Badge>}
                      </div>
                      <p className="text-sm text-slate-600 font-medium">
                          {task.taskName || "Asignación general"}
                      </p>
                  </div>
              </div>

              <div className="flex items-center gap-4 sm:border-l sm:pl-4 border-slate-100">
                  <div className="flex flex-col items-end min-w-[100px]">
                      <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-slate-400 uppercase font-medium">Realizado</span>
                          {isOverBudget && <AlertCircle className="w-3 h-3 text-red-500" />}
                      </div>
                      <div className="flex items-center gap-2">
                          <Input 
                              type="number" 
                              className={`h-8 w-16 text-right font-mono font-medium ${isOverBudget ? 'text-red-600 bg-red-50 border-red-200' : 'text-slate-900'}`}
                              value={editingValues[task.id] ?? (task.hoursActual || '')}
                              onChange={(e) => setEditingValues({...editingValues, [task.id]: e.target.value})}
                              onBlur={(e) => handleUpdateHours(task, e.target.value)}
                              placeholder="0"
                              disabled={isCompleted}
                          />
                          <span className="text-sm text-slate-400">/ {assigned}h</span>
                      </div>
                  </div>
                  
                  <div className="hidden sm:block w-24">
                      <Progress 
                          value={percent} 
                          className={`h-2 ${isOverBudget ? '[&>div]:bg-red-500' : isCompleted ? '[&>div]:bg-emerald-500' : isUnplanned ? '[&>div]:bg-amber-500' : '[&>div]:bg-indigo-600'}`} 
                      />
                  </div>
              </div>
          </div>
      );
  };

  return (
    <div className="space-y-8">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-900 capitalize">{weekLabel}</h2>
          </div>

          {/* BOTÓN + DIÁLOGO PARA TAREA EXTRA */}
          <Dialog open={isAddingExtra} onOpenChange={setIsAddingExtra}>
            <DialogTrigger asChild>
                <Button size="sm" variant="secondary" className="text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 shadow-sm">
                    <PlusCircle className="w-4 h-4 mr-2" /> Fichar Tarea Extra
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Añadir Tarea Imprevista</DialogTitle>
                    <DialogDescription>
                        Registra una tarea urgente o no planificada que hayas realizado esta semana.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label>Proyecto</Label>
                        <Select onValueChange={setExtraProjectId} value={extraProjectId}>
                            <SelectTrigger><SelectValue placeholder="Selecciona proyecto..." /></SelectTrigger>
                            <SelectContent>
                                {projects.filter(p => p.status === 'active').map(p => (
                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Nombre de la Tarea</Label>
                        <Input 
                            placeholder="Ej: Hotfix urgente, Reunión con cliente..." 
                            value={extraTaskName} 
                            onChange={e => setExtraTaskName(e.target.value)} 
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Horas Dedicadas (Aprox)</Label>
                        <Input 
                            type="number" 
                            step="0.5" 
                            value={extraHours} 
                            onChange={e => setExtraHours(e.target.value)} 
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddingExtra(false)}>Cancelar</Button>
                    <Button onClick={handleAddExtraTask} className="bg-indigo-600 hover:bg-indigo-700">Guardar Tarea</Button>
                </DialogFooter>
            </DialogContent>
          </Dialog>
      </div>

      {/* TAREAS PENDIENTES */}
      <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Briefcase className="w-4 h-4" /> En Curso / Pendientes ({pendingAllocations.length})
          </h3>
          
          {pendingAllocations.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-slate-500 text-sm">¡Todo limpio! No tienes tareas pendientes.</p>
              </div>
          ) : (
              <div className="grid gap-3">
                  {pendingAllocations.map(task => (
                      <TaskRow key={task.id} task={task} />
                  ))}
              </div>
          )}
      </div>

      {/* TAREAS COMPLETADAS */}
      {completedAllocations.length > 0 && (
          <div className="space-y-4 pt-4">
              <h3 className="text-sm font-semibold text-emerald-600 uppercase tracking-wider flex items-center gap-2 opacity-80">
                  <CheckCircle2 className="w-4 h-4" /> Completadas ({completedAllocations.length})
              </h3>
              <div className="grid gap-3">
                  {completedAllocations.map(task => (
                      <TaskRow key={task.id} task={task} isCompleted={true} />
                  ))}
              </div>
          </div>
      )}
    </div>
  );
}
