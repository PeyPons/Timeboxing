import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CommonExpensesSettingsCard } from '@/components/agency/CommonExpensesSettingsCard';
import type { DepartmentDefinition } from '@/types';
import {
    numberToPositiveDecimalInputString,
    parsePositiveDecimalInput,
    sanitizePositiveDecimalInput,
} from '@/utils/positiveDecimalInput';
import { useProfitSettingsDraft } from '@/hooks/useProfitSettingsDraft';

type CurrencyLabels = {
    currencyParens: string;
    currencySymbol: string;
    perHourSuffix: string;
    defaultPerHour: string;
};

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    departments: DepartmentDefinition[];
    currencyLabels: CurrencyLabels;
};

export function FinancialHealthProfitSettingsDialog({
    open,
    onOpenChange,
    departments,
    currencyLabels,
}: Props) {
    const { t } = useTranslation('app');
    const {
        saving,
        save,
        ehrTargetInput,
        setEhrTargetInput,
        commonExpensesDraft,
        setCommonExpensesDraft,
        commonExpensesRecurringDraft,
        setCommonExpensesRecurringDraft,
    } = useProfitSettingsDraft({
        open,
        departments,
        onSaved: () => onOpenChange(false),
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl w-[calc(100vw-2rem)] max-h-[min(90vh,880px)] overflow-y-auto rounded-2xl border-slate-200">
                <DialogHeader>
                    <DialogTitle>
                        {t('financialHealth.settings.dialogTitle', 'Objetivo EHR y gastos comunes')}
                    </DialogTitle>
                    <DialogDescription>
                        {t(
                            'financialHealth.settings.dialogDescription',
                            'Define el precio hora objetivo y los gastos que se prorratean en esta página (fijos por mes o puntuales).'
                        )}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="max-w-xs space-y-2">
                        <Label htmlFor="fh-ehr-target">
                            {t('agency.general.ehrTarget', currencyLabels)}
                        </Label>
                        <Input
                            id="fh-ehr-target"
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            value={ehrTargetInput}
                            onChange={e => setEhrTargetInput(sanitizePositiveDecimalInput(e.target.value))}
                            onBlur={() => {
                                const v = parsePositiveDecimalInput(ehrTargetInput, 75, 1);
                                setEhrTargetInput(numberToPositiveDecimalInputString(v, 75));
                            }}
                        />
                        <p className="text-xs text-slate-500">
                            {t('financialHealth.settings.ehrNote', currencyLabels)}
                        </p>
                    </div>
                    <CommonExpensesSettingsCard
                        departments={departments}
                        value={commonExpensesDraft}
                        onChange={setCommonExpensesDraft}
                        recurringValue={commonExpensesRecurringDraft}
                        onRecurringChange={setCommonExpensesRecurringDraft}
                    />
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={saving}
                    >
                        {t('financialHealth.settings.cancel', 'Cancelar')}
                    </Button>
                    <Button type="button" onClick={save} disabled={saving}>
                        {saving
                            ? t('financialHealth.settings.saving', 'Guardando…')
                            : t('financialHealth.settings.save', 'Guardar')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
