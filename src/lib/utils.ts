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
 * Limpia los nombres largos de Kit Digital para visualización
 * De: (KD) [2000€] Proyecto SEO avanzado - [Cliente]
 * A:  KD: Cliente
 */
export function formatProjectName(name: string): string {
  if (!name) return '';
  
  // Si detectamos el patrón de Kit Digital
  if (name.includes('(KD)') || name.includes('[KD]')) {
    // Dividimos por el guión, asumiendo que el cliente está al final
    // Ejemplo: Split separa en ["(KD)...avanzado", " [Furgomera]"]
    const parts = name.split('-');
    
    if (parts.length > 1) {
       // Cogemos la última parte (el cliente)
       const lastPart = parts[parts.length - 1].trim();
       
       // Limpiamos los corchetes [ ] si los tiene
       const clientName = lastPart.replace(/^\[|\]$/g, '');
       
       // Devolvemos versión corta y reconocible
       return `KD: ${clientName}`;
    }
  }
  
  // Si no es KD, devolvemos el nombre original
  return name;
}
