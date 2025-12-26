import { useState, useRef, useEffect, useMemo } from 'react';
import { useReactToPrint } from 'react-to-print';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Printer, TrendingDown, TrendingUp, Sparkles, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, parseISO, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { generateAdsSummary, generateCampaignAnalysis, HistoricalData, ChangeLog } from '@/utils/aiReportUtils';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

// --- IMPORTAMOS RECHARTS ---
import { 
  ComposedChart, 
  Bar, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';

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
    const [syncing, setSyncing] = useState(false);
    const [reportData, setReportData] = useState<any>(null);
    const [aiSummary, setAiSummary] = useState('');
    const [aiProvider, setAiProvider] = useState<string>('');
    const [campaignAnalyses, setCampaignAnalyses] = useState<Record<string, { text: string; provider: string; modelName: string }>>({});
    const [showCampaignDetails, setShowCampaignDetails] = useState<Record<string, boolean>>({});
    const [historicalMonths, setHistoricalMonths] = useState(3); // Número de meses históricos a mostrar
    
    const printRef = useRef<HTMLDivElement>(null);

    // 1. Cargar lista de clientes
    useEffect(() => {
        const fetchClients = async () => {
            const { data } = await supabase.from('google_ads_campaigns').select('client_id, client_name').limit(100);
            const unique = data ? Array.from(new Set(data.map(a => a.client_id)))
                .map(id => data.find(a => a.client_id === id)) : [];
            setClients(unique);
        };
        fetchClients();
    }, []);

    // 2. Función de sincronización (simulada - aquí iría la lógica real de sincronización)
    const handleSync = async () => {
        if (!selectedClient) {
            toast.error('Selecciona un cliente primero');
            return;
        }
        setSyncing(true);
        toast.info('Sincronizando datos de Google Ads...');
        
        // Simular sincronización (aquí iría la lógica real)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        setSyncing(false);
        toast.success('Datos sincronizados correctamente');
    };

    // 3. Generar Informe
    const handleGenerate = async () => {
        if (!selectedClient) return;
        setLoading(true);
        setReportData(null);
        setAiSummary('');
        setCampaignAnalyses({});
        setShowCampaignDetails({});

        const now = new Date();
        const startCurrent = startOfMonth(now);
        const endCurrent = endOfMonth(now);
        
        // Calcular rangos para meses históricos
        const historicalRanges = Array.from({ length: historicalMonths }, (_, i) => {
            const monthDate = subMonths(now, i);
            return {
                month: format(monthDate, 'yyyy-MM'),
                monthLabel: format(monthDate, 'MMMM yyyy', { locale: es }),
                start: startOfMonth(monthDate),
                end: endOfMonth(monthDate)
            };
        });

        // Fetch Datos del mes actual
        const { data: currentRows } = await supabase.from('google_ads_campaigns')
            .select('*')
            .eq('client_id', selectedClient)
            .gte('date', format(startCurrent, 'yyyy-MM-dd'))
            .lte('date', format(endCurrent, 'yyyy-MM-dd'));
            
        // Fetch Datos históricos
        const historicalDataPromises = historicalRanges.map(range => 
            supabase.from('google_ads_campaigns')
                .select('*')
                .eq('client_id', selectedClient)
                .gte('date', format(range.start, 'yyyy-MM-dd'))
                .lte('date', format(range.end, 'yyyy-MM-dd'))
        );
        
        const historicalResults = await Promise.all(historicalDataPromises);
        
        // Fetch Logs de cambios del mes actual
        const { data: changeLogs } = await supabase.from('google_ads_changes')
            .select('*')
            .eq('client_id', selectedClient)
            .gte('change_date', startCurrent.toISOString())
            .lte('change_date', endCurrent.toISOString())
            .order('change_date', { ascending: false })
            .limit(50);

        // Agregación Simple
        const aggregate = (rows: any[]) => {
            const cost = rows.reduce((acc, r) => acc + Number(r.cost || 0), 0);
            const conv = rows.reduce((acc, r) => acc + Number(r.conversions || 0), 0);
            const val = rows.reduce((acc, r) => acc + Number(r.conversions_value || 0), 0);
            return {
                cost,
                conversions: conv,
                value: val,
                cpa: conv > 0 ? cost / conv : 0,
                roas: cost > 0 ? val / cost : 0
            };
        };

        const currStats = aggregate(currentRows || []);
        
        // Procesar datos históricos
        const historicalStats: HistoricalData[] = historicalRanges.map((range, idx) => {
            const rows = historicalResults[idx]?.data || [];
            const stats = aggregate(rows);
            return {
                month: range.monthLabel,
                cost: stats.cost,
                conversions: stats.conversions,
                conversions_value: stats.value,
                cpa: stats.cpa,
                roas: stats.roas
            };
        }).reverse(); // Ordenar de más antiguo a más reciente

        const prevStats = historicalStats.length > 1 ? {
            cost: historicalStats[historicalStats.length - 2].cost,
            conversions: historicalStats[historicalStats.length - 2].conversions,
            value: historicalStats[historicalStats.length - 2].conversions_value,
            cpa: historicalStats[historicalStats.length - 2].cpa,
            roas: historicalStats[historicalStats.length - 2].roas
        } : { cost: 0, conversions: 0, value: 0, cpa: 0, roas: 0 };

        // --- Agregación Diaria para la Gráfica ---
        const dailyMap = new Map();
        currentRows?.forEach(row => {
            const date = row.date;
            if (!dailyMap.has(date)) {
                dailyMap.set(date, { date, cost: 0, conversions: 0, value: 0 });
            }
            const entry = dailyMap.get(date);
            entry.cost += Number(row.cost || 0);
            entry.conversions += Number(row.conversions || 0);
            entry.value += Number(row.conversions_value || 0);
        });
        
        const dailyChartData = Array.from(dailyMap.values())
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(d => ({
                ...d,
                shortDate: format(parseISO(d.date), 'dd MMM', { locale: es }),
                cost: Math.round(d.cost),
                value: Math.round(d.value)
            }));
            
        const hasRevenue = currStats.value > 0;

        // Top Campaigns con más detalles
        const campaigns = currentRows?.reduce((acc: any[], row) => {
            const existing = acc.find(c => c.id === row.campaign_id);
            if (existing) {
                existing.cost += Number(row.cost);
                existing.conversions += Number(row.conversions || 0);
                existing.impressions += Number(row.impressions || 0);
                existing.clicks += Number(row.clicks || 0);
                existing.value += Number(row.conversions_value || 0);
            } else {
                acc.push({ 
                    id: row.campaign_id, 
                    campaign_name: row.campaign_name,
                    status: row.status,
                    cost: Number(row.cost), 
                    conversions: Number(row.conversions || 0),
                    impressions: Number(row.impressions || 0),
                    clicks: Number(row.clicks || 0),
                    value: Number(row.conversions_value || 0)
                });
            }
            return acc;
        }, []).map(c => ({
            ...c,
            cpa: c.conversions > 0 ? c.cost / c.conversions : 0,
            roas: c.cost > 0 ? c.value / c.cost : 0,
            ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0
        })).sort((a,b) => b.cost - a.cost).slice(0, 10);

        setReportData({ 
            currStats, 
            prevStats, 
            campaigns, 
            dailyChartData, 
            hasRevenue,
            historicalStats,
            changeLogs: changeLogs || []
        });

        // Generar resumen ejecutivo con IA
        try {
            const summaryResult = await generateAdsSummary(
                clients.find(c => c.client_id === selectedClient)?.client_name || '',
                campaigns,
                currStats.cost,
                currStats.conversions,
                historicalStats,
                changeLogs as ChangeLog[]
            );
            setAiSummary(summaryResult.text);
            setAiProvider(`${summaryResult.provider} (${summaryResult.modelName})`);
        } catch (error) {
            console.error('Error generando resumen:', error);
            setAiSummary('Error al generar el análisis. Por favor, intenta de nuevo.');
        }
        
        setLoading(false);
    };

    // Generar análisis por campaña individual
    const handleGenerateCampaignAnalysis = async (campaignId: string, campaign: any) => {
        if (campaignAnalyses[campaignId]) {
            setShowCampaignDetails(prev => ({ ...prev, [campaignId]: !prev[campaignId] }));
            return;
        }

        setLoading(true);
        try {
            // Obtener datos históricos de esta campaña específica
            const now = new Date();
            const historicalRanges = Array.from({ length: 3 }, (_, i) => {
                const monthDate = subMonths(now, i);
                return {
                    start: startOfMonth(monthDate),
                    end: endOfMonth(monthDate)
                };
            });

            const historicalPromises = historicalRanges.map(range =>
                supabase.from('google_ads_campaigns')
                    .select('*')
                    .eq('client_id', selectedClient)
                    .eq('campaign_id', campaignId)
                    .gte('date', format(range.start, 'yyyy-MM-dd'))
                    .lte('date', format(range.end, 'yyyy-MM-dd'))
            );

            const historicalResults = await Promise.all(historicalPromises);
            const campaignHistorical: HistoricalData[] = historicalRanges.map((range, idx) => {
                const rows = historicalResults[idx]?.data || [];
                const cost = rows.reduce((acc, r) => acc + Number(r.cost || 0), 0);
                const conv = rows.reduce((acc, r) => acc + Number(r.conversions || 0), 0);
                return {
                    month: format(range.start, 'MMMM yyyy', { locale: es }),
                    cost,
                    conversions: conv,
                    conversions_value: rows.reduce((acc, r) => acc + Number(r.conversions_value || 0), 0),
                    cpa: conv > 0 ? cost / conv : 0,
                    roas: cost > 0 ? (rows.reduce((acc, r) => acc + Number(r.conversions_value || 0), 0) / cost) : 0
                };
            }).reverse();

            const analysisResult = await generateCampaignAnalysis(campaign, campaignHistorical);
            setCampaignAnalyses(prev => ({ ...prev, [campaignId]: analysisResult }));
            setShowCampaignDetails(prev => ({ ...prev, [campaignId]: true }));
        } catch (error) {
            console.error('Error generando análisis de campaña:', error);
            toast.error('Error al generar el análisis de la campaña');
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Reporte_Ads_${format(new Date(), 'MMM_yyyy')}`,
    });

    // Datos para gráfico histórico
    const historicalChartData = useMemo(() => {
        if (!reportData?.historicalStats) return [];
        return reportData.historicalStats.map((h: HistoricalData) => ({
            month: h.month,
            cost: Math.round(h.cost),
            conversions: Math.round(h.conversions),
            cpa: Math.round(h.cpa * 100) / 100,
            roas: Math.round(h.roas * 100) / 100
        }));
    }, [reportData?.historicalStats]);

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            {/* CONTROLES */}
            <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex-wrap">
                <Select onValueChange={setSelectedClient} value={selectedClient}>
                    <SelectTrigger className="w-[300px]">
                        <SelectValue placeholder="Selecciona un cliente..." />
                    </SelectTrigger>
                    <SelectContent>
                        {clients.map(c => <SelectItem key={c.client_id} value={c.client_id}>{c.client_name}</SelectItem>)}
                    </SelectContent>
                </Select>
                
                <Select value={historicalMonths.toString()} onValueChange={(v) => setHistoricalMonths(parseInt(v))}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="1">1 mes</SelectItem>
                        <SelectItem value="3">3 meses</SelectItem>
                        <SelectItem value="6">6 meses</SelectItem>
                        <SelectItem value="12">12 meses</SelectItem>
                    </SelectContent>
                </Select>

                <Button 
                    onClick={handleSync} 
                    disabled={!selectedClient || syncing || loading}
                    variant="outline"
                >
                    {syncing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    {syncing ? 'Sincronizando...' : 'Sincronizar datos'}
                </Button>

                <Button onClick={handleGenerate} disabled={!selectedClient || loading} className="bg-indigo-600">
                    {loading ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    {loading ? 'Generando informe...' : 'Generar Informe con IA'}
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
                                {aiProvider && (
                                    <p className="text-xs text-slate-400 mt-1">Generado con {aiProvider}</p>
                                )}
                            </div>
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
                                reverseColor={true} 
                            />
                            <StatCard 
                                label="ROAS (Retorno)" 
                                value={reportData.currStats.roas} 
                                prevValue={reportData.prevStats.roas} 
                                formatFn={(v:number) => `${v.toFixed(2)}x`}
                            />
                        </div>

                        {/* GRÁFICA HISTÓRICA (si hay datos) */}
                        {historicalChartData.length > 1 && (
                            <div className="bg-white p-4 rounded-lg border border-slate-200">
                                <h3 className="text-sm font-bold text-slate-600 mb-4 uppercase tracking-wider">
                                    Evolución Histórica ({historicalMonths} meses)
                                </h3>
                                <div className="h-64 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={historicalChartData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis 
                                                dataKey="month" 
                                                tick={{fontSize: 10}} 
                                                tickLine={false} 
                                                axisLine={false}
                                            />
                                            <YAxis 
                                                yAxisId="left"
                                                orientation="left"
                                                tick={{fontSize: 10}} 
                                                tickLine={false} 
                                                axisLine={false}
                                                tickFormatter={(value) => `${value}€`}
                                            />
                                            <YAxis 
                                                yAxisId="right" 
                                                orientation="right" 
                                                tick={{fontSize: 10}} 
                                                tickLine={false} 
                                                axisLine={false}
                                            />
                                            <Tooltip 
                                                contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                                            />
                                            <Legend wrapperStyle={{fontSize: '12px', paddingTop: '10px'}}/>
                                            <Area 
                                                yAxisId="left" 
                                                type="monotone" 
                                                dataKey="cost" 
                                                name="Inversión" 
                                                fill="#6366f1" 
                                                fillOpacity={0.3}
                                                stroke="#6366f1" 
                                                strokeWidth={2}
                                            />
                                            <Line 
                                                yAxisId="right" 
                                                type="monotone" 
                                                dataKey="conversions" 
                                                name="Conversiones" 
                                                stroke="#f59e0b" 
                                                strokeWidth={2} 
                                                dot={{r: 4, fill: '#f59e0b'}} 
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                        {/* GRÁFICA DE EVOLUCIÓN DIARIA */}
                        {reportData.dailyChartData.length > 0 && (
                            <div className="bg-white p-4 rounded-lg border border-slate-200">
                                <h3 className="text-sm font-bold text-slate-600 mb-4 uppercase tracking-wider">Evolución Diaria (Coste vs Conversiones)</h3>
                                <div className="h-64 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={reportData.dailyChartData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis 
                                                dataKey="shortDate" 
                                                tick={{fontSize: 10}} 
                                                tickLine={false} 
                                                axisLine={false}
                                            />
                                            <YAxis 
                                                yAxisId="left"
                                                orientation="left"
                                                tick={{fontSize: 10}} 
                                                tickLine={false} 
                                                axisLine={false}
                                                tickFormatter={(value) => `${value}€`}
                                            />
                                            <YAxis 
                                                yAxisId="right" 
                                                orientation="right" 
                                                tick={{fontSize: 10}} 
                                                tickLine={false} 
                                                axisLine={false}
                                            />
                                            <Tooltip 
                                                contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                                                formatter={(value:number, name:string) => [
                                                    name === 'cost' ? `${value}€` : name === 'value' ? `${value}€` : value, 
                                                    name === 'cost' ? 'Inversión' : name === 'value' ? 'Ingresos' : 'Conversiones'
                                                ]}
                                            />
                                            <Legend wrapperStyle={{fontSize: '12px', paddingTop: '10px'}}/>
                                            <Bar yAxisId="left" dataKey="cost" name="Inversión" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20} />
                                            {reportData.hasRevenue && (
                                                <Bar yAxisId="left" dataKey="value" name="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                                            )}
                                            <Line 
                                                yAxisId="right" 
                                                type="monotone" 
                                                dataKey="conversions" 
                                                name="Conversiones" 
                                                stroke="#f59e0b" 
                                                strokeWidth={3} 
                                                dot={{r: 3, fill: '#f59e0b'}} 
                                            />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                        {/* RESUMEN EJECUTIVO (IA) */}
                        <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100">
                            <h3 className="flex items-center gap-2 text-indigo-900 font-bold mb-3">
                                <Sparkles className="w-4 h-4" /> Análisis del Mes
                            </h3>
                            <div className="text-indigo-900 text-sm leading-relaxed whitespace-pre-line">
                                {aiSummary || 'Generando análisis inteligente...'}
                            </div>
                        </div>

                        {/* LOGS DE CAMBIOS (si existen) */}
                        {reportData.changeLogs && reportData.changeLogs.length > 0 && (
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 mb-4 border-l-4 border-slate-500 pl-3">
                                    Acciones Realizadas ({reportData.changeLogs.length})
                                </h3>
                                <div className="rounded-lg border border-slate-200 overflow-hidden">
                                    <div className="max-h-48 overflow-y-auto">
                                        {reportData.changeLogs.slice(0, 10).map((log: ChangeLog, idx: number) => (
                                            <div key={idx} className="px-4 py-2 border-b border-slate-100 last:border-b-0 text-sm">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium text-slate-700">
                                                        {format(parseISO(log.change_date), 'dd/MM/yyyy HH:mm')}
                                                    </span>
                                                    <Badge variant="outline" className="text-xs">
                                                        {log.change_type}
                                                    </Badge>
                                                </div>
                                                <p className="text-slate-600 mt-1">
                                                    {log.campaign_name || log.resource_name}
                                                    {log.details && <span className="text-slate-400"> • {log.details}</span>}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* DESGLOSE CAMPAÑAS */}
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-4 border-l-4 border-indigo-500 pl-3">
                                Campañas Activas ({reportData.campaigns?.length || 0})
                            </h3>
                            <div className="rounded-lg border border-slate-200 overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-3">Campaña</th>
                                            <th className="px-4 py-3 text-right">Inversión</th>
                                            <th className="px-4 py-3 text-right">Conv.</th>
                                            <th className="px-4 py-3 text-right">CPA</th>
                                            <th className="px-4 py-3 text-right">ROAS</th>
                                            <th className="px-4 py-3 text-center">Análisis</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {reportData.campaigns?.map((camp: any) => (
                                            <tr key={camp.id}>
                                                <td className="px-4 py-3 font-medium text-slate-700 truncate max-w-[200px]">
                                                    {camp.campaign_name}
                                                    <Badge variant={camp.status === 'ENABLED' ? 'default' : 'secondary'} className="ml-2 text-xs">
                                                        {camp.status}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(camp.cost)}</td>
                                                <td className="px-4 py-3 text-right font-bold">{Math.round(camp.conversions)}</td>
                                                <td className="px-4 py-3 text-right text-slate-500">
                                                    {camp.cpa > 0 ? `${camp.cpa.toFixed(2)}€` : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-500">
                                                    {camp.roas > 0 ? `${camp.roas.toFixed(2)}x` : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleGenerateCampaignAnalysis(camp.id, camp)}
                                                        disabled={loading}
                                                        className="text-xs"
                                                    >
                                                        {showCampaignDetails[camp.id] ? 'Ocultar' : 'Ver análisis'}
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            
                            {/* Análisis detallado por campaña */}
                            {Object.entries(campaignAnalyses).map(([campaignId, analysis]) => {
                                if (!showCampaignDetails[campaignId]) return null;
                                const campaign = reportData.campaigns.find((c: any) => c.id === campaignId);
                                return (
                                    <div key={campaignId} className="mt-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                                        <h4 className="font-semibold text-slate-900 mb-2">{campaign?.campaign_name}</h4>
                                        <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                                            {analysis.text}
                                        </div>
                                    </div>
                                );
                            })}
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
