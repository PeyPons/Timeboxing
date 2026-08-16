
## 4. Gestión del Estado Global (Contextos)

### 4.1. AppContext: El Motor de Datos
Gestiona la carga de la base de datos principal (`employees`, `projects`, `allocations`).
- **Patrón Upsert**: En lugar de recargar todo, utiliza funciones que mezclan los datos nuevos con los existentes, manteniendo la integridad de la UI.
- **`loadedMonthsRef`**: Un Set que registra qué meses ya están en memoria para evitar llamadas redundantes a la base de datos.
- **`loadMonthData` / `loadDataForMonth`**: devuelven `true` solo si la carga de **allocations** del mes terminó sin error (incluye mes sin tareas: merge con lista vacía). Otros recursos del mes (ausencias, eventos, feedback) pueden fallar en silencio aparte de log en consola.
- **`ensureMonthLoaded`**: solo añade el mes a `loadedMonthsRef` cuando `loadDataForMonth` devuelve `true`; si falla allocations, no se marca y el siguiente cambio de vista al mes reintenta. Las peticiones en vuelo se deduplican por clave `yyyy-MM` (`monthLoadInflightRef`).
- **`ensureMonthsLoadedInRange`**: recorre cada mes (inicio de mes) entre dos fechas y llama a `ensureMonthLoaded` en secuencia; útil para precargar varios meses (p. ej. vista de un entregable multi-mes) sin duplicar lógica de caché.

### 4.2. Estrategia de Realtime y Colaboración
Para soportar múltiples usuarios concurrentes sin saturar conexiones WebSocket, utilizamos una estrategia de **Canales Unificados**.

#### Tablas con Realtime habilitado (solo estas)
En Supabase (Database → Replication / publicación `supabase_realtime`) deben estar **únicamente** estas tablas. El resto conviene tenerlas deshabilitadas para reducir carga y conexiones.

| Tabla | Uso en la app |
|-------|----------------|
| `allocations` | AppContext (planificador) y TeamPulsePage |
| `allocation_notes` | TanStack Query (`useAllocationNotes`); invalidación vía `useAllocationNotesRealtime` en AppLayout (no en AppContext) |
| `projects` | AppContext |
| `absences` | AppContext |
| `team_events` | AppContext |
| `deadlines` | DeadlinesPage |
| `global_assignments` | DeadlinesPage |
| `project_editing_locks` | DeadlinesPage (bloqueos de edición) |
| `ads_sync_logs` | AdsPage (estado de sync Google Ads) |
| `meta_sync_logs` | MetaAdsPage (estado de sync Meta Ads) |

#### Arquitectura de Canales (`DeadlinesPage`)
En lugar de abrir una conexión por entidad, abrimos **un solo canal por sala** (mes/contexto) que transporta todos los tipos de eventos.
- **Antes (Ineficiente)**: 3 canales por usuario (`deadlines`, `assignments`, `locks`).
- **Ahora (Optimizado)**: 1 canal compartido: `deadlines-room-{YYYY-MM}`.

```typescript
// Patrón de suscripción unificada
const channel = supabase.channel(`deadlines-room-${selectedMonth}`)
  .on('postgres_changes', { table: 'deadlines' }, handleDeadlines)
  .on('postgres_changes', { table: 'global_assignments' }, handleAssignments)
  .on('postgres_changes', { table: 'project_editing_locks' }, handleLocks)
  .on('broadcast', { event: 'lock-released' }, handleBroadcasts)
  .subscribe();
```

#### Filtro por agencia en Realtime (Deadlines)
En `DeadlinesPage`, los eventos de la tabla `deadlines` se filtran por agencia: solo se aplican INSERT/UPDATE si el `project_id` del payload pertenece a un proyecto de la agencia actual (`projects.find(p => p.id === newDeadline.project_id)`). Así se evita que una agencia reciba en su estado deadlines de otra cuando comparten el mismo canal Realtime.

#### Sistema de Bloqueos (Locking)
Previene conflictos de edición simultánea en el mismo proyecto.
1. **Adquisición**: Al editar, se inserta (o se renueva) una fila en `project_editing_locks` con TTL ~60s. Si existe un lock **caducado** o **stale** (sin heartbeat reciente, <30s de margen), se toma el lock en lugar de bloquear.
2. **Validación**: Si hay un lock activo de otro usuario, la UI muestra badge + toast y bloquea la edición. `verifyEditLock` también sincroniza el badge (no solo el toast).
3. **Liberación**:
   - **Explícita**: Al cerrar la edición.
   - **Broadcast** `lock-released` + **Realtime DELETE** (ambos; el badge no depende solo del broadcast).
   - **Pestaña oculta**: se acorta el TTL y, si sigue oculta ~8s, se libera (alternativa ligera a un canal de presencia).
   - **Limpieza**: poda local de badges por `expiresAt` (~30s) y borrado en BD de filas caducadas.

---
