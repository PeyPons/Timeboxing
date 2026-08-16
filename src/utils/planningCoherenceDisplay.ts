import { format, endOfWeek, isSameMonth, parseISO } from 'date-fns';
import type { Locale } from 'date-fns';
import { CheckCircle2, TrendingDown, TrendingUp } from 'lucide-react';

const WEEK_START_MONDAY = { weekStartsOn: 1 as const };

/** Rango calendario de la semana de la tarea (lun–dom), p. ej. "7–13 abr" o "31 mar – 6 abr". */
export function formatTaskWeekCalendarSpan(weekStartIso: string, locale: Locale): string {
  const start = parseISO(weekStartIso);
  const end = endOfWeek(start, WEEK_START_MONDAY);
  if (isSameMonth(start, end)) {
    return `${format(start, 'd', { locale })}–${format(end, 'd MMM', { locale })}`;
  }
  return `${format(start, 'd MMM', { locale })} – ${format(end, 'd MMM', { locale })}`;
}

export function mobileDeltaMeta(
  difference: number,
  t: (key: string, options?: Record<string, unknown>) => string
) {
  if (difference < 0) {
    return {
      dot: 'bg-red-500',
      text: 'text-red-700',
      label: t('employeeDashboard.planning.hoursToPlan', { hours: difference }),
      Icon: TrendingDown,
    };
  }
  if (difference > 0) {
    return {
      dot: 'bg-amber-500',
      text: 'text-amber-700',
      label: t('employeeDashboard.planning.deviationPositive', { hours: difference }),
      Icon: TrendingUp,
    };
  }
  return {
    dot: 'bg-emerald-500',
    text: 'text-emerald-700',
    label: t('employeeDashboard.planning.noDeviation'),
    Icon: CheckCircle2,
  };
}
