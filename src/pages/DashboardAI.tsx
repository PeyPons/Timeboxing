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
  BarChart3, UserX, Link, CheckCircle2, XCircle
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
// FUNCIÓN PARA PARSEAR MARKDOWN BÁSICO
// ============================================================
function parseSimpleMarkdown(text: string): React.ReactNode {
  // Dividir por líneas
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
    // Parsear **bold** y *italic*
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let key = 0;
    
    while (remaining.length > 0) {
      // Buscar **bold**
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      if (boldMatch && boldMatch.index !== undefined) {
        if (boldMatch.index > 0) {
          parts.push(<span key={key++}>{remaining.slice(0, boldMatch.index)}</span>);
        }
        parts.push(<strong key={key++} className="font-semibold">{boldMatch[1]}</strong>);
        remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
        continue;
      }
      
      // Si no hay más matches, añadir el resto
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }
    
    return parts.length > 0 ? parts : line;
  };
  
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    
    // Línea vacía
    if (!trimmedLine) {
      flushList();
      elements.push(<br key={`br-${index}`} />);
      return;
    }
    
    // Lista con * o -
    if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ')) {
      listItems.push(trimmedLine.slice(2));
      return;
    }
    
    // Párrafo normal
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
async function callGeminiAPI(prompt: string, apiKey: string): Promise<{ text: string; provider: 'gemini' }> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const result = await model.generateContent(prompt);
  return { text: result.response.text(), provider: 'gemini' };
}

async function callOpenRouterAPI(prompt: string, apiKey: string): Promise<{ text: string; provider: 'openrouter' }> {
  const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
  
  // SOLUCIÓN: En lugar de "auto" (que puede elegir modelos de pago), pasamos una lista separada por comas.
  // OpenRouter intentará el primero, si falla, el segundo, etc. Todos estos son gratuitos.
  const FREE_MODELS_CHAIN = "google/gemini-2.0-flash-exp:free,meta-llama/llama-3.3-70b-instruct:free,microsoft/phi-3-medium-128k-instruct:free";

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.origin,
      "X-Title": "Timeboxing App"
    },
    body: JSON.stringify({
      model: FREE_MODELS_CHAIN, 
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
    return { text: responseData.choices[0].message.content, provider: 'openrouter' };
  } else {
    throw new Error('Respuesta inesperada de OpenRouter API: Estructura incorrecta');
  }
}

