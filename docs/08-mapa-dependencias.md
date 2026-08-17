
## 8. Mapa de Dependencias (Análisis de Impacto)

**⚠️ CRÍTICO**: Usa esta sección cuando modifiques algo para saber TODOS los archivos afectados.

### 8.1 Dependencias de Types (`src/types/index.ts`)

Si modificas una interface, revisa estos consumidores:

| Interface Modificada | Archivos a Revisar |
|---------------------|-------------------|
| `Allocation` | `AppContext.tsx`, `useAllocationSheet.ts`, `AllocationSheet.tsx`, `PlannerGrid.tsx`, `MobilePlannerView.tsx`, `WeekCell.tsx`, `useProjectMetrics.ts`, `useTaskTransfers.ts` |
| `Employee` | `AppContext.tsx`, `AgencyContext.tsx`, `EmployeeRow.tsx`, `TeamPage.tsx`, `usePermissions.ts`, `capacityUtils.ts` |
| `Project` | `AppContext.tsx`, `ClientsAndProjectsPage.tsx`, `useAllocationSheet.ts`, `useProjectMetrics.ts` |
| `Agency` / `AgencySettings` (incl. `commonExpensesByMonth`, `commonExpensesRecurring`, tipos `CommonExpense*` con `distribution` byHours/byHeadcount/byPayroll) | `AgencyContext.tsx`, `CommonExpensesSettingsCard.tsx`, `FinancialHealthPage.tsx`, `commonExpensesAllocation.ts`, `usePermissions.ts` |
| `WorkSchedule` | `capacityUtils.ts`, `dateUtils.ts`, `AppContext.tsx` |
| `Absence` / `TeamEvent` | `capacityUtils.ts`, `AppContext.tsx`, `AbsencesSheet.tsx` |
| `TaskTransfer` | `useTaskTransfers.ts`, `TaskTransferComponents.tsx`, `AppContext.tsx` |
| `NotificationRule` / `src/types/notifications.ts` | `NotificationRulesSection.tsx`, `AgencySettingsPage.tsx` (pestaña Notificaciones); Edge `notify-task-transfer`, `process-notification-rules` |
| `UserPermissions` | `usePermissions.ts`, `src/types/permissions.ts`, `PermissionProtectedRoute` en `App.tsx` |
| `OKR` / `ProfessionalGoal` | `GoalsContext.tsx`, `OkrsPage.tsx`, `ProfessionalGoalsSheet.tsx`, `EmployeeDashboard.tsx` |

### 8.2 Dependencias de Contexts

| Si modificas... | Revisa también... |
|-----------------|-------------------|
| `AppContext.tsx` (fetchData) / `appDataLoader.ts` | Todos los componentes que usan `useApp()` - especialmente `AllocationSheet`, `PlannerGrid`, `EmployeeDashboard` |
| `AppContext.tsx` (getEmployeeLoadForWeek) / `appMetrics.ts` (computeEmployeeLoadForWeek) | `WeekCell.tsx`, `EmployeeRow.tsx`, `usePlannerData.ts` |
| `AppContext.tsx` (ensureMonthLoaded) | `usePlannerData.ts`, `AllocationSheet.tsx`, `OperationsRadarPage.tsx` |
| `AgencyContext.tsx` (currentAgency) / `agencyUtils.ts` | `AppContext.tsx`, `usePermissions.ts`, `AgencySettingsPage.tsx` |
| `GoalsContext.tsx` | `OkrsPage.tsx`, `ProfessionalGoalsSheet.tsx` |

### 8.3 Dependencias de Utilities

