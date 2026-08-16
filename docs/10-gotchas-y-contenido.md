
## 10. Gotchas y Patrones Problemáticos Conocidos

### 10.0 Tras un deploy: errores de chunk / “hay que Ctrl+R”
**Síntoma**: tras publicar frontend, usuarios con la app abierta (o `index.html` cacheado) ven fallos al navegar (`Failed to fetch dynamically imported module`, pantalla de error de ruta) hasta vaciar caché o forzar recarga.

**Causa**: Vite genera JS/CSS con hash (`assets/DeadlinesPage-abc123.js`). Un deploy borra los hashes viejos. El navegador sigue con el bundle anterior y pide chunks que ya no existen.

**Mitigación en app (código)**:
- `src/lib/chunkReload.ts` + listener `vite:preloadError` en `main.tsx` (API Vite 5).
- `lazyWithRetry` (`src/lib/lazyWithRetry.ts`) recarga **una sola vez** por pestaña (`sessionStorage`) si falla un import dinámico.
- `RouteErrorBoundary` también dispara esa recarga en errores de chunk.

**Mitigación en servidor (imprescindible)**: `index.html` **no** debe cachearse agresivamente; los `/assets/*` con hash sí (immutable).

En producción (Pi) el frontend se sirve con `npx serve -s` (`mi-planificador` → `Timeboxing/dist`). La config va en [`public/serve.json`](../public/serve.json) (Vite la copia a `dist/` en cada build):

- `/` e `*.html` → `Cache-Control: no-cache, no-store, must-revalidate`
- `/assets/**` y estáticos hasheados → `public, max-age=31536000, immutable`

Ejemplo nginx (si se sustituye `serve` algún día):

```nginx
location = /index.html {
  add_header Cache-Control "no-cache, no-store, must-revalidate";
}

location /assets/ {
  add_header Cache-Control "public, max-age=31536000, immutable";
  try_files $uri =404;
}

location / {
  try_files $uri $uri/ /index.html;
}
```

Si hay CDN/Cloudflare delante: regla equivalente (HTML/bypass cache para `/` e `index.html`; cache largo solo para `/assets/*`). Cloudflare ya marca HTML como `DYNAMIC` en taimbox.com; igual conviene el header en origen para el navegador.

### 10.0b Mes “anterior” al abrir o cambiar de página
El mes del planificador/dashboard/rentabilidad/etc. se compartía en **`localStorage.planner_date`**: si alguien miraba un mes pasado, al volver otro día seguía ahí. Ahora es **`sessionStorage`** + formato `yyyy-MM` (`src/utils/plannerMonthStorage.ts`): misma pestaña = mes compartido entre vistas; nueva visita = mes actual. Deadlines no usa esta clave (estado local propio). Al escribir el mes se emite `taimbox:planner-month-change` para sincronizar banner y hooks en la misma pestaña.

### 10.0c Tests y datos de lectura
- **Fixtures en el repo** (`src/test/fixtures/`): datos sintéticos; los tests unitarios siempre corren.
- **Contraseñas / URLs de BD**: nunca en git. Opcional: env local o secreto `TAIMBOX_READONLY_DATABASE_URL` + rol `taimbox_ci_readonly` (`scripts/create-ci-readonly-role.sh`). Sin eso, los smoke live se saltan. Detalle: [docs/05](05-integraciones-automatizacion.md) (§ Acceso solo lectura).

### 10.1 Keys duplicadas en listas con datos potencialmente duplicados
**Archivo afectado**: `GlobalPlanningInconsistencies.tsx`

Si iteras sobre arrays que pueden tener entradas duplicadas (ej. empleados en múltiples deadlines), usa índice en la key:
```tsx
// ❌ MAL - puede generar warning si hay duplicados
{items.map(item => <div key={item.id}>...</div>)}

// ✅ BIEN - el índice garantiza unicidad
{items.map((item, index) => <div key={`${item.id}-${index}`}>...</div>)}
```

