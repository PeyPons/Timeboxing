import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  addMonths,
  eachMonthOfInterval,
  endOfMonth,
  format,
  getDate,
  isAfter,
  isBefore,
  isSameMonth,
  parseISO,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { useDateLocale } from '@/hooks/useDateLocale';
import { useApp } from '@/contexts/AppContext';
import { useAgency } from '@/contexts/AgencyContext';
import { useDepartmentView } from '@/contexts/DepartmentViewContext';
import { useSubscriptionLimits } from '@/hooks/useSubscriptionLimits';
import {
  canDownloadFullExportBundle,
  canExportBlock,
  type PlanExportBlockId,
} from '@/config/planExportBlocks';
import { normalizeDepartments, employeeBelongsToDepartment } from '@/utils/departmentUtils';
import { fetchDeadlinesForMonth } from '@/utils/deadlineUtils';
import { fetchGlobalAssignmentsForMonth } from '@/utils/globalAssignmentsUtils';
import { fetchAllocationNotesForIds } from '@/services/allocationNotesService';
import { isAllocationInEffectiveMonth, parseDateStringLocal } from '@/utils/dateUtils';
import { computeGlobalPlanningInconsistencies } from '@/utils/planningCoherenceCompute';
import { computeProjectMetricsForMonth } from '@/utils/projectMetricsCompute';
import { buildOperationsRadarExportPayload } from '@/utils/operationsRadarExport';
import { buildRentabilityDiagnosticPayload } from '@/utils/reportExports/rentabilityDiagnostic';
import { computeBuildRentabilityDiagnosticParams } from '@/utils/reportExports/financialHealthExportCompute';
import { fetchAbsencesOverlappingRange } from '@/utils/appDataLoader';
import {
  buildEmployeeMonthMiniExport,
  buildEmployeesConfigSnapshot,
  computeBurnoutCapacityForMonth,
  employeeMiniFilename,
} from '@/utils/reportExports/burnoutCapacityCompute';
import JSZip from 'jszip';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from '@/lib/notify';
import type { Absence, Allocation, Deadline, TeamEvent, WeeklyFeedback } from '@/types';
import { cn } from '@/lib/utils';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Mes local coherente con Deadlines / planner (evita parseISO de solo fecha en UTC−). */
function monthKeyToDate(monthKey: string): Date {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return startOfMonth(parseISO(`${monthKey}-01`));
  return startOfMonth(new Date(y, m - 1, 1));
}

