import { format, parse, startOfMonth } from 'date-fns';

/**
 * Mes visible compartido entre dashboard, planificador, previsión, radar, etc.
 * Usa sessionStorage: al cerrar la pestaña se vuelve al mes actual (evita abrir
 * siempre un mes antiguo guardado en localStorage).
 */
export const PLANNER_DATE_STORAGE_KEY = 'planner_date';

const LEGACY_LOCAL_KEY = 'planner_date';
const LEGACY_FORECAST_DATE_KEY = 'forecast_date';

/** Evento same-tab para sincronizar banner y hooks de navegación de mes. */
export const PLANNER_MONTH_CHANGE_EVENT = 'taimbox:planner-month-change';

function storageAvailable(kind: 'sessionStorage' | 'localStorage'): boolean {
  try {
    const s = kind === 'sessionStorage' ? sessionStorage : localStorage;
    const probe = '__tb_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function dispatchPlannerMonthChange(month: Date): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(PLANNER_MONTH_CHANGE_EVENT, {
      detail: { monthIso: startOfMonth(month).toISOString() },
    })
  );
}

/** Interpreta `yyyy-MM` o ISO legado → inicio de mes local. */
export function parseStoredPlannerMonth(raw: string): Date | null {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    const parsed = parse(`${trimmed}-01`, 'yyyy-MM-dd', new Date());
    if (!Number.isNaN(parsed.getTime())) return startOfMonth(parsed);
    return null;
  }
  const asDate = new Date(trimmed);
  if (!Number.isNaN(asDate.getTime())) return startOfMonth(asDate);
  return null;
}

function clearLegacyLocalStorage(): void {
  if (!storageAvailable('localStorage')) return;
  try {
    localStorage.removeItem(LEGACY_LOCAL_KEY);
    localStorage.removeItem(LEGACY_FORECAST_DATE_KEY);
  } catch {
    /* ignore */
  }
}

export function readStoredPlannerMonth(): Date {
  const fallback = startOfMonth(new Date());
  if (typeof window === 'undefined') return fallback;

  if (storageAvailable('sessionStorage')) {
    try {
      const fromSession = sessionStorage.getItem(PLANNER_DATE_STORAGE_KEY);
      if (fromSession) {
        const parsed = parseStoredPlannerMonth(fromSession);
        if (parsed) return parsed;
      }
    } catch {
      /* ignore */
    }
  }

  // Migración one-shot: valor legado en localStorage → solo para esta sesión.
  if (storageAvailable('localStorage')) {
    try {
      const legacy =
        localStorage.getItem(LEGACY_LOCAL_KEY) ?? localStorage.getItem(LEGACY_FORECAST_DATE_KEY);
      if (legacy) {
        const parsed = parseStoredPlannerMonth(legacy);
        clearLegacyLocalStorage();
        if (parsed) {
          writeStoredPlannerMonth(parsed);
          return parsed;
        }
      }
    } catch {
      /* ignore */
    }
  }

  return fallback;
}

export function writeStoredPlannerMonth(month: Date): void {
  if (typeof window === 'undefined' || !storageAvailable('sessionStorage')) return;
  const normalized = startOfMonth(month);
  try {
    const next = format(normalized, 'yyyy-MM');
    const prev = sessionStorage.getItem(PLANNER_DATE_STORAGE_KEY);
    sessionStorage.setItem(PLANNER_DATE_STORAGE_KEY, next);
    clearLegacyLocalStorage();
    if (prev !== next) {
      dispatchPlannerMonthChange(normalized);
    }
  } catch {
    /* private mode */
  }
}
