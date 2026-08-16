/**
 * Plantillas HTML de notificaciones para vista previa en el cliente.
 * - Plantillas genéricas: alinear con `supabase/functions/_shared/notification-email-templates.ts`.
 * - Coherencia: la vista previa replica el diseño compacto de Seguimiento operativo
 *   (`GlobalPlanningInconsistencies` con radar); el correo real lo genera la Edge Function
 *   (`supabase/functions/_shared/coherence-email-html.ts`).
 */

import type { Inconsistency } from '@/utils/planningCoherenceCompute';

export type CoherenceOpStatus =
  | 'over-budget'
  | 'behind-schedule'
  | 'needs-planning'
  | 'no-activity'
  | 'in-rule';

function escapeHtml(input: string): string {
  return input
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;')
    .split('"').join('&quot;')
    .split("'").join('&#039;');
}

function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function operationalStatusFromInconsistency(
  inc: Inconsistency,
  monthProgress: number,
): CoherenceOpStatus {
  const effectiveUsage = round2(inc.totalPlannedHours + inc.totalComputedHours);
  const budget = inc.budgetHours;
  const planned = inc.totalPlannedHours;
  const computed = inc.totalComputedHours;

  const deadlineExcess = inc.totalDeadlineHours > 0 && inc.totalDifference > 0.05;
  const effectiveOverBudget = budget > 0 && round2(effectiveUsage) > round2(budget);
  if (deadlineExcess || effectiveOverBudget) return 'over-budget';

  if (budget > 0 && monthProgress > 30) {
    const executionPct = effectiveUsage > 0 ? (computed / effectiveUsage) * 100 : 0;
    if (executionPct < monthProgress - 20) return 'behind-schedule';
  }

  if (budget > 0 && planned === 0 && computed === 0) return 'no-activity';

  const shortOfBudget = budget > 0 && effectiveUsage < round2(budget);
  if (shortOfBudget) return 'needs-planning';

  return 'in-rule';
}

export function statusLabelEs(status: CoherenceOpStatus): string {
  switch (status) {
    case 'over-budget':
      return 'Exceso horas';
    case 'behind-schedule':
      return 'Retrasados';
    case 'needs-planning':
      return 'Falta planificar';
    case 'no-activity':
      return 'Sin actividad';
    default:
      return 'En regla';
  }
}

