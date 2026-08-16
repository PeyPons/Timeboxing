import React, { useState, useEffect, useCallback, useId, useMemo } from 'react';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  X, ChevronLeft, ChevronRight, ListPlus, Clock, Calendar,
  TrendingUp, Users, LayoutDashboard, Target, Sparkles,
  CheckCircle2, AlertOctagon, FileDown, Award, HeartHandshake,
  Scale, Search, CheckSquare
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
  tab?: string; // Tab value to switch to
}

function useWelcomeTourSteps(): TourStep[] {
  const { t } = useAppTranslation();
  return useMemo(
    (): TourStep[] => [
      {
        id: 'welcome',
        target: 'body',
        title: t('welcomeTour.steps.welcome.title'),
        description: t('welcomeTour.steps.welcome.description'),
        icon: <Sparkles className="w-6 h-6 text-indigo-500" />,
        position: 'center',
      },
      {
        id: 'add-tasks',
        target: '[data-tour="add-tasks"]',
        title: t('welcomeTour.steps.addTasks.title'),
        description: t('welcomeTour.steps.addTasks.description'),
        icon: <ListPlus className="w-6 h-6 text-indigo-500" />,
        position: 'bottom',
        highlight: true,
      },
      {
        id: 'weekly',
        target: '[data-tour="weekly-button"]',
        title: t('welcomeTour.steps.weekly.title'),
        description: t('welcomeTour.steps.weekly.description'),
        icon: <CheckSquare className="w-6 h-6 text-amber-500" />,
        position: 'bottom',
        highlight: true,
      },
      {
        id: 'crm-export',
        target: '[data-tour="crm-export"]',
        title: t('welcomeTour.steps.crmExport.title'),
        description: t('welcomeTour.steps.crmExport.description'),
        icon: <FileDown className="w-6 h-6 text-purple-500" />,
        position: 'bottom',
        highlight: true,
      },
      {
        id: 'internal-tasks',
        target: '[data-tour="internal-tasks"]',
        title: t('welcomeTour.steps.internalTasks.title'),
        description: t('welcomeTour.steps.internalTasks.description'),
        icon: <Clock className="w-6 h-6 text-slate-500" />,
        position: 'bottom',
        highlight: true,
      },
      {
        id: 'goals',
        target: '[data-tour="goals"]',
        title: t('welcomeTour.steps.goals.title'),
        description: t('welcomeTour.steps.goals.description'),
        icon: <TrendingUp className="w-6 h-6 text-emerald-500" />,
        position: 'bottom',
        highlight: true,
      },
      {
        id: 'absences',
        target: '[data-tour="absences"]',
        title: t('welcomeTour.steps.absences.title'),
        description: t('welcomeTour.steps.absences.description'),
        icon: <Calendar className="w-6 h-6 text-amber-500" />,
        position: 'bottom',
        highlight: true,
      },
      {
        id: 'calendar',
        target: '[data-tour="calendar"]',
        title: t('welcomeTour.steps.calendar.title'),
        description: t('welcomeTour.steps.calendar.description'),
        icon: <LayoutDashboard className="w-6 h-6 text-blue-500" />,
        position: 'bottom',
        highlight: true,
      },
      {
        id: 'priority-widget',
        target: '[data-tour="priority-widget"]',
        title: t('welcomeTour.steps.priorityWidget.title'),
        description: t('welcomeTour.steps.priorityWidget.description'),
        icon: <AlertOctagon className="w-6 h-6 text-red-500" />,
        position: 'right',
        highlight: true,
        tab: 'dependencies',
      },
      {
        id: 'dependencies-widget',
        target: '[data-tour="dependencies-widget"]',
        title: t('welcomeTour.steps.dependenciesWidget.title'),
        description: t('welcomeTour.steps.dependenciesWidget.description'),
        icon: <Users className="w-6 h-6 text-indigo-500" />,
        position: 'left',
        highlight: true,
        tab: 'dependencies',
      },
      {
        id: 'planning-inconsistencies',
        target: '[data-tour="planning-inconsistencies"]',
        title: t('welcomeTour.steps.planningInconsistencies.title'),
        description: t('welcomeTour.steps.planningInconsistencies.description'),
        icon: <Search className="w-6 h-6 text-amber-500" />,
        position: 'top',
        highlight: true,
        tab: 'coherence',
      },
      {
        id: 'collaboration-cards',
        target: '[data-tour="collaboration-cards"]',
        title: t('welcomeTour.steps.collaborationCards.title'),
        description: t('welcomeTour.steps.collaborationCards.description'),
        icon: <HeartHandshake className="w-6 h-6 text-pink-500" />,
        position: 'top',
        highlight: true,
        tab: 'teammates',
      },
      {
        id: 'projects-summary',
        target: '[data-tour="projects-summary"]',
        title: t('welcomeTour.steps.projectsSummary.title'),
        description: t('welcomeTour.steps.projectsSummary.description'),
        icon: <Target className="w-6 h-6 text-purple-500" />,
        position: 'top',
        highlight: true,
        tab: 'projects',
      },
      {
        id: 'monthly-balance',
        target: '[data-tour="monthly-balance"]',
        title: t('welcomeTour.steps.monthlyBalance.title'),
        description: t('welcomeTour.steps.monthlyBalance.description'),
        icon: <Scale className="w-6 h-6 text-indigo-500" />,
        position: 'top',
        highlight: true,
        tab: 'metrics',
      },
      {
        id: 'reliability-index',
        target: '[data-tour="reliability-index"]',
        title: t('welcomeTour.steps.reliability.title'),
        description: t('welcomeTour.steps.reliability.description'),
        icon: <Award className="w-6 h-6 text-emerald-500" />,
        position: 'top',
        highlight: true,
        tab: 'metrics',
      },
      {
        id: 'finish',
        target: 'body',
        title: t('welcomeTour.steps.finish.title'),
        description: t('welcomeTour.steps.finish.description'),
        icon: <CheckCircle2 className="w-6 h-6 text-emerald-500" />,
        position: 'center',
        customContent: true,
      },
    ],
    [t]
  );
}

