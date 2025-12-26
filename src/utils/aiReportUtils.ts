import { GoogleGenerativeAI } from "@google/generative-ai";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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
// LISTA DE MODELOS OPENROUTER (TODOS LOS GRATUITOS + FALLBACKS)
// ============================================================
const OPENROUTER_MODEL_CHAIN = [
  "google/gemini-2.0-flash-exp:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "deepseek/deepseek-r1-0528:free",
  "meta-llama/llama-3.1-405b-instruct:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "allenai/olmo-3.1-32b-think:free",
  "alibaba/tongyi-deepresearch-30b-a3b:free",
  "google/gemma-3-27b-it:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "qwen/qwen3-coder:free",
  "allenai/olmo-3-32b-think:free",
  "nex-agi/deepseek-v3.1-nex-n1:free",
  "kwaipilot/kat-coder-pro:free",
  "google/gemma-3-12b-it:free",
  "google/gemma-3-4b-it:free",
  "xiaomi/mimo-v2-flash:free",
  "mistralai/mistral-7b-instruct:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "qwen/qwen-2.5-vl-7b-instruct:free",
  "microsoft/phi-3-medium-128k-instruct:free",
  "cerebras/llama3.1-70b", 
  "openai/gpt-5-mini"      
];

// ============================================================
// SISTEMA DE PROVEEDORES DE IA CON FALLBACK
// ============================================================

/**
 * Llama a la API de Gemini
 */
async function callGeminiAPI(prompt: string, apiKey: string): Promise<{ text: string; provider: 'gemini'; modelName: string }> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = "gemini-2.0-flash";
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent(prompt);
  return { text: result.response.text(), provider: 'gemini', modelName: modelName };
}

/**
 * Llama a la API de OpenRouter con estrategia por lotes
 */
async function callOpenRouterAPI(prompt: string, apiKey: string): Promise<{ text: string; provider: 'openrouter'; modelName: string }> {
  const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
  const BATCH_SIZE = 3; 

  const chunkArray = (arr: string[], size: number) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };

  const modelBatches = chunkArray(OPENROUTER_MODEL_CHAIN, BATCH_SIZE);

  for (let i = 0; i < modelBatches.length; i++) {
    const currentBatch = modelBatches[i];
    console.log(`🟣 [OpenRouter] Probando lote ${i + 1}/${modelBatches.length}:`, currentBatch);

    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.origin,
          "X-Title": "Timeboxing App"
        },
        body: JSON.stringify({
          models: currentBatch,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Status ${response.status}: ${errorText}`);
      }

      const responseData = await response.json();
      const usedModel = responseData.model || "unknown-model";

      if (responseData?.choices?.[0]?.message?.content) {
        console.log(`✅ [OpenRouter] Éxito en lote ${i + 1}. Respondió: ${usedModel}`);
        return { 
          text: responseData.choices[0].message.content, 
          provider: 'openrouter', 
          modelName: usedModel 
        };
      }
      
      console.warn(`⚠️ Respuesta vacía en lote ${i+1}, probando siguiente...`);

    } catch (error: any) {
      console.warn(`⚠️ Fallo en lote ${i + 1} de OpenRouter: ${error.message}`);
    }
  }

  throw new Error("Todos los intentos y lotes de OpenRouter han fallado.");
}

/**
 * Llama a la API de Coco Solution
 */
async function callCocoAPI(prompt: string): Promise<{ text: string; provider: 'coco'; modelName: string }> {
  const COCO_API_URL = 'https://ws.cocosolution.com/api/ia/?noAuth=true&action=text/generateResume&app=CHATBOT&rol=user&method=POST&';
  const simplifiedPrompt = `Responde breve y claro en texto plano (sin markdown): ${prompt.substring(0, 1000)}`;
  const payload = { message: simplifiedPrompt, noAuth: "true", action: "text/generateResume", app: "CHATBOT", rol: "user", method: "POST", language: "es" };
  
  const response = await fetch(COCO_API_URL, {
    method: 'POST',
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Coco API error: ${response.status}`);
  }

  const responseData = await response.json();
  
  if (responseData && responseData.data) {
    let cleanText = responseData.data
      .replace(/```/g, '')                
      .replace(/<[^>]*>/g, '')             
      .replace(/^\s*[\*\-]\s*$/gm, '')     
      .replace(/\*\*/g, '')                
      .replace(/\*\s*\n/g, '\n')           
      .replace(/^\*\s*/gm, '- ')           
      .replace(/<br\s*\/?>/gi, '\n')       
      .replace(/\n{3,}/g, '\n\n')          
      .trim();
    
    if (cleanText.length < 5) throw new Error('Respuesta de Coco insuficiente');

    return { text: cleanText, provider: 'coco', modelName: 'Coco Custom' };
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
async function callAIWithFallback(prompt: string): Promise<{ text: string; provider: 'gemini' | 'openrouter' | 'coco'; modelName: string }> {
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
    }
  }

  // Intento 2: OpenRouter
  if (openRouterApiKey) {
    try {
      console.log('🟣 Intentando con OpenRouter (Estrategia por Lotes)...');
      const result = await callOpenRouterAPI(prompt, openRouterApiKey);
      return result;
    } catch (error: any) {
      console.warn('⚠️ OpenRouter falló completamente:', error.message);
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

/**
 * Limpia y formatea el texto de la IA para que sea profesional
 */
function cleanAIResponse(text: string): string {
  return text
    // Eliminar asteriscos de markdown que no se renderizan bien
    .replace(/\*\*/g, '')
    // Convertir listas con asteriscos a formato más limpio
    .replace(/^\*\s+/gm, '• ')
    .replace(/^-\s+/gm, '• ')
    // Limpiar múltiples espacios
    .replace(/  +/g, ' ')
    // Limpiar múltiples saltos de línea
    .replace(/\n{3,}/g, '\n\n')
    // Eliminar código markdown
    .replace(/```[\s\S]*?```/g, '')
    // Limpiar HTML
    .replace(/<[^>]*>/g, '')
    .trim();
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
      changeLogs.slice(0, 10).map((log, idx) => 
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

  // Llamar al sistema de IA con fallback
  try {
    const result = await callAIWithFallback(prompt);
    // Limpiar la respuesta para que sea profesional
    const cleanedText = cleanAIResponse(result.text);
    return { ...result, text: cleanedText };
  } catch (error: any) {
    console.error("Error al generar análisis:", error);
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
    const result = await callAIWithFallback(prompt);
    const cleanedText = cleanAIResponse(result.text);
    return { ...result, text: cleanedText };
  } catch (error: any) {
    console.error("Error al generar análisis de campaña:", error);
    return {
      text: "Error al generar el análisis de esta campaña.",
      provider: 'coco',
      modelName: 'Error'
    };
  }
};
