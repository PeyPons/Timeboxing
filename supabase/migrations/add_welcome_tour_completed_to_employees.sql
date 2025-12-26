-- Agregar campo welcome_tour_completed a la tabla employees
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS welcome_tour_completed BOOLEAN DEFAULT false;

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_employees_welcome_tour_completed 
ON employees(welcome_tour_completed);

