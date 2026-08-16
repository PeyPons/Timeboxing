import { describe, expect, it } from 'vitest';
import { parseISO } from 'date-fns';
import {
  budgetAdjustmentDelta,
  budgetsNearlyEqual,
  getEffectiveBudget,
  getEffectiveBudgetForMonth,
  getEffectiveMinimum,
  getEffectiveMinimumForMonth,
  getEffectiveMonthlyFee,
  hasActiveBudgetAdjustment,
} from '@/utils/budgetUtils';
import { PROJECT_TYPE_ENTREGABLE } from '@/config/projectTypePresets';

describe('getEffectiveMonthlyFee', () => {
  it('usa monthlyFee para tipos que no son Entregable', () => {
    const month = parseISO('2026-01-15');
    expect(getEffectiveMonthlyFee({ monthlyFee: 1000, projectType: 'Mensual' }, month)).toBe(1000);
  });

  it('entregable sin fechas completas usa monthlyFee', () => {
    const month = parseISO('2026-01-01');
    expect(
      getEffectiveMonthlyFee(
        {
          monthlyFee: 800,
          projectType: PROJECT_TYPE_ENTREGABLE,
          deliverableStartDate: '2026-01-01',
          deliverableDueDate: '',
        },
        month
      )
    ).toBe(800);
  });

  it('entregable sin fechas completas y monthlyFee 0 usa deliverableContractFee como referencia mensual', () => {
    const month = parseISO('2026-03-01');
    expect(
      getEffectiveMonthlyFee(
        {
          monthlyFee: 0,
          projectType: PROJECT_TYPE_ENTREGABLE,
          deliverableContractFee: 4800,
          deliverableStartDate: '',
          deliverableDueDate: '',
        },
        month
      )
    ).toBe(4800);
  });

  it('entregable con fase contenida en un mes asigna el total a ese mes', () => {
    const jan = parseISO('2026-01-01');
    const feb = parseISO('2026-02-01');
    const project = {
      monthlyFee: 0,
      projectType: PROJECT_TYPE_ENTREGABLE,
      deliverableContractFee: 3100,
      deliverableStartDate: '2026-01-01',
      deliverableDueDate: '2026-01-31',
    };
    expect(getEffectiveMonthlyFee(project, jan)).toBe(3100);
    expect(getEffectiveMonthlyFee(project, feb)).toBe(0);
  });

  it('sin deliverableContractFee usa monthlyFee como total del contrato', () => {
    const jan = parseISO('2026-01-01');
    expect(
      getEffectiveMonthlyFee(
        {
          monthlyFee: 3000,
          projectType: PROJECT_TYPE_ENTREGABLE,
          deliverableStartDate: '2026-01-01',
          deliverableDueDate: '2026-01-31',
        },
        jan
      )
    ).toBe(3000);
  });

  it('entregable con fin antes de inicio cae a fee sin prorrateo (monthlyFee o contrato)', () => {
    const jan = parseISO('2026-01-01');
    expect(
      getEffectiveMonthlyFee(
        {
          monthlyFee: 400,
          projectType: PROJECT_TYPE_ENTREGABLE,
          deliverableStartDate: '2026-02-01',
          deliverableDueDate: '2026-01-15',
        },
        jan
      )
    ).toBe(400);
    expect(
      getEffectiveMonthlyFee(
        {
          monthlyFee: 0,
          projectType: PROJECT_TYPE_ENTREGABLE,
          deliverableContractFee: 900,
          deliverableStartDate: '2026-02-01',
          deliverableDueDate: '2026-01-15',
        },
        jan
      )
    ).toBe(900);
  });
});

describe('getEffectiveBudget', () => {
  it('usa budgetOverride del deadline si existe', () => {
    expect(getEffectiveBudget({ budgetHours: 40 }, { budgetOverride: 28 })).toBe(28);
  });

  it('usa budgetHours del proyecto si no hay override', () => {
    expect(getEffectiveBudget({ budgetHours: 40 }, undefined)).toBe(40);
  });
});

