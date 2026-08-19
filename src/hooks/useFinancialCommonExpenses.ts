import { useMemo } from 'react';
import { format } from 'date-fns';
import type {
  AgencySettings,
  Allocation,
  Deadline,
  DepartmentDefinition,
  Employee,
  GlobalAssignment,
} from '@/types';
import type { EmployeeMetrics, ProjectMetrics } from '@/hooks/useProjectMetrics';
import {
  allocateCommonExpenses,
  collectCommonExpenseEntriesForMonth,
  type AllocateCommonExpensesFailure,
} from '@/utils/commonExpensesAllocation';
import { filterEmployeesForOperationalMonthDate } from '@/utils/employeeAssignmentVisibility';
import { overheadShareForRow } from '@/utils/profitabilityCost';

type HoursMode = 'actual' | 'computed';

interface UseFinancialCommonExpensesParams {
  currentMonth: Date;
  settings: AgencySettings | undefined;
  departments: DepartmentDefinition[];
  employees: Employee[];
  employeeMetrics: EmployeeMetrics[];
  employeeMetricsForView: EmployeeMetrics[];
  allocations: Allocation[];
  deadlines: Deadline[];
  globalAssignments: GlobalAssignment[];
  projectMetricsForView: ProjectMetrics[];
  hoursMode: HoursMode;
}

