import { useState, useEffect, useMemo, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Clock, Terminal, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatProjectName } from '@/lib/utils';
import { toast } from 'sonner';

interface CampaignData {
  campaign_id: string;
  campaign_name: string;
  status: string;
  cost: number;
  conversions_value?: number;
}

interface ClientPacing {
  client_id: string;
  client_name: string;
  budget: number;
  spent: number;
  progress: number;
  forecast: number;
  recommendedDaily: number;
  status: 'ok' | 'risk' | 'over' | 'under';
  remainingBudget: number;
  campaigns: CampaignData[];
}

export default function AdsPage() {
  const [rawData, setRawData] = useState<any[]>([]);
  const [clientBudgets, setClientBudgets] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // ESTADO PARA EL POPUP DE SINCRONIZACIÓN
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  
  // Ref para el scroll automático
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Pedimos todo el historial del mes, pero luego filtraremos por la fecha más reciente
      const { data: adsData } = await supabase.from('google_ads_campaigns').select('*');
      const { data: settingsData } = await supabase.from('client_settings').select('*');
      
      const budgetsMap: Record<string, number> = {};
      settingsData?.forEach((s: any) => { budgetsMap[s.client_id] = Number(s.budget_limit) || 0; });

      setRawData(adsData || []);
      setClientBudgets(budgetsMap);

      if (adsData && adsData.length > 0) {
        // Encontrar la fecha más reciente en los datos
        const timestamps = adsData.map(d => new Date(d.date).getTime());
        const maxTs = Math.max(...timestamps);
        setLastSyncTime(new Date(maxTs));
      }
    } catch (error) {
      toast.error('Error cargando datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleStartSync = async () => {
    setIsSyncing(true);
    setSyncStatus('running');
    setSyncLogs(['🚀 Solicitando actualización al servidor...']);

    try {
      const { data, error } = await supabase
        .from('ad_sync_logs')
        .insert({ status: 'pending', logs: ['Esperando al worker...'] })
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
            setSyncLogs(newRow.logs || []);
            
            if (newRow.status === 'completed') {
              setSyncStatus('completed');
              toast.success('Sincronización finalizada');
              fetchData(); 
              // Desconectar tras un breve delay
              setTimeout(() => { supabase.removeChannel(channel); }, 2000);
            } else if (newRow.status === 'error') {
              setSyncStatus('error');
              toast.error('Error en la sincronización');
            }
          }
        )
        .subscribe();

    } catch (err) {
      console.error(err);
      setSyncStatus('error');
      setSyncLogs(prev => [...prev, '❌ Error al conectar con Supabase.']);
    }
  };

  // --- AUTO-SCROLL FIX ---
  // Cada vez que syncLogs cambia, bajamos el scroll del div
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [syncLogs, isSyncing]);

  const handleSaveBudget = async (clientId: string, amount: string) => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return;
    setClientBudgets(prev => ({ ...prev, [clientId]: numAmount }));
    await supabase.from('client_settings').upsert({ client_id: clientId, budget_limit: numAmount }, { onConflict: 'client_id' });
  };

  const reportData = useMemo(() => {
    if (!rawData.length) return [];
    
    // 1. Identificar la fecha de sincronización más reciente (SNAPSHOT)
    // Esto evita sumar datos de ayer con datos de hoy.
    const timestamps = rawData.map(d => new Date(d.date).getTime());
    const maxTs = Math.max(...timestamps);
    // Convertimos a string YYYY-MM-DD para comparar seguro
    const latestDateStr = new Date(maxTs).toISOString().split('T')[0];

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const currentDay = new Date().getDate();
    const remainingDays = daysInMonth - currentDay;

    const stats = new Map<string, { name: string, spent: number, campaigns: CampaignData[] }>();

    rawData.forEach(row => {
      // IMPORTANTE: Solo procesamos los datos de la ÚLTIMA sincronización
      if (row.date === latestDateStr) {
        if (!stats.has(row.client_id)) {
          stats.set(row.client_id, { name: row.client_name, spent: 0, campaigns: [] });
        }
        const clientStats = stats.get(row.client_id)!;
        clientStats.spent += row.cost;
        clientStats.campaigns.push({
            campaign_id: row.campaign_id,
            campaign_name: row.campaign_name,
            status: row.status,
            cost: row.cost,
            conversions_value: row.conversions_value
        });
      }
    });

    const report: ClientPacing[] = [];
    stats.forEach((value, clientId) => {
      const budget = clientBudgets[clientId] || 0;
      const spent = value.spent;
      const avgDailySpend = currentDay > 0 ? spent / currentDay : 0;
      // Proyección simple lineal
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
          client_id: clientId, 
          client_name: value.name, 
          budget, 
          spent, 
          progress, 
          forecast, 
          recommendedDaily, 
          status, 
          remainingBudget,
          campaigns: value.campaigns.sort((a,b) => b.cost - a.cost) // Ordenar campañas por gasto
      });
    });
    return report.sort((a, b) => b.spent - a.spent); // Ordenar clientes por gasto total
  }, [rawData, clientBudgets]);

  const totalBudget = reportData.reduce((acc, r) => acc + r.budget, 0);
  const totalSpent = reportData.reduce((acc, r) => acc + r.spent, 0);

  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in duration-500 pb-20">
        
        {/* Cabecera */}
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Control Financiero SEM</h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
               <Clock className="w-4 h-4" />
               <span>
                 Datos actualizados a: {lastSyncTime ? lastSyncTime.toLocaleDateString() : 'Pendiente'}
                 {lastSyncTime && ` (${lastSyncTime.toLocaleTimeString()})`}
               </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleStartSync} className="gap-2 bg-slate-900 hover:bg-slate-800 text-white">
              <RefreshCw className={`w-4 h-4`} />
              Sincronizar Datos
            </Button>
          </div>
        </div>

        {/* Tarjetas KPI */}
         <div className="grid gap-4 md:grid-cols-3">
           <Card className="bg-slate-900 text-white border-0 shadow-lg">
             <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-400">Total Invertido (Mes)</CardTitle></CardHeader>
             <CardContent>
               <div className="text-3xl font-bold">{formatCurrency(totalSpent)}</div>
               <Progress value={totalBudget > 0 ? (totalSpent/totalBudget)*100 : 0} className="h-2 mt-3 bg-slate-700 [&>div]:bg-emerald-500" />
               <p className="text-xs text-slate-400 mt-2 text-right">Presupuesto Global: {formatCurrency(totalBudget)}</p>
             </CardContent>
           </Card>
         </div>

         {/* LISTADO DE CLIENTES (ACORDEÓN) */}
         <div className="space-y-4">
            <Accordion type="single" collapsible className="w-full space-y-2">
              {reportData.map((client) => (
                <AccordionItem 
                  key={client.client_id} 
                  value={client.client_id} 
                  className="bg-white border border-slate-200 rounded-lg shadow-sm px-2"
                >
                  <AccordionTrigger className="hover:no-underline py-4 px-2">
                    <div className="flex flex-col md:flex-row md:items-center justify-between w-full pr-4 gap-4">
                        {/* Nombre del Cliente */}
                        <div className="flex items-center gap-3">
                            <div className={`w-2 h-10 rounded-full ${
                                client.status === 'over' ? 'bg-red-500' : 
                                client.status === 'risk' ? 'bg-amber-500' : 'bg-emerald-500'
                            }`} />
                            <div className="text-left">
                                <div className="font-bold text-lg text-slate-900">{formatProjectName(client.client_name)}</div>
                                <div className="text-xs text-slate-500 flex gap-2">
                                   <span>Gastado: {formatCurrency(client.spent)}</span>
                                   <span>•</span>
                                   <span>{client.progress.toFixed(1)}% del Presupuesto</span>
                                </div>
                            </div>
                        </div>

                        {/* Badges de Estado Resumido (Visible colapsado) */}
                        <div className="flex items-center gap-4">
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
                        {/* Panel de Control de Presupuesto */}
                        <div className="space-y-6">
                            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Control Presupuestario</h3>
                            
                            <div className="space-y-4 bg-slate-50 p-4 rounded-md border border-slate-100">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-medium text-slate-600">Presupuesto Mensual</label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-400">€</span>
                                        <Input 
                                            type="number" 
                                            defaultValue={client.budget > 0 ? client.budget : ''} 
                                            onBlur={(e) => handleSaveBudget(client.client_id, e.target.value)}
                                            className="h-8 w-24 text-right bg-white" 
                                            placeholder="0"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs text-slate-500">
                                        <span>Progreso Real</span>
                                        <span>{client.progress.toFixed(1)}%</span>
                                    </div>
                                    <Progress 
                                        value={Math.min(client.progress, 100)} 
                                        className={`h-2 ${client.status === 'over' ? '[&>div]:bg-red-500' : client.status === 'risk' ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'}`} 
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div className="bg-white p-3 rounded border border-slate-200">
                                        <div className="text-xs text-slate-500">Proyección Fin Mes</div>
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

                        {/* Desglose de Campañas */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Desglose por Campaña</h3>
                            <div className="rounded-md border border-slate-200 overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-2">Campaña</th>
                                            <th className="px-4 py-2">Estado</th>
                                            <th className="px-4 py-2 text-right">Gasto</th>
                                            <th className="px-4 py-2 text-right">Valor Conv.</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {client.campaigns.map(camp => (
                                            <tr key={camp.campaign_id} className="hover:bg-slate-50/50">
                                                <td className="px-4 py-2 font-medium text-slate-700 max-w-[200px] truncate" title={camp.campaign_name}>
                                                    {camp.campaign_name}
                                                </td>
                                                <td className="px-4 py-2">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                        camp.status === 'ENABLED' 
                                                            ? 'bg-green-100 text-green-700' 
                                                            : 'bg-gray-100 text-gray-500'
                                                    }`}>
                                                        {camp.status === 'ENABLED' ? 'ACTIVA' : 'PAUSADA'}
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
                                        {client.campaigns.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">
                                                    No hay campañas con gasto registrado este mes.
                                                </td>
                                            </tr>
                                        )}
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

        {/* --- MODAL POPUP DE ACTUALIZACIÓN --- */}
        <Dialog open={isSyncing} onOpenChange={(open) => { if(syncStatus !== 'running') setIsSyncing(open); }}>
          <DialogContent className="sm:max-w-md bg-slate-950 text-slate-100 border-slate-800">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-white">
                {syncStatus === 'running' && <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />}
                {syncStatus === 'completed' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                {syncStatus === 'error' && <XCircle className="w-5 h-5 text-red-500" />}
                Sincronizando Google Ads
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Obteniendo desglose de campañas y costes actualizados.
              </DialogDescription>
            </DialogHeader>
            
            <div className="bg-black/50 rounded-md p-4 font-mono text-xs text-green-400 h-64 flex flex-col shadow-inner border border-slate-800">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2 mb-2 text-slate-500">
                <Terminal className="w-3 h-3" />
                <span>Worker Output Log</span>
              </div>
              
              <div 
                className="flex-1 overflow-y-auto min-h-0 space-y-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent" 
                ref={scrollRef}
              >
                  {syncLogs.map((log, i) => (
                    <div key={i} className="break-words border-l-2 border-transparent hover:border-slate-700 pl-1">
                      <span className="text-slate-600 mr-2 opacity-50">[{new Date().toLocaleTimeString()}]</span>
                      {log}
                    </div>
                  ))}
                  {syncStatus === 'running' && (
                    <div className="animate-pulse text-blue-500">_</div>
                  )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button 
                onClick={() => setIsSyncing(false)} 
                disabled={syncStatus === 'running'}
                variant={syncStatus === 'completed' ? 'default' : 'secondary'}
                className="bg-slate-800 hover:bg-slate-700 text-white border-slate-700"
              >
                {syncStatus === 'running' ? 'Procesando...' : 'Cerrar Consola'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </AppLayout>
  );
}
