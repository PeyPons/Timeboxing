import { useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format, isSameMonth, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle, TrendingUp, TrendingDown, Calendar, PieChart, Briefcase, AlertTriangle, Users, Target } from 'lucide-react';
import { getWeeksForMonth } from '@/utils/dateUtils';
import { cn, formatProjectName } from '@/lib/utils';

interface MyWeekViewProps {
  employeeId: string;
  viewDate: Date;
}

export function MyWeekView({ employeeId, viewDate }: MyWeekViewProps) {
  const { allocations, projects, clients, employees } = useApp();
  
  const monthLabel = format(viewDate, 'MMMM yyyy', { locale: es });
  
  // 1. Filtrar Allocations del Mes
  const monthlyAllocations = allocations.filter(a => 
    a.employeeId === employeeId && 
    (a.status === 'planned' || a.status === 'active' || a.status === 'completed') &&
    isSameMonth(parseISO(a.weekStartDate), viewDate)
  );

  // 2. AGRUPAR POR PROYECTO con métricas del proyecto completo
  const projectGroups = useMemo(() => {
      const groups: Record<string, {
          projectId: string;
          projectName: string;
          clientName: string;
          // Mis horas
          myEst: number;
          myReal: number;
          myComp: number;
          // Total del proyecto (todos los empleados)
          projectTotalEst: number;
          projectTotalReal: number;
          projectTotalComp: number;
          projectBudget: number;
          // Otros miembros del equipo
          teamMembers: { name: string; hours: number }[];
          // Contadores
          taskCount: number;
          completedCount: number;
          blockingCount: number;
      }> = {};

      // Primero, procesar mis allocations
      monthlyAllocations.forEach(alloc => {
          if (!groups[alloc.projectId]) {
              const proj = projects.find(p => p.id === alloc.projectId);
              const cli = clients.find(c => c.id === proj?.clientId);
              groups[alloc.projectId] = {
                  projectId: alloc.projectId,
                  projectName: proj?.name || 'Sin Proyecto',
                  clientName: cli?.name || 'Interno',
                  myEst: 0,
                  myReal: 0,
                  myComp: 0,
                  projectTotalEst: 0,
                  projectTotalReal: 0,
                  projectTotalComp: 0,
                  projectBudget: proj?.budgetHours || 0,
                  teamMembers: [],
                  taskCount: 0,
                  completedCount: 0,
                  blockingCount: 0
              };
          }
          const g = groups[alloc.projectId];
          g.myEst += Number(alloc.hoursAssigned);
          g.myReal += Number(alloc.hoursActual || 0);
          g.myComp += Number(alloc.hoursComputed || 0);
          g.taskCount += 1;
          if (alloc.status === 'completed') g.completedCount += 1;
          
          // Verificar si esta tarea bloquea a alguien
          const isBlocking = allocations.some(other => other.dependencyId === alloc.id && other.status !== 'completed');
          if (isBlocking && alloc.status !== 'completed') g.blockingCount += 1;
      });

      // Ahora, calcular totales del proyecto (TODOS los empleados, mismo mes)
      Object.keys(groups).forEach(projectId => {
          const g = groups[projectId];
          const teamMembersMap: Record<string, number> = {};
          
          // Todas las allocations del proyecto en este mes
          allocations
            .filter(a => 
              a.projectId === projectId && 
              isSameMonth(parseISO(a.weekStartDate), viewDate) &&
              (a.status === 'planned' || a.status === 'active' || a.status === 'completed')
            )
            .forEach(alloc => {
              g.projectTotalEst += Number(alloc.hoursAssigned);
              g.projectTotalReal += Number(alloc.hoursActual || 0);
              g.projectTotalComp += Number(alloc.hoursComputed || 0);
              
              // Registrar otros miembros del equipo
              if (alloc.employeeId !== employeeId) {
                const emp = employees.find(e => e.id === alloc.employeeId);
                const empName = emp?.first_name || emp?.name || 'Otro';
                teamMembersMap[empName] = (teamMembersMap[empName] || 0) + Number(alloc.hoursAssigned);
              }
            });
          
          g.teamMembers = Object.entries(teamMembersMap)
            .map(([name, hours]) => ({ name, hours }))
            .sort((a, b) => b.hours - a.hours)
            .slice(0, 3); // Top 3
      });

      return Object.values(groups).sort((a, b) => b.myEst - a.myEst);
  }, [monthlyAllocations, projects, clients, allocations, employees, employeeId, viewDate]);

  // CÁLCULOS TOTALES (Header)
  const totalAssigned = projectGroups.reduce((acc, g) => acc + g.myEst, 0);
  const totalDone = projectGroups.reduce((acc, g) => acc + g.myReal, 0);
  
  const me = employees.find(e => e.id === employeeId);
  const weeksCount = getWeeksForMonth(viewDate).length;
  const monthlyCapacity = (me?.defaultWeeklyCapacity || 40) * weeksCount;
  const totalProgress = totalAssigned > 0 ? Math.min(100, (totalDone / totalAssigned) * 100) : 0;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        
        {/* 1. HEADER RESUMEN MENSUAL */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b pb-6">
          <div>
              <h2 className="text-2xl font-bold text-slate-900 capitalize">{monthLabel}</h2>
              <p className="text-slate-500 flex items-center gap-2 mt-1">
                  <Calendar className="w-4 h-4"/> Rendimiento por Proyecto
              </p>
          </div>
          
          <div className="flex items-center gap-6 bg-white p-4 rounded-xl border shadow-sm w-full md:w-auto">
              <div className="text-center">
                  <div className="text-xs text-slate-400 uppercase font-semibold">Capacidad Mes</div>
                  <div className="font-mono text-lg font-bold text-slate-700">~{monthlyCapacity}h</div>
              </div>
              <div className="h-8 w-px bg-slate-200"></div>
              <div className="text-center">
                  <div className="text-xs text-slate-400 uppercase font-semibold">Asignado</div>
                  <div className={`font-mono text-lg font-bold ${totalAssigned > monthlyCapacity ? 'text-red-500' : 'text-indigo-600'}`}>
                      {totalAssigned.toFixed(1)}h
                  </div>
              </div>
              <div className="h-8 w-px bg-slate-200"></div>
              <div className="flex-1 min-w-[120px]">
                  <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">Ejecución</span>
                      <span className="font-bold text-emerald-600">{totalProgress.toFixed(0)}%</span>
                  </div>
                  <Progress value={totalProgress} className="h-2" />
              </div>
          </div>
        </div>

        {/* 2. GRID DE PROYECTOS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projectGroups.length === 0 ? (
              <div className="col-span-full py-16 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                  <Briefcase className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <div className="text-slate-500 font-medium">Sin actividad</div>
                  <div className="text-slate-400 text-sm">No hay proyectos asignados este mes.</div>
              </div>
          ) : (
              projectGroups.map(group => {
                  const balance = group.myComp - group.myReal;
                  const isPositive = balance >= 0;
                  
                  // % de MI aportación sobre el total del proyecto
                  const myContribution = group.projectTotalEst > 0 
                    ? (group.myEst / group.projectTotalEst) * 100 
                    : 100;
                  
                  // % de consumo del presupuesto del proyecto
                  const budgetUsage = group.projectBudget > 0 
                    ? (group.projectTotalComp / group.projectBudget) * 100 
                    : 0;
                  
                  // Mi impacto sobre el presupuesto total
                  const myBudgetImpact = group.projectBudget > 0 
                    ? (group.myEst / group.projectBudget) * 100 
                    : 0;

                  const isOverBudget = group.projectBudget > 0 && group.projectTotalEst > group.projectBudget;
                  const hasBudget = group.projectBudget > 0;

                  return (
                      <Card key={group.projectId} className={cn(
                        "flex flex-col shadow-sm border overflow-hidden hover:shadow-md transition-shadow group",
                        isOverBudget ? "border-red-200" : "border-slate-200"
                      )}>
                          
                          {/* CABECERA PROYECTO */}
                          <div className="p-4 pb-3 border-b border-slate-100 bg-white">
                              <div className="flex justify-between items-start mb-1 gap-2">
                                  <h3 className="text-lg font-bold text-slate-900 leading-tight truncate" title={group.projectName}>
                                      {formatProjectName(group.projectName)}
                                  </h3>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge 
                                        variant="secondary" 
                                        className={cn(
                                          "text-[10px] cursor-help shrink-0",
                                          hasBudget && myBudgetImpact >= 50 
                                            ? "bg-purple-100 text-purple-700 border-purple-200"
                                            : hasBudget && myBudgetImpact >= 25 
                                              ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                                              : "bg-slate-100 text-slate-600 border-slate-200"
                                        )}
                                      >
                                          <PieChart className="w-3 h-3 mr-1"/> Tu impacto: {hasBudget ? `${myBudgetImpact.toFixed(0)}%` : '—'}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-[220px]">
                                      {hasBudget ? (
                                        <>
                                          <p className="text-xs">
                                            <strong>Tu aportación:</strong> {group.myEst.toFixed(1)}h de {group.projectBudget}h presupuestadas
                                          </p>
                                          <p className="text-xs text-slate-500 mt-1">
                                            Aportas el {myContribution.toFixed(0)}% del trabajo total del equipo
                                          </p>
                                        </>
                                      ) : (
                                        <p className="text-xs text-slate-500">
                                          Este proyecto no tiene presupuesto definido
                                        </p>
                                      )}
                                    </TooltipContent>
                                  </Tooltip>
                              </div>
                              
                              {/* Fila inferior con altura fija */}
                              <div className="flex items-center justify-between mt-2 h-5">
                                  <div className="flex items-center gap-2 text-xs text-slate-500">
                                      <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                                      <span className="truncate max-w-[100px]">{group.clientName}</span>
                                  </div>
                                  
                                  <div className="flex items-center gap-3">
                                    {/* Team members indicator - siempre ocupa espacio */}
                                    {group.teamMembers.length > 0 ? (
                                      <Tooltip>
                                        <TooltipTrigger>
                                          <div className="flex items-center gap-1 text-[10px] text-slate-500 cursor-help">
                                            <Users className="w-3 h-3" />
                                            <span>+{group.teamMembers.length}</span>
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                          <p className="text-xs font-medium mb-1">Otros en este proyecto:</p>
                                          {group.teamMembers.map(m => (
                                            <p key={m.name} className="text-xs text-slate-500">
                                              {m.name}: {m.hours.toFixed(1)}h
                                            </p>
                                          ))}
                                        </TooltipContent>
                                      </Tooltip>
                                    ) : (
                                      <div className="w-8" /> 
                                    )}
                                    
                                    {group.blockingCount > 0 && (
                                        <span className="text-[10px] text-red-600 flex items-center gap-1 font-bold animate-pulse">
                                            <AlertTriangle className="w-3 h-3"/> Bloqueando {group.blockingCount}
                                        </span>
                                    )}
                                  </div>
                              </div>
                          </div>
                          
                          {/* BARRA DE PRESUPUESTO DEL PROYECTO - SIEMPRE VISIBLE */}
                          <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 min-h-[60px]">
                            {hasBudget ? (
                              <>
                                <div className="flex justify-between items-center text-[10px] mb-1">
                                  <span className="text-slate-500 flex items-center gap-1">
                                    <Target className="w-3 h-3" />
                                    Presupuesto proyecto
                                  </span>
                                  <span className={cn(
                                    "font-bold",
                                    isOverBudget ? "text-red-600" : "text-slate-600"
                                  )}>
                                    {group.projectTotalEst.toFixed(0)}h / {group.projectBudget}h
                                  </span>
                                </div>
                                <div className="relative h-2 bg-slate-200 rounded-full overflow-hidden">
                                  {/* Barra de mi contribución */}
                                  <div 
                                    className="absolute h-full bg-indigo-500 rounded-l-full"
                                    style={{ width: `${Math.min(100, myBudgetImpact)}%` }}
                                  />
                                  {/* Barra del resto del equipo */}
                                  <div 
                                    className={cn(
                                      "absolute h-full rounded-r-full",
                                      isOverBudget ? "bg-red-400" : "bg-slate-400"
                                    )}
                                    style={{ 
                                      left: `${Math.min(100, myBudgetImpact)}%`,
                                      width: `${Math.min(100 - myBudgetImpact, (group.projectTotalEst - group.myEst) / group.projectBudget * 100)}%`
                                    }}
                                  />
                                </div>
                                <div className="flex justify-between mt-1">
                                  <span className="text-[9px] text-indigo-600 font-medium">
                                    Tú: {group.myEst.toFixed(1)}h ({myBudgetImpact.toFixed(0)}%)
                                  </span>
                                  {group.teamMembers.length > 0 && (
                                    <span className="text-[9px] text-slate-500">
                                      Equipo: {(group.projectTotalEst - group.myEst).toFixed(1)}h
                                    </span>
                                  )}
                                </div>
                              </>
                            ) : (
                              <div className="flex items-center justify-center h-full text-[10px] text-slate-400">
                                <Target className="w-3 h-3 mr-1.5 opacity-50" />
                                Sin presupuesto definido
                              </div>
                            )}
                          </div>
                          
                          {/* CUERPO DE DATOS (MIS HORAS) */}
                          <div className="grid grid-cols-3 divide-x divide-slate-100 bg-slate-50/50">
                              <div className="p-3 text-center">
                                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">EST.</div>
                                  <div className="text-xl font-mono font-medium text-slate-700">{group.myEst.toFixed(1)}h</div>
                              </div>
                              <div className="p-3 text-center bg-white">
                                  <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1 flex items-center justify-center gap-1"><TrendingUp className="w-3 h-3"/> REAL</div>
                                  <div className="text-xl font-mono font-bold text-blue-700">{group.myReal.toFixed(1)}h</div>
                              </div>
                              <div className="p-3 text-center">
                                  <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1 flex items-center justify-center gap-1"><CheckCircle className="w-3 h-3"/> COMP</div>
                                  <div className="text-xl font-mono font-bold text-emerald-700">{group.myComp.toFixed(1)}h</div>
                              </div>
                          </div>

                          {/* FOOTER BALANCE */}
                          <div className={`px-4 py-2 flex justify-between items-center text-xs font-bold border-t border-slate-100 ${isPositive ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                              <span className="opacity-70 uppercase tracking-wide">BALANCE</span>
                              <span className="font-mono text-sm flex items-center gap-1">
                                  {isPositive ? <TrendingUp className="w-3 h-3"/> : <TrendingDown className="w-3 h-3"/>}
                                  {isPositive ? '+' : ''}{balance.toFixed(2)}h
                              </span>
                          </div>
                          
                          {/* BARRA DE PROGRESO INTERNA (TAREAS COMPLETADAS) */}
                          <div className="bg-slate-100 h-1.5 w-full">
                              <div 
                                  className="h-full bg-slate-400 transition-all" 
                                  style={{ width: `${(group.completedCount / group.taskCount) * 100}%` }}
                                  title={`${group.completedCount}/${group.taskCount} tareas completadas`}
                              />
                          </div>
                      </Card>
                  );
              })
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
