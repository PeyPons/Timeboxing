
## 5. Integraciones y Automatización

Google Ads y Meta Ads se sincronizan **solo** mediante **Edge Functions** de Supabase (Deno en el contenedor `supabase-edge-functions`), invocadas desde la app, por cron o por automatización que llame a la API de funciones.

### 5.1. Edge Functions (Supabase)

Funciones serverless que corren en Deno dentro del contenedor `supabase-edge-functions`.

#### Inventario de funciones

| Función | Archivo | Descripción |
|---------|---------|-------------|
| `sync-google-ads` | `supabase/functions/sync-google-ads/index.ts` | Sincroniza campañas. Usa credenciales plataforma + refresh token (DB). Si no hay filas en `ad_accounts_config`, obtiene toda la jerarquía del MCC (MCC + sub-MCCs + subcuentas) vía `customer_client` recursivo y sincroniza cada cuenta; si hay filas, solo esas. Escribe en `google_ads_campaigns` con `agency_id`. La API devuelve el coste en **micros** (1 unidad de moneda = 1.000.000 micros); la función convierte dividiendo por 1.000.000 antes de persistir. |
| `oauth-google-ads` | `supabase/functions/oauth-google-ads/index.ts` | **(Nuevo)** Intercambia código OAuth y guarda `refresh_token` en columna de agencia. |
| `exchange-google-token` | `supabase/functions/exchange-google-token/index.ts` | **Retirada (410).** Usar `oauth-google-ads`. |
| `sync-meta-ads` | `supabase/functions/sync-meta-ads/index.ts` | Sincroniza insights a nivel campaña (gasto, clics, conversiones, etc.) vía Graph API; **no** persiste presupuesto diario de Meta en `meta_ads_campaigns` (la integración actual no solicita esos campos). |
| `generate-api-token` | `supabase/functions/generate-api-token/index.ts` | Genera JWT (`iss=timeboxing-api`) con `agency_id`, `permissions` y `scopes` (allowlist de recursos). |
| `revoke-api-token` | `supabase/functions/revoke-api-token/index.ts` | Revoca un token API (marca `is_active = false`). |
| `create-user` | `supabase/functions/create-user/index.ts` | Crea usuario en Auth (body: `email`, `password`, `name`, **`agency_id`**). Exige permiso de invitación en esa agencia (`assertCanInviteToAgency`). |
| `update-user` | `supabase/functions/update-user/index.ts` | Actualiza usuario en Auth. |
| `delete-user` | `supabase/functions/delete-user/index.ts` | Elimina usuario de Auth; antes limpia `user_agencies`, pone `employees.user_id` a null, quita `platform_admins` y `audit_logs` del usuario, y anula `support_tickets.reporter_user_id`. |
| `admin-delete-agency` | `supabase/functions/admin-delete-agency/index.ts` | Solo si `is_platform_admin`: lista `user_agencies` de la agencia; si hay `stripe_subscription_id` sin `STRIPE_SECRET_KEY`, **503**; cancela Stripe con `subscriptions.cancel` — si falla salvo `resource_missing` (suscripción ya inexistente), **502** y no purga; el RPC `admin_delete_agency` se llama con **JWT del admin** (no service role) para `auth.uid()`; registra `agency_purged` en `platform_audit_logs`. Tras éxito, best-effort: `auth.admin.deleteUser` para usuarios sin más `user_agencies` y que no sean `platform_admins`. **Irreversible.** |
| `invite-user-to-agency` | `supabase/functions/invite-user-to-agency/index.ts` | Invita a un usuario existente a una agencia. |
| `register-agency` | `supabase/functions/register-agency/index.ts` | Registra una nueva agencia (alta inicial). Asigna `plan_id = business` (Agency) con trial 14 días si `trial_used_at` es null. Inserta `settings` mínimos (módulos base); el asistente en app completa el resto. Tras el alta, envía aviso interno vía Resend a `REGISTRATION_NOTIFY_EMAIL` (default `alexanderouteiral@gmail.com`; vacío = desactivado). |
| `add-platform-admin` | `supabase/functions/add-platform-admin/index.ts` | Añade un usuario como admin de plataforma. |
| `create-checkout-session` | `supabase/functions/create-checkout-session/index.ts` | Crea sesión de Stripe Checkout para suscripción Team (`pro`) o Agency (`business`); opcional línea de asientos extra. Crea o recupera Customer, devuelve URL. Requiere `STRIPE_SECRET_KEY`. Scale/Enterprise: contacto ventas, no checkout self-serve. |
| `create-billing-portal-session` | `supabase/functions/create-billing-portal-session/index.ts` | Crea sesión del Stripe Customer Portal (body: `agency_id`). Redirige al portal para gestionar tarjeta, facturas o cancelar suscripción. Requiere `STRIPE_SECRET_KEY`. |
| `stripe-webhook` | `supabase/functions/stripe-webhook/index.ts` | Webhook Stripe: actualiza `agencies` (plan_id, subscription_status, trial_ends_at) con `customer.subscription.created|updated|deleted` y marca `past_due` con `invoice.payment_failed`; llama `syncAgencyModulesForPlan`. Requiere `STRIPE_WEBHOOK_SECRET`. Opcional: `STRIPE_PRICE_ID_PRO`, `STRIPE_PRICE_ID_BUSINESS`, `STRIPE_PRICE_ID_SCALE` (y seats) para mapear plan por precio. En el Dashboard de Stripe, incluir también `invoice.payment_failed` en el endpoint del webhook. |
| `expire-trials` | `supabase/functions/expire-trials/index.ts` | Cron: invoca RPC `expire_agency_trials()`. Auth: **solo** `EXPIRE_TRIALS_CRON_SECRET` (Bearer). `verify_jwt = false`. |
| `send-welcome-email` | `supabase/functions/send-welcome-email/index.ts` | **Retirada (410).** El envío real está en `_shared/welcome-and-invitation-email.ts`, invocado desde `register-agency`, `invite-user-to-agency` y `create-user`. |
| `send-contact-email` | `supabase/functions/send-contact-email/index.ts` | Envía email interno a `CONTACT_TO_EMAIL` (default `hello@taimbox.com`) desde el formulario público `/contacto` vía Resend. Body: `{ name, email, subject, message }`. Requiere `RESEND_API_KEY`. La página `src/pages/ContactoPage.tsx` usa `useTranslation('landing')` y las claves `static.contact.seoTitle` / `static.contact.seoDescription` en `src/locales/{es,en}/landing.json` para `SeoTags`. |
| `request-password-reset` | `supabase/functions/request-password-reset/index.ts` | Genera enlace de recuperación (`_shared/password-recovery-url.ts`) y lo envía por email vía Resend. Body: `{ email }`. Rate limit por IP/email (`form_rate_limit_events`). Devuelve 200 en flujo normal (anti-enumeración); **429** si se supera el límite. `config.toml`: `verify_jwt = false`. |
| `notify-task-transfer` | `supabase/functions/notify-task-transfer/index.ts` | Tras crear una solicitud en `task_transfers`, la app invoca con JWT de usuario. Comprueba que el actor sea `from_employee_id`, carga reglas `notification_rules` con `trigger_type = task_transfer_pending`, resuelve destinatarios y envía un correo vía `_shared/resend.ts`. Dedupe en `notification_deliveries` con clave prefijo `task_transfer` + id de transferencia. Requiere `RESEND_*`, `SUPABASE_ANON_KEY`. |
| `process-event-notifications` | `supabase/functions/process-event-notifications/index.ts` | **Con JWT** (`verify_jwt = true`). Tras completar una allocation, solo el **dueño** de la tarea o quien tenga `can_assign_tasks_to_others` / `is_agency_admin` puede disparar emails de dependencias. Comprueba membresía (`user_agencies` o `employees`), respeta `dependencyUnblockEmailsEnabled`, dedupe `dependency_unblock|<allocation_id>`. |
| `process-notification-rules` | `supabase/functions/process-notification-rules/index.ts` | **Sin JWT** (`config.toml`: `verify_jwt = false`). POST con `Authorization: Bearer <NOTIFICATIONS_CRON_SECRET>`. Evalúa reglas `scheduled` (métricas de proyecto alineadas con la vista de análisis en `ClientsAndProjectsPage`), envía alertas y registra envíos en `notification_deliveries`. Body opcional: `{ "agencyId"?: "uuid", "force"?: true, "ignoreDedupe"?: true }`. `force` ignora el filtro de hora UTC. `ignoreDedupe` salta el dedupe temporal en `notification_deliveries` (útil para pruebas manuales; el insert se hace como `upsert` por `agency_id,dedupe_key`). Requiere `NOTIFICATIONS_CRON_SECRET`, `RESEND_*`, `SUPABASE_SERVICE_ROLE_KEY`. Programar con cron (cada hora si usas `schedule_hour_utc` en reglas, o diario). |

#### `verify_jwt` por Edge Function

Cada función tiene `config.toml` con `verify_jwt = true|false`. **true**: el gateway exige JWT válido antes de ejecutar (la función puede validar permisos adicionales). **false**: endpoint público, webhook o cron; la auth está en código (secret, firma Stripe, rate limit, etc.).

