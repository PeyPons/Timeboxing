/**
 * Estado de condicionantes del asistente de recomendaciones en Deadlines.
 * Carga/guarda preferencias en localStorage y expone reset con valores por defecto.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  clearDeadlinesSuggestionsPrefs,
  defaultDeadlinesSuggestionsPrefs,
  loadDeadlinesSuggestionsPrefs,
  saveDeadlinesSuggestionsPrefs,
  sanitizeDeadlinesSuggestionsPrefs,
  getSuggestionsFlowPresetValues,
  type DeadlinesSuggestionsPrefs,
  type SuggestionsFlowMode,
  type SuggestionsFlowPreset,
} from '@/utils/deadlinesSuggestionsPrefs';
import type { FlowProjectScope } from '@/utils/suggestionRulesUtils';

export type { SuggestionsFlowMode };
export type PanelFlowView = 'intent' | SuggestionsFlowMode;

export interface UseDeadlinesSuggestionsStateParams {
  agencyId: string | undefined;
  userId: string | undefined;
  validDonorIds: Set<string>;
  validProjectIds: Set<string>;
}

export function useDeadlinesSuggestionsState({
  agencyId,
  userId,
  validDonorIds,
  validProjectIds,
}: UseDeadlinesSuggestionsStateParams) {
  const defaults = defaultDeadlinesSuggestionsPrefs();
  const prefsLoadedRef = useRef(false);

  const [excludedDonorIds, setExcludedDonorIds] = useState<string[]>(defaults.excludedDonorIds);
  const [maxReceiverLoadPct, setMaxReceiverLoadPct] = useState(defaults.maxReceiverLoadPct);
  const [maxReceiverLoadPctInput, setMaxReceiverLoadPctInput] = useState(String(defaults.maxReceiverLoadPct));
  const [minSenderLoadPct, setMinSenderLoadPct] = useState(defaults.minSenderLoadPct);
  const [minSenderLoadPctInput, setMinSenderLoadPctInput] = useState(String(defaults.minSenderLoadPct));
  const [minSuggestedTransferHours, setMinSuggestedTransferHours] = useState(
    defaults.minSuggestedTransferHours
  );
  const [minSuggestedTransferHoursInput, setMinSuggestedTransferHoursInput] = useState(
    String(defaults.minSuggestedTransferHours)
  );
  const [onlySharedProjects, setOnlySharedProjects] = useState(defaults.onlySharedProjects);
  const [includedProjectIds, setIncludedProjectIds] = useState<Set<string>>(
    () => new Set(defaults.includedProjectIds)
  );

  const [isSuggestionsExpandedOpen, setIsSuggestionsExpandedOpen] = useState(false);
  const [expandedSuggestionsProjects, setExpandedSuggestionsProjects] = useState<Set<string>>(new Set());
  const [expandedSuggestionsEmployees, setExpandedSuggestionsEmployees] = useState<Set<string>>(new Set());
  const [suggestionsCondicionantesOpen, setSuggestionsCondicionantesOpen] = useState(false);
  const [rightPanelPorProyectoOpen, setRightPanelPorProyectoOpen] = useState(false);
  const [panelFlowView, setPanelFlowView] = useState<PanelFlowView>('intent');
  const [wizardStep, setWizardStep] = useState(1);
  const [focusEmployeeId, setFocusEmployeeId] = useState<string | null>(null);
  /** Alcance de proyectos en flujos Dar/Quitar (evita confundir manual vacío con «todos»). */
  const [flowProjectScope, setFlowProjectScope] = useState<FlowProjectScope>('shared');
  /** Solo flujo «Quitar carga»: receptores que no reciben sugerencias. */
  const [excludedReceiverIds, setExcludedReceiverIds] = useState<string[]>([]);

  const applyPrefs = useCallback((prefs: DeadlinesSuggestionsPrefs) => {
    setExcludedDonorIds(prefs.excludedDonorIds);
    setMaxReceiverLoadPct(prefs.maxReceiverLoadPct);
    setMaxReceiverLoadPctInput(String(prefs.maxReceiverLoadPct));
    setMinSenderLoadPct(prefs.minSenderLoadPct);
    setMinSenderLoadPctInput(String(prefs.minSenderLoadPct));
    setMinSuggestedTransferHours(prefs.minSuggestedTransferHours);
    setMinSuggestedTransferHoursInput(String(prefs.minSuggestedTransferHours));
    setOnlySharedProjects(prefs.onlySharedProjects);
    setIncludedProjectIds(new Set(prefs.includedProjectIds));
  }, []);

  useEffect(() => {
    prefsLoadedRef.current = false;
    const loaded = loadDeadlinesSuggestionsPrefs(agencyId, userId);
    if (loaded) {
      applyPrefs(
        sanitizeDeadlinesSuggestionsPrefs(loaded, {
          validDonorIds,
          validProjectIds,
        })
      );
    } else {
      applyPrefs(defaultDeadlinesSuggestionsPrefs());
    }
    prefsLoadedRef.current = true;
  }, [agencyId, userId, applyPrefs, validDonorIds, validProjectIds]);

  useEffect(() => {
    if (!prefsLoadedRef.current) return;
    const sanitized = sanitizeDeadlinesSuggestionsPrefs(
      {
        excludedDonorIds,
        maxReceiverLoadPct,
        minSenderLoadPct,
        minSuggestedTransferHours,
        onlySharedProjects,
        includedProjectIds: [...includedProjectIds],
      },
      { validDonorIds, validProjectIds }
    );

    if (sanitized.excludedDonorIds.length !== excludedDonorIds.length) {
      setExcludedDonorIds(sanitized.excludedDonorIds);
    }
    if (sanitized.includedProjectIds.length !== includedProjectIds.size) {
      setIncludedProjectIds(new Set(sanitized.includedProjectIds));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-sanitize only when valid donor/project sets change
  }, [validDonorIds, validProjectIds]);

  useEffect(() => {
    if (!prefsLoadedRef.current || !agencyId || !userId) return;
    const lastFlowMode =
      panelFlowView === 'intent' ? undefined : (panelFlowView as SuggestionsFlowMode);
    saveDeadlinesSuggestionsPrefs(agencyId, userId, {
      ...defaultDeadlinesSuggestionsPrefs(),
      excludedDonorIds,
      maxReceiverLoadPct,
      minSenderLoadPct,
      minSuggestedTransferHours,
      onlySharedProjects,
      includedProjectIds: [...includedProjectIds],
      lastFlowMode,
    });
  }, [
    agencyId,
    userId,
    excludedDonorIds,
    maxReceiverLoadPct,
    minSenderLoadPct,
    minSuggestedTransferHours,
    onlySharedProjects,
    includedProjectIds,
    panelFlowView,
  ]);

  const resetSuggestionsPrefs = useCallback(() => {
    clearDeadlinesSuggestionsPrefs(agencyId, userId);
    applyPrefs(defaultDeadlinesSuggestionsPrefs());
    setExpandedSuggestionsProjects(new Set());
    setExpandedSuggestionsEmployees(new Set());
  }, [agencyId, userId, applyPrefs]);

  /** Abre el panel sin borrar modo/paso (p. ej. reanudar tras «Ir al proyecto»). */
  const openSuggestionsAssistant = useCallback(() => {
    setIsSuggestionsExpandedOpen(true);
  }, []);

  const resetSuggestionsAssistantFlow = useCallback(() => {
    setPanelFlowView('intent');
    setWizardStep(1);
    setFocusEmployeeId(null);
    setFlowProjectScope('shared');
    setExcludedReceiverIds([]);
    setExpandedSuggestionsProjects(new Set());
    setExpandedSuggestionsEmployees(new Set());
  }, []);

  /** Cierra el panel pero conserva modo/paso (p. ej. al abrir un proyecto en la tabla). */
  const closeSuggestionsPanelPreserveFlow = useCallback(() => {
    setIsSuggestionsExpandedOpen(false);
  }, []);

  const closeSuggestionsAssistant = useCallback(() => {
    setIsSuggestionsExpandedOpen(false);
    resetSuggestionsAssistantFlow();
  }, [resetSuggestionsAssistantFlow]);

  const applyFlowPreset = useCallback((preset: SuggestionsFlowPreset) => {
    const values = getSuggestionsFlowPresetValues(preset);
    setOnlySharedProjects(values.onlySharedProjects);
    setMinSenderLoadPct(values.minSenderLoadPct);
    setMinSenderLoadPctInput(String(values.minSenderLoadPct));
    setMaxReceiverLoadPct(values.maxReceiverLoadPct);
    setMaxReceiverLoadPctInput(String(values.maxReceiverLoadPct));
    setMinSuggestedTransferHours(values.minSuggestedTransferHours);
    setMinSuggestedTransferHoursInput(String(values.minSuggestedTransferHours));
    setExcludedDonorIds(values.excludedDonorIds);
    setIncludedProjectIds(new Set(values.includedProjectIds));
    setExcludedReceiverIds([]);
    setFlowProjectScope('shared');
  }, []);

  const startFlow = useCallback(
    (mode: SuggestionsFlowMode, preset?: SuggestionsFlowPreset) => {
      if (preset) applyFlowPreset(preset);
      else if (mode === 'give' || mode === 'take') applyFlowPreset('prudent');
      else if (mode === 'team') applyFlowPreset('explore');
      setPanelFlowView(mode);
      setWizardStep(1);
      setFocusEmployeeId(null);
      setFlowProjectScope('shared');
      setExcludedReceiverIds([]);
      setSuggestionsCondicionantesOpen(false);
      if (mode === 'team') {
        setExpandedSuggestionsEmployees(new Set());
        setExpandedSuggestionsProjects(new Set());
      }
    },
    [applyFlowPreset]
  );

  const hasRestrictiveFilters =
    excludedDonorIds.length > 0 ||
    onlySharedProjects ||
    includedProjectIds.size > 0 ||
    flowProjectScope === 'manual' ||
    maxReceiverLoadPct < 100 ||
    minSenderLoadPct > 30 ||
    minSuggestedTransferHours > defaults.minSuggestedTransferHours;

  return {
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
    onlySharedProjects,
    setOnlySharedProjects,
    includedProjectIds,
    setIncludedProjectIds,
    isSuggestionsExpandedOpen,
    setIsSuggestionsExpandedOpen,
    expandedSuggestionsProjects,
    setExpandedSuggestionsProjects,
    expandedSuggestionsEmployees,
    setExpandedSuggestionsEmployees,
    suggestionsCondicionantesOpen,
    setSuggestionsCondicionantesOpen,
    rightPanelPorProyectoOpen,
    setRightPanelPorProyectoOpen,
    resetSuggestionsPrefs,
    hasRestrictiveFilters,
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
    applyFlowPreset,
    openSuggestionsAssistant,
    resetSuggestionsAssistantFlow,
    closeSuggestionsPanelPreserveFlow,
    closeSuggestionsAssistant,
    startFlow,
  };
}
