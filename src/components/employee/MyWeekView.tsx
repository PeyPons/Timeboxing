import { useMemo, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, isSameMonth, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Sparkles, TrendingUp, TrendingDown, Users, Target, 
  CheckCircle2, Clock, Award, Heart, Filter, HandHelping
} from 'lucide-react';
import { cn, formatProjectName } from '@/lib/utils';

interface MyWeekViewProps {
  employeeId: string;
  viewDate: Date;
}

const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

export function MyWeekView({ employeeId, viewDate }: MyWeekViewProps) {
  const { allocations, projects, clients, employees, getEmployeeMonthlyLoad } = useApp();
  
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterTeammate, setFilterTeammate] = useState<string>('all');
  
  const monthLabel = format(viewDate, 'MMMM yyyy', { locale: es });
  
  // Allocations del mes para este empleado
  const monthlyAllocations = allocations.filter(a => 
    a.employeeId === employeeId && 
    isSameMonth(parseISO(a.weekStartDate), viewDate)
  );

  // Métricas globales del mes
  const monthlyStats = useMemo(() => {
    const load = getEmployeeMonthlyLoad(employeeId, viewDate.getFullYear(), viewDate.getMonth());
    
    const completed = monthlyAllocations.filter(a => a.status === 'completed');
    const totalTasks = monthlyAllocations.length;
    const completedTasks = completed.length;
    
    const totalEstimated = monthlyAllocations.reduce((sum, a) => sum + a.hoursAssigned, 0);
    const totalReal = completed.reduce((sum, a) => sum + (a.hoursActual || 0), 0);
    const totalComputed = completed.reduce((sum, a) => sum + (a.hoursComputed || 0), 0);
    
    const executionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    
    return {
      ...load,
      totalTasks,
      completedTasks,
      totalEstimated: round2(totalEstimated),
      totalReal: round2(totalReal),
      totalComputed: round2(totalComputed),
      executionRate: round2(executionRate)
    };
  }, [employeeId, viewDate, monthlyAllocations, getEmployeeMonthlyLoad]);

  // Agrupar por proyecto con métricas de impacto y compañeros detallados
  const projectGroups = useMemo(() => {
    const groups: Record<string, {
      projectId: string;
      projectName: string;
      clientName: string;
      clientColor: string;
      myEstimated: number;
      myReal: number;
      myComputed: number;
      myTasks: number;
      myCompletedTasks: number;
      projectTotalComputed: number;
      projectBudget: number;
      // Compañeros con detalle
      teammates: { 
        id: string; 
        name: string; 
        avatarUrl?: string;
        hoursComputed: number;
        impactPercentage: number;
      }[];
      myImpactPercentage: number;
    }> = {};

    // Procesar mis allocations
    monthlyAllocations.forEach(alloc => {
      if (!groups[alloc.projectId]) {
        const proj = projects.find(p => p.id === alloc.projectId);
        const cli = clients.find(c => c.id === proj?.clientId);
        groups[alloc.projectId] = {
          projectId: alloc.projectId,
          projectName: proj?.name || 'Sin proyecto',
          clientName: cli?.name || 'Interno',
          clientColor: cli?.color || '#6b7280',
          myEstimated: 0,
          myReal: 0,
          myComputed: 0,
          myTasks: 0,
          myCompletedTasks: 0,
          projectTotalComputed: 0,
          projectBudget: proj?.budgetHours || 0,
          teammates: [],
          myImpactPercentage: 0
        };
      }

      groups[alloc.projectId].myEstimated += alloc.hoursAssigned;
      groups[alloc.projectId].myTasks += 1;
      
      if (alloc.status === 'completed') {
        groups[alloc.projectId].myReal += alloc.hoursActual || 0;
        groups[alloc.projectId].myComputed += alloc.hoursComputed || 0;
        groups[alloc.projectId].myCompletedTasks += 1;
      }
    });

    // Calcular totales del proyecto y compañeros con sus aportes
    Object.keys(groups).forEach(projId => {
      const allProjectAllocations = allocations.filter(a => 
        a.projectId === projId && 
        isSameMonth(parseISO(a.weekStartDate), viewDate)
      );
      
      // Total computado del proyecto
      const projectTotal = allProjectAllocations
        .filter(a => a.status === 'completed')
        .reduce((sum, a) => sum + (a.hoursComputed || 0), 0);
      
      groups[projId].projectTotalComputed = round2(projectTotal);
      
      // Mi impacto
      if (projectTotal > 0) {
        groups[projId].myImpactPercentage = round2((groups[projId].myComputed / projectTotal) * 100);
      }
      
      // Compañeros con sus horas y porcentaje
      const teammateHours: Record<string, number> = {};
      allProjectAllocations
        .filter(a => a.employeeId !== employeeId && a.status === 'completed')
        .forEach(a => {
          if (!teammateHours[a.employeeId]) teammateHours[a.employeeId] = 0;
          teammateHours[a.employeeId] += a.hoursComputed || 0;
        });
      
      groups[projId].teammates = Object.entries(teammateHours).map(([empId, hours]) => {
        const emp = employees.find(e => e.id === empId);
        return {
          id: empId,
          name: emp?.name || 'Desconocido',
          avatarUrl: emp?.avatarUrl,
          hoursComputed: round2(hours),
          impactPercentage: projectTotal > 0 ? round2((hours / projectTotal) * 100) : 0
        };
      }).sort((a, b) => b.hoursComputed - a.hoursComputed);
    });

    return Object.values(groups)
      .map(g => ({
        ...g,
        myEstimated: round2(g.myEstimated),
        myReal: round2(g.myReal),
        myComputed: round2(g.myComputed)
      }))
      .sort((a, b) => b.myComputed - a.myComputed);
  }, [monthlyAllocations, allocations, projects, clients, employees, employeeId, viewDate]);

  // Colaboradores frecuentes (con quién más compartes proyectos)
  const frequentCollaborators = useMemo(() => {
    const collabMap: Record<string, { 
      id: string; 
      name: string; 
      avatarUrl?: string;
      sharedProjects: number; 
      totalHoursTogether: number;
      occupancy: number;
    }> = {};

    projectGroups.forEach(group => {
      group.teammates.forEach(tm => {
        if (!collabMap[tm.id]) {
          const emp = employees.find(e => e.id === tm.id);
          const empLoad = getEmployeeMonthlyLoad(tm.id, viewDate.getFullYear(), viewDate.getMonth());
          collabMap[tm.id] = {
            id: tm.id,
            name: tm.name,
            avatarUrl: tm.avatarUrl,
            sharedProjects: 0,
            totalHoursTogether: 0,
            occupancy: empLoad.percentage
          };
        }
        collabMap[tm.id].sharedProjects += 1;
        collabMap[tm.id].totalHoursTogether += tm.hoursComputed;
      });
    });

    return Object.values(collabMap)
      .sort((a, b) => b.sharedProjects - a.sharedProjects)
      .slice(0, 5);
  }, [projectGroups, employees, getEmployeeMonthlyLoad, viewDate]);

  // Compañeros que pueden ayudar (ocupación < 80% y comparten proyectos)
  const availableHelpers = useMemo(() => {
    return frequentCollaborators
      .filter(c => c.occupancy < 80)
      .sort((a, b) => a.occupancy - b.occupancy)
      .slice(0, 3);
  }, [frequentCollaborators]);

  // Lista de todos los compañeros únicos para filtro
  const allTeammates = useMemo(() => {
    const set = new Set<string>();
    projectGroups.forEach(g => g.teammates.forEach(t => set.add(t.id)));
    return Array.from(set).map(id => employees.find(e => e.id === id)).filter(Boolean);
  }, [projectGroups, employees]);

  // Filtrar proyectos
  const filteredProjects = useMemo(() => {
    return projectGroups.filter(g => {
      if (filterProject !== 'all' && g.projectId !== filterProject) return false;
      if (filterTeammate !== 'all' && !g.teammates.some(t => t.id === filterTeammate)) return false;
      return true;
    });
  }, [projectGroups, filterProject, filterTeammate]);

  // Balance total del mes
  const monthlyBalance = round2(monthlyStats.totalComputed - monthlyStats.totalReal);
  const isPositiveBalance = monthlyBalance >= 0;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header con título, KPIs y filtros */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 capitalize flex items-center gap-2">
                {monthLabel}
              </h2>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Target className="h-3.5 w-3.5" /> Rendimiento por proyecto
              </p>
            </div>
            
            {/* KPIs compactos */}
            <div className="flex items-center gap-3 flex-wrap">
              <Tooltip>
                <TooltipTrigger>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
                    <Clock className="h-4 w-4 text-slate-500" />
                    <span className="text-sm font-bold text-slate-700">~{monthlyStats.capacity}h</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Tu capacidad disponible este mes</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger>
                  <div className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg",
                    monthlyStats.executionRate >= 50 ? "bg-emerald-50" : "bg-amber-50"
                  )}>
                    <CheckCircle2 className={cn("h-4 w-4", monthlyStats.executionRate >= 50 ? "text-emerald-500" : "text-amber-500")} />
                    <span className={cn("text-sm font-bold", monthlyStats.executionRate >= 50 ? "text-emerald-700" : "text-amber-700")}>
                      {monthlyStats.executionRate}%
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>{monthlyStats.completedTasks} de {monthlyStats.totalTasks} tareas completadas</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Filtros */}
          {(projectGroups.length > 1 || allTeammates.length > 0) && (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-400" />
                <Select value={filterProject} onValueChange={setFilterProject}>
                  <SelectTrigger className="w-[180px] h-8 text-xs">
                    <SelectValue placeholder="Todos los proyectos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los proyectos</SelectItem>
                    {projectGroups.map(g => (
                      <SelectItem key={g.projectId} value={g.projectId}>
                        {formatProjectName(g.projectName)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {allTeammates.length > 0 && (
                <Select value={filterTeammate} onValueChange={setFilterTeammate}>
                  <SelectTrigger className="w-[180px] h-8 text-xs">
                    <SelectValue placeholder="Todos los compañeros" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los compañeros</SelectItem>
                    {allTeammates.map(emp => emp && (
                      <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>

        {/* Grid de proyectos - altura uniforme */}
        {filteredProjects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Sparkles className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p className="text-muted-foreground">
                {filterProject !== 'all' || filterTeammate !== 'all' 
                  ? "No hay proyectos con esos filtros." 
                  : "Sin proyectos asignados este mes."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredProjects.map(group => {
              const balance = round2(group.myComputed - group.myReal);
              const isPositive = balance >= 0;
              const completionRate = group.myTasks > 0 ? round2((group.myCompletedTasks / group.myTasks) * 100) : 0;
              const isHighImpact = group.myImpactPercentage >= 50;
              const isMediumImpact = group.myImpactPercentage >= 25 && group.myImpactPercentage < 50;
              
              return (
                <Card key={group.projectId} className={cn("flex flex-col h-full transition-all hover:shadow-md", isHighImpact && "ring-2 ring-emerald-200")}>
                  {/* Header */}
                  <CardHeader className="pb-2 pt-4 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-sm font-bold truncate" title={group.projectName}>
                          {formatProjectName(group.projectName)}
                        </CardTitle>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: group.clientColor }} />
                          <span className="text-xs text-muted-foreground truncate">{group.clientName}</span>
                        </div>
                      </div>
                      
                      {/* Badge de impacto */}
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge variant="outline" className={cn(
                            "shrink-0 gap-1",
                            isHighImpact ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                              : isMediumImpact ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                              : "bg-slate-50 text-slate-600 border-slate-200"
                          )}>
                            {isHighImpact ? <Award className="h-3 w-3" /> : <Target className="h-3 w-3" />}
                            {group.myImpactPercentage}%
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-[200px]">
                          <p className="font-semibold mb-1">
                            {isHighImpact ? "¡Alto impacto!" : isMediumImpact ? "Impacto notable" : "Tu contribución"}
                          </p>
                          <p className="text-xs">
                            Aportas el {group.myImpactPercentage}% del trabajo total del proyecto este mes.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    
                    {/* Compañeros con avatares */}
                    {group.teammates.length > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        <Users className="h-3 w-3 text-slate-400" />
                        <div className="flex -space-x-2">
                          {group.teammates.slice(0, 4).map(tm => (
                            <Tooltip key={tm.id}>
                              <TooltipTrigger>
                                <Avatar className="h-6 w-6 border-2 border-white">
                                  <AvatarImage src={tm.avatarUrl} />
                                  <AvatarFallback className="text-[10px] bg-slate-100">
                                    {tm.name.substring(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-semibold">{tm.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {tm.hoursComputed}h computadas ({tm.impactPercentage}%)
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                          {group.teammates.length > 4 && (
                            <Tooltip>
                              <TooltipTrigger>
                                <div className="h-6 w-6 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-medium text-slate-600">
                                  +{group.teammates.length - 4}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                {group.teammates.slice(4).map(tm => (
                                  <div key={tm.id} className="text-xs">{tm.name}: {tm.hoursComputed}h</div>
                                ))}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    )}
                  </CardHeader>

                  <CardContent className="px-4 pb-4 pt-2 space-y-3 flex-1 flex flex-col">
                    {/* Barra de progreso */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Tareas completadas</span>
                        <span className="font-medium">{group.myCompletedTasks}/{group.myTasks}</span>
                      </div>
                      <Progress value={completionRate} className="h-1.5" />
                    </div>

                    {/* Métricas - flex-1 para empujar balance abajo */}
                    <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t flex-1">
                      <div className="space-y-0.5">
                        <p className="text-lg font-bold text-slate-700">{group.myEstimated}h</p>
                        <p className="text-[10px] text-slate-400 uppercase">Estimado</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-lg font-bold text-blue-600">{group.myReal}h</p>
                        <p className="text-[10px] text-blue-400 uppercase">Real</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-lg font-bold text-emerald-600">{group.myComputed}h</p>
                        <p className="text-[10px] text-emerald-400 uppercase">Computado</p>
                      </div>
                    </div>

                    {/* Balance - siempre al final */}
                    {group.myCompletedTasks > 0 && (
                      <div className={cn(
                        "flex items-center justify-between px-3 py-2 rounded-lg mt-auto",
                        isPositive ? "bg-emerald-50" : "bg-red-50"
                      )}>
                        <span className="text-xs font-medium text-slate-600">Balance</span>
                        <div className={cn("flex items-center gap-1 font-bold text-sm", isPositive ? "text-emerald-600" : "text-red-600")}>
                          {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                          {isPositive ? '+' : ''}{balance}h
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Bloque de Colaboradores y Ayuda */}
        {(frequentCollaborators.length > 0 || availableHelpers.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Colaboradores frecuentes */}
            {frequentCollaborators.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4 text-indigo-600" />
                    Colaboradores frecuentes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {frequentCollaborators.map(collab => (
                    <div key={collab.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={collab.avatarUrl} />
                        <AvatarFallback className="text-xs">{collab.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{collab.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {collab.sharedProjects} {collab.sharedProjects === 1 ? 'proyecto' : 'proyectos'} · {round2(collab.totalHoursTogether)}h juntos
                        </p>
                      </div>
                      <Badge variant="outline" className={cn(
                        "text-[10px]",
                        collab.occupancy > 90 ? "text-red-600 border-red-200" 
                          : collab.occupancy > 70 ? "text-amber-600 border-amber-200"
                          : "text-emerald-600 border-emerald-200"
                      )}>
                        {collab.occupancy}%
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Compañeros con disponibilidad */}
            {availableHelpers.length > 0 && (
              <Card className="border-emerald-200 bg-emerald-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-emerald-700">
                    <HandHelping className="h-4 w-4" />
                    ¿Necesitas ayuda?
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-emerald-600 mb-3">
                    Estos compañeros comparten proyectos contigo y tienen disponibilidad:
                  </p>
                  {availableHelpers.map(helper => (
                    <div key={helper.id} className="flex items-center gap-3 p-2 rounded-lg bg-white border border-emerald-100">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={helper.avatarUrl} />
                        <AvatarFallback className="text-xs">{helper.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{helper.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Ocupación: {helper.occupancy}%
                        </p>
                      </div>
                      <Badge className="bg-emerald-100 text-emerald-700 border-0">
                        Disponible
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Resumen motivacional */}
        {projectGroups.length > 0 && monthlyStats.totalComputed > 0 && (
          <Card className={cn(
            "border-l-4",
            isPositiveBalance ? "border-l-emerald-500 bg-emerald-50/30" : "border-l-amber-500 bg-amber-50/30"
          )}>
            <CardContent className="py-4 px-5">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  {isPositiveBalance ? (
                    <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                      <Heart className="h-5 w-5 text-emerald-600" />
                    </div>
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                      <TrendingDown className="h-5 w-5 text-amber-600" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-slate-800">
                      {isPositiveBalance ? "¡Buen trabajo este mes!" : "Hay margen de mejora"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isPositiveBalance 
                        ? `Has generado ${monthlyBalance}h extra de valor para los clientes.`
                        : `El balance es de ${monthlyBalance}h. Revisa las estimaciones.`}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-center">
                    <p className="font-bold text-blue-600">{monthlyStats.totalReal}h</p>
                    <p className="text-[10px] text-blue-400">Trabajadas</p>
                  </div>
                  <div className="text-slate-300">→</div>
                  <div className="text-center">
                    <p className="font-bold text-emerald-600">{monthlyStats.totalComputed}h</p>
                    <p className="text-[10px] text-emerald-400">Facturadas</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}
