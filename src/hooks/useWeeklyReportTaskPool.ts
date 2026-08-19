import { useCallback, useMemo } from 'react';
import { format, startOfWeek, isBefore, isSameWeek } from 'date-fns';
import type { Allocation, Project } from '@/types';
import {
  getStorageKey,
  getWeekEndDate,
  isAllocationInEffectiveMonth,
  parseDateStringLocal,
} from '@/utils/dateUtils';
import { getWeeklyProcessedAllocationIds } from '@/utils/weeklyCloseShared';

type WeeklyTab = 'past' | 'current';

interface UseWeeklyReportTaskPoolParams {
  open: boolean;
  allocations: Allocation[];
  employeeId: string;
  viewDate: Date;
  weeklyFeedback: Parameters<typeof getWeeklyProcessedAllocationIds>[0];
  weeklyCloseDay: number;
  focusAllocationId?: string | null;
  weeklyTab: WeeklyTab;
  modalSearch: string;
  formatProjectName: (name: string) => string;
  projects: Project[];
}

export function useWeeklyReportTaskPool({
  open,
  allocations,
  employeeId,
  viewDate,
  weeklyFeedback,
  weeklyCloseDay,
  focusAllocationId = null,
  weeklyTab,
  modalSearch,
  formatProjectName,
  projects,
}: UseWeeklyReportTaskPoolParams) {
  const getTargetWeek = (): string | null => {
    const monthEnd = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
    if (isBefore(monthEnd, new Date())) {
      return format(startOfWeek(monthEnd, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    }
    return null;
  };
  const targetWeek = getTargetWeek();

  const taskMatchesSearch = useCallback(
    (task: Allocation) => {
      const q = modalSearch.trim().toLowerCase();
      if (!q) return true;
      const proj = projects.find(p => p.id === task.projectId) as
        | (Project & { project_name?: string; title?: string })
        | undefined;
      const rawProjectName = proj
        ? typeof proj.name === 'string'
          ? proj.name
          : typeof proj.project_name === 'string'
            ? proj.project_name
            : typeof proj.title === 'string'
              ? proj.title
              : ''
        : '';
      const projectLabel = formatProjectName(rawProjectName).toLowerCase();
      const rawTaskName = typeof task.taskName === 'string' ? task.taskName : '';
      const taskLabel = rawTaskName.toLowerCase().replace(/\(transferida de[^)]*\)/gi, '').trim();
      return projectLabel.includes(q) || taskLabel.includes(q);
    },
    [modalSearch, projects, formatProjectName]
  );

  const { openTasks, transferredTasks } = useMemo(() => {
    const today = new Date();
    const processedByWeeklyIds = getWeeklyProcessedAllocationIds(weeklyFeedback);

    const openList: Allocation[] = [];
    const transferred: Allocation[] = [];

    const pushFocusedIfMissing = () => {
      if (!open || !focusAllocationId) return;
      const focused = allocations.find(a => a.id === focusAllocationId && a.employeeId === employeeId);
      if (!focused || processedByWeeklyIds.has(focused.id) || focused.status === 'completed') return;
      const seen = new Set([...openList.map(t => t.id), ...transferred.map(t => t.id)]);
      if (seen.has(focused.id)) return;
      try {
        const isTransferredTask =
          (focused.transferredFromAllocationId !== undefined &&
            focused.transferredFromAllocationId !== null) ||
          focused.taskName?.includes('(transferida de');
        if (isTransferredTask) transferred.push(focused);
        else openList.push(focused);
      } catch {
        /* ignore */
      }
    };

    allocations.forEach(a => {
      if (a.employeeId !== employeeId) return;
      if (processedByWeeklyIds.has(a.id)) return;
      try {
        const taskWeekDate = parseDateStringLocal(a.weekStartDate);
        if (!isAllocationInEffectiveMonth(a.weekStartDate, viewDate)) return;
        const taskWeekEnd = getWeekEndDate(taskWeekDate, weeklyCloseDay);
        if (targetWeek !== null) {
          if (getStorageKey(taskWeekDate, viewDate) !== targetWeek) return;
        } else {
          // Permitir ajustes proactivos de la semana actual aunque aún no haya llegado el día de cierre.
          const isCurrentCalendarWeek = isSameWeek(taskWeekDate, today, { weekStartsOn: 1 });
          if (taskWeekEnd > today && !isCurrentCalendarWeek) return;
        }
        const isTransferredTask =
          (a.transferredFromAllocationId !== undefined && a.transferredFromAllocationId !== null) ||
          a.taskName?.includes('(transferida de');
        if (isTransferredTask && a.status !== 'completed') {
          transferred.push(a);
          return;
        }
        if (a.status !== 'completed') {
          openList.push(a);
        }
      } catch {
        /* ignore parse errors */
      }
    });

    pushFocusedIfMissing();

    return {
      openTasks: Array.from(new Map(openList.map(t => [t.id, t])).values()),
      transferredTasks: Array.from(new Map(transferred.map(t => [t.id, t])).values()),
    };
  }, [
    allocations,
    employeeId,
    viewDate,
    weeklyFeedback,
    weeklyCloseDay,
    focusAllocationId,
    targetWeek,
    open,
  ]);

  const allTasks = useMemo(
    () => [...openTasks, ...transferredTasks],
    [openTasks, transferredTasks]
  );

  /**
   * Semana actual vs atrasadas: misma semana ISO (lunes inicio) que hoy, usando fecha local de `week_start_date`.
   * `parseISO` solo con YYYY-MM-DD puede correr un día en UTC− y mandar todo a «Requieren cierre» por error.
   */
  const { pastTasks, currentTasks } = useMemo(() => {
    const today = new Date();
    const past: Allocation[] = [];
    const current: Allocation[] = [];
    for (const t of allTasks) {
      try {
        const d = parseDateStringLocal(t.weekStartDate);
        if (isSameWeek(d, today, { weekStartsOn: 1 })) current.push(t);
        else past.push(t);
      } catch {
        past.push(t);
      }
    }
    return { pastTasks: past, currentTasks: current };
  }, [allTasks]);

  const singleTaskFromPlanner = Boolean(
    open && focusAllocationId && allTasks.length === 1 && allTasks[0]?.id === focusAllocationId
  );

  const tabTaskPool = singleTaskFromPlanner
    ? allTasks
    : weeklyTab === 'past'
      ? pastTasks
      : currentTasks;

  const filteredTasks = useMemo(
    () => tabTaskPool.filter(taskMatchesSearch),
    [tabTaskPool, taskMatchesSearch]
  );

  return {
    targetWeek,
    openTasks,
    transferredTasks,
    allTasks,
    pastTasks,
    currentTasks,
    singleTaskFromPlanner,
    taskMatchesSearch,
    tabTaskPool,
    filteredTasks,
  };
}
