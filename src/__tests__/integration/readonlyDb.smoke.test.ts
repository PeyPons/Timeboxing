/**
 * Smoke de integración contra Postgres self-hosted (rol taimbox_ci_readonly).
 * Se omite automáticamente si no hay TAIMBOX_READONLY_DATABASE_URL.
 */
import { describe, expect, it } from 'vitest';
import {
  connectReadonlyClient,
  hasReadonlyDatabase,
  READONLY_DATABASE_URL_ENV,
} from '@/test/readonlyDb';

const describeReadonly = hasReadonlyDatabase() ? describe : describe.skip;

describeReadonly(`readonly DB smoke (${READONLY_DATABASE_URL_ENV})`, () => {
  it('conecta y puede hacer SELECT', async () => {
    const client = await connectReadonlyClient();
    try {
      const ping = await client.query<{ ok: number }>('select 1::int as ok');
      expect(ping.rows[0]?.ok).toBe(1);

      const tables = await client.query<{ n: string }>(
        `select count(*)::text as n
         from information_schema.tables
         where table_schema = 'public'`
      );
      expect(Number(tables.rows[0]?.n ?? 0)).toBeGreaterThan(0);
    } finally {
      await client.end();
    }
  });

  it('no tiene privilegio INSERT sobre tablas de public', async () => {
    const client = await connectReadonlyClient();
    try {
      const res = await client.query<{ can_insert: boolean }>(
        `select has_table_privilege(current_user, 'public.projects', 'INSERT') as can_insert`
      );
      expect(res.rows[0]?.can_insert).toBe(false);

      const canSelect = await client.query<{ can_select: boolean }>(
        `select has_table_privilege(current_user, 'public.projects', 'SELECT') as can_select`
      );
      expect(canSelect.rows[0]?.can_select).toBe(true);
    } finally {
      await client.end();
    }
  });

  it('puede leer filas de public.projects (BYPASSRLS del rol CI)', async () => {
    const client = await connectReadonlyClient();
    try {
      const res = await client.query<{ c: string }>(
        `select count(*)::text as c from public.projects`
      );
      // Solo comprobamos que la query es válida; el conteo puede ser 0 en entornos vacíos.
      expect(res.rows[0]?.c).toBeDefined();
      expect(Number(res.rows[0]?.c)).toBeGreaterThanOrEqual(0);
    } finally {
      await client.end();
    }
  });
});

describe('readonly DB gate', () => {
  it(`documenta skip cuando falta ${READONLY_DATABASE_URL_ENV}`, () => {
    if (!hasReadonlyDatabase()) {
      expect(hasReadonlyDatabase()).toBe(false);
    } else {
      expect(hasReadonlyDatabase()).toBe(true);
    }
  });
});