| `verify_jwt` | Funciones |
|--------------|-----------|
| **true** | `create-user`, `update-user`, `delete-user`, `invite-user-to-agency`, `generate-api-token`, `revoke-api-token`, `add-platform-admin`, `list-google-accounts`, `list-meta-accounts`, `oauth-google-ads`, `oauth-meta`, `notify-task-transfer`, `process-event-notifications`, `create-checkout-session`, `create-billing-portal-session` |
| **false** | `register-agency`, `create-agency`, `send-contact-email`, `request-password-reset`, `send-welcome-email` (410), `stripe-webhook`, `exchange-google-token` (410), `admin-delete-agency`, `admin-set-agency-plan`, `sync-google-ads`, `sync-meta-ads`, `scheduled-ads-sync`, `expire-trials`, `process-notification-rules` |

**Meta Ads — presupuesto y ritmo en la UI (`MetaAdsPage.tsx`):** El objetivo mensual y las alertas se basan en el **presupuesto mensual** que la agencia introduce en pantalla (persistido en `client_settings.budget_limit` por cuenta o cliente virtual). La vista compara **gasto medio diario** (lo gastado en el mes ÷ días transcurridos) con **objetivo medio diario** (presupuesto restante ÷ días que faltan). Los límites nativos de gasto siguen configurándose en Meta (campaña, conjunto, presupuesto compartido, etc.); no se muestra un «presupuesto diario importado» desde la API, para alinear el mensaje con el modelo de Meta y con lo que realmente sincroniza `sync-meta-ads`. En **Google Ads** (`AdsPage.tsx`) sí se usa `daily_budget` devuelto por la API cuando está disponible. La página importa desde `react` los hooks (`useState`, `useEffect`, `useMemo`, `useRef`) y `memo` usados por el componente memoizado de las tarjetas de estadísticas. Los filtros de la barra (cuentas ocultas, **sin inversión en el mes**) replican el comportamiento de `AdsPage` (`showHidden`, `showZeroSpend`).

**Proyección fin de mes (Ads):** En **Google Ads**, si hay suma de presupuestos diarios en campañas `ENABLED`, la proyección es `gasto acumulado + (esa suma × días restantes del mes)` para alinearla con el «Diario actual» y con el diario recomendado (reparto del saldo). Si no hay presupuestos diarios en los datos, se mantiene el ritmo medio del mes proyectado al calendario completo (`gasto_medio_diario × días del mes`). En **Meta Ads** no hay equivalente importado a diario: la proyección sigue siendo **ritmo medio del mes × días del mes**; puede desviarse del objetivo medio diario si el ritmo real cambió a mitad de mes (tooltip en la propia fila).

#### Integración: Modo demostración (ocultar datos sensibles en toda la app)

En Configuración → Integraciones → Privacidad y demostración, la opción **"Modo demostración (ocultar datos sensibles)"** activa una capa de anonimización en la UI, además de Google Ads y Meta Ads. **Prioridad de negocio**: para demos con terceros conviene ocultar **nombres de proyecto** y **nombres de cliente** (identifican cuentas reales). El resto (empleados, tareas, etc.) puede mostrarse o anonimizarse según la pantalla.

Cuando el modo está activo, los textos sustituidos se muestran con efecto blur y una **etiqueta semántica genérica** según el tipo (`kind`: cuenta/campaña, empleado, proyecto, tarea, departamento). Los **nombres de cliente** en listados y tablas usan `SensitiveText` con **`kind="account"`** y el **id del cliente** (misma familia de etiquetas que cuentas de anuncios). Los **IDs** que ya se mostraban en la UI (p. ej. cuentas de anuncios) **siguen visibles** donde aplica.

**Auditoría / búsqueda en el código** (para encontrar fugas de nombres reales): en el repo, buscar patrones como `{client.name}`, `client?.name`, `{clientName}`, `clients.find(... )?.name`, `formatProjectName(...)` en JSX de solo lectura, y `title={...}` con nombres de proyecto o cliente. Revisar también `OkrsPage.tsx`, `ClientsAndProjectsPage.tsx`, `FinancialHealthPage.tsx` (rentabilidad) cuando se añadan filas nuevas.

**Deadlines** (`DeadlinesPage.tsx`): los **nombres de proyecto** van envueltos en `SensitiveText` con `kind="project"` en `DeadlinesProjectList.tsx`, `DeadlinesProjectEditSheet.tsx`, `DeadlinesSuggestionsPanel.tsx` (lista, filtros por proyecto, desglose por proyecto); la demo estática `DemoDeadlinesPage.tsx` alinea el mismo criterio en el título del proyecto.

**Indicador global**: una franja discreta (no el banner verde de Ads) en el layout principal (`PrivacyDemoIndicator` en `AppLayout.tsx`). En **escritorio** usa `lg:pl-64` para que el texto no quede bajo el **sidebar fijo** (`z-50`, `w-64`); lo mismo aplica a `DepartmentViewBanner` y `SubscriptionSoftLockBanner`. La **vista admin como agencia** va en una línea al pie del sidebar (`SidebarImpersonationPanel`), encima del selector de vista global, no en franja superior. En las páginas de Ads se eliminó el banner verde duplicado y los badges "Datos protegidos" redundantes para no repetir avisos.

**Implementación**: `PrivacyDemoProvider` + `usePrivacyDemo` / `SensitiveText` (`src/contexts/PrivacyDemoContext.tsx`, `src/components/privacy/SensitiveText.tsx`), motor `createPrivacyAnonymizer` (`src/lib/privacyDemoAnonymizer.ts`). `useAnonymizeAds` reutiliza el mismo contexto para `AdsPage.tsx` y `MetaAdsPage.tsx` con `AnonymizedContent`, `account(id)` y `campaign(id)`.

**Cobertura ampliada (UI)**: en varias pantallas el modo también anonimiza otros campos (p. ej. empleados o clientes) además del nombre de proyecto; eso es **opcional por pantalla** y no sustituye el foco en **proyectos** como dato crítico frente a demos con terceros.

#### Módulo compartido `_shared/resend.ts`
Módulo reutilizable que exporta `sendEmail({ to, subject, html, text? })`. Usa la API HTTP de Resend (`https://api.resend.com/emails`). Variables: `RESEND_API_KEY` (obligatoria), `RESEND_FROM_EMAIL` (default: `Taimbox <onboarding@resend.dev>`; en producción usar el dominio raíz verificado en Resend, p. ej. `Taimbox <noreply@taimbox.com>`, no el subdominio SPF). Sin dependencias externas.

#### Módulo `_shared/welcome-and-invitation-email.ts`
Exporta `sendWelcomeOrInvitationEmail(supabaseAdmin, { email, name, agencyName, type })` con `type`: `registration` | `invitation`. Construye HTML/texto y llama a `sendEmail` en el mismo runtime (no hace `fetch` a `send-welcome-email`). Lo usan `register-agency`, `invite-user-to-agency` y `create-user` para alinearse con el envío directo de `request-password-reset`.

#### Notificaciones configurables (Resend)

- **Tablas:** `notification_rules` (CRUD desde la app con RLS por `user_agencies`), `notification_deliveries` (solo inserción efectiva vía service role desde las funciones; sin políticas para `authenticated`).
- **UI:** Configuración de agencia → pestaña **Notificaciones** (`AgencySettingsPage`).
- **Transferencias:** `useTaskTransfers` invoca `notify-task-transfer` en segundo plano tras insertar la fila (el destinatario depende de la regla: p. ej. `transfer_target`).
- **Programadas — `conditions` (JSON en `notification_rules.conditions`):**
  - **`evaluation`:** `project_month_health` (por defecto; indicadores mensuales alineados con `ClientsAndProjectsPage`) o **`deadline_coherence`** (misma base de cálculo que “Coherencia de planificación global” en seguimiento operativo). Los correos de coherencia enlazan a **`/operaciones`** y muestran desglose tipo tarjeta: deadline → plan → comp → “por computar” y delta, más empleados afectados.
  - **Periodicidad (solo `scheduled`):** `periodicity`: `daily` | `weekly` | `monthly` (por defecto `monthly`). Con **`weekly`**, `schedule_day_of_week` es obligatorio en producto: entero **1 = lunes … 7 = domingo** (convención UTC alineada con `getUTCDay()` del worker). El informe sigue siendo el **mes en curso (UTC)** salvo que el producto documente otro criterio.
  - **Coherencia (`deadline_coherence`):** `coherence_min_abs_hours` (umbral mínimo en horas, valor absoluto), `coherence_op_status_in` (lista: `over-budget`, `behind-schedule`, `needs-planning`, `no-activity`, `in-rule`), `coherence_delivery_mode`: `per_project` (un envío por proyecto y mes) o `digest` (un solo correo con varios proyectos, hasta `coherence_digest_max`). Opcionales: `project_ids`, `client_ids` (filtran proyectos; la UI en Configuración → Notificaciones permite multiselección en reglas programadas).
  - **Dedupe programadas:** además del sufijo temporal descrito abajo, coherencia `per_project` → `scheduled_coherence|<rule_id>|<project_id>|<sufijo>`; `digest` → `scheduled_coherence_digest|<rule_id>|<sufijo>`. El **sufijo** depende de `periodicity`: **mensual** → `YYYY-MM` (UTC); **diaria** → `YYYY-MM-DD` (UTC); **semanal** → `W|<YYYY-MM-DD>` donde la fecha es el **lunes UTC** de la semana del run. Así se evita reenvío dentro del mismo “periodo” lógico.
  - **Mes evaluado:** el worker usa el **mes calendario en UTC** en la misma línea que el ramal `project_month_health`; si hiciera falta mes “local agencia”, habría que acotarlo explícitamente en código y documentación.
