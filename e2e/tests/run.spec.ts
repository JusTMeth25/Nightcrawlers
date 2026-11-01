import { expect, test } from '@playwright/test'
import { createVerifiedUser, loginViaUi, playUntil, quitRun, startRunWithDavid, WEBKIT_SKIP_REASON, webkitTooSlowForGame } from '../fixtures/game'
import { newUser } from '../fixtures/users'

// In-app navigation only after the login: every full page load rotates the refresh token, and
// leaving a page while that rotation is in flight would drop the session.
test('a verified user ends a run: the server awards €$ and the save is updated', async ({ page, request, hasTouch, browserName }) => {
  test.skip(webkitTooSlowForGame(browserName), WEBKIT_SKIP_REASON)
  const user = newUser('run')
  await createVerifiedUser(request, user)
  await loginViaUi(page, user)

  // fresh save: the Codex knows nothing yet
  await page.getByRole('link', { name: 'Indietro' }).click()
  await expect(page.getByText(`Connesso come ${user.username}`)).toBeVisible()
  await page.getByRole('link', { name: 'Codex' }).click()
  await expect(page.getByText('Nemici e armi incontrati nelle tue run.')).toBeVisible()
  await expect(page.getByText('Pistola', { exact: true })).toHaveCount(0)
  await page.getByRole('link', { name: 'Indietro' }).click()

  await page.getByRole('link', { name: 'Gioca' }).click()
  await startRunWithDavid(page)
  await playUntil(page, 5)
  await quitRun(page, hasTouch)

  // outcome of POST /api/runs/{id}/end
  const awarded = page.getByText(/^€\$ accreditati: \d+$/)
  await expect(awarded).toBeVisible({ timeout: 15_000 })
  const amount = Number((await awarded.textContent())!.match(/\d+/)![0])
  await expect(page.getByText(`Saldo: ${amount} €$`)).toBeVisible()
  await expect(page.getByText('Run segnalata come non plausibile')).toHaveCount(0)

  // reload: the save shown now comes from GET /api/save, and David's pistol is in the Codex
  await page.getByRole('link', { name: 'Menu principale' }).click()
  await page.getByRole('link', { name: 'Codex' }).click()
  await page.reload()
  await expect(page.getByText('Nemici e armi incontrati nelle tue run.')).toBeVisible()
  await expect(page.getByText('Pistola', { exact: true })).toBeVisible()

  // the Ripperdoc shows the same balance
  await page.getByRole('link', { name: 'Indietro' }).click()
  await page.getByRole('link', { name: 'Ripperdoc' }).click()
  await expect(page.getByText(`Saldo: ${amount} €$`)).toBeVisible()
})
