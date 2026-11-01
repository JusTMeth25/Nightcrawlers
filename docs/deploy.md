# Deploy su Oracle Cloud: runbook

Questo runbook lo esegui tu: account, credenziali e segreti non passano mai dal repository né dagli agenti.
Tempo stimato per il primo rilascio: 2–3 ore.

## Architettura

```
Internet ──80/443──> web (Caddy: TLS Let's Encrypt, build FE, header di sicurezza)
                       └── /api/* ──> backend (Spring Boot, utente non root) ──> db (PostgreSQL 18, volume pgdata)
                     duckdns (aggiorna l'IP del sottodominio)
```

- Tutto gira con Docker Compose in `/opt/nightcrawlers` sulla VM (`docker-compose.yml`, `.env`, `db/init/`, `ops/`).
- Solo `web` pubblica porte (80, 443). Il DB è su una rete Docker interna senza uscita, mai esposto.
- `/actuator/*` risponde 404 dall'esterno; la salute del backend è controllata dentro la rete Docker.
- Immagini `linux/arm64` su GHCR (`ghcr.io/<owner>/nightcrawlers-web` e `-backend`), taggate con lo SHA del commit.
- CI (`.github/workflows/ci.yml`) su ogni push/PR; il deploy (`deploy.yml`) parte dopo una CI verde su `main` o a mano.

## 1. Account Oracle Cloud

1. Crea l'account Oracle Cloud (regione home vicina, per esempio `eu-milan-1` o `eu-frankfurt-1`: non si cambia più).
2. **Consigliato: upgrade a Pay-As-You-Go.** Oracle può recuperare le istanze Always Free "inattive" degli account free
   tier; con Pay-As-You-Go non succede. Continua a usare solo risorse Always Free (forma `VM.Standard.A1.Flex`, fino a
   4 OCPU / 24 GB in totale, 200 GB di block volume) e imposta subito un **budget con alert** (per esempio 1 €) in
   *Billing > Budgets*, così ogni costo inatteso ti arriva per email.

## 2. VM Ampere A1

1. *Compute > Instances > Create instance*:
   - Immagine: **Canonical Ubuntu 24.04** (aarch64). Forma: `VM.Standard.A1.Flex`, 2 OCPU / 12 GB (bastano; restano risorse libere).
   - Boot volume: 50–100 GB.
   - Rete: VCN con subnet pubblica, *Assign a public IPv4 address*. Meglio un **IP pubblico riservato**
     (*Networking > Reserved public IPs*), così l'indirizzo non cambia se ricrei la VM.
   - Chiave SSH: carica la **tua** chiave pubblica (account `ubuntu`).
   - Se compare "Out of capacity", riprova più tardi o in un altro availability domain.
2. **Security List** della subnet (*Networking > VCN > Security Lists > Default*), regole in ingresso, origine `0.0.0.0/0`:
   - TCP 22 (SSH; anche i runner di GitHub Actions devono raggiungerla per il deploy)
   - TCP 80 (redirect HTTPS e challenge ACME)
   - TCP 443 (HTTPS)
   - facoltativa: UDP 443 (HTTP/3)
   Nient'altro: niente 5432, niente 8080.

## 3. DuckDNS

1. Accedi su https://www.duckdns.org, crea il sottodominio (per esempio `nightcrawlers` → `nightcrawlers.duckdns.org`)
   e copia il **token**.
2. Imposta subito l'IP della VM nel campo *current ip* (il container `duckdns` poi lo mantiene aggiornato ogni 5 minuti).
3. Verifica: `nslookup nightcrawlers.duckdns.org` restituisce l'IP della VM.

## 4. Brevo (SMTP)

1. Crea l'account Brevo (piano gratuito: 300 email al giorno).
2. **Mittente**: con un sottodominio DuckDNS non puoi aggiungere i record DNS (SPF/DKIM) di Brevo, quindi:
   - con un dominio tuo: *Senders, Domains & Dedicated IPs > Domains*, aggiungi il dominio e i record DKIM/DMARC indicati;
   - altrimenti verifica un singolo indirizzo in *Senders* (consegna meno affidabile: le email possono finire in spam).
   `MAIL_FROM` deve usare il mittente verificato, per esempio `Nightcrawlers <no-reply@tuodominio.it>`.
3. *SMTP & API > SMTP*: crea una **chiave SMTP**. `SMTP_USERNAME` è il login SMTP mostrato lì, `SMTP_PASSWORD` la chiave.
   Host `smtp-relay.brevo.com`, porta `587` (STARTTLS).

## 5. Repository GitHub