| Si modificas... | Revisa también... |
|-----------------|-------------------|
| `dateUtils.ts` → `isAllocationWeekPastForWeekly()` | `PlannerTaskContextMenu`, `AllocationSheet` (coherencia con bloqueo Weekly en vista semanal) |
| `dateUtils.ts` → `getWeeksForMonth()` | `AppContext.tsx`, `usePlannerData.ts`, `useAllocationSheet.ts`, `AllocationSheet.tsx`, `appMetrics.ts` |
| `dateUtils.ts` → `collectSelectableFutureWeekSlots()` | `useWeeklyCloseMutations.ts` (slots de destino), `WeeklyReportDialog.tsx` |
| `dateUtils.ts` → `isAllocationInEffectiveMonth()` | `AppContext.tsx`, `usePlannerData.ts`, `useProjectMetrics.ts`, `appMetrics.ts` |
| `dateUtils.ts` → `parseDateStringLocal()` | `WeeklyReportDialog.tsx` (pestañas y filtro de semana); `MyDayView.tsx` (alcance semanal y «Retrasada»); parseo local de `YYYY-MM-DD` |
| `budgetUtils.ts` → `getEffectiveBudget()` / `getEffectiveBudgetForMonth()` / `getEffectiveMinimum()` / `getEffectiveMonthlyFee()` | `DeadlinesPage`, `ClientsAndProjectsPage`, `useAllocationSheet`, `projectMetricsCompute` / `useProjectMetrics`, exports rentabilidad; rentabilidad usa `getEffectiveBudgetForMonth` + `getEffectiveMinimum` dentro de `computeProjectMetricsForMonth` |
| `profitabilityCost.ts` → coste/h estándar y reparto overhead en filas | `FinancialHealthPage`, `financialHealthExportCompute`, `rentabilityDiagnostic` |
| `deadlineUtils.ts` → `fetchDeadlinesForMonth(monthKey, agencyId)` | `DeadlinesPage`, `useDeadlinesPageData`, `useAllocationSheetMonthData` (p. ej. vía `AllocationSheet`), `EmployeeDashboard`, `ClientsAndProjectsPage`, `PlanningInconsistenciesCard`, `MyWeekView`, `GlobalPlanningInconsistencies`, `FinancialHealthPage`, `DataExportHubPage`, `useOperationsRadarMonthState`, `buildNotificationEmailPreview` |
| `deadlineMonthCopy.ts` → `selectDeadlinesToCopyFromPreviousMonth` | `DeadlinesPage` (“Copiar del mes anterior”; solo proyectos `active`) |
| `capacityUtils.ts` → `getDailyReduction()` | `getCapacityReductionInRange()`, `getCapacityReductionBreakdown()`, `AppContext.tsx`, `appMetrics.ts` |
| `capacityUtils.ts` → `getScheduledHoursForDay()` | Todas las funciones de capacidad, `WeekCell.tsx` |
| `permissions.ts` → `ROUTE_PERMISSIONS` | `App.tsx` (guards), `PermissionProtectedRoute.tsx`, `Sidebar.tsx` |
| `plans.ts` → `ROUTES_REQUIRE_PRO` / `ROUTES_REQUIRE_BUSINESS`, `PLAN_MODULES`, `PLAN_LIMITS` | `PlanGuard.tsx`, `useSubscriptionLimits.ts`, `Sidebar.tsx` (`canAccessRouteByPlan`), `OnboardingWizard`, `AgencyBillingTab`, `planExportBlocks.ts`, `plans.access.test.ts` |
| `useSubscriptionLimits.ts` | `PlanGuard`, `TeamPage`, `SubscriptionSoftLockBanner`, `usePlanMonthNavigation`, páginas con tope de mes (planificador, finanzas, capacidad, deadlines, radar, clientes, dashboard empleado) |
| `plannerMonthStorage.ts` / `useMonthNavigation.ts` | `PlannerMonthBanner`, planificador, previsión, capacidad, deadlines, radar, finanzas; evento `taimbox:planner-month-change` |
| `usePlanMonthNavigation.ts` + `planHistoryUtils.ts` | Cualquier vista con navegación de mes que deba respetar histórico Free (2 meses) |
| `planExportBlocks.ts` | `DataExportHubPage.tsx` (bloques básicos Team vs avanzados Agency+) |
| `commonExpensesAllocation.ts` (`byPayroll` sin `getEmployeePayroll` usa pesos por horas; éxito con `unallocatedAmount` / `unallocatedEntries`; aviso 0 h si **alguna** línea es `byHours`) | `FinancialHealthPage.tsx` (coste cargado, banner si hay importe no imputado); `financialHealthExportCompute`; `CommonExpensesSettingsCard.tsx`; tests en `src/utils/__tests__/commonExpensesAllocation.test.ts` |

### 8.4 Dependencias de Hooks

