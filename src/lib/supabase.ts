import { createClient } from '@supabase/supabase-js';

// Usamos variables de entorno para no subir claves privadas a GitHub
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseKey);
