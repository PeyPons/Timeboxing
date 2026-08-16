import { describe, expect, it } from 'vitest';
import { selectDeadlinesToCopyFromPreviousMonth } from '@/utils/deadlineMonthCopy';

describe('selectDeadlinesToCopyFromPreviousMonth', () => {
  const projects = [
    { id: 'p-active', status: 'active' as const },
    { id: 'p-done', status: 'completed' as const },
    { id: 'p-arch', status: 'archived' as const },
  ];

  it('copia solo proyectos active que no existen aún en el mes destino', () => {
    const previous = [
      { projectId: 'p-active', employeeHours: { e1: 10 } },
      { projectId: 'p-done', employeeHours: { e1: 8 } },
      { projectId: 'p-arch', employeeHours: { e2: 4 } },
      { projectId: 'p-gone', employeeHours: { e1: 2 } },
    ];

    const result = selectDeadlinesToCopyFromPreviousMonth(previous, {
      existingProjectIds: [],
      projects,
    });

    expect(result.toCopy.map((d) => d.projectId)).toEqual(['p-active']);
    expect(result.skippedInactiveProject).toBe(2);
    expect(result.skippedMissingProject).toBe(1);
    expect(result.skippedExisting).toBe(0);
  });

  it('omite active si ya hay deadline en el mes destino', () => {
    const previous = [{ projectId: 'p-active', employeeHours: { e1: 10 } }];
    const result = selectDeadlinesToCopyFromPreviousMonth(previous, {
      existingProjectIds: ['p-active'],
      projects,
    });
    expect(result.toCopy).toEqual([]);
    expect(result.skippedExisting).toBe(1);
  });
});
