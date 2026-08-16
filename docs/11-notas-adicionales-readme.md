# Notas adicionales (rescate README histórico)

Contenido extraído del README detallado antes del escaparate ligero. Lo canónico sigue en `docs/01`–`docs/10`; esto cubre huecos (inventario de páginas, servicios locales, config, fragmentos de checklist UI) o referencias que no estaban duplicadas allí.

---

<details>
<summary><h2>📄 Fase 6: Páginas (24 archivos)</h2></summary>

Todas las páginas principales de la aplicación.

### Planificación y Operaciones
| Página | Tamaño | Descripción |
|--------|--------|-------------|
| `EmployeeDashboard.tsx` | 40KB | Vista personal del empleado: **Mi semana** (calendario mensual + pestañas) o **Mi día** (`MyDayView`, con acceso **Weekly** por tarea vía `focusAllocationId` si la integración está activa). Toggle según `useDashboardView`. Toolbar unificada: toggle a la izquierda, acciones primarias (Weekly, Añadir tareas, Tarea interna) en el centro, acciones secundarias en dropdown "Más". **Móvil**: Dialog→Sheet para "Gestión interna" y "Añadir tareas"; navegación mes con botones ≥44px. |
| `DeadlinesPage.tsx` | ~680 líneas | Gestión de fechas límite mensuales. **Datos**: `useDeadlinesPageData.ts` (carga, Realtime, locks, filtros, capacidad). **Edición inline**: `useDeadlinesEditing.ts` (locks, formulario inline, autoSave). **Sugerencias**: `useDeadlinesRedistribution.ts`. **Filtros** en `DeadlinesFilters.tsx`; **listado** en `DeadlinesProjectList.tsx`. **Extraídos**: `DeadlinesPageHeader.tsx`, `DeadlinesSidebar.tsx`, `DeadlinesProjectEditSheet.tsx`, `DeadlinesConfirmDialog.tsx`. Ver [`docs/02-entidades-modelos.md`](./docs/02-entidades-modelos.md). **Móvil**: filtros y edición en Sheet. |
| `WeeklyForecastPage.tsx` | — | Previsión mensual: historial de allocations (`ActivityLogSection`) y redistribución de horas (`useWeeklyForecastRedistribution`); mes y filtros depto con `useWeeklyForecastMonthData` + `useWeeklyForecastFilters`. |
| `TeamCapacityDashboard.tsx` | — | Vista de carga del equipo (`/capacidad`; redirect desde `/team-capacity`) |
| `TeamPage.tsx` | 4KB | Listado de empleados |
| `TeamPulsePage.tsx` | 14KB | Métricas de salud del equipo |

### Clientes y Proyectos
| Página | Tamaño | Descripción |
|--------|--------|-------------|
| `ClientsAndProjectsPage.tsx` | ~2280 líneas | Gestión dual cliente/proyecto; rutas **`/clients`** y **`/projects`** apuntan aquí. **Filtros** en `ClientsAndProjectsFilters.tsx` (búsqueda, estado, tipo, empleado, análisis); página usa `filterSnapshot` vía `onFiltersChange`. Las páginas legacy `ClientsPage` / `ProjectsPage` se retiraron del repo. |
| `OkrsPage.tsx` | 41KB | Objetivos y resultados clave |

### Reportes y Analytics
| Página | Tamaño | Descripción |
|--------|--------|-------------|
| `FinancialHealthPage.tsx` | ~35KB | Rentabilidad (ruta `/finanzas`): Buscador, KPIs, Radar de hemorragias, tabs Resumen/Proyectos/Empleados. Incluye **contexto mes** (badge Mes en curso / Mes cerrado), **ingreso devengado** en mes en curso, columna **Ritmo (pacing)** y fallback de coste dinámico cuando &lt;25% del mes. |
| `OperationsRadarPage.tsx` | — | Seguimiento operativo: **una sola búsqueda** en cabecera (aplica a ambos paneles). Coherencia sin filtros locales de proyecto (solo filtro por empleado tipo combobox). Estado de proyectos: **por defecto Todos**; modos Todos | Aviso bajo y en regla | Solo con avisos; desplegables con ritmo necesario (h/día) y enlace a Deadlines. Vista por departamento del Sidebar. |
### Publicidad (Ads)
| Página | Tamaño | Descripción |
|--------|--------|-------------|
| `AdsPage.tsx` | 67KB | Integración Google Ads |
| `MetaAdsPage.tsx` | 46KB | Integración Meta/Facebook Ads |

