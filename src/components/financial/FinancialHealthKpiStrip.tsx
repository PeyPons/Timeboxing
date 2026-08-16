import { DollarSign, TrendingUp, TrendingDown, Landmark, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatEhrTargetForDisplay } from '@/utils/positiveDecimalInput';

type HoursMode = 'actual' | 'computed';

interface CommonExpensesBreakdown {
  total: number;
  totalRecurring: number;
  totalMonthly: number;
  countRecurring: number;
  countMonthly: number;
}

interface FinancialHealthKpiStripProps {
  totalHoursForView: number;
  ehrIsHealthy: boolean;
  effectiveHourlyRate: number;
  ehrTarget: number;
  usesLoadedCostForTarget: boolean;
  hoursMode: HoursMode;
  marginIsPositive: boolean;
  netMargin: number;
  marginPercent: number | null;
  totalRevenue: number;
  commonExpensesBreakdown: CommonExpensesBreakdown;
  formatMoney: (value: number, decimals?: number) => string;
  formatPerHour: (value: number, decimals?: number) => string;
  perHourSuffix: string;
}

export function FinancialHealthKpiStrip({
  totalHoursForView,
  ehrIsHealthy,
  effectiveHourlyRate,
  ehrTarget,
  usesLoadedCostForTarget,
  hoursMode,
  marginIsPositive,
  netMargin,
  marginPercent,
  totalRevenue,
  commonExpensesBreakdown,
  formatMoney,
  formatPerHour,
  perHourSuffix,
}: FinancialHealthKpiStripProps) {
  const { t } = useTranslation('app');

  return (
    <section className="order-1 min-w-0" aria-label={t('financialHealth.kpis.sectionAria')}>
      <div className="md:hidden grid grid-cols-3 gap-1.5">
        <div className="rounded-xl border border-emerald-200 bg-white px-1.5 py-2 border-l-4 border-l-emerald-500 min-w-0">
          <p className="text-[10px] font-medium text-slate-500">
            {t('financialHealth.kpis.ehr.titleShort', 'EHR')}
          </p>
          <p
            className={cn(
              'text-sm font-bold tabular-nums leading-snug mt-0.5 break-words',
              totalHoursForView === 0
                ? 'text-slate-400'
                : ehrIsHealthy
                  ? 'text-emerald-700'
                  : 'text-red-600'
            )}
          >
            {totalHoursForView > 0 ? formatPerHour(effectiveHourlyRate, 0) : '–'}
          </p>
          <p className="text-[10px] text-slate-500 tabular-nums mt-0.5">
            {t('financialHealth.kpis.ehr.targetShort', 'Obj.')}{' '}
            {formatEhrTargetForDisplay(ehrTarget)}
          </p>
        </div>
        <div
          className={cn(
            'rounded-xl border bg-white px-1.5 py-2 border-l-4 min-w-0',
            marginIsPositive
              ? 'border-emerald-200 border-l-emerald-500'
              : 'border-red-200 border-l-red-500'
          )}
        >
          <p className="text-[10px] font-medium text-slate-500">
            {t('financialHealth.kpis.netMargin.titleShort', 'Margen')}
          </p>
          <p
            className={cn(
              'text-sm font-bold tabular-nums leading-snug mt-0.5 break-words',
              marginIsPositive ? 'text-emerald-700' : 'text-red-600'
            )}
          >
            {formatMoney(Math.round(netMargin))}
          </p>
          <p className="text-[10px] text-slate-500 tabular-nums mt-0.5">
            {marginPercent != null ? `${marginPercent.toFixed(0)}%` : '–'}
          </p>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-white px-1.5 py-2 border-l-4 border-l-indigo-500 min-w-0">
          <p className="text-[10px] font-medium text-slate-500">
            {t('financialHealth.kpis.monthlyOverheadKpi.titleShort', 'Gastos')}
          </p>
          <p className="text-sm font-bold tabular-nums leading-snug mt-0.5 text-slate-800 break-words">
            {formatMoney(Math.round(commonExpensesBreakdown.total))}
          </p>
        </div>
      </div>

      <div className="hidden md:grid gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3 min-w-0">
        <Card className="border-l-4 border-emerald-500 shadow-sm bg-white overflow-hidden min-w-0">
          <CardHeader className="pb-2 min-w-0">
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2 min-w-0">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <DollarSign className="h-4 w-4" />
              </span>
              {t('financialHealth.kpis.ehr.title')}
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-1">
              {t('financialHealth.kpis.ehr.description', {
                hoursMode:
                  hoursMode === 'computed'
                    ? t('financialHealth.kpis.ehr.hoursModeComputed')
                    : t('financialHealth.kpis.ehr.hoursModeActual'),
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span
                className={cn(
                  'text-3xl md:text-4xl font-bold tabular-nums',
                  totalHoursForView === 0
                    ? 'text-slate-400'
                    : ehrIsHealthy
                      ? 'text-emerald-700'
                      : 'text-red-600'
                )}
              >
                {totalHoursForView > 0 ? `${formatPerHour(effectiveHourlyRate, 0)}` : '–'}
              </span>
              {totalHoursForView > 0 && !ehrIsHealthy && (
                <AlertTriangle className="h-5 w-5 text-red-500" aria-hidden="true" />
              )}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              {t('financialHealth.kpis.ehr.agencyTarget')}{' '}
              <span className="font-semibold tabular-nums">
                {formatEhrTargetForDisplay(ehrTarget)} {perHourSuffix}
              </span>
            </p>
            {totalHoursForView > 0 && (
              <p className="text-[11px] mt-1 text-slate-500">
                {ehrIsHealthy
                  ? t('financialHealth.kpis.ehr.aboveTarget')
                  : t('financialHealth.kpis.ehr.belowTarget')}
              </p>
            )}
            {usesLoadedCostForTarget && (
              <p className="text-[11px] mt-1 text-slate-500">
                {t('financialHealth.ehrTargetLoadedNote')}
              </p>
            )}
          </CardContent>
        </Card>

        <Card
          className={cn(
            'border-l-4 shadow-sm bg-white overflow-hidden min-w-0',
            marginIsPositive ? 'border-emerald-500' : 'border-red-500'
          )}
        >
          <CardHeader className="pb-2 min-w-0">
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2 min-w-0">
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg',
                  marginIsPositive ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                )}
              >
                {marginIsPositive ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
              </span>
              {t('financialHealth.kpis.netMargin.title')}
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-1">
              {t('financialHealth.kpis.netMargin.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span
                className={cn(
                  'text-3xl md:text-4xl font-bold tabular-nums',
                  marginIsPositive ? 'text-emerald-700' : 'text-red-600'
                )}
              >
                {formatMoney(netMargin)}
              </span>
              {marginIsPositive ? (
                <TrendingUp className="h-5 w-5 text-emerald-500" aria-hidden="true" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-500" aria-hidden="true" />
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Badge
                variant={marginIsPositive ? 'outline' : 'destructive'}
                className={cn(
                  'text-[11px] font-semibold tabular-nums',
                  marginIsPositive
                    ? 'border-emerald-300 text-emerald-700 bg-emerald-50'
                    : 'border-red-300 bg-red-600/90 text-white'
                )}
              >
                {marginPercent != null
                  ? t('financialHealth.kpis.netMargin.marginPct', {
                      pct: marginPercent.toFixed(1),
                    })
                  : totalRevenue <= 0 && netMargin !== 0
                    ? t('financialHealth.kpis.netMargin.naNoRevenue')
                    : t('financialHealth.kpis.netMargin.noBilling')}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-indigo-500 shadow-sm bg-white overflow-hidden min-w-0">
          <CardHeader className="pb-2 min-w-0">
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2 min-w-0">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                <Landmark className="h-4 w-4" />
              </span>
              {t('financialHealth.kpis.monthlyOverheadKpi.title')}
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-1">
              {t('financialHealth.kpis.monthlyOverheadKpi.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl md:text-4xl font-bold tabular-nums text-slate-800">
                {formatMoney(commonExpensesBreakdown.total)}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
              <span>
                {t('financialHealth.kpis.monthlyOverheadKpi.fixed')}{' '}
                <span className="font-semibold tabular-nums">
                  {formatMoney(commonExpensesBreakdown.totalRecurring)}
                </span>{' '}
                (
                {t('financialHealth.kpis.monthlyOverheadKpi.lines', {
                  count: commonExpensesBreakdown.countRecurring,
                })}
                )
              </span>
              <span className="text-slate-400">·</span>
              <span>
                {t('financialHealth.kpis.monthlyOverheadKpi.oneOff')}{' '}
                <span className="font-semibold tabular-nums">
                  {formatMoney(commonExpensesBreakdown.totalMonthly)}
                </span>{' '}
                (
                {t('financialHealth.kpis.monthlyOverheadKpi.lines', {
                  count: commonExpensesBreakdown.countMonthly,
                })}
                )
              </span>
            </div>
            {commonExpensesBreakdown.total > 0 && totalRevenue > 0 && (
              <p className="text-[11px] mt-1 text-slate-500">
                {t('financialHealth.kpis.monthlyOverheadKpi.pctOfRevenue', {
                  pct: ((commonExpensesBreakdown.total / totalRevenue) * 100).toFixed(1),
                })}
              </p>
            )}
            {commonExpensesBreakdown.total === 0 && (
              <p className="text-[11px] mt-1 text-slate-500">
                {t('financialHealth.kpis.monthlyOverheadKpi.empty')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
