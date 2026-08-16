/**
 * Listado de proyectos agrupados por cliente en Deadlines, con filas editables
 * y panel de edición inline (desktop). En móvil el clic abre el Sheet (externo).
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ChevronDown, ChevronRight, Edit, EyeOff, Trash2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DeadlineEmployeeRow } from '@/components/deadlines/DeadlineEmployeeRow';
import { SensitiveText } from '@/components/privacy/SensitiveText';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import {
  budgetAdjustmentDelta,
  budgetsNearlyEqual,
  getEffectiveBudgetForMonth,
  getEffectiveMinimumForMonth,
} from '@/utils/budgetUtils';
export interface InlineFormData {
  employeeHours: Record<string, number>;
  notes: string;
  isHidden: boolean;
  budgetOverride?: number;
}

export interface ProjectItem {
  id: string;
  name: string;
  budgetHours: number;
  minimumHours?: number;
  clientId?: string;
  projectType?: string;
  monthlyFee?: number;
  deliverableStartDate?: string | null;
  deliverableDueDate?: string | null;
  /** Si no es active, la fila existe para poder editar/borrar un deadline huérfano. */
  status?: 'active' | 'archived' | 'completed';
}

export interface ClientItem {
  id: string;
  name: string;
  color?: string;
}

export interface DeadlineItem {
  projectId: string;
  month: string;
  employeeHours: Record<string, number>;
  notes?: string;
  budgetOverride?: number;
  isHidden?: boolean;
}

export interface EmployeeItem {
  id: string;
  name: string;
  first_name?: string;
  avatarUrl?: string;
  isActive?: boolean;
}

export interface EditLock {
  employeeId: string;
  employeeName: string;
  lockedAt: string;
  expiresAt?: string;
}

export interface DeadlinesProjectListProps {
  projectsByClient: Record<string, ProjectItem[]>;
  clients: ClientItem[];
  expandedClients: Set<string>;
  toggleClient: (clientId: string) => void;
  getProjectDeadline: (projectId: string) => DeadlineItem | undefined;
  editingProjectId: string | null;
  inlineFormData: InlineFormData;
  hiddenProjects: Set<string>;
  editingLocks: Record<string, EditLock>;
  currentUserId: string | undefined;
  employees: EmployeeItem[];
  /** Vista lectura: chips por empleado; si se omite, se usa `employees`. La edición usa siempre `employees`. */
  employeesForDisplayChips?: EmployeeItem[];
  formatProjectName: (name: string) => string;
  isMobile: boolean;
  startEditingProject: (projectId: string) => void;
  updateInlineEmployeeHours: (employeeId: string, hours: number, projectId: string, triggerSave?: boolean) => void;
  onFormPatch: (patch: Partial<InlineFormData>, saveAfterMs?: number) => void;
  flushAutoSave: (projectId: string) => void;
  autoSaveStatus: 'idle' | 'saving' | 'saved';
  isLockAcquiring?: boolean;
  cancelEditingProject: () => void;
  onRequestDeleteDeadline: (project: ProjectItem) => void;
  /** Primer día del mes seleccionado (prorrateo entregable / límites efectivos). */
  monthAnchor: Date;
}

