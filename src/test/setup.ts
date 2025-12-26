import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Limpiar después de cada test
afterEach(() => {
  cleanup();
});

// Mock de variables de entorno
Object.defineProperty(window, 'import', {
  value: {
    meta: {
      env: {
        DEV: true,
        VITE_GEMINI_API_KEY: 'test-gemini-key',
        VITE_OPENROUTER_API_KEY: 'test-openrouter-key',
      },
    },
  },
});

