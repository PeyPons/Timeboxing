import { useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { format, isSameMonth, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle, TrendingUp, TrendingDown, Calendar, PieChart, Briefcase, AlertTriangle } from 'lucide-react';
import { getWeeksForMonth } from '@/utils/dateUtils';

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

  // 2. AGRUPAR POR PROYECTO (Lógica nueva)
  const projectGroups = useMemo(() => {
      const groups: Record<string, {
          projectId: string;
          projectName: string;
          clientName: string;
          totalEst: number;
          totalReal: number;
          totalComp: number;
          taskCount: number;
          completedCount: number;
          blockingCount: number; // Tareas que este proyecto bloquea a otros
      }> = {};

      monthlyAllocations.forEach(alloc => {
          if (!groups[alloc.projectId]) {
              const proj = projects.find(p => p.id === alloc.projectId);
              const cli = clients.find(c => c.id === proj?.clientId);
              groups[alloc.projectId] = {
                  projectId: alloc.projectId,
                  projectName: proj?.name || 'Sin Proyecto',
                  clientName: cli?.name || 'Interno',
                  totalEst: 0,
                  totalReal: 0,
                  totalComp: 0,
                  taskCount: 0,
                  completedCount: 0,
                  blockingCount: 0
              };
          }
          const g = groups[alloc.projectId];
          g.totalEst += Number(alloc.hoursAssigned);
          g.totalReal += Number(alloc.hoursActual || 0);
          g.totalComp += Number(alloc.hoursComputed || 0);
          g.taskCount += 1;
          if (alloc.status === 'completed') g.completedCount += 1;
          
          // Verificar si esta tarea bloquea a alguien
          const isBlocking = allocations.some(other => other.dependencyId === alloc.id && other.status !== 'completed');
          if (isBlocking && alloc.status !== 'completed') g.blockingCount += 1;
      });

      return Object.values(groups).sort((a, b) => b.totalEst - a.totalEst); // Ordenar por carga
  }, [monthlyAllocations, projects, clients, allocations]);

  // CÁLCULOS TOTALES (Header)
  const totalAssigned = projectGroups.reduce((acc, g) => acc + g.totalEst, 0);
  const totalDone = projectGroups.reduce((acc, g) => acc + g.totalReal, 0);
  
  const me = employees.find(e => e.id === employeeId);
  const weeksCount = getWeeksForMonth(viewDate).length;
  const monthlyCapacity = (me?.defaultWeeklyCapacity || 40) * weeksCount;
  const totalProgress = totalAssigned > 0 ? Math.min(100, (totalDone / totalAssigned) * 100) : 0;

  return (
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

      {/* 2. GRID DE PROYECTOS (AGRUPADOS) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projectGroups.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <Briefcase className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <div className="text-slate-500 font-medium">Sin actividad</div>
                <div className="text-slate-400 text-sm">No hay proyectos asignados este mes.</div>
            </div>
        ) : (
            projectGroups.map(group => {
                const balance = group.totalComp - group.totalReal;
                const isPositive = balance >= 0;
                // Calculo impacto % sobre el total del mes
                const impact = totalAssigned > 0 ? (group.totalEst / totalAssigned) * 100 : 0;

                return (
                    <Card key={group.projectId} className="flex flex-col shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow group">
                        
                        {/* CABECERA PROYECTO */}
                        <div className="p-4 pb-3 border-b border-slate-100 bg-white">
                            <div className="flex justify-between items-start mb-1">
                                <h3 className="text-lg font-bold text-slate-900 leading-tight truncate pr-2" title={group.projectName}>
                                    {group.projectName}
                                </h3>
                                <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-indigo-100 text-[10px]">
                                    <PieChart className="w-3 h-3 mr-1"/> Impacto: {impact.toFixed(0)}%
                                </Badge>
                            </div>
                            
                            <div className="flex items-center justify-between mt-2">
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                                    <span className="truncate max-w-[150px]">{group.clientName}</span>
                                </div>
                                {group.blockingCount > 0 && (
                                    <span className="text-[10px] text-red-600 flex items-center gap-1 font-bold animate-pulse">
                                        <AlertTriangle className="w-3 h-3"/> Bloqueando {group.blockingCount} tareas
                                    </span>
                                )}
                            </div>
                        </div>
                        
                        {/* CUERPO DE DATOS (SOLO LECTURA) */}
                        <div className="grid grid-cols-3 divide-x divide-slate-100 bg-slate-50/50">
                            <div className="p-3 text-center">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">EST.</div>
                                <div className="text-xl font-mono font-medium text-slate-700">{group.totalEst.toFixed(1)}h</div>
                            </div>
                            <div className="p-3 text-center bg-white">
                                <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1 flex items-center justify-center gap-1"><TrendingUp className="w-3 h-3"/> REAL</div>
                                <div className="text-xl font-mono font-bold text-blue-700">{group.totalReal.toFixed(1)}h</div>
                            </div>
                            <div className="p-3 text-center">
                                <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1 flex items-center justify-center gap-1"><CheckCircle className="w-3 h-3"/> COMP</div>
                                <div className="text-xl font-mono font-bold text-emerald-700">{group.totalComp.toFixed(1)}h</div>
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
  );
}
