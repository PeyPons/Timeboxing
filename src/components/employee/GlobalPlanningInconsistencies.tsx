import { useMemo, memo, useState, useEffect, useRef } from 'react';
import { useAppAllocations, useAppEmployees, useAppProjects } from '@/contexts/AppContext';
import { useAgency } from '@/contexts/AgencyContext';
import { useDepartmentView } from '@/contexts/DepartmentViewContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandGroup, CommandItem, CommandList, CommandInput, CommandEmpty } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle, CheckCircle2, Users, TrendingUp, TrendingDown,
  Info, ChevronDown, ChevronUp, Filter, Check, Search,
  Ban, CircleDashed, Clock, AlertOctagon, LayoutGrid, ListTodo, Pencil, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CONSTANTS } from '@/config/constants';
import { useProjectAliasing } from '@/hooks/useProjectAliasing';
import type { Allocation, Deadline, GlobalAssignment } from '@/types';
import { fetchDeadlinesForMonth } from '@/utils/deadlineUtils';
import { fetchGlobalAssignmentsForMonth } from '@/utils/globalAssignmentsUtils';
import { filterEmployeesForOperationalMonth } from '@/utils/employeeAssignmentVisibility';
import { format, parseISO, startOfMonth, isBefore, isAfter, subDays } from 'date-fns';
import { normalizeDepartments, employeeBelongsToDepartment } from '@/utils/departmentUtils';
import { SensitiveText } from '@/components/privacy/SensitiveText';
import { usePrivacyDemo } from '@/contexts/PrivacyDemoContext';
import { computeGlobalPlanningInconsistencies, filterInconsistenciesBySearch, type Inconsistency } from '@/utils/planningInconsistencies';
import { round2 } from '@/utils/numbers';
import type { ProjectRowItem, ProjectStatusType } from '@/hooks/useOperationsRadarData';
import { getDeliverablePhase, type DeliverableLifecycle } from '@/utils/deliverableLifecycle';
import { DeliverableLifecycleBadge } from '@/components/projects/DeliverableLifecycleBadge';
import { PROJECT_TYPE_ENTREGABLE } from '@/config/projectTypePresets';
import { getEffectiveCompletedHours } from '@/utils/hoursTracking';
import { fetchAllocationsForDeliverablePhase } from '@/hooks/useDeliverableLifecycleCore';
import { AppTrans, useAppTranslation } from '@/hooks/useAppTranslation';
import { useDateLocale } from '@/hooks/useDateLocale';
import { usePermissions } from '@/hooks/usePermissions';
import { CoherenceAllocationEditDialog } from '@/components/employee/CoherenceAllocationEditDialog';
import { formatTaskWeekCalendarSpan } from '@/utils/planningCoherenceDisplay';

export type OperationsRadarStatusFilter = 'all' | ProjectStatusType | 'lifecycle-risk';

export interface GlobalPlanningOperationsRadarBridge {
  rowsWithStatus: ProjectRowItem[];
  statusFilter: OperationsRadarStatusFilter;
  onStatusFilterChange: (v: OperationsRadarStatusFilter) => void;
  filterCounts: {
    all: number;
    'no-activity': number;
    'needs-planning': number;
    'behind-schedule': number;
    'over-budget': number;
    'in-rule': number;
    'lifecycle-risk': number;
  };
  projectDetailsByProjectId: Map<string, { pendingTasks: Allocation[]; completedTasks: Allocation[] }>;
  /** Ciclo de vida por proyecto (solo entregables con fase); listas usan batch en el padre */
  lifecycleByProjectId: Map<string, DeliverableLifecycle>;
}

interface GlobalPlanningInconsistenciesProps {
  viewDate: Date;
  /** Texto de búsqueda (proyecto/cliente). En Seguimiento operativo suele ir con `onSearchQueryChange` en la misma fila que el empleado. */
  searchQuery?: string | null;
  onSearchQueryChange?: (value: string) => void;
  /** Si true (Seguimiento operativo), no se muestra el dropdown de proyecto; búsqueda + empleado en la misma fila si hay `onSearchQueryChange`. */
  hideProjectSearch?: boolean;
  /** En Seguimiento operativo: etiquetas de estado, filtros predefinidos y detalle de tareas del radar */
  operationsRadar?: GlobalPlanningOperationsRadarBridge;
}

