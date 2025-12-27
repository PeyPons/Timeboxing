import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Employee, Client, Project, Allocation, LoadStatus, Absence, TeamEvent, ProfessionalGoal } from '@/types';
import { getWorkingDaysInRange, getMonthlyCapacity, getWeeksForMonth, getStorageKey } from '@/utils/dateUtils';
import { getAbsenceHoursInRange } from '@/utils/absenceUtils';
import { getTeamEventHoursInRange, getTeamEventDetailsInRange } from '@/utils/teamEventUtils';
import { addDays } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

interface AppContextType {
  currentUser: Employee | undefined;
  isAdmin: boolean;
  employees: Employee[];
  clients: Client[];
  projects: Project[];
  allocations: Allocation[];
  absences: Absence[];
  teamEvents: TeamEvent[];
  isLoading: boolean;
  addEmployee: (employee: Omit<Employee, 'id'>) => Promise<void>;
  updateEmployee: (employee: Employee) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
  toggleEmployeeActive: (id: string) => Promise<void>;
  addClient: (client: Omit<Client, 'id'>) => void;
  updateClient: (client: Client) => void;
  deleteClient: (id: string) => void;
  addProject: (project: Omit<Project, 'id'>) => void;
  updateProject: (project: Project) => void;
  deleteProject: (id: string) => void;
  addAllocation: (allocation: Omit<Allocation, 'id'>) => void;
  updateAllocation: (allocation: Allocation) => void;
  deleteAllocation: (id: string) => void;
  addAbsence: (absence: Omit<Absence, 'id'>) => void;
  deleteAbsence: (id: string) => void;
  addTeamEvent: (event: Omit<TeamEvent, 'id'>) => void;
  updateTeamEvent: (event: TeamEvent) => void;
  deleteTeamEvent: (id: string) => void;
  getEmployeeAllocationsForWeek: (employeeId: string, weekStart: string) => Allocation[];
  getEmployeeLoadForWeek: (employeeId: string, weekStart: string, effectiveStart?: Date, effectiveEnd?: Date) => { hours: number; capacity: number; baseCapacity: number; status: LoadStatus; percentage: number; breakdown: { reason: string; hours: number; type: 'absence' | 'event' }[] };
  getEmployeeMonthlyLoad: (employeeId: string, year: number, month: number) => { hours: number; capacity: number; status: LoadStatus; percentage: number };
  getProjectHoursForMonth: (projectId: string, month: Date) => { used: number; budget: number; available: number; percentage: number };
  getClientTotalHoursForMonth: (clientId: string, month: Date) => { used: number; budget: number; percentage: number };
  getProjectById: (id: string) => Project | undefined;
  getClientById: (id: string) => Client | undefined;
  professionalGoals: ProfessionalGoal[];
  addProfessionalGoal: (goal: Omit<ProfessionalGoal, 'id'>) => void;
  updateProfessionalGoal: (goal: ProfessionalGoal) => void;
  deleteProfessionalGoal: (id: string) => void;
  getEmployeeGoals: (employeeId: string) => ProfessionalGoal[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user: authUser, isInitialized: isAuthInitialized } = useAuth();
  const [currentUser, setCurrentUser] = useState<Employee | undefined>(undefined);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [teamEvents, setTeamEvents] = useState<TeamEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [professionalGoals, setProfessionalGoals] = useState<ProfessionalGoal[]>([]);

