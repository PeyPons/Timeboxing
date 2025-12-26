-- Tabla para almacenar deadlines (asignaciones de horas por proyecto y empleado)
CREATE TABLE IF NOT EXISTS deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  notes TEXT,
  employee_hours JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id)
);

-- Índice para búsquedas rápidas por proyecto
CREATE INDEX IF NOT EXISTS idx_deadlines_project_id ON deadlines(project_id);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_deadlines_updated_at BEFORE UPDATE ON deadlines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comentarios
COMMENT ON TABLE deadlines IS 'Asignaciones de horas por proyecto y empleado (deadlines)';
COMMENT ON COLUMN deadlines.project_id IS 'ID del proyecto';
COMMENT ON COLUMN deadlines.notes IS 'Anotaciones sobre el deadline';
COMMENT ON COLUMN deadlines.employee_hours IS 'JSON con asignación de horas por empleado: {"employee_id": horas}';

