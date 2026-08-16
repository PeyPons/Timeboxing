import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseISO } from 'date-fns';
import { computeProjectMetricsForMonth } from '@/utils/projectMetricsCompute';
import type { Allocation, Client, Employee, Project } from '@/types';

const client: Client = {
  id: 'c1',
  agencyId: 'a1',
  name: 'Cliente',
  color: '#000000',
};

const baseProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'p1',
  agencyId: 'a1',
  clientId: 'c1',
  name: 'Proyecto',
  status: 'active',
  budgetHours: 100,
  monthlyFee: 1000,
  ...overrides,
});

describe('computeProjectMetricsForMonth', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-03T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('usa getEffectiveMinimum con override del deadline', () => {
    const res = computeProjectMetricsForMonth({
      allocations: [],
      projects: [
        baseProject({
          budgetHours: 30,
          minimumHours: 20,
        }),
      ],
      clients: [client],
      employees: [],
      month: parseISO('2026-01-01'),
      deadlines: [{ projectId: 'p1', month: '2026-01', budgetOverride: 10 }],
    });
    expect(res.getProjectMetrics('p1')?.minimum).toBe(10);
  });

  it('mes pasado: expected pacing al 100 % — 85 % avance sigue en ritmo', () => {
    const allocation: Allocation = {
      id: 'a1',
      employeeId: 'e1',
      projectId: 'p1',
      weekStartDate: '2026-01-05',
      hoursAssigned: 85,
      hoursComputed: 85,
      status: 'completed',
    };
    const emp = {
      id: 'e1',
      agencyId: 'a1',
      name: 'E',
      role: 'dev',
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
      isActive: true,
    } as Employee;
    const res = computeProjectMetricsForMonth({
      allocations: [allocation],
      projects: [baseProject({ budgetHours: 100 })],
      clients: [client],
      employees: [emp],
      month: parseISO('2026-01-01'),
      hoursTrackingPreference: 'computed',
    });
    const pm = res.getProjectMetrics('p1');
    expect(pm?.progressOperational).toBe(85);
    expect(pm?.isPacing).toBe(true);
  });

  it('mes futuro: ritmo relajado (0 % esperado)', () => {
    const res = computeProjectMetricsForMonth({
      allocations: [],
      projects: [baseProject({ budgetHours: 100 })],
      clients: [client],
      employees: [],
      month: parseISO('2026-07-01'),
    });
    const pm = res.getProjectMetrics('p1');
    expect(pm?.isPacing).toBe(true);
  });

  it('respeta pacingReferenceDate explícito', () => {
    const res = computeProjectMetricsForMonth({
      allocations: [],
      projects: [baseProject({ budgetHours: 100 })],
      clients: [client],
      employees: [],
      month: parseISO('2026-05-01'),
      pacingReferenceDate: parseISO('2026-05-31'),
    });
    const pm = res.getProjectMetrics('p1');
    expect(pm?.isPacing).toBe(false);
  });
});
