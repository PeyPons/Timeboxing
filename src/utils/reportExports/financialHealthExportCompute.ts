import { format, isSameMonth } from 'date-fns';
import type { Agency, Allocation, Client, Deadline, Employee, GlobalAssignment, Project } from '@/types';
import { filterEmployeesForOperationalMonthDate } from '@/utils/employeeAssignmentVisibility';
import { normalizeDepartments, employeeBelongsToDepartment } from '@/utils/departmentUtils';
import { isAllocationInEffectiveMonth, getWorkingDaysInMonth, getWorkingDaysElapsedInMonth } from '@/utils/dateUtils';
import {
  allocateCommonExpenses,
  collectCommonExpenseEntriesForMonth,
} from '@/utils/commonExpensesAllocation';
import { computeProjectMetricsForMonth, type ProjectMetricsDeadline } from '@/utils/projectMetricsCompute';
import type { BuildRentabilityDiagnosticParams, RentabilityEmployeeProfitabilityRow } from '@/utils/reportExports/rentabilityDiagnostic';
import { getRowCost, getStandardHourlyCost, getStandardMonthlyCapacity, overheadShareForRow, filterEmployeeProfitabilityRowsForDisplay } from '@/utils/profitabilityCost';

export interface FinancialHealthExportComputeInput {
  currentMonth: Date;
  allocations: Allocation[];
  projects: Project[];
  clients: Client[];
  employees: Employee[];
  deadlinesForMonth: ProjectMetricsDeadline[];
  /** Filas completas de Deadlines (horas por empleado) para métricas y reparto de gastos con inactivos con carga. */
  deadlinesRows?: Array<Pick<Deadline, 'month' | 'employeeHours'>>;
  globalAssignmentsForMonth?: GlobalAssignment[];
  selectedDepartmentId: string | null;
  agency: Pick<Agency, 'id' | 'name' | 'settings'> | null;
  hoursMode: 'actual' | 'computed';
  costMode: 'standard' | 'dynamic';
  searchQuery?: string;
}

