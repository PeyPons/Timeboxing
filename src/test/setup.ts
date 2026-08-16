import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Vars Vite que usa @/lib/supabase al importar (createClient no acepta URL vacía).
vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

<<<<<<< HEAD
afterEach(() => {
  cleanup();
});
=======
// Limpiar después de cada test
afterEach(() => {
  cleanup();
});

>>>>>>> origin/cursor/fix-deadline-copy-inactive-d992