1. Crea il repository e fai il push di `main`.
2. *Settings > Secrets and variables > Actions*:

   | Tipo | Nome | Valore |
   |---|---|---|
   | Secret | `SSH_HOST` | IP pubblico della VM (o il dominio DuckDNS) |
   | Secret | `SSH_USER` | `deploy` |
   | Secret | `SSH_KEY` | chiave **privata** di deploy (vedi sotto), intera |
   | Secret | `SSH_KNOWN_HOSTS` | output di `ssh-keyscan -t ed25519 <IP>` **verificato** (vedi passo 6.4) |
   | Secret | `NVD_API_KEY` | facoltativo ma consigliato: chiave gratuita da https://nvd.nist.gov/developers/request-an-api-key (dependency-check senza chiave è molto lento) |
   | Variable | `VITE_PRIVACY_EMAIL` | **obbligatoria**: indirizzo reale per le richieste privacy/GDPR. Senza, il deploy si ferma |
   | Variable | `PUBLIC_URL` | facoltativa, `https://nightcrawlers.duckdns.org`: il deploy controlla che il sito risponda. Impostala dopo il passaggio al certificato di produzione |

3. *Settings > Environments*: crea `production` (facoltativo: *Required reviewers* per approvare ogni deploy).
4. Chiave di deploy, generata sul tuo PC e usata solo da GitHub Actions:
   ```bash
   ssh-keygen -t ed25519 -N "" -C "github-deploy-nightcrawlers" -f nc_deploy
   # nc_deploy      -> secret SSH_KEY
   # nc_deploy.pub  -> DEPLOY_SSH_PUBKEY al passo 6.2
   ```
   Poi cancella `nc_deploy` dal PC (resta solo nei secrets).
5. Le immagini su GHCR restano private: il job di deploy passa alla VM il token temporaneo del workflow per il `pull`
   e fa logout alla fine; sulla VM non resta nessuna credenziale del registry.

## 6. Preparazione della VM

1. Collegati: `ssh ubuntu@<IP>`. Tieni aperta una seconda sessione SSH finché non hai finito (protezione dal lock-out).
2. Copia ed esegui lo script di setup (idempotente: puoi rilanciarlo):
   ```bash
   scp ops/setup-vm.sh ubuntu@<IP>:
   ssh ubuntu@<IP>
   sudo DEPLOY_SSH_PUBKEY="ssh-ed25519 AAAA... github-deploy-nightcrawlers" bash setup-vm.sh
   ```
   Fa: aggiornamenti di sicurezza automatici (con riavvio notturno alle 04:30 se servono), utente `deploy`
   (solo chiave, gruppo `docker`), SSH solo con chiave e senza root, `ufw` e regole `iptables` di Oracle con
   22/80/443, `fail2ban`, Docker Engine + compose plugin, `/opt/nightcrawlers` con `.env` (permessi 600), backup alle 03:30.
3. Compila `/opt/nightcrawlers/.env` partendo da `.env.example` (`sudo -u deploy nano /opt/nightcrawlers/.env`):
   ```bash
   openssl rand -base64 48 | tr -d '\n/+='; echo   # per JWT_SECRET
   openssl rand -hex 24                            # per POSTGRES_PASSWORD, DB_OWNER_PASSWORD, DB_APP_PASSWORD, IP_HASH_SALT
   ```
   - `DOMAIN=nightcrawlers.duckdns.org`, `PUBLIC_URL=https://nightcrawlers.duckdns.org`, `ACME_EMAIL=<tua email>`
   - `ACME_CA=https://acme-staging-v02.api.letsencrypt.org/directory` per il primo avvio (passo 7)
   - `GHCR_OWNER=<owner GitHub in minuscolo>`
   - Brevo e DuckDNS dai passi 3 e 4. Niente `$` né `#` nei valori.
   - Le password del DB valgono alla **prima** inizializzazione del volume: cambiarle dopo richiede `ALTER ROLE` nel DB.
   - Verifica: `ls -l /opt/nightcrawlers/.env` → `-rw------- deploy deploy`.
4. Impronta della VM per `SSH_KNOWN_HOSTS`: sulla VM `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`; dal PC
   `ssh-keyscan -t ed25519 <IP> | tee known_hosts | ssh-keygen -lf -`. Se le impronte coincidono, il contenuto di
   `known_hosts` va nel secret.

## 7. Primo deploy (CA di staging, poi produzione)

1. GitHub: *Actions > Deploy > Run workflow* su `main` (oppure un push su `main` con CI verde).
   Il job costruisce le immagini arm64, le pubblica su GHCR, copia `docker-compose.yml`, `db/init/` e `ops/` sulla VM
   ed esegue `ops/deploy.sh <sha>`: `docker compose pull` + `up -d --wait`.
2. Sulla VM: `cd /opt/nightcrawlers && docker compose ps` → `web`, `backend`, `db` *healthy*, `duckdns` *running*.
   `docker compose logs web | grep -i certificate` → certificato ottenuto dalla CA di **staging**.
   `curl -kI https://nightcrawlers.duckdns.org` → 200 con gli header di sicurezza.
   Se il DNS non punta ancora alla VM, Caddy riprova da solo con attese crescenti: niente cicli che esauriscono i limiti.