- **Dependencias / tarea completada (híbrido):** no pasa por `notification_rules`. **Por defecto** las agencias reciben el aviso vía `process-event-notifications` al completar una tarea que tenía dependientes. **Interruptor en agencia:** `settings.dependencyUnblockEmailsEnabled` en **Configuración → Notificaciones** (`false` = silenciar para toda la agencia; omitido o `true` = comportamiento por defecto).
- **Programadas — despliegue:** Define `NOTIFICATIONS_CRON_SECRET` en secrets del runtime (mismo patrón que `RESEND_API_KEY`). Ejemplo de llamada desde cron o CI:

```bash
curl -sS -X POST "$SUPABASE_FUNCTIONS_URL/process-notification-rules" \
  -H "Authorization: Bearer $NOTIFICATIONS_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

En Supabase Cloud la URL suele ser `https://<project_ref>.supabase.co/functions/v1/<nombre_funcion>` (p. ej. `.../functions/v1/process-notification-rules`). En self-hosted, la ruta equivalente según tu reverse proxy o `kong`.

**Raspberry Pi / servidor propio (cron en la misma máquina que Supabase):**

- **URL:** Si Kong y las funciones escuchan solo en la red Docker, usa la URL interna que ya resuelva al servicio de funciones (p. ej. `http://kong:8000/functions/v1/process-notification-rules` desde otro contenedor, o `http://127.0.0.1:<puerto>/...` si publicaste el puerto en el host). Debe ser la misma base que usas para el resto de Edge Functions.
- **Secreto:** No hardcodees `NOTIFICATIONS_CRON_SECRET` en el crontab en claro si puedes evitarlo. Opciones: archivo `~/.config/taimbox/notifications-cron.env` con permisos `600` y `source` antes del `curl`, o variables en un **systemd timer + service** (`EnvironmentFile=`).
- **Frecuencia:** Si usas **hora UTC** en la regla (`schedule_hour_utc`), programa el disparo **cada hora** (p. ej. `0 * * * *` en crontab = minuto 0 de cada hora). La función ignora las horas que no coinciden. Si dejas la hora vacía en la regla, con un cron diario basta para “comprobar una vez al día”, siempre que te valga que la evaluación ocurra solo en ese momento.
- **`curl` robusto:** Añade `-f` (falla si HTTP ≥ 400) para que el cron registre error si el secreto o la URL fallan: `curl -fsS ...`. Revisa salida: `2>&1 | logger -t taimbox-notifications` o redirección a un log rotado.
- **systemd (alternativa a crontab):** Un `*.timer` OnCalendar hourly (o `*-*-* *:00:00`) que invoque un script que haga el `POST` suele ser más claro para logs y reinicios en la Pi.
- **Pi:** El trabajo es ligero (un POST y lógica en Edge); no debería notarse. Evita escribir logs enormes en la SD sin rotación (`logrotate`). Mantén la Pi con hora NTP correcta (la hora UTC del worker depende del reloj del host que ejecuta las funciones / contenedor).

#### Emails transaccionales (Resend)
- **Registro**: Al registrar una agencia (`register-agency`), se envía email de bienvenida y un aviso interno al administrador (`_shared/registration-admin-notify.ts`; fire-and-forget).
- **Crear usuario**: Al crear un usuario desde la app (`create-user`), se envía email de invitación (fire-and-forget).
- **Invitar usuario**: Al invitar a un usuario existente (`invite-user-to-agency`), se envía email de invitación (fire-and-forget).
- **Olvidé mi contraseña**: El frontend (`Login.tsx`) llama a `request-password-reset` que genera un enlace de recuperación (`supabase.auth.admin.generateLink`) y lo envía por email. Funciona para cualquier usuario en `auth.users` (empleados, admins de plataforma). El usuario recibe un enlace a `/reset-password?token_hash=...&type=recovery`. La página `ResetPasswordPage.tsx` verifica el token con `supabase.auth.verifyOtp()` y permite establecer nueva contraseña con `supabase.auth.updateUser()`.

#### Solución de problemas: Emails (Resend)

| Problema | Causa | Solución |
|----------|-------|----------|
| **No llegan emails** (bienvenida, invitación, reset contraseña) | `RESEND_API_KEY` no configurada o faltante en el contenedor | Añadir en `.env`: `RESEND_API_KEY=re_xxxxxxxx` (obtener en [resend.com](https://resend.com) → API Keys). Si usas el contenedor manual, incluir `-e RESEND_API_KEY="$RESEND_API_KEY"` en el `docker run`. |
| **Emails van a spam** | Dominio no verificado en Resend | En Resend Dashboard verificar el dominio (p. ej. `taimbox.com`) y añadir los registros DNS que indique. |
| **Emails con remitente genérico** | `RESEND_FROM_EMAIL` no configurada | Añadir en `.env`: `RESEND_FROM_EMAIL=Taimbox <noreply@taimbox.com>`. El dominio debe estar verificado en Resend. |
| **Resend 403 «domain is not verified»** | `RESEND_FROM_EMAIL` usa un subdominio (p. ej. `@send.taimbox.com`) pero en Resend solo está verificado el dominio raíz (`taimbox.com`) | Usar el dominio raíz verificado: `RESEND_FROM_EMAIL=Taimbox <noreply@taimbox.com>`. **Ojo:** Resend configura registros SPF/MX en un subdominio `send` para el return-path, pero el remitente (`From:`) debe coincidir con el dominio verificado en el dashboard, no con el subdominio de los registros DNS. |
| **"Olvidé mi contraseña" no envía email** | Usuario no existe en `auth.users` o error en Resend | La función siempre devuelve 200 (previene enumeración). Revisar logs: `docker logs supabase-edge-functions --tail 50` y buscar `[request-password-reset]` o `[Resend]`. |
| **Contenedor manual sin emails** | Variables Resend no pasadas al `docker run` | Incluir `-e RESEND_API_KEY="$RESEND_API_KEY"` y `-e RESEND_FROM_EMAIL="${RESEND_FROM_EMAIL:-Taimbox <noreply@taimbox.com>}"` en el comando. Ver sección "Workaround: usar contenedor manual". |
| **`{"message":"name resolution failed"}` en todas las funciones** | No es un error de Resend ni del Edge Runtime: **Kong** no puede resolver el hostname `functions` para enrutar al Edge Runtime. Ocurre cuando el contenedor se creó fuera de Docker Compose (p. ej. con el workaround manual) y perdió el alias de servicio `functions` en la red Docker | Ver sección «Solución de problemas: `name resolution failed` — alias `functions` en la red Docker» más abajo. |

#### Solución de problemas: `process-notification-rules` (notificaciones programadas)

| Problema | Causa | Diagnóstico | Solución |
|----------|-------|-------------|----------|
| **503 Service Unavailable** | El contenedor se está reiniciando (ciclo SIGTERM → startup). Kong no alcanza el Edge Runtime mientras arranca. | `docker logs supabase-edge-functions --tail 10` muestra `shutdown signal received: 15` → `main function started` en bucle. `docker ps` muestra "Up X seconds" (poco tiempo arriba). | Esperar unos segundos a que se estabilice y reintentar. Si persiste, ver sección "Edge Runtime reiniciándose en bucle" más arriba. |
| **401 Unauthorized `{"error":"Unauthorized"}`** | El Bearer token del `curl` **no coincide** con `NOTIFICATIONS_CRON_SECRET` del contenedor. Ocurre cuando la variable de shell tiene un placeholder o valor antiguo. | 1) Comprobar qué envía el curl: `echo $NOTIFICATIONS_CRON_SECRET`. 2) Comprobar qué tiene el contenedor: `docker inspect supabase-edge-functions --format '{{range .Config.Env}}{{println .}}{{end}}' \| grep NOTIFICATIONS_CRON_SECRET`. 3) Si no coinciden → es el problema. | Exportar en la shell el **mismo valor** que tiene el contenedor: `export NOTIFICATIONS_CRON_SECRET="<valor_del_contenedor>"`. Para evitar esto en cron, guardar el secreto en un archivo env (p. ej. `~/.config/taimbox/notifications-cron.env`) y hacer `source` antes del curl. |
| **401 pero el secreto parece correcto** | `NOTIFICATIONS_CRON_SECRET` no está definida en el contenedor (la función lee `Deno.env.get("NOTIFICATIONS_CRON_SECRET")` y si es vacía/null, **siempre** rechaza). | `docker inspect supabase-edge-functions --format '{{range .Config.Env}}{{println .}}{{end}}' \| grep NOTIFICATIONS` — si no sale nada, falta la variable. | Añadir `-e NOTIFICATIONS_CRON_SECRET="$NOTIFICATIONS_CRON_SECRET"` al `docker run` manual (ver workaround más abajo) o al `docker-compose.yml` del servicio `functions`. Reiniciar el contenedor. |
| **503 intermitente, luego 401** | El curl se lanzó justo cuando el contenedor se reiniciaba (→ 503 de Kong). Tras estabilizarse, la función responde pero el token no coincide (→ 401). | Primer intento: 503 (Kong no alcanza). Segundo intento con `-vvv`: HTTP 401 en los headers. | Resolver el 401 con el secreto correcto (ver fila anterior). El 503 inicial se resuelve solo al estabilizarse el contenedor. |
| **Funciones no encontradas en el volumen** (`ls` falla) | Al ejecutar como `root`, `~/supabase-pi/...` expande a `/root/supabase-pi/` en vez de `/home/alex/supabase-pi/`. | `ls /home/alex/supabase-pi/supabase/docker/volumes/functions/process-notification-rules/` (ruta absoluta, no con `~`). | Usar siempre **rutas absolutas** en los comandos de diagnóstico. Las funciones están en `/home/alex/supabase-pi/supabase/docker/volumes/functions/`. |
| **Funciones no desplegadas** | Se hizo `git pull` pero no se copió al volumen de Docker. | `ls /home/alex/supabase-pi/supabase/docker/volumes/functions/` — no aparecen las carpetas de funciones o `_shared`. | `cd /home/alex/Timeboxing && git pull && rsync -a ./supabase/functions/ /home/alex/supabase-pi/supabase/docker/volumes/functions/ && docker restart supabase-edge-functions` |

