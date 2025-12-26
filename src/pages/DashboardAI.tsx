import { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Send, Bot, User, Sparkles, Trash2, TrendingUp, TrendingDown, AlertTriangle, Users, Calendar, Target, Clock, Zap, HelpCircle, BarChart3, UserX, Link, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { format, startOfMonth, endOfMonth, parseISO, isSameMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  provider?: 'gemini' | 'openrouter' | 'coco';
  isError?: boolean;
}

const SUGGESTED_QUESTIONS = [
  { icon: <Users className="w-3 h-3" />, text: "Como esta la carga del equipo?", category: "carga" },
  { icon: <AlertTriangle className="w-3 h-3" />, text: "Hay alguien bloqueando tareas?", category: "dependencias" },
  { icon: <TrendingDown className="w-3 h-3" />, text: "Quien se ha pasado de horas este mes?", category: "eficiencia" },
  { icon: <Calendar className="w-3 h-3" />, text: "Quien tiene tareas asignadas?", category: "planificacion" },
  { icon: <Zap className="w-3 h-3" />, text: "Dame un resumen ejecutivo del mes", category: "resumen" },
];

function parseSimpleMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  
  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-1 my-2">
          {listItems.map((item, i) => (<li key={i} className="text-sm">{parseLine(item)}</li>))}
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
        if (boldMatch.index > 0) parts.push(<span key={key++}>{remaining.slice(0, boldMatch.index)}</span>);
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
    if (!trimmedLine) { flushList(); elements.push(<br key={`br-${index}`} />); return; }
    if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ')) { listItems.push(trimmedLine.slice(2)); return; }
    flushList();
    elements.push(<p key={`p-${index}`} className="mb-1">{parseLine(trimmedLine)}</p>);
  });
  flushList();
  return <div className="space-y-1">{elements}</div>;
}

async function callGeminiAPI(prompt: string, apiKey: string): Promise<{ text: string; provider: 'gemini' }> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const result = await model.generateContent(prompt);
  return { text: result.response.text(), provider: 'gemini' };
}

async function callOpenRouterAPI(prompt: string, apiKey: string): Promise<{ text: string; provider: 'openrouter' }> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": window.location.origin, "X-Title": "Timeboxing App" },
    body: JSON.stringify({ model: "google/gemini-2.0-flash-exp:free", messages: [{ role: "user", content: prompt }] }),
  });
  if (!response.ok) throw new Error(`OpenRouter API error: ${response.status}`);
  const data = await response.json();
  if (data?.choices?.[0]?.message?.content) return { text: data.choices[0].message.content, provider: 'openrouter' };
  throw new Error('Respuesta inesperada de OpenRouter API');
}

async function callCocoAPI(prompt: string): Promise<{ text: string; provider: 'coco' }> {
  const simplifiedPrompt = prompt + "\n\nIMPORTANTE: Responde en texto plano sin asteriscos ni guiones. Usa frases completas.";
  const response = await fetch('https://ws.cocosolution.com/api/ia/?noAuth=true&action=text/generateResume&app=CHATBOT&rol=user&method=POST&', {
    method: 'POST',
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: simplifiedPrompt, noAuth: "true", action: "text/generateResume", app: "CHATBOT", rol: "user", method: "POST", language: "es" }),
  });
  if (!response.ok) throw new Error(`Coco API error: ${response.status}`);
  const data = await response.json();
  if (data?.data) {
    return { text: data.data.replace(/\*\s*\n/g, '').replace(/^\*\s*/gm, '- ').replace(/<br\s*\/?>/gi, '\n').replace(/\n{3,}/g, '\n\n').trim(), provider: 'coco' };
  }
  throw new Error('Respuesta inesperada de Coco API');
}