export function computeBuildRentabilityDiagnosticParams(
  input: FinancialHealthExportComputeInput
): BuildRentabilityDiagnosticParams {
  const {
    currentMonth,
    allocations,
    projects,
    clients,
    employees,
    deadlinesForMonth,
    deadlinesRows,
    globalAssignmentsForMonth,
    selectedDepartmentId,
    agency,
    hoursMode,
    costMode,
    searchQuery = '',
  } = input;

  const departments = normalizeDepartments(agency?.settings?.departments);

  const employeesForView = (() => {
    if (!selectedDepartmentId || !departments.length) return employees ?? [];
    const dept = departments.find((d) => d.id === selectedDepartmentId || d.name === selectedDepartmentId);
    if (!dept) return employees ?? [];
    return (employees ?? []).filter((e) => employeeBelongsToDepartment(e.department, dept.id, dept.name));
  })();

  const projectIdsForDepartment = (() => {
    if (!selectedDepartmentId) return undefined as Set<string> | undefined;
    if (!employeesForView.length) return new Set<string>();
    const allowedEmployeeIds = new Set(employeesForView.map((e) => e.id));
    const ids = new Set<string>();
    (allocations ?? []).forEach((a) => {
      if (!allowedEmployeeIds.has(a.employeeId)) return;
      if (!isAllocationInEffectiveMonth(a.weekStartDate, currentMonth)) return;
      ids.add(a.projectId);
    });
    return ids;
  })();

  const selectedDept = (() => {
    if (!selectedDepartmentId || !departments.length) return null;
    return departments.find((d) => d.id === selectedDepartmentId || d.name === selectedDepartmentId) ?? null;
  })();

  const deadlinesEmployeeVisibility =
    deadlinesRows ??
    deadlinesForMonth.map((d) => ({ month: d.month, employeeHours: {} as Record<string, number> }));

  const { projectMetrics, employeeMetrics } = computeProjectMetricsForMonth({
    allocations,
    projects,
    clients,
    employees,
    month: currentMonth,
    hoursTrackingPreference: agency?.settings?.hoursTrackingPreference ?? null,
    deadlines: deadlinesForMonth,
    deadlinesEmployeeVisibility,
    globalAssignmentsEmployeeVisibility: globalAssignmentsForMonth ?? [],
  });

  const projectMetricsForView = (() => {
    if (!projectIdsForDepartment || !selectedDept) return projectMetrics;
    return projectMetrics.filter((p) => {
      if ((p.monthlyFee ?? 0) === 0) return true;
      if (!projectIdsForDepartment.has(p.projectId)) return false;
      const proj = projects?.find((pr) => pr.id === p.projectId);
      if (!proj?.responsibleDepartmentId) return true;
      return proj.responsibleDepartmentId === selectedDept.id || proj.responsibleDepartmentId === selectedDept.name;
    });
  })();

  const clientById = new Map<string, string>();
  clients.forEach((c) => clientById.set(c.id, c.name));

  const projectMetricsFilteredBySearch = (() => {
    if (!searchQuery.trim()) return projectMetricsForView;
    const q = searchQuery.trim().toLowerCase();
    return projectMetricsForView.filter((p) => {
      const clientName = clientById.get(p.clientId) || p.clientName || '';
      return p.projectName.toLowerCase().includes(q) || clientName.toLowerCase().includes(q);
    });
  })();

  const projectMetricsBillable = projectMetricsFilteredBySearch.filter((p) => (p.monthlyFee ?? 0) > 0);
  const projectMetricsBillableWithActivity = projectMetricsBillable.filter((p) =>
    hoursMode === 'computed' ? p.computed > 0 : p.actual > 0
  );

  const employeeMetricsForView = (() => {
    if (!selectedDepartmentId) return employeeMetrics;
    const allowedIds = new Set(employeesForView.map((e) => e.id));
    return employeeMetrics.filter((em) => allowedIds.has(em.employeeId));
  })();

  const commonExpensesMonthKey = format(currentMonth, 'yyyy-MM');

  const employeeHoursGlobalById = new Map<string, number>();
  employeeMetrics.forEach((em) => {
    const h = hoursMode === 'computed' ? em.totalComputed : em.totalActual;
    employeeHoursGlobalById.set(em.employeeId, h);
  });

  const mergedCommonExpenseEntries = collectCommonExpenseEntriesForMonth(
    agency?.settings,
    commonExpensesMonthKey,
    departments
  );

  const employeePayrollById = new Map<string, number>();
  (employees ?? []).forEach((e) => {
    employeePayrollById.set(e.id, e.monthlyCost ?? e.hourlyRate ?? 0);
  });

  const commonExpensesAlloc = allocateCommonExpenses({
    entries: mergedCommonExpenseEntries,
    employees: filterEmployeesForOperationalMonthDate(employees ?? [], currentMonth, {
      deadlines: deadlinesEmployeeVisibility,
      globalAssignments: globalAssignmentsForMonth ?? [],
      allocations,
    }).map((e) => ({
      id: e.id,
      department: e.department,
      departmentId: e.departmentId,
    })),
    departments,
    getEmployeeHours: (id) => employeeHoursGlobalById.get(id) ?? 0,
    getEmployeePayroll: (id) => employeePayrollById.get(id) ?? 0,
  });

  const overheadByEmployee: ReadonlyMap<string, number> = commonExpensesAlloc.ok
    ? commonExpensesAlloc.overheadByEmployee
    : new Map<string, number>();

  const totalOverheadInView = (() => {
    if (!commonExpensesAlloc.ok) return 0;
    return employeeMetricsForView.reduce(
      (s, em) => s + (commonExpensesAlloc.overheadByEmployee.get(em.employeeId) ?? 0),
      0
    );
  })();

  const totalsForView = (() => {
    const totalFee = projectMetricsBillableWithActivity.reduce((s, p) => s + p.monthlyFee, 0);
    const totalActual = projectMetricsBillableWithActivity.reduce((s, p) => s + p.actual, 0);
    const totalComputed = projectMetricsBillableWithActivity.reduce((s, p) => s + p.computed, 0);
    const totalBudget = projectMetricsBillableWithActivity.reduce((s, p) => s + p.budget, 0);
    const avgProgress =
      projectMetricsBillableWithActivity.length > 0
        ? projectMetricsBillableWithActivity.reduce((s, p) => s + p.progressOperational, 0) /
          projectMetricsBillableWithActivity.length
        : 0;
    return { totalFee, totalActual, totalComputed, totalBudget, avgProgress };
  })();

  const isViewingCurrentMonth = isSameMonth(currentMonth, new Date());
  const workingDaysInMonth = getWorkingDaysInMonth(currentMonth);
  const workingDaysElapsed = getWorkingDaysElapsedInMonth(currentMonth);
  const pctMonthElapsed =
    !isViewingCurrentMonth || workingDaysInMonth <= 0 ? 100 : (workingDaysElapsed / workingDaysInMonth) * 100;
  const dynamicCostFallbackActive =
    costMode === 'dynamic' && isViewingCurrentMonth && pctMonthElapsed < 25;
  const effectiveCostMode: 'standard' | 'dynamic' = dynamicCostFallbackActive ? 'standard' : costMode;

  const accruedRatio =
    !isViewingCurrentMonth || workingDaysInMonth <= 0 ? 1 : workingDaysElapsed / workingDaysInMonth;

  const projectDisplayFeeMap = new Map<string, number>();
  projectMetricsForView.forEach((p) => {
    const fee = p.monthlyFee ?? 0;
    if (!isViewingCurrentMonth) {
      projectDisplayFeeMap.set(p.projectId, fee);
      return;
    }
    const hoursDisplay = hoursMode === 'computed' ? p.computed : p.actual;
    const budget = p.budget > 0 ? p.budget : 0;
    const hasReachedOrExceededBudget = budget > 0 && hoursDisplay >= budget;
    projectDisplayFeeMap.set(p.projectId, hasReachedOrExceededBudget ? fee : fee * accruedRatio);
  });

  const totalDisplayRevenue = projectMetricsBillableWithActivity.reduce(
    (sum, p) => sum + (projectDisplayFeeMap.get(p.projectId) ?? p.monthlyFee ?? 0),
    0
  );

  const totalRevenue = isViewingCurrentMonth ? totalDisplayRevenue : totalsForView.totalFee;
  const totalHoursForView =
    hoursMode === 'computed' ? totalsForView.totalComputed : totalsForView.totalActual;
  const effectiveHourlyRate = totalHoursForView > 0 ? totalRevenue / totalHoursForView : 0;

  const totalMonthlyCostView = employeeMetricsForView.reduce((sum, em) => {
    const emp = employees.find((e) => e.id === em.employeeId);
    return sum + (emp?.monthlyCost ?? emp?.hourlyRate ?? 0);
  }, 0);

  const totalHoursForCostDenominator =
    hoursMode === 'computed' ? totalsForView.totalComputed : totalsForView.totalActual;
  const avgHourlyCost =
    totalHoursForCostDenominator > 0 ? totalMonthlyCostView / totalHoursForCostDenominator : 0;
  const usesLoadedCostForTarget = commonExpensesAlloc.ok && commonExpensesAlloc.totalConfiguredAmount > 0;
  const avgLoadedHourlyCost =
    totalHoursForCostDenominator > 0
      ? (totalMonthlyCostView + totalOverheadInView) / totalHoursForCostDenominator
      : 0;
  const avgForTarget =
    usesLoadedCostForTarget && avgLoadedHourlyCost > 0 ? avgLoadedHourlyCost : avgHourlyCost;
  const defaultEhrTarget = avgForTarget > 0 ? Math.max(avgForTarget, 75) : 75;
  const ehrTarget =
    agency?.settings?.ehrTarget != null && agency.settings.ehrTarget > 0
      ? agency.settings.ehrTarget
      : defaultEhrTarget;

  const projectEmployeesMap = new Map<string, { employeeId: string; hours: number; actual: number }[]>();
  employeeMetricsForView.forEach((em) => {
    em.projectBreakdown.forEach((pb) => {
      const list = projectEmployeesMap.get(pb.projectId) || [];
      list.push({ employeeId: em.employeeId, hours: pb.hours, actual: pb.actual ?? 0 });
      projectEmployeesMap.set(pb.projectId, list);
    });
  });

  const projectByIdForAttr = new Map<string, { actual: number; monthlyFee: number }>();
  projectMetricsForView.forEach((p) =>
    projectByIdForAttr.set(p.projectId, { actual: p.actual, monthlyFee: p.monthlyFee || 0 })
  );

  const projectTotalHoursFromBreakdown = new Map<string, number>();
  projectEmployeesMap.forEach((rows, projectId) => {
    projectTotalHoursFromBreakdown.set(projectId, rows.reduce((s, r) => s + r.hours, 0));
  });

  const projectCostAndMarginMap = (() => {
    const map = new Map<string, { cost: number; payrollCost: number; overheadCost: number; margin: number }>();
    const employeeTotalsByMode = new Map<string, number>();
    employeeMetricsForView.forEach((em) => {
      const totalInMode = hoursMode === 'computed' ? em.totalComputed : em.totalActual;
      employeeTotalsByMode.set(em.employeeId, totalInMode);
    });
    projectMetricsForView.forEach((p) => {
      const breakdown = projectEmployeesMap.get(p.projectId) || [];
      let payrollCost = 0;
      let overheadCost = 0;
      breakdown.forEach((row) => {
        const emp = employees.find((e) => e.id === row.employeeId);
        const totalHEmployeeInMode = employeeTotalsByMode.get(row.employeeId) ?? 0;
        const hoursDisplay = hoursMode === 'computed' ? row.hours : (row.actual ?? 0);
        const totalHGlobal = employeeHoursGlobalById.get(row.employeeId) ?? totalHEmployeeInMode;
        payrollCost += getRowCost(emp, hoursDisplay, totalHEmployeeInMode, effectiveCostMode);
        overheadCost += overheadShareForRow(row.employeeId, hoursDisplay, totalHGlobal, overheadByEmployee);
      });
      const cost = payrollCost + overheadCost;
      const fee = p.monthlyFee || 0;
      map.set(p.projectId, { cost, payrollCost, overheadCost, margin: fee - cost });
    });
    return map;
  })();

  const totalInternalCost = projectMetricsBillableWithActivity.reduce(
    (sum, p) => sum + (projectCostAndMarginMap.get(p.projectId)?.cost ?? 0),
    0
  );

  const netMargin = totalRevenue - totalInternalCost;
  const marginPercent: number | null = totalRevenue > 0 ? (netMargin / totalRevenue) * 100 : null;

  const projectIdsWithActivity = new Set(projectMetricsBillableWithActivity.map((p) => p.projectId));

  const employeeProfitabilityList: RentabilityEmployeeProfitabilityRow[] = filterEmployeeProfitabilityRowsForDisplay(
    employeeMetricsForView.map((em) => {
    const emp = employees.find((e) => e.id === em.employeeId);
    const totalHEmployeeInMode = hoursMode === 'computed' ? em.totalComputed : em.totalActual;
    const totalHGlobal = employeeHoursGlobalById.get(em.employeeId) ?? totalHEmployeeInMode;
    let attributedRevenue = 0;
    let costFromVisibleProjects = 0;
    let payrollFromVisibleProjects = 0;
    let overheadFromVisibleProjects = 0;
    const byProject: RentabilityEmployeeProfitabilityRow['byProject'] = [];

    em.projectBreakdown.forEach((pb) => {
      const isBillableWithActivity = projectIdsWithActivity.has(pb.projectId);
      const hours = pb.hours;
      const actualHours = pb.actual ?? 0;
      const projectActual = projectByIdForAttr.get(pb.projectId)?.actual ?? 0;
      const totalHours = projectTotalHoursFromBreakdown.get(pb.projectId) ?? 0;
      const hoursDisplay = hoursMode === 'computed' ? hours : actualHours;
      const monthlyFee = projectByIdForAttr.get(pb.projectId)?.monthlyFee ?? 0;
      const isInternal = (monthlyFee ?? 0) === 0;
      const hasHours = hoursDisplay > 0;
      const includeCostRow = hasHours && (isInternal || (monthlyFee ?? 0) > 0);
      if (!includeCostRow) return;

      const payrollRow = getRowCost(emp, hoursDisplay, totalHEmployeeInMode, effectiveCostMode);
      const overheadRow = overheadShareForRow(em.employeeId, hoursDisplay, totalHGlobal, overheadByEmployee);
      const rowCost = payrollRow + overheadRow;
      const totalHoursInMode = hoursMode === 'computed' ? totalHours : projectActual;
      const attr = totalHoursInMode > 0 ? (hoursDisplay / totalHoursInMode) * (monthlyFee ?? 0) : 0;
      const projectEhr =
        (monthlyFee ?? 0) > 0 && totalHoursInMode > 0 ? (monthlyFee ?? 0) / totalHoursInMode : 0;
      const countRevenue = isBillableWithActivity;
      if (countRevenue) {
        attributedRevenue += attr;
      }
      costFromVisibleProjects += rowCost;
      payrollFromVisibleProjects += payrollRow;
      overheadFromVisibleProjects += overheadRow;
      const attributed = countRevenue ? attr : 0;
      byProject.push({
        projectId: pb.projectId,
        projectName: pb.projectName,
        hours,
        hoursDisplay,
        payrollCost: payrollRow,
        overheadCost: overheadRow,
        cost: rowCost,
        attributedRevenue: attributed,
        margin: attributed - rowCost,
        projectEhr,
      });
    });

    const totalHoursDisplay = byProject.reduce((s, b) => s + b.hoursDisplay, 0);
    const payrollMonthly = emp?.monthlyCost ?? emp?.hourlyRate ?? 0;
    const overheadTotalEmployee = overheadByEmployee.get(em.employeeId) ?? 0;
    const UNATTRIBUTED_HOURS_EPS = 0.02;
    const hoursNotAttributedRaw = Math.max(0, totalHEmployeeInMode - totalHoursDisplay);
    const hoursNotAttributed = hoursNotAttributedRaw < UNATTRIBUTED_HOURS_EPS ? 0 : hoursNotAttributedRaw;
    const payrollNotAttributed =
      effectiveCostMode === 'dynamic'
        ? totalHEmployeeInMode > 0
          ? payrollMonthly * (hoursNotAttributed / totalHEmployeeInMode)
          : 0
        : hoursNotAttributed * getStandardHourlyCost(emp);
    const overheadNotAttributed = overheadShareForRow(
      em.employeeId,
      hoursNotAttributed,
      totalHGlobal,
      overheadByEmployee
    );
    const costNotAttributed = payrollNotAttributed + overheadNotAttributed;
    const payrollStandardIdle =
      effectiveCostMode === 'standard' && emp && payrollMonthly > 0
        ? Math.max(
            0,
            Math.round((payrollMonthly - getStandardHourlyCost(emp) * totalHEmployeeInMode) * 100) / 100
          )
        : 0;
    const payrollAllocatedTotal = payrollFromVisibleProjects + payrollNotAttributed + payrollStandardIdle;
    const costTotal = costFromVisibleProjects + costNotAttributed + payrollStandardIdle;
    const margin = attributedRevenue - costTotal;
    const marginPercentRow = attributedRevenue > 0 ? (margin / attributedRevenue) * 100 : 0;

    return {
      employeeId: em.employeeId,
      employeeName: em.employeeName,
      totalActual: em.totalActual,
      totalComputed: em.totalComputed,
      totalHoursDisplay,
      totalHoursGlobal: totalHEmployeeInMode,
      hoursNotAttributed,
      payrollMonthly,
      overheadTotalEmployee,
      costNotAttributed,
      payrollNotAttributed,
      overheadNotAttributed,
      payrollStandardIdle,
      payrollAllocatedTotal,
      cost: costTotal,
      payrollCost: payrollFromVisibleProjects,
      overheadCost: overheadFromVisibleProjects,
      attributedRevenue,
      margin,
      marginPercent: marginPercentRow,
      byProject,
    };
  }),
    employees,
    hoursMode
  );

  const departmentNameForView = (() => {
    if (!selectedDepartmentId) return null;
    const d = departments.find((x) => x.id === selectedDepartmentId || x.name === selectedDepartmentId);
    return d?.name ?? null;
  })();

  return {
    commonExpensesAlloc,
    commonExpensesMonthKey,
    costMode,
    effectiveCostMode,
    isViewingCurrentMonth,
    dynamicCostFallbackActive,
    pctMonthElapsed,
    departmentNameForView,
    searchQueryActive: Boolean(searchQuery.trim()),
    agencyId: agency?.id ?? null,
    agencyName: agency?.name ?? null,
    hoursMode,
    totalRevenue,
    totalHoursForView,
    effectiveHourlyRate,
    netMargin,
    marginPercent,
    totalInternalCost,
    totalOverheadInView,
    ehrTarget,
    projectMetricsForView,
    projectCostAndMarginMap,
    employeeProfitabilityList,
    employees,
  };
}
