import type { Allocation } from '@/types';
import type { WeeklyActionId, WeeklyOutcomeId } from '@/hooks/useWeeklyReportI18n';
import { canPostponeTaskInWeekly, getWeeklyTaskPendingHours } from '@/utils/weeklyCloseShared';

type WeeklyOutcomeGroup = {
  id: WeeklyOutcomeId;
  actions: readonly WeeklyActionId[];
};

export function getOutcomeForAction(
  action: WeeklyActionId | null | undefined,
  weeklyOutcomeGroups: readonly WeeklyOutcomeGroup[]
): WeeklyOutcomeId | null {
  if (!action) return null;
  for (const group of weeklyOutcomeGroups) {
    if (group.actions.includes(action)) return group.id;
  }
  return null;
}

export function roundTaskHours(num: number) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function getTaskPendingHours(task: Pick<Allocation, 'hoursAssigned' | 'hoursActual'>) {
  return roundTaskHours(getWeeklyTaskPendingHours(task));
}

export function isWeeklyActionDisabledForTask(
  action: WeeklyActionId,
  task: Pick<Allocation, 'hoursAssigned' | 'hoursActual' | 'weekStartDate'>,
  getSlots?: (taskWeekStart: string) => readonly unknown[]
): boolean {
  const pending = getTaskPendingHours(task);
  if (action === 'postpone') {
    if (!canPostponeTaskInWeekly(task)) return true;
    if (getSlots && getSlots(task.weekStartDate).length === 0) return true;
    return false;
  }
  if (action === 'distribute' || action === 'moveToEmployee') return pending <= 0;
  return false;
}

export function isWeeklyOutcomeDisabled(
  outcomeId: WeeklyOutcomeId,
  task: Pick<Allocation, 'hoursAssigned' | 'hoursActual' | 'weekStartDate'>,
  weeklyOutcomeGroups: readonly WeeklyOutcomeGroup[],
  getSlots?: (taskWeekStart: string) => readonly unknown[]
): boolean {
  const group = weeklyOutcomeGroups.find(g => g.id === outcomeId);
  if (!group) return true;
  return group.actions.every(action => isWeeklyActionDisabledForTask(action, task, getSlots));
}

export function getEnabledActionsForOutcome(
  outcomeId: WeeklyOutcomeId,
  task: Pick<Allocation, 'hoursAssigned' | 'hoursActual' | 'weekStartDate'>,
  weeklyOutcomeGroups: readonly WeeklyOutcomeGroup[],
  getSlots?: (taskWeekStart: string) => readonly unknown[]
): WeeklyActionId[] {
  const group = weeklyOutcomeGroups.find(g => g.id === outcomeId);
  if (!group) return [];
  return group.actions.filter(action => !isWeeklyActionDisabledForTask(action, task, getSlots));
}
