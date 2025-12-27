import { useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { isSameMonth, parseISO } from 'date-fns';
import { Sparkles, HeartHandshake } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollaborationCardsProps {
  employeeId: string;
  viewDate: Date;
}

const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

export function CollaborationCards({ employeeId, viewDate }: CollaborationCardsProps) {
  const { allocations, employees, getEmployeeMonthlyLoad } = useApp();

  // Allocations del mes para este empleado
  const monthlyAllocations = allocations.filter(a => 
    a.employeeId === employeeId && 
    isSameMonth(parseISO(a.weekStartDate), viewDate)
  );

  // Agrupar por proyecto con compañeros
  const projectGroups = useMemo(() => {
    const groups: Record<string, {
      projectId: string;
      teammates: { id: string; name: string; avatarUrl?: string; totalHours: number }[];
    }> = {};

    // Procesar mis allocations para saber en qué proyectos trabajo
    monthlyAllocations.forEach(alloc => {
      if (!groups[alloc.projectId]) {
        groups[alloc.projectId] = {
          projectId: alloc.projectId,
          teammates: []
        };
      }
    });

    // Procesar allocations de otros empleados en los mismos proyectos
    // Incluimos TODAS las tareas (pending, in-progress, completed) del mes
    allocations.forEach(alloc => {
      // Solo si es otro empleado y está en un proyecto que yo también tengo
      if (alloc.employeeId !== employeeId && groups[alloc.projectId]) {
        // Verificar que la allocation sea del mes actual
        if (!isSameMonth(parseISO(alloc.weekStartDate), viewDate)) return;
        
        // Incluir cualquier tarea con horas asignadas
        if (alloc.hoursAssigned > 0) {
          const existing = groups[alloc.projectId].teammates.find(t => t.id === alloc.employeeId);
          if (existing) {
            existing.totalHours += alloc.hoursAssigned;
          } else {
            const emp = employees.find(e => e.id === alloc.employeeId);
            if (emp) {
              groups[alloc.projectId].teammates.push({
                id: emp.id,
                name: emp.name,
                avatarUrl: emp.avatarUrl,
                totalHours: alloc.hoursAssigned
              });
            }
          }
        }
      }
    });

    return Object.values(groups);
  }, [monthlyAllocations, allocations, employees, employeeId, viewDate]);

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
          collabMap[teammate.id].totalHoursTogether += teammate.totalHours;
        }
      });
    });

    return Object.values(collabMap)
      .sort((a, b) => b.sharedProjects - a.sharedProjects || b.totalHoursTogether - a.totalHoursTogether)
      .slice(0, 5);
  }, [projectGroups, employees, getEmployeeMonthlyLoad, viewDate]);

  // Compañeros que pueden ayudar (ocupación < 80% y comparten proyectos)
  const availableHelpers = useMemo(() => {
    return frequentCollaborators
      .filter(c => c.occupancy < 80)
      .sort((a, b) => a.occupancy - b.occupancy)
      .slice(0, 3);
  }, [frequentCollaborators]);

  // Si no hay colaboradores ni ayuda disponible, no mostrar nada
  if (frequentCollaborators.length === 0 && availableHelpers.length === 0) {
    return null;
  }

  // Función helper para mostrar disponibilidad de forma amigable
  const getAvailabilityText = (occupancy: number) => {
    if (occupancy < 50) return "Muy disponible";
    if (occupancy < 70) return "Disponible";
    return "Algo ocupado";
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Tu equipo principal */}
      {frequentCollaborators.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              Tu equipo este mes
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
                  <p className="text-sm font-medium truncate">{collab.name.split(' ')[0]}</p>
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
                  {collab.occupancy < 80 ? getAvailabilityText(collab.occupancy) : `${Math.round(collab.occupancy)}% carga`}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Compañeros que pueden echarte una mano */}
      {availableHelpers.length > 0 && (
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-emerald-700">
              <HeartHandshake className="h-4 w-4" />
              ¿Necesitas apoyo?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-emerald-600 mb-3">
              Estos compañeros comparten proyectos contigo y tienen margen para ayudarte:
            </p>
            {availableHelpers.map(helper => (
              <div key={helper.id} className="flex items-center gap-3 p-2 rounded-lg bg-white border border-emerald-100">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={helper.avatarUrl} />
                  <AvatarFallback className="text-xs">{helper.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{helper.name.split(' ')[0]}</p>
                  <p className="text-xs text-muted-foreground">
                    {getAvailabilityText(helper.occupancy)}
                  </p>
                </div>
                <Badge className="bg-emerald-100 text-emerald-700 border-0">
                  Puede ayudar
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
