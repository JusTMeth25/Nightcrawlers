// The run: game clock, player, enemies, weapons, director and city. Pure rules live in systems/.
// Game time only advances while no pause reason is active (menu, level-up, chest).
import Phaser from 'phaser'
import { balance, getCharacter, getEnemy, getSkill, waves } from '@data/index'
import { gameBus } from '@shared/events'
import {
  DEFAULT_OPTIONS,
  type EnemyId,
  type GameOptions,
  type LevelUpCard,
  type OwnedWeapon,
  type RunConfig,
  type Stats,
  type WeaponId,
} from '@shared/types'
import { DEV_OPTIONS_KEY, RUN_CONFIG_KEY, type DevOptions } from '../config'
import { Chests } from '../entities/Chest'
import { formationPositions, scatterPoint, type Point } from '../entities/formations'
import { EnemyPool, type EnemyShot } from '../entities/EnemyPool'
import { Player } from '../entities/Player'
import {
  PICKUP_EMP,
  PICKUP_EURO,
  PICKUP_MAGNET,
  PICKUP_MEDKIT,
  PICKUP_XP,
  PickupPool,
  type PickupKind,
} from '../entities/PickupPool'
import { OWNER_ENEMY, ProjectilePool } from '../entities/ProjectilePool'
import { AudioSystem } from '../audio/AudioSystem'
import type { SfxId } from '../audio/sfxIds'
import { Grenades } from '../entities/Grenades'
import { DamageNumbers } from '../fx/DamageNumbers'
import { FrenzyOverlay } from '../fx/FrenzyOverlay'
import { FxPool } from '../fx/FxPool'
import { ScreenFx } from '../fx/ScreenFx'
import { InputManager } from '../input/InputManager'
import { emptyInput, type InputState } from '../input/InputState'
import { BossController } from '../enemies/BossController'
import { bossHp } from '../enemies/bossPatterns'
import { alertMultipliers, Director, type SpawnOrder } from '../systems/director'
import { bindSceneEnd } from '../run/lifecycle'
import { PauseState } from '../run/PauseState'
import { stepFrame, type FrameHost } from '../run/frame'
import { RunFlow } from '../run/RunFlow'
import { computeDamage, healAmount } from '../systems/combat'
import { createInventory, type Inventory } from '../systems/inventory'
import { createPsychosis, isFrenzy, onKill, tick as tickPsychosis, type PsychosisState } from '../systems/psychosis'
import { createRng, type Rng } from '../systems/rng'
import { SpatialGrid } from '../systems/spatialGrid'
import { collectModifiers, computeStats } from '../systems/stats'
import { addXp, xpToNext } from '../systems/xp'
import { implementedWeapons } from '../weapons/offerPool'
import { WeaponSystem } from '../weapons/WeaponSystem'
import { SkillSystem } from '../skills/SkillSystem'
import type { SkillHost } from '../skills/types'
import { aimDirection, type Vec } from '../weapons/targeting'
import { CityFloor } from '../world/CityFloor'
import { computeZoom, GRID_CELL, PLAYER_RADIUS } from '../world/view'
import { ANIMS_KEY } from './PreloadScene'
import { TOUCH_SCENE_KEY } from './TouchControlsScene'

export const RUN_SCENE_KEY = 'Run'
const VIEW_MARGIN = 96
const RELOCATE_EVERY_FRAMES = 30
const REVIVE_RADIUS = 220
const REVIVE_FORCE = 900
const PROJECTILE_CAP = 800
const ENEMY_SHOT_RADIUS = 4
const ENEMY_SHOT_COLOR = 0xff3355
const ENEMY_SHOT_LIFE_SEC = 3
const PICKUP_CAP = 600
const PICKUP_RADIUS = balance.player.pickupRadius + PLAYER_RADIUS
const AIM_NEAREST_RANGE = 420

const FALLBACK_RUN: RunConfig = {
  mode: 'guest',
  runId: null,
  seed: 1,
  characterId: 'david',
  ripperdoc: {},
  options: DEFAULT_OPTIONS,
}

