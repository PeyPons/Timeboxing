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
  totalSpend: any,       // Cambiado a 'any' para aceptar strings de la DB
  totalConversions: any  // Cambiado a 'any'
): string => {

  // 1. Sanitización de datos (Conversión segura a números)
  const safeSpend = Number(totalSpend) || 0;
  const safeConversions = Number(totalConversions) || 0;

  // 2. Formatear campañas
  const campaignsSummary = campaigns && campaigns.length > 0 
    ? campaigns.map(c => {
        const cCost = Number(c.cost) || 0;
        const cClicks = Number(c.clicks) || 0;
        const cImpr = Number(c.impressions) || 0;
        const cConv = Number(c.conversions) || 0;

        const ctr = cImpr > 0 ? ((cClicks / cImpr) * 100).toFixed(2) : '0.00';
        const cpa = cConv > 0 ? (cCost / cConv).toFixed(2) : '0.00';
        
        return `
    - Campaña: "${c.campaign_name}" (Estado: ${c.status})
      * Inversión: ${cCost.toFixed(2)}€
      * Impresiones: ${cImpr} | Clicks: ${cClicks} | CTR: ${ctr}%
      * Conversiones: ${cConv} | CPA: ${cpa}€`;
      }).join('\n')
    : "    - No hay datos detallados de campañas disponibles.";

  // 3. Construir el Prompt
  const prompt = `
    Actúa como un analista experto en Google Ads. Cuenta: "${accountName}".
    
    RESUMEN:
    - Inversión Total: ${safeSpend.toFixed(2)}€
    - Conversiones: ${safeConversions}
    
    DETALLE CAMPAÑAS:
    ${campaignsSummary}
    
    INSTRUCCIONES:
    1. Identifica la mejor y peor campaña.
    2. Diagnostica por qué fallan o funcionan.
    3. Dame 3 acciones concretas de optimización.
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
