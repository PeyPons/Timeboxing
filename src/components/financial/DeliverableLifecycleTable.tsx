import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { useDateLocale } from '@/hooks/useDateLocale';
import { Download } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useAgency } from '@/contexts/AgencyContext';
import { usePrivacyDemo } from '@/contexts/PrivacyDemoContext';
import { PROJECT_TYPE_ENTREGABLE } from '@/config/projectTypePresets';
import { getDeliverablePhase, type DeliverableLifecycle } from '@/utils/deliverableLifecycle';
import { getLifecycleStatusClasses } from '@/utils/deliverableLifecycleStatus';
import { getMarginSemaphore } from '@/utils/marginSemaphore';
import { useDeliverableLifecycleBatch } from '@/hooks/useDeliverableLifecycleBatch';
import { buildDeliverableLifecycleCsv } from '@/utils/reportExports/deliverableLifecycleExport';
import { SensitiveText } from '@/components/privacy/SensitiveText';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { round2 } from '@/utils/numbers';
import { toast } from '@/lib/notify';
import { useTranslation } from 'react-i18next';
import { useFormatMoney } from '@/hooks/useFormatMoney';

const STATUS_ORDER: Record<DeliverableLifecycle['status'], number> = {
    'over-budget': 0,
    'at-risk': 1,
    'on-track': 2,
    'pre-start': 3,
    'completed': 4,
    'no-phase': 5,
};

export type DeliverableLifecycleTableProps = {
    costMode: 'standard' | 'dynamic';
    onCostModeChange: (m: 'standard' | 'dynamic') => void;
    hoursMode: 'actual' | 'computed';
    /** Si hay filtro departamento, ids de proyectos visibles en rentabilidad mensual */
    departmentProjectIds: Set<string> | undefined;
    searchQuery: string;
};