### Configuración
| Página | Tamaño | Descripción |
|--------|--------|-------------|
| `AgencySettingsPage.tsx` | 60KB+ | Configuración de agencia por secciones: General, Equipo (roles), **Departamentos** (nombre + color por área), Proyectos (filtros/aliasing), Módulos, Integraciones (**Google Ads OAuth** + **Meta Ads OAuth**), Apariencia, **Plan y facturación** (Stripe). Navegación lateral; pestaña activa por `?tab=`. |
| `SettingsPage.tsx` | 6KB | Preferencias de usuario |
| `AgenciesPage.tsx` | 8KB | Selector de agencias |
| `AgencyManagementPage.tsx` | 19KB | Administración avanzada de agencia |
| `ApiKeysPage.tsx` | ~15KB | Gestión de tokens API por agencia (crear, listar, revocar). Ruta `/api-keys`. |
| `GoogleCallbackPage.tsx` | ~2KB | OAuth Google Ads: captura `?code=`, invoca `oauth-google-ads`, redirige a `/agency?tab=integrations`. Sin AppLayout. |
| `MetaCallbackPage.tsx` | ~2KB | OAuth Meta Ads: captura `?code=`, invoca `oauth-meta` (y opcionalmente `list-meta-accounts`), redirige a Integraciones. Ruta `/meta-callback`. Sin AppLayout. |

### Área administrativa (solo plataforma)
| Página / Ruta | Descripción |
|---------------|-------------|
| `/admin` | Redirige a `/admin/agencies`. Solo accesible si el usuario está en `platform_admins` (RPC `is_platform_admin`). |
| `/admin/agencies` | Listado de agencias con columnas Plan, Suscripción y Trial hasta; filtros por estado y por plan (UI puede mostrar Free/Team/Agency; RPC `admin_set_agency_plan` acepta también `scale` y `enterprise`). Suspender/Reactivar. **Forzar plan**: menú por fila (icono tarjeta). Botón **Entrar**: acceder a la app como esa agencia (ver deadlines, planner, etc. con su contexto). Ver [16-planes-suscripcion-precios.md](16-planes-suscripcion-precios.md). |
| `/admin/admins` | **Administradores de plataforma**: listado de usuarios con acceso a /admin (no vinculados a agencia). Añadir por email (el usuario debe existir en el sistema), quitar acceso. No se puede quitar al último admin. |
| `/admin/support` | Tickets de soporte: listado, filtros, crear ticket, cambiar estado. Botón "Ver" abre detalle con comentarios internos y formulario para añadir respuestas. |
| `/admin/metrics` | Métricas de plataforma: total agencias (activas/suspendidas), empleados, usuarios con agencia, tickets por estado. |
| `/admin/docs` | Documentación interna con procedimientos para el equipo admin. |
| `/suspended` | Página estática cuando la agencia del usuario tiene `status = suspended`. Mensaje y botón "Cerrar sesión". Fuera de AppLayout. |

**App de usuario (soporte):** Ruta `/soporte`: (1) Formulario "Nueva solicitud" que crea un ticket (RPC `create_support_ticket_from_app`). (2) "Mis tickets": listado de tickets de la agencia con estado y fecha; botón "Ver" abre detalle con conversación (respuestas visibles) y formulario para responder (RPCs `list_my_support_tickets`, `get_my_support_ticket`, `list_my_support_ticket_replies`, `add_support_ticket_reply_from_app`). Los mensajes admiten formato con un editor WYSIWYG (barra de herramientas: negrita, cursiva, código); el contenido se guarda como Markdown y se muestra formateado con `SupportMessageContent`. En Configuración hay tarjeta y en Sidebar enlace "Contactar soporte".

**Nota:** Las rutas `/admin/*` no dependen de agencia; el panel usa RPCs con SECURITY DEFINER. **Acceder como agencia:** RPCs `admin_impersonate_agency(p_agency_id)` y `admin_stop_impersonate(p_agency_id)`; columna `is_impersonation` en `user_agencies`. El botón **Entrar** en `/admin/agencies` redirige a `/dashboard?agency=<id>`.

