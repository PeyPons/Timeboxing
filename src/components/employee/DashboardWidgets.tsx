import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, ArrowRight, AlertOctagon, Link as LinkIcon, CheckCircle2, Clock, Zap, AlertTriangle } from 'lucide-react';
import { isSameMonth, parseISO } from 'date-fns';
import { formatProjectName } from '@/lib/utils';

interface WidgetProps {
  employeeId: string;
}

// WIDGET 1: ALERTAS / RECOMENDACIONES - Altura completa
export function PriorityInsights({ employeeId }: WidgetProps) {
  const { allocations, projects, employees } = useApp();
  const today = new Date();
  
  const myTasks = allocations.filter(a => 
    a.employeeId === employeeId && 
    a.status !== 'completed' &&
    isSameMonth(parseISO(a.weekStartDate), today)
  );

  // Si no hay tareas pendientes
  if (myTasks.length === 0) {
    return (
      <Card className="border shadow-sm bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200 text-slate-700 h-full flex flex-col">
        <CardHeader className="pb-2 border-b bg-slate-50/50">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Sin pendientes
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-slate-500 text-center">
            ✨ <strong>¡Todo al día!</strong><br/>
            No tienes tareas pendientes este mes.
          </p>
        </CardContent>
      </Card>
    );
  }

  // 1. CRITERIO CRÍTICO: ¿ESTOY BLOQUEANDO A ALGUIEN?
  const blockingTask = myTasks.find(t => 
    allocations.some(other => other.dependencyId === t.id && other.status !== 'completed')
  );

  // 2. CRITERIO OPORTUNIDAD: ¿TAREA CASI TERMINADA? (< 2h restantes)
  const quickWinTask = myTasks.find(t => {
    const remaining = t.hoursAssigned - (t.hoursActual || 0);
    return remaining > 0 && remaining <= 2;
  });

  // 3. TAREA MÁS PESADA
  const heavyTask = myTasks.sort((a, b) => b.hoursAssigned - a.hoursAssigned)[0];

  // Determinar qué mostrar
  let recommendation: { icon: React.ReactNode; title: string; content: React.ReactNode; style: string };

  if (blockingTask) {
    const blockedTasks = allocations.filter(a => a.dependencyId === blockingTask.id && a.status !== 'completed');
    const blockedUsers = blockedTasks.map(bt => employees.find(e => e.id === bt.employeeId)?.name || 'Alguien');
    const proj = projects.find(p => p.id === blockingTask.projectId);
    
    recommendation = {
      icon: <AlertTriangle className="w-5 h-5 text-red-600" />,
      title: "🔥 URGENTE: Estás frenando al equipo",
      content: (
        <div className="space-y-3">
          <div className="bg-white/60 rounded-lg p-3 border border-red-100">
            <p className="text-[10px] uppercase tracking-wider text-red-400 font-bold mb-1">Tu tarea pendiente</p>
            <p className="font-bold text-red-900">{blockingTask.taskName}</p>
            <Badge variant="outline" className="mt-1 text-[9px] h-5 bg-white">
              {formatProjectName(proj?.name || '')}
            </Badge>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-red-400 font-bold mb-2 flex items-center gap-1">
              <AlertOctagon className="w-3 h-3" /> Bloquea a:
            </p>
            <div className="space-y-1.5">
              {blockedTasks.slice(0, 3).map((bt, i) => {
                const user = employees.find(e => e.id === bt.employeeId);
                return (
                  <div key={i} className="flex items-center justify-between bg-white/40 rounded px-2 py-1.5">
                    <span className="text-red-800 text-xs truncate max-w-[120px]">{bt.taskName}</span>
                    <Badge className="bg-red-100 text-red-700 border-0 text-[10px] h-5 shrink-0">
                      {user?.name || 'Alguien'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ),
      style: 'bg-gradient-to-br from-red-50 to-orange-50 border-red-200 text-red-900'
    };
  } else if (quickWinTask) {
    const proj = projects.find(p => p.id === quickWinTask.projectId);
    const remaining = quickWinTask.hoursAssigned - (quickWinTask.hoursActual || 0);
    recommendation = {
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
      title: "Quick Win disponible",
      content: (
        <div className="space-y-2">
          <p className="text-sm">
            🎯 <strong>{quickWinTask.taskName}</strong> está casi terminada.
          </p>
          <p className="text-xs text-emerald-600">
            Solo quedan <strong>{remaining.toFixed(1)}h</strong> para completarla en <em>{formatProjectName(proj?.name || '')}</em>.
          </p>
        </div>
      ),
      style: 'bg-emerald-50 border-emerald-200 text-emerald-900'
    };
  } else {
    const proj = projects.find(p => p.id === heavyTask?.projectId);
    recommendation = {
      icon: <Zap className="w-5 h-5 text-amber-600" />,
      title: "Recomendación",
      content: (
        <div className="space-y-2">
          <p className="text-sm">
            🚀 <strong>Foco:</strong> Empieza por <strong>{formatProjectName(proj?.name || '')}</strong>.
          </p>
          <p className="text-xs text-amber-700">
            Es tu bloque más grande ({heavyTask?.hoursAssigned}h).
          </p>
        </div>
      ),
      style: 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 text-amber-900'
    };
  }

  return (
    <Card className={`border shadow-sm h-full flex flex-col ${recommendation.style}`}>
      <CardHeader className="pb-2 border-b bg-white/30">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {recommendation.icon}
          {recommendation.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-4">
        {recommendation.content}
      </CardContent>
    </Card>
  );
}

// WIDGET 2: DEPENDENCIAS - Altura completa
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
      <CardHeader className="pb-2 border-b bg-slate-50/50">
        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-500" />
          Dependencias
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {incomingDependencies.length === 0 && outgoingBlocks.length === 0 && (
          <div className="flex-1 flex items-center justify-center h-full min-h-[100px]">
            <p className="text-xs text-slate-400 text-center">No hay bloqueos activos. ¡Todo fluido!</p>
          </div>
        )}

        {/* DEPENDENCIAS DE ENTRADA (Espero por otros) */}
        {incomingDependencies.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase flex items-center gap-1">
              <LinkIcon className="w-3 h-3"/> Dependencias
            </h4>
            <div className="space-y-2">
              {incomingDependencies.map((item, i) => (
                <div key={i} className={`text-xs rounded-lg border overflow-hidden ${item.isReady ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                  <div className="px-3 py-1.5 bg-white/50 border-b border-slate-100 flex items-center justify-between">
                    <Badge variant="outline" className="text-[9px] h-5 bg-white border-slate-200 text-slate-600">
                      {formatProjectName(item.myProject?.name || '')}
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
                  <div className="px-3 py-2">
                    <p className="font-semibold text-slate-800 mb-1">{item.myTask.taskName}</p>
                    <div className={`flex items-center gap-2 text-[11px] px-2 py-1 rounded ${item.isReady ? 'bg-emerald-100/50' : 'bg-amber-100/50'}`}>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span className="text-slate-600">
                        {item.isReady ? 'Desbloqueado por' : 'Esperando por'}:
                      </span>
                      <span className={`font-bold ${item.isReady ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {item.depOwner?.name}
                      </span>
                      <span className="text-slate-400 text-[10px] truncate max-w-[100px]">
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
            {incomingDependencies.length > 0 && <div className="border-t border-slate-200 my-3"></div>}
            <h4 className="text-xs font-bold text-red-600 mb-2 uppercase flex items-center gap-1">
              <AlertOctagon className="w-3 h-3"/> Estás frenando a...
            </h4>
            <div className="space-y-2">
              {outgoingBlocks.map((item, i) => (
                <div key={i} className="text-xs bg-red-50 rounded-lg border border-red-200 overflow-hidden">
                  <div className="px-3 py-1.5 bg-white/50 border-b border-red-100 flex items-center justify-between">
                    <Badge variant="outline" className="text-[9px] h-5 bg-white border-red-200 text-red-500">
                      {formatProjectName(item.myProject?.name || '')}
                    </Badge>
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                  </div>
                  <div className="px-3 py-2">
                    <p className="font-semibold text-red-900 mb-2">Tu tarea: {item.myTask.taskName}</p>
                    <div className="space-y-1 pl-2 border-l-2 border-red-300">
                      {item.blockedTasks.slice(0, 3).map(bt => {
                        const blockedUser = employees.find(e => e.id === bt.employeeId);
                        return (
                          <div key={bt.id} className="flex items-center justify-between text-[11px]">
                            <span className="text-red-800 truncate max-w-[120px]">{bt.taskName}</span>
                            <Badge className="bg-red-100 text-red-700 border-0 text-[10px] h-5 ml-2 shrink-0">
                              {blockedUser?.name}
                            </Badge>
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
