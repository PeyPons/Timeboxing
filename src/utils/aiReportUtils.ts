import { GoogleGenerativeAI } from "@google/generative-ai";

// Definición de tipos
export interface CampaignData {
  campaign_name: string;
  status: string;
  cost: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

// Función principal que AHORA SÍ llama a la API
export const generateAdsSummary = async (
  accountName: string,
  campaigns: CampaignData[],
  totalSpend: any,
  totalConversions: any
): Promise<string> => { // Nota: Ahora devuelve una Promise<string>

  // 1. Obtener API Key (Igual que en DashboardAI)
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return "Error: No se ha configurado la API Key de Gemini en .env";
  }

  // 2. Sanitización de datos
  const safeSpend = Number(totalSpend) || 0;
  const safeConversions = Number(totalConversions) || 0;

  // 3. Formatear campañas para el contexto de la IA
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

  // 4. Construir el Prompt (Instrucciones + Datos)
  const prompt = `
    Actúa como un analista experto en Google Ads (PPC) Senior.
    Estás analizando la cuenta: "${accountName}".
    
    DATOS DEL PERIODO:
    - Inversión Total: ${safeSpend.toFixed(2)}€
    - Conversiones Totales: ${safeConversions}
    
    DESGLOSE DE CAMPAÑAS:
    ${campaignsSummary}
    
    TU TAREA:
    Genera un resumen ejecutivo breve (máximo 4 párrafos) con:
    1. Análisis de rendimiento general (¿Es rentable? ¿El CPA es lógico?).
    2. Identifica la campaña "Estrella" y la "Estrellada" (Peor rendimiento).
    3. Dame 3 optimizaciones tácticas urgentes (presupuestos, keywords, pausar campañas).
    
    IMPORTANTE:
    - Usa formato Markdown (negritas en métricas clave).
    - Sé directo y profesional. No saludes, ve al grano.
  `;

  // 5. LLAMADA A GEMINI (Esto es lo que faltaba)
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
    
  } catch (error) {
    console.error("Error llamando a Gemini:", error);
    return "Lo siento, hubo un error al conectar con la IA para generar el análisis. Verifica tu cuota o conexión.";
  }
};
