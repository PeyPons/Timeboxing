# 📅 Timeboxing Manager

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-B73C9D?style=for-the-badge&logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-181818?style=for-the-badge&logo=supabase&logoColor=3ECF8E)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Gemini AI](https://img.shields.io/badge/Gemini_AI-8E75B2?style=for-the-badge&logo=google-bard&logoColor=white)

Una aplicación integral para la gestión de recursos, planificación de equipos y control de horas (*timeboxing*). Diseñada para agencias y equipos que necesitan optimizar la asignación de tareas semanales evitando la sobrecarga de trabajo mediante una planificación mensual estricta e inteligencia artificial.

---

## 📖 Manual de Usuario

Esta sección explica cómo utilizar las funcionalidades principales de la aplicación para gestionar tu equipo día a día.

### 1. Panel de Control & Copiloto IA (Minguito)
El **Dashboard** es tu centro de mando. Aquí encontrarás a **Minguito**, tu asistente virtual potenciado por Google Gemini.

*   **¿Qué puede hacer Minguito?**
    *   Responder preguntas sobre la carga de trabajo actual (ej: *"¿Quién está sobreasignado esta semana?"*).
    *   Informar sobre el estado de proyectos y presupuestos.
    *   Consultar objetivos profesionales (OKRs) de los empleados.
*   **Modo Ahorro de Tokens:**
    *   El sistema utiliza una estrategia de "Contexto Dinámico". Minguito solo carga en su memoria los detalles de los empleados o proyectos que mencionas en tu pregunta. Esto hace que las respuestas sean más rápidas y económicas.
    *   Si preguntas por "Resumen general", Minguito cargará una vista simplificada de todo el equipo.

### 2. Planificador Mensual (Planner)
El corazón de la aplicación. Permite asignar tareas a los empleados semana a semana.

#### 🧠 Lógica Mensual Estricta
El sistema utiliza un modelo de "Cajas Mensuales".
*   Si una semana cae entre dos meses (ej: 29 Ene - 4 Feb), **se trata como dos semanas separadas visualmente** aunque sea la misma semana calendario.
*   Las horas asignadas para los días de Enero se guardan en Enero. Las de Febrero, en Febrero. Esto asegura que los informes mensuales sean exactos al 100%.

#### ⚡ Herramientas de Productividad
*   **Carga Masiva (Bulk Mode):**
    *   Al hacer clic en el botón `+` de una semana, se abre el formulario de tareas.
    *   Puedes añadir múltiples filas a la vez pulsando "Añadir otra fila".
    *   Ideal para planificar la semana completa de un empleado en un solo paso.
*   **Edición Rápida (Inline Editing):**
    *   Haz **doble clic** sobre el nombre de cualquier tarea en la lista para renombrarla al instante sin abrir ventanas emergentes.
    *   Presiona `Enter` para guardar.
*   **Mover Tareas:**
    *   Si necesitas posponer una tarea, pasa el ratón sobre ella, abre el menú de opciones (tres puntos) y selecciona "Mover a semana X". La tarea se trasladará automáticamente.

#### 📊 Control de Horas
*   **Estimadas vs. Reales:** Cada tarea tiene horas planificadas (Est). Al completar la tarea (marcando el checkbox), puedes introducir las horas reales (Comp).
*   **Alertas:** Si las horas reales superan a las estimadas, el sistema te avisará con un indicador rojo de desvío.

### 3. Gestión de Equipo
*   **Capacidad:** Configura cuántas horas trabaja cada empleado por defecto en la sección de Equipo.
*   **Ausencias:** Registra vacaciones o bajas. Estas se reflejan automáticamente en el Planificador reduciendo la capacidad disponible (barra de progreso y tooltip de desglose).

---

## 💻 Documentación para Desarrolladores

Guía técnica para configurar, entender y extender el proyecto.

### 🏗️ Arquitectura del Proyecto

El proyecto sigue una estructura modular basada en características (`src/components/feature`):

```bash
src/
├── components/
│   ├── dashboard/   # Lógica del Copiloto IA y widgets
│   ├── planner/     # Core del planificador (AllocationSheet, PlannerGrid)
│   ├── ui/          # Componentes base (Shadcn/ui)
│   └── ...
├── pages/           # Vistas principales (Rutas)
├── lib/
│   ├── supabase.ts  # Cliente e interfaces de base de datos
│   ├── gemini.ts    # Configuración del SDK de Google AI
│   └── utils.ts     # Utilidades generales (cn, formateadores)
└── App.tsx          # Router y Layout principal
```

### 🔐 Conceptos Clave

#### Storage Keys (Lógica de Fechas)
Para lograr la separación estricta por meses, usamos una `storageKey` única para cada asignación.
*   Función: `getStorageKey(weekStart, viewDate)` en `src/utils/dateUtils.ts`.
*   Si `weekStart` es 29/01/2024 pero estamos viendo la vista de **Febrero**, la key forzará la asociación al mes de vista si es necesario, o separará la capacidad proporcionalmente.

#### Integración IA (Contexto Dinámico)
En `DashboardAI.tsx`, el prompt del sistema se construye dinámicamente:
1.  Se analiza el input del usuario buscando nombres de empleados o proyectos.
2.  Se inyectan datos `DETALLADOS` solo para las coincidencias.
3.  El resto de datos se inyectan como `RESUMIDO` para dar contexto sin gastar tokens excesivos.

### 🚀 Instalación y Despliegue

1.  **Clonar y Dependencias:**
    ```bash
    git clone ...
    npm install
    ```

2.  **Variables de Entorno (.env):**
    ```env
    VITE_SUPABASE_URL="https://tu-proyecto.supabase.co"
    VITE_SUPABASE_ANON_KEY="tu-key-publica"
    VITE_GEMINI_API_KEY="tu-api-key-google-ai"
    ```

3.  **Base de Datos (Supabase):**
    Ejecuta el script SQL incluido abajo en el Editor SQL de Supabase para crear las tablas y políticas RLS.

### 🗄️ Esquema de Base de Datos

```sql
-- 1. TABLAS MAESTRAS
CREATE TABLE public.clients (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  color text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.employees (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  avatar_url text,
  role text NOT NULL,
  default_weekly_capacity int NOT NULL,
  work_schedule jsonb NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES public.clients(id),
  name text NOT NULL,
  status text DEFAULT 'active',
  budget_hours numeric DEFAULT 0,
  minimum_hours numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 2. OPERACIONES
CREATE TABLE public.allocations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id),
  week_start_date date NOT NULL, -- Clave vital para el planner
  hours_assigned numeric NOT NULL,
  hours_actual numeric DEFAULT 0, -- Control de horas reales
  task_name text,
  description text,
  status text DEFAULT 'planned',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.absences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  type text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.team_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  date date NOT NULL,
  hours_reduction numeric NOT NULL,
  affected_employee_ids jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.professional_goals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  title text NOT NULL,
  key_results text,
  progress int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 3. SEGURIDAD (RLS Básico para Demo)
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON public.employees FOR ALL USING (true);
-- Repetir para resto de tablas...
```

---
Desarrollado con ❤️ por el equipo de Timeboxing.
