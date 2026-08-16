import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getWeeklyProcessedAllocationIds } from '@/utils/weeklyCloseShared';
import { useApp } from '@/contexts/AppContext';
import { useAgency } from '@/contexts/AgencyContext';
import { MyWeekView } from '@/components/employee/MyWeekView';
import { MyDayView } from '@/components/employee/MyDayView';
import { useDashboardView } from '@/hooks/useDashboardView';
import { WeeklyReportDialog } from '@/components/employee/WeeklyReportDialog';
import { PriorityInsights, ProjectTeamPulse } from '@/components/employee/DashboardWidgets';
import { ReliabilityIndexCard } from '@/components/employee/ReliabilityIndexCard';
import { PlanningInconsistenciesCard } from '@/components/employee/PlanningInconsistenciesCard';
import { CollaborationCards } from '@/components/employee/CollaborationCards';
import { MonthlyBalanceCard } from '@/components/employee/MonthlyBalanceCard';
import { WelcomeTour, useWelcomeTour } from '@/components/employee/WelcomeTour';
import { EmployeeSettings } from '@/components/employee/EmployeeSettings';
import { LoadIndicator } from '@/components/shared/LoadIndicator';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmployeeRow } from '@/components/planner/EmployeeRow';
import { MobilePlannerView } from '@/components/planner/MobilePlannerView';
import { AllocationSheet } from '@/components/planner/AllocationSheet';
import { ProjectImpactSummary } from '@/components/planner/ProjectImpactSummary';
import { BatchTaskRow } from '@/components/planner/BatchTaskRow';
import { useAllocationSheet, ProjectBudgetStatus } from '@/hooks/useAllocationSheet';
import { useTasksImpact } from '@/hooks/useTasksImpact';
import { useBatchCommitPreview } from '@/hooks/useBatchCommitPreview';
import { createPlannerBatchPreviewContext } from '@/utils/plannerBatchPreview';
import { AbsencesSheet } from '@/components/team/AbsencesSheet';
import { ProfessionalGoalsSheet } from '@/components/team/ProfessionalGoalsSheet';
import { getWeeksForMonth, getMonthName, isAllocationInEffectiveMonth, normalizeWeekStart, getWeekEndDate } from '@/utils/dateUtils';
import { useWeeklyCloseDay } from '@/hooks/useWeeklyCloseDay';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { supabase } from '@/lib/supabase';
import { fetchDeadlinesForMonth } from '@/utils/deadlineUtils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter }
  from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NewTaskRow, Deadline } from '@/types';
