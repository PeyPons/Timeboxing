import { Allocation, LoadStatus } from '@/types';
import { cn } from '@/lib/utils';
import { Check, AlertCircle } from 'lucide-react';

interface WeekCellProps {
  allocations: Allocation[];
  hours: number;
  capacity: number;
  status: LoadStatus;
  percentage: number;
  isCurrentWeek: boolean;
  hasAbsence: boolean;
  absenceHours: number;
  baseCapacity: number;
  onClick: () => void;
}

export function WeekCell({ allocations, hours, capacity, status, isCurrentWeek, onClick }: WeekCellProps) {
  
  const tasksPreview = allocations.slice(0, 3);
  const hiddenCount = Math.max(0, allocations.length - 3);

  return (
    <div onClick={onClick} className={cn(
      "h-full min-h-[120px] p-2 transition-all cursor-pointer border border-transparent hover:border-indigo-300 rounded-md relative flex flex-col gap-1",
      isCurrentWeek ? "bg-white shadow-sm" : "bg-slate-50/50 hover:bg-white"
    )}>
      <div className={cn("absolute top-1 right-1 w-2 h-2 rounded-full",
          status === 'overload' ? "bg-red-500" :
          status === 'warning' ? "bg-amber-400" :
          status === 'healthy' ? "bg-green-400" : "bg-slate-200"
      )} />

      <div className="flex-1 flex flex-col gap-1 mt-1">
        {tasksPreview.map(task => {
            const isCompleted = task.status === 'completed';
            const estimated = task.hoursAssigned;
            const actual = task.hoursActual || 0;
            
            // ✅ LOGICA DE SEMÁFORO EN TAREA
            const isOverBudget = isCompleted && actual > estimated;
            const hoursToShow = (isCompleted && actual > 0) ? actual : estimated;

            return (
                <div key={task.id} className={cn(
                    "text-[10px] px-1.5 py-1 rounded border flex justify-between items-center gap-1",
                    isCompleted ? "bg-slate-100 text-slate-500 border-slate-200" : "bg-white border-slate-100 shadow-sm",
                    isOverBudget && "bg-red-50 border-red-200 text-red-700"
                )}>
                    <span className="truncate flex-1 font-medium">{task.taskName || 'Tarea'}</span>
                    
                    <span className={cn(
                        "font-mono font-bold ml-1",
                        isOverBudget && "text-red-600"
                    )}>
                        {hoursToShow}h
                        {isOverBudget && <span className="ml-0.5 text-[8px] font-bold">!</span>}
                    </span>
                </div>
            );
        })}
        {hiddenCount > 0 && <div className="text-[9px] text-center text-muted-foreground">+{hiddenCount} más</div>}
      </div>

      <div className="mt-auto text-right border-t pt-1">
         <span className={cn(
             "text-xs font-bold",
             status === 'overload' ? "text-red-600" : "text-slate-600"
         )}>
             {hours}/{capacity}h
         </span>
      </div>
    </div>
  );
}
