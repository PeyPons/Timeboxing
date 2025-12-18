import { useState, useRef, useEffect } from 'react';
import { useReactToPrint } from 'react-to-print';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Printer, TrendingDown, TrendingUp, Sparkles } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { generateAdsSummary } from '@/utils/aiReportUtils'; // La función del Paso 2
import { formatCurrency } from '@/lib/utils';

// --- COMPONENTES VISUALES ---
const StatCard = ({ label, value, prevValue, formatFn = (v:any) => v, reverseColor = false }: any) => {
    const diff = prevValue > 0 ? ((value - prevValue) / prevValue) * 100 : 0;
    const isPositive = reverseColor ? diff < 0 : diff > 0;
    
    return (
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">{label}</p>
            <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">{formatFn(value)}</span>
            </div>
            {prevValue > 0 && (
                <div className={`flex items-center text-xs mt-1 font-medium ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                    {diff > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                    {Math.abs(diff).toFixed(1)}% vs mes ant.
                </div>
            )}
        </div>
    );
};

export default function AdsReportGenerator() {
    const [clients, setClients] = useState<any[]>([]);
    const [selectedClient, setSelectedClient] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState<any>(null);
    const [aiSummary, setAiSummary] = useState('');
    
    const printRef = useRef<HTMLDivElement>(null);

    // 1. Cargar lista de clientes
    useEffect(() => {
        const fetchClients = async () => {
            const { data } = await supabase.from('google_ads_campaigns').select('client_id, client_name').limit(100);
            // Deduplicar clientes
            const unique = data ? Array.from(new Set(data.map(a => a.client_id)))
                .map(id => data.find(a => a.client_id === id)) : [];
            setClients(unique);
        };
        fetchClients();
    }, []);

    // 2. Generar Informe
    const handleGenerate = async () => {
        if (!selectedClient) return;
        setLoading(true);
        setReportData(null);
        setAiSummary('');

        const now = new Date();
        const startCurrent = startOfMonth(now).toISOString();
        const endCurrent = endOfMonth(now).toISOString();
        const startPrev = startOfMonth(subMonths(now, 1)).toISOString();
        const endPrev = endOfMonth(subMonths(now, 1)).toISOString();

        // Fetch Datos (Mes Actual y Anterior)
        const { data: currentRows } = await supabase.from('google_ads_campaigns')
            .select('*').eq('client_id', selectedClient).gte('date', startCurrent).lte('date', endCurrent);
            
        const { data: prevRows } = await supabase.from('google_ads_campaigns')
            .select('*').eq('client_id', selectedClient).gte('date', startPrev).lte('date', endPrev);

        // Agregación Simple
        const aggregate = (rows: any[]) => {
            const cost = rows.reduce((acc, r) => acc + r.cost, 0);
            const conv = rows.reduce((acc, r) => acc + (r.conversions || 0), 0);
            const val = rows.reduce((acc, r) => acc + (r.conversions_value || 0), 0);
            return {
                cost,
                conversions: conv,
                value: val,
                cpa: conv > 0 ? cost / conv : 0,
                roas: cost > 0 ? val / cost : 0
            };
        };

        const currStats = aggregate(currentRows || []);
        const prevStats = aggregate(prevRows || []);

        // Obtener Campaigns (Solo mes actual para tabla)
        const campaigns = currentRows?.reduce((acc: any[], row) => {
            const existing = acc.find(c => c.id === row.campaign_id);
            if (existing) {
                existing.cost += row.cost;
                existing.conversions += (row.conversions || 0);
            } else {
                acc.push({ 
                    id: row.campaign_id, 
                    name: row.campaign_name, 
                    cost: row.cost, 
                    conversions: row.conversions || 0 
                });
            }
            return acc;
        }, []).sort((a,b) => b.cost - a.cost).slice(0, 5); // Top 5

        setReportData({ currStats, prevStats, campaigns });

        // 3. Generar Texto con IA
        const summary = await generateAdsSummary(
            clients.find(c => c.client_id === selectedClient)?.client_name,
            currStats,
            prevStats
        );
        setAiSummary(summary);
        
        setLoading(false);
    };

    // 4. Imprimir
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Reporte_Ads_${format(new Date(), 'MMM_yyyy')}`,
    });

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            {/* CONTROLES */}
            <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <Select onValueChange={setSelectedClient}>
                    <SelectTrigger className="w-[300px]">
                        <SelectValue placeholder="Selecciona un cliente..." />
                    </SelectTrigger>
                    <SelectContent>
                        {clients.map(c => <SelectItem key={c.client_id} value={c.client_id}>{c.client_name}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Button onClick={handleGenerate} disabled={!selectedClient || loading} className="bg-indigo-600">
                    {loading ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    {loading ? 'Analizando datos...' : 'Generar Informe con IA'}
                </Button>
                {reportData && !loading && (
                    <Button variant="outline" onClick={() => handlePrint()}>
                        <Printer className="mr-2 h-4 w-4" /> Imprimir / PDF
                    </Button>
                )}
            </div>

            {/* VISTA PREVIA (HOJA A4) */}
            {reportData && (
                <div className="flex justify-center bg-slate-100 p-8 rounded-xl overflow-auto">
                    <div 
                        ref={printRef} 
                        className="bg-white w-[210mm] min-h-[297mm] p-[15mm] shadow-2xl flex flex-col space-y-8 text-slate-800"
                        style={{ fontFamily: 'Inter, sans-serif' }}
                    >
                        {/* CABECERA */}
                        <div className="flex justify-between items-center border-b pb-6 border-slate-100">
                            <div>
                                <h1 className="text-3xl font-bold text-slate-900">Informe de Rendimiento</h1>
                                <p className="text-slate-500 mt-1">Google Ads • {format(new Date(), 'MMMM yyyy', { locale: es })}</p>
                            </div>
                            <div className="text-right">
                                <div className="bg-slate-900 text-white text-xs font-bold px-3 py-1 rounded mb-1">CONFIDENCIAL</div>
                                <p className="text-sm font-semibold">{clients.find(c => c.client_id === selectedClient)?.client_name}</p>
                            </div>
                        </div>

                        {/* RESUMEN EJECUTIVO (IA) */}
                        <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100">
                            <h3 className="flex items-center gap-2 text-indigo-900 font-bold mb-3">
                                <Sparkles className="w-4 h-4" /> Análisis del Mes
                            </h3>
                            <p className="text-indigo-800 text-sm leading-relaxed italic">
                                "{aiSummary || 'Generando análisis inteligente...'}"
                            </p>
                        </div>

                        {/* KPIS PRINCIPALES */}
                        <div className="grid grid-cols-2 gap-4">
                            <StatCard 
                                label="Inversión Publicitaria" 
                                value={reportData.currStats.cost} 
                                prevValue={reportData.prevStats.cost} 
                                formatFn={formatCurrency}
                            />
                            <StatCard 
                                label="Conversiones (Leads/Ventas)" 
                                value={reportData.currStats.conversions} 
                                prevValue={reportData.prevStats.conversions} 
                                formatFn={(v:number) => Math.round(v)}
                            />
                            <StatCard 
                                label="CPA (Coste por Resultado)" 
                                value={reportData.currStats.cpa} 
                                prevValue={reportData.prevStats.cpa} 
                                formatFn={(v:number) => `${v.toFixed(2)}€`}
                                reverseColor={true} // Rojo si sube
                            />
                            <StatCard 
                                label="ROAS (Retorno)" 
                                value={reportData.currStats.roas} 
                                prevValue={reportData.prevStats.roas} 
                                formatFn={(v:number) => `${v.toFixed(2)}x`}
                            />
                        </div>

                        {/* DESGLOSE CAMPAÑAS */}
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-4 border-l-4 border-indigo-500 pl-3">Top Campañas Activas</h3>
                            <div className="rounded-lg border border-slate-200 overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-3">Campaña</th>
                                            <th className="px-4 py-3 text-right">Inversión</th>
                                            <th className="px-4 py-3 text-right">Conversiones</th>
                                            <th className="px-4 py-3 text-right">CPA</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {reportData.campaigns?.map((camp: any) => (
                                            <tr key={camp.id}>
                                                <td className="px-4 py-3 font-medium text-slate-700 truncate max-w-[200px]">{camp.name}</td>
                                                <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(camp.cost)}</td>
                                                <td className="px-4 py-3 text-right font-bold">{Math.round(camp.conversions)}</td>
                                                <td className="px-4 py-3 text-right text-slate-500">
                                                    {camp.conversions > 0 ? `${(camp.cost/camp.conversions).toFixed(2)}€` : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* FOOTER */}
                        <div className="mt-auto pt-8 border-t border-slate-100 flex justify-between text-xs text-slate-400">
                            <span>Generado automáticamente con Timeboxing AI</span>
                            <span>{new Date().toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
