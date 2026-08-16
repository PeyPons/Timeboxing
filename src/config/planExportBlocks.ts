import type { PlanId } from '@/types';
import { planIncludesAdvancedExports } from '@/config/plans';

export { planIncludesAdvancedExports } from '@/config/plans';

/** Bloques de exportación incluidos en Team (exports básicos). */
export const PLAN_EXPORT_BLOCKS_BASIC = [
  'deadlines',
  'globalAssignments',
  'planning',
  'absences',
] as const;

/** Bloques solo en Agency+ (exports avanzados). */
export const PLAN_EXPORT_BLOCKS_ADVANCED = [
  'coherence',
  'radar',
  'rentability',
  'burnout',
] as const;

export type PlanExportBlockId =
  | (typeof PLAN_EXPORT_BLOCKS_BASIC)[number]
  | (typeof PLAN_EXPORT_BLOCKS_ADVANCED)[number];

export function canExportBlock(planId: PlanId, block: PlanExportBlockId): boolean {
  if (planId === 'starter') return false;
  if ((PLAN_EXPORT_BLOCKS_ADVANCED as readonly string[]).includes(block)) {
    return planIncludesAdvancedExports(planId);
  }
  return true;
}

export function canDownloadFullExportBundle(planId: PlanId): boolean {
  return planIncludesAdvancedExports(planId);
}
