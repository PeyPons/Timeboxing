/**
 * Hook para calcular tips de redistribución y sugerencias por empleado/proyecto en Deadlines.
 * Usado solo por DeadlinesPage. Toda la lógica de desequilibrio de carga y condicionantes.
 */

import { useMemo, useCallback } from 'react';
import { Deadline } from '@/types';
import type { SuggestionsBlockReason } from '@/utils/deadlinesSuggestionsPrefs';
import { roundDeadlineHours } from '@/utils/deadlineUtils';
import {
  getEmployeeProjectIds,
  type FlowProjectScope,
} from '@/utils/suggestionRulesUtils';

export type RedistributionTip = {
  from: string;
  to: string;
  fromId: string;
  toId: string;
  reason: string;
  projects: string[];
  projectIds: string[];
};

export type ProjectRecommendation = {
  projectId: string;
  projectName: string;
  transfers: {
    fromId: string;
    fromName: string;
    fromAvatar?: string;
    hoursOnProject: number;
    suggestedHours: number;
    reason: string;
  }[];
};

export type EmployeeRecommendation = {
  employeeId: string;
  employeeName: string;
  employeeAvatar?: string;
  deficitHours: number;
  projects: ProjectRecommendation[];
};

type EmployeeLike = { id: string; name: string; first_name?: string; avatarUrl?: string };
type ProjectLike = { id: string; name: string };

export interface UseDeadlinesRedistributionParams {
  activeEmployees: EmployeeLike[];
  deadlines: Deadline[];
  projects: ProjectLike[];
  hiddenProjects: Set<string>;
  getMonthlyCapacity: (employeeId: string) => { available: number };
  getEmployeeAssignedHours: (employeeId: string) => number;
  formatProjectName: (name: string) => string;
  excludedDonorIds: string[];
  maxReceiverLoadPct: number;
  minSenderLoadPct: number;
  /** No mostrar transferencias sugeridas por debajo de este umbral (h). */
  minSuggestedTransferHours?: number;
  employees: EmployeeLike[] | null;
  /** Si true, solo se sugieren transferencias en proyectos que donante y receptor comparten. */
  onlySharedProjects?: boolean;
  /** Si tiene elementos, solo se consideran estos proyectos para las sugerencias. Vacío/null = todos (modo equipo). */
  includedProjectIds?: Set<string> | null;
  /** Flujos guiados Dar/Quitar: alcance explícito (no inferir por included vacío). */
  guidedProjectScope?: FlowProjectScope | null;
  guidedFocusEmployeeId?: string | null;
}

