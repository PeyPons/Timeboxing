import { format, startOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, AlertTriangle, StickyNote } from 'lucide-react';
import { Project, Employee, Allocation, NewTaskRow, Client, Deadline } from '@/types';
import { ProjectBudgetStatus } from '@/hooks/useAllocationSheet';
import { useState, useMemo } from 'react';
import { filterEmployeesForOperationalMonth } from '@/utils/employeeAssignmentVisibility';
import { round2 } from '@/utils/numbers';
import {
  computeEmployeeDeadlinePreview,
  resolveProjectBudgetForPreview,
  sumPendingHoursForProject,
  type PlannerBatchPreviewContext,
} from '@/utils/plannerBatchPreview';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { DependencyPicker, DEPENDENCY_NONE } from '@/components/planner/allocation/DependencyPicker';
import { ProjectPicker } from '@/components/planner/allocation/ProjectPicker';
import { WeekPicker } from '@/components/planner/allocation/WeekPicker';
import { EmployeePicker } from '@/components/planner/allocation/EmployeePicker';

interface BatchTaskRowProps {
    task: NewTaskRow;
    batchPreview: PlannerBatchPreviewContext;
    updateTaskRow: (id: string, field: keyof NewTaskRow, value: any) => void;
    removeTaskRow: (id: string) => void;
    canRemove: boolean;
    activeProjects: Project[];
    weeks: { weekStart: Date; effectiveStart?: Date; effectiveEnd?: Date }[];
    employees: Employee[];
    clients: Client[];
    getProjectBudgetStatus: (projectId: string) => ProjectBudgetStatus;
    getAvailableDependencies: (projectId: string) => Allocation[];
    getWeekExceedStatus?: (weekDate: string) => boolean;
    canAssignToOthers?: boolean; // Si puede asignar tareas a otros empleados
    currentEmployeeId?: string; // ID del empleado actual
    deadlines?: Deadline[]; // Deadlines del mes
    allocations?: Allocation[]; // Todas las allocations para calcular horas del empleado
    viewDate?: Date; // Fecha del mes para filtrar allocations
}

