import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Employee, Client, Project, Allocation, LoadStatus, Absence, TeamEvent, ProfessionalGoal } from '@/types';
import { getWorkingDaysInRange, getMonthlyCapacity, getWeeksForMonth, getStorageKey } from '@/utils/dateUtils';
import { getAbsenceHoursInRange } from '@/utils/absenceUtils';
import { getTeamEventHoursInRange } from '@/utils/teamEventUtils';
import { addDays, isWithinInterval, parseISO } from 'date-fns'; // ✅ Añadido isWithinInterval, parseISO

interface AppContextType {
  employees: Employee[];
  clients: Client[];
  projects: Project[];
  allocations: Allocation[];
  absences: Absence[];
  teamEvents: TeamEvent[];
  isLoading: boolean;
  addEmployee: (employee: Omit<Employee, 'id'>) => void;
  updateEmployee: (employee: Employee) => void;
  deleteEmployee: (id: string) => void;
  toggleEmployeeActive: (id: string) => void;
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
  // ✅ Actualizamos el tipo de retorno para incluir el desglose
  getEmployeeLoadForWeek: (employeeId: string, weekStart: string, effectiveStart?: Date, effectiveEnd?: Date) => { 
      hours: number; 
      capacity: number; 
      baseCapacity: number; // Nuevo
      status: LoadStatus; 
      percentage: number;
      breakdown: { reason: string; hours: number; type: 'absence' | 'event' }[] // Nuevo
  };
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
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [teamEvents, setTeamEvents] = useState<TeamEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [professionalGoals, setProfessionalGoals] = useState<ProfessionalGoal[]>([]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
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
        setEmployees(empRes.data.map((e: any) => ({
          ...e,
          defaultWeeklyCapacity: e.default_weekly_capacity,
          workSchedule: e.work_schedule,
          isActive: e.is_active
        })));
      }
      if (cliRes.data) setClients(cliRes.data);
      if (projRes.data) {
        setProjects(projRes.data.map((p: any) => ({
          ...p,
          clientId: p.client_id,
          budgetHours: round2(p.budget_hours),
          minimumHours: round2(p.minimum_hours || 0)
        })));
      }
      if (allocRes.data) {
        setAllocations(allocRes.data.map((a: any) => ({
          ...a,
          employeeId: a.employee_id,
          projectId: a.project_id,
          weekStartDate: a.week_start_date,
          hoursAssigned: round2(a.hours_assigned),
          taskName: a.task_name
        })));
      }
      if (absRes.data) {
        setAbsences(absRes.data.map((ab: any) => ({
          ...ab,
          employeeId: ab.employee_id,
          startDate: ab.start_date,
          endDate: ab.end_date,
          hours: ab.hours // Asumiendo que ya añadiste la columna hours a la DB
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
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ... (CRUD OPERATIONS SE MANTIENEN IGUAL QUE ANTES, CÓPIALAS DEL ARCHIVO ANTERIOR) ...
  // Para ahorrar espacio aquí, asumo que las operaciones add/update/delete están igual.
  const addProfessionalGoal = useCallback(async (goal: Omit<ProfessionalGoal, 'id'>) => { const { data } = await supabase.from('professional_goals').insert({ employee_id: goal.employeeId, title: goal.title, key_results: goal.keyResults, actions: goal.actions, training_url: goal.trainingUrl, start_date: goal.startDate, due_date: goal.dueDate, progress: goal.progress }).select().single(); if (data) setProfessionalGoals(prev => [...prev, { ...data, employeeId: data.employee_id, keyResults: data.key_results, trainingUrl: data.training_url, startDate: data.start_date, dueDate: data.due_date }]); }, []);
  const updateProfessionalGoal = useCallback(async (goal: ProfessionalGoal) => { setProfessionalGoals(prev => prev.map(g => g.id === goal.id ? goal : g)); await supabase.from('professional_goals').update({ title: goal.title, key_results: goal.keyResults, actions: goal.actions, training_url: goal.trainingUrl, start_date: goal.startDate, due_date: goal.dueDate, progress: goal.progress }).eq('id', goal.id); }, []);
  const deleteProfessionalGoal = useCallback(async (id: string) => { setProfessionalGoals(prev => prev.filter(g => g.id !== id)); await supabase.from('professional_goals').delete().eq('id', id); }, []);
  const getEmployeeGoals = useCallback((employeeId: string) => professionalGoals.filter(g => g.employeeId === employeeId), [professionalGoals]);
  const addEmployee = useCallback(async (employee: Omit<Employee, 'id'>) => { const { data } = await supabase.from('employees').insert({ name: employee.name, role: employee.role, avatar_url: employee.avatarUrl, default_weekly_capacity: employee.defaultWeeklyCapacity, work_schedule: employee.workSchedule, is_active: employee.isActive }).select().single(); if (data) setEmployees(prev => [...prev, { ...data, defaultWeeklyCapacity: data.default_weekly_capacity, workSchedule: data.work_schedule, isActive: data.is_active }]); }, []);
  const updateEmployee = useCallback(async (employee: Employee) => { setEmployees(prev => prev.map(e => e.id === employee.id ? employee : e)); await supabase.from('employees').update({ name: employee.name, role: employee.role, avatar_url: employee.avatarUrl, default_weekly_capacity: employee.defaultWeeklyCapacity, work_schedule: employee.workSchedule, is_active: employee.isActive }).eq('id', employee.id); }, []);
  const deleteEmployee = useCallback(async (id: string) => { setEmployees(prev => prev.filter(e => e.id !== id)); setAllocations(prev => prev.filter(a => a.employeeId !== id)); setAbsences(prev => prev.filter(a => a.employeeId !== id)); await supabase.from('employees').delete().eq('id', id); }, []);
  const toggleEmployeeActive = useCallback(async (id: string) => { const emp = employees.find(e => e.id === id); if (!emp) return; const newState = !emp.isActive; setEmployees(prev => prev.map(e => e.id === id ? { ...e, isActive: newState } : e)); await supabase.from('employees').update({ is_active: newState }).eq('id', id); }, [employees]);
  const addClient = useCallback(async (client: Omit<Client, 'id'>) => { const { data } = await supabase.from('clients').insert(client).select().single(); if (data) setClients(prev => [...prev, data]); }, []);
  const updateClient = useCallback(async (client: Client) => { setClients(prev => prev.map(c => c.id === client.id ? client : c)); await supabase.from('clients').update({ name: client.name, color: client.color }).eq('id', client.id); }, []);
  const deleteClient = useCallback(async (id: string) => { setClients(prev => prev.filter(c => c.id !== id)); setProjects(prev => prev.filter(p => p.clientId !== id)); await supabase.from('clients').delete().eq('id', id); }, []);
  const addProject = useCallback(async (project: Omit<Project, 'id'>) => { const { data } = await supabase.from('projects').insert({ client_id: project.clientId, name: project.name, status: project.status, budget_hours: project.budgetHours, minimum_hours: project.minimumHours }).select().single(); if (data) setProjects(prev => [...prev, { ...data, clientId: data.client_id, budgetHours: round2(data.budget_hours), minimumHours: round2(data.minimum_hours) }]); }, []);
  const updateProject = useCallback(async (project: Project) => { setProjects(prev => prev.map(p => p.id === project.id ? project : p)); await supabase.from('projects').update({ client_id: project.clientId, name: project.name, status: project.status, budget_hours: project.budgetHours, minimum_hours: project.minimumHours }).eq('id', project.id); }, []);
  const deleteProject = useCallback(async (id: string) => { setProjects(prev => prev.filter(p => p.id !== id)); setAllocations(prev => prev.filter(a => a.projectId !== id)); await supabase.from('projects').delete().eq('id', id); }, []);
  const addAllocation = useCallback(async (allocation: Omit<Allocation, 'id'>) => { const { data } = await supabase.from('allocations').insert({ employee_id: allocation.employeeId, project_id: allocation.projectId, week_start_date: allocation.weekStartDate, hours_assigned: allocation.hoursAssigned, status: allocation.status, description: allocation.description, task_name: allocation.taskName }).select().single(); if (data) setAllocations(prev => [...prev, { ...data, employeeId: data.employee_id, projectId: data.project_id, weekStartDate: data.week_start_date, hoursAssigned: round2(data.hours_assigned), taskName: data.task_name }]); }, []);
  const updateAllocation = useCallback(async (allocation: Allocation) => { setAllocations(prev => prev.map(a => a.id === allocation.id ? allocation : a)); await supabase.from('allocations').update({ hours_assigned: allocation.hoursAssigned, status: allocation.status, description: allocation.description, task_name: allocation.taskName }).eq('id', allocation.id); }, []);
  const deleteAllocation = useCallback(async (id: string) => { setAllocations(prev => prev.filter(a => a.id !== id)); await supabase.from('allocations').delete().eq('id', id); }, []);
  const addAbsence = useCallback(async (absence: Omit<Absence, 'id'>) => { const { data } = await supabase.from('absences').insert({ employee_id: absence.employeeId, start_date: absence.startDate, end_date: absence.endDate, type: absence.type, description: absence.description, hours: absence.hours }).select().single(); if (data) setAbsences(prev => [...prev, { ...data, employeeId: data.employee_id, startDate: data.start_date, endDate: data.end_date, hours: data.hours }]); }, []);
  const deleteAbsence = useCallback(async (id: string) => { setAbsences(prev => prev.filter(a => a.id !== id)); await supabase.from('absences').delete().eq('id', id); }, []);
  const addTeamEvent = useCallback(async (event: Omit<TeamEvent, 'id'>) => { const { data } = await supabase.from('team_events').insert({ name: event.name, date: event.date, hours_reduction: event.hoursReduction, affected_employee_ids: event.affectedEmployeeIds, description: event.description }).select().single(); if (data) setTeamEvents(prev => [...prev, { ...data, hoursReduction: data.hours_reduction, affectedEmployeeIds: data.affected_employee_ids }]); }, []);
  const updateTeamEvent = useCallback(async (event: TeamEvent) => { setTeamEvents(prev => prev.map(e => e.id === event.id ? event : e)); await supabase.from('team_events').update({ name: event.name, date: event.date, hours_reduction: event.hoursReduction, affected_employee_ids: event.affectedEmployeeIds, description: event.description }).eq('id', event.id); }, []);
  const deleteTeamEvent = useCallback(async (id: string) => { setTeamEvents(prev => prev.filter(e => e.id !== id)); await supabase.from('team_events').delete().eq('id', id); }, []);

  const getEmployeeAllocationsForWeek = useCallback((employeeId: string, weekStart: string) => {
    return allocations.filter(a => a.employeeId === employeeId && a.weekStartDate === weekStart);
  }, [allocations]);

  // ✅ AQUÍ ESTÁ LA LÓGICA DE DESGLOSE DE CAPACIDAD MEJORADA
  const getEmployeeLoadForWeek = useCallback((employeeId: string, weekStart: string, effectiveStart?: Date, effectiveEnd?: Date) => {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return { hours: 0, capacity: 0, baseCapacity: 0, status: 'empty' as LoadStatus, percentage: 0, breakdown: [] };

    // 1. Horas asignadas (Carga)
    const employeeAllocations = allocations.filter(a => a.employeeId === employeeId && a.weekStartDate === weekStart);
    const totalHours = round2(employeeAllocations.reduce((sum, a) => sum + Number(a.hoursAssigned), 0));
    
    // 2. Definir rango de fechas de la semana
    const weekStartDate = new Date(weekStart);
    const weekEndDate = addDays(weekStartDate, 6);
    const rangeStart = effectiveStart || weekStartDate;
    const rangeEnd = effectiveEnd || weekEndDate;
    
    // 3. Capacidad Base (Antes de reducciones)
    let baseCapacity: number;
    if (effectiveStart && effectiveEnd) {
      const { totalHours: capacityHours } = getWorkingDaysInRange(effectiveStart, effectiveEnd, employee.workSchedule);
      baseCapacity = capacityHours;
    } else {
      baseCapacity = employee.defaultWeeklyCapacity;
    }

    // 4. Calcular reducciones con desglose (Breakdown)
    const breakdown: { reason: string; hours: number; type: 'absence' | 'event' }[] = [];
    let reducedCapacity = baseCapacity;

    // A. Reducciones por Ausencias (Individuales)
    const relevantAbsences = absences.filter(a => a.employeeId === employeeId);
    // Nota: getAbsenceHoursInRange es muy útil, pero para el desglose necesitamos saber CUÁL ausencia.
    // Haremos una iteración simple para detectar solapamientos y añadir al breakdown.
    // (Simplificado: Si la ausencia toca la semana, calculamos su impacto)
    const absenceReductionTotal = getAbsenceHoursInRange(rangeStart, rangeEnd, relevantAbsences, employee.workSchedule);
    
    if (absenceReductionTotal > 0) {
        // Intentamos desglosar por tipo
        relevantAbsences.forEach(abs => {
            const absStart = new Date(abs.startDate);
            const absEnd = new Date(abs.endDate);
            // Si hay intersección simple
            if (absStart <= rangeEnd && absEnd >= rangeStart) {
               // Calculamos impacto de ESTA ausencia específica
               const specificHours = getAbsenceHoursInRange(rangeStart, rangeEnd, [abs], employee.workSchedule);
               if (specificHours > 0) {
                   breakdown.push({
                       reason: `Ausencia: ${abs.type === 'sick_leave' ? 'Baja' : abs.type === 'vacation' ? 'Vacaciones' : 'Personal'}`,
                       hours: specificHours,
                       type: 'absence'
                   });
               }
            }
        });
        reducedCapacity -= absenceReductionTotal;
    }

    // B. Reducciones por Eventos de Equipo (Festivos/Globales)
    // Similar logic for breakdown
    const relevantEvents = teamEvents.filter(te => !te.affectedEmployeeIds || te.affectedEmployeeIds.includes(employeeId));
    const eventReductionTotal = getTeamEventHoursInRange(rangeStart, rangeEnd, employeeId, teamEvents, employee.workSchedule);

    if (eventReductionTotal > 0) {
        relevantEvents.forEach(ev => {
            const evDate = new Date(ev.date);
            if (evDate >= rangeStart && evDate <= rangeEnd) {
                // Cálculo simple: si es día completo resta 8 (o lo que sea), si no, lo que diga
                // Ojo: getTeamEventHoursInRange ya hace la lógica compleja, aquí simplificamos para el label
                breakdown.push({
                    reason: `Evento: ${ev.name}`,
                    hours: Number(ev.hoursReduction),
                    type: 'event'
                });
            }
        });
        reducedCapacity -= eventReductionTotal;
    }

    reducedCapacity = Math.max(0, round2(reducedCapacity));

    const percentage = reducedCapacity > 0 ? round2((totalHours / reducedCapacity) * 100) : (totalHours > 0 ? 999 : 0);

    let status: LoadStatus = 'empty';
    if (totalHours === 0) { status = 'empty'; }
    else if (reducedCapacity === 0 && totalHours > 0) { status = 'overload'; }
    else if (percentage <= 85) { status = 'healthy'; }
    else if (percentage <= 100) { status = 'warning'; }
    else { status = 'overload'; }

    return { hours: totalHours, capacity: reducedCapacity, baseCapacity, status, percentage, breakdown };
  }, [employees, allocations, absences, teamEvents]);

  // ... (Resto de getters como getEmployeeMonthlyLoad, etc. IGUAL QUE ANTES) ...
  const getEmployeeMonthlyLoad = useCallback((employeeId: string, year: number, month: number) => {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return { hours: 0, capacity: 0, status: 'empty' as LoadStatus, percentage: 0 };
    const monthStart = new Date(year, month, 1);
    const weeks = getWeeksForMonth(monthStart);
    let totalHours = 0;
    weeks.forEach(week => {
        const storageKey = getStorageKey(week.weekStart, monthStart);
        const tasks = allocations.filter(a => a.employeeId === employeeId && a.weekStartDate === storageKey);
        const weekTotal = tasks.reduce((sum, t) => sum + Number(t.hoursAssigned), 0);
        totalHours += weekTotal;
    });
    totalHours = round2(totalHours);
    const monthEnd = new Date(year, month + 1, 0);
    let capacity = getMonthlyCapacity(year, month, employee.workSchedule);
    const employeeAbsences = absences.filter(a => a.employeeId === employeeId);
    const absenceHours = getAbsenceHoursInRange(monthStart, monthEnd, employeeAbsences, employee.workSchedule);
    capacity = Math.max(0, capacity - absenceHours);
    const eventHours = getTeamEventHoursInRange(monthStart, monthEnd, employeeId, teamEvents, employee.workSchedule);
    capacity = Math.max(0, capacity - eventHours);
    capacity = round2(capacity);
    const percentage = capacity > 0 ? round2((totalHours / capacity) * 100) : (totalHours > 0 ? 999 : 0);
    let status: LoadStatus = 'empty';
    if (totalHours === 0) { status = 'empty'; }
    else if (capacity === 0 && totalHours > 0) { status = 'overload'; }
    else if (percentage <= 85) { status = 'healthy'; }
    else if (percentage <= 100) { status = 'warning'; }
    else { status = 'overload'; }
    return { hours: totalHours, capacity, status, percentage };
  }, [employees, allocations, absences, teamEvents]);

  const getProjectHoursForMonth = useCallback((projectId: string, month: Date) => { const project = projects.find(p => p.id === projectId); if (!project) return { used: 0, budget: 0, available: 0, percentage: 0 }; const weeks = getWeeksForMonth(month); let usedHours = 0; weeks.forEach(week => { const storageKey = getStorageKey(week.weekStart, month); const tasks = allocations.filter(a => a.projectId === projectId && a.weekStartDate === storageKey); usedHours += tasks.reduce((sum, t) => sum + Number(t.hoursAssigned), 0); }); usedHours = round2(usedHours); const available = round2(Math.max(0, project.budgetHours - usedHours)); const percentage = project.budgetHours > 0 ? round2((usedHours / project.budgetHours) * 100) : 0; return { used: usedHours, budget: project.budgetHours, available, percentage }; }, [projects, allocations]);
  const getClientTotalHoursForMonth = useCallback((clientId: string, month: Date) => { const clientProjects = projects.filter(p => p.clientId === clientId); const weeks = getWeeksForMonth(month); let totalUsed = 0; let totalBudget = 0; clientProjects.forEach(project => { totalBudget += Number(project.budgetHours); weeks.forEach(week => { const storageKey = getStorageKey(week.weekStart, month); const tasks = allocations.filter(a => a.projectId === project.id && a.weekStartDate === storageKey); totalUsed += tasks.reduce((sum, t) => sum + Number(t.hoursAssigned), 0); }); }); totalUsed = round2(totalUsed); totalBudget = round2(totalBudget); const percentage = totalBudget > 0 ? round2((totalUsed / totalBudget) * 100) : 0; return { used: totalUsed, budget: totalBudget, percentage }; }, [projects, allocations]);
  const getProjectById = useCallback((id: string) => projects.find(p => p.id === id), [projects]);
  const getClientById = useCallback((id: string) => clients.find(c => c.id === id), [clients]);

  const value = useMemo(() => ({
    employees, clients, projects, allocations, absences, teamEvents, isLoading,
    addEmployee, updateEmployee, deleteEmployee, toggleEmployeeActive,
    addClient, updateClient, deleteClient,
    addProject, updateProject, deleteProject,
    addAllocation, updateAllocation, deleteAllocation,
    addAbsence, deleteAbsence,
    addTeamEvent, updateTeamEvent, deleteTeamEvent,
    getEmployeeAllocationsForWeek,
    getEmployeeLoadForWeek,
    getEmployeeMonthlyLoad,
    getProjectHoursForMonth,
    getClientTotalHoursForMonth,
    getProjectById, getClientById,
    addProfessionalGoal, updateProfessionalGoal, deleteProfessionalGoal, getEmployeeGoals, professionalGoals
  }), [
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
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
}
