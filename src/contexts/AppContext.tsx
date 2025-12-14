import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Employee, Client, Project, Allocation, LoadStatus, WorkSchedule, Absence, TeamEvent } from '@/types';
import { getWorkingDaysInRange, getMonthlyCapacity } from '@/utils/dateUtils';
import { getAbsenceHoursInRange } from '@/utils/absenceUtils';
import { getTeamEventHoursInRange } from '@/utils/teamEventUtils';

interface AppContextType {
  employees: Employee[];
  clients: Client[];
  projects: Project[];
  allocations: Allocation[];
  absences: Absence[];
  teamEvents: TeamEvent[];
  isLoading: boolean;
  addEmployee: (employee: Omit<Employee, 'id'>) => void; // <--- NUEVO
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
  getEmployeeLoadForWeek: (employeeId: string, weekStart: string, effectiveStart?: Date, effectiveEnd?: Date) => { hours: number; capacity: number; status: LoadStatus; percentage: number };
  getEmployeeMonthlyLoad: (employeeId: string, year: number, month: number) => { hours: number; capacity: number; status: LoadStatus; percentage: number };
  getProjectHoursForMonth: (projectId: string, month: Date) => { used: number; budget: number; available: number; percentage: number };
  getClientTotalHoursForMonth: (clientId: string, month: Date) => { used: number; budget: number; percentage: number };
  getProjectById: (id: string) => Project | undefined;
  getClientById: (id: string) => Client | undefined;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [teamEvents, setTeamEvents] = useState<TeamEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- CARGAR DATOS ---
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [empRes, cliRes, projRes, allocRes, absRes, evRes] = await Promise.all([
        supabase.from('employees').select('*'),
        supabase.from('clients').select('*'),
        supabase.from('projects').select('*'),
        supabase.from('allocations').select('*'),
        supabase.from('absences').select('*'),
        supabase.from('team_events').select('*'),
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
          budgetHours: p.budget_hours
        })));
      }
      if (allocRes.data) {
        setAllocations(allocRes.data.map((a: any) => ({
          ...a,
          employeeId: a.employee_id,
          projectId: a.project_id,
          weekStartDate: a.week_start_date,
          hoursAssigned: a.hours_assigned
        })));
      }
      if (absRes.data) {
        setAbsences(absRes.data.map((ab: any) => ({
          ...ab,
          employeeId: ab.employee_id,
          startDate: ab.start_date,
          endDate: ab.end_date
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

  // --- EMPLEADOS ---
  const addEmployee = useCallback(async (employee: Omit<Employee, 'id'>) => {
    const { data, error } = await supabase.from('employees').insert({
      name: employee.name,
      role: employee.role,
      avatar_url: employee.avatarUrl,
      default_weekly_capacity: employee.defaultWeeklyCapacity,
      work_schedule: employee.workSchedule,
      is_active: employee.isActive
    }).select().single();

    if (error) { console.error("Error adding employee:", error); return; }
    if (data) {
      const newEmployee: Employee = {
        ...data,
        defaultWeeklyCapacity: data.default_weekly_capacity,
        workSchedule: data.work_schedule,
        isActive: data.is_active
      };
      setEmployees(prev => [...prev, newEmployee]);
    }
  }, []);

  const updateEmployee = useCallback(async (employee: Employee) => {
    setEmployees(prev => prev.map(e => e.id === employee.id ? employee : e));
    await supabase.from('employees').update({
      name: employee.name,
      role: employee.role,
      avatar_url: employee.avatarUrl,
      default_weekly_capacity: employee.defaultWeeklyCapacity,
      work_schedule: employee.workSchedule,
      is_active: employee.isActive
    }).eq('id', employee.id);
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

  // --- CLIENTES ---
  const addClient = useCallback(async (client: Omit<Client, 'id'>) => {
    const { data } = await supabase.from('clients').insert(client).select().single();
    if (data) setClients(prev => [...prev, data]);
  }, []);

  const updateClient = useCallback(async (client: Client) => {
    setClients(prev => prev.map(c => c.id === client.id ? client : c));
    await supabase.from('clients').update({ name: client.name, color: client.color }).eq('id', client.id);
  }, []);

  const deleteClient = useCallback(async (id: string) => {
    setClients(prev => prev.filter(c => c.id !== id));
    setProjects(prev => prev.filter(p => p.clientId !== id));
    await supabase.from('clients').delete().eq('id', id);
  }, []);

  // --- PROYECTOS ---
  const addProject = useCallback(async (project: Omit<Project, 'id'>) => {
    const { data } = await supabase.from('projects').insert({
      client_id: project.clientId,
      name: project.name,
      status: project.status,
      budget_hours: project.budgetHours
    }).select().single();
    if (data) {
      setProjects(prev => [...prev, { ...data, clientId: data.client_id, budgetHours: data.budget_hours }]);
    }
  }, []);

  const updateProject = useCallback(async (project: Project) => {
    setProjects(prev => prev.map(p => p.id === project.id ? project : p));
    await supabase.from('projects').update({
      client_id: project.clientId,
      name: project.name,
      status: project.status,
      budget_hours: project.budgetHours
    }).eq('id', project.id);
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    setAllocations(prev => prev.filter(a => a.projectId !== id));
    await supabase.from('projects').delete().eq('id', id);
  }, []);

  // --- ASIGNACIONES ---
  const addAllocation = useCallback(async (allocation: Omit<Allocation, 'id'>) => {
    const { data } = await supabase.from('allocations').insert({
      employee_id: allocation.employeeId,
      project_id: allocation.projectId,
      week_start_date: allocation.weekStartDate,
      hours_assigned: allocation.hoursAssigned,
      status: allocation.status,
      description: allocation.description
    }).select().single();
    if (data) {
      setAllocations(prev => [...prev, {
        ...data,
        employeeId: data.employee_id,
        projectId: data.project_id,
        weekStartDate: data.week_start_date,
        hoursAssigned: data.hours_assigned
      }]);
    }
  }, []);

  const updateAllocation = useCallback(async (allocation: Allocation) => {
    setAllocations(prev => prev.map(a => a.id === allocation.id ? allocation : a));
    await supabase.from('allocations').update({
      hours_assigned: allocation.hoursAssigned,
      status: allocation.status,
      description: allocation.description
    }).eq('id', allocation.id);
  }, []);

  const deleteAllocation = useCallback(async (id: string) => {
    setAllocations(prev => prev.filter(a => a.id !== id));
    await supabase.from('allocations').delete().eq('id', id);
  }, []);

  // --- AUSENCIAS ---
  const addAbsence = useCallback(async (absence: Omit<Absence, 'id'>) => {
    const { data } = await supabase.from('absences').insert({
      employee_id: absence.employeeId,
      start_date: absence.startDate,
      end_date: absence.endDate,
      type: absence.type,
      description: absence.description
    }).select().single();
    if (data) {
      setAbsences(prev => [...prev, { ...data, employeeId: data.employee_id, startDate: data.start_date, endDate: data.end_date }]);
    }
  }, []);

  const deleteAbsence = useCallback(async (id: string) => {
    setAbsences(prev => prev.filter(a => a.id !== id));
    await supabase.from('absences').delete().eq('id', id);
  }, []);

  // --- EVENTOS ---
  const addTeamEvent = useCallback(async (event: Omit<TeamEvent, 'id'>) => {
    const { data } = await supabase.from('team_events').insert({
      name: event.name,
      date: event.date,
      hours_reduction: event.hoursReduction,
      affected_employee_ids: event.affectedEmployeeIds,
      description: event.description
    }).select().single();
    if (data) {
      setTeamEvents(prev => [...prev, { ...data, hoursReduction: data.hours_reduction, affectedEmployeeIds: data.affected_employee_ids }]);
    }
  }, []);

  const updateTeamEvent = useCallback(async (event: TeamEvent) => {
    setTeamEvents(prev => prev.map(e => e.id === event.id ? event : e));
    await supabase.from('team_events').update({
      name: event.name,
      date: event.date,
      hours_reduction: event.hoursReduction,
      affected_employee_ids: event.affectedEmployeeIds,
      description: event.description
    }).eq('id', event.id);
  }, []);

  const deleteTeamEvent = useCallback(async (id: string) => {
    setTeamEvents(prev => prev.filter(e => e.id !== id));
    await supabase.from('team_events').delete().eq('id', id);
  }, []);

  // --- GETTERS ---
  const getEmployeeAllocationsForWeek = useCallback((employeeId: string, weekStart: string) => {
    return allocations.filter(a => a.employeeId === employeeId && a.weekStartDate === weekStart);
  }, [allocations]);

  const getEmployeeLoadForWeek = useCallback((
    employeeId: string, 
    weekStart: string, 
    effectiveStart?: Date, 
    effectiveEnd?: Date
  ) => {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return { hours: 0, capacity: 0, status: 'empty' as LoadStatus, percentage: 0 };

    const employeeAllocations = allocations.filter(
      a => a.employeeId === employeeId && a.weekStartDate === weekStart
    );
    
    const totalHours = employeeAllocations.reduce((sum, a) => sum + Number(a.hoursAssigned), 0);
    
    let capacity: number;
    const weekStartDate = new Date(weekStart);
    const weekEndDate = new Date(weekStart);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    
    const rangeStart = effectiveStart || weekStartDate;
    const rangeEnd = effectiveEnd || weekEndDate;
    
    if (effectiveStart && effectiveEnd) {
      const { totalHours: capacityHours } = getWorkingDaysInRange(effectiveStart, effectiveEnd, employee.workSchedule);
      capacity = capacityHours;
    } else {
      capacity = employee.defaultWeeklyCapacity;
    }
    
    const employeeAbsences = absences.filter(a => a.employeeId === employeeId);
    const absenceHours = getAbsenceHoursInRange(rangeStart, rangeEnd, employeeAbsences, employee.workSchedule);
    capacity = Math.max(0, capacity - absenceHours);
    
    const eventHours = getTeamEventHoursInRange(rangeStart, rangeEnd, employeeId, teamEvents, employee.workSchedule);
    capacity = Math.max(0, capacity - eventHours);
    
    const percentage = capacity > 0 ? (totalHours / capacity) * 100 : (totalHours > 0 ? 999 : 0);

    let status: LoadStatus = 'empty';
    if (totalHours === 0) { status = 'empty'; }
    else if (capacity === 0 && totalHours > 0) { status = 'overload'; }
    else if (percentage <= 85) { status = 'healthy'; }
    else if (percentage <= 100) { status = 'warning'; }
    else { status = 'overload'; }

    return { hours: totalHours, capacity, status, percentage };
  }, [employees, allocations, absences, teamEvents]);

  const getEmployeeMonthlyLoad = useCallback((employeeId: string, year: number, month: number) => {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return { hours: 0, capacity: 0, status: 'empty' as LoadStatus, percentage: 0 };

    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);

    const monthAllocations = allocations.filter(a => {
      if (a.employeeId !== employeeId) return false;
      const weekStart = new Date(a.weekStartDate);
      return weekStart >= monthStart && weekStart <= monthEnd;
    });

    const totalHours = monthAllocations.reduce((sum, a) => sum + Number(a.hoursAssigned), 0);
    let capacity = getMonthlyCapacity(year, month, employee.workSchedule);
    
    const employeeAbsences = absences.filter(a => a.employeeId === employeeId);
    const absenceHours = getAbsenceHoursInRange(monthStart, monthEnd, employeeAbsences, employee.workSchedule);
    capacity = Math.max(0, capacity - absenceHours);
    
    const eventHours = getTeamEventHoursInRange(monthStart, monthEnd, employeeId, teamEvents, employee.workSchedule);
    capacity = Math.max(0, capacity - eventHours);
    
    const percentage = capacity > 0 ? (totalHours / capacity) * 100 : (totalHours > 0 ? 999 : 0);

    let status: LoadStatus = 'empty';
    if (totalHours === 0) { status = 'empty'; }
    else if (capacity === 0 && totalHours > 0) { status = 'overload'; }
    else if (percentage <= 85) { status = 'healthy'; }
    else if (percentage <= 100) { status = 'warning'; }
    else { status = 'overload'; }

    return { hours: totalHours, capacity, status, percentage };
  }, [employees, allocations, absences, teamEvents]);

  const getProjectHoursForMonth = useCallback((projectId: string, month: Date) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return { used: 0, budget: 0, available: 0, percentage: 0 };

    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    const projectAllocations = allocations.filter(a => {
      if (a.projectId !== projectId) return false;
      const weekStart = new Date(a.weekStartDate);
      return weekStart >= monthStart && weekStart <= monthEnd;
    });

    const usedHours = projectAllocations.reduce((sum, a) => sum + Number(a.hoursAssigned), 0);
    const available = Math.max(0, project.budgetHours - usedHours);
    const percentage = project.budgetHours > 0 ? (usedHours / project.budgetHours) * 100 : 0;

    return { used: usedHours, budget: project.budgetHours, available, percentage };
  }, [projects, allocations]);

  const getClientTotalHoursForMonth = useCallback((clientId: string, month: Date) => {
    const clientProjects = projects.filter(p => p.clientId === clientId);
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    let totalUsed = 0;
    let totalBudget = 0;

    clientProjects.forEach(project => {
      totalBudget += Number(project.budgetHours);
      const projectAllocations = allocations.filter(a => {
        if (a.projectId !== project.id) return false;
        const weekStart = new Date(a.weekStartDate);
        return weekStart >= monthStart && weekStart <= monthEnd;
      });
      totalUsed += projectAllocations.reduce((sum, a) => sum + Number(a.hoursAssigned), 0);
    });

    const percentage = totalBudget > 0 ? (totalUsed / totalBudget) * 100 : 0;
    return { used: totalUsed, budget: totalBudget, percentage };
  }, [projects, allocations]);

  const getProjectById = useCallback((id: string) => projects.find(p => p.id === id), [projects]);
  const getClientById = useCallback((id: string) => clients.find(c => c.id === id), [clients]);

  const value = useMemo(() => ({
    employees,
    clients,
    projects,
    allocations,
    absences,
    teamEvents,
    isLoading,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    toggleEmployeeActive,
    addClient,
    updateClient,
    deleteClient,
    addProject,
    updateProject,
    deleteProject,
    addAllocation,
    updateAllocation,
    deleteAllocation,
    addAbsence,
    deleteAbsence,
    addTeamEvent,
    updateTeamEvent,
    deleteTeamEvent,
    getEmployeeAllocationsForWeek,
    getEmployeeLoadForWeek,
    getEmployeeMonthlyLoad,
    getProjectHoursForMonth,
    getClientTotalHoursForMonth,
    getProjectById,
    getClientById,
  }), [
    employees, clients, projects, allocations, absences, teamEvents, isLoading,
    addEmployee, updateEmployee, deleteEmployee, toggleEmployeeActive,
    addClient, updateClient, deleteClient,
    addProject, updateProject, deleteProject,
    addAllocation, updateAllocation, deleteAllocation,
    addAbsence, deleteAbsence,
    addTeamEvent, updateTeamEvent, deleteTeamEvent,
    getEmployeeAllocationsForWeek, getEmployeeLoadForWeek, getEmployeeMonthlyLoad,
    getProjectHoursForMonth, getClientTotalHoursForMonth, getProjectById, getClientById
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
}
