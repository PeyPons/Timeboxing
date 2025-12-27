import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  BarChart3,
  Users,
  Clock,
  TrendingUp,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CheckCircle2,
  Filter,
  Zap,
  Target,
  AlertTriangle,
  TrendingDown,
  Flame,
  Snowflake,
  AlertCircle,
  Award,
  Trophy,
  Star,
  Gauge,
  Link2,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getMonthlyCapacity } from '@/utils/dateUtils';
import { getAbsenceHoursInRange } from '@/utils/absenceUtils';
import { getTeamEventHoursInRange } from '@/utils/teamEventUtils';
import { format, subMonths, addMonths, startOfMonth, endOfMonth, parseISO, isSameMonth, differenceInWeeks, startOfWeek, addWeeks, getWeek, getDate } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { Deadline, GlobalAssignment } from '@/types';

const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

// ============================================================================
// NUEVO: Interfaz y función para calcular el Índice de Fiabilidad Histórico
// ============================================================================
interface ReliabilityData {
  index: number;           // Índice de fiabilidad (0-200+)
  totalEstimated: number;  // Total horas estimadas históricas
  totalReal: number;       // Total horas reales históricas
  tasksAnalyzed: number;   // Número de tareas analizadas
  trend: 'accurate' | 'overestimates' | 'underestimates' | 'insufficient';
  deviation: number;       // Desviación promedio en horas por tarea
}

// Función para obtener el color del badge según el índice de fiabilidad
const getReliabilityColor = (index: number, tasksAnalyzed: number): string => {
  if (tasksAnalyzed < 5) return 'bg-slate-100 text-slate-600 border-slate-200'; // Datos insuficientes
  if (index >= 90 && index <= 110) return 'bg-emerald-100 text-emerald-700 border-emerald-200'; // Preciso
  if (index >= 70 && index < 90) return 'bg-amber-100 text-amber-700 border-amber-200'; // Subestima moderado
  if (index > 110 && index <= 130) return 'bg-amber-100 text-amber-700 border-amber-200'; // Sobreestima moderado
  return 'bg-red-100 text-red-700 border-red-200'; // Desviación significativa
};

// Función para obtener el icono según la tendencia
const getReliabilityIcon = (trend: ReliabilityData['trend']) => {
  switch (trend) {
    case 'accurate': return <Target className="h-3 w-3" />;
    case 'overestimates': return <TrendingUp className="h-3 w-3" />;
    case 'underestimates': return <TrendingDown className="h-3 w-3" />;
    default: return <AlertTriangle className="h-3 w-3" />;
  }
};

// Función para obtener el texto descriptivo de la tendencia
const getReliabilityLabel = (data: ReliabilityData): string => {
  if (data.tasksAnalyzed < 5) return 'Pocos datos';
  if (data.trend === 'accurate') return 'Preciso';
  if (data.trend === 'overestimates') return 'Sobreestima';
  if (data.trend === 'underestimates') return 'Subestima';
  return 'Sin datos';
};

