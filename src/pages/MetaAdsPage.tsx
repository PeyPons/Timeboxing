import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { useAgency } from '@/contexts/AgencyContext';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RefreshCw, Search, Settings, Layers, TrendingUp, TrendingDown, Scissors, Plus, Trash2, AlertTriangle, CheckCircle2, Calendar, Target, ArrowDownRight, Eye, EyeOff, X, Facebook, Check, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useAdsFormatMoney } from '@/hooks/useAdsFormatMoney';
import { useRefreshMissingAdCurrencies } from '@/hooks/useRefreshMissingAdCurrencies';
import { toast } from '@/lib/notify';
import { useAnonymizeAds } from '@/hooks/useAnonymizeAds';
import { AnonymizedContent } from '@/components/ads/AnonymizedContent';
import { AdsStatCard } from '@/components/ads/AdsStatCard';
import { AdsSyncStatusLine } from '@/components/ads/AdsSyncStatusLine';
import { useAdsLastSync } from '@/hooks/useAdsLastSync';
import { useAdsSyncJob } from '@/hooks/useAdsSyncJob';
import { useClientSettingsMutations } from '@/hooks/useClientSettingsMutations';
import {
  computePacingMetrics,
  formatAdsProjectName,
  getAdsMonthBounds,
  getRoasColor,
  mapClientSettingsRows,
  normalizeAdsAccountId,
  type AdsClientSettingsMap,
} from '@/utils/adsPacingUtils';

interface MetaCampaignData { campaign_id: string; campaign_name: string; status: string; cost: number; conversions_value?: number; conversions?: number; clicks?: number; impressions?: number; daily_budget?: number; original_client_name?: string; original_client_id?: string; date?: string; client_id?: string; client_name?: string; created_at?: string; }
interface SegmentationRule { id: string; account_id: string; keyword: string; virtual_name: string; platform: string; }
interface ClientPacing { client_id: string; client_name: string; is_group: boolean; budget: number; spent: number; progress: number; forecast: number; recommendedDaily: number; avgDailySpend: number; status: 'ok' | 'risk' | 'over' | 'under'; remainingBudget: number; total_conversions_val: number; campaigns: MetaCampaignData[]; isHidden: boolean; groupName?: string; isManualGroupBudget?: boolean; isSalesAccount: boolean; realIdsList: { id: string, name: string }[]; globalRoas: number; }

