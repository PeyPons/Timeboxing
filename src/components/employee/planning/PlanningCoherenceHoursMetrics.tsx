import { cn } from '@/lib/utils';

export function PlanningCoherenceHoursMetrics({
  deadlineHours,
  plannedHours,
  computedHours,
  t,
}: {
  deadlineHours: number;
  plannedHours: number;
  computedHours: number;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const columns = [
    ...(deadlineHours > 0
      ? [{ label: t('employeeDashboard.hours.deadline'), value: deadlineHours, valueClass: 'text-slate-900' }]
      : []),
    { label: t('employeeDashboard.hours.planned'), value: plannedHours, valueClass: 'text-slate-900' },
    { label: t('employeeDashboard.hours.computed'), value: computedHours, valueClass: 'text-slate-900' },
  ];

  return (
    <div className="rounded-xl border border-slate-200/70 bg-white/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
      <div className="flex items-stretch divide-x divide-slate-100">
        {columns.map(col => (
          <div key={col.label} className="flex-1 px-2 py-2.5 text-center min-w-0">
            <p className="text-[10px] font-medium text-slate-400 leading-none mb-1.5 truncate">
              {col.label}
            </p>
            <p className={cn('text-[15px] font-semibold tabular-nums tracking-tight leading-none', col.valueClass)}>
              {col.value}h
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