**Frontend (SPA) — mantener contexto sin recargar:** `AgencyProvider` está **por encima** de `BrowserRouter`, así que un cambio de ruta con `?agency=` no re-ejecuta solo el efecto interno del contexto (patrón anti-refetch al refrescar token). Para forzar re-resolución tras salir de `/admin`, el componente **`AgencySearchParamSync`** (`src/components/agency/AgencySearchParamSync.tsx`), montado **dentro** del router en `App.tsx`, detecta cambios del query `agency` y llama a `refreshAgency()`. En **AgencyContext**, si el usuario tiene varias agencias como empleado, un `?agency=` válido en la URL tiene **prioridad** sobre `localStorage` al elegir la fila de empleado (sin sustituir a `is_primary` cuando la impersonación la fija en BD).

**Sidebar en vista de agencia sin perfil de empleado:** Si no existe fila en `employees` para tu usuario en esa agencia, `AppContext` deja `currentUser` indefinido. El **footer** del sidebar (`Sidebar.tsx`) muestra entonces la **sesión Auth**: avatar (`user_metadata.avatar_url` / `picture`), nombre y email, mismos controles de agencia/departamento si aplican, y **Cerrar sesión**. La **línea compacta ámbar** (`SidebarImpersonationPanel`, encima del footer) sigue mostrando el nombre de la agencia en vista admin y el botón para salir de la impersonación (`admin_stop_impersonate`). En móvil el header lleva un borde ámbar sutil mientras dure la vista.

