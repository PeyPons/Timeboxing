import { useState, useEffect, useMemo, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RefreshCw, Facebook, Search, TrendingUp, BarChart3, Settings, Calculator, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { format, parseISO, getDaysInMonth, getDate } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart, Bar, XAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

export default function MetaAdsPage() {
  const [data, setData] = useState<any[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Configuración Manual
  const [configOpen, setConfigOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [budgetInput, setBudgetInput] = useState('');
  const [isSales, setIsSales] = useState(true);
  
  // Estado Sync
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    try {
      const [campRes, confRes] = await Promise.all([
          supabase.from('meta_ads_campaigns').select('*').order('date', { ascending: false }),
          supabase.from('ad_accounts_config').select('*').eq('platform', 'meta')
      ]);
      setData(campRes.data || []);
      setConfigs(confRes.data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleStartSync = async () => {
    setIsSyncing(true);
    setSyncLogs(['🚀 Iniciando...']);
    const { data: job } = await supabase.from('meta_sync_logs').insert({ status: 'pending', logs: ['Esperando worker...'] }).select().single();
    
    const channel = supabase.channel(`meta-sync-${job.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'meta_sync_logs', filter: `id=eq.${job.id}` }, 
      (p) => {
          if (p.new.logs) setSyncLogs(p.new.logs);
          if (p.new.status === 'completed') {
            toast.success('Finalizado');
            fetchData();
            setTimeout(() => { supabase.removeChannel(channel); setIsSyncing(false); }, 2000);
          }
      }).subscribe();
  };

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [syncLogs]);

  // Guardar Configuración
  const openConfig = (client: any) => {
      const conf = configs.find(c => c.account_id === client.id) || {};
      setSelectedClient(client);
      setBudgetInput(conf.budget || '0');
      setIsSales(conf.is_sales_objective !== false);
      setConfigOpen(true);
  };

  const saveConfig = async () => {
      await supabase.from('ad_accounts_config').upsert({
          platform: 'meta',
          account_id: selectedClient.id,
          budget: parseFloat(budgetInput),
          is_sales_objective: isSales,
          account_name: selectedClient.name
      }, { onConflict: 'platform, account_id' });
      
      toast.success("Guardado");
      setConfigOpen(false);
      fetchData();
  };

  // Procesar Datos
  const reportData = useMemo(() => {
    if (!data.length) return [];
    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const daysInMonth = getDaysInMonth(now);
    const currentDay = getDate(now);
    const clientsMap = new Map();

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
      // Historial simple
      const exists = client.history.find((h:any) => h.date === row.date);
      if(exists) { exists.spend += Number(row.cost); exists.revenue += Number(row.conversions_value); }
      else client.history.push({ date: row.date, shortDate: format(parseISO(row.date), 'MMM'), spend: Number(row.cost), revenue: Number(row.conversions_value) });
    });

    return Array.from(clientsMap.values())
        .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
        .map(c => {
            const conf = configs.find(cfg => cfg.account_id === c.id) || { budget: 0, is_sales_objective: true };
            const daily = c.currentMonth.spend / (currentDay || 1);
            const projected = daily * daysInMonth;
            const progress = conf.budget > 0 ? (c.currentMonth.spend / conf.budget) * 100 : 0;
            const roas = c.currentMonth.spend > 0 ? c.currentMonth.revenue / c.currentMonth.spend : 0;
            
            return { ...c, conf, stats: { daily, projected, progress, roas, isOver: projected > conf.budget && conf.budget > 0 } };
        });
  }, [data, configs, searchTerm]);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6 space-y-6 pb-20">
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-[#1877F2] rounded-xl text-white"><Facebook /></div>
                <h1 className="text-2xl font-bold">Meta Ads Manager</h1>
            </div>
            <Button onClick={handleStartSync} disabled={isSyncing} className="bg-[#1877F2]">
                <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} /> Sincronizar
            </Button>
        </div>

        {/* Buscador */}
        <div className="relative"><Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" /><Input className="pl-9 bg-white" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>

        <Accordion type="single" collapsible className="space-y-4">
            {reportData.map(client => (
                <AccordionItem key={client.id} value={client.id} className="bg-white border rounded-xl px-4">
                    <AccordionTrigger className="hover:no-underline py-5">
                        <div className="flex justify-between w-full pr-4 items-center">
                            <div className="flex items-center gap-4">
                                <div className={`w-2 h-10 rounded-full ${client.stats.roas >= 2 ? 'bg-blue-500' : 'bg-amber-500'}`}></div>
                                <div className="text-left">
                                    <div className="font-bold text-lg">{client.name}</div>
                                    <div className="text-xs text-gray-500">{client.id} {client.stats.isOver && <span className="text-red-500 font-bold ml-2">⚠️ Excede PPT</span>}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-6 text-right">
                                <div><div className="text-xs text-gray-400 font-bold">GASTO</div><div className="font-mono font-bold">{formatCurrency(client.currentMonth.spend)}</div></div>
                                {client.conf.budget > 0 && (
                                    <div className="w-32 hidden md:block">
                                        <div className="flex justify-between text-[10px] text-gray-500"><span>{client.stats.progress.toFixed(0)}%</span><span>{formatCurrency(client.conf.budget)}</span></div>
                                        <Progress value={client.stats.progress} className={`h-2 ${client.stats.isOver ? '[&>div]:bg-red-500' : '[&>div]:bg-blue-500'}`} />
                                    </div>
                                )}
                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openConfig(client); }}><Settings className="w-4 h-4" /></Button>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="border-t pt-6">
                        <div className="grid lg:grid-cols-3 gap-8">
                            <div className="col-span-1 space-y-4">
                                <div className="bg-slate-50 p-4 rounded-lg border">
                                    <h4 className="text-xs font-bold text-gray-500 mb-3 flex gap-2"><Calculator className="w-4"/> Previsión</h4>
                                    <div className="flex justify-between text-sm"><span>Proyección Fin Mes</span><span className="font-bold">{formatCurrency(client.stats.projected)}</span></div>
                                    <div className="flex justify-between text-sm mt-2"><span>{client.conf.is_sales_objective ? 'ROAS' : 'CPA'}</span><Badge variant="outline">{client.stats.roas.toFixed(2)}x</Badge></div>
                                </div>
                                <div className="h-32"><ResponsiveContainer><BarChart data={client.history}><Bar dataKey="spend" fill="#cbd5e1"/><Bar dataKey="revenue" fill="#3b82f6"/></BarChart></ResponsiveContainer></div>
                            </div>
                            <div className="lg:col-span-2">
                                <table className="w-full text-sm"><thead className="bg-slate-50 text-xs uppercase"><tr><th className="p-2 text-left">Campaña</th><th className="p-2 text-right">Gasto</th><th className="p-2 text-right">Res.</th></tr></thead>
                                <tbody>{client.campaigns.map((c:any) => <tr key={c.campaign_id} className="border-t"><td className="p-2 truncate max-w-[200px]">{c.campaign_name}</td><td className="p-2 text-right">{formatCurrency(c.cost)}</td><td className="p-2 text-right font-bold">{Math.round(c.conversions)}</td></tr>)}</tbody></table>
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>

        {/* Modal Config */}
        <Dialog open={configOpen} onOpenChange={setConfigOpen}>
            <DialogContent className="bg-white text-black"><DialogHeader><DialogTitle>Configurar {selectedClient?.name}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                    <div><Label>Presupuesto Mensual</Label><Input type="number" value={budgetInput} onChange={e => setBudgetInput(e.target.value)} /></div>
                    <div className="flex justify-between items-center border p-3 rounded">
                        <Label>Objetivo Ventas (ROAS)</Label><Switch checked={isSales} onCheckedChange={setIsSales} />
                    </div>
                </div>
                <DialogFooter><Button onClick={saveConfig}>Guardar</Button></DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Modal Sync */}
        <Dialog open={isSyncing} onOpenChange={setIsSyncing}><DialogContent className="bg-black text-white border-gray-800"><DialogHeader><DialogTitle>Sincronizando</DialogTitle></DialogHeader><div className="h-64 overflow-y-auto font-mono text-xs text-blue-400" ref={scrollRef}>{syncLogs.map((l, i) => <div key={i}>{l}</div>)}</div></DialogContent></Dialog>
      </div>
    </AppLayout>
  );
}
