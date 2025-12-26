import { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Send, Bot, User, Sparkles, Trash2, TrendingUp, TrendingDown, 
  AlertTriangle, Users, Calendar, Target, Clock, Zap, HelpCircle,
  BarChart3, UserX, Link, CheckCircle2, XCircle, Cpu
} from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { format, startOfMonth, endOfMonth, parseISO, isSameMonth, differenceInDays, addDays, getDaysInMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  provider?: 'gemini' | 'openrouter' | 'coco';
  modelName?: string;
}

// Preguntas sugeridas para guiar al usuario
const SUGGESTED_QUESTIONS = [
  { icon: <Users className="w-3 h-3" />, text: "¿Cómo está la carga del equipo?", category: "carga" },
  { icon: <AlertTriangle className="w-3 h-3" />, text: "¿Hay alguien bloqueando tareas?", category: "dependencias" },
  { icon: <TrendingDown className="w-3 h-3" />, text: "¿Quién se ha pasado de horas este mes?", category: "eficiencia" },
  { icon: <Calendar className="w-3 h-3" />, text: "¿Quién tiene tareas asignadas?", category: "planificacion" },
  { icon: <Zap className="w-3 h-3" />, text: "Dame un resumen ejecutivo del mes", category: "resumen" },
];

// ============================================================
// LISTA DE MODELOS OPENROUTER (TODOS LOS GRATUITOS + FALLBACKS)
// ============================================================
const OPENROUTER_MODEL_CHAIN = [
  // --- TIER S: LOS PESOS PESADOS (Gratis) ---
  "google/gemini-2.0-flash-exp:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "deepseek/deepseek-r1-0528:free",
  "meta-llama/llama-3.1-405b-instruct:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "allenai/olmo-3.1-32b-think:free",
  "alibaba/tongyi-deepresearch-30b-a3b:free",
  
  // --- TIER A: MODELOS EQUILIBRADOS Y EFICIENTES ---
  "google/gemma-3-27b-it:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "qwen/qwen3-coder:free",
  "allenai/olmo-3-32b-think:free",
  "nex-agi/deepseek-v3.1-nex-n1:free",
  "kwaipilot/kat-coder-pro:free",
  "google/gemma-3-12b-it:free",
  
  // --- TIER B: MODELOS RÁPIDOS Y EXPERIMENTALES ---
  "google/gemma-3-4b-it:free",
  "xiaomi/mimo-v2-flash:free",
  "mistralai/mistral-7b-instruct:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "qwen/qwen-2.5-vl-7b-instruct:free",
  "microsoft/phi-3-medium-128k-instruct:free",
  
  // --- TIER C: RESTO DE LA LISTA DE 39 (Experimentales / Específicos) ---
  "bytedance-seed/seedream-4.5",
  "mistralai/devstral-2512:free",
  "sourceful/riverflow-v2-max-preview",
  "sourceful/riverflow-v2-standard-preview",
  "sourceful/riverflow-v2-fast-preview",
  "arcee-ai/trinity-mini:free",
  "tngtech/tng-r1t-chimera:free",
  "nvidia/nemotron-nano-12b-v2-vl:free",
  "nvidia/nemotron-nano-9b-v2:free",
  "openai/gpt-oss-120b:free",
  "openai/gpt-oss-20b:free",
  "z-ai/glm-4.5-air:free",
  "moonshotai/kimi-k2:free",
  "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
  "google/gemma-3n-e2b-it:free",
  "google/gemma-3n-e4b-it:free",
  "tngtech/deepseek-r1t2-chimera:free",
  "tngtech/deepseek-r1t-chimera:free",
  "qwen/qwen3-4b:free",

  // --- TIER Z: FALLBACKS DE PAGO (ÚLTIMO RECURSO) ---
  "cerebras/llama3.1-70b", // Velocidad extrema
  "openai/gpt-5-mini"      // Fallback
];

