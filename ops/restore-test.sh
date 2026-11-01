#!/usr/bin/env bash
# Restore test: loads a backup into a throwaway PostgreSQL 18 container (no network, no volume)
# and checks that the schema and the data are there. Nothing touches the live database.
#
# Usage: ops/restore-test.sh [dump file]     (default: newest $APP_DIR/backups/nc-*.dump)
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nightcrawlers}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
IMAGE="${PG_IMAGE:-postgres:18}"
name="nc-restore-test-$$"

dump="${1:-}"
if [[ -z "$dump" ]]; then
    dump="$(find "$BACKUP_DIR" -maxdepth 1 -name 'nc-*.dump' -type f -printf '%T@ %p\n' 2>/dev/null \
        | sort -n | tail -n 1 | cut -d' ' -f2-)"
fi
[[ -n "$dump" && -f "$dump" ]] || { echo "no dump found in $BACKUP_DIR" >&2; exit 1; }
echo "restoring $dump"

cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --name "$name" --network none \
    -e POSTGRES_PASSWORD="$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')" \
    -e POSTGRES_DB=restore "$IMAGE" >/dev/null

# wait until the server accepts connections (the entrypoint restarts it once after init)
for _ in $(seq 1 60); do
    if docker exec "$name" pg_isready -U postgres -d restore -q 2>/dev/null \
        && docker exec "$name" psql -U postgres -d restore -tAc 'select 1' >/dev/null 2>&1; then
        break
    fi
    sleep 1
done
sleep 2
docker exec "$name" pg_isready -U postgres -d restore -q

# Roles are not part of a database dump: restore without owners and grants.
docker exec -i "$name" pg_restore -U postgres -d restore --no-owner --no-acl --exit-on-error < "$dump"

q() { docker exec "$name" psql -U postgres -d restore -tAc "$1"; }
users="$(q 'select count(*) from users')"
saves="$(q 'select count(*) from player_saves')"
runs="$(q 'select count(*) from runs')"
migration="$(q 'select max(version::int) from flyway_schema_history where success')"
echo "restore OK: users=$users player_saves=$saves runs=$runs flyway_version=$migration"
