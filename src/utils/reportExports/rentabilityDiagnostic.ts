import type { Employee } from '@/types';
import type { ProjectMetrics } from '@/utils/projectMetricsCompute';
import type { AllocateCommonExpensesResult } from '@/utils/commonExpensesAllocation';
import { getStandardHourlyCost, getStandardMonthlyCapacity } from '@/utils/profitabilityCost';

export interface RentabilityEmployeeProfitabilityRow {
  employeeId: string;
  employeeName: string;
  totalActual: number;
  totalComputed: number;
  totalHoursDisplay: number;
  totalHoursGlobal: number;
  hoursNotAttributed: number;
  payrollMonthly: number;
  overheadTotalEmployee: number;
  payrollAllocatedTotal: number;
  payrollStandardIdle: number;
  costNotAttributed: number;
  payrollNotAttributed: number;
  overheadNotAttributed: number;
  attributedRevenue: number;
  cost: number;
  payrollCost: number;
  overheadCost: number;
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
    projectEhr: number;
  }[];
}

/** Entradas para el JSON de diagnóstico de rentabilidad (misma forma que arma FinancialHealthPage). */
export interface BuildRentabilityDiagnosticParams {
  commonExpensesAlloc: AllocateCommonExpensesResult;
  commonExpensesMonthKey: string;
  costMode: 'standard' | 'dynamic';
  effectiveCostMode: 'standard' | 'dynamic';
  isViewingCurrentMonth: boolean;
  dynamicCostFallbackActive: boolean;
  pctMonthElapsed: number;
  departmentNameForView: string | null;
  searchQueryActive: boolean;
  agencyId: string | null;
  agencyName: string | null;
  hoursMode: 'actual' | 'computed';
  totalRevenue: number;
  totalHoursForView: number;
  effectiveHourlyRate: number;
  netMargin: number;
  marginPercent: number | null;
  totalInternalCost: number;
  totalOverheadInView: number;
  ehrTarget: number;
  projectMetricsForView: ProjectMetrics[];
  projectCostAndMarginMap: Map<
    string,
    { cost: number; payrollCost: number; overheadCost: number; margin: number }
  >;
  employeeProfitabilityList: RentabilityEmployeeProfitabilityRow[];
  employees: Employee[] | null | undefined;
}

export type RentabilityDiagnosticPayload = ReturnType<typeof buildRentabilityDiagnosticPayload>;

