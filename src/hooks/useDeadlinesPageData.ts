/**
 * Hook de datos para DeadlinesPage: carga de deadlines y global_assignments,
 * suscripción Realtime, locks de edición, proyectos filtrados/agrupados y capacidad.
 * Usado solo por DeadlinesPage. Expone broadcastChannelRef para que la página envíe lock-released.
 */

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { toast } from '@/lib/notify';
import { supabase } from '@/lib/supabase';
import { fetchGlobalAssignmentsForMonth } from '@/utils/globalAssignmentsUtils';
import { Deadline, GlobalAssignment, Project, Client, Employee, Absence, TeamEvent, Allocation, Agency } from '@/types';
import {
  filterEmployeesForDeadlinesMonth,
  employeeIdsWithDeadlineProjectHoursInMonth,
} from '@/utils/employeeAssignmentVisibility';
import { getEffectiveBudget } from '@/utils/budgetUtils';
import { fetchDeadlinesForMonth } from '@/utils/deadlineUtils';
import { matchesAliasingRule } from '@/lib/utils';
import { getDaysInMonth, startOfMonth, endOfMonth } from 'date-fns';
import { getAbsenceHoursInRange } from '@/utils/absenceUtils';
import { getTeamEventHoursInRange, getTeamEventDetailsInRange } from '@/utils/teamEventUtils';
import type { DeadlinesFiltersValues } from '@/components/deadlines/DeadlinesFilters';

const PERF_DEBUG = import.meta.env.DEV;
const perfNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const logPerf = (label: string, start: number, meta?: unknown) => {
  if (!PERF_DEBUG) return;
  const ms = perfNow() - start;
  if (meta !== undefined) {
    console.debug(`[perf][deadlines] ${label}: ${ms.toFixed(1)}ms`, meta);
  } else {
    console.debug(`[perf][deadlines] ${label}: ${ms.toFixed(1)}ms`);
  }
};

export type EditingLock = {
  employeeId: string;
  employeeName: string;
  lockedAt: string;
  /** ISO; permite podar badges locales sin esperar Realtime. */
  expiresAt: string;
};

function pruneExpiredEditingLocks(
  prev: Record<string, EditingLock>,
  nowMs = Date.now()
): Record<string, EditingLock> {
  let changed = false;
  const next: Record<string, EditingLock> = {};
  for (const [projectId, lock] of Object.entries(prev)) {
    if (new Date(lock.expiresAt).getTime() > nowMs) {
      next[projectId] = lock;
    } else {
      changed = true;
    }
  }
  return changed ? next : prev;
}

export type MonthlyCapacityResult = {
  total: number;
  absenceHours: number;
  eventHours: number;
  available: number;
  absenceDetails: { type: string; startDate: string; endDate: string; hours: number }[];
  eventDetails: { name: string; hours: number }[];
};

export interface UseDeadlinesPageDataParams {
  selectedMonth: string;
  currentAgency: Pick<Agency, 'id' | 'settings'> | null;
  projects: Project[];
  clients: Client[];
  employees: Employee[] | null;
  employeesForView: Employee[];
  /** Allocations cargadas en App (mes en contexto); para listar inactivos con planificación efectiva en el mes. */
  allocations: Allocation[];
  absences: Absence[];
  teamEvents: TeamEvent[];
  currentUser: { id: string } | null;
  filterSnapshot: DeadlinesFiltersValues;
  filterProject: (project: Project, filterId: string) => boolean;
  /** Proyecto en edición local: no sobrescribir su deadline con Realtime hasta cerrar. */
  editingProjectIdRef?: React.MutableRefObject<string | null>;
}

