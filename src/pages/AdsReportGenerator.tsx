import { useState, useRef, useEffect, useMemo } from 'react';
import { useReactToPrint } from 'react-to-print';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Loader2, Printer, TrendingDown, TrendingUp, Sparkles, RefreshCw, CheckCircle2, XCircle, Clock, Zap } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';
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

// Formatters para los gráficos
const formatEuro = (value: number) => `${value.toLocaleString('es-ES')}€`;
const formatNumber = (value: number) => value.toLocaleString('es-ES');

// Tooltip personalizado para los gráficos
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
                <p className="font-semibold text-slate-900 mb-2">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <p key={index} className="text-sm" style={{ color: entry.color }}>
                        {entry.name}: {entry.name.includes('Inversión') || entry.name.includes('Ingresos') 
                            ? formatEuro(entry.value) 
                            : entry.name.includes('CPA') 
                                ? `${entry.value.toFixed(2)}€`
                                : entry.name.includes('ROAS')
                                    ? `${entry.value.toFixed(2)}x`
                                    : formatNumber(entry.value)}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

// Componente para el modal de sincronización
const SyncModal = ({ 
    isOpen, 
    onClose, 
    logs, 
    status, 
    platform 
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    logs: string[]; 
    status: string;
    platform: 'google' | 'meta';
}) => {
    const statusConfig = {
        pending: { icon: <Clock className="w-5 h-5 text-amber-500 animate-pulse" />, label: 'Esperando...', color: 'text-amber-600' },
        running: { icon: <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />, label: 'Sincronizando...', color: 'text-blue-600' },
        completed: { icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />, label: 'Completado', color: 'text-emerald-600' },
        error: { icon: <XCircle className="w-5 h-5 text-red-500" />, label: 'Error', color: 'text-red-600' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {config.icon}
                        <span>Sincronización {platform === 'google' ? 'Google Ads' : 'Meta Ads'}</span>
                        <Badge variant={status === 'completed' ? 'default' : status === 'error' ? 'destructive' : 'secondary'}>
                            {config.label}
                        </Badge>
                    </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                    {status === 'running' && (
                        <Progress value={undefined} className="h-2" />
                    )}
                    
                    <ScrollArea className="h-[300px] w-full rounded-md border bg-slate-50 p-4">
                        <div className="space-y-1 font-mono text-sm">
                            {logs.length === 0 ? (
                                <p className="text-slate-400">Esperando logs...</p>
                            ) : (
                                logs.map((log, idx) => (
                                    <p key={idx} className={`${log.includes('❌') || log.includes('Error') ? 'text-red-600' : log.includes('✅') || log.includes('🎉') ? 'text-emerald-600' : 'text-slate-600'}`}>
                                        {log}
                                    </p>
                                ))
                            )}
                        </div>
                    </ScrollArea>
                    
                    <div className="flex justify-end">
                        <Button variant="outline" onClick={onClose} disabled={status === 'running'}>
                            {status === 'running' ? 'Sincronizando...' : 'Cerrar'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default function AdsReportGenerator() {
    const [clients, setClients] = useState<any[]>([]);
    const [selectedClient, setSelectedClient] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState<any>(null);
    const [aiSummary, setAiSummary] = useState('');
    const [aiProvider, setAiProvider] = useState<string>('');
    const [campaignAnalyses, setCampaignAnalyses] = useState<Record<string, { text: string; provider: string; modelName: string }>>({});
    const [showCampaignDetails, setShowCampaignDetails] = useState<Record<string, boolean>>({});
    const [historicalMonths, setHistoricalMonths] = useState(3);
    
    // Estados para sincronización
    const [syncModalOpen, setSyncModalOpen] = useState(false);
    const [syncLogs, setSyncLogs] = useState<string[]>([]);
    const [syncStatus, setSyncStatus] = useState<string>('pending');
    const [syncJobId, setSyncJobId] = useState<string | null>(null);
    
    // Estado para el mensaje de IA
    const [aiGenerating, setAiGenerating] = useState(false);
    
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
    
    // 2. Suscribirse a cambios del job de sincronización
    useEffect(() => {
        if (!syncJobId) return;
        
        const channel = supabase
            .channel(`sync-job-${syncJobId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'ads_sync_logs',
                filter: `id=eq.${syncJobId}`
            }, (payload) => {
                const newData = payload.new as any;
                setSyncLogs(newData.logs || []);
                setSyncStatus(newData.status);
                
                if (newData.status === 'completed' || newData.status === 'error') {
                    // Recargar clientes después de sincronización
                    setTimeout(() => {
                        const fetchClients = async () => {
                            const { data } = await supabase.from('google_ads_campaigns').select('client_id, client_name').limit(100);
                            const unique = data ? Array.from(new Set(data.map(a => a.client_id)))
                                .map(id => data.find(a => a.client_id === id)) : [];
                            setClients(unique);
                        };
                        fetchClients();
                    }, 1000);
                }
            })
            .subscribe();
            
        return () => {
            supabase.removeChannel(channel);
        };
    }, [syncJobId]);

    // 3. Función de sincronización real
    const handleSync = async () => {
        if (!selectedClient) {
            toast.error('Selecciona un cliente primero');
            return;
        }
        
        // Crear job de sincronización
        const { data: job, error } = await supabase
            .from('ads_sync_logs')
            .insert({ status: 'pending', logs: ['⏳ Sincronización programada...'] })
            .select()
            .single();
            
        if (error) {
            toast.error('Error al iniciar sincronización');
            return;
        }
        
        setSyncJobId(job.id);
        setSyncLogs(['⏳ Sincronización programada...']);
        setSyncStatus('pending');
        setSyncModalOpen(true);
        
        toast.info('Sincronización iniciada. El worker procesará la solicitud.');
    };

    // 4. Generar Informe
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
                monthLabel: format(monthDate, 'MMM yyyy', { locale: es }),
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
        
        // Fetch Logs de cambios del mes actual - con nombres de campaña
        const { data: changeLogs } = await supabase.from('google_ads_changes')
            .select('*')
            .eq('client_id', selectedClient)
            .gte('change_date', startCurrent.toISOString())
            .lte('change_date', endCurrent.toISOString())
            .order('change_date', { ascending: false })
            .limit(50);

        // Crear mapa de campaign_id a campaign_name
        const campaignNames = new Map<string, string>();
        currentRows?.forEach(row => {
            if (row.campaign_id && row.campaign_name) {
                campaignNames.set(row.campaign_id, row.campaign_name);
            }
        });

        // Enriquecer los logs con nombres de campaña
        const enrichedChangeLogs = (changeLogs || []).map(log => {
            // Extraer campaign_id del resource_name (ej: customers/7104854670/campaigns/23201331022)
            const campaignMatch = log.resource_name?.match(/campaigns\/(\d+)/);
            const campaignId = campaignMatch ? campaignMatch[1] : null;
            const campaignName = campaignId ? campaignNames.get(campaignId) : null;
            
            return {
                ...log,
                campaign_name: log.campaign_name || campaignName || (campaignId ? `Campaña ${campaignId}` : 'Desconocido'),
                campaign_id: campaignId
            };
        });

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
        }).reverse();

        const prevStats = historicalStats.length > 1 ? {
            cost: historicalStats[historicalStats.length - 2].cost,
            conversions: historicalStats[historicalStats.length - 2].conversions,
            value: historicalStats[historicalStats.length - 2].conversions_value,
            cpa: historicalStats[historicalStats.length - 2].cpa,
            roas: historicalStats[historicalStats.length - 2].roas
        } : { cost: 0, conversions: 0, value: 0, cpa: 0, roas: 0 };

        // NOTA: Los datos del worker están agregados por mes (día 01)
        // Si quieres datos diarios, hay que modificar el worker
        // Por ahora, mostramos la evolución mensual que es lo que tenemos
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
            hasRevenue,
            historicalStats,
            changeLogs: enrichedChangeLogs
        });
        
        setLoading(false);

        // Generar resumen ejecutivo con IA (en paralelo)
        setAiGenerating(true);
        try {
            const summaryResult = await generateAdsSummary(
                clients.find(c => c.client_id === selectedClient)?.client_name || '',
                campaigns,
                currStats.cost,
                currStats.conversions,
                historicalStats,
                enrichedChangeLogs as ChangeLog[]
            );
            setAiSummary(summaryResult.text);
            setAiProvider(`${summaryResult.provider} (${summaryResult.modelName})`);
        } catch (error) {
            console.error('Error generando resumen:', error);
            setAiSummary('Error al generar el análisis. Por favor, intenta de nuevo.');
        } finally {
            setAiGenerating(false);
        }
    };

    // Generar análisis por campaña individual
    const handleGenerateCampaignAnalysis = async (campaignId: string, campaign: any) => {
        if (campaignAnalyses[campaignId]) {
            setShowCampaignDetails(prev => ({ ...prev, [campaignId]: !prev[campaignId] }));
            return;
        }

        setLoading(true);
        try {
            const analysisResult = await generateCampaignAnalysis(campaign, []);
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
            Inversión: Math.round(h.cost),
            Conversiones: Math.round(h.conversions),
            CPA: Math.round(h.cpa * 100) / 100,
            ROAS: Math.round(h.roas * 100) / 100
        }));
    }, [reportData?.historicalStats]);

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            {/* Modal de Sincronización */}
            <SyncModal 
                isOpen={syncModalOpen}
                onClose={() => setSyncModalOpen(false)}
                logs={syncLogs}
                status={syncStatus}
                platform="google"
            />
            
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
                    disabled={!selectedClient || syncStatus === 'running'}
                    variant="outline"
                >
                    {syncStatus === 'running' ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    {syncStatus === 'running' ? 'Sincronizando...' : 'Sincronizar datos'}
                </Button>

                <Button onClick={handleGenerate} disabled={!selectedClient || loading} className="bg-indigo-600">
                    {loading ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    {loading ? 'Cargando datos...' : 'Generar Informe con IA'}
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
                                    <p className="text-xs text-slate-400 mt-1">IA: {aiProvider}</p>
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
                                    Evolución Mensual ({historicalMonths} meses)
                                </h3>
                                <div className="h-64 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={historicalChartData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis 
                                                dataKey="month" 
                                                tick={{fontSize: 11}} 
                                                tickLine={false} 
                                                axisLine={false}
                                            />
                                            <YAxis 
                                                yAxisId="left"
                                                orientation="left"
                                                tick={{fontSize: 10}} 
                                                tickLine={false} 
                                                axisLine={false}
                                                tickFormatter={formatEuro}
                                            />
                                            <YAxis 
                                                yAxisId="right" 
                                                orientation="right" 
                                                tick={{fontSize: 10}} 
                                                tickLine={false} 
                                                axisLine={false}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend wrapperStyle={{fontSize: '12px', paddingTop: '10px'}}/>
                                            <Bar 
                                                yAxisId="left" 
                                                dataKey="Inversión" 
                                                fill="#6366f1" 
                                                radius={[4, 4, 0, 0]}
                                                barSize={30}
                                            />
                                            <Line 
                                                yAxisId="right" 
                                                type="monotone" 
                                                dataKey="Conversiones" 
                                                stroke="#f59e0b" 
                                                strokeWidth={3} 
                                                dot={{r: 5, fill: '#f59e0b'}} 
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
                            {aiGenerating ? (
                                <div className="flex items-center gap-3 text-indigo-700">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <div>
                                        <p className="font-medium">Generando análisis con IA...</p>
                                        <p className="text-sm text-indigo-600">Esto puede tardar 1-2 minutos dependiendo del proveedor.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-indigo-900 text-sm leading-relaxed whitespace-pre-line">
                                    {aiSummary || 'Haz clic en "Generar Informe con IA" para obtener el análisis.'}
                                </div>
                            )}
                        </div>

                        {/* LOGS DE CAMBIOS (si existen) */}
                        {reportData.changeLogs && reportData.changeLogs.length > 0 && (
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 mb-4 border-l-4 border-slate-500 pl-3">
                                    Acciones Realizadas ({reportData.changeLogs.length})
                                </h3>
                                <div className="rounded-lg border border-slate-200 overflow-hidden">
                                    <div className="max-h-48 overflow-y-auto">
                                        {reportData.changeLogs.slice(0, 15).map((log: any, idx: number) => (
                                            <div key={idx} className="px-4 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xs text-slate-400 font-mono">
                                                            {log.change_date ? format(new Date(log.change_date), 'dd/MM HH:mm') : '-'}
                                                        </span>
                                                        <Badge variant="outline" className="text-xs">
                                                            {log.change_type?.replace(/_/g, ' ') || 'Cambio'}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <p className="text-sm text-slate-700 mt-1 font-medium">
                                                    {log.campaign_name}
                                                </p>
                                                {log.details && log.details !== 'Actualización' && (
                                                    <p className="text-xs text-slate-500 mt-1">{log.details}</p>
                                                )}
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
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {reportData.campaigns?.map((camp: any) => (
                                            <tr key={camp.id} className="hover:bg-slate-50">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-slate-700 truncate max-w-[180px]">
                                                            {camp.campaign_name}
                                                        </span>
                                                        <Badge 
                                                            variant={camp.status === 'ENABLED' ? 'default' : 'secondary'} 
                                                            className="text-xs shrink-0"
                                                        >
                                                            {camp.status === 'ENABLED' ? 'Activa' : camp.status}
                                                        </Badge>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(camp.cost)}</td>
                                                <td className="px-4 py-3 text-right font-bold">{Math.round(camp.conversions)}</td>
                                                <td className="px-4 py-3 text-right text-slate-500">
                                                    {camp.cpa > 0 ? `${camp.cpa.toFixed(2)}€` : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-500">
                                                    {camp.roas > 0 ? `${camp.roas.toFixed(2)}x` : '-'}
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
                            <span>{new Date().toLocaleDateString('es-ES')}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
