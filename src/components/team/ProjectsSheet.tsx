import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Project, Allocation, Client } from '@/types';
import { useApp } from '@/contexts/AppContext';
import { Badge } from '@/components/ui/badge';
import { Briefcase, CheckCircle2, TrendingUp, TrendingDown, Zap, PieChart } from 'lucide-react';
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

  // 1. Agrupar asignaciones por proyecto para este empleado
  const employeeAllocations = allocations.filter(a => a.employeeId === employeeId);
  
  const projectGroups = employeeAllocations.reduce((acc, alloc) => {
      const projId = alloc.projectId;
      if (!acc[projId]) {
          acc[projId] = {
              project: projects.find(p => p.id === projId)!,
              totalEst: 0,
              totalReal: 0,
              totalComp: 0,
          };
      }
      
      acc[projId].totalEst += alloc.hoursAssigned;
      
      // Solo sumamos Real y Computado si está completada (Lógica Honesta)
      if (alloc.status === 'completed') {
          acc[projId].totalReal += alloc.hoursActual || 0;
          acc[projId].totalComp += alloc.hoursComputed || 0;
      }
      
      return acc;
  }, {} as Record<string, { project: Project, totalEst: number, totalReal: number, totalComp: number }>);

  // Ordenar por volumen de horas estimadas
  const sortedProjects = Object.values(projectGroups).sort((a, b) => b.totalEst - a.totalEst);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-slate-50/50">
        <SheetHeader className="mb-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-3 text-xl">
            <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-base border border-indigo-200 shadow-sm">
                {employee.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
                <div className="text-base font-bold text-slate-900">Proyectos Asignados</div>
                <div className="text-xs font-normal text-muted-foreground flex items-center gap-1">
                    <Briefcase className="h-3 w-3" /> {sortedProjects.length} proyectos activos
                </div>
            </div>
          </SheetTitle>
          <SheetDescription>
            Análisis de impacto y rentabilidad por proyecto.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 pb-10">
            {sortedProjects.length === 0 ? (
                <div className="text-center py-12 flex flex-col items-center justify-center text-muted-foreground italic border-2 border-dashed rounded-xl bg-white">
                    <Briefcase className="h-10 w-10 mb-2 opacity-20" />
                    <p>Sin proyectos asignados.</p>
                </div>
            ) : (
                sortedProjects.map((group) => {
                    const client = clients.find(c => c.id === group.project?.clientId);
                    // Cálculo de Beneficio (Gain) para el empleado
                    const gain = round2(group.totalComp - group.totalReal);
                    
                    // CÁLCULO DE IMPACTO (% sobre el total del proyecto global)
                    // 1. Buscamos TODAS las asignaciones de este proyecto (de todos los empleados)
                    const allProjectAllocations = allocations.filter(a => a.projectId === group.project?.id && a.status === 'completed');
                    const globalProjectComputed = allProjectAllocations.reduce((sum, a) => sum + (a.hoursComputed || 0), 0);
                    
                    // 2. Calculamos % de impacto (Mi Computado / Computado Global)
                    const impactPercentage = globalProjectComputed > 0 
                        ? round2((group.totalComp / globalProjectComputed) * 100) 
                        : 0;

                    return (
                        <div key={group.project?.id || 'unknown'} className="border rounded-xl bg-white shadow-sm overflow-hidden hover:shadow-md transition-all group">
                            {/* Cabecera Tarjeta */}
                            <div className="p-3 border-b flex justify-between items-start bg-white">
                                <div className="space-y-1 min-w-0 pr-2">
                                    <h4 className="font-bold text-sm text-slate-900 leading-tight truncate">{group.project?.name}</h4>
                                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: client?.color || '#cbd5e1' }}></span>
                                        <span className="truncate max-w-[120px]">{client?.name || 'Sin Cliente'}</span>
                                    </div>
                                </div>
                                
                                {/* Badge de IMPACTO (Nuevo) */}
                                <div className="flex flex-col items-end gap-1">
                                    <Badge variant="secondary" className="text-[10px] h-5 bg-indigo-50 text-indigo-700 border-indigo-100 flex gap-1">
                                        <PieChart className="h-3 w-3" /> Impacto: {impactPercentage}%
                                    </Badge>
                                </div>
                            </div>

                            {/* Grid de Datos */}
                            <div className="grid grid-cols-3 divide-x divide-slate-100 bg-slate-50/30">
                                <div className="p-2 text-center">
                                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Est.</div>
                                    <div className="font-mono text-sm font-medium text-slate-700">{round2(group.totalEst)}h</div>
                                </div>
                                <div className="p-2 text-center bg-blue-50/20">
                                    <div className="text-[9px] text-blue-600 font-bold uppercase tracking-wider mb-0.5 flex items-center justify-center gap-1">
                                        <Zap className="h-3 w-3" /> Real
                                    </div>
                                    <div className="font-mono text-sm font-bold text-blue-700">{round2(group.totalReal)}h</div>
                                </div>
                                <div className="p-2 text-center bg-emerald-50/20">
                                    <div className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider mb-0.5 flex items-center justify-center gap-1">
                                        <CheckCircle2 className="h-3 w-3" /> Comp
                                    </div>
                                    <div className="font-mono text-sm font-bold text-emerald-700">{round2(group.totalComp)}h</div>
                                </div>
                            </div>
                            
                            {/* Footer Ganancia/Pérdida (Sustituye a Neutro/Fecha) */}
                            <div className={cn("px-3 py-1.5 border-t text-[10px] flex justify-between items-center font-medium", 
                                gain > 0 ? "bg-emerald-50/50 text-emerald-700" : 
                                gain < 0 ? "bg-red-50/50 text-red-700" : "bg-slate-50 text-slate-500"
                            )}>
                                <span className="uppercase tracking-wider">Balance</span>
                                <span className="flex items-center gap-1 font-mono text-xs">
                                    {gain > 0 ? <TrendingUp className="h-3 w-3" /> : gain < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                                    {gain > 0 ? '+' : ''}{gain}h
                                </span>
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
