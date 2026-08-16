/**
 * Misma lógica que src/utils/planningCoherenceCompute.ts (coherencia global / deadlines).
 */

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

export interface AllocForCoherence {
  projectId: string;
  employeeId: string;
  weekStartDate: string;
  hoursAssigned: number;
  status: string;
  hoursActual: number | null;
  hoursComputed: number | null;
}

export interface DeadlineForCoherence {
  projectId: string;
  month: string;
  employeeHours: Record<string, number>;
  isHidden?: boolean;
  budgetOverride?: number | null;
}

export interface ProjectForCoherence {
  id: string;
  name: string;
  budgetHours: number;
  minimumHours: number;
  status?: string;
}

export interface EmployeeForCoherence {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function parseLocalYmd(ymd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return new Date(NaN);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function isAllocationInEffectiveMonth(weekStartDate: string, viewMonth: Date): boolean {
  try {
    const allocWeekStart = parseLocalYmd(weekStartDate);
    if (Number.isNaN(allocWeekStart.getTime())) return false;
    return (
      allocWeekStart.getFullYear() === viewMonth.getFullYear() &&
      allocWeekStart.getMonth() === viewMonth.getMonth()
    );
  } catch {
    return false;
  }
}

function getEffectiveCompletedHours(
  alloc: AllocForCoherence,
  preference: "actual" | "computed" | undefined,
): number {
  if (preference === "actual") {
    return alloc.hoursActual ?? 0;
  }
  return alloc.hoursComputed ?? 0;
}

function shouldIncludeProjectInOperationsTracking(
  status: string | undefined,
  deadlineHours: number,
  plannedHours: number,
  computedHours: number,
): boolean {
  if (status === "active") return true;
  // Completados/archivados: solo con tareas del mes (no deadline fantasma sin planner).
  return plannedHours + computedHours > 0;
}

export function computePlanningCoherenceInconsistencies(params: {
  deadlines: DeadlineForCoherence[];
  allocations: AllocForCoherence[];
  projects: ProjectForCoherence[];
  employees: EmployeeForCoherence[];
  viewDate: Date;
  hoursTrackingPreference?: "actual" | "computed" | null;
}): Inconsistency[] {
  const { deadlines, allocations, projects, employees, viewDate, hoursTrackingPreference } = params;

  const monthAllocations = allocations.filter((a) => isAllocationInEffectiveMonth(a.weekStartDate, viewDate));

  const allocationsByProjectAndEmployee: Record<string, Record<string, { planned: number; computed: number }>> =
    {};

  const effectivePreference =
    hoursTrackingPreference === "actual" || hoursTrackingPreference === "computed"
      ? hoursTrackingPreference
      : undefined;

  monthAllocations.forEach((a) => {
    if (!allocationsByProjectAndEmployee[a.projectId]) {
      allocationsByProjectAndEmployee[a.projectId] = {};
    }
    if (!allocationsByProjectAndEmployee[a.projectId][a.employeeId]) {
      allocationsByProjectAndEmployee[a.projectId][a.employeeId] = { planned: 0, computed: 0 };
    }
    if (a.status === "completed") {
      allocationsByProjectAndEmployee[a.projectId][a.employeeId].computed += getEffectiveCompletedHours(
        a,
        effectivePreference,
      );
    } else {
      allocationsByProjectAndEmployee[a.projectId][a.employeeId].planned += a.hoursAssigned || 0;
    }
  });

  const projectInconsistencies: Record<string, Inconsistency> = {};

  deadlines.forEach((deadline) => {
    if (deadline.isHidden) return;

    const projectId = deadline.projectId;
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    if (project.status !== "active") return;

    const employeeMap = new Map<string, InconsistencyEmployeeItem>();
    let totalDeadline = 0;
    let totalPlanned = 0;
    let totalComputed = 0;

    Object.entries(deadline.employeeHours).forEach(([empId, deadlineHrs]) => {
      const emp = employees.find((e) => e.id === empId);
      if (!emp) return;
      const empAllocs = allocationsByProjectAndEmployee[projectId]?.[empId] || { planned: 0, computed: 0 };
      const total = empAllocs.planned + empAllocs.computed;
      const diff = round2(total - deadlineHrs);

      employeeMap.set(empId, {
        employeeId: empId,
        employeeName: emp.name,
        avatarUrl: emp.avatarUrl ?? undefined,
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
        const total = allocs.planned + allocs.computed;

        employeeMap.set(empId, {
          employeeId: empId,
          employeeName: emp.name,
          avatarUrl: emp.avatarUrl ?? undefined,
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
        ? Number(deadline.budgetOverride)
        : project.budgetHours || 0;

    if (
      !shouldIncludeProjectInOperationsTracking(
        project.status,
        totalDeadline,
        totalPlanned,
        totalComputed,
      )
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
        employeeInconsistencies.push({
          employeeId: empId,
          employeeName: emp.name,
          avatarUrl: emp.avatarUrl ?? undefined,
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

  return Object.values(projectInconsistencies).sort(
    (a, b) => Math.abs(b.totalDifference) - Math.abs(a.totalDifference),
  );
}