  const fetchData = useCallback(async (skipLoading = false) => {
    if (!skipLoading) {
      setIsLoading(true);
    }
    try {
      const [empRes, cliRes, projRes, allocRes, absRes, evRes, goalsRes] = await Promise.all([
        supabase.from('employees').select('*'),
        supabase.from('clients').select('*'),
        supabase.from('projects').select('*'),
        supabase.from('allocations').select('*'),
        supabase.from('absences').select('*'),
        supabase.from('team_events').select('*'),
        supabase.from('professional_goals').select('*'),
      ]);

      if (empRes.data) {
        const mappedEmployees = empRes.data.map((e: any) => ({
          ...e,
          avatarUrl: e.avatar_url,
          defaultWeeklyCapacity: e.default_weekly_capacity,
          workSchedule: e.work_schedule,
          isActive: e.is_active,
          first_name: e.first_name,
          last_name: e.last_name,
          email: e.email,
          user_id: e.user_id,
          crmUserId: e.crm_user_id,
          welcomeTourCompleted: e.welcome_tour_completed === true,
          deadlinesTourCompleted: e.deadlines_tour_completed === true,
          permissions: e.permissions || undefined
        }));
        setEmployees(mappedEmployees);
        // La vinculación de currentUser se hace en el useEffect que escucha authUser
      }

      if (cliRes.data) setClients(cliRes.data);
      if (projRes.data) {
        setProjects(projRes.data.map((p: any) => ({
          ...p,
          clientId: p.client_id,
          budgetHours: round2(p.budget_hours),
          minimumHours: round2(p.minimum_hours || 0),
          monthlyFee: p.monthly_fee,
          healthStatus: p.health_status,
          externalId: p.external_id,      // NUEVO: ID externo del CRM
          projectType: p.project_type     // NUEVO: Tipo de proyecto
        })));
      }
      if (allocRes.data) {
        setAllocations(allocRes.data.map((a: any) => ({
          ...a,
          employeeId: a.employee_id,
          projectId: a.project_id,
          weekStartDate: a.week_start_date,
          hoursAssigned: round2(a.hours_assigned),
          hoursActual: a.hours_actual ? round2(a.hours_actual) : undefined,
          hoursComputed: a.hours_computed ? round2(a.hours_computed) : undefined,
          taskName: a.task_name,
          dependencyId: a.dependency_id // <--- Mapeo
        })));
      }
      if (absRes.data) {
        setAbsences(absRes.data.map((ab: any) => ({
          ...ab,
          employeeId: ab.employee_id,
          startDate: ab.start_date,
          endDate: ab.end_date,
          hours: ab.hours
        })));
      }
      if (goalsRes.data) {
        setProfessionalGoals(goalsRes.data.map((g: any) => ({
          ...g,
          employeeId: g.employee_id,
          keyResults: g.key_results,
          trainingUrl: g.training_url,
          startDate: g.start_date,
          dueDate: g.due_date
        })));
      }
      if (evRes.data) {
        setTeamEvents(evRes.data.map((te: any) => ({
          ...te,
          hoursReduction: te.hours_reduction,
          affectedEmployeeIds: te.affected_employee_ids
        })));
      }
    } catch (error) {
      console.error("Error cargando datos:", error);
      // Asegurarse de que isLoading se desactive incluso si hay error
      setIsLoading(false);
    } finally {
      if (!skipLoading) {
        setIsLoading(false);
      }
    }
  }, []);

  // Cargar datos cuando la autenticación esté lista
  useEffect(() => {
    if (isAuthInitialized) {
      fetchData();
    }
  }, [isAuthInitialized, fetchData]);

  // Ref para evitar vinculaciones duplicadas
  const hasLinkedUserRef = useRef<string | null>(null);

