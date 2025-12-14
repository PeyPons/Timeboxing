import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  Users, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CheckCircle2,
  PieChart
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getMonthlyCapacity } from '@/utils/dateUtils';
import { format, subMonths, addMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ReportsPage() {
  const { employees, clients, projects, allocations, getProjectHoursForMonth } = useApp();
  
  // 1. Navegación Temporal
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const handlePrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const handleToday = () => setCurrentMonth(new Date());

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  // --- CÁLCULOS GLOBALES ---

  // 1. Capacidad Total del Equipo
  const totalCapacity = useMemo(() => employees.reduce((sum, e) => {
    return sum + getMonthlyCapacity(year, month, e.workSchedule);
  }, 0), [employees, year, month]);

  // 2. Asignaciones del mes (Planificado vs Real)
  const monthStats = useMemo(() => {
    const relevantAllocations = allocations.filter(a => {
      const weekStart = parseISO(a.weekStartDate);
      return weekStart >= monthStart && weekStart <= monthEnd;
    });

    const planned = relevantAllocations.reduce((sum, a) => sum + a.hoursAssigned, 0);
    const completed = relevantAllocations
        .filter(a => a.status === 'completed')
        .reduce((sum, a) => sum + a.hoursAssigned, 0);

    return { planned, completed, raw: relevantAllocations };
  }, [allocations, monthStart, monthEnd]);

  // Tasa de utilización (Planificada)
  const utilizationRate = totalCapacity > 0 ? (monthStats.planned / totalCapacity) * 100 : 0;
  // Tasa de ejecución (Real)
  const executionRate = monthStats.planned > 0 ? (monthStats.completed / monthStats.planned) * 100 : 0;

  // 3. Datos por Empleado (Ordenados por carga)
  const employeeData = useMemo(() => {
    return employees.map(e => {
      const capacity = getMonthlyCapacity(year, month, e.workSchedule);
      const empAllocations = monthStats.raw.filter(a => a.employeeId === e.id);
      
      const plannedHours = empAllocations.reduce((sum, a) => sum + a.hoursAssigned, 0);
      const completedHours = empAllocations.filter(a => a.status === 'completed').reduce((sum, a) => sum + a.hoursAssigned, 0);
      
      const percentage = capacity > 0 ? (plannedHours / capacity) * 100 : 0;
      const available = Math.max(0, capacity - plannedHours);

      return { ...e, plannedHours, completedHours, capacity, percentage, available };
    }).sort((a, b) => b.percentage - a.percentage);
  }, [employees, monthStats, year, month]);

  // 4. Datos por Proyecto (Top consumidores)
  const projectData = useMemo(() => {
    const active = projects.filter(p => p.status === 'active');
    return active.map(p => {
        const client = clients.find(c => c.id === p.clientId);
        // Reutilizamos la lógica del contexto para coherencia
        const stats = getProjectHoursForMonth(p.id, currentMonth);
        
        // Calculamos completado manualmente aquí para este reporte específico
        const projAllocations = monthStats.raw.filter(a => a.projectId === p.id);
        const completed = projAllocations.filter(a => a.status === 'completed').reduce((sum, a) => sum + a.hoursAssigned, 0);

        return {
            ...p,
            clientName: client?.name,
            clientColor: client?.color,
            hoursUsed: stats.used,
            hoursCompleted: completed,
            budget: stats.budget,
            percentage: stats.percentage
        };
    }).sort((a, b) => b.hoursUsed - a.hoursUsed);
  }, [projects, clients, currentMonth, monthStats]);

  // KPIs Superiores
  const stats = [
    {
      title: 'Capacidad Total',
      value: `${totalCapacity}h`,
      subtitle: 'Disponibles este mes',
      icon: Users,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    },
    {
      title: 'Planificado',
      value: `${monthStats.planned}h`,
      subtitle: `${utilizationRate.toFixed(0)}% ocupación`,
      icon: Clock,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Ejecutado',
      value: `${monthStats.completed}h`,
      subtitle: `${executionRate.toFixed(0)}% del plan`,
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      title: 'Riesgo',
      value: projectData.filter(p => p.percentage > 100).length,
      subtitle: 'Proyectos excedidos',
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
  ];

  return (
    <div className="flex flex-col h-full space-y-6 p-6 md:p-8 max-w-7xl mx-auto w-full">
      
      {/* Cabecera con Navegación */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                <BarChart3 className="h-8 w-8 text-indigo-600" />
                Reportes y Métricas
            </h1>
            <p className="text-muted-foreground">
                Análisis de rendimiento y capacidad del equipo.
            </p>
        </div>

        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-lg border shadow-sm">
            <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
                <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 px-2 min-w-[140px] justify-center font-medium">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className="capitalize">{format(currentMonth, 'MMMM yyyy', { locale: es })}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={handleNextMonth}>
                <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="w-px h-6 bg-border mx-1" />
            <Button variant="ghost" size="sm" onClick={handleToday} className="text-xs">Hoy</Button>
        </div>
      </div>

      {/* Tarjetas de KPI */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <div className={`h-8 w-8 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Contenido Principal con Pestañas */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visión General</TabsTrigger>
          <TabsTrigger value="team">Equipo y Carga</TabsTrigger>
          <TabsTrigger value="projects">Proyectos</TabsTrigger>
        </TabsList>

        {/* --- PESTAÑA: VISIÓN GENERAL --- */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            
            {/* Gráfico de Utilización (Texto + Barras) */}
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Eficiencia Global</CardTitle>
                <CardDescription>Comparativa entre horas disponibles, planificadas y reales.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="font-medium">Ocupación (Planificado vs Capacidad)</span>
                        <span>{utilizationRate.toFixed(1)}%</span>
                    </div>
                    <Progress value={utilizationRate} className="h-3 bg-slate-100" />
                </div>
                
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="font-medium text-emerald-700">Ejecución (Real vs Planificado)</span>
                        <span className="text-emerald-700 font-bold">{executionRate.toFixed(1)}%</span>
                    </div>
                    <Progress value={executionRate} className="h-3 bg-emerald-100 [&>div]:bg-emerald-500" />
                </div>

                <div className="pt-4 grid grid-cols-3 gap-4 text-center border-t">
                    <div>
                        <div className="text-2xl font-bold text-slate-700">{totalCapacity}h</div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">Capacidad</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-blue-600">{monthStats.planned}h</div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">Asignado</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-emerald-600">{monthStats.completed}h</div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">Hecho</div>
                    </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Proyectos Consumidores */}
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Top Consumo</CardTitle>
                <CardDescription>Proyectos con más horas este mes.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                    {projectData.slice(0, 5).map(p => (
                        <div key={p.id} className="flex items-center">
                            <div className="h-9 w-9 rounded-full flex items-center justify-center border bg-white shadow-sm mr-4 shrink-0">
                                <FolderOpen className="h-4 w-4 text-slate-500" />
                            </div>
                            <div className="flex-1 space-y-1 min-w-0">
                                <p className="text-sm font-medium leading-none truncate">{p.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{p.clientName}</p>
                            </div>
                            <div className="font-bold text-sm tabular-nums">{p.hoursUsed}h</div>
                        </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* --- PESTAÑA: EQUIPO --- */}
        <TabsContent value="team" className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Carga de Trabajo por Empleado</CardTitle>
                    <CardDescription>Identifica quién está sobrecargado y quién tiene disponibilidad.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        {employeeData.map(emp => (
                            <div key={emp.id} className="grid grid-cols-12 gap-4 items-center group hover:bg-slate-50 p-2 rounded-lg transition-colors">
                                {/* Info Empleado */}
                                <div className="col-span-4 md:col-span-3 flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                                        {emp.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-medium text-sm truncate">{emp.name}</div>
                                        <div className="text-xs text-muted-foreground">{emp.role}</div>
                                    </div>
                                </div>

                                {/* Barra de Progreso */}
                                <div className="col-span-5 md:col-span-7 space-y-1">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className={cn(
                                            emp.percentage > 100 ? "text-red-600 font-bold" : "text-muted-foreground"
                                        )}>
                                            {emp.percentage.toFixed(0)}% Ocupación
                                        </span>
                                        <span className="text-emerald-600 text-[10px]">
                                            {emp.completedHours > 0 && `${emp.completedHours}h completadas`}
                                        </span>
                                    </div>
                                    <div className="relative h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                        {/* Barra Planificada */}
                                        <div 
                                            className={cn("absolute top-0 left-0 h-full transition-all", 
                                                emp.percentage > 100 ? "bg-red-500" : 
                                                emp.percentage > 85 ? "bg-amber-500" : "bg-blue-500"
                                            )}
                                            style={{ width: `${Math.min(emp.percentage, 100)}%` }}
                                        />
                                        {/* Barra Completada (Superpuesta, más oscura) */}
                                        <div 
                                            className="absolute top-0 left-0 h-full bg-black/20 transition-all"
                                            style={{ width: `${(emp.completedHours / emp.capacity) * 100}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Métricas */}
                                <div className="col-span-3 md:col-span-2 text-right">
                                    {emp.available > 5 ? (
                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                            {round2(emp.available)}h libres
                                        </Badge>
                                    ) : emp.available < 0 ? (
                                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                            +{Math.abs(round2(emp.available))}h extra
                                        </Badge>
                                    ) : (
                                        <span className="text-xs text-muted-foreground font-mono">
                                            {emp.plannedHours}/{emp.capacity}h
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </TabsContent>

        {/* --- PESTAÑA: PROYECTOS --- */}
        <TabsContent value="projects" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {projectData.map(p => (
                    <Card key={p.id} className={cn("border-l-4", p.percentage > 100 ? "border-l-red-500" : "border-l-indigo-500")}>
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <CardTitle className="text-base truncate" title={p.name}>{p.name}</CardTitle>
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: p.clientColor }} />
                                        {p.clientName}
                                    </div>
                                </div>
                                {p.percentage > 100 && <AlertTriangle className="h-4 w-4 text-red-500" />}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="mt-2 space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Consumo Mes</span>
                                    <span className="font-bold">{p.hoursUsed}h</span>
                                </div>
                                <Progress value={p.percentage} className={cn("h-2", p.percentage > 100 ? "[&>div]:bg-red-500" : "")} />
                                
                                <div className="flex justify-between items-center text-xs pt-2 border-t mt-2">
                                    <span className="text-muted-foreground">Total Presupuesto: {p.budget}h</span>
                                    {p.hoursCompleted > 0 && (
                                        <span className="flex items-center gap-1 text-emerald-600 font-medium">
                                            <CheckCircle2 className="h-3 w-3" /> {p.hoursCompleted}h cerradas
                                        </span>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper pequeño para redondeo visual
const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;
