import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

const DEFAULT_MAX_HOURS = 12;
const ABSOLUTE_MAX_HOURS = 24;

export interface UseTaskTimerOptions {
  maxHours?: number;
  onTimeLogged?: (allocationId: string, hoursLogged: number) => void;
}

export interface UseTaskTimerResult {
  isRunning: boolean;
  isLoading: boolean;
  isSaving: boolean;
  /** Tiempo total del día en formato HH:MM:SS (para crono en curso) */
  formattedTime: string;
  /** Tiempo total del día en formato HH:MM (menos intrusivo, para "total registrado") */
  formattedTimeShort: string;
  startTimer: () => Promise<void>;
  stopTimer: () => Promise<void>;
}

function clampMaxHours(h: number | undefined): number {
  if (h == null || Number.isNaN(h)) return DEFAULT_MAX_HOURS;
  const n = Math.round(Number(h));
  return Math.max(1, Math.min(ABSOLUTE_MAX_HOURS, n));
}

function parseHours(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  const s = String(v).trim().replace(',', '.');
  const n = parseFloat(s);
  return Number.isNaN(n) ? 0 : n;
}

export function useTaskTimer(
  employeeId: string | undefined,
  allocationId: string,
  options: UseTaskTimerOptions = {}
): UseTaskTimerResult {
  const { maxHours: maxHoursOption, onTimeLogged } = options;
  const maxHours = clampMaxHours(maxHoursOption ?? DEFAULT_MAX_HOURS);
  const maxSeconds = maxHours * 3600;
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [baseSecondsToday, setBaseSecondsToday] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Marca de tiempo absoluta (Date.now()) del momento en que el timer empezó a correr */
  const absoluteStartTimeRef = useRef<number>(0);
  /** Tras guardar, evita que un loadFromDb con datos desactualizados baje el total mostrado */
  const optimisticBaseSecondsRef = useRef<number | null>(null);

  const callLogTimerHours = useCallback(
    async (pEmployeeId: string, pAllocationId: string, hoursToLog: number, notes?: string) => {
      if (hoursToLog <= 0) return;
      const pDate = new Date().toISOString().split('T')[0];
      const { error } = await supabase.rpc('log_timer_hours', {
        p_employee_id: pEmployeeId,
        p_allocation_id: pAllocationId,
        p_hours: hoursToLog,
        p_notes: notes ?? null,
        p_date: pDate,
      });
      if (error) throw error;
    },
    []
  );

  const loadFromDb = useCallback(async () => {
    if (!employeeId) {
      setIsLoading(false);
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    const [timerRes, entriesRes] = await Promise.all([
      supabase
        .from('active_timers')
        .select('started_at, allocation_id')
        .eq('employee_id', employeeId)
        .maybeSingle(),
      supabase
        .from('time_entries')
        .select('hours')
        .eq('employee_id', employeeId)
        .eq('allocation_id', allocationId)
        .eq('date', today),
    ]);

    const { data: timerRow, error: timerError } = timerRes;
    const { data: entryRows } = entriesRes;
    const totalHours = (entryRows || []).reduce((sum, row) => sum + parseHours(row?.hours), 0);
    const fromServer = Math.round(totalHours * 3600);
    const withOptimistic = optimisticBaseSecondsRef.current != null
      ? Math.max(fromServer, optimisticBaseSecondsRef.current)
      : fromServer;
    if (optimisticBaseSecondsRef.current != null) optimisticBaseSecondsRef.current = null;
    setBaseSecondsToday(withOptimistic);

    if (timerError) {
      setIsLoading(false);
      return;
    }

    if (timerRow && timerRow.allocation_id === allocationId) {
      const startedAt = new Date(timerRow.started_at).getTime();
      const diffSeconds = Math.floor((Date.now() - startedAt) / 1000);
      if (diffSeconds >= maxSeconds) {
        toast({
          title: 'Cronómetro auto-pausado',
          description: `Más de ${maxHours}h. Se ha pausado automáticamente.`,
          variant: 'destructive',
        });
        try {
          await callLogTimerHours(employeeId, allocationId, maxSeconds / 3600, 'Auto-cierre');
          setBaseSecondsToday((b) => {
            const next = b + maxSeconds;
            optimisticBaseSecondsRef.current = next;
            return next;
          });
        } catch {
          await supabase.from('active_timers').delete().eq('employee_id', employeeId);
        }
        setElapsedSeconds(0);
        setIsRunning(false);
      } else {
        // Anclar el origen absoluto para que el intervalo calcule por diferencia real
        absoluteStartTimeRef.current = Date.now() - diffSeconds * 1000;
        setElapsedSeconds(diffSeconds);
        setIsRunning(true);
      }
    } else {
      setElapsedSeconds(0);
      setIsRunning(false);
    }
    setIsLoading(false);
  }, [employeeId, allocationId, maxSeconds, maxHours, callLogTimerHours, toast]);

  useEffect(() => {
    loadFromDb();
    const t = setTimeout(loadFromDb, 600);
    return () => clearTimeout(t);
  }, [loadFromDb]);

  useEffect(() => {
    const onOtherStarted = (e: Event) => {
      const { allocationId: otherId } = (e as CustomEvent<{ allocationId: string }>).detail;
      if (otherId !== allocationId && isRunning) {
        setElapsedSeconds(0);
        setIsRunning(false);
        loadFromDb();
      }
    };
    window.addEventListener('timeboxing_timer_started', onOtherStarted);
    return () => window.removeEventListener('timeboxing_timer_started', onOtherStarted);
  }, [allocationId, isRunning, loadFromDb]);

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      const now = Date.now();
      const next = Math.floor((now - absoluteStartTimeRef.current) / 1000);

      if (next >= maxSeconds) {
        clearInterval(id);
        const hoursMax = maxSeconds / 3600;
        callLogTimerHours(employeeId!, allocationId, hoursMax, 'Auto-cierre').then(() => {
          setBaseSecondsToday((b) => {
            const nextTotal = b + maxSeconds;
            optimisticBaseSecondsRef.current = nextTotal;
            return nextTotal;
          });
          onTimeLogged?.(allocationId, hoursMax);
        }).catch(() => {
          supabase.from('active_timers').delete().eq('employee_id', employeeId!);
        });
        setElapsedSeconds(maxSeconds);
        setIsRunning(false);
      } else {
        setElapsedSeconds(next);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning, allocationId, maxSeconds, employeeId, callLogTimerHours, onTimeLogged]);

  const startTimer = useCallback(async () => {
    if (!employeeId) return;
    const { data: existing } = await supabase
      .from('active_timers')
      .select('started_at, allocation_id')
      .eq('employee_id', employeeId)
      .maybeSingle();

    if (existing && existing.allocation_id !== allocationId) {
      const sec = Math.floor((Date.now() - new Date(existing.started_at).getTime()) / 1000);
      const hours = Number((Math.min(sec, maxSeconds) / 3600).toFixed(4));
      if (hours > 0) {
        try {
          await callLogTimerHours(employeeId, existing.allocation_id, hours);
        } catch {
          toast({ title: 'Error', description: 'No se pudo cerrar el timer anterior.', variant: 'destructive' });
          return;
        }
      }
    } else if (existing?.allocation_id === allocationId) {
      setElapsedSeconds(Math.min(maxSeconds, Math.floor((Date.now() - new Date(existing.started_at).getTime()) / 1000)));
      setIsRunning(true);
      return;
    }

    absoluteStartTimeRef.current = Date.now();
    setElapsedSeconds(0);
    setIsRunning(true);
    await supabase.from('active_timers').upsert(
      { employee_id: employeeId, allocation_id: allocationId, started_at: new Date().toISOString() },
      { onConflict: 'employee_id' }
    );
    window.dispatchEvent(new CustomEvent('timeboxing_timer_started', { detail: { allocationId } }));
    new BroadcastChannel('timer_sync').postMessage('update');
  }, [employeeId, allocationId, maxSeconds, callLogTimerHours, toast]);

  const stopTimer = useCallback(async () => {
    if (!employeeId || isSaving) return;
    setIsSaving(true);
    try {
      const { data: active } = await supabase
        .from('active_timers')
        .select('allocation_id, started_at')
        .eq('employee_id', employeeId)
        .maybeSingle();

      const allocationToLog = active?.allocation_id ?? allocationId;
      const fromDb = active?.started_at
        ? Math.max(0, Math.floor((Date.now() - new Date(active.started_at).getTime()) / 1000))
        : 0;
      // Usar el mayor entre BD y estado local (evita subconteo si el intervalo no ha actualizado aún)
      let secondsToLog = Math.max(fromDb, elapsedSeconds);
      // Si el crono estaba en marcha, guardar al menos 1 segundo (evita 0 cuando paras muy rápido)
      if (isRunning && secondsToLog < 1) secondsToLog = 1;
      const hoursToLog = Number((secondsToLog / 3600).toFixed(6));

      if (hoursToLog > 0) {
        await callLogTimerHours(employeeId, allocationToLog, hoursToLog);
        if (allocationToLog === allocationId) {
          setBaseSecondsToday((b) => {
            const next = b + secondsToLog;
            optimisticBaseSecondsRef.current = next;
            return next;
          });
          await loadFromDb();
        }
        onTimeLogged?.(allocationToLog, hoursToLog);
      } else {
        await supabase.from('active_timers').delete().eq('employee_id', employeeId);
      }

      setElapsedSeconds(0);
      setIsRunning(false);
      window.dispatchEvent(new CustomEvent('timeboxing_timer_stopped'));
      new BroadcastChannel('timer_sync').postMessage('update');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      toast({ title: 'Error al guardar tiempo', description: msg, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }, [employeeId, allocationId, elapsedSeconds, isRunning, isSaving, callLogTimerHours, onTimeLogged, toast, loadFromDb]);

  const totalSeconds = baseSecondsToday + elapsedSeconds;
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');

  return {
    isRunning,
    isLoading,
    isSaving,
    formattedTime: `${h}:${m}:${s}`,
    formattedTimeShort: `${h}:${m}`,
    startTimer,
    stopTimer,
  };
}
