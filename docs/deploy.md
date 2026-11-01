# Deploy su Oracle Cloud: runbook

Questo runbook lo esegui tu: account, credenziali e segreti non passano mai dal repository né dagli agenti.
Tempo stimato per il primo rilascio: 2–3 ore.

In questo documento `you@example.com` sta per il **tuo indirizzo di contatto** (mittente Brevo verificato,
account Let's Encrypt, contatto privacy, alert di budget). Il valore reale non va nel repository: vive solo nel
`.env` del server e nella variabile GitHub `VITE_PRIVACY_EMAIL`.

| Valore | Produzione |
|---|---|
| Repository | `JusTMeth25/Nightcrawlers` (privato) |
| Immagini | `ghcr.io/justmeth25/nightcrawlers-web`, `ghcr.io/justmeth25/nightcrawlers-backend` (nomi GHCR sempre minuscoli), tag = SHA del commit |
| Sito | https://playnightcrawlers.duckdns.org (sottodominio DuckDNS `playnightcrawlers`) |
| Mittente email | `Nightcrawlers <you@example.com>` (mittente verificato su Brevo) |
| Contatto privacy | `you@example.com` (variabile GitHub `VITE_PRIVACY_EMAIL`) |

## Architettura

```
Internet ──80/443──> web (Caddy: TLS Let's Encrypt, build FE, header di sicurezza)
                       └── /api/* ──> backend (Spring Boot, utente non root) ──> db (PostgreSQL 18, volume pgdata)
                     duckdns (aggiorna l'IP del sottodominio)
```

- Tutto gira con Docker Compose in `/opt/nightcrawlers` sulla VM (`docker-compose.yml`, `.env`, `db/init/`, `ops/`).
- Solo `web` pubblica porte (80, 443). Il DB è su una rete Docker interna senza uscita, mai esposto.
- `/actuator/*` risponde 404 dall'esterno; percorsi con `;` o `..` rispondono 400; corpi `/api` oltre 1 MB → 413.
- Memoria (VM da 12 GB, nient'altro sopra): backend 1,5 GB (heap 75% ≈ 1,1 GB), PostgreSQL 2 GB
  (`shared_buffers` 512 MB, `effective_cache_size` 1,5 GB, 50 connessioni), Caddy 256 MB, DuckDNS 64 MB.
- CI (`.github/workflows/ci.yml`) su push/PR; il deploy (`deploy.yml`) parte dopo una CI verde su `main` o a mano, solo da `main`.

## 1. Account Oracle Cloud: Pay-As-You-Go a costo zero

L'account è **nuovo e Pay-As-You-Go** (Oracle non recupera le istanze "inattive" come sugli account free tier),
ma deve restare **gratuito al 100%**: si usano solo risorse Always Free.

1. Crea l'account e scegli la regione home (per esempio `eu-milan-1` o `eu-frankfurt-1`): non si cambia più, e le
   risorse Always Free esistono solo nella regione home.
2. Passa a Pay-As-You-Go (*Billing > Upgrade and Manage Payment*).
3. **Budget con alert a 1 EUR**, subito, prima di creare qualsiasi risorsa:
   *Billing & Cost Management > Budgets > Create Budget*
   - Scope: il compartment root (tenancy), *Monthly*, importo **1 EUR**.
   - Alert 1: *Actual spend*, soglia **100%** (1 EUR), email `you@example.com`.
   - Alert 2: *Forecast spend*, soglia 100%, stessa email (avvisa prima di arrivare alla spesa).
4. Limiti Always Free da rispettare (totali per la tenancy):

   | Risorsa | Limite gratuito | Uso previsto |
   |---|---|---|
   | Compute `VM.Standard.A1.Flex` (Ampere) | 4 OCPU e 24 GB RAM in totale | 1 VM, 2 OCPU / 12 GB |
   | Block storage (boot + block volume) | 200 GB in totale, 5 backup di volume | boot volume 50 GB, nessun block volume extra |
   | Object Storage | 20 GB (Standard + Infrequent + Archive), 50.000 richieste/mese | bucket backup, retention 14 e lifecycle 30 giorni (pochi MB) |
   | Rete | 1 VCN con subnet pubblica, 10 TB di traffico in uscita al mese | |
   | IP pubblico | IP effimero della VM (gratuito) | effimero: DuckDNS segue l'IP se cambia |
   | Load balancer | **non usarlo** (Caddy fa da reverse proxy) | nessuno |

   Da **non** creare: forme diverse da `VM.Standard.A1.Flex`/`VM.Standard.E2.1.Micro`, load balancer, database
   gestiti, IP pubblici riservati aggiuntivi, block volume oltre i 200 GB, bucket Archive con recuperi frequenti.
5. **Checklist "tutto Always Free"** (dopo ogni creazione e poi una volta al mese):
   - [ ] *Compute > Instances*: la VM mostra l'etichetta **Always Free-eligible** e la forma `VM.Standard.A1.Flex`, ≤ 4 OCPU / 24 GB in totale.
   - [ ] *Storage > Block Volumes / Boot Volumes*: somma delle dimensioni ≤ 200 GB.
   - [ ] *Storage > Buckets*: il bucket dei backup è Standard e sotto i 20 GB (*Bucket details > Approximate size*).
   - [ ] *Networking > Load Balancers*: nessuno. *Reserved public IPs*: nessuno a pagamento.
   - [ ] *Billing > Cost Analysis*: costo del mese **0,00**.
   - [ ] *Governance > Limits, Quotas and Usage*: nessun servizio a pagamento in uso.
   - [ ] Il budget da 1 EUR esiste e le email di alert arrivano (Oracle manda una conferma alla creazione).

## 2. VM Ampere A1

1. *Compute > Instances > Create instance*:
   - Immagine: **Canonical Ubuntu 24.04** (aarch64). Forma: `VM.Standard.A1.Flex`, 2 OCPU / 12 GB.
   - Boot volume: 50 GB (il valore predefinito va bene).
   - Rete: VCN con subnet pubblica, *Assign a public IPv4 address* (IP **effimero**, gratuito).
   - Chiave SSH: carica la **tua** chiave pubblica (account `ubuntu`).
   - Se compare "Out of capacity", riprova più tardi o in un altro availability domain.
   - Controlla che il riepilogo indichi *Always Free-eligible* prima di confermare.
2. **Security List** della subnet (*Networking > VCN > Security Lists > Default*), regole in ingresso, origine `0.0.0.0/0`:
   - TCP 22 (SSH; anche i runner di GitHub Actions devono raggiungerla per il deploy)
   - TCP 80 (redirect HTTPS e challenge ACME)
   - TCP 443 (HTTPS)
   - facoltativa: UDP 443 (HTTP/3)
   Nient'altro: niente 5432, niente 8080.

## 3. DuckDNS

1. Accedi su https://www.duckdns.org, crea il sottodominio **`playnightcrawlers`** e copia il **token**.
2. Imposta l'IP pubblico della VM nel campo *current ip* (poi il container `duckdns` lo aggiorna ogni 5 minuti,
   anche se l'IP effimero cambia).
3. Verifica: `nslookup playnightcrawlers.duckdns.org` restituisce l'IP della VM.

## 4. Brevo (SMTP)

Relay SMTP Brevo, porta 587 con STARTTLS.

1. In *Senders, Domains & Dedicated IPs > Senders* deve risultare **verificato** il mittente `you@example.com`.
   (Con un sottodominio DuckDNS non si possono aggiungere i record SPF/DKIM: si usa il mittente singolo verificato.)
2. *SMTP & API > SMTP*: crea una **chiave SMTP** dedicata a Nightcrawlers. Ti servono il *login SMTP* e la *chiave*:
   vanno solo nel `.env` della VM (passo 6.3), mai nel repository.
3. Valori preimpostati da `init-secrets.sh`: `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`,
   `MAIL_FROM=Nightcrawlers <CONTACT_EMAIL>`.

## 5. Repository GitHub `JusTMeth25/Nightcrawlers`

1. Crea il repository (privato) e fai il push di `main`.
2. **Environment `production`** (*Settings > Environments > New environment*), obbligatorio:
   - *Deployment branches and tags*: **Selected branches** → solo `main`. Il workflow di deploy gira solo da `main`
     e solo questo environment vede i segreti SSH e può pubblicare le immagini.
   - facoltativo: *Required reviewers* per approvare ogni deploy.
   - **Environment secrets** (nell'environment, non come secret del repository):

     | Secret | Valore |
     |---|---|
     | `SSH_HOST` | `playnightcrawlers.duckdns.org` (segue l'IP effimero) |
     | `SSH_USER` | `deploy` |
     | `SSH_KEY` | chiave **privata** di deploy (vedi sotto), intera |
     | `SSH_KNOWN_HOSTS` | output **verificato** di `ssh-keyscan -t ed25519 playnightcrawlers.duckdns.org` (passo 6.4) |

3. *Settings > Secrets and variables > Actions* (livello repository):

   | Tipo | Nome | Valore |
   |---|---|---|
   | Secret | `NVD_API_KEY` | facoltativo: chiave gratuita da https://nvd.nist.gov/developers/request-an-api-key (dependency-check settimanale più veloce) |
   | Variable | `VITE_PRIVACY_EMAIL` | `you@example.com` (**obbligatoria**: senza, il deploy si ferma) |
   | Variable | `PUBLIC_URL` | `https://playnightcrawlers.duckdns.org`; impostala **dopo** il passaggio al certificato di produzione (passo 7.4) |

4. *Settings > Actions > General > Fork pull request workflows from outside collaborators*:
   **Require approval for all outside collaborators**.
5. Chiave di deploy, generata sul tuo PC e usata solo da GitHub Actions:
   ```bash
   ssh-keygen -t ed25519 -N "" -C "github-deploy-nightcrawlers" -f nc_deploy
   # nc_deploy      -> environment secret SSH_KEY
   # nc_deploy.pub  -> DEPLOY_SSH_PUBKEY al passo 6.2
   ```
   Poi cancella `nc_deploy` dal PC (resta solo nei secrets).
6. Le immagini su GHCR restano private: il job di deploy passa alla VM il token temporaneo del workflow per il `pull`
   (sullo stdin, mai sulla riga di comando) e fa logout alla fine; sulla VM non resta nessuna credenziale del registry.
   Le action sono fissate per SHA di commit; Dependabot le aggiorna.

### 5.1 Limiti gratuiti di GitHub (repository privato)

Il repository è privato: GitHub Free include **2000 minuti di Actions al mese** (runner Linux, moltiplicatore 1×)
e **500 MB di storage** condiviso tra GitHub Packages (GHCR) e artefatti di Actions. Deve restare tutto gratuito.

- *Settings (profilo) > Billing and plans > Budgets / Spending limits*: il limite di spesa per **Actions** e per
  **Packages** deve restare **0 USD** (nessun metodo di pagamento necessario). Con limite 0, a quota esaurita i job
  si fermano invece di generare costi.
- Dove controllare: *Billing and plans > Usage this month* (minuti Actions, storage Packages/Artifacts).
  Controllo consigliato una volta a settimana nelle prime settimane.
- Come il progetto resta nei limiti:
  - CI con filtri sui percorsi: una modifica solo FE non lancia il job BE e viceversa (dati di gioco e `shared/`
    lanciano entrambi); push di sola documentazione non lanciano CI né deploy; un nuovo push annulla la run
    precedente dello stesso branch.
  - e2e solo su push a `main` e PR verso `main`.
  - OWASP dependency-check settimanale (lunedì) o manuale, workflow `Dependency check`, con cache del database NVD.
  - Artefatti caricati solo se un job fallisce, conservati 7 giorni.
  - Dopo ogni deploy riuscito il job *Prune old GHCR versions* tiene solo le ultime 3 versioni di ogni immagine
    (più quella in produzione e la precedente buona, usata per il rollback). Nessun tag `latest`.
  - Immagini piccole: backend ~127 MB compressi (runtime Java ridotto con `jlink`), web ~31 MB. I layer comuni
    (dipendenze, runtime) cambiano raramente tra una versione e l'altra.
- Stima: un push su `main` che tocca FE e BE ≈ 35 minuti (CI ≈ 25 compresi e2e, deploy ≈ 10); una PR solo FE ≈ 15;
  dependency-check ≈ 5–10 a settimana. Ordine di grandezza: 50–60 rilasci completi al mese.
- Se la quota si avvicina: limita i deploy a mano (*Run workflow*) o raggruppa le modifiche in meno push.

## 6. Preparazione della VM

1. Collegati: `ssh ubuntu@<IP>`. Tieni aperta una seconda sessione SSH finché non hai finito (protezione dal lock-out).
2. Copia ed esegui gli script di setup (idempotenti: puoi rilanciarli):
   ```bash
   scp ops/setup-vm.sh ops/init-secrets.sh ops/backup.sh ops/status.sh ubuntu@<IP>:
   ssh ubuntu@<IP>
   sudo DEPLOY_SSH_PUBKEY="ssh-ed25519 AAAA... github-deploy-nightcrawlers" CONTACT_EMAIL=you@example.com \
     bash setup-vm.sh
   ```
   Fa: aggiornamenti di sicurezza automatici (Ubuntu e Docker CE, riavvio notturno alle 04:30 se serve);
   firewall con le regole `iptables` di Oracle (`netfilter-persistent`): 22/80/443 accettate prima del `REJECT`
   finale, sia attive sia in `/etc/iptables/rules.v4` (niente `ufw`: su Ubuntu 24.04 è in conflitto con
   `iptables-persistent`); Docker Engine + compose plugin con verifica dell'impronta della chiave apt; utente
   `deploy` (solo chiave, gruppo `docker`); SSH solo con chiave e senza root; `fail2ban`; `/opt/nightcrawlers`;
   backup alle 03:30, aggiornamento settimanale delle immagini `postgres`/`duckdns`, logrotate.
3. **`.env` e segreti**: `init-secrets.sh` crea `/opt/nightcrawlers/.env` (permessi 600, proprietario `deploy`) con
   i valori di produzione e **genera sul server**, con `openssl`, `POSTGRES_PASSWORD`, `DB_OWNER_PASSWORD`,
   `DB_APP_PASSWORD`, `JWT_SECRET` e `IP_HASH_SALT`. Non devi scegliere nessuna password.
   Restano da inserire solo i valori che hai tu:
   ```bash
   sudo -u deploy nano /opt/nightcrawlers/.env
   #   SMTP_USERNAME=<login SMTP Brevo>
   #   SMTP_PASSWORD=<chiave SMTP Brevo>
   #   DUCKDNS_TOKEN=<token DuckDNS>
   sudo CONTACT_EMAIL=you@example.com bash init-secrets.sh    # deve dire ".env complete"
   ```
   - I segreti esistenti non vengono mai rigenerati: le password del DB valgono dalla **prima** inizializzazione
     del volume (cambiarle dopo richiede anche `ALTER ROLE` nel database).
   - Verifica: `ls -l /opt/nightcrawlers/.env` → `-rw------- deploy deploy`.
4. Impronta della VM per `SSH_KNOWN_HOSTS`: sulla VM `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`; dal PC
   `ssh-keyscan -t ed25519 playnightcrawlers.duckdns.org | tee known_hosts | ssh-keygen -lf -`. Se le impronte
   coincidono, il contenuto di `known_hosts` va nell'environment secret.
5. Firewall: `sudo iptables -S INPUT` mostra le regole ACCEPT per 22, 80, 443 prima del `REJECT`.

## 7. Primo deploy (CA di staging, poi produzione)

1. GitHub: *Actions > Deploy > Run workflow* su `main` (oppure un push su `main` con CI verde).
   Il job (environment `production`) costruisce le immagini arm64, le pubblica su GHCR, copia `docker-compose.yml`,
   `db/init/` e `ops/` sulla VM ed esegue `ops/deploy.sh <sha>`: dump pre-deploy, `docker compose pull`
   (tutte le immagini) e `up -d --wait`.
2. Sulla VM: `cd /opt/nightcrawlers && docker compose ps` → `web`, `backend`, `db` *healthy*, `duckdns` *running*.
   `docker compose logs web | grep -i certificate` → certificato ottenuto dalla CA di **staging**
   (`.env` parte con `ACME_CA` di staging).
   `curl -kI https://playnightcrawlers.duckdns.org` → 200 con gli header di sicurezza.
   Se il DNS non punta ancora alla VM, Caddy riprova da solo con attese crescenti: niente cicli che esauriscono i limiti.
3. Passaggio a produzione: in `.env` imposta `ACME_CA=https://acme-v02.api.letsencrypt.org/directory`, poi
   `docker compose up -d --force-recreate web`. Controlla `curl -I https://playnightcrawlers.duckdns.org` (senza `-k`).
4. Imposta la variabile GitHub `PUBLIC_URL`.

**Prima del rilascio pubblico** la variabile `VITE_PRIVACY_EMAIL` deve contenere il tuo indirizzo reale (il valore di
ripiego dell'app, `privacy@nightcrawlers.duckdns.org`, non è una casella esistente). Il workflow rifiuta il deploy se è vuota.

## 8. Backup su Object Storage

1. *Storage > Buckets*: crea il bucket **privato** `nightcrawlers-backups` (tier Standard, dentro i 20 GB gratuiti).
   - *Retention Rules*: regola **14 giorni** (gratuita): per 14 giorni nessuno, nemmeno una VM compromessa, può
     cancellare o sovrascrivere un backup.
   - *Lifecycle Policy Rules*: cancella gli oggetti dopo 30 giorni.
   - Annota il *Namespace* (in *Bucket details*).
2. Autorizzazione della VM senza chiavi (*instance principal*; IAM è gratuito), con il minimo indispensabile:
   - *Identity > Dynamic Groups*: `nc-vm` con regola `instance.id = '<OCID della VM>'`;
   - *Identity > Policies* (nel compartment del bucket):
     ```
     Allow dynamic-group nc-vm to read buckets in compartment <compartment> where target.bucket.name = 'nightcrawlers-backups'
     Allow dynamic-group nc-vm to manage objects in compartment <compartment> where all {target.bucket.name = 'nightcrawlers-backups', any {request.permission = 'OBJECT_CREATE', request.permission = 'OBJECT_INSPECT'}}
     ```
     La VM può solo caricare nuovi oggetti ed elencarli: non può leggerli, sovrascriverli né cancellarli.
     Lo script carica con nomi unici per data e ora (`nc-<UTC>.dump`) e `--no-overwrite`.
   In alternativa una API key per l'utente `deploy` in `/home/deploy/.oci/config` (`key_file=~/.oci/oci_api_key.pem`)
   di un utente IAM con la stessa policy.
3. `/opt/nightcrawlers/backup.env` (proprietario `deploy`, permessi 600):
   ```
   OCI_BUCKET=nightcrawlers-backups
   OCI_NAMESPACE=<namespace>
   OCI_AUTH=instance_principal
   ```
   Se `oci` non è installato, lo script usa l'immagine `ghcr.io/oracle/oci-cli` (versione fissata).
4. Prova: `sudo -u deploy /opt/nightcrawlers/ops/backup.sh` → dump in `/opt/nightcrawlers/backups/` e oggetto nel bucket.
   Il cron delle 03:30 scrive in `/opt/nightcrawlers/backups/backup.log` (logrotate settimanale); rotazione locale 7 giorni.
5. **Controllo e alert**: un backup fallito scrive un errore nel syslog (`journalctl -t nightcrawlers-backup`) e il file
   `backups/.last-failure`. `sudo -u deploy /opt/nightcrawlers/ops/status.sh` riassume container, tag in produzione,
   ultimo backup riuscito (avvisa se più vecchio di 26 ore) e disco; esce con 1 se qualcosa non va. Eseguilo dopo ogni
   accesso alla VM.
6. **Test di ripristino** (fa parte del runbook, ripetilo ogni mese):
   `sudo -u deploy /opt/nightcrawlers/ops/restore-test.sh` → `restore OK: users=... flyway_version=...`.
   Carica l'ultimo dump in un PostgreSQL temporaneo senza rete e lo elimina alla fine.

## 9. Verifiche finali

- https://playnightcrawlers.duckdns.org con certificato valido; https://www.ssllabs.com/ssltest/ ≥ A;
  https://securityheaders.com ≥ A.
- `curl -s -o /dev/null -w '%{http_code}' https://playnightcrawlers.duckdns.org/actuator/health` → `404`.
- Registrazione: l'email di verifica arriva dal tuo mittente con link a `https://playnightcrawlers.duckdns.org`.
- Riavvio: `sudo reboot`, poi `ops/status.sh` → tutti di nuovo *healthy* (`restart: unless-stopped`) e i dati
  ancora presenti (login con un account esistente).
- `ops/restore-test.sh` OK.
- Checklist "tutto Always Free" (passo 1.5) ripassata, costo del mese 0,00.
- Run completa da desktop, telefono e controller sul dominio pubblico.

## Migrazioni del database: expand/contract

Ogni deploy applica le migrazioni Flyway **prima** che si sappia se la nuova versione è sana. Se il deploy fallisce,
`ops/deploy.sh` riavvia l'immagine precedente **sullo schema già migrato**. Quindi ogni migrazione deve essere
compatibile con l'immagine precedente:

- *expand*: aggiungere tabelle, colonne nullable o con default, indici; mai rinominare o cancellare nello stesso rilascio;
- *contract*: rimuovere colonne/tabelle non più usate solo in un rilascio **successivo**, quando nessuna immagine in
  produzione le legge più.

Una migrazione che fallisce non lascia modifiche (PostgreSQL esegue le migrazioni in transazione) e il rollback è
automatico. Durante il tentativo il backend resta giù per circa 20–60 secondi.

### Ripristino del dump pre-deploy

Prima di ogni deploy `ops/deploy.sh` salva `backups/pre-deploy-<UTC>-<sha>.dump` (gli ultimi 3). Se una migrazione è
riuscita ma la nuova versione va abbandonata e lo schema non è compatibile con quella precedente:

```bash
cd /opt/nightcrawlers
docker compose stop web backend
docker compose exec -T db pg_restore -U postgres -d nightcrawlers --clean --if-exists --no-owner \
  --role=nc_owner --exit-on-error < backups/pre-deploy-<UTC>-<sha>.dump
sudo -u deploy /opt/nightcrawlers/ops/deploy.sh <sha precedente>   # dopo docker login, vedi sotto
```

I dati scritti tra il dump e il ripristino vanno persi.

## Operazioni

- **Stato**: `sudo -u deploy /opt/nightcrawlers/ops/status.sh`.
- **Log**: `cd /opt/nightcrawlers && docker compose logs -f --tail 100 backend` (ruotati: 3 × 10 MB per container).
- **Rollback manuale**: `sudo -u deploy /opt/nightcrawlers/ops/deploy.sh <sha precedente>`
  (con le immagini private serve prima un `docker login ghcr.io` con un token `read:packages`, poi `docker logout`).
- **Ripristino da un backup giornaliero**: come sopra, con `backups/nc-<data>.dump`.
- **Rotazione dei segreti**: `JWT_SECRET` (invalida le sessioni in corso), chiave SMTP e token DuckDNS si cambiano in
  `.env` + `docker compose up -d`. Per rigenerare un segreto: impostalo a `CHANGE_ME` e rilancia `init-secrets.sh`.
  Le password del DB richiedono anche `ALTER ROLE ... PASSWORD` nel database.
- **Aggiornamenti**: sistema operativo e Docker Engine si aggiornano da soli; `postgres:18` (patch) e `duckdns`
  vengono riscaricati la domenica e a ogni deploy; le dipendenze e le versioni fissate arrivano come PR di Dependabot.

## Compromessi noti (accettati)

- Il ruolo applicativo `nc_app` ha i privilegi DML anche su `flyway_schema_history` (privilegi di default sul
  ruolo proprietario: non si escludono singole tabelle).
- Il backend conosce `DB_OWNER_PASSWORD` perché Flyway migra all'avvio con il ruolo proprietario.
- I segreti arrivano ai container come variabili d'ambiente (visibili a chi controlla Docker sulla VM).
- L'utente `deploy` è nel gruppo `docker`, quindi equivalente a root sulla VM: ha solo la chiave della CI, niente
  password né sudo.
