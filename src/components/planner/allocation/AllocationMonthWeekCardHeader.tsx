import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AllocationWeekMetricsDisplay } from '@/components/planner/allocation/allocationWeekMetrics';
import {
  loadPercentageTone,
  resolveDisplayStatus,
  type WeekStripItemSummary,
} from '@/components/planner/allocation/allocationWeekMetricsUtils';
import { cn } from '@/lib/utils';
import { round2 } from '@/utils/numbers';
import { Palmtree, Zap } from 'lucide-react';

interface AllocationMonthWeekCardHeaderProps {
  weekIndex: number;
  weekDateLabel: string;
  summary: WeekStripItemSummary;
  loadPercentage: number;
  breakdown?: { reason: string; hours: number; type: 'absence' | 'event' }[];
  compactMetrics?: boolean;
}

export function AllocationMonthWeekCardHeader({
  weekIndex,
  weekDateLabel,
  summary,
  loadPercentage,
  breakdown,
  compactMetrics,
}: AllocationMonthWeekCardHeaderProps) {
  const hasBreakdown = breakdown && breakdown.length > 0;
  const breakdownHours = hasBreakdown ? round2(breakdown.reduce((s, b) => s + b.hours, 0)) : 0;
  const pct = Math.round(loadPercentage);
  const displayStatus = resolveDisplayStatus(summary);
  const { text: pctTone, bar: barTone } = loadPercentageTone(displayStatus);
  const metricsRows = summary.showComp
    ? 'grid-rows-[auto_minmax(2.875rem,auto)_auto_minmax(1.125rem,auto)]'
    : 'grid-rows-[auto_minmax(1.875rem,auto)_auto_minmax(1.125rem,auto)]';

  return (
    <div className={cn('grid gap-1 pb-2 border-b border-slate-100 shrink-0', metricsRows)}>
      <div className="flex items-baseline justify-between gap-1 min-w-0">
        <span className="text-xs font-semibold text-slate-800">S{weekIndex + 1}</span>
        <span className="text-[10px] text-slate-400 tabular-nums truncate">{weekDateLabel}</span>
      </div>

      <div className="min-w-0">
        {!compactMetrics && (
          <AllocationWeekMetricsDisplay summary={summary} size="xs" className="gap-0.5" />
        )}
      </div>

      <div className="flex items-center gap-1.5 min-w-0">
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-0">
          <div
            className={cn('h-full rounded-full transition-all duration-500', barTone)}
            style={{ width: `${Math.min(loadPercentage, 100)}%` }}
          />
        </div>
        <span className={cn('text-[10px] font-semibold tabular-nums shrink-0 w-7 text-right', pctTone)}>
          {pct}%
        </span>
      </div>

      <div className="flex items-center min-h-[18px]">
        {hasBreakdown ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="inline-flex items-center gap-1 text-[9px] text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100 cursor-help max-w-full truncate">
                {breakdown.some((b) => b.type === 'absence') && <Palmtree className="w-2.5 h-2.5 shrink-0" />}
                {breakdown.some((b) => b.type === 'event') && <Zap className="w-2.5 h-2.5 shrink-0" />}
                <span className="font-medium truncate">-{breakdownHours}h cap.</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {breakdown.map((b, i) => (
                <div key={i}>
                  {b.reason}: -{b.hours}h
                </div>
              ))}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}