const getStatusConfig = (status: string, t: any) => {
  switch (status) {
    case 'over': return { color: 'bg-red-500', text: t('ads.status.exceeded', 'Excedido'), badgeClass: 'bg-red-100 text-red-700 border-red-200' };
    case 'risk': return { color: 'bg-amber-500', text: t('ads.status.risk', 'En riesgo'), badgeClass: 'bg-amber-100 text-amber-700 border-amber-200' };
    case 'under': return { color: 'bg-blue-500', text: t('ads.status.low', 'Bajo'), badgeClass: 'bg-blue-100 text-blue-700 border-blue-200' };
    default: return { color: 'bg-emerald-500', text: t('ads.status.ok', 'OK'), badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  }
};

interface RegisteredAccount {
  account_id: string;
  account_name: string;
  platform: string;
  is_active: boolean;
  currency?: string | null;
}

export default function MetaAdsPage() {
  const { t } = useTranslation('app');
  const { currentAgency } = useAgency();
  const { isActive: isAnonymized, anonymizer } = useAnonymizeAds();
  const [rawData, setRawData] = useState<MetaCampaignData[]>([]);
  const [clientSettings, setClientSettings] = useState<AdsClientSettingsMap>({});
  const [registeredAccounts, setRegisteredAccounts] = useState<RegisteredAccount[]>([]);
  const { formatMoney, formatGlobalMoney, currencySymbolForClient } = useAdsFormatMoney(registeredAccounts);
  const [loading, setLoading] = useState(true);
  const { google: googleSync, meta: metaSync, refresh: refreshLastSync } = useAdsLastSync();
  const googleConnected = Boolean(currentAgency?.google_ads_refresh_token);
  const metaConnected = Boolean(currentAgency?.meta_ads_access_token);
  const [segmentationRules, setSegmentationRules] = useState<SegmentationRule[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  /** Si es true, también se listan cuentas con gasto 0 € en el mes. Si es false (defecto), se ocultan. Misma lógica que Google Ads. */
  const [showZeroSpend, setShowZeroSpend] = useState(false);
  const [expandedSubAccounts, setExpandedSubAccounts] = useState<Record<string, boolean>>({});
  const [editingClient, setEditingClient] = useState<{ id: string, name: string, group: string, hidden: boolean, isSales: boolean } | null>(null);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [newRuleAccount, setNewRuleAccount] = useState('');
  const [openNewRuleAccount, setOpenNewRuleAccount] = useState(false);
  const [newRuleKeyword, setNewRuleKeyword] = useState('');
  const [newRuleName, setNewRuleName] = useState('');
  const monthBounds = useMemo(() => getAdsMonthBounds(), []);
  const { currentDay, daysInMonth, daysRemaining } = monthBounds;

  const fetchData = useCallback(async () => {
    if (!currentAgency?.id) return;
    try {
      const [adsRes, settingsRes, accountsRes, rulesRes] = await Promise.all([
        supabase.from('meta_ads_campaigns').select('*').eq('agency_id', currentAgency.id),
        supabase.from('client_settings').select('*').eq('agency_id', currentAgency.id),
        supabase.from('ad_accounts_config').select('*').eq('platform', 'meta').eq('is_active', true).eq('agency_id', currentAgency.id),
        supabase.from('segmentation_rules').select('*').eq('platform', 'meta').eq('agency_id', currentAgency.id)
      ]);
      setRawData(adsRes.data || []);
      setClientSettings(mapClientSettingsRows(settingsRes.data));
      setRegisteredAccounts(accountsRes.data || []);
      setSegmentationRules(rulesRes.data || []);
    } catch (error) { console.error('Error fetching data', error); } finally { setLoading(false); }
  }, [currentAgency?.id]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  useRefreshMissingAdCurrencies(
    currentAgency?.id,
    'meta',
    registeredAccounts,
    () => { void fetchData(); },
    !loading,
  );

  const {
    isSyncing,
    setIsSyncing,
    syncLogs,
    syncStatus,
    syncProgress,
    scrollRef,
    startSync: handleStartSync,
  } = useAdsSyncJob({
    platform: 'meta',
    agencyId: currentAgency?.id,
    onCompleted: fetchData,
    refreshLastSync,
  });

  const {
    saveBudget: handleSaveBudget,
    saveClientConfig,
  } = useClientSettingsMutations({
    agencyId: currentAgency?.id,
    setClientSettings,
    refresh: fetchData,
    budgetErrorMessage: t('common.errorSaving', 'Error guardando'),
    configSuccessMessage: t('common.saved', 'Guardado'),
  });

  const handleAddRule = async () => {
    if (!newRuleAccount || !newRuleKeyword || !newRuleName) { toast.error(t('common.fillRequiredFields', 'Rellena todos los campos')); return; }
    if (!currentAgency?.id) { toast.error("No hay agencia seleccionada"); return; }
    const { data, error } = await supabase.from('segmentation_rules').insert({ platform: 'meta', account_id: newRuleAccount, keyword: newRuleKeyword, virtual_name: newRuleName, agency_id: currentAgency.id }).select();
    if (error) toast.error("Error: " + error.message);
    else { setSegmentationRules(prev => [...prev, ...(data || [])]); setNewRuleKeyword(''); setNewRuleName(''); toast.success(t('common.saved', 'Regla guardada')); }
  };

  const handleDeleteRule = async (id: string) => {
    const { error } = await supabase.from('segmentation_rules').delete().eq('id', id);
    if (error) toast.error("Error: " + error.message);
    else { setSegmentationRules(prev => prev.filter(r => r.id !== id)); toast.info("Regla eliminada"); }
  };

  const handleSaveClientSettings = async () => {
    if (!editingClient) return;
    await saveClientConfig(editingClient);
    setEditingClient(null);
  };

  const reportData = useMemo(() => {
    if (!rawData.length) return [];
    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const stats = new Map<string, { name: string, spent: number, budget: number, total_conversions_val: number, is_group: boolean, isHidden: boolean, isSalesAccount: boolean, realIds: string[], realIdsNames: { id: string, name: string }[], campaigns: MetaCampaignData[], isManualGroupBudget: boolean }>();

    registeredAccounts.forEach(acc => {
      const settings = clientSettings[acc.account_id] || { budget: 0, group_name: '', is_hidden: false, is_sales_account: true };
      const groupKey = settings.group_name?.trim() ? `GROUP-${settings.group_name}` : acc.account_id;
      if (!settings.group_name?.trim() && !stats.has(groupKey)) {
        stats.set(groupKey, { name: acc.account_name || acc.account_id, spent: 0, budget: settings.budget || 0, total_conversions_val: 0, is_group: false, isHidden: settings.is_hidden, isSalesAccount: settings.is_sales_account !== false, realIds: [acc.account_id], realIdsNames: [{ id: acc.account_id, name: acc.account_name }], campaigns: [], isManualGroupBudget: false });
      }
    });

    rawData.forEach(row => {
      // Filtrar por mes actual (compara YYYY-MM, no fecha exacta)
      if (row.date && row.date.startsWith(currentMonthPrefix)) {
        // NOTA: Se removió filtro isRegistered - causaba ocultación de datos

        let finalId = row.client_id, finalName = row.client_name || row.client_id; // Fallback: usar ID si no hay nombre
        const rulesForAccount = segmentationRules.filter(r => normalizeAdsAccountId(r.account_id, 'meta') === normalizeAdsAccountId(row.client_id, 'meta'));
        if (rulesForAccount.length > 0) { const match = rulesForAccount.find(r => row.campaign_name.toLowerCase().includes(r.keyword.toLowerCase())); if (match) { finalId = `${row.client_id}_${match.keyword.toUpperCase()}`; finalName = match.virtual_name; } }
        const settings = clientSettings[finalId] || { budget: 0, group_name: '', is_hidden: false, is_sales_account: true };
        const groupKey = settings.group_name?.trim() ? `GROUP-${settings.group_name}` : finalId;
        const displayName = settings.group_name?.trim() ? settings.group_name : finalName;
        const isGroupManual = groupKey.startsWith('GROUP-') && (clientSettings[groupKey]?.budget > 0);
        const isIndividualManual = !groupKey.startsWith('GROUP-') && settings.budget > 0;
        if (!stats.has(groupKey)) { stats.set(groupKey, { name: displayName, spent: 0, budget: 0, total_conversions_val: 0, is_group: groupKey.startsWith('GROUP-'), isHidden: settings.is_hidden, isSalesAccount: settings.is_sales_account !== false, realIds: [], realIdsNames: [], campaigns: [], isManualGroupBudget: isGroupManual }); }
        const entry = stats.get(groupKey)!;
        entry.spent += Number(row.cost || 0); entry.total_conversions_val += Number(row.conversions_value || 0);
        if (!entry.realIds.includes(finalId)) { entry.realIds.push(finalId); entry.realIdsNames.push({ id: finalId, name: finalName }); if (!entry.is_group && isIndividualManual) entry.budget = settings.budget; }
        if (
          Number(row.cost) > 0
          || Number(row.impressions) > 0
          || row.status === 'ACTIVE'
          || row.status === 'PAUSED'
        ) {
          entry.campaigns.push({ ...row, original_client_name: finalName, original_client_id: finalId, cost: Number(row.cost), conversions_value: Number(row.conversions_value), conversions: Number(row.conversions), clicks: Number(row.clicks), impressions: Number(row.impressions) });
        }
      }
    });

    const report: ClientPacing[] = [];
    stats.forEach((value, key) => {
      let finalBudget = 0;
      if (value.is_group) {
        const groupSettings = clientSettings[key.replace('GROUP-', '')] || clientSettings[key];
        if (groupSettings?.budget > 0) finalBudget = groupSettings.budget;
      } else if (value.budget > 0) {
        finalBudget = value.budget;
      }
      const spent = value.spent;
      const {
        avgDailySpend,
        forecast,
        progress,
        remainingBudget,
        recommendedDaily,
        status,
      } = computePacingMetrics({
        spent,
        budget: finalBudget,
        month: monthBounds,
      });
      const globalRoas = spent > 0 ? value.total_conversions_val / spent : 0;
      report.push({ client_id: key, client_name: value.name, is_group: value.is_group, budget: finalBudget, spent, progress, forecast, recommendedDaily, avgDailySpend, status, remainingBudget, total_conversions_val: value.total_conversions_val, isHidden: value.isHidden, isSalesAccount: value.isSalesAccount, groupName: value.is_group ? value.name : undefined, isManualGroupBudget: value.isManualGroupBudget, realIdsList: value.realIdsNames, campaigns: value.campaigns.sort((a, b) => b.cost - a.cost), globalRoas });
    });
    let filtered = report;
    if (!showHidden) filtered = filtered.filter(c => !c.isHidden);
    if (!showZeroSpend) {
      filtered = filtered.filter(c =>
        c.spent > 0 || c.campaigns.some(camp => camp.status === 'ACTIVE' || camp.status === 'PAUSED')
      );
    }
    if (searchTerm) { const lower = searchTerm.toLowerCase(); filtered = filtered.filter(c => c.client_name.toLowerCase().includes(lower) || c.campaigns.some(camp => camp.campaign_name.toLowerCase().includes(lower))); }
    return filtered.sort((a, b) => b.spent - a.spent);
  }, [rawData, clientSettings, registeredAccounts, searchTerm, showHidden, showZeroSpend, segmentationRules, currentDay, daysInMonth, daysRemaining, monthBounds]);

  const globalStats = useMemo(() => {
    const totalBudget = reportData.reduce((acc, r) => acc + r.budget, 0), totalSpent = reportData.reduce((acc, r) => acc + r.spent, 0);
    const totalRevenue = reportData.reduce((acc, r) => acc + r.total_conversions_val, 0);
    const totalRecommendedDaily = reportData.reduce((acc, r) => acc + r.recommendedDaily, 0);
    const atRisk = reportData.filter(r => r.status === 'risk' || r.status === 'over').length, globalRoas = totalSpent > 0 ? totalRevenue / totalSpent : 0;
    return { totalBudget, totalSpent, totalRevenue, totalRecommendedDaily, atRisk, globalRoas };
  }, [reportData]);

  const uniqueAccountsForSelector = useMemo(() => {
    const unique = new Map();
    rawData.forEach(r => unique.set(r.client_id, r.client_name));
    registeredAccounts.forEach(acc => unique.set(acc.account_id, acc.account_name));
    return Array.from(unique.entries()).map(([id, name]) => ({ id, name }));
  }, [rawData, registeredAccounts]);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 pb-20">
      <div className="flex flex-col gap-4 min-w-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-lg shadow-blue-500/20"><Facebook className="w-6 h-6 text-white" /></div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{t('ads.meta', 'Meta Ads')}</h1>
              <div className="mt-1 space-y-1">
                <AdsSyncStatusLine
                  google={googleSync}
                  meta={metaSync}
                  googleConnected={googleConnected}
                  metaConnected={metaConnected}
                  primaryPlatform="meta"
                />
                <Badge variant="outline" className="text-xs w-fit">
                  <Calendar className="w-3 h-3 mr-1" />
                  {t('ads.dayProgress', { current: currentDay, total: daysInMonth, defaultValue: `Día ${currentDay} de ${daysInMonth}` })}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Button variant="outline" onClick={() => setIsSplitModalOpen(true)} className="flex-1 md:flex-none">
              <Scissors className="w-4 h-4 mr-2" /> {t('ads.actions.split', 'Dividir')}
            </Button>
            <Button onClick={handleStartSync} disabled={isSyncing} className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700">
              <RefreshCw className={cn("w-4 h-4 mr-2", isSyncing && "animate-spin")} />
              {isSyncing ? t('ads.actions.syncing', 'Sincronizando...') : t('ads.actions.sync', 'Sincronizar')}
            </Button>
          </div>
        </div>

        {/* Ritmo vs objetivo: el presupuesto mensual lo define el usuario en Taimbox; la API de Meta no aporta un “presupuesto diario” equivalente al de Google Ads en esta integración */}
        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2 sm:gap-3 min-w-0">
          <AdsStatCard icon={Target} label={t('ads.stats.investment', 'Inversión')} value={formatGlobalMoney(globalStats.totalSpent)} subValue={t('ads.stats.ofBudget', { amount: formatGlobalMoney(globalStats.totalBudget), defaultValue: `de ${formatGlobalMoney(globalStats.totalBudget)}` })} color="blue" />
          <AdsStatCard icon={TrendingUp} label={t('ads.stats.conversions', 'Conversiones')} value={reportData.reduce((acc, r) => acc + r.campaigns.reduce((a, c) => a + (c.conversions || 0), 0), 0).toFixed(0)} subValue={t('ads.stats.value', { amount: formatGlobalMoney(globalStats.totalRevenue), defaultValue: `Valor ${formatGlobalMoney(globalStats.totalRevenue)}` })} color="emerald" />
          <AdsStatCard icon={Target} label={t('ads.table.roas', 'ROAS')} value={`${globalStats.globalRoas.toFixed(2)}x`} subValue={globalStats.globalRoas >= 2 ? `✓ ${t('ads.status.goal', 'Objetivo')}` : globalStats.globalRoas >= 1 ? t('ads.status.acceptable', 'Aceptable') : t('ads.status.below', 'Por debajo')} color={globalStats.globalRoas >= 2 ? 'emerald' : globalStats.globalRoas >= 1 ? 'amber' : 'red'} />
          <AdsStatCard icon={Calendar} label={t('ads.stats.daysRemaining', 'Días restantes')} value={daysRemaining.toString()} subValue={t('ads.stats.monthProgress', { percent: Math.round((currentDay / daysInMonth) * 100), defaultValue: `${Math.round((currentDay / daysInMonth) * 100)}% del mes` })} color="slate" />
          <AdsStatCard icon={AlertTriangle} label={t('ads.stats.atRisk', 'En riesgo')} value={globalStats.atRisk.toString()} subValue={t('ads.stats.accountsCount', { count: globalStats.atRisk, defaultValue: 'cuentas' })} color={globalStats.atRisk > 0 ? 'red' : 'slate'} />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-center bg-white p-3 rounded-xl border shadow-sm">
          <div className="relative flex-1 w-full"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input placeholder={t('ads.filters.searchPlaceholder', 'Buscar cuenta o campaña...')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 bg-slate-50 border-slate-200" />{searchTerm && <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setSearchTerm('')}><X className="h-3 w-3" /></Button>}</div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2">
              <Switch id="show-hidden-meta" checked={showHidden} onCheckedChange={setShowHidden} />
              <Label htmlFor="show-hidden-meta" className="text-sm text-slate-600 cursor-pointer flex items-center gap-1">
                {showHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                {t('ads.filters.showHidden', 'Ocultos')}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="show-zero-spend-meta" checked={showZeroSpend} onCheckedChange={setShowZeroSpend} />
              <Label htmlFor="show-zero-spend-meta" className="text-sm text-slate-600 cursor-pointer">
                {t('ads.filters.showZeroSpend', 'Sin inversión (0 €)')}
              </Label>
            </div>
            <span className="text-sm text-slate-500">{t('ads.stats.accountsTotal', { count: reportData.length, defaultValue: `${reportData.length} cuentas` })}</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <Accordion type="single" collapsible className="space-y-2">
          {reportData.map((client) => {
            const statusConfig = getStatusConfig(client.status, t);
            const paceDiff = client.avgDailySpend - client.recommendedDaily;
            const isPaceTooHigh =
              client.budget > 0 &&
              client.recommendedDaily > 0 &&
              paceDiff > 0 &&
              (client.status === 'risk' || client.status === 'over');
            return (
              <AccordionItem key={client.client_id} value={client.client_id} className={cn("bg-white border rounded-xl shadow-sm overflow-hidden", client.isHidden && "opacity-60 border-dashed")}>
                <AccordionTrigger className="hover:no-underline py-4 px-4 group">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between w-full pr-4 gap-4">
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <div className={cn("w-1.5 h-12 rounded-full", statusConfig.color)} />
                      <div className="text-left">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div>
                            <AnonymizedContent isActive={isAnonymized} className="font-bold text-lg text-slate-900" asBlock placeholder={anonymizer.account(client.client_id)}>{formatAdsProjectName(client.client_name)}</AnonymizedContent>
                            {isAnonymized && (client.realIdsList[0]?.id || client.client_id) && (
                              <div className="text-[10px] font-mono text-slate-400 mt-0.5">ID: {client.realIdsList[0]?.id || client.client_id}</div>
                            )}
                          </div>
                          {client.is_group && <Badge variant="secondary" className="text-[10px] gap-1"><Layers className="w-3 h-3" /> GRUPO</Badge>}
                          <Badge variant="outline" className={cn("text-[10px]", statusConfig.badgeClass)}>{statusConfig.text}</Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">{client.isSalesAccount && client.globalRoas > 0 && <Badge variant="outline" className={cn("text-[10px] h-5", getRoasColor(client.globalRoas))}>ROAS {client.globalRoas.toFixed(2)}</Badge>}{client.isHidden && <Badge variant="outline" className="text-[10px] h-5 gap-1"><EyeOff className="w-3 h-3" /> Oculto</Badge>}</div>
                      </div>
                    </div>
                    {client.budget > 0 && <div className="hidden lg:flex flex-col flex-1 max-w-xs mx-4"><div className="flex justify-between text-[10px] text-slate-500 mb-1"><span>{client.progress.toFixed(0)}% gastado</span><span>Proy: {formatMoney(client.forecast, client.client_id)}</span></div><Progress value={Math.min(client.progress, 100)} className={cn("h-2", client.status === 'over' && "[&>div]:bg-red-500", client.status === 'risk' && "[&>div]:bg-amber-500", client.status === 'ok' && "[&>div]:bg-blue-500")} /></div>}
                    <div className="flex items-center gap-4 lg:gap-6 justify-end">
                      {client.isSalesAccount && client.total_conversions_val > 0 && <div className="text-right hidden sm:block"><div className="text-[10px] uppercase text-slate-400 font-medium">Valor</div><div className="text-lg font-bold text-emerald-600">{formatMoney(client.total_conversions_val, client.client_id)}</div></div>}
                      <div className="text-right"><div className="text-[10px] uppercase text-slate-400 font-medium">Invertido</div><div className="text-xl font-bold text-slate-900">{formatMoney(client.spent, client.client_id)}</div></div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            role="button"
                            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 cursor-pointer")}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!client.is_group) setEditingClient({ id: client.client_id, name: client.client_name, group: clientSettings[client.client_id]?.group_name || '', hidden: clientSettings[client.client_id]?.is_hidden || false, isSales: clientSettings[client.client_id]?.is_sales_account !== false });
                              else toast.info("Abre el grupo para editar");
                            }}
                          >
                            <Settings className="w-4 h-4 text-slate-400" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>Configurar</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="border-t bg-slate-50/50">
                  <div className="p-4 space-y-6">
                    <div className="grid lg:grid-cols-2 gap-6">
                      <div className="bg-white p-4 rounded-lg border space-y-4">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <Label className="text-sm font-medium text-slate-700">
                              {t('ads.pacing.monthlyBudget', { type: client.is_group ? t('ads.status.total', 'Total') : t('ads.status.monthly', 'Mensual'), defaultValue: `Presupuesto ${client.is_group ? 'Total' : 'Mensual'} objetivo` })}
                            </Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400">{currencySymbolForClient(client.client_id, client.realIdsList.map((r) => r.id))}</span>
                            <Input
                              key={`${client.client_id}-${client.budget}`}
                              type="number"
                              defaultValue={clientSettings[client.client_id]?.budget > 0 ? clientSettings[client.client_id]?.budget : ''}
                              onBlur={(e) => handleSaveBudget(client.client_id, e.target.value)}
                              className="h-8 w-28 text-right"
                              placeholder={client.budget.toFixed(0)}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs text-slate-500">
                            <span>{t('common.consumption', 'Consumo')} ({client.progress.toFixed(1)}%)</span>
                            <span className={client.remainingBudget <= 0 ? 'text-red-500 font-bold' : ''}>
                              {t('ads.pacing.available', { amount: formatMoney(client.remainingBudget, client.client_id), defaultValue: `Disponible: ${formatMoney(client.remainingBudget, client.client_id)}` })}
                            </span>
                          </div>
                          <Progress value={Math.min(client.progress, 100)} className={cn("h-2.5", client.status === 'over' && "[&>div]:bg-red-500", client.status === 'risk' && "[&>div]:bg-amber-500", client.status === 'ok' && "[&>div]:bg-blue-500")} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className={cn("p-3 rounded-lg border-2 text-center", isPaceTooHigh ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200")}>
                            <div className="text-[10px] uppercase text-slate-500 font-medium mb-1">{t('common.actualDaily', 'Gasto medio diario')}</div>
                            <div className={cn("text-xl font-bold", isPaceTooHigh ? "text-amber-600" : "text-slate-700")}>{formatMoney(client.avgDailySpend, client.client_id)}</div>
                            <div className="text-[10px] text-slate-400 mt-1">{t('ads.status.soFarThisMonth', 'en lo que va de mes')}</div>
                          </div>
                          <div className="p-3 rounded-lg border-2 text-center bg-emerald-50 border-emerald-200">
                            <div className="text-[10px] uppercase text-slate-500 font-medium mb-1">{t('ads.pacing.recommendedDaily', 'Objetivo medio diario')}</div>
                            <div className="text-xl font-bold text-emerald-600">{formatMoney(client.recommendedDaily, client.client_id)}</div>
                            <div className="text-[10px] text-slate-400 mt-1">{t('ads.pacing.recommendedDailySub', 'para cerrar el mes en el presupuesto')}</div>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-snug">
                          <Trans
                            i18nKey="ads.pacing.metaNote"
                            t={t}
                            components={{ strong: <strong className="text-slate-600" /> }}
                          />
                        </p>
                        {isPaceTooHigh && paceDiff > 1 && (
                          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>
                              El ritmo de gasto va por encima del objetivo para no superar el presupuesto mensual. Revisa y ajusta los límites en Meta Ads según tu estructura (campaña, conjunto o cuenta publicitaria).
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm text-slate-600 cursor-help border-b border-dotted border-slate-300">
                                {t('ads.pacing.forecastTitle', 'Proyección fin de mes')}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs text-xs">
                              {t('ads.pacing.forecastTooltip', 'Usa el gasto medio diario del mes (invertido ÷ días transcurridos) proyectado al calendario completo. Si cambiaste el ritmo recientemente, puede no coincidir con el objetivo medio diario; ese valor es el ritmo para cerrar en el presupuesto objetivo de Taimbox.')}
                            </TooltipContent>
                          </Tooltip>
                          <span className={cn("font-bold shrink-0", client.forecast > client.budget ? "text-red-600" : "text-slate-700")}>{formatMoney(client.forecast, client.client_id)}</span>
                        </div>
                      </div>
                      <div className="bg-white rounded-lg border overflow-hidden">
                        <div className="max-h-[350px] overflow-y-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0 border-b">
                              <tr>
                                <th className="px-3 py-2.5 text-left">{t('ads.table.campaign', 'Campaña')}</th>
                                <th className="px-2 py-2.5 text-right">{t('ads.table.spent', 'Gasto')}</th>
                                <th className="px-2 py-2.5 text-right">{t('ads.stats.valueLabel', 'Valor')}</th>
                                {client.isSalesAccount && <th className="px-2 py-2.5 text-center">{t('ads.table.roas', 'ROAS')}</th>}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {client.campaigns.map((camp, idx) => {
                                const roas = camp.cost > 0 ? (camp.conversions_value || 0) / camp.cost : 0;
                                return (
                                  <tr key={idx} className="hover:bg-slate-50">
                                    <td className="px-3 py-2.5">
                                      <div className="space-y-1">
                                        <AnonymizedContent isActive={isAnonymized} className="font-medium text-slate-700 line-clamp-2" placeholder={anonymizer.campaign(camp.campaign_id)}>
                                          {camp.campaign_name}
                                        </AnonymizedContent>
                                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                          <span className="flex items-center gap-1">
                                            <span className={cn("w-1.5 h-1.5 rounded-full", camp.status === 'ENABLED' ? 'bg-emerald-400' : 'bg-slate-300')} />
                                            {camp.status === 'ENABLED' ? t('ads.table.active', 'Activa') : t('ads.table.paused', 'Pausada')}
                                          </span>
                                          {client.is_group && (camp.original_client_name || camp.original_client_id) && (
                                            <AnonymizedContent isActive={isAnonymized} className="truncate max-w-[100px]" placeholder={anonymizer.account(camp.original_client_id || camp.client_id || '')}>
                                              | {formatAdsProjectName(camp.original_client_name || '')}
                                            </AnonymizedContent>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-2 py-2.5 text-right font-medium text-slate-900">{formatMoney(camp.cost, camp.original_client_id || camp.client_id || client.client_id)}</td>
                                    <td className="px-2 py-2.5 text-right text-emerald-600">{formatMoney(camp.conversions_value || 0, camp.original_client_id || camp.client_id || client.client_id)}</td>
                                    {client.isSalesAccount && (
                                      <td className="px-2 py-2.5 text-center">
                                        <Badge variant="outline" className={cn("text-[10px]", getRoasColor(roas))}>
                                          {roas.toFixed(2)}
                                        </Badge>
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                              {client.campaigns.length === 0 && (
                                <tr>
                                  <td colSpan={4} className="px-3 py-8 text-center text-slate-400">
                                    {t('ads.table.noCampaigns', 'Sin campañas')}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {/* Cuentas vinculadas - Tabla de desglose */}
                    {client.is_group && (
                      <div className="bg-white p-4 rounded-lg border mt-6">
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                          <Layers className="w-3.5 h-3.5" /> {t('ads.table.breakdown', { count: client.realIdsList.length, defaultValue: `Desglose por Cuenta (${client.realIdsList.length})` })}
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-slate-50 text-slate-500 font-medium border-b">
                              <tr>
                                <th className="px-3 py-2 text-left w-6"></th>
                                <th className="px-3 py-2 text-left">{t('ads.table.account', 'Cuenta')}</th>
                                <th className="px-2 py-2 text-right">{t('ads.table.spent', 'Gasto')}</th>
                                <th className="px-2 py-2 text-right">{t('ads.table.groupPct', '% Grupo')}</th>
                                <th className="px-2 py-2 text-right">{t('ads.table.conv', 'Conv')}</th>
                                <th className="px-2 py-2 text-center">{t('ads.table.roas', 'ROAS')}</th>
                                <th className="px-2 py-2 text-center" />
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {client.realIdsList.map(sub => {
                                const subCampaigns = client.campaigns.filter(c => c.original_client_id === sub.id || c.client_id === sub.id);
                                const subSpent = subCampaigns.reduce((a, c) => a + c.cost, 0);
                                const subConv = subCampaigns.reduce((a, c) => a + (c.conversions || 0), 0);
                                const subValue = subCampaigns.reduce((a, c) => a + (c.conversions_value || 0), 0);
                                const subRoas = subSpent > 0 ? subValue / subSpent : 0;
                                const pctOfGroup = client.spent > 0 ? (subSpent / client.spent) * 100 : 0;

                                const isExpanded = expandedSubAccounts[sub.id];

                                return (
                                  <>
                                    <tr key={sub.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setExpandedSubAccounts(prev => ({ ...prev, [sub.id]: !prev[sub.id] }))}>
                                      <td className="px-3 py-2.5 text-slate-400">
                                        {isExpanded ? <TrendingDown className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                      </td>
                                      <td className="px-3 py-2.5 font-medium text-slate-700">
                                        <div>
                                          <AnonymizedContent isActive={isAnonymized} placeholder={anonymizer.account(sub.id)}>{formatAdsProjectName(sub.name)}</AnonymizedContent>
                                          {isAnonymized && <div className="text-[10px] font-mono text-slate-400 mt-0.5">ID: {sub.id}</div>}
                                        </div>
                                      </td>
                                      <td className="px-2 py-2.5 text-right font-medium text-slate-900">{formatMoney(subSpent, sub.id)}</td>
                                      <td className="px-2 py-2.5 text-right text-slate-500">{pctOfGroup.toFixed(1)}%</td>
                                      <td className="px-2 py-2.5 text-right text-emerald-600">{subConv.toFixed(0)}</td>
                                      <td className="px-2 py-2.5 text-center"><Badge variant="outline" className={cn("text-[10px]", getRoasColor(subRoas))}>{subRoas.toFixed(2)}</Badge></td>
                                      <td className="px-2 py-2.5 text-center">
                                        <button onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingClient({ id: sub.id, name: sub.name, group: client.groupName || '', hidden: false, isSales: true });
                                        }} className="text-slate-400 hover:text-blue-500">
                                          <Settings className="w-3.5 h-3.5" />
                                        </button>
                                      </td>
                                    </tr>
                                    {isExpanded && (
                                      <tr className="bg-slate-50">
                                        <td colSpan={7} className="p-3">
                                          <div className="bg-white rounded border overflow-hidden">
                                            <table className="w-full text-xs">
                                              <thead className="bg-slate-50/50 text-slate-400 border-b">
                                                <tr>
                                                  <th className="px-3 py-2 text-left">{t('ads.table.campaign', 'Campaña')}</th>
                                                  <th className="px-2 py-2 text-right">{t('ads.table.spent', 'Gasto')}</th>
                                                  <th className="px-2 py-2 text-right">{t('ads.table.conv', 'Conv')}</th>
                                                  <th className="px-2 py-2 text-center">{t('ads.table.roas', 'ROAS')}</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {subCampaigns.sort((a, b) => b.cost - a.cost).map(camp => {
                                                  const campRoas = camp.cost > 0 ? (camp.conversions_value || 0) / camp.cost : 0;
                                                  return (
                                                    <tr key={camp.campaign_id} className="border-b last:border-0 hover:bg-slate-50">
                                                      <td className="px-3 py-2 font-medium text-slate-600 truncate max-w-[200px]">
                                                        <AnonymizedContent isActive={isAnonymized} placeholder={anonymizer.campaign(camp.campaign_id)}>
                                                          {camp.campaign_name}
                                                        </AnonymizedContent>
                                                      </td>
                                                      <td className="px-2 py-2 text-right font-medium text-slate-700">
                                                        {formatMoney(camp.cost, sub.id)}
                                                      </td>
                                                      <td className="px-2 py-2 text-right text-emerald-600">
                                                        {(camp.conversions || 0).toFixed(0)}
                                                      </td>
                                                      <td className="px-2 py-2 text-center">
                                                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded", getRoasColor(campRoas))}>
                                                          {campRoas.toFixed(2)}
                                                        </span>
                                                      </td>
                                                    </tr>
                                                  );
                                                })}
                                                {subCampaigns.length === 0 && <tr><td colSpan={5} className="p-3 text-center text-slate-400">{t('ads.table.noCampaigns', 'Sin campañas')}</td></tr>}
                                              </tbody>
                                            </table>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
        {reportData.length === 0 && !loading && (
          <div className="text-center py-12 bg-white rounded-xl border">
            <Facebook className="w-12 h-12 mx-auto text-blue-200" />
            <h3 className="text-lg font-medium text-slate-700 mt-4">{t('ads.status.noData', 'Sin datos')}</h3>
            <p className="text-sm text-slate-500 mt-1">{t('ads.status.syncPrompt', 'Sincroniza para cargar cuentas')}</p>
          </div>
        )}
      </div>

      <Dialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('ads.dialogs.configAccount.title', 'Configurar cuenta')}</DialogTitle>
            <DialogDescription>{editingClient?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('ads.dialogs.configAccount.groupName', 'Nombre del grupo (Holding)')}</Label>
              <Input
                value={editingClient?.group || ''}
                onChange={(e) => setEditingClient(prev => prev ? { ...prev, group: e.target.value } : null)}
                placeholder={t('ads.dialogs.configAccount.groupPlaceholder', 'Ej: Grupo ABC')}
              />
              <p className="text-xs text-slate-500">{t('ads.dialogs.configAccount.groupNoteShort', 'Las cuentas del mismo grupo se consolidan.')}</p>
            </div>
            <div className="flex justify-between items-center py-3 border-t">
              <div>
                <Label>{t('ads.dialogs.configAccount.salesAccount', 'Cuenta de ventas (ROAS)')}</Label>
                <p className="text-xs text-slate-500">{t('ads.dialogs.configAccount.salesAccountNoteShort', 'Mostrar conversiones')}</p>
              </div>
              <Switch checked={editingClient?.isSales !== false} onCheckedChange={(c) => setEditingClient(prev => prev ? { ...prev, isSales: c } : null)} />
            </div>
            <div className="flex justify-between items-center py-3 border-t">
              <div>
                <Label>{t('ads.dialogs.configAccount.hideAccount', 'Ocultar cuenta')}</Label>
                <p className="text-xs text-slate-500">{t('ads.dialogs.configAccount.hideAccountNoteShort', 'No aparecerá en la lista')}</p>
              </div>
              <Switch checked={editingClient?.hidden || false} onCheckedChange={(c) => setEditingClient(prev => prev ? { ...prev, hidden: c } : null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingClient(null)}>{t('ads.actions.cancel', 'Cancelar')}</Button>
            <Button onClick={handleSaveClientSettings}>{t('ads.actions.save', 'Guardar')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSplitModalOpen} onOpenChange={setIsSplitModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scissors className="w-5 h-5" /> {t('ads.dialogs.splitAccounts.title', 'Dividir Cuentas')}
            </DialogTitle>
            <DialogDescription>{t('ads.dialogs.splitAccounts.descriptionShort', 'Separa campañas por palabra clave en cuentas virtuales.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-12 gap-3 items-end bg-slate-50 p-4 rounded-lg border">
              <div className="col-span-12 sm:col-span-4 space-y-1">
                <Label className="text-xs font-medium">{t('ads.dialogs.splitAccounts.sourceAccount', 'Cuenta Origen')}</Label>
                <Popover open={openNewRuleAccount} onOpenChange={setOpenNewRuleAccount}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-normal bg-white">
                      <span className="truncate">{newRuleAccount ? (uniqueAccountsForSelector.find(a => a.id === newRuleAccount)?.name || uniqueAccountsForSelector.find(a => a.id === newRuleAccount)?.id || t('ads.dialogs.splitAccounts.selectAccount', 'Selecciona...')) : t('ads.dialogs.splitAccounts.selectAccount', 'Selecciona...')}</span>
                      <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder={t('ads.filters.searchPlaceholder', 'Buscar cuenta o ID...')} className="h-9" />
                      <CommandList className="max-h-[280px]">
                        <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">{t('common.noResults', 'Ninguna cuenta coincide.')}</CommandEmpty>
                        <CommandGroup>
                          {uniqueAccountsForSelector.map((acc) => (
                            <CommandItem
                              key={acc.id}
                              value={`${acc.name || ''} ${acc.id}`}
                              onSelect={() => {
                                setNewRuleAccount(acc.id);
                                setOpenNewRuleAccount(false);
                              }}
                            >
                              <Check className={cn('mr-2 h-4 w-4 shrink-0', newRuleAccount === acc.id ? 'opacity-100' : 'opacity-0')} />
                              <span className="truncate">{acc.name || acc.id}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="col-span-6 sm:col-span-3 space-y-1">
                <Label className="text-xs font-medium">{t('ads.dialogs.splitAccounts.ifContains', 'Si contiene...')}</Label>
                <Input placeholder="Ej: Loro" className="bg-white" value={newRuleKeyword} onChange={e => setNewRuleKeyword(e.target.value)} />
              </div>
              <div className="col-span-6 sm:col-span-3 space-y-1">
                <Label className="text-xs font-medium">{t('ads.dialogs.splitAccounts.createAccount', 'Crear cuenta...')}</Label>
                <Input placeholder="Ej: Loro Parque" className="bg-white" value={newRuleName} onChange={e => setNewRuleName(e.target.value)} />
              </div>
              <div className="col-span-12 sm:col-span-2">
                <Button onClick={handleAddRule} className="w-full">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase">{t('ads.dialogs.splitAccounts.activeRules', { count: segmentationRules.length, defaultValue: `Reglas Activas (${segmentationRules.length})` })}</h4>
              {segmentationRules.length === 0 ? (
                <p className="text-sm text-slate-400 italic py-4 text-center">{t('ads.dialogs.splitAccounts.noRules', 'No hay reglas')}</p>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {segmentationRules.map(rule => (
                    <div key={rule.id} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Badge variant="outline" className="font-mono text-xs">{normalizeAdsAccountId(rule.account_id, 'meta').slice(0, 10)}...</Badge>
                        <span className="text-sm text-slate-500">
                          {t('ads.dialogs.splitAccounts.ifContainsLabel', { keyword: rule.keyword, defaultValue: `Si contiene "${rule.keyword}"` })}
                        </span>
                        <span className="text-slate-300">→</span>
                        <span className="font-bold text-blue-600">{rule.virtual_name}</span>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteRule(rule.id)} className="text-red-500 hover:bg-red-50 h-8 w-8">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isSyncing} onOpenChange={(open) => { if (syncStatus !== 'running') setIsSyncing(open); }}>
        <DialogContent className="sm:max-w-md bg-slate-950 text-slate-100 border-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              {syncStatus === 'running' && <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />}
              {syncStatus === 'completed' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
              {t('ads.dialogs.sync.title', { platform: 'Meta Ads' })}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {syncStatus === 'running' ? t('ads.dialogs.sync.connecting', 'Conectando...') : t('ads.dialogs.sync.finished', 'Finalizado')}
            </DialogDescription>
          </DialogHeader>
          <Progress value={syncProgress} className="h-2 bg-slate-800 [&>div]:bg-blue-500" />
          <div className="bg-black/50 rounded-lg p-4 font-mono text-xs text-blue-400 h-64 overflow-hidden border border-slate-800">
            <div className="h-full overflow-y-auto space-y-1" ref={scrollRef}>
              {syncLogs.map((log, i) => <div key={i} className="break-words">{log}</div>)}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
