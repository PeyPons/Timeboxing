# 📅 Timeboxing Manager

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-B73C9D?style=for-the-badge&logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-181818?style=for-the-badge&logo=supabase&logoColor=3ECF8E)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Gemini AI](https://img.shields.io/badge/Gemini_AI-8E75B2?style=for-the-badge&logo=google-bard&logoColor=white)

Una aplicación moderna para la gestión de recursos, planificación de equipos y control de horas (*timeboxing*). Diseñada para agencias y equipos que necesitan optimizar la asignación de tareas semanales evitando la sobrecarga de trabajo mediante una planificación mensual estricta e inteligencia artificial.

## ✨ Características Principales

### 🧠 Gestión Inteligente
* **📅 Planificador Mensual Estricto (*Smart Logic*):** Sistema único de "Llaves de Almacenamiento" que separa matemáticamente los meses. Las horas de una semana compartida (ej: 29 Dic - 4 Ene) no se mezclan; lo asignado en Enero pertenece a Enero y lo de Diciembre a Diciembre.
* **🤖 Copiloto IA (Minguito v2.0):** Asistente virtual potenciado por **Google Gemini**.
    * Analiza la carga de trabajo en tiempo real para detectar cuellos de botella.
    * Responde preguntas sobre proyectos, disponibilidad y objetivos profesionales (*OKRs*).
    * Ofrece recomendaciones proactivas para equilibrar el equipo.
* **📊 Métricas en Tiempo Real:** Visualización instantánea de capacidad vs. asignación, con alertas visuales de sobrecarga (*Overload*), zona óptima (*Sweet Spot*) e infrautilización.

### ⚡ Productividad y Flujo
* **🚀 Carga Masiva (*Bulk Mode*):** Formulario optimizado para añadir múltiples líneas de tareas a la vez, ideal para planificaciones rápidas.
* **✏️ Edición Rápida (*Inline*):** Edita nombres de tareas con doble clic y mueve tareas entre semanas mediante menús contextuales, sin necesidad de abrir modales complejos.
* **🗓️ Gestión de Festivos:** Opción de marcar "Día Completo" en eventos para descontar automáticamente la jornada laboral completa de la capacidad del equipo.

### 👥 Equipo y Proyección
* **🏆 Proyección Profesional:** Módulo dedicado para gestionar OKRs, planes de carrera y seguimiento de objetivos, conectado al contexto de la IA.
* **🏖️ Gestión de Ausencias:** Control de vacaciones y bajas que ajusta automáticamente la disponibilidad en el planificador.
* **🗂️ Organización Jerárquica:** Vista clara de *Proyecto > Tareas* en el planificador, manteniendo siempre visible el contexto del Cliente (nombre y color).

## 🛠️ Tecnologías

* **Frontend:** React 18 + TypeScript + Vite.
* **UI/UX:** Tailwind CSS + Shadcn/ui + Lucide Icons.
* **Backend / DB:** Supabase (PostgreSQL + Auth + RLS).
* **IA:** Google Generative AI SDK (Modelo `gemini-2.5-flash`).
* **Estado:** React Context API + Custom Hooks optimizados.
* **Fechas:** `date-fns` con lógica personalizada para periodos fiscales.

---

## 🚀 Instalación y uso

1.  **Clonar el repositorio**
    ```bash
    git clone [https://github.com/PeyPons/Timeboxing.git](https://github.com/PeyPons/Timeboxing.git)
    cd Timeboxing
    ```

2.  **Instalar dependencias**
    ```bash
    npm install
    # o si usas bun
    bun install
    ```

3.  **Configurar variables de entorno**
    Crea un archivo `.env` en la raíz del proyecto con tus credenciales:
    ```env
    VITE_SUPABASE_URL="[https://tu-proyecto.supabase.co](https://tu-proyecto.supabase.co)"
    VITE_SUPABASE_ANON_KEY="tu-clave-anonima-publica"

    # Clave requerida para el Copiloto IA (Minguito)
    VITE_GEMINI_API_KEY="tu-api-key-de-google-gemini"
    ```
    > **Nota:** Puedes obtener tu clave de IA en Google AI Studio. Si recibes errores 429, verifica los límites de uso de tu cuenta.

4.  **Ejecutar en desarrollo**
    ```bash
    npm run dev
    ```

## 🗄️ Estructura de base de datos (Supabase)

El proyecto requiere las siguientes tablas en Supabase. Puedes usar el editor SQL para crearlas:

* `employees`: Datos del personal, configuración horaria y capacidad.
* `clients`: Cartera de clientes con asignación de color.
* `projects`: Proyectos vinculados a clientes con presupuesto de horas.
* `allocations`: Asignación de horas (relación empleado-proyecto-semana con lógica de fechas estricta).
* `absences`: Registro de vacaciones y bajas.
* `team_events`: Eventos globales y festivos (con soporte para reducción parcial o día completo).
* `professional_goals`: Seguimiento de objetivos, formación y OKRs.

```sql
-- 1. TABLAS MAESTRAS (Clientes, Empleados, Proyectos)

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
  work_schedule jsonb NOT NULL, -- Ej: {"monday": 8, "tuesday": 8...}
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES public.clients(id),
  name text NOT NULL,
  status text DEFAULT 'active', -- 'active', 'archived', 'completed'
  budget_hours numeric DEFAULT 0,
  minimum_hours numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 2. TABLAS TRANSACCIONALES (Asignaciones, Ausencias, Eventos)

CREATE TABLE public.allocations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id),
  week_start_date date NOT NULL, -- Clave de almacenamiento inteligente (Storage Key)
  hours_assigned numeric NOT NULL,
  task_name text,
  description text,
  status text DEFAULT 'planned', -- 'planned', 'completed'
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.absences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  type text NOT NULL, -- 'vacation', 'sick_leave', etc.
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.team_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  date date NOT NULL,
  hours_reduction numeric NOT NULL,
  affected_employee_ids jsonb NOT NULL, -- Array de IDs de empleados afectados
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.professional_goals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  title text NOT NULL,
  key_results text,
  actions text,
  training_url text,
  start_date date,
  due_date date,
  progress int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 3. SEGURIDAD (Habilitar RLS y políticas públicas para desarrollo)

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Access Employees" ON public.employees FOR ALL USING (true);
CREATE POLICY "Public Access Clients" ON public.clients FOR ALL USING (true);
CREATE POLICY "Public Access Projects" ON public.projects FOR ALL USING (true);
CREATE POLICY "Public Access Allocations" ON public.allocations FOR ALL USING (true);
CREATE POLICY "Public Access Absences" ON public.absences FOR ALL USING (true);
CREATE POLICY "Public Access Events" ON public.team_events FOR ALL USING (true);
CREATE POLICY "Public Access Goals" ON public.professional_goals FOR ALL USING (true);
 ```


## 🤝 Contribución

Las contribuciones son bienvenidas. Por favor, abre un *issue* primero para discutir lo que te gustaría cambiar.

---
Desarrollado con ❤️ por Alexander y sus coleguitas Lovable y Gemini.
