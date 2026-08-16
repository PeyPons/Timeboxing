import { useMemo } from 'react';
import type { Employee } from '@/types';
import type { EmployeeMetrics, ProjectMetrics } from '@/hooks/useProjectMetrics';

type HoursMode = 'actual' | 'computed';

export type FinancialEnrichedProject = {
  metric: ProjectMetrics;
  clientName: string;
  ehr: number;
  ehrLabel: string;
};

interface UseFinancialGlobalKpisParams {
  projectMetricsBillableWithActivity: ProjectMetrics[];
  employeeMetricsForView: EmployeeMetrics[];
  employees: Employee[];
  hoursMode: HoursMode;
  isViewingCurrentMonth: boolean;
  totalDisplayRevenue: number;
  totalOverheadInView: number;
  commonExpensesTotalConfigured: number;
  projectCostAndMarginMap: Map<
    string,
    { cost: number; payrollCost: number; overheadCost: number; margin: number }
  >;
  clientById: Map<string, string>;
  ehrTargetSetting: number | null | undefined;
  formatPerHour: (value: number, decimals?: number) => string;
  unknownClientLabel: string;
  ehrNotStartedLabel: string;
}

export function useFinancialGlobalKpis({
  projectMetricsBillableWithActivity,
  employeeMetricsForView,
  employees,
  hoursMode,
  isViewingCurrentMonth,
  totalDisplayRevenue,
  totalOverheadInView,
  commonExpensesTotalConfigured,
  projectCostAndMarginMap,
  clientById,
  ehrTargetSetting,
  formatPerHour,
  unknownClientLabel,
  ehrNotStartedLabel,
}: UseFinancialGlobalKpisParams) {
  const totalsForView = useMemo(() => {
    const totalFee = projectMetricsBillableWithActivity.reduce((s, p) => s + p.monthlyFee, 0);
    const totalActual = projectMetricsBillableWithActivity.reduce((s, p) => s + p.actual, 0);
    const totalComputed = projectMetricsBillableWithActivity.reduce((s, p) => s + p.computed, 0);
    return { totalFee, totalActual, totalComputed };
  }, [projectMetricsBillableWithActivity]);

  const totalRevenue = isViewingCurrentMonth ? totalDisplayRevenue : totalsForView.totalFee;
  const totalHoursForView =
    hoursMode === 'computed' ? totalsForView.totalComputed : totalsForView.totalActual;
  const effectiveHourlyRate = totalHoursForView > 0 ? totalRevenue / totalHoursForView : 0;

  const totalMonthlyCostView = useMemo(() => {
    return employeeMetricsForView.reduce((sum, em) => {
      const emp = employees.find(e => e.id === em.employeeId);
      return sum + (emp?.monthlyCost ?? emp?.hourlyRate ?? 0);
    }, 0);
  }, [employeeMetricsForView, employees]);

  const totalHoursForCostDenominator =
    hoursMode === 'computed' ? totalsForView.totalComputed : totalsForView.totalActual;
  const avgHourlyCost =
    totalHoursForCostDenominator > 0 ? totalMonthlyCostView / totalHoursForCostDenominator : 0;

  const usesLoadedCostForTarget = commonExpensesTotalConfigured > 0;
  const avgLoadedHourlyCost =
    totalHoursForCostDenominator > 0
      ? (totalMonthlyCostView + totalOverheadInView) / totalHoursForCostDenominator
      : 0;
  const avgForTarget =
    usesLoadedCostForTarget && avgLoadedHourlyCost > 0 ? avgLoadedHourlyCost : avgHourlyCost;

  const defaultEhrTarget = avgForTarget > 0 ? Math.max(avgForTarget, 75) : 75;
  const ehrTarget =
    ehrTargetSetting != null && ehrTargetSetting > 0 ? ehrTargetSetting : defaultEhrTarget;
  const ehrIsHealthy = effectiveHourlyRate >= ehrTarget && totalHoursForView > 0;

  const enrichedProjects: FinancialEnrichedProject[] = useMemo(() => {
    return projectMetricsBillableWithActivity.map(p => {
      const clientName = clientById.get(p.clientId) || p.clientName || unknownClientLabel;
      const projectHours = hoursMode === 'computed' ? p.computed : p.actual;
      const ehr = projectHours > 0 ? (p.monthlyFee || 0) / projectHours : Number.POSITIVE_INFINITY;
      const ehrLabel = projectHours > 0 ? `${formatPerHour(ehr || 0, 0)}` : ehrNotStartedLabel;
      return { metric: p, clientName, ehr, ehrLabel };
    });
  }, [
    projectMetricsBillableWithActivity,
    clientById,
    hoursMode,
    formatPerHour,
    unknownClientLabel,
    ehrNotStartedLabel,
  ]);

  const sortedProjects = useMemo(() => {
    return [...enrichedProjects].sort((a, b) => {
      const ehrA = a.ehr;
      const ehrB = b.ehr;
      if (!isFinite(ehrA) && !isFinite(ehrB)) return 0;
      if (!isFinite(ehrA)) return 1;
      if (!isFinite(ehrB)) return -1;
      return ehrA - ehrB;
    });
  }, [enrichedProjects]);

  const totalInternalCost = useMemo(() => {
    return projectMetricsBillableWithActivity.reduce(
      (sum, p) => sum + (projectCostAndMarginMap.get(p.projectId)?.cost ?? 0),
      0
    );
  }, [projectMetricsBillableWithActivity, projectCostAndMarginMap]);

  const netMargin = totalRevenue - totalInternalCost;
  const marginIsPositive = netMargin >= 0;
  const marginPercent: number | null = totalRevenue > 0 ? (netMargin / totalRevenue) * 100 : null;

  return {
    totalsForView,
    totalRevenue,
    totalHoursForView,
    effectiveHourlyRate,
    totalMonthlyCostView,
    avgHourlyCost,
    usesLoadedCostForTarget,
    avgLoadedHourlyCost,
    ehrTarget,
    ehrIsHealthy,
    enrichedProjects,
    sortedProjects,
    totalInternalCost,
    netMargin,
    marginIsPositive,
    marginPercent,
  };
}
