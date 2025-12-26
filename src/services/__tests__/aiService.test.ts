import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIService } from '../aiService';

describe('AIService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('cleanAIResponse', () => {
    it('debe eliminar asteriscos de markdown', () => {
      const input = '**Texto en negrita**';
      const result = AIService.cleanAIResponse(input);
      expect(result).toBe('Texto en negrita');
    });

    it('debe convertir listas con asteriscos a viñetas', () => {
      const input = '* Item 1\n* Item 2';
      const result = AIService.cleanAIResponse(input);
      expect(result).toContain('• Item 1');
      expect(result).toContain('• Item 2');
    });

    it('debe eliminar bloques de código markdown', () => {
      const input = 'Texto normal\n```code\nconst x = 1;\n```\nMás texto';
      const result = AIService.cleanAIResponse(input);
      expect(result).not.toContain('```');
      expect(result).not.toContain('const x = 1;');
    });

    it('debe limpiar múltiples saltos de línea', () => {
      const input = 'Línea 1\n\n\n\nLínea 2';
      const result = AIService.cleanAIResponse(input);
      expect(result.split('\n\n').length).toBeLessThanOrEqual(2);
    });

    it('debe eliminar etiquetas HTML', () => {
      const input = 'Texto <strong>importante</strong> aquí';
      const result = AIService.cleanAIResponse(input);
      expect(result).not.toContain('<strong>');
      expect(result).not.toContain('</strong>');
    });
  });
});

