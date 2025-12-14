import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bot, Send, User, Sparkles, Loader2 } from 'lucide-react';

// Inicializar Gemini con la clave del .env
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function DashboardAI() {
  const { employees, projects, allocations, absences, clients } = useApp();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '¡Hola! Soy tu asistente de Timeboxing. Tengo acceso a los datos de tu equipo, proyectos y cargas de trabajo. ¿En qué puedo ayudarte hoy?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll al final del chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || !import.meta.env.VITE_GEMINI_API_KEY) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: new Date() }]);
    setIsLoading(true);

    try {
      // 1. Preparamos el CONTEXTO de datos para la IA
      const today = new Date();
      
      const dataContext = {
        fecha_hoy: today.toLocaleDateString(),
        resumen: "Eres el asistente de operaciones de una agencia. Tienes acceso a estos datos en tiempo real:",
        empleados: employees.filter(e => e.isActive).map(e => ({
          id: e.name, 
          rol: e.role,
          horas_semanales_contrato: e.defaultWeeklyCapacity
        })),
        proyectos_activos: projects.filter(p => p.status === 'active').map(p => ({
          nombre: p.name,
          cliente: clients.find(c => c.id === p.clientId)?.name,
          horas_presupuestadas: p.budgetHours
        })),
        ausencias_futuras: absences.filter(a => new Date(a.endDate) >= today).map(a => ({
          empleado: employees.find(e => e.id === a.employeeId)?.name,
          tipo: a.type,
          desde: a.startDate,
          hasta: a.endDate
        })),
        asignaciones_recientes: allocations.map(a => ({
          empleado: employees.find(e => e.id === a.employeeId)?.name,
          proyecto: projects.find(p => p.id === a.projectId)?.name,
          horas: a.hoursAssigned,
          semana_inicio: a.weekStartDate
        }))
      };

      // 2. Construimos el Prompt
      const systemPrompt = `
        Actúa como un Project Manager Senior experto en análisis de datos.
        
        TUS DATOS (Fuente de la verdad):
        ${JSON.stringify(dataContext)}

        INSTRUCCIONES:
        1. Responde a la pregunta del usuario basándote EXCLUSIVAMENTE en los datos de arriba.
        2. Si preguntan "¿Quién está libre?", calcula (Capacidad - Horas Asignadas - Ausencias).
        3. Sé muy conciso. Usa listas (bullets) si hay varios puntos.
        4. Si detectas que alguien tiene más horas asignadas de las que permite su contrato, avisa del riesgo de burnout.
        
        Usuario: ${userMessage}
      `;

      // 3. Llamada a Gemini
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(systemPrompt);
      const response = result.response;
      const text = response.text();

      setMessages(prev => [...prev, { role: 'assistant', content: text, timestamp: new Date() }]);

    } catch (error) {
      console.error("Error AI:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Lo siento, tuve un problema conectando con la API de Google. Verifica tu conexión o la API Key.", timestamp: new Date() }]);
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

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] gap-4 p-4 md:p-8 max-w-5xl mx-auto w-full">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Sparkles className="h-8 w-8 text-indigo-500" />
          Copiloto IA
        </h1>
        <p className="text-muted-foreground">
          Tu Project Manager virtual. Pregunta sobre disponibilidad, cargas o proyectos.
        </p>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden shadow-lg border-indigo-100 dark:border-indigo-900/50">
        <CardHeader className="bg-muted/30 border-b pb-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-muted-foreground">Sistema Online • Datos actualizados</span>
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
                  
                  <div className={`
                    rounded-2xl px-4 py-3 max-w-[85%] text-sm shadow-sm whitespace-pre-wrap leading-relaxed
                    ${msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-br-none' 
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-bl-none prose prose-sm dark:prose-invert'}
                  `}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3 justify-start">
                   <Avatar className="h-8 w-8 mt-1">
                      <AvatarFallback className="bg-indigo-50"><Sparkles className="h-4 w-4 animate-pulse text-indigo-400" /></AvatarFallback>
                    </Avatar>
                    <div className="bg-white dark:bg-slate-900 border px-4 py-3 rounded-2xl rounded-bl-none flex items-center gap-2 text-sm text-muted-foreground shadow-sm">
                      <Loader2 className="h-3 w-3 animate-spin text-indigo-500" /> Analizando datos de la agencia...
                    </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-4 bg-background border-t">
            <div className="max-w-3xl mx-auto flex gap-3">
              <Input 
                placeholder="Ej: ¿Quién tiene disponibilidad esta semana?..." 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 shadow-sm border-indigo-200 focus-visible:ring-indigo-500"
                autoFocus
              />
              <Button onClick={handleSendMessage} disabled={isLoading || !input.trim()} className="bg-indigo-600 hover:bg-indigo-700 shadow-md">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
