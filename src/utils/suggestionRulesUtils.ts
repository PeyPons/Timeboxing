/**
 * Utilidades para el paso «Reglas» del asistente de redistribución (proyectos en común, cedentes, alcance).
 */

import type { Deadline } from '@/types';
import {
  countProjectsWithTransfers,
  projectHasSuggestedTransfers,
  totalSuggestedHoursForGroup,
} from '@/utils/deadlinesSuggestionsPrefs';
import { roundDeadlineHours } from '@/utils/deadlineUtils';
import type {
  DonorTransferRow,
  EmployeeRecommendation,
  ProjectRecommendation,
} from '@/components/deadlines/suggestions/types';

export type FlowProjectScope = 'shared' | 'focus_projects' | 'manual';

const MIN_H = 0.05;

export function getEmployeeProjectIds(
  deadlines: Deadline[],
  employeeId: string,
  hiddenProjects: Set<string>
): Set<string> {
  const ids = new Set<string>();
  for (const d of deadlines) {
    if (hiddenProjects.has(d.projectId) || d.isHidden) continue;
    if ((d.employeeHours[employeeId] ?? 0) > 0) ids.add(d.projectId);
  }
  return ids;
}

export function getSharedProjectIds(
  deadlines: Deadline[],
  employeeAId: string,
  employeeBId: string,
  hiddenProjects: Set<string>
): string[] {
  const a = getEmployeeProjectIds(deadlines, employeeAId, hiddenProjects);
  const b = getEmployeeProjectIds(deadlines, employeeBId, hiddenProjects);
  return [...a].filter((id) => b.has(id));
}

export function getDonorIdsSharingProjectsWith(
  deadlines: Deadline[],
  focusEmployeeId: string,
  donorIds: string[],
  hiddenProjects: Set<string>
): Set<string> {
  const shared = new Set<string>();
  for (const donorId of donorIds) {
    if (donorId === focusEmployeeId) continue;
    if (getSharedProjectIds(deadlines, focusEmployeeId, donorId, hiddenProjects).length > 0) {
      shared.add(donorId);
    }
  }
  return shared;
}

export function getReceiverIdsSharingProjectsWithDonor(
  deadlines: Deadline[],
  donorId: string,
  receiverIds: string[],
  hiddenProjects: Set<string>
): Set<string> {
  const shared = new Set<string>();
  for (const receiverId of receiverIds) {
    if (receiverId === donorId) continue;
    if (getSharedProjectIds(deadlines, donorId, receiverId, hiddenProjects).length > 0) {
      shared.add(receiverId);
    }
  }
  return shared;
}

/** Cedentes excluidos por defecto: quienes no comparten proyecto con el receptor. */
export function defaultExcludedDonorsForReceiver(
  deadlines: Deadline[],
  receiverId: string,
  allDonorIds: string[],
  hiddenProjects: Set<string>
): string[] {
  const sharing = getDonorIdsSharingProjectsWith(deadlines, receiverId, allDonorIds, hiddenProjects);
  return allDonorIds.filter((id) => !sharing.has(id));
}

/** Receptores excluidos por defecto: quienes no comparten proyecto con el cedente. */
export function defaultExcludedReceiversForDonor(
  deadlines: Deadline[],
  donorId: string,
  allReceiverIds: string[],
  hiddenProjects: Set<string>
): string[] {
  const sharing = getReceiverIdsSharingProjectsWithDonor(deadlines, donorId, allReceiverIds, hiddenProjects);
  return allReceiverIds.filter((id) => !sharing.has(id));
}

/** @deprecated Usar estado explícito `flowProjectScope`; la inferencia confunde manual vacío con «todos». */
export function inferFlowProjectScope(
  onlySharedProjects: boolean,
  includedProjectIds: Set<string>
): FlowProjectScope {
  if (onlySharedProjects) return 'shared';
  if (includedProjectIds.size > 0) return 'manual';
  return 'focus_projects';
}

