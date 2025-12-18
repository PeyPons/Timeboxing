import { type CampaignData } from '../types'; // Asegúrate de importar tus tipos

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
