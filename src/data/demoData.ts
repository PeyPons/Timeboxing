import { Employee, Client, Project, Allocation, Deadline } from '@/types';
import { startOfWeek, format, addDays, startOfMonth, endOfMonth } from 'date-fns';

/**
 * Datos de demo para la landing y componentes bajo DemoProvider.
 * weeks = lunes de cada semana del mes actual (calculado al cargar el módulo).
 * Escenarios: María ~80-90%, Carlos sobrecarga, Ana subcarga, Luis óptimo. Incluye dependencias y deadlines.
 */
const currentDate = new Date();
const monthStart = startOfMonth(currentDate);
const monthEnd = endOfMonth(currentDate);
const DEMO_AGENCY_ID = 'demo-agency';

const weeks: string[] = [];
let currentWeek = startOfWeek(monthStart, { weekStartsOn: 1 });
while (currentWeek <= monthEnd) {
  weeks.push(format(currentWeek, 'yyyy-MM-dd'));
  currentWeek = addDays(currentWeek, 7);
}

export const demoEmployees: Employee[] = [
  {
    id: 'demo-1',
    agencyId: DEMO_AGENCY_ID,
    name: 'María González',
    first_name: 'María',
    role: 'Directora de cuentas',
    avatarUrl: '',
    defaultWeeklyCapacity: 40,
    isActive: true,
    workSchedule: {
      monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8,
      saturday: 0, sunday: 0
    }
  },
  {
    id: 'demo-2',
    agencyId: DEMO_AGENCY_ID,
    name: 'Carlos Ruiz',
    first_name: 'Carlos',
    role: 'Responsable de contenido',
    avatarUrl: '',
    defaultWeeklyCapacity: 40,
    isActive: true,
    workSchedule: {
      monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8,
      saturday: 0, sunday: 0
    }
  },
  {
    id: 'demo-3',
    agencyId: DEMO_AGENCY_ID,
    name: 'Ana Martínez',
    first_name: 'Ana',
    role: 'Project manager',
    avatarUrl: '',
    defaultWeeklyCapacity: 40,
    isActive: true,
    workSchedule: {
      monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8,
      saturday: 0, sunday: 0
    }
  },
  {
    id: 'demo-4',
    agencyId: DEMO_AGENCY_ID,
    name: 'Luis Fernández',
    first_name: 'Luis',
    role: 'Diseñador creativo',
    avatarUrl: '',
    defaultWeeklyCapacity: 40,
    isActive: true,
    workSchedule: {
      monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8,
      saturday: 0, sunday: 0
    }
  },
];

export const demoClients: Client[] = [
  { id: 'demo-c1', agencyId: DEMO_AGENCY_ID, name: 'TechCorp', color: '#3b82f6' },
  { id: 'demo-c2', agencyId: DEMO_AGENCY_ID, name: 'E-Commerce Pro', color: '#10b981' },
  { id: 'demo-c3', agencyId: DEMO_AGENCY_ID, name: 'StartupHub', color: '#8b5cf6' },
  { id: 'demo-c4', agencyId: DEMO_AGENCY_ID, name: 'LocalBiz', color: '#f59e0b' },
];

export const demoProjects: Project[] = [
  { id: 'demo-p1', agencyId: DEMO_AGENCY_ID, clientId: 'demo-c1', name: 'Web corporativa', status: 'active', budgetHours: 160, minimumHours: 0 },
  { id: 'demo-p2', agencyId: DEMO_AGENCY_ID, clientId: 'demo-c1', name: 'Contenidos', status: 'active', budgetHours: 120, minimumHours: 0 },
  { id: 'demo-p3', agencyId: DEMO_AGENCY_ID, clientId: 'demo-c2', name: 'PR y alianzas', status: 'active', budgetHours: 80, minimumHours: 0 },
  { id: 'demo-p4', agencyId: DEMO_AGENCY_ID, clientId: 'demo-c3', name: 'Retainer global', status: 'active', budgetHours: 200, minimumHours: 0 },
  { id: 'demo-p5', agencyId: DEMO_AGENCY_ID, clientId: 'demo-c4', name: 'Campaña de lanzamiento', status: 'active', budgetHours: 60, minimumHours: 0 },
];

