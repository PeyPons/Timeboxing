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
import { AIService } from "@/services/aiService";
import { ErrorService } from "@/services/errorService";
import { logger } from "@/utils/logger";
import { format, startOfWeek, isBefore, parseISO, isSameMonth, differenceInDays, getDaysInMonth, addDays } from 'date-fns';
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
  { icon: <Target className="w-3 h-3" />, text: "¿Quién suele fallar en sus estimaciones?", category: "fiabilidad" },
  { icon: <AlertTriangle className="w-3 h-3" />, text: "¿Hay dependencias bloqueantes?", category: "dependencias" },
  { icon: <Calendar className="w-3 h-3" />, text: "¿Qué tareas arrastramos de semanas pasadas?", category: "planificacion" },
  { icon: <Zap className="w-3 h-3" />, text: "Dame un resumen ejecutivo de gestión", category: "resumen" },
];

const MODEL_CONFIG: Record<string, { name: string; color: string; border: string; bg: string }> = {
  "google/gemini-2.0-flash": { name: "Gemini Flash 2.0", color: "text-blue-600", border: "border-blue-200", bg: "bg-blue-50" },
  "google/gemini-2.0-flash-exp:free": { name: "Gemini Flash Exp", color: "text-blue-600", border: "border-blue-200", bg: "bg-blue-50" },
  "google/gemma-3-27b-it:free": { name: "Gemma 3 27B", color: "text-sky-600", border: "border-sky-200", bg: "bg-sky-50" },
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
// FUNCIÓN DE LLAMADA A IA (usa servicio centralizado)
// ============================================================
async function callAI(prompt: string): Promise<{ text: string; provider: 'gemini' | 'openrouter' | 'coco'; modelName: string }> {
  return AIService.callWithFallback(prompt, 'DashboardAI');
}

export default function DashboardAI() {
  const { employees, allocations, projects, clients, absences, teamEvents, getEmployeeMonthlyLoad, isLoading: dataLoading } = useApp();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      text: 'Que pasa? Soy **Minguito**, Project Manager. Accedo a los datos para detectar cuellos de botella, tareas zombies y **analizar quién cumple con lo que promete** (fiabilidad).',
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
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
    const currentMonthDays = getDaysInMonth(now);
    const monthProgress = now.getDate() / currentMonthDays;

    const safeEmployees = employees || [];
    const safeAllocations = allocations || [];
    const safeProjects = projects || [];
    const safeAbsences = absences || [];
    
    // Filtros temporales
    const monthAllocations = safeAllocations.filter(a => isSameMonth(parseISO(a.weekStartDate), now));
    
    // 1. DETECCIÓN DE TAREAS ZOMBIE
    const zombieTasks = safeAllocations.filter(a => {
      const taskDate = parseISO(a.weekStartDate);
      return a.status !== 'completed' && isBefore(taskDate, currentWeekStart);
    }).map(t => ({
      tarea: t.taskName || 'Sin nombre',
      empleado: safeEmployees.find(e => e.id === t.employeeId)?.name,
      proyecto: safeProjects.find(p => p.id === t.projectId)?.name,
      semana_origen: t.weekStartDate
    }));

    // 2. DETECCIÓN DE DEPENDENCIAS
    const blockingTasks: any[] = [];
    const pendingTasks = safeAllocations.filter(a => a.status !== 'completed');
    pendingTasks.forEach(waitingTask => {
        if (waitingTask.dependencyId) {
            const blocker = safeAllocations.find(a => a.id === waitingTask.dependencyId);
            if (blocker && blocker.status !== 'completed') {
                blockingTasks.push({
                    ESTADO: "BLOQUEO ACTIVO",
                    bloqueador: {
                        empleado: safeEmployees.find(e => e.id === blocker.employeeId)?.name,
                        tarea: blocker.taskName || "Tarea sin nombre",
                    },
                    esperando: {
                        empleado: safeEmployees.find(e => e.id === waitingTask.employeeId)?.name,
                        tarea: waitingTask.taskName || "Tarea sin nombre",
                    }
                });
            }
        }
    });

    // 3. ANÁLISIS DE PACING (Sin hablar de dinero/ads, solo ritmo de trabajo)
    const projectPacing = safeProjects.filter(p => p.status === 'active' && p.budgetHours > 0).map(p => {
      const projTasks = monthAllocations.filter(a => a.projectId === p.id);
      const hoursExecuted = projTasks.reduce((acc, t) => acc + (t.status === 'completed' ? (t.hoursActual || t.hoursAssigned) : 0), 0);
      const executionPct = hoursExecuted / p.budgetHours;
      let status = "Normal";
      if (monthProgress > 0.8 && executionPct < 0.5) status = "RIESGO DE NO ENTREGA (Lento)";
      if (executionPct > 1) status = "PRESUPUESTO EXCEDIDO";
      if (monthProgress < 0.3 && executionPct > 0.6) status = "CONSUMO ACELERADO";

      if (status !== "Normal") {
        return {
          proyecto: p.name,
          presupuesto: p.budgetHours,
          ejecutado: hoursExecuted.toFixed(1),
          estado: status
        };
      }
      return null;
    }).filter(Boolean);

    // 4. ÍNDICE DE FIABILIDAD (Estimation Accuracy)
    // Calcula la desviación media entre Horas Asignadas y Horas Reales por empleado
    const reliabilityStats: Record<string, { totalTasks: number, totalError: number, bias: number, underEstimations: number, overEstimations: number }> = {};

    const completedTasksWithHours = safeAllocations.filter(a => 
        a.status === 'completed' && 
        a.hoursActual !== undefined && a.hoursActual !== null &&
        a.hoursAssigned > 0
    );

    completedTasksWithHours.forEach(t => {
        const empId = t.employeeId;
        if (!reliabilityStats[empId]) {
            reliabilityStats[empId] = { totalTasks: 0, totalError: 0, bias: 0, underEstimations: 0, overEstimations: 0 };
        }
        
        const diff = (t.hoursActual || 0) - t.hoursAssigned; // + si tardó más, - si tardó menos
        const absDiff = Math.abs(diff);
        
        reliabilityStats[empId].totalTasks++;
        reliabilityStats[empId].totalError += absDiff;
        reliabilityStats[empId].bias += diff;

        // Tolerancia de 0.5h
        if (diff > 0.5) reliabilityStats[empId].underEstimations++; 
        if (diff < -0.5) reliabilityStats[empId].overEstimations++;
    });

    const reliabilityReport = Object.entries(reliabilityStats).map(([empId, stats]) => {
        const empName = safeEmployees.find(e => e.id === empId)?.name || 'Unknown';
        const avgError = (stats.totalError / stats.totalTasks).toFixed(1);
        const avgBias = (stats.bias / stats.totalTasks).toFixed(1);
        
        let tendency = "Preciso";
        if (Number(avgBias) > 0.5) tendency = "Tendencia a SUBESTIMAR (Tarda más de lo planeado)";
        if (Number(avgBias) < -0.5) tendency = "Tendencia a SOBREESTIMAR (Infla tiempos)";

        // Solo mostramos reporte si hay suficientes datos (mínimo 3 tareas)
        if (stats.totalTasks < 3) return null;

        return {
            empleado: empName,
            tareas_analizadas: stats.totalTasks,
            desviacion_media: avgError + "h",
            comportamiento: tendency,
            tareas_retrasadas: stats.underEstimations
        };
    }).filter(Boolean);

    // 5. CONFLICTOS DE VACACIONES
    const vacationConflicts: any[] = [];
    safeEmployees.forEach(emp => {
      const empAbsences = safeAbsences.filter(a => a.employeeId === emp.id);
      const empTasks = safeAllocations.filter(a => a.employeeId === emp.id && a.status !== 'completed');
      empTasks.forEach(task => {
        const taskWeekStart = parseISO(task.weekStartDate);
        const taskWeekEnd = addDays(taskWeekStart, 5); 
        const conflict = empAbsences.find(abs => {
          const absStart = parseISO(abs.startDate);
          const absEnd = parseISO(abs.endDate);
          return (taskWeekStart <= absEnd && taskWeekEnd >= absStart);
        });
        if (conflict) {
          vacationConflicts.push({
            empleado: emp.name,
            tarea: task.taskName,
            semana: task.weekStartDate,
            vacaciones: `${conflict.startDate} a ${conflict.endDate}`
          });
        }
      });
    });

    // 6. DATOS ESPECÍFICOS DE LA PREGUNTA
    const lowerQ = userQuestion.toLowerCase();
    const mentionedEmployees = safeEmployees.filter(e => lowerQ.includes(e.name.toLowerCase()));
    
    let specificContext = "";
    if (mentionedEmployees.length > 0) {
      specificContext = "\n*** DATOS DE EMPLEADOS MENCIONADOS ***\n";
      mentionedEmployees.forEach(emp => {
        const capacity = Number(emp.defaultWeeklyCapacity) || 0;
        const empTasks = monthAllocations.filter(a => a.employeeId === emp.id);
        const assigned = empTasks.reduce((sum, t) => sum + t.hoursAssigned, 0);
        specificContext += `Empleado: ${emp.name} | Capacidad: ${capacity}h | Asignado Mes: ${assigned}h\n`;
        const isOnVacation = safeAbsences.some(a => {
            const start = parseISO(a.startDate);
            const end = parseISO(a.endDate);
            return a.employeeId === emp.id && now >= start && now <= end;
        });
        if (isOnVacation) specificContext += "⚠️ ESTADO ACTUAL: DE VACACIONES HOY\n";
      });
    }

    const totalCapacity = safeEmployees.filter(e => e.isActive).reduce((sum, e) => sum + (Number(e.defaultWeeklyCapacity) || 0), 0);
    const totalAssigned = monthAllocations.reduce((sum, a) => sum + a.hoursAssigned, 0);

    return `
REPORTE DE GESTIÓN (MINGUITO AI):
Fecha: ${format(now, "dd/MM/yyyy")}
Capacidad semanal equipo: ${totalCapacity}h | Total asignado mes: ${totalAssigned}h

🎯 ÍNDICE DE FIABILIDAD (Precisión en estimaciones):
${reliabilityReport.length > 0 ? JSON.stringify(reliabilityReport, null, 2) : "Faltan datos de horas reales para calcular fiabilidad."}

🚨 BLOQUEOS:
${blockingTasks.length > 0 ? JSON.stringify(blockingTasks, null, 2) : "Sin bloqueos."}

🧟 TAREAS ZOMBIE:
${zombieTasks.length > 0 ? JSON.stringify(zombieTasks.slice(0, 5), null, 2) : "Al día."}

🏝️ CONFLICTOS VACACIONALES:
${vacationConflicts.length > 0 ? JSON.stringify(vacationConflicts, null, 2) : "Ok."}

📊 PACING PROYECTOS:
${projectPacing.length > 0 ? JSON.stringify(projectPacing, null, 2) : "Ok."}

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
ACTÚA COMO: Minguito, un Project Manager Senior, sarcástico pero analítico.
TU OBJETIVO: Detectar ineficiencias y problemas de planificación.

CONTEXTO DE DATOS (JSON):
${dataContext}

INSTRUCCIONES CLAVE:
1. **FIABILIDAD**: Mira el "ÍNDICE DE FIABILIDAD". Si alguien tiene tendencia a "Subestimar" (tardar más), avisa que sus planes son poco creíbles. Si "Sobreestima", está inflando presupuestos.
2. **TAREAS ZOMBIE**: Critica las tareas viejas no cerradas.
3. **PACING**: Avisa si un proyecto va muy lento o consume recursos demasiado rápido.
4. **VACACIONES**: Alerta roja si asignan tareas a gente ausente.

FORMATO: Markdown limpio. Negritas para nombres. Sé conciso.

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
      ErrorService.handle(error, 'DashboardAI.handleSend');
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
