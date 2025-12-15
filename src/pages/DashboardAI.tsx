import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { GoogleGenerativeAI } from "@google/generative-ai";
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bot, Send, Sparkles, Loader2, Zap } from 'lucide-react';

// Inicializar la API de Gemini
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isError?: boolean;
}

export default function DashboardAI() {
  const { employees, projects, allocations, absences, clients, professionalGoals } = useApp();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '¡Hola! Soy Minguito. Pregúntame sobre la carga de trabajo, proyectos o los OKRs del equipo.',
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

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    
    if (!import.meta.env.VITE_GEMINI_API_KEY) {
        setMessages(prev => [...prev, { role: 'assistant', content: "⚠️ Error: Falta la API Key en .env.", timestamp: new Date(), isError: true }]);
        return;
    }

    const userMessage = input;
    const lowerMessage = userMessage.toLowerCase();
    
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: new Date() }]);
    setIsLoading(true);

    try {
      const today = new Date();
      
      // --- ESTRATEGIA DE CONTEXTO DINÁMICO (AHORRO DE TOKENS) ---
      
      const empleadosContext = employees.filter(e => e.isActive).map(e => {
          const isRelevant = lowerMessage.includes(e.name.toLowerCase());
          
          if (isRelevant) {
              const goals = professionalGoals.filter(g => g.employeeId === e.id).map(g => ({
                  objetivo: g.title,
                  progreso: `${g.progress}%`,
                  krs: g.keyResults
              }));
              
              return {
                  nombre: e.name, 
                  rol: e.role,
                  status: "DETALLADO",
                  capacidad: e.defaultWeeklyCapacity,
                  okrs: goals.length > 0 ? goals : "Sin objetivos",
              };
          } else {
              return {
                  nombre: e.name,
                  rol: e.role,
                  status: "RESUMIDO" 
              };
          }
      });

      const proyectosContext = projects.filter(p => p.status === 'active').map(p => {
          const isRelevant = lowerMessage.includes(p.name.toLowerCase());
          const clientName = clients.find(c => c.id === p.clientId)?.name || 'N/A';
          
          if (isRelevant || lowerMessage.includes("proyectos") || lowerMessage.includes("resumen")) {
              return {
                  nombre: p.name,
                  cliente: clientName,
                  presupuesto: p.budgetHours,
                  status: "DETALLADO"
              };
          } else {
              return { nombre: p.name, cliente: clientName };
          }
      });

      const dataContext = {
        fecha: today.toLocaleDateString(),
        empleados: empleadosContext,
        proyectos: proyectosContext,
        ausencias_proximas: absences.filter(a => new Date(a.endDate) >= today).map(a => ({
          quien: employees.find(e => e.id === a.employeeId)?.name,
          tipo: a.type,
          hasta: a.endDate
        }))
      };

      const systemPrompt = `
        Eres Minguito, Project Manager.
        
        DATOS EN TIEMPO REAL (Optimizados):
        ${JSON.stringify(dataContext)}

        PREGUNTA: "${userMessage}"

        INSTRUCCIONES:
        1. Responde de forma breve y ejecutiva.
        2. Tienes datos "DETALLADOS" solo de lo que el usuario ha preguntado.
        3. Si te preguntan por alguien que sale como "RESUMIDO", di que sabes que existe pero necesitas que pregunten específicamente por él para ver sus detalles.
        4. Usa Markdown.
      `;

      // Modelo optimizado
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      
      const result = await model.generateContent(systemPrompt);
      const text = result.response.text(); 

      setMessages(prev => [...prev, { role: 'assistant', content: text, timestamp: new Date() }]);

    } catch (error: any) {
      console.error("Error IA:", error);
      let errorMsg = "Minguito está teniendo problemas de conexión. Intenta de nuevo.";
      
      // ✅ GESTIÓN DE ERRORES ESPECÍFICOS
      if (error.message?.includes("404")) {
          errorMsg = "Error: El modelo de IA no está disponible o ha cambiado de versión. Revisa DashboardAI.tsx.";
      } else if (error.message?.includes("429")) {
          // ✅ MENSAJE AMIGABLE PARA LÍMITE DE CUOTA
          errorMsg = "⏳ **Minguito está descansando.** He alcanzado el límite de consultas por minuto de la API. Por favor, espera un momento y vuelve a preguntar.";
      } else if (error.message?.includes("API key")) {
          errorMsg = "Error: Verifica tu API Key en el archivo .env.";
      }
      
      setMessages(prev => [...prev, { role: 'assistant', content: errorMsg, timestamp: new Date(), isError: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] gap-4 p-4 md:p-8 max-w-5xl mx-auto w-full">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Sparkles className="h-8 w-8 text-indigo-500" /> Copiloto IA
        </h1>
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <p>Asistente de gestión inteligente.</p>
            <span className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium border border-green-200">
                <Zap className="h-3 w-3" /> Modo Ahorro Tokens Activo
            </span>
        </div>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden shadow-lg border-indigo-100 dark:border-indigo-900/50">
        <CardHeader className="bg-muted/30 border-b pb-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-muted-foreground">Minguito v2.5 • Online</span>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden bg-slate-50/50 dark:bg-slate-950/50">
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4 max-w-3xl mx-auto">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <Avatar className="h-8 w-8 mt-1 border border-indigo-200 bg-white">
                      <AvatarImage src="/bot-avatar.png" />
                      <AvatarFallback className="bg-indigo-50 text-indigo-600"><Bot className="h-5 w-5" /></AvatarFallback>
                    </Avatar>
                  )}
                  <div className={`rounded-2xl px-4 py-3 max-w-[85%] text-sm shadow-sm prose prose-sm dark:prose-invert ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white dark:bg-slate-900 border rounded-bl-none'}`}>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3 justify-start">
                   <Avatar className="h-8 w-8 mt-1"><AvatarFallback className="bg-indigo-50"><Sparkles className="h-4 w-4 animate-pulse text-indigo-400" /></AvatarFallback></Avatar>
                    <div className="bg-white dark:bg-slate-900 border px-4 py-3 rounded-2xl rounded-bl-none flex items-center gap-2 text-sm text-muted-foreground shadow-sm">
                      <Loader2 className="h-3 w-3 animate-spin text-indigo-500" /> Optimizando contexto...
                    </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-4 bg-background border-t">
            <div className="max-w-3xl mx-auto flex gap-3">
              <Input placeholder="Ej: ¿Cómo va la proyección de Miguel?" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} className="flex-1" />
              <Button onClick={handleSendMessage} disabled={isLoading || !input.trim()} className="bg-indigo-600 hover:bg-indigo-700"><Send className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
