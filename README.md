# 📅 Timeboxing Manager

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-B73C9D?style=for-the-badge&logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-181818?style=for-the-badge&logo=supabase&logoColor=3ECF8E)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

Una aplicación moderna para la gestión de recursos, planificación de equipos y control de horas (Timeboxing). Diseñada para agencias y equipos que necesitan optimizar la asignación de tareas semanales evitando la sobrecarga de trabajo.

## ✨ Características Principales

* **👥 Gestión de Equipo:** Administración de empleados, roles y capacidades semanales.
* **🗓️ Planificador Visual:** Interfaz intuitiva para asignar proyectos y horas a cada miembro del equipo.
* **🧠 Asignación Inteligente:** Cálculos automáticos de carga de trabajo, detectando sobrecargas o disponibilidad en tiempo real.
* **🏖️ Gestión de Ausencias:** Control de vacaciones y bajas que ajusta automáticamente la capacidad disponible del empleado.
* **📊 Proyectos y Clientes:** Base de datos centralizada de clientes y proyectos con control de presupuestos de horas.
* **⚡ Edición Rápida:** Formularios modales optimizados para una gestión ágil sin recargas.

## 🛠️ Tecnologías

* **Frontend:** React 18 + TypeScript + Vite.
* **UI/UX:** Tailwind CSS + Shadcn/ui + Lucide Icons.
* **Backend / DB:** Supabase (PostgreSQL + Auth).
* **Estado:** React Context API + Hooks personalizados.

## 🚀 Instalación y Uso

1.  **Clonar el repositorio**
    ```bash
    git clone [https://github.com/tu-usuario/Timeboxing.git](https://github.com/tu-usuario/Timeboxing.git)
    cd Timeboxing
    ```

2.  **Instalar dependencias**
    ```bash
    npm install
    # o si usas bun
    bun install
    ```

3.  **Configurar Variables de Entorno**
    Crea un archivo `.env` en la raíz del proyecto con tus credenciales de Supabase:
    ```env
    VITE_SUPABASE_URL=tu_url_de_supabase
    VITE_SUPABASE_ANON_KEY=tu_clave_anonima
    ```

4.  **Ejecutar en desarrollo**
    ```bash
    npm run dev
    ```

## 🗄️ Estructura de Base de Datos (Supabase)

El proyecto requiere las siguientes tablas en Supabase:
* `employees`: Datos del personal y configuración horaria.
* `clients`: Cartera de clientes.
* `projects`: Proyectos vinculados a clientes.
* `allocations`: Asignación de horas (relación empleado-proyecto-semana).
* `absences`: Registro de vacaciones y ausencias.
* `team_events`: Eventos globales que reducen la capacidad (ej: festivos).

## 🤝 Contribución

Las contribuciones son bienvenidas. Por favor, abre un issue primero para discutir lo que te gustaría cambiar.

---
Desarrollado con ❤️ por [Tu Nombre]
