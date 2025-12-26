import { useState, useCallback } from 'react';
import { ErrorService } from '@/services/errorService';
import { logger } from '@/utils/logger';

/**
 * Hook personalizado para manejar estados de formularios con validación y manejo de errores
 */
export function useFormState<T extends Record<string, any>>(initialData: T) {
  const [formData, setFormData] = useState<T>(initialData);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Limpiar error del campo cuando se actualiza
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [errors]);

  const updateFields = useCallback((updates: Partial<T>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  const setFieldError = useCallback(<K extends keyof T>(field: K, error: string) => {
    setErrors(prev => ({ ...prev, [field]: error }));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  const reset = useCallback(() => {
    setFormData(initialData);
    setErrors({});
    setIsSubmitting(false);
  }, [initialData]);

  const handleSubmit = useCallback(async (
    submitFn: (data: T) => Promise<void>,
    context: string
  ) => {
    setIsSubmitting(true);
    clearErrors();

    try {
      await submitFn(formData);
      logger.info('Formulario enviado correctamente', { context, data: formData });
    } catch (error: any) {
      ErrorService.handle(error, context);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, clearErrors]);

  return {
    formData,
    errors,
    isSubmitting,
    updateField,
    updateFields,
    setFieldError,
    clearErrors,
    reset,
    handleSubmit,
    setFormData,
  };
}

