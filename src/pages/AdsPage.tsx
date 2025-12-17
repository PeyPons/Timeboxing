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
  RefreshCw, Clock, Terminal, CheckCircle2, XCircle, AlertTriangle, 
  Search, Settings, EyeOff, Layers, Filter, Info
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
  original_client_name?: string; 
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
  status: 'ok' | 'risk' | 'over' | 'under';
  remainingBudget: number;
  campaigns: CampaignData[];
  isHidden: boolean;
  groupName?: string;
  isManualGroupBudget?: boolean; // Nuevo: indica si el presupuesto es fijo del grupo
}

const formatProjectName = (name: string) => name.replace(/^(Cliente|Client)\s*[-:]?\s*/i, '');

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

      if (adsData && adsData.length > 0) {
        const dates = adsData.map(d => new Date(d.date).getTime());
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
            
            if (currentLogs.length > 0) {
                const lastLog = currentLogs[currentLogs.length - 1];
                const match = lastLog.match(/\[(\d+)\/(\d+)\]/);
                if (match) {
                    const current = parseInt(match[1]);
                    const total = parseInt(match[2]);
                    setSyncProgress((current / total) * 100);
                    fetchData(); 
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
    
    // Actualizamos estado local inmediatamente para la UI
    setClientSettings(prev => ({
      ...prev,
      [clientId]: { ...prev[clientId], budget: numAmount }
    }));

    // Guardamos en BD. Nota: Si es un grupo, clientId será algo como "GROUP-Bull Hotels"
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

  // --- LÓGICA DE DATOS (AGRUPACIÓN + PRESUPUESTO) ---
  const reportData = useMemo(() => {
    if (!rawData.length) return [];
    
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
      is_group: boolean,
      isHidden: boolean,
      realIds: string[], 
      campaigns: CampaignData[],
      isManualGroupBudget: boolean
    }>();

    rawData.forEach(row => {
      if (row.date === latestDateStr) {
        const isLegacyTotal = row.campaign_id.includes('MONTHLY-TOTAL') || row.campaign_id.includes('TOTAL-MONTH');
        if (isLegacyTotal && row.cost > 0) return; 

        const settings = clientSettings[row.client_id] || { budget: 0, group_name: '', is_hidden: false };
        
        // Determinar ID del Grupo
        const groupKey = settings.group_name && settings.group_name.trim() !== '' 
          ? `GROUP-${settings.group_name}` 
          : row.client_id;
        
        const displayName = settings.group_name && settings.group_name.trim() !== '' 
          ? settings.group_name 
          : row.client_name;

        // Comprobamos si este grupo (o cliente) tiene un presupuesto FIJO asignado
        // (Esto nos permite ponerle 10.000€ al grupo Bull Hotels y que ignore la suma de los hijos)
        const groupSettings = clientSettings[groupKey];
        const manualGroupBudget = (groupKey.startsWith('GROUP-') && groupSettings?.budget > 0) 
            ? groupSettings.budget 
            : 0;

        if (!stats.has(groupKey)) {
          stats.set(groupKey, { 
            name: displayName, 
            spent: 0, 
            // Si hay presupuesto manual de grupo, usamos ese. Si no, empezamos en 0 para sumar.
            budget: manualGroupBudget > 0 ? manualGroupBudget : 0,
            is_group: groupKey.startsWith('GROUP-'),
            isHidden: settings.is_hidden, 
            realIds: [],
            campaigns: [],
            isManualGroupBudget: manualGroupBudget > 0
          });
        }
        
        const entry = stats.get(groupKey)!;
        entry.spent += row.cost;
        
        if (!entry.realIds.includes(row.client_id)) {
           entry.realIds.push(row.client_id);
           
           // SOLO sumamos los presupuestos individuales SI NO hay un presupuesto fijo de grupo
           if (!entry.isManualGroupBudget) {
               entry.budget += settings.budget;
           }
           
           if (!settings.is_hidden) entry.isHidden = false;
        }
        
        if (!isLegacyTotal || row.cost === 0) {
            entry.campaigns.push({
                campaign_id: row.campaign_id,
                campaign_name: row.campaign_name,
                status: row.status,
                cost: row.cost,
                conversions_value: row.conversions_value,
                original_client_name: row.client_name 
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
          status, 
          remainingBudget,
          isHidden: value.isHidden,
          groupName: value.is_group ? value.name : undefined,
          isManualGroupBudget: value.isManualGroupBudget,
          campaigns: value.campaigns.sort((a,b) => b.cost - a.cost)
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
                    <span>Datos al: {lastSyncTime?.toLocaleString() || '...'}</span>
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
                                       toast.info("Para editar el grupo, modifica las cuentas individuales.");
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
                            
                            <div className="space-y-4 bg-slate-50 p-4 rounded-md border border-slate-100">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <label className="text-sm font-medium text-slate-600">
                                            Presupuesto {client.is_group ? 'Total del Grupo' : 'Mensual'}
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
                                        {/* AHORA TODOS SON EDITABLES, INCLUSO GRUPOS */}
                                        <Input 
                                            type="number" 
                                            defaultValue={client.budget > 0 ? client.budget : ''} 
                                            onBlur={(e) => handleSaveBudget(client.client_id, e.target.value)}
                                            className={`h-8 w-24 text-right bg-white ${client.isManualGroupBudget ? 'border-blue-300 ring-1 ring-blue-100' : ''}`}
                                            placeholder={client.is_group ? "Auto (0)" : "0"}
                                        />
                                    </div>
                                </div>
                                {client.is_group && !client.isManualGroupBudget && (
                                    <p className="text-[10px] text-slate-400 text-right -mt-2">
                                        Escribe una cantidad para fijar un límite al grupo. Dejar en 0 para sumar automático.
                                    </p>
                                )}

                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs text-slate-500">
                                        <span>Consumo Actual</span>
                                        <span>{client.progress.toFixed(1)}%</span>
                                    </div>
                                    <Progress 
                                        value={Math.min(client.progress, 100)} 
                                        className={`h-2 ${client.status === 'over' ? '[&>div]:bg-red-500' : client.status === 'risk' ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'}`} 
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div className="bg-white p-3 rounded border border-slate-200">
                                        <div className="text-xs text-slate-500">Proyección Fin de Mes</div>
                                        <div className={`text-lg font-bold ${client.status === 'risk' ? 'text-amber-600' : 'text-slate-700'}`}>
                                            {formatCurrency(client.forecast)}
                                        </div>
                                    </div>
                                    <div className="bg-white p-3 rounded border border-slate-200">
                                        <div className="text-xs text-slate-500">Rec. Gasto Diario</div>
                                        <div className="text-lg font-bold text-indigo-600">
                                            {formatCurrency(client.recommendedDaily)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* DETALLE */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Detalle de Campañas</h3>
                            <div className="rounded-md border border-slate-200 overflow-hidden max-h-[400px] overflow-y-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2">Campaña</th>
                                            <th className="px-4 py-2">Estado</th>
                                            <th className="px-4 py-2 text-right">Gasto</th>
                                            <th className="px-4 py-2 text-right">Conv.</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {client.campaigns.map((camp, idx) => (
                                            <tr key={`${camp.campaign_id}-${idx}`} className="hover:bg-slate-50/50">
                                                <td className="px-4 py-2">
                                                    <div className="font-medium text-slate-700 max-w-[180px] truncate" title={camp.campaign_name}>
                                                        {camp.campaign_name}
                                                    </div>
                                                    {client.is_group && (
                                                        <div className="text-[10px] text-slate-400">{camp.original_client_name}</div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                        camp.status === 'ENABLED' 
                                                            ? 'bg-green-100 text-green-700' 
                                                            : 'bg-gray-100 text-gray-500'
                                                    }`}>
                                                        {camp.status === 'ENABLED' ? 'ON' : 'OFF'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 text-right font-mono text-slate-700">
                                                    {formatCurrency(camp.cost)}
                                                </td>
                                                <td className="px-4 py-2 text-right font-mono text-slate-500">
                                                    {camp.conversions_value ? formatCurrency(camp.conversions_value) : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
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
                            Escribe el mismo nombre en varios clientes para unificarlos en una sola tarjeta.
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
