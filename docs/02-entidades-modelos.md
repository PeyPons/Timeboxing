
## 2. Glosario de Entidades y Modelos de Datos

> **DDL de referencia (tablas/columnas):** [13-esquema-base-datos.md](13-esquema-base-datos.md) y [`sql/schema-snapshot-context.sql`](sql/schema-snapshot-context.sql) — snapshot de contexto; migraciones ejecutables en `supabase/migrations/`.

A continuación se detallan las entidades principales del sistema, sus variables clave y su propósito.

### 2.1. Agencia (`Agency`)
El núcleo del modelo **multi-tenant**. Cada usuario pertenece a una o más agencias.
- `id`: UUID único.
- `settings`: Objeto JSON que define la configuración de la agencia.
    - `roles`: Array de `RolePermissions` definidos por cada agencia. Sin roles hardcodeados excepto "Administrador" como rol protegido del sistema.
    - `modules`: Módulos habilitados (Ads/PPC, etc.).
    - `branding`: Colores y logotipos personalizados.
    - `projectAliasingRules`: Reglas para renombrado automático de proyectos.
    - `ehrTarget`: Opcional. Objetivo de Precio Hora Efectivo (€/h) en **Rentabilidad**. Si no se define, se usa 75 €/h o la media de coste por hora de la agencia si es superior. Se edita en la página **Rentabilidad** (diálogo «Objetivo y gastos»).
    - `commonExpensesByMonth`: Opcional. Gastos comunes puntuales por clave `yyyy-MM`.
    - `commonExpensesRecurring`: Opcional. Gastos fijos mensuales con `recurringFromMonth` (y `recurringUntilMonth` opcional); se combinan con las líneas del mes al calcular overhead en Rentabilidad.
    - `CommonExpenseEntry.distribution`: Opcional, define cómo se reparte el importe dentro del scope (`allocation`). Valores: `byHours` (default, proporcional a horas del mes; excluye 0 h), `byHeadcount` (a partes iguales, incluye empleados sin horas) y `byPayroll` (proporcional a la nómina mensual). Si falta, se comporta como `byHours` para compatibilidad con datos previos.

#### Sistema de Roles Dinámicos
Cada agencia define sus propios roles con permisos granulares:
- Los roles se definen como `RolePermissions[]` en `AgencySettings.roles`.
- La verificación de admin (`isAdmin`) se basa en el permiso `can_access_agency_settings`, no en nombres de rol hardcodeados.
- El rol "Administrador" está protegido y no puede ser eliminado.

#### Sistema de Aliasing de Proyectos
Permite renombrar proyectos automáticamente según patrones configurables:
- `ProjectAliasingRule.matchPatterns`: Patrones de detección (ej: `["(KD)", "kit digital"]`).
- `ProjectAliasingRule.displayPrefix`: Prefijo a mostrar (ej: `"KD:"`).
- Default: Regla de Kit Digital preconfigurada.

**Implementación (Hook centralizado)**:
- **Hook**: `src/hooks/useProjectAliasing.ts` → expone `formatName(projectName)`
- **Uso**:
  ```typescript
  const { formatName: formatProjectName } = useProjectAliasing();
  // Luego: formatProjectName(project.name)
  ```
- **Función auxiliar**: `matchesAliasingRule(name, rules)` en `src/lib/utils.ts`

