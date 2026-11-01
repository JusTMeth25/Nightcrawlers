// UI helpers for the game screens. The Phaser canvas is driven only with the keyboard (or the HUD
// pause button on touch devices); every assertion goes through the React HUD and overlays.
import { expect, type APIRequestContext, type Page } from '@playwright/test'
import { waitForTokenLink } from './mail'
import type { TestUser } from './users'

export const hudTimer = (page: Page) => page.locator('time[aria-label="Tempo"]')
export const pauseDialog = (page: Page) => page.getByRole('dialog', { name: 'Pausa' })
const levelUpDialog = (page: Page) => page.getByRole('dialog', { name: 'Level up!' })
const chestDialog = (page: Page) => page.getByRole('dialog', { name: 'Baule aperto' })

/** "mm:ss" or "h:mm:ss" -> seconds. */
export function parseClock(text: string): number {
  return text
    .trim()
    .split(':')
    .reduce((acc, part) => acc * 60 + Number(part), 0)
}

export async function timerSeconds(page: Page): Promise<number> {
  return parseClock((await hudTimer(page).textContent()) ?? '0')
}

/** From /select: picks David and starts the run, then waits for the canvas and the HUD. */
export async function startRunWithDavid(page: Page) {
  await expect(page.getByRole('heading', { name: 'Scegli il tuo edgerunner' })).toBeVisible()
  const david = page.getByRole('button', { name: /David Martinez/ })
  await david.click()
  await expect(david).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Avvia', exact: true }).click()
  await expect(page).toHaveURL(/\/play$/)
  await expect(page.getByTestId('game-canvas')).toBeVisible()
  await expect(page.getByTestId('game-canvas').locator('canvas')).toHaveCount(1, { timeout: 20_000 })
  await expect(hudTimer(page)).toBeVisible({ timeout: 20_000 })
}

/** Closes a level-up or chest overlay that may pop up during the run. */
async function dismissRewardOverlays(page: Page) {
  if (await levelUpDialog(page).isVisible()) await levelUpDialog(page).getByRole('button').first().click()
  if (await chestDialog(page).isVisible()) await chestDialog(page).getByRole('button', { name: 'Continua' }).click()
}

/** Plays until the HUD timer reaches `seconds`, moving the player around with WASD. */
export async function playUntil(page: Page, seconds: number) {
  const keys = ['d', 's', 'a', 'w']
  let i = 0
  await expect
    .poll(
      async () => {
        await dismissRewardOverlays(page)
        const key = keys[i++ % keys.length]
        await page.keyboard.down(key)
        await page.waitForTimeout(400)
        await page.keyboard.up(key)
        return timerSeconds(page)
      },
      { timeout: (seconds + 30) * 1000, intervals: [100] },
    )
    .toBeGreaterThanOrEqual(seconds)
}

/**
 * Holds a key for a short moment: the game polls the keyboard once per frame (Phaser JustDown), so a
 * zero-length synthetic press can fall between two frames and be missed.
 */
export async function pressKey(page: Page, key: string, holdMs = 120) {
  await page.keyboard.down(key)
  await page.waitForTimeout(holdMs)
  await page.keyboard.up(key)
}

/** Opens the pause menu: Esc on desktop, the HUD pause button on touch devices. */
export async function openPauseMenu(page: Page, touch: boolean) {
  await expect(async () => {
    await dismissRewardOverlays(page)
    if (!(await pauseDialog(page).isVisible())) {
      if (touch) await page.getByRole('button', { name: 'Pausa', exact: true }).tap()
      else await pressKey(page, 'Escape')
    }
    await expect(pauseDialog(page)).toBeVisible({ timeout: 1500 })
  }).toPass({ timeout: 15_000 })
}

/** Pause menu -> Abbandona -> Sì, abbandona; waits for the game-over screen. */
export async function quitRun(page: Page, touch: boolean) {
  await openPauseMenu(page, touch)
  const dialog = pauseDialog(page)
  await dialog.getByRole('button', { name: 'Abbandona' }).click()
  await expect(dialog.getByText('Abbandonare la run?')).toBeVisible()
  await dialog.getByRole('button', { name: 'Sì, abbandona' }).click()
  await expect(page).toHaveURL(/\/game-over$/)
  await expect(page.getByRole('heading', { name: 'Flatline' })).toBeVisible()
}

/** Registers through the API and verifies the email with the token from Mailpit. */
export async function createVerifiedUser(request: APIRequestContext, user: TestUser) {
  const reg = await request.post('/api/auth/register', {
    data: { username: user.username, email: user.email, password: user.password },
  })
  expect(reg.status(), await reg.text()).toBe(202)
  const { token } = await waitForTokenLink(user.email)
  const ver = await request.post('/api/auth/verify-email', { data: { token } })
  expect(ver.ok(), await ver.text()).toBeTruthy()
}

/** Logs in through the login screen; the app then lands on /select. */
export async function loginViaUi(page: Page, user: TestUser) {
  await page.goto('/login')
  await page.getByLabel('Username o email').fill(user.username)
  await page.getByLabel('Password').fill(user.password)
  await page.getByRole('button', { name: 'Accedi', exact: true }).click()
  await expect(page).toHaveURL(/\/select$/)
}

/**
 * Playwright's WebKit build for Windows renders WebGL in software so slowly that the game clock
 * barely moves (about 1 game second per 30 s). Gameplay tests skip it there; on macOS/Linux they run.
 */
export const webkitTooSlowForGame = (browserName: string) => browserName === 'webkit' && process.platform === 'win32'
export const WEBKIT_SKIP_REASON = 'WebKit on Windows: WebGL too slow for the game loop (run on macOS/Linux CI)'
