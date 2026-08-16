import type { AdsPpcAlertDetail } from '@/utils/adsPpcAlertBuild';

function escapeHtml(input: string): string {
  return input
    .split("&").join("&amp;")
    .split("<").join("&lt;")
    .split(">").join("&gt;")
    .split('"').join("&quot;")
    .split("'").join("&#039;");
}

function fmtMoney(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: currency || "EUR",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${Math.round(n)} ${currency || "EUR"}`;
  }
}

export function adsPpcStatusLabelEs(status: "over" | "risk"): string {
  return status === "over" ? "Presupuesto superado" : "En riesgo de superar presupuesto";
}

function platformLabel(platform: "google" | "meta"): string {
  return platform === "google" ? "Google Ads" : "Meta Ads";
}

function appUrlForPlatform(siteUrl: string, platform: "google" | "meta"): string {
  const base = siteUrl.replace(/\/$/, "");
  return platform === "google" ? `${base}/ads` : `${base}/meta-ads`;
}

function progressBarHtml(pct: number, tone: "over" | "risk" | "ok"): string {
  const colors = tone === "over"
    ? { bar: "#ef4444", bg: "#fee2e2" }
    : tone === "risk"
    ? { bar: "#f59e0b", bg: "#ffedd5" }
    : { bar: "#3b82f6", bg: "#dbeafe" };
  const width = Math.min(100, Math.max(0, pct));
  return `<div style="height:8px;border-radius:999px;background:${colors.bg};overflow:hidden;margin-top:6px;">
    <div style="height:8px;width:${width}%;background:${colors.bar};border-radius:999px;"></div>
  </div>`;
}

function metricCell(label: string, value: string, sub?: string): string {
  return `<td style="width:50%;padding:10px 12px;vertical-align:top;">
    <p style="margin:0 0 2px;font-size:10px;font-weight:700;letter-spacing:0.06em;color:#64748b;text-transform:uppercase;">${escapeHtml(label)}</p>
    <p style="margin:0;font-size:15px;font-weight:700;color:#0f172a;">${escapeHtml(value)}</p>
    ${sub ? `<p style="margin:4px 0 0;font-size:11px;color:#64748b;">${escapeHtml(sub)}</p>` : ""}
  </td>`;
}

function accountIdsLine(alert: AdsPpcAlertDetail): string {
  if (alert.accountRefs.length === 1) {
    return `ID ${alert.accountRefs[0]!.id}`;
  }
  return alert.accountRefs.map((r) => `${r.name} (${r.id})`).join(" · ");
}

function renderAlertBody(alert: AdsPpcAlertDetail): string {
  const cur = alert.currency;
  const tone = alert.status;
  const plat = platformLabel(alert.platform);
  const groupBadge = alert.isGroup
    ? `<span style="display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600;background:#e0e7ff;color:#3730a3;">GRUPO</span>`
    : "";

  return `
    <div style="margin-bottom:24px;padding-bottom:24px;border-bottom:1px solid #e2e8f0;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">${escapeHtml(plat)}${groupBadge}</p>
      <h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#0f172a;line-height:1.3;">${escapeHtml(alert.displayName)}</h2>
      <p style="margin:0 0 12px;font-size:12px;color:#64748b;font-family:ui-monospace,monospace;">${escapeHtml(accountIdsLine(alert))}</p>
      <span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:600;background:${tone === "over" ? "#fee2e2" : "#ffedd5"};color:${tone === "over" ? "#991b1b" : "#9a3412"};">${escapeHtml(adsPpcStatusLabelEs(alert.status))}</span>
      <p style="margin:14px 0 4px;font-size:12px;color:#475569;">Avance del mes · día ${alert.currentDay} de ${alert.daysInMonth} (${alert.daysRemaining} días restantes)</p>
      ${progressBarHtml(alert.progressPct, tone)}
      <p style="margin:6px 0 0;font-size:11px;color:#64748b;">${alert.progressPct}% del presupuesto máximo consumido · previsión ${alert.forecastPct}%</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
        <tr>
          ${metricCell("Presupuesto máximo (mes)", fmtMoney(alert.monthlyBudgetMax, cur), alert.isManualBudget ? "Límite configurado en Taimbox" : "Estimado desde campañas")}
          ${metricCell("Gastado acumulado", fmtMoney(alert.spent, cur), `${alert.progressPct}% del máximo`)}
        </tr>
        <tr>
          ${metricCell("Previsión fin de mes", fmtMoney(alert.forecast, cur), `${alert.forecastPct}% del máximo`)}
          ${metricCell("Restante disponible", fmtMoney(alert.remainingBudget, cur))}
        </tr>
        <tr>
          ${metricCell("Presupuesto diario actual", alert.currentDailyBudget > 0 ? fmtMoney(alert.currentDailyBudget, cur) : "—", "Suma campañas activas")}
          ${metricCell("Gasto medio diario", fmtMoney(alert.avgDailySpend, cur), "Ritmo real del mes")}
        </tr>
        <tr>
          ${metricCell("Diario recomendado", fmtMoney(alert.recommendedDaily, cur), "Para no superar el máximo")}
          ${metricCell("Moneda", cur)}
        </tr>
      </table>
    </div>`;
}

export function adsPpcSingleAccountEmailHtml(params: {
  agencyName: string;
  alert: AdsPpcAlertDetail;
  appUrl: string;
}): { html: string; text: string } {
  const { agencyName, alert, appUrl } = params;
  const cur = alert.currency;
  const plat = platformLabel(alert.platform);

  const text = [
    `Alerta PPC — ${agencyName}`,
    `${plat}: ${alert.displayName}`,
    accountIdsLine(alert),
    `Estado: ${adsPpcStatusLabelEs(alert.status)}`,
    `Mes: ${alert.monthKey} (día ${alert.currentDay}/${alert.daysInMonth})`,
    `Presupuesto máximo: ${fmtMoney(alert.monthlyBudgetMax, cur)}`,
    `Gastado: ${fmtMoney(alert.spent, cur)} (${alert.progressPct}%)`,
    `Previsión: ${fmtMoney(alert.forecast, cur)} (${alert.forecastPct}%)`,
    `Diario actual: ${alert.currentDailyBudget > 0 ? fmtMoney(alert.currentDailyBudget, cur) : "—"}`,
    `Diario recomendado: ${fmtMoney(alert.recommendedDaily, cur)}`,
    `Restante: ${fmtMoney(alert.remainingBudget, cur)}`,
    "",
    appUrl,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.06);">
        <tr><td style="padding:28px 28px 8px;background:linear-gradient(180deg,#f8fafc 0%,#fff 100%);">
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.1em;color:#64748b;text-transform:uppercase;">${escapeHtml(agencyName)} · ${escapeHtml(alert.monthKey)}</p>
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#0f172a;">Alerta de presupuesto PPC</h1>
        </td></tr>
        <tr><td style="padding:8px 28px 28px;">
          ${renderAlertBody(alert)}
          <p style="margin:0;"><a href="${escapeHtml(appUrl)}" style="display:inline-block;padding:10px 18px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Abrir en Taimbox</a></p>
        </td></tr>
      </table>
      <p style="margin:20px 0 0;font-size:11px;color:#94a3b8;text-align:center;">Taimbox · monitorización PPC</p>
    </td></tr>
  </table>
</body>
</html>`;

  return { html, text };
}

