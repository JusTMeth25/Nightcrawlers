import { expect, test, type Page } from '@playwright/test'
import { createVerifiedUser, loginViaUi } from '../fixtures/game'
import { newUser } from '../fixtures/users'

const buyButtons = (page: Page) => page.getByRole('button', { name: /^Installa .+ per \d+ €\$$/ })

test('guest sees the Ripperdoc disabled with an invite to register', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Modalità ospite: i progressi non vengono salvati')).toBeVisible()
  await page.getByRole('link', { name: 'Ripperdoc' }).click()
  await expect(page.getByRole('heading', { name: 'Ripperdoc' })).toBeVisible()
  await expect(page.getByText('Il Ripperdoc è riservato agli utenti registrati')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Registrati per salvare le run' })).toBeVisible()

  await expect(buyButtons(page).first()).toBeVisible()
  for (const button of await buyButtons(page).all()) await expect(button).toBeDisabled()
})

test('a verified user with 0 €$ cannot buy upgrades', async ({ page, request }) => {
  const user = newUser('rip')
  await createVerifiedUser(request, user)
  await loginViaUi(page, user)
  await page.getByRole('link', { name: 'Indietro' }).click()
  await page.getByRole('link', { name: 'Ripperdoc' }).click()

  await expect(page.getByText('Saldo: 0 €$')).toBeVisible()
  await expect(page.getByText('Il Ripperdoc è riservato agli utenti registrati')).toHaveCount(0)
  await expect(buyButtons(page).first()).toBeVisible()
  for (const button of await buyButtons(page).all()) await expect(button).toBeDisabled()
})
