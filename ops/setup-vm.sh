#!/usr/bin/env bash
# One-time (and re-runnable) hardening and setup of the Nightcrawlers VM:
# Oracle Cloud Ampere A1, Ubuntu 24.04 (arm64). Run as root from the admin account, with
# init-secrets.sh, backup.sh and status.sh copied next to this script:
#
#   sudo DEPLOY_SSH_PUBKEY="ssh-ed25519 AAAA... github-deploy" CONTACT_EMAIL=you@example.com \
#     bash setup-vm.sh
#
# What it does (idempotent: running it again converges to the same state):
#   - security updates installed automatically (unattended-upgrades, Docker CE included)
#   - firewall: Oracle's iptables rules (netfilter-persistent) accept only 22, 80, 443 (+ UDP 443)
#     before their final REJECT, live and in /etc/iptables/rules.v4. No ufw: on Ubuntu 24.04 it
#     conflicts with iptables-persistent and would drop Oracle's saved rules.
#   - Docker Engine + compose plugin from Docker's apt repository (key fingerprint checked)
#   - user "deploy" (CI over SSH, member of the docker group), key-only SSH, no root login
#   - fail2ban on sshd
#   - /opt/nightcrawlers (owned by deploy) with backups/ and .env (mode 600): secrets generated
#     on the server by ops/init-secrets.sh, never chosen by hand
#   - daily database backup at 03:30, weekly refresh of the postgres/duckdns images, logrotate
#
# Keep a second SSH session open while running it the first time.
set -euo pipefail

APP_DIR=/opt/nightcrawlers
DEPLOY_USER=deploy
ADMIN_USER="${ADMIN_USER:-${SUDO_USER:-ubuntu}}"
DEPLOY_SSH_PUBKEY="${DEPLOY_SSH_PUBKEY:-}"
# Docker Release (CE) signing key, https://docs.docker.com/engine/install/ubuntu/
DOCKER_KEY_FPR=9DC858229FC7DD38854AE2D88D81803C0EBFCD88
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
export DEBIAN_FRONTEND=noninteractive
APT_OPTS=(-y -q -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold)

log() { printf '\n==> %s\n' "$*"; }

[[ $EUID -eq 0 ]] || { echo "run as root (sudo)" >&2; exit 1; }
id "$ADMIN_USER" >/dev/null 2>&1 || { echo "admin user $ADMIN_USER not found (set ADMIN_USER)" >&2; exit 1; }
if [[ ! -s "/home/$ADMIN_USER/.ssh/authorized_keys" ]]; then
    echo "/home/$ADMIN_USER/.ssh/authorized_keys is empty: refusing to disable password login" >&2
    exit 1
fi

log "Packages and automatic security updates"
apt-get update -q
apt-get "${APT_OPTS[@]}" upgrade
# No autosave of the current (possibly empty) ruleset: the firewall step below writes the rules.
echo "iptables-persistent iptables-persistent/autosave_v4 boolean false" | debconf-set-selections
echo "iptables-persistent iptables-persistent/autosave_v6 boolean false" | debconf-set-selections
# iptables-persistent Breaks ufw: apt removes ufw if the image has it (it is inactive on Oracle images).
apt-get "${APT_OPTS[@]}" install ca-certificates curl gnupg fail2ban unattended-upgrades \
    iptables iptables-persistent netfilter-persistent cron logrotate
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
cat > /etc/apt/apt.conf.d/52nightcrawlers-unattended <<'EOF'
// Ubuntu security updates (default origins) plus Docker Engine; reboot at night when needed.
Unattended-Upgrade::Origins-Pattern {
        "origin=Docker,label=Docker CE";
};
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:30";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
EOF
systemctl enable --now unattended-upgrades

log "Firewall: 22, 80, 443"
# Oracle's Ubuntu images ship /etc/iptables/rules.v4 ending with "-A INPUT -j REJECT". Each
# ACCEPT rule goes before that REJECT, live (inserted at the top of INPUT) and in the file.
# Without the file (non-Oracle image) a minimal policy of the same shape is written and loaded;
# this happens before Docker is installed, so no Docker chain is flushed.
rules=/etc/iptables/rules.v4
mkdir -p /etc/iptables
if [[ ! -s $rules ]]; then
    cat > "$rules" <<'EOF'
*filter
:INPUT ACCEPT [0:0]
:FORWARD ACCEPT [0:0]
:OUTPUT ACCEPT [0:0]
-A INPUT -m state --state RELATED,ESTABLISHED -j ACCEPT
-A INPUT -p icmp -j ACCEPT
-A INPUT -i lo -j ACCEPT
-A INPUT -p tcp -m state --state NEW -m tcp --dport 22 -j ACCEPT
-A INPUT -j REJECT --reject-with icmp-host-prohibited
COMMIT
EOF
    iptables-restore < "$rules"
fi
allow() { # allow <iptables match args...>: idempotent ACCEPT before the REJECT
    local spec=("INPUT" "$@" "-j" "ACCEPT") line
    iptables -C "${spec[@]}" 2>/dev/null || iptables -I INPUT 1 "${spec[@]:1}"
    line="-A ${spec[*]}"
    if ! grep -qxF -- "$line" "$rules"; then
        if grep -q '^-A INPUT -j REJECT' "$rules"; then
            sed -i "0,/^-A INPUT -j REJECT/s//${line//\//\\/}\n&/" "$rules"
        else
            sed -i "0,/^COMMIT/s//${line//\//\\/}\n&/" "$rules"
        fi
    fi
}
allow -p tcp -m state --state NEW -m tcp --dport 22
allow -p tcp -m state --state NEW -m tcp --dport 80
allow -p tcp -m state --state NEW -m tcp --dport 443
allow -p udp -m udp --dport 443 # HTTP/3, also needs UDP 443 in the Security List
systemctl enable netfilter-persistent
# Docker-published ports go through FORWARD/DOCKER-USER, not INPUT. The stack publishes only
# 80/443; PostgreSQL is never published.

