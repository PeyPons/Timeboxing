import { useCallback, useMemo } from 'react';
import { format, parseISO, startOfMonth } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '@/i18n/dateLocale';
import { toast } from '@/lib/notify';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { useAgency } from '@/contexts/AgencyContext';
import { logCreate, logUpdate } from '@/services/auditService';
import { round2 } from '@/utils/numbers';
import { useWeeklyCloseDay } from '@/hooks/useWeeklyCloseDay';
import { collectSelectableFutureWeekSlots, isAllocationInEffectiveMonth } from '@/utils/dateUtils';
import { normalizeWeeklyHourInput, parseWeeklyCloseHours, weeklyCloseOk, weeklyCloseFail, validateKeepHours, type WeeklyCloseApplyResult } from '@/utils/weeklyCloseShared';
import { copyAllocationNotes } from '@/services/allocationNotesService';
import type { Allocation } from '@/types';

export const WEEKLY_SLOT_EXTRA_MONTHS = 1;

export { normalizeWeeklyHourInput, parseWeeklyCloseHours } from '@/utils/weeklyCloseShared';

/** Fila `allocations` desde Supabase → forma camelCase coherente con `logCreate` en AppContext (historial / ActivityLog). */
function mapAllocationRowForAudit(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    employeeId: row.employee_id,
    projectId: row.project_id,
    weekStartDate: row.week_start_date,
    hoursAssigned: round2(Number(row.hours_assigned)),
    hoursActual: row.hours_actual != null ? round2(Number(row.hours_actual)) : undefined,
    hoursComputed: row.hours_computed != null ? round2(Number(row.hours_computed)) : undefined,
    status: row.status || 'planned',
    description: row.description ?? undefined,
    taskName: row.task_name ?? undefined,
    dependencyId: row.dependency_id ?? undefined,
    transferredFromAllocationId: row.transferred_from_allocation_id ?? undefined,
    distributionSourceAllocationId: row.distribution_source_allocation_id ?? undefined,
    parentAllocationId: row.parent_allocation_id ?? undefined,
    originalTransferredTaskName: row.original_transferred_task_name ?? undefined,
    transferSourceEmployeeId: row.transfer_source_employee_id ?? undefined,
    userPriority: row.user_priority ?? null,
    focusDate: row.focus_date ?? null,
    isLocked: row.is_locked ?? false,
  };
}

function parseRolloverNewAllocationId(data: unknown): string | null {
  if (typeof data === 'string' && /^[0-9a-f-]{36}$/i.test(data)) return data;
  return null;
}

export interface DistributionRowInput {
  taskName: string;
  hours: string;
  weekDate: string;
}

export interface UseWeeklyCloseMutationsResult {
  preference: 'actual' | 'computed' | undefined;
  applyMove: (
    task: Allocation,
    employeeId: string,
    targetWeekVal: string,
    comment?: string,
    /** Si se indica, sustituye `task.hoursActual` al calcular el remanente y al cerrar la tarea. */
    hoursActualOverride?: number
  ) => Promise<WeeklyCloseApplyResult>;
  applyMoveToEmployee: (
    task: Allocation,
    employeeId: string,
    targetEmployeeId: string,
    targetWeekVal: string,
    transferComment?: string
  ) => Promise<WeeklyCloseApplyResult>;
  applyJustify: (task: Allocation, employeeId: string, comment?: string) => Promise<WeeklyCloseApplyResult>;
  applyCancel: (task: Allocation, employeeId: string, comment?: string) => Promise<WeeklyCloseApplyResult>;
  applyKeep: (
    task: Allocation,
    employeeId: string,
    actual: number,
    computed: number,
    comment?: string
  ) => Promise<WeeklyCloseApplyResult>;
  applyRollover: (
    task: Allocation,
    employeeId: string,
    actual: number,
    computed: number,
    newEstimate: number,
    destWeekStr: string,
    comment?: string
  ) => Promise<WeeklyCloseApplyResult>;
  applyDistribute: (
    task: Allocation,
    employeeId: string,
    validTasks: DistributionRowInput[],
    userComment?: string
  ) => Promise<WeeklyCloseApplyResult>;
  getSlotsForTaskWeek: (taskWeekStartStr: string) => ReturnType<typeof collectSelectableFutureWeekSlots>;
}

