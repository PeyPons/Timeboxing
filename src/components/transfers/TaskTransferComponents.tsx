import { useState } from 'react';
import { useTaskTransfers, TaskTransfer } from '@/hooks/useTaskTransfers';
import { useApp } from '@/contexts/AppContext';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TransferAcceptanceDialog } from './TransferAcceptanceDialog';
import {
    ArrowRightLeft,
    Check,
    X,
    Clock,
    User,
    ArrowRight,
    MessageSquare,
    Bell
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, startOfMonth, parseISO } from 'date-fns';
import { filterEmployeesForOperationalMonthDate } from '@/utils/employeeAssignmentVisibility';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { useDateLocale } from '@/hooks/useDateLocale';

// ================================================================
// Pending Transfers Panel (for recipients)
// ================================================================
export function PendingTransfersPanel() {
    const { t } = useAppTranslation();
    const dateLocale = useDateLocale();
    const { pendingTransfers, rejectTransfer, isLoading, fetchTransfers } = useTaskTransfers();
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [selectedTransfer, setSelectedTransfer] = useState<TaskTransfer | null>(null);
    const [acceptanceDialogOpen, setAcceptanceDialogOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [processing, setProcessing] = useState<string | null>(null);

    if (isLoading) {
        return (
            <Card className="border-amber-200 bg-amber-50/50">
                <CardContent className="py-4 text-center text-sm text-muted-foreground">
                    {t('transfers.pending.loading', 'Cargando transferencias...')}
                </CardContent>
            </Card>
        );
    }

    if ((pendingTransfers || []).length === 0) {
        return null; // Don't show if no pending transfers
    }

    const handleOpenAcceptance = (transfer: TaskTransfer) => {
        setSelectedTransfer(transfer);
        setAcceptanceDialogOpen(true);
    };

    const handleReject = async () => {
        if (!selectedTransfer) return;
        setProcessing(selectedTransfer.id);
        await rejectTransfer(selectedTransfer.id, rejectReason);
        setProcessing(null);
        setRejectDialogOpen(false);
        setRejectReason('');
        setSelectedTransfer(null);
    };

    const openRejectDialog = (transfer: TaskTransfer) => {
        setSelectedTransfer(transfer);
        setRejectDialogOpen(true);
    };

    return (
        <>
            <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/50 shadow-lg">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-amber-800">
                        <Bell className="h-5 w-5 animate-pulse" />
                        {t('transfers.pending.title', 'Transferencias Pendientes')}
                        <Badge variant="secondary" className="ml-2 bg-amber-200 text-amber-800">
                            {(pendingTransfers || []).length}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="max-h-[300px]">
                        <div className="space-y-3">
                            {(pendingTransfers || []).map((transfer) => (
                                <div
                                    key={transfer.id}
                                    className="flex items-center justify-between gap-4 p-3 bg-white rounded-lg border border-amber-100 shadow-sm hover:shadow-md transition-shadow"
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <Avatar className="h-8 w-8 shrink-0">
                                            <AvatarFallback className="bg-amber-100 text-amber-700 text-xs">
                                                {transfer.fromEmployeeName?.slice(0, 2).toUpperCase() || '??'}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="font-medium truncate">{transfer.fromEmployeeName}</span>
                                                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                                <span className="text-muted-foreground">{t('transfers.pending.sendsYou', 'te envía')}</span>
                                            </div>
                                            <div className="text-sm font-medium text-slate-700 truncate">
                                                {transfer.taskName || t('transfers.unnamedTask', 'Tarea sin nombre')}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                <Clock className="h-3 w-3" />
                                                <span>{transfer.hours}h</span>
                                                <span>•</span>
                                                <span>
                                                    {formatDistanceToNow(new Date(transfer.requestedAt), {
                                                        addSuffix: true,
                                                        locale: dateLocale
                                                    })}
                                                </span>
                                            </div>
                                            {transfer.reason && (
                                                <div className="flex items-start gap-1 mt-1 text-xs text-muted-foreground">
                                                    <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                                                    <span className="italic">"{transfer.reason}"</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => openRejectDialog(transfer)}
                                            disabled={!!processing}
                                            className="border-red-200 text-red-600 hover:bg-red-50"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="h-8 gap-1 bg-amber-600 hover:bg-amber-700 text-white border-none"
                                            onClick={() => handleOpenAcceptance(transfer)}
                                            disabled={!!processing}
                                        >
                                            <Check className="h-4 w-4" />
                                            {t('transfers.pending.accept', 'Aceptar')}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>

            <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('transfers.reject.title', 'Reject transfer')}</DialogTitle>
                        <DialogDescription>
                            {t('transfers.reject.description', 'Why are you rejecting this task? The sender will receive this message.')}
                        </DialogDescription>
                    </DialogHeader>
                    <Textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder={t('transfers.reject.placeholder', 'E.g. I have no capacity this week...')}
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>{t('common.cancel', 'Cancel')}</Button>
                        <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim() || !!processing}>
                            {t('transfers.reject.confirm', 'Reject')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Diálogo de Aceptación Avanzada */}
            {selectedTransfer && (
                <TransferAcceptanceDialog
                    key={selectedTransfer.id}
                    open={acceptanceDialogOpen}
                    onOpenChange={setAcceptanceDialogOpen}
                    transfer={selectedTransfer}
                    onSuccess={() => {
                        setAcceptanceDialogOpen(false);
                        setSelectedTransfer(null);
                        fetchTransfers();
                    }}
                />
            )}
        </>
    );
}

// ================================================================
// Transfer Request Dialog (for creating new transfers)
// ================================================================
interface TransferRequestDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    allocationId: string;
    taskName: string;
    currentHours: number;
    fromEmployeeId?: string; // Nuevo prop para soportar transfers desde otros (Admin)
    /** Semana de la tarea (lunes ISO); determina el mes para listar inactivos con carga. */
    allocationWeekStartDate?: string;
}

export function TransferRequestDialog({
    open,
    onOpenChange,
    allocationId,
    taskName,
    currentHours,
    fromEmployeeId,
    allocationWeekStartDate,
}: TransferRequestDialogProps) {
    const { t } = useAppTranslation();
    const { employees, currentUser, allocations } = useApp();
    const { requestTransfer } = useTaskTransfers();

    const [selectedEmployee, setSelectedEmployee] = useState<string>('');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Filter logic: Exclude the OWNER of the task, not necessarily the current user.
    // Use fallback to currentUser.id if fromEmployeeId is missing (backward compatibility)
    const sourceId = fromEmployeeId || currentUser?.id;

    const transferMonth = allocationWeekStartDate
        ? startOfMonth(parseISO(allocationWeekStartDate))
        : startOfMonth(new Date());
    const eligibleEmployees = filterEmployeesForOperationalMonthDate(employees ?? [], transferMonth, {
        allocations: allocations ?? [],
        deadlines: [],
        globalAssignments: [],
    }).filter((e) => e.id !== sourceId);

    const handleSubmit = async () => {
        if (!selectedEmployee) return;

        setSubmitting(true);
        const success = await requestTransfer({
            allocationId,
            toEmployeeId: selectedEmployee,
            hoursTransferred: currentHours,
            reason: reason || undefined,
            fromEmployeeId: sourceId // Pass the real source
        });

        setSubmitting(false);
        if (success) {
            onOpenChange(false);
            setSelectedEmployee('');
            setReason('');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ArrowRightLeft className="h-5 w-5 text-indigo-600" />
                        {t('transfers.request.title', 'Transfer task')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('transfers.request.description', 'Ask a teammate to take over this task.')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Task info */}
                    <div className="p-3 bg-slate-50 rounded-lg">
                        <div className="text-sm text-muted-foreground">{t('transfers.request.taskLabel', 'Task')}</div>
                        <div className="font-medium">{taskName}</div>
                        <div className="text-sm text-muted-foreground mt-1">{t('transfers.request.hoursAssigned', '{{hours}}h assigned', { hours: currentHours })}</div>
                    </div>

                    {/* Employee selector */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">{t('transfers.request.transferTo', 'Transfer to')}</label>
                        <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                            {eligibleEmployees.map((emp) => (
                                <button
                                    key={emp.id}
                                    type="button"
                                    onClick={() => setSelectedEmployee(emp.id)}
                                    className={cn(
                                        "flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                                        selectedEmployee === emp.id
                                            ? "border-indigo-500 bg-indigo-50 shadow-sm ring-1 ring-indigo-500/20"
                                            : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
                                    )}
                                >
                                    <Avatar className="h-8 w-8 shrink-0">
                                        <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-semibold">
                                            {emp.name.slice(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col overflow-hidden">
                                        <span className="text-sm font-medium truncate text-slate-700">{emp.name}</span>
                                        <span className="text-xs text-muted-foreground truncate">{emp.email}</span>
                                    </div>
                                    {selectedEmployee === emp.id && (
                                        <Check className="ml-auto h-4 w-4 text-indigo-600" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Reason */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">{t('transfers.request.reasonLabel', 'Reason (optional)')}</label>
                        <Textarea
                            placeholder={t('transfers.request.reasonPlaceholder', 'E.g. I have no time this week...')}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="min-h-[60px]"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        {t('common.cancel', 'Cancel')}
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!selectedEmployee || submitting}
                        className="bg-indigo-600 hover:bg-indigo-700"
                    >
                        <ArrowRightLeft className="h-4 w-4 mr-2" />
                        {t('transfers.request.submit', 'Send request')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
