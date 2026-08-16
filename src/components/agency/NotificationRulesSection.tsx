import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Bell, Loader2, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAgency } from '@/contexts/AgencyContext';
import { useAppAllocations, useAppEmployees, useAppProjects } from '@/contexts/AppContext';
import { NotificationEmailPreviewDialog } from '@/components/agency/NotificationEmailPreviewDialog';
import { buildNotificationEmailPreview } from '@/utils/buildNotificationEmailPreview';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import {
  COHERENCE_STATUS_IDS,
  DEFAULT_COHERENCE_STATUSES,
  defaultAdsPpcFlags,
  defaultAdsPlatforms,
  defaultConditions,
  ISSUE_FLAG_IDS,
} from '@/components/agency/notificationRulesConstants';
import { NotificationRuleFormFields } from '@/components/agency/NotificationRuleFormFields';
import {
  mapNotificationRuleFromDb,
  type AdsPlatformFilter,
  type AdsPpcIssueFlag,
  type CoherenceOpStatus,
  type NotificationEvaluationMode,
  type NotificationIssueFlag,
  type NotificationRecipientPolicy,
  type NotificationRule,
} from '@/types/notifications';

function isUnnamedOrDefaultRuleName(name: string | undefined, newRuleLabel: string): boolean {
  const n = name?.trim() ?? '';
  if (!n) return true;
  if (n === 'Nueva regla' || n === 'New rule') return true;
  return n === newRuleLabel;
}

function scheduledConditionsPayload(r: Partial<NotificationRule>): Record<string, unknown> {
  const evalMode: NotificationEvaluationMode = r.conditions?.evaluation ?? 'project_month_health';
  const periodicity = r.conditions?.periodicity ?? 'monthly';
  const schedule: Record<string, unknown> = { periodicity };
  if (periodicity === 'weekly') {
    const dow = r.conditions?.schedule_day_of_week;
    schedule.schedule_day_of_week =
      typeof dow === 'number' && dow >= 1 && dow <= 7 ? Math.floor(dow) : 1;
  }
  const scope = {
    project_ids: r.conditions?.project_ids?.length ? r.conditions.project_ids : undefined,
    client_ids: r.conditions?.client_ids?.length ? r.conditions.client_ids : undefined,
  };
  if (evalMode === 'deadline_coherence') {
    const opIn =
      r.conditions?.coherence_op_status_in && r.conditions.coherence_op_status_in.length > 0
        ? r.conditions.coherence_op_status_in
        : [...DEFAULT_COHERENCE_STATUSES];
    return {
      evaluation: 'deadline_coherence',
      ...scope,
      ...schedule,
      coherence_min_abs_hours: r.conditions?.coherence_min_abs_hours ?? 0.05,
      coherence_op_status_in: opIn,
      coherence_delivery_mode: r.conditions?.coherence_delivery_mode ?? 'per_project',
      coherence_digest_max: r.conditions?.coherence_digest_max ?? 12,
    };
  }
  if (evalMode === 'ads_ppc_budget') {
    const adsFlags =
      r.conditions?.ads_match_any && r.conditions.ads_match_any.length > 0
        ? r.conditions.ads_match_any
        : defaultAdsPpcFlags();
    const adsPlatforms =
      r.conditions?.ads_platforms && r.conditions.ads_platforms.length > 0
        ? r.conditions.ads_platforms
        : defaultAdsPlatforms();
    return {
      evaluation: 'ads_ppc_budget',
      ...schedule,
      ads_match_any: adsFlags,
      ads_platforms: adsPlatforms,
      ads_delivery_mode: r.conditions?.ads_delivery_mode ?? 'per_account',
      ads_digest_max: r.conditions?.ads_digest_max ?? 12,
    };
  }
  return {
    evaluation: 'project_month_health',
    ...scope,
    ...schedule,
    match_any: r.conditions?.match_any?.length ? r.conditions.match_any : defaultConditions(),
  };
}

function rowToInsertPayload(r: Partial<NotificationRule> & { agencyId: string }) {
  const trigger = r.triggerType ?? 'task_transfer_pending';
  let conditions: Record<string, unknown> = {};
  if (trigger === 'scheduled') {
    conditions = scheduledConditionsPayload(r);
  }

  let schedule_hour_utc: number | null = null;
  if (trigger === 'scheduled') {
    const raw = r.scheduleHourUtc;
    if (raw !== null && raw !== undefined) {
      const h = Number(raw);
      if (Number.isFinite(h)) {
        schedule_hour_utc = Math.min(23, Math.max(0, Math.trunc(h)));
      }
    }
  }

  return {
    agency_id: r.agencyId,
    name: String(r.name ?? '').trim(),
    enabled: r.enabled ?? true,
    trigger_type: trigger,
    schedule_hour_utc,
    conditions,
    recipient_policy: r.recipientPolicy ?? 'transfer_target',
    recipient_role_name:
      r.recipientPolicy === 'role_name' ? (r.recipientRoleName?.trim() || null) : null,
    extra_emails: r.extraEmails?.length ? r.extraEmails : [],
  };
}

