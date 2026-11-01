# Nightcrawlers — Piano 04: Esecuzione, integrazione e rilascio (coordinatore)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Coordinare i tre agenti, integrare i loro branch, verificare il gioco end-to-end su tutti i dispositivi e distribuirlo su Oracle Cloud con CI/CD.

**Architecture:** Gli agenti lavorano in worktree separati e consegnano per milestone. Il coordinatore revisiona e fa il merge su `main`. Dopo l'integrazione: Playwright e2e, Dockerfile, Docker Compose con Caddy, DuckDNS e Postgres, GitHub Actions per CI e deploy su VM ARM.

**Tech Stack:** git worktree, Playwright, Docker (buildx `linux/arm64`), Caddy 2, PostgreSQL 18, GitHub Actions, GHCR, Oracle Cloud Always Free, DuckDNS, Brevo SMTP.

**Spec:** `docs/superpowers/specs/2026-10-31-nightcrawlers-design.md` (sezioni 5, 6, 7)

## Global Constraints

- Nessun commit, PR, tag o file riporta strumenti AI come autori o co-autori; i prompt degli agenti lo ripetono.
- Il coordinatore non modifica i file di un agente: i bug tornano all'agente proprietario.
- Segreti mai nel repository: `.env` sul server e GitHub Secrets.
- Immagini Docker `linux/arm64` (VM Ampere A1); container senza root.
- Solo le porte 80, 443 e 22 sono aperte all'esterno; il DB non è esposto.

## Review Focus

1. Cookie `Secure` in sviluppo su `http://<IP-PC>:5173` dal telefono: il refresh non funziona su HTTP non localhost. Il profilo `local` del BE imposta `app.cookies.secure=false`; in produzione è sempre `true`. Verifica in Task 3.
2. Riavvio della VM: tutti i container ripartono (`restart: unless-stopped`) e i dati Postgres restano sul volume. Verifica in Task 7.
3. Certificato HTTPS al primo avvio con DuckDNS appena aggiornato: Caddy ritenta finché il DNS non risolve; nessun loop di rate limit Let's Encrypt (staging CA nel primo test). Verifica in Task 7.
4. Deploy con migrazione Flyway che fallisce: il vecchio container resta attivo e il deploy si interrompe. Verifica in Task 6.
5. Backup non ripristinabile: il test di ripristino su un DB temporaneo fa parte del runbook. Verifica in Task 7.

---

## Esecuzione degli agenti

Ogni agente riceve un prompt con: percorso del proprio worktree, piano da eseguire, file di cui è proprietario, divieto di toccare altri file, divieto di attribuzioni AI, obbligo di TDD e di consegna per milestone con output di test/lint/build.

| Agente | Worktree | Branch | Piano | Milestone M1 | Milestone M2 |
|---|---|---|---|---|---|
| Backend | `../nc-backend` | `feat/backend` | 01 | Task 1–10 | Task 11–14 |
| Engine | `../nc-engine` | `feat/engine` | 02 | Task 1–12 (solo David, Maelstrom, Pistola, Shotgun, Monowire) | Task 13, 14, 14b, 15, 16 + tutti i contenuti |
| UI | `../nc-ui` | `feat/ui` | 03 | Task 1–3, 5 (con `MockApi`) | Task 4, 6–8 |

- Gli agenti partono insieme dopo il piano 00.
- Richieste di modifica a `shared/`, `data/` o config: l'agente si ferma su quel punto, prosegue con altro e invia la richiesta. Il coordinatore aggiorna `main`, poi l'agente fa `git merge main` nel proprio branch.

### Task 1: Revisione e merge M1

- [ ] **Step 1:** Per ogni branch: `git diff main...feat/<x> --stat` e verifica che tocchi solo i file di proprietà. File estranei → rifiuto con richiesta di correzione.
- [ ] **Step 2:** Code review del diff (correttezza, sicurezza, aderenza al piano). Per `feat/backend` anche security review su auth.
- [ ] **Step 3:** Merge `feat/backend`, `feat/engine`, `feat/ui` su `main` (`--no-ff`). Poi `cd FE && npm test && npm run lint && npm run build`, `cd BE && ./mvnw verify`, `node tools/sync-gamedata.mjs --check`. Tutto verde.
- [ ] **Step 4:** Ogni agente fa `git merge main` e prosegue con M2.

### Task 2: Revisione e merge M2

- [ ] **Step 1–3:** Come Task 1 per M2.

### Task 3: Integrazione reale FE ↔ BE

**Files:**
- Create: `FE/.env.example` (`VITE_API_MOCK=false`)
- Create: `docs/dev-setup.md`

