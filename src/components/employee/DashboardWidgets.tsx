import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, ArrowRight, AlertOctagon, Link as LinkIcon, CheckCircle2, Clock, Flag, Zap, PlayCircle, AlertTriangle } from 'lucide-react';
import { isSameMonth, parseISO } from 'date-fns';

interface WidgetProps {
  employeeId: string;
}

// WIDGET 1: RECOMENDACIONES MEJORADO
export function PriorityInsights({ employeeId }: WidgetProps) {
  const { allocations, projects, employees } = useApp();
  const today = new Date();
  
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
  
  let recommendation = null;

  if (blockingTask) {
      // Obtener TODAS las tareas que estoy bloqueando
      const allBlockedTasks = allocations.filter(other => 
          other.dependencyId === blockingTask.id && other.status !== 'completed'
      );
      const blockedUsers = allBlockedTasks.map(bt => {
          const user = employees.find(e => e.id === bt.employeeId);
          return { task: bt, user };
      });
      const proj = projects.find(p => p.id === blockingTask.projectId);
      
      recommendation = {
          icon: <AlertOctagon className="w-5 h-5 text-red-600" />,
          title: "🔥 URGENTE: Estás frenando al equipo",
          content: (
              <div className="space-y-3">
                  <div className="bg-white/60 rounded-lg p-3 border border-red-100">
                      <p className="text-[10px] uppercase text-red-400 font-semibold mb-1">Tu tarea pendiente</p>
                      <p className="font-bold text-red-900">{blockingTask.taskName || 'Sin nombre'}</p>
                      <Badge variant="outline" className="mt-1 text-[9px] bg-white">
                          {proj?.name}
                      </Badge>
                  </div>
                  
                  <div className="space-y-1.5">
                      <p className="text-[10px] uppercase text-red-400 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Bloquea a:
                      </p>
                      {blockedUsers.map(({ task, user }) => (
                          <div key={task.id} className="flex items-center justify-between bg-white/80 px-2 py-1.5 rounded border border-red-100">
                              <span className="text-xs text-red-800">{task.taskName}</span>
                              <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">
                                  {user?.name}
                              </span>
                          </div>
                      ))}
                  </div>
              </div>
          ),
          style: 'bg-gradient-to-br from-red-50 to-red-100 border-red-300 text-red-900'
      };
  } else if (quickWinTask) {
      const proj = projects.find(p => p.id === quickWinTask.projectId);
      recommendation = {
          icon: <Flag className="w-5 h-5 text-emerald-600" />,
          title: "Cierre Rápido",
          content: (
              <p className="text-sm">
                  🏁 <strong>A punto:</strong> Te queda muy poco en <em>{proj?.name}</em>. ¡Liquídala hoy mismo!
              </p>
          ),
          style: 'bg-emerald-50 border-emerald-200 text-emerald-900'
      };
  } else {
      const proj = projects.find(p => p.id === heavyTask?.projectId);
      recommendation = {
          icon: <Zap className="w-5 h-5 text-amber-600" />,
          title: "Recomendación",
          content: (
              <p className="text-sm">
                  🚀 <strong>Foco:</strong> Empieza por <strong>{proj?.name}</strong>, es tu bloque más grande ({heavyTask?.hoursAssigned}h).
              </p>
          ),
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
        {recommendation.content}
      </CardContent>
    </Card>
  );
}

// WIDGET 2: PULSO DEL EQUIPO Y DEPENDENCIAS MEJORADO
export function ProjectTeamPulse({ employeeId }: WidgetProps) {
  const { allocations, projects, employees } = useApp();
  const today = new Date();
  
  const myAllocations = allocations.filter(a => 
    a.employeeId === employeeId && 
    a.status !== 'completed' && 
    isSameMonth(parseISO(a.weekStartDate), today)
  );

  const incomingDependencies = myAllocations
    .filter(a => a.dependencyId) 
    .map(a => {
        const depTask = allocations.find(d => d.id === a.dependencyId);
        const depOwner = employees.find(e => e.id === depTask?.employeeId);
        const depProject = projects.find(p => p.id === depTask?.projectId);
        const myProject = projects.find(p => p.id === a.projectId);
        const isReady = depTask?.status === 'completed'; 
        return { myTask: a, myProject, depTask, depOwner, depProject, isReady };
    })
    .filter(item => item.depTask !== undefined);

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
      <CardContent className="flex-1 overflow-y-auto max-h-[300px] p-4 space-y-4">
        
        {incomingDependencies.length === 0 && outgoingBlocks.length === 0 && (
             <p className="text-xs text-slate-400 text-center py-4">No hay bloqueos activos. ¡Todo fluido!</p>
        )}

        {/* DEPENDENCIAS DE ENTRADA (Espero por otros) */}
        {incomingDependencies.length > 0 && (
            <div>
                <h4 className="text-xs font-bold text-slate-500 mb-3 uppercase flex items-center gap-1">
                    <LinkIcon className="w-3 h-3"/> Dependencias de entrada
                </h4>
                <div className="space-y-2">
                    {incomingDependencies.map((item, i) => (
                        <div key={i} className={`text-xs rounded-lg border overflow-hidden ${item.isReady ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                            {/* Header con proyecto */}
                            <div className="px-3 py-1.5 bg-white/50 border-b border-slate-100 flex items-center justify-between">
                                <Badge variant="outline" className="text-[9px] h-5 bg-white border-slate-200 text-slate-600">
                                    {item.myProject?.name}
                                </Badge>
                                {item.isReady ? (
                                    <span className="flex items-center gap-1 text-[10px] text-emerald-700 font-bold">
                                        <CheckCircle2 className="w-3 h-3"/> ¡Lista!
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-[10px] text-amber-700">
                                        <Clock className="w-3 h-3"/> Espera
                                    </span>
                                )}
                            </div>
                            
                            {/* Contenido */}
                            <div className="px-3 py-2">
                                <p className="font-semibold text-slate-800 mb-2">{item.myTask.taskName}</p>
                                <div className={`flex items-center gap-2 text-[11px] px-2 py-1.5 rounded ${item.isReady ? 'bg-emerald-100/50' : 'bg-amber-100/50'}`}>
                                    <ArrowRight className="w-3 h-3 text-slate-400" />
                                    <span className="text-slate-600">
                                        {item.isReady ? 'Desbloqueado por' : 'Esperando por'}:
                                    </span>
                                    <span className={`font-bold ${item.isReady ? 'text-emerald-700' : 'text-amber-700'}`}>
                                        {item.depOwner?.name}
                                    </span>
                                    <span className="text-slate-400 text-[10px]">
                                        ({item.depTask?.taskName})
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* DEPENDENCIAS DE SALIDA (Yo bloqueo a otros) */}
        {outgoingBlocks.length > 0 && (
            <div>
                {incomingDependencies.length > 0 && <div className="border-t border-slate-200 my-4"></div>}
                <h4 className="text-xs font-bold text-red-600 mb-3 uppercase flex items-center gap-1">
                    <AlertOctagon className="w-3 h-3"/> Estás frenando a...
                </h4>
                <div className="space-y-3">
                    {outgoingBlocks.map((item, i) => (
                        <div key={i} className="text-xs bg-red-50 rounded-lg border border-red-200 overflow-hidden">
                            {/* Header con proyecto */}
                            <div className="px-3 py-1.5 bg-white/50 border-b border-red-100 flex items-center justify-between">
                                <Badge variant="outline" className="text-[9px] h-5 bg-white border-red-200 text-red-500">
                                    {item.myProject?.name}
                                </Badge>
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                            </div>
                            
                            {/* Contenido */}
                            <div className="px-3 py-2">
                                <p className="font-semibold text-red-900 mb-2">
                                    Tu tarea: {item.myTask.taskName}
                                </p>
                                
                                {/* Lista de bloqueados con mejor formato */}
                                <div className="space-y-1.5 pl-2 border-l-2 border-red-300">
                                    {item.blockedTasks.map(bt => {
                                        const blockedUser = employees.find(e => e.id === bt.employeeId);
                                        return (
                                            <div key={bt.id} className="flex items-center justify-between bg-white/60 px-2 py-1.5 rounded">
                                                <div className="flex items-center gap-2">
                                                    <ArrowRight className="w-3 h-3 text-red-400" />
                                                    <span className="text-red-800">{bt.taskName}</span>
                                                </div>
                                                <span className="font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded text-[10px]">
                                                    {blockedUser?.name}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
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
