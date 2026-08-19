import { useCallback, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import type { Allocation, Employee, Project } from '@/types';
import type { WeeklyActionId } from '@/hooks/useWeeklyReportI18n';
import { isAllocationInEffectiveMonth } from '@/utils/dateUtils';
import { getTaskPendingHours } from '@/utils/weeklyReportActionUtils';
import { validateKeepHours } from '@/utils/weeklyCloseShared';

type WeekSlot = {
  storageKey: string;
  viewMonth: Date;
  weekStart: Date;
};

type EmployeeWeekLoad = {
  hours: number;
  capacity: number;
} | null | undefined;

interface UseWeeklyReportValidationParams {
  allTasks: Allocation[];
  pastTasks: Allocation[];
  currentTasks: Allocation[];
  taskActions: Record<string, WeeklyActionId | null>;
  keepTaskHours: Record<string, { actual: string; computed: string }>;
  rolloverTargetWeek: Record<string, string>;
  rolloverHours: Record<string, { actual: string; computed: string }>;
  moveToEmployee: Record<string, string>;
  moveToWeek: Record<string, string>;
  distributionTasks: Record<
    string,
    Array<{ id: string; taskName: string; hours: string; weekDate: string }>
  >;
  taskComments: Record<string, string>;
  parseHours: (value: string) => number;
  allocations: Allocation[];
  projects: Project[];
  employees: Employee[];
  viewDate: Date;
  employeeId: string;
  weeklyTab: 'past' | 'current';
  singleTaskFromPlanner: boolean;
  getSlotsForTaskWeek: (taskWeekStartStr: string) => readonly WeekSlot[];
  getEmployeeLoadForWeek: (
    employeeId: string,
    weekKey: string,
    absences?: unknown,
    teamEvents?: unknown,
    viewMonth?: Date
  ) => EmployeeWeekLoad;
  t: (key: string, options?: Record<string, unknown>) => string;
}

const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

export function useWeeklyReportValidation({
  allTasks,
  pastTasks,
  currentTasks,
  taskActions,
  keepTaskHours,
  rolloverTargetWeek,
  rolloverHours,
  moveToEmployee,
  moveToWeek,
  distributionTasks,
  taskComments,
  parseHours,
  allocations,
  projects,
  employees,
  viewDate,
  employeeId,
  weeklyTab,
  singleTaskFromPlanner,
  getSlotsForTaskWeek,
  getEmployeeLoadForWeek,
  t,
}: UseWeeklyReportValidationParams) {
  const getTaskStatus = useCallback(
    (taskId: string): 'pending' | 'configured' | 'error' => {
      const action = taskActions[taskId];
      if (!action) return 'pending';
      const task = allTasks.find(x => x.id === taskId);
      if (!task) return 'pending';
      if (action === 'keep') {
        const h = keepTaskHours[taskId];
        const actual = h ? parseHours(h.actual) : task.hoursActual || task.hoursAssigned;
        if (validateKeepHours(actual, task.hoursAssigned)) return 'error';
      } else if (action === 'postpone') {
        if (!rolloverTargetWeek[taskId]) return 'error';
        const h = rolloverHours[taskId];
        const act = parseHours(h?.actual ?? '0');
        if (act < 0) return 'error';
        if (act > task.hoursAssigned) return 'error';
        const rem = round2(task.hoursAssigned - act);
        if (rem <= 0) return 'error';
      } else if (action === 'moveToEmployee') {
        if (!moveToEmployee[taskId] || !moveToWeek[taskId]) return 'error';
        if (getTaskPendingHours(task) <= 0) return 'error';
      } else if (action === 'distribute') {
        const dt = distributionTasks[taskId] || [];
        const valid = dt.filter(row => row.taskName.trim() && parseHours(row.hours) > 0);
        if (valid.length === 0) return 'error';
        const pending = getTaskPendingHours(task);
        if (Math.abs(valid.reduce((s, row) => s + parseHours(row.hours), 0) - pending) > 0.01)
          return 'error';
      } else if (action === 'justify' || action === 'cancel') {
        if (!taskComments[taskId]?.trim()) return 'error';
      }
      return 'configured';
    },
    [
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
    ]
  );

  const configuredCount = allTasks.filter(task => getTaskStatus(task.id) === 'configured').length;
  const progress = allTasks.length > 0 ? (configuredCount / allTasks.length) * 100 : 0;

  const otherTabUnconfiguredCount = useMemo(() => {
    if (singleTaskFromPlanner) return 0;
    const pool = weeklyTab === 'past' ? currentTasks : pastTasks;
    return pool.filter(task => getTaskStatus(task.id) !== 'configured').length;
  }, [singleTaskFromPlanner, weeklyTab, currentTasks, pastTasks, getTaskStatus]);

  return useMemo(() => {
    let canSubmit = allTasks.length > 0 && configuredCount === allTasks.length;
    const validationErrors: string[] = [];
    if (allTasks.length > 0 && configuredCount < allTasks.length) {
      const pendingSetup = allTasks.length - allTasks.filter(task => taskActions[task.id]).length;
      const pendingValidation = allTasks.filter(
        task => taskActions[task.id] && getTaskStatus(task.id) !== 'configured'
      ).length;
      if (pendingSetup > 0) {
        validationErrors.push(
          t('weeklyReport.validation.tasksPendingSetup', {
            count: pendingSetup,
            defaultValue: `Faltan ${pendingSetup} tarea(s) por configurar`,
          })
        );
      }
      if (pendingValidation > 0) {
        validationErrors.push(
          t('weeklyReport.validation.tasksPendingValidation', {
            count: pendingValidation,
            defaultValue: `${pendingValidation} tarea(s) con datos incompletos o inválidos`,
          })
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
        const validTasks = distTasks.filter(row => row.taskName.trim() && parseHours(row.hours) > 0);
        if (validTasks.length === 0) {
          canSubmit = false;
          validationErrors.push(
            t('weeklyReport.validation.needsValidTask', { taskName: task.taskName })
          );
          continue;
        }
        const totalDistributed = validTasks.reduce((sum, row) => sum + parseHours(row.hours), 0);
        if (Math.abs(totalDistributed - pendingHours) > 0.01) {
          canSubmit = false;
          validationErrors.push(
            `"${task.taskName}": suma ${totalDistributed.toFixed(2)}h ≠ ${pendingHours.toFixed(2)}h pendientes`
          );
        }
        const projectMonthAllocations = allocations.filter(
          a =>
            a.projectId === task.projectId &&
            isAllocationInEffectiveMonth(a.weekStartDate, viewDate) &&
            a.id !== task.id
        );
        const projectBudget = projects.find(p => p.id === task.projectId)?.budgetHours || 0;
        const alreadyActual = task.hoursActual || 0;
        const newTotal =
          projectMonthAllocations.reduce((s, a) => s + a.hoursAssigned, 0) +
          alreadyActual +
          totalDistributed;
        if (projectBudget > 0 && newTotal > projectBudget) {
          canSubmit = false;
          validationErrors.push(
            `"${task.taskName}": excede presupuesto (${newTotal.toFixed(1)}h/${projectBudget.toFixed(1)}h)`
          );
        }
        const valSlots = getSlotsForTaskWeek(task.weekStartDate);
        for (const dt of validTasks) {
          const dvs = valSlots.find(s => s.storageKey === dt.weekDate);
          const wl = getEmployeeLoadForWeek(
            employeeId,
            dt.weekDate,
            undefined,
            undefined,
            dvs?.viewMonth ?? viewDate
          );
          const wt = validTasks
            .filter(row => row.weekDate === dt.weekDate)
            .reduce((s, row) => s + parseFloat(row.hours), 0);
          if ((wl?.hours || 0) + wt > (wl?.capacity || 0)) {
            capacityWarnings.push(
              `"${task.taskName}": semana ${format(parseISO(dt.weekDate), 'd MMM')} sobre capacidad`
            );
          }
        }
      } else if (action === 'keep') {
        const h = keepTaskHours[task.id];
        const actual = h ? parseHours(h.actual) : task.hoursActual || task.hoursAssigned;
        const keepErr = validateKeepHours(actual, task.hoursAssigned);
        if (keepErr) {
          canSubmit = false;
          validationErrors.push(`"${task.taskName}": ${keepErr}`);
        }
      } else if (action === 'postpone') {
        const rSlots = getSlotsForTaskWeek(task.weekStartDate);
        if (rSlots.length === 0) {
          canSubmit = false;
          validationErrors.push(`"${task.taskName}": sin semanas futuras`);
        }
        if (
          !rolloverTargetWeek[task.id] ||
          !rSlots.some(s => s.storageKey === rolloverTargetWeek[task.id])
        ) {
          canSubmit = false;
          validationErrors.push(`"${task.taskName}": elige semana destino`);
        }
        const h = rolloverHours[task.id];
        const actPost = h ? parseHours(h.actual) : 0;
        if (actPost < 0) {
          canSubmit = false;
          validationErrors.push(`"${task.taskName}": las horas realizadas no pueden ser negativas`);
        }
        if (actPost > task.hoursAssigned) {
          canSubmit = false;
          validationErrors.push(
            `"${task.taskName}": las horas realizadas no pueden superar el estimado`
          );
        }
        const rem = round2(task.hoursAssigned - actPost);
        if (rem <= 0) {
          canSubmit = false;
          validationErrors.push(
            `"${task.taskName}": debe quedar saldo para posponer (horas realizadas < estimado)`
          );
        } else {
          const dSlot = rSlots.find(s => s.storageKey === rolloverTargetWeek[task.id]);
          const wl = getEmployeeLoadForWeek(
            employeeId,
            rolloverTargetWeek[task.id],
            undefined,
            undefined,
            dSlot?.viewMonth ?? viewDate
          );
          if ((wl?.hours || 0) + rem > (wl?.capacity || 0)) {
            capacityWarnings.push(`"${task.taskName}": semana destino sobre capacidad`);
          }
        }
      } else if (action === 'moveToEmployee') {
        const teSlots = getSlotsForTaskWeek(task.weekStartDate);
        if (teSlots.length === 0) {
          canSubmit = false;
          validationErrors.push(`"${task.taskName}": sin semanas para transferir`);
        } else if (!moveToEmployee[task.id] || !moveToWeek[task.id]) {
          canSubmit = false;
          validationErrors.push(
            t('weeklyReport.validation.selectColleagueWeek', { taskName: task.taskName })
          );
        } else if (pendingHours <= 0) {
          canSubmit = false;
          validationErrors.push(`"${task.taskName}": no hay horas pendientes para transferir`);
        } else {
          const rem = pendingHours;
          if (rem > 0) {
            const ts = teSlots.find(s => s.storageKey === moveToWeek[task.id]);
            const wl = getEmployeeLoadForWeek(
              moveToEmployee[task.id],
              moveToWeek[task.id],
              undefined,
              undefined,
              ts?.viewMonth ?? viewDate
            );
            const te = employees.find(e => e.id === moveToEmployee[task.id]);
            if (te && (wl?.hours || 0) + rem > (wl?.capacity || 0)) {
              capacityWarnings.push(`"${task.taskName}": ${te.name} sobre capacidad`);
            }
          }
        }
      } else if (action === 'justify') {
        if (!taskComments[task.id]?.trim()) {
          canSubmit = false;
          validationErrors.push(
            t('weeklyReport.validation.writeExplanation', { taskName: task.taskName })
          );
        }
      } else if (action === 'cancel') {
        if (!taskComments[task.id]?.trim()) {
          canSubmit = false;
          validationErrors.push(
            t('weeklyReport.validation.cancelReason', { taskName: task.taskName })
          );
        }
      }
    }

    return {
      getTaskStatus,
      configuredCount,
      progress,
      otherTabUnconfiguredCount,
      canSubmit,
      validationErrors,
      capacityWarnings,
    };
  }, [
    allTasks,
    configuredCount,
    progress,
    otherTabUnconfiguredCount,
    getTaskStatus,
    taskActions,
    distributionTasks,
    parseHours,
    allocations,
    projects,
    viewDate,
    getSlotsForTaskWeek,
    getEmployeeLoadForWeek,
    employeeId,
    keepTaskHours,
    rolloverTargetWeek,
    rolloverHours,
    moveToEmployee,
    moveToWeek,
    taskComments,
    employees,
    t,
  ]);
}
