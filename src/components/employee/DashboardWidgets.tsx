import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, Users, ArrowRight, AlertOctagon, Link as LinkIcon, CheckCircle2, Clock } from 'lucide-react';
import { isSameMonth, parseISO } from 'date-fns';

interface WidgetProps {
  employeeId: string;
}

// WIDGET 1: RECOMENDACIONES (Sin cambios mayores, solo ajuste de scope si quieres)
export function PriorityInsights({ employeeId }: WidgetProps) {
  const { allocations, projects } = useApp();
  const today = new Date();
  
  // Mantenemos foco semanal para recomendaciones inmediatas
  const myTasks = allocations.filter(a => 
    a.employeeId === employeeId && 
    a.status !== 'completed' &&
    isSameMonth(parseISO(a.weekStartDate), today) // Ampliado a mes también para consistencia
  );

  const sortedTasks = [...myTasks].sort((a, b) => b.hoursAssigned - a.hoursAssigned);
  const topTask = sortedTasks[0];
  const project = projects.find(p => p.id === topTask?.projectId);
  const uniqueProjects = new Set(myTasks.map(t => t.projectId)).size;

  if (myTasks.length === 0) return null;

  return (
    <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-amber-800 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-600" />
          Recomendaciones IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-amber-900">
            <p className="mb-2">
                🚀 <strong>Foco sugerido:</strong> Empieza por <strong>{project?.name}</strong> ({topTask.hoursAssigned}h).
            </p>
            {uniqueProjects > 3 && (
                <div className="text-xs bg-white/60 p-2 rounded text-amber-800">
                    Cuidado, tienes {uniqueProjects} proyectos activos este mes. Evita el "multitasking" excesivo.
                </div>
            )}
        </div>
      </CardContent>
    </Card>
  );
}

// WIDGET 2: PULSO DEL EQUIPO Y DEPENDENCIAS
export function ProjectTeamPulse({ employeeId }: WidgetProps) {
  const { allocations, projects, employees } = useApp();
  const today = new Date();
  
  // 1. OBTENER MIS TAREAS DEL MES ACTUAL (No solo la semana)
  // Y filtramos las que YO ya he completado (Requisito: "Si miguel ya la marca como completa que no se muestre")
  const myAllocations = allocations.filter(a => 
    a.employeeId === employeeId && 
    a.status !== 'completed' && 
    isSameMonth(parseISO(a.weekStartDate), today)
  );

  // 2. TAREAS QUE ME BLOQUEAN (Incoming)
  const incomingDependencies = myAllocations
    .filter(a => a.dependencyId) // Solo las que tienen dependencia
    .map(a => {
        const depTask = allocations.find(d => d.id === a.dependencyId);
        const depOwner = employees.find(e => e.id === depTask?.employeeId);
        const isReady = depTask?.status === 'completed'; // ¿La otra persona terminó?
        return { myTask: a, depTask, depOwner, isReady };
    })
    // Filtramos si la tarea de la que dependo no existe (por si se borró)
    .filter(item => item.depTask !== undefined);

  // 3. TAREAS QUE YO BLOQUEO (Outgoing)
  // Buscamos tareas de OTROS que dependen de mis tareas PENDIENTES
  const outgoingBlocks = myAllocations
    .map(a => {
        const blockedTasks = allocations.filter(b => 
            b.dependencyId === a.id && 
            b.status !== 'completed' // Solo si el otro no la ha terminado (aunque no debería si está bloqueado)
        );
        return { myTask: a, blockedTasks };
    })
    .filter(item => item.blockedTasks.length > 0);

  return (
    <Card className="border-slate-200 shadow-sm h-full flex flex-col">
      <CardHeader className="pb-3 border-b bg-slate-50/50">
        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-500" />
          Estado de Dependencias (Mes Actual)
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto max-h-[250px] p-4 space-y-4">
        
        {incomingDependencies.length === 0 && outgoingBlocks.length === 0 && (
             <p className="text-xs text-slate-400 text-center py-4">No hay bloqueos activos. ¡Todo fluido!</p>
        )}

        {/* ME BLOQUEAN (O YA PUEDO EMPEZAR) */}
        {incomingDependencies.length > 0 && (
            <div>
                <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase flex items-center gap-1">
                    <LinkIcon className="w-3 h-3"/> Dependencias de entrada
                </h4>
                <div className="space-y-2">
                    {incomingDependencies.map((item, i) => (
                        <div key={i} className={`flex flex-col gap-1 text-xs p-2 rounded border ${item.isReady ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-100'}`}>
                            <div className="flex justify-between items-center">
                                <span className="font-medium text-slate-700">{item.myTask.taskName}</span>
                                {item.isReady ? (
                                    <span className="flex items-center gap-1 text-emerald-700 font-bold bg-white px-1.5 py-0.5 rounded shadow-sm">
                                        <CheckCircle2 className="w-3 h-3"/> ¡Ya puedes empezar!
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-amber-700 bg-white px-1.5 py-0.5 rounded shadow-sm">
                                        <Clock className="w-3 h-3"/> Esperando...
                                    </span>
                                )}
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                <ArrowRight className="w-3 h-3"/> 
                                {item.isReady ? 'Desbloqueado por' : 'Depende de'}: <strong>{item.depTask?.taskName}</strong> ({item.depOwner?.name})
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* YO BLOQUEO */}
        {outgoingBlocks.length > 0 && (
            <div>
                <div className="border-t border-slate-100 my-3"></div>
                <h4 className="text-xs font-bold text-red-600 mb-2 uppercase flex items-center gap-1">
                    <AlertOctagon className="w-3 h-3"/> Estás frenando a...
                </h4>
                <div className="space-y-2">
                    {outgoingBlocks.map((item, i) => (
                        <div key={i} className="flex flex-col gap-1 text-xs bg-red-50 p-2 rounded border border-red-100">
                            <div className="font-medium text-red-900 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                Tu tarea: {item.myTask.taskName}
                            </div>
                            <div className="pl-3 border-l-2 border-red-200 ml-1 space-y-1 mt-1">
                                {item.blockedTasks.map(bt => {
                                    const blockedUser = employees.find(e => e.id === bt.employeeId);
                                    return (
                                        <div key={bt.id} className="text-red-700 flex justify-between items-center">
                                            <span>{bt.taskName}</span>
                                            <span className="font-bold bg-white/50 px-1 rounded">{blockedUser?.name}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
