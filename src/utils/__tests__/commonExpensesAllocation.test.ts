import { describe, it, expect } from 'vitest';
import {
  allocateCommonExpenses,
  collectCommonExpenseEntriesForMonth,
  validateSplitPercentParts,
  SPLIT_PERCENT_TOLERANCE_PP,
} from '../commonExpensesAllocation';
import type { CommonExpenseEntry, DepartmentDefinition } from '@/types';

const deptDev: DepartmentDefinition = { id: 'dev', name: 'Desarrollo', color: '#000' };
const deptMkt: DepartmentDefinition = { id: 'mkt', name: 'Marketing', color: '#111' };

describe('validateSplitPercentParts', () => {
  it('acepta suma 100', () => {
    expect(validateSplitPercentParts([{ percent: 60 }, { percent: 40 }]).ok).toBe(true);
  });
  it('acepta suma dentro de tolerancia por redondeo', () => {
    expect(validateSplitPercentParts([{ percent: 33.3 }, { percent: 33.3 }, { percent: 33.3 }]).ok).toBe(true);
  });
  it('rechaza suma fuera de ±0.5', () => {
    const r = validateSplitPercentParts([{ percent: 50 }, { percent: 40 }]);
    expect(r.ok).toBe(false);
    expect(r.sum).toBe(90);
  });
  it('límite inferior 99.5', () => {
    expect(validateSplitPercentParts([{ percent: 99.5 }]).ok).toBe(true);
  });
  it('límite superior 100.5', () => {
    expect(validateSplitPercentParts([{ percent: 100.5 }]).ok).toBe(true);
  });
  it('tolerancia exportada', () => {
    expect(SPLIT_PERCENT_TOLERANCE_PP).toBe(0.5);
  });
});

