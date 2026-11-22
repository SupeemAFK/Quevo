import { expect, test } from '@playwright/test'

const customerPassword = process.env.QUEVO_E2E_CUSTOMER_PASSWORD!

test('customer can sign in and sign out through an HttpOnly session', async ({ context, page }) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Email')).toBeFocused()
  expect(
    await page.getByLabel('Email').evaluate((element) => element.getBoundingClientRect().height),
  ).toBeGreaterThanOrEqual(44)
  await page.getByLabel('Email').fill('customer@quevo.local')
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Password')).toBeFocused()
  expect(
    await page.getByLabel('Password').evaluate((element) => element.getBoundingClientRect().height),
  ).toBeGreaterThanOrEqual(44)
  await page.getByLabel('Password').fill(customerPassword)
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeFocused()
  expect(
    await page
      .getByRole('button', { name: 'Sign in' })
      .evaluate((element) => element.getBoundingClientRect().height),
  ).toBeGreaterThanOrEqual(44)
  await page.keyboard.press('Enter')

  await page.getByRole('button', { name: 'Open navigation menu' }).focus()
  await page.keyboard.press('Enter')
  const openCustomerQueue = page.getByRole('link', { name: 'Open customer queue' })
  await expect(openCustomerQueue).toBeVisible()
  const sessionCookie = (await context.cookies()).find((cookie) => cookie.name === 'quevo_session')
  expect(sessionCookie?.httpOnly).toBe(true)
  expect(sessionCookie?.sameSite).toBe('Lax')
  expect(await page.evaluate(() => document.cookie)).not.toContain('quevo_session')

  await openCustomerQueue.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('navigation', { name: 'Application' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Customer queue' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(
    page.locator('#top').getByRole('link', { name: 'Sign in to Quevo' }),
  ).toBeVisible()
  expect((await context.cookies()).some((cookie) => cookie.name === 'quevo_session')).toBe(false)
})

test('invalid credentials show a safe message and create no session', async ({ context, page }) => {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Email').fill('customer@quevo.local')
  await page.getByLabel('Password').fill('incorrect-password')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByRole('alert')).toHaveText(
    'Sign in failed. Check your email and password.',
  )
  await expect(page.getByLabel('Password')).toHaveValue('')
  expect((await context.cookies()).some((cookie) => cookie.name === 'quevo_session')).toBe(false)
})