### Otros
| Página | Tamaño | Descripción |
|--------|--------|-------------|
| `PreciosPage.tsx` | — | Página pública de precios (`/precios`): layout en `publicPricingLayout.ts` (fila 1: Free, Team, Agency; fila 2: Scale, Enterprise). Copy y precios USD en `landing.json` → `pricing.plans.*` (misma fuente que la sección de planes en home). CTAs a registro o `/contacto` (Scale/Enterprise). |
| `PrivacyPolicyPage.tsx` | ~11KB | Página pública de Política de Privacidad (`/privacidad`). |
| `TermsOfServicePage.tsx` | ~12KB | Página pública de Condiciones del Servicio (`/condiciones`). |
| `LandingPage.tsx` | ~80KB | Página pública de marketing (home). Usa `LandingHeader` (header fijo unificado con mega-menú `FeaturesDropdown`, enlaces Guía/API/Login, menú hamburguesa móvil). **Footer** con enlace a "Por qué Taimbox" (`/por-que-timeboxing`), **Blog** (`/blog`), demo, guía, API y **Cookies** (abre preferencias RGPD). **Banner de cookies** (`CookieBanner.tsx`): barra intrusiva con overlay RGPD, "Aceptar todas" / "Solo necesarias" / "Personalizar", persistencia en `localStorage` (`timeboxing_cookie_consent`), modal de preferencias. **GTM** `GTM-WSQZRMW7` en `index.html` (toda la SPA). **Google Consent Mode v2**: 4 cookies `timeboxing_gtm_*` (`granted`/`denied`) + dataLayer `cookie_consent_update`; import `gtm/GTM-consent-mode-taimbox.json` y `gtm/README.md`. Ver [`docs/01-arquitectura.md`](./docs/01-arquitectura.md) §1.1b. **Demo interactiva** del planificador: `DemoPlanner` en `src/components/demo/DemoDashboard.tsx` (lazy desde `LandingArticle`). Carousel de features con enlaces a landings comerciales. Schema JSON-LD SoftwareApplication en Helmet. Componentes: `LandingHeader.tsx`, `FeaturesDropdown.tsx`, `LandingFooter.tsx`, `CookieBanner.tsx`. Utilidad: `src/lib/cookieConsent.ts`. |
| `ArticlePage.tsx` | ~3KB | Página pública del artículo largo en `/por-que-timeboxing`. Usa `LandingHeader`. Renderiza `LandingArticle` (6 bloques: Gancho, Teoría, Problema en agencias, Solución con DemoPlanner lazy, Arquitectura/API, CTA). Schema JSON-LD Article + SoftwareApplication. Enlazada desde el footer de la home. |
| `BlogPage.tsx` | ~8KB | Página pública índice del blog en `/blog`. Incluye artículo destacado, buscador por texto, filtros por categoría y grid responsive de artículos (datos en `src/data/blogPosts.ts`). Solo enlazada desde el footer (no en menú principal). |
| `WhatIsTimeboxingPage.tsx` | ~2KB | Artículo "Qué es el timeboxing" en `/blog/que-es-timeboxing`. La ruta antigua `/que-es-timeboxing` redirige aquí (301). Usa `WhatIsTimeboxingArticle`, `LandingHeader`, `LandingFooter`. |
| `PlanificacionProyectosCronogramaRecursosPage.tsx` | ~3KB | Artículo "Planificación de proyectos: cronograma, presupuesto y recursos" en `/blog/planificacion-proyectos-cronograma-recursos`. Usa `PlanificacionProyectosArticle` en `src/components/landing/blog/`. |
| `LeyParkinsonPage.tsx` | ~3KB | Artículo "Ley de Parkinson" en `/blog/ley-parkinson`. `LeyParkinsonArticle`: primera ley, origen burocrático (Marina), segunda ley gastos/ingresos, ley de la trivialidad, evidencia, antídotos. |
| `KpisAgenciasMarketingPage.tsx` | ~3KB | Artículo "KPIs para agencias de marketing: 5 métricas que sí importan en 2026" en `/blog/kpis-agencias-marketing-2026`. Usa `KpisAgenciasMarketingArticle` en `src/components/landing/blog/`. |
| `PlantillaPlanificacionRecursosPage.tsx` | ~5KB | Artículo "Plantilla gratuita de planificación de recursos para agencias" en `/blog/plantilla-planificacion-recursos-agencia`. Diseño oscuro estándar del blog, descarga `public/recursos/plantilla-planificacion-recursos-taimbox.xlsx`, JSON-LD Article + HowTo + FAQPage + SoftwareApplication. Componente `PlantillaPlanificacionRecursosArticle.tsx`. 12 secciones: intro Excel, capacidad bruta/neta, anatomía 4 hojas, fórmula de utilización, pacing y margen, impuesto Excel, techo de cristal, validación/protección, escalado semanal, Sheets vs Excel, evolución Taimbox y FAQ ampliada. |
| `PorQueAgenciaPierdeRentabilidadPage.tsx` | ~5KB | Artículo TOFU "Por qué tu agencia pierde rentabilidad aunque el equipo esté ocupado" en `/blog/por-que-tu-agencia-pierde-rentabilidad-equipo-ocupado`. Copy **sin mencionar Taimbox** (captación orgánica); JSON-LD Article + FAQPage + SoftwareApplication; `OcupacionVsRentabilidadChart`; enlaces a KPIs, Ley de Parkinson, planificación y al artículo BOFU de rentabilidad por proyecto. |
| `ComoMedirRentabilidadProyectoPage.tsx` | ~5KB | Artículo BOFU "Cómo medir la rentabilidad real por proyecto…" en `/blog/como-medir-rentabilidad-proyecto-agencia-dejar-vender-horas`. JSON-LD Article + HowTo (4 pasos) + FAQPage + SoftwareApplication; `ScopeProtocoloInfographic`; soft pitch Taimbox en un solo bloque; enlaces cruzados con artículo rentabilidad TOFU, timeboxing, plantilla Excel, KPIs, Ley Parkinson. |
| `GestionCargaTrabajoEquipoPage.tsx` | ~6KB | Artículo "Cómo gestionar la carga de trabajo de tu equipo sin burnout" en `/blog/gestion-carga-trabajo-equipo-sin-burnout`. Título SEO (Guía 2026) distinto del H1; JSON-LD Article + HowTo (6 pasos) + FAQPage + SoftwareApplication. Componente `GestionCargaTrabajoEquipoArticle.tsx` con tabla resumen, TOC numerado alineado con H2, H2 con icono (`flex items-center gap-3` como KPIs/plantilla), infografías `CargaTrabajoFrameworkVisual` y `SenalesCargaAlertaVisual`, enlaces internos a planificación, Ley de Parkinson y KPIs; CTA editorial sin venta directa. Enlazado desde `WhatIsTimeboxingArticle` con anchor "evitar burnout con timeboxing". |
| `EmployeeDashboardLandingPage.tsx` | ~3KB | Landing comercial pública en `/dashboard-empleado`. Usa `LandingHeader`. Presenta las funcionalidades del dashboard del empleado con 6 secciones y mockups CSS. Componentes: `LandingHeader.tsx`, `EmployeeDashboardArticle.tsx`, `LandingFooter.tsx`. |
| `PlannerLandingPage.tsx` | ~3KB | Landing comercial pública en `/planificador-recursos`. Usa `LandingHeader`. Grid de planificación semanal, asignación con vista de impacto, dependencias y semanas partidas. Componentes: `LandingHeader.tsx`, `PlannerArticle.tsx`, `LandingFooter.tsx`. |
| `TeamLandingPage.tsx` | ~3KB | Landing comercial pública en `/gestion-equipos`. Usa `LandingHeader`. Perfiles de equipo, calendario de ausencias, capacidad mensual y Team Pulse. Componentes: `LandingHeader.tsx`, `TeamArticle.tsx`, `LandingFooter.tsx`. |
| `ReportsLandingPage.tsx` | ~3KB | Landing comercial pública en `/reportes-rentabilidad`. Usa `LandingHeader`. Dashboard de rentabilidad, informes de cliente, weekly forecast y exportaciones. Componentes: `LandingHeader.tsx`, `ReportsArticle.tsx`, `LandingFooter.tsx`. |
| `ProjectsLandingPage.tsx` | ~3KB | Landing comercial pública en `/control-proyectos`. Usa `LandingHeader`. Gestión de proyectos, deadlines mensuales, OKRs y control de coherencia. Componentes: `LandingHeader.tsx`, `ProjectsArticle.tsx`, `LandingFooter.tsx`. |
| `IntegrationsLandingPage.tsx` | ~3KB | Landing comercial pública en `/integraciones`. Usa `LandingHeader`. Google Ads, Meta Ads, API REST y sistema weekly. Componentes: `LandingHeader.tsx`, `IntegrationsArticle.tsx`, `LandingFooter.tsx`. |
| `GuiaPage.tsx` | ~18KB | Guía de funcionalidades pública (`/guia`, `/guia/:section`). Usa `LandingHeader`. Contiene 6 componentes de contenido reutilizables (FeatureCard, ExampleBox, TipBox, WarningBox, StepList, InfoGrid), navegación prev/next entre secciones y contenido detallado para las secciones del producto (planificador, mi-espacio, equipo, tiempos, clientes-proyectos, configuracion, informes, etc.). |
| `ApiDocsPage.tsx` + `api-docs/` | Shell ~3KB + ~30 archivos | Documentación pública de la API (`/api-docs`). Header propio con sidebar lateral (desktop) y Sheet hamburguesa (mobile con enlaces Inicio/Guía para navegar fuera). **Arquitectura modular** en `src/pages/api-docs/` (data, components, sections). Sidebar colapsable con búsqueda (Ctrl+K), 4 grupos: Overview (5), Tutoriales (5), SDK y REST (4), Referencia (17 tablas con ResponseExample JSON). Incluye 5 tutoriales paso a paso, changelog, buenas prácticas de seguridad y ejemplos SDK+cURL por recurso. |
| `PresentationPage.tsx` | ~18KB | **Herramienta de ventas (pitch de ROI)** en `/pitch` (noindex). 15 slides fullscreen: Portada, Contexto, Problema, Coste (15.000€/mes), Before/After, Solución (3 pilares), 6 feature slides, Seguridad, ROI (180.000€/año) y CTA. Enlazada desde: **Hero** de la landing ("El coste de no medir (3 min)"), **CTA final** ("Ver presentación de ROI"), **Footer** (Producto + anclaje de valor "¿Te parece caro? Mira cómo recuperas la inversión") y **Sidebar** de la app (banner para administradores con agencia recién creada). Mockups en `PresentationMockups.tsx`. Navegación ← → teclado, clic lateral, swipe táctil y dots. |
| `Login.tsx` | 16KB | Autenticación con Supabase |
| `Index.tsx` | <1KB | Redirección inicial |
| `NotFound.tsx` | <1KB | Error 404 |

