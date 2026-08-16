/**
 * Acceso opcional a Postgres self-hosted en modo solo lectura.
 * Requiere secreto/env `TAIMBOX_READONLY_DATABASE_URL` (nunca en el repo).
 * Si no está definido, los tests que lo usen deben hacer skip.
 */

import pg from 'pg';

const ENV_KEY = 'TAIMBOX_READONLY_DATABASE_URL';

export function getReadonlyDatabaseUrl(): string | undefined {
  const raw = process.env[ENV_KEY]?.trim();
  return raw && raw.length > 0 ? raw : undefined;
}

export function hasReadonlyDatabase(): boolean {
  return Boolean(getReadonlyDatabaseUrl());
}

/** Abre un cliente pg. El caller debe llamar a `client.end()`. */
export async function connectReadonlyClient(): Promise<pg.Client> {
  const connectionString = getReadonlyDatabaseUrl();
  if (!connectionString) {
    throw new Error(`${ENV_KEY} no está definido`);
  }
  if (!connectionString.includes('taimbox_ci_readonly')) {
    // Defensa blanda: evita usar por error la URL de admin en tests.
    console.warn(
      `[readonlyDb] ${ENV_KEY} no parece usar el rol taimbox_ci_readonly; asegúrate de que sea SELECT-only.`
    );
  }
  const client = new pg.Client({
    connectionString,
    connectionTimeoutMillis: 10_000,
    query_timeout: 15_000,
  });
  await client.connect();
  await client.query("set statement_timeout = '15s'");
  return client;
}

export { ENV_KEY as READONLY_DATABASE_URL_ENV };
