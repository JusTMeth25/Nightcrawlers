# Ambiente di sviluppo

Tre modi di far girare Nightcrawlers in locale, dal più veloce da modificare al più vicino alla produzione.

## 1. Sviluppo quotidiano (Vite + Spring Boot + PostgreSQL locale)

1. In pgAdmin crea il database `nightcrawlers` (PostgreSQL 18).
2. Backend:
   ```bash
   cd BE
   cp src/main/resources/application-local.properties.example src/main/resources/application-local.properties
   # compila i valori: utenti DB, app.jwt.secret (openssl rand -base64 48), app.ip-hash-salt
   ./mvnw spring-boot:run -Dspring-boot.run.profiles=local
   ```
   Il profilo `local` usa Mailpit come SMTP e cookie senza `Secure` (HTTP sulla rete locale).
3. Mailpit per le email: `docker run -d --name nc-mailpit -p 1025:1025 -p 8025:8025 axllent/mailpit`
   (posta su http://localhost:8025).
4. Frontend: `cd FE && npm install && npm run dev` → http://localhost:5173 (Vite inoltra `/api` a `localhost:8080`).
5. Da telefono sulla stessa rete: `http://<IP-PC>:5173`.

Percorso di prova manuale: registrazione → email in Mailpit → verifica → login → run → fine run → save aggiornato →
Ripperdoc → ricarica pagina (sessione ripristinata) → logout.

## 2. Stack Docker come in produzione (`docker-compose.dev.yml`)

Immagini costruite dal checkout, Caddy con CA interna (`tls internal`) su `https://localhost`, Mailpit al posto di Brevo,
nessun DuckDNS. Serve per provare Caddy, header, CSP, immagini e script di backup.

```bash
cp .env.example .env       # valori locali usa e getta, per esempio:
#   DOMAIN=localhost  PUBLIC_URL=https://localhost  CADDY_TLS=internal
#   password e segreti: openssl rand -hex 24  (JWT_SECRET almeno 32 caratteri, non CHANGE_ME...)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build --wait
```

- Le variabili d'ambiente della shell hanno la precedenza su `.env` (regola di Docker Compose): se nel sistema
  esistono già `JWT_SECRET`, `MAIL_FROM`, `DB_*` o simili di altri progetti, toglile per la sessione
  (`env -u JWT_SECRET -u MAIL_FROM docker compose ...`), altrimenti lo stack usa quei valori.
- App: https://localhost (certificato della CA interna di Caddy: il browser lo segnala come non attendibile).
  Se le porte 80/443 sono occupate: `HTTP_PORT=8088`, `HTTPS_PORT=8443` e `PUBLIC_URL=https://localhost:8443` in `.env`.
- Email: http://localhost:8025 (`MAILPIT_UI_PORT` per cambiare porta; spegni prima un Mailpit già avviato sulla stessa porta).
- Il backend gira con i valori di produzione (rate limit compresi): 10 login al minuto per IP.
- Stop: `docker compose -f docker-compose.yml -f docker-compose.dev.yml down` (aggiungi `-v` per cancellare il DB).

## 3. Stack end-to-end (`docker-compose.e2e.yml`)

Stessa build di produzione servita da Caddy su HTTP semplice, backend con profilo `e2e` (rate limit alti, cookie senza
`Secure` per poter usare `http://localhost`), Mailpit come SMTP. È lo stack usato dal job `e2e` della CI.

```bash
# file env usa e getta (come sopra) con DOMAIN=http://localhost, PUBLIC_URL=http://localhost:8088,
# HTTP_PORT=8088, HTTPS_PORT=8443, MAILPIT_UI_PORT=8026
docker compose -p nc-e2e --env-file e2e.env \
  -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.e2e.yml up -d --build --wait
cd e2e && E2E_BASE_URL=http://localhost:8088 MAILPIT_URL=http://localhost:8026 npx playwright test
docker compose -p nc-e2e --env-file e2e.env \
  -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.e2e.yml down -v
```

Si testa la build di produzione e non il dev server di Vite: i ricaricamenti HMR del dev server interrompevano i test.
