import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  X, ChevronLeft, ChevronRight, FolderOpen, FileText, 
  Clock, Calendar, Plus, AlertTriangle, CheckCircle2,
  Sparkles, Lightbulb
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
  const [isReady, setIsReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const completed = localStorage.getItem(TOUR_STORAGE_KEY);
      if (!completed) {
        const timer = setTimeout(() => {
          setIsVisible(true);
          setCurrentStep(0);
        }, 500);
        return () => clearTimeout(timer);
      }
    } else {
      setIsVisible(false);
      setCurrentStep(0);
      setHighlightPos(null);
    }
  }, [isOpen]);

  const calculatePositions = useCallback(() => {
    const step = tourSteps[currentStep];
    
    if (step.position === 'center' || !step.highlight || !step.target) {
      setHighlightPos(null);
      setIsReady(true);
      return;
    }

    const element = document.querySelector(step.target);
    if (!element) {
      console.log('Element not found:', step.target);
      setHighlightPos(null);
      setIsReady(true);
      return;
    }

    const rect = element.getBoundingClientRect();
    const padding = 6;
    
    setHighlightPos({
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2
    });
    
    setIsReady(true);
  }, [currentStep]);

  useEffect(() => {
    if (!isVisible) return;

    setIsReady(false);
    
    // Dar tiempo a que el DOM se actualice
    const timer = setTimeout(() => {
      calculatePositions();
    }, 150);

    window.addEventListener('resize', calculatePositions);
    window.addEventListener('scroll', calculatePositions, true);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calculatePositions);
      window.removeEventListener('scroll', calculatePositions, true);
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

  if (!isVisible || !isReady) return null;

  const step = tourSteps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === tourSteps.length - 1;
  const isCentered = step.position === 'center' || !step.highlight || !highlightPos;

  // Calcular posición del tooltip
  let tooltipStyle: React.CSSProperties = {};
  
  if (isCentered) {
    tooltipStyle = {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  } else if (highlightPos) {
    const gap = 12;
    const tooltipWidth = 380;
    
    switch (step.position) {
      case 'bottom':
        tooltipStyle = {
          position: 'fixed',
          top: highlightPos.top + highlightPos.height + gap,
          left: Math.max(16, Math.min(highlightPos.left + highlightPos.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 16)),
        };
        break;
      case 'top':
        tooltipStyle = {
          position: 'fixed',
          bottom: window.innerHeight - highlightPos.top + gap,
          left: Math.max(16, Math.min(highlightPos.left + highlightPos.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 16)),
        };
        break;
      case 'left':
        tooltipStyle = {
          position: 'fixed',
          top: highlightPos.top,
          right: window.innerWidth - highlightPos.left + gap,
        };
        break;
      case 'right':
        tooltipStyle = {
          position: 'fixed',
          top: highlightPos.top,
          left: highlightPos.left + highlightPos.width + gap,
        };
        break;
    }
  }

  return (
    <>
      {/* Overlay oscuro con hole para el elemento - z-index MUY ALTO para estar sobre el Dialog */}
      <div 
        ref={containerRef}
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 2147483646 }}
      >
        <svg 
          className="fixed inset-0 w-full h-full pointer-events-auto"
          onClick={(e) => {
            // Solo cerrar si click fuera del highlight
            if (highlightPos) {
              const rect = { x: highlightPos.left, y: highlightPos.top, width: highlightPos.width, height: highlightPos.height };
              const clickX = e.clientX;
              const clickY = e.clientY;
              if (clickX < rect.x || clickX > rect.x + rect.width || clickY < rect.y || clickY > rect.y + rect.height) {
                // Click fuera - no hacer nada, dejar que navegue
              }
            }
          }}
        >
          <defs>
            <mask id="tour-spotlight-mask-addtasks">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {highlightPos && (
                <rect 
                  x={highlightPos.left}
                  y={highlightPos.top}
                  width={highlightPos.width}
                  height={highlightPos.height}
                  rx="8"
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
            fill="rgba(0, 0, 0, 0.80)" 
            mask="url(#tour-spotlight-mask-addtasks)"
          />
        </svg>

        {/* Borde brillante alrededor del elemento */}
        {highlightPos && (
          <div
            className="pointer-events-none"
            style={{
              position: 'fixed',
              top: highlightPos.top - 3,
              left: highlightPos.left - 3,
              width: highlightPos.width + 6,
              height: highlightPos.height + 6,
              border: '3px solid #818cf8',
              borderRadius: '11px',
              boxShadow: '0 0 0 4px rgba(129, 140, 248, 0.4), 0 0 20px rgba(129, 140, 248, 0.6), inset 0 0 20px rgba(129, 140, 248, 0.1)',
              zIndex: 2147483647,
              animation: 'tour-pulse 2s ease-in-out infinite',
            }}
          />
        )}

        {/* Tooltip Card */}
        <Card 
          className="shadow-2xl border-0 overflow-hidden pointer-events-auto"
          style={{
            ...tooltipStyle,
            width: 380,
            zIndex: 2147483647,
          }}
        >
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
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 bg-white">
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
      </div>

      {/* Estilos de animación */}
      <style>{`
        @keyframes tour-pulse {
          0%, 100% {
            box-shadow: 0 0 0 4px rgba(129, 140, 248, 0.4), 0 0 20px rgba(129, 140, 248, 0.6);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(129, 140, 248, 0.2), 0 0 40px rgba(129, 140, 248, 0.8);
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
