import { useState, useEffect, useMemo, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  RefreshCw, Clock, AlertTriangle, Search, Settings, EyeOff, Layers, Filter, 
  Info, Activity, TrendingUp
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const GoogleIcon = () => (
    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.2,4.73C15.29,4.73 17.1,6.7 17.1,6.7L19,4.72C19,4.72 16.56,2 12.1,2C6.42,2 2.03,6.8 2.03,12C2.03,17.05 6.16,22 12.25,22C17.6,22 21.5,18.33 21.5,12.91C21.5,11.76 21.35,11.1 21.35,11.1V11.1Z" />
    </svg>
);

interface CampaignData {
  campaign_id: string;
  campaign_name: string;
  status: string;
  cost: number;
  conversions_value?: number;
  conversions?: number; 
  daily_budget?: number; 
  clicks?: number;
  impressions?: number;
  original_client_name?: string; 
  original_client_id?: string;
}

interface ClientPacing {
  client_id: string;
  client_name: string;
  is_group: boolean;
  budget: number;
  spent: number;
  progress: number;
  forecast: number;
  recommendedDaily: number;
  avgDailySpend: number;
  status: 'ok' | 'risk' | 'over' | 'under';
  remainingBudget: number;
  total_conversions_val: number;
  campaigns: CampaignData[];
  isHidden: boolean;
  groupName?: string;
  isManualGroupBudget?: boolean;
  isSalesAccount: boolean;
  realIdsList: {id: string, name: string}[]; 
  globalRoas: number;
}

const formatProjectName = (name: string) => name.replace(/^(Cliente|Client)\s*[-:]?\s*/i, '');

const getRoasColor = (roas: number) => {
    if (roas >= 4) return "text-emerald-600 bg-emerald-50 border-emerald-200";
    if (roas >= 2) return "text-blue-600 bg-blue-50 border-blue-200";
    if (roas >= 1) return "text-amber-600 bg-amber-50 border-amber-200";
    return "text-red-600 bg-red-50 border-red-200";
};

export default function AdsPage() {
  const [rawData, setRawData] = useState<any[]>([]);
  const [clientSettings, setClientSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [showHidden, setShowHidden] = useState(false);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [syncProgress, setSyncProgress] = useState(0); 
  
  const [editingClient, setEditingClient] = useState<{id: string, name: string, group: string, hidden: boolean, isSales: boolean} | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    try {
      const { data: adsData } = await supabase.from('google_ads_campaigns').select('*');
      const { data: settingsData } = await supabase.from('client_settings').select('*');
      const { data: logData } = await supabase.from('ads_sync_logs').select('created_at').eq('status', 'completed').order('created_at', { ascending: false }).limit(1).single();

      const settingsMap: Record<string, any> = {};
      settingsData?.forEach((s: any) => { 
        settingsMap[s.client_id] = {
          budget: Number(s.budget_limit) || 0,
          group_name: s.group_name || '',
          is_hidden: s.is_hidden || false,
          is_sales_account: s.is_sales_account !== false 
        }; 
      });

      setRawData(adsData || []);
      setClientSettings(settingsMap);

      if (logData) {
        setLastSyncTime(new Date(logData.created_at));
      } else if (adsData && adsData.length > 0) {
         const dates = adsData.map(d => new Date(d.created_at || d.date).getTime());
         setLastSyncTime(new Date(Math.max(...dates)));
      }
    } catch (error) {
      console.error('Error fetching data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleStartSync = async () => {
    setIsSyncing(true);
    setSyncStatus('running');
    setSyncLogs(['🚀 Iniciando conexión...']);
    setSyncProgress(0);

    try {
      const { data, error } = await supabase.from('ads_sync_logs').insert({ status: 'pending', logs: ['Esperando worker...'] }).select().single();
      if (error) throw error;
      const jobId = data.id;

      const channel = supabase.channel(`google-sync-${jobId}`).on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'ads_sync_logs', filter: `id=eq.${jobId}` },
          (payload) => {
            const newRow = payload.new;
            if (newRow.logs) setSyncLogs(newRow.logs);
            if (newRow.status === 'completed') {
              setSyncStatus('completed');
              setSyncProgress(100);
              toast.success('Sincronización completada');
              fetchData(); 
              setTimeout(() => { supabase.removeChannel(channel); setIsSyncing(false); }, 2000);
            } else if (newRow.status === 'error') {
              setSyncStatus('error');
              toast.error('Error en el proceso');
            }
          }
        ).subscribe();
    } catch (err) {
      setSyncStatus('error');
      setSyncLogs(prev => [...prev, '❌ Error al conectar.']);
    }
  };

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [syncLogs, isSyncing]);

  const handleSaveBudget = async (clientId: string, amount: string) => {
    const numAmount = parseFloat(amount);
    setClientSettings(prev => ({
      ...prev,
      [clientId]: { ...prev[clientId], budget: isNaN(numAmount) ? 0 : numAmount }
    }));
    await supabase.from('client_settings').upsert({ client_id: clientId, budget_limit: isNaN(numAmount) ? 0 : numAmount }, { onConflict: 'client_id' });
    fetchData();
  };

  const handleSaveClientSettings = async () => {
    if (!editingClient) return;
    await supabase.from('client_settings').upsert({
      client_id: editingClient.id,
      group_name: editingClient.group,
      is_hidden: editingClient.hidden,
      is_sales_account: editingClient.isSales
    }, { onConflict: 'client_id' });
    setEditingClient(null);
    fetchData(); 
    toast.success('Configuración guardada');
  };

  const reportData = useMemo(() => {
    if (!rawData.length) return [];
    
    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();

    const stats = new Map<string, { 
      name: string, spent: number, budget: number, total_conversions_val: number,
      is_group: boolean, isHidden: boolean, isSalesAccount: boolean,
      realIds: string[], realIdsNames: {id: string, name: string}[],
      campaigns: CampaignData[], isManualGroupBudget: boolean, autoDailyBudgetSum: number
    }>();

    rawData.forEach(row => {
      if (row.date === currentMonthPrefix) {
        
        const settings = clientSettings[row.client_id] || { budget: 0, group_name: '', is_hidden: false, is_sales_account: true };
        const groupKey = settings.group_name?.trim() ? `GROUP-${settings.group_name}` : row.client_id;
        const displayName = settings.group_name?.trim() ? settings.group_name : row.client_name;

        const isGroupManual = groupKey.startsWith('GROUP-') && (clientSettings[groupKey]?.budget > 0);
        const isIndividualManual = !groupKey.startsWith('GROUP-') && settings.budget > 0;

        if (!stats.has(groupKey)) {
          stats.set(groupKey, { 
            name: displayName, spent: 0, budget: 0, total_conversions_val: 0,
            is_group: groupKey.startsWith('GROUP-'), isHidden: settings.is_hidden, isSalesAccount: settings.is_sales_account !== false,
            realIds: [], realIdsNames: [], campaigns: [], isManualGroupBudget: isGroupManual, autoDailyBudgetSum: 0
          });
        }
        
        const entry = stats.get(groupKey)!;
        
        entry.spent += row.cost;
        entry.total_conversions_val += (row.conversions_value || 0);
        
        if (row.status === 'ENABLED' && row.daily_budget > 0) entry.autoDailyBudgetSum += row.daily_budget;

        if (!entry.realIds.includes(row.client_id)) {
           entry.realIds.push(row.client_id);
           entry.realIdsNames.push({id: row.client_id, name: row.client_name});
           if (!entry.is_group && isIndividualManual) entry.budget = settings.budget; 
           if (!settings.is_hidden) entry.isHidden = false;
        }

        if (row.cost > 0) { 
            entry.campaigns.push({
                ...row,
                original_client_name: row.client_name,
                original_client_id: row.client_id
            });
        }
      }
    });

    const report: ClientPacing[] = [];
    
    stats.forEach((value, key) => {
      let finalBudget = 0;
      if (value.is_group) {
          const groupSettings = clientSettings[key.replace('GROUP-', '')] || clientSettings[key]; 
          if (groupSettings?.budget > 0) finalBudget = groupSettings.budget;
          else finalBudget = value.autoDailyBudgetSum * 30.4;
      } else {
          if (value.budget > 0) finalBudget = value.budget; 
          else finalBudget = value.autoDailyBudgetSum * 30.4; 
      }

      const spent = value.spent;
      const avgDailySpend = currentDay > 0 ? spent / currentDay : 0;
      const forecast = avgDailySpend * daysInMonth;
      const progress = finalBudget > 0 ? (spent / finalBudget) * 100 : 0;
      const remainingBudget = Math.max(0, finalBudget - spent);
      const recommendedDaily = (daysInMonth - currentDay) > 0 ? remainingBudget / (daysInMonth - currentDay) : 0;
      const globalRoas = spent > 0 ? value.total_conversions_val / spent : 0;

      let status: 'ok' | 'risk' | 'over' | 'under' = 'ok';
      if (finalBudget > 0) {
        if (spent > finalBudget) status = 'over';
        else if (forecast > finalBudget) status = 'risk';
        else if (progress < 50 && currentDay > 20) status = 'under';
      }

      report.push({ 
          client_id: key, client_name: value.name, is_group: value.is_group,
          budget: finalBudget, spent, progress, forecast, recommendedDaily, avgDailySpend, 
          status, remainingBudget, total_conversions_val: value.total_conversions_val,
          isHidden: value.isHidden, isSalesAccount: value.isSalesAccount,
          groupName: value.is_group ? value.name : undefined,
          isManualGroupBudget: value.isManualGroupBudget, realIdsList: value.realIdsNames,
          campaigns: value.campaigns.sort((a,b) => b.cost - a.cost), globalRoas
      });
    });

    let filtered = report;
    if (!showHidden) filtered = filtered.filter(c => !c.isHidden);
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(c => c.client_name.toLowerCase().includes(lower) || c.campaigns.some(camp => camp.campaign_name.toLowerCase().includes(lower)));
    }

    return filtered.sort((a, b) => b.spent - a.spent);
  }, [rawData, clientSettings, searchTerm, showHidden]);

  const totalBudget = reportData.reduce((acc, r) => acc + r.budget, 0);
  const totalSpent = reportData.reduce((acc, r) => acc + r.spent, 0);
  const totalRevenue = reportData.reduce((acc, r) => acc + r.total_conversions_val, 0);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6 space-y-6 pb-20">
        <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-[#4285F4] rounded-xl shadow-lg shadow-blue-600/10"><GoogleIcon /></div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Google Ads Manager</h1>
                        <div className="flex items-center gap-2 mt-1 text-sm text-slate-500"><Clock className="w-4 h-4" /><span>{lastSyncTime ? lastSyncTime.toLocaleString() : 'Pendiente...'}</span></div>
                    </div>
                </div>
                <div className="flex items-center gap-2"><Button onClick={handleStartSync} disabled={isSyncing} className="bg-[#4285F4] hover:bg-blue-600 text-white"><RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} /> Sincronizar</Button></div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 bg-slate-50 border-slate-200" /></div>
                <div className="flex items-center gap-2 text-sm text-slate-600"><Switch id="show-hidden" checked={showHidden} onCheckedChange={setShowHidden} /><Label htmlFor="show-hidden" className="cursor-pointer">Ver Ocultos</Label></div>
            </div>
        </div>

         <div className="grid gap-4 md:grid-cols-3">
           <Card className="shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-xs font-semibold text-slate-400 uppercase">Inversión (Mes)</CardTitle></CardHeader>
             <CardContent>
               <div className="text-3xl font-bold text-slate-900">{formatCurrency(totalSpent)}</div>
               <Progress value={totalBudget > 0 ? (totalSpent/totalBudget)*100 : 0} className="h-1.5 mt-3 bg-slate-100 [&>div]:bg-[#4285F4]" />
               <p className="text-xs text-slate-400 mt-2 text-right">PPT Global Estimado: {formatCurrency(totalBudget)}</p>
             </CardContent>
           </Card>
           <Card className="shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-xs font-semibold text-slate-400 uppercase">Valor Conversión (Mes)</CardTitle></CardHeader>
             <CardContent>
               <div className="text-3xl font-bold text-emerald-600">{formatCurrency(totalRevenue)}</div>
               <div className="text-xs text-emerald-600 mt-3 flex items-center font-medium"><TrendingUp className="w-3 h-3 mr-1" /> ROAS Global: {(totalSpent > 0 ? totalRevenue/totalSpent : 0).toFixed(2)}x</div>
             </CardContent>
           </Card>
         </div>

         <div className="space-y-4">
            <Accordion type="single" collapsible className="w-full space-y-2">
              {reportData.map((client) => {
                  const diffFromBudget = client.forecast - client.budget;
                  return (
                <AccordionItem key={client.client_id} value={client.client_id} className={`bg-white border rounded-lg shadow-sm px-2 ${client.isHidden ? 'opacity-60 border-dashed border-slate-300' : 'border-slate-200'}`}>
                  <AccordionTrigger className="hover:no-underline py-4 px-2 group">
                    <div className="flex flex-col md:flex-row md:items-center justify-between w-full pr-4 gap-4">
                        <div className="flex items-center gap-3 min-w-[200px]">
                            <div className={`w-2 h-10 rounded-full ${client.status === 'over' ? 'bg-red-500' : client.status === 'risk' ? 'bg-amber-500' : 'bg-[#4285F4]'}`} />
                            <div className="text-left">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-lg text-slate-900">{formatProjectName(client.client_name)}</span>
                                    {client.is_group && <Badge variant="secondary" className="text-[10px]"><Layers className="w-3 h-3 mr-1"/> GRUPO</Badge>}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    {client.isSalesAccount && <Badge variant="outline" className={`px-1 h-5 ${getRoasColor(client.globalRoas)}`}>ROAS {client.globalRoas.toFixed(2)}</Badge>}
                                    {client.isHidden && <Badge variant="outline" className="text-[10px]">OCULTO</Badge>}
                                </div>
                            </div>
                        </div>

                        {/* BARRA DE PROGRESO EN EL RESUMEN */}
                        {client.budget > 0 && (
                            <div className="hidden md:flex flex-col flex-1 mx-4 max-w-xs">
                                <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                                    <span>{client.progress.toFixed(0)}% Gastado</span>
                                    <span>Est. {formatCurrency(client.forecast)}</span>
                                </div>
                                <Progress value={Math.min(client.progress, 100)} className={`h-2 ${client.status === 'over' ? '[&>div]:bg-red-500' : client.status === 'risk' ? '[&>div]:bg-amber-500' : '[&>div]:bg-[#4285F4]'}`} />
                            </div>
                        )}

                        <div className="flex items-center gap-6 justify-end flex-1">
                            {/* VALOR DE CONVERSIÓN */}
                            {client.isSalesAccount && (
                                <div className="text-right hidden sm:block">
                                    <div className="text-[10px] uppercase text-slate-400 font-semibold">Valor</div>
                                    <div className="text-lg font-bold text-emerald-600">{formatCurrency(client.total_conversions_val)}</div>
                                </div>
                            )}

                            {/* INVERSIÓN */}
                            <div className="text-right">
                                <div className="text-[10px] uppercase text-slate-400 font-semibold">Inversión</div>
                                <div className="text-2xl font-mono font-bold text-slate-900">{formatCurrency(client.spent)}</div>
                            </div>

                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); if (!client.is_group) setEditingClient({id: client.client_id, name: client.client_name, group: clientSettings[client.client_id]?.group_name || '', hidden: clientSettings[client.client_id]?.is_hidden || false, isSales: clientSettings[client.client_id]?.is_sales_account !== false}); else toast.info("Abre el grupo para editar."); }}>
                                <Settings className="w-4 h-4 text-slate-400" />
                            </Button>
                        </div>
                    </div>
                  </AccordionTrigger>
                  
                  <AccordionContent className="border-t pt-6 pb-6 px-2">
                    <div className="grid md:grid-cols-1 gap-8">
                        {client.is_group && (
                            <div className="bg-slate-50 p-4 rounded-lg border">
                                <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex gap-2"><Layers className="w-3 h-3"/> Cuentas Vinculadas</h4>
                                <div className="flex flex-wrap gap-2">{client.realIdsList.map(sub => (
                                    <div key={sub.id} className="flex items-center gap-2 bg-white px-3 py-1 rounded border text-sm shadow-sm"><span className="font-medium text-slate-700">{formatProjectName(sub.name)}</span>
                                    <button onClick={() => setEditingClient({id: sub.id, name: sub.name, group: client.groupName || '', hidden: false, isSales: true})} className="text-slate-400 hover:text-blue-500 ml-1"><Settings className="w-3 h-3" /></button>
                                    </div>
                                ))}</div>
                            </div>
                        )}

                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="bg-slate-50 p-4 rounded-md border border-slate-100 h-full flex flex-col space-y-4">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <label className="text-sm font-medium text-slate-600">Presupuesto {client.is_group ? 'Total' : 'Mensual'}</label>
                                        {!client.isManualGroupBudget && !clientSettings[client.client_id]?.budget && (
                                            <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-600 border-blue-200">Auto (Google)</Badge>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2"><span className="text-slate-400">€</span><Input type="number" defaultValue={clientSettings[client.client_id]?.budget > 0 ? clientSettings[client.client_id]?.budget : ''} onBlur={(e) => handleSaveBudget(client.client_id, e.target.value)} className="h-8 w-24 text-right bg-white border-blue-200 focus:border-blue-500" placeholder={formatCurrency(client.budget).replace('€', '').trim()} /></div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs text-slate-500"><span>Consumo ({client.progress.toFixed(1)}%)</span><span className={client.remainingBudget < 0 ? 'text-red-500 font-bold' : ''}>Disp: {formatCurrency(client.remainingBudget)}</span></div>
                                    <Progress value={Math.min(client.progress, 100)} className={`h-2 ${client.status === 'over' ? '[&>div]:bg-red-500' : client.status === 'risk' ? '[&>div]:bg-amber-500' : '[&>div]:bg-[#4285F4]'}`} />
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div className="bg-white p-3 rounded border border-slate-200"><div className="text-[10px] text-slate-500 uppercase mb-1">Límite Diario</div><div className="text-lg font-bold text-indigo-600">{formatCurrency(client.recommendedDaily)}</div></div>
                                    <div className="bg-white p-3 rounded border border-slate-200"><div className="text-[10px] text-slate-500 uppercase mb-1">Proyección</div><div className="text-lg font-bold text-slate-700">{formatCurrency(client.forecast)}</div></div>
                                </div>
                            </div>

                            <div className="rounded-md border border-slate-200 overflow-hidden max-h-[300px] overflow-y-auto bg-white">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0 z-10 border-b border-slate-200"><tr><th className="px-3 py-2 w-[35%] min-w-[150px]">Campaña</th><th className="px-2 py-2 text-right">Gasto</th><th className="px-2 py-2 text-right">Valor</th>{client.isSalesAccount && <th className="px-2 py-2 text-center">ROAS</th>}</tr></thead>
                                    <tbody className="divide-y divide-slate-100">{client.campaigns.map((camp, idx) => {
                                        const roas = camp.cost > 0 ? (camp.conversions_value||0)/camp.cost : 0;
                                        return (
                                            <tr key={idx} className="hover:bg-slate-50"><td className="px-3 py-2"><div className="font-medium text-slate-700 line-clamp-2" title={camp.campaign_name}>{camp.campaign_name}</div><div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[9px] text-slate-400"><span className="flex items-center gap-1"><span className={`w-1.5 h-1.5 rounded-full ${camp.status === 'ENABLED' ? 'bg-emerald-400' : 'bg-slate-300'}`}></span>{camp.status === 'ENABLED' ? 'ON' : 'OFF'}</span>{client.is_group && <span className="truncate max-w-[100px]">| {formatProjectName(camp.original_client_name || '')}</span>}</div></td>
                                            <td className="px-2 py-2 text-right font-medium text-slate-900">{formatCurrency(camp.cost)}</td>
                                            <td className="px-2 py-2 text-right text-emerald-600">{formatCurrency(camp.conversions_value||0)}</td>
                                            {client.isSalesAccount && <td className="px-2 py-2 text-center"><Badge variant="outline" className={`px-1 py-0 ${getRoasColor(roas)}`}>{roas.toFixed(2)}</Badge></td>}</tr>
                                        )
                                    })}</tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )})}
            </Accordion>
         </div>

         <Dialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)}>
            <DialogContent><DialogHeader><DialogTitle>Configurar Cliente</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2"><Label>Nombre Grupo</Label><Input value={editingClient?.group || ''} onChange={(e) => setEditingClient(prev => prev ? {...prev, group: e.target.value} : null)} /></div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-100"><Label>Cuenta de Ventas (ROAS)</Label><Switch checked={editingClient?.isSales !== false} onCheckedChange={(c) => setEditingClient(prev => prev ? {...prev, isSales: c} : null)} /></div>
                    <div className="flex justify-between items-center"><Label>Ocultar</Label><Switch checked={editingClient?.hidden || false} onCheckedChange={(c) => setEditingClient(prev => prev ? {...prev, hidden: c} : null)} /></div>
                </div>
                <DialogFooter><Button onClick={handleSaveClientSettings}>Guardar</Button></DialogFooter>
            </DialogContent>
         </Dialog>

        <Dialog open={isSyncing} onOpenChange={(open) => { if(syncStatus !== 'running') setIsSyncing(open); }}>
          <DialogContent className="sm:max-w-md bg-slate-950 text-slate-100 border-slate-800">
            <DialogHeader><DialogTitle className="flex items-center gap-2 text-white">{syncStatus === 'running' && <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />} Sincronizando (Google Ads)</DialogTitle><DialogDescription className="text-slate-400">{syncStatus === 'running' ? `Progreso: ${Math.round(syncProgress)}%` : 'Finalizado.'}</DialogDescription></DialogHeader>
            <div className="w-full"><Progress value={syncProgress} className="h-2 bg-slate-800 [&>div]:bg-[#4285F4]" /></div>
            <div className="bg-black/50 rounded-md p-4 font-mono text-xs text-green-400 h-64 flex flex-col shadow-inner border border-slate-800 mt-2"><div className="flex-1 overflow-y-auto min-h-0 space-y-1" ref={scrollRef}>{syncLogs.map((log, i) => (<div key={i} className="break-words border-l-2 border-transparent hover:border-slate-700 pl-1">{log}</div>))}</div></div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
