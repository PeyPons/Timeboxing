import { useState, useCallback } from 'react';

/**
 * Hook para manejar estados de carga con múltiples operaciones simultáneas
 */
export function useLoadingState() {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  const setLoading = useCallback((key: string, isLoading: boolean) => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: isLoading,
    }));
  }, []);

  const startLoading = useCallback((key: string) => {
    setLoading(key, true);
  }, [setLoading]);

  const stopLoading = useCallback((key: string) => {
    setLoading(key, false);
  }, [setLoading]);

  const isLoading = useCallback((key?: string) => {
    if (key) {
      return loadingStates[key] || false;
    }
    // Si no se especifica key, retorna true si hay alguna carga activa
    return Object.values(loadingStates).some(Boolean);
  }, [loadingStates]);

  const withLoading = useCallback(async <T,>(
    key: string,
    operation: () => Promise<T>
  ): Promise<T> => {
    startLoading(key);
    try {
      return await operation();
    } finally {
      stopLoading(key);
    }
  }, [startLoading, stopLoading]);

  return {
    isLoading,
    setLoading,
    startLoading,
    stopLoading,
    withLoading,
    loadingStates,
  };
}