describe('hasActiveBudgetAdjustment / budgetAdjustmentDelta', () => {
  it('no hay ajuste si override es null/undefined', () => {
    expect(hasActiveBudgetAdjustment(40, undefined)).toBe(false);
    expect(hasActiveBudgetAdjustment(40, { budgetOverride: undefined })).toBe(false);
    expect(budgetAdjustmentDelta(40, undefined)).toBeNull();
  });

  it('no hay ajuste si override coincide con el presupuesto del proyecto', () => {
    expect(hasActiveBudgetAdjustment(40, { budgetOverride: 40 })).toBe(false);
    expect(budgetAdjustmentDelta(40, { budgetOverride: 40 })).toBeNull();
  });

  it('hay ajuste y delta si override distinto', () => {
    expect(hasActiveBudgetAdjustment(40, { budgetOverride: 28 })).toBe(true);
    expect(budgetAdjustmentDelta(40, { budgetOverride: 28 })).toBe(-12);
  });
});

describe('budgetsNearlyEqual', () => {
  it('trata valores casi iguales como iguales', () => {
    expect(budgetsNearlyEqual(10, 10.0000001)).toBe(true);
    expect(budgetsNearlyEqual(10, 10.1)).toBe(false);
  });
});

describe('getEffectiveMinimum', () => {
  it('limita minimum al override cuando hay budgetOverride', () => {
    expect(getEffectiveMinimum({ budgetHours: 40, minimumHours: 30 }, { budgetOverride: 20 })).toBe(20);
  });

  it('sin deadline devuelve minimumHours o 0', () => {
    expect(getEffectiveMinimum({ budgetHours: 40, minimumHours: 25 }, undefined)).toBe(25);
    expect(getEffectiveMinimum({ budgetHours: 40 }, undefined)).toBe(0);
  });

  it('deadline sin budgetOverride no recorta', () => {
    expect(getEffectiveMinimum({ budgetHours: 40, minimumHours: 30 }, {})).toBe(30);
  });

  it('budgetOverride 0 recorta el mínimo a 0', () => {
    expect(getEffectiveMinimum({ budgetHours: 40, minimumHours: 30 }, { budgetOverride: 0 })).toBe(0);
  });
});

describe('getEffectiveBudgetForMonth', () => {
  it('no entregable usa budgetHours total', () => {
    const month = parseISO('2026-01-15');
    expect(getEffectiveBudgetForMonth({ budgetHours: 100, projectType: 'Mensual' }, undefined, month)).toBe(100);
  });

  it('entregable prorratea horas como el fee por días de fase', () => {
    const month = parseISO('2026-01-15');
    const project = {
      budgetHours: 60,
      projectType: PROJECT_TYPE_ENTREGABLE,
      deliverableStartDate: '2026-01-01',
      deliverableDueDate: '2026-03-31',
    };
    expect(getEffectiveBudgetForMonth(project, undefined, month)).toBe(20.67);
  });

  it('override del deadline tiene prioridad', () => {
    const month = parseISO('2026-01-15');
    expect(
      getEffectiveBudgetForMonth(
        {
          budgetHours: 60,
          projectType: PROJECT_TYPE_ENTREGABLE,
          deliverableStartDate: '2026-01-01',
          deliverableDueDate: '2026-03-31',
        },
        { budgetOverride: 12 },
        month
      )
    ).toBe(12);
  });
});

describe('getEffectiveMinimumForMonth', () => {
  it('recorta el mínimo al tope prorrateado del mes cuando el mínimo contractual supera ese tope', () => {
    const month = parseISO('2026-01-15');
    const project = {
      budgetHours: 60,
      minimumHours: 30,
      projectType: PROJECT_TYPE_ENTREGABLE,
      deliverableStartDate: '2026-01-01',
      deliverableDueDate: '2026-03-31',
    };
    const cap = getEffectiveBudgetForMonth(project, undefined, month);
    expect(cap).toBeLessThan(project.minimumHours ?? 0);
    expect(getEffectiveMinimumForMonth(project, undefined, month)).toBe(cap);
  });

  it('sin mínimo definido devuelve 0', () => {
    const month = parseISO('2026-01-15');
    expect(getEffectiveMinimumForMonth({ budgetHours: 40, projectType: 'Mensual' }, undefined, month)).toBe(0);
  });
});
