import { expect, test } from '@playwright/test'

const customerPassword = 'quevo-e2e-customer-password'

test('customer selects a service, joins, and reloads their ticket', async ({ page }) => {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Email').fill('customer@quevo.local')
  await page.getByLabel('Password').fill(customerPassword)
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByText('Signed in as Demo Customer')).toBeVisible()
  await page.getByRole('link', { name: 'Choose a service' }).click()
  await expect(page.getByRole('heading', { name: 'Join a queue' })).toBeVisible()

  await page.getByRole('button', { name: 'General Service at Quevo Demo Branch' }).click()
  await page.getByRole('button', { name: 'Join queue' }).click()

  await expect(page.getByRole('heading', { name: 'Your ticket' })).toBeVisible()
  await expect(page.getByTestId('ticket-number')).toHaveText('1')
  await expect(page.getByRole('status')).toHaveText('WAITING')
  await expect(page.getByText('General Service')).toBeVisible()

  await page.reload()
  await expect(page.getByTestId('ticket-number')).toHaveText('1')
  await expect(page.getByRole('status')).toHaveText('WAITING')

  await page.goto('/customer')
  await page.getByRole('button', { name: 'General Service at Quevo Demo Branch' }).click()
  await page.getByRole('button', { name: 'Join queue' }).click()
  await expect(page.getByRole('alert')).toHaveText(
    'You already have an active ticket for this service today.',
  )
})
