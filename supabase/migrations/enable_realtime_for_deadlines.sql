-- Habilitar Realtime para la tabla deadlines
ALTER PUBLICATION supabase_realtime ADD TABLE deadlines;

-- Habilitar Realtime para la tabla global_assignments
ALTER PUBLICATION supabase_realtime ADD TABLE global_assignments;

-- Nota: Si la publicación no existe, créala primero con:
-- CREATE PUBLICATION supabase_realtime FOR TABLE deadlines, global_assignments;

