import { useCallback } from 'react';
import { ZodSchema, ZodError } from 'zod';
import { ErrorService } from '@/services/errorService';
import { logger } from '@/utils/logger';

/**
 * Hook para validar formularios con Zod
 */
export function useFormValidation<T extends Record<string, any>>(schema: ZodSchema<T>) {
  const validate = useCallback((data: T): { isValid: boolean; errors: Record<string, string> } => {
    try {
      schema.parse(data);
      return { isValid: true, errors: {} };
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: Record<string, string> = {};
        error.errors.forEach((err) => {
          const path = err.path.join('.');
          errors[path] = err.message;
        });
        return { isValid: false, errors };
      }
      return { isValid: false, errors: { _general: 'Error de validación desconocido' } };
    }
  }, [schema]);

  const validateField = useCallback((field: keyof T, value: any): string | null => {
    try {
      const fieldSchema = schema.shape?.[field as string];
      if (fieldSchema) {
        fieldSchema.parse(value);
        return null;
      }
      return null;
    } catch (error) {
      if (error instanceof ZodError) {
        return error.errors[0]?.message || 'Campo inválido';
      }
      return 'Error de validación';
    }
  }, [schema]);

  return {
    validate,
    validateField,
  };
}

