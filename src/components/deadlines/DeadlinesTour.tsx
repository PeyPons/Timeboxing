import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  X, ChevronLeft, ChevronRight, Calendar, Users, Filter, 
  Search, Eye, EyeOff, Sparkles, CheckCircle2, Clock,
  TrendingUp, AlertTriangle, FileText, Target
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';

interface TourStep {
  id: string;
  target: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  highlight?: boolean;
  customContent?: boolean;
  interactive?: boolean; // Permite interacción con el elemento destacado
  interactionHint?: string; // Hint para el usuario
}

const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    target: 'body',
    title: '¡Bienvenido a Deadlines! 📅',
    description: 'Aquí gestionas la asignación de horas por proyecto y empleado cada mes. Te guiaremos por todas las funciones para que lo uses con confianza.',
    icon: <Sparkles className="w-6 h-6 text-indigo-500" />,
    position: 'center'
  },
  {
    id: 'month-selector',
    target: '[data-tour="month-selector"]',
    title: 'Selector de mes',
    description: 'Cambia entre meses para ver y editar los deadlines de diferentes períodos. Los cambios se guardan automáticamente por mes.',
    icon: <Calendar className="w-6 h-6 text-indigo-500" />,
    position: 'bottom',
    highlight: true,
    interactive: true,
    interactionHint: '👆 Prueba: haz clic en las flechas para cambiar de mes'
  },
  {
    id: 'filters',
    target: '[data-tour="filters"]',
    title: 'Filtros y búsqueda',
    description: 'Busca por nombre de proyecto o cliente, filtra por tipo de proyecto, muestra proyectos ocultos o solo los que aún no tienen asignación. El orden se puede cambiar por cliente o por empleado.',
    icon: <Filter className="w-6 h-6 text-purple-500" />,
    position: 'bottom',
    highlight: true,
    interactive: true,
    interactionHint: '🔍 Prueba: escribe en la barra de búsqueda'
  },
  {
    id: 'availability-panel',
    target: '[data-tour="availability-panel"]',
    title: 'Disponibilidad en tiempo real',
    description: 'Panel sticky que muestra la carga de cada empleado. Pasa el ratón sobre un empleado para ver el desglose de ausencias y eventos. Los colores indican su nivel de ocupación.',
    icon: <Users className="w-6 h-6 text-emerald-500" />,
    position: 'left',
    highlight: true,
    interactive: true,
    interactionHint: '🖱️ Pasa el ratón sobre un empleado para ver detalles'
  },
  {
    id: 'project-list',
    target: '[data-tour="project-list"]',
    title: 'Lista de proyectos',
    description: 'Proyectos agrupados por cliente. Haz clic en cualquier proyecto para editarlo. Verás quién está asignado y cuántas horas tiene cada uno. Los cambios se guardan automáticamente.',
    icon: <Target className="w-6 h-6 text-blue-500" />,
    position: 'top',
    highlight: true,
    interactive: true,
    interactionHint: '👆 Prueba: haz clic en cualquier proyecto para ver su editor'
  },
  {
    id: 'inline-editing',
    target: '[data-tour="inline-editing"]',
    title: 'Edición inline',
    description: 'Al hacer clic en un proyecto se abre el editor. Asigna horas por empleado, ajusta la regularización de presupuesto del mes si hace falta y oculta proyectos que no trabajes. Los cambios se guardan automáticamente.',
    icon: <FileText className="w-6 h-6 text-orange-500" />,
    position: 'bottom',
    highlight: true
  },
  {
    id: 'global-assignments',
    target: '[data-tour="global-assignments"]',
    title: 'Otras asignaciones',
    description: 'Tareas internas que suman horas a la carga del mes (reuniones, deadlines transversales…). Para vacaciones o festivos, usa los accesos justo debajo: restan disponibilidad, no van aquí.',
    icon: <Clock className="w-6 h-6 text-slate-500" />,
    position: 'left',
    highlight: true
  },
  {
    id: 'suggestions',
    target: '[data-tour="suggestions"]',
    title: 'Sugerencias de redistribución',
    description: 'El sistema detecta empleados sobrecargados y te sugiere a quién reasignar horas, teniendo en cuenta los proyectos en común. Puedes abrir el panel completo para aplicar cambios o excluir personas.',
    icon: <TrendingUp className="w-6 h-6 text-amber-500" />,
    position: 'left',
    highlight: true
  },
  {
    id: 'concurrent-editing',
    target: '[data-tour="concurrent-editing"]',
    title: 'Edición colaborativa',
    description: 'Si alguien más está editando un proyecto, verás un badge con su nombre. El sistema previene conflictos automáticamente. Los cambios se sincronizan en tiempo real.',
    icon: <AlertTriangle className="w-6 h-6 text-red-500" />,
    position: 'top',
    highlight: true
  },
  {
    id: 'finish',
    target: 'body',
    title: '¡Listo para empezar! 🚀',
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

interface DeadlinesTourProps {
  onComplete?: () => void;
  forceShow?: boolean;
}

export function DeadlinesTour({ onComplete, forceShow = false }: DeadlinesTourProps) {
  const { t } = useTranslation('app');
  const { currentUser, updateEmployee } = useApp();
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightPos, setHighlightPos] = useState<HighlightPosition | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasBeenCompleted, setHasBeenCompleted] = useState(false); // ✅ Estado local para evitar múltiples ejecuciones
  const lastCheckedUserIdRef = React.useRef<string | null>(null); // ✅ Ref para rastrear qué usuario ya verificamos

  // Verificar si debe mostrarse (solo una vez por usuario)
  useEffect(() => {
    // ✅ PRIMERO: Verificar localStorage (genérico, sin user_id) - MÁS RÁPIDO
    const completedInLocalStorage = localStorage.getItem('timeboxing_deadlines_tour_completed') === 'true';
    if (completedInLocalStorage) {
      setIsVisible(false);
      return;
    }

    // ✅ SEGUNDO: Si ya se completó localmente en este render, no mostrar nunca más
    if (hasBeenCompleted) {
      setIsVisible(false);
      return;
    }

    if (forceShow) {
      // ✅ Borrar localStorage y resetear estados cuando se fuerza a mostrar
      localStorage.removeItem('timeboxing_deadlines_tour_completed');
      setHasBeenCompleted(false);
      lastCheckedUserIdRef.current = null;
      setIsVisible(true);
      setCurrentStep(0);
      return;
    }

    // Esperar a que currentUser esté disponible antes de decidir
    if (currentUser === undefined) {
      // Aún no se ha cargado el usuario, no mostrar nada
      return;
    }

    // Si currentUser es null o no existe, NO mostrar el tour
    if (!currentUser) {
      console.log('[DeadlinesTour] No hay currentUser, no se muestra el tour');
      lastCheckedUserIdRef.current = null;
      return;
    }

    // ✅ TERCERO: Verificar BD (persistente entre dispositivos)
    const completedInDB = currentUser.deadlinesTourCompleted === true;
    if (completedInDB) {
      console.log('[DeadlinesTour] Tour ya completado en BD para usuario:', currentUser.id);
      setIsVisible(false);
      // Sincronizar a localStorage para futuras verificaciones rápidas
      localStorage.setItem('timeboxing_deadlines_tour_completed', 'true');
      lastCheckedUserIdRef.current = currentUser.id;
      return;
    }

    // Si ya verificamos para este usuario específico, no volver a verificar
    if (lastCheckedUserIdRef.current === currentUser.id) {
      return;
    }

    // Marcar que ya verificamos para este usuario
    lastCheckedUserIdRef.current = currentUser.id;

    // Si llegamos aquí, el tour no está completado y debemos mostrarlo
    console.log('[DeadlinesTour] Tour no completado, mostrando para usuario:', currentUser.id);
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 500);
    return () => clearTimeout(timer);
  }, [forceShow, currentUser, hasBeenCompleted]); // ✅ Quitar isVisible de las dependencias

  // Calcular posiciones
  const calculatePositions = useCallback(() => {
    const step = tourSteps[currentStep];
    
    if (step.position === 'center' || !step.highlight) {
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
    const padding = 6;
    setHighlightPos({
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2
    });

    // Posición del tooltip
    const tooltipWidth = 380;
    const tooltipHeight = 320;
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

    const element = document.querySelector(step.target);
    if (!element) {
      calculatePositions();
      return;
    }

    // Hacer scroll al elemento
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Esperar al scroll y luego calcular
    const timer = setTimeout(() => {
      calculatePositions();
    }, 400);

    return () => clearTimeout(timer);
  }, [currentStep, isVisible, calculatePositions]);

  // Recalcular en resize/scroll
  useEffect(() => {
    if (!isVisible || !isReady) return;
    
    const handleUpdate = () => {
      if (tourSteps[currentStep].highlight) {
        calculatePositions();
      }
    };
    
    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true);
    
    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
    };
  }, [isVisible, isReady, currentStep, calculatePositions]);

  const handleComplete = useCallback(async () => {
    // ✅ PRIMERO: Guardar en localStorage INMEDIATAMENTE (síncrono, sin delay, genérico)
    localStorage.setItem('timeboxing_deadlines_tour_completed', 'true');
    
    // ✅ SEGUNDO: Marcar como completado en estado local para evitar que se muestre de nuevo
    setHasBeenCompleted(true);
    setIsVisible(false);
    
    // ✅ TERCERO: Actualizar el ref inmediatamente para evitar que se vuelva a verificar
    if (currentUser?.id) {
      lastCheckedUserIdRef.current = currentUser.id;
    }
    
    // ✅ CUARTO: Guardar en la base de datos en segundo plano (asíncrono, persistente)
    if (currentUser) {
      try {
        const updatedEmployee = {
          ...currentUser,
          deadlinesTourCompleted: true
        };
        // No esperar, dejar que se guarde en segundo plano
        updateEmployee(updatedEmployee).then(() => {
          console.log('[DeadlinesTour] Tour completado y guardado en BD');
        }).catch((error) => {
          console.error('Error guardando estado del tour en BD:', error);
        });
      } catch (error) {
        console.error('Error guardando estado del tour:', error);
      }
    }
    
    onComplete?.();
  }, [onComplete, currentUser, updateEmployee]);

  const handleNext = useCallback(() => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  }, [currentStep, handleComplete]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

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
  const isCentered = step.position === 'center' || !highlightPos;
  const stepTitle = t(`deadlines.tour.steps.${step.id}.title`, step.title);
  const stepDescription = t(`deadlines.tour.steps.${step.id}.description`, step.description);
  const stepInteractionHint = step.interactionHint
    ? t(`deadlines.tour.steps.${step.id}.interactionHint`, step.interactionHint)
    : undefined;

  // Renderizar en un portal
  // Si el paso es interactivo, permitir clicks en el área destacada
  const isInteractive = step.interactive === true;
  
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
          pointerEvents: isInteractive ? 'none' : 'auto'
        }}
      >
        <defs>
          <mask id="deadlines-tour-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {highlightPos && isReady && (
              <rect 
                x={highlightPos.left - 2}
                y={highlightPos.top - 2}
                width={highlightPos.width + 4}
                height={highlightPos.height + 4}
                rx="10"
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
          mask="url(#deadlines-tour-spotlight-mask)"
        />
      </svg>

      {/* Borde del highlight con animación */}
      {highlightPos && isReady && (
        <div
          style={{
            position: 'fixed',
            top: highlightPos.top - 2,
            left: highlightPos.left - 2,
            width: highlightPos.width + 4,
            height: highlightPos.height + 4,
            border: '3px solid #818cf8',
            borderRadius: '10px',
            boxShadow: '0 0 0 4px rgba(129, 140, 248, 0.3), 0 0 20px rgba(129, 140, 248, 0.4)',
            pointerEvents: 'none',
            zIndex: 100000
          }}
        >
          <div 
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '10px',
              border: '2px solid #a5b4fc',
              animation: 'tour-ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
              opacity: 0.3
            }}
          />
        </div>
      )}

      {/* Tooltip */}
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
          {/* Header con gradiente */}
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  {step.icon}
                </div>
                <div>
                  <h3 className="font-bold text-lg">{stepTitle}</h3>
                  <p className="text-xs text-white/70">
                    {t('deadlines.tour.stepOf', 'Paso {{current}} de {{total}}', {
                      current: currentStep + 1,
                      total: tourSteps.length,
                    })}
                  </p>
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
            {step.customContent ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  {t('deadlines.tour.finish.intro', 'Ya conoces lo básico de Deadlines. Recuerda:')}
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2 text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{t('deadlines.tour.finish.tip1', 'Haz clic en proyectos para editarlos directamente')}</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{t('deadlines.tour.finish.tip2', 'Los cambios se guardan automáticamente al escribir')}</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{t('deadlines.tour.finish.tip3', 'Revisa el panel de disponibilidad para equilibrar cargas')}</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{t('deadlines.tour.finish.tip4', 'Usa las sugerencias para redistribuir trabajo')}</span>
                  </li>
                </ul>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-600 leading-relaxed">{stepDescription}</p>
                
                {/* Hint de interacción si es un paso interactivo */}
                {step.interactive && stepInteractionHint && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800 font-medium">
                      {stepInteractionHint}
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Progress dots */}
            <div className="flex justify-center gap-1.5 mt-5">
              {tourSteps.map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    "h-2 rounded-full transition-all duration-300",
                    index === currentStep 
                      ? "bg-primary/100 w-6" 
                      : index < currentStep
                        ? "bg-indigo-300 w-2"
                        : "bg-slate-200 w-2"
                  )}
                />
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-5">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="text-slate-400 hover:text-slate-600"
              >
                {t('deadlines.tour.nav.skip', 'Saltar tour')}
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
                    {t('deadlines.tour.nav.prev', 'Anterior')}
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleNext}
                  className="gap-1 bg-primary hover:bg-primary/90"
                >
                  {isLastStep ? (
                    <>
                      {t('deadlines.tour.nav.start', '¡Empezar!')}
                      <CheckCircle2 className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      {t('deadlines.tour.nav.next', 'Siguiente')}
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Estilos de animación */}
      <style>{`
        @keyframes tour-ping {
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
export function useDeadlinesTour() {
  const { currentUser, updateEmployee } = useApp();
  const [showTour, setShowTour] = useState(false);

  const startTour = () => setShowTour(true);
  const endTour = () => setShowTour(false);
  
  const resetTour = async () => {
    // ✅ SIEMPRE borrar localStorage primero (inmediato)
    localStorage.removeItem('timeboxing_deadlines_tour_completed');
    
    if (currentUser) {
      try {
        const updatedEmployee = {
          ...currentUser,
          deadlinesTourCompleted: false
        };
        await updateEmployee(updatedEmployee);
        setShowTour(true);
      } catch (error) {
        console.error('Error reseteando tour:', error);
        // Aún así mostrar el tour aunque falle la BD
        setShowTour(true);
      }
    } else {
      setShowTour(true);
    }
  };

  const isTourCompleted = () => {
    if (currentUser) {
      return currentUser.deadlinesTourCompleted === true;
    }
    return localStorage.getItem('timeboxing_deadlines_tour_completed') === 'true';
  };

  return { showTour, startTour, endTour, resetTour, isTourCompleted };
}

