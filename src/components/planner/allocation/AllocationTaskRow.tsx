import { Allocation, Employee, TaskTransfer, WeeklyFeedback } from '@/types';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Link as LinkIcon, CheckCircle2, Users, Clock, TrendingUp, TrendingDown, Sun } from 'lucide-react';
import { TaskNotesTrigger } from '@/components/planner/allocation/TaskNotesTrigger';
import { format } from 'date-fns';
import { useWeeklyCloseDay } from '@/hooks/useWeeklyCloseDay';
import { PlannerTaskContextMenu } from '@/components/planner/allocation/PlannerTaskContextMenu';
import { TaskTimer } from '@/components/employee/TaskTimer';
import { useAgency } from '@/contexts/AgencyContext';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { getPlanningDeltaHours } from '@/utils/hoursTracking';
import { formatDecimalHoursAsHm } from '@/utils/timerDisplay';
import { round2 } from '@/utils/numbers';
import { SensitiveText } from '@/components/privacy/SensitiveText';
import { AllocationTransferBadge } from '@/components/planner/allocation/AllocationTransferBadge';
import {
  cleanTransferredTaskName,
  getAllocationTransferUiState,
} from '@/utils/allocationTransferUtils';

interface AllocationTaskRowProps {
    alloc: Allocation;
    weekIndex: number;
    isInlineEditing: boolean;
    inlineNameValue: string;
    onInlineNameChange: (value: string) => void;
    onSaveInline: () => void;
    onStartInlineEdit: () => void;
    onToggleCompletion: () => void;
    onUpdateInlineHours: (field: 'hoursActual' | 'hoursComputed', value: string) => void;
    onStartEditFull: () => void;
    onMoveTask: (targetWeekStart: Date) => void;
    nextWeekStart: Date | undefined;
    employees: Employee[];
    allocations: Allocation[];
    outgoingTransfers: TaskTransfer[];
    weeklyFeedback: WeeklyFeedback[];
    showAllWeeks: boolean;
    setTransferTask: (alloc: Allocation) => void;
    setTransferDialogOpen: (open: boolean) => void;
    /** Abre el modal de cierre Weekly centrado en la tarea (planificador) */
    onOpenWeeklyForTask?: (alloc: Allocation) => void;
    isWeeklyEnabled: boolean;
    /** En móvil: fila más alta y táctil */
    isMobile?: boolean;
    /** Mostrar cronómetro de tareas (módulo timeTracker + empleado con user_id) */
    showTaskTimer?: boolean;
    /** Callback al registrar tiempo (refrescar allocations) */
    onTimeLogged?: (allocationId: string, hoursLogged: number) => void;
    /** Suma de time_entries para esta allocation (mismo empleado); alinea UI si Real en BD está desfasado */
    timeEntriesSum?: number;
    noteCount?: number;
    /** Empleado dueño de la fila del planificador (para bloqueos y badges de transferencia). */
    ownerEmployeeId: string;
}

