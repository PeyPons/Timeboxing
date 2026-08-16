import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ProjectAliasingRule, type AgencySettings } from "@/types";
import { formatMoneyAmount, resolveAgencyCurrency } from '@/utils/currencyUtils';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** @deprecated Prefer `useFormatMoney()` en componentes React. */
export function formatCurrency(
  amount: number,
  settings?: AgencySettings | null,
  locale = 'es-ES',
): string {
  return formatMoneyAmount(amount, resolveAgencyCurrency(settings), locale);
}

// Default Kit Digital rule for backward compatibility
const DEFAULT_KIT_DIGITAL_RULE: ProjectAliasingRule = {
  id: 'kit-digital-default',
  name: 'kit-digital',
  displayPrefix: 'KD:',
  enabled: true,
  matchPatterns: ['(KD)', '[KD]', 'KD ', 'KD:', 'kit digital', 'kitdigital'],
  groupAsVirtualClient: true,
  virtualClientName: 'Kit Digital',
  virtualClientColor: '#8B5CF6'
};

/**
 * Verifica si un proyecto coincide con alguna regla de aliasing
 * @param projectName Nombre del proyecto
 * @param rules Reglas de aliasing de la agencia
 * @returns La regla que coincide o null
 */
export function matchesAliasingRule(
  projectName: string,
  rules: ProjectAliasingRule[] = [DEFAULT_KIT_DIGITAL_RULE]
): ProjectAliasingRule | null {
  if (!projectName) return null;

  const nameLower = projectName.toLowerCase();
  const nameUpper = projectName.toUpperCase();

  for (const rule of rules) {
    if (!rule.enabled) continue;

    for (const pattern of rule.matchPatterns) {
      const patternLower = pattern.toLowerCase();
      const patternUpper = pattern.toUpperCase();

      // Check various matching strategies
      if (
        nameLower.includes(patternLower) ||
        nameUpper.includes(patternUpper) ||
        new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(projectName)
      ) {
        return rule;
      }
    }
  }

  return null;
}

/**
 * Detecta si un proyecto es Kit Digital basándose en patrones comunes
 * @deprecated Usar matchesAliasingRule con reglas configurables
 */
export function isKitDigitalProject(projectName: string): boolean {
  return matchesAliasingRule(projectName, [DEFAULT_KIT_DIGITAL_RULE]) !== null;
}

/**
 * Formatea el nombre del proyecto según las reglas de aliasing
 * @param name Nombre original del proyecto
 * @param rules Reglas de aliasing de la agencia (opcional, usa default Kit Digital)
 * @returns Nombre formateado
 */
export function formatProjectName(
  name: string,
  rules: ProjectAliasingRule[] = []
): string {
  if (!name) return '';

  const matchedRule = matchesAliasingRule(name, rules);

  if (!matchedRule) {
    // No matching rule, return original name
    return name;
  }

  const prefix = matchedRule.displayPrefix;

  // If already formatted with this prefix, return as-is
  if (name.startsWith(prefix)) {
    return name;
  }

  // Try to extract client name from patterns like "- [ClientName]"
  if (name.includes('-')) {
    const parts = name.split('-');
    if (parts.length > 1) {
      const lastPart = parts[parts.length - 1].trim();
      const clientName = lastPart.replace(/^[[({]|[\])}]$/g, '').trim();
      if (clientName) {
        return `${prefix} ${clientName}`;
      }
    }
  }

  // Remove the pattern markers and clean up the name
  let cleanedName = name;
  for (const pattern of matchedRule.matchPatterns) {
    const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    cleanedName = cleanedName.replace(regex, '');
  }

  // Remove common extra patterns like [2000€], (2000€)
  cleanedName = cleanedName
    .replace(/\[[^\]]*€[^\]]*\]/g, '')
    .replace(/\([^)]*€[^)]*\)/g, '')
    .trim();

  if (cleanedName) {
    return `${prefix} ${cleanedName}`;
  }

  // Fallback: use original name without patterns
  return `${prefix} ${name.replace(/[[\]()]/g, '').trim()}`;
}

