import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Briefcase, Clock, CalendarDays, PieChart } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ProjectsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
}

export function ProjectsSheet({ open, onOpenChange, employeeId }: ProjectsSheetProps) {
  const { employees, projects, allocations, clients } = useApp(); // ✅ Importamos clients
  const employee = employees.find(e => e.id === employeeId);

  if (!employee) return null;

  const projectStats = projects.reduce((acc, project) => {
    const empAllocations = allocations.filter(
      a => a.employeeId === employee.id && a.projectId === project.id
    );

    if (empAllocations.length > 0) {
      const totalHours = empAllocations.reduce((sum, a) => sum + a.hoursAssigned, 0);
      const tasks = empAllocations.sort((a, b) => 
        new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime()
      );

      acc.push({ project, totalHours, tasks });
    }
    return acc;
  }, [] as { project: typeof projects[0], totalHours: number, tasks: typeof allocations }[]);

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
                <SheetDescription>Desglose de carga e impacto.</SheetDescription>
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
                    projectStats.map(({ project, totalHours, tasks }) => {
                        // ✅ Cálculos de impacto y Cliente
                        const client = clients.find(c => c.id === project.clientId);
                        const impactPercentage = project.budgetHours > 0 
                            ? Math.min((totalHours / project.budgetHours) * 100, 100) 
                            : 0;

                        return (
                            <div key={project.id} className="border rounded-xl overflow-hidden bg-card shadow-sm">
                                <div className="bg-muted/30 p-3 border-b">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="font-semibold text-sm flex items-center gap-2">
                                                {project.name}
                                            </h3>
                                            {/* ✅ Nombre de cliente con color */}
                                            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: client?.color || '#ccc' }} />
                                                {client?.name || 'Cliente desconocido'}
                                            </p>
                                        </div>
                                        <Badge variant="secondary" className="font-mono">{totalHours}h</Badge>
                                    </div>

                                    {/* ✅ Barra de Impacto */}
                                    <div className="bg-white/50 dark:bg-black/20 rounded-md p-2 text-xs flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-1.5 text-muted-foreground">
                                            <PieChart className="h-3.5 w-3.5" />
                                            <span>Tu impacto:</span>
                                        </div>
                                        <div className="flex items-center gap-2 flex-1 justify-end">
                                            <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-indigo-500 rounded-full" 
                                                    style={{ width: `${impactPercentage}%` }} 
                                                />
                                            </div>
                                            <span className="font-bold min-w-[3ch] text-right">{impactPercentage.toFixed(0)}%</span>
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-right text-muted-foreground mt-1">
                                        de {project.budgetHours}h totales del proyecto
                                    </div>
                                </div>

                                <div className="divide-y divide-border/50">
                                    {tasks.slice(0, 5).map(task => (
                                        <div key={task.id} className="p-3 hover:bg-muted/20 transition-colors flex justify-between items-center gap-3">
                                            <div className="min-w-0">
                                                <p className="text-xs font-medium truncate">{task.taskName || 'Tarea General'}</p>
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
                                        <div className="p-2 text-center text-[10px] text-muted-foreground bg-muted/20">+ {tasks.length - 5} tareas más...</div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
