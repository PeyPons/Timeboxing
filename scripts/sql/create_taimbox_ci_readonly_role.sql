-- Rol de CI / agentes: SOLO LECTURA sobre schema public.
-- NO commitear contraseñas. Aplicar con scripts/create-ci-readonly-role.sh
--
-- Sustituye __READONLY_PASSWORD__ antes de ejecutar, o usa el script (recomendado).
--
-- Capacidad: SELECT (+ BYPASSRLS para ver filas reales en tests).
-- Sin INSERT/UPDATE/DELETE/TRUNCATE/DDL. Sin CREATEDB/CREATEROLE/REPLICATION.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'taimbox_ci_readonly') THEN
    CREATE ROLE taimbox_ci_readonly
      LOGIN
      PASSWORD '__READONLY_PASSWORD__'
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      NOREPLICATION
      BYPASSRLS;
  ELSE
    ALTER ROLE taimbox_ci_readonly WITH
      LOGIN
      PASSWORD '__READONLY_PASSWORD__'
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      NOREPLICATION
      BYPASSRLS;
  END IF;
END
$$;

-- Timeout corto: evita queries colgadas en CI/agentes.
ALTER ROLE taimbox_ci_readonly SET statement_timeout = '15s';
ALTER ROLE taimbox_ci_readonly SET lock_timeout = '5s';

GRANT CONNECT ON DATABASE postgres TO taimbox_ci_readonly;
GRANT USAGE ON SCHEMA public TO taimbox_ci_readonly;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO taimbox_ci_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO taimbox_ci_readonly;

-- Tablas futuras creadas por roles habituales del stack self-hosted.
DO $$
DECLARE
  owner_role text;
BEGIN
  FOREACH owner_role IN ARRAY ARRAY['supabase_admin', 'postgres', 'authenticator']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = owner_role) THEN
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT ON TABLES TO taimbox_ci_readonly',
        owner_role
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT ON SEQUENCES TO taimbox_ci_readonly',
        owner_role
      );
    END IF;
  END LOOP;
END
$$;

-- Defensa en profundidad: quitar escritura aunque alguien la hubiera concedido.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM taimbox_ci_readonly;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM taimbox_ci_readonly;
-- Re-grant EXECUTE solo no es necesario; sin GRANT no ejecuta RPC de negocio.

COMMENT ON ROLE taimbox_ci_readonly IS
  'CI/Cloud agents: SELECT-only (+ BYPASSRLS) on public. Connection string goes in secret TAIMBOX_READONLY_DATABASE_URL — never in git.';