- [ ] **Step 1:** L'utente crea il DB `nightcrawlers` in pgAdmin e compila `BE/src/main/resources/application-local.properties` dall'esempio (password `postgres` locale, `JWT_SECRET` generato con `openssl rand -base64 48`, SMTP Brevo o Mailpit locale).
- [ ] **Step 2:** Avvio BE (`./mvnw spring-boot:run -Dspring-boot.run.profiles=local`) e FE (`npm run dev`). Percorso manuale: registrazione → email (Mailpit in Docker: `docker run -p 1025:1025 -p 8025:8025 axllent/mailpit`) → verifica → login → run → fine run → save aggiornato → Ripperdoc → ricarica pagina (sessione ripristinata) → logout.
- [ ] **Step 3:** Da telefono sulla stessa rete: `http://<IP-PC>:5173`, stessa sequenza con touch. Con `app.cookies.secure=false` nel profilo `local` il refresh funziona.
- [ ] **Step 4:** Controller collegato al PC: navigazione menu e run completa.
- [ ] **Step 5:** Bug → issue all'agente proprietario con passi di riproduzione. `docs/dev-setup.md` documenta i passi sopra.

### Task 4: Test end-to-end

**Files:**
- Create: `e2e/package.json`, `e2e/playwright.config.ts`, `e2e/tests/guest.spec.ts`, `e2e/tests/account.spec.ts`, `e2e/tests/run.spec.ts`, `e2e/fixtures/mail.ts` (legge le email da Mailpit API)

**Interfaces:**
- Consumes: FE in preview (`npm run build && npm run preview`), BE con profilo `e2e` (rate limit alti, Mailpit come SMTP), Postgres da Docker.

- [ ] **Step 1:** `guest.spec.ts`: titolo → Gioca → David → la run parte (`[data-testid=game-canvas]` visibile, HUD con timer che avanza) → Esc → menu pausa → Abbandona → schermata fine run con invito a registrarsi.
- [ ] **Step 2:** `account.spec.ts`: registrazione → link da Mailpit → verifica → login → ricarica (ancora loggato) → logout-all → ricarica (ospite).
- [ ] **Step 3:** `run.spec.ts`: loggato → run → `run:quit` dopo 5 s → fine run con €$ assegnati dal server e save aggiornato.
- [ ] **Step 4:** Progetti Playwright: Chromium desktop, `Pixel 7` (touch) e WebKit `iPhone 14`. Run `npx playwright test` → verde.
- [ ] **Step 5:** Commit `test(e2e): add guest, account and run flows`.

### Task 5: Container