| Si modificas... | Revisa también... |
|-----------------|-------------------|
| `usePermissions.ts` | `AllocationSheet.tsx`, `PlannerGrid.tsx`, `AgencySettingsPage.tsx`, cualquier componente con lógica condicional por permisos |
| `useAllocationSheet.ts` | `AllocationSheet.tsx`, `EmployeeDashboard.tsx` |
| `usePlannerData.ts` | `PlannerGrid.tsx` (datos compartidos con `MobilePlannerView` en móvil) |
| `useProjectMetrics.ts` (absences/teamEvents → capacidad neta mensual por empleado) | `FinancialHealthPage`, `OperationsRadarPage`, `DataExportHubPage`, exports; otros consumidores de métricas de proyecto |
| `useTaskTransfers.ts` | `AllocationSheet.tsx`, `TaskTransferComponents.tsx` |
| `useAllocationActions.ts` | `AllocationSheet.tsx`, `AllocationFormDialog.tsx`, `MyDayView.tsx` (completar / cronómetro); coherencia con `timerReconcile.ts` y `time_entries` al marcar completada |
| `useTaskTimer.ts` / `useActiveTimerForSidebar.ts` | `TaskTimer.tsx`, `Sidebar.tsx`, `TiemposPage.tsx`, `AllocationSheet.tsx`; ver `docs/07` (drift, BroadcastChannel, Real vs entradas) |
| `timerReconcile.ts` / `timerDisplay.ts` | `useAllocationActions.ts`, planificador (`AllocationSheet`, `AllocationTaskRow`); solo completar + formato HH:MM |
| `useWeeklyCloseMutations.ts` | `WeeklyReportDialog.tsx` (mutaciones de cierre Weekly / parcial; exporta `WEEKLY_SLOT_EXTRA_MONTHS`, reexporta `parseWeeklyCloseHours`, `normalizeWeeklyHourInput` desde `weeklyCloseShared.ts`; `applyRollover` → RPC `partial_close_rollover` + `logUpdate`/`logCreate` en `auditService` para no perder historial) |
| `weeklyCloseShared.ts` | `useWeeklyCloseMutations.ts` (validación y parse de horas para posponer / completar) |
| `useDeliverableLifecycle.ts` / `useDeliverableLifecycleBatch.ts` + [`useDeliverableLifecycleCore.ts`](../src/hooks/useDeliverableLifecycleCore.ts) | Fetch de allocations por rango de fase para métricas de ciclo de vida. Filtra por `allocations.agency_id`. Ver [14-ciclo-vida-entregables.md](14-ciclo-vida-entregables.md) § «Consultas Supabase». |

### 8.5 Dependencias de Componentes Complejos (Team)

Estos componentes son muy grandes y tienen lógica interna compleja:

| Componente | Archivo | Dependencias Clave |
|------------|---------|--------------------|
| **EmployeeDialog** | `src/components/team/EmployeeDialog.tsx` | `AppContext` (UPSERT employee), `Supabase` (auth user creation) |
| **AbsencesSheet** | `src/components/team/AbsencesSheet.tsx` | `AppContext`, `capacityUtils` (validación de fechas) |
| **ProfessionalGoalsSheet** | `src/components/team/ProfessionalGoalsSheet.tsx` | `GoalsContext`, `AppContext` (empleado asociado) |

### 8.6 Flujo de Cambio de Agencia

Cuando `AgencyContext.currentAgency` cambia, se desencadena:
```
AgencyContext.switchAgency()
    ↓
AppContext useEffect detecta cambio de agency_id
    ↓
Limpia: employees, clients, projects, allocations, absences, teamEvents
    ↓
Limpia: loadedMonthsRef (caché de meses)
    ↓
fetchData() con nuevo agency_id
    ↓
Todos los componentes re-renderizan
```

### 8.7 Otras Utilidades y Hooks (Nuevos Hallazgos)

