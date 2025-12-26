import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  X, ChevronLeft, ChevronRight, ListPlus, Clock, Calendar, 
  TrendingUp, Target, Sparkles, CheckCircle2, FileDown, Users
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TOUR_STORAGE_KEY = 'timeboxing_welcome_tour_completed';

interface TourStep {
  id: string;
  target: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  highlight?: boolean;
  customContent?: boolean;
}

const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    target: 'body',
    title: '¡Bienvenido a Timeboxing! 🎉',
    description: 'Este es tu panel de control personal. Te guiaremos por las funciones principales para que empieces con buen pie.',
    icon: <Sparkles className="w-6 h-6 text-indigo-500" />,
    position: 'center'
  },
  {
    id: 'add-tasks',
    target: '[data-tour="add-tasks"]',
    title: 'Añadir tareas',
    description: 'Planifica tu trabajo añadiendo múltiples tareas a la vez. Selecciona el proyecto, las horas y la semana. Verás alertas si te pasas del presupuesto.',
    icon: <ListPlus className="w-6 h-6 text-indigo-500" />,
    position: 'bottom',
    highlight: true
  },
  {
    id: 'crm-export',
    target: '[data-tour="crm-export"]',
    title: 'Exportar al CRM',
    description: 'Exporta tus tareas planificadas al CRM con un solo clic. Se generará un archivo CSV listo para importar. Necesitas tener configurado tu ID de usuario del CRM.',
    icon: <FileDown className="w-6 h-6 text-purple-500" />,
    position: 'bottom',
    highlight: true
  },
  {
    id: 'internal-tasks',
    target: '[data-tour="internal-tasks"]',
    title: 'Gestión interna',
    description: 'Registra reuniones, formaciones, deadlines y otras tareas que no están asociadas a clientes. Se registran automáticamente como completadas.',
    icon: <Clock className="w-6 h-6 text-slate-500" />,
    position: 'bottom',
    highlight: true
  },
  {
    id: 'goals',
    target: '[data-tour="goals"]',
    title: 'Tus objetivos',
    description: 'Gestiona tus objetivos profesionales (OKRs) con resultados clave medibles. Mantén el foco en lo que importa para tu crecimiento.',
    icon: <TrendingUp className="w-6 h-6 text-emerald-500" />,
    position: 'bottom',
    highlight: true
  },
  {
    id: 'absences',
    target: '[data-tour="absences"]',
    title: 'Ausencias',
    description: 'Registra tus vacaciones, bajas o permisos para que el planificador tenga en cuenta tu disponibilidad real. Tu capacidad se ajustará automáticamente.',
    icon: <Calendar className="w-6 h-6 text-amber-500" />,
    position: 'bottom',
    highlight: true
  },
  {
    id: 'calendar',
    target: '[data-tour="calendar"]',
    title: 'Tu calendario',
    description: 'Vista mensual de tu carga de trabajo. Los colores indican tu ocupación: verde (OK), amarillo (casi lleno), rojo (sobrecargado). Haz clic en cualquier semana para ver los detalles.',
    icon: <Calendar className="w-6 h-6 text-blue-500" />,
    position: 'bottom',
    highlight: true
  },
  {
    id: 'projects-summary',
    target: '[data-tour="projects-summary"]',
    title: 'Tus proyectos e impacto',
    description: 'Ve todos tus proyectos del mes con métricas de impacto. Descubre con quién colaboras más y quién tiene disponibilidad para ayudarte si lo necesitas.',
    icon: <Target className="w-6 h-6 text-purple-500" />,
    position: 'top',
    highlight: true
  },
  {
    id: 'finish',
    target: 'body',
    title: '¡A por ello! 💪',
    description: '',
    icon: <CheckCircle2 className="w-6 h-6 text-emerald-500" />,
    position: 'center',
    customContent: true
  }
];

interface HighlightPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface WelcomeTourProps {
  onComplete?: () => void;
  forceShow?: boolean;
}