**Files:**
- Create: `BE/Dockerfile` (multi-stage: `eclipse-temurin:25-jdk` build con `./mvnw -DskipTests package`, runtime `eclipse-temurin:25-jre`, utente `app` non root, `JAVA_TOOL_OPTIONS=-XX:MaxRAMPercentage=75`)
- Create: `FE/Dockerfile` (build `node:24-alpine`, output copiato in un'immagine `caddy:2-alpine` insieme al `Caddyfile`)
- Create: `Caddyfile`, `docker-compose.yml`, `docker-compose.dev.yml`, `.env.example`, `.dockerignore`

**Interfaces:**
- Produces:
  - `Caddyfile`: dominio da `{$DOMAIN}`; `encode zstd gzip`; `handle /api/* { reverse_proxy backend:8080 }`; resto `file_server` con fallback SPA `try_files {path} /index.html`; cache lunga per `/assets/*` con hash; header `Content-Security-Policy "default-src 'self'; img-src 'self' data: blob:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"`, HSTS 1 anno, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy "camera=(), microphone=(), geolocation=()"`; blocco `/actuator/*` dall'esterno.
  - `docker-compose.yml`: servizi `web` (immagine FE+Caddy, porte 80/443, volumi `caddy_data`, `caddy_config`), `backend` (immagine BE, env da `.env`, `depends_on: db: condition: service_healthy`, healthcheck `/actuator/health`), `db` (`postgres:18`, volume `pgdata`, healthcheck `pg_isready`, nessuna porta pubblicata), `duckdns` (`lscr.io/linuxserver/duckdns`, env `SUBDOMAINS`, `TOKEN`). Tutti `restart: unless-stopped`. Immagini da `ghcr.io/<owner>/nightcrawlers-{web,backend}:${TAG}`.
  - `.env.example`: `DOMAIN`, `TAG`, `POSTGRES_PASSWORD`, `DB_APP_PASSWORD`, `JWT_SECRET`, `IP_HASH_SALT`, `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`, `ALLOWED_ORIGINS`, `DUCKDNS_SUBDOMAIN`, `DUCKDNS_TOKEN`.
  - Script `db/init/01-app-user.sh` (montato in `/docker-entrypoint-initdb.d`): crea l'utente applicativo con soli privilegi DML; Flyway gira con l'utente proprietario tramite `spring.flyway.user`.

- [ ] **Step 1:** `docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build` in locale (dev override: dominio `localhost`, `tls internal`, build locale). Verifica: `https://localhost` carica il gioco, `/api/auth/login` risponde, `/actuator/health` dall'esterno → 404, header di sicurezza presenti (`curl -I`).
- [ ] **Step 2:** Build `linux/arm64` con `docker buildx build --platform linux/arm64` per entrambe le immagini → OK.
- [ ] **Step 3:** Commit `build: add Dockerfiles, Caddy and compose stack`.

### Task 6: CI/CD

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `.github/dependabot.yml`, `.gitleaks.toml`

**Interfaces:**
- Produces:
  - `ci.yml` (push e PR): job `fe` (Node 24: `npm ci`, lint, typecheck, test con coverage, build, `npm audit --audit-level=high`), job `be` (Java 25 Temurin: `./mvnw verify`, Testcontainers con Docker del runner), job `gamedata` (`node tools/sync-gamedata.mjs --check`), job `tools` (`node --test tools/`), job `security` (gitleaks, OWASP dependency-check Maven con `failBuildOnCVSS=7`), job `e2e` (compose dev + Playwright, artefatto report).
  - `deploy.yml` (push su `main` dopo CI verde, o manuale): buildx `linux/arm64`, push su GHCR con tag SHA, SSH sulla VM (`appleboy/ssh-action` o `ssh` con chiave in secret), `TAG=<sha> docker compose pull && docker compose up -d --wait`; se `--wait` fallisce (healthcheck backend, ad esempio migrazione Flyway fallita) ripristina il tag precedente salvato in `/opt/nightcrawlers/.last-good-tag` e il job fallisce.
  - Secrets: `SSH_HOST`, `SSH_USER`, `SSH_KEY`, `SSH_KNOWN_HOSTS`, `GHCR_TOKEN` (o `GITHUB_TOKEN` con `packages: write`).

- [ ] **Step 1:** PR di prova → tutti i job verdi.
- [ ] **Step 2:** Deploy di prova con una migrazione volutamente errata su un branch → job fallito, vecchia versione ancora online. Annullare la migrazione.
- [ ] **Step 3:** Commit `ci: add CI pipeline and ARM deploy to Oracle`.

### Task 7: Server Oracle e runbook

**Files:**
- Create: `docs/deploy.md`, `ops/backup.sh`, `ops/restore-test.sh`, `ops/setup-vm.sh`

- [ ] **Step 1:** `docs/deploy.md` (eseguito dall'utente, le credenziali non passano dal coordinatore): creazione VM Ampere A1 (Ubuntu 24.04 ARM), consiglio di upgrade dell'account a Pay-As-You-Go con sole risorse Always Free, Security List con 22/80/443, sottodominio e token DuckDNS, dominio verificato e chiave SMTP Brevo, secrets GitHub.
- [ ] **Step 2:** `ops/setup-vm.sh`: aggiornamenti automatici di sicurezza (`unattended-upgrades`), utente `deploy`, SSH solo con chiave (`PasswordAuthentication no`, `PermitRootLogin no`), `ufw` 22/80/443 (e apertura delle stesse porte in `iptables` di Oracle Ubuntu), `fail2ban`, Docker Engine + plugin compose, directory `/opt/nightcrawlers` con `.env` (permessi 600).
- [ ] **Step 3:** `ops/backup.sh` (cron giornaliero 03:30): `docker compose exec -T db pg_dump -Fc` → `/opt/nightcrawlers/backups/nc-<data>.dump`, rotazione 7 giorni, upload su Oracle Object Storage con `oci os object put` (bucket privato). `ops/restore-test.sh`: ripristino dell'ultimo dump in un container Postgres temporaneo e conteggio righe di `users`.
- [ ] **Step 4:** Primo deploy con Caddy su CA staging (`acme_ca https://acme-staging-v02.api.letsencrypt.org/directory` via env), verifica, poi passaggio alla CA di produzione.
- [ ] **Step 4b:** Chiedere all'utente l'indirizzo email di contatto per la privacy e impostarlo come `VITE_PRIVACY_EMAIL` nel build FE della CD (GitHub Secret/variabile). Rilascio pubblico bloccato finché non è impostato: il valore provvisorio `privacy@nightcrawlers.duckdns.org` non è una casella reale.
- [ ] **Step 5:** Verifiche finali: `https://<dominio>` con certificato valido; test SSL Labs ≥ A; `securityheaders.com` ≥ A; riavvio VM → servizi di nuovo `healthy` e dati presenti; `ops/restore-test.sh` OK; run completa da desktop, telefono e controller sul dominio pubblico.
- [ ] **Step 6:** Commit `docs(ops): add deploy runbook, VM setup and backups`.

### Task 8: Chiusura

- [ ] **Step 1:** Verifica dei criteri di successo della spec 1.2 uno per uno, con evidenza (fps misurati, output CI, test dispositivi).
- [ ] **Step 2:** Rimozione dei worktree (`git worktree remove ../nc-*`) e dei branch fusi.
- [ ] **Step 3:** Aggiornamento di `README.md` con link al gioco, disclaimer e istruzioni.