**Checklist rápida para probar `process-notification-rules` desde el servidor:**

```bash
# 1. Verificar que el contenedor está estable
docker ps | grep edge-functions  # debe llevar >30s arriba

# 2. Verificar que la variable existe en el contenedor
docker inspect supabase-edge-functions --format '{{range .Config.Env}}{{println .}}{{end}}' | grep NOTIFICATIONS_CRON

# 3. Exportar el MISMO valor en la shell
export NOTIFICATIONS_CRON_SECRET="<pegar_valor_del_paso_2>"

# 4. Probar con force=true (ignora filtro de hora UTC)
curl -fsS -X POST "https://api.taimbox.com/functions/v1/process-notification-rules" \
  -H "Authorization: Bearer $NOTIFICATIONS_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"force": true}'

# 4b. Prueba que además reenvíe aunque ya exista el delivery del mes (solo para depurar)
curl -fsS -X POST "https://api.taimbox.com/functions/v1/process-notification-rules" \
  -H "Authorization: Bearer $NOTIFICATIONS_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"force": true, "ignoreDedupe": true}'

# 5. Si falla, ver logs para el error exacto
docker logs supabase-edge-functions --tail 20
```

#### Arquitectura Google Ads OAuth (Modelo SaaS)

El flujo de Google Ads sigue un modelo SaaS donde la plataforma posee las credenciales OAuth y cada agencia solo autoriza su cuenta:

| Credencial | Origen | Quién la gestiona |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Variable de entorno (servidor + frontend) | **Plataforma** |
| `GOOGLE_CLIENT_SECRET` | Variable de entorno (servidor) | **Plataforma** |
| `GOOGLE_DEVELOPER_TOKEN` | Variable de entorno (servidor) | **Plataforma** |
| `agencies.google_ads_refresh_token` | Columna en BD (obtenido vía OAuth) | **Automático** |
| `agencies.google_ads_customer_id` | Columna en BD (MCC ID) | **Cliente** (en Ajustes → Integraciones) |

**Flujo OAuth completo:**
1. Cliente entra en Configuración → Integraciones → Google Ads.
2. Hace clic en "Conectar con Google" (el MCC/Customer ID se elige después de vincular, con el selector de cuentas).
3. El frontend redirige a Google con `VITE_GOOGLE_CLIENT_ID`, `scope=adwords`, y `state=agency_id` (para recuperar la agencia en el callback).
4. Google redirige a `/google-callback?code=...&state=agency_id` → `GoogleCallbackPage.tsx` captura el código y usa `agency_id` del `state` o del contexto.
5. El frontend invoca `oauth-google-ads` con `{ code, redirect_uri, agency_id }`.
6. La Edge Function intercambia el código por tokens usando `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`.
7. Guarda el `refresh_token` en la columna `agencies.google_ads_refresh_token`.
8. El usuario selecciona la cuenta (MCC o subcuenta) en el desplegable; se guarda en `agencies.google_ads_customer_id`.
9. `sync-google-ads` y `list-google-accounts` usan `GOOGLE_DEVELOPER_TOKEN` + credenciales plataforma + `refresh_token` (columna) + `customer_id` (columna cuando aplica). **MCC:** si la agencia no tiene cuentas en `ad_accounts_config`, la sync obtiene **toda la jerarquía** del MCC seleccionado (consultando `customer_client` de forma recursiva: MCC raíz, sub-MCCs y todas sus subcuentas) y sincroniza campañas de cada cuenta; los datos se guardan en `google_ads_campaigns` con el mismo `agency_id`.

**Comportamiento de datos al desvincular / cambiar cuenta / re-sincronizar:**
- **Desvincular:** Al desvincular Google Ads (Configuración → Integraciones), se borran todos los registros de `google_ads_campaigns` de esa agencia, para no dejar datos huérfanos.
- **Cambiar de cuenta (selector):** Al elegir otro MCC/cuenta en el desplegable, se borran todos los datos de Google Ads de la agencia; la próxima sincronización rellenará solo con la nueva cuenta.
- **Volver a sincronizar:** La sync **sobrescribe** los datos del mes en curso por cuenta: para cada cuenta, borra filas en el rango de fechas del mes y hace upsert con lo que devuelve la API. No se suman ni se duplican importes; el gasto proviene siempre de la API (coste en micros convertido a unidad), por lo que no se pierden decimales por doble escritura. Tras cada sync se eliminan filas de la agencia cuyo `client_id` ya no está en la lista sincronizada (p. ej. al haber cambiado de MCC).
- **Cuentas con muchas campañas:** La sync hace una petición por cuenta y carga la respuesta en memoria. Con cuentas que tengan decenas de miles de campañas puede acercarse al límite de memoria o tiempo del Edge Runtime. Si aparecen timeouts o errores de memoria, se puede valorar paginar por rango de fechas o limitar campañas por petición.

**Con la API de Google Ads aprobada:** El flujo de conexión está listo para producción. Asegúrate de tener `GOOGLE_DEVELOPER_TOKEN` aprobado en la cuenta de desarrollador de Google Ads; sin ello, `list-google-accounts` y `sync-google-ads` pueden devolver HTML de error en lugar de JSON. Ver sección "Solución de problemas: Google OAuth y API Google Ads" más abajo.

**URIs de redirección autorizadas en Google Cloud Console:**
- `http://localhost:8080/google-callback` (desarrollo)
- `https://taimbox.com/google-callback` (producción)

#### Arquitectura Meta Ads OAuth (Modelo SaaS)

Mismo patrón que Google Ads: credenciales de la app en la plataforma y un token por agencia almacenado en BD.

| Credencial | Origen | Quién la gestiona |
|---|---|---|
| `META_APP_ID` | Variable de entorno en **Edge Functions** (Docker); mismo número que en Meta | **Plataforma** |
| `VITE_META_APP_ID` | Variable en **`.env` del frontend** (Vite); mismo valor que **Identificador de la aplicación** en Meta | **Plataforma** |
| `META_APP_SECRET` | Solo en **Edge Functions** (nunca en el frontend) | **Plataforma** |
| `agencies.meta_ads_access_token` | Columna en BD (token de usuario long-lived tras OAuth) | **Automático** |

Si en BD antigua quedó `settings.integrations.metaAccessToken`, el backend aún puede leerlo como respaldo; la UI ya no permite introducir token manual.

**Flujo OAuth:**
1. Configuración → Integraciones → Meta Ads → **Conectar con Meta**.
2. El frontend redirige a Facebook con `VITE_META_APP_ID`, `scope=ads_read` y `state` (identifica la agencia vía `sessionStorage`). No incluir `read_insights` en el OAuth: no es un permiso válido del diálogo de Login; el acceso a métricas de campañas publicitarias queda cubierto por `ads_read`.
3. Meta redirige a `/meta-callback?code=...` → `MetaCallbackPage.tsx` invoca `oauth-meta` con `{ code, redirect_uri, agency_id }`.
4. La Edge Function intercambia el código por token corto y luego por **long-lived token** (Graph API `oauth/access_token` con `fb_exchange_token`) y guarda el resultado en `agencies.meta_ads_access_token`.
5. Opcionalmente se llama a `list-meta-accounts` para rellenar/actualizar `ad_accounts_config` con las cuentas publicitarias (`/me/adaccounts`).
6. `sync-meta-ads` usa el token en este orden: columna `meta_ads_access_token` → (respaldo) `integrations.metaAccessToken` en JSON legado → `META_ACCESS_TOKEN` (entorno, opcional).

