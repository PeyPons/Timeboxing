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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  RefreshCw, Clock, AlertTriangle, Search, Settings, EyeOff, Layers, Filter, 
  Info, Activity, Facebook, Scissors, Trash2, Plus
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// --- TIPOS ---
interface MetaCampaignData {
  campaign_id: string;
  campaign_name: string;
  status: string;
  cost: number;
  conversions_value?: number;
  conversions?: number; 
  clicks?: number;
  impressions?: number;
  original_client_name?: string; 
  original_client_id?: string;
}

interface SegmentationRule {
  id: string;
  accountId: string;
  keyword: string;
  virtualName: string;
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
  campaigns: MetaCampaignData[];
  isHidden: boolean;
  groupName?: string;
  isManualGroupBudget?: boolean;
  isSalesAccount: boolean;
  realIdsList: {id: string, name: string}[]; 
  globalRoas: number;
}

const formatProjectName = (name: string) => name.replace(/^(Cliente|Client|Cuenta|Account)\s*[-:]?\s*/i, '');
// Normalizamos el ID para evitar problemas con 'act_'
const normalizeId = (id: string) => id ? id.replace(/^act_/, '').trim() : '';

const getRoasColor = (roas: number) => {
    if (roas >= 4) return "text-emerald-600 bg-emerald-50 border-emerald-200";
    if (roas >= 2) return "text-blue-600 bg-blue-50 border-blue-200";
    if (roas >= 1) return "text-amber-600 bg-amber-50 border-amber-200";
    return "text-red-600 bg-red-50 border-red-200";
};

