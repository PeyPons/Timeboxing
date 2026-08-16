import { useMemo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { SuggestionLoadLimitsCard } from '@/components/deadlines/suggestions/SuggestionLoadLimitsCard';
import { Checkbox } from '@/components/ui/checkbox';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDeadlineHoursForDisplay } from '@/utils/deadlineUtils';
import type { Deadline } from '@/types';
import {
  applyFlowProjectScope,
  getDonorIdsSharingProjectsWith,
  getEmployeeProjectIds,
  getReceiverIdsSharingProjectsWithDonor,
  getSharedProjectIdsForFocus,
  type FlowProjectScope,
} from '@/utils/suggestionRulesUtils';
import { scopeLabel } from '@/utils/suggestionRulesUtils';
import type { SuggestionDonor } from '@/components/deadlines/suggestions/types';

type RulesMode = 'give' | 'take';

export function SuggestionRulesStep({
  mode,
  focusEmployeeId,
  focusEmployeeName,
  focusEmployeeAvatar,
  suggestionDonors,
  receiverCandidates,
  deadlines,
  hiddenProjects,
  excludedDonorIds,
  setExcludedDonorIds,
  excludedReceiverIds,
  setExcludedReceiverIds,
  flowProjectScope,
  setFlowProjectScope,
  onlySharedProjects,
  setOnlySharedProjects,
  includedProjectIds,
  setIncludedProjectIds,
  filteredProjects,
  previewProjectCount,
  previewTotalHours,
  previewPeopleCount,
  minSenderLoadPct,
  minSenderLoadPctInput,
  setMinSenderLoadPct,
  setMinSenderLoadPctInput,
  maxReceiverLoadPct,
  maxReceiverLoadPctInput,
  setMaxReceiverLoadPct,
  setMaxReceiverLoadPctInput,
}: {
  mode: RulesMode;
  focusEmployeeId: string;
  focusEmployeeName: string;
  focusEmployeeAvatar?: string;
  suggestionDonors: SuggestionDonor[];
  /** Modo take: posibles receptores (id + name + avatar). */
  receiverCandidates: { id: string; name: string; avatarUrl?: string }[];
  deadlines: Deadline[];
  hiddenProjects: Set<string>;
  excludedDonorIds: string[];
  setExcludedDonorIds: (v: string[] | ((prev: string[]) => string[])) => void;
  excludedReceiverIds: string[];
  setExcludedReceiverIds: (v: string[] | ((prev: string[]) => string[])) => void;
  flowProjectScope: FlowProjectScope;
  setFlowProjectScope: (scope: FlowProjectScope) => void;
  onlySharedProjects: boolean;
  setOnlySharedProjects: (v: boolean) => void;
  includedProjectIds: Set<string>;
  setIncludedProjectIds: (v: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  filteredProjects: { id: string; name: string }[];
  previewProjectCount: number;
  previewTotalHours: number;
  previewPeopleCount: number;
  minSenderLoadPct: number;
  minSenderLoadPctInput: string;
  setMinSenderLoadPct: (n: number) => void;
  setMinSenderLoadPctInput: (s: string) => void;
  maxReceiverLoadPct: number;
  maxReceiverLoadPctInput: string;
  setMaxReceiverLoadPct: (n: number) => void;
  setMaxReceiverLoadPctInput: (s: string) => void;
}) {
  const { t } = useTranslation('app');
  const [personSearch, setPersonSearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');

  const focusProjectIds = useMemo(
    () => [...getEmployeeProjectIds(deadlines, focusEmployeeId, hiddenProjects)],
    [deadlines, focusEmployeeId, hiddenProjects]
  );

  const sharingDonorIds = useMemo(
    () =>
      getDonorIdsSharingProjectsWith(
        deadlines,
        focusEmployeeId,
        suggestionDonors.map((d) => d.id),
        hiddenProjects
      ),
    [deadlines, focusEmployeeId, suggestionDonors, hiddenProjects]
  );

  const sharingReceiverIds = useMemo(
    () =>
      getReceiverIdsSharingProjectsWithDonor(
        deadlines,
        focusEmployeeId,
        receiverCandidates.map((r) => r.id),
        hiddenProjects
      ),
    [deadlines, focusEmployeeId, receiverCandidates, hiddenProjects]
  );

  const donorList = useMemo(() => {
    const term = personSearch.trim().toLowerCase();
    return suggestionDonors
      .filter((d) => d.id !== focusEmployeeId)
      .filter((d) => !term || d.name.toLowerCase().includes(term))
      .sort((a, b) => {
        const aShare = sharingDonorIds.has(a.id) ? 0 : 1;
        const bShare = sharingDonorIds.has(b.id) ? 0 : 1;
        return aShare - bShare || a.name.localeCompare(b.name);
      });
  }, [suggestionDonors, focusEmployeeId, personSearch, sharingDonorIds]);

  const receiverList = useMemo(() => {
    const term = personSearch.trim().toLowerCase();
    return receiverCandidates
      .filter((r) => r.id !== focusEmployeeId)
      .filter((r) => !term || r.name.toLowerCase().includes(term))
      .sort((a, b) => {
        const aShare = sharingReceiverIds.has(a.id) ? 0 : 1;
        const bShare = sharingReceiverIds.has(b.id) ? 0 : 1;
        return aShare - bShare || a.name.localeCompare(b.name);
      });
  }, [receiverCandidates, focusEmployeeId, personSearch, sharingReceiverIds]);

  const manualProjects = useMemo(() => {
    const pool = filteredProjects.filter((p) => focusProjectIds.includes(p.id));
    const term = projectSearch.trim().toLowerCase();
    return term ? pool.filter((p) => p.name.toLowerCase().includes(term)) : pool;
  }, [filteredProjects, focusProjectIds, projectSearch]);

  const allowedOtherIds = useMemo(() => {
    if (mode === 'give') {
      return suggestionDonors
        .filter((d) => !excludedDonorIds.includes(d.id) && d.id !== focusEmployeeId)
        .map((d) => d.id);
    }
    return receiverCandidates
      .filter((r) => !excludedReceiverIds.includes(r.id) && r.id !== focusEmployeeId)
      .map((r) => r.id);
  }, [
    mode,
    suggestionDonors,
    receiverCandidates,
    excludedDonorIds,
    excludedReceiverIds,
    focusEmployeeId,
  ]);

  const sharedProjectIdsForManual = useMemo(
    () => getSharedProjectIdsForFocus(deadlines, focusEmployeeId, allowedOtherIds, hiddenProjects),
    [deadlines, focusEmployeeId, allowedOtherIds, hiddenProjects]
  );

  const applyScope = (scope: FlowProjectScope) => {
    setFlowProjectScope(scope);
    const next = applyFlowProjectScope(scope, focusProjectIds);
    setOnlySharedProjects(next.onlySharedProjects);
    setIncludedProjectIds(new Set(next.includedProjectIds));
  };

  const selectSharedProjectsOnly = () => {
    setFlowProjectScope('manual');
    setOnlySharedProjects(false);
    setIncludedProjectIds(new Set(sharedProjectIdsForManual));
  };

  const allowedDonorCount = suggestionDonors.filter(
    (d) => !excludedDonorIds.includes(d.id) && d.id !== focusEmployeeId
  ).length;
  const allowedReceiverCount = receiverCandidates.filter(
    (r) => !excludedReceiverIds.includes(r.id) && r.id !== focusEmployeeId
  ).length;

  const scopeOptions: { value: FlowProjectScope; title: string; hint: string }[] = [
    {
      value: 'shared',
      title: t('deadlines.suggestions.rulesSharedRecommended', 'Solo proyectos en común (recomendado)'),
      hint:
        mode === 'give'
          ? t('deadlines.suggestions.focusProjectsHintGive', 'Donde la persona y quien cede tienen horas este mes.')
          : t('deadlines.suggestions.focusProjectsHintTake', 'Donde quien cede y el destino comparten proyecto.'),
    },
    {
      value: 'focus_projects',
      title: mode === 'give' ? t('deadlines.suggestions.rulesAllProjectsGive', 'Todos los proyectos del receptor') : t('deadlines.suggestions.rulesAllProjectsTake', 'Todos los proyectos del cedente'),
      hint: t('deadlines.suggestions.focusProjectsExpandHint', 'Puede ampliar mucho la lista de sugerencias.'),
    },
    {
      value: 'manual',
      title: t('deadlines.suggestions.chooseConcreteProjects', 'Elegir proyectos concretos'),
      hint: t('deadlines.suggestions.manualScopeHint', 'Empieza sin ninguno marcado; activa solo los que te interesen.'),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 p-2.5 rounded-lg border bg-slate-50">
        <Avatar className="h-9 w-9 border border-white shadow shrink-0">
          <AvatarImage src={focusEmployeeAvatar} alt={focusEmployeeName} />
          <AvatarFallback className="bg-primary/10 text-primary text-sm">
            {focusEmployeeName[0]}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 truncate">{focusEmployeeName}</p>
          <p className="text-xs text-slate-500">
            {t('deadlines.suggestions.projectsWithHours', '{{count}} proyecto(s) con horas este mes', { count: focusProjectIds.length })}
          </p>
        </div>
      </div>

      <div
        className={cn(
          'rounded-xl border p-3 text-sm',
          previewProjectCount > 0
            ? 'border-primary/25 bg-primary/5'
            : 'border-amber-200 bg-amber-50/80'
        )}
      >
        {previewProjectCount > 0 ? (
          <p className="text-slate-700">
            {t('deadlines.suggestions.rulesPreview', 'Con estas reglas:')}{' '}
            <span className="font-semibold text-primary">
              {t('deadlines.suggestions.rulesPreviewDetail', '{{projects}} proyecto(s) · hasta {{hours}}h', {
                projects: previewProjectCount,
                hours: formatDeadlineHoursForDisplay(previewTotalHours),
              })}
            </span>
            {previewPeopleCount > 0 && (
              <span className="text-slate-600">
                {mode === 'give'
                  ? t('deadlines.suggestions.rulesPreviewPeopleGive', '· {{count}} cedente(s)', { count: previewPeopleCount })
                  : t('deadlines.suggestions.rulesPreviewPeopleTake', '· {{count}} destino(s)', { count: previewPeopleCount })}
              </span>
            )}
          </p>
        ) : (
          <p className="text-amber-900 text-xs leading-relaxed">
            {t('deadlines.suggestions.rulesNoSuggestions', 'No hay sugerencias con estas reglas. Prueba «Solo en común», activa más {{role}}, o ajusta los límites de carga arriba.', {
              role: mode === 'give' ? t('deadlines.suggestions.rulesAdjustDonors', 'cedentes') : t('deadlines.suggestions.rulesAdjustReceivers', 'destinos'),
            })}
          </p>
        )}
      </div>

      <SuggestionLoadLimitsCard
        minSenderLoadPct={minSenderLoadPct}
        minSenderLoadPctInput={minSenderLoadPctInput}
        setMinSenderLoadPct={setMinSenderLoadPct}
        setMinSenderLoadPctInput={setMinSenderLoadPctInput}
        maxReceiverLoadPct={maxReceiverLoadPct}
        maxReceiverLoadPctInput={maxReceiverLoadPctInput}
        setMaxReceiverLoadPct={setMaxReceiverLoadPct}
        setMaxReceiverLoadPctInput={setMaxReceiverLoadPctInput}
      />

      <div className="space-y-2 flex flex-col min-h-0">
        <p className="text-sm font-semibold text-slate-800">
          {mode === 'give' ? t('deadlines.suggestions.rulesWhoCanGive', '¿Quién puede darle horas?') : t('deadlines.suggestions.rulesWhoCanReceive', '¿A quién puede pasarle trabajo?')}
        </p>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder={t('deadlines.suggestions.searchPerson', 'Buscar persona...')}
            value={personSearch}
            onChange={(e) => setPersonSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="min-h-[200px] max-h-[min(34vh,300px)] overflow-y-auto space-y-2 pr-1 border rounded-lg p-2.5 bg-white">
          {mode === 'give'
            ? donorList.map((d) => {
                const allowed = !excludedDonorIds.includes(d.id);
                const shares = sharingDonorIds.has(d.id);
                return (
                  <PersonToggleRow
                    key={d.id}
                    name={d.name}
                    avatarUrl={d.avatarUrl}
                    allowed={allowed}
                    hint={shares ? t('deadlines.suggestions.rulesSharesProject', 'Comparte proyecto') : t('deadlines.suggestions.rulesNoSharedProject', 'Sin proyecto en común')}
                    hintMuted={!shares}
                    onToggle={(c) =>
                      setExcludedDonorIds((prev) =>
                        c ? prev.filter((id) => id !== d.id) : [...prev, d.id]
                      )
                    }
                  />
                );
              })
            : receiverList.map((r) => {
                const allowed = !excludedReceiverIds.includes(r.id);
                const shares = sharingReceiverIds.has(r.id);
                return (
                  <PersonToggleRow
                    key={r.id}
                    name={r.name}
                    avatarUrl={r.avatarUrl}
                    allowed={allowed}
                    hint={shares ? t('deadlines.suggestions.rulesSharesProject', 'Comparte proyecto') : t('deadlines.suggestions.rulesNoSharedProject', 'Sin proyecto en común')}
                    hintMuted={!shares}
                    onToggle={(c) =>
                      setExcludedReceiverIds((prev) =>
                        c ? prev.filter((id) => id !== r.id) : [...prev, r.id]
                      )
                    }
                  />
                );
              })}
          {(mode === 'give' ? donorList : receiverList).length === 0 && (
            <p className="text-xs text-slate-500 text-center py-3">{t('deadlines.suggestions.rulesNoSearchMatch', 'Nadie coincide con la búsqueda.')}</p>
          )}
        </div>
        <p className="text-xs text-slate-500">
          {mode === 'give'
            ? t('deadlines.suggestions.donorsCanGive', '{{count}} persona(s) pueden ceder', { count: allowedDonorCount })
            : t('deadlines.suggestions.activeDestinations', '{{count}} destino(s) activos', { count: allowedReceiverCount })}
        </p>
      </div>

      <div className="space-y-2 pt-1 border-t border-slate-100">
        <p className="text-sm font-semibold text-slate-800">{t('deadlines.suggestions.rulesWhichProjects', '¿En qué proyectos?')}</p>
        <div className="space-y-2">
          {scopeOptions.map((opt) => (
            <label
              key={opt.value}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                flowProjectScope === opt.value
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-slate-200 hover:bg-slate-50'
              )}
            >
              <input
                type="radio"
                name="project-scope"
                className="mt-1"
                checked={flowProjectScope === opt.value}
                onChange={() => applyScope(opt.value)}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">{opt.title}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{opt.hint}</p>
              </div>
            </label>
          ))}
        </div>
        {flowProjectScope === 'manual' && (
          <div className="border rounded-lg p-2 bg-slate-50/80 space-y-2">
            <p className="text-[11px] text-slate-600">
              {includedProjectIds.size === 0 ? (
                <>{t('deadlines.suggestions.noProjectSelected')}</>
              ) : (
                <>
                  <span className="font-medium text-slate-800">{includedProjectIds.size}</span> de{' '}
                  {manualProjects.length} proyecto(s) de {focusEmployeeName}
                </>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {sharedProjectIdsForManual.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px]"
                  onClick={selectSharedProjectsOnly}
                >
                  Marcar solo en común ({sharedProjectIdsForManual.length})
                </Button>
              )}
              {includedProjectIds.size > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[10px]"
                  onClick={() => setIncludedProjectIds(new Set())}
                >
                  Desmarcar todos
                </Button>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Buscar proyecto..."
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {manualProjects.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2 text-xs py-1 px-1 rounded hover:bg-white cursor-pointer"
                >
                  <Checkbox
                    checked={includedProjectIds.has(p.id)}
                    onCheckedChange={(c) =>
                      setIncludedProjectIds((prev) => {
                        const next = new Set(prev);
                        if (c) next.add(p.id);
                        else next.delete(p.id);
                        return next;
                      })
                    }
                  />
                  <span className="truncate">{p.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <p className="text-xs text-slate-500">{scopeLabel(flowProjectScope, t)}</p>
      </div>
    </div>
  );
}

function PersonToggleRow({
  name,
  avatarUrl,
  allowed,
  hint,
  hintMuted,
  onToggle,
}: {
  name: string;
  avatarUrl?: string;
  allowed: boolean;
  hint: string;
  hintMuted?: boolean;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-lg border px-2.5 py-2 min-h-[3rem]',
        allowed ? 'bg-white border-slate-200' : 'bg-slate-100/80 border-slate-100 opacity-85'
      )}
    >
      <Avatar className="h-8 w-8 shrink-0 border border-slate-200">
        <AvatarImage src={avatarUrl} alt={name} />
        <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
          {name.substring(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate leading-snug">{name}</p>
        <p className={cn('text-xs truncate mt-0.5', hintMuted ? 'text-slate-400' : 'text-slate-500')}>
          {hint}
        </p>
      </div>
      <Switch checked={allowed} onCheckedChange={onToggle} className="shrink-0 scale-105" />
    </div>
  );
}
