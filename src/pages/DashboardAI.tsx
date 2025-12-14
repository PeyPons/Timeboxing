import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import ReactMarkdown from 'react-markdown'; // <--- NUEVA IMPORTACIÓN CLAVE
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bot, Send, User, Sparkles, Loader2, AlertTriangle } from 'lucide-react';

// Inicializar Gemini
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isError?: boolean;
}

export default function DashboardAI() {
  const { employees, projects, allocations, absences, clients } = useApp();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '¡Hola! Soy Minguito, tu Copiloto PM. Puedes preguntarme por **proyectos**, **clientes**, **empleados**, **capacidad del equipo**, **sugerencias sobre a quién asignar nuevos proyectos** o el estado de sus **objetivos profesionales**.',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Referencia ahora apunta al elemento invisible para forzar el scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ✅ SOLUCIÓN 2: Lógica de auto-scroll usando scrollIntoView
  useEffect(() => {
    // Si la referencia existe, haz scroll hacia ella
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]); // Depende de mensajes y estado de carga

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    
    if (!import.meta.env.VITE_GEMINI_API_KEY) {
        setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: "⚠️ Error: API Key no detectada. Comprueba el archivo .env.", 
            timestamp: new Date(),
            isError: true 
        }]);
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
        empleados: employees.filter(e => e.isActive).map(e => ({
          nombre: e.name, 
          rol: e.role,
          capacidad: e.defaultWeeklyCapacity,
          proyeccion_profesional: e.professionalGoal // Incluido el campo
        })),
        proyectos: projects.filter(p => p.status === 'active').map(p => ({
          nombre: p.name,
          cliente: clients.find(c => c.id === p.clientId)?.name || 'Sin cliente',
          presupuesto: p.budgetHours
        })),
        ausencias: absences.filter(a => new Date(a.endDate) >= today).map(a => ({
          quien: employees.find(e => e.id === a.employeeId)?.name,
          tipo: a.type,
          fin: a.endDate
        })),
        asignaciones: allocations.map(a => ({
          quien: employees.find(e => e.id === a.employeeId)?.name,
          proyecto: projects.find(p => p.id === a.projectId)?.name,
          horas: a.hoursAssigned,
          semana: a.weekStartDate
        }))
      };

      const systemPrompt = `
        Eres un Project Manager Senior, **tu nombre es Minguito**. Analiza estos datos de la agencia:
        ${JSON.stringify(dataContext)}

        Pregunta: ${userMessage}
        
        Instrucciones:
        - Sé breve y directo. // Mantenemos esta instrucción para reducir verbosidad
        - Limita el uso de saltos de línea innecesarios al inicio y al final de tu respuesta.
        - Si preguntan disponibilidad, calcula (Capacidad - Asignado - Ausencias).
        - Usa negritas (**nombre**) y listas con asteriscos para facilitar la lectura.
        - **Siempre responde como Minguito.**
      `;

      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash", 
        safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        ]
      });

      const result = await model.generateContent(systemPrompt);
      const response = result.response;
      
      // ✅ SOLUCIÓN 1: Usamos .trim() para eliminar saltos de línea iniciales y finales
      const text = response.text().trim(); 

      setMessages(prev => [...prev, { role: 'assistant', content: text, timestamp: new Date() }]);

    } catch (error: any) {
      console.error("Error AI Detallado:", error);
      
      let errorMsg = "Lo siento, ha ocurrido un error.";
      
      if (error.message?.includes('429')) errorMsg = "🛑 LÍMITE DE CUOTA EXCEDIDO (429). La única solución es **habilitar la facturación en Google AI Studio** para eliminar el límite 'cero'.";
      else if (error.message?.includes('404')) errorMsg = "Error de modelo. Tu clave no tiene acceso a gemini-2.5-flash.";
      else if (error.message?.includes('fetch')) errorMsg = "Error de conexión de red.";
      else errorMsg = `Error técnico: ${error.message}`;

      setMessages(prev => [...prev, { role: 'assistant', content: errorMsg, timestamp: new Date(), isError: true }]);
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
          {/* Quitamos el ref del ScrollArea ya que apuntará al div interno */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4 max-w-3xl mx-auto">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <Avatar className={`h-8 w-8 mt-1 border ${msg.isError ? 'border-red-200 bg-red-50' : 'border-indigo-200 bg-white'}`}>
                      {msg.isError ? 
                        <AlertTriangle className="h-5 w-5 text-red-500 m-1.5" /> : 
                        <AvatarImage src="/bot-avatar.png" />
                      }
                      {!msg.isError && <AvatarFallback className="bg-indigo-50 text-indigo-600"><Bot className="h-5 w-5" /></AvatarFallback>}
                    </Avatar>
                  )}
                  
                  <div className={`
                    rounded-2xl px-4 py-3 max-w-[85%] text-sm shadow-sm whitespace-pre-wrap leading-relaxed
                    ${msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-br-none' 
                      : msg.isError 
                        ? 'bg-red-50 border border-red-200 text-red-700'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-bl-none prose prose-sm dark:prose-invert'}
                  `}>
                    {msg.role === 'user' ? (
                        msg.content // El mensaje del usuario es texto plano
                    ) : (
                        // El mensaje del asistente se renderiza como Markdown
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                    )}
                    
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3 justify-start">
                   <Avatar className="h-8 w-8 mt-1">
                      <AvatarFallback className="bg-indigo-50"><Sparkles className="h-4 w-4 animate-pulse text-indigo-400" /></AvatarFallback>
                    </Avatar>
                    <div className="bg-white dark:bg-slate-900 border px-4 py-3 rounded-2xl rounded-bl-none flex items-center gap-2 text-sm text-muted-foreground shadow-sm">
                      <Loader2 className="h-3 w-3 animate-spin text-indigo-500" /> Minguito está analizando datos de la agencia...
                    </div>
                </div>
              )}
              <div className="pt-2" ref={messagesEndRef} /> 
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