  // Reaccionar a cambios de usuario (login/logout) - SOLO cuando employees esté cargado
  useEffect(() => {
    // No hacer nada si auth no está inicializado
    if (!isAuthInitialized) return;
    
    // No hacer nada si aún estamos cargando datos
    if (isLoading) return;
    
    // No hacer nada si employees aún no se ha cargado
    if (employees.length === 0) return;

    if (authUser) {
      // Evitar vincular múltiples veces al mismo usuario
      if (hasLinkedUserRef.current === authUser.id) {
        return;
      }

      // Buscar empleado por user_id o por email
      const foundEmployee = employees.find(e => 
        e.user_id === authUser.id || 
        (e.email && authUser.email && e.email.toLowerCase() === authUser.email.toLowerCase())
      );

      if (foundEmployee) {
        // Marcar como vinculado
        hasLinkedUserRef.current = authUser.id;

        // Si el empleado no tiene user_id pero el email coincide, vincular automáticamente
        if (!foundEmployee.user_id && authUser.id) {
          console.log('[AppContext] Vinculando empleado existente con usuario Auth:', foundEmployee.email);
          supabase
            .from('employees')
            .update({ user_id: authUser.id })
            .eq('id', foundEmployee.id)
            .then(({ error }) => {
              if (error) {
                console.error('[AppContext] Error actualizando user_id:', error);
              } else {
                console.log('[AppContext] user_id actualizado correctamente');
                const updatedEmployee = { ...foundEmployee, user_id: authUser.id };
                setEmployees(prev => prev.map(e => e.id === foundEmployee.id ? updatedEmployee : e));
                setCurrentUser(updatedEmployee);
              }
            });
        } else {
          setCurrentUser(foundEmployee);
        }
      } else {
        // Solo mostrar warning si realmente no existe (employees ya cargado)
        console.warn('[AppContext] No se encontró empleado para usuario Auth:', authUser.email);
        setCurrentUser(undefined);
      }
    } else {
      // Usuario deslogueado - resetear
      hasLinkedUserRef.current = null;
      setCurrentUser(undefined);
    }
  }, [authUser, isAuthInitialized, isLoading, employees]);

  const addEmployee = useCallback(async (employee: Omit<Employee, 'id'>) => {
    const { data, error } = await supabase.from('employees').insert({
      name: employee.name,
      first_name: employee.first_name,
      last_name: employee.last_name,
      email: employee.email,
      user_id: employee.user_id, // ✅ CRÍTICO: Guardar el user_id de Auth
      role: employee.role,
      department: employee.department,
      avatar_url: employee.avatarUrl,
      default_weekly_capacity: employee.defaultWeeklyCapacity,
      work_schedule: employee.workSchedule,
      is_active: employee.isActive,
      hourly_rate: employee.hourlyRate || 0,
      crm_user_id: employee.crmUserId,
      permissions: employee.permissions || null
    }).select().single();

    if (error) {
      console.error('Error creando empleado:', error);
      throw error;
    }

    if (data) {
      const mappedEmployee: Employee = {
        ...data,
        avatarUrl: data.avatar_url,
        defaultWeeklyCapacity: data.default_weekly_capacity,
        workSchedule: data.work_schedule,
        isActive: data.is_active,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        user_id: data.user_id,
        hourlyRate: data.hourly_rate || 0,
        crmUserId: data.crm_user_id,
        welcomeTourCompleted: data.welcome_tour_completed === true,
        deadlinesTourCompleted: data.deadlines_tour_completed === true,
        permissions: data.permissions || undefined
      };
      setEmployees(prev => [...prev, mappedEmployee]);
    }
  }, []);

  const updateEmployee = useCallback(async (employee: Employee) => {
    setEmployees(prev => prev.map(e => e.id === employee.id ? employee : e));
    const { error } = await supabase.from('employees').update({
      name: employee.name,
      first_name: employee.first_name,
      last_name: employee.last_name,
      email: employee.email,
      user_id: employee.user_id, // ✅ CRÍTICO: Actualizar también el user_id
      role: employee.role,
      department: employee.department,
      avatar_url: employee.avatarUrl,
      default_weekly_capacity: employee.defaultWeeklyCapacity,
      work_schedule: employee.workSchedule,
      is_active: employee.isActive,
      hourly_rate: employee.hourlyRate || 0,
      crm_user_id: employee.crmUserId,
      welcome_tour_completed: employee.welcomeTourCompleted || false,
      deadlines_tour_completed: employee.deadlinesTourCompleted || false,
      permissions: employee.permissions || null
    }).eq('id', employee.id);
    
    if (error) {
      console.error('Error actualizando empleado:', error);
      throw error;
    }
  }, []);

  const deleteEmployee = useCallback(async (id: string) => {
    setEmployees(prev => prev.filter(e => e.id !== id));
    setAllocations(prev => prev.filter(a => a.employeeId !== id));
    setAbsences(prev => prev.filter(a => a.employeeId !== id));
    await supabase.from('employees').delete().eq('id', id);
  }, []);

