import { useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format, isSameMonth, parseISO } from 'date-fns';
import { Users, HandHelping, Heart, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollaborationCardsProps {
  employeeId: string;
  viewDate: Date;
}

const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

export function CollaborationCards({ employeeId, viewDate }: CollaborationCardsProps) {
  const { allocations, projects, employees, getEmployeeMonthlyLoad } = useApp();

  // Allocations del mes para este empleado
  const monthlyAllocations = allocations.filter(a => 
    a.employeeId === employeeId && 
    isSameMonth(parseISO(a.weekStartDate), viewDate)
  );

  // Agrupar por proyecto con compañeros
  const projectGroups = useMemo(() => {
    const groups: Record<string, {
      projectId: string;
      teammates: { id: string; name: string; avatarUrl?: string; hoursComputed: number }[];
    }> = {};

    // Procesar mis allocations
    monthlyAllocations.forEach(alloc => {
      if (!groups[alloc.projectId]) {
        groups[alloc.projectId] = {
          projectId: alloc.projectId,
          teammates: []
        };
      }
    });

    // Procesar allocations de otros empleados en los mismos proyectos
    allocations.forEach(alloc => {
      if (alloc.employeeId !== employeeId && groups[alloc.projectId]) {
        const existing = groups[alloc.projectId].teammates.find(t => t.id === alloc.employeeId);
        if (alloc.status === 'completed' && alloc.hoursComputed) {
          if (existing) {
            existing.hoursComputed += alloc.hoursComputed;
          } else {
            const emp = employees.find(e => e.id === alloc.employeeId);
            if (emp) {
              groups[alloc.projectId].teammates.push({
                id: emp.id,
                name: emp.name,
                avatarUrl: emp.avatarUrl,
                hoursComputed: alloc.hoursComputed
              });
            }
          }
        }
      }
    });

    return Object.values(groups);
  }, [monthlyAllocations, allocations, employees, employeeId]);

  // Colaboradores frecuentes
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
      group.teammates.forEach(teammate => {
        if (!collabMap[teammate.id]) {
          const emp = employees.find(e => e.id === teammate.id);
          if (emp) {
            const load = getEmployeeMonthlyLoad(teammate.id, viewDate.getFullYear(), viewDate.getMonth());
            collabMap[teammate.id] = {
              id: teammate.id,
              name: emp.name,
              avatarUrl: emp.avatarUrl,
              sharedProjects: 0,
              totalHoursTogether: 0,
              occupancy: load.percentage
            };
          }
        }
        if (collabMap[teammate.id]) {
          collabMap[teammate.id].sharedProjects++;
          collabMap[teammate.id].totalHoursTogether += teammate.hoursComputed;
        }
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

  // Balance total del mes
  const monthlyStats = useMemo(() => {
    const completed = monthlyAllocations.filter(a => a.status === 'completed');
    const totalReal = completed.reduce((sum, a) => sum + (a.hoursActual || 0), 0);
    const totalComputed = completed.reduce((sum, a) => sum + (a.hoursComputed || 0), 0);
    return {
      totalReal: round2(totalReal),
      totalComputed: round2(totalComputed)
    };
  }, [monthlyAllocations]);

  const monthlyBalance = round2(monthlyStats.totalComputed - monthlyStats.totalReal);
  const isPositiveBalance = monthlyBalance >= 0;

  // Si no hay colaboradores ni ayuda disponible, no mostrar nada
  if (frequentCollaborators.length === 0 && availableHelpers.length === 0 && monthlyStats.totalComputed === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
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
      {monthlyStats.totalComputed > 0 && (
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
  );
}

