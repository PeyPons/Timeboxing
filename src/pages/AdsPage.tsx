import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, TrendingUp, MousePointer, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatProjectName } from '@/lib/utils';
import { toast } from 'sonner';

interface AdCampaign {
  id: string;
  client_name: string;
  campaign_name: string;
  status: string;
  cost: number;
  clicks: number;
  impressions: number;
}

export default function AdsPage() {
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('google_ads_campaigns')
        .select('*')
        .order('cost', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error) {
      console.error('Error fetching ads:', error);
      toast.error('No se pudieron cargar las campañas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  // Cálculos de totales
  const totalCost = campaigns.reduce((acc, curr) => acc + curr.cost, 0);
  const totalClicks = campaigns.reduce((acc, curr) => acc + curr.clicks, 0);
  const totalImpressions = campaigns.reduce((acc, curr) => acc + curr.impressions, 0);

  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Google Ads (Tiempo Real)</h1>
            <p className="text-slate-500">Datos sincronizados directamente de tu cuenta MCC.</p>
          </div>
          <Button onClick={fetchCampaigns} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>

        {/* Tarjetas de Resumen */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-white shadow-sm border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Inversión Total</CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalCost)}</div>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-sm border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Clics Totales</CardTitle>
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

        {/* Tabla de Campañas */}
        <Card className="shadow-sm border-slate-200 overflow-hidden">
          <div className="p-0">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-semibold text-slate-700">Cliente</TableHead>
                  <TableHead className="font-semibold text-slate-700">Campaña</TableHead>
                  <TableHead className="font-semibold text-slate-700">Estado</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">Inversión</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">Clics</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">Impresiones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">Cargando datos...</TableCell>
                  </TableRow>
                ) : campaigns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">No hay campañas activas sincronizadas.</TableCell>
                  </TableRow>
                ) : (
                  campaigns.map((camp) => (
                    <TableRow key={camp.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-medium text-indigo-600">
                        {formatProjectName(camp.client_name)}
                      </TableCell>
                      <TableCell>{camp.campaign_name}</TableCell>
                      <TableCell>
                        <Badge variant={camp.status === 'ENABLED' ? 'default' : 'secondary'} className="text-xs">
                          {camp.status === 'ENABLED' ? 'Activa' : camp.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatCurrency(camp.cost)}
                      </TableCell>
                      <TableCell className="text-right text-slate-600">
                        {camp.clicks.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-slate-600">
                        {camp.impressions.toLocaleString()}
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