import { ChevronLeft, ChevronRight, CalendarDays, TrendingUp, Calendar, Clock, CheckCircle2, Plus, X, Check, ListPlus, AlertTriangle, HelpCircle, RotateCcw, FileDown, CheckSquare, AlertCircle, Trash2, Sun, MoreHorizontal, Users, BarChart3 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { startOfMonth, endOfMonth, format, isSameMonth, parseISO, addDays } from 'date-fns';
import { usePlanMonthNavigation } from '@/hooks/usePlanMonthNavigation';
import { useSubscriptionLimits } from '@/hooks/useSubscriptionLimits';
import { isAtPlanHistoryMinMonth } from '@/utils/planHistoryUtils';
import { useEnsureMonthWithLoading } from '@/hooks/useEnsureMonthWithLoading';
import { useDateLocale } from '@/hooks/useDateLocale';
import { toast } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { useIsMobile } from '@/hooks/use-mobile';
import { useIntegration, useWeeklyModuleEnabled } from '@/hooks/useIntegration';
import { PendingTransfersPanel } from '@/components/transfers/TaskTransferComponents';
import { useProjectAliasing } from '@/hooks/useProjectAliasing';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { Link, Navigate } from 'react-router-dom';
import { buildAgencyAwarePath, useSupportAgencyView } from '@/hooks/useSupportAgencyView';

const INTERNAL_CLIENT_NAME = 'Interno';
const INTERNAL_PROJECT_NAME = 'Gestiones internas';

const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;


export default function EmployeeDashboard() {
  const { t } = useAppTranslation();
  const dateLocale = useDateLocale();
  const { employees, projects, clients, allocations, absences, teamEvents, getEmployeeAllocationsForWeek, getEmployeeLoadForWeek, addAllocation, updateAllocation, deleteAllocation, isLoading: isGlobalLoading, weeklyFeedback, getEmployeeMonthlyLoad, currentUser: appCurrentUser } = useApp();

  const { currentAgency } = useAgency();
  const myEmployeeProfile = appCurrentUser || null;
  const isLoadingProfile = isGlobalLoading;
  const { canAccess } = usePermissions();
  const { isPlatformAdmin, isLoading: isPlatformAdminLoading } = usePlatformAdmin();
  const isManager = canAccess('/planner') || canAccess('/operaciones') || canAccess('/finanzas');

  const navigate = useNavigate();
  const { agencyId } = useSupportAgencyView();
  const { activeView, showToggle, setView, isSaving: isSavingViewPref } = useDashboardView();

  const { currentMonth, goToPrevMonth: handlePrevMonth, goToNextMonth: handleNextMonth, goToToday: handleToday } =
    usePlanMonthNavigation();
  const { historyMinDate } = useSubscriptionLimits();
  const prevMonthDisabled = isAtPlanHistoryMinMonth(currentMonth, historyMinDate);
  const isLoadingMonth = useEnsureMonthWithLoading(currentMonth, {
    enabled: !isGlobalLoading && !isLoadingProfile,
  });
  const [selectedCell, setSelectedCell] = useState<{ employeeId: string; weekStart: Date } | null>(null);

  const [showGoals, setShowGoals] = useState(false);
  const [showAbsences, setShowAbsences] = useState(false);
  const [isAddingExtra, setIsAddingExtra] = useState(false);
  const [isAddingTasks, setIsAddingTasks] = useState(false);
  const [isSavingTasks, setIsSavingTasks] = useState(false);

  const [extraTaskName, setExtraTaskName] = useState('');
  const [extraHours, setExtraHours] = useState('1');
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isSavingExtraTask, setIsSavingExtraTask] = useState(false);

  const [newTasks, setNewTasks] = useState<NewTaskRow[]>([]);
  const [openComboboxId, setOpenComboboxId] = useState<string | null>(null);
  const [showWeeklyDialog, setShowWeeklyDialog] = useState(false);
  const [weeklyFocusAllocationId, setWeeklyFocusAllocationId] = useState<string | null>(null);
  // Default to month tasks — primary employee workflow
  const [activeTab, setActiveTab] = useState('projects');
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [dialogDeadlines, setDialogDeadlines] = useState<Deadline[]>([]);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [pendingCloseState, setPendingCloseState] = useState<boolean | null>(null);
  const [actionsDropdownOpen, setActionsDropdownOpen] = useState(false);

  const { showTour, resetTour } = useWelcomeTour();
  const isMobile = useIsMobile();
  const isWeeklyFeedbackEnabled = useWeeklyModuleEnabled();
  const isCrmExportEnabled = useIntegration('crm_export');
  const { hasPermission } = usePermissions();
  const canAssignToOthers = hasPermission('can_assign_tasks_to_others');

  // Get configurable weekly close day from agency settings
  const weeklyCloseDay = useWeeklyCloseDay();

  const hasPendingWeeklyTasks = useMemo(() => {
    if (!myEmployeeProfile) return false;
    const today = new Date();

    const processedTaskIds = getWeeklyProcessedAllocationIds(weeklyFeedback);

    const distributedFromTransferIds = new Set(
      weeklyFeedback
        .filter(fb => fb.allocationId && fb.comments?.includes('Tarea distribuida desde transferencia'))
        .map(fb => fb.allocationId!)
    );

    // Find open tasks (past week tasks not processed)
    const openTasks = allocations.filter(a => {
      if (a.employeeId !== myEmployeeProfile.id) return false;
      if (a.status === 'completed') return false;
      if (processedTaskIds.has(a.id)) return false;
      if (distributedFromTransferIds.has(a.id)) return false;

      // IMPORTANT: Exclude distribution child tasks - they are the result of transfer acceptance
      // and don't need Weekly review (they're new tasks, not past tasks needing action)
      if (a.transferredFromAllocationId) return false;

      try {
        const taskWeekDate = parseISO(a.weekStartDate);
        const taskWeekEnd = getWeekEndDate(taskWeekDate, weeklyCloseDay);
        return taskWeekEnd <= today && isSameMonth(taskWeekDate, currentMonth);
      } catch {
        return false;
      }
    });

    // Find transferred tasks not yet processed
    // NOTE: Tasks with `transferredFromAllocationId` are the RESULT of a distribution/transfer acceptance
    // and should NOT trigger the weekly badge. They are new tasks, not pending actions.
    // Only legacy transfers with '(transferida de' in the name need processing.
    const transferredTasks = allocations.filter(a => {
      if (a.employeeId !== myEmployeeProfile.id) return false;
      if (a.status === 'completed') return false;
      if (processedTaskIds.has(a.id)) return false;
      if (distributedFromTransferIds.has(a.id)) return false;

      // IMPORTANT: Exclude tasks that are the result of distribution (these are already "processed")
      // They have transferredFromAllocationId set because they came from a distribution
      if (a.transferredFromAllocationId) return false;

      // Only legacy transfers with '(transferida de' in name need Weekly review
      const isLegacyTransfer = a.taskName?.includes('(transferida de');
      if (!isLegacyTransfer) return false;

      try {
        const taskWeekDate = parseISO(a.weekStartDate);
        return isSameMonth(taskWeekDate, currentMonth);
      } catch {
        return false;
      }
    });

    const hasOpenTasks = openTasks.length > 0;
    const hasTransferredTasks = transferredTasks.length > 0;

    return hasOpenTasks || hasTransferredTasks;
  }, [allocations, myEmployeeProfile, currentMonth, weeklyFeedback, weeklyCloseDay]);

  const weeks = useMemo(() => getWeeksForMonth(currentMonth), [currentMonth]);
  const internalClient = useMemo(() => clients.find(c => c.name === INTERNAL_CLIENT_NAME), [clients]);
  const internalProject = useMemo(() => projects.find(p => p.name === INTERNAL_PROJECT_NAME && p.clientId === internalClient?.id), [projects, internalClient]);

  const activeProjects = useMemo(() => {
    return projects
      .filter(p => p.status === 'active')
      .sort((a, b) => {
        const clientA = clients.find(c => c.id === a.clientId)?.name || '';
        const clientB = clients.find(c => c.id === b.clientId)?.name || '';
        return clientA.localeCompare(clientB) || a.name.localeCompare(b.name);
      });
  }, [projects, clients]);

  const { getProjectBudgetStatus } = useAllocationSheet(myEmployeeProfile?.id || '', currentMonth);

  const batchCommitPreview = useBatchCommitPreview(
    myEmployeeProfile
      ? {
          allocations,
          pendingRows: newTasks,
          viewDate: currentMonth,
          defaultEmployeeId: myEmployeeProfile.id,
          weeks,
          getProjectBudgetStatus,
          getEmployeeLoadForWeek,
        }
      : null
  );
  const batchPreviewContext = useMemo(
    () =>
      batchCommitPreview.previewContext ??
      createPlannerBatchPreviewContext({
        allocations,
        pendingRows: newTasks,
        viewDate: currentMonth,
        defaultEmployeeId: myEmployeeProfile?.id ?? '',
      }),
    [
      batchCommitPreview.previewContext,
      allocations,
      newTasks,
      currentMonth,
      myEmployeeProfile?.id,
    ]
  );

  const getOrCreateInternalProject = async (): Promise<string | null> => {
    if (internalProject) return internalProject.id;
    if (!currentAgency?.id) {
      toast.error(t('team.dashboard.toasts.noAgency'));
      return null;
    }
    setIsCreatingProject(true);
    try {
      let clientId = internalClient?.id;
      if (!clientId) {
        const { data: clientData, error: clientError } = await supabase
          .from('clients').insert({ name: INTERNAL_CLIENT_NAME, color: '#6b7280', agency_id: currentAgency.id }).select().single();
        if (clientError) throw clientError;
        clientId = clientData.id;
        toast.success(t('team.dashboard.toasts.internalClientCreated', { name: INTERNAL_CLIENT_NAME }));
      }

      const { data: projectData, error: projectError } = await supabase
        .from('projects').insert({ name: INTERNAL_PROJECT_NAME, client_id: clientId, status: 'active', budget_hours: 9999, minimum_hours: 0, agency_id: currentAgency.id })
        .select().single();

      if (projectError) throw projectError;
      toast.success(t('team.dashboard.toasts.internalProjectCreated', { name: INTERNAL_PROJECT_NAME }));
      return projectData.id;

    } catch (error) {
      console.error('Error creando proyecto interno:', error);
      const errorMessage = (error as Error)?.message || t('team.dashboard.toasts.internalProjectError');
      toast.error(errorMessage);
      return null;
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleAddExtraTask = async () => {
    // Prevenir múltiples ejecuciones simultáneas
    if (isSavingExtraTask || isCreatingProject) return;

    if (!myEmployeeProfile) return;
    if (!extraTaskName.trim()) { toast.error(t('team.dashboard.toasts.taskNameRequired')); return; }
    const hours = Number(extraHours);
    if (isNaN(hours) || hours <= 0) { toast.error(t('team.dashboard.toasts.hoursMustBePositive')); return; }

    setIsSavingExtraTask(true);
    try {
      const projectId = await getOrCreateInternalProject();
      if (!projectId) { toast.error(t('team.dashboard.toasts.internalProjectMissing')); return; }
      const today = new Date();
      const formattedDate = normalizeWeekStart(today, startOfMonth(today));

      await addAllocation({
        projectId, employeeId: myEmployeeProfile.id, weekStartDate: formattedDate,
        hoursAssigned: hours, hoursActual: hours, hoursComputed: hours,
        taskName: extraTaskName, status: 'completed'
      });
      toast.success(t('team.dashboard.toasts.internalTaskRegistered', { name: extraTaskName, hours }));
      setExtraTaskName('');
      setExtraHours('1');
      setIsAddingExtra(false);
    } catch (error) {
      console.error('Error añadiendo tarea interna:', error);
      toast.error((error as Error)?.message || t('team.dashboard.toasts.internalTaskError'));
    } finally {
      setIsSavingExtraTask(false);
    }
  };

  const openAddTasksDialog = useCallback((defaultProjectId?: string) => {
    const defaultWeek = weeks[0]?.weekStart ? format(weeks[0].weekStart, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
    setNewTasks([{
      id: crypto.randomUUID(),
      projectId: defaultProjectId || '',
      taskName: '',
      hours: '',
      weekDate: defaultWeek,
      dependencyId: 'none',
      employeeId: canAssignToOthers ? undefined : myEmployeeProfile?.id // Si no puede asignar a otros, usar su propio ID
    }]);
    setIsAddingTasks(true);
  }, [weeks, canAssignToOthers, myEmployeeProfile?.id]);

  const handleOpenPlanningFromMyDay = useCallback(() => {
    if (currentAgency?.setupCompleted === false) {
      toast.info(
        t(
          'team.dashboard.finishOnboardingFirst',
          'Termina la configuración inicial (Explorar ya o Configurar mi agencia) para acceder al planificador.'
        )
      );
      navigate('/onboarding/choose', { replace: true });
      return;
    }
    if (canAccess('/planner')) {
      navigate(buildAgencyAwarePath('/planner', agencyId));
      return;
    }
    if (canAccess('/deadlines')) {
      navigate(buildAgencyAwarePath('/deadlines', agencyId));
      return;
    }
    if (showToggle && activeView === 'daily') {
      void setView('weekly').then(() => {
        window.setTimeout(() => {
          document.querySelector('[data-tour="calendar"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
      });
      return;
    }
    openAddTasksDialog();
  }, [canAccess, navigate, agencyId, showToggle, activeView, setView, openAddTasksDialog, currentAgency?.setupCompleted, t]);

  const handleAddTasksOpenChange = (open: boolean) => {
    if (!open) {
      const hasUnsaved = newTasks.length > 1 || newTasks.some(t => t.taskName.trim() !== '' || t.hours !== '');
      if (hasUnsaved) {
        setPendingCloseState(open);
        setShowConfirmClose(true);
        return;
      }
    }
    setIsAddingTasks(open);
  };

  const addTaskRow = () => {
    const lastTask = newTasks[newTasks.length - 1];
    const defaultWeek = lastTask?.weekDate || (weeks[0]?.weekStart ? format(weeks[0].weekStart, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
    setNewTasks(prev => [...prev, {
      id: crypto.randomUUID(),
      projectId: lastTask?.projectId || '',
      taskName: '',
      hours: '',
      weekDate: defaultWeek,
      dependencyId: 'none',
      employeeId: canAssignToOthers ? undefined : myEmployeeProfile?.id // Si no puede asignar a otros, usar su propio ID
    }]);
  };

  const removeTaskRow = (id: string) => {
    if (newTasks.length === 1) return;
    setNewTasks(prev => prev.filter(t => t.id !== id));
  };

  const updateTaskRow = (id: string, field: keyof NewTaskRow, value: string) => {
    setNewTasks(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  /** No guardar si falta proyecto en una fila que ya tiene nombre u horas; hace falta ≥1 fila completa. */
  const canSaveBulkTasks = useMemo(() => {
    const rowHasPartialData = (t: NewTaskRow) =>
      t.taskName.trim().length > 0 ||
      (t.hours !== '' && !Number.isNaN(parseFloat(t.hours)) && parseFloat(t.hours) > 0);
    const anyRowWithDataButNoProject = newTasks.some(t => rowHasPartialData(t) && !t.projectId);
    const atLeastOneComplete = newTasks.some(
      t => Boolean(t.projectId) && t.taskName.trim().length > 0 && parseFloat(t.hours) > 0
    );
    return atLeastOneComplete && !anyRowWithDataButNoProject;
  }, [newTasks]);

  const bulkTasksHint = useMemo(() => {
    const rowHasPartialData = (t: NewTaskRow) =>
      t.taskName.trim().length > 0 ||
      (t.hours !== '' && !Number.isNaN(parseFloat(t.hours)) && parseFloat(t.hours) > 0);
    if (newTasks.some(t => rowHasPartialData(t) && !t.projectId)) {
      return 'Selecciona un proyecto en cada fila que tenga nombre u horas.';
    }
    if (!newTasks.some(t => Boolean(t.projectId) && t.taskName.trim() && parseFloat(t.hours) > 0)) {
      return 'Completa al menos una fila: proyecto, nombre de tarea y horas.';
    }
    return null;
  }, [newTasks]);

  const handleSaveTasks = async () => {
    // Prevenir múltiples ejecuciones simultáneas
    if (isSavingTasks) return;

    if (!myEmployeeProfile) return;
    if (!canSaveBulkTasks) {
      toast.error(bulkTasksHint || 'Revisa proyecto, nombre y horas en cada fila.');
      return;
    }
    const validTasks = newTasks.filter(t => t.projectId && t.taskName.trim() && parseFloat(t.hours) > 0);
    if (validTasks.length === 0) { toast.error(t('team.dashboard.addValidTaskError')); return; }

    batchCommitPreview.captureSnapshot(validTasks);
    setIsSavingTasks(true);
    try {
      for (const task of validTasks) {
        // Usar el employeeId de la tarea si existe, sino usar el del empleado actual
        const targetEmployeeId = task.employeeId || myEmployeeProfile.id;
        await addAllocation({
          projectId: task.projectId,
          employeeId: targetEmployeeId,
          weekStartDate: task.weekDate,
          hoursAssigned: parseFloat(task.hours),
          taskName: task.taskName,
          status: 'planned'
        });
      }
      toast.success(t('team.dashboard.toasts.tasksAdded', { count: validTasks.length }));
      setIsAddingTasks(false);
      setNewTasks([]);
    } catch (error) {
      console.error('Error guardando tareas:', error);
      toast.error(t('team.dashboard.toasts.saveTasksError'));
    } finally {
      batchCommitPreview.clearSnapshot();
      setIsSavingTasks(false);
    }
  };

  const handleExportCRM = () => {
    if (!myEmployeeProfile?.crmUserId) { toast.error(t('team.dashboard.toasts.crmIdRequired')); return; }
    const monthAllocations = allocations.filter(a =>
      a.employeeId === myEmployeeProfile.id &&
      isAllocationInEffectiveMonth(a.weekStartDate, currentMonth) &&
      a.status !== 'completed'
    );
    if (monthAllocations.length === 0) { toast.warning(t('team.dashboard.toasts.noPendingExport')); return; }

    const csvRows: string[] = [];
    monthAllocations.forEach(alloc => {
      const project = projects.find(p => p.id === alloc.projectId);
      const taskName = (alloc.taskName || 'Tarea').replace(/"/g, '""');
      const hoursStr = alloc.hoursAssigned ? alloc.hoursAssigned.toString() : '';
      const csvLine = [
        `"${taskName}"`,
        myEmployeeProfile.crmUserId,
        'project',
        project?.externalId || '',
        hoursStr
      ].join(',');
      csvRows.push(csvLine);
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tareas_crm_${format(currentMonth, 'yyyy-MM')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(t('team.dashboard.toasts.exportSuccess', { count: monthAllocations.length }));
  };

  const getAvailableDependencies = (projectId: string, currentTaskId?: string) => {
    if (!projectId) return [];
    return allocations.filter(a =>
      a.projectId === projectId &&
      a.id !== currentTaskId &&
      a.status !== 'completed' &&
      isAllocationInEffectiveMonth(a.weekStartDate, currentMonth)
    );
  };

  const { tasksImpact, getWeekExceedStatus, getProjectExceedStatus } = useTasksImpact({
    newTasks,
    projects,
    weeks,
    employeeId: myEmployeeProfile?.id || '',
    getEmployeeLoadForWeek,
    getProjectBudgetStatus,
    viewMonth: currentMonth,
    batchPreview: batchPreviewContext,
  });

  const monthKey = format(currentMonth, 'yyyy-MM');

  const dashboardDetailTabs = useMemo(() => ([
    {
      value: 'coherence',
      icon: CheckCircle2,
      label: t('team.dashboard.tabCoherence', 'Control de planificación'),
      shortLabel: t('team.dashboard.tabCoherenceShort', 'Planificación'),
      activeClass: 'data-[state=active]:bg-red-50 data-[state=active]:text-red-700 data-[state=active]:border-red-200/80',
      iconClass: 'text-red-500',
    },
    {
      value: 'dependencies',
      icon: AlertCircle,
      label: t('team.dashboard.tabDependencies', 'Dependencias'),
      shortLabel: t('team.dashboard.tabDependenciesShort', 'Dependencias'),
      activeClass: 'data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700 data-[state=active]:border-orange-200/80',
      iconClass: 'text-orange-500',
    },
    {
      value: 'projects',
      icon: ListPlus,
      label: t('team.dashboard.tabProjects', 'Mis tareas del mes'),
      shortLabel: t('team.dashboard.tabProjectsShort', 'Tareas'),
      activeClass: 'data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 data-[state=active]:border-indigo-200/80',
      iconClass: 'text-indigo-500',
    },
    {
      value: 'teammates',
      icon: Users,
      label: t('team.dashboard.tabTeammates', 'Compañeros'),
      shortLabel: t('team.dashboard.tabTeammatesShort', 'Compañeros'),
      activeClass: 'data-[state=active]:bg-slate-100 data-[state=active]:text-slate-800 data-[state=active]:border-slate-300/80',
      iconClass: 'text-slate-500',
    },
    {
      value: 'metrics',
      icon: BarChart3,
      label: t('team.dashboard.tabMetrics', 'Métricas'),
      shortLabel: t('team.dashboard.tabMetricsShort', 'Métricas'),
      activeClass: 'data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 data-[state=active]:border-emerald-200/80',
      iconClass: 'text-emerald-500',
    },
  ] satisfies Array<{
    value: string;
    icon: LucideIcon;
    label: string;
    shortLabel: string;
    activeClass: string;
    iconClass: string;
  }>), [t]);

  // Cargar deadlines del mes (filtrados por agencia)
  const loadDeadlinesForMonth = useCallback(async (month: Date) => {
    const monthKey = format(startOfMonth(month), 'yyyy-MM');
    try {
      const { data, error } = await fetchDeadlinesForMonth(monthKey, currentAgency?.id);
      if (error) throw error;
      setDeadlines(data ?? []);
    } catch (error) {
      console.error('Error cargando deadlines:', error);
      setDeadlines([]);
    }
  }, [currentAgency?.id]);

  useEffect(() => {
    loadDeadlinesForMonth(currentMonth);
  }, [currentMonth, loadDeadlinesForMonth]);

  // Cargar deadlines cuando se abre el diálogo de añadir tareas y sincronizar
  useEffect(() => {
    if (isAddingTasks) {
      loadDeadlinesForMonth(currentMonth);
    }
  }, [isAddingTasks, currentMonth, loadDeadlinesForMonth]);

  // Sincronizar deadlines del diálogo cuando se actualizan
  useEffect(() => {
    if (isAddingTasks) {
      setDialogDeadlines(deadlines);
    } else {
      setDialogDeadlines([]);
    }
  }, [isAddingTasks, deadlines]);

  if (isGlobalLoading || isLoadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin opacity-60" />
        </div>
      </div>
    );
  }

  if (isLoadingMonth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-400">{t('employeeDashboard.page.loadingTasks')}</div>
      </div>
    );
  }

  if (!myEmployeeProfile) {
    if (!isPlatformAdminLoading && isPlatformAdmin && currentAgency) {
      return <Navigate to={`/planner?agency=${currentAgency.id}`} replace />;
    }
    if (!isPlatformAdminLoading && isPlatformAdmin) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center space-y-4 max-w-md px-4">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
            <h2 className="text-xl font-semibold text-slate-700">{t('team.dashboard.adminTitle', 'Eres administrador de plataforma')}</h2>
            <p className="text-slate-500">{t('team.dashboard.adminDesc', 'Tu cuenta no está vinculada a ninguna agencia. Puedes acceder al panel de administración para gestionar agencias, soporte y otros administradores.')}</p>
            <Button asChild className="mt-2">
              <Link to="/admin">{t('team.dashboard.adminLink', 'Ir al panel de administración')}</Link>
            </Button>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
          <h2 className="text-xl font-semibold text-slate-700">{t('team.dashboard.noProfileTitle', 'No se encontró tu perfil de empleado')}</h2>
          <p className="text-slate-500">{t('team.dashboard.noProfileDesc', 'Contacta con un administrador para vincular tu cuenta de usuario con un perfil de empleado.')}</p>
        </div>
      </div>
    );
  }

  // Columnas de semana: ancho fijo para que el contenido detallado no se comprima (scroll horizontal si hace falta)
  const calendarColWidth = 200;
  const weekColWidth = 152;
  const totalColWidth = 100;
  const gridMinWidth = calendarColWidth + weeks.length * weekColWidth + totalColWidth;
  const gridTemplate = `${calendarColWidth}px repeat(${weeks.length}, ${weekColWidth}px) ${totalColWidth}px`;
  const monthlyLoad = getEmployeeMonthlyLoad(myEmployeeProfile.id, currentMonth.getFullYear(), currentMonth.getMonth());

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-primary/5 via-white to-primary/5 opacity-50" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_50%,rgba(var(--primary-rgb),0.1),transparent_50%)]" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_80%_80%,rgba(var(--primary-rgb),0.1),transparent_50%)]" />

      {/* 0. PANEL DE TRANSFERENCIAS PENDIENTES */}
      <PendingTransfersPanel />

      {/* 1. CABECERA UNIFICADA */}
      {isMobile ? (
        <div className="space-y-2.5 bg-white/70 backdrop-blur-sm rounded-xl border border-slate-200/80 p-2.5 shadow-sm">
          <div className="flex items-center gap-2">
            {showToggle && myEmployeeProfile ? (
              <div className="flex flex-1 items-center rounded-lg bg-slate-100/80 p-0.5 gap-0.5 min-w-0" data-tour="dashboard-view-toggle">
                <Button
                  type="button"
                  variant={activeView === 'weekly' ? 'default' : 'ghost'}
                  size="sm"
                  className="flex-1 h-10 min-h-[44px] px-2 text-xs font-medium"
                  onClick={() => void setView('weekly')}
                  disabled={isSavingViewPref}
                >
                  {t('team.dashboard.myWeek', 'Mi semana')}
                </Button>
                <Button
                  type="button"
                  variant={activeView === 'daily' ? 'default' : 'ghost'}
                  size="sm"
                  className="flex-1 h-10 min-h-[44px] px-2 gap-1 text-xs font-medium"
                  onClick={() => void setView('daily')}
                  disabled={isSavingViewPref}
                >
                  <Sun className="h-3.5 w-3.5 shrink-0" />
                  {t('team.dashboard.myDay', 'Mi día')}
                </Button>
              </div>
            ) : (
              <div className="flex-1" />
            )}

            <DropdownMenu open={actionsDropdownOpen} onOpenChange={setActionsDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 w-10 min-h-[44px] min-w-[44px] p-0 shrink-0 border-slate-200 bg-white"
                  aria-label={t('common.more', 'Más acciones')}
                  data-tour="actions-dropdown"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {isCrmExportEnabled && (
                  <>
                    <DropdownMenuItem
                      onClick={handleExportCRM}
                      disabled={!myEmployeeProfile?.crmUserId}
                      className="gap-2 text-sm min-h-[44px]"
                      data-tour="crm-export"
                    >
                      <FileDown className="h-4 w-4 text-purple-600" />
                      {t('team.dashboard.exportCrm', 'Exportar a CRM')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  onClick={() => setShowGoals(true)}
                  className="gap-2 text-sm min-h-[44px]"
                  data-tour="goals"
                >
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  {t('team.dashboard.goals', 'Objetivos')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowAbsences(true)}
                  className="gap-2 text-sm min-h-[44px]"
                  data-tour="absences"
                >
                  <Calendar className="h-4 w-4 text-amber-600" />
                  {t('team.dashboard.absences', 'Ausencias')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={resetTour} className="gap-2 text-sm min-h-[44px]">
                  <RotateCcw className="h-4 w-4" />
                  {t('team.dashboard.repeatTour', 'Repetir tour')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <EmployeeSettings employeeId={myEmployeeProfile.id} compact />
          </div>

          <div className="space-y-1.5">
            {isWeeklyFeedbackEnabled && (
              <Button
                onClick={() => setShowWeeklyDialog(true)}
                size="sm"
                className={cn(
                  'w-full h-10 min-h-[44px] gap-1.5 text-xs font-medium shadow-sm',
                  hasPendingWeeklyTasks
                    ? 'bg-amber-600 text-white hover:bg-amber-700 animate-pulse shadow-amber-500/30'
                    : 'bg-primary text-white hover:bg-primary/90'
                )}
                data-tour="weekly-button"
              >
                {hasPendingWeeklyTasks ? <AlertCircle className="h-3.5 w-3.5" /> : <CheckSquare className="h-3.5 w-3.5" />}
                {t('team.dashboard.weekly', 'Weekly')}
              </Button>
            )}

            <div className="grid grid-cols-2 gap-1.5">
              <Button
                size="sm"
                onClick={() => openAddTasksDialog()}
                variant="outline"
                className="h-10 min-h-[44px] gap-1 px-2 text-xs font-medium border-slate-200 bg-white hover:bg-slate-50"
                data-tour="add-tasks"
              >
                <ListPlus className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate">{t('team.dashboard.addTasks', 'Añadir tareas')}</span>
              </Button>

              <Button
                size="sm"
                onClick={() => setIsAddingExtra(true)}
                variant="outline"
                className="h-10 min-h-[44px] gap-1 px-2 text-xs font-medium border-slate-200 bg-white hover:bg-slate-50"
                data-tour="internal-tasks"
              >
                <Clock className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                <span className="truncate">{t('team.dashboard.internalTask', 'Tarea interna')}</span>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 bg-white/70 backdrop-blur-sm rounded-xl border border-slate-200/80 p-2 shadow-sm">
          {showToggle && myEmployeeProfile && (
            <div className="flex items-center rounded-lg bg-slate-100/80 p-0.5 gap-0.5 shrink-0" data-tour="dashboard-view-toggle">
              <Button
                type="button"
                variant={activeView === 'weekly' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 px-3 text-xs font-medium"
                onClick={() => void setView('weekly')}
                disabled={isSavingViewPref}
              >
                {t('team.dashboard.myWeek', 'Mi semana')}
              </Button>
              <Button
                type="button"
                variant={activeView === 'daily' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 px-3 gap-1.5 text-xs font-medium"
                onClick={() => void setView('daily')}
                disabled={isSavingViewPref}
              >
                <Sun className="h-3.5 w-3.5 shrink-0" /> {t('team.dashboard.myDay', 'Mi día')}
              </Button>
            </div>
          )}

          {!showToggle && <div className="shrink-0" />}

          <div className="h-6 w-px bg-slate-200/80 shrink-0" />

          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {isWeeklyFeedbackEnabled && (
              <Button
                onClick={() => setShowWeeklyDialog(true)}
                size="sm"
                className={cn(
                  'gap-1.5 shrink-0 text-xs font-medium shadow-sm transition-all',
                  hasPendingWeeklyTasks
                    ? 'bg-amber-600 text-white hover:bg-amber-700 animate-pulse shadow-amber-500/30'
                    : 'bg-primary text-white hover:bg-primary/90'
                )}
                data-tour="weekly-button"
              >
                {hasPendingWeeklyTasks ? <AlertCircle className="h-3.5 w-3.5" /> : <CheckSquare className="h-3.5 w-3.5" />}
                {t('team.dashboard.weekly', 'Weekly')}
              </Button>
            )}

            <Button size="sm" onClick={() => openAddTasksDialog()} variant="outline" className="gap-1.5 shrink-0 text-xs font-medium border-slate-200 bg-white hover:bg-slate-50" data-tour="add-tasks">
              <ListPlus className="h-3.5 w-3.5 text-primary" /> {t('team.dashboard.addTasks', 'Añadir tareas')}
            </Button>

            <Button size="sm" onClick={() => setIsAddingExtra(true)} variant="outline" className="gap-1.5 shrink-0 text-xs font-medium border-slate-200 bg-white hover:bg-slate-50" data-tour="internal-tasks">
              <Clock className="h-3.5 w-3.5 text-slate-500" /> {t('team.dashboard.internalTask', 'Tarea interna')}
            </Button>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <DropdownMenu open={actionsDropdownOpen} onOpenChange={setActionsDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 gap-1.5 text-xs text-slate-500 hover:text-slate-700"
                  data-tour="actions-dropdown"
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span>{t('common.more', 'Más')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {isCrmExportEnabled && (
                  <>
                    <DropdownMenuItem onClick={handleExportCRM} disabled={!myEmployeeProfile?.crmUserId} className="gap-2 text-sm" data-tour="crm-export">
                      <FileDown className="h-4 w-4 text-purple-600" /> {t('team.dashboard.exportCrm', 'Exportar a CRM')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={() => setShowGoals(true)} className="gap-2 text-sm" data-tour="goals">
                  <TrendingUp className="h-4 w-4 text-emerald-600" /> {t('team.dashboard.goals', 'Objetivos')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowAbsences(true)} className="gap-2 text-sm" data-tour="absences">
                  <Calendar className="h-4 w-4 text-amber-600" /> {t('team.dashboard.absences', 'Ausencias')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={resetTour} className="gap-2 text-sm">
                  <RotateCcw className="h-4 w-4" /> {t('team.dashboard.repeatTour', 'Repetir tour')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <EmployeeSettings employeeId={myEmployeeProfile.id} />
          </div>
        </div>
      )}

      {activeView === 'daily' && myEmployeeProfile && (
        <MyDayView
          employeeId={myEmployeeProfile.id}
          viewDate={currentMonth}
          weeklyEnabled={isWeeklyFeedbackEnabled}
          onOpenPlanning={handleOpenPlanningFromMyDay}
          onOpenWeeklyForAllocation={(allocationId) => {
            setWeeklyFocusAllocationId(allocationId);
            setShowWeeklyDialog(true);
          }}
        />
      )}

      {activeView === 'weekly' && (
        <>
          {/* 2. CONTROL MES */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/60 p-3 rounded-lg border border-slate-200 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold capitalize text-slate-800 flex items-center gap-2">
                {getMonthName(currentMonth, dateLocale)}
                <Badge variant="secondary" className="font-normal text-slate-500 bg-slate-100">{currentMonth.getFullYear()}</Badge>
              </h2>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md">
              <Button variant="ghost" size="icon" disabled={prevMonthDisabled} className={cn("h-7 w-7", isMobile && "h-11 w-11 min-h-[44px]")} onClick={handlePrevMonth}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" onClick={handleToday} className={cn("h-7 text-xs px-2", isMobile && "h-11 min-h-[44px] text-sm px-3")} aria-label={t('team.dashboard.currentMonth', 'Mes actual')}>{t('team.dashboard.currentMonth', 'Mes actual')}</Button>
              <Button variant="ghost" size="icon" className={cn("h-7 w-7", isMobile && "h-11 w-11 min-h-[44px]")} onClick={handleNextMonth}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>

          {/* 3. CALENDARIO - En móvil: tarjetas (MobilePlannerView); en desktop: tabla */}
          {isMobile && myEmployeeProfile ? (
            <div className="space-y-3" data-tour="calendar">
              <MobilePlannerView
                filteredEmployees={[myEmployeeProfile]}
                weeks={weeks}
                allocations={allocations || []}
                viewDate={currentMonth}
                getEmployeeMonthlyLoad={getEmployeeMonthlyLoad}
                onOpenSheet={(empId, date) => setSelectedCell({ employeeId: empId, weekStart: date })}
              />
            </div>
          ) : (
            <Card className="border-indigo-100 shadow-sm overflow-hidden" data-tour="calendar">
              <div className="overflow-x-auto custom-scrollbar w-full">
                <div style={{ minWidth: gridMinWidth }}>
                <div className="grid bg-slate-50/50 border-b" style={{ gridTemplateColumns: gridTemplate }}>
                  <div className="px-4 py-3 font-bold text-sm text-slate-700 flex items-center border-r sticky left-0 z-20 bg-slate-50">{t('team.dashboard.calendar', 'Calendario')}</div>
                  {weeks.map((week, index) => {
                    const effectiveStart = week.effectiveStart || week.weekStart;
                    const effectiveEnd = week.effectiveEnd || addDays(week.weekStart, 6);
                    const workingDays = [];
                    let currentDay = new Date(effectiveStart);
                    while (currentDay <= effectiveEnd) {
                      const dayOfWeek = currentDay.getDay();
                      if (dayOfWeek >= 1 && dayOfWeek <= 5) workingDays.push(new Date(currentDay));
                      currentDay = addDays(currentDay, 1);
                    }
                    const firstWorkingDay = workingDays[0];
                    const lastWorkingDay = workingDays[workingDays.length - 1];
                    const weekDateLabel = firstWorkingDay && lastWorkingDay
                      ? `${format(firstWorkingDay, 'd', { locale: dateLocale })}-${format(lastWorkingDay, 'd MMM', { locale: dateLocale })}`
                      : `${format(effectiveStart, 'd', { locale: dateLocale })}-${format(effectiveEnd, 'd MMM', { locale: dateLocale })}`;

                    return (
                      <div key={week.weekStart.toISOString()} className="text-center px-1 py-2 border-r flex flex-col justify-center">
                        <span className="text-xs font-bold uppercase text-slate-500">S{index + 1}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{weekDateLabel}</span>
                      </div>
                    );
                  })}
                  <div className="px-2 py-3 font-bold text-xs text-center flex items-center justify-center">TOTAL</div>
                </div>

                <div className="grid bg-white" style={{ gridTemplateColumns: gridTemplate }}>
                  <EmployeeRow employee={myEmployeeProfile} weeks={weeks} projects={projects} allocations={allocations} absences={absences} teamEvents={teamEvents} viewDate={currentMonth} onOpenSheet={(empId, date) => setSelectedCell({ employeeId: empId, weekStart: date })} />
                  <div className="flex items-center justify-center border-l p-2 bg-white">
                    <div className="flex flex-col items-center">
                      <span className="text-lg font-bold text-slate-800">{monthlyLoad.hours}h</span>
                      <span className="text-[10px] text-slate-400 font-medium">/ {monthlyLoad.capacity}h</span>
                      <span className={cn(
                        "text-[10px] font-bold mt-1 px-1.5 rounded-full",
                        monthlyLoad.status === 'overload' ? "text-red-600 bg-red-50" :
                          monthlyLoad.status === 'warning' ? "text-amber-600 bg-amber-50" :
                            monthlyLoad.status === 'healthy' ? "text-emerald-600 bg-emerald-50" :
                              "text-slate-400 bg-slate-50"
                      )}>{monthlyLoad.percentage.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      {/* 4. VISTA DETALLADA POR PESTAÑAS */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className={cn('relative min-w-0', isMobile && 'rounded-xl border border-slate-200/90 bg-white shadow-sm')}>
          <TabsList className={cn(
            'w-full justify-start h-auto flex-nowrap min-w-0',
            isMobile
              ? 'gap-1.5 p-1.5 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-smooth bg-transparent border-0 rounded-xl'
              : 'p-1 bg-white border border-slate-200 overflow-x-auto custom-scrollbar gap-2 pr-2'
          )}>
            {dashboardDetailTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className={cn(
                    'shrink-0 transition-all snap-start',
                    isMobile
                      ? cn(
                          'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 min-h-[44px] text-xs font-medium whitespace-nowrap',
                          'data-[state=inactive]:bg-slate-100/80 data-[state=inactive]:text-slate-600',
                          'data-[state=active]:shadow-sm',
                          tab.activeClass
                        )
                      : cn(
                          'px-4 py-2 min-h-[44px] whitespace-nowrap',
                          tab.value === 'coherence' && 'min-w-[9rem]',
                          tab.value === 'metrics' && 'min-w-[7.5rem]',
                          (tab.value === 'dependencies' || tab.value === 'projects' || tab.value === 'teammates') && 'min-w-[7rem]',
                          (tab.value === 'coherence' || tab.value === 'dependencies' || tab.value === 'projects') && tab.activeClass
                        )
                  )}
                >
                  <Icon className={cn('shrink-0', isMobile ? cn('h-4 w-4', tab.iconClass) : 'h-4 w-4 mr-2')} />
                  {isMobile ? tab.shortLabel : tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {isMobile && (
            <div
              className="pointer-events-none absolute inset-y-0 right-0 w-6 rounded-r-xl bg-gradient-to-l from-white via-white/80 to-transparent"
              aria-hidden
            />
          )}
        </div>

        <div className="mt-4">
          <TabsContent value="dependencies" className="space-y-6 focus-visible:outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PriorityInsights employeeId={myEmployeeProfile.id} viewDate={currentMonth} />
              <ProjectTeamPulse employeeId={myEmployeeProfile.id} viewDate={currentMonth} />
            </div>
          </TabsContent>

          <TabsContent value="projects" className="space-y-4 focus-visible:outline-none">
            <MyWeekView employeeId={myEmployeeProfile.id} viewDate={currentMonth} />
          </TabsContent>

          <TabsContent value="coherence" className="focus-visible:outline-none min-w-0">
            <PlanningInconsistenciesCard
              employeeId={myEmployeeProfile.id}
              viewDate={currentMonth}
              isManager={isManager}
              onAddTasksForProject={(projectId) => openAddTasksDialog(projectId)}
            />
          </TabsContent>

          <TabsContent value="teammates" className="focus-visible:outline-none">
            <CollaborationCards employeeId={myEmployeeProfile.id} viewDate={currentMonth} />
          </TabsContent>

          <TabsContent value="metrics" className="space-y-6 focus-visible:outline-none">
            <MonthlyBalanceCard employeeId={myEmployeeProfile.id} viewDate={currentMonth} />
            <ReliabilityIndexCard employeeId={myEmployeeProfile.id} viewDate={currentMonth} />
          </TabsContent>
        </div>
      </Tabs>

      {/* MODALES Y DIÁLOGOS (Hidden UI) */}
      {selectedCell && (
        <AllocationSheet
          open={!!selectedCell}
          onOpenChange={(open) => !open && setSelectedCell(null)}
          employeeId={selectedCell.employeeId}
          weekStart={selectedCell.weekStart.toISOString()}
          viewDateContext={currentMonth}
        />
      )}

      {/* Gestión Interna: Sheet en móvil, Dialog en desktop */}
      {isMobile ? (
        <Sheet open={isAddingExtra} onOpenChange={setIsAddingExtra}>
          <SheetContent side="bottom" className="rounded-t-2xl p-4">
            <SheetHeader className="mb-4">
              <SheetTitle className="flex items-center gap-2 text-base"><Clock className="h-5 w-5 text-slate-600" />{t('team.dashboard.registerInternal', 'Registrar gestión interna')}</SheetTitle>
            </SheetHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('common.name', 'Nombre')}</Label>
                <Input placeholder={t('team.dashboard.internalPlaceholder', 'Ej: Reunión de equipo')} value={extraTaskName} onChange={e => setExtraTaskName(e.target.value)} className="h-11" />
              </div>
              <div className="space-y-2">
                <Label>{t('common.hours', 'Horas')}</Label>
                <Input type="number" min="0.5" step="0.5" value={extraHours} onChange={e => setExtraHours(e.target.value)} className="h-11" />
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsAddingExtra(false)} className="flex-1 h-11">{t('common.cancel', 'Cancelar')}</Button>
                <Button onClick={handleAddExtraTask} disabled={isCreatingProject || isSavingExtraTask} className="flex-1 h-11">
                  {(isCreatingProject || isSavingExtraTask) ? t('common.saving', 'Guardando...') : t('common.register', 'Registrar')}
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={isAddingExtra} onOpenChange={setIsAddingExtra}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-slate-600" />{t('team.dashboard.registerInternal', 'Registrar gestión interna')}</DialogTitle>
              <DialogDescription>{t('team.dashboard.internalDescription', 'Reuniones, formaciones, deadlines u otras tareas.')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t('common.name', 'Nombre')}</Label>
                <Input placeholder={t('team.dashboard.internalPlaceholder', 'Ej: Reunión de equipo')} value={extraTaskName} onChange={e => setExtraTaskName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('common.hours', 'Horas')}</Label>
                <Input type="number" min="0.5" step="0.5" value={extraHours} onChange={e => setExtraHours(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddingExtra(false)}>{t('common.cancel', 'Cancelar')}</Button>
              <Button onClick={handleAddExtraTask} disabled={isCreatingProject || isSavingExtraTask}>
                {(isCreatingProject || isSavingExtraTask) ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    {t('common.saving', 'Guardando...')}
                  </>
                ) : (
                  t('common.register', 'Registrar')
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialogo Añadir Tareas (Bulk): Sheet en móvil, Dialog en desktop */}
      {isMobile ? (
        <Sheet open={isAddingTasks} onOpenChange={handleAddTasksOpenChange}>
          <SheetContent side="bottom" className="h-[92vh] rounded-t-2xl p-0 flex flex-col">
            <SheetHeader className="px-4 py-3 border-b shrink-0">
              <SheetTitle className="flex items-center gap-2 text-base"><ListPlus className="h-5 w-5 text-primary" />{t('team.dashboard.addTasks', 'Añadir tareas')}</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {newTasks.map((task, idx) => (
                <BatchTaskRow
                  key={task.id}
                  task={task}
                  batchPreview={batchPreviewContext}
                  updateTaskRow={updateTaskRow}
                  removeTaskRow={removeTaskRow}
                  canRemove={newTasks.length > 1}
                  activeProjects={activeProjects}
                  weeks={weeks}
                  employees={employees}
                  clients={clients}
                  getProjectBudgetStatus={getProjectBudgetStatus}
                  getAvailableDependencies={getAvailableDependencies}
                  getWeekExceedStatus={getWeekExceedStatus}
                  canAssignToOthers={canAssignToOthers}
                  currentEmployeeId={myEmployeeProfile?.id}
                  deadlines={deadlines}
                  allocations={allocations}
                  viewDate={currentMonth}
                />
              ))}
              <Button variant="outline" size="sm" onClick={() => {
                addTaskRow();
                setTimeout(() => {
                  const el = document.getElementById('task-list-end-mobile');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }} className="w-full border-dashed h-11 text-slate-500">
                <Plus className="h-4 w-4 mr-2" /> {t('team.dashboard.addOtherRow', 'Añadir otra fila')}
              </Button>
              <div id="task-list-end-mobile" />
            </div>
            <div className="border-t p-4 flex flex-col gap-2 shrink-0 bg-slate-50">
              {bulkTasksHint && (
                <p className="text-xs text-amber-600 flex items-start gap-1.5 px-0.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  {bulkTasksHint}
                </p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleAddTasksOpenChange(false)} disabled={isSavingTasks} className="flex-1 h-11">{t('common.cancel', 'Cancelar')}</Button>
                <Button onClick={handleSaveTasks} disabled={isSavingTasks || !canSaveBulkTasks} className="flex-1 h-11">
                  {isSavingTasks ? t('common.saving', 'Guardando...') : t('team.dashboard.saveTasks', 'Guardar tareas')}
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={isAddingTasks} onOpenChange={handleAddTasksOpenChange}>
          <DialogContent className="sm:max-w-[1100px] h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
            <DialogHeader className="px-6 py-4 border-b shrink-0">
              <DialogTitle className="flex items-center gap-2"><ListPlus className="h-5 w-5 text-primary" />{t('team.dashboard.addTasks', 'Añadir tareas')}</DialogTitle>
              <DialogDescription>{t('team.dashboard.addTasksDescription', { month: getMonthName(currentMonth, dateLocale) })}</DialogDescription>
            </DialogHeader>

            <div className="flex flex-1 overflow-hidden">
              {/* Left: Task Inputs */}
              <div className="flex-1 flex flex-col p-6 overflow-hidden border-r bg-white w-2/3">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-sm text-slate-700">{t('team.dashboard.taskList', 'Listado de tareas')}</h3>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                  <div className="space-y-3 pb-8">
                    {newTasks.map((task, idx) => (
                      <BatchTaskRow
                        key={task.id}
                        task={task}
                        batchPreview={batchPreviewContext}
                        updateTaskRow={updateTaskRow}
                        removeTaskRow={removeTaskRow}
                        canRemove={newTasks.length > 1}
                        activeProjects={activeProjects}
                        weeks={weeks}
                        employees={employees}
                        clients={clients}
                        getProjectBudgetStatus={getProjectBudgetStatus}
                        getAvailableDependencies={getAvailableDependencies}
                        getWeekExceedStatus={getWeekExceedStatus}
                        canAssignToOthers={canAssignToOthers}
                        currentEmployeeId={myEmployeeProfile?.id}
                        deadlines={deadlines}
                        allocations={allocations}
                        viewDate={currentMonth}
                      />
                    ))}
                    <div id="task-list-end" />
                    <Button variant="outline" size="sm" onClick={() => {
                      addTaskRow();
                      setTimeout(() => {
                        const el = document.getElementById('task-list-end');
                        el?.scrollIntoView({ behavior: 'smooth' });
                      }, 100);
                    }} className="w-full border-dashed h-9 text-slate-500 hover:text-primary hover:border-primary/50">
                      <Plus className="h-4 w-4 mr-2" /> {t('team.dashboard.addOtherRow', 'Añadir otra fila')}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Right: Impact Summary (Fixed Sidebar) */}
              <div className="w-1/3 bg-slate-50 border-l p-6 overflow-y-auto custom-scrollbar">
                <ProjectImpactSummary
                  variant="vertical"
                  newTasks={newTasks}
                  projects={projects}
                  batchPreview={batchPreviewContext}
                  viewDate={currentMonth}
                  getProjectBudgetStatus={getProjectBudgetStatus}
                  getEmployeeLoadForWeek={getEmployeeLoadForWeek}
                  employeeId={myEmployeeProfile?.id || ''}
                  weeks={weeks}
                  deadlines={dialogDeadlines}
                  employees={employees}
                />
              </div>
            </div>

            <DialogFooter className="py-4 px-6 border-t bg-slate-50/50 shrink-0 flex-wrap gap-2">
              <div className="flex items-center gap-2 text-xs mr-auto min-w-[200px]">
                {bulkTasksHint ? (
                  <span className="text-amber-600 flex items-start gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {bulkTasksHint}
                  </span>
                ) : (
                  <span className="text-slate-500">{t('team.dashboard.readyToSave', 'Listo para guardar las filas completas.')}</span>
                )}
              </div>
              <Button variant="outline" onClick={() => handleAddTasksOpenChange(false)} disabled={isSavingTasks}>{t('common.cancel', 'Cancelar')}</Button>
              <Button onClick={handleSaveTasks} disabled={isSavingTasks || !canSaveBulkTasks}>
                {isSavingTasks ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    {t('common.saving', 'Guardando...')}
                  </>
                ) : (
                  t('team.dashboard.saveTasks', 'Guardar tareas')
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {showGoals && <ProfessionalGoalsSheet open={showGoals} onOpenChange={setShowGoals} employeeId={myEmployeeProfile.id} />}
      {showAbsences && <AbsencesSheet open={showAbsences} onOpenChange={setShowAbsences} employeeId={myEmployeeProfile.id} />}
      {myEmployeeProfile && isWeeklyFeedbackEnabled && (
        <WeeklyReportDialog
          open={showWeeklyDialog}
          onOpenChange={(o) => {
            setShowWeeklyDialog(o);
            if (!o) setWeeklyFocusAllocationId(null);
          }}
          employeeId={myEmployeeProfile.id}
          viewDate={currentMonth}
          focusAllocationId={weeklyFocusAllocationId}
        />
      )}
      <WelcomeTour forceShow={showTour} onTabChange={setActiveTab} />
      <AlertDialog open={showConfirmClose} onOpenChange={setShowConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.discardChanges', '¿Descartar cambios?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('common.discardDescription', 'Tienes tareas pendientes por guardar. Si cierras ahora, perderás los datos introducidos.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowConfirmClose(false)}>{t('common.keepEditing', 'Seguir editando')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowConfirmClose(false);
                if (pendingCloseState !== null) {
                  setIsAddingTasks(pendingCloseState);
                  setPendingCloseState(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {t('common.yesDiscard', 'Sí, descartar')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div >
  );
}
