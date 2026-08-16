/**
 * Fixtures de lectura para tests (siempre en el repo).
 * Datos sintéticos / anonimizados — no PII real, no passwords.
 * Para pruebas contra BD live opcional: env `TAIMBOX_READONLY_DATABASE_URL` (gitignored / secreto).
 */

import type { Deadline, Project } from '@/types';

/** Proyecto cerrado que ya no debería copiarse al mes nuevo. */
export const fixtureClosedProject: Project = {
  id: 'fix-closed-1',
  agencyId: 'fix-agency-1',
  clientId: 'fix-client-1',
  name: 'Entregable cerrado (fixture)',
  status: 'completed',
  budgetHours: 40,
  minimumHours: 0,
  monthlyFee: 0,
  projectType: 'Entregable',
};

export const fixtureActiveProject: Project = {
  id: 'fix-active-1',
  agencyId: 'fix-agency-1',
  clientId: 'fix-client-1',
  name: 'Retainer activo (fixture)',
  status: 'active',
  budgetHours: 20,
  minimumHours: 0,
  monthlyFee: 1000,
  projectType: 'Mensual',
};

export const fixtureProjects: Project[] = [fixtureActiveProject, fixtureClosedProject];

/** Deadlines del mes anterior: activo + cerrado (el cerrado no debe copiarse). */
export const fixturePreviousMonthDeadlines: Deadline[] = [
  {
    id: 'fix-dl-active',
    projectId: fixtureActiveProject.id,
    month: '2026-07',
    employeeHours: { 'fix-emp-1': 10 },
    isHidden: false,
  },
  {
    id: 'fix-dl-closed',
    projectId: fixtureClosedProject.id,
    month: '2026-07',
    employeeHours: { 'fix-emp-1': 12 },
    isHidden: false,
  },
];
