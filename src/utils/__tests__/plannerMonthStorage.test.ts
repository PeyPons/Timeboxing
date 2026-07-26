import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { format, startOfMonth } from 'date-fns';
import {
  parseStoredPlannerMonth,
  readStoredPlannerMonth,
  writeStoredPlannerMonth,
  PLANNER_DATE_STORAGE_KEY,
} from '@/utils/plannerMonthStorage';

describe('parseStoredPlannerMonth', () => {
  it('acepta yyyy-MM', () => {
    const d = parseStoredPlannerMonth('2026-03');
    expect(d).not.toBeNull();
    expect(format(d!, 'yyyy-MM')).toBe('2026-03');
  });

  it('acepta fecha ISO con día 1 a mediodía UTC (sin ambigüedad de TZ)', () => {
    const d = parseStoredPlannerMonth('2026-04-01T12:00:00.000Z');
    expect(d).not.toBeNull();
    expect(format(d!, 'yyyy-MM')).toBe('2026-04');
  });

  it('rechaza basura', () => {
    expect(parseStoredPlannerMonth('nope')).toBeNull();
    expect(parseStoredPlannerMonth('')).toBeNull();
  });
});

describe('read/write session planner month', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('escribe yyyy-MM en sessionStorage', () => {
    writeStoredPlannerMonth(new Date(2026, 5, 15));
    expect(sessionStorage.getItem(PLANNER_DATE_STORAGE_KEY)).toBe('2026-06');
    expect(localStorage.getItem(PLANNER_DATE_STORAGE_KEY)).toBeNull();
  });

  it('lee de sessionStorage', () => {
    sessionStorage.setItem(PLANNER_DATE_STORAGE_KEY, '2025-11');
    expect(format(readStoredPlannerMonth(), 'yyyy-MM')).toBe('2025-11');
  });

  it('sin valor en sesión → mes actual', () => {
    expect(format(readStoredPlannerMonth(), 'yyyy-MM')).toBe(format(startOfMonth(new Date()), 'yyyy-MM'));
  });

  it('migra localStorage legado a session y limpia local', () => {
    localStorage.setItem(PLANNER_DATE_STORAGE_KEY, '2026-01');
    const d = readStoredPlannerMonth();
    expect(format(d, 'yyyy-MM')).toBe('2026-01');
    expect(sessionStorage.getItem(PLANNER_DATE_STORAGE_KEY)).toBe('2026-01');
    expect(localStorage.getItem(PLANNER_DATE_STORAGE_KEY)).toBeNull();
  });
});