export function buildRentabilityDiagnosticPayload(params: BuildRentabilityDiagnosticParams) {
  const {
    commonExpensesAlloc,
    commonExpensesMonthKey,
    costMode,
    effectiveCostMode,
    isViewingCurrentMonth,
    dynamicCostFallbackActive,
    pctMonthElapsed,
    departmentNameForView,
    searchQueryActive,
    agencyId,
    agencyName,
    hoursMode,
    totalRevenue,
    totalHoursForView,
    effectiveHourlyRate,
    netMargin,
    marginPercent,
    totalInternalCost,
    totalOverheadInView,
    ehrTarget,
    projectMetricsForView,
    projectCostAndMarginMap,
    employeeProfitabilityList,
    employees,
  } = params;

  const commonExpensesSerialized = commonExpensesAlloc.ok === false
    ? {
        ok: false as const,
        code: commonExpensesAlloc.code,
        entryId: commonExpensesAlloc.entryId,
        splitSum: commonExpensesAlloc.splitSum,
      }
    : {
        ok: true as const,
        totalOverheadApplied: commonExpensesAlloc.totalOverheadApplied,
        totalConfiguredAmount: commonExpensesAlloc.totalConfiguredAmount,
        unallocatedAmount: commonExpensesAlloc.unallocatedAmount,
        unallocatedEntries: commonExpensesAlloc.unallocatedEntries,
        employeeIdsZeroHoursWithPeersWorking: commonExpensesAlloc.employeeIdsZeroHoursWithPeersWorking,
        overheadByEmployee: Object.fromEntries(commonExpensesAlloc.overheadByEmployee),
      };

  return {
    schemaVersion: 1 as const,
    exportedAt: new Date().toISOString(),
    meta: {
      monthKey: commonExpensesMonthKey,
      hoursMode,
      costModeUi: costMode,
      effectiveCostMode,
      isViewingCurrentMonth,
      dynamicCostFallbackActive,
      pctMonthElapsed: Math.round(pctMonthElapsed * 100) / 100,
      departmentFilter: departmentNameForView,
      searchQueryActive,
      agencyId,
      agencyName,
      containsPersonalData: true as const,
      noteEs:
        'La nómina (monthlyCost, columna BD hourly_rate) y la capacidad teórica (defaultWeeklyCapacity) son las de la ficha actual de cada empleado; en meses pasados pueden no coincidir con la realidad histórica.',
    },
    formulasBrief: {
      standardMonthlyCapacity: 'defaultWeeklyCapacity * 4.33 si > 0; si no 110 h',
      standardHourlyCost: 'monthlyCost / standardMonthlyCapacity',
      payrollStandardIdle:
        'max(0, redondear(monthlyCost - standardHourlyCost * totalHoursGlobal, 2)) si effectiveCostMode === standard',
      attributedRevenueRow:
        '(hoursDisplay / totalProjectHoursInMode) * monthlyFee en proyectos facturables',
    },
    totals: {
      totalRevenue,
      totalHoursForView,
      effectiveHourlyRate,
      netMargin,
      marginPercent: marginPercent != null ? Math.round(marginPercent * 100) / 100 : null,
      totalInternalCost,
      totalOverheadInView,
      ehrTarget,
    },
    commonExpenses: commonExpensesSerialized,
    projects: projectMetricsForView.map((p) => {
      const pcm = projectCostAndMarginMap.get(p.projectId);
      const h = hoursMode === 'computed' ? p.computed : p.actual;
      return {
        projectId: p.projectId,
        projectName: p.projectName,
        clientId: p.clientId,
        monthlyFee: p.monthlyFee ?? 0,
        hoursComputed: p.computed,
        hoursActual: p.actual,
        hoursInSelectedMode: h,
        costTotal: pcm?.cost ?? null,
        payrollCost: pcm?.payrollCost ?? null,
        overheadCost: pcm?.overheadCost ?? null,
        marginVsFee: pcm?.margin ?? null,
      };
    }),
    employees: employeeProfitabilityList.map((ep) => {
      const emp = employees?.find((e) => e.id === ep.employeeId);
      return {
        employeeId: ep.employeeId,
        displayName: ep.employeeName,
        master: emp
          ? {
              hourlyRateMonthly: emp.monthlyCost ?? emp.hourlyRate ?? 0,
              defaultWeeklyCapacity: emp.defaultWeeklyCapacity,
              standardMonthlyCapacity: getStandardMonthlyCapacity(emp),
              standardHourlyCost: getStandardHourlyCost(emp),
            }
          : null,
        hours: {
          totalActual: ep.totalActual,
          totalComputed: ep.totalComputed,
          totalHoursDisplay: ep.totalHoursDisplay,
          totalHoursGlobal: ep.totalHoursGlobal,
          hoursNotAttributed: ep.hoursNotAttributed,
        },
        money: {
          payrollMonthly: ep.payrollMonthly,
          overheadTotalEmployee: ep.overheadTotalEmployee,
          payrollAllocatedTotal: ep.payrollAllocatedTotal,
          payrollStandardIdle: ep.payrollStandardIdle,
          costNotAttributed: ep.costNotAttributed,
          payrollNotAttributed: ep.payrollNotAttributed,
          overheadNotAttributed: ep.overheadNotAttributed,
          attributedRevenue: ep.attributedRevenue,
          costTotal: ep.cost,
          margin: ep.margin,
          marginPercent: Math.round(ep.marginPercent * 100) / 100,
        },
        byProject: ep.byProject.map((bp) => ({
          projectId: bp.projectId,
          projectName: bp.projectName,
          hoursDisplay: bp.hoursDisplay,
          payrollCost: bp.payrollCost,
          overheadCost: bp.overheadCost,
          cost: bp.cost,
          attributedRevenue: bp.attributedRevenue,
          margin: bp.margin,
          marginPerHour:
            bp.hoursDisplay > 0.001 ? Math.round((bp.margin / bp.hoursDisplay) * 100) / 100 : null,
          projectEhr: bp.projectEhr,
        })),
      };
    }),
  };
}