| Archivo | Propósito | Dependencias Clave |
|---------|-----------|--------------------|
| `src/utils/logger.ts` | Sistema de logging estructurado | Usado en `PlannerGrid` y otros |
| `src/hooks/useTasksImpact.ts` | Pre-cálculo de impacto de nuevas tareas | `useAllocationSheet`, `ProjectBudgetStatus` |
| `src/hooks/useWeeklyCloseMutations.ts` | Mutaciones de cierre Weekly (`applyMove` solo si otro flujo lo necesita; en UI masiva/parcial el posponer usa `applyRollover`), transfer, justify, keep, rollover, distribute | `WeeklyReportDialog`; usa `collectSelectableFutureWeekSlots` desde `viewDate` |
| `src/hooks/use-mobile.tsx` | Detección de dispositivo móvil (breakpoint 768px) | UI responsiva: `AppLayout` (ya no bloquea móvil), `PlannerGrid` → `MobilePlannerView`, `AllocationSheet` (vista semanal/mensual en cards, toggles Semana/Mes ≥44px), `AllocationTaskRow` (isMobile), `DeadlinesPage` y `DeadlinesFilters` (filtros/edición en Sheet), `Sidebar` |
| `src/components/deadlines/DeadlinesFilters.tsx` | Filtros de Deadlines con estado local (búsqueda, tipo, empleado, orden, ocultos, sin asignar) | Usado solo por `DeadlinesPage`; notifica valores vía `onFiltersChange`; no crea suscripciones Realtime |
| `src/components/deadlines/GlobalAssignmentDialog.tsx` | Dialog crear/editar asignaciones globales (nombre, horas, afecta a todos o empleados seleccionados) | Usado solo por `DeadlinesPage`; estado del formulario interno; no Realtime |
| `src/components/deadlines/DeadlinesSuggestionsPreview.tsx` | Vista compacta de recomendaciones en sidebar (hasta 3 empleados, tooltip, botón "Ver desglose por proyecto") | Usado solo por `DeadlinesPage`; presentacional; recibe `groups` (slice de sugerencias) y `onOpenFull`; no estado interno |
| `src/components/deadlines/DeadlinesSuggestionsPanel.tsx` | Panel ampliable de sugerencias (Sheet móvil / Dialog desktop): condicionantes (quién cede, % máx. receptor, % mín. quien cede), lista por empleado/proyecto, resumen propuesto | Usado solo por `DeadlinesPage`; controlado (estado y callbacks en la página); no Realtime |
| `src/components/deadlines/DeadlinesAvailabilityCard.tsx` | Card de disponibilidad del equipo (asignado vs disponible por empleado, % y barra de progreso; opcional tooltip con ausencias/eventos) | Usado por `DeadlinesPage` y por `DeadlinesPageHeader` (Sheet Equipo móvil); presentacional; `compact` para vista sin tooltip |
| `src/components/deadlines/DeadlinesProjectEditSheet.tsx` | Sheet de edición de un proyecto (móvil): horas por empleado, ajuste presupuesto, notas, ocultar | Usado solo por `DeadlinesPage` cuando isMobile y editingProjectId; controlado (formData y callbacks en la página) |
| `src/components/deadlines/DeadlinesSidebar.tsx` | Panel lateral desktop: disponibilidad, recomendaciones (DeadlinesSuggestionsPreview), tareas globales | Usado solo por `DeadlinesPage` cuando !isMobile && canEditDeadlines |
| `src/components/deadlines/DeadlinesPageHeader.tsx` | Cabecera: título, selector de mes, copiar/resetear mes, Sheet "Equipo" (móvil) | Usado solo por `DeadlinesPage` |
| `src/components/deadlines/DeadlinesConfirmDialog.tsx` | AlertDialog para confirmar eliminar deadline/asignación, copiar mes o resetear mes | Usado solo por `DeadlinesPage` |
| `src/components/deadlines/DeadlinesProjectList.tsx` | Listado de proyectos agrupados por cliente: cabeceras colapsables, filas con horas/equipo/total, edición inline (desktop), indicadores de edición concurrente y ocultos | Usado solo por `DeadlinesPage`; recibe `projectsByClient`, callbacks de edición y `onRequestDeleteDeadline`; usa `DeadlineEmployeeRow` para chips y filas de horas por empleado |
| `src/components/deadlines/DeadlineEmployeeRow.tsx` | Fila/chip de empleado en Deadlines: modo display (chip avatar + nombre + horas) o modo edit (avatar + nombre + input horas); usado en el listado de proyectos | Usado solo por `DeadlinesProjectList` |
| `src/components/planner/allocation/AllocationMonthNavigation.tsx` | Bloque presentacional de navegación mensual/semanal del AllocationSheet (mes actual, desplazamiento horizontal de semanas) | Usado solo por `AllocationSheet` |
| `src/components/planner/allocation/AllocationToolbarControls.tsx` | Bloque presentacional de herramientas en cabecera del AllocationSheet (búsqueda, toggle Semana/Mes, accesos a Timeline/Weekly y menú de orden/visualización) | Usado solo por `AllocationSheet` |
| `src/components/clients-projects/ClientsAndProjectsFilters.tsx` | Filtros de Clientes y Proyectos con estado local (búsqueda, estado, tipo proyecto, empleado, filtros de análisis: todos/sin actividad/falta planificar/retrasados/exceso horas) | Usado solo por `ClientsAndProjectsPage`; notifica valores vía `onFiltersChange`; debounce 300 ms en búsqueda |
| `src/hooks/useProjectAliasing.ts` | Formateo de nombres de proyectos según reglas de agencia | `AgencyContext`, `formatProjectName`, usado en 15+ componentes |
| `AgencyContext` selectores (`useAgencySettings`, `useAgencyModules`, `useUserAgencies`) | Lectura segmentada de agencia/config sin consumir todo `useAgency()` | Configuración y pantallas con consumo parcial de settings/agencias |
| `src/utils/deadlineUtils.ts` | Carga de deadlines por mes filtrando por agencia (multi-tenant) | `fetchDeadlinesForMonth(monthKey, agencyId)`; join con `projects.agency_id`. Usado por `useDeadlinesPageData`, DeadlinesPage, `useAllocationSheetMonthData` / AllocationSheet, EmployeeDashboard, ClientsAndProjectsPage, PlanningInconsistenciesCard, MyWeekView, GlobalPlanningInconsistencies, FinancialHealthPage, DataExportHubPage, useOperationsRadarMonthState, buildNotificationEmailPreview |
| `src/utils/deadlineMonthCopy.ts` | Selección de filas al copiar mes en Deadlines | `selectDeadlinesToCopyFromPreviousMonth` (solo `active`); usado por `DeadlinesPage` |
| `src/utils/planningInconsistencies.ts` | Cálculo puro de incoherencias globales por proyecto/empleado y filtro por búsqueda (proyecto/cliente) | Usado por `GlobalPlanningInconsistencies` para separar lógica de datos del render |
| `src/utils/listScrollAnchor.ts` / `src/hooks/usePreserveListScrollAnchor.ts` | Ancla de scroll en listas largas: al insertar/quitar/reordenar filas por Realtime, conserva el ítem que el usuario tenía a la vista | Usado por `GlobalPlanningInconsistencies` (seguimiento operativo). No restaurar al cambiar mes/filtros/búsqueda (`resetKey`) |
| `src/utils/permissionsUtils.ts` | Utilidades puras de permisos (resolver permisos por rol, checks `canAccess`/`hasPermission`, fallback restringido) | `usePermissions` |
| `src/utils/numbers.ts` | Utilidades numéricas compartidas (`round2`) para evitar duplicación de redondeos | `AppContext`, `appDataLoader`, `appMetrics`, `planningInconsistencies`, `Weekly/Radar/Planner` |
| `src/hooks/useOperationsRadarMonthState.ts` | Estado mensual y sincronización URL para Radar Operativo (`?mes`), carga de deadlines del mes y navegación de meses | Usado por `OperationsRadarPage` |
| `src/hooks/useOperationsRadarData.ts` | Capa de datos del Radar Operativo: cálculo de riesgo (`overBudget` / `lowProgress` / `lowPace`), filtros por departamento y ordenación base por severidad | Usado por `OperationsRadarPage` |
| `src/hooks/useWeeklyForecastMonthData.ts` | Estado mensual de Previsión (`forecast_date` en `localStorage`) y `ensureMonthLoaded` para allocations del mes | Usado por `WeeklyForecastPage` |
| `src/hooks/useWeeklyForecastFilters.ts` | Filtros de departamento para Previsión mensual (`employeesForView`, `filteredProjectsForView` según allocations del mes) | Usado por `WeeklyForecastPage` |
| `src/hooks/useWeeklyForecastRedistribution.ts` | Tareas retrasadas por empleado y redistribución (completar original + crear tarea transferida en semana destino) | Usado por `WeeklyForecastPage` |
| `src/hooks/useAllocationSheetMonthData.ts` | Carga mensual de AllocationSheet (cache local por mes + deadlines del mes para presupuesto efectivo) | Usado por `AllocationSheet` |
| `AppContext` selectores (`useAppAllocationActions`, `useAppWeeklyFeedback`) | Lectura segmentada sin consumir `useApp()` completo | `AllocationSheet` usa ambos; otras pantallas solo los que necesitan (p. ej. `WeeklyForecastPage` importa `useAppAllocationActions`, no `useAppWeeklyFeedback`) |
| `src/hooks/useDeadlinesRedistribution.ts` | Cálculo de tips de redistribución (desequilibrio de carga), suggestionDonors, suggestionsByEmployeeAndProject, suggestionsByEmployee; condicionantes (excludedDonorIds, maxReceiverLoadPct, minSenderLoadPct) | Usado solo por `DeadlinesPage` |

