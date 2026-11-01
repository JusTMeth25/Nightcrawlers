#!/usr/bin/env bash
# Health summary of the Nightcrawlers VM: containers, deployed tag, backups, disk.
# Exit code 1 when something needs attention (unhealthy container, failed or stale backup).
#   sudo -u deploy /opt/nightcrawlers/ops/status.sh
set -uo pipefail

APP_DIR="${APP_DIR:-/opt/nightcrawlers}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
problems=0
warn() { echo "!! $*"; problems=$((problems + 1)); }

cd "$APP_DIR" || exit 1
echo "== containers"
docker compose ps --format 'table {{.Service}}\t{{.Image}}\t{{.Status}}'
while read -r service state health; do
    if [[ "$state" != running || ( -n "$health" && "$health" != healthy ) ]]; then
        warn "$service is $state${health:+ ($health)}"
    fi
done < <(docker compose ps --all --format '{{.Service}} {{.State}} {{.Health}}' | grep -v '^duckdns exited')

echo "== deployed tag: $(cat .last-good-tag 2>/dev/null || echo none)"

echo "== backups"
if [[ -f "$BACKUP_DIR/.last-failure" ]]; then
    warn "last daily backup FAILED: $(cat "$BACKUP_DIR/.last-failure")"
fi
if [[ -f "$BACKUP_DIR/.last-success" ]]; then
    echo "last success: $(cat "$BACKUP_DIR/.last-success")"
    if [[ -n "$(find "$BACKUP_DIR/.last-success" -mmin +1560)" ]]; then
        warn "no successful backup in the last 26 hours"
    fi
else
    warn "no successful daily backup yet"
fi
find "$BACKUP_DIR" -maxdepth 1 -name '*.dump' -type f -printf '%TY-%Tm-%Td %TH:%TM  %8s  %f\n' | sort | tail -n 5

echo "== disk"
df -h / | tail -n 1

if [[ $problems -gt 0 ]]; then
    echo "$problems problem(s)"
    exit 1
fi
echo "all good"
