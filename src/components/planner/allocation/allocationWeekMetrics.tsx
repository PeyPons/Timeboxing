import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  planValueTone,
  resolveDisplayStatus,
  type WeekStripItemSummary,
} from '@/components/planner/allocation/allocationWeekMetricsUtils';

export function MetricLine({
  label,
  children,
  isActive,
  valueClassName,
  size = 'sm',
}: {
  label: string;
  children: ReactNode;
  isActive: boolean;
  valueClassName?: string;
  size?: 'sm' | 'xs';
}) {
  return (
    <div
      className={cn(
        'flex items-baseline gap-1 w-full leading-none tabular-nums shrink-0',
        size === 'xs' ? 'text-[11px] min-h-[14px]' : 'text-[11px] sm:text-[12px] min-h-[15px]'
      )}
    >
      <span
        className={cn(
          'shrink-0',
          size === 'xs' ? 'w-[2rem]' : 'w-[2.1rem]',
          isActive ? 'text-primary-foreground/70' : 'text-slate-500'
        )}
      >
        {label}:
      </span>
      <span className={cn('font-bold truncate min-w-0', valueClassName)}>{children}</span>
    </div>
  );
}

export function AllocationWeekMetricsDisplay({
  summary,
  isActive = false,
  size = 'sm',
  className,
}: {
  summary: WeekStripItemSummary;
  isActive?: boolean;
  size?: 'sm' | 'xs';
  className?: string;
}) {
  const displayStatus = resolveDisplayStatus(summary);
  const showReal = summary.weekReal > 0;
  const showCompValue = summary.showComp && summary.weekComp > 0;

  return (
    <div className={cn('flex flex-col gap-0.5 w-full min-w-0', className)}>
      <MetricLine label="Plan" isActive={isActive} size={size}>
        <span className={planValueTone(displayStatus, isActive)}>{summary.planHours}h</span>
        <span className={cn(isActive ? 'text-primary-foreground/60 font-normal' : 'text-slate-400 font-normal')}>
          /
        </span>
        <span className={cn(isActive ? 'text-primary-foreground/85 font-semibold' : 'text-slate-500 font-semibold')}>
          {summary.capacity}h
        </span>
      </MetricLine>

      <MetricLine
        label="Real"
        isActive={isActive}
        size={size}
        valueClassName={
          showReal
            ? isActive
              ? 'text-primary-foreground/90'
              : 'text-blue-700'
            : isActive
              ? 'text-primary-foreground/40 font-normal'
              : 'text-slate-300 font-normal'
        }
      >
        {showReal ? `${summary.weekReal}h` : '—'}
      </MetricLine>

      {summary.showComp && (
        <MetricLine
          label="Comp"
          isActive={isActive}
          size={size}
          valueClassName={
            showCompValue
              ? isActive
                ? 'text-primary-foreground/90'
                : 'text-emerald-700'
              : isActive
                ? 'text-primary-foreground/40 font-normal'
                : 'text-slate-300 font-normal'
          }
        >
          {showCompValue ? `${summary.weekComp}h` : '—'}
        </MetricLine>
      )}
    </div>
  );
}