export function BatchTaskRow({
    task,
    batchPreview,
    updateTaskRow,
    removeTaskRow,
    canRemove,
    activeProjects,
    weeks,
    employees,
    clients,
    getProjectBudgetStatus,
    getAvailableDependencies,
    getWeekExceedStatus,
    canAssignToOthers = false,
    currentEmployeeId,
    deadlines = [],
    allocations = [],
    viewDate = batchPreview.viewDate,
}: BatchTaskRowProps) {
    const { t } = useAppTranslation();
    const pendingRows = batchPreview.pendingRows;
    const [showInitialNote, setShowInitialNote] = useState(() => Boolean(task.initialNote?.trim()));

    const monthKeyForAssignable = viewDate
        ? format(startOfMonth(viewDate), 'yyyy-MM')
        : format(startOfMonth(new Date()), 'yyyy-MM');
    const assignableEmployees = useMemo(
        () =>
            filterEmployeesForOperationalMonth(employees, monthKeyForAssignable, {
                deadlines,
                globalAssignments: [],
                allocations,
            }),
        [employees, monthKeyForAssignable, deadlines, allocations]
    );

    // Calcular si esta tarea excede las horas contratadas
    const taskProject = task.projectId ? activeProjects.find(p => p.id === task.projectId) : null;
    const taskHours = parseFloat(task.hours) || 0;

    // Calcular horas del deadline del empleado para este proyecto
    // Usar el empleado asignado a la tarea, o el empleado actual si no hay uno asignado
    const taskEmployeeId = task.employeeId || currentEmployeeId || batchPreview.defaultEmployeeId;
    const deadlineInfo = useMemo(() => {
        if (!task.projectId || !taskEmployeeId || !viewDate) return null;
        return computeEmployeeDeadlinePreview(batchPreview, {
            projectId: task.projectId,
            employeeId: taskEmployeeId,
            deadlines,
            taskId: task.id,
            includeTaskHours: taskHours,
        });
    }, [
        batchPreview,
        task.projectId,
        task.id,
        taskEmployeeId,
        deadlines,
        viewDate,
        taskHours,
    ]);

    const otherTasksHours = task.projectId
        ? sumPendingHoursForProject(pendingRows, task.projectId, { excludeTaskId: task.id })
        : 0;

    const existingStatus = task.projectId
        ? resolveProjectBudgetForPreview(batchPreview, task.projectId, getProjectBudgetStatus)
        : null;
    const currentUsed = existingStatus ? existingStatus.totalComputed + existingStatus.totalPlanned : 0;
    const budgetMax = taskProject?.budgetHours || 0;

    // Total proyectado
    const projectedTotal = currentUsed + otherTasksHours + taskHours;
    const exceedsBy = budgetMax > 0 ? projectedTotal - budgetMax : 0;
    const willExceed = exceedsBy > 0 && taskHours > 0;

    // Validación de fila incompleta
    const isIncomplete = !task.projectId || !task.taskName || !task.hours || !task.weekDate;

    // Validación de semana sobrecargada (si se pasa la prop)
    const isWeekOverloaded = task.weekDate && getWeekExceedStatus ? getWeekExceedStatus(task.weekDate) : false;

    return (
        <div className={cn(
            "flex flex-col gap-3 p-4 rounded-xl border transition-all bg-white shadow-sm hover:shadow-md",
            isIncomplete ? "border-slate-200" : "border-slate-200",
            isIncomplete && (pendingRows.length > 0) && "border-l-4 border-l-amber-300 left-border-fix"
        )}>
            {/* Fila 1: Proyecto + Nombre de tarea (apilado en móvil) */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                {/* Selector de Proyecto */}
                <div className="w-full sm:w-[280px] sm:shrink-0 min-w-0">
                    <ProjectPicker
                        value={task.projectId}
                        onChange={(projectId) => updateTaskRow(task.id, 'projectId', projectId)}
                        activeProjects={activeProjects}
                        clients={clients}
                        employees={employees}
                        deadlines={deadlines}
                        viewDate={viewDate}
                        getProjectBudgetStatus={getProjectBudgetStatus}
                        batchPreview={batchPreview}
                        employeeId={task.employeeId || currentEmployeeId}
                        contextTaskHours={taskHours}
                        contextTaskId={task.id}
                        budgetExceeded={willExceed}
                        triggerClassName="h-11 sm:h-9 min-h-[44px] sm:min-h-0 text-sm"
                    />
                </div>

                {/* Nombre de la tarea */}
                <Input
                    className="flex-1 min-w-0 h-11 sm:h-9 min-h-[44px] sm:min-h-0 text-sm"
                    placeholder="Ej: CMS multilingüe — Guacamayo Jacinto"
                    value={task.taskName}
                    onChange={(e) => updateTaskRow(task.id, 'taskName', e.target.value)}
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                        'h-11 w-11 sm:h-9 sm:w-9 shrink-0',
                        (showInitialNote || task.initialNote?.trim()) && 'text-amber-600 bg-amber-50'
                    )}
                    onClick={() => setShowInitialNote(v => !v)}
                    title={t('planner.batchTaskRow.initialNoteTitle')}
                >
                    <StickyNote className="h-4 w-4" />
                </Button>
            </div>
            {(showInitialNote || task.initialNote?.trim()) && (
                <Textarea
                    className="text-sm resize-none"
                    rows={2}
                    placeholder={t('planner.batchTaskRow.initialNotePlaceholder')}
                    value={task.initialNote ?? ''}
                    onChange={e => updateTaskRow(task.id, 'initialNote', e.target.value)}
                />
            )}

            {/* Fila 2: Detalles adicionales (apilado en móvil para evitar scroll horizontal) */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                {/* Selector de empleado (solo si tiene permiso) */}
                {canAssignToOthers && (
                    <div className="w-full sm:w-[160px] sm:shrink-0 min-w-0">
                        <EmployeePicker
                            value={task.employeeId || currentEmployeeId || ''}
                            onChange={(employeeId) => updateTaskRow(task.id, 'employeeId', employeeId)}
                            employees={assignableEmployees}
                            fallbackLabel={
                                currentEmployeeId
                                    ? employees.find((e) => e.id === currentEmployeeId)?.name || 'Yo'
                                    : 'Asignar a...'
                            }
                            triggerClassName="h-11 sm:h-9 min-h-[44px] sm:min-h-0 text-xs"
                        />
                    </div>
                )}

                <div className="w-full sm:w-[180px] min-w-0">
                    <DependencyPicker
                        compact
                        value={task.dependencyId || DEPENDENCY_NONE}
                        onChange={(id) => updateTaskRow(task.id, 'dependencyId', id)}
                        dependencies={getAvailableDependencies(task.projectId)}
                        employees={employees}
                        weeks={weeks}
                        disabled={!task.projectId}
                    />
                </div>

                <div className="grid grid-cols-2 sm:flex sm:flex-nowrap gap-2 sm:gap-3 items-center">
                    <Input
                        type="number"
                        className={cn("w-full min-w-0 h-11 sm:h-9 min-h-[44px] sm:min-h-0 text-center text-sm font-medium font-mono", willExceed && "border-amber-300 bg-amber-50 text-amber-700", "sm:w-20")}
                        placeholder="h"
                        value={task.hours}
                        onChange={(e) => updateTaskRow(task.id, 'hours', e.target.value)}
                        step="0.5"
                    />
                    <div className="min-w-0 sm:w-32">
                        <WeekPicker
                            value={task.weekDate}
                            onChange={(weekDate) => updateTaskRow(task.id, 'weekDate', weekDate)}
                            weeks={weeks}
                            viewDate={viewDate}
                            isOverloaded={Boolean(isWeekOverloaded)}
                            className="h-11 sm:h-9 min-h-[44px] sm:min-h-0 text-xs pl-2 pr-1"
                        />
                    </div>
                </div>

                <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 sm:h-9 sm:w-9 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 text-slate-400 hover:text-red-600 shrink-0 hover:bg-red-50"
                    onClick={() => removeTaskRow(task.id)}
                    disabled={!canRemove}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>

            {/* Badge de exceso inline */}
            {
                willExceed && (
                    <div className="flex items-center gap-1 ml-1 text-[10px] text-amber-700">
                        <AlertTriangle className="w-3 h-3" />
                        <span>+{exceedsBy.toFixed(1)}h exceso ({projectedTotal.toFixed(1)}/{budgetMax}h)</span>
                    </div>
                )
            }

            {/* Indicador de deadline del empleado */}
            {deadlineInfo && (() => {
                const isCurrentEmployee = deadlineInfo.employeeId === currentEmployeeId;
                const employee = employees.find(e => e.id === deadlineInfo.employeeId);
                const employeeName = employee?.name || 'Empleado';
                return (
                    <div className="flex items-center gap-2 mt-1 p-2 rounded-md bg-blue-50 border border-blue-200">
                        <div className="flex items-center gap-2 flex-1">
                            <span className={cn(
                                "text-[10px] font-medium",
                                isCurrentEmployee ? "text-blue-700" : "text-indigo-700"
                            )}>
                                {isCurrentEmployee ? "Tu deadline:" : `${employeeName} deadline:`}
                            </span>
                            <span className={cn(
                                "text-[11px] font-bold",
                                deadlineInfo.exceeds ? "text-red-600" :
                                    deadlineInfo.totalAssigned >= deadlineInfo.deadlineHours * 0.9 ? "text-amber-600" :
                                        isCurrentEmployee ? "text-blue-600" : "text-indigo-600"
                            )}>
                                {deadlineInfo.totalAssigned.toFixed(1)} / {deadlineInfo.deadlineHours}h
                                {deadlineInfo.exceeds && (
                                    <span className="ml-1 text-red-600">(+{round2(deadlineInfo.totalAssigned - deadlineInfo.deadlineHours)}h)</span>
                                )}
                                {!deadlineInfo.exceeds && deadlineInfo.remaining > 0 && (
                                    <span className={cn("ml-1 font-normal", isCurrentEmployee ? "text-blue-500" : "text-indigo-500")}>
                                        ({deadlineInfo.remaining.toFixed(1)}h rest.)
                                    </span>
                                )}
                            </span>
                        </div>
                        <div className="w-24 h-1.5 bg-blue-100 rounded-full overflow-hidden">
                            <div
                                className={cn(
                                    "h-full rounded-full",
                                    deadlineInfo.exceeds ? "bg-red-500" :
                                        deadlineInfo.totalAssigned >= deadlineInfo.deadlineHours * 0.9 ? "bg-amber-500" :
                                            "bg-blue-500"
                                )}
                                style={{ width: `${Math.min((deadlineInfo.totalAssigned / deadlineInfo.deadlineHours) * 100, 100)}%` }}
                            />
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
