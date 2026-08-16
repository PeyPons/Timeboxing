import { describe, expect, it } from 'vitest';
import {
  computePacingMetrics,
  formatAdsProjectName,
  getAdsMonthBounds,
  mapClientSettingsRows,
  normalizeAdsAccountId,
} from '@/utils/adsPacingUtils';

describe('adsPacingUtils', () => {
  it('counts the current day and keeps one remaining day at month end', () => {
    const bounds = getAdsMonthBounds(new Date(2026, 1, 28));

    expect(bounds).toMatchObject({
      currentDay: 28,
      daysInMonth: 28,
      daysRemaining: 1,
      monthKey: '2026-02',
      monthStart: '2026-02-01',
      monthEnd: '2026-02-28',
    });
  });

  it('normalizes account IDs according to platform', () => {
    expect(normalizeAdsAccountId(' act_123 ', 'meta')).toBe('123');
    expect(normalizeAdsAccountId(' act_123 ', 'google')).toBe('act_123');
  });

  it('formats shared account name prefixes', () => {
    expect(formatAdsProjectName('Cliente - Acme')).toBe('Acme');
    expect(formatAdsProjectName('Account: Acme')).toBe('Acme');
  });

  it('maps client setting defaults consistently', () => {
    expect(mapClientSettingsRows([
      {
        client_id: 'client-1',
        budget_limit: '1200',
        group_name: null,
        is_hidden: null,
        is_sales_account: null,
      },
    ])).toEqual({
      'client-1': {
        budget: 1200,
        group_name: '',
        is_hidden: false,
        is_sales_account: true,
      },
    });
  });

  it('preserves Google daily-budget forecasting', () => {
    const metrics = computePacingMetrics({
      spent: 300,
      budget: 1000,
      month: { currentDay: 10, daysInMonth: 30, daysRemaining: 21 },
      currentDailyBudget: 50,
    });

    expect(metrics.forecast).toBe(1350);
    expect(metrics.status).toBe('risk');
    expect(metrics.recommendedDaily).toBeCloseTo(700 / 21);
  });

  it('uses average spend when no daily budget is available', () => {
    const metrics = computePacingMetrics({
      spent: 300,
      budget: 1000,
      month: { currentDay: 10, daysInMonth: 30, daysRemaining: 21 },
    });

    expect(metrics.forecast).toBe(900);
    expect(metrics.status).toBe('ok');
  });
});
