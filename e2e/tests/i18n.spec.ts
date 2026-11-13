import { expect, test } from '@playwright/test'
import { extractTokenLink, waitForEmail } from '../fixtures/mail'
import { newUser } from '../fixtures/users'

// The whole flow in English: language chosen in Options, sign-up, English email, English screens.
test('a player who picks English gets English screens and an English verification email', async ({ page }) => {
  const user = newUser('i18n')

  await page.goto('/options')
  await page.getByLabel(/Lingua|Language|Idioma/).selectOption('en')
  await expect(page.getByRole('heading', { name: 'Options' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')

  await page.goto('/register')
  await page.getByLabel('Username').fill(user.username)
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()

  const mail = await waitForEmail(user.email, { subject: 'Confirm your email address' })
  expect(mail.Text).toContain(`Hi ${user.username},`)
  expect(mail.Text).toContain('Your profile is almost ready.')
  expect(mail.HTML).toContain('<html lang="en"')
  expect(mail.Text).not.toContain('Ciao')

  await page.goto(extractTokenLink(mail).path)
  await expect(page.getByText('Email verified! Your runs are now saved.')).toBeVisible()

  await page.goto('/login')
  await page.getByLabel('Username or email').fill(user.username)
  await page.getByLabel('Password').fill(user.password)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page).toHaveURL(/\/select$/)
  await expect(page.getByRole('heading', { name: 'Choose your edgerunner' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
})
