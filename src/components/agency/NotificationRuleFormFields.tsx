import { Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmailChipsInput } from '@/components/ui/email-chips-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import {
  type AdsPlatformFilter,
  type AdsPpcIssueFlag,
  type CoherenceOpStatus,
  type NotificationEvaluationMode,
  type NotificationIssueFlag,
  type NotificationRecipientPolicy,
  type NotificationRule,
  type NotificationTriggerType,
} from '@/types/notifications';
import {
  defaultAdsPpcFlags,
  defaultAdsPlatforms,
  defaultConditions,
  DEFAULT_COHERENCE_STATUSES,
  preservedScheduleScopeAndFilters,
  RECIPIENT_VALUES_SCHEDULED,
  RECIPIENT_VALUES_TRANSFER,
} from '@/components/agency/notificationRulesConstants';
import { RuleScheduledScopeFilters } from '@/components/agency/notificationRulesShared';

export type NotificationRuleFormFieldsProps = {
  rule: NotificationRule;
  clients: { id: string; name: string }[];
  projects: { id: string; name: string; clientId: string }[];
  updateLocal: (id: string, patch: Partial<NotificationRule>) => void;
  toggleIssueFlag: (rule: NotificationRule, flag: NotificationIssueFlag) => void;
  toggleCoherenceOpStatus: (rule: NotificationRule, st: CoherenceOpStatus) => void;
  toggleAdsPpcFlag: (rule: NotificationRule, flag: AdsPpcIssueFlag) => void;
  toggleAdsPlatform: (rule: NotificationRule, platform: AdsPlatformFilter) => void;
  issueFlagOptions: { id: NotificationIssueFlag; label: string }[];
  coherenceStatusOptions: { id: CoherenceOpStatus; label: string }[];
  adsPpcFlagOptions: { id: AdsPpcIssueFlag; label: string }[];
  adsPlatformOptions: { id: AdsPlatformFilter; label: string }[];
  saveRule: (rule: NotificationRule) => void | Promise<void>;
  openEmailPreview: (rule: NotificationRule) => void | Promise<void>;
  savingId: string | null;
};

