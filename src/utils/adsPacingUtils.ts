export type AdsPlatform = 'google' | 'meta';

export type AdsPacingStatus = 'ok' | 'risk' | 'over' | 'under';

export interface AdsMonthBounds {
  currentDay: number;
  daysInMonth: number;
  daysRemaining: number;
  monthKey: string;
  monthStart: string;
  monthEnd: string;
}

export interface AdsClientSettings {
  budget: number;
  group_name: string;
  is_hidden: boolean;
  is_sales_account: boolean;
}

export type AdsClientSettingsMap = Record<string, AdsClientSettings>;

export interface AdsClientSettingsRow {
  client_id: string;
  budget_limit?: number | string | null;
  group_name?: string | null;
  is_hidden?: boolean | null;
  is_sales_account?: boolean | null;
}

export function getAdsMonthBounds(now: Date = new Date()): AdsMonthBounds {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentDay = now.getDate();
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  return {
    currentDay,
    daysInMonth,
    // Google has always counted today. Meta intentionally aligns so the last day is never zero.
    daysRemaining: Math.max(1, daysInMonth - currentDay + 1),
    monthKey,
    monthStart: `${monthKey}-01`,
    monthEnd: `${monthKey}-${String(daysInMonth).padStart(2, '0')}`,
  };
}

export function formatAdsProjectName(name: string): string {
  return (name || '').replace(/^(Cliente|Client|Cuenta|Account)\s*[-:]?\s*/i, '');
}

export function normalizeAdsAccountId(id: string | null | undefined, platform: AdsPlatform): string {
  const normalized = id?.trim() || '';
  return platform === 'meta' ? normalized.replace(/^act_/, '') : normalized;
}

export function getRoasColor(roas: number): string {
  if (roas >= 4) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
  if (roas >= 2) return 'text-blue-600 bg-blue-50 border-blue-200';
  if (roas >= 1) return 'text-amber-600 bg-amber-50 border-amber-200';
  return 'text-red-600 bg-red-50 border-red-200';
}

export function mapClientSettingsRows(rows: AdsClientSettingsRow[] | null | undefined): AdsClientSettingsMap {
  const settings: AdsClientSettingsMap = {};

  rows?.forEach((row) => {
    settings[row.client_id] = {
      budget: Number(row.budget_limit) || 0,
      group_name: row.group_name || '',
      is_hidden: Boolean(row.is_hidden),
      is_sales_account: row.is_sales_account !== false,
    };
  });

  return settings;
}

export function computePacingMetrics(input: {
  spent: number;
  budget: number;
  month: Pick<AdsMonthBounds, 'currentDay' | 'daysInMonth' | 'daysRemaining'>;
  currentDailyBudget?: number;
}): {
  avgDailySpend: number;
  forecast: number;
  progress: number;
  remainingBudget: number;
  recommendedDaily: number;
  status: AdsPacingStatus;
} {
  const { spent, budget, month } = input;
  const currentDailyBudget = input.currentDailyBudget || 0;
  const avgDailySpend = month.currentDay > 0 ? spent / month.currentDay : 0;
  const forecast = currentDailyBudget > 0
    ? spent + currentDailyBudget * month.daysRemaining
    : avgDailySpend * month.daysInMonth;
  const progress = budget > 0 ? (spent / budget) * 100 : 0;
  const remainingBudget = Math.max(0, budget - spent);
  const recommendedDaily = month.daysRemaining > 0
    ? remainingBudget / month.daysRemaining
    : 0;

  let status: AdsPacingStatus = 'ok';
  if (budget > 0) {
    if (spent > budget) status = 'over';
    else if (forecast > budget) status = 'risk';
    else if (progress < 50 && month.currentDay > 20) status = 'under';
  }

  return {
    avgDailySpend,
    forecast,
    progress,
    remainingBudget,
    recommendedDaily,
    status,
  };
}