// ============================================================
// CONFIGURACIÓN DE COLORES Y NOMBRES POR MODELO
// ============================================================
const MODEL_CONFIG: Record<string, { name: string; color: string; border: string; bg: string }> = {
  // --- GOOGLE ---
  "google/gemini-2.0-flash": { name: "Gemini Flash 2.0", color: "text-blue-600", border: "border-blue-200", bg: "bg-blue-50" },
  "google/gemini-2.0-flash-exp:free": { name: "Gemini Flash Exp", color: "text-blue-600", border: "border-blue-200", bg: "bg-blue-50" },
  "google/gemma-3-27b-it:free": { name: "Gemma 3 27B", color: "text-sky-600", border: "border-sky-200", bg: "bg-sky-50" },
  "google/gemma-3-12b-it:free": { name: "Gemma 3 12B", color: "text-sky-600", border: "border-sky-200", bg: "bg-sky-50" },
  "google/gemma-3-4b-it:free": { name: "Gemma 3 4B", color: "text-sky-600", border: "border-sky-200", bg: "bg-sky-50" },
  "google/gemma-3n-e2b-it:free": { name: "Gemma 3N 2B", color: "text-sky-500", border: "border-sky-200", bg: "bg-sky-50" },
  "google/gemma-3n-e4b-it:free": { name: "Gemma 3N 4B", color: "text-sky-500", border: "border-sky-200", bg: "bg-sky-50" },
  
  // --- META (LLAMA) ---
  "meta-llama/llama-3.3-70b-instruct:free": { name: "Llama 3.3 70B", color: "text-indigo-600", border: "border-indigo-200", bg: "bg-indigo-50" },
  "meta-llama/llama-3.1-405b-instruct:free": { name: "Llama 3.1 405B", color: "text-indigo-700", border: "border-indigo-300", bg: "bg-indigo-100" },
  "meta-llama/llama-3.2-3b-instruct:free": { name: "Llama 3.2 3B", color: "text-indigo-500", border: "border-indigo-200", bg: "bg-indigo-50" },
  
  // --- MISTRAL ---
  "mistralai/mistral-7b-instruct:free": { name: "Mistral 7B", color: "text-orange-500", border: "border-orange-200", bg: "bg-orange-50" },
  "mistralai/mistral-small-3.1-24b-instruct:free": { name: "Mistral Small 3", color: "text-orange-600", border: "border-orange-200", bg: "bg-orange-50" },
  "mistralai/devstral-2512:free": { name: "Mistral Dev", color: "text-amber-600", border: "border-amber-200", bg: "bg-amber-50" },
  
  // --- QWEN / ALIBABA ---
  "qwen/qwen-2.5-vl-7b-instruct:free": { name: "Qwen 2.5 VL", color: "text-purple-600", border: "border-purple-200", bg: "bg-purple-50" },
  "qwen/qwen3-coder:free": { name: "Qwen 3 Coder", color: "text-purple-700", border: "border-purple-300", bg: "bg-purple-100" },
  "qwen/qwen3-4b:free": { name: "Qwen 3 4B", color: "text-purple-500", border: "border-purple-200", bg: "bg-purple-50" },
  "alibaba/tongyi-deepresearch-30b-a3b:free": { name: "Tongyi Research", color: "text-violet-600", border: "border-violet-200", bg: "bg-violet-50" },

  // --- DEEPSEEK & NOUS / TNG ---
  "deepseek/deepseek-r1-0528:free": { name: "DeepSeek R1", color: "text-cyan-700", border: "border-cyan-200", bg: "bg-cyan-50" },
  "nex-agi/deepseek-v3.1-nex-n1:free": { name: "DeepSeek V3.1 Nex", color: "text-cyan-600", border: "border-cyan-200", bg: "bg-cyan-50" },
  "tngtech/tng-r1t-chimera:free": { name: "TNG R1T", color: "text-cyan-800", border: "border-cyan-300", bg: "bg-cyan-100" },
  "tngtech/deepseek-r1t2-chimera:free": { name: "TNG R1T2", color: "text-cyan-800", border: "border-cyan-300", bg: "bg-cyan-100" },
  "tngtech/deepseek-r1t-chimera:free": { name: "TNG R1T", color: "text-cyan-800", border: "border-cyan-300", bg: "bg-cyan-100" },
  "nousresearch/hermes-3-llama-3.1-405b:free": { name: "Hermes 3 405B", color: "text-teal-700", border: "border-teal-300", bg: "bg-teal-100" },
  
  // --- NVIDIA ---
  "nvidia/nemotron-3-nano-30b-a3b:free": { name: "Nvidia Nemotron 30B", color: "text-emerald-600", border: "border-emerald-200", bg: "bg-emerald-50" },
  "nvidia/nemotron-nano-12b-v2-vl:free": { name: "Nvidia Nano 12B", color: "text-emerald-500", border: "border-emerald-200", bg: "bg-emerald-50" },
  "nvidia/nemotron-nano-9b-v2:free": { name: "Nvidia Nano 9B", color: "text-emerald-500", border: "border-emerald-200", bg: "bg-emerald-50" },

  // --- ALLEN AI (OLMO) ---
  "allenai/olmo-3.1-32b-think:free": { name: "Olmo 3.1", color: "text-slate-600", border: "border-slate-300", bg: "bg-slate-100" },
  "allenai/olmo-3-32b-think:free": { name: "Olmo 3", color: "text-slate-600", border: "border-slate-300", bg: "bg-slate-100" },

  // --- OPENAI (OSS & Paid Fallback) ---
  "openai/gpt-oss-120b:free": { name: "GPT OSS 120B", color: "text-green-700", border: "border-green-300", bg: "bg-green-100" },
  "openai/gpt-oss-20b:free": { name: "GPT OSS 20B", color: "text-green-600", border: "border-green-200", bg: "bg-green-50" },
  "openai/gpt-5-mini": { name: "GPT-5 Mini", color: "text-green-500", border: "border-green-200", bg: "bg-green-50" }, 

  // --- XIAOMI / BYTEDANCE / SOURCEFUL / OTHERS ---
  "xiaomi/mimo-v2-flash:free": { name: "Xiaomi MiMo", color: "text-orange-600", border: "border-orange-300", bg: "bg-orange-50" },
  "bytedance-seed/seedream-4.5": { name: "Seedream 4.5", color: "text-pink-600", border: "border-pink-200", bg: "bg-pink-50" },
  "sourceful/riverflow-v2-max-preview": { name: "Riverflow Max", color: "text-blue-500", border: "border-blue-200", bg: "bg-blue-50" },
  "sourceful/riverflow-v2-standard-preview": { name: "Riverflow Std", color: "text-blue-500", border: "border-blue-200", bg: "bg-blue-50" },
  "sourceful/riverflow-v2-fast-preview": { name: "Riverflow Fast", color: "text-blue-500", border: "border-blue-200", bg: "bg-blue-50" },
  "arcee-ai/trinity-mini:free": { name: "Trinity Mini", color: "text-fuchsia-600", border: "border-fuchsia-200", bg: "bg-fuchsia-50" },
  "kwaipilot/kat-coder-pro:free": { name: "Kat Coder Pro", color: "text-yellow-600", border: "border-yellow-200", bg: "bg-yellow-50" },
  "z-ai/glm-4.5-air:free": { name: "GLM 4.5 Air", color: "text-indigo-500", border: "border-indigo-200", bg: "bg-indigo-50" },
  "moonshotai/kimi-k2:free": { name: "Kimi K2", color: "text-rose-500", border: "border-rose-200", bg: "bg-rose-50" },
  "cognitivecomputations/dolphin-mistral-24b-venice-edition:free": { name: "Dolphin Mistral", color: "text-teal-600", border: "border-teal-200", bg: "bg-teal-50" },

  // --- CEREBRAS (Paid Fallback) ---
  "cerebras/llama3.1-70b": { name: "🚀 Cerebras Llama", color: "text-red-600", border: "border-red-300", bg: "bg-red-50" },
  
  // --- Default ---
  "default": { name: "AI Model", color: "text-slate-600", border: "border-slate-200", bg: "bg-slate-50" }
};

