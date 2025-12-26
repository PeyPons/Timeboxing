-- Agregar campo deadlines_tour_completed a la tabla employees
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS deadlines_tour_completed BOOLEAN DEFAULT false;

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_employees_deadlines_tour_completed 
ON employees(deadlines_tour_completed);

