// Scene end handling. Phaser 4 emits 'shutdown' when a scene stops, but Game.destroy() emits
// only 'destroy' (Systems.destroy): listen to both so bus listeners never outlive the game.

export const SCENE_SHUTDOWN = 'shutdown'
export const SCENE_DESTROY = 'destroy'

interface SceneEvents {
  once(event: string, fn: () => void): unknown
  off(event: string, fn: () => void): unknown
}

/** Calls `teardown` once, with `destroying` true when the whole game goes away. */
export function bindSceneEnd(events: SceneEvents, teardown: (destroying: boolean) => void): void {
  const onShutdown = () => {
    events.off(SCENE_DESTROY, onDestroy)
    teardown(false)
  }
  const onDestroy = () => {
    events.off(SCENE_SHUTDOWN, onShutdown)
    teardown(true)
  }
  events.once(SCENE_SHUTDOWN, onShutdown)
  events.once(SCENE_DESTROY, onDestroy)
}
