import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  X, ChevronLeft, ChevronRight, ListPlus, Clock, Calendar, 
  TrendingUp, Users, LayoutDashboard, Target, Sparkles, 
  CheckCircle2, AlertOctagon, MousePointerClick, Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TOUR_STORAGE_KEY = 'timeboxing_welcome_tour_completed';

interface TourStep {
  id: string;
  target: string; // CSS selector o ID
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
    title: 'Añadir Tareas',
    description: 'Aquí puedes planificar tu trabajo. Añade múltiples tareas a la vez, selecciona el proyecto, las horas y la semana. Verás alertas si te pasas del presupuesto.',
    icon: <ListPlus className="w-6 h-6 text-indigo-500" />,
    position: 'bottom',
    highlight: true
  },
  {
    id: 'internal-tasks',
    target: '[data-tour="internal-tasks"]',
    title: 'Gestión Interna',
    description: 'Reuniones, formaciones, deadlines... Todo el tiempo que no está asociado a un cliente va aquí. Se registra automáticamente como completado.',
    icon: <Clock className="w-6 h-6 text-slate-500" />,
    position: 'bottom',
    highlight: true
  },
  {
    id: 'goals',
    target: '[data-tour="goals"]',
    title: 'Tus Objetivos',
    description: 'Aquí puedes ver y gestionar tus objetivos profesionales (OKRs). Mantén el foco en lo que importa.',
    icon: <TrendingUp className="w-6 h-6 text-emerald-500" />,
    position: 'bottom',
    highlight: true
  },
  {
    id: 'absences',
    target: '[data-tour="absences"]',
    title: 'Ausencias',
    description: 'Solicita vacaciones, bajas o cualquier tipo de ausencia. Tu capacidad se ajustará automáticamente.',
    icon: <Calendar className="w-6 h-6 text-amber-500" />,
    position: 'bottom',
    highlight: true
  },
  {
    id: 'calendar',
    target: '[data-tour="calendar"]',
    title: 'Tu Calendario',
    description: 'Vista mensual de tu carga de trabajo. Los colores indican tu ocupación: verde (OK), amarillo (casi lleno), rojo (sobrecargado). Haz clic en cualquier semana para ver los detalles.',
    icon: <LayoutDashboard className="w-6 h-6 text-blue-500" />,
    position: 'bottom',
    highlight: true
  },
  {
    id: 'priority-widget',
    target: '[data-tour="priority-widget"]',
    title: 'Recomendaciones Inteligentes',
    description: 'Te avisamos de lo más importante: si estás bloqueando a alguien, tareas casi terminadas, o por dónde empezar. ¡Presta atención a los avisos rojos!',
    icon: <AlertOctagon className="w-6 h-6 text-red-500" />,
    position: 'right',
    highlight: true
  },
  {
    id: 'dependencies-widget',
    target: '[data-tour="dependencies-widget"]',
    title: 'Estado de Dependencias',
    description: 'Ve quién espera por ti y por quién estás esperando. Las dependencias en verde ya están listas para que empieces.',
    icon: <Users className="w-6 h-6 text-indigo-500" />,
    position: 'top',
    highlight: true
  },
  {
    id: 'projects-summary',
    target: '[data-tour="projects-summary"]',
    title: 'Resumen de Proyectos',
    description: 'Todos tus proyectos del mes con las horas asignadas, completadas y el estado del presupuesto.',
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

interface WelcomeTourProps {
  onComplete?: () => void;
  forceShow?: boolean;
}

export function WelcomeTour({ onComplete, forceShow = false }: WelcomeTourProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [isReady, setIsReady] = useState(false);

  // Verificar si debe mostrarse
  useEffect(() => {
    if (forceShow) {
      setIsVisible(true);
      setCurrentStep(0);
      return;
    }

    const completed = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!completed) {
      const timer = setTimeout(() => setIsVisible(true), 500);
      return () => clearTimeout(timer);
    }
  }, [forceShow]);

  // Función para calcular posiciones
  const calculatePositions = useCallback(() => {
    const step = tourSteps[currentStep];
    
    if (step.position === 'center' || !step.highlight) {
      setHighlightStyle(null);
      setTooltipStyle({
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10000
      });
      setIsReady(true);
      return;
    }

    const element = document.querySelector(step.target);
    if (!element) {
      setHighlightStyle(null);
      setTooltipStyle({
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10000
      });
      setIsReady(true);
      return;
    }

    // Obtener posición actual del elemento
    const rect = element.getBoundingClientRect();
    
    // Highlight
    const padding = 8;
    setHighlightStyle({
      position: 'fixed',
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
      zIndex: 9999
    });

    // Tooltip
    const tooltipWidth = 380;
    const tooltipHeight = 300;
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

    setTooltipStyle({
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      zIndex: 10000
    });
    
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

    const element = document.querySelector(step.target);
    if (!element) {
      calculatePositions();
      return;
    }

    // Primero hacer scroll al elemento
    const rect = element.getBoundingClientRect();
    const absoluteTop = rect.top + window.scrollY;
    const targetScroll = absoluteTop - 150; // 150px desde arriba
    
    window.scrollTo({
      top: Math.max(0, targetScroll),
      behavior: 'smooth'
    });

    // Esperar a que termine el scroll y luego calcular posiciones
    const timer = setTimeout(() => {
      calculatePositions();
    }, 500);

    return () => clearTimeout(timer);
  }, [currentStep, isVisible, calculatePositions]);

  // Recalcular en resize
  useEffect(() => {
    if (!isVisible) return;
    
    const handleResize = () => calculatePositions();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isVisible, calculatePositions]);

  const handleNext = useCallback(() => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  }, [currentStep]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const handleComplete = useCallback(() => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    setIsVisible(false);
    onComplete?.();
  }, [onComplete]);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, [handleComplete]);

  // Keyboard navigation
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'Escape') handleSkip();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, handleNext, handlePrev, handleSkip]);

  if (!isVisible) return null;

  const step = tourSteps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === tourSteps.length - 1;
  const isCentered = step.position === 'center';

  return (
    <>
      {/* Overlay oscuro */}
      <div className="fixed inset-0 bg-black/70 z-[9998]" />

      {/* Highlight del elemento actual */}
      {highlightStyle && isReady && (
        <div
          className="pointer-events-none rounded-xl transition-all duration-300 ease-out"
          style={{
            ...highlightStyle,
            border: '3px solid #6366f1',
            boxShadow: '0 0 0 4px rgba(99, 102, 241, 0.3), 0 0 20px rgba(99, 102, 241, 0.4)',
            background: 'rgba(255, 255, 255, 0.1)'
          }}
        >
          {/* Pulso animado */}
          <div className="absolute inset-0 rounded-xl border-2 border-indigo-400 animate-ping opacity-30" />
        </div>
      )}

      {/* Tooltip/Card del paso actual */}
      {isReady && (
        <Card 
          className="w-[380px] shadow-2xl border-0 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300"
          style={tooltipStyle}
        >
        {/* Header con gradiente */}
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
        <div className="p-5">
          {step.customContent ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Ya conoces lo básico. Ahora, un consejo clave:
              </p>
              
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-100">
                <p className="text-sm font-medium text-indigo-900 mb-3">
                  📊 Registra tus horas <strong>reales</strong> y <strong>computadas</strong> con precisión:
                </p>
                <ul className="space-y-2 text-xs text-slate-600">
                  <li className="flex items-start gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span><strong>Mejora tus estimaciones</strong> con el tiempo</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Users className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                    <span><strong>Demuestra tu aportación</strong> a cada proyecto</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Target className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                    <span><strong>Identifica dónde optimizar</strong> tu tiempo</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <span><strong>Crece como profesional</strong> midiendo tu eficiencia</span>
                  </li>
                </ul>
              </div>
              
              <p className="text-xs text-center text-slate-500 italic">
                La diferencia entre "Real" y "Computada" es tu ganancia de eficiencia. ¡Hazla crecer!
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-600 leading-relaxed">
              {step.description}
            </p>
          )}

          {/* Indicador de interacción */}
          {step.highlight && (
            <div className="flex items-center gap-2 mt-3 text-xs text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg">
              <MousePointerClick className="w-4 h-4" />
              <span>Elemento resaltado arriba</span>
            </div>
          )}
        </div>

        {/* Footer con navegación */}
        <div className="px-5 pb-5">
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

          {/* Botones */}
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
                    ¡Empezar!
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
    </>
  );
}

// Hook para controlar el tour desde fuera
export function useWelcomeTour() {
  const [showTour, setShowTour] = useState(false);

  const startTour = () => setShowTour(true);
  const endTour = () => setShowTour(false);
  
  const resetTour = () => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
    setShowTour(true);
  };

  const isTourCompleted = () => {
    return localStorage.getItem(TOUR_STORAGE_KEY) === 'true';
  };

  return { showTour, startTour, endTour, resetTour, isTourCompleted };
}