// ============================================================
// FUNCIÓN PARA PARSEAR MARKDOWN BÁSICO
// ============================================================
function parseSimpleMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  
  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-1 my-2">
          {listItems.map((item, i) => (
            <li key={i} className="text-sm">{parseLine(item)}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };
  
  const parseLine = (line: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let key = 0;
    
    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      if (boldMatch && boldMatch.index !== undefined) {
        if (boldMatch.index > 0) {
          parts.push(<span key={key++}>{remaining.slice(0, boldMatch.index)}</span>);
        }
        parts.push(<strong key={key++} className="font-semibold">{boldMatch[1]}</strong>);
        remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
        continue;
      }
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }
    return parts.length > 0 ? parts : line;
  };
  
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      flushList();
      elements.push(<br key={`br-${index}`} />);
      return;
    }
    if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ')) {
      listItems.push(trimmedLine.slice(2));
      return;
    }
    flushList();
    elements.push(
      <p key={`p-${index}`} className="mb-1">
        {parseLine(trimmedLine)}
      </p>
    );
  });
  flushList();
  return <div className="space-y-1">{elements}</div>;
}

// ============================================================
// SISTEMA DE IA CON FALLBACK EN CASCADA
// ============================================================
async function callGeminiAPI(prompt: string, apiKey: string): Promise<{ text: string; provider: 'gemini'; modelName: string }> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = "gemini-2.0-flash";
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent(prompt);
  return { text: result.response.text(), provider: 'gemini', modelName: modelName };
}

