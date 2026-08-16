import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { WeeklyReportDialog } from '@/components/employee/WeeklyReportDialog';
import { MyDayView } from '@/components/employee/MyDayView';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAppAllocationActions, useAppAllocations, useAppEmployees, useAppProjects, useAppWeeklyFeedback } from '@/contexts/AppContext';
import { useAgency } from '@/contexts/AgencyContext';
import { Allocation, Project } from '@/types';
import { CalendarDays, ChevronLeft, ChevronRight, MoreHorizontal, ArrowRightCircle, Search, TrendingUp, TrendingDown, CheckCircle2, Users, ChevronDown, Palmtree, Zap, Clock, LayoutGrid, Calendar, FoldVertical, UnfoldVertical, ArrowUpDown, SortAsc, SortDesc, Filter, SlidersHorizontal, ArrowRightLeft, Lock, Check, Plus, Link as LinkIcon, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getWeeksForMonth, getStorageKey, isAllocationInEffectiveMonth, getWeekEndDate } from '@/utils/dateUtils';
import { useWeeklyCloseDay } from '@/hooks/useWeeklyCloseDay';
import { format, addMonths, subMonths, isSameMonth, parseISO, addDays, isBefore, startOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { useDateLocale } from '@/hooks/useDateLocale';
import { toast } from '@/lib/notify';
import { PlannerTour } from './PlannerTour';
import { ProjectImpactSummary } from './ProjectImpactSummary';
import { useAllocationSheet, ProjectBudgetStatus } from '@/hooks/useAllocationSheet';
import { useAllocationActions } from '@/hooks/useAllocationActions';
import { useAllocationNoteCountsForEmployeeMonth } from '@/hooks/useAllocationNotes';
import { TaskNotesTrigger } from '@/components/planner/allocation/TaskNotesTrigger';
import { AllocationProjectHeader } from '@/components/planner/allocation/AllocationProjectHeader';
import { AllocationTaskRow } from '@/components/planner/allocation/AllocationTaskRow';
import { PlannerTaskContextMenu } from '@/components/planner/allocation/PlannerTaskContextMenu';
import { AllocationSheetHeader } from '@/components/planner/allocation/AllocationSheetHeader';
import {
  persistPlannerSheetViewMode,
  readPlannerSheetViewMode,
  type PlannerSheetViewMode,
} from '@/components/planner/allocation/plannerSheetViewMode';
import type { WeekStripItemSummary } from '@/components/planner/allocation/allocationWeekMetricsUtils';
import { resolveDisplayStatus, weekCardSurfaceClass } from '@/components/planner/allocation/allocationWeekMetricsUtils';
import { AllocationMonthWeekCardHeader } from '@/components/planner/allocation/AllocationMonthWeekCardHeader';
import { AllocationMonthProjectCardHeader } from '@/components/planner/allocation/AllocationMonthProjectCardHeader';
import { MonthWeekScrollControls } from '@/components/planner/allocation/MonthWeekScrollControls';
import { ScrollWheelArea } from '@/components/ui/scroll-wheel-area';
import { scrollChildIntoHorizontalView, useHorizontalPanScroll } from '@/hooks/useHorizontalPanScroll';
import { TaskTimer } from '@/components/employee/TaskTimer';
import { BatchTaskRow } from '@/components/planner/BatchTaskRow';
import { AllocationFormDialog } from '@/components/planner/allocation/AllocationFormDialog';
import { useTasksImpact } from '@/hooks/useTasksImpact';
import { useIsMobile, useIsWideLayout } from '@/hooks/use-mobile';
import { usePermissions } from '@/hooks/usePermissions';
import { NewTaskRow } from '@/types';
import { supabase } from '@/lib/supabase';
import { TransferRequestDialog } from '@/components/transfers/TaskTransferComponents';
import { useTaskTransfers } from '@/hooks/useTaskTransfers';
import { useProjectAliasing } from '@/hooks/useProjectAliasing';
import { useWeeklyModuleEnabled } from '@/hooks/useIntegration';
import { getEffectiveCompletedHours, getPlanningDeltaHours } from '@/utils/hoursTracking';
import { formatDecimalHoursAsHm } from '@/utils/timerDisplay';
import { SensitiveText } from '@/components/privacy/SensitiveText';
import { useAllocationSheetMonthData } from '@/hooks/useAllocationSheetMonthData';
import { round2 } from '@/utils/numbers';
import { AllocationTransferBadge } from '@/components/planner/allocation/AllocationTransferBadge';
import { AllocationProjectDetailPanel } from '@/components/planner/allocation/AllocationProjectDetailPanel';
import {
  cleanTransferredTaskName,
  filterAllocationsForPlannerDisplay,
  getAllocationTransferUiState,
} from '@/utils/allocationTransferUtils';

interface AllocationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  weekStart: string;
  viewDateContext?: Date;
  initialAutoAdd?: boolean;
}

type SortOption = 'budget_desc' | 'budget_asc' | 'my_hours_desc' | 'my_hours_asc' | 'name_asc' | 'name_desc';

/** Ancho fijo por columna en vista mes con scroll horizontal (evita que semanas vacías queden más estrechas). */
const MONTH_SCROLL_WEEK_COL_CLASS =
  'flex-none w-[280px] sm:w-[300px] snap-center';

