import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Project, Allocation, Client } from '@/types';
import { useApp } from '@/contexts/AppContext';
import { Badge } from '@/components/ui/badge';
import { Briefcase, Clock, CalendarDays, CheckCircle2, TrendingUp, TrendingDown, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ProjectsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
}

const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

export function ProjectsSheet({ open, onOpenChange, employeeId }: ProjectsSheetProps) {
  const { employees, projects, allocations, clients } = useApp();
  
  const employee = employees.find(e => e.id === employeeId);
  if (!employee) return null;

  // 1. Agrupar asignaciones por proyecto
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
      
      // Sumamos Estimado siempre
      acc[projId].totalEst += alloc.hoursAssigned;
      
      // Real y Computado solo si la tarea está completada (Lógica "Honesta")
      if (alloc.status === 'completed') {
          acc[projId].totalReal += alloc.hoursActual || 0;
          acc[projId].totalComp += alloc.hoursComputed || 0;
      }
      
      if (alloc.weekStartDate > acc[projId].lastTaskDate) {
          acc[projId].lastTaskDate = alloc.weekStartDate;
      }
      
      return acc;
  }, {} as Record<string, { project: Project, totalEst: number, totalReal: number, totalComp: number, lastTaskDate: string }>);

  // Ordenar por volumen de horas estimadas (mayor a menor)
  const sortedProjects = Object.values(projectGroups).sort((a, b) => b.totalEst - a.totalEst);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm border border-indigo-200">
                {employee.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
                <div className="text-base font-bold">Proyectos Asignados</div>
                <div className="text-xs font-normal text-muted-foreground">{employee.name}</div>
            </div>
          </SheetTitle>
          <SheetDescription>
            Desglose de carga de trabajo y rentabilidad por proyecto.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 pb-10">
            {sortedProjects.length === 0 ? (
                <div className="text-center py-12 flex flex-col items-center justify-center text-muted-foreground italic border-2 border-dashed rounded-xl bg-slate-50/50">
                    <Briefcase className="h-10 w-10 mb-2 opacity-20" />
                    <p>Sin proyectos asignados actualmente.</p>
                </div>
            ) : (
                sortedProjects.map((group) => {
                    const client = clients.find(c => c.id === group.project?.clientId);
                    // Cálculo de Beneficio (Gain)
                    const gain = round2(group.totalComp - group.totalReal);
                    
                    return (
                        <div key={group.project?.id || 'unknown'} className="border rounded-xl bg-white shadow-sm overflow-hidden hover:shadow-md transition-all">
                            {/* Cabecera Tarjeta */}
                            <div className="p-3 bg-slate-50/50 border-b flex justify-between items-start">
                                <div className="space-y-1">
                                    <h4 className="font-bold text-sm text-slate-900 leading-tight">{group.project?.name}</h4>
                                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: client?.color || '#cbd5e1' }}></span>
                                        <span className="truncate max-w-[150px]">{client?.name || 'Sin Cliente'}</span>
                                    </div>
                                </div>
                                
                                {/* Badge de Estado/Ganancia */}
                                {Math.abs(gain) > 0.01 ? (
                                    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border-0 flex items-center gap-1 h-5", gain > 0 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800")}>
                                        {gain > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                        {gain > 0 ? '+' : ''}{gain}h
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="text-[10px] h-5 bg-white text-slate-500">Neutro</Badge>
                                )}
                            </div>

                            {/* Grid de Datos */}
                            <div className="grid grid-cols-3 divide-x divide-slate-100">
                                <div className="p-2 text-center">
                                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Est.</div>
                                    <div className="font-mono text-sm font-medium text-slate-700">{round2(group.totalEst)}h</div>
                                </div>
                                <div className="p-2 text-center bg-blue-50/30">
                                    <div className="text-[9px] text-blue-600 font-bold uppercase tracking-wider mb-0.5 flex items-center justify-center gap-1">
                                        <Zap className="h-2.5 w-2.5" /> Real
                                    </div>
                                    <div className="font-mono text-sm font-bold text-blue-700">{round2(group.totalReal)}h</div>
                                </div>
                                <div className="p-2 text-center bg-emerald-50/30">
                                    <div className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider mb-0.5 flex items-center justify-center gap-1">
                                        <CheckCircle2 className="h-2.5 w-2.5" /> Comp
                                    </div>
                                    <div className="font-mono text-sm font-bold text-emerald-700">{round2(group.totalComp)}h</div>
                                </div>
                            </div>
                            
                            {/* Footer fecha */}
                            <div className="px-3 py-1.5 bg-slate-50 border-t text-[10px] text-right text-slate-400 flex justify-between items-center">
                                <span>Actividad reciente</span>
                                <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {format(new Date(group.lastTaskDate), 'd MMM yyyy', { locale: es })}</span>
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
