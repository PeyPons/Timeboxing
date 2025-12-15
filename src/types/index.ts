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
  role: string;
  avatarUrl?: string;
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
  status: 'active' | 'archived' | 'completed';
  budgetHours: number;
  minimumHours?: number;
  healthStatus?: 'healthy' | 'needs_attention' | 'at_risk';
  monthlyFee?: number;
  // npsLink eliminado
  lastMeetingDate?: string;
  okrs?: OKR[];
  deliverables_log?: Record<string, string[]>;
}

export interface OKR {
  id: string;
  title: string;
  progress: number;
}

export interface Allocation {
  id: string;
  employeeId: string;
  projectId: string;
  weekStartDate: string;
  hoursAssigned: number;
  hoursActual?: number;
  hoursComputed?: number;
  status: 'planned' | 'completed';
  description?: string;
  taskName?: string;
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
  startDate: string;
  endDate: string;
  type: 'vacation' | 'sick_leave' | 'personal' | 'other';
  description?: string;
  hours?: number;
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
