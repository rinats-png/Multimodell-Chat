#!/usr/bin/env bash
# RLS- und Rechte-Tests gegen ein echtes PostgreSQL.
# - Mit DATABASE_URL (z. B. CI-Service-Container): nutzt diese Datenbank (muss leer sein!).
# - Ohne: startet einen temporären lokalen Cluster (initdb/pg_ctl erforderlich).
set -euo pipefail
cd "$(dirname "$0")/.."

run_tests() {
  local url="$1"
  psql "$url" -v ON_ERROR_STOP=1 -q -f supabase/tests/00-supabase-stub.sql
  for migration in supabase/migrations/*.sql; do
    psql "$url" -v ON_ERROR_STOP=1 -q -f "$migration"
  done
  psql "$url" -v ON_ERROR_STOP=1 -q -f supabase/tests/rls.test.sql
}

if [[ -n "${DATABASE_URL:-}" ]]; then
  run_tests "$DATABASE_URL"
  exit 0
fi

PG_BIN="${PG_BIN:-$(dirname "$(command -v initdb 2>/dev/null || ls /usr/lib/postgresql/*/bin/initdb | tail -1)")}"
TMP="$(mktemp -d)"
PORT="${PGPORT_TEST:-55432}"
RUN_AS=()
if [[ "$(id -u)" == "0" ]]; then
  # initdb verweigert root – als Nutzer "postgres" (oder "nobody") ausführen.
  USER_NAME="$(id -u postgres >/dev/null 2>&1 && echo postgres || echo nobody)"
  chown -R "$USER_NAME" "$TMP"
  RUN_AS=(su -s /bin/bash "$USER_NAME" -c)
fi
as_pg() { if [[ ${#RUN_AS[@]} -gt 0 ]]; then "${RUN_AS[@]}" "$*"; else bash -c "$*"; fi; }

cleanup() { as_pg "$PG_BIN/pg_ctl -D $TMP/data -m immediate stop" >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT

as_pg "$PG_BIN/initdb -D $TMP/data -U postgres --auth=trust -E UTF8 >/dev/null"
as_pg "$PG_BIN/pg_ctl -D $TMP/data -o '-p $PORT -k $TMP -c listen_addresses=' -l $TMP/log -w start >/dev/null"
as_pg "psql -h $TMP -p $PORT -U postgres -q -c 'CREATE DATABASE rls_test'"
run_tests "postgresql://postgres@/rls_test?host=$TMP&port=$PORT"
