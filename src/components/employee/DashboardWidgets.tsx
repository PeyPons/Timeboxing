import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, Users, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { startOfWeek, isSameWeek, parseISO } from 'date-fns';

interface WidgetProps {
  employeeId: string;
}

// WIDGET 1: RECOMENDACIONES DE PRIORIDAD
export function PriorityInsights({ employeeId }: WidgetProps) {
  const { allocations, projects } = useApp();
  
  const today = new Date();
  // Filtramos tareas de esta semana para el empleado
  const myTasks = allocations.filter(a => 
    a.employeeId === employeeId && 
    a.status !== 'completed' &&
    isSameWeek(parseISO(a.weekStartDate), today, { weekStartsOn: 1 })
  );

  // Lógica de recomendación simple: Mayor carga asignada = Mayor prioridad
  const sortedTasks = [...myTasks].sort((a, b) => b.hoursAssigned - a.hoursAssigned);
  const topTask = sortedTasks[0];
  const project = projects.find(p => p.id === topTask?.projectId);

  // Cálculo de dispersión (si tiene muchos proyectos distintos)
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
                🚀 <strong>Foco sugerido:</strong> Deberías empezar por <strong>{project?.name}</strong> ({topTask.hoursAssigned}h). Es tu mayor carga esta semana.
            </p>
            {uniqueProjects > 2 && (
                <div className="flex items-start gap-2 text-xs bg-white/60 p-2 rounded text-amber-800">
                    <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>Tienes {uniqueProjects} proyectos activos. Cuidado con el "Context Switching", intenta agrupar tareas por bloques.</span>
                </div>
            )}
        </div>
      </CardContent>
    </Card>
  );
}

// WIDGET 2: VISIÓN DE EQUIPO E INTERDEPENDENCIAS
export function ProjectTeamPulse({ employeeId }: WidgetProps) {
  const { allocations, projects, employees } = useApp();
  
  const today = new Date();
  
  // 1. Mis proyectos activos esta semana
  const myAllocations = allocations.filter(a => 
    a.employeeId === employeeId && 
    isSameWeek(parseISO(a.weekStartDate), today, { weekStartsOn: 1 })
  );
  const myProjectIds = Array.from(new Set(myAllocations.map(a => a.projectId)));

  // 2. Buscar compañeros en esos mismos proyectos
  const teamAllocations = allocations.filter(a => 
    myProjectIds.includes(a.projectId) && 
    a.employeeId !== employeeId && // Que no sea yo
    isSameWeek(parseISO(a.weekStartDate), today, { weekStartsOn: 1 })
  );

  if (teamAllocations.length === 0) return (
      <Card className="border-slate-200 shadow-sm h-full">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Equipo</CardTitle></CardHeader>
          <CardContent><p className="text-xs text-slate-400">Estás solo en tus proyectos esta semana.</p></CardContent>
      </Card>
  );

  return (
    <Card className="border-slate-200 shadow-sm h-full flex flex-col">
      <CardHeader className="pb-3 border-b bg-slate-50/50">
        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-500" />
          Colaboradores & Dependencias
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto max-h-[250px] p-0">
        <div className="divide-y divide-slate-100">
            {myProjectIds.map(projectId => {
                const project = projects.find(p => p.id === projectId);
                const colleagues = teamAllocations.filter(a => a.projectId === projectId);
                
                if (colleagues.length === 0) return null;

                return (
                    <div key={projectId} className="p-3">
                        <div className="flex items-center justify-between mb-2">
                            <Badge variant="outline" className="text-[10px] bg-slate-50 font-bold text-slate-600">
                                {project?.name}
                            </Badge>
                            <span className="text-[10px] text-slate-400">{colleagues.length} compañeros</span>
                        </div>
                        
                        <div className="space-y-2">
                            {colleagues.map(alloc => {
                                const mate = employees.find(e => e.id === alloc.employeeId);
                                // SIMULACIÓN DE DEPENDENCIA:
                                // Si la tarea contiene "Traducción", asumimos que depende de algo.
                                // En una implementación real, usaríamos un campo `alloc.dependencyId`
                                const isBlocked = alloc.taskName.toLowerCase().includes('traducción'); 
                                
                                return (
                                    <div key={alloc.id} className="flex items-start gap-3 pl-1">
                                        <Avatar className="h-6 w-6 mt-0.5">
                                            <AvatarImage src={mate?.avatarUrl} />
                                            <AvatarFallback className="text-[9px]">{mate?.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-medium text-slate-700">{mate?.name}</span>
                                                <span className={`text-[9px] px-1.5 py-0.5 rounded ${alloc.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                    {alloc.status === 'completed' ? 'Terminado' : 'En curso'}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                                                {alloc.taskName}
                                            </p>
                                            
                                            {/* VISUALIZACIÓN DE INTERDEPENDENCIA (Simulada) */}
                                            {isBlocked && (
                                                <div className="flex items-center gap-1 mt-1 text-[10px] text-orange-600 bg-orange-50 px-2 py-1 rounded w-fit">
                                                    <ArrowRight className="w-3 h-3" />
                                                    <span>Esperando tu entrega (Español)</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
      </CardContent>
    </Card>
  );
}
