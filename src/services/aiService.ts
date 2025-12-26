import { GoogleGenerativeAI } from "@google/generative-ai";

// ============================================================
// TIPOS
// ============================================================

export interface AIResponse {
  text: string;
  provider: 'gemini' | 'openrouter' | 'coco';
  modelName: string;
}

// ============================================================
// CONSTANTES
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

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const COCO_API_URL = 'https://ws.cocosolution.com/api/ia/?noAuth=true&action=text/generateResume&app=CHATBOT&rol=user&method=POST&';
const BATCH_SIZE = 3;

// ============================================================
// FUNCIONES PRIVADAS
// ============================================================

/**
 * Llama a la API de Gemini
 */
async function callGeminiAPI(prompt: string, apiKey: string): Promise<AIResponse> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = "gemini-2.0-flash";
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent(prompt);
  return { 
    text: result.response.text(), 
    provider: 'gemini', 
    modelName: modelName 
  };
}

/**
 * Llama a la API de OpenRouter con estrategia por lotes
 */
async function callOpenRouterAPI(prompt: string, apiKey: string): Promise<AIResponse> {
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
        return { 
          text: responseData.choices[0].message.content, 
          provider: 'openrouter', 
          modelName: usedModel 
        };
      }

    } catch (error: any) {
      // Continuar con el siguiente lote
      if (i === modelBatches.length - 1) {
        throw new Error("Todos los intentos y lotes de OpenRouter han fallado.");
      }
    }
  }

  throw new Error("Todos los intentos y lotes de OpenRouter han fallado.");
}

/**
 * Llama a la API de Coco Solution
 */
async function callCocoAPI(prompt: string): Promise<AIResponse> {
  const simplifiedPrompt = `Responde breve y claro en texto plano (sin markdown): ${prompt.substring(0, 1000)}`;
  const payload = { 
    message: simplifiedPrompt, 
    noAuth: "true", 
    action: "text/generateResume", 
    app: "CHATBOT", 
    rol: "user", 
    method: "POST", 
    language: "es" 
  };
  
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
    
    if (cleanText.length < 5) {
      throw new Error('Respuesta de Coco insuficiente');
    }

    return { text: cleanText, provider: 'coco', modelName: 'Coco Custom' };
  } else {
    throw new Error('Respuesta inesperada de Coco API');
  }
}

// ============================================================
// SERVICIO PÚBLICO
// ============================================================

/**
 * Servicio centralizado de IA con fallback en cascada:
 * 1. Gemini (si tiene API key)
 * 2. OpenRouter (si tiene API key)
 * 3. Coco Solution (fallback final)
 */
export class AIService {
  /**
   * Llama a los proveedores de IA con fallback automático
   * @param prompt - El prompt a enviar a la IA
   * @param context - Contexto opcional para logging (ej: "DashboardAI", "AdsReport")
   * @returns Respuesta de la IA con información del proveedor usado
   */
  static async callWithFallback(prompt: string, context?: string): Promise<AIResponse> {
    const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
    const openRouterApiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
    const logPrefix = context ? `[${context}]` : '';

    // Intento 1: Gemini
    if (geminiApiKey) {
      try {
        const result = await callGeminiAPI(prompt, geminiApiKey);
        return result;
      } catch (error: any) {
        // Continuar con el siguiente proveedor
      }
    }

    // Intento 2: OpenRouter
    if (openRouterApiKey) {
      try {
        const result = await callOpenRouterAPI(prompt, openRouterApiKey);
        return result;
      } catch (error: any) {
        // Continuar con el siguiente proveedor
      }
    }

    // Intento 3: Coco Solution (fallback final)
    try {
      const result = await callCocoAPI(prompt);
      return result;
    } catch (error: any) {
      throw new Error('No se pudo generar el análisis. Todos los proveedores de IA fallaron.');
    }
  }

  /**
   * Limpia y formatea el texto de la IA para que sea profesional
   * Elimina markdown, asteriscos y formatea correctamente
   */
  static cleanAIResponse(text: string): string {
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
}

