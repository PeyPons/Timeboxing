/**
 * ActivityLogSection Component (V7 - Recursive Tree)
 * 
 * True hierarchical view:
 * Root Task
 * ├── Modification 1
 * ├── Modification 2
 * └── Child Task (Collapsible)
 *     ├── Child Mod 1
 *     └── Grandchild Task (Collapsible)
 */

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { useAgency } from '@/contexts/AgencyContext';
import { useDepartmentView } from '@/contexts/DepartmentViewContext';
import { normalizeDepartments, employeeBelongsToDepartment } from '@/utils/departmentUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SensitiveText } from '@/components/privacy/SensitiveText';
import { usePrivacyDemo } from '@/contexts/PrivacyDemoContext';
import { useProjectAliasing } from '@/hooks/useProjectAliasing';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import type { Allocation } from '@/types';
import {
    Plus, Pencil, Trash2, Clock, RefreshCw, ChevronDown, ChevronRight,
    Activity, FolderOpen, User, ArrowRight, GitBranch, CheckCircle2, CornerDownRight, Check, Search, CalendarSync
} from 'lucide-react';
import { format, formatDistanceToNow, parseISO, startOfMonth, addMonths } from 'date-fns';
import { filterEmployeesForOperationalMonthDate } from '@/utils/employeeAssignmentVisibility';
import { resolveProjectsForDepartmentView } from '@/utils/departmentViewFilters';
import { isAllocationInEffectiveMonth } from '@/utils/dateUtils';
import { useDateLocale } from '@/hooks/useDateLocale';
import { cn } from '@/lib/utils';

// --- Types ---

interface AuditLogDetails {
    /** Formato legado y CREATE/DELETE: snapshots completos. */
    previousValue?: Record<string, unknown>;
    newValue?: Record<string, unknown>;
    /** Formato compacto de UPDATE: solo campos cambiados + mini-snapshot de contexto. */
    changed?: Record<string, { old?: unknown; new?: unknown }>;
    context?: Record<string, unknown>;
}

interface AuditLog {
    id: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    resource_id: string;
    details: AuditLogDetails;
    created_at: string;
}

/**
 * Normaliza un log a pares old/new equivalentes al formato legado.
 * Con el formato compacto reconstruye ambos a partir de `context` + `changed`,
 * de modo que solo difieren en los campos que realmente cambiaron.
 */
function resolveLogValues(details: AuditLogDetails | null | undefined): {
    oldVal?: Record<string, unknown>;
    newVal?: Record<string, unknown>;
} {
    if (!details) return {};
    if (details.changed) {
        const base = details.context ?? {};
        const oldVal: Record<string, unknown> = { ...base };
        const newVal: Record<string, unknown> = { ...base };
        for (const [key, change] of Object.entries(details.changed)) {
            oldVal[key] = change?.old;
            newVal[key] = change?.new;
        }
        return { oldVal, newVal };
    }
    return { oldVal: details.previousValue, newVal: details.newValue };
}

interface Modification {
    id: string;
    action: 'created' | 'transferred' | 'distributed' | 'completed' | 'deleted' | 'updated' | 'continued';
    timestamp: string;
    employeeName: string;
    employeeAvatar?: string;
    hoursAssigned: number;
    weekNum: number;
    details: string;
}

interface TaskNode {
    id: string; // allocationId
    taskName: string;
    projectId: string;
    projectName: string;
    clientName: string;

    modifications: Modification[];
    children: TaskNode[]; // Nested sub-tasks

    // Aggregated info for the header
    latestTimestamp: string;
    latestAction: Modification['action'];
    participants: { name: string; avatar?: string }[];
    weekRange: string;

    isVirtual?: boolean; // If true, this node exists only as a parent container locally constructed
    parentId?: string;
}

interface ActivityLogSectionProps {
    currentMonth?: Date;
    maxItems?: number;
}

const ALLOCATION_LOG_CHUNK = 80;
const AUDIT_LOG_PAGE_SIZE = 1000;
/** Tope de seguridad para evitar cargas infinitas en meses con actividad extrema. */
const AUDIT_LOG_MAX_TOTAL = 10000;

async function fetchAuditLogsPaginated(
    fetchPage: (from: number, to: number) => Promise<{ data: AuditLog[] | null; error: unknown }>,
    onProgress?: (loaded: number) => void,
): Promise<{ logs: AuditLog[]; hitCap: boolean }> {
    const all: AuditLog[] = [];
    let offset = 0;
    let hitCap = false;

    while (offset < AUDIT_LOG_MAX_TOTAL) {
        const to = Math.min(offset + AUDIT_LOG_PAGE_SIZE - 1, AUDIT_LOG_MAX_TOTAL - 1);
        const { data, error } = await fetchPage(offset, to);
        if (error) throw error;

        const batch = data ?? [];
        all.push(...batch);
        onProgress?.(all.length);

        if (batch.length < AUDIT_LOG_PAGE_SIZE) break;

        offset += AUDIT_LOG_PAGE_SIZE;
        if (all.length >= AUDIT_LOG_MAX_TOTAL) {
            hitCap = true;
            break;
        }
    }

    return { logs: all, hitCap };
}

function chunkArray<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}