export class RunScene extends Phaser.Scene implements SkillHost {
  run!: RunConfig
  dev: DevOptions = {}
  rng!: Rng
  /** game seconds, frozen while paused */
  clock = 0
  stats!: Stats
  inventory!: Inventory
  psychosis: PsychosisState = createPsychosis()
  director!: Director
  readonly grid = new SpatialGrid(GRID_CELL)
  player!: Player
  enemies!: EnemyPool
  projectiles!: ProjectilePool
  weapons!: WeaponSystem
  damageNumbers!: DamageNumbers
  readonly killsByEnemy: Partial<Record<EnemyId, number>> = {}
  readonly enemiesSeen = new Set<EnemyId>()
  readonly weaponsSeen = new Set<WeaponId>()
  pickups!: PickupPool
  chests!: Chests
  flow!: RunFlow
  controls!: InputManager
  kills = 0
  level = 1
  xp = 0
  eurodollars = 0
  pauseState!: PauseState
  screen!: ScreenFx
  frenzyOverlay!: FrenzyOverlay
  skills!: SkillSystem
  bosses!: BossController
  characterColor = 0xffffff
  vfx!: FxPool
  grenades!: Grenades
  audio: AudioSystem | null = null
  private offOptions: (() => void) | null = null
  protected frame = 0
  protected floor!: CityFloor
  protected readonly inView = new Phaser.Geom.Rectangle()
  protected readonly contacts: number[] = []
  private fps = 0
  private readonly scratch: Point = { x: 0, y: 0 }
  private input0: InputState = emptyInput()
  private readonly aimFrom: Vec = { x: 0, y: 0 }
  private readonly aimFace: Vec = { x: 1, y: 0 }
  private readonly aimNearest: Vec = { x: 0, y: 0 }

  constructor() {
    super(RUN_SCENE_KEY)
  }

  init(): void {
    this.run = (this.registry.get(RUN_CONFIG_KEY) as RunConfig | undefined) ?? FALLBACK_RUN
    this.dev = (this.registry.get(DEV_OPTIONS_KEY) as DevOptions | undefined) ?? {}
    this.clock = 0
    this.frame = 0
    this.kills = 0
    this.level = 1
    this.xp = 0
    this.eurodollars = 0
    for (const k of Object.keys(this.killsByEnemy) as EnemyId[]) delete this.killsByEnemy[k]
    this.enemiesSeen.clear()
    this.weaponsSeen.clear()
    this.psychosis = createPsychosis()
  }

  create(): void {
    const character = getCharacter(this.run.characterId)
    const available = (this.registry.get(ANIMS_KEY) as Set<string> | undefined) ?? new Set<string>()
    this.rng = createRng(this.run.seed)
    this.inventory = createInventory(character.startingWeapon)
    if (this.dev.weapons?.length) {
      // harness: chosen weapons at max level (6 slots)
      const evolved = this.dev.evolved === true
      this.inventory = { ...this.inventory, weapons: this.dev.weapons.slice(0, 6).map((id) => ({ id, level: 8, evolved })) }
    }
    this.stats = this.computeRunStats()
    if (this.dev.frenzy) this.psychosis = { value: 0, frenzyLeftSec: balance.psychosis.frenzyDurationSec }
    const startSec = Math.max(0, this.dev.startSec ?? 0)
    this.clock = startSec
    this.director = new Director(waves, this.rng, startSec)
    this.floor = new CityFloor(this, this.run.seed)
    // cosmetic randomness has its own stream: options never change the run
    const cosmetic = createRng(this.run.seed ^ 0x51ab1e)
    this.screen = new ScreenFx(this, cosmetic)
    this.frenzyOverlay = new FrenzyOverlay(this, cosmetic)
    this.screen.shakeEnabled = this.run.options.screenShake
    this.player = new Player(this, character, this.stats, available)
    this.enemies = new EnemyPool(this, waves.enemyCap, available)
    this.projectiles = new ProjectilePool(this, PROJECTILE_CAP)
    this.damageNumbers = new DamageNumbers(this)
    this.vfx = new FxPool(this)
    this.grenades = new Grenades(this)
    this.characterColor = Number.parseInt(character.color.replace('#', ''), 16) || 0xffffff
    this.weapons = new WeaponSystem(this, character.color)
    this.syncWeapons()
    this.skills = new SkillSystem(this, getSkill(character.skill))
    this.bosses = new BossController(this)
    this.pickups = new PickupPool(this, PICKUP_CAP)
    this.chests = new Chests(this)
    this.pauseState = new PauseState(gameBus, () => this.flow.busy)
    this.pauseState.onChange((paused) => this.freezeCosmetics(paused))
    this.flow = new RunFlow(gameBus, {
      rng: this.rng,
      getInventory: () => this.inventory,
      setInventory: (inv) => this.setInventory(inv),
      luck: () => this.stats.luck,
      pause: (reason) => this.pauseState.pause(reason),
      resume: (reason) => this.pauseState.resume(reason),
      onCard: (card) => this.onCard(card),
      weaponPool: implementedWeapons(),
    })
    this.controls = new InputManager(this)
    this.createAudio()

    const cam = this.cameras.main
    cam.startFollow(this.player.sprite, true)
    this.applyZoom()
    this.scale.on(Phaser.Scale.Events.RESIZE, this.applyZoom, this)
    this.scene.launch(TOUCH_SCENE_KEY, { touch: this.controls.touch, debug: () => this.debugLine() })
    bindSceneEnd(this.events, (destroying) => this.teardown(destroying))
  }

