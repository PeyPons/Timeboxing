export interface WorkSchedule {
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  sunday: number;
}

export interface Employee {
  id: string;
  name: string;
  avatarUrl?: string;
  role: string;
  defaultWeeklyCapacity: number;
  workSchedule: WorkSchedule;
}

export interface Client {
  id: string;
  name: string;
  monthlyBudgetHours: number;
  color: string;
}

export interface Project {
  id: string;
  clientId: string;
  name: string;
  status: 'active' | 'archived';
}

export interface Allocation {
  id: string;
  employeeId: string;
  projectId: string;
  weekStartDate: string;
  hoursAssigned: number;
  status: 'planned' | 'completed';
  description?: string;
}

export type LoadStatus = 'empty' | 'healthy' | 'warning' | 'overload';

export interface WeekData {
  weekStart: Date;
  weekEnd: Date;
  weekLabel: string;
  effectiveStart?: Date;
  effectiveEnd?: Date;
}
