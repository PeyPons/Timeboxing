import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  isValidUUID,
  isValidMonthFormat,
  isInRange,
  isPositive,
  isNonNegative,
  sanitizeString,
} from '../validators';

describe('validators', () => {
  describe('isValidEmail', () => {
    it('debe validar emails correctos', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
    });

    it('debe rechazar emails inválidos', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
    });

    it('debe manejar valores null/undefined', () => {
      expect(isValidEmail(null)).toBe(false);
      expect(isValidEmail(undefined)).toBe(false);
    });
  });

  describe('isValidUUID', () => {
    it('debe validar UUIDs correctos', () => {
      const validUUID = '550e8400-e29b-41d4-a716-446655440000';
      expect(isValidUUID(validUUID)).toBe(true);
    });

    it('debe rechazar UUIDs inválidos', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('123')).toBe(false);
    });
  });

  describe('isValidMonthFormat', () => {
    it('debe validar formatos de mes correctos', () => {
      expect(isValidMonthFormat('2024-01')).toBe(true);
      expect(isValidMonthFormat('2024-12')).toBe(true);
    });

    it('debe rechazar formatos inválidos', () => {
      expect(isValidMonthFormat('2024-13')).toBe(false);
      expect(isValidMonthFormat('24-01')).toBe(false);
      expect(isValidMonthFormat('2024/01')).toBe(false);
    });
  });

  describe('isInRange', () => {
    it('debe validar números en rango', () => {
      expect(isInRange(5, 1, 10)).toBe(true);
      expect(isInRange(1, 1, 10)).toBe(true);
      expect(isInRange(10, 1, 10)).toBe(true);
    });

    it('debe rechazar números fuera de rango', () => {
      expect(isInRange(0, 1, 10)).toBe(false);
      expect(isInRange(11, 1, 10)).toBe(false);
    });
  });

  describe('isPositive', () => {
    it('debe validar números positivos', () => {
      expect(isPositive(1)).toBe(true);
      expect(isPositive(100)).toBe(true);
    });

    it('debe rechazar números no positivos', () => {
      expect(isPositive(0)).toBe(false);
      expect(isPositive(-1)).toBe(false);
    });
  });

  describe('isNonNegative', () => {
    it('debe validar números no negativos', () => {
      expect(isNonNegative(0)).toBe(true);
      expect(isNonNegative(1)).toBe(true);
    });

    it('debe rechazar números negativos', () => {
      expect(isNonNegative(-1)).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('debe eliminar caracteres peligrosos', () => {
      expect(sanitizeString('<script>alert("xss")</script>')).not.toContain('<script>');
      expect(sanitizeString('javascript:alert("xss")')).not.toContain('javascript:');
    });

    it('debe mantener texto normal', () => {
      expect(sanitizeString('Hello World')).toBe('Hello World');
    });

    it('debe manejar valores null/undefined', () => {
      expect(sanitizeString(null)).toBe('');
      expect(sanitizeString(undefined)).toBe('');
    });
  });
});

