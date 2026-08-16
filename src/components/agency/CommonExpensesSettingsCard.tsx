import { useCallback, useMemo, useState } from 'react';
import { format, parse, subMonths } from 'date-fns';
import { Landmark, Plus, Trash2, Copy } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { CommonExpenseAllocation, CommonExpenseEntry, DepartmentDefinition } from '@/types';
import {
  normalizeCommonExpenseEntriesDepartments,
  validateSplitPercentParts,
} from '@/utils/commonExpensesAllocation';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import { toast } from '@/lib/notify';

function newEntryId(): string {
  return `ce-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function prevMonthKey(yyyyMm: string): string {
  const d = parse(`${yyyyMm}-01`, 'yyyy-MM-dd', new Date());
  return format(subMonths(d, 1), 'yyyy-MM');
}

/** Texto de ayuda bajo el selector de reparto. */
function distributionHelpText(
  mode: 'byHours' | 'byHeadcount' | 'byPayroll',
  t: (k: string, d: string) => string
): string {
  if (mode === 'byHeadcount') {
    return t(
      'agency.commonExpenses.distribution.helpHeadcount',
      'Parte igual entre todos los empleados del alcance, incluidos los que no usan Taimbox este mes.'
    );
  }
  if (mode === 'byPayroll') {
    return t(
      'agency.commonExpenses.distribution.helpPayroll',
      'Proporcional a la nómina mensual: quienes cobran más cargan con más gasto común.'
    );
  }
  return t(
    'agency.commonExpenses.distribution.helpHours',
    'Proporcional a las horas del mes. Empleados con 0 h no reciben parte.'
  );
}

export interface CommonExpensesSettingsCardProps {
  departments: DepartmentDefinition[];
  value: Record<string, CommonExpenseEntry[]>;
  onChange: (next: Record<string, CommonExpenseEntry[]>) => void;
  recurringValue: CommonExpenseEntry[];
  onRecurringChange: (next: CommonExpenseEntry[]) => void;
}

export function CommonExpensesSettingsCard({
  departments,
  value,
  onChange,
  recurringValue,
  onRecurringChange,
}: CommonExpensesSettingsCardProps) {
  const { t } = useAppTranslation();
  const { inCurrencyParens } = useFormatMoney();
  const currencyLabels = { currencyParens: inCurrencyParens };
  const [editMonth, setEditMonth] = useState(() => format(new Date(), 'yyyy-MM'));
  const [copyConfirmOpen, setCopyConfirmOpen] = useState(false);

  const entriesForMonth = useMemo(() => value[editMonth] ?? [], [value, editMonth]);

  const setEntriesForMonth = (entries: CommonExpenseEntry[]) => {
    const normalized = normalizeCommonExpenseEntriesDepartments(entries, departments);
    onChange({ ...value, [editMonth]: normalized });
  };

  const setRecurringEntries = (entries: CommonExpenseEntry[]) => {
    onRecurringChange(normalizeCommonExpenseEntriesDepartments(entries, departments));
  };

  const splitValidationRecurring = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const e of recurringValue) {
      if (e.allocation.type !== 'split_percent') {
        map.set(e.id, null);
        continue;
      }
      const { ok, sum } = validateSplitPercentParts(e.allocation.parts);
      if (ok) {
        map.set(e.id, null);
        continue;
      }
      const diff = sum - 100;
      if (diff < 0) {
        map.set(
          e.id,
          t('agency.commonExpenses.splitShort', 'Faltan {{n}} puntos porcentuales.', {
            n: Math.abs(diff).toFixed(1).replace(/\.0$/, ''),
          })
        );
      } else {
        map.set(
          e.id,
          t('agency.commonExpenses.splitLong', 'Sobran {{n}} puntos porcentuales.', {
            n: diff.toFixed(1).replace(/\.0$/, ''),
          })
        );
      }
    }
    return map;
  }, [recurringValue, t]);

  const splitValidationByEntry = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const e of entriesForMonth) {
      if (e.allocation.type !== 'split_percent') {
        map.set(e.id, null);
        continue;
      }
      const { ok, sum } = validateSplitPercentParts(e.allocation.parts);
      if (ok) {
        map.set(e.id, null);
        continue;
      }
      const diff = sum - 100;
      if (diff < 0) {
        map.set(
          e.id,
          t('agency.commonExpenses.splitShort', 'Faltan {{n}} puntos porcentuales.', {
            n: Math.abs(diff).toFixed(1).replace(/\.0$/, ''),
          })
        );
      } else {
        map.set(
          e.id,
          t('agency.commonExpenses.splitLong', 'Sobran {{n}} puntos porcentuales.', {
            n: diff.toFixed(1).replace(/\.0$/, ''),
          })
        );
      }
    }
    return map;
  }, [entriesForMonth, t]);

  const validateMonthLine = useCallback((e: CommonExpenseEntry, splitMap: Map<string, string | null>): string | null => {
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
      const msg = splitMap.get(e.id);
      if (msg) return msg;
      for (const p of e.allocation.parts) {
        if (!p.departmentId?.trim()) {
          return t('agency.commonExpenses.errSplitDept', 'Completa el departamento en cada fila del reparto porcentual.');
        }
      }
    }
    return null;
  }, [departments, t]);

  const blockingReason = useMemo((): string | null => {
    for (const e of recurringValue) {
      if (!e.recurringFromMonth || !/^\d{4}-\d{2}$/.test(e.recurringFromMonth)) {
        return t(
          'agency.commonExpenses.errRecurringFrom',
          'Cada gasto fijo debe tener un mes de inicio válido (AAAA-MM).'
        );
      }
      if (e.recurringUntilMonth?.trim()) {
        if (!/^\d{4}-\d{2}$/.test(e.recurringUntilMonth)) {
          return t(
            'agency.commonExpenses.errRecurringUntil',
            'Si indicas mes fin, debe tener formato AAAA-MM.'
          );
        }
        if (e.recurringUntilMonth < e.recurringFromMonth) {
          return t(
            'agency.commonExpenses.errRecurringRange',
            'El mes fin debe ser igual o posterior al mes de inicio.'
          );
        }
      }
      const err = validateMonthLine(e, splitValidationRecurring);
      if (err) return err;
    }
    for (const e of entriesForMonth) {
      const err = validateMonthLine(e, splitValidationByEntry);
      if (err) return err;
    }
    return null;
  }, [
    entriesForMonth,
    recurringValue,
    splitValidationByEntry,
    splitValidationRecurring,
    validateMonthLine,
    t,
  ]);

  const addRecurringEntry = () => {
    const entry: CommonExpenseEntry = {
      id: newEntryId(),
      label: '',
      amount: 0,
      allocation: { type: 'global' },
      recurringFromMonth: editMonth,
    };
    setRecurringEntries([...recurringValue, entry]);
  };

  const addMonthEntry = () => {
    const entry: CommonExpenseEntry = {
      id: newEntryId(),
      label: '',
      amount: 0,
      allocation: { type: 'global' },
    };
    setEntriesForMonth([...entriesForMonth, entry]);
  };

  const removeEntry = (id: string) => {
    setEntriesForMonth(entriesForMonth.filter(e => e.id !== id));
  };

  const removeRecurringEntry = (id: string) => {
    setRecurringEntries(recurringValue.filter(e => e.id !== id));
  };

  const updateEntry = (id: string, patch: Partial<CommonExpenseEntry>) => {
    setEntriesForMonth(
      entriesForMonth.map(e => (e.id === id ? { ...e, ...patch } : e))
    );
  };

  const updateRecurringEntry = (id: string, patch: Partial<CommonExpenseEntry>) => {
    setRecurringEntries(recurringValue.map(e => (e.id === id ? { ...e, ...patch } : e)));
  };

  const updateAllocation = (id: string, allocation: CommonExpenseAllocation) => {
    setEntriesForMonth(entriesForMonth.map(e => (e.id === id ? { ...e, allocation } : e)));
  };

  const updateRecurringAllocation = (id: string, allocation: CommonExpenseAllocation) => {
    setRecurringEntries(recurringValue.map(e => (e.id === id ? { ...e, allocation } : e)));
  };

  const copyFromPrevious = () => {
    const prev = prevMonthKey(editMonth);
    const source = value[prev];
    if (!source?.length) {
      toast.error(
        t('agency.commonExpenses.copyEmpty', 'No hay datos en el mes anterior para copiar.')
      );
      return;
    }
    if (entriesForMonth.length > 0) {
      setCopyConfirmOpen(true);
      return;
    }
    applyCopy(source);
  };

  const applyCopy = (source: CommonExpenseEntry[]) => {
    const cloned: CommonExpenseEntry[] = source.map(e => {
      const id = newEntryId();
      if (e.allocation.type === 'split_percent') {
        return {
          ...e,
          id,
          allocation: {
            type: 'split_percent' as const,
            parts: e.allocation.parts.map(p => ({ ...p })),
          },
        };
      }
      if (e.allocation.type === 'department') {
        return {
          ...e,
          id,
          allocation: { type: 'department' as const, departmentId: e.allocation.departmentId },
        };
      }
      return { ...e, id, allocation: { type: 'global' as const } };
    });
    setEntriesForMonth(cloned);
    setCopyConfirmOpen(false);
  };

  const handleConfirmCopy = () => {
    const prev = prevMonthKey(editMonth);
    const source = value[prev];
    if (source?.length) applyCopy(source);
    else setCopyConfirmOpen(false);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-primary" />
            {t('agency.commonExpenses.title', 'Gastos comunes (Rentabilidad)')}
          </CardTitle>
          <CardDescription>
            {t(
              'agency.commonExpenses.description',
              'Gastos fijos mensuales (desde un mes) más líneas puntuales por mes. Se prorratean en Rentabilidad según el reparto.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {blockingReason && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {blockingReason}
            </p>
          )}

          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {t('agency.commonExpenses.recurringTitle', 'Gastos fijos mensuales')}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {t(
                  'agency.commonExpenses.recurringDescription',
                  'Mismo importe cada mes desde la fecha de inicio (y hasta la de fin, si la indicas). Se suman a las líneas solo del mes que elijas abajo.'
                )}
              </p>
            </div>
            <Button type="button" className="h-10 gap-1.5 px-3 text-sm" onClick={addRecurringEntry}>
              <Plus className="h-4 w-4" />
              {t('agency.commonExpenses.addRecurringLine', 'Añadir gasto fijo')}
            </Button>
            {recurringValue.length === 0 ? (
              <p className="text-sm text-slate-500">
                {t('agency.commonExpenses.emptyRecurring', 'No hay gastos fijos. Añade alquiler, software u otros costes recurrentes.')}
              </p>
            ) : (
              <ul className="space-y-4">
                {recurringValue.map(entry => (
                  <li
                    key={entry.id}
                    className="relative rounded-xl border border-slate-200 bg-slate-50/50 p-4 pt-3 pr-12 space-y-3"
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-9 w-9 text-red-600 hover:bg-red-50"
                      onClick={() => removeRecurringEntry(entry.id)}
                      aria-label={t('agency.commonExpenses.remove', 'Eliminar')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                        <div className="space-y-1.5 min-w-0">
                          <Label className="text-xs">
                            {t('agency.commonExpenses.recurringFrom', 'Desde (mes)')}
                          </Label>
                          <Input
                            type="month"
                            value={entry.recurringFromMonth ?? ''}
                            onChange={e =>
                              updateRecurringEntry(entry.id, { recurringFromMonth: e.target.value })
                            }
                            className="h-10 w-full min-w-[15.5rem] max-w-full"
                          />
                        </div>
                        <div className="space-y-1.5 min-w-0">
                          <Label className="text-xs">
                            {t('agency.commonExpenses.recurringUntil', 'Hasta (mes, opcional)')}
                          </Label>
                          <Input
                            type="month"
                            value={entry.recurringUntilMonth ?? ''}
                            onChange={e =>
                              updateRecurringEntry(entry.id, {
                                recurringUntilMonth: e.target.value.trim() || undefined,
                              })
                            }
                            className="h-10 w-full min-w-[15.5rem] max-w-full"
                          />
                        </div>
                        <div className="space-y-1.5 min-w-0">
                          <Label className="text-xs">{t('agency.commonExpenses.label', 'Concepto')}</Label>
                          <Input
                            className="h-10 w-full min-w-0"
                            value={entry.label}
                            onChange={e => updateRecurringEntry(entry.id, { label: e.target.value })}
                            placeholder={t('agency.commonExpenses.labelPh', 'Ej. Alquiler')}
                          />
                        </div>
                        <div className="space-y-1.5 min-w-0">
                          <Label className="text-xs">{t('agency.commonExpenses.amount', currencyLabels)}</Label>
                          <Input
                            className="h-10 w-full min-w-0"
                            type="number"
                            min={0}
                            step="0.01"
                            value={Number.isNaN(entry.amount) ? '' : entry.amount}
                            onChange={e => {
                              const v = parseFloat(e.target.value);
                              updateRecurringEntry(entry.id, { amount: e.target.value === '' ? NaN : v });
                            }}
                          />
                        </div>
                      </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">{t('agency.commonExpenses.scope', 'Alcance')}</Label>
                        <Select
                          value={entry.allocation.type}
                          onValueChange={v => {
                            if (v === 'global') updateRecurringAllocation(entry.id, { type: 'global' });
                            else if (v === 'department') {
                              const first = departments[0];
                              updateRecurringAllocation(entry.id, {
                                type: 'department',
                                departmentId: first?.id ?? '',
                              });
                            } else {
                              updateRecurringAllocation(entry.id, {
                                type: 'split_percent',
                                parts: [
                                  { departmentId: departments[0]?.id ?? '', percent: 50 },
                                  { departmentId: departments[1]?.id ?? departments[0]?.id ?? '', percent: 50 },
                                ],
                              });
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="global">
                              {t('agency.commonExpenses.typeGlobal', 'Global (toda la agencia)')}
                            </SelectItem>
                            <SelectItem value="department">
                              {t('agency.commonExpenses.typeDept', 'Un departamento')}
                            </SelectItem>
                            <SelectItem value="split_percent">
                              {t('agency.commonExpenses.typeSplit', 'Porcentajes entre departamentos')}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          {t('agency.commonExpenses.distribution.label', 'Reparto')}
                        </Label>
                        <Select
                          value={entry.distribution ?? 'byHours'}
                          onValueChange={v =>
                            updateRecurringEntry(entry.id, {
                              distribution: v as 'byHours' | 'byHeadcount' | 'byPayroll',
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="byHours">
                              {t('agency.commonExpenses.distribution.byHours', 'Por horas del mes')}
                            </SelectItem>
                            <SelectItem value="byHeadcount">
                              {t('agency.commonExpenses.distribution.byHeadcount', 'A partes iguales (por empleado)')}
                            </SelectItem>
                            <SelectItem value="byPayroll">
                              {t('agency.commonExpenses.distribution.byPayroll', 'Proporcional a la nómina')}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] text-slate-500 leading-snug">
                          {distributionHelpText(entry.distribution ?? 'byHours', t)}
                        </p>
                      </div>

                      {entry.allocation.type === 'department' && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">{t('agency.commonExpenses.department', 'Departamento')}</Label>
                          <Select
                            value={entry.allocation.departmentId}
                            onValueChange={v =>
                              updateRecurringAllocation(entry.id, { type: 'department', departmentId: v })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t('agency.commonExpenses.pickDept', 'Elegir…')} />
                            </SelectTrigger>
                            <SelectContent>
                              {departments.map(d => (
                                <SelectItem key={d.id} value={d.id}>
                                  {d.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    {entry.allocation.type === 'split_percent' && (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Label className="text-xs">
                            {t('agency.commonExpenses.splitParts', 'Reparto (%) — debe sumar 100')}
                          </Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              updateRecurringAllocation(entry.id, {
                                type: 'split_percent',
                                parts: [...entry.allocation.parts, { departmentId: departments[0]?.id ?? '', percent: 0 }],
                              })
                            }
                          >
                            {t('agency.commonExpenses.addSplitRow', 'Añadir departamento')}
                          </Button>
                        </div>
                        {splitValidationRecurring.get(entry.id) && (
                          <p className="text-xs text-red-600">{splitValidationRecurring.get(entry.id)}</p>
                        )}
                        <ul className="space-y-2">
                          {entry.allocation.parts.map((part, idx) => (
                            <li key={idx} className="flex flex-wrap gap-2 items-end">
                              <Select
                                value={part.departmentId}
                                onValueChange={v => {
                                  const parts = [...entry.allocation.parts];
                                  parts[idx] = { ...parts[idx], departmentId: v };
                                  updateRecurringAllocation(entry.id, { type: 'split_percent', parts });
                                }}
                              >
                                <SelectTrigger className="w-[200px]">
                                  <SelectValue placeholder={t('agency.commonExpenses.pickDept', 'Elegir…')} />
                                </SelectTrigger>
                                <SelectContent>
                                  {departments.map(d => (
                                    <SelectItem key={d.id} value={d.id}>
                                      {d.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                type="number"
                                className="w-24"
                                min={0}
                                max={100}
                                step="0.1"
                                value={part.percent}
                                onChange={e => {
                                  const parts = [...entry.allocation.parts];
                                  parts[idx] = { ...parts[idx], percent: parseFloat(e.target.value) || 0 };
                                  updateRecurringAllocation(entry.id, { type: 'split_percent', parts });
                                }}
                              />
                              <span className="text-sm text-slate-500 pb-2">%</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-red-600"
                                disabled={entry.allocation.parts.length <= 1}
                                onClick={() => {
                                  const parts = entry.allocation.parts.filter((_, i) => i !== idx);
                                  updateRecurringAllocation(entry.id, { type: 'split_percent', parts });
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-slate-200 pt-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {t('agency.commonExpenses.monthOnlySection', 'Solo para un mes concreto')}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {t(
                  'agency.commonExpenses.monthOnlySectionDesc',
                  'Líneas adicionales que cuentan únicamente en el mes seleccionado (histórico o extras puntuales).'
                )}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="min-w-0 sm:w-[min(100%,17rem)]">
                <Label htmlFor="common-exp-month" className="text-xs text-slate-700">
                  {t('agency.commonExpenses.month', 'Mes')}
                </Label>
                <Input
                  id="common-exp-month"
                  type="month"
                  value={editMonth}
                  onChange={e => setEditMonth(e.target.value)}
                  className="mt-1.5 h-10 w-full min-w-[15.5rem] max-w-full"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 gap-1.5 px-3 text-sm"
                  onClick={copyFromPrevious}
                >
                  <Copy className="h-4 w-4" />
                  {t('agency.commonExpenses.copyPrev', 'Copiar del mes anterior')}
                </Button>
                <Button
                  type="button"
                  className="h-10 gap-1.5 px-3 text-sm"
                  onClick={addMonthEntry}
                >
                  <Plus className="h-4 w-4" />
                  {t('agency.commonExpenses.addMonthLine', 'Añadir línea al mes')}
                </Button>
              </div>
            </div>

          {entriesForMonth.length === 0 ? (
            <p className="text-sm text-slate-500">
              {t('agency.commonExpenses.emptyMonth', 'No hay líneas para este mes. Añade gastos o cópialos del mes anterior.')}
            </p>
          ) : (
            <ul className="space-y-4">
              {entriesForMonth.map(entry => (
                <li
                  key={entry.id}
                  className="relative rounded-xl border border-slate-200 bg-slate-50/50 p-4 pt-3 pr-12 space-y-3"
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-9 w-9 text-red-600 hover:bg-red-50"
                    onClick={() => removeEntry(entry.id)}
                    aria-label={t('agency.commonExpenses.remove', 'Eliminar')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <div className="grid gap-3 sm:grid-cols-2 min-w-0">
                      <div className="space-y-1.5 min-w-0">
                        <Label className="text-xs">{t('agency.commonExpenses.label', 'Concepto')}</Label>
                        <Input
                          className="h-10 w-full min-w-0"
                          value={entry.label}
                          onChange={e => updateEntry(entry.id, { label: e.target.value })}
                          placeholder={t('agency.commonExpenses.labelPh', 'Ej. Alquiler')}
                        />
                      </div>
                      <div className="space-y-1.5 min-w-0">
                        <Label className="text-xs">{t('agency.commonExpenses.amount', currencyLabels)}</Label>
                        <Input
                          className="h-10 w-full min-w-0"
                          type="number"
                          min={0}
                          step="0.01"
                          value={Number.isNaN(entry.amount) ? '' : entry.amount}
                          onChange={e => {
                            const v = parseFloat(e.target.value);
                            updateEntry(entry.id, { amount: e.target.value === '' ? NaN : v });
                          }}
                        />
                      </div>
                    </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t('agency.commonExpenses.scope', 'Alcance')}</Label>
                      <Select
                        value={entry.allocation.type}
                        onValueChange={v => {
                          if (v === 'global') updateAllocation(entry.id, { type: 'global' });
                          else if (v === 'department') {
                            const first = departments[0];
                            updateAllocation(entry.id, {
                              type: 'department',
                              departmentId: first?.id ?? '',
                            });
                          } else {
                            updateAllocation(entry.id, {
                              type: 'split_percent',
                              parts: [
                                { departmentId: departments[0]?.id ?? '', percent: 50 },
                                { departmentId: departments[1]?.id ?? departments[0]?.id ?? '', percent: 50 },
                              ],
                            });
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="global">
                            {t('agency.commonExpenses.typeGlobal', 'Global (toda la agencia)')}
                          </SelectItem>
                          <SelectItem value="department">
                            {t('agency.commonExpenses.typeDept', 'Un departamento')}
                          </SelectItem>
                          <SelectItem value="split_percent">
                            {t('agency.commonExpenses.typeSplit', 'Porcentajes entre departamentos')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        {t('agency.commonExpenses.distribution.label', 'Reparto')}
                      </Label>
                      <Select
                        value={entry.distribution ?? 'byHours'}
                        onValueChange={v =>
                          updateEntry(entry.id, {
                            distribution: v as 'byHours' | 'byHeadcount' | 'byPayroll',
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="byHours">
                            {t('agency.commonExpenses.distribution.byHours', 'Por horas del mes')}
                          </SelectItem>
                          <SelectItem value="byHeadcount">
                            {t('agency.commonExpenses.distribution.byHeadcount', 'A partes iguales (por empleado)')}
                          </SelectItem>
                          <SelectItem value="byPayroll">
                            {t('agency.commonExpenses.distribution.byPayroll', 'Proporcional a la nómina')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-slate-500 leading-snug">
                        {distributionHelpText(entry.distribution ?? 'byHours', t)}
                      </p>
                    </div>

                    {entry.allocation.type === 'department' && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">{t('agency.commonExpenses.department', 'Departamento')}</Label>
                        <Select
                          value={entry.allocation.departmentId}
                          onValueChange={v =>
                            updateAllocation(entry.id, { type: 'department', departmentId: v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t('agency.commonExpenses.pickDept', 'Elegir…')} />
                          </SelectTrigger>
                          <SelectContent>
                            {departments.map(d => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {entry.allocation.type === 'split_percent' && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label className="text-xs">
                          {t('agency.commonExpenses.splitParts', 'Reparto (%) — debe sumar 100')}
                        </Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateAllocation(entry.id, {
                              type: 'split_percent',
                              parts: [...entry.allocation.parts, { departmentId: departments[0]?.id ?? '', percent: 0 }],
                            })
                          }
                        >
                          {t('agency.commonExpenses.addSplitRow', 'Añadir departamento')}
                        </Button>
                      </div>
                      {splitValidationByEntry.get(entry.id) && (
                        <p className="text-xs text-red-600">{splitValidationByEntry.get(entry.id)}</p>
                      )}
                      <ul className="space-y-2">
                        {entry.allocation.parts.map((part, idx) => (
                          <li key={idx} className="flex flex-wrap gap-2 items-end">
                            <Select
                              value={part.departmentId}
                              onValueChange={v => {
                                const parts = [...entry.allocation.parts];
                                parts[idx] = { ...parts[idx], departmentId: v };
                                updateAllocation(entry.id, { type: 'split_percent', parts });
                              }}
                            >
                              <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder={t('agency.commonExpenses.pickDept', 'Elegir…')} />
                              </SelectTrigger>
                              <SelectContent>
                                {departments.map(d => (
                                  <SelectItem key={d.id} value={d.id}>
                                    {d.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              className="w-24"
                              min={0}
                              max={100}
                              step="0.1"
                              value={part.percent}
                              onChange={e => {
                                const parts = [...entry.allocation.parts];
                                parts[idx] = { ...parts[idx], percent: parseFloat(e.target.value) || 0 };
                                updateAllocation(entry.id, { type: 'split_percent', parts });
                              }}
                            />
                            <span className="text-sm text-slate-500 pb-2">%</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-red-600"
                              disabled={entry.allocation.parts.length <= 1}
                              onClick={() => {
                                const parts = entry.allocation.parts.filter((_, i) => i !== idx);
                                updateAllocation(entry.id, { type: 'split_percent', parts });
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={copyConfirmOpen} onOpenChange={setCopyConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('agency.commonExpenses.copyConfirmTitle', '¿Sobrescribir el mes actual?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'agency.commonExpenses.copyConfirmDesc',
                'Este mes ya tiene líneas. Copiar desde el mes anterior las reemplazará.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('agency.commonExpenses.cancelDialog', 'Cancelar')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCopy}>
              {t('agency.commonExpenses.copyConfirm', 'Copiar y reemplazar')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
