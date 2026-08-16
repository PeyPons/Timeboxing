import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useTaskTransfers, TaskTransfer } from '@/hooks/useTaskTransfers';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
    Check, Copy, Split, Calendar as CalendarIcon, X, Plus,
    AlertCircle, ArrowRight, User, Ban, AlertTriangle, Trash2
} from 'lucide-react';
import { format, addDays, parseISO, startOfWeek, addMonths, getWeekOfMonth } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useDateLocale } from '@/hooks/useDateLocale';
import { toast } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { getWeeksForMonth } from '@/utils/dateUtils';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface TransferAcceptanceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    transfer: TaskTransfer;
    onSuccess: () => void;
}

type AcceptanceMode = 'keep' | 'move' | 'distribute' | 'rollover';

export function TransferAcceptanceDialog({ open, onOpenChange, transfer, onSuccess }: TransferAcceptanceDialogProps) {
    const { t } = useTranslation('app');
    const dateLocale = useDateLocale();
    const { acceptTransfer, rejectTransfer } = useTaskTransfers();
    const { addAllocation, addWeeklyFeedback } = useApp();

    const [mode, setMode] = useState<AcceptanceMode>('keep');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Estado para flujo de rechazo
    const [isRejecting, setIsRejecting] = useState(false);
    const [rejectReason, setRejectReason] = useState('');

    // Use lazy initialization that references availableWeeks
    const getDefaultWeekDate = () => {
        const today = new Date();
        const currentMonthWeeks = getWeeksForMonth(today);
        const nextMonthWeeks = getWeeksForMonth(addMonths(today, 1));
        const allWeeks = [...currentMonthWeeks, ...nextMonthWeeks];
        const validWeeks = allWeeks.filter(w => {
            const weekEnd = addDays(w.weekStart, 6);
            return weekEnd >= startOfWeek(today, { weekStartsOn: 1 });
        });

        if (validWeeks.length === 0) return format(today, 'yyyy-MM-dd');
        return format(validWeeks[0].weekStart, 'yyyy-MM-dd');
    };

    // Estado para "Move" / "Modify"
    const [targetWeekDate, setTargetWeekDate] = useState<string>(getDefaultWeekDate);

    // Estado para "Distribute" - Default to first available week
    const [distributionRows, setDistributionRows] = useState<Array<{ id: string; taskName: string; hours: string; weekDate: string }>>(() => {
        const defaultWeek = getDefaultWeekDate();
        return [{
            id: crypto.randomUUID(),
            taskName: transfer.taskName || '',
            hours: transfer.hours.toString(),
            weekDate: defaultWeek
        }];
    });

    // Semanas disponibles (Mes actual + Siguiente, solo futuras o actual)
    const availableWeeks = useMemo(() => {
        const today = new Date();
        const currentMonthWeeks = getWeeksForMonth(today);
        const nextMonthWeeks = getWeeksForMonth(addMonths(today, 1));

        const allWeeks = [...currentMonthWeeks, ...nextMonthWeeks];

        // Filtrar semanas pasadas (si el fin de semana ya pasó)
        return allWeeks.filter(w => {
            const weekEnd = addDays(w.weekStart, 6); // Considerar hasta el domingo
            return weekEnd >= startOfWeek(today, { weekStartsOn: 1 });
        });
    }, []);

    const totalDistributedHours = useMemo(() => {
        return distributionRows.reduce((sum, row) => sum + (parseFloat(row.hours) || 0), 0);
    }, [distributionRows]);

    const handleDistributeAddRow = () => {
        setDistributionRows(prev => [...prev, {
            id: crypto.randomUUID(),
            taskName: transfer.taskName || '',
            hours: '',
            weekDate: availableWeeks[0]?.weekStart ? format(availableWeeks[0].weekStart, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
        }]);
    };

    const handleDistributeRemoveRow = (id: string) => {
        if (distributionRows.length <= 1) return;
        setDistributionRows(prev => prev.filter(r => r.id !== id));
    };

    const handleDistributeChange = (id: string, field: keyof typeof distributionRows[0], value: string) => {
        setDistributionRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const handleReject = async () => {
        if (!rejectReason.trim()) {
            toast.error(t('transfers.acceptance.rejectReasonRequired'));
            return;
        }
        if (isSubmitting) return;
        setIsSubmitting(true);

        try {
            await rejectTransfer(transfer.id, rejectReason);
            onOpenChange(false);
            onSuccess();
        } catch (error) {
            console.error(error);
            toast.error(t('transfers.acceptance.rejectError'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAccept = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);

        try {
            const allocationId = transfer.allocationId;
            const baseWeek = transfer.originalWeek || format(new Date(), 'yyyy-MM-dd');

            if (mode === 'keep') {
                const success = await acceptTransfer(transfer.id, 'keep', [], {
                    refetchWeekStarts: [baseWeek]
                });
                if (!success) throw new Error(t('transfers.acceptance.acceptBaseError'));

                toast.success(t('transfers.acceptance.acceptedKeep'));
                onOpenChange(false);
                onSuccess();
                return;
            }

            if (mode === 'move') {
                const success = await acceptTransfer(transfer.id, 'move', [], {
                    targetWeek: targetWeekDate,
                    refetchWeekStarts: [baseWeek, targetWeekDate]
                });
                if (!success) throw new Error(t('transfers.acceptance.acceptBaseError'));

                await addWeeklyFeedback({
                    employeeId: transfer.toEmployeeId,
                    weekStartDate: baseWeek,
                    projectId: transfer.projectId,
                    allocationId: allocationId,
                    reason: 'other',
                    comments: t('transfers.acceptance.activityMoveComment', {
                        date: format(parseISO(targetWeekDate), 'dd/MM'),
                    }),
                });

                toast.success(t('transfers.acceptance.acceptedMove'));
            }

            if (mode === 'distribute') {
                if (Math.abs(totalDistributedHours - transfer.hours) > 0.1) {
                    throw new Error(t('transfers.acceptance.hoursMismatch', {
                        distributed: totalDistributedHours.toFixed(1),
                        received: transfer.hours,
                    }));
                }

                const validRows = distributionRows.filter(r => r.taskName.trim() && parseFloat(r.hours) > 0);
                if (validRows.length === 0) throw new Error(t('transfers.acceptance.addValidTask'));

                const createdAllocations = await Promise.all(validRows.map(row =>
                    addAllocation({
                        employeeId: transfer.toEmployeeId,
                        projectId: transfer.projectId,
                        weekStartDate: row.weekDate,
                        hoursAssigned: parseFloat(row.hours),
                        taskName: row.taskName,
                        status: 'planned',
                        transferredFromAllocationId: transfer.allocationId,
                        originalTransferredTaskName: transfer.taskName,
                        transferSourceEmployeeId: transfer.fromEmployeeId
                    })
                ));

                const childIds = createdAllocations
                    .filter((alloc): alloc is NonNullable<typeof alloc> => alloc !== null)
                    .map(alloc => alloc.id);

                const distWeeks = [...new Set(validRows.map(r => r.weekDate))];
                const success = await acceptTransfer(transfer.id, 'distribute', childIds, {
                    distributionWeekStarts: distWeeks,
                    refetchWeekStarts: [baseWeek, ...distWeeks]
                });
                if (!success) throw new Error(t('transfers.acceptance.acceptError'));

                await addWeeklyFeedback({
                    employeeId: transfer.toEmployeeId,
                    weekStartDate: baseWeek,
                    projectId: transfer.projectId,
                    allocationId: allocationId,
                    reason: 'other',
                    comments: t('transfers.acceptance.activityDistributeComment', { count: validRows.length }),
                });

                toast.success(t('transfers.acceptance.acceptedDistribute'));
            }

            if (mode === 'rollover') {
                const nextWeekStr = format(addDays(parseISO(baseWeek), 7), 'yyyy-MM-dd');
                const success = await acceptTransfer(transfer.id, 'rollover', [], {
                    refetchWeekStarts: [baseWeek, nextWeekStr]
                });
                if (!success) throw new Error(t('transfers.acceptance.acceptError'));

                await addWeeklyFeedback({
                    employeeId: transfer.toEmployeeId,
                    weekStartDate: baseWeek,
                    projectId: transfer.projectId,
                    allocationId: allocationId,
                    reason: 'other',
                    comments: t('transfers.acceptance.activityRolloverComment'),
                });

                toast.success(t('transfers.acceptance.acceptedRollover'));
            }

            onOpenChange(false);
            onSuccess();

        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : t('transfers.acceptance.processError'));
        } finally {
            setIsSubmitting(false);
        }
    };

    // Renderizado condicional para rechazo
    if (isRejecting) {
        return (
            <Dialog open={open} onOpenChange={(val) => { if (!isSubmitting) onOpenChange(val); }}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="text-red-600 flex items-center gap-2">
                            <Ban className="h-5 w-5" />
                            {t('transfers.acceptance.rejectTitle')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('transfers.acceptance.rejectDescription')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label>{t('transfers.acceptance.rejectReasonLabel')} <span className="text-red-500">*</span></Label>
                            <Textarea
                                placeholder={t('transfers.reject.placeholder')}
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                className="min-h-[100px]"
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={() => setIsRejecting(false)} disabled={isSubmitting}>
                            {t('transfers.acceptance.back')}
                        </Button>
                        <Button variant="destructive" onClick={handleReject} disabled={isSubmitting}>
                            {isSubmitting ? t('transfers.acceptance.rejecting') : t('transfers.acceptance.rejectConfirm')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-hidden flex flex-col p-6">
                <DialogHeader>
                    <DialogTitle className="sr-only">{t('transfers.acceptance.acceptTitle')}</DialogTitle>
                    <DialogDescription className="sr-only">
                        {t('transfers.acceptance.acceptDescription')}
                    </DialogDescription>
                </DialogHeader>

                {/* Header estilo 'Card' minimalista */}
                <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-indigo-500" /> {/* Indicador proyecto/cliente */}
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 leading-none">{transfer.taskName}</h3>
                            <p className="text-sm text-slate-500 mt-1">{transfer.projectName}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-slate-400 uppercase font-medium mb-1">{t('transfers.acceptance.pendingLabel')}</div>
                        <Badge variant="secondary" className="text-amber-600 bg-amber-50 border-amber-100 text-sm px-2.5 py-0.5">
                            {transfer.hours}h
                        </Badge>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-6 pt-2">
                    {/* Opciones en Grid de 2 columnas como en la imagen */}
                    <RadioGroup
                        value={mode}
                        onValueChange={(v) => setMode(v as AcceptanceMode)}
                        className="grid grid-cols-1 md:grid-cols-2 gap-4"
                    >
                        {/* Opción 1: Mantener */}
                        <div>
                            <RadioGroupItem value="keep" id="opt-keep" className="peer sr-only" />
                            <Label htmlFor="opt-keep" className="cursor-pointer border rounded-lg p-4 flex items-center gap-3 transition-colors peer-data-[state=checked]:border-indigo-500 peer-data-[state=checked]:bg-indigo-50 hover:bg-slate-50">
                                <div className="h-5 w-5 rounded-full border border-slate-300 flex items-center justify-center peer-data-[state=checked]:border-indigo-600 peer-data-[state=checked]:text-indigo-600">
                                    {mode === 'keep' && <div className="h-2.5 w-2.5 rounded-full bg-indigo-600" />}
                                </div>
                                <span className="font-medium text-slate-700">{t('transfers.acceptance.optionKeep')}</span>
                            </Label>
                        </div>

                        {/* Opción 2: Rollover */}
                        <div>
                            <RadioGroupItem value="rollover" id="opt-rollover" className="peer sr-only" />
                            <Label htmlFor="opt-rollover" className="cursor-pointer border rounded-lg p-4 flex items-center gap-3 transition-colors peer-data-[state=checked]:border-indigo-500 peer-data-[state=checked]:bg-indigo-50 hover:bg-slate-50">
                                <div className="h-5 w-5 rounded-full border border-slate-300 flex items-center justify-center peer-data-[state=checked]:border-indigo-600 peer-data-[state=checked]:text-indigo-600">
                                    {mode === 'rollover' && <div className="h-2.5 w-2.5 rounded-full bg-indigo-600" />}
                                </div>
                                <span className="font-medium text-slate-700">{t('transfers.acceptance.optionRollover')}</span>
                            </Label>
                        </div>

                        {/* Opción 3: Mover */}
                        <div>
                            <RadioGroupItem value="move" id="opt-move" className="peer sr-only" />
                            <Label htmlFor="opt-move" className="cursor-pointer border rounded-lg p-4 flex items-center gap-3 transition-colors peer-data-[state=checked]:border-indigo-500 peer-data-[state=checked]:bg-indigo-50 hover:bg-slate-50">
                                <div className="h-5 w-5 rounded-full border border-slate-300 flex items-center justify-center peer-data-[state=checked]:border-indigo-600 peer-data-[state=checked]:text-indigo-600">
                                    {mode === 'move' && <div className="h-2.5 w-2.5 rounded-full bg-indigo-600" />}
                                </div>
                                <span className="font-medium text-slate-700">{t('transfers.acceptance.optionMove')}</span>
                            </Label>
                        </div>

                        {/* Opción 4: Distribuir */}
                        <div>
                            <RadioGroupItem value="distribute" id="opt-distribute" className="peer sr-only" />
                            <Label htmlFor="opt-distribute" className="cursor-pointer border rounded-lg p-4 flex items-center gap-3 transition-colors peer-data-[state=checked]:border-indigo-500 peer-data-[state=checked]:bg-indigo-50 hover:bg-slate-50">
                                <div className="h-5 w-5 rounded-full border border-slate-300 flex items-center justify-center peer-data-[state=checked]:border-indigo-600 peer-data-[state=checked]:text-indigo-600">
                                    {mode === 'distribute' && <div className="h-2.5 w-2.5 rounded-full bg-indigo-600" />}
                                </div>
                                <span className="font-medium text-slate-700">{t('transfers.acceptance.optionDistribute')}</span>
                            </Label>
                        </div>
                    </RadioGroup>

                    {/* Área Dinámica para Inputs Adicionales */}
                    <div className="min-h-[100px] animate-in slide-in-from-top-2 duration-200">
                        {mode === 'move' && (
                            <div className="p-4 bg-indigo-50/50 rounded-lg border border-indigo-100 mt-2 space-y-3">
                                <Label className="text-indigo-900 font-medium text-sm">{t('transfers.acceptance.whichWeek')}</Label>
                                <div className="relative">
                                    <select
                                        value={targetWeekDate}
                                        onChange={(e) => setTargetWeekDate(e.target.value)}
                                        className="w-full p-2 pl-9 bg-white border border-indigo-200 rounded-md text-sm cursor-pointer appearance-none hover:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    >
                                        {availableWeeks.map((week) => {
                                            const weekStart = week.weekStart;
                                            const monthName = format(weekStart, 'MMMM', { locale: dateLocale });
                                            // Capitalizar primera letra del mes
                                            const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

                                            // Usar weekLabel generado por dateUtils para consistencia con el Planner
                                            // week.weekLabel ya viene como "Semana X"
                                            const weekLabel = week.weekLabel || `Semana ${getWeekOfMonth(weekStart, { weekStartsOn: 1 })}`;

                                            const label = `${weekLabel} - ${capitalizedMonth} (${format(weekStart, 'dd/MM')})`;
                                            const weekKey = format(weekStart, 'yyyy-MM-dd');
                                            return (
                                                <option key={weekKey} value={weekKey}>
                                                    {label}
                                                </option>
                                            );
                                        })}
                                    </select>
                                    <CalendarIcon className="absolute left-3 top-2.5 h-4 w-4 text-indigo-400 pointer-events-none" />
                                </div>
                            </div>
                        )}

                        {mode === 'distribute' && (
                            <div className="p-4 bg-indigo-50/50 rounded-lg border border-indigo-100 mt-2 space-y-4">
                                <div className="flex justify-between items-center text-sm font-medium text-indigo-900">
                                    <span>{t('transfers.acceptance.distributeHours', { hours: totalDistributedHours.toFixed(2) })}</span>
                                    <span className={cn(
                                        Math.abs(totalDistributedHours - transfer.hours) < 0.01 ? "text-emerald-600" : "text-amber-600"
                                    )}>
                                        {t('transfers.acceptance.remainingHours', {
                                            hours: (transfer.hours - totalDistributedHours).toFixed(2),
                                        })}
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    {distributionRows.map((row) => (
                                        <div key={row.id} className="flex flex-col gap-2 p-2 bg-white/50 rounded-md border border-indigo-100/50">
                                            <div className="flex gap-2 items-center">
                                                <Input
                                                    value={row.taskName}
                                                    onChange={e => handleDistributeChange(row.id, 'taskName', e.target.value)}
                                                    placeholder={t('transfers.acceptance.subtaskPlaceholder')}
                                                    className="flex-1 bg-white border-indigo-200 h-9"
                                                />
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={row.hours}
                                                    onChange={e => handleDistributeChange(row.id, 'hours', e.target.value)}
                                                    className="w-20 bg-white border-indigo-200 h-9 text-right"
                                                    placeholder="0.00"
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDistributeRemoveRow(row.id)}
                                                    className="h-9 w-9 text-red-400 hover:text-red-500 hover:bg-red-50"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            {/* Selector de semana por fila */}
                                            <div className="relative">
                                                <select
                                                    value={row.weekDate}
                                                    onChange={(e) => handleDistributeChange(row.id, 'weekDate', e.target.value)}
                                                    className="w-full py-1.5 pl-8 pr-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 cursor-pointer appearance-none hover:border-indigo-300 focus:ring-1 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                                >
                                                    {availableWeeks.map((week) => {
                                                        const weekStart = week.weekStart;
                                                        const monthName = format(weekStart, 'MMMM', { locale: dateLocale });
                                                        const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

                                                        const weekLabel = week.weekLabel || `Semana ${getWeekOfMonth(weekStart, { weekStartsOn: 1 })}`;
                                                        const label = `${weekLabel} - ${capitalizedMonth} (${format(weekStart, 'dd/MM')})`;

                                                        const weekKey = format(weekStart, 'yyyy-MM-dd');
                                                        return (
                                                            <option key={weekKey} value={weekKey}>
                                                                {label}
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                                <CalendarIcon className="absolute left-2.5 top-2 h-3 w-3 text-slate-400 pointer-events-none" />
                                            </div>
                                        </div>
                                    ))}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleDistributeAddRow}
                                        className="w-full border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 bg-white"
                                    >
                                        <Plus className="h-3 w-3 mr-1" /> {t('transfers.acceptance.addDistribution')}
                                    </Button>
                                    {/* Nota eliminada porque ahora es explícito por tarea */}
                                </div>
                            </div>
                        )}

                        {mode === 'rollover' && (
                            <div className="p-4 bg-indigo-50/50 rounded-lg border border-indigo-100 mt-2">
                                <p className="text-sm text-indigo-800 flex items-center gap-2">
                                    <ArrowRight className="h-4 w-4" />
                                    {t('transfers.acceptance.rolloverHint')}
                                </p>
                            </div>
                        )}

                    </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t mt-4">
                    <Button
                        variant="ghost"
                        onClick={() => setIsRejecting(true)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 gap-2 px-2"
                    >
                        <Ban className="h-4 w-4" />
                        {t('transfers.acceptance.rejectButton')}
                    </Button>
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-200">
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={handleAccept} disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[100px]">
                            {isSubmitting ? '...' : (mode === 'keep' ? t('transfers.acceptance.acceptButton') : t('transfers.acceptance.confirmButton'))}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
