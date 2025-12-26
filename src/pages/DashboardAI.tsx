import { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bot, Send, User, Sparkles, Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { format, startOfMonth, endOfMonth, parseISO, isSameMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  provider?: 'gemini' | 'openrouter' | 'coco';
  isError?: boolean;
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
      messages: [{ role: "user", content: prompt }]
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenRouter API error: ${response.status} - ${JSON.stringify(errorData)}`);
  }

  const responseData = await response.json();
  
  if (responseData?.choices?.[0]?.message?.content) {
    return { text: responseData.choices[0].message.content, provider: 'openrouter' };
  }
  throw new Error('Respuesta inesperada de OpenRouter API');
}

async function callCocoAPI(prompt: string): Promise<{ text: string; provider: 'coco' }> {
  const COCO_API_URL = 'https://ws.cocosolution.com/api/ia/?noAuth=true&action=text/generateResume&app=CHATBOT&rol=user&method=POST&';
  
  // Simplificar el prompt para Coco - no soporta bien markdown
  const simplifiedPrompt = prompt + "\n\nIMPORTANTE: Responde en texto plano sin usar asteriscos, guiones ni formato markdown. Usa frases completas separadas por puntos.";

  const response = await fetch(COCO_API_URL, {
    method: 'POST',
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: simplifiedPrompt,
      noAuth: "true",
      action: "text/generateResume",
      app: "CHATBOT",
      rol: "user",
      method: "POST",
      language: "es",
    }),
  });

  if (!response.ok) throw new Error(`Coco API error: ${response.status}`);
  
  const data = await response.json();
  if (data?.data) {
    // Limpiar respuesta de Coco - quitar formato roto
    let cleanText = data.data
      .replace(/\*\s*\n/g, '') // Quitar asteriscos sueltos con salto de línea
      .replace(/^\*\s*/gm, '• ') // Convertir asteriscos al inicio de línea en bullets
      .replace(/<br\s*\/?>/gi, '\n') // Convertir <br> en saltos de línea
      .replace(/\n{3,}/g, '\n\n') // Máximo 2 saltos de línea consecutivos
      .replace(/•\s*\n•/g, '• ') // Quitar bullets vacíos
      .replace(/•\s*$/gm, '') // Quitar bullets al final de línea sin contenido
      .trim();
    
    return { text: cleanText, provider: 'coco' };
  }
  throw new Error('Respuesta inesperada de Coco API');
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
      content: '¡Hola! Soy **Minguito**, tu Project Manager virtual. Pregúntame sobre disponibilidad, cargas de trabajo o proyectos.',
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
  // CONSTRUIR CONTEXTO DE DATOS
  // ============================================================
  const buildDataContext = () => {
    const safeEmployees = employees || [];
    const safeAllocations = allocations || [];
    const safeProjects = projects || [];
    const safeClients = clients || [];
    const safeAbsences = absences || [];
    const safeTeamEvents = teamEvents || [];

    const now = new Date();
    const activeEmployees = safeEmployees.filter(e => e.isActive);
    const activeProjects = safeProjects.filter(p => p.status === 'active');
    
    const monthAllocations = safeAllocations.filter(a => {
      try {
        return isSameMonth(parseISO(a.weekStartDate), now);
      } catch { return false; }
    });

    // Análisis por empleado
    const employeeAnalysis = activeEmployees.map(emp => {
      try {
        const load = getEmployeeMonthlyLoad(emp.id, now.getFullYear(), now.getMonth());
        const empTasks = monthAllocations.filter(a => a.employeeId === emp.id);
        
        return {
          nombre: emp.name || 'Sin nombre',
          rol: emp.role || 'N/A',
          capacidad: emp.capacity || emp.defaultWeeklyCapacity || 0,
          horasAsignadas: load?.totalAssigned || empTasks.reduce((sum, a) => sum + (a.hoursAssigned || 0), 0),
          tareas: empTasks.length,
          estado: load?.status || 'empty'
        };
      } catch {
        return {
          nombre: emp.name || 'Sin nombre',
          rol: emp.role || 'N/A',
          capacidad: 0,
          horasAsignadas: 0,
          tareas: 0,
          estado: 'empty'
        };
      }
    });

    // Proyectos
    const projectAnalysis = activeProjects.map(proj => {
      const projTasks = monthAllocations.filter(a => a.projectId === proj.id);
      const hoursUsed = projTasks.reduce((sum, a) => sum + (a.hoursAssigned || 0), 0);
      const client = safeClients.find(c => c.id === proj.clientId);
      
      return {
        nombre: proj.name,
        cliente: client?.name || 'Sin cliente',
        presupuesto: proj.budgetHours || 0,
        horasUsadas: hoursUsed
      };
    });

    // Ausencias actuales
    const currentAbsences = safeAbsences.filter(a => {
      try {
        return new Date(a.endDate) >= now;
      } catch { return false; }
    }).map(a => {
      const emp = safeEmployees.find(e => e.id === a.employeeId);
      return {
        empleado: emp?.name || 'Desconocido',
        tipo: a.type || a.reason || 'Ausencia',
        hasta: a.endDate
      };
    });

    return {
      fecha: format(now, "d 'de' MMMM yyyy", { locale: es }),
      mes: format(now, "MMMM yyyy", { locale: es }),
      empleados: employeeAnalysis,
      proyectos: projectAnalysis,
      ausencias: currentAbsences
    };
  };

  // ============================================================
  // HANDLERS
  // ============================================================
  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const dataContext = buildDataContext();

      const prompt = `
Eres Minguito, un Project Manager Senior amigable. Analiza estos datos de la agencia:

DATOS ACTUALES (${dataContext.fecha}):

EMPLEADOS:
${dataContext.empleados.map(e => 
  `- ${e.nombre} (${e.rol}): ${e.horasAsignadas}h asignadas de ${e.capacidad}h capacidad, ${e.tareas} tareas`
).join('\n')}

PROYECTOS ACTIVOS:
${dataContext.proyectos.map(p => 
  `- ${p.nombre} (${p.cliente}): ${p.horasUsadas}h de ${p.presupuesto}h presupuesto`
).join('\n')}

AUSENCIAS ACTUALES:
${dataContext.ausencias.length > 0 
  ? dataContext.ausencias.map(a => `- ${a.empleado}: ${a.tipo} hasta ${a.hasta}`).join('\n')
  : '- Sin ausencias registradas'}

PREGUNTA DEL USUARIO: ${input}

INSTRUCCIONES:
- Sé breve, directo y amigable
- Si preguntan disponibilidad, calcula: Capacidad - Horas Asignadas
- Usa negritas para nombres importantes
- Si todo va bien, reconócelo positivamente
`;

      const response = await callAI(prompt);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.text,
        timestamp: new Date(),
        provider: response.provider
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Error al generar respuesta:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '❌ Lo siento, ha ocurrido un error al procesar tu consulta. Por favor, intenta de nuevo.',
        timestamp: new Date(),
        isError: true
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: '¡Hola! Soy **Minguito**, tu Project Manager virtual. Pregúntame sobre disponibilidad, cargas de trabajo o proyectos.',
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

  // Mostrar loader mientras cargan los datos
  if (dataLoading) {
    return (
      <div className="flex flex-col h-[calc(100vh-2rem)] items-center justify-center">
        <Sparkles className="h-12 w-12 text-indigo-500 animate-pulse mb-4" />
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
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-muted-foreground">
              Sistema Online • {(employees || []).filter(e => e.isActive).length} empleados • {(projects || []).filter(p => p.status === 'active').length} proyectos activos
            </span>
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
                  
                  <div className={cn(
                    "rounded-2xl px-4 py-3 max-w-[85%] text-sm shadow-sm leading-relaxed",
                    msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-br-none' 
                      : msg.isError 
                        ? 'bg-red-50 border border-red-200 text-red-700 rounded-bl-none'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-bl-none'
                  )}>
                    {msg.role === 'user' ? (
                      msg.content
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
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
              
              {/* Mostrar proveedor del último mensaje */}
              {messages.length > 1 && messages[messages.length - 1].role === 'assistant' && messages[messages.length - 1].provider && (
                <div className="flex justify-start pl-11">
                  <span className="text-[10px] text-muted-foreground flex items-center">
                    {format(messages[messages.length - 1].timestamp, 'HH:mm')}
                    {getProviderBadge(messages[messages.length - 1].provider)}
                  </span>
                </div>
              )}
              
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

          {/* Input */}
          <div className="p-4 bg-background border-t">
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
                onClick={handleSendMessage} 
                disabled={isLoading || !input.trim()} 
                className="bg-indigo-600 hover:bg-indigo-700 shadow-md"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
