/**
 * usePlannerData Hook
 *
 * Extracts date navigation logic, week calculations, and month loading
 * from PlannerGrid component into a reusable hook.
 */

import { useMemo } from 'react';
import { format } from 'date-fns';
import { useApp } from '@/contexts/AppContext';
import { useDepartmentView } from '@/contexts/DepartmentViewContext';
import { getWeeksForMonth, isAllocationInEffectiveMonth } from '@/utils/dateUtils';
import { useAgency } from '@/contexts/AgencyContext';
import { employeeBelongsToDepartment, normalizeDepartments } from '@/utils/departmentUtils';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { usePlanMonthNavigation } from '@/hooks/usePlanMonthNavigation';
import { useSubscriptionLimits } from '@/hooks/useSubscriptionLimits';
import { useEnsureMonthWithLoading } from '@/hooks/useEnsureMonthWithLoading';
import { isAtPlanHistoryMinMonth } from '@/utils/planHistoryUtils';
import { Employee } from '@/types';
import {
  employeeIdsWithOperationalWorkloadInMonth,
  filterEmployeesForOperationalMonth,
} from '@/utils/employeeAssignmentVisibility';

interface UsePlannerDataOptions {
  initialDate?: Date;
  showOnlyMe?: boolean;
  selectedEmployeeId?: string;
  selectedProjectId?: string;
}

export function usePlannerData(options: UsePlannerDataOptions = {}) {
  const {
    employees,
    projects,
    allocations,
    absences,
    teamEvents,
    currentUser,
    isLoading: isGlobalLoading,
    getEmployeeMonthlyLoad,
  } = useApp();
  const { currentAgency } = useAgency();
  const { selectedDepartmentId } = useDepartmentView();
  const { isPlatformAdmin } = usePlatformAdmin();
  const departments = useMemo(
    () => normalizeDepartments(currentAgency?.settings?.departments),
    [currentAgency?.settings?.departments]
  );

  const {
    currentMonth,
    setCurrentMonth,
    goToPrevMonth,
    goToNextMonth,
    goToToday,
    monthKey,
  } = usePlanMonthNavigation({ initialMonth: options.initialDate });
  const { historyMinDate } = useSubscriptionLimits();

  const isLoadingMonth = useEnsureMonthWithLoading(currentMonth, { enabled: !isGlobalLoading });
  const prevMonthDisabled = isAtPlanHistoryMinMonth(currentMonth, historyMinDate);

  const weeks = useMemo(() => getWeeksForMonth(currentMonth), [currentMonth]);
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const workloadEmployeeIds = useMemo(
    () =>
      employeeIdsWithOperationalWorkloadInMonth(monthKey, {
        allocations: allocations ?? [],
        deadlines: [],
        globalAssignments: [],
        limitToEmployeeIds: new Set((employees ?? []).map((e) => e.id)),
      }),
    [monthKey, allocations, employees]
  );

  const employeesByProject = useMemo(() => {
    const index = new Map<string, Set<string>>();
    (allocations || []).forEach((a) => {
      if (isAllocationInEffectiveMonth(a.weekStartDate, currentMonth)) {
        if (!index.has(a.projectId)) index.set(a.projectId, new Set());
        index.get(a.projectId)!.add(a.employeeId);
      }
    });
    return index;
  }, [allocations, currentMonth]);

  const filteredEmployees = useMemo(() => {
    const showOnlyMe = options.showOnlyMe ?? false;
    const selectedEmployeeId = options.selectedEmployeeId ?? 'all';
    const selectedProjectId = options.selectedProjectId ?? 'all';

    const effectiveShowOnlyMe = showOnlyMe && currentUser != null;

    return (employees || []).filter((e: Employee) => {
      if (!e.isActive) return false;
      if (effectiveShowOnlyMe && e.id !== currentUser!.id) return false;
      if (selectedEmployeeId !== 'all' && e.id !== selectedEmployeeId) return false;
      if (selectedProjectId !== 'all') {
        const employeesInProject = employeesByProject.get(selectedProjectId);
        if (!employeesInProject || !employeesInProject.has(e.id)) return false;
      }
      if (selectedDepartmentId && departments.length > 0) {
        const dept = departments.find(
          (d) => d.id === selectedDepartmentId || d.name === selectedDepartmentId
        );
        if (dept && !employeeBelongsToDepartment(e.department, dept.id, dept.name)) return false;
      }
      return true;
    });
  }, [
    employees,
    options.showOnlyMe,
    options.selectedEmployeeId,
    options.selectedProjectId,
    employeesByProject,
    currentUser,
    selectedDepartmentId,
    departments,
  ]);

  const sortedProjects = useMemo(
    () => [...(projects || [])].sort((a, b) => a.name.localeCompare(b.name)),
    [projects]
  );

  const sortedEmployees = useMemo(
    () =>
      filterEmployeesForOperationalMonth(employees ?? [], monthKey, {
        allocations: allocations ?? [],
        deadlines: [],
        globalAssignments: [],
      }).sort((a, b) => a.name.localeCompare(b.name)),
    [employees, monthKey, allocations]
  );

  const monthAllocations = useMemo(
    () =>
      (allocations || []).filter((a) =>
        isAllocationInEffectiveMonth(a.weekStartDate, currentMonth)
      ),
    [allocations, currentMonth]
  );

  return {
    currentMonth,
    year,
    month,
    weeks,
    isLoadingMonth,
    goToPrevMonth,
    goToNextMonth,
    goToToday,
    prevMonthDisabled,
    setCurrentMonth,
    filteredEmployees,
    sortedProjects,
    sortedEmployees,
    employeesByProject,
    monthAllocations,
    employees,
    projects,
    allocations,
    absences,
    teamEvents,
    currentUser,
    getEmployeeMonthlyLoad,
  };
}
