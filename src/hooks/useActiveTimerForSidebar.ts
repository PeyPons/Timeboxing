import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface ActiveTimerSidebarState {
  isActive: boolean;
  allocationId: string | null;
  /**
   * Segundos ya imputados hoy en time_entries para la allocation activa (sin la sesión en curso).
   * Misma base que useTaskTimer para que el reloj del menú coincida con el de la tarea.
   */
  baseSecondsAllocationToday: number;
  /** Inicio de la sesión actual (active_timers.started_at), ms desde epoch; null si no hay timer activo */
  sessionStartedAtMs: number | null;
  /** Nombre de la tarea cuando hay timer activo */
  taskName: string | null;
  /** Nombre del cliente (proyecto → cliente) cuando hay timer activo */
  clientName: string | null;
  /** Total del día en segundos (entradas + sesión en curso si aplica) */
  todayTotalSeconds: number;
  /** Total del día (todas las tareas + sesión en curso): texto tipo "7 min" o "1 h 23 min" */
  formattedTimeLabel: string;
  /** Mismo total en formato compacto tipo reloj: "0:00", "1:23", "45m" */
  formattedTodayCompact: string;
  /** Parar el cronómetro actual desde el sidebar (solo tiene efecto si isActive) */
  stopCurrentTimer: () => Promise<void>;
}

/** Mismo ritmo que antes del ajuste del reloj; start/stop y BroadcastChannel refrescan al instante */
const POLL_INTERVAL_MS = 60000;

function parseHours(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  const s = String(v).trim().replace(',', '.');
  const n = parseFloat(s);
  return Number.isNaN(n) ? 0 : n;
}

function formatTotalAsLabel(totalSeconds: number): string {
  if (totalSeconds === 0) return '0 min';
  const mins = Math.floor(totalSeconds / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${mins} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/** Formato compacto para la barra lateral (estilo barra global de tiempo) */
function formatTodayCompact(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0:00';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}:${String(m).padStart(2, '0')}`;
}

export function useActiveTimerForSidebar(employeeId: string | undefined): ActiveTimerSidebarState {
  const [state, setState] = useState<Omit<ActiveTimerSidebarState, 'stopCurrentTimer'>>({
    isActive: false,
    allocationId: null,
    baseSecondsAllocationToday: 0,
    sessionStartedAtMs: null,
    taskName: null,
    clientName: null,
    todayTotalSeconds: 0,
    formattedTimeLabel: '0 min',
    formattedTodayCompact: '0:00',
  });

  const fetchAndCompute = useCallback(async () => {
    if (!employeeId) {
      setState(s =>
        s.isActive
          ? s
          : {
              isActive: false,
              allocationId: null,
              baseSecondsAllocationToday: 0,
              sessionStartedAtMs: null,
              taskName: null,
              clientName: null,
              todayTotalSeconds: 0,
              formattedTimeLabel: '0 min',
              formattedTodayCompact: '0:00',
            }
      );
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    const [timerRes, entriesRes] = await Promise.all([
      supabase.from('active_timers').select('started_at, allocation_id').eq('employee_id', employeeId).maybeSingle(),
      supabase.from('time_entries').select('hours, allocation_id').eq('employee_id', employeeId).eq('date', today),
    ]);
    const timerRow = timerRes.data;
    const entryRows = entriesRes.data ?? [];
    const totalHoursFromEntries = entryRows.reduce((sum, row) => sum + Number(row?.hours ?? 0), 0);
    let totalSeconds = Math.round(totalHoursFromEntries * 3600);

    if (timerRow?.started_at) {
      const startedAtMs = new Date(timerRow.started_at).getTime();
      const elapsed = Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
      totalSeconds += elapsed;
      const allocationId = timerRow.allocation_id ?? null;

      let taskName: string | null = null;
      let clientName: string | null = null;
      let baseSecondsAllocationToday = 0;

      if (allocationId) {
        baseSecondsAllocationToday = Math.round(
          entryRows
            .filter((row) => row.allocation_id === allocationId)
            .reduce((sum, row) => sum + parseHours(row?.hours), 0) * 3600
        );

        const { data: alloc } = await supabase.from('allocations').select('task_name, project_id').eq('id', allocationId).maybeSingle();
        taskName = alloc?.task_name ?? null;
        if (alloc?.project_id) {
          const { data: proj } = await supabase.from('projects').select('client_id').eq('id', alloc.project_id).maybeSingle();
          if (proj?.client_id) {
            const { data: client } = await supabase.from('clients').select('name').eq('id', proj.client_id).maybeSingle();
            clientName = client?.name ?? null;
          }
        }
      }

      setState({
        isActive: true,
        allocationId,
        baseSecondsAllocationToday,
        sessionStartedAtMs: startedAtMs,
        taskName,
        clientName,
        todayTotalSeconds: totalSeconds,
        formattedTimeLabel: formatTotalAsLabel(totalSeconds),
        formattedTodayCompact: formatTodayCompact(totalSeconds),
      });
      return;
    }

    setState({
      isActive: false,
      allocationId: null,
      baseSecondsAllocationToday: 0,
      sessionStartedAtMs: null,
      taskName: null,
      clientName: null,
      todayTotalSeconds: totalSeconds,
      formattedTimeLabel: formatTotalAsLabel(totalSeconds),
      formattedTodayCompact: formatTodayCompact(totalSeconds),
    });
  }, [employeeId]);

  const stopCurrentTimer = useCallback(async () => {
    if (!employeeId) return;
    const { data: active } = await supabase
      .from('active_timers')
      .select('started_at, allocation_id')
      .eq('employee_id', employeeId)
      .maybeSingle();
    if (!active?.started_at || !active.allocation_id) return;
    const secondsToLog = Math.max(0, Math.floor((Date.now() - new Date(active.started_at).getTime()) / 1000));
    if (secondsToLog < 1) return;
    const hoursToLog = Number((secondsToLog / 3600).toFixed(6));
    const pDate = new Date().toISOString().split('T')[0];
    const { error } = await supabase.rpc('log_timer_hours', {
      p_employee_id: employeeId,
      p_allocation_id: active.allocation_id,
      p_hours: hoursToLog,
      p_notes: null,
      p_date: pDate,
    });
    if (!error) {
      window.dispatchEvent(new CustomEvent('timeboxing_timer_stopped'));
      new BroadcastChannel('timer_sync').postMessage('update');
      await fetchAndCompute();
    }
  }, [employeeId, fetchAndCompute]);

  useEffect(() => {
    fetchAndCompute();
    const t = setInterval(fetchAndCompute, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [fetchAndCompute]);

  useEffect(() => {
    const handleUpdate = () => {
      void fetchAndCompute();
    };

    window.addEventListener('timeboxing_timer_started', handleUpdate);
    window.addEventListener('timeboxing_timer_stopped', handleUpdate);

    const bc = new BroadcastChannel('timer_sync');
    bc.onmessage = handleUpdate;

    return () => {
      window.removeEventListener('timeboxing_timer_started', handleUpdate);
      window.removeEventListener('timeboxing_timer_stopped', handleUpdate);
      bc.close();
    };
  }, [fetchAndCompute]);

  return { ...state, stopCurrentTimer };
}