  const toggleEmployeeActive = useCallback(async (id: string) => {
    const emp = employees.find(e => e.id === id);
    if (!emp) return;
    const newState = !emp.isActive;
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, isActive: newState } : e));
    await supabase.from('employees').update({ is_active: newState }).eq('id', id);
  }, [employees]);

  // --- ALLOCATIONS (Actualizado con dependency_id) ---
  const addAllocation = useCallback(async (allocation: Omit<Allocation, 'id'>) => { 
    const { data } = await supabase.from('allocations').insert({ 
      employee_id: allocation.employeeId, 
      project_id: allocation.projectId, 
      week_start_date: allocation.weekStartDate, 
      hours_assigned: allocation.hoursAssigned, 
      hours_actual: allocation.hoursActual||0, 
      hours_computed: allocation.hoursComputed||0, 
      status: allocation.status, 
      description: allocation.description, 
      task_name: allocation.taskName,
      dependency_id: allocation.dependencyId 
    }).select().single(); 
    
    if(data) setAllocations(prev => [...prev, { 
        ...data, 
        employeeId: data.employee_id, 
        projectId: data.project_id, 
        weekStartDate: data.week_start_date, 
        hoursAssigned: round2(data.hours_assigned), 
        hoursActual: round2(data.hours_actual), 
        hoursComputed: round2(data.hours_computed), 
        taskName: data.task_name,
        dependencyId: data.dependency_id
    }]); 
  }, []);

  const updateAllocation = useCallback(async (allocation: Allocation) => { 
    setAllocations(prev => prev.map(a => a.id === allocation.id ? allocation : a)); 
    await supabase.from('allocations').update({ 
      hours_assigned: allocation.hoursAssigned, 
      hours_actual: allocation.hoursActual, 
      hours_computed: allocation.hoursComputed, 
      status: allocation.status, 
      description: allocation.description, 
      task_name: allocation.taskName,
      dependency_id: allocation.dependencyId
    }).eq('id', allocation.id); 
  }, []);

  const deleteAllocation = useCallback(async (id: string) => { setAllocations(prev => prev.filter(a => a.id !== id)); await supabase.from('allocations').delete().eq('id', id); }, []);
  
  // ... Resto de funciones CRUD (Client, Project, etc) se mantienen igual ...
  const addClient = useCallback(async (client: Omit<Client, 'id'>) => { const { data } = await supabase.from('clients').insert(client).select().single(); if(data) setClients(prev => [...prev, data]); }, []);
  const updateClient = useCallback(async (client: Client) => { setClients(prev => prev.map(c => c.id === client.id ? client : c)); await supabase.from('clients').update({ name: client.name, color: client.color }).eq('id', client.id); }, []);
  const deleteClient = useCallback(async (id: string) => { setClients(prev => prev.filter(c => c.id !== id)); setProjects(prev => prev.filter(p => p.clientId !== id)); await supabase.from('clients').delete().eq('id', id); }, []);
  const addProject = useCallback(async (project: Omit<Project, 'id'>) => { const { data } = await supabase.from('projects').insert({ client_id: project.clientId, name: project.name, status: project.status, budget_hours: project.budgetHours, minimum_hours: project.minimumHours }).select().single(); if(data) setProjects(prev => [...prev, { ...data, clientId: data.client_id, budgetHours: round2(data.budget_hours), minimumHours: round2(data.minimum_hours) }]); }, []);
  const updateProject = useCallback(async (project: Project) => { setProjects(prev => prev.map(p => p.id === project.id ? project : p)); await supabase.from('projects').update({ client_id: project.clientId, name: project.name, status: project.status, budget_hours: project.budgetHours, minimum_hours: project.minimumHours }).eq('id', project.id); }, []);
  const deleteProject = useCallback(async (id: string) => { setProjects(prev => prev.filter(p => p.id !== id)); setAllocations(prev => prev.filter(a => a.projectId !== id)); await supabase.from('projects').delete().eq('id', id); }, []);
  const addAbsence = useCallback(async (absence: Omit<Absence, 'id'>) => { const { data } = await supabase.from('absences').insert({ employee_id: absence.employeeId, start_date: absence.startDate, end_date: absence.endDate, type: absence.type, description: absence.description, hours: absence.hours }).select().single(); if(data) setAbsences(prev => [...prev, { ...data, employeeId: data.employee_id, startDate: data.start_date, endDate: data.end_date, hours: data.hours }]); }, []);
  const deleteAbsence = useCallback(async (id: string) => { setAbsences(prev => prev.filter(a => a.id !== id)); await supabase.from('absences').delete().eq('id', id); }, []);
  const addTeamEvent = useCallback(async (event: Omit<TeamEvent, 'id'>) => { const { data } = await supabase.from('team_events').insert({ name: event.name, date: event.date, hours_reduction: event.hoursReduction, affected_employee_ids: event.affectedEmployeeIds, description: event.description }).select().single(); if(data) setTeamEvents(prev => [...prev, { ...data, hoursReduction: data.hours_reduction, affectedEmployeeIds: data.affected_employee_ids }]); }, []);
  const updateTeamEvent = useCallback(async (event: TeamEvent) => { setTeamEvents(prev => prev.map(e => e.id === event.id ? event : e)); await supabase.from('team_events').update({ name: event.name, date: event.date, hours_reduction: event.hoursReduction, affected_employee_ids: event.affectedEmployeeIds, description: event.description }).eq('id', event.id); }, []);
  const deleteTeamEvent = useCallback(async (id: string) => { setTeamEvents(prev => prev.filter(e => e.id !== id)); await supabase.from('team_events').delete().eq('id', id); }, []);
  const addProfessionalGoal = useCallback(async (goal: Omit<ProfessionalGoal, 'id'>) => { const { data } = await supabase.from('professional_goals').insert({ employee_id: goal.employeeId, title: goal.title, key_results: goal.keyResults, actions: goal.actions, training_url: goal.trainingUrl, start_date: goal.startDate, due_date: goal.dueDate, progress: goal.progress }).select().single(); if(data) setProfessionalGoals(prev => [...prev, { ...data, employeeId: data.employee_id, keyResults: data.key_results, trainingUrl: data.training_url, startDate: data.start_date, dueDate: data.due_date }]); }, []);
  const updateProfessionalGoal = useCallback(async (goal: ProfessionalGoal) => { setProfessionalGoals(prev => prev.map(g => g.id === goal.id ? goal : g)); await supabase.from('professional_goals').update({ title: goal.title, key_results: goal.keyResults, actions: goal.actions, training_url: goal.trainingUrl, start_date: goal.startDate, due_date: goal.dueDate, progress: goal.progress }).eq('id', goal.id); }, []);
  const deleteProfessionalGoal = useCallback(async (id: string) => { setProfessionalGoals(prev => prev.filter(g => g.id !== id)); await supabase.from('professional_goals').delete().eq('id', id); }, []);
  const getEmployeeGoals = useCallback((employeeId: string) => professionalGoals.filter(g => g.employeeId === employeeId), [professionalGoals]);

  const getEmployeeAllocationsForWeek = useCallback((employeeId: string, weekStart: string) => {
    return allocations.filter(a => a.employeeId === employeeId && a.weekStartDate === weekStart);
  }, [allocations]);

  const getEmployeeLoadForWeek = useCallback((employeeId: string, weekStart: string, effectiveStart?: Date, effectiveEnd?: Date) => {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return { hours: 0, capacity: 0, baseCapacity: 0, status: 'empty' as LoadStatus, percentage: 0, breakdown: [] };

    const employeeAllocations = allocations.filter(a => a.employeeId === employeeId && a.weekStartDate === weekStart);
    const totalHours = round2(employeeAllocations.reduce((sum, a) => sum + (a.status === 'completed' && (a.hoursActual || 0) > 0 ? Number(a.hoursActual) : Number(a.hoursAssigned)), 0));
    
    const weekStartDate = new Date(weekStart);
    const weekEndDate = addDays(weekStartDate, 6);
    const rangeStart = effectiveStart || weekStartDate;
    const rangeEnd = effectiveEnd || weekEndDate;
    
    let baseCapacity: number;
    if (effectiveStart && effectiveEnd) {
      const { totalHours: capacityHours } = getWorkingDaysInRange(effectiveStart, effectiveEnd, employee.workSchedule);
      baseCapacity = capacityHours;
    } else {
      baseCapacity = employee.defaultWeeklyCapacity;
    }

    const breakdown: { reason: string; hours: number; type: 'absence' | 'event' }[] = [];
    let reducedCapacity = baseCapacity;

    const relevantAbsences = absences.filter(a => a.employeeId === employeeId);
    const absenceReductionTotal = getAbsenceHoursInRange(rangeStart, rangeEnd, relevantAbsences, employee.workSchedule);
    if (absenceReductionTotal > 0) {
        relevantAbsences.forEach(abs => {
            const absStart = new Date(abs.startDate);
            const absEnd = new Date(abs.endDate);
            if (absStart <= rangeEnd && absEnd >= rangeStart) {
               const specificHours = getAbsenceHoursInRange(rangeStart, rangeEnd, [abs], employee.workSchedule);
               if (specificHours > 0) breakdown.push({ reason: `Ausencia: ${abs.type}`, hours: specificHours, type: 'absence' });
            }
        });
        reducedCapacity -= absenceReductionTotal;
    }

    // NUEVO: Pasar las ausencias del empleado para no contar eventos en días de ausencia
    const eventReductionTotal = getTeamEventHoursInRange(rangeStart, rangeEnd, employeeId, teamEvents, employee.workSchedule, relevantAbsences);
    if (eventReductionTotal > 0) {
        // Usar getTeamEventDetailsInRange para obtener las horas correctas por empleado
        const eventDetails = getTeamEventDetailsInRange(rangeStart, rangeEnd, employeeId, teamEvents, employee.workSchedule, relevantAbsences);
        eventDetails.forEach(detail => {
            breakdown.push({ reason: `Evento: ${detail.name}`, hours: detail.hours, type: 'event' });
        });
        reducedCapacity -= eventReductionTotal;
    }

    reducedCapacity = Math.max(0, round2(reducedCapacity));
    const percentage = reducedCapacity > 0 ? round2((totalHours / reducedCapacity) * 100) : (totalHours > 0 ? 999 : 0);
    let status: LoadStatus = 'empty';
    if (totalHours === 0) status = 'empty';
    else if (reducedCapacity === 0 && totalHours > 0) status = 'overload';
    else if (percentage <= 85) status = 'healthy';
    else if (percentage <= 100) status = 'warning';
    else status = 'overload';

    return { hours: totalHours, capacity: reducedCapacity, baseCapacity, status, percentage, breakdown };
  }, [employees, allocations, absences, teamEvents]);

  const getEmployeeMonthlyLoad = useCallback((employeeId: string, year: number, month: number) => {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return { hours: 0, capacity: 0, status: 'empty' as LoadStatus, percentage: 0 };
    const monthStart = new Date(year, month, 1);
    const weeks = getWeeksForMonth(monthStart);
    let totalHours = 0;
    weeks.forEach(week => {
        const storageKey = getStorageKey(week.weekStart, monthStart);
        const tasks = allocations.filter(a => a.employeeId === employeeId && a.weekStartDate === storageKey);
        totalHours += tasks.reduce((sum, a) => sum + (a.status === 'completed' && (a.hoursActual || 0) > 0 ? Number(a.hoursActual) : Number(a.hoursAssigned)), 0);
    });
    totalHours = round2(totalHours);
    const monthEnd = new Date(year, month + 1, 0);
    const employeeAbsences = absences.filter(a => a.employeeId === employeeId);
    let capacity = getMonthlyCapacity(year, month, employee.workSchedule);
    capacity = Math.max(0, capacity - getAbsenceHoursInRange(monthStart, monthEnd, employeeAbsences, employee.workSchedule));
    // NUEVO: Pasar ausencias para no contar eventos en días de ausencia
    capacity = Math.max(0, capacity - getTeamEventHoursInRange(monthStart, monthEnd, employeeId, teamEvents, employee.workSchedule, employeeAbsences));
    capacity = round2(capacity);
    const percentage = capacity > 0 ? round2((totalHours / capacity) * 100) : (totalHours > 0 ? 999 : 0);
    let status: LoadStatus = 'empty';
    if (totalHours === 0) status = 'empty';
    else if (capacity === 0 && totalHours > 0) status = 'overload';
    else if (percentage <= 85) status = 'healthy';
    else if (percentage <= 100) status = 'warning';
    else status = 'overload';
    return { hours: totalHours, capacity, status, percentage };
  }, [employees, allocations, absences, teamEvents]);

  const getProjectHoursForMonth = useCallback((projectId: string, month: Date) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return { used: 0, budget: 0, available: 0, percentage: 0 };
    const weeks = getWeeksForMonth(month);
    let usedHours = 0;
    weeks.forEach(week => {
        const storageKey = getStorageKey(week.weekStart, month);
        const tasks = allocations.filter(a => a.projectId === projectId && a.weekStartDate === storageKey);
        usedHours += tasks.reduce((sum, a) => sum + (a.status === 'completed' && (a.hoursActual || 0) > 0 ? Number(a.hoursActual) : Number(a.hoursAssigned)), 0);
    });
    usedHours = round2(usedHours);
    const available = round2(Math.max(0, project.budgetHours - usedHours));
    const percentage = project.budgetHours > 0 ? round2((usedHours / project.budgetHours) * 100) : 0;
    return { used: usedHours, budget: project.budgetHours, available, percentage };
  }, [projects, allocations]);

  const getClientTotalHoursForMonth = useCallback((clientId: string, month: Date) => {
    const clientProjects = projects.filter(p => p.clientId === clientId);
    const weeks = getWeeksForMonth(month);
    let totalUsed = 0;
    let totalBudget = 0;
    clientProjects.forEach(project => {
      totalBudget += Number(project.budgetHours);
      weeks.forEach(week => {
        const storageKey = getStorageKey(week.weekStart, month);
        const tasks = allocations.filter(a => a.projectId === project.id && a.weekStartDate === storageKey);
        totalUsed += tasks.reduce((sum, a) => sum + (a.status === 'completed' && (a.hoursActual || 0) > 0 ? Number(a.hoursActual) : Number(a.hoursAssigned)), 0);
      });
    });
    totalUsed = round2(totalUsed);
    totalBudget = round2(totalBudget);
    const percentage = totalBudget > 0 ? round2((totalUsed / totalBudget) * 100) : 0;
    return { used: totalUsed, budget: totalBudget, percentage };
  }, [projects, allocations]);

  const getProjectById = useCallback((id: string) => projects.find(p => p.id === id), [projects]);
  const getClientById = useCallback((id: string) => clients.find(c => c.id === id), [clients]);

  const value = useMemo(() => ({
    currentUser,
    isAdmin: currentUser?.role === 'admin' || currentUser?.role === 'manager',
    employees, clients, projects, allocations, absences, teamEvents, isLoading,
    addEmployee, updateEmployee, deleteEmployee, toggleEmployeeActive,
    addClient, updateClient, deleteClient,
    addProject, updateProject, deleteProject,
    addAllocation, updateAllocation, deleteAllocation,
    addAbsence, deleteAbsence,
    addTeamEvent, updateTeamEvent, deleteTeamEvent,
    getEmployeeAllocationsForWeek, getEmployeeLoadForWeek, getEmployeeMonthlyLoad,
    getProjectHoursForMonth, getClientTotalHoursForMonth, getProjectById, getClientById,
    professionalGoals, addProfessionalGoal, updateProfessionalGoal, deleteProfessionalGoal, getEmployeeGoals
  }), [currentUser, employees, clients, projects, allocations, absences, teamEvents, isLoading]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
}
