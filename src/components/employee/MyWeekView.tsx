import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { format, startOfWeek, addDays, isSameWeek, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock, CheckCircle2, Briefcase, AlertCircle, PlusCircle, Save } from 'lucide-react';
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
  const weekLabel = `Semana del ${format(startOfCurrentWeek, 'd MMM', { locale: es })} al ${format(addDays(startOfCurrentWeek, 4), 'd MMM', { locale: es })}`;
  
  // Datos del empleado para capacidad
  const me = employees.find(e => e.id === employeeId);
  const weeklyCapacity = me?.defaultWeeklyCapacity || 40;

  // Filtramos las allocations de ESTA semana
  const myAllocations = allocations.filter(a => 
    a.employeeId === employeeId && 
    (a.status === 'planned' || a.status === 'active' || a.status === 'completed') &&
    isSameWeek(parseISO(a.weekStartDate), today, { weekStartsOn: 1 })
  );

  const [editingValues, setEditingValues] = useState<Record<string, string>>({});

  // --- ESTADOS TAREA EXTRA ---
  const [isAddingExtra, setIsAddingExtra] = useState(false);
  const [extraTaskName, setExtraTaskName] = useState('');
  const [extraEstimated, setExtraEstimated] = useState('1'); // Estimado manual
  const [extraReal, setExtraReal] = useState('0'); // Real manual

  // --- BUSCAR PROYECTO INTERNO AUTOMÁTICAMENTE ---
  const internalProject = useMemo(() => {
      // Busca un proyecto que se llame "Interno", "Gestión", "General", etc.
      return projects.find(p => 
          p.name.toLowerCase().includes('interno') || 
          p.name.toLowerCase().includes('gestión') ||
          p.name.toLowerCase().includes('general')
      ) || projects[0]; // Fallback al primero si no hay ninguno específico
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
          toast.error("No hay proyectos disponibles para asignar.");
          return;
      }

      try {
          await addAllocation({
              projectId: internalProject.id,
              employeeId: employeeId,
              weekStartDate: startOfCurrentWeek.toISOString(),
              hoursAssigned: Number(extraEstimated), // Usuario define estimado
              hoursActual: Number(extraReal),       // Usuario define real inicial
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

  // Cálculos totales para el Header
  const totalAssigned = myAllocations.reduce((acc, curr) => acc + Number(curr.hoursAssigned), 0);
  const totalDone = myAllocations.reduce((acc, curr) => acc + Number(curr.hoursActual || 0), 0);
  // Progreso real vs asignado
  const totalProgress = totalAssigned > 0 ? Math.min(100, (totalDone / totalAssigned) * 100) : 0;

  return (
    <div className="space-y-8">
      
      {/* 1. MÓDULO DE RESUMEN (HEADER RESTAURADO) */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b pb-6">
        <div>
            <h2 className="text-2xl font-bold text-slate-900">Mis Tareas</h2>
            <p className="text-slate-500 flex items-center gap-2 mt-1">
                <Clock className="w-4 h-4"/> {weekLabel}
            </p>
        </div>
        
        {/* Tarjeta de Resumen de Carga */}
        <div className="flex items-center gap-6 bg-white p-4 rounded-xl border shadow-sm w-full md:w-auto">
            <div className="text-center">
                <div className="text-xs text-slate-400 uppercase font-semibold">Capacidad</div>
                <div className="font-mono text-lg font-bold text-slate-700">{weeklyCapacity}h</div>
            </div>
            <div className="h-8 w-px bg-slate-200"></div>
            <div className="text-center">
                <div className="text-xs text-slate-400 uppercase font-semibold">Asignado</div>
                <div className={`font-mono text-lg font-bold ${totalAssigned > weeklyCapacity ? 'text-red-500' : 'text-indigo-600'}`}>
                    {totalAssigned.toFixed(1)}h
                </div>
            </div>
            <div className="h-8 w-px bg-slate-200"></div>
            <div className="flex-1 min-w-[120px]">
                <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">Completado</span>
                    <span className="font-bold text-emerald-600">{totalProgress.toFixed(0)}%</span>
                </div>
                <Progress value={totalProgress} className="h-2" />
            </div>

            {/* BOTÓN TAREA EXTRA */}
            <div className="border-l pl-4 ml-2">
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
                                Se asignará automáticamente al proyecto <strong>{internalProject?.name}</strong>.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label>Nombre de la Tarea</Label>
                                <Input 
                                    placeholder="Ej: Reunión imprevista, Gestión emails..." 
                                    value={extraTaskName} 
                                    onChange={e => setExtraTaskName(e.target.value)} 
                                    autoFocus
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Horas Estimadas</Label>
                                    <Input 
                                        type="number" 
                                        step="0.5" 
                                        value={extraEstimated} 
                                        onChange={e => setExtraEstimated(e.target.value)} 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Horas Reales (Ya hechas)</Label>
                                    <Input 
                                        type="number" 
                                        step="0.5" 
                                        value={extraReal} 
                                        onChange={e => setExtraReal(e.target.value)} 
                                    />
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAddingExtra(false)}>Cancelar</Button>
                            <Button onClick={handleAddExtraTask} className="bg-indigo-600 hover:bg-indigo-700">Guardar</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
      </div>

      {/* 2. GRID DE TARJETAS (VISTA RESTAURADA) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {myAllocations.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <Briefcase className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <h3 className="text-lg font-medium text-slate-600">Semana libre</h3>
                <p className="text-slate-400 max-w-sm mx-auto mt-1">No tienes tareas asignadas en el planificador para esta semana.</p>
            </div>
        ) : (
            myAllocations.map(task => {
                const project = projects.find(p => p.id === task.projectId);
                const client = clients.find(c => c.id === project?.clientId);
                const percent = task.hoursAssigned > 0 
                    ? Math.min(100, ((task.hoursActual || 0) / task.hoursAssigned) * 100)
                    : (task.hoursActual || 0) > 0 ? 100 : 0;
                
                const isOverBudget = (task.hoursActual || 0) > task.hoursAssigned;
                const isExtra = task.description?.includes('manualmente'); // Detectar si es extra por descripción o lógica

                return (
                    <Card key={task.id} className={`flex flex-col hover:border-indigo-300 transition-all shadow-sm hover:shadow-md group ${isExtra ? 'border-amber-200 bg-amber-50/20' : ''}`}>
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                                <Badge variant="outline" className="mb-2 bg-slate-50 text-slate-500 border-slate-200">
                                    {client?.name || 'Interno'}
                                </Badge>
                                {isOverBudget && (
                                    <span className="text-[10px] text-red-500 flex items-center font-medium bg-red-50 px-2 py-0.5 rounded-full">
                                        <AlertCircle className="w-3 h-3 mr-1"/> Excedido
                                    </span>
                                )}
                                {isExtra && !isOverBudget && (
                                    <Badge variant="secondary" className="text-[9px] bg-amber-100 text-amber-700 hover:bg-amber-100">Extra</Badge>
                                )}
                            </div>
                            <CardTitle className="text-lg leading-tight text-slate-800 line-clamp-1" title={project?.name}>
                                {project?.name}
                            </CardTitle>
                        </CardHeader>
                        
                        <CardContent className="flex-1 flex flex-col gap-4">
                            {/* Descripción de la tarea */}
                            <div className="flex-1 bg-slate-50 p-3 rounded-lg text-sm text-slate-600 italic border border-slate-100 min-h-[60px]">
                                {task.taskName || "Asignación general."}
                            </div>

                            {/* Control de Progreso */}
                            <div className="space-y-3 pt-2 border-t border-slate-100">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="font-medium text-slate-700">Horas Reales</span>
                                    <div className="flex items-baseline gap-1">
                                        {/* Input editable para horas reales */}
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
                                        <span className="text-slate-400 text-xs ml-1">/ {task.hoursAssigned}h Planif.</span>
                                    </div>
                                </div>
                                
                                <Progress 
                                    value={percent} 
                                    className={`h-2.5 ${isOverBudget ? '[&>div]:bg-red-500' : percent >= 100 ? '[&>div]:bg-emerald-500' : '[&>div]:bg-indigo-600'}`} 
                                />
                                
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
