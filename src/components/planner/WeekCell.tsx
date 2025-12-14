import { cn } from '@/lib/utils';
import { LoadStatus } from '@/types';
import { AlertTriangle, Palmtree } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Allocation } from '@/types';

interface WeekCellProps {
  // Mantenemos allocations por si quieres usarlas en el tooltip, 
  // pero visualmente usaremos solo las métricas
  allocations?: Allocation[]; 
  hours: number;
  capacity: number;
  status: LoadStatus;
  percentage?: number; // Hacemos opcional para calcularlo si no viene
  isCurrentWeek?: boolean;
  hasAbsence?: boolean;
  absenceHours?: number;
  baseCapacity?: number;
  onClick?: () => void;
}

export function WeekCell({ 
  hours, 
  capacity, 
  status, 
  percentage, 
  isCurrentWeek, 
  hasAbsence,
  absenceHours = 0,
  baseCapacity,
  onClick 
}: WeekCellProps) {
  
  // Calculamos porcentaje si no viene
  const loadPercentage = percentage ?? (capacity > 0 ? (hours / capacity) * 100 : 0);

  const statusClasses = {
    empty: 'bg-muted/30 border-muted hover:bg-muted/50',
    healthy: 'bg-green-50/50 border-green-200 hover:bg-green-100/50 dark:bg-green-900/10 dark:border-green-900/30',
    warning: 'bg-yellow-50/50 border-yellow-200 hover:bg-yellow-100/50 dark:bg-yellow-900/10 dark:border-yellow-900/30',
    overload: 'bg-red-50/50 border-red-200 hover:bg-red-100/50 dark:bg-red-900/10 dark:border-red-900/30',
  };

  const textClasses = {
    empty: 'text-muted-foreground',
    healthy: 'text-green-700 dark:text-green-400',
    warning: 'text-yellow-700 dark:text-yellow-400',
    overload: 'text-red-700 dark:text-red-400',
  };

  const barColor = {
      empty: 'bg-slate-200',
      healthy: 'bg-green-500',
      warning: 'bg-yellow-500',
      overload: 'bg-red-500'
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "relative flex flex-col w-full h-full min-h-[5rem] rounded-md border transition-all duration-200 p-2 gap-2 text-left",
            "hover:shadow-sm cursor-pointer",
            statusClasses[status],
            isCurrentWeek && "ring-1 ring-primary ring-offset-0 shadow-sm",
            hasAbsence && "border-dashed"
          )}
        >
            {/* Cabecera con iconos de estado */}
            <div className="flex justify-between items-start w-full">
                {status === 'overload' && (
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500 animate-pulse" />
                )}
                {hasAbsence && (
                    <Palmtree className="h-3.5 w-3.5 text-amber-500 ml-auto" />
                )}
            </div>

            {/* Centro: Horas / Capacidad */}
            <div className="flex-1 flex flex-col justify-center items-center mt-[-10px]"> 
                {hours > 0 ? (
                    <>
                    <span className={cn("text-lg font-bold leading-none tracking-tight", textClasses[status])}>
                        {hours}h
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium mt-1">
                        / {capacity}h
                    </span>
                    </>
                ) : (
                    <span className="text-xl text-muted-foreground/30 font-light">—</span>
                )}
            </div>

            {/* Barra de progreso inferior */}
            {hours > 0 && (
                <div className="w-full h-1 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden mt-auto">
                    <div 
                        className={cn("h-full transition-all duration-500", barColor[status])}
                        style={{ width: `${Math.min(loadPercentage, 100)}%` }}
                    />
                </div>
            )}
        </button>
      </TooltipTrigger>
      
      <TooltipContent side="top" className="text-xs">
        <div className="space-y-1">
          <p className="font-semibold">
            Resumen Semanal
          </p>
          <p>
             Asignado: {hours}h
          </p>
          <p>
             Capacidad: {capacity}h
          </p>
          {hasAbsence && (
            <p className="text-amber-500 flex items-center gap-1">
              <Palmtree size={10} /> Incluye ausencias
            </p>
          )}
          {status === 'overload' && <p className="text-red-500 font-bold">⚠️ Sobrecarga detectada</p>}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
