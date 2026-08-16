#!/usr/bin/env bash
# Crea/actualiza el rol Postgres taimbox_ci_readonly (SELECT-only) en el stack self-hosted.
# Uso (en el servidor Pi, o con túnel + docker local del stack):
#
#   export READONLY_PASSWORD="$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)"
#   ./scripts/create-ci-readonly-role.sh
#
# Luego guarda SOLO en secretos (Cursor / GitHub Actions), nunca en el repo:
#   TAIMBOX_READONLY_DATABASE_URL=postgresql://taimbox_ci_readonly:PASSWORD@HOST:5432/postgres
#
# Variables opcionales:
#   DB_CONTAINER   (default: supabase-db)
#   DB_NAME        (default: postgres)
#   DB_ADMIN_USER  (default: supabase_admin)
#   READONLY_HOST  (default: 127.0.0.1)  — host que pondrás en la URL del secreto
#   READONLY_PORT  (default: 5432)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SQL_TEMPLATE="$ROOT/scripts/sql/create_taimbox_ci_readonly_role.sql"
DB_CONTAINER="${DB_CONTAINER:-supabase-db}"
DB_NAME="${DB_NAME:-postgres}"
DB_ADMIN_USER="${DB_ADMIN_USER:-supabase_admin}"
READONLY_HOST="${READONLY_HOST:-127.0.0.1}"
READONLY_PORT="${READONLY_PORT:-5432}"

if [[ ! -f "$SQL_TEMPLATE" ]]; then
  echo "No encuentro $SQL_TEMPLATE" >&2
  exit 1
fi

if [[ -z "${READONLY_PASSWORD:-}" ]]; then
  if command -v openssl >/dev/null 2>&1; then
    READONLY_PASSWORD="$(openssl rand -base64 36 | tr -d '/+=\n' | head -c 32)"
  else
    echo "Define READONLY_PASSWORD o instala openssl." >&2
    exit 1
  fi
fi

# Escape single quotes for SQL string literal
SQL_PASSWORD="${READONLY_PASSWORD//\'/\'\'}"

TMP_SQL="$(mktemp)"
trap 'rm -f "$TMP_SQL"' EXIT

sed "s/__READONLY_PASSWORD__/${SQL_PASSWORD}/g" "$SQL_TEMPLATE" > "$TMP_SQL"

if ! docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  echo "Contenedor '$DB_CONTAINER' no está en marcha. ¿Estás en el host del stack Supabase?" >&2
  exit 1
fi

echo "Aplicando rol taimbox_ci_readonly en $DB_CONTAINER…"
docker exec -i -e ON_ERROR_STOP=1 "$DB_CONTAINER" \
  psql -U "$DB_ADMIN_USER" -d "$DB_NAME" < "$TMP_SQL"

# Verificación rápida: sin privilegio INSERT.
echo "Comprobando privilegios…"
INSERT_OK="$(docker exec -i "$DB_CONTAINER" \
  psql -U taimbox_ci_readonly -d "$DB_NAME" -Atc \
  "select has_table_privilege(current_user, 'public.projects', 'INSERT');")"
SELECT_OK="$(docker exec -i "$DB_CONTAINER" \
  psql -U taimbox_ci_readonly -d "$DB_NAME" -Atc \
  "select has_table_privilege(current_user, 'public.projects', 'SELECT');")"
if [[ "$INSERT_OK" != "f" ]]; then
  echo "ERROR: INSERT sigue permitido ($INSERT_OK)." >&2
  exit 1
fi
if [[ "$SELECT_OK" != "t" ]]; then
  echo "ERROR: SELECT no está permitido ($SELECT_OK)." >&2
  exit 1
fi
echo "OK: SELECT sí, INSERT no."

echo
echo "Rol listo. Guarda esta URL en el secreto TAIMBOX_READONLY_DATABASE_URL"
echo "(Cursor Environment Secrets / GitHub Actions). No la pegues en el chat ni en git:"
echo
echo "postgresql://taimbox_ci_readonly:${READONLY_PASSWORD}@${READONLY_HOST}:${READONLY_PORT}/${DB_NAME}"
echo
echo "Si Postgres solo escucha en Docker, desde el agente usa el túnel SSH"
echo "(p. ej. localhost:54322 → 5432) y READONLY_HOST=127.0.0.1 READONLY_PORT=54322."
