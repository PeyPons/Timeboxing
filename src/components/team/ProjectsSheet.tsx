import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Project, Allocation, Client } from '@/types';
import { useApp } from '@/contexts/AppContext';
import { Badge } from '@/components/ui/badge';
import { Briefcase, Clock, CalendarDays, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ProjectsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
}

export function ProjectsSheet({ open, onOpenChange, employeeId }: ProjectsSheetProps) {
  const { employees, projects, allocations, clients } = useApp();
  
  const employee = employees.find(e => e.id === employeeId);
  if (!employee) return null;

  // Agrupar asignaciones por proyecto
  const employeeAllocations = allocations.filter(a => a.employeeId === employeeId);
  
  const projectGroups = employeeAllocations.reduce((acc, alloc) => {
      const projId = alloc.projectId;
      if (!acc[projId]) {
          acc[projId] = {
              project: projects.find(p => p.id === projId)!,
              totalEst: 0,
              totalReal: 0,
              totalComp: 0,
              lastTaskDate: alloc.weekStartDate
          };
      }
      // Sumamos todas las asignaciones
      acc[projId].totalEst += alloc.hoursAssigned;
      
      // Real y Computado solo si está completada la tarea
      if (alloc.status === 'completed') {
          acc[projId].totalReal += alloc.hoursActual || 0;
          acc[projId].totalComp += alloc.hoursComputed || 0;
      }
      
      if (alloc.weekStartDate > acc[projId].lastTaskDate) {
          acc[projId].lastTaskDate = alloc.weekStartDate;
      }
      
      return acc;
  }, {} as Record<string, { project: Project, totalEst: number, totalReal: number, totalComp: number, lastTaskDate: string }>);

  const sortedProjects = Object.values(projectGroups).sort((a, b) => b.totalEst - a.totalEst);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-indigo-600" />
            Proyectos Asignados
          </SheetTitle>
          <SheetDescription>
            Historial y carga de trabajo de {employee.name}.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
            {sortedProjects.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground italic border-2 border-dashed rounded-lg">
                    Sin proyectos asignados.
                </div>
            ) : (
                sortedProjects.map((group) => {
                    const client = clients.find(c => c.id === group.project?.clientId);
                    return (
                        <div key={group.project?.id || 'unknown'} className="border rounded-lg p-3 bg-slate-50/50 hover:bg-white transition-colors shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h4 className="font-bold text-sm text-slate-900">{group.project?.name}</h4>
                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: client?.color || '#ccc' }}></span>
                                        {client?.name || 'Sin Cliente'}
                                    </div>
                                </div>
                                <Badge variant="outline" className="text-[10px] font-mono">
                                    Última: {format(new Date(group.lastTaskDate), 'd MMM', { locale: es })}
                                </Badge>
                            </div>

                            <div className="grid grid-cols-3 gap-2 mt-3 pt-2 border-t text-center">
                                <div>
                                    <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">Est.</div>
                                    <div className="font-mono text-sm font-medium">{parseFloat(group.totalEst.toFixed(1))}h</div>
                                </div>
                                <div className="bg-blue-50 rounded py-1">
                                    <div className="text-[10px] text-blue-600 uppercase font-bold tracking-wider mb-0.5">Real</div>
                                    <div className="font-mono text-sm font-bold text-blue-700">{parseFloat(group.totalReal.toFixed(1))}h</div>
                                </div>
                                <div className="bg-emerald-50 rounded py-1">
                                    <div className="text-[10px] text-emerald-600 uppercase font-bold tracking-wider mb-0.5">Comp.</div>
                                    <div className="font-mono text-sm font-bold text-emerald-700">{parseFloat(group.totalComp.toFixed(1))}h</div>
                                </div>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
