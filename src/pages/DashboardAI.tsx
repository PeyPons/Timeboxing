import { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Bot, User, Sparkles, Trash2 } from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { format, startOfMonth, endOfMonth, parseISO, isSameMonth } from 'date-fns';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

export default function DashboardAI() {
  const { employees, allocations, projects } = useApp();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      text: '¡Buenas! Soy Minguito. Vamos al grano: ¿A quién tengo que "felicitar" hoy por su gestión del tiempo?',
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

  // --- CEREBRO DE MINGUITO: Pre-cálculo de Datos Financieros ---
  const contextData = useMemo(() => {
      const now = new Date();
      // Filtramos solo lo de este mes actual para no marearle con historia antigua (ahorro tokens)
      const currentAllocations = allocations.filter(a => isSameMonth(parseISO(a.weekStartDate), now));
      
      const completed = currentAllocations.filter(a => a.status === 'completed');
      
      // Totales del mes
      const totalReal = completed.reduce((sum, a) => sum + (a.hoursActual || 0), 0);
      const totalComp = completed.reduce((sum, a) => sum + (a.hoursComputed || 0), 0);
      const balance = totalComp - totalReal; // Rentabilidad global

      // Ranking de "Pecadores" y "Santos"
      const employeePerformance = employees.map(emp => {
          const empTasks = completed.filter(a => a.employeeId === emp.id);
          const empReal = empTasks.reduce((s, a) => s + (a.hoursActual || 0), 0);
          const empComp = empTasks.reduce((s, a) => s + (a.hoursComputed || 0), 0);
          const empBalance = empComp - empReal;
          
          if (empTasks.length === 0) return null;

          return {
              name: emp.name,
              balance: Math.round(empBalance * 10) / 10, // Redondeo
              tasks: empTasks.length
          };
      }).filter(Boolean).sort((a, b) => a!.balance - b!.balance); // Ordenado de peor a mejor

      return {
          month: format(now, 'MMMM'),
          financials: {
              realHours: Math.round(totalReal),
              billableHours: Math.round(totalComp),
              netBalance: Math.round(balance * 10) / 10
          },
          teamRanking: employeePerformance // Lista ordenada de rentabilidad por empleado
      };
  }, [allocations, employees]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', text: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
        setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', text: '⚠️ Sin API Key no funciono.', timestamp: new Date() }]);
        setIsLoading(false);
        return;
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
            Eres Minguito, un asistente de IA para una agencia digital.
            PERSONALIDAD: Eres natural, directo, sarcástico y te obsesiona la rentabilidad.
            No te cortes. Si alguien ha perdido tiempo, dilo. Si el balance es negativo, quéjate.
            Habla como un compañero de trabajo veterano, no como un robot. Usa jerga si quieres ("palmando pasta", "ni tan mal", "crack").

            CONTEXTO DEL MES (${contextData.month}):
            - Horas Reales (Coste): ${contextData.financials.realHours}h
            - Horas Computadas (Facturable): ${contextData.financials.billableHours}h
            - BALANCE TOTAL: ${contextData.financials.netBalance}h (Si es negativo, estamos perdiendo dinero).

            RANKING EMPLEADOS (De peor a mejor rentabilidad):
            ${JSON.stringify(contextData.teamRanking)}

            Pregunta del usuario: "${input}"
            
            Responde brevemente (máx 3 frases) basándote en los datos.
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', text: responseText, timestamp: new Date() }]);
    } catch (error) {
        setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', text: 'Me he quedado frito. Inténtalo luego.', timestamp: new Date() }]);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-5xl mx-auto p-4 md:p-6 w-full gap-4">
        <Card className="flex-1 flex flex-col overflow-hidden shadow-md border-indigo-100/50">
            <CardHeader className="bg-indigo-50/50 border-b pb-4">
                <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="h-10 w-10 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg shadow-indigo-200">
                        <Bot className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent font-bold">Minguito AI</span>
                        <p className="text-xs text-muted-foreground font-normal mt-0.5">Analista de Rentabilidad & Látigo del Equipo</p>
                    </div>
                    <Button variant="ghost" size="icon" className="ml-auto text-muted-foreground hover:text-red-500" onClick={() => setMessages([])}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </CardTitle>
            </CardHeader>
            
            <CardContent className="flex-1 overflow-hidden p-0 bg-slate-50/30">
                <ScrollArea className="h-full p-4">
                    <div className="space-y-4 max-w-3xl mx-auto">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                <Avatar className={`h-8 w-8 mt-1 border ${msg.role === 'assistant' ? 'bg-indigo-100 border-indigo-200' : 'bg-white border-slate-200'}`}>
                                    <AvatarFallback className={msg.role === 'assistant' ? 'text-indigo-700' : 'text-slate-700'}>
                                        {msg.role === 'assistant' ? <Sparkles className="h-4 w-4" /> : <User className="h-4 w-4" />}
                                    </AvatarFallback>
                                </Avatar>
                                <div className={`flex flex-col max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                    <div className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                                        msg.role === 'user' 
                                            ? 'bg-indigo-600 text-white rounded-tr-sm' 
                                            : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm'
                                    }`}>
                                        {msg.text}
                                    </div>
                                    <span className="text-[10px] text-muted-foreground mt-1 px-1">
                                        {format(msg.timestamp, 'HH:mm')}
                                    </span>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex gap-3">
                                <div className="h-8 w-8 bg-indigo-50 rounded-full flex items-center justify-center animate-pulse"><Sparkles className="h-4 w-4 text-indigo-300" /></div>
                                <div className="bg-slate-100 px-4 py-2 rounded-2xl rounded-tl-sm text-sm text-muted-foreground italic animate-pulse">
                                    Pensando una respuesta ingeniosa...
                                </div>
                            </div>
                        )}
                        <div ref={scrollRef} />
                    </div>
                </ScrollArea>
            </CardContent>

            <div className="p-4 bg-white border-t">
                <div className="flex gap-2 max-w-3xl mx-auto relative">
                    <Input 
                        placeholder="Pregunta a Minguito (ej: ¿Quién ha perdido más tiempo hoy?)..." 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        className="pr-12 py-6 shadow-sm border-slate-200 focus-visible:ring-indigo-500"
                    />
                    <Button 
                        size="icon" 
                        onClick={handleSend} 
                        disabled={isLoading || !input.trim()}
                        className="absolute right-1.5 top-1.5 h-9 w-9 bg-indigo-600 hover:bg-indigo-700 transition-all"
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
                <div className="text-center mt-2">
                    <p className="text-[10px] text-muted-foreground">Minguito analiza solo el mes en curso para ser eficiente.</p>
                </div>
            </div>
        </Card>
    </div>
  );
}
