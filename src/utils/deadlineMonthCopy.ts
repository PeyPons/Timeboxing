import type { Deadline, Project } from '@/types';

export type DeadlineMonthCopySelection<T extends Pick<Deadline, 'projectId'>> = {
  /** Deadlines del mes anterior que se pueden insertar en el mes destino. */
  toCopy: T[];
  /** Ya existían en el mes destino (mismo projectId). */
  skippedExisting: number;
  /** Proyecto ausente del catálogo de la agencia. */
  skippedMissingProject: number;
  /** Proyecto no activo (completed/archived): no se debe arrastrar al mes nuevo. */
  skippedInactiveProject: number;
};

/**
 * Selecciona qué deadlines del mes anterior copiar al mes actual.
 * Solo proyectos **active** y que aún no tengan fila en el mes destino.
 * Evita fantasma: proyectos cerrados/archivados desaparecen de la UI de Deadlines
 * pero seguirían marcando horas en Dashboard/capacidad si se copiaran.
 */
export function selectDeadlinesToCopyFromPreviousMonth<T extends Pick<Deadline, 'projectId'>>(
  previousDeadlines: T[],
  options: {
    existingProjectIds: Iterable<string>;
    projects: Iterable<Pick<Project, 'id' | 'status'>>;
  }
): DeadlineMonthCopySelection<T> {
  const existing = new Set(options.existingProjectIds);
  const statusById = new Map<string, Project['status']>();
  for (const p of options.projects) {
    statusById.set(p.id, p.status);
  }

  const toCopy: T[] = [];
  let skippedExisting = 0;
  let skippedMissingProject = 0;
  let skippedInactiveProject = 0;

  for (const d of previousDeadlines) {
    const status = statusById.get(d.projectId);
    if (status === undefined) {
      skippedMissingProject += 1;
      continue;
    }
    if (status !== 'active') {
      skippedInactiveProject += 1;
      continue;
    }
    if (existing.has(d.projectId)) {
      skippedExisting += 1;
      continue;
    }
    toCopy.push(d);
  }

  return { toCopy, skippedExisting, skippedMissingProject, skippedInactiveProject };
}