**Uso del pitch como herramienta de ventas (outreach)**  
URL directa para LinkedIn / email en frío: `https://[tu-dominio]/pitch`.  
Mensaje sugerido para Alex: *"Hola [Nombre], he analizado la rentabilidad media de agencias como la tuya y los datos son alarmantes. Te dejo una presentación interactiva de 2 minutos donde desgloso dónde se están perdiendo los márgenes: [enlace a /pitch]"*. Enviar el enlace a la presentación en lugar de la home posiciona consultoría financiera envuelta en software.

</details>

---

### `src/services/errorService.ts`
Manejo centralizado de errores.
- **`handle(error, context, options)`**: Loggea, muestra toast, y opcionalmente reporta a servicio externo.
- **Integración**: Preparado para Sentry/LogRocket (comentado).

### `src/services/auditService.ts`
Sistema de auditoría para cambios críticos.
- **Registra**: Quién hizo qué, cuándo, en qué entidad.
- **Uso**: Cambios críticos que requieren auditoría (configuración, etc.).

---

<details>
<summary><h2>🔧 Fase 8: Configuración y UI Library</h2></summary>

### `src/config/constants.ts`
Centraliza TODOS los valores mágicos del sistema.
- **`TIMEOUTS`**: Delays de autosave, locks, sync (ej. `AUTO_SAVE_DEBOUNCE: 800`).
- **`LIMITS`**: Máximos para paginación/cache (ej. `MAX_LOGS: 50`, `TOP_CAMPAIGNS: 10`).
- **`UI`**: Dimensiones de modales, impresión, charts.
- **`COLORS`**: Semáforos de carga (`HEALTHY`, `WARNING`, `CRITICAL`).
- **`AI`**: Configuración de prompts (temperatura, reintentos).
- **`SYNC`**: Timeouts de sincronización con APIs externas.

