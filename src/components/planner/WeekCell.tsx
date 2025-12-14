import { cn } from '@/lib/utils';
import { Allocation, LoadStatus } from '@/types';
import { Plus } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';

interface WeekCellProps {
  // Cambiamos las props para recibir las asignaciones reales, no solo el resumen
  allocations: Allocation[]; 
  hours: number;
  capacity: number;
  status: LoadStatus;
  isCurrentWeek?: boolean;
  onClick?: () => void;
}

export function WeekCell({ 
  allocations,
  hours, 
  capacity, 
  status, 
  isCurrentWeek, 
  onClick 
}: WeekCellProps) {
  const { projects } = useApp();

  // Agrupar por Proyecto
  const grouped = allocations.reduce((acc, alloc) => {
    const projName = projects.find(p => p.id === alloc.projectId)?.name || 'Sin Proyecto';
    if (!acc[projName]) acc[projName] = [];
    acc[projName].push(alloc);
    return acc;
  }, {} as Record<string, Allocation[]>);

  const hasContent = allocations.length > 0;

  return (
    <div 
      onClick={onClick}
      className={cn(
        "h-full min-h-[100px] p-1 border-l transition-all cursor-pointer relative group flex flex-col gap-1",
        isCurrentWeek ? "bg-indigo-50/30 dark:bg-indigo-900/10" : "",
        status === 'overload' ? "bg-red-50/50 dark:bg-red-900/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
      )}
    >
        {/* Cabecera de la celda (Capacidad) */}
        <div className="flex justify-between items-center px-1 mb-1">
            <span className={cn("text-[10px] font-mono", 
                status === 'overload' ? "text-red-600 font-bold" : 
                status === 'warning' ? "text-amber-600 font-medium" : "text-slate-400"
            )}>
                {hours > 0 ? `${hours}/${capacity}` : '-'}
            </span>
            {/* Botón flotante (+) solo visible en hover */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-100 text-indigo-600 rounded-full p-0.5">
                <Plus size={12} />
            </div>
        </div>

        {/* Lista de Proyectos y Tareas */}
        <div className="flex-1 space-y-2 overflow-hidden">
            {Object.entries(grouped).map(([projName, projAllocations]) => (
                <div key={projName} className="bg-white dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                    {/* Nombre del Proyecto (Arriba) */}
                    <div className="bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tight truncate block">
                            {projName}
                        </span>
                    </div>
                    {/* Lista de Tareas (Debajo) */}
                    <div className="px-1 py-0.5 space-y-0.5">
                        {projAllocations.map(alloc => (
                            <div key={alloc.id} className="flex justify-between items-center text-[10px]">
                                <span className="truncate text-slate-500 max-w-[70%]" title={alloc.taskName}>
                                    {alloc.taskName || 'General'}
                                </span>
                                <span className="font-mono text-slate-400">{alloc.hoursAssigned}h</span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
            
            {!hasContent && (
                <div className="h-full flex items-center justify-center">
                    <span className="text-slate-200 text-lg group-hover:text-slate-300">+</span>
                </div>
            )}
        </div>
    </div>
  );
}