### 10.2 Prefijos en keys para evitar colisiones entre entidades
Si un mismo UUID puede aparecer como `projectId` Y como `employeeId` en diferentes niveles del árbol DOM:
```tsx
key={`proj-${inc.projectId}`}  // Para proyectos
key={`emp-${emp.employeeId}`}  // Para empleados
```

### 10.3 Eliminación de empleados y miembros (limpieza en BD)
Al eliminar un empleado **debe borrarse todo rastro en la base de datos**. No se debe solo ocultar en UI.
- **Función en BD**: `cleanup_employee_data(p_employee_id uuid)` (migración `20260414130000_cleanup_employee_data_and_admin_delete_agency.sql`) elimina o desreferencia: `active_timers`, `timer_sessions`, `time_entries`, `task_transfers`, `weekly_feedback`, `user_routines`, `professional_goals`, `project_editing_locks`, `absences`, filas y referencias en `global_assignments`, `allocations` (tras anular FKs cruzadas), y actualiza `deadlines.employee_hours` y `team_events.affected_employee_ids`. Comprueba que el llamador pertenece a la misma agencia que el empleado (o es `platform_admin`). No borra la fila `employees`.
- **Flujo equipo**: `purgeEmployeeRowAndRelatedData` en `src/utils/employeeDeletionUtils.ts` ejecuta el RPC y luego `DELETE` en `employees`. `AppContext.deleteEmployee` solo llama a `delete-user` (Edge) si el usuario **no** tiene más filas en `employees` ni en `user_agencies`.
- **Gestión de agencia**: Si el miembro **no** tiene otra agencia, `removeUserFromAgencyUtil` desvincula, purga empleado e invoca `delete-user`. Si tiene otras agencias, solo desactiva y quita `user_agencies` para esa agencia.
- **Estado local**: Tras el borrado se actualizan `employees`, `allocations`, `absences`, `weeklyFeedback`, `userRoutines` y `teamEvents` en contexto.
- **Agencias (admin plataforma)**: RPC `admin_delete_agency(p_agency_id)` borra datos de la agencia y registra el purge en `platform_audit_logs`. La Edge Function `admin-delete-agency` cancela Stripe si existe (fallo real → 502 y no purga; `resource_missing` → continúa), exige `STRIPE_SECRET_KEY` si hay `stripe_subscription_id` (503 si falta), llama al RPC con JWT del admin y hace limpieza best-effort de usuarios Auth sin más agencias. **Irreversible.**

### 10.4 Informe de coherencia (GlobalPlanningInconsistencies)
- **Un empleado, una fila por proyecto**: La lista "Empleados afectados" se construye con un `Map` por `employeeId` por proyecto, de modo que cada persona aparece como máximo una vez por proyecto (evita duplicados donde en una fila salía "en deadline" y en otra "no en deadline").
- **Uso en Seguimiento operativo**: Si se pasa **`hideProjectSearch={true}`** (y opcionalmente **`searchQuery`**), el componente no muestra la sección "Filtros y búsqueda" (input de búsqueda y dropdown de proyecto); solo el **filtro por empleado** con control tipo combobox (área clicable, lista con búsqueda). La búsqueda global de Seguimiento operativo se aplica vía `searchQuery`. Así se evita redundancia y el desplegable que obligaba a usar la flecha.
- **Empleados inexistentes**: Si por datos antiguos o fallo de migración quedara algún `employee_id` sin correspondencia en `employees`, no se muestra "Desconocido": se excluyen esas filas (red de seguridad; la solución correcta es la limpieza en BD, ver 10.3).

### 10.5 Robustez en mapeos y búsquedas (find/map)
- **Fallbacks en Contextos/Hooks**: Siempre asume que las listas (`allocations`, `employees`, `pendingTransfers`) pueden ser `undefined` durante la carga inicial o en entornos de prueba/demo.
- **Patrón Recomendado**:
  ```tsx
  // Mal
  const item = list.find(x => x.id === id); 
  
  // Bien
  const item = (list || []).find(x => x.id === id);
  ```
