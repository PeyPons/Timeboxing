import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Briefcase, Clock, CalendarDays } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Employee } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ProjectsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
}

export function ProjectsSheet({ open, onOpenChange, employeeId }: ProjectsSheetProps) {
  const { employees, projects, allocations } = useApp();
  const employee = employees.find(e => e.id === employeeId);

  if (!employee) return null;

  // Agrupar asignaciones por proyecto
  const projectStats = projects.reduce((acc, project) => {
    // Filtrar asignaciones de este empleado en este proyecto
    const empAllocations = allocations.filter(
      a => a.employeeId === employeeId && a.projectId === project.id
    );

    if (empAllocations.length > 0) {
      const totalHours = empAllocations.reduce((sum, a) => sum + a.hoursAssigned, 0);
      
      // Ordenar tareas por fecha (más reciente primero)
      const tasks = empAllocations.sort((a, b) => 
        new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime()
      );

      acc.push({
        project,
        totalHours,
        tasks
      });
    }
    return acc;
  }, [] as { project: typeof projects[0], totalHours: number, tasks: typeof allocations }[]);

  // Ordenar proyectos por horas totales (descendente)
  projectStats.sort((a, b) => b.totalHours - a.totalHours);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col h-full">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                {employee.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
                <SheetTitle>Proyectos Asignados</SheetTitle>
                <SheetDescription>
                    Desglose de carga por proyecto
                </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-6 py-6">
                {projectStats.length === 0 ? (
                    <div className="text-center text-muted-foreground py-10 flex flex-col items-center gap-3">
                        <div className="bg-slate-100 p-4 rounded-full">
                            <Briefcase className="h-8 w-8 text-slate-300" />
                        </div>
                        <p>No hay proyectos asignados actualmente.</p>
                    </div>
                ) : (
                    projectStats.map(({ project, totalHours, tasks }) => (
                        <div key={project.id} className="border rounded-xl overflow-hidden bg-card shadow-sm">
                            {/* Cabecera Proyecto */}
                            <div className="bg-muted/40 p-3 border-b flex justify-between items-start">
                                <div>
                                    <h3 className="font-semibold text-sm flex items-center gap-2">
                                        {project.name}
                                        {project.status === 'active' && <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />}
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">Cliente: {project.clientId}</p>
                                </div>
                                <Badge variant="secondary" className="font-mono">
                                    {totalHours}h
                                </Badge>
                            </div>

                            {/* Lista de Tareas (Últimas 5) */}
                            <div className="divide-y divide-border/50">
                                {tasks.slice(0, 5).map(task => (
                                    <div key={task.id} className="p-3 hover:bg-muted/20 transition-colors flex justify-between items-center gap-3">
                                        <div className="min-w-0">
                                            <p className="text-xs font-medium truncate">
                                                {task.taskName || 'Tarea General'}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <CalendarDays className="h-3 w-3" />
                                                    {format(new Date(task.weekStartDate), 'd MMM', { locale: es })}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-xs font-mono text-slate-600 dark:text-slate-300">
                                            <Clock className="h-3 w-3" />
                                            {task.hoursAssigned}h
                                        </div>
                                    </div>
                                ))}
                                {tasks.length > 5 && (
                                    <div className="p-2 text-center text-[10px] text-muted-foreground bg-muted/20">
                                        + {tasks.length - 5} tareas más...
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
