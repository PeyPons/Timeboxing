import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, TrendingUp, MousePointer, Eye, Filter } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatProjectName } from '@/lib/utils';
import { toast } from 'sonner';

interface AdRecord {
  id: string;
  client_name: string;
  campaign_name: string;
  status: string;
  cost: number;
  clicks: number;
  impressions: number;
  date: string;
}

export default function AdsPage() {
  const [rawData, setRawData] = useState<AdRecord[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('30d'); // 7d, month, 30d

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('google_ads_campaigns')
        .select('*');

      if (error) throw error;
      setRawData(data || []);
      toast.success('Datos actualizados');
    } catch (error) {
      console.error('Error fetching ads:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCampaigns(); }, []);

  // --- LÓGICA DE FILTRADO Y AGREGACIÓN ---
  const filteredAndAggregatedData = useMemo(() => {
    if (!rawData.length) return [];

    // 1. Calcular fechas límite según el filtro
    const now = new Date();
    let startDate = new Date();
    
    if (dateRange === '7d') {
      startDate.setDate(now.getDate() - 7);
    } else if (dateRange === '30d') {
      startDate.setDate(now.getDate() - 30);
    } else if (dateRange === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // 2. Filtrar filas (por cliente y fecha)
    const filtered = rawData.filter(row => {
      const rowDate = new Date(row.date);
      const matchesClient = selectedClient === 'all' || row.client_name === selectedClient;
      const matchesDate = rowDate >= startDate;
      return matchesClient && matchesDate;
    });

    // 3. Agrupar por Campaña (Sumar los días)
    const campaignMap = new Map();

    filtered.forEach(row => {
      // Clave única: cliente + campaña
      const key = `${row.client_name}-${row.campaign_name}`;
      
      if (!campaignMap.has(key)) {
        campaignMap.set(key, {
          id: key,
          client_name: row.client_name,
          campaign_name: row.campaign_name,
          status: row.status,
          cost: 0,
          clicks: 0,
          impressions: 0
        });
      }

      const existing = campaignMap.get(key);
      existing.cost += row.cost;
      existing.clicks += row.clicks;
      existing.impressions += row.impressions;
    });

    return Array.from(campaignMap.values()).sort((a, b) => b.cost - a.cost);
  }, [rawData, selectedClient, dateRange]);

  // Lista única de clientes para el dropdown
  const uniqueClients = useMemo(() => {
    const clients = new Set(rawData.map(r => r.client_name));
    return Array.from(clients).sort();
  }, [rawData]);

  // Totales generales
  const totalCost = filteredAndAggregatedData.reduce((acc, c) => acc + c.cost, 0);
  const totalClicks = filteredAndAggregatedData.reduce((acc, c) => acc + c.clicks, 0);
  const totalImpressions = filteredAndAggregatedData.reduce((acc, c) => acc + c.impressions, 0);

  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* Cabecera y Controles */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Google Ads</h1>
            <p className="text-slate-500 text-sm">Mostrando datos sincronizados (últimos 30 días)</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Selector de Fechas */}
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Periodo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Últimos 7 días</SelectItem>
                <SelectItem value="30d">Últimos 30 días</SelectItem>
                <SelectItem value="month">Este Mes</SelectItem>
              </SelectContent>
            </Select>

            {/* Selector de Cliente */}
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="w-[240px]">
                <Filter className="w-4 h-4 mr-2 text-slate-400" />
                <SelectValue placeholder="Todos los clientes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los clientes</SelectItem>
                {uniqueClients.map(client => (
                  <SelectItem key={client} value={client}>{formatProjectName(client)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={fetchCampaigns} variant="outline" size="icon" title="Refrescar datos">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Tarjetas de Resumen */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-white shadow-sm border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Inversión (Periodo)</CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalCost)}</div>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-sm border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Clics</CardTitle>
              <MousePointer className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{totalClicks.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-sm border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Impresiones</CardTitle>
              <Eye className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{totalImpressions.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabla */}
        <Card className="shadow-sm border-slate-200 overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Campaña</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Inversión</TableHead>
                <TableHead className="text-right">Clics</TableHead>
                <TableHead className="text-right">Impr.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && filteredAndAggregatedData.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center">Cargando...</TableCell></TableRow>
              ) : filteredAndAggregatedData.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center">No hay datos para este filtro.</TableCell></TableRow>
              ) : (
                filteredAndAggregatedData.map((camp) => (
                  <TableRow key={camp.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-medium text-indigo-600">{formatProjectName(camp.client_name)}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={camp.campaign_name}>{camp.campaign_name}</TableCell>
                    <TableCell>
                      <Badge variant={camp.status === 'ENABLED' ? 'default' : 'secondary'} className="text-xs">
                        {camp.status === 'ENABLED' ? 'Activa' : camp.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">{formatCurrency(camp.cost)}</TableCell>
                    <TableCell className="text-right text-slate-600">{camp.clicks.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-slate-600">{camp.impressions.toLocaleString()}</TableCell>
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
