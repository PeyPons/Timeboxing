import { useState, useEffect, useCallback } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { ErrorService } from '@/services/errorService';
import { logger } from '@/utils/logger';

interface UseSupabaseQueryOptions<T> {
  enabled?: boolean;
  onSuccess?: (data: T[]) => void;
  onError?: (error: Error) => void;
  refetchInterval?: number;
}

/**
 * Hook personalizado para queries de Supabase con caché y manejo de errores
 */
export function useSupabaseQuery<T>(
  supabase: SupabaseClient,
  table: string,
  options: UseSupabaseQueryOptions<T> = {}
) {
  const { enabled = true, onSuccess, onError, refetchInterval } = options;
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data: result, error: queryError } = await supabase
        .from(table)
        .select('*');

      if (queryError) {
        throw queryError;
      }

      setData(result as T[]);
      logger.info(`Datos cargados de ${table}`, { count: result?.length || 0 });
      onSuccess?.(result as T[]);
    } catch (err: any) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      ErrorService.handleSilently(error, `useSupabaseQuery.${table}`);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, table, enabled, onSuccess, onError]);

  useEffect(() => {
    fetchData();

    if (refetchInterval) {
      const interval = setInterval(fetchData, refetchInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, refetchInterval]);

  const refetch = useCallback(() => {
    return fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch,
  };
}

