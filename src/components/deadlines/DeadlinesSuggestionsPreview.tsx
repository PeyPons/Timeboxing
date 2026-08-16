/**
 * Vista compacta de recomendaciones de redistribución en el sidebar de Deadlines.
 * Siempre visible: con sugerencias muestra hasta 3; sin ellas, explica y abre el asistente.
 */

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sparkles, HelpCircle, ChevronRight, Maximize2, RotateCcw } from 'lucide-react';
import { CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { countProjectsWithTransfers, totalSuggestedHoursForGroup } from '@/utils/deadlinesSuggestionsPrefs';
import type { EmployeeRecommendation } from '@/hooks/useDeadlinesRedistribution';

export interface DeadlinesSuggestionsPreviewProps {
  groups: EmployeeRecommendation[];
  emptyMessage?: string | null;
  hasRestrictiveFilters?: boolean;
  onOpenFull: () => void;
  wizardPaused?: boolean;
  wizardResumeLabel?: string;
  onDiscardWizard?: () => void;
  onResetFilters?: () => void;
}

export function DeadlinesSuggestionsPreview({
  groups,
  emptyMessage,
  hasRestrictiveFilters,
  onOpenFull,
  wizardPaused,
  wizardResumeLabel,
  onDiscardWizard,
  onResetFilters,
}: DeadlinesSuggestionsPreviewProps) {
  const { t } = useTranslation('app');
  const hasSuggestions = groups.length > 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm" data-tour="suggestions">
      <div className="flex items-center gap-1 mb-2">
        <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1 flex-1 min-w-0">
          <Sparkles className="h-3 w-3 text-primary shrink-0" />
          <span className="truncate">{t('deadlines.suggestions.title', 'Recomendaciones')}</span>
          {hasRestrictiveFilters && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-amber-200 text-amber-700 shrink-0">
              {t('deadlines.suggestions.filtersBadge', 'Filtros')}
            </Badge>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3 w-3 text-slate-400 cursor-help shrink-0" />
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className="max-w-[260px] z-[100] p-0 border-slate-200/90 bg-gradient-to-br from-slate-50 to-white shadow-lg rounded-xl overflow-hidden"
              >
                <div className="p-3.5">
                  <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-slate-200/80">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <p className="font-semibold text-slate-800 text-sm">{t('deadlines.suggestions.assistantTitle', 'Asistente de reparto')}</p>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-600">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{t('deadlines.suggestions.tipDetect', 'Detecta quién puede ceder y quién recibir horas')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{t('deadlines.suggestions.tipBreakdown', 'Desglose por proyecto; tú decides si aplicar')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{t('deadlines.suggestions.tipRestore', 'Si no ves opciones, abre el asistente y pulsa «Restaurar filtros»')}</span>
                    </li>
                  </ul>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </h3>
      </div>

      {wizardPaused && wizardResumeLabel && (
        <div className="mb-3 p-2.5 rounded-lg border border-primary/35 bg-primary/5 space-y-2">
          <p className="text-[11px] font-semibold text-primary">{t('deadlines.suggestions.assistantPaused', 'Asistente en pausa')}</p>
          <p className="text-[10px] text-slate-600 leading-snug">{wizardResumeLabel}</p>
          <Button type="button" size="sm" className="w-full h-8 text-xs" onClick={onOpenFull}>
            {t('deadlines.suggestions.continueAssistant', 'Continuar asistente')}
          </Button>
          {onDiscardWizard && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full h-7 text-[10px] text-slate-500"
              onClick={onDiscardWizard}
            >
              {t('deadlines.suggestions.startOver', 'Empezar de nuevo')}
            </Button>
          )}
        </div>
      )}

      {hasSuggestions ? (
        <>
          <div className="space-y-1.5">
            {groups.map((group) => (
              <button
                key={group.employeeId}
                type="button"
                onClick={onOpenFull}
                className="w-full flex items-center gap-2 p-2 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-100/80 text-left transition-colors"
              >
                <Avatar className="h-7 w-7 border-2 border-white shadow-sm shrink-0">
                  <AvatarImage src={group.employeeAvatar} alt={group.employeeName} />
                  <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                    {group.employeeName.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-slate-800 text-xs truncate flex-1">
                  {group.employeeName}
                </span>
            <Badge variant="secondary" className="text-[10px] bg-slate-200/80 text-slate-600 shrink-0">
              {t('deadlines.suggestions.projectsHours', '{{count}} proy. · {{hours}}h', {
                count: countProjectsWithTransfers(group),
                hours: totalSuggestedHoursForGroup(group),
              })}
            </Badge>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 h-8 text-slate-600 hover:bg-slate-100 text-xs"
            onClick={onOpenFull}
          >
            <Maximize2 className="h-3 w-3 mr-1" />
            {t('deadlines.suggestions.viewFullBreakdown', 'Ver desglose completo')}
          </Button>
        </>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 leading-relaxed">
            {emptyMessage ?? t('deadlines.suggestions.emptyDefault', 'No hay transferencias sugeridas con la carga actual del mes. Abre el asistente para revisar condicionantes.')}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs"
            onClick={onOpenFull}
          >
            <Sparkles className="h-3 w-3 mr-1 text-primary" />
            {t('deadlines.suggestions.openAssistant', 'Abrir asistente')}
          </Button>
          {hasRestrictiveFilters && onResetFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-[11px] text-slate-500"
              onClick={onResetFilters}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              {t('deadlines.suggestions.restoreDefaultFilters', 'Restaurar filtros por defecto')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
