import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bot, Send, Sparkles, Loader2, AlertTriangle } from 'lucide-react';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isError?: boolean;
}

export default function DashboardAI() {
  // ✅ AHORA IMPORTAMOS professionalGoals
  const { employees, projects, allocations, absences, clients, professionalGoals } = useApp();
  
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '¡Hola! Soy Minguito. Pregúntame sobre la carga de trabajo, proyectos o la proyección profesional del equipo.',
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
        setMessages(prev => [...prev, { role: 'assistant', content: "⚠️ Error: API Key no detectada. Revisa tu archivo .env", timestamp: new Date(), isError: true }]);
        return;
    }

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: new Date() }]);
    setIsLoading(true);

    try {
      const today = new Date();
      
      const dataContext = {
        fecha_hoy: today.toLocaleDateString(),
        empleados: employees.filter(e => e.isActive).map(e => {
            // ✅ Cruzar datos de OKRs
            const goals = professionalGoals.filter(g => g.employeeId === e.id).map(g => ({
                titulo: g.title,
                resultados: g.keyResults,
                progreso: g.progress + '%'
            }));

            return {
                id: e.id,
                nombre: e.name, 
                rol: e.role,
                capacidad: e.defaultWeeklyCapacity,
                okrs: goals.length > 0 ? goals : "Sin objetivos definidos"
            };
        }),
        proyectos: projects.filter(p => p.status === 'active').map(p => ({
          nombre: p.name,
          cliente: clients.find(c => c.id === p.clientId)?.name || 'Sin cliente',
          presupuesto: p.budgetHours
        })),
        ausencias: absences.filter(a => new Date(a.endDate) >= today).map(a => ({
          empleado: employees.find(e => e.id === a.employeeId)?.name,
          tipo: a.type,
          fin: a.endDate
        }))
      };

      const systemPrompt = `
        Eres Minguito, un Project Manager Senior.
        Analiza estos datos (JSON):
        ${JSON.stringify(dataContext)}

        Pregunta: "${userMessage}"
        
        Responde de forma útil, usando Markdown (negritas, listas).
        Si preguntan por objetivos/proyección, usa el campo "okrs".
      `;

      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent(systemPrompt);
      const text = result.response.text(); 

      setMessages(prev => [...prev, { role: 'assistant', content: text, timestamp: new Date() }]);

    } catch (error: any) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Minguito tuvo un error de conexión.", timestamp: new Date(), isError: true }]);
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
        <p className="text-muted-foreground">Tu Project Manager virtual.</p>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden shadow-lg border-indigo-100 dark:border-indigo-900/50">
        <CardHeader className="bg-muted/30 border-b pb-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-muted-foreground">Sistema Online • Minguito</span>
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
                      <Loader2 className="h-3 w-3 animate-spin text-indigo-500" /> Minguito está analizando...
                    </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-4 bg-background border-t">
            <div className="max-w-3xl mx-auto flex gap-3">
              <Input placeholder="Pregunta a Minguito..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} className="flex-1" />
              <Button onClick={handleSendMessage} disabled={isLoading || !input.trim()} className="bg-indigo-600 hover:bg-indigo-700"><Send className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