export function DeliverableLifecycleTable(props: DeliverableLifecycleTableProps): JSX.Element {
    const { costMode, onCostModeChange, hoursMode, departmentProjectIds, searchQuery } = props;
    const { formatMoney, currencySymbol, inCurrencyParens } = useFormatMoney();
    const currencyLabels = { currencySymbol, currencyParens: inCurrencyParens };
    const { t } = useTranslation('app');
    const dateLocale = useDateLocale();
    const { projects, clients } = useApp();
    const { currentAgency } = useAgency();
    const { isActive: privacyDemoActive, anonymizer } = usePrivacyDemo();
    const [statusFilter, setStatusFilter] = useState<'active' | 'completed' | 'all'>('active');

    const entregablesUnconfigured = useMemo(() => {
        return (projects ?? []).filter(
            (p) =>
                p.projectType === PROJECT_TYPE_ENTREGABLE &&
                p.status === 'active' &&
                getDeliverablePhase(p) == null
        );
    }, [projects]);

    const filteredProjects = useMemo(() => {
        let list = (projects ?? []).filter(
            (p) => p.projectType === PROJECT_TYPE_ENTREGABLE && getDeliverablePhase(p) != null
        );
        if (statusFilter === 'active') list = list.filter((p) => p.status === 'active');
        else if (statusFilter === 'completed') list = list.filter((p) => p.status === 'completed');
        if (departmentProjectIds) {
            list = list.filter((p) => departmentProjectIds.has(p.id));
        }
        const q = searchQuery.trim().toLowerCase();
        if (q) {
            list = list.filter((p) => {
                const client = clients?.find((c) => c.id === p.clientId);
                const cn = client?.name?.toLowerCase() ?? '';
                return p.name.toLowerCase().includes(q) || cn.includes(q);
            });
        }
        return list;
    }, [projects, statusFilter, departmentProjectIds, searchQuery, clients]);

    const ids = useMemo(() => filteredProjects.map((p) => p.id), [filteredProjects]);
    const { data: lifecycleMap, isLoading } = useDeliverableLifecycleBatch(ids, {
        costModeOverride: costMode,
    });

    const rows = useMemo(() => {
        const out: { project: (typeof projects)[0]; lc: DeliverableLifecycle }[] = [];
        for (const p of filteredProjects) {
            const lc = lifecycleMap.get(p.id);
            if (lc && lc.status !== 'no-phase') out.push({ project: p, lc });
        }
        out.sort((a, b) => {
            const oa = STATUS_ORDER[a.lc.status];
            const ob = STATUS_ORDER[b.lc.status];
            if (oa !== ob) return oa - ob;
            const da = a.lc.phase?.due.getTime() ?? 0;
            const db = b.lc.phase?.due.getTime() ?? 0;
            if (da !== db) return da - db;
            return a.project.name.localeCompare(b.project.name);
        });
        return out;
    }, [filteredProjects, lifecycleMap]);

    const kpis = useMemo(() => {
        let sumH = 0;
        let sumBudget = 0;
        let sumContract = 0;
        let sumRev = 0;
        let sumCost = 0;
        let sumMargin = 0;
        let sumRevWeight = 0;
        for (const { lc } of rows) {
            sumH += lc.hours.computed;
            sumBudget += lc.hours.budget;
            sumContract += lc.finance.contractFee;
            sumRev += lc.finance.revenueAccrued;
            sumCost += lc.finance.costToDate;
            if (lc.finance.marginAbsolute != null) sumMargin += lc.finance.marginAbsolute;
            if (lc.finance.revenueAccrued > 0) sumRevWeight += lc.finance.revenueAccrued;
        }
        const marginPctWeighted =
            sumRevWeight > 0
                ? rows.reduce((acc, { lc }) => {
                      if (lc.finance.marginPct == null || lc.finance.revenueAccrued <= 0) return acc;
                      return acc + lc.finance.marginPct * lc.finance.revenueAccrued;
                  }, 0) / sumRevWeight
                : null;
        return {
            n: rows.length,
            sumH,
            sumBudget,
            sumContract,
            sumRev,
            sumCost,
            sumMargin,
            marginPctWeighted,
        };
    }, [rows]);

    const pctExpected = (lc: DeliverableLifecycle): number => {
        const ph = lc.phase;
        if (!ph || ph.totalDays <= 0) return 0;
        return Math.round((lc.pacing.daysElapsed / ph.totalDays) * 1000) / 10;
    };

    const handleCsv = () => {
        try {
            const csv = buildDeliverableLifecycleCsv({
                agencyName: currentAgency?.name ?? '',
                projects: rows.map((r) => r.project),
                clients: clients ?? [],
                lifecycles: new Map(rows.map((r) => [r.project.id, r.lc])),
                privacyAnonymizer: privacyDemoActive ? anonymizer : undefined,
            });
            const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `entregables-vida-${format(new Date(), 'yyyy-MM-dd')}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success(t('deliverableLifecycle.exportOk', 'CSV descargado'));
        } catch {
            toast.error(t('deliverableLifecycle.exportErr', 'Error al exportar'));
        }
    };

    const firstUnconfigured = entregablesUnconfigured[0];

    return (
        <div className="space-y-4">
            {entregablesUnconfigured.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
                    {t('deliverableLifecycle.bannerUnconfigured', {
                        count: entregablesUnconfigured.length,
                        defaultValue:
                            '{{count}} entregables sin fechas configuradas. Configura inicio/fin para ver su consumo.',
                    })}{' '}
                    {firstUnconfigured && (
                        <Link
                            to="/clients"
                            className="font-medium underline underline-offset-2 text-amber-950"
                        >
                            {t('deliverableLifecycle.goConfigure', 'Ir a proyectos')}
                        </Link>
                    )}
                </div>
            )}

            <div className="flex flex-wrap items-center gap-3 justify-between">
                <p className="text-xs text-slate-600 max-w-xl">
                    {t(
                        'deliverableLifecycle.costModeIndependent',
                        'Modo de coste independiente del de la vista mensual. Por defecto, estándar.'
                    )}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                    <Label className="text-xs text-slate-600 sr-only">Coste</Label>
                    <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={cn(
                                'h-8 text-xs',
                                costMode === 'standard' && 'bg-white shadow-sm'
                            )}
                            onClick={() => onCostModeChange('standard')}
                        >
                            {t('financialHealth.filters.operational', 'Operativo')}
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={cn(
                                'h-8 text-xs',
                                costMode === 'dynamic' && 'bg-white shadow-sm'
                            )}
                            onClick={() => onCostModeChange('dynamic')}
                        >
                            {t('financialHealth.filters.dynamic', 'Dinámico')}
                        </Button>
                    </div>
                    <Select
                        value={statusFilter}
                        onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
                    >
                        <SelectTrigger className="h-8 w-[160px] text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="active">
                                {t('deliverableLifecycle.filterActive', 'Activos')}
                            </SelectItem>
                            <SelectItem value="completed">
                                {t('deliverableLifecycle.filterCompleted', 'Completados')}
                            </SelectItem>
                            <SelectItem value="all">{t('deliverableLifecycle.filterAll', 'Todos')}</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="sm" className="h-8 gap-1" onClick={handleCsv}>
                        <Download className="h-4 w-4" />
                        CSV
                    </Button>
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 text-xs">
                <Card className="py-2">
                    <CardHeader className="py-2 px-3 pb-0">
                        <CardDescription>{t('deliverableLifecycle.kpi.count', 'Entregables')}</CardDescription>
                    </CardHeader>
                    <CardContent className="py-1 px-3 text-lg font-semibold tabular-nums">{kpis.n}</CardContent>
                </Card>
                <Card className="py-2">
                    <CardHeader className="py-2 px-3 pb-0">
                        <CardDescription>{t('deliverableLifecycle.kpi.hours', 'Σ h / techo')}</CardDescription>
                    </CardHeader>
                    <CardContent className="py-1 px-3 text-lg font-semibold tabular-nums">
                        {round2(kpis.sumH)} / {round2(kpis.sumBudget)}
                    </CardContent>
                </Card>
                <Card className="py-2">
                    <CardHeader className="py-2 px-3 pb-0">
                        <CardDescription>{t('deliverableLifecycle.kpi.contract', 'Σ contrato')}</CardDescription>
                    </CardHeader>
                    <CardContent className="py-1 px-3 text-lg font-semibold tabular-nums">
                        {formatMoney(kpis.sumContract)}
                    </CardContent>
                </Card>
                <Card className="py-2">
                    <CardHeader className="py-2 px-3 pb-0">
                        <CardDescription>{t('deliverableLifecycle.kpi.accrued', 'Σ devengado')}</CardDescription>
                    </CardHeader>
                    <CardContent className="py-1 px-3 text-lg font-semibold tabular-nums">
                        {formatMoney(kpis.sumRev)}
                    </CardContent>
                </Card>
                <Card className="py-2">
                    <CardHeader className="py-2 px-3 pb-0">
                        <CardDescription>{t('deliverableLifecycle.kpi.cost', 'Σ coste')}</CardDescription>
                    </CardHeader>
                    <CardContent className="py-1 px-3 text-lg font-semibold tabular-nums">
                        {formatMoney(kpis.sumCost)}
                    </CardContent>
                </Card>
                <Card className="py-2">
                    <CardHeader className="py-2 px-3 pb-0">
                        <CardDescription>{t('deliverableLifecycle.kpi.marginEur', currencyLabels)}</CardDescription>
                    </CardHeader>
                    <CardContent className="py-1 px-3 text-lg font-semibold tabular-nums">
                        {formatMoney(kpis.sumMargin)}
                    </CardContent>
                </Card>
                <Card className="py-2">
                    <CardHeader className="py-2 px-3 pb-0">
                        <CardDescription>{t('deliverableLifecycle.kpi.marginPct', 'Margen % pond.')}</CardDescription>
                    </CardHeader>
                    <CardContent className="py-1 px-3 text-lg font-semibold tabular-nums">
                        {kpis.marginPctWeighted != null
                            ? `${kpis.marginPctWeighted.toFixed(1)} %`
                            : '—'}
                    </CardContent>
                </Card>
            </div>

            {rows.length === 0 && !isLoading ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">
                            {t('deliverableLifecycle.emptyTitle', 'Sin entregables en esta vista')}
                        </CardTitle>
                        <CardDescription>
                            {t(
                                'deliverableLifecycle.emptyDesc',
                                'Configura un proyecto tipo Entregable con fechas de fase o ajusta filtros.'
                            )}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild variant="default" size="sm">
                            <Link to="/clients">{t('deliverableLifecycle.ctaClients', 'Configurar en Clientes y proyectos')}</Link>
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="rounded-lg border max-w-full overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 border-b">
                            <tr className="text-slate-600">
                                <th className="p-2 font-medium min-w-[140px]">
                                    {t('deliverableLifecycle.col.project', 'Proyecto')}
                                </th>
                                <th className="p-2 font-medium min-w-[120px]">
                                    {t('deliverableLifecycle.col.client', 'Cliente')}
                                </th>
                                <th className="p-2 font-medium whitespace-nowrap">
                                    {t('deliverableLifecycle.col.phase', 'Fase')}
                                </th>
                                <th className="p-2 font-medium min-w-[100px]">
                                    {t('deliverableLifecycle.col.hours', 'Horas')}
                                </th>
                                <th className="p-2 font-medium">{t('deliverableLifecycle.col.pacing', 'Avance')}</th>
                                <th className="p-2 font-medium text-right">
                                    {t('deliverableLifecycle.col.cost', currencyLabels)}
                                </th>
                                <th className="p-2 font-medium text-right">
                                    {t('deliverableLifecycle.col.contract', currencyLabels)}
                                </th>
                                <th className="p-2 font-medium text-right">
                                    {t('deliverableLifecycle.col.accrued', currencyLabels)}
                                </th>
                                <th className="p-2 font-medium text-right">
                                    {t('deliverableLifecycle.col.marginEur', currencyLabels)}
                                </th>
                                <th className="p-2 font-medium text-right">
                                    {t('deliverableLifecycle.col.marginPct', 'Margen %')}
                                </th>
                                <th className="p-2 font-medium">{t('deliverableLifecycle.col.status', 'Estado')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(({ project: p, lc }) => {
                                const ph = lc.phase;
                                const st = getLifecycleStatusClasses(lc.status);
                                const pct = lc.hours.budget > 0 ? lc.hours.pctConsumed : 0;
                                const exp = pctExpected(lc);
                                const mEur = lc.finance.marginAbsolute;
                                const mPct = lc.finance.marginPct;
                                const semEur =
                                    mEur != null && mPct != null ? getMarginSemaphore(mPct) : null;
                                return (
                                    <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                                        <td className="p-2 font-medium text-slate-800">
                                            <SensitiveText kind="project" id={p.id}>
                                                {p.name}
                                            </SensitiveText>
                                        </td>
                                        <td className="p-2 text-slate-600">
                                            <SensitiveText kind="account" id={p.clientId}>
                                                {clients?.find((c) => c.id === p.clientId)?.name ?? '—'}
                                            </SensitiveText>
                                        </td>
                                        <td className="p-2 text-slate-600 whitespace-nowrap">
                                            {ph
                                                ? `${format(ph.start, 'd MMM', { locale: dateLocale })} – ${format(ph.due, 'd MMM yyyy', { locale: dateLocale })}`
                                                : '—'}
                                        </td>
                                        <td className="p-2">
                                            <div className="tabular-nums">
                                                {lc.hours.computed} / {lc.hours.budget} h
                                            </div>
                                            <div className="mt-1 h-1.5 w-full max-w-[120px] rounded-full bg-slate-100 overflow-hidden">
                                                <div
                                                    className="h-full bg-indigo-500 rounded-full"
                                                    style={{
                                                        width: `${Math.min(100, pct)}%`,
                                                    }}
                                                />
                                            </div>
                                        </td>
                                        <td className="p-2">
                                            <div className="tabular-nums font-medium">{pct.toFixed(0)}%</div>
                                            <div className="text-[10px] text-slate-500">
                                                {t('deliverableLifecycle.vsExpected', 'vs esp.')} {exp}%
                                            </div>
                                        </td>
                                        <td className="p-2 text-right tabular-nums">
                                            {formatMoney(lc.finance.costToDate)}
                                        </td>
                                        <td className="p-2 text-right tabular-nums">
                                            {formatMoney(lc.finance.contractFee)}
                                        </td>
                                        <td className="p-2 text-right tabular-nums">
                                            {formatMoney(lc.finance.revenueAccrued)}
                                        </td>
                                        <td
                                            className={cn(
                                                'p-2 text-right tabular-nums font-medium',
                                                mEur != null && semEur?.className
                                            )}
                                        >
                                            {mEur != null ? formatMoney(mEur) : '—'}
                                        </td>
                                        <td
                                            className={cn(
                                                'p-2 text-right tabular-nums',
                                                mPct != null && getMarginSemaphore(mPct).className
                                            )}
                                        >
                                            {mPct != null ? `${mPct.toFixed(1)} %` : '—'}
                                        </td>
                                        <td className="p-2">
                                            <span className={cn('inline-flex items-center gap-1', st.text)}>
                                                <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', st.dot)} />
                                                {st.label}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {isLoading && (
                        <p className="p-4 text-xs text-slate-500 text-center">
                            {t('common.loading', 'Cargando…')}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