describe('allocateCommonExpenses', () => {
  it('equipo sin horas: no aplica overhead y deja importe como no asignado', () => {
    const entries: CommonExpenseEntry[] = [
      {
        id: '1',
        label: 'Alquiler',
        amount: 5000,
        allocation: { type: 'global' },
      },
    ];
    const employees = [
      { id: 'a', departmentId: 'dev' },
      { id: 'b', departmentId: 'mkt' },
    ];
    const r = allocateCommonExpenses({
      entries,
      employees,
      departments: [deptDev, deptMkt],
      getEmployeeHours: () => 0,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.totalOverheadApplied).toBe(0);
      expect(r.overheadByEmployee.get('a')).toBe(0);
      expect(r.overheadByEmployee.get('b')).toBe(0);
      expect(r.unallocatedAmount).toBe(5000);
      expect(r.unallocatedEntries.some(e => e.reason === 'all_zero_hours')).toBe(true);
    }
  });

  it('global: reparte proporcional a horas', () => {
    const entries: CommonExpenseEntry[] = [
      { id: '1', label: 'G', amount: 1000, allocation: { type: 'global' } },
    ];
    const employees = [
      { id: 'a', departmentId: 'dev' },
      { id: 'b', departmentId: 'dev' },
    ];
    const hours: Record<string, number> = { a: 60, b: 40 };
    const r = allocateCommonExpenses({
      entries,
      employees,
      departments: [deptDev],
      getEmployeeHours: id => hours[id] ?? 0,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.overheadByEmployee.get('a')! + r.overheadByEmployee.get('b')!).toBeCloseTo(1000, 0);
      expect(r.overheadByEmployee.get('a')!).toBeGreaterThan(r.overheadByEmployee.get('b')!);
    }
  });

  it('department: solo reparte en el departamento', () => {
    const entries: CommonExpenseEntry[] = [
      {
        id: '1',
        label: 'D',
        amount: 300,
        allocation: { type: 'department', departmentId: 'dev' },
      },
    ];
    const employees = [
      { id: 'a', departmentId: 'dev' },
      { id: 'b', departmentId: 'mkt' },
    ];
    const hours: Record<string, number> = { a: 50, b: 100 };
    const r = allocateCommonExpenses({
      entries,
      employees,
      departments: [deptDev, deptMkt],
      getEmployeeHours: id => hours[id] ?? 0,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.overheadByEmployee.get('b')).toBe(0);
      expect(r.overheadByEmployee.get('a')).toBe(300);
    }
  });

  it('split_percent: reparte entre departamentos', () => {
    const entries: CommonExpenseEntry[] = [
      {
        id: '1',
        label: 'S',
        amount: 1000,
        allocation: {
          type: 'split_percent',
          parts: [
            { departmentId: 'dev', percent: 50 },
            { departmentId: 'mkt', percent: 50 },
          ],
        },
      },
    ];
    const employees = [
      { id: 'a', departmentId: 'dev' },
      { id: 'b', departmentId: 'mkt' },
    ];
    const hours: Record<string, number> = { a: 10, b: 10 };
    const r = allocateCommonExpenses({
      entries,
      employees,
      departments: [deptDev, deptMkt],
      getEmployeeHours: id => hours[id] ?? 0,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.overheadByEmployee.get('a')!).toBeCloseTo(500, 0);
      expect(r.overheadByEmployee.get('b')!).toBeCloseTo(500, 0);
    }
  });

  it('rechaza importe negativo', () => {
    const r = allocateCommonExpenses({
      entries: [{ id: 'x', label: 'bad', amount: -1, allocation: { type: 'global' } }],
      employees: [{ id: 'a' }],
      departments: [],
      getEmployeeHours: () => 10,
    });
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.code).toBe('NEGATIVE_AMOUNT');
  });

  it('rechaza split inválido', () => {
    const r = allocateCommonExpenses({
      entries: [
        {
          id: 'x',
          label: 's',
          amount: 100,
          allocation: {
            type: 'split_percent',
            parts: [{ departmentId: 'dev', percent: 30 }, { departmentId: 'mkt', percent: 30 }],
          },
        },
      ],
      employees: [{ id: 'a', departmentId: 'dev' }],
      departments: [deptDev, deptMkt],
      getEmployeeHours: () => 10,
    });
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.code).toBe('SPLIT_SUM_OUT_OF_RANGE');
  });

  it('lista empleados con 0h cuando otros trabajan y hay gasto', () => {
    const entries: CommonExpenseEntry[] = [
      { id: '1', label: 'G', amount: 100, allocation: { type: 'global' } },
    ];
    const employees = [{ id: 'a' }, { id: 'b' }];
    const r = allocateCommonExpenses({
      entries,
      employees,
      departments: [],
      getEmployeeHours: id => (id === 'a' ? 10 : 0),
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.employeeIdsZeroHoursWithPeersWorking).toContain('b');
    }
  });
});

