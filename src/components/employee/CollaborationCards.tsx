import { useMemo, memo } from 'react';
import { useAppOrDemo } from '@/hooks/useAppOrDemo';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { isSameMonth, parseISO } from 'date-fns';
import { isAllocationInEffectiveMonth } from '@/utils/dateUtils';
import { Sparkles, HeartHandshake, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SensitiveText } from '@/components/privacy/SensitiveText';

interface CollaborationCardsProps {
  employeeId: string;
  viewDate: Date;
}

const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

export const CollaborationCards = memo(function CollaborationCards({ employeeId, viewDate }: CollaborationCardsProps) {
  const { t } = useAppTranslation();
  const { allocations, employees, getEmployeeMonthlyLoad } = useAppOrDemo();

  // Memoizado: mapa de empleados para acceso O(1)
  const employeesMap = useMemo(() => {
    const map = new Map<string, typeof employees[0]>();
    employees.forEach(e => map.set(e.id, e));
    return map;
  }, [employees]);

  // Memoizado: allocations del mes filtradas una sola vez
  const monthlyAllocationsAll = useMemo(() => {
    return allocations.filter(a => {
      try {
        return isAllocationInEffectiveMonth(a.weekStartDate, viewDate);
      } catch {
        return false;
      }
    });
  }, [allocations, viewDate]);

  // Allocations del mes para este empleado
  const monthlyAllocations = useMemo(() =>
    monthlyAllocationsAll.filter(a => a.employeeId === employeeId),
    [monthlyAllocationsAll, employeeId]
  );

  // Agrupar por proyecto con compañeros - optimizado con mejor estructura de datos
  const projectGroups = useMemo(() => {
    // Set de proyectos del empleado actual
    const myProjects = new Set<string>();
    monthlyAllocations.forEach(alloc => myProjects.add(alloc.projectId));

    // Estructura para acumular horas por proyecto y compañero
    const groups = new Map<string, Map<string, { id: string; name: string; avatarUrl?: string; totalHours: number }>>();

    // Inicializar grupos para cada proyecto del empleado
    myProjects.forEach(projectId => {
      groups.set(projectId, new Map());
    });

    // Procesar allocations de otros empleados en los mismos proyectos (una sola pasada)
    monthlyAllocationsAll.forEach(alloc => {
      // Solo si es otro empleado y está en un proyecto que yo también tengo
      if (alloc.employeeId !== employeeId && myProjects.has(alloc.projectId) && alloc.hoursAssigned > 0) {
        const projectTeammates = groups.get(alloc.projectId)!;
        const existing = projectTeammates.get(alloc.employeeId);

        if (existing) {
          existing.totalHours += alloc.hoursAssigned;
        } else {
          const emp = employeesMap.get(alloc.employeeId);
          if (emp) {
            projectTeammates.set(alloc.employeeId, {
              id: emp.id,
              name: emp.name,
              avatarUrl: emp.avatarUrl,
              totalHours: alloc.hoursAssigned
            });
          }
        }
      }
    });

    // Convertir a formato de salida
    return Array.from(groups.entries()).map(([projectId, teammates]) => ({
      projectId,
      teammates: Array.from(teammates.values())
    }));
  }, [monthlyAllocations, monthlyAllocationsAll, employeesMap, employeeId]);

  // Colaboradores frecuentes - optimizado con employeesMap
  const frequentCollaborators = useMemo(() => {
    const collabMap = new Map<string, {
      id: string;
      name: string;
      avatarUrl?: string;
      sharedProjects: number;
      totalHoursTogether: number;
      occupancy: number;
    }>();

    projectGroups.forEach(group => {
      group.teammates.forEach(teammate => {
        let collab = collabMap.get(teammate.id);

        if (!collab) {
          const emp = employeesMap.get(teammate.id);
          if (emp) {
            const load = getEmployeeMonthlyLoad(teammate.id, viewDate.getFullYear(), viewDate.getMonth());
            collab = {
              id: teammate.id,
              name: emp.name,
              avatarUrl: emp.avatarUrl,
              sharedProjects: 0,
              totalHoursTogether: 0,
              occupancy: load.percentage
            };
            collabMap.set(teammate.id, collab);
          }
        }

        if (collab) {
          collab.sharedProjects++;
          collab.totalHoursTogether += teammate.totalHours;
        }
      });
    });

    return Array.from(collabMap.values())
      .sort((a, b) => b.sharedProjects - a.sharedProjects || b.totalHoursTogether - a.totalHoursTogether)
      .slice(0, 5);
  }, [projectGroups, employeesMap, getEmployeeMonthlyLoad, viewDate]);

  // Compañeros que pueden ayudar - Ahora incluye 80-90% como "esfuerzo extra"
  const { availableHelpers, busyButWillingHelpers } = useMemo(() => {
    const available = frequentCollaborators
      .filter(c => c.occupancy < 80)
      .sort((a, b) => a.occupancy - b.occupancy)
      .slice(0, 3);

    const busyButWilling = frequentCollaborators
      .filter(c => c.occupancy >= 80 && c.occupancy < 90)
      .sort((a, b) => a.occupancy - b.occupancy)
      .slice(0, 2); // Máximo 2 para no saturar

    return { availableHelpers: available, busyButWillingHelpers: busyButWilling };
  }, [frequentCollaborators]);

  // Función helper para mostrar disponibilidad de forma amigable
  const getAvailabilityText = (occupancy: number) => {
    if (occupancy < 50) return t('team.collaboration.availability.veryAvailable');
    if (occupancy < 70) return t('team.collaboration.availability.available');
    return t('team.collaboration.availability.somewhatBusy');
  };

  const formatProjectsTogether = (count: number, hours: number) =>
    `${t('team.collaboration.project', { count })} · ${t('team.collaboration.hoursTogether', { hours: round2(hours) })}`;

  // Función para mostrar nombre distintivo cuando hay nombres duplicados
  const getDisplayName = (fullName: string, allCollaborators: typeof frequentCollaborators) => {
    const firstName = fullName.split(' ')[0];
    const duplicates = allCollaborators.filter(c => c.name.split(' ')[0] === firstName);
    if (duplicates.length > 1) {
      // Hay duplicados, mostrar inicial del apellido
      const parts = fullName.split(' ');
      if (parts.length > 1) {
        return `${firstName} ${parts[1].charAt(0)}.`; // "Raúl R." o "Raúl A."
      }
    }
    return firstName; // Sin duplicados, solo primer nombre
  };

  const hasAnyHelpers = availableHelpers.length > 0 || busyButWillingHelpers.length > 0;

  // Si no hay datos, mostrar datos de ejemplo
  const hasNoData = frequentCollaborators.length === 0 && !hasAnyHelpers;

  // Datos de ejemplo para usuarios sin datos
  const mockCollaborators = [
    { id: '1', name: 'María García', sharedProjects: 3, totalHoursTogether: 24, occupancy: 65, avatarUrl: undefined },
    { id: '2', name: 'Carlos Ruiz', sharedProjects: 2, totalHoursTogether: 12, occupancy: 78, avatarUrl: undefined },
    { id: '3', name: 'Ana López', sharedProjects: 1, totalHoursTogether: 8, occupancy: 45, avatarUrl: undefined },
  ];

  const mockHelpers = [
    { id: '4', name: 'Pablo Martín', occupancy: 55, avatarUrl: undefined },
    { id: '5', name: 'Laura Sánchez', occupancy: 42, avatarUrl: undefined },
  ];

  if (hasNoData) {
    return (
      <TooltipProvider>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tu equipo este mes - EJEMPLO */}
          <Card className="relative overflow-hidden">
            <div className="absolute top-2 right-2 z-10">
              <Badge variant="outline" className="text-[9px] bg-amber-50 border-amber-200 text-amber-700">
                {t('team.collaboration.exampleBadge')}
              </Badge>
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                {t('team.collaboration.teamThisMonth')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-slate-500">
                {t('team.collaboration.teammatesIntro')}
              </p>
              <div className="space-y-2 opacity-75">
                {mockCollaborators.map(collab => (
                  <div key={collab.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">{collab.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{collab.name.split(' ')[0]}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatProjectsTogether(collab.sharedProjects, collab.totalHoursTogether)}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200">
                      {t('team.collaboration.loadPct', { pct: collab.occupancy })}
                    </Badge>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-amber-600 text-center pt-1">
                {t('team.collaboration.exampleTeamHint')}
              </p>
            </CardContent>
          </Card>

          {/* ¿Necesitas apoyo? - EJEMPLO */}
          <Card className="border-emerald-200 bg-emerald-50/30 relative overflow-hidden">
            <div className="absolute top-2 right-2 z-10">
              <Badge variant="outline" className="text-[9px] bg-amber-50 border-amber-200 text-amber-700">
                {t('team.collaboration.exampleBadge')}
              </Badge>
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-emerald-700">
                <HeartHandshake className="h-4 w-4" />
                {t('team.collaboration.needSupport')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-emerald-600">
                {t('team.collaboration.helpersIntro')}
              </p>
              <div className="space-y-2 opacity-75">
                {mockHelpers.map(helper => (
                  <div key={helper.id} className="flex items-center gap-3 p-2 rounded-lg bg-white border border-emerald-100">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">{helper.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{helper.name.split(' ')[0]}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('team.collaboration.loadPct', { pct: helper.occupancy })}
                      </p>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-700 border-0">
                      {t('team.collaboration.availableBadge')}
                    </Badge>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-amber-600 text-center pt-1">
                {t('team.collaboration.exampleHelpersHint')}
              </p>
            </CardContent>
          </Card>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-tour="collaboration-cards">
        {/* Tu equipo este mes */}
        {frequentCollaborators.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                {t('team.collaboration.teamThisMonth')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-slate-500">
                {t('team.collaboration.teammatesIntro')}
              </p>
              <div className="space-y-2">
                {frequentCollaborators.map(collab => (
                  <div key={collab.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={collab.avatarUrl} />
                      <AvatarFallback className="text-xs">{collab.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        <SensitiveText kind="employee" id={collab.id}>
                          {getDisplayName(collab.name, frequentCollaborators)}
                        </SensitiveText>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatProjectsTogether(collab.sharedProjects, collab.totalHoursTogether)}
                      </p>
                    </div>
                    <Badge variant="outline" className={cn(
                      "text-[10px]",
                      collab.occupancy >= 100 ? "text-red-600 border-red-200"  // Sobrecarga
                        : collab.occupancy > 85 ? "text-amber-600 border-amber-200"  // Muy ocupado
                          : "text-emerald-600 border-emerald-200"  // Disponible/Productivo
                    )}>
                      {collab.occupancy < 80 ? getAvailabilityText(collab.occupancy) : t('team.collaboration.loadPct', { pct: Math.round(collab.occupancy) })}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Compañeros que pueden echarte una mano */}
        {hasAnyHelpers && (
          <Card className="border-emerald-200 bg-emerald-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-emerald-700">
                <HeartHandshake className="h-4 w-4" />
                {t('team.collaboration.needSupport')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-emerald-600">
                {t('team.collaboration.helpersIntro')}
              </p>

              {/* Helpers disponibles (< 80%) */}
              {availableHelpers.length > 0 && (
                <div className="space-y-2">
                  {availableHelpers.map(helper => (
                    <div key={helper.id} className="flex items-center gap-3 p-2 rounded-lg bg-white border border-emerald-100">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={helper.avatarUrl} />
                        <AvatarFallback className="text-xs">{helper.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          <SensitiveText kind="employee" id={helper.id}>
                            {getDisplayName(helper.name, frequentCollaborators)}
                          </SensitiveText>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {getAvailabilityText(helper.occupancy)}
                        </p>
                      </div>
                      <Badge className="bg-emerald-100 text-emerald-700 border-0">
                        {t('team.collaboration.availableBadge')}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {/* Helpers ocupados pero dispuestos (80-90%) */}
              {busyButWillingHelpers.length > 0 && (
                <div className="space-y-2">
                  {availableHelpers.length > 0 && (
                    <p className="text-[10px] text-amber-600 font-medium uppercase tracking-wide pt-1">
                      {t('team.collaboration.extraEffortHeader')}
                    </p>
                  )}
                  {busyButWillingHelpers.map(helper => (
                    <Tooltip key={helper.id}>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-3 p-2 rounded-lg bg-amber-50/50 border border-amber-200 cursor-help transition-all hover:bg-amber-50 hover:border-amber-300">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={helper.avatarUrl} />
                            <AvatarFallback className="text-xs">{helper.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate text-amber-900">
                              <SensitiveText kind="employee" id={helper.id}>
                                {getDisplayName(helper.name, frequentCollaborators)}
                              </SensitiveText>
                            </p>
                            <p className="text-xs text-amber-600">
                              {t('team.collaboration.loadPct', { pct: Math.round(helper.occupancy) })}
                            </p>
                          </div>
                          <Badge className="bg-amber-100 text-amber-700 border-0 gap-1">
                            <Heart className="h-3 w-3" />
                            {t('team.collaboration.considerBadge')}
                          </Badge>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="max-w-[220px] bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 text-amber-900 p-3"
                      >
                        <div className="space-y-2">
                          <p className="font-semibold text-sm flex items-center gap-1.5">
                            <Heart className="h-3.5 w-3.5 text-amber-500" />
                            <SensitiveText kind="employee" id={helper.id}>
                              {getDisplayName(helper.name, frequentCollaborators)}
                            </SensitiveText>
                            {' '}
                            {t('team.collaboration.busyTooltipSuffix')}
                          </p>
                          <p className="text-xs leading-relaxed text-amber-800">
                            {t('team.collaboration.busyTooltipBody')}
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
});
