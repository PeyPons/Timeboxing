import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Megaphone, TrendingUp, DollarSign, MousePointer, Activity, RefreshCw } from 'lucide-react';
import { formatCurrency } from '@/lib/utils'; // Asegúrate de que esta utilidad exista o usa una simple

// --- TIPOS DE DATOS (Simulando la API de Google) ---
type CampaignStatus = 'ENABLED' | 'PAUSED' | 'REMOVED';

interface GoogleAdsCampaign {
  id: string;
  name: string;
  status: CampaignStatus;
  dailyBudget: number;
  totalBudget: number; // Presupuesto total asignado (si aplica) o calculado
  cost: number;
  clicks: number;
  impressions: number;
}

interface GoogleAdsClient {
  id: string;
  name: string;
  currencyCode: string;
  campaigns: GoogleAdsCampaign[];
}

// --- DATOS MOCK (Lo que reemplazaremos con la API real más adelante) ---
const MOCK_MCC_DATA: GoogleAdsClient[] = [
  {
    id: '123-456-7890',
    name: 'Cliente: Furgomera (Ejemplo)',
    currencyCode: 'EUR',
    campaigns: [
      { id: 'c1', name: 'Search - Alquiler Furgonetas', status: 'ENABLED', dailyBudget: 50, totalBudget: 1500, cost: 450.20, clicks: 120, impressions: 4500 },
      { id: 'c2', name: 'Display - Retargeting Verano', status: 'PAUSED', dailyBudget: 20, totalBudget: 600, cost: 120.50, clicks: 45, impressions: 12000 },
    ]
  },
  {
    id: '987-654-3210',
    name: 'Cliente: Restaurante El Patio',
    currencyCode: 'EUR',
    campaigns: [
      { id: 'c3', name: 'Local - Cenas Fin de Semana', status: 'ENABLED', dailyBudget: 30, totalBudget: 900, cost: 210.00, clicks: 85, impressions: 3200 },
    ]
  }
];

export default function AdsPage() {
  const [selectedClientId, setSelectedClientId] = useState<string>(MOCK_MCC_DATA[0].id);
  const [isLoading, setIsLoading] = useState(false);

  // Filtrar el cliente seleccionado
  const selectedClient = MOCK_MCC_DATA.find(c => c.id === selectedClientId) || MOCK_MCC_DATA[0];

  // Cálculos rápidos para los KPIs superiores
  const totalCost = selectedClient.campaigns.reduce((sum, c) => sum + c.cost, 0);
  const totalClicks = selectedClient.campaigns.reduce((sum, c) => sum + c.clicks, 0);
  const activeCampaigns = selectedClient.campaigns.filter(c => c.status === 'ENABLED').length;

  const handleRefresh = () => {
    setIsLoading(true);
    // Aquí llamaremos a la API real en el futuro
    setTimeout(() => setIsLoading(false), 1000);
  };

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-500">
      
      {/* HEADER Y SELECTOR DE CLIENTE */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="h-8 w-8 text-blue-600" />
            Google Ads Manager
          </h1>
          <p className="text-muted-foreground mt-1">
            Supervisión de cuentas MCC y rendimiento de campañas.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-card p-2 rounded-lg border shadow-sm">
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Seleccionar Cliente" />
            </SelectTrigger>
            <SelectContent>
              {MOCK_MCC_DATA.map(client => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name} ({client.id})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* KPIS PRINCIPALES DEL CLIENTE */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gasto Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCost.toFixed(2)} €</div>
            <p className="text-xs text-muted-foreground">En el periodo seleccionado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clics Totales</CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClicks}</div>
            <p className="text-xs text-muted-foreground">Interacciones directas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Campañas Activas</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCampaigns}</div>
            <p className="text-xs text-muted-foreground">De {selectedClient.campaigns.length} campañas totales</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CTR Promedio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalClicks > 0 ? ((totalClicks / (selectedClient.campaigns.reduce((s,c)=>s+c.impressions,0) || 1)) * 100).toFixed(2) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Rendimiento global</p>
          </CardContent>
        </Card>
      </div>

      {/* TABLA DE CAMPAÑAS */}
      <Card className="col-span-4">
        <CardHeader>
          <CardTitle>Desglose de Campañas</CardTitle>
          <CardDescription>
            Estado actual y presupuestos asignados por campaña.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">Campaña</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Presupuesto Diario</TableHead>
                <TableHead className="text-right">Total (Est.)</TableHead>
                <TableHead className="text-right">Gasto Real</TableHead>
                <TableHead className="text-right">Clics</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedClient.campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{campaign.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">{campaign.id}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={campaign.status === 'ENABLED' ? 'default' : 'secondary'} className={campaign.status === 'ENABLED' ? 'bg-green-600 hover:bg-green-700' : ''}>
                      {campaign.status === 'ENABLED' ? 'Activa' : 'Pausada'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{campaign.dailyBudget.toFixed(2)} €</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">{campaign.totalBudget.toFixed(2)} €</TableCell>
                  <TableCell className="text-right font-bold">{campaign.cost.toFixed(2)} €</TableCell>
                  <TableCell className="text-right">{campaign.clicks}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
