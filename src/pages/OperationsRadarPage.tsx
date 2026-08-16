import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { useAgency } from '@/contexts/AgencyContext';
import { useDepartmentView } from '@/contexts/DepartmentViewContext';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Activity, ChevronDown, GitBranch, FolderKanban, Pencil, Loader2 } from 'lucide-react';
import {
    GlobalPlanningInconsistencies,
    type OperationsRadarStatusFilter,
} from '@/components/employee/GlobalPlanningInconsistencies';
import { format } from 'date-fns';
import { useDateLocale } from '@/hooks/useDateLocale';
import { useProjectMetrics } from '@/hooks/useProjectMetrics';
import { useProjectAliasing } from '@/hooks/useProjectAliasing';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SensitiveText } from '@/components/privacy/SensitiveText';
import { normalizeDepartments } from '@/utils/departmentUtils';
import { isAllocationInEffectiveMonth } from '@/utils/dateUtils';
import type { Allocation } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getEffectiveCompletedHours } from '@/utils/hoursTracking';
import { useOperationsRadarMonthState } from '@/hooks/useOperationsRadarMonthState';
import { useEnsureMonthWithLoading } from '@/hooks/useEnsureMonthWithLoading';
import { useOperationsRadarData, type ProjectRowItem, type ProjectStatusType } from '@/hooks/useOperationsRadarData';
import { useDeliverableLifecycleBatch } from '@/hooks/useDeliverableLifecycleBatch';
import { getDeliverablePhase } from '@/utils/deliverableLifecycle';
import { getLifecycleStatusClasses } from '@/utils/deliverableLifecycleStatus';
import { PROJECT_TYPE_ENTREGABLE } from '@/config/projectTypePresets';
import { round2 } from '@/utils/numbers';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { useIntegration } from '@/hooks/useIntegration';
import { ProjectMutateDialog } from '@/components/clients-projects/ProjectMutateDialog';
import type { Project } from '@/types';