**Ajustes en Meta for Developers (app Taimbox):**
- **Inicio de sesión con Facebook para empresas** → Configuración: URI de redirección OAuth válidos → deben coincidir **exactamente** con el origen real de la SPA + `/meta-callback`: p. ej. `https://taimbox.com/meta-callback` y, si los usuarios entran por subdominio `www`, también `https://www.taimbox.com/meta-callback`. En local: `http://localhost:8080/meta-callback` (o el puerto que use Vite; debe ser el mismo que `window.location.origin` al pulsar "Conectar").
- **Dominios admitidos para el SDK para JavaScript:** incluir cada host desde el que se carga la app (p. ej. `taimbox.com` y, si aplica, `www.taimbox.com`; para pruebas en máquina, `localhost`).
- **Información básica → Dominios de la aplicación:** sin `http://` ni `https://`. Como mínimo `taimbox.com`. Si el tráfico entra por **www**, añade también **`www.taimbox.com`** como entrada aparte (Meta trata apex y www como hosts distintos). Para desarrollo local añade **`localhost`**. La URL del sitio puede ser `https://taimbox.com/` o `https://www.taimbox.com/` según el canónico que uses; política y condiciones (`/privacidad`, `/condiciones`) como ya están documentadas.
- **Verificación de dominio (Meta Business / Developers):** la meta `facebook-domain-verification` está en `index.html` (raíz del build Vite) para que Meta pueda comprobar la propiedad del dominio. Si Meta genera un nuevo código, sustituye el `content` en ese archivo y vuelve a desplegar el frontend.
- La URL de Supabase/API (`api.taimbox.com`) **no** debe usarse como redirect OAuth del frontend; el callback es siempre el origen de la app (`taimbox.com`, `www` si aplica, o `localhost`).

**Solución de problemas — error Meta: «No se puede cargar la URL / El dominio de esta URL no está incluido en los dominios de la aplicación»:**
1. Identifica el **host exacto** de la barra de direcciones cuando falla (p. ej. `www.taimbox.com` frente a `taimbox.com`, o `localhost:5173` en dev).
2. En **Información básica → Dominios de la aplicación**, añade ese dominio **sin puerto** (solo `localhost` para local; el puerto va en las URIs de redirección OAuth, no en "dominios de la aplicación").
3. En **Inicio de sesión con Facebook para empresas → Configuración**, añade la **URI de redirección OAuth válida** completa: `https://<mismo-host>/meta-callback` (incluido esquema `http`/`https` y puerto si no es 80/443).
4. En **Dominios admitidos para el SDK para JavaScript**, alinea los mismos hosts que en el paso 2.
5. Guarda cambios en Meta y vuelve a probar; el `redirect_uri` que envía el frontend es siempre `${window.location.origin}/meta-callback` (`AgencySettingsPage.tsx` / `MetaCallbackPage.tsx`).

**Migración SQL:** `supabase/migrations/20250322120000_meta_ads_access_token.sql` añade la columna `meta_ads_access_token` en `agencies` (ejecutar en la instancia antes de usar OAuth en producción).

**Migración SQL (cuentas Meta en BD):** `supabase/migrations/20250322140000_ad_accounts_config_unique.sql` añade `UNIQUE (account_id, agency_id, platform)` en `ad_accounts_config` para que el upsert desde `list-meta-accounts` / `sync-meta-ads` funcione.

**Verificación del negocio y App Review (Meta):** Taimbox es un SaaS: cada agencia conecta **su** cuenta publicitaria. Para que usuarios que no sean administradores de la app puedan autorizar OAuth y para **acceso avanzado** a permisos como `ads_read`, Meta suele exigir **verificación del negocio** y, según el caso, **revisión de la aplicación (App Review)**.

1. **Modo desarrollo vs producción**  
   Con la app en modo desarrollo, solo cuentas con rol en la app (admin, desarrollador, tester) o usuarios de prueba pueden completar el flujo. Para clientes reales sin rol, la app debe estar **publicada** y los permisos necesarios aprobados.

