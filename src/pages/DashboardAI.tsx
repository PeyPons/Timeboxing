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
  provider?: 'gemini' | 'coco';
}

// Preguntas sugeridas para guiar al usuario
const SUGGESTED_QUESTIONS = [
  { icon: <Users className="w-3 h-3" />, text: "¿Cómo está la carga del equipo?", category: "carga" },
  { icon: <AlertTriangle className="w-3 h-3" />, text: "¿Hay alguien bloqueando tareas?", category: "dependencias" },
  { icon: <TrendingDown className="w-3 h-3" />, text: "¿Quién se ha pasado de horas este mes?", category: "eficiencia" },
  { icon: <Target className="w-3 h-3" />, text: "¿Qué proyectos van mal de presupuesto?", category: "proyectos" },
  { icon: <Calendar className="w-3 h-3" />, text: "¿Hay empleados sin tareas planificadas?", category: "planificacion" },
  { icon: <Zap className="w-3 h-3" />, text: "Dame un resumen ejecutivo del mes", category: "resumen" },
];

// ============================================================
// SISTEMA DE IA CON FALLBACK
// ============================================================
async function callGeminiAPI(prompt: string, apiKey: string): Promise<{ text: string; provider: 'gemini' }> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const result = await model.generateContent(prompt);
  return { text: result.response.text(), provider: 'gemini' };
}

async function callCocoAPI(prompt: string): Promise<{ text: string; provider: 'coco' }> {
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
  
  if (responseData && responseData.data) {
    return { text: responseData.data, provider: 'coco' };
  } else {
    throw new Error('Respuesta inesperada de Coco API');
  }
}

async function callAI(prompt: string, geminiApiKey?: string): Promise<{ text: string; provider: 'gemini' | 'coco' }> {
  // Intentar primero con Gemini si hay API key
  if (geminiApiKey) {
    try {
      return await callGeminiAPI(prompt, geminiApiKey);
    } catch (error: any) {
      console.warn('Gemini falló, usando Coco como fallback:', error.message);
      // Si es error de quota, usar fallback
      if (error.message?.includes('429') || error.message?.includes('quota')) {
        return await callCocoAPI(prompt);
      }
      // Para otros errores, también intentar fallback
      try {
        return await callCocoAPI(prompt);
      } catch {
        throw error; // Si ambos fallan, lanzar el error original de Gemini
      }
    }
  }
  
  // Si no hay API key de Gemini, usar Coco directamente
  return await callCocoAPI(prompt);
}

