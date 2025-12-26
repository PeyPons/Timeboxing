import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatPercentage,
  formatHours,
  formatNumber,
  formatDate,
  truncate,
  capitalize,
  formatFullName,
} from '../formatters';

describe('formatters', () => {
  describe('formatCurrency', () => {
    it('debe formatear números como moneda en euros', () => {
      expect(formatCurrency(1234.56)).toContain('1.234,56');
      expect(formatCurrency(0)).toContain('0,00');
    });

    it('debe manejar valores null/undefined', () => {
      expect(formatCurrency(null)).toBe('0,00 €');
      expect(formatCurrency(undefined)).toBe('0,00 €');
    });
  });

  describe('formatPercentage', () => {
    it('debe formatear números como porcentaje', () => {
      expect(formatPercentage(50)).toBe('50.0%');
      expect(formatPercentage(50.5, 2)).toBe('50.50%');
    });

    it('debe manejar valores null/undefined', () => {
      expect(formatPercentage(null)).toBe('0%');
      expect(formatPercentage(undefined)).toBe('0%');
    });
  });

  describe('formatHours', () => {
    it('debe formatear horas en formato decimal', () => {
      expect(formatHours(1.5, 'decimal')).toBe('1,5h');
      expect(formatHours(8, 'decimal')).toBe('8,0h');
    });

    it('debe formatear horas en formato detallado', () => {
      expect(formatHours(1.5, 'detailed')).toBe('1h 30m');
      expect(formatHours(8, 'detailed')).toBe('8h');
      expect(formatHours(0.5, 'detailed')).toBe('30m');
    });

    it('debe manejar valores null/undefined', () => {
      expect(formatHours(null)).toBe('0h');
      expect(formatHours(undefined)).toBe('0h');
    });
  });

  describe('formatNumber', () => {
    it('debe formatear números con separadores de miles', () => {
      expect(formatNumber(1000)).toBe('1.000');
      expect(formatNumber(1234567)).toBe('1.234.567');
    });
  });

  describe('formatDate', () => {
    it('debe formatear fechas correctamente', () => {
      const date = new Date('2024-01-15');
      expect(formatDate(date)).toContain('15');
      expect(formatDate(date)).toContain('01');
      expect(formatDate(date)).toContain('2024');
    });

    it('debe manejar strings de fecha', () => {
      expect(formatDate('2024-01-15')).toBeTruthy();
    });
  });

  describe('truncate', () => {
    it('debe truncar textos largos', () => {
      const longText = 'a'.repeat(100);
      expect(truncate(longText, 50).length).toBeLessThanOrEqual(53); // 50 + '...'
    });

    it('no debe truncar textos cortos', () => {
      expect(truncate('Short text', 50)).toBe('Short text');
    });
  });

  describe('capitalize', () => {
    it('debe capitalizar la primera letra', () => {
      expect(capitalize('hello')).toBe('Hello');
      expect(capitalize('HELLO')).toBe('Hello');
    });
  });

  describe('formatFullName', () => {
    it('debe formatear nombres completos', () => {
      expect(formatFullName('john', 'doe')).toBe('John Doe');
      expect(formatFullName('JOHN', 'DOE')).toBe('John Doe');
    });

    it('debe manejar valores faltantes', () => {
      expect(formatFullName('john', null)).toBe('John');
      expect(formatFullName(null, 'doe')).toBe('Doe');
    });
  });
});

