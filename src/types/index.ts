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
  email?: string;
  role: string;
  avatarUrl?: string;
  defaultWeeklyCapacity: number;
  workSchedule: WorkSchedule;
  department?: string;
  hourlyRate?: number;
  isActive: boolean;
  user_id?: string;
  first_name?: string;
  last_name?: string;
  crmUserId?: number;  // NUEVO: ID del usuario en el CRM
  welcomeTourCompleted?: boolean;  // Si el usuario completó el tour de bienvenida
}

export interface TeamEvent {
  id: string;
  name: string;
  date: string;
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
  lastMeetingDate?: string;
  okrs?: OKR[];
  deliverables_log?: Record<string, string[]>;
  externalId?: number;    // NUEVO: ID del proyecto en el CRM
  projectType?: string;   // NUEVO: 'PPC' | 'Entregable' | 'Mensual'
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
  status: 'planned' | 'completed' | 'active';
  description?: string;
  taskName?: string;
  dependencyId?: string;
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

export interface Deadline {
  id: string;
  projectId: string;
  month: string; // Formato: 'YYYY-MM' (ej: '2024-03')
  notes?: string;
  employeeHours: Record<string, number>; // employeeId -> hours
  isHidden?: boolean; // Si el proyecto está oculto este mes
}

export interface GlobalAssignment {
  id: string;
  month: string; // Formato: 'YYYY-MM'
  name: string; // Ej: "Deadline afecta a todos", "Creación timeboxing"
  hours: number;
  affectsAll: boolean; // Si afecta a todos los empleados
  affectedEmployeeIds?: string[]; // Si no afecta a todos, lista de IDs
}