// VERSIÓN MEJORADA: Usa Batching para evitar el error 400
async function callOpenRouterAPI(prompt: string, apiKey: string): Promise<{ text: string; provider: 'openrouter'; modelName: string }> {
  const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
  
  // Tamaño del lote: 3 modelos máximo por petición para evitar error 400
  const BATCH_SIZE = 3; 

  // Función auxiliar para crear chunks
  const chunkArray = (arr: string[], size: number) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };

  const modelBatches = chunkArray(OPENROUTER_MODEL_CHAIN, BATCH_SIZE);

  // Iteramos sobre los lotes secuencialmente
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
          // OpenRouter permite 'models' (array) para auto-fallback, pero limitado a 3 items
          models: currentBatch,
          // Opcional: define el primario explicitamente si la API lo prefiere, aunque 'models' suele bastar
          // model: currentBatch[0], 
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
        }),
      });

      // Si falla con 429 (rate limit) o 5xx, lanzamos error para que el catch continue el bucle
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
      
      // Si la respuesta es 200 pero vacía, seguimos intentando
      console.warn(`⚠️ Respuesta vacía en lote ${i+1}, probando siguiente...`);

    } catch (error: any) {
      console.warn(`⚠️ Fallo en lote ${i + 1} de OpenRouter: ${error.message}`);
      // Continuamos al siguiente ciclo del bucle for
    }
  }

  // Si llegamos aquí, todos los lotes fallaron
  throw new Error("Todos los intentos y lotes de OpenRouter han fallado.");
}

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

