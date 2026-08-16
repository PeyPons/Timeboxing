/**
 * Etiquetas de facturación in-app: nombres comerciales + precios USD + asientos.
 * Combina `plans.ts` (límites) y `publicPricing.ts` (precio mensual Stripe).
 */
import { PLAN_DISPLAY_NAMES, PLAN_LIMITS, billableExtraManagedUsers, type PlanId } from '@/config/plans';
import { PUBLIC_PLAN_PRICING } from '@/config/publicPricing';

export interface MonthlyBillEstimate {
  planId: PlanId;
  managedCount: number;
  baseUsd: number | null;
  includedUsers: number;
  extraSeats: number;
  extraSeatPriceUsd: number | null;
  extraUsd: number;
  totalUsd: number | null;
}

/** Estimación mensual: precio base Stripe + asientos extra facturables. */
export function estimateMonthlyBillUsd(planId: PlanId, managedCount: number): MonthlyBillEstimate {
  const lim = PLAN_LIMITS[planId];
  const baseUsd = getPlanMonthlyUsd(planId);
  const extraSeats = billableExtraManagedUsers(planId, managedCount);
  const extraSeatPriceUsd = lim.extraUserPriceUsd;
  const extraUsd =
    extraSeatPriceUsd != null ? extraSeats * extraSeatPriceUsd : 0;
  const totalUsd = baseUsd != null ? baseUsd + extraUsd : null;

  return {
    planId,
    managedCount,
    baseUsd,
    includedUsers: lim.includedManagedUsers,
    extraSeats,
    extraSeatPriceUsd,
    extraUsd,
    totalUsd,
  };
}

export function formatUsdAmount(amount: number): string {
  return `${amount.toLocaleString('es-ES', { maximumFractionDigits: 2 })} $`;
}

/** Planes que pueden contratarse por Stripe checkout (no enterprise manual). */
export const SELF_SERVE_PAID_PLANS: PlanId[] = ['pro', 'business', 'scale'];

export const AGENCY_TRIAL_DAYS = 14;

const PLAN_ORDER: Record<PlanId, number> = {
  starter: 0,
  pro: 1,
  business: 2,
  scale: 3,
  enterprise: 4,
};

export function getPlanMonthlyUsd(planId: PlanId): number | null {
  return PUBLIC_PLAN_PRICING.find((p) => p.id === planId)?.usdMonthly ?? null;
}

export function formatPlanPriceUsd(planId: PlanId, locale: 'es' | 'en' = 'es'): string {
  const amount = getPlanMonthlyUsd(planId);
  if (amount == null) {
    return locale === 'es' ? 'Personalizado' : 'Custom';
  }
  const suffix = locale === 'es' ? '/mes' : '/mo';
  return `${amount} $${suffix}`;
}

export function formatPlanButtonLabel(
  planId: PlanId,
  opts: { locale?: 'es' | 'en'; withTrial?: boolean; trialDays?: number } = {},
): string {
  const locale = opts.locale ?? 'es';
  const name = PLAN_DISPLAY_NAMES[planId];
  const price = formatPlanPriceUsd(planId, locale);
  if (opts.withTrial && opts.trialDays) {
    return locale === 'es'
      ? `${name} (${price}, ${opts.trialDays} días de prueba)`
      : `${name} (${price}, ${opts.trialDays}-day trial)`;
  }
  return `${name} (${price})`;
}

/** Planes superiores al actual (excluye enterprise — contacto ventas). */
export function getUpgradePlansFor(currentPlanId: PlanId): PlanId[] {
  const currentOrder = PLAN_ORDER[currentPlanId] ?? 0;
  return SELF_SERVE_PAID_PLANS.filter((id) => PLAN_ORDER[id] > currentOrder);
}

export function formatUpgradeOptionsList(planIds: PlanId[], locale: 'es' | 'en'): string {
  if (planIds.length === 0) return '';
  const names = planIds.map((id) => PLAN_DISPLAY_NAMES[id]);
  if (names.length === 1) return names[0];
  const conj = locale === 'es' ? ' o ' : ' or ';
  if (names.length === 2) return names.join(conj);
  return `${names.slice(0, -1).join(', ')}${conj}${names[names.length - 1]}`;
}

export function getStripePriceIdForCheckout(planId: PlanId): string {
  switch (planId) {
    case 'pro':
      return import.meta.env.VITE_STRIPE_PRICE_ID_PRO ?? '';
    case 'business':
      return import.meta.env.VITE_STRIPE_PRICE_ID_BUSINESS ?? '';
    case 'scale':
      return import.meta.env.VITE_STRIPE_PRICE_ID_SCALE ?? '';
    default:
      return '';
  }
}

export function isPaidStripePlan(planId: PlanId): boolean {
  return planId === 'pro' || planId === 'business' || planId === 'scale';
}
