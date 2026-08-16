export type PlannerSheetViewMode = 'day' | 'week' | 'month';

function isPlannerSheetViewMode(value: string | null | undefined): value is PlannerSheetViewMode {
  return value === 'day' || value === 'week' || value === 'month';
}

export function readPlannerSheetViewMode(): PlannerSheetViewMode {
  try {
    const raw = localStorage.getItem('planner_sheetViewMode');
    if (isPlannerSheetViewMode(raw)) return raw;
  } catch {
    // ignore
  }
  return 'week';
}

export function persistPlannerSheetViewMode(mode: PlannerSheetViewMode): void {
  try {
    localStorage.setItem('planner_sheetViewMode', mode);
  } catch {
    // ignore
  }
}
