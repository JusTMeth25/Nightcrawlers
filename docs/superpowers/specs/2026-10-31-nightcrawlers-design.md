# Nightcrawlers — Design Spec

Data: 2026-10-31
Stato: in revisione

## 1. Obiettivo

Nightcrawlers è un gioco browser roguelike in stile "survivors-like" con orde infinite, ambientato nell'universo di Cyberpunk Edgerunners. È giocabile da desktop (tastiera + mouse), da smartphone (touch con doppio joystick virtuale) e con controller. Gli utenti registrati salvano i progressi sul server; gli ospiti giocano senza salvataggio.

Il progetto è di qualità produzione: sicuro, testato, distribuito pubblicamente.

### 1.1 Vincoli legali

- Fan game **non commerciale**: nessuna vendita, pubblicità a pagamento, donazioni legate all'accesso o contenuti premium.
- Disclaimer visibile nella schermata del titolo e nel footer: gioco fan non ufficiale, non affiliato a CD Projekt né a Studio Trigger, Cyberpunk e i personaggi appartengono ai rispettivi proprietari.
- Nessun logo ufficiale Cyberpunk: il titolo usa un logo originale "NIGHTCRAWLERS".
- Meccaniche del genere survivors-like sì; nomi, contenuti, bilanciamento e grafica di Vampire Survivors no.

### 1.2 Criteri di successo

1. Una run gira a 60 fps su desktop medio e almeno 45 fps su smartphone di fascia media con 400 nemici a schermo.
2. Lo stesso build funziona con tastiera + mouse, touch e gamepad, senza configurazione.
3. Un ospite può giocare subito senza registrarsi.
4. Un utente registrato ritrova €$, sblocchi e potenziamenti su qualunque dispositivo.
5. Nessuna vulnerabilità OWASP Top 10 nota; CI verde con audit dipendenze e scansione segreti.
6. Deploy riproducibile su Oracle Cloud Always Free con un solo comando.

## 2. Meccaniche di gioco

### 2.1 Loop della run

- Run **infinita**: si sopravvive il più a lungo possibile. Morte = fine run (permadeath).
- Mappa aperta di Night City generata a tile ripetuti; telecamera centrata sul personaggio.
- Movimento libero; le armi sparano in automatico secondo il proprio tipo di mira (2.3).
- I nemici uccisi lasciano **frammenti dati** (XP) e occasionalmente €$. Raccolta per contatto, con raggio di attrazione (statistica Magnete).
- **Level-up**: pausa, scelta di 1 carta tra 3. Una carta può essere: nuova arma, livello successivo di un'arma posseduta, nuovo cyberware, livello successivo di un cyberware. Se tutto è al massimo, le carte offrono €$ o cura.
- Massimo **6 armi** e **6 cyberware** per run. Armi: 8 livelli. Cyberware: 5 livelli.
- **Evoluzione**: arma al livello 8 + cyberware associato posseduto + apertura di un baule élite/boss = l'arma si trasforma nella versione evoluta.
- **Abilità firma**: ogni personaggio ha un'abilità attiva con cooldown, attivata con il pulsante abilità.

### 2.2 Personaggi

Tre iniziali, cinque sbloccabili. I personaggi senza spritesheet appaiono come "segnale criptato" nella selezione: requisiti e logica esistono, ma non sono selezionabili finché lo sprite non è disponibile.

