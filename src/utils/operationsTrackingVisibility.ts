import type { Allocation, Deadline, Project } from '@/types';
import { isAllocationInEffectiveMonth } from '@/utils/dateUtils';
import { getEffectiveCompletedHours } from '@/utils/hoursTracking';

export type MonthHoursByProjectEmployee = Record<string, Record<string, { planned: number; computed: number }>>;

export function buildMonthAllocationsByProjectAndEmployee(params: {
  allocations: Allocation[];
  viewDate: Date;
  allowedEmployeeIds?: Set<string> | null;
  hoursTrackingPreference?: 'actual' | 'computed' | null;
}): MonthHoursByProjectEmployee {
  const { allocations, viewDate, allowedEmployeeIds, hoursTrackingPreference } = params;

  const monthAllocations = allocations.filter(
    (a) =>
      isAllocationInEffectiveMonth(a.weekStartDate, viewDate) &&
      (!allowedEmployeeIds || allowedEmployeeIds.has(a.employeeId)),
  );

  const effectivePreference =
    hoursTrackingPreference === 'actual' || hoursTrackingPreference === 'computed'
      ? hoursTrackingPreference
      : undefined;

  const allocationsByProjectAndEmployee: MonthHoursByProjectEmployee = {};

  monthAllocations.forEach((a) => {
    if (!allocationsByProjectAndEmployee[a.projectId]) {
      allocationsByProjectAndEmployee[a.projectId] = {};
    }
    if (!allocationsByProjectAndEmployee[a.projectId][a.employeeId]) {
      allocationsByProjectAndEmployee[a.projectId][a.employeeId] = { planned: 0, computed: 0 };
    }
    if (a.status === 'completed') {
      allocationsByProjectAndEmployee[a.projectId][a.employeeId].computed += getEffectiveCompletedHours(
        a,
        effectivePreference,
      );
    } else {
      allocationsByProjectAndEmployee[a.projectId][a.employeeId].planned += a.hoursAssigned || 0;
    }
  });

  return allocationsByProjectAndEmployee;
}

export function sumDeadlineEmployeeHours(employeeHours: Record<string, number> | undefined): number {
  if (!employeeHours) return 0;
  return Object.values(employeeHours).reduce((sum, hrs) => sum + (Number(hrs) || 0), 0);
}

export function sumProjectTaskHoursFromAgg(
  projectId: string,
  agg: MonthHoursByProjectEmployee,
): { planned: number; computed: number } {
  const empAllocs = agg[projectId];
  if (!empAllocs) return { planned: 0, computed: 0 };

  return Object.values(empAllocs).reduce(
    (acc, a) => ({
      planned: acc.planned + a.planned,
      computed: acc.computed + a.computed,
    }),
    { planned: 0, computed: 0 },
  );
}

/**
 * Visibilidad en seguimiento operativo / coherencia.
 * - Activos: siempre.
 * - Completados / archivados: solo si hay tareas del mes (planificadas o computadas).
 *   Un deadline copiado sin tareas no debe aparecer como “horas pendientes”.
 */
export function shouldIncludeProjectInOperationsTracking(
  project: Pick<Project, 'status'> | undefined,
  params: {
    deadlineHours: number;
    plannedHours: number;
    computedHours: number;
  },
): boolean {
  if (!project) return false;
  if (project.status === 'active') return true;
  return params.plannedHours + params.computedHours > 0;
}

export function shouldIncludeProjectIdInOperationsTracking(params: {
  projectId: string;
  projects: Project[];
  deadlines: Pick<Deadline, 'projectId' | 'isHidden' | 'employeeHours'>[];
  allocationsByProjectAndEmployee: MonthHoursByProjectEmployee;
}): boolean {
  const project = params.projects.find((p) => p.id === params.projectId);
  const deadline = params.deadlines.find((d) => !d.isHidden && d.projectId === params.projectId);
  const { planned, computed } = sumProjectTaskHoursFromAgg(params.projectId, params.allocationsByProjectAndEmployee);

  return shouldIncludeProjectInOperationsTracking(project, {
    deadlineHours: sumDeadlineEmployeeHours(deadline?.employeeHours),
    plannedHours: planned,
    computedHours: computed,
  });
}
