import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  target?: string; // Selector CSS del elemento a resaltar
  title: string;
  description: string;
  icon: React.ReactNode;
  tip?: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  highlight?: boolean;
}

const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: '¡Planifica tu trabajo! 📋',
    description: 'Este formulario te permite añadir múltiples tareas a la vez de forma rápida. Vamos a ver cada campo.',
    icon: <Sparkles className="w-5 h-5" />,
    position: 'center',
  },
  {
    id: 'project',
    target: '[data-tour-task="project"]',
    title: 'Proyecto',
    description: 'Selecciona el proyecto o cliente para el que trabajarás. Puedes buscar escribiendo el nombre.',
    icon: <FolderOpen className="w-5 h-5" />,
    tip: 'Si el proyecto está cerca de su límite de horas, verás un indicador amarillo.',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'task',
    target: '[data-tour-task="task-name"]',
    title: 'Nombre de la Tarea',
    description: 'Describe brevemente qué vas a hacer. Ejemplos: "Diseño landing", "Informe mensual", "Reunión cliente".',
    icon: <FileText className="w-5 h-5" />,
    tip: 'Sé específico para que luego sea fácil recordar qué hiciste.',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'hours',
    target: '[data-tour-task="hours"]',
    title: 'Horas Planificadas',
    description: 'Indica cuántas horas estimas que te llevará. Puedes usar decimales (ej: 1.5 para hora y media).',
    icon: <Clock className="w-5 h-5" />,
    tip: 'Si te pasas de tu capacidad semanal, el campo se resaltará en amarillo.',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'week',
    target: '[data-tour-task="week"]',
    title: 'Semana',
    description: 'Elige en qué semana del mes realizarás la tarea. Verás tu ocupación actual de cada semana.',
    icon: <Calendar className="w-5 h-5" />,
    tip: 'Las semanas sobrecargadas muestran el total de horas asignadas.',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'add-row',
    target: '[data-tour-task="add-row"]',
    title: 'Añadir más filas',
    description: 'Puedes añadir tantas tareas como necesites. No hay límite.',
    icon: <Plus className="w-5 h-5" />,
    tip: 'El proyecto y semana se copian de la fila anterior para ir más rápido.',
    position: 'top',
    highlight: true,
  },
  {
    id: 'alerts',
    target: '[data-tour-task="summary"]',
    title: 'Resumen e Indicadores',
    description: 'Aquí verás el impacto de tus tareas. Verde = OK, Amarillo = revisar límites de presupuesto o capacidad.',
    icon: <AlertTriangle className="w-5 h-5" />,
    tip: 'Puedes guardar aunque haya advertencias, pero revisa antes.',
    position: 'top',
    highlight: true,
  },
  {
    id: 'finish',
    title: '¡Listo para planificar! ✨',
    description: 'Ya conoces todas las herramientas. Planifica tu semana y mantén el control de tu tiempo.',
    icon: <CheckCircle2 className="w-5 h-5" />,
    position: 'center',
  }
];

interface HighlightPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface AddTasksTourProps {
  isOpen: boolean;
  onComplete: () => void;
}

