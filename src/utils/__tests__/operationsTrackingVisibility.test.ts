import { describe, expect, it } from 'vitest';
import { shouldIncludeProjectInOperationsTracking } from '@/utils/operationsTrackingVisibility';

describe('shouldIncludeProjectInOperationsTracking', () => {
  it('incluye siempre proyectos active', () => {
    expect(
      shouldIncludeProjectInOperationsTracking(
        { status: 'active' },
        { deadlineHours: 0, plannedHours: 0, computedHours: 0 }
      )
    ).toBe(true);
  });

  it('excluye completed/archived solo con deadline (sin tareas)', () => {
    expect(
      shouldIncludeProjectInOperationsTracking(
        { status: 'completed' },
        { deadlineHours: 12, plannedHours: 0, computedHours: 0 }
      )
    ).toBe(false);
    expect(
      shouldIncludeProjectInOperationsTracking(
        { status: 'archived' },
        { deadlineHours: 8, plannedHours: 0, computedHours: 0 }
      )
    ).toBe(false);
  });

  it('incluye completed/archived si hay tareas del mes', () => {
    expect(
      shouldIncludeProjectInOperationsTracking(
        { status: 'completed' },
        { deadlineHours: 0, plannedHours: 2, computedHours: 0 }
      )
    ).toBe(true);
    expect(
      shouldIncludeProjectInOperationsTracking(
        { status: 'archived' },
        { deadlineHours: 0, plannedHours: 0, computedHours: 3 }
      )
    ).toBe(true);
  });
});
