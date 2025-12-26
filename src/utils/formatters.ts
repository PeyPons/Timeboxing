/**
 * Utilidades de formateo para el proyecto
 */

/**
 * Formatea un número como moneda en euros
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0,00 €';
  }
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formatea un número como porcentaje
 */
export function formatPercentage(value: number | null | undefined, decimals: number = 1): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0%';
  }
  return `${value.toFixed(decimals)}%`;
}

/**
 * Formatea horas (ej: 1.5 -> "1h 30m" o "1,5h")
 */
export function formatHours(hours: number | null | undefined, format: 'decimal' | 'detailed' = 'decimal'): string {
  if (hours === null || hours === undefined || isNaN(hours)) {
    return '0h';
  }

  if (format === 'detailed') {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    
    if (minutes === 0) {
      return `${wholeHours}h`;
    }
    if (wholeHours === 0) {
      return `${minutes}m`;
    }
    return `${wholeHours}h ${minutes}m`;
  }

  // Formato decimal con coma
  return `${hours.toFixed(1).replace('.', ',')}h`;
}

/**
 * Formatea un número grande con separadores de miles
 */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }
  return new Intl.NumberFormat('es-ES').format(value);
}

/**
 * Formatea una fecha en formato español
 */
export function formatDate(date: Date | string | null | undefined, format: 'short' | 'long' | 'time' = 'short'): string {
  if (!date) return '';

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) return '';

  const options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: format === 'long' ? 'long' : '2-digit',
    year: 'numeric',
  };

  if (format === 'time') {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }

  return new Intl.DateTimeFormat('es-ES', options).format(dateObj);
}

/**
 * Trunca un texto a una longitud máxima
 */
export function truncate(text: string | null | undefined, maxLength: number = 50, suffix: string = '...'): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Capitaliza la primera letra de un texto
 */
export function capitalize(text: string | null | undefined): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Formatea un nombre completo (capitaliza cada palabra)
 */
export function formatFullName(firstName?: string | null, lastName?: string | null): string {
  const parts = [firstName, lastName].filter(Boolean) as string[];
  return parts.map(capitalize).join(' ') || '';
}