**Componentes que usan aliasing** (actualizar si añades más):
| Componente | Archivo | Línea aprox. |
|------------|---------|--------------|
| AllocationSheet | `src/components/planner/AllocationSheet.tsx` | ~2000. Orquestador de planificación por empleado/mes (datos, edición, Weekly, transferencias, impacto, responsive). |
| AllocationProjectHeader | `src/components/planner/allocation/AllocationProjectHeader.tsx` | ~45 |
| AllocationTaskRow | `src/components/planner/allocation/AllocationTaskRow.tsx` | ~50. En móvil recibe `isMobile` para filas táctiles (min-h 44px), texto `text-sm`, horas `font-mono text-base` y botón menú ≥44px. **Indicador sol (☀)**: círculo ámbar junto al nombre si `focus_date` coincide con el día local (visible en vista semanal y mensual); indica que el empleado tiene la tarea en foco hoy (`MyDayView`). Menú vía **`PlannerTaskContextMenu`**: con Weekly activo → **Editar** + **Opciones Weekly…** (abre `WeeklyReportDialog` con `focusAllocationId`). Sin Weekly → Editar, transferir, mover sem. |
| PlannerTaskContextMenu | `src/components/planner/allocation/PlannerTaskContextMenu.tsx` | Menú ⋯ compartido: vista **mensual** y **semanal** del planificador. Con `isWeeklyEnabled` y `onOpenWeeklyForTask`: entradas reducidas y reutilización del modal masivo Weekly por tarea. |
| AllocationFormDialog | `src/components/planner/allocation/AllocationFormDialog.tsx` | ~100. Alta por lotes: **Guardar** deshabilitado hasta ≥1 fila con proyecto+nombre+horas y sin filas con nombre/horas sin proyecto (lógica en `useAllocationActions`: `canSubmitBatchAdd`). Cerrar con cambios sin guardar: **AlertDialog** (mismo patrón y copy base que «Añadir tareas» en `EmployeeDashboard`), no diálogo nativo del navegador. |
| GanttView | `src/components/planner/GanttView.tsx` | ~95 |
| BatchTaskRow | `src/components/planner/BatchTaskRow.tsx` | ~65. Selector de proyecto en "Añadir tareas": lista ordenada con primero los proyectos que tienen deadline asignado al empleado de la tarea (o actual), luego el resto. |
| ProjectImpactSummary | `src/components/planner/ProjectImpactSummary.tsx` | ~45 |
| DashboardWidgets | `src/components/employee/DashboardWidgets.tsx` | ~120 |
| WeeklyReportDialog | `src/components/employee/WeeklyReportDialog.tsx` | Modal Weekly (UI corporativa: cabecera, buscador, **cuatro** acciones con copy formal, paneles de detalle unificados, pie “Cancelar” / **Confirmar cierre**). **Pestañas** (`Tabs`): **Requieren cierre** vs **Semana actual** según `isSameWeek(..., hoy, { weekStartsOn: 1 })` sobre `parseDateStringLocal(week_start_date)` (evita que `parseISO` con solo fecha desplace un día en UTC− y clasifique mal toda la semana). Lista y filtro **por pestaña**; **Confirmar cierre** sigue sobre `allTasks`. **`focusAllocationId`:** pestaña inicial acorde a esa misma regla. Una sola tarea: vista compacta *Opciones Weekly*. **Posponer** → `applyRollover`. **Mutaciones:** `useWeeklyCloseMutations`. **Semanas destino:** mes de `viewDate` + mes siguiente. Validación: `canSubmit`, `validationErrors`, `capacityWarnings`. El antiguo `TaskPartialCloseDialog` (parcial) se retiró del repo; el flujo del planificador es este diálogo desde el menú ⋯ con `focusAllocationId`. |
| PlanningInconsistenciesCard | `src/components/employee/PlanningInconsistenciesCard.tsx` | ~60. **Control de planificación** (dashboard empleado): resumen del mes + filtro «Filtrar por proyecto» integrado en un bloque unificado (ancho completo); si hay texto, muestra «Mostrando M de N tras filtrar». Botón **Añadir** (tareas): píldora pequeña, fondo blanco, texto gris (`slate-600`), icono `ListPlus` violeta (`violet-600`), borde/sombra muy suaves; en colapsado solo si hay déficit (`difference < 0`) y en expandido junto a «TUS DATOS». |
| GlobalPlanningInconsistencies | `src/components/employee/GlobalPlanningInconsistencies.tsx` | ~380 |
| MyWeekView | `src/components/employee/MyWeekView.tsx` | ~150 |
| MyDayView | `src/components/employee/MyDayView.tsx` | Vista **Mi día** (modelo Pull): zona **En foco hoy** (`focus_date` = hoy local) y **Backlog semanal**; botón "Añadir a mi día" / "Devolver al backlog" en cada tarjeta; orden del backlog con `user_priority` (flechas, solo hover); buscador de tareas/proyectos en la cabecera; respeta `hoursTrackingPreference` en el popover de completar; icono **ListChecks** junto a completar si `weeklyEnabled` + `onOpenWeeklyForAllocation` → abre `WeeklyReportDialog` con `focusAllocationId` (mismo flujo que «Opciones Weekly…» del planner). Props: `employeeId`, `viewDate`, `weeklyEnabled?`, `onOpenWeeklyForAllocation?`. |
| DeadlinesPage | `src/pages/DeadlinesPage.tsx` | ~680. **Datos**: `useDeadlinesPageData.ts` (carga deadlines/globales, Realtime, locks, filteredProjects, projectsByClient, getMonthlyCapacity, getEmployeeAssignedHours). **Edición inline**: `useDeadlinesEditing.ts` (locks adquirir/renovar/liberar, formulario inline, autoSave, handleFormPatch, cancelEditingProject, toggleProjectExpanded). **Sugerencias**: `useDeadlinesRedistribution.ts`. **Filtros**: `DeadlinesFilters.tsx`. **Listado**: `DeadlinesProjectList.tsx`. **Asignaciones globales**: `GlobalAssignmentDialog.tsx`. **Sugerencias UI**: `DeadlinesSuggestionsPreview.tsx`, `DeadlinesSuggestionsPanel.tsx`. Sin dialog de crear/editar deadline (eliminado como código muerto). |
| WeeklyForecastPage | `src/pages/WeeklyForecastPage.tsx` | Previsión mensual: pestaña **Historial** (`ActivityLogSection`, auditoría de allocations) y **Redistribución** (`useWeeklyForecastRedistribution`). Mes y vista departamento: `useWeeklyForecastMonthData`, `useWeeklyForecastFilters`. |
| ActivityPage | `src/pages/ActivityPage.tsx` | **Registro de actividad** (`/actividad`): mismo historial (`ActivityLogSection`) como página propia, independiente del módulo Weekly. Plan Pro+ (`ROUTES_REQUIRE_PRO`) + permiso `can_access_activity_log` (roles antiguos sin la clave heredan la visibilidad efectiva de `can_access_weekly_forecast`; ver `resolveUserPermissions`). Sidebar: grupo Seguimiento. |
| EmployeeDashboard | `src/pages/EmployeeDashboard.tsx` | ~220. Toolbar compacta unificada: toggle vista (izq.), acciones primarias al centro (Weekly, Añadir tareas, Tarea interna), secundarias en dropdown "Más" (Objetivos, Ausencias, CRM, Repetir tour). Toggle **Mi semana | Mi día** (`useDashboardView` cuando el departamento no es estricto). Vista semanal: calendario mensual + pestañas. Vista día: `MyDayView` sin calendario grande; **Weekly** masivo limpia `weeklyFocusAllocationId`; desde cada tarea del día se puede abrir el mismo `WeeklyReportDialog` con foco en esa allocation. Pestaña **Dependencias**. Modal **Añadir tareas**: **Guardar** deshabilitado si falta proyecto en filas con nombre u horas; mínimo una fila completa (proyecto + nombre + horas). Demo: `DemoEmployeeDashboard.tsx`. |
| OperationsRadarPage | `src/pages/OperationsRadarPage.tsx` | ~900 (nombre en fila de proyecto; búsqueda por nombre formateado o crudo) |

