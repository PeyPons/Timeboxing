import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

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
    element.style.boxShadow = '0 0 0 3px #818cf8, 0 0 0 6px rgba(129, 140, 248, 0.3), 0 0 20px rgba(129, 140, 248, 0.5)';
    element.style.position = 'relative';
    element.style.zIndex = '100';
    element.style.background = 'white';
    element.classList.add('tour-highlighted');
  }, []);

  const calculateTooltipPosition = useCallback((element: HTMLElement | null) => {
    if (!element) {
      setTooltipPosition(null);
      return;
    }

    const rect = element.getBoundingClientRect();
    const tooltipWidth = 320;
    const tooltipHeight = 220;
    const gap = 12;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = 0;
    let left = 0;

    // Intentar posicionar debajo del elemento
    if (rect.bottom + gap + tooltipHeight < viewportHeight) {
      top = rect.bottom + gap;
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
    } 
    // Si no cabe abajo, intentar arriba
    else if (rect.top - gap - tooltipHeight > 0) {
      top = rect.top - gap - tooltipHeight;
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
    }
    // Si no cabe, a la derecha
    else if (rect.right + gap + tooltipWidth < viewportWidth) {
      top = rect.top + rect.height / 2 - tooltipHeight / 2;
      left = rect.right + gap;
    }
    // Última opción: a la izquierda
    else {
      top = rect.top + rect.height / 2 - tooltipHeight / 2;
      left = rect.left - gap - tooltipWidth;
    }

    // Ajustar para que no se salga de la pantalla
    left = Math.max(16, Math.min(left, viewportWidth - tooltipWidth - 16));
    top = Math.max(16, Math.min(top, viewportHeight - tooltipHeight - 16));

    setTooltipPosition({ top, left });
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const step = tourSteps[currentStep];
    
    cleanupHighlight();

    if (step.target) {
      const timer = setTimeout(() => {
        const element = document.querySelector(step.target!) as HTMLElement;
        if (element) {
          setHighlightedElement(element);
          applyHighlight(element);
          calculateTooltipPosition(element);
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          setHighlightedElement(null);
          setTooltipPosition(null);
        }
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setHighlightedElement(null);
      setTooltipPosition(null);
    }
  }, [isVisible, currentStep, cleanupHighlight, applyHighlight, calculateTooltipPosition]);

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
  const isCentered = !step.target || !tooltipPosition;

  return (
    <>
      {/* Overlay semi-transparente */}
      <div 
        className="absolute inset-0 bg-black/40 z-[60] rounded-lg"
        onClick={handleSkip}
      />
      
      {/* Tooltip posicionado junto al elemento */}
      <div 
        ref={tooltipRef}
        className="fixed z-[70] animate-in fade-in slide-in-from-bottom-2 duration-200"
        style={isCentered ? {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        } : {
          top: tooltipPosition?.top,
          left: tooltipPosition?.left,
        }}
      >
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden w-[320px] border border-slate-200">
          {/* Progress bar */}
          <div className="h-1 bg-slate-100">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Header compacto */}
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-white/20 rounded-lg">
                  {step.icon}
                </div>
                <div>
                  <h3 className="font-bold">{step.title}</h3>
                  <p className="text-[10px] text-white/70">Paso {currentStep + 1} de {tourSteps.length}</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-white/70 hover:text-white hover:bg-white/20 h-7 w-7"
                onClick={handleSkip}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Content compacto */}
          <div className="p-3">
            <p className="text-sm text-slate-600 leading-relaxed">
              {step.description}
            </p>
            
            {step.tip && (
              <div className="flex items-start gap-2 mt-2 p-2 bg-amber-50 border border-amber-100 rounded-lg">
                <Lightbulb className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-[11px] text-amber-700">{step.tip}</p>
              </div>
            )}
          </div>

          {/* Footer compacto */}
          <div className="px-3 pb-3">
            {/* Dots */}
            <div className="flex justify-center gap-1 mb-2">
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
                className="text-slate-400 hover:text-slate-600 h-7 px-2 text-xs"
              >
                Saltar
              </Button>

              <div className="flex gap-1.5">
                {!isFirstStep && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrev}
                    className="gap-1 h-7 text-xs"
                  >
                    <ChevronLeft className="w-3 h-3" />
                    Ant.
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleNext}
                  className="gap-1 bg-indigo-600 hover:bg-indigo-700 h-7 text-xs"
                >
                  {isLastStep ? (
                    <>
                      ¡Listo!
                      <CheckCircle2 className="w-3 h-3" />
                    </>
                  ) : (
                    <>
                      Sig.
                      <ChevronRight className="w-3 h-3" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Flecha apuntando al elemento (si no está centrado) */}
        {!isCentered && highlightedElement && (
          <div 
            className="absolute w-3 h-3 bg-white border-l border-t border-slate-200 rotate-45"
            style={{
              top: -6,
              left: '50%',
              marginLeft: -6,
            }}
          />
        )}
      </div>

      {/* CSS para la animación del highlight */}
      <style>{`
        .tour-highlighted {
          animation: tour-glow 1.5s ease-in-out infinite;
        }
        @keyframes tour-glow {
          0%, 100% {
            box-shadow: 0 0 0 3px #818cf8, 0 0 0 6px rgba(129, 140, 248, 0.3), 0 0 20px rgba(129, 140, 248, 0.5);
          }
          50% {
            box-shadow: 0 0 0 3px #a78bfa, 0 0 0 10px rgba(129, 140, 248, 0.15), 0 0 30px rgba(129, 140, 248, 0.6);
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
