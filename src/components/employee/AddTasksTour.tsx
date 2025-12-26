import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  X, ChevronLeft, ChevronRight, FolderOpen, FileText, 
  Clock, Calendar, Plus, AlertTriangle, CheckCircle2,
  Sparkles, Target, Lightbulb, MousePointerClick
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TOUR_STORAGE_KEY = 'timeboxing_add_tasks_tour_completed';

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  tip?: string;
  highlightClass?: string;
}

const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: '¡Planifica tu trabajo! 📋',
    description: 'Este formulario te permite añadir múltiples tareas a la vez de forma rápida. Vamos a ver cada campo.',
    icon: <Sparkles className="w-5 h-5" />,
  },
  {
    id: 'project',
    title: 'Proyecto',
    description: 'Selecciona el proyecto o cliente para el que trabajarás. Puedes buscar escribiendo el nombre.',
    icon: <FolderOpen className="w-5 h-5" />,
    tip: 'Si el proyecto está cerca de su límite de horas, verás un indicador amarillo.',
    highlightClass: 'project-column',
  },
  {
    id: 'task',
    title: 'Nombre de la Tarea',
    description: 'Describe brevemente qué vas a hacer. Por ejemplo: "Diseño landing page", "Informe mensual", "Reunión cliente".',
    icon: <FileText className="w-5 h-5" />,
    tip: 'Sé específico para que luego sea fácil recordar qué hiciste.',
    highlightClass: 'task-column',
  },
  {
    id: 'hours',
    title: 'Horas Planificadas',
    description: 'Indica cuántas horas estimas que te llevará. Puedes usar decimales (ej: 1.5 para hora y media).',
    icon: <Clock className="w-5 h-5" />,
    tip: 'Si te pasas de tu capacidad semanal, el campo se resaltará en amarillo.',
    highlightClass: 'hours-column',
  },
  {
    id: 'week',
    title: 'Semana',
    description: 'Elige en qué semana del mes realizarás la tarea. Verás tu ocupación actual de cada semana.',
    icon: <Calendar className="w-5 h-5" />,
    tip: 'Las semanas sobrecargadas se muestran con el total de horas.',
    highlightClass: 'week-column',
  },
  {
    id: 'add-row',
    title: 'Añadir más filas',
    description: 'Puedes añadir tantas tareas como necesites con el botón "+ Añadir otra fila". No hay límite.',
    icon: <Plus className="w-5 h-5" />,
    tip: 'El proyecto y semana se copian de la fila anterior para ir más rápido.',
  },
  {
    id: 'alerts',
    title: 'Sistema de Alertas',
    description: 'El sistema te avisa en tiempo real si alguna semana o proyecto se pasaría del presupuesto.',
    icon: <AlertTriangle className="w-5 h-5" />,
    tip: 'Los indicadores amarillos son advertencias. Puedes guardar igualmente, pero revisa antes.',
  },
  {
    id: 'summary',
    title: 'Resumen de Impacto',
    description: 'Antes de guardar, verás un resumen mostrando el impacto de tus tareas en cada proyecto y semana.',
    icon: <Target className="w-5 h-5" />,
    tip: 'Verde = todo OK. Amarillo = revisar límites.',
  },
  {
    id: 'finish',
    title: '¡Listo para planificar! ✨',
    description: 'Ya conoces todas las herramientas. Planifica tu semana y mantén el control de tu tiempo.',
    icon: <CheckCircle2 className="w-5 h-5" />,
  }
];

interface AddTasksTourProps {
  isOpen: boolean;
  onComplete: () => void;
}

export function AddTasksTour({ isOpen, onComplete }: AddTasksTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const completed = localStorage.getItem(TOUR_STORAGE_KEY);
      if (!completed) {
        const timer = setTimeout(() => setIsVisible(true), 300);
        return () => clearTimeout(timer);
      }
    } else {
      setIsVisible(false);
      setCurrentStep(0);
    }
  }, [isOpen]);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    setIsVisible(false);
    setCurrentStep(0);
    onComplete();
  };

  const handleSkip = () => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    setIsVisible(false);
    setCurrentStep(0);
    onComplete();
  };

  if (!isVisible) return null;

  const step = tourSteps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === tourSteps.length - 1;
  const progress = ((currentStep + 1) / tourSteps.length) * 100;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Overlay oscuro */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleSkip}
      />
      
      {/* Card del tour */}
      <Card className="relative z-10 w-full max-w-md mx-4 shadow-2xl border-0 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Barra de progreso */}
        <div className="h-1 bg-slate-100">
          <div 
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                {step.icon}
              </div>
              <div>
                <h3 className="font-bold text-lg">{step.title}</h3>
                <p className="text-xs text-white/70">Paso {currentStep + 1} de {tourSteps.length}</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-white/70 hover:text-white hover:bg-white/20 h-8 w-8"
              onClick={handleSkip}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-5 bg-white">
          <p className="text-sm text-slate-600 leading-relaxed">
            {step.description}
          </p>
          
          {step.tip && (
            <div className="flex items-start gap-2 mt-4 p-3 bg-amber-50 border border-amber-100 rounded-lg">
              <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800">{step.tip}</p>
            </div>
          )}

          {step.highlightClass && (
            <div className="flex items-center gap-2 mt-3 text-xs text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg">
              <MousePointerClick className="w-4 h-4" />
              <span>Mira la columna resaltada en el formulario</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 bg-white">
          {/* Indicadores de paso */}
          <div className="flex justify-center gap-1.5 mb-4">
            {tourSteps.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all duration-200",
                  index === currentStep 
                    ? "bg-indigo-500 w-6" 
                    : index < currentStep
                      ? "bg-indigo-300"
                      : "bg-slate-200"
                )}
              />
            ))}
          </div>

          {/* Botones de navegación */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="text-slate-400 hover:text-slate-600"
            >
              Saltar
            </Button>

            <div className="flex gap-2">
              {!isFirstStep && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrev}
                  className="gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleNext}
                className="gap-1 bg-indigo-600 hover:bg-indigo-700"
              >
                {isLastStep ? (
                  <>
                    ¡Entendido!
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    Siguiente
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Hook para controlar el tour
export function useAddTasksTour() {
  const [showTour, setShowTour] = useState(false);

  const shouldShowTour = () => {
    return !localStorage.getItem(TOUR_STORAGE_KEY);
  };

  const triggerTour = () => {
    if (shouldShowTour()) {
      setShowTour(true);
    }
  };

  const completeTour = () => {
    setShowTour(false);
  };

  const resetTour = () => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
  };

  return { showTour, triggerTour, completeTour, resetTour, shouldShowTour };
}
