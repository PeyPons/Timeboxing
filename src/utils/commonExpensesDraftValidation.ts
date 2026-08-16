import type { CommonExpenseEntry, DepartmentDefinition } from '@/types';
import {
  normalizeCommonExpenseEntriesDepartments,
  validateSplitPercentParts,
} from '@/utils/commonExpensesAllocation';

function validateYyyyMm(s: string | undefined): boolean {
  return !!s && /^\d{4}-\d{2}$/.test(s);
}

function validateExpenseEntryList(
  entriesInput: CommonExpenseEntry[],
  departments: DepartmentDefinition[],
  t: (k: string, d: string) => string
): string | null {
  const entries = normalizeCommonExpenseEntriesDepartments(entriesInput, departments);
  for (const e of entries) {
    if (Number.isNaN(e.amount) || e.amount < 0) {
      return t('agency.commonExpenses.errNegativeAmount', 'Cada importe debe ser mayor o igual que 0.');
    }
    if (e.allocation.type === 'department') {
      if (!e.allocation.departmentId?.trim()) {
        return t('agency.commonExpenses.errDeptRequired', 'Selecciona un departamento en todas las líneas de tipo «Departamento».');
      }
      const known = departments.some(
        d => d.id === e.allocation.departmentId || d.name === e.allocation.departmentId
      );
      if (!known) {
        return t('agency.commonExpenses.errDeptUnknown', 'Hay un departamento no válido. Elige uno de la lista.');
      }
    }
    if (e.allocation.type === 'split_percent') {
      const { ok } = validateSplitPercentParts(e.allocation.parts);
      if (!ok) {
        return t(
          'agency.commonExpenses.errSplitSum',
          'La suma de porcentajes de una línea debe estar entre 99,5 y 100,5.'
        );
      }
      for (const p of e.allocation.parts) {
        if (!p.departmentId?.trim()) {
          return t('agency.commonExpenses.errSplitDept', 'Completa el departamento en cada fila del reparto porcentual.');
        }
      }
    }
  }
  return null;
}

export function validateCommonExpensesDraft(
  draft: Record<string, CommonExpenseEntry[]>,
  recurring: CommonExpenseEntry[],
  departments: DepartmentDefinition[],
  t: (k: string, d: string) => string
): string | null {
  for (const arr of Object.values(draft)) {
    const err = validateExpenseEntryList(arr, departments, t);
    if (err) return err;
  }
  const errR = validateExpenseEntryList(recurring, departments, t);
  if (errR) return errR;
  for (const e of recurring) {
    if (!validateYyyyMm(e.recurringFromMonth)) {
      return t(
        'agency.commonExpenses.errRecurringFrom',
        'Cada gasto fijo debe tener un mes de inicio válido (AAAA-MM).'
      );
    }
    if (e.recurringUntilMonth?.trim()) {
      if (!validateYyyyMm(e.recurringUntilMonth)) {
        return t(
          'agency.commonExpenses.errRecurringUntil',
          'Si indicas mes fin, debe tener formato AAAA-MM.'
        );
      }
      if (e.recurringUntilMonth < e.recurringFromMonth!) {
        return t(
          'agency.commonExpenses.errRecurringRange',
          'El mes fin debe ser igual o posterior al mes de inicio.'
        );
      }
    }
  }
  return null;
}