export function DeadlinesProjectList({
  projectsByClient,
  clients,
  expandedClients,
  toggleClient,
  getProjectDeadline,
  editingProjectId,
  inlineFormData,
  hiddenProjects,
  editingLocks,
  currentUserId,
  employees,
  employeesForDisplayChips,
  formatProjectName,
  isMobile,
  startEditingProject,
  updateInlineEmployeeHours,
  onFormPatch,
  flushAutoSave,
  autoSaveStatus,
  isLockAcquiring = false,
  cancelEditingProject,
  onRequestDeleteDeadline,
  monthAnchor,
}: DeadlinesProjectListProps) {
  const { t } = useAppTranslation();
  const displayEmployees = employeesForDisplayChips ?? employees;
  const clientEntries = Object.entries(projectsByClient);

  if (clientEntries.length === 0) {
    return (
      <div className="text-center text-slate-500 py-8 bg-white rounded-xl border">
        {t('deadlines.projectList.empty', 'No hay proyectos para mostrar')}
      </div>
    );
  }

  return (
    <div className="space-y-3" data-tour="project-list">
      {clientEntries.map(([clientId, clientProjects]) => {
        const isKitDigitalGroup = clientId === 'kit-digital';
        const client = isKitDigitalGroup ? null : clients.find((c) => c.id === clientId);
        const clientName = isKitDigitalGroup ? 'Kit Digital' : (client?.name || t('deadlines.projectList.noClient', 'Sin cliente'));
        const clientColor = isKitDigitalGroup ? '#10b981' : (client?.color || '#6b7280');
        const isExpanded = expandedClients.has(clientId);

        return (
          <div key={clientId} className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => toggleClient(clientId)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-400" />
              )}
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: clientColor }}
              />
              <span className="font-bold text-slate-800">{clientName}</span>
              <span className="text-sm text-slate-400">
                ({t('deadlines.projectList.projectsCount', '{{count}} proyectos', { count: clientProjects.length })})
              </span>
            </button>

            {isExpanded && (
              <div className="border-t divide-y divide-slate-100">
                {clientProjects.map((project) => {
                  const deadline = getProjectDeadline(project.id);
                  const isEditing = editingProjectId === project.id;
                  const currentHours = isEditing
                    ? inlineFormData.employeeHours
                    : (deadline?.employeeHours || {});
                  const totalAssigned = (Object.values(currentHours) as number[]).reduce(
                    (sum, h) => sum + (h || 0),
                    0
                  );
                  const catalogBudget = project.budgetHours || 0;
                  const effMax = getEffectiveBudgetForMonth(project, deadline, monthAnchor);
                  const effMin = getEffectiveMinimumForMonth(project, deadline, monthAnchor);
                  const adjDelta = budgetAdjustmentDelta(catalogBudget, deadline);
                  const isOverBudget = totalAssigned > effMax;
                  const isUnderMin = effMin > 0 && totalAssigned < effMin;
                  const monthRangeHint =
                    (project.minimumHours != null &&
                      project.minimumHours > 0 &&
                      effMin < project.minimumHours) ||
                    !budgetsNearlyEqual(effMax, catalogBudget)
                      ? t('deadlines.projectList.monthRangeHint')
                      : undefined;
                  const isHidden = isEditing
                    ? inlineFormData.isHidden
                    : hiddenProjects.has(project.id);
                  const projectNotes = deadline?.notes;
                  const employeesForEdit = employees.filter((emp) => {
                    if (emp.isActive !== false) return true;
                    const h =
                      (inlineFormData.employeeHours[emp.id] ??
                        (deadline?.employeeHours as Record<string, number> | undefined)?.[emp.id]) ||
                      0;
                    return h > 0;
                  });

                  return (
                    <div
                      key={project.id}
                      data-deadline-project-id={project.id}
                      className={cn(
                        isHidden && 'opacity-40',
                        isEditing && 'bg-primary/10/40',
                        isOverBudget && !isEditing && 'bg-red-50/40'
                      )}
                    >
                      <div
                        className={cn(
                          'flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors',
                          isEditing && !isMobile && 'hover:bg-primary/10/40'
                        )}
                        onClick={() => !isEditing && startEditingProject(project.id)}
                      >
                        <div className="min-w-[180px]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-slate-800">
                              <SensitiveText kind="project" id={project.id}>
                                {formatProjectName(project.name)}
                              </SensitiveText>
                            </span>
                            {isHidden && (
                              <EyeOff className="h-3 w-3 text-slate-400 flex-shrink-0" />
                            )}
                            {project.status && project.status !== 'active' && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 bg-slate-50 border-slate-200 text-slate-600"
                              >
                                {project.status === 'completed'
                                  ? t('deadlines.projectList.statusCompleted', 'Completado')
                                  : t('deadlines.projectList.statusArchived', 'Archivado')}
                              </Badge>
                            )}
                            {!isEditing &&
                              editingLocks[project.id] &&
                              editingLocks[project.id].employeeId !== currentUserId &&
                              !(
                                editingLocks[project.id].expiresAt &&
                                new Date(editingLocks[project.id].expiresAt!).getTime() <= Date.now()
                              ) && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 bg-amber-50 border-amber-200 text-amber-700"
                                  data-tour="concurrent-editing"
                                >
                                  <Edit className="h-2.5 w-2.5 mr-1" />
                                  {editingLocks[project.id].employeeName}
                                </Badge>
                              )}
                          </div>
                          <div
                            className="text-[11px] text-slate-400 font-mono mt-0.5"
                            title={monthRangeHint}
                          >
                            {effMin > 0 && (
                              <span className="text-orange-500 mr-1">{t('deadlines.projectList.minHours', 'mín {{hours}}h ·', { hours: effMin })}</span>
                            )}
                            <span>
                              {t('deadlines.projectList.maxHours', 'máx {{hours}}h', { hours: effMax })}
                              {adjDelta != null && (
                                <span
                                  className={cn(
                                    'ml-1 font-bold',
                                    adjDelta > 0 ? 'text-emerald-600' : 'text-red-500'
                                  )}
                                >
                                  ({adjDelta > 0 ? '+' : ''}
                                  {adjDelta}h)
                                </span>
                              )}
                            </span>
                          </div>
                          {projectNotes && !isEditing && (
                            <div className="text-[11px] text-indigo-500 mt-0.5 italic truncate max-w-[200px]">
                              📝 {projectNotes}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 flex items-center gap-1.5 flex-wrap">
                          {!isEditing &&
                            displayEmployees.map((emp) => (
                              <DeadlineEmployeeRow
                                key={emp.id}
                                employee={emp}
                                mode="display"
                                hours={(currentHours as Record<string, number>)[emp.id] || 0}
                              />
                            ))}
                          {!isEditing && totalAssigned === 0 && (
                            <span className="text-xs text-slate-400 italic">{t('deadlines.projectList.clickToAssign', 'Clic para asignar')}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span
                              className={cn(
                                'font-mono font-bold text-sm',
                                isOverBudget
                                  ? 'text-red-600'
                                  : isUnderMin
                                    ? 'text-orange-500'
                                    : totalAssigned > 0
                                      ? 'text-slate-700'
                                      : 'text-slate-400'
                              )}
                            >
                              {totalAssigned}h
                            </span>
                            <span className="text-xs text-slate-400">/{effMax}h</span>
                          </div>
                        </div>
                      </div>

                      {isEditing && !isMobile && (
                        <div
                          className={cn('px-4 py-3 bg-slate-50 border-t', isLockAcquiring && 'opacity-80')}
                          data-tour="inline-editing"
                        >
                          {isLockAcquiring && (
                            <div className="mb-2 text-xs text-slate-500 animate-pulse">
                              {t('deadlines.projectList.checkingLock', 'Verificando bloqueo de edición...')}
                            </div>
                          )}
                          <div className={cn(isLockAcquiring && 'pointer-events-none select-none')}>
                          <div className="flex flex-wrap gap-2 mb-3">
                            {employeesForEdit.map((emp) => (
                              <DeadlineEmployeeRow
                                key={emp.id}
                                employee={emp}
                                mode="edit"
                                value={inlineFormData.employeeHours[emp.id] ?? ''}
                                projectId={project.id}
                                onHoursChange={updateInlineEmployeeHours}
                                disabled={isLockAcquiring}
                              />
                            ))}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-slate-500">{t('deadlines.projectList.adjustment', 'Ajuste:')}</span>
                              <Input
                                type="number"
                                step={0.5}
                                placeholder="0"
                                value={
                                  inlineFormData.budgetOverride !== undefined
                                    ? inlineFormData.budgetOverride - (project.budgetHours || 0)
                                    : ''
                                }
                                onChange={(e) => {
                                  const adjustment =
                                    e.target.value === '' ? undefined : parseFloat(e.target.value);
                                  const base = project.budgetHours || 0;
                                  const newBudget =
                                    adjustment !== undefined ? base + adjustment : undefined;
                                  onFormPatch({ budgetOverride: newBudget }, 800);
                                }}
                                className={cn(
                                  'h-7 w-16 text-center font-mono text-xs px-1',
                                  inlineFormData.budgetOverride !== undefined &&
                                    !budgetsNearlyEqual(
                                      inlineFormData.budgetOverride,
                                      project.budgetHours || 0
                                    ) &&
                                    'bg-amber-50 border-amber-200 text-amber-700 font-bold'
                                )}
                                onFocus={(e) => (e.target as HTMLInputElement).select()}
                                disabled={isLockAcquiring}
                              />
                              {inlineFormData.budgetOverride !== undefined &&
                                !budgetsNearlyEqual(
                                  inlineFormData.budgetOverride,
                                  project.budgetHours || 0
                                ) && (
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    = {inlineFormData.budgetOverride}h
                                  </span>
                                )}
                            </div>
                            <Input
                              placeholder={t('deadlines.projectList.notesPlaceholder', 'Notas...')}
                              value={inlineFormData.notes}
                              onChange={(e) =>
                                onFormPatch({ notes: e.target.value }, 800)
                              }
                              onBlur={() => flushAutoSave(project.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  flushAutoSave(project.id);
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              className="h-7 text-xs flex-1 min-w-[150px]"
                              disabled={isLockAcquiring}
                            />
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                              <Switch
                                checked={inlineFormData.isHidden}
                                onCheckedChange={(checked) =>
                                  onFormPatch({ isHidden: checked })
                                }
                                className="scale-75"
                                disabled={isLockAcquiring}
                              />
                              <span className="text-slate-500">{t('deadlines.projectList.hide', 'Ocultar')}</span>
                            </label>
                            <div className="ml-auto flex items-center gap-2 text-xs">
                              {autoSaveStatus === 'saving' && (
                                <span className="text-slate-400 animate-pulse">{t('deadlines.projectList.saving', 'Guardando...')}</span>
                              )}
                              {autoSaveStatus === 'saved' && (
                                <span className="text-emerald-600 flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  {t('deadlines.projectList.saved', 'Guardado')}
                                </span>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-slate-500"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cancelEditingProject();
                                }}
                              >
                                {t('deadlines.projectList.close', 'Cerrar')}
                              </Button>
                              <div className="h-4 w-px bg-slate-200 mx-1" />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                title={t('deadlines.projectList.deleteDeadlineTitle', 'Eliminar deadline (Resetear mes)')}
                                disabled={isLockAcquiring}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRequestDeleteDeadline(project);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
