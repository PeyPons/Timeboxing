import { useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format, isSameMonth, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Sparkles, TrendingUp, TrendingDown, Users, Target, 
  CheckCircle2, Clock, Zap, Award, Heart
} from 'lucide-react';
import { cn, formatProjectName } from '@/lib/utils';

interface MyWeekViewProps {
  employeeId: string;
  viewDate: Date;
}

const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

export function MyWeekView({ employeeId, viewDate }: MyWeekViewProps) {
  const { allocations, projects, clients, employees, getEmployeeMonthlyLoad } = useApp();
  
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

  // Agrupar por proyecto con métricas de impacto
  const projectGroups = useMemo(() => {
    const groups: Record<string, {
      projectId: string;
      projectName: string;
      clientName: string;
      clientColor: string;
      // Mis métricas
      myEstimated: number;
      myReal: number;
      myComputed: number;
      myTasks: number;
      myCompletedTasks: number;
      // Totales del proyecto (todos los empleados)
      projectTotalComputed: number;
      projectBudget: number;
      // Compañeros trabajando
      teamMembers: string[];
      // Impacto calculado
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
          teamMembers: [],
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

    // Calcular totales del proyecto y compañeros
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
      
      // Mi impacto = mis horas computadas / total del proyecto
      if (projectTotal > 0) {
        groups[projId].myImpactPercentage = round2((groups[projId].myComputed / projectTotal) * 100);
      }
      
      // Compañeros de equipo (otros empleados en este proyecto este mes)
      const otherEmployeeIds = [...new Set(
        allProjectAllocations
          .filter(a => a.employeeId !== employeeId)
          .map(a => a.employeeId)
      )];
      
      groups[projId].teamMembers = otherEmployeeIds
        .map(id => employees.find(e => e.id === id)?.name?.split(' ')[0] || '')
        .filter(Boolean);
    });

    // Ordenar por impacto descendente
    return Object.values(groups)
      .map(g => ({
        ...g,
        myEstimated: round2(g.myEstimated),
        myReal: round2(g.myReal),
        myComputed: round2(g.myComputed)
      }))
      .sort((a, b) => b.myComputed - a.myComputed);
  }, [monthlyAllocations, allocations, projects, clients, employees, employeeId, viewDate]);

  // Balance total del mes (ganancia/pérdida)
  const monthlyBalance = round2(monthlyStats.totalComputed - monthlyStats.totalReal);
  const isPositiveBalance = monthlyBalance >= 0;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header con título y métricas principales */}
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
                  <span className="text-xs text-slate-400">capacidad</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Tu capacidad disponible este mes</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-lg">
                  <Zap className="h-4 w-4 text-indigo-500" />
                  <span className="text-sm font-bold text-indigo-700">{monthlyStats.totalEstimated}h</span>
                  <span className="text-xs text-indigo-400">asignado</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Horas planificadas para ti este mes</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger>
                <div className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg",
                  monthlyStats.executionRate >= 50 ? "bg-emerald-50" : "bg-amber-50"
                )}>
                  <CheckCircle2 className={cn(
                    "h-4 w-4",
                    monthlyStats.executionRate >= 50 ? "text-emerald-500" : "text-amber-500"
                  )} />
                  <span className={cn(
                    "text-sm font-bold",
                    monthlyStats.executionRate >= 50 ? "text-emerald-700" : "text-amber-700"
                  )}>
                    {monthlyStats.executionRate}%
                  </span>
                  <span className={cn(
                    "text-xs",
                    monthlyStats.executionRate >= 50 ? "text-emerald-400" : "text-amber-400"
                  )}>
                    ejecución
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {monthlyStats.completedTasks} de {monthlyStats.totalTasks} tareas completadas
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Grid de proyectos */}
        {projectGroups.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Sparkles className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p className="text-muted-foreground">Sin proyectos asignados este mes.</p>
              <p className="text-xs text-slate-400 mt-1">Usa "Añadir tareas" para planificar tu trabajo.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projectGroups.map(group => {
              const balance = round2(group.myComputed - group.myReal);
              const isPositive = balance >= 0;
              const completionRate = group.myTasks > 0 
                ? round2((group.myCompletedTasks / group.myTasks) * 100) 
                : 0;
              
              // Determinar si tengo un impacto significativo
              const isHighImpact = group.myImpactPercentage >= 50;
              const isMediumImpact = group.myImpactPercentage >= 25 && group.myImpactPercentage < 50;
              
              return (
                <Card 
                  key={group.projectId} 
                  className={cn(
                    "transition-all hover:shadow-md overflow-hidden",
                    isHighImpact && "ring-2 ring-emerald-200"
                  )}
                >
                  {/* Header con nombre y badge de impacto */}
                  <CardHeader className="pb-2 pt-4 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-sm font-bold truncate" title={group.projectName}>
                          {formatProjectName(group.projectName)}
                        </CardTitle>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span 
                            className="w-2 h-2 rounded-full shrink-0" 
                            style={{ backgroundColor: group.clientColor }}
                          />
                          <span className="text-xs text-muted-foreground truncate">
                            {group.clientName}
                          </span>
                        </div>
                      </div>
                      
                      {/* Badge de impacto */}
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge 
                            variant="outline"
                            className={cn(
                              "shrink-0 gap-1",
                              isHighImpact 
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                                : isMediumImpact
                                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                  : "bg-slate-50 text-slate-600 border-slate-200"
                            )}
                          >
                            {isHighImpact ? (
                              <Award className="h-3 w-3" />
                            ) : (
                              <Target className="h-3 w-3" />
                            )}
                            {group.myImpactPercentage}%
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-[200px]">
                          <p className="font-semibold mb-1">
                            {isHighImpact 
                              ? "¡Alto impacto!" 
                              : isMediumImpact 
                                ? "Impacto notable" 
                                : "Tu contribución"}
                          </p>
                          <p className="text-xs">
                            Aportas el {group.myImpactPercentage}% del trabajo total del proyecto este mes.
                            {isHighImpact && " ¡Eres clave en este proyecto!"}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    
                    {/* Compañeros de equipo */}
                    {group.teamMembers.length > 0 && (
                      <div className="flex items-center gap-1 mt-2">
                        <Users className="h-3 w-3 text-slate-400" />
                        <span className="text-[10px] text-slate-400">
                          +{group.teamMembers.length} {group.teamMembers.length === 1 ? 'compañero' : 'compañeros'}
                        </span>
                      </div>
                    )}
                  </CardHeader>

                  <CardContent className="px-4 pb-4 pt-2 space-y-3">
                    {/* Barra de progreso de tareas */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Tareas completadas</span>
                        <span className="font-medium">{group.myCompletedTasks}/{group.myTasks}</span>
                      </div>
                      <Progress value={completionRate} className="h-1.5" />
                    </div>

                    {/* Métricas de horas */}
                    <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t">
                      <Tooltip>
                        <TooltipTrigger className="space-y-0.5">
                          <p className="text-lg font-bold text-slate-700">{group.myEstimated}h</p>
                          <p className="text-[10px] text-slate-400 uppercase">Estimado</p>
                        </TooltipTrigger>
                        <TooltipContent>Horas que estimaste para tus tareas</TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger className="space-y-0.5">
                          <p className="text-lg font-bold text-blue-600">{group.myReal}h</p>
                          <p className="text-[10px] text-blue-400 uppercase">Real</p>
                        </TooltipTrigger>
                        <TooltipContent>Horas reales trabajadas</TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger className="space-y-0.5">
                          <p className="text-lg font-bold text-emerald-600">{group.myComputed}h</p>
                          <p className="text-[10px] text-emerald-400 uppercase">Computado</p>
                        </TooltipTrigger>
                        <TooltipContent>Horas facturables al cliente</TooltipContent>
                      </Tooltip>
                    </div>

                    {/* Balance */}
                    {group.myCompletedTasks > 0 && (
                      <div className={cn(
                        "flex items-center justify-between px-3 py-2 rounded-lg",
                        isPositive ? "bg-emerald-50" : "bg-red-50"
                      )}>
                        <span className="text-xs font-medium text-slate-600">Balance</span>
                        <div className={cn(
                          "flex items-center gap-1 font-bold text-sm",
                          isPositive ? "text-emerald-600" : "text-red-600"
                        )}>
                          {isPositive ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
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
                      {isPositiveBalance 
                        ? "¡Buen trabajo este mes!" 
                        : "Hay margen de mejora"}
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