interface HighlightPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface WelcomeTourProps {
  onComplete?: () => void;
  forceShow?: boolean;
  onTabChange?: (tab: string) => void;
}

export function WelcomeTour({ onComplete, forceShow = false, onTabChange }: WelcomeTourProps) {
  const { t } = useAppTranslation();
  const tourSteps = useWelcomeTourSteps();
  const { currentUser, updateEmployee } = useApp();
  const maskId = useId().replace(/:/g, '');
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightPos, setHighlightPos] = useState<HighlightPosition | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasBeenCompleted, setHasBeenCompleted] = useState(false); // ✅ Estado local para evitar múltiples ejecuciones
  const lastCheckedUserIdRef = React.useRef<string | null>(null); // ✅ Ref para rastrear qué usuario ya verificamos
  const isManuallyClosedRef = React.useRef<boolean>(false); // ✅ Ref para rastrear si el usuario cerró el tour manualmente
  const isCompletingRef = React.useRef<boolean>(false); // ✅ Ref para prevenir múltiples ejecuciones de handleComplete
  const hasInitializedRef = React.useRef<boolean>(false); // ✅ Ref para rastrear si ya inicializamos el tour

  // Manejar forceShow (resetear todo cuando se fuerza a mostrar)
  useEffect(() => {
    if (forceShow) {
      // ✅ Borrar localStorage y resetear estados cuando se fuerza a mostrar
      localStorage.removeItem('timeboxing_welcome_tour_completed');
      setHasBeenCompleted(false);
      isManuallyClosedRef.current = false;
      isCompletingRef.current = false;
      lastCheckedUserIdRef.current = null;
      hasInitializedRef.current = false;
      setIsVisible(true);
      setCurrentStep(0);
    }
  }, [forceShow]);

  // Verificar si debe mostrarse (solo UNA VEZ por usuario, al inicializar)
  useEffect(() => {
    // Si ya inicializamos para este usuario, NO hacer nada más
    if (hasInitializedRef.current) {
      return;
    }

    // Si el usuario cerró el tour manualmente, NO hacer nada
    if (isManuallyClosedRef.current) {
      return;
    }

    // Si forceShow está activo, no ejecutar esta lógica (se maneja en el otro useEffect)
    if (forceShow) {
      return;
    }

    // ✅ PRIMERO: Verificar localStorage (genérico, sin user_id) - MÁS RÁPIDO
    const completedInLocalStorage = localStorage.getItem('timeboxing_welcome_tour_completed') === 'true';
    if (completedInLocalStorage) {
      setIsVisible(false);
      hasInitializedRef.current = true;
      return;
    }

    // ✅ SEGUNDO: Si ya se completó localmente, no verificar nada más
    if (hasBeenCompleted) {
      setIsVisible(false);
      hasInitializedRef.current = true;
      return;
    }

    // Esperar a que currentUser esté disponible antes de decidir
    if (currentUser === undefined) {
      // Aún no se ha cargado el usuario, no mostrar nada
      return;
    }

    // Si currentUser es null o no existe, NO mostrar el tour
    if (!currentUser) {
      console.log('[WelcomeTour] No hay currentUser, no se muestra el tour');
      lastCheckedUserIdRef.current = null;
      hasInitializedRef.current = true;
      return;
    }

    // ✅ TERCERO: Si ya verificamos para este usuario específico, NO volver a verificar
    if (lastCheckedUserIdRef.current === currentUser.id) {
      hasInitializedRef.current = true;
      return;
    }

    // ✅ CUARTO: Verificar BD (persistente entre dispositivos)
    const completedInDB = currentUser.welcomeTourCompleted === true;
    if (completedInDB) {
      console.log('[WelcomeTour] Tour ya completado en BD para usuario:', currentUser.id);
      setIsVisible(false);
      // Sincronizar a localStorage para futuras verificaciones rápidas
      localStorage.setItem('timeboxing_welcome_tour_completed', 'true');
      lastCheckedUserIdRef.current = currentUser.id;
      hasInitializedRef.current = true;
      return;
    }

    // Marcar que ya verificamos para este usuario ANTES de mostrar
    lastCheckedUserIdRef.current = currentUser.id;
    hasInitializedRef.current = true;

    // Si llegamos aquí, el tour no está completado y debemos mostrarlo
    console.log('[WelcomeTour] Tour no completado, mostrando para usuario:', currentUser.id);
    const timer = setTimeout(() => {
      // Verificar de nuevo antes de mostrar (por si se cerró mientras esperábamos)
      if (!isManuallyClosedRef.current && !hasBeenCompleted) {
        setIsVisible(true);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [currentUser, hasBeenCompleted, forceShow]);

  // Calcular posiciones
  const calculatePositions = useCallback(() => {
    const step = tourSteps[currentStep];

    if (step.position === 'center' || !step.highlight) {
      setHighlightPos(null);
      setTooltipPos(null);
      setIsReady(true);
      return;
    }

    const element = document.querySelector(step.target) as HTMLElement;
    if (!element) {
      // Si no se encuentra el elemento, mostrar tooltip centrado
      setHighlightPos(null);
      setTooltipPos({ top: window.innerHeight / 2, left: window.innerWidth / 2 });
      setIsReady(true);
      return;
    }

    // Verificar que el elemento sea visible
    const rect = element.getBoundingClientRect();
    const isElementVisible = rect.width > 0 && rect.height > 0;

    if (!isElementVisible) {
      // Si el elemento no es visible, no mostrar highlight pero sí el tooltip centrado
      setHighlightPos(null);
      setTooltipPos({ top: window.innerHeight / 2, left: window.innerWidth / 2 });
      setIsReady(true);
      return;
    }

    // Hacer scroll al elemento si es necesario
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Recalcular rect después de un breve delay para el scroll
    setTimeout(() => {
      const updatedRect = element.getBoundingClientRect();
      
      // Posición del highlight (coordenadas de viewport para position: fixed)
      const padding = 6;
      setHighlightPos({
        top: updatedRect.top - padding,
        left: updatedRect.left - padding,
        width: updatedRect.width + padding * 2,
        height: updatedRect.height + padding * 2
      });

      // Posición del tooltip
      const tooltipWidth = 380;
      const tooltipHeight = 320;
      const gap = 16;

      let top = 0;
      let left = 0;

      switch (step.position) {
        case 'bottom':
          top = updatedRect.bottom + gap;
          left = updatedRect.left + updatedRect.width / 2 - tooltipWidth / 2;
          break;
        case 'top':
          top = updatedRect.top - tooltipHeight - gap;
          left = updatedRect.left + updatedRect.width / 2 - tooltipWidth / 2;
          break;
        case 'left':
          top = updatedRect.top + updatedRect.height / 2 - tooltipHeight / 2;
          left = updatedRect.left - tooltipWidth - gap;
          break;
        case 'right':
          top = updatedRect.top + updatedRect.height / 2 - tooltipHeight / 2;
          left = updatedRect.right + gap;
          break;
      }

      // Mantener en pantalla
      left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16));
      top = Math.max(16, Math.min(top, window.innerHeight - tooltipHeight - 16));

      setTooltipPos({ top, left });
      setIsReady(true);
    }, 200);
  }, [currentStep, tourSteps]);

  // Cambiar de tab si el paso lo requiere
  useEffect(() => {
    if (!isVisible) return;
    const step = tourSteps[currentStep];
    
    // Cambiar de tab si es necesario (similar a como funciona con tabs)
    if (step.tab && onTabChange) {
      // Usar requestAnimationFrame para asegurar que el cambio de tab se procese antes de buscar elementos
      requestAnimationFrame(() => {
        onTabChange(step.tab!);
      });
    }
    
  }, [currentStep, isVisible, onTabChange, tourSteps]);

  // Actualizar posiciones cuando cambia el paso
  useEffect(() => {
    if (!isVisible) return;
    const step = tourSteps[currentStep];

    setIsReady(false);

    if (step.position === 'center' || !step.highlight) {
      calculatePositions();
      return;
    }

    // Tabs: esperar más para que el contenido condicional se renderice
    // Tabs necesitan más tiempo porque el contenido se renderiza condicionalmente
    const delay = step.tab ? 500 : 200;

    const timeoutId = setTimeout(() => {
      calculatePositions();
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [currentStep, isVisible, calculatePositions, tourSteps]);

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
  }, [isVisible, isReady, currentStep, calculatePositions, tourSteps]);

  const handleComplete = useCallback(async () => {
    // ✅ PRIMERO: Prevenir múltiples ejecuciones
    if (isCompletingRef.current) {
      return;
    }
    isCompletingRef.current = true;

    // ✅ SEGUNDO: Marcar que el usuario cerró el tour manualmente (prioridad máxima)
    isManuallyClosedRef.current = true;
    
    // ✅ TERCERO: Marcar como inicializado para prevenir que el useEffect se ejecute de nuevo
    hasInitializedRef.current = true;
    
    // ✅ CUARTO: Marcar como completado en estado local INMEDIATAMENTE
    setHasBeenCompleted(true);
    
    // ✅ QUINTO: Ocultar el tour INMEDIATAMENTE
    setIsVisible(false);
    
    // ✅ SEXTO: Guardar en localStorage INMEDIATAMENTE (síncrono, sin delay, genérico)
    localStorage.setItem('timeboxing_welcome_tour_completed', 'true');

    // ✅ SÉPTIMO: Actualizar el ref inmediatamente para evitar que se vuelva a verificar
    if (currentUser?.id) {
      lastCheckedUserIdRef.current = currentUser.id;
    }

    // ✅ OCTAVO: Guardar en la base de datos en segundo plano (asíncrono, persistente)
    // Usar el currentUser actual, no depender del closure
    const userToUpdate = currentUser;
    if (userToUpdate) {
      try {
        const updatedEmployee = {
          ...userToUpdate,
          welcomeTourCompleted: true
        };
        // No esperar, dejar que se guarde en segundo plano
        updateEmployee(updatedEmployee).then(() => {
          console.log('[WelcomeTour] Tour completado y guardado en BD');
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
  }, [currentStep, handleComplete, tourSteps.length]);

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
  /** Solo bloquear la página si hay spotlight válido; si no, el SVG capturaba todos los clics. */
  const blocksPageInteraction = Boolean(step.highlight && highlightPos && isReady);

  // Renderizar en un portal para evitar problemas de contexto
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
          pointerEvents: blocksPageInteraction ? 'auto' : 'none'
        }}
      >
        <defs>
          <mask id={maskId}>
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
          mask={`url(#${maskId})`}
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
                <div className="p-2.5 bg-white/30 backdrop-blur-sm rounded-xl border border-white/20 shadow-lg">
                  {React.cloneElement(step.icon as React.ReactElement, {
                    className: "w-6 h-6 text-white"
                  })}
                </div>
                <div>
                  <h3 className="font-bold text-lg">{step.title}</h3>
                  <p className="text-xs text-white/70">{t('welcomeTour.nav.stepOf', { current: currentStep + 1, total: tourSteps.length })}</p>
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
                  {t('welcomeTour.finishCustom.intro')}
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2 text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{t('welcomeTour.finishCustom.tip1')}</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{t('welcomeTour.finishCustom.tip2')}</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{t('welcomeTour.finishCustom.tip3')}</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{t('welcomeTour.finishCustom.tip4')}</span>
                  </li>
                </ul>
              </div>
            ) : (
              <p className="text-sm text-slate-600 leading-relaxed">{step.description}</p>
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
                {t('welcomeTour.nav.skip')}
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
                    {t('welcomeTour.nav.prev')}
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleNext}
                  className="gap-1 bg-primary hover:bg-primary/90"
                >
                  {isLastStep ? (
                    <>
                      {t('welcomeTour.nav.finish')}
                      <CheckCircle2 className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      {t('welcomeTour.nav.next')}
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

  // Usar portal para renderizar fuera del árbol DOM del componente
  return createPortal(tourContent, document.body);
}

// Hook para controlar el tour
export function useWelcomeTour() {
  const { currentUser, updateEmployee } = useApp();
  const [showTour, setShowTour] = useState(false);

  const startTour = () => setShowTour(true);
  const endTour = () => setShowTour(false);

  const resetTour = async () => {
    // ✅ SIEMPRE borrar localStorage primero (inmediato)
    localStorage.removeItem('timeboxing_welcome_tour_completed');

    if (currentUser) {
      try {
        const updatedEmployee = {
          ...currentUser,
          welcomeTourCompleted: false
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
      return currentUser.welcomeTourCompleted || false;
    }
    return localStorage.getItem('timeboxing_welcome_tour_completed') === 'true';
  };

  return { showTour, startTour, endTour, resetTour, isTourCompleted };
}