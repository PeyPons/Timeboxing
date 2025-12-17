import { useState, useEffect, useMemo, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, AlertTriangle, DollarSign, Calculator, Clock, Terminal, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatProjectName } from '@/lib/utils';
import { toast } from 'sonner';

// ... (Mismas interfaces de antes)
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
  const scrollRef = useRef<HTMLDivElement>(null);

  // ... (Misma función fetchData de antes) ...
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: adsData } = await supabase.from('google_ads_campaigns').select('*');
      const { data: settingsData } = await supabase.from('client_settings').select('*');
      
      const budgetsMap: Record<string, number> = {};
      settingsData?.forEach((s: any) => { budgetsMap[s.client_id] = Number(s.budget_limit) || 0; });

      setRawData(adsData || []);
      setClientBudgets(budgetsMap);

      if (adsData && adsData.length > 0) {
        const dates = adsData.map(d => new Date(d.last_updated).getTime());
        setLastSyncTime(new Date(Math.max(...dates)));
      }
    } catch (error) {
      toast.error('Error cargando datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // --- NUEVA FUNCIÓN DE ACTUALIZAR ---
  const handleStartSync = async () => {
    setIsSyncing(true);
    setSyncStatus('running');
    setSyncLogs(['🚀 Solicitando actualización al servidor...']);

    try {
      // 1. Crear petición en Supabase
      const { data, error } = await supabase
        .from('ad_sync_logs')
        .insert({ status: 'pending', logs: ['Esperando al worker...'] })
        .select()
        .single();

      if (error) throw error;
      const jobId = data.id;

      // 2. Escuchar cambios en tiempo real para este Job
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
              fetchData(); // Recargar datos en la vista
              setTimeout(() => {
                 supabase.removeChannel(channel); 
              }, 1000);
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

  // Auto-scroll del terminal
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [syncLogs]);

  // ... (Mismo handleSaveBudget y reportData) ...
  const handleSaveBudget = async (clientId: string, amount: string) => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return;
    setClientBudgets(prev => ({ ...prev, [clientId]: numAmount }));
    await supabase.from('client_settings').upsert({ client_id: clientId, budget_limit: numAmount }, { onConflict: 'client_id' });
  };

  const reportData = useMemo(() => {
    if (!rawData.length) return [];
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const currentDay = now.getDate();
    const remainingDays = daysInMonth - currentDay;

    const stats = new Map<string, { name: string, spent: number }>();

    rawData.forEach(row => {
      const d = new Date(row.date);
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        if (!stats.has(row.client_id)) {
          stats.set(row.client_id, { name: row.client_name, spent: 0 });
        }
        stats.get(row.client_id)!.spent += row.cost;
      }
    });

    const report: ClientPacing[] = [];
    stats.forEach((value, clientId) => {
      const budget = clientBudgets[clientId] || 0;
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

      report.push({ client_id: clientId, client_name: value.name, budget, spent, progress, forecast, recommendedDaily, status, remainingBudget });
    });
    return report.sort((a, b) => b.spent - a.spent);
  }, [rawData, clientBudgets]);

  const totalBudget = reportData.reduce((acc, r) => acc + r.budget, 0);
  const totalSpent = reportData.reduce((acc, r) => acc + r.spent, 0);

  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* Cabecera */}
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Control Financiero SEM</h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
               <Clock className="w-4 h-4" />
               <span>Datos de Google: {lastSyncTime ? lastSyncTime.toLocaleString() : 'Pendiente'}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleStartSync} className="gap-2 bg-slate-900 hover:bg-slate-800 text-white">
              <RefreshCw className={`w-4 h-4`} />
              Sincronizar con Google
            </Button>
          </div>
        </div>

        {/* ... (El resto de tarjetas y tabla es idéntico a tu versión anterior) ... */}
        {/* Solo he quitado la tabla y tarjetas para ahorrar espacio en la respuesta, 
            pero DEBES MANTENERLAS. Pega aquí el resto del return del código anterior. 
            Si lo necesitas completo dímelo. */}
            
            {/* AQUÍ VA EL RESTO DE TU UI (Tarjetas KPI y Tabla) QUE YA FUNCIONABA BIEN */}
             <div className="grid gap-4 md:grid-cols-3">
               <Card className="bg-slate-900 text-white border-0 shadow-lg">
                 <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-400">Total Invertido (Mes)</CardTitle></CardHeader>
                 <CardContent>
                   <div className="text-3xl font-bold">{formatCurrency(totalSpent)}</div>
                   <Progress value={totalBudget > 0 ? (totalSpent/totalBudget)*100 : 0} className="h-2 mt-3 bg-slate-700 [&>div]:bg-emerald-500" />
                   <p className="text-xs text-slate-400 mt-2 text-right">de {formatCurrency(totalBudget)}</p>
                 </CardContent>
               </Card>
               {/* Puedes añadir más tarjetas aquí */}
             </div>

             <Card className="shadow-sm border-slate-200 overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Presupuesto</TableHead>
                      <TableHead>Progreso</TableHead>
                      <TableHead className="text-right">Gastado</TableHead>
                      <TableHead className="text-right">Proyección</TableHead>
                      <TableHead className="text-right">Rec. Diario</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.map((client) => (
                      <TableRow key={client.client_id}>
                        <TableCell className="font-medium">{formatProjectName(client.client_name)}</TableCell>
                        <TableCell>
                          <div className="relative">
                            <DollarSign className="absolute left-2 top-2.5 h-3.5 w-3.5 text-slate-400" />
                            <Input 
                              type="number" defaultValue={client.budget > 0 ? client.budget : ''} 
                              onBlur={(e) => handleSaveBudget(client.client_id, e.target.value)}
                              className="pl-7 h-9 w-32" placeholder="0.00"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                           <Progress value={Math.min(client.progress, 100)} className={`h-2 ${client.status === 'over' ? '[&>div]:bg-red-500' : '[&>div]:bg-emerald-500'}`} />
                           <span className="text-xs text-slate-500">{client.progress.toFixed(0)}%</span>
                        </TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(client.spent)}</TableCell>
                        <TableCell className="text-right text-slate-500">{formatCurrency(client.forecast)}</TableCell>
                        <TableCell className="text-right text-indigo-600 font-medium">{formatCurrency(client.recommendedDaily)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
             </Card>


        {/* --- MODAL POPUP DE ACTUALIZACIÓN --- */}
        <Dialog open={isSyncing} onOpenChange={(open) => { if(syncStatus !== 'running') setIsSyncing(open); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {syncStatus === 'running' && <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />}
                {syncStatus === 'completed' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                {syncStatus === 'error' && <XCircle className="w-5 h-5 text-red-500" />}
                Sincronizando con Google Ads
              </DialogTitle>
              <DialogDescription>
                Conectando con el servidor para descargar los últimos datos de gasto.
              </DialogDescription>
            </DialogHeader>
            
            <div className="bg-slate-950 rounded-md p-4 font-mono text-xs text-green-400 h-64 flex flex-col shadow-inner">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2 mb-2 text-slate-400">
                <Terminal className="w-3 h-3" />
                <span>Console Output</span>
              </div>
              <ScrollArea className="flex-1" ref={scrollRef}>
                <div className="space-y-1">
                  {syncLogs.map((log, i) => (
                    <div key={i} className="break-words">
                      <span className="text-slate-600 mr-2">[{new Date().toLocaleTimeString()}]</span>
                      {log}
                    </div>
                  ))}
                  {syncStatus === 'running' && (
                    <div className="animate-pulse">_</div>
                  )}
                </div>
              </ScrollArea>
            </div>

            <div className="flex justify-end">
              <Button 
                onClick={() => setIsSyncing(false)} 
                disabled={syncStatus === 'running'}
                variant={syncStatus === 'completed' ? 'default' : 'secondary'}
              >
                {syncStatus === 'running' ? 'Procesando...' : 'Cerrar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </AppLayout>
  );
}
