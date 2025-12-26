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
    description: 'Selecciona el proyecto o cliente. Si está cerca del límite, verás amarillo.',
    icon: <FolderOpen className="w-5 h-5" />,
  },
  {
    id: 'task',
    target: '[data-tour-task="task-name"]',
    title: 'Tarea',
    description: 'Describe qué vas a hacer: "Diseño landing", "Informe", etc.',
    icon: <FileText className="w-5 h-5" />,
  },
  {
    id: 'hours',
    target: '[data-tour-task="hours"]',
    title: 'Horas',
    description: 'Cuántas horas estimas (decimales OK: 1.5 = hora y media).',
    icon: <Clock className="w-5 h-5" />,
    tip: 'Amarillo si excedes capacidad semanal.',
  },
  {
    id: 'week',
    target: '[data-tour-task="week"]',
    title: 'Semana',
    description: 'En qué semana del mes. Verás la ocupación de cada una.',
    icon: <Calendar className="w-5 h-5" />,
  },
  {
    id: 'add-row',
    target: '[data-tour-task="add-row"]',
    title: 'Más filas',
    description: 'Añade tantas tareas como necesites. Proyecto y semana se copian.',
    icon: <Plus className="w-5 h-5" />,
  },
  {
    id: 'finish',
    title: '¡Listo! ✨',
    description: 'El resumen inferior te avisa de alertas antes de guardar.',
    icon: <CheckCircle2 className="w-5 h-5" />,
  }
];

interface AddTasksTourProps {
  isOpen: boolean;
  onComplete: () => void;
}

interface TooltipPos {
  top: number;
  left: number;
  arrowPosition: 'top' | 'bottom' | 'left' | 'right' | 'none';
}

