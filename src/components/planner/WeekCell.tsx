import { cn } from '@/lib/utils';
import { LoadStatus } from '@/types';
import { AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface WeekCellProps {
  hours: number;
  capacity: number;
  status: LoadStatus;
  percentage: number;
  isCurrentWeek?: boolean;
  onClick?: () => void;
}

export function WeekCell({ hours, capacity, status, percentage, isCurrentWeek, onClick }: WeekCellProps) {
  const statusClasses = {
    empty: 'bg-muted/30 border-muted hover:bg-muted/50',
    healthy: 'bg-success/10 border-success/30 hover:bg-success/20',
    warning: 'bg-warning/10 border-warning/30 hover:bg-warning/20',
    overload: 'bg-destructive/10 border-destructive/30 hover:bg-destructive/20 animate-pulse-soft',
  };

  const textClasses = {
    empty: 'text-muted-foreground',
    healthy: 'text-success',
    warning: 'text-warning',
    overload: 'text-destructive',
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "relative flex h-16 w-full flex-col items-center justify-center rounded-lg border-2 transition-all duration-200",
            "hover:shadow-md cursor-pointer",
            statusClasses[status],
            isCurrentWeek && "ring-2 ring-primary ring-offset-2"
          )}
        >
          {status === 'overload' && (
            <AlertTriangle className="absolute right-1.5 top-1.5 h-4 w-4 text-destructive" />
          )}
          
          {hours > 0 ? (
            <>
              <span className={cn("text-lg font-bold", textClasses[status])}>
                {hours}h
              </span>
              <span className="text-xs text-muted-foreground">
                / {capacity}h
              </span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-sm">
        <div className="space-y-1">
          <p className="font-medium">
            {hours}h asignadas / {capacity}h capacidad
          </p>
          <p className={cn("text-xs", textClasses[status])}>
            {percentage.toFixed(0)}% de carga
            {status === 'overload' && ' ⚠️ Sobrecarga'}
            {status === 'warning' && ' ⚡ Cerca del límite'}
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
