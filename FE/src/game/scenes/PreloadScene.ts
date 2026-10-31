// Loads the atlases and registers one animation per <spriteKey>_<dir>_<action> group.
// A missing atlas is not fatal: entities fall back to neon placeholders.
import Phaser from 'phaser'
import { animConfig, actionOf, groupFrames } from '../render/animations'

export const PRELOAD_SCENE_KEY = 'Preload'
export const ATLASES = ['heroes', 'enemies'] as const
/** registry key of the Set<string> of animation keys that exist */
export const ANIMS_KEY = 'animKeys'

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(PRELOAD_SCENE_KEY)
  }

  preload(): void {
    const { width, height } = this.scale
    const bar = this.add.rectangle(width / 2 - 100, height / 2, 0, 4, 0x05d9e8).setOrigin(0, 0.5)
    this.load.on('progress', (p: number) => bar.setSize(200 * p, 4))
    this.load.on('loaderror', (file: Phaser.Loader.File) => console.warn('[game] asset failed', file.key))
    const base = `${import.meta.env.BASE_URL}assets/atlas/`
    for (const name of ATLASES) this.load.atlas(name, `${base}${name}.png`, `${base}${name}.json`)
  }

  create(): void {
    const available = new Set<string>()
    for (const atlas of ATLASES) {
      if (!this.textures.exists(atlas)) continue
      const names = this.textures.get(atlas).getFrameNames()
      for (const [key, frames] of groupFrames(names)) {
        available.add(key)
        if (this.anims.exists(key)) continue
        this.anims.create({
          key,
          frames: frames.map((frame) => ({ key: atlas, frame })),
          ...animConfig(key.endsWith('_fx') ? 'fx' : actionOf(key)),
        })
      }
    }
    this.registry.set(ANIMS_KEY, available)
    this.scene.start('Run')
  }
}
