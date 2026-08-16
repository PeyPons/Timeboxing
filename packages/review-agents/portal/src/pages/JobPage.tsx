import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ApiError, apiGet, apiPost } from '../lib/api';
import { isActiveStatus, isTerminalStatus } from '../lib/jobStatus';
import { supabase } from '../lib/supabase';
import JobStatusBadge from '../components/JobStatusBadge';

interface Job {
  id: string;
  status: string;
  progress_pct: number;
  progress_message: string | null;
  result_markdown: string | null;
  error_message: string | null;
  live_preview: string | null;
  live_phase: string | null;
  live_updated_at: string | null;
  skill?: { name: string } | null;
}

interface Event {
  event_type: string;
  message: string;
  created_at: string;
}

type PageState = 'loading' | 'ready' | 'error' | 'notFound';

export default function JobPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [pageState, setPageState] = useState<PageState>('loading');
  const [loadError, setLoadError] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const liveRef = useRef<HTMLDivElement>(null);
  const [progressAnnouncement, setProgressAnnouncement] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const { job: j } = await apiGet<{ job: Job }>(`/api/jobs/${id}`);
      setJob(j);
      const { events: ev } = await apiGet<{ events: Event[] }>(`/api/jobs/${id}/events`);
      setEvents(ev);
      setPageState('ready');
      setLoadError('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setPageState('notFound');
        return;
      }
      setLoadError(err instanceof Error ? err.message : 'Error al cargar la revisión');
      setPageState((prev) => (prev === 'loading' ? 'error' : prev));
    }
  }, [id]);

  useEffect(() => {
    setPageState('loading');
    setJob(null);
    setEvents([]);
    void load();
  }, [id, load]);

  useEffect(() => {
    if (!job || isTerminalStatus(job.status)) return;
    const t = setInterval(() => void load(), 3000);
    return () => clearInterval(t);
  }, [job, load]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`job-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'review_jobs', filter: `id=eq.${id}` },
        (payload) => {
          const row = payload.new as Job;
          setJob((prev) => (prev ? { ...prev, ...row } : row));
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'review_job_events', filter: `job_id=eq.${id}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, load]);

  useEffect(() => {
    if (liveRef.current) {
      liveRef.current.scrollTop = liveRef.current.scrollHeight;
    }
  }, [job?.live_preview]);

  useEffect(() => {
    if (!job) return;
    const text = job.progress_message
      ? `${job.progress_pct}% — ${job.progress_message}`
      : `${job.progress_pct}%`;
    setProgressAnnouncement(text);
  }, [job]);

  useEffect(() => {
    const skillName = job?.skill?.name;
    document.title = skillName ? `Revisión · ${skillName} — Review Agents` : 'Revisión — Review Agents';
    return () => {
      document.title = 'Review Agents';
    };
  }, [job?.skill?.name]);

  async function cancel() {
    if (!id) return;
    setCancelling(true);
    setCancelError('');
    try {
      await apiPost(`/api/jobs/${id}/cancel`, {});
      setConfirmCancel(false);
      await load();
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'No se pudo cancelar');
    } finally {
      setCancelling(false);
    }
  }

  if (pageState === 'loading') return <p>Cargando…</p>;

  if (pageState === 'notFound') {
    return (
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Revisión no encontrada</h1>
        <p style={{ color: '#64748b' }}>No existe o no tienes permiso para verla.</p>
        <Link to="/" className="btn" style={{ display: 'inline-block', textDecoration: 'none' }}>
          Volver al inicio
        </Link>
      </div>
    );
  }

  if (pageState === 'error' && !job) {
    return (
      <div className="card">
        <p className="error">{loadError}</p>
        <button type="button" className="btn secondary" onClick={() => void load()}>
          Reintentar
        </button>
      </div>
    );
  }

  if (!job) return null;

  const isActive = isActiveStatus(job.status);
  const expectedLivePhase = job.status === 'reducing' ? 'reducing' : job.status === 'mapping' ? 'mapping' : null;
  const previewMatchesPhase = !expectedLivePhase || job.live_phase === expectedLivePhase;
  const showLive = isActive && Boolean(job.live_preview?.trim()) && previewMatchesPhase;
  const isReduceWaiting = job.status === 'reducing' && !showLive;
  const liveIsStreaming =
    showLive &&
    job.live_updated_at &&
    Date.now() - new Date(job.live_updated_at).getTime() < 4000;
  const livePhaseLabel =
    job.status === 'reducing' || job.live_phase === 'reducing'
      ? 'Redactando informe final'
      : job.status === 'mapping' || job.live_phase === 'mapping'
        ? 'Analizando contenido'
        : 'Procesando';

  return (
    <div>
      <h1>{job.skill?.name ? `Revisión · ${job.skill.name}` : 'Revisión'}</h1>
      <div className="card">
        <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <strong>Estado:</strong>
          <JobStatusBadge status={job.status} />
          {isActive && <span className="live-pulse"> · en curso</span>}
        </p>
        <div
          className="progress"
          style={{ margin: '0.75rem 0' }}
          role="progressbar"
          aria-valuenow={job.progress_pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progreso de la revisión"
        >
          <div style={{ width: `${job.progress_pct}%` }} />
        </div>
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {progressAnnouncement}
        </div>
        {job.progress_message && <p>{job.progress_message}</p>}
        {job.error_message && <p className="error">{job.error_message}</p>}
        {loadError && <p className="error">{loadError}</p>}
        {cancelError && <p className="error">{cancelError}</p>}
        {!isTerminalStatus(job.status) && (
          <div style={{ marginTop: '0.75rem' }}>
            {!confirmCancel ? (
              <button type="button" className="btn secondary" onClick={() => setConfirmCancel(true)}>
                Cancelar revisión
              </button>
            ) : (
              <div className="confirm-inline">
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>
                  ¿Seguro que quieres cancelar esta revisión?
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="button" className="btn danger" disabled={cancelling} onClick={() => void cancel()}>
                    {cancelling ? 'Cancelando…' : 'Sí, cancelar'}
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={cancelling}
                    onClick={() => setConfirmCancel(false)}
                  >
                    No
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {(showLive || (isActive && ['mapping', 'reducing'].includes(job.status))) && (
        <div className="card live-panel">
          <div className="live-panel-header">
            <span className="live-dot" aria-hidden />
            <strong>{livePhaseLabel}</strong>
            <span className="live-hint">
              {showLive && !liveIsStreaming && job.status === 'reducing'
                ? 'contexto enviado — esperando primer token del modelo'
                : 'salida de Ollama en directo (texto plano)'}
            </span>
          </div>
          <div
            ref={liveRef}
            className="live-preview"
            aria-live="polite"
            aria-label="Vista previa en directo del modelo"
          >
            {showLive ? (
              <>
                <pre className="live-raw">{job.live_preview ?? ''}</pre>
                {liveIsStreaming && <span className="live-cursor" aria-hidden />}
              </>
            ) : (
              <p className="live-waiting">
                <span className="live-dot" aria-hidden />
                {isReduceWaiting
                  ? 'Preparando contexto del informe…'
                  : 'Esperando respuesta del modelo…'}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <h3>Actividad</h3>
        <ul className="timeline">
          {events.map((e) => (
            <li key={`${e.created_at}-${e.event_type}-${e.message}`}>
              {new Date(e.created_at).toLocaleTimeString('es-ES')} — {e.message}
            </li>
          ))}
        </ul>
      </div>
      {job.status === 'completed' && job.result_markdown && (
        <div className="card markdown-body">
          <h3>Informe</h3>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{job.result_markdown}</ReactMarkdown>
          <button
            type="button"
            className="btn secondary"
            style={{ marginTop: '1rem' }}
            onClick={() => {
              const blob = new Blob([job.result_markdown ?? ''], { type: 'text/markdown' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `revision-${id}.md`;
              a.click();
            }}
          >
            Exportar Markdown
          </button>
        </div>
      )}
    </div>
  );
}
