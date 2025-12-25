import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { format, startOfWeek, addDays, isSameWeek, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, AlertCircle, PlusCircle, Link as LinkIcon, AlertOctagon } from 'lucide-react';
import { toast } from 'sonner';
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

interface MyWeekViewProps {
  employeeId: string;
}

export function MyWeekView({ employeeId }: MyWeekViewProps) {
  const { allocations, projects, clients, updateAllocation, addAllocation, employees } = useApp();
  
  const today = new Date();
  const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 });
  
  const myAllocations = allocations.filter(a => 
    a.employeeId === employeeId && 
    (a.status === 'planned' || a.status === 'active' || a.status === 'completed') &&
    isSameWeek(parseISO(a.weekStartDate), today, { weekStartsOn: 1 })
  );

  const [editingValues, setEditingValues] = useState<Record<string, string>>({});

  const [isAddingExtra, setIsAddingExtra] = useState(false);
  const [extraTaskName, setExtraTaskName] = useState('');
  const [extraEstimated, setExtraEstimated] = useState('1'); 
  const [extraReal, setExtraReal] = useState('0');

  const internalProject = useMemo(() => {
      return projects.find(p => 
          p.name.toLowerCase().includes('interno') || 
          p.name.toLowerCase().includes('gestión')
      ) || projects[0]; 
  }, [projects]);

  const handleUpdateHours = async (allocation: any, newValue: string) => {
      const numValue = parseFloat(newValue);
      if (isNaN(numValue) || numValue < 0) return;

      if (numValue !== allocation.hoursActual) {
        try {
            await updateAllocation({
                ...allocation,
                hoursActual: numValue,
                status: allocation.status === 'planned' && numValue > 0 ? 'active' : allocation.status
            });
            toast.success("Horas actualizadas");
            setEditingValues(prev => {
                const newState = { ...prev };
                delete newState[allocation.id];
                return newState;
            });
        } catch (error) {
            console.error(error);
            toast.error("Error al guardar horas");
        }
      }
  };

  const handleAddExtraTask = async () => {
      if (!extraTaskName) {
          toast.error("Debes poner un nombre a la tarea");
          return;
      }
      if (!internalProject) {
          toast.error("No hay proyectos disponibles.");
          return;
      }

      try {
          const formattedDate = format(startOfCurrentWeek, 'yyyy-MM-dd');
          await addAllocation({
              projectId: internalProject.id,
              employeeId: employeeId,
              weekStartDate: formattedDate,
              hoursAssigned: Number(extraEstimated), 
              hoursActual: Number(extraReal),       
              hoursComputed: 0,
              taskName: extraTaskName,
              status: 'active',
              description: 'Tarea interna añadida manualmente'
          });
          toast.success("Tarea interna registrada");
          setIsAddingExtra(false);
          setExtraTaskName('');
          setExtraEstimated('1');
          setExtraReal('0');
      } catch (error) {
          console.error(error);
          toast.error("Error al crear tarea");
      }
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER SIMPLE CON BOTÓN TAREA EXTRA */}
      <div className="flex justify-end mb-4">
          <Dialog open={isAddingExtra} onOpenChange={setIsAddingExtra}>
              <DialogTrigger asChild>
                  <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800 shadow-sm">
                      <PlusCircle className="w-4 h-4 mr-2" /> Tarea Extra
                  </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                      <DialogTitle>Fichar Tarea Interna</DialogTitle>
                      <DialogDescription>
                          Se asignará a <strong>{internalProject?.name}</strong>.
                      </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                          <Label>Nombre de la Tarea</Label>
                          <Input value={extraTaskName} onChange={e => setExtraTaskName(e.target.value)} autoFocus />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2"><Label>Horas Estimadas</Label><Input type="number" step="0.5" value={extraEstimated} onChange={e => setExtraEstimated(e.target.value)} /></div>
                          <div className="space-y-2"><Label>Horas Reales</Label><Input type="number" step="0.5" value={extraReal} onChange={e => setExtraReal(e.target.value)} /></div>
                      </div>
                  </div>
                  <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddingExtra(false)}>Cancelar</Button>
                      <Button onClick={handleAddExtraTask} className="bg-indigo-600 hover:bg-indigo-700">Guardar</Button>
                  </DialogFooter>
              </DialogContent>
          </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {myAllocations.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <div className="text-slate-400">No hay tareas para esta semana.</div>
            </div>
        ) : (
            myAllocations.map(task => {
                const project = projects.find(p => p.id === task.projectId);
                const client = clients.find(c => c.id === project?.clientId);
                const percent = task.hoursAssigned > 0 
                    ? Math.min(100, ((task.hoursActual || 0) / task.hoursAssigned) * 100)
                    : (task.hoursActual || 0) > 0 ? 100 : 0;
                
                const isOverBudget = (task.hoursActual || 0) > task.hoursAssigned;
                const isExtra = task.description?.includes('manualmente');

                // Lógica de Dependencias para la Tarjeta
                const depTask = task.dependencyId ? allocations.find(a => a.id === task.dependencyId) : null;
                const depOwner = depTask ? employees.find(e => e.id === depTask.employeeId) : null;
                const blockingTasks = allocations.filter(a => a.dependencyId === task.id && a.status !== 'completed');

                return (
                    <Card key={task.id} className={`flex flex-col hover:border-indigo-300 transition-all shadow-sm ${isExtra ? 'border-amber-200 bg-amber-50/20' : ''}`}>
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                                <Badge variant="outline" className="mb-2 bg-slate-50 text-slate-500 border-slate-200">
                                    {client?.name || 'Interno'}
                                </Badge>
                                {isExtra && <Badge variant="secondary" className="text-[9px] bg-amber-100 text-amber-800">Extra</Badge>}
                            </div>
                            <CardTitle className="text-lg leading-tight text-slate-800 truncate" title={project?.name}>
                                {project?.name}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col gap-4">
                            <div className="flex-1 bg-slate-50 p-3 rounded-lg text-sm text-slate-600 border border-slate-100 min-h-[60px]">
                                <div className="font-medium mb-1">{task.taskName || "Asignación general."}</div>
                                
                                {/* VISUALIZACIÓN DE DEPENDENCIAS EN LA TARJETA */}
                                {depTask && (
                                    <div className="flex items-center gap-1 mt-2 text-[10px] text-amber-700 bg-amber-50 px-2 py-1 rounded w-fit border border-amber-200">
                                        <LinkIcon className="w-3 h-3" />
                                        <span>Esperando por: <strong>{depOwner?.name}</strong></span>
                                    </div>
                                )}
                                {blockingTasks.length > 0 && (
                                    <div className="flex flex-col gap-1 mt-2">
                                        {blockingTasks.map(bt => {
                                            const blockedUser = employees.find(e => e.id === bt.employeeId);
                                            return (
                                                <div key={bt.id} className="flex items-center gap-1 text-[10px] text-red-700 bg-red-50 px-2 py-1 rounded w-fit border border-red-200">
                                                    <AlertOctagon className="w-3 h-3" />
                                                    <span>Estás bloqueando a: <strong>{blockedUser?.name}</strong></span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3 pt-2 border-t border-slate-100">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="font-medium text-slate-700">Horas Reales</span>
                                    <div className="flex items-baseline gap-1">
                                        <div className="relative w-20">
                                            <Input 
                                                type="number" 
                                                className="h-8 text-right pr-7 font-bold text-slate-900 border-indigo-100 focus:border-indigo-500 bg-white"
                                                value={editingValues[task.id] ?? task.hoursActual ?? 0}
                                                onChange={(e) => setEditingValues({...editingValues, [task.id]: e.target.value})}
                                                onBlur={(e) => handleUpdateHours(task, e.target.value)}
                                            />
                                            <span className="absolute right-2 top-2 text-xs text-slate-400">h</span>
                                        </div>
                                        <span className="text-slate-400 text-xs ml-1">/ {task.hoursAssigned}h</span>
                                    </div>
                                </div>
                                <Progress value={percent} className={`h-2.5 ${isOverBudget ? '[&>div]:bg-red-500' : '[&>div]:bg-indigo-600'}`} />
                                {percent >= 100 && !isOverBudget && (
                                    <div className="flex items-center justify-center gap-1 text-xs text-emerald-600 font-medium bg-emerald-50 py-1 rounded">
                                        <CheckCircle2 className="w-3 h-3"/> Completado
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                );
            })
        )}
      </div>
    </div>
  );
}