export function taskTransferEmailHtml(params: {
  agencyName: string;
  fromName: string;
  toName: string;
  projectName: string;
  taskName: string;
  hours: string;
  reason?: string | null;
  appUrl: string;
}): { html: string; text: string } {
  const { agencyName, fromName, toName, projectName, taskName, hours, reason, appUrl } = params;
  const safe = {
    agencyName: escapeHtml(agencyName),
    fromName: escapeHtml(fromName),
    toName: escapeHtml(toName),
    projectName: escapeHtml(projectName),
    taskName: escapeHtml(taskName),
    hours: escapeHtml(hours),
    reason: reason ? escapeHtml(reason) : '',
    appUrl: escapeHtml(appUrl),
  };

  const text = [
    `Nueva solicitud de transferencia de tarea — ${agencyName}`,
    ``,
    `De: ${fromName}`,
    `Para: ${toName}`,
    `Proyecto: ${projectName}`,
    `Tarea: ${taskName}`,
    `Horas: ${hours}`,
    reason ? `Motivo: ${reason}` : '',
    ``,
    `Abre Taimbox para aceptar o rechazar: ${appUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8" /><title>Transferencia de tarea</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:system-ui,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;max-width:560px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
        <tr><td style="background:linear-gradient(135deg,#4f46e5,#6366f1);padding:24px 28px;text-align:center;">
          <span style="font-size:20px;font-weight:700;color:#fff;">Taimbox</span>
        </td></tr>
        <tr><td style="padding:28px 28px 8px;">
          <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a;">Nueva solicitud de transferencia</h1>
          <p style="margin:0;color:#64748b;font-size:14px;">${safe.agencyName}</p>
        </td></tr>
        <tr><td style="padding:8px 28px 28px;font-size:15px;color:#334155;line-height:1.6;">
          <p style="margin:12px 0;"><strong>De:</strong> ${safe.fromName}</p>
          <p style="margin:12px 0;"><strong>Para:</strong> ${safe.toName}</p>
          <p style="margin:12px 0;"><strong>Proyecto:</strong> ${safe.projectName}</p>
          <p style="margin:12px 0;"><strong>Tarea:</strong> ${safe.taskName}</p>
          <p style="margin:12px 0;"><strong>Horas:</strong> ${safe.hours}</p>
          ${reason ? `<p style="margin:12px 0;"><strong>Motivo:</strong> ${safe.reason}</p>` : ''}
          <p style="margin:24px 0 0;">
            <a href="${safe.appUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">Abrir planificador</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { html, text };
}

export function scheduledProjectAlertEmailHtml(params: {
  agencyName: string;
  projectName: string;
  issues: string[];
  monthLabel: string;
  appUrl: string;
}): { html: string; text: string } {
  const { agencyName, projectName, issues, monthLabel, appUrl } = params;
  const safeAgency = escapeHtml(agencyName);
  const safeProject = escapeHtml(projectName);
  const safeMonth = escapeHtml(monthLabel);
  const safeUrl = escapeHtml(appUrl);
  const listHtml = issues.map((i) => `<li>${escapeHtml(i)}</li>`).join('');
  const text = [
    `Alerta de proyecto — ${agencyName}`,
    `Proyecto: ${projectName}`,
    `Mes: ${monthLabel}`,
    ...issues.map((i) => `• ${i}`),
    ``,
    appUrl,
  ].join('\n');

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:system-ui,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;max-width:560px;width:100%;">
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 8px;font-size:18px;color:#0f172a;">Alerta de proyecto</h1>
          <p style="margin:0 0 16px;color:#64748b;font-size:14px;">${safeAgency} · ${safeMonth}</p>
          <p style="margin:0 0 12px;font-size:16px;color:#334155;"><strong>${safeProject}</strong></p>
          <ul style="margin:0;padding-left:20px;color:#334155;">${listHtml}</ul>
          <p style="margin:24px 0 0;"><a href="${safeUrl}" style="color:#4f46e5;">Ver en Taimbox</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { html, text };
}

/** Formato de horas alineado con la tarjeta de coherencia en Seguimiento operativo. */
function fmtHours(h: number): string {
  return h % 1 === 0 ? String(h) : String(Math.round(h * 100) / 100);
}

function statusBadgeStylePreview(opStatus: CoherenceOpStatus): { bg: string; color: string; border: string } {
  switch (opStatus) {
    case 'over-budget':
      return { bg: '#fee2e2', color: '#991b1b', border: '#fecaca' };
    case 'behind-schedule':
      return { bg: '#ffedd5', color: '#9a3412', border: '#fdba74' };
    case 'needs-planning':
      return { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' };
    case 'no-activity':
      return { bg: '#f1f5f9', color: '#334155', border: '#e2e8f0' };
    default:
      return { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' };
  }
}

function renderCoherenceProjectBlockPreview(
  inc: Inconsistency,
  opStatus: CoherenceOpStatus,
  monthLabel: string,
): string {
  const isPositive = inc.totalDifference > 0;
  const cardBg = isPositive ? '#fffbeb' : '#eff6ff';
  const cardBorder = isPositive ? '#fde68a' : '#bfdbfe';
  const badge = statusBadgeStylePreview(opStatus);
  const htc =
    inc.budgetHours > 0 ? Math.round(Math.max(0, inc.budgetHours - inc.totalComputedHours) * 100) / 100 : null;

  const deltaColor = isPositive ? '#b45309' : '#1d4ed8';

  const budgetLine =
    inc.budgetHours > 0 || inc.minimumHours > 0
      ? `<div style="margin-top:4px;font-size:10px;color:#64748b;line-height:1.4;">
          ${inc.budgetHours > 0 ? `Asignadas: <strong style="color:#334155;">${escapeHtml(fmtHours(inc.budgetHours))}h</strong>` : ''}
          ${inc.budgetHours > 0 && inc.minimumHours > 0 ? ' <span style="color:#cbd5e1">•</span> ' : ''}
          ${inc.minimumHours > 0 ? `Mínimo: <strong style="color:#334155;">${escapeHtml(fmtHours(inc.minimumHours))}h</strong>` : ''}
        </div>`
      : '';

  const noDlBanner =
    inc.totalDeadlineHours === 0
      ? `<div style="margin-top:6px;padding:6px 8px;font-size:11px;color:#92400e;background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;line-height:1.4;">
          Este proyecto no figura en el deadline del mes; la fila de abajo resume planificación y cómputo del equipo.
        </div>`
      : '';

  let mainLine = '';
  if (inc.totalDeadlineHours === 0) {
    mainLine = `
      <div style="margin-top:6px;font-size:12px;color:#334155;line-height:1.65;flex-wrap:wrap;">
        <span style="color:#64748b;font-style:italic">Sin deadline</span>
        <span style="color:#cbd5e1;margin:0 4px;">→</span>
        <span style="color:#2563eb">Plan: <strong>${escapeHtml(fmtHours(inc.totalPlannedHours))}h</strong></span>
        <span style="color:#059669;margin-left:6px;">Comp: <strong>${escapeHtml(fmtHours(inc.totalComputedHours))}h</strong></span>
        ${
          htc !== null
            ? `<span style="color:#cbd5e1;margin:0 4px;">→</span><span style="color:#64748b">Por computar</span> <span style="font-family:ui-monospace,monospace;font-weight:600;color:#2563eb;">${fmtHours(htc)}h</span>`
            : ''
        }
        <span style="color:#cbd5e1;margin:0 4px;">→</span>
        <span style="color:#64748b">Plan+Comp:</span>
        <strong style="color:${deltaColor};margin-left:4px;">${isPositive ? '+' : ''}${escapeHtml(fmtHours(inc.totalDifference))}h</strong>
      </div>`;
  } else {
    mainLine = `
      <div style="margin-top:6px;font-size:12px;color:#334155;line-height:1.65;">
        <span style="color:#64748b">Deadline:</span> <strong>${escapeHtml(fmtHours(inc.totalDeadlineHours))}h</strong>
        <span style="color:#cbd5e1;margin:0 4px;">→</span>
        <span style="color:#2563eb">Plan: <strong>${escapeHtml(fmtHours(inc.totalPlannedHours))}h</strong></span>
        <span style="color:#059669;margin-left:6px;">Comp: <strong>${escapeHtml(fmtHours(inc.totalComputedHours))}h</strong></span>
        ${
          htc !== null
            ? `<span style="color:#cbd5e1;margin:0 4px;">→</span><span style="color:#64748b">Por computar</span> <span style="font-family:ui-monospace,monospace;font-weight:600;color:#2563eb;">${fmtHours(htc)}h</span>`
            : ''
        }
        <span style="color:#cbd5e1;margin:0 4px;">→</span>
        <span style="color:#64748b">Vs deadline:</span>
        <strong style="color:${deltaColor};margin-left:4px;">${isPositive ? '+' : ''}${escapeHtml(fmtHours(inc.totalDifference))}h</strong>
      </div>`;
  }

  const employeesHtml = inc.employees.length
    ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid ${isPositive ? '#fcd34d' : '#93c5fd'};">
        <div style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;margin-bottom:6px;">
          Empleados afectados (${inc.employees.length})
        </div>
        ${inc.employees
          .map((emp) => {
            const empPos = emp.difference > 0;
            const dCol = empPos ? '#d97706' : '#2563eb';
            const head = emp.hasDeadline
              ? `<span style="color:#64748b">Deadline: <strong style="color:#334155;">${escapeHtml(fmtHours(emp.deadlineHours))}h</strong></span><span style="color:#cbd5e1;margin:0 4px;">→</span>`
              : `<span style="color:#d97706;font-style:italic;font-weight:600;margin-right:6px;">No incluido en deadline</span>`;
            return `<div style="font-size:12px;background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;margin-bottom:6px;">
            <div style="font-weight:600;color:#334155;margin-bottom:4px;">${escapeHtml(emp.employeeName)}</div>
            <div style="font-size:10px;line-height:1.55;color:#334155;">
              ${head}
              <span style="color:#2563eb">Plan: <strong>${escapeHtml(fmtHours(emp.plannedHours))}h</strong></span>
              <span style="color:#059669;margin-left:4px;">Comp: <strong>${escapeHtml(fmtHours(emp.computedHours))}h</strong></span>
              <span style="color:#cbd5e1;margin:0 4px;">→</span>
              <span style="color:#64748b">Vs DL:</span>
              <strong style="color:${dCol};margin-left:3px;">${empPos ? '+' : ''}${escapeHtml(fmtHours(emp.difference))}h</strong>
            </div>
          </div>`;
          })
          .join('')}
      </div>`
    : '';

  return `<div style="background:${cardBg};border:1px solid ${cardBorder};border-radius:8px;padding:10px 12px;margin-bottom:10px;">
    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-bottom:2px;">
      <span style="font-size:14px;font-weight:600;color:#1e293b;">${escapeHtml(inc.projectName)}</span>
      <span style="font-size:10px;padding:2px 8px;border-radius:999px;background:${badge.bg};color:${badge.color};border:1px solid ${badge.border};font-weight:600;">
        ${escapeHtml(statusLabelEs(opStatus))}
      </span>
    </div>
    <div style="font-size:10px;color:#94a3b8;">Mes ${escapeHtml(monthLabel)}</div>
    ${budgetLine}
    ${noDlBanner}
    ${mainLine}
    ${employeesHtml}
  </div>`;
}

/** Vista previa compacta (misma lectura que la card en /operaciones); el envío real usa `coherence-email-html.ts` en Edge. */
function coherencePreviewEmailWrapper(params: {
  title: string;
  subtitle: string;
  intro: string;
  blocks: string;
  ctaUrl: string;
  ctaText: string;
}): string {
  const { title, subtitle, intro, blocks, ctaUrl, ctaText } = params;
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,-apple-system,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:16px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;">
        <tr><td style="padding:14px 16px 10px;border-bottom:1px solid #f1f5f9;">
          <div style="font-size:16px;font-weight:700;color:#0f172a;">${escapeHtml(title)}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px;">${escapeHtml(subtitle)}</div>
          <p style="margin:8px 0 0;font-size:13px;color:#475569;line-height:1.45;">${escapeHtml(intro)}</p>
        </td></tr>
        <tr><td style="padding:12px 16px 16px;">
          ${blocks}
        </td></tr>
        <tr><td style="padding:0 16px 16px;text-align:center;">
          <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;">${escapeHtml(ctaText)}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function coherenceDigestEmailHtml(params: {
  agencyName: string;
  monthLabel: string;
  intro: string;
  items: Array<{ inc: Inconsistency; opStatus: CoherenceOpStatus }>;
  appUrl: string;
}): { html: string; text: string } {
  const { agencyName, monthLabel, intro, items, appUrl } = params;
  const blocks = items
    .map(({ inc, opStatus }) => renderCoherenceProjectBlockPreview(inc, opStatus, monthLabel))
    .join('\n');

  const text = [
    `${intro} — ${agencyName} (${monthLabel})`,
    '',
    ...items.map(
      ({ inc, opStatus }) => `${inc.projectName} [${statusLabelEs(opStatus)}] — Δ ${inc.totalDifference}h — ${appUrl}`,
    ),
  ].join('\n');

  const html = coherencePreviewEmailWrapper({
    title: 'Coherencia de planificación',
    subtitle: `${agencyName} · ${monthLabel}`,
    intro,
    blocks,
    ctaUrl: appUrl,
    ctaText: 'Abrir seguimiento operativo',
  });

  return { html, text };
}

export function coherenceSingleProjectEmailHtml(params: {
  agencyName: string;
  monthLabel: string;
  inc: Inconsistency;
  opStatus: CoherenceOpStatus;
  appUrl: string;
}): { html: string; text: string } {
  const intro =
    'Detalle de desviación entre deadline y planificación del equipo (misma vista que en Taimbox).';
  return coherenceDigestEmailHtml({
    agencyName: params.agencyName,
    monthLabel: params.monthLabel,
    intro,
    items: [{ inc: params.inc, opStatus: params.opStatus }],
    appUrl: params.appUrl,
  });
}

export {
  adsPpcDigestEmailHtml,
  adsPpcSingleAccountEmailHtml,
  adsPpcStatusLabelEs,
} from '@/utils/adsPpcEmailHtml';