2. **Verificación del negocio (Business Verification)**  
   En [Meta for Developers](https://developers.facebook.com) → tu app → **Configuración de la aplicación** → sección relacionada con verificación / **Business Manager** (o [documentación oficial de verificación de negocio](https://developers.facebook.com/docs/development/release/business-verification)). Debes vincular la app a un **Meta Business** y completar la verificación de identidad del negocio (documentación legal, dominio, etc.). Solo administradores del negocio pueden iniciar el proceso.

3. **App Review — permiso `ads_read`**  
   En el panel: **Casos de uso** / **Permisos y funciones** (según la versión del panel) → solicitar **acceso avanzado** a `ads_read` si Meta lo marca como necesario para “acceso a datos de anuncios de otros usuarios”.  
   Meta suele pedir: **política de privacidad** y **condiciones** públicas (ya enlazadas en Información básica), **vídeo o capturas** del flujo real (login → Configuración → Integraciones → Conectar Meta → callback), e **instrucciones de prueba** (URL `https://taimbox.com`, cuenta de prueba o pasos para revisor). Redacta en inglés si el formulario lo exige.

4. **Qué decir en la descripción del caso de uso**  
   Ejemplo: *“Taimbox is a B2B workforce planning platform. Agencies connect their own Meta Ads account via OAuth to read campaign spend and performance for reporting. We only request `ads_read`. Data is stored per agency and used only inside the app.”*

5. **Tras la aprobación**  
   Publica los cambios en la app si el panel lo pide y comprueba el flujo con una cuenta que **no** sea admin de la app.

### 5.2. Suscripciones (Stripe)

**Matriz completa de planes, rutas, módulos, exports e histórico:** [docs/16-planes-suscripcion-precios.md](16-planes-suscripcion-precios.md).

Resumen operativo:

- **Planes públicos (USD):** Free (`starter`), Team (`pro` 49/99), Agency (`business` 149/249), Scale (`scale` 299, contacto), Enterprise (contrato). IDs internos en BD no cambian.
- **Personas gestionadas:** Free 5; Team 10 (+5 $/extra, máx. 25); Agency 40 (+3,50 $, máx. 100); Scale 100 (+2,50 $); ver `src/config/plans.ts` y `countManagedUsers`.
- **Histórico:** Free = 2 meses de calendario (`usePlanMonthNavigation` + `historyMinDate`); Team+ ilimitado en producto.
- **Trial:** registro con Agency 14 días, un solo trial (`trial_used_at`); expiración vía `expire-trials` + RPC `expire_agency_trials`; sin trial en Stripe Checkout.
- **Campos en `agencies`:** `plan_id` (`starter`|`pro`|`business`|`scale`|`enterprise`), `subscription_status`, `stripe_*`, `trial_ends_at`, `subscription_period_ends_at`, `subscription_cancel_at_period_end`, `trial_used_at`.
- **Flujo checkout:** Configuración → Plan y facturación → `create-checkout-session` (`pro`|`business`, extras de asiento). Webhook `stripe-webhook` + `syncAgencyModulesForPlan`. Portal: `create-billing-portal-session`. Downgrade a Free al cancelar suscripción.
- **Límites UI:** `useSubscriptionLimits` (`canAddEmployee`, `canAccessRouteByPlan`, `historyMinDate`). **Soft-lock solo Free** si excede personas (`SubscriptionSoftLockBanner`, planificador en solo lectura). Safety net: trial vencido en cliente → tratar como Free hasta webhook/cron.
- **Rutas Team+:** weekly, OKR, operaciones, finanzas, capacidad, exportación. **Agency+:** ads, meta-ads, api-keys. `/tiempos` solo exige módulo `timeTracker` (Free lo incluye). Detalle en doc 16.
- **Cron Ads:** `scheduled-ads-sync` solo agencias con `plan_id IN ('business','scale','enterprise')`.
- **Variables Stripe (Edge + Vite):** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PRO`, `STRIPE_PRICE_ID_BUSINESS`, precios de asiento (`STRIPE_PRICE_ID_*_SEAT` / `VITE_*`). Opcional Scale. `CHECKOUT_BASE_URL`.
- **Desincronía plan en BD vs Stripe:** el webhook `customer.subscription.updated` sobrescribe `plan_id` según metadata o Price ID — alinear metadata `agency_id` + `plan_id` en Stripe antes de “Forzar plan” manual en admin.

#### Variables de entorno requeridas

**En el contenedor `supabase-edge-functions`** (Docker):
```
SUPABASE_URL=http://kong:8000
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
GOOGLE_CLIENT_ID=<client_id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-<secret>
GOOGLE_DEVELOPER_TOKEN=<developer_token>
META_APP_ID=<facebook_app_id>
META_APP_SECRET=<facebook_app_secret>
RESEND_API_KEY=<resend_api_key>
RESEND_FROM_EMAIL=Taimbox <noreply@taimbox.com>
NOTIFICATIONS_CRON_SECRET=<secreto_aleatorio_largo>
```

`NOTIFICATIONS_CRON_SECRET` solo es necesario si usas `process-notification-rules` (notificaciones programadas por cron). Genera un valor aleatorio largo (p. ej. `openssl rand -base64 48`) y usa **el mismo valor** en el contenedor y en el cron/script que hace el `curl`.

Opcional (solo lectura / pruebas sin OAuth por agencia): `META_ACCESS_TOKEN`.

**En el frontend** (`.env` de Vite en la raíz del proyecto, **no** en el Docker de Supabase):
```
VITE_GOOGLE_CLIENT_ID=<mismo_client_id>.apps.googleusercontent.com
VITE_META_APP_ID=<identificador_de_la_aplicacion_meta>
```

**Valores exactos para Meta (copiar desde el panel):** en [Meta for Developers](https://developers.facebook.com) → tu app → **Configuración de la aplicación** → **Información básica**. El campo **Identificador de la aplicación** (solo dígitos) es el valor de `META_APP_ID` y de `VITE_META_APP_ID` (el mismo número en ambos sitios). La **Clave secreta de la aplicación** (botón *Mostrar*) es **solo** `META_APP_SECRET` en el contenedor de Edge Functions; no la subas al repo ni al build del frontend.

**Dónde van en Docker:** las variables del bloque “contenedor `supabase-edge-functions`” se definen donde ya tienes `GOOGLE_CLIENT_ID` (por ejemplo `.env` junto al `docker-compose` de Supabase, o `environment:` del servicio `functions`). Ahí añade `META_APP_ID`, `META_APP_SECRET` y reinicia ese contenedor. `VITE_META_APP_ID` no se pone en Docker de funciones: va en el `.env` local/CI del **proyecto Vite** y se inyecta al hacer `npm run build`.

#### Acceso solo lectura para tests / agentes (`taimbox_ci_readonly`)

**Por defecto los tests no necesitan BD:** usan fixtures en `src/test/fixtures/` (datos sintéticos en el repo, sin contraseñas ni PII real).

**Opcional — BD live solo lectura** (nunca commits de passwords):

1. En el servidor, crea el rol:

```bash
cd /home/alex/Timeboxing && git pull
export READONLY_PASSWORD="$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)"
READONLY_HOST=127.0.0.1 READONLY_PORT=54322 ./scripts/create-ci-readonly-role.sh
```

2. Pon la URL solo en env local gitignored (`.cursor/mcp.env`) o en un secreto de Cursor/CI: **`TAIMBOX_READONLY_DATABASE_URL`**. No la subas al repo ni hace falta API pública.

3. Smoke opcional: `TAIMBOX_READONLY_DATABASE_URL='…' npm run test:integration`  
   Sin la variable, esos tests se **saltan**. SQL: [`scripts/sql/create_taimbox_ci_readonly_role.sql`](../scripts/sql/create_taimbox_ci_readonly_role.sql).

El rol es `SELECT` (+ `BYPASSRLS`) en `public`, sin escritura. No es un endpoint público.

#### Acceso a la base de datos desde Cursor (MCP)

El workspace incluye un servidor MCP para **consultar y auditar** la instancia Supabase self-hosted sin abrir el SQL Editor a mano en cada revisión.

**Configuración en el repo:** [`.cursor/mcp.json`](../.cursor/mcp.json)

```json
{
  "mcpServers": {
    "supabase-self-hosted": {
      "url": "http://localhost:8080/api/mcp"
    }
  }
}
```

**Túnel SSH (desarrollo en Windows → servidor self-hosted):** el proxy MCP solo es alcanzable si reenvías el puerto del stack. En **PowerShell** usa **una sola línea** (no continúes con `\` como en bash):

```powershell
ssh -p 6561 -L localhost:8080:127.0.0.1:54323 -L localhost:54322:127.0.0.1:5432 alex@192.168.1.131
```

| Puerto local | → remoto | Para qué |
|--------------|----------|----------|
| `8080` | `127.0.0.1:54323` | Supabase Studio, API y MCP (`http://localhost:8080/api/mcp`) — **necesario para el agente** |
| `54322` | `127.0.0.1:5432` | Postgres directo — `supabase db push`, psql; **no obligatorio** para MCP HTTP |

Mínimo solo Studio/MCP:

```powershell
ssh -p 6561 -L localhost:8080:127.0.0.1:54323 alex@192.168.1.131
```

Si las herramientas MCP en Cursor devuelven `Not connected`: comprueba que el túnel sigue abierto, **Settings → MCP → `supabase-self-hosted` → Restart** y abre un chat nuevo. Regla del agente: [`.cursor/rules/supabase-mcp-database.mdc`](../.cursor/rules/supabase-mcp-database.mdc).

**¿Hace falta `.cursor/mcp.env`?** Con el modo **HTTP** de `mcp.json` (URL anterior), **normalmente no**: las credenciales las usa el proxy en el servidor. El archivo [`.cursor/mcp.env.example`](../.cursor/mcp.env.example) solo es necesario si arrancas el MCP en **stdio** con [`scripts/mcp-selfhosted-supabase.mjs`](../scripts/mcp-selfhosted-supabase.mjs) (no commitear secretos; está en `.gitignore`).

**Requisito local:** túnel activo hacia `localhost:8080` y servidor MCP habilitado en Cursor. La app Vite suele ir en otro puerto (p. ej. `5173`) y no depende de este SSH.

**Qué puede hacer el agente / desarrollador vía MCP:**

| Herramienta | Uso recomendado |
|-------------|-----------------|
| `execute_sql` | Lecturas: columnas, políticas, huérfanos FK, comprobación de RPC |
| `get_advisors` | Avisos de seguridad (RLS, `search_path`) y rendimiento (índices, `auth.uid()` en políticas) |
| `list_migrations` | Ver qué migraciones registra la BD (en self-hosted puede estar **vacío** si el esquema se aplicó fuera de `supabase db push`) |
| `apply_migration` | Aplicar **DDL** versionado (preferir frente a SQL ad hoc en `execute_sql`) |
| `list_tables` / `list_extensions` | Inventario (dependen del usuario read-only del proxy; si fallan auth, usar `execute_sql` contra `pg_catalog`) |

**Criterio para agentes de IA:** ante dudas de esquema o estado de la BD, **usar MCP** y citar `supabase/migrations/` — no asumir columnas por memoria. Regla Cursor: [`.cursor/rules/supabase-mcp-database.mdc`](../.cursor/rules/supabase-mcp-database.mdc).

**Limitaciones conocidas (mayo 2026):** sin tabla `supabase_migrations.schema_migrations`, el historial MCP no sustituye al diff contra `supabase/migrations/*.sql`. Algunas herramientas de metadatos (`list_tables`) pueden fallar por credenciales del usuario `supabase_read_only_user` del proxy; `execute_sql` y `get_advisors` suelen funcionar igual.

#### Review Agents + Ollama (ia-srv)

Sistema de revisión de documentos/URLs con **skills** configurables, cola **BullMQ/Redis** y worker Node en el mismo host que **Ollama** (`127.0.0.1:11434`). No usa Edge Functions (jobs de hasta ~2 h).

| Componente | Ruta en repo |
|------------|----------------|
| Migración SQL | `supabase/migrations/20260526120000_review_agents.sql` |
| API REST | `packages/review-agents/api` (puerto 3001) |
| Worker | `packages/review-agents/worker` |
| Portal SPA | `packages/review-agents/portal` |
| Deploy ia-srv | `packages/review-agents/deploy/` (Redis, systemd, Apache, `hardening.sh`) |

Variables: ver `packages/review-agents/deploy/env.example`. Esquema y RLS: [13-esquema-base-datos.md](13-esquema-base-datos.md) (§ 13.6b). Integración Taimbox: permiso `can_access_review_agents`, `/review-agents` → portal externo (`VITE_REVIEW_PORTAL_URL`).

#### Despliegue de Edge Functions (self-hosted)

El entorno usa Supabase self-hosted con Docker. El contenedor `supabase-edge-functions` lee las funciones desde un volumen montado.

| Concepto | Ruta |
|----------|------|
| Repo en el servidor | `/home/alex/Timeboxing` |
| Origen (código) | `./supabase/functions/` (incluye `_shared/`) |
| Volumen Docker | `/home/alex/supabase-pi/supabase/docker/volumes/functions/` |

**Comando habitual de despliegue (copiar y pegar en el servidor):**

```bash
cd /home/alex/Timeboxing && git pull && rsync -a ./supabase/functions/ /home/alex/supabase-pi/supabase/docker/volumes/functions/ && docker restart supabase-edge-functions
```

Pasos que ejecuta: actualizar el repo → copiar todas las funciones al volumen → reiniciar el contenedor `supabase-edge-functions` para que cargue el código nuevo.

**Para una sola función (más rápido):**

```bash
rsync -a /home/alex/Timeboxing/supabase/functions/<nombre-funcion> \
      /home/alex/supabase-pi/supabase/docker/volumes/functions/ \
   && docker restart supabase-edge-functions
```

**Script opcional `supabase/scripts/deploy-edge-functions-supabase-pi.sh`**

No es el flujo habitual. Hace **lo mismo en esencia** (`rsync` del directorio `supabase/functions/` al volumen + reinicio del servicio), pero:

- Usa `docker compose restart functions` en lugar de `docker restart supabase-edge-functions` (equivalente si el servicio Compose se llama `functions` y el contenedor es `supabase-edge-functions`).
- Añade `sudo rsync` si el volumen no es escribible por el usuario.
- Tras el reinicio, comprueba y repara el alias DNS `functions` en la red Docker (útil si Kong devuelve `name resolution failed`).

Usar el comando de una línea de arriba salvo que necesites esas comprobaciones extra.

**Verificar variables de entorno del contenedor:**
```bash
docker inspect supabase-edge-functions --format '{{range .Config.Env}}{{println .}}{{end}}' | grep GOOGLE
```

**Verificar logs:**
```bash
docker logs supabase-edge-functions --tail 50 -f
```

#### Solución de problemas: 503 Service Unavailable

Si al vincular **Google Ads**, **Meta Ads** o listar cuentas aparece **503 (Service Unavailable)** en `oauth-google-ads`, `list-google-accounts`, `oauth-meta` o `list-meta-accounts`, suele deberse a:

1. **Funciones no desplegadas o desactualizadas**  
   Asegúrate de haber copiado las funciones al volumen y reiniciado el contenedor (ver comandos de despliegue arriba).

2. **Variables de entorno faltantes en el contenedor**  
   Las funciones necesitan en el contenedor `supabase-edge-functions`:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (para `oauth-google-ads`)
   - `GOOGLE_DEVELOPER_TOKEN` (para `list-google-accounts`)
   - `META_APP_ID`, `META_APP_SECRET` (para `oauth-meta` / Meta Ads)  
   Si falta alguna, la función puede fallar antes de devolver una respuesta controlada y el runtime devuelve 503.

3. **Crash no capturado**  
   Si el body de la petición está vacío o no es JSON válido, las funciones devuelven **400** con mensaje claro. Si aun así ves 503, revisa los logs del contenedor para ver el stack trace.

4. **DNS / «name resolution failed» (Meta Ads, Google, listados, Resend)**  
   Si el body del error o los logs mencionan **`name resolution failed`**, hay **dos causas distintas** que producen el mismo mensaje:

   **a) Kong no puede resolver el hostname `functions` (causa más frecuente)**  
   Kong enruta a `functions:9000`. Si el contenedor del Edge Runtime no tiene el alias `functions` en la red Docker `supabase_default`, Kong devuelve `{"message":"name resolution failed"}` **sin que la petición llegue al Edge Runtime** (no aparecen logs en el contenedor). Esto ocurre cuando el contenedor se creó fuera de Docker Compose (con `docker run` manual) y no se añadió `--network-alias functions`. Ver sección **«`name resolution failed` — alias `functions`»** más abajo.

   **b) El Edge Runtime no resuelve hosts externos**  
   Si los **logs del contenedor** muestran errores como `dns error: failed to lookup address information` al intentar llegar a `esm.sh`, `api.resend.com`, `graph.facebook.com` o `googleapis.com`, el problema es de DNS saliente. Solución:
   - En el `docker-compose` del servicio `functions`, añadir DNS públicos:
     ```yaml
     dns:
       - 8.8.8.8
       - 8.8.4.4
     ```
   - Reiniciar: `docker compose up -d functions`.
   - Asegurar que `SUPABASE_URL` sea alcanzable **desde dentro** del contenedor (p. ej. `http://kong:8000` en la red Docker de Supabase); si el runtime no puede resolver `kong`, el cliente de Supabase fallará.

   **Cómo distinguir (a) de (b):** ejecutar `docker logs supabase-edge-functions --tail 20` **justo después** de la petición fallida. Si no aparece **ningún log nuevo** de la función invocada, es (a) — Kong no alcanza el Edge Runtime. Si aparecen logs con errores DNS, es (b) — el Edge Runtime no sale a Internet.

   - **Verificar DNS desde la red Docker:** `docker run --rm --network supabase_default alpine nslookup functions` (debe resolver a la IP del contenedor) y `docker run --rm --network supabase_default alpine nslookup esm.sh` (debe resolver a IPs externas).
   - **Vite en local:** el hot reload puede remontar la página de Configuración y repetir muchas veces la llamada a `list-google-accounts`. El frontend **deduplica** la petición por `agency_id`, aplica un **debounce** y solo carga el listado cuando la pestaña **Integraciones** está activa, para no saturar la API mientras el error persiste en el servidor.

