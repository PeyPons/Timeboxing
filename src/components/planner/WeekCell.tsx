import { Allocation, LoadStatus } from '@/types';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, AlertCircle, AlertTriangle, Palmtree, CalendarOff, Zap, CheckCircle2 } from 'lucide-react';

interface WeekCellProps {
  allocations: Allocation[];
  hours: number; // Carga calculada (Real o Est según estado)
  capacity: number;
  status: LoadStatus;
  percentage: number;
  isCurrentWeek: boolean;
  baseCapacity: number;
  breakdown: { reason: string; hours: number; type: 'absence' | 'event' }[];
  onClick: () => void;
}

const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

export function WeekCell({ allocations, hours, capacity, status, isCurrentWeek, breakdown, onClick }: WeekCellProps) {
  
  // 1. Calcular métricas internas para visualización detallada
  const totalEst = round2(allocations.reduce((sum, a) => sum + (a.hoursAssigned || 0), 0));
  
  // Solo tareas completadas suman a Real y Computado visualmente aquí
  const completedTasks = allocations.filter(a => a.status === 'completed');
  const totalReal = round2(completedTasks.reduce((sum, a) => sum + (a.hoursActual || 0), 0));
  const totalComp = round2(completedTasks.reduce((sum, a) => sum + (a.hoursComputed || 0), 0));
  
  // Balance: (Lo que cobro - Lo que tardo). Si cobro más de lo que tardo = Ahorro/Ganancia.
  const balance = round2(totalComp - totalReal);
  const hasActivity = allocations.length > 0;
  
  // Semáforo de carga (basado en hours/capacity recibidos del padre para consistencia)
  const isOverload = hours > capacity && capacity > 0; // Simple sobrecarga
  const isUnderload = hours < (capacity * 0.8) && capacity > 0; // Menos del 80%
  const hasReductions = breakdown && breakdown.length > 0;

  return (
    <div onClick={onClick} className={cn(
      "h-full min-h-[140px] p-2 transition-all cursor-pointer border border-transparent hover:border-indigo-300 rounded-md relative flex flex-col group",
      isCurrentWeek ? "bg-white shadow-sm" : "bg-slate-50/50 hover:bg-white",
      !hasActivity && !hasReductions && "opacity-60 hover:opacity-100"
    )}>
      {/* Semáforo (Puntito) */}
      <div className={cn("absolute top-1.5 right-1.5 w-2 h-2 rounded-full transition-colors",
          status === 'overload' ? "bg-red-500" :
          status === 'warning' ? "bg-amber-400" :
          isUnderload ? "bg-amber-200" : "bg-emerald-400"
      )} />

      {/* --- SECCIÓN DATOS --- */}
      {hasActivity ? (
        <div className="flex flex-col gap-1.5 mt-1 flex-1">
            {/* Fila Estimado */}
            <div className="flex justify-between items-center text-[10px] text-slate-500">
                <span className="font-medium">Est.</span>
                <span className="font-mono">{totalEst}h</span>
            </div>

            {/* Fila Real/Comp solo si hay completadas, si no, solo mostramos Est */}
            {completedTasks.length > 0 && (
                <>
                    <div className="flex justify-between items-center text-[10px] text-blue-600">
                        <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> Real</span>
                        <span className="font-mono">{totalReal}h</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-emerald-600">
                        <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Comp.</span>
                        <span className="font-mono font-bold">{totalComp}h</span>
                    </div>
                </>
            )}

            {/* Badge de Balance (Rentabilidad) */}
            {completedTasks.length > 0 && Math.abs(balance) > 0.01 && (
                <div className={cn(
                    "flex justify-between items-center text-[9px] px-1.5 py-0.5 rounded border mt-auto mb-1",
                    balance >= 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
                )}>
                    <span className="flex items-center gap-1 font-medium">
                        {balance >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {balance >= 0 ? "Ganancia" : "Pérdida"}
                    </span>
                    <span className="font-mono font-bold">{balance > 0 ? '+' : ''}{balance}h</span>
                </div>
            )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center pt-2 min-h-[60px]">
            {!hasReductions && <span className="text-[10px] text-slate-300 uppercase tracking-widest font-medium">Libre</span>}
        </div>
      )}

      {/* --- SECCIÓN REDUCCIONES (Ausencias/Eventos) --- */}
      {hasReductions && (
        <div className="my-1 space-y-1">
            {breakdown.map((item, idx) => (
                <div key={idx} className={cn(
                    "flex justify-between items-center text-[9px] px-1.5 py-0.5 rounded border",
                    item.type === 'absence' ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200"
                )}>
                    <span className="flex items-center gap-1 truncate max-w-[80px]">
                        {item.type === 'absence' ? <Palmtree className="h-3 w-3" /> : <CalendarOff className="h-3 w-3" />}
                        <span className="truncate" title={item.reason}>{item.reason.replace('Ausencia: ', '').replace('Evento: ', '')}</span>
                    </span>
                    <span className="font-mono font-bold whitespace-nowrap">-{item.hours}h</span>
                </div>
            ))}
        </div>
      )}

      {/* --- FOOTER (Carga Real) --- */}
      <div className="mt-auto pt-1.5 border-t flex justify-end">
         <div className={cn(
             "text-[10px] font-bold flex items-center gap-1.5 transition-colors duration-300",
             status === 'overload' ? "text-red-600" : 
             status === 'warning' ? "text-amber-600" : 
             "text-slate-400"
         )}>
             {status === 'overload' && <AlertCircle className="h-3 w-3" />}
             {status === 'warning' && <AlertTriangle className="h-3 w-3" />} 
             {hours}/{capacity}h
         </div>
      </div>
    </div>
  );
}