export function useDeadlinesRedistribution(params: UseDeadlinesRedistributionParams) {
  const {
    activeEmployees,
    deadlines,
    projects,
    hiddenProjects,
    getMonthlyCapacity,
    getEmployeeAssignedHours,
    formatProjectName,
    excludedDonorIds,
    maxReceiverLoadPct,
    minSenderLoadPct,
    minSuggestedTransferHours = 0.5,
    employees,
    onlySharedProjects = false,
    includedProjectIds = null,
    guidedProjectScope = null,
    guidedFocusEmployeeId = null,
  } = params;

  const guidedFocusProjectIds = useMemo(() => {
    if (guidedProjectScope !== 'focus_projects' || !guidedFocusEmployeeId) return null;
    return getEmployeeProjectIds(deadlines, guidedFocusEmployeeId, hiddenProjects);
  }, [guidedProjectScope, guidedFocusEmployeeId, deadlines, hiddenProjects]);

  /** Tips de redistribución. Cedentes = quienes tienen carga >= minSenderLoadPct y al menos un proyecto.
   * Receptores = quienes tienen carga < maxReceiverLoadPct. Así "Quién puede ceder" incluye a todos los que pueden (p. ej. Alexander al 70%). */
  const redistributionResult = useMemo(() => {
    const tips: (RedistributionTip & { impact: number })[] = [];
    const employeeLoads: { id: string; name: string; percentage: number; projects: string[] }[] = [];

    activeEmployees.forEach((emp) => {
      const capacityData = getMonthlyCapacity(emp.id);
      const assigned = getEmployeeAssignedHours(emp.id);
      const percentage = capacityData.available > 0 ? Math.round((assigned / capacityData.available) * 100) : 0;

      const empProjects: string[] = [];
      deadlines.forEach((d) => {
        if (!hiddenProjects.has(d.projectId) && !d.isHidden && (d.employeeHours[emp.id] || 0) > 0) {
          const project = projects.find((p) => p.id === d.projectId);
          if (project) empProjects.push(project.id);
        }
      });

      employeeLoads.push({ id: emp.id, name: emp.first_name || emp.name, percentage, projects: empProjects });
    });

    if (employeeLoads.length < 2) return { tips: [] as RedistributionTip[], donorIds: [] as string[] };

    const totalPercentage = employeeLoads.reduce((sum, e) => sum + e.percentage, 0);
    const averageLoad = Math.round(totalPercentage / employeeLoads.length);

    /** Receptores potenciales: margen real bajo el tope % (no solo % redondeado < tope). */
    const capPct = Math.min(100, Math.max(0, maxReceiverLoadPct));
    const below = employeeLoads.filter((e) => {
      const capData = getMonthlyCapacity(e.id);
      const assigned = getEmployeeAssignedHours(e.id);
      const maxAssignable = capData.available * (capPct / 100);
      return maxAssignable - assigned > 0.01;
    });
    const minSenderPct = Math.min(100, Math.max(0, minSenderLoadPct));
    const donors = employeeLoads.filter(
      (e) => e.percentage >= minSenderPct && e.projects.length > 0
    );

    if (donors.length === 0 || below.length === 0) return { tips: [] as RedistributionTip[], donorIds: donors.map((d) => d.id) };

    const filterByIncluded = (projectIds: string[]) => {
      if (guidedProjectScope === 'manual') {
        if (!includedProjectIds || includedProjectIds.size === 0) return [];
        return projectIds.filter((pid) => includedProjectIds.has(pid));
      }
      if (guidedProjectScope === 'focus_projects' && guidedFocusProjectIds) {
        return projectIds.filter((pid) => guidedFocusProjectIds.has(pid));
      }
      if (includedProjectIds && includedProjectIds.size > 0) {
        return projectIds.filter((pid) => includedProjectIds.has(pid));
      }
      return projectIds;
    };

    donors.forEach((over) => {
      const candidateProjects = filterByIncluded(over.projects);
      if (candidateProjects.length === 0) return;
      below.forEach((avail) => {
        if (avail.id === over.id) return;
        const projectIds = onlySharedProjects
          ? filterByIncluded(candidateProjects.filter((p) => avail.projects.includes(p)))
          : candidateProjects;
        if (projectIds.length === 0) return;
        const impact = (over.percentage - averageLoad) + (averageLoad - avail.percentage);
        tips.push({
          from: over.name,
          to: avail.name,
          fromId: over.id,
          toId: avail.id,
          reason: `${over.name} está al ${over.percentage}% (media: ${averageLoad}%), ${avail.name} al ${avail.percentage}%`,
          projects: projectIds
            .map((pid) => {
              const p = projects.find((proj) => proj.id === pid);
              return p ? formatProjectName(p.name) : '';
            })
            .filter(Boolean),
          projectIds,
          impact: impact * 1.5,
        });
      });
    });

    const MAX_SUGGESTIONS = 500;
    const sortedTips = tips
      .sort((a, b) => b.impact - a.impact)
      .slice(0, MAX_SUGGESTIONS)
      .map(({ impact, ...tip }) => tip);
    return { tips: sortedTips, donorIds: donors.map((d) => d.id) };
  }, [
    activeEmployees,
    deadlines,
    hiddenProjects,
    projects,
    getMonthlyCapacity,
    getEmployeeAssignedHours,
    formatProjectName,
    maxReceiverLoadPct,
    minSenderLoadPct,
    onlySharedProjects,
    includedProjectIds,
    guidedProjectScope,
    guidedFocusProjectIds,
  ]);

  const redistributionTips = redistributionResult.tips;
  const donorIdsFromHook = redistributionResult.donorIds;

  const getHoursOnProject = useCallback(
    (projectId: string, employeeId: string) => {
      const d = deadlines.find((dl) => dl.projectId === projectId);
      return (d?.employeeHours?.[employeeId] ?? 0) as number;
    },
    [deadlines]
  );

  const suggestionDonors = useMemo(() => {
    return donorIdsFromHook
      .map((id) => {
        const emp = (employees ?? []).find((e) => e.id === id);
        return { id, name: emp?.first_name || emp?.name || id, avatarUrl: emp?.avatarUrl };
      })
      .filter((d) => d.name);
  }, [donorIdsFromHook, employees]);

  const suggestionsByEmployeeAndProject = useMemo((): EmployeeRecommendation[] => {
    const excludedSet = new Set(excludedDonorIds);
    const filteredTips = excludedSet.size > 0 ? redistributionTips.filter((tip) => !excludedSet.has(tip.fromId)) : redistributionTips;

    const active = activeEmployees ?? [];
    if (active.length === 0) return [];

    /** Margen hasta el % máximo de carga del receptor (coherente con condicionantes), no hasta la media del equipo. */
    const getShortfall = (toId: string) => {
      const cap = getMonthlyCapacity(toId);
      const assigned = getEmployeeAssignedHours(toId);
      const capPct = Math.min(100, Math.max(0, maxReceiverLoadPct));
      const maxAssignable = cap.available * (capPct / 100);
      return Math.max(0, maxAssignable - assigned);
    };

    const byEmployee = new Map<string, Map<string, ProjectRecommendation>>();
    const shortfallByToId = new Map<string, number>();

    filteredTips.forEach((tip) => {
      if (!tip.projectIds?.length) return;
      const toId = tip.toId;
      if (!shortfallByToId.has(toId)) shortfallByToId.set(toId, getShortfall(toId));
      const shortfall = shortfallByToId.get(toId)!;
      if (!byEmployee.has(toId)) byEmployee.set(toId, new Map());
      const byProject = byEmployee.get(toId)!;
      tip.projectIds.forEach((projectId, i) => {
        const projectName = tip.projects[i] ?? '';
        if (!byProject.has(projectId)) byProject.set(projectId, { projectId, projectName, transfers: [] });
        const proj = byProject.get(projectId)!;
        const hoursOnProject = getHoursOnProject(projectId, tip.fromId);
        const fromCap = getMonthlyCapacity(tip.fromId).available;
        const fromAssigned = getEmployeeAssignedHours(tip.fromId);
        const minSenderHours = fromCap * (minSenderLoadPct / 100);
        const maxHoursFromSender = Math.max(0, fromAssigned - minSenderHours);
        const suggestedHours = roundDeadlineHours(
          Math.min(hoursOnProject, shortfall, maxHoursFromSender)
        );
        if (!proj.transfers.some((t) => t.fromId === tip.fromId)) {
          proj.transfers.push({
            fromId: tip.fromId,
            fromName: tip.from,
            fromAvatar: (employees ?? []).find((e) => e.id === tip.fromId)?.avatarUrl,
            hoursOnProject: roundDeadlineHours(hoursOnProject),
            suggestedHours,
            reason: tip.reason,
          });
        }
      });
    });

    /** Quien tiene margen para recibir pero no entró en ningún tip (p. ej. filtros de proyecto). */
    active.forEach((emp) => {
      const sf = getShortfall(emp.id);
      if (sf <= 0.01) return;
      if (!byEmployee.has(emp.id)) {
        byEmployee.set(emp.id, new Map());
        shortfallByToId.set(emp.id, sf);
      }
    });

    const rawGroups = Array.from(byEmployee.entries())
      .map(([employeeId, byProject]) => {
        const emp = (employees ?? []).find((e) => e.id === employeeId);
        const rawProjects = Array.from(byProject.values())
          .map((p) => ({
            ...p,
            transfers: p.transfers.filter((t) => t.suggestedHours >= minSuggestedTransferHours - 1e-6),
          }))
          .filter((p) => p.transfers.length > 0);
        const shortfall = shortfallByToId.get(employeeId) ?? 0;
        const totalSuggested = rawProjects.reduce(
          (sum, p) => sum + p.transfers.reduce((s, t) => s + t.suggestedHours, 0),
          0
        );
        const factor = shortfall > 0 && totalSuggested > shortfall ? shortfall / totalSuggested : 1;
        const projectList = rawProjects
          .map((p) => ({
            ...p,
            transfers: p.transfers.map((t) => ({
              ...t,
              suggestedHours:
                factor === 1
                  ? t.suggestedHours
                  : roundDeadlineHours(t.suggestedHours * factor),
            })),
          }))
          .sort((a, b) => b.transfers.length - a.transfers.length);
        return {
          employeeId,
          employeeName: emp?.first_name || emp?.name || 'Desconocido',
          employeeAvatar: emp?.avatarUrl,
          deficitHours: shortfall,
          projects: projectList,
        };
      })
      .filter((g) => g.employeeName !== 'Desconocido' && (g.projects.length > 0 || g.deficitHours > 0));

    const totalGivenByDonor = new Map<string, number>();
    rawGroups.forEach((group) => {
      group.projects.forEach((p) => {
        p.transfers.forEach((t) => {
          totalGivenByDonor.set(t.fromId, (totalGivenByDonor.get(t.fromId) ?? 0) + t.suggestedHours);
        });
      });
    });

    const donorFactor = new Map<string, number>();
    totalGivenByDonor.forEach((total, fromId) => {
      const fromCap = getMonthlyCapacity(fromId).available;
      const fromAssigned = getEmployeeAssignedHours(fromId);
      const minSenderHours = fromCap * (minSenderLoadPct / 100);
      const maxGive = Math.max(0, fromAssigned - minSenderHours);
      if (total > maxGive && total > 0) donorFactor.set(fromId, maxGive / total);
      else donorFactor.set(fromId, 1);
    });

    rawGroups.forEach((group) => {
      group.projects.forEach((p) => {
        p.transfers.forEach((t) => {
          const f = donorFactor.get(t.fromId) ?? 1;
          t.suggestedHours = roundDeadlineHours(t.suggestedHours * f);
        });
      });
      group.projects = group.projects
        .map((p) => ({
          ...p,
          transfers: p.transfers.filter(
            (t) => t.suggestedHours >= minSuggestedTransferHours - 1e-6
          ),
        }))
        .filter((p) => p.transfers.length > 0);
    });

    return rawGroups
      .filter((g) => g.projects.length > 0 || g.deficitHours > 0)
      .sort((a, b) => b.projects.length - a.projects.length);
  }, [
    redistributionTips,
    employees,
    getHoursOnProject,
    activeEmployees,
    getMonthlyCapacity,
    getEmployeeAssignedHours,
    excludedDonorIds,
    maxReceiverLoadPct,
    minSenderLoadPct,
    minSuggestedTransferHours,
  ]);

  const suggestionsBlockReason = useMemo((): SuggestionsBlockReason | null => {
    if (activeEmployees.length < 2) return 'no_team';

    const capPct = Math.min(100, Math.max(0, maxReceiverLoadPct));
    let hasReceiverMargin = false;
    for (const emp of activeEmployees) {
      const cap = getMonthlyCapacity(emp.id);
      const assigned = getEmployeeAssignedHours(emp.id);
      const maxAssignable = cap.available * (capPct / 100);
      if (maxAssignable - assigned > 0.01) {
        hasReceiverMargin = true;
        break;
      }
    }
    if (!hasReceiverMargin) return 'no_receivers';

    if (donorIdsFromHook.length === 0) return 'no_donors';

    const excludedSet = new Set(excludedDonorIds);
    const allowedDonors = donorIdsFromHook.filter((id) => !excludedSet.has(id));
    if (allowedDonors.length === 0) return 'all_donors_excluded';

    const hasTransfers = suggestionsByEmployeeAndProject.some((g) =>
      g.projects.some((p) =>
        p.transfers.some((t) => t.suggestedHours >= minSuggestedTransferHours - 1e-6)
      )
    );
    if (!hasTransfers) {
      if (includedProjectIds && includedProjectIds.size > 0) return 'project_filter_empty';
      if (onlySharedProjects) return 'only_shared_no_overlap';
      return 'thresholds';
    }
    return null;
  }, [
    activeEmployees,
    maxReceiverLoadPct,
    getMonthlyCapacity,
    getEmployeeAssignedHours,
    donorIdsFromHook,
    excludedDonorIds,
    suggestionsByEmployeeAndProject,
    includedProjectIds,
    onlySharedProjects,
    minSuggestedTransferHours,
  ]);

  const suggestionsByEmployee = useMemo(() => {
    const byId = new Map<string, RedistributionTip[]>();
    redistributionTips.forEach((tip) => {
      const list = byId.get(tip.toId) || [];
      list.push(tip);
      byId.set(tip.toId, list);
    });
    return Array.from(byId.entries()).map(([employeeId, tips]) => {
      const emp = (employees ?? []).find((e) => e.id === employeeId);
      return {
        employeeId,
        employeeName: emp?.first_name || emp?.name || 'Desconocido',
        employeeAvatar: emp?.avatarUrl,
        tips,
      };
    }).filter((g) => g.employeeName !== 'Desconocido').sort((a, b) => b.tips.length - a.tips.length);
  }, [redistributionTips, employees]);

  return {
    redistributionTips,
    getHoursOnProject,
    suggestionDonors,
    suggestionsByEmployeeAndProject,
    suggestionsByEmployee,
    suggestionsBlockReason,
  };
}