  /** Web Audio needs a user gesture: unlock now if the page already had one, else on first input. */
  private createAudio(): void {
    if (typeof AudioContext === 'undefined') return
    const audio = new AudioSystem(() => new AudioContext())
    this.audio = audio
    audio.setVolumes(this.run.options.musicVolume, this.run.options.sfxVolume)
    const nav = navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }
    if (nav.userActivation?.hasBeenActive) audio.unlock()
    const unlock = () => audio.unlock()
    this.input.once(Phaser.Input.Events.POINTER_DOWN, unlock)
    this.input.keyboard?.once('keydown', unlock)
    this.offOptions = gameBus.on('options:changed', (o) => this.applyOptions(o))
  }

  /** Options changed from the pause menu. */
  applyOptions(o: GameOptions): void {
    this.run = { ...this.run, options: o }
    this.audio?.setVolumes(o.musicVolume, o.sfxVolume)
    this.screen.shakeEnabled = o.screenShake
  }

  /** Stats from character, Ripperdoc and the cyberware owned now. */
  computeRunStats(): Stats {
    const character = getCharacter(this.run.characterId)
    return computeStats(balance.baseStats, collectModifiers(character, this.run.ripperdoc, this.inventory.cyberware))
  }

  get gameScene(): Phaser.Scene {
    return this
  }

  /** Re-reads inventory and stats into the weapon system (after cards and evolutions). */
  syncWeapons(): void {
    this.weapons.sync(this.inventory, this.stats)
    for (const w of this.inventory.weapons) this.weaponsSeen.add(w.id)
  }

  get paused(): boolean {
    return this.pauseState.paused || this.player.dead
  }

  /** Inventory changes (cards, chests, evolutions) refresh stats, player and weapons. */
  setInventory(inv: Inventory): void {
    this.inventory = inv
    this.stats = this.computeRunStats()
    this.player.setStats(this.stats)
    this.syncWeapons()
    this.skills?.setStats(this.stats)
  }

  get inputState(): InputState {
    return this.input0
  }

  inventoryWeapon(id: WeaponId): OwnedWeapon | undefined {
    return this.inventory.weapons.find((w) => w.id === id)
  }

  heal(amount: number): void {
    this.player.heal(healAmount(amount, this.psychosis.value))
  }

  aim(out: Vec): Vec {
    const p = this.player
    this.aimFrom.x = p.x
    this.aimFrom.y = p.bodyY
    this.aimFace.x = p.faceX
    this.aimFace.y = p.faceY
    const i = this.grid.nearest(p.x, p.bodyY, AIM_NEAREST_RANGE)
    let nearest: Vec | null = null
    if (i >= 0) {
      this.aimNearest.x = this.enemies.x[i]
      this.aimNearest.y = this.enemies.bodyY(i)
      nearest = this.aimNearest
    }
    return aimDirection('aim', this.input0, this.aimFrom, nearest, this.aimFace, out) ?? out
  }

  private onCard(card: LevelUpCard): void {
    if (card.kind === 'heal') this.heal(card.amount)
    else if (card.kind === 'eurodollars') this.eurodollars += card.amount
  }

  /** Sprite animations, tweens and timers stop with the game (menu, level-up, chest). */
  private freezeCosmetics(paused: boolean): void {
    if (paused) {
      this.anims.pauseAll()
      this.tweens.pauseAll()
    } else {
      this.anims.resumeAll()
      this.tweens.resumeAll()
    }
    this.time.paused = paused
  }

  private applyZoom(): void {
    this.cameras.main.setZoom(computeZoom(this.scale.width, this.scale.height))
  }

  update(_time: number, deltaMs: number): void {
    this.fps = this.game.loop.actualFps
    const cam = this.cameras.main
    const screenX = (this.player.x - cam.worldView.x) * cam.zoom
    const screenY = (this.player.bodyY - cam.worldView.y) * cam.zoom
    this.input0 = this.controls.update(screenX, screenY, this.run.options.autoAim)
    // ignored while a level-up or chest is open (PauseState)
    if (this.input0.pause) this.pauseState.toggleMenu()
    stepFrame(deltaMs, this.frameHost)
  }

  /** The per-frame steps, in order; see run/frame.ts for the pause rules. */
  private readonly frameHost: FrameHost = {
    isPaused: () => this.paused,
    advanceClock: (dt) => {
      this.frame++
      this.clock += dt
    },
    simulate: (dt) => this.simulate(dt),
    resolveDamage: () => {
      this.contactDamage()
      this.enemyShotHits()
    },
  }

  private simulate(dt: number): void {
    const cam = this.cameras.main
    this.player.update(dt, this.input0, isFrenzy(this.psychosis))
    this.skills.update(dt, this.input0.skill)
    this.floor.update(cam)
    this.spawnStep(dt)
    const v = cam.worldView
    this.inView.setTo(v.x - VIEW_MARGIN, v.y - VIEW_MARGIN, v.width + VIEW_MARGIN * 2, v.height + VIEW_MARGIN * 2)
    this.bosses.update(dt)
    this.enemies.fillGrid(this.grid)
    this.enemies.update(dt, this.frame, this.player.x, this.player.y, this.inView, this.grid, this.enemyShot)
    this.enemies.fillGrid(this.grid)
    if (this.frame % RELOCATE_EVERY_FRAMES === 0) this.relocateFarEnemies()
    this.projectiles.update(dt, this.enemies.slow)
    this.weapons.update(dt, this.input0)
    this.grenades.update(dt, this)
    this.vfx.update(dt)
    this.damageNumbers.update(dt)
    this.screen.update(dt)
    this.psychosis = tickPsychosis(this.psychosis, dt)
    this.frenzyOverlay.update(dt, isFrenzy(this.psychosis))
    // these two can open a level-up or a chest: stepFrame then skips player damage
    this.pickups.update(dt, this.player.x, this.player.y, this.stats.magnet, PICKUP_RADIUS, this.collect)
    this.chests.update(dt, this.player.x, this.player.y, this.openChest)
  }

  private readonly openChest = (): void => {
    this.sfx('chest')
    this.flow.onChestOpened()
  }

  /** Ranged enemies (kite) fire through the shared projectile pool. */
  protected enemyShot: EnemyShot = (x, y, dx, dy, def, damageMult) => {
    const r = def.ranged
    if (!r) return
    this.projectiles.fire(OWNER_ENEMY, x, y, dx * r.projectileSpeed, dy * r.projectileSpeed, ENEMY_SHOT_LIFE_SEC, r.damage * damageMult, 1, ENEMY_SHOT_RADIUS, ENEMY_SHOT_COLOR)
  }

  private enemyShotHits(): void {
    const pr = this.projectiles
    const p = this.player
    for (let i = 0; i < pr.cap; i++) {
      if (!pr.active[i] || pr.owner[i] !== OWNER_ENEMY) continue
      const r = pr.radius[i] + PLAYER_RADIUS
      if ((pr.x[i] - p.x) ** 2 + (pr.y[i] - p.bodyY) ** 2 > r * r) continue
      pr.release(i)
      if (this.dev.stress) continue
      const result = p.hurt(pr.damage[i])
      if (result !== 'none') this.onPlayerHurt(result)
    }
  }

  sfx(id: SfxId): void {
    this.audio?.play(id)
  }

  damageEnemy(enemy: number, baseDamage: number, knockX: number, knockY: number): void {
    const e = this.enemies
    if (!e.active[enemy]) return
    const hit = computeDamage(baseDamage, this.stats, { psychosis: this.psychosis.value, frenzy: isFrenzy(this.psychosis), rng: this.rng })
    // bosses barely move when hit
    const k = e.boss[enemy] ? 0.1 : 1
    const dead = e.hit(enemy, hit.amount, knockX * k, knockY * k)
    this.damageNumbers.show(e.x[enemy], e.y[enemy] - 30, hit.amount, hit.crit)
    this.sfx(dead ? 'kill' : 'hit')
    if (dead) this.onEnemyKilled(enemy)
  }

  /** XP, drops, chests, psychosis and counters. */
  protected onEnemyKilled(enemy: number): void {
    const def = this.enemies.def(enemy)
    this.dropLoot(enemy)
    this.kills++
    this.killsByEnemy[def.id] = (this.killsByEnemy[def.id] ?? 0) + 1
    this.enemiesSeen.add(def.id)
    let cyberLevels = 0
    for (const c of this.inventory.cyberware) cyberLevels += c.level
    this.psychosis = onKill(this.psychosis, cyberLevels)
    this.enemies.release(enemy)
  }

  private dropLoot(enemy: number): void {
    const e = this.enemies
    const def = e.def(enemy)
    const x = e.x[enemy]
    const y = e.y[enemy]
    const luck = this.stats.luck
    const d = balance.drops
    const p = this.pickups
    p.drop(PICKUP_XP, x, y, def.xp)
    if (this.rng.next() < def.eurodollarChance * luck) {
      p.drop(PICKUP_EURO, x + 8, y, this.rng.int(d.eurodollarBag[0], d.eurodollarBag[1]))
    }
    if (this.rng.next() < d.medkitChance * luck) p.drop(PICKUP_MEDKIT, x - 8, y, d.medkitHeal)
    if (this.rng.next() < d.magnetChance * luck) p.drop(PICKUP_MAGNET, x, y + 8, 0)
    if (this.rng.next() < d.empChance * luck) p.drop(PICKUP_EMP, x, y - 8, 0)
    // a chest that finds no free slot opens at once
    if ((e.elite[enemy] || e.boss[enemy]) && !this.chests.place(x, y)) this.flow.onChestOpened()
  }

  private readonly collect = (kind: PickupKind, value: number): void => {
    switch (kind) {
      case PICKUP_XP: {
        const next = addXp({ level: this.level, xp: this.xp }, value, this.stats.growth)
        this.level = next.level
        this.xp = next.xp
        this.sfx('pickup')
        if (next.levelsGained > 0) {
          this.sfx('levelup')
          this.flow.onLevels(next.levelsGained)
        }
        break
      }
      case PICKUP_EURO:
        this.eurodollars += value
        break
      case PICKUP_MEDKIT:
        this.player.heal(healAmount(value, this.psychosis.value))
        break
      case PICKUP_MAGNET:
        this.pickups.magnetAll()
        break
      case PICKUP_EMP:
        this.emp()
        break
    }
  }

  /** EMP grenade: every non-boss enemy on screen dies (spec 2.8). */
  private emp(): void {
    const v = this.cameras.main.worldView
    const e = this.enemies
    for (let i = 0; i < e.cap; i++) {
      if (e.active[i] && !e.boss[i] && v.contains(e.x[i], e.y[i])) this.onEnemyKilled(i)
    }
    this.screen.flash(0.2, 0xd1f7ff)
  }

  private spawnStep(dt: number): void {
    const stress = this.dev.stress ?? 0
    if (stress > 0) {
      // harness performance test: keep `stress` maelstroms alive, no director
      const missing = Math.min(stress - this.enemies.alive, 40)
      if (missing > 0) this.spawnOrder({ kind: 'normal', enemyId: 'maelstrom', formation: 'scatter', count: missing })
      return
    }
    for (const order of this.director.update(this.clock, dt, this.enemies.alive)) this.spawnOrder(order)
  }

  spawnOrder(order: SpawnOrder): void {
    const v = this.cameras.main.worldView
    const def = getEnemy(order.enemyId)
    const alert = alertMultipliers(this.clock)
    const boss = order.kind === 'boss'
    const bossIndex = order.bossIndex ?? 0
    // bossHp already includes the alert HP multiplier
    const hpMult = boss ? bossHp(def.hp, bossIndex, this.clock) / def.hp : alert.hp
    const pts = formationPositions(order.formation, order.count, v.centerX, v.centerY, v.width, v.height, this.rng)
    for (const p of pts) {
      const slot = this.enemies.spawn(
        def,
        p.x,
        p.y,
        { elite: order.kind === 'elite', boss, hpMult, damageMult: alert.damage },
        this.player.x,
        this.player.y,
      )
      if (slot >= 0) this.onEnemySpawned(slot)
      if (slot >= 0 && boss) this.bosses.add(slot, bossIndex)
    }
  }

  /** Codex: an enemy counts as seen once it spawns. */
  protected onEnemySpawned(slot: number): void {
    this.enemiesSeen.add(this.enemies.def(slot).id)
  }

  spawnAround(enemyId: EnemyId, x: number, y: number, count: number, radius: number): void {
    const def = getEnemy(enemyId)
    const alert = alertMultipliers(this.clock)
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2
      const slot = this.enemies.spawn(
        def,
        x + Math.cos(a) * radius,
        y + Math.sin(a) * radius,
        { hpMult: alert.hp, damageMult: alert.damage },
        this.player.x,
        this.player.y,
      )
      if (slot >= 0) this.onEnemySpawned(slot)
    }
  }

  hurtPlayer(raw: number): void {
    if (this.dev.stress) return
    const result = this.player.hurt(raw)
    if (result !== 'none') this.onPlayerHurt(result)
  }

  /** Enemies left far behind come back near the visible edge (spec 3.5). */
  private relocateFarEnemies(): void {
    const v = this.cameras.main.worldView
    const limit = 1.5 * Math.hypot(v.width, v.height)
    const e = this.enemies
    for (let i = 0; i < e.cap; i++) {
      if (!e.active[i] || e.boss[i]) continue
      if (Math.hypot(e.x[i] - this.player.x, e.y[i] - this.player.y) <= limit) continue
      const p = scatterPoint(v.centerX, v.centerY, v.width, v.height, this.rng, this.scratch)
      e.x[i] = p.x
      e.y[i] = p.y
    }
  }

  private contactDamage(): void {
    if (this.player.invulnerable || this.player.dead) return
    const n = this.enemies.queryHits(this.grid, this.player.x, this.player.bodyY, PLAYER_RADIUS, this.contacts)
    for (let k = 0; k < n; k++) {
      if (this.dev.stress) return
      const result = this.player.hurt(this.enemies.damage[this.contacts[k]])
      if (result === 'none') continue
      this.onPlayerHurt(result)
      return
    }
  }

  protected onPlayerHurt(result: 'hit' | 'revived' | 'dead'): void {
    this.sfx('hurt')
    if (result === 'revived') {
      this.enemies.pushAway(this.player.x, this.player.y, REVIVE_RADIUS, REVIVE_FORCE)
      this.screen.flash(0.25, 0x05d9e8)
    } else if (result === 'dead') {
      this.onPlayerDeath()
    } else {
      this.screen.shake(0.08, 4)
    }
  }

  /** Run end and `run:end` come with plan Task 15. */
  protected onPlayerDeath(): void {
    console.info('[game] player died at', this.clock.toFixed(1), 's')
  }

  private debugLine(): string | null {
    const fps = this.run.options.showFps || this.dev.stress ? `FPS ${Math.round(this.fps)}  ` : ''
    if (!fps && !import.meta.env.DEV) return null
    const p = this.player
    const t = Math.floor(this.clock)
    const time = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
    return `${fps}${time}  Lv ${this.level} (${Math.floor(this.xp)}/${xpToNext(this.level)})  €$ ${this.eurodollars}  HP ${Math.ceil(p?.hp ?? 0)}/${Math.round(p?.maxHp ?? 0)}  enemies ${this.enemies?.alive ?? 0}  kills ${this.kills}${this.paused ? '  [paused]' : ''}`
  }

  /** Runs once, on scene shutdown or on game destroy (see bindSceneEnd). */
  protected teardown(destroying: boolean): void {
    // bus listeners first: they must go even if a later step throws
    this.flow?.dispose()
    this.pauseState?.dispose()
    this.scale.off(Phaser.Scale.Events.RESIZE, this.applyZoom, this)
    this.controls?.destroy()
    this.weapons?.destroy()
    this.offOptions?.()
    this.offOptions = null
    this.audio?.dispose()
    this.audio = null
    this.skills?.destroy()
    // on game destroy the scene manager is tearing every scene down already
    if (!destroying) {
      this.freezeCosmetics(false)
      this.scene.stop(TOUCH_SCENE_KEY)
    }
  }
}