export default function ReportsPage() {
  const { employees, clients, projects, allocations, absences, teamEvents } = useApp();
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('all');
  
  const handlePrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const handleToday = () => setCurrentMonth(new Date());

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const activeEmployees = useMemo(() => {
      if (selectedEmployeeId === 'all') return employees.filter(e => e.isActive);
      return employees.filter(e => e.id === selectedEmployeeId);
  }, [employees, selectedEmployeeId]);

  const monthAllocations = useMemo(() => {
    return (allocations || []).filter(a => {
      const weekStart = parseISO(a.weekStartDate);
      const inMonth = weekStart >= monthStart && weekStart <= monthEnd;
      const matchesEmp = selectedEmployeeId === 'all' || a.employeeId === selectedEmployeeId;
      return inMonth && matchesEmp;
    });
  }, [allocations, monthStart, monthEnd, selectedEmployeeId]);

  const totalCapacity = useMemo(() => activeEmployees.reduce((sum, e) => {
    return sum + getMonthlyCapacity(year, month, e.workSchedule);
  }, 0), [activeEmployees, year, month]);

  // --- CÁLCULOS PRINCIPALES ---
  const monthStats = useMemo(() => {
    const planned = round2(monthAllocations.reduce((sum, a) => sum + a.hoursAssigned, 0));
    const completedTasks = monthAllocations.filter(a => a.status === 'completed');
    const real = round2(completedTasks.reduce((sum, a) => sum + (a.hoursActual || 0), 0));
    const computed = round2(completedTasks.reduce((sum, a) => sum + (a.hoursComputed || 0), 0));

    return { planned, real, computed };
  }, [monthAllocations]);

  const utilizationRate = totalCapacity > 0 ? (monthStats.planned / totalCapacity) * 100 : 0;
  const profitabilityRate = monthStats.real > 0 ? (monthStats.computed / monthStats.real) * 100 : 0;

  // ============================================================================
  // NUEVO: Cálculo del Índice de Fiabilidad Histórico por empleado
  // ============================================================================
  const reliabilityByEmployee = useMemo(() => {
    const reliabilityMap: Record<string, ReliabilityData> = {};
    
    // Agrupar TODAS las allocations completadas por empleado (histórico completo)
    (employees || []).forEach(emp => {
      const completedTasks = (allocations || []).filter(a => 
        a.employeeId === emp.id && 
        a.status === 'completed' &&
        a.hoursAssigned > 0 &&
        (a.hoursActual || 0) > 0
      );
      
      const totalEstimated = round2(completedTasks.reduce((sum, a) => sum + a.hoursAssigned, 0));
      const totalReal = round2(completedTasks.reduce((sum, a) => sum + (a.hoursActual || 0), 0));
      const tasksAnalyzed = completedTasks.length;
      
      // Calcular índice: (Estimado / Real) * 100
      // 100% = perfecto, <100% = subestima, >100% = sobreestima
      const index = totalReal > 0 ? round2((totalEstimated / totalReal) * 100) : 0;
      
      // Determinar tendencia
      let trend: ReliabilityData['trend'] = 'insufficient';
      if (tasksAnalyzed >= 5) {
        if (index >= 90 && index <= 110) {
          trend = 'accurate';
        } else if (index < 90) {
          trend = 'underestimates'; // Estima menos de lo que tarda
        } else {
          trend = 'overestimates'; // Estima más de lo que tarda
        }
      }
      
      // Calcular desviación promedio por tarea
      const deviation = tasksAnalyzed > 0 
        ? round2((totalReal - totalEstimated) / tasksAnalyzed) 
        : 0;
      
      reliabilityMap[emp.id] = {
        index,
        totalEstimated,
        totalReal,
        tasksAnalyzed,
        trend,
        deviation
      };
    });
    
    return reliabilityMap;
  }, [employees, allocations]);

  const employeeData = useMemo(() => {
    return activeEmployees.map(e => {
      const capacity = getMonthlyCapacity(year, month, e.workSchedule);
      const empAllocations = monthAllocations.filter(a => a.employeeId === e.id);
      const completedTasks = empAllocations.filter(a => a.status === 'completed');
      
      const plannedHours = round2(empAllocations.reduce((sum, a) => sum + a.hoursAssigned, 0));
      const realHours = round2(completedTasks.reduce((sum, a) => sum + (a.hoursActual || 0), 0));
      const computedHours = round2(completedTasks.reduce((sum, a) => sum + (a.hoursComputed || 0), 0));
      
      const percentage = capacity > 0 ? (plannedHours / capacity) * 100 : 0;
      // Eficiencia individual (Comp vs Real)
      const efficiency = realHours > 0 ? (computedHours / realHours) * 100 : 0;
      
      // NUEVO: Añadir datos de fiabilidad histórica
      const reliability = reliabilityByEmployee[e.id] || {
        index: 0,
        totalEstimated: 0,
        totalReal: 0,
        tasksAnalyzed: 0,
        trend: 'insufficient' as const,
        deviation: 0
      };

      return { ...e, plannedHours, realHours, computedHours, capacity, percentage, efficiency, reliability };
    }).sort((a, b) => b.percentage - a.percentage);
  }, [activeEmployees, monthAllocations, year, month, reliabilityByEmployee]);

  const projectData = useMemo(() => {
    const relevantProjectIds = new Set(monthAllocations.map(a => a.projectId));
    const projectsToShow = selectedEmployeeId === 'all' 
        ? (projects || []).filter(p => p.status === 'active') 
        : (projects || []).filter(p => relevantProjectIds.has(p.id));

    return projectsToShow.map(p => {
        const client = (clients || []).find(c => c.id === p.clientId);
        const projAllocations = monthAllocations.filter(a => a.projectId === p.id);
        const completedTasks = projAllocations.filter(a => a.status === 'completed');
        
        const planned = round2(projAllocations.reduce((sum, a) => sum + a.hoursAssigned, 0));
        const real = round2(completedTasks.reduce((sum, a) => sum + (a.hoursActual || 0), 0));
        const computed = round2(completedTasks.reduce((sum, a) => sum + (a.hoursComputed || 0), 0));

        const percentage = p.budgetHours > 0 ? (planned / p.budgetHours) * 100 : 0;

        return {
            ...p,
            clientName: client?.name,
            clientColor: client?.color,
            hoursPlanned: planned,
            hoursReal: real,
            hoursComputed: computed,
            budget: p.budgetHours,
            percentage: percentage
        };
    }).filter(p => selectedEmployeeId === 'all' || p.hoursPlanned > 0)
      .sort((a, b) => b.hoursPlanned - a.hoursPlanned);
  }, [projects, clients, monthAllocations, selectedEmployeeId]);

  // ============================================================================
  // DASHBOARD EJECUTIVO: Alertas, Proyectos en Riesgo, Logros
  // ============================================================================

  // Alertas de carga del equipo
  const teamAlerts = useMemo(() => {
    const alerts: Array<{
      type: 'overload' | 'underload' | 'consecutive_overload';
      severity: 'high' | 'medium' | 'low';
      employeeId: string;
      employeeName: string;
      message: string;
      value: number;
      detail: string;
    }> = [];

    // Analizar cada empleado activo
    employees.filter(e => e.isActive).forEach(emp => {
      const capacity = getMonthlyCapacity(year, month, emp.workSchedule);
      const empAllocations = monthAllocations.filter(a => a.employeeId === emp.id);
      const plannedHours = empAllocations.reduce((sum, a) => sum + a.hoursAssigned, 0);
      const percentage = capacity > 0 ? (plannedHours / capacity) * 100 : 0;
      const hoursAvailable = Math.max(0, capacity - plannedHours);

      // Alerta de sobrecarga (>100%)
      if (percentage > 100) {
        alerts.push({
          type: 'overload',
          severity: percentage > 120 ? 'high' : 'medium',
          employeeId: emp.id,
          employeeName: emp.name,
          message: `${emp.name} está al ${percentage.toFixed(0)}% de capacidad`,
          value: percentage,
          detail: `${plannedHours}h planificadas de ${capacity}h disponibles (+${(plannedHours - capacity).toFixed(1)}h exceso)`
        });
      }

      // Alerta de disponibilidad significativa (>15h libres)
      if (hoursAvailable > 15 && percentage < 70) {
        alerts.push({
          type: 'underload',
          severity: 'low',
          employeeId: emp.id,
          employeeName: emp.name,
          message: `${emp.name} tiene ${hoursAvailable.toFixed(0)}h disponibles`,
          value: hoursAvailable,
          detail: `Solo al ${percentage.toFixed(0)}% de ocupación este mes`
        });
      }
    });

    // Ordenar por severidad
    return alerts.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }, [employees, monthAllocations, year, month]);

  // Proyectos en riesgo (superando presupuesto o con problemas)
  // Determinar en qué semana del mes estamos (1-4)
  const currentWeekOfMonth = Math.ceil(getDate(new Date()) / 7);
  const isEndOfMonth = currentWeekOfMonth >= 3;

  const projectsAtRisk = useMemo(() => {
    const risks: Array<typeof projectData[0] & { riskLevel: string; riskReason: string }> = [];

    projectData.forEach(p => {
      const hoursOverBudget = p.hoursPlanned - p.budget;
      const completionRate = p.budget > 0 ? (p.hoursComputed / p.budget) * 100 : 0;
      const projectNameLower = p.name.toLowerCase();
      const isOffPageOrLinkbuilding = projectNameLower.includes('off-page') ||
                                       projectNameLower.includes('offpage') ||
                                       projectNameLower.includes('linkbuilding') ||
                                       projectNameLower.includes('link building');

      // Alerta 1: Superó presupuesto por más de 2h (100% es OK)
      if (hoursOverBudget > 2) {
        risks.push({
          ...p,
          riskLevel: hoursOverBudget > 5 ? 'critical' : 'high',
          riskReason: `Supera presupuesto en ${hoursOverBudget.toFixed(1)}h (${p.percentage.toFixed(0)}%)`
        });
      }
      // Alerta 2: Final de mes (semana 3-4) y menos del 35% computado
      else if (isEndOfMonth && completionRate < 35 && p.budget > 0 && !isOffPageOrLinkbuilding) {
        risks.push({
          ...p,
          riskLevel: completionRate < 20 ? 'critical' : 'high',
          riskReason: `Solo ${completionRate.toFixed(0)}% computado (semana ${currentWeekOfMonth})`
        });
      }
      // Alerta 3: Baja rentabilidad (trabajamos más de lo que computamos)
      else if (p.hoursReal > p.hoursComputed && p.hoursReal > 5 && (p.hoursReal - p.hoursComputed) > 2) {
        risks.push({
          ...p,
          riskLevel: 'medium',
          riskReason: `Baja rentabilidad (${((p.hoursComputed / p.hoursReal) * 100).toFixed(0)}%)`
        });
      }
    });

    return risks.sort((a, b) => {
      const riskOrder: Record<string, number> = { critical: 0, high: 1, medium: 2 };
      return (riskOrder[a.riskLevel] || 2) - (riskOrder[b.riskLevel] || 2);
    });
  }, [projectData, isEndOfMonth, currentWeekOfMonth]);

  // Logros y reconocimientos del equipo
  const teamAchievements = useMemo(() => {
    const achievements: Array<{
      type: 'accuracy' | 'efficiency' | 'completion' | 'improvement' | 'project' | 'team';
      icon: 'trophy' | 'star' | 'award';
      title: string;
      description: string;
      employeeId?: string;
      employeeName?: string;
    }> = [];

    // 1. Empleado más preciso en estimaciones
    const accurateEmployees = employeeData
      .filter(e => e.reliability.tasksAnalyzed >= 5 && e.reliability.index >= 90 && e.reliability.index <= 110);

    if (accurateEmployees.length > 0) {
      const mostAccurate = accurateEmployees.sort((a, b) =>
        Math.abs(100 - a.reliability.index) - Math.abs(100 - b.reliability.index)
      )[0];
      achievements.push({
        type: 'accuracy',
        icon: 'trophy',
        title: 'Estimador preciso',
        description: `${mostAccurate.name} tiene el índice de fiabilidad más preciso (${mostAccurate.reliability.index.toFixed(0)}%)`,
        employeeId: mostAccurate.id,
        employeeName: mostAccurate.name
      });
    }

    // 2. Empleado más eficiente (mejor ratio computado/real)
    const efficientEmployees = employeeData
      .filter(e => e.realHours >= 10 && e.efficiency > 100);

    if (efficientEmployees.length > 0) {
      const mostEfficient = efficientEmployees.sort((a, b) => b.efficiency - a.efficiency)[0];
      achievements.push({
        type: 'efficiency',
        icon: 'star',
        title: 'Alta eficiencia',
        description: `${mostEfficient.name} logró ${mostEfficient.efficiency.toFixed(0)}% de rentabilidad`,
        employeeId: mostEfficient.id,
        employeeName: mostEfficient.name
      });
    }

    // 3. Proyectos completados al 100% (entre 98% y 102%)
    const projectsOnTarget = projectData.filter(p =>
      p.budget > 0 && p.percentage >= 98 && p.percentage <= 102 && p.hoursComputed >= p.budget * 0.9
    );
    if (projectsOnTarget.length > 0) {
      achievements.push({
        type: 'project',
        icon: 'trophy',
        title: `${projectsOnTarget.length} Proyecto${projectsOnTarget.length > 1 ? 's' : ''} al 100%`,
        description: projectsOnTarget.length <= 2
          ? projectsOnTarget.map(p => p.name).join(', ')
          : `${projectsOnTarget[0].name} y ${projectsOnTarget.length - 1} más`
      });
    }

    // 4. Empleado con más tareas completadas
    const employeeCompletions = employeeData.map(e => ({
      ...e,
      completedTasks: monthAllocations.filter(a => a.employeeId === e.id && a.status === 'completed').length
    })).filter(e => e.completedTasks >= 5);

    if (employeeCompletions.length > 0) {
      const topCompleter = employeeCompletions.sort((a, b) => b.completedTasks - a.completedTasks)[0];
      achievements.push({
        type: 'completion',
        icon: 'star',
        title: 'Máquina de entregas',
        description: `${topCompleter.name} completó ${topCompleter.completedTasks} tareas este mes`,
        employeeId: topCompleter.id,
        employeeName: topCompleter.name
      });
    }

    // 5. Rentabilidad del equipo (si promedio > 95%)
    const teamAvgEfficiency = employeeData.length > 0
      ? employeeData.reduce((sum, e) => sum + e.efficiency, 0) / employeeData.length
      : 0;
    if (teamAvgEfficiency >= 95 && employeeData.some(e => e.realHours >= 5)) {
      achievements.push({
        type: 'team',
        icon: 'award',
        title: 'Equipo rentable',
        description: `Rentabilidad promedio del equipo: ${teamAvgEfficiency.toFixed(0)}%`
      });
    }

    // 6. Sin proyectos en riesgo
    if (projectsAtRisk.length === 0 && projectData.length >= 3) {
      achievements.push({
        type: 'team',
        icon: 'award',
        title: 'Todo bajo control',
        description: 'Ningún proyecto con alertas de riesgo este mes'
      });
    }

    // 7. Equipo bien balanceado (nadie >110% ni <50%)
    const allBalanced = employeeData.every(e => e.percentage <= 110 && e.percentage >= 50);
    if (allBalanced && employeeData.length >= 3) {
      achievements.push({
        type: 'improvement',
        icon: 'award',
        title: 'Equipo Equilibrado',
        description: 'Toda la carga está bien distribuida entre el equipo'
      });
    }

    return achievements;
  }, [employeeData, monthAllocations]);

  // Alertas de dependencias bloqueadas
  const blockedDependencies = useMemo(() => {
    const blocked: Array<{
      blockedTask: typeof allocations[0];
      blockedTaskName: string;
      blockedEmployee: string;
      blockerTask: typeof allocations[0];
      blockerTaskName: string;
      blockerEmployee: string;
      weeksSinceBlocked: number;
      projectName: string;
    }> = [];

    // Buscar tareas del mes actual que tienen dependencias no completadas
    monthAllocations.forEach(task => {
      if (task.dependencyId && task.status !== 'completed') {
        const blockerTask = (allocations || []).find(a => a.id === task.dependencyId);
        if (blockerTask && blockerTask.status !== 'completed') {
          const blockedEmployee = employees.find(e => e.id === task.employeeId);
          const blockerEmployee = employees.find(e => e.id === blockerTask.employeeId);
          const project = (projects || []).find(p => p.id === task.projectId);

          // Calcular semanas desde que se planificó la tarea bloqueante
          const blockerWeekDate = parseISO(blockerTask.weekStartDate);
          const now = new Date();
          const weeksSince = Math.max(0, differenceInWeeks(now, blockerWeekDate));

          blocked.push({
            blockedTask: task,
            blockedTaskName: task.taskName || 'Tarea sin nombre',
            blockedEmployee: blockedEmployee?.name || 'Desconocido',
            blockerTask: blockerTask,
            blockerTaskName: blockerTask.taskName || 'Tarea sin nombre',
            blockerEmployee: blockerEmployee?.name || 'Desconocido',
            weeksSinceBlocked: weeksSince,
            projectName: project?.name || 'Proyecto desconocido'
          });
        }
      }
    });

    // Ordenar por semanas bloqueadas (más antiguas primero)
    return blocked.sort((a, b) => b.weeksSinceBlocked - a.weeksSinceBlocked);
  }, [monthAllocations, allocations, employees, projects]);

  // Mapa de calor: carga semanal por empleado
  const heatmapData = useMemo(() => {
    // Obtener las semanas del mes actual basándonos en las allocations existentes
    const weekDatesInMonth = new Set<string>();
    (allocations || []).forEach(a => {
      try {
        const weekDate = parseISO(a.weekStartDate);
        if (isSameMonth(weekDate, currentMonth) ||
            (weekDate >= monthStart && weekDate <= monthEnd)) {
          weekDatesInMonth.add(a.weekStartDate);
        }
      } catch { /* ignorar fechas inválidas */ }
    });

    // Ordenar las semanas cronológicamente
    const sortedWeeks = Array.from(weekDatesInMonth).sort();

    return employees.filter(e => e.isActive).map(emp => {
      const weeklyLoad = sortedWeeks.map((weekStr, index) => {
        const weekAllocations = (allocations || []).filter(a =>
          a.employeeId === emp.id && a.weekStartDate === weekStr
        );
        const hoursPlanned = round2(weekAllocations.reduce((sum, a) => sum + a.hoursAssigned, 0));
        // Capacidad semanal aproximada (asumiendo jornada estándar de 5 días)
        const weeklyCapacity = emp.workSchedule?.defaultHoursPerDay
          ? emp.workSchedule.defaultHoursPerDay * 5
          : 40;
        const percentage = weeklyCapacity > 0 ? (hoursPlanned / weeklyCapacity) * 100 : 0;

        return {
          week: weekStr,
          weekLabel: `Sem ${index + 1}`,
          hours: hoursPlanned,
          capacity: weeklyCapacity,
          percentage
        };
      });

      return {
        employeeId: emp.id,
        employeeName: emp.name,
        weeklyLoad
      };
    });
  }, [employees, allocations, currentMonth, monthStart, monthEnd]);

  // Estado para deadlines y global assignments del mes siguiente
  const [nextMonthDeadlines, setNextMonthDeadlines] = useState<Deadline[]>([]);
  const [nextMonthGlobalAssignments, setNextMonthGlobalAssignments] = useState<GlobalAssignment[]>([]);

  // Cargar deadlines y global assignments del mes siguiente
  useEffect(() => {
    const nextMonth = addMonths(startOfMonth(new Date()), 1);
    const nextMonthStr = format(nextMonth, 'yyyy-MM');

    // Cargar deadlines
    supabase
      .from('deadlines')
      .select('*')
      .eq('month', nextMonthStr)
      .then(({ data, error }) => {
        if (!error && data) {
          setNextMonthDeadlines(data.map((d: any) => ({
            id: d.id,
            projectId: d.project_id,
            month: d.month,
            notes: d.notes,
            employeeHours: d.employee_hours || {},
            isHidden: d.is_hidden || false
          })));
        }
      });

    // Cargar global assignments
    supabase
      .from('global_assignments')
      .select('*')
      .eq('month', nextMonthStr)
      .then(({ data, error }) => {
        if (!error && data) {
          setNextMonthGlobalAssignments(data.map((g: any) => ({
            id: g.id,
            month: g.month,
            name: g.name,
            hours: Number(g.hours),
            affectsAll: g.affects_all,
            affectedEmployeeIds: (g.affected_employee_ids || []) as string[],
            employeeId: g.employee_id || g.created_by
          })));
        }
      });
  }, []);

  // Predicción de disponibilidad futura con Modelo de Mezcla Ponderada
  const futureAvailability = useMemo(() => {
    const thisMonth = startOfMonth(new Date());
    const nextMonth = addMonths(thisMonth, 1);
    const nextMonthStart = startOfMonth(nextMonth);
    const nextMonthEnd = endOfMonth(nextMonth);

    return employees.filter(e => e.isActive).map(emp => {
      // 1. CÁLCULO DE CAPACIDAD NETA REAJUSTADA
      // Capacidad base del mes siguiente
      const baseCapacity = getMonthlyCapacity(
        nextMonth.getFullYear(),
        nextMonth.getMonth(),
        emp.workSchedule
      );

      // Restar ausencias
      const employeeAbsences = (absences || []).filter(a => a.employeeId === emp.id);
      const absenceHours = getAbsenceHoursInRange(
        nextMonthStart,
        nextMonthEnd,
        employeeAbsences,
        emp.workSchedule
      );

      // Restar eventos del equipo
      const eventHours = getTeamEventHoursInRange(
        nextMonthStart,
        nextMonthEnd,
        emp.id,
        teamEvents || [],
        emp.workSchedule,
        employeeAbsences
      );

      // Capacidad disponible sin ajuste
      const availableCapacity = Math.max(0, baseCapacity - absenceHours - eventHours);

      // Factor de ajuste basado en reliabilityIndex
      const reliability = reliabilityByEmployee[emp.id];
      const adjustmentFactor = reliability && reliability.tasksAnalyzed >= 5
        ? reliability.index / 100  // Si index = 120, factor = 1.2 (tarda 20% más)
        : 1;

      // Capacidad neta reajustada (reducida preventivamente si suele tardar más)
      const adjustedCapacity = round2(availableCapacity / adjustmentFactor);

      // Capacidad del mes actual (para comparación)
      const currentMonthCapacity = getMonthlyCapacity(year, month, emp.workSchedule);
      const hoursThisMonth = monthAllocations
        .filter(a => a.employeeId === emp.id)
        .reduce((sum, a) => sum + a.hoursAssigned, 0);

      // 2. LÓGICA DE ESTIMACIÓN "MIX DE CARGA"
      // A. Inercia Recurrente (40%): Horas del mes inmediatamente anterior
      const previousMonth = subMonths(thisMonth, 1);
      const previousMonthStart = startOfMonth(previousMonth);
      const previousMonthEnd = endOfMonth(previousMonth);
      
      const previousMonthAllocations = (allocations || []).filter(a => {
        try {
          const weekDate = parseISO(a.weekStartDate);
          return a.employeeId === emp.id &&
                 weekDate >= previousMonthStart &&
                 weekDate <= previousMonthEnd;
        } catch { return false; }
      });
      
      const previousMonthHours = previousMonthAllocations.reduce((sum, a) => sum + a.hoursAssigned, 0);
      
      // Obtener deadlines y global assignments del mes anterior
      const previousMonthStr = format(previousMonth, 'yyyy-MM');
      // Nota: En producción, esto debería cargarse de forma similar a nextMonthDeadlines
      // Por ahora, usamos solo allocations
      const previousMonthTotalHours = previousMonthHours;

      // B. Media Histórica (40%): Promedio de los últimos 3-4 meses
      const historicalMonths: Array<{ month: Date; hours: number; capacity: number }> = [];
      for (let i = 1; i <= 4; i++) {
        const pastMonth = subMonths(thisMonth, i);
        const pastMonthStart = startOfMonth(pastMonth);
        const pastMonthEnd = endOfMonth(pastMonth);

        const hoursInMonth = (allocations || [])
          .filter(a => {
            try {
              const weekDate = parseISO(a.weekStartDate);
              return a.employeeId === emp.id &&
                     weekDate >= pastMonthStart &&
                     weekDate <= pastMonthEnd;
            } catch { return false; }
          })
          .reduce((sum, a) => sum + a.hoursAssigned, 0);

        if (hoursInMonth > 0) {
          historicalMonths.push({
            month: pastMonth,
            hours: hoursInMonth,
            capacity: getMonthlyCapacity(pastMonth.getFullYear(), pastMonth.getMonth(), emp.workSchedule)
          });
        }
      }

      const historicalAvgHours = historicalMonths.length > 0
        ? historicalMonths.reduce((sum, m) => sum + m.hours, 0) / historicalMonths.length
        : 0;

      // C. Compromisos Reales (20%): Horas de deadlines/tareas ya creadas para el mes siguiente
      const nextMonthDeadlineHours = nextMonthDeadlines
        .filter(d => !d.isHidden)
        .reduce((sum, d) => sum + (d.employeeHours[emp.id] || 0), 0);

      const nextMonthGlobalHours = nextMonthGlobalAssignments
        .filter(g => g.affectsAll || (g.affectedEmployeeIds || []).includes(emp.id))
        .reduce((sum, g) => sum + g.hours, 0);

      const committedHours = nextMonthDeadlineHours + nextMonthGlobalHours;

      // Si hay muchos compromisos, aumentar su peso
      const committedWeight = committedHours > adjustedCapacity * 0.3 ? 0.4 : 0.2;
      const inertiaWeight = committedHours > adjustedCapacity * 0.3 ? 0.3 : 0.4;
      const historicalWeight = committedHours > adjustedCapacity * 0.3 ? 0.3 : 0.4;

      // Mezcla ponderada
      let estimatedHoursNextMonth = round2(
        (previousMonthTotalHours * inertiaWeight) +
        (historicalAvgHours * historicalWeight) +
        (committedHours * committedWeight)
      );

      // 3. INTEGRACIÓN DE RENTABILIDAD (GANANCIA)
      // Calcular ratio entre Horas Reales y Horas Computadas del mes actual
      const currentMonthCompleted = monthAllocations.filter(
        a => a.employeeId === emp.id && a.status === 'completed'
      );
      const currentMonthReal = currentMonthCompleted.reduce(
        (sum, a) => sum + (a.hoursActual || 0), 0
      );
      const currentMonthComputed = currentMonthCompleted.reduce(
        (sum, a) => sum + (a.hoursComputed || 0), 0
      );

      // Si rentabilidad es baja (Real > Computado), incrementar estimación
      if (currentMonthReal > 0 && currentMonthComputed > 0) {
        const profitabilityRatio = currentMonthComputed / currentMonthReal;
        // Si ratio < 1, significa que es menos eficiente, ajustar estimación
        if (profitabilityRatio < 0.9) {
          const inefficiencyFactor = 1 / profitabilityRatio;
          estimatedHoursNextMonth = round2(estimatedHoursNextMonth * inefficiencyFactor);
        }
      }

      // 4. SISTEMA DE ALERTA DE CALIDAD DE DATOS
      const monthsWithData = historicalMonths.length;
      let dataMaturity: 'insufficient' | 'learning' | 'stable' = 'insufficient';
      let maturityLabel = 'Sin base histórica';
      let maturityColor = 'bg-red-50 text-red-700 border-red-200';

      if (monthsWithData >= 3) {
        dataMaturity = 'stable';
        maturityLabel = 'Predicción fiable';
        maturityColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      } else if (monthsWithData >= 1) {
        dataMaturity = 'learning';
        maturityLabel = 'Predicción basada en corto plazo';
        maturityColor = 'bg-amber-50 text-amber-700 border-amber-200';
      }

      // Disponibilidad estimada final
      const estimatedAvailable = round2(Math.max(0, adjustedCapacity - estimatedHoursNextMonth));

      return {
        employeeId: emp.id,
        employeeName: emp.name,
        employeeRole: emp.role,
        // Mes actual
        currentMonth: {
          capacity: currentMonthCapacity,
          assigned: round2(hoursThisMonth),
          available: round2(Math.max(0, currentMonthCapacity - hoursThisMonth)),
          percentage: currentMonthCapacity > 0 ? round2((hoursThisMonth / currentMonthCapacity) * 100) : 0
        },
        // Mes siguiente
        nextMonth: {
          capacity: adjustedCapacity,
          baseCapacity,
          absenceHours,
          eventHours,
          assigned: round2(committedHours),
          estimated: round2(estimatedHoursNextMonth),
          estimatedAvailable,
          hasDeadlines: committedHours > 0,
          percentage: adjustedCapacity > 0 ? round2((estimatedHoursNextMonth / adjustedCapacity) * 100) : 0
        },
        // Histórico y calidad de datos
        historical: {
          monthsAnalyzed: monthsWithData,
          avgLoadPercentage: historicalMonths.length > 0
            ? round2(historicalMonths.reduce((sum, m) => sum + (m.hours / m.capacity * 100), 0) / historicalMonths.length)
            : 0,
          dataMaturity,
          maturityLabel,
          maturityColor
        },
        adjustmentFactor,
        reliabilityIndex: reliability?.index || 0,
        // Desglose de la mezcla
        mixBreakdown: {
          inertia: round2(previousMonthTotalHours * inertiaWeight),
          historical: round2(historicalAvgHours * historicalWeight),
          committed: round2(committedHours * committedWeight)
        }
      };
    }).sort((a, b) => b.nextMonth.estimatedAvailable - a.nextMonth.estimatedAvailable);
  }, [employees, allocations, monthAllocations, reliabilityByEmployee, year, month, absences, teamEvents, nextMonthDeadlines, nextMonthGlobalAssignments]);

  const stats = [
    {
      title: 'Capacidad',
      value: `${totalCapacity}h`,
      subtitle: selectedEmployeeId === 'all' ? 'Total equipo' : 'Disponible',
      icon: Users,
      color: 'text-slate-600',
      bgColor: 'bg-slate-100',
    },
    {
      title: 'Planificado',
      value: `${monthStats.planned}h`,
      subtitle: `${utilizationRate.toFixed(0)}% ocupación`,
      icon: Clock,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    },
    {
      title: 'Real (Incurrido)',
      value: `${monthStats.real}h`,
      subtitle: `Trabajo de reloj`,
      icon: Zap,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Computado',
      value: `${monthStats.computed}h`,
      subtitle: 'Facturable',
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
  ];

  return (
    <div className="flex flex-col h-full space-y-6 p-6 md:p-8 max-w-7xl mx-auto w-full">
      
      {/* HEADER */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                    <BarChart3 className="h-8 w-8 text-indigo-600" />
                    Reportes y métricas
                </h1>
                <p className="text-muted-foreground">
                    Análisis de rendimiento {selectedEmployeeId !== 'all' ? 'individual' : 'del equipo'}.
                </p>
            </div>
            
            {/* Controles */}
            <div className="flex items-center gap-3 flex-wrap">
                {/* Filtro Empleado */}
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-slate-400" />
                    <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                        <SelectTrigger className="w-[180px] bg-white">
                            <SelectValue placeholder="Filtrar empleado" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todo el equipo</SelectItem>
                            {(employees || []).filter(e => e.isActive).map(e => (
                                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Navegación Mes */}
                <div className="flex items-center gap-1 bg-white border rounded-lg px-2 py-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrevMonth}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-1.5 px-2 min-w-[140px] justify-center">
                        <CalendarDays className="h-4 w-4 text-indigo-600" />
                        <span className="font-medium text-sm capitalize">
                            {format(currentMonth, 'MMMM yyyy', { locale: es })}
                        </span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNextMonth}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleToday} className="text-xs">Hoy</Button>
                </div>
            </div>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <div className={`h-8 w-8 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* TABS CONTENT */}
      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard" className="flex items-center gap-1.5">
            <Gauge className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="overview">Visión General</TabsTrigger>
          <TabsTrigger value="team">Desglose Equipo</TabsTrigger>
          <TabsTrigger value="projects">Proyectos</TabsTrigger>
        </TabsList>

        {/* DASHBOARD EJECUTIVO */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Columna 1: Alertas del Equipo */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  Alertas del Equipo
                </CardTitle>
                <CardDescription>Situaciones que requieren atención</CardDescription>
              </CardHeader>
              <CardContent>
                {teamAlerts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-emerald-300" />
                    <p className="text-sm">Todo en orden</p>
                    <p className="text-xs">No hay alertas este mes</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[320px] overflow-y-auto">
                    {teamAlerts.map((alert, idx) => (
                      <div
                        key={`${alert.employeeId}-${alert.type}-${idx}`}
                        className={cn(
                          "p-3 rounded-lg border-l-4 transition-colors",
                          alert.severity === 'high' && "bg-red-50 border-l-red-500",
                          alert.severity === 'medium' && "bg-amber-50 border-l-amber-500",
                          alert.severity === 'low' && "bg-blue-50 border-l-blue-500"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {alert.type === 'overload' ? (
                            <Flame className={cn("h-4 w-4 mt-0.5 shrink-0", alert.severity === 'high' ? "text-red-500" : "text-amber-500")} />
                          ) : (
                            <Snowflake className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{alert.message}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{alert.detail}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Columna 2: Proyectos en Riesgo */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Proyectos en riesgo
                </CardTitle>
                <CardDescription>Proyectos que superan o se acercan al presupuesto</CardDescription>
              </CardHeader>
              <CardContent>
                {projectsAtRisk.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FolderOpen className="h-12 w-12 mx-auto mb-2 text-emerald-300" />
                    <p className="text-sm">Sin riesgos</p>
                    <p className="text-xs">Todos los proyectos dentro de presupuesto</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[320px] overflow-y-auto">
                    {projectsAtRisk.slice(0, 6).map(project => (
                      <div
                        key={project.id}
                        className={cn(
                          "p-3 rounded-lg border",
                          project.riskLevel === 'critical' && "bg-red-50 border-red-200",
                          project.riskLevel === 'high' && "bg-amber-50 border-amber-200",
                          project.riskLevel === 'medium' && "bg-slate-50 border-slate-200"
                        )}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" title={project.name}>{project.name}</p>
                            <p className="text-xs text-muted-foreground">{project.clientName}</p>
                          </div>
                          <Badge
                            variant={project.riskLevel === 'critical' ? 'destructive' : 'secondary'}
                            className="shrink-0"
                          >
                            {project.percentage.toFixed(0)}%
                          </Badge>
                        </div>
                        <p className="text-xs mt-2 text-muted-foreground">{project.riskReason}</p>
                        <div className="flex gap-4 mt-2 text-xs">
                          <span>Plan: {project.hoursPlanned}h</span>
                          <span className="text-muted-foreground">Ppto: {project.budget}h</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Columna 3: Logros y Reconocimientos */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Trophy className="h-5 w-5 text-amber-500" />
                  Logros del Equipo
                </CardTitle>
                <CardDescription>Reconocimientos y métricas positivas</CardDescription>
              </CardHeader>
              <CardContent>
                {teamAchievements.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Star className="h-12 w-12 mx-auto mb-2 text-slate-200" />
                    <p className="text-sm">Próximamente</p>
                    <p className="text-xs">Aún no hay suficientes datos para mostrar logros</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {teamAchievements.map((achievement, idx) => (
                      <div
                        key={`${achievement.type}-${idx}`}
                        className="p-3 rounded-lg bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-100"
                      >
                        <div className="flex items-start gap-3">
                          <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                            {achievement.icon === 'trophy' && <Trophy className="h-4 w-4 text-amber-600" />}
                            {achievement.icon === 'star' && <Star className="h-4 w-4 text-amber-600" />}
                            {achievement.icon === 'award' && <Award className="h-4 w-4 text-amber-600" />}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-amber-900">{achievement.title}</p>
                            <p className="text-xs text-amber-700 mt-0.5">{achievement.description}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Dependencias Bloqueadas */}
          {blockedDependencies.length > 0 && (
            <Card className="border-l-4 border-l-orange-400">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Link2 className="h-5 w-5 text-orange-500" />
                  Tareas bloqueadas por dependencias
                  <Badge variant="secondary" className="ml-2">{blockedDependencies.length}</Badge>
                </CardTitle>
                <CardDescription>
                  Tareas que no pueden avanzar hasta que se complete su dependencia
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {blockedDependencies.slice(0, 5).map((dep, idx) => (
                    <div
                      key={`${dep.blockedTask.id}-${idx}`}
                      className={cn(
                        "p-3 rounded-lg border",
                        dep.weeksSinceBlocked >= 2 && "bg-red-50 border-red-200",
                        dep.weeksSinceBlocked === 1 && "bg-amber-50 border-amber-200",
                        dep.weeksSinceBlocked === 0 && "bg-slate-50 border-slate-200"
                      )}
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-orange-700 truncate">{dep.blockerTaskName}</span>
                            <span className="text-xs text-muted-foreground">({dep.blockerEmployee})</span>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate">{dep.blockedTaskName}</span>
                            <span className="text-xs text-muted-foreground">({dep.blockedEmployee})</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-muted-foreground">{dep.projectName}</span>
                        {dep.weeksSinceBlocked > 0 && (
                          <Badge
                            variant={dep.weeksSinceBlocked >= 2 ? 'destructive' : 'secondary'}
                            className="text-xs"
                          >
                            {dep.weeksSinceBlocked} {dep.weeksSinceBlocked === 1 ? 'semana' : 'semanas'} esperando
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  {blockedDependencies.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center pt-2">
                      +{blockedDependencies.length - 5} tareas bloqueadas más
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Mapa de Calor de Carga */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Mapa de carga semanal
              </CardTitle>
              <CardDescription>
                Visualización de la ocupación por empleado y semana.
                <span className="ml-2 inline-flex items-center gap-1">
                  <span className="h-3 w-3 rounded bg-emerald-500" /> Óptimo
                  <span className="h-3 w-3 rounded bg-amber-500 ml-2" /> Alto
                  <span className="h-3 w-3 rounded bg-red-500 ml-2" /> Sobrecargado
                  <span className="h-3 w-3 rounded bg-blue-200 ml-2" /> Bajo
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {heatmapData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No hay datos para mostrar</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground w-40">Empleado</th>
                        {heatmapData[0]?.weeklyLoad.map(week => (
                          <th key={week.week} className="text-center py-2 px-2 font-medium text-muted-foreground min-w-[70px]">
                            {week.weekLabel}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {heatmapData.map(row => (
                        <tr key={row.employeeId} className="border-b hover:bg-slate-50">
                          <td className="py-2 px-3 font-medium">{row.employeeName}</td>
                          {row.weeklyLoad.map(week => (
                            <td key={week.week} className="py-2 px-2 text-center">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <div
                                      className={cn(
                                        "h-8 w-full rounded flex items-center justify-center text-xs font-medium transition-colors cursor-help",
                                        week.percentage === 0 && "bg-slate-100 text-slate-400",
                                        week.percentage > 0 && week.percentage < 50 && "bg-blue-100 text-blue-700",
                                        week.percentage >= 50 && week.percentage < 80 && "bg-emerald-100 text-emerald-700",
                                        week.percentage >= 80 && week.percentage <= 100 && "bg-emerald-500 text-white",
                                        week.percentage > 100 && week.percentage <= 120 && "bg-amber-500 text-white",
                                        week.percentage > 120 && "bg-red-500 text-white"
                                      )}
                                    >
                                      {week.hours > 0 ? `${week.hours}h` : '-'}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="font-medium">{row.employeeName}</p>
                                    <p className="text-xs">{week.hours}h de {week.capacity}h ({week.percentage.toFixed(0)}%)</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Predicción de Disponibilidad Futura */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Predicción de carga - Mes siguiente
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                Estimación de disponibilidad basada en histórico de deadlines anteriores.
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertCircle className="h-4 w-4 text-slate-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="font-medium mb-1">Modelo de Mezcla Ponderada</p>
                      <p className="text-xs">
                        Esta estimación considera tus últimos 3 meses, tu rentabilidad actual y tus vacaciones programadas.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {futureAvailability.map(emp => (
                  <div key={emp.employeeId} className="border rounded-lg p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-medium flex items-center gap-2">
                          {emp.employeeName}
                          {/* Badge de madurez de datos */}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge
                                  variant="outline"
                                  className={cn("text-[10px] px-1.5", emp.historical.maturityColor)}
                                >
                                  {emp.historical.maturityLabel}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-medium">Madurez de la predicción</p>
                                <p className="text-xs">{emp.historical.monthsAnalyzed} meses de histórico analizados</p>
                                {emp.historical.dataMaturity === 'insufficient' && (
                                  <p className="text-xs text-red-600 mt-1">
                                    Se necesitan al menos 1 mes de datos para una predicción básica
                                  </p>
                                )}
                                {emp.historical.dataMaturity === 'learning' && (
                                  <p className="text-xs text-amber-600 mt-1">
                                    Se recomiendan más meses para mayor precisión
                                  </p>
                                )}
                                {emp.historical.dataMaturity === 'stable' && (
                                  <p className="text-xs text-emerald-600 mt-1">
                                    Predicción basada en datos consistentes
                                  </p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </h4>
                        <p className="text-xs text-muted-foreground">{emp.employeeRole}</p>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          "text-lg font-bold",
                          emp.nextMonth.estimatedAvailable >= 20 ? "text-emerald-600" :
                          emp.nextMonth.estimatedAvailable >= 8 ? "text-amber-600" : "text-red-600"
                        )}>
                          {emp.nextMonth.estimatedAvailable}h
                        </p>
                        <p className="text-xs text-muted-foreground">disponibles (estimado)</p>
                      </div>
                    </div>

                    {/* Comparativa mes actual vs siguiente */}
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      {/* Mes actual */}
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">Mes actual</p>
                        <div className="flex justify-between items-baseline">
                          <span className="text-sm font-medium">{emp.currentMonth.assigned}h</span>
                          <span className="text-xs text-muted-foreground">de {emp.currentMonth.capacity}h</span>
                        </div>
                        <Progress
                          value={Math.min(emp.currentMonth.percentage, 100)}
                          className={cn("h-1.5 mt-1",
                            emp.currentMonth.percentage > 100 ? "[&>div]:bg-red-500" :
                            emp.currentMonth.percentage > 85 ? "[&>div]:bg-amber-500" : ""
                          )}
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {emp.currentMonth.available}h libres ({(100 - emp.currentMonth.percentage).toFixed(0)}%)
                        </p>
                      </div>

                      {/* Mes siguiente */}
                      <div className={cn(
                        "rounded-lg p-3",
                        emp.nextMonth.hasDeadlines ? "bg-indigo-50" : "bg-amber-50 border border-dashed border-amber-200"
                      )}>
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          Mes siguiente
                          {!emp.nextMonth.hasDeadlines && (
                            <span className="text-amber-600">(estimado)</span>
                          )}
                        </p>
                        <div className="flex justify-between items-baseline">
                          <span className="text-sm font-medium">
                            {emp.nextMonth.hasDeadlines ? emp.nextMonth.assigned : `~${emp.nextMonth.estimated}`}h
                          </span>
                          <span className="text-xs text-muted-foreground">de {emp.nextMonth.capacity}h</span>
                        </div>
                        <Progress
                          value={Math.min(emp.nextMonth.percentage, 100)}
                          className={cn("h-1.5 mt-1",
                            emp.nextMonth.percentage > 100 ? "[&>div]:bg-red-500" :
                            emp.nextMonth.percentage > 85 ? "[&>div]:bg-amber-500" :
                            !emp.nextMonth.hasDeadlines ? "[&>div]:bg-amber-400" : ""
                          )}
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                          ~{emp.nextMonth.estimatedAvailable}h libres ({(100 - emp.nextMonth.percentage).toFixed(0)}%)
                        </p>
                      </div>
                    </div>

                    {/* Info adicional */}
                    <div className="text-xs text-muted-foreground border-t pt-2 flex justify-between">
                      <span>
                        Promedio histórico: {emp.historical.avgLoadPercentage.toFixed(0)}% de ocupación
                      </span>
                      {!emp.nextMonth.hasDeadlines && emp.historical.monthsAnalyzed > 0 && (
                        <span className="text-amber-600">
                          Sin deadline aún - estimación basada en {emp.historical.monthsAnalyzed} meses
                        </span>
                      )}
                      {emp.nextMonth.hasDeadlines && (
                        <span className="text-emerald-600">
                          Deadline ya asignado
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Eficiencia & Rentabilidad</CardTitle>
                <CardDescription>Análisis de ocupación y conversión de horas reales a facturables.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="font-medium text-slate-700">Ocupación (Planificado vs Capacidad)</span>
                        <span className="font-bold">{utilizationRate.toFixed(1)}%</span>
                    </div>
                    <Progress value={utilizationRate} className="h-3 bg-slate-100" />
                </div>
                
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="font-medium text-emerald-700">Rentabilidad (Computado vs Real)</span>
                        <div className="flex gap-2 text-xs items-center">
                            <span className="text-blue-600">Real: {monthStats.real}h</span>
                            <span className="text-slate-300">|</span>
                            <span className="text-emerald-700 font-bold">{profitabilityRate.toFixed(1)}% Ratio</span>
                        </div>
                    </div>
                    {/* Barra doble: Fondo azul (Real), Frente verde (Computado) */}
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden relative">
                        <div className="absolute top-0 left-0 h-full bg-blue-200 w-full" />
                        <div 
                            className="absolute top-0 left-0 h-full bg-emerald-500 transition-all" 
                            style={{ width: `${Math.min(profitabilityRate, 100)}%` }} 
                        />
                    </div>
                    <p className="text-[10px] text-muted-foreground text-right pt-1">
                        Si la barra verde no llena la azul, estamos trabajando más de lo que facturamos.
                    </p>
                </div>
              </CardContent>
            </Card>

            <Card className="col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FolderOpen className="h-5 w-5" /> Proyectos activos</CardTitle>
                <CardDescription>Actividad por proyecto este mes.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2">
                    {projectData.slice(0, 5).map(p => (
                        <div key={p.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="h-8 w-8 rounded flex items-center justify-center border bg-slate-50 shrink-0">
                                    <FolderOpen className="h-4 w-4 text-slate-500" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium leading-none truncate w-32 md:w-40" title={p.name}>{p.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{p.clientName}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="font-bold text-sm">{p.hoursPlanned}h</div>
                                <div className="text-[10px] text-muted-foreground">de {p.budget}h</div>
                            </div>
                        </div>
                    ))}
                    {projectData.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sin actividad registrada.</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Desglose por empleado</CardTitle>
                    <CardDescription>Análisis de ocupación (Plan), Rentabilidad (Real vs Comp) y Fiabilidad de estimación (Histórico).</CardDescription>
                </CardHeader>
                <CardContent>
                    <TooltipProvider>
                    <div className="space-y-6">
                        {employeeData.map(emp => (
                            // ✅ KEY ÚNICA: Fuerza re-render al cambiar de mes para arreglar el bug visual del color rojo
                            <div key={emp.id + currentMonth.toISOString()} className="grid grid-cols-12 gap-4 items-start group hover:bg-slate-50 p-3 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                                <div className="col-span-4 md:col-span-3 flex items-center gap-3 mt-1">
                                    <div className="h-9 w-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs border border-indigo-200">
                                        {emp.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-medium text-sm truncate flex items-center gap-2">
                                            {emp.name}
                                            {/* NUEVO: Badge de Fiabilidad Histórica */}
                                            <Tooltip>
                                                <TooltipTrigger>
                                                    <Badge 
                                                        variant="outline" 
                                                        className={cn(
                                                            "text-[10px] px-1.5 py-0 h-5 font-mono cursor-help flex items-center gap-1",
                                                            getReliabilityColor(emp.reliability.index, emp.reliability.tasksAnalyzed)
                                                        )}
                                                    >
                                                        {getReliabilityIcon(emp.reliability.trend)}
                                                        {emp.reliability.tasksAnalyzed >= 5 
                                                            ? `${emp.reliability.index.toFixed(0)}%` 
                                                            : '?'}
                                                    </Badge>
                                                </TooltipTrigger>
                                                <TooltipContent side="right" className="max-w-[280px]">
                                                    <div className="space-y-2">
                                                        <p className="font-semibold text-sm">
                                                            Índice de fiabilidad: {getReliabilityLabel(emp.reliability)}
                                                        </p>
                                                        {emp.reliability.tasksAnalyzed >= 5 ? (
                                                            <>
                                                                <div className="text-xs space-y-1">
                                                                    <p>📊 <strong>{emp.reliability.tasksAnalyzed}</strong> tareas analizadas</p>
                                                                    <p>⏱️ Estimado total: <strong>{emp.reliability.totalEstimated}h</strong></p>
                                                                    <p>⚡ Real total: <strong>{emp.reliability.totalReal}h</strong></p>
                                                                    <p>📈 Ratio: <strong>{emp.reliability.index.toFixed(1)}%</strong></p>
                                                                </div>
                                                                <div className="pt-2 border-t text-xs">
                                                                    {emp.reliability.trend === 'underestimates' && (
                                                                        <p className="text-amber-600">
                                                                            ⚠️ Subestima ~{Math.abs(emp.reliability.deviation).toFixed(1)}h por tarea
                                                                        </p>
                                                                    )}
                                                                    {emp.reliability.trend === 'overestimates' && (
                                                                        <p className="text-blue-600">
                                                                            📈 Sobreestima ~{Math.abs(emp.reliability.deviation).toFixed(1)}h por tarea
                                                                        </p>
                                                                    )}
                                                                    {emp.reliability.trend === 'accurate' && (
                                                                        <p className="text-emerald-600">
                                                                            ✅ Estimaciones precisas
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <p className="text-xs text-muted-foreground">
                                                                Se necesitan al menos 5 tareas completadas con horas reales para calcular el índice.
                                                            </p>
                                                        )}
                                                    </div>
                                                </TooltipContent>
                                            </Tooltip>
                                        </div>
                                        <div className="text-xs text-muted-foreground">{emp.role}</div>
                                    </div>
                                </div>

                                <div className="col-span-8 md:col-span-9 space-y-4">
                                    {/* SECCIÓN 1: PLANIFICACIÓN (Barra Única) */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-500">Ocupación Planificada ({emp.plannedHours}/{emp.capacity}h)</span>
                                            <span className={cn("font-medium", emp.percentage > 100 ? "text-red-600 font-bold" : "text-slate-700")}>
                                                {emp.percentage.toFixed(0)}%
                                            </span>
                                        </div>
                                        <div className="relative h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div 
                                                className={cn("absolute top-0 left-0 h-full", 
                                                    emp.percentage > 100 ? "bg-red-500" : 
                                                    emp.percentage > 85 ? "bg-amber-500" : "bg-blue-500"
                                                )}
                                                style={{ width: `${Math.min(emp.percentage, 100)}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* SECCIÓN 2: RENTABILIDAD (Barra Verde sobre Azul) */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <div className="flex gap-2">
                                                <span>Rentabilidad</span>
                                                <span className="text-blue-600 flex items-center gap-0.5"><Zap className="h-3 w-3" /> {emp.realHours}h</span>
                                                <span className="text-emerald-600 flex items-center gap-0.5"><CheckCircle2 className="h-3 w-3" /> {emp.computedHours}h</span>
                                            </div>
                                            <span>{emp.efficiency.toFixed(0)}%</span>
                                        </div>
                                        <div className="relative h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                            {/* Fondo Azul (Real) */}
                                            <div className="absolute top-0 left-0 h-full bg-blue-200 w-full" />
                                            {/* Frente Verde (Computado) */}
                                            <div 
                                                className="absolute top-0 left-0 h-full bg-emerald-500 transition-all" 
                                                style={{ width: `${Math.min(emp.efficiency, 100)}%` }} 
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    </TooltipProvider>
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="projects" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {projectData.map(p => {
                    const gain = p.hoursComputed - p.hoursReal;
                    return (
                        <Card key={p.id + currentMonth.toISOString()} className={cn("border-l-4", p.percentage > 100 ? "border-l-red-500" : p.percentage > 80 ? "border-l-amber-500" : "border-l-emerald-500")}>
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <div className="min-w-0 pr-2">
                                        <CardTitle className="text-sm font-semibold truncate" title={p.name}>{p.name}</CardTitle>
                                        <p className="text-xs text-muted-foreground truncate">{p.clientName}</p>
                                    </div>
                                    <Badge variant={p.percentage > 100 ? "destructive" : p.percentage > 80 ? "secondary" : "outline"} className="shrink-0">
                                        {p.percentage.toFixed(0)}%
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <Progress value={Math.min(p.percentage, 100)} className={cn("h-2", p.percentage > 100 ? "[&>div]:bg-red-500" : p.percentage > 80 ? "[&>div]:bg-amber-500" : "")} />
                                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                    <div>
                                        <p className="font-bold text-slate-700">{p.hoursPlanned}h</p>
                                        <p className="text-muted-foreground">Planificado</p>
                                    </div>
                                    <div>
                                        <p className="font-bold text-blue-600">{p.hoursReal}h</p>
                                        <p className="text-muted-foreground">Real</p>
                                    </div>
                                    <div>
                                        <p className={cn("font-bold", gain >= 0 ? "text-emerald-600" : "text-red-600")}>
                                            {gain >= 0 ? '+' : ''}{gain.toFixed(1)}h
                                        </p>
                                        <p className="text-muted-foreground">Balance</p>
                                    </div>
                                </div>
                                <div className="text-[10px] text-muted-foreground text-right">
                                    Presupuesto: {p.budget}h
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
                {projectData.length === 0 && (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                        <FolderOpen className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <p>Sin proyectos con actividad este mes.</p>
                    </div>
                )}
            </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
