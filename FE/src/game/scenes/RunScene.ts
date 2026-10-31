// The run: game clock, player, enemies, director and city. Pure rules live in systems/.
// Game time only advances while no pause reason is active (menu, level-up, chest).
import Phaser from 'phaser'
import { balance, getCharacter, getEnemy, waves } from '@data/index'
import { DEFAULT_OPTIONS, type RunConfig, type Stats } from '@shared/types'
import { DEV_OPTIONS_KEY, RUN_CONFIG_KEY, type DevOptions } from '../config'
import { formationPositions } from '../entities/formations'
import { EnemyPool, type EnemyShot } from '../entities/EnemyPool'
import { Player } from '../entities/Player'
import { InputManager } from '../input/InputManager'
import { alertMultipliers, Director, type SpawnOrder } from '../systems/director'
import { createInventory, type Inventory } from '../systems/inventory'
import { createPsychosis, isFrenzy, type PsychosisState } from '../systems/psychosis'
import { createRng, type Rng } from '../systems/rng'
import { SpatialGrid } from '../systems/spatialGrid'
import { collectModifiers, computeStats } from '../systems/stats'
import { CityFloor } from '../world/CityFloor'
import { computeZoom, ENEMY_RADIUS, GRID_CELL, PLAYER_RADIUS } from '../world/view'
import { ANIMS_KEY } from './PreloadScene'
import { TOUCH_SCENE_KEY } from './TouchControlsScene'

export const RUN_SCENE_KEY = 'Run'
/** Longest frame step: a tab back from background must not teleport anything. */
export const MAX_FRAME_MS = 100
const VIEW_MARGIN = 96
const RELOCATE_EVERY_FRAMES = 30
const REVIVE_RADIUS = 220
const REVIVE_FORCE = 900

export type PauseReason = 'menu' | 'levelup' | 'chest'

const FALLBACK_RUN: RunConfig = {
  mode: 'guest',
  runId: null,
  seed: 1,
  characterId: 'david',
  ripperdoc: {},
  options: DEFAULT_OPTIONS,
}

export class RunScene extends Phaser.Scene {
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
  controls!: InputManager
  kills = 0
  readonly pauseReasons = new Set<PauseReason>()
  protected frame = 0
  protected floor!: CityFloor
  protected readonly inView = new Phaser.Geom.Rectangle()
  protected readonly contacts: number[] = []
  private fps = 0

  constructor() {
    super(RUN_SCENE_KEY)
  }

  init(): void {
    this.run = (this.registry.get(RUN_CONFIG_KEY) as RunConfig | undefined) ?? FALLBACK_RUN
    this.dev = (this.registry.get(DEV_OPTIONS_KEY) as DevOptions | undefined) ?? {}
    this.clock = 0
    this.frame = 0
    this.kills = 0
    this.pauseReasons.clear()
    this.psychosis = createPsychosis()
  }