**Comprobar en el servidor:**
- Que existan las carpetas `oauth-google-ads` y `list-google-accounts` dentro del volumen de functions.
- Que el contenedor tenga las variables anteriores (`docker inspect ... | grep GOOGLE` y comprobar SUPABASE_*).
- Que el alias `functions` esté registrado: `docker inspect supabase-edge-functions --format '{{json .NetworkSettings.Networks}}' | python3 -m json.tool` — buscar `functions` en `DNSNames` o `Aliases`.
- Reproducir el error y ejecutar `docker logs supabase-edge-functions --tail 100` para ver el error exacto.

#### Solución de problemas: HTTP 000, 404 y 301 al probar Edge Functions

Al hacer `curl` a las funciones, los códigos indican lo siguiente:

| Código | Significado | Acción |
|--------|-------------|--------|
| **HTTP:000** | Conexión fallida (timeout, conexión rechazada). El Edge Runtime no responde. | 1) Verificar IP del contenedor: `docker inspect supabase-edge-functions --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'`. 2) Comprobar que el contenedor está levantado: `docker ps \| grep edge-functions`. 3) Revisar logs: `docker logs supabase-edge-functions --tail 100` — si hay `shutdown signal received: 15` en bucle, el contenedor se reinicia; revisar que exista la carpeta `main` en `volumes/functions/` (el Edge Runtime la requiere). |
| **HTTP:404** | Kong responde pero la ruta no existe. | Verificar que Kong enruta a `/functions/v1/` y que el puerto expuesto es el correcto (típicamente 8000). Probar también contra la URL pública con HTTPS. |
| **HTTP:301** | Redirección (p. ej. HTTP → HTTPS). | Usar **HTTPS** en la URL: `https://api.taimbox.com/functions/v1/oauth-google-ads` en lugar de `http://`. |

**Prueba recomendada con HTTPS y anon key real:**

```bash
curl -s -w "\nHTTP:%{http_code}" -X POST \
  https://api.taimbox.com/functions/v1/oauth-google-ads \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_ANON_KEY_REAL" \
  -d '{"code":"x","redirect_uri":"https://taimbox.com/google-callback","agency_id":"60eb6a6f-c3ec-4b52-b9bb-3cb1886ad892"}'
```

- Si devuelve **400** con mensaje de error (p. ej. "Falta el código" o "Google devolvió...") → la función **sí está alcanzable**; el problema es el flujo OAuth o los datos enviados.
- Si devuelve **503** → Kong no puede alcanzar el Edge Runtime; revisar que el contenedor `supabase-edge-functions` esté estable y que Kong tenga la ruta correcta a `functions:9000`.

#### Solución de problemas: Edge Runtime reiniciándose en bucle (SIGTERM → 503)

Si los logs muestran `main function started` seguido de `shutdown signal received: 15` en bucle, el contenedor se reinicia continuamente y no llega a servir peticiones. Kong devuelve 503 porque el upstream no responde.

**Síntomas:** `docker logs supabase-edge-functions --tail 50` muestra el patrón repetido; `docker ps` indica "Up X minutes" (el contenedor lleva poco tiempo reiniciado).

**Causas habituales y soluciones:**

1. **Health check fallando**  
   El docker-compose oficial de Supabase no define healthcheck para `functions`, pero si usas una variante (p. ej. supabase-pi) que sí lo tenga, puede estar fallando. Comprobar:
   ```bash
   docker inspect supabase-edge-functions --format '{{json .Config.Healthcheck}}'
   ```
   Si hay healthcheck y falla, opciones:
   - Aumentar `start_period` y `interval` en el docker-compose del servicio `functions`.
   - Comentar o eliminar el healthcheck temporalmente para verificar si el contenedor se estabiliza.

2. **Memoria insuficiente (Raspberry Pi / máquinas con poca RAM)**  
   El Edge Runtime usa ~150 MB por worker. En un Pi con varios servicios Supabase, la memoria puede agotarse y el sistema puede terminar el proceso.
   - Revisar RAM libre: `free -h`
   - Reducir servicios que no uses (p. ej. analytics, storage) si es posible.
   - Aumentar swap: `sudo dphys-swapfile swapoff && sudo nano /etc/dphys-swapfile` (cambiar `CONF_SWAPSIZE` a 2048) y `sudo dphys-swapfile setup && sudo dphys-swapfile swapon`.

