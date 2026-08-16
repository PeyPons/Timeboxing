import { useContext, type Context, type ContextType } from 'react';
import { AppContext } from '@/contexts/AppContext';

type AppContextValue = NonNullable<ContextType<typeof AppContext>>;

// Importar DemoContext de forma condicional
let DemoContext: Context<Partial<AppContextValue> | undefined> | null = null;
try {
  // Intentar importar DemoContext solo si está disponible
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const demoModule = require('@/contexts/DemoContext');
  DemoContext = demoModule.DemoContext as Context<Partial<AppContextValue> | undefined>;
} catch {
  // DemoContext no disponible, usar solo AppContext
}

/**
 * Hook que intenta usar DemoContext si está disponible, 
 * si no, usa AppContext. Permite que los componentes funcionen
 * tanto en modo demo como en modo real.
 */
export function useAppOrDemo(): AppContextValue {
  // Intentar usar DemoContext primero si está disponible
  if (DemoContext) {
    try {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const demoContext = useContext(DemoContext);
      if (demoContext && typeof demoContext === 'object') {
        // Convertir DemoContext a formato compatible con AppContext
        return {
          ...demoContext,
          isLoading: false,
          isAdmin: false,
          addEmployee: () => Promise.resolve(null),
          updateEmployee: () => Promise.resolve(null),
          deleteEmployee: async () => true,
          toggleEmployeeActive: () => Promise.resolve(null),
          addClient: () => Promise.resolve(null),
          updateClient: () => Promise.resolve(null),
          deleteClient: () => Promise.resolve(null),
          addProject: () => Promise.resolve(null),
          updateProject: () => Promise.resolve(null),
          deleteProject: () => Promise.resolve(null),
          addAllocation: () => Promise.resolve(null),
          updateAllocation: () => Promise.resolve(null),
          deleteAllocation: () => Promise.resolve(null),
          addAbsence: () => Promise.resolve(null),
          deleteAbsence: () => Promise.resolve(null),
          addTeamEvent: () => Promise.resolve(null),
          updateTeamEvent: () => Promise.resolve(null),
          deleteTeamEvent: () => Promise.resolve(null),
          getProjectHoursForMonth: () => 0,
          getClientTotalHoursForMonth: () => 0,
          getProjectById: () => undefined,
          getClientById: () => undefined,
          professionalGoals: [],
          addProfessionalGoal: () => Promise.resolve(null),
          updateProfessionalGoal: () => Promise.resolve(null),
          deleteProfessionalGoal: () => Promise.resolve(null),
          getEmployeeGoals: () => [],
          loadDataForMonth: () => Promise.resolve(true),
          addWeeklyFeedback: () => Promise.resolve(null),
        } as unknown as AppContextValue;
      }
    } catch {
      // DemoContext no está disponible en este árbol, continuar con AppContext
    }
  }

  // Usar AppContext normal
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const appContext = useContext(AppContext);
  if (!appContext) {
    throw new Error('useAppOrDemo must be used within AppProvider or DemoProvider');
  }
  return appContext;
}