**Criterio de recomendaciones (quién sale en “Recomendaciones”)**: Aparecen como receptores **todos** los compañeros con **carga por debajo de la media** (porcentaje de horas asignadas / disponibles menor que media − umbral; si no hay nadie con el umbral estricto se usa umbral relajado de 5%). Los proyectos desde los que pueden recibir son los de los sobrecargados (aunque el receptor no tenga horas aún). No se exige compartir proyecto. como “sobrecargado”. Por tanto, un compañero con muchas horas libres pero que no trabaja en ningún proyecto en común con los sobrecargados **solo se generan tips si hay al menos 2 empleados activos y el rango de carga (máx − mín) es ≥ 5%. Lógica en `getRedistributionTips` (useDeadlinesRedistribution.ts).

| `src/hooks/useDeadlinesPageData.ts` | Carga de deadlines y global_assignments, suscripción Realtime (deadlines, global_assignments, project_editing_locks, broadcast lock-released), carga/limpieza de locks, filteredProjects, projectsByClient, activeEmployees, getMonthlyCapacity, getEmployeeAssignedHours, getProjectDeadline; expone broadcastChannelRef para envío de lock-released desde la página | Usado solo por `DeadlinesPage` |
| `src/hooks/useDeadlinesEditing.ts` | Edición inline en Deadlines: estado (editingProjectId, inlineFormData, isSaving, autoSaveStatus), refs (autoSaveTimeout, lockRefreshInterval), acquire/renew/release/releaseAllMy locks, startEditingProject, cancelEditingProject, toggleProjectExpanded, updateInlineEmployeeHours, autoSaveDeadline, handleFormPatch, saveInlineDeadline; cleanup al desmontar o cambiar mes; cancelEditingProject limpia también autoSaveTimeoutRef | Usado solo por `DeadlinesPage`; recibe canEditDeadlines, selectedMonth, currentUser, employees, getProjectDeadline, hiddenProjects, setHiddenProjects, setDeadlines, setEditingLocks, broadcastChannelRef, setExpandedProjects |

