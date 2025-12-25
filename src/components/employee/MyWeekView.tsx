import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { format, startOfWeek, addDays, isSameWeek, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Briefcase, AlertCircle, CheckCircle2, Circle } from 'lucide-react';
import { toast } from 'sonner';

interface MyWeekViewProps {
  employeeId: string;
}

export function MyWeekView({ employeeId }: MyWeekViewProps) {
  const { allocations, projects, clients, updateAllocation } = useApp();
  
  const today = new Date();
  const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 });
  
  // RANGO DE FECHAS: Mostramos Lunes a Viernes (Como solicitaste, ignoramos Finde)
  const mondayDate = startOfCurrentWeek;
  const fridayDate = addDays(startOfCurrentWeek, 4);
  const weekLabel = `Semana del ${format(mondayDate, 'd', { locale: es })} al ${format(fridayDate, 'd ' + (mondayDate.getMonth() !== fridayDate.getMonth() ? 'MMM' : ''), { locale: es })} de ${format(fridayDate, 'MMMM', { locale: es })}`;

  // FILTRADO DE TAREAS
  const myAllocations = allocations.filter(a => {
    const allocDate = parseISO(a.weekStartDate);
    return a.employeeId === employeeId && isSameWeek(allocDate, today, { weekStartsOn: 1 });
  });

  // Clasificamos en Pendientes y Completadas
  const pendingAllocations = myAllocations.filter(a => a.status !== 'completed');
  const completedAllocations = myAllocations.filter(a => a.status === 'completed');

  // Estados locales para edición
  const [editingValues, setEditingValues] = useState<Record<string, string>>({});

  const handleUpdateHours = async (allocation: any, newValue: string) => {
      const numValue = parseFloat(newValue);
      if (isNaN(numValue) || numValue < 0) return;

      if (numValue !== allocation.hoursActual) {
          try {
              await updateAllocation({
                  ...allocation,
                  hoursActual: numValue,
                  // Reactivamos si pone horas y estaba solo planeada
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

  // Componente Fila de Tarea (Reutilizable)
  const TaskRow = ({ task, isCompleted = false }: { task: any, isCompleted?: boolean }) => {
      const project = projects.find(p => p.id === task.projectId);
      const client = clients.find(c => c.id === project?.clientId);
      const assigned = Number(task.hoursAssigned);
      const actual = editingValues[task.id] !== undefined ? Number(editingValues[task.id]) : Number(task.hoursActual || 0);
      
      // Cálculo de % basado en horas asignadas vs reales
      const percent = assigned > 0 ? Math.min(100, (actual / assigned) * 100) : 0;
      const isOverBudget = actual > assigned;

      return (
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border rounded-lg shadow-sm transition-all ${isCompleted ? 'opacity-60 bg-slate-50' : 'hover:border-indigo-300'}`}>
              
              {/* IZQUIERDA: Check + Info */}
              <div className="flex items-start gap-3 flex-1 mb-3 sm:mb-0">
                  <button onClick={() => toggleComplete(task)} className="mt-1 text-slate-400 hover:text-emerald-500 transition-colors" title={isCompleted ? "Marcar como pendiente" : "Marcar como completada"}>
                      {isCompleted ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Circle className="w-5 h-5" />}
                  </button>
                  <div>
                      <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-[10px] h-5 bg-slate-50 text-slate-500 border-slate-200">
                              {client?.name || 'Interno'}
                          </Badge>
                          <span className="font-semibold text-slate-700 text-sm">{project?.name}</span>
                      </div>
                      <p className="text-sm text-slate-600 font-medium">
                          {task.taskName || "Asignación general"}
                      </p>
                      {task.description && (
                          <p className="text-xs text-slate-400 mt-1 line-clamp-1">{task.description}</p>
                      )}
                  </div>
              </div>

              {/* DERECHA: Input de Horas y Barra */}
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
                          className={`h-2 ${isOverBudget ? '[&>div]:bg-red-500' : isCompleted ? '[&>div]:bg-emerald-500' : '[&>div]:bg-indigo-600'}`} 
                      />
                  </div>
              </div>
          </div>
      );
  };

  return (
    <div className="space-y-8">
      
      {/* CABECERA SEMANA LUNES-VIERNES */}
      <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
          <Calendar className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-slate-900 capitalize">{weekLabel}</h2>
      </div>

      {/* 1. TAREAS PENDIENTES */}
      <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Briefcase className="w-4 h-4" /> En Curso / Pendientes ({pendingAllocations.length})
          </h3>
          
          {pendingAllocations.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-slate-500 text-sm">¡Todo limpio! No tienes tareas pendientes para esta semana.</p>
              </div>
          ) : (
              <div className="grid gap-3">
                  {pendingAllocations.map(task => (
                      <TaskRow key={task.id} task={task} />
                  ))}
              </div>
          )}
      </div>

      {/* 2. TAREAS COMPLETADAS */}
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
