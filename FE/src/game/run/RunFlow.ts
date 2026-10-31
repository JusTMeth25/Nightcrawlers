// Level-up and chest flow over the event bus (no Phaser). One modal at a time:
// queued level-ups first, then queued chests; the game resumes when both queues are empty.
import type { EventBus, GameEvents } from '@shared/events'
import type { ChestReward, LevelUpCard, WeaponId } from '@shared/types'
import { applyCard, type Inventory } from '../systems/inventory'
import { generateOffers, LevelUpQueue } from '../systems/levelup'
import type { Rng } from '../systems/rng'
import { applyEvolution, chestReward } from '../systems/weapons'

export type FlowPause = 'levelup' | 'chest'

export interface RunFlowDeps {
  rng: Rng
  getInventory(): Inventory
  setInventory(i: Inventory): void
  luck(): number
  pause(reason: FlowPause): void
  resume(reason: FlowPause): void
  /** heal and eurodollars cards (and every applied card, for the scene's bookkeeping) */
  onCard?(card: LevelUpCard): void
  /** weapons that may be offered as new; defaults to all */
  weaponPool?: readonly WeaponId[]
}

export class RunFlow {
  private readonly bus: EventBus<GameEvents>
  private readonly deps: RunFlowDeps
  private readonly queue = new LevelUpQueue()
  private pendingChests = 0
  private current: FlowPause | null = null
  private offer: LevelUpCard[] = []
  private chest: ChestReward | null = null
  private readonly off: (() => void)[]

  constructor(bus: EventBus<GameEvents>, deps: RunFlowDeps) {
    this.bus = bus
    this.deps = deps
    this.off = [bus.on('levelup:choose', ({ index }) => this.choose(index)), bus.on('chest:close', () => this.closeChest())]
  }

  get busy(): boolean {
    return this.current !== null
  }

  onLevels(levelsGained: number): void {
    this.queue.push(levelsGained)
    if (!this.current) this.advance()
  }

  onChestOpened(): void {
    this.pendingChests++
    if (!this.current) this.advance()
  }

  private choose(index: number): void {
    if (this.current !== 'levelup') return
    if (!Number.isInteger(index) || index < 0 || index >= this.offer.length) return
    this.apply(this.offer[index])
    this.advance()
  }

  private closeChest(): void {
    if (this.current !== 'chest' || !this.chest) return
    const reward = this.chest
    this.chest = null
    if (reward.evolution) {
      this.deps.setInventory(applyEvolution(this.deps.getInventory(), reward.evolution.weapon))
    } else {
      for (const card of reward.cards) this.apply(card)
    }
    this.advance()
  }

  private apply(card: LevelUpCard): void {
    this.deps.setInventory(applyCard(this.deps.getInventory(), card))
    this.deps.onCard?.(card)
  }

  private switchTo(next: FlowPause | null): void {
    if (this.current === next) return
    const previous = this.current
    this.current = next
    // pause for the next modal first, so the game never looks resumed between two modals
    if (next) this.deps.pause(next)
    if (previous) this.deps.resume(previous)
  }

  private advance(): void {
    const { rng, luck, weaponPool } = this.deps
    if (this.queue.next()) {
      this.switchTo('levelup')
      this.offer = generateOffers(this.deps.getInventory(), rng, luck(), 3, weaponPool)
      this.bus.emit('levelup:offer', { cards: this.offer })
      return
    }
    this.offer = []
    if (this.pendingChests > 0) {
      this.pendingChests--
      this.switchTo('chest')
      this.chest = chestReward(this.deps.getInventory(), rng, luck(), weaponPool)
      this.bus.emit('chest:open', this.chest)
      return
    }
    this.switchTo(null)
  }

  dispose(): void {
    for (const off of this.off) off()
    this.off.length = 0
  }
}
