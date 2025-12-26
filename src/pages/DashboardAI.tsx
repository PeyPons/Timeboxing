import { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Send, Bot, User, Sparkles, Trash2, TrendingUp, TrendingDown, 
  AlertTriangle, Users, Calendar, Target, Clock, Zap, HelpCircle,
  BarChart3, UserX, Link, CheckCircle2, XCircle, Loader2
} from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { format, startOfMonth, endOfMonth, parseISO, isSameMonth, differenceInDays, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  provider?: 'gemini' | 'openrouter' | 'coco';
  isError?: boolean;
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
  
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.origin,
      "X-Title": "Timeboxing App"
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-exp:free",
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
    throw new Error('Respuesta inesperada de OpenRouter API');
  }
}

async function callCocoAPI(prompt: string): Promise<{ text: string; provider: 'coco' }> {
  const COCO_API_URL = 'https://ws.cocosolution.com/api/ia/?noAuth=true&action=text/generateResume&app=CHATBOT&rol=user&method=POST&';
  
  // Simplificar el prompt para Coco - no soporta bien markdown
  const simplifiedPrompt = prompt + "\n\nIMPORTANTE: Responde en texto plano sin usar asteriscos, guiones ni formato markdown. Usa frases completas separadas por puntos.";
  
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
    // Limpiar respuesta de Coco - quitar formato roto
    let cleanText = responseData.data
      .replace(/\*\s*\n/g, '') // Quitar asteriscos sueltos con salto de línea
      .replace(/^\*\s*/gm, '• ') // Convertir asteriscos al inicio de línea en bullets
      .replace(/<br\s*\/?>/gi, '\n') // Convertir <br> en saltos de línea
      .replace(/\n{3,}/g, '\n\n') // Máximo 2 saltos de línea consecutivos
      .replace(/•\s*\n•/g, '• ') // Quitar bullets vacíos
      .replace(/•\s*$/gm, '') // Quitar bullets al final de línea sin contenido
      .replace(/•\s*%/g, '%') // Quitar bullets antes de porcentajes
      .replace(/\n•\s*\n/g, '\n') // Quitar líneas que solo tienen bullet
      .trim();
    
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
      text: '¡Hola! Soy **Minguito**, tu Project Manager virtual. Tengo acceso a todo: cargas, dependencias, presupuestos, eficiencia... Pregúntame lo que quieras o usa las sugerencias de abajo. ¿Por dónde empezamos?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // ============================================================
  // CEREBRO DE MINGUITO: Análisis completo de datos
  // ============================================================
  const analysisData = useMemo(() => {
    // Protección: asegurar que todos los arrays estén inicializados
    const safeEmployees = employees || [];
    const safeAllocations = allocations || [];
    const safeProjects = projects || [];
    const safeClients = clients || [];
    const safeAbsences = absences || [];
    const safeTeamEvents = teamEvents || [];

    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const activeEmployees = safeEmployees.filter(e => e.isActive);
    const activeProjects = safeProjects.filter(p => p.status === 'active');
    
    // Allocations del mes actual
    const monthAllocations = safeAllocations.filter(a => {
      try {
        return isSameMonth(parseISO(a.weekStartDate), now);
      } catch {
        return false;
      }
    });
    
    const completedTasks = monthAllocations.filter(a => a.status === 'completed');
    const pendingTasks = monthAllocations.filter(a => a.status !== 'completed');

    // ==================
    // 1. ANÁLISIS DE CARGA POR EMPLEADO
    // ==================
    const employeeAnalysis = activeEmployees.map(emp => {
      try {
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
          name: emp.name || 'Sin nombre',
          capacity: emp.capacity || emp.defaultWeeklyCapacity || 0,
          assigned: load?.totalAssigned || 0,
          completed: empCompleted.length,
          pending: empPending.length,
          realHours: totalReal,
          computedHours: totalComp,
          estimatedHours: totalEst,
          efficiency: isNaN(efficiency) ? 0 : efficiency,
          blocking: blocking.length,
          waitingFor: waitingFor.length,
          overloaded: (load?.totalAssigned || 0) > (emp.capacity || emp.defaultWeeklyCapacity || 0),
          underutilized: (load?.totalAssigned || 0) < (emp.capacity || emp.defaultWeeklyCapacity || 0) * 0.7
        };
      } catch (error) {
        console.error(`Error analyzing employee ${emp.id}:`, error);
        return {
          id: emp.id,
          name: emp.name || 'Sin nombre',
          capacity: emp.capacity || emp.defaultWeeklyCapacity || 0,
          assigned: 0,
          completed: 0,
          pending: 0,
          realHours: 0,
          computedHours: 0,
          estimatedHours: 0,
          efficiency: 0,
          blocking: 0,
          waitingFor: 0,
          overloaded: false,
          underutilized: false
        };
      }
    });

    // ==================
    // 2. ANÁLISIS DE PROYECTOS
    // ==================
    const projectAnalysis = activeProjects.map(proj => {
      try {
        const projTasks = monthAllocations.filter(a => a.projectId === proj.id);
        const projCompleted = projTasks.filter(a => a.status === 'completed');
        const projPending = projTasks.filter(a => a.status !== 'completed');
        
        const totalAssigned = projTasks.reduce((sum, a) => sum + (a.hoursAssigned || 0), 0);
        const totalReal = projCompleted.reduce((sum, a) => sum + (a.hoursActual || 0), 0);
        const totalBudget = proj.totalBudget || proj.budgetHours || 0;
        
        const burnRate = totalBudget > 0 ? (totalReal / totalBudget * 100) : 0;

        return {
          id: proj.id,
          name: proj.name || 'Sin nombre',
          client: safeClients.find(c => c.id === proj.clientId)?.name || 'Sin cliente',
          totalTasks: projTasks.length,
          completed: projCompleted.length,
          pending: projPending.length,
          totalAssigned,
          totalReal,
          totalBudget,
          burnRate: isNaN(burnRate) ? 0 : burnRate,
          overBudget: totalReal > totalBudget,
          completion: projTasks.length > 0 ? (projCompleted.length / projTasks.length * 100) : 0
        };
      } catch (error) {
        console.error(`Error analyzing project ${proj.id}:`, error);
        return {
          id: proj.id,
          name: proj.name || 'Sin nombre',
          client: 'Sin cliente',
          totalTasks: 0,
          completed: 0,
          pending: 0,
          totalAssigned: 0,
          totalReal: 0,
          totalBudget: 0,
          burnRate: 0,
          overBudget: false,
          completion: 0
        };
      }
    });

    // ==================
    // 3. MÉTRICAS GLOBALES
    // ==================
    const totalCapacity = activeEmployees.reduce((sum, e) => sum + (e.capacity || e.defaultWeeklyCapacity || 0), 0);
    const totalAssigned = monthAllocations.reduce((sum, a) => sum + (a.hoursAssigned || 0), 0);
    const utilizationRate = totalCapacity > 0 ? (totalAssigned / totalCapacity * 100) : 0;
    
    const overloadedEmployees = employeeAnalysis.filter(e => e.overloaded);
    const underutilizedEmployees = employeeAnalysis.filter(e => e.underutilized);
    const blockingEmployees = employeeAnalysis.filter(e => e.blocking > 0);

    // ==================
    // 4. AUSENCIAS Y EVENTOS
    // ==================
    const monthAbsences = safeAbsences.filter(a => {
      try {
        return isSameMonth(parseISO(a.startDate), now) || isSameMonth(parseISO(a.endDate), now);
      } catch {
        return false;
      }
    });
    
    const monthEvents = safeTeamEvents.filter(e => {
      try {
        return isSameMonth(parseISO(e.date), now);
      } catch {
        return false;
      }
    });

    return {
      month: format(now, "MMMM yyyy", { locale: es }),
      employees: employeeAnalysis,
      projects: projectAnalysis,
      metrics: {
        totalCapacity: isNaN(totalCapacity) ? 0 : totalCapacity,
        totalAssigned: isNaN(totalAssigned) ? 0 : totalAssigned,
        utilizationRate: isNaN(utilizationRate) ? 0 : utilizationRate,
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
  try {
    return `- ${emp?.name || 'Desconocido'}: ${a.reason || a.type || 'Sin motivo'} (${format(parseISO(a.startDate), 'dd/MM')} - ${format(parseISO(a.endDate), 'dd/MM')})`;
  } catch {
    return `- ${emp?.name || 'Desconocido'}: ${a.reason || a.type || 'Sin motivo'}`;
  }
}).join('\n') : '- Sin ausencias registradas'}

EVENTOS DEL MES:
${(analysisData.events || []).length > 0 ? (analysisData.events || []).map(e => {
  try {
    const attendeesCount = (e.attendees || []).length;
    return `- ${e.name || 'Evento'} (${format(parseISO(e.date), 'dd/MM')}): ${attendeesCount} asistentes`;
  } catch {
    return `- ${e.name || 'Evento'}: Sin fecha`;
  }
}).join('\n') : '- Sin eventos programados'}

PREGUNTA DEL USUARIO: ${input}

INSTRUCCIONES:
- Responde de forma directa y concisa
- Usa datos específicos del contexto
- Usa formato Markdown para énfasis (**negrita**)
- Sé profesional pero cercano
- Si detectas problemas críticos, menciónalos con prioridad
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
        timestamp: new Date(),
        isError: true
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    setInput(question);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: '1',
        role: 'assistant',
        text: '¡Hola! Soy **Minguito**, tu Project Manager virtual. Tengo acceso a todo: cargas, dependencias, presupuestos, eficiencia... Pregúntame lo que quieras o usa las sugerencias de abajo. ¿Por dónde empezamos?',
        timestamp: new Date()
      }
    ]);
  };

  // Helper para badge del proveedor
  const getProviderBadge = (provider?: string) => {
    if (!provider) return null;
    
    const config: Record<string, { label: string; className: string }> = {
      gemini: { label: '✨ Gemini', className: 'bg-blue-100 text-blue-600' },
      openrouter: { label: '🟣 OpenRouter', className: 'bg-purple-100 text-purple-600' },
      coco: { label: '🥥 Coco', className: 'bg-orange-100 text-orange-600' }
    };
    
    const { label, className } = config[provider] || { label: provider, className: 'bg-gray-100 text-gray-600' };
    return (
      <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-medium ml-2", className)}>
        {label}
      </span>
    );
  };

  // Mostrar loader mientras los datos cargan
  if (dataLoading) {
    return (
      <div className="flex flex-col h-[calc(100vh-2rem)] gap-4 p-4 md:p-8 max-w-5xl mx-auto w-full items-center justify-center">
        <Sparkles className="h-12 w-12 text-indigo-500 animate-pulse" />
        <p className="text-muted-foreground">Cargando datos...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] gap-4 p-4 md:p-8 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-indigo-500" />
            Copiloto IA
          </h1>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearChat}
            className="text-muted-foreground hover:text-red-500"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Limpiar chat
          </Button>
        </div>
        <p className="text-muted-foreground">
          Tu Project Manager virtual. Pregunta sobre disponibilidad, cargas o proyectos.
        </p>
      </div>

      {/* Chat Card */}
      <Card className="flex-1 flex flex-col overflow-hidden shadow-lg border-indigo-100 dark:border-indigo-900/50">
        <CardHeader className="bg-muted/30 border-b pb-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium text-muted-foreground">
                Sistema Online • {analysisData.month}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] bg-white">
                {(analysisData.employees || []).length} empleados
              </Badge>
              <Badge variant="outline" className="text-[10px] bg-white">
                {(analysisData.projects || []).length} proyectos
              </Badge>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden bg-slate-50/50 dark:bg-slate-950/50">
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4 max-w-3xl mx-auto">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <Avatar className={`h-8 w-8 mt-1 border shrink-0 ${msg.isError ? 'border-red-200 bg-red-50' : 'border-indigo-200 bg-white'}`}>
                      {msg.isError ? (
                        <AlertTriangle className="h-5 w-5 text-red-500 m-1.5" />
                      ) : (
                        <AvatarFallback className="bg-indigo-50 text-indigo-600">
                          <Bot className="h-5 w-5" />
                        </AvatarFallback>
                      )}
                    </Avatar>
                  )}
                  
                  <div className="flex flex-col max-w-[85%]">
                    <div className={cn(
                      "rounded-2xl px-4 py-3 text-sm shadow-sm leading-relaxed",
                      msg.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-br-none' 
                        : msg.isError 
                          ? 'bg-red-50 border border-red-200 text-red-700 rounded-bl-none'
                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-bl-none'
                    )}>
                      {msg.role === 'user' ? (
                        msg.text
                      ) : (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown>{msg.text}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                    {msg.role === 'assistant' && (
                      <span className="text-[10px] text-muted-foreground mt-1 px-1 flex items-center">
                        {format(msg.timestamp, 'HH:mm')}
                        {getProviderBadge(msg.provider)}
                      </span>
                    )}
                  </div>
                  
                  {msg.role === 'user' && (
                    <Avatar className="h-8 w-8 mt-1 border border-slate-200 bg-white shrink-0">
                      <AvatarFallback className="bg-slate-50 text-slate-600">
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <Avatar className="h-8 w-8 mt-1 border border-indigo-200 bg-white">
                    <AvatarFallback className="bg-indigo-50">
                      <Sparkles className="h-4 w-4 animate-pulse text-indigo-400" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 px-4 py-3 rounded-2xl rounded-bl-none flex items-center gap-2 text-sm text-muted-foreground shadow-sm">
                    <Loader2 className="h-3 w-3 animate-spin text-indigo-500" /> 
                    Analizando datos de la agencia...
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Sugerencias + Input */}
          <div className="border-t bg-background">
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
              <div className="max-w-3xl mx-auto flex gap-3">
                <Input 
                  placeholder="Ej: ¿Quién tiene disponibilidad esta semana?..." 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 shadow-sm border-indigo-200 focus-visible:ring-indigo-500"
                  disabled={isLoading}
                  autoFocus
                />
                <Button 
                  onClick={handleSend} 
                  disabled={isLoading || !input.trim()} 
                  className="bg-indigo-600 hover:bg-indigo-700 shadow-md"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
