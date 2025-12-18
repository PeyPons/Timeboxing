import { useState, useEffect, useMemo, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RefreshCw, Facebook, Search, TrendingUp, BarChart3 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart, Bar, XAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

export default function MetaAdsPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estado Sync
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. CARGAR DATOS (Tabla META)
  const fetchData = async () => {
    try {
      const { data: rows, error } = await supabase
        .from('meta_ads_campaigns') // <--- Asegúrate de que lee la tabla META
        .select('*')
        .order('date', { ascending: false });
        
      if (error) console.error("Error cargando datos:", error);
      setData(rows || []);
    } catch (e) { 
        console.error(e); 
    } finally { 
        setLoading(false); 
    }
  };

  useEffect(() => { fetchData(); }, []);

  // 2. SINCRONIZACIÓN (Logs META)
  const handleStartSync = async () => {
    setIsSyncing(true);
    setSyncLogs(['🚀 Conectando con Meta Worker...']);

    try {
      // Crear trabajo en meta_sync_logs
      const { data: job, error } = await supabase
        .from('meta_sync_logs')
        .insert({ status: 'pending', logs: ['Iniciando...'] })
        .select()
        .single();

      if (error) throw error;

      // Escuchar cambios
      const channel = supabase.channel(`meta-sync-${job.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'meta_sync_logs', filter: `id=eq.${job.id}` }, 
        (payload) => {
            const newRow = payload.new;
            if (newRow.logs) setSyncLogs(newRow.logs);
            
            if (newRow.status === 'completed') {
              toast.success('Sincronización Meta finalizada');
              fetchData(); // Recargar datos al terminar
              setTimeout(() => {
                  supabase.removeChannel(channel);
                  setIsSyncing(false);
              }, 2000);
            } else if (newRow.status === 'error') {
              toast.error('Ocurrió un error en la sincronización');
            }
        })
        .subscribe();

    } catch (err: any) {
      setSyncLogs(prev => [...prev, `❌ Error: ${err.message}`]);
    }
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [syncLogs]);

  // 3. PROCESAR DATOS
  const reportData = useMemo(() => {
    if (!data.length) return [];
    
    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const clientsMap = new Map();

    data.forEach(row => {
      // Agrupar por ID de cliente
      if (!clientsMap.has(row.client_id)) {
          clientsMap.set(row.client_id, {
              id: row.client_id,
              name: row.client_name || row.client_id, // Usa el nombre si existe
              currentMonth: { spend: 0, conversions: 0, revenue: 0 },
              campaigns: [],
              history: []
          });
      }
      
      const client = clientsMap.get(row.client_id);

      // Métricas del mes actual
      if (row.date === currentMonthPrefix) {
          client.currentMonth.spend += Number(row.cost);
          client.currentMonth.conversions += Number(row.conversions);
          client.currentMonth.revenue += Number(row.conversions_value);
          client.campaigns.push(row);
      }

      // Histórico para la gráfica
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
            history: c.history.sort((a: any, b: any) => a.date.localeCompare(b.date))
        }));
  }, [data, searchTerm]);

  const totalSpent = reportData.reduce((acc, r) => acc + r.currentMonth.spend, 0);
  const totalRevenue = reportData.reduce((acc, r) => acc + r.currentMonth.revenue, 0);
  const totalRoas = totalSpent > 0 ? totalRevenue / totalSpent : 0;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6 space-y-6 pb-20">
        
        {/* HEADER META (AZUL FACEBOOK) */}
        <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-[#1877F2] rounded-xl shadow-lg shadow-blue-900/10">
                    <Facebook className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Meta Ads Manager</h1>
                    <p className="text-sm text-slate-500">Facebook & Instagram Ads</p>
                </div>
            </div>
            <Button 
                onClick={handleStartSync} 
                disabled={isSyncing} 
                className={`${isSyncing ? 'bg-slate-100 text-slate-400' : 'bg-[#1877F2] hover:bg-blue-700'} text-white border-0`}
            >
                <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Sincronizando...' : 'Sincronizar Datos'}
            </Button>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-white border-slate-200 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold text-slate-400 uppercase">Inversión (Mes)</CardTitle></CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalSpent)}</div>
                    <Progress value={100} className="h-1.5 mt-3 bg-slate-100 [&>div]:bg-[#1877F2]" />
                </CardContent>
            </Card>
            <Card className="bg-white border-slate-200 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold text-slate-400 uppercase">ROAS Global</CardTitle></CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-blue-600">{totalRoas.toFixed(2)}x</div>
                    <Progress value={(totalRoas / 5) * 100} className="h-1.5 mt-3 bg-slate-100 [&>div]:bg-blue-500" />
                </CardContent>
            </Card>
            <Card className="bg-white border-slate-200 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold text-slate-400 uppercase">Ingresos</CardTitle></CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalRevenue)}</div>
                    <div className="text-xs text-emerald-600 mt-3 flex items-center font-medium"><TrendingUp className="w-3 h-3 mr-1" /> Conversiones</div>
                </CardContent>
            </Card>
        </div>

        {/* LISTA DE CUENTAS */}
        <div className="space-y-4">
            <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                 <Input 
                    placeholder="Buscar cuenta..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 bg-white border-slate-200 max-w-md"
                 />
            </div>

            {loading && <div className="text-center py-10 text-slate-400">Cargando datos...</div>}
            
            {!loading && reportData.length === 0 && (
                <div className="text-center py-10 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-slate-500 mb-2">No hay datos de campañas.</p>
                    <p className="text-xs text-slate-400">Asegúrate de añadir una cuenta en "Ajustes" y pulsar Sincronizar.</p>
                </div>
            )}

            <Accordion type="single" collapsible className="w-full space-y-4">
                {reportData.map((client) => {
                    const clientRoas = client.currentMonth.spend > 0 ? client.currentMonth.revenue / client.currentMonth.spend : 0;
                    
                    return (
                    <AccordionItem key={client.id} value={client.id} className="bg-white border border-slate-200 rounded-xl px-4 shadow-sm">
                        <AccordionTrigger className="hover:no-underline py-5">
                            <div className="flex flex-col md:flex-row md:items-center justify-between w-full pr-4 gap-4">
                                <div className="flex items-center gap-4">
                                    {/* Indicador de ROAS */}
                                    <div className={`w-2 h-10 rounded-full ${clientRoas >= 2 ? 'bg-blue-500' : 'bg-amber-500'}`}></div>
                                    <div>
                                        <div className="font-bold text-lg text-slate-900">{client.name}</div>
                                        <div className="text-xs text-slate-500">ID: {client.id}</div>
                                    </div>
                                </div>
                                <div className="text-right hidden md:block">
                                    <div className="text-xs text-slate-400 uppercase font-semibold">Gasto</div>
                                    <div className="font-mono font-bold text-slate-700">{formatCurrency(client.currentMonth.spend)}</div>
                                </div>
                            </div>
                        </AccordionTrigger>
                        
                        <AccordionContent className="border-t border-slate-100 mt-2 pt-6">
                            <div className="grid lg:grid-cols-3 gap-8">
                                {/* GRÁFICA */}
                                <div className="col-span-1 bg-slate-50 rounded-lg p-4 border border-slate-100">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 flex items-center gap-2">
                                        <BarChart3 className="w-4 h-4" /> Tendencia
                                    </h4>
                                    <div className="h-48 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={client.history}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                <XAxis dataKey="shortDate" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                                                <RechartsTooltip />
                                                <Bar dataKey="spend" name="Inversión" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                                                <Bar dataKey="revenue" name="Retorno" fill="#1877F2" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* TABLA CAMPAÑAS */}
                                <div className="lg:col-span-2">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4" /> Campañas Activas
                                    </h4>
                                    <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-50 font-medium text-slate-500 text-xs uppercase">
                                                <tr>
                                                    <th className="px-4 py-3">Nombre</th>
                                                    <th className="px-4 py-3 text-right">Inversión</th>
                                                    <th className="px-4 py-3 text-right">ROAS</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {client.campaigns.map((camp: any) => {
                                                    const roas = camp.cost > 0 ? camp.conversions_value / camp.cost : 0;
                                                    return (
                                                        <tr key={camp.campaign_id}>
                                                            <td className="px-4 py-3 font-medium text-slate-700 truncate max-w-[200px]">{camp.campaign_name}</td>
                                                            <td className="px-4 py-3 text-right font-mono">{formatCurrency(camp.cost)}</td>
                                                            <td className="px-4 py-3 text-right">
                                                                <Badge variant="outline" className={roas >= 2 ? 'text-blue-600 bg-blue-50 border-blue-200' : ''}>
                                                                    {roas.toFixed(2)}x
                                                                </Badge>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {client.campaigns.length === 0 && (
                                                    <tr><td colSpan={3} className="p-4 text-center text-slate-400 text-xs">Sin campañas con gasto este mes</td></tr>
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
        <Dialog open={isSyncing} onOpenChange={setIsSyncing}>
            <DialogContent className="bg-slate-950 border-slate-800 text-white sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                        Sincronización Meta
                    </DialogTitle>
                    <DialogDescription className="text-slate-400">Descargando últimos datos de Facebook Ads...</DialogDescription>
                </DialogHeader>
                <div className="bg-black/50 p-4 rounded-lg font-mono text-xs h-64 overflow-y-auto border border-slate-800 text-blue-400 space-y-1" ref={scrollRef}>
                    {syncLogs.map((log, i) => <div key={i}>{log}</div>)}
                </div>
            </DialogContent>
        </Dialog>

      </div>
    </AppLayout>
  );
}
