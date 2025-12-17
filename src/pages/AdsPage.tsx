import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { RefreshCw, TrendingUp, AlertTriangle, DollarSign, Calculator, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatProjectName } from '@/lib/utils';
import { toast } from 'sonner';

interface ClientPacing {
  client_id: string;
  client_name: string;
  budget: number;
  spent: number;
  progress: number;
  forecast: number;
  recommendedDaily: number;
  status: 'ok' | 'risk' | 'over' | 'under';
  remainingBudget: number;
}

export default function AdsPage() {
  const [rawData, setRawData] = useState<any[]>([]);
  const [clientBudgets, setClientBudgets] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Datos de Google Ads
      const { data: adsData, error: adsError } = await supabase
        .from('google_ads_campaigns')
        .select('*');
      
      if (adsError) throw adsError;

      // 2. Presupuestos guardados
      const { data: settingsData, error: settingsError } = await supabase
        .from('client_settings')
        .select('*');

      if (settingsError) throw settingsError;

      const budgetsMap: Record<string, number> = {};
      settingsData?.forEach((s: any) => {
        budgetsMap[s.client_id] = Number(s.budget_limit) || 0;
      });

      setRawData(adsData || []);
      setClientBudgets(budgetsMap);

      // Calcular última fecha de actualización
      if (adsData && adsData.length > 0) {
        // Buscamos la fecha de creación/update más reciente en los registros
        const dates = adsData.map(d => new Date(d.last_updated).getTime());
        const maxDate = new Date(Math.max(...dates));
        setLastSyncTime(maxDate);
      }

      toast.success('Vista actualizada con la base de datos');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error cargando datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSaveBudget = async (clientId: string, amount: string) => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return;
    setClientBudgets(prev => ({ ...prev, [clientId]: numAmount }));
    try {
      await supabase
        .from('client_settings')
        .upsert({ client_id: clientId, budget_limit: numAmount }, { onConflict: 'client_id' });
      toast.success('Presupuesto guardado');
    } catch (err) {
      toast.error('Error al guardar');
    }
  };

  // --- CÁLCULOS ---
  const reportData = useMemo(() => {
    if (!rawData.length) return [];

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const currentDay = now.getDate();
    const remainingDays = daysInMonth - currentDay;

    // Agrupar gastos por Cliente (Suma de TODAS las campañas, activas o pausadas)
    const stats = new Map<string, { name: string, spent: number }>();

    rawData.forEach(row => {
      const d = new Date(row.date);
      // Filtro estricto: Solo datos de ESTE mes
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        if (!stats.has(row.client_id)) {
          stats.set(row.client_id, { name: row.client_name, spent: 0 });
        }
        stats.get(row.client_id)!.spent += row.cost;
      }
    });

    // Crear reporte
    const report: ClientPacing[] = [];
    stats.forEach((value, clientId) => {
      const budget = clientBudgets[clientId] || 0;
      const spent = value.spent;

      // Proyección Lineal
      const avgDailySpend = currentDay > 0 ? spent / currentDay : 0;
      const forecast = avgDailySpend * daysInMonth;
      
      const progress = budget > 0 ? (spent / budget) * 100 : 0;
      const remainingBudget = Math.max(0, budget - spent);
      const recommendedDaily = remainingDays > 0 ? remainingBudget / remainingDays : 0;

      let status: 'ok' | 'risk' | 'over' | 'under' = 'ok';
      if (budget > 0) {
        if (spent > budget) status = 'over';
        else if (forecast > budget) status = 'risk';
        else if (progress < 50 && currentDay > 20) status = 'under';
      }

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

    return report.sort((a, b) => b.spent - a.spent);
  }, [rawData, clientBudgets]);

  const totalBudget = reportData.reduce((acc, r) => acc + r.budget, 0);
  const totalSpent = reportData.reduce((acc, r) => acc + r.spent, 0);

  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* Cabecera Mejorada */}
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Control Financiero SEM</h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
               <Clock className="w-4 h-4" />
               <span>Datos de Google: {lastSyncTime ? lastSyncTime.toLocaleString() : 'Pendiente'}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchData} variant="outline" className="gap-2">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refrescar Vista
            </Button>
          </div>
        </div>

        {/* Barra Global de Progreso */}
        <Card className="border-slate-200 shadow-sm bg-slate-900 text-white">
          <CardContent className="pt-6">
            <div className="flex justify-between items-end mb-2">
              <div>
                <p className="text-slate-400 text-sm font-medium mb-1">Inversión Total del Mes</p>
                <div className="text-3xl font-bold">{formatCurrency(totalSpent)}</div>
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-sm mb-1">Presupuesto Global</p>
                <div className="text-xl font-semibold">{formatCurrency(totalBudget)}</div>
              </div>
            </div>
            <Progress 
              value={totalBudget > 0 ? (totalSpent/totalBudget)*100 : 0} 
              className="h-3 bg-slate-700 [&>div]:bg-emerald-500" 
            />
            <div className="flex justify-between mt-2 text-xs text-slate-400">
               <span>0€</span>
               <span>{((totalSpent/totalBudget)*100).toFixed(1)}% Consumido</span>
            </div>
          </CardContent>
        </Card>

        {/* Tabla Principal */}
        <Card className="shadow-sm border-slate-200 overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-[250px]">Cliente</TableHead>
                <TableHead className="w-[140px]">Presupuesto</TableHead>
                <TableHead className="w-[200px]">Estado Pacing</TableHead>
                <TableHead className="text-right">Gastado</TableHead>
                <TableHead className="text-right">Proyección</TableHead>
                <TableHead className="text-right bg-indigo-50/50 text-indigo-700">Rec. Diario</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-slate-500">No hay datos de gasto este mes.</TableCell></TableRow>
              ) : (
                reportData.map((client) => (
                  <TableRow key={client.client_id} className="hover:bg-slate-50/50">
                    
                    <TableCell>
                      <div className="font-semibold text-slate-700">{formatProjectName(client.client_name)}</div>
                      <div className="text-[10px] text-slate-400">ID: {client.client_id}</div>
                    </TableCell>

                    <TableCell>
                      <div className="relative">
                        <DollarSign className="absolute left-2 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <Input 
                          type="number" 
                          defaultValue={client.budget > 0 ? client.budget : ''}
                          onBlur={(e) => handleSaveBudget(client.client_id, e.target.value)}
                          className="pl-7 h-9 font-mono bg-white"
                          placeholder="0.00"
                        />
                      </div>
                    </TableCell>

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
                          className={`h-2 ${
                            client.status === 'over' ? 'bg-red-100 [&>div]:bg-red-500' :
                            client.status === 'risk' ? 'bg-amber-100 [&>div]:bg-amber-500' :
                            'bg-emerald-100 [&>div]:bg-emerald-500'
                          }`} 
                        />
                      </div>
                    </TableCell>

                    <TableCell className="text-right font-medium text-slate-900">
                      {formatCurrency(client.spent)}
                    </TableCell>

                    <TableCell className="text-right font-mono text-slate-600">
                      {client.budget > 0 ? formatCurrency(client.forecast) : '-'}
                      {client.status === 'over' && <AlertTriangle className="inline w-3 h-3 text-red-500 ml-1" />}
                    </TableCell>

                    <TableCell className="text-right font-mono font-medium text-indigo-700 bg-indigo-50/30">
                       {client.budget > 0 && client.remainingBudget > 0 ? (
                         <div className="flex items-center justify-end gap-1">
                           {formatCurrency(client.recommendedDaily)}
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
