# Propuestas de Mejora - Timeboxing

## 📋 Índice
1. [Arquitectura y Código](#arquitectura-y-código)
2. [Rendimiento](#rendimiento)
3. [Manejo de Errores](#manejo-de-errores)
4. [Testing](#testing)
5. [Logging y Debugging](#logging-y-debugging)
6. [Seguridad](#seguridad)
7. [UX/UI](#uxui)
8. [Base de Datos](#base-de-datos)
9. [DevOps y CI/CD](#devops-y-cicd)
10. [Documentación](#documentación)

---

## 🏗️ Arquitectura y Código

### 1. **Extraer lógica de IA duplicada a un servicio compartido**
**Problema**: La lógica de llamadas a IA está duplicada en 3 archivos:
- `src/utils/aiReportUtils.ts`
- `src/pages/DashboardAI.tsx`
- `src/components/planner/PlannerGrid.tsx`

**Solución**: Crear `src/services/aiService.ts` con funciones reutilizables:
```typescript
// src/services/aiService.ts
export class AIService {
  static async callWithFallback(prompt: string): Promise<AIResponse> {
    // Lógica centralizada con fallback
  }
  
  static async callGemini(prompt: string, apiKey: string): Promise<AIResponse> { }
  static async callOpenRouter(prompt: string, apiKey: string): Promise<AIResponse> { }
  static async callCoco(prompt: string): Promise<AIResponse> { }
}
```

**Beneficio**: 
- Elimina ~200 líneas de código duplicado
- Facilita mantenimiento y actualizaciones
- Consistencia en manejo de errores

---

### 2. **Dividir componentes grandes en componentes más pequeños**
**Problema**: 
- `DeadlinesPage.tsx`: 2029 líneas
- `EmployeeDashboard.tsx`: ~626 líneas
- `ProjectsPage.tsx`: ~1105 líneas

**Solución**: Dividir en componentes más pequeños:
```typescript
// DeadlinesPage.tsx → Dividir en:
- DeadlinesHeader.tsx
- DeadlinesFilters.tsx
- DeadlinesProjectList.tsx
- DeadlinesAvailabilityPanel.tsx
- DeadlinesGlobalAssignments.tsx
- DeadlinesRedistributionTips.tsx
```

**Beneficio**:
- Mejor mantenibilidad
- Reutilización de componentes
- Testing más fácil
- Mejor rendimiento (React.memo)

---

### 3. **Crear hooks personalizados para lógica repetitiva**
**Problema**: Lógica duplicada en múltiples componentes:
- Manejo de formularios
- Validación de datos
- Carga de datos de Supabase
- Manejo de estados de loading/error

**Solución**: Crear hooks personalizados:
```typescript
// src/hooks/useSupabaseQuery.ts
export function useSupabaseQuery<T>(table: string, filters?: any) {
  // Lógica de carga, error, loading
}

// src/hooks/useFormValidation.ts
export function useFormValidation(schema: ZodSchema) {
  // Validación con Zod
}

// src/hooks/useDebounce.ts
export function useDebounce<T>(value: T, delay: number) {
  // Debounce para inputs
}
```

---

### 4. **Extraer constantes mágicas a archivo de configuración**
**Problema**: Valores hardcodeados en el código:
- Timeouts (500ms, 2000ms, 800ms)
- Límites (50 logs, 10 campañas, 3 tips)
- Colores y estilos
- Mensajes de error

**Solución**: Crear `src/config/constants.ts`:
```typescript
export const CONSTANTS = {
  TIMEOUTS: {
    TOUR_DELAY: 500,
    AUTO_SAVE_DEBOUNCE: 800,
    LOCK_RENEWAL: 20000,
    LOCK_EXPIRATION: 60000,
  },
  LIMITS: {
    MAX_LOGS: 50,
    TOP_CAMPAIGNS: 10,
    MAX_TIPS: 3,
    MAX_HISTORICAL_MONTHS: 12,
  },
  UI: {
    TOAST_DURATION: 3000,
    MODAL_MAX_WIDTH: '2xl',
  }
};
```

---

### 5. **Mejorar tipado TypeScript**
**Problema**: Uso de `any` en varios lugares:
- `src/pages/AdsReportGenerator.tsx`: múltiples `any`
- `src/pages/DeadlinesPage.tsx`: `any` en varios lugares
- Funciones con tipos implícitos

**Solución**: 
- Crear interfaces específicas para cada caso
- Usar tipos genéricos donde sea apropiado
- Habilitar `strict: true` en tsconfig gradualmente

---

## ⚡ Rendimiento

### 6. **Optimizar re-renders con React.memo y useMemo**
**Problema**: Componentes grandes se re-renderizan innecesariamente

**Solución**: 
```typescript
// En componentes pesados como StatCard, ProjectRow, etc.
export const StatCard = React.memo(({ label, value, prevValue, formatFn, reverseColor }: StatCardProps) => {
  // ...
});

// En DeadlinesPage, usar useMemo para cálculos pesados
const filteredProjects = useMemo(() => {
  // Lógica de filtrado
}, [projects, searchTerm, onlySEO, showHidden, ...]);
```

---

### 7. **Implementar paginación/virtualización para listas grandes**
**Problema**: Renderizar todas las asignaciones/proyectos puede ser lento

**Solución**: 
- Usar `react-window` o `react-virtual` para listas largas
- Implementar paginación en tablas grandes
- Lazy loading de datos históricos

---

### 8. **Optimizar queries de Supabase**
**Problema**: Algunas queries cargan más datos de los necesarios

**Solución**:
```typescript
// En lugar de:
supabase.from('allocations').select('*')

// Usar:
supabase.from('allocations')
  .select('id, employee_id, project_id, hours_assigned, status')
  .eq('status', 'planned')
  .limit(100)
```

---

### 9. **Implementar caché de datos con React Query**
**Problema**: Datos se recargan innecesariamente

**Solución**: Ya tienes `@tanstack/react-query` instalado, pero no se usa en AppContext. Migrar a React Query:
```typescript
// En lugar de useState + useEffect, usar:
const { data: employees, isLoading } = useQuery({
  queryKey: ['employees'],
  queryFn: () => fetchEmployees(),
  staleTime: 5 * 60 * 1000, // 5 minutos
});
```

---

## 🛡️ Manejo de Errores

### 10. **Crear sistema centralizado de manejo de errores**
**Problema**: Manejo de errores inconsistente:
- Algunos usan `toast.error()`
- Otros solo `console.error()`
- Sin tracking de errores

**Solución**: Crear `src/services/errorService.ts`:
```typescript
export class ErrorService {
  static handle(error: Error, context: string) {
    // Log estructurado
    console.error(`[${context}]`, error);
    
    // Toast user-friendly
    toast.error(this.getUserMessage(error));
    
    // Enviar a servicio de tracking (Sentry, etc.)
    // this.trackError(error, context);
  }
  
  static getUserMessage(error: Error): string {
    // Mensajes amigables según tipo de error
  }
}
```

---

### 11. **Validación de datos con Zod**
**Problema**: Validación inconsistente o ausente

**Solución**: Ya tienes Zod instalado. Crear schemas:
```typescript
// src/schemas/employeeSchema.ts
import { z } from 'zod';

export const employeeSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  email: z.string().email('Email inválido'),
  defaultWeeklyCapacity: z.number().min(0).max(168),
  // ...
});
```

---

### 12. **Manejo de errores en Workers**
**Problema**: Workers (`ads-worker.js`, `meta-worker.js`) tienen manejo básico de errores

**Solución**:
- Retry logic con exponential backoff
- Dead letter queue para jobs fallidos
- Notificaciones cuando fallan múltiples veces
- Health checks

---

## 🧪 Testing

### 13. **Añadir tests unitarios**
**Problema**: No hay tests en el proyecto

**Solución**: Configurar Vitest (ya viene con Vite):
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});

// Ejemplo de test:
// src/utils/__tests__/dateUtils.test.ts
import { describe, it, expect } from 'vitest';
import { getMonthlyCapacity } from '../dateUtils';

describe('getMonthlyCapacity', () => {
  it('calcula correctamente la capacidad mensual', () => {
    // ...
  });
});
```

**Prioridad**: Empezar con:
1. Utilidades (`dateUtils`, `absenceUtils`)
2. Hooks personalizados
3. Componentes críticos (AppContext)

---

### 14. **Tests de integración para flujos críticos**
**Problema**: No hay validación de flujos completos

**Solución**: Tests E2E con Playwright:
```typescript
// tests/e2e/deadlines.spec.ts
test('usuario puede crear y editar deadline', async ({ page }) => {
  await page.goto('/deadlines');
  // ...
});
```

---

## 📊 Logging y Debugging

### 15. **Reemplazar console.log con sistema de logging estructurado**
**Problema**: 98 `console.log/error/warn` en el código

**Solución**: Crear `src/utils/logger.ts`:
```typescript
export const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${message}`, data);
    // Enviar a servicio de logging en producción
  },
  error: (message: string, error?: Error, context?: any) => {
    console.error(`[ERROR] ${message}`, error, context);
    // Enviar a Sentry/LogRocket/etc
  },
  warn: (message: string, data?: any) => {
    console.warn(`[WARN] ${message}`, data);
  },
  debug: (message: string, data?: any) => {
    if (import.meta.env.DEV) {
      console.debug(`[DEBUG] ${message}`, data);
    }
  },
};
```

---

### 16. **Añadir logging estructurado en Workers**
**Problema**: Workers solo usan `console.log`

**Solución**: Usar librería como `winston` o `pino`:
```javascript
// ads-worker.js
import pino from 'pino';
const logger = pino({ level: 'info' });

logger.info({ jobId, clientId }, 'Procesando cuenta');
logger.error({ jobId, error: err.message }, 'Error procesando');
```

---

## 🔒 Seguridad

### 17. **Validar y sanitizar inputs del usuario**
**Problema**: Inputs sin validación pueden causar problemas

**Solución**: 
- Validar todos los inputs con Zod
- Sanitizar strings antes de guardar
- Validar en frontend Y backend (Edge Functions)

---

### 18. **Rate limiting en APIs de IA**
**Problema**: Sin límites de rate limiting

**Solución**: Implementar rate limiting:
```typescript
// src/services/rateLimiter.ts
export class RateLimiter {
  private static requests: Map<string, number[]> = new Map();
  
  static checkLimit(userId: string, maxRequests: number, windowMs: number): boolean {
    // Implementar lógica de rate limiting
  }
}
```

---

### 19. **Protección CSRF para operaciones críticas**
**Problema**: Sin protección CSRF explícita

**Solución**: Supabase ya maneja esto, pero verificar que todas las operaciones críticas (delete, update) requieren autenticación.

---

## 🎨 UX/UI

### 20. **Mejorar estados de carga**
**Problema**: Algunos componentes no muestran estados de carga claros

**Solución**: Componente reutilizable:
```typescript
// src/components/ui/LoadingState.tsx
export function LoadingState({ message = 'Cargando...' }) {
  return (
    <div className="flex items-center justify-center p-8">
      <Loader2 className="animate-spin mr-2" />
      <span>{message}</span>
    </div>
  );
}
```

---

### 21. **Añadir skeletons en lugar de spinners**
**Problema**: Spinners genéricos no dan contexto

**Solución**: Usar `Skeleton` de shadcn/ui para mostrar estructura mientras carga.

---

### 22. **Mejorar accesibilidad (a11y)**
**Problema**: Falta de atributos ARIA y navegación por teclado

**Solución**:
- Añadir `aria-label` a botones sin texto
- Asegurar navegación por teclado
- Contraste de colores adecuado
- Screen reader friendly

---

### 23. **Optimistic UI updates**
**Problema**: Cambios esperan respuesta del servidor

**Solución**: Actualizar UI inmediatamente, revertir si falla:
```typescript
const updateProject = async (project: Project) => {
  // Optimistic update
  setProjects(prev => prev.map(p => p.id === project.id ? project : p));
  
  try {
    await supabase.from('projects').update(...).eq('id', project.id);
  } catch (error) {
    // Revertir cambio
    setProjects(prev => prev.map(p => p.id === project.id ? originalProject : p));
    toast.error('Error al guardar');
  }
};
```

---

## 🗄️ Base de Datos

### 24. **Índices faltantes en tablas grandes**
**Problema**: Queries pueden ser lentas sin índices adecuados

**Solución**: Revisar y añadir índices:
```sql
-- Ejemplo para allocations
CREATE INDEX IF NOT EXISTS idx_allocations_employee_week 
ON allocations(employee_id, week_start_date);

CREATE INDEX IF NOT EXISTS idx_allocations_project 
ON allocations(project_id);

-- Para deadlines
CREATE INDEX IF NOT EXISTS idx_deadlines_month_project 
ON deadlines(month, project_id);
```

---

### 25. **Implementar soft deletes**
**Problema**: Deletes son permanentes, sin posibilidad de recuperar

**Solución**: Añadir campo `deleted_at`:
```sql
ALTER TABLE employees ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE projects ADD COLUMN deleted_at TIMESTAMP;
-- etc.
```

---

### 26. **Auditoría de cambios**
**Problema**: No hay historial de quién cambió qué y cuándo

**Solución**: Tabla de auditoría:
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL, -- INSERT, UPDATE, DELETE
  old_data JSONB,
  new_data JSONB,
  user_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🚀 DevOps y CI/CD

### 27. **Configurar CI/CD con GitHub Actions**
**Problema**: No hay automatización de tests/builds

**Solución**: `.github/workflows/ci.yml`:
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run test
      - run: npm run build
```

---

### 28. **Variables de entorno gestionadas**
**Problema**: Variables de entorno pueden estar hardcodeadas

**Solución**: 
- Usar `.env.example` con valores de ejemplo
- Documentar todas las variables necesarias
- Validar variables al inicio de la app

---

### 29. **Health checks para Workers**
**Problema**: No hay forma de verificar si workers están funcionando

**Solución**: Endpoint de health check:
```javascript
// En worker
setInterval(async () => {
  await supabase.from('worker_health').upsert({
    worker_name: 'ads-worker',
    last_heartbeat: new Date(),
    status: 'healthy'
  });
}, 60000);
```

---

## 📚 Documentación

### 30. **Documentar componentes con JSDoc**
**Problema**: Falta documentación en componentes

**Solución**: Añadir JSDoc:
```typescript
/**
 * Componente para mostrar estadísticas de un proyecto
 * @param project - Datos del proyecto
 * @param onEdit - Callback cuando se edita
 * @example
 * <ProjectCard project={project} onEdit={handleEdit} />
 */
export function ProjectCard({ project, onEdit }: ProjectCardProps) {
  // ...
}
```

---

### 31. **Crear guía de contribución**
**Problema**: Sin guía para nuevos desarrolladores

**Solución**: `CONTRIBUTING.md` con:
- Estructura del proyecto
- Convenciones de código
- Cómo ejecutar tests
- Proceso de PR

---

### 32. **Documentar APIs y contratos**
**Problema**: Sin documentación de las funciones públicas

**Solución**: 
- Documentar funciones exportadas
- Crear `API.md` con ejemplos
- Documentar tipos en `types/index.ts`

---

## 🎯 Priorización

### Alta Prioridad (Implementar primero)
1. ✅ **Extraer lógica de IA duplicada** (#1)
2. ✅ **Sistema de logging estructurado** (#15)
3. ✅ **Manejo de errores centralizado** (#10)
4. ✅ **Dividir DeadlinesPage** (#2)
5. ✅ **Añadir tests básicos** (#13)

### Media Prioridad
6. ✅ **Optimizar re-renders** (#6)
7. ✅ **Validación con Zod** (#11)
8. ✅ **Extraer constantes** (#4)
9. ✅ **Hooks personalizados** (#3)
10. ✅ **Índices de BD** (#24)

### Baja Prioridad (Mejoras futuras)
11. ✅ **Tests E2E** (#14)
12. ✅ **CI/CD** (#27)
13. ✅ **Soft deletes** (#25)
14. ✅ **Auditoría** (#26)
15. ✅ **Documentación completa** (#30-32)

---

## 📝 Notas Adicionales

### Código Limpio
- Revisar y eliminar código comentado
- Eliminar imports no usados
- Consistencia en nombres de variables/funciones

### Performance Monitoring
- Considerar añadir monitoring (Sentry, LogRocket)
- Métricas de rendimiento (Web Vitals)
- Tracking de errores en producción

### Internacionalización (i18n)
- Si planeas múltiples idiomas, considerar `react-i18next`
- Extraer todos los textos a archivos de traducción

---

**Última actualización**: $(date)
**Revisado por**: AI Assistant
**Próxima revisión**: Después de implementar mejoras de alta prioridad

