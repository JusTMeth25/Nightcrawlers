#!/usr/bin/env bash
# Deploys image tag $1 on the VM (called over SSH by .github/workflows/deploy.yml).
# On failure (pull error, unhealthy container, e.g. a failing Flyway migration) the stack is
# brought back to the tag in .last-good-tag and the script exits non-zero.
#
# Usage: [IMAGE_PREFIX=ghcr.io/<owner>/<repo>] ops/deploy.sh <tag>   (works in /opt/nightcrawlers)
# IMAGE_PREFIX (lower case) is saved in .env with TAG, so a later plain `docker compose up`
# uses the same images.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nightcrawlers}"
WAIT_TIMEOUT="${WAIT_TIMEOUT:-300}"
PRUNE_IMAGES="${PRUNE_IMAGES:-1}"
new_tag="${1:?usage: deploy.sh <image tag>}"
[[ "$new_tag" =~ ^[A-Za-z0-9_.-]+$ ]] || { echo "invalid tag: $new_tag" >&2; exit 2; }
if [[ -n "${IMAGE_PREFIX:-}" && ! "$IMAGE_PREFIX" =~ ^[a-z0-9./_-]+$ ]]; then
    echo "invalid IMAGE_PREFIX: $IMAGE_PREFIX" >&2
    exit 2
fi

cd "$APP_DIR"
[[ -f .env ]] || { echo "$APP_DIR/.env is missing" >&2; exit 2; }

prev_tag="$(cat .last-good-tag 2>/dev/null || true)"

compose() { TAG="$1" docker compose "${@:2}"; }

set_env() {
    if grep -q "^$1=" .env; then
        sed -i "s|^$1=.*|$1=$2|" .env
    else
        printf '%s=%s\n' "$1" "$2" >> .env
    fi
}

echo "deploying $new_tag (last good: ${prev_tag:-none})"
if compose "$new_tag" pull --quiet web backend \
    && compose "$new_tag" up -d --remove-orphans --wait --wait-timeout "$WAIT_TIMEOUT"; then
    echo "$new_tag" > .last-good-tag
    set_env TAG "$new_tag"
    if [[ -n "${IMAGE_PREFIX:-}" ]]; then set_env IMAGE_PREFIX "$IMAGE_PREFIX"; fi
    # unused images older than a week (a rollback further back pulls again from GHCR)
    if [[ "$PRUNE_IMAGES" == 1 ]]; then docker image prune -af --filter "until=168h" >/dev/null; fi
    echo "deployed $new_tag"
    exit 0
fi

echo "deploy of $new_tag failed" >&2
compose "$new_tag" logs --no-color --tail 100 backend >&2 || true
if [[ -n "$prev_tag" ]]; then
    echo "rolling back to $prev_tag" >&2
    compose "$prev_tag" up -d --remove-orphans --wait --wait-timeout "$WAIT_TIMEOUT" \
        || echo "ROLLBACK FAILED: check the stack by hand" >&2
fi
exit 1
