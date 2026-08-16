import { describe, expect, it } from 'vitest';
import { selectDeadlinesToCopyFromPreviousMonth } from '@/utils/deadlineMonthCopy';
import {
  fixturePreviousMonthDeadlines,
  fixtureProjects,
} from '@/test/fixtures/deadlineCopyFixtures';

describe('fixtures de lectura (repo) — copia de deadlines', () => {
  it('no arrastra el proyecto completed al mes nuevo', () => {
    const result = selectDeadlinesToCopyFromPreviousMonth(fixturePreviousMonthDeadlines, {
      existingProjectIds: [],
      projects: fixtureProjects,
    });
    expect(result.toCopy.map((d) => d.projectId)).toEqual(['fix-active-1']);
    expect(result.skippedInactiveProject).toBe(1);
  });
});
