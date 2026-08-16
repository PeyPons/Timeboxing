import type { Allocation, Deadline, Employee, Project } from '@/types';
import { round2 } from '@/utils/numbers';
import {
  buildMonthAllocationsByProjectAndEmployee,
  shouldIncludeProjectInOperationsTracking,
} from '@/utils/operationsTrackingVisibility';

export interface InconsistencyEmployeeItem {
  employeeId: string;
  employeeName: string;
  avatarUrl?: string;
  deadlineHours: number;
  plannedHours: number;
  computedHours: number;
  difference: number;
  hasDeadline: boolean;
}

export interface Inconsistency {
  projectId: string;
  projectName: string;
  employees: InconsistencyEmployeeItem[];
  totalDeadlineHours: number;
  totalPlannedHours: number;
  totalComputedHours: number;
  totalDifference: number;
  budgetHours: number;
  minimumHours: number;
}

export function computeGlobalPlanningInconsistencies(params: {
  deadlines: Deadline[];
  allocations: Allocation[];
  projects: Project[];
  employees: Employee[];
  viewDate: Date;
  allowedEmployeeIds: Set<string> | null;
  selectedEmployeeId: string;
  selectedProjectId: string;
  hideProjectSearch: boolean;
  hoursTrackingPreference?: 'actual' | 'computed' | null;
}): Inconsistency[] {
  const {
    deadlines,
    allocations,
    projects,
    employees,
    viewDate,
    allowedEmployeeIds,
    selectedEmployeeId,
    selectedProjectId,
    hideProjectSearch,
    hoursTrackingPreference,
  } = params;

  const allocationsByProjectAndEmployee = buildMonthAllocationsByProjectAndEmployee({
    allocations,
    viewDate,
    allowedEmployeeIds,
    hoursTrackingPreference,
  });

  const projectInconsistencies: Record<string, Inconsistency> = {};

  deadlines.forEach((deadline) => {
    if (deadline.isHidden) return;

    const projectId = deadline.projectId;
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    // No contrastar contra deadline de proyectos cerrados/archivados (p. ej. copiados por error).
    if (project.status !== 'active') return;

    const employeeMap = new Map<string, InconsistencyEmployeeItem>();
    let totalDeadline = 0;
    let totalPlanned = 0;
    let totalComputed = 0;

    Object.entries(deadline.employeeHours).forEach(([empId, deadlineHrs]) => {
      const emp = employees.find((e) => e.id === empId);
      if (!emp) return;
      if (allowedEmployeeIds && !allowedEmployeeIds.has(empId)) return;
      const empAllocs = allocationsByProjectAndEmployee[projectId]?.[empId] || { planned: 0, computed: 0 };
      const total = empAllocs.planned + empAllocs.computed;
      const diff = round2(total - deadlineHrs);

      employeeMap.set(empId, {
        employeeId: empId,
        employeeName: emp.name,
        avatarUrl: emp.avatarUrl,
        deadlineHours: deadlineHrs,
        plannedHours: round2(empAllocs.planned),
        computedHours: round2(empAllocs.computed),
        difference: diff,
        hasDeadline: true,
      });
      totalDeadline += deadlineHrs;
      totalPlanned += empAllocs.planned;
      totalComputed += empAllocs.computed;
    });

    Object.entries(allocationsByProjectAndEmployee[projectId] || {}).forEach(([empId, allocs]) => {
      if (employeeMap.has(empId)) return;
      if (!deadline.employeeHours[empId] && (allocs.planned > 0 || allocs.computed > 0)) {
        const emp = employees.find((e) => e.id === empId);
        if (!emp) return;
        if (allowedEmployeeIds && !allowedEmployeeIds.has(empId)) return;
        const total = allocs.planned + allocs.computed;

        employeeMap.set(empId, {
          employeeId: empId,
          employeeName: emp.name,
          avatarUrl: emp.avatarUrl,
          deadlineHours: 0,
          plannedHours: round2(allocs.planned),
          computedHours: round2(allocs.computed),
          difference: round2(total),
          hasDeadline: false,
        });
        totalPlanned += allocs.planned;
        totalComputed += allocs.computed;
      }
    });

    const effectiveBudget =
      deadline.budgetOverride !== undefined && deadline.budgetOverride !== null
        ? deadline.budgetOverride
        : project.budgetHours || 0;

    if (
      !shouldIncludeProjectInOperationsTracking(project, {
        deadlineHours: totalDeadline,
        plannedHours: totalPlanned,
        computedHours: totalComputed,
      })
    ) {
      return;
    }

    projectInconsistencies[projectId] = {
      projectId,
      projectName: project.name,
      employees: Array.from(employeeMap.values()),
      totalDeadlineHours: totalDeadline,
      totalPlannedHours: round2(totalPlanned),
      totalComputedHours: round2(totalComputed),
      totalDifference: round2(totalPlanned + totalComputed - totalDeadline),
      budgetHours: effectiveBudget,
      minimumHours: project.minimumHours || 0,
    };
  });

  Object.entries(allocationsByProjectAndEmployee).forEach(([projectId, empAllocs]) => {
    if (projectInconsistencies[projectId]) return;
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;

    const employeeInconsistencies: InconsistencyEmployeeItem[] = [];
    let totalPlanned = 0;
    let totalComputed = 0;

    Object.entries(empAllocs).forEach(([empId, allocs]) => {
      const total = allocs.planned + allocs.computed;
      if (total > 0) {
        const emp = employees.find((e) => e.id === empId);
        if (!emp) return;
        if (allowedEmployeeIds && !allowedEmployeeIds.has(empId)) return;
        employeeInconsistencies.push({
          employeeId: empId,
          employeeName: emp.name,
          avatarUrl: emp.avatarUrl,
          deadlineHours: 0,
          plannedHours: round2(allocs.planned),
          computedHours: round2(allocs.computed),
          difference: round2(total),
          hasDeadline: false,
        });
        totalPlanned += allocs.planned;
        totalComputed += allocs.computed;
      }
    });

    if (employeeInconsistencies.length > 0) {
      projectInconsistencies[projectId] = {
        projectId,
        projectName: project.name,
        employees: employeeInconsistencies,
        totalDeadlineHours: 0,
        totalPlannedHours: round2(totalPlanned),
        totalComputedHours: round2(totalComputed),
        totalDifference: round2(totalPlanned + totalComputed),
        budgetHours: project.budgetHours || 0,
        minimumHours: project.minimumHours || 0,
      };
    }
  });

  let filtered = Object.values(projectInconsistencies);

  if (!hideProjectSearch && selectedProjectId !== 'all') {
    filtered = filtered.filter((proj) => proj.projectId === selectedProjectId);
  }

  if (selectedEmployeeId !== 'all') {
    filtered = filtered
      .map((proj) => ({
        ...proj,
        employees: proj.employees.filter((emp) => emp.employeeId === selectedEmployeeId),
      }))
      .filter((proj) => proj.employees.length > 0);
  }

  return filtered.sort((a, b) => Math.abs(b.totalDifference) - Math.abs(a.totalDifference));
}
