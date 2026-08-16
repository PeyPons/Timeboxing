import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAgency } from '@/contexts/AgencyContext';

const STORAGE_KEY_PREFIX = 'timeboxing_department_view_';

interface DepartmentViewContextType {
  /** null = Vista Global, string = id del departamento seleccionado */
  selectedDepartmentId: string | null;
  setSelectedDepartmentId: (id: string | null) => void;
  clearDepartmentFilter: () => void;
}

const DepartmentViewContext = createContext<DepartmentViewContextType | null>(null);

export function DepartmentViewProvider({ children }: { children: React.ReactNode }) {
  const { currentAgency } = useAgency();
  const [selectedDepartmentId, setSelectedDepartmentIdState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const agencyId = currentAgency?.id;
    if (!agencyId) return null;
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${agencyId}`);
      return stored || null;
    } catch {
      return null;
    }
  });

  // Sincronizar con agencia: al cambiar de agencia, cargar la preferencia de esa agencia
  useEffect(() => {
    if (!currentAgency?.id) {
      setSelectedDepartmentIdState(null);
      return;
    }
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${currentAgency.id}`);
      setSelectedDepartmentIdState(stored || null);
    } catch {
      setSelectedDepartmentIdState(null);
    }
  }, [currentAgency?.id]);

  const setSelectedDepartmentId = useCallback((id: string | null) => {
    setSelectedDepartmentIdState(id);
    const agencyId = currentAgency?.id;
    if (agencyId && typeof window !== 'undefined') {
      try {
        if (id) localStorage.setItem(`${STORAGE_KEY_PREFIX}${agencyId}`, id);
        else localStorage.removeItem(`${STORAGE_KEY_PREFIX}${agencyId}`);
      } catch {
        // localStorage puede fallar (modo privado / cuota)
      }
    }
  }, [currentAgency?.id]);

  const clearDepartmentFilter = useCallback(() => {
    setSelectedDepartmentId(null);
  }, [setSelectedDepartmentId]);

  const value: DepartmentViewContextType = {
    selectedDepartmentId,
    setSelectedDepartmentId,
    clearDepartmentFilter,
  };

  return (
    <DepartmentViewContext.Provider value={value}>
      {children}
    </DepartmentViewContext.Provider>
  );
}

export function useDepartmentView() {
  const ctx = useContext(DepartmentViewContext);
  if (!ctx) {
    throw new Error('useDepartmentView must be used within DepartmentViewProvider');
  }
  return ctx;
}
