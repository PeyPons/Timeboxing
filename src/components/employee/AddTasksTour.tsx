import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { 
  X, ChevronLeft, ChevronRight, FolderOpen, FileText, 
  Clock, Calendar, Plus, CheckCircle2, Sparkles, Lightbulb
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TOUR_STORAGE_KEY = 'timeboxing_add_tasks_tour_completed';

interface TourStep {
  id: string;
  target?: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  tip?: string;
}

const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: '¡Planifica tu trabajo! 📋',
    description: 'Este formulario te permite añadir múltiples tareas a la vez. Te explico cada campo.',
    icon: <Sparkles className="w-5 h-5" />,
  },
  {
    id: 'project',
    target: '[data-tour-task="project"]',
    title: 'Proyecto',
    description: 'Selecciona el proyecto o cliente. Si está cerca del límite de horas, verás un indicador amarillo.',
    icon: <FolderOpen className="w-5 h-5" />,
  },
  {
    id: 'task',
    target: '[data-tour-task="task-name"]',
    title: 'Nombre de la Tarea',
    description: 'Describe qué vas a hacer: "Diseño landing", "Informe mensual", etc.',
    icon: <FileText className="w-5 h-5" />,
  },
  {
    id: 'hours',
    target: '[data-tour-task="hours"]',
    title: 'Horas',
    description: 'Cuántas horas estimas. Usa decimales si necesitas (1.5 = hora y media).',
    icon: <Clock className="w-5 h-5" />,
    tip: 'Se resalta en amarillo si excedes tu capacidad semanal.',
  },
  {
    id: 'week',
    target: '[data-tour-task="week"]',
    title: 'Semana',
    description: 'En qué semana del mes harás la tarea. Verás la ocupación de cada una.',
    icon: <Calendar className="w-5 h-5" />,
  },
  {
    id: 'add-row',
    target: '[data-tour-task="add-row"]',
    title: 'Añadir filas',
    description: 'Añade tantas tareas como necesites. El proyecto y semana se copian automáticamente.',
    icon: <Plus className="w-5 h-5" />,
  },
  {
    id: 'finish',
    title: '¡Listo! ✨',
    description: 'Ya conoces el formulario. El resumen inferior te avisa si hay alertas antes de guardar.',
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
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      const completed = localStorage.getItem(TOUR_STORAGE_KEY);
      if (!completed) {
        const timer = setTimeout(() => {
          setIsVisible(true);
          setCurrentStep(0);
        }, 600);
        return () => clearTimeout(timer);
      }
    } else {
      setIsVisible(false);
      setCurrentStep(0);
      cleanupHighlight();
    }
  }, [isOpen]);

  const cleanupHighlight = useCallback(() => {
    if (highlightedElement) {
      highlightedElement.style.removeProperty('box-shadow');
      highlightedElement.style.removeProperty('position');
      highlightedElement.style.removeProperty('z-index');
      highlightedElement.style.removeProperty('background');
      highlightedElement.classList.remove('tour-highlighted');
    }
  }, [highlightedElement]);

  const applyHighlight = useCallback((element: HTMLElement) => {
    element.style.boxShadow = '0 0 0 4px #818cf8, 0 0 0 8px rgba(129, 140, 248, 0.3), 0 0 30px rgba(129, 140, 248, 0.5)';
    element.style.position = 'relative';
    element.style.zIndex = '10';
    element.style.background = 'white';
    element.classList.add('tour-highlighted');
    
    // Scroll into view si es necesario
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const step = tourSteps[currentStep];
    
    // Limpiar highlight anterior
    cleanupHighlight();

    if (step.target) {
      const timer = setTimeout(() => {
        const element = document.querySelector(step.target!) as HTMLElement;
        if (element) {
          setHighlightedElement(element);
          applyHighlight(element);
        }
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setHighlightedElement(null);
    }
  }, [isVisible, currentStep, cleanupHighlight, applyHighlight]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanupHighlight();
  }, [cleanupHighlight]);

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
    cleanupHighlight();
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    setIsVisible(false);
    setCurrentStep(0);
    onComplete();
  };

  const handleSkip = () => {
    cleanupHighlight();
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
    <>
      {/* Overlay semi-transparente dentro del dialog */}
      <div 
        className="absolute inset-0 bg-black/50 z-40 rounded-lg"
        onClick={handleSkip}
      />
      
      {/* Card del tour - posición fija en el centro del dialog */}
      <div 
        className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
      >
        <div 
          className="bg-white rounded-xl shadow-2xl overflow-hidden w-[360px] pointer-events-auto animate-in fade-in zoom-in-95 duration-200"
        >
          {/* Progress bar */}
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

          {/* Content */}
          <div className="p-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              {step.description}
            </p>
            
            {step.tip && (
              <div className="flex items-start gap-2 mt-3 p-2.5 bg-amber-50 border border-amber-100 rounded-lg">
                <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700">{step.tip}</p>
              </div>
            )}

            {step.target && (
              <div className="mt-3 text-xs text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg text-center">
                👆 Mira el campo resaltado en púrpura
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 pb-4">
            {/* Dots */}
            <div className="flex justify-center gap-1.5 mb-3">
              {tourSteps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentStep(index)}
                  className={cn(
                    "w-1.5 h-1.5 rounded-full transition-all duration-200",
                    index === currentStep 
                      ? "bg-indigo-500 w-4" 
                      : index < currentStep
                        ? "bg-indigo-300"
                        : "bg-slate-200"
                  )}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="text-slate-400 hover:text-slate-600 h-8 px-2 text-xs"
              >
                Saltar
              </Button>

              <div className="flex gap-2">
                {!isFirstStep && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrev}
                    className="gap-1 h-8"
                  >
                    <ChevronLeft className="w-3 h-3" />
                    Anterior
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleNext}
                  className="gap-1 bg-indigo-600 hover:bg-indigo-700 h-8"
                >
                  {isLastStep ? (
                    <>
                      ¡Entendido!
                      <CheckCircle2 className="w-3 h-3" />
                    </>
                  ) : (
                    <>
                      Siguiente
                      <ChevronRight className="w-3 h-3" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CSS para la animación del highlight */}
      <style>{`
        .tour-highlighted {
          animation: tour-glow 1.5s ease-in-out infinite;
        }
        @keyframes tour-glow {
          0%, 100% {
            box-shadow: 0 0 0 4px #818cf8, 0 0 0 8px rgba(129, 140, 248, 0.3), 0 0 30px rgba(129, 140, 248, 0.5);
          }
          50% {
            box-shadow: 0 0 0 4px #818cf8, 0 0 0 12px rgba(129, 140, 248, 0.2), 0 0 40px rgba(129, 140, 248, 0.7);
          }
        }
      `}</style>
    </>
  );
}

export function useAddTasksTour() {
  const [showTour, setShowTour] = useState(false);

  const shouldShowTour = () => !localStorage.getItem(TOUR_STORAGE_KEY);
  const triggerTour = () => { if (shouldShowTour()) setShowTour(true); };
  const completeTour = () => setShowTour(false);
  const resetTour = () => localStorage.removeItem(TOUR_STORAGE_KEY);

  return { showTour, triggerTour, completeTour, resetTour, shouldShowTour };
}
