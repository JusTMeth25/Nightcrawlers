// First scene: builds the tiny generated textures every other scene relies on, then loads assets.
import Phaser from 'phaser'
import { tracePolygon } from '../render/placeholders'

export const BOOT_SCENE_KEY = 'Boot'
export const TEX_DOT = 'tex_dot'
export const TEX_SHARD = 'tex_shard'
export const TEX_BLADE = 'tex_blade'
export const TEX_RING = 'tex_ring'
export const TEX_BEAM = 'tex_beam'
export const TEX_ARC = 'tex_arc'
export const TEX_DRONE = 'tex_drone'
export const TEX_GRENADE = 'tex_grenade'
export const TEX_PIXEL = 'tex_pixel'
export const TEX_WEDGE = 'tex_wedge'
/** reach of the wedge texture (60 degree cone, apex at the left middle) */
export const WEDGE_RADIUS = 64
/** radius of the ring texture: scale = wanted radius / RING_RADIUS */
export const RING_RADIUS = 32
/** beam texture length: scaleX = wanted length / BEAM_LENGTH */
export const BEAM_LENGTH = 64
/** reach of the arc texture */
export const ARC_RADIUS = 48

export class BootScene extends Phaser.Scene {
  constructor() {
    super(BOOT_SCENE_KEY)
  }

  create(): void {
    const g = this.make.graphics({}, false)
    // soft round bullet, tinted per weapon
    g.fillStyle(0xffffff, 0.25)
    g.fillCircle(8, 8, 8)
    g.fillStyle(0xffffff, 1)
    g.fillCircle(8, 8, 4)
    g.generateTexture(TEX_DOT, 16, 16)
    g.clear()
    // data fragment (XP)
    g.fillStyle(0xffffff, 0.3)
    tracePolygon(g, [{ x: 6, y: 0 }, { x: 12, y: 6 }, { x: 6, y: 12 }, { x: 0, y: 6 }]).fillPath()
    g.fillStyle(0xffffff, 1)
    tracePolygon(g, [{ x: 6, y: 2 }, { x: 10, y: 6 }, { x: 6, y: 10 }, { x: 2, y: 6 }]).fillPath()
    g.generateTexture(TEX_SHARD, 12, 12)
    g.clear()
    // monowire blade: thin glowing segment
    g.fillStyle(0xffffff, 0.3)
    g.fillRect(0, 0, 28, 6)
    g.fillStyle(0xffffff, 1)
    g.fillRect(2, 2, 24, 2)
    g.generateTexture(TEX_BLADE, 28, 6)
    g.clear()
    // explosion / shockwave ring with a soft fill
    g.fillStyle(0xffffff, 0.18)
    g.fillCircle(RING_RADIUS, RING_RADIUS, RING_RADIUS)
    g.lineStyle(4, 0xffffff, 1)
    g.strokeCircle(RING_RADIUS, RING_RADIUS, RING_RADIUS - 2)
    g.generateTexture(TEX_RING, RING_RADIUS * 2, RING_RADIUS * 2)
    g.clear()
    // beam: glow band with a hot core
    g.fillStyle(0xffffff, 0.3)
    g.fillRect(0, 0, BEAM_LENGTH, 8)
    g.fillStyle(0xffffff, 1)
    g.fillRect(0, 3, BEAM_LENGTH, 2)
    g.generateTexture(TEX_BEAM, BEAM_LENGTH, 8)
    g.clear()
    // melee slash: crescent facing +x, centred on the left edge middle
    g.lineStyle(6, 0xffffff, 0.35)
    g.beginPath()
    g.arc(0, ARC_RADIUS, ARC_RADIUS - 4, -Math.PI / 3, Math.PI / 3, false)
    g.strokePath()
    g.lineStyle(2, 0xffffff, 1)
    g.beginPath()
    g.arc(0, ARC_RADIUS, ARC_RADIUS - 4, -Math.PI / 3, Math.PI / 3, false)
    g.strokePath()
    g.generateTexture(TEX_ARC, ARC_RADIUS, ARC_RADIUS * 2)
    g.clear()
    // drone: small diamond with rotor dots
    g.fillStyle(0xffffff, 0.3)
    g.fillCircle(8, 8, 8)
    g.fillStyle(0xffffff, 1)
    tracePolygon(g, [{ x: 8, y: 2 }, { x: 14, y: 8 }, { x: 8, y: 14 }, { x: 2, y: 8 }]).fillPath()
    g.fillStyle(0x000000, 1)
    g.fillCircle(8, 8, 2)
    g.generateTexture(TEX_DRONE, 16, 16)
    g.clear()
    // grenade
    g.fillStyle(0xffffff, 0.3)
    g.fillCircle(6, 6, 6)
    g.fillStyle(0xffffff, 1)
    g.fillCircle(6, 6, 3)
    g.generateTexture(TEX_GRENADE, 12, 12)
    g.clear()
    g.fillStyle(0xffffff, 1)
    g.fillRect(0, 0, 4, 4)
    g.generateTexture(TEX_PIXEL, 4, 4)
    g.clear()
    // boss cone telegraph: 60 degree wedge
    g.fillStyle(0xffffff, 0.35)
    g.slice(0, WEDGE_RADIUS, WEDGE_RADIUS, -Math.PI / 6, Math.PI / 6, false)
    g.fillPath()
    g.lineStyle(2, 0xffffff, 1)
    g.slice(0, WEDGE_RADIUS, WEDGE_RADIUS - 1, -Math.PI / 6, Math.PI / 6, false)
    g.strokePath()
    g.generateTexture(TEX_WEDGE, WEDGE_RADIUS, WEDGE_RADIUS * 2)
    g.destroy()
    this.scene.start('Preload')
  }
}