export function NotificationRuleFormFields({
  rule,
  clients,
  projects,
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
}: NotificationRuleFormFieldsProps) {
  const { t } = useAppTranslation();
  const tk = 'agency.notifications.rules';

  const recipientOpts =
    rule.triggerType === 'scheduled'
      ? RECIPIENT_VALUES_SCHEDULED.map((value) => ({
          value,
          label: t(`${tk}.recipientScheduled.${value}`),
        }))
      : RECIPIENT_VALUES_TRANSFER.map((value) => ({
          value,
          label: t(`${tk}.recipientTransfer.${value}`),
        }));

  const matchAny = rule.conditions.match_any?.length ? rule.conditions.match_any : defaultConditions();
  const evalMode: NotificationEvaluationMode = rule.conditions.evaluation ?? 'project_month_health';
  const coherenceOps =
    rule.conditions.coherence_op_status_in && rule.conditions.coherence_op_status_in.length > 0
      ? rule.conditions.coherence_op_status_in
      : [...DEFAULT_COHERENCE_STATUSES];
  const adsMatchAny =
    rule.conditions.ads_match_any && rule.conditions.ads_match_any.length > 0
      ? rule.conditions.ads_match_any
      : defaultAdsPpcFlags();
  const adsPlatforms =
    rule.conditions.ads_platforms && rule.conditions.ads_platforms.length > 0
      ? rule.conditions.ads_platforms
      : defaultAdsPlatforms();

  const evalHelpKey =
    evalMode === 'ads_ppc_budget'
      ? `${tk}.evalAdsHelp`
      : evalMode === 'deadline_coherence'
        ? `${tk}.evalCoherenceHelp`
        : null;

  const adsPpcInvalid = evalMode === 'ads_ppc_budget' && adsMatchAny.length === 0;
  const healthInvalid = evalMode === 'project_month_health' && matchAny.length === 0;
  const coherenceInvalid = evalMode === 'deadline_coherence' && coherenceOps.length === 0;
  const ruleInvalid = healthInvalid || coherenceInvalid || adsPpcInvalid;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label>{t(`${tk}.ruleName`)}</Label>
          <Input
            value={rule.name}
            onChange={(e) => updateLocal(rule.id, { name: e.target.value })}
            placeholder={t(`${tk}.namePlaceholder`)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={rule.enabled} onCheckedChange={(v) => updateLocal(rule.id, { enabled: v })} />
          <Label>{t(`${tk}.enabled`)}</Label>
        </div>
        <div className="space-y-2">
          <Label>{t(`${tk}.trigger`)}</Label>
          <Select
            value={rule.triggerType}
            onValueChange={(v) => {
              const tt = v as NotificationTriggerType;
              const patch: Partial<NotificationRule> = { triggerType: tt };
              if (tt === 'task_transfer_pending') {
                patch.scheduleHourUtc = null;
                patch.recipientPolicy = 'transfer_target';
              } else {
                patch.recipientPolicy = 'all_with_hours_in_month';
                patch.conditions = {
                  evaluation: 'project_month_health',
                  match_any: defaultConditions(),
                  periodicity: 'monthly',
                };
              }
              updateLocal(rule.id, patch);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="task_transfer_pending">{t(`${tk}.triggerTransfer`)}</SelectItem>
              <SelectItem value="scheduled">{t(`${tk}.triggerScheduled`)}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {rule.triggerType === 'scheduled' ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>{t(`${tk}.frequency`)}</Label>
              <Select
                value={rule.conditions.periodicity || 'monthly'}
                onValueChange={(v) => {
                  const p = v as 'daily' | 'weekly' | 'monthly';
                  updateLocal(rule.id, {
                    conditions: { ...rule.conditions, periodicity: p },
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">{t(`${tk}.periodicityDaily`)}</SelectItem>
                  <SelectItem value="weekly">{t(`${tk}.periodicityWeekly`)}</SelectItem>
                  <SelectItem value="monthly">{t(`${tk}.periodicityMonthly`)}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {rule.conditions.periodicity === 'weekly' ? (
              <div className="space-y-2">
                <Label>{t(`${tk}.weekday`)}</Label>
                <Select
                  value={rule.conditions.schedule_day_of_week ? String(rule.conditions.schedule_day_of_week) : '1'}
                  onValueChange={(v) => {
                    updateLocal(rule.id, {
                      conditions: { ...rule.conditions, schedule_day_of_week: parseInt(v, 10) },
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      ['weekday1', 'weekday2', 'weekday3', 'weekday4', 'weekday5', 'weekday6', 'weekday7'] as const
                    ).map((key, i) => (
                      <SelectItem key={key} value={String(i + 1)}>
                        {t(`${tk}.${key}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>{t(`${tk}.hourUtc`)}</Label>
              <Input
                type="number"
                min={0}
                max={23}
                placeholder={t(`${tk}.hourPlaceholder`)}
                value={rule.scheduleHourUtc ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '') updateLocal(rule.id, { scheduleHourUtc: null });
                  else {
                    const n = parseInt(v, 10);
                    if (!Number.isNaN(n) && n >= 0 && n <= 23) {
                      updateLocal(rule.id, { scheduleHourUtc: n });
                    }
                  }
                }}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t(`${tk}.hourHelp`)}</p>
          <div className="space-y-2 max-w-lg">
            <Label>{t(`${tk}.evalType`)}</Label>
            <Select
              value={evalMode}
              onValueChange={(v) => {
                const mode = v as NotificationEvaluationMode;
                const preserved = preservedScheduleScopeAndFilters(rule);
                if (mode === 'deadline_coherence') {
                  updateLocal(rule.id, {
                    conditions: {
                      ...preserved,
                      evaluation: 'deadline_coherence',
                      coherence_min_abs_hours: rule.conditions.coherence_min_abs_hours ?? 0.05,
                      coherence_op_status_in: [...DEFAULT_COHERENCE_STATUSES],
                      coherence_delivery_mode: 'per_project',
                      coherence_digest_max: 12,
                    },
                  });
                } else if (mode === 'ads_ppc_budget') {
                  updateLocal(rule.id, {
                    conditions: {
                      periodicity: preserved.periodicity ?? 'monthly',
                      schedule_day_of_week: preserved.schedule_day_of_week,
                      evaluation: 'ads_ppc_budget',
                      ads_match_any: defaultAdsPpcFlags(),
                      ads_platforms: defaultAdsPlatforms(),
                      ads_delivery_mode: 'per_account',
                      ads_digest_max: 12,
                    },
                  });
                } else {
                  updateLocal(rule.id, {
                    conditions: {
                      ...preserved,
                      evaluation: 'project_month_health',
                      match_any: rule.conditions.match_any?.length ? rule.conditions.match_any : defaultConditions(),
                    },
                  });
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="project_month_health">{t(`${tk}.evalHealth`)}</SelectItem>
                <SelectItem value="deadline_coherence">{t(`${tk}.evalCoherence`)}</SelectItem>
                <SelectItem value="ads_ppc_budget">{t(`${tk}.evalAds`)}</SelectItem>
              </SelectContent>
            </Select>
            {evalHelpKey ? (
              <p className="text-xs text-muted-foreground">{t(evalHelpKey)}</p>
            ) : null}
          </div>
          {evalMode !== 'ads_ppc_budget' ? (
            <RuleScheduledScopeFilters rule={rule} clients={clients} projects={projects} updateLocal={updateLocal} />
          ) : null}
          {evalMode === 'project_month_health' ? (
            <div className="space-y-2">
              <Label>{t(`${tk}.conditionsLabel`)}</Label>
              <div className="grid sm:grid-cols-2 gap-2">
                {issueFlagOptions.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300"
                      checked={matchAny.includes(f.id)}
                      onChange={() => toggleIssueFlag(rule, f.id)}
                    />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>
          ) : evalMode === 'deadline_coherence' ? (
            <>
              <div className="space-y-2 max-w-xs">
                <Label>{t(`${tk}.thresholdLabel`)}</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.25}
                  value={rule.conditions.coherence_min_abs_hours ?? 0.05}
                  onChange={(e) => {
                    const n = parseFloat(e.target.value);
                    updateLocal(rule.id, {
                      conditions: {
                        ...rule.conditions,
                        coherence_min_abs_hours: Number.isFinite(n) ? n : 0.05,
                      },
                    });
                  }}
                />
                <p className="text-xs text-muted-foreground">{t(`${tk}.thresholdHelp`)}</p>
              </div>
              <div className="space-y-2">
                <Label>{t(`${tk}.coherenceStates`)}</Label>
                <div className="grid sm:grid-cols-2 gap-2">
                  {coherenceStatusOptions.map((o) => (
                    <label key={o.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300"
                        checked={coherenceOps.includes(o.id)}
                        onChange={() => toggleCoherenceOpStatus(rule, o.id)}
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2 max-w-md">
                <Label>{t(`${tk}.deliveryLabel`)}</Label>
                <Select
                  value={rule.conditions.coherence_delivery_mode ?? 'per_project'}
                  onValueChange={(v) =>
                    updateLocal(rule.id, {
                      conditions: {
                        ...rule.conditions,
                        coherence_delivery_mode: v as 'per_project' | 'digest',
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_project">{t(`${tk}.deliveryPerProject`)}</SelectItem>
                    <SelectItem value="digest">{t(`${tk}.deliveryDigest`)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(rule.conditions.coherence_delivery_mode ?? 'per_project') === 'digest' ? (
                <div className="space-y-2 max-w-xs">
                  <Label>{t(`${tk}.digestMax`)}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={rule.conditions.coherence_digest_max ?? 12}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      updateLocal(rule.id, {
                        conditions: {
                          ...rule.conditions,
                          coherence_digest_max: Number.isFinite(n) ? Math.min(50, Math.max(1, n)) : 12,
                        },
                      });
                    }}
                  />
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>{t(`${tk}.adsPlatformsLabel`)}</Label>
                <div className="flex flex-wrap gap-4">
                  {adsPlatformOptions.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300"
                        checked={adsPlatforms.includes(p.id)}
                        onChange={() => toggleAdsPlatform(rule, p.id)}
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t(`${tk}.conditionsLabel`)}</Label>
                <div className="grid sm:grid-cols-2 gap-2">
                  {adsPpcFlagOptions.map((f) => (
                    <label key={f.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300"
                        checked={adsMatchAny.includes(f.id)}
                        onChange={() => toggleAdsPpcFlag(rule, f.id)}
                      />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2 max-w-md">
                <Label>{t(`${tk}.deliveryLabel`)}</Label>
                <Select
                  value={rule.conditions.ads_delivery_mode ?? 'per_account'}
                  onValueChange={(v) =>
                    updateLocal(rule.id, {
                      conditions: {
                        ...rule.conditions,
                        ads_delivery_mode: v as 'per_account' | 'digest',
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_account">{t(`${tk}.deliveryPerAccount`)}</SelectItem>
                    <SelectItem value="digest">{t(`${tk}.deliveryDigestAds`)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(rule.conditions.ads_delivery_mode ?? 'per_account') === 'digest' ? (
                <div className="space-y-2 max-w-xs">
                  <Label>{t(`${tk}.digestMaxAds`)}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={rule.conditions.ads_digest_max ?? 12}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      updateLocal(rule.id, {
                        conditions: {
                          ...rule.conditions,
                          ads_digest_max: Number.isFinite(n) ? Math.min(50, Math.max(1, n)) : 12,
                        },
                      });
                    }}
                  />
                </div>
              ) : null}
            </>
          )}
        </>
      ) : null}

      <div className="space-y-2">
        <Label>{t(`${tk}.recipients`)}</Label>
        <Select
          value={rule.recipientPolicy}
          onValueChange={(v) => updateLocal(rule.id, { recipientPolicy: v as NotificationRecipientPolicy })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {recipientOpts.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {rule.recipientPolicy === 'role_name' ? (
        <div className="space-y-2">
          <Label>{t(`${tk}.roleNameLabel`)}</Label>
          <Input
            value={rule.recipientRoleName ?? ''}
            onChange={(e) => updateLocal(rule.id, { recipientRoleName: e.target.value })}
            placeholder={t(`${tk}.rolePlaceholder`)}
          />
        </div>
      ) : null}

      <div className="space-y-2">
        <Label>{t(`${tk}.extraEmails`)}</Label>
        <EmailChipsInput
          emails={rule.extraEmails}
          onChange={(extraEmails) => updateLocal(rule.id, { extraEmails })}
          placeholder={t(`${tk}.extraEmailsPlaceholder`)}
          invalidHint={t(`${tk}.extraEmailsInvalid`)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => void openEmailPreview(rule)}
          disabled={ruleInvalid}
        >
          <Eye className="h-4 w-4 mr-2" />
          {t(`${tk}.preview`)}
        </Button>
        <Button
          type="button"
          onClick={() => void saveRule(rule)}
          disabled={savingId === rule.id || ruleInvalid}
        >
          {savingId === rule.id ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t(`${tk}.saving`)}
            </>
          ) : (
            t(`${tk}.saveRule`)
          )}
        </Button>
      </div>
    </div>
  );
}
