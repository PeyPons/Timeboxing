import { GoogleGenerativeAI } from "@google/generative-ai";

export async function generateAdsSummary(
  clientName: string,
  statsCurrent: any,
  statsPrevious: any
) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return "Error: Falta API Key.";

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
    Actúa como un experto Senior en Google Ads (PPC). Escribe un resumen ejecutivo breve (máximo 80 palabras) para el cliente "${clientName}".
    
    DATOS ESTE MES:
    - Gasto: ${statsCurrent.cost}€
    - Conversiones: ${statsCurrent.conversions}
    - CPA: ${statsCurrent.cpa}€
    - ROAS: ${statsCurrent.roas}
    
    DATOS MES ANTERIOR:
    - Gasto: ${statsPrevious.cost}€
    - Conversiones: ${statsPrevious.conversions}
    - CPA: ${statsPrevious.cpa}€
    
    Instrucciones:
    1. Compara el rendimiento (¿mejor o peor?).
    2. Usa un tono profesional pero cercano.
    3. Destaca el dato más positivo.
    4. No saludes, empieza directo al análisis.
  `;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (e) {
    return "No se pudo generar el análisis automático.";
  }
}
