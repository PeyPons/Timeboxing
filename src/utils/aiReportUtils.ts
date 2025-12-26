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

// ============================================================
// SISTEMA DE PROVEEDORES DE IA CON FALLBACK
// ============================================================

/**
 * Llama a la API de Gemini
 */
async function callGeminiAPI(prompt: string, apiKey: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

/**
 * Llama a la API de OpenRouter
 */
async function callOpenRouterAPI(prompt: string, apiKey: string): Promise<string> {
  const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
  
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.origin, // Opcional pero recomendado
      "X-Title": "Timeboxing App" // Opcional pero recomendado
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-exp:free", // Modelo gratuito de Gemini a través de OpenRouter
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenRouter API error: ${response.status} - ${JSON.stringify(errorData)}`);
  }

  const responseData = await response.json();
  
  if (responseData?.choices?.[0]?.message?.content) {
    return responseData.choices[0].message.content;
  } else {
    throw new Error('Respuesta inesperada de OpenRouter API');
  }
}

/**
 * Llama a la API de Coco Solution
 */
async function callCocoAPI(prompt: string): Promise<string> {
  const COCO_API_URL = 'https://ws.cocosolution.com/api/ia/?noAuth=true&action=text/generateResume&app=CHATBOT&rol=user&method=POST&';
  
  const payload = {
    message: prompt,
    noAuth: "true",
    action: "text/generateResume",
    app: "CHATBOT",
    rol: "user",
    method: "POST",
    language: "es",
  };

  const response = await fetch(COCO_API_URL, {
    method: 'POST',
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Coco API error: ${response.status}`);
  }

  const responseData = await response.json();
  
  if (responseData?.data) {
    return responseData.data;
  } else {
    throw new Error('Respuesta inesperada de Coco API');
  }
}

/**
 * Sistema de IA con fallback en cascada:
 * 1. Gemini (si tiene API key)
 * 2. OpenRouter (si tiene API key)
 * 3. Coco Solution (fallback final)
 */
async function callAIWithFallback(prompt: string): Promise<string> {
  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const openRouterApiKey = import.meta.env.VITE_OPENROUTER_API_KEY;

  // Intento 1: Gemini
  if (geminiApiKey) {
    try {
      console.log('🔵 Intentando con Gemini...');
      const result = await callGeminiAPI(prompt, geminiApiKey);
      console.log('✅ Gemini respondió correctamente');
      return result;
    } catch (error: any) {
      console.warn('⚠️ Gemini falló:', error.message);
      // Continuar con el siguiente proveedor
    }
  }

  // Intento 2: OpenRouter
  if (openRouterApiKey) {
    try {
      console.log('🟣 Intentando con OpenRouter...');
      const result = await callOpenRouterAPI(prompt, openRouterApiKey);
      console.log('✅ OpenRouter respondió correctamente');
      return result;
    } catch (error: any) {
      console.warn('⚠️ OpenRouter falló:', error.message);
      // Continuar con el siguiente proveedor
    }
  }

  // Intento 3: Coco Solution (fallback final)
  try {
    console.log('🥥 Intentando con Coco Solution (fallback)...');
    const result = await callCocoAPI(prompt);
    console.log('✅ Coco Solution respondió correctamente');
    return result;
  } catch (error: any) {
    console.error('❌ Todos los proveedores fallaron');
    throw new Error('No se pudo generar el análisis. Todos los proveedores de IA fallaron.');
  }
}

// ============================================================
// FUNCIÓN PRINCIPAL DE GENERACIÓN DE RESUMEN
// ============================================================

/**
 * Genera un resumen de campañas de Google Ads utilizando IA
 * con sistema de fallback automático entre proveedores
 */
export const generateAdsSummary = async (
  accountName: string,
  campaigns: CampaignData[],
  totalSpend: any,
  totalConversions: any
): Promise<string> => {
  
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

        const ctr = cImpr > 0 ? ((cClicks / cImpr) * 100).toFixed(2) : '0.00';
        const cpa = cConv > 0 ? (cCost / cConv).toFixed(2) : '0.00';
        
        return `
    - Campaña: "${c.campaign_name}" (Estado: ${c.status})
      * Inversión: ${cCost.toFixed(2)}€
      * Impresiones: ${cImpr} | Clicks: ${cClicks} | CTR: ${ctr}%
      * Conversiones: ${cConv} | CPA: ${cpa}€`;
      }).join('\n')
    : "    - No hay datos detallados de campañas disponibles.";

  // Construir el Prompt
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

  // Llamar al sistema de IA con fallback
  try {
    return await callAIWithFallback(prompt);
  } catch (error: any) {
    console.error("Error al generar análisis:", error);
    return "Lo siento, hubo un error al conectar con los servicios de IA para generar el análisis. Por favor, verifica tu conexión o intenta más tarde.";
  }
};
