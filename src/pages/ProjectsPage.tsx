import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format, addMonths, subMonths, isSameMonth, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  FolderKanban, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  CalendarDays, 
  Briefcase, 
  User,
  LayoutList
} from 'lucide-react';

export default function ProjectsPage() {
  const { projects, clients, allocations, employees, getProjectHoursForMonth } = useApp();
  
  // Estado para la navegación mensual
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const handlePrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const handleToday = () => setCurrentMonth(new Date());

  // Filtramos solo proyectos activos para no ensuciar la vista
  const activeProjects = projects.filter(p => p.status === 'active');

  return (
    <div className="flex flex-col h-full space-y-6 p-6 md:p-8 max-w-7xl mx-auto w-full">
      
      {/* --- CABECERA Y NAVEGACIÓN --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <FolderKanban className="h-8 w-8 text-indigo-600" />
            Proyectos y Tareas
          </h1>
          <p className="text-muted-foreground">
            Auditoría de tareas y consumo de horas por proyecto.
          </p>
        </div>

        {/* Controles de Mes */}
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
            <Button variant="ghost" size="sm" onClick={handleToday} className="text-xs">
                Hoy
            </Button>
        </div>
      </div>

      {/* --- LISTADO DE PROYECTOS --- */}
      <div className="grid gap-6">
        {activeProjects.map((project) => {
          const client = clients.find(c => c.id === project.clientId);
          
          // Obtenemos métricas del mes seleccionado
          const stats = getProjectHoursForMonth(project.id, currentMonth);
          
          // Filtramos las tareas de ESTE mes para ESTE proyecto
          // Usamos la lógica de Storage Key: si la fecha de inicio de la tarea cae en el mes visualizado
          const monthTasks = allocations.filter(a => {
             const taskDate = parseISO(a.weekStartDate);
             return a.projectId === project.id && isSameMonth(taskDate, currentMonth);
          });

          // Si no hay tareas y el proyecto no tiene horas este mes, podemos optar por mostrarlo "apagado" o normal.
          const hasActivity = monthTasks.length > 0;

          return (
            <Card key={project.id} className={`overflow-hidden transition-all ${hasActivity ? 'border-indigo-100 shadow-md' : 'opacity-80 border-dashed'}`}>
              <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 pb-4">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                    
                    {/* Info Proyecto */}
                    <div className="flex items-start gap-4">
                        <div className="h-10 w-10 rounded-lg bg-white border flex items-center justify-center shadow-sm">
                            <Briefcase className="h-5 w-5 text-slate-500" />
                        </div>
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                                {project.name}
                                <Badge variant="outline" className="font-normal text-xs bg-white">
                                    <span className="w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: client?.color || '#ccc' }} />
                                    {client?.name || 'Sin Cliente'}
                                </Badge>
                            </CardTitle>
                            <CardDescription className="mt-1 flex items-center gap-4 text-xs">
                                <span>Presupuesto Total: {project.budgetHours}h</span>
                                {hasActivity ? (
                                    <span className="text-green-600 font-medium flex items-center gap-1">
                                        <Clock className="h-3 w-3" /> Activo este mes
                                    </span>
                                ) : (
                                    <span>Sin actividad en {format(currentMonth, 'MMMM', { locale: es })}</span>
                                )}
                            </CardDescription>
                        </div>
                    </div>

                    {/* Métricas del Mes */}
                    <div className="min-w-[200px] flex flex-col justify-center gap-2">
                        <div className="flex justify-between text-xs font-medium">
                            <span>Consumo {format(currentMonth, 'MMM', { locale: es })}</span>
                            <span>{stats.used}h</span>
                        </div>
                        <Progress value={stats.percentage} className={`h-2 ${stats.percentage > 100 ? '[&>div]:bg-red-500' : '[&>div]:bg-indigo-500'}`} />
                        <div className="text-[10px] text-muted-foreground text-right">
                            {stats.available}h restantes del total
                        </div>
                    </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {hasActivity ? (
                    <div className="divide-y">
                        <div className="bg-slate-50 px-6 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex">
                            <div className="flex-1">Tarea / Descripción</div>
                            <div className="w-40">Empleado</div>
                            <div className="w-32">Semana</div>
                            <div className="w-20 text-right">Horas</div>
                        </div>
                        
                        {/* Listado de Tareas */}
                        {monthTasks.sort((a, b) => new Date(a.weekStartDate).getTime() - new Date(b.weekStartDate).getTime()).map(task => {
                            const emp = employees.find(e => e.id === task.employeeId);
                            return (
                                <div key={task.id} className="px-6 py-3 flex items-center gap-4 hover:bg-slate-50/50 transition-colors text-sm">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">{task.taskName || 'Sin nombre'}</p>
                                        {task.description && <p className="text-xs text-muted-foreground truncate">{task.description}</p>}
                                    </div>
                                    
                                    <div className="w-40 flex items-center gap-2">
                                        <Avatar className="h-6 w-6">
                                            <AvatarImage src={emp?.avatarUrl} />
                                            <AvatarFallback className="text-[10px]">{emp?.name.substring(0,2).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <span className="text-xs truncate">{emp?.name || 'Desconocido'}</span>
                                    </div>

                                    <div className="w-32 text-xs text-muted-foreground flex items-center gap-1">
                                        <CalendarDays className="h-3 w-3" />
                                        {format(parseISO(task.weekStartDate), 'd MMM', { locale: es })}
                                    </div>

                                    <div className="w-20 text-right font-mono font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded text-xs">
                                        {task.hoursAssigned}h
                                    </div>
                                </div>
                            );
                        })}
                        
                        {/* Footer del Proyecto */}
                        <div className="bg-slate-50/80 px-6 py-3 border-t flex justify-end">
                            <div className="text-sm font-medium">
                                Total {format(currentMonth, 'MMMM', { locale: es })}: <span className="text-indigo-600 font-bold ml-1">{stats.used}h</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="py-8 text-center flex flex-col items-center justify-center text-muted-foreground gap-2">
                        <div className="h-10 w-10 bg-slate-50 rounded-full flex items-center justify-center mb-1">
                            <LayoutList className="h-5 w-5 text-slate-300" />
                        </div>
                        <p className="text-sm">No hay tareas registradas para este proyecto en {format(currentMonth, 'MMMM', { locale: es })}.</p>
                    </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {activeProjects.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
                No tienes proyectos activos. Ve a "Clientes" para crear uno.
            </div>
        )}
      </div>
    </div>
  );
}