function allocationsForMonth(allocations: Allocation[], month: Date): Allocation[] {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  return allocations.filter((a) => {
    const weekStart = parseISO(a.weekStartDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return !isAfter(weekStart, monthEnd) && !isBefore(weekEnd, monthStart);
  });
}

function absenceTouchesMonth(a: Absence, month: Date): boolean {
  const ms = startOfMonth(month);
  const me = endOfMonth(month);
  const s = parseDateStringLocal(a.startDate);
  const e = parseDateStringLocal(a.endDate);
  return !isAfter(s, me) && !isBefore(e, ms);
}

function teamEventInMonth(ev: TeamEvent, month: Date): boolean {
  const d = parseDateStringLocal(ev.date);
  return !isBefore(d, startOfMonth(month)) && !isAfter(d, endOfMonth(month));
}

function weekFeedbackInMonth(f: WeeklyFeedback, month: Date): boolean {
  return isAllocationInEffectiveMonth(f.weekStartDate, month);
}

function radarIsEndOfMonth(viewDate: Date): boolean {
  const isCurrentMonth = isSameMonth(new Date(), viewDate);
  const referenceDate = isCurrentMonth ? new Date() : endOfMonth(viewDate);
  const currentWeekOfMonth = Math.ceil(getDate(referenceDate) / 7);
  return currentWeekOfMonth >= 3;
}

export default function DataExportHubPage() {
  const { t } = useTranslation('app');
  const dateLocale = useDateLocale();
  const {
    projects,
    clients,
    allocations,
    employees,
    absences,
    teamEvents,
    weeklyFeedback,
    refetchMonthData,
  } = useApp();
  const { currentAgency } = useAgency();
  const { selectedDepartmentId, setSelectedDepartmentId } = useDepartmentView();
  const {
    historyMinDate: minReportingMonth,
    planId,
    planIncludesAdvancedExports,
  } = useSubscriptionLimits();

  const agencyOnlyHint = t(
    'dataExportHub.agencyOnlyBlock',
    'Requiere plan Agency o superior. Actualiza en Plan y facturación.',
  );
  const canFullBundle = canDownloadFullExportBundle(planId);

  /** Team: exports básicos; Agency+: bundle completo (coherencia, radar, rentabilidad, burnout). */
  const bundleInclude = useMemo(
    () =>
      ({
        deadlines: true,
        globalAssignments: true,
        planning: true,
        coherence: planIncludesAdvancedExports,
        radar: planIncludesAdvancedExports,
        rentability: planIncludesAdvancedExports,
        absences: true,
        burnout: planIncludesAdvancedExports,
      }) as const,
    [planIncludesAdvancedExports],
  );

  const departments = useMemo(
    () => normalizeDepartments(currentAgency?.settings?.departments),
    [currentAgency?.settings?.departments]
  );

  const monthOptions = useMemo(() => {
    const end = addMonths(startOfMonth(new Date()), 1);
    const start = minReportingMonth ?? subMonths(startOfMonth(new Date()), 11);
    return eachMonthOfInterval({ start, end }).map((d) => format(d, 'yyyy-MM'));
  }, [minReportingMonth]);

  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(() => {
    const cur = format(startOfMonth(new Date()), 'yyyy-MM');
    return new Set([cur]);
  });

  const [hoursMode, setHoursMode] = useState<'actual' | 'computed'>(() =>
    currentAgency?.settings?.hoursTrackingPreference === 'actual' ? 'actual' : 'computed'
  );
  const [costMode, setCostMode] = useState<'standard' | 'dynamic'>('standard');
  const [busy, setBusy] = useState(false);

  const employeesForView = useMemo(() => {
    if (!selectedDepartmentId || !departments.length) return employees ?? [];
    const dept = departments.find((d) => d.id === selectedDepartmentId || d.name === selectedDepartmentId);
    if (!dept) return employees ?? [];
    return (employees ?? []).filter((e) => employeeBelongsToDepartment(e.department, dept.id, dept.name));
  }, [employees, selectedDepartmentId, departments]);

  const allowedEmployeeIds = useMemo((): Set<string> | null => {
    if (!selectedDepartmentId) return null;
    if (!employeesForView.length) return new Set();
    return new Set(employeesForView.map((e) => e.id));
  }, [selectedDepartmentId, employeesForView]);

  const toggleMonth = (key: string) => {
    setSelectedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAllMonths = () => setSelectedMonths(new Set(monthOptions));
  const clearMonths = () => setSelectedMonths(new Set());

  const sortedSelectedMonths = useMemo(
    () => [...selectedMonths].filter((k) => monthOptions.includes(k)).sort(),
    [selectedMonths, monthOptions]
  );

  /** Refresca desde Supabase cada mes seleccionado (ignora caché). Así las ausencias añadidas después de la primera visita al mes sí entran en el JSON del informe. */
  const prepareExportMonths = useCallback(async () => {
    const failed: string[] = [];
    for (const key of sortedSelectedMonths) {
      const ok = await refetchMonthData(monthKeyToDate(key));
      if (!ok) failed.push(key);
    }
    if (failed.length > 0) {
      throw new Error(
        t(
          'dataExportHub.refreshFailed',
          'No se pudieron cargar datos actualizados para: {{months}}. Revisa conexión y permisos (ausencias/eventos).',
          { months: failed.join(', ') }
        )
      );
    }
  }, [refetchMonthData, sortedSelectedMonths, t]);

  /** Una query al rango del export: incluye ausencias que cruzan de un mes a otro y no depende del orden de refetch en memoria. */
  const loadAbsencesForExportRange = useCallback(async (): Promise<Absence[]> => {
    if (!currentAgency?.id || sortedSelectedMonths.length === 0) {
      return absences ?? [];
    }
    const from = startOfMonth(monthKeyToDate(sortedSelectedMonths[0]));
    const to = endOfMonth(monthKeyToDate(sortedSelectedMonths[sortedSelectedMonths.length - 1]));
    const { data, error } = await fetchAbsencesOverlappingRange(currentAgency.id, from, to);
    if (error) {
      console.error(error);
      toast.error(
        t(
          'dataExportHub.absencesRangeError',
          'No se pudieron cargar las ausencias del rango seleccionado. Reintenta o revisa permisos; se usan datos en memoria.'
        )
      );
      return absences ?? [];
    }
    return data;
  }, [absences, currentAgency?.id, sortedSelectedMonths, t]);

  const enrichDeadlines = useCallback(
    async (monthKey: string) => {
      const { data: deadlines, error } = await fetchDeadlinesForMonth(monthKey, currentAgency?.id);
      if (error) throw error;
      return (deadlines ?? []).map((d) => {
        const proj = projects.find((p) => p.id === d.projectId);
        const client = proj ? clients.find((c) => c.id === proj.clientId) : undefined;
        return {
          ...d,
          projectName: proj?.name ?? null,
          clientName: client?.name ?? null,
        };
      });
    },
    [currentAgency?.id, projects, clients]
  );

  const buildMonthBundle = useCallback(
    async (monthKey: string, inc: typeof bundleInclude, absencesPool?: Absence[]) => {
      const monthDate = monthKeyToDate(monthKey);
      const absPool = absencesPool ?? absences ?? [];

      const needDeadlinesFetch =
        inc.deadlines ||
        inc.globalAssignments ||
        inc.coherence ||
        inc.radar ||
        inc.rentability ||
        inc.burnout;

      let deadlinesRows: Array<
        Deadline & { projectName?: string | null; clientName?: string | null }
      > = [];
      if (needDeadlinesFetch) {
        deadlinesRows = await enrichDeadlines(monthKey);
      }

      let globalsData: Awaited<ReturnType<typeof fetchGlobalAssignmentsForMonth>>['data'] = [];
      const needGlobalsFetch =
        inc.globalAssignments || inc.radar || inc.rentability || inc.burnout;
      if (needGlobalsFetch) {
        const globalsRes = await fetchGlobalAssignmentsForMonth(monthKey, currentAgency?.id);
        if (globalsRes.error) throw globalsRes.error;
        globalsData = globalsRes.data;
      }

      const deadlinesForMetrics = deadlinesRows.map((d) => ({
        projectId: d.projectId,
        month: d.month,
        budgetOverride: d.budgetOverride,
      }));

      const monthAllocations = inc.planning ? allocationsForMonth(allocations ?? [], monthDate) : [];
      const allocationNotesForMonth =
        inc.planning && monthAllocations.length > 0 && currentAgency?.id
          ? await fetchAllocationNotesForIds(monthAllocations.map(a => a.id), currentAgency.id)
          : [];

      let coherencePayload: {
        schemaVersion: 1;
        exportedAt: string;
        monthKey: string;
        inconsistencies: ReturnType<typeof computeGlobalPlanningInconsistencies>;
      } | null = null;
      if (inc.coherence) {
        coherencePayload = {
          schemaVersion: 1 as const,
          exportedAt: new Date().toISOString(),
          monthKey,
          inconsistencies: computeGlobalPlanningInconsistencies({
            deadlines: deadlinesRows as Deadline[],
            allocations: allocations ?? [],
            projects,
            employees: employees ?? [],
            viewDate: monthDate,
            allowedEmployeeIds,
            selectedEmployeeId: 'all',
            selectedProjectId: 'all',
            hideProjectSearch: true,
            hoursTrackingPreference: currentAgency?.settings?.hoursTrackingPreference ?? null,
          }),
        };
      }

      let radarPayload: ReturnType<typeof buildOperationsRadarExportPayload> | null = null;
      if (inc.radar) {
        const deadlinesEmployeeVisibility = deadlinesRows.map((d) => ({
          month: d.month,
          employeeHours: d.employeeHours,
        }));
        const { projectMetrics } = computeProjectMetricsForMonth({
          allocations: allocations ?? [],
          projects,
          clients,
          employees: employees ?? [],
          month: monthDate,
          hoursTrackingPreference: currentAgency?.settings?.hoursTrackingPreference ?? null,
          deadlines: deadlinesForMetrics,
          deadlinesEmployeeVisibility,
          globalAssignmentsEmployeeVisibility: globalsData,
        });
        radarPayload = buildOperationsRadarExportPayload({
          projectMetrics,
          viewDate: monthDate,
          isEndOfMonth: radarIsEndOfMonth(monthDate),
          radarLowProgressExcludeKeywords: currentAgency?.settings?.radarLowProgressExcludeKeywords ?? [],
          selectedDepartmentId,
          departments,
          employees: employees ?? [],
          allocations: allocations ?? [],
          projects,
          deadlines: deadlinesRows,
          hoursTrackingPreference: currentAgency?.settings?.hoursTrackingPreference ?? null,
        });
      }

      let rentability: ReturnType<typeof buildRentabilityDiagnosticPayload> | null = null;
      if (inc.rentability) {
        const rentParams = computeBuildRentabilityDiagnosticParams({
          currentMonth: monthDate,
          allocations: allocations ?? [],
          projects,
          clients,
          employees: employees ?? [],
          deadlinesForMonth: deadlinesForMetrics,
          deadlinesRows: deadlinesRows.map((d) => ({
            month: d.month,
            employeeHours: d.employeeHours,
          })),
          globalAssignmentsForMonth: globalsData,
          selectedDepartmentId,
          agency: currentAgency
            ? { id: currentAgency.id, name: currentAgency.name, settings: currentAgency.settings }
            : null,
          hoursMode,
          costMode,
          searchQuery: '',
        });
        rentability = buildRentabilityDiagnosticPayload(rentParams);
      }

      let absencesPayload: {
        schemaVersion: 1;
        exportedAt: string;
        monthKey: string;
        absences: Absence[];
        teamEvents: TeamEvent[];
        weeklyFeedback: WeeklyFeedback[];
      } | null = null;
      if (inc.absences) {
        const absMonth = absPool.filter((a) => absenceTouchesMonth(a, monthDate));
        const eventsMonth = (teamEvents ?? []).filter((e) => teamEventInMonth(e, monthDate));
        const feedbackMonth = (weeklyFeedback ?? []).filter((f) => weekFeedbackInMonth(f, monthDate));
        absencesPayload = {
          schemaVersion: 1 as const,
          exportedAt: new Date().toISOString(),
          monthKey,
          absences: absMonth,
          teamEvents: eventsMonth,
          weeklyFeedback: feedbackMonth,
        };
      }

      let burnoutCapacity: ReturnType<typeof computeBurnoutCapacityForMonth> | null = null;
      if (inc.burnout) {
        burnoutCapacity = computeBurnoutCapacityForMonth({
          month: monthDate,
          employees: employees ?? [],
          allocations: allocations ?? [],
          absences: absPool,
          teamEvents: teamEvents ?? [],
          deadlines: deadlinesRows as Deadline[],
          globalAssignments: globalsData,
          projects,
          clients,
          deadlinesForMetrics,
          hoursTrackingPreference: currentAgency?.settings?.hoursTrackingPreference ?? null,
          allowedEmployeeIds,
        });
      }

      return {
        monthKey,
        deadlines: inc.deadlines
          ? {
              schemaVersion: 1 as const,
              exportedAt: new Date().toISOString(),
              monthKey,
              departmentScope: selectedDepartmentId,
              rows: deadlinesRows,
            }
          : null,
        globalAssignments: inc.globalAssignments
          ? {
              schemaVersion: 1 as const,
              exportedAt: new Date().toISOString(),
              monthKey,
              rows: globalsData,
            }
          : null,
        planningAllocations: inc.planning
          ? {
              schemaVersion: 1 as const,
              exportedAt: new Date().toISOString(),
              monthKey,
              count: monthAllocations.length,
              allocations: monthAllocations,
              allocationNotes: allocationNotesForMonth,
            }
          : null,
        coherence: coherencePayload,
        operationsRadar: radarPayload,
        rentability,
        absencesAndEvents: absencesPayload,
        burnoutCapacity,
      };
    },
    [
      enrichDeadlines,
      currentAgency,
      allocations,
      projects,
      clients,
      employees,
      allowedEmployeeIds,
      selectedDepartmentId,
      departments,
      hoursMode,
      costMode,
      absences,
      teamEvents,
      weeklyFeedback,
    ]
  );

  const onDownloadBundle = async () => {
    if (!canFullBundle) {
      toast.error(agencyOnlyHint);
      return;
    }
    if (sortedSelectedMonths.length === 0) {
      toast.error(t('dataExportHub.noMonths', 'Selecciona al menos un mes'));
      return;
    }
    setBusy(true);
    try {
      await prepareExportMonths();
      const absencesPool = await loadAbsencesForExportRange();
      const months: Record<string, Record<string, unknown>> = {};
      for (const mk of sortedSelectedMonths) {
        const part = await buildMonthBundle(mk, bundleInclude, absencesPool);
        const slice: Record<string, unknown> = {};
        if (part.deadlines) slice.deadlines = part.deadlines;
        if (part.globalAssignments) slice.globalAssignments = part.globalAssignments;
        if (part.planningAllocations) slice.planningAllocations = part.planningAllocations;
        if (part.coherence) slice.coherence = part.coherence;
        if (part.operationsRadar) slice.operationsRadar = part.operationsRadar;
        if (part.rentability) slice.rentability = part.rentability;
        if (part.absencesAndEvents) slice.absencesAndEvents = part.absencesAndEvents;
        if (part.burnoutCapacity) slice.burnoutCapacity = part.burnoutCapacity;
        months[mk] = slice;
      }
      const agencySlug = currentAgency?.slug ?? 'agencia';
      const range = `${sortedSelectedMonths[0]}_${sortedSelectedMonths[sortedSelectedMonths.length - 1]}`;
      downloadJson(`taimbox-informe-bundle-${agencySlug}-${range}.json`, {
        schemaVersion: 1 as const,
        exportedAt: new Date().toISOString(),
        agencyId: currentAgency?.id ?? null,
        agencyName: currentAgency?.name ?? null,
        departmentFilter: selectedDepartmentId,
        containsPersonalData: true as const,
        employeesConfig: buildEmployeesConfigSnapshot(employees ?? [], allowedEmployeeIds),
        months,
      });
      toast.success(t('dataExportHub.bundleSuccess', 'Bundle descargado'));
    } catch (e) {
      console.error(e);
      toast.error(t('dataExportHub.bundleError', 'Error generando el bundle'));
    } finally {
      setBusy(false);
    }
  };

  const onDownloadZipBundle = async () => {
    if (!canFullBundle) {
      toast.error(agencyOnlyHint);
      return;
    }
    if (sortedSelectedMonths.length === 0) {
      toast.error(t('dataExportHub.noMonths', 'Selecciona al menos un mes'));
      return;
    }
    setBusy(true);
    try {
      await prepareExportMonths();
      const absencesPool = await loadAbsencesForExportRange();
      const zip = new JSZip();
      const employeesConfig = buildEmployeesConfigSnapshot(employees ?? [], allowedEmployeeIds);
      zip.file('employees-config.json', JSON.stringify(employeesConfig, null, 2));

      const includePerEmployee =
        selectedDepartmentId != null ||
        (employeesForView.length > 0 && employeesForView.length <= 45);

      zip.file(
        'manifest.json',
        JSON.stringify(
          {
            schemaVersion: 1 as const,
            exportedAt: new Date().toISOString(),
            agencyId: currentAgency?.id ?? null,
            agencyName: currentAgency?.name ?? null,
            departmentFilter: selectedDepartmentId,
            containsPersonalData: true as const,
            months: sortedSelectedMonths,
            hoursModeRentability: hoursMode,
            costModeRentability: costMode,
            perEmployeeFilesIncluded: includePerEmployee,
            notes: [
              'Carpeta por mes (YYYY-MM). burnout-by-employee.json: ocupación vs capacidad neta, buffer para imprevistos y heurística de riesgo.',
              'Si no hay carpeta by-employee/, el alcance supera el límite (45) sin filtro de departamento: usa el agregado y planning-allocations.json.',
              'Ausencias: se cargan para todo el rango del export (incluye tramos que cruzan de un mes a otro).',
            ],
          },
          null,
          2
        )
      );

      for (const mk of sortedSelectedMonths) {
        const part = await buildMonthBundle(mk, bundleInclude, absencesPool);
        const folder = zip.folder(mk);
        if (!folder) continue;

        const put = (name: string, data: unknown) => {
          folder.file(name, JSON.stringify(data, null, 2));
        };

        if (part.deadlines) put('deadlines.json', part.deadlines);
        if (part.globalAssignments) put('global-assignments.json', part.globalAssignments);
        if (part.planningAllocations) put('planning-allocations.json', part.planningAllocations);
        if (part.coherence) put('coherence.json', part.coherence);
        if (part.operationsRadar) put('operations-radar.json', part.operationsRadar);
        if (part.rentability) put('rentability.json', part.rentability);
        if (part.absencesAndEvents) put('absences-events-feedback.json', part.absencesAndEvents);
        if (part.burnoutCapacity) put('burnout-by-employee.json', part.burnoutCapacity);

        if (includePerEmployee && part.burnoutCapacity) {
          const monthDate = monthKeyToDate(mk);
          const monthAllocations = allocationsForMonth(allocations ?? [], monthDate);
          const monthDeadlineRows = (part.deadlines?.rows ?? []) as Deadline[];
          const absM = absencesPool.filter((a) => absenceTouchesMonth(a, monthDate));
          const evM = (teamEvents ?? []).filter((e) => teamEventInMonth(e, monthDate));
          const fbM = (weeklyFeedback ?? []).filter((f) => weekFeedbackInMonth(f, monthDate));
          const rowById = new Map(part.burnoutCapacity.rows.map((r) => [r.employeeId, r]));

          const sub = folder.folder('by-employee');
          for (const emp of employeesForView) {
            if (!emp.isActive && !rowById.has(emp.id)) continue;
            const mini = buildEmployeeMonthMiniExport({
              monthKey: mk,
              employee: emp,
              burnoutRow: rowById.get(emp.id),
              allocationsMonth: monthAllocations,
              deadlinesMonth: monthDeadlineRows,
              absencesMonth: absM,
              teamEventsMonth: evM,
              weeklyFeedbackMonth: fbM,
            });
            sub?.file(employeeMiniFilename(emp), JSON.stringify(mini, null, 2));
          }
        }
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const agencySlug = currentAgency?.slug ?? 'agencia';
      const range = `${sortedSelectedMonths[0]}_${sortedSelectedMonths[sortedSelectedMonths.length - 1]}`;
      downloadBlob(`taimbox-informe-${agencySlug}-${range}.zip`, blob);
      toast.success(t('dataExportHub.zipSuccess', 'ZIP descargado'));
    } catch (e) {
      console.error(e);
      toast.error(t('dataExportHub.zipError', 'Error generando el ZIP'));
    } finally {
      setBusy(false);
    }
  };

  const blockAllowed = (block: PlanExportBlockId) => canExportBlock(planId, block);

  const exportOne = async (
    label: string,
    build: (monthKey: string, absencesPool: Absence[]) => Promise<unknown>,
    filename: (monthKey: string) => string
  ) => {
    if (sortedSelectedMonths.length === 0) {
      toast.error(t('dataExportHub.noMonths', 'Selecciona al menos un mes'));
      return;
    }
    setBusy(true);
    try {
      await prepareExportMonths();
      const absencesPool = await loadAbsencesForExportRange();
      for (const mk of sortedSelectedMonths) {
        const data = await build(mk, absencesPool);
        downloadJson(filename(mk), data);
      }
      toast.success(t('dataExportHub.sectionSuccess', { label }));
    } catch (e) {
      console.error(e);
      toast.error(t('dataExportHub.sectionError', { label }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-8 text-slate-800">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild className="gap-1">
          <Link to="/agency">
            <ArrowLeft className="h-4 w-4" />
            {t('dataExportHub.backAgency', 'Configuración de agencia')}
          </Link>
        </Button>
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('dataExportHub.title', 'Exportación de datos para informes')}</h1>
        <p className="text-sm text-slate-600">
          {t(
            'dataExportHub.subtitle',
            'Descargas JSON por bloque y mes. Incluye datos personales y laborales: trata el archivo con cuidado.'
          )}
        </p>
        {minReportingMonth && (
          <p className="text-xs text-amber-700">
            {t('dataExportHub.historyLimit', {
              defaultValue: 'Tu plan limita histórico desde {{date}}',
              date: format(minReportingMonth, 'MMMM yyyy', { locale: dateLocale }),
            })}
          </p>
        )}
      </header>

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-medium">{t('dataExportHub.monthsTitle', 'Meses')}</h2>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={selectAllMonths}>
            {t('dataExportHub.selectAll', 'Todos')}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={clearMonths}>
            {t('dataExportHub.clear', 'Ninguno')}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
          {monthOptions.map((mk) => (
            <label key={mk} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={selectedMonths.has(mk)}
                onChange={() => toggleMonth(mk)}
                className="rounded border-slate-300"
              />
              {format(monthKeyToDate(mk), 'MMM yyyy', { locale: dateLocale })}
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-medium">{t('dataExportHub.scopeTitle', 'Alcance')}</h2>
        <p className="text-xs text-slate-500">
          {t('dataExportHub.scopeHint', 'Usa el mismo criterio que Rentabilidad / Operaciones: departamento vacío = agencia completa.')}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={selectedDepartmentId == null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedDepartmentId(null)}
          >
            {t('dataExportHub.scopeAgency', 'Agencia completa')}
          </Button>
          {departments.map((d) => (
            <Button
              key={d.id}
              type="button"
              variant={selectedDepartmentId === d.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedDepartmentId(d.id)}
            >
              {d.name}
            </Button>
          ))}
        </div>
      </section>

      {planIncludesAdvancedExports ? (
      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-medium">{t('dataExportHub.finanzasOptions', 'Opciones rentabilidad')}</h2>
        <div className="flex flex-wrap gap-4">
          <div>
            <Label className="text-xs">{t('dataExportHub.hoursMode', 'Horas')}</Label>
            <select
              className="mt-1 block h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
              value={hoursMode}
              onChange={(e) => setHoursMode(e.target.value as 'actual' | 'computed')}
            >
              <option value="computed">{t('dataExportHub.hoursComputed', 'Computadas')}</option>
              <option value="actual">{t('dataExportHub.hoursActual', 'Reales')}</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">{t('dataExportHub.costMode', 'Coste')}</Label>
            <select
              className="mt-1 block h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
              value={costMode}
              onChange={(e) => setCostMode(e.target.value as 'standard' | 'dynamic')}
            >
              <option value="standard">{t('dataExportHub.costStandard', 'Operativo (estándar)')}</option>
              <option value="dynamic">{t('dataExportHub.costDynamic', 'Dinámico')}</option>
            </select>
          </div>
        </div>
      </section>
      ) : (
        <p className="text-xs text-slate-600 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
          {t(
            'dataExportHub.basicExportsNote',
            'En plan Team puedes exportar deadlines, planificación y ausencias. Radar, rentabilidad y ZIP completo requieren Agency.',
          )}
        </p>
      )}

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Button
            type="button"
            disabled={busy || sortedSelectedMonths.length === 0 || !canFullBundle}
            title={!canFullBundle ? agencyOnlyHint : undefined}
            onClick={onDownloadZipBundle}
            className="gap-2"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {t('dataExportHub.downloadZip', 'Descargar ZIP completo (desglosado por mes y tipo)')}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || sortedSelectedMonths.length === 0 || !canFullBundle}
            title={!canFullBundle ? agencyOnlyHint : undefined}
            onClick={onDownloadBundle}
            className="gap-2"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {t('dataExportHub.downloadBundle', 'JSON único (todos los bloques y meses)')}
          </Button>
        </div>
        <p className="text-xs text-slate-600 max-w-2xl">
          {t(
            'dataExportHub.zipExplain',
            'El ZIP incluye configuración de horarios por empleado, planificación, deadlines, ausencias, eventos, feedback, rentabilidad, radar, coherencia y un archivo de ocupación/burnout por mes. Las ausencias se consultan para todo el rango de meses seleccionados (incluye vacaciones que cruzan de un mes a otro). Con más de 45 personas sin filtrar por departamento, los JSON por empleado se omiten (sigue el agregado burnout-by-employee.json).'
          )}
        </p>

        <ExportBlock
          title={t('dataExportHub.block.deadlines', 'Deadlines')}
          disabled={!blockAllowed('deadlines')}
          disabledHint={agencyOnlyHint}
          busy={busy}
          onDownload={() =>
            exportOne(
              'Deadlines',
              async (mk, _absencesPool) => ({
                schemaVersion: 1 as const,
                exportedAt: new Date().toISOString(),
                monthKey: mk,
                departmentScope: selectedDepartmentId,
                rows: await enrichDeadlines(mk),
              }),
              (mk) => `taimbox-deadlines-${mk}.json`
            )
          }
        />

        <ExportBlock
          title={t('dataExportHub.block.globalAssignments', 'Asignaciones globales (Deadlines)')}
          disabled={!blockAllowed('globalAssignments')}
          disabledHint={agencyOnlyHint}
          busy={busy}
          onDownload={() =>
            exportOne(
              'Global assignments',
              async (mk, _absencesPool) => {
                const { data, error } = await fetchGlobalAssignmentsForMonth(mk, currentAgency?.id);
                if (error) throw error;
                return {
                  schemaVersion: 1 as const,
                  exportedAt: new Date().toISOString(),
                  monthKey: mk,
                  rows: data,
                };
              },
              (mk) => `taimbox-global-assignments-${mk}.json`
            )
          }
        />

        <ExportBlock
          title={t('dataExportHub.block.planning', 'Planificación (allocations del mes)')}
          disabled={!blockAllowed('planning')}
          disabledHint={agencyOnlyHint}
          busy={busy}
          onDownload={() =>
            exportOne(
              'Planning',
              async (mk, _absencesPool) => {
                const monthDate = monthKeyToDate(mk);
                const monthAllocations = allocationsForMonth(allocations ?? [], monthDate);
                return {
                  schemaVersion: 1 as const,
                  exportedAt: new Date().toISOString(),
                  monthKey: mk,
                  count: monthAllocations.length,
                  allocations: monthAllocations,
                };
              },
              (mk) => `taimbox-planificacion-${mk}.json`
            )
          }
        />

        <ExportBlock
          title={t('dataExportHub.block.coherence', 'Coherencia / control de planificación global')}
          disabled={!blockAllowed('coherence')}
          disabledHint={agencyOnlyHint}
          busy={busy}
          onDownload={() =>
            exportOne(
              'Coherence',
              async (mk, _absencesPool) => {
                const monthDate = monthKeyToDate(mk);
                const { data: dl } = await fetchDeadlinesForMonth(mk, currentAgency?.id);
                const coherence = computeGlobalPlanningInconsistencies({
                  deadlines: dl ?? [],
                  allocations: allocations ?? [],
                  projects,
                  employees: employees ?? [],
                  viewDate: monthDate,
                  allowedEmployeeIds,
                  selectedEmployeeId: 'all',
                  selectedProjectId: 'all',
                  hideProjectSearch: true,
                  hoursTrackingPreference: currentAgency?.settings?.hoursTrackingPreference ?? null,
                });
                return {
                  schemaVersion: 1 as const,
                  exportedAt: new Date().toISOString(),
                  monthKey: mk,
                  inconsistencies: coherence,
                };
              },
              (mk) => `taimbox-coherencia-${mk}.json`
            )
          }
        />

        <ExportBlock
          title={t('dataExportHub.block.radar', 'Seguimiento operativo (radar)')}
          disabled={!blockAllowed('radar')}
          disabledHint={agencyOnlyHint}
          busy={busy}
          onDownload={() =>
            exportOne(
              'Radar',
              async (mk, _absencesPool) => {
                const monthDate = monthKeyToDate(mk);
                const { data: dlRaw } = await fetchDeadlinesForMonth(mk, currentAgency?.id);
                const { data: gRaw } = await fetchGlobalAssignmentsForMonth(mk, currentAgency?.id);
                const dl = dlRaw ?? [];
                const deadlinesForMetrics = dl.map((d) => ({
                  projectId: d.projectId,
                  month: d.month,
                  budgetOverride: d.budgetOverride,
                }));
                const deadlinesEmployeeVisibility = dl.map((d) => ({
                  month: d.month,
                  employeeHours: d.employeeHours,
                }));
                const { projectMetrics } = computeProjectMetricsForMonth({
                  allocations: allocations ?? [],
                  projects,
                  clients,
                  employees: employees ?? [],
                  month: monthDate,
                  hoursTrackingPreference: currentAgency?.settings?.hoursTrackingPreference ?? null,
                  deadlines: deadlinesForMetrics,
                  deadlinesEmployeeVisibility,
                  globalAssignmentsEmployeeVisibility: gRaw ?? [],
                });
                return buildOperationsRadarExportPayload({
                  projectMetrics,
                  viewDate: monthDate,
                  isEndOfMonth: radarIsEndOfMonth(monthDate),
                  radarLowProgressExcludeKeywords: currentAgency?.settings?.radarLowProgressExcludeKeywords ?? [],
                  selectedDepartmentId,
                  departments,
                  employees: employees ?? [],
                  allocations: allocations ?? [],
                  projects,
                  deadlines: dl,
                  hoursTrackingPreference: currentAgency?.settings?.hoursTrackingPreference ?? null,
                });
              },
              (mk) => `taimbox-radar-${mk}.json`
            )
          }
        />

        <ExportBlock
          title={t('dataExportHub.block.rentability', 'Rentabilidad (diagnóstico JSON)')}
          disabled={!blockAllowed('rentability')}
          disabledHint={agencyOnlyHint}
          busy={busy}
          onDownload={() =>
            exportOne(
              'Rentabilidad',
              async (mk, _absencesPool) => {
                const monthDate = monthKeyToDate(mk);
                const { data: dlRaw } = await fetchDeadlinesForMonth(mk, currentAgency?.id);
                const { data: gRaw } = await fetchGlobalAssignmentsForMonth(mk, currentAgency?.id);
                const dl = dlRaw ?? [];
                const deadlinesForMetrics = dl.map((d) => ({
                  projectId: d.projectId,
                  month: d.month,
                  budgetOverride: d.budgetOverride,
                }));
                const params = computeBuildRentabilityDiagnosticParams({
                  currentMonth: monthDate,
                  allocations: allocations ?? [],
                  projects,
                  clients,
                  employees: employees ?? [],
                  deadlinesForMonth: deadlinesForMetrics,
                  deadlinesRows: dl.map((d) => ({ month: d.month, employeeHours: d.employeeHours })),
                  globalAssignmentsForMonth: gRaw ?? [],
                  selectedDepartmentId,
                  agency: currentAgency
                    ? { id: currentAgency.id, name: currentAgency.name, settings: currentAgency.settings }
                    : null,
                  hoursMode,
                  costMode,
                  searchQuery: '',
                });
                return buildRentabilityDiagnosticPayload(params);
              },
              (mk) => `taimbox-rentabilidad-diagnostico-${mk}.json`
            )
          }
        />

        <ExportBlock
          title={t('dataExportHub.block.absences', 'Ausencias, eventos de equipo y feedback semanal')}
          disabled={!blockAllowed('absences')}
          disabledHint={agencyOnlyHint}
          busy={busy}
          onDownload={() =>
            exportOne(
              'Absences',
              async (mk, absencesPool) => {
                const monthDate = monthKeyToDate(mk);
                return {
                  schemaVersion: 1 as const,
                  exportedAt: new Date().toISOString(),
                  monthKey: mk,
                  absences: absencesPool.filter((a) => absenceTouchesMonth(a, monthDate)),
                  teamEvents: (teamEvents ?? []).filter((e) => teamEventInMonth(e, monthDate)),
                  weeklyFeedback: (weeklyFeedback ?? []).filter((f) => weekFeedbackInMonth(f, monthDate)),
                };
              },
              (mk) => `taimbox-ausencias-eventos-feedback-${mk}.json`
            )
          }
        />

        <ExportBlock
          title={t('dataExportHub.block.burnout', 'Burnout y capacidad (por empleado)')}
          disabled={!blockAllowed('burnout')}
          disabledHint={agencyOnlyHint}
          busy={busy}
          onDownload={() =>
            exportOne(
              'Burnout',
              async (mk, absencesPool) => {
                const part = await buildMonthBundle(mk, bundleInclude, absencesPool);
                if (!part.burnoutCapacity) throw new Error('burnout');
                return part.burnoutCapacity;
              },
              (mk) => `taimbox-burnout-capacidad-${mk}.json`
            )
          }
        />
      </section>
    </div>
  );
}

function ExportBlock(props: {
  title: string;
  disabled: boolean;
  disabledHint: string;
  busy: boolean;
  onDownload: () => void;
}) {
  const { title, disabled, disabledHint, busy, onDownload } = props;
  return (
    <div
      className={cn(
        'rounded-lg border border-slate-200 bg-slate-50/50 p-3 flex flex-wrap items-center justify-between gap-2',
        disabled && 'opacity-50'
      )}
    >
      <span className="text-sm font-medium">{title}</span>
      <Button type="button" size="sm" variant="secondary" disabled={disabled || busy} onClick={onDownload} title={disabled ? disabledHint : undefined}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        JSON
      </Button>
    </div>
  );
}
