import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/contexts/AppContext';
import { useAgency } from '@/contexts/AgencyContext';
import { useDepartmentView } from '@/contexts/DepartmentViewContext';
import { normalizeDepartments, employeeBelongsToDepartment } from '@/utils/departmentUtils';
import { getValidRole } from '@/utils/roleUtils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Helmet } from 'react-helmet-async';
import {
    Users,
    Zap,
    AlertTriangle,
    CheckCircle2,
    Clock,
    TrendingUp,
    UserCheck,
    Flame,
    Calendar,
    CalendarDays
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, addDays } from 'date-fns';
import { useDateLocale } from '@/hooks/useDateLocale';
import { getWorkingDaysInRange, getMonthlyCapacity, isAllocationInEffectiveMonth } from '@/utils/dateUtils';
import { filterEmployeesForOperationalMonthDate } from '@/utils/employeeAssignmentVisibility';
import { hoursCountedTowardLoad } from '@/utils/appMetrics';
import { getAbsenceHoursInRange } from '@/utils/absenceUtils';
import { getTeamEventHoursInRange } from '@/utils/teamEventUtils';

type ViewMode = 'week' | 'month';

interface EmployeeCapacity {
    id: string;
    name: string;
    avatarUrl?: string;
    role: string;
    hoursAssigned: number;
    baseCapacity: number;
    absenceReduction: number;
    eventReduction: number;
    effectiveCapacity: number;
    availableHours: number;
    occupancyRate: number;
    status: 'free' | 'busy' | 'overloaded' | 'away';
    pendingTasks: number;
}