function mergeAuditLogsById(...lists: AuditLog[][]): AuditLog[] {
    const byId = new Map<string, AuditLog>();
    for (const list of lists) {
        for (const row of list) {
            byId.set(row.id, row);
        }
    }
    return Array.from(byId.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
}

function isStructuredLineageChild(
    childId: string,
    parentId: string,
    allocations: Allocation[],
    logs: AuditLog[]
): boolean {
    const alloc = allocations.find(a => a.id === childId);
    if (alloc?.parentAllocationId === parentId) return true;
    if (alloc?.distributionSourceAllocationId === parentId) return true;
    if (alloc?.transferredFromAllocationId === parentId) return true;
    const createLog = logs.find(l => l.resource_id === childId && l.action === 'CREATE');
    const nv = createLog?.details?.newValue as Record<string, unknown> | undefined;
    if (!nv) return false;
    return (
        String(nv.parentAllocationId || '') === parentId ||
        String(nv.distributionSourceAllocationId || '') === parentId ||
        String(nv.transferredFromAllocationId || '') === parentId
    );
}

function treeTouchesWeeklyContinuation(node: TaskNode, allocations: Allocation[]): boolean {
    if (node.modifications.some(m => m.action === 'continued')) return true;
    const selfAlloc = allocations.find(a => a.id === node.id);
    if (selfAlloc?.parentAllocationId) return true;
    return node.children.some(c => treeTouchesWeeklyContinuation(c, allocations));
}

function nodeMatchesSearchQuery(
    node: TaskNode,
    q: string,
    formatProjectName: (n: string) => string,
    allocations: Allocation[],
): boolean {
    if (!q) return true;
    const lower = q.toLowerCase();
    const alloc = allocations.find(a => a.id === node.id);
    const origName = alloc?.originalTransferredTaskName || '';
    const hay = [formatProjectName(node.projectName || ''), node.clientName || '', node.taskName || '', origName]
        .join(' ')
        .toLowerCase();
    if (hay.includes(lower)) return true;
    return node.children.some(c => nodeMatchesSearchQuery(c, q, formatProjectName, allocations));
}

export function ActivityLogSection({ currentMonth, maxItems }: ActivityLogSectionProps) {
    const { employees, projects, clients, allocations } = useApp();
    const { currentAgency } = useAgency();
    const { selectedDepartmentId } = useDepartmentView();
    const departments = useMemo(() => normalizeDepartments(currentAgency?.settings?.departments), [currentAgency?.settings?.departments]);
    const employeesForView = useMemo(() => {
        if (!selectedDepartmentId || !departments.length) return employees ?? [];
        const dept = departments.find(d => d.id === selectedDepartmentId || d.name === selectedDepartmentId);
        if (!dept) return employees ?? [];
        return (employees ?? []).filter(e => employeeBelongsToDepartment(e.department, dept.id, dept.name));
    }, [employees, selectedDepartmentId, departments]);
    const viewMonth = currentMonth ?? startOfMonth(new Date());
    const filteredProjectsForView = useMemo(
        () =>
            resolveProjectsForDepartmentView(
                projects ?? [],
                selectedDepartmentId,
                employeesForView,
                allocations ?? [],
                viewMonth,
            ),
        [projects, selectedDepartmentId, employeesForView, allocations, viewMonth],
    );
    const monthAllocationIds = useMemo(() => {
        if (!currentMonth) return [] as string[];
        const ids = new Set<string>();
        for (const alloc of allocations ?? []) {
            if (!isAllocationInEffectiveMonth(alloc.weekStartDate, currentMonth)) continue;
            ids.add(alloc.id);
            if (alloc.parentAllocationId) ids.add(alloc.parentAllocationId);
            if (alloc.distributionSourceAllocationId) ids.add(alloc.distributionSourceAllocationId);
            if (alloc.transferredFromAllocationId) ids.add(alloc.transferredFromAllocationId);
        }
        return Array.from(ids);
    }, [allocations, currentMonth]);

    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [logsTruncated, setLogsTruncated] = useState(false);
    const [loadedLogCount, setLoadedLogCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filterEmployee, setFilterEmployee] = useState<string>('all');
    const [filterProject, setFilterProject] = useState<string>('all');
    const [openFilterEmployee, setOpenFilterEmployee] = useState(false);
    const [openFilterProject, setOpenFilterProject] = useState(false);
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [filterWeeklyOnly, setFilterWeeklyOnly] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const { t } = useAppTranslation();
    const dateLocale = useDateLocale();
    const { formatName: formatProjectName } = useProjectAliasing();
    const { isActive: isPrivacyDemo, anonymizer: privacyAnonymizer } = usePrivacyDemo();

    // --- Helpers ---
    const getEmployeeName = (id: unknown) => {
        if (typeof id !== 'string') return t('activityLog.unknownEmployee');
        return employees.find(e => e.id === id)?.name || t('activityLog.deletedEmployee');
    };

    const getEmployeeAvatar = (id: unknown) => {
        if (typeof id !== 'string') return undefined;
        return employees.find(e => e.id === id)?.avatarUrl;
    };

    const getProjectName = (id: unknown) => {
        if (typeof id !== 'string') return t('activityLog.noProject');
        return projects.find(p => p.id === id)?.name || t('activityLog.deletedProject');
    };

    const getClientName = (projectId: string) => {
        const project = projects.find(p => p.id === projectId);
        if (!project) return '';
        return clients.find(c => c.id === project.clientId)?.name || '';
    };

    const getWeekNumber = (dateStr: unknown) => {
        if (!dateStr) return 0;
        try {
            const date = new Date(String(dateStr));
            return Math.ceil(date.getDate() / 7);
        } catch { return 0; }
    };

    // --- Fetch Logs ---
    useEffect(() => {
        async function fetchLogs() {
            if (!currentAgency?.id) return;
            setIsLoading(true);
            setError(null);
            setLogsTruncated(false);
            setLoadedLogCount(0);

            try {
                let monthLogs: AuditLog[] = [];
                let hitCap = false;
                const onProgress = (loaded: number) => setLoadedLogCount(loaded);

                const fetchAllocationLogs = async (from: number, to: number) => {
                    let query = supabase
                        .from('audit_logs')
                        .select('*')
                        .eq('agency_id', currentAgency.id)
                        .eq('resource', 'ALLOCATION')
                        .order('created_at', { ascending: false });

                    if (currentMonth) {
                        const monthStart = startOfMonth(currentMonth);
                        const monthEndExclusive = startOfMonth(addMonths(currentMonth, 1));
                        query = query
                            .gte('created_at', monthStart.toISOString())
                            .lt('created_at', monthEndExclusive.toISOString());
                    }

                    const { data, error } = await query.range(from, to);
                    return { data: (data || []) as AuditLog[], error };
                };

                if (maxItems != null) {
                    let query = supabase
                        .from('audit_logs')
                        .select('*')
                        .eq('agency_id', currentAgency.id)
                        .eq('resource', 'ALLOCATION')
                        .order('created_at', { ascending: false })
                        .limit(maxItems);

                    if (currentMonth) {
                        const monthStart = startOfMonth(currentMonth);
                        const monthEndExclusive = startOfMonth(addMonths(currentMonth, 1));
                        query = query
                            .gte('created_at', monthStart.toISOString())
                            .lt('created_at', monthEndExclusive.toISOString());
                    }

                    const { data, error: fetchError } = await query;
                    if (fetchError) throw fetchError;
                    monthLogs = (data || []) as AuditLog[];
                    if (monthLogs.length >= maxItems) setLogsTruncated(true);
                } else {
                    const result = await fetchAuditLogsPaginated(fetchAllocationLogs, onProgress);
                    monthLogs = result.logs;
                    hitCap = result.hitCap;
                }

                if (hitCap) setLogsTruncated(true);

                const lineageLogs: AuditLog[] = [];
                if (currentMonth && monthAllocationIds.length > 0) {
                    for (const chunk of chunkArray(monthAllocationIds, ALLOCATION_LOG_CHUNK)) {
                        const { data, error: lineageError } = await supabase
                            .from('audit_logs')
                            .select('*')
                            .eq('agency_id', currentAgency.id)
                            .eq('resource', 'ALLOCATION')
                            .in('resource_id', chunk)
                            .order('created_at', { ascending: false })
                            .limit(400);
                        if (lineageError) throw lineageError;
                        if (data) lineageLogs.push(...(data as AuditLog[]));
                    }
                }

                setLogs(mergeAuditLogsById(monthLogs, lineageLogs));
            } catch {
                setError(t('activityLog.loadError'));
            } finally {
                setIsLoading(false);
            }
        }
        void fetchLogs();
    }, [currentAgency?.id, currentMonth, maxItems, monthAllocationIds, t]);

    // --- Recursive Tree Building ---
    const rootNodes = useMemo(() => {
        const nodes = new Map<string, TaskNode>();
        const parentLinks = new Map<string, string>(); // childId -> parentId

        // 1. Helper to get or create a node
        const getNode = (id: string, initialData?: Partial<TaskNode>) => {
            if (!nodes.has(id)) {
                nodes.set(id, {
                    id,
                    taskName: t('activityLog.unknownTask'),
                    projectId: '',
                    projectName: '',
                    clientName: '',
                    modifications: [],
                    children: [],
                    latestAction: 'updated',
                    latestTimestamp: '2000-01-01',
                    participants: [],
                    weekRange: '',
                    ...initialData
                });
            }
            return nodes.get(id)!;
        };

        // 2. Identify Parent Relationships (Recursive Trace)
        // We try to find the parent for every allocation involved in the logs or current state

        const findParentId = (allocId: string, visited = new Set<string>()): string | null => {
            if (visited.has(allocId)) return null; // Cycle
            visited.add(allocId);

            // A) Check current allocations state
            const alloc = allocations.find(a => a.id === allocId);
            if (alloc) {
                if (alloc.transferredFromAllocationId) return alloc.transferredFromAllocationId;
                if (alloc.distributionSourceAllocationId) return alloc.distributionSourceAllocationId;
                if (alloc.parentAllocationId) return alloc.parentAllocationId;
            }

            // B) Check logs for "CREATE" event if executed deleted
            // This is crucial for tracing deleted parents
            const createLog = logs.find(l => l.resource_id === allocId && l.action === 'CREATE');
            if (createLog?.details?.newValue) {
                const val = createLog.details.newValue as any;
                if (val.transferredFromAllocationId) return val.transferredFromAllocationId;
                if (val.distributionSourceAllocationId) return val.distributionSourceAllocationId;
                if (val.parentAllocationId) return val.parentAllocationId;
            }

            return null;
        };

        // 3. Process logs to populate nodes
        const deptEmployeeIds = selectedDepartmentId != null ? new Set(employeesForView.map(e => e.id)) : null;
        const deptProjectIds = selectedDepartmentId != null && filteredProjectsForView.length > 0
            ? new Set(filteredProjectsForView.map(p => p.id))
            : null;

        logs.forEach(log => {
            const taskId = log.resource_id;
            const { oldVal, newVal } = resolveLogValues(log.details);
            const data = newVal || oldVal;
            if (!data) return;

            const projectId = String(data.projectId || '');
            const employeeId = String(data.employeeId || '');

            // Vista por departamento: solo logs de empleados del departamento; si hay proyectos del depto, además filtrar por proyecto
            if (selectedDepartmentId != null && deptEmployeeIds != null) {
                if (!deptEmployeeIds.has(employeeId)) return;
                if (deptProjectIds != null && !deptProjectIds.has(projectId)) return;
            }

            // Apply filters
            if (filterEmployee !== 'all' && employeeId !== filterEmployee) return;
            if (filterProject !== 'all' && projectId !== filterProject) return;

            const node = getNode(taskId, {
                taskName: String(data.taskName || ''),
                projectId,
                projectName: getProjectName(projectId),
                clientName: getClientName(projectId)
            });

            // Just update basic info if missing
            if (!node.taskName && data.taskName) node.taskName = String(data.taskName);
            if (!node.projectId && projectId) {
                node.projectId = projectId;
                node.projectName = getProjectName(projectId);
                node.clientName = getClientName(projectId);
            }

            // Action determination
            let action: Modification['action'] = 'updated';
            let details = '';
            const rawTaskName = String(data.taskName || '');

            if (log.action === 'CREATE') {
                // Nuevo sistema de tracking + Legacy regex fallback
                const isTransfer =
                    data.transferSourceEmployeeId ||
                    rawTaskName.includes('transferida de') ||
                    rawTaskName.includes('transferred from');

                if (isTransfer) {
                    action = 'transferred';
                    let sourceName = t('activityLog.otherSource');
                    if (data.transferSourceEmployeeId) {
                        sourceName = getEmployeeName(data.transferSourceEmployeeId);
                    } else {
                        const match =
                            rawTaskName.match(/transferida de (.+?)\)/) ??
                            rawTaskName.match(/transferred from (.+?)\)/);
                        if (match) sourceName = match[1];
                    }
                    const recipientName = getEmployeeName(employeeId);
                    details = t('activityLog.details.receivedFrom', {
                        source: sourceName,
                        recipient: recipientName,
                        hours: data.hoursAssigned,
                    });
                } else if (data.distributionSourceAllocationId) {
                    action = 'distributed';
                    details = t('activityLog.details.distributionReceived', {
                        hours: data.hoursAssigned,
                    });
                } else if (data.parentAllocationId) {
                    action = 'continued';
                    details = t('activityLog.details.continuedFromPrevWeek', {
                        hours: data.hoursAssigned,
                    });
                } else {
                    action = 'created';
                    details = t('activityLog.details.createdFor', {
                        name: getEmployeeName(employeeId),
                        hours: data.hoursAssigned,
                    });
                }
            } else if (log.action === 'DELETE') {
                action = 'deleted';
                details = t('activityLog.details.deletedFrom', {
                    name: getEmployeeName(employeeId),
                });
            } else if (log.action === 'UPDATE') {
                if (newVal?.status === 'completed' && oldVal?.status !== 'completed') {
                    // Check if this task triggered a distribution (heuristic: was it completed with 0h or have we seen children?)
                    // Note: We can only confirm children later in the grouping phase, so we might need a post-processing step.
                    // However, we can use the '0h' heuristic or check if the user logged "Distribuidas" in comments (if we had access).
                    // For now, let's keep the redistributed check but rely on tree assembly to overwrite this if needed.
                    const isRedistributedCompletion = (newVal?.hoursActual || newVal?.hoursAssigned || 0) === 0;
                    action = isRedistributedCompletion ? 'distributed' : 'completed';
                    details = isRedistributedCompletion
                        ? t('activityLog.details.distributedToTeammates', {
                            name: getEmployeeName(employeeId),
                        })
                        : t('activityLog.details.completedBy', {
                            name: getEmployeeName(employeeId),
                            hours: newVal?.hoursActual || newVal?.hoursAssigned,
                        });
                } else if (oldVal?.employeeId !== newVal?.employeeId) {
                    action = 'transferred';
                    details = `${getEmployeeName(oldVal?.employeeId)} → ${getEmployeeName(newVal?.employeeId)}`;
                } else {
                    action = 'updated';
                    const changes: string[] = [];

                    // Cambio de horas asignadas
                    if (oldVal?.hoursAssigned !== newVal?.hoursAssigned) {
                        changes.push(t('activityLog.changes.hours', {
                            from: oldVal?.hoursAssigned ?? 0,
                            to: newVal?.hoursAssigned,
                        }));
                    }

                    // Cambio de semana
                    if (oldVal?.weekStartDate !== newVal?.weekStartDate) {
                        changes.push(t('activityLog.changes.week', {
                            from: getWeekNumber(oldVal?.weekStartDate),
                            to: getWeekNumber(newVal?.weekStartDate),
                        }));
                    }

                    // Cambio de proyecto
                    const projectChanged = oldVal?.projectId !== newVal?.projectId;
                    if (projectChanged) {
                        const oldProjectName = getProjectName(oldVal?.projectId);
                        const newProjectName = getProjectName(newVal?.projectId);
                        changes.push(t('activityLog.changes.project', {
                            from: oldProjectName,
                            to: newProjectName,
                        }));
                    }

                    // Cambio de nombre de tarea
                    if (oldVal?.taskName !== newVal?.taskName && newVal?.taskName) {
                        const oldName = String(oldVal?.taskName || t('activityLog.unnamedTask'));
                        const newName = String(newVal?.taskName);
                        changes.push(t('activityLog.changes.name', { from: oldName, to: newName }));
                    }

                    // Cambio de descripción
                    if (oldVal?.description !== newVal?.description) {
                        if (newVal?.description && !oldVal?.description) {
                            changes.push(t('activityLog.changes.descriptionAdded'));
                        } else if (!newVal?.description && oldVal?.description) {
                            changes.push(t('activityLog.changes.descriptionRemoved'));
                        } else if (newVal?.description) {
                            changes.push(t('activityLog.changes.descriptionModified'));
                        }
                    }

                    // Cambio de dependencia/bloqueo - Solo mostrar si realmente cambió el bloqueo
                    // y no es un efecto secundario de cambiar de proyecto (que resetea la dependencia)
                    if (oldVal?.dependencyId !== newVal?.dependencyId && !projectChanged) {
                        if (newVal?.dependencyId && !oldVal?.dependencyId) {
                            changes.push(t('activityLog.changes.blockAdded'));
                        } else if (!newVal?.dependencyId && oldVal?.dependencyId) {
                            changes.push(t('activityLog.changes.blockRemoved'));
                        } else if (newVal?.dependencyId && oldVal?.dependencyId) {
                            changes.push(t('activityLog.changes.blockChanged'));
                        }
                    }

                    // Cambio de prioridad
                    if (oldVal?.userPriority !== newVal?.userPriority) {
                        if (newVal?.userPriority !== null && newVal?.userPriority !== undefined) {
                            changes.push(t('activityLog.changes.priority', {
                                from: oldVal?.userPriority ?? '–',
                                to: newVal?.userPriority,
                            }));
                        } else if (oldVal?.userPriority !== null && oldVal?.userPriority !== undefined) {
                            changes.push(t('activityLog.changes.priorityRemoved'));
                        }
                    }

                    // Cambio de estado (que no sea a completada, eso ya se detecta arriba)
                    if (oldVal?.status !== newVal?.status && newVal?.status !== 'completed') {
                        changes.push(t('activityLog.changes.status', {
                            from: oldVal?.status || 'planned',
                            to: newVal?.status,
                        }));
                    }

                    // Cambio de horas actuales - SIEMPRE mostrar con valores
                    if (oldVal?.hoursActual !== newVal?.hoursActual) {
                        changes.push(t('activityLog.changes.actualHours', {
                            from: oldVal?.hoursActual ?? 0,
                            to: newVal?.hoursActual ?? 0,
                        }));
                    }

                    // Cambio de horas computadas - SIEMPRE mostrar con valores
                    if (oldVal?.hoursComputed !== newVal?.hoursComputed) {
                        changes.push(t('activityLog.changes.computedHours', {
                            from: oldVal?.hoursComputed ?? 0,
                            to: newVal?.hoursComputed ?? 0,
                        }));
                    }

                    // Fallback mejorado: detectar otros campos y mostrar valores si es posible
                    if (changes.length === 0) {
                        const oldKeys = Object.keys(oldVal || {});
                        const newKeys = Object.keys(newVal || {});
                        const allKeys = [...new Set([...oldKeys, ...newKeys])];

                        // Campos a ignorar en el fallback (ya procesados o internos)
                        const ignoredFields = ['id', 'created_at', 'updated_at', 'hoursAssigned', 'hoursActual',
                            'hoursComputed', 'weekStartDate', 'projectId', 'taskName', 'description',
                            'dependencyId', 'userPriority', 'status', 'employeeId'];

                        const changedFields = allKeys.filter(k =>
                            JSON.stringify((oldVal as any)?.[k]) !== JSON.stringify((newVal as any)?.[k])
                        ).filter(k => !ignoredFields.includes(k));

                        if (changedFields.length > 0) {
                            // Mostrar valores para campos conocidos
                            const detailedChanges = changedFields.map(field => {
                                const oldV = (oldVal as any)?.[field];
                                const newV = (newVal as any)?.[field];
                                // Si son valores simples (números, strings), mostrarlos
                                if (typeof oldV !== 'object' && typeof newV !== 'object') {
                                    return `${field}: ${oldV ?? '–'} → ${newV ?? '–'}`;
                                }
                                return field;
                            });
                            changes.push(t('activityLog.changes.other', {
                                fields: `${detailedChanges.slice(0, 3).join(', ')}${changedFields.length > 3 ? '...' : ''}`,
                            }));
                        } else {
                            changes.push(t('activityLog.changes.noDetectableChanges'));
                        }
                    }

                    details = changes.join(' | ');
                }
            }

            const weekNum = getWeekNumber(data.weekStartDate);
            const mod: Modification = {
                id: log.id,
                action,
                timestamp: log.created_at,
                employeeName: getEmployeeName(employeeId),
                employeeAvatar: getEmployeeAvatar(employeeId),
                hoursAssigned: Number(data.hoursAssigned) || 0,
                weekNum,
                details
            };

            node.modifications.push(mod);

            // Add participant
            if (!node.participants.find(p => p.name === mod.employeeName)) {
                node.participants.push({ name: mod.employeeName, avatar: mod.employeeAvatar });
            }

            // Update timestamps
            if (new Date(mod.timestamp) > new Date(node.latestTimestamp)) {
                node.latestTimestamp = mod.timestamp;
                node.latestAction = mod.action;
            }
        });

        // 4. Trace lineage for all known nodes
        const nodeIds = Array.from(nodes.keys());
        nodeIds.forEach(nodeId => {
            const parentId = findParentId(nodeId);
            if (!parentId) return;
            const pAlloc = allocations.find(a => a.id === parentId);
            if (selectedDepartmentId != null && deptEmployeeIds != null) {
                if (!pAlloc || !deptEmployeeIds.has(pAlloc.employeeId)) return;
                if (deptProjectIds != null && !deptProjectIds.has(pAlloc.projectId)) return;
            }
            parentLinks.set(nodeId, parentId);
            if (!nodes.has(parentId)) {
                const childAlloc = allocations.find(a => a.id === nodeId);
                const fallbackTaskName = childAlloc?.originalTransferredTaskName || pAlloc?.taskName || t('activityLog.defaultTask');

                getNode(parentId, pAlloc ? {
                    taskName: pAlloc.taskName || fallbackTaskName,
                    projectId: pAlloc.projectId,
                    projectName: getProjectName(pAlloc.projectId),
                    clientName: getClientName(pAlloc.projectId)
                } : {
                    taskName: fallbackTaskName,
                    projectId: childAlloc?.projectId || '',
                    projectName: childAlloc ? getProjectName(childAlloc.projectId) : '',
                    clientName: childAlloc ? getClientName(childAlloc.projectId) : ''
                });
            }
        });

        // 5. Assemble Tree with Deduplication
        const roots: TaskNode[] = [];
        nodes.forEach(node => {
            const parentId = parentLinks.get(node.id);
            if (parentId && nodes.has(parentId)) {
                const parent = nodes.get(parentId)!;

                // DEDUPLICATION LOGIC:
                // If child has same name as parent AND is effectively just a cleanup node (deleted/completed),
                // merge its logs into parent instead of nesting — except continuations / transfer / distribution lineage
                const isSameName = node.taskName.trim().toLowerCase() === parent.taskName.trim().toLowerCase();
                const structured = isStructuredLineageChild(node.id, parentId, allocations ?? [], logs);
                if (isSameName && !structured) {
                    parent.modifications.push(...node.modifications);
                    // Add participants
                    node.participants.forEach(p => {
                        if (!parent.participants.find(pp => pp.name === p.name)) parent.participants.push(p);
                    });
                    // Update latest info
                    if (new Date(node.latestTimestamp) > new Date(parent.latestTimestamp)) {
                        parent.latestTimestamp = node.latestTimestamp;
                        parent.latestAction = node.latestAction;
                    }
                    // Do NOT add as child
                } else {
                    parent.children.push(node);
                    node.parentId = parentId;
                }
            } else {
                roots.push(node);
            }
        });

        // Sort logs inside nodes and calculate ranges
        nodes.forEach(node => {
            // Updated Sort Order: ASCENDING (Oldest First) as per request "Como un libro"
            node.modifications.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            // Si hay hijos por redistribución real, el cierre del padre suele ser "distribuida" — no confundir con continuación semanal (parentAllocationId).
            const hasDistributedChild = node.children.some(child => {
                const a = allocations.find(x => x.id === child.id);
                if (a?.distributionSourceAllocationId === node.id) return true;
                return child.modifications.some(m => m.action === 'distributed');
            });
            if (node.children.length > 0 && hasDistributedChild) {
                const lastMod = node.modifications[node.modifications.length - 1];
                if (lastMod && (lastMod.action === 'completed' || lastMod.action === 'deleted')) {
                    lastMod.action = 'distributed';
                    lastMod.details = t('activityLog.details.distributedIntoSubtasks', {
                        count: node.children.length,
                    });
                }
            }

            node.children.sort((a, b) => new Date(a.latestTimestamp).getTime() - new Date(b.latestTimestamp).getTime());

            const weeks = [...new Set(node.modifications.map(m => m.weekNum).concat(
                node.children.flatMap(c => c.modifications.map(m => m.weekNum))
            ).filter(w => w > 0))].sort((a, b) => a - b);

            if (weeks.length > 1) node.weekRange = `S${weeks[0]} → S${weeks[weeks.length - 1]}`;
            else if (weeks.length === 1) node.weekRange = `S${weeks[0]}`;
        });

        // Sort roots by latest activity (deep)
        const getDeepLatest = (n: TaskNode): number => {
            let max = new Date(n.latestTimestamp).getTime();
            n.children.forEach(c => {
                const childMax = getDeepLatest(c);
                if (childMax > max) max = childMax;
            });
            return max;
        };

        return roots
            .filter(r => r.modifications.length > 0 || r.children.length > 0)
            .sort((a, b) => getDeepLatest(b) - getDeepLatest(a));
    }, [logs, allocations, filterEmployee, filterProject, employees, projects, clients, selectedDepartmentId, employeesForView, filteredProjectsForView, t]);

    // --- Group roots by project (filtro cierre semanal + búsqueda texto) ---
    const projectGroups = useMemo(() => {
        const rootsSrc = filterWeeklyOnly
            ? rootNodes.filter(r => treeTouchesWeeklyContinuation(r, allocations ?? []))
            : rootNodes;
        const groups = new Map<string, { projectName: string; clientName: string; nodes: TaskNode[] }>();
        rootsSrc.forEach(node => {
            const key = node.projectId || 'no-project';
            if (!groups.has(key)) {
                groups.set(key, { projectName: node.projectName, clientName: node.clientName, nodes: [] });
            }
            groups.get(key)!.nodes.push(node);
        });
        let list = Array.from(groups.entries()).map(([id, data]) => ({ projectId: id, ...data }));
        const q = searchQuery.trim();
        if (q) {
            list = list
                .map(g => ({
                    ...g,
                    nodes: g.nodes.filter(n => nodeMatchesSearchQuery(n, q, formatProjectName, allocations ?? [])),
                }))
                .filter(g => g.nodes.length > 0);
        }
        return list;
    }, [rootNodes, filterWeeklyOnly, allocations, searchQuery, formatProjectName]);

    const visibleRootCount = useMemo(
        () => projectGroups.reduce((sum, g) => sum + g.nodes.length, 0),
        [projectGroups],
    );

    // --- Recursive Node Renderer ---
    const toggleNode = (id: string) => {
        setExpandedNodes(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const getActionIcon = (action: Modification['action']) => {
        const iconClass = "h-3 w-3";
        switch (action) {
            case 'created': return <Plus className={`${iconClass} text-emerald-600`} />;
            case 'transferred': return <ArrowRight className={`${iconClass} text-purple-600`} />;
            case 'distributed': return <GitBranch className={`${iconClass} text-orange-600`} />;
            case 'continued': return <ArrowRight className={`${iconClass} text-blue-600`} />;
            case 'completed': return <CheckCircle2 className={`${iconClass} text-emerald-600`} />;
            case 'deleted': return <Trash2 className={`${iconClass} text-red-600`} />;
            default: return <Pencil className={`${iconClass} text-slate-600`} />;
        }
    };

    const getActionBadge = (action: Modification['action']) => {
        const styles: Record<string, string> = {
            created: 'bg-emerald-100 text-emerald-700',
            transferred: 'bg-purple-100 text-purple-700',
            distributed: 'bg-orange-100 text-orange-700',
            continued: 'bg-blue-100 text-blue-700',
            completed: 'bg-emerald-100 text-emerald-700',
            deleted: 'bg-red-100 text-red-700',
            updated: 'bg-slate-100 text-slate-700'
        };
        const labels: Record<string, string> = {
            created: t('activityLog.actions.created'),
            transferred: t('activityLog.actions.transferred'),
            distributed: t('activityLog.actions.distributed'),
            continued: t('activityLog.actions.continued'),
            completed: t('activityLog.actions.completed'),
            deleted: t('activityLog.actions.deleted'),
            updated: t('activityLog.actions.updated'),
        };
        return <Badge className={cn('text-[9px] px-1.5 py-0', styles[action])}>{labels[action]}</Badge>;
    };

    const TaskNodeRenderer = ({ node, level = 0 }: { node: TaskNode, level?: number }) => {
        const isOpen = expandedNodes.has(node.id);
        const hasContent = node.modifications.length > 0 || node.children.length > 0;

        // Clean task name of artifacts
        const displayTaskName = node.taskName
            .replace(/\s*\((?:transferida de|transferred from) .+\)/, '')
            .replace(/\s*\((?:continuación|continuation)\)/, '');

        return (
            <Collapsible open={isOpen} onOpenChange={() => toggleNode(node.id)} className="w-full">
                <div className={cn("relative flex flex-col", level > 0 && "ml-4 mt-2")}>
                    {/* Connecting line for children */}
                    {level > 0 && (
                        <div className="absolute -left-4 top-3 w-4 h-4 border-b-2 border-l-2 border-slate-200 rounded-bl-lg -z-10" />
                    )}

                    <CollapsibleTrigger className="w-full text-left filter hover:brightness-95 transition-all">
                        <div className={cn(
                            "flex items-center gap-2 p-2 rounded-lg border",
                            level === 0 ? "bg-slate-50 border-slate-100" : "bg-white border-slate-200 shadow-sm"
                        )}>
                            {hasContent ? (
                                isOpen ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                            ) : <div className="w-3.5" />}

                            {/* Participants */}
                            <div className="flex -space-x-1 shrink-0">
                                {node.modifications.slice(0, 1).map((m, i) => (
                                    <Avatar key={i} className="h-5 w-5 border border-white">
                                        <AvatarImage src={m.employeeAvatar} />
                                        <AvatarFallback className="text-[8px] bg-slate-500 text-white">
                                            {m.employeeName.slice(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                ))}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className={cn("truncate", level === 0 ? "font-medium text-xs" : "font-normal text-xs text-slate-700")}>
                                        {displayTaskName}
                                    </span>
                                    {getActionBadge(node.latestAction)}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                    {t('activityLog.eventsCount', { count: node.modifications.length })}
                                    {node.children.length > 0 &&
                                        t('activityLog.subTasksCount', { count: node.children.length })}
                                    {node.weekRange && ` · ${node.weekRange}`}
                                </div>
                            </div>

                            <span className="text-[10px] text-slate-400 shrink-0">
                                {formatDistanceToNow(parseISO(node.latestTimestamp), { addSuffix: true, locale: dateLocale })}
                            </span>
                        </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                        <div className="pl-4 border-l-2 border-slate-100 ml-2 space-y-1 py-1">
                            {/* Modifications Timeline */}
                            {node.modifications.map(mod => (
                                <div key={mod.id} className="relative flex items-start gap-2 py-1 group">
                                    <div className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full border border-slate-300 bg-white" />

                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <div className="bg-slate-100 w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                                            {getActionIcon(mod.action)}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[11px] text-slate-700 leading-tight">{mod.details}</p>
                                            <p className="text-[9px] text-slate-400">
                                                S{mod.weekNum} · {format(parseISO(mod.timestamp), "HH:mm dd/MM", { locale: dateLocale })}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Recursive Children */}
                            {node.children.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-slate-100">
                                    <div className="text-[10px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                                        <CornerDownRight className="h-3 w-3" />{' '}
                                        {t('weeklyForecast.activityRelatedBranches')}
                                    </div>
                                    {node.children.map(child => (
                                        <TaskNodeRenderer key={child.id} node={child} level={level + 1} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </CollapsibleContent>
                </div>
            </Collapsible>
        );
    };

    if (error) {
        return (
            <Card className="border-amber-200 bg-amber-50">
                <CardContent className="py-6 text-center">
                    <Activity className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                    <p className="text-amber-800 font-medium text-sm">{error}</p>
                </CardContent>
            </Card>
        );
    }

    const viewMonthForEmployees = currentMonth ?? startOfMonth(new Date());
    const employeeScope = selectedDepartmentId ? employeesForView : (employees ?? []);
    const activeEmployees = filterEmployeesForOperationalMonthDate(employeeScope, viewMonthForEmployees, {
      deadlines: [],
      globalAssignments: [],
      allocations: allocations ?? [],
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const activeProjects = (selectedDepartmentId ? filteredProjectsForView : (projects ?? [])).filter(p => p.status === 'active').sort((a, b) => a.name.localeCompare(b.name));

    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary" />
                            {t('weeklyForecast.activityLogTitle', 'Historial de cambios')}
                            {!isLoading && (
                                <Badge variant="outline" className="text-xs">
                                    {t('weeklyForecast.activityRootCount', {
                                        count: visibleRootCount,
                                        defaultValue: '{{count}} raíces',
                                    })}
                                </Badge>
                            )}
                        </CardTitle>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 self-end sm:self-auto" onClick={() => window.location.reload()}>
                            <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                    <div className="flex flex-col gap-2 w-full min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative min-w-[200px] flex-1 sm:flex-initial sm:min-w-[220px] max-w-full">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                <Input
                                    placeholder={t('operationsRadar.searchPlaceholder')}
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="pl-9 h-10"
                                    aria-label={t('operationsRadar.searchAria')}
                                />
                            </div>
                            <Popover open={openFilterProject} onOpenChange={setOpenFilterProject}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="min-w-[220px] h-10 text-sm justify-between font-normal w-full sm:w-auto">
                                        <span className="truncate flex items-center gap-1.5">
                                            <FolderOpen className="h-3.5 w-3.5 shrink-0 opacity-70" />
                                            {filterProject === 'all' ? (
                                                t('weeklyForecast.allProjects', 'Todos los proyectos')
                                            ) : (
                                                <SensitiveText kind="project" id={filterProject}>
                                                    {formatProjectName(activeProjects.find(p => p.id === filterProject)?.name ?? '')}
                                                </SensitiveText>
                                            )}
                                        </span>
                                        <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="min-w-[300px] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder={t('weeklyForecast.searchProjectPlaceholder', 'Buscar proyecto...')} />
                                        <CommandList className="max-h-[320px]">
                                            <CommandEmpty>{t('weeklyForecast.noProjectsFound', 'No se encontraron proyectos.')}</CommandEmpty>
                                            <CommandGroup>
                                                <CommandItem
                                                    value={t('weeklyForecast.allProjects', 'Todos los proyectos')}
                                                    className="py-2.5"
                                                    onSelect={() => {
                                                        setFilterProject('all');
                                                        setOpenFilterProject(false);
                                                    }}
                                                >
                                                    <Check className={cn('mr-2 h-4 w-4 shrink-0', filterProject === 'all' ? 'opacity-100' : 'opacity-0')} />
                                                    {t('weeklyForecast.allProjects', 'Todos los proyectos')}
                                                </CommandItem>
                                                {activeProjects.map(p => (
                                                    <CommandItem
                                                        key={p.id}
                                                        value={formatProjectName(p.name || '')}
                                                        className="py-2.5"
                                                        onSelect={() => {
                                                            setFilterProject(p.id);
                                                            setOpenFilterProject(false);
                                                        }}
                                                    >
                                                        <Check className={cn('mr-2 h-4 w-4 shrink-0', filterProject === p.id ? 'opacity-100' : 'opacity-0')} />
                                                        <span className="truncate">
                                                            <SensitiveText kind="project" id={p.id}>{formatProjectName(p.name)}</SensitiveText>
                                                        </span>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            <Popover open={openFilterEmployee} onOpenChange={setOpenFilterEmployee}>
                                <PopoverTrigger asChild>
                                    <div
                                        className="relative min-w-[220px] flex-1 sm:flex-initial max-w-full cursor-pointer"
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setOpenFilterEmployee(true)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                setOpenFilterEmployee(true);
                                            }
                                        }}
                                    >
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                        <Input
                                            readOnly
                                            value={
                                                filterEmployee === 'all'
                                                    ? ''
                                                    : isPrivacyDemo
                                                      ? privacyAnonymizer.employee(filterEmployee)
                                                      : employees?.find(e => e.id === filterEmployee)?.name ?? ''
                                            }
                                            placeholder={t('operationsRadar.coherenceEmployeeFilterPlaceholder')}
                                            className="pl-9 pr-9 h-10 cursor-pointer bg-background"
                                            aria-label={t('operationsRadar.coherenceEmployeeFilterAria')}
                                        />
                                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                    </div>
                                </PopoverTrigger>
                                <PopoverContent className="min-w-[300px] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder={t('weeklyForecast.searchEmployeePlaceholder', 'Buscar empleado...')} />
                                        <CommandList className="max-h-[320px]">
                                            <CommandEmpty>{t('weeklyForecast.noEmployeesFound', 'No se encontraron empleados.')}</CommandEmpty>
                                            <CommandGroup>
                                                <CommandItem
                                                    value="Todos"
                                                    onSelect={() => {
                                                        setFilterEmployee('all');
                                                        setOpenFilterEmployee(false);
                                                    }}
                                                >
                                                    <Check className={cn('mr-2 h-4 w-4 shrink-0', filterEmployee === 'all' ? 'opacity-100' : 'opacity-0')} />
                                                    {t('weeklyForecast.allEmployees', 'Todos')}
                                                </CommandItem>
                                                {activeEmployees.map(e => (
                                                    <CommandItem
                                                        key={e.id}
                                                        value={e.name || ''}
                                                        onSelect={() => {
                                                            setFilterEmployee(e.id);
                                                            setOpenFilterEmployee(false);
                                                        }}
                                                    >
                                                        <Check className={cn('mr-2 h-4 w-4 shrink-0', filterEmployee === e.id ? 'opacity-100' : 'opacity-0')} />
                                                        <SensitiveText kind="employee" id={e.id}>{e.name}</SensitiveText>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            <Button
                                type="button"
                                variant={filterWeeklyOnly ? 'default' : 'outline'}
                                size="sm"
                                className="h-10 gap-1.5 shrink-0"
                                onClick={() => setFilterWeeklyOnly(v => !v)}
                                aria-pressed={filterWeeklyOnly}
                            >
                                <CalendarSync className="h-4 w-4" />
                                {t('weeklyForecast.weeklyOnlyToggle', 'Solo cierre semanal')}
                            </Button>
                        </div>
                        {logsTruncated && (
                            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                {t('weeklyForecast.logsTruncatedHint', {
                                    max: AUDIT_LOG_MAX_TOTAL,
                                })}
                            </p>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-6 gap-2">
                        <RefreshCw className="h-5 w-5 animate-spin text-slate-400" />
                        {loadedLogCount > 0 && (
                            <p className="text-xs text-slate-500">
                                {t('weeklyForecast.logsLoadingProgress', { count: loadedLogCount })}
                            </p>
                        )}
                    </div>
                ) : projectGroups.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-sm">
                        <Clock className="h-6 w-6 mx-auto mb-1.5 opacity-50" />
                        <p>{t('activityLog.noChanges')}</p>
                        {filterWeeklyOnly && rootNodes.length > 0 && (
                            <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto">
                                {t('weeklyForecast.weeklyOnlyEmptyHint')}
                            </p>
                        )}
                    </div>
                ) : (
                    <ScrollArea className="h-[500px] pr-2">
                        <div className="space-y-4">
                            {projectGroups.map(group => (
                                <div key={group.projectId} className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700 pb-1 border-b bg-slate-50/50 p-1 rounded-t">
                                        <FolderOpen className="h-3.5 w-3.5 text-primary" />
                                        {group.projectName}
                                        {group.clientName && <span className="text-[10px] text-slate-500">({group.clientName})</span>}
                                    </div>
                                    <div className="space-y-2 pl-1">
                                        {group.nodes.map(node => (
                                            <TaskNodeRenderer key={node.id} node={node} />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </CardContent>
        </Card>
    );
}
