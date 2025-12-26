import { useState, useCallback } from 'react';
import { ErrorService } from '@/services/errorService';
import { logger } from '@/utils/logger';

interface UseAsyncOperationOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  showToast?: boolean;
  context?: string;
}

/**
 * Hook personalizado para manejar operaciones asíncronas con estados de carga y error
 */
export function useAsyncOperation<T extends any[]>(
  operation: (...args: T) => Promise<any>,
  options: UseAsyncOperationOptions = {}
) {
  const { onSuccess, onError, showToast = true, context = 'AsyncOperation' } = options;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async (...args: T) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await operation(...args);
      logger.info('Operación completada', { context, args });
      onSuccess?.();
      return result;
    } catch (err: any) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      
      if (showToast) {
        ErrorService.handle(error, context);
      } else {
        ErrorService.handleSilently(error, context);
      }
      
      onError?.(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [operation, onSuccess, onError, showToast, context]);

  return {
    execute,
    isLoading,
    error,
  };
}

