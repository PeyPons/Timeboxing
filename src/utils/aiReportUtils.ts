import { format } from 'date-fns';
import { AIService } from '@/services/aiService';
import { ErrorService } from '@/services/errorService';
import { logger } from '@/utils/logger';
import { CONSTANTS } from '@/config/constants';

// Definición de tipos
export interface CampaignData {
  campaign_name: string;
  status: string;
  cost: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversions_value?: number;
  cpa?: number;
  roas?: number;
}

export interface ChangeLog {
  change_date: string;
  user_email: string;
  change_type: string;
  campaign_name: string;
  resource_name: string;
  details: string;
}

export interface HistoricalData {
  month: string;
  cost: number;
  conversions: number;
  conversions_value: number;
  cpa: number;
  roas: number;
}

// ============================================================
// FUNCIÓN PRINCIPAL DE GENERACIÓN DE RESUMEN
// ============================================================

/**
 * Genera un resumen ejecutivo de campañas de Google Ads utilizando IA
 * con sistema de fallback automático entre proveedores
 */
export const generateAdsSummary = async (
  accountName: string,
  campaigns: CampaignData[],
  totalSpend: number,
  totalConversions: number,
  historicalData?: HistoricalData[],
  changeLogs?: ChangeLog[]
): Promise<{ text: string; provider: 'gemini' | 'openrouter' | 'coco'; modelName: string }> => {
  
  // Sanitización de datos
  const safeSpend = Number(totalSpend) || 0;
  const safeConversions = Number(totalConversions) || 0;

  // Formatear campañas para el contexto de la IA
  const campaignsSummary = campaigns && campaigns.length > 0 
    ? campaigns.map(c => {
        const cCost = Number(c.cost) || 0;
        const cClicks = Number(c.clicks) || 0;
        const cImpr = Number(c.impressions) || 0;
        const cConv = Number(c.conversions) || 0;
        const cValue = Number(c.conversions_value) || 0;
        const cpa = cConv > 0 ? (cCost / cConv).toFixed(2) : 'N/A';
        const roas = cCost > 0 ? (cValue / cCost).toFixed(2) : 'N/A';
        const ctr = cImpr > 0 ? ((cClicks / cImpr) * 100).toFixed(2) : '0.00';

        return `Campaña: "${c.campaign_name}" (${c.status})
  - Inversión: ${cCost.toFixed(2)}€
  - Impresiones: ${cImpr.toLocaleString()} | Clics: ${cClicks.toLocaleString()} | CTR: ${ctr}%
  - Conversiones: ${cConv} | CPA: ${cpa}€ | ROAS: ${roas}x
  - Ingresos generados: ${cValue.toFixed(2)}€`;
      }).join('\n\n')
    : "No hay datos detallados de campañas disponibles.";

  // Formatear datos históricos si existen
  const historicalSummary = historicalData && historicalData.length > 0
    ? `\n\nTENDENCIAS HISTÓRICAS (últimos ${historicalData.length} meses):\n` +
      historicalData.map(h => 
        `  - ${h.month}: Inversión ${h.cost.toFixed(2)}€ | Conversiones ${h.conversions} | CPA ${h.cpa.toFixed(2)}€ | ROAS ${h.roas.toFixed(2)}x`
      ).join('\n')
    : '';

  // Formatear logs de cambios si existen
  const changesSummary = changeLogs && changeLogs.length > 0
    ? `\n\nACCIONES REALIZADAS DURANTE EL MES (${changeLogs.length} cambios):\n` +
      changeLogs.slice(0, CONSTANTS.LIMITS.MAX_CHANGE_LOGS).map((log, idx) => 
        `  ${idx + 1}. ${format(new Date(log.change_date), 'dd/MM/yyyy')} - ${log.change_type}: ${log.campaign_name || log.resource_name}${log.details ? ` (${log.details})` : ''}`
      ).join('\n')
    : '';

  // Construir el Prompt mejorado
  const prompt = `Eres un analista experto en Google Ads (PPC) Senior. Estás generando un informe ejecutivo profesional para un cliente.

CUENTA: "${accountName}"

DATOS DEL PERIODO ACTUAL:
- Inversión Total: ${safeSpend.toFixed(2)}€
- Conversiones Totales: ${safeConversions}
- CPA Promedio: ${safeConversions > 0 ? (safeSpend / safeConversions).toFixed(2) : 'N/A'}€

DESGLOSE DE CAMPAÑAS:
${campaignsSummary}${historicalSummary}${changesSummary}

INSTRUCCIONES PARA EL INFORME:
1. Genera un resumen ejecutivo profesional (3-4 párrafos máximo)
2. Analiza el rendimiento general: ¿Es rentable? ¿El CPA es aceptable?
3. Identifica la campaña con mejor rendimiento y la que necesita optimización
4. Proporciona 3-4 recomendaciones tácticas específicas y accionables
5. Si hay datos históricos, menciona tendencias y evolución
6. Si hay logs de cambios, menciona las acciones más relevantes realizadas

FORMATO REQUERIDO:
- Usa texto plano profesional, sin markdown ni asteriscos
- Usa viñetas (•) para listas
- Sé directo, conciso y profesional
- No uses saludos ni despedidas
- Enfócate en insights accionables
- Usa números y métricas específicas
- El informe va directamente al cliente, debe ser profesional y claro

IMPORTANTE: El texto debe estar listo para imprimir en un PDF profesional. No uses formato markdown, asteriscos, ni código.`;

  // Llamar al sistema de IA con fallback usando el servicio centralizado
  try {
    const result = await AIService.callWithFallback(prompt, 'AdsReport');
    // Limpiar la respuesta para que sea profesional
    const cleanedText = AIService.cleanAIResponse(result.text);
    return { ...result, text: cleanedText };
  } catch (error: any) {
    ErrorService.handle(error, 'generateAdsSummary', {
      userMessage: 'Lo siento, hubo un error al conectar con los servicios de IA para generar el análisis. Por favor, verifica tu conexión o intenta más tarde.'
    });
    return {
      text: "Lo siento, hubo un error al conectar con los servicios de IA para generar el análisis. Por favor, verifica tu conexión o intenta más tarde.",
      provider: 'coco',
      modelName: 'Error'
    };
  }
};

