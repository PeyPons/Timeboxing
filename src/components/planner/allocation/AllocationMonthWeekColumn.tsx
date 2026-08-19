import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AllocationTaskRow } from '@/components/planner/allocation/AllocationTaskRow';
import { AllocationMonthWeekCardHeader } from '@/components/planner/allocation/AllocationMonthWeekCardHeader';
import { AllocationMonthProjectCardHeader } from '@/components/planner/allocation/AllocationMonthProjectCardHeader';
import {
  weekCardSurfaceClass,
  type WeekStripItemSummary,
} from '@/components/planner/allocation/allocationWeekMetricsUtils';
import { ScrollWheelArea } from '@/components/ui/scroll-wheel-area';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { getEffectiveCompletedHours } from '@/utils/hoursTracking';
import { round2 } from '@/utils/numbers';
import { cn } from '@/lib/utils';
import { Plus, Users } from 'lucide-react';
import type { Allocation, Employee, LoadStatus, Project, TaskTransfer, WeeklyFeedback } from '@/types';

const MONTH_SCROLL_WEEK_COL_CLASS =
  'flex-none w-[280px] sm:w-[300px] snap-center';

interface AllocationMonthWeekColumnProps {
  weekStr: string;
  weekIndex: number;
  isLoading: boolean;
  isMonthView: boolean;
  isMonthScrollLayout: boolean;
  isMonthGridLayout: boolean;
  weekDateLabel: string;
  weekSummary: WeekStripItemSummary;
  cardStatus: LoadStatus;
  load: {
    hours: number;
    capacity: number;
    baseCapacity: number;
    status: LoadStatus;
    percentage: number;
    breakdown: { reason: string; hours: number; type: 'absence' | 'event' }[];
  };
  sortedGroups: [string, Allocation[]][];
  week: { weekStart: Date; effectiveStart?: Date; effectiveEnd?: Date };
  weeks: { weekStart: Date }[];
  getProjectById: (id: string) => Project | undefined;
  formatProjectName: (name: string) => string;
  recentlyToggled: Set<string>;
  autoExpand: boolean;
  collapsedProjects: Set<string>;
  toggleProjectCollapse: (projectId: string) => void;
  sortTasks: (tasks: Allocation[]) => Allocation[];
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  onStartAdd: (weekStart: Date) => void;
  inlineEditingId: string | null;
  inlineNameValue: string;
  setInlineNameValue: (value: string) => void;
  saveInlineEdit: (alloc: Allocation) => void;
  startInlineEdit: (alloc: Allocation) => void;
  toggleTaskCompletionWithSums: (alloc: Allocation) => void;
  updateInlineHours: (alloc: Allocation, field: 'hoursActual' | 'hoursComputed', value: string) => void;
  startEditFull: (alloc: Allocation) => void;
  moveTaskToWeek: (alloc: Allocation, targetWeekStart: Date) => void;
  employees: Employee[];
  allocations: Allocation[];
  outgoingTransfers: TaskTransfer[];
  weeklyFeedback: WeeklyFeedback[];
  setTransferTask: (alloc: Allocation) => void;
  setTransferDialogOpen: (open: boolean) => void;
  isWeeklyEnabled: boolean;
  isMobile: boolean;
  isTimeTrackerEnabled: boolean;
  onTimeLogged: (allocationId: string, hoursLogged: number) => void;
  timeEntrySumsByAllocationId: Record<string, number>;
  noteCounts: Record<string, number>;
  employeeId: string;
  onOpenWeeklyForTask: (alloc: Allocation) => void;
  hoursTrackingPreference: 'actual' | 'computed' | undefined;
}