describe('allocateCommonExpenses · distribution modes', () => {
  const employees = [
    { id: 'a', departmentId: 'dev' },
    { id: 'b', departmentId: 'dev' },
    { id: 'c', departmentId: 'mkt' },
  ];
  const hours: Record<string, number> = { a: 60, b: 40, c: 0 };
  const payroll: Record<string, number> = { a: 3000, b: 1500, c: 2000 };

  it('byHeadcount + global: reparte a partes iguales entre TODOS (incluye 0 h)', () => {
    const entries: CommonExpenseEntry[] = [
      { id: '1', label: 'Alquiler', amount: 900, allocation: { type: 'global' }, distribution: 'byHeadcount' },
    ];
    const r = allocateCommonExpenses({
      entries,
      employees,
      departments: [deptDev, deptMkt],
      getEmployeeHours: id => hours[id] ?? 0,
      getEmployeePayroll: id => payroll[id] ?? 0,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.overheadByEmployee.get('a')).toBeCloseTo(300, 2);
      expect(r.overheadByEmployee.get('b')).toBeCloseTo(300, 2);
      expect(r.overheadByEmployee.get('c')).toBeCloseTo(300, 2);
      expect(r.employeeIdsZeroHoursWithPeersWorking).toEqual([]);
    }
  });

  it('byHeadcount + department: solo entre empleados del departamento', () => {
    const entries: CommonExpenseEntry[] = [
      {
        id: '1',
        label: 'Licencias dev',
        amount: 200,
        allocation: { type: 'department', departmentId: 'dev' },
        distribution: 'byHeadcount',
      },
    ];
    const r = allocateCommonExpenses({
      entries,
      employees,
      departments: [deptDev, deptMkt],
      getEmployeeHours: id => hours[id] ?? 0,
      getEmployeePayroll: id => payroll[id] ?? 0,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.overheadByEmployee.get('a')).toBeCloseTo(100, 2);
      expect(r.overheadByEmployee.get('b')).toBeCloseTo(100, 2);
      expect(r.overheadByEmployee.get('c')).toBe(0);
    }
  });

  it('byHeadcount + split_percent: porcentaje entre deptos, cabezas dentro de cada uno', () => {
    const entries: CommonExpenseEntry[] = [
      {
        id: '1',
        label: 'Servicios',
        amount: 1000,
        allocation: {
          type: 'split_percent',
          parts: [
            { departmentId: 'dev', percent: 60 },
            { departmentId: 'mkt', percent: 40 },
          ],
        },
        distribution: 'byHeadcount',
      },
    ];
    const r = allocateCommonExpenses({
      entries,
      employees,
      departments: [deptDev, deptMkt],
      getEmployeeHours: id => hours[id] ?? 0,
      getEmployeePayroll: id => payroll[id] ?? 0,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // dev recibe 600 / 2 = 300 cada uno; mkt recibe 400 / 1 = 400.
      expect(r.overheadByEmployee.get('a')).toBeCloseTo(300, 2);
      expect(r.overheadByEmployee.get('b')).toBeCloseTo(300, 2);
      expect(r.overheadByEmployee.get('c')).toBeCloseTo(400, 2);
    }
  });

  it('byPayroll + global: proporcional a nómina, excluye 0€', () => {
    const entries: CommonExpenseEntry[] = [
      { id: '1', label: 'Seguros', amount: 650, allocation: { type: 'global' }, distribution: 'byPayroll' },
    ];
    const r = allocateCommonExpenses({
      entries,
      employees,
      departments: [deptDev, deptMkt],
      getEmployeeHours: id => hours[id] ?? 0,
      getEmployeePayroll: id => payroll[id] ?? 0,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // Total payroll = 6500; a=3000/6500*650 ≈ 300, b=1500/6500*650 ≈ 150, c=2000/6500*650 ≈ 200
      expect(r.overheadByEmployee.get('a')).toBeCloseTo(300, 1);
      expect(r.overheadByEmployee.get('b')).toBeCloseTo(150, 1);
      expect(r.overheadByEmployee.get('c')).toBeCloseTo(200, 1);
    }
  });

  it('byPayroll + department: solo dentro del departamento', () => {
    const entries: CommonExpenseEntry[] = [
      {
        id: '1',
        label: 'Tools dev',
        amount: 450,
        allocation: { type: 'department', departmentId: 'dev' },
        distribution: 'byPayroll',
      },
    ];
    const r = allocateCommonExpenses({
      entries,
      employees,
      departments: [deptDev, deptMkt],
      getEmployeeHours: id => hours[id] ?? 0,
      getEmployeePayroll: id => payroll[id] ?? 0,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // dev total = 4500; a=3000/4500*450=300, b=1500/4500*450=150
      expect(r.overheadByEmployee.get('a')).toBeCloseTo(300, 1);
      expect(r.overheadByEmployee.get('b')).toBeCloseTo(150, 1);
      expect(r.overheadByEmployee.get('c')).toBe(0);
    }
  });

  it('byPayroll + split_percent: porcentaje entre deptos, nómina dentro de cada uno', () => {
    const entries: CommonExpenseEntry[] = [
      {
        id: '1',
        label: 'Compartido',
        amount: 1000,
        allocation: {
          type: 'split_percent',
          parts: [
            { departmentId: 'dev', percent: 50 },
            { departmentId: 'mkt', percent: 50 },
          ],
        },
        distribution: 'byPayroll',
      },
    ];
    const r = allocateCommonExpenses({
      entries,
      employees,
      departments: [deptDev, deptMkt],
      getEmployeeHours: id => hours[id] ?? 0,
      getEmployeePayroll: id => payroll[id] ?? 0,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // dev recibe 500: a=3000/4500*500≈333.33, b=1500/4500*500≈166.67
      // mkt recibe 500: c=2000/2000*500=500
      expect(r.overheadByEmployee.get('a')! + r.overheadByEmployee.get('b')!).toBeCloseTo(500, 1);
      expect(r.overheadByEmployee.get('c')).toBeCloseTo(500, 1);
    }
  });

  it('byHours + department: comportamiento original (excluye 0 h)', () => {
    const entries: CommonExpenseEntry[] = [
      {
        id: '1',
        label: 'X',
        amount: 500,
        allocation: { type: 'department', departmentId: 'dev' },
        distribution: 'byHours',
      },
    ];
    const r = allocateCommonExpenses({
      entries,
      employees,
      departments: [deptDev, deptMkt],
      getEmployeeHours: id => hours[id] ?? 0,
      getEmployeePayroll: id => payroll[id] ?? 0,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.overheadByEmployee.get('a')! + r.overheadByEmployee.get('b')!).toBeCloseTo(500, 1);
      expect(r.overheadByEmployee.get('a')!).toBeGreaterThan(r.overheadByEmployee.get('b')!);
    }
  });

  it('byHours + split_percent: reparto por horas dentro de cada departamento', () => {
    const entries: CommonExpenseEntry[] = [
      {
        id: '1',
        label: 'X',
        amount: 1000,
        allocation: {
          type: 'split_percent',
          parts: [
            { departmentId: 'dev', percent: 70 },
            { departmentId: 'mkt', percent: 30 },
          ],
        },
        distribution: 'byHours',
      },
    ];
    const hoursX: Record<string, number> = { a: 60, b: 40, c: 10 };
    const r = allocateCommonExpenses({
      entries,
      employees,
      departments: [deptDev, deptMkt],
      getEmployeeHours: id => hoursX[id] ?? 0,
      getEmployeePayroll: id => payroll[id] ?? 0,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.overheadByEmployee.get('a')! + r.overheadByEmployee.get('b')!).toBeCloseTo(700, 0);
      expect(r.overheadByEmployee.get('c')).toBeCloseTo(300, 0);
    }
  });

  it('mezcla byHours + byHeadcount: sigue avisando empleados a 0 h si hay línea byHours', () => {
    const entries: CommonExpenseEntry[] = [
      { id: '1', label: 'H', amount: 100, allocation: { type: 'global' }, distribution: 'byHours' },
      { id: '2', label: 'C', amount: 60, allocation: { type: 'global' }, distribution: 'byHeadcount' },
    ];
    const r = allocateCommonExpenses({
      entries,
      employees,
      departments: [deptDev, deptMkt],
      getEmployeeHours: id => hours[id] ?? 0,
      getEmployeePayroll: id => payroll[id] ?? 0,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.employeeIdsZeroHoursWithPeersWorking).toContain('c');
    }
  });

  it('byPayroll sin getEmployeePayroll usa pesos por horas', () => {
    const entries: CommonExpenseEntry[] = [
      { id: '1', label: 'P', amount: 100, allocation: { type: 'global' }, distribution: 'byPayroll' },
    ];
    const r = allocateCommonExpenses({
      entries,
      employees,
      departments: [deptDev, deptMkt],
      getEmployeeHours: id => hours[id] ?? 0,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.overheadByEmployee.get('a')! + r.overheadByEmployee.get('b')! + r.overheadByEmployee.get('c')!).toBeCloseTo(
        100,
        0
      );
      expect(r.overheadByEmployee.get('a')!).toBeGreaterThan(r.overheadByEmployee.get('b')!);
    }
  });

  it('departamento vacío: importe no asignado', () => {
    const entries: CommonExpenseEntry[] = [
      {
        id: '1',
        label: 'X',
        amount: 400,
        allocation: { type: 'department', departmentId: 'ghost' },
      },
    ];
    const r = allocateCommonExpenses({
      entries,
      employees: [{ id: 'a', departmentId: 'dev' }],
      departments: [deptDev],
      getEmployeeHours: () => 10,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.totalOverheadApplied).toBe(0);
      expect(r.unallocatedAmount).toBe(400);
      expect(r.unallocatedEntries[0]?.reason).toBe('no_employees_in_dept');
    }
  });

  it('distribution ausente = byHours (compat)', () => {
    const entries: CommonExpenseEntry[] = [
      { id: '1', label: 'X', amount: 200, allocation: { type: 'global' } },
    ];
    const r = allocateCommonExpenses({
      entries,
      employees,
      departments: [deptDev, deptMkt],
      getEmployeeHours: id => hours[id] ?? 0,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.overheadByEmployee.get('c')).toBe(0);
      expect(r.overheadByEmployee.get('a')! + r.overheadByEmployee.get('b')!).toBeCloseTo(200, 1);
    }
  });
});

describe('collectCommonExpenseEntriesForMonth', () => {
  it('combina recurrentes aplicables y líneas del mes', () => {
    const merged = collectCommonExpenseEntriesForMonth(
      {
        commonExpensesRecurring: [
          {
            id: 'r1',
            label: 'Fijo',
            amount: 100,
            allocation: { type: 'global' },
            recurringFromMonth: '2026-01',
          },
        ],
        commonExpensesByMonth: {
          '2026-03': [{ id: 'm1', label: 'Extra', amount: 50, allocation: { type: 'global' } }],
        },
      },
      '2026-03',
      []
    );
    expect(merged).toHaveLength(2);
    expect(merged.map(e => e.id).sort()).toEqual(['m1', 'r1']);
  });

  it('excluye recurrente antes del mes de inicio', () => {
    const merged = collectCommonExpenseEntriesForMonth(
      {
        commonExpensesRecurring: [
          {
            id: 'r1',
            label: 'Fijo',
            amount: 100,
            allocation: { type: 'global' },
            recurringFromMonth: '2026-05',
          },
        ],
        commonExpensesByMonth: {},
      },
      '2026-03',
      []
    );
    expect(merged).toHaveLength(0);
  });

  it('excluye recurrente después del mes fin', () => {
    const merged = collectCommonExpenseEntriesForMonth(
      {
        commonExpensesRecurring: [
          {
            id: 'r1',
            label: 'Fijo',
            amount: 100,
            allocation: { type: 'global' },
            recurringFromMonth: '2026-01',
            recurringUntilMonth: '2026-02',
          },
        ],
        commonExpensesByMonth: {},
      },
      '2026-03',
      []
    );
    expect(merged).toHaveLength(0);
  });

  it('incluye recurrente en el mes fin inclusive', () => {
    const merged = collectCommonExpenseEntriesForMonth(
      {
        commonExpensesRecurring: [
          {
            id: 'r1',
            label: 'Fijo',
            amount: 100,
            allocation: { type: 'global' },
            recurringFromMonth: '2026-01',
            recurringUntilMonth: '2026-02',
          },
        ],
        commonExpensesByMonth: {},
      },
      '2026-02',
      []
    );
    expect(merged).toHaveLength(1);
  });
});