- **DemoContext**: Al crear proveedores de demo, asegúrate de que todas las propiedades requeridas por el contexto original estén presentes (aunque sean arrays vacíos o funciones dummy) para evitar que los componentes hijos fallen al intentar desestructurarlas o llamar a sus métodos.
- **Datos de demo (landing)**: Los datos de la demo viven en `src/data/demoData.ts` (`demoEmployees`, `demoClients`, `demoProjects`, `demoAllocations`, `demoDeadlines`). Las asignaciones usan `weeks[0]`…`weeks[n]` (lunes de cada semana del mes actual). Para que la demo se vea bien en cualquier pestaña del planificador (semana 1 a 4 o 5), `demoAllocations` debe incluir entradas para **todas** las semanas del mes (`weeks[2]`, `weeks[3]` y, si aplica, más); si solo se rellenan las primeras semanas, las pestañas de semanas 3 o 4 quedarán vacías.
- **Fallback en la llamada**: Asegura que el objeto sobre el que llamas a `.find()` o `.map()` no sea undefined: `const myData = (breakdown || []).find(...)`
- **Garantizar arrays en hooks**: En `useAllocationSheet`, las funciones que devuelven datos calculados deben asegurar que el origen de iteración sea siempre un array para evitar crashes durante el re-renderizado: `(Object.entries(breakdownMap) || []).map(...)`

### 11. Mantenimiento de Contenido y Terminología
#### 11.1 Terminología Consistente
Para mantener la coherencia en toda la plataforma y el material de marketing, se deben usar siempre los mismos términos:
- **Weekly Forecast**: Se prefiere este término (en singular) frente a "Weeklys Forecast".
- **Horas Computadas**: El término técnico para las horas validadas tras el proceso de Weekly.
- **Team Pulse**: Nombre del sistema de métricas de salud y carga del equipo.

#### 11.1b Copy de precios (home y `/precios`)

- **Fuente única:** `src/locales/{es,en}/landing.json` → claves `pricing.plans.*` (límites de personas, extras en USD con símbolo **después** del número, p. ej. `+5 $/extra`).
- **Layout:** `src/config/publicPricingLayout.ts` (home: 4 tarjetas sin Scale; `/precios`: 3+2). Importes numéricos en `publicPricing.ts`.
- **No duplicar** planes en `homeLiteral.json` ni copy suelto en componentes: `LandingBelowSection07` y `PreciosPage` leen el mismo i18n.
- **Enterprise vs Scale:** Enterprise = **>100 personas** o requisitos enterprise (SLA/SSO/DPA); Scale = multi-agencia / ~100 en producto — no mezclar con narrativa antigua “holdings +50”.
- Matriz producto (gates reales): [16-planes-suscripcion-precios.md](16-planes-suscripcion-precios.md).

