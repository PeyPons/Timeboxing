import { z } from 'zod';

/**
 * Schema de validación para deadlines
 */
export const deadlineSchema = z.object({
  projectId: z.string().uuid('ID de proyecto inválido'),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'El formato del mes debe ser YYYY-MM'),
  notes: z.string().max(1000, 'Las notas son demasiado largas').optional().nullable(),
  employeeHours: z.record(z.string(), z.number().min(0, 'Las horas deben ser positivas')),
  isHidden: z.boolean().optional(),
});

export type DeadlineFormData = z.infer<typeof deadlineSchema>;