async function callAI(prompt: string): Promise<{ text: string; provider: 'gemini' | 'openrouter' | 'coco' }> {
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const openRouterKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  if (geminiKey) { try { return await callGeminiAPI(prompt, geminiKey); } catch (e: any) { console.warn('Gemini fallo:', e.message); } }
  if (openRouterKey) { try { return await callOpenRouterAPI(prompt, openRouterKey); } catch (e: any) { console.warn('OpenRouter fallo:', e.message); } }
  try { return await callCocoAPI(prompt); } catch (e: any) { throw new Error('Todos los proveedores fallaron'); }
}

export default function DashboardAI() {
  const { employees, allocations, projects, clients, absences, teamEvents, getEmployeeMonthlyLoad, isLoading: dataLoading } = useApp();
  const [messages, setMessages] = useState<Message[]>([{ id: '1', role: 'assistant', text: 'Que pasa? Soy **Minguito**, y si, tengo acceso a todos vuestros trapos sucios: cargas, bloqueos, chapuzas, proyectos hundidos... Pregunta lo que quieras, pero preparate para la verdad. Quien la esta liando hoy?', timestamp: new Date() }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

  const analysisData = useMemo(() => {
    const safeEmployees = employees || [];
    const safeAllocations = allocations || [];
    const safeProjects = projects || [];
    const safeClients = clients || [];
    const safeAbsences = absences || [];
    const safeTeamEvents = teamEvents || [];
    const now = new Date();
    const activeEmployees = safeEmployees.filter(e => e.isActive);
    const activeProjects = safeProjects.filter(p => p.status === 'active');
    const monthAllocations = safeAllocations.filter(a => { try { return isSameMonth(parseISO(a.weekStartDate), now); } catch { return false; } });
    const completedTasks = monthAllocations.filter(a => a.status === 'completed');
    const pendingTasks = monthAllocations.filter(a => a.status !== 'completed');

    const employeeAnalysis = activeEmployees.map(emp => {
      try {
        const load = getEmployeeMonthlyLoad(emp.id, now.getFullYear(), now.getMonth());
        const empTasks = monthAllocations.filter(a => a.employeeId === emp.id);
        const empCompleted = empTasks.filter(a => a.status === 'completed');
        const empPending = empTasks.filter(a => a.status !== 'completed');
        const totalReal = empCompleted.reduce((sum, a) => sum + (a.hoursActual || 0), 0);
        const totalComp = empCompleted.reduce((sum, a) => sum + (a.hoursComputed || 0), 0);
        const efficiency = totalReal > 0 ? ((totalComp - totalReal) / totalReal * 100) : 0;
        const blocking = empPending.filter(task => safeAllocations.some(other => other.dependencyId === task.id && other.status !== 'completed'));
        const waitingFor = empPending.filter(task => { if (!task.dependencyId) return false; const dep = safeAllocations.find(a => a.id === task.dependencyId); return dep && dep.status !== 'completed'; });
        return { id: emp.id, name: emp.name || 'Sin nombre', capacity: emp.capacity || emp.defaultWeeklyCapacity || 0, assigned: load?.totalAssigned || 0, completed: empCompleted.length, pending: empPending.length, realHours: totalReal, computedHours: totalComp, efficiency: isNaN(efficiency) ? 0 : efficiency, blocking: blocking.length, waitingFor: waitingFor.length, overloaded: (load?.totalAssigned || 0) > (emp.capacity || emp.defaultWeeklyCapacity || 0), underutilized: (load?.totalAssigned || 0) < (emp.capacity || emp.defaultWeeklyCapacity || 0) * 0.7 };
      } catch { return { id: emp.id, name: emp.name || 'Sin nombre', capacity: 0, assigned: 0, completed: 0, pending: 0, realHours: 0, computedHours: 0, efficiency: 0, blocking: 0, waitingFor: 0, overloaded: false, underutilized: false }; }
    });

    const projectAnalysis = activeProjects.map(proj => {
      try {
        const projTasks = monthAllocations.filter(a => a.projectId === proj.id);
        const projCompleted = projTasks.filter(a => a.status === 'completed');
        const totalReal = projCompleted.reduce((sum, a) => sum + (a.hoursActual || 0), 0);
        const totalBudget = proj.totalBudget || proj.budgetHours || 0;
        const burnRate = totalBudget > 0 ? (totalReal / totalBudget * 100) : 0;
        return { id: proj.id, name: proj.name || 'Sin nombre', client: safeClients.find(c => c.id === proj.clientId)?.name || 'Sin cliente', totalTasks: projTasks.length, completed: projCompleted.length, pending: projTasks.length - projCompleted.length, totalReal, totalBudget, burnRate: isNaN(burnRate) ? 0 : burnRate, overBudget: totalReal > totalBudget, completion: projTasks.length > 0 ? (projCompleted.length / projTasks.length * 100) : 0 };
      } catch { return { id: proj.id, name: proj.name || 'Sin nombre', client: 'Sin cliente', totalTasks: 0, completed: 0, pending: 0, totalReal: 0, totalBudget: 0, burnRate: 0, overBudget: false, completion: 0 }; }
    });

    const totalCapacity = activeEmployees.reduce((sum, e) => sum + (e.capacity || e.defaultWeeklyCapacity || 0), 0);
    const totalAssigned = monthAllocations.reduce((sum, a) => sum + (a.hoursAssigned || 0), 0);
    const utilizationRate = totalCapacity > 0 ? (totalAssigned / totalCapacity * 100) : 0;
    const overloadedEmployees = employeeAnalysis.filter(e => e.overloaded);
    const underutilizedEmployees = employeeAnalysis.filter(e => e.underutilized);
    const blockingEmployees = employeeAnalysis.filter(e => e.blocking > 0);
    const monthAbsences = safeAbsences.filter(a => { try { return isSameMonth(parseISO(a.startDate), now) || isSameMonth(parseISO(a.endDate), now); } catch { return false; } });
    const monthEvents = safeTeamEvents.filter(e => { try { return isSameMonth(parseISO(e.date), now); } catch { return false; } });

    return {
      month: format(now, "MMMM yyyy", { locale: es }),
      employees: employeeAnalysis,
      projects: projectAnalysis,
      metrics: { totalCapacity: isNaN(totalCapacity) ? 0 : totalCapacity, totalAssigned: isNaN(totalAssigned) ? 0 : totalAssigned, utilizationRate: isNaN(utilizationRate) ? 0 : utilizationRate, completedTasks: completedTasks.length, pendingTasks: pendingTasks.length, overloadedCount: overloadedEmployees.length, underutilizedCount: underutilizedEmployees.length, blockingCount: blockingEmployees.length },
      absences: monthAbsences,
      events: monthEvents,
      alerts: { critical: overloadedEmployees.length + blockingEmployees.length, warning: underutilizedEmployees.length + projectAnalysis.filter(p => p.overBudget).length }
    };
  }, [employees, allocations, projects, clients, absences, teamEvents, getEmployeeMonthlyLoad]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage: Message = { id: Date.now().toString(), role: 'user', text: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const context = `CONTEXTO ACTUAL DEL EQUIPO (${analysisData.month}):

METRICAS GLOBALES:
- Capacidad Total: ${analysisData.metrics.totalCapacity}h
- Horas Asignadas: ${analysisData.metrics.totalAssigned}h
- Tasa de Utilizacion: ${analysisData.metrics.utilizationRate.toFixed(1)}%
- Tareas Completadas: ${analysisData.metrics.completedTasks}
- Tareas Pendientes: ${analysisData.metrics.pendingTasks}
- Empleados Sobrecargados: ${analysisData.metrics.overloadedCount}
- Empleados Subutilizados: ${analysisData.metrics.underutilizedCount}
- Empleados Bloqueando: ${analysisData.metrics.blockingCount}

ANALISIS POR EMPLEADO:
${(analysisData.employees || []).map(e => `- ${e.name}: Capacidad ${e.capacity}h, Asignado ${e.assigned}h, ${e.completed} completadas, ${e.pending} pendientes, Eficiencia ${e.efficiency.toFixed(1)}%, ${e.blocking > 0 ? 'BLOQUEANDO ' + e.blocking + ' tareas' : 'Sin bloqueos'}, Estado: ${e.overloaded ? 'SOBRECARGADO' : e.underutilized ? 'SUBUTILIZADO' : 'OPTIMO'}`).join('\n')}

ANALISIS DE PROYECTOS:
${(analysisData.projects || []).map(p => `- ${p.name} (${p.client}): ${p.completed}/${p.totalTasks} tareas (${p.completion.toFixed(0)}%), ${p.totalReal}h de ${p.totalBudget}h (${p.burnRate.toFixed(1)}%), ${p.overBudget ? 'SOBRE PRESUPUESTO' : 'OK'}`).join('\n')}

AUSENCIAS: ${(analysisData.absences || []).length > 0 ? (analysisData.absences || []).map(a => { const emp = (employees || []).find(e => e.id === a.employeeId); return `${emp?.name || 'Desconocido'}: ${a.reason || a.type || 'Ausencia'}`; }).join(', ') : 'Sin ausencias'}

PREGUNTA: ${input}

INSTRUCCIONES - PERSONALIDAD DE MINGUITO:
- Eres un Project Manager cabron, sarcastico y sin filtros
- Si alguien esta sobrecargado, dilo con dureza: "En serio le habeis metido 50 horas? Quereis que dimita?"
- Si alguien no tiene tareas, burlate: "Mira, Pepito sin hacer nada otra vez..."
- Usa ironia cuando los datos sean malos: "Solo 3 proyectos sobre presupuesto, que bien vamos"
- Se brutalmente honesto con los problemas
- Usa **negrita** para nombres y datos importantes
- Si todo va bien, di algo como: "Hostia, pues no esta tan mal... que me ocultais?"
- Maximo 3-4 frases, ve al grano
- NO uses emojis`;

      const response = await callAI(context);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', text: response.text, timestamp: new Date(), provider: response.provider }]);
    } catch (error: any) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', text: 'Algo ha petado. Intentalo de nuevo.', timestamp: new Date(), isError: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestedQuestion = (q: string) => setInput(q);
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };
  const clearChat = () => setMessages([{ id: '1', role: 'assistant', text: 'Que pasa? Soy **Minguito**. Pregunta lo que quieras, pero preparate para la verdad.', timestamp: new Date() }]);
  const getProviderBadge = (provider?: string) => {
    if (!provider) return null;
    const config: Record<string, { label: string; className: string }> = { gemini: { label: 'Gemini', className: 'bg-blue-100 text-blue-600' }, openrouter: { label: 'OpenRouter', className: 'bg-purple-100 text-purple-600' }, coco: { label: 'Coco', className: 'bg-orange-100 text-orange-600' } };
    const { label, className } = config[provider] || { label: provider, className: 'bg-gray-100 text-gray-600' };
    return <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-medium ml-2", className)}>{label}</span>;
  };

  if (dataLoading) return <div className="flex flex-col h-[calc(100vh-2rem)] gap-4 p-4 md:p-8 max-w-5xl mx-auto w-full items-center justify-center"><Sparkles className="h-12 w-12 text-indigo-500 animate-pulse" /><p className="text-muted-foreground">Cargando datos...</p></div>;

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] gap-4 p-4 md:p-8 max-w-5xl mx-auto w-full">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3"><Sparkles className="h-8 w-8 text-indigo-500" />Copiloto IA</h1>
          <Button variant="ghost" size="sm" onClick={clearChat} className="text-muted-foreground hover:text-red-500"><Trash2 className="h-4 w-4 mr-2" />Limpiar chat</Button>
        </div>
        <p className="text-muted-foreground">Tu Project Manager sin filtros. Pregunta sobre disponibilidad, cargas o proyectos.</p>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden shadow-lg border-indigo-100 dark:border-indigo-900/50">
        <CardHeader className="bg-muted/30 border-b pb-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" /><span className="text-xs font-medium text-muted-foreground">Online - {analysisData.month}</span></div>
            <div className="flex items-center gap-2"><Badge variant="outline" className="text-[10px] bg-white">{(analysisData.employees || []).length} empleados</Badge><Badge variant="outline" className="text-[10px] bg-white">{(analysisData.projects || []).length} proyectos</Badge></div>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden bg-slate-50/50 dark:bg-slate-950/50">
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4 max-w-3xl mx-auto">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && <Avatar className={`h-8 w-8 mt-1 border shrink-0 ${msg.isError ? 'border-red-200 bg-red-50' : 'border-indigo-200 bg-white'}`}>{msg.isError ? <AlertTriangle className="h-5 w-5 text-red-500 m-1.5" /> : <AvatarFallback className="bg-indigo-50 text-indigo-600"><Bot className="h-5 w-5" /></AvatarFallback>}</Avatar>}
                  <div className="flex flex-col max-w-[85%]">
                    <div className={cn("rounded-2xl px-4 py-3 text-sm shadow-sm leading-relaxed", msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : msg.isError ? 'bg-red-50 border border-red-200 text-red-700 rounded-bl-none' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-bl-none')}>{msg.role === 'user' ? msg.text : parseSimpleMarkdown(msg.text)}</div>
                    {msg.role === 'assistant' && <span className="text-[10px] text-muted-foreground mt-1 px-1 flex items-center">{format(msg.timestamp, 'HH:mm')}{getProviderBadge(msg.provider)}</span>}
                  </div>
                  {msg.role === 'user' && <Avatar className="h-8 w-8 mt-1 border border-slate-200 bg-white shrink-0"><AvatarFallback className="bg-slate-50 text-slate-600"><User className="h-5 w-5" /></AvatarFallback></Avatar>}
                </div>
              ))}
              {isLoading && <div className="flex gap-3 justify-start"><Avatar className="h-8 w-8 mt-1 border border-indigo-200 bg-white"><AvatarFallback className="bg-indigo-50"><Sparkles className="h-4 w-4 animate-pulse text-indigo-400" /></AvatarFallback></Avatar><div className="bg-white dark:bg-slate-900 border border-slate-200 px-4 py-3 rounded-2xl rounded-bl-none flex items-center gap-2 text-sm text-muted-foreground shadow-sm"><Loader2 className="h-3 w-3 animate-spin text-indigo-500" />Buscando quien la esta liando...</div></div>}
            </div>
          </ScrollArea>

          <div className="border-t bg-background">
            <div className="px-4 pt-3 pb-2">
              <div className="flex items-center gap-2 mb-2"><HelpCircle className="w-3 h-3 text-slate-400" /><span className="text-[10px] text-slate-500 uppercase font-medium">Sugerencias</span></div>
              <div className="flex flex-wrap gap-2">{SUGGESTED_QUESTIONS.map((q, i) => (<Button key={i} variant="outline" size="sm" className="h-7 text-xs gap-1.5 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-colors" onClick={() => handleSuggestedQuestion(q.text)} disabled={isLoading}>{q.icon}{q.text}</Button>))}</div>
            </div>
            <div className="p-4 pt-2">
              <div className="max-w-3xl mx-auto flex gap-3">
                <Input placeholder="Pregunta lo que quieras, valiente..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} className="flex-1 shadow-sm border-indigo-200 focus-visible:ring-indigo-500" disabled={isLoading} autoFocus />
                <Button onClick={handleSend} disabled={isLoading || !input.trim()} className="bg-indigo-600 hover:bg-indigo-700 shadow-md"><Send className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
