import { useMemo, memo, useState, useEffect } from 'react';
import { useAppOrDemo } from '@/hooks/useAppOrDemo';
import { useAgency } from '@/contexts/AgencyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertTriangle, CheckCircle2, Users, TrendingUp, TrendingDown,
  Info, ChevronDown, ChevronUp, User, Search, ListPlus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjectAliasing } from '@/hooks/useProjectAliasing';
import { useIsMobile } from '@/hooks/use-mobile';
import { Deadline } from '@/types';
import { fetchDeadlinesForMonth } from '@/utils/deadlineUtils';
import { format, isSameMonth, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { AppTrans, useAppTranslation } from '@/hooks/useAppTranslation';
import { useDateLocale } from '@/hooks/useDateLocale';
import { getEffectiveCompletedHours } from '@/utils/hoursTracking';
import { isAllocationInEffectiveMonth } from '@/utils/dateUtils';
import { SensitiveText } from '@/components/privacy/SensitiveText';

/** Píldora compacta: icono violeta (#7C3AED), texto gris pizarra, borde/sombra muy suaves (referencia UX). */
const addTasksButtonClass =
  'inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-full border border-slate-200/90 bg-white px-2.5 text-[13px] font-medium leading-none text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition-colors hover:border-slate-300 hover:bg-slate-50/90 hover:text-slate-700 active:bg-slate-50';

interface PlanningInconsistenciesCardProps {
  employeeId: string;
  viewDate: Date;
  isManager?: boolean; // Si es manager, puede ver información de compañeros
  onAddTasksForProject?: (projectId: string) => void;
}

const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

function MobileHoursMetrics({
  deadlineHours,
  plannedHours,
  computedHours,
  t,
}: {
  deadlineHours: number;
  plannedHours: number;
  computedHours: number;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const columns = [
    ...(deadlineHours > 0
      ? [{ label: t('employeeDashboard.hours.deadline'), value: deadlineHours, valueClass: 'text-slate-900' }]
      : []),
    { label: t('employeeDashboard.hours.planned'), value: plannedHours, valueClass: 'text-slate-900' },
    { label: t('employeeDashboard.hours.computed'), value: computedHours, valueClass: 'text-slate-900' },
  ];

  return (
    <div className="rounded-xl border border-slate-200/70 bg-white/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
      <div className="flex items-stretch divide-x divide-slate-100">
        {columns.map((col) => (
          <div key={col.label} className="flex-1 px-2 py-2.5 text-center min-w-0">
            <p className="text-[10px] font-medium text-slate-400 leading-none mb-1.5 truncate">
              {col.label}
            </p>
            <p className={cn('text-[15px] font-semibold tabular-nums tracking-tight leading-none', col.valueClass)}>
              {col.value}h
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function mobileDeltaMeta(
  difference: number,
  t: (key: string, options?: Record<string, unknown>) => string
) {
  if (difference < 0) {
    return {
      dot: 'bg-red-500',
      text: 'text-red-700',
      label: t('employeeDashboard.planning.hoursToPlan', { hours: difference }),
      Icon: TrendingDown,
    };
  }
  if (difference > 0) {
    return {
      dot: 'bg-amber-500',
      text: 'text-amber-700',
      label: t('employeeDashboard.planning.deviationPositive', { hours: difference }),
      Icon: TrendingUp,
    };
  }
  return {
    dot: 'bg-emerald-500',
    text: 'text-emerald-700',
    label: t('employeeDashboard.planning.noDeviation'),
    Icon: CheckCircle2,
  };
}

export const PlanningInconsistenciesCard = memo(function PlanningInconsistenciesCard({
  employeeId,
  viewDate,
  isManager = false,
  onAddTasksForProject
}: PlanningInconsistenciesCardProps) {
  const { t } = useAppTranslation();
  const dateLocale = useDateLocale();
  const app = useAppOrDemo();
  const { allocations, projects, employees } = app;
  const deadlinesFromContext = (app as { deadlines?: Deadline[] }).deadlines;
  const { currentAgency } = useAgency();
  const preference = currentAgency?.settings?.hoursTrackingPreference;
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const { formatName: formatProjectName } = useProjectAliasing();
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState('');

  const monthKey = format(viewDate, 'yyyy-MM');

  // Cargar deadlines del mes (o usar del contexto si está en modo demo)
  useEffect(() => {
    // Si hay deadlines en el contexto (modo demo), usarlos directamente
    if (deadlinesFromContext && Array.isArray(deadlinesFromContext)) {
      const monthDeadlines = deadlinesFromContext.filter((d: Deadline) => d.month === monthKey);
      setDeadlines(monthDeadlines);
      setIsLoading(false);
      return;
    }

    // Cargar desde Supabase filtrados por agencia (multi-tenant)
    const loadDeadlines = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await fetchDeadlinesForMonth(monthKey, currentAgency?.id);
        if (error) throw error;
        setDeadlines(data ?? []);
      } catch (error) {
        console.error('Error cargando deadlines:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadDeadlines();
  }, [monthKey, deadlinesFromContext, currentAgency?.id]);

  // Calcular incoherencias
  const inconsistencies = useMemo(() => {
    if (isLoading) return [];

    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(viewDate);

    // Obtener allocations del mes para este empleado
    const monthAllocations = allocations.filter(a =>
      a.employeeId === employeeId &&
      isAllocationInEffectiveMonth(a.weekStartDate, viewDate)
    );

    // Agrupar allocations por proyecto
    const allocationsByProject: Record<string, {
      planned: number; // horas planificadas (no completadas)
      computed: number; // horas computadas (completadas)
    }> = {};

    monthAllocations.forEach(a => {
      if (!allocationsByProject[a.projectId]) {
        allocationsByProject[a.projectId] = { planned: 0, computed: 0 };
      }
      if (a.status === 'completed') {
        allocationsByProject[a.projectId].computed += getEffectiveCompletedHours(a, preference);
      } else {
        allocationsByProject[a.projectId].planned += a.hoursAssigned || 0;
      }
    });

    // Comparar con deadlines
    const results: Array<{
      projectId: string;
      projectName: string;
      deadlineHours: number;
      plannedHours: number;
      computedHours: number;
      difference: number;
      budgetHours: number;
      minimumHours: number;
      totalProjectComputed: number;
      totalProjectPlanned: number;
      teammates: Array<{
        employeeId: string;
        employeeName: string;
        avatarUrl?: string;
        deadlineHours: number;
        plannedHours: number;
        computedHours: number;
        difference: number;
      }>;
    }> = [];

    deadlines.forEach(deadline => {
      const project = projects.find(p => p.id === deadline.projectId);
      // Completados/archivados: no exigir horas de deadline (evita fantasma tras “copiar mes”).
      // Si hay tareas, el bloque de allocations sin deadline las sigue mostrando.
      if (project && project.status !== 'active') {
        return;
      }

      const deadlineHours = deadline.employeeHours[employeeId] || 0;
      const projectAllocs = allocationsByProject[deadline.projectId] || { planned: 0, computed: 0 };

      // FILTRAR: Para empleados no-managers, solo mostrar proyectos donde están asignados
      // (tienen deadline asignado O tienen allocations en ese proyecto)
      if (!isManager) {
        const hasAllocations = (projectAllocs.planned > 0 || projectAllocs.computed > 0);
        if (deadlineHours === 0 && !hasAllocations) {
          return; // Saltar si el empleado no está asignado a este proyecto
        }
      }

      // El deadline planifica según lo que se estima computar, así que comparamos con lo computado + planificado
      // (porque lo planificado aún no computado también cuenta)
      const totalPlanned = projectAllocs.planned + projectAllocs.computed;
      const difference = round2(totalPlanned - deadlineHours);

      // Solo mostrar si hay diferencia significativa (> 0.5h)
      // Para empleados no-managers, solo mostrar proyectos donde están asignados Y hay diferencia
      const shouldShow = isManager
        ? Math.abs(difference) > 0.5
        : ((deadlineHours > 0 || projectAllocs.planned > 0 || projectAllocs.computed > 0) && Math.abs(difference) > 0.5);

      if (shouldShow) {

        // Obtener allocations del proyecto de todos los empleados
        const allProjectAllocations = allocations.filter(a =>
          a.projectId === deadline.projectId &&
          isAllocationInEffectiveMonth(a.weekStartDate, viewDate)
        );

        // Calcular totales del proyecto (todos los empleados)
        const totalProjectComputed = allProjectAllocations
          .filter(a => a.status === 'completed')
          .reduce((sum, a) => sum + getEffectiveCompletedHours(a, preference), 0);
        const totalProjectPlanned = allProjectAllocations
          .filter(a => a.status !== 'completed')
          .reduce((sum, a) => sum + (a.hoursAssigned || 0), 0);

        // Buscar compañeros que también tienen horas en este proyecto para detectar intercambios
        const teammates: Array<{
          employeeId: string;
          employeeName: string;
          avatarUrl?: string;
          deadlineHours: number;
          plannedHours: number;
          computedHours: number;
          difference: number;
        }> = [];

        // Agrupar por empleado
        const allocationsByEmployee: Record<string, {
          planned: number;
          computed: number;
        }> = {};

        allProjectAllocations.forEach(a => {
          if (!allocationsByEmployee[a.employeeId]) {
            allocationsByEmployee[a.employeeId] = { planned: 0, computed: 0 };
          }
          if (a.status === 'completed') {
            allocationsByEmployee[a.employeeId].computed += getEffectiveCompletedHours(a, preference);
          } else {
            allocationsByEmployee[a.employeeId].planned += a.hoursAssigned || 0;
          }
        });

        // CORRECCIÓN: Incluir TODOS los empleados con horas (planificadas o computadas) > 0
        // O con deadline asignado (incluso si no tienen horas todavía)
        // Esto corrige el bug de "Empleado Fantasma" donde las horas suman pero no aparecen
        // Y también el caso donde un compañero tiene deadline pero aún no tiene horas
        const allEmployeeIdsForTeammates = new Set<string>();

        // Añadir empleados con allocations
        Object.keys(allocationsByEmployee).forEach(empId => {
          if (empId !== employeeId) {
            allEmployeeIdsForTeammates.add(empId);
          }
        });

        // Añadir empleados con deadline asignado (aunque no tengan horas todavía)
        if (deadline.employeeHours) {
          Object.keys(deadline.employeeHours).forEach(empId => {
            if (empId !== employeeId) {
              allEmployeeIdsForTeammates.add(empId);
            }
          });
        }

        allEmployeeIdsForTeammates.forEach((empId) => {
          const empAllocs = allocationsByEmployee[empId] || { planned: 0, computed: 0 };
          const empTotal = empAllocs.planned + empAllocs.computed;

          // Mostrar si tiene horas imputadas (planificadas o computadas) > 0
          // O si tiene deadline asignado
          const deadlineHrs = deadline.employeeHours[empId] || 0;
          const hasHours = empTotal > 0;
          const hasDeadline = deadlineHrs > 0;

          if (hasHours || hasDeadline) {
            const empDiff = round2(empTotal - deadlineHrs);
            const emp = employees.find(e => e.id === empId);

            if (emp) {
              teammates.push({
                employeeId: empId,
                employeeName: emp.name,
                avatarUrl: emp.avatarUrl,
                deadlineHours: deadlineHrs,
                plannedHours: round2(empAllocs.planned),
                computedHours: round2(empAllocs.computed),
                difference: empDiff
              });
            }
          }
        });

        const effectiveBudget = deadline.budgetOverride !== undefined && deadline.budgetOverride !== null
          ? deadline.budgetOverride
          : (project?.budgetHours || 0);

        results.push({
          projectId: deadline.projectId,
          projectName: project?.name || t('employeeDashboard.common.unknownProject'),
          deadlineHours,
          plannedHours: round2(projectAllocs.planned),
          computedHours: round2(projectAllocs.computed),
          difference,
          budgetHours: effectiveBudget,
          minimumHours: project?.minimumHours || 0,
          totalProjectComputed: round2(totalProjectComputed),
          totalProjectPlanned: round2(totalProjectPlanned),
          teammates
        });
      }
    });

    // NUEVO: Detectar proyectos con horas pero sin deadline PARA EL USUARIO
    // Iterar sobre todos los proyectos que tienen allocations para este empleado
    // IMPORTANTE: Verificar que el proyecto no esté ya en results (evitar duplicados)
    const processedProjectIds = new Set(results.map(r => r.projectId));

    Object.entries(allocationsByProject).forEach(([projectId, projectAllocs]) => {
      // Si el proyecto ya está en results, saltarlo (evitar duplicados)
      if (processedProjectIds.has(projectId)) return;

      // Verificar si el usuario tiene deadline asignado en este proyecto (solo cuenta si el proyecto está activo)
      const userDeadline = deadlines.find(d => d.projectId === projectId);
      const project = projects.find(p => p.id === projectId);
      const userDeadlineHours =
        project?.status === 'active' ? (userDeadline?.employeeHours[employeeId] || 0) : 0;

      // Si el usuario NO tiene deadline asignado pero tiene horas, mostrar el proyecto
      if (userDeadlineHours === 0 && (projectAllocs.planned > 0 || projectAllocs.computed > 0)) {
        const totalPlanned = projectAllocs.planned + projectAllocs.computed;

        // Obtener allocations del proyecto de todos los empleados
        const allProjectAllocations = allocations.filter(a =>
          a.projectId === projectId &&
          isAllocationInEffectiveMonth(a.weekStartDate, viewDate)
        );

        // Calcular totales del proyecto (todos los empleados)
        const totalProjectComputed = allProjectAllocations
          .filter(a => a.status === 'completed')
          .reduce((sum, a) => sum + getEffectiveCompletedHours(a, preference), 0);
        const totalProjectPlanned = allProjectAllocations
          .filter(a => a.status !== 'completed')
          .reduce((sum, a) => sum + (a.hoursAssigned || 0), 0);

        // CORRECCIÓN: Incluir compañeros con horas O con deadline asignado
        // Esto corrige el caso donde el usuario no tiene deadline pero otros compañeros sí
        const teammatesWithoutDeadline: Array<{
          employeeId: string;
          employeeName: string;
          avatarUrl?: string;
          deadlineHours: number;
          plannedHours: number;
          computedHours: number;
          difference: number;
        }> = [];

        // Agrupar por empleado
        const allocationsByEmployeeNoDeadline: Record<string, {
          planned: number;
          computed: number;
        }> = {};

        allProjectAllocations.forEach(a => {
          if (!allocationsByEmployeeNoDeadline[a.employeeId]) {
            allocationsByEmployeeNoDeadline[a.employeeId] = { planned: 0, computed: 0 };
          }
          if (a.status === 'completed') {
            allocationsByEmployeeNoDeadline[a.employeeId].computed += getEffectiveCompletedHours(a, preference);
          } else {
            allocationsByEmployeeNoDeadline[a.employeeId].planned += a.hoursAssigned || 0;
          }
        });

        // Obtener deadline del proyecto (si existe) para incluir compañeros con deadline
        const projectDeadline = deadlines.find(d => d.projectId === projectId);

        // Incluir todos los empleados con horas > 0 O con deadline asignado (excepto el usuario logueado)
        // IMPORTANTE: Incluir TODOS los empleados que tienen deadline en este proyecto, incluso si no tienen horas todavía
        const allEmployeeIds = new Set<string>();

        // Añadir empleados con allocations
        Object.keys(allocationsByEmployeeNoDeadline).forEach(empId => {
          if (empId !== employeeId) {
            allEmployeeIds.add(empId);
          }
        });

        // Añadir empleados con deadline asignado (aunque no tengan horas todavía)
        // Solo si el proyecto está activo: en cerrados el deadline no es objetivo del mes.
        if (project?.status === 'active' && projectDeadline && projectDeadline.employeeHours) {
          Object.keys(projectDeadline.employeeHours).forEach(empId => {
            if (empId !== employeeId) {
              allEmployeeIds.add(empId);
            }
          });
        }

        allEmployeeIds.forEach((empId) => {
          const empAllocs = allocationsByEmployeeNoDeadline[empId] || { planned: 0, computed: 0 };
          const empTotal = empAllocs.planned + empAllocs.computed;
          const empDeadlineHours =
            project?.status === 'active' ? (projectDeadline?.employeeHours?.[empId] || 0) : 0;

          // Mostrar si tiene horas imputadas O si tiene deadline asignado
          // Esto asegura que aparezcan compañeros con deadline aunque no tengan horas todavía
          if (empTotal > 0 || empDeadlineHours > 0) {
            const empDiff = round2(empTotal - empDeadlineHours);
            const emp = employees.find(e => e.id === empId);

            if (emp) { // Solo añadir si el empleado existe
              teammatesWithoutDeadline.push({
                employeeId: empId,
                employeeName: emp.name,
                avatarUrl: emp.avatarUrl,
                deadlineHours: empDeadlineHours, // Puede tener deadline aunque el usuario no
                plannedHours: round2(empAllocs.planned),
                computedHours: round2(empAllocs.computed),
                difference: empDiff
              });
            }
          }
        });

        // No hay deadline, así que la diferencia es el total de horas

        // Si hay budget override en el deadline del proyecto (aunque el usuario no tenga horas asignadas), usarlo
        const effectiveBudget = projectDeadline?.budgetOverride !== undefined && projectDeadline?.budgetOverride !== null
          ? projectDeadline.budgetOverride
          : (project?.budgetHours || 0);

        results.push({
          projectId,
          projectName: project?.name || t('employeeDashboard.common.unknownProject'),
          deadlineHours: 0, // No hay deadline
          plannedHours: round2(projectAllocs.planned),
          computedHours: round2(projectAllocs.computed),
          difference: round2(totalPlanned), // Diferencia positiva porque hay horas sin deadline
          budgetHours: effectiveBudget,
          minimumHours: project?.minimumHours || 0,
          totalProjectComputed: round2(totalProjectComputed),
          totalProjectPlanned: round2(totalProjectPlanned),
          teammates: teammatesWithoutDeadline
        });
      }
    });

    return results.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
  }, [deadlines, allocations, projects, employees, employeeId, viewDate, isLoading, isManager, preference, t]);

  const visibleInconsistencies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return inconsistencies;
    return inconsistencies.filter(inc =>
      formatProjectName(inc.projectName).toLowerCase().includes(q)
    );
  }, [inconsistencies, searchQuery, formatProjectName]);

  // Mantener proyectos colapsados por defecto (no expandir automáticamente)
  // El usuario puede expandir manualmente si necesita ver detalles

  const toggleProject = (projectId: string) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  if (isLoading) {
    return (
      <Card data-tour="planning-inconsistencies">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <span>{t('employeeDashboard.planning.controlTitle')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">{t('employeeDashboard.common.loading')}</p>
        </CardContent>
      </Card>
    );
  }

  if (inconsistencies.length === 0) {
    return (
      <Card className="border-l-4 border-l-emerald-500" data-tour="planning-inconsistencies">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span>{t('employeeDashboard.planning.controlTitle')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">
            {t('employeeDashboard.planning.allMatch')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className="border-l-4 border-l-amber-500 overflow-hidden min-w-0" data-tour="planning-inconsistencies">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <span>{t('employeeDashboard.planning.alertsTitle')}</span>
            <Tooltip>
              <TooltipTrigger className={cn("shrink-0", isMobile && "p-2 -m-2 touch-manipulation")}>
                <Info className={cn("text-slate-400", isMobile ? "h-5 w-5" : "h-4 w-4")} />
              </TooltipTrigger>
              <TooltipContent className="max-w-[min(300px,calc(100vw-2rem))]">
                <p className="text-xs">
                  {t('employeeDashboard.planning.tooltip')}
                </p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4 space-y-3">
            <div className="text-sm text-slate-600 leading-snug space-y-1">
              <p>
                <AppTrans
                  i18nKey="employeeDashboard.planning.variationsDetected"
                  count={inconsistencies.length}
                  values={{
                    count: inconsistencies.length,
                    month: format(viewDate, 'MMMM yyyy', { locale: dateLocale }),
                  }}
                  components={{ strong: <strong /> }}
                />.
              </p>
              {searchQuery.trim() && (
                <p className="text-xs text-slate-500">
                  <AppTrans
                    i18nKey="employeeDashboard.common.showingFiltered"
                    values={{
                      visible: visibleInconsistencies.length,
                      total: inconsistencies.length,
                    }}
                    components={{ strong: <strong /> }}
                  />
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="planning-inconsistencies-search" className="text-xs font-medium text-slate-500">
                {t('employeeDashboard.planning.filterByProject')}
              </label>
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <Input
                  id="planning-inconsistencies-search"
                  placeholder={t('employeeDashboard.planning.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 w-full bg-white border-slate-200 shadow-sm"
                  aria-label={t('employeeDashboard.planning.searchAria')}
                />
              </div>
            </div>
          </div>

          <div className={cn(isMobile ? "space-y-3" : "space-y-1.5")}>
            {visibleInconsistencies.length === 0 ? (
              <p className="text-sm text-slate-500 py-3">
                {t('employeeDashboard.planning.noSearchResults')}
              </p>
            ) : visibleInconsistencies.map(inc => {
              const isExpanded = expandedProjects.has(inc.projectId);
              const hasMore = inc.teammates.length > 0;
              const isPositive = inc.difference > 0;
              const currentEmployee = employees.find(e => e.id === employeeId);
              const deltaMeta = mobileDeltaMeta(inc.difference, t);
              const DeltaIcon = deltaMeta.Icon;

              return (
                <div
                  key={inc.projectId}
                  className={cn(
                    "border transition-all overflow-hidden",
                    isMobile
                      ? cn(
                          "rounded-xl bg-white border-slate-200/90 shadow-sm",
                          inc.difference < 0
                            ? "border-l-[3px] border-l-red-400/90"
                            : isPositive
                              ? "border-l-[3px] border-l-amber-400/90"
                              : "border-l-[3px] border-l-slate-300"
                        )
                      : cn(
                          "rounded-lg",
                          isPositive ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-200"
                        )
                  )}
                >
                  {/* HEADER - Siempre visible (colapsado) */}
                  <div
                    className={cn(
                      "cursor-pointer transition-colors touch-manipulation",
                      isMobile
                        ? "p-4 space-y-3 active:bg-slate-50/80"
                        : "flex items-center justify-between gap-2 p-2.5 hover:bg-white/50"
                    )}
                    onClick={() => toggleProject(inc.projectId)}
                  >
                    <div className={cn(
                      "min-w-0",
                      isMobile ? "space-y-3" : "flex-1 flex flex-row items-center gap-3"
                    )}>
                      {isMobile ? (
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="flex-1 min-w-0 pt-0.5">
                            <p className="text-[15px] font-semibold text-slate-900 leading-snug line-clamp-2 tracking-tight">
                              <SensitiveText kind="project" id={inc.projectId}>
                                {formatProjectName(inc.projectName)}
                              </SensitiveText>
                            </p>
                          </div>
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2 min-w-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleProject(inc.projectId);
                            }}
                            className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0 p-0"
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                          <div className="font-semibold text-sm text-slate-800 truncate min-w-0">
                            <SensitiveText kind="project" id={inc.projectId}>
                              {formatProjectName(inc.projectName)}
                            </SensitiveText>
                          </div>
                        </div>
                      )}

                      {!isExpanded && (
                        isMobile ? (
                          <>
                            <MobileHoursMetrics
                              deadlineHours={inc.deadlineHours}
                              plannedHours={inc.plannedHours}
                              computedHours={inc.computedHours}
                              t={t}
                            />

                            <div className="flex items-center justify-between gap-3 pt-0.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', deltaMeta.dot)} aria-hidden />
                                <span className={cn('inline-flex items-center gap-1 text-sm font-medium tabular-nums truncate', deltaMeta.text)}>
                                  <DeltaIcon className="h-3.5 w-3.5 shrink-0 opacity-80" />
                                  {deltaMeta.label}
                                </span>
                              </div>

                              {inc.difference < 0 && onAddTasksForProject && (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAddTasksForProject(inc.projectId);
                                  }}
                                  className="h-9 shrink-0 rounded-lg bg-indigo-600 px-3 text-xs font-medium text-white shadow-sm hover:bg-indigo-700"
                                  aria-label={t('employeeDashboard.planning.addTasksAria')}
                                >
                                  <ListPlus className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                                  {t('employeeDashboard.common.add')}
                                </Button>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap gap-y-1">
                            <div className="flex items-center gap-1 text-slate-700 font-semibold">
                              <User className="h-3 w-3" />
                              <span>{t('employeeDashboard.hours.myHours')}</span>
                            </div>
                            {inc.deadlineHours > 0 && (
                              <span>{t('employeeDashboard.hours.deadlineLabel')} <strong className="text-slate-800">{inc.deadlineHours}h</strong></span>
                            )}
                            <span className="text-slate-300">→</span>
                            <span className="text-blue-600">
                              {t('employeeDashboard.hours.planShort')} <strong>{inc.plannedHours}h</strong>
                            </span>
                            <span className="text-emerald-600">
                              {t('employeeDashboard.hours.compShort')} <strong>{inc.computedHours}h</strong>
                            </span>
                            <span className="text-slate-300">→</span>
                            <div className={cn(
                              "flex items-center gap-1 px-2 py-0.5 rounded font-bold text-sm",
                              inc.difference < 0
                                ? "bg-red-100 text-red-700 border border-red-300"
                                : isPositive
                                  ? "bg-amber-100 text-amber-700 border border-amber-300"
                                  : "bg-blue-100 text-blue-700 border border-blue-300"
                            )}>
                              {inc.difference < 0 ? (
                                <>
                                  <TrendingDown className="h-3.5 w-3.5" />
                                  <span>{inc.difference}h</span>
                                </>
                              ) : (
                                <>
                                  {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                                  <span>{isPositive ? '+' : ''}{inc.difference}h</span>
                                </>
                              )}
                            </div>

                            {inc.difference < 0 && onAddTasksForProject && (
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAddTasksForProject(inc.projectId);
                                }}
                                className={cn(addTasksButtonClass, 'flex-shrink-0')}
                                aria-label={t('employeeDashboard.planning.addTasksAria')}
                              >
                                <ListPlus className="h-3.5 w-3.5 shrink-0 text-violet-600" strokeWidth={2} aria-hidden />
                                {t('employeeDashboard.common.add')}
                              </Button>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  {/* CONTENIDO EXPANDIDO */}
                  {isExpanded && (
                    <div className={cn(isMobile ? "px-4 pb-4 pt-0 space-y-3 border-t border-slate-100" : "space-y-2 px-2.5 pb-2.5")}>
                      {(inc.budgetHours > 0 || inc.minimumHours > 0) && (
                        <div className="text-[10px] text-slate-500">
                          {inc.budgetHours > 0 && (
                            <span>{t('employeeDashboard.hours.assigned')} <strong>{inc.budgetHours}h</strong></span>
                          )}
                          {inc.budgetHours > 0 && inc.minimumHours > 0 && <span> • </span>}
                          {inc.minimumHours > 0 && (
                            <span>{t('employeeDashboard.hours.minimum')} <strong>{inc.minimumHours}h</strong></span>
                          )}
                        </div>
                      )}

                      <div className={cn(
                        "min-w-0 overflow-hidden",
                        isMobile
                          ? "rounded-xl border border-indigo-200/60 bg-gradient-to-b from-indigo-50/40 to-white"
                          : "bg-gradient-to-br from-indigo-50 via-indigo-100/30 to-white rounded-lg border-2 border-indigo-400 shadow-lg ring-2 ring-indigo-200/50"
                      )}>
                        {isMobile ? (
                          <div className="flex flex-col gap-3 p-4">
                            <div className="flex items-center gap-3 w-full">
                              <Avatar className="h-9 w-9 shrink-0 border border-indigo-200/80 shadow-sm">
                                <AvatarImage src={currentEmployee?.avatarUrl} />
                                <AvatarFallback className="text-xs bg-gradient-to-br from-indigo-500 to-indigo-600 text-white font-bold">
                                  {currentEmployee?.name.substring(0, 2).toUpperCase() || 'TU'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-900 text-sm">{t('employeeDashboard.common.you')}</span>
                                  <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-white/80 text-indigo-700 border-indigo-200 font-medium">
                                    {t('employeeDashboard.planning.yourData')}
                                  </Badge>
                                </div>
                              </div>
                              {inc.difference < 0 && onAddTasksForProject && (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAddTasksForProject(inc.projectId);
                                  }}
                                  className="h-9 shrink-0 rounded-lg bg-indigo-600 px-3 text-xs font-medium text-white shadow-sm hover:bg-indigo-700"
                                  aria-label={t('employeeDashboard.planning.addTasksAria')}
                                >
                                  <ListPlus className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                                  {t('employeeDashboard.common.add')}
                                </Button>
                              )}
                            </div>

                            <MobileHoursMetrics
                              deadlineHours={inc.deadlineHours}
                              plannedHours={inc.plannedHours}
                              computedHours={inc.computedHours}
                              t={t}
                            />

                            <div className={cn(
                              "flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium",
                              inc.difference < 0
                                ? "bg-red-50/80 text-red-700 border border-red-100"
                                : inc.difference > 0
                                  ? "bg-amber-50/80 text-amber-700 border border-amber-100"
                                  : "bg-emerald-50/80 text-emerald-700 border border-emerald-100"
                            )}>
                              {inc.difference < 0 ? (
                                <>
                                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 opacity-80" />
                                  <AppTrans
                                    i18nKey="employeeDashboard.planning.shortfall"
                                    values={{ hours: Math.abs(inc.difference) }}
                                    components={{ strong: <strong /> }}
                                  />
                                </>
                              ) : inc.difference > 0 ? (
                                <>
                                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 opacity-80" />
                                  <AppTrans
                                    i18nKey="employeeDashboard.planning.exceeded"
                                    values={{ hours: inc.difference }}
                                    components={{ strong: <strong /> }}
                                  />
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 opacity-80" />
                                  <span>{t('employeeDashboard.planning.perfect')}</span>
                                </>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 px-3 py-2.5">
                            <Avatar className="h-8 w-8 border-2 border-indigo-400 shadow-md ring-2 ring-indigo-200 shrink-0">
                              <AvatarImage src={currentEmployee?.avatarUrl} />
                              <AvatarFallback className="text-xs bg-gradient-to-br from-indigo-500 to-indigo-600 text-white font-bold">
                                {currentEmployee?.name.substring(0, 2).toUpperCase() || 'TU'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-slate-900 text-sm">{t('employeeDashboard.common.you')}</span>
                                <Badge variant="outline" className="h-4 px-1.5 text-[9px] bg-indigo-100 text-indigo-700 border-indigo-300 font-semibold">
                                  {t('employeeDashboard.planning.yourDataUpper')}
                                </Badge>
                                {inc.difference < 0 && onAddTasksForProject && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onAddTasksForProject(inc.projectId);
                                    }}
                                    className={cn(addTasksButtonClass, 'flex-shrink-0')}
                                    aria-label={t('employeeDashboard.planning.addTasksAria')}
                                  >
                                    <ListPlus className="h-3.5 w-3.5 shrink-0 text-violet-600" strokeWidth={2} aria-hidden />
                                    {t('employeeDashboard.common.add')}
                                  </Button>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-wrap gap-y-1">
                                {inc.deadlineHours > 0 ? (
                                  <>
                                    <span className="text-xs text-slate-500">
                                      {t('employeeDashboard.hours.deadlineLabel')} <span className="font-semibold text-slate-700">{inc.deadlineHours}h</span>
                                    </span>
                                    <span className="text-slate-300">→</span>
                                  </>
                                ) : (
                                  <span className="text-xs text-slate-400 italic">{t('employeeDashboard.hours.noDeadline')}</span>
                                )}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-blue-600">
                                    {t('employeeDashboard.hours.planShort')} <span className="font-semibold">{inc.plannedHours}h</span>
                                  </span>
                                  <span className="text-xs text-emerald-600">
                                    {t('employeeDashboard.hours.compShort')} <span className="font-semibold">{inc.computedHours}h</span>
                                  </span>
                                </div>
                                <span className="text-slate-300">|</span>
                                <span className="text-xs font-semibold text-slate-700">
                                  {t('employeeDashboard.hours.total')} <span className="text-sm">{round2(inc.plannedHours + inc.computedHours)}h</span>
                                </span>
                                {inc.deadlineHours > 0 && (
                                  <>
                                    <span className="text-slate-300">→</span>
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "text-[10px] h-5 px-1.5 font-semibold",
                                        inc.difference < 0
                                          ? "bg-red-50 text-red-700 border-red-300"
                                          : inc.difference > 0
                                            ? "bg-amber-50 text-amber-700 border-amber-300"
                                            : "bg-emerald-50 text-emerald-700 border-emerald-300"
                                      )}
                                    >
                                      {inc.difference < 0 ? '' : inc.difference > 0 ? '+' : ''}{inc.difference}h
                                    </Badge>
                                  </>
                                )}
                              </div>
                              <div className={cn(
                                "mt-2 flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-semibold flex-wrap",
                                inc.difference < 0
                                  ? "bg-red-50 text-red-700 border border-red-200"
                                  : inc.difference > 0
                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              )}>
                                {inc.difference < 0 ? (
                                  <>
                                    <AlertTriangle className="h-3 w-3" />
                                    <AppTrans
                                    i18nKey="employeeDashboard.planning.shortfall"
                                    values={{ hours: Math.abs(inc.difference) }}
                                    components={{ strong: <strong /> }}
                                  />
                                  </>
                                ) : inc.difference > 0 ? (
                                  <>
                                    <AlertTriangle className="h-3 w-3" />
                                    <AppTrans
                                    i18nKey="employeeDashboard.planning.exceeded"
                                    values={{ hours: inc.difference }}
                                    components={{ strong: <strong /> }}
                                  />
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="h-3 w-3" />
                                    <span>{t('employeeDashboard.planning.perfect')}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {isExpanded && hasMore && (
                        <div className={cn(isMobile ? "pt-1 space-y-3" : "pt-3 border-t-2 border-slate-300")}>
                          <div className={cn(
                            "flex items-center gap-2 text-slate-700",
                            isMobile ? "text-sm font-semibold" : "flex-wrap text-xs font-bold uppercase mb-3"
                          )}>
                            <Users className={cn("text-indigo-600 shrink-0", isMobile ? "h-4 w-4" : "h-4 w-4")} />
                            <span>{isMobile ? t('employeeDashboard.common.team') : t('employeeDashboard.planning.teamStatus')}</span>
                            <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5", !isMobile && "sm:ml-auto")}>
                              {t('employeeDashboard.planning.people', { count: inc.teammates.length })}
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            {inc.teammates.map(tm => {
                              const tmIsPositive = tm.difference > 0;
                              const tmTotal = round2(tm.plannedHours + tm.computedHours);
                              return (
                                <div
                                  key={tm.employeeId}
                                  className={cn(
                                    "min-w-0 overflow-hidden",
                                    isMobile
                                      ? "rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                                      : "bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
                                  )}
                                >
                                  <div className={cn("flex gap-3", isMobile ? "flex-col p-3.5" : "items-center px-3 py-2.5")}>
                                    <div className="flex items-center gap-3 min-w-0">
                                      <Avatar className={cn(
                                        "border border-slate-200 shadow-sm shrink-0",
                                        isMobile ? "h-9 w-9" : "h-8 w-8 border-2"
                                      )}>
                                        <AvatarImage src={tm.avatarUrl} />
                                        <AvatarFallback className="text-xs bg-gradient-to-br from-indigo-100 to-slate-100 text-indigo-700 font-semibold">
                                          {tm.employeeName.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="font-semibold text-slate-800 truncate text-sm min-w-0">
                                        <SensitiveText kind="employee" id={tm.employeeId}>{tm.employeeName}</SensitiveText>
                                      </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      {isMobile ? (
                                        <>
                                          <MobileHoursMetrics
                                            deadlineHours={tm.deadlineHours}
                                            plannedHours={tm.plannedHours}
                                            computedHours={tm.computedHours}
                                            t={t}
                                          />
                                          {tm.deadlineHours > 0 && (
                                            <p className={cn(
                                              "mt-2 text-xs font-medium tabular-nums",
                                              tmIsPositive ? "text-amber-700" : tm.difference < 0 ? "text-red-700" : "text-emerald-700"
                                            )}>
                                              {t('employeeDashboard.planning.deviationAndTotal', {
                                                sign: tmIsPositive ? '+' : '',
                                                hours: tm.difference,
                                                total: tmTotal,
                                              })}
                                            </p>
                                          )}
                                        </>
                                      ) : (
                                        <div className="flex items-center gap-2 flex-wrap gap-y-1">
                                          {tm.deadlineHours > 0 ? (
                                            <>
                                              <span className="text-xs text-slate-500">
                                                {t('employeeDashboard.hours.deadlineLabel')} <span className="font-semibold text-slate-700">{tm.deadlineHours}h</span>
                                              </span>
                                              <span className="text-slate-300">→</span>
                                            </>
                                          ) : (
                                            <span className="text-xs text-slate-400 italic">{t('employeeDashboard.hours.noDeadline')}</span>
                                          )}
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-xs text-blue-600">
                                              {t('employeeDashboard.hours.planShort')} <span className="font-semibold">{tm.plannedHours}h</span>
                                            </span>
                                            <span className="text-xs text-emerald-600">
                                              {t('employeeDashboard.hours.compShort')} <span className="font-semibold">{tm.computedHours}h</span>
                                            </span>
                                          </div>
                                          <span className="text-slate-300">|</span>
                                          <span className="text-xs font-semibold text-slate-700">
                                            {t('employeeDashboard.hours.total')} <span className="text-sm">{tmTotal}h</span>
                                          </span>
                                          {tm.deadlineHours > 0 && (
                                            <>
                                              <span className="text-slate-300">→</span>
                                              <Badge
                                                variant="outline"
                                                className={cn(
                                                  "text-[10px] h-5 px-1.5 font-semibold",
                                                  tmIsPositive
                                                    ? "bg-amber-50 text-amber-700 border-amber-300"
                                                    : tm.difference < 0
                                                      ? "bg-red-50 text-red-700 border-red-300"
                                                      : "bg-emerald-50 text-emerald-700 border-emerald-300"
                                                )}
                                              >
                                                {tmIsPositive ? '+' : ''}{tm.difference}h
                                              </Badge>
                                            </>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
});

