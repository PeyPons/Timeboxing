/**
 * Utilidades de validación comunes
 */

/**
 * Valida un email
 */
export function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Valida un UUID
 */
export function isValidUUID(uuid: string | null | undefined): boolean {
  if (!uuid) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Valida un formato de mes (YYYY-MM)
 */
export function isValidMonthFormat(month: string | null | undefined): boolean {
  if (!month) return false;
  const monthRegex = /^\d{4}-\d{2}$/;
  if (!monthRegex.test(month)) return false;
  
  const [year, monthNum] = month.split('-').map(Number);
  return year >= 2000 && year <= 2100 && monthNum >= 1 && monthNum <= 12;
}

/**
 * Valida que un número esté en un rango
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Valida que un número sea positivo
 */
export function isPositive(value: number): boolean {
  return value > 0;
}

/**
 * Valida que un número sea no negativo
 */
export function isNonNegative(value: number): boolean {
  return value >= 0;
}

/**
 * Sanitiza un string eliminando caracteres peligrosos
 */
export function sanitizeString(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .trim()
    .replace(/[<>]/g, '') // Eliminar < y >
    .replace(/javascript:/gi, '') // Eliminar javascript:
    .replace(/on\w+=/gi, ''); // Eliminar event handlers
}