  create(): void {
    const character = getCharacter(this.run.characterId)
    const available = (this.registry.get(ANIMS_KEY) as Set<string> | undefined) ?? new Set<string>()
    this.rng = createRng(this.run.seed)
    this.inventory = createInventory(character.startingWeapon)
    this.stats = this.computeRunStats()
    this.director = new Director(waves, this.rng)
    this.floor = new CityFloor(this, this.run.seed)
    this.player = new Player(this, character, this.stats, available)
    this.enemies = new EnemyPool(this, waves.enemyCap, available)
    this.controls = new InputManager(this)

    const cam = this.cameras.main
    cam.startFollow(this.player.sprite, true)
    this.applyZoom()
    this.scale.on(Phaser.Scale.Events.RESIZE, this.applyZoom, this)
    this.scene.launch(TOUCH_SCENE_KEY, { touch: this.controls.touch, debug: () => this.debugLine() })
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown())
  }

  /** Stats from character, Ripperdoc and the cyberware owned now. */
  computeRunStats(): Stats {
    const character = getCharacter(this.run.characterId)
    return computeStats(balance.baseStats, collectModifiers(character, this.run.ripperdoc, this.inventory.cyberware))
  }

  get paused(): boolean {
    return this.pauseReasons.size > 0 || this.player.dead
  }

  pauseFor(reason: PauseReason): void {
    this.pauseReasons.add(reason)
  }

  resumeFrom(reason: PauseReason): void {
    this.pauseReasons.delete(reason)
  }

  private applyZoom(): void {
    this.cameras.main.setZoom(computeZoom(this.scale.width, this.scale.height))
  }

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs, MAX_FRAME_MS) / 1000
    this.fps = this.game.loop.actualFps
    const cam = this.cameras.main
    const screenX = (this.player.x - cam.worldView.x) * cam.zoom
    const screenY = (this.player.bodyY - cam.worldView.y) * cam.zoom
    const input = this.controls.update(screenX, screenY, this.run.options.autoAim)
    if (input.pause) this.onPauseInput()
    if (this.paused) return

    this.frame++
    this.clock += dt
    this.player.update(dt, input, isFrenzy(this.psychosis))
    this.floor.update(cam)
    this.spawnStep(dt)

    const v = cam.worldView
    this.inView.setTo(v.x - VIEW_MARGIN, v.y - VIEW_MARGIN, v.width + VIEW_MARGIN * 2, v.height + VIEW_MARGIN * 2)
    this.enemies.fillGrid(this.grid)
    this.enemies.update(dt, this.frame, this.player.x, this.player.y, this.inView, this.grid, this.enemyShot)
    this.enemies.fillGrid(this.grid)
    if (this.frame % RELOCATE_EVERY_FRAMES === 0) this.relocateFarEnemies()
    this.contactDamage()
  }


  /** Enemy ranged attacks; the projectile pool replaces this in Task 11. */
  protected enemyShot: EnemyShot = () => {}

  /** Esc / Start / touch pause button. */
  protected onPauseInput(): void {
    if (this.pauseReasons.has('menu')) this.resumeFrom('menu')
    else this.pauseFor('menu')
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
    const bossHp = order.kind === 'boss' ? balance.boss.hpGrowth ** (order.bossIndex ?? 0) : 1
    const pts = formationPositions(order.formation, order.count, v.centerX, v.centerY, v.width, v.height, this.rng)
    for (const p of pts) {
      this.enemies.spawn(
        def,
        p.x,
        p.y,
        { elite: order.kind === 'elite', boss: order.kind === 'boss', hpMult: alert.hp * bossHp, damageMult: alert.damage },
        this.player.x,
        this.player.y,
      )
    }
  }

  /** Enemies left far behind come back near the visible edge (spec 3.5). */
  private relocateFarEnemies(): void {
    const v = this.cameras.main.worldView
    const limit = 1.5 * Math.hypot(v.width, v.height)
    const e = this.enemies
    for (let i = 0; i < e.cap; i++) {
      if (!e.active[i] || e.boss[i]) continue
      if (Math.hypot(e.x[i] - this.player.x, e.y[i] - this.player.y) <= limit) continue
      const [p] = formationPositions('scatter', 1, v.centerX, v.centerY, v.width, v.height, this.rng)
      e.x[i] = p.x
      e.y[i] = p.y
    }
  }

  private contactDamage(): void {
    if (this.player.invulnerable || this.player.dead) return
    const n = this.grid.queryRadius(this.player.x, this.player.bodyY, PLAYER_RADIUS + ENEMY_RADIUS, this.contacts)
    for (let k = 0; k < n; k++) {
      if (this.dev.stress) return
      const result = this.player.hurt(this.enemies.damage[this.contacts[k]])
      if (result === 'none') continue
      this.onPlayerHurt(result)
      return
    }
  }

  protected onPlayerHurt(result: 'hit' | 'revived' | 'dead'): void {
    if (result === 'revived') {
      this.enemies.pushAway(this.player.x, this.player.y, REVIVE_RADIUS, REVIVE_FORCE)
      this.cameras.main.flash(250, 5, 217, 232)
    } else if (result === 'dead') {
      this.onPlayerDeath()
    } else if (this.run.options.screenShake) {
      this.cameras.main.shake(80, 0.004)
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
    return `${fps}${time}  HP ${Math.ceil(p?.hp ?? 0)}/${Math.round(p?.maxHp ?? 0)}  enemies ${this.enemies?.alive ?? 0}  kills ${this.kills}${this.paused ? '  [paused]' : ''}`
  }

  protected teardown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.applyZoom, this)
    this.controls?.destroy()
    this.scene.stop(TOUCH_SCENE_KEY)
  }

}
