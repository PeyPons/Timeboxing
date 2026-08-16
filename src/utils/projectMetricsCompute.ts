import {
  parseISO,
  isBefore,
  isAfter,
  startOfMonth,
  endOfMonth,
  startOfDay,
  format,
  eachDayOfInterval,
  isWeekend,
} from 'date-fns';
import type { Allocation, Project, Employee, Client, Deadline, GlobalAssignment } from '@/types';
import { employeeIdsWithOperationalWorkloadInMonth } from '@/utils/employeeAssignmentVisibility';
import {
  getEffectiveBudgetForMonth,
  getEffectiveMinimum,
  getEffectiveMonthlyFee,
} from '@/utils/budgetUtils';
import { getEffectiveAllocationHours } from '@/utils/hoursTracking';

export interface ProjectMetrics {
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  planned: number;
  actual: number;
  computed: number;
  budget: number;
  minimum: number;
  monthlyFee: number;
  hourlyRate: number;
  hoursValue: number;
  progressOperational: number;
  progressBilling: number;
  available: number;
  isPacing: boolean;
  isOverBudget: boolean;
}

export interface EmployeeMetrics {
  employeeId: string;
  employeeName: string;
  totalPlanned: number;
  totalActual: number;
  totalComputed: number;
  capacity: number;
  loadPercentage: number;
  status: 'empty' | 'healthy' | 'warning' | 'overload';
  projectBreakdown: { projectId: string; projectName: string; hours: number; actual: number }[];
}

export interface ProjectMetricsDeadline {
  projectId: string;
  month: string;
  budgetOverride?: number;
}

export interface ComputeProjectMetricsParams {
  allocations: Allocation[];
  projects: Project[];
  clients: Client[];
  employees: Employee[];
  month: Date;
  /** Preferencia horas; si es null/undefined se usa lógica por defecto de getEffectiveAllocationHours */
  hoursTrackingPreference?: 'actual' | 'computed' | null;
  deadlines?: ProjectMetricsDeadline[];
  projectId?: string;
  employeeId?: string;
  clientId?: string;
  /**
   * Día de referencia para "isPacing" (progreso esperado del mes).
   * Por defecto: hoy si `month` es el mes calendario actual; `endOfMonth(month)` si el mes ya terminó;
   * `startOfMonth(month)` si el mes es futuro (progreso esperado 0 %). Override solo para casos especiales (p. ej. informes).
   */
  pacingReferenceDate?: Date;
  /** Capacidad neta del mes (p. ej. calendario − ausencias − eventos). Si no se pasa, se usa capacidad teórica 4.33 × semanal. */
  getEmployeeMonthlyCapacity?: (employee: Employee, month: Date) => number;
  /**
   * Incluir filas de empleado inactivo si tienen carga en Deadlines / globales / planificador este mes.
   * Si no se pasa `deadlinesEmployeeVisibility`, solo cuentan allocations (y globales vacías).
   */
  deadlinesEmployeeVisibility?: Array<Pick<Deadline, 'month' | 'employeeHours'>>;
  globalAssignmentsEmployeeVisibility?: GlobalAssignment[];
}

export interface ComputeProjectMetricsResult {
  projectMetrics: ProjectMetrics[];
  employeeMetrics: EmployeeMetrics[];
  totals: {
    totalPlanned: number;
    totalActual: number;
    totalComputed: number;
    totalBudget: number;
    totalFee: number;
    avgProgress: number;
  };
  getProjectMetrics: (projectId: string) => ProjectMetrics | undefined;
  getEmployeeMetrics: (employeeId: string) => EmployeeMetrics | undefined;
}

function getWorkingDaysInPeriod(start: Date, end: Date): number {
  const days = eachDayOfInterval({ start, end });
  return days.filter((d) => !isWeekend(d)).length;
}

function prorateHoursForMonth(
  allocation: Allocation,
  month: Date,
  preference?: 'computed' | 'actual'
): { planned: number; actual: number; computed: number } {
  const weekStart = parseISO(allocation.weekStartDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);

  if (!isBefore(weekStart, monthStart) && !isAfter(weekEnd, monthEnd)) {
    return {
      planned: allocation.hoursAssigned || 0,
      actual: allocation.hoursActual || 0,
      computed: getEffectiveAllocationHours(allocation, preference),
    };
  }

  const overlapStart = isBefore(weekStart, monthStart) ? monthStart : weekStart;
  const overlapEnd = isAfter(weekEnd, monthEnd) ? monthEnd : weekEnd;

  const overlapDays = getWorkingDaysInPeriod(overlapStart, overlapEnd);
  const totalDays = getWorkingDaysInPeriod(weekStart, weekEnd);

  if (totalDays === 0) return { planned: 0, actual: 0, computed: 0 };

  const ratio = overlapDays / totalDays;

  return {
    planned: (allocation.hoursAssigned || 0) * ratio,
    actual: (allocation.hoursActual || 0) * ratio,
    computed: getEffectiveAllocationHours(allocation, preference) * ratio,
  };
}

