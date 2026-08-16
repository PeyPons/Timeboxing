import { useMemo } from 'react';
import { getDate, getDaysInMonth, isSameMonth, subMonths } from 'date-fns';
import { matchesAliasingRule } from '@/lib/utils';
import { isAllocationInEffectiveMonth } from '@/utils/dateUtils';
import { getEffectiveBudget } from '@/utils/budgetUtils';
import { getEffectiveCompletedHours } from '@/utils/hoursTracking';
import { round2 } from '@/utils/numbers';
import type {
  Allocation,
  Client,
  Deadline,
  Employee,
  Project,
  ProjectAliasingRule,
} from '@/types';

export type ProjectHoursForMonth = {
  used: number;
  budget: number;
  available: number;
  percentage: number;
};

export type UseClientsProjectsMonthDataParams = {
  projects: Project[];
  clients: Client[];
  allocations: Allocation[];
  employees: Employee[];
  currentMonth: Date;
  monthDeadlines: Deadline[];
  hoursTrackingPreference?: 'computed' | 'actual';
  projectAliasingRules?: ProjectAliasingRule[];
  getProjectHoursForMonth: (projectId: string, month: Date) => ProjectHoursForMonth;
};

export function useClientsProjectsMonthData({
  projects,
  clients,
  allocations,
  employees,
  currentMonth,
  monthDeadlines,
  hoursTrackingPreference,
  projectAliasingRules,
  getProjectHoursForMonth,
}: UseClientsProjectsMonthDataParams) {
  const prevMonth = subMonths(currentMonth, 1);

  const monthProgress = useMemo(() => {
    const today = new Date();
    if (!isSameMonth(today, currentMonth)) {
      return today > currentMonth ? 100 : 0;
    }
    const daysInMonth = getDaysInMonth(currentMonth);
    const currentDay = getDate(today);
    return Math.round((currentDay / daysInMonth) * 100);
  }, [currentMonth]);

  const projectsAnalysis = useMemo(() => {
    return projects.map(project => {
      const client = clients.find(c => c.id === project.clientId);
      const monthTasks = allocations.filter(a =>
        a.projectId === project.id &&
        isAllocationInEffectiveMonth(a.weekStartDate, currentMonth)
      );

      const totalAssigned = monthTasks.reduce((sum, t) => sum + t.hoursAssigned, 0);
      const completedTasks = monthTasks.filter(t => t.status === 'completed');
      const pendingTasks = monthTasks.filter(t => t.status !== 'completed');

      const hoursReal = completedTasks.reduce((sum, t) => sum + (t.hoursActual || 0), 0);
      const hoursComputed = completedTasks.reduce((sum, t) => sum + getEffectiveCompletedHours(t, hoursTrackingPreference), 0);
      const gain = hoursComputed - hoursReal;

      const effectiveUsage = hoursComputed + pendingTasks.reduce((sum, t) => sum + t.hoursAssigned, 0);

      const deadline = monthDeadlines.find(d => d.projectId === project.id);
      const budget = getEffectiveBudget(project, deadline);
      const minimum = project.minimumHours || 0;

      const targetHours = budget > 0 ? budget : minimum;

      const planningPct = targetHours > 0 ? (effectiveUsage / targetHours) * 100 : 0;
      const executionPct = totalAssigned > 0 ? (hoursComputed / totalAssigned) * 100 : 0;

      const needsPlanning = minimum > 0
        ? effectiveUsage < minimum
        : (budget > 0 && effectiveUsage < budget);

      const behindSchedule = monthProgress > 30 && executionPct < (monthProgress - 20);

      const overBudget = budget > 0 && effectiveUsage > budget;

      const noActivity = targetHours > 0 && totalAssigned === 0;
      const hasIssue = needsPlanning || behindSchedule || overBudget || noActivity;

      const involvedEmployees = [...new Set(monthTasks.map(t => t.employeeId))];

      return {
        project,
        client,
        monthTasks,
        totalAssigned,
        completedTasks,
        pendingTasks,
        hoursReal,
        hoursComputed,
        gain,
        budget,
        minimum,
        planningPct,
        executionPct,
        needsPlanning,
        behindSchedule,
        overBudget,
        noActivity,
        hasIssue,
        involvedEmployees,
        effectiveUsage
      };
    });
  }, [projects, clients, allocations, currentMonth, monthProgress, monthDeadlines, hoursTrackingPreference]);

  const clientsWithProjects = useMemo(() => {
    const aliasingRules = projectAliasingRules || [];

    const projectsByAliasRule = new Map<string, typeof projects>();

    projects.forEach(project => {
      const matchedRule = matchesAliasingRule(project.name, aliasingRules);
      if (matchedRule && matchedRule.groupAsVirtualClient) {
        const existing = projectsByAliasRule.get(matchedRule.id) || [];
        existing.push(project);
        projectsByAliasRule.set(matchedRule.id, existing);
      }
    });

    const aliasedProjectIds = new Set(
      [...projectsByAliasRule.values()].flat().map(p => p.id)
    );

    const regularClients = clients.map(client => {
      const clientProjectsForStats = projects.filter(p => p.clientId === client.id && !aliasedProjectIds.has(p.id));

      const plannedHours = clientProjectsForStats.reduce((sum, project) => {
        const analysis = projectsAnalysis.find(a => a.project.id === project.id);
        return sum + (analysis?.totalAssigned || 0);
      }, 0);

      const computedHours = clientProjectsForStats.reduce((sum, project) => {
        const analysis = projectsAnalysis.find(a => a.project.id === project.id);
        return sum + (analysis?.hoursComputed || 0);
      }, 0);

      const realHours = clientProjectsForStats.reduce((sum, project) => {
        const analysis = projectsAnalysis.find(a => a.project.id === project.id);
        return sum + (analysis?.hoursReal || 0);
      }, 0);

      const gain = computedHours - realHours;

      const totalBudget = clientProjectsForStats.reduce((sum, p) => sum + (p.budgetHours || 0), 0);

      const pendingToCompute = totalBudget - computedHours;

      const projectsNeedingPlanning = clientProjectsForStats.filter(project => {
        const analysis = projectsAnalysis.find(a => a.project.id === project.id);
        return analysis?.needsPlanning || analysis?.noActivity;
      }).length;

      const percentage = totalBudget > 0 ? round2((plannedHours / totalBudget) * 100) : 0;

      const prevMonthProjects = projects.filter(p => p.clientId === client.id && !aliasedProjectIds.has(p.id));
      const prevPlannedHours = prevMonthProjects.reduce((sum, project) => {
        const monthTasks = allocations.filter(a =>
          a.projectId === project.id &&
          isAllocationInEffectiveMonth(a.weekStartDate, prevMonth)
        );
        return sum + monthTasks.reduce((s, t) => s + t.hoursAssigned, 0);
      }, 0);

      const clientProjects = projects
        .filter(p => p.clientId === client.id && !aliasedProjectIds.has(p.id) && p.status !== 'completed')
        .map(p => {
          const analysis = projectsAnalysis.find(a => a.project.id === p.id);
          return {
            project: p,
            analysis,
            hours: getProjectHoursForMonth(p.id, currentMonth)
          };
        });

      const monthAllocations = allocations.filter(a =>
        isAllocationInEffectiveMonth(a.weekStartDate, currentMonth) &&
        clientProjects.some(p => p.project.id === a.projectId)
      );
      const assignedEmployeeIds = [...new Set(monthAllocations.map(a => a.employeeId))];
      const assignedEmployees = assignedEmployeeIds
        .map(id => employees.find(e => e.id === id))
        .filter(Boolean) as typeof employees;

      return {
        client,
        stats: {
          used: plannedHours,
          computed: computedHours,
          real: realHours,
          gain: gain,
          budget: totalBudget,
          pendingToCompute: pendingToCompute,
          projectsNeedingPlanning: projectsNeedingPlanning,
          percentage,
          projects: clientProjects
        },
        prevStats: { used: prevPlannedHours, budget: totalBudget },
        employees: assignedEmployees
      };
    });

    projectsByAliasRule.forEach((aliasProjects, ruleId) => {
      const visibleAliasProjects = aliasProjects.filter(p => p.status !== 'completed');
      if (visibleAliasProjects.length > 0) {
        const rule = aliasingRules.find(r => r.id === ruleId);
        const aliasProjectsWithAnalysis = visibleAliasProjects.map(p => {
          const analysis = projectsAnalysis.find(a => a.project.id === p.id);
          return {
            project: p,
            analysis,
            hours: getProjectHoursForMonth(p.id, currentMonth)
          };
        });

        const totalUsed = aliasProjectsWithAnalysis.reduce((sum, p) => sum + p.hours.used, 0);
        const totalBudget = aliasProjectsWithAnalysis.reduce((sum, p) => sum + p.hours.budget, 0);
        const percentage = totalBudget > 0 ? (totalUsed / totalBudget) * 100 : 0;

        const monthAllocations = allocations.filter(a =>
          isAllocationInEffectiveMonth(a.weekStartDate, currentMonth) &&
          visibleAliasProjects.some(p => p.id === a.projectId)
        );
        const assignedEmployeeIds = [...new Set(monthAllocations.map(a => a.employeeId))];
        const assignedEmployees = assignedEmployeeIds
          .map(id => employees.find(e => e.id === id))
          .filter(Boolean) as typeof employees;

        const aliasPlannedHours = aliasProjectsWithAnalysis.reduce((sum, p) => sum + (p.analysis?.totalAssigned || 0), 0);
        const aliasComputedHours = aliasProjectsWithAnalysis.reduce((sum, p) => sum + (p.analysis?.hoursComputed || 0), 0);
        const aliasRealHours = aliasProjectsWithAnalysis.reduce((sum, p) => sum + (p.analysis?.hoursReal || 0), 0);
        const aliasGain = aliasComputedHours - aliasRealHours;
        const aliasPendingToCompute = totalBudget - aliasComputedHours;
        const aliasPercentage = totalBudget > 0 ? round2((aliasPlannedHours / totalBudget) * 100) : 0;
        const aliasProjectsNeedingPlanning = aliasProjectsWithAnalysis.filter(p =>
          p.analysis?.needsPlanning || p.analysis?.noActivity
        ).length;

        regularClients.push({
          client: {
            id: ruleId,
            name: rule?.virtualClientName || ruleId,
            color: rule?.virtualClientColor || '#10b981'
          } as Client,
          stats: {
            used: aliasPlannedHours,
            computed: aliasComputedHours,
            real: aliasRealHours,
            gain: aliasGain,
            budget: totalBudget,
            pendingToCompute: aliasPendingToCompute,
            projectsNeedingPlanning: aliasProjectsNeedingPlanning,
            percentage: aliasPercentage,
            projects: aliasProjectsWithAnalysis
          },
          prevStats: { used: 0, budget: 0 },
          employees: assignedEmployees
        });
      }
    });

    return regularClients;
  }, [clients, projects, projectsAnalysis, allocations, employees, currentMonth, prevMonth, getProjectHoursForMonth, projectAliasingRules]);

  return {
    monthProgress,
    projectsAnalysis,
    clientsWithProjects,
    prevMonth,
  };
}
