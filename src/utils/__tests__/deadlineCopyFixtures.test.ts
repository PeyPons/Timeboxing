import { describe, expect, it } from 'vitest';
import {
  fixtureActiveProject,
  fixtureClosedProject,
  fixturePreviousMonthDeadlines,
  fixtureProjects,
} from '@/test/fixtures/deadlineCopyFixtures';

describe('fixtures de lectura (repo)', () => {
  it('incluye proyecto active y completed sin PII real', () => {
    expect(fixtureProjects).toHaveLength(2);
    expect(fixtureActiveProject.status).toBe('active');
    expect(fixtureClosedProject.status).toBe('completed');
    expect(fixtureActiveProject.name).not.toMatch(/@/);
  });

  it('deadlines del mes anterior apuntan a esos proyectos', () => {
    const ids = new Set(fixtureProjects.map((p) => p.id));
    for (const d of fixturePreviousMonthDeadlines) {
      expect(ids.has(d.projectId)).toBe(true);
    }
    expect(fixturePreviousMonthDeadlines.some((d) => d.projectId === fixtureClosedProject.id)).toBe(
      true
    );
  });
});
