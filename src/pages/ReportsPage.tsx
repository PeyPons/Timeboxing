import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart3, 
  Users, 
  Clock, 
  TrendingUp, 
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CheckCircle2,
  Filter,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getMonthlyCapacity } from '@/utils/dateUtils';
import { format, subMonths, addMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

export default function ReportsPage() {
  const { employees, clients, projects, allocations } = useApp();
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('all');
  
  const handlePrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const handleToday = () => setCurrentMonth(new Date());

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const activeEmployees = useMemo(() => {
      if (selectedEmployeeId === 'all') return employees.filter(e => e.isActive);
      return employees.filter(e => e.id === selectedEmployeeId);
  }, [employees, selectedEmployeeId]);

  const monthAllocations = useMemo(() => {
    return allocations.filter(a => {
      const weekStart = parseISO(a.weekStartDate);
      const inMonth = weekStart >= monthStart && weekStart <= monthEnd;
      const matchesEmp = selectedEmployeeId === 'all' || a.employeeId === selectedEmployeeId;
      return inMonth && matchesEmp;
    });
  }, [allocations, monthStart, monthEnd, selectedEmployeeId]);

  const totalCapacity = useMemo(() => activeEmployees.reduce((sum, e) => {
    return sum + getMonthlyCapacity(year, month, e.workSchedule);
  }, 0), [activeEmployees, year, month]);

  // --- CÁLCULOS PRINCIPALES ---
  const monthStats = useMemo(() => {
    const planned = round2(monthAllocations.reduce((sum, a) => sum + a.hoursAssigned, 0));
    const completedTasks = monthAllocations.filter(a => a.status === 'completed');
    const real = round2(completedTasks.reduce((sum, a) => sum + (a.hoursActual || 0), 0));
    const computed = round2(completedTasks.reduce((sum, a) => sum + (a.hoursComputed || 0), 0));

    return { planned, real, computed };
  }, [monthAllocations]);

  const utilizationRate = totalCapacity > 0 ? (monthStats.planned / totalCapacity) * 100 : 0;
  const profitabilityRate = monthStats.real > 0 ? (monthStats.computed / monthStats.real) * 100 : 0;

  const employeeData = useMemo(() => {
    return activeEmployees.map(e => {
      const capacity = getMonthlyCapacity(year, month, e.workSchedule);
      const empAllocations = monthAllocations.filter(a => a.employeeId === e.id);
      const completedTasks = empAllocations.filter(a => a.status === 'completed');
      
      const plannedHours = round2(empAllocations.reduce((sum, a) => sum + a.hoursAssigned, 0));
      const realHours = round2(completedTasks.reduce((sum, a) => sum + (a.hoursActual || 0), 0));
      const computedHours = round2(completedTasks.reduce((sum, a) => sum + (a.hoursComputed || 0), 0));
      
      const percentage = capacity > 0 ? (plannedHours / capacity) * 100 : 0;
      // Eficiencia individual (Comp vs Real)
      const efficiency = realHours > 0 ? (computedHours / realHours) * 100 : 0;

      return { ...e, plannedHours, realHours, computedHours, capacity, percentage, efficiency };
    }).sort((a, b) => b.percentage - a.percentage);
  }, [activeEmployees, monthAllocations, year, month]);

  const projectData = useMemo(() => {
    const relevantProjectIds = new Set(monthAllocations.map(a => a.projectId));
    const projectsToShow = selectedEmployeeId === 'all' 
        ? projects.filter(p => p.status === 'active') 
        : projects.filter(p => relevantProjectIds.has(p.id));

    return projectsToShow.map(p => {
        const client = clients.find(c => c.id === p.clientId);
        const projAllocations = monthAllocations.filter(a => a.projectId === p.id);
        const completedTasks = projAllocations.filter(a => a.status === 'completed');
        
        const planned = round2(projAllocations.reduce((sum, a) => sum + a.hoursAssigned, 0));
        const real = round2(completedTasks.reduce((sum, a) => sum + (a.hoursActual || 0), 0));
        const computed = round2(completedTasks.reduce((sum, a) => sum + (a.hoursComputed || 0), 0));

        const percentage = p.budgetHours > 0 ? (planned / p.budgetHours) * 100 : 0;

        return {
            ...p,
            clientName: client?.name,
            clientColor: client?.color,
            hoursPlanned: planned,
            hoursReal: real,
            hoursComputed: computed,
            budget: p.budgetHours,
            percentage: percentage
        };
    }).filter(p => selectedEmployeeId === 'all' || p.hoursPlanned > 0)
      .sort((a, b) => b.hoursPlanned - a.hoursPlanned);
  }, [projects, clients, monthAllocations, selectedEmployeeId]);

  const stats = [
    {
      title: 'Capacidad',
      value: `${totalCapacity}h`,
      subtitle: selectedEmployeeId === 'all' ? 'Total Equipo' : 'Disponible',
      icon: Users,
      color: 'text-slate-600',
      bgColor: 'bg-slate-100',
    },
    {
      title: 'Planificado',
      value: `${monthStats.planned}h`,
      subtitle: `${utilizationRate.toFixed(0)}% ocupación`,
      icon: Clock,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    },
    {
      title: 'Real (Incurrido)',
      value: `${monthStats.real}h`,
      subtitle: `Trabajo de reloj`,
      icon: Zap,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Computado',
      value: `${monthStats.computed}h`,
      subtitle: 'Facturable',
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
  ];

  return (
    <div className="flex flex-col h-full space-y-6 p-6 md:p-8 max-w-7xl mx-auto w-full">
      
      {/* HEADER */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                    <BarChart3 className="h-8 w-8 text-indigo-600" />
                    Reportes y Métricas
                </h1>
                <p className="text-muted-foreground">
                    Análisis de rendimiento {selectedEmployeeId !== 'all' ? 'individual' : 'del equipo'}.
                </p>
            </div>

            <div className="flex items-center gap-4">
                <div className="w-[200px]">
                    <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                        <SelectTrigger className="bg-white">
                            <div className="flex items-center gap-2">
                                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                                <SelectValue placeholder="Filtrar..." />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todo el Equipo</SelectItem>
                            {employees.filter(e => e.isActive).map(emp => (
                                <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
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
        </div>
      </div>

      {/* KPI CARDS */}
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

      {/* TABS CONTENT */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visión General</TabsTrigger>
          <TabsTrigger value="team">Desglose Equipo</TabsTrigger>
          <TabsTrigger value="projects">Proyectos</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Eficiencia & Rentabilidad</CardTitle>
                <CardDescription>Análisis de ocupación y conversión de horas reales a facturables.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="font-medium text-slate-700">Ocupación (Planificado vs Capacidad)</span>
                        <span className="font-bold">{utilizationRate.toFixed(1)}%</span>
                    </div>
                    <Progress value={utilizationRate} className="h-3 bg-slate-100" />
                </div>
                
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="font-medium text-emerald-700">Rentabilidad (Computado vs Real)</span>
                        <div className="flex gap-2 text-xs items-center">
                            <span className="text-blue-600">Real: {monthStats.real}h</span>
                            <span className="text-slate-300">|</span>
                            <span className="text-emerald-700 font-bold">{profitabilityRate.toFixed(1)}% Ratio</span>
                        </div>
                    </div>
                    {/* Barra doble: Fondo azul (Real), Frente verde (Computado) */}
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden relative">
                        <div className="absolute top-0 left-0 h-full bg-blue-200 w-full" />
                        <div 
                            className="absolute top-0 left-0 h-full bg-emerald-500 transition-all" 
                            style={{ width: `${Math.min(profitabilityRate, 100)}%` }} 
                        />
                    </div>
                    <p className="text-[10px] text-muted-foreground text-right pt-1">
                        Si la barra verde no llena la azul, estamos trabajando más de lo que facturamos.
                    </p>
                </div>

                <div className="pt-4 grid grid-cols-4 gap-2 text-center border-t">
                    <div>
                        <div className="text-xl font-bold text-slate-400">{totalCapacity}</div>
                        <div className="text-[10px] uppercase font-bold text-slate-400">Capacidad</div>
                    </div>
                    <div>
                        <div className="text-xl font-bold text-indigo-600">{monthStats.planned}</div>
                        <div className="text-[10px] uppercase font-bold text-indigo-600">Plan</div>
                    </div>
                    <div>
                        <div className="text-xl font-bold text-blue-600">{monthStats.real}</div>
                        <div className="text-[10px] uppercase font-bold text-blue-600">Real</div>
                    </div>
                     <div>
                        <div className="text-xl font-bold text-emerald-600">{monthStats.computed}</div>
                        <div className="text-[10px] uppercase font-bold text-emerald-600">Comp.</div>
                    </div>
                </div>
              </CardContent>
            </Card>

            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Top Proyectos (Planificado)</CardTitle>
                <CardDescription>Mayor inversión de tiempo prevista este mes.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                    {projectData.slice(0, 5).map(p => (
                        <div key={p.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="h-8 w-8 rounded flex items-center justify-center border bg-slate-50 shrink-0">
                                    <FolderOpen className="h-4 w-4 text-slate-500" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium leading-none truncate w-32 md:w-40" title={p.name}>{p.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{p.clientName}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="font-bold text-sm">{p.hoursPlanned}h</div>
                                <div className="text-[10px] text-muted-foreground">de {p.budget}h</div>
                            </div>
                        </div>
                    ))}
                    {projectData.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sin actividad registrada.</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Desglose por Empleado</CardTitle>
                    <CardDescription>Análisis de Ocupación (Plan) y Rentabilidad (Real vs Comp).</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        {employeeData.map(emp => (
                            // ✅ KEY ÚNICA: Fuerza re-render al cambiar de mes para arreglar el bug visual del color rojo
                            <div key={emp.id + currentMonth.toISOString()} className="grid grid-cols-12 gap-4 items-start group hover:bg-slate-50 p-3 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                                <div className="col-span-4 md:col-span-3 flex items-center gap-3 mt-1">
                                    <div className="h-9 w-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs border border-indigo-200">
                                        {emp.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-medium text-sm truncate">{emp.name}</div>
                                        <div className="text-xs text-muted-foreground">{emp.role}</div>
                                    </div>
                                </div>

                                <div className="col-span-8 md:col-span-9 space-y-4">
                                    {/* SECCIÓN 1: PLANIFICACIÓN (Barra Única) */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-500">Ocupación Planificada ({emp.plannedHours}/{emp.capacity}h)</span>
                                            <span className={cn("font-medium", emp.percentage > 100 ? "text-red-600 font-bold" : "text-slate-700")}>
                                                {emp.percentage.toFixed(0)}%
                                            </span>
                                        </div>
                                        <div className="relative h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div 
                                                className={cn("absolute top-0 left-0 h-full", 
                                                    emp.percentage > 100 ? "bg-red-500" : 
                                                    emp.percentage > 85 ? "bg-amber-500" : "bg-blue-500"
                                                )}
                                                style={{ width: `${Math.min(emp.percentage, 100)}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* SECCIÓN 2: RENTABILIDAD (Barra Verde sobre Azul) */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <div className="flex gap-2">
                                                <span>Rentabilidad</span>
                                                <span className="text-blue-600 flex items-center gap-0.5"><Zap className="h-3 w-3" /> {emp.realHours}h</span>
                                                <span className="text-emerald-600 flex items-center gap-0.5"><CheckCircle2 className="h-3 w-3" /> {emp.computedHours}h</span>
                                            </div>
                                            <span>{emp.efficiency.toFixed(0)}%</span>
                                        </div>
                                        <div className="relative h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                            {/* Fondo Azul (Real) */}
                                            <div className="absolute top-0 left-0 h-full bg-blue-200 w-full" />
                                            {/* Frente Verde (Computado) */}
                                            <div 
                                                className="absolute top-0 left-0 h-full bg-emerald-500 transition-all" 
                                                style={{ width: `${Math.min(emp.efficiency, 100)}%` }} 
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="projects" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {projectData.map(p => {
                    const gain = p.hoursComputed - p.hoursReal;
                    return (
                        <Card key={p.id + currentMonth.toISOString()} className={cn("border-l-4", p.percentage > 100 ? "border-l-red-500" : "border-l-indigo-500")}>
                            <CardHeader className="pb-2 bg-slate-50/50 pt-3">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                            <CardTitle className="text-sm truncate max-w-[180px]" title={p.name}>{p.name}</CardTitle>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: p.clientColor }} />
                                            {p.clientName}
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="text-[10px] font-mono">{p.budget}h Presup.</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-3">
                                <div className="flex justify-between items-end">
                                    <span className="text-xs text-muted-foreground font-medium">Planificado</span>
                                    <span className={cn("text-sm font-bold", p.percentage > 100 ? "text-red-600" : "text-indigo-600")}>
                                        {p.hoursPlanned}h
                                    </span>
                                </div>
                                <Progress value={p.percentage} className={cn("h-1.5", p.percentage > 100 ? "[&>div]:bg-red-500" : "")} />
                                
                                <div className="grid grid-cols-2 gap-2 pt-2 mt-2 border-t">
                                    <div className="bg-blue-50 rounded p-1.5 text-center">
                                        <div className="text-[10px] text-blue-600 font-bold uppercase">Real</div>
                                        <div className="text-sm font-mono text-blue-700">{p.hoursReal}h</div>
                                    </div>
                                    <div className="bg-emerald-50 rounded p-1.5 text-center">
                                        <div className="text-[10px] text-emerald-600 font-bold uppercase">Comp.</div>
                                        <div className="text-sm font-mono text-emerald-700">{p.hoursComputed}h</div>
                                    </div>
                                </div>
                                
                                {Math.abs(gain) > 0.01 && (
                                    <div className={cn("text-[10px] text-center font-medium py-1 rounded", gain > 0 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800")}>
                                        Diferencia: {gain > 0 ? '+' : ''}{parseFloat(gain.toFixed(2))}h
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
