import { type CampaignData } from '../types';

export interface CampaignData {
  campaign_name: string;
  status: string;
  cost: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

export const generateAdsSummary = (
  accountName: string,
  campaigns: CampaignData[],
  totalSpend: number,
  totalConversions: number
): string => {

  // 1. Formatear el detalle de cada campaña para que la IA lo entienda
  // Si no hay campañas, ponemos un mensaje por defecto.
  const campaignsSummary = campaigns && campaigns.length > 0 
    ? campaigns.map(c => {
        // Evitar división por cero
        const ctr = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(2) : '0.00';
        const cpa = c.conversions > 0 ? (c.cost / c.conversions).toFixed(2) : '0.00';
        
        return `
    - Campaña: "${c.campaign_name}" (Estado: ${c.status})
      * Inversión: ${c.cost.toFixed(2)}€
      * Impresiones: ${c.impressions} | Clicks: ${c.clicks} | CTR: ${ctr}%
      * Conversiones: ${c.conversions} | CPA: ${cpa}€`;
      }).join('\n')
    : "    - No hay datos detallados de campañas disponibles para este periodo.";

  // 2. Construir el Prompt enriquecido
  const prompt = `
    Actúa como un analista experto en Google Ads (PPC) Senior.
    Estás analizando la cuenta: "${accountName}".
    
    RESUMEN GLOBAL DEL PERIODO:
    - Inversión Total: ${totalSpend.toFixed(2)}€
    - Conversiones Totales: ${totalConversions}
    
    DESGLOSE DETALLADO POR CAMPAÑA:
    ${campaignsSummary}
    
    INSTRUCCIONES DE ANÁLISIS:
    1. Análisis de Rendimiento: Identifica qué campaña es la "Ganadora" (mejor ROAS/CPA) y cuál es la "Perdedora" (gasto ineficiente).
    2. Diagnóstico: ¿Por qué la campaña perdedora está fallando? (¿Bajo CTR? ¿CPA alto?).
    3. Plan de Acción: Dame una lista numerada de 3 optimizaciones críticas que debería aplicar mañana mismo.
    4. Tono: Profesional, directivo y orientado a datos. Usa negritas para resaltar métricas clave.
  `;

  return prompt;
};

export const generateDetailedAIReport = (
  accountName: string,
  campaigns: CampaignData[],
  totalSpend: number,
  totalConversions: number
): string => {

  // 1. Formatear el detalle de cada campaña para el prompt
  const campaignsSummary = campaigns.map(c => {
    const ctr = ((c.clicks / c.impressions) * 100).toFixed(2);
    const cpa = c.conversions > 0 ? (c.cost / c.conversions).toFixed(2) : 'N/A';
    
    return `
    - Campaña: "${c.name}" (Estado: ${c.status})
      * Inversión: ${c.cost}€
      * Impresiones: ${c.impressions} | Clicks: ${c.clicks} | CTR: ${ctr}%
      * Conversiones: ${c.conversions} | CPA: ${cpa}€
    `;
  }).join('\n');

  // 2. Construir el Prompt enriquecido
  const prompt = `
    Actúa como un analista experto en Google Ads (PPC).
    Analiza la cuenta: "${accountName}".
    
    Datos Globales:
    - Inversión Total: ${totalSpend}€
    - Conversiones Totales: ${totalConversions}
    
    Desglose por Campaña:
    ${campaignsSummary}
    
    Instrucciones:
    1. Identifica qué campaña tiene el mejor rendimiento (ROAS/CPA).
    2. Identifica qué campaña está desperdiciando presupuesto (alto coste, bajas conversiones).
    3. Dame 3 acciones concretas para optimizar la cuenta basándote en estos datos.
    4. Usa un tono profesional pero directo.
  `;

  return prompt;
};
