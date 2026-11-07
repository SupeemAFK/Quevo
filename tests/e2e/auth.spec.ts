import { expect, test } from '@playwright/test'

const customerPassword = 'quevo-e2e-customer-password'

test('customer can sign in and sign out through an HttpOnly session', async ({ context, page }) => {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
	await page.getByLabel('Email').fill('customer@quevo.local')
  await page.getByLabel('Password').fill(customerPassword)
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByText('Signed in as Demo Customer')).toBeVisible()
  const sessionCookie = (await context.cookies()).find((cookie) => cookie.name === 'quevo_session')
  expect(sessionCookie?.httpOnly).toBe(true)
  expect(sessionCookie?.sameSite).toBe('Lax')
  expect(await page.evaluate(() => document.cookie)).not.toContain('quevo_session')

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()
  expect((await context.cookies()).some((cookie) => cookie.name === 'quevo_session')).toBe(false)
})

test('invalid credentials show a safe message and create no session', async ({ context, page }) => {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
	await page.getByLabel('Email').fill('customer@quevo.local')
  await page.getByLabel('Password').fill('incorrect-password')
  await page.getByRole('button', { name: 'Sign in' }).click()

	await expect(page.getByRole('status')).toHaveText('Sign in failed. Check your email and password.')
  await expect(page.getByLabel('Password')).toHaveValue('')
  expect((await context.cookies()).some((cookie) => cookie.name === 'quevo_session')).toBe(false)
})
