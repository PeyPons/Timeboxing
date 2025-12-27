import { useMemo, memo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Compass, TrendingUp, TrendingDown, 
  Lightbulb, Award, HelpCircle, CheckCircle2, History, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReliabilityIndexCardProps {
  employeeId: string;
}

const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

export const ReliabilityIndexCard = memo(function ReliabilityIndexCard({ employeeId }: ReliabilityIndexCardProps) {
  const { allocations, employees } = useApp();
  const employee = employees.find(e => e.id === employeeId);

  const reliability = useMemo(() => {
    const completedTasks = (allocations || []).filter(a => 
      a.employeeId === employeeId && 
      a.status === 'completed' &&
      a.hoursAssigned > 0 &&
      (a.hoursActual || 0) > 0
    );
    
    const totalEstimated = round2(completedTasks.reduce((sum, a) => sum + a.hoursAssigned, 0));
    const totalReal = round2(completedTasks.reduce((sum, a) => sum + (a.hoursActual || 0), 0));
    const tasksAnalyzed = completedTasks.length;
    
    const index = totalReal > 0 ? round2((totalEstimated / totalReal) * 100) : 0;
    
    let trend: 'accurate' | 'overestimates' | 'underestimates' | 'insufficient' = 'insufficient';
    if (tasksAnalyzed >= 5) {
      if (index >= 90 && index <= 110) trend = 'accurate';
      else if (index < 90) trend = 'underestimates';
      else trend = 'overestimates';
    }
    
    const averageDeviation = tasksAnalyzed > 0 ? round2((totalReal - totalEstimated) / tasksAnalyzed) : 0;
    
    return { index, totalEstimated, totalReal, tasksAnalyzed, trend, averageDeviation };
  }, [allocations, employeeId]);

  const getConfig = () => {
    if (reliability.tasksAnalyzed < 5) {
      return {
        icon: HelpCircle,
        title: 'Calibrando tu brújula...',
        description: 'Completa 5 tareas con horas reales para conocer tu estilo de planificación.',
        bgColor: 'bg-slate-50',
        borderColor: 'border-slate-200',
        textColor: 'text-slate-600',
        progressColor: ''
      };
    }
    
    switch (reliability.trend) {
      case 'accurate':
        return {
          icon: Award,
          title: '¡Eres un crack planificando!',
          description: 'Tus tiempos estimados son muy cercanos a la realidad. ¡Sigue así!',
          bgColor: 'bg-emerald-50',
          borderColor: 'border-emerald-200',
          textColor: 'text-emerald-700',
          progressColor: '[&>div]:bg-emerald-500'
        };
      case 'underestimates':
        return {
          icon: TrendingDown,
          title: '¡Sigue ajustando tus tiempos!',
          description: `Tus tareas suelen requerir un poco más de mimo (~${Math.abs(reliability.averageDeviation).toFixed(1)}h extra por tarea).`,
          bgColor: 'bg-amber-50',
          borderColor: 'border-amber-200',
          textColor: 'text-amber-700',
          progressColor: '[&>div]:bg-amber-500'
        };
      case 'overestimates':
        return {
          icon: TrendingUp,
          title: '¡Vas más rápido de lo esperado!',
          description: `Sueles terminar antes de tiempo (~${Math.abs(reliability.averageDeviation).toFixed(1)}h menos por tarea).`,
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-700',
          progressColor: '[&>div]:bg-blue-500'
        };
      default:
        return {
          icon: HelpCircle,
          title: 'Calculando...',
          description: '',
          bgColor: 'bg-slate-50',
          borderColor: 'border-slate-200',
          textColor: 'text-slate-600',
          progressColor: ''
        };
    }
  };

  const config = getConfig();
  const IconComponent = config.icon;

  const getProgressValue = () => {
    if (reliability.tasksAnalyzed < 5) return 50;
    return Math.min(Math.max((reliability.index / 2), 0), 100);
  };

  return (
    <TooltipProvider>
      <Card className={cn("border-l-4", config.borderColor)}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              <Compass className="h-5 w-5 text-indigo-600" />
              <span>Precisión de planificación</span>
            </div>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="outline" className="gap-1 cursor-help">
                  <History className="h-3 w-3" />
                  {reliability.tasksAnalyzed} tareas
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-[250px]">
                <p className="text-xs">
                  Este índice se calcula con <strong>todo tu histórico</strong> de tareas completadas. 
                  Cuantas más tareas registres, más preciso será tu perfil de planificación.
                </p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Resultado principal */}
          <div className={cn("rounded-lg p-4", config.bgColor)}>
            <div className="flex items-start gap-3">
              <div className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                reliability.trend === 'accurate' ? "bg-emerald-100" :
                reliability.trend === 'underestimates' ? "bg-amber-100" :
                reliability.trend === 'overestimates' ? "bg-blue-100" : "bg-slate-100"
              )}>
                <IconComponent className={cn("h-5 w-5", config.textColor)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("font-bold text-lg", config.textColor)}>
                    {reliability.tasksAnalyzed >= 5 ? `${reliability.index}%` : '?'}
                  </span>
                  <span className={cn("text-sm font-medium", config.textColor)}>
                    {config.title}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{config.description}</p>
              </div>
            </div>
          </div>

          {/* Barra visual */}
          {reliability.tasksAnalyzed >= 5 && (
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Necesita más tiempo</span>
                <span className="font-medium">Perfecto ✨</span>
                <span>Sobra tiempo</span>
              </div>
              <div className="relative">
                <Progress value={getProgressValue()} className={cn("h-2", config.progressColor)} />
                <div className="absolute top-0 left-1/2 w-0.5 h-2 bg-slate-400 -translate-x-1/2" />
              </div>
            </div>
          )}

          {/* Estadísticas */}
          {reliability.tasksAnalyzed >= 5 && (
            <div className="grid grid-cols-2 gap-3 pt-2 border-t">
              <div className="text-center">
                <p className="text-lg font-bold text-slate-700">{reliability.totalEstimated}h</p>
                <p className="text-[10px] text-muted-foreground">Tiempo estimado</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-blue-600">{reliability.totalReal}h</p>
                <p className="text-[10px] text-muted-foreground">Tiempo dedicado</p>
              </div>
            </div>
          )}

          {/* Sección educativa - Más amigable */}
          <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
            <div className="flex items-start gap-2">
              <Lightbulb className="h-4 w-4 text-indigo-600 mt-0.5 shrink-0" />
              <div className="text-xs text-indigo-800">
                <p className="font-semibold mb-1">¿Para qué sirve esto?</p>
                <ul className="space-y-1 text-indigo-700">
                  <li className="flex items-start gap-1">
                    <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>Conocerte mejor y planificar con más calma</span>
                  </li>
                  <li className="flex items-start gap-1">
                    <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>Dar fechas más realistas a clientes y equipo</span>
                  </li>
                  <li className="flex items-start gap-1">
                    <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>Menos sorpresas de última hora</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Consejo contextual - Tono GPS */}
          {reliability.tasksAnalyzed >= 5 && reliability.trend !== 'accurate' && (
            <div className={cn(
              "rounded-lg p-3 border",
              reliability.trend === 'underestimates' ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-200"
            )}>
              <div className="flex items-start gap-2">
                <Sparkles className={cn(
                  "h-4 w-4 mt-0.5 shrink-0",
                  reliability.trend === 'underestimates' ? "text-amber-600" : "text-blue-600"
                )} />
                <p className={cn(
                  "text-xs",
                  reliability.trend === 'underestimates' ? "text-amber-800" : "text-blue-800"
                )}>
                  <span className="font-semibold">Tip: </span>
                  {reliability.trend === 'underestimates' 
                    ? `Suma un pequeño "colchón" (~${Math.round(100 - reliability.index)}%) a tus tiempos para ir más tranquilo.`
                    : `¡Genial! Podrías ajustar tus estimaciones un ${Math.round(reliability.index - 100)}% a la baja si quieres ser más preciso.`
                  }
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
});