export function AllocationMonthWeekColumn({
  weekStr,
  weekIndex,
  isLoading,
  isMonthView,
  isMonthScrollLayout,
  isMonthGridLayout,
  weekDateLabel,
  weekSummary,
  cardStatus,
  load,
  sortedGroups,
  week,
  weeks,
  getProjectById,
  formatProjectName,
  recentlyToggled,
  autoExpand,
  collapsedProjects,
  toggleProjectCollapse,
  sortTasks,
  selectedProjectId,
  setSelectedProjectId,
  onStartAdd,
  inlineEditingId,
  inlineNameValue,
  setInlineNameValue,
  saveInlineEdit,
  startInlineEdit,
  toggleTaskCompletionWithSums,
  updateInlineHours,
  startEditFull,
  moveTaskToWeek,
  employees,
  allocations,
  outgoingTransfers,
  weeklyFeedback,
  setTransferTask,
  setTransferDialogOpen,
  isWeeklyEnabled,
  isMobile,
  isTimeTrackerEnabled,
  onTimeLogged,
  timeEntrySumsByAllocationId,
  noteCounts,
  employeeId,
  onOpenWeeklyForTask,
  hoursTrackingPreference,
}: AllocationMonthWeekColumnProps) {
  const { t } = useAppTranslation();

  if (isLoading) {
    return (
      <div
        key={weekStr}
        data-week-index={weekIndex}
        className={cn(
          'flex flex-col gap-2 p-3 rounded-xl border bg-white min-h-[280px] animate-pulse',
          isMonthView && 'h-full min-h-0',
          isMonthScrollLayout
            ? MONTH_SCROLL_WEEK_COL_CLASS
            : 'min-w-0 w-full'
        )}
      >
        <div className="h-16 bg-slate-100 rounded-lg" />
        <div className="flex-1 bg-slate-50 rounded-lg min-h-[180px]" />
      </div>
    );
  }

  return (
    <div
      key={weekStr}
      data-week-index={weekIndex}
      className={cn(
        'flex flex-col gap-2 p-2.5 sm:p-3 rounded-xl border min-h-[280px]',
        isMonthView && 'h-full min-h-0',
        weekCardSurfaceClass(cardStatus),
        isMonthScrollLayout &&
          cn(MONTH_SCROLL_WEEK_COL_CLASS, 'shadow-sm'),
        isMonthGridLayout &&
          'min-w-0 w-full shadow-sm hover:shadow-md transition-shadow'
      )}
    >
      <AllocationMonthWeekCardHeader
        weekIndex={weekIndex}
        weekDateLabel={weekDateLabel}
        summary={weekSummary}
        loadPercentage={load.percentage}
        breakdown={load.breakdown}
        compactMetrics={false}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full shrink-0 gap-1.5 border-dashed border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 hover:border-indigo-300"
        onClick={() => onStartAdd(week.weekStart)}
      >
        <Plus className="h-3.5 w-3.5" />
        {t('planner.allocationSheet.addTask', 'Añadir tarea')}
      </Button>

      <ScrollWheelArea className={cn('flex-1 overflow-y-auto space-y-1.5 custom-scrollbar min-h-0', isMobile ? 'pr-2' : 'pr-0.5')}>
        {sortedGroups.length === 0 ? (
          <p className="text-center py-4 text-xs text-slate-400">{t('planner.allocationSheet.noTasks', 'Sin tareas')}</p>
        ) : sortedGroups.map(([projId, projAllocations]) => {
          const project = getProjectById(projId);
          const allCompleted = projAllocations.every(a => a.status === 'completed') && !projAllocations.some(a => recentlyToggled.has(a.id));
          const isCollapsed = autoExpand ? collapsedProjects.has(projId) : !collapsedProjects.has(projId);
          const sortedTasks = sortTasks(projAllocations);

          const completedCount = projAllocations.filter(a => a.status === 'completed').length;
          const totalCount = projAllocations.length;
          const myHoursInProject = {
            estimated: round2(projAllocations.reduce((sum, a) => sum + (a.hoursAssigned || 0), 0)),
            completed: completedCount,
            computed: round2(projAllocations.filter(a => a.status === 'completed').reduce((sum, a) => sum + getEffectiveCompletedHours(a, hoursTrackingPreference), 0))
          };

          const isSelected = selectedProjectId === projId;

          return (
            <Collapsible key={projId} open={!isCollapsed} onOpenChange={() => toggleProjectCollapse(projId)}>
              <div className={cn(
                "bg-white border rounded-lg overflow-hidden transition-all duration-200",
                allCompleted && "opacity-75 hover:opacity-100",
                isSelected && "ring-2 ring-indigo-400 border-indigo-300",
                !isCollapsed && "shadow-sm"
              )}>
                <div className="relative group flex items-stretch">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        'flex-1 min-w-0 text-left cursor-pointer',
                        allCompleted ? 'bg-emerald-50/60' : 'hover:bg-slate-50'
                      )}
                    >
                      <AllocationMonthProjectCardHeader
                        projectId={projId}
                        projectName={formatProjectName(project?.name || 'Proyecto')}
                        allCompleted={allCompleted}
                        completedCount={completedCount}
                        totalCount={totalCount}
                        estimatedHours={myHoursInProject.estimated}
                        isCollapsed={isCollapsed}
                      />
                    </button>
                  </CollapsibleTrigger>
                  {isMonthView && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className={cn(
                            'h-auto self-stretch rounded-none border-l px-2.5 shrink-0 hover:bg-indigo-50 hover:text-indigo-700',
                            isSelected && 'bg-indigo-50 text-indigo-700'
                          )}
                          aria-label={t('planner.allocationSheet.teamAndBudgetAria')}
                          onClick={() => setSelectedProjectId(isSelected ? null : projId)}
                        >
                          <Users className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="text-xs">
                        {t('planner.allocationSheet.teamAndBudget')}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <CollapsibleContent>
                  <div className="divide-y divide-slate-100 border-t">
                    {sortedTasks.map(alloc => (
                      <AllocationTaskRow
                        key={alloc.id}
                        alloc={alloc}
                        weekIndex={weekIndex}
                        isInlineEditing={inlineEditingId === alloc.id}
                        inlineNameValue={inlineNameValue}
                        onInlineNameChange={setInlineNameValue}
                        onSaveInline={() => saveInlineEdit(alloc)}
                        onStartInlineEdit={() => startInlineEdit(alloc)}
                        onToggleCompletion={() => toggleTaskCompletionWithSums(alloc)}
                        onUpdateInlineHours={(field, value) => updateInlineHours(alloc, field, value)}
                        onStartEditFull={() => startEditFull(alloc)}
                        onMoveTask={(targetWeekStart) => moveTaskToWeek(alloc, targetWeekStart)}
                        nextWeekStart={weeks[(weekIndex + 1) % weeks.length].weekStart}
                        employees={employees}
                        allocations={allocations}
                        outgoingTransfers={outgoingTransfers}
                        weeklyFeedback={weeklyFeedback}
                        showAllWeeks={isMonthView}
                        setTransferTask={setTransferTask}
                        setTransferDialogOpen={setTransferDialogOpen}
                        isWeeklyEnabled={isWeeklyEnabled}
                        isMobile={isMobile}
                        showTaskTimer={isTimeTrackerEnabled}
                        onTimeLogged={onTimeLogged}
                        timeEntriesSum={timeEntrySumsByAllocationId[alloc.id]}
                        noteCount={noteCounts[alloc.id] ?? 0}
                        ownerEmployeeId={employeeId}
                        onOpenWeeklyForTask={
                          isWeeklyEnabled ? onOpenWeeklyForTask : undefined
                        }
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </ScrollWheelArea>
    </div>
  );
}
