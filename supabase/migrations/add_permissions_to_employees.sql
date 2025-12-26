-- Añadir campo permissions a la tabla employees
-- Este campo almacenará un JSONB con los permisos de acceso a diferentes páginas

ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{
  "can_access_planner": true,
  "can_access_projects": true,
  "can_access_clients": true,
  "can_access_team": true,
  "can_access_reports": true,
  "can_access_client_reports": true,
  "can_access_google_ads": true,
  "can_access_meta_ads": true,
  "can_access_ads_reports": true,
  "can_access_deadlines": true
}'::jsonb;

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_employees_permissions ON employees USING GIN (permissions);

-- Comentario para documentación
COMMENT ON COLUMN employees.permissions IS 'Permisos de acceso del empleado a diferentes secciones de la aplicación. Formato JSONB con claves booleanas.';

