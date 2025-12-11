import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Employee, Client, Project, Allocation, LoadStatus } from '@/types';
import { mockEmployees, mockClients, mockProjects, mockAllocations } from '@/data/mockData';

interface AppContextType {
  employees: Employee[];
  clients: Client[];
  projects: Project[];
  allocations: Allocation[];
  updateEmployee: (employee: Employee) => void;
  updateClient: (client: Client) => void;
  addAllocation: (allocation: Omit<Allocation, 'id'>) => void;
  updateAllocation: (allocation: Allocation) => void;
  deleteAllocation: (id: string) => void;
  getEmployeeAllocationsForWeek: (employeeId: string, weekStart: string) => Allocation[];
  getEmployeeLoadForWeek: (employeeId: string, weekStart: string) => { hours: number; capacity: number; status: LoadStatus; percentage: number };
  getClientHoursForMonth: (clientId: string, month: Date) => { used: number; budget: number; percentage: number };
  getProjectById: (id: string) => Project | undefined;
  getClientById: (id: string) => Client | undefined;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>(mockEmployees);
  const [clients, setClients] = useState<Client[]>(mockClients);
  const [projects] = useState<Project[]>(mockProjects);
  const [allocations, setAllocations] = useState<Allocation[]>(mockAllocations);

  const updateEmployee = useCallback((employee: Employee) => {
    setEmployees(prev => prev.map(e => e.id === employee.id ? employee : e));
  }, []);

  const updateClient = useCallback((client: Client) => {
    setClients(prev => prev.map(c => c.id === client.id ? client : c));
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

  const getEmployeeLoadForWeek = useCallback((employeeId: string, weekStart: string): { hours: number; capacity: number; status: LoadStatus; percentage: number } => {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return { hours: 0, capacity: 0, status: 'empty', percentage: 0 };

    const employeeAllocations = allocations.filter(
      a => a.employeeId === employeeId && a.weekStartDate === weekStart
    );
    
    const totalHours = employeeAllocations.reduce((sum, a) => sum + a.hoursAssigned, 0);
    const capacity = employee.defaultWeeklyCapacity;
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

  const getClientHoursForMonth = useCallback((clientId: string, month: Date): { used: number; budget: number; percentage: number } => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return { used: 0, budget: 0, percentage: 0 };

    const clientProjects = projects.filter(p => p.clientId === clientId);
    const projectIds = clientProjects.map(p => p.id);

    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    const monthAllocations = allocations.filter(a => {
      if (!projectIds.includes(a.projectId)) return false;
      const weekStart = new Date(a.weekStartDate);
      return weekStart >= monthStart && weekStart <= monthEnd;
    });

    const usedHours = monthAllocations.reduce((sum, a) => sum + a.hoursAssigned, 0);
    const percentage = client.monthlyBudgetHours > 0 ? (usedHours / client.monthlyBudgetHours) * 100 : 0;

    return { used: usedHours, budget: client.monthlyBudgetHours, percentage };
  }, [clients, projects, allocations]);

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
    updateClient,
    addAllocation,
    updateAllocation,
    deleteAllocation,
    getEmployeeAllocationsForWeek,
    getEmployeeLoadForWeek,
    getClientHoursForMonth,
    getProjectById,
    getClientById,
  }), [
    employees, clients, projects, allocations,
    updateEmployee, updateClient, addAllocation, updateAllocation, deleteAllocation,
    getEmployeeAllocationsForWeek, getEmployeeLoadForWeek, getClientHoursForMonth,
    getProjectById, getClientById
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
