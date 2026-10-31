# Nightcrawlers — Piano 00: Fondamenta (coordinatore)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preparare contratti condivisi, dati di gioco, asset e configurazione FE su cui i tre agenti (Engine, UI, Backend) lavorano in parallelo senza toccare file comuni.

**Architecture:** Il coordinatore possiede `FE/src/shared/`, `FE/src/data/`, la config FE, gli asset e `tools/`. Questo piano produce i tipi TypeScript, l'EventBus, i DTO API, l'OpenAPI, i JSON di gioco validati, gli atlas sprite, lo stub `GameCanvas` e l'harness `game-dev.html`. Tutto finisce su `main` prima che gli agenti partano.

**Tech Stack:** React 19, TypeScript ~6.0, Vite 8, Phaser 4.2, zustand 5, react-router 7, Vitest, Playwright, Node 24 + sharp, Redocly CLI.

**Spec:** `docs/superpowers/specs/2026-10-31-nightcrawlers-design.md`

## Global Constraints

- Nessun commit, PR, commento o documento riporta strumenti AI come autori o co-autori. Niente trailer `Co-Authored-By`.
- Fan game non commerciale; nessun logo ufficiale Cyberpunk.
- Phaser `^4.2.1`; PostgreSQL 18; Java 25; Spring Boot 4.1.1.
- Testi UI in italiano.
- Gli ID di personaggi, armi, cyberware, nemici e potenziamenti Ripperdoc sono esattamente quelli delle tabelle 2.2–2.10 della spec.
- Gli agenti leggono `shared/` e `data/` ma non li modificano.

## Review Focus

