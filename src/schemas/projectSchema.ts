import { z } from 'zod';

/**
 * Schema de validación para proyectos
 */
export const projectSchema = z.object({
  name: z.string().min(1, 'El nombre del proyecto es requerido').max(200, 'El nombre es demasiado largo'),
  clientId: z.string().uuid('ID de cliente inválido'),
  budgetHours: z.number().min(0, 'Las horas presupuestadas deben ser positivas').max(10000, 'Valor demasiado alto'),
  minimumHours: z.number().min(0, 'Las horas mínimas deben ser positivas').max(10000, 'Valor demasiado alto').optional(),
  monthlyFee: z.number().min(0, 'La tarifa mensual debe ser positiva').optional(),
  status: z.enum(['active', 'archived'], {
    errorMap: () => ({ message: 'El estado debe ser "active" o "archived"' })
  }),
  healthStatus: z.enum(['healthy', 'needs_attention', 'at_risk'], {
    errorMap: () => ({ message: 'Estado de salud inválido' })
  }).optional(),
  okrs: z.array(z.object({
    id: z.string(),
    title: z.string(),
    progress: z.number().min(0).max(100),
  })).optional(),
});

export type ProjectFormData = z.infer<typeof projectSchema>;