#### 11.2 Guía de funcionalidades (GuiaPage) y landings de producto
- **Secciones de la guía**: La guía pública (`/guia`, `GuiaPage.tsx`) define el orden, iconos y gradientes en `SECTION_META`; los **títulos y subtítulos** del índice y la navegación prev/siguiente están en i18n (`guide.sections.<slug>` y claves `guide.*` en `src/locales/es|en/landing.json`). El cuerpo largo de cada sección sigue en `CONTENT_MAP` (principalmente en español). Actualmente: planificador, mi-espacio, deadlines, informes, weekly-forecast, equipo, **tiempos**, clientes-proyectos, configuracion, etc. La sección **Tiempos** documenta el cronómetro por tarea, la página Tiempos (Equipo), el total del día en sidebar y el flujo iniciar/parar.
- **Monitor PPC** (`/monitor-ppc`, `PpcMonitorLandingPage.tsx`): en el bloque **Proyección a fin de mes** se usa `PpcMonitorPacingChart` (`src/components/landing/PpcMonitorPacingChart.tsx`): gráfico conceptual de pacing (gasto acumulado vs ritmo ideal lineal del mes), animación en bucle continuo con **hold al final (~10s)**. El gráfico muestra el **Δ en corchetes** integrado en el SVG (diferencia entre gasto acumulado estimado y presupuesto de referencia) para atacar el punto de dolor. La curva de **gasto acumulado** se representa en sentido ascendente (para lectura intuitiva) y la etiqueta del punto muestra **importe acumulado estimado en €** (referencia conceptual sobre presupuesto de 10.000€). La sección “Herramientas avanzadas” coloca Forecast en una franja destacada; debajo del mock, un bloque **Calculadora de Previsiones** (título en **ámbar** sobre panel morado/indigo, párrafo explicativo). **Segmentación** y **Holdings** van en dos columnas (`items-start`) con **título + párrafo** bajo cada mock. Los componentes `MockSegmentation` / `MockHoldings` son compactos: panel interior unificado, separador horizontal “Reglas aplicadas” en segmentación, y lista de subcuentas en holdings; bordes interiores con `border-white/10` (evitar opacidades tan bajas que el navegador caiga en gris por defecto).
- **Consistencia con landings**: Las landings de funcionalidades (`TeamArticle`, `PlannerArticle`, `EmployeeDashboardArticle`, `ReportsArticle`) mencionan y enlazan a la guía donde procede (ej. "Ver guía: Tiempos" → `/guia/tiempos`). El menú desplegable de features (`FeaturesDropdown`) describe "Gestión de Equipos" como "Horarios, ausencias, capacidad y tiempos en vivo". Al añadir una nueva sección de guía o feature, actualizar las landings que la referencien y el dropdown si aplica.

#### 11.3 Alineación del copy con el MVP (Landings y presentaciones)
El copy de landings y presentaciones comerciales debe reflejar exactamente lo que hace el MVP, para evitar expectativas falsas y churn. Taimbox en fase MVP se posiciona como **copiloto inteligente**: pone los datos en pantalla y da sugerencias precisas para que el manager tome la decisión en segundos.

