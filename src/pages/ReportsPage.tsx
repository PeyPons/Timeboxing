import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BarChart3, Users, Briefcase, Clock, AlertTriangle, TrendingUp, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getMonthlyCapacity } from '@/utils/dateUtils';

export default function ReportsPage() {
  const { employees, clients, projects, allocations, getClientHoursForMonth, getProjectHoursForMonth } = useApp();
  
  const currentMonth = new Date();
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  // Calculate total capacity for current month
  const totalCapacity = employees.reduce((sum, e) => {
    return sum + getMonthlyCapacity(year, month, e.workSchedule);
  }, 0);

  // Calculate total allocated hours for current month
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const monthAllocations = allocations.filter(a => {
    const weekStart = new Date(a.weekStartDate);
    return weekStart >= monthStart && weekStart <= monthEnd;
  });
  const totalAllocatedHours = monthAllocations.reduce((sum, a) => sum + a.hoursAssigned, 0);
  const utilizationRate = totalCapacity > 0 ? (totalAllocatedHours / totalCapacity) * 100 : 0;
  
  // Clients over budget
  const clientsData = clients.map(c => {
    const hours = getClientHoursForMonth(c.id, currentMonth);
    return { ...c, ...hours };
  }).sort((a, b) => b.percentage - a.percentage);

  const clientsOverBudget = clientsData.filter(c => c.percentage > 100);

  // Employee utilization
  const employeeData = employees.map(e => {
    const capacity = getMonthlyCapacity(year, month, e.workSchedule);
    const employeeAllocations = monthAllocations.filter(a => a.employeeId === e.id);
    const hours = employeeAllocations.reduce((sum, a) => sum + a.hoursAssigned, 0);
    const percentage = capacity > 0 ? (hours / capacity) * 100 : 0;
    return { ...e, hours, capacity, percentage };
  }).sort((a, b) => b.percentage - a.percentage);

  // Project hours
  const activeProjects = projects.filter(p => p.status === 'active');
  const projectData = activeProjects.map(p => {
    const client = clients.find(c => c.id === p.clientId);
    const projectAllocations = monthAllocations.filter(a => a.projectId === p.id);
    const hours = projectAllocations.reduce((sum, a) => sum + a.hoursAssigned, 0);
    return { ...p, clientName: client?.name, clientColor: client?.color, hours };
  }).sort((a, b) => b.hours - a.hours);

  const stats = [
    {
      title: 'Empleados',
      value: employees.length,
      icon: Users,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Proyectos activos',
      value: activeProjects.length,
      icon: FolderOpen,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: 'Horas asignadas',
      value: `${totalAllocatedHours}h`,
      subtitle: `de ${totalCapacity}h`,
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
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reportes</h1>
            <p className="text-muted-foreground">
              Vista general de {currentMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
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
              {stat.subtitle && (
                <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Team Utilization */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Utilización del equipo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total mensual</span>
              <span className="font-bold">{totalAllocatedHours}h / {totalCapacity}h ({utilizationRate.toFixed(0)}%)</span>
            </div>
            <Progress value={Math.min(utilizationRate, 100)} className="h-3" />
            
            <div className="space-y-3 pt-4">
              {employeeData.map((emp) => (
                <div key={emp.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{emp.name}</span>
                    <span className={cn(
                      "text-xs font-medium",
                      emp.percentage > 100 && "text-destructive",
                      emp.percentage > 85 && emp.percentage <= 100 && "text-warning",
                      emp.percentage <= 85 && "text-muted-foreground"
                    )}>
                      {emp.hours}h / {emp.capacity}h
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div 
                      className={cn(
                        "h-full transition-all",
                        emp.percentage > 100 && "bg-destructive",
                        emp.percentage > 85 && emp.percentage <= 100 && "bg-warning",
                        emp.percentage <= 85 && "bg-success"
                      )}
                      style={{ width: `${Math.min(emp.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Client Hours */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              Horas por cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {clientsData.map((client) => (
              <div key={client.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="h-3 w-3 rounded-full" 
                      style={{ backgroundColor: client.color }}
                    />
                    <span className="font-medium">{client.name}</span>
                  </div>
                  <span className={cn(
                    "text-xs font-medium",
                    client.percentage > 100 && "text-destructive",
                    client.percentage > 85 && client.percentage <= 100 && "text-warning"
                  )}>
                    {client.used}h / {client.budget}h
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div 
                    className={cn(
                      "h-full transition-all",
                      client.percentage > 100 && "bg-destructive",
                      client.percentage > 85 && client.percentage <= 100 && "bg-warning",
                      client.percentage <= 85 && "bg-primary"
                    )}
                    style={{ width: `${Math.min(client.percentage, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Projects by Hours */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              Horas por proyecto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {projectData.map((project) => (
                <div 
                  key={project.id} 
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div 
                      className="h-3 w-3 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: project.clientColor || '#888' }}
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{project.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{project.clientName}</p>
                    </div>
                  </div>
                  <span className="font-bold text-sm flex-shrink-0 ml-2">{project.hours}h</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