export function useWeeklyCloseMutations(viewDate: Date): UseWeeklyCloseMutationsResult {
  const { t, i18n } = useTranslation('app');
  const dateLocale = getDateFnsLocale(i18n.language);
  const {
    allocations,
    employees,
    projects,
    updateAllocation,
    addAllocation,
    deleteAllocation,
    addWeeklyFeedback,
    getEmployeeLoadForWeek,
    loadDataForMonth,
  } = useApp();
  const { currentAgency } = useAgency();
  const weeklyCloseDay = useWeeklyCloseDay();
  const preference = currentAgency?.settings?.hoursTrackingPreference;

  const anchorMonth = useMemo(() => startOfMonth(viewDate), [viewDate]);

  const getSlotsForTaskWeek = useCallback(
    (taskWeekStartStr: string) =>
      collectSelectableFutureWeekSlots(taskWeekStartStr, anchorMonth, weeklyCloseDay, WEEKLY_SLOT_EXTRA_MONTHS),
    [anchorMonth, weeklyCloseDay]
  );

  const applyMove = useCallback(
    async (
      task: Allocation,
      employeeId: string,
      targetWeekVal: string,
      comment?: string,
      hoursActualOverride?: number
    ) => {
      const taskWeekDate = parseISO(task.weekStartDate);
      const taskWeekStr = format(taskWeekDate, 'yyyy-MM-dd');
      if (!targetWeekVal) {
        return weeklyCloseFail(t('weeklyReport.mutations.selectTargetWeek'));
      }
      const effectiveActual =
        hoursActualOverride !== undefined ? hoursActualOverride : (task.hoursActual || 0);
      const remainingHours = task.hoursAssigned - effectiveActual;
      if (remainingHours <= 0) {
        return weeklyCloseFail(t('weeklyReport.mutations.noBalanceToMove'));
      }

      const snapshotTask: Allocation = { ...task };
      const existing = allocations.find(
        a =>
          a.employeeId === employeeId &&
          a.projectId === task.projectId &&
          a.weekStartDate === targetWeekVal &&
          a.taskName === task.taskName
      );
      const snapshotExisting: Allocation | null = existing ? { ...existing } : null;

      try {
        await updateAllocation({ ...task, hoursAssigned: effectiveActual, status: 'completed' });
        if (existing) {
          await updateAllocation({ ...existing, hoursAssigned: existing.hoursAssigned + remainingHours });
          await copyAllocationNotes(task.id, existing.id);
        } else {
          const created = await addAllocation({
            employeeId,
            projectId: task.projectId,
            weekStartDate: targetWeekVal,
            hoursAssigned: remainingHours,
            taskName: task.taskName || 'Tarea movida',
            status: 'planned',
          });
          if (created) await copyAllocationNotes(task.id, created.id);
        }
        const fbOk = await addWeeklyFeedback({
          employeeId,
          weekStartDate: taskWeekStr,
          projectId: task.projectId,
          allocationId: task.id,
          reason: 'other',
          weeklyAction: 'move',
          comments: comment?.trim()
            ? `Tarea movida a semana futura. Nota: ${comment.trim()}`
            : 'Tarea movida a semana futura',
        });
        if (!fbOk) {
          await updateAllocation(snapshotTask);
          if (snapshotExisting) await updateAllocation(snapshotExisting);
          return weeklyCloseFail(t('weeklyReport.mutations.taskCloseFailed'));
        }
      } catch (err) {
        await updateAllocation(snapshotTask);
        if (snapshotExisting) await updateAllocation(snapshotExisting);
        return weeklyCloseFail(
          err instanceof Error ? err.message : t('weeklyReport.mutations.moveErrorRevert')
        );
      }

      const mvSlot = getSlotsForTaskWeek(task.weekStartDate).find(s => s.storageKey === targetWeekVal);
      if (mvSlot) await loadDataForMonth(mvSlot.viewMonth);
      return weeklyCloseOk();
    },
    [addAllocation, addWeeklyFeedback, allocations, getSlotsForTaskWeek, loadDataForMonth, updateAllocation, t]
  );

  const applyMoveToEmployee = useCallback(
    async (
      task: Allocation,
      employeeId: string,
      targetEmployeeId: string,
      targetWeekVal: string,
      transferComment?: string
    ) => {
      const taskWeekDate = parseISO(task.weekStartDate);
      const taskWeekStr = format(taskWeekDate, 'yyyy-MM-dd');
      if (!targetEmployeeId || !targetWeekVal) {
        return weeklyCloseFail(t('weeklyReport.mutations.selectColleagueWeek'));
      }
      const remainingHours = task.hoursAssigned - (task.hoursActual || 0);
      if (remainingHours <= 0) {
        return weeklyCloseFail(t('weeklyReport.mutations.noHoursToTransfer'));
      }
      const targetEmployee = employees.find(e => e.id === targetEmployeeId);
      if (targetEmployee) {
        const twSlot = getSlotsForTaskWeek(task.weekStartDate).find(s => s.storageKey === targetWeekVal);
        const targetWeekLoad = getEmployeeLoadForWeek(
          targetEmployeeId,
          targetWeekVal,
          undefined,
          undefined,
          twSlot?.viewMonth ?? viewDate
        );
        if ((targetWeekLoad?.hours || 0) + remainingHours > (targetWeekLoad?.capacity || 0)) {
          toast.warning(t('weeklyReport.mutations.capacityExceededWarning', { name: targetEmployee.name }));
        }
      }

      const snapshotTask: Allocation = { ...task };
      const taskNameTransferred = task.taskName || t('transfers.unnamedTask');
      try {
        await updateAllocation({ ...task, hoursAssigned: task.hoursActual || 0, status: 'completed' });
        const created = await addAllocation({
          employeeId: targetEmployeeId,
          projectId: task.projectId,
          weekStartDate: targetWeekVal,
          hoursAssigned: remainingHours,
          taskName: taskNameTransferred,
          status: 'planned',
          transferredFromAllocationId: task.id,
          originalTransferredTaskName:
            task.originalTransferredTaskName || taskNameTransferred.replace(/\(transferida de .+\)/, '').trim(),
          transferSourceEmployeeId: employeeId,
        });
        if (created) await copyAllocationNotes(task.id, created.id);
        const transferBase = `Tarea transferida a ${employees.find(e => e.id === targetEmployeeId)?.name || 'otro empleado'} (${remainingHours}h restantes) | Nombre: ${task.taskName || 'Sin nombre'}`;
        const fbOk = await addWeeklyFeedback({
          employeeId,
          weekStartDate: taskWeekStr,
          projectId: task.projectId,
          allocationId: task.id,
          reason: 'other',
          weeklyAction: 'transfer',
          comments: transferComment?.trim() ? `${transferBase} | Nota: ${transferComment.trim()}` : transferBase,
        });
        if (!fbOk) {
          await updateAllocation(snapshotTask);
          return weeklyCloseFail(t('weeklyReport.mutations.transferRegisterFailed'));
        }
      } catch (err) {
        await updateAllocation(snapshotTask);
        return weeklyCloseFail(
          err instanceof Error ? err.message : t('weeklyReport.mutations.transferErrorRevert')
        );
      }

      const transferSlot = getSlotsForTaskWeek(task.weekStartDate).find(s => s.storageKey === targetWeekVal);
      if (transferSlot) await loadDataForMonth(transferSlot.viewMonth);
      return weeklyCloseOk();
    },
    [
      addAllocation,
      addWeeklyFeedback,
      employees,
      getEmployeeLoadForWeek,
      getSlotsForTaskWeek,
      loadDataForMonth,
      updateAllocation,
      viewDate,
      t,
    ]
  );

  const applyJustify = useCallback(
    async (task: Allocation, employeeId: string, comment?: string) => {
      const taskWeekDate = parseISO(task.weekStartDate);
      const taskWeekStr = format(taskWeekDate, 'yyyy-MM-dd');
      const trimmed = comment?.trim();
      if (!trimmed) {
        return weeklyCloseFail(t('weeklyReport.mutations.justifyExplanationRequired'));
      }
      const fbOk = await addWeeklyFeedback({
        employeeId,
        weekStartDate: taskWeekStr,
        projectId: task.projectId,
        allocationId: task.id,
        reason: 'other',
        weeklyAction: 'justify',
        comments: `Tarea justificada: ${trimmed}`,
      });
      return fbOk ? weeklyCloseOk() : weeklyCloseFail(t('weeklyReport.mutations.justifyRegisterFailed'));
    },
    [addWeeklyFeedback, t]
  );

  const applyCancel = useCallback(
    async (task: Allocation, employeeId: string, comment?: string) => {
      const trimmed = comment?.trim();
      if (!trimmed) {
        return weeklyCloseFail(t('weeklyReport.mutations.cancelReasonRequired'));
      }
      const taskWeekDate = parseISO(task.weekStartDate);
      const taskWeekStr = format(taskWeekDate, 'yyyy-MM-dd');
      const alreadyActual = round2(task.hoursActual || 0);
      const computed = round2(task.hoursComputed ?? alreadyActual);
      const pendingDropped = round2(Math.max(0, task.hoursAssigned - alreadyActual));

      await updateAllocation({
        ...task,
        hoursAssigned: alreadyActual,
        hoursActual: alreadyActual,
        hoursComputed: computed,
        status: 'completed',
      });

      const fb =
        pendingDropped > 0
          ? `Tarea anulada: ${trimmed} (${pendingDropped.toFixed(2)}h eliminadas del plan)`
          : `Tarea anulada: ${trimmed}`;

      const fbOk = await addWeeklyFeedback({
        employeeId,
        weekStartDate: taskWeekStr,
        projectId: task.projectId,
        allocationId: task.id,
        reason: 'other',
        weeklyAction: 'cancel',
        comments: fb,
      });
      return fbOk ? weeklyCloseOk() : weeklyCloseFail(t('weeklyReport.mutations.cancelRegisterFailed'));
    },
    [addWeeklyFeedback, updateAllocation, t]
  );

  const applyKeep = useCallback(
    async (task: Allocation, employeeId: string, actual: number, computed: number, comment?: string) => {
      const taskWeekDate = parseISO(task.weekStartDate);
      const taskWeekStr = format(taskWeekDate, 'yyyy-MM-dd');
      const keepErr = validateKeepHours(actual, task.hoursAssigned);
      if (keepErr) {
        return weeklyCloseFail(`"${task.taskName}": ${keepErr}`);
      }
      await updateAllocation({ ...task, hoursActual: actual, hoursComputed: computed, status: 'completed' });
      const fb =
        comment ||
        `Tarea completada: ${actual.toFixed(2)}h reales, ${computed.toFixed(2)}h computadas`;
      const fbOk = await addWeeklyFeedback({
        employeeId,
        weekStartDate: taskWeekStr,
        projectId: task.projectId,
        allocationId: task.id,
        reason: 'other',
        weeklyAction: 'keep',
        comments: fb,
      });
      return fbOk ? weeklyCloseOk() : weeklyCloseFail(t('weeklyReport.mutations.taskCloseFailed'));
    },
    [addWeeklyFeedback, updateAllocation, t]
  );

  const applyRollover = useCallback(
    async (
      task: Allocation,
      employeeId: string,
      actual: number,
      computed: number,
      newEstimate: number,
      destWeekStr: string,
      comment?: string
    ) => {
      const slots = getSlotsForTaskWeek(task.weekStartDate);
      const destSlot = slots.find(s => s.storageKey === destWeekStr);
      if (!destWeekStr || !destSlot) {
        return weeklyCloseFail(t('weeklyReport.mutations.selectDestWeekForTask', { taskName: task.taskName }));
      }
      if (actual < 0) {
        return weeklyCloseFail(t('weeklyReport.mutations.negativeActualHours', { taskName: task.taskName }));
      }
      if (newEstimate <= 0) {
        return weeklyCloseFail(t('weeklyReport.mutations.needsPlannedHours', { taskName: task.taskName }));
      }
      const destLabel = format(destSlot.weekStart, 'd MMM yyyy', { locale: dateLocale });
      const fb =
        comment ||
        `Tarea con rollover: ${actual.toFixed(2)}h registradas, ${newEstimate.toFixed(2)}h planificadas desde ${destLabel}`;

      const { data: rpcData, error: rpcError } = await supabase.rpc('partial_close_rollover', {
        p_original_id: task.id,
        p_hours_actual: actual,
        p_hours_computed: computed,
        p_dest_week_start: destWeekStr,
        p_new_hours_assigned: newEstimate,
        p_feedback_employee_id: employeeId,
        p_feedback_comments: fb,
        p_feedback_weekly_action: 'postpone',
      });

      if (rpcError) {
        return weeklyCloseFail(
          rpcError.message || t('weeklyReport.mutations.partialCloseFailed')
        );
      }

      // La RPC no pasa por addAllocation/updateAllocation: sin esto el historial (audit_logs) pierde la continuación semanal.
      const agencyId = currentAgency?.id;
      if (agencyId) {
        const mergedParent: Allocation = {
          ...task,
          hoursActual: round2(actual),
          hoursComputed: round2(computed),
          status: 'completed',
        };
        void logUpdate(
          agencyId,
          'ALLOCATION',
          task.id,
          task as unknown as Record<string, unknown>,
          mergedParent as unknown as Record<string, unknown>,
        );

        const newId = parseRolloverNewAllocationId(rpcData);
        if (newId) {
          const { data: newRow } = await supabase.from('allocations').select('*').eq('id', newId).maybeSingle();
          if (newRow && typeof newRow === 'object') {
            void logCreate(agencyId, 'ALLOCATION', newId, mapAllocationRowForAudit(newRow as Record<string, unknown>));
          }
        }
      }

      await loadDataForMonth(startOfMonth(parseISO(task.weekStartDate)));
      await loadDataForMonth(destSlot.viewMonth);
      return weeklyCloseOk();
    },
    [currentAgency?.id, getSlotsForTaskWeek, loadDataForMonth, t, dateLocale]
  );

  const applyDistribute = useCallback(
    async (task: Allocation, employeeId: string, validTasks: DistributionRowInput[], userComment?: string) => {
      const parseHours = parseWeeklyCloseHours;
      const taskWeekDate = parseISO(task.weekStartDate);
      const taskWeekStr = format(taskWeekDate, 'yyyy-MM-dd');
      if (validTasks.length === 0) {
        return weeklyCloseFail(t('weeklyReport.mutations.addValidTask'));
      }
      const alreadyActual = round2(task.hoursActual || 0);
      const pendingHours = round2(task.hoursAssigned - alreadyActual);
      const totalDistributed = validTasks.reduce((sum, t) => sum + parseHours(t.hours), 0);
      if (Math.abs(totalDistributed - pendingHours) > 0.01) {
        return weeklyCloseFail(t('weeklyReport.mutations.hoursSumMismatch', {
          distributed: totalDistributed.toFixed(2),
          pending: pendingHours.toFixed(2),
        }));
      }
      const projectMonthAllocations = allocations.filter(
        a => a.projectId === task.projectId && isAllocationInEffectiveMonth(a.weekStartDate, viewDate) && a.id !== task.id
      );
      const projectBudget = projects.find(p => p.id === task.projectId)?.budgetHours || 0;
      const newProjectMonthTotal =
        projectMonthAllocations.reduce((s, a) => s + a.hoursAssigned, 0) + alreadyActual + totalDistributed;
      if (projectBudget > 0 && newProjectMonthTotal > projectBudget) {
        toast.warning(t('weeklyReport.mutations.projectBudgetExceeded', {
          total: newProjectMonthTotal.toFixed(1),
          budget: projectBudget.toFixed(1),
        }));
      }

      const checkedWeeks = new Set<string>();
      const distSlots = getSlotsForTaskWeek(task.weekStartDate);
      for (const dt of validTasks) {
        if (checkedWeeks.has(dt.weekDate)) continue;
        checkedWeeks.add(dt.weekDate);
        const dSlot = distSlots.find(s => s.storageKey === dt.weekDate);
        const wl = getEmployeeLoadForWeek(employeeId, dt.weekDate, undefined, undefined, dSlot?.viewMonth ?? viewDate);
        const wt = validTasks.filter(t => t.weekDate === dt.weekDate).reduce((s, t) => s + parseHours(t.hours), 0);
        if ((wl?.hours || 0) + wt > (wl?.capacity || 0)) {
          toast.warning(t('weeklyReport.mutations.weekOverCapacity', {
            date: format(parseISO(dt.weekDate), 'd MMM', { locale: dateLocale }),
          }));
        }
      }

      const isTransferredTask =
        !!task.transferredFromAllocationId || task.taskName?.includes('(transferida de');
      const transferMatch = task.taskName?.match(/\(transferida de (.+)\)/);
      const fromEmployeeName = transferMatch
        ? transferMatch[1]
        : task.transferSourceEmployeeId
          ? employees.find(e => e.id === task.transferSourceEmployeeId)?.name
          : null;
      const originalTransferredTaskName =
        task.originalTransferredTaskName ||
        (isTransferredTask ? task.taskName?.replace(/\(transferida de .+\)/, '').trim() || task.taskName : null);
      const originalTaskId = task.id;
      const originalTaskName =
        task.taskName?.replace(/\(transferida de .+\)/, '').trim() || task.taskName || t('transfers.unnamedTask');
      const baseComment = `Distribuidas en ${validTasks.length} tarea(s): ${validTasks.map(t => `${t.taskName} (${t.hours}h)`).join(', ')} | Nombre original: ${originalTaskName}`;
      const fbOk = await addWeeklyFeedback({
        employeeId,
        weekStartDate: taskWeekStr,
        projectId: task.projectId,
        allocationId: originalTaskId,
        reason: 'other',
        weeklyAction: 'distribute',
        comments: userComment?.trim() ? `${baseComment} | Nota: ${userComment.trim()}` : baseComment,
      });
      if (!fbOk) {
        return weeklyCloseFail(t('weeklyReport.mutations.distributionRegisterFailed'));
      }

      if (alreadyActual > 0) {
        await updateAllocation({
          ...task,
          hoursAssigned: alreadyActual,
          hoursActual: alreadyActual,
          hoursComputed: task.hoursComputed ?? alreadyActual,
          status: 'completed',
        });
      }

      for (const distTask of validTasks) {
        const newAllocation = await addAllocation({
          employeeId,
          projectId: task.projectId,
          weekStartDate: distTask.weekDate,
          hoursAssigned: parseHours(distTask.hours),
          taskName: distTask.taskName,
          status: 'planned',
          transferredFromAllocationId:
            isTransferredTask && task.transferredFromAllocationId ? task.transferredFromAllocationId : undefined,
          distributionSourceAllocationId: originalTaskId,
          originalTransferredTaskName: originalTransferredTaskName || distTask.taskName,
          transferSourceEmployeeId: task.transferSourceEmployeeId || (isTransferredTask ? undefined : employeeId),
        });
        if (newAllocation) {
          await copyAllocationNotes(originalTaskId, newAllocation.id);
          if (isTransferredTask && fromEmployeeName) {
            const fbComment =
              originalTransferredTaskName && originalTransferredTaskName !== distTask.taskName
                ? `Tarea distribuida desde transferencia de ${fromEmployeeName} (tarea original: ${originalTransferredTaskName})`
                : `Tarea distribuida desde transferencia de ${fromEmployeeName}`;
            await addWeeklyFeedback({
              employeeId,
              weekStartDate: distTask.weekDate,
              projectId: task.projectId,
              allocationId: newAllocation.id,
              reason: 'other',
              comments: fbComment,
            });
          }
        }
      }

      if (alreadyActual <= 0) {
        await deleteAllocation(originalTaskId);
      }
      return weeklyCloseOk();
    },
    [
      addAllocation,
      addWeeklyFeedback,
      allocations,
      deleteAllocation,
      employees,
      getEmployeeLoadForWeek,
      getSlotsForTaskWeek,
      projects,
      updateAllocation,
      viewDate,
      t,
      dateLocale,
    ]
  );

  return useMemo(
    () => ({
      preference,
      applyMove,
      applyMoveToEmployee,
      applyJustify,
      applyCancel,
      applyKeep,
      applyRollover,
      applyDistribute,
      getSlotsForTaskWeek,
    }),
    [
      preference,
      applyMove,
      applyMoveToEmployee,
      applyJustify,
      applyCancel,
      applyKeep,
      applyRollover,
      applyDistribute,
      getSlotsForTaskWeek,
    ]
  );
}