- **Reasignación**: Prometer "Reasignación ágil en 1 clic", no "Drag & drop para reasignar".
- **Dependencias**: "Control estricto de bloqueos", "Identifica qué tareas impiden avanzar", "Gestión de dependencias integrada". Evitar "Mapa visual de dependencias", "Notificaciones en cascada".
- **Weekly Forecast / redistribución**: "Asistente de redistribución rápida"; "El sistema te muestra quién tiene horas libres para que redistribuyas el trabajo en segundos". No prometer redistribución automática por el sistema.
- **Alertas**: "Indicadores visuales de sobrecarga", "Alertas de desviación de presupuesto", "Recordatorios de cierre de mes". En producto: hay **toasts en app** (Sonner, abajo a la derecha, por encima de modales) para feedback de acciones; no prometer **notificaciones push móviles** ni email si no están en el MVP.
- **Informes cliente/PDF**: No mencionar "Informes por cliente" o "Exportar PDF con un clic" en la landing de Reportes si la funcionalidad no está en el MVP; centrar en "Salud Financiera de la Agencia".
- **Sugerencias de asignación**: Destacar el "Asistente inteligente de reasignación": el sistema detecta quién está saturado y sugiere con nombre y apellido a quién pasarle la carga, cruzando los proyectos que tienen en común.
- **Sugerencias de redistribución (Deadlines)**: Comunicado en varias landings para maximizar visibilidad: ficha "Deadlines" del carousel y demo en `LandingPage.tsx`; sección Deadlines ampliada en `ProjectsArticle.tsx` (control-proyectos) con bloque "wow" (sugerencias inteligentes, condicionantes, lista de ventajas); `PlannerArticle.tsx` (asignación con contexto + mención a Deadlines con condicionantes); `ReportsArticle.tsx` (Forecast + bullet "Misma lógica en Deadlines: sugerencias con condicionantes y impacto"); `FeaturesDropdown.tsx` (descripción "Objetivos mensuales y sugerencias de redistribución"). Destacar: solo entre empleados que comparten proyectos; condicionantes (quién cede, techo de carga receptor, suelo de quien cede); resumen de impacto y cargas resultantes. Algoritmo y fórmulas: lógica en DeadlinesPage y hooks de redistribución. No prometer redistribución automática; el manager decide.
- **Webhooks/CRM**: Hablar de "Sincronización de tiempos con tu CRM/ERP vía API" y "Exportación CSV/JSON a sistemas externos", no de "Webhooks en tiempo real" ni de una sincronización CRM/ERP nativa si no se ofrecen públicamente.
- **Pasada de honestidad (julio 2026)** — reglas vigentes tras auditoría de claims vs producto real:
  - **Formatos de export**: solo **CSV y JSON** (más API). No prometer **PDF** ni **Excel/xlsx** (no existen en producto; el hub `/exportacion-informes` genera JSON/ZIP).
  - **Sync de Ads**: es **horaria** (cron `0 * * * *` en `scripts/cron-ads-sync.sh`), nunca "cada 15 min" ni "tiempo real".
  - **Seguridad**: cifrado "en tránsito (TLS) y en reposo", **nunca** "extremo a extremo"; sin certificaciones SOC 2/ISO propias ni "servidores certificados"; evitar absolutismos tipo "criptográficamente/matemáticamente imposible" (decir: el motor de BD rechaza el acceso por RLS).
  - **Sin claims de**: SSO, calendarios externos, "comunidad activa", soporte 24/7, uptime 99,9% (los Términos ya no fijan SLA en planes estándar; ver `/seguridad`).
  - **Naming de planes**: siempre Free/Team/Agency/Scale/Enterprise en copy público (los `plan_id` internos starter/pro/business/scale/enterprise no se muestran); umbral Enterprise ~100 personas.
  - **Cifras**: no usar porcentajes de resultado sin fuente (+40%, 94% fiabilidad, −1h/día…); usar hechos del producto ("En vivo", "1 clic", "cada hora", "2 plataformas Ads").
  - **Privacidad/legal**: subencargados reales = infraestructura propia UE + Stripe, Resend, Google, Meta (sin AWS/Supabase cloud); facturación solo **mensual**; portabilidad por email o API según plan.

Archivos afectados al cambiar copy: `LandingPage.tsx` (carousel), `ProjectsArticle.tsx`, `PlannerArticle.tsx`, `ReportsArticle.tsx`, `TeamArticle.tsx`, `IntegrationsArticle.tsx`, `PresentationPage.tsx`, `PresentationMockups.tsx`, `DeadlinesTour.tsx`, `FeaturesDropdown.tsx`. Algoritmo de sugerencias: ver lógica en DeadlinesPage y useDeadlines/redistribución.

#### 11.3a Notificaciones, motor de reglas y toasts
- **Campanita (`NotificationBell`)**: Lista del `NotificationContext`, persistida en `tb_inbox_{agencyId}_{userId}` (historial local, máx. 50). Las reglas automáticas añaden entradas con `pushSystemNotification`; al pulsar una fila, enlaces internos (`/`…) se navegan con `pathname` + `search` + `hash`. Las de **presupuesto** incluyen `projectId` y `link` a `/clients?projectId=` o `/projects?projectId=` (misma preferencia que el sidebar: clientes si el permiso lo permite). Si un aviso antiguo no trae query en `link` pero sí `projectId`, se reconstruye el enlace; además se pasa `state.focusProjectId` como respaldo si la URL perdiera la query. `ClientsAndProjectsPage` usa `?projectId=` o ese `state` para filtrar a un proyecto, expandir cliente (real o virtual por aliasing) y scroll a `project-focus-<id>`. Migración one-shot desde la clave legacy `notifications` si aún existía.
- **Reglas en cliente**: `useNotificationEngine` + `NotificationEngineHost` (hijo de `NotificationProvider`). Condiciones: presupuesto superado (equipo/agencia + proyectos); recordatorio semanal solo **jueves**, mínimo **2** tareas `planned` sin horas reales; fin de mes si faltan ≤3 días y permiso a deadlines. Sin toasts para estas reglas. Re-ejecución al cambiar datos y al `focus` / `visibilitychange`.
- **Estado de deduplicación**: `src/lib/notificationState.ts` — `tb_notify_state_{agencyId}_{userId}` (`budgetAlerts`, `deadlineAlerts`, `lastWeeklyReminderWeekKey`); evita repetir el mismo aviso hasta nueva ventana lógica. Migración desde claves legacy (`budget_alert_projects`, etc.).
- **Toasts (Sonner)**: `src/lib/notify.ts` es la fachada; el `<Toaster />` está en `src/components/ui/sonner.tsx` (posición `bottom-right`, `z-index` alto para verse sobre `Dialog`). Estilo **neutro** (tarjeta blanca / slate en oscuro, tipografía normal), sin fondos verdes/rojos por tipo. **`expand`**, `gap` y `visibleToasts` configurados para que varios avisos se apilen en columna sin solaparse (evita el modo “mazo” por defecto de Sonner). Import `toast` desde `@/lib/notify` o `useToast` / `toast` legacy en `@/hooks/use-toast`.
- **Roadmap**: tabla `notifications` en Supabase + Realtime + RLS para campanita sincronizada entre dispositivos; triggers o Edge Functions que inserten filas ante eventos (asignación, etc.).

