import { describe, expect, it } from 'vitest';
import { computeGlobalPlanningInconsistencies } from '@/utils/planningCoherenceCompute';
import type { Allocation, Deadline, Employee, Project } from '@/types';

const employee: Employee = {
  id: 'e1',
  agencyId: 'a1',
  name: 'Ana',
  email: 'ana@example.com',
  role: 'employee',
  isActive: true,
  monthlyCost: 2000,
  defaultWeeklyCapacity: 40,
  workSchedule: {
    monday: 8,
    tuesday: 8,
    wednesday: 8,
    thursday: 8,
    friday: 8,
    saturday: 0,
    sunday: 0,
  },
};

function project(partial: Pick<Project, 'id' | 'name' | 'status'>): Project {
  return {
    id: partial.id,
    agencyId: 'a1',
    clientId: 'c1',
    name: partial.name,
    status: partial.status,
    budgetHours: 40,
    minimumHours: 0,
    monthlyFee: 0,
  };
}

const viewDate = new Date(2026, 7, 15); // agosto 2026

describe('computeGlobalPlanningInconsistencies — proyectos no activos', () => {
  it('no marca como pendiente un completed con deadline fantasma y sin tareas', () => {
    const deadlines: Deadline[] = [
      {
        id: 'd1',
        projectId: 'p-done',
        month: '2026-08',
        employeeHours: { e1: 12 },
        isHidden: false,
      },
    ];

    const result = computeGlobalPlanningInconsistencies({
      deadlines,
      allocations: [],
      projects: [project({ id: 'p-done', name: 'Cerrado', status: 'completed' })],
      employees: [employee],
      viewDate,
      allowedEmployeeIds: null,
      selectedEmployeeId: 'all',
      selectedProjectId: 'all',
      hideProjectSearch: false,
    });

    expect(result).toEqual([]);
  });

  it('sí incluye un completed si tiene tareas planificadas del mes', () => {
    const deadlines: Deadline[] = [
      {
        id: 'd1',
        projectId: 'p-done',
        month: '2026-08',
        employeeHours: { e1: 12 },
        isHidden: false,
      },
    ];
    const allocations: Allocation[] = [
      {
        id: 'alloc1',
        agencyId: 'a1',
        projectId: 'p-done',
        employeeId: 'e1',
        weekStartDate: '2026-08-03',
        hoursAssigned: 4,
        status: 'planned',
        taskName: 'Cierre',
      },
    ];

    const result = computeGlobalPlanningInconsistencies({
      deadlines,
      allocations,
      projects: [project({ id: 'p-done', name: 'Cerrado', status: 'completed' })],
      employees: [employee],
      viewDate,
      allowedEmployeeIds: null,
      selectedEmployeeId: 'all',
      selectedProjectId: 'all',
      hideProjectSearch: false,
    });

    expect(result).toHaveLength(1);
    expect(result[0].projectId).toBe('p-done');
    // El deadline fantasma no actúa como objetivo: diferencia = horas de tarea.
    expect(result[0].totalDeadlineHours).toBe(0);
    expect(result[0].totalPlannedHours).toBe(4);
  });

  it('sigue contrastando deadline vs tareas en proyectos active', () => {
    const deadlines: Deadline[] = [
      {
        id: 'd1',
        projectId: 'p-active',
        month: '2026-08',
        employeeHours: { e1: 10 },
        isHidden: false,
      },
    ];
    const allocations: Allocation[] = [
      {
        id: 'alloc1',
        agencyId: 'a1',
        projectId: 'p-active',
        employeeId: 'e1',
        weekStartDate: '2026-08-03',
        hoursAssigned: 3,
        status: 'planned',
        taskName: 'Trabajo',
      },
    ];

    const result = computeGlobalPlanningInconsistencies({
      deadlines,
      allocations,
      projects: [project({ id: 'p-active', name: 'Activo', status: 'active' })],
      employees: [employee],
      viewDate,
      allowedEmployeeIds: null,
      selectedEmployeeId: 'all',
      selectedProjectId: 'all',
      hideProjectSearch: false,
    });

    expect(result).toHaveLength(1);
    expect(result[0].totalDeadlineHours).toBe(10);
    expect(result[0].totalPlannedHours).toBe(3);
    expect(result[0].totalDifference).toBe(-7);
  });
});
