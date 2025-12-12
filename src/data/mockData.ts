import { Employee, Client, Project, Allocation } from '@/types';

export const mockEmployees: Employee[] = [
  {
    id: '1',
    name: 'Marta García',
    role: 'SEO Specialist',
    avatarUrl: '',
    defaultWeeklyCapacity: 30,
    workSchedule: {
      monday: 6, tuesday: 6, wednesday: 6, thursday: 6, friday: 6,
      saturday: 0, sunday: 0
    }
  },
  {
    id: '2',
    name: 'Raúl Martínez',
    role: 'Content Manager',
    avatarUrl: '',
    defaultWeeklyCapacity: 38,
    workSchedule: {
      monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 6,
      saturday: 0, sunday: 0
    }
  },
  {
    id: '3',
    name: 'Laura Sánchez',
    role: 'Link Builder',
    avatarUrl: '',
    defaultWeeklyCapacity: 40,
    workSchedule: {
      monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8,
      saturday: 0, sunday: 0
    }
  },
  {
    id: '4',
    name: 'Carlos López',
    role: 'Technical SEO',
    avatarUrl: '',
    defaultWeeklyCapacity: 40,
    workSchedule: {
      monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8,
      saturday: 0, sunday: 0
    }
  },
  {
    id: '5',
    name: 'Ana Rodríguez',
    role: 'Account Manager',
    avatarUrl: '',
    defaultWeeklyCapacity: 35,
    workSchedule: {
      monday: 7, tuesday: 7, wednesday: 7, thursday: 7, friday: 7,
      saturday: 0, sunday: 0
    }
  },
  {
    id: '6',
    name: 'Pablo Fernández',
    role: 'SEO Analyst',
    avatarUrl: '',
    defaultWeeklyCapacity: 40,
    workSchedule: {
      monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8,
      saturday: 0, sunday: 0
    }
  },
  {
    id: '7',
    name: 'Elena Torres',
    role: 'Content Writer',
    avatarUrl: '',
    defaultWeeklyCapacity: 32,
    workSchedule: {
      monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 0,
      saturday: 0, sunday: 0
    }
  },
  {
    id: '8',
    name: 'Javier Ruiz',
    role: 'SEO Director',
    avatarUrl: '',
    defaultWeeklyCapacity: 40,
    workSchedule: {
      monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8,
      saturday: 0, sunday: 0
    }
  },
  {
    id: '9',
    name: 'Sofía Moreno',
    role: 'Junior SEO',
    avatarUrl: '',
    defaultWeeklyCapacity: 40,
    workSchedule: {
      monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8,
      saturday: 0, sunday: 0
    }
  }
];

export const mockClients: Client[] = [
  { id: 'c1', name: 'VGC', color: '#0d9488' },
  { id: 'c2', name: 'Audi', color: '#dc2626' },
  { id: 'c3', name: 'TechStartup', color: '#7c3aed' },
  { id: 'c4', name: 'E-Commerce Plus', color: '#ea580c' },
  { id: 'c5', name: 'Local Business', color: '#0284c7' },
  { id: 'c6', name: 'FinanceApp', color: '#16a34a' },
];

export const mockProjects: Project[] = [
  { id: 'p1', clientId: 'c1', name: 'VGC - SEO Técnico', status: 'active', budgetHours: 40 },
  { id: 'p2', clientId: 'c1', name: 'VGC - Contenidos', status: 'active', budgetHours: 40 },
  { id: 'p3', clientId: 'c2', name: 'Audi - Link Building', status: 'active', budgetHours: 35 },
  { id: 'p4', clientId: 'c2', name: 'Audi - Auditoría SEO', status: 'active', budgetHours: 25 },
  { id: 'p5', clientId: 'c3', name: 'TechStartup - SEO Full', status: 'active', budgetHours: 40 },
  { id: 'p6', clientId: 'c4', name: 'E-Commerce - Fichas Producto', status: 'active', budgetHours: 50 },
  { id: 'p7', clientId: 'c5', name: 'Local - SEO Local', status: 'active', budgetHours: 20 },
  { id: 'p8', clientId: 'c6', name: 'FinanceApp - Blog SEO', status: 'active', budgetHours: 35 },
];

// Generate some mock allocations for the current month
const getWeekStart = (date: Date): string => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
};

const currentDate = new Date();
const weeks: string[] = [];
for (let i = -1; i < 5; i++) {
  const weekDate = new Date(currentDate);
  weekDate.setDate(currentDate.getDate() + (i * 7));
  weeks.push(getWeekStart(weekDate));
}

