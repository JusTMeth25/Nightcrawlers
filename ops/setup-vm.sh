#!/usr/bin/env bash
# One-time (and re-runnable) hardening and setup of the Nightcrawlers VM:
# Oracle Cloud Ampere A1, Ubuntu 24.04 (arm64). Run as root from the admin account:
#
#   sudo DEPLOY_SSH_PUBKEY="ssh-ed25519 AAAA... github-deploy" bash ops/setup-vm.sh
#
# What it does (idempotent: running it again converges to the same state):
#   - security updates installed automatically (unattended-upgrades)
#   - user "deploy" (CI over SSH, member of the docker group), key-only SSH, no root login
#   - firewall: ufw and Oracle's iptables rules allow only 22, 80, 443
#   - fail2ban on sshd
#   - Docker Engine + compose plugin from Docker's apt repository, log rotation
#   - /opt/nightcrawlers (owned by deploy) with .env (mode 600) and backups/
#   - daily database backup at 03:30 (ops/backup.sh)
#
# Keep a second SSH session open while running it the first time.
set -euo pipefail

APP_DIR=/opt/nightcrawlers
DEPLOY_USER=deploy
ADMIN_USER="${ADMIN_USER:-${SUDO_USER:-ubuntu}}"
DEPLOY_SSH_PUBKEY="${DEPLOY_SSH_PUBKEY:-}"
export DEBIAN_FRONTEND=noninteractive

log() { printf '\n==> %s\n' "$*"; }

[[ $EUID -eq 0 ]] || { echo "run as root (sudo)" >&2; exit 1; }
id "$ADMIN_USER" >/dev/null 2>&1 || { echo "admin user $ADMIN_USER not found (set ADMIN_USER)" >&2; exit 1; }
if [[ ! -s "/home/$ADMIN_USER/.ssh/authorized_keys" ]]; then
    echo "/home/$ADMIN_USER/.ssh/authorized_keys is empty: refusing to disable password login" >&2
    exit 1
fi

log "Packages and automatic security updates"
apt-get update -q
apt-get -y -q upgrade
apt-get -y -q install ca-certificates curl gnupg ufw fail2ban unattended-upgrades \
    iptables-persistent cron
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
cat > /etc/apt/apt.conf.d/52nightcrawlers-unattended <<'EOF'
// Security updates only (Ubuntu default origins); reboot at night when a kernel update needs it.
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:30";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
EOF
systemctl enable --now unattended-upgrades

log "Docker Engine and compose plugin"
install -m 0755 -d /etc/apt/keyrings
if [[ ! -s /etc/apt/keyrings/docker.asc ]]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
fi
# shellcheck source=/dev/null
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
apt-get update -q
apt-get -y -q install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
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

log "Firewall: 22, 80, 443"
# Oracle's Ubuntu images ship iptables rules (/etc/iptables/rules.v4) that reject everything
# but SSH. Open 80/443 before that REJECT, both live and in the saved rules.
rules=/etc/iptables/rules.v4
for port in 80 443; do
    rule=(INPUT -p tcp -m state --state NEW -m tcp --dport "$port" -j ACCEPT)
    iptables -C "${rule[@]}" 2>/dev/null || iptables -I INPUT 1 "${rule[@]}"
    if [[ -f $rules ]] && ! grep -q -- "--dport $port -j ACCEPT" "$rules"; then
        sed -i "/--dport 22 -j ACCEPT/a -A ${rule[*]}" "$rules"
    fi
done
# HTTP/3 (optional, also needs UDP 443 in the Security List)
udp=(INPUT -p udp -m udp --dport 443 -j ACCEPT)
iptables -C "${udp[@]}" 2>/dev/null || iptables -I INPUT 1 "${udp[@]}"
if [[ -f $rules ]] && ! grep -q -- "-p udp -m udp --dport 443 -j ACCEPT" "$rules"; then
    sed -i "/--dport 22 -j ACCEPT/a -A ${udp[*]}" "$rules"
fi
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable
# Note: Docker-published ports are filtered in FORWARD/DOCKER-USER, not by ufw. The stack
# publishes only 80/443; PostgreSQL is never published.

log "Application directory"
install -d -m 750 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP_DIR" "$APP_DIR/backups" "$APP_DIR/ops" "$APP_DIR/db"
if [[ ! -e "$APP_DIR/.env" ]]; then
    install -m 600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /dev/null "$APP_DIR/.env"
    echo "created empty $APP_DIR/.env: fill it from .env.example"
fi
chown "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR/.env"
chmod 600 "$APP_DIR/.env"

log "Daily backup (03:30)"
cat > /etc/cron.d/nightcrawlers-backup <<EOF
# Nightcrawlers: daily pg_dump, 7-day local rotation, copy to OCI Object Storage
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
30 3 * * * $DEPLOY_USER [ -x $APP_DIR/ops/backup.sh ] && $APP_DIR/ops/backup.sh >> $APP_DIR/backups/backup.log 2>&1
EOF
chmod 644 /etc/cron.d/nightcrawlers-backup

log "Done"
echo "Next: fill $APP_DIR/.env (chmod 600), then run the Deploy workflow."
echo "Docker: $(docker --version) / $(docker compose version)"
