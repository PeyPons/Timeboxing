import { Allocation, LoadStatus } from '@/types';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, AlertCircle, AlertTriangle, Palmtree, CalendarOff } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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

export function WeekCell({ allocations, hours, capacity, status, isCurrentWeek, breakdown, onClick }: WeekCellProps) {
  
  // 1. Métricas de Trabajo
  const totalEstimated = round2(allocations.reduce((sum, a) => sum + Number(a.hoursAssigned || 0), 0));
  const totalComputed = round2(allocations.reduce((sum, a) => sum + Number(a.hoursActual || 0), 0));
  
  const activeAllocations = allocations.filter(a => (a.hoursActual || 0) > 0);
  
  let balance = 0;
  if (activeAllocations.length > 0) {
      const est = activeAllocations.reduce((sum, a) => sum + Number(a.hoursAssigned), 0);
      const comp = activeAllocations.reduce((sum, a) => sum + Number(a.hoursActual), 0);
      balance = round2(est - comp);
  }

  const hasActivity = allocations.length > 0;
  const hasReductions = breakdown && breakdown.length > 0;

  // ✅ LOGICA DE TOLERANCIA (10% de Margen)
  // Si tienes 40h, el margen es 4h.
  // Zona Confort: 36h - 44h (No muestra alertas)
  const margin = capacity * 0.1; 
  
  // Rojo solo si supera el 110%
  const isOverload = hours > (capacity + margin);
  
  // Naranja solo si no llega al 90% (y hay capacidad)
  const isUnderload = hours < (capacity - margin) && capacity > 0;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
            <div onClick={onClick} className={cn(
              "h-full min-h-[120px] p-2 transition-all cursor-pointer border border-transparent hover:border-indigo-300 rounded-md relative flex flex-col justify-between group",
              isCurrentWeek ? "bg-white shadow-sm" : "bg-slate-50/50 hover:bg-white",
              !hasActivity && !hasReductions && "opacity-60 hover:opacity-100"
            )}>
              {/* Semáforo (Mantiene lógica original para consistencia global, o puedes ajustarlo también) */}
              <div className={cn("absolute top-1 right-1 w-2 h-2 rounded-full transition-colors",
                  status === 'overload' ? "bg-red-500" :
                  status === 'warning' ? "bg-amber-400" :
                  isUnderload ? "bg-amber-200" :
                  "bg-slate-200"
              )} />

              {/* --- SECCIÓN TRABAJO --- */}
              {hasActivity ? (
                <div className="flex flex-col gap-1.5 mt-1">
                    <div className="flex justify-between items-center text-[11px] text-slate-500">
                        <span>Est.</span>
                        <span className="font-mono font-medium">{totalEstimated}h</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-slate-700">
                        <span className="font-medium">Comp.</span>
                        <span className="font-mono font-bold">{totalComputed}h</span>
                    </div>
                    {totalComputed > 0 && (
                        <div className={cn(
                            "flex justify-between items-center text-[10px] px-1.5 py-0.5 rounded border mt-1",
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
                <div className="flex-1 flex items-center justify-center pt-2">
                    {!hasReductions && <span className="text-[10px] text-slate-300 uppercase tracking-widest font-medium">Libre</span>}
                </div>
              )}

              {/* --- SECCIÓN REDUCCIONES --- */}
              {hasReductions && (
                <div className="mt-2 space-y-1">
                    {breakdown.map((item, idx) => (
                        <div key={idx} className={cn(
                            "flex justify-between items-center text-[9px] px-1.5 py-0.5 rounded border",
                            item.type === 'absence' ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200"
                        )}>
                            <span className="flex items-center gap-1 truncate max-w-[80px]">
                                {item.type === 'absence' ? <Palmtree className="h-3 w-3" /> : <CalendarOff className="h-3 w-3" />}
                                <span className="truncate">{item.reason.replace('Ausencia: ', '').replace('Evento: ', '')}</span>
                            </span>
                            <span className="font-mono font-bold whitespace-nowrap">-{item.hours}h</span>
                        </div>
                    ))}
                </div>
              )}

              {/* --- FOOTER (TOTALES CON TOLERANCIA) --- */}
              <div className="mt-auto pt-2 border-t flex justify-end">
                 <div className={cn(
                     "text-xs font-bold flex items-center gap-1.5 transition-colors duration-300",
                     isOverload ? "text-red-600" : 
                     isUnderload ? "text-amber-600" : 
                     "text-slate-400" // Color "Tranquilo" si está dentro del 10% de margen
                 )}>
                     {isOverload && <AlertCircle className="h-3.5 w-3.5" />}
                     {isUnderload && <AlertTriangle className="h-3 w-3 opacity-80" />} 
                     
                     {hours}/{capacity}h
                 </div>
              </div>

            </div>
        </TooltipTrigger>
        
        <TooltipContent className="text-xs bg-slate-900 text-white border-slate-800 p-2 shadow-xl">
            <div className="font-bold mb-1 pb-1 border-b border-slate-700">Resumen Tareas</div>
            {allocations.length > 0 ? (
                <div className="space-y-1">
                    {allocations.slice(0, 5).map(a => (
                        <div key={a.id} className="flex justify-between gap-4">
                            <span className="opacity-80 truncate max-w-[120px]">{a.taskName || 'Sin nombre'}</span>
                            <span className="font-mono">{a.hoursAssigned}h</span>
                        </div>
                    ))}
                    {allocations.length > 5 && <div className="text-[10px] opacity-50 pt-1">+{allocations.length - 5} más...</div>}
                </div>
            ) : (
                <span className="opacity-50 italic">Sin tareas asignadas</span>
            )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
