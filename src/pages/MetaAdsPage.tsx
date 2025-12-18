import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Clock, Facebook, Activity, Search, Filter, EyeOff } from 'lucide-react'; // Icono Facebook
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';

export default function MetaAdsPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchMeta = async () => {
    setLoading(true);
    // Leemos de la nueva tabla META
    const { data: rows } = await supabase.from('meta_ads_campaigns').select('*');
    setData(rows || []);
    setLoading(false);
  };

  useEffect(() => { fetchMeta(); }, []);

  // Lógica de Agregación Mensual (Idéntica a Google Ads)
  const reportData = useMemo(() => {
    if (!data.length) return [];
    
    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    
    const stats = new Map();

    data.forEach(row => {
      // Filtro mes actual
      if (row.date === currentMonthPrefix) {
        if (!stats.has(row.client_id)) {
            stats.set(row.client_id, {
                id: row.client_id,
                name: row.client_name || row.client_id,
                spend: 0,
                conversions: 0,
                revenue: 0,
                campaigns: []
            });
        }
        
        const entry = stats.get(row.client_id);
        entry.spend += Number(row.cost);
        entry.conversions += Number(row.conversions);
        entry.revenue += Number(row.conversions_value);
        
        entry.campaigns.push(row);
      }
    });

    return Array.from(stats.values()).filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  const totalSpent = reportData.reduce((acc, r) => acc + r.spend, 0);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6 space-y-6 animate-in fade-in pb-20">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between gap-4">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-600 rounded-lg shadow-lg shadow-blue-900/20">
                    <Facebook className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Meta Ads (Facebook & Instagram)</h1>
                    <p className="text-sm text-slate-500">Control de inversión mensual</p>
                </div>
            </div>
            <Button onClick={fetchMeta} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Recargar Datos
            </Button>
        </div>

        {/* FILTROS */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                    placeholder="Buscar cuenta o campaña..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                />
            </div>
        </div>

        {/* KPI GLOBAL */}
        <Card className="bg-slate-900 text-white border-0">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-400">Inversión Total (Mes Actual)</CardTitle></CardHeader>
            <CardContent>
                <div className="text-3xl font-bold">{formatCurrency(totalSpent)}</div>
            </CardContent>
        </Card>

        {/* LISTADO DE CUENTAS */}
        <div className="space-y-4">
            <Accordion type="single" collapsible className="w-full space-y-2">
                {reportData.map((client) => (
                    <AccordionItem key={client.id} value={client.id} className="bg-white border border-slate-200 rounded-lg px-2">
                        <AccordionTrigger className="hover:no-underline py-4 px-2">
                            <div className="flex justify-between w-full pr-4 items-center">
                                <div className="flex items-center gap-3">
                                    <div className="w-1 h-8 bg-blue-500 rounded-full"></div>
                                    <div className="text-left">
                                        <div className="font-bold text-slate-900">{client.name}</div>
                                        <div className="text-xs text-slate-500">ID: {client.id}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xl font-bold font-mono">{formatCurrency(client.spend)}</div>
                                    <div className="text-xs text-slate-500">{Math.round(client.conversions)} Conv.</div>
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="border-t border-slate-100 mt-2 pt-4 pb-4">
                            {/* TABLA CAMPAÑAS */}
                            <div className="rounded border border-slate-100 overflow-hidden">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-50 font-medium text-slate-500">
                                        <tr>
                                            <th className="px-3 py-2">Campaña</th>
                                            <th className="px-3 py-2 text-right">Gasto</th>
                                            <th className="px-3 py-2 text-right">Conv.</th>
                                            <th className="px-3 py-2 text-right">ROAS</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {client.campaigns.map((camp: any) => {
                                            const roas = camp.cost > 0 ? camp.conversions_value / camp.cost : 0;
                                            return (
                                                <tr key={camp.campaign_id}>
                                                    <td className="px-3 py-2 font-medium text-slate-700">{camp.campaign_name}</td>
                                                    <td className="px-3 py-2 text-right">{formatCurrency(camp.cost)}</td>
                                                    <td className="px-3 py-2 text-right font-bold">{Math.round(camp.conversions)}</td>
                                                    <td className="px-3 py-2 text-right">
                                                        <Badge variant="outline" className={roas > 2 ? 'text-emerald-600 bg-emerald-50' : 'text-slate-500'}>
                                                            {roas.toFixed(2)}x
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </div>

      </div>
    </AppLayout>
  );
}
