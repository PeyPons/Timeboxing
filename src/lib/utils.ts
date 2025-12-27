import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- NUEVA FUNCIÓN NECESARIA PARA LA PÁGINA DE ADS ---
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

/**
 * Detecta si un proyecto es Kit Digital basándose en patrones comunes
 * Detecta: (KD), [KD], KD , KD:, kit digital, kitdigital
 */
export function isKitDigitalProject(projectName: string): boolean {
  if (!projectName) return false;
  
  const nameLower = projectName.toLowerCase();
  const nameUpper = projectName.toUpperCase();
  
  // Patrones de detección (denominador común: contiene KD o kit digital)
  return (
    nameLower.includes('kit digital') ||
    nameLower.includes('kitdigital') ||
    nameUpper.includes('(KD)') ||
    nameUpper.includes('[KD]') ||
    /KD\s/.test(projectName) ||  // KD seguido de espacio
    /KD:/.test(projectName) ||   // KD seguido de dos puntos
    /^KD\s/.test(projectName)     // Empieza con KD seguido de espacio
  );
}

/**
 * Limpia los nombres largos de Kit Digital para visualización
 * Detecta múltiples variantes: (KD), [KD], KD , KD:, etc.
 * De: (KD) [2000€] Proyecto SEO avanzado - [Cliente]
 * De: KD (2000€) Posicionamiento SEO Avanzad
 * De: KD: Wavefulness
 * A:  KD: Cliente (si se puede extraer) o KD: [nombre simplificado]
 */
export function formatProjectName(name: string): string {
  if (!name) return '';
  
  // Si detectamos que es Kit Digital
  if (isKitDigitalProject(name)) {
    // Intentar extraer el cliente del patrón con guión
    // Ejemplo: "(KD) [2000€] Proyecto SEO avanzado - [Furgomera]"
    if (name.includes('-')) {
      const parts = name.split('-');
      if (parts.length > 1) {
        const lastPart = parts[parts.length - 1].trim();
        // Limpiamos los corchetes [ ] si los tiene
        const clientName = lastPart.replace(/^\[|\]$/g, '').trim();
        if (clientName) {
          return `KD: ${clientName}`;
        }
      }
    }
    
    // Si tiene el patrón "KD: Cliente" ya está formateado
    if (/^KD:\s/.test(name)) {
      return name;
    }
    
    // Si empieza con "KD " seguido de algo, intentar extraer nombre
    const kdMatch = name.match(/^KD\s+(.+)/i);
    if (kdMatch && kdMatch[1]) {
      // Limpiar paréntesis, corchetes y números al inicio
      const cleaned = kdMatch[1]
        .replace(/^\([^)]*\)\s*/, '')  // Eliminar (2000€)
        .replace(/^\[[^\]]*\]\s*/, '')  // Eliminar [2000€]
        .trim();
      if (cleaned) {
        return `KD: ${cleaned}`;
      }
    }
    
    // Si tiene (KD) o [KD], intentar extraer el resto
    const kdPatternMatch = name.match(/[\[\(]KD[\]\)]\s*(.+)/i);
    if (kdPatternMatch && kdPatternMatch[1]) {
      const cleaned = kdPatternMatch[1]
        .replace(/^\[[^\]]*\]\s*/, '')
        .replace(/^\([^)]*\)\s*/, '')
        .trim();
      if (cleaned) {
        // Si tiene guión, tomar la última parte
        if (cleaned.includes('-')) {
          const parts = cleaned.split('-');
          const lastPart = parts[parts.length - 1].trim().replace(/^\[|\]$/g, '');
          return `KD: ${lastPart}`;
        }
        return `KD: ${cleaned}`;
      }
    }
    
    // Si no se puede extraer, devolver versión simplificada
    return `KD: ${name.replace(/[\[\(]KD[\]\)]/gi, '').trim()}`;
  }
  
  // Si no es KD, devolvemos el nombre original
  return name;
}
