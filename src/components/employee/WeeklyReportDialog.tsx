import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { useApp } from '@/contexts/AppContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useProjectFilters } from '@/hooks/useProjectFilters';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO, startOfMonth, addDays, addMonths, isSameWeek } from 'date-fns';
import { useDateLocale } from '@/hooks/useDateLocale';
import { CheckCircle2, AlertCircle, AlertTriangle, Plus, Clock, Trash2, Search } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/lib/notify';
import { getStorageKey, getWeeksForMonth, isAllocationInEffectiveMonth, parseDateStringLocal } from '@/utils/dateUtils';
import { filterEmployeesForOperationalMonthDate } from '@/utils/employeeAssignmentVisibility';
import { useWeeklyCloseDay } from '@/hooks/useWeeklyCloseDay';
import {
  useWeeklyCloseMutations,
  parseWeeklyCloseHours,
  normalizeWeeklyHourInput,
} from '@/hooks/useWeeklyCloseMutations';
import {
  canPostponeTaskInWeekly,
  formatWeeklyTaskHoursSummary,
  getWeeklyTaskGuidance,
  validateKeepHours,
} from '@/utils/weeklyCloseShared';
import {
  getEnabledActionsForOutcome,
  getOutcomeForAction,
  getTaskPendingHours,
  isWeeklyOutcomeDisabled,
  roundTaskHours,
} from '@/utils/weeklyReportActionUtils';
import { WeeklyOptionalNote, WeeklyRequiredNote } from '@/components/employee/WeeklyReportNotes';
import { useWeeklyReportTaskPool } from '@/hooks/useWeeklyReportTaskPool';
import { cn } from '@/lib/utils';
import { useProjectAliasing } from '@/hooks/useProjectAliasing';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWeeklyReportI18n, type WeeklyActionId, type WeeklyOutcomeId } from '@/hooks/useWeeklyReportI18n';
import { sanitizeInlineHtml } from '@/lib/blog/sanitize';

interface WeeklyReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  viewDate: Date;
  /**
   * Desde el planificador: abre el mismo modal centrado en una allocation concreta
   * (se inyecta en la lista aunque la semana aún no cierre o el filtro mensual la excluya).
   */
  focusAllocationId?: string | null;
}

