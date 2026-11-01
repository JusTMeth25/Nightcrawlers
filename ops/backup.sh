#!/usr/bin/env bash
# Daily PostgreSQL backup (cron 03:30, user deploy; see ops/setup-vm.sh):
#   pg_dump -Fc of the database -> $APP_DIR/backups/nc-<UTC timestamp>.dump
#   local rotation: dumps older than $KEEP_DAYS days are deleted
#   off-site copy: uploaded to a private OCI Object Storage bucket when OCI_BUCKET is set
#
# Settings: environment or $APP_DIR/backup.env (mode 600), e.g.
#   OCI_BUCKET=nightcrawlers-backups
#   OCI_AUTH=instance_principal   # or api_key (default) with ~/.oci/config of the deploy user
#   OCI_NAMESPACE=...             # optional, looked up when empty
set -euo pipefail
umask 077

APP_DIR="${APP_DIR:-/opt/nightcrawlers}"
if [[ -f "$APP_DIR/backup.env" ]]; then
    # shellcheck source=/dev/null
    . "$APP_DIR/backup.env"
fi
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
KEEP_DAYS="${KEEP_DAYS:-7}"
OCI_BUCKET="${OCI_BUCKET:-}"
OCI_AUTH="${OCI_AUTH:-api_key}"
OCI_NAMESPACE="${OCI_NAMESPACE:-}"
OCI_CLI_IMAGE="${OCI_CLI_IMAGE:-ghcr.io/oracle/oci-cli:latest}"

log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*"; }

cd "$APP_DIR"
mkdir -p "$BACKUP_DIR"
name="nc-$(date -u +%Y%m%dT%H%M%SZ).dump"
tmp="$BACKUP_DIR/.$name.partial"
trap 'rm -f "$tmp"' EXIT

log "dumping database to $name"
# shellcheck disable=SC2016 # expanded inside the container
docker compose exec -T db sh -c 'pg_dump -U postgres -d "$POSTGRES_DB" -Fc --no-password' > "$tmp"
# a custom-format dump starts with the magic string PGDMP
[[ "$(head -c 5 "$tmp")" == PGDMP ]] || { log "dump is not a valid pg_dump archive" >&2; exit 1; }
mv "$tmp" "$BACKUP_DIR/$name"
log "dump ok ($(du -h "$BACKUP_DIR/$name" | cut -f1))"

find "$BACKUP_DIR" -maxdepth 1 -name 'nc-*.dump' -type f -mtime +"$((KEEP_DAYS - 1))" -print -delete \
    | sed 's/^/removed /'

if [[ -z "$OCI_BUCKET" ]]; then
    log "OCI_BUCKET not set: off-site copy skipped"
    exit 0
fi

oci_cli() {
    if command -v oci >/dev/null 2>&1; then
        oci --auth "$OCI_AUTH" "$@"
    else
        docker run --rm -v "$HOME/.oci:/oracle/.oci:ro" -v "$BACKUP_DIR:/backups:ro" \
            "$OCI_CLI_IMAGE" --auth "$OCI_AUTH" "$@"
    fi
}
# paths as seen by oci_cli (host CLI or container)
if command -v oci >/dev/null 2>&1; then src="$BACKUP_DIR/$name"; else src="/backups/$name"; fi

ns_args=()
[[ -n "$OCI_NAMESPACE" ]] && ns_args=(--namespace-name "$OCI_NAMESPACE")
log "uploading $name to bucket $OCI_BUCKET"
oci_cli os object put "${ns_args[@]}" --bucket-name "$OCI_BUCKET" --file "$src" --name "$name" \
    --force >/dev/null
log "upload ok"
