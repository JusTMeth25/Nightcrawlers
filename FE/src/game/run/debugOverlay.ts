// The in-canvas developer line (FPS, time, level, HP, enemies) is for development only: players
// see FPS in the HUD, never this line drawn under the health and XP bars.
export function debugOverlayEnabled({ dev, stress }: { dev: boolean; stress: boolean }): boolean {
  return dev || stress
}
