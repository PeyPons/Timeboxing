import {
  type AdsPlatformFilter,
  type AdsPpcIssueFlag,
  type CoherenceOpStatus,
  type NotificationIssueFlag,
  type NotificationRule,
  type NotificationRuleConditions,
  type NotificationRecipientPolicy,
} from '@/types/notifications';

export const ISSUE_FLAG_IDS: NotificationIssueFlag[] = [
  'needs_planning',
  'behind_schedule',
  'over_budget',
  'no_activity',
];

export const RECIPIENT_VALUES_TRANSFER: NotificationRecipientPolicy[] = [
  'transfer_target',
  'transfer_source',
  'all_with_hours_in_month',
  'role_name',
  'agency_admins',
  'custom_emails',
];

export const RECIPIENT_VALUES_SCHEDULED: NotificationRecipientPolicy[] = [
  'all_with_hours_in_month',
  'role_name',
  'agency_admins',
  'custom_emails',
];

export function defaultConditions(): NotificationIssueFlag[] {
  return ['needs_planning', 'behind_schedule', 'over_budget', 'no_activity'];
}

export function defaultAdsPpcFlags(): AdsPpcIssueFlag[] {
  return ['over', 'risk'];
}

export function defaultAdsPlatforms(): AdsPlatformFilter[] {
  return ['google', 'meta'];
}

export const DEFAULT_COHERENCE_STATUSES: CoherenceOpStatus[] = [
  'over-budget',
  'behind-schedule',
  'needs-planning',
  'no-activity',
];

export const COHERENCE_STATUS_IDS: CoherenceOpStatus[] = [
  'over-budget',
  'behind-schedule',
  'needs-planning',
  'no-activity',
  'in-rule',
];

/** Conserva periodicidad, día de la semana y filtros al cambiar el modo de evaluación. */
export function preservedScheduleScopeAndFilters(rule: NotificationRule): Pick<
  NotificationRuleConditions,
  'periodicity' | 'schedule_day_of_week' | 'project_ids' | 'client_ids'
> {
  const c = rule.conditions;
  const out: Pick<
    NotificationRuleConditions,
    'periodicity' | 'schedule_day_of_week' | 'project_ids' | 'client_ids'
  > = {
    periodicity: c.periodicity ?? 'monthly',
    project_ids: c.project_ids?.length ? [...c.project_ids] : undefined,
    client_ids: c.client_ids?.length ? [...c.client_ids] : undefined,
  };
  if (c.periodicity === 'weekly' && typeof c.schedule_day_of_week === 'number') {
    out.schedule_day_of_week = c.schedule_day_of_week;
  }
  return out;
}

export type ClientRow = { id: string; name: string };
export type ProjectRow = { id: string; name: string; clientId: string };