export function WeeklyReportDialog({ open, onOpenChange, employeeId, viewDate, focusAllocationId = null }: WeeklyReportDialogProps) {
  const { t, weeklyActionMeta, weeklyOutcomeGroups } = useWeeklyReportI18n();
  const dateLocale = useDateLocale();
  const { allocations, projects, clients, employees, absences, teamEvents, weeklyFeedback, getEmployeeLoadForWeek, loadDataForMonth, ensureMonthLoaded } = useApp();
  const weeklyCloseDay = useWeeklyCloseDay();
  const { formatName: formatProjectName } = useProjectAliasing();
  const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

  const employeesForWeeklyTransfer = useMemo(
    () =>
      filterEmployeesForOperationalMonthDate(employees ?? [], startOfMonth(viewDate), {
        allocations,
        deadlines: [],
        globalAssignments: [],
      }),
    [employees, viewDate, allocations]
  );

  const {
    preference,
    applyMoveToEmployee,
    applyJustify,
    applyCancel,
    applyKeep,
    applyRollover,
    applyDistribute,
    getSlotsForTaskWeek,
  } = useWeeklyCloseMutations(viewDate);
  const isActualHoursPreference = preference === 'actual';

  const parseHours = parseWeeklyCloseHours;

  const [taskActions, setTaskActions] = useState<Record<string, WeeklyActionId | null>>({});
  const [taskOutcomes, setTaskOutcomes] = useState<Record<string, WeeklyOutcomeId>>({});
  const [taskComments, setTaskComments] = useState<Record<string, string>>({});
  const [distributionTasks, setDistributionTasks] = useState<Record<string, Array<{ id: string; taskName: string; hours: string; weekDate: string }>>>({});
  const [moveToEmployee, setMoveToEmployee] = useState<Record<string, string>>({});
  const [moveToWeek, setMoveToWeek] = useState<Record<string, string>>({});
  const [keepTaskHours, setKeepTaskHours] = useState<Record<string, { actual: string; computed: string }>>({});
  const [rolloverHours, setRolloverHours] = useState<Record<string, { actual: string; computed: string }>>({});
  const [rolloverTargetWeek, setRolloverTargetWeek] = useState<Record<string, string>>({});
  const [modalSearch, setModalSearch] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keepConfirmOpen, setKeepConfirmOpen] = useState(false);
  const [weeklyTab, setWeeklyTab] = useState<'past' | 'current'>('past');

  const { activeFilters, filterProject } = useProjectFilters();

  const {
    allTasks,
    pastTasks,
    currentTasks,
    singleTaskFromPlanner,
    filteredTasks,
  } = useWeeklyReportTaskPool({
    open,
    allocations,
    employeeId,
    viewDate,
    weeklyFeedback,
    weeklyCloseDay,
    focusAllocationId,
    weeklyTab,
    modalSearch,
    formatProjectName,
    projects,
  });

  useEffect(() => {
    if (!open) return;
    const anchor = startOfMonth(viewDate);
    void ensureMonthLoaded(anchor);
    void loadDataForMonth(addMonths(anchor, 1));
  }, [open, viewDate, ensureMonthLoaded, loadDataForMonth]);

  const weeklyTabInitForSessionRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setModalSearch('');
      setSelectedTaskId(null);
      setWeeklyTab('past');
      setKeepConfirmOpen(false);
      weeklyTabInitForSessionRef.current = false;
    }
  }, [open]);

  /** Una sola vez al abrir: pestaña por defecto o la del foco del planificador (sin pisar si el usuario ya cambió de pestaña al refrescar datos). */
  useEffect(() => {
    if (!open || weeklyTabInitForSessionRef.current) return;
    weeklyTabInitForSessionRef.current = true;
    if (focusAllocationId) {
      const task = allocations.find(a => a.id === focusAllocationId && a.employeeId === employeeId);
      if (task) {
        try {
          const d = parseDateStringLocal(task.weekStartDate);
          setWeeklyTab(isSameWeek(d, new Date(), { weekStartsOn: 1 }) ? 'current' : 'past');
        } catch {
          setWeeklyTab('past');
        }
        return;
      }
    }
    setWeeklyTab('past');
  }, [open, focusAllocationId, allocations, employeeId]);

  /** Selección acorde a pestaña y filtro de búsqueda. */
  useEffect(() => {
    if (!open) return;
    if (filteredTasks.length === 0) {
      setSelectedTaskId(null);
      return;
    }
    setSelectedTaskId(prev => {
      if (prev && filteredTasks.some(t => t.id === prev)) return prev;
      if (focusAllocationId && filteredTasks.some(t => t.id === focusAllocationId)) return focusAllocationId;
      return filteredTasks[0].id;
    });
  }, [open, filteredTasks, focusAllocationId]);

  // ── Derived state (sidebar groups; progress counts after getTaskStatus) ──
  const sidebarGroups: Array<{ id: string; label: string; tasks: typeof allTasks }> = [];
  const assignedIds = new Set<string>();
  for (const filter of activeFilters) {
    const g = filteredTasks.filter(t => {
      if (assignedIds.has(t.id)) return false;
      const proj = projects.find(p => p.id === t.projectId);
      if (proj && filterProject(proj, filter.id)) { assignedIds.add(t.id); return true; }
      return false;
    });
    if (g.length > 0) sidebarGroups.push({ id: filter.id, label: filter.displayName, tasks: g });
  }
  const otherTasks = filteredTasks.filter(t => !assignedIds.has(t.id));
  if (otherTasks.length > 0) sidebarGroups.push({ id: 'other', label: 'General', tasks: otherTasks });

  const selectedTask = allTasks.find(t => t.id === selectedTaskId) || null;
  const selectedProject = selectedTask ? projects.find(p => p.id === selectedTask.projectId) : null;
  const selectedClient = selectedProject ? clients.find(c => c.id === selectedProject?.clientId) : null;
  const selectedMissingHours = selectedTask ? getTaskPendingHours(selectedTask) : 0;
  const selectedIsTransferred = selectedTask?.taskName?.includes('(transferida de') || false;
  const selectedTransferMatch = selectedTask?.taskName?.match(/\(transferida de (.+)\)/);
  const selectedTransferName = selectedTransferMatch ? selectedTransferMatch[1] : null;
  const selectedTransferFrom = selectedTransferName ? employees.find(e => e.name === selectedTransferName) : null;

  const getTaskStatus = useCallback((taskId: string): 'pending' | 'configured' | 'error' => {
    const action = taskActions[taskId];
    if (!action) return 'pending';
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return 'pending';
    if (action === 'keep') {
      const h = keepTaskHours[taskId];
      const actual = h ? parseHours(h.actual) : (task.hoursActual || task.hoursAssigned);
      if (validateKeepHours(actual, task.hoursAssigned)) return 'error';
    } else if (action === 'postpone') {
      if (!rolloverTargetWeek[taskId]) return 'error';
      const h = rolloverHours[taskId];
      const act = parseHours(h?.actual ?? '0');
      if (act < 0) return 'error';
      const t = allTasks.find(x => x.id === taskId);
      if (!t) return 'error';
      if (act > t.hoursAssigned) return 'error';
      const rem = round2(t.hoursAssigned - act);
      if (rem <= 0) return 'error';
    } else if (action === 'moveToEmployee') {
      if (!moveToEmployee[taskId] || !moveToWeek[taskId]) return 'error';
      if (getTaskPendingHours(task) <= 0) return 'error';
    } else if (action === 'distribute') {
      const dt = distributionTasks[taskId] || [];
      const valid = dt.filter(t => t.taskName.trim() && parseHours(t.hours) > 0);
      if (valid.length === 0) return 'error';
      const pending = getTaskPendingHours(task);
      if (Math.abs(valid.reduce((s, t) => s + parseHours(t.hours), 0) - pending) > 0.01) return 'error';
    } else if (action === 'justify' || action === 'cancel') {
      if (!taskComments[taskId]?.trim()) return 'error';
    }
    return 'configured';
  }, [
    allTasks,
    taskActions,
    keepTaskHours,
    rolloverTargetWeek,
    rolloverHours,
    moveToEmployee,
    moveToWeek,
    distributionTasks,
    taskComments,
    parseHours,
  ]);

  const configuredCount = allTasks.filter((t) => getTaskStatus(t.id) === 'configured').length;
  const progress = allTasks.length > 0 ? (configuredCount / allTasks.length) * 100 : 0;

  const otherTabUnconfiguredCount = useMemo(() => {
    if (singleTaskFromPlanner) return 0;
    const pool = weeklyTab === 'past' ? currentTasks : pastTasks;
    return pool.filter((t) => getTaskStatus(t.id) !== 'configured').length;
  }, [singleTaskFromPlanner, weeklyTab, currentTasks, pastTasks, getTaskStatus]);

  // ── Validation (extracted from footer) ──
  let canSubmit = allTasks.length > 0 && configuredCount === allTasks.length;
  const validationErrors: string[] = [];
  if (allTasks.length > 0 && configuredCount < allTasks.length) {
    const pendingSetup = allTasks.length - allTasks.filter((t) => taskActions[t.id]).length;
    const pendingValidation = allTasks.filter((t) => taskActions[t.id] && getTaskStatus(t.id) !== 'configured').length;
    if (pendingSetup > 0) {
      validationErrors.push(
        t('weeklyReport.validation.tasksPendingSetup', {
          count: pendingSetup,
          defaultValue: `Faltan ${pendingSetup} tarea(s) por configurar`,
        }),
      );
    }
    if (pendingValidation > 0) {
      validationErrors.push(
        t('weeklyReport.validation.tasksPendingValidation', {
          count: pendingValidation,
          defaultValue: `${pendingValidation} tarea(s) con datos incompletos o inválidos`,
        }),
      );
    }
  }
  const capacityWarnings: string[] = [];
  for (const task of allTasks) {
    const action = taskActions[task.id];
    if (!action) continue;
    const pendingHours = getTaskPendingHours(task);
    if (action === 'distribute') {
      const distTasks = distributionTasks[task.id] || [];
      const validTasks = distTasks.filter(t => t.taskName.trim() && parseHours(t.hours) > 0);
      if (validTasks.length === 0) { canSubmit = false; validationErrors.push(t('weeklyReport.validation.needsValidTask', { taskName: task.taskName })); continue; }
      const totalDistributed = validTasks.reduce((sum, t) => sum + parseHours(t.hours), 0);
      if (Math.abs(totalDistributed - pendingHours) > 0.01) { canSubmit = false; validationErrors.push(`"${task.taskName}": suma ${totalDistributed.toFixed(2)}h ≠ ${pendingHours.toFixed(2)}h pendientes`); }
      const projectMonthAllocations = allocations.filter(a => a.projectId === task.projectId && isAllocationInEffectiveMonth(a.weekStartDate, viewDate) && a.id !== task.id);
      const projectBudget = projects.find(p => p.id === task.projectId)?.budgetHours || 0;
      const alreadyActual = task.hoursActual || 0;
      const newTotal = projectMonthAllocations.reduce((s, a) => s + a.hoursAssigned, 0) + alreadyActual + totalDistributed;
      if (projectBudget > 0 && newTotal > projectBudget) { canSubmit = false; validationErrors.push(`"${task.taskName}": excede presupuesto (${newTotal.toFixed(1)}h/${projectBudget.toFixed(1)}h)`); }
      const valSlots = getSlotsForTaskWeek(task.weekStartDate);
      for (const dt of validTasks) {
        const dvs = valSlots.find(s => s.storageKey === dt.weekDate);
        const wl = getEmployeeLoadForWeek(employeeId, dt.weekDate, undefined, undefined, dvs?.viewMonth ?? viewDate);
        const wt = validTasks.filter(t => t.weekDate === dt.weekDate).reduce((s, t) => s + parseFloat(t.hours), 0);
        if ((wl?.hours || 0) + wt > (wl?.capacity || 0)) capacityWarnings.push(`"${task.taskName}": semana ${format(parseISO(dt.weekDate), 'd MMM')} sobre capacidad`);
      }
    } else if (action === 'keep') {
      const h = keepTaskHours[task.id]; const actual = h ? parseHours(h.actual) : (task.hoursActual || task.hoursAssigned);
      const keepErr = validateKeepHours(actual, task.hoursAssigned);
      if (keepErr) { canSubmit = false; validationErrors.push(`"${task.taskName}": ${keepErr}`); }
    } else if (action === 'postpone') {
      const rSlots = getSlotsForTaskWeek(task.weekStartDate);
      if (rSlots.length === 0) { canSubmit = false; validationErrors.push(`"${task.taskName}": sin semanas futuras`); }
      if (!rolloverTargetWeek[task.id] || !rSlots.some(s => s.storageKey === rolloverTargetWeek[task.id])) { canSubmit = false; validationErrors.push(`"${task.taskName}": elige semana destino`); }
      const h = rolloverHours[task.id];
      const actPost = h ? parseHours(h.actual) : 0;
      if (actPost < 0) { canSubmit = false; validationErrors.push(`"${task.taskName}": las horas realizadas no pueden ser negativas`); }
      if (actPost > task.hoursAssigned) { canSubmit = false; validationErrors.push(`"${task.taskName}": las horas realizadas no pueden superar el estimado`); }
      const rem = round2(task.hoursAssigned - actPost);
      if (rem <= 0) { canSubmit = false; validationErrors.push(`"${task.taskName}": debe quedar saldo para posponer (horas realizadas < estimado)`); }
      else {
        const dSlot = rSlots.find(s => s.storageKey === rolloverTargetWeek[task.id]);
        const wl = getEmployeeLoadForWeek(employeeId, rolloverTargetWeek[task.id], undefined, undefined, dSlot?.viewMonth ?? viewDate);
        if ((wl?.hours || 0) + rem > (wl?.capacity || 0)) capacityWarnings.push(`"${task.taskName}": semana destino sobre capacidad`);
      }
    } else if (action === 'moveToEmployee') {
      const teSlots = getSlotsForTaskWeek(task.weekStartDate);
      if (teSlots.length === 0) { canSubmit = false; validationErrors.push(`"${task.taskName}": sin semanas para transferir`); }
      else if (!moveToEmployee[task.id] || !moveToWeek[task.id]) { canSubmit = false; validationErrors.push(t('weeklyReport.validation.selectColleagueWeek', { taskName: task.taskName })); }
      else if (pendingHours <= 0) { canSubmit = false; validationErrors.push(`"${task.taskName}": no hay horas pendientes para transferir`); }
      else {
        const rem = pendingHours;
        if (rem > 0) { const ts = teSlots.find(s => s.storageKey === moveToWeek[task.id]); const wl = getEmployeeLoadForWeek(moveToEmployee[task.id], moveToWeek[task.id], undefined, undefined, ts?.viewMonth ?? viewDate); const te = employees.find(e => e.id === moveToEmployee[task.id]); if (te && (wl?.hours || 0) + rem > (wl?.capacity || 0)) capacityWarnings.push(`"${task.taskName}": ${te.name} sobre capacidad`); }
      }
    } else if (action === 'justify') {
      if (!taskComments[task.id]?.trim()) { canSubmit = false; validationErrors.push(t('weeklyReport.validation.writeExplanation', { taskName: task.taskName })); }
    } else if (action === 'cancel') {
      if (!taskComments[task.id]?.trim()) { canSubmit = false; validationErrors.push(t('weeklyReport.validation.cancelReason', { taskName: task.taskName })); }
    }
  }

  // ── Week slots & selectors ──
  const weekSlotsFor = getSlotsForTaskWeek;

  const weekSelectGroups = (taskWeekStartStr: string, loadForEmployeeId: string | null) => {
    const slots = weekSlotsFor(taskWeekStartStr);
    const byMonth = new Map<string, typeof slots>();
    for (const s of slots) {
      const k = format(startOfMonth(s.viewMonth), 'yyyy-MM');
      if (!byMonth.has(k)) byMonth.set(k, []);
      byMonth.get(k)!.push(s);
    }
    return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mk, monthSlots]) => (
      <SelectGroup key={mk}>
        <SelectLabel className="py-1.5 pl-8 pr-2 text-xs font-semibold capitalize text-muted-foreground">
          {format(monthSlots[0].viewMonth, 'MMMM yyyy', { locale: dateLocale })}
        </SelectLabel>
        {monthSlots.map((slot) => {
          const load = loadForEmployeeId
            ? getEmployeeLoadForWeek(loadForEmployeeId, slot.storageKey, undefined, undefined, slot.viewMonth)
            : null;
          const h = load?.hours ?? 0;
          const cap = load?.capacity ?? 0;
          const avail = round2(cap - h);
          const weeks = getWeeksForMonth(slot.viewMonth);
          const wi = weeks.findIndex(w => getStorageKey(w.weekStart, slot.viewMonth) === slot.storageKey);
          const wn = wi >= 0 ? wi + 1 : null;
          const dateRange = `${format(slot.weekStart, 'd', { locale: dateLocale })}–${format(addDays(slot.weekStart, 4), 'd MMM', { locale: dateLocale })}`;
          const label = `S${wn || '?'} · ${dateRange}`;
          const availLabel = loadForEmployeeId
            ? avail >= 0 ? `${avail.toFixed(0)}h libres` : `${Math.abs(avail).toFixed(0)}h sobre cap.`
            : t('weeklyReport.validation.chooseColleague');
          return (
            <SelectItem key={slot.storageKey} value={slot.storageKey} className="py-2">
              <span className="text-sm">{label}</span>
              <span className={cn("ml-2 text-xs", !loadForEmployeeId ? "text-muted-foreground" : avail >= 0 ? "text-muted-foreground" : "text-destructive")}>
                · {availLabel}
              </span>
            </SelectItem>
          );
        })}
      </SelectGroup>
    ));
  };

  // ── Distribution helpers ──
  const initializeDistribution = (taskId: string, totalHours: number, taskWeekStartStr: string) => {
    if (!distributionTasks[taskId] || distributionTasks[taskId].length === 0) {
      const slots = weekSlotsFor(taskWeekStartStr);
      setDistributionTasks(prev => ({
        ...prev,
        [taskId]: [{ id: crypto.randomUUID(), taskName: '', hours: totalHours.toString(), weekDate: slots[0]?.storageKey || format(new Date(), 'yyyy-MM-dd') }]
      }));
    }
  };

  const addDistributionRow = (taskId: string, taskWeekStartStr: string) => {
    const current = distributionTasks[taskId] || [];
    const lastRow = current[current.length - 1];
    const slots = weekSlotsFor(taskWeekStartStr);
    setDistributionTasks(prev => ({
      ...prev,
      [taskId]: [...current, { id: crypto.randomUUID(), taskName: '', hours: '', weekDate: lastRow?.weekDate || slots[0]?.storageKey || format(new Date(), 'yyyy-MM-dd') }]
    }));
  };

  const removeDistributionRow = (taskId: string, rowId: string) => {
    setDistributionTasks(prev => ({ ...prev, [taskId]: (prev[taskId] || []).filter(r => r.id !== rowId) }));
  };

  const updateDistributionRow = (taskId: string, rowId: string, field: 'taskName' | 'hours' | 'weekDate', value: string) => {
    setDistributionTasks(prev => ({ ...prev, [taskId]: (prev[taskId] || []).map(r => r.id === rowId ? { ...r, [field]: value } : r) }));
  };

  const updateDistributionHours = (taskId: string, rowId: string, value: string) => {
    updateDistributionRow(taskId, rowId, 'hours', value);
  };

  // ── Action change handler (extracted) ──
  const handleActionChange = (task: typeof allTasks[0], value: string) => {
    const action = value as WeeklyActionId;
    setTaskActions((prev) => ({ ...prev, [task.id]: action }));
    const outcome = getOutcomeForAction(action, weeklyOutcomeGroups);
    if (outcome) {
      setTaskOutcomes((prev) => ({ ...prev, [task.id]: outcome }));
    }
    if (action === 'distribute') {
      if (!distributionTasks[task.id]?.length) {
        initializeDistribution(task.id, Math.max(getTaskPendingHours(task), 0.01), task.weekStartDate);
      }
    }
    if (action === 'keep' && !keepTaskHours[task.id]) {
      setKeepTaskHours(prev => ({
        ...prev,
        [task.id]: {
          actual: (task.hoursActual ?? task.hoursAssigned).toFixed(2),
          computed: (task.hoursComputed ?? task.hoursActual ?? task.hoursAssigned).toFixed(2),
        },
      }));
    }
    if (action === 'postpone' && !rolloverHours[task.id]) {
      const rSlots = weekSlotsFor(task.weekStartDate);
      setRolloverHours(prev => ({
        ...prev,
        [task.id]: {
          actual: (task.hoursActual ?? 0).toFixed(2),
          computed: (task.hoursComputed ?? task.hoursActual ?? 0).toFixed(2),
        },
      }));
      if (rSlots[0]) setRolloverTargetWeek(prev => ({ ...prev, [task.id]: rSlots[0].storageKey }));
    }
    if (action === 'moveToEmployee' && !moveToWeek[task.id]) {
      const eSlots = weekSlotsFor(task.weekStartDate);
      if (eSlots[0]) setMoveToWeek(prev => ({ ...prev, [task.id]: eSlots[0].storageKey }));
    }
  };

  const handleOutcomeSelect = (task: typeof allTasks[0], outcomeId: WeeklyOutcomeId) => {
    if (isWeeklyOutcomeDisabled(outcomeId, task, weeklyOutcomeGroups, getSlotsForTaskWeek)) return;
    setTaskOutcomes((prev) => ({ ...prev, [task.id]: outcomeId }));
    const enabled = getEnabledActionsForOutcome(outcomeId, task, weeklyOutcomeGroups, getSlotsForTaskWeek);
    // «Sigo después» → preseleccionar posponer (caso más habitual; evita dejar la tarea sin acción concreta).
    if (outcomeId === 'continue' && enabled.includes('postpone')) {
      handleActionChange(task, 'postpone');
      return;
    }
    if (enabled.length === 1) {
      handleActionChange(task, enabled[0]);
      return;
    }
    const current = taskActions[task.id];
    if (!current || !enabled.includes(current)) {
      setTaskActions((prev) => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });
    }
  };

  // ── Submit handler ──
  const incompleteKeepTasks = useMemo(
    () =>
      allTasks.filter((t) => {
        if (taskActions[t.id] !== 'keep') return false;
        const h = keepTaskHours[t.id];
        const actual = h ? parseHours(h.actual) : (t.hoursActual ?? t.hoursAssigned);
        return actual < t.hoursAssigned - 0.01;
      }),
    [allTasks, taskActions, keepTaskHours, parseHours]
  );

  const getActionConsequence = useCallback(
    (task: (typeof allTasks)[0], action: WeeklyActionId): string => {
      const pending = getTaskPendingHours(task);
      const destWeekKey = rolloverTargetWeek[task.id] || moveToWeek[task.id];
      const destSlot = destWeekKey
        ? getSlotsForTaskWeek(task.weekStartDate).find((s) => s.storageKey === destWeekKey)
        : undefined;
      const destLabel = destSlot
        ? `${format(destSlot.weekStart, 'd', { locale: dateLocale })}–${format(addDays(destSlot.weekStart, 4), 'd MMM', { locale: dateLocale })}`
        : 'la semana elegida';
      const targetEmployee = moveToEmployee[task.id]
        ? employees.find((e) => e.id === moveToEmployee[task.id])
        : undefined;
      const distCount = (distributionTasks[task.id] || []).filter(
        (t) => t.taskName.trim() && parseHours(t.hours) > 0
      ).length;

      switch (action) {
        case 'keep': {
          const h = keepTaskHours[task.id];
          const actual = h ? parseHours(h.actual) : (task.hoursActual ?? task.hoursAssigned);
          const unplanned = roundTaskHours(Math.max(0, task.hoursAssigned - actual));
          if (unplanned > 0.01) {
            return t('weeklyReport.consequences.keepUnplanned', {
              actual: actual.toFixed(2),
              unplanned: unplanned.toFixed(2),
            });
          }
          return t('weeklyReport.consequences.keepComplete');
        }
        case 'postpone': {
          const h = rolloverHours[task.id];
          const act = h ? parseHours(h.actual) : (task.hoursActual ?? 0);
          const rollover = roundTaskHours(Math.max(0, task.hoursAssigned - act));
          return t('weeklyReport.consequences.postponeRollover', {
            actual: act.toFixed(2),
            rollover: rollover.toFixed(2),
            destLabel,
          });
        }
        case 'distribute':
          return distCount > 0
            ? t('weeklyReport.consequences.distributeReplace', {
                count: distCount,
                pending: pending.toFixed(2),
              })
            : t('weeklyReport.consequences.distributeSplit', { pending: pending.toFixed(2) });
        case 'moveToEmployee':
          return targetEmployee
            ? t('weeklyReport.consequences.transferNamed', {
                pending: pending.toFixed(2),
                name: targetEmployee.name,
                destLabel,
              })
            : t('weeklyReport.consequences.transferAnonymous', { pending: pending.toFixed(2) });
        case 'justify':
          return t('weeklyReport.consequences.justifyOnly');
        case 'cancel': {
          const alreadyActual = task.hoursActual || 0;
          const dropped = getTaskPendingHours(task);
          if (alreadyActual > 0 && dropped > 0) {
            return t('weeklyReport.consequences.cancelWithDropped', {
              actual: alreadyActual.toFixed(2),
              dropped: dropped.toFixed(2),
            });
          }
          if (alreadyActual > 0) {
            return t('weeklyReport.consequences.cancelWithActual', { actual: alreadyActual.toFixed(2) });
          }
          return t('weeklyReport.consequences.cancelZero');
        }
        default:
          return '';
      }
    },
    [
      t,
      distributionTasks,
      employees,
      getSlotsForTaskWeek,
      keepTaskHours,
      moveToEmployee,
      moveToWeek,
      rolloverHours,
      rolloverTargetWeek,
      dateLocale,
      parseHours,
    ]
  );

  const executeCloseWeek = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const failures: { taskId: string; taskName: string; message: string }[] = [];
      let processedCount = 0;

      for (const task of allTasks) {
        const action = taskActions[task.id];
        if (!action) continue;

        let result: { ok: true } | { ok: false; message: string };

        if (action === 'moveToEmployee') {
          result = await applyMoveToEmployee(
            task,
            employeeId,
            moveToEmployee[task.id] || '',
            moveToWeek[task.id] || '',
            taskComments[task.id]
          );
        } else if (action === 'justify') {
          result = await applyJustify(task, employeeId, taskComments[task.id]);
        } else if (action === 'cancel') {
          result = await applyCancel(task, employeeId, taskComments[task.id]);
        } else if (action === 'keep') {
          const hours = keepTaskHours[task.id];
          const actual = hours ? parseHours(hours.actual) : (task.hoursActual || task.hoursAssigned);
          const computed = isActualHoursPreference ? actual : (hours ? parseHours(hours.computed) : (task.hoursComputed || actual));
          result = await applyKeep(task, employeeId, actual, computed, taskComments[task.id]);
        } else if (action === 'postpone') {
          const hours = rolloverHours[task.id];
          const destWeekStr = rolloverTargetWeek[task.id] || '';
          const actual = hours ? parseHours(hours.actual) : 0;
          const computed =
            isActualHoursPreference ? actual : hours ? parseHours(hours.computed) || actual : actual;
          const newEstimate = round2(task.hoursAssigned - actual);
          if (newEstimate <= 0) {
            result = { ok: false, message: `"${task.taskName}": debe quedar saldo para posponer` };
          } else {
            result = await applyRollover(task, employeeId, actual, computed, newEstimate, destWeekStr, taskComments[task.id]);
          }
        } else if (action === 'distribute') {
          const distTasks = distributionTasks[task.id] || [];
          const validTasks = distTasks.filter(t => t.taskName.trim() && parseHours(t.hours) > 0);
          result = await applyDistribute(task, employeeId, validTasks, taskComments[task.id]);
        } else {
          continue;
        }

        if ('message' in result) {
          failures.push({ taskId: task.id, taskName: task.taskName || t('weeklyReport.sidebar.noName'), message: result.message });
        } else {
          processedCount += 1;
        }
      }

      if (failures.length > 0) {
        setSelectedTaskId(failures[0].taskId);
        const names = failures.slice(0, 3).map((f) => f.taskName).join(', ');
        const suffix = failures.length > 3 ? t('weeklyReport.errors.andMore', { count: failures.length - 3 }) : '';
        toast.error(
          failures.length === 1
            ? failures[0].message
            : `${failures.length} tareas fallaron (${names}${suffix}). ${failures[0].message}`
        );
        return;
      }

      if (processedCount === 0) {
        toast.error('No hay tareas configuradas para cerrar');
        return;
      }

      toast.success('Weekly actualizado correctamente');
      onOpenChange(false);
      setTaskActions({}); setTaskComments({}); setTaskOutcomes({}); setMoveToEmployee({}); setMoveToWeek({});
      setDistributionTasks({}); setKeepTaskHours({}); setRolloverHours({}); setRolloverTargetWeek({});
    } catch (error) {
      console.error('Error actualizando weekly:', error);
      toast.error(t('weeklyReport.toast.updateError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseWeek = async () => {
    if (isSubmitting || !canSubmit) return;
    if (incompleteKeepTasks.length > 0) {
      setKeepConfirmOpen(true);
      return;
    }
    await executeCloseWeek();
  };

  // ── Safety: initialize distribution for selected task if needed ──
  if (selectedTask && taskActions[selectedTask.id] === 'distribute') {
    const isDist = selectedTask.taskName?.includes('[Distribuir]');
    const isTrans = selectedTask.taskName?.includes('(transferida de');
    if ((isDist || isTrans) && (!distributionTasks[selectedTask.id] || distributionTasks[selectedTask.id].length === 0)) {
      initializeDistribution(selectedTask.id, getTaskPendingHours(selectedTask), selectedTask.weekStartDate);
    }
  }

  const selectedAction = selectedTask ? taskActions[selectedTask.id] : null;
  const selectedOutcome: WeeklyOutcomeId | null = selectedTask
    ? taskOutcomes[selectedTask.id] ?? getOutcomeForAction(selectedAction, weeklyOutcomeGroups)
    : null;
  const selectedSubActions = selectedTask && selectedOutcome
    ? getEnabledActionsForOutcome(selectedOutcome, selectedTask, weeklyOutcomeGroups, getSlotsForTaskWeek)
    : [];
  const showSubActionPicker = selectedSubActions.length > 1;
  const selectedOutcomeGroup = selectedOutcome
    ? weeklyOutcomeGroups.find((g) => g.id === selectedOutcome)
    : null;

  // ── RENDER ──
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0',
          singleTaskFromPlanner ? 'sm:max-w-2xl' : 'sm:max-w-4xl'
        )}
      >
        {/* ── HEADER ── */}
        <div className="space-y-2 border-b px-4 pb-3 pt-4 sm:px-5">
          <DialogHeader className="space-y-0.5">
            <DialogTitle className="text-base font-semibold tracking-tight sm:text-lg">
              {singleTaskFromPlanner ? t('weeklyReport.header.titlePlanner') : t('weeklyReport.header.titleWeekly')}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground sm:text-sm">
              {singleTaskFromPlanner
                ? t('weeklyReport.header.descPlanner')
                : t('weeklyReport.header.descProgress', { resolved: configuredCount, total: allTasks.length })}
            </DialogDescription>
          </DialogHeader>
          {!singleTaskFromPlanner && (
            <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500 ease-out",
                configuredCount === allTasks.length && allTasks.length > 0 ? "bg-green-500" : "bg-primary"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          )}
        </div>

        {allTasks.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
            <CheckCircle2 className="mb-4 h-10 w-10 text-muted-foreground/50" strokeWidth={1.5} />
            <h3 className="text-base font-semibold">{t('weeklyReport.empty.noPendingTitle')}</h3>
            <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
              {t('weeklyReport.empty.noPendingDesc')}
            </p>
          </div>
        ) : (
          <Tabs
            value={singleTaskFromPlanner ? 'past' : weeklyTab}
            onValueChange={(v) => setWeeklyTab(v as 'past' | 'current')}
            className="flex min-h-0 flex-1 flex-col"
          >
            {!singleTaskFromPlanner && (
              <div className="shrink-0 border-b px-6 pb-3 pt-2 space-y-2">
                <TabsList className="grid h-auto w-full max-w-lg grid-cols-2 gap-1 p-1">
                  <TabsTrigger
                    value="past"
                    className={cn(
                      'gap-1.5 px-2 py-2 text-xs sm:text-sm',
                      pastTasks.length > 0 && 'data-[state=active]:text-destructive data-[state=inactive]:text-destructive/80'
                    )}
                  >
                    {pastTasks.length > 0 ? (
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
                    ) : null}
                    <span className="truncate text-left font-semibold">{t('weeklyReport.tabs.requireClose')}</span>
                    <span className="font-mono text-[11px] opacity-80">({pastTasks.length})</span>
                  </TabsTrigger>
                  <TabsTrigger value="current" className="gap-1 px-2 py-2 text-xs sm:text-sm">
                    <span className="truncate font-medium">{t('weeklyReport.tabs.currentWeek')}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">({currentTasks.length})</span>
                  </TabsTrigger>
                </TabsList>
                {otherTabUnconfiguredCount > 0 && (
                  <p className="text-xs text-amber-800 dark:text-amber-200 rounded-md border border-amber-200/80 bg-amber-50/90 px-2.5 py-2">
                    {weeklyTab === 'past'
                      ? t('weeklyReport.ui.otherTabPendingCurrent', {
                          count: otherTabUnconfiguredCount,
                          defaultValue:
                            'Hay {{count}} tarea(s) en «Semana actual» sin configurar. Cambia de pestaña o confírmalas para cerrar.',
                        })
                      : t('weeklyReport.ui.otherTabPendingPast', {
                          count: otherTabUnconfiguredCount,
                          defaultValue:
                            'Hay {{count}} tarea(s) en «Requieren cierre» sin configurar. Cambia de pestaña o confírmalas para cerrar.',
                        })}
                  </p>
                )}
              </div>
            )}

            {/* ── BODY: vacío por pestaña o split panel ── */}
            {(() => {
              const showPastTabEmpty = !singleTaskFromPlanner && weeklyTab === 'past' && pastTasks.length === 0;
              const showCurrentTabEmpty = !singleTaskFromPlanner && weeklyTab === 'current' && currentTasks.length === 0;
              if (showPastTabEmpty) {
                return (
                  <div className="flex flex-1 flex-col items-center justify-center px-8 py-14 text-center">
                    <CheckCircle2 className="mb-3 h-10 w-10 text-emerald-500/90" strokeWidth={1.5} />
                    <h3 className="text-base font-semibold text-slate-800">{t('weeklyReport.empty.allCaughtUpTitle')}</h3>
                    <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
                      {t('weeklyReport.empty.allCaughtUpDesc')}
                    </p>
                  </div>
                );
              }
              if (showCurrentTabEmpty) {
                return (
                  <div className="flex flex-1 flex-col items-center justify-center px-8 py-14 text-center">
                    <Clock className="mb-3 h-9 w-9 text-muted-foreground/50" strokeWidth={1.5} />
                    <h3 className="text-base font-semibold">{t('weeklyReport.empty.currentWeekEmptyTitle')}</h3>
                    <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
                      {t('weeklyReport.empty.currentWeekEmptyDesc')}
                    </p>
                  </div>
                );
              }
              return (
            <div className="flex min-h-0 flex-1">
              {/* ── LEFT: SIDEBAR (desktop) ── */}
              <div className={cn('w-64 shrink-0 flex-col border-r bg-muted/30', singleTaskFromPlanner ? 'hidden' : 'hidden md:flex')}>
                <div className="border-b p-2.5">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={modalSearch}
                      onChange={(e) => setModalSearch(e.target.value)}
                      placeholder={t('weeklyReport.sidebar.filterPlaceholder')}
                      className="h-8 pl-8 text-xs"
                      aria-label={t('weeklyReport.sidebar.filterAria')}
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto py-1">
                  {sidebarGroups.length === 0 && modalSearch.trim() ? (
                    <p className="px-3 py-6 text-center text-xs text-muted-foreground">{t('weeklyReport.sidebar.noResults')}</p>
                  ) : (
                    sidebarGroups.map(group => (
                      <div key={group.id}>
                        {sidebarGroups.length > 1 && (
                          <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {group.label}
                          </div>
                        )}
                        {group.tasks.map(task => {
                          const status = getTaskStatus(task.id);
                          const isActive = task.id === selectedTaskId;
                          const project = projects.find(p => p.id === task.projectId);
                          const client = clients.find(c => c.id === project?.clientId);
                          const pending = round2(task.hoursAssigned - (task.hoursActual || 0));
                          return (
                            <button
                              key={task.id}
                              onClick={() => setSelectedTaskId(task.id)}
                              className={cn(
                                "flex w-full items-center gap-2.5 border-l-2 px-3 py-2 text-left transition-colors",
                                isActive
                                  ? "border-l-primary bg-accent"
                                  : "border-l-transparent hover:bg-muted/60"
                              )}
                            >
                              {status === 'configured' ? (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                              ) : status === 'error' ? (
                                <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                              ) : (
                                <div className="h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/25" />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: client?.color || '#94a3b8' }} />
                                  <span className="truncate text-[11px] text-muted-foreground">{project?.name || t('weeklyReport.sidebar.noProject')}</span>
                                </div>
                                <p className="mt-0.5 truncate text-sm font-medium leading-tight">
                                  {task.taskName?.replace(/\(transferida de .+\)/, '').trim() || t('weeklyReport.sidebar.noName')}
                                </p>
                              </div>
                              <span className="shrink-0 font-mono text-xs text-muted-foreground">{pending}h</span>
                            </button>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* ── RIGHT: DETAIL ── */}
              <div className="flex min-w-0 flex-1 flex-col">
                {/* Mobile: task selector */}
                <div className={cn('border-b p-3 md:hidden', singleTaskFromPlanner && 'hidden')}>
                  <Select value={selectedTaskId ?? ''} onValueChange={(val) => setSelectedTaskId(val)}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Seleccionar tarea" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredTasks.map(task => {
                        const pending = round2(task.hoursAssigned - (task.hoursActual || 0));
                        const status = getTaskStatus(task.id);
                        return (
                          <SelectItem key={task.id} value={task.id} className="py-2">
                            <div className="flex items-center gap-2">
                              {status === 'configured' ? (
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
                              ) : (
                                <div className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-muted-foreground/25" />
                              )}
                              <span className="truncate text-sm">
                                {task.taskName?.replace(/\(transferida de .+\)/, '').trim() || t('weeklyReport.sidebar.noName')}
                              </span>
                              <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">{pending}h</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* Detail content */}
                <div className="flex-1 overflow-y-auto">
                  {selectedTask ? (
                    <div className="space-y-4 p-4 sm:p-5">
                      {/* Task header — compacto */}
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: selectedClient?.color || '#94a3b8' }} />
                            {selectedProject?.name || t('weeklyReport.sidebar.noProject')}
                          </span>
                          <span aria-hidden>·</span>
                          <Badge variant="secondary" className="h-5 max-w-[min(100%,14rem)] truncate px-1.5 font-mono text-[11px]">
                            {formatWeeklyTaskHoursSummary(selectedTask)}
                          </Badge>
                          {selectedIsTransferred && selectedTransferFrom && (
                            <>
                              <span aria-hidden>·</span>
                              <span className="inline-flex items-center gap-1">
                                <Avatar className="h-4 w-4">
                                  <AvatarImage src={selectedTransferFrom.avatarUrl} />
                                  <AvatarFallback className="text-[8px]">
                                    {(selectedTransferFrom.first_name || selectedTransferFrom.name)[0]}
                                  </AvatarFallback>
                                </Avatar>
                                de {selectedTransferFrom.first_name || selectedTransferFrom.name}
                              </span>
                            </>
                          )}
                        </div>
                        <h3 className="text-base font-semibold leading-snug tracking-tight">
                          {selectedTask.taskName?.replace(/\(transferida de .+\)/, '').trim() || t('weeklyReport.sidebar.noName')}
                        </h3>
                      </div>

                      {getWeeklyTaskGuidance(selectedTask) && (
                        <p className="flex items-start gap-1.5 rounded-md border border-sky-200/80 bg-sky-50/80 px-2.5 py-2 text-[11px] leading-snug text-sky-950 dark:border-sky-900/40 dark:bg-sky-950/25 dark:text-sky-100">
                          <Clock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                          <span>{getWeeklyTaskGuidance(selectedTask)}</span>
                        </p>
                      )}

                      {/* Paso 1: resultado + paso 2: acción concreta */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground">
                          {formatWeeklyTaskHoursSummary(selectedTask)}
                        </Label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {weeklyOutcomeGroups.map(({ id, label, hint }) => {
                            const disabled = isWeeklyOutcomeDisabled(id, selectedTask, weeklyOutcomeGroups, getSlotsForTaskWeek);
                            const isSelected = selectedOutcome === id;
                            return (
                              <button
                                key={id}
                                type="button"
                                disabled={disabled}
                                onClick={() => handleOutcomeSelect(selectedTask, id)}
                                className={cn(
                                  'rounded-md border px-2.5 py-2 text-left transition-colors',
                                  disabled && 'cursor-not-allowed opacity-45',
                                  isSelected
                                    ? 'border-primary/40 bg-accent text-accent-foreground'
                                    : 'border-border/60 bg-background hover:bg-muted/50'
                                )}
                              >
                                <span className="block text-sm font-medium leading-tight">{label}</span>
                                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{hint}</span>
                              </button>
                            );
                          })}
                        </div>

                        {isWeeklyOutcomeDisabled('handoff', selectedTask, weeklyOutcomeGroups, getSlotsForTaskWeek) && canPostponeTaskInWeekly(selectedTask) && (
                          <p className="text-[11px] text-muted-foreground">
                            {t('weeklyReport.ui.handoffHint')}
                          </p>
                        )}

                        {showSubActionPicker && selectedOutcomeGroup && (
                          <div
                            className="space-y-2 rounded-md border border-dashed border-primary/30 bg-muted/40 px-3 py-2.5"
                            role="group"
                            aria-label={t('weeklyReport.ui.optionsFor', { label: selectedOutcomeGroup.label })}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                              <p className="text-xs">
                                <span className="font-medium text-foreground">{selectedOutcomeGroup.label}</span>
                                <span className="mx-1.5 text-muted-foreground" aria-hidden>→</span>
                                <span className="text-muted-foreground">{t('weeklyReport.ui.chooseOption')}</span>
                              </p>
                              {!selectedAction && (
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                                  {t('weeklyReport.ui.mandatory')}
                                </span>
                              )}
                            </div>
                            <RadioGroup
                              value={selectedAction || ''}
                              onValueChange={(v) => handleActionChange(selectedTask, v)}
                              className="space-y-1"
                            >
                              {selectedSubActions.map((actionId) => {
                                const meta = weeklyActionMeta[actionId];
                                const isActive = selectedAction === actionId;
                                return (
                                  <label
                                    key={actionId}
                                    htmlFor={`${selectedTask.id}-sub-${actionId}`}
                                    className={cn(
                                      'flex cursor-pointer items-start gap-2.5 rounded-md border px-2.5 py-2 transition-colors',
                                      isActive
                                        ? 'border-primary/45 bg-background shadow-sm ring-1 ring-primary/15'
                                        : 'border-border/50 bg-background/70 hover:border-border hover:bg-background'
                                    )}
                                  >
                                    <RadioGroupItem
                                      value={actionId}
                                      id={`${selectedTask.id}-sub-${actionId}`}
                                      className="mt-0.5 shrink-0"
                                    />
                                    <span className="min-w-0">
                                      <span className="block text-sm font-medium leading-tight">{meta.label}</span>
                                      <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                                        {meta.hint}
                                      </span>
                                    </span>
                                  </label>
                                );
                              })}
                            </RadioGroup>
                          </div>
                        )}

                        {selectedAction && (
                          <p className="rounded-md bg-muted/60 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
                            {getActionConsequence(selectedTask, selectedAction)}
                          </p>
                        )}
                      </div>

                      {/* Action detail forms */}
                      {selectedAction && (
                        <div className="rounded-lg border bg-muted/20 p-3 sm:p-3.5">
                          {/* KEEP */}
                          {selectedAction === 'keep' && (() => {
                            const hours = keepTaskHours[selectedTask.id] || {
                              actual: (selectedTask.hoursActual ?? selectedTask.hoursAssigned).toFixed(2),
                              computed: (selectedTask.hoursComputed ?? selectedTask.hoursActual ?? selectedTask.hoursAssigned).toFixed(2)
                            };
                            const actualNum = parseHours(hours.actual);
                            const unplannedKeep = roundTaskHours(Math.max(0, selectedTask.hoursAssigned - actualNum));
                            return (
                              <div className="space-y-3">
                                {unplannedKeep > 0.01 && (
                                  <p className="flex items-start gap-1.5 rounded-md border border-amber-200/80 bg-amber-50/80 px-2 py-1.5 text-[11px] leading-snug text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-100">
                                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                                    <span>
                                      <span dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(t('weeklyReport.ui.unplannedKeepWarning', { hours: unplannedKeep.toFixed(2) })) }} />
                                    </span>
                                  </p>
                                )}
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs font-medium">{t('weeklyReport.ui.actualHours')}</Label>
                                    <Input type="text" inputMode="decimal" className="h-8 font-mono text-sm" value={hours.actual}
                                      onChange={(e) => { 
                                        const v = normalizeWeeklyHourInput(e.target.value); 
                                        setKeepTaskHours(prev => ({ 
                                          ...prev, 
                                          [selectedTask.id]: { 
                                            ...prev[selectedTask.id], 
                                            actual: v,
                                            ...(isActualHoursPreference ? { computed: v } : {}) 
                                          } 
                                        })); 
                                      }}
                                      placeholder="0.00" />
                                  </div>
                                  {!isActualHoursPreference && (
                                  <div className="space-y-1">
                                    <Label className="text-xs font-medium">{t('weeklyReport.ui.billing')}</Label>
                                    <Input type="text" inputMode="decimal" className="h-8 font-mono text-sm" value={hours.computed}
                                      disabled={isActualHoursPreference}
                                      onChange={(e) => { const v = normalizeWeeklyHourInput(e.target.value); setKeepTaskHours(prev => ({ ...prev, [selectedTask.id]: { ...prev[selectedTask.id], computed: v } })); }}
                                      placeholder="0.00" />
                                  </div>
                                  )}
                                </div>
                                <WeeklyOptionalNote value={taskComments[selectedTask.id] || ''} onChange={(v) => setTaskComments(prev => ({ ...prev, [selectedTask.id]: v }))} />
                              </div>
                            );
                          })()}

                          {/* POSTPONE */}
                          {selectedAction === 'postpone' && (() => {
                            const hours = rolloverHours[selectedTask.id] || {
                              actual: (selectedTask.hoursActual ?? 0).toFixed(2),
                              computed: (selectedTask.hoursComputed ?? selectedTask.hoursActual ?? 0).toFixed(2)
                            };
                            const rSlots = weekSlotsFor(selectedTask.weekStartDate);
                            const pendNext = Math.max(0, round2(selectedTask.hoursAssigned - parseHours(hours.actual)));
                            const postponeBlocked = pendNext <= 0;
                            return (
                              <div className="space-y-3">
                                {postponeBlocked && (
                                  <p className="flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-[11px] leading-snug text-destructive">
                                    <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                                    <span>
                                      {t('weeklyReport.ui.postponeNeedsRemainder', {
                                        assigned: selectedTask.hoursAssigned.toFixed(2),
                                        defaultValue:
                                          'Las horas de esta semana deben ser menores que el estimado ({{assigned}}h) para pasar el resto a otra semana. Pon 0 si no avanzaste.',
                                      })}
                                    </span>
                                  </p>
                                )}
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs font-medium">{t('weeklyReport.ui.thisWeekHours')}</Label>
                                    <Input type="text" inputMode="decimal" className="h-8 font-mono text-sm" value={hours.actual}
                                      onChange={(e) => { 
                                        const v = normalizeWeeklyHourInput(e.target.value); 
                                        setRolloverHours(prev => ({ 
                                          ...prev, 
                                          [selectedTask.id]: { 
                                            ...prev[selectedTask.id], 
                                            actual: v,
                                            ...(isActualHoursPreference ? { computed: v } : {}) 
                                          } 
                                        })); 
                                      }}
                                      placeholder="0" />
                                    <p
                                      className="text-[11px] text-muted-foreground"
                                      dangerouslySetInnerHTML={{
                                        __html: sanitizeInlineHtml(t('weeklyReport.ui.zeroAdvanceHint', { hours: pendNext.toFixed(2) })),
                                      }}
                                    />
                                  </div>
                                  {!isActualHoursPreference && (
                                  <div className="space-y-1">
                                    <Label className="text-xs font-medium">{t('weeklyReport.ui.billing')}</Label>
                                    <Input type="text" inputMode="decimal" className="h-8 font-mono text-sm" value={hours.computed}
                                      disabled={isActualHoursPreference}
                                      onChange={(e) => { const v = normalizeWeeklyHourInput(e.target.value); setRolloverHours(prev => ({ ...prev, [selectedTask.id]: { ...prev[selectedTask.id], computed: v } })); }}
                                      placeholder="0.00" />
                                  </div>
                                  )}
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs font-medium">{t('weeklyReport.ui.targetWeek')}</Label>
                                  {rSlots.length === 0 ? (
                                    <p className="text-xs text-destructive">{t('weeklyReport.ui.noWeeksAvailable')}</p>
                                  ) : (
                                    <Select value={rolloverTargetWeek[selectedTask.id] ?? rSlots[0]?.storageKey ?? ''} onValueChange={(val) => setRolloverTargetWeek(prev => ({ ...prev, [selectedTask.id]: val }))}>
                                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t('weeklyReport.ui.chooseWeek')} /></SelectTrigger>
                                      <SelectContent className="max-h-[min(280px,60vh)]">{weekSelectGroups(selectedTask.weekStartDate, employeeId)}</SelectContent>
                                    </Select>
                                  )}
                                </div>
                                <WeeklyOptionalNote value={taskComments[selectedTask.id] || ''} onChange={(v) => setTaskComments(prev => ({ ...prev, [selectedTask.id]: v }))} />
                              </div>
                            );
                          })()}

                          {/* DISTRIBUTE */}
                          {selectedAction === 'distribute' && (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between text-xs">
                                <span>{t('weeklyReport.ui.toDistribute')} <span className="font-mono font-medium">{round2(selectedMissingHours).toFixed(2)}h</span></span>
                                <span className={cn("font-mono", round2(selectedMissingHours - (distributionTasks[selectedTask.id]?.reduce((a, d) => a + parseHours(d.hours), 0) || 0)) === 0 ? "font-medium" : "text-muted-foreground")}>
                                  {t('weeklyReport.ui.balance')} {round2(selectedMissingHours - (distributionTasks[selectedTask.id]?.reduce((a, d) => a + parseHours(d.hours), 0) || 0)).toFixed(2)}h
                                </span>
                              </div>
                              <div className="space-y-1.5">
                                {(distributionTasks[selectedTask.id] || []).map((dist) => {
                                  const distSlot = weekSlotsFor(selectedTask.weekStartDate).find(s => s.storageKey === dist.weekDate);
                                  const weekLoad = dist.weekDate ? getEmployeeLoadForWeek(employeeId, dist.weekDate, undefined, undefined, distSlot?.viewMonth ?? viewDate) : null;
                                  const isOverCap = weekLoad && (weekLoad.hours || 0) + parseHours(dist.hours) > (weekLoad.capacity || 0);
                                  return (
                                    <div key={dist.id} className="space-y-1.5 rounded-md border bg-background p-2">
                                      <div className="flex items-center gap-1.5">
                                        <Input type="text" className="h-8 min-w-0 flex-1 text-sm" value={dist.taskName}
                                          onChange={(e) => updateDistributionRow(selectedTask.id, dist.id, 'taskName', e.target.value)} placeholder={t('weeklyReport.ui.taskNamePlaceholder')} />
                                        <Input type="text" inputMode="decimal" className={cn("h-8 w-14 shrink-0 font-mono text-sm", isOverCap && "border-destructive/60")} value={dist.hours}
                                          onChange={(e) => updateDistributionHours(selectedTask.id, dist.id, normalizeWeeklyHourInput(e.target.value))} placeholder="h" />
                                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeDistributionRow(selectedTask.id, dist.id)}>
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                      <Select value={dist.weekDate ?? ''} onValueChange={(val) => updateDistributionRow(selectedTask.id, dist.id, 'weekDate', val)}>
                                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t('weeklyReport.ui.week')} /></SelectTrigger>
                                        <SelectContent className="max-h-[min(280px,60vh)]">{weekSelectGroups(selectedTask.weekStartDate, employeeId)}</SelectContent>
                                      </Select>
                                      {isOverCap && <p className="text-[11px] text-destructive">{t('weeklyReport.ui.overCapacity')}</p>}
                                    </div>
                                  );
                                })}
                              </div>
                              <Button variant="outline" size="sm" className="h-8 w-full border-dashed text-xs" onClick={() => addDistributionRow(selectedTask.id, selectedTask.weekStartDate)}>
                                <Plus className="mr-1 h-3.5 w-3.5" /> {t('weeklyReport.ui.addTask')}
                              </Button>
                              <WeeklyOptionalNote value={taskComments[selectedTask.id] || ''} onChange={(v) => setTaskComments(prev => ({ ...prev, [selectedTask.id]: v }))} />
                            </div>
                          )}

                          {/* TRANSFER TO EMPLOYEE */}
                          {selectedAction === 'moveToEmployee' && (() => {
                            const selEmpId = moveToEmployee[selectedTask.id];
                            const tSlots = weekSlotsFor(selectedTask.weekStartDate);
                            const transferPending = getTaskPendingHours(selectedTask);
                            return (
                              <div className="space-y-3">
                                <p className="text-[11px] text-muted-foreground">
                                  <span dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(t('weeklyReport.ui.transferSummary', { hours: transferPending.toFixed(2) })) }} />
                                </p>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  <div className="space-y-1">
                                    <Label className="text-xs font-medium">{t('weeklyReport.ui.colleague')}</Label>
                                    <Select value={moveToEmployee[selectedTask.id] ?? ''} onValueChange={(val) => setMoveToEmployee(prev => ({ ...prev, [selectedTask.id]: val }))}>
                                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t('weeklyReport.ui.person')} /></SelectTrigger>
                                      <SelectContent className="max-h-[min(240px,50vh)]">
                                        {employeesForWeeklyTransfer.filter(e => e.id !== employeeId).map(e => {
                                          const loads = tSlots.map(slot => getEmployeeLoadForWeek(e.id, slot.storageKey, undefined, undefined, slot.viewMonth));
                                          const avail = round2(loads.reduce((s, l) => s + (l?.capacity || 0), 0) - loads.reduce((s, l) => s + (l?.hours || 0), 0));
                                          return (
                                            <SelectItem key={e.id} value={e.id} className="py-1.5 text-sm">
                                              {e.name}
                                              <span className={cn("ml-1.5 text-xs", avail >= 0 ? "text-muted-foreground" : "text-destructive")}>
                                                · {avail >= 0 ? `${avail.toFixed(0)}h` : t('weeklyReport.ui.overCapShort')}
                                              </span>
                                            </SelectItem>
                                          );
                                        })}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs font-medium">{t('weeklyReport.ui.weekLabel')}</Label>
                                    <Select value={moveToWeek[selectedTask.id] ?? ''} onValueChange={(val) => setMoveToWeek(prev => ({ ...prev, [selectedTask.id]: val }))}>
                                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t('weeklyReport.ui.week')} /></SelectTrigger>
                                      <SelectContent className="max-h-[min(280px,60vh)]">{weekSelectGroups(selectedTask.weekStartDate, selEmpId || null)}</SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <WeeklyOptionalNote value={taskComments[selectedTask.id] || ''} onChange={(v) => setTaskComments(prev => ({ ...prev, [selectedTask.id]: v }))} />
                              </div>
                            );
                          })()}

                          {/* CANCEL */}
                          {selectedAction === 'cancel' && (
                            <WeeklyRequiredNote
                              value={taskComments[selectedTask.id] || ''}
                              onChange={(v) => setTaskComments(prev => ({ ...prev, [selectedTask.id]: v }))}
                              placeholder={t('weeklyReport.notes.cancelPlaceholder')}
                              helperText={t('weeklyReport.notes.cancelHelper')}
                            />
                          )}

                          {/* JUSTIFY */}
                          {selectedAction === 'justify' && (
                            <WeeklyRequiredNote
                              value={taskComments[selectedTask.id] || ''}
                              onChange={(v) => setTaskComments(prev => ({ ...prev, [selectedTask.id]: v }))}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
                      {t('weeklyReport.ui.selectFromList')}
                    </div>
                  )}
                </div>
              </div>
            </div>
              );
            })()}

            {/* ── FOOTER ── */}
            <DialogFooter className="shrink-0 flex-col items-stretch gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="hidden min-w-0 flex-1 sm:block">
                <p className="text-xs text-muted-foreground">
                  {t('weeklyReport.footer.configured', { resolved: configuredCount, total: allTasks.length })}
                </p>
                {!canSubmit && validationErrors.length > 0 && (
                  <p className="mt-1 text-xs text-amber-800 dark:text-amber-200" role="status">
                    {validationErrors[0]}
                  </p>
                )}
              </div>
              <div className="flex w-full gap-2 sm:w-auto">
                <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => onOpenChange(false)}>
                  {t('weeklyReport.footer.cancel')}
                </Button>
                <Button
                  size="sm"
                  className="flex-1 sm:flex-none"
                  onClick={handleCloseWeek}
                  disabled={!canSubmit || isSubmitting}
                  title={!canSubmit ? validationErrors.join(' · ') : capacityWarnings.length > 0 ? t('weeklyReport.capacityWarning', { warnings: capacityWarnings.join(' · ') }) : undefined}
                >
                  {isSubmitting ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
                      {t('weeklyReport.footer.processing')}
                    </>
                  ) : (
                    t('weeklyReport.footer.confirmClose')
                  )}
                </Button>
              </div>
            </DialogFooter>
          </Tabs>
        )}
      </DialogContent>

      <AlertDialog open={keepConfirmOpen} onOpenChange={setKeepConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('weeklyReport.keepConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  {incompleteKeepTasks.length === 1
                    ? t('weeklyReport.keepConfirm.singleDesc')
                    : t('weeklyReport.keepConfirm.multiDesc', { count: incompleteKeepTasks.length })}
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  {incompleteKeepTasks.map((task) => {
                    const h = keepTaskHours[task.id];
                    const actual = h ? parseHours(h.actual) : (task.hoursActual ?? task.hoursAssigned);
                    const gap = roundTaskHours(Math.max(0, task.hoursAssigned - actual));
                    return (
                      <li key={task.id}>
                        <span className="font-medium text-foreground">{task.taskName?.replace(/\(transferida de .+\)/, '').trim() || t('weeklyReport.sidebar.noName')}</span>
                        {t('weeklyReport.keepConfirm.gapUnplanned', { hours: gap.toFixed(2) })}
                      </li>
                    );
                  })}
                </ul>
                <p dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(t('weeklyReport.keepConfirm.continueLaterHint')) }} />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('weeklyReport.keepConfirm.reviewTasks')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setKeepConfirmOpen(false);
                void executeCloseWeek();
              }}
            >
              {t('weeklyReport.keepConfirm.confirmAnyway')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
