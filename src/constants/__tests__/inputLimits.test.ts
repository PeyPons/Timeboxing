import { describe, it, expect } from 'vitest';
import { INPUT_LIMITS as FRONTEND_INPUT_LIMITS } from '@/constants/inputLimits';
import {
  INPUT_LIMITS as EDGE_INPUT_LIMITS,
  parseBoundedString,
  parseOptionalBoundedString,
  parseEmail,
  parsePassword,
} from '../../../supabase/functions/_shared/input-limits';

describe('INPUT_LIMITS (frontend vs Edge Functions)', () => {
  it('debe coincidir exactamente entre src/constants/inputLimits y supabase/functions/_shared/input-limits', () => {
    expect(FRONTEND_INPUT_LIMITS).toEqual(EDGE_INPUT_LIMITS);
  });
});

describe('parseBoundedString (Edge shared)', () => {
  it('acepta string recortado dentro del rango', () => {
    expect(parseBoundedString('  hola  ', { max: 10, fieldName: 'Nombre' })).toBe('hola');
  });

  it('rechaza no-string', () => {
    expect(() => parseBoundedString(123, { max: 10, fieldName: 'Campo' })).toThrow('Campo inválido.');
  });

  it('rechaza vacío por defecto (min 1)', () => {
    expect(() => parseBoundedString('   ', { max: 10, fieldName: 'Nombre' })).toThrow('Nombre es obligatorio.');
  });

  it('respeta min personalizado', () => {
    expect(() => parseBoundedString('ab', { min: 3, max: 10, fieldName: 'Código' })).toThrow(
      'Código es obligatorio.',
    );
  });

  it('rechaza por exceso de longitud', () => {
    expect(() => parseBoundedString('abcdef', { max: 3, fieldName: 'Texto' })).toThrow(
      'Texto supera el máximo de 3 caracteres.',
    );
  });
});

describe('parseOptionalBoundedString (Edge shared)', () => {
  it('devuelve cadena vacía para null, undefined o string vacío', () => {
    expect(parseOptionalBoundedString(null, { max: 5, fieldName: 'Nota' })).toBe('');
    expect(parseOptionalBoundedString(undefined, { max: 5, fieldName: 'Nota' })).toBe('');
    expect(parseOptionalBoundedString('', { max: 5, fieldName: 'Nota' })).toBe('');
  });

  it('recorta y valida longitud', () => {
    expect(parseOptionalBoundedString('  ok  ', { max: 10, fieldName: 'Nota' })).toBe('ok');
    expect(() => parseOptionalBoundedString('toolong', { max: 3, fieldName: 'Nota' })).toThrow(
      'Nota supera el máximo de 3 caracteres.',
    );
  });

  it('rechaza tipos no string cuando hay valor', () => {
    expect(() => parseOptionalBoundedString(1, { max: 5, fieldName: 'Extra' })).toThrow('Extra inválido.');
  });
});

describe('parseEmail (Edge shared)', () => {
  it('normaliza a minúsculas y valida formato básico', () => {
    expect(parseEmail('  User@EXAMPLE.com  ')).toBe('user@example.com');
  });

  it('rechaza email sin formato esperado', () => {
    expect(() => parseEmail('sin-arroba')).toThrow('Email inválido.');
  });

  it('rechaza longitud por encima del límite de INPUT_LIMITS.email', () => {
    // Cadena válida para el regex pero más larga que el máximo permitido (254).
    const local = 'a'.repeat(EDGE_INPUT_LIMITS.email - 4);
    const domain = '@x.co';
    const tooLong = `${local}${domain}`;
    expect(tooLong.length).toBeGreaterThan(EDGE_INPUT_LIMITS.email);
    expect(() => parseEmail(tooLong)).toThrow(
      `Email supera el máximo de ${EDGE_INPUT_LIMITS.email} caracteres.`,
    );
  });
});

describe('parsePassword (Edge shared)', () => {
  it('acepta contraseña con longitud mínima y máxima', () => {
    expect(parsePassword('12345678')).toBe('12345678');
    const maxPwd = 'x'.repeat(EDGE_INPUT_LIMITS.password);
    expect(parsePassword(maxPwd)).toBe(maxPwd);
  });

  it('rechaza corta, no string o demasiado larga', () => {
    expect(() => parsePassword('1234567')).toThrow('La contraseña debe tener al menos 8 caracteres.');
    expect(() => parsePassword(null)).toThrow('La contraseña es obligatoria.');
    const tooLong = 'x'.repeat(EDGE_INPUT_LIMITS.password + 1);
    expect(() => parsePassword(tooLong)).toThrow(
      `La contraseña supera el máximo de ${EDGE_INPUT_LIMITS.password} caracteres.`,
    );
  });
});
