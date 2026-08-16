import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Employee, Client, Project, Allocation, LoadStatus, Absence, TeamEvent, WeeklyFeedback, EmployeeRole, WorkSchedule, UserRoutine, TaskTransfer } from '@/types';
import { getWorkingDaysInRange, getMonthlyCapacity, getWeeksForMonth, getStorageKey, isAllocationInEffectiveMonth } from '@/utils/dateUtils';
import { getAbsenceHoursInRange } from '@/utils/absenceUtils';
import { getTeamEventHoursInRange, getTeamEventDetailsInRange } from '@/utils/teamEventUtils';
import { getCapacityReductionBreakdown } from '@/utils/capacityUtils';
import { addDays, format, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns';
import {
  computeClientTotalHoursForMonth,
  computeEmployeeLoadForWeek,
  computeEmployeeMonthlyLoad,
  computeProjectHoursForMonth,
} from '@/utils/appMetrics';
import {
  ensureProjectsLoaded,
  fetchInitialAppData,
  loadMonthData,
  mapSupabaseProjectRow,
} from '@/utils/appDataLoader';
import { round2 } from '@/utils/numbers';
import { useAuth } from '@/contexts/AuthContext';
import { useAgency } from '@/contexts/AgencyContext';
import { toast } from '@/lib/notify';
import i18n from '@/i18n/config';
import { logCreate, logUpdate, logDelete } from '@/services/auditService';
import { countAuthLinksForUser, invokeDeleteAuthUser, purgeEmployeeRowAndRelatedData } from '@/utils/employeeDeletionUtils';

// Tipos para respuestas de Supabase (snake_case)
interface SupabaseEmployee {
  id: string;
  agency_id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  user_id?: string;
  role?: string;
  department?: string;
  avatar_url?: string;
  default_weekly_capacity: number;
  work_schedule?: unknown;
  is_active: boolean;
  hourly_rate?: number;
  crm_user_id?: number;
  welcome_tour_completed?: boolean;
  deadlines_tour_completed?: boolean;
  planner_tour_completed?: boolean;
  permissions?: unknown;
  preferred_view?: 'weekly' | 'daily' | null;
}

interface SupabaseClient {
  id: string;
  agency_id: string;
  name: string;
  color: string;
}

interface SupabaseProject {
  id: string;
  agency_id: string;
  client_id: string;
  name: string;
  status: string;
  budget_hours: number;
  minimum_hours?: number;
  monthly_fee?: number;
  external_id?: string;
  project_type?: string;
  deliverable_contract_fee?: number | null;
  deliverable_start_date?: string | null;
  deliverable_due_date?: string | null;
  is_hidden?: boolean;
  responsible_department_id?: string | null;
  okrs?: { id: string; title: string; progress: number }[];
  deliverables_log?: Record<string, string[]>;
}

interface SupabaseAllocation {
  id: string;
  agency_id?: string;
  employee_id: string;
  project_id: string;
  week_start_date: string;
  hours_assigned: number;
  hours_actual?: number;
  hours_computed?: number;
  status: string;
  description?: string;
  task_name?: string;
  dependency_id?: string;
  transferred_from_allocation_id?: string;
  distribution_source_allocation_id?: string;
  parent_allocation_id?: string;
  original_transferred_task_name?: string;
  transfer_source_employee_id?: string;
  user_priority?: number | null;
  focus_date?: string | null;
  is_locked?: boolean;
}

interface SupabaseAbsence {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  type: string;
  hours?: number;
  description?: string;
}

interface SupabaseTeamEvent {
  id: string;
  name: string;
  date: string;
  hours_reduction: number;
  affected_employee_ids: string[] | 'all';
}

interface SupabaseWeeklyFeedback {
  id: string;
  employee_id: string;
  week_start_date: string;
  project_id?: string;
  allocation_id?: string;
  reason?: string;
  weekly_action?: string;
  comments?: string;
  created_at: string;
}

interface SupabaseUserRoutine {
  id: string;
  employee_id: string;
  title: string;
  estimated_minutes: number;
  project_id?: string;
  is_active: boolean;
}

interface AppContextType {
  currentUser: Employee | undefined;
  isAdmin: boolean;
  employees: Employee[];
  clients: Client[];
  projects: Project[];
  allocations: Allocation[];
  absences: Absence[];
  teamEvents: TeamEvent[];
  weeklyFeedback: WeeklyFeedback[];
  isLoading: boolean;
  isSecondaryLoading: boolean;
  fetchArchivedProjects: () => Promise<void>;
  addEmployee: (employee: Omit<Employee, 'id'>) => Promise<void>;
  updateEmployee: (employee: Employee) => Promise<void>;
  deleteEmployee: (id: string) => Promise<boolean>;
  toggleEmployeeActive: (id: string) => Promise<void>;
  addClient: (client: Omit<Client, 'id'>) => Promise<Client | null>;
  updateClient: (client: Client) => void;
  deleteClient: (id: string) => void;
  addProject: (project: Omit<Project, 'id'>) => void;
  updateProject: (project: Project) => void;
  deleteProject: (id: string) => void;
  addAllocation: (allocation: Omit<Allocation, 'id'>) => Promise<Allocation | null>;
  updateAllocation: (patch: Partial<Allocation> & Pick<Allocation, 'id'>) => void;
  deleteAllocation: (id: string) => void;
  addAbsence: (absence: Omit<Absence, 'id'>) => void;
  deleteAbsence: (id: string) => void;
  addTeamEvent: (event: Omit<TeamEvent, 'id'>) => void;
  updateTeamEvent: (event: TeamEvent) => void;
  deleteTeamEvent: (id: string) => void;
  getEmployeeAllocationsForWeek: (employeeId: string, weekStart: string) => Allocation[];
  getEmployeeLoadForWeek: (employeeId: string, weekStart: string, effectiveStart?: Date, effectiveEnd?: Date, viewMonth?: Date) => { hours: number; capacity: number; baseCapacity: number; status: LoadStatus; percentage: number; breakdown: { reason: string; hours: number; type: 'absence' | 'event' }[] };
  getEmployeeMonthlyLoad: (employeeId: string, year: number, month: number) => { hours: number; capacity: number; status: LoadStatus; percentage: number };
  getProjectHoursForMonth: (projectId: string, month: Date) => { used: number; budget: number; available: number; percentage: number };
  getClientTotalHoursForMonth: (clientId: string, month: Date) => { used: number; budget: number; percentage: number };
  getProjectById: (id: string) => Project | undefined;
  getClientById: (id: string) => Client | undefined;
  loadDataForMonth: (month: Date) => Promise<boolean>;
  ensureMonthLoaded: (date: Date) => Promise<void>;
  /**
   * Vuelve a cargar allocations + ausencias + eventos + feedback del mes ignorando la caché.
   * Útil para exportaciones: evita datos obsoletos si el mes ya estaba marcado como cargado antes de registrar nuevas ausencias.
   */
  refetchMonthData: (date: Date) => Promise<boolean>;
  /** Precarga todos los meses del rango inclusive (inicio/fin normalizados a inicio de mes). */
  ensureMonthsLoadedInRange: (start: Date, end: Date) => Promise<void>;
  addWeeklyFeedback: (feedback: Omit<WeeklyFeedback, 'id' | 'createdAt'>) => Promise<boolean>;
  refreshData: (skipLoading?: boolean) => Promise<void>;
  userRoutines: UserRoutine[];
  addRoutine: (routine: Omit<UserRoutine, 'id'>) => Promise<void>;
  deleteRoutine: (id: string) => Promise<void>;
  toggleRoutine: (id: string) => Promise<void>;

  // Transfers (Global State)
  pendingTransfers: TaskTransfer[];
  outgoingTransfers: TaskTransfer[];
  fetchTransfers: () => Promise<void>;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user: authUser, isInitialized: isAuthInitialized } = useAuth();
  const { currentAgency, isLoading: isAgencyLoading } = useAgency();
  const [currentUser, setCurrentUser] = useState<Employee | undefined>(undefined);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [teamEvents, setTeamEvents] = useState<TeamEvent[]>([]);
  const [weeklyFeedback, setWeeklyFeedback] = useState<WeeklyFeedback[]>([]);
  const [userRoutines, setUserRoutines] = useState<UserRoutine[]>([]);
  // Transfers State
  const [pendingTransfers, setPendingTransfers] = useState<TaskTransfer[]>([]);
  const [outgoingTransfers, setOutgoingTransfers] = useState<TaskTransfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSecondaryLoading, setIsSecondaryLoading] = useState(true);

  // Ref para evitar vinculaciones duplicadas - DEBE estar ANTES de los useEffects
  const hasLinkedUserRef = useRef<string | null>(null);
  // Ref para evitar cascadas al cambiar de pestaña (Supabase refresca token y re-emite authUser con nueva ref)
  const prevAuthUserIdRef = useRef<string | null>(null);
  /** Evita saltar la re-vinculación cuando solo cambia la agencia activa (p. ej. admin impersonando otra). */
  const lastCurrentUserAgencyRef = useRef<string | null>(null);
  // Ref para acceder a employees sin trigger re-renders
  const employeesRef = useRef<Employee[]>([]);
  const allocationsRef = useRef<Allocation[]>([]);
  // Ref para trackear meses cargados globalmente (centralizado)
  const loadedMonthsRef = useRef<Set<string>>(new Set());
  /** Meses confirmados sin allocations tras una carga exitosa (evita recargas en bucle). */
  const emptyMonthsLoadedRef = useRef<Set<string>>(new Set());
  /** Cargas de mes en curso: misma clave `yyyy-MM` comparte una sola petición. */
  const monthLoadInflightRef = useRef<Map<string, Promise<boolean>>>(new Map());
  // Ref para trackear la agencia anterior y detectar cambios
  const prevAgencyIdRef = useRef<string | null>(null);

  useEffect(() => {
    allocationsRef.current = allocations;
    for (const monthKey of emptyMonthsLoadedRef.current) {
      const [y, m] = monthKey.split('-').map(Number);
      if (!y || !m) continue;
      const monthDate = new Date(y, m - 1, 1);
      const hasRows = allocations.some((a) =>
        isAllocationInEffectiveMonth(a.weekStartDate, monthDate)
      );
      if (hasRows) {
        emptyMonthsLoadedRef.current.delete(monthKey);
      }
    }
  }, [allocations]);

  const fetchData = useCallback(
    async (skipLoading = false, dateRange?: { start: Date; end: Date }) => {
      if (!currentAgency?.id) {
        setIsLoading(false);
        return;
      }

      await fetchInitialAppData({
        agencyId: currentAgency.id,
        skipLoading,
        dateRange,
        setIsLoading,
        setIsSecondaryLoading,
        setEmployees,
        setClients,
        setProjects,
        setAllocations,
        setAbsences,
        setTeamEvents,
        setWeeklyFeedback,
        setUserRoutines,
        employeesRef,
      });

      const today = new Date();
      const rangeStart = dateRange?.start ?? new Date(today.getFullYear(), today.getMonth(), 1);
      const seededMonthKey = format(startOfMonth(rangeStart), 'yyyy-MM');

      // Recarga sustituye o fusiona allocations del rango pedido: la caché de meses debe alinearse.
      loadedMonthsRef.current.clear();
      emptyMonthsLoadedRef.current.clear();
      loadedMonthsRef.current.add(seededMonthKey);
    },
    [currentAgency?.id]
  );

  // Función para cargar datos de un mes específico (merge con datos existentes)
  const loadDataForMonth = useCallback(
    async (month: Date): Promise<boolean> => {
      if (!currentAgency?.id) return false;

      return loadMonthData({
        agencyId: currentAgency.id,
        month,
        setAllocations,
        setAbsences,
        setTeamEvents,
        setWeeklyFeedback,
        setProjects,
        onAllocationsMerged: (list) => {
          allocationsRef.current = list;
        },
      });
    },
    [currentAgency?.id]
  );

  // Función centralizada para asegurar que un mes está cargado (evita peticiones duplicadas)
  const ensureMonthLoaded = useCallback(async (date: Date) => {
    const monthKey = format(date, 'yyyy-MM');

    if (loadedMonthsRef.current.has(monthKey)) {
      const hasRowsForMonth = allocationsRef.current.some((a) =>
        isAllocationInEffectiveMonth(a.weekStartDate, date)
      );
      if (hasRowsForMonth || emptyMonthsLoadedRef.current.has(monthKey)) {
        return;
      }
      // Mes marcado como cargado pero sin filas en memoria: recargar (caché obsoleta tras fetchData u otro reset)
      loadedMonthsRef.current.delete(monthKey);
      emptyMonthsLoadedRef.current.delete(monthKey);
    }

    let inflight = monthLoadInflightRef.current.get(monthKey);
    if (!inflight) {
      inflight = loadDataForMonth(date);
      monthLoadInflightRef.current.set(monthKey, inflight);
      void inflight.finally(() => {
        monthLoadInflightRef.current.delete(monthKey);
      });
    }

    const ok = await inflight;
    if (ok) {
      loadedMonthsRef.current.add(monthKey);
      const hasRowsForMonth = allocationsRef.current.some((a) =>
        isAllocationInEffectiveMonth(a.weekStartDate, date)
      );
      if (!hasRowsForMonth) {
        emptyMonthsLoadedRef.current.add(monthKey);
      }
    }
  }, [loadDataForMonth]);

  const refetchMonthData = useCallback(
    async (date: Date): Promise<boolean> => {
      if (!currentAgency?.id) return false;
      const monthKey = format(date, 'yyyy-MM');
      const pending = monthLoadInflightRef.current.get(monthKey);
      if (pending) await pending;
      loadedMonthsRef.current.delete(monthKey);
      emptyMonthsLoadedRef.current.delete(monthKey);
      const ok = await loadDataForMonth(date);
      if (ok) {
        loadedMonthsRef.current.add(monthKey);
        const hasRowsForMonth = allocationsRef.current.some((a) =>
          isAllocationInEffectiveMonth(a.weekStartDate, date)
        );
        if (!hasRowsForMonth) {
          emptyMonthsLoadedRef.current.add(monthKey);
        }
      }
      return ok;
    },
    [currentAgency?.id, loadDataForMonth]
  );

  const ensureMonthsLoadedInRange = useCallback(
    async (start: Date, end: Date) => {
      const from = startOfMonth(start);
      const to = startOfMonth(end);
      if (from > to) return;
      for (const m of eachMonthOfInterval({ start: from, end: to })) {
        await ensureMonthLoaded(m);
      }
    },
    [ensureMonthLoaded]
  );

  // Función para cargar proyectos archivados/completados bajo demanda
  const fetchArchivedProjects = useCallback(async () => {
    if (!currentAgency?.id) return;

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('agency_id', currentAgency.id)
      .neq('status', 'active');

    if (error) {
      console.error('Error cargando proyectos archivados:', error);
      return;
    }

    if (data) {
      const mappedProjects = data.map((p: SupabaseProject) => mapSupabaseProjectRow(p));

      setProjects(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const newProjects = mappedProjects.filter((p: Project) => !existingIds.has(p.id));
        return [...prev, ...newProjects];
      });
    }
  }, [currentAgency?.id]);

  // Cargar datos cuando la autenticación y la agencia estén listas
  useEffect(() => {
    if (isAuthInitialized && !isAgencyLoading && currentAgency?.id) {
      // Detectar si cambió la agencia (no es la misma que antes)
      const agencyChanged = prevAgencyIdRef.current !== null &&
        prevAgencyIdRef.current !== currentAgency.id;

      if (agencyChanged) {
        // Limpiar todo el estado antes de cargar datos nuevos
        console.debug('[AppContext] Agencia cambió, limpiando estado...');
        setEmployees([]);
        setClients([]);
        setProjects([]);
        setAllocations([]);
        setAbsences([]);
        setTeamEvents([]);
        setWeeklyFeedback([]);
        setUserRoutines([]);
        setCurrentUser(undefined);
        hasLinkedUserRef.current = null;
        loadedMonthsRef.current.clear(); // Limpiar caché de meses cargados
        emptyMonthsLoadedRef.current.clear();
        monthLoadInflightRef.current.clear();
        employeesRef.current = [];
      }

      // Actualizar ref con la agencia actual
      prevAgencyIdRef.current = currentAgency.id;

      void fetchData(agencyChanged);
    }
  }, [isAuthInitialized, isAgencyLoading, currentAgency?.id, fetchData]);

  // ============================================================
  // REALTIME: Subscribe to allocations, projects, absences, team_events for live updates
  // ============================================================
  useEffect(() => {
    if (!currentAgency?.id) return;

    const mapProject = (row: SupabaseProject): Project => ({
      id: row.id,
      agencyId: row.agency_id,
      clientId: row.client_id,
      name: row.name,
      status: (row.status || 'active') as 'active' | 'archived' | 'completed',
      budgetHours: round2(row.budget_hours),
      minimumHours: round2(row.minimum_hours || 0),
      monthlyFee: row.monthly_fee,
      externalId: row.external_id ? Number(row.external_id) : undefined,
      projectType: row.project_type?.trim() || undefined,
      deliverableContractFee: row.deliverable_contract_fee ?? undefined,
      deliverableStartDate: row.deliverable_start_date ?? undefined,
      deliverableDueDate: row.deliverable_due_date ?? undefined,
      isHidden: row.is_hidden || false,
      responsibleDepartmentId: row.responsible_department_id ?? undefined,
      okrs: row.okrs,
      deliverables_log: row.deliverables_log
    });

    const mapAbsence = (row: SupabaseAbsence): Absence => ({
      id: row.id,
      employeeId: row.employee_id,
      startDate: row.start_date,
      endDate: row.end_date,
      type: row.type as Absence['type'],
      hours: row.hours,
      description: row.description
    });

    const mapTeamEvent = (row: SupabaseTeamEvent): TeamEvent => ({
      id: row.id,
      name: row.name,
      date: row.date,
      hoursReduction: row.hours_reduction,
      affectedEmployeeIds: row.affected_employee_ids
    });

    const channel = supabase
      .channel(`app-realtime-${currentAgency.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'allocations', filter: `agency_id=eq.${currentAgency.id}` },
        (payload) => {
          const mapAllocation = (row: SupabaseAllocation): Allocation => ({
            id: row.id,
            agencyId: row.agency_id,
            employeeId: row.employee_id,
            projectId: row.project_id,
            weekStartDate: row.week_start_date,
            hoursAssigned: round2(row.hours_assigned),
            hoursActual: row.hours_actual ? round2(row.hours_actual) : undefined,
            hoursComputed: row.hours_computed ? round2(row.hours_computed) : undefined,
            status: (row.status || 'planned') as 'planned' | 'completed' | 'active',
            description: row.description,
            taskName: row.task_name,
            dependencyId: row.dependency_id,
            transferredFromAllocationId: row.transferred_from_allocation_id,
            distributionSourceAllocationId: row.distribution_source_allocation_id,
            parentAllocationId: row.parent_allocation_id,
            originalTransferredTaskName: row.original_transferred_task_name,
            transferSourceEmployeeId: row.transfer_source_employee_id,
            userPriority: row.user_priority ?? null,
            focusDate: row.focus_date ?? null,
            isLocked: row.is_locked ?? false
          });
          if (payload.eventType === 'INSERT') {
            const newAllocation = mapAllocation(payload.new as SupabaseAllocation);
            setAllocations(prev => (prev.some(a => a.id === newAllocation.id) ? prev : [...prev, newAllocation]));
            if (newAllocation.projectId) {
              void ensureProjectsLoaded(currentAgency.id, [newAllocation.projectId], setProjects);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = mapAllocation(payload.new as SupabaseAllocation);
            setAllocations(prev => prev.map(a => (a.id === updated.id ? updated : a)));
            if (updated.projectId) {
              void ensureProjectsLoaded(currentAgency.id, [updated.projectId], setProjects);
            }
          } else if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id: string }).id;
            setAllocations(prev => prev.filter(a => a.id !== id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects', filter: `agency_id=eq.${currentAgency.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setProjects(prev => (prev.some(p => p.id === (payload.new as SupabaseProject).id) ? prev : [...prev, mapProject(payload.new as SupabaseProject)]));
          } else if (payload.eventType === 'UPDATE') {
            const updated = mapProject(payload.new as SupabaseProject);
            setProjects((prev) => {
              const exists = prev.some((p) => p.id === updated.id);
              if (exists) return prev.map((p) => (p.id === updated.id ? updated : p));
              return [...prev, updated];
            });
          } else if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id: string }).id;
            setProjects(prev => prev.filter(p => p.id !== id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'absences' },
        (payload) => {
          const employeeIds = new Set(employeesRef.current.map(e => e.id));
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row = payload.new as SupabaseAbsence;
            if (!employeeIds.has(row.employee_id)) return;
            const mapped = mapAbsence(row);
            setAbsences(prev => {
              const existing = prev.find(a => a.id === mapped.id);
              if (payload.eventType === 'INSERT' && existing) return prev;
              if (payload.eventType === 'INSERT') return [...prev, mapped];
              return prev.map(a => (a.id === mapped.id ? mapped : a));
            });
          } else if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id: string }).id;
            setAbsences(prev => prev.filter(a => a.id !== id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_events', filter: `agency_id=eq.${currentAgency.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const mapped = mapTeamEvent(payload.new as SupabaseTeamEvent);
            setTeamEvents(prev => (prev.some(e => e.id === mapped.id) ? prev : [...prev, mapped]));
          } else if (payload.eventType === 'UPDATE') {
            const updated = mapTeamEvent(payload.new as SupabaseTeamEvent);
            setTeamEvents(prev => prev.map(e => (e.id === updated.id ? updated : e)));
          } else if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id: string }).id;
            setTeamEvents(prev => prev.filter(e => e.id !== id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentAgency?.id]);

  // Reaccionar a cambios de usuario (login/logout) - SOLO cuando employees esté cargado.
  // Guarda con prevAuthUserIdRef evita cascadas cuando Supabase refresca el token al cambiar de pestaña.
  useEffect(() => {
    if (!isAuthInitialized) return;
    if (isLoading) return;
    if (employeesRef.current.length === 0) return;

    if (
      authUser?.id != null &&
      authUser.id === prevAuthUserIdRef.current &&
      hasLinkedUserRef.current != null &&
      currentAgency?.id === lastCurrentUserAgencyRef.current
    ) {
      return;
    }
    if (!authUser?.id) {
      prevAuthUserIdRef.current = null;
    }

    if (authUser) {
      if (hasLinkedUserRef.current === authUser.id) {
        return;
      }

      const matchAuth = (e: Employee) =>
        e.user_id === authUser.id ||
        (!!e.email && !!authUser.email && e.email.toLowerCase() === authUser.email.toLowerCase());

      const foundEmployee =
        (currentAgency?.id
          ? employeesRef.current.find(e => e.agencyId === currentAgency.id && matchAuth(e))
          : undefined) ?? employeesRef.current.find(matchAuth);

      if (foundEmployee) {
        // Marcar como vinculado INMEDIATAMENTE (antes de cualquier setState)
        hasLinkedUserRef.current = authUser.id;

        // Si el empleado no tiene user_id pero el email coincide, vincular automáticamente
        if (!foundEmployee.user_id && authUser.id) {
          // Vinculando empleado existente con usuario Auth

          // Actualizar currentUser PRIMERO (optimistic update)
          const updatedEmployee = { ...foundEmployee, user_id: authUser.id };
          setCurrentUser(updatedEmployee);
          lastCurrentUserAgencyRef.current = currentAgency?.id ?? null;

          // Luego persistir en BD (sin actualizar employees para evitar re-trigger)
          supabase
            .from('employees')
            .update({ user_id: authUser.id })
            .eq('id', foundEmployee.id)
            .then(({ error }) => {
              if (error) {
                console.error('[AppContext] Error actualizando user_id:', error);
                toast.error('Error al vincular empleado con usuario. Por favor, contacta al administrador.');
              }
              // NO llamar a setEmployees aquí para evitar re-trigger del useEffect
            });
        } else {
          // Empleado encontrado para usuario autenticado
          setCurrentUser(foundEmployee);
        }
        lastCurrentUserAgencyRef.current = currentAgency?.id ?? null;
      } else {
        console.warn('[AppContext] No se encontró empleado para usuario Auth:', authUser.email);
        setCurrentUser(undefined);
        lastCurrentUserAgencyRef.current = currentAgency?.id ?? null;
      }
    } else {
      // Usuario deslogueado - resetear
      hasLinkedUserRef.current = null;
      prevAuthUserIdRef.current = null;
      lastCurrentUserAgencyRef.current = null;
      setCurrentUser(undefined);
    }
    prevAuthUserIdRef.current = authUser?.id ?? null;
  }, [authUser, isAuthInitialized, isLoading, currentAgency?.id]);

  const addEmployee = useCallback(async (employee: Omit<Employee, 'id'>) => {
    if (!currentAgency?.id) {
      toast.error('No hay agencia seleccionada');
      throw new Error('No agency selected');
    }

    const { data, error } = await supabase.from('employees').insert({
      agency_id: employee.agencyId || currentAgency.id,
      name: employee.name,
      first_name: employee.first_name,
      last_name: employee.last_name,
      email: employee.email,
      user_id: employee.user_id,
      role: employee.role,
      department: employee.department,
      department_id: employee.departmentId ?? null,
      avatar_url: employee.avatarUrl,
      default_weekly_capacity: employee.defaultWeeklyCapacity,
      work_schedule: employee.workSchedule,
      is_active: employee.isActive,
      hourly_rate: employee.monthlyCost ?? employee.hourlyRate ?? 0,
      crm_user_id: employee.crmUserId
    }).select().single();

    if (error) {
      console.error('Error creando empleado:', error);
      const errorMessage = error.message || 'Error al crear el empleado';
      toast.error(errorMessage);
      throw error;
    }

    if (data) {
      const mappedEmployee: Employee = {
        ...data,
        agencyId: data.agency_id,
        avatarUrl: data.avatar_url,
        defaultWeeklyCapacity: data.default_weekly_capacity,
        workSchedule: data.work_schedule,
        isActive: data.is_active,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        user_id: data.user_id,
        departmentId: data.department_id ?? undefined,
        monthlyCost: data.hourly_rate || 0,
        hourlyRate: data.hourly_rate || 0,
        crmUserId: data.crm_user_id,
        welcomeTourCompleted: data.welcome_tour_completed === true,
        deadlinesTourCompleted: data.deadlines_tour_completed === true,
        plannerTourCompleted: data.planner_tour_completed === true
      };
      setEmployees(prev => [...prev, mappedEmployee]);
    }
  }, [currentAgency?.id]);

  const updateEmployee = useCallback(async (employee: Employee) => {
    // 1. Actualización optimista del estado local
    setEmployees(prev => prev.map(e => e.id === employee.id ? employee : e));

    // 2. Actualizar en Base de Datos (Employees table)
    const { error } = await supabase.from('employees').update({
      name: employee.name,
      first_name: employee.first_name,
      last_name: employee.last_name,
      email: employee.email,
      user_id: employee.user_id,
      role: employee.role,
      department: employee.department,
      department_id: employee.departmentId ?? null,
      avatar_url: employee.avatarUrl,
      default_weekly_capacity: employee.defaultWeeklyCapacity,
      work_schedule: employee.workSchedule,
      is_active: employee.isActive,
      hourly_rate: employee.monthlyCost ?? employee.hourlyRate ?? 0,
      crm_user_id: employee.crmUserId,
      welcome_tour_completed: employee.welcomeTourCompleted || false,
      deadlines_tour_completed: employee.deadlinesTourCompleted || false,
      planner_tour_completed: employee.plannerTourCompleted || false,
      preferred_view: employee.preferredView || null
    }).eq('id', employee.id);

    if (error) {
      console.error('Error actualizando empleado:', error);
      const errorMessage = error.message || 'Error al actualizar el empleado';
      toast.error(errorMessage);
      // Revertir estado optimista si falla? Por ahora no, para no complicar UX
      throw error;
    }

    // 3. Sincronizar con Supabase Auth (si tiene usuario vinculado y hay cambio de email)
    // Nota: update-user también maneja contraseñas, pero aquí solo tenemos email.
    if (employee.user_id && employee.email) {
      try {
        const { error: fnError } = await supabase.functions.invoke('update-user', {
          body: {
            userId: employee.user_id,
            email: employee.email
          }
        });

        if (fnError) {
          console.error('Error sincronizando Auth (update-user):', fnError);
          toast.warning(i18n.t('team.employeeForm.toasts.emailSyncWarning', { ns: 'app' }));
        }
      } catch (err) {
        console.error('Error invocando update-user:', err);
      }
    }
  }, []);

  const deleteEmployee = useCallback(async (id: string): Promise<boolean> => {
    const employeeToDelete = employeesRef.current.find(e => e.id === id);
    const authUserId = employeeToDelete?.user_id ?? null;

    const purge = await purgeEmployeeRowAndRelatedData(id);
    if ('error' in purge) {
      console.error('Error eliminando empleado:', purge.error);
      const msg = purge.error.toLowerCase();
      toast.error(
        msg.includes('cleanup_employee') || msg.includes('function') || msg.includes('does not exist')
          ? 'Error al eliminar datos asociados al empleado. Comprueba que la migración cleanup_employee_data está aplicada.'
          : purge.error
      );
      return false;
    }

    setEmployees(prev => {
      const next = prev.filter(e => e.id !== id);
      employeesRef.current = next;
      return next;
    });
    setAllocations(prev => prev.filter(a => a.employeeId !== id));
    setAbsences(prev => prev.filter(a => a.employeeId !== id));
    setWeeklyFeedback(prev => prev.filter(f => f.employeeId !== id));
    setUserRoutines(prev => prev.filter(r => r.employeeId !== id));
    setTeamEvents(prev => prev.map(te => ({
      ...te,
      affectedEmployeeIds: Array.isArray(te.affectedEmployeeIds)
        ? te.affectedEmployeeIds.filter(eid => eid !== id)
        : te.affectedEmployeeIds
    })));

    if (authUserId) {
      const links = await countAuthLinksForUser(authUserId);
      if (!links) {
        toast.warning(
          'Empleado eliminado, pero no se pudo comprobar si la cuenta de acceso sigue en uso en otras agencias.'
        );
        return true;
      }
      if (links.employees === 0 && links.userAgencies === 0) {
        const authRes = await invokeDeleteAuthUser(authUserId);
        if ('error' in authRes) {
          console.error('Error eliminando usuario Auth:', authRes.error);
          toast.warning(
            'Empleado eliminado, pero el usuario de acceso podría seguir activo (error de sincronización).'
          );
        }
      } else {
        toast.info(
          'Empleado eliminado en esta agencia. La cuenta de acceso sigue activa porque el usuario está vinculado a otra agencia.'
        );
      }
    }

    return true;
  }, []);

  const toggleEmployeeActive = useCallback(async (id: string) => {
    let newState: boolean | null = null;

    setEmployees(prev => {
      const emp = prev.find(e => e.id === id);
      if (!emp) return prev;
      newState = !emp.isActive;
      // Actualizar ref también para consistency inmediata
      const updated = prev.map(e => e.id === id ? { ...e, isActive: newState! } : e);
      employeesRef.current = updated;
      return updated;
    });

    if (newState !== null) {
      await supabase.from('employees').update({ is_active: newState }).eq('id', id);
    }
  }, []);

  // --- ALLOCATIONS ---
  const addAllocation = useCallback(async (allocation: Omit<Allocation, 'id'>): Promise<Allocation | null> => {
    const { data, error } = await supabase.from('allocations').insert({
      agency_id: allocation.agencyId || currentAgency?.id,
      employee_id: allocation.employeeId,
      project_id: allocation.projectId,
      week_start_date: allocation.weekStartDate,
      hours_assigned: allocation.hoursAssigned,
      hours_actual: allocation.hoursActual || 0,
      hours_computed: allocation.hoursComputed || 0,
      status: allocation.status,
      task_name: allocation.taskName,
      dependency_id: allocation.dependencyId,
      transferred_from_allocation_id: allocation.transferredFromAllocationId,
      distribution_source_allocation_id: allocation.distributionSourceAllocationId,
      parent_allocation_id: allocation.parentAllocationId,
      original_transferred_task_name: allocation.originalTransferredTaskName,
      transfer_source_employee_id: allocation.transferSourceEmployeeId,
      user_priority: allocation.userPriority,
      focus_date: allocation.focusDate ?? null,
      is_locked: allocation.isLocked ?? false
    }).select().single();

    if (error) {
      console.error('SUPABASE ERROR DETAILED:', JSON.stringify(error, null, 2));
      console.error('PAYLOAD WAS:', JSON.stringify(allocation, null, 2));
      toast.error(`Error al guardar: ${error.message} (${error.code})`);
      return null; // Stop execution
    }

    if (data) {
      const mappedAllocation = {
        ...data,
        agencyId: data.agency_id,
        employeeId: data.employee_id,
        projectId: data.project_id,
        weekStartDate: data.week_start_date,
        hoursAssigned: round2(data.hours_assigned),
        hoursActual: round2(data.hours_actual),
        hoursComputed: round2(data.hours_computed),
        taskName: data.task_name,
        dependencyId: data.dependency_id,
        transferredFromAllocationId: data.transferred_from_allocation_id,
        distributionSourceAllocationId: data.distribution_source_allocation_id,
        parentAllocationId: data.parent_allocation_id,
        originalTransferredTaskName: data.original_transferred_task_name,
        transferSourceEmployeeId: data.transfer_source_employee_id,
        userPriority: data.user_priority,
        focusDate: data.focus_date ?? null,
        isLocked: data.is_locked ?? false
      };
      setAllocations(prev => [...prev, mappedAllocation]);

      // Log audit for allocation creation
      if (currentAgency?.id) {
        logCreate(currentAgency.id, 'ALLOCATION', mappedAllocation.id, mappedAllocation as unknown as Record<string, unknown>);
      }

      return mappedAllocation;
    }
    return null;
  }, [currentAgency?.id]);

  const updateAllocation = useCallback(async (patch: Partial<Allocation> & Pick<Allocation, 'id'>) => {
    const previousAllocation = allocations.find(a => a.id === patch.id);
    if (!previousAllocation) return;

    const mergedAllocation: Allocation = { ...previousAllocation, ...patch };
    const becameCompleted =
      patch.status === 'completed' && previousAllocation.status !== 'completed';

    const snakeMap: Record<string, string> = {
      employeeId: 'employee_id',
      projectId: 'project_id',
      weekStartDate: 'week_start_date',
      hoursAssigned: 'hours_assigned',
      hoursActual: 'hours_actual',
      hoursComputed: 'hours_computed',
      status: 'status',
      taskName: 'task_name',
      dependencyId: 'dependency_id',
      transferredFromAllocationId: 'transferred_from_allocation_id',
      distributionSourceAllocationId: 'distribution_source_allocation_id',
      parentAllocationId: 'parent_allocation_id',
      originalTransferredTaskName: 'original_transferred_task_name',
      transferSourceEmployeeId: 'transfer_source_employee_id',
      userPriority: 'user_priority',
      focusDate: 'focus_date',
      isLocked: 'is_locked'
    };

    const updatePayload: Record<string, unknown> = {};
    (Object.keys(patch) as (keyof Allocation)[]).forEach(key => {
      if (key === 'id') return;
      const snake = snakeMap[key];
      if (snake && key in patch) {
        const v = patch[key];
        if (v !== undefined) updatePayload[snake] = v;
      }
    });

    setAllocations(prev => prev.map(a => a.id === patch.id ? mergedAllocation : a));

    try {
      if (Object.keys(updatePayload).length > 0) {
        const { data, error } = await supabase
          .from('allocations')
          .update(updatePayload)
          .eq('id', patch.id)
          .select('id');
        if (error) throw error;
        if (!data || data.length === 0) {
          setAllocations(prev => prev.map(a => a.id === patch.id ? previousAllocation : a));
          toast.error('No se pudo guardar la tarea. Comprueba que tienes permiso para editarla.');
          return;
        }
      }

      if (currentAgency?.id) {
        logUpdate(
          currentAgency.id,
          'ALLOCATION',
          patch.id,
          previousAllocation as unknown as Record<string, unknown>,
          mergedAllocation as unknown as Record<string, unknown>
        );
      }

      if (becameCompleted) {
        void supabase.functions
          .invoke('process-event-notifications', {
            body: { completedAllocationId: patch.id },
          })
          .then(({ error: fnError }) => {
            if (fnError) {
              console.warn('[process-event-notifications]', fnError.message);
            }
          });
      }
    } catch (error) {
      console.error('Error updating allocation:', error);
      toast.error('Error al guardar la tarea. Se han revertido los cambios.');
      setAllocations(prev => prev.map(a => a.id === patch.id ? previousAllocation : a));
    }
  }, [allocations, currentAgency?.id]);

  const deleteAllocation = useCallback(async (id: string) => {
    // Get allocation data for audit log before deleting
    const deletedAllocation = allocations.find(a => a.id === id);

    setAllocations(prev => prev.filter(a => a.id !== id));
    await supabase.from('allocations').delete().eq('id', id);

    // Log audit for allocation deletion
    if (currentAgency?.id) {
      logDelete(
        currentAgency.id,
        'ALLOCATION',
        id,
        deletedAllocation as unknown as Record<string, unknown>
      );
    }
  }, [allocations, currentAgency?.id]);

  // --- CLIENTS ---
  const addClient = useCallback(async (client: Omit<Client, 'id'>): Promise<Client | null> => {
    if (!currentAgency?.id) {
      toast.error('No hay agencia seleccionada');
      return null;
    }

    const { data, error } = await supabase.from('clients').insert({
      agency_id: client.agencyId || currentAgency.id,
      name: client.name,
      color: client.color
    }).select().single();

    if (error) {
      console.error('Error creando cliente:', error);
      toast.error(error.message || 'Error al crear el cliente');
      return null;
    }

    if (data) {
      const newClient: Client = {
        id: data.id,
        agencyId: data.agency_id,
        name: data.name,
        color: data.color
      };
      setClients(prev => [...prev, newClient]);
      return newClient;
    }
    return null;
  }, [currentAgency?.id]);

  const updateClient = useCallback(async (client: Client) => {
    setClients(prev => prev.map(c => c.id === client.id ? client : c));
    await supabase.from('clients').update({ name: client.name, color: client.color }).eq('id', client.id);
  }, []);

  const deleteClient = useCallback(async (id: string) => {
    setClients(prev => prev.filter(c => c.id !== id));
    setProjects(prev => prev.filter(p => p.clientId !== id));
    await supabase.from('clients').delete().eq('id', id);
  }, []);

  // --- PROJECTS ---
  const addProject = useCallback(async (project: Omit<Project, 'id'>) => {
    if (!currentAgency?.id) {
      toast.error('No hay agencia seleccionada');
      return;
    }

    const { data } = await supabase.from('projects').insert({
      agency_id: project.agencyId || currentAgency.id,
      client_id: project.clientId,
      name: project.name,
      status: project.status,
      budget_hours: project.budgetHours,
      minimum_hours: project.minimumHours,
      monthly_fee: project.monthlyFee,
      external_id: project.externalId,
      responsible_department_id: project.responsibleDepartmentId ?? null,
      project_type: project.projectType ?? null,
      deliverable_contract_fee: project.deliverableContractFee ?? null,
      deliverable_start_date: project.deliverableStartDate?.trim() || null,
      deliverable_due_date: project.deliverableDueDate?.trim() || null,
    }).select().single();

    if (data) {
      setProjects(prev => [...prev, {
        id: data.id,
        agencyId: data.agency_id,
        clientId: data.client_id,
        name: data.name,
        status: (data.status || 'active') as 'active' | 'archived' | 'completed',
        budgetHours: round2(data.budget_hours),
        minimumHours: round2(data.minimum_hours || 0),
        monthlyFee: round2(data.monthly_fee || 0),
        externalId: data.external_id ? Number(data.external_id) : undefined,
        responsibleDepartmentId: data.responsible_department_id ?? undefined,
        projectType: data.project_type ?? undefined,
        deliverableContractFee: data.deliverable_contract_fee ?? undefined,
        deliverableStartDate: data.deliverable_start_date ?? undefined,
        deliverableDueDate: data.deliverable_due_date ?? undefined,
        okrs: project.okrs,
      }]);
    }
  }, [currentAgency?.id]);

  const updateProject = useCallback(async (project: Project) => {
    setProjects(prev => prev.map(p => p.id === project.id ? project : p));
    await supabase.from('projects').update({
      client_id: project.clientId,
      name: project.name,
      status: project.status,
      budget_hours: project.budgetHours,
      minimum_hours: project.minimumHours,
      monthly_fee: project.monthlyFee,
      okrs: project.okrs,
      deliverables_log: project.deliverables_log,
      external_id: project.externalId,
      project_type: project.projectType,
      deliverable_contract_fee: project.deliverableContractFee ?? null,
      deliverable_start_date: project.deliverableStartDate?.trim() || null,
      deliverable_due_date: project.deliverableDueDate?.trim() || null,
      is_hidden: project.isHidden || false,
      responsible_department_id: project.responsibleDepartmentId ?? null
    }).eq('id', project.id);
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    setAllocations(prev => prev.filter(a => a.projectId !== id));
    await supabase.from('projects').delete().eq('id', id);
  }, []);

  // --- ABSENCES ---
  const addAbsence = useCallback(async (absence: Omit<Absence, 'id'>) => {
    const { data } = await supabase.from('absences').insert({
      employee_id: absence.employeeId,
      start_date: absence.startDate,
      end_date: absence.endDate,
      type: absence.type,
      hours: absence.hours,
      description: absence.description
    }).select().single();
    if (data) setAbsences(prev => [...prev, {
      ...data,
      employeeId: data.employee_id,
      startDate: data.start_date,
      endDate: data.end_date,
      hours: data.hours
    }]);
  }, []);

  const deleteAbsence = useCallback(async (id: string) => {
    setAbsences(prev => prev.filter(a => a.id !== id));
    await supabase.from('absences').delete().eq('id', id);
  }, []);

  // --- TEAM EVENTS ---
  const addTeamEvent = useCallback(async (event: Omit<TeamEvent, 'id'>) => {
    if (!currentAgency?.id) return;
    const { data } = await supabase.from('team_events').insert({
      name: event.name,
      date: event.date,
      hours_reduction: event.hoursReduction,
      affected_employee_ids: event.affectedEmployeeIds,
      agency_id: currentAgency.id
    }).select().single();
    if (data) setTeamEvents(prev => [...prev, {
      ...data,
      hoursReduction: data.hours_reduction,
      affectedEmployeeIds: data.affected_employee_ids
    }]);
  }, [currentAgency?.id]);

  const updateTeamEvent = useCallback(async (event: TeamEvent) => {
    setTeamEvents(prev => prev.map(e => e.id === event.id ? event : e));
    await supabase.from('team_events').update({
      name: event.name,
      date: event.date,
      hours_reduction: event.hoursReduction,
      affected_employee_ids: event.affectedEmployeeIds
    }).eq('id', event.id);
  }, []);

  const deleteTeamEvent = useCallback(async (id: string) => {
    setTeamEvents(prev => prev.filter(e => e.id !== id));
    await supabase.from('team_events').delete().eq('id', id);
  }, []);

  // --- WEEKLY FEEDBACK ---
  const addWeeklyFeedback = useCallback(async (feedback: Omit<WeeklyFeedback, 'id' | 'createdAt'>): Promise<boolean> => {
    const { data, error } = await supabase.from('weekly_feedback').insert({
      employee_id: feedback.employeeId,
      week_start_date: feedback.weekStartDate,
      project_id: feedback.projectId || null,
      allocation_id: feedback.allocationId || null,
      reason: feedback.reason || null,
      weekly_action: feedback.weeklyAction || null,
      comments: feedback.comments || null
    }).select().single();

    if (error || !data) {
      console.error('Error adding weekly feedback:', error);
      return false;
    }

    setWeeklyFeedback(prev => [...prev, {
      id: data.id,
      employeeId: data.employee_id,
      weekStartDate: data.week_start_date,
      projectId: data.project_id ?? undefined,
      allocationId: data.allocation_id ?? undefined,
      reason: data.reason as WeeklyFeedback['reason'] | undefined,
      weeklyAction: data.weekly_action as WeeklyFeedback['weeklyAction'] | undefined,
      comments: data.comments ?? undefined,
      createdAt: data.created_at
    }]);
    return true;
  }, []);

  // --- QUERIES ---
  const getEmployeeAllocationsForWeek = useCallback((employeeId: string, weekStart: string) => {
    return allocations.filter(a => a.employeeId === employeeId && a.weekStartDate === weekStart);
  }, [allocations]);

  const getEmployeeLoadForWeek = useCallback(
    (employeeId: string, weekStart: string, effectiveStart?: Date, effectiveEnd?: Date, viewMonth?: Date) => {
      return computeEmployeeLoadForWeek(
        employeeId,
        weekStart,
        { effectiveStart, effectiveEnd, viewMonth },
        { employees, allocations, absences, teamEvents }
      );
    },
    [employees, allocations, absences, teamEvents]
  );

  const getEmployeeMonthlyLoad = useCallback(
    (employeeId: string, year: number, month: number) => {
      return computeEmployeeMonthlyLoad(employeeId, year, month, {
        employees,
        allocations,
        absences,
        teamEvents,
      });
    },
    [employees, allocations, absences, teamEvents]
  );

  const getProjectHoursForMonth = useCallback(
    (projectId: string, month: Date) => {
      return computeProjectHoursForMonth(projectId, month, { projects, allocations });
    },
    [projects, allocations]
  );

  const getClientTotalHoursForMonth = useCallback(
    (clientId: string, month: Date) => {
      return computeClientTotalHoursForMonth(clientId, month, { projects, allocations });
    },
    [projects, allocations]
  );


  const addRoutine = async (routine: Omit<UserRoutine, 'id'>) => {
    const { data, error } = await supabase.from('user_routines').insert({
      employee_id: routine.employeeId,
      title: routine.title,
      estimated_minutes: routine.estimatedMinutes,
      project_id: routine.projectId,
      is_active: routine.isActive
    }).select().single();

    if (error) {
      console.error(error);
      toast.error("Error creando rutina");
      return;
    }

    if (data) {
      setUserRoutines(prev => [...prev, {
        id: data.id,
        employeeId: data.employee_id,
        title: data.title,
        estimatedMinutes: data.estimated_minutes,
        projectId: data.project_id,
        isActive: data.is_active
      }]);
      toast.success("Rutina creada");
    }
  };



  // --- TRANSFERS ---
  const fetchTransfers = useCallback(async () => {
    if (!currentUser?.id || !currentUser.agencyId) return;

    try {
      // 1. Incoming: Transfers sent TO me (pending)
      const { data: incoming, error: inError } = await supabase
        .from('task_transfers')
        .select(`
          *,
          from_employee:employees!task_transfers_from_employee_id_fkey(name),
          allocation:allocations!task_transfers_allocation_id_fkey(task_name, project_id, week_start_date)
        `)
        .eq('to_employee_id', currentUser.id)
        .eq('status', 'pending')
        .order('requested_at', { ascending: false });

      if (inError) throw inError;

      // 2. Agency Pending: ALL pending transfers in the agency (for locking logic in Planner)
      const { data: agencyPending, error: pendingError } = await supabase
        .from('task_transfers')
        .select(`
          *,
          to_employee:employees!task_transfers_to_employee_id_fkey(name),
          allocation:allocations!task_transfers_allocation_id_fkey(task_name, project_id, week_start_date)
        `)
        .eq('agency_id', currentUser.agencyId)
        .eq('status', 'pending');

      if (pendingError) throw pendingError;

      // 3. My History: Accepted/Rejected transfers where I was the sender (for history list)
      const { data: myHistory, error: historyError } = await supabase
        .from('task_transfers')
        .select(`
          *,
          to_employee:employees!task_transfers_to_employee_id_fkey(name),
          allocation:allocations!task_transfers_allocation_id_fkey(task_name, project_id, week_start_date)
        `)
        .eq('from_employee_id', currentUser.id)
        .in('status', ['accepted', 'rejected'])
        .order('requested_at', { ascending: false })
        .limit(20);

      if (historyError) throw historyError;

      // Transform function
      const transformTransfer = (t: any): TaskTransfer => {
        const projectId = t.allocation?.project_id;
        const project = projects.find(p => p.id === projectId);

        return {
          id: t.id,
          allocationId: t.allocation_id,
          fromEmployeeId: t.from_employee_id,
          toEmployeeId: t.to_employee_id,
          status: t.status,
          reason: t.reason,
          rejectionReason: t.rejection_reason,
          hours: t.hours_transferred,
          hoursTransferred: t.hours_transferred,
          requestedAt: t.requested_at,
          respondedAt: t.responded_at,
          agencyId: t.agency_id,
          acceptanceMode: t.acceptance_mode,
          fromEmployeeName: t.from_employee?.name,
          toEmployeeName: t.to_employee?.name,
          taskName: t.allocation?.task_name,
          projectId: projectId,
          projectName: project?.name || 'Proyecto desconocido',
          originalWeek: t.allocation?.week_start_date
        };
      };

      const pendingMapped = (agencyPending || []).map(transformTransfer);
      const historyMapped = (myHistory || []).map(transformTransfer);

      // Combine for outgoingTransfers state (Pending first, then History)
      const combinedMap = new Map<string, TaskTransfer>();
      pendingMapped.forEach(t => combinedMap.set(t.id, t));
      historyMapped.forEach(t => combinedMap.set(t.id, t));

      setPendingTransfers((incoming || []).map(transformTransfer));
      setOutgoingTransfers(Array.from(combinedMap.values()));

    } catch (error) {
      console.error('Error fetching transfers:', error);
    }
  }, [currentUser?.id, currentUser?.agencyId, projects]);

  useEffect(() => {
    if (currentUser?.id) {
      fetchTransfers();
    }
  }, [fetchTransfers, currentUser?.id]); // Also depends on fetchTransfers which depends on projects

  // Realtime: actualizar bloqueos y badges cuando alguien acepta/rechaza una transferencia
  useEffect(() => {
    if (!currentAgency?.id) return;

    const channel = supabase
      .channel(`task-transfers-${currentAgency.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_transfers',
          filter: `agency_id=eq.${currentAgency.id}`,
        },
        () => {
          void fetchTransfers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentAgency?.id, fetchTransfers]);

  const deleteRoutine = async (id: string) => {
    setUserRoutines(prev => prev.filter(r => r.id !== id));
    await supabase.from('user_routines').delete().eq('id', id);
  };

  const toggleRoutine = async (id: string) => {
    const routine = userRoutines.find(r => r.id === id);
    if (!routine) return;

    const newValue = !routine.isActive;
    setUserRoutines(prev => prev.map(r => r.id === id ? { ...r, isActive: newValue } : r));
    await supabase.from('user_routines').update({ is_active: newValue }).eq('id', id);
  };

  const getProjectById = useCallback((id: string) => projects.find(p => p.id === id), [projects]);
  const getClientById = useCallback((id: string) => clients.find(c => c.id === id), [clients]);

  // Determinar si el usuario es admin basándose en permisos del rol (no en nombre hardcodeado)
  const isUserAdmin = useMemo(() => {
    if (!currentUser?.role || !currentAgency?.settings?.roles) return false;
    const userRole = currentAgency.settings.roles.find(r => r.name === currentUser.role);
    return userRole?.permissions?.can_access_agency_settings === true;
  }, [currentUser?.role, currentAgency?.settings?.roles]);

  const value = useMemo(() => ({
    currentUser,
    isAdmin: isUserAdmin,
    employees, clients, projects, allocations, absences, teamEvents, weeklyFeedback, isLoading,
    isSecondaryLoading, fetchArchivedProjects,
    addEmployee, updateEmployee, deleteEmployee, toggleEmployeeActive,
    addClient, updateClient, deleteClient,
    addProject, updateProject, deleteProject,
    addAllocation, updateAllocation, deleteAllocation,
    addAbsence, deleteAbsence,
    addTeamEvent, updateTeamEvent, deleteTeamEvent,
    getEmployeeAllocationsForWeek, getEmployeeLoadForWeek, getEmployeeMonthlyLoad,
    getProjectHoursForMonth, getClientTotalHoursForMonth, getProjectById, getClientById,
    loadDataForMonth,
    ensureMonthLoaded,
    refetchMonthData,
    ensureMonthsLoadedInRange,
    addWeeklyFeedback,
    refreshData: fetchData,
    userRoutines, addRoutine, deleteRoutine, toggleRoutine,
    pendingTransfers, outgoingTransfers, fetchTransfers
    // eslint-disable-next-line react-hooks/exhaustive-deps -- omit fetchTransfers/toggleRoutine/isUserAdmin to limit value churn
  }), [currentUser, employees, clients, projects, allocations, absences, teamEvents, weeklyFeedback, isLoading,
    isSecondaryLoading, fetchArchivedProjects,
    addEmployee, updateEmployee, deleteEmployee, toggleEmployeeActive,
    addClient, updateClient, deleteClient,
    addProject, updateProject, deleteProject,
    addAllocation, updateAllocation, deleteAllocation,
    addAbsence, deleteAbsence,
    addTeamEvent, updateTeamEvent, deleteTeamEvent,
    getEmployeeAllocationsForWeek, getEmployeeLoadForWeek, getEmployeeMonthlyLoad,
    getProjectHoursForMonth, getClientTotalHoursForMonth, getProjectById, getClientById,
    loadDataForMonth, ensureMonthLoaded, refetchMonthData, ensureMonthsLoadedInRange,
    addWeeklyFeedback, fetchData, userRoutines,
    pendingTransfers, outgoingTransfers]); // Added transfer deps

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
}

// Selectores finos para evitar que todos los consumidores dependan de todo el contexto.
// Permiten ir migrando páginas a hooks más específicos sin cambiar la API existente.

export function useAppEmployees() {
  const { employees, currentUser } = useApp();
  return { employees, currentUser };
}

export function useAppProjects() {
  const { projects, clients, getProjectById, getClientById } = useApp();
  return { projects, clients, getProjectById, getClientById };
}

export function useAppAllocations() {
  const {
    allocations,
    getEmployeeAllocationsForWeek,
    getEmployeeLoadForWeek,
    getEmployeeMonthlyLoad,
    getProjectHoursForMonth,
    getClientTotalHoursForMonth,
    loadDataForMonth,
    ensureMonthLoaded,
    refetchMonthData,
    ensureMonthsLoadedInRange,
  } = useApp();

  return {
    allocations,
    getEmployeeAllocationsForWeek,
    getEmployeeLoadForWeek,
    getEmployeeMonthlyLoad,
    getProjectHoursForMonth,
    getClientTotalHoursForMonth,
    loadDataForMonth,
    ensureMonthLoaded,
    refetchMonthData,
    ensureMonthsLoadedInRange,
  };
}

export function useAppAbsencesAndEvents() {
  const { absences, teamEvents } = useApp();
  return { absences, teamEvents };
}

export function useAppAllocationActions() {
  const { addAllocation, updateAllocation, deleteAllocation, isLoading } = useApp();
  return { addAllocation, updateAllocation, deleteAllocation, isLoading };
}

export function useAppWeeklyFeedback() {
  const { weeklyFeedback, addWeeklyFeedback } = useApp();
  return { weeklyFeedback, addWeeklyFeedback };
}