export default function TeamCapacityPage() {
    const { t } = useTranslation('app');
    const dateLocale = useDateLocale();
    const { employees, allocations, absences, teamEvents } = useApp();
    const { currentAgency } = useAgency();
    const { selectedDepartmentId } = useDepartmentView();

    const departments = useMemo(() => normalizeDepartments(currentAgency?.settings?.departments), [currentAgency?.settings?.departments]);
    const employeesForView = useMemo(() => {
        if (!selectedDepartmentId || !departments.length) return employees ?? [];
        const dept = departments.find(d => d.id === selectedDepartmentId || d.name === selectedDepartmentId);
        if (!dept) return employees ?? [];
        return (employees ?? []).filter(e => employeeBelongsToDepartment(e.department, dept.id, dept.name));
    }, [employees, selectedDepartmentId, departments]);

    const today = useMemo(() => new Date(), []);
    const [viewMode, setViewMode] = useState<ViewMode>('month');

    // Calcular rangos según el modo de vista, respetando límites del mes actual
    const { rangeStart, rangeEnd, periodLabel, filterAllocationsForMonth } = useMemo(() => {
        const currentMonthStart = startOfMonth(today);
        const currentMonthEnd = endOfMonth(today);

        if (viewMode === 'week') {
            const weekStart = startOfWeek(today, { weekStartsOn: 1 });
            const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

            // Usar límites efectivos: la parte de la semana que pertenece al mes actual
            const effectiveStart = weekStart < currentMonthStart ? currentMonthStart : weekStart;
            const effectiveEnd = weekEnd > currentMonthEnd ? currentMonthEnd : weekEnd;

            // La etiqueta muestra el rango efectivo dentro del mes
            const label = effectiveStart.getTime() === effectiveEnd.getTime()
                ? format(effectiveStart, 'PPP', { locale: dateLocale })
                : `${format(effectiveStart, 'd', { locale: dateLocale })} - ${format(effectiveEnd, 'PPP', { locale: dateLocale })}`;

            return {
                rangeStart: effectiveStart,
                rangeEnd: effectiveEnd,
                periodLabel: t('teamCapacity.periodWeek', { defaultValue: 'Semana: {{label}}', label }),
                filterAllocationsForMonth: true // Filtrar allocations solo del mes actual
            };
        } else {
            return {
                rangeStart: currentMonthStart,
                rangeEnd: currentMonthEnd,
                periodLabel: format(today, 'MMMM yyyy', { locale: dateLocale }),
                filterAllocationsForMonth: true
            };
        }
    }, [today, viewMode, dateLocale, t]);

    // Calcular capacidad de cada empleado con ausencias y eventos (respeta vista por departamento)
    const teamCapacity = useMemo(() => {
        const activeEmployees = filterEmployeesForOperationalMonthDate(employeesForView, startOfMonth(today), {
            allocations,
            deadlines: [],
            globalAssignments: [],
        });

        return activeEmployees.map(emp => {
            const schedule = emp.workSchedule || {};

            // 1. Capacidad base (horas laborables en el periodo)
            const workingDaysResult = getWorkingDaysInRange(rangeStart, rangeEnd, schedule as any);
            const baseCapacity = typeof workingDaysResult === 'object' ? workingDaysResult.totalHours : workingDaysResult * 8;

            // 2. Reducciones por ausencias
            const employeeAbsences = absences.filter(a => a.employeeId === emp.id);
            const absenceReduction = getAbsenceHoursInRange(rangeStart, rangeEnd, employeeAbsences, schedule as any);

            // 3. Reducciones por eventos de equipo
            const eventReduction = getTeamEventHoursInRange(rangeStart, rangeEnd, emp.id, teamEvents, schedule as any, employeeAbsences);

            // 4. Capacidad efectiva
            const effectiveCapacity = Math.max(0, baseCapacity - absenceReduction - eventReduction);

            // 5. Horas asignadas en el periodo (usando isAllocationInEffectiveMonth para consistencia)
            const currentMonth = startOfMonth(today);
            const periodAllocations = allocations.filter(a => {
                if (a.employeeId !== emp.id) return false;

                // Usar isAllocationInEffectiveMonth para consistencia con el planificador
                const isInMonth = isAllocationInEffectiveMonth(a.weekStartDate, currentMonth);
                if (!isInMonth) return false;

                // Para la vista semanal, también filtramos que la fecha esté en el rango
                if (viewMode === 'week') {
                    const allocDate = new Date(a.weekStartDate);
                    return allocDate >= rangeStart && allocDate <= rangeEnd;
                }

                return true;
            });

            // Misma regla que `computeEmployeeLoadForWeek` (planificador)
            const hoursAssigned = periodAllocations.reduce((sum, a) => sum + hoursCountedTowardLoad(a), 0);
            const pendingTasks = periodAllocations.filter(a => a.status === 'planned').length;

            const availableHours = Math.max(0, effectiveCapacity - hoursAssigned);
            const occupancyRate = effectiveCapacity > 0 ? (hoursAssigned / effectiveCapacity) * 100 : (hoursAssigned > 0 ? 999 : 0);

            // 6. Determinar estado
            const isCurrentlyAway = absences.some(a =>
                a.employeeId === emp.id &&
                new Date(a.startDate) <= today &&
                new Date(a.endDate) >= today
            );

            let status: 'free' | 'busy' | 'overloaded' | 'away' = 'free';
            if (isCurrentlyAway && occupancyRate < 20) {
                status = 'away';
            } else if (occupancyRate >= 100) {
                status = 'overloaded'; // >= 100% es sobrecarga
            } else if (occupancyRate > 85) {
                status = 'busy';
            }

            return {
                id: emp.id,
                name: emp.name,
                avatarUrl: emp.avatarUrl,
                role: emp.role,
                hoursAssigned,
                baseCapacity,
                absenceReduction,
                eventReduction,
                effectiveCapacity,
                availableHours,
                occupancyRate,
                status,
                pendingTasks
            } as EmployeeCapacity;
        }).sort((a, b) => b.availableHours - a.availableHours);
    }, [employeesForView, allocations, absences, teamEvents, rangeStart, rangeEnd, today, viewMode]);

    // Filtrar por categorías
    const highAvailability = teamCapacity.filter(e => e.status === 'free' && e.availableHours >= (viewMode === 'week' ? 4 : 10));
    const busyTeam = teamCapacity.filter(e => e.status === 'busy');
    const overloaded = teamCapacity.filter(e => e.status === 'overloaded');
    const moderate = teamCapacity.filter(e => e.status === 'free' && e.availableHours < (viewMode === 'week' ? 4 : 10));
    const away = teamCapacity.filter(e => e.status === 'away');

    // Estadísticas generales
    const stats = useMemo(() => {
        const totalHoursAssigned = teamCapacity.reduce((sum, e) => sum + e.hoursAssigned, 0);
        const totalCapacity = teamCapacity.reduce((sum, e) => sum + e.effectiveCapacity, 0);
        const totalAvailableHours = teamCapacity.reduce((sum, e) => sum + e.availableHours, 0);
        const globalOccupancy = totalCapacity > 0 ? (totalHoursAssigned / totalCapacity) * 100 : 0;

        return {
            totalAvailableHours,
            globalOccupancy: Math.round(globalOccupancy),
            overloadedCount: overloaded.length,
            availableCount: highAvailability.length
        };
    }, [teamCapacity, highAvailability, overloaded]);

    const getStatusStyles = (status: string, rate: number) => {
        if (status === 'away') return { bg: 'bg-slate-100', border: 'border-slate-200', text: 'text-slate-500', icon: Users, label: t('teamCapacity.status.away', 'Ausente') };
        if (rate >= 100) return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: AlertTriangle, label: t('teamCapacity.status.overloaded', 'Sobrecarga') };
        if (rate > 85) return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: Clock, label: t('teamCapacity.status.busy', 'Ocupado') };
        if (rate > 50) return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: TrendingUp, label: t('teamCapacity.status.productive', 'Productivo') };
        return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: CheckCircle2, label: t('teamCapacity.status.available', 'Disponible') };
    };

    const EmployeeCard = ({ emp }: { emp: EmployeeCapacity }) => {
        const styles = getStatusStyles(emp.status, emp.occupancyRate);
        const Icon = styles.icon;
        const hasReductions = emp.absenceReduction > 0 || emp.eventReduction > 0;

        // Obtener rol válido (nunca vacío)
        const availableRoles = currentAgency?.settings?.roles || [];
        const employeeData = employees.find(e => e.id === emp.id);
        const displayRole = getValidRole(employeeData, availableRoles);

        return (
            <div className={cn(
                "p-4 rounded-xl border-2 transition-all hover:shadow-md bg-white",
                styles.border
            )}>
                <div className="flex items-start gap-3">
                    <div className="relative">
                        <Avatar className="h-12 w-12 border-2 border-white shadow-sm font-bold">
                            <AvatarImage src={emp.avatarUrl} />
                            <AvatarFallback className="bg-primary text-white">
                                {emp.name.charAt(0)}
                            </AvatarFallback>
                        </Avatar>
                        <div className={cn("absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center shadow-sm", styles.bg)}>
                            <Icon className={cn("h-3 w-3", styles.text)} />
                        </div>
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="font-bold text-slate-900 truncate">{emp.name}</h4>
                                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{displayRole}</p>
                            </div>
                            <Badge variant="outline" className={cn("text-[10px] h-5", styles.bg, styles.text, styles.border)}>
                                {styles.label}
                            </Badge>
                        </div>

                        <div className="mt-3 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-500 font-medium">{t('teamCapacity.card.occupancy', 'Ocupación')}</span>
                                <span className={cn("font-bold", styles.text)}>
                                    {Math.round(emp.occupancyRate)}%
                                </span>
                            </div>
                            <Progress
                                value={Math.min(100, emp.occupancyRate)}
                                className={cn("h-1.5", emp.occupancyRate > 100 && "[&>div]:bg-red-500")}
                            />

                            <div className="flex items-center justify-between pt-1">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[11px] text-slate-600 font-medium">
                                        {Math.round(emp.hoursAssigned * 100) / 100}h / {Math.round(emp.effectiveCapacity)}h
                                    </span>
                                    {hasReductions && (
                                        <span className="text-[10px] text-amber-600 flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {t('teamCapacity.card.absences', { hours: (emp.absenceReduction + emp.eventReduction).toFixed(0), defaultValue: `-${(emp.absenceReduction + emp.eventReduction).toFixed(0)}h (ausencias/eventos)` })}
                                        </span>
                                    )}
                                    <span className="text-[10px] text-slate-400">
                                        {t('teamCapacity.card.pendingTasks', { count: emp.pendingTasks, defaultValue: `${emp.pendingTasks} tareas planificadas` })}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <div className={cn("text-sm font-bold", emp.availableHours > (viewMode === 'week' ? 4 : 10) ? "text-emerald-600" : "text-slate-600")}>
                                        {Math.round(emp.availableHours)}h
                                    </div>
                                    <div className="text-[9px] text-slate-400 font-medium uppercase">{t('teamCapacity.card.free', 'Libres')}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            <Helmet>
                <title>{t('teamCapacity.metaTitle', 'Disponibilidad del equipo | Taimbox')}</title>
            </Helmet>

            <div className="flex flex-col h-full space-y-6 p-6 md:p-8 max-w-[1600px] mx-auto w-full">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
                            <Users className="h-8 w-8 text-primary" />
                            {t('teamCapacity.title', 'Disponibilidad del equipo')}
                        </h1>
                        <p className="text-muted-foreground mt-1 flex items-center gap-2">
                            <CalendarDays className="h-4 w-4" />
                            {t('teamCapacity.subtitle', 'Balance de carga para')} <span className="font-bold text-slate-900 capitalize">{periodLabel}</span>
                        </p>
                    </div>

                    {/* Toggle Vista Semanal / Mensual */}
                    <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border shadow-inner">
                        <Button
                            variant={viewMode === 'week' ? 'outline' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('week')}
                            className={cn("h-8 text-xs px-4 rounded-md transition-all", viewMode === 'week' && "bg-white shadow-sm text-primary font-bold")}
                        >
                            {t('teamCapacity.viewModes.week', 'Esta Semana')}
                        </Button>
                        <Button
                            variant={viewMode === 'month' ? 'outline' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('month')}
                            className={cn("h-8 text-xs px-4 rounded-md transition-all", viewMode === 'month' && "bg-white shadow-sm text-primary font-bold")}
                        >
                            {t('teamCapacity.viewModes.month', 'Este Mes')}
                        </Button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-white border-slate-200 shadow-sm overflow-hidden group">
                        <div className="h-1 w-full bg-emerald-500" />
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                                    <UserCheck className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-slate-900">{stats.availableCount}</p>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{t('teamCapacity.stats.highAvailability', 'Alta disponibilidad')}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
                        <div className="h-1 w-full bg-blue-500" />
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                                    <Clock className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-slate-900">{Math.round(stats.totalAvailableHours)}h</p>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{t('teamCapacity.stats.availableCapacity', 'Capacidad disponible')}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
                        <div className="h-1 w-full bg-indigo-500" />
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                                    <TrendingUp className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-slate-900">{stats.globalOccupancy}%</p>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{t('teamCapacity.stats.globalOccupancy', 'Ocupación global')}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
                        <div className="h-1 w-full bg-red-500" />
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-red-50 text-red-600">
                                    <AlertTriangle className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-slate-900">{stats.overloadedCount}</p>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{t('teamCapacity.stats.overloaded', 'En sobrecarga')}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Disponibles */}
                    <div className="space-y-6">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Flame className="h-5 w-5 text-orange-500" />
                                <h3 className="text-lg font-bold text-slate-800">{t('teamCapacity.sections.highAvailability.title', 'Alta disponibilidad')}</h3>
                            </div>
                            <p className="text-sm text-slate-500">
                                {viewMode === 'week' ? t('teamCapacity.sections.highAvailability.subtitleWeek', 'Miembros con +4h libres esta semana') : t('teamCapacity.sections.highAvailability.subtitleMonth', 'Miembros con +10h libres este mes')}
                            </p>
                        </div>

                        {highAvailability.length === 0 ? (
                            <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                                <Zap className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                                <p className="text-slate-500 font-medium">{t('teamCapacity.sections.highAvailability.emptyState', 'Todo el equipo está ocupado')}</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {highAvailability.map(emp => (
                                    <EmployeeCard key={emp.id} emp={emp} />
                                ))}
                            </div>
                        )}

                        {moderate.length > 0 && (
                            <>
                                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                                    <h4 className="text-sm font-bold text-slate-600 uppercase tracking-wider">{t('teamCapacity.sections.moderate', 'Disponibilidad moderada')}</h4>
                                    <Badge variant="outline" className="text-[10px]">{moderate.length} {t('teamCapacity.sections.persons', 'personas')}</Badge>
                                </div>
                                <div className="grid grid-cols-1 gap-3">
                                    {moderate.map(emp => (
                                        <EmployeeCard key={emp.id} emp={emp} />
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Ocupados / Sobrecargados */}
                    <div className="space-y-6">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Zap className="h-5 w-5 text-indigo-500" />
                                <h3 className="text-lg font-bold text-slate-800">{t('teamCapacity.sections.criticalLoad.title', 'Carga crítica')}</h3>
                            </div>
                            <p className="text-sm text-slate-500">{t('teamCapacity.sections.criticalLoad.subtitle', 'Miembros con poca o ninguna disponibilidad')}</p>
                        </div>

                        <div className="space-y-6">
                            {overloaded.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-bold text-red-600 uppercase tracking-widest flex items-center gap-2">
                                            <AlertTriangle className="h-3 w-3" /> {t('teamCapacity.sections.criticalLoad.overload', 'Sobrecarga (≥100%)')}
                                        </h4>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3">
                                        {overloaded.map(emp => (
                                            <EmployeeCard key={emp.id} emp={emp} />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {busyTeam.length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-amber-600 uppercase tracking-widest flex items-center gap-2">
                                        <Clock className="h-3 w-3" /> {t('teamCapacity.sections.criticalLoad.busy', 'Muy ocupado (85-99%)')}
                                    </h4>
                                    <div className="grid grid-cols-1 gap-3">
                                        {busyTeam.map(emp => (
                                            <EmployeeCard key={emp.id} emp={emp} />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {overloaded.length === 0 && busyTeam.length === 0 && (
                                <div className="text-center py-12 bg-emerald-50/50 rounded-2xl border-2 border-dashed border-emerald-100">
                                    <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-300" />
                                    <p className="text-emerald-700 font-medium">{t('teamCapacity.sections.criticalLoad.emptyState', 'Nadie está sobrecargado')}</p>
                                </div>
                            )}
                        </div>

                        {away.length > 0 && (
                            <div className="pt-8 space-y-3">
                                <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t('teamCapacity.sections.away', 'Ausencias actuales')}</h4>
                                <div className="grid grid-cols-1 gap-3">
                                    {away.map(emp => (
                                        <EmployeeCard key={emp.id} emp={emp} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