### `src/config/integrations.ts`
Define las integraciones disponibles para activar por agencia.
- **`weekly_feedback`**: Modal Weekly con layout master-detail (sidebar de tareas + panel de detalle); progress bar, estados por tarea (○/✓/⚠), tokens del design system. Semanas futuras = mes visible + siguiente; carga del mes siguiente al abrir.
- **`crm_export`**: Exportación de tareas a CRM.
- **`crm_user_id`**: Campo de ID de usuario CRM para empleados.

### `src/components/ui/` (49 archivos)
**Biblioteca UI**: Componentes de Shadcn UI.
- No contienen lógica de negocio.
- Incluyen: `Button`, `Dialog`, `Sheet`, `Table`, `Card`, `Tabs`, etc.
- **`Sidebar.tsx`** (23KB) es el más complejo (navegación principal).

</details>

---

## Fragmentos del checklist de mantenimiento (README)

- [ ] **Mobile**: ¿Verificaste que el cambio se ve bien en `use-mobile`? El panel ya no bloquea acceso en móvil; PlannerGrid y DeadlinesPage tienen vistas específicas (Cards, Sheets). EmployeeDashboard usa Sheet en vez de Dialog en móvil. AllocationSheet tiene padding, botones ≥44px y sidebar oculto en móvil. WeeklyForecast y Reports usan widths responsive. En tamaños intermedios (768–1024px): calendario de Mi espacio con columnas `minmax(140px, 1fr)` y columna empleado 200px para que el contenido quepa sin truncar (scroll horizontal si hace falta); nombre del empleado en 2 líneas (`line-clamp-2`); WeekCell sin ellipsis en datos críticos (etiquetas cortas Gan./Pérd. con tooltip, ratio y horas con `whitespace-nowrap`); bloque Real/Comp en dos líneas para evitar solapamiento numérico; tabs con `min-w` para que "Mis métricas" etc. se lean completos. En `AllocationSheet`, el menú derecho es contextual: en **vista semanal** se muestra como **Ordenar** (sin opciones de visualización) y en **vista mensual** como **Vistas** (incluye "Proyectos expandidos").
- [ ] **Overlays (Select/Dialog)**: Para evitar el desplazamiento del contenido al abrir desplegables, las **páginas** usan **Popover + Command** en lugar de Select (Radix). Patrón de referencia: DeadlinesPage (filtros), BatchTaskRow (selector de proyecto). Si añades un nuevo filtro o selector en una página, usa Popover+Command. Los componentes compartidos (EmployeeDialog, AbsencesSheet, etc.) pueden seguir usando Select dentro de Dialogs/Sheets; si en algún caso se aprecia el mismo salto, aplicar el mismo patrón.