export const mockAllocations: Allocation[] = [
  // Marta (30h capacity)
  { id: 'a1', employeeId: '1', projectId: 'p1', weekStartDate: weeks[1], hoursAssigned: 15, status: 'planned', description: 'Análisis técnico VGC' },
  { id: 'a2', employeeId: '1', projectId: 'p5', weekStartDate: weeks[1], hoursAssigned: 12, status: 'planned', description: 'Setup TechStartup' },
  { id: 'a3', employeeId: '1', projectId: 'p1', weekStartDate: weeks[2], hoursAssigned: 20, status: 'planned', description: 'Implementación cambios' },
  { id: 'a4', employeeId: '1', projectId: 'p7', weekStartDate: weeks[2], hoursAssigned: 15, status: 'planned', description: 'SEO Local setup' },
  
  // Raúl (38h capacity)
  { id: 'a5', employeeId: '2', projectId: 'p2', weekStartDate: weeks[1], hoursAssigned: 20, status: 'planned', description: 'Creación contenidos VGC' },
  { id: 'a6', employeeId: '2', projectId: 'p6', weekStartDate: weeks[1], hoursAssigned: 15, status: 'planned', description: 'Fichas E-Commerce' },
  { id: 'a7', employeeId: '2', projectId: 'p8', weekStartDate: weeks[2], hoursAssigned: 25, status: 'planned', description: 'Blog FinanceApp' },
  
  // Laura (40h capacity)
  { id: 'a8', employeeId: '3', projectId: 'p3', weekStartDate: weeks[1], hoursAssigned: 30, status: 'planned', description: 'Link Building Audi' },
  { id: 'a9', employeeId: '3', projectId: 'p5', weekStartDate: weeks[1], hoursAssigned: 8, status: 'planned', description: 'Links TechStartup' },
  { id: 'a10', employeeId: '3', projectId: 'p3', weekStartDate: weeks[2], hoursAssigned: 35, status: 'planned', description: 'Outreach Audi' },
  { id: 'a11', employeeId: '3', projectId: 'p1', weekStartDate: weeks[2], hoursAssigned: 10, status: 'planned', description: 'Links VGC' },
  
  // Carlos (40h capacity)
  { id: 'a12', employeeId: '4', projectId: 'p1', weekStartDate: weeks[1], hoursAssigned: 25, status: 'planned', description: 'Auditoría técnica VGC' },
  { id: 'a13', employeeId: '4', projectId: 'p4', weekStartDate: weeks[1], hoursAssigned: 15, status: 'planned', description: 'Auditoría Audi' },
  { id: 'a14', employeeId: '4', projectId: 'p5', weekStartDate: weeks[2], hoursAssigned: 30, status: 'planned', description: 'Setup técnico TechStartup' },
  
  // Ana (35h capacity)
  { id: 'a15', employeeId: '5', projectId: 'p1', weekStartDate: weeks[1], hoursAssigned: 10, status: 'planned', description: 'Gestión cliente VGC' },
  { id: 'a16', employeeId: '5', projectId: 'p2', weekStartDate: weeks[1], hoursAssigned: 10, status: 'planned', description: 'Coordinación contenidos' },
  { id: 'a17', employeeId: '5', projectId: 'p3', weekStartDate: weeks[2], hoursAssigned: 15, status: 'planned', description: 'Reuniones Audi' },
  
  // Pablo (40h)
  { id: 'a18', employeeId: '6', projectId: 'p4', weekStartDate: weeks[1], hoursAssigned: 20, status: 'planned', description: 'Análisis Audi' },
  { id: 'a19', employeeId: '6', projectId: 'p6', weekStartDate: weeks[1], hoursAssigned: 18, status: 'planned', description: 'Análisis E-Commerce' },
  { id: 'a20', employeeId: '6', projectId: 'p8', weekStartDate: weeks[2], hoursAssigned: 20, status: 'planned', description: 'KPIs FinanceApp' },
  
  // Elena (32h - no trabaja viernes)
  { id: 'a21', employeeId: '7', projectId: 'p2', weekStartDate: weeks[1], hoursAssigned: 16, status: 'planned', description: 'Redacción VGC' },
  { id: 'a22', employeeId: '7', projectId: 'p8', weekStartDate: weeks[1], hoursAssigned: 14, status: 'planned', description: 'Artículos FinanceApp' },
  { id: 'a23', employeeId: '7', projectId: 'p6', weekStartDate: weeks[2], hoursAssigned: 32, status: 'planned', description: 'Descripciones productos' },
  
  // Javier (40h - Director)
  { id: 'a24', employeeId: '8', projectId: 'p1', weekStartDate: weeks[1], hoursAssigned: 8, status: 'planned', description: 'Supervisión VGC' },
  { id: 'a25', employeeId: '8', projectId: 'p3', weekStartDate: weeks[1], hoursAssigned: 8, status: 'planned', description: 'Estrategia Audi' },
  { id: 'a26', employeeId: '8', projectId: 'p5', weekStartDate: weeks[1], hoursAssigned: 10, status: 'planned', description: 'Onboarding TechStartup' },
  
  // Sofía (40h - Junior)
  { id: 'a27', employeeId: '9', projectId: 'p7', weekStartDate: weeks[1], hoursAssigned: 20, status: 'planned', description: 'Investigación Local' },
  { id: 'a28', employeeId: '9', projectId: 'p6', weekStartDate: weeks[1], hoursAssigned: 15, status: 'planned', description: 'Apoyo E-Commerce' },
  { id: 'a29', employeeId: '9', projectId: 'p7', weekStartDate: weeks[2], hoursAssigned: 25, status: 'planned', description: 'Implementación Local' },
];