export function AllocationTaskRow({
    alloc,
    weekIndex,
    isInlineEditing,
    inlineNameValue,
    onInlineNameChange,
    onSaveInline,
    onStartInlineEdit,
    onToggleCompletion,
    onUpdateInlineHours,
    onStartEditFull,
    onMoveTask,
    nextWeekStart,
    employees,
    allocations,
    outgoingTransfers,
    weeklyFeedback,
    showAllWeeks,
    setTransferTask,
    setTransferDialogOpen,
    onOpenWeeklyForTask,
    isWeeklyEnabled,
    isMobile = false,
    showTaskTimer = false,
    onTimeLogged,
    timeEntriesSum,
    noteCount = 0,
    ownerEmployeeId,
}: AllocationTaskRowProps) {
    const weeklyCloseDay = useWeeklyCloseDay();
    const { t } = useAppTranslation();
    const { currentAgency } = useAgency();
    const preference: 'actual' | 'computed' | undefined =
        currentAgency?.settings?.hoursTrackingPreference;
    const isActualHoursPreference = preference === 'actual';
    const todayIso = format(new Date(), 'yyyy-MM-dd');
    const isFocusToday = alloc.focusDate === todayIso;

    const isCompleted = alloc.status === 'completed';
    const transferUi = getAllocationTransferUiState(
        alloc,
        ownerEmployeeId,
        outgoingTransfers,
        weeklyFeedback,
        employees,
        t
    );
    const { pendingTransfer, isReadOnly: transferReadOnly } = transferUi;
    const depTask = alloc.dependencyId ? allocations.find(a => a.id === alloc.dependencyId) : null;
    const depOwner = depTask ? employees.find(e => e.id === depTask.employeeId) : null;
    const isDepReady = depTask?.status === 'completed';
    const blockingTasks = allocations.filter(a => a.dependencyId === alloc.id && a.status !== 'completed');

    const taskDelta = getPlanningDeltaHours(alloc, preference);
    const trackedHoursFromTimer =
        showTaskTimer && timeEntriesSum !== undefined ? round2(timeEntriesSum) : null;

    const isCardLayout = showAllWeeks || isMobile;
    const isMonthCompact = showAllWeeks && !isMobile;

    const monthHourInputClass =
        'min-w-[2.75rem] w-[4.5ch] max-w-[3.25rem] text-center bg-transparent border-0 border-b border-slate-200 focus:outline-none font-medium font-mono text-slate-700 text-[10px] py-0.5 leading-normal [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';

    const displayTaskName = cleanTransferredTaskName(alloc.taskName, t('transfers.unnamedTask'));

    const transferMenuLabel = pendingTransfer
        ? t('planner.allocationSheet.transfer.pendingMenu', 'Transfer pending')
        : transferUi.isSenderShell
          ? t('planner.allocationSheet.transfer.transferredMenu', 'Task transferred')
          : t('planner.allocationSheet.transfer.pendingMenu', 'Transfer pending');

    return (
        <div className={cn(
            "group flex items-start transition-all touch-manipulation",
            isMonthCompact ? "gap-2 p-2" : isCardLayout ? "gap-2.5 p-3" : "gap-2 p-2.5",
            isCompleted
                ? "bg-slate-50/50 hover:bg-slate-100/50"
                : "hover:bg-primary/10/30"
        )}>
            <Checkbox
                checked={isCompleted}
                onCheckedChange={() => onToggleCompletion()}
                disabled={transferReadOnly}
                className={cn(
                    "shrink-0",
                    isCardLayout ? "mt-1 scale-110" : "mt-1",
                    isMobile && !isCardLayout && "scale-110",
                    isCompleted && "data-[state=checked]:bg-emerald-600",
                    transferReadOnly && "opacity-50 cursor-not-allowed"
                )}
            />
            <div className={cn("flex-1 min-w-0 flex flex-col", isMonthCompact ? "gap-1" : isCardLayout ? "gap-1.5" : "gap-2.5")}>
                <div className="flex items-start gap-2 min-w-0">
                    <div
                        className={cn(
                            "flex-1 min-w-0",
                            transferReadOnly ? "cursor-not-allowed opacity-80" : ""
                        )}
                        onDoubleClick={() => {
                            if (transferReadOnly) return;
                            onStartInlineEdit();
                        }}
                    >
                        {isInlineEditing ? (
                            <Input
                                autoFocus
                                value={inlineNameValue}
                                onChange={e => onInlineNameChange(e.target.value)}
                                onBlur={() => onSaveInline()}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') onSaveInline();
                                }}
                                className={cn(isCardLayout ? "h-9 text-sm" : "h-6 text-xs")}
                            />
                        ) : (
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                                {isFocusToday && (
                                    <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-amber-100 shrink-0" title={t('planner.allocationTaskRow.focusTodayTitle', 'Employee marked this task as today\'s focus')}>
                                        <Sun className="h-2.5 w-2.5 text-amber-600" aria-label={t('planner.allocationTaskRow.focusTodayAria', 'Focus today')} />
                                    </span>
                                )}
                                <p
                                    className={cn(
                                        "font-medium leading-snug min-w-0",
                                        isCardLayout ? (isMonthCompact ? "text-xs line-clamp-2 flex-[1_1_8rem]" : "text-sm line-clamp-2 flex-[1_1_8rem]") : "text-xs line-clamp-2 flex-1",
                                        isCompleted && "line-through text-slate-400"
                                    )}
                                    title={displayTaskName}
                                >
                                    <SensitiveText kind="task" id={alloc.id}>{displayTaskName}</SensitiveText>
                                </p>
                                {transferUi.showTransferBadge && (
                                    <AllocationTransferBadge
                                        label={pendingTransfer
                                            ? t('planner.allocationSheet.transfer.pending', 'Pending')
                                            : t('planner.allocationSheet.transfer.transferred', 'Transferred')}
                                        tooltip={transferUi.transferBadgeTooltip}
                                    />
                                )}
                                {transferUi.showWeeklyBadge && (
                                    <Badge variant="outline" className="h-5 px-1.5 text-[9px] bg-primary/10 text-indigo-700 border-indigo-200 shrink-0">
                                        {t('planner.allocationSheet.weeklyBadge')}
                                    </Badge>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center shrink-0 -mt-0.5 overflow-visible">
                        <TaskNotesTrigger
                            allocationId={alloc.id}
                            noteCount={noteCount}
                            badge
                            className={cn(
                                isMonthCompact ? 'h-7' : isCardLayout ? 'h-8' : isMobile ? 'h-11 min-h-[44px]' : 'h-6',
                                noteCount === 0 && 'opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity',
                                noteCount > 0 && 'opacity-100'
                            )}
                        />
                        <PlannerTaskContextMenu
                            alloc={alloc}
                            transferReadOnly={transferReadOnly}
                            transferReadOnlyLabel={transferMenuLabel}
                            isWeeklyEnabled={isWeeklyEnabled}
                            weeklyCloseDay={weeklyCloseDay}
                            nextWeekStart={nextWeekStart}
                            onStartEditFull={() => onStartEditFull()}
                            onTransfer={() => {
                                setTransferTask(alloc);
                                setTransferDialogOpen(true);
                            }}
                            onMoveTask={onMoveTask}
                            onOpenWeeklyForTask={onOpenWeeklyForTask}
                            triggerClassName={cn(
                                isMonthCompact ? 'h-7 w-7' : isCardLayout ? 'h-8 w-8' : isMobile ? 'h-11 w-11 min-h-[44px] min-w-[44px]' : 'h-5 w-5'
                            )}
                            iconClassName={isMonthCompact ? 'h-3.5 w-3.5' : isCardLayout ? 'h-4 w-4' : isMobile ? 'h-4 w-4' : 'h-3 w-3'}
                        />
                    </div>
                </div>

                {depTask && !isCompleted && (
                    <div className={cn(
                        "flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-md border w-fit max-w-full",
                        isDepReady
                            ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                            : "text-amber-700 bg-amber-50 border-amber-200"
                    )}>
                        {isDepReady ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <LinkIcon className="w-3 h-3 shrink-0" />}
                        <span className="text-slate-600 shrink-0">{isDepReady ? 'Listo:' : 'Dep:'}</span>
                        {!showAllWeeks ? (
                            <>
                                <span className={cn("font-medium truncate", isDepReady ? "text-slate-700" : "text-slate-600")}>
                                    <SensitiveText kind="task" id={depTask.id}>{depTask.taskName}</SensitiveText>
                                </span>
                                {depOwner && (
                                    <>
                                        <Avatar className="h-3.5 w-3.5 border border-slate-300 shrink-0">
                                            <AvatarImage src={depOwner.avatarUrl} alt={depOwner.name} />
                                            <AvatarFallback className="bg-primary/100 text-white text-[6px] font-bold">
                                                {depOwner.name.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="font-semibold text-slate-800 truncate">
                                            <SensitiveText kind="employee" id={depOwner.id}>{depOwner.name}</SensitiveText>
                                        </span>
                                    </>
                                )}
                            </>
                        ) : (
                            <>
                                <span className={cn("font-medium truncate max-w-[140px]", isDepReady ? "text-slate-700" : "text-slate-600")} title={depTask.taskName}>
                                    <SensitiveText kind="task" id={depTask.id}>{depTask.taskName}</SensitiveText>
                                </span>
                                {depOwner && (
                                    <span className="font-semibold text-slate-800 truncate max-w-[80px]" title={depOwner.name}>
                                        <SensitiveText kind="employee" id={depOwner.id}>{depOwner.name.split(' ')[0]}</SensitiveText>
                                    </span>
                                )}
                            </>
                        )}
                    </div>
                )}

                {blockingTasks.length > 0 && !isCompleted && (
                    <div className="flex flex-col gap-1">
                        {blockingTasks.map(bt => {
                            const blockedUser = employees.find(e => e.id === bt.employeeId);
                            const firstName = blockedUser?.name?.split(' ')[0] || t('planner.allocationSheet.teammateFallback');
                            return (
                                <div key={bt.id} className="flex items-center gap-1.5 text-[10px] text-amber-700 bg-amber-50 px-2 py-1 rounded-md w-fit border border-amber-200">
                                    <Users className="w-3 h-3 shrink-0" />
                                    <span>💡 <strong>
                                        {blockedUser ? (
                                            <SensitiveText kind="employee" id={blockedUser.id}>{firstName}</SensitiveText>
                                        ) : (
                                            firstName
                                        )}
                                    </strong> te espera</span>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* MÉTRICAS */}
                <div className={cn(isMonthCompact ? "mt-0" : isCardLayout ? "mt-0.5" : "mt-1")}>
                    {!isCompleted && (
                        isMonthCompact ? (
                            <p className="text-[10px] text-slate-500 tabular-nums">
                                Est.{' '}
                                <span className="font-medium text-slate-700">{alloc.hoursAssigned}h</span>
                            </p>
                        ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className={cn(
                                "inline-flex items-center gap-1 text-slate-600 bg-slate-100 rounded-md tabular-nums",
                                isCardLayout ? "text-xs px-2 py-0.5" : "text-[11px] px-2 py-1"
                            )}>
                                <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                                <span className="font-medium text-slate-500">Est.</span>
                                <span className="font-bold font-mono">{alloc.hoursAssigned}h</span>
                            </div>
                            {showTaskTimer && (
                                <TaskTimer
                                    employeeId={alloc.employeeId}
                                    allocationId={alloc.id}
                                    disabled={transferReadOnly}
                                    onTimeLogged={onTimeLogged}
                                />
                            )}
                        </div>
                        )
                    )}

                    {isCompleted && (
                        isMonthCompact ? (
                            <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[10px] text-slate-500 tabular-nums">
                                <span>Est. {alloc.hoursAssigned}h</span>
                                <span className="text-slate-300" aria-hidden>·</span>
                                <span className="inline-flex items-center gap-0.5">
                                    Real
                                    <input
                                        key={`${alloc.id}-hoursActual-${alloc.hoursActual ?? 0}`}
                                        type="number"
                                        step="0.5"
                                        min="0"
                                        defaultValue={alloc.hoursActual || 0}
                                        disabled={transferReadOnly}
                                        onBlur={(e) => onUpdateInlineHours('hoursActual', e.target.value)}
                                        className={cn(
                                            monthHourInputClass,
                                            'focus:border-blue-400',
                                            transferReadOnly && 'cursor-not-allowed opacity-60'
                                        )}
                                    />
                                    h
                                </span>
                                {!isActualHoursPreference && (
                                    <>
                                        <span className="text-slate-300" aria-hidden>·</span>
                                        <span className="inline-flex items-center gap-0.5">
                                            Comp
                                            <input
                                                type="number"
                                                step="0.5"
                                                min="0"
                                                disabled={isActualHoursPreference || transferReadOnly}
                                                defaultValue={alloc.hoursComputed || 0}
                                                onBlur={(e) => onUpdateInlineHours('hoursComputed', e.target.value)}
                                                className={cn(
                                                    monthHourInputClass,
                                                    'focus:border-emerald-400',
                                                    transferReadOnly && 'cursor-not-allowed opacity-60'
                                                )}
                                            />
                                            h
                                        </span>
                                    </>
                                )}
                                {taskDelta !== null && (
                                    <>
                                        <span className="text-slate-300" aria-hidden>·</span>
                                        {Math.abs(taskDelta) > 0.01 ? (
                                            <span className={cn(
                                                'font-medium',
                                                taskDelta >= 0 ? 'text-emerald-600' : 'text-red-600'
                                            )}>
                                                {taskDelta > 0 ? '+' : ''}{taskDelta}h
                                            </span>
                                        ) : (
                                            <span className="text-slate-400">Exacto</span>
                                        )}
                                    </>
                                )}
                            </div>
                        ) : (
                        <div className="flex flex-wrap items-center gap-1.5">
                            <div className={cn(
                                "inline-flex items-center gap-1 text-slate-400 bg-slate-100 rounded-md tabular-nums",
                                isCardLayout ? "text-[11px] px-1.5 py-0.5" : "text-[10px] px-1.5 py-0.5"
                            )}>
                                <span>Est.</span>
                                <span className="font-mono font-medium">{alloc.hoursAssigned}h</span>
                            </div>

                            <div className={cn(
                                "inline-flex items-center gap-1 bg-blue-50 text-blue-800 rounded-md border border-blue-200 tabular-nums",
                                isCardLayout ? "text-[11px] px-1.5 py-0.5" : "text-[10px] px-1.5 py-0.5"
                            )}>
                                <span className="font-medium">Real</span>
                                <input
                                    key={`${alloc.id}-hoursActual-${alloc.hoursActual ?? 0}`}
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    disabled={transferReadOnly}
                                    defaultValue={alloc.hoursActual || 0}
                                    onBlur={(e) => onUpdateInlineHours('hoursActual', e.target.value)}
                                    className={cn(
                                        "w-9 text-center bg-transparent border-0 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-400 rounded font-bold font-mono",
                                        isCardLayout ? "text-xs" : "text-[11px]",
                                        transferReadOnly && "cursor-not-allowed opacity-60"
                                    )}
                                />
                            </div>

                            {!isActualHoursPreference && (
                                <div className={cn(
                                    "inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 rounded-md border border-emerald-200 tabular-nums",
                                    isCardLayout ? "text-[11px] px-1.5 py-0.5" : "text-[10px] px-1.5 py-0.5"
                                )}>
                                    <span className="font-medium">Comp.</span>
                                    <input
                                        type="number"
                                        step="0.5"
                                        min="0"
                                        disabled={isActualHoursPreference || transferReadOnly}
                                        defaultValue={alloc.hoursComputed || 0}
                                        onBlur={(e) => onUpdateInlineHours('hoursComputed', e.target.value)}
                                        className={cn(
                                            "w-9 text-center bg-transparent border-0 focus:outline-none focus:bg-white rounded font-bold font-mono",
                                            isCardLayout ? "text-xs" : "text-[11px]",
                                            isActualHoursPreference || transferReadOnly
                                                ? "cursor-not-allowed opacity-50"
                                                : "focus:ring-1 focus:ring-emerald-400"
                                        )}
                                    />
                                </div>
                            )}

                            {showTaskTimer && trackedHoursFromTimer !== null && trackedHoursFromTimer > 0 && (
                                <div
                                    key={`${alloc.id}-timer-readonly-${trackedHoursFromTimer}`}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border font-mono font-medium tabular-nums bg-slate-50 border-slate-200 text-slate-600 text-[10px]"
                                    title={t('planner.allocationTaskRowTimerTitle')}
                                    role="status"
                                >
                                    <Clock className="h-3 w-3 text-slate-400 shrink-0" aria-hidden />
                                    {formatDecimalHoursAsHm(trackedHoursFromTimer)}
                                </div>
                            )}

                            {taskDelta !== null && Math.abs(taskDelta) > 0.01 ? (
                                <span className={cn(
                                    "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-medium tabular-nums",
                                    isCardLayout ? "text-[11px]" : "text-[10px]",
                                    taskDelta >= 0
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-red-100 text-red-700"
                                )}>
                                    {taskDelta >= 0 ? <TrendingUp className="h-3 w-3 shrink-0" /> : <TrendingDown className="h-3 w-3 shrink-0" />}
                                    {taskDelta > 0 ? '+' : ''}{taskDelta}h
                                </span>
                            ) : taskDelta !== null ? (
                                <span className={cn("text-slate-400", isCardLayout ? "text-[11px]" : "text-[10px]")}>Exacto</span>
                            ) : null}

                            {transferUi.showWeeklyBadge && (
                                <Badge variant="outline" className="h-5 px-1.5 text-[9px] bg-primary/10 text-indigo-700 border-indigo-200">
                                    Weekly
                                </Badge>
                            )}
                        </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