3. Passaggio a produzione: in `.env` imposta `ACME_CA=https://acme-v02.api.letsencrypt.org/directory`, poi
   `docker compose up -d --force-recreate web`. Controlla `curl -I https://nightcrawlers.duckdns.org` (senza `-k`).
4. Imposta la variabile GitHub `PUBLIC_URL`.

**Prima del rilascio pubblico** la variabile `VITE_PRIVACY_EMAIL` deve contenere un indirizzo reale (il valore di
ripiego `privacy@nightcrawlers.duckdns.org` non è una casella esistente). Il workflow rifiuta il deploy se è vuota.

## 8. Backup su Object Storage

1. *Storage > Buckets*: crea il bucket **privato** `nightcrawlers-backups` (Standard tier). In *Lifecycle Policy Rules*
   aggiungi una regola che cancella gli oggetti dopo 30 giorni.
2. Autorizzazione della VM senza chiavi (consigliata, *instance principal*):
   - *Identity > Dynamic Groups*: `nc-vm` con regola `instance.id = '<OCID della VM>'`;
   - *Identity > Policies* (nel compartment): 
     `Allow dynamic-group nc-vm to manage objects in compartment <compartment> where target.bucket.name = 'nightcrawlers-backups'`
     e `Allow dynamic-group nc-vm to read buckets in compartment <compartment>`.
   In alternativa una API key per l'utente `deploy` in `/home/deploy/.oci/config` con `key_file=~/.oci/oci_api_key.pem`.
3. `/opt/nightcrawlers/backup.env` (proprietario `deploy`, permessi 600):
   ```
   OCI_BUCKET=nightcrawlers-backups
   OCI_AUTH=instance_principal
   ```
   Se `oci` non è installato, lo script usa l'immagine `ghcr.io/oracle/oci-cli`.
4. Prova: `sudo -u deploy /opt/nightcrawlers/ops/backup.sh` → dump in `/opt/nightcrawlers/backups/` e oggetto nel bucket.
   Il cron delle 03:30 scrive in `/opt/nightcrawlers/backups/backup.log`; rotazione locale 7 giorni.
5. **Test di ripristino** (fa parte del runbook, ripetilo ogni mese):
   `sudo -u deploy /opt/nightcrawlers/ops/restore-test.sh` → `restore OK: users=... flyway_version=...`.
   Carica l'ultimo dump in un PostgreSQL temporaneo senza rete e lo elimina alla fine.

## 9. Verifiche finali

- `https://<dominio>` con certificato valido; https://www.ssllabs.com/ssltest/ ≥ A; https://securityheaders.com ≥ A.
- `curl -s -o /dev/null -w '%{http_code}' https://<dominio>/actuator/health` → `404`.
- Riavvio: `sudo reboot`, poi `docker compose ps` → tutti di nuovo *healthy* (`restart: unless-stopped`) e i dati
  ancora presenti (login con un account esistente).
- `ops/restore-test.sh` OK.
- Run completa da desktop, telefono e controller sul dominio pubblico.

## Operazioni

- **Log**: `cd /opt/nightcrawlers && docker compose logs -f --tail 100 backend` (ruotati: 3 × 10 MB per container).
- **Deploy fallito**: se `up --wait` fallisce (per esempio una migrazione Flyway errata: il backend non diventa
  *healthy*), `ops/deploy.sh` riporta lo stack al tag in `.last-good-tag` ed esce con errore, quindi il job è rosso.
  Le migrazioni PostgreSQL sono transazionali: una migrazione fallita non lascia modifiche. Durante il tentativo il
  backend resta giù per circa 20–60 secondi.
- **Rollback manuale**: `sudo -u deploy GHCR_OWNER=<owner> /opt/nightcrawlers/ops/deploy.sh <sha precedente>`
  (con le immagini private serve prima un `docker login ghcr.io` con un token `read:packages`, poi `docker logout`).
- **Ripristino in produzione** da un dump (perdita dei dati successivi al dump):
  ```bash
  cd /opt/nightcrawlers
  docker compose stop web backend
  docker compose exec -T db pg_restore -U postgres -d nightcrawlers --clean --if-exists --no-owner \
    --role=nc_owner < backups/nc-<data>.dump
  docker compose start backend web
  ```
- **Rotazione dei segreti**: `JWT_SECRET` (invalida le sessioni in corso), chiave SMTP e token DuckDNS si cambiano in
  `.env` + `docker compose up -d`. Le password del DB richiedono anche `ALTER ROLE ... PASSWORD` nel database.
- **Aggiornamenti**: il sistema operativo si aggiorna da solo; le dipendenze arrivano come PR di Dependabot.