export function adsPpcDigestEmailHtml(params: {
  agencyName: string;
  monthLabel: string;
  alerts: AdsPpcAlertDetail[];
  siteUrl: string;
}): { html: string; text: string } {
  const { agencyName, monthLabel, alerts, siteUrl } = params;

  const cardsHtml = alerts.map((a) => {
    const url = appUrlForPlatform(siteUrl, a.platform);
    const cur = a.currency;
    const tone = a.status;
    return `<tr><td style="padding:0 0 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
        <tr><td style="padding:14px 16px;">
          <table role="presentation" width="100%"><tr>
            <td>
              <p style="margin:0 0 2px;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;">${escapeHtml(platformLabel(a.platform))}${a.isGroup ? " · GRUPO" : ""}</p>
              <p style="margin:0;font-size:16px;font-weight:700;color:#0f172a;">${escapeHtml(a.displayName)}</p>
              <p style="margin:4px 0 0;font-size:11px;color:#64748b;font-family:ui-monospace,monospace;">${escapeHtml(accountIdsLine(a))}</p>
            </td>
            <td align="right" style="vertical-align:top;">
              <a href="${escapeHtml(url)}" style="font-size:12px;color:#4f46e5;font-weight:600;text-decoration:none;">Ver →</a>
            </td>
          </tr></table>
          ${progressBarHtml(a.progressPct, tone)}
          <table role="presentation" width="100%" style="margin-top:10px;font-size:12px;color:#334155;">
            <tr>
              <td><span style="color:#64748b;">Gastado</span><br/><strong>${escapeHtml(fmtMoney(a.spent, cur))}</strong> (${a.progressPct}%)</td>
              <td><span style="color:#64748b;">Máximo mes</span><br/><strong>${escapeHtml(fmtMoney(a.monthlyBudgetMax, cur))}</strong></td>
              <td><span style="color:#64748b;">Previsión</span><br/><strong>${escapeHtml(fmtMoney(a.forecast, cur))}</strong> (${a.forecastPct}%)</td>
              <td><span style="color:#64748b;">Diario rec.</span><br/><strong>${escapeHtml(fmtMoney(a.recommendedDaily, cur))}</strong></td>
            </tr>
          </table>
        </td></tr>
      </table>
    </td></tr>`;
  }).join("");

  const textLines = [`Resumen PPC — ${agencyName}`, `Mes: ${monthLabel}`, ""];
  for (const a of alerts) {
    textLines.push(
      `· ${platformLabel(a.platform)} — ${a.displayName} (${accountIdsLine(a)})`,
      `  ${adsPpcStatusLabelEs(a.status)}: ${fmtMoney(a.spent, a.currency)} / ${fmtMoney(a.monthlyBudgetMax, a.currency)} · prev. ${fmtMoney(a.forecast, a.currency)}`,
    );
  }

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:system-ui,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:14px;border:1px solid #e2e8f0;">
        <tr><td style="padding:28px 28px 12px;">
          <h1 style="margin:0 0 6px;font-size:20px;color:#0f172a;">Resumen de alertas PPC</h1>
          <p style="margin:0;font-size:14px;color:#64748b;">${escapeHtml(agencyName)} · ${escapeHtml(monthLabel)} · ${alerts.length} cuenta(s)</p>
        </td></tr>
        <tr><td style="padding:0 20px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${cardsHtml}</table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { html, text: textLines.join("\n") };
}
