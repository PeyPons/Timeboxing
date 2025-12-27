-- Agregar campo employee_id a global_assignments para rastrear quién creó cada asignación
-- Esto permite restringir la eliminación solo a las asignaciones propias

-- Agregar la columna si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'global_assignments' 
        AND column_name = 'employee_id'
    ) THEN
        ALTER TABLE global_assignments 
        ADD COLUMN employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;
        
        -- Crear índice para búsquedas rápidas
        CREATE INDEX IF NOT EXISTS idx_global_assignments_employee_id 
        ON global_assignments(employee_id);
        
        -- Comentario
        COMMENT ON COLUMN global_assignments.employee_id IS 'ID del empleado que creó la asignación global';
    END IF;
END $$;