export default function MetaAdsPage() {
  const [rawData, setRawData] = useState<any[]>([]);
  const [clientSettings, setClientSettings] = useState<Record<string, any>>({});
  const [registeredAccounts, setRegisteredAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // --- REGLAS DE SEGMENTACIÓN (Persistentes en LocalStorage) ---
  const [segmentationRules, setSegmentationRules] = useState<SegmentationRule[]>(() => {
      const saved = localStorage.getItem('meta_segmentation_rules');
      return saved ? JSON.parse(saved) : [];
  });

  // --- FILTROS ---
  const [searchTerm, setSearchTerm] = useState('');
  const [showHidden, setShowHidden] = useState(false);

  // --- MODALES ---
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [syncProgress, setSyncProgress] = useState(0); 
  
  const [editingClient, setEditingClient] = useState<{id: string, name: string, group: string, hidden: boolean, isSales: boolean} | null>(null);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);

  // Estado formulario nueva regla (Tijera)
  const [newRuleAccount, setNewRuleAccount] = useState('');
  const [newRuleKeyword, setNewRuleKeyword] = useState('');
  const [newRuleName, setNewRuleName] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    try {
      // Cargar datos en paralelo
      const [adsRes, settingsRes, accountsRes, logsRes] = await Promise.all([
          supabase.from('meta_ads_campaigns').select('*'),
          supabase.from('client_settings').select('*'),
          supabase.from('ad_accounts_config').select('*').eq('platform', 'meta').eq('is_active', true),
          supabase.from('meta_sync_logs').select('created_at').eq('status', 'completed').order('created_at', { ascending: false }).limit(1).single()
      ]);

      const settingsMap: Record<string, any> = {};
      settingsRes.data?.forEach((s: any) => { 
        settingsMap[s.client_id] = {
          budget: Number(s.budget_limit) || 0,
          group_name: s.group_name || '',
          is_hidden: s.is_hidden || false,
          is_sales_account: s.is_sales_account !== false 
        }; 
      });

      setRawData(adsRes.data || []);
      setClientSettings(settingsMap);
      setRegisteredAccounts(accountsRes.data || []);

      if (logsRes.data) {
        setLastSyncTime(new Date(logsRes.data.created_at));
      } else if (adsRes.data && adsRes.data.length > 0) {
         // Fallback por si no hay logs
         const dates = adsRes.data.map((d: any) => new Date(d.created_at || d.date).getTime());
         setLastSyncTime(new Date(Math.max(...dates)));
      }
    } catch (error) {
      console.error('Error fetching data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // --- WORKER SYNC ---
  const handleStartSync = async () => {
    setIsSyncing(true);
    setSyncStatus('running');
    setSyncLogs(['🚀 Conectando con Meta API...']);
    setSyncProgress(0);

    try {
      const { data, error } = await supabase
        .from('meta_sync_logs')
        .insert({ status: 'pending', logs: ['Iniciando worker...'] })
        .select()
        .single();

      if (error) throw error;
      const jobId = data.id;

      const channel = supabase
        .channel(`meta-sync-${jobId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'meta_sync_logs', filter: `id=eq.${jobId}` },
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

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [syncLogs]);

  // --- GESTIÓN DE REGLAS DE DIVISIÓN ---
  const handleAddRule = () => {
      if (!newRuleAccount || !newRuleKeyword || !newRuleName) {
          toast.error("Por favor, rellena todos los campos");
          return;
      }
      const newRule: SegmentationRule = {
          id: crypto.randomUUID(),
          accountId: newRuleAccount,
          keyword: newRuleKeyword,
          virtualName: newRuleName
      };
      const updated = [...segmentationRules, newRule];
      setSegmentationRules(updated);
      localStorage.setItem('meta_segmentation_rules', JSON.stringify(updated));
      setNewRuleKeyword('');
      setNewRuleName('');
      toast.success("Regla creada. Las cuentas se separarán automáticamente.");
  };

  const handleDeleteRule = (id: string) => {
      const updated = segmentationRules.filter(r => r.id !== id);
      setSegmentationRules(updated);
      localStorage.setItem('meta_segmentation_rules', JSON.stringify(updated));
      toast.info("Regla eliminada");
  };

  // --- GUARDADO DE CONFIGURACIÓN ---
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

  // --- LÓGICA PRINCIPAL DE DATOS + SEGMENTACIÓN ---
  const reportData = useMemo(() => {
    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();

    const stats = new Map<string, { 
      name: string, spent: number, budget: number, total_conversions_val: number,
      is_group: boolean, isHidden: boolean, isSalesAccount: boolean,
      realIds: string[], realIdsNames: {id: string, name: string}[],
      campaigns: MetaCampaignData[], isManualGroupBudget: boolean
    }>();

    // A. INICIALIZAR CUENTAS BASE (Desde configuración)
    registeredAccounts.forEach(acc => {
        const settings = clientSettings[acc.account_id] || { budget: 0, group_name: '', is_hidden: false, is_sales_account: true };
        const groupKey = settings.group_name?.trim() ? `GROUP-${settings.group_name}` : acc.account_id;
        
        // Si no está agrupado, creamos la entrada base
        if (!stats.has(groupKey) && !settings.group_name?.trim()) {
            stats.set(groupKey, {
                name: acc.account_name || acc.account_id,
                spent: 0, budget: settings.budget || 0, total_conversions_val: 0,
                is_group: false, isHidden: settings.is_hidden, isSalesAccount: settings.is_sales_account !== false,
                realIds: [acc.account_id], realIdsNames: [{id: acc.account_id, name: acc.account_name}], 
                campaigns: [], isManualGroupBudget: false
            });
        }
    });

    // B. PROCESAR DATOS REALES Y APLICAR REGLAS "TIJERA"
    rawData.forEach(row => {
      if (row.date === currentMonthPrefix) {
        
        let finalId = row.client_id;
        let finalName = row.client_name;

        // --- APLICAR REGLAS DE SEGMENTACIÓN ---
        // Buscamos reglas que coincidan con esta cuenta (normalizando IDs)
        const rulesForAccount = segmentationRules.filter(r => normalizeId(r.accountId) === normalizeId(row.client_id));
        
        if (rulesForAccount.length > 0) {
            // Comprobamos si el nombre de la campaña contiene la palabra clave
            const match = rulesForAccount.find(r => 
                row.campaign_name.toLowerCase().includes(r.keyword.toLowerCase())
            );
            
            if (match) {
                // EUREKA: SEPARAMOS LA CAMPAÑA EN UNA CUENTA VIRTUAL
                finalId = `${row.client_id}_${match.keyword.toUpperCase()}`; 
                finalName = match.virtualName;
            }
        }
        // -------------------------------------

        const settings = clientSettings[finalId] || { budget: 0, group_name: '', is_hidden: false, is_sales_account: true };
        const groupKey = settings.group_name?.trim() ? `GROUP-${settings.group_name}` : finalId;
        
        // Si la cuenta (virtual o real) no existe en el mapa, la creamos
        if (!stats.has(groupKey)) {
             stats.set(groupKey, { 
                name: settings.group_name || finalName, 
                spent: 0, budget: 0, total_conversions_val: 0,
                is_group: groupKey.startsWith('GROUP-'),
                isHidden: settings.is_hidden, isSalesAccount: settings.is_sales_account !== false,
                realIds: [], realIdsNames: [], campaigns: [], isManualGroupBudget: false
             });
        }
        
        const entry = stats.get(groupKey)!;
        entry.spent += Number(row.cost || 0);
        entry.total_conversions_val += Number(row.conversions_value || 0);
        
        if (!entry.realIds.includes(finalId)) {
           entry.realIds.push(finalId);
           entry.realIdsNames.push({id: finalId, name: finalName});
           // Si es una cuenta virtual con presupuesto propio, lo cargamos
           if (!entry.is_group && settings.budget > 0) entry.budget = settings.budget; 
        }

        if (Number(row.cost) > 0 || Number(row.impressions) > 0) { 
            entry.campaigns.push({
                ...row,
                original_client_name: finalName,
                original_client_id: finalId,
                cost: Number(row.cost),
                conversions_value: Number(row.conversions_value),
                conversions: Number(row.conversions),
                clicks: Number(row.clicks),
                impressions: Number(row.impressions)
            });
        }
      }
    });

    const report: ClientPacing[] = [];
    
    stats.forEach((value, key) => {
      // Calcular presupuesto
      let finalBudget = value.budget;
      if (value.is_group) {
          const groupSettings = clientSettings[key.replace('GROUP-', '')] || clientSettings[key]; 
          if (groupSettings?.budget > 0) finalBudget = groupSettings.budget;
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
      }

      report.push({ 
          client_id: key, 
          client_name: value.name,
          is_group: value.is_group,
          budget: finalBudget, 
          spent, progress, forecast, recommendedDaily, avgDailySpend, 
          status, remainingBudget, isHidden: value.isHidden,
          isSalesAccount: value.isSalesAccount,
          groupName: value.is_group ? value.name : undefined,
          isManualGroupBudget: value.isManualGroupBudget,
          realIdsList: value.realIdsNames,
          campaigns: value.campaigns.sort((a,b) => b.cost - a.cost),
          globalRoas
      });
    });

    let filtered = report;
    if (!showHidden) filtered = filtered.filter(c => !c.isHidden);
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(c => c.client_name.toLowerCase().includes(lower) || c.campaigns.some(camp => camp.campaign_name.toLowerCase().includes(lower)));
    }

    return filtered.sort((a, b) => b.spent - a.spent);
  }, [rawData, clientSettings, registeredAccounts, searchTerm, showHidden, segmentationRules]);

  const totalBudget = reportData.reduce((acc, r) => acc + r.budget, 0);
  const totalSpent = reportData.reduce((acc, r) => acc + r.spent, 0);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6 space-y-6 pb-20">
        
        {/* HEADER */}
        <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-[#1877F2] rounded-xl shadow-lg shadow-blue-900/10">
                        <Facebook className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Meta Ads Manager</h1>
                        <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                            <Clock className="w-4 h-4" />
                            <span>Última sinc: {lastSyncTime ? lastSyncTime.toLocaleString() : 'Pendiente...'}</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    {/* BOTÓN DIVIDIR CUENTAS */}
                    <Button variant="outline" onClick={() => setIsSplitModalOpen(true)} className="border-slate-200 text-slate-700 w-full md:w-auto">
                        <Scissors className="w-4 h-4 mr-2" /> Dividir Cuentas
                    </Button>
                    <Button onClick={handleStartSync} disabled={isSyncing} className="bg-[#1877F2] hover:bg-blue-700 text-white w-full md:w-auto">
                        <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} /> Sincronizar
                    </Button>
                </div>
            </div>

            {/* FILTROS */}
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input 
                        placeholder="Buscar cliente, grupo o campaña..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 bg-slate-50 border-slate-200"
                    />
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Switch id="show-hidden" checked={showHidden} onCheckedChange={setShowHidden} />
                    <Label htmlFor="show-hidden" className="cursor-pointer">Ver Ocultos</Label>
                </div>
            </div>
        </div>

        {/* KPIs */}
         <div className="grid gap-4 md:grid-cols-3">
           <Card className="bg-white border-slate-200 shadow-sm">
             <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold text-slate-400 uppercase">Inversión (Mes)</CardTitle></CardHeader>
             <CardContent>
               <div className="text-3xl font-bold text-slate-900">{formatCurrency(totalSpent)}</div>
               <Progress value={totalBudget > 0 ? (totalSpent/totalBudget)*100 : 0} className="h-1.5 mt-3 bg-slate-100 [&>div]:bg-[#1877F2]" />
               <p className="text-xs text-slate-400 mt-2 text-right">PPT Global Definido: {formatCurrency(totalBudget)}</p>
             </CardContent>
           </Card>
         </div>

         {/* LISTADO */}
         <div className="space-y-4">
            <Accordion type="single" collapsible className="w-full space-y-2">
              {reportData.map((client) => {
                  const diffFromBudget = client.forecast - client.budget;
                  return (
                <AccordionItem key={client.client_id} value={client.client_id} className={`bg-white border rounded-lg shadow-sm px-2 ${client.isHidden ? 'opacity-60 border-dashed border-slate-300' : 'border-slate-200'}`}>
                  <AccordionTrigger className="hover:no-underline py-4 px-2 group">
                    <div className="flex flex-col md:flex-row md:items-center justify-between w-full pr-4 gap-4">
                        <div className="flex items-center gap-3">
                            <div className={`w-2 h-10 rounded-full ${client.status === 'over' ? 'bg-red-500' : client.status === 'risk' ? 'bg-amber-500' : 'bg-[#1877F2]'}`} />
                            <div className="text-left">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-lg text-slate-900">{formatProjectName(client.client_name)}</span>
                                    {client.is_group && <Badge variant="secondary" className="text-[10px]"><Layers className="w-3 h-3 mr-1"/> GRUPO</Badge>}
                                </div>
                                <div className="text-xs text-slate-500">Gastado: {formatCurrency(client.spent)} {client.budget > 0 && `• ${client.progress.toFixed(1)}%`}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); if (!client.is_group) setEditingClient({id: client.client_id, name: client.client_name, group: clientSettings[client.client_id]?.group_name || '', hidden: clientSettings[client.client_id]?.is_hidden || false, isSales: clientSettings[client.client_id]?.is_sales_account !== false}); else toast.info("Abre el grupo para editar."); }}>
                                <Settings className="w-4 h-4 text-slate-400" />
                            </Button>
                            <div className="text-2xl font-mono font-bold text-slate-900 hidden md:block">{formatCurrency(client.spent)}</div>
                        </div>
                    </div>
                  </AccordionTrigger>
                  
                  <AccordionContent className="border-t border-slate-100 mt-2 pt-6 pb-6 px-2">
                    <div className="grid md:grid-cols-1 gap-8">
                        {client.is_group && (
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex gap-2"><Layers className="w-3 h-3"/> Cuentas Vinculadas</h4>
                                <div className="flex flex-wrap gap-2">{client.realIdsList.map(sub => (
                                    <div key={sub.id} className="flex items-center gap-2 bg-white px-3 py-1 rounded border text-sm shadow-sm"><span className="font-medium text-slate-700">{formatProjectName(sub.name)}</span>
                                    <button onClick={() => setEditingClient({id: sub.id, name: sub.name, group: client.groupName || '', hidden: false, isSales: true})} className="text-slate-400 hover:text-blue-500 ml-1"><Settings className="w-3 h-3" /></button>
                                    </div>
                                ))}</div>
                            </div>
                        )}

                        <div className="grid md:grid-cols-2 gap-8">
                            {/* CONTROL FINANCIERO */}
                            <div className="bg-slate-50 p-4 rounded-md border border-slate-100 h-full flex flex-col space-y-4">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-medium text-slate-600">Presupuesto</label>
                                    <div className="flex items-center gap-2"><span className="text-slate-400">€</span><Input type="number" defaultValue={client.budget > 0 ? client.budget : ''} onBlur={(e) => handleSaveBudget(client.client_id, e.target.value)} className="h-8 w-24 text-right bg-white border-blue-200 focus:border-blue-500" placeholder="0" /></div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs text-slate-500"><span>Consumo</span><span className={client.remainingBudget < 0 ? 'text-red-500 font-bold' : ''}>Disp: {formatCurrency(client.remainingBudget)}</span></div>
                                    <Progress value={Math.min(client.progress, 100)} className={`h-2 ${client.status === 'over' ? '[&>div]:bg-red-500' : '[&>div]:bg-[#1877F2]'}`} />
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div className="bg-white p-3 rounded border border-slate-200"><div className="text-[10px] text-slate-500 uppercase mb-1">Límite Diario</div><div className="text-lg font-bold text-indigo-600">{formatCurrency(client.recommendedDaily)}</div></div>
                                    <div className="bg-white p-3 rounded border border-slate-200"><div className="text-[10px] text-slate-500 uppercase mb-1">Proyección</div><div className="text-lg font-bold text-slate-700">{formatCurrency(client.forecast)}</div></div>
                                </div>
                            </div>

                            {/* LISTA DE CAMPAÑAS */}
                            <div className="rounded-md border border-slate-200 overflow-hidden max-h-[300px] overflow-y-auto bg-white">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0 z-10 border-b border-slate-200"><tr><th className="px-3 py-2">Campaña</th><th className="px-2 py-2 text-right">Gasto</th><th className="px-2 py-2 text-right">Conv.</th>{client.isSalesAccount && <th className="px-2 py-2 text-center">ROAS</th>}</tr></thead>
                                    <tbody className="divide-y divide-slate-100">{client.campaigns.map((camp, idx) => {
                                        const roas = camp.cost > 0 ? (camp.conversions_value||0)/camp.cost : 0;
                                        return (
                                            <tr key={idx} className="hover:bg-slate-50"><td className="px-3 py-2"><div className="font-medium truncate max-w-[150px] text-slate-700" title={camp.campaign_name}>{camp.campaign_name}</div></td>
                                            <td className="px-2 py-2 text-right font-medium text-slate-900">{formatCurrency(camp.cost)}</td><td className="px-2 py-2 text-right">{Math.round(camp.conversions||0)}</td>
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

         {/* MODAL CONFIGURACIÓN CLIENTE */}
         <Dialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)}>
            <DialogContent>
                <DialogHeader><DialogTitle>Configurar Cliente</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Nombre Grupo (Holding)</Label>
                        <Input placeholder="Ej: Grupo Hotelero" value={editingClient?.group || ''} onChange={(e) => setEditingClient(prev => prev ? {...prev, group: e.target.value} : null)} />
                        <p className="text-xs text-slate-500">Agrupa varias cuentas para ver totales conjuntos.</p>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-100"><Label>Cuenta de Ventas (ROAS)</Label><Switch checked={editingClient?.isSales !== false} onCheckedChange={(c) => setEditingClient(prev => prev ? {...prev, isSales: c} : null)} /></div>
                    <div className="flex justify-between items-center"><Label>Ocultar del listado</Label><Switch checked={editingClient?.hidden || false} onCheckedChange={(c) => setEditingClient(prev => prev ? {...prev, hidden: c} : null)} /></div>
                </div>
                <DialogFooter><Button onClick={handleSaveClientSettings}>Guardar</Button></DialogFooter>
            </DialogContent>
         </Dialog>

         {/* MODAL DIVIDIR CUENTAS (TIJERAS) */}
         <Dialog open={isSplitModalOpen} onOpenChange={setIsSplitModalOpen}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><Scissors className="w-5 h-5"/> Dividir Cuentas (Segmentación)</DialogTitle>
                    <DialogDescription>Crea cuentas virtuales separando campañas que contengan una palabra clave.</DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                    {/* Formulario */}
                    <div className="grid grid-cols-12 gap-3 items-end bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <div className="col-span-4 space-y-1">
                            <Label className="text-xs font-medium">Cuenta Origen</Label>
                            <Select value={newRuleAccount} onValueChange={setNewRuleAccount}>
                                <SelectTrigger className="bg-white"><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                                <SelectContent>
                                    {registeredAccounts.map(acc => (
                                        <SelectItem key={acc.account_id} value={acc.account_id}>{acc.account_name || acc.account_id}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="col-span-3 space-y-1">
                            <Label className="text-xs font-medium">Si contiene...</Label>
                            <Input placeholder="Ej: Loro" className="bg-white" value={newRuleKeyword} onChange={e => setNewRuleKeyword(e.target.value)} />
                        </div>
                        <div className="col-span-3 space-y-1">
                            <Label className="text-xs font-medium">Crear cuenta llamada...</Label>
                            <Input placeholder="Ej: Loro Parque" className="bg-white" value={newRuleName} onChange={e => setNewRuleName(e.target.value)} />
                        </div>
                        <div className="col-span-2">
                            <Button onClick={handleAddRule} className="w-full bg-slate-900 hover:bg-slate-800"><Plus className="w-4 h-4"/></Button>
                        </div>
                    </div>

                    {/* Lista */}
                    <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-500 uppercase">Reglas Activas</h4>
                        {segmentationRules.length === 0 && <p className="text-sm text-slate-400 italic">No hay reglas definidas.</p>}
                        {segmentationRules.map(rule => (
                            <div key={rule.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-md text-sm shadow-sm">
                                <div className="flex items-center gap-3">
                                    <Badge variant="outline" className="font-mono text-xs">{normalizeId(rule.accountId)}</Badge>
                                    <span className="text-slate-500">Si contiene <strong>"{rule.keyword}"</strong></span>
                                    <span className="text-slate-300">→</span>
                                    <span className="font-bold text-blue-600">{rule.virtualName}</span>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteRule(rule.id)} className="text-red-500 hover:bg-red-50 h-8 w-8 p-0"><Trash2 className="w-4 h-4"/></Button>
                            </div>
                        ))}
                    </div>
                </div>
            </DialogContent>
         </Dialog>

        {/* MODAL SYNC */}
        <Dialog open={isSyncing} onOpenChange={(open) => { if(syncStatus !== 'running') setIsSyncing(open); }}>
          <DialogContent className="sm:max-w-md bg-slate-950 text-slate-100 border-slate-800">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-white">
                {syncStatus === 'running' && <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />}
                Sincronizando
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                 {syncStatus === 'running' ? `Progreso: ${Math.round(syncProgress)}%` : 'Finalizado.'}
              </DialogDescription>
            </DialogHeader>
            <div className="w-full"><Progress value={syncProgress} className="h-2 bg-slate-800 [&>div]:bg-[#1877F2]" /></div>
            <div className="bg-black/50 rounded-md p-4 font-mono text-xs text-blue-400 h-64 flex flex-col shadow-inner border border-slate-800 mt-2">
              <div className="flex-1 overflow-y-auto min-h-0 space-y-1" ref={scrollRef}>
                  {syncLogs.map((log, i) => (
                    <div key={i} className="break-words border-l-2 border-transparent hover:border-slate-700 pl-1">{log}</div>
                  ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
