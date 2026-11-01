#!/usr/bin/env bash
# PostgreSQL backup (pg_dump -Fc of the database).
#
#   ops/backup.sh                    daily mode (cron 03:30, user deploy; see ops/setup-vm.sh):
#                                    backups/nc-<UTC timestamp>.dump, local rotation after
#                                    $KEEP_DAYS days, copy to a private OCI Object Storage bucket
#                                    when OCI_BUCKET is set (unique names, never overwritten)
#   ops/backup.sh --pre-deploy TAG   local dump before a deploy (ops/deploy.sh):
#                                    backups/pre-deploy-<UTC timestamp>-<TAG>.dump, newest
#                                    $KEEP_PRE_DEPLOY kept, no upload
#
# Daily-mode failures go to syslog (logger -t nightcrawlers-backup) and to the marker file
# backups/.last-failure; success writes backups/.last-success. ops/status.sh shows both.
#
# Settings: environment or $APP_DIR/backup.env (mode 600), e.g.
#   OCI_BUCKET=nightcrawlers-backups
#   OCI_NAMESPACE=<object storage namespace>
#   OCI_AUTH=instance_principal   # or api_key (default) with ~/.oci/config of the deploy user
set -euo pipefail
umask 077

APP_DIR="${APP_DIR:-/opt/nightcrawlers}"
if [[ -f "$APP_DIR/backup.env" ]]; then
    # shellcheck source=/dev/null
    . "$APP_DIR/backup.env"
fi
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
KEEP_DAYS="${KEEP_DAYS:-7}"
KEEP_PRE_DEPLOY="${KEEP_PRE_DEPLOY:-3}"
OCI_BUCKET="${OCI_BUCKET:-}"
OCI_AUTH="${OCI_AUTH:-api_key}"
OCI_NAMESPACE="${OCI_NAMESPACE:-}"
OCI_CLI_IMAGE="${OCI_CLI_IMAGE:-ghcr.io/oracle/oci-cli:20261028}"

mode=daily
tag=""
if [[ "${1:-}" == --pre-deploy ]]; then
    mode=pre-deploy
    tag="${2:?usage: backup.sh --pre-deploy <tag>}"
    [[ "$tag" =~ ^[A-Za-z0-9_.-]+$ ]] || { echo "invalid tag: $tag" >&2; exit 2; }
fi

log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*"; }

cd "$APP_DIR"
mkdir -p "$BACKUP_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
if [[ $mode == daily ]]; then name="nc-$stamp.dump"; else name="pre-deploy-$stamp-$tag.dump"; fi
tmp="$BACKUP_DIR/.$name.partial"

on_exit() {
    local rc=$?
    rm -f "$tmp"
    if [[ $mode == daily ]]; then
        if [[ $rc -eq 0 ]]; then
            date -u +%FT%TZ > "$BACKUP_DIR/.last-success"
            rm -f "$BACKUP_DIR/.last-failure"
        else
            printf '%s exit %s (see backup.log)\n' "$(date -u +%FT%TZ)" "$rc" > "$BACKUP_DIR/.last-failure"
            logger -t nightcrawlers-backup -p user.err "daily backup failed with exit code $rc" 2>/dev/null || true
        fi
    fi
}
trap on_exit EXIT

log "dumping database to $name"
# shellcheck disable=SC2016 # expanded inside the container
docker compose exec -T db sh -c 'pg_dump -U postgres -d "$POSTGRES_DB" -Fc --no-password' > "$tmp"
# a custom-format dump starts with the magic string PGDMP
[[ "$(head -c 5 "$tmp")" == PGDMP ]] || { log "dump is not a valid pg_dump archive" >&2; exit 1; }
mv "$tmp" "$BACKUP_DIR/$name"
log "dump ok ($(du -h "$BACKUP_DIR/$name" | cut -f1))"

if [[ $mode == pre-deploy ]]; then
    # names sort by time: keep the newest $KEEP_PRE_DEPLOY
    find "$BACKUP_DIR" -maxdepth 1 -name 'pre-deploy-*.dump' -type f -printf '%f\n' | sort -r \
        | tail -n +"$((KEEP_PRE_DEPLOY + 1))" | while read -r old; do
            rm -f "$BACKUP_DIR/$old"
            log "removed $old"
        done
    exit 0
fi

find "$BACKUP_DIR" -maxdepth 1 -name 'nc-*.dump' -type f -mtime +"$((KEEP_DAYS - 1))" -print -delete \
    | sed 's/^/removed /'

if [[ -z "$OCI_BUCKET" ]]; then
    log "OCI_BUCKET not set: off-site copy skipped"
    exit 0
fi

# Upload only: the VM may create objects but not overwrite or delete them (bucket policy and
# retention rule, docs/deploy.md). Old objects expire through the bucket's lifecycle rule.
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
    --no-overwrite >/dev/null
log "upload ok"
