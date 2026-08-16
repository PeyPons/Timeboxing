import { useMemo } from 'react';
import type { DepartmentDefinition, Employee, Project } from '@/types';
import type { EmployeeMetrics, ProjectMetrics } from '@/hooks/useProjectMetrics';
import { getRowCost, overheadShareForRow } from '@/utils/profitabilityCost';

type HoursMode = 'actual' | 'computed';
type CostMode = 'standard' | 'dynamic';

interface UseFinancialCostAttributionParams {
  employeeMetricsForView: EmployeeMetrics[];
  projectMetricsForView: ProjectMetrics[];
  projectMetricsBillableWithActivity: ProjectMetrics[];
  employees: Employee[];
  projects: Project[];
  departments: DepartmentDefinition[];
  hoursMode: HoursMode;
  effectiveCostMode: CostMode;
  employeeHoursGlobalById: Map<string, number> | ReadonlyMap<string, number>;
  overheadByEmployee: Map<string, number> | ReadonlyMap<string, number>;
  projectDisplayFeeMap: Map<string, number>;
  noDepartmentLabel: string;
}

export function useFinancialCostAttribution({
  employeeMetricsForView,
  projectMetricsForView,
  projectMetricsBillableWithActivity,
  employees,
  projects,
  departments,
  hoursMode,
  effectiveCostMode,
  employeeHoursGlobalById,
  overheadByEmployee,
  projectDisplayFeeMap,
  noDepartmentLabel,
}: UseFinancialCostAttributionParams) {
  const projectEmployeesMap = useMemo(() => {
    const map = new Map<string, { employeeId: string; hours: number; actual: number }[]>();
    employeeMetricsForView.forEach(em => {
      em.projectBreakdown.forEach(pb => {
        const list = map.get(pb.projectId) || [];
        list.push({ employeeId: em.employeeId, hours: pb.hours, actual: pb.actual ?? 0 });
        map.set(pb.projectId, list);
      });
    });
    return map;
  }, [employeeMetricsForView]);

  const projectByIdForAttr = useMemo(() => {
    const map = new Map<string, { actual: number; monthlyFee: number }>();
    projectMetricsForView.forEach(p =>
      map.set(p.projectId, { actual: p.actual, monthlyFee: p.monthlyFee || 0 })
    );
    return map;
  }, [projectMetricsForView]);

  const projectTotalHoursFromBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    projectEmployeesMap.forEach((rows, projectId) => {
      map.set(
        projectId,
        rows.reduce((s, r) => s + r.hours, 0)
      );
    });
    return map;
  }, [projectEmployeesMap]);

  const projectCostAndMarginMap = useMemo(() => {
    const map = new Map<
      string,
      { cost: number; payrollCost: number; overheadCost: number; margin: number }
    >();
    const employeeTotalsByMode = new Map<string, number>();
    employeeMetricsForView.forEach(em => {
      const totalInMode = hoursMode === 'computed' ? em.totalComputed : em.totalActual;
      employeeTotalsByMode.set(em.employeeId, totalInMode);
    });
    projectMetricsForView.forEach(p => {
      const breakdown = projectEmployeesMap.get(p.projectId) || [];
      let payrollCost = 0;
      let overheadCost = 0;
      breakdown.forEach(row => {
        const emp = employees.find(e => e.id === row.employeeId);
        const totalHEmployeeInMode = employeeTotalsByMode.get(row.employeeId) ?? 0;
        const hoursDisplay = hoursMode === 'computed' ? row.hours : (row.actual ?? 0);
        const totalHGlobal = employeeHoursGlobalById.get(row.employeeId) ?? totalHEmployeeInMode;
        payrollCost += getRowCost(emp, hoursDisplay, totalHEmployeeInMode, effectiveCostMode);
        overheadCost += overheadShareForRow(
          row.employeeId,
          hoursDisplay,
          totalHGlobal,
          overheadByEmployee
        );
      });
      const cost = payrollCost + overheadCost;
      const fee = p.monthlyFee || 0;
      map.set(p.projectId, { cost, payrollCost, overheadCost, margin: fee - cost });
    });
    return map;
  }, [
    projectMetricsForView,
    projectEmployeesMap,
    employees,
    hoursMode,
    effectiveCostMode,
    employeeMetricsForView,
    employeeHoursGlobalById,
    overheadByEmployee,
  ]);

  const projectEmployeeAttributionMap = useMemo(() => {
    const map = new Map<
      string,
      {
        employeeId: string;
        hours: number;
        hoursDisplay: number;
        cost: number;
        attributedRevenue: number;
        margin: number;
      }[]
    >();
    employeeMetricsForView.forEach(em => {
      const emp = employees.find(e => e.id === em.employeeId);
      const totalHEmployeeInMode = hoursMode === 'computed' ? em.totalComputed : em.totalActual;
      em.projectBreakdown.forEach(pb => {
        const hours = pb.hours;
        const actualHours = pb.actual ?? 0;
        const projectActual = projectByIdForAttr.get(pb.projectId)?.actual ?? 0;
        const totalHours = projectTotalHoursFromBreakdown.get(pb.projectId) ?? 0;
        const hoursDisplay = hoursMode === 'computed' ? hours : actualHours;
        const totalHGlobal = employeeHoursGlobalById.get(em.employeeId) ?? totalHEmployeeInMode;
        const payrollCost = getRowCost(emp, hoursDisplay, totalHEmployeeInMode, effectiveCostMode);
        const overheadCost = overheadShareForRow(
          em.employeeId,
          hoursDisplay,
          totalHGlobal,
          overheadByEmployee
        );
        const cost = payrollCost + overheadCost;
        const monthlyFee = projectByIdForAttr.get(pb.projectId)?.monthlyFee ?? 0;
        const totalHoursInMode = hoursMode === 'computed' ? totalHours : projectActual;
        const attributedRevenue =
          totalHoursInMode > 0 ? (hoursDisplay / totalHoursInMode) * monthlyFee : 0;
        const margin = attributedRevenue - cost;
        const list = map.get(pb.projectId) || [];
        list.push({ employeeId: em.employeeId, hours, hoursDisplay, cost, attributedRevenue, margin });
        map.set(pb.projectId, list);
      });
    });
    return map;
  }, [
    employeeMetricsForView,
    employees,
    projectTotalHoursFromBreakdown,
    projectByIdForAttr,
    hoursMode,
    effectiveCostMode,
    employeeHoursGlobalById,
    overheadByEmployee,
  ]);

  const projectById = useMemo(() => {
    const map = new Map<string, Project>();
    projects.forEach(p => map.set(p.id, p));
    return map;
  }, [projects]);

  const departmentProfitability = useMemo(() => {
    const records: {
      id: string;
      name: string;
      ehr: number;
      revenue: number;
      hours: number;
      payrollCost: number;
      overheadCost: number;
      cost: number;
      margin: number;
    }[] = [];
    departments.forEach(dept => {
      let revenue = 0;
      let hours = 0;
      let payrollCost = 0;
      let overheadCost = 0;
      projectMetricsBillableWithActivity.forEach(pm => {
        const proj = projectById.get(pm.projectId);
        if (!proj) return;
        if (!proj.responsibleDepartmentId) return;
        if (proj.responsibleDepartmentId !== dept.id && proj.responsibleDepartmentId !== dept.name)
          return;
        const fee = projectDisplayFeeMap.get(pm.projectId) ?? pm.monthlyFee ?? 0;
        revenue += fee;
        hours += hoursMode === 'computed' ? pm.computed : pm.actual;
        const cm = projectCostAndMarginMap.get(pm.projectId);
        payrollCost += cm?.payrollCost ?? 0;
        overheadCost += cm?.overheadCost ?? 0;
      });
      const cost = payrollCost + overheadCost;
      const margin = revenue - cost;
      if (hours > 0 && revenue > 0) {
        const ehr = revenue / hours;
        records.push({
          id: dept.id,
          name: dept.name,
          ehr,
          revenue,
          hours,
          payrollCost,
          overheadCost,
          cost,
          margin,
        });
      }
    });

    const NO_DEPT_ID = '__none__';
    let revenueNone = 0;
    let hoursNone = 0;
    let payrollCostNone = 0;
    let overheadCostNone = 0;
    projectMetricsBillableWithActivity.forEach(pm => {
      const proj = projectById.get(pm.projectId);
      if (!proj || proj.responsibleDepartmentId) return;
      const fee = projectDisplayFeeMap.get(pm.projectId) ?? pm.monthlyFee ?? 0;
      revenueNone += fee;
      hoursNone += hoursMode === 'computed' ? pm.computed : pm.actual;
      const cm = projectCostAndMarginMap.get(pm.projectId);
      payrollCostNone += cm?.payrollCost ?? 0;
      overheadCostNone += cm?.overheadCost ?? 0;
    });
    const costNone = payrollCostNone + overheadCostNone;
    const marginNone = revenueNone - costNone;
    if (hoursNone > 0 && revenueNone > 0) {
      records.push({
        id: NO_DEPT_ID,
        name: noDepartmentLabel,
        ehr: revenueNone / hoursNone,
        revenue: revenueNone,
        hours: hoursNone,
        payrollCost: payrollCostNone,
        overheadCost: overheadCostNone,
        cost: costNone,
        margin: marginNone,
      });
    }

    return {
      items: records.sort((a, b) => b.ehr - a.ehr),
    };
  }, [
    departments,
    projectMetricsBillableWithActivity,
    projectById,
    hoursMode,
    projectCostAndMarginMap,
    projectDisplayFeeMap,
    noDepartmentLabel,
  ]);

  return {
    projectEmployeesMap,
    projectByIdForAttr,
    projectTotalHoursFromBreakdown,
    projectCostAndMarginMap,
    projectEmployeeAttributionMap,
    projectById,
    departmentProfitability,
  };
}
