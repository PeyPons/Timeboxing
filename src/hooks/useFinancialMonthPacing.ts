import { useMemo } from 'react';
import { isSameMonth } from 'date-fns';
import type { ProjectMetrics } from '@/hooks/useProjectMetrics';
import { getWorkingDaysElapsedInMonth, getWorkingDaysInMonth } from '@/utils/dateUtils';

type HoursMode = 'actual' | 'computed';
type CostMode = 'standard' | 'dynamic';

interface UseFinancialMonthPacingParams {
  currentMonth: Date;
  hoursMode: HoursMode;
  costMode: CostMode;
  projectMetricsForView: ProjectMetrics[];
  projectMetricsBillableWithActivity: ProjectMetrics[];
}

export function useFinancialMonthPacing({
  currentMonth,
  hoursMode,
  costMode,
  projectMetricsForView,
  projectMetricsBillableWithActivity,
}: UseFinancialMonthPacingParams) {
  const isViewingCurrentMonth = useMemo(
    () => isSameMonth(currentMonth, new Date()),
    [currentMonth]
  );

  const workingDaysInMonth = useMemo(
    () => getWorkingDaysInMonth(currentMonth),
    [currentMonth]
  );
  const workingDaysElapsed = useMemo(
    () => getWorkingDaysElapsedInMonth(currentMonth),
    [currentMonth]
  );

  const pctMonthElapsed = useMemo(() => {
    if (!isViewingCurrentMonth) return 100;
    return workingDaysInMonth > 0
      ? (workingDaysElapsed / workingDaysInMonth) * 100
      : 0;
  }, [isViewingCurrentMonth, workingDaysInMonth, workingDaysElapsed]);

  const dynamicCostFallbackActive = useMemo(
    () => costMode === 'dynamic' && isViewingCurrentMonth && pctMonthElapsed < 25,
    [costMode, isViewingCurrentMonth, pctMonthElapsed]
  );
  const effectiveCostMode: CostMode = dynamicCostFallbackActive ? 'standard' : costMode;

  const accruedRatio = useMemo(() => {
    if (!isViewingCurrentMonth) return 1;
    return workingDaysInMonth > 0 ? workingDaysElapsed / workingDaysInMonth : 0;
  }, [isViewingCurrentMonth, workingDaysInMonth, workingDaysElapsed]);

  const projectDisplayFeeMap = useMemo(() => {
    const map = new Map<string, number>();
    projectMetricsForView.forEach(projectMetric => {
      const fee = projectMetric.monthlyFee ?? 0;
      if (!isViewingCurrentMonth) {
        map.set(projectMetric.projectId, fee);
        return;
      }
      const hoursDisplay =
        hoursMode === 'computed' ? projectMetric.computed : projectMetric.actual;
      const budget = projectMetric.budget > 0 ? projectMetric.budget : 0;
      const hasReachedOrExceededBudget = budget > 0 && hoursDisplay >= budget;
      map.set(
        projectMetric.projectId,
        hasReachedOrExceededBudget ? fee : fee * accruedRatio
      );
    });
    return map;
  }, [projectMetricsForView, isViewingCurrentMonth, accruedRatio, hoursMode]);

  const totalDisplayRevenue = useMemo(
    () =>
      projectMetricsBillableWithActivity.reduce(
        (sum, projectMetric) =>
          sum +
          (projectDisplayFeeMap.get(projectMetric.projectId) ??
            projectMetric.monthlyFee ??
            0),
        0
      ),
    [projectMetricsBillableWithActivity, projectDisplayFeeMap]
  );

  const projectPacingMap = useMemo(() => {
    const map = new Map<
      string,
      { pctConsumed: number; pctElapsed: number; isOverPacing: boolean }
    >();
    projectMetricsForView.forEach(projectMetric => {
      const budget = projectMetric.budget > 0 ? projectMetric.budget : 0;
      const hoursDisplay =
        hoursMode === 'computed' ? projectMetric.computed : projectMetric.actual;
      const pctConsumed = budget > 0 ? (hoursDisplay / budget) * 100 : 0;
      const pctElapsed = isViewingCurrentMonth ? pctMonthElapsed : 100;
      const isOverPacing = pctConsumed > pctElapsed;
      map.set(projectMetric.projectId, { pctConsumed, pctElapsed, isOverPacing });
    });
    return map;
  }, [projectMetricsForView, hoursMode, isViewingCurrentMonth, pctMonthElapsed]);

  return {
    isViewingCurrentMonth,
    dynamicCostFallbackActive,
    effectiveCostMode,
    projectDisplayFeeMap,
    totalDisplayRevenue,
    projectPacingMap,
  };
}
