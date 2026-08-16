import { useMemo } from 'react';
import type { Employee } from '@/types';
import type { EmployeeMetrics } from '@/hooks/useProjectMetrics';
import {
  filterEmployeeProfitabilityRowsForDisplay,
  getRowCost,
  getStandardHourlyCost,
  overheadShareForRow,
} from '@/utils/profitabilityCost';

type HoursMode = 'actual' | 'computed';
type CostMode = 'standard' | 'dynamic';

export type EmployeeProfitability = {
  employeeId: string;
  employeeName: string;
  totalActual: number;
  totalComputed: number;
  /** Horas (según modo) solo de proyectos con actividad en la vista actual */
  totalHoursDisplay: number;
  /** Horas (según modo) totales del mes del empleado */
  totalHoursGlobal: number;
  /** Horas del mes no imputadas a ningún proyecto visible/interno (tareas fuera de vista) */
  hoursNotAttributed: number;
  /** Nómina mensual del empleado (€/mes) — tal como está configurada en su ficha */
  payrollMonthly: number;
  /** Overhead del mes total del empleado (gastos comunes que le tocan) */
  overheadTotalEmployee: number;
  /** Coste de las horas no imputadas en el modo actual (sólo significativo en modo dinámico) */
  costNotAttributed: number;
  payrollNotAttributed: number;
  overheadNotAttributed: number;
  /**
   * Modo operativo: nómina no explicada por horas del mes × tarifa estándar (capacidad teórica > horas trabajadas).
   * Cierra: nómina filas + no imputada + esto = nómina mensual (± céntimos).
   */
  payrollStandardIdle: number;
  /** Nómina total cargada al coste del empleado (filas + no imputada + hueco operativo). */
  payrollAllocatedTotal: number;
  cost: number;
  payrollCost: number;
  overheadCost: number;
  attributedRevenue: number;
  margin: number;
  marginPercent: number;
  byProject: {
    projectId: string;
    projectName: string;
    hours: number;
    hoursDisplay: number;
    payrollCost: number;
    overheadCost: number;
    cost: number;
    attributedRevenue: number;
    margin: number;
    /** Fee mensual / horas totales del proyecto (mismo modo horas). Solo facturables; 0 si interno. */
    projectEhr: number;
  }[];
};

interface UseEmployeeProfitabilityParams {
  employeeMetricsForView: EmployeeMetrics[];
  employees: Employee[];
  hoursMode: HoursMode;
  effectiveCostMode: CostMode;
  projectByIdForAttr: Map<string, { actual: number; monthlyFee: number }>;
  projectTotalHoursFromBreakdown: Map<string, number>;
  employeeHoursGlobalById: Map<string, number> | ReadonlyMap<string, number>;
  overheadByEmployee: Map<string, number> | ReadonlyMap<string, number>;
  projectMetricsBillableWithActivity: { projectId: string }[];
  searchQuery: string;
}