export function applyFlowProjectScope(
  scope: FlowProjectScope,
  _focusProjectIds: string[] = []
): { onlySharedProjects: boolean; includedProjectIds: string[] } {
  switch (scope) {
    case 'shared':
      return { onlySharedProjects: true, includedProjectIds: [] };
    case 'focus_projects':
      return { onlySharedProjects: false, includedProjectIds: [] };
    case 'manual':
      return { onlySharedProjects: false, includedProjectIds: [] };
    default:
      return { onlySharedProjects: true, includedProjectIds: [] };
  }
}

/** Proyectos en común entre focus y al menos un cedente/receptor permitido. */
export function getSharedProjectIdsForFocus(
  deadlines: Deadline[],
  focusEmployeeId: string,
  otherEmployeeIds: string[],
  hiddenProjects: Set<string>
): string[] {
  const focusSet = getEmployeeProjectIds(deadlines, focusEmployeeId, hiddenProjects);
  const shared = new Set<string>();
  for (const otherId of otherEmployeeIds) {
    if (otherId === focusEmployeeId) continue;
    for (const pid of getSharedProjectIds(deadlines, focusEmployeeId, otherId, hiddenProjects)) {
      if (focusSet.has(pid)) shared.add(pid);
    }
  }
  return [...shared];
}

export function summarizeGroupTransfers(group: EmployeeRecommendation | undefined): {
  projectCount: number;
  totalHours: number;
  donorCount: number;
} {
  if (!group) return { projectCount: 0, totalHours: 0, donorCount: 0 };
  const projects = group.projects.filter((p) => projectHasSuggestedTransfers(p));
  const donors = new Set<string>();
  for (const p of projects) {
    for (const t of p.transfers) {
      if ((Number(t.suggestedHours) || 0) > MIN_H) donors.add(t.fromId);
    }
  }
  return {
    projectCount: projects.length,
    totalHours: totalSuggestedHoursForGroup({ projects }),
    donorCount: donors.size,
  };
}

export function summarizeDonorRows(rows: DonorTransferRow[]): {
  projectCount: number;
  totalHours: number;
  receiverCount: number;
} {
  const projects = new Set<string>();
  const receivers = new Set<string>();
  let total = 0;
  for (const r of rows) {
    const h = Number(r.transfer.suggestedHours) || 0;
    if (h <= MIN_H) continue;
    projects.add(r.projectId);
    receivers.add(r.receiverId);
    total = roundDeadlineHours(total + h);
  }
  return { projectCount: projects.size, totalHours: total, receiverCount: receivers.size };
}

export function filterGroupByAllowedDonors(
  group: EmployeeRecommendation,
  allowedDonorIds: Set<string>
): EmployeeRecommendation {
  const projects: ProjectRecommendation[] = group.projects
    .map((p) => ({
      ...p,
      transfers: p.transfers.filter(
        (t) => allowedDonorIds.has(t.fromId) && (Number(t.suggestedHours) || 0) > MIN_H
      ),
    }))
    .filter((p) => p.transfers.length > 0);
  return { ...group, projects };
}

export function filterDonorRows(
  rows: DonorTransferRow[],
  excludedReceiverIds: Set<string>
): DonorTransferRow[] {
  return rows.filter(
    (r) =>
      !excludedReceiverIds.has(r.receiverId) && (Number(r.transfer.suggestedHours) || 0) > MIN_H
  );
}

export function countProjectsWithTransfersFromGroup(group: EmployeeRecommendation | undefined): number {
  if (!group) return 0;
  return countProjectsWithTransfers(group);
}

export function scopeLabel(scope: FlowProjectScope, t: (key: string, fallback: string) => string): string {
  switch (scope) {
    case 'shared':
      return t('deadlines.suggestions.scopeShared', 'Solo proyectos en común');
    case 'focus_projects':
      return t('deadlines.suggestions.scopeFocusProjects', 'Todos los proyectos de la persona');
    case 'manual':
      return t('deadlines.suggestions.scopeManual', 'Elige proyectos marcando la casilla');
    default:
      return '';
  }
}
