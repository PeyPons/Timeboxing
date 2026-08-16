/**
 * Entrada de importes/tarifas positivos con coma o punto decimal (p. ej. objetivo €/h).
 * No admite signo negativo. Como máximo `maxDecimals` decimales.
 */

function normalizeSeparatorsForDecimal(input: string): string {
  const lastComma = input.lastIndexOf(',');
  const lastDot = input.lastIndexOf('.');
  if (lastComma < 0 && lastDot < 0) {
    return input.replace(/[^\d]/g, '');
  }
  if (lastComma < 0) {
    return input.replace(/[^\d.]/g, '');
  }
  if (lastDot < 0) {
    const cleaned = input.replace(/[^\d,]/g, '');
    const lc = cleaned.lastIndexOf(',');
    if (lc < 0) return cleaned.replace(/,/g, '');
    const intPart = cleaned.slice(0, lc).replace(/\D/g, '');
    const decPart = cleaned.slice(lc + 1).replace(/\D/g, '');
    return decPart.length > 0 ? `${intPart}.${decPart}` : `${intPart}.`;
  }
  if (lastComma > lastDot) {
    return input.replace(/\./g, '').replace(',', '.');
  }
  return input.replace(/,/g, '');
}

/**
 * Devuelve un texto seguro para un input controlado mientras el usuario escribe.
 */
export function sanitizePositiveDecimalInput(raw: string, maxDecimals = 2): string {
  const s = raw.trim().replace(/\s/g, '').replace(/[-−]/g, '');
  if (s === '') return '';

  const normalized = normalizeSeparatorsForDecimal(s);
  const firstDot = normalized.indexOf('.');
  let intPart: string;
  let fracRaw: string;
  if (firstDot === -1) {
    intPart = normalized.replace(/\D/g, '');
    fracRaw = '';
  } else {
    intPart = normalized.slice(0, firstDot).replace(/\D/g, '');
    fracRaw = normalized.slice(firstDot + 1).replace(/\D/g, '');
  }
  const frac = fracRaw.slice(0, maxDecimals);

  if (firstDot >= 0 && frac.length === 0 && fracRaw.length === 0) {
    if (intPart === '') return '0.';
    return `${intPart}.`;
  }
  if (intPart === '' && frac.length > 0) return `0.${frac}`;
  if (frac.length === 0) return intPart;
  return `${intPart}.${frac}`;
}

/**
 * Convierte el valor guardado a texto para el campo (hasta 2 decimales).
 */
export function numberToPositiveDecimalInputString(n: number, fallback: number): string {
  const base = Number.isFinite(n) && n > 0 ? n : fallback;
  const r = Math.round(base * 100) / 100;
  if (!Number.isFinite(r) || r <= 0) return String(fallback);
  return String(r);
}

/**
 * Interpreta el texto del campo: ≥ min, redondeo a 2 decimales.
 */
export function parsePositiveDecimalInput(
  raw: string,
  fallback: number,
  min: number
): number {
  const s = sanitizePositiveDecimalInput(raw, 2);
  if (s === '' || s === '.' || s === '0.') {
    return fallback;
  }
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n) || n < min) {
    return fallback;
  }
  return Math.round(n * 100) / 100;
}

/** Texto para KPIs (objetivo €/h con hasta 2 decimales). */
export function formatEhrTargetForDisplay(n: number): string {
  const r = Math.round(n * 100) / 100;
  if (!Number.isFinite(r) || r <= 0) return '—';
  if (Number.isInteger(r)) return String(r);
  return r.toFixed(2).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}