> **⚠️ IMPORTANTE**: Si creas un nuevo componente que muestra nombres de proyectos, DEBES usar `useProjectAliasing().formatName()` para mantener consistencia.

#### Exclusiones del cálculo de precisión de planificación
- `AgencySettings.planningPrecisionExclusions`: Opcional. Permite excluir tareas de **proyectos** y/o **clientes** concretos del cálculo del **índice de fiabilidad** (precisión de planificación).
- **Campos**: `projectIds?: string[]`, `clientIds?: string[]`. Si un cliente está en `clientIds`, se excluyen todas las tareas de proyectos de ese cliente.
- **Dónde se aplica**:
  - **Dashboard del empleado → pestaña "Mis métricas"**: la tarjeta "Precisión de planificación" es `ReliabilityIndexCard`, que ya aplica las exclusiones (las tareas de proyectos/clientes excluidos no entran en el índice).
  - Utilidad compartida: `src/utils/planningPrecisionUtils.ts` → `getExcludedProjectIds(projects, exclusions)`.
- **Configuración**: En Configuración de agencia (`AgencySettingsPage`), pestaña **Módulos y métricas** → bloque "Precisión de planificación": selectores con búsqueda para elegir proyectos y clientes a excluir. La página está organizada en secciones (General, Equipo, Departamentos, Proyectos, Módulos y métricas, Integraciones, Apariencia) para facilitar la localización de opciones.

#### Radar operativo: exclusión del riesgo «Poco avance»
- `AgencySettings.radarLowProgressExcludeKeywords`: Opcional. Lista de palabras clave (strings). Si el **nombre del proyecto** contiene alguna de estas palabras (comparación insensible a mayúsculas), el proyecto **no** se marcará como riesgo «Poco avance» en el Radar operativo al final de mes (cuando el avance es &lt; 35%).
- **Dónde se aplica**: `src/pages/OperationsRadarPage.tsx` → cálculo de `atRiskProjectsRaw` (exclusión en la condición de riesgo `lowProgress`).
- **Configuración**: En Configuración de agencia, pestaña **Módulos y métricas** → bloque "Radar operativo": input para añadir/quitar palabras clave (ej. off-page, linkbuilding). Sin palabras configuradas, todos los proyectos pueden recibir la alerta «Poco avance» si aplica.

