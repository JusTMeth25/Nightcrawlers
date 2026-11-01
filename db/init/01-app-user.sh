#!/usr/bin/env bash
# Runs once, when the postgres container initialises an empty data volume
# (/docker-entrypoint-initdb.d), as the superuser POSTGRES_USER on POSTGRES_DB.
#
# Creates two non-superuser roles:
#   DB_OWNER_USER  owns the database and the public schema; Flyway migrates with it.
#   DB_APP_USER    the backend's runtime user: DML only (SELECT/INSERT/UPDATE/DELETE),
#                  granted through default privileges on everything the owner creates.
set -euo pipefail

: "${POSTGRES_DB:?}" "${DB_OWNER_USER:?}" "${DB_OWNER_PASSWORD:?}" "${DB_APP_USER:?}" "${DB_APP_PASSWORD:?}"

psql -v ON_ERROR_STOP=1 --no-psqlrc --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    -v db="$POSTGRES_DB" \
    -v owner="$DB_OWNER_USER" -v owner_pw="$DB_OWNER_PASSWORD" \
    -v app="$DB_APP_USER" -v app_pw="$DB_APP_PASSWORD" <<'SQL'
CREATE ROLE :"owner" LOGIN PASSWORD :'owner_pw' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE ROLE :"app" LOGIN PASSWORD :'app_pw' NOSUPERUSER NOCREATEDB NOCREATEROLE;

-- Since PostgreSQL 15 the public schema belongs to pg_database_owner and PUBLIC cannot create in it.
ALTER DATABASE :"db" OWNER TO :"owner";
REVOKE ALL ON DATABASE :"db" FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE :"db" TO :"owner";
GRANT CONNECT ON DATABASE :"db" TO :"app";

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO :"app";

ALTER DEFAULT PRIVILEGES FOR ROLE :"owner" IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"app";
ALTER DEFAULT PRIVILEGES FOR ROLE :"owner" IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO :"app";
SQL