export function useFinancialCommonExpenses({
  currentMonth,
  settings,
  departments,
  employees,
  employeeMetrics,
  employeeMetricsForView,
  allocations,
  deadlines,
  globalAssignments,
  projectMetricsForView,
  hoursMode,
}: UseFinancialCommonExpensesParams) {
  const commonExpensesMonthKey = useMemo(
    () => format(currentMonth, 'yyyy-MM'),
    [currentMonth]
  );

  const employeeHoursGlobalById = useMemo(() => {
    const map = new Map<string, number>();
    employeeMetrics.forEach(employeeMetric => {
      const hours =
        hoursMode === 'computed'
          ? employeeMetric.totalComputed
          : employeeMetric.totalActual;
      map.set(employeeMetric.employeeId, hours);
    });
    return map;
  }, [employeeMetrics, hoursMode]);

  const mergedCommonExpenseEntries = useMemo(
    () =>
      collectCommonExpenseEntriesForMonth(
        settings,
        commonExpensesMonthKey,
        departments
      ),
    [settings, commonExpensesMonthKey, departments]
  );

  const employeePayrollById = useMemo(() => {
    const map = new Map<string, number>();
    (employees ?? []).forEach(employee => {
      map.set(employee.id, employee.monthlyCost ?? employee.hourlyRate ?? 0);
    });
    return map;
  }, [employees]);

  const commonExpensesAlloc = useMemo(() => {
    const employeeRows = filterEmployeesForOperationalMonthDate(
      employees ?? [],
      currentMonth,
      {
        deadlines,
        globalAssignments,
        allocations: allocations ?? [],
      }
    ).map(employee => ({
      id: employee.id,
      department: employee.department,
      departmentId: employee.departmentId,
    }));

    return allocateCommonExpenses({
      entries: mergedCommonExpenseEntries,
      employees: employeeRows,
      departments,
      getEmployeeHours: id => employeeHoursGlobalById.get(id) ?? 0,
      getEmployeePayroll: id => employeePayrollById.get(id) ?? 0,
    });
  }, [
    mergedCommonExpenseEntries,
    employees,
    departments,
    employeeHoursGlobalById,
    employeePayrollById,
    currentMonth,
    deadlines,
    globalAssignments,
    allocations,
  ]);

  const overheadByEmployee = useMemo((): ReadonlyMap<string, number> => {
    if (commonExpensesAlloc.ok) return commonExpensesAlloc.overheadByEmployee;
    return new Map<string, number>();
  }, [commonExpensesAlloc]);

  const totalOverheadInView = useMemo(() => {
    if (!commonExpensesAlloc.ok) return 0;
    return employeeMetricsForView.reduce(
      (sum, employeeMetric) =>
        sum +
        (commonExpensesAlloc.overheadByEmployee.get(employeeMetric.employeeId) ?? 0),
      0
    );
  }, [commonExpensesAlloc, employeeMetricsForView]);

  const agencyTotalOverheadApplied = commonExpensesAlloc.ok
    ? commonExpensesAlloc.totalOverheadApplied
    : 0;
  const commonExpensesAllocError: AllocateCommonExpensesFailure | null =
    'code' in commonExpensesAlloc ? commonExpensesAlloc : null;

  const commonExpensesBreakdown = useMemo(() => {
    const recurring = settings?.commonExpensesRecurring ?? [];
    const recurringInMonth = recurring.filter(entry => {
      if (!entry.recurringFromMonth) return false;
      if (entry.recurringFromMonth > commonExpensesMonthKey) return false;
      if (
        entry.recurringUntilMonth &&
        entry.recurringUntilMonth < commonExpensesMonthKey
      ) {
        return false;
      }
      return true;
    });
    const monthly = settings?.commonExpensesByMonth?.[commonExpensesMonthKey] ?? [];
    const totalRecurring = recurringInMonth.reduce(
      (sum, entry) => sum + (entry.amount || 0),
      0
    );
    const totalMonthly = monthly.reduce(
      (sum, entry) => sum + (entry.amount || 0),
      0
    );
    return {
      total: totalRecurring + totalMonthly,
      totalRecurring,
      totalMonthly,
      countRecurring: recurringInMonth.length,
      countMonthly: monthly.length,
    };
  }, [
    settings?.commonExpensesRecurring,
    settings?.commonExpensesByMonth,
    commonExpensesMonthKey,
  ]);

  const commonExpensesZeroHourWarningNames = useMemo(() => {
    if (
      !commonExpensesAlloc.ok ||
      commonExpensesAlloc.employeeIdsZeroHoursWithPeersWorking.length === 0
    ) {
      return [] as string[];
    }
    return commonExpensesAlloc.employeeIdsZeroHoursWithPeersWorking
      .map(id => employees.find(employee => employee.id === id)?.name)
      .filter((name): name is string => Boolean(name));
  }, [commonExpensesAlloc, employees]);

  const projectMonthlyFeeById = useMemo(() => {
    const map = new Map<string, number>();
    projectMetricsForView.forEach(projectMetric =>
      map.set(projectMetric.projectId, projectMetric.monthlyFee || 0)
    );
    return map;
  }, [projectMetricsForView]);

  const overheadVisibleFromRows = useMemo(() => {
    let sum = 0;
    employeeMetricsForView.forEach(employeeMetric => {
      const totalHoursEmployeeInMode =
        hoursMode === 'computed'
          ? employeeMetric.totalComputed
          : employeeMetric.totalActual;
      const totalHoursGlobal =
        employeeHoursGlobalById.get(employeeMetric.employeeId) ??
        totalHoursEmployeeInMode;
      employeeMetric.projectBreakdown.forEach(projectBreakdown => {
        const hours = projectBreakdown.hours;
        const actualHours = projectBreakdown.actual ?? 0;
        const monthlyFee = projectMonthlyFeeById.get(projectBreakdown.projectId) ?? 0;
        const isInternal = (monthlyFee ?? 0) === 0;
        const hoursDisplay = hoursMode === 'computed' ? hours : actualHours;
        const hasHours = hoursDisplay > 0;
        if (hasHours && (isInternal || (monthlyFee ?? 0) > 0)) {
          sum += overheadShareForRow(
            employeeMetric.employeeId,
            hoursDisplay,
            totalHoursGlobal,
            overheadByEmployee
          );
        }
      });
    });
    return Math.round(sum * 100) / 100;
  }, [
    employeeMetricsForView,
    hoursMode,
    projectMonthlyFeeById,
    employeeHoursGlobalById,
    overheadByEmployee,
  ]);

  return {
    employeeHoursGlobalById,
    commonExpensesAlloc,
    overheadByEmployee,
    totalOverheadInView,
    agencyTotalOverheadApplied,
    commonExpensesAllocError,
    commonExpensesBreakdown,
    commonExpensesZeroHourWarningNames,
    overheadVisibleFromRows,
  };
}
