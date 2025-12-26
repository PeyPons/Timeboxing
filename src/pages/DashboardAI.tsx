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
import { format, startOfMonth, endOfMonth, parseISO, isSameMonth, differenceInDays, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  provider?: 'gemini' | 'openrouter' | 'coco';
  modelName?: string; // Para guardar el nombre específico del modelo
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
// LISTA DE MODELOS OPENROUTER (DEFINITIVA Y ESTABLE)
// ============================================================
const OPENROUTER_MODEL_CHAIN = [
  "google/gemma-2-9b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "mistralai/mistral-7b-instruct:free",
  "microsoft/phi-3-medium-128k-instruct:free",
  "qwen/qwen-2.5-7b-instruct:free",
  "google/gemini-2.0-flash-exp:free"
];

// ============================================================
// CONFIGURACIÓN DE COLORES Y NOMBRES POR MODELO
// ============================================================
const MODEL_CONFIG: Record<string, { name: string; color: string; border: string; bg: string }> = {
  // Google / Gemini / Gemma
  "google/gemini-2.0-flash": { name: "Gemini Flash 2.0", color: "text-blue-600", border: "border-blue-200", bg: "bg-blue-50" },
  "google/gemini-2.0-flash-exp:free": { name: "Gemini Flash Exp", color: "text-blue-600", border: "border-blue-200", bg: "bg-blue-50" },
  "google/gemma-2-9b-it:free": { name: "Gemma 2 9B", color: "text-sky-600", border: "border-sky-200", bg: "bg-sky-50" },
  
  // Meta / Llama
  "meta-llama/llama-3.3-70b-instruct:free": { name: "Llama 3.3 70B", color: "text-blue-700", border: "border-blue-300", bg: "bg-blue-100" },
  "meta-llama/llama-3.2-3b-instruct:free": { name: "Llama 3.2 3B", color: "text-blue-700", border: "border-blue-300", bg: "bg-blue-100" },
  
  // Mistral
  "mistralai/mistral-7b-instruct:free": { name: "Mistral 7B", color: "text-orange-500", border: "border-orange-200", bg: "bg-orange-50" },
  "mistralai/devstral-2512:free": { name: "Mistral Dev", color: "text-orange-600", border: "border-orange-300", bg: "bg-orange-100" },
  
  // Microsoft
  "microsoft/phi-3-medium-128k-instruct:free": { name: "Phi-3 Medium", color: "text-emerald-600", border: "border-emerald-200", bg: "bg-emerald-50" },
  "microsoft/phi-3-mini-128k-instruct:free": { name: "Phi-3 Mini", color: "text-emerald-600", border: "border-emerald-200", bg: "bg-emerald-50" },

  // Qwen (Alibaba)
  "qwen/qwen-2.5-7b-instruct:free": { name: "Qwen 2.5 7B", color: "text-purple-600", border: "border-purple-200", bg: "bg-purple-50" },
  "qwen/qwen3-coder:free": { name: "Qwen 3 Coder", color: "text-purple-700", border: "border-purple-300", bg: "bg-purple-100" },

  // Xiaomi
  "xiaomi/mimo-v2-flash:free": { name: "Xiaomi MiMo", color: "text-orange-600", border: "border-orange-300", bg: "bg-orange-50" },
  
  // Nvidia
  "nvidia/nemotron-3-nano-30b-a3b:free": { name: "Nvidia Nemotron", color: "text-green-600", border: "border-green-300", bg: "bg-green-50" },

  // DeepSeek
  "deepseek/deepseek-r1-0528:free": { name: "DeepSeek R1", color: "text-cyan-600", border: "border-cyan-300", bg: "bg-cyan-50" },
  
  // Fallbacks genéricos
  "default": { name: "Unknown Model", color: "text-slate-600", border: "border-slate-200", bg: "bg-slate-50" }
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

async function callOpenRouterAPI(prompt: string, apiKey: string): Promise<{ text: string; provider: 'openrouter'; modelName: string }> {
  const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

  for (const modelId of OPENROUTER_MODEL_CHAIN) {
    console.log(`🟣 [OpenRouter] Intentando con modelo: ${modelId}...`);

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
          model: modelId, 
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Status ${response.status}: ${errorText}`);
      }

      const responseData = await response.json();
      
      if (responseData?.choices?.[0]?.message?.content) {
        console.log(`✅ [OpenRouter] Éxito con ${modelId}`);
        return { 
          text: responseData.choices[0].message.content, 
          provider: 'openrouter', 
          modelName: modelId 
        };
      } else {
        throw new Error(`Estructura incorrecta en ${modelId}`);
      }

    } catch (error: any) {
      console.warn(`⚠️ Falló ${modelId}: ${error.message}`);
      continue;
    }
  }

  throw new Error('OpenRouter agotado: Ningún modelo gratuito respondió correctamente.');
}

async function callCocoAPI(prompt: string): Promise<{ text: string; provider: 'coco'; modelName: string }> {
  const COCO_API_URL = 'https://ws.cocosolution.com/api/ia/?noAuth=true&action=text/generateResume&app=CHATBOT&rol=user&method=POST&';
  
  const simplifiedPrompt = `Responde breve y claro en texto plano (sin markdown): ${prompt.substring(0, 1000)}`;
  
  const payload = {
    message: simplifiedPrompt,
    noAuth: "true",
    action: "text/generateResume",
    app: "CHATBOT",
    rol: "user",
    method: "POST",
    language: "es",
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
      throw new Error('Respuesta de Coco insuficiente o inválida');
    }

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
      console.log('🟣 Intentando con OpenRouter (Cascada)...');
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
      text: 'Que pasa? Soy **Minguito**, y si, tengo acceso a todos vuestros trapos sucios: cargas, bloqueos, chapuzas, proyectos hundidos... Pregunta lo que quieras, pero preparate para la verdad. Quien la esta liando hoy?',
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
    const now = new Date();
    const safeEmployees = employees || [];
    const safeAllocations = allocations || [];
    const safeProjects = projects || [];
    const safeClients = clients || [];
    const safeAbsences = absences || [];
    const safeTeamEvents = teamEvents || [];
    
    const activeEmployees = safeEmployees.filter(e => e.isActive);
    const activeProjects = safeProjects.filter(p => p.status === 'active');
    
    const monthAllocations = safeAllocations.filter(a => 
      isSameMonth(parseISO(a.weekStartDate), now)
    );
    
    const completedTasks = monthAllocations.filter(a => a.status === 'completed');
    const pendingTasks = monthAllocations.filter(a => a.status !== 'completed');

    const employeeAnalysis = activeEmployees.map(emp => {
      const load = getEmployeeMonthlyLoad(emp.id, now.getFullYear(), now.getMonth());
      const empTasks = monthAllocations.filter(a => a.employeeId === emp.id);
      const empCompleted = empTasks.filter(a => a.status === 'completed');
      const empPending = empTasks.filter(a => a.status !== 'completed');
      
      const totalReal = empCompleted.reduce((sum, a) => sum + (a.hoursActual || 0), 0);
      const totalComp = empCompleted.reduce((sum, a) => sum + (a.hoursComputed || 0), 0);
      const totalEst = empCompleted.reduce((sum, a) => sum + a.hoursAssigned, 0);
      const efficiency = totalReal > 0 ? ((totalComp - totalReal) / totalReal * 100) : 0;
      
      const blocking = empPending.filter(task => 
        safeAllocations.some(other => other.dependencyId === task.id && other.status !== 'completed')
      );
      
      const waitingFor = empPending.filter(task => {
        if (!task.dependencyId) return false;
        const dep = safeAllocations.find(a => a.id === task.dependencyId);
        return dep && dep.status !== 'completed';
      });

      return {
        id: emp.id,
        name: emp.name,
        capacity: emp.capacity,
        assigned: load.totalAssigned,
        completed: empCompleted.length,
        pending: empPending.length,
        realHours: totalReal,
        computedHours: totalComp,
        estimatedHours: totalEst,
        efficiency: efficiency,
        blocking: blocking.length,
        waitingFor: waitingFor.length,
        overloaded: load.totalAssigned > emp.capacity,
        underutilized: load.totalAssigned < emp.capacity * 0.7
      };
    });

    const projectAnalysis = activeProjects.map(proj => {
      const projTasks = monthAllocations.filter(a => a.projectId === proj.id);
      const projCompleted = projTasks.filter(a => a.status === 'completed');
      const projPending = projTasks.filter(a => a.status !== 'completed');
      
      const totalAssigned = projTasks.reduce((sum, a) => sum + a.hoursAssigned, 0);
      const totalReal = projCompleted.reduce((sum, a) => sum + (a.hoursActual || 0), 0);
      const totalBudget = proj.totalBudget || 0;
      
      const burnRate = totalBudget > 0 ? (totalReal / totalBudget * 100) : 0;

      return {
        id: proj.id,
        name: proj.name,
        client: safeClients.find(c => c.id === proj.clientId)?.name || 'Sin cliente',
        totalTasks: projTasks.length,
        completed: projCompleted.length,
        pending: projPending.length,
        totalAssigned,
        totalReal,
        totalBudget,
        burnRate,
        overBudget: totalReal > totalBudget,
        completion: projTasks.length > 0 ? (projCompleted.length / projTasks.length * 100) : 0
      };
    });

    const totalCapacity = activeEmployees.reduce((sum, e) => sum + e.capacity, 0);
    const totalAssigned = monthAllocations.reduce((sum, a) => sum + a.hoursAssigned, 0);
    const utilizationRate = totalCapacity > 0 ? (totalAssigned / totalCapacity * 100) : 0;
    
    const overloadedEmployees = employeeAnalysis.filter(e => e.overloaded);
    const underutilizedEmployees = employeeAnalysis.filter(e => e.underutilized);
    const blockingEmployees = employeeAnalysis.filter(e => e.blocking > 0);

    const monthAbsences = safeAbsences.filter(a => 
      isSameMonth(parseISO(a.startDate), now) || isSameMonth(parseISO(a.endDate), now)
    );
    
    const monthEvents = safeTeamEvents.filter(e => 
      isSameMonth(parseISO(e.date), now)
    );

    return {
      month: format(now, "MMMM yyyy", { locale: es }),
      employees: employeeAnalysis,
      projects: projectAnalysis,
      metrics: {
        totalCapacity,
        totalAssigned,
        utilizationRate,
        completedTasks: completedTasks.length,
        pendingTasks: pendingTasks.length,
        overloadedCount: overloadedEmployees.length,
        underutilizedCount: underutilizedEmployees.length,
        blockingCount: blockingEmployees.length
      },
      absences: monthAbsences,
      events: monthEvents,
      alerts: {
        critical: overloadedEmployees.length + blockingEmployees.length,
        warning: underutilizedEmployees.length + projectAnalysis.filter(p => p.overBudget).length
      }
    };
  }, [employees, allocations, projects, clients, absences, teamEvents, getEmployeeMonthlyLoad]);

  // ============================================================
  // GENERACIÓN DE CONTEXTO DINÁMICO (LA CLAVE)
  // ============================================================
  const buildDynamicContext = (userQuestion: string) => {
    const now = new Date();
    const safeEmployees = employees || [];
    const safeAllocations = allocations || [];
    const safeProjects = projects || [];
    
    // 1. ANÁLISIS DE INTENCIÓN (Búsqueda de entidades mencionadas)
    const lowerQ = userQuestion.toLowerCase();
    const mentionedEmployees = safeEmployees.filter(e => lowerQ.includes(e.name.toLowerCase()));
    const mentionedProjects = safeProjects.filter(p => lowerQ.includes(p.name.toLowerCase()));
    
    // 2. DATOS ESPECÍFICOS (Solo si se mencionan)
    let detailedData = "";
    
    if (mentionedEmployees.length > 0) {
      detailedData += "\n*** DETALLE PROFUNDO DE EMPLEADOS MENCIONADOS ***\n";
      mentionedEmployees.forEach(emp => {
        // Buscar TODAS las tareas de este empleado este mes
        const empTasks = safeAllocations.filter(a => 
          a.employeeId === emp.id && isSameMonth(parseISO(a.weekStartDate), now)
        );
        
        detailedData += `Empleado: ${emp.name}\n`;
        detailedData += `Tareas Detalladas:\n${JSON.stringify(empTasks.map(t => ({
          proyecto: safeProjects.find(p => p.id === t.projectId)?.name || 'Sin proyecto',
          horas: t.hoursAssigned,
          estado: t.status, // 'pending', 'completed'
          fecha: t.weekStartDate
        })), null, 2)}\n\n`;
      });
    }

    if (mentionedProjects.length > 0) {
      detailedData += "\n*** DETALLE PROFUNDO DE PROYECTOS MENCIONADOS ***\n";
      mentionedProjects.forEach(proj => {
        const projTasks = safeAllocations.filter(a => a.projectId === proj.id);
        const projCompleted = projTasks.filter(a => a.status === 'completed');
        
        detailedData += `Proyecto: ${proj.name}\n`;
        detailedData += `Estado: ${proj.status}\n`;
        detailedData += `Presupuesto: ${proj.totalBudget}h\n`;
        detailedData += `Consumido: ${projTasks.reduce((acc, t) => acc + (t.status === 'completed' ? (t.hoursActual || t.hoursAssigned) : 0), 0)}h\n`;
        detailedData += `Tareas Pendientes Clave:\n${JSON.stringify(projTasks.filter(t => t.status !== 'completed').slice(0, 5).map(t => ({
          asignado_a: safeEmployees.find(e => e.id === t.employeeId)?.name,
          horas: t.hoursAssigned,
          fecha: t.weekStartDate
        })), null, 2)}\n\n`;
      });
    }

    // 3. DATOS GENERALES (Siempre presentes, pero resumidos)
    const monthAllocations = safeAllocations.filter(a => isSameMonth(parseISO(a.weekStartDate), now));
    const totalCapacity = safeEmployees.filter(e => e.isActive).reduce((sum, e) => sum + e.capacity, 0);
    const totalAssigned = monthAllocations.reduce((sum, a) => sum + a.hoursAssigned, 0);
    
    // Top 5 tareas bloqueadas o pendientes (para dar salseo si no hay preguntas específicas)
    const topPendingTasks = monthAllocations
      .filter(a => a.status !== 'completed')
      .sort((a, b) => b.hoursAssigned - a.hoursAssigned)
      .slice(0, 5)
      .map(t => ({
        tarea: `Asignación de ${t.hoursAssigned}h`,
        responsable: safeEmployees.find(e => e.id === t.employeeId)?.name,
        proyecto: safeProjects.find(p => p.id === t.projectId)?.name
      }));

    return `
DATOS DEL SISTEMA (MES ACTUAL):
- Fecha: ${format(now, "dd/MM/yyyy")}
- Capacidad Total: ${totalCapacity}h | Asignado: ${totalAssigned}h (${((totalAssigned/totalCapacity)*100).toFixed(1)}%)
- Empleados Activos: ${safeEmployees.filter(e => e.isActive).length}
- Proyectos Activos: ${safeProjects.filter(p => p.status === 'active').length}

TOP 5 TAREAS PENDIENTES/ATASCADAS (Úsalas si preguntas por problemas generales):
${JSON.stringify(topPendingTasks, null, 2)}

${detailedData}

AUSENCIAS:
${JSON.stringify(absences?.filter(a => isSameMonth(parseISO(a.startDate), now)).map(a => ({
  empleado: safeEmployees.find(e => e.id === a.employeeId)?.name,
  motivo: a.reason,
  desde: a.startDate,
  hasta: a.endDate
})), null, 2)}
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
      // AQUÍ OCURRE LA MAGIA: Contexto dinámico
      const dataContext = buildDynamicContext(input);
      
      const systemPrompt = `
ACTÚA COMO: Minguito, un Project Manager Senior, sarcástico, mordaz y obsesionado con la eficiencia.
TU MISIÓN: Analizar los datos y responder a la pregunta del usuario con brutal honestidad.

CONTEXTO DE DATOS (JSON):
${dataContext}

INSTRUCCIONES CLAVE:
1. **USA LOS DATOS**: Si en el JSON dice que "Alexander" tiene una tarea pendiente de 5h en "Loro Parque", DILO EXPLÍCITAMENTE. No digas "tiene tareas", di "tiene atascado Loro Parque".
2. **CRITICA**: Si alguien tiene tareas pendientes y se fue de vacaciones, señálalo.
3. **SÉ ESPECÍFICO**: Nombres, proyectos, fechas y horas. Nada de generalidades.
4. **FORMATO**: Usa Markdown. Negritas para nombres (**Nombre**). Listas para enumerar fallos.

PREGUNTA DEL USUARIO: "${input}"
      `;

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
      console.error('Error al generar respuesta:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: '❌ Lo siento, hubo un error al procesar tu consulta. Por favor, intenta de nuevo o reformula tu pregunta.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    setInput(question);
  };

  const clearChat = () => {
    setMessages([
      {
        id: '1',
        role: 'assistant',
        text: 'Que pasa? Soy **Minguito**, y si, tengo acceso a todos vuestros trapos sucios: cargas, bloqueos, chapuzas, proyectos hundidos... Pregunta lo que quieras, pero preparate para la verdad. Quien la esta liando hoy?',
        timestamp: new Date(),
        provider: 'gemini',
        modelName: 'gemini-2.0-flash'
      }
    ]);
  };

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
                {analysisData.employees.length} empleados
              </Badge>
              <Badge variant="outline" className="text-[10px] bg-white">
                {analysisData.projects.length} proyectos
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
                // Obtenemos la configuración de estilo para el modelo si existe
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
                      
                      {/* Footer del mensaje con Providers y Modelos */}
                      <span className="text-[10px] text-muted-foreground mt-1 px-1 flex items-center gap-1.5 flex-wrap">
                        {format(msg.timestamp, 'HH:mm')}
                        
                        {msg.provider && (
                          <>
                            {/* Badge del Proveedor Principal */}
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

                            {/* Badge Específico del Modelo (Solo si es OpenRouter y tenemos info) */}
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