**Refactor Deadlines (auditoría)**: Tras reducir DeadlinesPage de ~1120 a ~670 líneas con hooks y componentes extraídos, se auditaron: encaje de props entre página → DeadlinesProjectList / DeadlinesProjectEditSheet / DeadlinesSidebar; tipos InlineFormData y getProjectDeadline compatibles; useDeadlinesPageData (Realtime deadlines, global_assignments, project_editing_locks, broadcast lock-released) y useDeadlinesEditing (locks, autoSave, cleanup); build y lints OK. No hay tests unitarios de Deadlines; se recomienda prueba manual: edición inline desktop, Sheet móvil, locks entre usuarios, cambio de mes, cerrar pestaña con edición abierta.

**Cierre parcial / Weekly (2026-05)**: El componente `TaskPartialCloseDialog` se eliminó del repo. El flujo único en planificador y dashboard es `WeeklyReportDialog` (menú ⋯ / Mi día) con `focusAllocationId` y `useWeeklyCloseMutations`.

---

### 8.8 Purge de agencia (admin plataforma)

| Pieza | Impacto |
|-------|---------|
| Edge `admin-delete-agency` | Stripe `cancel`; errores recuperables solo `resource_missing`; RPC con cliente **anon + JWT** (`supabaseUser.rpc`), nunca service role para `admin_delete_agency`. Post-RPC: `deleteUser` best-effort. |
| RPC `admin_delete_agency` | Inserta `platform_audit_logs` (`agency_purged`); `DELETE google_ads_changes` por clientes de la agencia; resto del purge sin cambios funcionales respecto a la migración `20260414130000`. |
| `platform_audit_logs` | Nueva tabla; RLS lectura solo `platform_admins`. |

### 8.9 Flujo de Carga de Mes

```
Usuario navega a otro mes
    ↓
usePlannerData.setCurrentMonth()
    ↓
ensureMonthLoaded(date) en AppContext
    ↓
¿loadedMonthsRef.has(monthKey)? → SÍ → Return (Cache hit)
                                 ↓ NO
loadDataForMonth(date)
    ↓
Fetch: allocations, absences, team_events, weekly_feedback
    ↓
UPSERT merge con estado existente
    ↓
loadedMonthsRef.add(monthKey)
```