/**
 * Cálculo puro de métricas por proyecto y empleado para un mes (misma lógica que useProjectMetrics).
 */
export function computeProjectMetricsForMonth(
  params: ComputeProjectMetricsParams
): ComputeProjectMetricsResult {
  const {
    allocations,
    projects,
    clients,
    employees,
    month,
    hoursTrackingPreference,
    deadlines,
    projectId,
    employeeId,
    clientId,
    pacingReferenceDate,
    getEmployeeMonthlyCapacity,
    deadlinesEmployeeVisibility,
    globalAssignmentsEmployeeVisibility,
  } = params;

  const preference =
    hoursTrackingPreference === 'actual' || hoursTrackingPreference === 'computed'
      ? hoursTrackingPreference
      : undefined;

  const today = new Date();
  const monthEnd = endOfMonth(month);
  const monthKey = format(month, 'yyyy-MM');

  const monthStart = startOfMonth(month);
  const expectedProgressMonth = (() => {
    const daysInMonth = monthEnd.getDate();
    if (pacingReferenceDate) {
      return (pacingReferenceDate.getDate() / daysInMonth) * 100;
    }
    const dayT = startOfDay(today);
    if (isBefore(dayT, monthStart)) {
      return 0;
    }
    if (isAfter(dayT, monthEnd)) {
      return 100;
    }
    return (dayT.getDate() / daysInMonth) * 100;
  })();
  const monthAllocations = allocations.filter((a) => {
    const weekStart = parseISO(a.weekStartDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return !isAfter(weekStart, monthEnd) && !isBefore(weekEnd, monthStart);
  });

  const workloadEmployeeIds = employeeIdsWithOperationalWorkloadInMonth(monthKey, {
    deadlines: deadlinesEmployeeVisibility ?? [],
    globalAssignments: globalAssignmentsEmployeeVisibility ?? [],
    allocations: monthAllocations,
    limitToEmployeeIds: new Set(employees.map((e) => e.id)),
  });

  let filteredAllocations = monthAllocations;
  if (projectId) {
    filteredAllocations = filteredAllocations.filter((a) => a.projectId === projectId);
  }
  if (employeeId) {
    filteredAllocations = filteredAllocations.filter((a) => a.employeeId === employeeId);
  }
  if (clientId) {
    const clientProjects = projects.filter((p) => p.clientId === clientId).map((p) => p.id);
    filteredAllocations = filteredAllocations.filter((a) => clientProjects.includes(a.projectId));
  }

  const projectMetricsMap = new Map<string, ProjectMetrics>();

  for (const project of projects) {
    if (projectId && project.id !== projectId) continue;
    if (clientId && project.clientId !== clientId) continue;

    const client = clients.find((c) => c.id === project.clientId);
    const projectAllocations = filteredAllocations.filter((a) => a.projectId === project.id);

    let totalPlanned = 0;
    let totalActual = 0;
    let totalComputed = 0;

    for (const allocation of projectAllocations) {
      const prorated = prorateHoursForMonth(allocation, month, preference);
      totalPlanned += prorated.planned;
      totalActual += prorated.actual;
      totalComputed += prorated.computed;
    }

    const deadlineForMonth = deadlines?.find((d) => d.projectId === project.id && d.month === monthKey);
    const budget = getEffectiveBudgetForMonth(project, deadlineForMonth, month);
    const minimum = getEffectiveMinimum(project, deadlineForMonth);
    const monthlyFee = getEffectiveMonthlyFee(project, month);
    const hourlyRate = budget > 0 ? monthlyFee / budget : 0;
    const hoursValue = totalComputed * hourlyRate;

    const progressOperational = budget > 0 ? (totalComputed / budget) * 100 : 0;
    const progressBilling = monthlyFee > 0 ? (hoursValue / monthlyFee) * 100 : 0;

    const isPacing = progressOperational >= expectedProgressMonth * 0.8;

    projectMetricsMap.set(project.id, {
      projectId: project.id,
      projectName: project.name,
      clientId: project.clientId,
      clientName: client?.name || 'Unknown',
      planned: Math.round(totalPlanned * 100) / 100,
      actual: Math.round(totalActual * 100) / 100,
      computed: Math.round(totalComputed * 100) / 100,
      budget,
      minimum,
      monthlyFee,
      hourlyRate: Math.round(hourlyRate * 100) / 100,
      hoursValue: Math.round(hoursValue * 100) / 100,
      progressOperational: Math.round(progressOperational * 10) / 10,
      progressBilling: Math.round(progressBilling * 10) / 10,
      available: Math.round((budget - totalComputed) * 100) / 100,
      isPacing,
      isOverBudget: totalComputed > budget,
    });
  }

  const employeeMetricsMap = new Map<string, EmployeeMetrics>();

  for (const employee of employees) {
    if (employeeId && employee.id !== employeeId) continue;
    if (!employee.isActive && !workloadEmployeeIds.has(employee.id)) continue;

    const empAllocations = filteredAllocations.filter((a) => a.employeeId === employee.id);

    let totalPlanned = 0;
    let totalActual = 0;
    let totalComputed = 0;
    const projectBreakdown: { projectId: string; projectName: string; hours: number; actual: number }[] = [];

    const projectComputed = new Map<string, number>();
    const projectActual = new Map<string, number>();

    for (const allocation of empAllocations) {
      const prorated = prorateHoursForMonth(allocation, month, preference);
      totalPlanned += prorated.planned;
      totalActual += prorated.actual;
      totalComputed += prorated.computed;

      const curC = projectComputed.get(allocation.projectId) || 0;
      projectComputed.set(allocation.projectId, curC + prorated.computed);
      const curA = projectActual.get(allocation.projectId) || 0;
      projectActual.set(allocation.projectId, curA + prorated.actual);
    }

    const allProjIds = new Set([...projectComputed.keys(), ...projectActual.keys()]);
    for (const projId of allProjIds) {
      const project = projects.find((p) => p.id === projId);
      projectBreakdown.push({
        projectId: projId,
        projectName: project?.name || 'Unknown',
        hours: Math.round((projectComputed.get(projId) || 0) * 100) / 100,
        actual: Math.round((projectActual.get(projId) || 0) * 100) / 100,
      });
    }

    const capacity =
      getEmployeeMonthlyCapacity?.(employee, month) ??
      (employee.defaultWeeklyCapacity || 40) * 4.33;
    const loadPercentage = capacity > 0 ? (totalComputed / capacity) * 100 : 0;

    let status: 'empty' | 'healthy' | 'warning' | 'overload' = 'empty';
    if (loadPercentage === 0) status = 'empty';
    else if (loadPercentage <= 85) status = 'healthy';
    else if (loadPercentage <= 100) status = 'warning';
    else status = 'overload';

    employeeMetricsMap.set(employee.id, {
      employeeId: employee.id,
      employeeName: employee.name,
      totalPlanned: Math.round(totalPlanned * 100) / 100,
      totalActual: Math.round(totalActual * 100) / 100,
      totalComputed: Math.round(totalComputed * 100) / 100,
      capacity: Math.round(capacity * 100) / 100,
      loadPercentage: Math.round(loadPercentage * 10) / 10,
      status,
      projectBreakdown,
    });
  }

  const projectMetrics = Array.from(projectMetricsMap.values());
  const employeeMetrics = Array.from(employeeMetricsMap.values());

  const totals = {
    totalPlanned: projectMetrics.reduce((sum, p) => sum + p.planned, 0),
    totalActual: projectMetrics.reduce((sum, p) => sum + p.actual, 0),
    totalComputed: projectMetrics.reduce((sum, p) => sum + p.computed, 0),
    totalBudget: projectMetrics.reduce((sum, p) => sum + p.budget, 0),
    totalFee: projectMetrics.reduce((sum, p) => sum + p.monthlyFee, 0),
    avgProgress:
      projectMetrics.length > 0
        ? projectMetrics.reduce((sum, p) => sum + p.progressOperational, 0) / projectMetrics.length
        : 0,
  };

  return {
    projectMetrics,
    employeeMetrics,
    totals,
    getProjectMetrics: (id: string) => projectMetricsMap.get(id),
    getEmployeeMetrics: (id: string) => employeeMetricsMap.get(id),
  };
}