export function AddTasksTour({ isOpen, onComplete }: AddTasksTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<TooltipPos | null>(null);
  const [prevHighlightedEl, setPrevHighlightedEl] = useState<HTMLElement | null>(null);

  // Mostrar tour si no está completado
  useEffect(() => {
    if (isOpen) {
      const completed = localStorage.getItem(TOUR_STORAGE_KEY);
      if (!completed) {
        const timer = setTimeout(() => {
          setIsVisible(true);
          setCurrentStep(0);
        }, 700);
        return () => clearTimeout(timer);
      }
    } else {
      setIsVisible(false);
      setCurrentStep(0);
      removeHighlight(prevHighlightedEl);
    }
  }, [isOpen]);

  // Limpiar highlight de un elemento
  const removeHighlight = (el: HTMLElement | null) => {
    if (el) {
      el.style.boxShadow = '';
      el.style.position = '';
      el.style.zIndex = '';
      el.style.background = '';
      el.style.borderRadius = '';
    }
  };

  // Aplicar highlight a un elemento
  const applyHighlight = (el: HTMLElement) => {
    el.style.boxShadow = '0 0 0 3px #7c3aed, 0 0 0 6px rgba(124, 58, 237, 0.3), 0 0 25px rgba(124, 58, 237, 0.4)';
    el.style.position = 'relative';
    el.style.zIndex = '100';
    el.style.background = 'white';
    el.style.borderRadius = '8px';
  };

  // Calcular posición del tooltip
  const calculatePosition = useCallback((element: HTMLElement): TooltipPos => {
    const rect = element.getBoundingClientRect();
    const tooltipW = 300;
    const tooltipH = 200;
    const gap = 16;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Intentar DEBAJO
    if (rect.bottom + gap + tooltipH < vh - 20) {
      return {
        top: rect.bottom + gap,
        left: Math.max(20, Math.min(rect.left + rect.width / 2 - tooltipW / 2, vw - tooltipW - 20)),
        arrowPosition: 'top'
      };
    }
    
    // Intentar ARRIBA
    if (rect.top - gap - tooltipH > 20) {
      return {
        top: rect.top - gap - tooltipH,
        left: Math.max(20, Math.min(rect.left + rect.width / 2 - tooltipW / 2, vw - tooltipW - 20)),
        arrowPosition: 'bottom'
      };
    }
    
    // Intentar DERECHA
    if (rect.right + gap + tooltipW < vw - 20) {
      return {
        top: Math.max(20, Math.min(rect.top + rect.height / 2 - tooltipH / 2, vh - tooltipH - 20)),
        left: rect.right + gap,
        arrowPosition: 'left'
      };
    }
    
    // IZQUIERDA
    return {
      top: Math.max(20, Math.min(rect.top + rect.height / 2 - tooltipH / 2, vh - tooltipH - 20)),
      left: Math.max(20, rect.left - gap - tooltipW),
      arrowPosition: 'right'
    };
  }, []);

  // Efecto para actualizar highlight y posición cuando cambia el paso
  useEffect(() => {
    if (!isVisible) return;

    const step = tourSteps[currentStep];

    // Limpiar anterior
    removeHighlight(prevHighlightedEl);

    // Si no hay target, centrar
    if (!step.target) {
      setTooltipPos(null);
      setPrevHighlightedEl(null);
      return;
    }

    // Buscar elemento con pequeño delay para asegurar render
    const timer = setTimeout(() => {
      const el = document.querySelector(step.target!) as HTMLElement;
      
      if (el) {
        applyHighlight(el);
        setPrevHighlightedEl(el);
        
        const pos = calculatePosition(el);
        setTooltipPos(pos);
        
        // Scroll suave si está fuera de vista
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        console.warn(`Tour: Element not found: ${step.target}`);
        setTooltipPos(null);
        setPrevHighlightedEl(null);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [isVisible, currentStep, calculatePosition]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => removeHighlight(prevHighlightedEl);
  }, [prevHighlightedEl]);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      finish();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const finish = () => {
    removeHighlight(prevHighlightedEl);
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    setIsVisible(false);
    setCurrentStep(0);
    onComplete();
  };

  if (!isVisible) return null;

  const step = tourSteps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === tourSteps.length - 1;
  const isCentered = !tooltipPos;

  // Estilos del tooltip
  const tooltipStyle: React.CSSProperties = isCentered
    ? { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
    : { position: 'fixed', top: tooltipPos.top, left: tooltipPos.left };

  return (
    <>
      {/* Overlay oscuro */}
      <div 
        className="fixed inset-0 bg-black/50 z-[9998]"
        onClick={finish}
      />

      {/* Tooltip */}
      <div 
        className="z-[9999] animate-in fade-in zoom-in-95 duration-200"
        style={{ ...tooltipStyle, width: 300 }}
      >
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-3 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-white/20 rounded-lg">{step.icon}</div>
                <div>
                  <h3 className="font-bold text-sm">{step.title}</h3>
                  <p className="text-[10px] text-white/70">{currentStep + 1} / {tourSteps.length}</p>
                </div>
              </div>
              <button onClick={finish} className="text-white/70 hover:text-white p-1">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-3">
            <p className="text-sm text-slate-600">{step.description}</p>
            {step.tip && (
              <div className="flex items-start gap-2 mt-2 p-2 bg-amber-50 rounded-lg">
                <Lightbulb className="w-3.5 h-3.5 text-amber-500 mt-0.5" />
                <p className="text-[11px] text-amber-700">{step.tip}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-3 pb-3 flex items-center justify-between">
            <div className="flex gap-1">
              {tourSteps.map((_, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === currentStep ? "w-4 bg-violet-500" : i < currentStep ? "w-1.5 bg-violet-300" : "w-1.5 bg-slate-200"
                  )} 
                />
              ))}
            </div>
            <div className="flex gap-1.5">
              {!isFirst && (
                <Button variant="outline" size="sm" onClick={handlePrev} className="h-7 px-2 text-xs">
                  <ChevronLeft className="w-3 h-3" />
                </Button>
              )}
              <Button size="sm" onClick={handleNext} className="h-7 px-3 text-xs bg-violet-600 hover:bg-violet-700">
                {isLast ? 'Fin' : 'Sig.'}
                {isLast ? <CheckCircle2 className="w-3 h-3 ml-1" /> : <ChevronRight className="w-3 h-3 ml-1" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Flecha */}
        {tooltipPos && tooltipPos.arrowPosition !== 'none' && (
          <div 
            className={cn(
              "absolute w-3 h-3 bg-white border-slate-200 rotate-45",
              tooltipPos.arrowPosition === 'top' && "top-[-6px] left-1/2 -ml-1.5 border-l border-t",
              tooltipPos.arrowPosition === 'bottom' && "bottom-[-6px] left-1/2 -ml-1.5 border-r border-b",
              tooltipPos.arrowPosition === 'left' && "left-[-6px] top-1/2 -mt-1.5 border-l border-b",
              tooltipPos.arrowPosition === 'right' && "right-[-6px] top-1/2 -mt-1.5 border-r border-t"
            )}
          />
        )}
      </div>

      {/* Animación del highlight */}
      <style>{`
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 3px #7c3aed, 0 0 0 6px rgba(124, 58, 237, 0.3), 0 0 25px rgba(124, 58, 237, 0.4); }
          50% { box-shadow: 0 0 0 4px #7c3aed, 0 0 0 10px rgba(124, 58, 237, 0.2), 0 0 35px rgba(124, 58, 237, 0.5); }
          100% { box-shadow: 0 0 0 3px #7c3aed, 0 0 0 6px rgba(124, 58, 237, 0.3), 0 0 25px rgba(124, 58, 237, 0.4); }
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
