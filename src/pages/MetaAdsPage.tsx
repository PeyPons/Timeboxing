import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RefreshCw, Clock, Search, Settings, Layers, TrendingUp, TrendingDown, Scissors, Plus, Trash2, AlertTriangle, CheckCircle2, Calendar, Target, ArrowDownRight, Eye, EyeOff, X, Facebook } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MetaCampaignData { campaign_id: string; campaign_name: string; status: string; cost: number; conversions_value?: number; conversions?: number; clicks?: number; impressions?: number; daily_budget?: number; original_client_name?: string; original_client_id?: string; }
interface SegmentationRule { id: string; account_id: string; keyword: string; virtual_name: string; platform: string; }
interface ClientPacing { client_id: string; client_name: string; is_group: boolean; budget: number; spent: number; progress: number; forecast: number; recommendedDaily: number; avgDailySpend: number; currentDailyBudget: number; status: 'ok' | 'risk' | 'over' | 'under'; remainingBudget: number; total_conversions_val: number; campaigns: MetaCampaignData[]; isHidden: boolean; groupName?: string; isManualGroupBudget?: boolean; isSalesAccount: boolean; realIdsList: {id: string, name: string}[]; globalRoas: number; }

const formatProjectName = (name: string) => name.replace(/^(Cliente|Client|Cuenta|Account)\s*[-:]?\s*/i, '');
const normalizeId = (id: string) => id ? id.replace(/^act_/, '').trim() : '';
const getRoasColor = (roas: number) => { if (roas >= 4) return "text-emerald-600 bg-emerald-50 border-emerald-200"; if (roas >= 2) return "text-blue-600 bg-blue-50 border-blue-200"; if (roas >= 1) return "text-amber-600 bg-amber-50 border-amber-200"; return "text-red-600 bg-red-50 border-red-200"; };
const getStatusConfig = (status: string) => { switch (status) { case 'over': return { color: 'bg-red-500', text: 'Excedido', badgeClass: 'bg-red-100 text-red-700 border-red-200' }; case 'risk': return { color: 'bg-amber-500', text: 'En riesgo', badgeClass: 'bg-amber-100 text-amber-700 border-amber-200' }; case 'under': return { color: 'bg-blue-500', text: 'Bajo', badgeClass: 'bg-blue-100 text-blue-700 border-blue-200' }; default: return { color: 'bg-emerald-500', text: 'OK', badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200' }; } };

function StatCard({ icon: Icon, label, value, subValue, color = 'slate' }: { icon: any; label: string; value: string; subValue?: string; color?: string; }) {
  const colorClasses: Record<string, string> = { slate: 'bg-slate-50 border-slate-200', blue: 'bg-blue-50 border-blue-200', emerald: 'bg-emerald-50 border-emerald-200', amber: 'bg-amber-50 border-amber-200', red: 'bg-red-50 border-red-200' };
  return (<div className={cn("rounded-xl border p-4", colorClasses[color])}><div className="flex items-center gap-2 text-slate-500 mb-2"><Icon className="h-4 w-4" /><span className="text-xs font-medium uppercase">{label}</span></div><p className="text-2xl font-bold text-slate-900">{value}</p>{subValue && <p className="text-xs text-slate-500 mt-1">{subValue}</p>}</div>);
}

export default function MetaAdsPage() {
  const [rawData, setRawData] = useState<any[]>([]);
  const [clientSettings, setClientSettings] = useState<Record<string, any>>({});
  const [registeredAccounts, setRegisteredAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [segmentationRules, setSegmentationRules] = useState<SegmentationRule[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [syncProgress, setSyncProgress] = useState(0);
  const [editingClient, setEditingClient] = useState<{id: string, name: string, group: string, hidden: boolean, isSales: boolean} | null>(null);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [newRuleAccount, setNewRuleAccount] = useState('');
  const [newRuleKeyword, setNewRuleKeyword] = useState('');
  const [newRuleName, setNewRuleName] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();
  const daysRemaining = daysInMonth - currentDay;

  const fetchData = async () => {
    try {
      const [adsRes, settingsRes, accountsRes, logsRes, rulesRes] = await Promise.all([
        supabase.from('meta_ads_campaigns').select('*'),
        supabase.from('client_settings').select('*'),
        supabase.from('ad_accounts_config').select('*').eq('platform', 'meta').eq('is_active', true),
        supabase.from('meta_sync_logs').select('created_at').eq('status', 'completed').order('created_at', { ascending: false }).limit(1).single(),
        supabase.from('segmentation_rules').select('*').eq('platform', 'meta')
      ]);
      const settingsMap: Record<string, any> = {};
      settingsRes.data?.forEach((s: any) => { settingsMap[s.client_id] = { budget: Number(s.budget_limit) || 0, group_name: s.group_name || '', is_hidden: s.is_hidden || false, is_sales_account: s.is_sales_account !== false }; });
      setRawData(adsRes.data || []);
      setClientSettings(settingsMap);
      setRegisteredAccounts(accountsRes.data || []);
      setSegmentationRules(rulesRes.data || []);
      if (logsRes.data) setLastSyncTime(new Date(logsRes.data.created_at));
      else if (adsRes.data && adsRes.data.length > 0) { const dates = adsRes.data.map((d: any) => new Date(d.created_at || d.date).getTime()); setLastSyncTime(new Date(Math.max(...dates))); }
    } catch (error) { console.error('Error fetching data', error); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleStartSync = async () => {
    setIsSyncing(true); setSyncStatus('running'); setSyncLogs(['🚀 Conectando con Meta API...']); setSyncProgress(0);
    try {
      const { data, error } = await supabase.from('meta_sync_logs').insert({ status: 'pending', logs: ['Iniciando worker...'] }).select().single();
      if (error) throw error;
      const jobId = data.id;
      const channel = supabase.channel(`meta-sync-${jobId}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'meta_sync_logs', filter: `id=eq.${jobId}` }, (payload) => {
        const newRow = payload.new;
        if (newRow.logs) setSyncLogs(newRow.logs);
        if (newRow.status === 'completed') { setSyncStatus('completed'); setSyncProgress(100); toast.success('Sincronización completada'); fetchData(); setTimeout(() => { supabase.removeChannel(channel); setIsSyncing(false); }, 2000); }
        else if (newRow.status === 'error') { setSyncStatus('error'); toast.error('Error en el proceso'); }
      }).subscribe();
    } catch (err) { setSyncStatus('error'); setSyncLogs(prev => [...prev, '❌ Error al conectar.']); }
  };

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [syncLogs, isSyncing]);

  const handleAddRule = async () => {
    if (!newRuleAccount || !newRuleKeyword || !newRuleName) { toast.error("Rellena todos los campos"); return; }
    const { data, error } = await supabase.from('segmentation_rules').insert({ platform: 'meta', account_id: newRuleAccount, keyword: newRuleKeyword, virtual_name: newRuleName }).select();
    if (error) toast.error("Error: " + error.message);
    else { setSegmentationRules(prev => [...prev, ...(data || [])]); setNewRuleKeyword(''); setNewRuleName(''); toast.success("Regla guardada"); }
  };

  const handleDeleteRule = async (id: string) => {
    const { error } = await supabase.from('segmentation_rules').delete().eq('id', id);
    if (error) toast.error("Error: " + error.message);
    else { setSegmentationRules(prev => prev.filter(r => r.id !== id)); toast.info("Regla eliminada"); }
  };

  const handleSaveBudget = async (clientId: string, amount: string) => {
    const numAmount = parseFloat(amount);
    setClientSettings(prev => ({ ...prev, [clientId]: { ...prev[clientId], budget: isNaN(numAmount) ? 0 : numAmount } }));
    const { error } = await supabase.from('client_settings').upsert({ client_id: clientId, budget_limit: isNaN(numAmount) ? 0 : numAmount }, { onConflict: 'client_id' });
    if (error) toast.error("Error guardando"); else fetchData();
  };

  const handleSaveClientSettings = async () => {
    if (!editingClient) return;
    await supabase.from('client_settings').upsert({ client_id: editingClient.id, group_name: editingClient.group, is_hidden: editingClient.hidden, is_sales_account: editingClient.isSales }, { onConflict: 'client_id' });
    setEditingClient(null); fetchData(); toast.success('Guardado');
  };

  const reportData = useMemo(() => {
    if (!rawData.length) return [];
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const stats = new Map<string, { name: string, spent: number, budget: number, total_conversions_val: number, is_group: boolean, isHidden: boolean, isSalesAccount: boolean, realIds: string[], realIdsNames: {id: string, name: string}[], campaigns: MetaCampaignData[], isManualGroupBudget: boolean, autoDailyBudgetSum: number }>();

    registeredAccounts.forEach(acc => {
      const settings = clientSettings[acc.account_id] || { budget: 0, group_name: '', is_hidden: false, is_sales_account: true };
      const groupKey = settings.group_name?.trim() ? `GROUP-${settings.group_name}` : acc.account_id;
      if (!settings.group_name?.trim() && !stats.has(groupKey)) {
        stats.set(groupKey, { name: acc.account_name || acc.account_id, spent: 0, budget: settings.budget || 0, total_conversions_val: 0, is_group: false, isHidden: settings.is_hidden, isSalesAccount: settings.is_sales_account !== false, realIds: [acc.account_id], realIdsNames: [{id: acc.account_id, name: acc.account_name}], campaigns: [], isManualGroupBudget: false, autoDailyBudgetSum: 0 });
      }
    });

    rawData.forEach(row => {
      if (row.date === currentMonthPrefix) {
        let finalId = row.client_id, finalName = row.client_name;
        const rulesForAccount = segmentationRules.filter(r => normalizeId(r.account_id) === normalizeId(row.client_id));
        if (rulesForAccount.length > 0) { const match = rulesForAccount.find(r => row.campaign_name.toLowerCase().includes(r.keyword.toLowerCase())); if (match) { finalId = `${row.client_id}_${match.keyword.toUpperCase()}`; finalName = match.virtual_name; } }
        const settings = clientSettings[finalId] || { budget: 0, group_name: '', is_hidden: false, is_sales_account: true };
        const groupKey = settings.group_name?.trim() ? `GROUP-${settings.group_name}` : finalId;
        const displayName = settings.group_name?.trim() ? settings.group_name : finalName;
        const isGroupManual = groupKey.startsWith('GROUP-') && (clientSettings[groupKey]?.budget > 0);
        const isIndividualManual = !groupKey.startsWith('GROUP-') && settings.budget > 0;
        if (!stats.has(groupKey)) { stats.set(groupKey, { name: displayName, spent: 0, budget: 0, total_conversions_val: 0, is_group: groupKey.startsWith('GROUP-'), isHidden: settings.is_hidden, isSalesAccount: settings.is_sales_account !== false, realIds: [], realIdsNames: [], campaigns: [], isManualGroupBudget: isGroupManual, autoDailyBudgetSum: 0 }); }
        const entry = stats.get(groupKey)!;
        entry.spent += Number(row.cost || 0); entry.total_conversions_val += Number(row.conversions_value || 0);
        const dailyBudget = Number(row.daily_budget || 0);
        if (row.status === 'ENABLED' && dailyBudget > 0) entry.autoDailyBudgetSum += dailyBudget;
        if (!entry.realIds.includes(finalId)) { entry.realIds.push(finalId); entry.realIdsNames.push({id: finalId, name: finalName}); if (!entry.is_group && isIndividualManual) entry.budget = settings.budget; }
        if (Number(row.cost) > 0 || Number(row.impressions) > 0) { entry.campaigns.push({ ...row, original_client_name: finalName, original_client_id: finalId, cost: Number(row.cost), conversions_value: Number(row.conversions_value), conversions: Number(row.conversions), clicks: Number(row.clicks), impressions: Number(row.impressions) }); }
      }
    });

    const report: ClientPacing[] = [];
    stats.forEach((value, key) => {
      let finalBudget = 0;
      if (value.is_group) { const groupSettings = clientSettings[key.replace('GROUP-', '')] || clientSettings[key]; if (groupSettings?.budget > 0) finalBudget = groupSettings.budget; else finalBudget = value.autoDailyBudgetSum * 30.4; }
      else { if (value.budget > 0) finalBudget = value.budget; else finalBudget = value.autoDailyBudgetSum * 30.4; }
      const spent = value.spent, avgDailySpend = currentDay > 0 ? spent / currentDay : 0, forecast = avgDailySpend * daysInMonth;
      const progress = finalBudget > 0 ? (spent / finalBudget) * 100 : 0, remainingBudget = Math.max(0, finalBudget - spent);
      const recommendedDaily = daysRemaining > 0 ? remainingBudget / daysRemaining : 0, currentDailyBudget = value.autoDailyBudgetSum;
      const globalRoas = spent > 0 ? value.total_conversions_val / spent : 0;
      let status: 'ok' | 'risk' | 'over' | 'under' = 'ok';
      if (finalBudget > 0) { if (spent > finalBudget) status = 'over'; else if (forecast > finalBudget) status = 'risk'; else if (progress < 50 && currentDay > 20) status = 'under'; }
      report.push({ client_id: key, client_name: value.name, is_group: value.is_group, budget: finalBudget, spent, progress, forecast, recommendedDaily, avgDailySpend, currentDailyBudget, status, remainingBudget, total_conversions_val: value.total_conversions_val, isHidden: value.isHidden, isSalesAccount: value.isSalesAccount, groupName: value.is_group ? value.name : undefined, isManualGroupBudget: value.isManualGroupBudget, realIdsList: value.realIdsNames, campaigns: value.campaigns.sort((a,b) => b.cost - a.cost), globalRoas });
    });
    let filtered = report;
    if (!showHidden) filtered = filtered.filter(c => !c.isHidden);
    if (searchTerm) { const lower = searchTerm.toLowerCase(); filtered = filtered.filter(c => c.client_name.toLowerCase().includes(lower) || c.campaigns.some(camp => camp.campaign_name.toLowerCase().includes(lower))); }
    return filtered.sort((a, b) => b.spent - a.spent);
  }, [rawData, clientSettings, registeredAccounts, searchTerm, showHidden, segmentationRules, now, currentDay, daysInMonth, daysRemaining]);

  const globalStats = useMemo(() => {
    const totalBudget = reportData.reduce((acc, r) => acc + r.budget, 0), totalSpent = reportData.reduce((acc, r) => acc + r.spent, 0);
    const totalRevenue = reportData.reduce((acc, r) => acc + r.total_conversions_val, 0);
    const totalRecommendedDaily = reportData.reduce((acc, r) => acc + r.recommendedDaily, 0), totalCurrentDaily = reportData.reduce((acc, r) => acc + r.currentDailyBudget, 0);
    const atRisk = reportData.filter(r => r.status === 'risk' || r.status === 'over').length, globalRoas = totalSpent > 0 ? totalRevenue / totalSpent : 0;
    return { totalBudget, totalSpent, totalRevenue, totalRecommendedDaily, totalCurrentDaily, atRisk, globalRoas };
  }, [reportData]);

  const uniqueAccountsForSelector = useMemo(() => {
    const unique = new Map();
    rawData.forEach(r => unique.set(r.client_id, r.client_name));
    registeredAccounts.forEach(acc => unique.set(acc.account_id, acc.account_name));
    return Array.from(unique.entries()).map(([id, name]) => ({ id, name }));
  }, [rawData, registeredAccounts]);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 pb-20">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-lg shadow-blue-500/20"><Facebook className="w-6 h-6 text-white" /></div>
            <div><h1 className="text-2xl font-bold text-slate-900">Meta Ads</h1><div className="flex items-center gap-3 mt-1"><span className="text-sm text-slate-500 flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{lastSyncTime ? lastSyncTime.toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Sin sincronizar'}</span><Badge variant="outline" className="text-xs"><Calendar className="w-3 h-3 mr-1" />Día {currentDay} de {daysInMonth}</Badge></div></div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Button variant="outline" onClick={() => setIsSplitModalOpen(true)} className="flex-1 md:flex-none"><Scissors className="w-4 h-4 mr-2" /> Dividir</Button>
            <Button onClick={handleStartSync} disabled={isSyncing} className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700"><RefreshCw className={cn("w-4 h-4 mr-2", isSyncing && "animate-spin")} /> Sincronizar</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard icon={Target} label="Inversión" value={formatCurrency(globalStats.totalSpent)} subValue={`de ${formatCurrency(globalStats.totalBudget)}`} color="blue" />
          <StatCard icon={TrendingUp} label="Valor Conversiones" value={formatCurrency(globalStats.totalRevenue)} subValue={`ROAS ${globalStats.globalRoas.toFixed(2)}x`} color="emerald" />
          <StatCard icon={Calendar} label="Días restantes" value={daysRemaining.toString()} subValue={`${Math.round((currentDay / daysInMonth) * 100)}% del mes`} color="slate" />
          <StatCard icon={ArrowDownRight} label="Diario Recomendado" value={formatCurrency(globalStats.totalRecommendedDaily)} subValue="Para no pasarte" color={globalStats.totalRecommendedDaily < globalStats.totalCurrentDaily ? 'amber' : 'emerald'} />
          <StatCard icon={AlertTriangle} label="En Riesgo" value={globalStats.atRisk.toString()} subValue="cuentas" color={globalStats.atRisk > 0 ? 'red' : 'slate'} />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-center bg-white p-3 rounded-xl border shadow-sm">
          <div className="relative flex-1 w-full"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input placeholder="Buscar cuenta o campaña..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 bg-slate-50 border-slate-200" />{searchTerm && <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setSearchTerm('')}><X className="h-3 w-3" /></Button>}</div>
          <div className="flex items-center gap-4"><div className="flex items-center gap-2"><Switch id="show-hidden" checked={showHidden} onCheckedChange={setShowHidden} /><Label htmlFor="show-hidden" className="text-sm text-slate-600 cursor-pointer flex items-center gap-1">{showHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}Ocultos</Label></div><span className="text-sm text-slate-500">{reportData.length} cuentas</span></div>
        </div>
      </div>

      <div className="space-y-3">
        <Accordion type="single" collapsible className="space-y-2">
          {reportData.map((client) => {
            const statusConfig = getStatusConfig(client.status);
            const dailyDiff = client.currentDailyBudget - client.recommendedDaily;
            const isOverspending = dailyDiff > 0 && client.status !== 'ok';
            return (
              <AccordionItem key={client.client_id} value={client.client_id} className={cn("bg-white border rounded-xl shadow-sm overflow-hidden", client.isHidden && "opacity-60 border-dashed")}>
                <AccordionTrigger className="hover:no-underline py-4 px-4 group">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between w-full pr-4 gap-4">
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <div className={cn("w-1.5 h-12 rounded-full", statusConfig.color)} />
                      <div className="text-left">
                        <div className="flex items-center gap-2 flex-wrap"><span className="font-bold text-lg text-slate-900">{formatProjectName(client.client_name)}</span>{client.is_group && <Badge variant="secondary" className="text-[10px] gap-1"><Layers className="w-3 h-3" /> GRUPO</Badge>}<Badge variant="outline" className={cn("text-[10px]", statusConfig.badgeClass)}>{statusConfig.text}</Badge></div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">{client.isSalesAccount && client.globalRoas > 0 && <Badge variant="outline" className={cn("text-[10px] h-5", getRoasColor(client.globalRoas))}>ROAS {client.globalRoas.toFixed(2)}</Badge>}{client.isHidden && <Badge variant="outline" className="text-[10px] h-5 gap-1"><EyeOff className="w-3 h-3" /> Oculto</Badge>}</div>
                      </div>
                    </div>
                    {client.budget > 0 && <div className="hidden lg:flex flex-col flex-1 max-w-xs mx-4"><div className="flex justify-between text-[10px] text-slate-500 mb-1"><span>{client.progress.toFixed(0)}% gastado</span><span>Proy: {formatCurrency(client.forecast)}</span></div><Progress value={Math.min(client.progress, 100)} className={cn("h-2", client.status === 'over' && "[&>div]:bg-red-500", client.status === 'risk' && "[&>div]:bg-amber-500", client.status === 'ok' && "[&>div]:bg-blue-500")} /></div>}
                    <div className="flex items-center gap-4 lg:gap-6 justify-end">
                      {client.isSalesAccount && client.total_conversions_val > 0 && <div className="text-right hidden sm:block"><div className="text-[10px] uppercase text-slate-400 font-medium">Valor</div><div className="text-lg font-bold text-emerald-600">{formatCurrency(client.total_conversions_val)}</div></div>}
                      <div className="text-right"><div className="text-[10px] uppercase text-slate-400 font-medium">Invertido</div><div className="text-xl font-bold text-slate-900">{formatCurrency(client.spent)}</div></div>
                      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); if (!client.is_group) setEditingClient({ id: client.client_id, name: client.client_name, group: clientSettings[client.client_id]?.group_name || '', hidden: clientSettings[client.client_id]?.is_hidden || false, isSales: clientSettings[client.client_id]?.is_sales_account !== false }); else toast.info("Abre el grupo para editar"); }}><Settings className="w-4 h-4 text-slate-400" /></Button></TooltipTrigger><TooltipContent>Configurar</TooltipContent></Tooltip>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="border-t bg-slate-50/50">
                  <div className="p-4 space-y-6">
                    {client.is_group && <div className="bg-white p-4 rounded-lg border"><h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2"><Layers className="w-3.5 h-3.5" /> Cuentas Vinculadas ({client.realIdsList.length})</h4><div className="flex flex-wrap gap-2">{client.realIdsList.map(sub => <div key={sub.id} className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border text-sm"><span className="font-medium text-slate-700">{formatProjectName(sub.name)}</span><button onClick={() => setEditingClient({id: sub.id, name: sub.name, group: client.groupName || '', hidden: false, isSales: true})} className="text-slate-400 hover:text-blue-500"><Settings className="w-3.5 h-3.5" /></button></div>)}</div></div>}
                    <div className="grid lg:grid-cols-2 gap-6">
                      <div className="bg-white p-4 rounded-lg border space-y-4">
                        <div className="flex justify-between items-center"><div className="flex items-center gap-2"><Label className="text-sm font-medium text-slate-700">Presupuesto {client.is_group ? 'Total' : 'Mensual'}</Label>{!client.isManualGroupBudget && !clientSettings[client.client_id]?.budget && <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-600 border-blue-200">Auto</Badge>}</div><div className="flex items-center gap-2"><span className="text-slate-400">€</span><Input key={`${client.client_id}-${client.budget}`} type="number" defaultValue={clientSettings[client.client_id]?.budget > 0 ? clientSettings[client.client_id]?.budget : ''} onBlur={(e) => handleSaveBudget(client.client_id, e.target.value)} className="h-8 w-28 text-right" placeholder={client.budget.toFixed(0)} /></div></div>
                        <div className="space-y-2"><div className="flex justify-between text-xs text-slate-500"><span>Consumo ({client.progress.toFixed(1)}%)</span><span className={client.remainingBudget <= 0 ? 'text-red-500 font-bold' : ''}>Disponible: {formatCurrency(client.remainingBudget)}</span></div><Progress value={Math.min(client.progress, 100)} className={cn("h-2.5", client.status === 'over' && "[&>div]:bg-red-500", client.status === 'risk' && "[&>div]:bg-amber-500", client.status === 'ok' && "[&>div]:bg-blue-500")} /></div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className={cn("p-3 rounded-lg border-2 text-center", isOverspending ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200")}><div className="text-[10px] uppercase text-slate-500 font-medium mb-1">Diario Actual</div><div className={cn("text-xl font-bold", isOverspending ? "text-amber-600" : "text-slate-700")}>{formatCurrency(client.currentDailyBudget)}</div><div className="text-[10px] text-slate-400 mt-1">configurado en Meta</div></div>
                          <div className="p-3 rounded-lg border-2 text-center bg-emerald-50 border-emerald-200"><div className="text-[10px] uppercase text-slate-500 font-medium mb-1">Diario Recomendado</div><div className="text-xl font-bold text-emerald-600">{formatCurrency(client.recommendedDaily)}</div><div className="text-[10px] text-slate-400 mt-1">para no pasarte</div></div>
                        </div>
                        {isOverspending && dailyDiff > 5 && <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800"><AlertTriangle className="w-4 h-4 shrink-0" /><span>Reduce el presupuesto diario en <strong>{formatCurrency(dailyDiff)}</strong> para ajustarte.</span></div>}
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"><span className="text-sm text-slate-600">Proyección fin de mes</span><span className={cn("font-bold", client.forecast > client.budget ? "text-red-600" : "text-slate-700")}>{formatCurrency(client.forecast)}</span></div>
                      </div>
                      <div className="bg-white rounded-lg border overflow-hidden"><div className="max-h-[350px] overflow-y-auto"><table className="w-full text-xs"><thead className="bg-slate-50 text-slate-500 font-medium sticky top-0 border-b"><tr><th className="px-3 py-2.5 text-left">Campaña</th><th className="px-2 py-2.5 text-right">Gasto</th><th className="px-2 py-2.5 text-right">Valor</th>{client.isSalesAccount && <th className="px-2 py-2.5 text-center">ROAS</th>}</tr></thead><tbody className="divide-y divide-slate-100">{client.campaigns.map((camp, idx) => { const roas = camp.cost > 0 ? (camp.conversions_value || 0) / camp.cost : 0; return <tr key={idx} className="hover:bg-slate-50"><td className="px-3 py-2.5"><div className="font-medium text-slate-700 line-clamp-2" title={camp.campaign_name}>{camp.campaign_name}</div><div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400"><span className="flex items-center gap-1"><span className={cn("w-1.5 h-1.5 rounded-full", camp.status === 'ENABLED' ? 'bg-emerald-400' : 'bg-slate-300')} />{camp.status === 'ENABLED' ? 'Activa' : 'Pausada'}</span>{client.is_group && camp.original_client_name && <span className="truncate max-w-[100px]">| {formatProjectName(camp.original_client_name)}</span>}</div></td><td className="px-2 py-2.5 text-right font-medium text-slate-900">{formatCurrency(camp.cost)}</td><td className="px-2 py-2.5 text-right text-emerald-600">{formatCurrency(camp.conversions_value || 0)}</td>{client.isSalesAccount && <td className="px-2 py-2.5 text-center"><Badge variant="outline" className={cn("text-[10px]", getRoasColor(roas))}>{roas.toFixed(2)}</Badge></td>}</tr>; })}{client.campaigns.length === 0 && <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-400">Sin campañas</td></tr>}</tbody></table></div></div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
        {reportData.length === 0 && !loading && <div className="text-center py-12 bg-white rounded-xl border"><Facebook className="w-12 h-12 mx-auto text-blue-200" /><h3 className="text-lg font-medium text-slate-700 mt-4">Sin datos</h3><p className="text-sm text-slate-500 mt-1">Sincroniza para cargar cuentas</p></div>}
      </div>

      <Dialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)}><DialogContent><DialogHeader><DialogTitle>Configurar Cuenta</DialogTitle><DialogDescription>{editingClient?.name}</DialogDescription></DialogHeader><div className="space-y-4 py-4"><div className="space-y-2"><Label>Nombre del Grupo (Holding)</Label><Input value={editingClient?.group || ''} onChange={(e) => setEditingClient(prev => prev ? {...prev, group: e.target.value} : null)} placeholder="Ej: Grupo ABC" /><p className="text-xs text-slate-500">Las cuentas del mismo grupo se consolidan.</p></div><div className="flex justify-between items-center py-3 border-t"><div><Label>Cuenta de Ventas (ROAS)</Label><p className="text-xs text-slate-500">Mostrar conversiones</p></div><Switch checked={editingClient?.isSales !== false} onCheckedChange={(c) => setEditingClient(prev => prev ? {...prev, isSales: c} : null)} /></div><div className="flex justify-between items-center py-3 border-t"><div><Label>Ocultar cuenta</Label><p className="text-xs text-slate-500">No aparecerá en la lista</p></div><Switch checked={editingClient?.hidden || false} onCheckedChange={(c) => setEditingClient(prev => prev ? {...prev, hidden: c} : null)} /></div></div><DialogFooter><Button variant="outline" onClick={() => setEditingClient(null)}>Cancelar</Button><Button onClick={handleSaveClientSettings}>Guardar</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={isSplitModalOpen} onOpenChange={setIsSplitModalOpen}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle className="flex items-center gap-2"><Scissors className="w-5 h-5" /> Dividir Cuentas</DialogTitle><DialogDescription>Separa campañas por palabra clave en cuentas virtuales.</DialogDescription></DialogHeader><div className="space-y-6 py-4"><div className="grid grid-cols-12 gap-3 items-end bg-slate-50 p-4 rounded-lg border"><div className="col-span-12 sm:col-span-4 space-y-1"><Label className="text-xs font-medium">Cuenta Origen</Label><Select value={newRuleAccount} onValueChange={setNewRuleAccount}><SelectTrigger className="bg-white"><SelectValue placeholder="Selecciona..." /></SelectTrigger><SelectContent>{uniqueAccountsForSelector.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name || acc.id}</SelectItem>)}</SelectContent></Select></div><div className="col-span-6 sm:col-span-3 space-y-1"><Label className="text-xs font-medium">Si contiene...</Label><Input placeholder="Ej: Loro" className="bg-white" value={newRuleKeyword} onChange={e => setNewRuleKeyword(e.target.value)} /></div><div className="col-span-6 sm:col-span-3 space-y-1"><Label className="text-xs font-medium">Crear cuenta...</Label><Input placeholder="Ej: Loro Parque" className="bg-white" value={newRuleName} onChange={e => setNewRuleName(e.target.value)} /></div><div className="col-span-12 sm:col-span-2"><Button onClick={handleAddRule} className="w-full"><Plus className="w-4 h-4" /></Button></div></div><div className="space-y-2"><h4 className="text-xs font-bold text-slate-500 uppercase">Reglas Activas ({segmentationRules.length})</h4>{segmentationRules.length === 0 ? <p className="text-sm text-slate-400 italic py-4 text-center">No hay reglas</p> : <div className="space-y-2 max-h-[200px] overflow-y-auto">{segmentationRules.map(rule => <div key={rule.id} className="flex items-center justify-between p-3 bg-white border rounded-lg"><div className="flex items-center gap-3 flex-wrap"><Badge variant="outline" className="font-mono text-xs">{normalizeId(rule.account_id).slice(0, 10)}...</Badge><span className="text-sm text-slate-500">Si contiene <strong className="text-slate-700">"{rule.keyword}"</strong></span><span className="text-slate-300">→</span><span className="font-bold text-blue-600">{rule.virtual_name}</span></div><Button variant="ghost" size="icon" onClick={() => handleDeleteRule(rule.id)} className="text-red-500 hover:bg-red-50 h-8 w-8"><Trash2 className="w-4 h-4" /></Button></div>)}</div>}</div></div></DialogContent></Dialog>

      <Dialog open={isSyncing} onOpenChange={(open) => { if(syncStatus !== 'running') setIsSyncing(open); }}><DialogContent className="sm:max-w-md bg-slate-950 text-slate-100 border-slate-800"><DialogHeader><DialogTitle className="flex items-center gap-2 text-white">{syncStatus === 'running' && <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />}{syncStatus === 'completed' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}Sincronizando Meta Ads</DialogTitle><DialogDescription className="text-slate-400">{syncStatus === 'running' ? 'Conectando...' : 'Finalizado'}</DialogDescription></DialogHeader><Progress value={syncProgress} className="h-2 bg-slate-800 [&>div]:bg-blue-500" /><div className="bg-black/50 rounded-lg p-4 font-mono text-xs text-blue-400 h-64 overflow-hidden border border-slate-800"><div className="h-full overflow-y-auto space-y-1" ref={scrollRef}>{syncLogs.map((log, i) => <div key={i} className="break-words">{log}</div>)}</div></div></DialogContent></Dialog>
    </div>
  );
}
