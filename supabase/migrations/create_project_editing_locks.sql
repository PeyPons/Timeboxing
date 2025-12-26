-- Tabla para rastrear qué proyectos están siendo editados y por quién
CREATE TABLE IF NOT EXISTS project_editing_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  month VARCHAR(7) NOT NULL, -- YYYY-MM
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '5 minutes',
  UNIQUE(project_id, month)
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_editing_locks_project_month ON project_editing_locks(project_id, month);
CREATE INDEX IF NOT EXISTS idx_editing_locks_employee ON project_editing_locks(employee_id);
CREATE INDEX IF NOT EXISTS idx_editing_locks_expires ON project_editing_locks(expires_at);

-- Función para limpiar locks expirados automáticamente
CREATE OR REPLACE FUNCTION cleanup_expired_locks()
RETURNS void AS $$
BEGIN
  DELETE FROM project_editing_locks WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Trigger para limpiar locks expirados antes de insertar
CREATE OR REPLACE FUNCTION check_and_cleanup_locks()
RETURNS TRIGGER AS $$
BEGIN
  -- Limpiar locks expirados antes de insertar
  DELETE FROM project_editing_locks WHERE expires_at < NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cleanup_before_insert_lock
BEFORE INSERT ON project_editing_locks
FOR EACH ROW
EXECUTE FUNCTION check_and_cleanup_locks();

-- Habilitar Realtime para esta tabla
ALTER PUBLICATION supabase_realtime ADD TABLE project_editing_locks;