export function AllocationSheet({ open, onOpenChange, employeeId, weekStart, viewDateContext }: AllocationSheetProps) {
  const { t } = useAppTranslation();
  const dateLocale = useDateLocale();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { employees, currentUser } = useAppEmployees();
  const { projects, clients, getProjectById } = useAppProjects();
  const { allocations, getEmployeeAllocationsForWeek, getEmployeeLoadForWeek, loadDataForMonth } = useAppAllocations();
  const { addAllocation, updateAllocation, deleteAllocation, isLoading: isGlobalLoading } = useAppAllocationActions();
  const { weeklyFeedback } = useAppWeeklyFeedback();

  const { currentAgency } = useAgency();
  const { outgoingTransfers } = useTaskTransfers();

  const applyPlannerAllocationFilter = useCallback(
    (allocs: Allocation[]) =>
      filterAllocationsForPlannerDisplay(allocs, employeeId, outgoingTransfers),
    [employeeId, outgoingTransfers]
  );

  const { hasPermission } = usePermissions();
  const canAssignToOthers = hasPermission('can_assign_tasks_to_others');
  const weeklyCloseDay = useWeeklyCloseDay();
  const { formatName: formatProjectName } = useProjectAliasing();
  const isWeeklyEnabled = useWeeklyModuleEnabled();
  const isTimeTrackerEnabled = (currentAgency?.settings?.modules?.timeTracker ?? false) && currentUser?.id === employeeId && currentUser?.user_id != null;
  const preference = currentAgency?.settings?.hoursTrackingPreference;

  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [weeklyFocusAllocationId, setWeeklyFocusAllocationId] = useState<string | null>(null);

  // Inicializar con la semana actual si no se especifica otra
  const getInitialViewDate = () => {
    if (viewDateContext) return viewDateContext;
    const today = new Date();
    const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
    // Si weekStart es válido y está en el mes actual, usarlo; sino usar semana actual
    if (weekStart) {
      try {
        const weekStartDate = parseISO(weekStart);
        if (isSameMonth(weekStartDate, today)) {
          return weekStartDate;
        }
      } catch {
        // Si hay error parseando, usar semana actual
      }
    }
    // Siempre usar el mes actual para asegurar que currentWeekIndex funcione correctamente
    return currentWeekStart;
  };

  const [viewDate, setViewDate] = useState(() => getInitialViewDate());
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const [isTourActive, setIsTourActive] = useState(false);
  const autoAddTriggeredRef = useRef(false);

  const [timeEntrySumsByAllocationId, setTimeEntrySumsByAllocationId] = useState<Record<string, number>>({});

  const refreshTimeEntrySums = useCallback(async () => {
    if (!isTimeTrackerEnabled || !employeeId) {
      setTimeEntrySumsByAllocationId({});
      return;
    }
    const { data, error } = await supabase
      .from('time_entries')
      .select('allocation_id, hours')
      .eq('employee_id', employeeId);
    if (error) return;
    const next: Record<string, number> = {};
    for (const row of data ?? []) {
      const aid = row.allocation_id as string | null;
      if (!aid) continue;
      next[aid] = round2((next[aid] ?? 0) + Number(row?.hours ?? 0));
    }
    setTimeEntrySumsByAllocationId(next);
  }, [isTimeTrackerEnabled, employeeId]);

  const handleTimeLogged = useCallback(
    (_allocationId: string, _hoursLogged: number) => {
      void loadDataForMonth(viewDate);
      void refreshTimeEntrySums();
    },
    [loadDataForMonth, viewDate, refreshTimeEntrySums]
  );

  useEffect(() => {
    if (open) void refreshTimeEntrySums();
  }, [open, refreshTimeEntrySums]);

  useEffect(() => {
    if (open) {
      // Prioridad: weekStart proporcionado > viewDateContext > semana actual
      let targetDate: Date;
      const targetWeekIndex: number | null = null;

      // Si se proporciona weekStart, usarlo para encontrar la semana específica
      if (weekStart) {
        try {
          const weekStartDate = parseISO(weekStart);

          // CORRECCIÓN: Si tenemos un contexto de fecha (ej. venimos del dashboard de Enero)
          // y la semana pertenece a ese mes (aunque empiece en el anterior), respetar el contexto.
          if (viewDateContext && isAllocationInEffectiveMonth(weekStartDate, viewDateContext)) {
            targetDate = viewDateContext;
          } else {
            // Si no hay contexto o la semana no pertenece, usar el mes de inicio de la semana
            targetDate = new Date(weekStartDate.getFullYear(), weekStartDate.getMonth(), 1);
          }

          // Calcular el índice de la semana dentro del mes
          // Esto se hará después de que weeks esté disponible, pero preparamos la fecha
        } catch {
          // Si hay error parseando, usar viewDateContext o mes actual
          targetDate = viewDateContext || new Date();
        }
      } else if (viewDateContext) {
        targetDate = viewDateContext;
      } else {
        const today = new Date();
        const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
        targetDate = new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth(), 1);
      }

      setViewDate(targetDate);

      // Si tenemos weekStart, encontrar su índice después de que weeks esté disponible
      if (weekStart) {
        try {
          const weekStartDate = parseISO(weekStart);
          // Usaremos un efecto separado para encontrar el índice una vez que weeks esté disponible
          setSelectedWeekIndex(null); // Temporal, se actualizará después
        } catch {
          setSelectedWeekIndex(null);
        }
      } else {
        setSelectedWeekIndex(null);
      }
    }
  }, [open, weekStart, viewDateContext]);

  const [searchTerm, setSearchTerm] = useState('');
  const inlineInputRef = useRef<HTMLInputElement>(null);

  const [openComboboxId, setOpenComboboxId] = useState<string | null>(null);
  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [viewMode, setViewMode] = useState<PlannerSheetViewMode>(() => readPlannerSheetViewMode());

  const handleViewModeChange = useCallback((mode: PlannerSheetViewMode) => {
    setViewMode(mode);
    persistPlannerSheetViewMode(mode);
  }, []);

  const isOwnEmployee = currentUser?.id === employeeId;

  // Estado para el dialog de transferencia
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferTask, setTransferTask] = useState<Allocation | null>(null);

  const isMobile = useIsMobile();
  const isWideLayout = useIsWideLayout();
  const isMonthView = viewMode === 'month';
  const isMonthGridLayout = isMonthView && isWideLayout && !isMobile;
  const isMonthScrollLayout = isMonthView && !isMonthGridLayout;
  const showProjectInline = !isMobile && isWideLayout && viewMode === 'week';
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number | null>(null);

  // Preferencia de visualización: auto-expandir o colapsar proyectos
  const [autoExpand, setAutoExpand] = useState<boolean>(() => {
    const saved = localStorage.getItem('planner_autoExpand');
    return saved !== null ? JSON.parse(saved) : true; // Por defecto expandido
  });

  // Opción de ordenación
  const [sortOption, setSortOption] = useState<SortOption>(() => {
    const saved = localStorage.getItem('planner_sortOption');
    return (saved as SortOption) || 'budget_desc';
  });

  const sortOptionLabels: Record<SortOption, string> = {
    budget_desc: t('planner.allocationSheet.sort.budgetDesc', 'Horas contratadas (Mayor)'),
    budget_asc: t('planner.allocationSheet.sort.budgetAsc', 'Horas contratadas (Menor)'),
    my_hours_desc: t('planner.allocationSheet.sort.myHoursDesc', 'Mis horas (Mayor)'),
    my_hours_asc: t('planner.allocationSheet.sort.myHoursAsc', 'Mis horas (Menor)'),
    name_asc: t('planner.allocationSheet.sort.nameAsc', 'Nombre (A-Z)'),
    name_desc: t('planner.allocationSheet.sort.nameDesc', 'Nombre (Z-A)'),
  };
  const sortButtonLabel = isMonthView
    ? t('planner.allocationSheet.sort.optionsButton', 'Opciones')
    : t('planner.allocationSheet.sort.sortButton', 'Ordenar');
  const sortOptionLabel = sortOptionLabels[sortOption];

  // Proyecto seleccionado para mostrar detalles en panel lateral
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Filtro: solo proyectos donde tengo tareas esta semana
  const [showOnlyMyProjects, setShowOnlyMyProjects] = useState(true);

  const { isLoadingTasks, deadlines } = useAllocationSheetMonthData({
    open,
    isFormOpen: open,
    viewDate,
    currentAgencyId: currentAgency?.id,
    allocations,
    isGlobalLoading,
    loadDataForMonth,
  });

  const monthScrollReady = open && isMonthScrollLayout && !isLoadingTasks;
  useHorizontalPanScroll(scrollContainerRef, { enabled: monthScrollReady });

  // Usar hook personalizado para lógica de negocio
  const {
    employee,
    weeks,
    currentWeekIndex: hookCurrentWeekIndex,
    activeProjects,
    monthlyProjectSummary,
    getProjectBudgetStatus,
  } = useAllocationSheet(employeeId, viewDate, deadlines);

  const {
    newTasks, inlineEditingId, inlineNameValue, setInlineNameValue,
    editingAllocation, isFormOpen, setIsFormOpen, isSaving, showDeleteConfirm, setShowDeleteConfirm,
    editProjectId, setEditProjectId, editTaskName, setEditTaskName, editHours, setEditHours,
    editWeek, setEditWeek, editDependencyId, setEditDependencyId,
    editEmployeeId, setEditEmployeeId,
    addTaskRow, removeTaskRow, updateTaskRow, handleSave, startEditFull, handleDeleteClick,
    confirmDelete, toggleTaskCompletion, startInlineEdit, saveInlineEdit, updateInlineHours, moveTaskToWeek,
    closeForm, recentlyToggled, cancelInlineEdit, clearNewTasks,
    canSubmitBatchAdd, batchAddHint, batchPreviewContext
  } = useAllocationActions(employeeId, weeks, canAssignToOthers, isWeeklyEnabled, {
    batchPreview: {
      allocations,
      viewDate,
      weeks,
      getProjectBudgetStatus,
      getEmployeeLoadForWeek,
    },
  });

  const toggleTaskCompletionWithSums = useCallback(
    async (allocation: Parameters<typeof toggleTaskCompletion>[0]) => {
      await toggleTaskCompletion(allocation);
      void refreshTimeEntrySums();
    },
    [toggleTaskCompletion, refreshTimeEntrySums]
  );

  const { data: noteCounts = {} } = useAllocationNoteCountsForEmployeeMonth(employeeId, viewDate, open);

  const { getWeekExceedStatus } = useTasksImpact({
    newTasks,
    projects,
    weeks,
    employeeId,
    getEmployeeLoadForWeek,
    getProjectBudgetStatus,
    viewMonth: viewDate,
    batchPreview: batchPreviewContext,
  });

  // Encontrar el índice de la semana clicada cuando weeks esté disponible
  useEffect(() => {
    if (open && weekStart && weeks.length > 0 && selectedWeekIndex === null) {
      try {
        const weekStartDate = parseISO(weekStart);
        const weekIndex = weeks.findIndex(w => {
          const wStart = new Date(w.weekStart);
          return wStart.getTime() === weekStartDate.getTime();
        });
        if (weekIndex >= 0) {
          setSelectedWeekIndex(weekIndex);
        }
      } catch {
        // Si hay error, usar semana actual
        setSelectedWeekIndex(null);
      }
    }
  }, [open, weekStart, weeks, selectedWeekIndex]);

  // FIX: Ajustar índice de semana si el mes cambia y tiene menos semanas (ej. de Enero sem 5 a Febrero sem 4)
  useEffect(() => {
    if (weeks.length > 0 && selectedWeekIndex !== null && selectedWeekIndex >= weeks.length) {
      setSelectedWeekIndex(weeks.length - 1);
    }
  }, [weeks.length, selectedWeekIndex]);

  // Índice de semana activo (seleccionado por usuario o actual)
  // Usar useMemo para asegurar que el cálculo se haga después de que todo esté inicializado
  const activeWeekIndex = useMemo(() => {
    if (selectedWeekIndex !== null) return selectedWeekIndex;
    // hookCurrentWeekIndex siempre debería estar disponible, pero usamos 0 como fallback
    return hookCurrentWeekIndex ?? 0;
  }, [selectedWeekIndex, hookCurrentWeekIndex]);

  // Semanas a mostrar según el modo
  const visibleWeeks = useMemo(() => {
    if (viewMode === 'month') return weeks;
    if (weeks.length === 0 || activeWeekIndex < 0 || activeWeekIndex >= weeks.length) return [];
    return [weeks[activeWeekIndex]];
  }, [weeks, viewMode, activeWeekIndex]);

  const weekStripSummaries = useMemo((): WeekStripItemSummary[] => {
    if (weeks.length === 0) return [];
    return weeks.map((week) => {
      const weekStartDate = format(week.weekStart, 'yyyy-MM-dd');
      const load = getEmployeeLoadForWeek(
        employeeId,
        weekStartDate,
        week.effectiveStart,
        week.effectiveEnd,
        viewDate
      );

      const weekAllocations = applyPlannerAllocationFilter(
        getEmployeeAllocationsForWeek(employeeId, weekStartDate).filter((a) =>
          isAllocationInEffectiveMonth(a.weekStartDate, viewDate)
        )
      );
      const weekReal = round2(weekAllocations.reduce((sum, a) => sum + (a.hoursActual || 0), 0));
      const weekComp = round2(weekAllocations.reduce((sum, a) => sum + (a.hoursComputed || 0), 0));
      const planHours = round2(weekAllocations.reduce((sum, a) => sum + (a.hoursAssigned || 0), 0));
      const showComp = preference !== 'actual';

      return {
        planHours,
        loadHours: round2(load.hours),
        capacity: load.capacity,
        status: load.status,
        weekReal,
        weekComp,
        showComp,
      };
    });
  }, [
    weeks,
    employeeId,
    getEmployeeLoadForWeek,
    getEmployeeAllocationsForWeek,
    applyPlannerAllocationFilter,
    viewDate,
    preference,
  ]);

  const handleWeekNavSelect = useCallback((index: number) => {
    if (viewMode === 'month') {
      scrollChildIntoHorizontalView(scrollContainerRef.current, `[data-week-index="${index}"]`);
      return;
    }
    setSelectedWeekIndex(index);
  }, [viewMode]);

  const monthViewActiveWeekIndex = viewMode === 'month' ? -1 : activeWeekIndex;

  const weekStripVariant = viewMode === 'day'
    ? 'hidden'
    : isMonthView
    ? isMonthScrollLayout
      ? 'compact'
      : 'hidden'
    : isWideLayout
      ? 'full'
      : 'compact';

  const monthName = format(viewDate, 'MMMM', { locale: dateLocale });
  const monthLabel = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} - ${format(viewDate, 'yyyy')}`;

  const getAvailableDependencies = (projectId: string, currentTaskId?: string) => {
    if (!projectId) return [];
    return allocations.filter(a =>
      a.projectId === projectId &&
      a.id !== currentTaskId &&
      a.status !== 'completed' &&
      isAllocationInEffectiveMonth(a.weekStartDate, viewDate) // Filter by current month
    );
  };

  useEffect(() => {
    if (inlineEditingId && inlineInputRef.current) inlineInputRef.current.focus();
  }, [inlineEditingId]);

  // Persistir preferencias en localStorage
  useEffect(() => {
    localStorage.setItem('planner_autoExpand', JSON.stringify(autoExpand));
    // Limpiar toggles manuales cuando cambia la preferencia
    setCollapsedProjects(new Set());
  }, [autoExpand]);

  useEffect(() => {
    localStorage.setItem('planner_sortOption', sortOption);
  }, [sortOption]);

  const startAdd = (weekStartReal: Date) => {
    // Usar la fecha PROPORCIONADA por weeks (puede ser Jueves 1 Enero)
    const weekStartDate = format(weekStartReal, 'yyyy-MM-dd');
    closeForm();
    clearNewTasks();
    setTimeout(() => {
      addTaskRow(weekStartDate);
      setIsFormOpen(true);
    }, 0);
  };


  if (!employee) return null;

  // Mover el renderizado de loading dentro del return principal en lugar de retorno temprano
  // if (isLoadingTasks) { ... } <- ELIMINADO


  const handlePrevMonth = () => setViewDate(prev => subMonths(prev, 1));
  const handleNextMonth = () => setViewDate(prev => addMonths(prev, 1));

  const toggleProjectCollapse = (projectId: string) => {
    setCollapsedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };





  // Ordenar proyectos según la opción seleccionada
  const sortProjectGroups = (groups: Record<string, Allocation[]>) => {
    return Object.entries(groups).sort(([projIdA, allocsA], [projIdB, allocsB]) => {
      const projA = getProjectById(projIdA);
      const projB = getProjectById(projIdB);

      const allCompletedA = allocsA.every(a => a.status === 'completed') && !allocsA.some(a => recentlyToggled.has(a.id));
      const allCompletedB = allocsB.every(a => a.status === 'completed') && !allocsB.some(a => recentlyToggled.has(a.id));

      // Proyectos completados siempre al final
      if (allCompletedA && !allCompletedB) return 1;
      if (!allCompletedA && allCompletedB) return -1;

      // Calcular horas del empleado actual en cada proyecto
      const myHoursA = allocsA.reduce((sum, a) => sum + (a.hoursAssigned || 0), 0);
      const myHoursB = allocsB.reduce((sum, a) => sum + (a.hoursAssigned || 0), 0);

      // Ordenar según opción seleccionada
      switch (sortOption) {
        case 'budget_desc':
          return (projB?.budgetHours || 0) - (projA?.budgetHours || 0);
        case 'budget_asc':
          return (projA?.budgetHours || 0) - (projB?.budgetHours || 0);
        case 'my_hours_desc':
          return myHoursB - myHoursA;
        case 'my_hours_asc':
          return myHoursA - myHoursB;
        case 'name_asc':
          return (projA?.name || '').localeCompare(projB?.name || '');
        case 'name_desc':
          return (projB?.name || '').localeCompare(projA?.name || '');
        default:
          return (projB?.budgetHours || 0) - (projA?.budgetHours || 0);
      }
    });
  };

  // Ordenar tareas: pendientes primero, completadas (no recientes) al final
  const sortTasks = (tasks: Allocation[]) => {
    return [...tasks].sort((a, b) => {
      const aCompleted = a.status === 'completed' && !recentlyToggled.has(a.id);
      const bCompleted = b.status === 'completed' && !recentlyToggled.has(b.id);

      if (aCompleted && !bCompleted) return 1;
      if (!aCompleted && bCompleted) return -1;
      return 0;
    });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          className={cn(
            'w-full sm:max-w-[95vw] overflow-x-hidden px-3 sm:px-6 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-xl border-l shadow-2xl pt-10',
            viewMode === 'month' || viewMode === 'day' ? 'flex h-full flex-col overflow-hidden' : 'overflow-y-auto'
          )}
          onInteractOutside={(e) => {
            // Prevenir cierre del Sheet cuando el tour está activo
            if (isTourActive) {
              e.preventDefault();
            }
          }}
          onPointerDownOutside={(e) => {
            // Prevenir cierre del Sheet cuando el tour está activo
            if (isTourActive) {
              e.preventDefault();
            }
          }}
        >
          <TooltipProvider delayDuration={200}>
            <AllocationSheetHeader
              employee={employee}
              monthLabel={monthLabel}
              isMobile={isMobile}
              viewMode={viewMode}
              isOwnEmployee={isOwnEmployee}
              onViewModeChange={handleViewModeChange}
              weeks={weeks}
              weekSummaries={weekStripSummaries}
              activeWeekIndex={monthViewActiveWeekIndex}
              currentWeekIndex={hookCurrentWeekIndex ?? null}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
              onSelectWeek={handleWeekNavSelect}
              onAddTask={
                viewMode === 'week' && weeks[activeWeekIndex]
                  ? () => startAdd(weeks[activeWeekIndex].weekStart)
                  : undefined
              }
              searchTerm={searchTerm}
              onSearchTermChange={setSearchTerm}
              isWeeklyEnabled={isWeeklyEnabled}
              onOpenWeekly={
                isWeeklyEnabled
                  ? () => {
                      setWeeklyFocusAllocationId(null);
                      setWeeklyOpen(true);
                    }
                  : undefined
              }
              sortButtonLabel={sortButtonLabel}
              sortOptionLabel={sortOptionLabel}
              autoExpand={autoExpand}
              onToggleAutoExpand={() => setAutoExpand(!autoExpand)}
              sortOption={sortOption}
              onSetSortOption={setSortOption}
              weekStripVariant={weekStripVariant}
            />
          </TooltipProvider>

          {viewMode === 'day' ? (
            <div className="flex-1 min-h-0 overflow-y-auto pb-4">
              <MyDayView
                employeeId={employeeId}
                viewDate={viewDate}
                weeklyEnabled={isWeeklyEnabled}
                onOpenPlanning={() => handleViewModeChange('week')}
                onOpenWeeklyForAllocation={(allocationId) => {
                  setWeeklyFocusAllocationId(allocationId);
                  setWeeklyOpen(true);
                }}
              />
            </div>
          ) : isLoadingTasks ? (
            <div className={cn('flex items-center justify-center', isMonthView ? 'flex-1 min-h-0' : 'min-h-[400px]')}>
              <div className="text-slate-400 flex flex-col items-center gap-2">
                <div className="h-8 w-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                <span>{t('planner.allocationSheet.loading', 'Cargando tareas...')}</span>
              </div>
            </div>
          ) : (
            <TooltipProvider delayDuration={300}>
              {/* Contenedor relativo para posicionar flechas de navegación */}
              <div
                className={cn(
                  'relative group flex gap-4 min-w-0',
                  isMonthView && 'flex-1 min-h-0',
                  isMonthGridLayout && (isMonthView ? 'items-stretch' : 'items-start')
                )}
              >
                {isMonthScrollLayout && (
                  <MonthWeekScrollControls containerRef={scrollContainerRef} active={monthScrollReady} />
                )}
                <div
                  ref={scrollContainerRef}
                  className={cn(
                    'flex-1 min-w-0',
                    isMonthView ? 'pb-3 min-h-0' : 'pb-8',
                    isMonthGridLayout
                      ? cn('grid gap-3 w-full', isMonthView ? 'h-full min-h-0 items-stretch' : 'items-start')
                      : isMonthScrollLayout
                        ? 'flex h-full min-h-0 overflow-x-auto gap-3 snap-x snap-mandatory px-1 no-scrollbar overscroll-x-contain items-stretch'
                        : 'flex min-w-0 overflow-x-hidden justify-center'
                  )}
                  style={
                    isMonthGridLayout && weeks.length > 0
                      ? { gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }
                      : undefined
                  }
                >
                  {visibleWeeks.map((week, idx) => {
                      const index = isMonthView ? idx : activeWeekIndex;
                      // Usar el weekStartDate real para buscar allocations (las allocations se guardan con el lunes completo)
                      const weekStartDate = format(week.weekStart, 'yyyy-MM-dd');
                      const weekStr = weekStartDate; // Alias para usar como key en JSX

                      // Buscar allocations por el weekStartDate real, pero filtrar por mes efectivo
                      let weekAllocations = applyPlannerAllocationFilter(
                        getEmployeeAllocationsForWeek(employeeId, weekStartDate)
                      );

                      // Filtrar por mes efectivo: solo mostrar allocations que tienen días en el mes visible
                      weekAllocations = weekAllocations.filter(a => isAllocationInEffectiveMonth(a.weekStartDate, viewDate));

                      // Eliminar duplicados por ID (por si acaso hay duplicados en la base de datos)
                      const seenIds = new Set<string>();
                      weekAllocations = weekAllocations.filter(a => {
                        if (seenIds.has(a.id)) {
                          return false;
                        }
                        seenIds.add(a.id);
                        return true;
                      });

                      if (searchTerm) {
                        weekAllocations = weekAllocations.filter(a => {
                          const proj = getProjectById(a.projectId);
                          const matchText = (a.taskName + (proj?.name || '')).toLowerCase();
                          return matchText.includes(searchTerm.toLowerCase());
                        });
                      }

                      const load = getEmployeeLoadForWeek(employeeId, weekStartDate, week.effectiveStart, week.effectiveEnd, viewDate);

                      // Calcular Est, Real, Comp para el header (Real/Comp incluyen también horas del cronómetro en tareas pendientes)
                      const weekEst = round2(weekAllocations.reduce((sum, a) => sum + (a.hoursAssigned || 0), 0));
                      const completedTasks = weekAllocations.filter(a => a.status === 'completed');
                      const weekReal = round2(weekAllocations.reduce((sum, a) => sum + (a.hoursActual || 0), 0));
                      const weekComp = round2(weekAllocations.reduce((sum, a) => sum + (a.status === 'completed' ? getEffectiveCompletedHours(a, preference) : 0), 0));
                      /** Suma de deltas por tarea completada (comp−real o est−real según agencia); no mezcla pendientes con cronómetro. */
                      const weekPlanDelta = round2(
                        completedTasks.reduce((sum, a) => sum + (getPlanningDeltaHours(a, preference) ?? 0), 0)
                      );

                      // Fechas de la semana (solo días laborables efectivos del mes: lun-vie, excluyendo fines de semana)
                      const effectiveStart = week.effectiveStart || week.weekStart;
                      const effectiveEnd = week.effectiveEnd || addDays(week.weekStart, 4);

                      // Calcular solo días laborables (lun-vie) en el rango efectivo
                      const workingDays = [];
                      let currentDay = new Date(effectiveStart);
                      while (currentDay <= effectiveEnd) {
                        const dayOfWeek = currentDay.getDay();
                        // 1 = lunes, 5 = viernes (0 = domingo, 6 = sábado)
                        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                          workingDays.push(new Date(currentDay));
                        }
                        currentDay = addDays(currentDay, 1);
                      }

                      // Formatear solo el primer y último día laborable
                      const firstWorkingDay = workingDays[0];
                      const lastWorkingDay = workingDays[workingDays.length - 1];
                      const weekDateLabel = firstWorkingDay && lastWorkingDay
                        ? `${format(firstWorkingDay, 'd', { locale: dateLocale })}-${format(lastWorkingDay, 'd MMM', { locale: dateLocale })}`
                        : `${format(effectiveStart, 'd', { locale: dateLocale })}-${format(effectiveEnd, 'd MMM', { locale: dateLocale })}`;

                      // Agrupar y ordenar
                      const grouped = weekAllocations.reduce((acc, a) => ({ ...acc, [a.projectId]: [...(acc[a.projectId] || []), a] }), {} as Record<string, Allocation[]>);
                      const sortedGroups = sortProjectGroups(grouped);

                      // VISTA TABULAR para semana individual
                      if (!isMonthView) {
                        const nextWeekNavStart =
                          activeWeekIndex < weeks.length - 1
                            ? weeks[activeWeekIndex + 1].weekStart
                            : undefined;
                        return (
                          <div key={weekStr} className="flex-1 min-w-0 overflow-x-hidden w-full max-w-full">
                            {/* Tabla de proyectos y tareas */}
                            <div className="space-y-4 max-h-[70vh] overflow-y-auto overflow-x-hidden min-w-0 pr-2" data-tour="planner-projects">
                              {sortedGroups.map(([projId, projAllocations]) => {
                                const project = getProjectById(projId);
                                const budgetStatus = getProjectBudgetStatus(projId);
                                const allCompleted = projAllocations.every(a => a.status === 'completed') && !projAllocations.some(a => recentlyToggled.has(a.id));
                                const isSelected = selectedProjectId === projId;
                                const sortedTasks = sortTasks(projAllocations);

                                // Totales del proyecto esta semana (Real/Comp incluyen cronómetro en pendientes)
                                const projEst = round2(projAllocations.reduce((s, a) => s + (a.hoursAssigned || 0), 0));
                                const projReal = round2(projAllocations.reduce((s, a) => s + (a.hoursActual || 0), 0));
                                const projComp = round2(projAllocations.reduce((s, a) => s + (a.status === 'completed' ? getEffectiveCompletedHours(a, preference) : 0), 0));
                                const hasAllocations = projAllocations.length > 0;

                                return (
                                  <div
                                    key={projId}
                                    className={cn(
                                      "bg-white rounded-lg border shadow-sm overflow-hidden transition-all min-w-0",
                                      isSelected && "ring-2 ring-indigo-400",
                                      allCompleted && "opacity-80"
                                    )}
                                  >
                                    {/* Header del proyecto - clickeable para seleccionar */}
                                    <div
                                      className={cn(
                                        "px-3 sm:px-4 py-2.5 cursor-pointer flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-4 min-w-0",
                                        budgetStatus.status === 'overload' ? "bg-red-500 text-white" :
                                          budgetStatus.status === 'warning' ? "bg-amber-500 text-white" :
                                            allCompleted ? "bg-slate-200 text-slate-700" : "bg-primary/100 text-white"
                                      )}
                                      onClick={() => setSelectedProjectId(isSelected ? null : projId)}
                                    >
                                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                        {allCompleted && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                                        <span className="font-bold truncate">
                                          <SensitiveText kind="project" id={projId}>
                                            {formatProjectName(project?.name || 'Proyecto')}
                                          </SensitiveText>
                                        </span>
                                        <span className="text-[10px] opacity-80 shrink-0">({projAllocations.length})</span>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs sm:text-sm shrink-0 min-w-0">
                                        <span className="opacity-80">{projEst}h {t('planner.allocationSheet.estShort')}</span>
                                        {projReal > 0 && <span>{projReal}h real</span>}
                                        {preference !== 'actual' && projComp > 0 && <span className="font-bold">{projComp}h comp</span>}
                                      </div>
                                    </div>

                                    {/* Tabla de tareas */}
                                    {isMobile ? (
                                      <div className="flex flex-col divide-y divide-slate-100 min-w-0">
                                        {sortedTasks.map((alloc) => {
                                          const isCompleted = alloc.status === 'completed';
                                          const taskDelta = getPlanningDeltaHours(alloc, preference);
                                          const transferUiMobile = getAllocationTransferUiState(
                                            alloc,
                                            employeeId,
                                            outgoingTransfers,
                                            weeklyFeedback,
                                            employees,
                                            t
                                          );
                                          const transferReadOnlyMobile = transferUiMobile.isReadOnly;
                                          const cleanName = cleanTransferredTaskName(alloc.taskName, t('transfers.unnamedTask'));
                                          const transferMenuLabelMobile = transferUiMobile.pendingTransfer
                                            ? t('planner.allocationSheet.transfer.pendingMenu', 'Transfer pending')
                                            : t('planner.allocationSheet.transfer.transferredMenu', 'Task transferred');

                                          return (
                                            <div key={alloc.id} className={cn("group flex flex-col gap-2 p-3 bg-white touch-manipulation", isCompleted && "bg-slate-50/50")}>
                                              <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                                  <Checkbox
                                                    checked={isCompleted}
                                                    onCheckedChange={() => toggleTaskCompletionWithSums(alloc)}
                                                    disabled={transferReadOnlyMobile}
                                                    className={cn("mt-1 shrink-0", isCompleted && "data-[state=checked]:bg-emerald-600", transferReadOnlyMobile && "opacity-50")}
                                                  />
                                                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                                    <span
                                                      className={cn("font-medium text-sm leading-tight break-words cursor-pointer", isCompleted && "line-through text-slate-400", transferReadOnlyMobile && "cursor-not-allowed opacity-70")}
                                                      onClick={() => {
                                                        if (transferReadOnlyMobile) return;
                                                        startEditFull(alloc);
                                                      }}
                                                    >
                                                      <SensitiveText kind="task" id={alloc.id}>
                                                        {formatProjectName(cleanName)}
                                                      </SensitiveText>
                                                    </span>
                                                    {transferUiMobile.showTransferBadge && (
                                                      <AllocationTransferBadge
                                                        label={transferUiMobile.pendingTransfer
                                                            ? t('planner.allocationSheet.transfer.pending', 'Pending')
                                                            : t('planner.allocationSheet.transfer.transferred', 'Transferred')}
                                                        tooltip={transferUiMobile.transferBadgeTooltip}
                                                        compact
                                                      />
                                                    )}
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
                                                      <span className="shrink-0 font-mono text-base">{alloc.hoursAssigned}h</span>
                                                      <span className="shrink-0 text-slate-400">{t('planner.allocationSheet.estShort')}</span>
                                                      {isTimeTrackerEnabled && !isCompleted && (
                                                        <TaskTimer
                                                          employeeId={alloc.employeeId}
                                                          allocationId={alloc.id}
                                                          disabled={transferReadOnlyMobile}
                                                          onTimeLogged={handleTimeLogged}
                                                        />
                                                      )}
                                                      {isCompleted && (
                                                        <>
                                                          <span className="shrink-0">·</span>
                                                          <span className="shrink-0 font-mono text-base">{alloc.hoursActual ?? 0}h real</span>
                                                          {taskDelta !== null && taskDelta !== 0 && (
                                                            <span className={cn("font-mono text-base font-bold shrink-0", taskDelta < 0 ? "text-red-600" : "text-emerald-600")}>
                                                              {taskDelta > 0 ? '+' : ''}{taskDelta}h
                                                            </span>
                                                          )}
                                                          {taskDelta === 0 && (
                                                            <span className="shrink-0 text-slate-400 text-xs font-medium">Exacto</span>
                                                          )}
                                                        </>
                                                      )}
                                                    </div>
                                                  </div>
                                                </div>
                                                <div className="flex items-center gap-0.5 shrink-0">
                                                  <TaskNotesTrigger
                                                    allocationId={alloc.id}
                                                    noteCount={noteCounts[alloc.id] ?? 0}
                                                    badge
                                                    className={cn(
                                                      (noteCounts[alloc.id] ?? 0) === 0 &&
                                                        'opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity',
                                                      (noteCounts[alloc.id] ?? 0) > 0 && 'opacity-100'
                                                    )}
                                                  />
                                                <PlannerTaskContextMenu
                                                  alloc={alloc}
                                                  transferReadOnly={transferReadOnlyMobile}
                                                  transferReadOnlyLabel={transferMenuLabelMobile}
                                                  isWeeklyEnabled={isWeeklyEnabled}
                                                  weeklyCloseDay={weeklyCloseDay}
                                                  nextWeekStart={nextWeekNavStart}
                                                  onStartEditFull={() => {
                                                    if (transferReadOnlyMobile) return;
                                                    startEditFull(alloc);
                                                  }}
                                                  onTransfer={() => {
                                                    setTransferTask(alloc);
                                                    setTransferDialogOpen(true);
                                                  }}
                                                  onMoveTask={(target) => moveTaskToWeek(alloc, target)}
                                                  onOpenWeeklyForTask={
                                                    isWeeklyEnabled
                                                      ? (a) => {
                                                          setWeeklyFocusAllocationId(a.id);
                                                          setWeeklyOpen(true);
                                                        }
                                                      : undefined
                                                  }
                                                  menuTriggerMode="always"
                                                  triggerClassName="h-11 w-11 min-h-[44px] min-w-[44px]"
                                                  iconClassName="h-4 w-4"
                                                />
                                              </div>
                                            </div>
                                            </div>
                                          );
                                        })}
                                        {sortedTasks.length === 0 && (
                                          <div className="p-4 text-center text-sm text-slate-500 italic">No hay tareas</div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="min-w-0 overflow-x-auto overflow-y-visible">
                                        <table className="w-full text-sm min-w-[320px]">
                                          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                                            <tr>
                                              <th className="py-2 px-3 text-left font-medium w-8"></th>
                                              <th className="py-2 px-3 text-left font-medium">Tarea</th>
                                              <th className="py-2 px-3 text-center font-medium w-20">Horas</th>
                                              {isTimeTrackerEnabled && <th className="py-2 px-2 text-center font-medium w-28">{t('planner.allocationSheet.stopwatch')}</th>}
                                              <th className="py-2 px-3 text-center font-medium w-24">Real</th>
                                              {preference !== 'actual' && <th className="py-2 px-3 text-center font-medium w-24">Comp</th>}
                                              <th className="py-2 px-3 text-center font-medium w-20">Balance</th>
                                              <th className="py-2 px-3 text-center font-medium w-12"></th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100">
                                            {sortedTasks.map((alloc, taskIndex) => {
                                              const isCompleted = alloc.status === 'completed';
                                              const sumTe = timeEntrySumsByAllocationId[alloc.id];
                                              const trackedFromTimer =
                                                isTimeTrackerEnabled && sumTe !== undefined ? round2(sumTe) : null;
                                              const taskDelta = getPlanningDeltaHours(alloc, preference);
                                              const depTask = alloc.dependencyId ? (allocations || []).find(a => a.id === alloc.dependencyId) : null;
                                              const depOwner = depTask ? (employees || []).find(e => e.id === depTask.employeeId) : null;
                                              const isDepReady = depTask?.status === 'completed';
                                              const blockingTasks = (allocations || []).filter(a => a.dependencyId === alloc.id && a.status !== 'completed');
                                              const isFirstTask = taskIndex === 0;

                                              const transferUi = getAllocationTransferUiState(
                                                alloc,
                                                employeeId,
                                                outgoingTransfers,
                                                weeklyFeedback,
                                                employees,
                                                t
                                              );
                                              const transferReadOnly = transferUi.isReadOnly;
                                              const transferMenuLabel = transferUi.pendingTransfer
                                                ? t('planner.allocationSheet.transfer.pendingMenu', 'Transfer pending')
                                                : t('planner.allocationSheet.transfer.transferredMenu', 'Task transferred');

                                              return (
                                                <tr
                                                  key={alloc.id}
                                                  className={cn(
                                                    "group hover:bg-slate-50 transition-colors",
                                                    isCompleted && "bg-slate-50/50",
                                                    !isCompleted && depTask && !isDepReady && "bg-amber-50/50"
                                                  )}
                                                  {...(isFirstTask && { 'data-tour': 'planner-task' })}
                                                >
                                                  <td className="py-2 px-3" {...(isFirstTask && { 'data-tour': 'planner-checkbox' })}>
                                                    <Checkbox
                                                      checked={isCompleted}
                                                      onCheckedChange={() => toggleTaskCompletionWithSums(alloc)}
                                                      disabled={transferReadOnly}
                                                      className={cn(
                                                        isCompleted && "data-[state=checked]:bg-emerald-600",
                                                        transferReadOnly && "opacity-50 cursor-not-allowed"
                                                      )}
                                                    />
                                                  </td>
                                                  <td className="py-2 px-3">
                                                    <div className="space-y-1">
                                                      <div className="flex items-center gap-1.5 min-w-0">
                                                        <div
                                                          className={cn(
                                                            "font-medium rounded px-1 -mx-1 min-w-0 flex-1",
                                                            isCompleted && "line-through text-slate-400",
                                                            transferReadOnly ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:bg-slate-100"
                                                          )}
                                                          onDoubleClick={() => !transferReadOnly && startInlineEdit(alloc)}
                                                          {...(isFirstTask && { 'data-tour': 'planner-task-name' })}
                                                        >
                                                          {inlineEditingId === alloc.id ? (
                                                            <input
                                                              ref={inlineInputRef}
                                                              autoFocus
                                                              value={inlineNameValue}
                                                              onChange={(e) => setInlineNameValue(e.target.value)}
                                                              onBlur={() => saveInlineEdit(alloc)}
                                                              onKeyDown={(e) => {
                                                                if (e.key === 'Enter') saveInlineEdit(alloc);
                                                                if (e.key === 'Escape') cancelInlineEdit();
                                                              }}
                                                              className="w-full px-1 py-0.5 text-sm border rounded bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                            />
                                                          ) : (
                                                            // Limpiar nombre de tarea removiendo información de transferencia
                                                            <div className="flex items-center gap-2 min-w-0">
                                                              <span className="truncate">
                                                                {cleanTransferredTaskName(alloc.taskName, t('transfers.unnamedTask'))}
                                                              </span>
                                                            </div>
                                                          )}
                                                        </div>
                                                        {transferUi.showTransferBadge && (
                                                          <AllocationTransferBadge
                                                            label={transferUi.pendingTransfer
                                                                ? t('planner.allocationSheet.transfer.pending', 'Pending')
                                                                : t('planner.allocationSheet.transfer.transferred', 'Transferred')}
                                                            tooltip={transferUi.transferBadgeTooltip}
                                                            compact
                                                          />
                                                        )}
                                                        {transferUi.showWeeklyBadge && (
                                                          <Badge variant="outline" className="h-4 px-1.5 text-[9px] bg-primary/10 text-indigo-700 border-indigo-200 shrink-0">
                                                            {t('planner.allocationSheet.weeklyBadge')}
                                                          </Badge>
                                                        )}
                                                        <TaskNotesTrigger
                                                          allocationId={alloc.id}
                                                          noteCount={noteCounts[alloc.id] ?? 0}
                                                          badge
                                                        />
                                                      </div>
                                                      {depTask && !isCompleted && (
                                                        <div
                                                          className={cn(
                                                            "flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded w-fit border",
                                                            isDepReady
                                                              ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                                              : "text-amber-700 bg-amber-50 border-amber-200"
                                                          )}
                                                          {...(isFirstTask && { 'data-tour': 'planner-dependency' })}
                                                        >
                                                          {isDepReady ? <CheckCircle2 className="w-2.5 h-2.5" /> : <LinkIcon className="w-2.5 h-2.5" />}
                                                          <span className="truncate max-w-[120px]">{isDepReady ? 'Listo:' : 'Dep:'} {depTask.taskName} <strong>({depOwner?.name})</strong></span>
                                                        </div>
                                                      )}
                                                      {blockingTasks.length > 0 && !isCompleted && (
                                                        <div className="flex flex-col gap-0.5">
                                                          {blockingTasks.map(bt => {
                                                            const blockedUser = (employees || []).find(e => e.id === bt.employeeId);
                                                            const firstName = blockedUser?.name?.split(' ')[0] || t('planner.allocationSheet.teammateFallback');
                                                            return (
                                                              <div key={bt.id} className="flex items-center gap-1 text-[9px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded w-fit border border-amber-200">
                                                                <Users className="w-2.5 h-2.5" />
                                                                <span>💡 <strong>{firstName}</strong> te espera</span>
                                                              </div>
                                                            );
                                                          })}
                                                        </div>
                                                      )}
                                                    </div>
                                                  </td>
                                                  <td className="py-2 px-3 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                      <span className="font-mono text-xs">{alloc.hoursAssigned || 0}</span>
                                                      {/* Badge Weekly si horas=0 por ajuste de weekly */}
                                                      {transferUi.showWeeklyBadge && (
                                                        <Badge variant="outline" className="h-3.5 px-1 text-[8px] bg-primary/10 text-indigo-700 border-indigo-200">
                                                          {t('planner.allocationSheet.weeklyBadge')}
                                                        </Badge>
                                                      )}
                                                    </div>
                                                  </td>
                                                  {isTimeTrackerEnabled && (
                                                    <td className="py-2 px-2 text-center">
                                                      {!isCompleted && (
                                                        <TaskTimer
                                                          employeeId={alloc.employeeId}
                                                          allocationId={alloc.id}
                                                          onTimeLogged={handleTimeLogged}
                                                        />
                                                      )}
                                                      {isCompleted &&
                                                        (trackedFromTimer !== null && trackedFromTimer > 0 ? (
                                                          <div
                                                            key={`${alloc.id}-timer-readonly-${trackedFromTimer}`}
                                                            className={cn(
                                                              'inline-flex items-center justify-center mx-auto px-2.5 py-0.5 rounded-full border font-mono text-xs font-medium tabular-nums max-w-full',
                                                              'bg-slate-50 border-slate-200 text-slate-600'
                                                            )}
                                                            title={t('planner.allocationSheet.stopwatchTooltip')}
                                                            role="status"
                                                          >
                                                            {formatDecimalHoursAsHm(trackedFromTimer)}
                                                          </div>
                                                        ) : (
                                                          <span className="text-slate-300 text-xs">—</span>
                                                        ))}
                                                    </td>
                                                  )}
                                                  <td className="py-2 px-3 text-center">
                                                    {isCompleted ? (
                                                      <input
                                                        key={`${alloc.id}-hoursActual-${alloc.hoursActual ?? 0}`}
                                                        type="number"
                                                        step="0.25"
                                                        min="0"
                                                        disabled={transferReadOnly}
                                                        defaultValue={alloc.hoursActual || 0}
                                                        onBlur={(e) => updateInlineHours(alloc, 'hoursActual', e.target.value)}
                                                        className={cn(
                                                          "w-12 px-1 py-0.5 text-[10px] text-center border rounded font-mono",
                                                          transferReadOnly ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-blue-50 text-blue-700"
                                                        )}
                                                      />
                                                    ) : (
                                                      <span className="text-slate-300 text-xs">-</span>
                                                    )}
                                                  </td>
                                                  {preference !== 'actual' && (
                                                    <td className="py-2 px-3 text-center" {...(isFirstTask && { 'data-tour': 'planner-hours' })}>
                                                      {isCompleted ? (
                                                        <input
                                                          type="number"
                                                          step="0.25"
                                                          min="0"
                                                          disabled={transferReadOnly}
                                                          defaultValue={alloc.hoursComputed || 0}
                                                          onBlur={(e) => updateInlineHours(alloc, 'hoursComputed', e.target.value)}
                                                          className={cn(
                                                            "w-12 px-1 py-0.5 text-[10px] text-center border rounded font-mono",
                                                            transferReadOnly ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-emerald-50 text-emerald-700"
                                                          )}
                                                        />
                                                      ) : (
                                                        <span className="text-slate-300 text-xs">-</span>
                                                      )}
                                                    </td>
                                                  )}
                                                  <td className="py-2 px-3 text-center">
                                                    {isCompleted && taskDelta !== null && taskDelta !== 0 ? (
                                                      taskDelta > 0 ? (
                                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-100 shadow-sm">
                                                          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                                                          <span className="text-xs font-semibold text-emerald-700">+{taskDelta}h</span>
                                                        </div>
                                                      ) : (
                                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-100 shadow-sm">
                                                          <TrendingDown className="h-3.5 w-3.5 text-amber-600" />
                                                          <span className="text-xs font-semibold text-amber-700">{taskDelta}h</span>
                                                        </div>
                                                      )
                                                    ) : isCompleted ? (
                                                      <span className="text-slate-300 text-xs font-medium">Exacto</span>
                                                    ) : (
                                                      <span className="text-slate-200 text-xs">-</span>
                                                    )}
                                                  </td>
                                                  <td className="py-2 px-3 text-center">
                                                    <div className="flex justify-center">
                                                      <PlannerTaskContextMenu
                                                        alloc={alloc}
                                                        transferReadOnly={transferReadOnly}
                                                        transferReadOnlyLabel={transferMenuLabel}
                                                        isWeeklyEnabled={isWeeklyEnabled}
                                                        weeklyCloseDay={weeklyCloseDay}
                                                        nextWeekStart={nextWeekNavStart}
                                                        onStartEditFull={() => {
                                                          if (transferReadOnly) return;
                                                          startEditFull(alloc);
                                                        }}
                                                        onTransfer={() => {
                                                          setTransferTask(alloc);
                                                          setTransferDialogOpen(true);
                                                        }}
                                                        onMoveTask={(target) => moveTaskToWeek(alloc, target)}
                                                        onOpenWeeklyForTask={
                                                          isWeeklyEnabled
                                                            ? (a) => {
                                                                setWeeklyFocusAllocationId(a.id);
                                                                setWeeklyOpen(true);
                                                              }
                                                            : undefined
                                                        }
                                                        triggerClassName="h-7 w-7"
                                                      />
                                                    </div>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}

                              {/* Estado de carga */}
                              {(isGlobalLoading || isLoadingTasks) && (
                                <div className="space-y-4" data-tour="planner-loading-state">
                                  <div className="text-center py-6 text-slate-400">
                                    <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50 animate-pulse" />
                                    <p className="font-medium mb-1">{t('planner.allocationSheet.loading', 'Cargando tareas...')}</p>
                                    <p className="text-xs">{t('planner.allocationSheet.loadingPleaseWait', 'Por favor espera')}</p>
                                  </div>
                                </div>
                              )}

                              {/* Estado vacío - solo mostrar si no está cargando */}
                              {!isGlobalLoading && !isLoadingTasks && sortedGroups.length === 0 && (
                                <div className="space-y-4" data-tour="planner-empty-state">
                                  {/* Mensaje principal */}
                                  <div className="text-center py-6 text-slate-400">
                                    <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
                                    <p className="font-medium mb-1">{t('planner.allocationSheet.emptyWeekTitle', 'No tienes tareas esta semana')}</p>
                                    <p className="text-xs">{t('planner.allocationSheet.emptyWeekHint', 'Usa el botón "Añadir" para planificar tu trabajo')}</p>
                                  </div>

                                  {/* Ejemplo visual de cómo se vería */}
                                  <div className="border-t pt-4">
                                    <div className="flex items-center justify-between mb-3">
                                      <span className="text-xs text-slate-400 uppercase tracking-wide">Vista previa de ejemplo</span>
                                      <Badge variant="outline" className="text-[9px] bg-amber-50 border-amber-200 text-amber-700">Ejemplo</Badge>
                                    </div>

                                    <div className="bg-white rounded-lg border shadow-sm overflow-hidden opacity-60" data-tour="planner-projects">
                                      <div className="bg-primary/100 text-white px-4 py-2.5 flex items-center justify-between">
                                        <span className="font-bold text-sm">Retainer mensual [Cliente ejemplo]</span>
                                        <span className="text-xs opacity-80">(3 tareas)</span>
                                      </div>
                                      <table className="w-full text-sm">
                                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                                          <tr>
                                            <th className="py-2 px-3 text-left font-medium w-8"></th>
                                            <th className="py-2 px-3 text-left font-medium">Tarea</th>
                                            <th className="py-2 px-2 text-center font-medium w-12">Horas</th>
                                            {preference !== 'actual' && <th className="py-2 px-2 text-center font-medium w-12">Comp</th>}
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          <tr className="hover:bg-slate-50" data-tour="planner-task">
                                            <td className="py-2 px-3" data-tour="planner-checkbox">
                                              <Checkbox checked={false} />
                                            </td>
                                            <td className="py-2 px-3" data-tour="planner-task-name">
                                              <span className="font-medium">{t('planner.allocationSheet.campaignBrief')}</span>
                                              <div className="mt-1" data-tour="planner-dependency">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px]">
                                                  <Users className="h-3 w-3" />
                                                  💡 María te espera
                                                </span>
                                              </div>
                                            </td>
                                            <td className="py-2 px-3 text-center font-mono">4h</td>
                                            <td className="py-2 px-3 text-center text-slate-300">-</td>
                                          </tr>
                                          <tr className="hover:bg-slate-50">
                                            <td className="py-2 px-3">
                                              <Checkbox checked={false} />
                                            </td>
                                            <td className="py-2 px-3">
                                              <span className="font-medium">Creatividades y adaptaciones</span>
                                              <div className="mt-1">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]">
                                                  <Clock className="h-3 w-3" />
                                                  Esperas a: Juan
                                                </span>
                                              </div>
                                            </td>
                                            <td className="py-2 px-3 text-center font-mono">2h</td>
                                            <td className="py-2 px-3 text-center text-slate-300">-</td>
                                          </tr>
                                          <tr className="hover:bg-slate-50 bg-emerald-50/50">
                                            <td className="py-2 px-3">
                                              <Checkbox checked={true} className="data-[state=checked]:bg-emerald-600" />
                                            </td>
                                            <td className="py-2 px-3">
                                              <span className="font-medium line-through text-slate-400">Informe mensual</span>
                                            </td>
                                            <td className="py-2 px-3 text-center font-mono line-through text-slate-400">2h</td>
                                            <td className="py-2 px-3 text-center">
                                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-mono" data-tour="planner-hours">2h</span>
                                            </td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }

                      // VISTA COMPACTA para vista mensual (múltiples semanas)
                      // Mostrar loading si está cargando
                      if (isGlobalLoading || isLoadingTasks) {
                        return (
                          <div
                            key={weekStr}
                            data-week-index={index}
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

                      const weekSummary: WeekStripItemSummary = weekStripSummaries[index] ?? {
                        planHours: weekEst,
                        loadHours: round2(load.hours),
                        capacity: load.capacity,
                        status: load.status,
                        weekReal,
                        weekComp,
                        showComp: preference !== 'actual',
                      };
                      const cardStatus = resolveDisplayStatus(weekSummary);

                      return (
                        <div
                          key={weekStr}
                          data-week-index={index}
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
                            weekIndex={index}
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
                            onClick={() => startAdd(week.weekStart)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            {t('planner.allocationSheet.addTask', 'Añadir tarea')}
                          </Button>

                          {/* LISTA TAREAS */}
                          <ScrollWheelArea className={cn('flex-1 overflow-y-auto space-y-1.5 custom-scrollbar min-h-0', isMobile ? 'pr-2' : 'pr-0.5')}>
                            {sortedGroups.length === 0 ? (
                              <p className="text-center py-4 text-xs text-slate-400">{t('planner.allocationSheet.noTasks', 'Sin tareas')}</p>
                            ) : sortedGroups.map(([projId, projAllocations]) => {
                              const project = getProjectById(projId);
                              const allCompleted = projAllocations.every(a => a.status === 'completed') && !projAllocations.some(a => recentlyToggled.has(a.id));
                              const isCollapsed = autoExpand ? collapsedProjects.has(projId) : !collapsedProjects.has(projId);
                              const sortedTasks = sortTasks(projAllocations);

                              // Calcular horas del empleado actual en este proyecto
                              const completedCount = projAllocations.filter(a => a.status === 'completed').length;
                              const totalCount = projAllocations.length;
                              const myHoursInProject = {
                                estimated: round2(projAllocations.reduce((sum, a) => sum + (a.hoursAssigned || 0), 0)),
                                completed: completedCount,
                                computed: round2(projAllocations.filter(a => a.status === 'completed').reduce((sum, a) => sum + getEffectiveCompletedHours(a, preference), 0))
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
                                            weekIndex={index}
                                            isInlineEditing={inlineEditingId === alloc.id}
                                            inlineNameValue={inlineNameValue}
                                            onInlineNameChange={setInlineNameValue}
                                            onSaveInline={() => saveInlineEdit(alloc)}
                                            onStartInlineEdit={() => startInlineEdit(alloc)}
                                            onToggleCompletion={() => toggleTaskCompletionWithSums(alloc)}
                                            onUpdateInlineHours={(field, value) => updateInlineHours(alloc, field, value)}
                                            onStartEditFull={() => startEditFull(alloc)}
                                            onMoveTask={(targetWeekStart) => moveTaskToWeek(alloc, targetWeekStart)}
                                            nextWeekStart={weeks[(index + 1) % weeks.length].weekStart}
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
                                            onTimeLogged={handleTimeLogged}
                                            timeEntriesSum={timeEntrySumsByAllocationId[alloc.id]}
                                            noteCount={noteCounts[alloc.id] ?? 0}
                                            ownerEmployeeId={employeeId}
                                            onOpenWeeklyForTask={
                                              isWeeklyEnabled
                                                ? (a) => {
                                                    setWeeklyFocusAllocationId(a.id);
                                                    setWeeklyOpen(true);
                                                  }
                                                : undefined
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
                    })}
                </div>

                {selectedProjectId && showProjectInline && (
                    <div className="w-80 flex-shrink-0">
                      <div className="sticky top-4 space-y-3">
                        {/* Contenido dinámico: proyecto seleccionado o resumen */}
                        {selectedProjectId ? (
                          <AllocationProjectDetailPanel
                            projectId={selectedProjectId}
                            projectName={formatProjectName(getProjectById(selectedProjectId)?.name || 'Proyecto')}
                            budgetStatus={getProjectBudgetStatus(selectedProjectId)}
                            viewerEmployeeId={employeeId}
                            employees={employees || []}
                            onClose={() => setSelectedProjectId(null)}
                          />
                        ) : (
                          // RESUMEN DE LA SEMANA (por defecto)
                          <div className="bg-white border rounded-xl shadow-sm p-4">
                            <h3 className="font-bold text-sm text-slate-700 mb-3 flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-indigo-500" />
                              Resumen de la semana
                            </h3>
                            <p className="text-xs text-slate-500 mb-4">
                              Selecciona un proyecto para ver sus detalles
                            </p>

                            {/* Proyectos de esta semana */}
                            {(() => {
                              if (weeks.length === 0 || activeWeekIndex < 0 || activeWeekIndex >= weeks.length) {
                                return <p className="text-sm text-slate-500">No hay semanas disponibles</p>;
                              }
                              // Usar el weekStartDate real para buscar allocations
                              const weekStartDate = format(weeks[activeWeekIndex].weekStart, 'yyyy-MM-dd');
                              const weekAllocs = applyPlannerAllocationFilter(
                                getEmployeeAllocationsForWeek(employeeId, weekStartDate)
                              );

                              // Filtrar por mes efectivo: solo mostrar allocations que tienen días en el mes visible
                              const filteredWeekAllocs = weekAllocs.filter(a => isAllocationInEffectiveMonth(a.weekStartDate, viewDate));
                              const projectIds = [...new Set(filteredWeekAllocs.map(a => a.projectId))];

                              return (
                                <div className="space-y-2">
                                  <div className="text-[10px] font-semibold text-slate-500 uppercase">
                                    {t('planner.allocationSheet.myProjectsThisWeek', { count: projectIds.length })}
                                  </div>
                                  <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
                                    {projectIds.map(projId => {
                                      const project = getProjectById(projId);
                                      const projAllocs = filteredWeekAllocs.filter(a => a.projectId === projId);
                                      const est = round2(projAllocs.reduce((s, a) => s + (a.hoursAssigned || 0), 0));
                                      const completed = projAllocs.filter(a => a.status === 'completed').length;
                                      const total = projAllocs.length;
                                      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

                                      return (
                                        <button
                                          key={projId}
                                          onClick={() => setSelectedProjectId(projId)}
                                          className="w-full text-left p-2.5 bg-slate-50 hover:bg-primary/10 rounded-lg border border-slate-100 hover:border-indigo-200 transition-colors"
                                        >
                                          <div className="flex items-center justify-between">
                                            <span className="font-medium text-xs text-slate-700 truncate">
                                              <SensitiveText kind="project" id={projId}>
                                                {formatProjectName(project?.name || '')}
                                              </SensitiveText>
                                            </span>
                                            <span className="text-[10px] text-slate-500 ml-2">{est}h</span>
                                          </div>
                                          <div className="text-[10px] text-slate-400 mt-0.5 mb-1.5">
                                            {completed}/{total} tareas
                                          </div>
                                          {/* Barra de progreso */}
                                          {total > 0 && (
                                            <div className="mt-1.5">
                                              <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                                                <div
                                                  className={cn("h-full transition-all duration-300", progress === 100 ? "bg-emerald-500" : "bg-primary/100")}
                                                  style={{ width: `${progress}%` }}
                                                />
                                              </div>
                                            </div>
                                          )}
                                        </button>
                                      );
                                    })}
                                    {projectIds.length === 0 && (
                                      <p className="text-xs text-slate-400 text-center py-4">
                                        {t('planner.allocationSheet.emptyWeekTitle', 'No tienes tareas esta semana')}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
            </TooltipProvider>
          )}

          {/* Cierre del bloque !isLoadingTasks */}
        </SheetContent>
      </Sheet>

      {/* Panel proyecto: sheet fuera del layout (vista mes y pantallas estrechas) */}
      {selectedProjectId && !showProjectInline && (
        <Sheet open={!!selectedProjectId} onOpenChange={(open) => !open && setSelectedProjectId(null)}>
          <SheetContent
            side={isMobile ? 'bottom' : 'right'}
            className={cn(
              isMobile ? 'h-[85vh] rounded-t-2xl pt-6 pb-8 px-4' : 'w-full sm:max-w-md pt-10'
            )}
          >
            <AllocationProjectDetailPanel
              projectId={selectedProjectId}
              projectName={formatProjectName(getProjectById(selectedProjectId)?.name || 'Proyecto')}
              budgetStatus={getProjectBudgetStatus(selectedProjectId)}
              viewerEmployeeId={employeeId}
              employees={employees || []}
              onClose={() => setSelectedProjectId(null)}
            />
          </SheetContent>
        </Sheet>
      )}

      <AllocationFormDialog
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        editingAllocation={editingAllocation}
        newTasks={newTasks}
        editProjectId={editProjectId}
        editTaskName={editTaskName}
        editHours={editHours}
        editWeek={editWeek}
        editDependencyId={editDependencyId}
        editEmployeeId={editEmployeeId}
        isSaving={isSaving}
        showDeleteConfirm={showDeleteConfirm}
        onClose={closeForm}
        onSave={handleSave}
        onDelete={handleDeleteClick}
        onConfirmDelete={confirmDelete}
        setEditProjectId={setEditProjectId}
        setEditTaskName={setEditTaskName}
        setEditHours={setEditHours}
        setEditWeek={setEditWeek}
        setEditDependencyId={setEditDependencyId}
        setEditEmployeeId={setEditEmployeeId}
        setShowDeleteConfirm={setShowDeleteConfirm}
        addTaskRow={addTaskRow}
        updateTaskRow={updateTaskRow}
        removeTaskRow={removeTaskRow}
        activeProjects={activeProjects}
        clients={clients}
        employees={employees}
        weeks={weeks}
        allocations={allocations}
        deadlines={deadlines}
        currentEmployeeId={employeeId}
        canAssignToOthers={canAssignToOthers}
        viewDate={viewDate}
        getProjectBudgetStatus={getProjectBudgetStatus}
        getAvailableDependencies={getAvailableDependencies}
        getWeekExceedStatus={getWeekExceedStatus}
        getEmployeeLoadForWeek={getEmployeeLoadForWeek}
        formatProjectName={formatProjectName}
        canSubmitBatchAdd={canSubmitBatchAdd}
        batchAddHint={batchAddHint}
        batchPreview={batchPreviewContext}
      />

      {/* Tour interactivo del planificador */}
      {open && <PlannerTour onVisibilityChange={setIsTourActive} />}

      {isWeeklyEnabled && (
        <WeeklyReportDialog
          open={weeklyOpen}
          onOpenChange={(o) => {
            setWeeklyOpen(o);
            if (!o) setWeeklyFocusAllocationId(null);
          }}
          employeeId={employeeId}
          viewDate={viewDate}
          focusAllocationId={weeklyFocusAllocationId}
        />
      )}

      {/* Dialog de Transferencia de Tareas */}
      {transferTask && (
        <TransferRequestDialog
          open={transferDialogOpen}
          onOpenChange={setTransferDialogOpen}
          allocationId={transferTask.id}
          taskName={transferTask.taskName || ''}
          currentHours={transferTask.hoursAssigned}
          allocationWeekStartDate={transferTask.weekStartDate}
        />
      )}
    </>
  );

  // Función auxiliar para renderizar una tarea

}

// Componente ProjectImpactSummary movido a archivo separado: ProjectImpactSummary.tsx
