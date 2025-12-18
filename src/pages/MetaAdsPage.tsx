import { useState, useEffect, useMemo, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RefreshCw, TrendingUp, BarChart3, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart, Bar, XAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

// Componente Logo Google
const GoogleIcon = () => (
    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.2,4.73C15.29,4.73 17.1,6.7 17.1,6.7L19,4.72C19,4.72 16.56,2 12.1,2C6.42,2 2.03,6.8 2.03,12C2.03,17.05 6.16,22 12.25,22C17.6,22 21.5,18.33 21.5,12.91C21.5,11.76 21.35,11.1 21.35,11.1V11.1Z" />
    </svg>
);

export default function AdsPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
      // ... (Lógica de fetch data igual)
      try {
        const { data: rows } = await supabase.from('ads_campaigns').select('*').order('date', { ascending: false });
        setData(rows || []);
      } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  // --- SYNC GOOGLE CORREGIDO ---
  const handleStartSync = async () => {
    setIsSyncing(true);
    setSyncLogs(['🚀 Conectando con Google Worker...']);

    try {
      // Crear trabajo en ads_sync_logs (Esta es la tabla que acabamos de crear en SQL)
      const { data: job, error } = await supabase.from('ads_sync_logs').insert({ status: 'pending', logs: ['Iniciando...'] }).select().single();
      if (error) throw error;

      const channel = supabase.channel(`google-sync-${job.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ads_sync_logs', filter: `id=eq.${job.id}` }, 
        (payload) => {
            const newRow = payload.new;
            if (newRow.logs) setSyncLogs(newRow.logs);
            if (newRow.status === 'completed') {
                toast.success('Sincronización Google finalizada');
                fetchData();
                setTimeout(() => { supabase.removeChannel(channel); setIsSyncing(false); }, 2000);
            } else if (newRow.status === 'error') {
                toast.error('Error en sync Google');
            }
        }).subscribe();
    } catch (err: any) {
        setSyncLogs(p => [...p, `Error: ${err.message}`]);
    }
  };

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [syncLogs]);

  // Procesamiento de datos (reutilizado)
  const reportData = useMemo(() => {
    // ... (Lógica de procesar datos igual que antes, si no la tienes dime y la pongo entera)
    if (!data.length) return [];
    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const clientsMap = new Map();
    // ... (Procesamiento idéntico al de Meta pero con campos de Google)
    data.forEach(row => {
        if (!clientsMap.has(row.client_id)) {
            clientsMap.set(row.client_id, {
                id: row.client_id,
                name: row.client_name || row.client_id,
                currentMonth: { spend: 0, conversions: 0, revenue: 0 },
                campaigns: [],
                history: []
            });
        }
        const client = clientsMap.get(row.client_id);
        if (row.date === currentMonthPrefix) {
            client.currentMonth.spend += Number(row.cost);
            client.currentMonth.conversions += Number(row.conversions);
            client.currentMonth.revenue += Number(row.conversions_value);
            client.campaigns.push(row);
        }
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
        .map(c => ({ ...c, history: c.history.sort((a: any, b: any) => a.date.localeCompare(b.date)) }));
  }, [data, searchTerm]);

  const totalSpent = reportData.reduce((acc, r) => acc + r.currentMonth.spend, 0);
  const totalRevenue = reportData.reduce((acc, r) => acc + r.currentMonth.revenue, 0);
  const totalRoas = totalSpent > 0 ? totalRevenue / totalSpent : 0;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6 space-y-6 pb-20">
        <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-[#4285F4] rounded-xl shadow-lg shadow-blue-600/10">
                    <GoogleIcon />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Google Ads Manager</h1>
                    <p className="text-sm text-slate-500">Inversión y Ventas</p>
                </div>
            </div>
            <Button onClick={handleStartSync} disabled={isSyncing} className="bg-[#4285F4] hover:bg-blue-600 text-white">
                <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} /> Sincronizar
            </Button>
        </div>

        {/* KPIs Google */}
        <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-white border-slate-200 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-xs font-semibold text-slate-400 uppercase">Gasto Mensual</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-slate-900">{formatCurrency(totalSpent)}</div><Progress value={100} className="h-1.5 mt-3 bg-slate-100 [&>div]:bg-[#4285F4]" /></CardContent></Card>
            <Card className="bg-white border-slate-200 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-xs font-semibold text-slate-400 uppercase">ROAS</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-emerald-600">{totalRoas.toFixed(2)}x</div><Progress value={(totalRoas/7)*100} className="h-1.5 mt-3 bg-slate-100 [&>div]:bg-emerald-500" /></CardContent></Card>
            <Card className="bg-white border-slate-200 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-xs font-semibold text-slate-400 uppercase">Ingresos</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-slate-900">{formatCurrency(totalRevenue)}</div><div className="text-xs text-emerald-600 mt-3 flex items-center"><TrendingUp className="w-3 h-3 mr-1" /> Ventas Totales</div></CardContent></Card>
        </div>

        {/* Buscador y Lista Google */}
        <div className="space-y-4">
             <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input placeholder="Buscar cuenta Google..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 bg-white max-w-md" /></div>
             
             <Accordion type="single" collapsible className="w-full space-y-4">
                {reportData.map((client) => {
                    const roas = client.currentMonth.spend > 0 ? client.currentMonth.revenue / client.currentMonth.spend : 0;
                    return (
                        <AccordionItem key={client.id} value={client.id} className="bg-white border border-slate-200 rounded-xl px-4 shadow-sm">
                            <AccordionTrigger className="hover:no-underline py-5">
                                <div className="flex flex-col md:flex-row md:items-center justify-between w-full pr-4 gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-2 h-10 rounded-full ${roas >= 3 ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                                        <div><div className="font-bold text-lg text-slate-900">{client.name}</div><div className="text-xs text-slate-500">ID: {client.id}</div></div>
                                    </div>
                                    <div className="text-right hidden md:block"><div className="text-xs text-slate-400 uppercase font-semibold">Gasto</div><div className="font-mono font-bold text-slate-700">{formatCurrency(client.currentMonth.spend)}</div></div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="border-t border-slate-100 mt-2 pt-6">
                                {/* ... (Misma estructura de gráficas y tablas que MetaAdsPage) ... */}
                                <div className="grid lg:grid-cols-3 gap-8">
                                    <div className="col-span-1 bg-slate-50 rounded-lg p-4 border border-slate-100">
                                        <div className="h-48 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={client.history}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="shortDate" tick={{fontSize: 10}} axisLine={false} tickLine={false} /><RechartsTooltip /><Bar dataKey="spend" fill="#94a3b8" radius={[4, 4, 0, 0]} /><Bar dataKey="revenue" fill="#34A853" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
                                    </div>
                                    <div className="lg:col-span-2">
                                         <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
                                            <table className="w-full text-sm text-left"><thead className="bg-slate-50 font-medium text-slate-500 text-xs uppercase"><tr><th className="px-4 py-3">Campaña</th><th className="px-4 py-3 text-right">Inversión</th><th className="px-4 py-3 text-right">ROAS</th></tr></thead><tbody className="divide-y divide-slate-100">
                                                {client.campaigns.map((camp: any) => (
                                                    <tr key={camp.campaign_id}><td className="px-4 py-3 font-medium text-slate-700">{camp.campaign_name}</td><td className="px-4 py-3 text-right font-mono">{formatCurrency(camp.cost)}</td><td className="px-4 py-3 text-right"><Badge variant="outline">{(camp.cost>0?camp.conversions_value/camp.cost:0).toFixed(2)}x</Badge></td></tr>
                                                ))}
                                            </tbody></table>
                                         </div>
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    );
                })}
             </Accordion>
        </div>

        {/* Modal Sync */}
        <Dialog open={isSyncing} onOpenChange={setIsSyncing}><DialogContent className="bg-slate-950 border-slate-800 text-white"><DialogHeader><DialogTitle>Sincronización Google</DialogTitle><DialogDescription>Procesando cuentas...</DialogDescription></DialogHeader><div className="bg-black/50 p-4 rounded h-64 overflow-y-auto font-mono text-xs text-green-400" ref={scrollRef}>{syncLogs.map((log, i) => <div key={i}>{log}</div>)}</div></DialogContent></Dialog>
      </div>
    </AppLayout>
  );
}
