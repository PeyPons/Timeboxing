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
  Info, TrendingUp, TrendingDown, Unlink
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// --- TIPOS ---
interface CampaignData {
  campaign_id: string;
  campaign_name: string;
  status: string;
  cost: number;
  conversions_value?: number;
  conversions?: number; // Cantidad de conversiones
  daily_budget?: number; // Presupuesto diario configurado en Google
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
  avgDailySpend: number; // Gasto medio actual
  status: 'ok' | 'risk' | 'over' | 'under';
  remainingBudget: number;
  campaigns: CampaignData[];
  isHidden: boolean;
  groupName?: string;
  isManualGroupBudget?: boolean;
  realIdsList: {id: string, name: string}[]; // Lista de cuentas dentro del grupo
  globalRoas: number; // ROAS Global del cliente/grupo
}

const formatProjectName = (name: string) => name.replace(/^(Cliente|Client)\s*[-:]?\s*/i, '');

// Función auxiliar para calcular color de ROAS
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

  // --- FILTROS ---
  const [searchTerm, setSearchTerm] = useState('');
  const [showHidden, setShowHidden] = useState(false);

  // --- MODALES ---
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [syncProgress, setSyncProgress] = useState(0); 
  
  const [editingClient, setEditingClient] = useState<{id: string, name: string, group: string, hidden: boolean} | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    try {
      const { data: adsData } = await supabase.from('google_ads_campaigns').select('*');
      const { data: settingsData } = await supabase.from('client_settings').select('*');
      
      // Obtener última fecha REAL de sincronización
      const { data: logData } = await supabase
        .from('ad_sync_logs')
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
          is_hidden: s.is_hidden || false
        }; 
      });

      setRawData(adsData || []);
      setClientSettings(settingsMap);

      if (logData) {
        setLastSyncTime(new Date(logData.created_at));
      } else if (adsData && adsData.length > 0) {
         // Fallback por si no hay logs aún
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
    setSyncLogs(['🚀 Iniciando conexión...']);
    setSyncProgress(0);

    try {
      const { data, error } = await supabase
        .from('ad_sync_logs')
        .insert({ status: 'pending', logs: ['Esperando worker...'] })
        .select()
        .single();

      if (error) throw error;
      const jobId = data.id;

      const channel = supabase
        .channel(`job-${jobId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'ad_sync_logs', filter: `id=eq.${jobId}` },
          (payload) => {
            const newRow = payload.new;
            const currentLogs = newRow.logs || [];
            setSyncLogs(currentLogs);
            
            // Estimación de progreso basada en logs
            if (currentLogs.length > 0) {
                const lastLog = currentLogs[currentLogs.length - 1];
                const match = lastLog.match(/\[(\d+)\/(\d+)\]/);
                if (match) {
                    const current = parseInt(match[1]);
                    const total = parseInt(match[2]);
                    setSyncProgress((current / total) * 100);
                }
            }

            if (newRow.status === 'completed') {
              setSyncStatus('completed');
              setSyncProgress(100);
              toast.success('Sincronización completada');
              fetchData(); 
              setTimeout(() => { supabase.removeChannel(channel); }, 2000);
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

  // --- GUARDAR PRESUPUESTO ---
  const handleSaveBudget = async (clientId: string, amount: string) => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return;
    
    setClientSettings(prev => ({
      ...prev,
      [clientId]: { ...prev[clientId], budget: numAmount }
    }));

    await supabase.from('client_settings').upsert({ 
      client_id: clientId, 
      budget_limit: numAmount 
    }, { onConflict: 'client_id' });
  };

  const handleSaveClientSettings = async () => {
    if (!editingClient) return;
    
    await supabase.from('client_settings').upsert({
      client_id: editingClient.id,
      group_name: editingClient.group,
      is_hidden: editingClient.hidden
    }, { onConflict: 'client_id' });

    setEditingClient(null);
    fetchData(); 
    toast.success('Configuración guardada');
  };

  // --- LÓGICA DE DATOS ---
  const reportData = useMemo(() => {
    if (!rawData.length) return [];
    
    // Obtener la fecha más reciente de los datos para filtrar el "Mes Actual"
    const timestamps = rawData.map(d => new Date(d.date).getTime());
    const maxTs = Math.max(...timestamps);
    const latestDateStr = new Date(maxTs).toISOString().split('T')[0];

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const currentDay = new Date().getDate();
    const remainingDays = daysInMonth - currentDay;

    const stats = new Map<string, { 
      name: string, 
      spent: number, 
      budget: number,
      total_conversions_val: number,
      is_group: boolean,
      isHidden: boolean,
      realIds: string[], // IDs de Supabase de los clientes hijos
      realIdsNames: {id: string, name: string}[],
      campaigns: CampaignData[],
      isManualGroupBudget: boolean
    }>();

    rawData.forEach(row => {
      // Filtramos solo los datos del último día sincronizado (estado actual)
      // OJO: Si guardas histórico diario, deberías sumar el coste del mes. 
      // Asumo que tu worker sobreescribe o que filtras por mes. 
      // Si tu worker trae "coste del mes hasta hoy", usamos solo la última fecha.
      if (row.date === latestDateStr) {
        
        const settings = clientSettings[row.client_id] || { budget: 0, group_name: '', is_hidden: false };
        
        // Agrupación
        const groupKey = settings.group_name && settings.group_name.trim() !== '' 
          ? `GROUP-${settings.group_name}` 
          : row.client_id;
        
        const displayName = settings.group_name && settings.group_name.trim() !== '' 
          ? settings.group_name 
          : row.client_name;

        // Presupuesto Manual de Grupo
        const groupSettings = clientSettings[groupKey];
        const manualGroupBudget = (groupKey.startsWith('GROUP-') && groupSettings?.budget > 0) 
            ? groupSettings.budget 
            : 0;

        if (!stats.has(groupKey)) {
          stats.set(groupKey, { 
            name: displayName, 
            spent: 0, 
            budget: manualGroupBudget > 0 ? manualGroupBudget : 0,
            total_conversions_val: 0,
            is_group: groupKey.startsWith('GROUP-'),
            isHidden: settings.is_hidden, 
            realIds: [],
            realIdsNames: [],
            campaigns: [],
            isManualGroupBudget: manualGroupBudget > 0
          });
        }
        
        const entry = stats.get(groupKey)!;
        entry.spent += row.cost;
        entry.total_conversions_val += (row.conversions_value || 0);
        
        // Registrar sub-clientes para poder desvincularlos
        if (!entry.realIds.includes(row.client_id)) {
           entry.realIds.push(row.client_id);
           entry.realIdsNames.push({id: row.client_id, name: row.client_name});
           
           if (!entry.isManualGroupBudget) {
               entry.budget += settings.budget;
           }
           if (!settings.is_hidden) entry.isHidden = false;
        }
        
        if (row.cost > 0) { // Solo añadir campañas con gasto para limpiar visualización
            entry.campaigns.push({
                campaign_id: row.campaign_id,
                campaign_name: row.campaign_name,
                status: row.status,
                cost: row.cost,
                conversions_value: row.conversions_value,
                conversions: row.conversions,
                daily_budget: row.daily_budget,
                original_client_name: row.client_name,
                original_client_id: row.client_id
            });
        }
      }
    });

    const report: ClientPacing[] = [];
    stats.forEach((value, key) => {
      const budget = value.budget;
      const spent = value.spent;
      const avgDailySpend = currentDay > 0 ? spent / currentDay : 0;
      const forecast = avgDailySpend * daysInMonth;
      const progress = budget > 0 ? (spent / budget) * 100 : 0;
      const remainingBudget = Math.max(0, budget - spent);
      const recommendedDaily = remainingDays > 0 ? remainingBudget / remainingDays : 0;
      const globalRoas = spent > 0 ? value.total_conversions_val / spent : 0;

      let status: 'ok' | 'risk' | 'over' | 'under' = 'ok';
      if (budget > 0) {
        if (spent > budget) status = 'over';
        else if (forecast > budget) status = 'risk';
        else if (progress < 50 && currentDay > 20) status = 'under';
      }

      report.push({ 
          client_id: key, 
          client_name: value.name,
          is_group: value.is_group,
          budget, 
          spent, 
          progress, 
          forecast, 
          recommendedDaily,
          avgDailySpend, 
          status, 
          remainingBudget,
          isHidden: value.isHidden,
          groupName: value.is_group ? value.name : undefined,
          isManualGroupBudget: value.isManualGroupBudget,
          realIdsList: value.realIdsNames,
          campaigns: value.campaigns.sort((a,b) => b.cost - a.cost),
          globalRoas
      });
    });

    // Filtros visuales
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
  }, [rawData, clientSettings, searchTerm, showHidden]);

  const totalBudget = reportData.reduce((acc, r) => acc + r.budget, 0);
  const totalSpent = reportData.reduce((acc, r) => acc + r.spent, 0);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6 space-y-6 animate-in fade-in duration-500 pb-20">
        
        {/* CABECERA */}
        <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Control Presupuestario</h1>
                    <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                    <Clock className="w-4 h-4" />
                    <span>Última sinc: {lastSyncTime ? lastSyncTime.toLocaleString() : 'Pendiente...'}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={handleStartSync} disabled={isSyncing} className="bg-slate-900 text-white">
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
           <Card className="bg-slate-900 text-white border-0 shadow-lg">
             <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-400">Inversión Total</CardTitle></CardHeader>
             <CardContent>
               <div className="text-3xl font-bold">{formatCurrency(totalSpent)}</div>
               <Progress value={totalBudget > 0 ? (totalSpent/totalBudget)*100 : 0} className="h-2 mt-3 bg-slate-700 [&>div]:bg-emerald-500" />
               <p className="text-xs text-slate-400 mt-2 text-right">Presupuesto Global: {formatCurrency(totalBudget)}</p>
             </CardContent>
           </Card>
         </div>

         {/* LISTADO */}
         <div className="space-y-4">
            <Accordion type="single" collapsible className="w-full space-y-2">
              {reportData.map((client) => (
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
                                client.status === 'risk' ? 'bg-amber-500' : 'bg-emerald-500'
                            }`} />
                            
                            <div className="text-left">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-lg text-slate-900">
                                        {formatProjectName(client.client_name)}
                                    </span>
                                    {client.is_group && <Badge variant="secondary" className="text-[10px] gap-1"><Layers className="w-3 h-3"/> GRUPO</Badge>}
                                    
                                    {/* ALERTA ROAS BAJO */}
                                    {client.globalRoas < 2 && client.spent > 100 && (
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
                                   <span>•</span>
                                   <span>{client.progress.toFixed(1)}%</span>
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
                                            hidden: clientSettings[client.client_id]?.is_hidden || false
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
                        
                        {/* GESTIÓN DE GRUPOS - SOLO SI ES GRUPO */}
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
                                                    hidden: false
                                                })}
                                                className="text-slate-400 hover:text-red-500 transition-colors ml-1"
                                                title="Desvincular / Editar"
                                            >
                                                <Unlink className="w-3 h-3" />
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
                                    {client.is_group && (
                                        <span className="text-xs font-normal text-slate-400 normal-case">
                                            {client.isManualGroupBudget ? '(Presupuesto Fijo de Grupo)' : '(Suma de cuentas)'}
                                        </span>
                                    )}
                                </h3>
                                
                                <div className="space-y-4 bg-slate-50 p-4 rounded-md border border-slate-100 h-full">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <label className="text-sm font-medium text-slate-600">
                                                Presupuesto {client.is_group ? 'Total' : 'Mensual'}
                                            </label>
                                            {client.isManualGroupBudget && (
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger><Info className="w-3 h-3 text-blue-400" /></TooltipTrigger>
                                                        <TooltipContent><p>Este presupuesto ignora la suma de las cuentas individuales.</p></TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-400">€</span>
                                            <Input 
                                                type="number" 
                                                defaultValue={client.budget > 0 ? client.budget : ''} 
                                                onBlur={(e) => handleSaveBudget(client.client_id, e.target.value)}
                                                className={`h-8 w-24 text-right bg-white ${client.isManualGroupBudget ? 'border-blue-300 ring-1 ring-blue-100' : ''}`}
                                                placeholder={client.is_group ? "Auto (0)" : "0"}
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs text-slate-500">
                                            <span>Consumo ({client.progress.toFixed(1)}%)</span>
                                            <span className={client.remainingBudget < 0 ? 'text-red-500 font-bold' : ''}>
                                                Quedan: {formatCurrency(client.remainingBudget)}
                                            </span>
                                        </div>
                                        <Progress 
                                            value={Math.min(client.progress, 100)} 
                                            className={`h-2 ${client.status === 'over' ? '[&>div]:bg-red-500' : client.status === 'risk' ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'}`} 
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 pt-2">
                                        <div className="bg-white p-3 rounded border border-slate-200">
                                            <div className="text-xs text-slate-500 mb-1">Límite Diario</div>
                                            <div className="text-lg font-bold text-indigo-600">
                                                {formatCurrency(client.recommendedDaily)}
                                            </div>
                                            {/* CONSEJO DE AUMENTO/REDUCCIÓN */}
                                            {client.budget > 0 && (
                                                <div className="mt-2 text-[10px] leading-tight border-t pt-2 border-slate-100">
                                                    {client.recommendedDaily < client.avgDailySpend ? (
                                                        <span className="text-amber-600 flex items-center gap-1">
                                                            <TrendingDown className="w-3 h-3" /> Reducir {formatCurrency(client.avgDailySpend - client.recommendedDaily)}/día
                                                        </span>
                                                    ) : (
                                                        <span className="text-emerald-600 flex items-center gap-1">
                                                            <TrendingUp className="w-3 h-3" /> Aumentar {formatCurrency(client.recommendedDaily - client.avgDailySpend)}/día
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="bg-white p-3 rounded border border-slate-200">
                                            <div className="text-xs text-slate-500 mb-1">Proyección</div>
                                            <div className={`text-lg font-bold ${client.status === 'risk' ? 'text-amber-600' : 'text-slate-700'}`}>
                                                {formatCurrency(client.forecast)}
                                            </div>
                                            <div className="mt-2 text-[10px] text-slate-400 border-t pt-2 border-slate-100">
                                                Ritmo actual: {formatCurrency(client.avgDailySpend)}/día
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* DETALLE DE CAMPAÑAS */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Rendimiento Campañas</h3>
                                <div className="rounded-md border border-slate-200 overflow-hidden max-h-[400px] overflow-y-auto">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 sticky top-0 z-10">
                                            <tr>
                                                <th className="px-3 py-2 w-[30%]">Campaña</th>
                                                <th className="px-2 py-2 text-center">Peso</th>
                                                <th className="px-2 py-2 text-right">Presup.</th>
                                                <th className="px-2 py-2 text-right">Gasto</th>
                                                <th className="px-2 py-2 text-right">Conv.</th>
                                                <th className="px-2 py-2 text-center">ROAS</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {client.campaigns.map((camp, idx) => {
                                                const campRoas = camp.cost > 0 ? (camp.conversions_value || 0) / camp.cost : 0;
                                                const weight = client.spent > 0 ? (camp.cost / client.spent) * 100 : 0;
                                                
                                                return (
                                                    <tr key={`${camp.campaign_id}-${idx}`} className="hover:bg-slate-50/50">
                                                        <td className="px-3 py-2">
                                                            <div className="font-medium text-slate-700 max-w-[140px] truncate" title={camp.campaign_name}>
                                                                {camp.campaign_name}
                                                            </div>
                                                            {client.is_group && (
                                                                <div className="text-[9px] text-slate-400 truncate">{formatProjectName(camp.original_client_name || '')}</div>
                                                            )}
                                                        </td>
                                                        <td className="px-2 py-2 align-middle">
                                                            <div className="w-12 bg-slate-100 h-1.5 rounded-full overflow-hidden mx-auto" title={`${weight.toFixed(0)}% del gasto`}>
                                                                <div className="bg-slate-400 h-full" style={{ width: `${weight}%` }}></div>
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-2 text-right text-slate-500">
                                                            {camp.daily_budget ? formatCurrency(camp.daily_budget).replace('€', '') : '-'}
                                                        </td>
                                                        <td className="px-2 py-2 text-right font-medium text-slate-700">
                                                            {formatCurrency(camp.cost).replace('€', '')}
                                                        </td>
                                                        <td className="px-2 py-2 text-right">
                                                            <div className="flex flex-col items-end">
                                                                <span className="font-bold">{camp.conversions || 0}</span>
                                                                <span className="text-[9px] text-slate-400">{formatCurrency(camp.conversions_value || 0).replace('€','')}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-2 text-center">
                                                            <Badge variant="outline" className={`text-[10px] px-1 py-0 ${getRoasColor(campRoas)}`}>
                                                                {campRoas.toFixed(2)}
                                                            </Badge>
                                                        </td>
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
              ))}
            </Accordion>
         </div>

         {/* DIALOGO DE CONFIG */}
         <Dialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Configurar Cliente</DialogTitle>
                    <DialogDescription>
                        Ajusta las preferencias para {editingClient?.name}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Nombre del Grupo (Holding)</Label>
                        <Input 
                            placeholder="Ej: Bull Hotels" 
                            value={editingClient?.group || ''}
                            onChange={(e) => setEditingClient(prev => prev ? {...prev, group: e.target.value} : null)}
                        />
                        <p className="text-xs text-slate-500">
                            Escribe un nombre para agruparlo. <strong>Borra el nombre para sacarlo del grupo.</strong>
                        </p>
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

        {/* DIALOGO DE SYNC */}
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
            <div className="w-full"><Progress value={syncProgress} className="h-2 bg-slate-800 [&>div]:bg-blue-500" /></div>
            <div className="bg-black/50 rounded-md p-4 font-mono text-xs text-green-400 h-64 flex flex-col shadow-inner border border-slate-800 mt-2">
              <div 
                className="flex-1 overflow-y-auto min-h-0 space-y-1" 
                ref={scrollRef}
              >
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