#### 11.3b Tours guiados (onboarding)
La app incluye tres tours que se muestran una vez por usuario (estado en `employees`: `welcome_tour_completed`, `deadlines_tour_completed`, `planner_tour_completed`) y en `localStorage` para comprobación rápida.

| Tour | Componente | Página / contexto | data-tour (targets) |
|------|------------|-------------------|---------------------|
| **WelcomeTour** | `src/components/employee/WelcomeTour.tsx` | EmployeeDashboard (Mi Semana) | add-tasks, weekly-button, crm-export, internal-tasks, goals, absences, calendar, priority-widget, dependencies-widget, planning-inconsistencies, collaboration-cards, projects-summary, monthly-balance, reliability-index; usa tab y **solo en móvil** abre `actions-dropdown` para CRM/objetivos/ausencias; en escritorio esos targets son botones visibles en cabecera. |
| **DeadlinesTour** | `src/components/deadlines/DeadlinesTour.tsx` | DeadlinesPage | month-selector (DeadlinesPageHeader), filters (DeadlinesFilters), availability-panel (DeadlinesAvailabilityCard), project-list, inline-editing, concurrent-editing (DeadlinesProjectList), global-assignments (DeadlinesSidebar), suggestions (DeadlinesSuggestionsPreview). |
| **PlannerTour** | `src/components/planner/PlannerTour.tsx` | AllocationSheet (al abrir detalle de empleado/semana desde PlannerGrid) | planner-view-toggle, planner-week-nav, planner-projects, planner-task, planner-task-name, planner-checkbox, planner-hours, planner-dependency, planner-sort, planner-add-task. |

Al cambiar la UI de una pantalla (nuevos filtros, reordenación, móvil con Sheet), revisar los pasos del tour y los `data-tour` en los componentes correspondientes para que los targets sigan existiendo y las descripciones sigan siendo correctas. Hooks: `useWelcomeTour`, `useDeadlinesTour`; PlannerTour no tiene hook público, se controla por estado en BD y localStorage (`timeboxing_planner_tour_completed`).

#### 11.4 Calidad del Copy y Ortografía
Al añadir nuevas secciones a las landing pages o guías, se debe prestar especial atención a:
- **Acentos en mayúsculas y minúsculas**: Palabras como *día, más, catálogo, módulo, verás, podrá* deben llevar siempre su tilde correspondiente.
- **Evitar Spanglish innecesario**: Usar "cliente" en lugar de "client" y "horas" en lugar de "hours" en el contenido dirigido al usuario final.
- **Consistencia en Títulos**: Los títulos de secciones en la `GuiaPage` deben seguir una jerarquía lógica y revisarse para evitar errores ortográficos tras actualizaciones.
