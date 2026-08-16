import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiDelete, apiGet, apiPost } from '../lib/api';
import { useAgency } from '../hooks/useAgency';
import EmptyAgencyCard from '../components/EmptyAgencyCard';

interface Skill {
  id: string;
  name: string;
  description: string;
  skill_type: string;
  is_system_template: boolean;
  slug: string;
}

export default function SkillsPage() {
  const { agencyId, loading: agencyLoading, hasAgency } = useAgency();
  const navigate = useNavigate();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);
    setError('');
    try {
      const r = await apiGet<{ skills: Skill[] }>(`/api/skills?agencyId=${agencyId}`);
      setSkills(r.skills);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar skills');
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function duplicateAndEdit(id: string) {
    if (!agencyId) return;
    setDuplicatingId(id);
    setActionError('');
    try {
      const { skill } = await apiPost<{ skill: Skill }>(`/api/skills/${id}/duplicate`, { agencyId });
      navigate(`/skills/${skill.id}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo duplicar');
    } finally {
      setDuplicatingId(null);
    }
  }

  function exportSkill(s: Skill) {
    const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${s.slug}.json`;
    a.click();
  }

  async function removeSkill(s: Skill) {
    if (s.is_system_template) return;
    setDeletingId(s.id);
    setActionError('');
    try {
      await apiDelete(`/api/skills/${s.id}`);
      setDeleteConfirmId(null);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo eliminar');
    } finally {
      setDeletingId(null);
    }
  }

  const templates = skills.filter((s) => s.is_system_template);
  const agencySkills = skills.filter((s) => !s.is_system_template);

  if (agencyLoading) return <p>Cargando agencia…</p>;
  if (!hasAgency) return <EmptyAgencyCard />;

  return (
    <div>
      <h1>Skills de revisión</h1>
      <p style={{ color: '#64748b', marginBottom: '1rem' }}>
        Las plantillas del sistema no se editan directamente: duplícalas para personalizarlas. Tus skills de agencia
        sí se pueden editar.
      </p>
      {actionError && <p className="error">{actionError}</p>}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <Link to="/skills/new" className="btn" style={{ textDecoration: 'none' }}>
          Crear skill
        </Link>
        <label className={`btn secondary${importing ? ' btn-busy' : ''}`} style={{ cursor: importing ? 'wait' : 'pointer' }}>
          {importing ? 'Importando…' : 'Importar JSON'}
          <input
            type="file"
            accept="application/json"
            hidden
            disabled={importing}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file || !agencyId) return;
              setImporting(true);
              setActionError('');
              try {
                const json = JSON.parse(await file.text()) as Record<string, unknown>;
                const { skill } = await apiPost<{ skill: Skill }>('/api/skills', {
                  agencyId,
                  slug: String(json.slug ?? `import-${Date.now().toString(36)}`),
                  name: String(json.name ?? 'Skill importada'),
                  description: String(json.description ?? ''),
                  skillType: json.skill_type ?? json.skillType ?? 'document',
                  systemPrompt: String(json.system_prompt ?? json.systemPrompt ?? ''),
                  reviewChecklist: json.review_checklist ?? json.reviewChecklist ?? [],
                  visibilityRoles: json.visibility_roles ?? json.visibilityRoles ?? [],
                });
                navigate(`/skills/${skill.id}`);
              } catch (err) {
                setActionError(err instanceof Error ? err.message : 'JSON inválido o error al importar');
              } finally {
                setImporting(false);
              }
            }}
          />
        </label>
      </div>

      {loading ? (
        <p className="loading-hint">Cargando…</p>
      ) : error ? (
        <div className="card">
          <p className="error">{error}</p>
          <button type="button" className="btn secondary" onClick={() => void reload()}>
            Reintentar
          </button>
        </div>
      ) : (
        <>
          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Tus skills ({agencySkills.length})</h2>
            {agencySkills.length === 0 ? (
              <p className="card" style={{ color: '#64748b' }}>
                Aún no tienes skills propias. Duplica una plantilla abajo o crea una nueva.
              </p>
            ) : (
              agencySkills.map((s) => (
                <div key={s.id} className="card">
                  <h3>{s.name}</h3>
                  <p style={{ color: '#64748b' }}>{s.description || s.skill_type}</p>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                    <Link to={`/skills/${s.id}`} className="btn" style={{ textDecoration: 'none' }}>
                      Editar
                    </Link>
                    <button type="button" className="btn secondary" onClick={() => exportSkill(s)}>
                      Exportar JSON
                    </button>
                    {deleteConfirmId === s.id ? (
                      <div className="confirm-inline" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn danger"
                          disabled={deletingId === s.id}
                          onClick={() => void removeSkill(s)}
                        >
                          {deletingId === s.id ? 'Eliminando…' : 'Confirmar'}
                        </button>
                        <button
                          type="button"
                          className="btn secondary"
                          disabled={deletingId === s.id}
                          onClick={() => setDeleteConfirmId(null)}
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button type="button" className="btn danger" onClick={() => setDeleteConfirmId(s.id)}>
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </section>

          <section>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>
              Plantillas del sistema ({templates.length})
            </h2>
            {templates.map((s) => (
              <div key={s.id} className="card">
                <h3>{s.name}</h3>
                <p style={{ color: '#64748b' }}>{s.description || s.skill_type}</p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                  <button
                    type="button"
                    className="btn"
                    disabled={duplicatingId === s.id}
                    onClick={() => void duplicateAndEdit(s.id)}
                  >
                    {duplicatingId === s.id ? 'Duplicando…' : 'Duplicar y editar'}
                  </button>
                  <button type="button" className="btn secondary" onClick={() => exportSkill(s)}>
                    Exportar JSON
                  </button>
                </div>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