export const GlobalPlanningInconsistencies = memo(function GlobalPlanningInconsistencies({
  viewDate,
  searchQuery: searchQueryProp = null,
  onSearchQueryChange,
  hideProjectSearch = false,
  operationsRadar,
}: GlobalPlanningInconsistenciesProps) {
  const { allocations } = useAppAllocations();
  const { employees, currentUser } = useAppEmployees();
  const { hasPermission } = usePermissions();
  const canAssignTasksToOthers = hasPermission('can_assign_tasks_to_others');
  const { projects, clients } = useAppProjects();
  const { currentAgency } = useAgency();
  const preference = currentAgency?.settings?.hoursTrackingPreference;
  const showComputedHours = preference !== 'actual';
  const { selectedDepartmentId } = useDepartmentView();
  const { t } = useAppTranslation();
  const dateLocale = useDateLocale();
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [globalAssignments, setGlobalAssignments] = useState<GlobalAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [openFilterEmployee, setOpenFilterEmployee] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [openFilterProject, setOpenFilterProject] = useState(false);
  const [coherenceSearchQuery, setCoherenceSearchQuery] = useState('');
  const [tasksModalProjectId, setTasksModalProjectId] = useState<string | null>(null);
  const [coherenceTasksDialogTab, setCoherenceTasksDialogTab] = useState<'month' | 'history'>('month');
  const [showDeliverablePhaseTotals, setShowDeliverablePhaseTotals] = useState(false);
  const [coherenceEditTask, setCoherenceEditTask] = useState<Allocation | null>(null);
  /** Tareas de la fase (entregable) cargadas bajo demanda: el contexto suele traer solo el mes en vista. */
  const [phaseModalAllocations, setPhaseModalAllocations] = useState<Allocation[] | null>(null);
  const [phaseModalLoading, setPhaseModalLoading] = useState(false);
  const [phaseModalError, setPhaseModalError] = useState<Error | null>(null);
  const [phaseModalRetryNonce, setPhaseModalRetryNonce] = useState(0);
  const listTopRef = useRef<HTMLDivElement>(null);
  const { formatName: formatProjectName } = useProjectAliasing();
  const { isActive: isPrivacyDemo, anonymizer: privacyAnonymizer } = usePrivacyDemo();

  const showLocalProjectSearch = !hideProjectSearch;

  const coherenceAutoExpandMax = CONSTANTS.LIMITS.COHERENCE_AUTO_EXPAND_MAX;

  const departments = useMemo(
    () => normalizeDepartments(currentAgency?.settings?.departments),
    [currentAgency?.settings?.departments]
  );

  const employeesForView = useMemo(() => {
    if (!selectedDepartmentId || !departments.length) return employees;
    const dept = departments.find(d => d.id === selectedDepartmentId || d.name === selectedDepartmentId);
    if (!dept) return employees;
    return employees.filter(e => employeeBelongsToDepartment(e.department, dept.id, dept.name));
  }, [employees, selectedDepartmentId, departments]);

  const allowedEmployeeIds = useMemo(() => {
    if (!employeesForView || employeesForView.length === 0) return null as Set<string> | null;
    return new Set(employeesForView.map(e => e.id));
  }, [employeesForView]);

  const departmentNameForView = useMemo(() => {
    if (!selectedDepartmentId) return null;
    const d = departments.find(x => x.id === selectedDepartmentId || x.name === selectedDepartmentId);
    return d?.name ?? null;
  }, [selectedDepartmentId, departments]);

  const radarRowByProjectId = useMemo(() => {
    const map = new Map<string, ProjectRowItem>();
    (operationsRadar?.rowsWithStatus ?? []).forEach(row => map.set(row.projectId, row));
    return map;
  }, [operationsRadar?.rowsWithStatus]);

  const monthKey = format(viewDate, 'yyyy-MM');

  useEffect(() => {
    const loadDeadlines = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await fetchDeadlinesForMonth(monthKey, currentAgency?.id);
        if (error) throw error;
        setDeadlines(data ?? []);
        const gRes = await fetchGlobalAssignmentsForMonth(monthKey, currentAgency?.id);
        if (!gRes.error) setGlobalAssignments(gRes.data ?? []);
        else setGlobalAssignments([]);
      } catch (error) {
        console.error('Error cargando deadlines:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadDeadlines();
  }, [monthKey, currentAgency?.id]);

  const employeesForCoherenceFilter = useMemo(
    () =>
      filterEmployeesForOperationalMonth(employeesForView, monthKey, {
        deadlines,
        globalAssignments,
        allocations,
      }),
    [employeesForView, monthKey, deadlines, globalAssignments, allocations]
  );

  const inconsistencies = useMemo(() => {
    if (isLoading) return [];

    return computeGlobalPlanningInconsistencies({
      deadlines,
      allocations,
      projects,
      employees,
      viewDate,
      allowedEmployeeIds,
      selectedEmployeeId,
      selectedProjectId,
      hideProjectSearch,
      hoursTrackingPreference: preference,
    });
  }, [
    deadlines,
    allocations,
    projects,
    employees,
    viewDate,
    isLoading,
    selectedEmployeeId,
    selectedProjectId,
    hideProjectSearch,
    allowedEmployeeIds,
    preference,
  ]);

  useEffect(() => {
    if (tasksModalProjectId === null) {
      setCoherenceTasksDialogTab('month');
      setShowDeliverablePhaseTotals(false);
      setPhaseModalAllocations(null);
      setPhaseModalLoading(false);
      setPhaseModalError(null);
    }
  }, [tasksModalProjectId]);

  /** Proyecto del modal de tareas (referencia puede rotar; ver fase memoizada por campos primitivos abajo). */
  const modalProjectForTasksDialog = useMemo(() => {
    if (!tasksModalProjectId) return null;
    return projects.find((p) => p.id === tasksModalProjectId) ?? null;
  }, [tasksModalProjectId, projects]);

  /** Fase del entregable para el proyecto del modal de tareas (Seguimiento operativo). */
  const deliverableModalPhase = useMemo(() => {
    const project = modalProjectForTasksDialog;
    if (!project || project.projectType !== PROJECT_TYPE_ENTREGABLE) return null;
    return getDeliverablePhase(project);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- dedupe por fechas; `modalProjectForTasksDialog` rota con `projects`.
  }, [
    modalProjectForTasksDialog?.id,
    modalProjectForTasksDialog?.projectType,
    modalProjectForTasksDialog?.deliverableStartDate,
    modalProjectForTasksDialog?.deliverableDueDate,
  ]);

  const agencyIdForPhaseFetch = currentAgency?.id;

  useEffect(() => {
    if (!tasksModalProjectId || !deliverableModalPhase) {
      return;
    }
    if (!agencyIdForPhaseFetch) {
      setPhaseModalAllocations(null);
      setPhaseModalLoading(false);
      setPhaseModalError(
        new Error(t('employeeDashboard.globalCoherence.noAgencyError'))
      );
      return;
    }
    let cancelled = false;
    setPhaseModalAllocations(null);
    setPhaseModalLoading(true);
    setPhaseModalError(null);
    fetchAllocationsForDeliverablePhase({
      projectId: tasksModalProjectId,
      phase: deliverableModalPhase,
      agencyId: agencyIdForPhaseFetch,
    })
      .then(rows => {
        if (cancelled) return;
        setPhaseModalAllocations(rows);
      })
      .catch(e => {
        if (cancelled) return;
        setPhaseModalError(e instanceof Error ? e : new Error(String(e)));
        setPhaseModalAllocations(null);
      })
      .finally(() => {
        if (!cancelled) setPhaseModalLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tasksModalProjectId, deliverableModalPhase, phaseModalRetryNonce, agencyIdForPhaseFetch, t]);

  /** Fusiona filas de fase con el contexto (misma tarea) para reflejar ediciones locales sin recargar. */
  const mergedPhaseAllocationsForModal = useMemo(() => {
    if (!tasksModalProjectId || !deliverableModalPhase || phaseModalAllocations == null) {
      return null;
    }
    const overlay = new Map(
      (allocations ?? []).filter(a => a.projectId === tasksModalProjectId).map(a => [a.id, a])
    );
    return phaseModalAllocations.map(a => overlay.get(a.id) ?? a);
  }, [phaseModalAllocations, allocations, tasksModalProjectId, deliverableModalPhase]);

  /** Tareas de meses anteriores al mes en vista, dentro de la fase (solo entregables con fase). */
  const historicalTasksForModal = useMemo(() => {
    if (!tasksModalProjectId || !deliverableModalPhase || mergedPhaseAllocationsForModal == null) {
      return [];
    }
    const phase = deliverableModalPhase;
    const viewMonthStart = startOfMonth(viewDate);
    const weekMin = subDays(phase.start, 6);
    return mergedPhaseAllocationsForModal
      .filter(a => {
        const ws = parseISO(a.weekStartDate);
        if (Number.isNaN(ws.getTime())) return false;
        if (!isBefore(startOfMonth(ws), viewMonthStart)) return false;
        if (isBefore(ws, weekMin) || isAfter(ws, phase.due)) return false;
        return true;
      })
      .sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate));
  }, [tasksModalProjectId, deliverableModalPhase, mergedPhaseAllocationsForModal, viewDate]);

  /** Totales por persona en toda la fase (operativo: cerradas según preferencia; abiertas = estimadas). */
  const phaseTotalsByEmployee = useMemo(() => {
    if (!tasksModalProjectId || !deliverableModalPhase || mergedPhaseAllocationsForModal == null) {
      return [];
    }
    const phase = deliverableModalPhase;
    const weekMin = subDays(phase.start, 6);
    const list = mergedPhaseAllocationsForModal.filter(a => {
      const ws = parseISO(a.weekStartDate);
      if (Number.isNaN(ws.getTime())) return false;
      if (isBefore(ws, weekMin) || isAfter(ws, phase.due)) return false;
      return true;
    });
    const map = new Map<string, { effectiveH: number; plannedH: number }>();
    for (const a of list) {
      const eff =
        a.status === 'completed' ? getEffectiveCompletedHours(a, preference) : a.hoursAssigned;
      const cur = map.get(a.employeeId) ?? { effectiveH: 0, plannedH: 0 };
      cur.effectiveH += eff;
      cur.plannedH += a.hoursAssigned;
      map.set(a.employeeId, cur);
    }
    return [...map.entries()]
      .map(([employeeId, v]) => ({
        employeeId,
        effectiveH: round2(v.effectiveH),
        plannedH: round2(v.plannedH),
        name: employees?.find((e) => e.id === employeeId)?.name ?? '—',
      }))
      .sort((a, b) => b.effectiveH - a.effectiveH);
  }, [tasksModalProjectId, deliverableModalPhase, mergedPhaseAllocationsForModal, preference, employees]);

  // Expandir todos solo si hay pocos; con muchos (ej. 100+) mantener colapsados para rendimiento
  useEffect(() => {
    if (inconsistencies.length > 0 && inconsistencies.length <= coherenceAutoExpandMax) {
      setExpandedProjects(new Set(inconsistencies.map(inc => inc.projectId)));
    } else if (inconsistencies.length > coherenceAutoExpandMax) {
      setExpandedProjects(new Set());
    }
  }, [inconsistencies, coherenceAutoExpandMax]);

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

  const filteredBySearch = useMemo(() => {
    const q = (hideProjectSearch ? (searchQueryProp ?? '').trim() : coherenceSearchQuery.trim()).toLowerCase();
    return filterInconsistenciesBySearch({
      inconsistencies,
      query: q,
      projects,
      clients: clients || [],
      formatProjectName,
    });
  }, [inconsistencies, hideProjectSearch, searchQueryProp, coherenceSearchQuery, projects, clients, formatProjectName]);

  const filteredCoherence = useMemo(() => {
    if (!operationsRadar || operationsRadar.statusFilter === 'all') return filteredBySearch;
    if (operationsRadar.statusFilter === 'lifecycle-risk') {
      return filteredBySearch.filter((inc) => {
        const lc = operationsRadar.lifecycleByProjectId.get(inc.projectId);
        return lc != null && (lc.status === 'at-risk' || lc.status === 'over-budget');
      });
    }
    return filteredBySearch.filter(inc => {
      const row = radarRowByProjectId.get(inc.projectId);
      const st = row?.status ?? 'in-rule';
      return st === operationsRadar.statusFilter;
    });
  }, [filteredBySearch, operationsRadar, radarRowByProjectId]);

  const expandAll = () => setExpandedProjects(new Set(filteredCoherence.map(inc => inc.projectId)));
  const collapseAll = () => setExpandedProjects(new Set());
  const allExpanded = filteredCoherence.length > 0 && filteredCoherence.every(inc => expandedProjects.has(inc.projectId));
  const noneExpanded = expandedProjects.size === 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <span>{t('employeeDashboard.globalCoherence.title')}</span>
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
      <Card className="border-l-4 border-l-emerald-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span>{t('employeeDashboard.globalCoherence.title')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">
            {t('employeeDashboard.globalCoherence.allMatch')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className="border-l-4 border-l-amber-500 overflow-hidden min-w-0">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <CardTitle className="text-base flex items-center gap-2 shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <span className="leading-snug">{t('employeeDashboard.globalCoherence.title')}</span>
              <Tooltip>
                <TooltipTrigger className="shrink-0">
                  <Info className="h-4 w-4 text-slate-400" />
                </TooltipTrigger>
                <TooltipContent className="max-w-[min(300px,calc(100vw-2rem))]">
                  <p className="text-xs">
                    {t('employeeDashboard.globalCoherence.tooltip')}
                  </p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
            <div className="flex w-full min-w-0 flex-1 flex-col gap-2">
              {showLocalProjectSearch && (
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="text-xs text-slate-600">{t('employeeDashboard.common.filtersAndSearch')}</span>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                {showLocalProjectSearch && (
                  <>
                    <div className="relative min-w-[200px] flex-1 sm:flex-initial sm:min-w-[200px] max-w-full">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        placeholder={t('employeeDashboard.globalCoherence.searchPlaceholder')}
                        value={coherenceSearchQuery}
                        onChange={(e) => setCoherenceSearchQuery(e.target.value)}
                        className="pl-9 h-10"
                        aria-label={t('employeeDashboard.common.searchCoherenceAria')}
                      />
                    </div>
                    <Popover open={openFilterProject} onOpenChange={setOpenFilterProject}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="min-w-[220px] h-10 text-sm justify-between font-normal w-full sm:w-auto">
                          <span className="truncate">
                            {selectedProjectId === 'all'
                              ? t('employeeDashboard.common.allProjects')
                              : (
                                  <SensitiveText kind="project" id={selectedProjectId}>
                                    {formatProjectName(projects.find(p => p.id === selectedProjectId)?.name ?? '')}
                                  </SensitiveText>
                                )}
                          </span>
                          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="min-w-[300px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder={t('employeeDashboard.common.searchProject')} />
                          <CommandList className="max-h-[320px]">
                            <CommandEmpty>{t('employeeDashboard.common.noProjectsFound')}</CommandEmpty>
                            <CommandGroup>
                              <CommandItem value={t('employeeDashboard.common.allProjects')} className="py-2.5" onSelect={() => { setSelectedProjectId('all'); setOpenFilterProject(false); }}>
                                <Check className={cn('mr-2 h-4 w-4 shrink-0', selectedProjectId === 'all' ? 'opacity-100' : 'opacity-0')} />
                                {t('employeeDashboard.common.allProjects')}
                              </CommandItem>
                              {projects.map(proj => (
                                <CommandItem key={proj.id} value={formatProjectName(proj.name || '')} className="py-2.5" onSelect={() => { setSelectedProjectId(proj.id); setOpenFilterProject(false); }}>
                                  <Check className={cn('mr-2 h-4 w-4 shrink-0', selectedProjectId === proj.id ? 'opacity-100' : 'opacity-0')} />
                                  <span className="truncate">
                                    <SensitiveText kind="project" id={proj.id}>{formatProjectName(proj.name)}</SensitiveText>
                                  </span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </>
                )}
                {hideProjectSearch && onSearchQueryChange && (
                  <div className="relative min-w-[200px] flex-1 sm:flex-initial sm:min-w-[220px] max-w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder={t('operationsRadar.searchPlaceholder')}
                      value={searchQueryProp ?? ''}
                      onChange={(e) => onSearchQueryChange(e.target.value)}
                      className="pl-9 h-10"
                      aria-label={t('operationsRadar.searchAria')}
                    />
                  </div>
                )}
                <Popover open={openFilterEmployee} onOpenChange={setOpenFilterEmployee}>
                  <PopoverTrigger asChild>
                    <div
                      className="relative min-w-[220px] flex-1 sm:flex-initial max-w-full cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onClick={() => setOpenFilterEmployee(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setOpenFilterEmployee(true);
                        }
                      }}
                    >
                      <Input
                        readOnly
                        value={selectedEmployeeId === 'all' ? '' : (isPrivacyDemo ? privacyAnonymizer.employee(selectedEmployeeId) : (employees.find(e => e.id === selectedEmployeeId)?.name ?? ''))}
                        placeholder={t('operationsRadar.coherenceEmployeeFilterPlaceholder', 'Filtrar por empleado...')}
                        className="pr-9 h-10 cursor-pointer bg-background"
                        aria-label={t('operationsRadar.coherenceEmployeeFilterAria', 'Filtrar por empleado')}
                      />
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="min-w-[300px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder={t('operationsRadar.coherenceEmployeeFilterPlaceholder', 'Filtrar por empleado...')} />
                      <CommandList className="max-h-[320px]">
                        <CommandEmpty>{t('employeeDashboard.common.noTeammatesFound')}</CommandEmpty>
                        <CommandGroup>
                          <CommandItem value={t('operationsRadar.allEmployees', 'Todos los empleados')} className="py-2.5" onSelect={() => { setSelectedEmployeeId('all'); setOpenFilterEmployee(false); }}>
                            <Check className={cn('mr-2 h-4 w-4 shrink-0', selectedEmployeeId === 'all' ? 'opacity-100' : 'opacity-0')} />
                            {t('operationsRadar.allEmployees', 'Todos los empleados')}
                          </CommandItem>
                          {employeesForCoherenceFilter.map(emp => (
                            <CommandItem key={emp.id} value={emp.name || ''} className="py-2.5" onSelect={() => { setSelectedEmployeeId(emp.id); setOpenFilterEmployee(false); }}>
                              <Check className={cn('mr-2 h-4 w-4 shrink-0', selectedEmployeeId === emp.id ? 'opacity-100' : 'opacity-0')} />
                              <SensitiveText kind="employee" id={emp.id}>{emp.name}</SensitiveText>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          {hideProjectSearch && departmentNameForView && (
            <CardDescription className="pt-1 text-xs">
              <span className="text-amber-700 font-medium">
                {t('operationsRadar.filteredView', { department: departmentNameForView, defaultValue: 'Vista filtrada por departamento: {{department}}' })}
              </span>
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-3" ref={listTopRef}>
          <p className="text-sm text-slate-600">
            <AppTrans
              i18nKey="employeeDashboard.globalCoherence.projectsWithVariations"
              count={filteredCoherence.length}
              values={{
                count: filteredCoherence.length,
                month: format(viewDate, 'MMMM yyyy', { locale: dateLocale }),
              }}
              components={{ strong: <strong /> }}
            />
            {(coherenceSearchQuery.trim() || (searchQueryProp ?? '').trim()) && inconsistencies.length !== filteredBySearch.length && t('employeeDashboard.globalCoherence.filteredBySearch')}
            {operationsRadar && operationsRadar.statusFilter !== 'all' && filteredBySearch.length !== filteredCoherence.length && ` (${t('operationsRadar.coherenceStatusFilterNote', 'filtrado por estado operativo')})`}.
          </p>

          {operationsRadar && (
            <div className="flex flex-col gap-2">
              <span className="text-xs text-slate-600">{t('operationsRadar.coherenceStatusFiltersLabel', 'Estado operativo del mes')}</span>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant={operationsRadar.statusFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => operationsRadar.onStatusFilterChange('all')}
                  className={cn('h-8 text-xs gap-1.5', operationsRadar.statusFilter === 'all' ? 'bg-slate-900' : 'bg-white')}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  {t('operationsRadar.filterAll', 'Todos')}
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                    {operationsRadar.filterCounts.all}
                  </Badge>
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={operationsRadar.statusFilter === 'no-activity' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => operationsRadar.onStatusFilterChange('no-activity')}
                      className={cn(
                        'h-8 text-xs gap-1.5',
                        operationsRadar.statusFilter === 'no-activity' ? 'bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      <Ban className="h-3.5 w-3.5" />
                      {t('operationsRadar.filterNoActivity', 'Sin actividad')}
                      {operationsRadar.filterCounts['no-activity'] > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] bg-slate-200">
                          {operationsRadar.filterCounts['no-activity']}
                        </Badge>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px] text-center">
                    <p className="text-xs">{t('operationsRadar.tooltipNoActivity')}</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={operationsRadar.statusFilter === 'needs-planning' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => operationsRadar.onStatusFilterChange('needs-planning')}
                      className={cn(
                        'h-8 text-xs gap-1.5',
                        operationsRadar.statusFilter === 'needs-planning' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-white border-amber-200 text-amber-700 hover:bg-amber-50'
                      )}
                    >
                      <CircleDashed className="h-3.5 w-3.5" />
                      {t('operationsRadar.filterNeedsPlanning', 'Falta planificar')}
                      {operationsRadar.filterCounts['needs-planning'] > 0 && (
                        <Badge
                          className={cn(
                            'ml-1 h-5 px-1.5 text-[10px]',
                            operationsRadar.statusFilter === 'needs-planning' ? 'bg-amber-700' : 'bg-amber-100 text-amber-700'
                          )}
                        >
                          {operationsRadar.filterCounts['needs-planning']}
                        </Badge>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px] text-center">
                    <p className="text-xs">{t('operationsRadar.tooltipNeedsPlanning')}</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={operationsRadar.statusFilter === 'behind-schedule' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => operationsRadar.onStatusFilterChange('behind-schedule')}
                      className={cn(
                        'h-8 text-xs gap-1.5',
                        operationsRadar.statusFilter === 'behind-schedule' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-white border-orange-200 text-orange-700 hover:bg-orange-50'
                      )}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      {t('operationsRadar.filterBehindSchedule', 'Retrasados')}
                      {operationsRadar.filterCounts['behind-schedule'] > 0 && (
                        <Badge
                          className={cn(
                            'ml-1 h-5 px-1.5 text-[10px]',
                            operationsRadar.statusFilter === 'behind-schedule' ? 'bg-orange-700' : 'bg-orange-100 text-orange-700'
                          )}
                        >
                          {operationsRadar.filterCounts['behind-schedule']}
                        </Badge>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[220px] text-center">
                    <p className="text-xs">{t('operationsRadar.tooltipBehindSchedule')}</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={operationsRadar.statusFilter === 'over-budget' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => operationsRadar.onStatusFilterChange('over-budget')}
                      className={cn(
                        'h-8 text-xs gap-1.5',
                        operationsRadar.statusFilter === 'over-budget' ? 'bg-red-600 hover:bg-red-700' : 'bg-white border-red-200 text-red-700 hover:bg-red-50'
                      )}
                    >
                      <AlertOctagon className="h-3.5 w-3.5" />
                      {t('operationsRadar.filterOverBudget', 'Exceso horas')}
                      {operationsRadar.filterCounts['over-budget'] > 0 && (
                        <Badge
                          className={cn(
                            'ml-1 h-5 px-1.5 text-[10px]',
                            operationsRadar.statusFilter === 'over-budget' ? 'bg-red-700' : 'bg-red-100 text-red-700'
                          )}
                        >
                          {operationsRadar.filterCounts['over-budget']}
                        </Badge>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px] text-center">
                    <p className="text-xs">{t('operationsRadar.tooltipOverBudget')}</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={operationsRadar.statusFilter === 'in-rule' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => operationsRadar.onStatusFilterChange('in-rule')}
                      className={cn(
                        'h-8 text-xs gap-1.5',
                        operationsRadar.statusFilter === 'in-rule' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                      )}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {t('operationsRadar.filterInRule', 'En regla')}
                      {operationsRadar.filterCounts['in-rule'] > 0 && (
                        <Badge
                          className={cn(
                            'ml-1 h-5 px-1.5 text-[10px]',
                            operationsRadar.statusFilter === 'in-rule' ? 'bg-emerald-700' : 'bg-emerald-100 text-emerald-700'
                          )}
                        >
                          {operationsRadar.filterCounts['in-rule']}
                        </Badge>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[220px] text-center">
                    <p className="text-xs">{t('operationsRadar.tooltipInRule')}</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={operationsRadar.statusFilter === 'lifecycle-risk' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => operationsRadar.onStatusFilterChange('lifecycle-risk')}
                      className={cn(
                        'h-8 text-xs gap-1.5',
                        operationsRadar.statusFilter === 'lifecycle-risk'
                          ? 'bg-violet-600 hover:bg-violet-700'
                          : 'bg-white border-violet-200 text-violet-800 hover:bg-violet-50'
                      )}
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {t('operationsRadar.filterLifecycleRisk', 'Riesgo vida (entreg.)')}
                      {operationsRadar.filterCounts['lifecycle-risk'] > 0 && (
                        <Badge
                          className={cn(
                            'ml-1 h-5 px-1.5 text-[10px]',
                            operationsRadar.statusFilter === 'lifecycle-risk'
                              ? 'bg-violet-800'
                              : 'bg-violet-100 text-violet-800'
                          )}
                        >
                          {operationsRadar.filterCounts['lifecycle-risk']}
                        </Badge>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[240px] text-center">
                    <p className="text-xs">
                      {t('operationsRadar.tooltipLifecycleRisk')}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          )}

          {filteredBySearch.length === 0 && inconsistencies.length > 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">{t('employeeDashboard.common.noSearchResults')}</p>
          ) : null}

          {filteredCoherence.length === 0 && filteredBySearch.length > 0 && operationsRadar && operationsRadar.statusFilter !== 'all' ? (
            <div className="text-center py-4 space-y-2 border rounded-lg bg-slate-50 border-dashed">
              <p className="text-sm text-slate-600">
                {operationsRadar.statusFilter === 'lifecycle-risk'
                  ? t(
                      'operationsRadar.noLifecycleRisk',
                      'No hay entregables con riesgo de vida en este momento.'
                    )
                  : t('operationsRadar.noResults')}
              </p>
              <Button variant="outline" size="sm" onClick={() => operationsRadar.onStatusFilterChange('all')}>
                {t('operationsRadar.showAll', 'Ver todos')}
              </Button>
            </div>
          ) : null}

          {filteredCoherence.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={expandAll} disabled={allExpanded}>
                <ChevronDown className="h-3.5 w-3.5 mr-1" />
                {t('employeeDashboard.common.expandAll')}
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={collapseAll} disabled={noneExpanded}>
                <ChevronUp className="h-3.5 w-3.5 mr-1" />
                {t('employeeDashboard.common.collapseAll')}
              </Button>
            </div>
          )}

          <div className="space-y-2">
            {filteredCoherence.map(inc => {
              const isExpanded = expandedProjects.has(inc.projectId);
              const hasEmployees = inc.employees.length > 0;
              const isPositive = inc.totalDifference > 0;
              const radarRow = radarRowByProjectId.get(inc.projectId);
              const opStatus = radarRow?.status ?? 'in-rule';
              const hoursToCompute =
                radarRow && radarRow.budget > 0 ? round2(Math.max(0, radarRow.budget - radarRow.computed)) : null;
              const statusLabel =
                opStatus === 'over-budget'
                  ? t('operationsRadar.filterOverBudget', 'Exceso horas')
                  : opStatus === 'behind-schedule'
                    ? t('operationsRadar.filterBehindSchedule', 'Retrasados')
                    : opStatus === 'needs-planning'
                      ? t('operationsRadar.filterNeedsPlanning', 'Falta planificar')
                      : opStatus === 'no-activity'
                        ? t('operationsRadar.filterNoActivity', 'Sin actividad')
                        : t('operationsRadar.filterInRule', 'En regla');

              return (
                <div
                  key={`proj-${inc.projectId}`}
                  className={cn(
                    "border rounded-lg p-3 transition-colors min-w-0 overflow-hidden",
                    isPositive ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-200"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={cn(
                        'flex-1 min-w-0',
                        hasEmployees && [
                          'cursor-pointer rounded-md -m-1 p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50',
                          isPositive ? 'hover:bg-amber-100/45' : 'hover:bg-blue-100/45',
                        ]
                      )}
                      role={hasEmployees ? 'button' : undefined}
                      tabIndex={hasEmployees ? 0 : undefined}
                      aria-expanded={hasEmployees ? isExpanded : undefined}
                      aria-label={
                        hasEmployees
                          ? isExpanded
                            ? t('operationsRadar.coherenceCollapseEmployees', 'Colapsar detalle por empleado')
                            : t('operationsRadar.coherenceExpandEmployees', 'Desplegar detalle por empleado')
                          : undefined
                      }
                      onClick={hasEmployees ? () => toggleProject(inc.projectId) : undefined}
                      onKeyDown={
                        hasEmployees
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                toggleProject(inc.projectId);
                              }
                            }
                          : undefined
                      }
                    >
                      <div className="flex flex-wrap items-center gap-2 gap-y-1">
                        <div className="font-semibold text-sm text-slate-800 truncate min-w-0">
                          <SensitiveText kind="project" id={inc.projectId}>
                            {formatProjectName(inc.projectName)}
                          </SensitiveText>
                        </div>
                        {operationsRadar && (
                          <>
                            <Badge
                              variant="outline"
                              className={cn(
                                'shrink-0 text-[10px]',
                                opStatus === 'over-budget' && 'bg-red-100 text-red-800 border-red-200',
                                opStatus === 'behind-schedule' && 'bg-orange-100 text-orange-800 border-orange-200',
                                opStatus === 'needs-planning' && 'bg-amber-100 text-amber-800 border-amber-200',
                                opStatus === 'no-activity' && 'bg-slate-100 text-slate-700 border-slate-200',
                                opStatus === 'in-rule' && 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              )}
                            >
                              {statusLabel}
                            </Badge>
                            {operationsRadar.lifecycleByProjectId.has(inc.projectId) && (
                              <DeliverableLifecycleBadge
                                projectId={inc.projectId}
                                lifecycle={operationsRadar.lifecycleByProjectId.get(inc.projectId)!}
                                disableAutoFetch
                                className="shrink-0"
                              />
                            )}
                          </>
                        )}
                      </div>
                      {(inc.budgetHours > 0 || inc.minimumHours > 0) && (
                        <div className="mt-1 text-[10px] text-slate-500">
                          {inc.budgetHours > 0 && (
                            <span>{t('employeeDashboard.hours.assigned')} <strong>{inc.budgetHours}h</strong></span>
                          )}
                          {inc.budgetHours > 0 && inc.minimumHours > 0 && <span> • </span>}
                          {inc.minimumHours > 0 && (
                            <span>{t('employeeDashboard.hours.minimum')} <strong>{inc.minimumHours}h</strong></span>
                          )}
                        </div>
                      )}
                      {inc.totalDeadlineHours === 0 && (
                        <div className="mt-1.5 text-[11px] text-amber-800 font-medium px-2 py-1 rounded border border-amber-200 bg-amber-50/80">
                          {t('operationsRadar.coherenceNoDeadlineBanner')}
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-xs flex-wrap gap-y-1">
                        {inc.totalDeadlineHours === 0 ? (
                          <>
                            <div className="text-slate-500 italic">{t('employeeDashboard.hours.noDeadline')}</div>
                            <span className="text-slate-300">→</span>
                            <div className="flex items-center gap-2">
                              <span className="text-blue-600">
                                {t('employeeDashboard.hours.planShort')} <span className="font-medium">{inc.totalPlannedHours}h</span>
                              </span>
                              <span className="text-emerald-600">
                                {t('employeeDashboard.hours.compShort')} <span className="font-medium">{inc.totalComputedHours}h</span>
                              </span>
                            </div>
                            {hoursToCompute !== null && operationsRadar && (
                              <>
                                <span className="text-slate-300">→</span>
                                <div className="flex items-center gap-1 text-blue-600">
                                  <span className="text-slate-500">{t('operationsRadar.toCompute', 'Por computar')}</span>
                                  <span className="font-mono font-medium">{hoursToCompute}h</span>
                                </div>
                              </>
                            )}
                            <span className="text-slate-300">→</span>
                            <span className="text-slate-500 shrink-0">
                              {t('operationsRadar.coherenceDeltaPlanPlusComp', 'Plan+Comp')}:
                            </span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="inline-flex items-center gap-0.5 font-bold text-amber-700 cursor-help border-b border-dotted border-amber-400/50">
                                  <TrendingUp className="h-3 w-3 shrink-0" />
                                  +{inc.totalDifference}h
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-[260px] text-xs">
                                {t(
                                  'operationsRadar.coherenceNoDeadlineSumTooltip',
                                  'No hay deadline de referencia este mes: este valor es la suma de planificado + computado del equipo (aparece como alerta porque no se puede contrastar con un objetivo en Deadlines).'
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </>
                        ) : (
                          <>
                            <div>
                              <span className="text-slate-500">{t('employeeDashboard.hours.deadlineLabel')}</span>{' '}
                              <span className="font-medium">{inc.totalDeadlineHours}h</span>
                            </div>
                            <span className="text-slate-300">→</span>
                            <div className="flex items-center gap-2">
                              <span className="text-blue-600">
                                {t('employeeDashboard.hours.planShort')} <span className="font-medium">{inc.totalPlannedHours}h</span>
                              </span>
                              <span className="text-emerald-600">
                                {t('employeeDashboard.hours.compShort')} <span className="font-medium">{inc.totalComputedHours}h</span>
                              </span>
                            </div>
                            {hoursToCompute !== null && operationsRadar && (
                              <>
                                <span className="text-slate-300">→</span>
                                <div className="flex items-center gap-1 text-blue-600">
                                  <span className="text-slate-500">{t('operationsRadar.toCompute', 'Por computar')}</span>
                                  <span className="font-mono font-medium">{hoursToCompute}h</span>
                                </div>
                              </>
                            )}
                            <span className="text-slate-300">→</span>
                            <span className="text-slate-500 shrink-0">
                              {t('operationsRadar.coherenceDeltaVsDeadline', 'Vs deadline')}:
                            </span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn(
                                    'inline-flex items-center gap-0.5 font-bold cursor-help border-b border-dotted',
                                    isPositive ? 'text-amber-700 border-amber-500/40' : 'text-blue-700 border-blue-500/40'
                                  )}
                                >
                                  {isPositive ? <TrendingUp className="h-3 w-3 shrink-0" /> : <TrendingDown className="h-3 w-3 shrink-0" />}
                                  {isPositive ? '+' : ''}
                                  {inc.totalDifference}h
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-[280px] text-xs">
                                {t(
                                  'operationsRadar.coherenceDeadlineDeltaTooltip',
                                  'No es lo mismo que «Por computar»: es (Plan + Comp del mes) menos las horas acordadas en el deadline. Negativo: margen por debajo del acuerdo; positivo: por encima del acuerdo.'
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start gap-1 shrink-0">
                      {operationsRadar && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs shrink-0"
                          onClick={() => setTasksModalProjectId(inc.projectId)}
                        >
                          <ListTodo className="h-3.5 w-3.5 mr-1 shrink-0" />
                          {t('operationsRadar.coherenceTasksButton', 'Tareas')}
                        </Button>
                      )}
                      {hasEmployees && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleProject(inc.projectId);
                          }}
                          className="text-slate-400 hover:text-slate-600 transition-colors p-1 shrink-0"
                          aria-expanded={isExpanded}
                          aria-label={
                            isExpanded
                              ? t('operationsRadar.coherenceCollapseEmployees', 'Colapsar detalle por empleado')
                              : t('operationsRadar.coherenceExpandEmployees', 'Desplegar detalle por empleado')
                          }
                          tabIndex={-1}
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && hasEmployees && (
                    <div className="mt-3 pt-3 border-t border-amber-300">
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-600 uppercase mb-2">
                        <Users className="h-3 w-3" />
                        {t('employeeDashboard.globalCoherence.affectedEmployees', { count: inc.employees.length })}
                      </div>
                      <div className="space-y-1.5">
                        {inc.employees.map((emp, empIndex) => {
                          const empIsPositive = emp.difference > 0;
                          return (
                            <div
                              key={`emp-${emp.employeeId}-${empIndex}`}
                              className="text-xs bg-white rounded p-2 border border-slate-200 flex items-center gap-2"
                            >
                              <Avatar className="h-6 w-6 border border-slate-200">
                                <AvatarImage src={emp.avatarUrl} />
                                <AvatarFallback className="text-[10px] bg-slate-100">
                                  {emp.employeeName.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-slate-700 truncate">
                                  <SensitiveText kind="employee" id={emp.employeeId}>{emp.employeeName}</SensitiveText>
                                </div>
                                <div className="flex flex-col gap-0.5 mt-1 text-[10px]">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {emp.hasDeadline ? (
                                      <>
                                        <span className="text-slate-500">
                                          {t('employeeDashboard.hours.deadlineLabel')} <span className="font-medium">{emp.deadlineHours}h</span>
                                        </span>
                                        <span className="text-slate-400">→</span>
                                      </>
                                    ) : (
                                      <span className="text-amber-600 italic font-medium">{t('employeeDashboard.globalCoherence.notInDeadline')}</span>
                                    )}
                                    <span className="text-blue-600">
                                      {t('employeeDashboard.hours.planShort')} <span className="font-medium">{emp.plannedHours}h</span>
                                    </span>
                                    <span className="text-emerald-600">
                                      {t('employeeDashboard.hours.compShort')} <span className="font-medium">{emp.computedHours}h</span>
                                    </span>
                                    <span className="text-slate-400">→</span>
                                    <span className="text-slate-500 shrink-0">
                                      {t('operationsRadar.coherenceDeltaEmployeeVsDl', 'Vs DL')}:
                                    </span>
                                    <span className={cn("font-bold", empIsPositive ? "text-amber-600" : "text-blue-600")}>
                                      {empIsPositive ? '+' : ''}{emp.difference}h
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={tasksModalProjectId !== null}
        onOpenChange={open => {
          if (!open) setTasksModalProjectId(null);
        }}
      >
        <DialogContent className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden sm:max-w-xl">
          <DialogHeader className="shrink-0 space-y-1 pr-8 pb-3 text-left">
            <DialogTitle className="leading-snug">
              {tasksModalProjectId ? (
                <SensitiveText kind="project" id={tasksModalProjectId}>
                  {formatProjectName(projects.find(p => p.id === tasksModalProjectId)?.name ?? '')}
                </SensitiveText>
              ) : null}
            </DialogTitle>
            <p className="text-sm font-normal text-slate-500">
              {deliverableModalPhase
                ? t(
                    'operationsRadar.coherenceTasksDialogSubtitleDeliverable',
                    'Mes en vista: coherencia con el deadline del mes. En «Meses anteriores» ves tareas de la fase antes de este mes.'
                  )
                : t('operationsRadar.coherenceTasksDialogSubtitle', 'Tareas del mes en este proyecto')}
            </p>
          </DialogHeader>
          {tasksModalProjectId && operationsRadar ? (
            <div
              className="max-h-[min(520px,calc(90vh-7.5rem))] overflow-y-auto overflow-x-hidden overscroll-y-contain pr-2 [-webkit-overflow-scrolling:touch]"
              role="region"
              aria-label={t('operationsRadar.coherenceTasksScrollRegion', 'Lista de tareas')}
            >
              {(() => {
                const detail = operationsRadar.projectDetailsByProjectId.get(tasksModalProjectId);
                const pending = detail?.pendingTasks ?? [];
                const completed = detail?.completedTasks ?? [];
                const isDelivPhase = deliverableModalPhase != null;

                const monthInViewTabs = (
                  <Tabs defaultValue="pending" className="w-full pb-2">
                    <TabsList className="sticky top-0 z-[1] grid w-full grid-cols-2 bg-background pb-0 pt-0">
                      <TabsTrigger value="pending" className="text-xs">
                        {t('operationsRadar.coherenceTasksTabPending', 'Pendientes')}
                        {pending.length > 0 ? ` (${pending.length})` : ''}
                      </TabsTrigger>
                      <TabsTrigger value="completed" className="text-xs">
                        {t('operationsRadar.coherenceTasksTabCompleted', 'Cerradas')}
                        {completed.length > 0 ? ` (${completed.length})` : ''}
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="pending" className="mt-3 space-y-1.5">
                      {pending.length > 0 ? (
                        pending.map(task => {
                          const emp = employees?.find(e => e.id === task.employeeId);
                          const weekSpan = formatTaskWeekCalendarSpan(task.weekStartDate, dateLocale);
                          const canEditThisTask =
                            canAssignTasksToOthers || task.employeeId === currentUser?.id;
                          return (
                            <div
                              key={task.id}
                              className="flex w-full min-w-0 items-start gap-2 border bg-white py-2 pl-2 pr-2 rounded-md text-xs"
                            >
                              <div className="flex min-w-0 flex-1 items-start gap-2 overflow-hidden">
                                <Avatar className="mt-0.5 h-6 w-6 shrink-0 border">
                                  <AvatarImage src={emp?.avatarUrl} />
                                  <AvatarFallback className="bg-slate-100 text-slate-600 text-[9px] font-bold">
                                    {emp?.name?.substring(0, 2).toUpperCase() ?? '??'}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1 overflow-hidden">
                                  <p className="line-clamp-2 min-w-0 break-words font-medium text-slate-800 sm:line-clamp-3">
                                    <SensitiveText kind="task" id={task.id}>
                                      {task.taskName || t('operationsRadar.unnamedTask', 'Tarea sin nombre')}
                                    </SensitiveText>
                                  </p>
                                  <p className="mt-0.5 min-w-0 truncate text-[10px] text-slate-400" title={`${emp?.name ?? ''} · ${weekSpan}`}>
                                    <SensitiveText kind="employee" id={task.employeeId}>{emp?.name ?? '—'}</SensitiveText>
                                    <span className="text-slate-300"> · </span>
                                    <span className="text-slate-500">{weekSpan}</span>
                                  </p>
                                </div>
                              </div>
                              {canEditThisTask && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0 text-slate-500 hover:text-slate-800"
                                  onClick={() => setCoherenceEditTask(task)}
                                  aria-label={t('operationsRadar.coherenceTasksEditAria', 'Editar tarea')}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <div className="flex min-w-[3.5rem] shrink-0 flex-col items-end justify-start gap-0.5 pl-1 text-right tabular-nums">
                                <span className="whitespace-nowrap font-mono text-sm font-bold leading-tight text-slate-800">
                                  {task.hoursAssigned ?? 0}h
                                </span>
                                <span className="whitespace-nowrap text-[10px] leading-tight text-slate-400">
                                  {t('operationsRadar.estimated', 'estimadas')}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-sm text-slate-500 text-center py-6 border border-dashed rounded-md bg-slate-50">
                          {t('operationsRadar.coherenceNoPendingTasks', 'Sin tareas pendientes este mes')}
                        </p>
                      )}
                    </TabsContent>
                    <TabsContent value="completed" className="mt-3 space-y-1.5">
                      {completed.length > 0 ? (
                        completed.map(task => {
                          const emp = employees?.find(e => e.id === task.employeeId);
                          const weekSpan = formatTaskWeekCalendarSpan(task.weekStartDate, dateLocale);
                          const canEditThisTask =
                            canAssignTasksToOthers || task.employeeId === currentUser?.id;
                          return (
                            <div
                              key={task.id}
                              className="flex w-full min-w-0 items-start gap-2 border bg-slate-50/80 py-2 pl-2 pr-2 rounded-md text-xs"
                            >
                              <div className="flex min-w-0 flex-1 items-start gap-2 overflow-hidden">
                                <Avatar className="mt-0.5 h-6 w-6 shrink-0 border">
                                  <AvatarImage src={emp?.avatarUrl} />
                                  <AvatarFallback className="bg-emerald-100 text-emerald-700 text-[9px] font-bold">
                                    {emp?.name?.substring(0, 2).toUpperCase() ?? '??'}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1 overflow-hidden">
                                  <p className="line-clamp-2 min-w-0 break-words font-medium text-slate-800 sm:line-clamp-3">
                                    <SensitiveText kind="task" id={task.id}>
                                      {task.taskName || t('operationsRadar.unnamedTask', 'Tarea sin nombre')}
                                    </SensitiveText>
                                  </p>
                                  <p className="mt-0.5 min-w-0 truncate text-[10px] text-slate-400" title={`${emp?.name ?? ''} · ${weekSpan}`}>
                                    <SensitiveText kind="employee" id={task.employeeId}>{emp?.name ?? '—'}</SensitiveText>
                                    <span className="text-slate-300"> · </span>
                                    <span className="text-slate-500">{weekSpan}</span>
                                  </p>
                                </div>
                              </div>
                              {canEditThisTask && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0 text-slate-500 hover:text-slate-800"
                                  onClick={() => setCoherenceEditTask(task)}
                                  aria-label={t('operationsRadar.coherenceTasksEditAria', 'Editar tarea')}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <div
                                className={cn(
                                  'flex shrink-0 flex-col items-end justify-start gap-0.5 text-right tabular-nums',
                                  showComputedHours ? 'min-w-[7.25rem]' : 'min-w-[5rem]',
                                )}
                              >
                                <span className="max-w-full whitespace-nowrap font-mono text-[10px] leading-tight text-slate-600">
                                  {t('operationsRadar.taskEstShort', 'Est')}: {task.hoursAssigned ?? 0}h
                                </span>
                                <span className="max-w-full whitespace-nowrap font-mono text-[10px] leading-tight text-blue-600">
                                  {t('operationsRadar.actualLabel', 'Real')}: {task.hoursActual ?? task.hoursAssigned ?? 0}h
                                </span>
                                {showComputedHours && (
                                  <span className="max-w-full whitespace-nowrap font-mono text-[10px] leading-tight text-emerald-600">
                                    {t('operationsRadar.computedLabel', 'Computado')}: {task.hoursComputed ?? task.hoursAssigned ?? 0}h
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-sm text-slate-500 text-center py-6 border border-dashed rounded-md bg-slate-50">
                          {t('operationsRadar.coherenceNoCompletedTasks', 'Sin tareas cerradas este mes')}
                        </p>
                      )}
                    </TabsContent>
                  </Tabs>
                );

                return (
                  <div className="space-y-3 pb-2">
                    {isDelivPhase ? (
                      <Tabs
                        value={coherenceTasksDialogTab}
                        onValueChange={v => setCoherenceTasksDialogTab(v as 'month' | 'history')}
                        className="w-full"
                      >
                        <TabsList className="sticky top-0 z-[2] grid h-auto w-full grid-cols-2 gap-1 bg-background p-1">
                          <TabsTrigger value="month" className="text-xs">
                            {t('operationsRadar.coherenceTasksTabThisMonth', 'Mes en vista')}
                          </TabsTrigger>
                          <TabsTrigger value="history" className="text-xs">
                            {t('operationsRadar.coherenceTasksTabPriorMonths', 'Meses anteriores')}
                            {historicalTasksForModal.length > 0 ? ` (${historicalTasksForModal.length})` : ''}
                          </TabsTrigger>
                        </TabsList>
                        <TabsContent value="month" className="mt-0 focus-visible:outline-none">
                          {monthInViewTabs}
                        </TabsContent>
                        <TabsContent value="history" className="mt-3 space-y-1.5 focus-visible:outline-none">
                          {phaseModalLoading ? (
                            <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-slate-500">
                              <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-hidden />
                              <span>
                                {t(
                                  'operationsRadar.coherenceTasksPhaseLoading',
                                  'Cargando tareas de la fase (solo este proyecto)…'
                                )}
                              </span>
                            </div>
                          ) : phaseModalError ? (
                            <div className="space-y-3 py-6 text-center">
                              <p className="text-sm text-red-600">
                                {t('operationsRadar.coherenceTasksPhaseLoadError', 'No se pudieron cargar las tareas de la fase.')}
                              </p>
                              {phaseModalError.message ? (
                                <p className="text-left text-xs text-slate-600 break-words font-mono leading-snug">
                                  {phaseModalError.message}
                                </p>
                              ) : null}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="text-xs"
                                onClick={() => setPhaseModalRetryNonce(n => n + 1)}
                              >
                                {t('operationsRadar.coherenceTasksPhaseRetry', 'Reintentar')}
                              </Button>
                            </div>
                          ) : (
                            <>
                          <p className="text-[10px] text-slate-500 px-0.5">
                            {t('operationsRadar.coherenceTasksPriorHint', {
                              defaultValue:
                                'Solo tareas con semana en la fase del entregable y en meses anteriores a {{month}}.',
                              month: format(viewDate, 'MMMM yyyy', { locale: dateLocale }),
                            })}
                          </p>
                          {historicalTasksForModal.length > 0 ? (
                            historicalTasksForModal.map(task => {
                              const emp = employees?.find(e => e.id === task.employeeId);
                              const weekSpan = formatTaskWeekCalendarSpan(task.weekStartDate, dateLocale);
                              const monthLbl = format(parseISO(task.weekStartDate), 'MMM yyyy', { locale: dateLocale });
                              const isClosed = task.status === 'completed';
                              const canEditThisTask =
                                canAssignTasksToOthers || task.employeeId === currentUser?.id;
                              return (
                                <div
                                  key={task.id}
                                  className={cn(
                                    'flex w-full min-w-0 items-start gap-2 border py-2 pl-2 pr-2 rounded-md text-xs',
                                    isClosed ? 'bg-slate-50/80' : 'bg-white'
                                  )}
                                >
                                  <div className="flex min-w-0 flex-1 items-start gap-2 overflow-hidden">
                                    <Avatar className="mt-0.5 h-6 w-6 shrink-0 border">
                                      <AvatarImage src={emp?.avatarUrl} />
                                      <AvatarFallback
                                        className={cn(
                                          'text-[9px] font-bold',
                                          isClosed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                        )}
                                      >
                                        {emp?.name?.substring(0, 2).toUpperCase() ?? '??'}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0 flex-1 overflow-hidden">
                                      <div className="flex flex-wrap items-center gap-1">
                                        <Badge variant="outline" className="h-5 px-1.5 text-[9px] font-normal text-slate-600">
                                          {monthLbl}
                                        </Badge>
                                        <Badge
                                          variant="outline"
                                          className={cn(
                                            'h-5 px-1.5 text-[9px] font-normal',
                                            isClosed ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'
                                          )}
                                        >
                                          {isClosed
                                            ? t('operationsRadar.coherenceTasksTabCompleted', 'Cerradas')
                                            : t('operationsRadar.coherenceTasksTabPending', 'Pendientes')}
                                        </Badge>
                                      </div>
                                      <p className="mt-1 line-clamp-2 min-w-0 break-words font-medium text-slate-800 sm:line-clamp-3">
                                        <SensitiveText kind="task" id={task.id}>
                                          {task.taskName || t('operationsRadar.unnamedTask', 'Tarea sin nombre')}
                                        </SensitiveText>
                                      </p>
                                      <p className="mt-0.5 min-w-0 truncate text-[10px] text-slate-400" title={`${emp?.name ?? ''} · ${weekSpan}`}>
                                        <SensitiveText kind="employee" id={task.employeeId}>{emp?.name ?? '—'}</SensitiveText>
                                        <span className="text-slate-300"> · </span>
                                        <span className="text-slate-500">{weekSpan}</span>
                                      </p>
                                    </div>
                                  </div>
                                  {canEditThisTask && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 shrink-0 text-slate-500 hover:text-slate-800"
                                      onClick={() => setCoherenceEditTask(task)}
                                      aria-label={t('operationsRadar.coherenceTasksEditAria', 'Editar tarea')}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  <div
                                    className={cn(
                                      'flex shrink-0 flex-col items-end justify-start gap-0.5 text-right tabular-nums',
                                      showComputedHours ? 'min-w-[7.25rem]' : 'min-w-[5rem]',
                                    )}
                                  >
                                    {isClosed ? (
                                      <>
                                        <span className="max-w-full whitespace-nowrap font-mono text-[10px] leading-tight text-slate-600">
                                          {t('operationsRadar.taskEstShort', 'Est')}: {task.hoursAssigned ?? 0}h
                                        </span>
                                        <span className="max-w-full whitespace-nowrap font-mono text-[10px] leading-tight text-blue-600">
                                          {t('operationsRadar.actualLabel', 'Real')}: {task.hoursActual ?? task.hoursAssigned ?? 0}h
                                        </span>
                                        {showComputedHours && (
                                          <span className="max-w-full whitespace-nowrap font-mono text-[10px] leading-tight text-emerald-600">
                                            {t('operationsRadar.computedLabel', 'Computado')}: {task.hoursComputed ?? task.hoursAssigned ?? 0}h
                                          </span>
                                        )}
                                      </>
                                    ) : (
                                      <>
                                        <span className="whitespace-nowrap font-mono text-sm font-bold leading-tight text-slate-800">
                                          {task.hoursAssigned ?? 0}h
                                        </span>
                                        <span className="whitespace-nowrap text-[10px] leading-tight text-slate-400">
                                          {t('operationsRadar.estimated', 'estimadas')}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-sm text-slate-500 text-center py-6 border border-dashed rounded-md bg-slate-50">
                              {t(
                                'operationsRadar.coherenceTasksNoPrior',
                                'Sin tareas en meses anteriores dentro de esta fase.'
                              )}
                            </p>
                          )}
                            </>
                          )}
                        </TabsContent>
                      </Tabs>
                    ) : (
                      monthInViewTabs
                    )}

                    {isDelivPhase && (
                      <div className="space-y-2 border-t border-slate-200 pt-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 w-full text-xs"
                          onClick={() => setShowDeliverablePhaseTotals(s => !s)}
                        >
                          {showDeliverablePhaseTotals
                            ? t('operationsRadar.coherencePhaseTotalsToggleHide')
                            : t('operationsRadar.coherencePhaseTotalsToggleShow')}
                        </Button>
                        {showDeliverablePhaseTotals && (
                          <div className="rounded-md border border-slate-200 bg-slate-50/90 p-3 text-xs">
                            <p className="mb-2 font-semibold text-slate-800">
                              {t('operationsRadar.coherencePhaseTotalsTitle')}
                            </p>
                            <p className="mb-2 text-[10px] leading-snug text-slate-500">
                              {t('operationsRadar.coherencePhaseTotalsFootnote')}
                            </p>
                            {phaseModalLoading ? (
                              <div className="flex items-center gap-2 py-4 text-slate-500">
                                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" aria-hidden />
                                <span>
                                  {t(
                                    'operationsRadar.coherenceTasksPhaseLoading',
                                    'Cargando tareas de la fase (solo este proyecto)…'
                                  )}
                                </span>
                              </div>
                            ) : phaseModalError ? (
                              <div className="space-y-2 py-2">
                                <p className="text-sm text-red-600">
                                  {t('operationsRadar.coherenceTasksPhaseLoadError', 'No se pudieron cargar las tareas de la fase.')}
                                </p>
                                {phaseModalError.message ? (
                                  <p className="text-xs text-slate-600 break-words font-mono leading-snug">
                                    {phaseModalError.message}
                                  </p>
                                ) : null}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs"
                                  onClick={() => setPhaseModalRetryNonce(n => n + 1)}
                                >
                                  {t('operationsRadar.coherenceTasksPhaseRetry', 'Reintentar')}
                                </Button>
                              </div>
                            ) : phaseTotalsByEmployee.length > 0 ? (
                              <table className="w-full border-collapse text-left text-[11px]">
                                <thead>
                                  <tr className="border-b border-slate-200 text-slate-600">
                                    <th className="py-1.5 pr-2 font-medium">
                                      {t('operationsRadar.coherencePhaseTotalsColEmployee', 'Persona')}
                                    </th>
                                    <th className="py-1.5 pr-2 text-right font-medium tabular-nums">
                                      {t('operationsRadar.coherencePhaseTotalsColEffective', 'Operativas')}
                                    </th>
                                    <th className="py-1.5 text-right font-medium tabular-nums">
                                      {t('operationsRadar.coherencePhaseTotalsColPlanned', 'Planif. (Σ est.)')}
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {phaseTotalsByEmployee.map(row => (
                                    <tr key={row.employeeId} className="border-b border-slate-100 last:border-0">
                                      <td className="py-1.5 pr-2">
                                        <SensitiveText kind="employee" id={row.employeeId}>{row.name}</SensitiveText>
                                      </td>
                                      <td className="py-1.5 pr-2 text-right font-mono tabular-nums text-slate-800">
                                        {row.effectiveH}h
                                      </td>
                                      <td className="py-1.5 text-right font-mono tabular-nums text-slate-600">
                                        {row.plannedH}h
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <p className="text-slate-500">{t('operationsRadar.coherencePhaseTotalsEmpty', 'Sin horas en la fase.')}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {coherenceEditTask ? (
        <CoherenceAllocationEditDialog
          key={coherenceEditTask.id}
          allocation={coherenceEditTask}
          viewDate={viewDate}
          deadlines={deadlines}
          allowEditPastWeeks
          onDismiss={() => setCoherenceEditTask(null)}
        />
      ) : null}
    </TooltipProvider>
  );
});