| ID | Nome | Stato | Arma iniziale | Abilità firma | Bonus passivo | Requisito |
|---|---|---|---|---|---|---|
| `david` | David Martinez | iniziale | Pistola | Sandevistan: nemici rallentati del 70% per 3 s, scatto nella direzione di movimento | +10% velocità | — |
| `lucy` | Lucy | iniziale | Monowire | Quickhack: stordisce per 2 s e danneggia i nemici in un raggio | +15% riduzione cooldown | — |
| `rebecca` | Rebecca | iniziale | Shotgun | Fuoco esplosivo: raffica di 6 granate a ventaglio | +20% potenza, -10 PV max | — |
| `maine` | Maine | sbloccabile (sprite presente) | Minigun | Soppressione: cono di fuoco continuo per 4 s con respinta | +30% PV max, -10% velocità | Sopravvivi 10 minuti |
| `kiwi` | Kiwi | sbloccabile (sprite assente) | Smart Pistol | Cecchinaggio: colpo penetrante ad alto danno | +20% fortuna | Uccidi 50 MaxTac in totale |
| `pilar` | Pilar | sbloccabile (sprite assente) | Lanciagranate | Granata a grappolo | +20% area | Raccogli 5.000 €$ in totale |
| `dorio` | Dorio | sbloccabile (sprite assente) | Fucile pesante | Fuoco pesante: raffica perforante | +2 armatura | Sopravvivi 30 minuti con Maine |
| `falco` | Falco | sbloccabile (sprite assente) | Drone | Supporto: cura 30% PV e drone extra per 10 s | +30% magnete | Raggiungi 15 minuti con 3 personaggi diversi |

### 2.3 Armi

Ogni arma dichiara un tipo di mira:

- `aim`: spara nella direzione di mira del giocatore (o al nemico più vicino se la mira non è attiva).
- `nearest`: punta sempre il nemico più vicino.
- `area`: ignora la mira (orbitale, aura, posizioni casuali).

| ID | Nome | Mira | Cyberware per evoluzione | Evoluzione |
|---|---|---|---|---|
| `pistol` | Pistola | aim | `kerenzikov` | Pistola Overclock |
| `shotgun` | Shotgun | aim | `synthetic_muscle` | Shotgun Devastatore |
| `minigun` | Minigun | aim | `subdermal_armor` | Minigun Soppressore |
| `monowire` | Monowire | area | `neural_link` | Monowire Rete Neurale |
| `smart_pistol` | Smart Pistol | nearest | `kiroshi_optics` | Smart Pistol Predatrice |
| `grenade_launcher` | Lanciagranate | area | `blast_dampener` | Tempesta di Granate |
| `mantis_blades` | Mantis Blades | area | `biomonitor` | Mantis Vampiriche |
| `drone` | Drone | nearest | `data_collector` | Sciame di Droni |
| `heavy_rifle` | Fucile pesante | aim | `kiroshi_optics` | Fucile Perforante |

Uno stesso cyberware può abilitare più evoluzioni; ogni evoluzione richiede solo la propria coppia arma + cyberware. I valori numerici (danno, cadenza, proiettili, area, durata per livello) stanno in `FE/src/data/weapons.json`.

### 2.4 Cyberware (passivi)

| ID | Nome | Effetto per livello |
|---|---|---|
| `kerenzikov` | Riflessi Kerenzikov | -8% cooldown armi |
| `synthetic_muscle` | Muscoli sintetici | +10% potenza |
| `subdermal_armor` | Placche subdermali | +1 armatura |
| `neural_link` | Collegamento neurale | +10% durata effetti |
| `kiroshi_optics` | Ottica Kiroshi | +10% velocità proiettili e +5% critico |
| `blast_dampener` | Amplificatore d'impatto | +10% area |
| `biomonitor` | Biomonitor | +0,2 PV/s rigenerazione |
| `data_collector` | Collettore dati | +20% magnete, +5% crescita XP |

### 2.5 Psicosi

- Barra 0–100 visibile nell'HUD.
- Ogni uccisione aggiunge `0,05 × livelli totali di cyberware` punti.
- Effetti continui: +1% danno ogni 10 punti; cure ricevute ridotte dello stesso valore.
- A 100: modalità **Cyberpsicosi** per 10 s (danno ×2, movimento invertito, overlay rosso glitch), poi la barra torna a 0.
- Le costanti stanno in `FE/src/data/balance.json`.

### 2.6 Nemici

