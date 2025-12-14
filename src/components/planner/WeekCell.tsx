import { Allocation, LoadStatus } from '@/types';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Clock, AlertCircle } from 'lucide-react';

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

const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

export function WeekCell({ allocations, hours, capacity, status, isCurrentWeek, onClick }: WeekCellProps) {
  
  // 1. Calcular métricas de la celda
  const totalEstimated = round2(allocations.reduce((sum, a) => sum + Number(a.hoursAssigned || 0), 0));
  
  // Computado: Solo sumamos si la tarea tiene horas computadas (aunque no esté "completed" si quieres ir viendo progreso, o solo cerradas)
  // Generalmente se suma lo que haya en 'hoursActual'.
  const totalComputed = round2(allocations.reduce((sum, a) => sum + Number(a.hoursActual || 0), 0));
  
  // Balance: Positivo = Ahorro (Verde), Negativo = Desvío (Rojo)
  // Solo calculamos balance sobre tareas que tengan algo computado para no falsear datos
  const activeAllocations = allocations.filter(a => (a.hoursActual || 0) > 0);
  
  let balance = 0;
  if (activeAllocations.length > 0) {
      const est = activeAllocations.reduce((sum, a) => sum + Number(a.hoursAssigned), 0);
      const comp = activeAllocations.reduce((sum, a) => sum + Number(a.hoursActual), 0);
      balance = round2(est - comp);
  }

  const hasActivity = allocations.length > 0;
  const isOverload = status === 'overload';

  return (
    <div onClick={onClick} className={cn(
      "h-full min-h-[120px] p-2 transition-all cursor-pointer border border-transparent hover:border-indigo-300 rounded-md relative flex flex-col justify-between",
      isCurrentWeek ? "bg-white shadow-sm" : "bg-slate-50/50 hover:bg-white",
      !hasActivity && "opacity-60 hover:opacity-100"
    )}>
      {/* Semáforo de Estado General */}
      <div className={cn("absolute top-1 right-1 w-2 h-2 rounded-full",
          status === 'overload' ? "bg-red-500" :
          status === 'warning' ? "bg-amber-400" :
          status === 'healthy' ? "bg-green-400" : "bg-slate-200"
      )} />

      {hasActivity ? (
        <div className="flex flex-col gap-2 mt-1">
            {/* Bloque Estimado */}
            <div className="flex justify-between items-center text-xs text-slate-500">
                <span>Estimado</span>
                <span className="font-mono font-medium">{totalEstimated}h</span>
            </div>

            {/* Bloque Computado */}
            <div className="flex justify-between items-center text-xs text-slate-700">
                <span className="font-medium">Computado</span>
                <span className="font-mono font-bold">{totalComputed}h</span>
            </div>

            {/* Bloque Balance (Solo si hay actividad real) */}
            {totalComputed > 0 && (
                <div className={cn(
                    "flex justify-between items-center text-[10px] px-1.5 py-0.5 rounded border",
                    balance >= 0 ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
                )}>
                    <span className="flex items-center gap-1">
                        {balance >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {balance >= 0 ? "Ahorro" : "Desvío"}
                    </span>
                    <span className="font-mono font-bold">{balance > 0 ? '+' : ''}{balance}h</span>
                </div>
            )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
            <span className="text-[10px] text-slate-300 uppercase tracking-widest font-medium">Libre</span>
        </div>
      )}

      {/* Footer Celda: Carga vs Capacidad */}
      <div className="mt-auto pt-2 border-t flex justify-end">
         <div className={cn(
             "text-xs font-bold flex items-center gap-1",
             isOverload ? "text-red-600" : "text-slate-600"
         )}>
             {isOverload && <AlertCircle className="h-3 w-3" />}
             {hours}/{capacity}h
         </div>
      </div>
    </div>
  );
}
