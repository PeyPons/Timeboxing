import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, Users, ArrowRight, AlertOctagon, Link as LinkIcon } from 'lucide-react';
import { isSameWeek, parseISO } from 'date-fns';

interface WidgetProps {
  employeeId: string;
}

// WIDGET 1: RECOMENDACIONES
export function PriorityInsights({ employeeId }: WidgetProps) {
  const { allocations, projects } = useApp();
  const today = new Date();
  
  const myTasks = allocations.filter(a => 
    a.employeeId === employeeId && 
    a.status !== 'completed' &&
    isSameWeek(parseISO(a.weekStartDate), today, { weekStartsOn: 1 })
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
            {uniqueProjects > 2 && (
                <div className="text-xs bg-white/60 p-2 rounded text-amber-800">
                    Cuidado, tienes {uniqueProjects} proyectos activos. Evita el "multitasking" excesivo.
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
  
  // Tareas mías activas
  const myAllocations = allocations.filter(a => 
    a.employeeId === employeeId && 
    isSameWeek(parseISO(a.weekStartDate), today, { weekStartsOn: 1 })
  );

  // 1. TAREAS QUE ME BLOQUEAN (Incoming)
  const incomingDependencies = myAllocations
    .filter(a => a.dependencyId && allocations.find(d => d.id === a.dependencyId)?.status !== 'completed')
    .map(a => {
        const depTask = allocations.find(d => d.id === a.dependencyId);
        const depOwner = employees.find(e => e.id === depTask?.employeeId);
        return { myTask: a, depTask, depOwner };
    });

  // 2. TAREAS QUE YO BLOQUEO (Outgoing)
  const outgoingBlocks = myAllocations
    .filter(a => a.status !== 'completed')
    .map(a => {
        const blockedTasks = allocations.filter(b => b.dependencyId === a.id && b.status !== 'completed');
        return { myTask: a, blockedTasks };
    })
    .filter(item => item.blockedTasks.length > 0);

  return (
    <Card className="border-slate-200 shadow-sm h-full flex flex-col">
      <CardHeader className="pb-3 border-b bg-slate-50/50">
        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-500" />
          Estado de Dependencias
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto max-h-[250px] p-4 space-y-4">
        
        {incomingDependencies.length === 0 && outgoingBlocks.length === 0 && (
             <p className="text-xs text-slate-400 text-center py-4">No hay bloqueos activos esta semana. ¡Todo fluido!</p>
        )}

        {/* ME BLOQUEAN */}
        {incomingDependencies.length > 0 && (
            <div>
                <h4 className="text-xs font-bold text-amber-600 mb-2 uppercase flex items-center gap-1"><LinkIcon className="w-3 h-3"/> Estás esperando por...</h4>
                <div className="space-y-2">
                    {incomingDependencies.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-xs bg-amber-50 p-2 rounded border border-amber-100">
                            <span>Para empezar <strong>{item.myTask.taskName}</strong></span>
                            <span className="flex items-center gap-1 text-amber-800">
                                <ArrowRight className="w-3 h-3"/> Necesitas a <strong>{item.depOwner?.name}</strong>
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* YO BLOQUEO */}
        {outgoingBlocks.length > 0 && (
            <div>
                <h4 className="text-xs font-bold text-red-600 mb-2 uppercase flex items-center gap-1"><AlertOctagon className="w-3 h-3"/> Estás bloqueando a...</h4>
                <div className="space-y-2">
                    {outgoingBlocks.map((item, i) => (
                        <div key={i} className="flex flex-col gap-1 text-xs bg-red-50 p-2 rounded border border-red-100">
                            <div className="font-medium text-red-900">Tu tarea: {item.myTask.taskName}</div>
                            <div className="pl-2 border-l-2 border-red-200 ml-1 space-y-1">
                                {item.blockedTasks.map(bt => {
                                    const blockedUser = employees.find(e => e.id === bt.employeeId);
                                    return (
                                        <div key={bt.id} className="text-red-700 flex justify-between">
                                            <span>{bt.taskName}</span>
                                            <strong>{blockedUser?.name}</strong>
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
