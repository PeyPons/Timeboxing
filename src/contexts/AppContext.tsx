import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Employee, Client, Project, Allocation, LoadStatus, WorkSchedule } from '@/types';
import { mockEmployees, mockClients, mockProjects, mockAllocations } from '@/data/mockData';
import { getWorkingDaysInRange, getMonthlyCapacity } from '@/utils/dateUtils';

interface AppContextType {
  employees: Employee[];
  clients: Client[];
  projects: Project[];
  allocations: Allocation[];
  updateEmployee: (employee: Employee) => void;
  addClient: (client: Omit<Client, 'id'>) => void;
  updateClient: (client: Client) => void;
  deleteClient: (id: string) => void;
  addProject: (project: Omit<Project, 'id'>) => void;
  updateProject: (project: Project) => void;
  deleteProject: (id: string) => void;
  addAllocation: (allocation: Omit<Allocation, 'id'>) => void;
  updateAllocation: (allocation: Allocation) => void;
  deleteAllocation: (id: string) => void;
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
  const [employees, setEmployees] = useState<Employee[]>(mockEmployees);
  const [clients, setClients] = useState<Client[]>(mockClients);
  const [projects, setProjects] = useState<Project[]>(mockProjects);
  const [allocations, setAllocations] = useState<Allocation[]>(mockAllocations);

  const updateEmployee = useCallback((employee: Employee) => {
    setEmployees(prev => prev.map(e => e.id === employee.id ? employee : e));
  }, []);