export default function DashboardAI() {
  const { employees, allocations, projects, clients, absences, teamEvents, getEmployeeMonthlyLoad } = useApp();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      text: '¡Ey! Soy Minguito, tu analista de cabecera. Tengo acceso a todo: cargas, dependencias, presupuestos, eficiencia... Pregúntame lo que quieras o usa las sugerencias de abajo. ¿Por dónde empezamos?',
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
    const activeEmployees = employees.filter(e => e.isActive);
    const activeProjects = projects.filter(p => p.status === 'active');
    
    // Allocations del mes actual
    const monthAllocations = allocations.filter(a => 
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
        allocations.some(other => other.dependencyId === task.id && other.status !== 'completed')
      );
      
      // Dependencias: ¿esperando por otros?
      const waitingFor = empPending.filter(task => {
        if (!task.dependencyId) return false;
        const dep = allocations.find(a => a.id === task.dependencyId);
        return dep && dep.status !== 'completed';
      });

      return {
        id: emp.id,
        name: emp.name,
        department: emp.department || 'Sin departamento',
        load: {
          hours: load.hours,
          capacity: load.capacity,
          percentage: load.percentage,
          status: load.status
        },
        tasks: {
          total: empTasks.length,
          completed: empCompleted.length,
          pending: empPending.length
        },
        efficiency: {
          hoursReal: Math.round(totalReal * 10) / 10,
          hoursComputed: Math.round(totalComp * 10) / 10,
          hoursEstimated: Math.round(totalEst * 10) / 10,
          balance: Math.round((totalComp - totalReal) * 10) / 10,
          percentageGain: Math.round(efficiency)
        },
        dependencies: {
          blocking: blocking.map(t => ({ 
            taskName: t.taskName || 'Sin nombre',
            blockedUsers: allocations
              .filter(o => o.dependencyId === t.id && o.status !== 'completed')
              .map(o => employees.find(e => e.id === o.employeeId)?.name || 'Desconocido')
          })),
          waitingFor: waitingFor.map(t => {
            const dep = allocations.find(a => a.id === t.dependencyId);
            const owner = employees.find(e => e.id === dep?.employeeId);
            return { taskName: t.taskName || 'Sin nombre', waitingForUser: owner?.name || 'Desconocido' };
          })
        }
      };
    });

    // ==================
    // 2. ANÁLISIS DE PROYECTOS
    // ==================
    const projectAnalysis = activeProjects.map(proj => {
      const client = clients.find(c => c.id === proj.clientId);
      const projTasks = monthAllocations.filter(a => a.projectId === proj.id);
      const projCompleted = projTasks.filter(a => a.status === 'completed');
      
      const hoursUsed = projTasks.reduce((sum, a) => {
        if (a.status === 'completed') {
          return sum + (a.hoursActual || a.hoursAssigned);
        }
        return sum + a.hoursAssigned;
      }, 0);
      
      const hoursCompleted = projCompleted.reduce((sum, a) => sum + (a.hoursActual || a.hoursAssigned), 0);
      const budgetPercentage = proj.budgetHours > 0 ? (hoursUsed / proj.budgetHours * 100) : 0;
      
      // Empleados asignados
      const assignedEmployees = [...new Set(projTasks.map(t => t.employeeId))]
        .map(id => employees.find(e => e.id === id)?.name || 'Desconocido');

      return {
        id: proj.id,
        name: proj.name,
        clientName: client?.name || 'Sin cliente',
        budget: proj.budgetHours,
        hoursUsed: Math.round(hoursUsed * 10) / 10,
        hoursCompleted: Math.round(hoursCompleted * 10) / 10,
        budgetPercentage: Math.round(budgetPercentage),
        isOverBudget: budgetPercentage > 100,
        isAtRisk: budgetPercentage > 80 && budgetPercentage <= 100,
        tasksCount: projTasks.length,
        completedCount: projCompleted.length,
        assignedEmployees
      };
    });

    // ==================
    // 3. MÉTRICAS GLOBALES
    // ==================
    const globalMetrics = {
      // Eficiencia global
      totalHoursReal: Math.round(completedTasks.reduce((s, a) => s + (a.hoursActual || 0), 0) * 10) / 10,
      totalHoursComputed: Math.round(completedTasks.reduce((s, a) => s + (a.hoursComputed || 0), 0) * 10) / 10,
      totalHoursEstimated: Math.round(completedTasks.reduce((s, a) => s + a.hoursAssigned, 0) * 10) / 10,
      
      // Tareas
      totalTasks: monthAllocations.length,
      completedTasks: completedTasks.length,
      pendingTasks: pendingTasks.length,
      
      // Dependencias problemáticas
      totalBlockingTasks: employeeAnalysis.reduce((s, e) => s + e.dependencies.blocking.length, 0),
      totalWaitingTasks: employeeAnalysis.reduce((s, e) => s + e.dependencies.waitingFor.length, 0),
      
      // Carga
      overloadedEmployees: employeeAnalysis.filter(e => e.load.status === 'overload').map(e => e.name),
      underloadedEmployees: employeeAnalysis.filter(e => e.load.percentage < 50 && e.load.percentage > 0).map(e => e.name),
      emptyEmployees: employeeAnalysis.filter(e => e.tasks.total === 0).map(e => e.name),
      
      // Proyectos
      overBudgetProjects: projectAnalysis.filter(p => p.isOverBudget).map(p => ({ name: p.name, percentage: p.budgetPercentage })),
      atRiskProjects: projectAnalysis.filter(p => p.isAtRisk).map(p => ({ name: p.name, percentage: p.budgetPercentage })),
      
      // Eventos del mes
      teamEventsCount: teamEvents.filter(te => isSameMonth(parseISO(te.date), now)).length
    };

    // Balance global
    const globalBalance = globalMetrics.totalHoursComputed - globalMetrics.totalHoursReal;

    // ==================
    // 4. ALERTAS AUTOMÁTICAS
    // ==================
    const alerts: { type: 'critical' | 'warning' | 'info', message: string }[] = [];
    
    if (globalMetrics.totalBlockingTasks > 0) {
      alerts.push({ type: 'critical', message: `Hay ${globalMetrics.totalBlockingTasks} tarea(s) bloqueando a otros compañeros` });
    }
    if (globalMetrics.overloadedEmployees.length > 0) {
      alerts.push({ type: 'warning', message: `${globalMetrics.overloadedEmployees.length} empleado(s) sobrecargado(s): ${globalMetrics.overloadedEmployees.join(', ')}` });
    }
    if (globalMetrics.emptyEmployees.length > 0) {
      alerts.push({ type: 'info', message: `${globalMetrics.emptyEmployees.length} empleado(s) sin tareas: ${globalMetrics.emptyEmployees.join(', ')}` });
    }
    if (globalMetrics.overBudgetProjects.length > 0) {
      alerts.push({ type: 'critical', message: `${globalMetrics.overBudgetProjects.length} proyecto(s) por encima del presupuesto` });
    }
    if (globalBalance < -10) {
      alerts.push({ type: 'warning', message: `Balance negativo de ${Math.abs(globalBalance).toFixed(1)}h este mes` });
    }

    return {
      month: format(now, 'MMMM yyyy', { locale: es }),
      employees: employeeAnalysis,
      projects: projectAnalysis,
      global: globalMetrics,
      globalBalance: Math.round(globalBalance * 10) / 10,
      alerts
    };
  }, [employees, allocations, projects, clients, absences, teamEvents, getEmployeeMonthlyLoad]);

  // ============================================================
  // MANEJO DEL CHAT
  // ============================================================
  const handleSend = async (customInput?: string) => {
    const messageText = customInput || input;
    if (!messageText.trim()) return;

    const userMsg: Message = { 
      id: crypto.randomUUID(), 
      role: 'user', 
      text: messageText, 
      timestamp: new Date() 
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Construir el contexto completo para Minguito
      const contextPrompt = `
Eres Minguito, el analista de gestión de una agencia digital. 

PERSONALIDAD:
- Eres directo, cercano y un poco brusco pero siempre con cariño
- Usas expresiones coloquiales españolas ("ojo", "cuidadín", "menudo marrón", "crack", "tela marinera")
- Nunca usas emojis excesivos, máximo 1-2 por respuesta
- Eres constructivo: cuando señalas problemas, sugieres soluciones
- No te enrollas: respuestas concisas pero útiles (máximo 4-5 frases)

DATOS DEL MES (${analysisData.month}):

📊 MÉTRICAS GLOBALES:
- Tareas totales: ${analysisData.global.totalTasks} (${analysisData.global.completedTasks} completadas, ${analysisData.global.pendingTasks} pendientes)
- Horas estimadas: ${analysisData.global.totalHoursEstimated}h
- Horas reales trabajadas: ${analysisData.global.totalHoursReal}h  
- Horas computadas/facturables: ${analysisData.global.totalHoursComputed}h
- BALANCE: ${analysisData.globalBalance}h (${analysisData.globalBalance >= 0 ? 'POSITIVO ✓' : 'NEGATIVO ✗'})

⚠️ ALERTAS ACTIVAS:
${analysisData.alerts.length > 0 ? analysisData.alerts.map(a => `- [${a.type.toUpperCase()}] ${a.message}`).join('\n') : '- Sin alertas críticas'}

👥 ANÁLISIS POR EMPLEADO:
${analysisData.employees.map(e => `
${e.name} (${e.department}):
  - Carga: ${e.load.hours}h / ${e.load.capacity}h (${e.load.percentage}%) - Estado: ${e.load.status}
  - Tareas: ${e.tasks.completed}/${e.tasks.total} completadas
  - Eficiencia: ${e.efficiency.hoursReal}h reales → ${e.efficiency.hoursComputed}h computadas (${e.efficiency.balance >= 0 ? '+' : ''}${e.efficiency.balance}h)
  - Bloquea a: ${e.dependencies.blocking.length > 0 ? e.dependencies.blocking.map(b => `"${b.taskName}" → ${b.blockedUsers.join(', ')}`).join('; ') : 'Nadie'}
  - Espera por: ${e.dependencies.waitingFor.length > 0 ? e.dependencies.waitingFor.map(w => `"${w.taskName}" de ${w.waitingForUser}`).join('; ') : 'Nadie'}
`).join('')}

📁 ANÁLISIS POR PROYECTO (activos):
${analysisData.projects.slice(0, 15).map(p => `
${p.name} [${p.clientName}]:
  - Presupuesto: ${p.hoursUsed}h / ${p.budget}h (${p.budgetPercentage}%) ${p.isOverBudget ? '⚠️ EXCEDIDO' : p.isAtRisk ? '⚠️ EN RIESGO' : '✓'}
  - Tareas: ${p.completedCount}/${p.tasksCount} completadas
  - Equipo: ${p.assignedEmployees.join(', ') || 'Sin asignar'}
`).join('')}
${analysisData.projects.length > 15 ? `\n... y ${analysisData.projects.length - 15} proyectos más` : ''}

PREGUNTA DEL USUARIO: "${messageText}"

Responde basándote en los datos reales. Si el usuario pregunta algo que no está en los datos, dilo claramente.
`;

      // Usar el sistema de fallback: Gemini primero, Coco si falla
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const { text: responseText, provider } = await callAI(contextPrompt, apiKey);

      setMessages(prev => [...prev, { 
        id: crypto.randomUUID(), 
        role: 'assistant', 
        text: responseText, 
        timestamp: new Date(),
        provider
      }]);
    } catch (error) {
      console.error('Error Minguito:', error);
      setMessages(prev => [...prev, { 
        id: crypto.randomUUID(), 
        role: 'assistant', 
        text: 'Uf, me he quedado frito. Ni Gemini ni la API de respaldo han funcionado. Inténtalo de nuevo en un momento.', 
        timestamp: new Date() 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    handleSend(question);
  };

  const clearChat = () => {
    setMessages([{
      id: crypto.randomUUID(),
      role: 'assistant',
      text: 'Chat limpio. ¿En qué te puedo ayudar?',
      timestamp: new Date()
    }]);
  };

  // Resumen rápido de estado (sin IA)
  const quickStats = useMemo(() => {
    const { global, globalBalance, alerts } = analysisData;
    return {
      tasksCompletion: global.totalTasks > 0 
        ? Math.round((global.completedTasks / global.totalTasks) * 100) 
        : 0,
      balance: globalBalance,
      criticalAlerts: alerts.filter(a => a.type === 'critical').length,
      warningAlerts: alerts.filter(a => a.type === 'warning').length
    };
  }, [analysisData]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-6xl mx-auto p-4 md:p-6 w-full gap-4">
      
      {/* Stats rápidos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3 bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="text-xs text-slate-600">Completado</span>
          </div>
          <p className="text-xl font-bold text-slate-900 mt-1">{quickStats.tasksCompletion}%</p>
        </Card>
        
        <Card className={cn(
          "p-3 border",
          quickStats.balance >= 0 
            ? "bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200" 
            : "bg-gradient-to-br from-red-50 to-red-100 border-red-200"
        )}>
          <div className="flex items-center gap-2">
            {quickStats.balance >= 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-600" />
            )}
            <span className="text-xs text-slate-600">Balance</span>
          </div>
          <p className={cn(
            "text-xl font-bold mt-1",
            quickStats.balance >= 0 ? "text-emerald-700" : "text-red-700"
          )}>
            {quickStats.balance >= 0 ? '+' : ''}{quickStats.balance}h
          </p>
        </Card>
        
        <Card className={cn(
          "p-3 border",
          quickStats.criticalAlerts > 0 
            ? "bg-gradient-to-br from-red-50 to-red-100 border-red-200" 
            : "bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200"
        )}>
          <div className="flex items-center gap-2">
            <XCircle className={cn("w-4 h-4", quickStats.criticalAlerts > 0 ? "text-red-600" : "text-slate-400")} />
            <span className="text-xs text-slate-600">Críticos</span>
          </div>
          <p className={cn(
            "text-xl font-bold mt-1",
            quickStats.criticalAlerts > 0 ? "text-red-700" : "text-slate-400"
          )}>
            {quickStats.criticalAlerts}
          </p>
        </Card>
        
        <Card className={cn(
          "p-3 border",
          quickStats.warningAlerts > 0 
            ? "bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200" 
            : "bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200"
        )}>
          <div className="flex items-center gap-2">
            <AlertTriangle className={cn("w-4 h-4", quickStats.warningAlerts > 0 ? "text-amber-600" : "text-slate-400")} />
            <span className="text-xs text-slate-600">Avisos</span>
          </div>
          <p className={cn(
            "text-xl font-bold mt-1",
            quickStats.warningAlerts > 0 ? "text-amber-700" : "text-slate-400"
          )}>
            {quickStats.warningAlerts}
          </p>
        </Card>
      </div>

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
                    <div className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm whitespace-pre-wrap ${
                      msg.role === 'user' 
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-tr-sm' 
                        : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm'
                    }`}>
                      {msg.text}
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1 px-1 flex items-center gap-1.5">
                      {format(msg.timestamp, 'HH:mm')}
                      {msg.provider && (
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[9px] font-medium",
                          msg.provider === 'gemini' 
                            ? "bg-blue-100 text-blue-600" 
                            : "bg-orange-100 text-orange-600"
                        )}>
                          {msg.provider === 'gemini' ? '✨ Gemini' : '🥥 Coco'}
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