export function useDeadlinesPageData(params: UseDeadlinesPageDataParams) {
  const {
    selectedMonth,
    currentAgency,
    projects,
    clients,
    employees,
    employeesForView,
    allocations,
    absences,
    teamEvents,
    currentUser,
    filterSnapshot,
    filterProject,
    editingProjectIdRef,
  } = params;

  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [globalAssignments, setGlobalAssignments] = useState<GlobalAssignment[]>([]);
  const [hiddenProjects, setHiddenProjects] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [editingLocks, setEditingLocks] = useState<Record<string, EditingLock>>({});

  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lockCleanupIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadDeadlines = async () => {
    const t0 = perfNow();
    setIsLoading(true);
    try {
      const { data, error } = await fetchDeadlinesForMonth(selectedMonth, currentAgency?.id);
      if (error) throw error;

      if (data && data.length > 0) {
        setDeadlines(data);
        const hidden = new Set<string>();
        data.forEach((d) => {
          if (d.isHidden) hidden.add(d.projectId);
        });
        setHiddenProjects(hidden);
      } else {
        setDeadlines([]);
        setHiddenProjects(new Set());
      }
    } catch (error) {
      console.error('Error cargando deadlines:', error);
      toast.error((error as Error)?.message || 'Error al cargar deadlines');
    } finally {
      setIsLoading(false);
      logPerf('loadDeadlines', t0, { month: selectedMonth });
    }
  };

  const loadGlobalAssignments = async () => {
    const t0 = perfNow();
    try {
      const { data, error } = await fetchGlobalAssignmentsForMonth(selectedMonth, currentAgency?.id);
      if (error) throw error;
      setGlobalAssignments(data);
    } catch (error) {
      console.error('Error cargando asignaciones globales:', error);
    } finally {
      logPerf('loadGlobalAssignments', t0, { month: selectedMonth });
    }
  };

  useEffect(() => {
    loadDeadlines();
    loadGlobalAssignments();

    const cleanupMyLocks = async () => {
      if (currentUser) {
        try {
          await supabase
            .from('project_editing_locks')
            .delete()
            .eq('employee_id', currentUser.id)
            .eq('month', selectedMonth);
        } catch (error) {
          console.error('Error limpiando locks al cargar:', error);
        }
      }
    };
    cleanupMyLocks();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on month/agency/user only; loaders are stable enough for this scope
  }, [selectedMonth, currentUser?.id, currentAgency?.id]);

  useEffect(() => {
    if (!selectedMonth || !currentAgency) return;

    const channelName = `deadlines-room-${currentAgency.id}-${selectedMonth}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deadlines', filter: `month=eq.${selectedMonth}` },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newDeadline = payload.new as Record<string, unknown>;
            const projectId = newDeadline.project_id as string;
            if (!projects.find((p) => p.id === projectId)) return;
            if (editingProjectIdRef?.current === projectId) return;

            setDeadlines((prev) => {
              const existing = prev.find((d) => d.id === newDeadline.id);
              if (existing) {
                return prev.map((d) =>
                  d.id === newDeadline.id
                    ? {
                        id: newDeadline.id as string,
                        projectId: newDeadline.project_id as string,
                        month: newDeadline.month as string,
                        notes: newDeadline.notes as string | undefined,
                        employeeHours: (newDeadline.employee_hours as Record<string, number>) || {},
                        isHidden: (newDeadline.is_hidden as boolean) || false,
                        budgetOverride: newDeadline.budget_override as number | undefined,
                      }
                    : d
                );
              }
              return [
                ...prev,
                {
                  id: newDeadline.id as string,
                  projectId: newDeadline.project_id as string,
                  month: newDeadline.month as string,
                  notes: newDeadline.notes as string | undefined,
                  employeeHours: (newDeadline.employee_hours as Record<string, number>) || {},
                  isHidden: (newDeadline.is_hidden as boolean) || false,
                  budgetOverride: newDeadline.budget_override as number | undefined,
                },
              ];
            });

            if (newDeadline.is_hidden) {
              setHiddenProjects((prev) => new Set([...prev, newDeadline.project_id as string]));
            } else {
              setHiddenProjects((prev) => {
                const next = new Set(prev);
                next.delete(newDeadline.project_id as string);
                return next;
              });
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id;
            setDeadlines((prev) => prev.filter((d) => d.id !== deletedId));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'global_assignments',
          filter: `month=eq.${selectedMonth}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const payloadNew = payload.new as Record<string, unknown>;
            if (payloadNew.agency_id && payloadNew.agency_id !== currentAgency.id) return;

            const newAssignment = payload.new as {
              id: string;
              name: string;
              hours: number;
              affects_all: boolean;
              affected_employee_ids?: string[];
              month: string;
              employee_id?: string;
              created_by?: string;
            };
            setGlobalAssignments((prev) => {
              const existing = prev.find((a) => a.id === newAssignment.id);
              if (existing) {
                return prev.map((a) =>
                  a.id === newAssignment.id
                    ? {
                        id: newAssignment.id,
                        name: newAssignment.name,
                        hours: newAssignment.hours,
                        affectsAll: newAssignment.affects_all,
                        affectedEmployeeIds: (newAssignment.affected_employee_ids || []) as string[],
                        month: newAssignment.month,
                        employeeId: newAssignment.employee_id || newAssignment.created_by,
                      }
                    : a
                );
              }
              return [
                ...prev,
                {
                  id: newAssignment.id,
                  name: newAssignment.name,
                  hours: newAssignment.hours,
                  affectsAll: newAssignment.affects_all,
                  affectedEmployeeIds: (newAssignment.affected_employee_ids || []) as string[],
                  month: newAssignment.month,
                  employeeId: newAssignment.employee_id || newAssignment.created_by,
                },
              ];
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id;
            setGlobalAssignments((prev) => prev.filter((a) => a.id !== deletedId));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_editing_locks',
          filter: `month=eq.${selectedMonth}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldLock = payload.old as { project_id?: string; employee_id?: string };
            const projectId = oldLock.project_id;
            if (!projectId) return;
            setEditingLocks((prev) => {
              const existing = prev[projectId];
              if (!existing) return prev;
              if (oldLock.employee_id && existing.employeeId !== oldLock.employee_id) return prev;
              const next = { ...prev };
              delete next[projectId];
              return next;
            });
            return;
          }

          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const lock = payload.new as {
              employee_id: string;
              project_id: string;
              expires_at: string;
              locked_at: string;
            };
            const isActive = lock.expires_at > new Date().toISOString();
            if (!isActive || lock.employee_id === currentUser?.id) {
              setEditingLocks((prev) => {
                if (!prev[lock.project_id]) return prev;
                if (prev[lock.project_id].employeeId !== lock.employee_id && isActive) return prev;
                const next = { ...prev };
                delete next[lock.project_id];
                return next;
              });
              return;
            }
            const employee = (employees ?? []).find((e) => e.id === lock.employee_id);
            setEditingLocks((prev) => ({
              ...prev,
              [lock.project_id]: {
                employeeId: lock.employee_id,
                employeeName: employee?.first_name || employee?.name || 'Alguien',
                lockedAt: lock.locked_at,
                expiresAt: lock.expires_at,
              },
            }));
          }
        }
      )
      .on('broadcast', { event: 'lock-released' }, (payload) => {
        const { projectIds, employeeId } = payload.payload as { projectIds: string[]; employeeId: string };
        if (employeeId !== currentUser?.id && projectIds?.length > 0) {
          setEditingLocks((prev) => {
            const newLocks = { ...prev };
            projectIds.forEach((projectId) => {
              if (newLocks[projectId]?.employeeId === employeeId) delete newLocks[projectId];
            });
            return newLocks;
          });
        }
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error(`❌ Error en suscripción Realtime (${channelName})`);
        }
      });

    broadcastChannelRef.current = channel;
    return () => {
      broadcastChannelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [selectedMonth, currentAgency, projects, currentUser?.id, employees, editingProjectIdRef]);

  useEffect(() => {
    const loadEditingLocks = async () => {
      try {
        const { data, error } = await supabase
          .from('project_editing_locks')
          .select('*')
          .eq('month', selectedMonth)
          .gt('expires_at', new Date().toISOString());

        if (error) throw error;

        if (data) {
          const locksMap: Record<string, EditingLock> = {};
          data.forEach(
            (lock: {
              employee_id: string;
              project_id: string;
              expires_at: string;
              locked_at: string;
            }) => {
              if (lock.employee_id === currentUser?.id) return;
              if (!(lock.expires_at > new Date().toISOString())) return;
              const employee = (employees ?? []).find((e) => e.id === lock.employee_id);
              locksMap[lock.project_id] = {
                employeeId: lock.employee_id,
                employeeName: employee?.first_name || employee?.name || 'Alguien',
                lockedAt: lock.locked_at,
                expiresAt: lock.expires_at,
              };
            }
          );
          setEditingLocks(locksMap);
        }
      } catch (error) {
        console.error('Error cargando locks:', error);
      }
    };
    loadEditingLocks();
  }, [selectedMonth, employees, currentUser?.id]);

  useEffect(() => {
    const cleanupOrphanedLocks = async () => {
      try {
        await supabase
          .from('project_editing_locks')
          .delete()
          .lt('expires_at', new Date().toISOString());
      } catch (error) {
        console.error('Error en limpieza de locks:', error);
      }
      setEditingLocks((prev) => pruneExpiredEditingLocks(prev));
    };
    cleanupOrphanedLocks();
    lockCleanupIntervalRef.current = setInterval(cleanupOrphanedLocks, 30 * 1000);
    return () => {
      if (lockCleanupIntervalRef.current) clearInterval(lockCleanupIntervalRef.current);
    };
  }, []);

  const activeEmployees = useMemo(() => {
    const list = filterEmployeesForDeadlinesMonth(
      employeesForView,
      selectedMonth,
      deadlines,
      hiddenProjects
    );
    return list.sort((a, b) => (a.first_name || a.name).localeCompare(b.first_name || b.name));
  }, [employeesForView, selectedMonth, deadlines, hiddenProjects]);

  /** Solo filas/avatares en vista lectura: quienes tienen horas en algún proyecto este mes (sin globales). */
  const employeesForProjectDisplay = useMemo(() => {
    const withProjectHours = employeeIdsWithDeadlineProjectHoursInMonth(
      selectedMonth,
      deadlines,
      hiddenProjects
    );
    return activeEmployees.filter((e) => withProjectHours.has(e.id));
  }, [activeEmployees, selectedMonth, deadlines, hiddenProjects]);

  const emptyCapacity: MonthlyCapacityResult = useMemo(
    () => ({
      total: 0,
      absenceHours: 0,
      eventHours: 0,
      available: 0,
      absenceDetails: [],
      eventDetails: [],
    }),
    []
  );

  const monthlyCapacityByEmployee = useMemo(() => {
    const map = new Map<string, MonthlyCapacityResult>();
    const staff = employees ?? [];
    if (staff.length === 0) return map;

    const [year, month] = selectedMonth.split('-').map(Number);
    const monthStart = startOfMonth(new Date(year, month - 1));
    const monthEnd = endOfMonth(new Date(year, month - 1));
    const daysInMonth = getDaysInMonth(new Date(year, month - 1));

    const absencesByEmployee = new Map<string, Absence[]>();
    absences.forEach((a) => {
      const list = absencesByEmployee.get(a.employeeId) ?? [];
      list.push(a);
      absencesByEmployee.set(a.employeeId, list);
    });

    for (const employee of staff) {
      const workSchedule = employee.workSchedule;

      let baseHours = 0;
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const dayOfWeek = date.getDay();
        const dayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayOfWeek];
        baseHours += workSchedule[dayKey as keyof typeof workSchedule] || 0;
      }

      const employeeAbsences = absencesByEmployee.get(employee.id) ?? [];
      const absenceHours = getAbsenceHoursInRange(monthStart, monthEnd, employeeAbsences, workSchedule);

      const absenceDetails = employeeAbsences
        .filter((a) => {
          const start = new Date(a.startDate);
          const end = new Date(a.endDate);
          return start <= monthEnd && end >= monthStart;
        })
        .map((a) => ({
          type: a.type,
          startDate: a.startDate,
          endDate: a.endDate,
          hours: getAbsenceHoursInRange(monthStart, monthEnd, [a], workSchedule),
        }))
        .filter((a) => a.hours > 0);

      const eventHours = getTeamEventHoursInRange(
        monthStart,
        monthEnd,
        employee.id,
        teamEvents,
        workSchedule,
        employeeAbsences
      );
      const eventDetailsRaw = getTeamEventDetailsInRange(
        monthStart,
        monthEnd,
        employee.id,
        teamEvents,
        workSchedule,
        employeeAbsences
      );
      const eventDetails = eventDetailsRaw.map((e) => ({ name: e.name, hours: e.hours }));
      const available = Math.max(0, baseHours - absenceHours - eventHours);

      map.set(employee.id, { total: baseHours, absenceHours, eventHours, available, absenceDetails, eventDetails });
    }

    return map;
  }, [employees, selectedMonth, absences, teamEvents]);

  const assignedHoursByEmployee = useMemo(() => {
    const totals = new Map<string, number>();
    const add = (employeeId: string, hours: number) => {
      if (!employeeId || !Number.isFinite(hours) || hours === 0) return;
      totals.set(employeeId, (totals.get(employeeId) ?? 0) + hours);
    };

    const projectStatusById = new Map(projects.map((p) => [p.id, p.status]));

    deadlines.forEach((deadline) => {
      if (hiddenProjects.has(deadline.projectId) || deadline.isHidden) return;
      // Proyectos cerrados/archivados no deben cargar capacidad aunque quede deadline huérfano.
      if (projectStatusById.get(deadline.projectId) !== 'active') return;
      Object.entries(deadline.employeeHours ?? {}).forEach(([employeeId, raw]) => {
        add(employeeId, Number(raw) || 0);
      });
    });

    const allVisibleEmployeeIds = employeesForView.map((e) => e.id);
    globalAssignments.forEach((assignment) => {
      const hours = Number(assignment.hours) || 0;
      if (hours === 0) return;
      if (assignment.affectsAll) {
        allVisibleEmployeeIds.forEach((id) => add(id, hours));
      } else {
        (assignment.affectedEmployeeIds ?? []).forEach((id) => add(id, hours));
      }
    });

    return totals;
  }, [deadlines, hiddenProjects, globalAssignments, employeesForView, projects]);

  const getMonthlyCapacity = useCallback(
    (employeeId: string): MonthlyCapacityResult => monthlyCapacityByEmployee.get(employeeId) ?? emptyCapacity,
    [monthlyCapacityByEmployee, emptyCapacity]
  );

  const getEmployeeAssignedHours = useCallback(
    (employeeId: string) => assignedHoursByEmployee.get(employeeId) ?? 0,
    [assignedHoursByEmployee]
  );

  const filteredProjects = useMemo(() => {
    const { searchTerm, filterId, showHidden, showUnassignedOnly, filterByEmployee, sortBy } =
      filterSnapshot;
    const deadlineProjectIds = new Set(
      deadlines.filter((d) => d.month === selectedMonth).map((d) => d.projectId)
    );
    // Activos + no activos que ya tienen deadline este mes (huérfanos editables / borrables).
    let filtered = projects.filter(
      (p) => p.status === 'active' || deadlineProjectIds.has(p.id)
    );

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((p) => {
        const client = clients.find((c) => c.id === p.clientId);
        return (
          p.name.toLowerCase().includes(term) || client?.name.toLowerCase().includes(term)
        );
      });
    }

    if (filterId !== 'all') {
      filtered = filtered.filter((p) => filterProject(p, filterId));
    }

    if (!showHidden) {
      filtered = filtered.filter((p) => !hiddenProjects.has(p.id));
    }

    if (filterByEmployee !== 'all') {
      filtered = filtered.filter((p) => {
        const deadline = deadlines.find((d) => d.projectId === p.id && d.month === selectedMonth);
        return deadline && (deadline.employeeHours[filterByEmployee] || 0) > 0;
      });
    }

    if (showUnassignedOnly) {
      filtered = filtered.filter((p) => {
        const deadline = deadlines.find((d) => d.projectId === p.id && d.month === selectedMonth);
        if (!deadline) return true;
        const totalAssigned = (Object.values(deadline.employeeHours) as number[]).reduce(
          (s, h) => s + (h || 0),
          0
        );
        return totalAssigned === 0;
      });
    }

    filtered.sort((a, b) => {
      if (sortBy === 'client') {
        const clientA = clients.find((c) => c.id === a.clientId)?.name || '';
        const clientB = clients.find((c) => c.id === b.clientId)?.name || '';
        return clientA.localeCompare(clientB);
      }
      if (sortBy === 'assigned') {
        const deadlineA = deadlines.find((d) => d.projectId === a.id && d.month === selectedMonth);
        const deadlineB = deadlines.find((d) => d.projectId === b.id && d.month === selectedMonth);
        const totalA = deadlineA
          ? (Object.values(deadlineA.employeeHours) as number[]).reduce((s, h) => s + (h || 0), 0)
          : 0;
        const totalB = deadlineB
          ? (Object.values(deadlineB.employeeHours) as number[]).reduce((s, h) => s + (h || 0), 0)
          : 0;
        return totalB - totalA;
      }
      const deadlineA = deadlines.find((d) => d.projectId === a.id && d.month === selectedMonth);
      const deadlineB = deadlines.find((d) => d.projectId === b.id && d.month === selectedMonth);
      const assignedA = deadlineA
        ? (Object.values(deadlineA.employeeHours) as number[]).reduce((s, h) => s + (h || 0), 0)
        : 0;
      const assignedB = deadlineB
        ? (Object.values(deadlineB.employeeHours) as number[]).reduce((s, h) => s + (h || 0), 0)
        : 0;
      const remainingA = getEffectiveBudget(a, deadlineA) - assignedA;
      const remainingB = getEffectiveBudget(b, deadlineB) - assignedB;
      return remainingB - remainingA;
    });

    return filtered;
  }, [
    projects,
    clients,
    filterSnapshot,
    hiddenProjects,
    deadlines,
    selectedMonth,
    filterProject,
  ]);

  const projectsByClient = useMemo(() => {
    const grouped: Record<string, Project[]> = {};
    const aliasingRules = currentAgency?.settings?.projectAliasingRules || [];

    filteredProjects.forEach((project) => {
      const matchedRule = matchesAliasingRule(project.name, aliasingRules);
      const clientId =
        matchedRule && matchedRule.groupAsVirtualClient
          ? matchedRule.id
          : (project.clientId || 'sin-cliente');

      if (!grouped[clientId]) grouped[clientId] = [];
      grouped[clientId].push(project);
    });

    return grouped;
  }, [filteredProjects, currentAgency?.settings?.projectAliasingRules]);

  const getProjectDeadline = (projectId: string) =>
    deadlines.find((d) => d.projectId === projectId && d.month === selectedMonth);

  const getTotalHours = (deadline: Deadline) =>
    Object.values(deadline.employeeHours).reduce((sum, hours) => sum + hours, 0);

  return {
    deadlines,
    setDeadlines,
    globalAssignments,
    setGlobalAssignments,
    hiddenProjects,
    setHiddenProjects,
    isLoading,
    setIsLoading,
    editingLocks,
    setEditingLocks,
    activeEmployees,
    employeesForProjectDisplay,
    filteredProjects,
    projectsByClient,
    getMonthlyCapacity,
    getEmployeeAssignedHours,
    getProjectDeadline,
    getTotalHours,
    loadDeadlines,
    loadGlobalAssignments,
    broadcastChannelRef,
  };
}