export function useEmployeeProfitability({
  employeeMetricsForView,
  employees,
  hoursMode,
  effectiveCostMode,
  projectByIdForAttr,
  projectTotalHoursFromBreakdown,
  employeeHoursGlobalById,
  overheadByEmployee,
  projectMetricsBillableWithActivity,
  searchQuery,
}: UseEmployeeProfitabilityParams) {
  const projectIdsWithActivity = useMemo(
    () => new Set(projectMetricsBillableWithActivity.map(p => p.projectId)),
    [projectMetricsBillableWithActivity]
  );

  const employeeProfitabilityList = useMemo((): EmployeeProfitability[] => {
    const rows = employeeMetricsForView.map(em => {
      const emp = employees.find(e => e.id === em.employeeId);
      const totalHEmployeeInMode = hoursMode === 'computed' ? em.totalComputed : em.totalActual;
      const totalHGlobal = employeeHoursGlobalById.get(em.employeeId) ?? totalHEmployeeInMode;
      let attributedRevenue = 0;
      let costFromVisibleProjects = 0;
      let payrollFromVisibleProjects = 0;
      let overheadFromVisibleProjects = 0;
      const byProject: EmployeeProfitability['byProject'] = [];
      em.projectBreakdown.forEach(pb => {
        const isBillableWithActivity = projectIdsWithActivity.has(pb.projectId);
        const hours = pb.hours;
        const actualHours = pb.actual ?? 0;
        const projectActual = projectByIdForAttr.get(pb.projectId)?.actual ?? 0;
        const totalHours = projectTotalHoursFromBreakdown.get(pb.projectId) ?? 0;
        const hoursDisplay = hoursMode === 'computed' ? hours : actualHours;
        const monthlyFee = projectByIdForAttr.get(pb.projectId)?.monthlyFee ?? 0;
        const isInternal = (monthlyFee ?? 0) === 0;
        const hasHours = hoursDisplay > 0;
        /** Coste de nómina + overhead para cualquier imputación con horas (evita huecos vs total mensual del empleado). */
        const includeCostRow = hasHours && (isInternal || (monthlyFee ?? 0) > 0);
        if (!includeCostRow) return;

        const payrollRow = getRowCost(emp, hoursDisplay, totalHEmployeeInMode, effectiveCostMode);
        const overheadRow = overheadShareForRow(
          em.employeeId,
          hoursDisplay,
          totalHGlobal,
          overheadByEmployee
        );
        const rowCost = payrollRow + overheadRow;
        const totalHoursInMode = hoursMode === 'computed' ? totalHours : projectActual;
        const attr =
          totalHoursInMode > 0 ? (hoursDisplay / totalHoursInMode) * (monthlyFee ?? 0) : 0;
        const projectEhr =
          (monthlyFee ?? 0) > 0 && totalHoursInMode > 0 ? (monthlyFee ?? 0) / totalHoursInMode : 0;
        const countRevenue = isBillableWithActivity;
        if (countRevenue) {
          attributedRevenue += attr;
        }
        costFromVisibleProjects += rowCost;
        payrollFromVisibleProjects += payrollRow;
        overheadFromVisibleProjects += overheadRow;
        const attributed = countRevenue ? attr : 0;
        byProject.push({
          projectId: pb.projectId,
          projectName: pb.projectName,
          hours,
          hoursDisplay,
          payrollCost: payrollRow,
          overheadCost: overheadRow,
          cost: rowCost,
          attributedRevenue: attributed,
          margin: attributed - rowCost,
          projectEhr,
        });
      });
      const totalHoursDisplay = byProject.reduce((s, b) => s + b.hoursDisplay, 0);
      const payrollMonthly = emp?.monthlyCost ?? emp?.hourlyRate ?? 0;
      const overheadTotalEmployee = overheadByEmployee.get(em.employeeId) ?? 0;
      /** Evita fila/total «No imputado» por ruido numérico: total mensual vs suma por proyecto suele diferir en centésimas de hora. */
      const UNATTRIBUTED_HOURS_EPS = 0.02;
      const hoursNotAttributedRaw = Math.max(0, totalHEmployeeInMode - totalHoursDisplay);
      const hoursNotAttributed =
        hoursNotAttributedRaw < UNATTRIBUTED_HOURS_EPS ? 0 : hoursNotAttributedRaw;
      // Coste de horas no imputadas:
      // - Modo dinámico: nómina × (hNA / hTotal) — así la suma cuadra con la nómina exacta.
      // - Modo estándar: hNA × coste/h estándar (informativo, puede no cuadrar con nómina por capacidad teórica).
      const payrollNotAttributed =
        effectiveCostMode === 'dynamic'
          ? totalHEmployeeInMode > 0
            ? payrollMonthly * (hoursNotAttributed / totalHEmployeeInMode)
            : 0
          : hoursNotAttributed * getStandardHourlyCost(emp);
      const overheadNotAttributed = overheadShareForRow(
        em.employeeId,
        hoursNotAttributed,
        totalHGlobal,
        overheadByEmployee
      );
      const costNotAttributed = payrollNotAttributed + overheadNotAttributed;
      const payrollStandardIdle =
        effectiveCostMode === 'standard' && emp && payrollMonthly > 0
          ? Math.max(
              0,
              Math.round((payrollMonthly - getStandardHourlyCost(emp) * totalHEmployeeInMode) * 100) /
                100
            )
          : 0;
      const payrollAllocatedTotal =
        payrollFromVisibleProjects + payrollNotAttributed + payrollStandardIdle;
      const costTotal = costFromVisibleProjects + costNotAttributed + payrollStandardIdle;
      const margin = attributedRevenue - costTotal;
      const marginPercent = attributedRevenue > 0 ? (margin / attributedRevenue) * 100 : 0;
      return {
        employeeId: em.employeeId,
        employeeName: em.employeeName,
        totalActual: em.totalActual,
        totalComputed: em.totalComputed,
        totalHoursDisplay,
        totalHoursGlobal: totalHEmployeeInMode,
        hoursNotAttributed,
        payrollMonthly,
        overheadTotalEmployee,
        costNotAttributed,
        payrollNotAttributed,
        overheadNotAttributed,
        payrollStandardIdle,
        payrollAllocatedTotal,
        cost: costTotal,
        payrollCost: payrollFromVisibleProjects,
        overheadCost: overheadFromVisibleProjects,
        attributedRevenue,
        margin,
        marginPercent,
        byProject,
      };
    });
    return filterEmployeeProfitabilityRowsForDisplay(rows, employees ?? [], hoursMode);
  }, [
    employeeMetricsForView,
    employees,
    projectTotalHoursFromBreakdown,
    projectByIdForAttr,
    hoursMode,
    effectiveCostMode,
    projectIdsWithActivity,
    employeeHoursGlobalById,
    overheadByEmployee,
  ]);

  const employeeProfitabilityFilteredBySearch = useMemo(() => {
    if (!searchQuery.trim()) return employeeProfitabilityList;
    const q = searchQuery.trim().toLowerCase();
    return employeeProfitabilityList.filter(ep => {
      if (ep.employeeName.toLowerCase().includes(q)) return true;
      return ep.byProject.some(bp => bp.projectName.toLowerCase().includes(q));
    });
  }, [employeeProfitabilityList, searchQuery]);

  /** Con búsqueda activa: totales por empleado solo de proyectos que coinciden con el filtro (para fila y pie). */
  const employeeDisplayTotalsWhenSearch = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.trim().toLowerCase();
    const map = new Map<
      string,
      { hours: number; attr: number; cost: number; margin: number; payroll: number; overhead: number }
    >();
    employeeProfitabilityFilteredBySearch.forEach(ep => {
      const filtered = ep.byProject.filter(bp => bp.projectName.toLowerCase().includes(q));
      const hours = filtered.reduce((s, b) => s + b.hoursDisplay, 0);
      const attr = filtered.reduce((s, b) => s + b.attributedRevenue, 0);
      const cost = filtered.reduce((s, b) => s + b.cost, 0);
      const margin = filtered.reduce((s, b) => s + b.margin, 0);
      const payroll = filtered.reduce((s, b) => s + b.payrollCost, 0);
      const overhead = filtered.reduce((s, b) => s + b.overheadCost, 0);
      map.set(ep.employeeId, { hours, attr, cost, margin, payroll, overhead });
    });
    return map;
  }, [employeeProfitabilityFilteredBySearch, searchQuery]);

  return {
    projectIdsWithActivity,
    employeeProfitabilityList,
    employeeProfitabilityFilteredBySearch,
    employeeDisplayTotalsWhenSearch,
  };
}
