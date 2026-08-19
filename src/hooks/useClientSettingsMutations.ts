import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/notify';
import type { AdsClientSettingsMap } from '@/utils/adsPacingUtils';

export interface AdsClientConfig {
  id: string;
  group: string;
  hidden: boolean;
  isSales: boolean;
}

interface UseClientSettingsMutationsOptions {
  agencyId?: string;
  setClientSettings: Dispatch<SetStateAction<AdsClientSettingsMap>>;
  refresh: () => void | Promise<void>;
  budgetErrorMessage: string;
  configSuccessMessage: string;
  configErrorMessage?: string;
}

export function useClientSettingsMutations({
  agencyId,
  setClientSettings,
  refresh,
  budgetErrorMessage,
  configSuccessMessage,
  configErrorMessage = budgetErrorMessage,
}: UseClientSettingsMutationsOptions) {
  const saveBudget = useCallback(async (clientId: string, amount: string) => {
    if (!agencyId) return;

    const parsedAmount = Number.parseFloat(amount);
    const budget = Number.isNaN(parsedAmount) ? 0 : parsedAmount;

    // Preserve the pages' optimistic budget update.
    setClientSettings((previous) => ({
      ...previous,
      [clientId]: {
        ...previous[clientId],
        budget,
      },
    }));

    const { error } = await supabase.from('client_settings').upsert({
      client_id: clientId,
      budget_limit: budget,
      agency_id: agencyId,
    }, { onConflict: 'client_id' });

    if (error) {
      toast.error(budgetErrorMessage);
      return;
    }
    void refresh();
  }, [agencyId, budgetErrorMessage, refresh, setClientSettings]);

  const saveClientConfig = useCallback(async (client: AdsClientConfig): Promise<boolean> => {
    if (!agencyId) return false;

    const { error } = await supabase.from('client_settings').upsert({
      client_id: client.id,
      group_name: client.group,
      is_hidden: client.hidden,
      is_sales_account: client.isSales,
      agency_id: agencyId,
    }, { onConflict: 'client_id' });

    if (error) {
      toast.error(configErrorMessage);
      return false;
    }

    void refresh();
    toast.success(configSuccessMessage);
    return true;
  }, [agencyId, configErrorMessage, configSuccessMessage, refresh]);

  return { saveBudget, saveClientConfig };
}