3. **Probar sin healthcheck (diagnóstico)**  
   Editar el `docker-compose.yml` del servicio `functions` y comentar o eliminar el bloque `healthcheck` si existe. Luego:
   ```bash
   cd ~/supabase-pi/supabase/docker
   docker compose up -d functions
   docker logs supabase-edge-functions -f
   ```
   Si el contenedor deja de reiniciarse, el problema era el healthcheck.

4. **Verificar que el main responde**  
   Con el contenedor estable, desde el host:
   ```bash
   FUNC_IP=$(docker inspect supabase-edge-functions --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')
   curl -s -w "\nHTTP:%{http_code}" -m 5 "http://${FUNC_IP}:9000/_internal/health"
   ```
   Debe devolver `{"message":"ok"}` y HTTP:200.

5. **Workaround: usar contenedor manual**  
   Si el contenedor de Compose sigue en bucle y las causas anteriores no aplican, levantar el Edge Runtime manualmente. Kong enruta a `functions:9000`, así que el contenedor **debe tener el alias `functions`** en la red Docker para que Kong lo encuentre.

   **Importante:** No usar `--env-file .env` porque el `.env` tiene nombres como `SERVICE_ROLE_KEY` y la función espera `SUPABASE_SERVICE_ROLE_KEY`. Hay que pasar las variables explícitamente:

   ```bash
   cd /home/alex/supabase-pi/supabase/docker
   docker stop supabase-edge-functions 2>/dev/null
   docker rm -f functions 2>/dev/null

   set -a
   source .env
   set +a

   docker run -d --name functions \
     -v /home/alex/supabase-pi/supabase/docker/volumes/functions:/home/deno/functions:Z \
     --network supabase_default \
     --network-alias functions \
     -e SUPABASE_URL=http://kong:8000 \
     -e SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
     -e SUPABASE_ANON_KEY="$ANON_KEY" \
     -e JWT_SECRET="$JWT_SECRET" \
     -e SUPABASE_DB_URL="postgresql://postgres:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}" \
     -e GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID" \
     -e GOOGLE_CLIENT_SECRET="$GOOGLE_CLIENT_SECRET" \
     -e GOOGLE_DEVELOPER_TOKEN="$GOOGLE_DEVELOPER_TOKEN" \
     -e STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY" \
     -e STRIPE_WEBHOOK_SECRET="$STRIPE_WEBHOOK_SECRET" \
     -e STRIPE_PRICE_ID_PRO="${STRIPE_PRICE_ID_PRO:-}" \
     -e STRIPE_PRICE_ID_BUSINESS="${STRIPE_PRICE_ID_BUSINESS:-}" \
     -e CHECKOUT_BASE_URL="${CHECKOUT_BASE_URL:-https://taimbox.com}" \
     -e REGISTRATION_NOTIFY_EMAIL="${REGISTRATION_NOTIFY_EMAIL:-}" \
     -e RESEND_API_KEY="$RESEND_API_KEY" \
     -e RESEND_FROM_EMAIL="${RESEND_FROM_EMAIL:-Taimbox <noreply@taimbox.com>}" \
     -e VERIFY_JWT="${FUNCTIONS_VERIFY_JWT:-true}" \
     -e NOTIFICATIONS_CRON_SECRET="${NOTIFICATIONS_CRON_SECRET:-}" \
     supabase/edge-runtime:v1.69.28 \
     start --main-service /home/deno/functions/main
   ```

   > **⚠️ Alias obligatorio:** `--network-alias functions` es **imprescindible**. Sin él, Kong no puede resolver `functions:9000` y todas las peticiones devuelven `{"message":"name resolution failed"}` sin que aparezca ningún log en el Edge Runtime. Si ya tienes el contenedor corriendo sin alias, puedes añadirlo en caliente:
   > ```bash
   > docker network disconnect supabase_default supabase-edge-functions
   > docker network connect --alias functions supabase_default supabase-edge-functions
   > ```

   Ajustar la ruta `/home/alex/` si el usuario o la instalación son distintos.

   Verificar que responde: `curl -s https://api.taimbox.com/functions/v1/hello -H "Authorization: Bearer ANON_KEY"` debe devolver algo distinto de 503 o `name resolution failed`. O probar `oauth-google-ads` con un código de prueba: si devuelve 400 con "Google Error: Malformed auth code" → la función está operativa.

   Para volver al contenedor de Compose:
   ```bash
   docker stop functions
   docker rm functions
   docker compose up -d functions
   ```

   Si tras volver a Compose el bucle reaparece, mantener el contenedor manual como solución estable. Puedes crear un script `start-functions-manual.sh` con el bloque anterior para ejecutarlo tras reinicios del servidor.

#### Solución de problemas: `name resolution failed` — alias `functions` en la red Docker

Si **todas** las Edge Functions devuelven `{"message":"name resolution failed"}` y **no aparece ningún log** en `docker logs supabase-edge-functions`, el problema NO es de DNS externo ni del Edge Runtime: es **Kong** quien no puede resolver el upstream `functions:9000`.

**Causa:** El contenedor `supabase-edge-functions` no tiene el alias de red `functions` en `supabase_default`. Cuando Docker Compose crea el contenedor, añade automáticamente el nombre del servicio (`functions`) como alias DNS en la red. Si el contenedor se creó manualmente (con `docker run --name functions` del workaround) o se reconectó a la red fuera de Compose, el alias se pierde.

**Diagnóstico rápido:**
```bash
# ¿Existe el alias "functions"?
docker inspect supabase-edge-functions --format '{{json .NetworkSettings.Networks}}' | python3 -m json.tool
# Buscar "functions" en DNSNames o Aliases. Si no aparece → es el problema.

# Verificar desde la red Docker:
docker run --rm --network supabase_default alpine nslookup functions
# Si devuelve NXDOMAIN → Kong no puede enrutar.
```

**Fix inmediato (sin recrear el contenedor):**
```bash
docker network disconnect supabase_default supabase-edge-functions
docker network connect --alias functions supabase_default supabase-edge-functions
```

**Fix permanente:** usar `docker compose up -d functions` (Compose añade el alias automáticamente) o incluir `--network-alias functions` en el `docker run` del workaround manual (ver sección anterior).

**Verificar:**
```bash
docker run --rm --network supabase_default alpine nslookup functions
# Debe resolver a la IP del contenedor
curl -s https://api.taimbox.com/functions/v1/hello -H "Authorization: Bearer ANON_KEY"
# Debe devolver "Hello from Edge Functions!"
```

#### Solución de problemas: Google OAuth y API Google Ads

- **`unauthorized_client` / "Refresh token no válido para este Client ID/Secret"**  
  El refresh token guardado en la agencia se generó con **otro** OAuth Client (otro Client ID/Secret en Google Cloud) distinto al configurado en las variables de entorno del contenedor. Solución: en la app, **desvincular** la cuenta de Google Ads y **volver a vincular**; así se obtiene un refresh token con el Client ID/Secret actual. Asegúrate de que en el contenedor solo haya un juego de credenciales y que coincidan con el proyecto OAuth usado en el flujo de consentimiento.

- **"Google devolvió una página HTML" / "Unexpected token '<', \"<!DOCTYPE\"..."**  
  La llamada a Google (intercambio de token o Google Ads API) está devolviendo una página de error HTML en lugar de JSON. Posibles causas:
  - **Intercambio de token**: mismo origen que `unauthorized_client`; desvincular y vincular de nuevo.
  - **Google Ads API**: comprueba que `GOOGLE_DEVELOPER_TOKEN` sea el token de **cuenta de desarrollador de Google Ads** (aprobado o en modo test). Con cuenta MCC, la sync usa `login-customer-id` y obtiene MCC + subcuentas vía `customer_client`; si no ves datos, revisa los logs de la sync (cada cuenta muestra "X campañas" o "0 campañas con datos en el rango").

#### Crear una nueva Edge Function

1. Crear carpeta en `supabase/functions/<nombre>/index.ts`.
2. Seguir la estructura estándar (ver `exchange-google-token` como referencia):
   - Import de Supabase: `import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'`
   - Headers CORS
   - `Deno.serve(async (req) => { ... })`
   - Crear cliente Supabase con `SUPABASE_SERVICE_ROLE_KEY`
3. Desplegar: `cd /home/alex/Timeboxing && git pull && rsync -a ./supabase/functions/ /home/alex/supabase-pi/supabase/docker/volumes/functions/ && docker restart supabase-edge-functions`
4. La función estará accesible en `<SUPABASE_URL>/functions/v1/<nombre>`.

> **⚠️ IMPORTANTE**: Los lints de VS Code sobre `Deno`, `esm.sh` y tipos implícitos `any` en archivos de Edge Functions son **esperados** — el IDE no tiene los tipos de Deno instalados. Estos errores no afectan al runtime en el servidor.