/**
 * Genera un análisis detallado por campaña individual
 */
export const generateCampaignAnalysis = async (
  campaign: CampaignData,
  historicalData?: HistoricalData[]
): Promise<{ text: string; provider: 'gemini' | 'openrouter' | 'coco'; modelName: string }> => {
  const cCost = Number(campaign.cost) || 0;
  const cClicks = Number(campaign.clicks) || 0;
  const cImpr = Number(campaign.impressions) || 0;
  const cConv = Number(campaign.conversions) || 0;
  const cValue = Number(campaign.conversions_value) || 0;
  const cpa = cConv > 0 ? (cCost / cConv).toFixed(2) : 'N/A';
  const roas = cCost > 0 ? (cValue / cCost).toFixed(2) : 'N/A';
  const ctr = cImpr > 0 ? ((cClicks / cImpr) * 100).toFixed(2) : '0.00';

  const prompt = `Eres un analista experto en Google Ads. Analiza esta campaña específica:

CAMPAÑA: "${campaign.campaign_name}"
Estado: ${campaign.status}

MÉTRICAS:
- Inversión: ${cCost.toFixed(2)}€
- Impresiones: ${cImpr.toLocaleString()}
- Clics: ${cClicks.toLocaleString()}
- CTR: ${ctr}%
- Conversiones: ${cConv}
- CPA: ${cpa}€
- ROAS: ${roas}x
- Ingresos: ${cValue.toFixed(2)}€

${historicalData && historicalData.length > 0 ? `\nTENDENCIAS HISTÓRICAS:\n${historicalData.map(h => `  - ${h.month}: ${h.cost.toFixed(2)}€, ${h.conversions} conv., CPA ${h.cpa.toFixed(2)}€`).join('\n')}` : ''}

Genera un análisis breve (2-3 párrafos) con:
1. Evaluación del rendimiento actual
2. Fortalezas y debilidades identificadas
3. 2-3 recomendaciones específicas de optimización

FORMATO: Texto plano profesional, sin markdown ni asteriscos. Usa viñetas (•) para listas.`;

  try {
    const result = await AIService.callWithFallback(prompt, 'CampaignAnalysis');
    const cleanedText = AIService.cleanAIResponse(result.text);
    return { ...result, text: cleanedText };
  } catch (error: any) {
    ErrorService.handle(error, 'generateCampaignAnalysis');
    return {
      text: "Error al generar el análisis de esta campaña.",
      provider: 'coco',
      modelName: 'Error'
    };
  }
};
