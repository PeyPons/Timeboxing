/**
 * Panel ampliable de sugerencias de redistribución (Sheet en móvil, Dialog en desktop).
 * Condicionantes (quién cede, % máx. receptor, % mín. quien cede), lista por empleado/proyecto
 * y resumen propuesto (transferencias y cargas resultantes).
 * Componente controlado: estado y callbacks vienen de la página.
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  FolderKanban,
  ArrowRight,
  Inbox,
  Share2,
  Search,
  RotateCcw,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SensitiveText } from '@/components/privacy/SensitiveText';
import { formatDeadlineHoursForDisplay, roundDeadlineHours } from '@/utils/deadlineUtils';
import type { PanelFlowView } from '@/hooks/useDeadlinesSuggestionsState';
import type { Deadline } from '@/types';
import type { SuggestionsFlowMode, SuggestionsFlowPreset } from '@/utils/deadlinesSuggestionsPrefs';
import { SuggestionIntentPicker } from '@/components/deadlines/suggestions/SuggestionIntentPicker';
import { SuggestionActiveRulesChips } from '@/components/deadlines/suggestions/SuggestionActiveRulesChips';
import type { FlowProjectScope } from '@/utils/suggestionRulesUtils';
import { SuggestionGiveFlow } from '@/components/deadlines/suggestions/SuggestionGiveFlow';
import { SuggestionTakeFlow } from '@/components/deadlines/suggestions/SuggestionTakeFlow';
import { OpenProjectButton } from '@/components/deadlines/suggestions/OpenProjectButton';
import { SuggestionTeamResumen } from '@/components/deadlines/suggestions/SuggestionTeamResumen';
import { SuggestionTeamBalanceView } from '@/components/deadlines/suggestions/SuggestionTeamBalanceView';
import { SuggestionTeamLimitsSidebar } from '@/components/deadlines/suggestions/SuggestionTeamLimitsSidebar';
import {
  buildExpandedEmployeesForTeamView,
  computeTeamSuggestionsSummary,
  meetsMinSuggestedTransferHours,
} from '@/utils/suggestionTeamUtils';

export interface SuggestionDonor {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface TransferSuggestion {
  fromId: string;
  fromName: string;
  fromAvatar?: string;
  hoursOnProject: number;
  suggestedHours: number;
  reason: string;
}

export interface ProjectRecommendation {
  projectId: string;
  projectName: string;
  transfers: TransferSuggestion[];
}

export interface EmployeeRecommendation {
  employeeId: string;
  employeeName: string;
  employeeAvatar?: string;
  deficitHours: number;
  projects: ProjectRecommendation[];
}

export interface CapacityResult {
  available: number;
}

export interface DeadlinesSuggestionsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMobile: boolean;
  /** Al cerrar, el padre puede resetear estos si lo desea */
  expandedProjects: Set<string>;
  setExpandedProjects: (v: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  expandedEmployees: Set<string>;
  setExpandedEmployees: (v: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  excludedDonorIds: string[];
  setExcludedDonorIds: (v: string[] | ((prev: string[]) => string[])) => void;
  maxReceiverLoadPct: number;
  setMaxReceiverLoadPct: (v: number) => void;
  maxReceiverLoadPctInput: string;
  setMaxReceiverLoadPctInput: (v: string) => void;
  minSenderLoadPct: number;
  setMinSenderLoadPct: (v: number) => void;
  minSenderLoadPctInput: string;
  setMinSenderLoadPctInput: (v: string) => void;
  minSuggestedTransferHours: number;
  setMinSuggestedTransferHours: (v: number) => void;
  minSuggestedTransferHoursInput: string;
  setMinSuggestedTransferHoursInput: (v: string) => void;
  suggestionsCondicionantesOpen: boolean;
  setSuggestionsCondicionantesOpen: (v: boolean) => void;
  rightPanelPorProyectoOpen: boolean;
  setRightPanelPorProyectoOpen: (v: boolean) => void;
  suggestionDonors: SuggestionDonor[];
  suggestionsByEmployeeAndProject: EmployeeRecommendation[];
  getMonthlyCapacity: (employeeId: string) => CapacityResult;
  getEmployeeAssignedHours: (employeeId: string) => number;
  onlySharedProjects: boolean;
  setOnlySharedProjects: (v: boolean) => void;
  includedProjectIds: Set<string>;
  setIncludedProjectIds: (v: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  filteredProjects: { id: string; name: string }[];
  suggestionsEmptyMessage?: string | null;
  hasRestrictiveFilters?: boolean;
  onResetFilters?: () => void;
  panelFlowView: PanelFlowView;
  setPanelFlowView: (v: PanelFlowView) => void;
  wizardStep: number;
  setWizardStep: (v: number | ((n: number) => number)) => void;
  focusEmployeeId: string | null;
  setFocusEmployeeId: (v: string | null) => void;
  flowProjectScope: FlowProjectScope;
  setFlowProjectScope: (scope: FlowProjectScope) => void;
  excludedReceiverIds: string[];
  setExcludedReceiverIds: (v: string[] | ((prev: string[]) => string[])) => void;
  deadlines: Deadline[];
  hiddenProjects: Set<string>;
  onInitializeGiveRules: (receiverId: string) => void;
  onInitializeTakeRules: (donorId: string) => void;
  startFlow: (mode: SuggestionsFlowMode, preset?: SuggestionsFlowPreset) => void;
  lastFlowMode?: SuggestionsFlowMode;
  onOpenProject?: (projectId: string) => void;
}

function handleClose(
  onOpenChange: (open: boolean) => void,
  setExpandedProjects: (v: Set<string> | ((prev: Set<string>) => Set<string>)) => void,
  setExpandedEmployees: (v: Set<string> | ((prev: Set<string>) => Set<string>)) => void
) {
  setExpandedProjects(new Set());
  setExpandedEmployees(new Set());
  onOpenChange(false);
}

/** Bloque condicionantes: quién puede ceder, % receptor/cedente, solo proyectos compartidos, proyectos a considerar */
function CondicionantesBlock({
  suggestionDonors,
  excludedDonorIds,
  setExcludedDonorIds,
  maxReceiverLoadPctInput,
  setMaxReceiverLoadPctInput,
  setMaxReceiverLoadPct,
  minSenderLoadPctInput,
  setMinSenderLoadPctInput,
  setMinSenderLoadPct,
  suggestionsCondicionantesOpen,
  setSuggestionsCondicionantesOpen,
  onlySharedProjects,
  setOnlySharedProjects,
  includedProjectIds,
  setIncludedProjectIds,
  filteredProjects,
  hasRestrictiveFilters,
  onResetFilters,
  compact,
  hideLoadPctFields,
  dense,
}: {
  suggestionDonors: SuggestionDonor[];
  excludedDonorIds: string[];
  setExcludedDonorIds: (v: string[] | ((prev: string[]) => string[])) => void;
  maxReceiverLoadPctInput: string;
  setMaxReceiverLoadPctInput: (v: string) => void;
  setMaxReceiverLoadPct: (v: number) => void;
  minSenderLoadPctInput: string;
  setMinSenderLoadPctInput: (v: string) => void;
  setMinSenderLoadPct: (v: number) => void;
  suggestionsCondicionantesOpen: boolean;
  setSuggestionsCondicionantesOpen: (v: boolean) => void;
  onlySharedProjects: boolean;
  setOnlySharedProjects: (v: boolean) => void;
  includedProjectIds: Set<string>;
  setIncludedProjectIds: (v: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  filteredProjects: { id: string; name: string }[];
  hasRestrictiveFilters?: boolean;
  onResetFilters?: () => void;
  compact?: boolean;
  /** En modo equipo los % van en el sidebar de límites. */
  hideLoadPctFields?: boolean;
  /** Filas y paddings más pequeños en vista compacta. */
  dense?: boolean;
}) {
  const { t } = useTranslation('app');
  const [projectSearch, setProjectSearch] = useState('');
  const projectsFilteredBySearch = projectSearch.trim()
    ? filteredProjects.filter((p) => p.name.toLowerCase().includes(projectSearch.trim().toLowerCase()))
    : filteredProjects;

  const triggerLabel = compact
    ? t('deadlines.suggestions.adjustConditions', 'Ajustar condicionantes')
    : t('deadlines.suggestions.conditionsTitle', 'Condicionantes del reparto');

  return (
    <Collapsible open={suggestionsCondicionantesOpen} onOpenChange={setSuggestionsCondicionantesOpen}>
      <div className={cn('flex items-center gap-2', compact ? 'mb-2' : 'mb-3')}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex items-center gap-2 flex-1 min-w-0 text-left font-medium rounded-lg transition-colors',
              compact
                ? 'text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-100 py-2 px-2'
                : 'text-sm text-slate-700 hover:text-slate-900 hover:bg-slate-100 py-2.5 px-3 border border-slate-200 bg-slate-50/50 hover:border-slate-300'
            )}
            title={t('deadlines.suggestions.conditionsTooltip', 'Quién puede ceder, límites de carga y proyectos a considerar')}
          >
            {suggestionsCondicionantesOpen ? (
              <ChevronUp className={cn(compact ? 'h-3.5 w-3.5' : 'h-4 w-4', 'shrink-0')} />
            ) : (
              <ChevronDown className={cn(compact ? 'h-3.5 w-3.5' : 'h-4 w-4', 'shrink-0')} />
            )}
            <span className="flex-1 truncate">{triggerLabel}</span>
            {hasRestrictiveFilters && (
              <Badge variant="outline" className="text-[10px] shrink-0 border-amber-200 text-amber-800">
                {t('deadlines.suggestions.activeFilters')}
              </Badge>
            )}
          </button>
        </CollapsibleTrigger>
        {onResetFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn('shrink-0 text-slate-500', compact ? 'h-8 px-2 text-[10px]' : 'h-9 text-xs')}
            onClick={onResetFilters}
            title={t('deadlines.suggestions.restoreTooltip', 'Volver a 100% receptor, 30% mín. cedente, sin exclusiones ni filtros de proyecto')}
          >
            <RotateCcw className={cn(compact ? 'h-3 w-3' : 'h-3.5 w-3.5', 'mr-1')} />
            {t('deadlines.suggestions.restore', 'Restaurar')}
          </Button>
        )}
      </div>
      <CollapsibleContent>
        {compact ? (
          <div
            className={cn(
              'border border-slate-200 rounded-lg bg-slate-50/80 mb-1',
              dense ? 'space-y-1.5 py-1.5 px-2 pb-2' : 'space-y-3 py-2 pb-3 px-3'
            )}
          >
            <p className={cn('font-semibold text-slate-500 uppercase', dense ? 'text-[10px]' : 'text-[11px]')}>
              {t('deadlines.suggestions.whoCanDonate')}
            </p>
            <div className={cn('grid grid-cols-1', dense ? 'gap-1' : 'gap-2')}>
              {suggestionDonors.map((d) => {
                const allowed = !excludedDonorIds.includes(d.id);
                return (
                  <div
                    key={d.id}
                    className={cn(
                      'flex items-center gap-2 rounded-md border',
                      dense ? 'p-1.5 min-h-[1.75rem]' : 'p-2 min-h-[2.25rem] rounded-lg',
                      allowed ? 'bg-white border-slate-200' : 'bg-slate-100/80 border-slate-100 opacity-75'
                    )}
                  >
                    <Avatar
                      className={cn(
                        'shrink-0 border border-slate-200',
                        dense ? 'h-5 w-5' : 'h-6 w-6'
                      )}
                    >
                      <AvatarImage src={d.avatarUrl} alt={d.name} />
                      <AvatarFallback className="text-[10px]">{d.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate text-xs font-medium min-w-0" title={d.name}>
                      {d.name}
                    </span>
                    <Switch
                      checked={allowed}
                      onCheckedChange={(c) =>
                        setExcludedDonorIds((prev) => (c ? prev.filter((id) => id !== d.id) : [...prev, d.id]))
                      }
                      className="shrink-0"
                    />
                  </div>
                );
              })}
            </div>
            {!hideLoadPctFields && (
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-3 flex items-center justify-between gap-3 min-w-0">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Inbox className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{t('deadlines.suggestions.receiverHoursTitle')}</p>
                    <p className="text-xs text-slate-500">{t('deadlines.suggestions.maxReceiverHint')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={maxReceiverLoadPctInput}
                    onChange={(e) => {
                      const v = e.target.value;
                      setMaxReceiverLoadPctInput(v);
                      const n = parseInt(v, 10);
                      if (v !== '' && !isNaN(n) && n >= 1 && n <= 100) setMaxReceiverLoadPct(n);
                    }}
                    onBlur={() => {
                      const n = parseInt(maxReceiverLoadPctInput, 10);
                      const clamped =
                        maxReceiverLoadPctInput === '' || isNaN(n) || n < 1
                          ? 100
                          : Math.min(100, Math.max(1, n));
                      setMaxReceiverLoadPct(clamped);
                      setMaxReceiverLoadPctInput(String(clamped));
                    }}
                    className="h-9 w-14 text-center text-base font-mono font-bold tabular-nums"
                  />
                  <span className="text-sm font-semibold text-slate-600 w-5">%</span>
                </div>
              </div>
              <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 px-3 py-3 flex items-center justify-between gap-3 min-w-0">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                    <Share2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{t('deadlines.suggestions.senderHoursTitle')}</p>
                    <p className="text-xs text-slate-500">{t('deadlines.suggestions.minSenderHint')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={minSenderLoadPctInput}
                    onChange={(e) => {
                      const v = e.target.value;
                      setMinSenderLoadPctInput(v);
                      const n = parseInt(v, 10);
                      if (v !== '' && !isNaN(n) && n >= 0 && n <= 100) setMinSenderLoadPct(n);
                    }}
                    onBlur={() => {
                      const n = parseInt(minSenderLoadPctInput, 10);
                      const clamped =
                        minSenderLoadPctInput === '' || isNaN(n) || n < 0
                          ? 30
                          : Math.min(100, Math.max(0, n));
                      setMinSenderLoadPct(clamped);
                      setMinSenderLoadPctInput(String(clamped));
                    }}
                    className="h-9 w-14 text-center text-base font-mono font-bold tabular-nums"
                  />
                  <span className="text-sm font-semibold text-slate-600 w-5">%</span>
                </div>
              </div>
            </div>
            )}
            <div
              className={cn(
                dense ? 'space-y-1.5' : 'space-y-2',
                !hideLoadPctFields ? 'pt-2 border-t border-slate-200' : dense ? 'pt-1 border-t border-slate-200' : 'pt-0'
              )}
            >
              <div
                className={cn(
                  'flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white',
                  dense ? 'p-1.5' : 'p-2 rounded-lg'
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FolderKanban className={cn('text-slate-500 shrink-0', dense ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
                  <span className={cn('font-medium text-slate-700', dense ? 'text-[11px]' : 'text-xs')}>
                    {t('deadlines.suggestions.sharedProjectsOnly', 'Solo proyectos en común')}
                  </span>
                </div>
                <Switch checked={onlySharedProjects} onCheckedChange={setOnlySharedProjects} className="shrink-0 scale-90" />
              </div>
              {filteredProjects.length > 0 && (
                <Popover onOpenChange={(open) => !open && setProjectSearch('')}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn('w-full justify-start', dense ? 'text-[11px] h-7' : 'text-xs h-8')}
                    >
                      <FolderKanban className="h-3.5 w-3.5 mr-1.5" />
                      {includedProjectIds.size === 0
                        ? t('deadlines.suggestions.allProjects', 'Todos los proyectos')
                        : t('deadlines.suggestions.projectsSelected', '{{count}} proyectos seleccionados', { count: includedProjectIds.size })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2 max-h-56 overflow-auto" align="start">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase mb-2">Solo considerar estos proyectos</p>
                    <div className="relative mb-2">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        placeholder={t('deadlines.suggestions.searchProject', 'Buscar proyecto...')}
                        value={projectSearch}
                        onChange={(e) => setProjectSearch(e.target.value)}
                        className="pl-8 h-8 text-xs"
                      />
                    </div>
                    <div className="max-h-44 overflow-auto">
                      {projectsFilteredBySearch.slice(0, 50).map((p) => (
                        <label key={p.id} className="flex items-center gap-2 py-1.5 cursor-pointer text-xs">
                          <Checkbox
                            checked={includedProjectIds.has(p.id)}
                            onCheckedChange={(checked) => {
                              setIncludedProjectIds((prev) => {
                                const next = new Set(prev);
                                if (checked) next.add(p.id);
                                else next.delete(p.id);
                                return next;
                              });
                            }}
                          />
                          <span className="truncate">
                            <SensitiveText kind="project" id={p.id}>{p.name}</SensitiveText>
                          </span>
                        </label>
                      ))}
                    </div>
                    {(projectsFilteredBySearch.length > 50 || filteredProjects.length > 50) && (
                      <p className="text-[10px] text-slate-400 pt-1">
                        {projectSearch.trim() ? `${projectsFilteredBySearch.length} de ${filteredProjects.length}` : `Mostrando 50 de ${filteredProjects.length}`}
                      </p>
                    )}
                    {includedProjectIds.size > 0 && (
                      <Button variant="ghost" size="sm" className="mt-1 w-full text-[10px] h-7" onClick={() => setIncludedProjectIds(new Set())}>
                        Usar todos
                      </Button>
                    )}
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr,auto] gap-6 py-4 px-4 border border-slate-200 rounded-xl bg-gradient-to-br from-slate-50 to-white shadow-sm">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-3">
                {t('deadlines.suggestions.whoCanDonateHours')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {suggestionDonors.map((d) => {
                  const allowed = !excludedDonorIds.includes(d.id);
                  return (
                    <div
                      key={d.id}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border p-2 transition-colors min-h-[2.25rem]',
                        allowed ? 'border-slate-200 bg-white shadow-sm' : 'border-slate-100 bg-slate-100/80 opacity-75'
                      )}
                    >
                      <Avatar className="h-6 w-6 border border-slate-200 shrink-0">
                        <AvatarImage src={d.avatarUrl} alt={d.name} />
                        <AvatarFallback className="bg-slate-100 text-slate-600 text-[10px] font-medium">
                          {d.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className="flex-1 truncate text-sm font-medium text-slate-800 min-w-0"
                        title={d.name}
                      >
                        {d.name}
                      </span>
                      <Switch
                        checked={allowed}
                        onCheckedChange={(checked) =>
                          setExcludedDonorIds((prev) =>
                            checked ? prev.filter((id) => id !== d.id) : [...prev, d.id]
                          )
                        }
                        className="shrink-0"
                      />
                    </div>
                  );
                })}
                {suggestionDonors.length === 0 && (
                  <span className="text-xs text-slate-500 col-span-full">
                    Nadie cumple el % mínimo de quien cede o no tiene horas en proyectos visibles. Baja el % mínimo o
                    revisa las asignaciones del mes.
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-4 border-l border-slate-200 pl-6 lg:pl-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-sm min-w-0">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Inbox className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold text-slate-800 leading-tight">{t('deadlines.suggestions.receiverHoursTitle')}</p>
                      <p className="text-sm text-slate-500 mt-0.5">{t('deadlines.suggestions.maxReceiverHint')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={maxReceiverLoadPctInput}
                      onChange={(e) => {
                        const v = e.target.value;
                        setMaxReceiverLoadPctInput(v);
                        const n = parseInt(v, 10);
                        if (v !== '' && !isNaN(n) && n >= 1 && n <= 100) setMaxReceiverLoadPct(n);
                      }}
                      onBlur={() => {
                        const n = parseInt(maxReceiverLoadPctInput, 10);
                        const clamped =
                          maxReceiverLoadPctInput === '' || isNaN(n) || n < 1
                            ? 100
                            : Math.min(100, Math.max(1, n));
                        setMaxReceiverLoadPct(clamped);
                        setMaxReceiverLoadPctInput(String(clamped));
                      }}
                      className="h-10 w-16 text-center font-mono text-lg font-bold tabular-nums"
                    />
                    <span className="text-base font-semibold text-slate-600">%</span>
                  </div>
                </div>
                <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-4 shadow-sm min-w-0">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                      <Share2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold text-slate-800 leading-tight">{t('deadlines.suggestions.senderHoursTitle')}</p>
                      <p className="text-sm text-slate-500 mt-0.5">{t('deadlines.suggestions.minSenderHint')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={minSenderLoadPctInput}
                      onChange={(e) => {
                        const v = e.target.value;
                        setMinSenderLoadPctInput(v);
                        const n = parseInt(v, 10);
                        if (v !== '' && !isNaN(n) && n >= 0 && n <= 100) setMinSenderLoadPct(n);
                      }}
                      onBlur={() => {
                        const n = parseInt(minSenderLoadPctInput, 10);
                        const clamped =
                          minSenderLoadPctInput === '' || isNaN(n) || n < 0
                            ? 30
                            : Math.min(100, Math.max(0, n));
                        setMinSenderLoadPct(clamped);
                        setMinSenderLoadPctInput(String(clamped));
                      }}
                      className="h-10 w-16 text-center font-mono text-lg font-bold tabular-nums"
                    />
                    <span className="text-base font-semibold text-slate-600">%</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <FolderKanban className="h-4 w-4 text-slate-500 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{t('deadlines.suggestions.sharedProjectsOnly')}</p>
                      <p className="text-[11px] text-slate-500">{t('deadlines.suggestions.sharedProjectsHint')}</p>
                    </div>
                  </div>
                  <Switch checked={onlySharedProjects} onCheckedChange={setOnlySharedProjects} className="shrink-0" />
                </div>
                {filteredProjects.length > 0 && (
                  <Popover onOpenChange={(open) => !open && setProjectSearch('')}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-start text-sm h-9">
                        <FolderKanban className="h-4 w-4 mr-2" />
                        {includedProjectIds.size === 0 ? 'Todos los proyectos' : `Solo ${includedProjectIds.size} proyecto(s) seleccionados`}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-2 max-h-80 overflow-hidden flex flex-col" align="start">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase mb-2">Solo considerar estos proyectos</p>
                      <p className="text-[11px] text-slate-500 mb-2">{t('deadlines.suggestions.emptyMeansAll')}</p>
                      <div className="relative mb-2">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder={t('deadlines.suggestions.searchProject', 'Buscar proyecto...')}
                          value={projectSearch}
                          onChange={(e) => setProjectSearch(e.target.value)}
                          className="pl-9 h-9 text-sm"
                        />
                      </div>
                      <div className="overflow-auto max-h-52 min-h-0">
                        {projectsFilteredBySearch.slice(0, 100).map((p) => (
                          <label key={p.id} className="flex items-center gap-2 py-1.5 cursor-pointer text-sm">
                            <Checkbox
                              checked={includedProjectIds.has(p.id)}
                              onCheckedChange={(checked) => {
                                setIncludedProjectIds((prev) => {
                                  const next = new Set(prev);
                                  if (checked) next.add(p.id);
                                  else next.delete(p.id);
                                  return next;
                                });
                              }}
                            />
                            <span className="truncate">
                              <SensitiveText kind="project" id={p.id}>{p.name}</SensitiveText>
                            </span>
                          </label>
                        ))}
                      </div>
                      {(projectsFilteredBySearch.length > 100 || filteredProjects.length > 100) && (
                        <p className="text-[10px] text-slate-400 pt-1">
                          {projectSearch.trim() ? `${projectsFilteredBySearch.length} de ${filteredProjects.length}` : `Mostrando 100 de ${filteredProjects.length}`}
                        </p>
                      )}
                      {includedProjectIds.size > 0 && (
                        <Button variant="ghost" size="sm" className="mt-2 w-full text-xs" onClick={() => setIncludedProjectIds(new Set())}>
                          Usar todos los proyectos
                        </Button>
                      )}
                    </PopoverContent>
                  </Popover>
                )}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Las sugerencias se recalculan al cambiar cualquier valor.
              </p>
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Resumen propuesto para un empleado (usado en móvil dentro de cada grupo y en desktop en panel derecho) */
function ResumenPropuesto({
  group,
  getMonthlyCapacity,
  getEmployeeAssignedHours,
  compact,
  rightPanelPorProyectoOpen,
  setRightPanelPorProyectoOpen,
}: {
  group: EmployeeRecommendation;
  getMonthlyCapacity: (id: string) => CapacityResult;
  getEmployeeAssignedHours: (id: string) => number;
  compact?: boolean;
  rightPanelPorProyectoOpen?: boolean;
  setRightPanelPorProyectoOpen?: (v: boolean) => void;
}) {
  const { t } = useTranslation('app');
  const byFrom = new Map<string, { fromName: string; fromAvatar?: string; hours: number }>();
  const byProject: {
    projectId: string;
    projectName: string;
    items: { fromName: string; hours: number }[];
  }[] = [];
  let totalToReceptor = 0;
  group.projects.forEach((p) => {
    const projectItems: { fromName: string; hours: number }[] = [];
    p.transfers.forEach((t) => {
      if (t.suggestedHours <= 0) return;
      const h = roundDeadlineHours(t.suggestedHours);
      if (!byFrom.has(t.fromId)) byFrom.set(t.fromId, { fromName: t.fromName, fromAvatar: t.fromAvatar, hours: 0 });
      byFrom.get(t.fromId)!.hours = roundDeadlineHours(byFrom.get(t.fromId)!.hours + h);
      totalToReceptor = roundDeadlineHours(totalToReceptor + h);
      projectItems.push({ fromName: t.fromName, hours: h });
    });
    if (projectItems.length) byProject.push({ projectId: p.projectId, projectName: p.projectName, items: projectItems });
  });
  if (totalToReceptor <= 0) {
    if (!compact) {
      const rCap = getMonthlyCapacity(group.employeeId).available;
      const rAssigned = getEmployeeAssignedHours(group.employeeId);
      const rPct = rCap > 0 ? Math.round((rAssigned / rCap) * 100) : 0;
      return (
        <div className="text-sm text-slate-600 py-4 space-y-2">
          <p>Sin transferencias sugeridas con los condicionantes actuales.</p>
          {group.deficitHours > 0 && (
            <p className="text-xs text-slate-500">
              Margen bajo el tope configurado: ~{formatDeadlineHoursForDisplay(group.deficitHours)}h · Carga actual ~{rPct}%
            </p>
          )}
        </div>
      );
    }
    return null;
  }
  const receptorCap = getMonthlyCapacity(group.employeeId).available;
  const receptorAssigned = getEmployeeAssignedHours(group.employeeId);
  const receptorNewPct = receptorCap > 0 ? Math.round(((receptorAssigned + totalToReceptor) / receptorCap) * 100) : 0;
  const originLoads = Array.from(byFrom.entries()).map(([fromId, { fromName, hours }]) => {
    const cap = getMonthlyCapacity(fromId).available;
    const assigned = getEmployeeAssignedHours(fromId);
    const pct = cap > 0 ? Math.round(((assigned - hours) / cap) * 100) : 0;
    return { fromId, fromName, fromAvatar: byFrom.get(fromId)?.fromAvatar, hours, pct };
  });

  if (compact) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 mt-3 space-y-3 shadow-sm">
        <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Resumen propuesto</p>
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-slate-500">Quitar horas a</p>
          <div className="flex flex-wrap gap-2">
            {Array.from(byFrom.entries()).map(([fromId, { fromName, fromAvatar, hours }]) => (
              <div
                key={fromId}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm"
              >
                <Avatar className="h-7 w-7 border border-slate-200 shrink-0">
                  <AvatarImage src={fromAvatar} alt={fromName} />
                  <AvatarFallback className="bg-slate-100 text-slate-600 text-[10px] font-medium">
                    {fromName.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium text-slate-800 truncate max-w-[100px]">{fromName}</span>
                <Badge variant="secondary" className="shrink-0 bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-mono">
                  −{formatDeadlineHoursForDisplay(hours)}h
                </Badge>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-slate-200" />
          <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <div className="flex-1 h-px bg-slate-200" />
        </div>
        <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-2.5">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-9 w-9 border-2 border-primary/30 shrink-0">
              <AvatarImage src={group.employeeAvatar} alt={group.employeeName} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {group.employeeName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-slate-500">{t('deadlines.suggestions.addHoursTo')}</p>
              <p className="font-semibold text-slate-900 text-sm truncate">{group.employeeName}</p>
            </div>
            <Badge className="shrink-0 bg-primary text-primary-foreground text-xs font-mono">
              +{formatDeadlineHoursForDisplay(totalToReceptor)}h
            </Badge>
          </div>
        </div>
        <div>
          <p className="text-[11px] font-medium text-slate-500 mb-1.5">Cargas resultantes</p>
          <div className="flex flex-wrap gap-1.5">
            {originLoads.map((o) => (
              <span
                key={o.fromId}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                  o.pct > 100 ? 'bg-red-50 border-red-200 text-red-700' : o.pct >= 80 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-700'
                )}
              >
                {o.fromName} {o.pct}%
              </span>
            ))}
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[11px] font-medium text-primary">
              {group.employeeName} {receptorNewPct}%
            </span>
          </div>
        </div>
        {byProject.length > 0 && (
          <div>
            <p className="text-[11px] font-medium text-slate-500 mb-1">Por proyecto</p>
            <div className="space-y-1.5">
              {byProject.map((proj) => (
                <div key={proj.projectId} className="rounded border border-slate-200 bg-white px-2 py-1.5">
                  <p className="text-[11px] font-medium text-slate-700 truncate">
                    <SensitiveText kind="project" id={proj.projectId}>{proj.projectName}</SensitiveText>
                  </p>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {proj.items.map((item, j) => (
                      <span
                        key={j}
                        className="text-[10px] text-slate-600 bg-slate-100 rounded px-1 font-mono"
                      >
                        {item.fromName} −{formatDeadlineHoursForDisplay(item.hours)}h
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Desktop panel derecho
  return (
    <>
      <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Resumen propuesto</h4>
      <div className="mb-2">
        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide mb-1">Cargas resultantes</p>
        <div className="flex flex-wrap gap-1.5">
          {originLoads.map((o) => (
            <span
              key={o.fromId}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                o.pct > 100 ? 'bg-red-50 border-red-200 text-red-700' : o.pct >= 80 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-700'
              )}
            >
              <span className="truncate max-w-[72px]">{o.fromName}</span>
              <span className="font-mono font-semibold">{o.pct}%</span>
            </span>
          ))}
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[11px] font-medium text-primary">
            <span className="truncate max-w-[72px]">{group.employeeName}</span>
            <span className="font-mono font-semibold">{receptorNewPct}%</span>
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <p className="text-[11px] font-medium text-slate-500 uppercase w-full">Transferencias</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {Array.from(byFrom.entries()).map(([fromId, { fromName, fromAvatar, hours }]) => (
            <div
              key={fromId}
              className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white pl-1 pr-2 py-1 shadow-sm"
            >
              <Avatar className="h-6 w-6 border border-slate-200 shrink-0">
                <AvatarImage src={fromAvatar} alt={fromName} />
                <AvatarFallback className="text-[10px]">{fromName.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="text-[11px] font-medium text-slate-700 truncate max-w-[70px]">{fromName}</span>
              <span className="text-[11px] font-mono text-rose-600 font-semibold">
                −{formatDeadlineHoursForDisplay(hours)}h
              </span>
            </div>
          ))}
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        <div className="flex items-center gap-2 rounded-lg border-2 border-primary/30 bg-primary/5 pl-2 pr-2.5 py-1.5">
          <Avatar className="h-7 w-7 border-2 border-primary/30 shrink-0">
            <AvatarImage src={group.employeeAvatar} alt={group.employeeName} />
            <AvatarFallback className="text-xs font-semibold text-primary">
              {group.employeeName.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs font-semibold text-slate-800 truncate max-w-[90px]">{group.employeeName}</span>
          <Badge className="shrink-0 bg-primary text-primary-foreground text-[11px] font-mono">
            +{formatDeadlineHoursForDisplay(totalToReceptor)}h
          </Badge>
        </div>
      </div>
      {byProject.length > 0 && rightPanelPorProyectoOpen !== undefined && setRightPanelPorProyectoOpen && (
        <Collapsible open={rightPanelPorProyectoOpen} onOpenChange={setRightPanelPorProyectoOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-700 py-0.5 mt-0.5"
            >
              {rightPanelPorProyectoOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Por proyecto ({byProject.length})
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-1.5 pt-1">
              {byProject.map((proj) => (
                <div key={proj.projectId} className="rounded border border-slate-200 bg-white px-2 py-1.5">
                  <p className="text-[11px] font-medium text-slate-700 truncate">
                    <SensitiveText kind="project" id={proj.projectId}>{proj.projectName}</SensitiveText>
                  </p>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {proj.items.map((item, j) => (
                      <span
                        key={j}
                        className="text-[10px] text-slate-600 bg-slate-100 rounded px-1 font-mono"
                      >
                        {item.fromName} −{formatDeadlineHoursForDisplay(item.hours)}h
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </>
  );
}

export function DeadlinesSuggestionsPanel(props: DeadlinesSuggestionsPanelProps) {
  const {
    open,
    onOpenChange,
    isMobile,
    expandedProjects,
    setExpandedProjects,
    expandedEmployees,
    setExpandedEmployees,
    excludedDonorIds,
    setExcludedDonorIds,
    maxReceiverLoadPct,
    setMaxReceiverLoadPct,
    maxReceiverLoadPctInput,
    setMaxReceiverLoadPctInput,
    minSenderLoadPct,
    setMinSenderLoadPct,
    minSenderLoadPctInput,
    setMinSenderLoadPctInput,
    minSuggestedTransferHours,
    setMinSuggestedTransferHours,
    minSuggestedTransferHoursInput,
    setMinSuggestedTransferHoursInput,
    suggestionsCondicionantesOpen,
    setSuggestionsCondicionantesOpen,
    rightPanelPorProyectoOpen,
    setRightPanelPorProyectoOpen,
    suggestionDonors,
    suggestionsByEmployeeAndProject,
    getMonthlyCapacity,
    getEmployeeAssignedHours,
    onlySharedProjects,
    setOnlySharedProjects,
    includedProjectIds,
    setIncludedProjectIds,
    filteredProjects,
    suggestionsEmptyMessage,
    hasRestrictiveFilters,
    onResetFilters,
    panelFlowView,
    setPanelFlowView,
    wizardStep,
    setWizardStep,
    focusEmployeeId,
    setFocusEmployeeId,
    flowProjectScope,
    setFlowProjectScope,
    excludedReceiverIds,
    setExcludedReceiverIds,
    deadlines,
    hiddenProjects,
    onInitializeGiveRules,
    onInitializeTakeRules,
    startFlow,
    lastFlowMode,
    onOpenProject,
  } = props;

  const { t } = useTranslation('app');
  const [teamLimitsOpen, setTeamLimitsOpen] = useState(false);

  const onClose = () => handleClose(onOpenChange, setExpandedProjects, setExpandedEmployees);

  const handleBack = () => {
    if (panelFlowView === 'give' || panelFlowView === 'take') {
      if (wizardStep > 1) setWizardStep((s) => s - 1);
      else setPanelFlowView('intent');
    } else if (panelFlowView === 'team') {
      setPanelFlowView('intent');
    }
  };

  const showBack = panelFlowView !== 'intent';

  const titleText =
    panelFlowView === 'intent'
      ? t('deadlines.suggestions.panelTitleIntent', 'Repartir carga del mes')
      : panelFlowView === 'give'
        ? t('deadlines.suggestions.giveHours', 'Dar horas a alguien')
        : panelFlowView === 'take'
          ? t('deadlines.suggestions.takeLoad', 'Quitar carga a alguien')
          : t('deadlines.suggestions.balanceTeam', 'Equilibrar todo el equipo');

  const title = (
    <span className="flex items-center gap-2">
      {showBack && (
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
      )}
      <Sparkles className="h-5 w-5 text-orange-500 shrink-0" />
      {titleText}
    </span>
  );

  const descriptionText =
    panelFlowView === 'intent'
      ? t('deadlines.suggestions.panelGive', 'Elige cómo quieres repartir la carga. Los cambios se aplican en cada proyecto.')
      : panelFlowView === 'give'
        ? t('deadlines.suggestions.panelGiveFlow', 'Guía paso a paso para sumar horas a una persona.')
        : panelFlowView === 'take'
          ? t('deadlines.suggestions.panelTakeFlow', 'Guía paso a paso para aliviar a alguien sobrecargado.')
          : t('deadlines.suggestions.panelTeam', 'Reparto sugerido para todo el equipo. Ajusta límites y revisa cada persona.');

  const flowBody =
    panelFlowView === 'intent' ? (
      <SuggestionIntentPicker
        lastMode={lastFlowMode}
        onSelect={(mode, preset) => {
          startFlow(mode, preset);
          if (mode === 'team') {
            setExpandedEmployees(new Set());
            setExpandedProjects(new Set());
            setSuggestionsCondicionantesOpen(false);
          }
        }}
      />
    ) : panelFlowView === 'give' ? (
      <SuggestionGiveFlow
        step={wizardStep}
        setStep={setWizardStep}
        focusEmployeeId={focusEmployeeId}
        setFocusEmployeeId={setFocusEmployeeId}
        suggestionsByEmployeeAndProject={suggestionsByEmployeeAndProject}
        suggestionDonors={suggestionDonors}
        deadlines={deadlines}
        hiddenProjects={hiddenProjects}
        flowProjectScope={flowProjectScope}
        setFlowProjectScope={setFlowProjectScope}
        excludedDonorIds={excludedDonorIds}
        setExcludedDonorIds={setExcludedDonorIds}
        onlySharedProjects={onlySharedProjects}
        setOnlySharedProjects={setOnlySharedProjects}
        includedProjectIds={includedProjectIds}
        setIncludedProjectIds={setIncludedProjectIds}
        filteredProjects={filteredProjects}
        getMonthlyCapacity={getMonthlyCapacity}
        getEmployeeAssignedHours={getEmployeeAssignedHours}
        maxReceiverLoadPct={maxReceiverLoadPct}
        maxReceiverLoadPctInput={maxReceiverLoadPctInput}
        setMaxReceiverLoadPct={setMaxReceiverLoadPct}
        setMaxReceiverLoadPctInput={setMaxReceiverLoadPctInput}
        minSenderLoadPct={minSenderLoadPct}
        minSenderLoadPctInput={minSenderLoadPctInput}
        setMinSenderLoadPct={setMinSenderLoadPct}
        setMinSenderLoadPctInput={setMinSenderLoadPctInput}
        onInitializeRules={onInitializeGiveRules}
        onOpenProject={onOpenProject}
      />
    ) : panelFlowView === 'take' ? (
      <SuggestionTakeFlow
        step={wizardStep}
        setStep={setWizardStep}
        focusEmployeeId={focusEmployeeId}
        setFocusEmployeeId={setFocusEmployeeId}
        suggestionDonors={suggestionDonors}
        suggestionsByEmployeeAndProject={suggestionsByEmployeeAndProject}
        deadlines={deadlines}
        hiddenProjects={hiddenProjects}
        flowProjectScope={flowProjectScope}
        setFlowProjectScope={setFlowProjectScope}
        excludedReceiverIds={excludedReceiverIds}
        setExcludedReceiverIds={setExcludedReceiverIds}
        onlySharedProjects={onlySharedProjects}
        setOnlySharedProjects={setOnlySharedProjects}
        includedProjectIds={includedProjectIds}
        setIncludedProjectIds={setIncludedProjectIds}
        filteredProjects={filteredProjects}
        getMonthlyCapacity={getMonthlyCapacity}
        getEmployeeAssignedHours={getEmployeeAssignedHours}
        minSenderLoadPct={minSenderLoadPct}
        minSenderLoadPctInput={minSenderLoadPctInput}
        setMinSenderLoadPct={setMinSenderLoadPct}
        setMinSenderLoadPctInput={setMinSenderLoadPctInput}
        maxReceiverLoadPct={maxReceiverLoadPct}
        maxReceiverLoadPctInput={maxReceiverLoadPctInput}
        setMaxReceiverLoadPct={setMaxReceiverLoadPct}
        setMaxReceiverLoadPctInput={setMaxReceiverLoadPctInput}
        onInitializeRules={onInitializeTakeRules}
        onOpenProject={onOpenProject}
      />
    ) : null;

  const allowedDonorCount =
    panelFlowView === 'give'
      ? suggestionDonors.filter((d) => !excludedDonorIds.includes(d.id)).length
      : undefined;
  const allowedReceiverCount =
    panelFlowView === 'take'
      ? suggestionsByEmployeeAndProject.filter((g) => !excludedReceiverIds.includes(g.employeeId)).length
      : undefined;

  const teamSummary = useMemo(
    () => computeTeamSuggestionsSummary(suggestionsByEmployeeAndProject, minSuggestedTransferHours),
    [suggestionsByEmployeeAndProject, minSuggestedTransferHours]
  );

  const expandAllTeamEmployees = () => {
    setExpandedEmployees(
      buildExpandedEmployeesForTeamView(suggestionsByEmployeeAndProject, minSuggestedTransferHours)
    );
  };

  const rulesChips =
    panelFlowView === 'give' || panelFlowView === 'take' || panelFlowView === 'team' ? (
      <SuggestionActiveRulesChips
        mode={panelFlowView}
        flowProjectScope={flowProjectScope}
        onlySharedProjects={onlySharedProjects}
        includedProjectIds={includedProjectIds}
        excludedDonorIds={excludedDonorIds}
        excludedReceiverIds={excludedReceiverIds}
        minSenderLoadPct={minSenderLoadPct}
        maxReceiverLoadPct={maxReceiverLoadPct}
        minSuggestedTransferHours={minSuggestedTransferHours}
        allowedDonorCount={allowedDonorCount}
        allowedReceiverCount={allowedReceiverCount}
      />
    ) : null;

  const condicionantesProps = {
    suggestionDonors,
    excludedDonorIds,
    setExcludedDonorIds,
    maxReceiverLoadPctInput,
    setMaxReceiverLoadPctInput,
    setMaxReceiverLoadPct,
    minSenderLoadPctInput,
    setMinSenderLoadPctInput,
    setMinSenderLoadPct,
    suggestionsCondicionantesOpen,
    setSuggestionsCondicionantesOpen,
    onlySharedProjects,
    setOnlySharedProjects,
    includedProjectIds,
    setIncludedProjectIds,
    filteredProjects,
    hasRestrictiveFilters,
    onResetFilters,
  };

  const teamCondicionantes = (
    <CondicionantesBlock {...condicionantesProps} compact hideLoadPctFields dense />
  );

  const teamLimitsProps = {
    minSenderLoadPct,
    minSenderLoadPctInput,
    setMinSenderLoadPct,
    setMinSenderLoadPctInput,
    maxReceiverLoadPct,
    maxReceiverLoadPctInput,
    setMaxReceiverLoadPct,
    setMaxReceiverLoadPctInput,
    minSuggestedTransferHours,
    minSuggestedTransferHoursInput,
    setMinSuggestedTransferHoursInput,
    setMinSuggestedTransferHours,
    onResetFilters,
    condicionantesBlock: teamCondicionantes,
  };

  const teamLimitsSidebar = <SuggestionTeamLimitsSidebar {...teamLimitsProps} />;
  const teamMobileLimits = <SuggestionTeamLimitsSidebar {...teamLimitsProps} variant="embedded" />;

  const emptyState = (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center space-y-3">
      <AlertCircle className="h-10 w-10 text-slate-300 mx-auto" />
      <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
        {suggestionsEmptyMessage ??
          'No hay transferencias sugeridas. Ajusta los condicionantes o restaura los valores por defecto.'}
      </p>
      {onResetFilters && (
        <Button variant="outline" size="sm" onClick={onResetFilters}>
          <RotateCcw className="h-4 w-4 mr-2" />
          {t('deadlines.suggestions.restoreDefaultFilters', 'Restaurar filtros por defecto')}
        </Button>
      )}
    </div>
  );

  const sortedTeamGroups = useMemo(() => {
    const hoursFor = (g: EmployeeRecommendation) => {
      let total = 0;
      for (const p of g.projects) {
        for (const t of p.transfers) {
          if (meetsMinSuggestedTransferHours(t.suggestedHours, minSuggestedTransferHours)) {
            total += Number(t.suggestedHours) || 0;
          }
        }
      }
      return total;
    };
    return [...suggestionsByEmployeeAndProject].sort((a, b) => {
      const diff = hoursFor(b) - hoursFor(a);
      if (Math.abs(diff) > 1e-6) return diff;
      return b.deficitHours - a.deficitHours;
    });
  }, [suggestionsByEmployeeAndProject, minSuggestedTransferHours]);

  const listContent =
    sortedTeamGroups.length === 0 ? (
      emptyState
    ) : (
    <>
      {sortedTeamGroups.map((group) => {
        const isEmployeeOpen = expandedEmployees.has(group.employeeId);
        const groupSuggestedHours = group.projects.reduce((sum, p) => {
          for (const t of p.transfers) {
            if (meetsMinSuggestedTransferHours(t.suggestedHours, minSuggestedTransferHours)) {
              sum += Number(t.suggestedHours) || 0;
            }
          }
          return sum;
        }, 0);
        const visibleProjects = group.projects
          .map((p) => ({
            ...p,
            transfers: p.transfers.filter((t) =>
              meetsMinSuggestedTransferHours(t.suggestedHours, minSuggestedTransferHours)
            ),
          }))
          .filter((p) => p.transfers.length > 0);
        return (
          <div key={group.employeeId} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <Collapsible
              open={isEmployeeOpen}
              onOpenChange={(open) =>
                setExpandedEmployees((prev) => {
                  const next = new Set(prev);
                  if (open) next.add(group.employeeId);
                  else next.delete(group.employeeId);
                  return next;
                })
              }
            >
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-slate-50/80 transition-colors"
                >
                  <Avatar className="h-10 w-10 border-2 border-slate-200 shrink-0 ring-1 ring-slate-100">
                    <AvatarImage src={group.employeeAvatar} alt={group.employeeName} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                      {group.employeeName.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{group.employeeName}</p>
                    <p className="text-xs text-slate-500">
                      {visibleProjects.length > 0
                        ? `Hasta ${formatDeadlineHoursForDisplay(groupSuggestedHours)}h en ${visibleProjects.length} ${visibleProjects.length === 1 ? 'proyecto' : 'proyectos'}`
                        : group.deficitHours > 0.01
                          ? 'Margen para recibir; sin movimientos con los filtros actuales'
                          : 'Sin sugerencias con los filtros actuales'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {groupSuggestedHours > 0 && (
                      <Badge className="text-xs bg-primary/10 text-primary border border-primary/20 font-medium">
                        +{formatDeadlineHoursForDisplay(groupSuggestedHours)}h
                      </Badge>
                    )}
                    <Badge
                      variant="secondary"
                      className="text-xs bg-amber-50 text-amber-800 border border-amber-200 font-medium"
                    >
                      Déficit: {formatDeadlineHoursForDisplay(group.deficitHours)}h
                    </Badge>
                    <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-700 font-medium">
                      {visibleProjects.length}
                    </Badge>
                  </div>
                  {isEmployeeOpen ? (
                    <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t border-slate-100 bg-slate-50/30 px-2 pb-2 pt-1 space-y-2">
                  {visibleProjects.length === 0 ? (
                    <div className="px-2 py-4 text-center text-sm text-slate-600">
                      Prueba a bajar el mínimo por transferencia, relajar el % de quien cede o subir el tope del
                      receptor.
                    </div>
                  ) : null}
                  {visibleProjects.map((proj) => {
                    const projectKey = `${group.employeeId}-${proj.projectId}`;
                    const isProjectOpen = expandedProjects.has(projectKey);
                    return (
                      <div key={projectKey} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                        <Collapsible
                          open={isProjectOpen}
                          onOpenChange={(open) =>
                            setExpandedProjects((prev) => {
                              const n = new Set(prev);
                              if (open) n.add(projectKey);
                              else n.delete(projectKey);
                              return n;
                            })
                          }
                        >
                          <CollapsibleTrigger asChild>
                            <button
                              type="button"
                              className="w-full flex items-center gap-2.5 p-2.5 text-left hover:bg-slate-50 transition-colors"
                            >
                              <FolderKanban className="h-4 w-4 text-slate-400 shrink-0" />
                              <span className="font-medium text-slate-800 text-sm truncate flex-1">
                                <SensitiveText kind="project" id={proj.projectId}>{proj.projectName}</SensitiveText>
                              </span>
                              <span className="text-[11px] text-slate-500 shrink-0">
                                {t('deadlines.suggestions.origin', { count: proj.transfers.length })}
                              </span>
                              {isProjectOpen ? (
                                <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                              )}
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="border-t border-slate-100 bg-slate-50/50 px-2 py-2 space-y-2">
                              {proj.transfers.map((t) => (
                                <div
                                  key={t.fromId}
                                  className="flex items-start gap-3 p-2.5 rounded-md bg-white border border-slate-100 shadow-sm"
                                >
                                  <Avatar className="h-8 w-8 border border-slate-200 shrink-0">
                                    <AvatarImage src={t.fromAvatar} alt={t.fromName} />
                                    <AvatarFallback className="bg-slate-100 text-slate-600 text-xs font-medium">
                                      {t.fromName.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-slate-900 text-sm">{t.fromName}</p>
                                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                                      <span className="font-mono font-semibold text-primary">
                                        {formatDeadlineHoursForDisplay(t.hoursOnProject)}h
                                      </span>
                                      <span>asignadas en este proyecto</span>
                                    </p>
                                    <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                                      <ArrowRight className="h-3 w-3 text-slate-400" />
                                      {t.suggestedHours > 0 ? (
                                        <>
                                          Pasar hasta {formatDeadlineHoursForDisplay(t.suggestedHours)}h a{' '}
                                          {group.employeeName}
                                        </>
                                      ) : (
                                        <>Sin margen sugerido; revisar en tabla</>
                                      )}
                                    </p>
                                  </div>
                                  <OpenProjectButton
                                    projectId={proj.projectId}
                                    onOpenProject={onOpenProject}
                                    className="shrink-0 mt-1"
                                  />
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    );
                  })}
                  {isMobile && (
                    <ResumenPropuesto
                      group={group}
                      getMonthlyCapacity={getMonthlyCapacity}
                      getEmployeeAssignedHours={getEmployeeAssignedHours}
                      compact
                    />
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        );
      })}
    </>
  );

  const selectedGroup = suggestionsByEmployeeAndProject.find((g) => expandedEmployees.has(g.employeeId));

  const teamRightPanelContent = (
    <>
      <SuggestionTeamResumen summary={teamSummary} />
      {selectedGroup && teamSummary.transferCount > 0 ? (
        <div className="mt-4 pt-4 border-t border-slate-200">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Detalle: {selectedGroup.employeeName}
          </p>
          <ResumenPropuesto
            group={selectedGroup}
            getMonthlyCapacity={getMonthlyCapacity}
            getEmployeeAssignedHours={getEmployeeAssignedHours}
            rightPanelPorProyectoOpen={rightPanelPorProyectoOpen}
            setRightPanelPorProyectoOpen={setRightPanelPorProyectoOpen}
          />
        </div>
      ) : teamSummary.transferCount > 0 ? (
        <p className="text-xs text-slate-500 mt-4 leading-relaxed">
          {t('deadlines.suggestions.expandRowHint', 'Expande una fila en la lista para ver aquí el desglose por proyecto.')}
        </p>
      ) : null}
    </>
  );

  const teamBalanceView = (
    <SuggestionTeamBalanceView
      summary={teamSummary}
      listContent={listContent}
      rightPanel={teamRightPanelContent}
      limitsSidebar={teamLimitsSidebar}
      mobileLimitsContent={teamMobileLimits}
      rulesChips={rulesChips}
      onExpandAll={expandAllTeamEmployees}
      onCollapseAll={() => {
        setExpandedEmployees(new Set());
        setExpandedProjects(new Set());
      }}
      teamLimitsOpen={teamLimitsOpen}
      onTeamLimitsOpenChange={setTeamLimitsOpen}
      hasRestrictiveFilters={hasRestrictiveFilters}
      onResetFilters={onResetFilters}
    />
  );

  if (isMobile) {
    const teamMobile = panelFlowView === 'team';
    return (
      <Sheet open={open} onOpenChange={(o) => (o ? onOpenChange(true) : onClose())}>
        <SheetContent
          side="bottom"
          className={cn(
            'flex flex-col p-0 gap-0',
            teamMobile ? 'h-[100dvh] max-h-[100dvh] rounded-none' : 'h-[min(90vh,720px)] rounded-t-2xl p-6'
          )}
        >
          {teamMobile ? (
            <>
              <SheetHeader className="shrink-0 text-left px-4 pt-4 pb-3 border-b space-y-1">
                <SheetTitle>{title}</SheetTitle>
                <p className="text-xs text-muted-foreground font-normal">{descriptionText}</p>
              </SheetHeader>
              <div className="flex flex-1 min-h-0 overflow-hidden">{teamBalanceView}</div>
            </>
          ) : (
            <>
              <SheetHeader className="text-left">
                <SheetTitle>{title}</SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-hidden flex flex-col mt-2 min-h-0">
                <p className="text-xs text-slate-500 mb-2">{descriptionText}</p>
                {rulesChips}
                <div className="flex flex-col flex-1 min-h-0 overflow-hidden pr-1">
                  {flowBody ?? (
                    <div className="flex min-h-[280px] items-center justify-center text-sm text-slate-500 px-4 text-center">
                      No se puede mostrar este paso. Vuelve atrás o elige otra persona.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  const isTeamFullscreen = panelFlowView === 'team';

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : onClose())}>
      <DialogContent
        className={cn(
          'flex flex-col',
          isTeamFullscreen
            ? '!left-0 !top-0 !translate-x-0 !translate-y-0 w-screen h-[100dvh] max-h-[100dvh] max-w-none rounded-none border-0 p-0 gap-0 overflow-hidden sm:rounded-none'
            : 'max-w-[95vw] sm:max-w-[640px] md:max-w-4xl lg:max-w-5xl xl:max-w-6xl h-[min(90vh,720px)] max-h-[90vh]'
        )}
      >
        {isTeamFullscreen ? (
          <>
            <div className="shrink-0 flex items-start gap-2 px-4 py-3 border-b bg-background pr-14">
              <div className="flex-1 min-w-0 space-y-1 text-left">
                <DialogTitle className="text-left leading-snug">{title}</DialogTitle>
                <DialogDescription className="text-left">{descriptionText}</DialogDescription>
              </div>
            </div>
            <div className="flex flex-1 min-h-0 overflow-hidden">{teamBalanceView}</div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{descriptionText}</DialogDescription>
            </DialogHeader>
            {rulesChips}
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden py-1">
              {flowBody ?? (
                <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-slate-500 px-4 text-center">
                  No se puede mostrar este paso. Vuelve atrás o elige otra persona.
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
