import { LoadStatus } from '@/types';

export interface WeekStripItemSummary {
  planHours: number;
  loadHours: number;
  capacity: number;
  status: LoadStatus;
  weekReal: number;
  weekComp: number;
  showComp: boolean;
}

export function planValueTone(status: LoadStatus, isActive: boolean) {
  if (isActive) return 'text-primary-foreground';
  switch (status) {
    case 'overload':
      return 'text-red-700';
    case 'warning':
      return 'text-amber-700';
    case 'healthy':
      return 'text-emerald-700';
    default:
      return 'text-slate-700';
  }
}

export function resolveDisplayStatus(summary: WeekStripItemSummary) {
  const isZeroCapacityOverload = summary.loadHours > 0 && summary.capacity === 0;
  return isZeroCapacityOverload ? 'overload' : summary.status;
}

export function loadPercentageTone(displayStatus: LoadStatus) {
  switch (displayStatus) {
    case 'overload':
      return { text: 'text-red-600', bar: 'bg-red-500' };
    case 'warning':
      return { text: 'text-amber-700', bar: 'bg-amber-400' };
    case 'healthy':
      return { text: 'text-emerald-700', bar: 'bg-emerald-500' };
    default:
      return { text: 'text-slate-500', bar: 'bg-slate-300' };
  }
}

export function weekCellSurfaceClass(displayStatus: LoadStatus, isCurrentWeek?: boolean) {
  if (isCurrentWeek) return 'border-indigo-300 bg-indigo-50/30 ring-1 ring-indigo-200/80';
  switch (displayStatus) {
    case 'overload':
      return 'border-red-200 bg-red-50/60';
    case 'warning':
      return 'border-amber-200 bg-amber-50/40';
    case 'healthy':
      return 'border-emerald-200 bg-emerald-50/35';
    default:
      return 'border-slate-200 bg-slate-50/40';
  }
}

export function weekCardSurfaceClass(displayStatus: LoadStatus, isActive?: boolean) {
  if (isActive) return 'border-indigo-400 bg-indigo-50/40 ring-1 ring-indigo-200';
  switch (displayStatus) {
    case 'overload':
      return 'border-red-200 bg-red-50/50';
    case 'warning':
      return 'border-amber-200 bg-amber-50/40';
    case 'healthy':
      return 'border-emerald-200 bg-emerald-50/30';
    default:
      return 'border-slate-200 bg-white';
  }
}