export function AddTasksTour({ isOpen, onComplete }: AddTasksTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [highlightPos, setHighlightPos] = useState<HighlightPosition | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Verificar si debe mostrarse
  useEffect(() => {
    if (isOpen) {
      const completed = localStorage.getItem(TOUR_STORAGE_KEY);
      if (!completed) {
        const timer = setTimeout(() => {
          setIsVisible(true);
          setCurrentStep(0);
        }, 400);
        return () => clearTimeout(timer);
      }
    } else {
      setIsVisible(false);
      setCurrentStep(0);
      setHighlightPos(null);
      setTooltipPos(null);
    }
  }, [isOpen]);

  // Calcular posiciones del highlight y tooltip
  const calculatePositions = useCallback(() => {
    const step = tourSteps[currentStep];
    
    if (step.position === 'center' || !step.highlight || !step.target) {
      setHighlightPos(null);
      setTooltipPos(null);
      setIsReady(true);
      return;
    }

    const element = document.querySelector(step.target);
    if (!element) {
      setHighlightPos(null);
      setTooltipPos(null);
      setIsReady(true);
      return;
    }

    const rect = element.getBoundingClientRect();
    
    // Posición del highlight
    const padding = 8;
    setHighlightPos({
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2
    });

    // Posición del tooltip
    const tooltipWidth = 380;
    const tooltipHeight = 280;
    const gap = 16;
    
    let top = 0;
    let left = 0;

    switch (step.position) {
      case 'bottom':
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'top':
        top = rect.top - tooltipHeight - gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - gap;
        break;
      case 'right':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + gap;
        break;
    }

    // Mantener en pantalla
    left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16));
    top = Math.max(16, Math.min(top, window.innerHeight - tooltipHeight - 16));

    setTooltipPos({ top, left });
    setIsReady(true);
  }, [currentStep]);

  // Actualizar posiciones cuando cambia el paso
  useEffect(() => {
    if (!isVisible) return;

    setIsReady(false);
    const step = tourSteps[currentStep];

    if (step.position === 'center' || !step.highlight) {
      calculatePositions();
      return;
    }

    // Esperar a que el elemento esté disponible
    const timer = setTimeout(() => {
      calculatePositions();
    }, 100);

    // Recalcular en resize
    window.addEventListener('resize', calculatePositions);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calculatePositions);
    };
  }, [isVisible, currentStep, calculatePositions]);

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
  const isCentered = step.position === 'center' || !step.highlight;

  const tourContent = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, pointerEvents: 'none' }}>
      {/* Overlay SVG con spotlight */}
      <svg 
        style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100vw', 
          height: '100vh',
          pointerEvents: 'auto'
        }}
        onClick={handleSkip}
      >
        <defs>
          <mask id="add-tasks-tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {highlightPos && isReady && (
              <rect 
                x={highlightPos.left - 2}
                y={highlightPos.top - 2}
                width={highlightPos.width + 4}
                height={highlightPos.height + 4}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect 
          x="0" 
          y="0" 
          width="100%" 
          height="100%" 
          fill="rgba(0, 0, 0, 0.75)" 
          mask="url(#add-tasks-tour-mask)"
        />
      </svg>

      {/* Borde animado del highlight */}
      {highlightPos && isReady && (
        <div
          style={{
            position: 'fixed',
            top: highlightPos.top - 2,
            left: highlightPos.left - 2,
            width: highlightPos.width + 4,
            height: highlightPos.height + 4,
            border: '3px solid #818cf8',
            borderRadius: '12px',
            boxShadow: '0 0 0 4px rgba(129, 140, 248, 0.3), 0 0 30px rgba(129, 140, 248, 0.5)',
            pointerEvents: 'none',
            zIndex: 100000
          }}
        >
          <div 
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '12px',
              border: '2px solid #a5b4fc',
              animation: 'add-task-tour-ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
              opacity: 0.4
            }}
          />
        </div>
      )}

      {/* Tooltip Card */}
      {isReady && (
        <Card 
          className="shadow-2xl border-0 overflow-hidden"
          style={{
            position: 'fixed',
            width: 380,
            top: isCentered ? '50%' : tooltipPos?.top,
            left: isCentered ? '50%' : tooltipPos?.left,
            transform: isCentered ? 'translate(-50%, -50%)' : undefined,
            zIndex: 100001,
            pointerEvents: 'auto'
          }}
        >
          {/* Header gradient */}
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

            {step.highlight && (
              <div className="flex items-center gap-2 mt-3 text-xs text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg">
                <MousePointerClick className="w-4 h-4" />
                <span>Elemento resaltado en el formulario</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 bg-white">
            {/* Progress dots */}
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

            {/* Navigation buttons */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="text-slate-400 hover:text-slate-600"
              >
                Saltar tour
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
      )}

      {/* Animation styles */}
      <style>{`
        @keyframes add-task-tour-ping {
          75%, 100% {
            transform: scale(1.05);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );

  return createPortal(tourContent, document.body);
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