| ID | Nome | Comportamento | Comparsa |
|---|---|---|---|
| `maelstrom` | Ganger Maelstrom | inseguitore veloce, fragile, in sciame | da 0:00 |
| `arasaka` | Soldato Arasaka | mantiene la distanza e spara | da 5:00 |
| `maxtac` | Agente MaxTac | lento, corazzato, carica breve | da 10:00 |
| `cyberpsycho` | Cyberpsicopatico | boss: attacchi a cono, carica, evocazioni | ogni 10:00 |

- **Élite** ogni 5 minuti: un nemico del mix corrente con tinta intensa, scala 1,3×, PV ×8, lascia un baule.
- **Boss** ogni 10 minuti: a ogni ritorno PV ×1,5 rispetto al precedente e un pattern di attacco in più (massimo 4 pattern).
- **Orde speciali** a tempo definite in `waves.json`: anello che si chiude, muro che avanza, sciame veloce.

### 2.7 Scalata della difficoltà

- Fasi da 5 minuti; ogni fase definisce in `waves.json` il mix di nemici, la frequenza di spawn e le orde speciali.
- Dopo 30:00 scatta **Allerta MaxTac**: ogni minuto PV e danno nemici +3%, frequenza di spawn +2%, senza limite.
- Tetto di 400 nemici attivi: oltre il tetto, i nemici più lontani vengono riposizionati vicino al giocatore invece di crearne di nuovi.

### 2.8 Drop e bauli

- Pacco medico: cura 30 PV.
- Magnete globale: attira tutti i frammenti dati sullo schermo.
- Granata EMP: uccide tutti i nemici non boss sullo schermo.
- Sacca di €$: 10–50 €$.
- Baule élite/boss: 1–3 potenziamenti; se una evoluzione è disponibile, ha la precedenza.

### 2.9 Statistiche

PV max, rigenerazione, armatura, velocità, potenza, area, riduzione cooldown, durata, velocità proiettili, magnete, fortuna, crescita XP, rianimazioni. Valore finale = base personaggio + Ripperdoc + cyberware della run.

### 2.10 Meta-progressione

- **€$** raccolti nella run restano anche dopo la morte (solo per utenti registrati; calcolo finale lato server, vedi 4.6).
- **Ripperdoc**: negozio di potenziamenti permanenti. Ogni potenziamento ha più gradi e un costo crescente.

| ID | Statistica | Gradi | Effetto per grado |
|---|---|---|---|
| `max_hp` | PV max | 5 | +10% |
| `armor` | Armatura | 3 | +1 |
| `regen` | Rigenerazione | 5 | +0,1 PV/s |
| `might` | Potenza | 5 | +5% |
| `speed` | Velocità | 3 | +5% |
| `area` | Area | 3 | +5% |
| `cooldown` | Riduzione cooldown | 3 | +3% |
| `magnet` | Magnete | 3 | +15% |
| `luck` | Fortuna | 3 | +10% |
| `growth` | Crescita XP | 5 | +3% |
| `revival` | Rianimazione | 1 | +1 |
| `greed` | Bonus €$ | 5 | +10% |

- **Codex**: elenco di nemici e armi incontrati, con statistiche.
- **Sblocchi personaggi**: requisiti nella tabella 2.2, valutati dal server a fine run.

### 2.11 Ospite e utente registrato

- Ospite: gioca subito con i 3 personaggi iniziali e senza Ripperdoc. Nessuna chiamata API. Lo stato vive solo in memoria e si perde chiudendo la pagina. Gli sblocchi e il negozio sono visibili ma disabilitati, con invito a registrarsi.
- Registrato: salvataggio sul server.
- Nessun import dello stato ospite alla registrazione (eviterebbe la manipolazione via devtools).

### 2.12 Fuori dall'MVP

