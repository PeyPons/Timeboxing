import { format } from 'date-fns';
import type { Allocation, Deadline, Employee, GlobalAssignment } from '@/types';
import { isAllocationInEffectiveMonth } from '@/utils/dateUtils';

type OperationalWorkloadDeadline = Pick<Deadline, 'month' | 'employeeHours'>;

function monthKeyToViewDate(monthKey: string): Date {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return new Date();
  return new Date(y, m - 1, 1);
}

/**
 * Empleados con carga operativa en un mes concreto (para mostrar inactivos sin romper métricas):
 * - horas > 0 en algún deadline del mes;
 * - horas de asignación global de Deadlines que les afecte;
 * - al menos una allocation del planificador efectiva en ese mes.
 */
export function employeeIdsWithOperationalWorkloadInMonth(
  monthKey: string,
  ctx: {
    deadlines?: OperationalWorkloadDeadline[];
    globalAssignments?: GlobalAssignment[];
    allocations?: Allocation[];
    /** Si se pasa, solo se consideran empleados de este universo (p. ej. vista departamento). */
    limitToEmployeeIds?: Set<string>;
  }
): Set<string> {
  const { deadlines = [], globalAssignments = [], allocations = [], limitToEmployeeIds } = ctx;
  const ids = new Set<string>();
  const inUniverse = (id: string) => !limitToEmployeeIds || limitToEmployeeIds.has(id);

  for (const d of deadlines) {
    if (d.month !== monthKey) continue;
    for (const [empId, raw] of Object.entries(d.employeeHours ?? {})) {
      const h = Number(raw) || 0;
      if (h > 0 && inUniverse(empId)) ids.add(empId);
    }
  }

  const viewMonth = monthKeyToViewDate(monthKey);
  for (const g of globalAssignments) {
    if (g.month !== monthKey) continue;
    if ((g.hours || 0) <= 0) continue;
    if (g.affectsAll) {
      if (limitToEmployeeIds) {
        limitToEmployeeIds.forEach((id) => ids.add(id));
      }
      // Sin límite: no podemos expandir a "todos los empleados" sin la lista; el caller debe pasar limitToEmployeeIds
    } else {
      for (const id of g.affectedEmployeeIds ?? []) {
        if (inUniverse(id)) ids.add(id);
      }
    }
  }

  for (const a of allocations) {
    if (!inUniverse(a.employeeId)) continue;
    if (!isAllocationInEffectiveMonth(a.weekStartDate, viewMonth)) continue;
    ids.add(a.employeeId);
  }

  return ids;
}

/**
 * Lista de empleados para selectores / métricas del mes: siempre los activos;
 * más inactivos que tengan carga en ese mes (deadlines, globales o planificador).
 */
export function filterEmployeesForOperationalMonth(
  employees: Employee[],
  monthKey: string,
  ctx: {
    deadlines?: OperationalWorkloadDeadline[];
    globalAssignments?: GlobalAssignment[];
    allocations?: Allocation[];
  }
): Employee[] {
  const universe = new Set(employees.map((e) => e.id));
  const withWorkload = employeeIdsWithOperationalWorkloadInMonth(monthKey, {
    ...ctx,
    limitToEmployeeIds: universe,
  });
  return employees.filter((e) => e.isActive || withWorkload.has(e.id));
}

/**
 * Empleados con al menos una asignación > 0 en algún deadline del mes (solo horas de proyecto),
 * excluyendo proyectos ocultos en la vista. No cuenta asignaciones globales ni planificador.
 */
export function employeeIdsWithDeadlineProjectHoursInMonth(
  monthKey: string,
  deadlines: Deadline[],
  hiddenProjectIds: Set<string>
): Set<string> {
  const ids = new Set<string>();
  for (const d of deadlines) {
    if (d.month !== monthKey) continue;
    if (hiddenProjectIds.has(d.projectId) || d.isHidden) continue;
    for (const [empId, raw] of Object.entries(d.employeeHours ?? {})) {
      if ((Number(raw) || 0) > 0) ids.add(empId);
    }
  }
  return ids;
}

/**
 * Lista para Deadlines: activos + inactivos con horas en algún proyecto del mes.
 * No incluye inactivos solo por planificador, asignación global «afecta a todos» ni globales sin horas en deadlines.
 */
export function filterEmployeesForDeadlinesMonth(
  employees: Employee[],
  monthKey: string,
  deadlines: Deadline[],
  hiddenProjectIds: Set<string>
): Employee[] {
  const withProjectHours = employeeIdsWithDeadlineProjectHoursInMonth(
    monthKey,
    deadlines,
    hiddenProjectIds
  );
  return employees.filter((e) => e.isActive || withProjectHours.has(e.id));
}

/** Variante cuando el mes viene como `Date` (p. ej. rentabilidad). */
export function filterEmployeesForOperationalMonthDate(
  employees: Employee[],
  month: Date,
  ctx: {
    deadlines?: OperationalWorkloadDeadline[];
    globalAssignments?: GlobalAssignment[];
    allocations?: Allocation[];
  }
): Employee[] {
  return filterEmployeesForOperationalMonth(employees, format(month, 'yyyy-MM'), ctx);
}
