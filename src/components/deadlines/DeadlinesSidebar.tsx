/**
 * Panel lateral de Deadlines (solo desktop): disponibilidad, recomendaciones y tareas globales.
 */

import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DeadlinesAvailabilityCard,
  type CapacityData,
} from '@/components/deadlines/DeadlinesAvailabilityCard';
import { DeadlinesCapacityShortcuts } from '@/components/deadlines/DeadlinesCapacityShortcuts';
import { DeadlinesSuggestionsPreview } from '@/components/deadlines/DeadlinesSuggestionsPreview';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { EmployeeRecommendation } from '@/hooks/useDeadlinesRedistribution';

export interface GlobalAssignmentItem {
  id: string;
  name: string;
  hours: number;
  employeeId?: string;
}

export interface EmployeeOption {
  id: string;
  name: string;
  first_name?: string;
  avatarUrl?: string;
}

export interface DeadlinesSidebarProps {
  employees: EmployeeOption[];
  getMonthlyCapacity: (employeeId: string) => CapacityData;
  getEmployeeAssignedHours: (employeeId: string) => number;
  suggestionsPreview: EmployeeRecommendation[];
  suggestionsEmptyMessage?: string | null;
  hasRestrictiveFilters?: boolean;
  onOpenSuggestionsFull: () => void;
  suggestionsWizardPaused?: boolean;
  suggestionsWizardResumeLabel?: string;
  onDiscardSuggestionsWizard?: () => void;
  onResetSuggestionsFilters?: () => void;
  globalAssignments: GlobalAssignmentItem[];
  currentUserId: string | undefined;
  /** Quien puede editar deadlines puede eliminar cualquier asignación global del mes. */
  canDeleteAnyGlobalAssignment?: boolean;
  onOpenGlobalDialog: (assignment?: GlobalAssignmentItem) => void;
  onDeleteGlobal: (id: string) => void;
}

export function DeadlinesSidebar({
  employees,
  getMonthlyCapacity,
  getEmployeeAssignedHours,
  suggestionsPreview,
  suggestionsEmptyMessage,
  hasRestrictiveFilters,
  onOpenSuggestionsFull,
  suggestionsWizardPaused,
  suggestionsWizardResumeLabel,
  onDiscardSuggestionsWizard,
  onResetSuggestionsFilters,
  globalAssignments,
  currentUserId,
  canDeleteAnyGlobalAssignment = false,
  onOpenGlobalDialog,
  onDeleteGlobal,
}: DeadlinesSidebarProps) {
  return (
    <div className="w-64 flex-shrink-0 self-start sticky top-4 md:top-6 h-[calc(100vh-1.5rem)]">
      <div className="h-full overflow-y-auto overflow-x-clip space-y-4 pb-2 [scrollbar-gutter:stable]">
        <DeadlinesAvailabilityCard
          employees={employees}
          getMonthlyCapacity={getMonthlyCapacity}
          getEmployeeAssignedHours={getEmployeeAssignedHours}
          compact={false}
        />
        <DeadlinesSuggestionsPreview
          groups={suggestionsPreview}
          emptyMessage={suggestionsEmptyMessage}
          hasRestrictiveFilters={hasRestrictiveFilters}
          onOpenFull={onOpenSuggestionsFull}
          wizardPaused={suggestionsWizardPaused}
          wizardResumeLabel={suggestionsWizardResumeLabel}
          onDiscardWizard={onDiscardSuggestionsWizard}
          onResetFilters={onResetSuggestionsFilters}
        />
        <div className="bg-white rounded-xl border shadow-sm p-3" data-tour="global-assignments">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Otras asignaciones
            </h3>
            <Button onClick={() => onOpenGlobalDialog()} size="sm" variant="ghost" className="h-6 w-6 p-0">
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          {globalAssignments.length === 0 ? (
            <div className="text-[10px] text-slate-400 italic">Sin asignaciones extra</div>
          ) : (
            <div className="space-y-1">
              {globalAssignments.map((a) => {
                const canDelete =
                  canDeleteAnyGlobalAssignment ||
                  !a.employeeId ||
                  a.employeeId === currentUserId;
                return (
                  <div key={a.id} className="flex items-center justify-between text-xs group">
                    <span className="truncate text-slate-600">{a.name}</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-primary">+{a.hours}h</span>
                      <button
                        onClick={() => onOpenGlobalDialog(a)}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600"
                      >
                        <Pencil className="h-2.5 w-2.5" />
                      </button>
                      {canDelete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteGlobal(a.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <DeadlinesCapacityShortcuts employees={employees} />
        </div>
      </div>
    </div>
  );
}