log "Docker Engine and compose plugin"
install -m 0755 -d /etc/apt/keyrings
if [[ ! -s /etc/apt/keyrings/docker.asc ]]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc.new
    fpr="$(gpg --show-keys --with-colons /etc/apt/keyrings/docker.asc.new | awk -F: '$1 == "fpr" { print $10; exit }')"
    if [[ "$fpr" != "$DOCKER_KEY_FPR" ]]; then
        rm -f /etc/apt/keyrings/docker.asc.new
        echo "Docker apt key fingerprint mismatch: got '$fpr'" >&2
        exit 1
    fi
    mv /etc/apt/keyrings/docker.asc.new /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
fi
# shellcheck source=/dev/null
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
apt-get update -q
apt-get "${APT_OPTS[@]}" install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
mkdir -p /etc/docker
daemon_json='{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" },
  "live-restore": true
}'
systemctl enable docker
if [[ "$(cat /etc/docker/daemon.json 2>/dev/null)" != "$daemon_json" ]]; then
    printf '%s\n' "$daemon_json" > /etc/docker/daemon.json
    # live-restore keeps running containers up across daemon restarts
    systemctl restart docker
fi

log "Deploy user"
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
    useradd --create-home --shell /bin/bash "$DEPLOY_USER"
fi
# The docker group is root-equivalent: this account holds only the CI key, no password, no sudo.
usermod -aG docker "$DEPLOY_USER"
passwd -l "$DEPLOY_USER" >/dev/null
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
keys="/home/$DEPLOY_USER/.ssh/authorized_keys"
touch "$keys"
if [[ -n "$DEPLOY_SSH_PUBKEY" ]] && ! grep -qxF "$DEPLOY_SSH_PUBKEY" "$keys"; then
    printf '%s\n' "$DEPLOY_SSH_PUBKEY" >> "$keys"
fi
chown "$DEPLOY_USER:$DEPLOY_USER" "$keys"
chmod 600 "$keys"
[[ -s "$keys" ]] || echo "WARNING: no key for $DEPLOY_USER yet: rerun with DEPLOY_SSH_PUBKEY=..." >&2

log "SSH: keys only, no root login"
cat > /etc/ssh/sshd_config.d/10-nightcrawlers.conf <<EOF
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
AuthenticationMethods publickey
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
AllowTcpForwarding no
AllowAgentForwarding no
AllowUsers $ADMIN_USER $DEPLOY_USER
EOF
sshd -t
systemctl reload ssh

log "fail2ban"
cat > /etc/fail2ban/jail.d/nightcrawlers.local <<'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
backend = systemd

[sshd]
enabled = true
EOF
systemctl enable fail2ban
systemctl restart fail2ban

log "Application directory"
install -d -m 750 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP_DIR" "$APP_DIR/backups" "$APP_DIR/ops" "$APP_DIR/db"
for script in backup.sh status.sh init-secrets.sh; do
    if [[ -f "$SCRIPT_DIR/$script" && ! -e "$APP_DIR/ops/$script" ]]; then
        install -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$SCRIPT_DIR/$script" "$APP_DIR/ops/$script"
    fi
done
# .env with generated secrets and production defaults
if [[ -f "$SCRIPT_DIR/init-secrets.sh" ]]; then
    APP_DIR="$APP_DIR" ENV_OWNER="$DEPLOY_USER" bash "$SCRIPT_DIR/init-secrets.sh"
else
    echo "WARNING: $SCRIPT_DIR/init-secrets.sh not found: copy it next to setup-vm.sh and rerun" >&2
    [[ -e "$APP_DIR/.env" ]] || install -m 600 /dev/null "$APP_DIR/.env"
fi
chown "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR/.env"
chmod 600 "$APP_DIR/.env"

log "Scheduled jobs and log rotation"
cat > /etc/cron.d/nightcrawlers <<EOF
# Nightcrawlers
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
# daily pg_dump, 7-day local rotation, copy to OCI Object Storage (failures: syslog + marker file)
30 3 * * * $DEPLOY_USER [ -x $APP_DIR/ops/backup.sh ] && $APP_DIR/ops/backup.sh >> $APP_DIR/backups/backup.log 2>&1
# weekly refresh of the third-party images (patch releases of postgres:18, pinned duckdns)
15 4 * * 0 $DEPLOY_USER { cd $APP_DIR && docker compose pull --quiet db duckdns && docker compose up -d --wait db duckdns; } >> $APP_DIR/backups/images.log 2>&1 || logger -t nightcrawlers -p user.err "weekly image refresh failed"
EOF
chmod 644 /etc/cron.d/nightcrawlers
rm -f /etc/cron.d/nightcrawlers-backup
cat > /etc/logrotate.d/nightcrawlers <<EOF
$APP_DIR/backups/*.log {
    weekly
    rotate 8
    compress
    missingok
    notifempty
    su $DEPLOY_USER $DEPLOY_USER
}
EOF

log "Done"
echo "Next: put the Brevo SMTP login/key and the DuckDNS token in $APP_DIR/.env, then run the Deploy workflow."
echo "Status at any time: sudo -u $DEPLOY_USER $APP_DIR/ops/status.sh"
echo "Docker: $(docker --version) / $(docker compose version)"
