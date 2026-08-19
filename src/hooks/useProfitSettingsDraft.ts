import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAgency } from '@/contexts/AgencyContext';
import type { CommonExpenseEntry, DepartmentDefinition } from '@/types';
import { normalizeDepartments } from '@/utils/departmentUtils';
import { normalizeCommonExpenseEntriesDepartments } from '@/utils/commonExpensesAllocation';
import { validateCommonExpensesDraft } from '@/utils/commonExpensesDraftValidation';
import {
    numberToPositiveDecimalInputString,
    parsePositiveDecimalInput,
} from '@/utils/positiveDecimalInput';
import { toast } from '@/lib/notify';

type UseProfitSettingsDraftOptions = {
    open: boolean;
    departments: DepartmentDefinition[];
    onSaved?: () => void;
};

export function useProfitSettingsDraft({ open, departments, onSaved }: UseProfitSettingsDraftOptions) {
    const { t } = useTranslation('app');
    const { currentAgency, updateSettings } = useAgency();
    const [saving, setSaving] = useState(false);
    const [ehrTargetInput, setEhrTargetInput] = useState('');
    const [commonExpensesDraft, setCommonExpensesDraft] = useState<Record<string, CommonExpenseEntry[]>>({});
    const [commonExpensesRecurringDraft, setCommonExpensesRecurringDraft] = useState<CommonExpenseEntry[]>([]);
    const hydratedRef = useRef(false);

    useEffect(() => {
        if (!open) {
            hydratedRef.current = false;
            return;
        }
        if (!currentAgency || hydratedRef.current) return;
        hydratedRef.current = true;
        const deptsNorm = normalizeDepartments(currentAgency.settings?.departments);
        setEhrTargetInput(numberToPositiveDecimalInputString(currentAgency.settings?.ehrTarget ?? 75, 75));
        const rawCommon = currentAgency.settings?.commonExpensesByMonth;
        if (rawCommon && typeof rawCommon === 'object' && !Array.isArray(rawCommon)) {
            const next: Record<string, CommonExpenseEntry[]> = {};
            for (const [k, arr] of Object.entries(rawCommon)) {
                if (!Array.isArray(arr)) continue;
                next[k] = normalizeCommonExpenseEntriesDepartments(arr as CommonExpenseEntry[], deptsNorm);
            }
            setCommonExpensesDraft(next);
        } else {
            setCommonExpensesDraft({});
        }
        const rawRec = currentAgency.settings?.commonExpensesRecurring;
        if (Array.isArray(rawRec)) {
            setCommonExpensesRecurringDraft(
                normalizeCommonExpenseEntriesDepartments(rawRec as CommonExpenseEntry[], deptsNorm)
            );
        } else {
            setCommonExpensesRecurringDraft([]);
        }
    }, [open, currentAgency]);

    const save = useCallback(async () => {
        if (!currentAgency?.id) return;
        const commonErr = validateCommonExpensesDraft(
            commonExpensesDraft,
            commonExpensesRecurringDraft,
            departments,
            (k, d) => t(k, d)
        );
        if (commonErr) {
            toast.error(commonErr);
            return;
        }
        setSaving(true);
        try {
            const normalizedCommon: Record<string, CommonExpenseEntry[]> = {};
            for (const [k, arr] of Object.entries(commonExpensesDraft)) {
                normalizedCommon[k] = normalizeCommonExpenseEntriesDepartments(
                    arr.map(({ recurringFromMonth: _rf, recurringUntilMonth: _ru, ...rest }) => rest),
                    departments
                );
            }
            const normalizedRecurring = normalizeCommonExpenseEntriesDepartments(
                commonExpensesRecurringDraft,
                departments
            );
            const ehrTarget = parsePositiveDecimalInput(ehrTargetInput, 75, 1);
            await updateSettings({
                ehrTarget,
                commonExpensesByMonth: normalizedCommon,
                commonExpensesRecurring: normalizedRecurring,
            });
            toast.success(t('financialHealth.settings.saved', 'Cambios guardados'));
            onSaved?.();
        } catch (err) {
            console.error(err);
            toast.error(t('financialHealth.settings.saveError', 'No se pudo guardar la configuración'));
        } finally {
            setSaving(false);
        }
    }, [
        commonExpensesDraft,
        commonExpensesRecurringDraft,
        currentAgency?.id,
        departments,
        ehrTargetInput,
        onSaved,
        t,
        updateSettings,
    ]);

    return {
        saving,
        save,
        ehrTargetInput,
        setEhrTargetInput,
        commonExpensesDraft,
        setCommonExpensesDraft,
        commonExpensesRecurringDraft,
        setCommonExpensesRecurringDraft,
    };
}
