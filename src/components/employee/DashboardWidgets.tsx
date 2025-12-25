import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, Users, ArrowRight, AlertOctagon, Link as LinkIcon, CheckCircle2, Clock, Flag, Zap } from 'lucide-react';
import { isSameMonth, parseISO } from 'date-fns';

interface WidgetProps {
  employeeId: string;
}

// WIDGET 1: RECOMENDACIONES INTELIGENTES (V2)
export function PriorityInsights({ employeeId }: WidgetProps) {
  const { allocations, projects, employees } = useApp();
  const today = new Date();
  
  // Tareas activas del mes
  const myTasks = allocations.filter(a => 
    a.employeeId === employeeId && 
    a.status !== 'completed' &&
    isSameMonth(parseISO(a.weekStartDate), today)
  );

  if (myTasks.length === 0) return null;

  // 1. CRITERIO CRÍTICO: ¿ESTOY BLOQUEANDO A ALGUIEN?
  const blockingTask = myTasks.find(t => 
    allocations.some(other => other.dependencyId === t.id && other.status !== 'completed')
  );

  // 2. CRITERIO OPORTUNIDAD: ¿TAREA CASI TERMINADA? (< 2h restantes)
  const quickWinTask = myTasks.find(t => {
      const remaining = t.hoursAssigned - (t.hoursActual || 0);
      return remaining > 0 && remaining <= 2;
  });

  // 3. CRITERIO CARGA: TAREA MÁS PESADA
  const heavyTask = [...myTasks].sort((a, b) => b.hoursAssigned - a.hoursAssigned)[0];
  
  // --- DECISOR DE RECOMENDACIÓN ---
  let recommendation = null;

  if (blockingTask) {
      const blockedAlloc = allocations.find(other => other.dependencyId === blockingTask.id);
      const blockedUser = employees.find(e => e.id === blockedAlloc?.employeeId);
      const proj = projects.find(p => p.id === blockingTask.projectId);
      
      recommendation = {
          icon: <AlertOctagon className="w-4 h-4 text-red-600" />,
          title: "Desbloquea al equipo",
          text: `🔥 <strong>Urgente:</strong> Termina la tarea de <em>${proj?.name}</em>. <strong>${blockedUser?.name}</strong> no puede empezar hasta que acabes.`,
          style: 'bg-red-50 border-red-200 text-red-900'
      };
  } else if (quickWinTask) {
      const proj = projects.find(p => p.id === quickWinTask.projectId);
      recommendation = {
          icon: <Flag className="w-4 h-4 text-emerald-600" />,
          title: "Cierre Rápido",
          text: `🏁 <strong>A punto:</strong> Te queda muy poco en <em>${proj?.name}</em>. ¡Liquídala hoy mismo!`,
          style: 'bg-emerald-50 border-emerald-200 text-emerald-900'
      };
  } else {
      const proj = projects.find(p => p.id === heavyTask?.projectId);
      recommendation = {
          icon: <Zap className="w-4 h-4 text-amber-600" />,
          title: "Recomendación IA",
          text: `🚀 <strong>Foco:</strong> Empieza por <strong>${proj?.name}</strong>, es tu bloque más grande (${heavyTask?.hoursAssigned}h).`,
          style: 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 text-amber-900'
      };
  }

  return (
    <Card className={`border shadow-sm ${recommendation.style}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {recommendation.icon}
          {recommendation.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm">
            <p dangerouslySetInnerHTML={{ __html: recommendation.text }} />
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
        const depProject = projects.find(p => p.id === depTask?.projectId); // Proyecto de la dependencia
        const isReady = depTask?.status === 'completed'; 
        return { myTask: a, depTask, depOwner, depProject, isReady };
    })
    .filter(item => item.depTask !== undefined);

  // 3. TAREAS QUE YO BLOQUEO (Outgoing)
  const outgoingBlocks = myAllocations
    .map(a => {
        const blockedTasks = allocations.filter(b => 
            b.dependencyId === a.id && 
            b.status !== 'completed'
        );
        const myProject = projects.find(p => p.id === a.projectId);
        return { myTask: a, myProject, blockedTasks };
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
                            <div className="flex justify-between items-start">
                                <div>
                                    {/* NOMBRE DEL PROYECTO */}
                                    <Badge variant="outline" className="text-[9px] h-4 bg-white border-slate-200 text-slate-500 mb-1">
                                        {item.depProject?.name}
                                    </Badge>
                                    <div className="font-medium text-slate-700">{item.myTask.taskName}</div>
                                </div>
                                {item.isReady ? (
                                    <span className="flex items-center gap-1 text-[10px] text-emerald-700 font-bold bg-white px-1.5 py-0.5 rounded shadow-sm">
                                        <CheckCircle2 className="w-3 h-3"/> ¡Listo!
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-[10px] text-amber-700 bg-white px-1.5 py-0.5 rounded shadow-sm">
                                        <Clock className="w-3 h-3"/> Espera
                                    </span>
                                )}
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-1">
                                <ArrowRight className="w-3 h-3"/> 
                                {item.isReady ? 'Desbloqueado por' : 'Necesitas a'}: <strong>{item.depOwner?.name}</strong>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* YO BLOQUEO */}
        {outgoingBlocks.length > 0 && (
            <div>
                {incomingDependencies.length > 0 && <div className="border-t border-slate-100 my-3"></div>}
                <h4 className="text-xs font-bold text-red-600 mb-2 uppercase flex items-center gap-1">
                    <AlertOctagon className="w-3 h-3"/> Estás frenando a...
                </h4>
                <div className="space-y-2">
                    {outgoingBlocks.map((item, i) => (
                        <div key={i} className="flex flex-col gap-1 text-xs bg-red-50 p-2 rounded border border-red-100">
                            <div className="flex justify-between items-start">
                                <div>
                                    {/* NOMBRE DEL PROYECTO */}
                                    <Badge variant="outline" className="text-[9px] h-4 bg-white border-red-200 text-red-400 mb-1">
                                        {item.myProject?.name}
                                    </Badge>
                                    <div className="font-medium text-red-900 flex items-center gap-2">
                                        Tu tarea: {item.myTask.taskName}
                                    </div>
                                </div>
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse mt-1"></span>
                            </div>
                            
                            <div className="pl-3 border-l-2 border-red-200 ml-1 space-y-1 mt-1">
                                {item.blockedTasks.map(bt => {
                                    const blockedUser = employees.find(e => e.id === bt.employeeId);
                                    return (
                                        <div key={bt.id} className="text-red-700 flex justify-between items-center">
                                            <span>{bt.taskName}</span>
                                            <span className="font-bold bg-white/60 px-1 rounded text-[10px]">{blockedUser?.name}</span>
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