#### Vistas por Departamento
- **Propósito**: Permitir a los managers filtrar la plataforma por área (ej. Marketing, Desarrollo) sin perder la vista global.
- **Configuración**: En Configuración de agencia, pestaña **Departamentos**: listado con nombre y color por departamento. El color se usa en la barra de aviso cuando el filtro está activo.
- **Asignación**: En ficha de empleado, campo "Departamento principal" (un empleado pertenece a un departamento). En ficha de proyecto, "Departamento responsable" (para reportes financieros).
- **Selector**: En el Sidebar, dropdown "Vista por departamento": opción "Vista Global (CEO)" y lista de departamentos. La selección se persiste en `localStorage` por agencia.
- **Barra de aviso**: Si hay un departamento seleccionado, aparece una barra bajo el header con el color del departamento, texto "Estás viendo la vista filtrada de: [Nombre]. El resto de datos están ocultos." y botón "Borrar filtro".
- **Comportamiento**: Planificador y Gantt muestran solo empleados del departamento (sus tareas en todos los proyectos siguen visibles). Team Pulse y Reportes filtran por empleados y, en reportes, la rentabilidad por proyectos del departamento responsable. **WeeklyForecastPage** (Previsión mensual): redistribución de tareas retrasadas e historial de cambios usan `employeesForView` y `filteredProjectsForView`; **ActivityLogSection** respeta la vista por departamento (logs filtrados por empleado y proyecto del departamento). Utilidades: `src/utils/departmentUtils.ts` (`normalizeDepartments`, `employeeBelongsToDepartment`). Contexto: `DepartmentViewContext`; componentes: `DepartmentViewSelector`, `DepartmentViewBanner`.

### 2.2. Empleado (`Employee`)
Representa a los miembros del equipo.
- `role`: Nombre del rol que determina los permisos.
- `department`: ID (o nombre legacy) del departamento principal para filtrado en vistas por departamento.
- `monthlyCost`: **Coste mensual (nómina)** en € (tipo TS; columna BD `hourly_rate`). En la UI se edita como "Coste mensual (nómina) €". `hourlyRate` en TS es alias **deprecated** rellenado en carga por compatibilidad. En Rentabilidad hay dos modelos de coste: **Operativo** (nómina / capacidad teórica mensual); **Dinámico** (reparte la nómina entre proyectos en proporción a las horas del empleado en el mes). Coste cargado: gastos comunes vía `commonExpensesAllocation`.
- `defaultWeeklyCapacity`: Horas base de trabajo por semana; **se calcula automáticamente** a partir del horario por día (`workSchedule`). No existe campo editable "Capacidad (h/sem)" en la configuración de empleados: la capacidad se deriva de las horas por día (L–D). Utilidad: `getWeeklyHoursFromSchedule()` en `dateUtils.ts`.
- `workSchedule`: Objeto que define las horas por día (`monday`: 8, `friday`: 6, etc.).
- `user_id`: Enlace con `auth.users` de Supabase para autenticación.

### 2.3. Proyecto (`Project`)
Contenedores de trabajo facturable o interno.
- `budgetHours`: Horas presupuesto del proyecto (total contrato; en **Entregables** la rentabilidad por mes puede usar horas prorrateadas por fase salvo `budgetOverride` en el deadline del mes).
- `minimumHours`: Suelo de horas que el equipo debe cumplir.
- `monthlyFee`: Fee en euros usado por defecto en rentabilidad mensual (retainers: fee del mes; entregables: referencia mensual y, si no hay `deliverable_contract_fee`, **total del contrato** al prorratear ingreso por mes).
- `projectType`: Opcional. Valores habituales en preset: `PPC`, `Entregable`, `Mensual`. Si es **`Entregable`**, opcionalmente `deliverable_contract_fee`, `deliverable_start_date` y `deliverable_due_date` definen el total y la ventana de la fase; el ingreso reconocido por mes en rentabilidad se calcula con solape de días de calendario (`getEffectiveMonthlyFee(project, mes)` en `budgetUtils.ts`).
- `deliverableContractFee` (BD `deliverable_contract_fee`): Total € del contrato entregable; `NULL` = usar `monthlyFee` como total al prorratear.
- `deliverableStartDate` / `deliverableDueDate` (BD `deliverable_start_date` / `deliverable_due_date`): Inicio y fin inclusivos de la fase. Sin ambas fechas, el entregable se trata como fee fijo mensual (`monthlyFee` cada mes).
- `status`: `active`, `archived` o `completed` (en código; la UI usa Activo / Archivado / Completado).
- `responsibleDepartmentId`: Opcional. ID del departamento responsable; usado para filtrar proyectos en reportes por vista departamento.

