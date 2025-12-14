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
  isActive: boolean;
}

export interface TeamEvent {
  id: string;
  name: string;
  date: string; // ISO date
  hoursReduction: number;
  affectedEmployeeIds: string[] | 'all';
  description?: string;
}

export interface Client {
  id: string;
  name: string;
  color: string;
}

export interface Project {
  id: string;
  clientId: string;
  name: string;
  status: 'active' | 'archived';
  budgetHours: number; // Horas contratadas (Techo)
  minimumHours: number; // <--- ¡NUEVO! (Suelo)
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

export interface Absence {
  id: string;
  employeeId: string;
  startDate: string; // ISO date
  endDate: string;   // ISO date
  type: 'vacation' | 'sick' | 'personal' | 'other';
  description?: string;
}

export interface ProfessionalGoal {
  id: string;
  employeeId: string;
  title: string;
  keyResults?: string;
  actions?: string;
  trainingUrl?: string;
  startDate?: string;
  dueDate?: string;
  progress: number;
}
