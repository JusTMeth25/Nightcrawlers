import { expect, test } from '@playwright/test'
import { hudTimer, playUntil, quitRun, startRunWithDavid, timerSeconds, WEBKIT_SKIP_REASON, webkitTooSlowForGame } from '../fixtures/game'

test('guest plays a run with David, quits from the pause menu and is invited to register', async ({ page, hasTouch, browserName }) => {
  test.skip(webkitTooSlowForGame(browserName), WEBKIT_SKIP_REASON)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'NIGHTCRAWLERS' })).toBeVisible()
  // no refresh cookie: the session settles as guest
  await expect(page.getByText('Modalità ospite: i progressi non vengono salvati')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Accedi' })).toBeVisible()

  await page.getByRole('link', { name: 'Gioca' }).click()
  await expect(page).toHaveURL(/\/select$/)
  await startRunWithDavid(page)

  // the HUD timer advances while the game runs
  const first = await timerSeconds(page)
  await playUntil(page, first + 2)
  await expect(hudTimer(page)).toBeVisible()

  await quitRun(page, hasTouch)

  await expect(page.getByText('I progressi degli ospiti non vengono salvati.')).toBeVisible()
  const invite = page.getByRole('link', { name: 'Registrati per salvare le run' })
  await expect(invite).toBeVisible()
  await invite.click()
  await expect(page).toHaveURL(/\/register$/)
  await expect(page.getByRole('heading', { name: 'Registrati' })).toBeVisible()
})