export function useWelcomeTour() {
  const [showTour, setShowTour] = useState(false);
  const [isTourCompleted, setIsTourCompleted] = useState(true);

  useEffect(() => {
    const completed = localStorage.getItem(TOUR_STORAGE_KEY) === 'true';
    setIsTourCompleted(completed);
    if (!completed) {
      const timer = setTimeout(() => setShowTour(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const startTour = useCallback(() => setShowTour(true), []);
  
  const resetTour = useCallback(() => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
    setIsTourCompleted(false);
    setShowTour(true);
  }, []);

  return { showTour, startTour, resetTour, isTourCompleted };
}

export function WelcomeTour({ onComplete, forceShow }: WelcomeTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [highlightPosition, setHighlightPosition] = useState<HighlightPosition | null>(null);

  useEffect(() => {
    if (forceShow) {
      setIsVisible(true);
      setCurrentStep(0);
    }
  }, [forceShow]);

  useEffect(() => {
    if (!isVisible) return;

    const step = tourSteps[currentStep];
    if (step.position === 'center') {
      setHighlightPosition(null);
      return;
    }

    const updatePosition = () => {
      const element = document.querySelector(step.target);
      if (element) {
        const rect = element.getBoundingClientRect();
        setHighlightPosition({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height
        });

        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [currentStep, isVisible]);

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
    onComplete?.();
  };

  const handleSkip = () => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    setIsVisible(false);
    setCurrentStep(0);
  };

  if (!isVisible) return null;

  const step = tourSteps[currentStep];

  const getTooltipPosition = () => {
    if (!highlightPosition || step.position === 'center') {
      return {
        position: 'fixed' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      };
    }

    const padding = 16;
    const tooltipWidth = 320;
    const tooltipHeight = 200;

    switch (step.position) {
      case 'bottom':
        return {
          position: 'absolute' as const,
          top: highlightPosition.top + highlightPosition.height + padding,
          left: Math.max(padding, Math.min(
            highlightPosition.left + highlightPosition.width / 2 - tooltipWidth / 2,
            window.innerWidth - tooltipWidth - padding
          ))
        };
      case 'top':
        return {
          position: 'absolute' as const,
          top: highlightPosition.top - tooltipHeight - padding,
          left: Math.max(padding, Math.min(
            highlightPosition.left + highlightPosition.width / 2 - tooltipWidth / 2,
            window.innerWidth - tooltipWidth - padding
          ))
        };
      case 'left':
        return {
          position: 'absolute' as const,
          top: highlightPosition.top + highlightPosition.height / 2 - tooltipHeight / 2,
          left: highlightPosition.left - tooltipWidth - padding
        };
      case 'right':
        return {
          position: 'absolute' as const,
          top: highlightPosition.top + highlightPosition.height / 2 - tooltipHeight / 2,
          left: highlightPosition.left + highlightPosition.width + padding
        };
      default:
        return {};
    }
  };

  const portalContent = (
    <>
      {/* Overlay oscuro */}
      <div 
        className="fixed inset-0 bg-black/60 z-[9998] transition-opacity duration-300"
        onClick={handleSkip}
      />
      
      {/* Highlight del elemento */}
      {highlightPosition && step.highlight && (
        <div
          className="absolute z-[9999] rounded-lg ring-4 ring-indigo-500 ring-offset-4 ring-offset-white pointer-events-none transition-all duration-300"
          style={{
            top: highlightPosition.top - 4,
            left: highlightPosition.left - 4,
            width: highlightPosition.width + 8,
            height: highlightPosition.height + 8,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)'
          }}
        />
      )}
      
      {/* Tooltip */}
      <Card
        className="z-[10000] w-80 shadow-2xl border-indigo-200 animate-in fade-in slide-in-from-bottom-4 duration-300"
        style={getTooltipPosition()}
      >
        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                {step.icon}
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{step.title}</h3>
                <p className="text-xs text-slate-500">
                  Paso {currentStep + 1} de {tourSteps.length}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-slate-400 hover:text-slate-600"
              onClick={handleSkip}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Content */}
          {step.customContent && step.id === 'finish' ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Ya conoces las funciones principales. Recuerda:
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>Planifica tus tareas al inicio de cada semana</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>Registra las horas reales al completar tareas</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>Revisa tu índice de fiabilidad para mejorar</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>Colabora con compañeros que necesiten ayuda</span>
                </li>
              </ul>
            </div>
          ) : (
            <p className="text-sm text-slate-600 mb-4">
              {step.description}
            </p>
          )}
          
          {/* Progress dots */}
          <div className="flex justify-center gap-1.5 my-4">
            {tourSteps.map((_, index) => (
              <div
                key={index}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  index === currentStep 
                    ? "w-6 bg-indigo-600" 
                    : index < currentStep 
                      ? "w-1.5 bg-indigo-300"
                      : "w-1.5 bg-slate-200"
                )}
              />
            ))}
          </div>
          
          {/* Navigation */}
          <div className="flex justify-between items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrev}
              disabled={currentStep === 0}
              className={cn(currentStep === 0 && "invisible")}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>
            
            <Button
              size="sm"
              onClick={handleNext}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {currentStep === tourSteps.length - 1 ? (
                '¡Empezar!'
              ) : (
                <>
                  Siguiente
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </>
  );

  return createPortal(portalContent, document.body);
}
