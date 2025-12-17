import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { RefreshCw, TrendingUp, AlertTriangle, CheckCircle, DollarSign, Calculator } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatProjectName } from '@/lib/utils';
import { toast } from 'sonner';

// Tipos de datos
interface AdRecord {
  id: string;
  client_id: string;
  client_name: string;
  cost: number;
  date: string;
}

interface ClientPacing {
  client_id: string;
  client_name: string;
  budget: number;       // El tope que tú pones
  spent: number;        // Lo que lleva gastado este mes
  progress: number;     // % consumido
  forecast: number;     // Cuánto gastará si sigue así
  recommendedDaily: number; // Cuánto debería gastar al día para clavar el presupuesto
  status: 'ok' | 'risk' | 'over' | 'under'; // Semáforo
  remainingBudget: number;
}

export default function AdsPage() {
  const [rawData, setRawData] = useState<AdRecord[]>([]);
  const [clientBudgets, setClientBudgets] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // --- 1. CARGA DE DATOS ---
  const fetchData = async () => {
    setLoading(true);
    try {
      // A) Traemos los datos de campañas (Histórico diario)
      // OJO: Asumimos que sync-ads.js ya ha llenado esta tabla con datos de Google
      const { data: adsData, error: adsError } = await supabase
        .from('google_ads_campaigns')
        .select('*');
      
      if (adsError) throw adsError;

      // B) Traemos los presupuestos que TÚ has guardado
      const { data: settingsData, error: settingsError } = await supabase
        .from('client_settings')
        .select('*');

      if (settingsError) throw settingsError;

      // Convertimos los settings a un objeto rápido { '123-456': 500, ... }
      const budgetsMap: Record<string, number> = {};
      settingsData?.forEach((s: any) => {
        budgetsMap[s.client_id] = Number(s.budget_limit) || 0;
      });

      setRawData(adsData || []);
      setClientBudgets(budgetsMap);
      toast.success('Datos financieros actualizados');

    } catch (error) {
      console.error('Error:', error);
      toast.error('Error cargando datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // --- 2. GUARDAR PRESUPUESTO ---
  // Se llama cuando escribes en el input y pulsas fuera (onBlur)
  const handleSaveBudget = async (clientId: string, amount: string) => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return;

    // Actualizamos estado local visualmente rápido
    setClientBudgets(prev => ({ ...prev, [clientId]: numAmount }));

    try {
      // Guardamos en Supabase
      const { error } = await supabase
        .from('client_settings')
        .upsert({ 
          client_id: clientId, 
          budget_limit: numAmount 
        }, { onConflict: 'client_id' });

      if (error) throw error;
      toast.success('Presupuesto guardado');
    } catch (err) {
      console.error(err);
      toast.error('No se pudo guardar el presupuesto');
    }
  };

  // --- 3. CEREBRO MATEMÁTICO (PACING) ---
  const reportData = useMemo(() => {
    if (!rawData.length) return [];

    const now = new Date();
    // Definimos "Este Mes" (Desde el día 1 hasta hoy)
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    
    // Días totales del mes y día actual
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const currentDay = now.getDate(); // Día de hoy (ej: 17)
    const remainingDays = daysInMonth - currentDay; 

    // Agrupar gastos por Cliente
    const stats = new Map<string, { name: string, spent: number }>();

    rawData.forEach(row => {
      const d = new Date(row.date);
      // Solo sumamos si es de ESTE mes y año
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        if (!stats.has(row.client_id)) {
          stats.set(row.client_id, { name: row.client_name, spent: 0 });
        }
        stats.get(row.client_id)!.spent += row.cost;
      }
    });

    // Construir el reporte final
    const report: ClientPacing[] = [];
    
    // Iteramos sobre los clientes encontrados en Google Ads
    stats.forEach((value, clientId) => {
      const budget = clientBudgets[clientId] || 0; // Si no hay, es 0
      const spent = value.spent;

      // Matemáticas de proyección
      const avgDailySpend = currentDay > 0 ? spent / currentDay : 0;
      const forecast = avgDailySpend * daysInMonth;
      
      const progress = budget > 0 ? (spent / budget) * 100 : 0;
      const remainingBudget = Math.max(0, budget - spent);
      
      // Recomendación: (Lo que me queda) / (Días que faltan)
      // Si ya te pasaste o es el último día, es 0.
      const recommendedDaily = remainingDays > 0 ? remainingBudget / remainingDays : 0;

      // Estado de Alerta
      let status: 'ok' | 'risk' | 'over' | 'under' = 'ok';
      
      if (budget === 0) status = 'ok'; // No configurado
      else if (spent > budget) status = 'over'; // Ya te has pasado
      else if (forecast > budget) status = 'risk'; // Vas camino de pasarte
      else if (progress < 50 && currentDay > 20) status = 'under'; // Vas muy lento para fin de mes

      report.push({
        client_id: clientId,
        client_name: value.name,
        budget,
        spent,
        progress,
        forecast,
        recommendedDaily,
        status,
        remainingBudget
      });
    });

    // Ordenar: Primero los que están en riesgo ('risk' u 'over')
    return report.sort((a, b) => {
      if (a.status === 'over') return -1;
      if (b.status === 'over') return 1;
      if (a.status === 'risk') return -1;
      if (b.status === 'risk') return 1;
      return b.spent - a.spent;
    });

  }, [rawData, clientBudgets]);

  // Totales Globales
  const totalBudget = reportData.reduce((acc, r) => acc + r.budget, 0);
  const totalSpent = reportData.reduce((acc, r) => acc + r.spent, 0);

  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Control de Inversión (SEM)</h1>
            <p className="text-slate-500">
              Datos reales de Google Ads vs. Tus Presupuestos Mensuales.
            </p>
          </div>
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Recalcular
          </Button>
        </div>

        {/* Tarjetas KPI */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Total Invertido (Mes)</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalSpent)}</div>
              <Progress value={totalBudget > 0 ? (totalSpent/totalBudget)*100 : 0} className="h-2 mt-2" />
              <p className="text-xs text-slate-500 mt-1">de {formatCurrency(totalBudget)} presupuestados</p>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Clientes en Alerta</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold text-red-600">
                  {reportData.filter(c => c.status === 'over' || c.status === 'risk').length}
                </div>
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <p className="text-xs text-slate-500 mt-1">proyectan superar su límite</p>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-sm">
             <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Día del Mes</CardTitle></CardHeader>
             <CardContent>
               <div className="text-2xl font-bold text-slate-700">{new Date().getDate()} <span className="text-sm font-normal text-slate-400">/ {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()}</span></div>
               <p className="text-xs text-slate-500 mt-1">Faltan {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate()} días para cerrar facturación</p>
             </CardContent>
          </Card>
        </div>

        {/* Tabla Principal */}
        <Card className="shadow-sm border-slate-200 overflow-hidden">
          <div className="p-0">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[220px]">Cliente SEM</TableHead>
                  <TableHead className="w-[150px]">Presupuesto</TableHead>
                  <TableHead className="w-[200px]">Progreso</TableHead>
                  <TableHead className="text-right">Gastado</TableHead>
                  <TableHead className="text-right">Proyección</TableHead>
                  <TableHead className="text-right bg-indigo-50/50 text-indigo-700">Rec. Diario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center">Cargando finanzas...</TableCell></TableRow>
                ) : reportData.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center">No hay gastos este mes en Google Ads.</TableCell></TableRow>
                ) : (
                  reportData.map((client) => (
                    <TableRow key={client.client_id} className="hover:bg-slate-50/50">
                      
                      {/* Cliente + Badge de estado */}
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-700">{formatProjectName(client.client_name)}</span>
                          <span className="text-[10px] text-slate-400 font-mono">ID: {client.client_id}</span>
                        </div>
                      </TableCell>

                      {/* INPUT DE PRESUPUESTO */}
                      <TableCell>
                        <div className="relative">
                          <DollarSign className="absolute left-2 top-2.5 h-3.5 w-3.5 text-slate-400" />
                          <Input 
                            type="number" 
                            placeholder="0.00"
                            defaultValue={client.budget > 0 ? client.budget : ''}
                            onBlur={(e) => handleSaveBudget(client.client_id, e.target.value)}
                            className="pl-7 h-9 font-mono"
                          />
                        </div>
                      </TableCell>

                      {/* Barra de Pacing */}
                      <TableCell>
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs font-medium">
                            <span className={
                              client.status === 'over' ? 'text-red-600' : 
                              client.status === 'risk' ? 'text-amber-600' : 'text-slate-600'
                            }>
                              {client.progress.toFixed(0)}%
                            </span>
                            <span className="text-slate-400">{formatCurrency(client.remainingBudget)} rest.</span>
                          </div>
                          <Progress 
                            value={Math.min(client.progress, 100)} 
                            className={`h-2.5 ${
                              client.status === 'over' ? 'bg-red-100 [&>div]:bg-red-500' :
                              client.status === 'risk' ? 'bg-amber-100 [&>div]:bg-amber-500' :
                              'bg-emerald-100 [&>div]:bg-emerald-500'
                            }`} 
                          />
                        </div>
                      </TableCell>

                      {/* Gastado Real */}
                      <TableCell className="text-right font-medium text-slate-900">
                        {formatCurrency(client.spent)}
                      </TableCell>

                      {/* Proyección (Forecast) */}
                      <TableCell className="text-right">
                        <div className={`font-mono ${client.status === 'risk' || client.status === 'over' ? 'text-red-600 font-bold' : 'text-slate-500'}`}>
                          {client.budget > 0 ? formatCurrency(client.forecast) : '-'}
                        </div>
                      </TableCell>

                      {/* Recomendación Diaria */}
                      <TableCell className="text-right font-mono font-medium text-indigo-700 bg-indigo-50/30">
                         {client.budget > 0 && client.status !== 'over' ? (
                           <div className="flex items-center justify-end gap-1" title="Gasto diario recomendado para no pasarse">
                             {formatCurrency(client.recommendedDaily)}
                             <Calculator className="w-3 h-3 opacity-40" />
                           </div>
                         ) : '-'}
                      </TableCell>

                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
