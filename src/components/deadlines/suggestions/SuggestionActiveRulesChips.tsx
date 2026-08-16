import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import { inferFlowProjectScope, type FlowProjectScope } from '@/utils/suggestionRulesUtils';

export function SuggestionActiveRulesChips({
  flowProjectScope,
  onlySharedProjects,
  includedProjectIds,
  excludedDonorIds,
  excludedReceiverIds,
  minSenderLoadPct,
  maxReceiverLoadPct,
  minSuggestedTransferHours,
  allowedDonorCount,
  allowedReceiverCount,
  mode,
}: {
  flowProjectScope?: FlowProjectScope | null;
  onlySharedProjects: boolean;
  includedProjectIds: Set<string>;
  excludedDonorIds: string[];
  excludedReceiverIds: string[];
  minSenderLoadPct: number;
  maxReceiverLoadPct: number;
  minSuggestedTransferHours?: number;
  allowedDonorCount?: number;
  allowedReceiverCount?: number;
  mode: 'give' | 'take' | 'team';
}) {
  const { t } = useTranslation('app');
  const scope =
    flowProjectScope ?? inferFlowProjectScope(onlySharedProjects, includedProjectIds);
  const chips: string[] = [];

  if (scope === 'shared') chips.push(t('deadlines.suggestions.chipSharedOnly', 'Solo en común'));
  else if (scope === 'manual') {
    chips.push(
      includedProjectIds.size > 0
        ? t('deadlines.suggestions.chipManualCount', '{{count}} proy. elegidos', { count: includedProjectIds.size })
        : t('deadlines.suggestions.chipManualNone', 'Manual (ninguno aún)')
    );
  } else if (scope === 'focus_projects') chips.push(t('deadlines.suggestions.chipFocusProjects', 'Proyectos de la persona'));

  if (mode === 'give' && allowedDonorCount != null) {
    chips.push(t('deadlines.suggestions.chipDonorsCount', '{{count}} ceden', { count: allowedDonorCount }));
  }
  if (mode === 'take' && allowedReceiverCount != null) {
    chips.push(t('deadlines.suggestions.chipReceiversCount', '{{count}} destinos', { count: allowedReceiverCount }));
  }
  if (mode === 'team' && excludedDonorIds.length > 0) {
    chips.push(t('deadlines.suggestions.chipExcludedDonors', '{{count}} cedentes excl.', { count: excludedDonorIds.length }));
  }
  if (minSenderLoadPct > 30) chips.push(t('deadlines.suggestions.chipSenderFrom', 'Cede desde {{pct}}%', { pct: minSenderLoadPct }));
  if (maxReceiverLoadPct < 100) chips.push(t('deadlines.suggestions.chipReceiverMax', 'Receptor máx. {{pct}}%', { pct: maxReceiverLoadPct }));
  if (mode === 'team' && minSuggestedTransferHours != null) {
    chips.push(t('deadlines.suggestions.chipMinTransfer', 'Mín. {{hours}}h/mov.', { hours: minSuggestedTransferHours }));
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {chips.map((label) => (
        <Badge key={label} variant="secondary" className="text-[10px] font-normal bg-slate-100 text-slate-600">
          {label}
        </Badge>
      ))}
    </div>
  );
}