1. JSON di gioco con riferimenti incrociati rotti (arma iniziale inesistente, cyberware di evoluzione inesistente, nemico non definito in un'ondata): il test `data.test.ts` deve fallire.
2. Listener dell'EventBus che lancia un'eccezione: gli altri listener devono comunque ricevere l'evento.
3. Frame sprite con aloni semi-trasparenti: dopo la pulizia nessun pixel con alpha tra 1 e 24 resta nell'atlas.
4. Divergenza tra copie FE e BE dei dati di gioco: `sync-gamedata --check` esce con codice 1.
5. Sprite assente per un personaggio (`spriteKey: null`): lo stub e il loader non devono lanciare errori.

---

### Task 1: Pulizia repository e configurazione FE

**Files:**
- Create: `.gitignore` (root)
- Create: `README.md` (root)
- Modify: `FE/package.json`, `FE/vite.config.ts`, `FE/tsconfig.app.json`, `FE/eslint.config.js`
- Create: `FE/vitest.config.ts`
- Delete: `FE/src/App.css`, `FE/src/assets/hero.png`, `FE/src/assets/react.svg`, `FE/src/assets/vite.svg`, `FE/public/icons.svg`, `FE/README.md`
- Modify: `FE/src/App.tsx` (placeholder minimo), `FE/src/index.css` (reset minimo)
- Test: `FE/src/shared/smoke.test.ts`

**Interfaces:**
- Produces: alias `@shared/*` → `FE/src/shared/*`, `@data/*` → `FE/src/data/*`, `@game/*` → `FE/src/game/*` (tsconfig `paths` + Vite `resolve.alias`). Script npm: `dev` (`vite --host`), `build`, `lint`, `test` (`vitest run`), `test:watch`, `typecheck` (`tsc -b`).

- [ ] **Step 1:** Root `.gitignore` con: `node_modules/`, `.env`, `.env.*` (eccetto `.env.example`), `BE/src/main/resources/application-local.properties`, `*.log`, `coverage/`, `playwright-report/`, `test-results/`.
- [ ] **Step 2:** Installare dipendenze in `FE/`: `npm i phaser@^4.2.1 zustand@^5 react-router@^7` e `npm i -D vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom @vitest/coverage-v8`.
- [ ] **Step 3:** `vite.config.ts`: `server.host: true`, `server.proxy['/api'] = { target: 'http://localhost:8080', changeOrigin: false }`, `build.rollupOptions.input = { main: 'index.html', gameDev: 'game-dev.html' }`, alias come sopra. In produzione `game-dev.html` viene escluso: input condizionale `mode !== 'production'`.
- [ ] **Step 4:** `vitest.config.ts`: `environment: 'jsdom'` di default, `environmentMatchGlobs: [['src/game/systems/**', 'node'], ['src/data/**', 'node']]`, `setupFiles: ['src/test-setup.ts']` (import `@testing-library/jest-dom/vitest`), coverage v8.
- [ ] **Step 5:** Sostituire `App.tsx` con un componente che renderizza `<main>Nightcrawlers</main>`; `index.css` con reset (`box-sizing`, `margin:0`, `background:#05010d`, `color:#e8e8f0`, font di sistema monospace). Eliminare i file demo.
- [ ] **Step 6:** Test smoke `expect(1 + 1).toBe(2)` in `src/shared/smoke.test.ts`. Run: `npm test` → PASS; `npm run lint` → 0 errori; `npm run build` → OK.
- [ ] **Step 7:** `README.md` root: descrizione, disclaimer fan game (testo della spec 1.1), prerequisiti (Node 24, Java 25, PostgreSQL 18, Docker Desktop), comandi dev FE e BE.
- [ ] **Step 8:** Commit `chore: set up FE tooling and remove Vite demo`.

### Task 2: Contratti condivisi — tipi di dominio

**Files:**
- Create: `FE/src/shared/types.ts`
- Test: `FE/src/shared/types.test.ts`

**Interfaces:**
- Produces (esportati esattamente così, usati da tutti i piani):

```ts
export type CharacterId = 'david' | 'lucy' | 'rebecca' | 'maine' | 'kiwi' | 'pilar' | 'dorio' | 'falco';
export type WeaponId = 'pistol' | 'shotgun' | 'minigun' | 'monowire' | 'smart_pistol'
  | 'grenade_launcher' | 'mantis_blades' | 'drone' | 'heavy_rifle';
export type CyberwareId = 'kerenzikov' | 'synthetic_muscle' | 'subdermal_armor' | 'neural_link'
  | 'kiroshi_optics' | 'blast_dampener' | 'biomonitor' | 'data_collector';
export type EnemyId = 'maelstrom' | 'arasaka' | 'maxtac' | 'cyberpsycho';
export type RipperdocUpgradeId = 'max_hp' | 'armor' | 'regen' | 'might' | 'speed' | 'area'
  | 'cooldown' | 'magnet' | 'luck' | 'growth' | 'revival' | 'greed';
export type SkillId = 'sandevistan' | 'quickhack' | 'explosive_barrage' | 'suppression'
  | 'snipe' | 'cluster_grenade' | 'heavy_burst' | 'support';
export type AimType = 'aim' | 'nearest' | 'area';
export type WeaponBehavior = 'projectile' | 'cone' | 'orbit' | 'lob' | 'melee_arc' | 'drone' | 'pierce_beam';
export type EnemyBehavior = 'chase' | 'kite' | 'charger' | 'boss';

export type StatKey = 'maxHp' | 'regen' | 'armor' | 'speed' | 'might' | 'area' | 'cooldown'
  | 'duration' | 'projectileSpeed' | 'magnet' | 'luck' | 'growth' | 'revival' | 'greed' | 'crit';
export type Stats = Record<StatKey, number>;
/** op 'add' somma value; op 'mul' somma value alla percentuale (0.10 = +10%). */
export interface StatModifier { stat: StatKey; op: 'add' | 'mul'; value: number }

export interface CharacterDef {
  id: CharacterId; name: string; starter: boolean;
  spriteKey: string | null; color: string;
  startingWeapon: WeaponId; skill: SkillId; passive: StatModifier[];
}
export interface SkillDef { id: SkillId; name: string; description: string; cooldownSec: number; durationSec: number; params: Record<string, number> }
export interface WeaponLevelStats { damage: number; cooldownSec: number; projectiles: number; area: number; speed: number; durationSec: number; pierce: number }
export interface WeaponDef {
  id: WeaponId; name: string; description: string; aim: AimType; behavior: WeaponBehavior;
  levels: WeaponLevelStats[]; // length 8, index 0 = livello 1
  evolution: { requires: CyberwareId; id: string; name: string; stats: WeaponLevelStats };
}
export interface CyberwareDef { id: CyberwareId; name: string; description: string; maxLevel: 5; perLevel: StatModifier[] }
export interface EnemyDef {
  id: EnemyId; name: string; spriteKey: string | null; color: string; behavior: EnemyBehavior;
  hp: number; speed: number; damage: number; xp: number; eurodollarChance: number;
  ranged?: { range: number; cooldownSec: number; projectileSpeed: number; damage: number };
}
export interface SpawnWeight { enemyId: EnemyId; weight: number }
export interface SpecialHorde { atSec: number; type: 'ring' | 'wall' | 'swarm'; enemyId: EnemyId; count: number }
export interface PhaseDef { fromSec: number; toSec: number; spawnPerSec: number; mix: SpawnWeight[]; specials: SpecialHorde[] }
export interface WavesDef { phases: PhaseDef[]; eliteEverySec: number; bossEverySec: number; maxtacAlertAtSec: number; enemyCap: number }

export type UnlockRule =
  | { type: 'survive'; seconds: number }
  | { type: 'kills'; enemyId: EnemyId; count: number }
  | { type: 'eurodollars_total'; amount: number }
  | { type: 'survive_with'; characterId: CharacterId; seconds: number }
  | { type: 'distinct_characters'; count: number; seconds: number };
export interface UnlockDef { characterId: CharacterId; rule: UnlockRule; description: string }
export interface RipperdocDef { id: RipperdocUpgradeId; name: string; maxRank: number; perRank: StatModifier; baseCost: number; costGrowth: number }

export interface GameOptions { autoAim: boolean; musicVolume: number; sfxVolume: number; showFps: boolean; screenShake: boolean }
export interface RunConfig {
  mode: 'guest' | 'online'; runId: string | null; seed: number;
  characterId: CharacterId; ripperdoc: Partial<Record<RipperdocUpgradeId, number>>; options: GameOptions;
}
export interface OwnedWeapon { id: WeaponId; level: number; evolved: boolean }
export interface OwnedCyberware { id: CyberwareId; level: number }
export interface HudState {
  timeSec: number; hp: number; maxHp: number; level: number; xp: number; xpToNext: number;
  kills: number; eurodollars: number; psychosis: number; psychosisActive: boolean;
  skillCooldown01: number; weapons: OwnedWeapon[]; cyberware: OwnedCyberware[];
  bossHp01: number | null; maxtacAlert: boolean; fps: number | null;
}
export type LevelUpCard =
  | { kind: 'weapon_new'; id: WeaponId }
  | { kind: 'weapon_up'; id: WeaponId; level: number }
  | { kind: 'cyber_new'; id: CyberwareId }
  | { kind: 'cyber_up'; id: CyberwareId; level: number }
  | { kind: 'heal'; amount: number }
  | { kind: 'eurodollars'; amount: number };
export interface ChestReward { cards: LevelUpCard[]; evolution: { weapon: WeaponId; into: string } | null }
export interface RunCheckpoint { elapsedSec: number; kills: number; level: number; eurodollars: number }
export interface RunResult {
  runId: string | null; characterId: CharacterId; durationSec: number; kills: number;
  killsByEnemy: Partial<Record<EnemyId, number>>; level: number; eurodollarsCollected: number;
  weaponsSeen: WeaponId[]; enemiesSeen: EnemyId[];
}
export interface GameCanvasProps { config: RunConfig; onEnd: (result: RunResult) => void }

export const STARTER_CHARACTERS: readonly CharacterId[] = ['david', 'lucy', 'rebecca'];
export const MAX_WEAPONS = 6;
export const MAX_CYBERWARE = 6;
export const MAX_WEAPON_LEVEL = 8;
export const DEFAULT_OPTIONS: GameOptions = { autoAim: false, musicVolume: 0.7, sfxVolume: 0.8, showFps: false, screenShake: true };
```

- [ ] **Step 1:** Test `types.test.ts`: `expect(STARTER_CHARACTERS).toEqual(['david','lucy','rebecca'])`, `expect(MAX_WEAPONS).toBe(6)`, `expect(DEFAULT_OPTIONS.autoAim).toBe(false)`. Run → FAIL (modulo mancante).
- [ ] **Step 2:** Creare `types.ts` con il contenuto sopra. Run → PASS. `npm run typecheck` → OK.
- [ ] **Step 3:** Commit `feat(shared): add domain types`.

### Task 3: Contratti condivisi — EventBus

**Files:**
- Create: `FE/src/shared/events.ts`
- Test: `FE/src/shared/events.test.ts`

**Interfaces:**
- Consumes: tipi del Task 2.
- Produces:

```ts
export interface GameEvents {
  'hud:update': HudState;
  'levelup:offer': { cards: LevelUpCard[] };
  'levelup:choose': { index: number };
  'chest:open': ChestReward;
  'chest:close': undefined;
  'run:checkpoint': RunCheckpoint;
  'run:end': RunResult;
  // comandi UI → gioco
  'pause': undefined;        // apri il menu di pausa
  'resume': undefined;       // chiudi il menu di pausa
  'run:quit': undefined;     // abbandona: il gioco termina subito ed emette 'run:end'
  'options:changed': GameOptions;
  // notifiche gioco → UI (anche quando la pausa nasce da Esc/Start nel gioco)
  'game:paused': { reason: 'menu' | 'levelup' | 'chest' };
  'game:resumed': undefined;
}
export class EventBus<E> {
  on<K extends keyof E>(event: K, fn: (payload: E[K]) => void): () => void; // ritorna unsubscribe
  emit<K extends keyof E>(event: K, payload: E[K]): void;
  clear(): void;
}
export const gameBus: EventBus<GameEvents>;
```

- [ ] **Step 1:** Test: (a) `on` + `emit` consegna il payload; (b) la funzione ritornata da `on` rimuove il listener; (c) un listener che lancia non impedisce la consegna al successivo e l'errore finisce in `console.error` (spy); (d) `clear()` rimuove tutti i listener; (e) un listener che si disiscrive durante `emit` non altera la consegna agli altri. Run → FAIL.
- [ ] **Step 2:** Implementare con `Map<keyof E, Set<fn>>`; `emit` itera su una copia dell'insieme. Run → PASS.
- [ ] **Step 3:** Commit `feat(shared): add typed event bus`.

### Task 4: Contratti condivisi — API e OpenAPI

**Files:**
- Create: `FE/src/shared/api-contract.ts`
- Create: `docs/api/openapi.yaml`
- Test: `FE/src/shared/api-contract.test.ts`

**Interfaces:**
- Produces:

```ts
export interface UserDto { id: string; username: string; email: string; emailVerified: boolean; createdAt: string }
export interface AuthResponse { accessToken: string; expiresInSec: number; user: UserDto }
export interface RegisterRequest { username: string; email: string; password: string }
export interface LoginRequest { login: string; password: string } // username o email
export interface VerifyEmailRequest { token: string }
export interface ForgotPasswordRequest { email: string }
export interface ResetPasswordRequest { token: string; newPassword: string }
export interface DeleteAccountRequest { password: string }
export interface CharacterStatDto { bestTimeSec: number; runs: number }
export interface SaveDto {
  eurodollars: number; totalEurodollarsEarned: number; totalKills: number; bestTimeSec: number;
  unlockedCharacters: CharacterId[]; ripperdoc: Partial<Record<RipperdocUpgradeId, number>>;
  killStats: Partial<Record<EnemyId, number>>; characterStats: Partial<Record<CharacterId, CharacterStatDto>>;
  codex: { enemies: EnemyId[]; weapons: WeaponId[] };
}
export interface StartRunRequest { characterId: CharacterId }
export interface StartRunResponse { runId: string; seed: number; startedAt: string }
export type CheckpointRequest = RunCheckpoint;
export type EndRunRequest = Omit<RunResult, 'runId'>;
export interface EndRunResponse { eurodollarsAwarded: number; newUnlocks: CharacterId[]; flagged: boolean; save: SaveDto }
export interface BestRunDto { id: string; characterId: CharacterId; durationSec: number; kills: number; level: number; endedAt: string }
export interface ProblemDetail { type: string; title: string; status: number; detail?: string; errors?: Record<string, string> }
export interface MessageResponse { message: string }

export const CSRF_COOKIE = 'XSRF-TOKEN';
export const CSRF_HEADER = 'X-CSRF-Token';
export const API = {
  register: '/api/auth/register', verifyEmail: '/api/auth/verify-email', resendVerification: '/api/auth/resend-verification',
  login: '/api/auth/login', refresh: '/api/auth/refresh', logout: '/api/auth/logout', logoutAll: '/api/auth/logout-all',
  forgotPassword: '/api/auth/forgot-password', resetPassword: '/api/auth/reset-password',
  me: '/api/me', meExport: '/api/me/export', save: '/api/save',
  runStart: '/api/runs/start', runCheckpoint: (id: string) => `/api/runs/${id}/checkpoint`,
  runEnd: (id: string) => `/api/runs/${id}/end`, runsBest: '/api/runs/best',
  ripperdocBuy: (id: RipperdocUpgradeId) => `/api/ripperdoc/${id}/buy`,
} as const;
```

- Codici di risposta (fissati qui, implementati dal Backend, gestiti dalla UI):
  - `register` 202 `MessageResponse` (sempre, anche con email esistente); 400; 409 solo per username esistente; 429.
  - `verify-email` 204; 400 token non valido o scaduto.
  - `resend-verification` 202; 429.
  - `login` 200 `AuthResponse` + cookie `refresh_token` (HttpOnly, Secure, SameSite=Strict, Path=/api/auth, 30 giorni) + cookie `XSRF-TOKEN` (non HttpOnly, Secure, SameSite=Strict, Path=/); 401 generico; 423 account bloccato temporaneamente (header `Retry-After`); 429.
  - `refresh` 200 `AuthResponse` con nuovi cookie; 401; 403 CSRF mancante o errato.
  - `logout` 204; `logout-all` 204.
  - `forgot-password` 202 sempre; `reset-password` 204; 400.
  - `GET /me` 200 `UserDto`; `GET /me/export` 200 JSON (`Content-Disposition: attachment`); `DELETE /me` 204; 401 password errata.
  - `GET /save` 200 `SaveDto`.
  - `runs/start` 201 `StartRunResponse`; 403 email non verificata o personaggio bloccato.
  - `runs/{id}/checkpoint` 204; 404; 409 run non `ACTIVE`; 422 checkpoint non plausibile (la run diventa `FLAGGED`).
  - `runs/{id}/end` 200 `EndRunResponse` (anche se `flagged: true`); 404; 409.
  - `runs/best` 200 `BestRunDto[]` (max 10, ordinati per `durationSec` decrescente).
  - `ripperdoc/{id}/buy` 200 `SaveDto`; 403 email non verificata; 404 id sconosciuto; 409 €$ insufficienti o grado massimo.
  - Tutti gli errori: `application/problem+json` conforme a `ProblemDetail`.

- [ ] **Step 1:** Test: `API.runEnd('abc')` → `'/api/runs/abc/end'`; `API.ripperdocBuy('greed')` → `'/api/ripperdoc/greed/buy'`; `CSRF_HEADER === 'X-CSRF-Token'`. Run → FAIL.
- [ ] **Step 2:** Creare `api-contract.ts`. Run → PASS.
- [ ] **Step 3:** Scrivere `docs/api/openapi.yaml` (OpenAPI 3.1) con tutti i path, schemi identici ai DTO sopra, codici di risposta elencati, security scheme `bearerAuth` e `refreshCookie`.
- [ ] **Step 4:** Run: `npx @redocly/cli lint docs/api/openapi.yaml` → nessun errore.
- [ ] **Step 5:** Commit `feat(shared): add API contract and OpenAPI spec`.

### Task 5: Dati di gioco

**Files:**
- Create: `FE/src/data/characters.json`, `skills.json`, `weapons.json`, `cyberware.json`, `enemies.json`, `waves.json`, `balance.json`, `unlocks.json`, `ripperdoc.json`
- Create: `FE/src/data/index.ts`
- Test: `FE/src/data/data.test.ts`

**Interfaces:**
- Consumes: tipi del Task 2.
- Produces (`index.ts`): `characters: CharacterDef[]`, `skills: SkillDef[]`, `weapons: WeaponDef[]`, `cyberware: CyberwareDef[]`, `enemies: EnemyDef[]`, `waves: WavesDef`, `balance: Balance`, `unlocks: UnlockDef[]`, `ripperdoc: RipperdocDef[]`; helper `getCharacter(id)`, `getWeapon(id)`, `getCyberware(id)`, `getEnemy(id)`, `getSkill(id)`, `getRipperdoc(id)` che lanciano `Error('Unknown <tipo>: <id>')` se l'id non esiste; `ripperdocCost(def: RipperdocDef, currentRank: number): number` = `Math.round(def.baseCost * def.costGrowth ** currentRank)`.
- `Balance` (tipo esportato da `index.ts`, valori in `balance.json`):

```ts
export interface Balance {
  baseStats: Stats; // maxHp 100, regen 0, armor 0, speed 120 (px/s), might 1, area 1, cooldown 1, duration 1,
                    // projectileSpeed 1, magnet 48 (px), luck 1, growth 1, revival 0, greed 1, crit 0.05
  xp: { firstLevel: 5; growth: 1.15; flatPerLevel: 3 };          // xpToNext(l) = round(firstLevel*growth^(l-1) + flatPerLevel*(l-1))
  psychosis: { perKillPerCyberLevel: 0.05; damagePer10: 0.01; healPenaltyPer10: 0.01; frenzyDurationSec: 10; frenzyDamageMult: 2 };
  difficulty: { alertHpPerMin: 0.03; alertDamagePerMin: 0.03; alertSpawnPerMin: 0.02 };
  elite: { scale: 1.3; hpMult: 8 };
  boss: { hpGrowth: 1.5; maxPatterns: 4 };
  drops: { medkitChance: 0.01; medkitHeal: 30; magnetChance: 0.003; empChance: 0.002; eurodollarBag: [10, 50]; chestCards: [1, 3] };
  reward: { perSecond: 0.5; perKill: 0.1; maxPerMinute: 200 };
  antiCheat: { clockSkewSec: 5; maxKillsPerSec: 40; maxLevelPerMinute: 10; maxEurodollarsPerMinute: 300; checkpointEverySec: 60 };
  player: { invulnerabilitySec: 0.5; pickupRadius: 16 };
}
```

- Valori di contenuto da rispettare (tutto il resto è bilanciamento libero del coordinatore, coerente con questi ordini di grandezza):
  - Personaggi, abilità, bonus passivi, requisiti: tabelle 2.2 della spec. `spriteKey`: `david`, `lucy`, `rebecca`, `maine`; gli altri `null`. Colori: david `#f5e663`, lucy `#c9a7ff`, rebecca `#52e0c4`, maine `#d9822b`, kiwi `#ffd447`, pilar `#ff9f43`, dorio `#9c6b4a`, falco `#6fd3ff`.
  - Abilità: `sandevistan` cooldown 20 s, durata 3, `slowFactor 0.3`, `dashDistance 160`; `quickhack` 18 s, `radius 180`, `stunSec 2`, `damage 40`; `explosive_barrage` 16 s, `grenades 6`, `damage 60`, `radius 70`; `suppression` 22 s, durata 4, `coneDeg 50`, `dps 120`, `knockback 200`; `snipe` 12 s, `damage 300`, `pierce 99`; `cluster_grenade` 16 s, `bomblets 8`, `damage 40`; `heavy_burst` 14 s, durata 2, `dps 160`, `pierce 5`; `support` 30 s, durata 10, `healPct 0.3`.
  - Armi: tabella 2.3 (id, mira, cyberware di evoluzione, nome evoluzione) con `behavior`: pistol `projectile`, shotgun `cone`, minigun `projectile`, monowire `orbit`, smart_pistol `projectile`, grenade_launcher `lob`, mantis_blades `melee_arc`, drone `drone`, heavy_rifle `pierce_beam`. Livello 1 pistola: damage 10, cooldown 0.6, projectiles 1, area 1, speed 400, duration 1.5, pierce 1.
  - Cyberware: tabella 2.4, `perLevel` coerente con gli effetti (es. `kerenzikov` = `{stat:'cooldown', op:'mul', value:-0.08}`).
  - Nemici: maelstrom hp 12, speed 70, damage 8, xp 1, `chase`; arasaka hp 30, speed 55, damage 10, xp 3, `kite`, ranged range 220; maxtac hp 120, speed 40, damage 20, xp 8, `charger`; cyberpsycho hp 4000, speed 60, damage 35, xp 200, `boss`.
  - Ondate: fasi da 300 s con il mix della tabella 2.6 (maelstrom da 0, arasaka da 300, maxtac da 600); l'ultima fase ha `toSec: Infinity` serializzato come `-1` e interpretato come senza fine; `eliteEverySec 300`, `bossEverySec 600`, `maxtacAlertAtSec 1800`, `enemyCap 400`; almeno un'orda speciale per fase.
  - Sblocchi: maine `{survive, 600}`, kiwi `{kills, maxtac, 50}`, pilar `{eurodollars_total, 5000}`, dorio `{survive_with, maine, 1800}`, falco `{distinct_characters, 3, 900}`.
  - Ripperdoc: tabella 2.10 della spec; `baseCost` 100–500, `costGrowth` 1.5–2.0; `revival` costo fisso 5000.

- [ ] **Step 1:** Test `data.test.ts`: (a) esattamente 8 personaggi, 3 `starter: true` = `STARTER_CHARACTERS`; (b) ogni `startingWeapon` esiste in `weapons`; (c) ogni `skill` esiste in `skills`; (d) ogni arma ha 8 livelli con `cooldownSec > 0`; (e) ogni `evolution.requires` esiste in `cyberware`; (f) ogni `enemyId` di `waves` (mix e specials) esiste in `enemies`; (g) le fasi sono contigue (`toSec` di una = `fromSec` della successiva) e l'ultima ha `toSec === -1`; (h) ogni personaggio non starter ha esattamente un `UnlockDef`; (i) i 12 potenziamenti Ripperdoc esistono con `maxRank` della spec; (j) `getWeapon('nope' as WeaponId)` lancia `Unknown weapon: nope`; (k) `ripperdocCost` con baseCost 100, growth 1.5, rank 2 → 225. Run → FAIL.
- [ ] **Step 2:** Scrivere i JSON e `index.ts` (import JSON tipizzati con `as`/`satisfies`). Run → PASS.
- [ ] **Step 3:** Commit `feat(data): add game data and validators`.

### Task 6: Sync dati di gioco FE → BE

**Files:**
- Create: `tools/sync-gamedata.mjs`
- Create: `tools/package.json` (script `sync-gamedata`, `check-gamedata`, `sprites`)
- Test: `tools/sync-gamedata.test.mjs` (runner `node --test`)

**Interfaces:**
- Produces: `node tools/sync-gamedata.mjs` copia `characters.json`, `enemies.json`, `weapons.json`, `unlocks.json`, `ripperdoc.json`, `balance.json` da `FE/src/data/` a `BE/src/main/resources/gamedata/`. Con `--check` non scrive; esce con 1 e stampa i file divergenti se le copie differiscono byte per byte (dopo normalizzazione dei fine riga a LF).

- [ ] **Step 1:** Test su directory temporanee: copia crea i file; `--check` su copie identiche → exit 0; con un file modificato → exit 1 e nome del file nell'output; file mancante in destinazione → exit 1. Run `node --test tools/` → FAIL.
- [ ] **Step 2:** Implementare con percorsi sorgente e destinazione sovrascrivibili via env (`GAMEDATA_SRC`, `GAMEDATA_DST`) per i test. Run → PASS.
- [ ] **Step 3:** Eseguire la sync reale. Commit `feat(tools): add gamedata sync`.

### Task 7: Pipeline sprite

**Files:**
- Move: `FE/public/assets/sprites/*.png` → `assets-src/sprites/` (con `git mv` dopo il primo add)
- Create: `tools/sprites/clean.mjs`, `tools/sprites/detect.mjs`, `tools/sprites/pack.mjs`, `tools/sprites/build.mjs`, `tools/sprites/overrides/heroes.json`, `tools/sprites/overrides/enemies.json`, `tools/sprites/preview.html`
- Create (output): `FE/public/assets/atlas/heroes.png`, `heroes.json`, `enemies.png`, `enemies.json`
- Test: `tools/sprites/sprites.test.mjs`

**Interfaces:**
- Produces: atlas in formato Phaser JSON Hash. Frame nominati `<spriteKey>_<down|side|up>_<action>_<n>` con `action` ∈ `idle|walk|shoot|skill|hurt|death` e `n` da 0; frame VFX `<spriteKey>_fx_<n>`. Engine registra le animazioni raggruppando per prefisso `<spriteKey>_<dir>_<action>`.
- Funzioni:
  - `cleanAlpha(rgba: Buffer, w, h, { minAlpha: 25, minLuma: 18 }): Buffer`: alpha < 25 → 0; pixel con luminanza < 18 e alpha < 200 → 0 (rimuove gli aloni scuri).
  - `chromaBlack(rgb: Buffer, w, h, { threshold: 22, feather: 10 }): Buffer` (RGBA): luminanza ≤ threshold → alpha 0; tra threshold e threshold+feather → alpha lineare.
  - `detectFrames(rgba, w, h, { minArea: 200, mergeGap: 3 }): Rect[]`: componenti connesse sull'alpha > 0, unione dei box distanti ≤ mergeGap, ordinamento per riga (cluster per centro Y) e poi per X.
  - Gli override per foglio (`overrides/*.json`) assegnano a ogni riga `{ spriteKey, dir }` e a ogni intervallo di colonne `action`; possono sostituire o eliminare singoli rettangoli.

- [ ] **Step 1:** Test con immagini sintetiche generate in memoria: (a) `cleanAlpha` azzera alpha 10 e mantiene alpha 255; (b) `chromaBlack` rende trasparente `(5,5,5)` e opaco `(200,40,40)`; (c) `detectFrames` su due quadrati 20×20 separati da 30 px → 2 rettangoli ordinati per X; con gap 2 px → 1 rettangolo; (d) un blob di 5×5 px è scartato (minArea). Run `node --test tools/sprites/` → FAIL.
- [ ] **Step 2:** Implementare con `sharp` per I/O e algoritmi in JS puro. Run → PASS.
- [ ] **Step 3:** `build.mjs`: per ogni foglio pulizia, rilevamento, applicazione override, pack (shelf packing, padding 2 px, potenza di 2 non richiesta) e scrittura atlas. Stampare il conteggio frame per `spriteKey_dir_action`.
- [ ] **Step 4:** Compilare gli override osservando l'output di `detect` (righe: heroes 11 = david ×3, lucy ×3, rebecca ×3, maine ×2; enemies 12 = maelstrom ×3, arasaka ×3, maxtac ×3, cyberpsycho ×3; ultima colonna di ogni personaggio = `fx`).
- [ ] **Step 5:** `preview.html` mostra ogni animazione in loop a 8 fps su sfondo scuro e chiaro. Aprire con `npx vite tools/sprites` e chiedere all'utente la **verifica visiva**. Correggere gli override fino all'approvazione.
- [ ] **Step 6:** Aggiungere a `sprites.test.mjs` un test che apre gli atlas generati e verifica: nessun pixel con alpha 1–24; ogni `spriteKey` di `characters.json` e `enemies.json` diverso da `null` ha almeno `down_idle` e `side_walk`. Run `node --test tools/sprites/` → PASS. Commit `feat(assets): add sprite pipeline and atlases`.

### Task 8: Stub GameCanvas e harness

**Files:**
- Create: `FE/src/game/GameCanvas.tsx` (stub; dopo il commit passa all'agente Engine)
- Create: `FE/src/game/dev/harness.tsx` (stub; poi Engine)
- Create: `FE/game-dev.html`
- Test: `FE/src/game/GameCanvas.test.tsx`

**Interfaces:**
- Consumes: `GameCanvasProps`, `gameBus`.
- Produces: `export default function GameCanvas(props: GameCanvasProps): JSX.Element`. Lo stub renderizza `<div data-testid="game-canvas">` e un pulsante "Termina run (stub)" che chiama `props.onEnd` con un `RunResult` di esempio (`durationSec 0`, `kills 0`, `level 1`, personaggio della config).

- [ ] **Step 1:** Test RTL: lo stub renderizza `game-canvas`; click sul pulsante chiama `onEnd` con `characterId` uguale a `config.characterId`. Run → FAIL.
- [ ] **Step 2:** Implementare lo stub; `harness.tsx` monta `GameCanvas` con `RunConfig` guest (`seed` da query string `?seed=`, personaggio da `?c=`, default `david`). `game-dev.html` carica `/src/game/dev/harness.tsx`. Run → PASS. `npm run build` → OK.
- [ ] **Step 3:** Commit `feat(game): add GameCanvas stub and dev harness`.

### Task 9: Consegna agli agenti

**Files:**
- Modify: nessun file di prodotto. Aggiunge `BE/` così com'è al repository.

- [ ] **Step 1:** `git add BE` (senza `application-local.properties`); commit `chore(be): add Spring Boot skeleton`.
- [ ] **Step 2:** Verifica finale su `main`: `cd FE && npm test && npm run lint && npm run build`; `node --test tools/`; `node tools/sync-gamedata.mjs --check`. Tutto verde.
- [ ] **Step 3:** Creare i worktree: `git worktree add ../nc-engine -b feat/engine`, `../nc-ui -b feat/ui`, `../nc-backend -b feat/backend`.
- [ ] **Step 4:** Avviare i tre agenti con i piani 01, 02 e 03 (vedi sezione "Esecuzione" del piano 04).