export type NotificationRulesSectionHandle = {
  /** Persiste todas las reglas en pantalla (p. ej. al pulsar «Guardar cambios» global). */
  saveAllRules: () => Promise<boolean>;
};

export const NotificationRulesSection = forwardRef<NotificationRulesSectionHandle, { agencyId: string }>(
  function NotificationRulesSection({ agencyId }, ref) {
  const { toast } = useToast();
  const { currentAgency } = useAgency();
  const { allocations } = useAppAllocations();
  const { projects, clients } = useAppProjects();
  const { employees } = useAppEmployees();
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string | null>(null);
  const [previewNote, setPreviewNote] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [expandedRuleIds, setExpandedRuleIds] = useState<string[]>([]);
  const rulesListRef = useRef<HTMLDivElement>(null);
  const rulesRef = useRef(rules);
  rulesRef.current = rules;

  const { t } = useAppTranslation();
  const tk = 'agency.notifications.rules';

  const issueFlagOptions = useMemo(
    () => ISSUE_FLAG_IDS.map((id) => ({ id, label: t(`${tk}.flags.${id}`) })),
    [t],
  );
  const coherenceStatusOptions = useMemo(
    () => COHERENCE_STATUS_IDS.map((id) => ({ id, label: t(`${tk}.coherence.${id}`) })),
    [t],
  );

  const load = useCallback(async (skipLoadingState = false) => {
    if (!skipLoadingState) setLoading(true);
    const { data, error } = await supabase
      .from('notification_rules')
      .select('*')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      toast({
        title: t(`${tk}.toastErrorTitle`),
        description: t(`${tk}.toastLoadError`),
        variant: 'destructive',
      });
      setRules([]);
    } else {
      setRules((data || []).map((row) => mapNotificationRuleFromDb(row as Record<string, unknown>)));
    }
    setLoading(false);
  }, [agencyId, toast, t, tk]);

  const persistRule = useCallback(
    async (rule: NotificationRule) => {
      const full = rowToInsertPayload({ ...rule, agencyId });
      const updatePayload = { ...full };
      delete (updatePayload as { agency_id?: string }).agency_id;
      const result = await supabase
        .from('notification_rules')
        .update(updatePayload)
        .eq('id', rule.id)
        .select('id, name, schedule_hour_utc')
        .single();
      if (!result.error && result.data) {
        const saved = result.data as Record<string, unknown>;
        if (saved.name !== updatePayload.name || saved.schedule_hour_utc !== updatePayload.schedule_hour_utc) {
          console.warn('[NotificationRules] Saved data mismatch', { sent: updatePayload, got: saved });
        }
      }
      return result;
    },
    [agencyId],
  );

  useImperativeHandle(
    ref,
    () => ({
      async saveAllRules() {
        const list = rulesRef.current;
        if (list.length === 0) return true;
        for (const rule of list) {
          const { error } = await persistRule(rule);
          if (error) {
            toast({
              title: t(`${tk}.toastSaveRulesError`),
              description: error.message,
              variant: 'destructive',
            });
            return false;
          }
        }
        await load();
        return true;
      },
    }),
    [persistRule, load, toast, t, tk],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (rules.length > 0 && expandedRuleIds.length === 0) {
      setExpandedRuleIds([rules[0].id]);
    }
  }, [rules, expandedRuleIds.length]);

  const addRule = async () => {
    const payload = rowToInsertPayload({
      agencyId,
      name: t(`${tk}.newRuleDefault`),
      enabled: true,
      triggerType: 'task_transfer_pending',
      recipientPolicy: 'transfer_target',
      extraEmails: [],
      conditions: { match_any: defaultConditions() },
    });

    const { data, error } = await supabase.from('notification_rules').insert(payload).select('*').single();

    if (error) {
      toast({ title: t(`${tk}.toastErrorTitle`), description: error.message, variant: 'destructive' });
      return;
    }
    if (data) {
      const created = mapNotificationRuleFromDb(data as Record<string, unknown>);
      setRules((prev) => [created, ...prev]);
      setExpandedRuleIds([created.id]);
      requestAnimationFrame(() => {
        rulesListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      toast({ title: t(`${tk}.toastRuleCreated`) });
    }
  };

  const saveRule = async (rule: NotificationRule) => {
    setSavingId(rule.id);
    const { error } = await persistRule(rule);

    if (error) {
      console.error('[NotificationRules] save error', error);
      toast({ title: t(`${tk}.toastErrorTitle`), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t(`${tk}.toastSaved`) });
      await load(true);
    }
    setSavingId(null);
  };

  const deleteRule = async (id: string) => {
    if (!confirm(t(`${tk}.deleteConfirm`))) return;
    const { error } = await supabase.from('notification_rules').delete().eq('id', id);
    if (error) {
      toast({ title: t(`${tk}.toastErrorTitle`), description: error.message, variant: 'destructive' });
      return;
    }
    setRules((prev) => prev.filter((r) => r.id !== id));
    toast({ title: t(`${tk}.toastDeleted`) });
  };

  const updateLocal = (id: string, patch: Partial<NotificationRule>) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const openEmailPreview = async (rule: NotificationRule) => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewHtml(null);
    setPreviewSubject(null);
    setPreviewNote(null);
    setPreviewError(null);
    try {
      const result = await buildNotificationEmailPreview({
        rule,
        agencyId,
        agencyName: currentAgency?.name?.trim() || 'Agencia',
        hoursTrackingPreference: currentAgency?.settings?.hoursTrackingPreference,
        allocations,
        projects,
        employees,
      });
      setPreviewHtml(result.html);
      setPreviewSubject(result.subject);
      setPreviewNote(result.note ?? null);
    } catch (e) {
      console.error(e);
      setPreviewError(e instanceof Error ? e.message : t(`${tk}.toastPreviewError`));
      toast({
        title: t(`${tk}.previewDialog.title`),
        description: t(`${tk}.toastPreviewError`),
        variant: 'destructive',
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  const toggleIssueFlag = (rule: NotificationRule, flag: NotificationIssueFlag) => {
    const current = rule.conditions.match_any?.length ? rule.conditions.match_any : defaultConditions();
    const next = current.includes(flag) ? current.filter((f) => f !== flag) : [...current, flag];
    updateLocal(rule.id, { conditions: { ...rule.conditions, match_any: next } });
  };

  const toggleCoherenceOpStatus = (rule: NotificationRule, st: CoherenceOpStatus) => {
    const current =
      rule.conditions.coherence_op_status_in && rule.conditions.coherence_op_status_in.length > 0
        ? rule.conditions.coherence_op_status_in
        : [...DEFAULT_COHERENCE_STATUSES];
    const next = current.includes(st) ? current.filter((x) => x !== st) : [...current, st];
    updateLocal(rule.id, { conditions: { ...rule.conditions, coherence_op_status_in: next } });
  };

  const toggleAdsPpcFlag = (rule: NotificationRule, flag: AdsPpcIssueFlag) => {
    const current =
      rule.conditions.ads_match_any && rule.conditions.ads_match_any.length > 0
        ? rule.conditions.ads_match_any
        : defaultAdsPpcFlags();
    const next = current.includes(flag) ? current.filter((f) => f !== flag) : [...current, flag];
    updateLocal(rule.id, { conditions: { ...rule.conditions, ads_match_any: next } });
  };

  const toggleAdsPlatform = (rule: NotificationRule, platform: AdsPlatformFilter) => {
    const current =
      rule.conditions.ads_platforms && rule.conditions.ads_platforms.length > 0
        ? rule.conditions.ads_platforms
        : defaultAdsPlatforms();
    const next = current.includes(platform)
      ? current.filter((p) => p !== platform)
      : [...current, platform];
    updateLocal(rule.id, {
      conditions: {
        ...rule.conditions,
        ads_platforms: next.length ? next : defaultAdsPlatforms(),
      },
    });
  };

  const adsPpcFlagOptions = useMemo(
    () =>
      (['over', 'risk'] as const).map((id) => ({ id, label: t(`${tk}.adsFlags.${id}`) })),
    [t],
  );
  const adsPlatformOptions = useMemo(
    () =>
      (['google', 'meta'] as const).map((id) => ({ id, label: t(`${tk}.adsPlatforms.${id}`) })),
    [t],
  );

  const newRuleLabel = t(`${tk}.newRuleDefault`);

  const ruleTitle = (rule: NotificationRule) =>
    isUnnamedOrDefaultRuleName(rule.name, newRuleLabel)
      ? t(`${tk}.unnamedRule`)
      : rule.name?.trim() || t(`${tk}.unnamedRule`);

  const ruleBadges = (rule: NotificationRule) => (
    <>
      <Badge variant={rule.enabled ? 'default' : 'secondary'} className="text-xs font-medium">
        {rule.enabled ? t(`${tk}.badgeActive`) : t(`${tk}.badgeInactive`)}
      </Badge>
      <Badge variant="outline" className="text-xs font-normal">
        {rule.triggerType === 'scheduled' ? t(`${tk}.badgeScheduled`) : t(`${tk}.badgeTransfer`)}
      </Badge>
      {rule.scheduleHourUtc !== null && rule.triggerType === 'scheduled' ? (
        <Badge variant="outline" className="font-mono text-xs tabular-nums" title={t(`${tk}.utcBadgeTitle`)}>
          {t(`${tk}.utcShort`, { hour: String(rule.scheduleHourUtc).padStart(2, '0') })}
        </Badge>
      ) : null}
    </>
  );

  const formSharedProps = {
    clients: clients.map((c) => ({ id: c.id, name: c.name })),
    projects: projects.map((p) => ({ id: p.id, name: p.name, clientId: p.clientId })),
    updateLocal,
    toggleIssueFlag,
    toggleCoherenceOpStatus,
    toggleAdsPpcFlag,
    toggleAdsPlatform,
    issueFlagOptions,
    coherenceStatusOptions,
    adsPpcFlagOptions,
    adsPlatformOptions,
    saveRule,
    openEmailPreview,
    savingId,
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8">
        <Loader2 className="h-5 w-5 animate-spin" />
        {t(`${tk}.loading`)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <NotificationEmailPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        subject={previewSubject}
        html={previewHtml}
        note={previewNote}
        loading={previewLoading}
        error={previewError}
      />
      <div className="rounded-xl border bg-gradient-to-br from-primary/[0.06] via-background to-muted/30 p-4 sm:p-5 shadow-sm">
        <p className="text-sm text-muted-foreground leading-relaxed">{t(`${tk}.intro`)}</p>
        <div className="mt-4 flex justify-end">
          <Button type="button" onClick={() => void addRule()} className="shrink-0">
            <Plus className="h-4 w-4 mr-2" />
            {t(`${tk}.addRule`)}
          </Button>
        </div>
      </div>

      {rules.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground text-sm">{t(`${tk}.empty`)}</CardContent>
        </Card>
      ) : rules.length > 1 ? (
        <div ref={rulesListRef} className="space-y-2">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">{t(`${tk}.sectionTitle`)}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{t(`${tk}.sectionHint`)}</p>
          </div>
          <Accordion
            type="multiple"
            className="space-y-2"
            value={expandedRuleIds}
            onValueChange={setExpandedRuleIds}
          >
            {rules.map((rule) => (
              <AccordionItem key={rule.id} value={rule.id} className="relative rounded-xl border bg-card shadow-sm overflow-hidden">
                <div className="relative">
                  <AccordionTrigger className="w-full px-4 sm:px-5 py-4 hover:no-underline text-left pr-24 [&>svg]:mr-10 [&>svg]:shrink-0 [&[data-state=open]>svg]:rotate-180">
                    <div className="flex flex-1 gap-3 items-start min-w-0 text-left">
                      <Bell className="h-5 w-5 text-primary shrink-0 mt-0.5 hidden sm:block" />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm leading-snug truncate">{ruleTitle(rule)}</div>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">{ruleBadges(rule)}</div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-3 top-3 text-destructive z-10"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void deleteRule(rule.id);
                    }}
                    aria-label={t(`${tk}.deleteRule`)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <AccordionContent className="px-4 sm:px-5">
                  <div className="border-t pt-4 pb-1 space-y-4">
                    <NotificationRuleFormFields rule={rule} {...formSharedProps} />
                    <p className="text-xs text-muted-foreground border-t pt-3">{t(`${tk}.cardFootnote`)}</p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      ) : (
        rules.map((rule) => (
          <Card key={rule.id} className="overflow-hidden border bg-card shadow-sm">
            <CardContent className="p-0">
              <div className="border-b bg-gradient-to-br from-primary/[0.07] via-background to-muted/25 px-4 py-4 sm:px-5 sm:py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex gap-3 min-w-0">
                    <Bell className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <h3 className="font-semibold text-base leading-snug truncate">{ruleTitle(rule)}</h3>
                      <div className="flex flex-wrap gap-1.5 mt-2">{ruleBadges(rule)}</div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive shrink-0"
                    onClick={() => void deleteRule(rule.id)}
                    aria-label={t(`${tk}.deleteRule`)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="p-4 sm:p-6 space-y-4">
                <NotificationRuleFormFields rule={rule} {...formSharedProps} />
              </div>
              <p className="px-4 sm:px-6 pb-4 text-xs text-muted-foreground border-t pt-3">
                {t(`${tk}.cardFootnote`)}
              </p>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
});