async function callAI(prompt: string): Promise<{ text: string; provider: 'gemini' | 'openrouter' | 'coco'; modelName: string }> {
  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const openRouterApiKey = import.meta.env.VITE_OPENROUTER_API_KEY;

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

  if (openRouterApiKey) {
    try {
      console.log('🟣 Intentando con OpenRouter (Estrategia por Lotes)...');
      const result = await callOpenRouterAPI(prompt, openRouterApiKey);
      return result;
    } catch (error: any) {
      console.warn('⚠️ OpenRouter falló completamente:', error.message);
    }
  }

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

export default function DashboardAI() {
  const { employees, allocations, projects, clients, absences, teamEvents, getEmployeeMonthlyLoad, isLoading: dataLoading } = useApp();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      text: 'Que pasa? Soy **Minguito**, y si, tengo acceso a todos vuestros trapos sucios: desviaciones, bloqueos por vacaciones y proyectos quemados. Pregunta lo que quieras.',
      timestamp: new Date(),
      provider: 'gemini',
      modelName: 'gemini-2.0-flash'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // ============================================================
  // CEREBRO DE MINGUITO: Análisis completo de datos
  // ============================================================
  const analysisData = useMemo(() => {
    // Calculamos solo datos básicos para el encabezado visual si es necesario
    const now = new Date();
    return { 
        month: format(now, "MMMM yyyy", { locale: es }),
        employeesCount: employees.length,
        projectsCount: projects.length
    };
  }, [employees, projects]);

  // ============================================================
  // GENERACIÓN DE CONTEXTO DE NEGOCIO (LA CLAVE)
  // ============================================================
  const buildDynamicContext = (userQuestion: string) => {
    const now = new Date();
    const safeEmployees = employees || [];
    const safeAllocations = allocations || [];
    const safeProjects = projects || [];
    const safeAbsences = absences || [];
    
    // Filtros temporales
    const monthAllocations = safeAllocations.filter(a => isSameMonth(parseISO(a.weekStartDate), now));
    
    // 1. DETECCIÓN DE TAREAS ZOMBIE (Antiguas y sin completar)
    const zombieTasks = safeAllocations.filter(a => 
      a.status !== 'completed' && 
      differenceInDays(now, parseISO(a.weekStartDate)) > 14 // Más de 2 semanas
    ).map(t => ({
      tarea: t.taskName || 'Sin nombre',
      empleado: safeEmployees.find(e => e.id === t.employeeId)?.name,
      proyecto: safeProjects.find(p => p.id === t.projectId)?.name,
      dias_retraso: differenceInDays(now, parseISO(t.weekStartDate))
    }));

    // 2. DETECCIÓN DE DESVIACIONES (Horas Reales > Asignadas)
    const inefficientTasks = monthAllocations.filter(a => 
      a.status === 'completed' && (a.hoursActual || 0) > a.hoursAssigned
    ).map(t => ({
      tarea: t.taskName,
      empleado: safeEmployees.find(e => e.id === t.employeeId)?.name,
      horas_presupuestadas: t.hoursAssigned,
      horas_reales: t.hoursActual,
      desviacion: ((t.hoursActual! - t.hoursAssigned) / t.hoursAssigned * 100).toFixed(0) + '%'
    }));

    // 3. ANÁLISIS DE PACING DE PROYECTOS (Burn Rate)
    const daysInMonth = getDaysInMonth(now);
    const currentDay = now.getDate();
    const monthProgressPct = currentDay / daysInMonth;

    const riskyProjects = safeProjects.filter(p => p.status === 'active' && p.budgetHours > 0).map(p => {
      const projTasks = monthAllocations.filter(a => a.projectId === p.id);
      const consumed = projTasks.reduce((acc, t) => acc + (t.status === 'completed' ? (t.hoursActual || t.hoursAssigned) : t.hoursAssigned), 0); // Estimamos consumo con asignado si no está completa
      const burnPct = consumed / p.budgetHours;
      
      // Es arriesgado si el consumo supera al progreso del mes en un 20% margen
      if (burnPct > (monthProgressPct + 0.15)) {
        return {
          proyecto: p.name,
          presupuesto: p.budgetHours,
          consumido: consumed.toFixed(1),
          porcentaje_gasto: (burnPct * 100).toFixed(0) + '%',
          porcentaje_mes: (monthProgressPct * 100).toFixed(0) + '%',
          estado: 'QUEMANDO PRESUPUESTO RÁPIDO 🔥'
        };
      }
      return null;
    }).filter(Boolean);

    // 4. CONFLICTOS DE VACACIONES (Tarea asignada en día de ausencia)
    const vacationConflicts: any[] = [];
    safeEmployees.forEach(emp => {
      const empAbsences = safeAbsences.filter(a => a.employeeId === emp.id);
      const empTasks = safeAllocations.filter(a => a.employeeId === emp.id && a.status !== 'completed');
      
      empTasks.forEach(task => {
        const taskDate = parseISO(task.weekStartDate);
        const conflict = empAbsences.find(abs => {
          const start = parseISO(abs.startDate);
          const end = parseISO(abs.endDate);
          return taskDate >= start && taskDate <= end;
        });

        if (conflict) {
          vacationConflicts.push({
            empleado: emp.name,
            tarea: task.taskName || 'Tarea sin nombre',
            proyecto: safeProjects.find(p => p.id === task.projectId)?.name || 'Sin proyecto',
            horas: task.hoursAssigned,
            fecha_tarea: task.weekStartDate,
            vacaciones: `${conflict.startDate} a ${conflict.endDate}`,
            tipo: conflict.type
          });
        }
      });
    });

    // 5. DATOS ESPECÍFICOS DE LA PREGUNTA
    const lowerQ = userQuestion.toLowerCase();
    const mentionedEmployees = safeEmployees.filter(e => lowerQ.includes(e.name.toLowerCase()));
    
    let specificContext = "";
    if (mentionedEmployees.length > 0) {
      specificContext = "\n*** DATOS DE EMPLEADOS MENCIONADOS ***\n";
      mentionedEmployees.forEach(emp => {
        // FIX CRÍTICO: Usar defaultWeeklyCapacity en lugar de capacity (que no existe)
        const capacity = Number(emp.defaultWeeklyCapacity) || 0;
        const empTasks = monthAllocations.filter(a => a.employeeId === emp.id);
        const assigned = empTasks.reduce((sum, t) => sum + t.hoursAssigned, 0);
        
        specificContext += `Empleado: ${emp.name}\n`;
        specificContext += `Capacidad Base: ${capacity}h\n`;
        specificContext += `Asignado Mes: ${assigned}h\n`;
        // Detectar si está en vacaciones AHORA
        const isOnVacation = safeAbsences.some(a => {
            const start = parseISO(a.startDate);
            const end = parseISO(a.endDate);
            return a.employeeId === emp.id && now >= start && now <= end;
        });
        if (isOnVacation) specificContext += "ESTADO ACTUAL: DE VACACIONES (Ausencia activa hoy)\n";
      });
    }

    // FIX CRÍTICO: Calcular capacidad total usando la propiedad correcta
    const totalCapacity = safeEmployees.filter(e => e.isActive).reduce((sum, e) => sum + (Number(e.defaultWeeklyCapacity) || 0), 0);
    const totalAssigned = monthAllocations.reduce((sum, a) => sum + a.hoursAssigned, 0);

    return `
REPORTE DE INTELIGENCIA DE NEGOCIO (MINGUITO AI):
Fecha: ${format(now, "dd/MM/yyyy")}
Capacidad Total Real (Semanal): ${totalCapacity}h | Asignado Total Mes: ${totalAssigned}h

🚨 ALERTAS DE GESTIÓN (Prioridad Alta - Conflictos Vacacionales):
${vacationConflicts.length > 0 ? JSON.stringify(vacationConflicts, null, 2) : "Ningún conflicto de vacaciones detectado."}

🔥 PROYECTOS EN RIESGO (Overburn - Gastando más de lo debido):
${riskyProjects.length > 0 ? JSON.stringify(riskyProjects, null, 2) : "El ritmo de gasto parece saludable."}

🧟 TAREAS ZOMBIE (>14 días sin cerrar):
${zombieTasks.length > 0 ? JSON.stringify(zombieTasks.slice(0, 5), null, 2) : "No hay tareas estancadas."}

📉 INEFICIENCIAS (Horas Reales > Asignadas):
${inefficientTasks.length > 0 ? JSON.stringify(inefficientTasks.slice(0, 5), null, 2) : "Las tareas completadas están en presupuesto."}

${specificContext}
`;
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const dataContext = buildDynamicContext(input);
      
      const systemPrompt = `
ACTÚA COMO: Minguito, un Project Manager Senior, sarcástico, mordaz y obsesionado con la eficiencia y el dinero.
NO ERES UNA CALCULADORA. ERES UN ANALISTA DE NEGOCIO QUE DETECTA PROBLEMAS.

CONTEXTO DE DATOS PROCESADOS:
${dataContext}

TU TRABAJO:
1. **CONFLICTOS VACACIONALES**: Si ves datos en "ALERTAS DE GESTIÓN", destrózalos. Es inaceptable asignar tareas a gente de vacaciones. Di nombres, PROYECTO y TAREA exacta.
2. **DINERO (Overburn)**: Si hay proyectos en "PROYECTOS EN RIESGO", avisa que nos vamos a quedar sin presupuesto antes de fin de mes.
3. **INEFICIENCIA**: Si ves tareas donde Horas Reales > Asignadas, pregunta qué pasó. ¿Se durmieron?
4. **NO INVENTES**: Usa solo los datos del JSON. Si está vacío, di que todo va sospechosamente bien.

PREGUNTA DEL USUARIO: "${input}"
      `;

      // Asegúrate de importar y usar la función callAI real que incluye el fix de OpenRouter
      const response = await callAI(systemPrompt);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: response.text,
        timestamp: new Date(),
        provider: response.provider,
        modelName: response.modelName
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: '❌ Minguito se ha mareado con tantos datos. Intenta de nuevo.',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestedQuestion = (question: string) => setInput(question);
  const clearChat = () => setMessages([
    {
      id: '1',
      role: 'assistant',
      text: 'Que pasa? Soy **Minguito**, y si, tengo acceso a todos vuestros trapos sucios: desviaciones, bloqueos por vacaciones y proyectos quemados. Pregunta lo que quieras.',
      timestamp: new Date(),
      provider: 'gemini',
      modelName: 'gemini-2.0-flash'
    }
  ]);

  if (dataLoading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col items-center justify-center">
        <Sparkles className="h-12 w-12 text-indigo-500 animate-pulse" />
        <p className="text-muted-foreground mt-4">Cargando datos...</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col gap-4 p-4">
      <Card className="flex-1 flex flex-col overflow-hidden shadow-md border-indigo-100/50">
        <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b pb-4">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="h-10 w-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-indigo-200">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent font-bold">
                Minguito AI
              </span>
              <p className="text-xs text-muted-foreground font-normal mt-0.5">
                Analista de Gestión • {analysisData.month}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] bg-white">
                {analysisData.employeesCount} empleados
              </Badge>
              <Badge variant="outline" className="text-[10px] bg-white">
                {analysisData.projectsCount} proyectos
              </Badge>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-muted-foreground hover:text-red-500 h-8 w-8" 
                onClick={clearChat}
                title="Limpiar chat"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-hidden p-0 bg-slate-50/30">
          <ScrollArea className="h-full p-4">
            <div className="space-y-4 max-w-3xl mx-auto">
              {messages.map((msg) => {
                const modelStyle = msg.modelName && MODEL_CONFIG[msg.modelName] 
                  ? MODEL_CONFIG[msg.modelName] 
                  : MODEL_CONFIG["default"];

                return (
                  <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <Avatar className={`h-8 w-8 mt-1 border shrink-0 ${
                      msg.role === 'assistant' 
                        ? 'bg-gradient-to-br from-indigo-100 to-purple-100 border-indigo-200' 
                        : 'bg-white border-slate-200'
                    }`}>
                      <AvatarFallback className={msg.role === 'assistant' ? 'text-indigo-700' : 'text-slate-700'}>
                        {msg.role === 'assistant' ? <Sparkles className="h-4 w-4" /> : <User className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                        msg.role === 'user' 
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-tr-sm whitespace-pre-wrap' 
                          : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm'
                      }`}>
                        {msg.role === 'assistant' ? parseSimpleMarkdown(msg.text) : msg.text}
                      </div>
                      
                      <span className="text-[10px] text-muted-foreground mt-1 px-1 flex items-center gap-1.5 flex-wrap">
                        {format(msg.timestamp, 'HH:mm')}
                        
                        {msg.provider && (
                          <>
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[9px] font-medium border",
                              msg.provider === 'gemini' 
                                ? "bg-blue-50 text-blue-600 border-blue-100" 
                                : msg.provider === 'openrouter'
                                ? "bg-purple-50 text-purple-600 border-purple-100"
                                : "bg-orange-50 text-orange-600 border-orange-100"
                            )}>
                              {msg.provider === 'gemini' ? '✨ Gemini' : msg.provider === 'openrouter' ? '🟣 OpenRouter' : '🥥 Coco'}
                            </span>

                            {msg.provider === 'openrouter' && msg.modelName && (
                              <span className={cn(
                                "px-1.5 py-0.5 rounded text-[9px] font-medium border flex items-center gap-1",
                                modelStyle.bg,
                                modelStyle.color,
                                modelStyle.border
                              )}>
                                <Cpu className="w-3 h-3 opacity-70" />
                                {modelStyle.name}
                              </span>
                            )}
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
              
              {isLoading && (
                <div className="flex gap-3">
                  <div className="h-8 w-8 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-indigo-400 animate-pulse" />
                  </div>
                  <div className="bg-white border border-slate-100 px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <span className="animate-bounce">●</span>
                      <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>●</span>
                      <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>●</span>
                    </span>
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>
        </CardContent>

        <div className="border-t bg-white">
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center gap-2 mb-2">
              <HelpCircle className="w-3 h-3 text-slate-400" />
              <span className="text-[10px] text-slate-500 uppercase font-medium">Sugerencias</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-colors"
                  onClick={() => handleSuggestedQuestion(q.text)}
                  disabled={isLoading}
                >
                  {q.icon}
                  {q.text}
                </Button>
              ))}
            </div>
          </div>
          
          <div className="p-4 pt-2">
            <div className="flex gap-2 max-w-3xl mx-auto relative">
              <Input 
                placeholder="Pregunta lo que quieras sobre el equipo, proyectos, cargas..." 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                className="pr-12 py-6 shadow-sm border-slate-200 focus-visible:ring-indigo-500"
                disabled={isLoading}
              />
              <Button 
                size="icon" 
                onClick={() => handleSend()} 
                disabled={isLoading || !input.trim()}
                className="absolute right-1.5 top-1.5 h-9 w-9 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
