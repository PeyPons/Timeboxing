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
  Info, Activity, Facebook
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

  // --- FILTROS ---
  const [searchTerm, setSearchTerm] = useState('');
  const [showHidden, setShowHidden] = useState(false);

  // --- MODALES ---
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [syncProgress, setSyncProgress] = useState(0); 
  
  const [editingClient, setEditingClient] = useState<{id: string, name: string, group: string, hidden: boolean, isSales: boolean} | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    try {
      // 1. Cargar Campañas de META
      const { data: adsData } = await supabase.from('meta_ads_campaigns').select('*');
      
      // 2. Cargar Configuración (Tabla compartida con Google)
      const { data: settingsData } = await supabase.from('client_settings').select('*');

      // 3. Cargar Cuentas Registradas (Inventario base)
      const { data: accountsData } = await supabase
        .from('ad_accounts_config')
        .select('*')
        .eq('platform', 'meta')
        .eq('is_active', true);
      
      // 4. Cargar Logs
      const { data: logData } = await supabase
        .from('meta_sync_logs')
        .select('created_at')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

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
      setRegisteredAccounts(accountsData || []);

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
            const currentLogs = newRow.logs || [];
            setSyncLogs(currentLogs);
            
            if (currentLogs.length > 0) {
                setSyncProgress(prev => Math.min(prev + 5, 95));
            }

            if (newRow.status === 'completed') {
              setSyncStatus('completed');
              setSyncProgress(100);
              toast.success('Sincronización completada');
              fetchData(); 
              setTimeout(() => { 
                  supabase.removeChannel(channel); 
                  setIsSyncing(false);
              }, 2000);
            } else if (newRow.status === 'error') {
              setSyncStatus('error');
              toast.error('Error en el proceso');
            }
          }
        )
        .subscribe();

    } catch (err) {
      console.error(err);
      setSyncStatus('error');
      setSyncLogs(prev => [...prev, '❌ Error al conectar.']);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [syncLogs, isSyncing]);

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

  // --- LÓGICA PRINCIPAL (CON SEPARACIÓN VIRTUAL) ---
  const reportData = useMemo(() => {
    
    // 1. CONFIGURACIÓN DE SEPARACIÓN (Multi-empresa en una cuenta)
    const SPLIT_RULES: Record<string, { keyword: string, suffix: string, name: string }[]> = {
        'act_781447408943723': [ // ID de Publicidad Loro Parque
            { keyword: 'Loro', suffix: 'LORO', name: 'Loro Parque' },
            { keyword: 'Siam', suffix: 'SIAM', name: 'Siam Park' },
            { keyword: 'Poema', suffix: 'POEMA', name: 'Poema del Mar' },
            // Añade aquí más reglas si es necesario
        ]
    };

    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();
    const remainingDays = daysInMonth - currentDay;

    const stats = new Map<string, { 
      name: string, 
      spent: number, 
      budget: number,
      total_conversions_val: number,
      is_group: boolean,
      isHidden: boolean,
      isSalesAccount: boolean,
      realIds: string[], 
      realIdsNames: {id: string, name: string}[],
      campaigns: MetaCampaignData[],
      isManualGroupBudget: boolean
    }>();

    // 1. INICIALIZAR CON CUENTAS REGISTRADAS (Base)
    registeredAccounts.forEach(acc => {
        const settings = clientSettings[acc.account_id] || { budget: 0, group_name: '', is_hidden: false, is_sales_account: true };
        const groupKey = settings.group_name && settings.group_name.trim() !== '' 
          ? `GROUP-${settings.group_name}` 
          : acc.account_id;
        
        const displayName = settings.group_name && settings.group_name.trim() !== '' 
          ? settings.group_name 
          : (acc.account_name || acc.account_id);

        const groupSettings = clientSettings[groupKey];
        const isGroupManual = groupKey.startsWith('GROUP-') && (groupSettings?.budget > 0);
        const isIndividualManual = !groupKey.startsWith('GROUP-') && settings.budget > 0;

        if (!stats.has(groupKey)) {
            stats.set(groupKey, {
                name: displayName,
                spent: 0,
                budget: 0,
                total_conversions_val: 0,
                is_group: groupKey.startsWith('GROUP-'),
                isHidden: settings.is_hidden,
                isSalesAccount: settings.is_sales_account !== false,
                realIds: [],
                realIdsNames: [],
                campaigns: [],
                isManualGroupBudget: isGroupManual
            });
        }

        const entry = stats.get(groupKey)!;
        if (!entry.realIds.includes(acc.account_id)) {
            entry.realIds.push(acc.account_id);
            entry.realIdsNames.push({id: acc.account_id, name: acc.account_name || acc.account_id});
            if (!entry.is_group && isIndividualManual) {
               entry.budget = settings.budget; 
            }
        }
    });

    // 2. RELLENAR CON DATOS Y APLICAR SEPARACIÓN
    rawData.forEach(row => {
      if (row.date === currentMonthPrefix) {
        
        // --- SEPARACIÓN VIRTUAL ---
        let effectiveClientId = row.client_id;
        let effectiveClientName = row.client_name;

        // Comprobar reglas de división para esta cuenta
        if (SPLIT_RULES[row.client_id]) {
            const rule = SPLIT_RULES[row.client_id].find(r => 
                row.campaign_name.toLowerCase().includes(r.keyword.toLowerCase())
            );
            
            if (rule) {
                // Creamos ID Virtual: act_123_LORO
                effectiveClientId = `${row.client_id}_${rule.suffix}`;
                effectiveClientName = rule.name;
            } 
            // Si no coincide, se queda con el ID original ("Otros")
        }
        // ---------------------------

        const settings = clientSettings[effectiveClientId] || { budget: 0, group_name: '', is_hidden: false, is_sales_account: true };
        
        const groupKey = settings.group_name && settings.group_name.trim() !== '' 
          ? `GROUP-${settings.group_name}` 
          : effectiveClientId;
        
        if (!stats.has(groupKey)) {
             const displayName = settings.group_name || effectiveClientName;
             stats.set(groupKey, { 
                name: displayName, 
                spent: 0, 
                budget: 0,
                total_conversions_val: 0,
                is_group: groupKey.startsWith('GROUP-'),
                isHidden: settings.is_hidden, 
                isSalesAccount: settings.is_sales_account !== false,
                realIds: [],
                realIdsNames: [],
                campaigns: [],
                isManualGroupBudget: false
             });
        }
        
        const entry = stats.get(groupKey)!;
        
        entry.spent += Number(row.cost || 0);
        entry.total_conversions_val += Number(row.conversions_value || 0);
        
        if (!entry.realIds.includes(effectiveClientId)) {
           entry.realIds.push(effectiveClientId);
           entry.realIdsNames.push({id: effectiveClientId, name: effectiveClientName});
           // Si es una cuenta virtual, aquí es donde tomará SU propio presupuesto
           if (!entry.is_group && settings.budget > 0) entry.budget = settings.budget; 
        }

        if (Number(row.cost) > 0 || Number(row.impressions) > 0) { 
            entry.campaigns.push({
                campaign_id: row.campaign_id,
                campaign_name: row.campaign_name,
                status: row.status,
                cost: Number(row.cost),
                conversions_value: Number(row.conversions_value),
                conversions: Number(row.conversions),
                clicks: Number(row.clicks),
                impressions: Number(row.impressions),
                original_client_name: effectiveClientName,
                original_client_id: effectiveClientId
            });
        }
      }
    });

    const report: ClientPacing[] = [];
    
    stats.forEach((value, key) => {
      let finalBudget = value.budget;

      if (value.is_group) {
          const groupSettings = clientSettings[key.replace('GROUP-', '')] || clientSettings[key]; 
          if (groupSettings?.budget > 0) {
              finalBudget = groupSettings.budget;
          }
      }

      const spent = value.spent;
      const avgDailySpend = currentDay > 0 ? spent / currentDay : 0;
      const forecast = avgDailySpend * daysInMonth;
      const progress = finalBudget > 0 ? (spent / finalBudget) * 100 : 0;
      const remainingBudget = Math.max(0, finalBudget - spent);
      const recommendedDaily = remainingDays > 0 ? remainingBudget / remainingDays : 0;
      const globalRoas = spent > 0 ? value.total_conversions_val / spent : 0;

      let status: 'ok' | 'risk' | 'over' | 'under' = 'ok';
      if (finalBudget > 0) {
        if (spent > finalBudget) status = 'over';
        else if (forecast > finalBudget) status = 'risk';
        else if (progress < 50 && currentDay > 20) status = 'under';
      }

      report.push({ 
          client_id: key, 
          client_name: value.name,
          is_group: value.is_group,
          budget: finalBudget, 
          spent, 
          progress, 
          forecast, 
          recommendedDaily,
          avgDailySpend, 
          status, 
          remainingBudget,
          isHidden: value.isHidden,
          isSalesAccount: value.isSalesAccount,
          groupName: value.is_group ? value.name : undefined,
          isManualGroupBudget: value.isManualGroupBudget,
          realIdsList: value.realIdsNames,
          campaigns: value.campaigns.sort((a,b) => b.cost - a.cost),
          globalRoas
      });
    });

    let filtered = report;
    if (!showHidden) {
      filtered = filtered.filter(c => !c.isHidden);
    }
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        c.client_name.toLowerCase().includes(lowerTerm) ||
        c.campaigns.some(camp => camp.campaign_name.toLowerCase().includes(lowerTerm))
      );
    }

    return filtered.sort((a, b) => b.spent - a.spent);
  }, [rawData, clientSettings, registeredAccounts, searchTerm, showHidden]);

  const totalBudget = reportData.reduce((acc, r) => acc + r.budget, 0);
  const totalSpent = reportData.reduce((acc, r) => acc + r.spent, 0);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6 space-y-6 animate-in fade-in duration-500 pb-20">
        
        {/* CABECERA */}
        <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                <div className="flex items-center gap-2">
                    <Button onClick={handleStartSync} disabled={isSyncing} className="bg-[#1877F2] hover:bg-blue-700 text-white border-0">
                        <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                        Sincronizar
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
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Switch id="show-hidden" checked={showHidden} onCheckedChange={setShowHidden} />
                        <Label htmlFor="show-hidden" className="cursor-pointer flex items-center gap-1">
                            {showHidden ? <EyeOff className="w-4 h-4" /> : <Filter className="w-4 h-4" />}
                            Ver Ocultos
                        </Label>
                    </div>
                </div>
            </div>
        </div>

        {/* KPIs GLOBALES */}
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
                <AccordionItem 
                  key={client.client_id} 
                  value={client.client_id} 
                  className={`bg-white border rounded-lg shadow-sm px-2 ${client.isHidden ? 'opacity-60 border-dashed border-slate-300' : 'border-slate-200'}`}
                >
                  <AccordionTrigger className="hover:no-underline py-4 px-2 group">
                    <div className="flex flex-col md:flex-row md:items-center justify-between w-full pr-4 gap-4">
                        <div className="flex items-center gap-3">
                            <div className={`w-2 h-10 rounded-full ${
                                client.status === 'over' ? 'bg-red-500' : 
                                client.status === 'risk' ? 'bg-amber-500' : 'bg-[#1877F2]'
                            }`} />
                            
                            <div className="text-left">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-lg text-slate-900">
                                        {formatProjectName(client.client_name)}
                                    </span>
                                    {client.is_group && <Badge variant="secondary" className="text-[10px] gap-1"><Layers className="w-3 h-3"/> GRUPO</Badge>}
                                    
                                    {client.isSalesAccount && client.globalRoas < 2 && client.spent > 100 && (
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger>
                                                    <AlertTriangle className="w-4 h-4 text-red-500" />
                                                </TooltipTrigger>
                                                <TooltipContent>ROAS Global Bajo ({client.globalRoas.toFixed(2)})</TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    )}

                                    {client.isHidden && <Badge variant="outline" className="text-[10px]">OCULTO</Badge>}
                                </div>
                                <div className="text-xs text-slate-500 flex gap-2">
                                   <span>Gastado: {formatCurrency(client.spent)}</span>
                                   {client.budget > 0 && (
                                       <>
                                        <span>•</span>
                                        <span>{client.progress.toFixed(1)}%</span>
                                       </>
                                   )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-900"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!client.is_group) {
                                        setEditingClient({
                                            id: client.client_id,
                                            name: client.client_name,
                                            group: clientSettings[client.client_id]?.group_name || '',
                                            hidden: clientSettings[client.client_id]?.is_hidden || false,
                                            isSales: clientSettings[client.client_id]?.is_sales_account !== false
                                        });
                                    } else {
                                       toast.info("Abre el grupo para editar las cuentas individuales.");
                                    }
                                }}
                            >
                                <Settings className="w-4 h-4" />
                            </Button>

                            {client.status === 'risk' && <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50"><AlertTriangle className="w-3 h-3 mr-1"/> Riesgo</Badge>}
                            {client.status === 'over' && <Badge variant="destructive">Excedido</Badge>}
                            <div className="text-right hidden md:block">
                                <div className="text-2xl font-mono font-bold tracking-tight">{formatCurrency(client.spent)}</div>
                            </div>
                        </div>
                    </div>
                  </AccordionTrigger>
                  
                  <AccordionContent className="border-t border-slate-100 mt-2 pt-6 pb-6 px-2">
                    <div className="grid md:grid-cols-1 gap-8">
                        
                        {/* GESTIÓN DE GRUPOS */}
                        {client.is_group && (
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                                    <Layers className="w-3 h-3"/> Cuentas Vinculadas
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {client.realIdsList.map(subClient => (
                                        <div key={subClient.id} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded border border-slate-200 text-sm shadow-sm">
                                            <span className="text-slate-700 font-medium">{formatProjectName(subClient.name)}</span>
                                            <button 
                                                onClick={() => setEditingClient({
                                                    id: subClient.id,
                                                    name: subClient.name,
                                                    group: client.groupName || '',
                                                    hidden: false,
                                                    isSales: clientSettings[subClient.id]?.is_sales_account !== false
                                                })}
                                                className="text-slate-400 hover:text-red-500 transition-colors ml-1"
                                                title="Configurar / Desvincular"
                                            >
                                                <Settings className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="grid md:grid-cols-2 gap-8">
                            {/* FINANZAS */}
                            <div className="space-y-6">
                                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                    Control Financiero
                                </h3>
                                
                                <div className="space-y-4 bg-slate-50 p-4 rounded-md border border-slate-100 h-full flex flex-col">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <label className="text-sm font-medium text-slate-600">
                                                Presupuesto {client.is_group ? 'Total' : 'Mensual'}
                                            </label>
                                            <TooltipProvider><Tooltip><TooltipTrigger><Info className="w-3 h-3 text-blue-400" /></TooltipTrigger><TooltipContent><p>Establece el límite de gasto mensual para ver el progreso.</p></TooltipContent></Tooltip></TooltipProvider>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-400">€</span>
                                            <Input 
                                                type="number" 
                                                defaultValue={client.budget > 0 ? client.budget : ''} 
                                                onBlur={(e) => handleSaveBudget(client.client_id, e.target.value)}
                                                className={`h-8 w-24 text-right bg-white border-blue-200 focus:border-blue-500`}
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs text-slate-500">
                                            <span>Consumo ({client.budget > 0 ? client.progress.toFixed(1) : 0}%)</span>
                                            <span className={client.remainingBudget < 0 ? 'text-red-500 font-bold' : ''}>
                                                Disp: {formatCurrency(client.remainingBudget)}
                                            </span>
                                        </div>
                                        <Progress 
                                            value={Math.min(client.progress, 100)} 
                                            className={`h-2 ${client.status === 'over' ? '[&>div]:bg-red-500' : client.status === 'risk' ? '[&>div]:bg-amber-500' : '[&>div]:bg-[#1877F2]'}`} 
                                        />
                                    </div>

                                    {/* GRID PROYECCIONES */}
                                    <div className="grid grid-cols-2 gap-4 pt-2">
                                        <div className="bg-white p-3 rounded border border-slate-200 relative overflow-hidden">
                                            <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-wide">Límite Diario</div>
                                            <div className="text-lg font-bold text-indigo-600">
                                                {formatCurrency(client.recommendedDaily)}
                                            </div>
                                            <div className="flex items-center gap-1 mt-2 mb-1">
                                                <span className="text-[10px] text-slate-400">Ritmo Est.:</span>
                                                <span className="text-xs font-semibold text-slate-700">{formatCurrency(client.avgDailySpend)}</span>
                                            </div>
                                        </div>

                                        <div className="bg-white p-3 rounded border border-slate-200">
                                            <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-wide">Proyección Mes</div>
                                            <div className={`text-lg font-bold ${client.status === 'risk' ? 'text-amber-600' : 'text-slate-700'}`}>
                                                {formatCurrency(client.forecast)}
                                            </div>
                                            <div className="mt-2 text-[10px] border-t pt-2 border-slate-100 flex justify-between items-center">
                                                <span className="text-slate-400">Desvío:</span>
                                                <span className={`font-bold ${diffFromBudget > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                    {diffFromBudget > 0 ? '+' : ''}{formatCurrency(diffFromBudget)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* DETALLE DE CAMPAÑAS */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-slate-400" />
                                    Rendimiento Campañas
                                </h3>
                                <div className="rounded-md border border-slate-200 overflow-hidden max-h-[300px] overflow-y-auto bg-white">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 sticky top-0 z-10">
                                            <tr>
                                                <th className="px-3 py-2 w-[35%] min-w-[150px]">Campaña</th>
                                                <th className="px-2 py-2 text-right">Gasto</th>
                                                <th className="px-2 py-2 text-right hidden sm:table-cell">Tráfico</th>
                                                <th className="px-2 py-2 text-right">Conv.</th>
                                                {client.isSalesAccount && <th className="px-2 py-2 text-center">ROAS</th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {client.campaigns.map((camp, idx) => {
                                                const campRoas = camp.cost > 0 ? (camp.conversions_value || 0) / camp.cost : 0;
                                                const cpa = camp.conversions && camp.conversions > 0 ? camp.cost / camp.conversions : 0;
                                                const cpc = camp.clicks && camp.clicks > 0 ? camp.cost / camp.clicks : 0;
                                                const ctr = camp.impressions && camp.impressions > 0 ? (camp.clicks / camp.impressions) * 100 : 0;
                                                
                                                const conversions = Math.round(camp.conversions || 0);

                                                return (
                                                    <tr key={`${camp.campaign_id}-${idx}`} className="hover:bg-slate-50/50">
                                                        <td className="px-3 py-3 align-top">
                                                            <div className="font-medium text-slate-700 line-clamp-2" title={camp.campaign_name}>
                                                                {camp.campaign_name}
                                                            </div>
                                                            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[9px] text-slate-400">
                                                                <span className="flex items-center gap-1">
                                                                    <span className={`w-1.5 h-1.5 rounded-full ${camp.status === 'ENABLED' ? 'bg-emerald-400' : 'bg-slate-300'}`}></span>
                                                                    {camp.status === 'ENABLED' ? 'ON' : 'OFF'}
                                                                </span>
                                                                {client.is_group && <span className="truncate max-w-[100px] text-slate-300">| {formatProjectName(camp.original_client_name || '')}</span>}
                                                            </div>
                                                        </td>
                                                        
                                                        <td className="px-2 py-3 text-right font-medium text-slate-700 align-top">
                                                            {formatCurrency(camp.cost)}
                                                        </td>

                                                        <td className="px-2 py-3 text-right hidden sm:table-cell align-top">
                                                            <div className="flex flex-col items-end leading-tight">
                                                                <span className="text-slate-600" title="Coste por Clic">{formatCurrency(cpc)}</span>
                                                                <span className="text-[10px] text-slate-400" title="CTR">{ctr.toFixed(1)}% CTR</span>
                                                            </div>
                                                        </td>

                                                        <td className="px-2 py-3 text-right align-top">
                                                            <div className="flex flex-col items-end leading-tight">
                                                                <span className="font-bold">{conversions}</span>
                                                                
                                                                {conversions > 0 && (
                                                                    <span className="text-[10px] text-slate-500">
                                                                        {client.isSalesAccount 
                                                                            ? formatCurrency(camp.conversions_value || 0) 
                                                                            : `${formatCurrency(cpa)} /lead`
                                                                        }
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>

                                                        {client.isSalesAccount && (
                                                            <td className="px-2 py-3 text-center align-top">
                                                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${getRoasColor(campRoas)}`}>
                                                                    {campRoas.toFixed(2)}
                                                                </Badge>
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
              })}
            </Accordion>
         </div>

         {/* DIALOGO DE CONFIGURACIÓN */}
         <Dialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Configurar Cliente Meta</DialogTitle>
                    <DialogDescription>
                        Ajusta las preferencias para {editingClient?.name}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Nombre del Grupo (Holding)</Label>
                        <Input 
                            placeholder="Ej: Grupo Hotelero" 
                            value={editingClient?.group || ''}
                            onChange={(e) => setEditingClient(prev => prev ? {...prev, group: e.target.value} : null)}
                        />
                        <p className="text-xs text-slate-500">
                            Agrupa varias cuentas bajo un mismo presupuesto.
                        </p>
                    </div>
                    <div className="flex items-center justify-between border-t pt-4 border-slate-100">
                        <Label htmlFor="sales-mode" className="flex flex-col">
                            <span>Es Cuenta de Ventas (Ecommerce)</span>
                            <span className="text-xs font-normal text-slate-500">Habilita métricas de ROAS y Valor de Conversión.</span>
                        </Label>
                        <Switch 
                            id="sales-mode" 
                            checked={editingClient?.isSales !== false} 
                            onCheckedChange={(checked) => setEditingClient(prev => prev ? {...prev, isSales: checked} : null)}
                        />
                    </div>
                    <div className="flex items-center space-x-2 pt-2">
                        <Switch 
                            id="hide-mode" 
                            checked={editingClient?.hidden || false}
                            onCheckedChange={(checked) => setEditingClient(prev => prev ? {...prev, hidden: checked} : null)}
                        />
                        <Label htmlFor="hide-mode">Ocultar del listado principal</Label>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setEditingClient(null)}>Cancelar</Button>
                    <Button onClick={handleSaveClientSettings}>Guardar Cambios</Button>
                </DialogFooter>
            </DialogContent>
         </Dialog>

        {/* MODAL DE SINCRONIZACIÓN */}
        <Dialog open={isSyncing} onOpenChange={(open) => { if(syncStatus !== 'running') setIsSyncing(open); }}>
          <DialogContent className="sm:max-w-md bg-slate-950 text-slate-100 border-slate-800">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-white">
                {syncStatus === 'running' && <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />}
                Sincronizando (Meta Ads)
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
