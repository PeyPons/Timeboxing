/**
 * Configuración de planes (IDs internos: starter=Free, pro=Team, business=Agency, scale, enterprise).
 * Fuente única de entitlements para límites, módulos y rutas.
 */

import type { PlanId } from '@/types';

export type { PlanId };

/** Nombre comercial mostrado en UI pública */
export const PLAN_DISPLAY_NAMES: Record<PlanId, string> = {
  starter: 'Free',
  pro: 'Team',
  business: 'Agency',
  scale: 'Scale',
  enterprise: 'Enterprise',
};

export const PLAN_IDS: PlanId[] = ['starter', 'pro', 'business', 'scale', 'enterprise'];

/** Normaliza plan_id de Postgres a PlanId conocido (fallback: Free). */
export function parsePlanId(value: string | null | undefined): PlanId {
  if (value && PLAN_IDS.includes(value as PlanId)) {
    return value as PlanId;
  }
  return 'starter';
}

export interface PlanLimits {
  /** Personas gestionadas incluidas en el precio base */
  includedManagedUsers: number;
  /** Precio USD por persona adicional (null = no permitido / contacto) */
  extraUserPriceUsd: number | null;
  /** Máximo de personas gestionadas facturables (null = ilimitado) */
  maxManagedUsers: number | null;
  /** true para Free: solo mes actual y mes anterior */
  limitHistoryToTwoMonths: boolean;
  historyMonths: number | null;
  apiAccess: boolean;
  adsAccess: boolean;
  /** Sync programado Google/Meta (cron) */
  scheduledSync: boolean;
  advancedExports: boolean;
  multiAgency: boolean;
  supportTier: 'community' | 'email' | 'priority' | 'dedicated';
}

/** Precios regionales LATAM (USD equivalente mostrado; cobro según Stripe configurado) */
export const PLAN_REGIONAL_LATAM_USD: Partial<Record<Exclude<PlanId, 'starter' | 'enterprise'>, number>> = {
  pro: 29,
  business: 89,
  scale: 179,
};

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  starter: {
    includedManagedUsers: 5,
    extraUserPriceUsd: null,
    maxManagedUsers: 5,
    limitHistoryToTwoMonths: true,
    historyMonths: 2,
    apiAccess: false,
    adsAccess: false,
    scheduledSync: false,
    advancedExports: false,
    multiAgency: false,
    supportTier: 'community',
  },
  pro: {
    includedManagedUsers: 10,
    extraUserPriceUsd: 5,
    maxManagedUsers: 25,
    limitHistoryToTwoMonths: false,
    historyMonths: null,
    apiAccess: false,
    adsAccess: false,
    scheduledSync: false,
    advancedExports: false,
    multiAgency: false,
    supportTier: 'email',
  },
  business: {
    includedManagedUsers: 40,
    extraUserPriceUsd: 3.5,
    maxManagedUsers: 100,
    limitHistoryToTwoMonths: false,
    historyMonths: null,
    apiAccess: true,
    adsAccess: true,
    scheduledSync: true,
    advancedExports: true,
    multiAgency: false,
    supportTier: 'email',
  },
  scale: {
    includedManagedUsers: 100,
    extraUserPriceUsd: 2.5,
    maxManagedUsers: null,
    limitHistoryToTwoMonths: false,
    historyMonths: null,
    apiAccess: true,
    adsAccess: true,
    scheduledSync: true,
    advancedExports: true,
    multiAgency: true,
    supportTier: 'priority',
  },
  enterprise: {
    includedManagedUsers: 9999,
    extraUserPriceUsd: null,
    maxManagedUsers: null,
    limitHistoryToTwoMonths: false,
    historyMonths: null,
    apiAccess: true,
    adsAccess: true,
    scheduledSync: true,
    advancedExports: true,
    multiAgency: true,
    supportTier: 'dedicated',
  },
};

/** Módulos (AgencySettings.modules) permitidos por plan */
export const PLAN_MODULES: Record<PlanId, { weeklyFeedback?: boolean; professionalGoals?: boolean; deadlines?: boolean; timeTracker?: boolean; ppc?: boolean }> = {
  starter: { deadlines: true, timeTracker: true },
  pro: { weeklyFeedback: true, professionalGoals: true, deadlines: true, timeTracker: true },
  business: { weeklyFeedback: true, professionalGoals: true, deadlines: true, timeTracker: true, ppc: true },
  scale: { weeklyFeedback: true, professionalGoals: true, deadlines: true, timeTracker: true, ppc: true },
  enterprise: { weeklyFeedback: true, professionalGoals: true, deadlines: true, timeTracker: true, ppc: true },
};

/** Rutas Team+ (pro, business, scale, enterprise). Free solo planificador/deadlines básicos. */
export const ROUTES_REQUIRE_PRO: string[] = [
  '/weekly-forecast',
  '/actividad',
  '/okrs',
  '/operaciones',
  '/finanzas',
  '/capacidad',
  '/team-capacity',
  '/exportacion-informes',
];

export const ROUTES_REQUIRE_BUSINESS: string[] = ['/ads', '/meta-ads', '/api-keys'];

export function getPlanLimit(planId: PlanId): PlanLimits {
  return PLAN_LIMITS[planId] ?? PLAN_LIMITS.starter;
}

export function canAccessRoute(planId: PlanId, path: string): boolean {
  if (planId === 'enterprise' || planId === 'scale') return true;
  if (ROUTES_REQUIRE_BUSINESS.some((p) => path.startsWith(p))) {
    return planId === 'business';
  }
  if (ROUTES_REQUIRE_PRO.some((p) => path.startsWith(p))) {
    return planId === 'pro' || planId === 'business';
  }
  return true;
}

export function planIncludesAds(planId: PlanId): boolean {
  return getPlanLimit(planId).adsAccess;
}

export function planIncludesOkrs(planId: PlanId): boolean {
  return planId !== 'starter';
}

export function planIncludesWeekly(planId: PlanId): boolean {
  return planId !== 'starter';
}

export function planIncludesRadar(planId: PlanId): boolean {
  return planId === 'pro' || planId === 'business' || planId === 'scale' || planId === 'enterprise';
}

export function planIncludesApi(planId: PlanId): boolean {
  return getPlanLimit(planId).apiAccess;
}

export function planIncludesScheduledSync(planId: PlanId): boolean {
  return getPlanLimit(planId).scheduledSync;
}

export function planIncludesAdvancedExports(planId: PlanId): boolean {
  return getPlanLimit(planId).advancedExports;
}

/** Informes de rentabilidad completos (pantalla Finanzas). */
export function planIncludesFullReports(planId: PlanId): boolean {
  return planId !== 'starter';
}

/** Cantidad facturable de personas extra sobre el incluido */
export function billableExtraManagedUsers(planId: PlanId, managedCount: number): number {
  const lim = getPlanLimit(planId);
  if (lim.extraUserPriceUsd == null || lim.maxManagedUsers == null) {
    if (lim.maxManagedUsers != null && managedCount > lim.maxManagedUsers) {
      return Math.max(0, managedCount - lim.includedManagedUsers);
    }
    return Math.max(0, managedCount - lim.includedManagedUsers);
  }
  const capped = lim.maxManagedUsers != null ? Math.min(managedCount, lim.maxManagedUsers) : managedCount;
  return Math.max(0, capped - lim.includedManagedUsers);
}
