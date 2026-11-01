#!/usr/bin/env bash
# Creates or completes /opt/nightcrawlers/.env on the VM (mode 600, owner deploy):
#   - generates the secrets with openssl when missing or still CHANGE_ME:
#     POSTGRES_PASSWORD, DB_OWNER_PASSWORD, DB_APP_PASSWORD, JWT_SECRET, IP_HASH_SALT
#   - adds the production defaults (domain, mail sender, images...) only when a key is missing,
#     so values edited by hand are kept
#   - leaves CHANGE_ME placeholders for what only you can provide (Brevo SMTP key, DuckDNS token)
# Idempotent: existing secrets are never regenerated (the DB passwords are fixed when the
# database volume is first initialised). Called by ops/setup-vm.sh; can be rerun as root.
set -euo pipefail
umask 077

APP_DIR="${APP_DIR:-/opt/nightcrawlers}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env}"
OWNER="${ENV_OWNER:-deploy}"

touch "$ENV_FILE"
chmod 600 "$ENV_FILE"

current() { grep -m1 "^$1=" "$ENV_FILE" | cut -d= -f2- || true; }

put() { # put KEY VALUE: replace the line or append it
    local tmp
    tmp="$(mktemp "$ENV_FILE.XXXXXX")"
    awk -v k="$1" -v v="$2" 'BEGIN { done = 0 }
        index($0, k "=") == 1 { if (!done) print k "=" v; done = 1; next }
        { print }
        END { if (!done) print k "=" v }' "$ENV_FILE" > "$tmp"
    chmod 600 "$tmp"
    mv "$tmp" "$ENV_FILE"
}

default() { # default KEY VALUE: only when the key is absent
    grep -q "^$1=" "$ENV_FILE" || put "$1" "$2"
}

secret() { # secret KEY BYTES: generate when absent, empty or a placeholder
    local value
    value="$(current "$1")"
    if [[ -z "$value" || "$value" == CHANGE_ME* ]]; then
        put "$1" "$(openssl rand -hex "$2")"
        echo "generated $1"
    fi
}

# --- production defaults (not secret)
default DOMAIN playnightcrawlers.duckdns.org
default PUBLIC_URL https://playnightcrawlers.duckdns.org
default ACME_EMAIL lorenzo.melis@yahoo.it
# first deploy on the Let's Encrypt staging CA; switch to production afterwards (docs/deploy.md)
default ACME_CA https://acme-staging-v02.api.letsencrypt.org/directory
default CADDY_TLS acme
default IMAGE_PREFIX ghcr.io/justmeth25/nightcrawlers
default TAG latest
default POSTGRES_DB nightcrawlers
default DB_OWNER_USER nc_owner
default DB_APP_USER nc_app
default SMTP_HOST smtp-relay.brevo.com
default SMTP_PORT 587
default MAIL_FROM "Nightcrawlers <lorenzo.melis@yahoo.it>"
default DUCKDNS_SUBDOMAIN playnightcrawlers
default TZ Europe/Rome

# --- secrets generated here, never chosen by hand
if docker volume inspect nightcrawlers_pgdata >/dev/null 2>&1 \
    && [[ -z "$(current DB_APP_PASSWORD)" || "$(current DB_APP_PASSWORD)" == CHANGE_ME* ]]; then
    echo "WARNING: the database volume already exists; new DB passwords will not match it" >&2
fi
secret POSTGRES_PASSWORD 24
secret DB_OWNER_PASSWORD 24
secret DB_APP_PASSWORD 24
secret JWT_SECRET 48
secret IP_HASH_SALT 24

# --- provided by you (placeholders)
default SMTP_USERNAME CHANGE_ME
default SMTP_PASSWORD CHANGE_ME
default DUCKDNS_TOKEN CHANGE_ME

if id "$OWNER" >/dev/null 2>&1 && [[ $EUID -eq 0 ]]; then
    chown "$OWNER:$OWNER" "$ENV_FILE"
fi
chmod 600 "$ENV_FILE"

missing="$(grep -E '^[A-Z_]+=CHANGE_ME' "$ENV_FILE" | cut -d= -f1 | tr '\n' ' ' || true)"
if [[ -n "$missing" ]]; then
    echo "still to fill in $ENV_FILE: $missing"
else
    echo "$ENV_FILE complete"
fi
