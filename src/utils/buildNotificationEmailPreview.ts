import { absoluteUrl } from '@/lib/publicSiteUrl';
import { supabase } from '@/lib/supabase';
import type { Allocation, Project } from '@/types';
import type {
  AdsPlatformFilter,
  AdsPpcIssueFlag,
  CoherenceOpStatus,
  NotificationIssueFlag,
  NotificationRule,
} from '@/types/notifications';
import { fetchDeadlinesForMonth } from '@/utils/deadlineUtils';
import {
  buildAdsPpcAlerts,
  sampleAdsPpcAlertDetail,
  type AdsCampaignRow,
  type AdsClientSettingRow,
} from '@/utils/adsPpcAlertBuild';
import {
  analyzeProjectMonthForNotifications,
  passesProjectClientFilters,
  projectMatchesIssueFlags,
  type AllocationRow,
  type ProjectIssueFlag,
  type ProjectRow,
} from '@/utils/projectNotificationMetrics';
import {
  adsPpcDigestEmailHtml,
  adsPpcSingleAccountEmailHtml,
  adsPpcStatusLabelEs,
  coherenceDigestEmailHtml,
  coherenceSingleProjectEmailHtml,
  operationalStatusFromInconsistency,
  scheduledProjectAlertEmailHtml,
  statusLabelEs,
  taskTransferEmailHtml,
} from '@/utils/notificationEmailPreviewHtml';
import type { Inconsistency } from '@/utils/planningCoherenceCompute';
import { computeGlobalPlanningInconsistencies } from '@/utils/planningCoherenceCompute';

export interface NotificationPreviewInput {
  rule: NotificationRule;
  agencyId: string;
  agencyName: string;
  hoursTrackingPreference: 'actual' | 'computed' | null | undefined;
  allocations: Allocation[];
  projects: Project[];
  employees: Array<{ id: string; name: string; avatarUrl?: string }>;
}

export interface NotificationPreviewResult {
  html: string;
  subject: string;
  note?: string;
}

function utcMonthContext(): { viewMonth: Date; monthKey: string; monthProgress: number } {
  const now = new Date();
  const viewMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const monthProgress = Math.round((now.getUTCDate() / daysInMonth) * 100);
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return { viewMonth, monthKey, monthProgress };
}

function issueLabels(flags: NotificationIssueFlag[]): string[] {
  const labels: string[] = [];
  for (const f of flags) {
    switch (f) {
      case 'needs_planning':
        labels.push('Falta planificación (horas asignadas vs mínimo/presupuesto)');
        break;
      case 'behind_schedule':
        labels.push('Ritmo de ejecución por debajo del esperado para el mes');
        break;
      case 'over_budget':
        labels.push('Horas planificadas por encima del presupuesto mensual');
        break;
      case 'no_activity':
        labels.push('Sin horas planificadas pese a tener presupuesto');
        break;
    }
  }
  return labels;
}

function toHoursPref(p: NotificationPreviewInput['hoursTrackingPreference']): 'actual' | 'computed' {
  return p === 'actual' ? 'actual' : 'computed';
}

function mapAllocations(allocs: Allocation[]): AllocationRow[] {
  return allocs.map((a) => ({
    project_id: a.projectId,
    employee_id: a.employeeId,
    week_start_date: a.weekStartDate,
    hours_assigned: Number(a.hoursAssigned) || 0,
    status: a.status,
    hours_actual: a.hoursActual ?? null,
    hours_computed: a.hoursComputed ?? null,
  }));
}

function passesCoherenceThreshold(inc: Inconsistency, minAbs: number): boolean {
  if (Math.abs(inc.totalDifference) >= minAbs) return true;
  return inc.employees.some((e) => Math.abs(e.difference) >= minAbs);
}

function passesProjectClientFiltersCoherence(
  inc: Inconsistency,
  clientByProjectId: Map<string, string>,
  projectIds?: string[],
  clientIds?: string[],
): boolean {
  if (projectIds?.length && !projectIds.includes(inc.projectId)) return false;
  const cid = clientByProjectId.get(inc.projectId);
  if (clientIds?.length && (!cid || !clientIds.includes(cid))) return false;
  return true;
}

const DEFAULT_MATCH: NotificationIssueFlag[] = [
  'needs_planning',
  'behind_schedule',
  'over_budget',
  'no_activity',
];

