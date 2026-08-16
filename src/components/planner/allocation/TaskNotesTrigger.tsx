import type { MouseEvent, PointerEvent } from 'react';
import { StickyNote } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { TaskNotesPanel } from '@/components/planner/allocation/TaskNotesPanel';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface TaskNotesTriggerProps {
  allocationId: string;
  noteCount?: number;
  className?: string;
  /** En formularios: botón con texto en lugar de solo icono */
  inline?: boolean;
  /** Badge compacto junto al nombre (p. ej. tabla del planificador) */
  badge?: boolean;
}

export function TaskNotesTrigger({ allocationId, noteCount = 0, className, inline = false, badge = false }: TaskNotesTriggerProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const hasNotes = noteCount > 0;
  const label = hasNotes ? t('taskNotes.open', 'Ver anotaciones') : t('taskNotes.addQuick', 'Añadir anotación');
  const translateCount = t as unknown as (
    key: string,
    defaultValue: string,
    options: { count: string | number },
  ) => string;
  const countLabel =
    noteCount === 1
      ? t('taskNotes.countOne', '1 anotación')
      : translateCount('taskNotes.countMany', '{{count}} anotaciones', {
          count: noteCount > 9 ? '9+' : noteCount,
        });
  const tooltipTitle = hasNotes ? countLabel : t('taskNotes.addQuick', 'Añadir anotación');
  const tooltipAction = hasNotes
    ? t('taskNotes.clickToView', 'Clic para ver')
    : t('taskNotes.clickToAdd', 'Clic para añadir');

  const stopBubble = {
    onPointerDown: (e: PointerEvent) => e.stopPropagation(),
    onClick: (e: MouseEvent) => e.stopPropagation(),
  };

  const triggerButton = badge ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        'h-4 px-1.5 gap-0.5 text-[9px] font-medium shrink-0 transition-opacity',
        hasNotes
          ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 opacity-100'
          : 'bg-transparent text-amber-600/80 border-amber-200/70 border-dashed hover:bg-amber-50 hover:text-amber-800 hover:border-amber-200 opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
        className
      )}
      aria-label={hasNotes ? `${label}: ${countLabel}` : label}
      {...stopBubble}
    >
      <StickyNote className="h-3 w-3 shrink-0" />
      {hasNotes && <span>{noteCount > 9 ? '9+' : noteCount}</span>}
    </Button>
  ) : inline ? (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        'h-8 shrink-0 gap-1.5 text-amber-700 hover:text-amber-800 hover:bg-amber-50 px-2',
        className
      )}
      aria-label={label}
      {...stopBubble}
    >
      <StickyNote className="h-3.5 w-3.5" />
      <span className="text-xs font-medium">
        {t('taskNotes.title', 'Anotaciones')}
        {hasNotes ? ` (${noteCount > 9 ? '9+' : noteCount})` : ''}
      </span>
    </Button>
  ) : (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        'relative h-7 w-7 shrink-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50',
        className
      )}
      aria-label={label}
      {...stopBubble}
    >
      <StickyNote className="h-3.5 w-3.5" />
      {hasNotes && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-amber-500 text-[9px] font-bold text-white flex items-center justify-center">
          {noteCount > 9 ? '9+' : noteCount}
        </span>
      )}
    </Button>
  );

  const tooltipContent = (
    <TooltipContent side="top" className="text-xs z-[9999]">
      <p>{tooltipTitle}</p>
      <p className="text-slate-400 font-normal">{tooltipAction}</p>
    </TooltipContent>
  );

  const panel = (
    <TaskNotesPanel
      allocationId={allocationId}
      compact={!isMobile}
      autoFocusDraft={!hasNotes}
    />
  );

  if (isMobile) {
    return (
      <Sheet>
        {badge ? (
          <Tooltip>
            <SheetTrigger asChild>
              <TooltipTrigger asChild>{triggerButton}</TooltipTrigger>
            </SheetTrigger>
            {tooltipContent}
          </Tooltip>
        ) : (
          <SheetTrigger asChild>{triggerButton}</SheetTrigger>
        )}
        <SheetContent side="bottom" className="h-[min(85vh,520px)] rounded-t-2xl">
          <SheetHeader className="text-left pb-2">
            <SheetTitle>{t('taskNotes.title', 'Anotaciones')}</SheetTitle>
          </SheetHeader>
          <TaskNotesPanel allocationId={allocationId} autoFocusDraft={!hasNotes} />
        </SheetContent>
      </Sheet>
    );
  }

  if (badge) {
    return (
      <Popover modal>
        <Tooltip>
          <PopoverTrigger asChild>
            <TooltipTrigger asChild>{triggerButton}</TooltipTrigger>
          </PopoverTrigger>
          {tooltipContent}
        </Tooltip>
        <PopoverContent
          align="start"
          side="bottom"
          className="w-[min(92vw,380px)] p-4 z-[10000]"
          onClick={e => e.stopPropagation()}
        >
          {panel}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover modal>
      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(92vw,380px)] p-4 z-[10000]"
        onClick={e => e.stopPropagation()}
      >
        {panel}
      </PopoverContent>
    </Popover>
  );
}