### 2.3b. Deadline (`Deadline`)
Define la foto mensual de un proyecto.
- `projectId`: Proyecto asociado.
- `month`: Mes en formato `YYYY-MM`.
- `employeeHours`: Distribución de horas por empleado.
- `budgetOverride`: Sobrescribe `project.budgetHours` solo para este mes (Regularización). Permite reducir o aumentar las horas objetivo del proyecto en ese mes (ej.: 30 h contratadas pero este mes 28 h por acuerdo con el cliente).
- `isHidden`: Si el proyecto se oculta en la planificación de este mes.

> **Nota:** La columna histórica `deadlines.recognized_revenue` puede existir en bases ya migradas; la app actual **no** la usa para métricas. El ingreso por mes de entregables viene del proyecto (fechas + total).

**Multi-tenant**: La tabla `deadlines` no tiene `agency_id`; la agencia se deduce por `project_id` (proyectos son por agencia). Cuando varias agencias comparten el mismo Supabase, **todas** las lecturas de deadlines deben filtrar por agencia usando join con `projects` y `projects.agency_id`. La utilidad centralizada es `fetchDeadlinesForMonth(monthKey, agencyId)` en `src/utils/deadlineUtils.ts`. El hook `useDeadlines({ agencyId })` y todos los componentes que cargan deadlines usan esta función para no mezclar datos entre agencias. "Resetear mes" y "Copiar del mes anterior" en DeadlinesPage también están acotados a la agencia actual. **"Copiar del mes anterior" solo copia proyectos `active`** (`selectDeadlinesToCopyFromPreviousMonth`); los completados/archivados no se arrastran. La lista de Deadlines muestra activos y, además, no activos que ya tengan deadline en el mes (para poder editar/borrar huérfanos).

**Regla de visualización**: Siempre que una vista muestre **horas totales**, **presupuesto** o **total del proyecto** para un mes concreto, debe usarse el **presupuesto efectivo** de ese mes (p. ej. `getEffectiveBudget(project, deadline)` en `src/utils/budgetUtils.ts`), de modo que se respeten los ajustes del Deadline (`budgetOverride`). Para **ingreso / fee en rentabilidad** del mes, usar `getEffectiveMonthlyFee(project, fechaMes)` (entregables según fechas y total en `Project`; resto `monthlyFee`). Rentabilidad, Radar, exportes y `useProjectMetrics` siguen pasando deadlines del mes para el presupuesto en horas; el fee efectivo usa el mes calendario y el proyecto.

### 2.4. Asignación (`Allocation`)
La unidad fundamental de planificación semanal.
- `hoursAssigned`: Horas planificadas por el manager.
- `hoursActual`: Horas reportadas por el empleado.
- `hoursComputed`: Horas validadas o calculadas (usadas en métricas finales).
- `weekStartDate`: Fecha (Lunes) o primer día laborable del mes (en semanas partidas).
- `status`: `planned`, `completed`, `active`, `in_progress`.
- `focusDate` (BD `focus_date`): Fecha `YYYY-MM-DD` en que el empleado marca la tarea **en foco** para su vista diaria; `null` = solo backlog semanal. **No** sustituye a `hoursAssigned` ni afecta a métricas financieras. El “hoy” lo resuelve el navegador del usuario al filtrar.
- `userPriority`: Orden personal en backlog (menor = más arriba); reutilizado en `MyDayView` para subir/bajar.

#### Anotaciones (`AllocationNote` / tabla `allocation_notes`)
- Historial **append-only** por tarea (`allocation_id`): instrucciones, idiomas, enlaces, criterios. El **`taskName`** debe ser corto y escaneable.
- **Distinto de:** `weekly_feedback.comments` (justificación de cierre Weekly), `time_entries.notes` (registro de cronómetro), `allocations.description` (legacy, ya no se escribe desde la app).
- **UI:** `TaskNotesPanel`, `TaskNotesTrigger`; hooks `useAllocationNotes`, `useAllocationNoteCounts`; Realtime en `AppLayout` vía `useAllocationNotesRealtime`.
- **Permisos:** cualquier miembro de la agencia puede añadir notas en tareas visibles; borrar solo autor o admin de agencia (`can_access_agency_settings`).
- **Ciclo de vida:** RPC `copy_allocation_notes` en rollover, transferencia (modo distribute/rollover) y flujos Weekly cliente (`useWeeklyCloseMutations`).

---
