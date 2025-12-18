import { useState, useEffect, useMemo, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RefreshCw, Clock, Facebook, Activity, Search, Filter, TrendingUp, BarChart3, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { startOfMonth, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

// Gráficas
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell 
} from 'recharts';

export default function MetaAdsPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estado Sync
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    try {
      const { data: rows } = await supabase.from('meta_ads_campaigns').select('*').order('date', { ascending: false });
      setData(rows || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // --- SYNC HANDLER ---
  const handleStartSync = async () => {
    setIsSyncing(true);
    setSyncStatus('running');
    setSyncLogs(['🚀 Conectando con Meta Worker...']);

    try {
      // Crear trabajo en la DB
      const { data: job, error } = await supabase
        .from('meta_sync_logs')
        .insert({ status: 'pending', logs: ['Esperando worker...'] })
        .select()
        .single();

      if (error) throw error;

      // Escuchar progreso
      const channel = supabase
        .channel(`meta-job-${job.id}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'meta_sync_logs', filter: `id=eq.${job.id}` },
          (payload) => {
            const newRow = payload.new;
            setSyncLogs(newRow.logs || []);
            
            if (newRow.status === 'completed') {
              setSyncStatus('completed');
              toast.success('Sincronización completada');
              fetchData();
              setTimeout(() => supabase.removeChannel(channel), 2000);
            } else if (newRow.status === 'error') {
              setSyncStatus('error');
              toast.error('Error en la sincronización');
            }
          }
        )
        .subscribe();

    } catch (err: any) {
      setSyncStatus('error');
      setSyncLogs(prev => [...prev, `❌ Error: ${err.message}`]);
    }
  };

  // Auto-scroll logs
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [syncLogs]);

  // --- DATOS PROCESADOS (MES ACTUAL) ---
  const reportData = useMemo(() => {
    if (!data.length) return [];
    
    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    
    const clientsMap = new Map();

    data.forEach(row => {
      // Agrupamos por Cliente
      if (!clientsMap.has(row.client_id)) {
          clientsMap.set(row.client_id, {
              id: row.client_id,
              name: row.client_name || row.client_id,
              currentMonth: { spend: 0, conversions: 0, revenue: 0 },
              campaigns: [],
              history: [] // Para gráfica
          });
      }
      
      const client = clientsMap.get(row.client_id);

      // Si es este mes, sumamos a KPI principales
      if (row.date === currentMonthPrefix) {
          client.currentMonth.spend += Number(row.cost);
          client.currentMonth.conversions += Number(row.conversions);
          client.currentMonth.revenue += Number(row.conversions_value);
          client.campaigns.push(row);
      }

      // Histórico (Agrupar por fecha para la gráfica)
      const existingHistory = client.history.find((h: any) => h.date === row.date);
      if (existingHistory) {
          existingHistory.spend += Number(row.cost);
          existingHistory.revenue += Number(row.conversions_value);
      } else {
          client.history.push({
              date: row.date,
              shortDate: format(parseISO(row.date), 'MMM', { locale: es }),
              spend: Number(row.cost),
              revenue: Number(row.conversions_value)
          });
      }
    });

    return Array.from(clientsMap.values())
        .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
        .map(c => ({
            ...c,
            // Ordenar historial cronológicamente
            history: c.history.sort((a: any, b: any) => a.date.localeCompare(b.date))
        }));
  }, [data, searchTerm]);

  const totalSpent = reportData.reduce((acc, r) => acc + r.currentMonth.spend, 0);
  const totalRevenue = reportData.reduce((acc, r) => acc + r.currentMonth.revenue, 0);
  const totalRoas = totalSpent > 0 ? totalRevenue / totalSpent : 0;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6 space-y-6 animate-in fade-in pb-20">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-[#1877F2] rounded-xl shadow-lg shadow-blue-900/10">
                    <Facebook className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Meta Ads Manager</h1>
                    <p className="text-sm text-slate-500">Control financiero y ROAS</p>
                </div>
            </div>
            <div className="flex gap-2">
                <Button 
                    onClick={handleStartSync} 
                    disabled={isSyncing} 
                    className={`${isSyncing ? 'bg-slate-100 text-slate-400' : 'bg-[#1877F2] hover:bg-blue-700'} text-white border-0`}
                >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Sincronizando...' : 'Sincronizar Datos'}
                </Button>
            </div>
        </div>

        {/* BARRAS DE KPI GLOBALES */}
        <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-white border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Inversión (Mes)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalSpent)}</div>
                    <Progress value={100} className="h-1.5 mt-3 bg-slate-100 [&>div]:bg-[#1877F2]" />
                </CardContent>
            </Card>
            <Card className="bg-white border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Retorno (ROAS)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-baseline gap-2">
                        <span className={`text-2xl font-bold ${totalRoas >= 4 ? 'text-emerald-600' : totalRoas >= 2 ? 'text-blue-600' : 'text-amber-600'}`}>
                            {totalRoas.toFixed(2)}x
                        </span>
                        <span className="text-xs text-slate-400">Media Global</span>
                    </div>
                    <Progress value={(totalRoas / 5) * 100} className={`h-1.5 mt-3 bg-slate-100 ${totalRoas >= 4 ? '[&>div]:bg-emerald-500' : '[&>div]:bg-amber-500'}`} />
                </CardContent>
            </Card>
            <Card className="bg-white border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Valor Conversión</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalRevenue)}</div>
                    <div className="text-xs text-emerald-600 mt-3 flex items-center font-medium">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        Ingresos Totales
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* BUSCADOR */}
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
                placeholder="Filtrar por nombre de cuenta..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white border-slate-200 max-w-md"
            />
        </div>

        {/* LISTADO DE CUENTAS */}
        <div className="space-y-4">
            <Accordion type="single" collapsible className="w-full space-y-4">
                {reportData.map((client) => {
                    const clientRoas = client.currentMonth.spend > 0 ? client.currentMonth.revenue / client.currentMonth.spend : 0;
                    
                    return (
                    <AccordionItem key={client.id} value={client.id} className="bg-white border border-slate-200 rounded-xl px-4 shadow-sm overflow-hidden">
                        <AccordionTrigger className="hover:no-underline py-5 group">
                            <div className="flex flex-col md:flex-row md:items-center justify-between w-full pr-4 gap-4">
                                <div className="flex items-center gap-4">
                                    <div className={`w-2 h-10 rounded-full ${clientRoas >= 4 ? 'bg-emerald-500' : clientRoas >= 2 ? 'bg-blue-500' : 'bg-amber-500'}`}></div>
                                    <div className="text-left">
                                        <div className="font-bold text-lg text-slate-900 group-hover:text-[#1877F2] transition-colors">
                                            {client.name}
                                        </div>
                                        <div className="text-xs text-slate-500 flex gap-2 items-center">
                                            <span>ID: {client.id}</span>
                                            {client.currentMonth.spend === 0 && <Badge variant="outline" className="text-[10px] h-5 bg-slate-50">Sin Gasto</Badge>}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6 text-right">
                                    <div className="hidden md:block">
                                        <div className="text-xs text-slate-400 uppercase font-semibold">Gasto</div>
                                        <div className="font-mono font-bold text-slate-700">{formatCurrency(client.currentMonth.spend)}</div>
                                    </div>
                                    <div className="hidden md:block">
                                        <div className="text-xs text-slate-400 uppercase font-semibold">ROAS</div>
                                        <Badge variant="secondary" className={`${clientRoas >= 3 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                                            {clientRoas.toFixed(2)}x
                                        </Badge>
                                    </div>
                                    <div className="hidden md:block">
                                        <div className="text-xs text-slate-400 uppercase font-semibold">Ingresos</div>
                                        <div className="font-mono font-bold text-slate-900">{formatCurrency(client.currentMonth.revenue)}</div>
                                    </div>
                                </div>
                            </div>
                        </AccordionTrigger>
                        
                        <AccordionContent className="border-t border-slate-100 mt-2 pt-6 pb-6">
                            <div className="grid lg:grid-cols-3 gap-8">
                                
                                {/* 1. GRÁFICA DE TENDENCIA (Últimos meses) */}
                                <div className="col-span-1 bg-slate-50 rounded-lg p-4 border border-slate-100">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 flex items-center gap-2">
                                        <BarChart3 className="w-4 h-4" /> Tendencia Trimestral
                                    </h4>
                                    <div className="h-48 w-full">
                                        {client.history.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={client.history}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                    <XAxis dataKey="shortDate" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                                                    <YAxis hide />
                                                    <RechartsTooltip 
                                                        cursor={{fill: 'transparent'}}
                                                        contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                                                    />
                                                    <Bar dataKey="spend" name="Inversión" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={20} />
                                                    <Bar dataKey="revenue" name="Retorno" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="h-full flex items-center justify-center text-xs text-slate-400">Sin datos históricos</div>
                                        )}
                                    </div>
                                </div>

                                {/* 2. TABLA DE CAMPAÑAS */}
                                <div className="lg:col-span-2">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 flex items-center gap-2">
                                        <Activity className="w-4 h-4" /> Campañas Activas
                                    </h4>
                                    <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-50 font-medium text-slate-500 text-xs uppercase">
                                                <tr>
                                                    <th className="px-4 py-3">Nombre</th>
                                                    <th className="px-4 py-3 text-right">Inversión</th>
                                                    <th className="px-4 py-3 text-right">Conv.</th>
                                                    <th className="px-4 py-3 text-right">ROAS</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {client.campaigns.map((camp: any) => {
                                                    const roas = camp.cost > 0 ? camp.conversions_value / camp.cost : 0;
                                                    return (
                                                        <tr key={camp.campaign_id} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="px-4 py-3 font-medium text-slate-700 truncate max-w-[200px]">
                                                                {camp.campaign_name}
                                                            </td>
                                                            <td className="px-4 py-3 text-right text-slate-600 font-mono">
                                                                {formatCurrency(camp.cost)}
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                <div className="font-bold text-slate-900">{Math.round(camp.conversions)}</div>
                                                                <div className="text-[10px] text-slate-400">
                                                                    {camp.conversions > 0 ? `${(camp.cost/camp.conversions).toFixed(2)}€ CPA` : ''}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                <Badge variant="outline" className={`font-mono ${roas >= 2 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-slate-500'}`}>
                                                                    {roas.toFixed(2)}
                                                                </Badge>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {client.campaigns.length === 0 && (
                                                    <tr>
                                                        <td colSpan={4} className="px-4 py-8 text-center text-slate-400 text-xs">
                                                            No hay campañas activas este mes.
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
                    );
                })}
            </Accordion>
        </div>

        {/* MODAL DE SYNC */}
        <Dialog open={isSyncing} onOpenChange={(open) => { if(syncStatus !== 'running') setIsSyncing(open); }}>
            <DialogContent className="bg-slate-950 border-slate-800 text-white sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {syncStatus === 'running' ? <RefreshCw className="animate-spin text-blue-500" /> : <Clock className="text-emerald-500" />}
                        Sincronización Meta
                    </DialogTitle>
                    <DialogDescription className="text-slate-400">
                        {syncStatus === 'running' ? 'Conectando con API de Facebook...' : 'Proceso finalizado.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="bg-black/50 p-4 rounded-lg font-mono text-xs h-64 overflow-y-auto border border-slate-800 text-emerald-400 space-y-1" ref={scrollRef}>
                    {syncLogs.map((log, i) => (
                        <div key={i} className="border-l-2 border-transparent pl-2 hover:border-slate-700 break-words">
                            {log}
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>

      </div>
    </AppLayout>
  );
}
