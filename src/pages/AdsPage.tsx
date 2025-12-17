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

interface AdRecord {
  id: string;
  client_id: string;
  client_name: string;
  cost: number;
  date: string;
}

interface ClientSetting {
  client_id: string;
  budget_limit: number;
}

export default function AdsPage() {
  const [rawData, setRawData] = useState<AdRecord[]>([]);
  const [clientSettings, setClientSettings] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Carga inicial de datos y presupuestos
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Cargar datos de Ads (Histórico)
      const { data: adsData, error: adsError } = await supabase.from('google_ads_campaigns').select('*');
      if (adsError) throw adsError;

      // 2. Cargar presupuestos guardados
      const { data: settingsData, error: settingsError } = await supabase.from('client_settings').select('*');
      if (settingsError) throw settingsError;

      // Convertir settings a un mapa fácil de usar { client_id: 500, ... }
      const settingsMap: Record<string, number> = {};
      settingsData?.forEach((s: ClientSetting) => {
        settingsMap[s.client_id] = s.budget_limit;
      });

      setRawData(adsData || []);
      setClientSettings(settingsMap);
      toast.success('Datos financieros actualizados');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error cargando datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Guardar presupuesto en Supabase cuando cambie el input (onBlur)
  const saveBudget = async (clientId: string, amount: number) => {
    try {
      const { error } = await supabase
        .from('client_settings')
        .upsert({ client_id: clientId, budget_limit: amount });

      if (error) throw error;
      
      setClientSettings(prev => ({ ...prev, [clientId]: amount }));
      toast.success('Presupuesto actualizado');
    } catch (error) {
      toast.error('Error al guardar presupuesto');
    }
  };

  // --- CEREBRO FINANCIERO: Cálculos de Pacing ---
  const financialData = useMemo(() => {
    if (!rawData.length) return [];

    const now = new Date();
    // Fechas clave del mes actual
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();
    const remainingDays = daysInMonth - currentDay + 1; // +1 para incluir hoy si no ha acabado

    // Agrupar gastos de ESTE MES por cliente
    const clientStats = new Map();

    rawData.forEach(row => {
      const rowDate = new Date(row.date);
      // Solo sumamos si el dato es de ESTE mes
      if (rowDate >= startOfMonth && rowDate <= now) {
        if (!clientStats.has(row.client_id)) {
          clientStats.set(row.client_id, {
            client_id: row.client_id,
            client_name: row.client_name,
            spent_mtd: 0, // Month to Date
          });
        }
        clientStats.get(row.client_id).spent_mtd += row.cost;
      }
    });

    // Calcular métricas avanzadas para cada cliente
    const report = Array.from(clientStats.values()).map(client => {
      const budget = clientSettings[client.client_id] || 0;
      const spent = client.spent_mtd;
      
      // % Consumido
      const progress = budget > 0 ? (spent / budget) * 100 : 0;
      
      // Proyección (Forecast): Si sigues así, ¿cuánto gastarás?
      // Fórmula: (Gastado / Días Pasados) * Días Totales del Mes
      const dailyAverage = currentDay > 0 ? spent / currentDay : 0;
      const forecast = dailyAverage * daysInMonth;
      
      // Recomendación Diaria (Run Rate)
      // Fórmula: (Presupuesto - Gastado) / Días Restantes
      const remainingBudget = Math.max(0, budget - spent);
      const recommendedDaily = remainingDays > 0 ? remainingBudget / remainingDays : 0;

      // Estado de Salud (Alertas)
      let status: 'ok' | 'risk' | 'over' | 'under' = 'ok';
      if (budget === 0) status = 'ok'; // Sin presupuesto asignado
      else if (forecast > budget * 1.05) status = 'over'; // Te vas a pasar un 5%
      else if (forecast < budget * 0.9) status = 'under'; // Te vas a quedar corto (menos del 90%)
      else if (progress > 95) status = 'risk'; // Peligro inminente

      return {
        ...client,
        budget,
        spent,
        progress,
        forecast,
        recommendedDaily,
        status,
        remainingBudget
      };
    });

    // Ordenar: Primero los que se están pasando de presupuesto (Alerta Roja)
    return report.sort((a, b) => b.progress - a.progress);

  }, [rawData, clientSettings]);

  // Totales Globales
  const totalBudget = financialData.reduce((acc, c) => acc + c.budget, 0);
  const totalSpent = financialData.reduce((acc, c) => acc + c.spent, 0);
  const totalForecast = financialData.reduce((acc, c) => acc + c.forecast, 0);

  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* Cabecera */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Seguimiento Mensual</h1>
            <p className="text-slate-500 text-sm">Control de inversión y ritmo de gasto (Pacing) para {new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' })}</p>
          </div>
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Recalcular
          </Button>
        </div>

        {/* KPIs Globales */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-white border-slate-200">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Inversión Realizada</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalSpent)}</div>
              <p className="text-xs text-slate-500 mt-1">de {formatCurrency(totalBudget)} presupuestados</p>
              <Progress value={(totalSpent / totalBudget) * 100 || 0} className="h-2 mt-2" />
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-200">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Proyección Fin de Mes</CardTitle></CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${totalForecast > totalBudget ? 'text-red-600' : 'text-emerald-600'}`}>
                {formatCurrency(totalForecast)}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {totalForecast > totalBudget ? '⚠️ Tendencia al sobrecoste' : '✅ Dentro del objetivo'}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-200">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Clientes en Riesgo</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                {financialData.filter(c => c.status === 'over').length}
              </div>
              <p className="text-xs text-slate-500 mt-1">proyectan superar su presupuesto</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabla de Pacing */}
        <Card className="shadow-sm border-slate-200 overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-[200px]">Cliente</TableHead>
                <TableHead className="w-[140px]">Presupuesto</TableHead>
                <TableHead>Estado (Pacing)</TableHead>
                <TableHead className="text-right">Gastado</TableHead>
                <TableHead className="text-right">Proyección</TableHead>
                <TableHead className="text-right text-indigo-600 font-bold bg-indigo-50/50">Rec. Diario</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && financialData.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center">Calculando métricas...</TableCell></TableRow>
              ) : financialData.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center">No hay datos de gasto este mes.</TableCell></TableRow>
              ) : (
                financialData.map((client) => (
                  <TableRow key={client.client_id} className="hover:bg-slate-50/50">
                    
                    {/* Nombre */}
                    <TableCell className="font-medium text-slate-700">
                      {formatProjectName(client.client_name)}
                      {client.status === 'over' && <Badge variant="destructive" className="ml-2 text-[10px]">Over</Badge>}
                      {client.status === 'under' && <Badge variant="secondary" className="ml-2 text-[10px] bg-yellow-100 text-yellow-800 hover:bg-yellow-200">Low</Badge>}
                    </TableCell>

                    {/* Input Presupuesto */}
                    <TableCell>
                      <div className="relative">
                        <DollarSign className="absolute left-2 top-2.5 h-3 w-3 text-slate-400" />
                        <Input 
                          type="number" 
                          defaultValue={client.budget}
                          className="pl-6 h-8 w-28 text-right"
                          placeholder="0.00"
                          onBlur={(e) => saveBudget(client.client_id, parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </TableCell>

                    {/* Barra de Progreso */}
                    <TableCell className="w-[250px]">
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>{client.progress.toFixed(0)}%</span>
                          <span>{formatCurrency(client.remainingBudget)} rest.</span>
                        </div>
                        <Progress 
                          value={Math.min(client.progress, 100)} 
                          className={`h-2 ${
                            client.status === 'over' ? 'bg-red-100 [&>div]:bg-red-500' : 
                            client.status === 'under' ? 'bg-yellow-100 [&>div]:bg-yellow-500' : 
                            'bg-emerald-100 [&>div]:bg-emerald-500'
                          }`} 
                        />
                      </div>
                    </TableCell>

                    {/* Gastado Real */}
                    <TableCell className="text-right font-medium">
                      {formatCurrency(client.spent)}
                    </TableCell>

                    {/* Forecast (Proyección) */}
                    <TableCell className={`text-right font-mono ${client.status === 'over' ? 'text-red-600 font-bold' : 'text-slate-600'}`}>
                      {client.budget > 0 ? formatCurrency(client.forecast) : '-'}
                    </TableCell>

                    {/* Recomendación Diaria */}
                    <TableCell className="text-right font-mono text-indigo-700 bg-indigo-50/30">
                      {client.budget > 0 ? (
                        <div className="flex items-center justify-end gap-1">
                          {formatCurrency(client.recommendedDaily)}
                          <Calculator className="w-3 h-3 opacity-50" />
                        </div>
                      ) : '-'}
                    </TableCell>

                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AppLayout>
  );
}