export default function OperationsRadarPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { projects, clients, allocations, employees, isLoading: isGlobalLoading } = useApp();
    const { currentAgency } = useAgency();
    const { selectedDepartmentId, setSelectedDepartmentId } = useDepartmentView();
    const { formatName: formatProjectName } = useProjectAliasing();
    const { t } = useAppTranslation();
    const dateLocale = useDateLocale();
    const isCrmExportEnabled = useIntegration('crm_export');

    const [globalSearchQuery, setGlobalSearchQuery] = useState('');
    const [lifecycleProjectEdit, setLifecycleProjectEdit] = useState<Project | null>(null);

    const departments = useMemo(
        () => normalizeDepartments(currentAgency?.settings?.departments),
        [currentAgency?.settings?.departments]
    );

    const {
        viewDate,
        deadlines,
        globalAssignments,
        isCurrentMonth,
        currentWeekOfMonth,
        isEndOfMonth,
        handlePrevMonth,
        handleNextMonth,
        handleToday,
        prevMonthDisabled,
    } = useOperationsRadarMonthState({
        searchParams,
        navigate,
        currentAgencyId: currentAgency?.id,
    });

    const isLoadingMonth = useEnsureMonthWithLoading(viewDate, { enabled: !isGlobalLoading });

    // Permitir que ?depto= configure la vista por departamento (una sola fuente de verdad)
    useEffect(() => {
        const depto = searchParams.get('depto');
        if (!depto) return;

        if (depto === 'all' || depto === 'global') {
            setSelectedDepartmentId(null);
            return;
        }

        const match = departments.find(d => d.id === depto || d.name === depto);
        if (match && match.id !== selectedDepartmentId) {
            setSelectedDepartmentId(match.id);
        }
    }, [searchParams, departments, selectedDepartmentId, setSelectedDepartmentId]);

    const deadlinesForMetrics = useMemo(
        () => deadlines.map((d) => ({ projectId: d.projectId, month: d.month, budgetOverride: d.budgetOverride })),
        [deadlines]
    );
    const deadlinesEmployeeVisibility = useMemo(
        () => deadlines.map((d) => ({ month: d.month, employeeHours: d.employeeHours })),
        [deadlines]
    );

    const { projectMetrics } = useProjectMetrics({
        month: viewDate,
        deadlines: deadlinesForMetrics,
        deadlinesEmployeeVisibility,
        globalAssignmentsEmployeeVisibility: globalAssignments,
    });


    const { employeesForView, allProjectsForView } = useOperationsRadarData({
        projectMetrics,
        viewDate,
        isEndOfMonth,
        radarLowProgressExcludeKeywords: currentAgency?.settings?.radarLowProgressExcludeKeywords ?? [],
        selectedDepartmentId,
        departments,
        employees,
        allocations,
        projects,
        deadlines,
        hoursTrackingPreference: currentAgency?.settings?.hoursTrackingPreference ?? null,
    });

    const [statusFilter, setStatusFilter] = useState<OperationsRadarStatusFilter>('all');

    const LIFECYCLE_SECTION_LS = 'operations-radar-lifecycle-section-open';
    const [lifecycleSectionOpen, setLifecycleSectionOpen] = useState(() => {
        try {
            return typeof localStorage !== 'undefined' && localStorage.getItem(LIFECYCLE_SECTION_LS) === 'true';
        } catch {
            return false;
        }
    });
    useEffect(() => {
        try {
            localStorage.setItem(LIFECYCLE_SECTION_LS, lifecycleSectionOpen ? 'true' : 'false');
        } catch {
            /* ignore */
        }
    }, [lifecycleSectionOpen]);

    type ProjectDetail = {
        effectiveUsage: number;
        planningPct: number;
        realPct: number;
        computedPct: number;
        pendingTasks: Allocation[];
        completedTasks: Allocation[];
    };

    const projectDetailsByProjectId = useMemo(() => {
        const map = new Map<string, ProjectDetail>();
        const monthAllocations = (allocations ?? []).filter(a => isAllocationInEffectiveMonth(a.weekStartDate, viewDate));
        const projectIds = new Set(projectMetrics.map(p => p.projectId));
        const budgetByProject = new Map(projectMetrics.map(p => [p.projectId, p.budget]));
        projectIds.forEach(projectId => {
            const projectAllocs = monthAllocations.filter(a => a.projectId === projectId);
            const completedTasks = projectAllocs.filter(a => a.status === 'completed');
            const pendingTasks = projectAllocs.filter(a => a.status !== 'completed');
            const totalAssigned = projectAllocs.reduce((s, a) => s + (a.hoursAssigned || 0), 0);
            const hoursReal = completedTasks.reduce((s, a) => s + (a.hoursActual || 0), 0);
            const hoursComputed = completedTasks.reduce((s, a) => s + getEffectiveCompletedHours(a, currentAgency?.settings?.hoursTrackingPreference), 0);
            const effectiveUsage = hoursComputed + pendingTasks.reduce((s, a) => s + (a.hoursAssigned || 0), 0);
            const budget = budgetByProject.get(projectId) ?? 0;
            const planningPct = budget > 0 ? (effectiveUsage / budget) * 100 : 0;
            const realPct = budget > 0 ? (hoursReal / budget) * 100 : 0;
            const computedPct = budget > 0 ? (hoursComputed / budget) * 100 : 0;
            map.set(projectId, {
                effectiveUsage: round2(effectiveUsage),
                planningPct: round2(planningPct),
                realPct: round2(realPct),
                computedPct: round2(computedPct),
                pendingTasks,
                completedTasks
            });
        });
        return map;
    }, [allocations, viewDate, projectMetrics, currentAgency?.settings?.hoursTrackingPreference]);

    /** Estado único por proyecto (prioridad: exceso > retrasados > falta planificar > sin actividad > en regla).
     * Exceso de horas: (1) horas reales (actual) por encima del presupuesto (riesgo del radar) y además
     * (2) uso efectivo del mes = computado en tareas cerradas + horas planificadas en pendientes, frente al
     * presupuesto efectivo del mes — alineado con la tarjeta de coherencia (Plan + Comp vs contrato/deadline).
     * Así se detecta sobreesfuerzo aunque nadie haya imputado aún todo en "Real".
     * "Falta planificar": el uso efectivo del mes (computado en cerradas + estimado en pendientes) está por
     * debajo del presupuesto efectivo — misma base que la coherencia. Así se cubre el caso de faltar 1h aunque
     * `row.computed` de métricas parezca cubrir el tope (p. ej. pendientes con hoursComputed que no cuentan
     * igual en effectiveUsage) o no haya tareas pendientes pero sí hueco respecto al contrato. */
    const rowsWithStatus = useMemo(() => {
        function getStatus(row: ProjectRowItem): ProjectStatusType {
            const detail = projectDetailsByProjectId.get(row.projectId);
            const effectiveUsage = detail?.effectiveUsage;
            const effectiveOverBudget =
                row.budget > 0 &&
                effectiveUsage != null &&
                round2(effectiveUsage) > round2(row.budget);

            if (row.riskType === 'overBudget' || effectiveOverBudget) return 'over-budget';
            if (row.riskType === 'lowProgress' || row.riskType === 'lowPace') return 'behind-schedule';
            if (row.budget > 0 && row.planned === 0 && row.computed === 0) return 'no-activity';
            const shortOfBudget =
                row.budget > 0 &&
                effectiveUsage != null &&
                round2(effectiveUsage) < round2(row.budget);
            if (shortOfBudget) return 'needs-planning';
            return 'in-rule';
        }
        const statusOrder: Record<ProjectStatusType, number> = { 'over-budget': 0, 'behind-schedule': 1, 'needs-planning': 2, 'no-activity': 3, 'in-rule': 4 };
        return allProjectsForView.map(row => ({ ...row, status: getStatus(row) })).sort((a, b) => {
            const o = statusOrder[a.status] - statusOrder[b.status];
            if (o !== 0) return o;
            return (a.projectName || '').localeCompare(b.projectName || '');
        });
    }, [allProjectsForView, projectDetailsByProjectId]);

    const deliverableProjectIdsForBatch = useMemo(() => {
        const ids = new Set<string>();
        for (const row of rowsWithStatus) {
            const p = projects?.find((x) => x.id === row.projectId);
            if (p?.projectType === PROJECT_TYPE_ENTREGABLE) ids.add(row.projectId);
        }
        return [...ids];
    }, [rowsWithStatus, projects]);

    const { data: lifecycleByProjectId } = useDeliverableLifecycleBatch(deliverableProjectIdsForBatch, {
        costModeOverride: 'standard',
    });

    const filterCounts = useMemo(() => {
        const list = rowsWithStatus;
        const lifecycleRisk = list.filter((row) => {
            const lc = lifecycleByProjectId.get(row.projectId);
            return lc != null && (lc.status === 'at-risk' || lc.status === 'over-budget');
        }).length;
        return {
            all: list.length,
            'no-activity': list.filter(p => p.status === 'no-activity').length,
            'needs-planning': list.filter(p => p.status === 'needs-planning').length,
            'behind-schedule': list.filter(p => p.status === 'behind-schedule').length,
            'over-budget': list.filter(p => p.status === 'over-budget').length,
            'in-rule': list.filter(p => p.status === 'in-rule').length,
            'lifecycle-risk': lifecycleRisk,
        };
    }, [rowsWithStatus, lifecycleByProjectId]);

    const activeDeliverablesWithPhase = useMemo(() => {
        return (projects ?? []).filter(
            (p) =>
                p.status === 'active' &&
                p.projectType === PROJECT_TYPE_ENTREGABLE &&
                getDeliverablePhase(p) != null
        );
    }, [projects]);

    /** Tareas del mes que bloquean a otras (no completadas y de las que depende al menos otra tarea). Respetan filtro por departamento. */
    const blockingTasksForView = useMemo(() => {
        const monthAllocs = (allocations ?? []).filter(a => isAllocationInEffectiveMonth(a.weekStartDate, viewDate));
        const allowedEmployeeIds = employeesForView.length > 0 ? new Set(employeesForView.map(e => e.id)) : null;

        const blocking = monthAllocs.filter(a => {
            if (a.status === 'completed') return false;
            if (allowedEmployeeIds && !allowedEmployeeIds.has(a.employeeId)) return false;
            return monthAllocs.some(other => other.dependencyId === a.id);
        });

        return blocking.map(allocation => {
            const waitingAllocs = monthAllocs.filter(o => o.dependencyId === allocation.id);
            const project = projects?.find(p => p.id === allocation.projectId);
            const client = project ? clients?.find(c => c.id === project.clientId) : undefined;
            const blockerEmployee = employees?.find(e => e.id === allocation.employeeId);

            const waitingEmployees = waitingAllocs
                .map(w => employees?.find(e => e.id === w.employeeId))
                .filter((e): e is NonNullable<typeof e> => Boolean(e));

            // Empleados únicos que están esperando por esta tarea
            const uniqueWaitingEmployees: typeof waitingEmployees = [];
            const seen = new Set<string>();
            waitingEmployees.forEach(emp => {
                if (emp && !seen.has(emp.id)) {
                    seen.add(emp.id);
                    uniqueWaitingEmployees.push(emp);
                }
            });

            // Para cada tarea bloqueada: nombre de la tarea y de la persona bloqueada
            const blockedTaskDetails = waitingAllocs.map(wa => ({
                taskName: wa.taskName || t('operationsRadar.unnamedTask', 'Tarea sin nombre'),
                employeeName: employees?.find(e => e.id === wa.employeeId)?.name ?? t('operationsRadar.somebody', 'Alguien'),
                allocationId: wa.id,
                employeeId: wa.employeeId,
            }));

            return {
                allocation,
                projectName: project?.name ?? '',
                clientName: client?.name ?? '',
                clientId: client?.id,
                blockerEmployee,
                waitingAllocs,
                waitingEmployees: uniqueWaitingEmployees,
                blockedTaskDetails
            };
        });
    }, [allocations, viewDate, employeesForView, projects, employees, clients, t]);

    type BlockingTaskRow = (typeof blockingTasksForView)[number];

    /** Misma cabecera de proyecto solo una vez; filas internas por cada tarea bloqueadora. */
    const blockingTasksGroupedByProject = useMemo(() => {
        const byProject = new Map<string, BlockingTaskRow[]>();
        const order: string[] = [];
        for (const row of blockingTasksForView) {
            const pid = row.allocation.projectId;
            if (!byProject.has(pid)) {
                byProject.set(pid, []);
                order.push(pid);
            }
            byProject.get(pid)!.push(row);
        }
        return order.map(projectId => {
            const items = byProject.get(projectId)!;
            const first = items[0];
            return {
                projectId,
                items,
                projectName: first.projectName,
                clientName: first.clientName,
                clientId: first.clientId,
            };
        });
    }, [blockingTasksForView]);

    const [blockingSectionOpen, setBlockingSectionOpen] = useState(true);
    useEffect(() => {
        if (blockingTasksForView.length > 0) setBlockingSectionOpen(true);
    }, [blockingTasksForView.length]);

    return (
        <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-6">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                            <Activity className="h-6 w-6 text-indigo-600" />
                            {t('operationsRadar.title')}
                        </h1>
                        <p className="text-slate-500 mt-1">
                            {t('operationsRadar.description')}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {isLoadingMonth && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                        <div className="flex items-center gap-1 bg-white rounded-lg border p-1 shadow-sm">
                            <Button variant="ghost" size="icon" onClick={handlePrevMonth} disabled={prevMonthDisabled} className="h-9 w-9 text-slate-500" aria-label={t('operationsRadar.prevMonth')}>
                                &lt;
                            </Button>
                            <Button variant="ghost" onClick={handleToday} className="h-9 px-3 text-sm font-medium text-slate-700 capitalize">
                                {format(viewDate, 'MMM yyyy', { locale: dateLocale })}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={handleNextMonth} className="h-9 w-9 text-slate-500" aria-label={t('operationsRadar.nextMonth')}>
                                &gt;
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <Collapsible open={blockingSectionOpen} onOpenChange={setBlockingSectionOpen} className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <CollapsibleTrigger asChild>
                    <button
                        type="button"
                        className={cn(
                            "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 rounded-lg",
                            blockingTasksForView.length > 0 && "bg-amber-50/50 hover:bg-amber-50"
                        )}
                        aria-expanded={blockingSectionOpen}
                    >
                        <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <GitBranch className="h-4 w-4 text-slate-500 shrink-0" />
                            {blockingTasksForView.length > 0
                                ? t('operationsRadar.blockingTasks', { count: blockingTasksForView.length, defaultValue: '{{count}} tareas bloquean al equipo' })
                                : t('operationsRadar.noBlockingTasks', 'Nada bloquea al equipo este mes')}
                        </span>
                        <ChevronDown className={cn("h-4 w-4 text-slate-400 shrink-0 transition-transform", blockingSectionOpen && "rotate-180")} />
                    </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <div className="px-4 pb-3 pt-0 border-t border-slate-100">
                        {blockingTasksForView.length === 0 ? (
                            <p className="text-xs text-slate-500 pt-3">{t('operationsRadar.noBlockingDetails', 'Todas las tareas de las que dependen otras están completadas o no hay dependencias este mes.')}</p>
                        ) : (
                            <ul className="space-y-3 pt-3 list-none">
                                {blockingTasksGroupedByProject.map(({ projectId, items, projectName, clientName, clientId }) => (
                                    <li key={projectId} className="rounded-lg border border-slate-100 bg-slate-50/80 overflow-hidden">
                                        <div className="rounded-none border-0 border-b border-indigo-100/80 bg-indigo-50/70 px-3 py-2">
                                            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[10px] font-medium uppercase tracking-wide text-indigo-600/90">
                                                        {t('operationsRadar.blockingCardProjectLabel', 'Proyecto')}
                                                    </p>
                                                    <p
                                                        className="mt-0.5 text-sm font-semibold leading-snug text-slate-900"
                                                        title={`${formatProjectName(projectName)}${clientName ? ` · ${clientName}` : ''}`}
                                                    >
                                                        <SensitiveText kind="project" id={projectId}>
                                                            {formatProjectName(projectName)}
                                                        </SensitiveText>
                                                        {clientName && clientId && (
                                                            <>
                                                                <span className="font-normal text-slate-500"> · </span>
                                                                <SensitiveText kind="account" id={clientId} className="font-medium text-slate-700">
                                                                    {clientName}
                                                                </SensitiveText>
                                                            </>
                                                        )}
                                                        {clientName && !clientId && (
                                                            <>
                                                                <span className="font-normal text-slate-500"> · </span>
                                                                <span className="font-medium text-slate-700">{clientName}</span>
                                                            </>
                                                        )}
                                                    </p>
                                                </div>
                                                {items.length > 1 && (
                                                    <span className="text-[10px] font-medium text-indigo-600/80 tabular-nums shrink-0">
                                                        {t('operationsRadar.blockingCountInProject', {
                                                            count: items.length,
                                                            defaultValue: '{{count}} bloqueos',
                                                        })}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <ul className="divide-y divide-slate-100/90 list-none">
                                            {items.map(({ allocation, blockerEmployee, waitingEmployees, blockedTaskDetails }) => {
                                                const blockerName = blockerEmployee?.name ?? t('operationsRadar.somebody', 'Alguien');
                                                const blockerTaskName = allocation.taskName || t('operationsRadar.unnamedTask', 'Tarea sin nombre');

                                                return (
                                                    <li key={allocation.id} className="flex items-start gap-3 py-3 px-3 text-xs">
                                                        <Avatar className="h-8 w-8 border shrink-0 ring-2 ring-amber-200">
                                                            <AvatarImage src={blockerEmployee?.avatarUrl} />
                                                            <AvatarFallback className="bg-amber-100 text-amber-800 text-[10px] font-bold">
                                                                {blockerName.substring(0, 2).toUpperCase()}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="min-w-0 flex-1 space-y-1.5">
                                                            <p className="text-sm font-semibold text-slate-800">
                                                                <span className="text-amber-700">
                                                                    <SensitiveText kind="employee" id={allocation.employeeId}>{blockerName}</SensitiveText>
                                                                </span>
                                                                {t('operationsRadar.blocks', ' bloquea a ')}
                                                                <span className="text-slate-700">
                                                                    {waitingEmployees.length === 0
                                                                        ? t('operationsRadar.otherTasks', 'otras tareas')
                                                                        : waitingEmployees.map((e, i) => (
                                                                            <span key={e.id}>
                                                                                {i > 0 && ', '}
                                                                                <SensitiveText kind="employee" id={e.id}>{e.name}</SensitiveText>
                                                                            </span>
                                                                        ))}
                                                                </span>
                                                            </p>
                                                            <p className="text-[11px] text-slate-600">
                                                                <span className="font-medium text-slate-500">{t('operationsRadar.blockerTask', 'Tarea bloqueadora:')}</span>{' '}
                                                                <span className="text-slate-800 break-words" title={blockerTaskName}>
                                                                    <SensitiveText kind="task" id={allocation.id}>{blockerTaskName}</SensitiveText>
                                                                </span>
                                                            </p>
                                                            {blockedTaskDetails.length > 0 && (
                                                                blockedTaskDetails.length === 1 ? (
                                                                    <p className="text-[11px] text-slate-600">
                                                                        <span className="font-medium text-slate-500">
                                                                            {t('operationsRadar.blockedTask_one', 'Tarea bloqueada:')}
                                                                        </span>{' '}
                                                                        <span className="text-slate-800 break-words">
                                                                            <SensitiveText kind="task" id={blockedTaskDetails[0].allocationId}>
                                                                                {blockedTaskDetails[0].taskName}
                                                                            </SensitiveText>
                                                                        </span>
                                                                        <span className="text-slate-500">
                                                                            {' '}
                                                                            (
                                                                            <SensitiveText kind="employee" id={blockedTaskDetails[0].employeeId}>
                                                                                {blockedTaskDetails[0].employeeName}
                                                                            </SensitiveText>
                                                                            )
                                                                        </span>
                                                                    </p>
                                                                ) : (
                                                                    <div className="text-[11px]">
                                                                        <span className="font-medium text-slate-500">
                                                                            {t('operationsRadar.blockedTask_other', 'Tareas bloqueadas:')}
                                                                        </span>
                                                                        <ul className="mt-0.5 list-none space-y-0.5 pl-0">
                                                                            {blockedTaskDetails.map((b, i) => (
                                                                                <li key={i} className="text-slate-700">
                                                                                    ·{' '}
                                                                                    <span className="text-slate-800 break-words">
                                                                                        <SensitiveText kind="task" id={b.allocationId}>{b.taskName}</SensitiveText>
                                                                                    </span>
                                                                                    <span className="text-slate-500">
                                                                                        {' '}
                                                                                        (
                                                                                        <SensitiveText kind="employee" id={b.employeeId}>{b.employeeName}</SensitiveText>
                                                                                        )
                                                                                    </span>
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </CollapsibleContent>
            </Collapsible>

            {activeDeliverablesWithPhase.length > 0 && (
                <Collapsible
                    open={lifecycleSectionOpen}
                    onOpenChange={setLifecycleSectionOpen}
                    className="rounded-lg border border-slate-200 bg-white shadow-sm"
                >
                    <CollapsibleTrigger asChild>
                        <button
                            type="button"
                            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 rounded-lg"
                            aria-expanded={lifecycleSectionOpen}
                        >
                            <span className="flex items-center gap-2 text-sm font-medium text-slate-800">
                                <FolderKanban className="h-4 w-4 text-violet-600 shrink-0" />
                                {t('operationsRadar.lifecycleSectionTitle', 'Entregables')}
                            </span>
                            <ChevronDown
                                className={cn(
                                    'h-4 w-4 text-slate-400 shrink-0 transition-transform',
                                    lifecycleSectionOpen && 'rotate-180'
                                )}
                            />
                        </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <div className="px-4 pb-4 border-t border-slate-100 overflow-x-auto">
                            <p className="text-[11px] text-slate-500 pt-3 pb-2">
                                {t(
                                    'operationsRadar.lifecycleSectionHint',
                                    'Resumen del ciclo de vida completo; no usa el filtro de mes del radar.'
                                )}
                            </p>
                            <table className="w-full text-xs text-left border-collapse">
                                <thead>
                                    <tr className="border-b text-slate-600">
                                        <th className="py-2 pr-2 font-medium">
                                            {t('operationsRadar.lifecycleColProject', 'Proyecto')}
                                        </th>
                                        <th className="py-2 pr-2 font-medium">
                                            {t('operationsRadar.lifecycleColPhase', 'Fase')}
                                        </th>
                                        <th className="py-2 pr-2 font-medium">
                                            {t('operationsRadar.lifecycleColHours', 'Horas')}
                                        </th>
                                        <th className="py-2 pr-2 font-medium">
                                            {t('operationsRadar.lifecycleColStatus', 'Estado vida')}
                                        </th>
                                        <th className="py-2 font-medium">
                                            {t('operationsRadar.lifecycleColDaysLeft', 'Días rest.')}
                                        </th>
                                        <th className="py-2 w-10 font-medium text-right">
                                            <span className="sr-only">
                                                {t('operationsRadar.lifecycleColActions', 'Acciones')}
                                            </span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeDeliverablesWithPhase.map((p) => {
                                        const lc = lifecycleByProjectId.get(p.id);
                                        if (!lc || lc.status === 'no-phase') return null;
                                        const ph = lc.phase;
                                        const st = getLifecycleStatusClasses(lc.status);
                                        return (
                                            <tr key={p.id} className="border-b border-slate-100">
                                                <td className="py-2 pr-2 font-medium text-slate-800">
                                                    <SensitiveText kind="project" id={p.id}>
                                                        {formatProjectName(p.name)}
                                                    </SensitiveText>
                                                </td>
                                                <td className="py-2 pr-2 text-slate-600 whitespace-nowrap">
                                                    {ph
                                                        ? `${format(ph.start, 'd MMM', { locale: dateLocale })} – ${format(ph.due, 'd MMM yyyy', { locale: dateLocale })}`
                                                        : '—'}
                                                </td>
                                                <td className="py-2 pr-2 tabular-nums">
                                                    {lc.hours.computed} / {lc.hours.budget} h
                                                </td>
                                                <td className="py-2 pr-2">
                                                    <span className={cn('inline-flex items-center gap-1', st.text)}>
                                                        <span className={cn('h-1.5 w-1.5 rounded-full', st.dot)} />
                                                        {st.label}
                                                    </span>
                                                </td>
                                                <td className="py-2 tabular-nums">{lc.pacing.daysRemaining}</td>
                                                <td className="py-2 text-right">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-slate-500 hover:text-slate-900"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setLifecycleProjectEdit(p);
                                                        }}
                                                        aria-label={t(
                                                            'operationsRadar.lifecycleEditProjectAria',
                                                            'Editar proyecto'
                                                        )}
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            )}

            <ProjectMutateDialog
                open={lifecycleProjectEdit !== null}
                onOpenChange={(open) => {
                    if (!open) setLifecycleProjectEdit(null);
                }}
                mode="edit"
                editingProject={lifecycleProjectEdit}
                clients={clients ?? []}
                departmentOptions={departments}
                isCrmExportEnabled={isCrmExportEnabled}
                showDeleteButton={false}
            />

            <GlobalPlanningInconsistencies
                viewDate={viewDate}
                searchQuery={globalSearchQuery}
                onSearchQueryChange={setGlobalSearchQuery}
                hideProjectSearch
                operationsRadar={{
                    rowsWithStatus,
                    statusFilter,
                    onStatusFilterChange: setStatusFilter,
                    filterCounts,
                    projectDetailsByProjectId,
                    lifecycleByProjectId,
                }}
            />
        </div>
    );
}
