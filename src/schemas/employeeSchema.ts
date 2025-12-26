import { z } from 'zod';

/**
 * Schema de validación para empleados
 */
export const employeeSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100, 'El nombre es demasiado largo'),
  email: z.string().email('Email inválido').optional().nullable(),
  defaultWeeklyCapacity: z.number().min(0, 'La capacidad debe ser positiva').max(168, 'No puede exceder 168 horas semanales'),
  role: z.string().min(1, 'El rol es requerido'),
  department: z.string().optional(),
  hourlyRate: z.number().min(0, 'La tarifa por hora debe ser positiva').optional(),
  isActive: z.boolean().optional(),
});

export type EmployeeFormData = z.infer<typeof employeeSchema>;

