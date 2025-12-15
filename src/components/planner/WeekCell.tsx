import { Allocation, LoadStatus } from '@/types';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, AlertCircle, AlertTriangle, Palmtree, CalendarOff, Zap, CheckCircle2 } from 'lucide-react';

interface WeekCellProps {
  allocations: Allocation[];
  hours: number;
  capacity: number;
  status: LoadStatus;
  percentage: number;
  isCurrentWeek: boolean;
  baseCapacity: number;
  breakdown: { reason: string; hours: number; type: 'absence' | 'event' }[];
  onClick: () => void;
}

const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

export function WeekCell({ allocations, hours, capacity, isCurrentWeek, breakdown, onClick }: WeekCellProps) {
  
  const totalEst = round2(allocations.reduce((sum, a) => sum + (a.hoursAssigned || 0), 0));
  
  const completedTasks = allocations.filter(a => a.status === 'completed');
  const totalReal = round2(completedTasks.reduce((sum, a) => sum + (a.hoursActual || 0), 0));
  const totalComp = round2(completedTasks.reduce((sum, a) => sum + (a.hoursComputed || 0), 0));
  
  const balance = round2(totalComp - totalReal);
  const hasActivity = allocations.length > 0;
  
  // Lógica Semáforo (90-110%)
  const ratio = capacity > 0 ? (hours / capacity) : 0;
  const isOverload = ratio > 1.1;       
  const isUnderload = ratio < 0.9 && capacity > 0; 
  const isHealthy = ratio >= 0.9 && ratio <= 1.1 && capacity > 0;

  const hasReductions = breakdown && breakdown.length > 0;

  return (
    <div onClick={onClick} className={cn(
      "h-full min-h-[140px] p-2 transition-all cursor-pointer border rounded-md relative flex flex-col group tabular-nums",
      // HEATMAP DE FONDO
      isOverload ? "bg-red-50/80 border-red-100 hover:bg-red-50" :
      isUnderload ? "bg-amber-50/50 border-amber-100 hover:bg-amber-50" :
      isHealthy ? "bg-emerald-50/30 border-emerald-100 hover:bg-emerald-50" :
      isCurrentWeek ? "bg-white border-indigo-200 shadow-sm" : "bg-slate-50/50 border-transparent hover:bg-white hover:border-indigo-200",
      
      !hasActivity && !hasReductions && "opacity-60 hover:opacity-100"
    )}>
      
      {/* SECCIÓN DATOS */}
      {hasActivity ? (
        <div className="flex flex-col gap-1.5 mt-1 flex-1">
            {/* Si hay completadas, Est. se ve más clarito */}
            <div className={cn("flex justify-between items-center text-[10px]", completedTasks.length > 0 ? "text-slate-400" : "text-slate-600 font-medium")}>
                <span>Est.</span>
                <span className="font-mono">{totalEst}h</span>
            </div>

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

      {/* SECCIÓN REDUCCIONES */}
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

      {/* FOOTER TOTAL */}
      <div className="mt-auto pt-1.5 border-t border-black/5 flex justify-end">
         <div className={cn(
             "text-[10px] font-bold flex items-center gap-1.5 transition-colors duration-300",
             isOverload ? "text-red-600" : 
             isUnderload ? "text-amber-600" : 
             isHealthy ? "text-emerald-600" : 
             "text-slate-400"
         )}>
             {isOverload && <AlertCircle className="h-3 w-3" />}
             {isUnderload && <AlertTriangle className="h-3 w-3" />} 
             {hours}/{capacity}h
         </div>
      </div>
    </div>
  );
}
