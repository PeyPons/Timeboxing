import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { format, startOfWeek, addDays, isSameWeek, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, AlertCircle, PlusCircle, Link as LinkIcon, AlertOctagon, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react';
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

  const handleUpdateHours = async (allocation: any, field: 'hoursActual' | 'hoursComputed', newValue: string) => {
      const numValue = parseFloat(newValue);
      if (isNaN(numValue) || numValue < 0) return;

      if (numValue !== allocation[field]) {
        try {
            await updateAllocation({
                ...allocation,
                [field]: numValue,
                status: allocation.status === 'planned' && numValue > 0 ? 'active' : allocation.status
            });
            toast.success("Horas actualizadas");
            setEditingValues(prev => {
                const newState = { ...prev };
                delete newState[`${allocation.id}-${field}`];
                return newState;
            });
        } catch (error) {
            console.error(error);
            toast.error("Error al guardar horas");
        }
      }
  };

  const handleAddExtraTask = async () => {
      if (!extraTaskName) { toast.error("Debes poner un nombre a la tarea"); return; }
      if (!internalProject) { toast.error("No hay proyectos disponibles."); return; }

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
          setExtraTaskName(''); setExtraEstimated('1'); setExtraReal('0');
      } catch (error) {
          console.error(error);
          toast.error("Error al crear tarea");
      }
  };

  return (
    <div className="space-y-6">
      
      <div className="flex justify-end mb-4">
          <Dialog open={isAddingExtra} onOpenChange={setIsAddingExtra}>
              <DialogTrigger asChild><Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800 shadow-sm"><PlusCircle className="w-4 h-4 mr-2" /> Tarea Extra</Button></DialogTrigger>
              <DialogContent className="sm:max-w-md">
                  <DialogHeader><DialogTitle>Fichar Tarea Interna</DialogTitle><DialogDescription>Se asignará a <strong>{internalProject?.name}</strong>.</DialogDescription></DialogHeader>
                  <div className="grid gap-4 py-4">
                      <div className="space-y-2"><Label>Nombre de la Tarea</Label><Input value={extraTaskName} onChange={e => setExtraTaskName(e.target.value)} autoFocus /></div>
                      <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2"><Label>Horas Estimadas</Label><Input type="number" step="0.5" value={extraEstimated} onChange={e => setExtraEstimated(e.target.value)} /></div>
                          <div className="space-y-2"><Label>Horas Reales</Label><Input type="number" step="0.5" value={extraReal} onChange={e => setExtraReal(e.target.value)} /></div>
                      </div>
                  </div>
                  <DialogFooter><Button variant="outline" onClick={() => setIsAddingExtra(false)}>Cancelar</Button><Button onClick={handleAddExtraTask} className="bg-indigo-600 hover:bg-indigo-700">Guardar</Button></DialogFooter>
              </DialogContent>
          </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {myAllocations.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200"><div className="text-slate-400">No hay tareas para esta semana.</div></div>
        ) : (
            myAllocations.map(task => {
                const project = projects.find(p => p.id === task.projectId);
                const client = clients.find(c => c.id === project?.clientId);
                
                const est = task.hoursAssigned;
                const real = task.hoursActual || 0;
                const comp = task.hoursComputed || 0;
                const balance = comp - real;
                const isPositive = balance >= 0;

                // Dependencias
                const depTask = task.dependencyId ? allocations.find(a => a.id === task.dependencyId) : null;
                const depOwner = depTask ? employees.find(e => e.id === depTask.employeeId) : null;
                const isDepReady = depTask?.status === 'completed';
                const blockingTasks = allocations.filter(a => a.dependencyId === task.id && a.status !== 'completed');

                return (
                    <Card key={task.id} className="flex flex-col shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                        <div className="p-4 pb-3 border-b border-slate-100 bg-white">
                            <div className="flex justify-between items-start mb-1">
                                <h3 className="text-lg font-bold text-slate-900 leading-tight truncate pr-2" title={task.taskName || 'Tarea'}>
                                    {task.taskName || 'Asignación'}
                                </h3>
                                {/* ETIQUETA ESTADO / DEPENDENCIA */}
                                {depTask && !isDepReady ? (
                                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] whitespace-nowrap gap-1">
                                        <LinkIcon className="w-3 h-3"/> Esperando a {depOwner?.name}
                                    </Badge>
                                ) : blockingTasks.length > 0 ? (
                                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px] whitespace-nowrap gap-1 animate-pulse">
                                        <AlertOctagon className="w-3 h-3"/> Estás bloqueando
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 text-[10px] font-normal">
                                        {task.status === 'completed' ? 'Completado' : 'En curso'}
                                    </Badge>
                                )}
                            </div>
                            
                            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                                <span className={`w-2 h-2 rounded-full ${task.status==='completed' ? 'bg-emerald-400' : 'bg-indigo-400'}`}></span>
                                <span className="font-medium truncate">{project?.name}</span>
                                <span className="text-slate-300">|</span>
                                <span className="truncate opacity-70">{client?.name}</span>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-3 divide-x divide-slate-100 bg-slate-50/30">
                            <div className="p-3 text-center">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">EST.</div>
                                <div className="text-lg font-mono font-medium text-slate-700">{est}h</div>
                            </div>
                            <div className="p-3 text-center bg-white">
                                <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1 flex items-center justify-center gap-1"><TrendingUp className="w-3 h-3"/> REAL</div>
                                <div className="flex justify-center">
                                    <input 
                                        type="number" 
                                        className="w-16 text-center font-mono text-lg font-bold text-blue-700 bg-transparent outline-none p-0"
                                        value={editingValues[`${task.id}-hoursActual`] ?? real}
                                        onChange={(e) => setEditingValues({...editingValues, [`${task.id}-hoursActual`]: e.target.value})}
                                        onBlur={(e) => handleUpdateHours(task, 'hoursActual', e.target.value)}
                                        step="0.5"
                                    />
                                </div>
                            </div>
                            <div className="p-3 text-center">
                                <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1 flex items-center justify-center gap-1"><CheckCircle className="w-3 h-3"/> COMP</div>
                                <div className="flex justify-center">
                                    <input 
                                        type="number" 
                                        className="w-16 text-center font-mono text-lg font-bold text-emerald-700 bg-transparent outline-none p-0"
                                        value={editingValues[`${task.id}-hoursComputed`] ?? comp}
                                        onChange={(e) => setEditingValues({...editingValues, [`${task.id}-hoursComputed`]: e.target.value})}
                                        onBlur={(e) => handleUpdateHours(task, 'hoursComputed', e.target.value)}
                                        step="0.5"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* BALANCE FOOTER */}
                        <div className={`px-4 py-2 flex justify-between items-center text-xs font-bold border-t border-slate-100 ${isPositive ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                            <span className="opacity-70 uppercase tracking-wide">BALANCE</span>
                            <span className="font-mono text-sm flex items-center gap-1">
                                {isPositive ? <TrendingUp className="w-3 h-3"/> : <TrendingDown className="w-3 h-3"/>}
                                {isPositive ? '+' : ''}{balance.toFixed(2)}h
                            </span>
                        </div>
                    </Card>
                );
            })
        )}
      </div>
    </div>
  );
}
