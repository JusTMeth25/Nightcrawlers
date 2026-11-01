import { expect, test } from '@playwright/test'
import { createVerifiedUser, loginViaUi } from '../fixtures/game'
import { waitForTokenLink } from '../fixtures/mail'
import { newUser } from '../fixtures/users'

test('register, verify by email, login, session survives a reload, logout from all devices', async ({ page }) => {
  const user = newUser('acc')

  // registration
  await page.goto('/register')
  await page.getByLabel('Username').fill(user.username)
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(user.password)
  await page.getByRole('button', { name: 'Crea account' }).click()
  await expect(page.getByRole('heading', { name: 'Controlla la tua email' })).toBeVisible()

  // verification link from Mailpit (opened on the app under test, whatever host the email uses)
  const link = await waitForTokenLink(user.email)
  expect(link.path).toMatch(/^\/verify-email\?token=/)
  await page.goto(link.path)
  await expect(page.getByText('Email verificata! Ora le tue run vengono salvate.')).toBeVisible()

  // login (with the email this time)
  await page.goto('/login')
  await page.getByLabel('Username o email').fill(user.email)
  await page.getByLabel('Password').fill(user.password)
  await page.getByRole('button', { name: 'Accedi', exact: true }).click()
  await expect(page).toHaveURL(/\/select$/)
  await page.getByRole('link', { name: 'Indietro' }).click()
  await expect(page.getByText(`Connesso come ${user.username}`)).toBeVisible()

  // reload: the access token lives in memory only, the refresh cookie restores the session
  await page.reload()
  await expect(page.getByText(`Connesso come ${user.username}`)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Account' })).toBeVisible()

  // account screen
  await page.getByRole('link', { name: 'Account' }).click()
  await expect(page).toHaveURL(/\/account$/)
  await expect(page.getByText(user.email)).toBeVisible()
  await expect(page.getByText('Verificata', { exact: true })).toBeVisible()

  const revoked = page.waitForResponse((r) => r.url().endsWith('/api/auth/logout-all'))
  await page.getByRole('button', { name: 'Esci da tutti i dispositivi' }).click()
  expect((await revoked).status()).toBe(204)
  // the screen the app lands on right after is covered (as a known bug) by the next test
  await expect(page).not.toHaveURL(/\/account$/)

  // fresh page load: the refresh token was revoked on the server, so the app starts as guest
  await page.goto('/')
  await expect(page.getByText('Modalità ospite: i progressi non vengono salvati')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Accedi' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Account' })).toHaveCount(0)
})

// Regression: signing out used to let RequireAuth redirect /account to /login before the
// navigation to the title screen committed.
test('logout from all devices returns to the title screen', async ({ page, request }) => {
  const user = newUser('lga')
  await createVerifiedUser(request, user)
  await loginViaUi(page, user)
  await page.getByRole('link', { name: 'Indietro' }).click()
  await page.getByRole('link', { name: 'Account' }).click()
  await page.getByRole('button', { name: 'Esci da tutti i dispositivi' }).click()
  await expect(page).toHaveURL(/\/$/, { timeout: 5_000 })
  await expect(page.getByRole('heading', { name: 'NIGHTCRAWLERS' })).toBeVisible()
})