const DEFAULT_COHERENCE_OPS: CoherenceOpStatus[] = [
  'over-budget',
  'behind-schedule',
  'needs-planning',
  'no-activity',
];

export async function buildNotificationEmailPreview(
  input: NotificationPreviewInput,
): Promise<NotificationPreviewResult> {
  const { rule, agencyName } = input;
  const hoursPref = toHoursPref(input.hoursTrackingPreference);

  if (rule.triggerType === 'task_transfer_pending') {
    const { html } = taskTransferEmailHtml({
      agencyName,
      fromName: 'Ana García',
      toName: 'Luis Pérez',
      projectName: 'Proyecto ejemplo (marca / cliente)',
      taskName: 'Tarea de ejemplo — revisión creativo',
      hours: '4',
      reason: 'Prioridad cambiada; necesito foco en otro cliente.',
      appUrl: absoluteUrl('/planner'),
    });
    return {
      html,
      subject: `Nueva solicitud de transferencia — ${agencyName}`,
      note: 'Datos de ejemplo: el correo real usará empleados, proyecto, tarea y horas de cada solicitud.',
    };
  }

  const { viewMonth, monthKey, monthProgress } = utcMonthContext();
  const evalMode = rule.conditions.evaluation ?? 'project_month_health';

  if (evalMode === 'ads_ppc_budget') {
    const matchAny = (rule.conditions.ads_match_any?.length
      ? rule.conditions.ads_match_any
      : ['over', 'risk']) as AdsPpcIssueFlag[];
    const platforms = (rule.conditions.ads_platforms?.length
      ? rule.conditions.ads_platforms
      : ['google', 'meta']) as AdsPlatformFilter[];
    const delivery = rule.conditions.ads_delivery_mode ?? 'per_account';
    const digestMax = rule.conditions.ads_digest_max ?? 12;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;

    const campaignFields =
      'client_id, client_name, cost, date, daily_budget, status, budget_id, campaign_name';

    const [
      settingsRes,
      googleCampaignsRes,
      metaCampaignsRes,
      googleAccountsRes,
      metaAccountsRes,
      googleRulesRes,
      metaRulesRes,
    ] = await Promise.all([
      supabase
        .from('client_settings')
        .select('client_id, budget_limit, group_name, is_hidden')
        .eq('agency_id', input.agencyId),
      platforms.includes('google')
        ? supabase
            .from('google_ads_campaigns')
            .select(campaignFields)
            .eq('agency_id', input.agencyId)
            .gte('date', monthStart)
            .lte('date', monthEnd)
        : Promise.resolve({ data: [] }),
      platforms.includes('meta')
        ? supabase
            .from('meta_ads_campaigns')
            .select('client_id, client_name, cost, date, status, campaign_name')
            .eq('agency_id', input.agencyId)
            .gte('date', monthStart)
            .lte('date', monthEnd)
        : Promise.resolve({ data: [] }),
      platforms.includes('google')
        ? supabase
            .from('ad_accounts_config')
            .select('account_id, account_name')
            .eq('agency_id', input.agencyId)
            .eq('platform', 'google')
            .eq('is_active', true)
        : Promise.resolve({ data: [] }),
      platforms.includes('meta')
        ? supabase
            .from('ad_accounts_config')
            .select('account_id, account_name')
            .eq('agency_id', input.agencyId)
            .eq('platform', 'meta')
            .eq('is_active', true)
        : Promise.resolve({ data: [] }),
      platforms.includes('google')
        ? supabase
            .from('segmentation_rules')
            .select('account_id, keyword, virtual_name')
            .eq('agency_id', input.agencyId)
            .eq('platform', 'google')
        : Promise.resolve({ data: [] }),
      platforms.includes('meta')
        ? supabase
            .from('segmentation_rules')
            .select('account_id, keyword, virtual_name')
            .eq('agency_id', input.agencyId)
            .eq('platform', 'meta')
        : Promise.resolve({ data: [] }),
    ]);

    const settings = (settingsRes.data ?? []) as AdsClientSettingRow[];
    const googleCampaigns = (googleCampaignsRes.data ?? []) as AdsCampaignRow[];
    const metaCampaigns = (metaCampaignsRes.data ?? []) as AdsCampaignRow[];

    const alerts = buildAdsPpcAlerts({
      settings,
      google: platforms.includes('google')
        ? {
            campaigns: googleCampaigns,
            accounts: googleAccountsRes.data ?? [],
            rules: googleRulesRes.data ?? [],
          }
        : undefined,
      meta: platforms.includes('meta')
        ? {
            campaigns: metaCampaigns,
            accounts: metaAccountsRes.data ?? [],
            rules: metaRulesRes.data ?? [],
          }
        : undefined,
      platforms,
      now,
    }).filter((a) => matchAny.includes(a.status));

    const siteUrl = absoluteUrl('');
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;

    if (alerts.length === 0) {
      const sample = { ...sampleAdsPpcAlertDetail(), monthKey };
      const { html } = adsPpcSingleAccountEmailHtml({
        agencyName,
        alert: sample,
        appUrl: absoluteUrl('/ads'),
      });
      return {
        html,
        subject: `PPC: ${sample.displayName} — ${adsPpcStatusLabelEs(sample.status)} (${monthKey})`,
        note:
          'Ahora mismo ninguna cuenta cumple estas condiciones. El ejemplo muestra el nivel de detalle del correo real (nombre, IDs, presupuestos y ritmo diario).',
      };
    }

    if (delivery === 'digest') {
      const slice = alerts.slice(0, digestMax);
      const { html } = adsPpcDigestEmailHtml({
        agencyName,
        monthLabel: monthKey,
        alerts: slice,
        siteUrl,
      });
      return {
        html,
        subject: `Alertas PPC — ${slice.length} cuenta(s) · ${monthKey}`,
      };
    }

    const first = alerts[0];
    const { html } = adsPpcSingleAccountEmailHtml({
      agencyName,
      alert: first,
      appUrl: absoluteUrl(first.platform === 'google' ? '/ads' : '/meta-ads'),
    });
    return {
      html,
      subject: `PPC: ${first.displayName} — ${adsPpcStatusLabelEs(first.status)} (${monthKey})`,
      note:
        alerts.length > 1
          ? `Con los datos actuales habría ${alerts.length} correos (uno por cuenta); aquí ves el primero.`
          : undefined,
    };
  }

  if (evalMode === 'deadline_coherence') {
    const { data: deadlines = [], error } = await fetchDeadlinesForMonth(monthKey, input.agencyId);
    if (error) {
      throw error;
    }

    const inconsistencies = computeGlobalPlanningInconsistencies({
      deadlines,
      allocations: input.allocations,
      projects: input.projects,
      employees: input.employees,
      viewDate: viewMonth,
      allowedEmployeeIds: null,
      selectedEmployeeId: 'all',
      selectedProjectId: 'all',
      hideProjectSearch: false,
      hoursTrackingPreference: input.hoursTrackingPreference ?? null,
    });

    const clientByProjectId = new Map(input.projects.map((p) => [p.id, p.clientId]));
    const minAbs = rule.conditions.coherence_min_abs_hours ?? 0.05;
    const opIn = (rule.conditions.coherence_op_status_in?.length
      ? rule.conditions.coherence_op_status_in
      : DEFAULT_COHERENCE_OPS) as CoherenceOpStatus[];

    const flagged: Array<{ inc: Inconsistency; opStatus: CoherenceOpStatus }> = [];
    for (const inc of inconsistencies) {
      if (
        !passesProjectClientFiltersCoherence(
          inc,
          clientByProjectId,
          rule.conditions.project_ids,
          rule.conditions.client_ids,
        )
      ) {
        continue;
      }
      if (!passesCoherenceThreshold(inc, minAbs)) continue;
      const opStatus = operationalStatusFromInconsistency(inc, monthProgress);
      if (!opIn.includes(opStatus)) continue;
      flagged.push({ inc, opStatus });
    }

    const appUrl = absoluteUrl('/operaciones');
    const delivery = rule.conditions.coherence_delivery_mode ?? 'per_project';
    const digestMax = rule.conditions.coherence_digest_max ?? 12;

    if (flagged.length === 0) {
      if (inconsistencies.length > 0) {
        const inc = inconsistencies[0];
        const opStatus = operationalStatusFromInconsistency(inc, monthProgress);
        const { html } = coherenceSingleProjectEmailHtml({
          agencyName,
          monthLabel: monthKey,
          inc,
          opStatus,
          appUrl,
        });
        return {
          html,
          subject: `${statusLabelEs(opStatus)}: ${inc.projectName} (${monthKey})`,
          note:
            'Ahora mismo ningún proyecto cumple el umbral y los estados de esta regla. Mostramos un ejemplo con el primer proyecto del informe de coherencia del mes (calendario universal UTC, igual que en el envío real).',
        };
      }
      return {
        html: `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/></head><body style="margin:0;font-family:system-ui;padding:24px;background:#f1f5f9;color:#334155;">
<p>No hay datos de coherencia para <strong>${monthKey}</strong> o no hay deadlines ni planificación suficiente en proyectos activos.</p></body></html>`,
        subject: `Vista previa — coherencia (${monthKey})`,
        note: 'No hay proyectos que mostrar con los datos actuales (o falta información de deadlines y planificación para este mes).',
      };
    }

    if (delivery === 'digest') {
      const slice = flagged.slice(0, digestMax);
      const intro = `Resumen de ${slice.length} proyecto(s) con desviación respecto a deadlines / planificación (umbral ≥ ${minAbs}h).`;
      const { html } = coherenceDigestEmailHtml({
        agencyName,
        monthLabel: monthKey,
        intro,
        items: slice,
        appUrl,
      });
      return {
        html,
        subject: `Coherencia de planificación — ${slice.length} proyecto(s) · ${monthKey}`,
      };
    }

    const { inc, opStatus } = flagged[0];
    const { html } = coherenceSingleProjectEmailHtml({
      agencyName,
      monthLabel: monthKey,
      inc,
      opStatus,
      appUrl,
    });
    return {
      html,
      subject: `${statusLabelEs(opStatus)}: ${inc.projectName} (${monthKey})`,
      note:
        flagged.length > 1
          ? `Con los datos actuales habría ${flagged.length} correos (uno por proyecto); aquí ves el primero.`
          : undefined,
    };
  }

  const matchAny = (rule.conditions.match_any?.length ? rule.conditions.match_any : DEFAULT_MATCH) as NotificationIssueFlag[];
  const allocRows = mapAllocations(input.allocations);
  const activeProjects = input.projects.filter((p) => p.status === 'active');

  let firstMatch: {
    projectName: string;
    matched: NotificationIssueFlag[];
  } | null = null;

  for (const p of activeProjects) {
    const row: ProjectRow = {
      id: p.id,
      client_id: p.clientId,
      status: p.status,
      budget_hours: p.budgetHours,
      minimum_hours: p.minimumHours ?? null,
    };
    const analysis = analyzeProjectMonthForNotifications(row, allocRows, viewMonth, monthProgress, hoursPref);
    if (!analysis) continue;
    if (!passesProjectClientFilters(analysis, rule.conditions.project_ids, rule.conditions.client_ids)) continue;
    if (!projectMatchesIssueFlags(analysis, matchAny as ProjectIssueFlag[])) continue;
    const matchedFlags = matchAny.filter((f) => projectMatchesIssueFlags(analysis, [f as ProjectIssueFlag]));
    firstMatch = {
      projectName: p.name,
      matched: (matchedFlags.length ? matchedFlags : matchAny) as NotificationIssueFlag[],
    };
    break;
  }

  const appUrl = absoluteUrl('/projects');

  if (!firstMatch) {
    const { html } = scheduledProjectAlertEmailHtml({
      agencyName,
      projectName: 'Ejemplo — nombre del proyecto',
      issues: issueLabels(matchAny),
      monthLabel: monthKey,
      appUrl,
    });
    return {
      html,
      subject: `Alerta de proyecto: Ejemplo — nombre del proyecto (${monthKey})`,
      note:
        'Ahora mismo ningún proyecto activo cumple estas condiciones. El ejemplo muestra cómo se verían las alertas que tienes marcadas. El mes de referencia usa el calendario universal (UTC), igual que en el envío automático.',
    };
  }

  const { html } = scheduledProjectAlertEmailHtml({
    agencyName,
    projectName: firstMatch.projectName,
    issues: issueLabels(firstMatch.matched),
    monthLabel: monthKey,
    appUrl,
  });

  return {
    html,
    subject: `Alerta de proyecto: ${firstMatch.projectName} (${monthKey})`,
  };
}
