import { useMemo } from 'react';
import type { Allocation, Client, DepartmentDefinition, Employee, Project } from '@/types';
import type { EmployeeMetrics, ProjectMetrics } from '@/hooks/useProjectMetrics';
import { employeeBelongsToDepartment } from '@/utils/departmentUtils';
import { isAllocationInEffectiveMonth } from '@/utils/dateUtils';
import { deliverablePhaseOverlapsMonth, getDeliverablePhase } from '@/utils/deliverableLifecycle';
import { PROJECT_TYPE_ENTREGABLE } from '@/config/projectTypePresets';

type HoursMode = 'actual' | 'computed';

interface UseFinancialDepartmentViewParams {
  selectedDepartmentId: string | null;
  departments: DepartmentDefinition[];
  employees: Employee[];
  allocations: Allocation[];
  currentMonth: Date;
  projectMetrics: ProjectMetrics[];
  employeeMetrics: EmployeeMetrics[];
  projects: Project[];
  clients: Client[];
  searchQuery: string;
  hoursMode: HoursMode;
}

export function useFinancialDepartmentView({
  selectedDepartmentId,
  departments,
  employees,
  allocations,
  currentMonth,
  projectMetrics,
  employeeMetrics,
  projects,
  clients,
  searchQuery,
  hoursMode,
}: UseFinancialDepartmentViewParams) {
  const employeesForView = useMemo(() => {
    if (!selectedDepartmentId || !departments.length) return employees ?? [];
    const dept = departments.find(
      d => d.id === selectedDepartmentId || d.name === selectedDepartmentId
    );
    if (!dept) return employees ?? [];
    return (employees ?? []).filter(e =>
      employeeBelongsToDepartment(e.department, dept.id, dept.name)
    );
  }, [employees, selectedDepartmentId, departments]);

  const projectIdsForDepartment = useMemo(() => {
    if (!selectedDepartmentId) return undefined as Set<string> | undefined;
    if (!employeesForView.length) return new Set<string>();
    const allowedEmployeeIds = new Set(employeesForView.map(e => e.id));
    const ids = new Set<string>();
    (allocations ?? []).forEach(a => {
      if (!allowedEmployeeIds.has(a.employeeId)) return;
      if (!isAllocationInEffectiveMonth(a.weekStartDate, currentMonth)) return;
      ids.add(a.projectId);
    });
    return ids;
  }, [allocations, employeesForView, selectedDepartmentId, currentMonth]);

  const selectedDept = useMemo(() => {
    if (!selectedDepartmentId || !departments.length) return null;
    return (
      departments.find(d => d.id === selectedDepartmentId || d.name === selectedDepartmentId) ??
      null
    );
  }, [selectedDepartmentId, departments]);

  const projectMetricsForView = useMemo(() => {
    if (!projectIdsForDepartment || !selectedDept) return projectMetrics;
    return projectMetrics.filter(p => {
      // Proyectos internos (ingreso 0 €) siempre en vista: ver "Inversión interna" / pérdida
      if ((p.monthlyFee ?? 0) === 0) return true;
      if (projectIdsForDepartment.has(p.projectId)) {
        const proj = projects?.find(pr => pr.id === p.projectId);
        if (!proj?.responsibleDepartmentId) return true;
        return (
          proj.responsibleDepartmentId === selectedDept.id ||
          proj.responsibleDepartmentId === selectedDept.name
        );
      }
      // Entregable activo en fase con área responsable = vista, aunque no haya imputaciones del equipo.
      const proj = projects?.find(pr => pr.id === p.projectId);
      if (
        proj &&
        proj.status === 'active' &&
        proj.projectType === PROJECT_TYPE_ENTREGABLE &&
        getDeliverablePhase(proj) &&
        deliverablePhaseOverlapsMonth(proj, currentMonth)
      ) {
        const responsibleDepartment = proj.responsibleDepartmentId;
        if (
          responsibleDepartment &&
          (responsibleDepartment === selectedDept.id ||
            responsibleDepartment === selectedDept.name)
        ) {
          return true;
        }
        if (!responsibleDepartment) return true;
      }
      return false;
    });
  }, [projectMetrics, projectIdsForDepartment, selectedDept, projects, currentMonth]);

  const lifecycleDepartmentProjectIds = useMemo(() => {
    if (!selectedDepartmentId) return undefined;
    return new Set(projectMetricsForView.map(p => p.projectId));
  }, [selectedDepartmentId, projectMetricsForView]);

  const clientById = useMemo(() => {
    const map = new Map<string, string>();
    clients.forEach(client => map.set(client.id, client.name));
    return map;
  }, [clients]);

  const projectMetricsFilteredBySearch = useMemo(() => {
    if (!searchQuery.trim()) return projectMetricsForView;
    const query = searchQuery.trim().toLowerCase();
    return projectMetricsForView.filter(projectMetric => {
      const clientName =
        clientById.get(projectMetric.clientId) || projectMetric.clientName || '';
      return (
        projectMetric.projectName.toLowerCase().includes(query) ||
        clientName.toLowerCase().includes(query)
      );
    });
  }, [projectMetricsForView, searchQuery, clientById]);

  const projectMetricsBillable = useMemo(
    () => projectMetricsFilteredBySearch.filter(p => (p.monthlyFee ?? 0) > 0),
    [projectMetricsFilteredBySearch]
  );

  const projectMetricsInternal = useMemo(
    () => projectMetricsFilteredBySearch.filter(p => (p.monthlyFee ?? 0) === 0),
    [projectMetricsFilteredBySearch]
  );

  const projectMetricsBillableWithActivity = useMemo(() => {
    const deliverableOverlapIds = new Set(
      (projects ?? [])
        .filter(
          project =>
            project.status === 'active' &&
            project.projectType === PROJECT_TYPE_ENTREGABLE &&
            deliverablePhaseOverlapsMonth(project, currentMonth)
        )
        .map(project => project.id)
    );
    return projectMetricsBillable.filter(projectMetric => {
      if (
        (hoursMode === 'computed' ? projectMetric.computed : projectMetric.actual) > 0
      ) {
        return true;
      }
      return deliverableOverlapIds.has(projectMetric.projectId);
    });
  }, [projectMetricsBillable, hoursMode, projects, currentMonth]);

  const employeeMetricsForView = useMemo(() => {
    if (!selectedDepartmentId) return employeeMetrics;
    const allowedIds = new Set(employeesForView.map(e => e.id));
    return employeeMetrics.filter(employeeMetric =>
      allowedIds.has(employeeMetric.employeeId)
    );
  }, [employeeMetrics, selectedDepartmentId, employeesForView]);

  const departmentNameForView = useMemo(() => {
    if (!selectedDepartmentId) return null;
    const department = departments.find(
      d => d.id === selectedDepartmentId || d.name === selectedDepartmentId
    );
    return department?.name ?? null;
  }, [selectedDepartmentId, departments]);

  const internalWithActivity = useMemo(
    () =>
      projectMetricsInternal.filter(
        p => (hoursMode === 'computed' ? p.computed : p.actual) > 0
      ),
    [projectMetricsInternal, hoursMode]
  );

  return {
    projectMetricsForView,
    lifecycleDepartmentProjectIds,
    clientById,
    projectMetricsBillableWithActivity,
    employeeMetricsForView,
    departmentNameForView,
    internalWithActivity,
  };
}