Multiplayer, classifica globale, mappe multiple, modalità sfida, audio personalizzabile oltre a volume musica/effetti, traduzioni (l'MVP è in italiano, con i testi centralizzati per una futura traduzione).

## 3. Frontend

### 3.1 Stack

React 19, TypeScript, Vite, Phaser 3, zustand, react-router, Vitest, Playwright, ESLint.

### 3.2 Struttura e proprietà

```
FE/
├── game-dev.html                ← coordinatore: harness del gioco senza UI
├── public/assets/
│   ├── sprites/                 ← sorgenti utente (non usati a runtime)
│   └── atlas/                   ← coordinatore: atlas generati
└── src/
    ├── main.tsx, App.tsx, index.css   ← agente UI
    ├── shared/                  ← coordinatore (sola lettura per gli agenti)
    │   ├── types.ts
    │   ├── events.ts
    │   └── api-contract.ts
    ├── data/                    ← coordinatore
    │   ├── characters.json, weapons.json, cyberware.json
    │   ├── enemies.json, waves.json, balance.json
    │   └── unlocks.json, ripperdoc.json
    ├── game/                    ← agente Engine
    │   ├── GameCanvas.tsx       (unico export verso React)
    │   ├── dev/harness.tsx      (montato da game-dev.html)
    │   ├── scenes/              (Boot, Preload, Run)
    │   ├── systems/             (logica pura, senza Phaser)
    │   ├── entities/            (Player, Enemy, Projectile, Pickup, Chest, pool)
    │   └── input/               (tastiera+mouse, touch, gamepad → InputState)
    ├── ui/                      ← agente UI
    │   ├── screens/             (Title, Login, Register, VerifyEmail, ForgotPassword, ResetPassword,
    │   │                         CharacterSelect, Ripperdoc, Codex, Options, GameOver, Privacy)
    │   ├── hud/                 (barre PV/XP/Psicosi, timer, uccisioni, €$, modale level-up, pausa, baule)
    │   └── store/               (zustand: sessione, meta, opzioni, run corrente)
    └── api/                     ← agente UI (client HTTP, refresh token, mock per sviluppo)
```

### 3.3 Comunicazione React ↔ Phaser

- Solo tramite l'EventBus tipizzato di `shared/events.ts`. L'unico import tra `ui/` e `game/` è `GameCanvas`.
- `GameCanvas` riceve `RunConfig` (personaggio, statistiche Ripperdoc, seed, opzioni) e la callback `onEnd(RunResult)`.
- Eventi Phaser → React: `hud:update` (max 10 Hz), `levelup:offer`, `chest:open`, `run:checkpoint` (ogni 60 s), `run:end`.
- Eventi React → Phaser: `levelup:choose`, `chest:close`, `pause`, `resume`, `options:changed`.
- HUD, modali e menu sono React sovrapposti al canvas; il canvas disegna solo il mondo.

### 3.4 Input

Il modulo `game/input/` produce ogni frame un `InputState { moveX, moveY, aimX, aimY, aimActive, skill, pause }` normalizzato. Il resto del gioco legge solo `InputState`.

- **Tastiera + mouse**: WASD/frecce per muoversi; il cursore definisce la mira dal personaggio; fuoco automatico; Spazio o click destro = abilità; Esc = pausa; cursore a mirino.
- **Touch**: attivato al primo evento touch. Joystick dinamico di movimento nella metà sinistra, joystick dinamico di mira nella metà destra (tenendolo premuto si mira), pulsanti abilità e pausa in alto a destra.
- **Gamepad**: stick sinistro movimento, stick destro mira (deadzone 0,25), A o RB abilità, Start pausa.
- **Mira non attiva** (`aimActive = false`, ad esempio stick destro rilasciato o mouse fuori dal canvas): le armi `aim` mirano al nemico più vicino. Opzione "Mira automatica" per forzare sempre questo comportamento.
- I menu React sono navigabili con il gamepad: stick/D-pad sposta il focus, A conferma, B indietro.

### 3.5 Rendering e prestazioni

- Phaser WebGL, `Scale.RESIZE`, zoom calcolato per mostrare un'area di gioco costante su ogni schermo.
- Pool di oggetti per nemici, proiettili e pickup; nessuna allocazione nel loop di gioco.
- Collisioni con griglia spaziale; nemici fuori schermo aggiornati a frequenza ridotta.
- Su smartphone in verticale: invito a ruotare. Pulsante fullscreen.

### 3.6 Pipeline sprite

- Sorgenti in `FE/public/assets/sprites/`:
  - `edgerunners.png` (1448×1086, RGBA con alpha sporca): David, Lucy, Rebecca (3 direzioni ciascuno), Maine (2 direzioni).
  - `edgerunners_enemies.png` (1448×1086, RGB, sfondo nero): Maelstrom, Arasaka, MaxTac, Cyberpsicopatico.
  - `Scheda Pixel Art Cyberpunk Edgerunners geschniegelt.png`: solo riferimento di design, non usato nel gioco.
- Script `tools/sprites/` (Node + sharp): pulizia alpha, chroma-key del nero, rilevamento dei frame per bounding box, file di correzione manuale dei rettangoli, output atlas Phaser in `FE/public/assets/atlas/heroes.{png,json}` e `enemies.{png,json}`.
- Nomi animazione: `<id>_<down|side|up>_<idle|walk|shoot|skill|hurt|death>`; la direzione sinistra è la destra specchiata. Dove manca una direzione (Maine), si usa la più vicina.
- Personaggi o nemici senza sprite: placeholder neon generato a runtime (forma + colore + glow), sostituibile senza modifiche alla logica tramite la chiave sprite nel file dati.
- I file sorgente utente non sono serviti in produzione.

## 4. Backend

### 4.1 Stack

Spring Boot 4.1.1, Java 25, Spring Web MVC, Spring Data JPA, Spring Security, OAuth2 Resource Server (JWT HS256 con Nimbus), Bean Validation, Flyway, PostgreSQL 17, Bucket4j, Spring Mail, Lombok, BouncyCastle (Argon2). Rimossa la dipendenza WebSocket. Package base `com.nightcrawlers`.

### 4.2 Struttura

```
com.nightcrawlers/
├── auth/       (controller, service, JwtService, RefreshTokenService, SecurityConfig, rate limit)
├── user/       (User, repository, MeController: profilo, export, cancellazione)
├── mail/       (MailService, template verifica e reset)
├── save/       (SaveController, SaveService, entità di progresso)
├── run/        (RunController, RunService, AntiCheatService, RunRecord)
├── ripperdoc/  (RipperdocController, RipperdocService)
├── gamedata/   (caricamento unlocks.json, ripperdoc.json, balance.json da resources)
└── common/     (GlobalExceptionHandler → ProblemDetail, audit log, config)
```

### 4.3 Modello dati (tabelle Flyway)

- `users`: id UUID, username (univoco, 3–20 caratteri `[a-zA-Z0-9_]`), email (univoca, minuscolo), password_hash, email_verified, created_at, failed_logins, locked_until.
- `refresh_tokens`: id, user_id, family_id, token_hash, expires_at, used_at, revoked_at, created_at, user_agent.
- `email_tokens`: id, user_id, purpose (`VERIFY`/`RESET`), token_hash, expires_at, used_at.
- `player_saves`: user_id (PK), eurodollars, total_eurodollars_earned, total_kills, best_time_sec.
- `unlocked_characters`: user_id, character_id, unlocked_at. I 3 iniziali sono inseriti alla registrazione.
- `ripperdoc_upgrades`: user_id, upgrade_id, rank.
- `enemy_kill_stats`: user_id, enemy_id, count.
- `character_stats`: user_id, character_id, best_time_sec, runs.
- `codex_entries`: user_id, entry_type (`ENEMY`/`WEAPON`), entry_id, discovered_at.
- `runs`: id UUID, user_id, character_id, seed, started_at, ended_at, last_checkpoint_at, duration_sec, kills, level, eurodollars_awarded, status (`ACTIVE`/`ENDED`/`FLAGGED`/`ABANDONED`).
- `run_checkpoints`: run_id, at, elapsed_sec, kills, level, eurodollars.
- `audit_log`: id, user_id, event, ip_hash, created_at.

### 4.4 API (prefisso `/api`)

Contratto completo in `docs/api/openapi.yaml` (fonte di verità condivisa tra FE e BE).

| Metodo | Path | Auth | Scopo |
|---|---|---|---|
| POST | `/auth/register` | no | crea utente, invia email di verifica |
| POST | `/auth/verify-email` | no | conferma email con token |
| POST | `/auth/resend-verification` | Bearer | reinvia l'email di verifica |
| POST | `/auth/login` | no | access token + cookie refresh |
| POST | `/auth/refresh` | cookie + CSRF | ruota il refresh, nuovo access token |
| POST | `/auth/logout` | cookie + CSRF | revoca la sessione corrente |
| POST | `/auth/logout-all` | Bearer | revoca tutte le sessioni |
| POST | `/auth/forgot-password` | no | invia link di reset (risposta sempre identica) |
| POST | `/auth/reset-password` | no | nuova password con token; revoca tutte le sessioni |
| GET | `/me` | Bearer | profilo |
| GET | `/me/export` | Bearer | esportazione dati JSON (GDPR) |
| DELETE | `/me` | Bearer + password | cancellazione account e dati |
| GET | `/save` | Bearer | €$, sblocchi, Ripperdoc, statistiche, Codex |
| POST | `/runs/start` | Bearer | `{characterId}` → `{runId, seed, startedAt}` |
| POST | `/runs/{id}/checkpoint` | Bearer | progresso intermedio |
| POST | `/runs/{id}/end` | Bearer | `RunResult` → `{eurodollarsAwarded, newUnlocks, save}` |
| GET | `/runs/best` | Bearer | migliori 10 run personali |
| POST | `/ripperdoc/{upgradeId}/buy` | Bearer | acquisto grado, ritorna il save |

Un utente con email non verificata può fare login e giocare, ma `/runs/start` e `/ripperdoc/{upgradeId}/buy` rispondono 403: le sue run non vengono salvate finché non verifica l'email. La UI mostra un banner con il pulsante "Reinvia email di verifica" (`POST /auth/resend-verification`, Bearer, soggetto a rate limit).

### 4.5 Sicurezza

- Password: Argon2id; lunghezza 12–128; rifiuto delle 10.000 password più comuni.
- Access token JWT, durata 15 minuti, tenuto solo in memoria nel FE.
- Refresh token opaco (256 bit casuali) in cookie `HttpOnly; Secure; SameSite=Strict; Path=/api/auth`, durata 30 giorni, salvato come hash SHA-256, ruotato a ogni uso. Riuso di un token già usato = revoca dell'intera famiglia e audit log.
- CSRF: double-submit con header `X-CSRF-Token` sui soli endpoint che usano il cookie (`/auth/refresh`, `/auth/logout`). Gli altri usano Bearer e non sono esposti a CSRF.
- Nessuna enumerazione degli utenti: messaggi generici su login e forgot-password. La registrazione con email già usata risponde come una registrazione riuscita e invia all'indirizzo esistente un'email informativa.
- Token email: monouso, hash in DB, scadenza 30 minuti.
- Rate limit (Bucket4j) per IP e per account su register, login, refresh, forgot-password, reset-password. Dopo 5 login falliti, blocco progressivo dell'account (1, 5, 15 minuti).
- Header: CSP stretta (`default-src 'self'`, nessuno script inline), HSTS, `X-Content-Type-Options: nosniff`, `frame-ancestors 'none'`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` minima. Impostati da Caddy per il FE e da Spring per l'API.
- CORS solo verso origini in whitelist (`ALLOWED_ORIGINS`).
- Bean Validation su ogni DTO; errori come `ProblemDetail` senza stack trace.
- Audit log per registrazione, login, logout, reset, cancellazione, acquisti, run segnalate; IP salvato come hash con salt.
- Actuator: solo `health`, non esposto pubblicamente oltre il reverse proxy.
- Segreti (DB, JWT, SMTP) solo da variabili d'ambiente o `application-local.properties` ignorato da git.
- Utente DB applicativo con i soli privilegi DML; le migrazioni girano con un utente separato.

### 4.6 Integrità delle partite

Il gioco gira nel client, quindi il server non può verificare ogni azione. Mitigazioni:

- `/runs/start` genera `seed` e `startedAt` lato server. Al massimo una run `ACTIVE` per utente; avviarne un'altra chiude la precedente come `ABANDONED`.
- Checkpoint ogni 60 s: il server rifiuta checkpoint con tempo trascorso superiore al tempo reale + 5 s o con crescita di uccisioni, livello e €$ oltre i limiti per fase definiti in `balance.json`.
- `/runs/{id}/end`: run `ACTIVE`, durata coerente con il tempo reale e con l'ultimo checkpoint, personaggio sbloccato.
- €$ assegnati **calcolati dal server** con una formula limitata su durata e uccisioni, moltiplicata per il bonus `greed`; il valore inviato dal client serve solo come controllo.
- Run non plausibili: stato `FLAGGED`, nessuna ricompensa, audit log.
- Senza classifica globale, un cheater altera solo il proprio salvataggio.

### 4.7 Dati di gioco condivisi

`unlocks.json`, `ripperdoc.json` e `balance.json` hanno come fonte `FE/src/data/`. Lo script `tools/sync-gamedata` li copia in `BE/src/main/resources/gamedata/`; la CI fallisce se le copie divergono.

## 5. Qualità

- TDD per `FE/src/game/systems/` e per i service backend.
- FE: Vitest per systems, store e client API; Playwright e2e per registrazione → login → run → fine run → salvataggio → Ripperdoc, e per la partita ospite.
- BE: unit test dei service con Mockito; test di integrazione con Testcontainers (PostgreSQL reale); test di sicurezza Spring (401/403, rotazione refresh, riuso token, rate limit). Copertura minima 80% sui service.
- Lint e type-check senza errori; build FE e BE nella CI.
- CI GitHub Actions: lint, test, build, `npm audit --audit-level=high`, OWASP dependency-check, gitleaks, verifica sync dei dati di gioco.
- Code review del diff di ogni agente prima del merge; security review su auth e integrità delle run.

## 6. Deploy

- **Oracle Cloud Always Free**, VM ARM Ampere A1. Tutte le immagini `arm64`.
- **Docker Compose** con servizi:
  - `caddy`: HTTPS automatico Let's Encrypt, serve il build FE, reverse proxy `/api` verso `backend`, header di sicurezza.
  - `backend`: immagine Spring Boot su `eclipse-temurin:25-jre`, utente non root.
  - `db`: `postgres:17`, volume persistente, nessuna porta esposta.
  - `duckdns`: aggiornamento dell'IP del dominio DuckDNS.
- **Brevo SMTP** per le email transazionali.
- Firewall: Security List Oracle e firewall della VM con solo 80, 443 e 22 aperte; SSH solo con chiave; fail2ban.
- Backup: `pg_dump` giornaliero via cron, rotazione 7 giorni, copia su Oracle Object Storage.
- CD: GitHub Actions costruisce le immagini `arm64`, le pubblica su GHCR e via SSH esegue `docker compose pull && docker compose up -d`. Segreti nei GitHub Secrets e in `.env` sul server.
- Rischio: Oracle può recuperare istanze Always Free inattive su account free tier. Mitigazione consigliata: upgrade dell'account a Pay-As-You-Go usando solo risorse Always Free.
- Sviluppo locale: Vite con `--host` e proxy `/api` verso `localhost:8080` (test da telefono sulla stessa rete con `http://<IP-PC>:5173`); PostgreSQL locale da pgAdmin, database `nightcrawlers`.

## 7. Organizzazione del lavoro

### 7.1 Proprietà dei file

| Proprietario | File |
|---|---|
| Coordinatore | `FE/src/shared/**`, `FE/src/data/**`, `FE/package.json`, `FE/package-lock.json`, `FE/vite.config.ts`, `FE/tsconfig*.json`, `FE/eslint.config.js`, `FE/game-dev.html`, `FE/public/assets/**`, `tools/**`, `e2e/**`, `docs/**`, `docker-compose*.yml`, `Caddyfile`, `BE/Dockerfile`, `.github/**`, file nella root |
| Agente Engine | `FE/src/game/**` |
| Agente UI/Meta | `FE/src/ui/**`, `FE/src/api/**`, `FE/src/App.tsx`, `FE/src/main.tsx`, `FE/src/index.css` |
| Agente Backend | `BE/**` tranne `BE/Dockerfile` e `BE/src/main/resources/gamedata/**` (generati dallo script di sync) |

- Ogni agente lavora in un git worktree separato su un proprio branch (`feat/engine`, `feat/ui`, `feat/backend`).
- Un agente non modifica file fuori dalla propria area. Richieste di dipendenze o modifiche ai contratti passano dal coordinatore, che aggiorna i file condivisi e avvisa gli altri agenti.
- Nessun commit, PR o documento riporta strumenti AI come autori o co-autori.

### 7.2 Fasi

- **Fase 0 — fondamenta (coordinatore)**: spec e piano approvati; OpenAPI e contratti `shared/`; dati di gioco; pipeline sprite con verifica visiva dell'utente; dipendenze e config FE; stub `GameCanvas`; harness `game-dev.html`; config BE di base (package, dipendenze, profili). Commit su `main`.
- **Fase 1 — M1 fetta giocabile (parallelo)**: Engine — David, Maelstrom, Pistola + Shotgun + Monowire, level-up, input completo, nell'harness. UI — schermate, HUD, modale level-up, partita ospite, API mock. Backend — auth completa, email, save, Flyway, test.
- **Fase 1 — M2 contenuto (parallelo)**: Engine — 4 eroi, 4 nemici, élite, boss, bauli, evoluzioni, Psicosi, scalata infinita, placeholder neon. UI — selezione personaggi con requisiti, Ripperdoc, Codex, opzioni, privacy, account. Backend — run, checkpoint, integrità, sblocchi, Ripperdoc, export e cancellazione account.
- **Fase 2 — M3 integrazione (coordinatore)**: merge, client API reale, e2e, test su telefono e controller; i bug tornano all'agente proprietario.
- **Fase 3 — M4 rilascio (coordinatore)**: Docker, Caddy, CI/CD, deploy Oracle, backup, disclaimer.

### 7.3 Interventi richiesti all'utente

- Verifica visiva degli atlas generati.
- Creazione del database `nightcrawlers` in pgAdmin e dei valori in `application-local.properties`.
- Test su smartphone e controller.
- Configurazione di credenziali Brevo, DuckDNS e Oracle sul server e nei GitHub Secrets.
- Generazione futura degli spritesheet di Kiwi, Pilar, Dorio e Falco nello stesso formato.

## 8. Rischi

| Rischio | Mitigazione |
|---|---|
| Frame AI irregolari o con aloni | rilevamento automatico + file di correzione manuale + verifica visiva |
| Prestazioni su smartphone con molti nemici | pool, griglia spaziale, tetto 400, glow limitato, test su dispositivo reale in M3 |
| Cheating lato client | checkpoint, ricompense calcolate dal server, nessuna classifica globale |
| Recupero istanza Oracle inattiva | account Pay-As-You-Go con sole risorse Always Free |
| Diritti IP Edgerunners | uso non commerciale, disclaimer, nessun logo ufficiale |
| Divergenza dati di gioco FE/BE | script di sync + controllo in CI |