async function callCocoAPI(prompt: string): Promise<{ text: string; provider: 'coco' }> {
  const COCO_API_URL = 'https://ws.cocosolution.com/api/ia/?noAuth=true&action=text/generateResume&app=CHATBOT&rol=user&method=POST&';
  
  // Simplificar prompt drásticamente para Coco
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
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Coco API error: ${response.status}`);
  }

  const responseData = await response.json();
  
  if (responseData && responseData.data) {
    // Limpieza AGRESIVA para evitar el output "0h. 0h:"
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
    
    // Si la respuesta sigue siendo basura muy corta (ej: "0h"), lanzar error para que no se muestre
    if (cleanText.length < 5) {
      throw new Error('Respuesta de Coco insuficiente o inválida');
    }

    return { text: cleanText, provider: 'coco' };
  } else {
    throw new Error('Respuesta inesperada de Coco API');
  }
}

async function callAI(prompt: string): Promise<{ text: string; provider: 'gemini' | 'openrouter' | 'coco' }> {
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

export default function DashboardAI() {
  const { employees, allocations, projects, clients, absences, teamEvents, getEmployeeMonthlyLoad, isLoading: dataLoading } = useApp();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      text: 'Que pasa? Soy **Minguito**, y si, tengo acceso a todos vuestros trapos sucios: cargas, bloqueos, chapuzas, proyectos hundidos... Pregunta lo que quieras, pero preparate para la verdad. Quien la esta liando hoy?',
      timestamp: new Date()
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
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    // Proteccion: asegurar que todos los arrays esten inicializados
    const safeEmployees = employees || [];
    const safeAllocations = allocations || [];
    const safeProjects = projects || [];
    const safeClients = clients || [];
    const safeAbsences = absences || [];
    const safeTeamEvents = teamEvents || [];
    
    const activeEmployees = safeEmployees.filter(e => e.isActive);
    const activeProjects = safeProjects.filter(p => p.status === 'active');
    
    // Allocations del mes actual
    const monthAllocations = safeAllocations.filter(a => 
      isSameMonth(parseISO(a.weekStartDate), now)
    );
    
    const completedTasks = monthAllocations.filter(a => a.status === 'completed');
    const pendingTasks = monthAllocations.filter(a => a.status !== 'completed');

    // ==================
    // 1. ANÁLISIS DE CARGA POR EMPLEADO
    // ==================
    const employeeAnalysis = activeEmployees.map(emp => {
      const load = getEmployeeMonthlyLoad(emp.id, now.getFullYear(), now.getMonth());
      const empTasks = monthAllocations.filter(a => a.employeeId === emp.id);
      const empCompleted = empTasks.filter(a => a.status === 'completed');
      const empPending = empTasks.filter(a => a.status !== 'completed');
      
      // Eficiencia: horas reales vs computadas
      const totalReal = empCompleted.reduce((sum, a) => sum + (a.hoursActual || 0), 0);
      const totalComp = empCompleted.reduce((sum, a) => sum + (a.hoursComputed || 0), 0);
      const totalEst = empCompleted.reduce((sum, a) => sum + a.hoursAssigned, 0);
      const efficiency = totalReal > 0 ? ((totalComp - totalReal) / totalReal * 100) : 0;
      
      // Dependencias: ¿bloquea a otros?
      const blocking = empPending.filter(task => 
        safeAllocations.some(other => other.dependencyId === task.id && other.status !== 'completed')
      );
      
      // Dependencias: ¿esperando por otros?
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

    // ==================
    // 2. ANÁLISIS DE PROYECTOS
    // ==================
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

    // ==================
    // 3. MÉTRICAS GLOBALES
    // ==================
    const totalCapacity = activeEmployees.reduce((sum, e) => sum + e.capacity, 0);
    const totalAssigned = monthAllocations.reduce((sum, a) => sum + a.hoursAssigned, 0);
    const utilizationRate = totalCapacity > 0 ? (totalAssigned / totalCapacity * 100) : 0;
    
    const overloadedEmployees = employeeAnalysis.filter(e => e.overloaded);
    const underutilizedEmployees = employeeAnalysis.filter(e => e.underutilized);
    const blockingEmployees = employeeAnalysis.filter(e => e.blocking > 0);

    // ==================
    // 4. AUSENCIAS Y EVENTOS
    // ==================
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
  // HANDLERS
  // ============================================================
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
      // Construir contexto enriquecido
      const context = `
CONTEXTO ACTUAL DEL EQUIPO (${analysisData.month}):

MÉTRICAS GLOBALES:
- Capacidad Total: ${analysisData.metrics.totalCapacity}h
- Horas Asignadas: ${analysisData.metrics.totalAssigned}h
- Tasa de Utilización: ${analysisData.metrics.utilizationRate.toFixed(1)}%
- Tareas Completadas: ${analysisData.metrics.completedTasks}
- Tareas Pendientes: ${analysisData.metrics.pendingTasks}
- Empleados Sobrecargados: ${analysisData.metrics.overloadedCount}
- Empleados Subutilizados: ${analysisData.metrics.underutilizedCount}
- Empleados Bloqueando Tareas: ${analysisData.metrics.blockingCount}

ANÁLISIS POR EMPLEADO:
${(analysisData.employees || []).map(e => `
- ${e.name}:
  * Capacidad: ${e.capacity}h | Asignado: ${e.assigned}h
  * Tareas: ${e.completed} completadas, ${e.pending} pendientes
  * Eficiencia: ${e.efficiency.toFixed(1)}% (Real: ${e.realHours}h vs Computado: ${e.computedHours}h)
  * Bloqueos: ${e.blocking > 0 ? `⚠️ Bloqueando ${e.blocking} tarea(s)` : '✓ Sin bloqueos'}
  * Dependencias: ${e.waitingFor > 0 ? `⏳ Esperando ${e.waitingFor} tarea(s)` : '✓ Sin esperas'}
  * Estado: ${e.overloaded ? '🔴 SOBRECARGADO' : e.underutilized ? '🟡 SUBUTILIZADO' : '🟢 ÓPTIMO'}
`).join('\n')}

ANÁLISIS DE PROYECTOS:
${(analysisData.projects || []).map(p => `
- ${p.name} (Cliente: ${p.client}):
  * Tareas: ${p.completed}/${p.totalTasks} (${p.completion.toFixed(0)}% completado)
  * Horas: ${p.totalReal}h de ${p.totalBudget}h (${p.burnRate.toFixed(1)}% consumido)
  * Estado: ${p.overBudget ? '🔴 SOBRE PRESUPUESTO' : '🟢 DENTRO DE PRESUPUESTO'}
`).join('\n')}

AUSENCIAS DEL MES:
${(analysisData.absences || []).length > 0 ? (analysisData.absences || []).map(a => {
  const emp = (employees || []).find(e => e.id === a.employeeId);
  return `- ${emp?.name}: ${a.reason} (${format(parseISO(a.startDate), 'dd/MM')} - ${format(parseISO(a.endDate), 'dd/MM')})`;
}).join('\n') : '- Sin ausencias registradas'}

EVENTOS DEL MES:
${(analysisData.events || []).length > 0 ? (analysisData.events || []).map(e => 
  `- ${e.name} (${format(parseISO(e.date), 'dd/MM')}): ${(e.attendees || []).length} asistentes`
).join('\n') : '- Sin eventos programados'}

PREGUNTA DEL USUARIO: ${input}

INSTRUCCIONES - PERSONALIDAD DE MINGUITO:
- Eres un Project Manager cabron, sarcastico y sin filtros
- Si alguien esta sobrecargado, dilo con dureza: "En serio le habeis metido 50 horas? Quereis que dimita?"
- Si alguien no tiene tareas, burlate: "Mira, Pepito sin hacer nada otra vez..."
- Usa ironia cuando los datos sean malos: "Solo 3 proyectos sobre presupuesto, que bien vamos"
- Se brutalmente honesto con los problemas
- Usa **negrita** para nombres y datos importantes
- Si todo va bien, di algo como: "Hostia, pues no esta tan mal... que me ocultais?"
- Maximo 3-4 frases, ve al grano
- NO uses emojis
`;

      const response = await callAI(context);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: response.text,
        timestamp: new Date(),
        provider: response.provider
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
        timestamp: new Date()
      }
    ]);
  };

  // ============================================================
  // QUICK STATS (Visualización rápida de métricas)
  // ============================================================
  const quickStats = useMemo(() => {
    const utilization = analysisData.metrics.utilizationRate;
    const balance = analysisData.metrics.totalCapacity - analysisData.metrics.totalAssigned;
    return {
      utilization: isNaN(utilization) ? 0 : utilization,
      balance: isNaN(balance) ? 0 : balance,
    criticalAlerts: analysisData.alerts.critical || 0,
      warningAlerts: analysisData.alerts.warning || 0
    };
  }, [analysisData]);

  // Mostrar loader mientras cargan los datos
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
      {/* Chat principal */}
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
              {messages.map((msg) => (
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
                    <span className="text-[10px] text-muted-foreground mt-1 px-1 flex items-center gap-1.5">
                      {format(msg.timestamp, 'HH:mm')}
                      {msg.provider && (
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[9px] font-medium",
                          msg.provider === 'gemini' 
                            ? "bg-blue-100 text-blue-600" 
                            : msg.provider === 'openrouter'
                            ? "bg-purple-100 text-purple-600"
                            : "bg-orange-100 text-orange-600"
                        )}>
                          {msg.provider === 'gemini' ? '✨ Gemini' : msg.provider === 'openrouter' ? '🟣 OpenRouter' : '🥥 Coco'}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              ))}
              
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

        {/* Sugerencias + Input */}
        <div className="border-t bg-white">
          {/* Preguntas sugeridas */}
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
          
          {/* Input */}
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
