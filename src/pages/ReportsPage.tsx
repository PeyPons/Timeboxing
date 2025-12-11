import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Users, Briefcase, Clock, AlertTriangle } from 'lucide-react';

export default function ReportsPage() {
  const { employees, clients, allocations, getClientHoursForMonth } = useApp();
  
  const currentMonth = new Date();
  
  // Calculate stats
  const totalAllocatedHours = allocations.reduce((sum, a) => sum + a.hoursAssigned, 0);
  const totalCapacity = employees.reduce((sum, e) => sum + (e.defaultWeeklyCapacity * 4), 0);
  const utilizationRate = totalCapacity > 0 ? (totalAllocatedHours / totalCapacity) * 100 : 0;
  
  const clientsOverBudget = clients.filter(c => {
    const { percentage } = getClientHoursForMonth(c.id, currentMonth);
    return percentage > 100;
  });

  const stats = [
    {
      title: 'Empleados',
      value: employees.length,
      icon: Users,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Clientes activos',
      value: clients.length,
      icon: Briefcase,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: 'Horas asignadas',
      value: `${totalAllocatedHours}h`,
      icon: Clock,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      title: 'Clientes excedidos',
      value: clientsOverBudget.length,
      icon: AlertTriangle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reportes</h1>
            <p className="text-muted-foreground">
              Vista general de la agencia
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat) => (
          <Card key={stat.title} className="animate-fade-in">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`h-8 w-8 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Utilización del equipo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Capacidad total mensual</span>
              <span className="font-bold">{totalCapacity}h</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Horas asignadas</span>
              <span className="font-bold">{totalAllocatedHours}h</span>
            </div>
            <div className="h-4 w-full overflow-hidden rounded-full bg-muted">
              <div 
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${Math.min(utilizationRate, 100)}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              {utilizationRate.toFixed(1)}% de utilización
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