export const demoAllocations: Allocation[] = [
  { 
    id: 'demo-a1', 
    employeeId: 'demo-1', 
    projectId: 'demo-p1', 
    weekStartDate: weeks[0], 
    hoursAssigned: 15, 
    hoursActual: 14.5,
    hoursComputed: 15,
    status: 'completed', 
    taskName: 'Kick-off y alcance'
  },
  { 
    id: 'demo-a2', 
    employeeId: 'demo-1', 
    projectId: 'demo-p2', 
    weekStartDate: weeks[0], 
    hoursAssigned: 12, 
    hoursActual: 12,
    hoursComputed: 12,
    status: 'completed', 
    taskName: 'Creación de contenidos'
  },
  { 
    id: 'demo-a3', 
    employeeId: 'demo-1', 
    projectId: 'demo-p4', 
    weekStartDate: weeks[0], 
    hoursAssigned: 10, 
    status: 'planned', 
    taskName: 'Investigación de mercado'
  },
  { id: 'demo-a4', employeeId: 'demo-1', projectId: 'demo-p1', weekStartDate: weeks[1], hoursAssigned: 15, status: 'planned', taskName: 'Implementación de entregables' },
  { 
    id: 'demo-a5', 
    employeeId: 'demo-1', 
    projectId: 'demo-p2', 
    weekStartDate: weeks[1], 
    hoursAssigned: 15, 
    status: 'planned', 
    taskName: 'Revisión de contenidos'
  },
  { 
    id: 'demo-a6', 
    employeeId: 'demo-2', 
    projectId: 'demo-p1', 
    weekStartDate: weeks[0], 
    hoursAssigned: 20, 
    hoursActual: 22,
    hoursComputed: 20,
    status: 'completed', 
    taskName: 'Gestión de contenidos'
  },
  { 
    id: 'demo-a7', 
    employeeId: 'demo-2', 
    projectId: 'demo-p3', 
    weekStartDate: weeks[0], 
    hoursAssigned: 15, 
    hoursActual: 16,
    hoursComputed: 15,
    status: 'completed', 
    taskName: 'Contactos con medios'
  },
  { 
    id: 'demo-a8', 
    employeeId: 'demo-2', 
    projectId: 'demo-p4', 
    weekStartDate: weeks[0], 
    hoursAssigned: 12, 
    status: 'planned', 
    taskName: 'Estrategia de contenidos'
  },
  { 
    id: 'demo-a9', 
    employeeId: 'demo-2', 
    projectId: 'demo-p2', 
    weekStartDate: weeks[1], 
    hoursAssigned: 25, 
    status: 'planned', 
    taskName: 'Redacción masiva'
  },
  { 
    id: 'demo-a10', 
    employeeId: 'demo-2', 
    projectId: 'demo-p3', 
    weekStartDate: weeks[1], 
    hoursAssigned: 20, 
    status: 'planned', 
    taskName: 'Ronda de acuerdos'
  },
  { 
    id: 'demo-a11', 
    employeeId: 'demo-3', 
    projectId: 'demo-p1', 
    weekStartDate: weeks[0], 
    hoursAssigned: 12, 
    hoursActual: 11.5,
    hoursComputed: 12,
    status: 'completed', 
    taskName: 'Auditoría de proyecto'
  },
  { 
    id: 'demo-a12', 
    employeeId: 'demo-3', 
    projectId: 'demo-p4', 
    weekStartDate: weeks[0], 
    hoursAssigned: 10, 
    status: 'planned', 
    taskName: 'Análisis de implementación'
  },
  { id: 'demo-a13', employeeId: 'demo-3', projectId: 'demo-p1', weekStartDate: weeks[1], hoursAssigned: 8, status: 'planned', taskName: 'Refinamiento de entregables' },
  { 
    id: 'demo-a14', 
    employeeId: 'demo-4', 
    projectId: 'demo-p3', 
    weekStartDate: weeks[0], 
    hoursAssigned: 18, 
    hoursActual: 17.5,
    hoursComputed: 18,
    status: 'completed', 
    taskName: 'Activación con partners'
  },
  { 
    id: 'demo-a15', 
    employeeId: 'demo-4', 
    projectId: 'demo-p4', 
    weekStartDate: weeks[0], 
    hoursAssigned: 15, 
    hoursActual: 15,
    hoursComputed: 15,
    status: 'completed', 
    taskName: 'Prospección con medios'
  },
  { 
    id: 'demo-a16', 
    employeeId: 'demo-4', 
    projectId: 'demo-p5', 
    weekStartDate: weeks[0], 
    hoursAssigned: 5, 
    status: 'planned', 
    taskName: 'Material de punto de venta'
  },
  { 
    id: 'demo-a17', 
    employeeId: 'demo-4', 
    projectId: 'demo-p3', 
    weekStartDate: weeks[1], 
    hoursAssigned: 20, 
    status: 'planned', 
    taskName: 'Seguimiento de acuerdos'
  },
  { 
    id: 'demo-a18', 
    employeeId: 'demo-4', 
    projectId: 'demo-p4', 
    weekStartDate: weeks[1], 
    hoursAssigned: 12, 
    status: 'planned', 
    taskName: 'Estrategia de contactos'
  },
  { id: 'demo-a19', employeeId: 'demo-1', projectId: 'demo-p1', weekStartDate: weeks[2], hoursAssigned: 18, hoursActual: 19.5, hoursComputed: 18, status: 'completed', taskName: 'Cierre de hitos técnicos' },
  { id: 'demo-a20', employeeId: 'demo-1', projectId: 'demo-p2', weekStartDate: weeks[2], hoursAssigned: 14, hoursActual: 12, hoursComputed: 12, status: 'completed', taskName: 'Redacción de artículos' },
  { id: 'demo-a21', employeeId: 'demo-1', projectId: 'demo-p4', weekStartDate: weeks[2], hoursAssigned: 10, hoursActual: 10, hoursComputed: 10, status: 'completed', taskName: 'Análisis de competencia' },
  { id: 'demo-a22', employeeId: 'demo-1', projectId: 'demo-p1', weekStartDate: weeks[0], hoursAssigned: 5, hoursActual: 5, hoursComputed: 5, status: 'completed', taskName: 'Revisión de contenidos', dependencyId: 'demo-a6' },
  { id: 'demo-a23', employeeId: 'demo-2', projectId: 'demo-p1', weekStartDate: weeks[1], hoursAssigned: 15, status: 'planned', taskName: 'Continuación de auditoría', dependencyId: 'demo-a1' },
  { id: 'demo-a24', employeeId: 'demo-3', projectId: 'demo-p3', weekStartDate: weeks[1], hoursAssigned: 12, status: 'planned', taskName: 'Análisis de cobertura', dependencyId: 'demo-a14' },
  // Semana 3 (weeks[2]): Carlos, Ana y Luis con horas para que no quede vacía
  { id: 'demo-a25', employeeId: 'demo-2', projectId: 'demo-p2', weekStartDate: weeks[2], hoursAssigned: 16, hoursActual: 16, hoursComputed: 16, status: 'completed', taskName: 'Contenidos blog Q1' },
  { id: 'demo-a26', employeeId: 'demo-2', projectId: 'demo-p3', weekStartDate: weeks[2], hoursAssigned: 14, status: 'planned', taskName: 'Seguimiento de acuerdos' },
  { id: 'demo-a27', employeeId: 'demo-2', projectId: 'demo-p4', weekStartDate: weeks[2], hoursAssigned: 8, status: 'planned', taskName: 'Brief creativo' },
  { id: 'demo-a28', employeeId: 'demo-3', projectId: 'demo-p1', weekStartDate: weeks[2], hoursAssigned: 20, hoursActual: 18, hoursComputed: 18, status: 'completed', taskName: 'Correcciones finales' },
  { id: 'demo-a29', employeeId: 'demo-3', projectId: 'demo-p4', weekStartDate: weeks[2], hoursAssigned: 12, status: 'planned', taskName: 'Informe competencia' },
  { id: 'demo-a30', employeeId: 'demo-4', projectId: 'demo-p3', weekStartDate: weeks[2], hoursAssigned: 22, hoursActual: 20, hoursComputed: 20, status: 'completed', taskName: 'Campaña de contactos' },
  { id: 'demo-a31', employeeId: 'demo-4', projectId: 'demo-p5', weekStartDate: weeks[2], hoursAssigned: 10, status: 'planned', taskName: 'Ajustes de campaña local' },
  { id: 'demo-a32', employeeId: 'demo-4', projectId: 'demo-p4', weekStartDate: weeks[2], hoursAssigned: 8, status: 'planned', taskName: 'Coordinación con diseño' },
  // Semana 4 (weeks[3]): todos los empleados con datos
  { id: 'demo-a33', employeeId: 'demo-1', projectId: 'demo-p1', weekStartDate: weeks[3], hoursAssigned: 12, status: 'planned', taskName: 'Cierre de mes' },
  { id: 'demo-a34', employeeId: 'demo-1', projectId: 'demo-p2', weekStartDate: weeks[3], hoursAssigned: 18, status: 'planned', taskName: 'Lote contenidos marzo' },
  { id: 'demo-a35', employeeId: 'demo-1', projectId: 'demo-p4', weekStartDate: weeks[3], hoursAssigned: 8, status: 'planned', taskName: 'Revisión KPIs' },
  { id: 'demo-a36', employeeId: 'demo-2', projectId: 'demo-p1', weekStartDate: weeks[3], hoursAssigned: 10, status: 'planned', taskName: 'Ajustes copy' },
  { id: 'demo-a37', employeeId: 'demo-2', projectId: 'demo-p2', weekStartDate: weeks[3], hoursAssigned: 24, status: 'planned', taskName: 'Producción editorial' },
  { id: 'demo-a38', employeeId: 'demo-2', projectId: 'demo-p3', weekStartDate: weeks[3], hoursAssigned: 6, status: 'planned', taskName: 'Cierre de acuerdos' },
  { id: 'demo-a39', employeeId: 'demo-3', projectId: 'demo-p1', weekStartDate: weeks[3], hoursAssigned: 16, status: 'planned', taskName: 'Validación final' },
  { id: 'demo-a40', employeeId: 'demo-3', projectId: 'demo-p3', weekStartDate: weeks[3], hoursAssigned: 14, status: 'planned', taskName: 'Informe de PR' },
  { id: 'demo-a41', employeeId: 'demo-4', projectId: 'demo-p3', weekStartDate: weeks[3], hoursAssigned: 18, status: 'planned', taskName: 'Nueva ronda de contactos' },
  { id: 'demo-a42', employeeId: 'demo-4', projectId: 'demo-p4', weekStartDate: weeks[3], hoursAssigned: 14, status: 'planned', taskName: 'Seguimiento estrategia' },
  { id: 'demo-a43', employeeId: 'demo-4', projectId: 'demo-p5', weekStartDate: weeks[3], hoursAssigned: 6, status: 'planned', taskName: 'Informe local' },
];

const currentMonthStr = format(currentDate, 'yyyy-MM');
export const demoDeadlines: Deadline[] = [
  { id: 'demo-d1', projectId: 'demo-p1', month: currentMonthStr, notes: 'Deadline web corporativa', employeeHours: { 'demo-1': 50, 'demo-2': 30, 'demo-3': 25 } },
  { id: 'demo-d2', projectId: 'demo-p2', month: currentMonthStr, notes: 'Deadline para Contenidos', employeeHours: { 'demo-1': 40, 'demo-2': 35 } },
  { id: 'demo-d3', projectId: 'demo-p4', month: currentMonthStr, notes: 'Deadline retainer global', employeeHours: { 'demo-1': 30, 'demo-2': 20, 'demo-4': 25 } },
];
