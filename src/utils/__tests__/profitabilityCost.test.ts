import { describe, expect, it } from 'vitest';
import type { Employee } from '@/types';
import {
  DEFAULT_MONTHLY_HOURS,
  filterEmployeeProfitabilityRowsForDisplay,
  getRowCost,
  getStandardHourlyCost,
  getStandardMonthlyCapacity,
  overheadShareForRow,
} from '@/utils/profitabilityCost';

const baseEmp = (overrides: Partial<Employee> = {}): Employee =>
  ({
    id: 'e1',
    name: 'Test',
    isActive: true,
    defaultWeeklyCapacity: 40,
    hourlyRate: 4000,
    ...overrides,
  }) as Employee;

describe('profitabilityCost', () => {
  it('getStandardMonthlyCapacity usa weekly * 4.33 o fallback', () => {
    expect(getStandardMonthlyCapacity(undefined)).toBe(DEFAULT_MONTHLY_HOURS);
    expect(getStandardMonthlyCapacity(baseEmp({ defaultWeeklyCapacity: 0 }))).toBe(DEFAULT_MONTHLY_HOURS);
    expect(getStandardMonthlyCapacity(baseEmp())).toBeCloseTo(40 * 4.33, 5);
  });

  it('getStandardHourlyCost es nómina / capacidad teórica', () => {
    const emp = baseEmp({ hourlyRate: 4330, defaultWeeklyCapacity: 40 });
    const cap = 40 * 4.33;
    expect(getStandardHourlyCost(emp)).toBeCloseTo(4330 / cap, 5);
    expect(getStandardHourlyCost(baseEmp({ hourlyRate: 0 }))).toBe(0);
    expect(getStandardHourlyCost(undefined)).toBe(0);
  });

  it('getRowCost standard multiplica horas por coste/h', () => {
    const emp = baseEmp();
    const h = 10;
    expect(getRowCost(emp, h, 100, 'standard')).toBeCloseTo(h * getStandardHourlyCost(emp), 5);
  });

  it('getRowCost dynamic prorratea nómina', () => {
    const emp = baseEmp({ hourlyRate: 1000 });
    expect(getRowCost(emp, 25, 100, 'dynamic')).toBe(250);
    expect(getRowCost(emp, 10, 0, 'dynamic')).toBe(0);
  });

  it('overheadShareForRow reparte por fracción de horas', () => {
    const map = new Map<string, number>([['e1', 100]]);
    expect(overheadShareForRow('e1', 30, 100, map)).toBe(30);
    expect(overheadShareForRow('e1', 30, 0, map)).toBe(0);
  });

  it('filterEmployeeProfitabilityRowsForDisplay excluye inactivos y 0 horas', () => {
    const employees = [
      baseEmp({ id: 'active-hours', isActive: true }),
      baseEmp({ id: 'active-zero', isActive: true }),
      baseEmp({ id: 'inactive-hours', isActive: false }),
      baseEmp({ id: 'inactive-zero', isActive: false }),
    ];
    const rows = [
      { employeeId: 'active-hours', totalComputed: 12, totalActual: 10 },
      { employeeId: 'active-zero', totalComputed: 0, totalActual: 0 },
      { employeeId: 'inactive-hours', totalComputed: 8, totalActual: 6 },
      { employeeId: 'inactive-zero', totalComputed: 0, totalActual: 0 },
    ];
    expect(filterEmployeeProfitabilityRowsForDisplay(rows, employees, 'computed').map((r) => r.employeeId)).toEqual([
      'active-hours',
    ]);
    expect(filterEmployeeProfitabilityRowsForDisplay(rows, employees, 'actual').map((r) => r.employeeId)).toEqual([
      'active-hours',
    ]);
  });
});
