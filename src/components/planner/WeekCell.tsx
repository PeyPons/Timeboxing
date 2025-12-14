import { Plus } from 'lucide-react';
import { Allocation } from '@/types';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import AllocationSheet from './AllocationSheet';
import { useState } from 'react';

interface WeekCellProps {
  employeeId: string;
  weekStart: string;
  allocations: Allocation[];
  maxCapacity: number;
}

export default function WeekCell({ employeeId, weekStart, allocations: cellAllocations, maxCapacity }: WeekCellProps) {
  const { projects } = useApp();
  const [isHovered, setIsHovered] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAllocation, setSelectedAllocation] = useState<Allocation | undefined>(undefined);

  // Calcular total de horas para alertas de capacidad
  const totalHours = cellAllocations.reduce((sum, alloc) => sum + alloc.hoursAssigned, 0);
  const isOverCapacity = totalHours > maxCapacity;
  const utilizationPercentage = Math.round((totalHours / maxCapacity) * 100);

  // 1. Agrupar asignaciones por Proyecto
  const allocationsByProject = cellAllocations.reduce((acc, alloc) => {
    const project = projects.find(p => p.id === alloc.projectId);
    const projectName = project ? project.name : 'Sin Proyecto';
    
    if (!acc[projectName]) {
      acc[projectName] = { project, allocations: [] };
    }
    acc[projectName].allocations.push(alloc);
    return acc;
  }, {} as Record<string, { project: any, allocations: Allocation[] }>);

  const handleEdit = (allocation: Allocation) => {
    setSelectedAllocation(allocation);
    setIsDialogOpen(true);
  };

  const handleAddNew = () => {
    setSelectedAllocation(undefined);
    setIsDialogOpen(true);
  };

  return (
    <div 
      className={cn(
        "h-full min-h-[120px] p-1 border-r border-b text-xs relative group transition-colors flex flex-col",
        isOverCapacity ? "bg-red-50 dark:bg-red-900/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Cabecera de la celda con métricas */}
      <div className="flex justify-between items-center mb-1 px-1 h-5">
        {totalHours > 0 && (
          <span className={cn(
            "font-mono font-bold text-[10px]",
            isOverCapacity ? "text-red-600" : "text-slate-500"
          )}>
            {totalHours}h <span className="text-slate-300 font-normal">/ {maxCapacity}h</span>
          </span>
        )}
        
        {/* Botón flotante para añadir (visible en hover o si está vacío) */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <button 
              onClick={handleAddNew}
              className={cn(
                "rounded-full p-0.5 hover:bg-indigo-100 text-indigo-600 transition-opacity",
                isHovered || cellAllocations.length === 0 ? "opacity-100" : "opacity-0"
              )}
            >
              <Plus size={14} />
            </button>
          </DialogTrigger>
          <AllocationSheet 
            isOpen={isDialogOpen} 
            onClose={() => setIsDialogOpen(false)} 
            allocationToEdit={selectedAllocation}
            defaultEmployeeId={employeeId}
            defaultWeek={weekStart}
          />
        </Dialog>
      </div>

      {/* Lista de Proyectos y Tareas */}
      <div className="space-y-2 flex-1 overflow-y-auto max-h-[150px] custom-scrollbar">
        {Object.entries(allocationsByProject).map(([projectName, { allocations }]) => (
          <div key={projectName} className="rounded border border-indigo-100 dark:border-indigo-900/50 bg-white dark:bg-slate-900 overflow-hidden shadow-sm mx-0.5">
            {/* Cabecera del Proyecto */}
            <div className="bg-indigo-50 dark:bg-indigo-950/30 px-2 py-1 border-b border-indigo-100 dark:border-indigo-900/50">
              <span className="font-semibold text-indigo-700 dark:text-indigo-300 truncate block text-[10px] uppercase tracking-wider" title={projectName}>
                {projectName}
              </span>
            </div>
            
            {/* Lista de Tareas debajo del proyecto */}
            <div className="p-1 space-y-0.5">
              {allocations.map(alloc => (
                <div 
                  key={alloc.id} 
                  onClick={() => handleEdit(alloc)}
                  className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-1.5 py-1 flex justify-between items-center group/task transition-colors"
                >
                  <span className="truncate mr-2 text-slate-600 dark:text-slate-400 font-medium" title={alloc.taskName || 'Tarea general'}>
                    {alloc.taskName || 'General'}
                  </span>
                  <span className={cn(
                    "font-mono font-medium text-[10px]",
                    alloc.hoursAssigned > 10 ? "text-amber-600" : "text-slate-500"
                  )}>
                    {alloc.hoursAssigned}h
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      {/* Barra de progreso visual en la parte inferior */}
      {totalHours > 0 && (
        <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-100 mt-auto">
          <div 
            className={cn(
              "h-full transition-all duration-500",
              isOverCapacity ? "bg-red-500" : utilizationPercentage > 80 ? "bg-amber-500" : "bg-green-500"
            )}
            style={{ width: `${Math.min(utilizationPercentage, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
