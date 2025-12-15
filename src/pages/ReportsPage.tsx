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
  AlertTriangle, 
  TrendingUp, 
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CheckCircle2,
  Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getMonthlyCapacity } from '@/utils/dateUtils';
import { format, subMonths, addMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ReportsPage() {
  const { employees, clients, projects, allocations, getProjectHoursForMonth } = useApp();
  
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

  const monthStats = useMemo(() => {
    // ✅ CORRECCIÓN: Aplicamos round2 AL FINAL de la suma para limpiar decimales locos
    const planned = round2(monthAllocations.reduce((sum, a) => sum + a.hoursAssigned, 0));
    
    const completed = round2(monthAllocations
        .filter(a => a.status === 'completed')
        .reduce((sum, a) => sum + (a.hoursActual || a.hoursAssigned), 0));

    return { planned, completed };
  }, [monthAllocations]);

  const utilizationRate = totalCapacity > 0 ? (monthStats.planned / totalCapacity) * 100 : 0;
  const executionRate = monthStats.planned > 0 ? (monthStats.completed / monthStats.planned) * 100 : 0;

  const employeeData = useMemo(() => {
    return activeEmployees.map(e => {
      const capacity = getMonthlyCapacity(year, month, e.workSchedule);
      const empAllocations = monthAllocations.filter(a => a.employeeId === e.id);
      
      // ✅ CORRECCIÓN AQUÍ TAMBIÉN
      const plannedHours = round2(empAllocations.reduce((sum, a) => sum + a.hoursAssigned, 0));
      const completedHours = round2(empAllocations
        .filter(a => a.status === 'completed')
        .reduce((sum, a) => sum + (a.hoursActual || a.hoursAssigned), 0));
      
      const percentage = capacity > 0 ? (plannedHours / capacity) * 100 : 0;
      const available = round2(Math.max(0, capacity - plannedHours));

      return { ...e, plannedHours, completedHours, capacity, percentage, available };
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
        
        // ✅ Y AQUÍ TAMBIÉN
        const planned = round2(projAllocations.reduce((sum, a) => sum + a.hoursAssigned, 0));
        const real = round2(projAllocations.filter(a => a.status === 'completed').reduce((sum, a) => sum + (a.hoursActual || a.hoursAssigned), 0));

        const percentage = p.budgetHours > 0 ? (planned / p.budgetHours) * 100 : 0;

        return {
            ...p,
            clientName: client?.name,
            clientColor: client?.color,
            hoursPlanned: planned,
            hoursReal: real,
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
      title: 'Computado',
      value: `${monthStats.completed}h`,
      subtitle: `Coste real`,
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      title: 'Proyectos',
      value: projectData.length,
      subtitle: 'Activos este mes',
      icon: FolderOpen,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ];

  return (
    <div className="flex flex-col h-full space-y-6 p-6 md:p-8 max-w-7xl mx-auto w-full">
      
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

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visión General</TabsTrigger>
          <TabsTrigger value="team">Desglose Carga</TabsTrigger>
          <TabsTrigger value="projects">Proyectos</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Eficiencia</CardTitle>
                <CardDescription>Comparativa entre horas disponibles, planificadas y computadas.</CardDescription>
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
                        <span className="font-medium text-emerald-700">Coste Real (Computado vs Planificado)</span>
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
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">Planificado</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-emerald-600">{monthStats.completed}h</div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">Computado</div>
                    </div>
                </div>
              </CardContent>
            </Card>

            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Top Proyectos</CardTitle>
                <CardDescription>Donde se invierte más tiempo este mes.</CardDescription>
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
                            <div className="font-bold text-sm tabular-nums">{p.hoursPlanned}h</div>
                        </div>
                    ))}
                    {projectData.length === 0 && <p className="text-sm text-muted-foreground text-center">Sin actividad registrada.</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Carga de Trabajo Real</CardTitle>
                    <CardDescription>Comparativa de horas planificadas vs horas computadas reales.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        {employeeData.map(emp => (
                            <div key={emp.id} className="grid grid-cols-12 gap-4 items-center group hover:bg-slate-50 p-2 rounded-lg transition-colors">
                                <div className="col-span-4 md:col-span-3 flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                                        {emp.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-medium text-sm truncate">{emp.name}</div>
                                        <div className="text-xs text-muted-foreground">{emp.role}</div>
                                    </div>
                                </div>

                                <div className="col-span-5 md:col-span-7 space-y-1">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className={cn(
                                            emp.percentage > 100 ? "text-red-600 font-bold" : "text-muted-foreground"
                                        )}>
                                            {emp.percentage.toFixed(0)}% Planificado
                                        </span>
                                        <span className="text-emerald-600 text-[10px]">
                                            {emp.completedHours > 0 && `Comp: ${emp.completedHours}h`}
                                        </span>
                                    </div>
                                    <div className="relative h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div 
                                            className={cn("absolute top-0 left-0 h-full transition-all", 
                                                emp.percentage > 100 ? "bg-red-500" : 
                                                emp.percentage > 85 ? "bg-amber-500" : "bg-blue-500"
                                            )}
                                            style={{ width: `${Math.min(emp.percentage, 100)}%` }}
                                        />
                                        <div 
                                            className="absolute top-0 left-0 h-full bg-black/20 transition-all"
                                            style={{ width: `${(emp.completedHours / emp.capacity) * 100}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="col-span-3 md:col-span-2 text-right">
                                    <span className="text-xs text-muted-foreground font-mono">
                                        {emp.plannedHours}/{emp.capacity}h
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </TabsContent>

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
                                    <span className="text-muted-foreground">Planificado</span>
                                    <span className="font-bold">{p.hoursPlanned}h</span>
                                </div>
                                <Progress value={p.percentage} className={cn("h-2", p.percentage > 100 ? "[&>div]:bg-red-500" : "")} />
                                
                                <div className="flex justify-between items-center text-xs pt-2 border-t mt-2">
                                    <span className="text-muted-foreground">Presupuesto: {p.budget}h</span>
                                    {p.hoursReal > 0 && (
                                        <span className="flex items-center gap-1 text-emerald-600 font-medium">
                                            <CheckCircle2 className="h-3 w-3" /> Comp: {p.hoursReal}h
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

const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;
