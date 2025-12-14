import { cn } from '@/lib/utils';
import { LoadStatus, Allocation } from '@/types';
import { AlertTriangle, Palmtree, Trophy } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

interface WeekCellProps {
  allocations?: Allocation[];
  hours: number;
  capacity: number;
  status: LoadStatus;
  percentage?: number;
  isCurrentWeek?: boolean;
  hasAbsence?: boolean;
  absenceHours?: number;
  baseCapacity?: number;
  onClick?: () => void;
}

export function WeekCell({ hours, capacity, status, percentage, isCurrentWeek, hasAbsence, absenceHours = 0, baseCapacity, onClick }: WeekCellProps) {
  const loadPercentage = percentage ?? (capacity > 0 ? (hours / capacity) * 100 : 0);
  const isSweetSpot = loadPercentage >= 85 && loadPercentage <= 95;

  const statusClasses = {
    empty: 'bg-muted/30 border-muted hover:bg-muted/50',
    healthy: 'bg-green-50/50 border-green-200 hover:bg-green-100/50 dark:bg-green-900/10 dark:border-green-900/30',
    warning: 'bg-yellow-50/50 border-yellow-200 hover:bg-yellow-100/50 dark:bg-yellow-900/10 dark:border-yellow-900/30',
    overload: 'bg-red-50/50 border-red-200 hover:bg-red-100/50 dark:bg-red-900/10 dark:border-red-900/30',
    sweetSpot: 'bg-indigo-50 border-indigo-300 shadow-sm ring-1 ring-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-700'
  };

  const textClasses = {
    empty: 'text-muted-foreground',
    healthy: 'text-green-700 dark:text-green-400',
    warning: 'text-yellow-700 dark:text-yellow-400',
    overload: 'text-red-700 dark:text-red-400',
    sweetSpot: 'text-indigo-700 dark:text-indigo-300'
  };

  const barColor = { empty: 'bg-slate-200', healthy: 'bg-green-500', warning: 'bg-yellow-500', overload: 'bg-red-500', sweetSpot: 'bg-indigo-500' };

  const currentStatusClass = isSweetSpot ? statusClasses.sweetSpot : statusClasses[status];
  const currentTextClass = isSweetSpot ? textClasses.sweetSpot : textClasses[status];
  const currentBarClass = isSweetSpot ? barColor.sweetSpot : barColor[status];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button onClick={onClick} className={cn("relative flex h-full min-h-[5rem] w-full flex-col items-center justify-center rounded-lg border-2 transition-all duration-200 p-2 gap-2 text-left group hover:shadow-md cursor-pointer", currentStatusClass, isCurrentWeek && !isSweetSpot && "ring-2 ring-primary ring-offset-2", hasAbsence && "border-dashed")}>
          <div className="absolute top-1.5 right-1.5 flex gap-1">
            {status === 'overload' && <AlertTriangle className="h-3.5 w-3.5 text-red-500 animate-pulse" />}
            {hasAbsence && <Palmtree className="h-3.5 w-3.5 text-amber-500" />}
            {isSweetSpot && <Trophy className="h-3.5 w-3.5 text-indigo-500 animate-bounce-slow" />} 
          </div>
          <div className="flex-1 flex flex-col justify-center items-center mt-[-6px]"> 
            {hours > 0 ? (
                <>
                <span className={cn("text-lg font-bold leading-none tracking-tight flex items-center gap-1", currentTextClass)}>{hours}h</span>
                <span className="text-[10px] text-muted-foreground font-medium mt-1 opacity-80">/ {capacity}h</span>
                </>
            ) : (<span className="text-xl text-muted-foreground/30 font-light">—</span>)}
          </div>
          {hours > 0 && (<div className="w-full h-1 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden mt-auto"><div className={cn("h-full transition-all duration-500", currentBarClass)} style={{ width: `${Math.min(loadPercentage, 100)}%` }} /></div>)}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <div className="space-y-1">
          <p className="font-semibold flex items-center gap-2">Resumen Semanal {isSweetSpot && <Badge className="h-4 px-1 bg-indigo-500 text-[9px]">Perfecto</Badge>}</p>
          <p>Asignado: {hours}h / {capacity}h</p>
          <p className={cn("text-xs font-mono", currentTextClass)}>Carga: {loadPercentage.toFixed(0)}%</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
