# 📅 Timeboxing Manager

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-B73C9D?style=for-the-badge&logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-181818?style=for-the-badge&logo=supabase&logoColor=3ECF8E)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Gemini AI](https://img.shields.io/badge/Gemini_AI-8E75B2?style=for-the-badge&logo=google-bard&logoColor=white)

Sistema integral de gestión de recursos y planificación para agencias. Combina timeboxing mensual, control de horas, gestión de equipos, reportes de rendimiento e integración con plataformas de publicidad (Google Ads, Meta Ads).

---

## 📖 Índice

- [Manual de Usuario](#-manual-de-usuario)
  - [Dashboard Personal (Mi Espacio)](#1-dashboard-personal-mi-espacio)
  - [Planificador Mensual](#2-planificador-mensual)
  - [Gestión de Proyectos](#3-gestión-de-proyectos)
  - [Gestión de Equipo](#4-gestión-de-equipo)
  - [Reportes y Métricas](#5-reportes-y-métricas)
  - [Copiloto IA (Minguito)](#6-copiloto-ia-minguito)
  - [Módulo PPC](#7-módulo-ppc-google-ads--meta-ads)
- [Documentación Técnica](#-documentación-técnica)
  - [Stack Tecnológico](#stack-tecnológico)
  - [Arquitectura](#arquitectura-del-proyecto)
  - [Base de Datos](#base-de-datos)
  - [Autenticación](#autenticación)
  - [Instalación](#instalación-y-despliegue)
  - [Variables de Entorno](#variables-de-entorno)

---

## 📖 Manual de Usuario

### 1. Dashboard Personal (Mi Espacio)

Tu centro de mando personal al iniciar sesión. Incluye:

*   **Vista Mensual de Carga:** Calendario con tus tareas organizadas por semana.
*   **Planificación Rápida:** Añade múltiples tareas a la vez seleccionando proyecto, horas y semana.
*   **Gestión Interna:** Registra reuniones, formaciones y tareas administrativas que no pertenecen a clientes.
*   **Objetivos (OKRs):** Visualiza y gestiona tus objetivos profesionales con Key Results configurables.
*   **Ausencias:** Solicita vacaciones o bajas. Tu capacidad se ajustará automáticamente.
*   **Exportar al CRM:** Genera un CSV con tus tareas planificadas listo para importar al sistema de gestión externo.
*   **Tour de Bienvenida:** Primera vez? Un tutorial interactivo te guiará por todas las funciones.

### 2. Planificador Mensual

El corazón de la aplicación. Vista de equipo completa para asignar tareas semana a semana.

#### 🧠 Lógica Mensual Estricta
El sistema usa "Cajas Mensuales":
*   Las semanas que cruzan entre meses (ej: 29 Ene - 4 Feb) se muestran como dos semanas separadas.
*   Las horas se asignan al mes que estás visualizando, garantizando reportes mensuales exactos.

#### ⚡ Herramientas de Productividad
*   **Carga Masiva:** Botón `+` en cada semana para añadir múltiples tareas de golpe.
*   **Edición Inline:** Doble clic sobre el nombre de una tarea para renombrarla al instante.
*   **Mover Tareas:** Menú contextual (tres puntos) para posponer tareas a otra semana.
*   **Dependencias:** Marca tareas que dependen de otras. El sistema alertará si hay bloqueos.

#### 📊 Control de Horas
*   **Estimadas (Est):** Horas planificadas al crear la tarea.
*   **Reales (Real):** Horas trabajadas. Se introducen al completar la tarea.
*   **Computadas (Comp):** Horas facturables al cliente.
*   **Alertas Visuales:** Indicadores de desvío cuando Real > Estimado.

### 3. Gestión de Proyectos

Panel completo de todos los proyectos activos con filtros inteligentes:

*   **Filtros de Estado:** Sin actividad, Falta planificar, Retrasados, Sobre presupuesto, En riesgo.
*   **Vista de Progreso:** Barras visuales de ejecución vs presupuesto.
*   **OKRs por Proyecto:** Objetivos específicos con seguimiento de progreso.
*   **Métricas en Tiempo Real:**
    *   Horas planificadas vs ejecutadas.
    *   Balance (ganancia/pérdida de horas).
    *   Tareas completadas vs pendientes.
*   **Estados de Salud:** Healthy, Needs Attention, At Risk.

### 4. Gestión de Equipo

Administración completa de empleados:

*   **Perfil del Empleado:**
    *   Datos básicos (nombre, email, rol, departamento).
    *   Tarifa por hora.
    *   ID de usuario del CRM para exportaciones.
*   **Horario Personalizado:** Configura horas por día de la semana.
*   **Acceso al Sistema:** Crea credenciales de Supabase Auth directamente desde el panel.
*   **Festivos y Eventos:** Gestiona días festivos que afectan la capacidad del equipo.
*   **Ausencias:** Vacaciones, bajas médicas, permisos personales.
*   **Objetivos Profesionales:** OKRs individuales con Key Results booleanos o numéricos.

### 5. Reportes y Métricas

Dashboard analítico con tres vistas principales:

#### Visión General
*   **KPIs del Mes:** Capacidad, Planificado, Real, Computado.
*   **Tasa de Ocupación:** % de capacidad utilizada.
*   **Tasa de Rentabilidad:** Ratio Computado vs Real (si es < 100%, trabajamos más de lo que facturamos).

#### Desglose por Equipo
*   **Ocupación Individual:** Barra de progreso por empleado.
*   **Rentabilidad Individual:** Comparativa Real vs Computado.
*   **Índice de Fiabilidad (NUEVO):** Métrica histórica que mide la precisión de las estimaciones.
    *   `100%` = Estimaciones perfectas.
    *   `< 100%` = Subestima (estima menos de lo que tarda).
    *   `> 100%` = Sobreestima.
    *   Badge con código de colores y tooltip detallado.

#### Desglose por Proyectos
*   Tarjetas con estado visual (verde/amarillo/rojo).
*   Progreso sobre presupuesto.
*   Balance de horas (ganancia/pérdida).

### 6. Copiloto IA (Minguito)

Asistente virtual potenciado por IA (Google Gemini + OpenRouter fallback).

*   **Preguntas Inteligentes:**
    *   "¿Cómo está la carga del equipo?"
    *   "¿Hay dependencias bloqueantes?"
    *   "¿Qué proyectos van lentos?"
    *   "¿Qué tareas arrastramos de semanas pasadas?"
*   **Contexto Dinámico:** Solo carga en memoria los datos relevantes a tu pregunta.
*   **Detección Automática:**
    *   Tareas Zombie (pendientes de semanas anteriores).
    *   Bloqueos de dependencias.
    *   Proyectos con bajo ritmo de ejecución.
*   **Multi-Modelo con Fallback:** Cadena de modelos gratuitos si el principal falla.

### 7. Módulo PPC (Google Ads + Meta Ads)

Control centralizado de campañas publicitarias:

*   **Dashboard de Cuentas:** Vista unificada de todas las cuentas activas.
*   **Métricas Clave:** Inversión, Conversiones, CPA, CTR.
*   **Segmentación Virtual:** Agrupa campañas bajo nombres virtuales para reportes.
*   **Sincronización Automática:** Workers de Node.js para importar datos diariamente.
*   **Generador de Informes:** Informes ejecutivos con análisis IA integrado.

---

## 💻 Documentación Técnica

### Stack Tecnológico

| Categoría | Tecnología |
|-----------|------------|
| Frontend | React 18 + TypeScript |
| Build Tool | Vite |
| Estilos | Tailwind CSS + Shadcn/ui |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions) |
| IA | Google Gemini API + OpenRouter (fallback) |
| Fechas | date-fns |
| Drag & Drop | dnd-kit |
| State | React Context + TanStack Query |
| Routing | React Router v6 |

### Arquitectura del Proyecto

```bash
src/
├── components/
│   ├── auth/           # ProtectedRoute, Login
│   ├── dashboard/      # Widgets del Dashboard IA
│   ├── employee/       # MyWeekView, WelcomeTour, DashboardWidgets
│   ├── layout/         # AppLayout, Sidebar
│   ├── planner/        # PlannerGrid, AllocationSheet, EmployeeRow
│   ├── team/           # EmployeeDialog, ScheduleEditor, AbsencesSheet
│   ├── ui/             # Componentes Shadcn/ui
│   └── ...
├── contexts/
│   ├── AppContext.tsx  # Estado global (employees, projects, allocations)
│   └── AuthContext.tsx # Sesión de Supabase
├── pages/
│   ├── EmployeeDashboard.tsx  # Mi Espacio (/)
│   ├── Index.tsx              # Planificador (/planner)
│   ├── ProjectsPage.tsx       # Proyectos
│   ├── ClientsPage.tsx        # Clientes
│   ├── TeamPage.tsx           # Equipo
│   ├── ReportsPage.tsx        # Reportes y Métricas
│   ├── DashboardAI.tsx        # Copiloto IA
│   ├── AdsPage.tsx            # Google Ads
│   ├── MetaAdsPage.tsx        # Meta Ads
│   └── ...
├── lib/
│   ├── supabase.ts     # Cliente Supabase
│   └── utils.ts        # Utilidades (cn, formatters)
├── utils/
│   ├── dateUtils.ts    # Lógica de fechas y capacidad
│   └── aiReportUtils.ts # Generación de informes IA
├── types/
│   └── index.ts        # Interfaces TypeScript
└── App.tsx             # Router principal
```

### Base de Datos

El sistema usa **Supabase (PostgreSQL)** con las siguientes tablas principales:

#### Entidades Core

```sql
-- EMPLEADOS
employees (
  id, name, email, role, department,
  default_weekly_capacity, work_schedule (JSONB),
  hourly_rate, is_active, user_id (FK auth.users),
  crm_user_id, avatar_url
)

-- CLIENTES
clients (id, name, color)

-- PROYECTOS
projects (
  id, client_id, name, status,
  budget_hours, minimum_hours, monthly_fee,
  health_status, okrs (JSONB), deliverables_log (JSONB),
  external_id, project_type
)
```

#### Operaciones

```sql
-- ASIGNACIONES (Core del Planner)
allocations (
  id, employee_id, project_id,
  week_start_date,          -- Clave para la lógica mensual
  hours_assigned,           -- Estimadas
  hours_actual,             -- Reales
  hours_computed,           -- Facturables
  status, task_name, description,
  dependency_id             -- FK a otra allocation
)

-- AUSENCIAS
absences (
  id, employee_id,
  start_date, end_date,
  type, hours, description
)

-- EVENTOS DE EQUIPO (Festivos)
team_events (
  id, name, date,
  hours_reduction,
  affected_employee_ids (JSONB)
)

-- OBJETIVOS PROFESIONALES
professional_goals (
  id, employee_id, title,
  key_results (JSONB),
  progress, due_date, training_url
)
```

#### Módulo PPC

```sql
-- GOOGLE ADS
google_ads_campaigns (
  campaign_id, date,        -- PK compuesta
  client_id, client_name, campaign_name,
  status, cost, clicks, impressions,
  conversions, conversions_value, daily_budget
)

-- META ADS
meta_ads_campaigns (
  id, client_id, campaign_id, date,
  campaign_name, status,
  cost, impressions, clicks,
  conversions, conversions_value
)

-- CONFIGURACIÓN DE CUENTAS
ad_accounts_config (
  id, platform, account_id, account_name,
  is_active, budget, is_sales_objective
)

-- SEGMENTACIÓN VIRTUAL
segmentation_rules (
  id, platform, account_id,
  keyword, virtual_name
)
```

### Autenticación

El sistema usa **Supabase Auth** con el siguiente flujo:

1. **Login:** `/login` → `supabase.auth.signInWithPassword()`
2. **Protección de Rutas:** `<ProtectedRoute>` verifica sesión activa.
3. **Creación de Usuarios:** Edge Function `create-user` con Service Role Key.
4. **Vinculación:** Campo `user_id` en `employees` conecta auth con datos.

```tsx
// Flujo de rutas protegidas
<Route element={<ProtectedRoute />}>
  <Route element={<AppLayout />}>
    <Route path="/" element={<EmployeeDashboard />} />
    <Route path="/planner" element={<Index />} />
    ...
  </Route>
</Route>
```

### Instalación y Despliegue

#### 1. Clonar e Instalar

```bash
git clone <repo-url>
cd timeboxing
npm install
```

#### 2. Configurar Supabase

1. Crear proyecto en [supabase.com](https://supabase.com)
2. Ejecutar el schema SQL en el editor de Supabase
3. Habilitar RLS (Row Level Security) en las tablas
4. Desplegar Edge Functions:

```bash
supabase functions deploy create-user
supabase functions deploy update-user
```

#### 3. Variables de Entorno

Crear archivo `.env`:

```env
# Supabase
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Solo para workers

# IA
VITE_GEMINI_API_KEY=AIza...
VITE_OPENROUTER_API_KEY=sk-...    # Opcional, fallback

# Google Ads (opcional)
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_DEVELOPER_TOKEN=xxx
GOOGLE_REFRESH_TOKEN=xxx
GOOGLE_MCC_ID=xxx

# Meta Ads (opcional)
META_ACCESS_TOKEN=xxx
META_AD_ACCOUNT_IDS=act_xxx,act_yyy
```

#### 4. Ejecutar

```bash
# Desarrollo
npm run dev

# Producción
npm run build
npm run preview
```

#### 5. Workers de Sincronización (PPC)

```bash
# Google Ads
node ads-worker.js

# Meta Ads
node meta-worker.js

# Programar con cron para ejecución diaria
```

### Variables de Entorno

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `VITE_SUPABASE_URL` | ✅ | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Clave pública de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ | Solo para workers y Edge Functions |
| `VITE_GEMINI_API_KEY` | ✅ | API Key de Google Gemini |
| `VITE_OPENROUTER_API_KEY` | ❌ | Fallback para IA |
| `GOOGLE_*` | ❌ | Credenciales de Google Ads API |
| `META_*` | ❌ | Credenciales de Meta Marketing API |

---

## 🔐 Conceptos Clave

### Storage Keys (Lógica de Fechas)

Para la separación estricta por meses:

```typescript
// src/utils/dateUtils.ts
getStorageKey(weekStart: Date, viewDate: Date): string
```

Si una semana cruza meses, la `storageKey` fuerza la asociación al mes de la vista actual.

### Índice de Fiabilidad

Nueva métrica que evalúa la precisión histórica de estimaciones:

```typescript
// Fórmula
Fiabilidad = (Total Horas Estimadas / Total Horas Reales) × 100

// Interpretación
100% = Perfecto
< 100% = Subestima (tarda más de lo que estima)
> 100% = Sobreestima (tarda menos de lo que estima)

// Ejemplo: Aarón
Estimadas: 9h, Reales: 24h
Fiabilidad = (9/24) × 100 = 37.5% → Subestima sistemáticamente
```

### Contexto Dinámico IA

El copiloto construye contexto inteligentemente:

1. Analiza la pregunta buscando nombres de empleados/proyectos.
2. Inyecta datos **detallados** solo para las coincidencias.
3. El resto se inyecta como **resumen** para ahorrar tokens.

---

## 📄 Licencia

MIT License - Desarrollado con ❤️ por el equipo de Timeboxing.