  const addClient = useCallback((client: Omit<Client, 'id'>) => {
    const newClient: Client = {
      ...client,
      id: `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    setClients(prev => [...prev, newClient]);
  }, []);

  const updateClient = useCallback((client: Client) => {
    setClients(prev => prev.map(c => c.id === client.id ? client : c));
  }, []);

  const deleteClient = useCallback((id: string) => {
    setClients(prev => prev.filter(c => c.id !== id));
    setProjects(prev => prev.filter(p => p.clientId !== id));
  }, []);

  const addProject = useCallback((project: Omit<Project, 'id'>) => {
    const newProject: Project = {
      ...project,
      id: `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    setProjects(prev => [...prev, newProject]);
  }, []);

  const updateProject = useCallback((project: Project) => {
    setProjects(prev => prev.map(p => p.id === project.id ? project : p));
  }, []);

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    setAllocations(prev => prev.filter(a => a.projectId !== id));
  }, []);

  const addAllocation = useCallback((allocation: Omit<Allocation, 'id'>) => {
    const newAllocation: Allocation = {
      ...allocation,
      id: `alloc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    setAllocations(prev => [...prev, newAllocation]);
  }, []);

  const updateAllocation = useCallback((allocation: Allocation) => {
    setAllocations(prev => prev.map(a => a.id === allocation.id ? allocation : a));
  }, []);

  const deleteAllocation = useCallback((id: string) => {
    setAllocations(prev => prev.filter(a => a.id !== id));
  }, []);

  const getEmployeeAllocationsForWeek = useCallback((employeeId: string, weekStart: string) => {
    return allocations.filter(a => a.employeeId === employeeId && a.weekStartDate === weekStart);
  }, [allocations]);

  const getEmployeeLoadForWeek = useCallback((
    employeeId: string, 
    weekStart: string, 
    effectiveStart?: Date, 
    effectiveEnd?: Date
  ): { hours: number; capacity: number; status: LoadStatus; percentage: number } => {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return { hours: 0, capacity: 0, status: 'empty', percentage: 0 };

    const employeeAllocations = allocations.filter(
      a => a.employeeId === employeeId && a.weekStartDate === weekStart
    );
    
    const totalHours = employeeAllocations.reduce((sum, a) => sum + a.hoursAssigned, 0);
    
    let capacity: number;
    if (effectiveStart && effectiveEnd) {
      const { totalHours: capacityHours } = getWorkingDaysInRange(effectiveStart, effectiveEnd, employee.workSchedule);
      capacity = capacityHours;
    } else {
      capacity = employee.defaultWeeklyCapacity;
    }
    
    const percentage = capacity > 0 ? (totalHours / capacity) * 100 : 0;

    let status: LoadStatus = 'empty';
    if (totalHours === 0) {
      status = 'empty';
    } else if (percentage <= 85) {
      status = 'healthy';
    } else if (percentage <= 100) {
      status = 'warning';
    } else {
      status = 'overload';
    }

    return { hours: totalHours, capacity, status, percentage };
  }, [employees, allocations]);

  const getEmployeeMonthlyLoad = useCallback((
    employeeId: string, 
    year: number, 
    month: number
  ): { hours: number; capacity: number; status: LoadStatus; percentage: number } => {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return { hours: 0, capacity: 0, status: 'empty', percentage: 0 };

    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);

    const monthAllocations = allocations.filter(a => {
      if (a.employeeId !== employeeId) return false;
      const weekStart = new Date(a.weekStartDate);
      return weekStart >= monthStart && weekStart <= monthEnd;
    });

    const totalHours = monthAllocations.reduce((sum, a) => sum + a.hoursAssigned, 0);
    const capacity = getMonthlyCapacity(year, month, employee.workSchedule);
    const percentage = capacity > 0 ? (totalHours / capacity) * 100 : 0;

    let status: LoadStatus = 'empty';
    if (totalHours === 0) {
      status = 'empty';
    } else if (percentage <= 85) {
      status = 'healthy';
    } else if (percentage <= 100) {
      status = 'warning';
    } else {
      status = 'overload';
    }

    return { hours: totalHours, capacity, status, percentage };
  }, [employees, allocations]);

  // Get hours for a specific project in a month
  const getProjectHoursForMonth = useCallback((projectId: string, month: Date): { used: number; budget: number; available: number; percentage: number } => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return { used: 0, budget: 0, available: 0, percentage: 0 };

    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    const projectAllocations = allocations.filter(a => {
      if (a.projectId !== projectId) return false;
      const weekStart = new Date(a.weekStartDate);
      return weekStart >= monthStart && weekStart <= monthEnd;
    });

    const usedHours = projectAllocations.reduce((sum, a) => sum + a.hoursAssigned, 0);
    const available = Math.max(0, project.budgetHours - usedHours);
    const percentage = project.budgetHours > 0 ? (usedHours / project.budgetHours) * 100 : 0;

    return { used: usedHours, budget: project.budgetHours, available, percentage };
  }, [projects, allocations]);

  // Get total hours for a client (sum of all their projects)
  const getClientTotalHoursForMonth = useCallback((clientId: string, month: Date): { used: number; budget: number; percentage: number } => {
    const clientProjects = projects.filter(p => p.clientId === clientId);
    
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    let totalUsed = 0;
    let totalBudget = 0;

    clientProjects.forEach(project => {
      totalBudget += project.budgetHours;
      
      const projectAllocations = allocations.filter(a => {
        if (a.projectId !== project.id) return false;
        const weekStart = new Date(a.weekStartDate);
        return weekStart >= monthStart && weekStart <= monthEnd;
      });
      
      totalUsed += projectAllocations.reduce((sum, a) => sum + a.hoursAssigned, 0);
    });

    const percentage = totalBudget > 0 ? (totalUsed / totalBudget) * 100 : 0;

    return { used: totalUsed, budget: totalBudget, percentage };
  }, [projects, allocations]);

  const getProjectById = useCallback((id: string) => {
    return projects.find(p => p.id === id);
  }, [projects]);

  const getClientById = useCallback((id: string) => {
    return clients.find(c => c.id === id);
  }, [clients]);

  const value = useMemo(() => ({
    employees,
    clients,
    projects,
    allocations,
    updateEmployee,
    addClient,
    updateClient,
    deleteClient,
    addProject,
    updateProject,
    deleteProject,
    addAllocation,
    updateAllocation,
    deleteAllocation,
    getEmployeeAllocationsForWeek,
    getEmployeeLoadForWeek,
    getEmployeeMonthlyLoad,
    getProjectHoursForMonth,
    getClientTotalHoursForMonth,
    getProjectById,
    getClientById,
  }), [
    employees, clients, projects, allocations,
    updateEmployee, addClient, updateClient, deleteClient,
    addProject, updateProject, deleteProject,
    addAllocation, updateAllocation, deleteAllocation,
    getEmployeeAllocationsForWeek, getEmployeeLoadForWeek, getEmployeeMonthlyLoad,
    getProjectHoursForMonth, getClientTotalHoursForMonth, getProjectById, getClientById
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
